import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanPage,
  crawlCompany,
  isPublicAddress,
  normalizeUrl,
  rankLink,
  safeFetch,
} from '../src/core/retrieval';

let server: http.Server;
let origin: string;
let blockedRequests = 0;
beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    const url = req.url!;
    if (url === '/blocked') blockedRequests++;
    if (url === '/redirect-blocked') {
      res.writeHead(302, { Location: '/blocked' });
      res.end();
      return;
    }
    if (url === '/robots.txt') {
      res.setHeader('Content-Type', 'text/plain');
      res.end('User-agent: *\nDisallow: /blocked');
    } else if (url === '/acme/')
      res.end(
        '<title>Acme</title><main>We make tools.<a href="people/">Our team and careers</a><a href="/blocked">Careers</a></main>',
      );
    else if (url === '/acme/people/')
      res.end('<title>People</title><a href="../../handbook/working-with-us">How we hire</a>');
    else if (url === '/handbook/working-with-us')
      res.end(
        '<title>Hiring</title><main>Our interview process: take-home, then system design.</main>',
      );
    else if (url === '/empty') res.end('<main>A company without hiring pages.</main>');
    else if (url === '/redirect') {
      res.statusCode = 302;
      res.setHeader('Location', '/acme/');
      res.end();
    } else if (url === '/binary') {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.end('bad');
    } else if (url === '/big') res.end('x'.repeat(300));
    else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
describe('safe retrieval', () => {
  it('checks robots before following a page redirect', async () => {
    const before = blockedRequests;
    const result = await crawlCompany(`${origin}/redirect-blocked`, { allowLocal: true });
    expect(blockedRequests).toBe(before);
    expect(result.pages).toEqual([]);
    expect(result.warnings.some((w) => w.includes('robots policy'))).toBe(true);
  });
  it('returns an honest partial result when research is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await crawlCompany(`${origin}/acme/`, {
      allowLocal: true,
      signal: controller.signal,
    });
    expect(result.pages).toEqual([]);
    expect(result.warnings.some((w) => w.includes('time budget'))).toBe(true);
  });
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    '0.0.0.0',
  ])('rejects non-public address %s', (address) => expect(isPublicAddress(address)).toBe(false));
  it('accepts public addresses', () => expect(isPublicAddress('8.8.8.8')).toBe(true));
  it('rejects file and credential URLs', () => {
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow();
    expect(() => normalizeUrl('https://u:p@example.com')).toThrow();
  });
  it('blocks localhost in the production fetch policy', async () => {
    await expect(safeFetch(origin)).rejects.toThrow('non-public');
  });
  it('bounds types and sizes', async () => {
    await expect(safeFetch(`${origin}/binary`, { allowLocal: true })).rejects.toThrow(
      'content type',
    );
    await expect(safeFetch(`${origin}/big`, { allowLocal: true, maxBytes: 100 })).rejects.toThrow(
      'size limit',
    );
  });
  it('follows redirects under the explicit evaluation policy', async () => {
    expect((await safeFetch(`${origin}/redirect`, { allowLocal: true })).url).toBe(
      `${origin}/acme/`,
    );
  });
  it('cleans scripts and resolves relative links', () => {
    const page = cleanPage(
      '<main>Hello<script>evil()</script><a href="../about">About</a></main>',
      'https://example.com/a/b/',
    );
    expect(page.text).not.toContain('evil');
    expect(page.links[0].url).toBe('https://example.com/a/about');
    expect(rankLink(page.links[0])).toBeGreaterThan(0);
  });
  it('discovers a nonstandard hiring path via relative links and respects robots', async () => {
    const result = await crawlCompany(`${origin}/acme/`, { allowLocal: true });
    expect(result.hiring_pages).toContain(`${origin}/handbook/working-with-us`);
    expect(result.pages.some((p) => p.url.endsWith('/blocked'))).toBe(false);
    expect(result.warnings.some((w) => w.includes('robots'))).toBe(true);
  });
  it('reports no hiring page and 404 without failing the research result', async () => {
    const a = await crawlCompany(`${origin}/empty`, { allowLocal: true });
    expect(a.hiring_pages).toEqual([]);
    const b = await crawlCompany(`${origin}/missing`, { allowLocal: true });
    expect(b.pages).toEqual([]);
    expect(b.warnings.some((w) => w.includes('404'))).toBe(true);
  });
});
