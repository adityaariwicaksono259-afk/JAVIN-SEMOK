const DATA = window.WORKOUT_DATA;
const $ = (id) => document.getElementById(id);
let activeDay = 'senin';

// Auto-detect hari ini
const todayNames = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
const todayIdx = new Date().getDay();
activeDay = todayNames[todayIdx];

// Render day tabs
function renderTabs() {
  const box = $('wkDayTabs');
  box.innerHTML = '';
  DATA.days.forEach(d => {
    const b = document.createElement('button');
    b.className = 'wk-day-tab' + (d.key === activeDay ? ' active' : '');
    if (d.key === todayNames[todayIdx]) b.classList.add('today');
    b.textContent = d.name.slice(0,3);
    b.onclick = () => {
      activeDay = d.key;
      renderTabs();
      renderToday();
    };
    box.appendChild(b);
  });
}

function renderToday() {
  const day = DATA.days.find(d => d.key === activeDay);
  if (!day) return;
  $('wkTodayTitle').textContent = day.name;
  $('wkTodayFocus').textContent = day.focus;

  const box = $('wkList');
  box.innerHTML = '';
  day.exercises.forEach((key, i) => {
    const ex = DATA.exercises[key];
    if (!ex) return;
    const card = document.createElement('a');
    card.href = '/exercise.html?ex=' + key;
    card.className = 'wk-card';
    card.innerHTML =
      '<div class="wk-card-num">' + (i+1) + '</div>' +
      '<div class="wk-card-icon">' + ex.icon + '</div>' +
      '<div class="wk-card-info">' +
        '<div class="wk-card-name">' + ex.name + '</div>' +
        '<div class="wk-card-desc">' + ex.desc + '</div>' +
        '<div class="wk-card-target">' + ex.target + '</div>' +
      '</div>' +
      '<div class="wk-card-arrow">▶</div>';
    box.appendChild(card);
  });
}

renderTabs();
renderToday();
