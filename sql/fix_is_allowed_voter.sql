CREATE OR REPLACE FUNCTION public.is_allowed_voter(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mode text;
    v_is_allowed boolean := false;
    v_lower_email text;
BEGIN
    v_lower_email := lower(trim(user_email));

    -- Get the current tracking mode from settings
    SELECT tracking_mode INTO v_mode FROM public.settings LIMIT 1;

    IF v_mode = 'imported_list' THEN
        -- In Roster Mode, verify against the eligible_students table
        SELECT EXISTS (
            SELECT 1 FROM public.eligible_students 
            WHERE lower(trim(email)) = v_lower_email
        ) INTO v_is_allowed;
        
        RETURN v_is_allowed;
    ELSE
        -- In Rules Mode (Suffix, Domain, Exact), verify against allowed_email_rules
        
        -- 1. Check Exact rules
        SELECT EXISTS (
            SELECT 1 FROM public.allowed_email_rules 
            WHERE active = true 
            AND rule_type IN ('exact', 'exact_email', 'email')
            AND lower(trim(rule_value)) = v_lower_email
        ) INTO v_is_allowed;
        
        IF v_is_allowed THEN RETURN true; END IF;

        -- 2. Check Suffix/Domain rules (e.g. '@nitj.ac.in')
        SELECT EXISTS (
            SELECT 1 FROM public.allowed_email_rules 
            WHERE active = true 
            AND rule_type IN ('suffix', 'domain', 'ends_with')
            AND v_lower_email LIKE '%' || lower(trim(rule_value))
        ) INTO v_is_allowed;
        
        RETURN v_is_allowed;
    END IF;
END;
$$;
