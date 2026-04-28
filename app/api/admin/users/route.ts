import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

export async function GET(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('A variável SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.');
    }
    const { searchParams } = new URL(req.url);
    const adminUid = searchParams.get('adminUid');

    if (!adminUid) {
      return NextResponse.json({ error: 'adminUid é obrigatório' }, { status: 400 });
    }

    // Verificar se é admin
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('uid', adminUid)
      .single();

    if (adminError || adminProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('name');

    if (profileError) throw profileError;

    return NextResponse.json(profiles);
  } catch (error: any) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('A variável SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.');
    }
    const { email, name, role, adminUid } = await req.json();

    if (!adminUid) {
      return NextResponse.json({ error: 'adminUid é obrigatório' }, { status: 400 });
    }

    // Verificar admin
    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('uid', adminUid)
      .single();

    if (adminProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // 1. Criar perfil antecipado (sem vincular a auth ainda, ou podemos criar auth também)
    // Para facilitar, vamos criar o usuário no Auth também com uma senha temporária
    const tempPassword = Math.random().toString(36).slice(-10);
    
    console.log('Iniciando criação de usuário no Auth para:', email);
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) {
      console.error('Erro retornado pelo Auth Admin:', authError);
      // Se o erro for que o usuário já existe no Auth, tentamos apenas criar o perfil se não existir
      if (authError.message.includes('User already registered')) {
         console.log('Usuário já existe no Auth. Buscando ID para vincular perfil...');
         const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
         if (listError) throw listError;
         
         const found = existingUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
         if (found) {
            console.log('Usuário encontrado no Auth. ID:', found.id);
            const { error: profileError } = await supabaseAdmin
              .from('user_profiles')
              .upsert({
                uid: found.id,
                email: email.toLowerCase(),
                name,
                role
              });
            if (profileError) throw profileError;
            return NextResponse.json({ success: true, message: 'Perfil vinculado a usuário existente no Auth.' });
         }
      }
      throw authError;
    }

    console.log('Usuário criado com sucesso no Auth ID:', authUser.user?.id);

    if (authUser.user) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          uid: authUser.user.id,
          email: email.toLowerCase(),
          name,
          role
        });

      if (profileError) throw profileError;
    }

    return NextResponse.json({ success: true, tempPassword });
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('A variável SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.');
    }
    const { searchParams } = new URL(req.url);
    const targetUid = searchParams.get('uid');
    const adminUid = searchParams.get('adminUid');

    console.log('Iniciando DELETE:', { targetUid, adminUid });

    if (!targetUid || !adminUid) {
      return NextResponse.json({ error: 'IDs ausentes (uid ou adminUid)' }, { status: 400 });
    }

    // Verificar admin
    const { data: adminProfile, error: adminCheckError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, email')
      .eq('uid', adminUid)
      .single();

    if (adminCheckError) {
      console.error('Erro ao verificar permissão do admin:', adminCheckError);
      return NextResponse.json({ error: 'Erro ao verificar permissão do admin: ' + adminCheckError.message }, { status: 403 });
    }

    if (adminProfile?.role !== 'ADMIN') {
      console.warn('Tentativa de exclusão por não-admin:', adminProfile?.email);
      return NextResponse.json({ error: 'Acesso negado: apenas administradores podem realizar esta ação.' }, { status: 403 });
    }

    if (targetUid === adminUid) {
      return NextResponse.json({ error: 'Você não pode excluir sua própria conta.' }, { status: 400 });
    }

    // 1. Deletar do Auth primeiro (mais crítico)
    console.log('Tentando deletar do Auth:', targetUid);
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetUid);
    
    if (authError) {
      console.warn('Alerta no Auth Admin (pode não existir na Auth):', authError.message);
      // Não interrompemos se não existir no Auth, pois o objetivo pode ser limpar o perfil
    } else {
      console.log('Usuário removido do Auth com sucesso.');
    }

    // 2. Deletar do Profile (Tabela user_profiles)
    console.log('Deletando do user_profiles:', targetUid);
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('uid', targetUid);

    if (profileError) {
      console.error('Erro ao deletar perfil:', profileError);
      if (profileError.code === '23503') {
        return NextResponse.json({ error: 'Não é possível excluir este colaborador pois ele possui registros (transações/movimentações) vinculados.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Erro ao remover perfil do banco: ' + profileError.message }, { status: 500 });
    }

    console.log('Exclusão concluída com sucesso para:', targetUid);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro fatal ao excluir usuário:', error);
    return NextResponse.json({ error: error.message || 'Erro inesperado no servidor' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { uid, name, role, adminUid } = await req.json();

    // Verificar admin
    const { data: adminProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('uid', adminUid)
      .single();

    if (adminProfile?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ name, role })
      .eq('uid', uid);

    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
