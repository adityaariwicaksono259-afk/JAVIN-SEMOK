// Rate limiter middleware
const messageLimits = new Map();   // userId -> [timestamps]
const loginLimits = new Map();     // ip -> { count, until }
const connectionLimits = new Map();// ip -> count

function checkMessageLimit(userId) {
  const now = Date.now();
  const cooldown = 3000;
  const last = messageLimits.get(userId) || 0;
  if (now - last < cooldown) return false;
  messageLimits.set(userId, now);
  return true;
}

function checkLoginLimit(ip) {
  const now = Date.now();
  const limit = loginLimits.get(ip) || { count: 0, until: 0 };
  if (now < limit.until) return { ok: false, waitSec: Math.ceil((limit.until - now) / 1000) };
  return { ok: true };
}

function recordLoginFail(ip) {
  const now = Date.now();
  const limit = loginLimits.get(ip) || { count: 0, until: 0 };
  limit.count++;
  if (limit.count >= 5) {
    limit.until = now + 5 * 60 * 1000;   // lock 5 menit
    limit.count = 0;
  }
  loginLimits.set(ip, limit);
}

function resetLoginLimit(ip) {
  loginLimits.delete(ip);
}

module.exports = { checkMessageLimit, checkLoginLimit, recordLoginFail, resetLoginLimit };
