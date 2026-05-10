ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS created_by_org text;
ALTER TABLE public.distribution_lists ADD COLUMN IF NOT EXISTS created_by_org text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by_org text;

UPDATE public.deals
SET created_by_org = (bookrunners->0->>'name')
WHERE created_by_org IS NULL
  AND bookrunners IS NOT NULL
  AND jsonb_typeof(bookrunners) = 'array'
  AND jsonb_array_length(bookrunners) > 0;

UPDATE public.distribution_lists dl
SET created_by_org = u.organization
FROM public.users u
WHERE dl.created_by = u.id
  AND dl.created_by_org IS NULL;

UPDATE public.users u
SET created_by_org = c.organization
FROM public.users c
WHERE u.created_by = c.id
  AND u.created_by_org IS NULL;