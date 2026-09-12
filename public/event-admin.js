(function(){
  console.log('[EV-ADMIN] loaded');
  function getSocket() {
    if (window.__socket) return window.__socket;
    try { if (typeof socket !== 'undefined' && socket) return socket; } catch(e){}
    return null;
  }
  function $(id) { return document.getElementById(id); }

  function showMsg(t, ok) {
    var m = $('evAdminMsg');
    if (!m) return;
    m.textContent = t;
    m.className = 'add-admin-msg ' + (ok ? 'ok' : 'err');
    setTimeout(function(){ m.textContent = ''; m.className = 'add-admin-msg'; }, 4000);
  }

  function render(current) {
    var curBox = $('evAdminCurrent');
    var formBox = $('evForm');
    if (!curBox || !formBox) return;
    if (!current) {
      formBox.style.display = '';
      curBox.innerHTML = '<div class="ev-cur-empty">Belum ada event aktif</div>';
      return;
    }
    formBox.style.display = 'none';
    var total = (current.reward * current.winners).toLocaleString('id-ID');
    curBox.innerHTML =
      '<div class="ev-cur-card">' +
        '<div class="ev-cur-name">EVENT: ' + current.name + '</div>' +
        '<div class="ev-cur-line">Reward: <b>' + current.reward.toLocaleString('id-ID') + '</b> x ' + current.winners + ' pemenang</div>' +
        '<div class="ev-cur-line">Total hold: <b>' + total + '</b> coin</div>' +
        '<div class="ev-cur-line">Peserta: <b>' + current.joiners.length + '</b> orang</div>' +
        '<div class="ev-cur-actions">' +
          '<button class="btn-primary" id="evDrawBtn">DRAW</button>' +
          '<button class="btn-ghost" id="evCancelBtn" style="color:#d32f2f">BATAL</button>' +
        '</div>' +
      '</div>';
    var db = $('evDrawBtn'), cb = $('evCancelBtn');
    if (db) db.onclick = function() {
      if (!confirm('Draw sekarang?')) return;
      var sk = getSocket();
      if (!sk) { alert('Socket belum siap, tunggu bentar'); return; }
      db.disabled = true;
      sk.emit('event-draw', function(res) {
        db.disabled = false;
        if (res && res.error) { alert('ERROR: ' + res.error); return; }
        alert('🎉 Menang: ' + res.winners.join(', '));
      });
    };
    if (cb) cb.onclick = function() {
      if (!confirm('Batalkan event? Coin balik ke lo.')) return;
      var sk = getSocket();
      if (!sk) return showMsg('Socket belum siap', false);
      sk.emit('event-cancel', function(res) {
        if (res && res.error) { alert('ERROR: ' + res.error); return; }
        alert('Dibatalkan');
      });
    };
  }

  function refresh() {
    var sk = getSocket();
    if (!sk) return;
    sk.emit('event-state', function(r) {
      if (r && r.ok) render(r.current);
    });
  }

  // Delegated click untuk BUAT EVENT
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('#evCreateBtn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    console.log('[EV-ADMIN] create clicked');
    var nameI = $('evName'), rewardI = $('evReward'), winnersI = $('evWinners'), durationI = $('evDuration');
    if (!nameI) return showMsg('Form tidak ada', false);
    var name = nameI.value.trim();
    var reward = parseInt(rewardI.value);
    var winners = parseInt(winnersI.value) || 1;
    var durationMin = parseInt(durationI.value) || 10;
    if (!name) return showMsg('Nama event kosong', false);
    if (!reward || reward < 100) return showMsg('Minimal reward 100', false);
    var total = reward * winners;
    if (!confirm('Hold ' + total.toLocaleString('id-ID') + ' coin dari saldo lo?')) return;
    var sk = getSocket();
    if (!sk) return showMsg('Socket belum siap', false);
    btn.disabled = true;
    sk.emit('event-create', { name: name, reward: reward, winners: winners, durationMin: durationMin }, function(res) {
      btn.disabled = false;
      if (res && res.error) { alert('ERROR SERVER: ' + res.error); return; }
      alert('✅ Event berhasil dibuat!');
      nameI.value = ''; rewardI.value = ''; winnersI.value = '1'; durationI.value = '10';
      setTimeout(refresh, 500);
    });
  }, true);

  // Buka halaman event
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('#evOpenBtn');
    if (!btn) return;
    e.preventDefault();
    window.open('/event.html', '_blank');
  }, true);

  setTimeout(refresh, 2000);
  setInterval(refresh, 8000);

  console.log('[EV-ADMIN] bound');
})();
