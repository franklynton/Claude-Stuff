# AI Tomodachi

HackNotts '26 (Y2K theme). A Tamagotchi / Club Penguin-style web app where you raise an AI "millennium bug" pet that survived 1999. See `CLAUDE.md` for the stack, data model and priorities.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for real AI chat
npm run dev                  # http://localhost:3000
```

Without an API key, the chat replies with canned lines so the demo still works.
