-- Critical results fix: apply this migration in the Supabase SQL editor.
-- Public result screens read only aggregates; raw ballots remain admin-only.

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
