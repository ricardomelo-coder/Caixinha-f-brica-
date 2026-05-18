"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: "ADMIN" | "FINANCEIRO";
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

const isAdminEmail = (email: string) => {
  const normalizedEmail = email.toLowerCase();

  return (
    normalizedEmail === "ricardomelo@browne.com.br" ||
    normalizedEmail === "ricardomelo@charquesuprema.com.br"
  );
};

const buildFallbackProfile = (uid: string, email: string): UserProfile => {
  const normalizedEmail = email.toLowerCase();

  return {
    uid,
    email: normalizedEmail,
    name: normalizedEmail.split("@")[0] || "Usuário",
    role: isAdminEmail(normalizedEmail) ? "ADMIN" : "FINANCEIRO",
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<{ uid: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = async (uid: string, email: string) => {
    const fallbackProfile = buildFallbackProfile(uid, email);

    const { data, error } = await supabase
      .from("user_profiles")
      .select("uid, email, name, role")
      .eq("uid", uid)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar perfil:", error);
      setProfile(fallbackProfile);
      return;
    }

    if (!data) {
      const { error: insertError } = await supabase
        .from("user_profiles")
        .upsert([fallbackProfile], { onConflict: "uid" });

      if (insertError) {
        console.error("Erro ao criar perfil:", insertError);
      }

      setProfile(fallbackProfile);
      return;
    }

    const shouldBeAdmin = isAdminEmail(email);
    const correctedProfile: UserProfile = {
      uid: data.uid,
      email: data.email || fallbackProfile.email,
      name: data.name || fallbackProfile.name,
      role: shouldBeAdmin ? "ADMIN" : data.role,
    };

    if (shouldBeAdmin && data.role !== "ADMIN") {
      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ role: "ADMIN" })
        .eq("uid", uid);

      if (updateError) {
        console.error("Erro ao atualizar perfil para ADMIN:", updateError);
      }
    }

    setProfile(correctedProfile);
  };

  const clearAuthState = () => {
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialSession = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Erro ao carregar sessão:", error);
          await supabase.auth.signOut();
          if (isMounted) clearAuthState();
          return;
        }

        const session = data.session;

        if (!session?.user) {
          if (isMounted) clearAuthState();
          return;
        }

        const currentUser = session.user;
        const email = currentUser.email || "";

        if (!email) {
          await supabase.auth.signOut();
          if (isMounted) clearAuthState();
          return;
        }

        if (isMounted) {
          setUser({
            uid: currentUser.id,
            email,
          });
        }

        await syncProfile(currentUser.id, email);
      } catch (err) {
        console.error("Erro inesperado ao iniciar autenticação:", err);
        await supabase.auth.signOut();
        if (isMounted) clearAuthState();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      try {
        if (event === "SIGNED_OUT" || !session?.user) {
          clearAuthState();
          return;
        }

        const currentUser = session.user;
        const email = currentUser.email || "";

        if (!email) {
          await supabase.auth.signOut();
          clearAuthState();
          return;
        }

        setUser({
          uid: currentUser.id,
          email,
        });

        await syncProfile(currentUser.id, email);
      } catch (err) {
        console.error("Erro ao processar alteração de autenticação:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        throw new Error("Usuário não encontrado ou senha incorreta.");
      }

      throw error;
    }
  };

  const register = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
    });

    if (error) throw error;
  };

  const updatePassword = async (newPass: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPass,
    });

    if (error) throw error;
  };

  const logout = async () => {
    clearAuthState();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        register,
        updatePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
