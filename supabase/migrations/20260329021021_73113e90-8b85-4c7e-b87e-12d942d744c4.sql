-- ===========================
-- ZetAnime Full Schema
-- ===========================

-- 1. Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. User roles enum and table
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'premium', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::text, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', 'Usuario')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Anime lists (favorites, watching, completed, plan_to_watch, undecided)
CREATE TYPE public.anime_list_type AS ENUM ('favorite', 'watching', 'completed', 'plan_to_watch', 'undecided');

CREATE TABLE public.anime_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  anime_title TEXT,
  anime_cover TEXT,
  list_type anime_list_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, anime_id, list_type)
);
ALTER TABLE public.anime_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lists" ON public.anime_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own lists" ON public.anime_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own lists" ON public.anime_lists FOR DELETE USING (auth.uid() = user_id);

-- 5. Watch history / stats
CREATE TABLE public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  anime_title TEXT,
  anime_cover TEXT,
  episode_number INTEGER NOT NULL,
  watch_duration_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, anime_id, episode_number)
);
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON public.watch_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON public.watch_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own history" ON public.watch_history FOR UPDATE USING (auth.uid() = user_id);

-- 6. Premium memberships
CREATE TYPE public.membership_type AS ENUM ('annual', 'lifetime');
CREATE TYPE public.membership_status AS ENUM ('pending', 'active', 'expired', 'rejected');

CREATE TABLE public.premium_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_type membership_type NOT NULL,
  status membership_status NOT NULL DEFAULT 'pending',
  activation_key UUID DEFAULT gen_random_uuid(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.premium_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own membership" ON public.premium_memberships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can request membership" ON public.premium_memberships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can manage memberships" ON public.premium_memberships FOR ALL USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_premium_updated_at BEFORE UPDATE ON public.premium_memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Premium requests (with payment proof)
CREATE TABLE public.premium_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  membership_type membership_type NOT NULL,
  proof_url TEXT,
  notes TEXT,
  status membership_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.premium_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON public.premium_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create requests" ON public.premium_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can manage requests" ON public.premium_requests FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- 8. Notifications (global, from admin)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active notifications" ON public.notifications FOR SELECT USING (active = true);
CREATE POLICY "Owners can manage notifications" ON public.notifications FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- 9. Notification dismissals (per user)
CREATE TABLE public.notification_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_id)
);
ALTER TABLE public.notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals" ON public.notification_dismissals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can dismiss notifications" ON public.notification_dismissals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 10. Admin payment info (single row, global config)
CREATE TABLE public.admin_payment_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT,
  account_holder TEXT,
  account_number TEXT,
  price_annual TEXT,
  price_lifetime TEXT,
  instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_payment_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read payment info" ON public.admin_payment_info FOR SELECT USING (true);
CREATE POLICY "Owners can manage payment info" ON public.admin_payment_info FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- Insert default row
INSERT INTO public.admin_payment_info (bank_name, account_holder, account_number, price_annual, price_lifetime, instructions)
VALUES ('', '', '', '$2 USD', '$5 USD', '');

-- 11. Contact links (admin-managed)
CREATE TABLE public.contact_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  color TEXT DEFAULT '#FF4500',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read contacts" ON public.contact_links FOR SELECT USING (true);
CREATE POLICY "Owners can manage contacts" ON public.contact_links FOR ALL USING (public.has_role(auth.uid(), 'owner'));

-- 12. Storage bucket for avatars and payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('premium-proofs', 'premium-proofs', false);

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload payment proofs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'premium-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners can view payment proofs" ON storage.objects FOR SELECT USING (bucket_id = 'premium-proofs' AND public.has_role(auth.uid(), 'owner'));