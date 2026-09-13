const $ = (id) => document.getElementById(id);
const uploadBox = $('rbgUpload');
const fileInput = $('rbgFile');
const loading = $('rbgLoading');
const loadingText = $('rbgLoadingText');
const progress = $('rbgProgress');
const result = $('rbgResult');
const preview = $('rbgPreview');
const errorBox = $('rbgError');
const viewer = $('rbgViewer');
const viewerImg = $('rbgViewerImg');
const toastEl = $('toast');

let lastBlobUrl = null;

function toast(m) {
  toastEl.textContent = m;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

function showError(msg) {
  errorBox.textContent = '⚠️ ' + msg;
  errorBox.classList.remove('hidden');
  loading.classList.add('hidden');
}

uploadBox.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return showError('Max 10MB');
  if (!file.type.startsWith('image/')) return showError('Hanya gambar');

  errorBox.classList.add('hidden');
  result.classList.add('hidden');
  loading.classList.remove('hidden');
  loadingText.textContent = 'Memproses...';
  progress.style.width = '30%';

  try {
    const blob = await removeBgSimple(file, (pct) => {
      progress.style.width = pct + '%';
      loadingText.textContent = 'Memproses: ' + pct + '%';
    });
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = URL.createObjectURL(blob);
    preview.src = lastBlobUrl;
    loading.classList.add('hidden');
    result.classList.remove('hidden');
    toast('✅ Background dihapus!');
  } catch (err) {
    console.error(err);
    showError(err.message || 'Gagal proses');
  }
};

function removeBgSimple(file, onProgress) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('Gagal baca file'));
    img.onerror = () => reject(new Error('Gagal load gambar'));
    img.onload = () => {
      onProgress(40);
      // Resize max 1200px
      let w = img.width, h = img.height;
      const maxDim = 1200;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      onProgress(60);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Sample warna background dari pinggiran
      const samples = [];
      const stepX = Math.max(1, Math.floor(w / 20));
      const stepY = Math.max(1, Math.floor(h / 20));
      for (let x = 0; x < w; x += stepX) {
        samples.push([data[(0 * w + x) * 4], data[(0 * w + x) * 4 + 1], data[(0 * w + x) * 4 + 2]]);
        samples.push([data[((h-1) * w + x) * 4], data[((h-1) * w + x) * 4 + 1], data[((h-1) * w + x) * 4 + 2]]);
      }
      for (let y = 0; y < h; y += stepY) {
        samples.push([data[(y * w + 0) * 4], data[(y * w + 0) * 4 + 1], data[(y * w + 0) * 4 + 2]]);
        samples.push([data[(y * w + (w-1)) * 4], data[(y * w + (w-1)) * 4 + 1], data[(y * w + (w-1)) * 4 + 2]]);
      }
      onProgress(75);

      // Hitung rata-rata warna background
      let rSum = 0, gSum = 0, bSum = 0;
      samples.forEach(s => { rSum += s[0]; gSum += s[1]; bSum += s[2]; });
      const bgR = rSum / samples.length;
      const bgG = gSum / samples.length;
      const bgB = bSum / samples.length;

      // Hitung variance — kalau terlalu bervariasi, background kompleks
      let variance = 0;
      samples.forEach(s => {
        variance += Math.pow(s[0] - bgR, 2) + Math.pow(s[1] - bgG, 2) + Math.pow(s[2] - bgB, 2);
      });
      variance = variance / samples.length;
      const tolerance = Math.max(30, Math.min(100, Math.sqrt(variance) + 30));

      onProgress(85);

      // Hapus pixel yang mirip background
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const dr = r - bgR, dg = g - bgG, db = b - bgB;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < tolerance) {
          data[i + 3] = 0; // transparan
        } else if (dist < tolerance * 1.5) {
          // Semi-transparan di tepi
          data[i + 3] = Math.round(255 * ((dist - tolerance) / (tolerance * 0.5)));
        }
      }
      onProgress(95);

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        onProgress(100);
        resolve(blob);
      }, 'image/png');
    };
    reader.readAsDataURL(file);
  });
}

$('rbgDownloadBtn').onclick = () => {
  if (!lastBlobUrl) return;
  const a = document.createElement('a');
  a.href = lastBlobUrl;
  a.download = 'no-bg-' + Date.now() + '.png';
  a.click();
};

$('rbgPreviewBtn').onclick = () => {
  if (!lastBlobUrl) return;
  viewerImg.src = lastBlobUrl;
  viewer.classList.remove('hidden');
};

$('rbgViewerClose').onclick = () => viewer.classList.add('hidden');
viewer.onclick = (e) => { if (e.target === viewer) viewer.classList.add('hidden'); };

$('rbgResetBtn').onclick = () => {
  fileInput.value = '';
  result.classList.add('hidden');
  uploadBox.classList.remove('hidden');
  errorBox.classList.add('hidden');
  if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
};
