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
let lastQRCode = null;

function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

function showError(msg) {
  errorBox.textContent = '⚠️ ' + msg;
  errorBox.classList.remove('hidden');
}

function hideError() {
  errorBox.classList.add('hidden');
}

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

  // Clear dulu
  previewBox.innerHTML = '';
  lastQRCode = null;

  try {
    lastQRCode = new QRCode(previewBox, {
      text: text,
      width: currentSize,
      height: currentSize,
      colorDark: currentDark,
      colorLight: currentLight,
      correctLevel: QRCode.CorrectLevel.H
    });
    resultBox.classList.remove('hidden');
    toast('✅ QR berhasil dibuat!');
  } catch (err) {
    console.error(err);
    showError(err.message || 'Gagal generate QR');
  }
};

$('qrDownloadBtn').onclick = () => {
  const canvas = previewBox.querySelector('canvas');
  if (!canvas) return showError('Generate QR dulu');
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-' + Date.now() + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
};

$('qrPreviewBtn').onclick = () => {
  const canvas = previewBox.querySelector('canvas');
  if (!canvas) return showError('Generate QR dulu');
  viewerCanvas.innerHTML = '';
  const bigCanvas = document.createElement('canvas');
  bigCanvas.width = canvas.width;
  bigCanvas.height = canvas.height;
  bigCanvas.style.maxWidth = '90vw';
  bigCanvas.style.maxHeight = '85vh';
  bigCanvas.style.width = 'auto';
  bigCanvas.style.height = 'auto';
  bigCanvas.style.borderRadius = '12px';
  bigCanvas.style.background = '#fff';
  bigCanvas.style.padding = '12px';
  const ctx = bigCanvas.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  viewerCanvas.appendChild(bigCanvas);
  viewer.classList.remove('hidden');
};

$('qrViewerClose').onclick = () => viewer.classList.add('hidden');
viewer.onclick = (e) => { if (e.target === viewer) viewer.classList.add('hidden'); };

// Auto generate kalau user tekan Enter di textarea (Ctrl+Enter)
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    generateBtn.click();
  }
});
