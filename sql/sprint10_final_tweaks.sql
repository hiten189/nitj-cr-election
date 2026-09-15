-- Final Tweaks: Activity Log reset and Admin management policies

-- 1. Redefine reset_election_data() to also clear activity logs
CREATE OR REPLACE FUNCTION public.reset_election_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Security Check
    IF NOT public.is_admin(auth.jwt() ->> 'email') THEN
        RAISE EXCEPTION 'UNAUTHORIZED';
    END IF;

    -- Wipe all votes
    DELETE FROM public.votes WHERE true;

    -- Wipe all voter tracking participation records
    DELETE FROM public.voter_tracking WHERE true;
    
    -- Wipe activity logs
    DELETE FROM public.vote_activity_log WHERE true;

    -- Reset Eligible Students Status back to pending
    UPDATE public.eligible_students
    SET status = 'pending', voted_at = NULL
    WHERE true;

    -- Set election back to draft
    UPDATE public.settings
    SET election_status = 'draft',
        results_published = false,
        election_locked = false
    WHERE true;

    -- Log the reset action (this will be the only log remaining)
    INSERT INTO public.vote_activity_log (actor, event_type)
    VALUES (auth.jwt() ->> 'email', 'RESET_ELECTION');
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_election_data() TO authenticated;

-- 2. Allow Admins to manage the admins table
-- We assume RLS is enabled on admins, if not, this won't hurt.
DO $$ 
BEGIN 
    -- Check if RLS is enabled on admins, if so add policies
    IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admins' AND rowsecurity = true
    ) THEN
        DROP POLICY IF EXISTS "Admins can view admins" ON public.admins;
        DROP POLICY IF EXISTS "Admins can insert admins" ON public.admins;
        DROP POLICY IF EXISTS "Admins can delete admins" ON public.admins;

        CREATE POLICY "Admins can view admins" ON public.admins FOR SELECT USING (public.is_admin(auth.jwt() ->> 'email'));
        CREATE POLICY "Admins can insert admins" ON public.admins FOR INSERT WITH CHECK (public.is_admin(auth.jwt() ->> 'email'));
        CREATE POLICY "Admins can delete admins" ON public.admins FOR DELETE USING (public.is_admin(auth.jwt() ->> 'email'));
    END IF;
END $$;
