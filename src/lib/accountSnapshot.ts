import type { AccountSave } from '@/types/cloudSave';
import { START_PROGRESS } from './progress';

const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numbers = (v: unknown) => obj(v) && Object.values(v).every(num);
const nullableText = (v: unknown) => v === null || typeof v === 'string';

export function validateAccountSave(value: unknown): AccountSave {
  const bad = () => { throw new Error('Invalid cloud save. It has not been overwritten.'); };
  if (!obj(value) || value.schemaVersion !== 1) return bad();
  if (!num(value.savedAt) || value.savedAt < 0 || !['asleep','paused','hideHelp'].every(k => typeof value[k] === 'boolean')) return bad();
  const p = value.pet;
  if (p !== null) {
    if (!obj(p) || !['id','owner_id','name','personality','last_fed_at','created_at'].every(k => typeof p[k] === 'string')) return bad();
    if (!['hunger','mood','love','cleanliness','health','fun','sleep','glitch_level'].every(k => num(p[k]) && Number(p[k]) >= 0 && Number(p[k]) <= 100)) return bad();
    if (!Array.isArray(p.pixel_data) || p.pixel_data.length !== 16 || !p.pixel_data.every(r => Array.isArray(r) && r.length === 16 && r.every(c => typeof c === 'string'))) return bad();
  }
  const b = value.brain;
  if (p !== null && b === null) return bad();
  if (b !== null) {
    if (!obj(b) || !numbers(b.traits) || !numbers(b.skills) || !numbers(b.likes) || !numbers(b.words) || !numbers(b.counts)) return bad();
    const traits = b.traits as Record<string, unknown>;
    const skills = b.skills as Record<string, unknown>;
    if (!['cheer','play','cling','sweet'].every(k => num(traits[k])) || !['thinking','motor','social','creativity'].every(k => num(skills[k]))) return bad();
    if (!num(b.stage) || !Number.isInteger(b.stage) || b.stage < 0 || b.stage > 3 || !num(b.age) || b.age < 0 || b.age > 100) return bad();
    if (!nullableText(b.ownerName) || !nullableText(b.reflection) || typeof b.neglected !== 'boolean') return bad();
    if (!Array.isArray(b.memories) || !b.memories.every(m => obj(m) && typeof m.text === 'string' && typeof m.at === 'string')) return bad();
  }
  const progress = value.progress;
  if (!obj(progress) || !num(progress.coins) || !num(progress.xp) || !Array.isArray(progress.owned) || !progress.owned.every(v => typeof v === 'string')) return bad();
  if (!['hat','glasses','wallpaper'].every(k => nullableText(progress[k]))) return bad();
  if (progress.nudge !== undefined && (!obj(progress.nudge) || !Object.values(progress.nudge).every(v => obj(v) && num(v.x) && num(v.y)))) return bad();
  return value as unknown as AccountSave;
}

const prefix = (id: string) => `millennium-bug:${id}:`;
export const recoveryKey = (id: string) => `account-recovery:${id}`;

export function captureAccount(id: string): AccountSave {
  const base = prefix(id);
  const read = (key: string) => { const raw = localStorage.getItem(base + key); return raw ? JSON.parse(raw) : null; };
  const saved = read('pet');
  const pause = read('paused');
  return validateAccountSave({ schemaVersion: 1, pet: saved?.pet ?? null, brain: saved ? read('brain') : null,
    progress: read('progress') ?? START_PROGRESS, asleep: pause?.asleep ?? false, paused: !!pause,
    hideHelp: localStorage.getItem(base + 'hideHelp') === '1', savedAt: saved?.savedAt ?? Date.now() });
}

export function restoreAccount(id: string, data: AccountSave | null) {
  const base = prefix(id);
  const keys = ['pet','brain','progress','paused','hideHelp'];
  const existing = Object.fromEntries(keys.map(k => [k, localStorage.getItem(base + k)]));
  if (existing.pet && !localStorage.getItem(recoveryKey(id))) localStorage.setItem(recoveryKey(id), JSON.stringify(existing));
  const save = data ?? { schemaVersion: 1, pet: null, brain: null, progress: START_PROGRESS, asleep: false, paused: false, hideHelp: false, savedAt: Date.now() };
  if (save.pet) localStorage.setItem(base + 'pet', JSON.stringify({ pet: { ...save.pet, owner_id: id }, savedAt: save.savedAt }));
  else localStorage.removeItem(base + 'pet');
  if (save.brain) localStorage.setItem(base + 'brain', JSON.stringify(save.brain)); else localStorage.removeItem(base + 'brain');
  localStorage.setItem(base + 'progress', JSON.stringify(save.progress));
  if (save.paused) localStorage.setItem(base + 'paused', JSON.stringify({ asleep: save.asleep })); else localStorage.removeItem(base + 'paused');
  if (save.hideHelp) localStorage.setItem(base + 'hideHelp', '1'); else localStorage.removeItem(base + 'hideHelp');
}
