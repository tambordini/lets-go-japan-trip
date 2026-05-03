# Japan Trip Itinerary — Agent Guide

Collaborative trip planner for ~10 friends. Vanilla JS static site, no bundler, no npm. Backed by Supabase (Postgres + Realtime + Auth). UI language is Thai (ภาษาไทย).

## Local Dev

No build step. Serve files statically:

```sh
npx serve .
# or open index.html directly in a browser
```

**Required:** Copy `config.example.js` → `config.js` and fill in Supabase credentials. Without it, the app silently fails (`window.SUPABASE_URL` is undefined). `config.js` is gitignored.

## Deploy

Push to Vercel. `vercel.json` injects env vars as `config.js` at build time — no manual step needed.

## Database

Migrations and seed are run manually in the Supabase SQL Editor (no CLI runner):

- Migrations: `supabase/migrations/` — run in order
- Seed: `supabase/seed.sql` — requires an active Supabase session (`auth.uid()` used as owner)

## Architecture

| File          | Role                                                          |
| ------------- | ------------------------------------------------------------- |
| `index.html`  | Single entry point; all modals inline                         |
| `script.js`   | Core app: `DAYS` global, `renderSidebar`, `renderMap`, `goTo` |
| `db.js`       | Supabase client init + `loadDays()`                           |
| `auth.js`     | Magic link sign-in overlay                                    |
| `realtime.js` | Supabase Realtime subscription on `days` table                |
| `editor.js`   | Day edit modal + optimistic lock RPC call                     |
| `conflict.js` | Conflict resolution modal (overwrite vs discard)              |

**Script load order matters** (no ES modules, CDN globals):
`config.js` → `db.js` → `auth.js` → `realtime.js` → `editor.js` → `conflict.js` → `script.js`

## Key Conventions

- **DOM helpers:** Use `el(tag, cls, text)` and `append(parent, ...children)` — never `innerHTML` for user data (XSS prevention)
- **Global state:** `DAYS`, `map`, `markers`, `curIdx` live in `script.js`; set `window._editingDayId` in `editor.js` to suppress realtime UI updates while editing
- **Modals:** Toggle with `.classList.add/remove('hidden')` — `hidden` maps to `display:none` in CSS
- **`details` JSONB shape:** `{ place, jp, lat, lng, acts[], badges[], travel }`
- **Optimistic locking:** Via `update_day_if_version` RPC — returns `{ ok: false, error: "conflict", current: row }` on version mismatch; handled by `conflict.js`
- **Hard-coded itinerary ID:** `window.TRIP_ITINERARY_ID = 'b8f5e2a1-0000-4000-8000-000000000001'` (set in config)

## Pitfalls

- Adding a new JS file? Add it to `index.html` in the correct load order position
- No error boundaries — `initApp()` throws uncaught if `loadDays()` fails
- `editor.js` currently passes `p_actor: null` to the RPC (not the user ID) — minor inconsistency vs the plan docs
