const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null;
let currentEvent = null;
let tickTimer = null;

const toastEl = $('toast');
function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

socket.on('connect', () => {
  socket.emit('join', userId);
  setTimeout(loadState, 800);
});

socket.on('me', (u) => {
  me = u;
  $('evBalance').textContent = u.coins.toLocaleString('id-ID');
  document.body.classList.toggle('dark', u.theme === 'dark');
});

socket.on('event-updated', (ev) => {
  currentEvent = ev;
  render();
});
socket.on('event-drawn', (h) => {
  toast('🎉 ' + h.winners.join(', ') + ' menang ' + h.reward + ' coin!');
  setTimeout(loadState, 1500);
});

function loadState() {
  socket.emit('event-state', (res) => {
    if (!res || !res.ok) return;
    currentEvent = res.current;
    render();
    renderHistory(res.history || []);
  });
}

function render() {
  const box = $('evBox');
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }

  if (!currentEvent) {
    box.innerHTML = '<div class="ev-empty">Belum ada event aktif. Sabar ya 🎁</div>';
    return;
  }

  const ev = currentEvent;
  const isJoined = ev.joiners.find(j => j.uid === userId);
  const isAdmin = ev.adminUid === userId;
  const timeLeft = Math.max(0, ev.endsAt - Date.now());
  const mm = String(Math.floor(timeLeft / 60000)).padStart(2, '0');
  const ss = String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0');

  box.innerHTML =
    '<div class="ev-card">' +
      '<div class="ev-head">' +
        '<div class="ev-icon">🎁</div>' +
        '<div class="ev-name">' + esc(ev.name) + '</div>' +
      '</div>' +
      '<div class="ev-info">' +
        '<div class="ev-row"><span class="ev-key">Hadiah</span><span class="ev-val">' + ev.reward.toLocaleString('id-ID') + ' coin</span></div>' +
        '<div class="ev-row"><span class="ev-key">Pemenang</span><span class="ev-val">' + ev.winners + ' orang</span></div>' +
        '<div class="ev-row"><span class="ev-key">Total Pool</span><span class="ev-val">' + ev.totalHold.toLocaleString('id-ID') + ' coin</span></div>' +
        '<div class="ev-row"><span class="ev-key">Host</span><span class="ev-val">' + esc(ev.adminName) + '</span></div>' +
        '<div class="ev-row"><span class="ev-key">Peserta</span><span class="ev-val">' + ev.joiners.length + ' orang</span></div>' +
        '<div class="ev-row"><span class="ev-key">Sisa Waktu</span><span class="ev-val ev-timer" id="evTimer">' + mm + ':' + ss + '</span></div>' +
      '</div>' +
      (isAdmin
        ? '<div class="ev-note">👑 Lo admin event ini — draw lewat panel admin</div>'
        : isJoined
          ? '<button class="ev-join-btn ev-joined" disabled>✅ Udah Join</button>'
          : '<button class="ev-join-btn" id="evJoinBtn">🎯 JOIN EVENT</button>'
      ) +
      '<div class="ev-joiners-title">Peserta:</div>' +
      '<div class="ev-joiners">' + (ev.joiners.length ? ev.joiners.map(j => '<span class="ev-join-item">' + esc(j.username) + '</span>').join('') : '<span class="ev-empty-small">Belum ada yang join</span>') + '</div>' +
    '</div>';

  const btn = $('evJoinBtn');
  if (btn) {
    btn.onclick = () => {
      btn.disabled = true;
      btn.textContent = 'Joining...';
      socket.emit('event-join', (res) => {
        if (res && res.error) {
          toast('❌ ' + res.error);
          btn.disabled = false;
          btn.textContent = '🎯 JOIN EVENT';
          return;
        }
        toast('🎉 Lo join event!');
      });
    };
  }

  tickTimer = setInterval(() => {
    if (!currentEvent) return;
    const left = Math.max(0, currentEvent.endsAt - Date.now());
    const m2 = String(Math.floor(left / 60000)).padStart(2, '0');
    const s2 = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
    const t = $('evTimer');
    if (t) t.textContent = m2 + ':' + s2;
    if (left <= 0) {
      clearInterval(tickTimer);
      tickTimer = null;
      // Timeout — tunggu admin draw
      const st = $('evTimer');
      if (st) st.textContent = '⏰ Waktu habis, tunggu admin draw';
    }
  }, 1000);
}

function renderHistory(list) {
  const box = $('evHistory');
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<div class="ev-empty">Belum ada riwayat</div>';
    return;
  }
  list.forEach(h => {
    const dt = new Date(h.time);
    const timeStr = dt.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const el = document.createElement('div');
    el.className = 'ev-hist-item';
    el.innerHTML =
      '<div class="ev-hist-name">🎁 ' + esc(h.name) + '</div>' +
      '<div class="ev-hist-line">Pemenang: <b>' + h.winners.map(esc).join(', ') + '</b></div>' +
      '<div class="ev-hist-line">Hadiah: ' + h.reward.toLocaleString('id-ID') + ' coin · ' + h.totalJoin + ' peserta</div>' +
      '<div class="ev-hist-time">' + timeStr + ' · Host: ' + esc(h.adminName) + '</div>';
    box.appendChild(el);
  });
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

setInterval(() => { if (me) $('evBalance').textContent = me.coins.toLocaleString('id-ID'); }, 3000);
setInterval(loadState, 15000);
