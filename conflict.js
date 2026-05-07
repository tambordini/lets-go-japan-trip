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
  const { data, error } = await db.rpc('update_day_if_version', {
    p_id: editingDay.id,
    p_expected_version: serverRow.version,
    p_changes: myChanges,
    p_actor: window.currentMember ? window.currentMember.name : null,
    p_actor_at: new Date().toISOString(),
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
