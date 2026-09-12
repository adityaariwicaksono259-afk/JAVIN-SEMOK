const socket = io();
window.__socket = socket;
const $ = (id) => document.getElementById(id);
let userId = window.__userId || localStorage.getItem('javachat_id');

let isAdmin = false;
const toastEl = $('toast');

function toast(msg, ms = 2500) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), ms);
}

socket.on('connect', () => { socket.emit('join', userId); });

$('adminLoginConfirm').onclick = () => {
  const pw = $('adminPass').value;
  $('adminLoginErr').textContent = '';
  socket.emit('admin-login', { password: pw }, (res) => {
    if (res.error) return $('adminLoginErr').textContent = res.error;
    isAdmin = true;
    if (res.adminToken) localStorage.setItem('admin_token', res.adminToken);
    $('adminLoginBox').classList.add('hidden');
    $('adminPanelBox').classList.remove('hidden');
    loadAdminList();
    toast('🛠️ Admin mode aktif');
  });
};
$('adminPass').addEventListener('keydown', e => { if (e.key === 'Enter') $('adminLoginConfirm').click(); });

document.querySelectorAll('[data-atab]').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('[data-atab]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('adminUsersTab').classList.toggle('hidden', t.dataset.atab !== 'users');
    $('adminTopupsTab').classList.toggle('hidden', t.dataset.atab !== 'topups');
  };
});

function loadAdminList() {
  socket.emit('admin-list', (res) => {
    if (res.error) return toast('❌ ' + res.error);
    renderAdminUsers(res.users);
    renderAdminTopups(res.topups);
  
    if (res && res.users && window.__updateKasUsers) window.__updateKasUsers(res.users);
  });
}

function renderAdminUsers(users) {
  const box = $('adminUsersTab');
  box.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'admin-item';
    const banBtn = u.banned
      ? '<button class="a-unban" data-act="unban" data-id="' + u.userId + '">Unban</button>'
      : '<button class="a-ban" data-act="ban" data-id="' + u.userId + '">Ban</button>';
    const badgeLabel = u.badge === 'admin' ? ' 👑' : (u.badge === 'vip' ? ' 💎' : '');
    const adminBtn = u.badge === 'admin'
      ? '<button class="a-rmadmin" data-act="remove-admin" data-id="' + u.userId + '">Cabut Admin</button>'
      : '<button class="a-addadmin" data-act="add-admin" data-id="' + u.userId + '">+Admin</button>';
    div.innerHTML = '<div class="row1"><span class="uname"><span class="dot ' + (u.banned ? 'ban' : (u.online ? 'on' : '')) + '"></span>' + u.username + badgeLabel + '</span><span>' + u.coins + ' 💰</span></div><div class="admin-actions"><button class="a-kick" data-act="kick" data-id="' + u.userId + '">Kick</button><button class="a-coin" data-act="give-coin" data-id="' + u.userId + '">+Coin</button>' + banBtn + adminBtn + '</div>';
    box.appendChild(div);
  });
  box.querySelectorAll('button[data-act]').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.act;
      const targetUserId = btn.dataset.id;
      let amount;
      if (action === 'give-coin') {
        const a = prompt('Berapa coin?', '100');
        if (!a) return;
        amount = parseInt(a);
        if (!amount || amount <= 0) return toast('Jumlah invalid');
      }
      if (action === 'remove-admin') {
        if (!confirm('Cabut admin dari user ini?')) return;
        socket.emit('admin-remove-admin', { userId: targetUserId }, (res) => {
          if (res && res.error) return toast('Error: ' + res.error);
          toast('Admin dicabut');
          loadAdminList();
        });
        return;
      }
      if (action === 'add-admin') {
        const uname = btn.closest('.admin-item').querySelector('.uname').textContent.trim().replace(/ 👑| 💎/g, '').trim();
        if (!confirm('Jadikan ' + uname + ' admin chat?')) return;
        socket.emit('admin-add-admin', { username: uname }, (res) => {
          if (res && res.error) return toast('Error: ' + res.error);
          toast(uname + ' jadi admin');
          loadAdminList();
        });
        return;
      }
      socket.emit('admin-action', { action, targetUserId, amount }, (res) => {
        if (res.error) return toast('❌ ' + res.error);
        toast('✅ ' + res.msg);
        loadAdminList();
      });
    };
  });
}

function renderAdminTopups(list) {
  const box = $('adminTopupsTab');
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="admin-item">Belum ada request top-up</div>'; return; }
  list.forEach(t => {
    const div = document.createElement('div');
    div.className = 'topup-item';
    const noteHtml = t.note ? '<div style="font-size:12px;color:#667781;margin-top:4px">📝 ' + t.note + '</div>' : '';
    const actHtml = t.status === 'pending'
      ? '<div class="admin-actions" style="margin-top:8px"><button class="a-coin" data-tid="' + t.id + '" data-tact="approve">✅ Approve</button><button class="a-ban" data-tid="' + t.id + '" data-tact="reject">❌ Tolak</button></div>'
      : '';
    div.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><b>' + t.username + '</b><span class="status ' + t.status + '">' + t.status + '</span></div><div>' + t.amount + ' coin via <b>' + t.method + '</b></div>' + noteHtml + actHtml;
    box.appendChild(div);
  });
  box.querySelectorAll('button[data-tid]').forEach(btn => {
    btn.onclick = () => {
      socket.emit('admin-topup-action', { id: btn.dataset.tid, action: btn.dataset.tact }, (res) => {
        if (res.error) return toast('❌ ' + res.error);
        toast('✅ Diproses');
        loadAdminList();
      });
    };
  });
}

socket.on('topup-new', () => { if (isAdmin) loadAdminList(); });
// ===== ADD ADMIN =====
(function(){
  var input = document.getElementById('addAdminInput');
  var btn = document.getElementById('addAdminBtn');
  var msg = document.getElementById('addAdminMsg');
  if (!input || !btn) return;

  function show(t, ok) {
    msg.textContent = t;
    msg.className = 'add-admin-msg ' + (ok ? 'ok' : 'err');
    setTimeout(function(){ msg.textContent = ''; msg.className = 'add-admin-msg'; }, 4000);
  }

  btn.onclick = function(){
    var name = (input.value || '').trim();
    if (!name) return show('Masukin username dulu', false);
    socket.emit('admin-add-admin', { username: name }, function(res){
      if (res && res.error) return show('Error: ' + res.error, false);
      show(res.username + ' sekarang jadi ADMIN chat', true);
      input.value = '';
      if (typeof loadAdminList === 'function') loadAdminList();
    });
  };
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') btn.click(); });
})();

// ===== MAINTENANCE MODE =====
(function(){
  var toggle = document.getElementById('mtToggle');
  var status = document.getElementById('mtStatus');
  var input = document.getElementById('mtInput');
  var msg = document.getElementById('mtMsg');
  if (!toggle) return;
  var mtActive = false;

  function render() {
    status.textContent = mtActive ? 'ON' : 'OFF';
    status.className = mtActive ? 'mt-on' : 'mt-off';
    toggle.textContent = mtActive ? 'MATIKAN' : 'AKTIFKAN';
    toggle.className = 'mt-switch ' + (mtActive ? 'mt-switch-on' : '');
  }

  function showMsg(t, ok) {
    msg.textContent = t;
    msg.className = 'add-admin-msg ' + (ok ? 'ok' : 'err');
    setTimeout(function(){ msg.textContent = ''; msg.className = 'add-admin-msg'; }, 4000);
  }

  socket.on('maintenance-changed', function(d) {
    if (d) { mtActive = !!d.active; render(); }
  });

  // Cek status awal
  setTimeout(function() {
    socket.emit('maintenance-check', function(r) {
      if (r && r.maintenance) { mtActive = !!r.maintenance.active; render(); }
    });
  }, 1500);

  toggle.onclick = function() {
    var target = !mtActive;
    var text = input.value.trim();
    if (target && !text) return showMsg('Isi pesan maintenance dulu', false);
    if (target && !confirm('Aktifkan maintenance? Semua user bakal diblok.')) return;
    if (!target && !confirm('Matikan maintenance?')) return;
    socket.emit('admin-maintenance', { active: target, message: text }, function(res) {
      if (res && res.error) return showMsg('Error: ' + res.error, false);
      mtActive = !!(res && res.maintenance && res.maintenance.active);
      render();
      showMsg(mtActive ? 'Maintenance ON' : 'Maintenance OFF', true);
      input.value = '';
    });
  };
})();

// ===== KAS EVENT =====
(function(){
  var kasVal = document.getElementById('kasVal');
  var kasUser = document.getElementById('kasUser');
  var kasResults = document.getElementById('kasResults');
  var kasSelected = document.getElementById('kasSelected');
  var kasAmount = document.getElementById('kasAmount');
  var kasSend = document.getElementById('kasSend');
  var kasMsg = document.getElementById('kasMsg');
  if (!kasVal) return;

  var selectedUser = null;
  var allUsers = [];

  function showMsg(t, ok) {
    kasMsg.textContent = t;
    kasMsg.className = 'add-admin-msg ' + (ok ? 'ok' : 'err');
    setTimeout(function(){ kasMsg.textContent = ''; kasMsg.className = 'add-admin-msg'; }, 4000);
  }

  function refreshKas() {
    socket.emit('admin-kas-get', function(res){
      if (res && res.ok) kasVal.textContent = (res.kas || 0).toLocaleString('id-ID');
    });
  }

  // Load users setelah login
  var origLoad = window.loadAdminList;
  socket.on('connect', function() { setTimeout(refreshKas, 2000); });

  kasUser.addEventListener('input', function(){
    var q = kasUser.value.toLowerCase().trim();
    kasResults.innerHTML = '';
    if (!q) return;
    var matches = allUsers.filter(function(u){ return u.username.toLowerCase().indexOf(q) >= 0; }).slice(0, 5);
    matches.forEach(function(u){
      var d = document.createElement('div');
      d.className = 'kas-result-item';
      d.innerHTML = '<b>' + u.username + '</b> <span>' + (u.coins || 0) + ' coin</span>';
      d.onclick = function(){
        selectedUser = u;
        kasUser.value = u.username;
        kasResults.innerHTML = '';
        kasSelected.innerHTML = '✅ Dipilih: <b>' + u.username + '</b> (userId: ' + u.userId.slice(0, 8) + '...)';
      };
      kasResults.appendChild(d);
    });
  });

  kasSend.onclick = function(){
    if (!selectedUser) return showMsg('Pilih user dulu', false);
    var amt = parseInt(kasAmount.value);
    if (!amt || amt < 1) return showMsg('Jumlah invalid', false);
    if (!confirm('Kirim ' + amt + ' coin ke ' + selectedUser.username + '?')) return;
    kasSend.disabled = true;
    socket.emit('admin-kas-send', { targetUserId: selectedUser.userId, amount: amt }, function(res){
      kasSend.disabled = false;
      if (res && res.error) return showMsg('Error: ' + res.error, false);
      kasVal.textContent = (res.kas || 0).toLocaleString('id-ID');
      showMsg('✅ ' + amt + ' coin terkirim ke ' + selectedUser.username, true);
      kasAmount.value = '';
      selectedUser = null;
      kasSelected.innerHTML = '';
      kasUser.value = '';
      if (typeof loadAdminList === 'function') loadAdminList();
    });
  };

  // Simpan users dari admin-list
  var origRender = window.renderAdminUsers;
  socket.on('admin-list-response', function(d){ /* noop */ });

  // Expose function buat update allUsers
  window.__updateKasUsers = function(users) { allUsers = users; };

  // Auto refresh kas tiap 10 detik
  setInterval(function(){ if (kasVal && kasVal.textContent !== '0') refreshKas(); }, 10000);
})();

// ===== ADMIN EVENT =====
(function(){
  var nameI = document.getElementById('evName');
  var rewardI = document.getElementById('evReward');
  var winnersI = document.getElementById('evWinners');
  var durationI = document.getElementById('evDuration');
  var createB = document.getElementById('evCreateBtn');
  var msg = document.getElementById('evAdminMsg');
  var curBox = document.getElementById('evAdminCurrent');
  var formBox = document.getElementById('evForm');
  if (!nameI) return;

  function showMsg(t, ok) {
    msg.textContent = t;
    msg.className = 'add-admin-msg ' + (ok ? 'ok' : 'err');
    setTimeout(function(){ msg.textContent = ''; msg.className = 'add-admin-msg'; }, 4000);
  }

  function render(current) {
    if (!current) {
      formBox.style.display = '';
      curBox.innerHTML = '<div class="ev-cur-empty">Belum ada event aktif</div>';
      return;
    }
    formBox.style.display = 'none';
    var total = (current.reward * current.winners).toLocaleString('id-ID');
    curBox.innerHTML =
      '<div class="ev-cur-card">' +
        '<div class="ev-cur-name">🎁 ' + current.name + '</div>' +
        '<div class="ev-cur-line">Reward: <b>' + current.reward.toLocaleString('id-ID') + '</b> coin × ' + current.winners + ' pemenang</div>' +
        '<div class="ev-cur-line">Total hold: <b>' + total + '</b> coin</div>' +
        '<div class="ev-cur-line">Peserta: <b>' + current.joiners.length + '</b> orang</div>' +
        '<div class="ev-cur-actions">' +
          '<button class="btn-primary" id="evDrawBtn">🎲 DRAW SEKARANG</button>' +
          '<button class="btn-ghost" id="evCancelBtn" style="color:#d32f2f">❌ BATALKAN</button>' +
        '</div>' +
      '</div>';
    var drawB = document.getElementById('evDrawBtn');
    var cancelB = document.getElementById('evCancelBtn');
    if (drawB) drawB.onclick = function() {
      if (!confirm('Draw pemenang sekarang?')) return;
      if (current.joiners.length === 0) return showMsg('Belum ada yang join', false);
      drawB.disabled = true;
      socket.emit('event-draw', function(res) {
        drawB.disabled = false;
        if (res && res.error) return showMsg('Error: ' + res.error, false);
        showMsg('🎉 Pemenang: ' + res.winners.join(', ') + ' (refund: ' + res.refund + ')', true);
        setTimeout(function(){ socket.emit('event-state', function(r){ if (r) render(r.current); }); }, 1500);
      });
    };
    if (cancelB) cancelB.onclick = function() {
      if (!confirm('Batalkan event? Coin hold bakal balik ke lo.')) return;
      socket.emit('event-cancel', function(res) {
        if (res && res.error) return showMsg('Error: ' + res.error, false);
        showMsg('Event dibatalkan', true);
        setTimeout(function(){ socket.emit('event-state', function(r){ if (r) render(r.current); }); }, 800);
      });
    };
  }

  createB.onclick = function() {
    var name = nameI.value.trim();
    var reward = parseInt(rewardI.value);
    var winners = parseInt(winnersI.value) || 1;
    var durationMin = parseInt(durationI.value) || 10;
    if (!name) return showMsg('Nama event kosong', false);
    if (!reward || reward < 100) return showMsg('Minimal reward 100 coin', false);
    var total = reward * winners;
    if (!confirm('Hold ' + total.toLocaleString('id-ID') + ' coin dari saldo lo?\nReward: ' + reward + ' × ' + winners + ' pemenang')) return;
    createB.disabled = true;
    socket.emit('event-create', { name: name, reward: reward, winners: winners, durationMin: durationMin }, function(res) {
      createB.disabled = false;
      if (res && res.error) return showMsg('Error: ' + res.error, false);
      showMsg('✅ Event dibuat!', true);
      nameI.value = ''; rewardI.value = ''; winnersI.value = '1'; durationI.value = '10';
      socket.emit('event-state', function(r){ if (r) render(r.current); });
    });
  };

  document.getElementById('evOpenBtn').onclick = function() {
    window.open('/event.html', '_blank');
  };

  // Load awal
  setTimeout(function() {
    socket.emit('event-state', function(r){ if (r) render(r.current); });
  }, 1500);

  // Auto-refresh tiap 8 detik
  setInterval(function() {
    socket.emit('event-state', function(r){ if (r) render(r.current); });
  }, 8000);
})();
