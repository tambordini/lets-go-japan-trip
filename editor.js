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
  const { data, error } = await db.rpc('update_day_if_version', {
    p_id: _editingDay.id,
    p_expected_version: _editingDay.version,
    p_changes: newDetails,
    p_actor: window.currentMember ? window.currentMember.name : null,
    p_actor_at: new Date().toISOString(),
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

// ─── Place Editor ─────────────────────────────────
let _editingPlace = null;
let _editingPlaceDay = null;
let _pendingLat = null;
let _pendingLng = null;
let _placePickMode = false;

function openPlaceEditor(day, place) {
  _editingPlaceDay = day;
  _editingPlace = place;

  const isNew = !place;
  document.getElementById('place-editor-title').textContent = isNew ? 'เพิ่มสถานที่' : 'แก้ไขสถานที่';
  document.getElementById('place-editor-name').value = place ? (place.name || '') : '';
  const actsArr = place && place.acts ? (Array.isArray(place.acts) ? place.acts : JSON.parse(place.acts)) : [];
  document.getElementById('place-editor-acts').value = actsArr.join('\n');
  document.getElementById('place-editor-expense').value = place ? (place.expense || 0) : 0;
  _pendingLat = place ? (place.lat || null) : null;
  _pendingLng = place ? (place.lng || null) : null;
  document.getElementById('place-editor-search').value = '';
  document.getElementById('place-editor-results').classList.add('hidden');
  document.getElementById('place-editor-results').textContent = '';

  // Render split checkboxes
  renderSplitCheckboxes(place);

  document.getElementById('place-editor-modal').classList.remove('hidden');
}

function renderSplitCheckboxes(place) {
  const container = document.getElementById('place-editor-split');
  container.textContent = '';
  const selected = (place && place.split_among) || [];
  if (!window.members || !window.members.length) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--gray)">ไม่มีสมาชิก</span>';
    return;
  }
  window.members.forEach(m => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = m.id;
    cb.checked = selected.includes(m.id);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + m.name));
    container.appendChild(label);
  });
}

function closePlaceEditor() {
  _editingPlace = null;
  _editingPlaceDay = null;
  _pendingLat = null;
  _pendingLng = null;
  _placePickMode = false;
  document.getElementById('place-editor-modal').classList.add('hidden');
  if (map) map.off('click', placePickHandler);
}

async function savePlaceEditor() {
  const name = document.getElementById('place-editor-name').value.trim();
  if (!name) { alert('กรุณาใส่ชื่อสถานที่'); return; }

  const acts = document.getElementById('place-editor-acts').value
    .split('\n').map(s => s.trim()).filter(Boolean);
  const expense = parseFloat(document.getElementById('place-editor-expense').value) || 0;
  const lat = _pendingLat;
  const lng = _pendingLng;

  const splitCheckboxes = document.querySelectorAll('#place-editor-split input[type="checkbox"]:checked');
  const split_among = Array.from(splitCheckboxes).map(cb => cb.value);

  const data = { name, acts, expense, split_among, lat, lng };

  try {
    if (_editingPlace) {
      await updatePlace(_editingPlace.id, data);
    } else {
      await addPlace(_editingPlaceDay.id, data);
    }
    const day = _editingPlaceDay; // save before closePlaceEditor nulls it
    closePlaceEditor();
    // Refresh detail view
    places = await loadDayPlaces(day.id);
    renderDayDetail(day);
    renderPlaceMap(day);
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

// ─── Geocoding ────────────────────────────────────
async function searchPlaceHandler() {
  const q = document.getElementById('place-editor-search').value.trim();
  if (!q) return;
  const results = await searchPlaceName(q);
  const container = document.getElementById('place-editor-results');
  container.textContent = '';
  if (!results.length) {
    container.innerHTML = '<div class="search-result-item">ไม่พบสถานที่ ลองคลิกบนแผนที่</div>';
  } else {
    results.forEach(r => {
      const item = el('div', 'search-result-item', r.label);
      item.addEventListener('click', () => {
        _pendingLat = r.lat;
        _pendingLng = r.lng;
        document.getElementById('place-editor-name').value = r.name;
        container.classList.add('hidden');
      });
      container.appendChild(item);
    });
  }
  container.classList.remove('hidden');
}

// Map click handler for picking coordinates
function enablePlacePickMode() {
  _placePickMode = true;
  map.once('click', placePickHandler);
  document.getElementById('place-editor-search').placeholder = 'คลิกบนแผนที่เพื่อเลือกพิกัด...';
}

function placePickHandler(e) {
  _pendingLat = e.latlng.lat;
  _pendingLng = e.latlng.lng;
  document.getElementById('place-editor-search').placeholder = 'ค้นหาชื่อสถานที่...';
}

// Event listeners
document.getElementById('place-editor-save').addEventListener('click', savePlaceEditor);
document.getElementById('place-editor-cancel').addEventListener('click', closePlaceEditor);
document.getElementById('place-editor-close').addEventListener('click', closePlaceEditor);
document.getElementById('place-editor-search-btn').addEventListener('click', searchPlaceHandler);
document.getElementById('place-editor-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); searchPlaceHandler(); }
});

// Map click pick is triggered via the search input hint
