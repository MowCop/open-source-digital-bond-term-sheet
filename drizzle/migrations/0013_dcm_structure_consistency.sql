CREATE OR REPLACE FUNCTION public.guard_deal_actor_edits() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE k text; allowed text[]:=ARRAY['IssuanceDataGroup/Issuance/SpecifiedCurrency','IssuanceDataGroup/Product/AggregateNominalAmount/Currency','IssuanceDataGroup/Issuance/TotalAggregateAmount/Value','IssuanceDataGroup/Product/AggregateNominalAmount/Value','IssuanceDataGroup/Product/Maturity/MaturityDate','IssuanceDataGroup/Product/InterestPayment/InterestType']; a jsonb; b jsonb; BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF OLD.stage='Settled' THEN RAISE EXCEPTION 'Closed deals are read-only'; END IF;
 IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
 IF NOT public.deal_team_access(OLD.id) THEN RAISE EXCEPTION 'Deal membership required'; END IF;
 IF NEW.stage IS DISTINCT FROM OLD.stage OR NEW.stage_history IS DISTINCT FROM OLD.stage_history THEN RAISE EXCEPTION 'Syndicate admin changes stages'; END IF;
 IF public.has_role(auth.uid(),'dcm') THEN
 FOR k IN SELECT jsonb_object_keys(coalesce(OLD.bdt_state->'f','{}')||coalesce(NEW.bdt_state->'f','{}')) LOOP IF NOT k=ANY(allowed) AND OLD.bdt_state->'f'->k IS DISTINCT FROM NEW.bdt_state->'f'->k THEN RAISE EXCEPTION 'DCM can edit structure fields only: %',k; END IF; END LOOP;
 IF (coalesce(OLD.bdt_state,'{}')-'f'-'parties') IS DISTINCT FROM (coalesce(NEW.bdt_state,'{}')-'f'-'parties') THEN RAISE EXCEPTION 'DCM can edit structure fields only'; END IF;
 SELECT coalesce(jsonb_agg(p),'[]') INTO a FROM jsonb_array_elements(coalesce(OLD.bdt_state->'parties','[]')) p WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(p->'Roles','[]')) r WHERE r ~ 'MANAGER|BOOKRUNNER|COORDINATOR|ARRANGER');
 SELECT coalesce(jsonb_agg(p),'[]') INTO b FROM jsonb_array_elements(coalesce(NEW.bdt_state->'parties','[]')) p WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(p->'Roles','[]')) r WHERE r ~ 'MANAGER|BOOKRUNNER|COORDINATOR|ARRANGER');
 IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'DCM can edit bookrunners, not issuer details'; END IF;
 IF (to_jsonb(NEW)-'bdt_state'-'deal_workspace'-'updated_at'-'currency'-'size'-'tenor'-'maturity_date'-'interest_type'-'bookrunners') IS DISTINCT FROM (to_jsonb(OLD)-'bdt_state'-'deal_workspace'-'updated_at'-'currency'-'size'-'tenor'-'maturity_date'-'interest_type'-'bookrunners') THEN RAISE EXCEPTION 'DCM can edit structure fields only'; END IF;
 ELSIF public.deal_phase(OLD.id)<>'setup' THEN RAISE EXCEPTION 'Legal and counsel DTS access is read-only during execution'; END IF;
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.guard_dcm_tranche_values() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE t jsonb; previous jsonb; k text; allowed text[]:=ARRAY['IssuanceDataGroup/Issuance/SpecifiedCurrency','IssuanceDataGroup/Product/AggregateNominalAmount/Currency','IssuanceDataGroup/Issuance/TotalAggregateAmount/Value','IssuanceDataGroup/Product/AggregateNominalAmount/Value','IssuanceDataGroup/Product/Maturity/MaturityDate','IssuanceDataGroup/Product/InterestPayment/InterestType']; BEGIN IF auth.uid() IS NULL OR public.is_admin(auth.uid()) OR NOT public.has_role(auth.uid(),'dcm') THEN RETURN NEW; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(coalesce(NEW.deal_workspace->'tranches','[]')) LOOP
 SELECT value INTO previous FROM jsonb_array_elements(coalesce(OLD.deal_workspace->'tranches','[]')) WHERE value->>'id'=t->>'id';
 IF previous IS NOT NULL AND (previous-'label'-'currency'-'amount'-'tenor'-'rateType'-'values') IS DISTINCT FROM (t-'label'-'currency'-'amount'-'tenor'-'rateType'-'values') THEN RAISE EXCEPTION 'DCM cannot change tranche legal status'; END IF;
 IF previous IS NULL AND coalesce(t->>'seniority','senior_unsecured')<>'senior_unsecured' THEN RAISE EXCEPTION 'DCM cannot set tranche legal status'; END IF;
 FOR k IN SELECT jsonb_object_keys(coalesce(t->'values','{}')||coalesce(previous->'values','{}')) LOOP IF NOT k=ANY(allowed) AND t->'values'->k IS DISTINCT FROM previous->'values'->k THEN RAISE EXCEPTION 'DCM can edit structure fields only: %',k; END IF; END LOOP;
 END LOOP; RETURN NEW; END $$;