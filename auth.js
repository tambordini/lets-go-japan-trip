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
