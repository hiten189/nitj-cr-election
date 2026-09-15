-- Email System Architecture

-- 1. Add email settings to settings table safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'enable_automatic_emails'
    ) THEN
        ALTER TABLE public.settings ADD COLUMN enable_automatic_emails boolean default true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'send_voting_started_email'
    ) THEN
        ALTER TABLE public.settings ADD COLUMN send_voting_started_email boolean default true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'send_completion_email'
    ) THEN
        ALTER TABLE public.settings ADD COLUMN send_completion_email boolean default true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'allow_reminder_emails'
    ) THEN
        ALTER TABLE public.settings ADD COLUMN allow_reminder_emails boolean default true;
    END IF;
END
$$;

-- 2. Create email_notifications table
CREATE TABLE IF NOT EXISTS public.email_notifications (
    id uuid primary key default gen_random_uuid(),
    notification_type text not null, -- 'VOTING_STARTED', 'VOTING_COMPLETED', 'RESULTS_DECLARED', 'REMINDER_SENT'
    recipient_email text not null,
    status text not null default 'pending', -- 'pending', 'sent', 'failed'
    error_message text,
    retry_count integer default 0,
    created_at timestamptz not null default now(),
    sent_at timestamptz
);

-- Index for querying pending emails efficiently
CREATE INDEX IF NOT EXISTS email_notifications_status_idx ON public.email_notifications(status);

-- 3. Enable RLS on email_notifications
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can view and insert notifications
DROP POLICY IF EXISTS "Admins manage email_notifications" ON public.email_notifications;
CREATE POLICY "Admins manage email_notifications"
ON public.email_notifications FOR ALL
USING (public.is_admin(auth.jwt() ->> 'email'));

-- System (Service Role) can update them (handled by Edge Function, which uses Service Role and ignores RLS)
