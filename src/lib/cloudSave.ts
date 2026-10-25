import type { AccountSave, AccountSaveRow } from '@/types/cloudSave';
import { accountClient } from './cloudAuth';

export class SaveConflictError extends Error {
  constructor() {
    super('Newer progress exists. Reload the cloud save before continuing.');
    this.name = 'SaveConflictError';
  }
}

async function verifyAccount(expectedUserId: string) {
  const { data, error } = await accountClient().auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== expectedUserId) throw new Error('Account changed. Operation cancelled.');
}

// The caller must supply a runtime validator before data enters the game.
export async function readAccountSave(
  expectedUserId: string,
  validate: (value: unknown) => AccountSave,
): Promise<AccountSaveRow | null> {
  await verifyAccount(expectedUserId);
  const { data, error } = await accountClient().from('account_saves').select('*').eq('user_id', expectedUserId).maybeSingle();
  if (error) throw error;
  await verifyAccount(expectedUserId);
  if (!data) return null;
  return { ...data, data: validate(data.data) } as AccountSaveRow;
}

export async function writeAccountSave(
  expectedUserId: string,
  snapshot: AccountSave,
  expectedRevision: number | null,
): Promise<AccountSaveRow> {
  await verifyAccount(expectedUserId);
  const db = accountClient();
  const data = { ...snapshot, pet: snapshot.pet ? { ...snapshot.pet, owner_id: expectedUserId } : null };
  if (expectedRevision === null) {
    const result = await db.from('account_saves').insert({ user_id: expectedUserId, data, revision: 1 }).select().single();
    if (result.error?.code === '23505') throw new SaveConflictError();
    if (result.error) throw result.error;
    await verifyAccount(expectedUserId);
    return result.data as AccountSaveRow;
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('Invalid save revision.');
  const result = await db.from('account_saves').update({
    data, revision: expectedRevision + 1, updated_at: new Date().toISOString(),
  }).eq('user_id', expectedUserId).eq('revision', expectedRevision).select().maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new SaveConflictError();
  await verifyAccount(expectedUserId);
  return result.data as AccountSaveRow;
}
