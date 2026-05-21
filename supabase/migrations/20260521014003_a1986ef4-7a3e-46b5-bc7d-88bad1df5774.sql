
-- 1. Extend notifications for personal/targeted notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS image_url text NULL,
  ADD COLUMN IF NOT EXISTS link text NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_target ON public.notifications(target_user_id) WHERE target_user_id IS NOT NULL;

DROP POLICY IF EXISTS "Anyone can read active notifications" ON public.notifications;
CREATE POLICY "Read notifications scoped"
  ON public.notifications
  FOR SELECT
  USING (
    active = true
    AND (target_user_id IS NULL OR target_user_id = auth.uid())
  );

-- 2. Track reporters per broken-link report
CREATE TABLE IF NOT EXISTS public.broken_link_reporters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.broken_link_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_blr_report ON public.broken_link_reporters(report_id);
CREATE INDEX IF NOT EXISTS idx_blr_user ON public.broken_link_reporters(user_id);

ALTER TABLE public.broken_link_reporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own report tracking"
  ON public.broken_link_reporters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own report tracking"
  ON public.broken_link_reporters
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins manage report tracking"
  ON public.broken_link_reporters
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));
