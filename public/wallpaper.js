(function(){
  console.log('[WP] loaded');
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

  function getSocket() {
    if (window.__socket) return window.__socket;
    try { if (typeof socket !== 'undefined' && socket) return socket; } catch(e){}
    return null;
  }

  function renderGrid(current){
    var grid = document.getElementById('wpGrid');
    if (!grid) return;
    grid.innerHTML = '';
    walls.forEach(function(w){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'wp-item wp-' + w.id + (w.id === current ? ' active' : '');
      b.innerHTML = '<span class="wp-name">' + w.name + '</span>';
      b.onclick = function(e){
        e.stopPropagation();
        var sk = getSocket();
        if (!sk) { alert('Socket belum siap'); return; }
        sk.emit('wallpaper-set', { wallpaper: w.id }, function(res){
          if (res && res.error) { alert('Error: ' + res.error); return; }
          if (window.__me) window.__me.wallpaper = w.id;
          renderGrid(w.id);
        });
      };
      grid.appendChild(b);
    });
  }

  function openModal(){
    var m = document.getElementById('wpModal');
    if (!m) { alert('Modal wallpaper gak ada'); return; }
    m.classList.remove('hidden');
    renderGrid((window.__me && window.__me.wallpaper) || 'default');
  }

  // Delegated click
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('#wpBtn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openModal();
  }, true);

  // Close handlers
  document.addEventListener('click', function(e){
    var t = e.target;
    if (t.id === 'wpModal') t.classList.add('hidden');
    if (t.dataset && t.dataset.close === 'wpModal') {
      var m = document.getElementById('wpModal');
      if (m) m.classList.add('hidden');
    }
  }, false);

  console.log('[WP] bound');
})();
