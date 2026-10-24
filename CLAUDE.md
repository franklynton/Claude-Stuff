# CLAUDE.md

## Project
HackNotts '26 (theme: Y2K). 24-hour hackathon build, team of 4 (1 developer, 3 non-technical). Optimise for a working, impressive live demo over completeness.

**Concept:** a Y2K-era Tamagotchi / Club Penguin-style web app. Each user raises an AI-powered pet that is a "millennium bug" that survived 1999. If neglected, it glitches (dates break, UI corrupts). Users can befriend other users' pets in real time, join clubs, draw their own pet in a pixel-art editor, and play one mini-game to earn coins.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres, Auth, Realtime (presence + broadcast)
- `98.css` for the Windows 98 look (retro windows, buttons, title bars)
- LLM called from a Next.js route handler (`/api/chat`), server-side only
- Deploy: Vercel

## Rules
- Keep it simple. No new libraries without asking first.
- Prefer plain `<canvas>` over game engines. No Phaser, no Electron.
- API keys live in `.env.local` only. Never hardcode or commit secrets. Never expose the LLM key to the client.
- Every Supabase table needs Row Level Security policies.
- Use TypeScript types for all DB rows. Keep types in `src/types/`.
- Small, working increments. After each feature: run `npm run build`, fix errors, then commit.
- Before large changes, plan first and list the files you will touch. Don't rewrite files wholesale to fix small bugs.
- Add short comments only where logic is non-obvious. The developer must be able to explain the code to judges.
- Mobile layout is low priority. Desktop browser is the demo target.

## Folder structure
```
src/
  app/
    api/chat/route.ts      # LLM chat endpoint
    (pages)/               # home, pet, friends, clubs, game, editor
  components/              # Win98 window wrapper, PetSprite, PixelEditor, etc.
  lib/
    supabase/              # browser + server clients
    realtime.ts            # presence/broadcast helpers
    pet.ts                 # needs/decay/glitch logic
  types/
public/
  sprites/                 # pet art (PNG, 32x32)
  items/                   # shop/cosmetic art (PNG)
  sounds/                  # sfx + music
supabase/
  schema.sql               # all tables + RLS in one file
```

## Data model (keep column names exactly as written)
- `profiles`: id (uuid, = auth user id), username, coins (int, default 0), created_at
- `pets`: id, owner_id (-> profiles.id), name, personality (text), pixel_data (jsonb, 16x16 grid of colour strings), hunger (int 0-100), mood (int 0-100, average of the needs), love (int 0-100), cleanliness (int 0-100), health (int 0-100), fun (int 0-100), sleep (int 0-100), glitch_level (int 0-100), last_fed_at, created_at
- `pet_progress`: pet_id (-> pets.id), xp (int), owned_items (jsonb, shop item ids), hat (text), glasses (text), wallpaper (text). Coins stay on `profiles.coins`.
- `friendships`: id, requester_id, addressee_id, status ('pending' | 'accepted'), created_at
- `clubs`: id, name, description, owner_id, created_at
- `club_members`: club_id, user_id, joined_at
- `messages`: id, room (text: club id or pet-pair key), sender_pet_id, content, created_at

## Realtime design
- One presence channel `lobby` for online pets (id, name, position, pixel_data).
- One channel per club `club:<id>` for chat + pet positions.
- Pet-to-pet visits: the visiting client generates both pets' dialogue via `/api/chat` and broadcasts the result so both owners see the same conversation.

## AI pet behaviour
- Each pet has a `personality` prompt. Replies must be short (1-2 sentences), in character, with 2000-era slang.
- System prompt includes current hunger, mood and glitch_level so the pet's tone reflects how it's been treated.
- High glitch_level: occasional scrambled text, fake error messages, Y2K references.
- Keep all content PG. Secret "freak mode" (Konami code) is chaotic and glitchy, not explicit.

## Y2K style guide
- Windows 98 / early-web aesthetic: grey bevelled windows, teal desktop background, pixel fonts, marquee text, "under construction" banners, retro sounds.
- Pixel-art sprites rendered with `image-rendering: pixelated`.
- Fake loading bars, error dialogs and "You've got mail" style sounds are encouraged.

## Assets
Teammates drop art/audio into `/public` using agreed filenames. Don't rename or delete asset files. If an asset is missing, use a placeholder and leave a `TODO` comment.

## Priority order (cut from the bottom if short on time)
1. Pet on screen with idle animation and AI chat
2. Auth + persisted pet
3. Friends: presence, friend requests, pets visiting
4. Pixel-art editor
5. Clubs (shared room)
6. One mini-game that earns coins
7. Glitch mechanic polish
8. Secret freak mode
9. Seeded demo account, final polish

Feature freeze at 09:00 on Sunday. After that: bug fixes and demo prep only.

## Commands
- `npm run dev`: local dev server
- `npm run build`: must pass before committing
- `npm run lint`
