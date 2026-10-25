import type { User } from '@supabase/supabase-js';
import type { AvatarId } from '@/types/user';
import { getSupabase } from './supabase/client';

export function accountClient() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase is not configured.');
  return client;
}

export async function registerAccount(email: string, password: string, username: string, avatar: AvatarId) {
  const name = username.trim();
  if (!name || name.length > 20) throw new Error('Username must be 1-20 characters.');
  const { data, error } = await accountClient().auth.signUp({
    email: email.trim(), password,
    options: { data: { username: name, avatar } },
  });
  if (error) throw error;
  return { user: data.user, confirmationRequired: !data.session };
}

export async function signInAccount(email: string, password: string) {
  const { data, error } = await accountClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signOutAccount() {
  const { error } = await accountClient().auth.signOut();
  if (error) throw error;
}

export interface AccountProfile {
  id: string;
  username: string;
  avatar: AvatarId;
  created_at: string;
}

export async function ensureAccountProfile(user: User): Promise<AccountProfile> {
  const db = accountClient();
  const existing = await db.from('account_profiles').select('*').eq('id', user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as AccountProfile;
  const allowed = ['bug', 'floppy', 'cd', 'alien', 'pager', 'globe'];
  const avatar = allowed.includes(user.user_metadata.avatar) ? user.user_metadata.avatar : 'bug';
  const username = String(user.user_metadata.username ?? '').trim().slice(0, 20) || 'Player';
  const inserted = await db.from('account_profiles').insert({ id: user.id, username, avatar }).select().single();
  if (!inserted.error) return inserted.data as AccountProfile;
  if (inserted.error.code !== '23505') throw inserted.error;
  const retry = await db.from('account_profiles').select('*').eq('id', user.id).single();
  if (retry.error) throw retry.error;
  return retry.data as AccountProfile;
}
