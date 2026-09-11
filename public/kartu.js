const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null, currentBet = 50, currentGuess = null, playing = false;
const history = [];
const SUIT_CHAR = { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' };
const SUIT_COLOR = { S: 'black', C: 'black', H: 'red', D: 'red' };
const toastEl = $('toast');
function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}
socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  $('kartuBalance').textContent = u.coins.toLocaleString('id-ID');
  document.body.classList.toggle('dark', u.theme === 'dark');
});
document.querySelectorAll('.kartu-chip').forEach(b => {
  b.onclick = () => {
    if (playing) return;
    document.querySelectorAll('.kartu-chip').forEach(x => x.classList.remove('active'));
    if (b.dataset.bet === 'max') { currentBet = me ? me.coins : 0; b.classList.add('active'); }
    else { currentBet = parseInt(b.dataset.bet); b.classList.add('active'); }
    if (me && currentBet > me.coins) currentBet = me.coins;
  };
});
function renderCard(el, card) {
  const sc = SUIT_CHAR[card.suit] || '?';
  const cl = SUIT_COLOR[card.suit] || 'black';
  el.innerHTML = '<div class="card-corner tl"><span class="cc-rank">' + card.label + '</span><span class="cc-suit">' + sc + '</span></div><div class="card-center" style="color:' + cl + '">' + sc + '</div><div class="card-corner br"><span class="cc-rank">' + card.label + '</span><span class="cc-suit">' + sc + '</span></div>';
  el.style.color = cl;
  el.classList.add('flipped');
}
function resetCards() {
  $('kartuCur').innerHTML = '<div class="kartu-back">?</div>';
  $('kartuCur').classList.remove('flipped');
  $('kartuNext').innerHTML = '<div class="kartu-back">?</div>';
  $('kartuNext').classList.remove('flipped');
}
function play() {
  if (playing) return;
  if (!me) return toast('Loading...');
  if (!currentGuess) return toast('Pilih LEBIH TINGGI atau LEBIH RENDAH');
  if (currentBet < 10) return toast('Minimal 10 coin');
  if (me.coins < currentBet) return toast('Saldo kurang');
  playing = true;
  document.querySelectorAll('.kartu-guess').forEach(b => b.disabled = true);
  $('kartuResult').textContent = 'Mengocok kartu...';
  $('kartuResult').className = 'kartu-result';
  resetCards();
  socket.emit('kartu-play', { bet: currentBet, guess: currentGuess }, (res) => {
    if (res.error) {
      playing = false;
      document.querySelectorAll('.kartu-guess').forEach(b => b.disabled = false);
      $('kartuResult').textContent = res.error;
      return;
    }
    renderCard($('kartuCur'), res.current);
    me.coins = res.coins;
    $('kartuBalance').textContent = res.coins.toLocaleString('id-ID');
    setTimeout(() => {
      renderCard($('kartuNext'), res.next);
      setTimeout(() => {
        playing = false;
        document.querySelectorAll('.kartu-guess').forEach(b => b.disabled = false);
        if (res.correct) {
          $('kartuResult').textContent = 'BENAR! ' + res.current.label + ' -> ' + res.next.label + ' - MENANG +' + res.win.toLocaleString('id-ID') + ' coin!';
          $('kartuResult').className = 'kartu-result win';
        } else {
          $('kartuResult').textContent = 'SALAH. ' + res.current.label + ' -> ' + res.next.label;
          $('kartuResult').className = 'kartu-result';
        }
        history.unshift({ cur: res.current.label, next: res.next.label, win: res.correct });
        if (history.length > 5) history.pop();
        renderHistory();
      }, 600);
    }, 400);
  });
}
document.querySelectorAll('.kartu-guess').forEach(b => {
  b.addEventListener('click', function(){
    if (playing) return;
    document.querySelectorAll('.kartu-guess').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentGuess = b.dataset.guess;
    play();
  });
});
function renderHistory() {
  const box = $('kartuHistory');
  box.innerHTML = '';
  history.forEach(h => {
    const s = document.createElement('div');
    s.className = 'kartu-h-item' + (h.win ? ' win' : '');
    s.textContent = h.cur + ' \u2192 ' + h.next;
    box.appendChild(s);
  });
}
