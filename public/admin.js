const socket = io();
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
