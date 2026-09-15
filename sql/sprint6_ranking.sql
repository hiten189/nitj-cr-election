-- Ranking and Audit Log Schema

-- 1. Create vote_activity_log table
CREATE TABLE IF NOT EXISTS public.vote_activity_log (
    id uuid primary key default gen_random_uuid(),
    event_type text not null, -- 'VOTE_CAST', 'ELECTION_STARTED', 'ELECTION_COMPLETED', 'RESULT_DECLARED', 'EMAIL_BROADCAST', 'ADMIN_TRANSFER', 'RESET_ELECTION', 'GO_LIVE', 'CLOSE_ELECTION', 'START_FINAL_ROUND'
    actor text not null,      -- email of admin or 'system' or 'anonymous'
    created_at timestamptz not null default now()
);

-- Note: We NEVER store candidate choices or student emails for 'VOTE_CAST' events in this table.

-- Enable RLS on vote_activity_log
ALTER TABLE public.vote_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can read the audit log
DROP POLICY IF EXISTS "Admins read vote_activity_log" ON public.vote_activity_log;
CREATE POLICY "Admins read vote_activity_log"
ON public.vote_activity_log FOR SELECT
USING (public.is_admin(auth.jwt() ->> 'email'));

-- Anyone can insert into it (like students inserting 'VOTE_CAST' anonymously)
DROP POLICY IF EXISTS "Insert vote_activity_log" ON public.vote_activity_log;
CREATE POLICY "Insert vote_activity_log"
ON public.vote_activity_log FOR INSERT
WITH CHECK (true);


-- 2. Add round_number to votes for Final VS Round support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'round_number'
    ) THEN
        ALTER TABLE public.votes ADD COLUMN round_number integer default 1;
    END IF;
END
$$;
