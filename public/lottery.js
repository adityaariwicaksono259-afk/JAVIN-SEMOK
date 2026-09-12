const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null;
let qty = 2;
let buying = false;
const toastEl = $('toast');
function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  $('lotBalance').textContent = u.coins.toLocaleString('id-ID');
  document.body.classList.toggle('dark', u.theme === 'dark');
  loadState();
});

document.querySelectorAll('.lot-qty').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.lot-qty').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    qty = parseInt(b.dataset.qty);
  };
});

$('lotBuy').onclick = () => {
  if (buying) return;
  if (!me) return toast('Loading...');
  const cost = qty * 500;
  if (me.coins < cost) return toast('Saldo kurang. Butuh ' + cost);
  if (!confirm('Beli ' + qty + ' tiket seharga ' + cost + ' coin?')) return;
  buying = true;
  $('lotBuy').disabled = true;
  socket.emit('lottery-buy', { qty }, (res) => {
    buying = false;
    $('lotBuy').disabled = false;
    if (res.error) return toast('❌ ' + res.error);
    me.coins = res.coins;
    $('lotBalance').textContent = res.coins.toLocaleString('id-ID');
    toast('🎟️ ' + qty + ' tiket terbeli!');
  });
};

socket.on('lottery-updated', (state) => renderState(state));
socket.on('lottery-drawn', (h) => {
  toast('🎉 ' + h.winner + ' menang ' + h.prize.toLocaleString('id-ID') + ' coin!');
  if (me) {
    socket.emit('lottery-state', (res) => {
      if (res && res.ok && me) {
        // refresh balance lewat 'me' event
      }
    });
  }
});

function loadState() {
  socket.emit('lottery-state', (res) => {
    if (res && res.ok) renderState(res.state);
  });
}

function renderState(s) {
  $('lotPool').textContent = (s.pool || 0).toLocaleString('id-ID');
  $('lotTotal').textContent = (s.total || 0) + ' tiket terjual';
  if (s.total === 0) {
    $('lotStatus').textContent = 'Belum ada tiket. Jadi yang pertama!';
  } else if (s.total === 1) {
    $('lotStatus').textContent = '⏳ Tunggu 1 tiket lagi untuk draw otomatis';
  } else {
    $('lotStatus').textContent = '✅ Siap draw! Auto-draw dalam 15 detik';
  }
  // Players
  const pBox = $('lotPlayers');
  pBox.innerHTML = '';
  if (!s.players || !s.players.length) {
    pBox.innerHTML = '<div class="lot-empty">Belum ada pemain</div>';
  } else {
    s.players.sort((a,b) => b.tickets - a.tickets).forEach(p => {
      const d = document.createElement('div');
      d.className = 'lot-player';
      d.innerHTML = '<span class="lot-player-name">' + escapeHtml(p.username) + '</span><span class="lot-player-tickets">' + p.tickets + ' tiket</span>';
      pBox.appendChild(d);
    });
  }
  // History
  const hBox = $('lotHistory');
  hBox.innerHTML = '';
  if (!s.history || !s.history.length) {
    hBox.innerHTML = '<div class="lot-empty">Belum ada pemenang</div>';
  } else {
    s.history.forEach(h => {
      const d = document.createElement('div');
      d.className = 'lot-hist';
      const dt = new Date(h.time);
      d.innerHTML = '<div class="lot-hist-name">🏆 ' + escapeHtml(h.winner) + '</div><div class="lot-hist-info">+' + h.prize.toLocaleString('id-ID') + ' coin · ' + h.totalTickets + ' tiket · ' + dt.toLocaleTimeString('id-ID') + '</div>';
      hBox.appendChild(d);
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

setInterval(() => { if (me) socket.emit('lottery-state', (r) => { if (r && r.ok) renderState(r.state); }); }, 5000);
