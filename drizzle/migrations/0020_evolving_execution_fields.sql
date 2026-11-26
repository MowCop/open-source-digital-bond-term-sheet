CREATE OR REPLACE FUNCTION public.record_dts_field_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 entry:=jsonb_build_object('status',CASE WHEN nv IS NULL OR nv='""'::jsonb OR nv='[]'::jsonb THEN 'open' WHEN k IN ('x:iptSpread','x:guidance','x:bookSize','x:booksOpen','x:booksExJLM','x:priceTalk','x:yieldTalk','x:sizeMsg','x:sizeIndication','x:sizeSkew') THEN 'open' ELSE 'set' END,'source',CASE WHEN cmd IS NOT NULL THEN source WHEN entry->>'source' LIKE 'Document:%' THEN entry->>'source' ELSE coalesce(nullif(entry->>'source',''),source) END,'by',actor,'at',clock_timestamp(),'latest',k IN ('x:iptSpread','x:guidance','x:bookSize','x:booksOpen','x:booksExJLM','x:priceTalk','x:yieldTalk','x:sizeMsg','x:sizeIndication','x:sizeSkew') AND nv IS NOT NULL,'history',history);
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
 entry:=jsonb_build_object('status',CASE WHEN nv IS NULL OR nv='null'::jsonb OR nv='""'::jsonb THEN 'open' WHEN k IN ('x:iptSpread','x:guidance','x:bookSize','x:booksOpen','x:booksExJLM','x:priceTalk','x:yieldTalk','x:sizeMsg','x:sizeIndication','x:sizeSkew') THEN 'open' ELSE 'set' END,'source',source,'by',actor,'at',clock_timestamp(),'latest',k IN ('x:iptSpread','x:guidance','x:bookSize','x:booksOpen','x:booksExJLM','x:priceTalk','x:yieldTalk','x:sizeMsg','x:sizeIndication','x:sizeSkew'),'history',coalesce(prior->'history','[]')||CASE WHEN ov IS NOT NULL THEN jsonb_build_array(jsonb_build_object('value',ov,'source',prior->>'source','by',prior->>'by','at',prior->>'at')) ELSE '[]'::jsonb END);
 m:=jsonb_set(m,ARRAY['tranche:'||tid||':'||k],entry);
 INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,'DTS_FIELD_STATUS_CHANGED','deal',NEW.id,actor,jsonb_build_object('field',k,'tranche',tid,'before',ov,'after',nv,'status',entry->>'status','source',source)::text);
 END LOOP;END LOOP;
 NEW.bdt_state:=jsonb_set(NEW.bdt_state,'{fieldMeta}',m);RETURN NEW;
END $$;