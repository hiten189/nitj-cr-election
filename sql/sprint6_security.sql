-- Security Hardening and RLS Policies

-- 0. Helper Function to check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(user_email text)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.admins WHERE email = user_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Helper Function to check if election is draft
CREATE OR REPLACE FUNCTION public.is_election_draft()
RETURNS BOOLEAN AS $$
DECLARE
    current_status public.election_state_enum;
BEGIN
    SELECT election_status INTO current_status FROM public.settings LIMIT 1;
    RETURN current_status = 'draft'::public.election_state_enum;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper Function to check if election is live
CREATE OR REPLACE FUNCTION public.is_election_live()
RETURNS BOOLEAN AS $$
DECLARE
    current_status public.election_state_enum;
BEGIN
    SELECT election_status INTO current_status FROM public.settings LIMIT 1;
    RETURN current_status = 'live'::public.election_state_enum;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Replace permissive Admin policies with strict Draft-only policies

-- A. Settings
DROP POLICY IF EXISTS "Admin full access settings" ON public.settings;
DROP POLICY IF EXISTS "Admin read settings" ON public.settings;
DROP POLICY IF EXISTS "Admin mutate settings" ON public.settings;

CREATE POLICY "Admin read settings" ON public.settings FOR SELECT 
USING (public.is_admin(auth.jwt() ->> 'email'));

CREATE POLICY "Admin mutate settings" ON public.settings FOR UPDATE 
USING (public.is_admin(auth.jwt() ->> 'email'));

-- B. Candidates (STRICT STATE LOCK DOWN)
DROP POLICY IF EXISTS "Admin full access candidates" ON public.candidates;
DROP POLICY IF EXISTS "Admin read candidates" ON public.candidates;
DROP POLICY IF EXISTS "Admin mutate candidates" ON public.candidates;
DROP POLICY IF EXISTS "Admin insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Admin update candidates" ON public.candidates;
DROP POLICY IF EXISTS "Admin delete candidates" ON public.candidates;

-- Allow reading candidates
CREATE POLICY "Admin read candidates" ON public.candidates FOR SELECT 
USING (public.is_admin(auth.jwt() ->> 'email'));

-- Allow INSERT only during DRAFT state
CREATE POLICY "Admin insert candidates" ON public.candidates FOR INSERT 
WITH CHECK (public.is_admin(auth.jwt() ->> 'email') AND public.is_election_draft());

-- Allow UPDATE only during DRAFT state
CREATE POLICY "Admin update candidates" ON public.candidates FOR UPDATE 
USING (public.is_admin(auth.jwt() ->> 'email') AND public.is_election_draft());

-- Allow DELETE only during DRAFT state
CREATE POLICY "Admin delete candidates" ON public.candidates FOR DELETE 
USING (public.is_admin(auth.jwt() ->> 'email') AND public.is_election_draft());

-- C. Eligible Students
DROP POLICY IF EXISTS "Admins manage eligible students" ON public.eligible_students;
DROP POLICY IF EXISTS "Admin read eligible students" ON public.eligible_students;
DROP POLICY IF EXISTS "Admin mutate eligible students" ON public.eligible_students;

CREATE POLICY "Admin read eligible students" ON public.eligible_students FOR SELECT 
USING (public.is_admin(auth.jwt() ->> 'email'));

CREATE POLICY "Admin mutate eligible students" ON public.eligible_students FOR ALL 
USING (public.is_admin(auth.jwt() ->> 'email') AND public.is_election_draft());

-- D. Allowed Email Rules
DROP POLICY IF EXISTS "Authenticated admins can manage email rules" ON public.allowed_email_rules;
DROP POLICY IF EXISTS "Admin read email rules" ON public.allowed_email_rules;
DROP POLICY IF EXISTS "Admin mutate email rules" ON public.allowed_email_rules;

CREATE POLICY "Admin read email rules" ON public.allowed_email_rules FOR SELECT 
USING (public.is_admin(auth.jwt() ->> 'email'));

CREATE POLICY "Admin mutate email rules" ON public.allowed_email_rules FOR ALL 
USING (public.is_admin(auth.jwt() ->> 'email') AND public.is_election_draft());

-- E. Votes
DROP POLICY IF EXISTS "Admin full access votes" ON public.votes;
DROP POLICY IF EXISTS "Admin read votes" ON public.votes;
DROP POLICY IF EXISTS "Admin delete votes in draft" ON public.votes;

CREATE POLICY "Admin read votes" ON public.votes FOR SELECT
USING (public.is_admin(auth.jwt() ->> 'email'));

CREATE POLICY "Admin delete votes in draft" ON public.votes FOR DELETE
USING (public.is_admin(auth.jwt() ->> 'email') AND public.is_election_draft());

-- 4. Privacy Hardened Queries (Functions)

-- A. Results Query: Aggregates votes without exposing student emails.
CREATE OR REPLACE FUNCTION public.get_election_results()
RETURNS TABLE (
    position_name text,
    candidate_id uuid,
    candidate_name text,
    vote_count bigint
) AS $$
BEGIN
    RETURN QUERY
    -- Male CR
    SELECT 
        'Male CR'::text AS position_name,
        v.male_candidate_id AS candidate_id,
        c.name AS candidate_name,
        COUNT(v.id) AS vote_count
    FROM public.votes v
    JOIN public.candidates c ON v.male_candidate_id = c.id
    GROUP BY v.male_candidate_id, c.name
    UNION ALL
    -- Female CR
    SELECT 
        'Female CR'::text AS position_name,
        v.female_candidate_id AS candidate_id,
        c.name AS candidate_name,
        COUNT(v.id) AS vote_count
    FROM public.votes v
    JOIN public.candidates c ON v.female_candidate_id = c.id
    GROUP BY v.female_candidate_id, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Write-in Aggregation Query
CREATE OR REPLACE FUNCTION public.get_write_in_results()
RETURNS TABLE (
    position_name text,
    roll_number text,
    vote_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Male CR'::text AS position_name, male_write_in_roll AS roll_number, COUNT(id) AS vote_count
    FROM public.votes WHERE male_write_in_roll IS NOT NULL GROUP BY male_write_in_roll
    UNION ALL
    SELECT 'Female CR'::text AS position_name, female_write_in_roll AS roll_number, COUNT(id) AS vote_count
    FROM public.votes WHERE female_write_in_roll IS NOT NULL GROUP BY female_write_in_roll;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
