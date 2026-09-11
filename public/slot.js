const socket = io();
const $ = (id) => document.getElementById(id);
let userId = window.__userId;
let me = null;
let spinning = false;
let currentBet = 50;
let muted = localStorage.getItem('slot_muted') === '1';

const SYMBOLS = ['🍒','🍋','🍇','⭐','💎','7️⃣','🎰'];
const toastEl = $('toast');
const allCells = document.querySelectorAll('.slot-cell');

// ============ AUDIO ============
let audioCtx = null;
function initAudio() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, dur, type='sine', vol=0.1, delay=0) {
  if (muted || !audioCtx) return;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + dur);
}
function sfxClick() { playTone(1200, 0.04, 'square', 0.05); }
function sfxSpin() { playTone(180, 0.2, 'sawtooth', 0.05); }
function sfxReelStop() { playTone(160, 0.1, 'square', 0.08); playTone(80, 0.15, 'triangle', 0.07, 0.02); }
function sfxWin() { [523,659,784,1047].forEach((f,i) => playTone(f, 0.18, 'triangle', 0.12, i*0.09)); }
function sfxBigWin() { [523,659,784,1047,1319].forEach((f,i) => playTone(f, 0.22, 'square', 0.13, i*0.1)); }
function sfxJackpot() {
  [523,659,784,1047,1319,1568,2093].forEach((f,i) => playTone(f, 0.25, 'square', 0.14, i*0.09));
  setTimeout(() => sfxJackpot(), 1800);
}
function sfxLose() { playTone(150, 0.3, 'sawtooth', 0.06); }

function toast(msg, ms=2200) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), ms);
}
function updateSoundBtn() { $('soundBtn').textContent = muted ? '🔇' : '🔊'; }
$('soundBtn').onclick = () => {
  muted = !muted;
  localStorage.setItem('slot_muted', muted ? '1' : '0');
  updateSoundBtn();
  if (!muted) { initAudio(); sfxClick(); }
};
updateSoundBtn();

// ============ SOCKET ============
socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  renderBalance();
  document.body.classList.toggle('dark', u.theme === 'dark');
});
function renderBalance() { if (me) $('slotBalance').textContent = me.coins.toLocaleString('id-ID'); }

// ============ BET ============
document.querySelectorAll('.chip').forEach(c => {
  c.onclick = () => {
    if (spinning) return;
    initAudio(); sfxClick();
    document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
    if (c.dataset.bet === 'max') {
      if (!me || me.coins < 10) return toast('Coin gak cukup');
      currentBet = me.coins;
      c.classList.add('active');
    } else {
      currentBet = parseInt(c.dataset.bet);
      c.classList.add('active');
    }
    if (me && currentBet > me.coins) currentBet = me.coins;
    $('slotBetDisplay').textContent = currentBet.toLocaleString('id-ID');
  };
});
document.querySelector('.chip[data-bet="50"]').classList.add('active');

// ============ SPIN ============
function getColCells(col) {
  return [
    document.querySelector(`.slot-cell[data-r="${col}"][data-row="0"]`),
    document.querySelector(`.slot-cell[data-r="${col}"][data-row="1"]`)
  ];
}

function startColSpin(col) {
  const [top, bot] = getColCells(col);
  top.parentElement.classList.add('spinning');
  return setInterval(() => {
    top.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    bot.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  }, 60);
}

function stopColSpin(col, finalTop, finalBot) {
  const [top, bot] = getColCells(col);
  clearInterval(top.parentElement._timer);
  top.parentElement.classList.remove('spinning');
  top.parentElement.classList.add('stopped');
  top.textContent = finalTop;
  bot.textContent = finalBot;
  sfxReelStop();
  setTimeout(() => top.parentElement.classList.remove('stopped'), 400);
}

function clearHighlights() {
  allCells.forEach(c => {
    c.classList.remove('cell-win', 'cell-scatter', 'cell-jackpot');
  });
}

function highlightWins(wins) {
  wins.forEach(w => {
    if (!w.cells) return;
    const isJack = w.mult >= 10;
    w.cells.forEach(cell => {
      const el = document.querySelector(`.slot-cell[data-r="${cell.r}"][data-row="${cell.row}"]`);
      if (!el) return;
      if (w.scatter) el.classList.add('cell-scatter');
      else el.classList.add(isJack ? 'cell-jackpot' : 'cell-win');
    });
  });
}

$('slotSpin').onclick = () => {
  if (spinning) return;
  if (!me) return toast('Loading...');
  if (currentBet < 10) return toast('Minimal bet 10 coin');
  if (me.coins < currentBet) return toast('Coin gak cukup. Saldo: ' + me.coins);

  initAudio();
  spinning = true;
  $('slotSpin').classList.add('disabled');
  $('slotResult').textContent = '';
  $('slotResult').className = 'slot-message';
  $('slotWin').textContent = '0';
  clearHighlights();
  document.querySelector('.slot-machine').classList.remove('win','jackpot','mega');

  sfxSpin();
  for (let c = 0; c < 5; c++) {
    const [top] = getColCells(c);
    top.parentElement._timer = startColSpin(c);
  }

  socket.emit('slot-spin', { bet: currentBet }, (res) => {
    if (res.error) {
      spinning = false;
      $('slotSpin').classList.remove('disabled');
      for (let c = 0; c < 5; c++) {
        const [top] = getColCells(c);
        clearInterval(top.parentElement._timer);
        top.parentElement.classList.remove('spinning');
      }
      return toast('❌ ' + res.error);
    }

    // Stop columns sequentially
    for (let c = 0; c < 5; c++) {
      setTimeout(() => {
        stopColSpin(c, res.grid[c][0], res.grid[c][1]);
      }, 500 + c * 250);
    }

    setTimeout(() => finishSpin(res), 500 + 4 * 250 + 200);
  });
};

function finishSpin(res) {
  me.coins = res.coins;
  renderBalance();
  highlightWins(res.wins || []);

  const machine = document.querySelector('.slot-machine');
  const result = $('slotResult');

  if (res.multiplier > 0) {
    $('slotWin').textContent = res.win.toLocaleString('id-ID');
    result.textContent = '🎉 MENANG x' + res.multiplier + ' → +' + res.win.toLocaleString('id-ID') + ' coin';
    result.className = 'slot-message win';
    machine.classList.add('win');
    sfxWin();
    flashLights();

    // Big win overlay
    if (res.tier === 'big') showBigWin('BIG WIN!', res.win, '#25d366');
    else if (res.tier === 'mega') showBigWin('MEGA WIN!', res.win, '#ffd700');
    else if (res.tier === 'jackpot') showBigWin('JACKPOT!!!', res.win, '#ff3b30');
  } else {
    result.textContent = '';
    result.className = 'slot-message lose';
    sfxLose();
  }

  spinning = false;
  $('slotSpin').classList.remove('disabled');
}

function flashLights() {
  const lights = document.querySelectorAll('.light');
  lights.forEach((l, i) => {
    setTimeout(() => {
      l.classList.add('flash');
      setTimeout(() => l.classList.remove('flash'), 200);
    }, i * 35);
  });
}

// ============ BIG WIN OVERLAY ============
const overlay = $('bigWinOverlay');
function showBigWin(title, amount, color) {
  $('bigWinTitle').textContent = title;
  $('bigWinTitle').style.color = color;
  $('bigWinAmount').textContent = amount.toLocaleString('id-ID');
  $('bigWinAmount').style.color = color;

  overlay.classList.remove('hidden');
  overlay.classList.add('show');

  if (title.includes('JACKPOT')) sfxJackpot();
  else sfxBigWin();

  // Coin rain
  spawnCoins(amount >= 10000 ? 60 : amount >= 1000 ? 40 : 25);

  // Flash lights repeatedly
  let flashes = 0;
  const flashInterval = setInterval(() => {
    flashLights();
    flashes++;
    if (flashes > 6) clearInterval(flashInterval);
  }, 400);

  setTimeout(() => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.classList.add('hidden'), 400);
  }, 4000);
}

function spawnCoins(count) {
  const box = $('bigWinCoins');
  box.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'coin-drop';
    c.textContent = Math.random() > 0.5 ? '🪙' : '💰';
    c.style.left = Math.random() * 100 + '%';
    c.style.animationDelay = (Math.random() * 1.5) + 's';
    c.style.animationDuration = (2 + Math.random() * 1.5) + 's';
    c.style.fontSize = (18 + Math.random() * 16) + 'px';
    box.appendChild(c);
  }
}

setInterval(() => { if (me) renderBalance(); }, 3000);
