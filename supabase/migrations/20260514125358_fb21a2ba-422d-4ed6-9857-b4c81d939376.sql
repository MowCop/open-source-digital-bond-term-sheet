CREATE OR REPLACE FUNCTION public.get_user_login_stats()
RETURNS TABLE (
  email text,
  last_sign_in_at timestamptz,
  confirmed_at timestamptz,
  user_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.email::text,
    u.last_sign_in_at,
    u.confirmed_at,
    u.created_at AS user_created_at
  FROM auth.users u
  WHERE public.is_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_user_login_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_login_stats() TO authenticated;