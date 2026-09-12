const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null, currentBet = 50, spinning = false;

const SYMBOLS = ['🀇','🀙','🀐','🀆','🀅','🀄','🀔'];

socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  $('mjBalance').textContent = u.coins.toLocaleString('id-ID');
  $('mjSaldo').textContent = u.coins.toLocaleString('id-ID');
  document.body.classList.toggle('dark', u.theme === 'dark');
});

document.querySelectorAll('.mj-chip').forEach(b => {
  b.onclick = () => {
    if (spinning) return;
    document.querySelectorAll('.mj-chip').forEach(x => x.classList.remove('active'));
    if (b.dataset.bet === 'max') { currentBet = me ? me.coins : 0; b.classList.add('active'); }
    else { currentBet = parseInt(b.dataset.bet); b.classList.add('active'); }
    if (me && currentBet > me.coins) currentBet = me.coins;
    $('mjBet').textContent = currentBet.toLocaleString('id-ID');
  };
});

function getColCells(col) {
  return [
    document.querySelector('.mj-cell[data-r="'+col+'"][data-row="0"]'),
    document.querySelector('.mj-cell[data-r="'+col+'"][data-row="1"]')
  ];
}

function clearHL() {
  document.querySelectorAll('.mj-cell').forEach(c => c.classList.remove('mj-win-cell','mj-jack','mj-scatter'));
}

function highlight(wins) {
  wins.forEach(w => {
    if (!w.cells) return;
    const isJack = w.mult >= 10;
    w.cells.forEach(c => {
      const el = document.querySelector('.mj-cell[data-r="'+c.r+'"][data-row="'+c.row+'"]');
      if (!el) return;
      if (w.scatter) el.classList.add('mj-scatter');
      else el.classList.add(isJack ? 'mj-jack' : 'mj-win-cell');
    });
  });
}

$('mjSpin').onclick = () => {
  if (spinning) return;
  if (!me) return alert('Loading...');
  if (currentBet < 10) return alert('Minimal 10 coin');
  if (me.coins < currentBet) return alert('Saldo kurang');

  spinning = true;
  $('mjSpin').disabled = true;
  $('mjWin').textContent = '0';
  $('mjStatus').textContent = 'Memutar...';
  $('mjStatus').className = 'mj-status';
  clearHL();

  // Start spin animation
  for (let c = 0; c < 5; c++) {
    const [top, bot] = getColCells(c);
    top.parentElement.classList.add('mj-spinning');
    top.parentElement._timer = setInterval(() => {
      top.textContent = SYMBOLS[Math.floor(Math.random()*7)];
      bot.textContent = SYMBOLS[Math.floor(Math.random()*7)];
    }, 60);
  }

  socket.emit('mahjong-spin', { bet: currentBet }, (res) => {
    if (res.error) {
      spinning = false;
      $('mjSpin').disabled = false;
      for (let c = 0; c < 5; c++) {
        const [top] = getColCells(c);
        clearInterval(top.parentElement._timer);
        top.parentElement.classList.remove('mj-spinning');
      }
      $('mjStatus').textContent = res.error;
      return;
    }

    // Stop each column
    for (let c = 0; c < 5; c++) {
      setTimeout(() => {
        const [top, bot] = getColCells(c);
        clearInterval(top.parentElement._timer);
        top.parentElement.classList.remove('mj-spinning');
        top.parentElement.classList.add('mj-stopped');
        top.textContent = res.grid[c][0];
        bot.textContent = res.grid[c][1];
        setTimeout(() => top.parentElement.classList.remove('mj-stopped'), 400);
      }, 500 + c * 250);
    }

    setTimeout(() => finish(res), 500 + 4*250 + 200);
  });
};

function finish(res) {
  me.coins = res.coins;
  $('mjBalance').textContent = res.coins.toLocaleString('id-ID');
  $('mjSaldo').textContent = res.coins.toLocaleString('id-ID');
  highlight(res.wins || []);

  if (res.multiplier > 0) {
    $('mjWin').textContent = res.win.toLocaleString('id-ID');
    $('mjStatus').textContent = '🎉 MENANG x' + res.multiplier + ' → +' + res.win.toLocaleString('id-ID') + ' coin';
    $('mjStatus').className = 'mj-status mj-win';
    if (res.tier === 'big') showBW('BIG WIN!', res.win, '#25d366');
    else if (res.tier === 'mega') showBW('MEGA WIN!', res.win, '#ffd700');
    else if (res.tier === 'jackpot') showBW('JACKPOT!!!', res.win, '#ff3b30');
  } else {
    $('mjStatus').textContent = '😢 Belum beruntung';
    $('mjStatus').className = 'mj-status mj-lose';
  }
  spinning = false;
  $('mjSpin').disabled = false;
}

function showBW(title, amt, color) {
  $('mjBwTitle').textContent = title;
  $('mjBwTitle').style.color = color;
  $('mjBwAmt').textContent = amt.toLocaleString('id-ID');
  $('mjBwAmt').style.color = color;
  $('mjBigWin').classList.remove('hidden');
  $('mjBigWin').classList.add('mj-show');
  setTimeout(() => {
    $('mjBigWin').classList.remove('mj-show');
    setTimeout(() => $('mjBigWin').classList.add('hidden'), 400);
  }, 3500);
}

setInterval(() => { if (me) { $('mjBalance').textContent = me.coins.toLocaleString('id-ID'); $('mjSaldo').textContent = me.coins.toLocaleString('id-ID'); } }, 3000);
