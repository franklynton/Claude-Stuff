import type { AvatarId } from '@/types/user';
import { accountClient } from './cloudAuth';

export function usernameKey(input: string): string {
  const key = input.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(key)) throw new Error('Username must be 3-20 letters, numbers or underscores.');
  return key;
}

const alias = (name: string) => `${usernameKey(name)}@players.invalid`;

export async function registerUsername(username: string, password: string, avatar: AvatarId) {
  const key = usernameKey(username);
  const { data, error } = await accountClient().auth.signUp({
    email: alias(key), password,
    options: { data: { username: key, avatar } },
  });
  if (error) {
    if (error.code === 'user_already_exists' || /already registered/i.test(error.message)) throw new Error('That username is already taken.');
    throw error;
  }
  if (data.user?.identities?.length === 0) throw new Error('That username is already taken.');
  if (!data.session) throw new Error('Username signup is not enabled yet: disable Confirm Email in this Supabase project. No real email address is used.');
  return data;
}

export async function signInUsername(identifier: string, password: string) {
  // Existing email-based cloud accounts can still use their original email.
  const email = identifier.includes('@') ? identifier.trim() : alias(identifier);
  const { data, error } = await accountClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
