'use client';

import { useEffect, useState } from 'react';
import type { AvatarId } from '@/types/user';
import { accountClient } from '@/lib/cloudAuth';
import { registerUsername, signInUsername } from '@/lib/usernameAuth';
import CloudAccount from './CloudAccount';

export default function UsernameAccount({ onLocal }: { onLocal: () => void }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('bug');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let seenEvent = false;
    const db = accountClient();
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      seenEvent = true;
      if (active) setSignedIn(!!session);
    });
    void db.auth.getSession().then(({ data, error }) => {
      if (!active || seenEvent) return;
      if (error) { setError(error.message); setSignedIn(false); } else setSignedIn(!!data.session);
    }).catch(e => { if (active) { setError(e instanceof Error ? e.message : 'Session failed.'); setSignedIn(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (creating) await registerUsername(username, password, avatar);
      else await signInUsername(username, password);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign in failed.'); } finally { setBusy(false); }
  };
  if (signedIn) return <CloudAccount onLocal={onLocal} />;
  if (signedIn === null) return <p className='p-6'>Restoring account...</p>;
  return <div className='xp-screen flex min-h-screen flex-col'><header className='xp-top' /><main className='xp-middle flex flex-1 items-center justify-center p-8'><form onSubmit={submit} className='flex w-80 flex-col gap-3 text-white'>
    <h1 className='text-lg font-bold'>{creating ? 'Create cloud account' : 'Cloud sign in'}</h1><p>No email needed. Keep your username and password safe.</p>
    <label>{creating ? 'Unique username' : 'Username'}<input className='xp-input block w-full' type='text' autoComplete='username' autoCapitalize='none' spellCheck={false} required minLength={creating ? 3 : undefined} maxLength={creating ? 20 : undefined} pattern={creating ? '[A-Za-z0-9_]{3,20}' : undefined} value={username} onChange={e => setUsername(e.target.value)} /></label>
    <label>Password<input className='xp-input block w-full' type='password' autoComplete={creating ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></label>
    {creating && <label>Avatar<select className='xp-input block w-full' value={avatar} onChange={e => setAvatar(e.target.value as AvatarId)}>{['bug','floppy','cd','alien','pager','globe'].map(a => <option key={a}>{a}</option>)}</select></label>}
    <button disabled={busy} type='submit'>{busy ? 'Please wait...' : creating ? 'Create account' : 'Sign in'}</button>
    <button disabled={busy} type='button' onClick={() => { setCreating(!creating); setError(''); }}>{creating ? 'Already registered? Sign in' : 'Create account'}</button>
    <button disabled={busy} type='button' onClick={onLocal}>Back to local name login</button>
    <p role='alert'>{error}</p>{!creating && <p>Existing email accounts can enter their original email instead.</p>}
  </form></main><footer className='xp-bottom p-4'>Use the same username and password on another device.</footer></div>;
}
