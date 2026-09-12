const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null;
let currentBet = 50;
let currentPick = null;
let spinning = false;
const history = [];

const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

const toastEl = $('toast');
function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

// Build number grid 0-36
(function(){
  const box = $('rlNums');
  for (let i = 0; i <= 36; i++) {
    const b = document.createElement('button');
    b.className = 'rl-num' + (i === 0 ? ' num-green' : RED.includes(i) ? ' num-red' : ' num-black');
    b.textContent = i;
    b.onclick = () => {
      if (spinning) return;
      document.querySelectorAll('.rl-pick, .rl-num').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentPick = String(i);
    };
    box.appendChild(b);
  }
})();

socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  $('rlBalance').textContent = u.coins.toLocaleString('id-ID');
  document.body.classList.toggle('dark', u.theme === 'dark');
});

document.querySelectorAll('.rl-chip').forEach(b => {
  b.onclick = () => {
    if (spinning) return;
    document.querySelectorAll('.rl-chip').forEach(x => x.classList.remove('active'));
    if (b.dataset.bet === 'max') { currentBet = me ? me.coins : 0; b.classList.add('active'); }
    else { currentBet = parseInt(b.dataset.bet); b.classList.add('active'); }
    if (me && currentBet > me.coins) currentBet = me.coins;
  };
});

document.querySelectorAll('.rl-pick').forEach(b => {
  b.onclick = () => {
    if (spinning) return;
    document.querySelectorAll('.rl-pick, .rl-num').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentPick = b.dataset.pick;
  };
});

$('rlSpin').onclick = () => {
  if (spinning) return;
  if (!me) return toast('Loading...');
  if (!currentPick) return toast('Pilih bet dulu');
  if (currentBet < 10) return toast('Minimal 10 coin');
  if (me.coins < currentBet) return toast('Saldo kurang');

  spinning = true;
  $('rlSpin').disabled = true;
  $('rlStatus').textContent = 'Memutar...';
  $('rlStatus').className = 'rl-status';
  $('rlResultNum').textContent = '?';
  $('rlResultNum').className = 'rl-result-num';

  const wheel = $('rlWheel');
  let rot = 0;
  const spinAnim = setInterval(() => {
    rot += 40;
    wheel.style.transform = 'rotate(' + rot + 'deg)';
  }, 50);

  socket.emit('roulette-spin', { bet: currentBet, pick: currentPick }, (res) => {
    setTimeout(() => {
      clearInterval(spinAnim);
      if (res.error) {
        spinning = false;
        $('rlSpin').disabled = false;
        $('rlStatus').textContent = res.error;
        return;
      }
      // Final rotation ke posisi angka hasil
      const finalRot = rot + (360 * 3) + (res.result * (360 / 37));
      wheel.style.transition = 'transform 1.5s cubic-bezier(.2,.8,.3,1)';
      wheel.style.transform = 'rotate(' + finalRot + 'deg)';

      me.coins = res.coins;
      $('rlBalance').textContent = res.coins.toLocaleString('id-ID');

      setTimeout(() => {
        $('rlResultNum').textContent = res.result;
        $('rlResultNum').className = 'rl-result-num result-' + res.color;
        spinning = false;
        $('rlSpin').disabled = false;
        if (res.win) {
          $('rlStatus').textContent = '🎉 MENANG! ' + res.result + ' (' + res.color + ') → +' + res.reward.toLocaleString('id-ID') + ' coin (x' + res.multiplier + ')';
          $('rlStatus').className = 'rl-status win';
        } else {
          $('rlStatus').textContent = 'Angka ' + res.result + ' (' + res.color + ') - belum beruntung';
          $('rlStatus').className = 'rl-status';
        }
        history.unshift({ n: res.result, color: res.color });
        if (history.length > 10) history.pop();
        renderHistory();
      }, 1600);
    }, 800);
  });
};

function renderHistory() {
  const box = $('rlHistory');
  box.innerHTML = '';
  history.forEach(h => {
    const s = document.createElement('span');
    s.className = 'rl-h-item rl-h-' + h.color;
    s.textContent = h.n;
    box.appendChild(s);
  });
}

setInterval(() => { if (me) $('rlBalance').textContent = me.coins.toLocaleString('id-ID'); }, 3000);
