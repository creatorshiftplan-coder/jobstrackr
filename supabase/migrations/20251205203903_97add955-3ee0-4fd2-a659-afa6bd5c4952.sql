-- Insert admin role for the existing user
INSERT INTO public.user_roles (user_id, role)
VALUES ('537c8bd2-211d-4cad-954a-f5d59bfec7c6', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;