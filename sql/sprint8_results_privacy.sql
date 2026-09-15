-- Sprint 8: Results Privacy Hardening

-- Ensure get_election_results enforces results_published = true for non-admins
CREATE OR REPLACE FUNCTION public.get_election_results()
RETURNS TABLE (
    position_name text,
    candidate_id uuid,
    candidate_name text,
    vote_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check authorization: Either results are published OR user is admin
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE results_published = true) AND NOT public.is_admin(auth.jwt() ->> 'email') THEN
        RAISE EXCEPTION 'RESULTS_NOT_PUBLISHED';
    END IF;

    RETURN QUERY
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
END;
$$;

-- Ensure get_write_in_results enforces results_published = true for non-admins
CREATE OR REPLACE FUNCTION public.get_write_in_results()
RETURNS TABLE (position_name text, roll_number text, vote_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check authorization: Either results are published OR user is admin
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE results_published = true) AND NOT public.is_admin(auth.jwt() ->> 'email') THEN
        RAISE EXCEPTION 'RESULTS_NOT_PUBLISHED';
    END IF;

    RETURN QUERY
    SELECT 'Male CR'::text, v.male_write_in_roll, COUNT(v.male_write_in_roll)
    FROM public.votes AS v
    WHERE v.male_write_in_roll IS NOT NULL
    GROUP BY v.male_write_in_roll
    UNION ALL
    SELECT 'Female CR'::text, v.female_write_in_roll, COUNT(v.female_write_in_roll)
    FROM public.votes AS v
    WHERE v.female_write_in_roll IS NOT NULL
    GROUP BY v.female_write_in_roll;
END;
$$;

-- Ensure get_election_ballot_count enforces results_published = true for non-admins
CREATE OR REPLACE FUNCTION public.get_election_ballot_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count bigint;
BEGIN
    -- Check authorization: Either results are published OR user is admin
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE results_published = true) AND NOT public.is_admin(auth.jwt() ->> 'email') THEN
        RAISE EXCEPTION 'RESULTS_NOT_PUBLISHED';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.votes;
    RETURN v_count;
END;
$$;
