const socket = io();
const $ = (id) => document.getElementById(id);
let userId = window.__userId || localStorage.getItem('javachat_id');


socket.on('connect', () => {
  socket.emit('join', userId);
  socket.emit('leaderboard-get', (res) => {
    if (!res.ok) return;
    renderLB($('lbCoin'), res.topCoin, 'coins', '💰');
    renderLB($('lbChat'), res.topChat, 'messages', '💬');
  });
});

document.querySelectorAll('[data-lbtab]').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('[data-lbtab]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('lbCoin').classList.toggle('hidden', t.dataset.lbtab !== 'coin');
    $('lbChat').classList.toggle('hidden', t.dataset.lbtab !== 'chat');
  };
});

function renderLB(box, list, field, unit) {
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="lb-row">Belum ada data</div>'; return; }
  list.forEach((u, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (i === 0 ? ' gold' : i === 1 ? ' silver' : i === 2 ? ' bronze' : '');
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1);
    const badge = u.badge === 'admin' ? ' 👑' : u.badge === 'vip' ? ' 💎' : '';
    row.innerHTML = '<div class="rank">' + medal + '</div><div class="lb-name">' + u.username + badge + '</div><div class="lb-val">' + unit + u[field] + '</div>';
    box.appendChild(row);
  });
}
