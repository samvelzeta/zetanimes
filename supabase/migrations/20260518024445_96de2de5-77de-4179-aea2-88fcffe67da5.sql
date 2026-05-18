ALTER TYPE membership_type ADD VALUE IF NOT EXISTS 'monthly' BEFORE 'annual';
ALTER TABLE public.broken_link_reports ADD COLUMN IF NOT EXISTS reason text;