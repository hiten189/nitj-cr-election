-- Adds nitj.cr.election@gmail.com as a super_admin
INSERT INTO public.admins (email, role)
VALUES ('nitj.cr.election@gmail.com', 'super_admin')
ON CONFLICT (email) 
DO UPDATE SET role = 'super_admin';
