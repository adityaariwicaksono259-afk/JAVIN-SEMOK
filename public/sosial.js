const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let socket = null;
let profile = null;
let activeTab = 'inbox';

function toast(m) {
  const t = $('toast');
  if (!t) return;
  t.textContent = m;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2200);
}
function esc(s) {
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// URL params
const params = new URLSearchParams(location.search);
let viewUser = params.get('u');
// Support pretty URL: /u/javin
if (!viewUser) {
  const m = location.pathname.match(/^\/u\/([a-z0-9_]+)/i);
  if (m) viewUser = m[1].toLowerCase();
}

function initSocket() {
  socket = io({ auth: { userId: userId, token: localStorage.getItem('javachat_token') || '' } });
  socket.on('connect', () => {
    socket.emit('join', userId);
  });
  // Tunggu 'me' event = tanda join sukses
  socket.on('me', (u) => {
    if (viewUser) {
      renderPublicSend(viewUser);
    } else {
      checkMyProfile();
    }
  });
  socket.on('auth-fail', (msg) => {
    console.warn('[ANONIM] auth-fail:', msg);
    $('sosMain').innerHTML = '<div class="sos-content"><div class="sos-card"><div class="sos-card-title">⚠️ Gagal Join</div><div class="sos-card-sub">' + esc(msg) + '</div><a href="/" class="sos-btn" style="display:block;text-align:center;text-decoration:none">Kembali ke Home</a></div></div>';
  });
  socket.on('connect_error', (err) => {
    console.warn('[ANONIM] connect_error:', err.message);
    setTimeout(() => {
      if (socket.connected) return;
      if (viewUser) renderPublicSend(viewUser);
      else checkMyProfile();
    }, 1500);
  });
  socket.on('anonim-new', (d) => {
    const b = $('inboxBadge');
    if (b) {
      const c = (parseInt(b.textContent) || 0) + 1;
      b.textContent = c;
      b.classList.remove('hidden');
    }
    if (activeTab === 'inbox') renderInbox();
    else toast('📩 Ada pesan anonim baru!');
  });
}

function checkMyProfile() {
  socket.emit('anonim-profile-get', (res) => {
    if (res.ok && res.profile) {
      profile = res.profile;
      renderMain();
    } else {
      renderCreateForm();
    }
  });
}

// ===== HALAMAN 1: BUAT USERNAME =====
function renderCreateForm() {
  $('sosMain').innerHTML = `
    <div class="sos-content">
      <div class="sos-card">
        <div class="sos-card-title">🎭 Bikin Username Anonim</div>
        <div class="sos-card-sub">Username ini jadi <b>link anonim lo</b> yang bisa dishare ke orang lain. Cuma sekali bikin, gak bisa diganti.</div>
        <label class="sos-label">USERNAME (huruf kecil, angka, _)</label>
        <input id="anonUsername" class="sos-select" type="text" placeholder="contoh: javin" maxlength="20" autocomplete="off" />
        
        <button id="anonCreate" class="sos-btn">✨ BUAT USERNAME</button>
        <div id="anonErr" class="err"></div>
      </div>
    </div>
  `;
  const inp = $('anonUsername');
  inp.addEventListener('input', () => {
    const v = inp.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    inp.value = v;
    $('previewUsername').textContent = v || 'username';
  });
  $('anonCreate').onclick = () => {
    const uname = inp.value.trim().toLowerCase();
    if (!uname) return $('anonErr').textContent = 'Isi username dulu';
    if (uname.length < 3) return $('anonErr').textContent = 'Minimal 3 karakter';
    if (!/^[a-z0-9_]+$/.test(uname)) return $('anonErr').textContent = 'Hanya huruf kecil, angka, underscore';
    $('anonErr').textContent = '';
    $('anonCreate').disabled = true;
    socket.emit('anonim-create', { username: uname }, (r) => {
      $('anonCreate').disabled = false;
      if (r.error) return $('anonErr').textContent = r.error;
      profile = r.profile;
      toast('✅ Username dibuat!');
      renderMain();
    });
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('anonCreate').click(); });
}

// ===== HALAMAN 2: MAIN (Inbox + Link) =====
function renderMain() {
  const link = location.origin + '/u/' + profile.username;
  $('sosMain').innerHTML = `
    <div class="sos-tabs">
      <button class="sos-tab active" data-tab="inbox">📥 Inbox <span class="sos-badge hidden" id="inboxBadge">0</span></button>
      <button class="sos-tab" data-tab="link">🔗 Link Gua</button>
    </div>
    <div class="sos-content" id="sosContent"></div>
  `;
  document.querySelectorAll('.sos-tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.sos-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      activeTab = t.dataset.tab;
      if (activeTab === 'inbox') renderInbox();
      else renderLink();
    };
  });
  renderInbox();
}

function renderInbox() {
  const box = $('sosContent');
  box.innerHTML = '<div class="sos-loading">Memuat inbox...</div>';
  socket.emit('anonim-inbox', (res) => {
    if (!res.ok) { box.innerHTML = '<div class="sos-loading">⚠️ ' + esc(res.error) + '</div>'; return; }
    const msgs = res.messages || [];
    if (!msgs.length) {
      box.innerHTML = '<div class="sos-empty">📭 Belum ada pesan anonim.<br><br>Share link di tab <b>🔗 Link Gua</b> biar orang bisa kirim pesan ke lo.</div>';
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
        '</div></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('button[data-act]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.id;
        if (b.dataset.act === 'delete') {
          if (!confirm('Hapus pesan ini?')) return;
          socket.emit('anonim-delete', { msgId: id }, () => { toast('Dihapus'); renderInbox(); });
        } else if (b.dataset.act === 'report') {
          if (!confirm('Lapor ke admin?')) return;
          socket.emit('anonim-report', { msgId: id }, () => { toast('Laporan terkirim'); renderInbox(); });
        }
      };
    });
    msgs.forEach(m => { if (!m.read) socket.emit('anonim-mark-read', { msgId: m.id }); });
  });
}

function renderLink() {
  const link = location.origin + '/u/' + profile.username;
  const shareText = 'Kirim pesan anonim ke gue yuk! Klik link ini: ' + link;
  const waUrl = 'https://wa.me/?text=' + encodeURIComponent(shareText);
  const tgUrl = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Kirim pesan anonim ke gue!');
  const twUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText);

  $('sosContent').innerHTML = `
    <div class="sos-card">
      <div class="sos-card-title">🔗 Link Anonim Gua</div>
      <div class="sos-card-sub">Share link ini ke temen / sosmed. Siapa pun yang buka bisa kirim pesan anonim ke lo.</div>
      <div class="sos-link-box">
        <input id="myLink" class="sos-link-input" type="text" readonly value="${esc(link)}" />
        <button id="copyLink" class="sos-copy-btn">📋</button>
      </div>

      <div class="sos-share-title">SHARE KE:</div>
      <div class="sos-share-grid">
        <a href="${waUrl}" target="_self" class="sos-share wa">
          <span>💬</span><span>WhatsApp</span>
        </a>
        <a href="${tgUrl}" target="_self" class="sos-share tg">
          <span>✈️</span><span>Telegram</span>
        </a>
        <a href="${twUrl}" target="_self" class="sos-share tw">
          <span>🐦</span><span>Twitter</span>
        </a>
        <button id="shareNative" class="sos-share native">
          <span>📤</span><span>Lainnya</span>
        </button>
      </div>

      <div class="sos-warn">💡 Username lo: <b>${esc(profile.username)}</b> — gak bisa diganti.</div>
    </div>
  `;

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

  $('shareNative').onclick = () => {
    if (navigator.share) {
      navigator.share({ title: 'Anonim ke gue', text: 'Kirim pesan anonim ke gue!', url: link }).catch(() => {});
    } else {
      $('copyLink').click();
    }
  };
}

// ===== HALAMAN 3: PUBLIK (kirim pesan anonim ke orang lain) =====
function renderPublicSend(username) {
  $('sosMain').innerHTML = `
    <div class="sos-content">
      <div class="sos-card">
        <div class="sos-card-title">🕶️ Kirim Pesan Anonim</div>
        <div class="sos-card-sub">Kirim pesan rahasia ke <b>@${esc(username)}</b>. Dia gak akan tau siapa lo.</div>
        <textarea id="anonText" class="sos-textarea" placeholder="Tulis pesan lo di sini... (rahasia 😉)" maxlength="500" rows="6"></textarea>
        <div class="sos-count"><span id="anonCount">0</span>/500</div>
        <button id="anonSend" class="sos-btn">🚀 KIRIM ANONIM</button>
        <div class="sos-warn">⚠️ Max 30 pesan/hari ke user ini. Pesan toxic bisa dilaporkan ke admin.</div>
        <div id="anonSent" class="sos-sent hidden">
          <div style="font-size:48px">✅</div>
          <div style="font-size:18px;font-weight:800;color:#25d366;margin-top:8px">Terkirim!</div>
          <div style="font-size:12px;color:#667781;margin-top:4px">Mau kirim lagi?</div>
          <button id="sendAgain" class="sos-btn" style="margin-top:16px;background:linear-gradient(135deg,#54656f,#37474f)">🔁 KIRIM LAGI</button>
        </div>
      </div>
    </div>
  `;
  const ta = $('anonText');
  ta.addEventListener('input', () => { $('anonCount').textContent = ta.value.length; });
  $('anonSend').onclick = () => {
    const text = ta.value.trim();
    if (!text) return toast('Pesan kosong');
    $('anonSend').disabled = true;
    socket.emit('anonim-send-to', { username: username, text }, (r) => {
      $('anonSend').disabled = false;
      if (r.error) return toast('❌ ' + r.error);
      $('anonSend').classList.add('hidden');
      ta.classList.add('hidden');
      $('anonCount').classList.add('hidden');
      $('anonSent').classList.remove('hidden');
    });
  };
  ta.focus();
}

// Init
initSocket();
