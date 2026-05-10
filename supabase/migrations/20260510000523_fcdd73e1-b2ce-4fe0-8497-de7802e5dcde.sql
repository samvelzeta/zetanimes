DELETE FROM public.video_cache
WHERE NOT (
  episode = 0
  AND jsonb_array_length(COALESCE(sources->'seeke', '[]'::jsonb)) > 0
);