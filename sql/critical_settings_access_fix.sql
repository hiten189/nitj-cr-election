-- Critical fix: authenticated students must be able to read the single
-- non-sensitive election configuration row before voting.
--
-- The prior security migration granted SELECT only to admins. Under RLS,
-- student requests returned an empty result set, which surfaced as a null
-- settings object in the frontend.

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read election settings" ON public.settings;
CREATE POLICY "Authenticated users can read election settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);

-- Verify this returns exactly one row after applying the migration.
SELECT id, election_name, election_status
FROM public.settings
LIMIT 2;

-- Public pre-flight check. It exposes only configuration booleans, never
-- settings values or the authorized-email list, so visitors can receive a
-- friendly setup screen before signing in.
CREATE OR REPLACE FUNCTION public.get_public_election_availability()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'settings_configured', EXISTS (SELECT 1 FROM public.settings),
        'authorization_configured', EXISTS (
            SELECT 1
            FROM public.allowed_email_rules
            WHERE active = true
        ),
        'student_logins_open', EXISTS (
            SELECT 1
            FROM public.settings
            WHERE election_status::text IN ('live', 'final_round')
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_election_availability() TO anon, authenticated;
