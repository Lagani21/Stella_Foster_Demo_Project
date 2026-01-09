# Shanti Voice AI Demo Project

Voice-first AI companion named Shanti with session history, insights, and function calling.

## Prerequisites

- Node.js 20.9+ (recommended)
- npm
- SQLite (bundled via Prisma)

## Environment Variables

Create `.env.local` in the project root:

```
OPENAI_API_KEY=your_openai_key
DEEPGRAM_API_KEY=your_deepgram_key
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret
```

Notes:
- `DATABASE_URL` points to `prisma/dev.db`.
- You can generate a secret with `openssl rand -base64 32`.

## Install

```
npm install
```

## Database Setup

```
npx prisma migrate dev
```

Optional:
```
npx prisma studio
```

### Prisma Notes

- Prisma schema lives at `prisma/schema.prisma`.
- SQLite database is stored at `prisma/dev.db` (from `DATABASE_URL="file:./dev.db"`).
- To reset the database, delete `prisma/dev.db` and rerun `npx prisma migrate dev`.

## Run Locally

```
npm run dev
```

Open `http://localhost:3000`.

## Project Structure

- `app/` UI + API routes
- `app/hooks/` client hooks (voice, transcription, tools)
- `app/components/` UI components
- `prisma/` schema and migrations

## Function Calls Implemented

- `log_emotional_state`
- `externalize_thoughts`
- `save_session`
- `retrieve_related_sessions`
- `park_worry_for_later`

## Delight Functions (Future Vision)

These are documented as a future roadmap and are not implemented yet.

### guided_grounding_exercise

```json
{
  "exercise_type": "box_breathing",
  "duration_seconds": 60
}
```

### detect_emotional_pattern

```json
{
  "pattern": "Overwhelm peaks before deadlines",
  "confidence": 0.82
}
```

## Known Bugs

- Realtime audio can stop playing after the first response in some browsers; refresh reconnects the WebRTC session.
- Tool calls sometimes require a second follow-up response to get audio if the model returns only function-call output first.
- Rate limits can surface during heavy STT usage; responses may delay or fail until limits reset.

## Future Work

- Make tool routing deterministic with explicit tool triggers or server-side tool orchestration.
- Improve reconnect logic for Realtime sessions and audio playback resilience.
- Add export/download of sessions and insights.
- Build a mobile app for easier, on-the-go access.
- Add reminders for sessions users asked to revisit later.
