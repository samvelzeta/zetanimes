
-- 1. New permission columns on premium_plans
ALTER TABLE public.premium_plans
  ADD COLUMN IF NOT EXISTS multi_status_selection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_avatar_upload boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_support boolean NOT NULL DEFAULT false;

-- 2. support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_slug text,
  priority text NOT NULL DEFAULT 'standard', -- 'vip' | 'standard'
  subject text,
  message text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'pending', -- pending|in_progress|answered|solved|closed
  admin_response text,
  admin_id uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, priority, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all tickets" ON public.support_tickets
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins update tickets" ON public.support_tickets
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins delete tickets" ON public.support_tickets
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;

-- 4. Storage bucket for support attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own support attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own support attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'support-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins read all support attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'support-attachments'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
  );

CREATE POLICY "Admins delete support attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'support-attachments'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
  );
