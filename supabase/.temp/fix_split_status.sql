ALTER TABLE public.referral_commissions DROP CONSTRAINT IF EXISTS referral_commissions_status_check;
ALTER TABLE public.referral_commissions ADD CONSTRAINT referral_commissions_status_check CHECK (status IN ('pending', 'withdrawing', 'paid', 'split', 'cancelled'));
