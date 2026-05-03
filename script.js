const ITINERARY = [
  {
    day: 6,
    place: 'Tokyo',
    jp: '東京',
    lat: 35.6762, lng: 139.6503,
    acts: ['ถึงญี่ปุ่น ✈', 'เช็คอินโรงแรม', 'เดินเล่นสำรวจรอบๆ'],
    badges: [{ label: 'Arrival', cls: 'city' }],
    travel: null,
  },
  {
    day: 7,
    place: 'Kamakura',
    jp: '鎌倉',
    lat: 35.3192, lng: 139.5467,
    acts: ['พระใหญ่ Kotoku-in', 'Hase-dera Temple', 'Komachi-dori ช้อปปิ้ง'],
    badges: [{ label: 'Temple', cls: 'nature' }, { label: 'Culture', cls: '' }],
    travel: { icon: '🚃', time: '~1.5 ชม.' },
  },
  {
    day: 8,
    place: 'Tokyo Disneyland',
    jp: 'ディズニーランド',
    lat: 35.6329, lng: 139.8804,
    acts: ['สวนสนุกเต็มวัน 🎢', 'Parades & Shows', 'Disney magic!'],
    badges: [{ label: 'Theme Park', cls: 'fun' }],
    travel: { icon: '🚃', time: '~40 นาที' },
  },
  {
    day: 9,
    place: 'Mt. Fuji',
    jp: '富士山',
    lat: 35.4600, lng: 138.7274,
    acts: ['Kawaguchiko ทะเลสาบ', 'Chureito Pagoda', 'Oshino Hakkai'],
    badges: [{ label: 'Nature', cls: 'nature' }, { label: 'Iconic', cls: '' }],
    travel: { icon: '🚗', time: '~2.5 ชม.' },
  },
  {
    day: 10,
    place: 'Matsumoto → Hakuba',
    jp: '松本城 → 白馬',
    lat: 36.2389, lng: 137.9681,
    acts: ['Matsumoto Castle 🏯', 'ขับผ่านเทือกเขาแอลป์', 'เช็คอิน Hakuba'],
    badges: [{ label: 'Castle', cls: '' }, { label: 'Scenic Drive', cls: 'snow' }],
    travel: { icon: '🚗', time: '~4.5–5 ชม.' },
  },
  {
    day: 11,
    place: 'Hakuba',
    jp: '白馬',
    lat: 36.6989, lng: 137.8670,
    acts: ['เล่นสกีเต็มวัน ⛷', 'ออนเซ็นยามเย็น ♨', 'พักผ่อนท่ามกลางหิมะ'],
    badges: [{ label: 'Skiing', cls: 'snow' }, { label: 'Onsen', cls: 'nature' }],
    travel: null,
  },
  {
    day: 12,
    place: 'Hakuba → Tokyo',
    jp: '帰り道',
    lat: 36.10, lng: 138.40,
    acts: ['คืนรถเช่า', 'ขับรถกลับ Tokyo ยามค่ำ', 'บอกลาหิมะ 🌙'],
    badges: [{ label: 'Night Drive', cls: 'snow' }],
    travel: { icon: '🚗', time: '~4.5–5 ชม.' },
  },
  {
    day: 13,
    place: 'Tokyo',
    jp: '東京',
    lat: 35.6896, lng: 139.7023,
    acts: ['ช้อปปิ้งวันสุดท้าย 🛍', 'Illumination ยามค่ำ ✨', 'See you again, Japan 🇯🇵'],
    badges: [{ label: 'Shopping', cls: 'city' }, { label: 'Night Out', cls: '' }],
    travel: null,
  },
];

// ─── Safe DOM helpers (avoids innerHTML with dynamic content) ─────────────
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

// ─── Build sidebar ────────────────────────────────────────────────────────
const listEl = document.getElementById('dayList');

ITINERARY.forEach((d, i) => {
  const item = el('div', 'day-item');
  item.dataset.i = i;
  item.style.animationDelay = `${i * 0.07 + 0.1}s`;

  const pin = append(el('div', 's-pin'), el('span', 's-pin-num', String(d.day)));

  const info = el('div', 'day-info');
  const meta = el('div', 'day-meta');
  d.badges.forEach(b => meta.appendChild(el('span', `badge ${b.cls}`.trim(), b.label)));
  if (d.travel) meta.appendChild(el('span', 'travel-tag', `${d.travel.icon} ${d.travel.time}`));

  append(info, el('div', 'day-place', d.place), el('div', 'day-detail', d.acts[0]), meta);
  append(item, pin, info);
  item.addEventListener('click', () => goTo(i));
  listEl.appendChild(item);
});

// ─── Map ──────────────────────────────────────────────────────────────────
const map = L.map('map', { zoomControl: false, attributionControl: true })
  .setView([36, 138.5], 7);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  subdomains: 'abcd',
  attribution: '© <a href="https://carto.com">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
}).addTo(map);

L.control.zoom({ position: 'topright' }).addTo(map);

// ─── Animated dashed route line ───────────────────────────────────────────
const coords = ITINERARY.map(d => [d.lat, d.lng]);

const routeLine = L.polyline(coords, {
  color: '#C85C3A',
  weight: 1.5,
  opacity: 0.5,
  dashArray: '5 7',
  dashOffset: '0',
}).addTo(map);

// Animate stroke-dashoffset directly on SVG path element (no setStyle overhead)
setTimeout(() => {
  const svgPath = routeLine.getElement();
  if (!svgPath) return;
  let offset = 0;
  (function march() {
    offset -= 0.5;
    svgPath.style.strokeDashoffset = offset;
    requestAnimationFrame(march);
  })();
}, 500);

// ─── Popup builder (DOM element passed to Leaflet — no innerHTML) ─────────
function buildPopup(d) {
  const pop = el('div', 'pop');
  append(pop,
    el('div', 'pop-label', `Day ${d.day}`),
    el('div', 'pop-title', d.place),
    el('div', 'pop-jp', d.jp),
  );
  const acts = el('ul', 'pop-acts');
  d.acts.forEach(a => acts.appendChild(el('li', null, a)));
  pop.appendChild(acts);
  if (d.travel) {
    pop.appendChild(el('div', 'pop-travel', `${d.travel.icon} เดินทาง ${d.travel.time} จากจุดก่อนหน้า`));
  }
  return pop;
}

// ─── Markers ─────────────────────────────────────────────────────────────
// divIcon html contains only static class names and a numeric day from hard-coded data
const markers = ITINERARY.map((d, i) => {
  const icon = L.divIcon({
    className: '',
    html: `<div class="mk" id="mk${i}"><span class="mn">${d.day}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 41],
    popupAnchor: [0, -44],
  });

  const m = L.marker([d.lat, d.lng], { icon })
    .bindPopup(buildPopup(d), { maxWidth: 280 })
    .addTo(map);

  m.on('click', () => setActive(i));
  return m;
});

// Staggered bounce-in
markers.forEach((_, i) => {
  const mkEl = document.getElementById(`mk${i}`);
  if (!mkEl) return;
  mkEl.style.opacity = '0';
  mkEl.style.transform = 'rotate(-45deg) scale(0.2)';
  mkEl.style.transition = 'opacity 0.4s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
  setTimeout(() => {
    mkEl.style.opacity = '1';
    mkEl.style.transform = 'rotate(-45deg) scale(1)';
  }, 400 + i * 110);
});

// ─── Active state ────────────────────────────────────────────────────────
let curIdx = null;

function setActive(i) {
  document.querySelectorAll('.day-item').forEach(e => e.classList.remove('active'));
  const activeItem = document.querySelectorAll('.day-item')[i];
  activeItem?.classList.add('active');
  activeItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (curIdx !== null) document.getElementById(`mk${curIdx}`)?.classList.remove('on');
  document.getElementById(`mk${i}`)?.classList.add('on');
  curIdx = i;
}

function goTo(i) {
  map.flyTo([ITINERARY[i].lat, ITINERARY[i].lng], 12, { duration: 1.1 });
  map.once('moveend', () => markers[i].openPopup());
  setActive(i);
}

map.fitBounds(L.latLngBounds(coords), { padding: [40, 60] });

// ─── Petals & snowflakes ──────────────────────────────────────────────────
const FLOATIES = ['🌸', '🌸', '🌸', '❄️', '❄️', '🌸'];

function spawnPetal() {
  const container = document.getElementById('petals');
  const petal = el('span', 'p', FLOATIES[Math.floor(Math.random() * FLOATIES.length)]);
  petal.style.left = `${Math.random() * 100}vw`;
  petal.style.fontSize = `${10 + Math.random() * 9}px`;
  petal.style.animationDuration = `${7 + Math.random() * 8}s`;
  petal.style.animationDelay = `${Math.random() * 1.5}s`;
  container.appendChild(petal);
  petal.addEventListener('animationend', () => petal.remove(), { once: true });
}

for (let i = 0; i < 14; i++) setTimeout(spawnPetal, i * 250);
setInterval(spawnPetal, 950);
