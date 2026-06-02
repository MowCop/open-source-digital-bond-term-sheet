import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Deal, Message, User, AuditLogEntry, Notification, DealStage, MessageStatus, DistributionList, ChatChannel, ChatMessage, UserRole, UserCategory } from '@/types/bond';
import { mockUsers } from '@/data/mockData';
import { extractBorrowerName } from '@/lib/alertParsing';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { scopeDeals, scopeUsers, scopeDistributionLists, scopeMessages, scopeAuditLog } from '@/lib/scoping';
import {
  fetchUsers, fetchDeals, insertUser, updateUserRow, deleteUserRow,
  insertDeal, updateDealRow, rowToDeal, rowToUser,
  fetchMessages, insertMessage, updateMessageRow, deleteMessageRow, deleteMessagesByDealKey, rowToMessage,
  deleteMessagesContainingDeal, deleteDealRow, deleteChatChannelsByDeal, deleteChatMessagesByDeal, deleteNotificationsByDeal,
  fetchAuditLog, insertAudit, rowToAudit,
  fetchNotifications, insertNotification, markNotificationReadRow, rowToNotification,
  fetchDistributionLists, insertDistributionList, updateDistributionListRow, deleteDistributionListRow, rowToDistList,
  fetchChatChannels, insertChatChannel, rowToChatChannel,
  updateChatChannel,
  fetchChatMessages, insertChatMessage, rowToChatMessage,
} from '@/integrations/supabase/cloudData';

// Date field names that may appear in persisted entities — revived from string to Date on load.
const DATE_FIELDS = new Set([
  'createdAt', 'updatedAt', 'sentAt', 'retractedAt', 'timestamp', 'lastUsed',
]);

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(reviveDates) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DATE_FIELDS.has(k) && typeof v === 'string') {
        const d = new Date(v);
        out[k] = isNaN(d.getTime()) ? v : d;
      } else if (v && typeof v === 'object') {
        out[k] = reviveDates(v);
      } else {
        out[k] = v;
      }
    }
    return out as T;
  }
  return value;
}

function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      return reviveDates(parsed) as T;
    } catch {
      return initial;
    }
  });

  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // ignore quota / serialization errors
      }
    }, 150);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [key, state]);

  return [state, setState];
}

export function resetDemoData() {
  const keys = [
    'bondvdr.currentUser', 'bondvdr.users', 'bondvdr.deals', 'bondvdr.messages',
    'bondvdr.auditLog', 'bondvdr.notifications', 'bondvdr.distributionLists',
    'bondvdr.chatChannels', 'bondvdr.chatMessages',
  ];
  keys.forEach(k => localStorage.removeItem(k));
  window.location.reload();
}

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  deals: Deal[];
  messages: Message[];
  auditLog: AuditLogEntry[];
  notifications: Notification[];
  distributionLists: DistributionList[];
  chatChannels: ChatChannel[];
  chatMessages: ChatMessage[];
  createDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>, scpIds?: string[]) => Deal;
  updateDeal: (dealId: string, updates: Partial<Deal>) => void;
  updateDealStage: (dealId: string, newStage: DealStage, note?: string) => void;
  createMessage: (msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => Message;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  sendMessage: (id: string) => void;
  retractMessage: (id: string) => void;
  deleteMessage: (id: string) => void;
  deleteMessageThread: (dealIds: string[]) => void;
  deleteDeal: (dealId: string) => void;
  markNotificationRead: (id: string) => void;
  addAuditEntry: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  sendChatMessage: (channelId: string, body: string, attachments?: ChatMessage['attachments'], linkedMessageId?: string) => void;
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'createdBy'>) => User;
  deleteUser: (id: string) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  addDistributionList: (list: Omit<DistributionList, 'id'>) => DistributionList;
  updateDistributionList: (id: string, updates: Partial<DistributionList>) => void;
  deleteDistributionList: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = usePersistedState<User>('bondvdr.currentUser', mockUsers[0]);
  const { profileOrg, authUser } = useAuth();
  // Effective sender id for RLS-protected inserts (messages, chat_messages):
  // these policies require sender_id = auth.uid()::text, so we must use the
  // Supabase auth UUID, not the legacy mock-user id. Falls back to mock id
  // when there is no auth session (tests / unauth flows).
  const effectiveSenderId = authUser?.id ?? currentUser.id;
  // Effective owning-org used to tag newly created deals/users/lists for tenant isolation.
  const ownerOrg = (profileOrg ?? currentUser?.organization ?? '').trim() || undefined;
  const [users, setUsers] = useState<User[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [chatChannels, setChatChannels] = useState<ChatChannel[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Load users + deals from Cloud, then subscribe to realtime updates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, d, m, a, n, dl, cc, cm] = await Promise.all([
          fetchUsers(), fetchDeals(), fetchMessages(), fetchAuditLog(),
          fetchNotifications(), fetchDistributionLists(), fetchChatChannels(), fetchChatMessages(),
        ]);
        if (cancelled) return;
        setUsers(u);
        setDeals(d);
        setMessages(m);
        setAuditLog(a);
        setNotifications(n);
        setDistributionLists(dl);
        setChatChannels(cc);
        setChatMessages(cm);
      } catch (e) {
        console.error('[Cloud] Failed to load data', e);
      }
    })();

    const channel = supabase
      .channel('bondvdr-cloud')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'users' }, (payload: any) => {
        setUsers(prev => {
          if (payload.eventType === 'INSERT') {
            const u = rowToUser(payload.new);
            return prev.some(x => x.id === u.id) ? prev : [...prev, u];
          }
          if (payload.eventType === 'UPDATE') {
            const u = rowToUser(payload.new);
            return prev.map(x => x.id === u.id ? u : x);
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter(x => x.id !== payload.old.id);
          }
          return prev;
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'deals' }, (payload: any) => {
        setDeals(prev => {
          if (payload.eventType === 'INSERT') {
            const d = rowToDeal(payload.new);
            return prev.some(x => x.id === d.id) ? prev : [d, ...prev];
          }
          if (payload.eventType === 'UPDATE') {
            const d = rowToDeal(payload.new);
            return prev.map(x => x.id === d.id ? d : x);
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter(x => x.id !== payload.old.id);
          }
          return prev;
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
        setMessages(prev => {
          if (payload.eventType === 'INSERT') {
            const x = rowToMessage(payload.new);
            return prev.some(p => p.id === x.id) ? prev : [x, ...prev];
          }
          if (payload.eventType === 'UPDATE') {
            const x = rowToMessage(payload.new);
            return prev.map(p => p.id === x.id ? x : p);
          }
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== payload.old.id);
          return prev;
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'audit_log' }, (payload: any) => {
        setAuditLog(prev => {
          if (payload.eventType === 'INSERT') {
            const x = rowToAudit(payload.new);
            return prev.some(p => p.id === x.id) ? prev : [x, ...prev];
          }
          return prev;
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'notifications' }, (payload: any) => {
        setNotifications(prev => {
          if (payload.eventType === 'INSERT') {
            const x = rowToNotification(payload.new);
            return prev.some(p => p.id === x.id) ? prev : [x, ...prev];
          }
          if (payload.eventType === 'UPDATE') {
            const x = rowToNotification(payload.new);
            return prev.map(p => p.id === x.id ? x : p);
          }
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== payload.old.id);
          return prev;
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'distribution_lists' }, (payload: any) => {
        setDistributionLists(prev => {
          if (payload.eventType === 'INSERT') {
            const x = rowToDistList(payload.new);
            return prev.some(p => p.id === x.id) ? prev : [...prev, x];
          }
          if (payload.eventType === 'UPDATE') {
            const x = rowToDistList(payload.new);
            return prev.map(p => p.id === x.id ? x : p);
          }
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== payload.old.id);
          return prev;
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'chat_channels' }, (payload: any) => {
        setChatChannels(prev => {
          if (payload.eventType === 'INSERT') {
            const x = rowToChatChannel(payload.new);
            return prev.some(p => p.id === x.id) ? prev : [...prev, x];
          }
          if (payload.eventType === 'UPDATE') {
            const x = rowToChatChannel(payload.new);
            return prev.map(p => p.id === x.id ? x : p);
          }
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== payload.old.id);
          return prev;
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        setChatMessages(prev => {
          if (payload.eventType === 'INSERT') {
            const x = rowToChatMessage(payload.new);
            return prev.some(p => p.id === x.id) ? prev : [...prev, x];
          }
          if (payload.eventType === 'DELETE') return prev.filter(p => p.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // One-time backfill: extend short borrower names using the improved extractor.
  // Only extends (new starts with old) — never overwrites a divergent manual edit.
  const didBackfill = useRef(false);
  useEffect(() => {
    if (didBackfill.current) return;
    didBackfill.current = true;
    setDeals(prevDeals => {
      let changed = false;
      const next = prevDeals.map(d => {
        const dealMsgs = messages
          .filter(m => m.dealIds.includes(d.id))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        if (dealMsgs.length === 0) return d;
        const first = dealMsgs[0];
        const extracted = extractBorrowerName(`${first.subject}\n${first.body}`);
        if (
          extracted &&
          extracted.length > (d.issuerName?.length ?? 0) &&
          extracted.toLowerCase().startsWith((d.issuerName ?? '').toLowerCase())
        ) {
          changed = true;
          return { ...d, issuerName: extracted };
        }
        return d;
      });
      return changed ? next : prevDeals;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAuditEntry = useCallback((entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const full: AuditLogEntry = { ...entry, id: `al${Date.now()}_${Math.random().toString(36).slice(2,7)}`, timestamp: new Date() };
    setAuditLog(prev => [full, ...prev]);
    insertAudit(full).catch(e => console.error('[Cloud] insertAudit failed', e));
  }, []);

  const createDeal = useCallback((deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>, scpIds?: string[]) => {
    const newDeal: Deal = {
      ...deal,
      id: `d${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      stageHistory: [],
      createdByOrg: deal.createdByOrg ?? ownerOrg,
    };
    setDeals(prev => [newDeal, ...prev]);
    insertDeal(newDeal).catch(e => console.error('[Cloud] insertDeal failed', e));
    // Chat channel participants = creator + any selected Syndicate Chat Participants (SCPs).
    // Distribution-list recipients are NOT added — distribution governs deal/screen access only.
    const participantIds = Array.from(new Set([
      currentUser.id,
      ...(scpIds ?? []),
    ]));
    const newChannel: ChatChannel = {
      id: `ch${Date.now()}`,
      participantIds,
      dealId: newDeal.id,
      label: `${deal.issuerName} ${deal.currency} ${deal.tenor} — Deal Thread`,
      createdAt: new Date(),
    };
    setChatChannels(prev => [...prev, newChannel]);
    insertChatChannel(newChannel).catch(e => console.error('[Cloud] insertChatChannel failed', e));
    // Emit chat-invite notifications for each SCP added (excluding creator)
    const invitees = (scpIds ?? []).filter(id => id && id !== currentUser.id);
    if (invitees.length > 0) {
      const dealLabel = `${deal.issuerName} ${deal.currency} ${deal.tenor}`;
      const newNotifs: Notification[] = invitees.map((uid, i) => ({
        id: `n${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        userId: uid,
        type: 'chat_invite',
        title: `Chat invite: ${dealLabel}`,
        body: `You've been added to the deal chat. Open My Deal Chats to join.`,
        read: false,
        timestamp: new Date(),
        dealId: newDeal.id,
      }));
      setNotifications(prev => [...newNotifs, ...prev]);
      newNotifs.forEach(n => insertNotification(n).catch(e => console.error('[Cloud] insertNotification failed', e)));
      invitees.forEach(uid =>
        addAuditEntry({
          action: 'CHAT_PARTICIPANT_ADDED',
          entityType: 'deal',
          entityId: newDeal.id,
          userId: currentUser.id,
          details: `Added ${uid} to deal chat for ${dealLabel}`,
        }),
      );
    }
    addAuditEntry({ action: 'DEAL_CREATED', entityType: 'deal', entityId: newDeal.id, userId: currentUser.id, details: `Created deal: ${deal.issuerName} ${deal.currency} ${deal.tenor}` });
    return newDeal;
  }, [currentUser.id, addAuditEntry, ownerOrg]);

  const updateDeal = useCallback((dealId: string, updates: Partial<Deal>) => {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, ...updates, updatedAt: new Date() } : d));
    updateDealRow(dealId, updates).catch(e => console.error('[Cloud] updateDeal failed', e));
    addAuditEntry({ action: 'DEAL_UPDATED', entityType: 'deal', entityId: dealId, userId: currentUser.id, details: `Deal updated (${Object.keys(updates).join(', ')})` });
  }, [currentUser.id, addAuditEntry]);

  const updateDealStage = useCallback((dealId: string, newStage: DealStage, note?: string) => {
    let nextHistory: Deal['stageHistory'] | undefined;
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const transition = { from: d.stage, to: newStage, timestamp: new Date(), userId: currentUser.id, note };
      nextHistory = [...d.stageHistory, transition];
      return { ...d, stage: newStage, updatedAt: new Date(), stageHistory: nextHistory };
    }));
    updateDealRow(dealId, { stage: newStage, stageHistory: nextHistory }).catch(e => console.error('[Cloud] updateDealStage failed', e));
    addAuditEntry({ action: 'DEAL_STAGE_CHANGED', entityType: 'deal', entityId: dealId, userId: currentUser.id, details: `Stage changed to ${newStage}${note ? `: ${note}` : ''}` });
  }, [currentUser.id, addAuditEntry]);

  const createMessage = useCallback((msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newMsg: Message = {
      ...msg,
      senderId: effectiveSenderId,
      id: `m${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setMessages(prev => [newMsg, ...prev]);
    insertMessage(newMsg).catch(e => {
      console.error('[Cloud] insertMessage failed', e);
      setMessages(prev => prev.filter(m => m.id !== newMsg.id));
      toast.error('Could not save message', { description: e?.message ?? 'Please retry.' });
    });
    addAuditEntry({ action: 'MESSAGE_CREATED', entityType: 'message', entityId: newMsg.id, userId: currentUser.id, details: `Draft created: ${msg.subject}` });
    return newMsg;
  }, [currentUser.id, effectiveSenderId, addAuditEntry]);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m));
    updateMessageRow(id, { ...updates, updatedAt: new Date() }).catch(e => {
      console.error('[Cloud] updateMessage failed', e);
      toast.error('Could not update message', { description: e?.message ?? 'Please retry.' });
    });
  }, []);

  const sendMessageAction = useCallback((id: string) => {
    const now = new Date();
    const msg = messages.find(m => m.id === id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'sent' as MessageStatus, sentAt: now, updatedAt: now } : m));
    updateMessageRow(id, { status: 'sent', sentAt: now, updatedAt: now }).catch(e => {
      console.error('[Cloud] sendMessage failed', e);
      toast.error('Could not send message', { description: e?.message ?? 'Please retry.' });
    });
    addAuditEntry({ action: 'MESSAGE_SENT', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message sent` });
    if (msg) {
      for (const dealId of msg.dealIds) {
        const deal = deals.find(d => d.id === dealId);
        const channel = chatChannels.find(ch => ch.dealId === dealId);
        if (channel && deal) {
          const stageTag = deal.stage.toUpperCase();
          const botMsg: ChatMessage = {
            id: `cm${Date.now()}_${dealId}_${Math.random().toString(36).slice(2,7)}`,
            channelId: channel.id,
            dealId,
            senderId: 'system',
            senderName: 'BondVDR Bot',
            senderType: 'system',
            body: `📢 [${stageTag}] ${deal.issuerName} ${deal.currency} ${deal.tenor} — ${msg.subject}. Discuss Now →`,
            attachments: [],
            linkedMessageId: msg.id,
            timestamp: new Date(),
          };
          setChatMessages(prev => [...prev, botMsg]);
          insertChatMessage(botMsg).catch(e => console.error('[Cloud] insertChatMessage failed', e));
        }
      }
    }
  }, [currentUser.id, addAuditEntry, messages, deals, chatChannels]);

  const retractMessage = useCallback((id: string) => {
    const now = new Date();
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'retracted' as MessageStatus, retractedAt: now, retractedBy: currentUser.id, updatedAt: now } : m));
    updateMessageRow(id, { status: 'retracted', retractedAt: now, retractedBy: currentUser.id, updatedAt: now })
      .catch(e => console.error('[Cloud] retractMessage failed', e));
    addAuditEntry({ action: 'MESSAGE_RETRACTED', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message retracted` });
  }, [currentUser.id, addAuditEntry]);

  const deleteMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    deleteMessageRow(id).catch(e => console.error('[Cloud] deleteMessage failed', e));
    addAuditEntry({ action: 'MESSAGE_DELETED', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message deleted` });
  }, [currentUser.id, addAuditEntry]);

  const deleteMessageThread = useCallback((dealIds: string[]) => {
    const key = dealIds.join(',');
    setMessages(prev => prev.filter(m => m.dealIds.join(',') !== key));
    deleteMessagesByDealKey(dealIds).catch(e => console.error('[Cloud] deleteThread failed', e));
    addAuditEntry({ action: 'MESSAGE_THREAD_DELETED', entityType: 'message', entityId: key, userId: currentUser.id, details: `Alert thread deleted (deals: ${key})` });
  }, [currentUser.id, addAuditEntry]);

  const deleteDeal = useCallback((dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    const msgCount = messages.filter(m => m.dealIds.includes(dealId)).length;
    const chCount = chatChannels.filter(c => c.dealId === dealId).length;
    const cmCount = chatMessages.filter(c => c.dealId === dealId).length;
    const ntCount = notifications.filter(n => n.dealId === dealId).length;

    // Local state purge
    setDeals(prev => prev.filter(d => d.id !== dealId));
    setMessages(prev => prev.filter(m => !m.dealIds.includes(dealId)));
    setChatChannels(prev => prev.filter(c => c.dealId !== dealId));
    setChatMessages(prev => prev.filter(c => c.dealId !== dealId));
    setNotifications(prev => prev.filter(n => n.dealId !== dealId));

    // Cloud cascade (fire-and-forget; order: dependents first)
    deleteMessagesContainingDeal(dealId).catch(e => console.error('[Cloud] deleteDeal messages failed', e));
    deleteChatMessagesByDeal(dealId).catch(e => console.error('[Cloud] deleteDeal chat msgs failed', e));
    deleteChatChannelsByDeal(dealId).catch(e => console.error('[Cloud] deleteDeal channels failed', e));
    deleteNotificationsByDeal(dealId).catch(e => console.error('[Cloud] deleteDeal notifs failed', e));
    deleteDealRow(dealId).catch(e => console.error('[Cloud] deleteDeal row failed', e));

    const label = deal ? `${deal.issuerName} ${deal.currency} ${deal.tenor}` : dealId;
    addAuditEntry({
      action: 'DEAL_DELETED',
      entityType: 'deal',
      entityId: dealId,
      userId: currentUser.id,
      details: `Deleted deal ${label} (cascaded: ${msgCount} alert(s), ${chCount} chat channel(s), ${cmCount} chat message(s), ${ntCount} notification(s))`,
    });
  }, [currentUser.id, addAuditEntry, deals, messages, chatChannels, chatMessages, notifications]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    markNotificationReadRow(id).catch(e => console.error('[Cloud] markNotifRead failed', e));
  }, []);

  const sendChatMessage = useCallback((channelId: string, body: string, attachments: ChatMessage['attachments'] = [], linkedMessageId?: string) => {
    const newMsg: ChatMessage = {
      id: `cm${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      channelId,
      senderId: effectiveSenderId,
      senderName: currentUser.name,
      senderType: currentUser.organizationType,
      body,
      attachments,
      linkedMessageId,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newMsg]);
    insertChatMessage(newMsg).catch(e => {
      console.error('[Cloud] sendChatMessage failed', e);
      setChatMessages(prev => prev.filter(m => m.id !== newMsg.id));
      toast.error('Could not send chat message', { description: e?.message ?? 'Please retry.' });
    });
    addAuditEntry({ action: 'CHAT_MESSAGE_SENT', entityType: 'message', entityId: newMsg.id, userId: currentUser.id, details: `Secure chat message in channel ${channelId}` });
  }, [currentUser.id, currentUser.name, currentUser.organizationType, effectiveSenderId, addAuditEntry]);

  const addUser = useCallback((user: Omit<User, 'id' | 'createdAt' | 'createdBy'>) => {
    const newUser: User = {
      ...user,
      id: `u${Date.now()}`,
      createdAt: new Date(),
      createdBy: currentUser.id,
      createdByOrg: user.createdByOrg ?? ownerOrg,
    };
    setUsers(prev => [...prev, newUser]);
    insertUser(newUser).catch(e => console.error('[Cloud] insertUser failed', e));
    addAuditEntry({ action: 'USER_CREATED', entityType: 'user', entityId: newUser.id, userId: currentUser.id, details: `Created user: ${user.name}` });
    return newUser;
  }, [currentUser.id, addAuditEntry, ownerOrg]);

  const deleteUser = useCallback((id: string) => {
    const user = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    deleteUserRow(id).catch(e => console.error('[Cloud] deleteUser failed', e));
    addAuditEntry({ action: 'USER_DELETED', entityType: 'user', entityId: id, userId: currentUser.id, details: `Deleted user: ${user?.name}` });
  }, [currentUser.id, addAuditEntry, users]);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    updateUserRow(id, updates).catch(e => console.error('[Cloud] updateUser failed', e));
    addAuditEntry({ action: 'USER_UPDATED', entityType: 'user', entityId: id, userId: currentUser.id, details: `Updated user ${id}` });
  }, [currentUser.id, addAuditEntry]);

  const addDistributionList = useCallback((list: Omit<DistributionList, 'id'>) => {
    const newList: DistributionList = { ...list, id: `dl${Date.now()}`, createdByOrg: list.createdByOrg ?? ownerOrg };
    setDistributionLists(prev => [...prev, newList]);
    insertDistributionList(newList).catch(e => console.error('[Cloud] insertDistList failed', e));
    addAuditEntry({ action: 'DIST_LIST_CREATED', entityType: 'permission', entityId: newList.id, userId: currentUser.id, details: `Created distribution list: ${list.name}` });
    return newList;
  }, [currentUser.id, addAuditEntry, ownerOrg]);

  const updateDistributionList = useCallback((id: string, updates: Partial<DistributionList>) => {
    setDistributionLists(prev => prev.map(dl => dl.id === id ? { ...dl, ...updates } : dl));
    updateDistributionListRow(id, updates).catch(e => console.error('[Cloud] updateDistList failed', e));
    addAuditEntry({ action: 'DIST_LIST_UPDATED', entityType: 'permission', entityId: id, userId: currentUser.id, details: `Updated distribution list ${id}` });
  }, [currentUser.id, addAuditEntry]);

  const deleteDistributionList = useCallback((id: string) => {
    const list = distributionLists.find(dl => dl.id === id);
    setDistributionLists(prev => prev.filter(dl => dl.id !== id));
    deleteDistributionListRow(id).catch(e => console.error('[Cloud] deleteDistList failed', e));
    addAuditEntry({ action: 'DIST_LIST_DELETED', entityType: 'permission', entityId: id, userId: currentUser.id, details: `Deleted distribution list: ${list?.name}` });
  }, [currentUser.id, addAuditEntry, distributionLists]);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, deals, messages, auditLog, notifications, distributionLists,
      chatChannels, chatMessages,
      createDeal, updateDeal, updateDealStage, createMessage, updateMessage, sendMessage: sendMessageAction, retractMessage, markNotificationRead, addAuditEntry, sendChatMessage,
      deleteMessage, deleteMessageThread,
      deleteDeal,
      addUser, deleteUser, updateUser, addDistributionList, updateDistributionList, deleteDistributionList,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

/**
 * Scoped view of app data filtered to the current user's organization.
 * Master Admin and non-syndicate users see all data unchanged.
 * Syndicate Admins see only deals / users / distribution lists tied to their org.
 */
export function useScopedApp() {
  const app = useApp();
  const { isMaster, isSyndicateAdmin, profileOrg, authUser, guest } = useAuth();
  const ctx = {
    isMaster,
    isSyndicateAdmin,
    currentOrg: profileOrg,
    currentAuthUserId: authUser?.id ?? null,
    currentUserId: app.currentUser?.id ?? null,
    isGuest: !!guest,
    guestDealIds: guest?.dealIds ?? [],
  };
  const allowedDealIds = new Set(guest?.dealIds ?? []);
  const scopedChatChannels = guest
    ? app.chatChannels.filter(c => !c.dealId || allowedDealIds.has(c.dealId))
    : app.chatChannels;
  const scopedChatMessages = guest
    ? app.chatMessages.filter(m => !m.dealId || allowedDealIds.has(m.dealId))
    : app.chatMessages;
  return {
    ...app,
    deals: scopeDeals(app.deals, ctx),
    users: scopeUsers(app.users, ctx),
    distributionLists: scopeDistributionLists(app.distributionLists, ctx),
    messages: scopeMessages(app.messages, ctx),
    auditLog: scopeAuditLog(app.auditLog, ctx),
    chatChannels: scopedChatChannels,
    chatMessages: scopedChatMessages,
  };
}
