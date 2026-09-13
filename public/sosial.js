const $ = (id) => document.getElementById(id);
let activeTab = 'inbox';
let me = null;
let unreadCount = 0;

function toast(m, ms) {
  const t = $('toast');
  t.textContent = m;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), ms || 2200);
}

function esc(s) {
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.querySelectorAll('.sos-tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.sos-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    activeTab = t.dataset.tab;
    render();
  };
});

socket.on('connect', () => socket.emit('join', window.__userId));

socket.on('anonim-new', (d) => {
  unreadCount = d.count || 0;
  const b = $('inboxBadge');
  if (unreadCount > 0) { b.textContent = unreadCount; b.classList.remove('hidden'); }
  else b.classList.add('hidden');
  if (activeTab === 'inbox') render();
  else toast('📩 Ada pesan anonim baru!');
});

function render() {
  const box = $('sosContent');
  if (!me) { box.innerHTML = '<div class="sos-loading">Loading...</div>'; return; }

  if (activeTab === 'inbox') {
    socket.emit('anonim-inbox', (res) => {
      if (!res.ok) { box.innerHTML = '⚠️ ' + res.error; return; }
      const msgs = res.messages || [];
      if (!msgs.length) {
        box.innerHTML = '<div class="sos-empty">📭 Belum ada pesan anonim.<br><br>Share link lo di tab "🔗 Link Gua" biar orang bisa kirim pesan anonim.</div>';
        return;
      }
      let html = '';
      msgs.forEach(m => {
        const dt = new Date(m.time);
        const time = dt.toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
        html += '<div class="anon-card' + (m.read ? '' : ' unread') + (m.reported ? ' reported' : '') + '" data-id="' + m.id + '">' +
          '<div class="anon-head"><span class="anon-anon">🕶️ Anonim</span><span class="anon-time">' + time + '</span></div>' +
          '<div class="anon-text">' + esc(m.text) + '</div>' +
          '<div class="anon-actions">' +
            (m.reported ? '<span class="anon-flag">⚠️ Dilaporkan</span>' : '') +
            '<button class="anon-btn anon-report" data-act="report" data-id="' + m.id + '">🚨 Lapor</button>' +
            '<button class="anon-btn anon-del" data-act="delete" data-id="' + m.id + '">🗑️ Hapus</button>' +
          '</div>' +
        '</div>';
      });
      box.innerHTML = html;

      box.querySelectorAll('button[data-act]').forEach(b => {
        b.onclick = () => {
          const id = b.dataset.id;
          const act = b.dataset.act;
          if (act === 'delete') {
            if (!confirm('Hapus pesan ini?')) return;
            socket.emit('anonim-delete', { msgId: id }, () => { toast('Dihapus'); render(); });
          } else if (act === 'report') {
            if (!confirm('Lapor pesan ini ke admin?')) return;
            socket.emit('anonim-report', { msgId: id }, () => { toast('Laporan terkirim'); render(); });
          }
        };
      });

      msgs.forEach(m => { if (!m.read) socket.emit('anonim-mark-read', { msgId: m.id }); });
      unreadCount = 0;
      $('inboxBadge').classList.add('hidden');
    });
  }

  else if (activeTab === 'kirim') {
    socket.emit('anonim-users', (res) => {
      if (!res.ok) { box.innerHTML = '⚠️ ' + res.error; return; }
      let opts = '<option value="">-- Pilih user --</option>';
      (res.users || []).forEach(u => {
        opts += '<option value="' + u.userId + '">' + esc(u.username) + '</option>';
      });
      box.innerHTML = '<div class="sos-card">' +
        '<div class="sos-card-title">📤 Kirim Pesan Anonim</div>' +
        '<div class="sos-card-sub">Pesan dikirim tanpa nama. Penerima gak akan tau siapa lo.</div>' +
        '<label class="sos-label">PENERIMA</label>' +
        '<select id="anonTo" class="sos-select">' + opts + '</select>' +
        '<label class="sos-label">PESAN (max 500)</label>' +
        '<textarea id="anonText" class="sos-textarea" placeholder="Tulis pesan anonim..." maxlength="500" rows="5"></textarea>' +
        '<div class="sos-count"><span id="anonCount">0</span>/500</div>' +
        '<button id="anonSend" class="sos-btn">🕶️ KIRIM ANONIM</button>' +
        '<div class="sos-warn">⚠️ Max 30 pesan/hari ke 1 user. Pesan toxic bisa dilaporkan ke admin.</div>' +
      '</div>';

      const ta = $('anonText');
      ta.addEventListener('input', () => { $('anonCount').textContent = ta.value.length; });

      $('anonSend').onclick = () => {
        const to = $('anonTo').value;
        const text = $('anonText').value.trim();
        if (!to) return toast('Pilih penerima dulu');
        if (!text) return toast('Pesan kosong');
        $('anonSend').disabled = true;
        socket.emit('anonim-send', { toUserId: to, text }, (r) => {
          $('anonSend').disabled = false;
          if (r.error) return toast('❌ ' + r.error);
          toast('✅ Pesan terkirim anonim!');
          ta.value = '';
          $('anonCount').textContent = '0';
        });
      };
    });
  }

  else if (activeTab === 'link') {
    const link = location.origin + '/sosial.html?to=' + me.userId;
    box.innerHTML = '<div class="sos-card">' +
      '<div class="sos-card-title">🔗 Link Anonim Gua</div>' +
      '<div class="sos-card-sub">Share link ini ke temen / sosmed. Siapa pun yang buka bisa kirim pesan anonim ke lo.</div>' +
      '<div class="sos-link-box">' +
        '<input id="myLink" class="sos-link-input" type="text" readonly value="' + link + '" />' +
        '<button id="copyLink" class="sos-copy-btn">📋 COPY</button>' +
      '</div>' +
      '<button id="shareLink" class="sos-btn">📤 SHARE</button>' +
      '<div class="sos-warn">💡 Pesan anonim masuk ke tab 📥 Inbox.</div>' +
    '</div>';

    $('copyLink').onclick = () => {
      const inp = $('myLink');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => toast('✅ Link di-copy!')).catch(() => {
          inp.select(); document.execCommand('copy'); toast('✅ Link di-copy!');
        });
      } else {
        inp.select(); document.execCommand('copy'); toast('✅ Link di-copy!');
      }
    };

    $('shareLink').onclick = () => {
      if (navigator.share) {
        navigator.share({ title: 'Kirim anonim ke gue', text: 'Kirim pesan anonim ke gue!', url: link }).catch(() => {});
      } else {
        $('copyLink').click();
      }
    };
  }
}

// Init saat 'me' diterima
socket.on('me', (u) => {
  me = u;
  const params = new URLSearchParams(location.search);
  const toUser = params.get('to');
  if (toUser) {
    setTimeout(() => {
      document.querySelectorAll('.sos-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.sos-tab[data-tab="kirim"]').classList.add('active');
      activeTab = 'kirim';
      render();
      setTimeout(() => {
        const sel = $('anonTo');
        if (sel) {
          for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === toUser) { sel.selectedIndex = i; break; }
          }
        }
      }, 300);
    }, 200);
  } else {
    render();
  }
});
