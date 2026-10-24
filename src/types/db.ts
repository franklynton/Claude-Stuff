// Row types for the Supabase tables. Column names match CLAUDE.md exactly.

export type PixelGrid = string[][]; // 16x16 colour strings; "" is transparent

export interface Profile {
  id: string;
  username: string;
  coins: number;
  created_at: string;
}

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  personality: string;
  pixel_data: PixelGrid;
  hunger: number; // 0-100, 100 = full
  mood: number; // 0-100, 100 = happy
  glitch_level: number; // 0-100, 100 = fully corrupted
  last_fed_at: string;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
}

export interface ClubMember {
  club_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  room: string;
  sender_pet_id: string;
  content: string;
  created_at: string;
}
