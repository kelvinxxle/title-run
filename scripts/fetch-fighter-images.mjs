import fs from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(fs.readFileSync('scripts/fighter-image-manifest.json', 'utf8'));
const OUT = 'public/fighters';
const UA = 'TitleRunPersonalProject/1.0 (personal use)';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tryFetch(url, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429) {
      const wait = Math.min(delayMs * Math.pow(2, i), 15000);
      console.log(`  429 rate-limited on ${url.split('/').pop()}, waiting ${wait}ms…`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) return null;
    return res;
  }
  return null;
}

const entries = Object.values(manifest.fighters);
let credits = '# Fighter image credits\n\nImages sourced from Wikipedia / Wikimedia Commons (freely licensed). Personal, non-commercial project.\n\n';

for (const f of entries) {
  const dest = path.join(OUT, `${f.id}.jpg`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log('skip (exists)', f.id);
    credits += `- **${f.id}** — ${f.title} — ${f.orig}\n`;
    continue;
  }
  // try orig first (3 attempts), then thumb as fallback
  let res = await tryFetch(f.orig, 3, 2000);
  if (!res) {
    console.log(`  orig failed for ${f.id}, trying thumb…`);
    res = await tryFetch(f.thumb, 3, 2000);
  }
  if (!res) throw new Error(`Could not fetch image for ${f.id} (both orig and thumb failed)`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  credits += `- **${f.id}** — ${f.title} — ${f.orig}\n`;
  console.log('saved', f.id, buf.length, 'bytes');
  await sleep(800); // gentle pacing
}
fs.writeFileSync(path.join(OUT, 'CREDITS.md'), credits);
console.log('DONE:', entries.length, 'images');
