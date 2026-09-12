const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let allLogs = [];

socket.on('connect', () => {
  socket.emit('join', userId);
  var tok = localStorage.getItem('admin_token');
  if (tok) {
    socket.emit('admin-verify-token', { token: tok }, function(res) {
      if (res && res.ok) {
        console.log('[LOG] Admin auto-auth OK');
        setTimeout(loadLogs, 500);
      } else {
        console.log('[LOG] Token invalid');
        loadLogs();
      }
    });
  } else {
    setTimeout(loadLogs, 800);
  }
});

function loadLogs() {
  socket.emit('admin-log-get', (res) => {
    if (!res || res.error) {
      $('logList').innerHTML = '<div class="log-loading">⚠️ ' + ((res && res.error) || 'Gagal load') + '<br><br><a href="/admin.html" style="color:#25d366">Login admin dulu</a></div>';
      return;
    }
    allLogs = res.logs || [];
    $('logTotal').textContent = (res.total || 0).toLocaleString('id-ID');
    render();
    $('logFooter').textContent = 'Update terakhir: ' + new Date().toLocaleTimeString('id-ID');
  });
}

function render() {
  const q = ($('logSearch').value || '').toLowerCase().trim();
  const act = $('logActionFilter').value;
  let list = allLogs;
  if (act) list = list.filter(l => l.action === act);
  if (q) list = list.filter(l =>
    (l.admin || '').toLowerCase().includes(q) ||
    (l.target || '').toLowerCase().includes(q) ||
    (l.action || '').toLowerCase().includes(q) ||
    (l.detail || '').toLowerCase().includes(q)
  );

  const box = $('logList');
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<div class="log-loading">Gak ada log.</div>';
    return;
  }
  list.slice(0, 100).forEach(l => {
    const dt = new Date(l.time);
    const timeStr = dt.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const actionIcon = { 'kick':'👢','ban':'🚫','unban':'✅','give-coin':'💰','kas-send':'💵' }[l.action] || '📌';
    const actionColor = { 'kick':'#ff9800','ban':'#d32f2f','unban':'#25d366','give-coin':'#2196f3','kas-send':'#ffd700' }[l.action] || '#999';
    const el = document.createElement('div');
    el.className = 'log-item';
    el.innerHTML =
      '<div class="log-head">' +
        '<span class="log-icon" style="color:' + actionColor + '">' + actionIcon + '</span>' +
        '<span class="log-action" style="color:' + actionColor + '">' + esc(l.action || '').toUpperCase() + '</span>' +
        '<span class="log-time">' + timeStr + '</span>' +
      '</div>' +
      '<div class="log-body">' +
        '<div class="log-row"><span class="log-key">Admin:</span><span class="log-val">' + esc(l.admin || '-') + '</span></div>' +
        '<div class="log-row"><span class="log-key">Target:</span><span class="log-val">' + esc(l.target || '-') + '</span></div>' +
        (l.detail ? '<div class="log-row"><span class="log-key">Detail:</span><span class="log-val">' + esc(l.detail) + '</span></div>' : '') +
      '</div>';
    box.appendChild(el);
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

$('logRefresh').onclick = () => {
  $('logList').innerHTML = '<div class="log-loading">Memuat ulang...</div>';
  setTimeout(loadLogs, 300);
};
$('logSearch').oninput = render;
$('logActionFilter').onchange = render;

setInterval(loadLogs, 30000);
