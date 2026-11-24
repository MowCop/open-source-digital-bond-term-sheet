CREATE FUNCTION public.record_dts_field_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text; prior jsonb; entry jsonb; ov jsonb; nv jsonb; m jsonb; actor text:=coalesce(auth.uid()::text,'system'); source text; history jsonb; t jsonb; previous jsonb; tid text; cmd text;
BEGIN
 IF NEW.bdt_state IS NULL THEN RETURN NEW; END IF;
 m:=coalesce(NEW.bdt_state->'fieldMeta','{}');cmd:=nullif(current_setting('app.dts_command',true),'');source:=CASE WHEN cmd IS NOT NULL THEN 'Co-Pilot command: '||cmd ELSE 'Manual' END;
 FOR k IN SELECT jsonb_object_keys(coalesce(OLD.bdt_state->'f','{}')||coalesce(NEW.bdt_state->'f','{}')||coalesce(NEW.bdt_state->'fieldMeta','{}')) LOOP
 IF k LIKE 'tranche:%' THEN CONTINUE;END IF;
 IF k LIKE 'group:%' THEN ov:=OLD.bdt_state->substring(k from 7);nv:=NEW.bdt_state->substring(k from 7);ELSE ov:=OLD.bdt_state->'f'->k;nv:=NEW.bdt_state->'f'->k;END IF;
 prior:=OLD.bdt_state->'fieldMeta'->k;entry:=m->k;
 IF ov IS NOT DISTINCT FROM nv AND prior IS NOT DISTINCT FROM entry THEN CONTINUE;END IF;
 IF ov IS NOT DISTINCT FROM nv AND entry->>'status'='expected' THEN CONTINUE;END IF;
 IF entry IS NOT NULL AND entry->>'status' NOT IN ('set','expected','open') THEN RAISE EXCEPTION 'Invalid field status';END IF;
 history:=coalesce(prior->'history','[]');IF ov IS NOT NULL AND ov<>'""'::jsonb THEN history:=history||jsonb_build_array(jsonb_build_object('value',ov,'source',coalesce(prior->>'source','Previously recorded DTS'),'by',prior->>'by','at',prior->>'at'));END IF;
 entry:=jsonb_build_object('status',CASE WHEN nv IS NULL OR nv='""'::jsonb OR nv='[]'::jsonb THEN 'open' WHEN k IN ('x:iptSpread','x:guidance','x:bookSize','x:booksOpen','x:booksExJLM') THEN 'open' ELSE 'set' END,'source',CASE WHEN cmd IS NOT NULL THEN source WHEN entry->>'source' LIKE 'Document:%' THEN entry->>'source' ELSE coalesce(nullif(entry->>'source',''),source) END,'by',actor,'at',clock_timestamp(),'latest',k IN ('x:iptSpread','x:guidance','x:bookSize','x:booksOpen','x:booksExJLM') AND nv IS NOT NULL,'history',history);
 m:=jsonb_set(m,ARRAY[k],entry);
 INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,'DTS_FIELD_STATUS_CHANGED','deal',NEW.id,actor,jsonb_build_object('field',k,'before',ov,'after',nv,'status',entry->>'status','source',entry->>'source','at',entry->>'at')::text);
 END LOOP;
 FOR t IN SELECT value FROM jsonb_array_elements(coalesce(NEW.deal_workspace->'tranches','[]')) LOOP
 tid:=t->>'id';SELECT value INTO previous FROM jsonb_array_elements(coalesce(OLD.deal_workspace->'tranches','[]')) WHERE value->>'id'=tid;
 FOR k IN SELECT jsonb_object_keys(coalesce(previous->'values','{}')||coalesce(t->'values','{}')||jsonb_build_object('tenor',null,'currency',null,'amount',null,'rateType',null)) LOOP
 IF k IN ('tenor','currency','amount','rateType') THEN ov:=previous->k;nv:=t->k;ELSE ov:=previous->'values'->k;nv:=t->'values'->k;END IF;
 prior:=OLD.bdt_state->'fieldMeta'->('tranche:'||tid||':'||k);entry:=m->('tranche:'||tid||':'||k);
 IF ov IS NOT DISTINCT FROM nv AND prior IS NOT DISTINCT FROM entry THEN CONTINUE;END IF;
 IF entry->>'status'='expected' AND ov IS NOT DISTINCT FROM nv THEN CONTINUE;END IF;
 entry:=jsonb_build_object('status',CASE WHEN nv IS NULL OR nv='null'::jsonb OR nv='""'::jsonb THEN 'open' WHEN k IN ('x:iptSpread','x:guidance','x:bookSize','x:booksOpen','x:booksExJLM') THEN 'open' ELSE 'set' END,'source',source,'by',actor,'at',clock_timestamp(),'latest',k IN ('x:iptSpread','x:guidance','x:bookSize','x:booksOpen','x:booksExJLM'),'history',coalesce(prior->'history','[]')||CASE WHEN ov IS NOT NULL THEN jsonb_build_array(jsonb_build_object('value',ov,'source',prior->>'source','by',prior->>'by','at',prior->>'at')) ELSE '[]'::jsonb END);
 m:=jsonb_set(m,ARRAY['tranche:'||tid||':'||k],entry);
 INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,'DTS_FIELD_STATUS_CHANGED','deal',NEW.id,actor,jsonb_build_object('field',k,'tranche',tid,'before',ov,'after',nv,'status',entry->>'status','source',source)::text);
 END LOOP;END LOOP;
 NEW.bdt_state:=jsonb_set(NEW.bdt_state,'{fieldMeta}',m);RETURN NEW;
END $$;
CREATE TRIGGER zz_record_dts_field_status BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.record_dts_field_status();
CREATE OR REPLACE FUNCTION public.guard_deal_actor_edits() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE k text; allowed text[]:=ARRAY['IssuanceDataGroup/Issuance/SpecifiedCurrency','IssuanceDataGroup/Product/AggregateNominalAmount/Currency','IssuanceDataGroup/Issuance/TotalAggregateAmount/Value','IssuanceDataGroup/Product/AggregateNominalAmount/Value','IssuanceDataGroup/Product/Maturity/MaturityDate','IssuanceDataGroup/Product/InterestPayment/InterestType']; a jsonb; b jsonb; BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW;END IF;
 IF OLD.stage='Settled' THEN RAISE EXCEPTION 'Closed deals are read-only';END IF;
 IF public.is_admin(auth.uid()) THEN RETURN NEW;END IF;
 IF NOT public.deal_team_access(OLD.id) THEN RAISE EXCEPTION 'Deal membership required';END IF;
 IF NEW.stage IS DISTINCT FROM OLD.stage OR NEW.stage_history IS DISTINCT FROM OLD.stage_history THEN RAISE EXCEPTION 'Syndicate admin changes stages';END IF;
 IF public.has_role(auth.uid(),'dcm') THEN
 FOR k IN SELECT jsonb_object_keys(coalesce(OLD.bdt_state->'f','{}')||coalesce(NEW.bdt_state->'f','{}')) LOOP IF NOT k=ANY(allowed) AND OLD.bdt_state->'f'->k IS DISTINCT FROM NEW.bdt_state->'f'->k THEN RAISE EXCEPTION 'DCM can edit structure fields only: %',k;END IF;END LOOP;
 IF (coalesce(OLD.bdt_state,'{}')-'f'-'parties'-'fieldMeta') IS DISTINCT FROM (coalesce(NEW.bdt_state,'{}')-'f'-'parties'-'fieldMeta') THEN RAISE EXCEPTION 'DCM can edit structure fields only';END IF;
 SELECT coalesce(jsonb_agg(p),'[]') INTO a FROM jsonb_array_elements(coalesce(OLD.bdt_state->'parties','[]')) p WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(p->'Roles','[]')) r WHERE r ~ 'MANAGER|BOOKRUNNER|COORDINATOR|ARRANGER');
 SELECT coalesce(jsonb_agg(p),'[]') INTO b FROM jsonb_array_elements(coalesce(NEW.bdt_state->'parties','[]')) p WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(p->'Roles','[]')) r WHERE r ~ 'MANAGER|BOOKRUNNER|COORDINATOR|ARRANGER');
 IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'DCM can edit bookrunners, not issuer details';END IF;
 IF (to_jsonb(NEW)-'bdt_state'-'deal_workspace'-'updated_at'-'currency'-'size'-'tenor'-'maturity_date'-'interest_type'-'bookrunners') IS DISTINCT FROM (to_jsonb(OLD)-'bdt_state'-'deal_workspace'-'updated_at'-'currency'-'size'-'tenor'-'maturity_date'-'interest_type'-'bookrunners') THEN RAISE EXCEPTION 'DCM can edit structure fields only';END IF;
 FOR k IN SELECT jsonb_object_keys(coalesce(OLD.bdt_state->'fieldMeta','{}')||coalesce(NEW.bdt_state->'fieldMeta','{}')) LOOP IF OLD.bdt_state->'fieldMeta'->k IS DISTINCT FROM NEW.bdt_state->'fieldMeta'->k AND NOT (regexp_replace(k,'^tranche:[^:]+:','')=ANY(allowed) OR regexp_replace(k,'^tranche:[^:]+:','') IN ('group:parties','tenor','currency','amount','rateType')) THEN RAISE EXCEPTION 'DCM can confirm structure fields only: %',k;END IF;END LOOP;
 ELSIF public.deal_phase(OLD.id)<>'setup' THEN RAISE EXCEPTION 'Legal and counsel DTS access is read-only during execution';END IF;RETURN NEW;END $$;
CREATE OR REPLACE FUNCTION public.copilot_execute_command(_command uuid,_execute boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; d record; deal text; before jsonb; after jsonb; note jsonb; st jsonb; f jsonb; ws jsonb; current_note jsonb; result text; ccy text; amt numeric; n integer;
BEGIN
 SELECT * INTO c FROM public.copilot_commands WHERE id=_command FOR UPDATE;
 SELECT deal_id INTO deal FROM public.copilot_threads WHERE id=c.thread_id;
 IF deal IS NULL OR NOT public.copilot_editor(deal) THEN RAISE EXCEPTION 'Term-edit rights required';END IF;
 IF c.status<>'pending' THEN RAISE EXCEPTION 'Command already decided';END IF;
 IF _execute IS NULL THEN RAISE EXCEPTION 'Explicit human decision required';END IF;
 IF _execute THEN
 SELECT * INTO d FROM public.deals WHERE id=deal FOR UPDATE;
 before:=c.plan->'before';after:=c.plan->'after';
 SELECT jsonb_build_object('intro',intro,'notes',notes) INTO current_note FROM public.deal_bulletin_notes WHERE deal_id=deal FOR UPDATE;
 IF d.bdt_state IS DISTINCT FROM before->'bdt_state' OR coalesce(d.deal_workspace,'null'::jsonb) IS DISTINCT FROM before->'deal_workspace' OR coalesce(current_note,'null'::jsonb) IS DISTINCT FROM before->'notes' THEN RAISE EXCEPTION 'Deal or bulletin changed; request a fresh command preview';END IF;
 st:=after->'bdt_state';ws:=after->'deal_workspace';f:=st->'f';IF jsonb_typeof(f)<>'object' THEN RAISE EXCEPTION 'Invalid command snapshot';END IF;
 ccy:=coalesce(f->>'IssuanceDataGroup/Issuance/SpecifiedCurrency','');amt:=nullif(coalesce(f->>'IssuanceDataGroup/Issuance/TotalAggregateAmount/Value',f->>'IssuanceDataGroup/Product/AggregateNominalAmount/Value'),'')::numeric;
 PERFORM set_config('app.dts_command',c.request_text,true);
 UPDATE public.deals SET bdt_state=st,deal_workspace=nullif(ws,'null'::jsonb),updated_at=now(),issuer_name=coalesce((SELECT p->>'PartyName' FROM jsonb_array_elements(coalesce(st->'parties','[]')) p WHERE p->'Roles' ? 'ISSUER' LIMIT 1),issuer_name),currency=ccy,size=CASE WHEN amt IS NULL THEN size WHEN amt>=1000000000 THEN ccy||' '||(amt/1000000000)::text||'bn' WHEN amt>=1000000 THEN ccy||' '||(amt/1000000)::text||'m' ELSE ccy||' '||amt::text END,coupon=CASE WHEN coalesce(f->>'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate','')='' THEN '' ELSE (f->>'IssuanceDataGroup/Product/InterestPayment/FixedRatePayment/InterestRate')||'%' END,maturity_date=coalesce(f->>'IssuanceDataGroup/Product/Maturity/MaturityDate',''),tenor=coalesce(ws->'tranches'->0->>'tenor',tenor),interest_type=coalesce(f->>'IssuanceDataGroup/Product/InterestPayment/InterestType',interest_type),settlement_date=coalesce(f->>'IssuanceDataGroup/Issuance/SettlementDate',''),pricing_date=coalesce(f->>'IssuanceDataGroup/Issuance/PricingDate',''),issue_price=coalesce(f->>'IssuanceDataGroup/Issuance/IssuePrice/Value',''),reoffer_price=coalesce(f->>'IssuanceDataGroup/Issuance/ReofferPrice/Value',''),reoffer_yield=coalesce(f->>'IssuanceDataGroup/Issuance/ReofferYield/Value',''),ipt=coalesce(f->>'x:iptSpread',''),guidance=coalesce(f->>'x:guidance',''),governing_law=CASE f->>'IssuanceDataGroup/Issuance/GoverningLaw/CountryCode' WHEN 'GB' THEN 'ENGLISH_LAW' WHEN 'US' THEN 'NEW_YORK_LAW' WHEN 'FR' THEN 'FRENCH_LAW' WHEN 'DE' THEN 'GERMAN_LAW' WHEN 'CH' THEN 'SWISS_LAW' ELSE '' END WHERE id=deal;
 PERFORM set_config('app.dts_command','',true);
 note:=after->'notes';IF note IS DISTINCT FROM before->'notes' AND note<>'null'::jsonb THEN
 IF current_note IS NULL THEN INSERT INTO public.deal_bulletin_notes(deal_id,intro,notes,updated_by,updated_at) VALUES(deal,note->>'intro',note->>'notes',auth.uid(),now()) ON CONFLICT(deal_id) DO NOTHING;GET DIAGNOSTICS n=ROW_COUNT;IF n=0 THEN RAISE EXCEPTION 'Bulletin changed; request a fresh command preview';END IF;
 ELSE UPDATE public.deal_bulletin_notes SET intro=note->>'intro',notes=note->>'notes',updated_by=auth.uid(),updated_at=now() WHERE deal_id=deal;END IF;END IF;END IF;
 result:=CASE WHEN _execute THEN 'executed' ELSE 'rejected' END;UPDATE public.copilot_commands SET status=result,decided_by=auth.uid(),decided_at=now() WHERE id=_command;
 INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,timestamp,details) VALUES(gen_random_uuid()::text,'copilot_command_'||result,'deal',deal,auth.uid()::text,now(),jsonb_build_object('commandId',_command,'request',c.request_text,'effects',c.plan->'effects','warnings',c.plan->'warnings')::text);RETURN result;
END $$;