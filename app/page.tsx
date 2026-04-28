'use client';

import Dashboard from '@/components/Dashboard';
import LoginPage from '@/components/LoginPage';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="w-10 h-10 animate-spin text-[#1A1A1A]" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <main>
      <Dashboard />
    </main>
  );
}
