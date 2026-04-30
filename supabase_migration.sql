-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA')),
  date TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  closed BOOLEAN DEFAULT FALSE,
  payment_method TEXT DEFAULT 'DINHEIRO',
  beneficiary TEXT,
  reimbursement_amount NUMERIC DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create app_configs table for global settings
CREATE TABLE IF NOT EXISTS app_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial balance
INSERT INTO app_configs (key, value) 
VALUES ('initial_balance', '5100')
ON CONFLICT (key) DO NOTHING;

-- Create profiles table (using Supabase Auth UUIDs)
CREATE TABLE IF NOT EXISTS user_profiles (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'FINANCEIRO',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Force conversion if it was previously text (Safety measure)
DO $$ 
BEGIN 
    IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'uid') = 'text' THEN
        ALTER TABLE user_profiles ALTER COLUMN uid TYPE UUID USING uid::uuid;
    END IF;
END $$;

-- Enable Realtime for tables (with safety check)
DO $$ 
BEGIN 
    -- Adiciona transactions se não estiver lá
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'transactions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
    END IF;
    
    -- Adiciona app_configs se não estiver lá
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'app_configs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE app_configs;
    END IF;
    
    -- Adiciona user_profiles se não estiver lá
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_configs ENABLE ROW LEVEL SECURITY;

-- Limpa políticas existentes para evitar erro de duplicidade se rodar novamente
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile or admins can create any" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile or admins can update any" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON transactions;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON app_configs;

-- Policies for user_profiles
CREATE POLICY "Profiles are viewable by authenticated users" ON user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own profile or admins can create any" ON user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = uid OR
    (auth.jwt()->>'email' IN ('ricardomelo@browne.com.br', 'ricardomelo@charquesuprema.com.br'))
  );

CREATE POLICY "Users can update their own profile or admins can update any" ON user_profiles
  FOR UPDATE USING (
    auth.uid() = uid OR
    auth.jwt()->>'email' = email OR
    (auth.jwt()->>'email' IN ('ricardomelo@browne.com.br', 'ricardomelo@charquesuprema.com.br'))
  );

CREATE POLICY "Admins can delete profiles" ON user_profiles
  FOR DELETE USING (
    (auth.jwt()->>'email' IN ('ricardomelo@browne.com.br', 'ricardomelo@charquesuprema.com.br'))
  );

-- Policies for transactions
CREATE POLICY "Enable all access for authenticated users" ON transactions
  FOR ALL USING (auth.role() = 'authenticated');

-- Policies for app_configs
CREATE POLICY "Enable all access for authenticated users" ON app_configs
  FOR ALL USING (auth.role() = 'authenticated');
