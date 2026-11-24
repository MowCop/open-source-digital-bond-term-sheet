-- Single checklist/field-map definition. UI and server read this same immutable function.
CREATE FUNCTION public.signoff_item_fields() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT '[
{"key":"structure","role":"dcm","label":"Structure & tranches","fields":["IssuanceDataGroup/Issuance/IssuanceType","IssuanceDataGroup/Product/InterestPayment/","IssuanceDataGroup/Product/StatusOfNote/","IssuanceDataGroup/SeriesTrancheClass/"],"workspace":[],"tranche":["id","rateType","seniority"],"parties":[]},
{"key":"size","role":"dcm","label":"Size","fields":["IssuanceDataGroup/Issuance/SpecifiedCurrency","IssuanceDataGroup/Issuance/TotalAggregateAmount/","IssuanceDataGroup/Product/AggregateNominalAmount/"],"workspace":["aggregateUsd","plannedTotals"],"tranche":["amount","currency"],"parties":[]},
{"key":"tenor","role":"dcm","label":"Tenor","fields":["IssuanceDataGroup/Product/Maturity/","x:tenor"],"workspace":[],"tranche":["tenor"],"parties":[]},
{"key":"bookrunners","role":"dcm","label":"Bookrunners","fields":[],"workspace":[],"tranche":[],"parties":["BOOKRUNNER","JOINT_BOOKRUNNER","GLOBAL_COORDINATOR","LEAD_MANAGER","JOINT_LEAD_MANAGER","CO_MANAGER","ARRANGER","UNDERWRITER","PLACEMENT_AGENT"]},
{"key":"issuer","role":"issuer_legal","label":"Issuer details & LEI","fields":["PartyDataGroup/"],"workspace":[],"tranche":[],"parties":["ISSUER","GUARANTOR"]},
{"key":"law","role":"issuer_legal","label":"Governing law","fields":["IssuanceDataGroup/Issuance/GoverningLaw/"],"workspace":[],"tranche":[],"parties":[]},
{"key":"restrictions","role":"issuer_legal","label":"Selling restrictions & legends","fields":["IssuanceDataGroup/Issuance/SellingRestrictions/","x:legends"],"workspace":[],"tranche":[],"parties":[]},
{"key":"target","role":"issuer_legal","label":"MiFID target market","fields":["IssuanceDataGroup/Issuance/TargetMarket/"],"workspace":[],"tranche":[],"parties":[]},
{"key":"documents","role":"counsel","label":"Documents reviewed","fields":[],"workspace":[],"tranche":[],"parties":[]},
{"key":"listing","role":"counsel","label":"Listing","fields":["IssuanceDataGroup/Issuance/Listing/"],"workspace":[],"tranche":[],"parties":["LISTING_AGENT"]},
{"key":"stabilisation","role":"counsel","label":"Stabilisation","fields":["x:stabilisation","x:preStabNotice"],"workspace":[],"tranche":[],"parties":["STABILISATION_MANAGER"]},
{"key":"notices","role":"counsel","label":"Legal notices","fields":["x:legalNotices","x:legalNotice"],"workspace":[],"tranche":[],"parties":[]}
]'::jsonb $$;
REVOKE ALL ON FUNCTION public.signoff_item_fields() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.signoff_item_fields() TO authenticated,service_role;

-- Flatten mapped values only, preserving tranche identity and ignoring array ordering/cosmetic keys.
CREATE FUNCTION public.signoff_mapped_values(_state jsonb,_ws jsonb,_item jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result jsonb:='{}'; f record; pattern text; k text; t jsonb; p jsonb; subset jsonb; n integer:=0;
BEGIN
 FOR f IN SELECT key,value FROM jsonb_each(coalesce(_state->'f','{}')) LOOP
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(_item->'fields') x WHERE f.key=x OR (right(x,1)='/' AND left(f.key,length(x))=x)) THEN result:=result||jsonb_build_object(f.key,f.value); END IF;
 END LOOP;
 FOR k IN SELECT jsonb_array_elements_text(_item->'workspace') LOOP
  IF _ws ? k THEN result:=result||jsonb_build_object('workspace.'||k,_ws->k); END IF;
 END LOOP;
 FOR t IN SELECT value FROM jsonb_array_elements(coalesce(_ws->'tranches','[]')) LOOP
  FOR k IN SELECT jsonb_array_elements_text(_item->'tranche') LOOP
   IF t ? k THEN result:=result||jsonb_build_object('tranche['||coalesce(t->>'id',n::text)||'].'||k,t->k); END IF;
  END LOOP;
  FOR f IN SELECT key,value FROM jsonb_each(coalesce(t->'values','{}')) LOOP
   IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(_item->'fields') x WHERE f.key=x OR (right(x,1)='/' AND left(f.key,length(x))=x)) THEN result:=result||jsonb_build_object('tranche['||coalesce(t->>'id',n::text)||'].values.'||f.key,f.value); END IF;
  END LOOP;
  n:=n+1;
 END LOOP;
 -- Only relevant role-bearing party data: a coupon change cannot reopen issuer/legal reviews.
 SELECT coalesce(jsonb_agg(value ORDER BY value::text),'[]') INTO subset FROM jsonb_array_elements(coalesce(_state->'parties','[]')) WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(_item->'parties') r WHERE value->'Roles' ? r);
 IF jsonb_array_length(_item->'parties')>0 THEN result:=result||jsonb_build_object('parties',subset); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.signoff_mapped_values(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.signoff_mapped_values(jsonb,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.reopen_deal_signoffs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; before_values jsonb; after_values jsonb; changed jsonb;
BEGIN
 IF OLD.bdt_state IS NOT DISTINCT FROM NEW.bdt_state AND OLD.deal_workspace IS NOT DISTINCT FROM NEW.deal_workspace THEN RETURN NEW; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(public.signoff_item_fields()) LOOP
  before_values:=public.signoff_mapped_values(OLD.bdt_state,OLD.deal_workspace,item);
  after_values:=public.signoff_mapped_values(NEW.bdt_state,NEW.deal_workspace,item);
  SELECT coalesce(jsonb_agg(k ORDER BY k),'[]') INTO changed FROM (SELECT jsonb_object_keys(before_values||after_values) k) keys WHERE before_values->k IS DISTINCT FROM after_values->k;
  IF jsonb_array_length(changed)>0 THEN
   UPDATE public.deal_signoffs SET status='open' WHERE deal_id=NEW.id AND item_key=item->>'key' AND status<>'open';
   IF FOUND THEN INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,'DEAL_SIGNOFF_REOPENED','deal',NEW.id,coalesce(auth.uid()::text,'system'),jsonb_build_object('item',item->>'key','changedFields',changed,'source','deal_update','at',clock_timestamp())::text); END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.reopen_document_signoffs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target text; affected text[];
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN affected:=ARRAY[NEW.deal_id]; ELSIF TG_OP='DELETE' THEN affected:=ARRAY[OLD.deal_id]; ELSE SELECT array_agg(DISTINCT x) INTO affected FROM unnest(ARRAY[OLD.deal_id,NEW.deal_id]) x; END IF;
 FOREACH target IN ARRAY affected LOOP
  UPDATE public.deal_signoffs SET status='open' WHERE deal_id=target AND item_key='documents' AND role::text='counsel' AND status<>'open';
  IF FOUND THEN INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,'DEAL_SIGNOFF_REOPENED','deal',target,coalesce(auth.uid()::text,'system'),jsonb_build_object('item','documents','changedFields',jsonb_build_array('documents'),'source','document_'||lower(TG_OP),'documentId',coalesce(NEW.id,OLD.id),'at',clock_timestamp())::text); END IF;
 END LOOP;
 RETURN coalesce(NEW,OLD);
END $$;

-- Service-only transition. Findings are server-validated in deal-execution-gate, never client-supplied.
CREATE FUNCTION public.move_deal_to_execution(_deal text,_actor uuid,_expected jsonb,_workspace jsonb,_note text,_override boolean,_blocking jsonb,_open_items jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.deals; st jsonb; outstanding jsonb; item jsonb;
BEGIN
 IF NOT (public.has_role(_actor,'syndicate_admin') OR public.has_role(_actor,'master_admin')) OR NOT public.is_approved(_actor) OR trim(coalesce(_note,''))='' OR length(_note)>2000 THEN RAISE EXCEPTION 'Approved syndicate administrator and audit note required'; END IF;
 IF jsonb_typeof(_blocking) IS DISTINCT FROM 'array' OR jsonb_typeof(_open_items) IS DISTINCT FROM 'array' OR _override IS NULL THEN RAISE EXCEPTION 'Readiness snapshot required'; END IF;
 SELECT * INTO d FROM public.deals WHERE id=_deal FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
 IF public.deal_phase(_deal)<>'setup' THEN RAISE EXCEPTION 'Deal is no longer in set-up'; END IF;
 IF d.bdt_state IS DISTINCT FROM _expected OR d.deal_workspace IS DISTINCT FROM _workspace THEN RAISE EXCEPTION 'Saved terms changed; review readiness again'; END IF;
 PERFORM 1 FROM public.deal_signoffs WHERE deal_id=_deal FOR UPDATE;
 SELECT coalesce(jsonb_agg(i),'[]') INTO outstanding FROM jsonb_array_elements(public.signoff_item_fields()) i
 WHERE EXISTS(SELECT 1 FROM public.deal_team_members t WHERE t.deal_id=_deal AND t.role::text=i->>'role')
 AND NOT EXISTS(SELECT 1 FROM public.deal_signoffs s JOIN public.deal_team_members t ON t.deal_id=s.deal_id AND t.user_id=s.user_id AND t.role=s.role JOIN public.user_roles r ON r.user_id=s.user_id AND r.role=s.role WHERE s.deal_id=_deal AND s.item_key=i->>'key' AND s.role::text=i->>'role' AND s.status='signed_off');
 IF NOT _override AND (jsonb_array_length(outstanding)>0 OR jsonb_array_length(_open_items)>0) THEN RAISE EXCEPTION 'Required actor sign-offs are incomplete'; END IF;
 IF NOT _override AND jsonb_array_length(_blocking)>0 THEN RAISE EXCEPTION 'Resolve blocking Deal Checker findings before execution'; END IF;
 st:=jsonb_set(coalesce(d.bdt_state,'{}'),'{stage}','2');
 UPDATE public.deals SET bdt_state=st,stage='Announced',stage_history=coalesce(d.stage_history,'[]')||jsonb_build_array(jsonb_build_object('from',d.stage,'to','Announced','timestamp',now(),'userId',_actor,'note',trim(_note)||CASE WHEN _override THEN ' — Override to execution (IPTs)' ELSE ' — Move to execution (IPTs)' END)),updated_at=now() WHERE id=_deal;
 INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,CASE WHEN _override THEN 'DEAL_PHASE_OVERRIDE' ELSE 'DEAL_PHASE_CHANGED' END,'deal',_deal,_actor::text,jsonb_build_object('from','setup','to','execution','stage','IPTs','note',trim(_note),'openItems',outstanding||_open_items,'blockingChecks',_blocking,'at',clock_timestamp())::text);
END $$;
REVOKE ALL ON FUNCTION public.move_deal_to_execution(text,uuid,jsonb,jsonb,text,boolean,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.move_deal_to_execution(text,uuid,jsonb,jsonb,text,boolean,jsonb,jsonb) TO service_role;
-- Backward-compatible normal path uses the new team-scoped SQL sign-off validation.
CREATE OR REPLACE FUNCTION public.move_deal_to_execution(_deal text,_actor uuid,_expected jsonb,_workspace jsonb,_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.move_deal_to_execution(_deal,_actor,_expected,_workspace,_note,false,'[]','[]'); END $$;
REVOKE ALL ON FUNCTION public.move_deal_to_execution(text,uuid,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.move_deal_to_execution(text,uuid,jsonb,jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_execution_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NOT NULL AND public.deal_phase(OLD.id)='setup' AND (NEW.stage NOT IN ('Mandate','Announced') OR coalesce((NEW.bdt_state->>'stage')::int,1)>=2 OR coalesce(NEW.bdt_state->'f'->>'x:iptSpread','')<>'') THEN RAISE EXCEPTION 'Use Move to execution, or Move to execution anyway with an administrator audit note'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.deal_actor_context(_deal text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('phase',public.deal_phase(_deal),'roles',(SELECT coalesce(jsonb_agg(role::text),'[]') FROM public.user_roles WHERE user_id=auth.uid()),'openItems',(SELECT count(*) FROM jsonb_array_elements(public.signoff_item_fields()) i WHERE EXISTS(SELECT 1 FROM public.deal_team_members t WHERE t.deal_id=_deal AND t.role::text=i->>'role') AND NOT EXISTS(SELECT 1 FROM public.deal_signoffs s JOIN public.deal_team_members t ON t.deal_id=s.deal_id AND t.user_id=s.user_id AND t.role=s.role WHERE s.deal_id=_deal AND s.item_key=i->>'key' AND s.role::text=i->>'role' AND s.status='signed_off'))) WHERE public.copilot_member(_deal) $$;
CREATE FUNCTION public.deal_phase_audit(_deal text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('action',a.action,'details',a.details::jsonb,'userName',coalesce(p.name,'System'),'at',a.details::jsonb->>'at') ORDER BY a.details::jsonb->>'at' DESC),'[]') FROM public.audit_log a LEFT JOIN public.profiles p ON p.user_id::text=a.user_id WHERE a.entity_type='deal' AND a.entity_id=_deal AND a.action IN ('DEAL_PHASE_OVERRIDE','DEAL_SIGNOFF_REOPENED') AND public.copilot_member(_deal) $$;
REVOKE ALL ON FUNCTION public.deal_phase_audit(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.deal_phase_audit(text) TO authenticated,service_role;