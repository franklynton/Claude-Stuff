-- Apply after account-sync.sql. Fails safely if existing profile names collide.
create unique index account_profiles_username_unique on public.account_profiles (lower(trim(username)));
