-- Permitir a admins gestionar tablas operativas (NO sensibles)
CREATE POLICY "Admins can manage video cache" ON public.video_cache
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage latino episodes" ON public.latino_episodes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage slug cache" ON public.slug_cache
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage slug overrides" ON public.slug_overrides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports" ON public.broken_link_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reports" ON public.broken_link_reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage episode overrides" ON public.episode_count_overrides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage hidden animes" ON public.hidden_home_animes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage contacts" ON public.contact_links
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage download tracker" ON public.anime_download_tracker
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage episode downloads" ON public.anime_episode_downloads
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));