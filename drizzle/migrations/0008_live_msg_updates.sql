DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deal_bulletin_notes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_bulletin_notes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alert_send_chunks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_send_chunks;
  END IF;
END $$;