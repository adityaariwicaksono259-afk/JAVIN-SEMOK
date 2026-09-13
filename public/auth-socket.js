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
    var uid = window.__userId || localStorage.getItem('javachat_id') || '';
    if (!uid || uid.length < 8) {
      uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      window.__userId = uid;
      try { localStorage.setItem('javachat_id', uid); } catch(e) {}
      try { document.cookie = 'javachat_id=' + encodeURIComponent(uid) + ';expires=' + new Date(Date.now() + 730*864e5).toUTCString() + ';path=/;SameSite=Lax'; } catch(e) {}
    }
    opts.auth = {
      userId: uid,
      token: localStorage.getItem('javachat_token') || ''
    };
    const socket = originalIo(opts);

    // Simpan token yang dikasih server (sekali doang)
    socket.on('auth-token', function(t) {
      if (t && typeof t === 'string') {
        try { localStorage.setItem('javachat_token', t); } catch(e) {}
        console.log('[AUTH] token saved/rotated');
      }
    });


    // Kalau token invalid — reset identitas
    socket.on('connect_error', function(err) {
      console.warn('[AUTH] connect_error:', err.message);
      var box = document.createElement('div');
      box.style.cssText = 'position:fixed;top:60px;left:10px;right:10px;background:#d32f2f;color:#fff;padding:12px;border-radius:8px;font-size:13px;z-index:99999;font-family:monospace;white-space:pre-wrap;word-break:break-all';
      box.textContent = 'AUTH ERROR: ' + err.message;
      document.body.appendChild(box);
      if (err.message === 'INVALID_TOKEN') {
        try { localStorage.removeItem('javachat_id'); localStorage.removeItem('javachat_token'); } catch(e){}
        if (!sessionStorage.getItem('auth_reloaded')) {
          sessionStorage.setItem('auth_reloaded', '1');
          setTimeout(function() { location.reload(); }, 1000);
        }
      }
    });

    socket.on('auth-fail', function(msg) {
      console.warn('[AUTH] auth-fail:', msg);
      var isBan = msg && (msg.toLowerCase().indexOf('ban') >= 0);
      var isMaintenancePage = location.pathname.indexOf('maintenance') >= 0;
      var isBannedPage = location.pathname.indexOf('banned') >= 0;

      if (isBan && !isBannedPage) {
        try {
          var uid = localStorage.getItem('javachat_id') || '-';
          sessionStorage.setItem('ban_reason', msg.replace(/^Akun lo di-ban oleh admin\.?\s*/, '') || 'Melanggar aturan yang berlaku.');
          sessionStorage.setItem('ban_uid', uid);
          sessionStorage.setItem('ban_time', new Date().toLocaleString('id-ID'));
        } catch(e) {}
        location.href = '/banned.html';
        return;
      }

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
        sessionStorage.setItem('mt_msg', d.message || 'Server sedang maintenance.');
        location.href = '/maintenance.html';
      }
    } else if (d && !d.active) {
      if (location.pathname.indexOf('maintenance') >= 0) {
        location.href = '/';
      }
    }
  });

  // Cek maintenance saat pertama connect (untuk user yang baru buka)
  socket.on('connect', function() {
    socket.emit('maintenance-check', function(r) {
      if (r && r.maintenance && r.maintenance.active) {
        var isAdminPage = location.pathname.indexOf('admin') >= 0;
        var isMaintenancePage = location.pathname.indexOf('maintenance') >= 0;
        if (!isAdminPage && !isMaintenancePage) {
          sessionStorage.setItem('mt_msg', r.maintenance.message || 'Server sedang maintenance.');
          location.href = '/maintenance.html';
        }
      }
    });
  });



    // Auto-check ban di setiap connect (semua halaman termasuk landing)
    socket.on('connect', function() {
      socket.emit('check-ban', function(r) {
        if (r && r.banned) {
          var isBannedPage = location.pathname.indexOf('banned') >= 0;
          var isAdminPage = location.pathname.indexOf('admin') >= 0;
          if (!isBannedPage && !isAdminPage) {
            try {
              var uid = localStorage.getItem('javachat_id') || '-';
              sessionStorage.setItem('ban_reason', r.reason || 'Melanggar aturan yang berlaku.');
              sessionStorage.setItem('ban_uid', uid);
              sessionStorage.setItem('ban_time', new Date().toLocaleString('id-ID'));
            } catch(e) {}
            location.href = '/banned.html';
          }
        }
      });
    });

    return socket;
  };

  // Copy static methods
  for (const k in originalIo) {
    try { window.io[k] = originalIo[k]; } catch(e){}
  }
  console.log('[AUTH] wrapper ready');
})();
