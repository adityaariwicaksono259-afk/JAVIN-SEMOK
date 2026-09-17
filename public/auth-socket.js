// ===== SOCKET AUTH WRAPPER =====
// Bungkus io() biar tiap connect otomatis kirim userId + token
(function() {
  const originalIo = window.io;
  if (!originalIo) {
    console.error('[AUTH] socket.io belum load');
    return;
  }

  // === DEVICE FINGERPRINT (anti clear-data reset) ===
  function getDeviceFingerprintV2() {
    var parts = [];

    // 1. Screen
    try { parts.push('S:' + screen.width + 'x' + screen.height + 'x' + screen.colorDepth); } catch(e) {}

    // 2. UA + platform
    try { parts.push('U:' + navigator.userAgent); } catch(e) {}
    try { parts.push('P:' + navigator.platform); } catch(e) {}
    try { parts.push('L:' + (navigator.languages || [navigator.language]).join(',')); } catch(e) {}
    try { parts.push('H:' + (navigator.hardwareConcurrency || 0)); } catch(e) {}
    try { parts.push('M:' + (navigator.deviceMemory || 0)); } catch(e) {}
    try { parts.push('T:' + (navigator.maxTouchPoints || 0)); } catch(e) {}

    // 3. Timezone
    try { parts.push('TZ:' + new Date().getTimezoneOffset()); } catch(e) {}
    try { parts.push('TZN:' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '')); } catch(e) {}

    // 4. Canvas
    try {
      var cv = document.createElement('canvas');
      cv.width = 200; cv.height = 50;
      var ctx = cv.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('JavinCakep👑', 2, 15);
      ctx.fillStyle = 'rgba(102,204,0,0.7)';
      ctx.fillText('JavinCakep👑', 4, 17);
      parts.push('C:' + cv.toDataURL().slice(-80));
    } catch(e) {}

    // 5. WebGL
    try {
      var gl_cv = document.createElement('canvas');
      var gl = gl_cv.getContext('webgl') || gl_cv.getContext('experimental-webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          parts.push('G1:' + gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL));
          parts.push('G2:' + gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
        }
      }
    } catch(e) {}

    // 6. Fonts
    try {
      var baseFonts = ['monospace','sans-serif','serif'];
      var testFonts = ['Arial','Verdana','Courier New','Georgia','Times New Roman','Comic Sans MS','Impact','Tahoma'];
      var testStr = 'mmmmmmmmmmlli';
      var testSize = '72px';
      var span = document.createElement('span');
      span.style.position = 'absolute';
      span.style.left = '-9999px';
      span.style.fontSize = testSize;
      span.style.fontWeight = 'bold';
      span.innerHTML = testStr;
      document.body.appendChild(span);
      var baseWidths = {};
      for (var i = 0; i < baseFonts.length; i++) {
        span.style.fontFamily = baseFonts[i];
        baseWidths[baseFonts[i]] = span.offsetWidth;
      }
      var fp = '';
      for (var j = 0; j < testFonts.length; j++) {
        var detected = false;
        for (var k = 0; k < baseFonts.length; k++) {
          span.style.fontFamily = "'" + testFonts[j] + "'," + baseFonts[k];
          if (span.offsetWidth !== baseWidths[baseFonts[k]]) { detected = true; break; }
        }
        fp += detected ? '1' : '0';
      }
      document.body.removeChild(span);
      parts.push('F:' + fp);
    } catch(e) {}

    // Hash → hex
    var str = parts.join('|');
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = (h1 * 33) ^ ch;
      h2 = (h2 * 33) ^ ch;
    }
    var hex1 = Math.abs(h1 >>> 0).toString(36);
    var hex2 = Math.abs(h2 >>> 0).toString(36);
    var hex3 = Math.abs((h1 ^ h2) >>> 0).toString(36);
    return 'fp_' + hex1 + hex2 + hex3;
  }

  window.io = function(opts) {
    opts = opts || {};
    var fp = getDeviceFingerprintV2();
    // Simpan fingerprint di localStorage
    try { localStorage.setItem('javachat_fp', fp); } catch(e) {}
    var uid = window.__userId || getCookie('javachat_id') || localStorage.getItem('javachat_id') || fp;
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
      token: localStorage.getItem('javachat_token') || '',
      fp: fp
    };
    const socket = originalIo(opts);

    // === AUTO RESTORE PAKAI FINGERPRINT ===
    if (!localStorage.getItem('javachat_token')) {
      // Coba restore dari server pakai fingerprint
      fetch('/api/auth/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fp: fp })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.status && d.token) {
          try {
            localStorage.setItem('javachat_id', d.userId);
            localStorage.setItem('javachat_token', d.token);
            console.log('[FP-RESTORE] Akun direstore:', d.username);
            // Reload biar pakai akun yang di-restore
            if (!sessionStorage.getItem('fp_restored')) {
              sessionStorage.setItem('fp_restored', '1');
              setTimeout(function() { location.reload(); }, 800);
            }
          } catch(e) {}
        }
      })
      .catch(function() {});
    }

    // === SET FP KE SERVER (biar tersimpan) ===
    setTimeout(function() {
      var uid = localStorage.getItem('javachat_id');
      if (uid && fp) {
        fetch('/api/auth/set-fp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: uid, fp: fp })
        }).catch(function() {});
      }
    }, 2000);

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
