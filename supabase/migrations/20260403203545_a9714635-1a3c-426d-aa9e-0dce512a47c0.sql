
-- Add progress tracking columns to watch_history
ALTER TABLE public.watch_history 
ADD COLUMN IF NOT EXISTS current_time_seconds float DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_duration_seconds float DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_percent float DEFAULT 0;

-- Update RLS: allow users to read their own watch history
CREATE POLICY "Users can read own watch history" 
ON public.watch_history 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to update their own watch history
CREATE POLICY "Users can update own watch history" 
ON public.watch_history 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow users to delete their own watch history
CREATE POLICY "Users can delete own watch history" 
ON public.watch_history 
FOR DELETE 
USING (auth.uid() = user_id);
