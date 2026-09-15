-- System Verification Script for IPE CR Election
-- Run this script to verify all required database migrations are applied correctly.

-- 1. Check ENUM type
SELECT 
    typname AS enum_name, 
    string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'election_state_enum'
GROUP BY typname;

-- 2. Check required tables exist
SELECT 
    table_name, 
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    ) AS table_exists
FROM (VALUES 
    ('settings'), ('votes'), ('candidates'), ('admins'), 
    ('eligible_students'), ('allowed_email_rules'), 
    ('email_notifications'), ('vote_activity_log')
) AS t(table_name);

-- 3. Check critical columns exist
SELECT 
    table_name, 
    column_name, 
    data_type,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = t.table_name 
        AND column_name = t.column_name
    ) AS column_exists
FROM (VALUES 
    ('settings', 'election_status', 'USER-DEFINED'),
    ('settings', 'voting_start_date', 'timestamp with time zone'),
    ('settings', 'voting_end_date', 'timestamp with time zone'),
    ('settings', 'enable_automatic_emails', 'boolean'),
    ('votes', 'round_number', 'integer'),
    ('votes', 'ranking_data', 'jsonb'),
    ('email_notifications', 'status', 'text'),
    ('vote_activity_log', 'event_type', 'text')
) AS t(table_name, column_name, data_type);

-- 4. Check RLS is enabled on all tables
SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'r'
AND c.relname IN ('settings', 'votes', 'candidates', 'admins', 'eligible_students', 'allowed_email_rules', 'email_notifications', 'vote_activity_log')
ORDER BY c.relname;

-- 5. Check RLS Policies
SELECT 
    tablename, 
    policyname, 
    cmd AS operation, 
    roles 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Check custom security functions exist
SELECT 
    proname AS function_name, 
    prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname IN ('is_election_draft', 'is_election_live', 'get_election_results', 'get_write_in_results');
