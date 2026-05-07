@AGENT.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Overview

- Small static single-page app (Vanilla JS) for a collaborative Japan trip itinerary. Backed by Supabase (Postgres + Realtime + Auth). UI language: Thai (ภาษาไทย).
- No bundler or npm build step by default — files are served statically from the repository root (index.html + scripts).

Quick commands

- Serve locally (no build):
  - npx serve .
  - or open index.html directly in a browser
- Runtime config (required):
  - Copy and edit config.example.js → config.js and fill Supabase credentials before running locally. (config.js is gitignored in this repo.)
  - On Vercel the repo uses vercel.json to write a runtime config.js at build time (see Deploy below).
- If you add a package.json (for tooling or migration), typical commands we use when migrating to Vite/React/TS are: (example)
  - pnpm init -y
  - pnpm create vite@latest . -- --template react-ts
  - pnpm install
  - pnpm dev
  - pnpm build

Deploy / hosting

- Vercel: vercel.json contains a buildCommand that echoes env values into config.js and sets outputDirectory: "." — note this behavior when changing build tooling.
- Database migrations and seed: Located in supabase/migrations/ and supabase/seed.sql; these are intended to be run in the Supabase SQL Editor (no CLI migration runner in repo).

High-level architecture (big-picture)

- Single-entry static HTML: index.html loads a small set of ordered scripts and assets.
- Script load order matters (the app relies on globals):
  - config.js → db.js → auth.js → realtime.js → editor.js → conflict.js → script.js
- File responsibilities (high-level):
  - index.html — entry point and modal markup
  - config.example.js — runtime values (SUPABASE URL/KEY, TRIP_ITINERARY_ID)
  - db.js — Supabase client initialization and loadDays()
  - auth.js — magic-link sign-in overlay and auth flows
  - realtime.js — Supabase Realtime subscription logic for the days table
  - editor.js — day edit modal and optimistic update RPC calls
  - conflict.js — conflict resolution modal and overwrite/discard UI
  - script.js — core UI rendering, global state (DAYS, map, markers, curIdx), renderSidebar, renderMap, goTo

Key conventions and patterns (stay specific)

- DOM helpers: Use el(tag, cls, text) and append(parent, ...children) consistently. Avoid innerHTML for user data to prevent XSS.
- Global state: The app uses globals (DAYS, map, markers, curIdx). editor.js sets window.\_editingDayId to suppress realtime updates while editing. Be aware when refactoring to modules.
- Modals: Toggle with .classList.add/remove('hidden') — CSS maps hidden → display:none.
- details JSONB shape: { place, jp, lat, lng, acts[], badges[], travel }
- Optimistic locking: update_day_if_version RPC returns { ok: false, error: 'conflict', current: row } on version mismatch; conflict.js handles this flow.
- Hard-coded itinerary ID: window.TRIP_ITINERARY_ID = 'b8f5e2a1-0000-4000-8000-000000000001' (set via config.js).

Pitfalls / gotchas specific to this repo

- There is no package.json by default. If you add tooling (ESLint, Vite, tests), create package.json and a lockfile first; remove stale node_modules before installing to avoid mismatched state.
- Adding a new JS file: remember to add it to index.html in the correct position in the load order — failing to respect order introduces runtime errors.
- No error boundaries: initApp() will throw uncaught errors if loadDays() fails. When changing load flows, add robust error handling around DB calls.
- Map + realtime are migration hotspots: Leaflet + Supabase realtime interactions are the most complex parts to refactor — treat them as separate integration tasks.

When to change tech vs. when to stay vanilla

- This repo is intentionally vanilla and small; migrating to React/Vite/TS is recommended when the codebase will grow, more contributors join, or stricter typing/testing is required. For short-term fixes or small features, refactor modules and add tests instead of migrating.

Notes for future Claude sessions (what helps)

- If editing code, show exact file paths and line ranges for targeted edits (e.g. script.js:120-180).
- If planning a migration, include a short inventory of which UI pieces should move first (Editor modal is a good candidate).
- If you will change deployment (Vite build → dist), include the current vercel.json content and desired outputDirectory so CLAUDE can suggest correct buildCommand changes.

Where to look next (quick references)

- Migrations & seed: supabase/migrations/ and supabase/seed.sql
- Dev entry: index.html and the ordered scripts listed in the architecture section
- Runtime config: config.example.js

This CLAUDE.md intentionally focuses on repository-specific commands, architecture, and non-obvious gotchas to help future Claude Code runs be efficient and safe.
