(function(){
  console.log('[BADGE] loaded');
  var badges = [
    { id: 'dragon',  icon: '🐉', name: 'Naga',    price: 5000 },
    { id: 'alien',   icon: '👽', name: 'Alien',   price: 10000 },
    { id: 'sultan',  icon: '🔥', name: 'Sultan',  price: 25000 },
    { id: 'legend',  icon: '🌟', name: 'Legend',  price: 50000 },
    { id: 'death',   icon: '💀', name: 'Death',   price: 100000 },
    { id: 'emperor', icon: '👑', name: 'Emperor', price: 250000 }
  ];

  function getSocket() {
    if (window.__socket) return window.__socket;
    try { if (typeof socket !== 'undefined' && socket) return socket; } catch(e){}
    return null;
  }

  function render() {
    var grid = document.getElementById('badgeGrid');
    var info = document.getElementById('badgeInfo');
    if (!grid || !window.__me) return;
    var owned = window.__me.ownedBadges || [];
    var active = window.__me.customBadge;
    var activeBadge = null;
    badges.forEach(function(b){ if (b.id === active) activeBadge = b; });
    if (info) {
      info.innerHTML = 'Saldo: <b>' + window.__me.coins.toLocaleString('id-ID') + '</b> coin<br>Badge aktif: <b>' + (activeBadge ? activeBadge.icon + ' ' + activeBadge.name : 'Tidak ada') + '</b>';
    }
    grid.innerHTML = '';
    badges.forEach(function(b){
      var isOwned = owned.indexOf(b.id) >= 0;
      var isActive = active === b.id;
      var card = document.createElement('div');
      card.className = 'badge-card' + (isActive ? ' active' : '') + (isOwned ? ' owned' : ' locked');
      var lockIcon = isOwned ? '' : '<div class="badge-lock">🔒</div>';
      var priceText = isOwned ? (isActive ? '✅ Aktif' : '✅ Punya') : '🔒 Belum dibeli · ' + b.price.toLocaleString('id-ID') + ' coin';
      card.innerHTML = lockIcon + '<div class="badge-icon">' + b.icon + '</div><div class="badge-name">' + b.name + '</div><div class="badge-price">' + priceText + '</div>';
      card.onclick = function(){
        var sk = getSocket();
        if (!sk) return alert('Socket belum siap, tunggu bentar');
        if (!isOwned) {
          if (window.__me.coins < b.price) return alert('Coin kurang. Butuh ' + b.price.toLocaleString('id-ID'));
          if (!confirm('Beli badge ' + b.icon + ' ' + b.name + ' seharga ' + b.price.toLocaleString('id-ID') + ' coin?')) return;
          sk.emit('badge-buy', { badgeId: b.id }, function(res){
            if (res && res.error) return alert('Error: ' + res.error);
            if (window.__me) { window.__me.coins = res.coins; window.__me.ownedBadges.push(b.id); window.__me.customBadge = b.id; }
            render();
          });
        } else if (isActive) {
          sk.emit('badge-set', { badgeId: null }, function(res){
            if (res && res.error) return alert('Error: ' + res.error);
            if (window.__me) window.__me.customBadge = null;
            render();
          });
        } else {
          sk.emit('badge-set', { badgeId: b.id }, function(res){
            if (res && res.error) return alert('Error: ' + res.error);
            if (window.__me) window.__me.customBadge = b.id;
            render();
          });
        }
      };
      grid.appendChild(card);
    });
  }

  function openModal() {
    var m = document.getElementById('badgeModal');
    if (!m) { alert('Modal tidak ada. Cek HTML.'); return; }
    m.classList.remove('hidden');
    render();
  }

  // Event delegation — anti gagal
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('#badgeBtn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openModal();
  }, true);

  document.addEventListener('click', function(e){
    var t = e.target;
    if (t.id === 'badgeModal') t.classList.add('hidden');
    if (t.dataset && t.dataset.close === 'badgeModal') {
      var m = document.getElementById('badgeModal');
      if (m) m.classList.add('hidden');
    }
  });

  // Listen me update
  try {
    if (typeof socket !== 'undefined') {
      socket.on('me', function(u){ window.__me = u; });
    }
  } catch(e){}

  console.log('[BADGE] bound');
})();
