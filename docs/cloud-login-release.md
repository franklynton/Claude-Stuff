# Cloud login release

The login gate now uses Supabase Auth when the existing public Supabase environment variables are configured. Local demo login remains available and does not sync. Existing local pets are not automatically imported.

Requires account_profiles and account_saves from account-sync.sql (already applied to Hacknotts26). Configure the deployed app's NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for that project and rebuild/redeploy. Configure Auth email confirmation/redirect settings in the Supabase dashboard. No service-role key is needed.

After login the cloud row is validated and restored into the account's existing local save slot before PetHome mounts. A serialized queue uploads snapshots every five seconds; explicit signout first captures the existing pause marker, unmounts gameplay, waits for pending writes, saves, then signs out. Revision conflicts and save failures stop gameplay rather than silently overwriting. Recovery JSON is retained in account-recovery:<auth UUID> and can be downloaded. Unknown network outcomes require reconciliation/reload, not blind retry.

On ordinary tab close the last five seconds may not reach the server. Concurrent play is not merged; a conflict requires choosing/recovering progress manually. Active sleep without explicit signout follows the existing local game's behaviour. Local saves remain client-authoritative, not anti-cheat protected. Password reset UI and automatic import are not included.

Not build- or browser-tested in this environment. Before submission run npm run build and npm run lint, then check signup/confirmation, signout, a second-browser login, pet/brain/coin persistence, RLS isolation, and a competing-device save. The earlier account-sync.md backend-only status is superseded by this release note; remaining limitations above still apply.
