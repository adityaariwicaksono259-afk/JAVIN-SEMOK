const axios = require('axios');
const cheerio = require('cheerio');

class ManhwaDesu {
  constructor(baseUrl = 'https://manhwadesu.wiki/') {
    this.BASE_URL = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    };
  }

  absolute(value = '') {
    if (!value) return '';

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    if (value.startsWith('/')) {
      return this.BASE_URL.replace(/\/$/, '') + value;
    }

    return this.BASE_URL + value;
  }

  async fetch(url, params = {}) {
    const response = await axios.get(url, {
      headers: {
        ...this.headers,
        Referer: this.BASE_URL
      },
      params,
      timeout: 15000,
      maxRedirects: 5
    });

    return response.data;
  }

  parseCard($, el) {
    const card = $(el);

    let href = '';

    if (card.is('a')) {
      href = card.attr('href') || '';
    } else {
      href =
        card.find('a[href^="/manga/"]').first().attr('href') ||
        card.find('a[href*="/manga/"]').first().attr('href') ||
        '';
    }

    const title =
      card.find('.font-semibold').first().text().trim() ||
      card.find('h3').first().text().trim() ||
      card.find('img').first().attr('alt')?.trim() ||
      '';

    const image =
      card.find('img').first().attr('src') ||
      card.find('img').first().attr('data-src') ||
      '';

    let type =
      card.find('.badge').first().text().trim() ||
      card.find('.text-xs').first().text().trim() ||
      '';

    let rating = card
      .find('.text-amber-400')
      .first()
      .text()
      .trim()
      .replace('★', '')
      .trim();

    if (!rating) {
      const match = card.text().match(/★\s*([\d.]+)/);
      if (match) rating = match[1];
    }

    let views = card.find('.text-gray-400').first().text().trim();

    if (!views) {
      const match = card.text().match(/•\s*([\d.A-Za-z,]+)\s*•/);
      if (match) views = match[1];
    }

    const latestChapters = [];

    card.find('a[href*="/chapter/"]').each((i, chapter) => {
      const ch = $(chapter);

      const chapterUrl = ch.attr('href') || '';
      const chapterTitle =
        ch.find('span').first().text().trim() ||
        ch.text().trim();

      if (chapterUrl) {
        latestChapters.push({
          title: chapterTitle,
          url: this.absolute(chapterUrl)
        });
      }
    });

    return {
      title,
      slug: href
        .replace(/^\/manga\//, '')
        .replace(/^\//, '')
        .replace(/\/$/, ''),
      url: href ? this.absolute(href) : '',
      image: image ? this.absolute(image) : '',
      type: type || 'Manga',
      rating: rating || 'N/A',
      views: views || 'N/A',
      latestChapters: latestChapters.slice(0, 3)
    };
  }

  parseList(html) {
    const $ = cheerio.load(html);
    const result = [];
    const seen = new Set();

    const selectors = [
      '.grid-cols-1 .relative',
      '.grid-cols-2 .relative',
      '.grid-cols-3 .relative',
      'a[href^="/manga/"]'
    ];

    for (const selector of selectors) {
      $(selector).each((i, el) => {
        const item = this.parseCard($, el);

        if (!item.title || !item.url) return;

        const key = item.url;

        if (seen.has(key)) return;

        seen.add(key);
        result.push(item);
      });

      if (result.length >= 30) break;
    }

    return result.slice(0, 30);
  }

  async search(query, page = 1) {
    const html = await this.fetch(
      `${this.BASE_URL}search`,
      {
        q: query,
        page: Number(page) || 1
      }
    );

    return {
      query,
      page: Number(page) || 1,
      manga: this.parseList(html)
    };
  }

  async latest(page = 1) {
    const html = await this.fetch(
      `${this.BASE_URL}latest`,
      {
        page: Number(page) || 1
      }
    );

    return {
      page: Number(page) || 1,
      manga: this.parseList(html)
    };
  }

  async popular(page = 1) {
    const html = await this.fetch(
      `${this.BASE_URL}popular`,
      {
        page: Number(page) || 1
      }
    );

    return {
      page: Number(page) || 1,
      manga: this.parseList(html)
    };
  }

  async details(value) {
    let url = value || '';

    if (!/^https?:\/\//i.test(url)) {
      const slug = String(value)
        .replace(/^\/manga\//, '')
        .replace(/^\//, '')
        .replace(/\/$/, '');

      url = `${this.BASE_URL}manga/${slug}`;
    }

    const html = await this.fetch(url);
    const $ = cheerio.load(html);

    const title =
      $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim();

    const image =
      $('img[alt^="Cover"]').first().attr('src') ||
      $('.aspect-\\[2\\/3\\] img').first().attr('src') ||
      $('meta[property="og:image"]').attr('content') ||
      '';

    const description =
      $('.synopsis p').first().text().trim() ||
      $('.description').first().text().trim() ||
      $('meta[name="description"]').attr('content') ||
      '';

    const genres = [];

    $('a[href^="/genres/"]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (
        text &&
        !text.toLowerCase().includes('view all') &&
        !genres.some(x => x.title === text)
      ) {
        genres.push({
          title: text,
          slug: href.replace(/^\/genres\//, ''),
          url: this.absolute(href)
        });
      }
    });

    const chapters = [];

    $('a[href*="/chapter/"]').each((i, el) => {
      const href = $(el).attr('href') || '';

      if (!href) return;

      const text =
        $(el).find('span').first().text().trim() ||
        $(el).text().trim();

      if (
        !chapters.some(x => x.url === this.absolute(href))
      ) {
        chapters.push({
          title: text || `Chapter ${chapters.length + 1}`,
          url: this.absolute(href)
        });
      }
    });

    return {
      title,
      url,
      image: image ? this.absolute(image) : '',
      synopsis: description,
      genres,
      chapters: chapters.slice(0, 100)
    };
  }
}

module.exports = {
  ManhwaDesu
};
