
CREATE OR REPLACE FUNCTION public.bootstrap_master_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'karl.mallalieu@gmail.com' THEN
    NEW.status := 'approved';
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'master_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_master_admin_trigger ON public.profiles;
CREATE TRIGGER bootstrap_master_admin_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.bootstrap_master_admin();
