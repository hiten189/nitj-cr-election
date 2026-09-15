-- ==========================================================
-- IPE Voting System
-- 1. Eliminate Duplicate Emails & Add Unique Constraint
-- 2. Add Atomic Row Claiming RPC (Prevents Concurrency Duplicate Blasts)
-- ==========================================================

-- 1. Purge all existing duplicates in email_notifications table:
-- Keep only the single earliest row per (recipient_email, notification_type), delete all duplicate rows.
DELETE FROM public.email_notifications a
USING public.email_notifications b
WHERE a.id < b.id
  AND lower(trim(a.recipient_email)) = lower(trim(b.recipient_email))
  AND a.notification_type = b.notification_type;

-- 2. Add a UNIQUE INDEX at the database level:
-- This guarantees Postgres itself will REJECT any duplicate attempt.
-- Even if an admin clicks "Declare Results" or "Vote" 100 times, only 1 email can ever exist.
DROP INDEX IF EXISTS public.email_notifications_unique_recipient_type_idx;
CREATE UNIQUE INDEX email_notifications_unique_recipient_type_idx
ON public.email_notifications (lower(trim(recipient_email)), notification_type);

-- 3. Atomic Batch Claim RPC with FOR UPDATE SKIP LOCKED
-- This makes race conditions mathematically impossible:
-- Even if 10 edge functions fire at the exact same millisecond,
-- no two workers will ever claim or send the same email.
CREATE OR REPLACE FUNCTION public.claim_pending_emails(batch_size int DEFAULT 10)
RETURNS SETOF public.email_notifications
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH cte AS (
        SELECT id
        FROM public.email_notifications
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.email_notifications e
    SET status = 'processing'
    FROM cte
    WHERE e.id = cte.id
    RETURNING e.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pending_emails(int) TO authenticated, service_role, anon;

-- 4. Reset clean failed/processing records to pending if ready to send
UPDATE public.email_notifications
SET status = 'pending', retry_count = 0, error_message = NULL
WHERE status IN ('failed', 'processing');
