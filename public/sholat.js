const $ = (id) => document.getElementById(id);
let timings = null;
const PRAYER_KEYS = [
  { key: 'Imsak',    name: 'Imsak',    icon: '🌌' },
  { key: 'Fajr',     name: 'Subuh',    icon: '🌅' },
  { key: 'Sunrise',  name: 'Terbit',   icon: '☀️' },
  { key: 'Dhuhr',    name: 'Dzuhur',   icon: '🌞' },
  { key: 'Asr',      name: 'Ashar',    icon: '🌤️' },
  { key: 'Maghrib',  name: 'Maghrib',  icon: '🌇' },
  { key: 'Isha',     name: 'Isya',     icon: '🌃' }
];

function formatDate() {
  const d = new Date();
  const dayNames = ['Ahad','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return dayNames[d.getDay()] + ', ' + d.getDate() + ' ' + monthNames[d.getMonth()] + ' ' + d.getFullYear();
}
$('shDate').textContent = formatDate();

async function loadSholat(city) {
  $('shCity').textContent = city + ', Indonesia';
  $('shList').innerHTML = '<div class="sh-loading">Memuat jadwal sholat...</div>';
  try {
    const r = await fetch('/api/sholat?city=' + encodeURIComponent(city));
    const j = await r.json();
    if (!j || !j.data || !j.data.timings) throw new Error('Data tidak valid');
    timings = j.data.timings;
    renderList();
    updateNext();
    setInterval(updateNext, 1000);
  } catch (e) {
    $('shList').innerHTML = '<div class="sh-loading">⚠️ Gagal load: ' + e.message + '</div>';
  }
}

function renderList() {
  const box = $('shList');
  box.innerHTML = '';
  PRAYER_KEYS.forEach(p => {
    const t = (timings[p.key] || '-').replace(/\s*\(.*?\)/, '');
    const row = document.createElement('div');
    row.className = 'sh-row';
    row.innerHTML = '<div class="sh-row-icon">' + p.icon + '</div><div class="sh-row-name">' + p.name + '</div><div class="sh-row-time">' + t + '</div>';
    box.appendChild(row);
  });
}

function parseTime(str) {
  const m = String(str).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: parseInt(m[1]), m: parseInt(m[2]) };
}

function updateNext() {
  if (!timings) return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let next = null;
  PRAYER_KEYS.forEach(p => {
    if (p.key === 'Sunrise' || p.key === 'Imsak') return;
    const t = parseTime(timings[p.key]);
    if (!t) return;
    const m = t.h * 60 + t.m;
    if (m > nowMin) {
      if (!next || m < next.minutes) next = { name: p.name, time: timings[p.key], minutes: m, icon: p.icon };
    }
  });
  if (!next) {
    const fajr = parseTime(timings.Fajr);
    if (fajr) next = { name: 'Subuh', time: timings.Fajr, minutes: fajr.h * 60 + fajr.m + 1440, icon: '🌅' };
  }
  if (!next) return;
  $('shNextName').textContent = next.icon + ' ' + next.name;
  $('shNextTime').textContent = String(next.time).replace(/\s*\(.*?\)/, '');
  const totalSec = (next.minutes - nowMin) * 60 - now.getSeconds();
  if (totalSec <= 0) { $('shNextCountdown').textContent = 'Waktu sholat!'; return; }
  const h = Math.floor(totalSec / 3600);
  const mn = Math.floor((totalSec % 3600) / 60);
  const sc = totalSec % 60;
  $('shNextCountdown').textContent = (h > 0 ? h + ' jam ' : '') + mn + ' menit ' + sc + ' detik lagi';
}

function renderDoa() {
  const box = $('shDoaList');
  box.innerHTML = '';
  (window.DOA_HARIAN || []).forEach(d => {
    const card = document.createElement('div');
    card.className = 'sh-doa-card';
    card.innerHTML = '<div class="sh-doa-header"><span class="sh-doa-icon">' + d.icon + '</span><span class="sh-doa-title">' + d.title + '</span><span class="sh-doa-arrow">▼</span></div><div class="sh-doa-body"><div class="sh-doa-arab">' + d.arabic + '</div><div class="sh-doa-latin">' + d.latin + '</div><div class="sh-doa-arti">"' + d.arti + '"</div></div>';
    card.querySelector('.sh-doa-header').onclick = () => card.classList.toggle('open');
    box.appendChild(card);
  });
}

$('shCitySelect').onchange = (e) => loadSholat(e.target.value);
loadSholat('Jakarta');
renderDoa();
