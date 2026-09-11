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
  let count = 0;
  DEFS.forEach(a => {
    const isUnlocked = !!unlocked[a.id];
    if (isUnlocked) count++;
    const card = document.createElement('div');
    card.className = 'ach-card' + (isUnlocked ? ' unlocked' : '');
    const pct = progressFor(a, u);
    const ptext = progressText(a, u);
    card.innerHTML =
      '<div class="ach-icon">' + a.icon + '</div>' +
      '<div class="ach-info">' +
        '<div class="ach-name">' + a.name + '</div>' +
        '<div class="ach-desc">' + a.desc + '</div>' +
        (isUnlocked
          ? '<div class="ach-reward-done">Unlocked! +' + a.reward + ' coin</div>'
          : '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:' + pct + '"></div></div>' +
            '<div class="ach-progress-text">' + ptext + ' - +' + a.reward + ' coin</div>'
        ) +
      '</div>' +
      (isUnlocked ? '<div class="ach-check">OK</div>' : '');
    grid.appendChild(card);
  });
  $('achCount').textContent = count + ' / ' + DEFS.length;
}
