import axios from "axios";
import crypto from "crypto";

const BASE = "https://www.alightpro.my.id";
const http = axios.create({
  baseURL: BASE,
  headers: {
    "accept": "*/*",
    "accept-language": "id-ID,id;q=0.9",
    "referer": `${BASE}/`,
    "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36",
  },
});

let _cookie = "";
http.interceptors.request.use(cfg => { if (_cookie) cfg.headers["cookie"] = _cookie; return cfg; });
http.interceptors.response.use(res => {
  const sc = res.headers["set-cookie"];
  if (sc) _cookie = sc.map(c => c.split(";")[0]).join("; ");
  return res;
});

async function sha256(str) {
  const buf = Buffer.from(str, "utf8");
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function solvePoW(sessionId, nonce, email, action, difficulty = "0000") {
  const prefix = `${sessionId}:${nonce}:${email.toLowerCase()}:${action}:`;
  for (let i = 0; i < 500000; i++) {
    const hash = await sha256(prefix + i);
    if (hash.startsWith(difficulty)) return String(i);
  }
  return String(Date.now());
}

async function getSession() {
  const { data } = await http.get("/api/session", {
    headers: { "x-requested-with": "XMLHttpRequest" },
  });
  if (!data.status || !data.token || !data.nonce)
    throw new Error("Session invalid: " + JSON.stringify(data));
  return data;
}

async function request(action, body) {
  const sess = await getSession();
  const { token, nonce, sessionId, difficulty = "0000" } = sess;

  process.stderr.write(`Solving PoW (difficulty: ${difficulty})...\n`);
  const pow = await solvePoW(sessionId, nonce, body.email, action, difficulty);
  process.stderr.write(`PoW solved: ${pow}\n`);

  const { data } = await http.post("/api/alight-motion",
    { action, ...body },
    {
      headers: {
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
        "x-amprem-token": token,
        "x-amprem-nonce": nonce,
        "x-amprem-pow": pow,
      },
    }
  );
  return data;
}

async function getStats() {
  const [a, b] = await Promise.all([
    http.get("/api/stats"),
    http.get("/api/stats/recent"),
  ]);
  return { stats: a.data, recent: b.data };
}

export {
  http,
  sha256,
  solvePoW,
  getSession,
  request,
  getStats,
  BASE,
  _cookie
};

if (import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    const [,, cmd, ...args] = process.argv;
    const usage = `Usage:
  node amprem.js send <email>
  node amprem.js verify <email> <oob_link>
  node amprem.js stats`;

    try {
      if (cmd === "send") {
        const [email] = args;
        if (!email) throw new Error("Missing email");
        console.log(JSON.stringify(await request("send", { email }), null, 2));

      } else if (cmd === "verify") {
        const [email, link] = args;
        if (!email || !link) throw new Error("Missing email or link");
        console.log(JSON.stringify(await request("verify", { email, link }), null, 2));

      } else if (cmd === "stats") {
        console.log(JSON.stringify(await getStats(), null, 2));

      } else {
        console.log(usage);
        process.exit(1);
      }
    } catch (e) {
      console.error("Error:", e.response?.data ?? e.message);
      process.exit(1);
    }
  }

  main();
}