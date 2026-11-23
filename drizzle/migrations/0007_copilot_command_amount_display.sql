DO $$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.copilot_execute_command(uuid,boolean)'::regprocedure);
 definition:=replace(definition,
 'CASE WHEN amt IS NULL THEN size WHEN amt>=1000000000 THEN ccy||'' ''||(amt/1000000000)::text||''bn'' WHEN amt>=1000000 THEN ccy||'' ''||(amt/1000000)::text||''m'' ELSE ccy||'' ''||amt::text END',
 'public.copilot_amount_cache(amt::text,ccy,size)');
 EXECUTE definition;
END $$;