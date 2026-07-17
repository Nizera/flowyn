-- Fix L1: Bound the generate_referral_code loop to 100 iterations
CREATE OR REPLACE FUNCTION public.generate_referral_code(profile_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code TEXT;
  exists_count INT;
  i INT := 0;
BEGIN
  LOOP
    i := i + 1;
    IF i > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after 100 attempts';
    END IF;
    code := 'IND-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    SELECT COUNT(*) INTO exists_count FROM public.profiles WHERE referral_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END;
$$;
