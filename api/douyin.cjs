const axios = require('axios');
const cheerio = require('cheerio');
const vm = require('vm');

const BASE_URL = 'https://so.douyin.com/';

const DEFAULT_PARAMS = {
  search_entrance: 'aweme',
  enter_method: 'normal_search',
  innerWidth: '431',
  innerHeight: '814',
  is_no_width_reload: '1',
  keyword: ''
};

class DouyinSearchPage {
  constructor() {
    this.cookies = {};

    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'id-ID,id;q=0.9',
        referer: BASE_URL,
        'upgrade-insecure-requests': '1',
        'user-agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36'
      }
    });

    this.api.interceptors.response.use((res) => {
      const cookies = res.headers['set-cookie'];

      if (cookies) {
        cookies.forEach((c) => {
          const first = c.split(';')[0];
          const index = first.indexOf('=');

          if (index > 0) {
            const name = first.slice(0, index);
            const value = first.slice(index + 1);

            if (name && value) {
              this.cookies[name] = value;
            }
          }
        });
      }

      return res;
    });

    this.api.interceptors.request.use((config) => {
      if (Object.keys(this.cookies).length) {
        config.headers.Cookie = Object.entries(this.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      }

      return config;
    });
  }

  async initialize() {
    try {
      await this.api.get('/');
      return true;
    } catch {
      return false;
    }
  }

  async search(query) {
    query = String(query || '').trim();

    if (!query) {
      throw new Error('Keyword wajib diisi.');
    }

    if (query.length > 200) {
      throw new Error('Keyword terlalu panjang.');
    }

    await this.initialize();

    const params = {
      ...DEFAULT_PARAMS,
      keyword: query,
      reloadNavStart: String(Date.now())
    };

    const response = await this.api.get('s', { params });
    const html = String(response.data || '');

    const $ = cheerio.load(html);

    let scriptWithData = '';

    $('script').each((_, el) => {
      const text = $(el).html() || '';

      if (
        text.includes('let data =') &&
        text.includes('"business_data":')
      ) {
        scriptWithData = text;
      }
    });

    if (!scriptWithData) {
      throw new Error('Data hasil Douyin tidak ditemukan.');
    }

    const match = scriptWithData.match(
      /let\s+data\s*=\s*(\{[\s\S]+?\});/
    );

    if (!match) {
      throw new Error('Format data Douyin berubah.');
    }

    const sandbox = {};

    vm.createContext(sandbox);

    vm.runInContext(
      `data = ${match[1]}`,
      sandbox,
      { timeout: 3000 }
    );

    const businessData = sandbox.data?.business_data;

    if (!Array.isArray(businessData)) {
      throw new Error('Hasil Douyin tidak tersedia.');
    }

    return businessData
      .map((entry) => entry?.data?.aweme_info)
      .filter(Boolean)
      .slice(0, 30);
  }
}

module.exports = { DouyinSearchPage };

if (require.main === module) {
  const query = process.argv.slice(2).join(' ');

  if (!query) {
    console.error('Usage: node api/douyin.cjs <keyword>');
    process.exit(1);
  }

  (async () => {
    try {
      const douyin = new DouyinSearchPage();
      const result = await douyin.search(query);

      console.log(
        JSON.stringify(
          {
            ok: true,
            count: result.length,
            results: result
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: error.message
          },
          null,
          2
        )
      );

      process.exit(1);
    }
  })();
}
