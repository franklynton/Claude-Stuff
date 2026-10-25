'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSessionSnapshot, getUsersSnapshot, logOut, parseUsers, subscribe } from '@/lib/localUsers';
import { setSaveSlot } from '@/lib/storage';
import { getSupabase } from '@/lib/supabase/client';
import CloudAccount from './CloudAccount';
import LoginScreen from './LoginScreen';
import PetHome from './PetHome';

// Name login is the default so a new visitor can just type a name and play.
// Cloud sign in is optional, and remembered so a refresh stays signed in.
const CLOUD_KEY = 'millennium-bug:cloud';

export default function LogOn() {
  const [mode, setMode] = useState<'cloud' | 'local' | null>(null);
  useEffect(() => { setMode(getSupabase() && localStorage.getItem(CLOUD_KEY) ? 'cloud' : 'local'); }, []);
  const choose = (next: 'cloud' | 'local') => {
    try { if (next === 'cloud') localStorage.setItem(CLOUD_KEY, '1'); else localStorage.removeItem(CLOUD_KEY); } catch {}
    setMode(next);
  };
  if (!mode) return <p className='p-6'>Starting...</p>;
  if (mode === 'cloud') return <CloudAccount onLocal={() => choose('local')} />;
  return <>{getSupabase() && <div className='bg-[#000080] p-2 text-white'>Want your pet on every computer? <button onClick={() => choose('cloud')}>Cloud sign in</button></div>}<LocalLogOn /></>;
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
