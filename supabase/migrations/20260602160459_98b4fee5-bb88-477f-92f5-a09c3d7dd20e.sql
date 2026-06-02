UPDATE public.chat_channels
SET deal_id = 'd1780414513134',
    label = 'The Kingdom of Nania USD 1.5bn 10Y Priced at UST+195',
    participant_ids = '["u1","u2","u3"]'::jsonb
WHERE id = 'ch_nania_alert';

DELETE FROM public.chat_channels WHERE id = 'ch1780414513135';