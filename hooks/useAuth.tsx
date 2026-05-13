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
  const profileRef = React.useRef<UserProfile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const isAdminEmail = (email: string) => {
      const e = email.toLowerCase();
      return e === 'ricardomelo@browne.com.br' || e === 'ricardomelo@charquesuprema.com.br';
    };

    const syncProfile = async (u: { id: string; email?: string }) => {
      try {
        if (!u.email) return;

        // Se já temos o perfil carregado e o UID bate, não precisamos buscar de novo
        if (profileRef.current?.uid === u.id) return;
        
        const { data: profileData, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('uid', u.id)
          .single();
          
        const shouldBeAdmin = isAdminEmail(u.email);
        const targetRole = shouldBeAdmin ? 'ADMIN' : 'FINANCEIRO';

        if (profileData) {
          if (shouldBeAdmin && profileData.role !== 'ADMIN') {
            await supabase
              .from('user_profiles')
              .update({ role: 'ADMIN' })
              .eq('uid', u.id);
            
            setProfile(prev => prev?.role === 'ADMIN' ? prev : { ...profileData, role: 'ADMIN' });
          } else {
            setProfile(prev => {
              if (prev?.uid === profileData.uid && prev?.role === profileData.role) return prev;
              return {
                uid: profileData.uid,
                email: profileData.email,
                name: profileData.name,
                role: profileData.role
              };
            });
          }
        } else {
          // Se não encontrou o perfil, cria um novo
          const newProfile: UserProfile = {
            uid: u.id,
            email: u.email.toLowerCase(),
            name: u.email.split('@')[0] || 'Usuário',
            role: targetRole as any
          };
          
          const { error: upsertError } = await supabase.from('user_profiles').upsert([newProfile]);
          if (upsertError) throw upsertError;
          setProfile(newProfile);
        }
      } catch (err) {
        console.error('Erro ao sincronizar perfil:', err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session) {
          const u = session.user;
          setUser(prev => prev?.uid === u.id ? prev : { uid: u.id, email: u.email || '' });
          await syncProfile(u);
        } else if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('Erro no onAuthStateChange:', err);
      } finally {
        setLoading(false);
      }
    });

    // Safety timeout: se em 10 segundos não carregou, tentamos liberar a tela
    const timeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('Carregamento de autenticação demorou demais. Liberando tela por segurança.');
        }
        return false;
      });
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const login = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Usuário não encontrado ou senha incorreta.');
        }
        throw error;
      }
    } catch (e: any) {
      throw e;
    }
  };

  const register = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
      });

      if (error) throw error;
      // O perfil será sincronizado pelo onAuthStateChange após o signup/login automático
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
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, updatePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
