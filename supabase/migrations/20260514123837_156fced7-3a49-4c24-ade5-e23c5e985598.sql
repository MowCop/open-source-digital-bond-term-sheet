
-- Remove orphan duplicate Eurofima chat data and deal rows
DELETE FROM public.chat_messages WHERE channel_id IN ('ch1778760566435','ch1778760575366');
DELETE FROM public.chat_channels WHERE id IN ('ch1778760566435','ch1778760575366');
DELETE FROM public.notifications WHERE deal_id IN ('d1778760566434','d1778760575366');
DELETE FROM public.messages WHERE deal_ids @> '["d1778760566434"]'::jsonb OR deal_ids @> '["d1778760575366"]'::jsonb;
DELETE FROM public.deals WHERE id IN ('d1778760566434','d1778760575366');
