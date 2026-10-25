'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AvatarId } from '@/types/user';
import type { AccountSave } from '@/types/cloudSave';
import { accountClient, ensureAccountProfile, registerAccount, signInAccount, signOutAccount } from '@/lib/cloudAuth';
import { readAccountSave, writeAccountSave } from '@/lib/cloudSave';
import { captureAccount, recoveryKey, restoreAccount, validateAccountSave } from '@/lib/accountSnapshot';
import { setSaveSlot } from '@/lib/storage';
import PetHome from './PetHome';

const message = (e: unknown) => e instanceof Error ? e.message : 'Account service failed.';

export default function CloudAccount({ onLocal }: { onLocal: () => void }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let seenEvent = false;
    const db = accountClient();
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      seenEvent = true;
      if (active) setUser(old => old !== undefined && old?.id === session?.user?.id ? old : session?.user ?? null);
    });
    void db.auth.getSession().then(({ data, error }) => {
      if (!active || seenEvent) return;
      if (error) setError(error.message); else setUser(data.session?.user ?? null);
    }).catch(e => { if (active) setError(message(e)); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  if (error) return <div className='p-6'><p role='alert'>{error}</p><button onClick={() => location.reload()}>Retry</button><button onClick={onLocal}>Local demo</button></div>;
  if (user === undefined) return <p className='p-6'>Restoring account...</p>;
  if (user) return <CloudGame key={user.id} user={user} />;
  return <AccountForm onLocal={onLocal} />;
}

function AccountForm({ onLocal }: { onLocal: () => void }) {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('bug');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      if (creating) {
        const result = await registerAccount(email, password, username, avatar);
        if (result.confirmationRequired) setNotice('Check your email to confirm your account, then sign in here.');
      } else await signInAccount(email, password);
    } catch (e) { setNotice(message(e)); } finally { setBusy(false); }
  };
  return <div className='xp-screen flex min-h-screen flex-col'><header className='xp-top' /><main className='xp-middle flex flex-1 items-center justify-center p-8'><form onSubmit={submit} className='flex w-80 flex-col gap-3 text-white'>
    <h1 className='text-lg font-bold'>Cloud sign in</h1><p>Your pet follows you across devices.</p>
    {creating && <><label>User name<input className='xp-input block w-full' value={username} maxLength={20} required onChange={e => setUsername(e.target.value)} /></label><label>Avatar<select className='xp-input block w-full' value={avatar} onChange={e => setAvatar(e.target.value as AvatarId)}>{['bug','floppy','cd','alien','pager','globe'].map(a => <option key={a}>{a}</option>)}</select></label></>}
    <label>Email<input className='xp-input block w-full' type='email' autoComplete='email' required value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Password<input className='xp-input block w-full' type='password' autoComplete={creating ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></label>
    <button disabled={busy} type='submit'>{busy ? 'Please wait...' : creating ? 'Create cloud account' : 'Sign in'}</button>
    <button disabled={busy} type='button' onClick={() => { setCreating(!creating); setNotice(''); }}>{creating ? 'Already registered? Sign in' : 'Create an account'}</button>
    <button disabled={busy} type='button' onClick={onLocal}>Back to name login (saves in this browser)</button>
    <p role='status'>{notice}</p></form></main><footer className='xp-bottom p-4'>Use the same email and password on your other device.</footer></div>;
}

function CloudGame({ user }: { user: User }) {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState('Player');
  const [status, setStatus] = useState('Loading cloud save...');
  const [error, setError] = useState('');
  const [hasRecovery, setHasRecovery] = useState(false);
  const logoff = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    let stopped = false;
    let revision: number | null = null;
    let last = '';
    let timer: ReturnType<typeof setInterval> | undefined;
    let queue: Promise<void> = Promise.resolve();
    const fail = (e: unknown) => {
      stopped = true; if (timer) clearInterval(timer);
      if (active) { setReady(false); setError(message(e)); }
    };
    const enqueue = (snapshot: AccountSave) => {
      localStorage.setItem(recoveryKey(user.id), JSON.stringify(snapshot));
      queue = queue.then(async () => {
        if (!active) throw new Error('Account changed. Save cancelled.');
        const encoded = JSON.stringify(snapshot);
        if (encoded === last) return;
        setStatus('Saving...');
        const row = await writeAccountSave(user.id, snapshot, revision);
        revision = row.revision; last = encoded;
        if (active) setStatus('Saved to cloud');
      });
      return queue;
    };
    logoff.current = () => {
      if (stopped) return;
      stopped = true; if (timer) clearInterval(timer);
      try {
        const snapshot = captureAccount(user.id);
        setReady(false); setStatus('Saving and signing out...');
        void enqueue(snapshot).then(() => signOutAccount()).catch(fail);
      } catch (e) { fail(e); }
    };
    void (async () => {
      const profile = await ensureAccountProfile(user);
      const row = await readAccountSave(user.id, validateAccountSave);
      if (!active) return;
      revision = row?.revision ?? null;
      restoreAccount(user.id, row?.data ?? null);
      setSaveSlot(user.id);
      setHasRecovery(!!localStorage.getItem(recoveryKey(user.id)));
      setUsername(profile.username); setStatus('Cloud save loaded'); setReady(true);
      timer = setInterval(() => {
        if (stopped || !active) return;
        try { void enqueue(captureAccount(user.id)).catch(fail); } catch (e) { fail(e); }
      }, 5000);
    })().catch(fail);
    return () => { active = false; stopped = true; if (timer) clearInterval(timer); };
  }, [user]);
  const download = () => {
    const raw = localStorage.getItem(recoveryKey(user.id));
    if (!raw) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'millennium-bug-recovery.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (error) return <div className='p-6'><h1>Cloud sync stopped</h1><p role='alert'>{error}</p><p>Your local recovery copy is retained. Download it before reloading; reloading uses the server save.</p><button onClick={download}>Download recovery</button><button onClick={() => location.reload()}>Reload cloud save</button></div>;
  return <><div className='bg-[#000080] p-2 text-white' role='status'>{status} · Cloud account: {username} · autosave every 5 seconds{hasRecovery && <button onClick={download}>Download local recovery</button>}</div>{ready ? <PetHome userId={user.id} username={username} onLogOff={() => logoff.current()} /> : <p className='p-6'>{status}</p>}</>;
}
