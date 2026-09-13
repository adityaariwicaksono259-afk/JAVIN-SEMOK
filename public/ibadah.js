const params = new URLSearchParams(location.search);
const agama = params.get('agama') || 'kristen';
const data = window.IBADAH_DATA[agama];

if (!data) {
  document.body.innerHTML = '<div style="padding:20px;text-align:center">Agama tidak ditemukan</div>';
} else {
  document.title = data.name + ' - JAVIN SEMOK';
  document.getElementById('ibTitle').textContent = data.icon + ' ' + data.name;
  document.getElementById('ibIcon').textContent = data.icon;
  document.getElementById('ibName').textContent = data.name;
  document.getElementById('ibHero').style.background = 'linear-gradient(135deg, ' + data.color + ', ' + data.color + 'dd)';

  // Jadwal
  const jbox = document.getElementById('ibJadwalList');
  jbox.innerHTML = '';
  (data.jadwal || []).forEach(j => {
    const card = document.createElement('div');
    card.className = 'ib-jadwal-card';
    card.innerHTML =
      '<div class="ib-jadwal-icon">' + j.icon + '</div>' +
      '<div class="ib-jadwal-info">' +
        '<div class="ib-jadwal-name">' + j.nama + '</div>' +
        '<div class="ib-jadwal-time">' + j.waktu + '</div>' +
        '<div class="ib-jadwal-ket">' + j.ket + '</div>' +
      '</div>';
    jbox.appendChild(card);
  });

  // Doa
  const dbox = document.getElementById('ibDoaList');
  dbox.innerHTML = '';
  (data.doa || []).forEach(d => {
    const card = document.createElement('div');
    card.className = 'sh-doa-card';
    card.innerHTML =
      '<div class="sh-doa-header">' +
        '<span class="sh-doa-icon">🙏</span>' +
        '<span class="sh-doa-title">' + d.title + '</span>' +
        '<span class="sh-doa-arrow">▼</span>' +
      '</div>' +
      '<div class="sh-doa-body">' +
        '<div class="ib-doa-text">' + d.teks.replace(/\n/g, '<br>') + '</div>' +
        (d.arti ? '<div class="sh-doa-arti">' + d.arti + '</div>' : '') +
      '</div>';
    card.querySelector('.sh-doa-header').onclick = () => card.classList.toggle('open');
    dbox.appendChild(card);
  });
}
