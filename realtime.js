// realtime.js
function initRealtime() {
  db.channel('days-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'days',
      filter: 'itinerary_id=eq.' + window.TRIP_ITINERARY_ID,
    }, (payload) => {
      handleDayChange(payload);
    })
    .subscribe();
}

function handleDayChange(payload) {
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
