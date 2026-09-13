const $ = (id) => document.getElementById(id);
const textInput = $('qrText');
const generateBtn = $('qrGenerate');
const previewBox = $('qrPreview');
const resultBox = $('qrResult');
const errorBox = $('qrError');
const viewer = $('qrViewer');
const viewerCanvas = $('qrViewerCanvas');
const toastEl = $('toast');

let currentSize = 400;
let currentDark = '#000000';
let currentLight = '#ffffff';

function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}
function showError(msg) {
  errorBox.textContent = '⚠️ ' + msg;
  errorBox.classList.remove('hidden');
}
function hideError() { errorBox.classList.add('hidden'); }

document.querySelectorAll('.qr-size').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.qr-size').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentSize = parseInt(b.dataset.size);
  };
});
document.querySelectorAll('.qr-color').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.qr-color').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentDark = b.dataset.dark;
    currentLight = b.dataset.light;
  };
});

generateBtn.onclick = () => {
  const text = textInput.value.trim();
  hideError();
  if (!text) return showError('Isi link atau teks dulu');
  if (text.length > 1000) return showError('Maksimal 1000 karakter');

  if (typeof QRCode === 'undefined') {
    return showError('Library QR belum ke-load, refresh halaman');
  }

  previewBox.innerHTML = '';
  try {
    new QRCode(previewBox, {
      text: text,
      width: currentSize,
      height: currentSize,
      colorDark: currentDark,
      colorLight: currentLight,
      correctLevel: QRCode.CorrectLevel.M
    });
    // Force display
    setTimeout(() => {
      const c = previewBox.querySelector('canvas');
      const i = previewBox.querySelector('img');
      if (c) { c.style.width = '100%'; c.style.maxWidth = '300px'; c.style.height = 'auto'; c.style.imageRendering = 'pixelated'; }
      if (i) { i.style.width = '100%'; i.style.maxWidth = '300px'; i.style.height = 'auto'; i.style.imageRendering = 'pixelated'; }
    }, 50);
    resultBox.classList.remove('hidden');
    toast('✅ QR berhasil dibuat!');
  } catch (err) {
    console.error(err);
    showError(err.message || 'Gagal generate QR');
  }
};

$('qrDownloadBtn').onclick = () => {
  const canvas = previewBox.querySelector('canvas');
  if (canvas) {
    canvas.toBlob((blob) => downloadBlob(blob), 'image/png');
    return;
  }
  const img = previewBox.querySelector('img');
  if (img) {
    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'qr-' + Date.now() + '.png';
    a.click();
    return;
  }
  showError('Generate QR dulu');
};

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qr-' + Date.now() + '.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('qrPreviewBtn').onclick = () => {
  const canvas = previewBox.querySelector('canvas');
  const img = previewBox.querySelector('img');
  if (!canvas && !img) return showError('Generate QR dulu');
  viewerCanvas.innerHTML = '';
  if (canvas) {
    const big = document.createElement('canvas');
    big.width = canvas.width;
    big.height = canvas.height;
    big.style.maxWidth = '85vw';
    big.style.maxHeight = '80vh';
    big.style.borderRadius = '12px';
    big.style.imageRendering = 'pixelated';
    big.getContext('2d').drawImage(canvas, 0, 0);
    viewerCanvas.appendChild(big);
  } else {
    const big = document.createElement('img');
    big.src = img.src;
    big.style.maxWidth = '85vw';
    big.style.maxHeight = '80vh';
    big.style.borderRadius = '12px';
    viewerCanvas.appendChild(big);
  }
  viewer.classList.remove('hidden');
};

$('qrViewerClose').onclick = () => viewer.classList.add('hidden');
viewer.onclick = (e) => { if (e.target === viewer) viewer.classList.add('hidden'); };

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    generateBtn.click();
  }
});
