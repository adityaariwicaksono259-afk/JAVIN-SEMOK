const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null;
let currentBet = 50;
let currentPick = null;
let playing = false;
const history = [];

const toastEl = $('toast');
function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

// Build number grid 1-10
(function(){
  const grid = $('tebakNumGrid');
  for (let i = 1; i <= 10; i++) {
    const b = document.createElement('button');
    b.className = 'tebak-num';
    b.dataset.num = i;
    b.textContent = i;
    b.onclick = () => {
      if (playing) return;
      document.querySelectorAll('.tebak-num').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentPick = i;
    };
    grid.appendChild(b);
  }
})();

socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  $('tebakBalance').textContent = u.coins.toLocaleString('id-ID');
  document.body.classList.toggle('dark', u.theme === 'dark');
});

document.querySelectorAll('.tebak-chip').forEach(b => {
  b.onclick = () => {
    if (playing) return;
    document.querySelectorAll('.tebak-chip').forEach(x => x.classList.remove('active'));
    if (b.dataset.bet === 'max') { currentBet = me ? me.coins : 0; b.classList.add('active'); }
    else { currentBet = parseInt(b.dataset.bet); b.classList.add('active'); }
    if (me && currentBet > me.coins) currentBet = me.coins;
  };
});

$('tebakPlay').onclick = () => {
  if (playing) return;
  if (!me) return toast('Loading...');
  if (!currentPick) return toast('Pilih angka 1-10 dulu');
  if (currentBet < 10) return toast('Minimal 10 coin');
  if (me.coins < currentBet) return toast('Saldo kurang');

  playing = true;
  $('tebakPlay').disabled = true;
  $('tebakResult').textContent = 'Server milih angka...';
  $('tebakResult').className = 'tebak-result';
  const circ = $('tebakCircle');
  circ.textContent = '?';
  circ.className = 'tebak-circle spinning';

  let tick = 0;
  const anim = setInterval(() => {
    circ.textContent = (Math.floor(Math.random() * 10) + 1);
    tick++;
    if (tick > 20) clearInterval(anim);
  }, 60);

  socket.emit('tebak-play', { bet: currentBet, pick: currentPick }, (res) => {
    setTimeout(() => {
      clearInterval(anim);
      if (res.error) {
        playing = false;
        $('tebakPlay').disabled = false;
        $('tebakResult').textContent = res.error;
        return;
      }
      circ.textContent = res.secret;
      circ.className = 'tebak-circle revealed' + (res.win ? ' win' : '');
      me.coins = res.coins;
      $('tebakBalance').textContent = res.coins.toLocaleString('id-ID');

      setTimeout(() => {
        playing = false;
        $('tebakPlay').disabled = false;
        if (res.win) {
          $('tebakResult').textContent = 'BENAR! Angka ' + res.secret + ' - MENANG +' + res.reward.toLocaleString('id-ID') + ' coin!';
          $('tebakResult').className = 'tebak-result win';
        } else {
          const hint = currentPick < res.secret ? '(angka lebih BESAR)' : '(angka lebih KECIL)';
          $('tebakResult').textContent = 'Angka ' + res.secret + '. Belum beruntung ' + hint;
          $('tebakResult').className = 'tebak-result';
        }
        history.unshift({ n: res.secret, win: res.win });
        if (history.length > 8) history.pop();
        renderHistory();
      }, 500);
    }, 900);
  });
};

function renderHistory() {
  const box = $('tebakHistory');
  box.innerHTML = '';
  history.forEach(h => {
    const s = document.createElement('span');
    s.className = 'tebak-h-item' + (h.win ? ' win' : '');
    s.textContent = h.n;
    box.appendChild(s);
  });
}
