-- Safe migration to convert election_status to ENUM and add deadlines

-- 1. Create the ENUM type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'election_state_enum') THEN
        CREATE TYPE public.election_state_enum AS ENUM ('draft', 'live', 'completed', 'final_round', 'closed');
    END IF;
END
$$;

-- 2. Add deadline columns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'voting_start_date') THEN
        ALTER TABLE public.settings ADD COLUMN voting_start_date timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'voting_end_date') THEN
        ALTER TABLE public.settings ADD COLUMN voting_end_date timestamptz;
    END IF;
END
$$;

-- 3. Safely convert existing election_status to the new ENUM without hitting constraint errors
DO $$
BEGIN
    -- Only attempt conversion if the column is currently text or varchar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'election_status' AND data_type IN ('text', 'character varying')
    ) THEN
        
        -- A. Add a temporary column with the new ENUM type
        ALTER TABLE public.settings ADD COLUMN new_election_status public.election_state_enum DEFAULT 'draft'::public.election_state_enum;
        
        -- B. Copy and sanitize the data from the old text column to the new ENUM column
        UPDATE public.settings 
        SET new_election_status = CASE 
            WHEN election_status IN ('draft', 'live', 'completed', 'final_round', 'closed') 
            THEN election_status::text::public.election_state_enum
            ELSE 'draft'::public.election_state_enum
        END;

        -- C. Drop the old column. 
        -- This automatically deletes any hidden CHECK constraints or defaults tied to the old text column!
        ALTER TABLE public.settings DROP COLUMN election_status;

        -- D. Rename the new column to the correct name
        ALTER TABLE public.settings RENAME COLUMN new_election_status TO election_status;
        
    END IF;
END
$$;
