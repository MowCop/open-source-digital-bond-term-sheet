DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO public.profiles (user_id, email, name, organization, status)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'name', u.email), COALESCE(u.raw_user_meta_data->>'organization', ''), 'pending'
FROM auth.users u ON CONFLICT (user_id) DO NOTHING;