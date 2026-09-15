-- Final Fix for Reset Election
-- This ensures votes, tracking, and logs are completely wiped.
-- It preserves candidates, eligible_students (the roster), and email rules.

CREATE OR REPLACE FUNCTION public.reset_election_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Security Check
    IF NOT public.is_admin(auth.jwt() ->> 'email') THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    -- 2. Wipe all votes
    DELETE FROM public.votes WHERE true;

    -- 3. Wipe all voter tracking participation records
    DELETE FROM public.voter_tracking WHERE true;

    -- 4. Reset Eligible Students Status back to pending
    -- We do NOT delete them, because they are part of the election roster setup.
    UPDATE public.eligible_students
    SET status = 'pending', voted_at = NULL
    WHERE true;

    -- 5. Set election back to draft
    UPDATE public.settings
    SET election_status = 'draft',
        results_published = false,
        election_locked = false
    WHERE true;

    -- 6. Log the reset action
    INSERT INTO public.vote_activity_log (actor, event_type)
    VALUES (auth.jwt() ->> 'email', 'RESET_ELECTION');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_election_data() TO authenticated;
