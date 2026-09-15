-- Sprint 7: Privacy Hardening & Voter Tracking Modes

-- 1. Create voter_tracking table
CREATE TABLE IF NOT EXISTS public.voter_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    round_number integer NOT NULL DEFAULT 1,
    voted_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT voter_tracking_email_round_key UNIQUE (email, round_number)
);

-- Enable RLS on voter_tracking
ALTER TABLE public.voter_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Admins can view voter tracking" ON public.voter_tracking;
DROP POLICY IF EXISTS "Students can view own tracking" ON public.voter_tracking;

-- Admins can view tracking
CREATE POLICY "Admins can view voter tracking" ON public.voter_tracking
    FOR SELECT USING (public.is_admin(auth.jwt() ->> 'email'));

-- Students can view their own tracking
CREATE POLICY "Students can view own tracking" ON public.voter_tracking
    FOR SELECT USING (email = auth.jwt() ->> 'email');

-- We DO NOT allow direct inserts from clients to guarantee transaction safety.
-- All inserts must happen through the SECURITY DEFINER RPC.

-- 2. Update settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS tracking_mode text DEFAULT 'rules_only',
ADD COLUMN IF NOT EXISTS expected_voters integer DEFAULT null,
ADD COLUMN IF NOT EXISTS max_candidates integer DEFAULT null;

-- 3. Safely rename student_email in votes table and drop NOT NULL constraint for anonymity
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'student_email'
    ) THEN
        ALTER TABLE public.votes RENAME COLUMN student_email TO legacy_student_email;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'legacy_student_email'
    ) THEN
        ALTER TABLE public.votes ALTER COLUMN legacy_student_email DROP NOT NULL;
    END IF;
END $$;

-- 3b. Drop outdated check constraints on votes table to allow male_only, female_only, or single position elections
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS chk_female_vote;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS chk_male_vote;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS chk_male_vote_selection;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS chk_female_vote_selection;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS chk_vote_selection;

-- 4. Create Atomic submit_vote RPC
CREATE OR REPLACE FUNCTION public.submit_vote(vote_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    voter_email text;
    current_round integer;
    v_male_id uuid;
    v_female_id uuid;
    v_male_write_in text;
    v_female_write_in text;
    v_ranking jsonb;
    v_voting_method text;
    v_election_positions text;
BEGIN
    -- 1. Extract and validate user identity strictly from JWT
    voter_email := auth.jwt() ->> 'email';
    
    IF voter_email IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    -- Extract vote payload fields
    current_round := COALESCE((vote_payload->>'round_number')::integer, 1);
    
    -- 2. Prevent Duplicate Voting
    IF EXISTS (SELECT 1 FROM public.voter_tracking WHERE email = voter_email AND round_number = current_round) THEN
        RAISE EXCEPTION 'ALREADY_VOTED';
    END IF;

    -- 3. Insert into voter_tracking (participation record)
    INSERT INTO public.voter_tracking (email, round_number)
    VALUES (voter_email, current_round);

    -- 4. Extract candidates safely
    -- Note: UUID casting will fail if the JSON value is empty/invalid string. Handle nulls.
    v_male_id := NULLIF(vote_payload->>'male_candidate_id', '')::uuid;
    v_female_id := NULLIF(vote_payload->>'female_candidate_id', '')::uuid;
    v_male_write_in := NULLIF(vote_payload->>'male_write_in_roll', '');
    v_female_write_in := NULLIF(vote_payload->>'female_write_in_roll', '');
    v_ranking := vote_payload->'ranking_data';
    v_voting_method := COALESCE(vote_payload->>'voting_method', 'single_choice');
    v_election_positions := COALESCE(vote_payload->>'election_positions', 'male_female');

    -- 5. Insert anonymous vote (NO identifying information)
    INSERT INTO public.votes (
        round_number, 
        male_candidate_id, 
        female_candidate_id, 
        male_write_in_roll, 
        female_write_in_roll, 
        ranking_data, 
        voting_method, 
        election_positions
    ) VALUES (
        current_round,
        v_male_id,
        v_female_id,
        v_male_write_in,
        v_female_write_in,
        v_ranking,
        v_voting_method,
        v_election_positions
    );
END;
$$;

-- 5. Helper RPCs for public results calculation & RLS Policy for published results
CREATE OR REPLACE FUNCTION public.get_election_results()
RETURNS TABLE (
    position_name text,
    candidate_id uuid,
    candidate_name text,
    vote_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 'Male CR'::text, v.male_candidate_id, c.name, COUNT(v.male_candidate_id)
    FROM public.votes AS v
    JOIN public.candidates AS c ON c.id = v.male_candidate_id
    WHERE v.male_candidate_id IS NOT NULL
    GROUP BY v.male_candidate_id, c.name
    UNION ALL
    SELECT 'Female CR'::text, v.female_candidate_id, c.name, COUNT(v.female_candidate_id)
    FROM public.votes AS v
    JOIN public.candidates AS c ON c.id = v.female_candidate_id
    WHERE v.female_candidate_id IS NOT NULL
    GROUP BY v.female_candidate_id, c.name;
$$;

CREATE OR REPLACE FUNCTION public.get_write_in_results()
RETURNS TABLE (position_name text, roll_number text, vote_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 'Male CR'::text, v.male_write_in_roll, COUNT(v.male_write_in_roll)
    FROM public.votes AS v
    WHERE v.male_write_in_roll IS NOT NULL
    GROUP BY v.male_write_in_roll
    UNION ALL
    SELECT 'Female CR'::text, v.female_write_in_roll, COUNT(v.female_write_in_roll)
    FROM public.votes AS v
    WHERE v.female_write_in_roll IS NOT NULL
    GROUP BY v.female_write_in_roll;
$$;

CREATE OR REPLACE FUNCTION public.get_election_ballot_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT COUNT(*) FROM public.votes; $$;

GRANT EXECUTE ON FUNCTION public.get_election_results() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_write_in_results() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_election_ballot_count() TO anon, authenticated;

-- Allow public and students to read anonymous votes when results are published
DROP POLICY IF EXISTS "Public read votes when results published" ON public.votes;
CREATE POLICY "Public read votes when results published" ON public.votes
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.settings WHERE results_published = true)
);

-- Allow admins to delete votes regardless of election status when resetting
DROP POLICY IF EXISTS "Admin delete votes in draft" ON public.votes;
DROP POLICY IF EXISTS "Admins can delete votes" ON public.votes;
CREATE POLICY "Admins can delete votes" ON public.votes
FOR DELETE USING (public.is_admin(auth.jwt() ->> 'email'));

-- Allow admins to delete voter_tracking when resetting election
DROP POLICY IF EXISTS "Admins can delete voter tracking" ON public.voter_tracking;
CREATE POLICY "Admins can delete voter tracking" ON public.voter_tracking
FOR DELETE USING (public.is_admin(auth.jwt() ->> 'email'));

-- 6. Reset Election Data RPC
CREATE OR REPLACE FUNCTION public.reset_election_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin(auth.jwt() ->> 'email') THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    -- Clear all ballot votes & participation tracking
    DELETE FROM public.votes;
    DELETE FROM public.voter_tracking;

    -- Reset eligible student statuses
    UPDATE public.eligible_students
    SET status = 'pending', voted_at = NULL;

    -- Reset election state to draft & unpublished
    UPDATE public.settings
    SET election_status = 'draft',
        results_published = false,
        election_locked = false;

    -- Log activity
    INSERT INTO public.vote_activity_log (actor, event_type)
    VALUES (auth.jwt() ->> 'email', 'RESET_ELECTION');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_election_data() TO authenticated;
