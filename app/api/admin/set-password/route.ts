import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inicializa o cliente admin com a SERVICE_ROLE_KEY (apenas no servidor)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: Request) {
  try {
    const { targetEmail, newPassword, adminUid } = await req.json();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuração SUPABASE_SERVICE_ROLE_KEY ausente.' }, { status: 500 });
    }

    // 1. Verificar se o solicitante (adminUid) é realmente um ADMIN no banco
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('uid', adminUid)
      .single();

    if (adminError || adminProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem alterar senhas.' }, { status: 403 });
    }

    // 2. Buscar o perfil do usuário alvo para obter o UID já reservado
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('uid')
      .eq('email', targetEmail)
      .single();

    if (profileError || !targetProfile) {
      return NextResponse.json({ error: 'Perfil do usuário não encontrado no banco de dados.' }, { status: 404 });
    }

    // 3. Buscar o usuário no Auth pelo Email
    const { data: users, error: searchError } = await supabaseAdmin.auth.admin.listUsers();
    if (searchError) throw searchError;

    const authUser = users.users.find(u => u.email === targetEmail);

    if (authUser) {
      // 4a. Se existe no Auth, apenas atualiza a senha
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { password: newPassword }
      );
      if (updateError) throw updateError;
    } else {
      // 4b. Se NÃO existe no Auth, cria o usuário com o UID sincronizado
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        id: targetProfile.uid, // Mantém o ID sincronizado com o user_profiles
        email: targetEmail,
        password: newPassword,
        email_confirm: true // Já confirma o e-mail para o usuário
      });
      if (createError) throw createError;
    }

    return NextResponse.json({ success: true, message: 'Senha definida com sucesso.' });
  } catch (error: any) {
    console.error('Erro na API admin:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
