create table if not exists public.api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now() not null,
  user_id uuid references auth.users not null,
  endpoint text not null,
  request_data jsonb default '{}'::jsonb,
  response_status integer
);

-- Enable RLS
alter table public.api_usage_logs enable row level security;

-- Policies
create policy "Enable insert for authenticated users"
on public.api_usage_logs
for insert
to authenticated
with check ( true );

create policy "Enable select for authenticated users"
on public.api_usage_logs
for select
to authenticated
using ( true );
