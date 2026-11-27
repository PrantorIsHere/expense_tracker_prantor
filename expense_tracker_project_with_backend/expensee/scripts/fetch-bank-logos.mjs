#!/usr/bin/env node
/**
 * Downloads each bank's own logo into public/bank-logos and writes
 * src/data/bank-logos.json (bank id -> logo path).
 *
 *   node scripts/fetch-bank-logos.mjs            # fetch banks that have no logo yet
 *   node scripts/fetch-bank-logos.mjs --all      # refetch every bank without a fixed "logo"
 *   node scripts/fetch-bank-logos.mjs nagad ucb  # refetch only these ids
 *
 * Sources, largest image wins:
 *   1. the bank homepage's apple-touch-icon / largest <link rel=icon>, and /apple-touch-icon.png
 *   2. the logo in the bank's English Wikipedia article (only if roughly square)
 *   3. Google's favicon cache, then /favicon.ico
 * Entries in banks.json with a "logo" field are hand-picked and never touched.
 * SVGs with scripts, event handlers or external references are rejected.
 * When Node rejects a site's certificate chain (common with missing intermediates),
 * the system curl is used instead; certificates are still verified.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const banksFile = path.join(root, 'src/data/banks.json');
const manifestFile = path.join(root, 'src/data/bank-logos.json');
const outDir = path.join(root, 'public/bank-logos');
const UA = 'Mozilla/5.0 (compatible; expense-tracker-logo-fetch/1.0)';
const MIN_SIZE = 16;
const GOOD_SIZE = 96;
// Default icons that CMS installs ship with; never a bank's logo.
const BLOCKED_HASHES = new Set([
  'c3532d39f298c863a7489a2b4e95bda0676279c1', // WordPress default favicon
  'c50c4273b9d2433c6069454f971ed6653e07c126', // XAMPP default favicon
]);

const args = process.argv.slice(2);
const refetchAll = args.includes('--all');
const only = args.filter(a => !a.startsWith('--'));

const banks = JSON.parse(await fs.readFile(banksFile, 'utf8'));
const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8').catch(() => '{}'));
await fs.mkdir(outDir, { recursive: true });

/* ---------- network ---------- */

function curl(url, ms) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sL', '--max-time', String(Math.ceil(ms / 1000)), '-A', UA, '-w', '\n%{http_code} %{url_effective}', url],
      { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(err);
        const cut = stdout.lastIndexOf(0x0a);
        const [code, finalUrl] = stdout.subarray(cut + 1).toString().split(' ');
        resolve({ ok: Number(code) >= 200 && Number(code) < 300, status: Number(code), url: finalUrl || url, buf: stdout.subarray(0, cut) });
      });
  });
}

/** GET a URL; returns { ok, status, url, buf }. Falls back to curl on certificate errors. */
async function fetchUrl(url, ms = 15000) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
    return { ok: res.ok, status: res.status, url: res.url, buf: Buffer.from(await res.arrayBuffer()) };
  } catch (e) {
    const code = String(e.cause?.code || '');
    if (/CERT|SIGNATURE|SSL|TLS|ISSUER/i.test(code)) return curl(url, ms);
    throw Object.assign(new Error(code || e.name), { code });
  }
}

/* ---------- images ---------- */

/** Detects the format and pixel size of an image buffer; null if it is not an image we accept. */
function inspect(buf) {
  const b = Buffer.from(buf);
  if (b.length < 16) return null;
  if (b.readUInt32BE(0) === 0x89504e47) return { ext: 'png', size: Math.min(b.readUInt32BE(16), b.readUInt32BE(20)) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { ext: 'jpg', size: Math.min(b.readUInt16BE(i + 5), b.readUInt16BE(i + 7)) };
      i += 2 + len;
    }
    return { ext: 'jpg', size: 0 };
  }
  if (b.toString('ascii', 0, 4) === 'GIF8') return { ext: 'gif', size: Math.min(b.readUInt16LE(6), b.readUInt16LE(8)) };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { ext: 'webp', size: Math.min(1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)) };
    if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return { ext: 'webp', size: Math.min((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1) }; }
    return { ext: 'webp', size: Math.min(b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff) };
  }
  if (b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1) {
    const count = b.readUInt16LE(4);
    let best = 0;
    for (let i = 0; i < count && 6 + i * 16 + 16 <= b.length; i++) best = Math.max(best, b[6 + i * 16] || 256);
    return { ext: 'ico', size: best };
  }
  const text = b.toString('utf8', 0, Math.min(b.length, 400000));
  if (/<svg[\s>]/i.test(text)) {
    if (/<script|\son[a-z]+\s*=|javascript:|<foreignObject|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/)|@import|url\(\s*['"]?https?:/i.test(text)) return null;
    return { ext: 'svg', size: 512 };
  }
  return null;
}

function iconLinks(html, base) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() || '';
    if (!/\bicon\b|apple-touch-icon/.test(rel) || /mask-icon/.test(rel)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || href.startsWith('data:') || /\.css(\?|$)/i.test(href)) continue;
    const sizes = /sizes\s*=\s*["'](\d+)x\d+/i.exec(tag)?.[1];
    try {
      out.push({ url: new URL(href, base).href, hint: Number(sizes) || (/apple/.test(rel) ? 180 : 0) });
    } catch { /* bad URL */ }
  }
  return out.sort((a, b) => b.hint - a.hint);
}

/**
 * Logo from the bank's English Wikipedia article. The article title must match the bank,
 * the file must be a logo (SVG/PNG or "logo" in the name, never a photo), and it must be
 * roughly square unless maxRatio allows a wide wordmark.
 */
async function wikipediaLogo(bank, maxRatio = 1.7) {
  const key = (bank.short || bank.name).toLowerCase().replace(/\b(plc|limited|ltd|bank|the)\b/g, '').trim().split(/\s+/)[0];
  const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=1&prop=pageimages&piprop=original&gsrsearch=${encodeURIComponent(bank.name)}`;
  try {
    const res = await fetchUrl(api, 12000);
    const page = Object.values(JSON.parse(res.buf.toString()).query?.pages || {})[0];
    const img = page?.original;
    if (!img || !key || !page.title.toLowerCase().includes(key)) return null;
    const file = decodeURIComponent(img.source.split('/').pop() || '');
    if (!/\.(svg|png)$/i.test(file) && !/logo/i.test(file)) return null;
    const ratio = img.width / img.height;
    if (ratio < 0.6 || ratio > maxRatio) return null;
    return { url: img.source, from: 'wikipedia' };
  } catch {
    return null;
  }
}

async function bestLogo(bank) {
  // Many bank certificates only cover the www host, so try it first for bare domains.
  const hosts = bank.domain.startsWith('www.') ? [bank.domain] : [`www.${bank.domain}`, bank.domain];
  let origin = `https://${hosts[0]}`;
  let title = '';
  const site = [];
  for (const host of hosts) {
    try {
      const res = await fetchUrl(`https://${host}`);
      if (!res.ok && res.status !== 403) throw new Error(`HTTP ${res.status}`);
      const html = res.buf.toString('utf8');
      origin = new URL(res.url).origin;
      title = (/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 70);
      site.push(...iconLinks(html, res.url).slice(0, 4).map(c => ({ ...c, from: 'site' })));
      break;
    } catch (e) {
      title = `(homepage failed: ${e.code || e.message})`;
    }
  }

  let best = null;
  const tryCandidate = async c => {
    try {
      const res = await fetchUrl(c.url, 12000);
      if (!res.ok || res.buf.length > 1_500_000) return;
      if (BLOCKED_HASHES.has(createHash('sha1').update(res.buf).digest('hex'))) return;
      const info = inspect(res.buf);
      if (!info || info.size < MIN_SIZE) return;
      if (!best || info.size > best.info.size) best = { buf: res.buf, info, from: c.from };
    } catch { /* next source */ }
  };

  for (const c of [...site, { url: `${origin}/apple-touch-icon.png`, from: 'apple-touch-icon' }]) {
    await tryCandidate(c);
    if (best?.info.size >= 180) break;
  }
  if (!best || best.info.size < GOOD_SIZE) {
    const wiki = await wikipediaLogo(bank);
    if (wiki) await tryCandidate(wiki);
  }
  if (!best || best.info.size < GOOD_SIZE) {
    await tryCandidate({ url: `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin)}&size=256`, from: 'google' });
  }
  if (!best || best.info.size < GOOD_SIZE) await tryCandidate({ url: `${origin}/favicon.ico`, from: 'favicon.ico' });
  if (!best) {
    // Last resort: a wide wordmark is better than no logo at all.
    const wide = await wikipediaLogo(bank, 4);
    if (wide) await tryCandidate({ ...wide, from: 'wikipedia (wide)' });
  }
  return { title, best };
}

/* ---------- run ---------- */

const queue = banks.filter(b => !b.logo && b.domain && (only.length ? only.includes(b.id) : refetchAll || !manifest[b.id]));
console.log(`Fetching ${queue.length} logo(s)...`);
const rows = [];
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < queue.length) {
    const bank = queue[next++];
    const { title, best } = await bestLogo(bank);
    if (best) {
      for (const ext of ['png', 'jpg', 'gif', 'webp', 'ico', 'svg']) await fs.rm(path.join(outDir, `${bank.id}.${ext}`), { force: true });
      const file = `${bank.id}.${best.info.ext}`;
      await fs.writeFile(path.join(outDir, file), best.buf);
      manifest[bank.id] = `/bank-logos/${file}`;
    }
    rows.push(`${bank.id.padEnd(28)} ${best ? `${String(best.info.size).padStart(4)}px ${best.info.ext.padEnd(4)} ${best.from.padEnd(16)}` : '   no logo                  '} ${title}`);
  }
}));

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
await fs.writeFile(manifestFile, JSON.stringify(sorted, null, 2) + '\n');
console.log(rows.sort().join('\n'));
console.log(`\n${Object.keys(sorted).length} logos in ${path.relative(root, manifestFile)}`);
