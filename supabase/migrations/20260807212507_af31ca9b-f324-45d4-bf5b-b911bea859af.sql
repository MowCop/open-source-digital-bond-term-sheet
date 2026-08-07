
-- Map the current auth user to their legacy application user ids (matched by email)
CREATE OR REPLACE FUNCTION public.current_app_user_ids()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT array_agg(u.id)
       FROM public.users u
       JOIN public.profiles p ON lower(p.email) = lower(u.email)
      WHERE p.user_id = auth.uid()),
    ARRAY[]::text[]
  ) || ARRAY[auth.uid()::text];
$$;

CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Deals the current user can reach through chat channels or messages
CREATE OR REPLACE FUNCTION public.can_access_deal(_deal_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.deal_id = _deal_id
        AND c.participant_ids ?| public.current_app_user_ids()
    )
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.deal_ids ? _deal_id
        AND (m.sender_id = ANY (public.current_app_user_ids())
             OR m.recipients ?| public.current_app_user_ids())
    );
$$;

REVOKE ALL ON FUNCTION public.current_app_user_ids() FROM public;
REVOKE ALL ON FUNCTION public.current_user_org() FROM public;
REVOKE ALL ON FUNCTION public.can_access_deal(text) FROM public;
GRANT EXECUTE ON FUNCTION public.current_app_user_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_deal(text) TO authenticated, service_role;

-- chat_channels: participants or admins only
DROP POLICY IF EXISTS "approved read cc" ON public.chat_channels;
CREATE POLICY "participants read cc"
ON public.chat_channels FOR SELECT TO authenticated
USING (
  public.is_approved(auth.uid())
  AND (
    public.is_admin(auth.uid())
    OR participant_ids ?| public.current_app_user_ids()
  )
);

-- distribution_lists: creator, members, vendors, same org, or admins
DROP POLICY IF EXISTS "approved read dl" ON public.distribution_lists;
CREATE POLICY "scoped read dl"
ON public.distribution_lists FOR SELECT TO authenticated
USING (
  public.is_approved(auth.uid())
  AND (
    public.is_admin(auth.uid())
    OR created_by = ANY (public.current_app_user_ids())
    OR member_ids ?| public.current_app_user_ids()
    OR vendor_ids ?| public.current_app_user_ids()
    OR (created_by_org IS NOT NULL AND created_by_org = public.current_user_org())
  )
);

-- messages: sender, recipients, or admins
DROP POLICY IF EXISTS "approved read messages" ON public.messages;
CREATE POLICY "participants read messages"
ON public.messages FOR SELECT TO authenticated
USING (
  public.is_approved(auth.uid())
  AND (
    public.is_admin(auth.uid())
    OR sender_id = ANY (public.current_app_user_ids())
    OR recipients ?| public.current_app_user_ids()
  )
);

-- pdf-versions storage: admins, or users with access to the deal in the first path segment
DROP POLICY IF EXISTS "auth read pdf versions" ON storage.objects;
CREATE POLICY "deal scoped read pdf versions"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pdf-versions'
  AND public.is_approved(auth.uid())
  AND (
    public.is_admin(auth.uid())
    OR public.can_access_deal((storage.foldername(name))[1])
  )
);
