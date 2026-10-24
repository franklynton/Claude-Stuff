export type AvatarId = "bug" | "floppy" | "cd" | "alien" | "pager" | "globe";

// Local-only account used by the login screen until Supabase Auth is wired up.
export type LocalUser = {
  id: string;
  username: string;
  avatar: AvatarId;
  created_at: string;
};
