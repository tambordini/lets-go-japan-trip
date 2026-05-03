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
    item.style.animationDelay = (i * 0.07 + 0.1) + 's';

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
      attribution: '\u00a9 <a href="https://carto.com">CARTO</a> \u00a9 <a href="https://www.openstreetmap.org/copyright">OSM</a>',
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
