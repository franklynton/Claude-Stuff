-- Apply once in a test project first. Does not alter existing game tables.
create table public.account_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(trim(username)) between 1 and 20),
  avatar text not null default 'bug' check (avatar in ('bug','floppy','cd','alien','pager','globe')),
  created_at timestamptz not null default now()
);
create table public.account_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.account_profiles enable row level security;
alter table public.account_saves enable row level security;
create policy profile_read on public.account_profiles for select to authenticated using ((select auth.uid()) = id);
create policy profile_create on public.account_profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profile_edit on public.account_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy save_read on public.account_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy save_create on public.account_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy save_edit on public.account_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.account_profiles, public.account_saves from public, anon, authenticated;
grant select, insert, update on public.account_profiles, public.account_saves to authenticated;
