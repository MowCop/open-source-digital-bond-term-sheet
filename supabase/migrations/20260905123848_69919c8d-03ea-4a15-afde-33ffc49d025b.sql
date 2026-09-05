UPDATE public.chat_channels
SET participant_ids = '["u1","u2"]'::jsonb
WHERE id = 'ch1780401170926';

INSERT INTO public.chat_messages (
  id, channel_id, deal_id, sender_id, sender_name, sender_type, body, timestamp, attachments
) VALUES
('cm_middleearth_jm1', 'ch1780401170926', 'd1780401170926', 'u2', 'James Miller', 'bank', 'Any update on the Middle Earth terms from the borrower side?', '2026-09-04 21:37:30.000+00', '[]'::jsonb),
('cm_middleearth_jm2', 'ch1780401170926', 'd1780401170926', 'u2', 'James Miller', 'bank', 'Agreed — let''s wait for borrower confirmation before we run AI DataParse.', '2026-09-05 12:35:15.000+00', '[]'::jsonb),
('cm_middleearth_jm3', 'ch1780401170926', 'd1780401170926', 'u2', 'James Miller', 'bank', 'Standing by. Ping me once the borrower signs off.', '2026-09-05 12:35:30.000+00', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;