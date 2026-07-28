-- Adiciona flag de onboarding completo na tabela profiles
-- Usuários novos têm FALSE; ao completar o wizard, wordt TRUE

ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;

-- Marca todos os usuários existentes como completos (já usam a plataforma)
UPDATE profiles SET onboarding_completed = TRUE WHERE onboarding_completed IS FALSE;
