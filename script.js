// script.js
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

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
let tileLayer = null;

(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.dataset.theme = 'dark';
  const btn = document.getElementById('themeToggle');
  const sunIcon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  const moonIcon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  function syncIcon() {
    btn.innerHTML = document.documentElement.dataset.theme === 'dark' ? sunIcon : moonIcon;
  }
  syncIcon();
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    if (isDark) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('theme', 'dark');
    }
    syncIcon();
    if (map) {
      const tiles = {
        light: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '\u00a9 <a href="https://carto.com">CARTO</a> \u00a9 <a href="https://www.openstreetmap.org/copyright">OSM</a>' },
        dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '\u00a9 <a href="https://carto.com">CARTO</a> \u00a9 <a href="https://www.openstreetmap.org/copyright">OSM</a>' },
      };
      const key = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      if (tileLayer) tileLayer.remove();
      tileLayer = L.tileLayer(tiles[key].url, {
        maxZoom: 19, subdomains: 'abcd', attribution: tiles[key].attr,
      }).addTo(map);
    }
  });
})();

// Music Toggle
(function initMusic() {
  const audio = document.getElementById('lofi-audio');
  const btn = document.getElementById('musicToggle');
  
  audio.volume = 0.15;
  
  // Muted/Off icon - music note with slash
  const musicOffIcon = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
  
  // Playing/On icon - equalizer bars
  const musicOnIcon = '<div class="music-icon" style="display:flex;gap:2px;align-items:flex-end;justify-content:center;"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></div>';
  
  btn.innerHTML = musicOffIcon;
  
  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        btn.classList.add('playing');
        btn.innerHTML = musicOnIcon;
        localStorage.setItem('musicPlaying', 'true');
      }).catch(err => {
        console.log('Autoplay blocked, user interaction required');
      });
    } else {
      audio.pause();
      btn.classList.remove('playing');
      btn.innerHTML = musicOffIcon;
      localStorage.setItem('musicPlaying', 'false');
    }
  });
  
  // Restore music state
  if (localStorage.getItem('musicPlaying') === 'true') {
    audio.play().then(() => {
      btn.classList.add('playing');
      btn.innerHTML = musicOnIcon;
    }).catch(() => {});
  }
})();

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const diffSec = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diffSec < 60) return 'เมื่อกี้';
  if (diffSec < 3600) return Math.floor(diffSec / 60) + ' นาทีที่แล้ว';
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' ชม.ที่แล้ว';
  return Math.floor(diffSec / 86400) + ' วันที่แล้ว';
}

function renderSidebar(days) {
  const listEl = document.getElementById('dayList');
  listEl.textContent = '';
  days.forEach((d, i) => {
    const det = d.details;
    const item = el('div', 'day-item');
    item.dataset.i = i;
    item.style.animationDelay = (i * 0.07 + 0.1) + 's';

    const rowTop = el('div', 'day-row');
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
    append(rowTop, pin, info, editBtn);
    append(item, rowTop);
    item.addEventListener('click', () => goTo(i));
    item.addEventListener('mouseenter', () => {
      const leg = (window._legLines || [])[i - 1];
      if (leg) leg.setStyle({ weight: 3, opacity: 0.9, dashArray: null });
    });
    item.addEventListener('mouseleave', () => {
      const leg = (window._legLines || [])[i - 1];
      if (leg) leg.setStyle({ weight: 1.5, opacity: 0.45, dashArray: '5 7' });
    });
    if (d.last_editor_name) {
      const stamp = el('small', 'day-editor',
        'แก้โดย: ' + d.last_editor_name + ' · เมื่อ ' + formatTimeAgo(d.last_editor_at)
      );
      append(item, stamp);
    }
    listEl.appendChild(item);
  });
}

function buildPopup(d, i) {
  const det = d.details;
  const pop = el('div', 'pop');
  if (det.img) {
    const imgWrap = el('div', 'pop-img-wrap pop-img-loading');
    const img = el('img', 'pop-img');
    img.alt = det.place;
    img.src = det.img;

    img.onload = () => {
      imgWrap.classList.remove('pop-img-loading');
      img.classList.add('loaded');
    };
    img.onerror = () => {
      imgWrap.classList.remove('pop-img-loading');
      imgWrap.classList.add('pop-img-error');
      img.style.display = 'none';
      const fallback = el('div', 'pop-img-fallback');
      fallback.innerHTML = '<svg viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="2" opacity="0.2"/><path d="M24 42l6-8 4 4 8-10 8 14H26l-2-10z" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/></svg>';
      imgWrap.appendChild(fallback);
    };

    imgWrap.appendChild(img);
    pop.appendChild(imgWrap);
  } else {
    const ph = el('div', 'pop-img-placeholder');
    ph.innerHTML = '<svg viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="2" opacity="0.2"/><path d="M24 42l6-8 4 4 8-10 8 14H26l-2-10z" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/></svg>';
    pop.appendChild(ph);
  }
  append(pop,
    el('div', 'pop-label', 'Day ' + (i + 1)),
  );

  const titleEl = el('div', 'pop-title');
  const placeParts = det.place.split('_');
  titleEl.appendChild(el('span', null, placeParts[0].trim()));
  if (placeParts[1]) {
    titleEl.appendChild(el('span', 'day-number', ' • ' + placeParts[1].trim()));
  }
  pop.appendChild(titleEl);

  if (det.jp) {
    append(pop, el('div', 'pop-jp', det.jp));
  }

  const acts = el('ul', 'pop-acts');
  (det.acts || []).forEach(a => acts.appendChild(el('li', null, a)));
  pop.appendChild(acts);
  return pop;
}

function renderMap(days) {
  if (!map) {
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([36, 138.5], 7);
    const tiles = {
      light: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attr: '© <a href="https://carto.com">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      },
      dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attr: '© <a href="https://carto.com">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>'
      },
    };
    const key = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    tileLayer = L.tileLayer(tiles[key].url, {
      maxZoom: 19, subdomains: 'abcd', attribution: tiles[key].attr,
    }).addTo(map);

    // Custom zoom controls with glassmorphism
    const zoomControl = L.control.zoom({ position: 'topright' });
    map.addControl(zoomControl);
  }

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const coords = days.map(d => [d.details.lat, d.details.lng]);

  (window._legLines || []).forEach(l => map.removeLayer(l));
  window._legLines = [];
  for (let i = 1; i < coords.length; i++) {
    const leg = L.polyline([coords[i - 1], coords[i]], {
      color: '#c85c3a',
      weight: 3,
      opacity: 0.6,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    window._legLines.push(leg);
  }

  map.once('zoomend', () => {
    const zoom = map.getZoom();
    window._legLines.forEach(leg => {
      leg.setStyle({ opacity: zoom > 8 ? 0.6 : 0.3 });
    });
  });

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
  if (!DAYS[i]) return;
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
  await ensureMemberSelected();
  DAYS = await loadDays();
  renderSidebar(DAYS);
  renderMap(DAYS);
  initRealtime();

  document.getElementById('openRouteBtn').addEventListener('click', () => {
    if (DAYS.length < 2) return;
    const origin = DAYS[0].details.lat + ',' + DAYS[0].details.lng;
    const dest = DAYS[DAYS.length - 1].details.lat + ',' + DAYS[DAYS.length - 1].details.lng;
    const waypoints = DAYS.slice(1, -1).map(d => d.details.lat + ',' + d.details.lng).join('|');
    let url = 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + dest;
    if (waypoints) url += '&waypoints=' + waypoints;
    window.open(url, '_blank');
  });

  setTimeout(() => {
    document.getElementById('splash').classList.add('hidden');
  }, 1000);
}

initApp();
