DROP FUNCTION IF EXISTS public.signoff_bulletin_values(text);
CREATE FUNCTION public.record_dts_group_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g text; rowdata jsonb; oldrow jsonb; idx integer; k text; path text; m jsonb; prior jsonb; entry jsonb; ov jsonb; nv jsonb; source text; actor text:=coalesce(auth.uid()::text,'system'); cmd text;
BEGIN
 IF NEW.bdt_state IS NULL THEN RETURN NEW;END IF;
 m:=coalesce(NEW.bdt_state->'fieldMeta','{}');cmd:=nullif(current_setting('app.dts_command',true),'');
 FOREACH g IN ARRAY ARRAY['parties','ids','ratings','docs','contacts'] LOOP
 idx:=0;
 FOR rowdata IN SELECT value FROM jsonb_array_elements(coalesce(NEW.bdt_state->g,'[]')) LOOP
 oldrow:=OLD.bdt_state->g->idx;
 FOR k IN SELECT jsonb_object_keys(rowdata) LOOP
 path:=g||'.'||idx::text||'.'||k;ov:=oldrow->k;nv:=rowdata->k;prior:=OLD.bdt_state->'fieldMeta'->path;
 IF ov IS NOT DISTINCT FROM nv THEN CONTINUE;END IF;
 source:=CASE WHEN cmd IS NOT NULL THEN 'Co-Pilot command: '||cmd ELSE coalesce(NEW.bdt_state->'fieldMeta'->('group:'||g)->>'source','Manual') END;
 entry:=jsonb_build_object('status',CASE WHEN nv IS NULL OR nv='""'::jsonb OR nv='[]'::jsonb THEN 'open' ELSE 'set' END,'source',source,'by',actor,'at',clock_timestamp(),'history',coalesce(prior->'history','[]')||CASE WHEN ov IS NOT NULL THEN jsonb_build_array(jsonb_build_object('value',ov,'source',prior->>'source','by',prior->>'by','at',prior->>'at')) ELSE '[]'::jsonb END);
 m:=jsonb_set(m,ARRAY[path],entry);
 INSERT INTO public.audit_log(id,action,entity_type,entity_id,user_id,details) VALUES(gen_random_uuid()::text,'DTS_FIELD_STATUS_CHANGED','deal',NEW.id,actor,jsonb_build_object('field',path,'before',ov,'after',nv,'status',entry->>'status','source',source)::text);
 END LOOP;idx:=idx+1;END LOOP;END LOOP;
 NEW.bdt_state:=jsonb_set(NEW.bdt_state,'{fieldMeta}',m);RETURN NEW;
END $$;
CREATE TRIGGER zzz_record_dts_group_fields BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.record_dts_group_fields();