-- Optional Supabase migration for Sprint 4 + Sprint 5
-- Apply this in Supabase SQL Editor if you want full persistence for eligible students and ranking metadata.

create extension if not exists pgcrypto;

create table if not exists public.eligible_students (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending',
  voted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists eligible_students_status_idx on public.eligible_students(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'voting_method'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN voting_method text default 'single_choice';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'election_positions'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN election_positions text default 'male_female';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'ranked_voting_enabled'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN ranked_voting_enabled boolean default false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'final_vs_round_enabled'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN final_vs_round_enabled boolean default false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'live_confirmation_completed'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN live_confirmation_completed boolean default false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'election_locked'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN election_locked boolean default false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'ranking_data'
  ) THEN
    ALTER TABLE public.votes ADD COLUMN ranking_data jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'voting_method'
  ) THEN
    ALTER TABLE public.votes ADD COLUMN voting_method text default 'single_choice';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'votes' AND column_name = 'election_positions'
  ) THEN
    ALTER TABLE public.votes ADD COLUMN election_positions text default 'male_female';
  END IF;
END $$;
