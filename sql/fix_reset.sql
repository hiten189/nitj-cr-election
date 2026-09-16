-- Final Fix for Reset Election
-- This ensures votes, tracking, and logs are completely wiped.
-- It preserves candidates, eligible_students (the roster), and email rules.

CREATE OR REPLACE FUNCTION public.reset_election_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

    -- 4. Wipe all email notifications so subsequent runs can send clean Go Live and Result/Winner emails
    DELETE FROM public.email_notifications WHERE true;

    -- 5. Wipe all non-admin registered users from Supabase Auth (auth.users)
    -- This cleans up student voters while preserving admin credentials
    DELETE FROM auth.users
    WHERE lower(email) NOT IN (
        SELECT lower(email) FROM public.admins WHERE active = true
    );

    -- 6. Reset Eligible Students Status back to pending
    -- We do NOT delete them, because they are part of the election roster setup.
    UPDATE public.eligible_students
    SET status = 'pending', voted_at = NULL
    WHERE true;

    -- 7. Set election back to draft
    UPDATE public.settings
    SET election_status = 'draft',
        results_published = false,
        election_locked = false
    WHERE true;

    -- 8. Log the reset action
    INSERT INTO public.vote_activity_log (actor, event_type)
    VALUES (auth.jwt() ->> 'email', 'RESET_ELECTION');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_election_data() TO authenticated;
