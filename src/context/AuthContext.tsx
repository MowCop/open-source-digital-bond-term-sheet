import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User as AuthUser } from '@supabase/supabase-js';

export type GuestSession = {
  email: string;
  name?: string;
  dealIds: string[];
  passcodeId: string;
  expiresAt?: string;
};

export type ProfileStatus = 'pending' | 'approved' | 'rejected';

interface AuthContextType {
  session: Session | null;
  authUser: AuthUser | null;
  profileStatus: ProfileStatus | null;
  profileName: string | null;
  profileOrg: string | null;
  roles: string[];
  isAdmin: boolean;
  isMaster: boolean;
  isSyndicateAdmin: boolean;
  guest: GuestSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string, organization: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  loginAsGuest: (email: string, passcode: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const GUEST_KEY = 'bondvdr.guestSession';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileOrg, setProfileOrg] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [guest, setGuest] = useState<GuestSession | null>(() => {
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('status, name, organization').eq('user_id', uid).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', uid),
    ]);
    setProfileStatus((profile?.status as ProfileStatus) ?? 'pending');
    setProfileName(profile?.name ?? null);
    setProfileOrg(profile?.organization ?? null);
    setRoles((roleRows ?? []).map((r: { role: string }) => r.role));
  }, []);

  useEffect(() => {
    // Set up listener BEFORE getSession
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setAuthUser(sess?.user ?? null);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => { loadProfile(sess.user.id); }, 0);
      } else {
        setProfileStatus(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setAuthUser(sess?.user ?? null);
      if (sess?.user) loadProfile(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    // clear any guest session
    localStorage.removeItem(GUEST_KEY);
    setGuest(null);
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, organization: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { name, organization } },
    });
    if (error) return { error: error.message };
    // Notify project author (best effort; ignore failure)
    try {
      await supabase.functions.invoke('notify-author-on-signup', {
        body: { email, name, organization, userId: data.user?.id },
      });
    } catch (e) {
      console.warn('[auth] notify-author-on-signup failed', e);
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(GUEST_KEY);
    setGuest(null);
  }, []);

  const loginAsGuest = useCallback(async (email: string, passcode: string) => {
    const { data, error } = await supabase.functions.invoke('guest-login', {
      body: { email, passcode },
    });
    if (error) return { error: error.message || 'Invalid email or passcode' };
    if (!data?.ok) return { error: data?.error || 'Invalid email or passcode' };
    const g: GuestSession = {
      email: data.email,
      name: data.name,
      dealIds: data.dealIds || [],
      passcodeId: data.passcodeId,
      expiresAt: data.expiresAt,
    };
    localStorage.setItem(GUEST_KEY, JSON.stringify(g));
    setGuest(g);
    return {};
  }, []);

  const refreshProfile = useCallback(async () => {
    if (authUser) await loadProfile(authUser.id);
  }, [authUser, loadProfile]);

  const isAdmin = roles.includes('master_admin') || roles.includes('syndicate_admin');
  const isMaster = roles.includes('master_admin');
  const isSyndicateAdmin = !isMaster && roles.includes('syndicate_admin');

  return (
    <AuthContext.Provider value={{
      session, authUser, profileStatus, profileName, profileOrg,
      roles, isAdmin, isMaster, isSyndicateAdmin, guest, loading,
      signIn, signUp, signOut, loginAsGuest, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}