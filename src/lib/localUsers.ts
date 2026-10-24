import type { AvatarId, LocalUser } from "@/types/user";

// TODO: replace with Supabase Auth + `profiles` table. Until then accounts live in
// localStorage and have no passwords: picking a name is enough to log in.
const USERS_KEY = "y2k.users";
const SESSION_KEY = "y2k.currentUserId";
const CHANGE_EVENT = "y2k-users-change";

export const AVATARS: Record<AvatarId, { emoji: string; bg: string }> = {
  bug: { emoji: "🐛", bg: "#1f8f3a" },
  floppy: { emoji: "💾", bg: "#2b4fb8" },
  cd: { emoji: "💿", bg: "#7a3db8" },
  alien: { emoji: "👾", bg: "#111111" },
  pager: { emoji: "📟", bg: "#b85a1f" },
  globe: { emoji: "🌐", bg: "#1f8fa8" },
};

// Seeded account that always exists so judges can log in instantly.
export const TEST_USER: LocalUser = {
  id: "test-user",
  username: "TestUser",
  avatar: "bug",
  created_at: "1999-12-31T23:59:59.000Z",
};

const DEFAULT_USERS_RAW = JSON.stringify([TEST_USER]);

function emitChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// --- useSyncExternalStore plumbing (snapshots are raw strings so they compare by value) ---

export function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getUsersSnapshot() {
  return localStorage.getItem(USERS_KEY) ?? DEFAULT_USERS_RAW;
}

export function getSessionSnapshot() {
  return localStorage.getItem(SESSION_KEY);
}

export function parseUsers(raw: string | null): LocalUser[] {
  if (!raw) return [];
  try {
    const users = JSON.parse(raw) as LocalUser[];
    // Make sure the test account can't be lost.
    return users.some((u) => u.id === TEST_USER.id) ? users : [TEST_USER, ...users];
  } catch {
    return [TEST_USER];
  }
}

// --- mutations ---

export function createUser(input: { username: string; avatar: AvatarId }): { user?: LocalUser; error?: string } {
  const username = input.username.trim();
  if (!username) return { error: "Please type a user name." };
  if (username.length > 20) return { error: "User names can be at most 20 characters." };

  const users = parseUsers(getUsersSnapshot());
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { error: `The name "${username}" is already taken.` };
  }

  const user: LocalUser = {
    id: crypto.randomUUID(),
    username,
    avatar: input.avatar,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
  emitChange();
  return { user };
}

export function logIn(user: LocalUser) {
  localStorage.setItem(SESSION_KEY, user.id);
  emitChange();
}

export function logOut() {
  localStorage.removeItem(SESSION_KEY);
  emitChange();
}
