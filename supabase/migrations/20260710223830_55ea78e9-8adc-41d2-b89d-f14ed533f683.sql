CREATE TABLE public.hidden_pending_animes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anilist_id INTEGER NOT NULL UNIQUE,
  hidden_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hidden_pending_animes TO authenticated;
GRANT ALL ON public.hidden_pending_animes TO service_role;

ALTER TABLE public.hidden_pending_animes ENABLE ROW LEVEL SECURITY;

-- Solo admins/owners pueden ver, insertar y borrar (usa has_role existente)
CREATE POLICY "Admins can view hidden pending"
  ON public.hidden_pending_animes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins can hide anime"
  ON public.hidden_pending_animes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins can update hidden pending"
  ON public.hidden_pending_animes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Admins can remove hidden pending"
  ON public.hidden_pending_animes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_hidden_pending_expires ON public.hidden_pending_animes(expires_at);