# Username cloud login

Players use a username and password, not a personal email. New usernames are normalized to lowercase and restricted to 3-20 ASCII letters, numbers or underscores. Supabase Auth receives a deterministic internal alias <username>@players.invalid; Auth enforces uniqueness for these aliases. Keep passwords: usernames alone do not prove account ownership.

REQUIRED: in the Hacknotts26 Supabase project, Authentication > Email provider configuration, turn OFF Confirm Email. The connected tools cannot change that configuration. Keep email/password authentication enabled. If confirmation is enabled, signup may fail or create an unconfirmed alias account; this cannot receive mail and needs administrator recovery. Test only after configuration.

Apply unique-account-usernames.sql separately to enforce case-insensitive profile username uniqueness. The migration is not applied by pushing this commit. Existing profile-name collisions must be resolved without deleting player saves. Existing email-based accounts retain their email login; their display names do not automatically become username credentials. A new username matching a legacy profile may fail profile creation until resolved by an administrator.

The local-first login selection and multiplayer Pong are unchanged. Local demo accounts remain browser-local and are not subject to global username uniqueness. Cloud saves continue through the existing CloudAccount component after authentication. No automatic local-pet import or email-based password recovery is provided for alias accounts.

Not build- or browser-tested. Rebuild/redeploy the branch, check signup and same-username rejection (including letter-case changes), signout, and second-device save restoration. Earlier email-confirmation instructions in cloud-login-release.md do not apply to new username accounts.
