# Luna Estimator

A fullstack estimating app for Luna Paint & Drywall with Supabase auth/storage, Supabase-backed project persistence, and a Hono + tRPC API.

## Features

- Supabase auth on the client and token-verified Supabase auth on the server
- Supabase-backed persistence for projects, rooms, line items, and media
- Supabase Storage uploads for photos, signatures, AI renders, and PDFs
- GoHighLevel sync for estimates and opportunities
- Mobile-first estimating flow for projects, rooms, pricing, PDFs, and signatures

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- tRPC 11 + Hono
- Supabase Auth + Database + Storage
- React Router v7
- GoHighLevel API

## Quick Start

1. Clone / extract this template
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`
4. Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
5. In Supabase SQL editor, run [`supabase/schema.sql`](/Users/brianpierce/Desktop/Luna Drywall and Paint Website/Estimator (Luna)/app/supabase/schema.sql)
6. Run the dev server: `npm run dev`
7. Build for production: `npm run build`

## Configuration

Content is edited in two places — do not modify component files:

- **`src/config.ts`** — site title, header labels, background options, sidebar / editor / graph UI strings, moon phase labels, and `starterNotes` (shown to unauthenticated users and as a local fallback)
- **`api/notes-router.ts`** — the server-side `STARTER_NOTES` array, auto-seeded into MySQL for each new user on first login

See `info.md` (outer folder) for every config field with constraints.

## Supabase Schema

Primary application tables live in [`supabase/schema.sql`](/Users/brianpierce/Desktop/Luna Drywall and Paint Website/Estimator (Luna)/app/supabase/schema.sql):

- `projects`
- `rooms`
- `line_items`
- `media`

## Required Assets

No images or videos required — every background is procedural (WebGL / Canvas). Content is plain Markdown.

## Project Structure

```
.
├── api/                # tRPC routers, Hono server, Kimi OAuth, notes router with STARTER_NOTES
├── contracts/          # Shared tRPC types between server and client
├── db/                 # Drizzle schema, migrations, seed
├── public/             # Static assets
├── src/
│   ├── components/     # UI components (editor, sidebar, graph, backgrounds, moon widget)
│   ├── hooks/          # Custom hooks (notes, auth)
│   ├── config.ts       # All editable UI strings and starter notes (client)
│   ├── store.ts        # localStorage fallback store
│   └── App.tsx         # Root component
├── Dockerfile
├── drizzle.config.ts
├── .backend-features.json  # Declares ["auth", "db"]
└── .env.example
```

## Design

- Background: `#000000` or one of four cinematic WebGL / Canvas modes
- Foreground text: `#e0e0e0`
- Accent: `#c8956c` (warm amber) · Link color: `#d4a574`
- UI: liquid-glass frosted panels

## Notes

- The server now uses Supabase for auth verification and persistence, so no separate MySQL database is required.
- The old notes/Drizzle template files are still present in the repo for legacy content, but the active estimator flow persists through Supabase.
