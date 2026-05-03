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
    p_actor: null,
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
