'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'FINANCEIRO';
}

interface AuthContextType {
  user: { uid: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  updatePassword: (newPass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  updatePassword: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<{ uid: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAdminEmail = (email: string) => {
      const e = email.toLowerCase();
      return e === 'ricardomelo@browne.com.br' || e === 'ricardomelo@charquesuprema.com.br';
    };

    const syncProfile = async (u: { id: string; email?: string }) => {
      if (!u.email) return;
      
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('uid', u.id)
        .single();
        
      const shouldBeAdmin = isAdminEmail(u.email);
      const targetRole = shouldBeAdmin ? 'ADMIN' : 'FINANCEIRO';

      if (profileData) {
        // Se já existe mas o cargo está errado para um admin, atualiza
        if (shouldBeAdmin && profileData.role !== 'ADMIN') {
          await supabase
            .from('user_profiles')
            .update({ role: 'ADMIN' })
            .eq('uid', u.id);
          
          setProfile({
            ...profileData,
            role: 'ADMIN'
          });
        } else {
          setProfile({
            uid: profileData.uid,
            email: profileData.email,
            name: profileData.name,
            role: profileData.role
          });
        }
      } else {
        // Se o perfil não existe, cria
        const newProfile: UserProfile = {
          uid: u.id,
          email: u.email.toLowerCase(),
          name: u.email.split('@')[0] || 'Usuário',
          role: targetRole as any
        };
        
        await supabase.from('user_profiles').upsert([newProfile]);
        setProfile(newProfile);
      }
    };

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const u = session.user;
          setUser({ uid: u.id, email: u.email || '' });
          await syncProfile(u);
        }
      } catch (e) {
        console.error('Session restoration error:', e);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const u = session.user;
        setUser({ uid: u.id, email: u.email || '' });
        await syncProfile(u);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Usuário não encontrado ou senha incorreta.');
        }
        throw error;
      }

      if (data.user) {
        setUser({ uid: data.user.id, email: data.user.email || '' });
        
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('uid', data.user.id)
          .single();
          
        if (profileData) {
          setProfile({
            uid: profileData.uid,
            email: profileData.email,
            name: profileData.name,
            role: profileData.role
          });
        }
      }
    } catch (e: any) {
      throw e;
    }
  };

  const register = async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
      });

      if (error) throw error;

      if (data.user) {
        const uid = data.user.id;
        const emailLower = email.toLowerCase();
        
        // Verifica se já existe um perfil criado pelo admin para este email
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', emailLower)
          .single();

        const newUserProfile = {
          uid: uid,
          email: emailLower,
          name: existingProfile?.name || email.split('@')[0],
          role: existingProfile?.role || ((emailLower === 'ricardomelo@browne.com.br' || emailLower === 'ricardomelo@charquesuprema.com.br') ? 'ADMIN' : 'FINANCEIRO')
        };

        // Usa upsert para vincular o UID do Auth ao perfil (seja novo ou pré-criado)
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert([newUserProfile], { onConflict: 'email' });

        if (profileError) {
          console.error('Error syncing profile:', profileError);
        }
        
        setUser({ uid, email: data.user.email || '' });
        setProfile(newUserProfile as any);
      }
    } catch (e: any) {
      throw e;
    }
  };

  const updatePassword = async (newPass: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPass
      });
      if (error) throw error;
    } catch (e: any) {
      throw e;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, updatePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
