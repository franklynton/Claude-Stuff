import type { Pet } from './db';
import type { Brain } from '@/lib/brain';
import type { Progress } from '@/lib/progress';

export interface AccountSave {
  schemaVersion: 1;
  pet: Pet | null;
  brain: Brain | null;
  progress: Progress;
  asleep: boolean;
  paused: boolean;
  hideHelp: boolean;
  savedAt: number;
}

export interface AccountSaveRow {
  user_id: string;
  data: AccountSave;
  revision: number;
  updated_at: string;
}
