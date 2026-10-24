"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AvatarId, LocalUser } from "@/types/user";
import { AVATARS, createUser, getUsersSnapshot, logIn, parseUsers, subscribe } from "@/lib/localUsers";

export default function LoginScreen() {
  // Server snapshot is null so SSR renders an empty list and the client fills it in.
  const usersRaw = useSyncExternalStore(subscribe, getUsersSnapshot, () => null);
  const users = useMemo(() => parseUsers(usersRaw), [usersRaw]);

  const [creating, setCreating] = useState(false);
  const [poweredOff, setPoweredOff] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCreating(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enter = (user: LocalUser) => logIn(user);

  if (poweredOff) {
    return (
      <button
        onClick={() => setPoweredOff(false)}
        className="flex flex-1 cursor-default items-center justify-center bg-black text-2xl text-[#f7931e]"
      >
        It&apos;s now safe to turn off your computer.
      </button>
    );
  }

  return (
    <div className="xp-screen flex flex-1 flex-col select-none">
      <header className="xp-top" />

      <main className="xp-middle flex flex-1">
        <section className="xp-left flex w-1/2 items-center justify-end pr-14">
          <div className="text-right">
            <div className="relative inline-block">
              <span className="xp-welcome">welcome</span>
              <BugFlag />
            </div>
            <p className="mt-1 pl-10 text-left text-[17px] text-white/95">Click on your user name to begin</p>
          </div>
        </section>

        <div className="xp-divider" />

        <section className="flex w-1/2 flex-col justify-center gap-3 overflow-y-auto py-8 pl-14">
          {users.map((user) => (
            <div key={user.id} className={`xp-tile ${creating ? "opacity-50" : ""}`}>
              <button onClick={() => enter(user)} className="flex items-center gap-3 text-left">
                <Avatar avatar={user.avatar} />
                <span className="text-[19px] text-white">{user.username}</span>
              </button>
            </div>
          ))}
          {usersRaw !== null && (
            <NewUserTile
              selected={creating}
              onSelect={() => setCreating(true)}
              onCancel={() => setCreating(false)}
              onCreated={enter}
            />
          )}
        </section>
      </main>

      <footer className="xp-bottom flex items-center justify-between px-5">
        <FooterButton label="Turn off computer" onClick={() => setPoweredOff(true)} />
        <p className="max-w-[340px] text-right text-[13px] leading-snug text-white/90">
          After you log on, your millennium bug will be waiting for you.
        </p>
      </footer>
    </div>
  );
}

function Avatar({ avatar, size = 48 }: { avatar: AvatarId; size?: number }) {
  const { emoji, bg } = AVATARS[avatar];
  return (
    <span
      className="xp-avatar flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.55 }}
    >
      {emoji}
    </span>
  );
}

function NewUserTile({
  selected,
  onSelect,
  onCancel,
  onCreated,
}: {
  selected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onCreated: (user: LocalUser) => void;
}) {
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>("floppy");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createUser({ username, avatar });
    if (result.error || !result.user) return setError(result.error ?? "Something went wrong.");
    onCreated(result.user);
  };

  return (
    <div className={`xp-tile ${selected ? "xp-tile-selected" : ""}`}>
      <button onClick={onSelect} className="flex items-center gap-3 text-left">
        <span className="xp-avatar xp-avatar-new flex h-12 w-12 items-center justify-center text-3xl text-white">
          +
        </span>
        <span className="text-[19px] text-white">New user</span>
      </button>

      {selected && (
        <form onSubmit={submit} className="relative mt-2 ml-[60px] flex flex-col gap-1.5 text-[12px] text-white">
          <label>
            User name
            <input
              autoFocus
              maxLength={20}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              className="xp-input mt-0.5 block w-[200px]"
            />
          </label>
          <div>
            Pick a picture
            <div className="mt-1 flex gap-1.5">
              {(Object.keys(AVATARS) as AvatarId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAvatar(id)}
                  className={`rounded-[3px] ${avatar === id ? "xp-pick-selected" : "opacity-80 hover:opacity-100"}`}
                >
                  <Avatar avatar={id} size={30} />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <GoButton label="Create account" />
            <span>Create account</span>
            <button type="button" onClick={onCancel} className="ml-2 underline hover:text-[#ffcc33]">
              Cancel
            </button>
          </div>
          {error && <Balloon title="Can't create account">{error}</Balloon>}
        </form>
      )}
    </div>
  );
}

function GoButton({ label }: { label: string }) {
  return (
    <button type="submit" title={label} aria-label={label} className="xp-go-btn">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="white">
        <path d="M2 7h8V3l5 5-5 5V9H2z" />
      </svg>
    </button>
  );
}

function Balloon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="xp-balloon">
      <p className="mb-1 flex items-center gap-1.5 font-bold">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2b6bd6] text-[10px] text-white">i</span>
        {title}
      </p>
      <div>{children}</div>
    </div>
  );
}

function FooterButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-2 text-[17px] text-white">
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px] border border-white/70 bg-[#e2582c] group-hover:brightness-125">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M8 2v6" />
          <path d="M4.5 4.5a5 5 0 1 0 7 0" />
        </svg>
      </span>
      <span className="group-hover:underline">{label}</span>
    </button>
  );
}

// Waving 4-colour flag next to "welcome", drawn as skewed pixel blocks.
function BugFlag() {
  const colors = ["#f25022", "#7fba00", "#00a4ef", "#ffb900"];
  return (
    <span className="absolute -top-7 -right-8 grid rotate-[-8deg] skew-y-[-12deg] grid-cols-2 gap-[2px]">
      {colors.map((c) => (
        <span key={c} className="h-[13px] w-[15px]" style={{ background: c }} />
      ))}
    </span>
  );
}
