import React, { createContext, useContext, useState, useCallback } from 'react';
import { Deal, Message, User, AuditLogEntry, Notification, DealStage, MessageStatus, DistributionList, ChatChannel, ChatMessage } from '@/types/bond';
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
  // Deal actions
  createDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>) => Deal;
  updateDealStage: (dealId: string, newStage: DealStage, note?: string) => void;
  // Message actions
  createMessage: (msg: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>) => Message;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  sendMessage: (id: string) => void;
  retractMessage: (id: string) => void;
  // Notification actions
  markNotificationRead: (id: string) => void;
  // Audit
  addAuditEntry: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  // Chat actions
  sendChatMessage: (channelId: string, body: string, attachments?: ChatMessage['attachments'], linkedMessageId?: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(mockUsers[1]);
  const [users] = useState<User[]>(mockUsers);
  const [deals, setDeals] = useState<Deal[]>(mockDeals);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(mockAuditLog);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [distributionLists] = useState<DistributionList[]>(mockDistributionLists);
  const [chatChannels] = useState<ChatChannel[]>(mockChatChannels);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);

  const addAuditEntry = useCallback((entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    setAuditLog(prev => [{ ...entry, id: `al${Date.now()}`, timestamp: new Date() }, ...prev]);
  }, []);

  const createDeal = useCallback((deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>) => {
    const newDeal: Deal = { ...deal, id: `d${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), stageHistory: [] };
    setDeals(prev => [newDeal, ...prev]);
    addAuditEntry({ action: 'DEAL_CREATED', entityType: 'deal', entityId: newDeal.id, userId: currentUser.id, details: `Created deal: ${deal.borrower} ${deal.currency} ${deal.tenor}` });
    return newDeal;
  }, [currentUser.id, addAuditEntry]);

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
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'sent' as MessageStatus, sentAt: now, updatedAt: now } : m));
    addAuditEntry({ action: 'MESSAGE_SENT', entityType: 'message', entityId: id, userId: currentUser.id, details: `Message sent` });
  }, [currentUser.id, addAuditEntry]);

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
      body,
      attachments,
      linkedMessageId,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newMsg]);
    addAuditEntry({ action: 'CHAT_MESSAGE_SENT', entityType: 'message', entityId: newMsg.id, userId: currentUser.id, details: `Secure chat message in channel ${channelId}` });
  }, [currentUser.id, addAuditEntry]);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, deals, messages, auditLog, notifications, distributionLists,
      chatChannels, chatMessages,
      createDeal, updateDealStage, createMessage, updateMessage, sendMessage: sendMessageAction, retractMessage, markNotificationRead, addAuditEntry, sendChatMessage,
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
