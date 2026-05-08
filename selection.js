async function ensureMemberSelected() {
  const storedId = localStorage.getItem('selectedMemberId');
  const storedName = localStorage.getItem('selectedMemberName');

  if (storedId && storedName) {
    window.currentMember = { id: storedId, name: storedName };
    return;
  }

  let members;
  try {
    members = await loadMembers();
  } catch (err) {
    alert('ไม่สามารถโหลดรายชื่อสมาชิกได้ กรุณาลองใหม่');
    location.reload();
    return;
  }

  if (!members.length) {
    alert('ไม่พบรายชื่อสมาชิก กรุณาลองใหม่');
    location.reload();
    return;
  }

  const splash = document.getElementById('splash');
  if (splash) splash.classList.add('hidden');

  const modal = document.getElementById('selection-modal');
  const list = document.getElementById('selection-list');

  list.textContent = '';

  return new Promise(resolve => {
    members.forEach(m => {
      const btn = el('button', 'member-btn', m.name);
      btn.onclick = () => {
        localStorage.setItem('selectedMemberId', m.id);
        localStorage.setItem('selectedMemberName', m.name);
        window.currentMember = { id: m.id, name: m.name };
        modal.classList.add('hidden');
        const splash = document.getElementById('splash');
        if (splash) splash.classList.remove('hidden');
        resolve();
      };
      append(list, btn);
    });

    modal.classList.remove('hidden');
  });
}
