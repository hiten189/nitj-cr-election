-- Run once in the Supabase SQL Editor.
-- It publishes only the events the admin dashboard listens for.  The app also
-- polls every 10 seconds, so the dashboard remains correct if this is skipped.
DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['votes', 'voter_tracking', 'settings']
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = table_name
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
        END IF;
    END LOOP;
END;
$$;
