(function(){
  console.log('[BUBBLE] v2 loaded');
  var colors = ['#d9fdd3','#bbdefb','#e1bee7','#fff9c4','#ffcdd2','#ffe0b2','#f8bbd0','#cfd8dc','#b2dfdb','#d7ccc8','#c5cae9','#ffcc80'];

  function getSocket() {
    if (window.__socket) return window.__socket;
    try { if (typeof socket !== 'undefined' && socket) return socket; } catch(e){}
    return null;
  }

  function findEl(id){ return document.getElementById(id); }

  function renderGrid(current){
    var bGrid = findEl('bubbleGrid');
    if (!bGrid) return;
    bGrid.innerHTML = '';
    colors.forEach(function(c){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bubble-color-item' + (c === current ? ' active' : '');
      b.style.background = c;
      b.onclick = function(e){
        e.stopPropagation();
        var sk = getSocket();
        if (!sk) { alert('Socket belum siap'); return; }
        sk.emit('bubble-set', { color: c }, function(res){
          if (res && res.error) { alert('Error: ' + res.error); return; }
          if (window.__me) window.__me.bubbleColor = c;
          renderGrid(c);
        });
      };
      bGrid.appendChild(b);
    });
  }

  function openModal(){
    console.log('[BUBBLE] open');
    var bModal = findEl('bubbleModal');
    if (!bModal) { alert('Modal bubble tidak ditemukan'); return; }
    bModal.classList.remove('hidden');
    renderGrid((window.__me && window.__me.bubbleColor) || '#d9fdd3');
  }

  // Delegated click — anti gagal
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('#bubbleBtn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openModal();
  }, true);

  // Close handlers
  document.addEventListener('click', function(e){
    var t = e.target;
    if (t.id === 'bubbleModal') t.classList.add('hidden');
    if (t.dataset && t.dataset.close === 'bubbleModal') {
      var m = findEl('bubbleModal'); if (m) m.classList.add('hidden');
    }
  }, false);

  console.log('[BUBBLE] v2 bound');
})();
