# Account sync foundation

Status: backend helpers only. Not built or integration-tested. Existing local login and gameplay are unchanged.

## Setup
1. Apply supabase/account-sync.sql once to a separate Supabase test project. It creates account_profiles and account_saves without changing the game's existing tables.
2. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Never expose a service-role key.
3. Configure email/password Auth, confirmation and redirect settings in Supabase.

## Integration still required
- Replace local account selection with authenticated signup/signin, preserving the XP UI.
- Restore sessions and subscribe to Auth changes; ignore late work for previous accounts.
- After authentication, call ensureAccountProfile and readAccountSave before mounting PetHome. Supply a full runtime validator/migrator for AccountSave; types alone are not validation.
- Cache state by explicit Auth user ID. Offer explicit import of selected local saves only when the cloud save is empty; preserve originals.
- Add a serialized dirty-save loop and save status UI. Pass the expected account ID to every read/write and cancel pending work on account changes.
- Retain the returned revision; never automatically retry conflicts with a newer revision.
- Flush a paused snapshot before signOutAccount. Pet deletion should save pet:null, not delete the save row.
- Handle uncertain network outcomes by reloading/reconciling rather than blind overwrites.
- Keep lobby connection IDs separate from Auth account IDs.

## Required tests before release
Build/lint; email confirmation; two-device continuation; RLS isolation between accounts; competing writes; account switch with pending save; offline recovery; pause on signout; pet deletion; malformed save rejection.

The browser is authoritative for its own game state in this prototype. Ownership RLS is not anti-cheat. updated_at currently uses the client clock. This SQL is a one-time migration, not an idempotent script.
