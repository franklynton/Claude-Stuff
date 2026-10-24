"use client";

import { useSyncExternalStore } from "react";
import { getSessionSnapshot, getUsersSnapshot, logOut, parseUsers, subscribe } from "@/lib/localUsers";
import { setSaveSlot } from "@/lib/storage";
import LoginScreen from "./LoginScreen";
import PetHome from "./PetHome";

// Shows the XP log-on screen until someone picks an account, then that account's bug.
export default function LogOn() {
  // Server snapshot is undefined so nothing renders until the browser knows who's logged in.
  const sessionId = useSyncExternalStore(subscribe, getSessionSnapshot, () => undefined);
  const usersRaw = useSyncExternalStore(subscribe, getUsersSnapshot, () => null);
  if (sessionId === undefined) return null;

  const user = parseUsers(usersRaw).find((u) => u.id === sessionId);
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <LoginScreen />
      </div>
    );
  }

  // Set before PetHome mounts so its first load reads this account's save. The key
  // remounts PetHome when switching accounts so no state leaks between users.
  setSaveSlot(user.id);
  return <PetHome key={user.id} userId={user.id} username={user.username} onLogOff={logOut} />;
}
