-- Sistema de Metas e Conquistas (Achievements)
-- Cria tabelas para badges, endereços e recompensas

-- Tabela de configuração de recompensas por badge
CREATE TABLE badge_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_type TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  min_sales DECIMAL(10,2) NOT NULL,
  physical_reward_name TEXT,
  physical_reward_cost DECIMAL(10,2) DEFAULT 0,
  functional_reward TEXT,
  requires_address BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração dos badges
INSERT INTO badge_rewards (badge_type, label, description, icon_name, min_sales, physical_reward_name, physical_reward_cost, functional_reward, requires_address) VALUES
('iniciante', 'Vendedor Iniciante', 'Pela primeira venda realizada na plataforma', 'Target', 0, NULL, 0, 'Relatório básico de vendas', FALSE),
('vendedor', 'Vendedor', 'Atingiu R$ 10.000 em vendas', 'Star', 10000, 'Pulseira Flowyn', 50, 'Analytics avançado + comparativo mensal', TRUE),
('top_vendedor', 'Top Vendedor', 'Atingiu R$ 50.000 em vendas', 'Award', 50000, 'Camiseta Flowyn', 80, 'Templates de copy + automações', TRUE),
('expert', 'Expert em Vendas', 'Atingiu R$ 100.000 em vendas', 'Medal', 100000, 'Kit Completo Flowyn', 200, 'Consultoria 1:1 (30 min)', TRUE),
('lenda', 'Lenda do Digital', 'Atingiu R$ 500.000 em vendas', 'Crown', 500000, 'AirPods Pro', 1800, 'Beta + suporte VIP + comissão reduzida', TRUE),
('milionario', 'Milionário Flowyn', 'Atingiu R$ 1.000.000 em vendas', 'Gem', 1000000, 'iPad', 4000, 'Parceiro oficial + case de sucesso', TRUE);

-- Tabela de conquistas do usuário
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_type TEXT NOT NULL REFERENCES badge_rewards(badge_type),
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  total_sales_at_achievement DECIMAL(10,2) DEFAULT 0,
  pdf_sent BOOLEAN DEFAULT FALSE,
  reward_claimed BOOLEAN DEFAULT FALSE,
  reward_address JSONB,
  reward_delivered BOOLEAN DEFAULT FALSE,
  tracking_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);

-- Índices para performance
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_badge ON user_achievements(badge_type);
CREATE INDEX idx_user_achievements_achieved ON user_achievements(achieved_at DESC);

-- Tabela de endereços dos usuários
CREATE TABLE user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_default BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar endereço padrão
CREATE INDEX idx_user_addresses_user_default ON user_addresses(user_id, is_default) WHERE is_default = TRUE;

-- RLS (Row Level Security)
ALTER TABLE badge_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso

-- badge_rewards: todos autenticados podem ler (é config pública)
CREATE POLICY "badge_rewards_select_auth" ON badge_rewards
  FOR SELECT USING (auth.role() = 'authenticated');

-- user_achievements: usuário só vê as suas
CREATE POLICY "user_achievements_select_own" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_achievements_insert_own" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_achievements_update_own" ON user_achievements
  FOR UPDATE USING (auth.uid() = user_id);

-- user_addresses: usuário só vê/edita os seus
CREATE POLICY "user_addresses_select_own" ON user_addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_addresses_insert_own" ON user_addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_addresses_update_own" ON user_addresses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_addresses_delete_own" ON user_addresses
  FOR DELETE USING (auth.uid() = user_id);

-- Function para calcular badge atual do usuário
CREATE OR REPLACE FUNCTION get_user_current_badge(p_user_id UUID)
RETURNS TABLE (
  badge_type TEXT,
  label TEXT,
  description TEXT,
  icon_name TEXT,
  min_sales DECIMAL,
  achieved_at TIMESTAMPTZ,
  total_sales DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    br.badge_type,
    br.label,
    br.description,
    br.icon_name,
    br.min_sales,
    ua.achieved_at,
    ua.total_sales_at_achievement
  FROM user_achievements ua
  JOIN badge_rewards br ON br.badge_type = ua.badge_type
  WHERE ua.user_id = p_user_id
  ORDER BY br.min_sales DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function para verificar e desbloquear badges
CREATE OR REPLACE FUNCTION check_and_unlock_badges(p_user_id UUID, p_total_sales DECIMAL)
RETURNS TABLE (
  badge_type TEXT,
  badge_label TEXT,
  is_new BOOLEAN
) AS $$
DECLARE
  v_badge RECORD;
  v_exists BOOLEAN;
BEGIN
  -- Verificar cada badge do maior para o menor
  FOR v_badge IN
    SELECT br.badge_type, br.label, br.min_sales
    FROM badge_rewards br
    WHERE br.min_sales > 0
    ORDER BY br.min_sales DESC
  LOOP
    -- Se atingiu o mínimo
    IF p_total_sales >= v_badge.min_sales THEN
      -- Verificar se já existe
      SELECT EXISTS(
        SELECT 1 FROM user_achievements
        WHERE user_id = p_user_id AND badge_type = v_badge.badge_type
      ) INTO v_exists;

      -- Se não existe, desbloquear
      IF NOT v_exists THEN
        INSERT INTO user_achievements (user_id, badge_type, total_sales_at_achievement)
        VALUES (p_user_id, v_badge.badge_type, p_total_sales);

        badge_type := v_badge.badge_type;
        badge_label := v_badge.label;
        is_new := TRUE;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  -- Sempre verificar iniciante (primeira venda)
  IF p_total_sales > 0 THEN
    SELECT EXISTS(
      SELECT 1 FROM user_achievements
      WHERE user_id = p_user_id AND badge_type = 'iniciante'
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO user_achievements (user_id, badge_type, total_sales_at_achievement)
      VALUES (p_user_id, 'iniciante', p_total_sales);

      badge_type := 'iniciante';
      badge_label := 'Vendedor Iniciante';
      is_new := TRUE;
      RETURN NEXT;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
