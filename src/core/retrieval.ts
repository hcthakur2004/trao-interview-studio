import * as cheerio from 'cheerio';
import ipaddr from 'ipaddr.js';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import robotsParser from 'robots-parser';
import type { Page, Research } from './contracts';

const AGENT = 'InterviewStudioBot';
export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}
export function normalizeUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Only HTTP(S) URLs without credentials are allowed');
  url.hash = '';
  return url;
}
export async function resolveTarget(raw: string, allowLocal = false, signal?: AbortSignal) {
  const url = normalizeUrl(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DNS lookup timed out')), 7000);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    lookup(hostname, { all: true })
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      });
  });
  if (!addresses.length || (!allowLocal && addresses.some((a) => !isPublicAddress(a.address))))
    throw new Error('URL resolves to a non-public address');
  return { url, address: addresses.find((a) => a.family === 4) ?? addresses[0] };
}

export type FetchOptions = {
  allowLocal?: boolean;
  signal?: AbortSignal;
  maxBytes?: number;
  timeout?: number;
  followRedirects?: boolean;
};
export async function safeFetch(
  raw: string,
  options: FetchOptions = {},
  redirects = 0,
): Promise<{ url: string; text: string; status: number; contentType: string; location?: string }> {
  options.signal?.throwIfAborted();
  if (redirects > 4) throw new Error('Too many redirects');
  const { url, address } = await resolveTarget(raw, options.allowLocal, options.signal);
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    // Pin the validated DNS answer for this connection, retaining hostname/SNI.
    const request = transport.request(
      url,
      {
        method: 'GET',
        family: address.family,
        signal: options.signal,
        headers: {
          'User-Agent': `${AGENT}/1.0`,
          Accept: 'text/html,text/plain,application/xhtml+xml',
          'Accept-Encoding': 'identity',
        },
        lookup: (_hostname, _opts, cb) => cb(null, address.address, address.family),
      },
      (response) => {
        const status = response.statusCode ?? 500;
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          if (options.followRedirects === false) {
            response.resume();
            resolve({
              url: url.href,
              text: '',
              status,
              contentType: '',
              location: new URL(response.headers.location, url).href,
            });
            return;
          }
          response.resume();
          resolve(safeFetch(new URL(response.headers.location, url).href, options, redirects + 1));
          return;
        }
        const contentType = String(response.headers['content-type'] ?? '')
          .split(';')[0]
          .trim();
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        if (!['text/html', 'text/plain', 'application/xhtml+xml'].includes(contentType)) {
          response.resume();
          reject(new Error(`Unsupported content type: ${contentType}`));
          return;
        }
        const cap = options.maxBytes ?? 2_000_000;
        if (Number(response.headers['content-length']) > cap) {
          response.destroy();
          reject(new Error('Page exceeds size limit'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > cap) {
            response.destroy();
            reject(new Error('Page exceeds size limit'));
          } else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () =>
          resolve({
            url: url.href,
            text: Buffer.concat(chunks).toString('utf8'),
            status,
            contentType,
          }),
        );
      },
    );
    request.setTimeout(options.timeout ?? 7000, () => request.destroy(new Error('Page timed out')));
    request.on('error', reject);
    request.end();
  });
}
export function cleanPage(html: string, url: string): Page {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  const links: Page['links'] = [];
  $('a[href]').each((_, element) => {
    try {
      const link = normalizeUrl(new URL($(element).attr('href')!, url).href);
      links.push({
        url: link.href,
        text: $(element).text().replace(/\s+/g, ' ').trim().slice(0, 180),
      });
    } catch {
      /* non-web link */
    }
  });
  $('script,style,noscript,svg,iframe,form').remove();
  $('br').replaceWith('\n');
  $('p,h1,h2,h3,h4,li,section').append('\n');
  const body = $('main').length ? $('main').text() : $('body').text();
  return {
    url,
    title,
    text: body
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .slice(0, 14000),
    links,
  };
}
export function rankLink(link: { url: string; text: string }) {
  const s = `${link.url} ${link.text}`.toLowerCase();
  return (
    (/interview|hiring.process|recruitment|how.we.hire/.test(s) ? 20 : 0) +
    (/careers|jobs|handbook|join.us/.test(s) ? 10 : 0) +
    (/about|engineering|values|culture|company/.test(s) ? 5 : 0) -
    (/privacy|terms|login|sign.in|contact/.test(s) ? 25 : 0)
  );
}
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(done, ms);
    function done() {
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    function abort() {
      clearTimeout(id);
      reject(signal?.reason);
    }
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });

export async function crawlCompany(
  raw: string,
  options: FetchOptions = {},
  onPage?: (message: string) => void,
): Promise<Research> {
  const result: Research = {
    pages: [],
    hiring_pages: [],
    discussion_sources: [],
    discussion_summary: '',
    warnings: [],
  };
  let root: URL;
  try {
    root = normalizeUrl(raw);
  } catch {
    result.warnings.push('Company URL is invalid; research could not start.');
    return result;
  }
  const queue = [{ url: root.href, text: 'Company website', depth: 0 }];
  const visited = new Set<string>();
  const robots = new Map<string, ReturnType<typeof robotsParser> | null>();
  const allowedHosts = new Set([
    root.hostname,
    root.hostname.replace(/^www\./, ''),
    `www.${root.hostname.replace(/^www\./, '')}`,
  ]);
  let nextFetchAt = 0;
  while (queue.length && visited.size < 9 && result.pages.length < 6) {
    if (options.signal?.aborted) {
      result.warnings.push(
        'Company research stopped at its time budget; available pages were retained.',
      );
      break;
    }
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    visited.add(item.url);
    const target = new URL(item.url);
    if (!robots.has(target.origin)) {
      const robotsUrl = `${target.origin}/robots.txt`;
      try {
        const res = await safeFetch(robotsUrl, { ...options, maxBytes: 100000 });
        robots.set(target.origin, robotsParser(robotsUrl, res.text));
      } catch (error) {
        if (String(error).includes('HTTP 404'))
          robots.set(target.origin, robotsParser(robotsUrl, ''));
        else {
          robots.set(target.origin, null);
          result.warnings.push(
            `Skipped ${target.origin}: robots.txt unavailable (${error instanceof Error ? error.message : 'request failed'}).`,
          );
        }
      }
    }
    const policy = robots.get(target.origin);
    if (!policy || policy.isAllowed(item.url, AGENT) === false) {
      result.warnings.push(`Skipped ${item.url}: robots policy.`);
      continue;
    }
    try {
      await sleep(Math.max(0, nextFetchAt - Date.now()), options.signal);
    } catch {
      result.warnings.push('Company research stopped while respecting the site crawl delay.');
      break;
    }
    nextFetchAt = Date.now() + Math.max(350, (policy.getCrawlDelay(AGENT) ?? 0) * 1000);
    try {
      let response;
      try {
        response = await safeFetch(item.url, { ...options, followRedirects: false });
      } catch (error) {
        if (!/HTTP (429|5\d\d)|timed out/.test(String(error))) throw error;
        await sleep(800, options.signal);
        response = await safeFetch(item.url, { ...options, followRedirects: false });
      }
      // Queue redirects before fetching: every destination gets its own robots check.
      if (response.location) {
        const redirected = normalizeUrl(response.location);
        if (allowedHosts.has(redirected.hostname)) queue.unshift({ ...item, url: redirected.href });
        else result.warnings.push(`Skipped cross-origin redirect from ${item.url}.`);
        continue;
      }
      const page = cleanPage(response.text, response.url);
      result.pages.push(page);
      onPage?.(`Read ${page.title || page.url}`);
      if (/interview|hiring process|recruitment process|how we hire/i.test(page.text))
        result.hiring_pages.push(page.url);
      if (item.depth < 3) {
        const candidates = page.links
          .filter((l) => {
            const u = new URL(l.url);
            return (
              allowedHosts.has(u.hostname) &&
              !visited.has(l.url) &&
              rankLink(l) > 0 &&
              !/\.(pdf|png|jpg|zip|mp4)$/i.test(u.pathname)
            );
          })
          .sort((a, b) => rankLink(b) - rankLink(a))
          .slice(0, 15);
        queue.push(...candidates.map((l) => ({ ...l, depth: item.depth + 1 })));
        queue.sort((a, b) => rankLink(b) - rankLink(a));
      }
    } catch (error) {
      result.warnings.push(
        `Skipped ${item.url}: ${error instanceof Error ? error.message : 'retrieval failed'}.`,
      );
    }
  }
  if (!result.hiring_pages.length)
    result.warnings.push('No hiring-process page was discovered within the crawl budget.');
  if (!result.pages.length)
    result.warnings.push(
      'Company research unavailable. The kit is based on the job description only.',
    );
  return result;
}

export async function searchDiscussion(
  company: string,
  hostname: string,
  signal: AbortSignal,
): Promise<{ sources: string[]; summary: string; warning?: string }> {
  if (!company && (!hostname || hostname === 'localhost' || /^(?:127\.|\[?::1\]?$)/.test(hostname)))
    return {
      sources: [],
      summary: '',
      warning: 'Public discussion search skipped: no identifiable public company was supplied.',
    };
  if (!process.env.TAVILY_API_KEY)
    return {
      sources: [],
      summary: '',
      warning: 'Public discussion search unavailable: TAVILY_API_KEY is not configured.',
    };
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: `${company || hostname} interview process candidate experience`,
        search_depth: 'basic',
        max_results: 4,
        include_answer: false,
      }),
    });
    if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
    const body = (await response.json()) as { results?: { url: string; content: string }[] };
    const results = (body.results ?? []).filter((r) => {
      try {
        return normalizeUrl(r.url).hostname !== hostname;
      } catch {
        return false;
      }
    });
    return {
      sources: results.map((r) => r.url),
      summary: results.map((r) => `${r.url}\n${r.content.slice(0, 1200)}`).join('\n\n'),
      ...(!results.length ? { warning: 'No public interview discussion was found.' } : {}),
    };
  } catch (error) {
    return {
      sources: [],
      summary: '',
      warning: `Public discussion search failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
    };
  }
}
