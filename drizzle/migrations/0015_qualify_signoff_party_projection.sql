CREATE OR REPLACE FUNCTION public.signoff_mapped_values(_state jsonb,_ws jsonb,_item jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE result jsonb:='{}'; f record; k text; t jsonb; subset jsonb; n integer:=0;
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
 SELECT coalesce(jsonb_agg(p.value ORDER BY p.value::text),'[]') INTO subset FROM jsonb_array_elements(coalesce(_state->'parties','[]')) p(value) WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(_item->'parties') r(role) WHERE p.value->'Roles' ? r.role);
 IF jsonb_array_length(_item->'parties')>0 THEN result:=result||jsonb_build_object('parties',subset); END IF;
 RETURN result;
END $$;