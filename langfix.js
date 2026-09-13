const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Cari blok body Groq
const old = `body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: messages.slice(-20),
        temperature: 0.7,
        max_tokens: 1024
      })`;

const neu = `body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'Kamu adalah Asisten Javin, AI assistant ramah buatan Javin Semok. PENTING: Selalu jawab pakai bahasa yang sama dengan yang dipakai user. Kalau user chat pakai Bahasa Indonesia, jawab pakai Bahasa Indonesia. Kalau user pakai English, jawab English. Kalau user pakai bahasa daerah (Jawa, Sunda, dll), jawab pakai bahasa itu. Selalu sesuaiin bahasa user. Jawab dengan jelas, singkat, dan helpful. Jangan pernah pakai bahasa Vietnam atau bahasa lain yang bukan bahasa user.' },
          ...messages.slice(-20)
        ],
        temperature: 0.7,
        max_tokens: 1024
      })`;

if (s.indexOf(old) >= 0) {
  s = s.replace(old, neu);
  fs.writeFileSync('server.js', s);
  console.log('FIX-OK');
} else {
  console.log('MARKER-NOT-FOUND');
  // Coba cari pola yang mirip
  const m = s.match(/model:\s*'[^']+',[\s\S]*?max_tokens:\s*\d+/);
  if (m) {
    console.log('Pola yang ada:');
    console.log(m[0]);
  }
}
