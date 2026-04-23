import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Deal, Message, User, AuditLogEntry, Notification, DealStage, MessageStatus, DistributionList, ChatChannel, ChatMessage, UserRole, UserCategory } from '@/types/bond';
import { mockUsers, mockDeals, mockMessages, mockAuditLog, mockNotifications, mockDistributionLists, mockChatChannels, mockChatMessages } from '@/data/mockData';
import { extractBorrowerName } from '@/lib/alertParsing';
import { supabase } from '@/integrations/supabase/client';
import { fetchUsers, fetchDeals, insertUser, updateUserRow, deleteUserRow, insertDeal, updateDealRow, rowToDeal, rowToUser } from '@/integrations/supabase/cloudData';

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
  createDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>) => Deal;
  updateDeal: (dealId: string, updates: Partial<Deal>) => void;
  updateDealStage: (dealId: string, newStage: DealStage, note?: string) => void;
  createMessage: (msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => Message;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  sendMessage: (id: string) => void;
  retractMessage: (id: string) => void;
  deleteMessage: (id: string) => void;
  deleteMessageThread: (dealIds: string[]) => void;
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
  const [users, setUsers] = useState<User[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [messages, setMessages] = usePersistedState<Message[]>('bondvdr.messages', mockMessages);
  const [auditLog, setAuditLog] = usePersistedState<AuditLogEntry[]>('bondvdr.auditLog', mockAuditLog);
  const [notifications, setNotifications] = usePersistedState<Notification[]>('bondvdr.notifications', mockNotifications);
  const [distributionLists, setDistributionLists] = usePersistedState<DistributionList[]>('bondvdr.distributionLists', mockDistributionLists);
  const [chatChannels, setChatChannels] = usePersistedState<ChatChannel[]>('bondvdr.chatChannels', mockChatChannels);
  const [chatMessages, setChatMessages] = usePersistedState<ChatMessage[]>('bondvdr.chatMessages', mockChatMessages);

  // Load users + deals from Cloud, then subscribe to realtime updates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, d] = await Promise.all([fetchUsers(), fetchDeals()]);
        if (cancelled) return;
        setUsers(u);
        setDeals(d);
      } catch (e) {
        console.error('[Cloud] Failed to load users/deals', e);
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
    setAuditLog(prev => [{ ...entry, id: `al${Date.now()}`, timestamp: new Date() }, ...prev]);
  }, [setAuditLog]);

  const createDeal = useCallback((deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>) => {
    const newDeal: Deal = { ...deal, id: `d${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), stageHistory: [] };
    setDeals(prev => [newDeal, ...prev]);
    const newChannel: ChatChannel = {
      id: `ch${Date.now()}`,
      participantIds: [...users.filter(u => u.organizationType === 'bank' || u.organizationType === 'vendor').map(u => u.id)],
      dealId: newDeal.id,
      label: `${deal.issuerName} ${deal.currency} ${deal.tenor} — Deal Thread`,
      createdAt: new Date(),
    };
    setChatChannels(prev => [...prev, newChannel]);
    addAuditEntry({ action: 'DEAL_CREATED', entityType: 'deal', entityId: newDeal.id, userId: currentUser.id, details: `Created deal: ${deal.issuerName} ${deal.currency} ${deal.tenor}` });
    return newDeal;
  }, [currentUser.id, addAuditEntry, users, setDeals, setChatChannels]);

  const updateDeal = useCallback((dealId: string, updates: Partial<Deal>) => {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, ...updates, updatedAt: new Date() } : d));
    addAuditEntry({ action: 'DEAL_UPDATED', entityType: 'deal', entityId: dealId, userId: currentUser.id, details: `Deal updated (${Object.keys(updates).join(', ')})` });
  }, [currentUser.id, addAuditEntry, setDeals]);

  const updateDealStage = useCallback((dealId: string, newStage: DealStage, note?: string) => {
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const transition = { from: d.stage, to: newStage, timestamp: new Date(), userId: currentUser.id, note };
      return { ...d, stage: newStage, updatedAt: new Date(), stageHistory: [...d.stageHistory, transition] };
    }));
    addAuditEntry({ action: 'DEAL_STAGE_CHANGED', entityType: 'deal', entityId: dealId, userId: currentUser.id, details: `Stage changed to ${newStage}${note ? `: ${note}` : ''}` });
  }, [currentUser.id, addAuditEntry, setDeals]);

  const createMessage = useCallback((msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newMsg: Message = { ...msg, id: `m${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
    setMessages(prev => [newMsg, ...prev]);
    addAuditEntry({ action: 'MESSAGE_CREATED', entityType: 'message', entityId: newMsg.id, userId: currentUser.id, details: `Draft created: ${msg.subject}` });
    return newMsg;
  }, [currentUser.id, addAuditEntry, setMessages]);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m));
  }, [setMessages]);

  const sendMessageAction = useCallback((id: string) => {
    const now = new Date();
    const msg = messages.find(m => m.id === id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'sent' as MessageStatus, sentAt: now, updatedAt: now } : m));
    addAuditEntry({ action: 'MESSAGE_SENT', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message sent` });
    if (msg) {
      for (const dealId of msg.dealIds) {
        const deal = deals.find(d => d.id === dealId);
        const channel = chatChannels.find(ch => ch.dealId === dealId);
        if (channel && deal) {
          const stageTag = deal.stage.toUpperCase();
          const botMsg: ChatMessage = {
            id: `cm${Date.now()}_${dealId}`,
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
        }
      }
    }
  }, [currentUser.id, addAuditEntry, messages, deals, chatChannels, setMessages, setChatMessages]);

  const retractMessage = useCallback((id: string) => {
    const now = new Date();
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'retracted' as MessageStatus, retractedAt: now, retractedBy: currentUser.id, updatedAt: now } : m));
    addAuditEntry({ action: 'MESSAGE_RETRACTED', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message retracted` });
  }, [currentUser.id, addAuditEntry, setMessages]);

  const deleteMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    addAuditEntry({ action: 'MESSAGE_DELETED', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message deleted` });
  }, [currentUser.id, addAuditEntry, setMessages]);

  const deleteMessageThread = useCallback((dealIds: string[]) => {
    const key = dealIds.join(',');
    setMessages(prev => prev.filter(m => m.dealIds.join(',') !== key));
    addAuditEntry({ action: 'MESSAGE_THREAD_DELETED', entityType: 'message', entityId: key, userId: currentUser.id, details: `Alert thread deleted (deals: ${key})` });
  }, [currentUser.id, addAuditEntry, setMessages]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, [setNotifications]);

  const sendChatMessage = useCallback((channelId: string, body: string, attachments: ChatMessage['attachments'] = [], linkedMessageId?: string) => {
    const newMsg: ChatMessage = {
      id: `cm${Date.now()}`,
      channelId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderType: currentUser.organizationType,
      body,
      attachments,
      linkedMessageId,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newMsg]);
    addAuditEntry({ action: 'CHAT_MESSAGE_SENT', entityType: 'message', entityId: newMsg.id, userId: currentUser.id, details: `Secure chat message in channel ${channelId}` });
  }, [currentUser.id, currentUser.name, currentUser.organizationType, addAuditEntry, setChatMessages]);

  const addUser = useCallback((user: Omit<User, 'id' | 'createdAt' | 'createdBy'>) => {
    const newUser: User = { ...user, id: `u${Date.now()}`, createdAt: new Date(), createdBy: currentUser.id };
    setUsers(prev => [...prev, newUser]);
    addAuditEntry({ action: 'USER_CREATED', entityType: 'user', entityId: newUser.id, userId: currentUser.id, details: `Created user: ${user.name}` });
    return newUser;
  }, [currentUser.id, addAuditEntry, setUsers]);

  const deleteUser = useCallback((id: string) => {
    const user = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    addAuditEntry({ action: 'USER_DELETED', entityType: 'user', entityId: id, userId: currentUser.id, details: `Deleted user: ${user?.name}` });
  }, [currentUser.id, addAuditEntry, users, setUsers]);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    addAuditEntry({ action: 'USER_UPDATED', entityType: 'user', entityId: id, userId: currentUser.id, details: `Updated user ${id}` });
  }, [currentUser.id, addAuditEntry, setUsers]);

  const addDistributionList = useCallback((list: Omit<DistributionList, 'id'>) => {
    const newList: DistributionList = { ...list, id: `dl${Date.now()}` };
    setDistributionLists(prev => [...prev, newList]);
    addAuditEntry({ action: 'DIST_LIST_CREATED', entityType: 'permission', entityId: newList.id, userId: currentUser.id, details: `Created distribution list: ${list.name}` });
    return newList;
  }, [currentUser.id, addAuditEntry, setDistributionLists]);

  const updateDistributionList = useCallback((id: string, updates: Partial<DistributionList>) => {
    setDistributionLists(prev => prev.map(dl => dl.id === id ? { ...dl, ...updates } : dl));
    addAuditEntry({ action: 'DIST_LIST_UPDATED', entityType: 'permission', entityId: id, userId: currentUser.id, details: `Updated distribution list ${id}` });
  }, [currentUser.id, addAuditEntry, setDistributionLists]);

  const deleteDistributionList = useCallback((id: string) => {
    const list = distributionLists.find(dl => dl.id === id);
    setDistributionLists(prev => prev.filter(dl => dl.id !== id));
    addAuditEntry({ action: 'DIST_LIST_DELETED', entityType: 'permission', entityId: id, userId: currentUser.id, details: `Deleted distribution list: ${list?.name}` });
  }, [currentUser.id, addAuditEntry, distributionLists, setDistributionLists]);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, deals, messages, auditLog, notifications, distributionLists,
      chatChannels, chatMessages,
      createDeal, updateDeal, updateDealStage, createMessage, updateMessage, sendMessage: sendMessageAction, retractMessage, markNotificationRead, addAuditEntry, sendChatMessage,
      deleteMessage, deleteMessageThread,
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
