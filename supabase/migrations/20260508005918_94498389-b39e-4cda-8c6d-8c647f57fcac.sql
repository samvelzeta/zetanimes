
-- Audit log table
CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_name text,
  area text NOT NULL, -- 'tracker' | 'videos' | 'slugs' | 'episodes' | 'hidden' | 'reports' | 'apk' | 'notifications' | 'payments' | 'roles' | 'other'
  action text NOT NULL, -- 'create' | 'update' | 'delete' | 'status_change' | 'upload' | 'mark_episode' | etc.
  target_type text, -- 'anime' | 'episode' | 'video' | 'slug' | etc.
  target_id text,
  anilist_id integer,
  anime_title text,
  episode_number integer,
  summary text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_log_created ON public.admin_activity_log(created_at DESC);
CREATE INDEX idx_admin_log_actor ON public.admin_activity_log(actor_id);
CREATE INDEX idx_admin_log_area ON public.admin_activity_log(area);
CREATE INDEX idx_admin_log_anilist ON public.admin_activity_log(anilist_id);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Owners and admins can read the log
CREATE POLICY "Admins read activity log"
ON public.admin_activity_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

-- Any admin/owner can insert their own actions
CREATE POLICY "Admins insert own activity"
ON public.admin_activity_log FOR INSERT
WITH CHECK (
  auth.uid() = actor_id
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
);

-- Only owner can delete log entries
CREATE POLICY "Owner deletes activity log"
ON public.admin_activity_log FOR DELETE
USING (public.has_role(auth.uid(), 'owner'::app_role));

-- Add added_by / updated_by to tracker
ALTER TABLE public.anime_download_tracker
  ADD COLUMN IF NOT EXISTS added_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;
