# ✈️ Let's Go Japan

> 8 วัน · 6 จุดหมาย · ไม่รู้ลืม

A premium Japanese travel itinerary planner with real-time collaboration, interactive maps, and a warm terracotta aesthetic.

---

## ✨ Key Features

- **Interactive Map** — Leaflet.js-powered map with custom curved polylines connecting destinations
- **Day-by-Day Itinerary** — Sidebar card layout showing each day's place, activities, and travel info
- **Real-time Sync** — Supabase Realtime subscriptions keep all travelers in sync
- **Responsive Design** — Optimized for both desktop and mobile with touch-friendly zoom controls
- **Dark Mode** — Full dark theme support with high-contrast typography
- **Smooth Animations** — Staggered loading dots, map marker entrances, and popup transitions

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (no build step) |
| **Map** | Leaflet.js + Esri World Light Gray tiles |
| **Database** | Supabase (PostgreSQL + Realtime) |
| **Deployment** | Vercel |

---

## 📁 Project Structure

```
lets-go-japan-trip/
├── index.html          # Entry point, all modals inline
├── style.css          # Main stylesheet (~1.6K lines)
├── script.js          # Core app logic, map rendering
├── db.js              # Supabase client initialization
├── auth.js            # Magic link authentication overlay
├── realtime.js        # Supabase Realtime subscription
├── editor.js          # Day edit modal with optimistic locking
├── conflict.js        # Conflict resolution modal
├── selection.js       # Member selection modal
├── config.js          # Supabase credentials (gitignored)
├── favicon.svg        # Japan-themed favicon
├── vercel.json        # Vercel deployment config
└── supabase/
    ├── migrations/    # DB schema migrations
    └── seed.sql       # Initial data seeding
```

---

## 🚀 How to Run

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd lets-go-japan-trip
```

### 2. Configure Supabase

```bash
cp config.example.js config.js
```

Edit `config.js` and add your Supabase credentials:

```javascript
window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_KEY = 'your-anon-key';
window.TRIP_ITINERARY_ID = 'b8f5e2a1-0000-4000-8000-000000000001';
```

### 3. Start Local Server

Using VS Code Live Server (port 5500):

```bash
# Option A: VS Code extension
# Right-click index.html → Open with Live Server

# Option B: Python
python3 -m http.server 5500

# Option C: npx
npx serve .
```

### 4. Open in Browser

```
http://localhost:5500
```

---

## 🎨 Design System

| Element | Value |
|---------|-------|
| **Primary Color** | Terracotta Red (`#c85c3a`) |
| **Background** | Cream (`#f4edd8`) / Warm (`#faf7ee`) |
| **Typography** | Noto Sans Thai, Cormorant Garamond, Libre Baskerville |
| **Border Radius** | 14–20px (cards), 20px (buttons), 50% (icons) |
| **Dark Mode** | Inverted palette with stone-900 backgrounds |

---

## 📱 Responsive Breakpoints

- **Desktop** (`> 640px`) — Sidebar + map side-by-side
- **Mobile** (`≤ 640px`) — Bottom sheet drawer for day list, floating zoom controls

---

## 🔧 Database Schema (Supabase)

Key tables:

- `days` — Stores itinerary items with JSONB `details` column
- Real-time subscriptions on `days` table for instant updates

Run migrations in `supabase/migrations/` via Supabase SQL Editor.

---

## 📄 License

MIT — Feel free to fork and customize for your own trip!

---

_Made with 🍵 and 🗾 for the Japan 2026 adventure_