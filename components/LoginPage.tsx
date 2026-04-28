'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { login, register, updatePassword } = useAuth();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RECOVER' | 'UPDATE_PASS'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    // Detect password recovery mode from Supabase session change or hash
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setMode('UPDATE_PASS');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      
      if (mode === 'LOGIN') {
        await login(trimmedEmail, trimmedPassword);
        toast.success('Bem-vindo de volta!');
      } else if (mode === 'REGISTER') {
        await register(trimmedEmail, trimmedPassword);
        toast.success('Conta criada com sucesso!');
      } else if (mode === 'RECOVER') {
        const { supabase } = await import('@/lib/supabase');
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
        toast.success('E-mail de recuperação enviado!');
        setMode('LOGIN');
      } else if (mode === 'UPDATE_PASS') {
        await updatePassword(newPassword);
        toast.success('Senha atualizada com sucesso!');
        setMode('LOGIN');
        window.location.hash = ''; // Clear hash
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'LOGIN': return 'Login';
      case 'REGISTER': return 'Cadastro';
      case 'RECOVER': return 'Recuperar Senha';
      case 'UPDATE_PASS': return 'Nova Senha';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'LOGIN': return 'Faça login para acessar o sistema';
      case 'REGISTER': return 'Crie sua conta para começar';
      case 'RECOVER': return 'Digite seu e-mail para receber o link';
      case 'UPDATE_PASS': return 'Defina sua nova senha de acesso';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-[#1A1A1A] text-white text-center py-10">
          <div className="flex justify-center mb-4">
            <div className="bg-white/10 p-3 rounded-xl">
              <LayoutGrid className="w-8 h-8" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Caixinha Pro</CardTitle>
          <CardDescription className="text-gray-400">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {mode !== 'UPDATE_PASS' && (
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  required 
                  className="rounded-xl h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            
            {(mode === 'LOGIN' || mode === 'REGISTER') && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Senha</Label>
                  {mode === 'LOGIN' && (
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-xs text-gray-500"
                      onClick={() => setMode('RECOVER')}
                      type="button"
                    >
                      Esqueceu a senha?
                    </Button>
                  )}
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  className="rounded-xl h-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            {mode === 'UPDATE_PASS' && (
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  className="rounded-xl h-12"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-[#1A1A1A] hover:bg-black text-white h-12 rounded-xl font-bold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                mode === 'LOGIN' ? 'Entrar' : 
                mode === 'REGISTER' ? 'Cadastrar' : 
                mode === 'RECOVER' ? 'Enviar Link' : 'Salvar Nova Senha'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="bg-gray-50 p-6 flex flex-col gap-2 justify-center border-t border-gray-100">
          {mode === 'LOGIN' ? (
            <Button 
              variant="link" 
              className="text-gray-600"
              onClick={() => setMode('REGISTER')}
            >
              Não tem uma conta? Cadastre-se
            </Button>
          ) : (
            <Button 
              variant="link" 
              className="text-gray-600"
              onClick={() => setMode('LOGIN')}
            >
              Voltar para o Login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
