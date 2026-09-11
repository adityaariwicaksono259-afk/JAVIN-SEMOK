// Common helper — loaded FIRST before everything
(function() {
  function setCookie(n, v, d) {
    const e = new Date();
    e.setTime(e.getTime() + d * 864e5);
    document.cookie = n + '=' + encodeURIComponent(v) + ';expires=' + e.toUTCString() + ';path=/;SameSite=Lax';
  }
  function getCookie(n) {
    const m = document.cookie.match(new RegExp('(^| )' + n + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : '';
  }
  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  // Coba ambil dari localStorage, fallback ke cookie, kalau kosong baru generate
  let id = '';
  try { id = localStorage.getItem('javachat_id') || ''; } catch(e) {}
  if (!id || id.length < 8) id = getCookie('javachat_id');
  if (!id || id.length < 8) id = newId();
  // Simpan ke DUA-duanya biar redundan
  try { localStorage.setItem('javachat_id', id); } catch(e) {}
  setCookie('javachat_id', id, 730); // 2 tahun
  // Expose biar bisa dipake script lain
  window.__userId = id;
})();
