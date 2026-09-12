const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null;

const DEFS = [
  { id: 'pemula',     icon: '🌱', name: 'Pemula',         desc: 'Kirim 10 pesan',         reward: 20 },
  { id: 'aktif',      icon: '💬', name: 'Aktif',          desc: 'Kirim 100 pesan',        reward: 35 },
  { id: 'addict',     icon: '🔥', name: 'Chat Addict',    desc: 'Kirim 500 pesan',        reward: 125 },
  { id: 'hoki',       icon: '🎰', name: 'Hoki',           desc: 'Menang slot 5x',         reward: 60 },
  { id: 'sultanslot', icon: '💎', name: 'Sultan Slot',    desc: 'Menang slot 50x',        reward: 75 },
  { id: 'dermawan',   icon: '🎁', name: 'Dermawan',       desc: 'Kirim gift coin 5x',     reward: 20 },
  { id: 'penebak',    icon: '🎯', name: 'Penebak Jitu',   desc: 'Menang Tebak Angka 1x',  reward: 20 },
  { id: 'pelempar',   icon: '🎲', name: 'Pelempar Dadu',  desc: 'Menang Dadu 3x',         reward: 30 },
  { id: 'juragan',    icon: '💰', name: 'Juragan',        desc: 'Punya 10.000 coin',      reward: 500 },
  { id: 'sultan',     icon: '👑', name: 'Sultan',         desc: 'Punya 100.000 coin',     reward: 1000 }
];

socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  renderGrid(u);
  document.body.classList.toggle('dark', u.theme === 'dark');
});

function progressFor(a, u) {
  if (!u) return '0%';
  if (a.id === 'pemula' || a.id === 'aktif' || a.id === 'addict') {
    const cur = u.messageCount || 0;
    const tgt = a.id === 'pemula' ? 10 : a.id === 'aktif' ? 100 : 500;
    return Math.min(100, (cur / tgt) * 100) + '%';
  }
  if (a.id === 'hoki' || a.id === 'sultanslot') {
    const cur = (u.ach && u.ach.slotWins) || 0;
    const tgt = a.id === 'hoki' ? 5 : 50;
    return Math.min(100, (cur / tgt) * 100) + '%';
  }
  if (a.id === 'dermawan') {
    const cur = (u.ach && u.ach.giftSent) || 0;
    return Math.min(100, (cur / 5) * 100) + '%';
  }
  if (a.id === 'penebak') {
    const cur = (u.ach && u.ach.tebakWins) || 0;
    return Math.min(100, cur * 100) + '%';
  }
  if (a.id === 'pelempar') {
    const cur = (u.ach && u.ach.daduWins) || 0;
    return Math.min(100, (cur / 3) * 100) + '%';
  }
  if (a.id === 'juragan') {
    return Math.min(100, (u.coins / 10000) * 100) + '%';
  }
  if (a.id === 'sultan') {
    return Math.min(100, (u.coins / 100000) * 100) + '%';
  }
  return '0%';
}

function progressText(a, u) {
  if (!u) return '';
  if (a.id === 'pemula') return (u.messageCount || 0) + ' / 10';
  if (a.id === 'aktif') return (u.messageCount || 0) + ' / 100';
  if (a.id === 'addict') return (u.messageCount || 0) + ' / 500';
  if (a.id === 'hoki') return ((u.ach && u.ach.slotWins) || 0) + ' / 5';
  if (a.id === 'sultanslot') return ((u.ach && u.ach.slotWins) || 0) + ' / 50';
  if (a.id === 'dermawan') return ((u.ach && u.ach.giftSent) || 0) + ' / 5';
  if (a.id === 'penebak') return ((u.ach && u.ach.tebakWins) || 0) + ' / 1';
  if (a.id === 'pelempar') return ((u.ach && u.ach.daduWins) || 0) + ' / 3';
  if (a.id === 'juragan') return (u.coins || 0).toLocaleString('id-ID') + ' / 10.000';
  if (a.id === 'sultan') return (u.coins || 0).toLocaleString('id-ID') + ' / 100.000';
  return '';
}

function renderGrid(u) {
  const grid = $('achGrid');
  grid.innerHTML = '';
  const unlocked = (u.ach && u.ach.unlocked) || {};
  const claimed = (u.ach && u.ach.claimed) || {};
  let count = 0;
  DEFS.forEach(a => {
    const isUnlocked = !!unlocked[a.id];
    const isClaimed = !!claimed[a.id];
    if (isClaimed) count++;
    const card = document.createElement('div');
    card.className = 'ach-card' + (isClaimed ? ' unlocked' : isUnlocked ? ' ready' : '');
    const pct = progressFor(a, u);
    const ptext = progressText(a, u);
    let rightHtml = '';
    if (isClaimed) {
      rightHtml = '<div class="ach-check">OK</div>';
    } else if (isUnlocked) {
      rightHtml = '<button class="ach-claim-btn" data-ach="' + a.id + '">Klaim</button>';
    }
    let midHtml = '';
    if (isClaimed) {
      midHtml = '<div class="ach-reward-done">Udah diklaim - +' + a.reward + ' coin</div>';
    } else if (isUnlocked) {
      midHtml = '<div class="ach-ready-text">Siap diklaim! +' + a.reward + ' coin</div>';
    } else {
      midHtml = '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:' + pct + '"></div></div>' +
                '<div class="ach-progress-text">' + ptext + ' - +' + a.reward + ' coin</div>';
    }
    card.innerHTML =
      '<div class="ach-icon">' + a.icon + '</div>' +
      '<div class="ach-info">' +
        '<div class="ach-name">' + a.name + '</div>' +
        '<div class="ach-desc">' + a.desc + '</div>' +
        midHtml +
      '</div>' +
      rightHtml;
    grid.appendChild(card);
  });
  $('achCount').textContent = count + ' / ' + DEFS.length;

  // Bind tombol klaim
  grid.querySelectorAll('.ach-claim-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.ach;
      btn.disabled = true;
      btn.textContent = '...';
      socket.emit('achievement-claim', { id }, (res) => {
        if (res && res.error) {
          alert('Error: ' + res.error);
          btn.disabled = false;
          btn.textContent = 'Klaim';
          return;
        }
        showClaimPopup(res.reward);
        if (me) me.coins = res.coins;
        // Refresh grid
        if (typeof renderGrid === 'function') renderGrid(me);
      });
    };
  });
}

function showClaimPopup(reward) {
  var p = document.createElement('div');
  p.className = 'ach-popup';
  p.innerHTML = '<div class="ap-icon">🎁</div><div class="ap-info"><div class="ap-title">KLAIM BERHASIL!</div><div class="ap-name">+' + reward + ' coin</div></div>';
  document.body.appendChild(p);
  setTimeout(function(){ p.classList.add('show'); }, 50);
  setTimeout(function(){
    p.classList.remove('show');
    setTimeout(function(){ p.remove(); }, 400);
  }, 3000);
}

socket.on('achievement-ready', function(d) {
  var p = document.createElement('div');
  p.className = 'ach-popup';
  p.innerHTML = '<div class="ap-icon">' + d.icon + '</div><div class="ap-info"><div class="ap-title">ACHIEVEMENT READY!</div><div class="ap-name">' + d.name + ' - Buka & klaim +' + d.reward + ' coin</div></div>';
  document.body.appendChild(p);
  setTimeout(function(){ p.classList.add('show'); }, 50);
  setTimeout(function(){
    p.classList.remove('show');
    setTimeout(function(){ p.remove(); }, 400);
  }, 4000);
});
