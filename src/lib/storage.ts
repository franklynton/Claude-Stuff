import type { Pet } from "@/types/db";
import type { Brain } from "./brain";
import { type Progress, START_PROGRESS } from "./progress";
import { TEST_USER } from "./localUsers";

// Browser save until Supabase auth + the pets table are set up (priority 2).
// Each account gets its own save slot. TestUser keeps the old keys, so pets saved
// before the login screen existed still load.
let slot = "millennium-bug:";

export function setSaveSlot(userId: string): void {
  slot = userId === TEST_USER.id ? "millennium-bug:" : `millennium-bug:${userId}:`;
}

const KEY = () => slot + "pet";

export function loadPet(): { pet: Pet; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(KEY());
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Pets saved before the extra stats existed start them at 80.
    saved.pet = { love: 80, cleanliness: 80, health: 100, fun: 80, sleep: 80, ...saved.pet };
    return saved;
  } catch {
    return null;
  }
}

export function savePet(pet: Pet): void {
  try {
    localStorage.setItem(KEY(), JSON.stringify({ pet, savedAt: Date.now() }));
  } catch {
    // storage unavailable; the game still runs for this session
  }
}

const PROGRESS_KEY = () => slot + "progress";

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY());
    return raw ? { ...START_PROGRESS, ...JSON.parse(raw) } : START_PROGRESS;
  } catch {
    return START_PROGRESS;
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY(), JSON.stringify(progress));
  } catch {}
}

const BRAIN_KEY = () => slot + "brain";

export function loadBrain(): Brain | null {
  try {
    const raw = localStorage.getItem(BRAIN_KEY());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBrain(brain: Brain): void {
  try {
    localStorage.setItem(BRAIN_KEY(), JSON.stringify(brain));
  } catch {}
}

// Signing out pauses the pet: the time until the next sign-in doesn't count.
// (Just closing the tab doesn't pause it; the pet catches up on that time.)
const PAUSE_KEY = () => slot + "paused";

export type Pause = { asleep: boolean };

export function savePause(pause: Pause): void {
  try {
    localStorage.setItem(PAUSE_KEY(), JSON.stringify(pause));
  } catch {}
}

export function loadPause(): Pause | null {
  try {
    const raw = localStorage.getItem(PAUSE_KEY());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPause(): void {
  try {
    localStorage.removeItem(PAUSE_KEY());
  } catch {}
}

export function clearPet(): void {
  try {
    localStorage.removeItem(KEY());
    localStorage.removeItem(PROGRESS_KEY());
    localStorage.removeItem(BRAIN_KEY());
    localStorage.removeItem(PAUSE_KEY());
  } catch {}
}

// Whether this account ticked "Don't show this again" on the How to play window.
const HELP_KEY = () => slot + "hideHelp";

export function loadHideHelp(): boolean {
  try {
    return localStorage.getItem(HELP_KEY()) === "1";
  } catch {
    return false;
  }
}

export function saveHideHelp(hide: boolean): void {
  try {
    if (hide) localStorage.setItem(HELP_KEY(), "1");
    else localStorage.removeItem(HELP_KEY());
  } catch {}
}
