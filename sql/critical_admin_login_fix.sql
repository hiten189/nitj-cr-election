-- Run once in the Supabase SQL Editor.
-- Allows the login form to determine whether an email is an active admin
-- before the user has authenticated, without exposing the admins table.
CREATE OR REPLACE FUNCTION public.is_admin_email(user_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admins
        WHERE lower(email) = lower(trim(user_email))
          AND active = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_email(text) TO anon, authenticated;
