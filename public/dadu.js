const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null, currentBet = 50, currentPick = null, rolling = false;
const toastEl = $('toast');
function toast(m) { toastEl.textContent = m; toastEl.classList.remove('hidden'); setTimeout(() => toastEl.classList.add('hidden'), 2200); }
socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => { me = u; $('diceBalance').textContent = u.coins.toLocaleString('id-ID'); document.body.classList.toggle('dark', u.theme === 'dark'); });
document.querySelectorAll('.dice-chip').forEach(b => {
  b.onclick = () => {
    if (rolling) return;
    document.querySelectorAll('.dice-chip').forEach(x => x.classList.remove('active'));
    if (b.dataset.bet === 'max') { currentBet = me ? me.coins : 0; b.classList.add('active'); }
    else { currentBet = parseInt(b.dataset.bet); b.classList.add('active'); }
    if (me && currentBet > me.coins) currentBet = me.coins;
  };
});
document.querySelectorAll('.dice-pick, .dice-num').forEach(b => {
  b.onclick = () => {
    if (rolling) return;
    document.querySelectorAll('.dice-pick, .dice-num').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentPick = b.dataset.pick;
  };
});
$('diceRoll').onclick = () => {
  if (rolling) return;
  if (!me) return toast('Loading...');
  if (!currentPick) return toast('Pilih KECIL/BESAR atau angka dulu');
  if (currentBet < 10) return toast('Minimal 10 coin');
  if (me.coins < currentBet) return toast('Saldo kurang');
  rolling = true;
  $('diceRoll').disabled = true;
  $('diceResult').textContent = 'Rolling...';
  $('diceResult').className = 'dice-result';
  const cube = $('diceCube');
  let spins = 0;
  const spinInt = setInterval(() => {
    spins++;
    const rx = (Math.random() * 360 + spins * 90) | 0;
    const ry = (Math.random() * 360 + spins * 90) | 0;
    cube.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    if (spins > 12) clearInterval(spinInt);
  }, 60);
  socket.emit('dice-roll', { bet: currentBet, pick: currentPick }, (res) => {
    setTimeout(() => {
      clearInterval(spinInt);
      if (res.error) { rolling = false; $('diceRoll').disabled = false; $('diceResult').textContent = res.error; return; }
      const rot = { 1:{x:0,y:0}, 2:{x:0,y:-90}, 3:{x:0,y:180}, 4:{x:0,y:90}, 5:{x:-90,y:0}, 6:{x:90,y:0} };
      const r = rot[res.result];
      cube.style.transition = 'transform .6s cubic-bezier(.4,0,.2,1)';
      cube.style.transform = 'rotateX(' + r.x + 'deg) rotateY(' + r.y + 'deg)';
      me.coins = res.coins;
      $('diceBalance').textContent = res.coins.toLocaleString('id-ID');
      setTimeout(() => {
        rolling = false;
        $('diceRoll').disabled = false;
        if (res.win > 0) {
          $('diceResult').textContent = 'MENANG! Dadu ' + res.result + ' - +' + res.win.toLocaleString('id-ID') + ' coin (x' + res.multiplier + ')';
          $('diceResult').className = 'dice-result win';
        } else {
          $('diceResult').textContent = 'Dadu ' + res.result + ' - belum beruntung';
          $('diceResult').className = 'dice-result';
        }
      }, 700);
    }, 800);
  });
};
