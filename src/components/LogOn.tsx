'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSessionSnapshot, getUsersSnapshot, logOut, parseUsers, subscribe } from '@/lib/localUsers';
import { setSaveSlot } from '@/lib/storage';
import { getSupabase } from '@/lib/supabase/client';
import CloudAccount from './CloudAccount';
import LoginScreen from './LoginScreen';
import PetHome from './PetHome';

export default function LogOn() {
  const [mode, setMode] = useState<'cloud' | 'local' | null>(null);
  useEffect(() => { setMode(getSupabase() ? 'cloud' : 'local'); }, []);
  if (!mode) return <p className='p-6'>Starting...</p>;
  if (mode === 'cloud') return <CloudAccount onLocal={() => setMode('local')} />;
  return <><div className='bg-[#000080] p-2 text-white'>Local demo: saves stay in this browser. <button onClick={() => setMode('cloud')} disabled={!getSupabase()}>Cloud sign in</button></div><LocalLogOn /></>;
}

function LocalLogOn() {
  const sessionId = useSyncExternalStore(subscribe, getSessionSnapshot, () => undefined);
  const usersRaw = useSyncExternalStore(subscribe, getUsersSnapshot, () => null);
  if (sessionId === undefined) return null;
  const user = parseUsers(usersRaw).find(u => u.id === sessionId);
  if (!user) return <div className='flex min-h-screen flex-col'><LoginScreen /></div>;
  setSaveSlot(user.id);
  return <PetHome key={user.id} userId={user.id} username={user.username} onLogOff={logOut} />;
}
