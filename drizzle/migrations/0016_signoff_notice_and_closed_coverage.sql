CREATE OR REPLACE FUNCTION public.signoff_item_fields() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT '[
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
{"key":"notices","role":"counsel","label":"Legal notices","fields":["x:legalNotices","x:legalNotice"],"workspace":[],"tranche":[],"parties":[],"bulletin":["legal"]}
]'::jsonb $$;
CREATE OR REPLACE FUNCTION public.reopen_deal_signoffs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; before_values jsonb; after_values jsonb; changed jsonb;
BEGIN
 IF OLD.stage='Settled' OR NEW.stage='Settled' THEN RETURN NEW; END IF;
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
  IF public.deal_phase(target)='closed' THEN CONTINUE; END IF;
  UPDATE public.deal_signoffs SET status='open' WHERE deal_id=target AND item_key='documents' AND role::text='counsel' AND status<>'open';
  IF FOUND THEN INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,'DEAL_SIGNOFF_REOPENED','deal',target,coalesce(auth.uid()::text,'system'),jsonb_build_object('item','documents','changedFields',jsonb_build_array('documents'),'source','document_'||lower(TG_OP),'documentId',coalesce(NEW.id,OLD.id),'at',clock_timestamp())::text); END IF;
 END LOOP;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE FUNCTION public.signoff_bulletin_values(_raw text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('legal',CASE WHEN strpos(coalesce(_raw,''),E'\n<<LEGAL>>\n')>0 THEN substring(_raw FROM strpos(_raw,E'\n<<LEGAL>>\n')+length(E'\n<<LEGAL>>\n')) ELSE '' END)
$$;
REVOKE ALL ON FUNCTION public.signoff_bulletin_values(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.signoff_bulletin_values(text) TO service_role;
CREATE FUNCTION public.reopen_bulletin_signoffs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target text; before_values jsonb; after_values jsonb; item jsonb; changed jsonb;
BEGIN
 target:=coalesce(NEW.deal_id,OLD.deal_id);
 IF public.deal_phase(target)='closed' THEN RETURN coalesce(NEW,OLD); END IF;
 before_values:=public.signoff_bulletin_values(CASE WHEN TG_OP='INSERT' THEN '' ELSE OLD.notes END);
 after_values:=public.signoff_bulletin_values(CASE WHEN TG_OP='DELETE' THEN '' ELSE NEW.notes END);
 FOR item IN SELECT value FROM jsonb_array_elements(public.signoff_item_fields()) WHERE value ? 'bulletin' LOOP
  SELECT coalesce(jsonb_agg('bulletin.'||key ORDER BY key),'[]') INTO changed FROM jsonb_array_elements_text(item->'bulletin') dependency(key) WHERE before_values->key IS DISTINCT FROM after_values->key;
  IF jsonb_array_length(changed)>0 THEN
   UPDATE public.deal_signoffs SET status='open' WHERE deal_id=target AND item_key=item->>'key' AND status<>'open';
   IF FOUND THEN INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,'DEAL_SIGNOFF_REOPENED','deal',target,coalesce(auth.uid()::text,'system'),jsonb_build_object('item',item->>'key','changedFields',changed,'source','bulletin_'||lower(TG_OP),'at',clock_timestamp())::text); END IF;
  END IF;
 END LOOP;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER reopen_bulletin_signoffs AFTER INSERT OR UPDATE OR DELETE ON public.deal_bulletin_notes FOR EACH ROW EXECUTE FUNCTION public.reopen_bulletin_signoffs();