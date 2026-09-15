-- Run this once in the Supabase SQL Editor.
-- Reset now removes every election run's data while retaining election setup
-- and candidates for the next run.
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

    DELETE FROM public.votes;
    DELETE FROM public.voter_tracking;
    DELETE FROM public.eligible_students;
    DELETE FROM public.allowed_email_rules;
    DELETE FROM public.vote_activity_log;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'email_notifications'
    ) THEN
        DELETE FROM public.email_notifications;
    END IF;

    UPDATE public.settings
    SET election_status = 'draft',
        results_published = false,
        election_locked = false,
        tracking_mode = 'rules_only',
        expected_voters = NULL;

    INSERT INTO public.vote_activity_log (actor, event_type)
    VALUES (auth.jwt() ->> 'email', 'RESET_ELECTION');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_election_data() TO authenticated;
