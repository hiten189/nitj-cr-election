-- Add the ALL_VOTED_ADMIN_ALERT trigger to the submit_vote RPC

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
    v_expected_voters integer;
    v_total_votes bigint;
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
    v_male_id := NULLIF(vote_payload->>'male_candidate_id', '')::uuid;
    v_female_id := NULLIF(vote_payload->>'female_candidate_id', '')::uuid;
    v_male_write_in := NULLIF(vote_payload->>'male_write_in_roll', '');
    v_female_write_in := NULLIF(vote_payload->>'female_write_in_roll', '');
    v_ranking := vote_payload->'ranking_data';
    v_voting_method := COALESCE(vote_payload->>'voting_method', 'single_choice');
    v_election_positions := COALESCE(vote_payload->>'election_positions', 'male_female');

    -- 5. Insert anonymous vote
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

    -- 6. Check if all expected voters have voted
    SELECT expected_voters INTO v_expected_voters FROM public.settings LIMIT 1;
    IF v_expected_voters IS NOT NULL AND v_expected_voters > 0 THEN
        SELECT COUNT(*) INTO v_total_votes FROM public.voter_tracking WHERE round_number = current_round;
        
        -- Trigger only exactly when the target is reached
        IF v_total_votes = v_expected_voters THEN
            INSERT INTO public.email_notifications (notification_type, recipient_email)
            VALUES 
                ('ALL_VOTED_ADMIN_ALERT', 'nitj.cr.election@gmail.com'),
                ('ALL_VOTED_ADMIN_ALERT', 'hitenaggarwal18@gmail.com');
        END IF;
    END IF;
END;
$$;
