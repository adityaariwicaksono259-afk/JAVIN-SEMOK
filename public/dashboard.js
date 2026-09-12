const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;

socket.on('connect', () => {
  socket.emit('join', userId);
  setTimeout(loadStats, 800);
});

function loadStats() {
  socket.emit('admin-dashboard', (res) => {
    if (!res || res.error) {
      $('dashLoading').innerHTML = '⚠️ ' + ((res && res.error) || 'Gagal load') + '<br><br><a href="/admin.html" style="color:#25d366">Login admin dulu</a>';
      return;
    }
    $('dashLoading').classList.add('hidden');
    $('dashMain').classList.remove('hidden');
    const s = res.stats;
    $('dcUsers').textContent = s.totalUsers;
    $('dcOnline').textContent = s.onlineNow;
    $('dcCoins').textContent = fmt(s.totalCoins);
    $('dcMsgs').textContent = fmt(s.totalMessages);
    $('dcBanned').textContent = s.bannedUsers;
    $('dcNewWeek').textContent = s.newWeek;
    $('dcNewToday').textContent = s.newToday;
    $('dcMsgsToday').textContent = s.msgsToday;
    $('dcKas').textContent = fmt(s.kas);
    $('dcGames').textContent = fmt(s.totalGames);
    $('dcTickets').textContent = s.totalTickets;
    $('dcPool').textContent = fmt(s.lotteryPool);
    renderTop('dashTopCoin', res.topCoin, 'coins', '💰');
    renderTop('dashTopChat', res.topChat, 'messages', '💬');
    $('dashFooter').textContent = 'Update terakhir: ' + new Date().toLocaleTimeString('id-ID');
  });
}

function renderTop(id, list, field, unit) {
  const box = $(id);
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="dash-empty">Belum ada data</div>'; return; }
  list.forEach((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1);
    const row = document.createElement('div');
    row.className = 'dash-row';
    row.innerHTML = '<span class="dash-rank">' + medal + '</span><span class="dash-name">' + u.username + '</span><span class="dash-val">' + unit + fmt(u[field]) + '</span>';
    box.appendChild(row);
  });
}

function fmt(n) { return (n || 0).toLocaleString('id-ID'); }

$('refreshBtn').onclick = () => {
  $('dashLoading').textContent = 'Memuat ulang...';
  $('dashLoading').classList.remove('hidden');
  $('dashMain').classList.add('hidden');
  setTimeout(loadStats, 300);
};

setInterval(loadStats, 30000);
