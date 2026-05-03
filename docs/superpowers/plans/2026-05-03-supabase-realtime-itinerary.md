# Supabase Realtime Itinerary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม Supabase backend ให้แอพ Japan trip เพื่อให้ผู้ใช้ ~10 คน สามารถดู/เพิ่ม/แก้แผนแบบ realtime พร้อม optimistic locking กัน race condition

**Architecture:** Vanilla JS + Supabase JS CDN; DB schema: itineraries + days (jsonb details, version column); client subscribes to Realtime changes; updates ผ่าน Postgres RPC (transactional, optimistic lock); conflict ใช้ manual merge modal

**Tech Stack:** Supabase JS v2 (CDN), Supabase Postgres (hosted), Supabase Realtime, Supabase Auth (magic link), Leaflet (existing), Vanilla JS (no build tools)

---

## File Map

| ไฟล์ | สถานะ | หน้าที่ |
|------|-------|---------|
| `supabase/migrations/001_schema.sql` | สร้างใหม่ | CREATE TABLE itineraries, days |
| `supabase/migrations/002_rpc.sql` | สร้างใหม่ | update_day_if_version RPC function |
| `supabase/migrations/003_rls.sql` | สร้างใหม่ | Row-Level Security policies |
| `supabase/seed.sql` | สร้างใหม่ | Seed ข้อมูล Japan trip 8 วัน |
| `config.example.js` | สร้างใหม่ | Template สำหรับ config.js |
| `config.js` | สร้างใหม่ (gitignored) | SUPABASE_URL + ANON_KEY |
| `db.js` | สร้างใหม่ | Supabase client init + loadDays() |
| `auth.js` | สร้างใหม่ | Sign-in overlay (magic link email) |
| `realtime.js` | สร้างใหม่ | Subscribe days channel, apply events |
| `editor.js` | สร้างใหม่ | Day edit modal (open/save/close) |
| `conflict.js` | สร้างใหม่ | Conflict merge modal |
| `script.js` | แก้ไข | ลบ hardcoded ITINERARY, ใช้ async initApp() |
| `index.html` | แก้ไข | เพิ่ม Supabase CDN + script tags ใหม่ |
| `style.css` | แก้ไข | เพิ่ม style: auth overlay, editor modal, conflict modal |
| `.gitignore` | แก้ไข | เพิ่ม config.js |

---

## Task 1: SQL Schema Migration

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: สร้างไฟล์ migration schema**

```sql
-- supabase/migrations/001_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid REFERENCES itineraries(id) ON DELETE CASCADE NOT NULL,
  day_index integer NOT NULL,
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  version integer NOT NULL DEFAULT 1,
  UNIQUE(itinerary_id, day_index)
);
```

- [ ] **Step 2: รัน migration บน Supabase dashboard**

ไปที่ Supabase project → SQL Editor → paste code ด้านบน → Run

ตรวจผลลัพธ์ใน Table Editor: ควรเห็น `itineraries` และ `days` tables

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "feat(db): add itineraries and days schema"
```

---

## Task 2: RPC Function (Optimistic Lock)

**Files:**
- Create: `supabase/migrations/002_rpc.sql`

- [ ] **Step 1: สร้างไฟล์ RPC**

```sql
-- supabase/migrations/002_rpc.sql

CREATE OR REPLACE FUNCTION update_day_if_version(
  p_id uuid,
  p_expected_version int,
  p_changes jsonb,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_version int;
  result_row days%ROWTYPE;
BEGIN
  SELECT version INTO current_version
  FROM days WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF current_version != p_expected_version THEN
    SELECT * INTO result_row FROM days WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'conflict',
      'current', row_to_json(result_row)::jsonb
    );
  END IF;

  UPDATE days SET
    details = p_changes,
    version = version + 1,
    updated_by = p_actor,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO result_row;

  RETURN jsonb_build_object('ok', true, 'row', row_to_json(result_row)::jsonb);
END;
$$;
```

- [ ] **Step 2: รัน บน Supabase SQL Editor**

ตรวจว่า function ถูกสร้างใน Database → Functions → `update_day_if_version`

- [ ] **Step 3: ทดสอบ RPC manually ใน SQL Editor**

```sql
-- ทดสอบด้วย version ผิด → ต้องได้ conflict
SELECT update_day_if_version(
  '<day-uuid>',
  999,
  '{"place": "test"}'::jsonb,
  auth.uid()
);
-- คาดหวัง: {"ok": false, "error": "conflict", "current": {...}}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_rpc.sql
git commit -m "feat(db): add update_day_if_version RPC with optimistic lock"
```

---

## Task 3: RLS Policies

**Files:**
- Create: `supabase/migrations/003_rls.sql`

- [ ] **Step 1: สร้างไฟล์ RLS**

```sql
-- supabase/migrations/003_rls.sql

ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE days ENABLE ROW LEVEL SECURITY;

-- itineraries: ทุกคนที่ล็อกอินอ่านได้; เฉพาะ owner สร้าง/ลบ
CREATE POLICY "itineraries_select" ON itineraries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "itineraries_insert" ON itineraries
  FOR INSERT TO authenticated WITH CHECK (owner = auth.uid());

CREATE POLICY "itineraries_delete" ON itineraries
  FOR DELETE TO authenticated USING (owner = auth.uid());

-- days: ทุกคนที่ล็อกอินอ่าน/เพิ่ม/แก้ได้ (trip ของกลุ่มเพื่อน)
CREATE POLICY "days_select" ON days
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "days_insert" ON days
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "days_update" ON days
  FOR UPDATE TO authenticated USING (true);
```

- [ ] **Step 2: รัน บน Supabase SQL Editor**

ตรวจใน Authentication → Policies: ควรเห็น policy 5 อัน

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_rls.sql
git commit -m "feat(db): add RLS policies for itineraries and days"
```

---

## Task 4: Seed ข้อมูล Japan Trip

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: สร้างไฟล์ seed**

```sql
-- supabase/seed.sql
-- หมายเหตุ: รัน seed ผ่าน Supabase SQL Editor ขณะล็อกอินอยู่

INSERT INTO itineraries (id, owner, title)
VALUES (
  'b8f5e2a1-0000-4000-8000-000000000001',
  auth.uid(),
  'Japan Trip 2026'
);

INSERT INTO days (itinerary_id, day_index, title, details) VALUES
('b8f5e2a1-0000-4000-8000-000000000001', 1, 'Tokyo (Day 1)',
  '{"place":"Tokyo","jp":"\u6771\u4eac","lat":35.6762,"lng":139.6503,"acts":["\u0e16\u0e36\u0e07\u0e0d\u0e35\u0e48\u0e1b\u0e38\u0e48\u0e19 \u2708","\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19\u0e42\u0e23\u0e07\u0e41\u0e23\u0e21","\u0e40\u0e14\u0e34\u0e19\u0e40\u0e25\u0e48\u0e19\u0e2a\u0e33\u0e23\u0e27\u0e08\u0e23\u0e2d\u0e1a\u0e46"],"badges":[{"label":"Arrival","cls":"city"}],"travel":null}'::jsonb),

('b8f5e2a1-0000-4000-8000-000000000001', 2, 'Kamakura',
  '{"place":"Kamakura","jp":"\u9e0c\u5009","lat":35.3192,"lng":139.5467,"acts":["\u0e1e\u0e23\u0e30\u0e43\u0e2b\u0e0d\u0e48 Kotoku-in","Hase-dera Temple","Komachi-dori \u0e0a\u0e49\u0e2d\u0e1b\u0e1b\u0e34\u0e49\u0e07"],"badges":[{"label":"Temple","cls":"nature"},{"label":"Culture","cls":""}],"travel":{"icon":"\ud83d\ude83","time":"~1.5 \u0e0a\u0e21."}}'::jsonb),

('b8f5e2a1-0000-4000-8000-000000000001', 3, 'Tokyo Disneyland',
  '{"place":"Tokyo Disneyland","jp":"\u30c7\u30a3\u30ba\u30cb\u30fc\u30e9\u30f3\u30c9","lat":35.6329,"lng":139.8804,"acts":["\u0e2a\u0e27\u0e19\u0e2a\u0e19\u0e38\u0e01\u0e40\u0e15\u0e47\u0e21\u0e27\u0e31\u0e19 \ud83c\udfa2","Parades & Shows","Disney magic!"],"badges":[{"label":"Theme Park","cls":"fun"}],"travel":{"icon":"\ud83d\ude83","time":"~40 \u0e19\u0e32\u0e17\u0e35"}}'::jsonb),

('b8f5e2a1-0000-4000-8000-000000000001', 4, 'Mt. Fuji',
  '{"place":"Mt. Fuji","jp":"\u5bcc\u58eb\u5c71","lat":35.4600,"lng":138.7274,"acts":["Kawaguchiko \u0e17\u0e30\u0e40\u0e25\u0e2a\u0e32\u0e1a","Chureito Pagoda","Oshino Hakkai"],"badges":[{"label":"Nature","cls":"nature"},{"label":"Iconic","cls":""}],"travel":{"icon":"\ud83d\ude97","time":"~2.5 \u0e0a\u0e21."}}'::jsonb),

('b8f5e2a1-0000-4000-8000-000000000001', 5, 'Matsumoto to Hakuba',
  '{"place":"Matsumoto \u2192 Hakuba","jp":"\u677e\u672c\u57ce \u2192 \u767d\u99ac","lat":36.2389,"lng":137.9681,"acts":["Matsumoto Castle \ud83c\udfef","\u0e02\u0e31\u0e1a\u0e1c\u0e48\u0e32\u0e19\u0e40\u0e17\u0e37\u0e2d\u0e01\u0e40\u0e02\u0e32\u0e41\u0e2d\u0e25\u0e4c\u0e1b\u0e4c","\u0e40\u0e0a\u0e47\u0e04\u0e2d\u0e34\u0e19 Hakuba"],"badges":[{"label":"Castle","cls":""},{"label":"Scenic Drive","cls":"snow"}],"travel":{"icon":"\ud83d\ude97","time":"~4.5-5 \u0e0a\u0e21."}}'::jsonb),

('b8f5e2a1-0000-4000-8000-000000000001', 6, 'Hakuba Ski Day',
  '{"place":"Hakuba","jp":"\u767d\u99ac","lat":36.6989,"lng":137.8670,"acts":["\u0e40\u0e25\u0e48\u0e19\u0e2a\u0e01\u0e35\u0e40\u0e15\u0e47\u0e21\u0e27\u0e31\u0e19 \u26f7","\u0e2d\u0e2d\u0e19\u0e40\u0e0b\u0e47\u0e19\u0e22\u0e32\u0e21\u0e40\u0e22\u0e47\u0e19 \u2668","\u0e1e\u0e31\u0e01\u0e1c\u0e48\u0e2d\u0e19\u0e17\u0e48\u0e32\u0e21\u0e01\u0e25\u0e32\u0e07\u0e2b\u0e34\u0e21\u0e30"],"badges":[{"label":"Skiing","cls":"snow"},{"label":"Onsen","cls":"nature"}],"travel":null}'::jsonb),

('b8f5e2a1-0000-4000-8000-000000000001', 7, 'Hakuba to Tokyo',
  '{"place":"Hakuba \u2192 Tokyo","jp":"\u5e30\u308a\u9053","lat":36.10,"lng":138.40,"acts":["\u0e04\u0e37\u0e19\u0e23\u0e16\u0e40\u0e0a\u0e48\u0e32","\u0e02\u0e31\u0e1a\u0e23\u0e16\u0e01\u0e25\u0e31\u0e1a Tokyo \u0e22\u0e32\u0e21\u0e04\u0e48\u0e33","\u0e1a\u0e2d\u0e01\u0e25\u0e32\u0e2b\u0e34\u0e21\u0e30 \ud83c\udf19"],"badges":[{"label":"Night Drive","cls":"snow"}],"travel":{"icon":"\ud83d\ude97","time":"~4.5-5 \u0e0a\u0e21."}}'::jsonb),

('b8f5e2a1-0000-4000-8000-000000000001', 8, 'Tokyo Last Day',
  '{"place":"Tokyo","jp":"\u6771\u4eac","lat":35.6896,"lng":139.7023,"acts":["\u0e0a\u0e49\u0e2d\u0e1b\u0e1b\u0e34\u0e49\u0e07\u0e27\u0e31\u0e19\u0e2a\u0e38\u0e14\u0e17\u0e49\u0e32\u0e22 \ud83d\uded2","Illumination \u0e22\u0e32\u0e21\u0e04\u0e48\u0e33 \u2728","See you again, Japan \ud83c\uddef\ud83c\uddf5"],"badges":[{"label":"Shopping","cls":"city"},{"label":"Night Out","cls":""}],"travel":null}'::jsonb);
```

- [ ] **Step 2: รัน seed บน Supabase SQL Editor ขณะล็อกอินอยู่**

ตรวจ Table Editor → days: ควรเห็น 8 rows

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): add Japan trip seed data (8 days)"
```

---

## Task 5: Config + Supabase Client

**Files:**
- Create: `config.example.js`
- Create: `config.js` (gitignored)
- Create: `db.js`
- Modify: `.gitignore`

- [ ] **Step 1: เพิ่ม config.js ใน .gitignore**

เพิ่มบรรทัดนี้ใน `.gitignore`:
```
config.js
```

- [ ] **Step 2: สร้าง config.example.js**

```js
// config.example.js
// คัดลอกไฟล์นี้เป็น config.js แล้วใส่ค่าจาก Supabase project → Settings → API
window.SUPABASE_URL = 'https://your-project-ref.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key-here';
window.TRIP_ITINERARY_ID = 'b8f5e2a1-0000-4000-8000-000000000001';
```

- [ ] **Step 3: สร้าง config.js (ใส่ค่าจริงจาก Supabase dashboard)**

```js
// config.js  — อย่า commit ไฟล์นี้
window.SUPABASE_URL = 'https://<ref>.supabase.co';
window.SUPABASE_ANON_KEY = '<anon-key>';
window.TRIP_ITINERARY_ID = 'b8f5e2a1-0000-4000-8000-000000000001';
```

- [ ] **Step 4: สร้าง db.js**

```js
// db.js
const { createClient } = supabase;
const db = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

async function loadDays() {
  const { data, error } = await db
    .from('days')
    .select('*')
    .eq('itinerary_id', window.TRIP_ITINERARY_ID)
    .order('day_index', { ascending: true });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 5: Commit**

```bash
git add config.example.js db.js .gitignore
git commit -m "feat(client): add Supabase client init and loadDays()"
```

---

## Task 6: Auth (Magic Link)

**Files:**
- Create: `auth.js`
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: เพิ่ม Supabase CDN ใน index.html (ใน head ก่อน style.css)**

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

แก้ script tags ก่อน `</body>` ให้เป็น:
```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="config.js"></script>
<script src="db.js"></script>
<script src="auth.js"></script>
<script src="realtime.js"></script>
<script src="editor.js"></script>
<script src="conflict.js"></script>
<script src="script.js"></script>
```

เพิ่ม auth overlay ใน body (ก่อน div#petals):
```html
<div id="auth-overlay" class="auth-overlay hidden">
  <div class="auth-box">
    <div class="stamp">
      <span class="stamp-top">TRIP</span>
      <span class="stamp-jp">日本</span>
    </div>
    <h2 class="auth-title">Let's Go Japan</h2>
    <p class="auth-desc">ใส่อีเมลเพื่อเข้าร่วมทริป</p>
    <input type="email" id="auth-email" class="auth-input" placeholder="your@email.com" />
    <button id="auth-btn" class="auth-submit">ส่ง Magic Link</button>
    <p id="auth-msg" class="auth-feedback"></p>
  </div>
</div>
```

- [ ] **Step 2: เพิ่ม style auth overlay ใน style.css**

```css
.auth-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(250, 246, 240, 0.97);
  display: flex; align-items: center; justify-content: center;
}
.auth-overlay.hidden { display: none; }
.auth-box {
  text-align: center; padding: 2.5rem 2rem;
  background: #fff; border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.10);
  max-width: 340px; width: 90%;
}
.auth-title { font-size: 1.4rem; margin: 1rem 0 0.25rem; }
.auth-desc { color: #888; font-size: 0.85rem; margin-bottom: 1.2rem; }
.auth-input {
  width: 100%; padding: 0.65rem 1rem; border-radius: 8px;
  border: 1px solid #ddd; font-size: 0.95rem; margin-bottom: 0.75rem;
  box-sizing: border-box;
}
.auth-submit {
  width: 100%; padding: 0.7rem; background: #C85C3A; color: #fff;
  border: none; border-radius: 8px; font-size: 0.95rem; cursor: pointer;
}
.auth-feedback { font-size: 0.82rem; margin-top: 0.75rem; color: #666; }
```

- [ ] **Step 3: สร้าง auth.js**

```js
// auth.js
async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) return session.user;

  const overlay = document.getElementById('auth-overlay');
  overlay.classList.remove('hidden');

  return new Promise((resolve) => {
    document.getElementById('auth-btn').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const msg = document.getElementById('auth-msg');
      if (!email) { msg.textContent = 'กรุณาใส่อีเมล'; return; }

      msg.textContent = 'กำลังส่ง...';
      const { error } = await db.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href }
      });

      if (error) { msg.textContent = 'เกิดข้อผิดพลาด: ' + error.message; return; }
      msg.textContent = 'ส่ง Magic Link ไปที่ ' + email + ' แล้ว!';
    });

    db.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        overlay.classList.add('hidden');
        resolve(session.user);
      }
    });
  });
}
```

- [ ] **Step 4: ทดสอบ manual**

เปิดแอพ → เห็น auth overlay → ใส่อีเมล → รับ magic link → คลิก → overlay หายไป แสดงแผนที่

- [ ] **Step 5: Commit**

```bash
git add auth.js index.html style.css
git commit -m "feat(auth): add magic link sign-in overlay"
```

---

## Task 7: Refactor script.js ให้โหลดจาก Supabase

**Files:**
- Modify: `script.js`

- [ ] **Step 1: แทนที่ hardcoded ITINERARY ทั้งหมดด้วย async initApp()**

ลบบรรทัด 1–74 (const ITINERARY) และ code ที่รันทันทีทั้งหมด

เขียน script.js ใหม่ทั้งหมด:

```js
// script.js
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function append(parent, ...children) {
  children.forEach(c => parent.appendChild(c));
  return parent;
}

let DAYS = [];
let map, markers = [], curIdx = null;

function renderSidebar(days) {
  const listEl = document.getElementById('dayList');
  listEl.textContent = '';
  days.forEach((d, i) => {
    const det = d.details;
    const item = el('div', 'day-item');
    item.dataset.i = i;
    item.style.animationDelay = `${i * 0.07 + 0.1}s`;

    const pin = append(el('div', 's-pin'), el('span', 's-pin-num', String(i + 1)));
    const info = el('div', 'day-info');
    const meta = el('div', 'day-meta');
    (det.badges || []).forEach(b =>
      meta.appendChild(el('span', ('badge ' + (b.cls || '')).trim(), b.label))
    );
    if (det.travel) {
      meta.appendChild(el('span', 'travel-tag', det.travel.icon + ' ' + det.travel.time));
    }

    const editBtn = el('button', 'edit-day-btn', '\u270f\ufe0f');
    editBtn.title = 'แก้ไขแผนวันนี้';
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditor(d); });

    append(info, el('div', 'day-place', det.place), el('div', 'day-detail', (det.acts || [])[0] || ''), meta);
    append(item, pin, info, editBtn);
    item.addEventListener('click', () => goTo(i));
    listEl.appendChild(item);
  });
}

function buildPopup(d, i) {
  const det = d.details;
  const pop = el('div', 'pop');
  append(pop,
    el('div', 'pop-label', 'Day ' + (i + 1)),
    el('div', 'pop-title', det.place),
    el('div', 'pop-jp', det.jp),
  );
  const acts = el('ul', 'pop-acts');
  (det.acts || []).forEach(a => acts.appendChild(el('li', null, a)));
  pop.appendChild(acts);
  if (det.travel) {
    pop.appendChild(el('div', 'pop-travel',
      det.travel.icon + ' เดินทาง ' + det.travel.time + ' จากจุดก่อนหน้า'));
  }
  return pop;
}

function renderMap(days) {
  if (!map) {
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([36, 138.5], 7);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
      attribution: '\u00a9 <a href="https://carto.com">CARTO</a>',
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const coords = days.map(d => [d.details.lat, d.details.lng]);
  if (window._routeLine) map.removeLayer(window._routeLine);
  window._routeLine = L.polyline(coords, {
    color: '#C85C3A', weight: 1.5, opacity: 0.5, dashArray: '5 7',
  }).addTo(map);

  setTimeout(() => {
    const svgPath = window._routeLine.getElement();
    if (!svgPath) return;
    let offset = 0;
    (function march() {
      offset -= 0.5;
      svgPath.style.strokeDashoffset = offset;
      requestAnimationFrame(march);
    })();
  }, 500);

  days.forEach((d, i) => {
    // Leaflet divIcon: html ใช้ตัวเลข i+1 เท่านั้น (ไม่ใช่ user input)
    const mkDiv = document.createElement('div');
    mkDiv.className = 'mk';
    mkDiv.id = 'mk' + i;
    const mkSpan = document.createElement('span');
    mkSpan.className = 'mn';
    mkSpan.textContent = String(i + 1);
    mkDiv.appendChild(mkSpan);

    const icon = L.divIcon({
      className: '',
      html: mkDiv.outerHTML,
      iconSize: [34, 42], iconAnchor: [17, 41], popupAnchor: [0, -44],
    });

    const m = L.marker([d.details.lat, d.details.lng], { icon })
      .bindPopup(buildPopup(d, i), { maxWidth: 280 })
      .addTo(map);
    m.on('click', () => setActive(i));
    markers.push(m);
  });

  markers.forEach((_, i) => {
    const mkEl = document.getElementById('mk' + i);
    if (!mkEl) return;
    mkEl.style.opacity = '0';
    mkEl.style.transform = 'rotate(-45deg) scale(0.2)';
    mkEl.style.transition = 'opacity 0.4s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => {
      mkEl.style.opacity = '1';
      mkEl.style.transform = 'rotate(-45deg) scale(1)';
    }, 400 + i * 110);
  });

  map.fitBounds(L.latLngBounds(coords), { padding: [40, 60] });
}

function setActive(i) {
  document.querySelectorAll('.day-item').forEach(e => e.classList.remove('active'));
  const activeItem = document.querySelectorAll('.day-item')[i];
  if (activeItem) {
    activeItem.classList.add('active');
    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (curIdx !== null) {
    const prev = document.getElementById('mk' + curIdx);
    if (prev) prev.classList.remove('on');
  }
  const cur = document.getElementById('mk' + i);
  if (cur) cur.classList.add('on');
  curIdx = i;
}

function goTo(i) {
  map.flyTo([DAYS[i].details.lat, DAYS[i].details.lng], 12, { duration: 1.1 });
  map.once('moveend', () => markers[i].openPopup());
  setActive(i);
  if (window.innerWidth <= 640 && window._closeMobileDrawer) window._closeMobileDrawer();
}

const FLOATIES = ['\ud83c\udf38', '\ud83c\udf38', '\ud83c\udf38', '\u2744\ufe0f', '\u2744\ufe0f', '\ud83c\udf38'];
function spawnPetal() {
  const container = document.getElementById('petals');
  const petal = el('span', 'p', FLOATIES[Math.floor(Math.random() * FLOATIES.length)]);
  petal.style.left = (Math.random() * 100) + 'vw';
  petal.style.fontSize = (10 + Math.random() * 9) + 'px';
  petal.style.animationDuration = (7 + Math.random() * 8) + 's';
  petal.style.animationDelay = (Math.random() * 1.5) + 's';
  container.appendChild(petal);
  petal.addEventListener('animationend', () => petal.remove(), { once: true });
}
for (let i = 0; i < 14; i++) setTimeout(spawnPetal, i * 250);
setInterval(spawnPetal, 950);

(function initMobileDrawer() {
  const sidebar = document.querySelector('.sidebar');
  const header = document.querySelector('.header');
  const backdrop = document.createElement('div');
  backdrop.id = 'sidebar-backdrop';
  document.body.appendChild(backdrop);
  function isMobile() { return window.innerWidth <= 640; }
  function openDrawer() { sidebar.classList.add('open'); backdrop.classList.add('active'); }
  function closeDrawer() { sidebar.classList.remove('open'); backdrop.classList.remove('active'); }
  header.addEventListener('click', (e) => {
    if (!isMobile()) return;
    e.stopPropagation();
    sidebar.classList.contains('open') ? closeDrawer() : openDrawer();
  });
  backdrop.addEventListener('click', closeDrawer);
  window._closeMobileDrawer = closeDrawer;
})();

async function initApp() {
  const user = await initAuth();
  DAYS = await loadDays();
  renderSidebar(DAYS);
  renderMap(DAYS);
  initRealtime(user);
}

initApp();
```

- [ ] **Step 2: ทดสอบ manual**

เปิด browser → ล็อกอิน → คาดหวัง: เห็น sidebar + map เหมือนเดิม แต่ข้อมูลมาจาก Supabase

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat(client): load days from Supabase, refactor to async initApp"
```

---

## Task 8: Realtime Subscription

**Files:**
- Create: `realtime.js`

- [ ] **Step 1: สร้าง realtime.js**

```js
// realtime.js
function initRealtime(user) {
  db.channel('days-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'days',
      filter: 'itinerary_id=eq.' + window.TRIP_ITINERARY_ID,
    }, (payload) => {
      handleDayChange(payload, user);
    })
    .subscribe();
}

function handleDayChange(payload, currentUser) {
  const { eventType } = payload;
  const newRow = payload.new;
  const oldRow = payload.old;

  if (eventType === 'UPDATE') {
    const idx = DAYS.findIndex(d => d.id === newRow.id);
    if (idx === -1) return;
    if (window._editingDayId === newRow.id) {
      showServerUpdatedIndicator(newRow);
      return;
    }
    DAYS[idx] = newRow;
    renderSidebar(DAYS);
    renderMap(DAYS);
  }

  if (eventType === 'INSERT') {
    DAYS.push(newRow);
    DAYS.sort((a, b) => a.day_index - b.day_index);
    renderSidebar(DAYS);
    renderMap(DAYS);
  }

  if (eventType === 'DELETE') {
    DAYS = DAYS.filter(d => d.id !== oldRow.id);
    renderSidebar(DAYS);
    renderMap(DAYS);
  }
}

function showServerUpdatedIndicator(newRow) {
  const indicator = document.getElementById('editor-server-update');
  if (!indicator) return;
  indicator.textContent = '\u26a0\ufe0f ข้อมูลบน server เปลี่ยนแล้วขณะที่คุณกำลังแก้';
  indicator.dataset.pendingRow = JSON.stringify(newRow);
  indicator.style.display = 'block';
}
```

- [ ] **Step 2: ทดสอบ manual — เปิด 2 tabs**

Tab A: โหลดแอพ ล็อกอิน
Tab B: เปิด Supabase Table Editor → แก้ details ของ row ใด row หนึ่ง
Tab A: คาดหวัง: sidebar อัปเดตทันทีโดยไม่ต้อง reload

- [ ] **Step 3: Commit**

```bash
git add realtime.js
git commit -m "feat(realtime): subscribe to days changes and update UI"
```

---

## Task 9: Day Editor Modal

**Files:**
- Create: `editor.js`
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: เพิ่ม editor modal HTML ใน index.html (ก่อน </body>)**

```html
<div id="editor-modal" class="modal-overlay hidden">
  <div class="modal-box">
    <div class="modal-header">
      <h3 id="editor-title">แก้ไขแผน</h3>
      <button id="editor-close" class="modal-close">&#x2715;</button>
    </div>
    <p id="editor-server-update" class="server-update-notice" style="display:none"></p>
    <label class="modal-label">สถานที่
      <input type="text" id="editor-place" class="modal-input" />
    </label>
    <label class="modal-label">กิจกรรม (แต่ละบรรทัด = 1 กิจกรรม)
      <textarea id="editor-acts" class="modal-textarea" rows="4"></textarea>
    </label>
    <div class="modal-actions">
      <button id="editor-save" class="btn-primary">บันทึก</button>
      <button id="editor-cancel" class="btn-secondary">ยกเลิก</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: เพิ่ม modal styles ใน style.css**

```css
.modal-overlay {
  position: fixed; inset: 0; z-index: 150;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
}
.modal-overlay.hidden { display: none; }
.modal-box {
  background: #fff; border-radius: 14px; padding: 1.5rem;
  width: min(420px, 92vw); box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.modal-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #888; }
.modal-label { display: block; font-size: 0.82rem; color: #888; margin-bottom: 0.75rem; }
.modal-input, .modal-textarea {
  display: block; width: 100%; margin-top: 0.25rem; padding: 0.6rem 0.8rem;
  border: 1px solid #ddd; border-radius: 8px; font-size: 0.92rem; box-sizing: border-box;
}
.modal-textarea { resize: vertical; }
.modal-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; justify-content: flex-end; }
.btn-primary { background: #C85C3A; color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; }
.btn-secondary { background: #f5f5f5; color: #555; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; }
.server-update-notice { background: #fff8e1; color: #b26a00; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.82rem; margin-bottom: 0.75rem; }
.edit-day-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; padding: 0.2rem 0.4rem; opacity: 0.5; }
.edit-day-btn:hover { opacity: 1; }
```

- [ ] **Step 3: สร้าง editor.js**

```js
// editor.js
let _editingDay = null;

function openEditor(day) {
  _editingDay = day;
  window._editingDayId = day.id;
  const det = day.details;

  document.getElementById('editor-title').textContent = 'แก้ไข: ' + det.place;
  document.getElementById('editor-place').value = det.place || '';
  document.getElementById('editor-acts').value = (det.acts || []).join('\n');
  document.getElementById('editor-server-update').style.display = 'none';
  document.getElementById('editor-modal').classList.remove('hidden');
}

function closeEditor() {
  _editingDay = null;
  window._editingDayId = null;
  document.getElementById('editor-modal').classList.add('hidden');
}

async function saveEditor() {
  if (!_editingDay) return;
  const saveBtn = document.getElementById('editor-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'กำลังบันทึก...';

  const place = document.getElementById('editor-place').value.trim();
  const acts = document.getElementById('editor-acts').value
    .split('\n').map(s => s.trim()).filter(Boolean);

  const newDetails = Object.assign({}, _editingDay.details, { place, acts });
  const { data: userData } = await db.auth.getUser();

  const { data, error } = await db.rpc('update_day_if_version', {
    p_id: _editingDay.id,
    p_expected_version: _editingDay.version,
    p_changes: newDetails,
    p_actor: userData.user.id,
  });

  saveBtn.disabled = false;
  saveBtn.textContent = 'บันทึก';

  if (error) { alert('เกิดข้อผิดพลาด: ' + error.message); return; }
  if (!data.ok) {
    if (data.error === 'conflict') openConflictModal(_editingDay, newDetails, data.current);
    return;
  }

  const idx = DAYS.findIndex(d => d.id === _editingDay.id);
  if (idx !== -1) { DAYS[idx] = data.row; renderSidebar(DAYS); renderMap(DAYS); }
  closeEditor();
}

document.getElementById('editor-save').addEventListener('click', saveEditor);
document.getElementById('editor-cancel').addEventListener('click', closeEditor);
document.getElementById('editor-close').addEventListener('click', closeEditor);
```

- [ ] **Step 4: ทดสอบ manual**

คลิก ✏️ บน day → เห็น modal → แก้ชื่อสถานที่ → บันทึก → sidebar อัปเดตทันที

- [ ] **Step 5: Commit**

```bash
git add editor.js index.html style.css
git commit -m "feat(editor): add day edit modal with RPC save"
```

---

## Task 10: Conflict Modal

**Files:**
- Create: `conflict.js`
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: เพิ่ม conflict modal HTML ใน index.html (ก่อน </body>)**

```html
<div id="conflict-modal" class="modal-overlay hidden">
  <div class="modal-box">
    <div class="modal-header">
      <h3>&#x26A0;&#xFE0F; ข้อมูลถูกแก้โดยคนอื่น</h3>
      <button id="conflict-close" class="modal-close">&#x2715;</button>
    </div>
    <p class="conflict-desc">ข้อมูลใน server เปลี่ยนไปแล้วขณะที่คุณกำลังแก้</p>
    <div class="conflict-compare">
      <div class="conflict-col">
        <div class="conflict-col-label">ของคุณ</div>
        <pre id="conflict-mine" class="conflict-pre"></pre>
      </div>
      <div class="conflict-col">
        <div class="conflict-col-label">ล่าสุดใน server</div>
        <pre id="conflict-server" class="conflict-pre"></pre>
      </div>
    </div>
    <div class="modal-actions">
      <button id="conflict-overwrite" class="btn-primary">บันทึกของฉัน (เขียนทับ)</button>
      <button id="conflict-discard" class="btn-secondary">ใช้ของ server</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: เพิ่ม conflict styles ใน style.css**

```css
.conflict-desc { font-size: 0.85rem; color: #888; margin-bottom: 1rem; }
.conflict-compare { display: flex; gap: 1rem; }
.conflict-col { flex: 1; }
.conflict-col-label { font-size: 0.75rem; font-weight: 600; color: #888; margin-bottom: 0.4rem; }
.conflict-pre {
  background: #f8f8f8; border-radius: 6px; padding: 0.75rem;
  font-size: 0.78rem; white-space: pre-wrap; word-break: break-word;
  max-height: 180px; overflow-y: auto; margin: 0;
}
```

- [ ] **Step 3: สร้าง conflict.js**

```js
// conflict.js
let _conflictContext = null;

function fmtDetails(det) {
  const acts = (det.acts || []).map(a => '- ' + a).join('\n');
  return 'สถานที่: ' + det.place + '\nกิจกรรม:\n' + acts;
}

function openConflictModal(editingDay, myChanges, serverRow) {
  _conflictContext = { editingDay, myChanges, serverRow };
  document.getElementById('conflict-mine').textContent = fmtDetails(myChanges);
  document.getElementById('conflict-server').textContent = fmtDetails(serverRow.details);
  document.getElementById('conflict-modal').classList.remove('hidden');
}

function closeConflictModal() {
  _conflictContext = null;
  document.getElementById('conflict-modal').classList.add('hidden');
}

document.getElementById('conflict-overwrite').addEventListener('click', async () => {
  if (!_conflictContext) return;
  const { editingDay, myChanges, serverRow } = _conflictContext;
  const { data: userData } = await db.auth.getUser();
  const { data, error } = await db.rpc('update_day_if_version', {
    p_id: editingDay.id,
    p_expected_version: serverRow.version,
    p_changes: myChanges,
    p_actor: userData.user.id,
  });
  if (error || !data.ok) { alert('บันทึกไม่สำเร็จ กรุณาลองใหม่'); return; }
  const idx = DAYS.findIndex(d => d.id === editingDay.id);
  if (idx !== -1) { DAYS[idx] = data.row; renderSidebar(DAYS); renderMap(DAYS); }
  closeConflictModal();
  closeEditor();
});

document.getElementById('conflict-discard').addEventListener('click', () => {
  if (!_conflictContext) return;
  const serverRow = _conflictContext.serverRow;
  const idx = DAYS.findIndex(d => d.id === serverRow.id);
  if (idx !== -1) { DAYS[idx] = serverRow; renderSidebar(DAYS); renderMap(DAYS); }
  closeConflictModal();
  closeEditor();
});

document.getElementById('conflict-close').addEventListener('click', closeConflictModal);
```

- [ ] **Step 4: ทดสอบ conflict manual**

1. เปิด 2 tabs ล็อกอินทั้งคู่
2. Tab A: เปิด editor Day 1
3. Tab B: แก้ Day 1 แล้วบันทึก (สำเร็จ)
4. Tab A: กดบันทึก → คาดหวัง: conflict modal โชว์ "ของคุณ" vs "server"
5. เลือก "บันทึกของฉัน" → บันทึกสำเร็จ; Tab B อัปเดต realtime

- [ ] **Step 5: Commit**

```bash
git add conflict.js index.html style.css
git commit -m "feat(conflict): add manual merge modal for concurrent edits"
```

---

## Integration Test Checklist (รันก่อน invite เพื่อน)

| # | สถานการณ์ | คาดหวัง |
|---|-----------|---------|
| 1 | เปิดแอพโดยไม่ล็อกอิน | เห็น auth overlay |
| 2 | ส่ง magic link → คลิก link ในอีเมล | overlay หายไป แสดงแผนที่ |
| 3 | Tab A โหลด, Tab B แก้ Day 2 ผ่าน editor | Tab A อัปเดตทันที (realtime) |
| 4 | คลิก ✏️ → แก้กิจกรรม → บันทึก | sidebar + popup อัปเดตทันที |
| 5 | A เปิด editor, B บันทึกก่อน, A บันทึก | A เห็น conflict modal |
| 6 | Conflict → "บันทึกของฉัน" | ข้อมูลบันทึก, modal ปิด |
| 7 | Conflict → "ใช้ของ server" | local state reset เป็น server version |
| 8 | ปิด browser, เปิดใหม่ | session ยังมี, ข้อมูลโหลดถูก |

---

## Deploy Checklist

- [ ] สร้าง Supabase project (Free tier)
- [ ] รัน migrations 001, 002, 003 บน SQL Editor
- [ ] รัน seed.sql ขณะล็อกอินอยู่ใน SQL Editor
- [ ] คัดลอก SUPABASE_URL + ANON_KEY จาก Settings → API ไปใส่ config.js
- [ ] ตั้ง Site URL ใน Supabase Auth → Settings → URL Configuration
- [ ] ทดสอบ magic link ด้วยอีเมลจริง
- [ ] Invite เพื่อนทั้ง 10 คน (ล็อกอินด้วย magic link ครั้งแรก)
