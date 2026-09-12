const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null;
let currentBet = 50;
let playing = false;
const history = [];

const SUITS = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_COLOR = { S: 'black', C: 'black', H: 'red', D: 'red' };

const toastEl = $('toast');
function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

function renderCard(card, hidden) {
  const el = document.createElement('div');
  el.className = 'bj-card';
  if (hidden) {
    el.classList.add('bj-card-back');
    return el;
  }
  const suit = SUITS[card.s] || '?';
  const color = SUIT_COLOR[card.s] || 'black';
  el.innerHTML = '<div class="bj-corner tl"><span>' + card.v + '</span><span>' + suit + '</span></div>' +
    '<div class="bj-center" style="color:' + color + '">' + suit + '</div>' +
    '<div class="bj-corner br"><span>' + card.v + '</span><span>' + suit + '</span></div>';
  el.style.color = color;
  return el;
}

function renderHand(box, cards, hideSecond) {
  box.innerHTML = '';
  cards.forEach((c, i) => {
    box.appendChild(renderCard(c, hideSecond && i === 1));
  });
}

function resetTable() {
  $('bjDealerHand').innerHTML = '';
  $('bjPlayerHand').innerHTML = '';
  $('bjDealerScore').textContent = '?';
  $('bjPlayerScore').textContent = '0';
  $('bjActions').classList.add('hidden');
  $('bjStart').classList.remove('hidden');
}

socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  $('bjBalance').textContent = u.coins.toLocaleString('id-ID');
  document.body.classList.toggle('dark', u.theme === 'dark');
});

document.querySelectorAll('.bj-chip').forEach(b => {
  b.onclick = () => {
    if (playing) return;
    document.querySelectorAll('.bj-chip').forEach(x => x.classList.remove('active'));
    if (b.dataset.bet === 'max') { currentBet = me ? me.coins : 0; b.classList.add('active'); }
    else { currentBet = parseInt(b.dataset.bet); b.classList.add('active'); }
    if (me && currentBet > me.coins) currentBet = me.coins;
  };
});

$('bjStart').onclick = () => {
  if (playing) return;
  if (!me) return toast('Loading...');
  if (currentBet < 10) return toast('Minimal 10 coin');
  if (me.coins < currentBet) return toast('Saldo kurang');
  playing = true;
  $('bjStart').classList.add('hidden');
  $('bjStatus').textContent = 'Membagi kartu...';
  $('bjStatus').className = 'bj-status';

  socket.emit('blackjack-start', { bet: currentBet }, (res) => {
    if (res.error) { playing = false; $('bjStart').classList.remove('hidden'); return toast('❌ ' + res.error); }
    me.coins = res.coins;
    $('bjBalance').textContent = res.coins.toLocaleString('id-ID');
    renderHand($('bjPlayerHand'), res.player, false);
    renderHand($('bjDealerHand'), res.dealer, false);
    $('bjPlayerScore').textContent = res.playerTotal;

    if (res.isBlackjack) {
      // Auto stand
      setTimeout(() => doStand(), 800);
      return;
    }
    $('bjStatus').textContent = 'Pilih HIT atau STAND';
    $('bjActions').classList.remove('hidden');
  });
};

$('bjHit').onclick = () => {
  if (!playing) return;
  if ($('bjHit').disabled) return;
  $('bjHit').disabled = true;
  socket.emit('blackjack-hit', (res) => {
    $('bjHit').disabled = false;
    if (res.error) { toast('❌ ' + res.error); return; }
    renderHand($('bjPlayerHand'), res.player, false);
    $('bjPlayerScore').textContent = res.playerTotal;
    if (res.bust) {
      // Reveal dealer
      renderHand($('bjDealerHand'), res.dealer, false);
      $('bjDealerScore').textContent = res.dealerTotal;
      endGame(res);
    }
  });
};

$('bjStand').onclick = () => doStand();

function doStand() {
  if (!playing) return;
  $('bjActions').classList.add('hidden');
  $('bjStatus').textContent = 'Dealer buka kartu...';
  socket.emit('blackjack-stand', (res) => {
    if (res.error) { toast('❌ ' + res.error); return; }
    renderHand($('bjDealerHand'), res.dealer, false);
    $('bjDealerScore').textContent = res.dealerTotal;
    $('bjPlayerScore').textContent = res.playerTotal;
    endGame(res);
  });
}

function endGame(res) {
  playing = false;
  if (res && res.coins !== undefined) {
    me.coins = res.coins;
    $('bjBalance').textContent = res.coins.toLocaleString('id-ID');
  }
  var bet = res.bet || currentBet || 0;
  if (res.result === 'win') {
    var isBj = res.playerTotal === 21 && res.player && res.player.length === 2 && res.win === Math.floor(bet * 2.5);
    $('bjStatus').textContent = (isBj ? '🃏 BLACKJACK! ' : '🎉 MENANG! ') + '+' + res.win.toLocaleString('id-ID') + ' coin';
    $('bjStatus').className = 'bj-status win';
  } else if (res.result === 'push') {
    $('bjStatus').textContent = '🤝 SERI - modal balik';
    $('bjStatus').className = 'bj-status push';
  } else {
    $('bjStatus').textContent = (res.bust ? '💥 BUST! ' : '😢 KALAH ') + '-' + bet.toLocaleString('id-ID') + ' coin';
    $('bjStatus').className = 'bj-status lose';
  }
  history.unshift({ result: res.result, pT: res.playerTotal, dT: res.dealerTotal });
  if (history.length > 8) history.pop();
  renderHistory();
  // Force reset setelah 2.5 detik
  setTimeout(function() {
    playing = false;
    $('bjHit').disabled = false;
    $('bjStand').disabled = false;
    resetTable();
  }, 2500);
}

function renderHistory() {
  const box = $('bjHistory');
  box.innerHTML = '';
  history.forEach(h => {
    const el = document.createElement('span');
    el.className = 'bj-h ' + h.result;
    el.textContent = h.pT + '-' + h.dT;
    box.appendChild(el);
  });
}

setInterval(() => { if (me) $('bjBalance').textContent = me.coins.toLocaleString('id-ID'); }, 3000);

// WATCHDOG — auto-reset kalau stuck
setInterval(function() {
  if (!playing) return;
  var hitDisabled = $('bjHit').disabled;
  var standVisible = !$('bjActions').classList.contains('hidden');
  // Kalau HIT disabled 5+ detik tapi game gak selesai, force reset
  if (hitDisabled && standVisible) {
    if (!window.__bjWatchdogStart) window.__bjWatchdogStart = Date.now();
    if (Date.now() - window.__bjWatchdogStart > 5000) {
      console.log('[BJ] Watchdog reset');
      window.__bjWatchdogStart = 0;
      playing = false;
      $('bjHit').disabled = false;
      $('bjStand').disabled = false;
      $('bjActions').classList.add('hidden');
      resetTable();
      $('bjStatus').textContent = 'Game ke-reset. Mulai lagi.';
    }
  } else {
    window.__bjWatchdogStart = 0;
  }
}, 2000);
