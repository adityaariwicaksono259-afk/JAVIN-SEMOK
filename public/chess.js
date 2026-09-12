const socket = io();
const $ = (id) => document.getElementById(id);
const userId = window.__userId;
let me = null, difficulty = 'easy', gameOver = false, selected = null, thinking = false;
const game = new Chess();

const PIECES = { wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙', bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟' };
const PIECE_VAL = { p:100, n:320, b:330, r:500, q:900, k:20000 };

socket.on('connect', () => socket.emit('join', userId));
socket.on('me', (u) => {
  me = u;
  $('chessCoins').textContent = u.coins.toLocaleString('id-ID');
  document.body.classList.toggle('dark', u.theme === 'dark');
});

function renderBoard() {
  const board = game.board();
  const grid = $('chessBoard');
  grid.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      const isDark = (r + c) % 2 === 1;
      sq.className = 'chess-sq ' + (isDark ? 'dark' : 'light');
      const file = 'abcdefgh'[c];
      const rank = 8 - r;
      const sqName = file + rank;
      sq.dataset.sq = sqName;
      if (selected === sqName) sq.classList.add('selected');
      const p = board[r][c];
      if (p) {
        const span = document.createElement('span');
        span.className = 'chess-piece';
        span.textContent = PIECES[p.color + p.type.toUpperCase()];
        span.style.color = p.color === 'w' ? '#fff' : '#111';
        span.style.textShadow = p.color === 'w' ? '0 0 2px #000,0 0 2px #000' : 'none';
        sq.appendChild(span);
      }
      sq.onclick = () => onSquareClick(sqName);
      grid.appendChild(sq);
    }
  }
  if (selected) {
    const moves = game.moves({ square: selected, verbose: true });
    moves.forEach(m => {
      const el = document.querySelector('.chess-sq[data-sq="' + m.to + '"]');
      if (el) el.classList.add('legal');
    });
  }
}

function onSquareClick(sq) {
  if (gameOver || thinking || game.turn() !== 'w') return;
  if (selected) {
    const move = game.move({ from: selected, to: sq, promotion: 'q' });
    if (move) {
      selected = null;
      renderBoard();
      checkGameEnd();
      if (!gameOver) { $('chessStatus').textContent = 'AI mikir...'; setTimeout(aiMove, 400); }
      return;
    }
    const p = game.get(sq);
    if (p && p.color === 'w') { selected = sq; } else { selected = null; }
    renderBoard();
  } else {
    const p = game.get(sq);
    if (p && p.color === 'w') { selected = sq; renderBoard(); }
  }
}

function aiMove() {
  if (gameOver) return;
  thinking = true;
  setTimeout(() => {
    const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const m = getBestMove(depth);
    if (m) game.move(m);
    thinking = false;
    renderBoard();
    checkGameEnd();
    if (!gameOver) $('chessStatus').textContent = 'Giliran lo (Putih)';
  }, 100);
}

function evaluate() {
  if (game.game_over()) {
    if (game.in_checkmate()) return game.turn() === 'w' ? -100000 : 100000;
    return 0;
  }
  let score = 0;
  game.board().forEach(row => row.forEach(p => {
    if (!p) return;
    score += p.color === 'w' ? PIECE_VAL[p.type] : -PIECE_VAL[p.type];
  }));
  return score;
}

function minimax(depth, alpha, beta, maximizing) {
  if (depth === 0 || game.game_over()) return evaluate();
  const moves = game.moves();
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      game.move(m);
      best = Math.max(best, minimax(depth - 1, alpha, beta, false));
      game.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      game.move(m);
      best = Math.min(best, minimax(depth - 1, alpha, beta, true));
      game.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function getBestMove(depth) {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  moves.sort(() => Math.random() - 0.5);
  let bestMove = null, bestScore = -Infinity;
  for (const m of moves) {
    game.move(m);
    let s = minimax(depth - 1, -Infinity, Infinity, false);
    if (difficulty === 'easy') s += Math.random() * 150;
    else if (difficulty === 'medium') s += Math.random() * 40;
    else s += Math.random() * 10;
    game.undo();
    if (s > bestScore) { bestScore = s; bestMove = m; }
  }
  return bestMove;
}

function checkGameEnd() {
  if (!game.game_over()) return;
  gameOver = true;
  let result = 'draw', txt = '🤝 SERI';
  if (game.in_checkmate()) {
    result = game.turn() === 'w' ? 'lose' : 'win';
    txt = result === 'win' ? '🎉 MENANG!' : '😢 KALAH';
  } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
    txt = '🤝 SERI';
  }
  $('chessStatus').textContent = txt + ' - Proses hadiah...';
  socket.emit('chess-finish', { result, difficulty }, (res) => {
    if (res.error) { $('chessStatus').textContent = 'Error: ' + res.error; return; }
    if (me) me.coins = res.coins;
    $('chessCoins').textContent = res.coins.toLocaleString('id-ID');
    $('chessStatus').textContent = txt + ' +' + res.reward + ' coin';
    $('chessRestart').classList.remove('hidden');
  });
}

document.querySelectorAll('.chess-diff').forEach(b => {
  b.onclick = () => {
    if (game.history().length > 0) return;
    difficulty = b.dataset.diff;
    document.querySelectorAll('.chess-diff').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  };
});

$('chessRestart').onclick = () => {
  game.reset();
  gameOver = false;
  selected = null;
  $('chessRestart').classList.add('hidden');
  $('chessStatus').textContent = 'Giliran lo (Putih)';
  renderBoard();
};

renderBoard();
$('chessStatus').textContent = 'Giliran lo (Putih)';
