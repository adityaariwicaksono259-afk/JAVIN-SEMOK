const socket = io();
window.__socket = socket;

// Gift notif handler
socket.on("gift-received", function(d) { if (window.__toast) window.__toast("🎁 " + d.from + " kirim " + d.amount + " coin!"); });
const $ = (id) => document.getElementById(id);
let userId = window.__userId || localStorage.getItem('javachat_id');

let me = null;
const toastEl = $('toast');

function toast(msg, ms = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), ms);
}
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(b => {
  b.onclick = () => closeModal(b.dataset.close);
});

socket.on('connect', () => { socket.emit('join', userId); });

socket.on('me', (u) => {
  me = u;
  renderProfile();
  document.body.classList.toggle('dark', u.theme === 'dark');
});

socket.on('user-updated', ({ userId: uid, username, badge }) => {
  if (uid === userId && me) {
    me.username = username;
    me.badge = badge;
    renderProfile();
  }
});

function renderProfile() {
  if (!me) return;
  $('profileCard').innerHTML = `
    <div class="profile-row"><span class="label">Username</span><span class="value">${me.username}</span></div>
    <div class="profile-row"><span class="label">Badge</span><span class="value">${me.badge || 'member'}</span></div>
    <div class="profile-row"><span class="label">Coin</span><span class="value">${me.coins} 💰</span></div>
    <div class="profile-row"><span class="label">Total Pesan</span><span class="value">${me.messageCount || 0}</span></div>
    <div class="profile-row"><span class="label">Ganti Nama Gratis</span><span class="value">${me.freeRenameLeft}x</span></div>
    <div class="profile-row"><span class="label">Total Ganti Nama</span><span class="value">${me.renameCount}x</span></div>
  `;
}

$('dailyBtn').onclick = () => {
  socket.emit('daily-claim', (res) => {
    if (res.error) return toast('⏰ ' + res.error);
    me = res.user; renderProfile();
    toast('🎁 +' + res.amount + ' coin! Total: ' + me.coins);
  });
};

$('renameBtn').onclick = () => {
  if (!me) return;
  $('walletInfo').innerHTML = 'Saldo coin: <b>' + me.coins + '</b><br>Ganti nama gratis: <b>' + me.freeRenameLeft + 'x lagi</b><br><span style="font-size:12px">Setelah gratis habis, tiap ganti butuh <b>50 coin</b>.</span>';
  $('newNameInput').value = '';
  $('renameErr').textContent = '';
  openModal('renameModal');
  setTimeout(() => $('newNameInput').focus(), 100);
};
$('renameConfirm').onclick = () => {
  const n = $('newNameInput').value.trim();
  $('renameErr').textContent = '';
  if (!n) return $('renameErr').textContent = 'Isi nama dulu';
  socket.emit('rename', { newName: n }, (res) => {
    if (res.error) return $('renameErr').textContent = res.error;
    me = res.user; renderProfile();
    closeModal('renameModal');
    toast(res.cost > 0 ? 'Nama diganti (-' + res.cost + ' coin)' : 'Nama diganti (gratis)');
  });
};
$('newNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('renameConfirm').click(); });

$('topupBtn').onclick = () => {
  $('topupAmount').value = ''; $('topupNote').value = ''; $('topupErr').textContent = '';
  openModal('topupModal');
};
$('topupConfirm').onclick = () => {
  const amount = parseInt($('topupAmount').value);
  const method = $('topupMethod').value;
  const note = $('topupNote').value.trim();
  $('topupErr').textContent = '';
  if (!amount || amount < 1000) return $('topupErr').textContent = 'Minimal 1000 coin';
  socket.emit('topup-request', { amount, method, note }, (res) => {
    if (res.error) return $('topupErr').textContent = res.error;
    closeModal('topupModal');
    toast('✅ Request terkirim, tunggu approve admin');
  });
};

$('themeBtn').onclick = () => {
  const newTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
  document.body.classList.toggle('dark', newTheme === 'dark');
  socket.emit('theme-set', { theme: newTheme });
};
// ===== GIFT COIN =====
(function(){
  const gBtn = document.getElementById('giftBtn');
  const gModal = document.getElementById('giftModal');
  const gSelect = document.getElementById('giftUserSelect');
  const gAmount = document.getElementById('giftAmount');
  const gConfirm = document.getElementById('giftConfirm');
  const gErr = document.getElementById('giftErr');
  const gInfo = document.getElementById('giftWalletInfo');
  if (!gBtn || !gModal) return;

  function closeModal(){ gModal.classList.add('hidden'); }
  document.querySelectorAll('[data-close="giftModal"]').forEach(b => b.onclick = closeModal);
  gModal.onclick = e => { if (e.target === gModal) closeModal(); };

  gBtn.onclick = () => {
    if (!window.__me) { alert('Tunggu load...'); return; }
    gInfo.innerHTML = 'Saldo lo: <b>' + window.__me.coins + '</b> coin';
    gAmount.value = '';
    gErr.textContent = '';
    gSelect.innerHTML = '<option value="">-- Pilih penerima --</option>';
    window.__socket.emit('users-all', (res) => {
      if (res && res.ok) {
        res.users.forEach(u => {
          const o = document.createElement('option');
          o.value = u.userId;
          o.textContent = u.username + (u.badge === 'vip' ? ' 💎' : u.badge === 'admin' ? ' 👑' : '');
          gSelect.appendChild(o);
        });
      }
    });
    gModal.classList.remove('hidden');
  };

  gConfirm.onclick = () => {
    const to = gSelect.value;
    const amt = parseInt(gAmount.value);
    gErr.textContent = '';
    if (!to) return gErr.textContent = 'Pilih penerima';
    if (!amt || amt < 1) return gErr.textContent = 'Minimal 1 coin';
    window.__socket.emit('gift-coin', { toUserId: to, amount: amt }, (res) => {
      if (res && res.error) return gErr.textContent = '❌ ' + res.error;
      if (window.__toast) window.__toast('🎁 Terkirim ' + amt + ' coin!');
      else alert('🎁 Terkirim ' + amt + ' coin!');
      if (window.__me) window.__me.coins = res.coins;
      if (typeof window.__renderProfile === 'function') window.__renderProfile();
      closeModal();
    });
  };
})();

// ===== BUBBLE COLOR =====
(function(){
  var colors = ['#d9fdd3','#bbdefb','#e1bee7','#fff9c4','#ffcdd2','#ffe0b2','#f8bbd0','#cfd8dc','#b2dfdb','#d7ccc8','#c5cae9','#ffcc80'];
  var bBtn = document.getElementById('bubbleBtn');
  var bModal = document.getElementById('bubbleModal');
  var bGrid = document.getElementById('bubbleGrid');
  if (!bBtn || !bModal) return;
  document.querySelectorAll('[data-close="bubbleModal"]').forEach(function(b){ b.onclick = function(){ bModal.classList.add('hidden'); }; });
  bModal.onclick = function(e){ if (e.target === bModal) bModal.classList.add('hidden'); };
  function renderGrid(current){
    bGrid.innerHTML = '';
    colors.forEach(function(c){
      var b = document.createElement('button');
      b.className = 'bubble-color-item' + (c === current ? ' active' : '');
      b.style.background = c;
      b.onclick = function(){
        socket.emit('bubble-set', { color: c }, function(res){
          if (res && res.error) { if (window.__toast) window.__toast('Error: ' + res.error); return; }
          if (window.__me) window.__me.bubbleColor = c;
          renderGrid(c);
          if (window.__toast) window.__toast('Warna diubah!');
        });
      };
      bGrid.appendChild(b);
    });
  }
  bBtn.onclick = function(){
    bModal.classList.remove('hidden');
    renderGrid((window.__me && window.__me.bubbleColor) || '#d9fdd3');
  };
})();

// ===== ACHIEVEMENT BTN =====
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('#achBtn');
  if (b) { location.href = '/achievement.html'; }
});

// Notif unlock
socket.on('achievement-unlocked', function(d){
  showAchPopup(d);
  if (window.__me) window.__me.coins = d.coins;
  if (typeof window.__renderProfile === 'function') window.__renderProfile();
});

function showAchPopup(d){
  var p = document.createElement('div');
  p.className = 'ach-popup';
  p.innerHTML = '<div class="ap-icon">' + d.icon + '</div><div class="ap-info"><div class="ap-title">ACHIEVEMENT UNLOCKED!</div><div class="ap-name">' + d.name + '</div><div class="ap-reward">+' + d.reward + ' coin</div></div>';
  document.body.appendChild(p);
  setTimeout(function(){ p.classList.add('show'); }, 50);
  setTimeout(function(){
    p.classList.remove('show');
    setTimeout(function(){ p.remove(); }, 400);
  }, 4000);
}

// ===== WALLPAPER =====
(function(){
  var walls = [
    { id: 'default', name: 'Default' },
    { id: 'dark',    name: 'Dark' },
    { id: 'sunset',  name: 'Sunset' },
    { id: 'ocean',   name: 'Ocean' },
    { id: 'forest',  name: 'Forest' },
    { id: 'purple',  name: 'Purple' },
    { id: 'candy',   name: 'Candy' },
    { id: 'night',   name: 'Night' },
    { id: 'fire',    name: 'Fire' },
    { id: 'mint',    name: 'Mint' },
    { id: 'peach',   name: 'Peach' },
    { id: 'space',   name: 'Space' }
  ];
  var btn = document.getElementById('wpBtn');
  var modal = document.getElementById('wpModal');
  var grid = document.getElementById('wpGrid');
  if (!btn || !modal || !grid) return;

  document.querySelectorAll('[data-close="wpModal"]').forEach(function(b){ b.onclick = function(){ modal.classList.add('hidden'); }; });
  modal.onclick = function(e){ if (e.target === modal) modal.classList.add('hidden'); };

  function renderGrid(current){
    grid.innerHTML = '';
    walls.forEach(function(w){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'wp-item wp-' + w.id + (w.id === current ? ' active' : '');
      b.innerHTML = '<span class="wp-name">' + w.name + '</span>';
      b.onclick = function(){
        if (typeof socket === 'undefined') return;
        socket.emit('wallpaper-set', { wallpaper: w.id }, function(res){
          if (res && res.error) { alert('Error: ' + res.error); return; }
          if (window.__me) window.__me.wallpaper = w.id;
          renderGrid(w.id);
        });
      };
      grid.appendChild(b);
    });
  }

  btn.onclick = function(){
    modal.classList.remove('hidden');
    renderGrid((window.__me && window.__me.wallpaper) || 'default');
  };
})();
