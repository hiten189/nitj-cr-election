-- Sprint 11: Candidate Schema Tweaks
-- Make roll_number optional and rely on candidate name/position for uniqueness.

-- 1. Remove the NOT NULL constraint from roll_number
ALTER TABLE public.candidates ALTER COLUMN roll_number DROP NOT NULL;

-- 2. Drop the unique constraint on roll_number
-- (We use DO block to prevent errors if the constraint doesn't exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'candidates_roll_number_key'
    ) THEN
        ALTER TABLE public.candidates DROP CONSTRAINT candidates_roll_number_key;
    END IF;
END $$;

-- 3. Add a unique constraint on (name, position) to prevent duplicates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'candidates_name_position_key'
    ) THEN
        ALTER TABLE public.candidates ADD CONSTRAINT candidates_name_position_key UNIQUE (name, position);
    END IF;
END $$;

-- 4. Remove image_url if it exists as it is no longer used
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'candidates' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE public.candidates DROP COLUMN image_url;
    END IF;
END $$;
