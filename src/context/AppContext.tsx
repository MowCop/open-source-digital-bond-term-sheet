import React, { createContext, useContext, useState, useCallback } from 'react';
import { Deal, Message, User, AuditLogEntry, Notification, DealStage, MessageStatus, DistributionList, ChatChannel, ChatMessage, UserRole, UserCategory } from '@/types/bond';
import { mockUsers, mockDeals, mockMessages, mockAuditLog, mockNotifications, mockDistributionLists, mockChatChannels, mockChatMessages } from '@/data/mockData';

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
  updateDealStage: (dealId: string, newStage: DealStage, note?: string) => void;
  createMessage: (msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => Message;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  sendMessage: (id: string) => void;
  retractMessage: (id: string) => void;
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
  const [currentUser, setCurrentUser] = useState<User>(mockUsers[0]);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [deals, setDeals] = useState<Deal[]>(mockDeals);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(mockAuditLog);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>(mockDistributionLists);
  const [chatChannels, setChatChannels] = useState<ChatChannel[]>(mockChatChannels);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);

  const addAuditEntry = useCallback((entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    setAuditLog(prev => [{ ...entry, id: `al${Date.now()}`, timestamp: new Date() }, ...prev]);
  }, []);

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
  }, [currentUser.id, addAuditEntry, users]);

  const updateDealStage = useCallback((dealId: string, newStage: DealStage, note?: string) => {
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const transition = { from: d.stage, to: newStage, timestamp: new Date(), userId: currentUser.id, note };
      return { ...d, stage: newStage, updatedAt: new Date(), stageHistory: [...d.stageHistory, transition] };
    }));
    addAuditEntry({ action: 'DEAL_STAGE_CHANGED', entityType: 'deal', entityId: dealId, userId: currentUser.id, details: `Stage changed to ${newStage}${note ? `: ${note}` : ''}` });
  }, [currentUser.id, addAuditEntry]);

  const createMessage = useCallback((msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newMsg: Message = { ...msg, id: `m${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
    setMessages(prev => [newMsg, ...prev]);
    addAuditEntry({ action: 'MESSAGE_CREATED', entityType: 'message', entityId: newMsg.id, userId: currentUser.id, details: `Draft created: ${msg.subject}` });
    return newMsg;
  }, [currentUser.id, addAuditEntry]);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m));
  }, []);

  const sendMessageAction = useCallback((id: string) => {
    const now = new Date();
    const msg = messages.find(m => m.id === id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'sent' as MessageStatus, sentAt: now, updatedAt: now } : m));
    addAuditEntry({ action: 'MESSAGE_SENT', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message sent` });
    if (msg) {
      // Post bot bridge to each deal's chat channel
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
  }, [currentUser.id, addAuditEntry, messages, deals, chatChannels]);

  const retractMessage = useCallback((id: string) => {
    const now = new Date();
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'retracted' as MessageStatus, retractedAt: now, retractedBy: currentUser.id, updatedAt: now } : m));
    addAuditEntry({ action: 'MESSAGE_RETRACTED', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message retracted` });
  }, [currentUser.id, addAuditEntry]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

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
  }, [currentUser.id, addAuditEntry]);

  const addUser = useCallback((user: Omit<User, 'id' | 'createdAt' | 'createdBy'>) => {
    const newUser: User = { ...user, id: `u${Date.now()}`, createdAt: new Date(), createdBy: currentUser.id };
    setUsers(prev => [...prev, newUser]);
    addAuditEntry({ action: 'USER_CREATED', entityType: 'user', entityId: newUser.id, userId: currentUser.id, details: `Created user: ${user.name}` });
    return newUser;
  }, [currentUser.id, addAuditEntry]);

  const deleteUser = useCallback((id: string) => {
    const user = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    addAuditEntry({ action: 'USER_DELETED', entityType: 'user', entityId: id, userId: currentUser.id, details: `Deleted user: ${user?.name}` });
  }, [currentUser.id, addAuditEntry, users]);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    addAuditEntry({ action: 'USER_UPDATED', entityType: 'user', entityId: id, userId: currentUser.id, details: `Updated user ${id}` });
  }, [currentUser.id, addAuditEntry]);

  const addDistributionList = useCallback((list: Omit<DistributionList, 'id'>) => {
    const newList: DistributionList = { ...list, id: `dl${Date.now()}` };
    setDistributionLists(prev => [...prev, newList]);
    addAuditEntry({ action: 'DIST_LIST_CREATED', entityType: 'permission', entityId: newList.id, userId: currentUser.id, details: `Created distribution list: ${list.name}` });
    return newList;
  }, [currentUser.id, addAuditEntry]);

  const updateDistributionList = useCallback((id: string, updates: Partial<DistributionList>) => {
    setDistributionLists(prev => prev.map(dl => dl.id === id ? { ...dl, ...updates } : dl));
    addAuditEntry({ action: 'DIST_LIST_UPDATED', entityType: 'permission', entityId: id, userId: currentUser.id, details: `Updated distribution list ${id}` });
  }, [currentUser.id, addAuditEntry]);

  const deleteDistributionList = useCallback((id: string) => {
    const list = distributionLists.find(dl => dl.id === id);
    setDistributionLists(prev => prev.filter(dl => dl.id !== id));
    addAuditEntry({ action: 'DIST_LIST_DELETED', entityType: 'permission', entityId: id, userId: currentUser.id, details: `Deleted distribution list: ${list?.name}` });
  }, [currentUser.id, addAuditEntry, distributionLists]);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, deals, messages, auditLog, notifications, distributionLists,
      chatChannels, chatMessages,
      createDeal, updateDealStage, createMessage, updateMessage, sendMessage: sendMessageAction, retractMessage, markNotificationRead, addAuditEntry, sendChatMessage,
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
