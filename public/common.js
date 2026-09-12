// Common helper — generate & persist user ID
(function() {
  function setCookie(n, v, d) {
    var e = new Date();
    e.setTime(e.getTime() + d * 864e5);
    document.cookie = n + '=' + encodeURIComponent(v) + ';expires=' + e.toUTCString() + ';path=/;SameSite=Lax';
  }
  function getCookie(n) {
    var m = document.cookie.match(new RegExp('(^| )' + n + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : '';
  }
  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  var id = '';
  try { id = localStorage.getItem('javachat_id') || ''; } catch(e) {}
  if (!id || id.length < 8) id = getCookie('javachat_id');
  if (!id || id.length < 8) id = newId();

  try { localStorage.setItem('javachat_id', id); } catch(e) {}
  setCookie('javachat_id', id, 730);

  window.__userId = id;
  console.log('[COMMON] userId =', id);
})();
