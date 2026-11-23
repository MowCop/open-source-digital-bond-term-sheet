CREATE TABLE public.copilot_commands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 thread_id uuid NOT NULL REFERENCES public.copilot_threads(id) ON DELETE CASCADE,
 request_text text NOT NULL,
 plan jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','executed','rejected')),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_by uuid,
 decided_at timestamptz
);
GRANT SELECT ON public.copilot_commands TO authenticated;
GRANT ALL ON public.copilot_commands TO service_role;
ALTER TABLE public.copilot_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_command_members_read ON public.copilot_commands FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.copilot_threads t WHERE t.id=thread_id AND public.copilot_member(t.deal_id)));
CREATE INDEX copilot_commands_thread_created ON public.copilot_commands(thread_id,created_at DESC);
CREATE FUNCTION public.copilot_execute_command(_command uuid, _execute boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.copilot_commands; d public.deals; deal text; before jsonb; after jsonb; note jsonb; st jsonb; f jsonb; ws jsonb; current_note jsonb; result text; ccy text; amt numeric; n integer;
BEGIN
 SELECT * INTO c FROM public.copilot_commands WHERE id=_command FOR UPDATE;
 SELECT deal_id INTO deal FROM public.copilot_threads WHERE id=c.thread_id;
 IF deal IS NULL OR NOT public.copilot_editor(deal) THEN RAISE EXCEPTION 'Term-edit rights required'; END IF;
 IF c.status <> 'pending' THEN RAISE EXCEPTION 'Command already decided'; END IF;
 IF _execute IS NULL THEN RAISE EXCEPTION 'Explicit human decision required'; END IF;
 IF _execute THEN
  SELECT * INTO d FROM public.deals WHERE id=deal FOR UPDATE;
  before:=c.plan->'before'; after:=c.plan->'after';
  SELECT jsonb_build_object('intro',intro,'notes',notes) INTO current_note FROM public.deal_bulletin_notes WHERE deal_id=deal FOR UPDATE;
  IF d.bdt_state IS DISTINCT FROM before->'bdt_state' OR coalesce(d.deal_workspace,'null'::jsonb) IS DISTINCT FROM before->'deal_workspace' OR coalesce(current_note,'null'::jsonb) IS DISTINCT FROM before->'notes' THEN RAISE EXCEPTION 'Deal or bulletin changed; request a fresh command preview'; END IF;
  st:=after->'bdt_state'; ws:=after->'deal_workspace'; f:=st->'f';
  IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Invalid command snapshot'; END IF;
  ccy:=coalesce(f->>'IssuanceDataGroup/Issuance/SpecifiedCurrency','');
  amt:=nullif(coalesce(f->>'IssuanceDataGroup/Issuance/TotalAggregateAmount/Value',f->>'IssuanceDataGroup/Product/AggregateNominalAmount/Value'),'')::numeric;
  UPDATE public.deals SET bdt_state=st,deal_workspace=nullif(ws,'null'::jsonb),updated_at=now(),
   issuer_name=coalesce((SELECT p->>'PartyName' FROM jsonb_array_elements(coalesce(st->'parties','[]')) p WHERE p->'Roles' ? 'ISSUER' LIMIT 1),issuer_name),
   currency=ccy,
   size=CASE WHEN amt IS NULL THEN size WHEN amt>=1000000000 THEN ccy||' '||(amt/1000000000)::text||'bn' WHEN amt>=1000000 THEN ccy||' '||(amt/1000000)::text||'m' ELSE ccy||' '||amt::text END,
   coupon=CASE WHEN coalesce(f->>'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate','')='' THEN '' ELSE (f->>'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate')||'%' END,
   maturity_date=coalesce(f->>'IssuanceDataGroup/Product/Maturity/MaturityDate',''),
   tenor=coalesce(ws->'tranches'->0->>'tenor',tenor),
   interest_type=coalesce(f->>'IssuanceDataGroup/Product/InterestPayment/InterestType',interest_type),
   settlement_date=coalesce(f->>'IssuanceDataGroup/Issuance/SettlementDate',''),
   pricing_date=coalesce(f->>'IssuanceDataGroup/Issuance/PricingDate',''),
   issue_price=coalesce(f->>'IssuanceDataGroup/Issuance/IssuePrice/Value',''),
   reoffer_price=coalesce(f->>'IssuanceDataGroup/Issuance/ReofferPrice/Value',''),
   reoffer_yield=coalesce(f->>'IssuanceDataGroup/Issuance/ReofferYield/Value',''),
   ipt=coalesce(f->>'x:iptSpread',''),guidance=coalesce(f->>'x:guidance',''),
   governing_law=CASE f->>'IssuanceDataGroup/Issuance/GoverningLaw/CountryCode' WHEN 'GB' THEN 'ENGLISH_LAW' WHEN 'US' THEN 'NEW_YORK_LAW' WHEN 'FR' THEN 'FRENCH_LAW' WHEN 'DE' THEN 'GERMAN_LAW' WHEN 'CH' THEN 'SWISS_LAW' ELSE '' END
  WHERE id=deal;
  note:=after->'notes';
  IF note IS DISTINCT FROM before->'notes' AND note <> 'null'::jsonb THEN
   IF current_note IS NULL THEN
    INSERT INTO public.deal_bulletin_notes(deal_id,intro,notes,updated_by,updated_at) VALUES(deal,note->>'intro',note->>'notes',auth.uid(),now()) ON CONFLICT(deal_id) DO NOTHING;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n=0 THEN RAISE EXCEPTION 'Bulletin changed; request a fresh command preview'; END IF;
   ELSE
    UPDATE public.deal_bulletin_notes SET intro=note->>'intro',notes=note->>'notes',updated_by=auth.uid(),updated_at=now() WHERE deal_id=deal;
   END IF;
  END IF;
 END IF;
 result:=CASE WHEN _execute THEN 'executed' ELSE 'rejected' END;
 UPDATE public.copilot_commands SET status=result,decided_by=auth.uid(),decided_at=now() WHERE id=_command;
 INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,timestamp,details) VALUES(gen_random_uuid()::text,'copilot_command_'||result,'deal',deal,auth.uid()::text,now(),jsonb_build_object('commandId',_command,'request',c.request_text,'effects',c.plan->'effects','warnings',c.plan->'warnings')::text);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.copilot_execute_command(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.copilot_execute_command(uuid,boolean) TO authenticated;