// ===== SOCKET AUTH WRAPPER =====
// Bungkus io() biar tiap connect otomatis kirim userId + token
(function() {
  const originalIo = window.io;
  if (!originalIo) {
    console.error('[AUTH] socket.io belum load');
    return;
  }

  window.io = function(opts) {
    opts = opts || {};
    opts.auth = {
      userId: window.__userId || localStorage.getItem('javachat_id') || '',
      token: localStorage.getItem('javachat_token') || ''
    };
    const socket = originalIo(opts);

    // Simpan token yang dikasih server (sekali doang)
    socket.on('auth-token', function(t) {
      if (t && typeof t === 'string') {
        localStorage.setItem('javachat_token', t);
        console.log('[AUTH] token saved');
      }
    });

    // Kalau token invalid — reset identitas
    socket.on('connect_error', function(err) {
      console.warn('[AUTH] connect_error:', err.message);
      if (err.message === 'INVALID_TOKEN') {
        localStorage.removeItem('javachat_id');
        localStorage.removeItem('javachat_token');
        if (!sessionStorage.getItem('auth_reloaded')) {
          sessionStorage.setItem('auth_reloaded', '1');
          setTimeout(function() { location.reload(); }, 500);
        }
      }
    });

    socket.on('auth-fail', function(msg) {
      console.warn('[AUTH] auth-fail:', msg);
      if (msg === 'User ID mismatch') {
        localStorage.removeItem('javachat_id');
        localStorage.removeItem('javachat_token');
        if (!sessionStorage.getItem('auth_reloaded')) {
          sessionStorage.setItem('auth_reloaded', '1');
          setTimeout(function() { location.reload(); }, 500);
        }
      }
    });


  // Cek maintenance saat connect
  socket.on('maintenance-changed', function(d) {
    if (d && d.active) {
      var isAdminPage = location.pathname.indexOf('admin') >= 0;
      var isMaintenancePage = location.pathname.indexOf('maintenance') >= 0;
      if (!isAdminPage && !isMaintenancePage) {
        location.href = '/maintenance.html';
      }
    } else if (d && !d.active) {
      if (location.pathname.indexOf('maintenance') >= 0) {
        location.href = '/';
      }
    }
  });

    return socket;
  };

  // Copy static methods
  for (const k in originalIo) {
    try { window.io[k] = originalIo[k]; } catch(e){}
  }
  console.log('[AUTH] wrapper ready');
})();
