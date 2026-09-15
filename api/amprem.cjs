const axios = require("axios");
const crypto = require("crypto");

const BASE = "https://www.alightpro.my.id";

const http = axios.create({
  baseURL: BASE,
  headers: {
    accept: "*/*",
    "accept-language": "id-ID,id;q=0.9",
    referer: `${BASE}/`,
    "user-agent":
      "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36",
  },
});

let cookie = "";

http.interceptors.request.use((config) => {
  if (cookie) config.headers.cookie = cookie;
  return config;
});

http.interceptors.response.use((response) => {
  const setCookie = response.headers["set-cookie"];

  if (setCookie) {
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  }

  return response;
});

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function solvePoW(
  sessionId,
  nonce,
  email,
  action,
  difficulty = "0000"
) {
  const prefix =
    `${sessionId}:${nonce}:${email.toLowerCase()}:${action}:`;

  for (let i = 0; i < 500000; i++) {
    const hash = sha256(prefix + i);

    if (hash.startsWith(difficulty)) {
      return String(i);
    }
  }

  return String(Date.now());
}

async function getSession() {
  const { data } = await http.get("/api/session", {
    headers: {
      "x-requested-with": "XMLHttpRequest",
    },
  });

  if (!data.status || !data.token || !data.nonce) {
    throw new Error(
      "Session invalid: " + JSON.stringify(data)
    );
  }

  return data;
}

async function request(action, body) {
  const sess = await getSession();

  const {
    token,
    nonce,
    sessionId,
    difficulty = "0000",
  } = sess;

  const pow = solvePoW(
    sessionId,
    nonce,
    body.email,
    action,
    difficulty
  );

  const { data } = await http.post(
    "/api/alight-motion",
    {
      action,
      ...body,
    },
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

  return {
    stats: a.data,
    recent: b.data,
  };
}

module.exports = {
  BASE,
  http,
  sha256,
  solvePoW,
  getSession,
  request,
  getStats,
};
