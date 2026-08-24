
import express from 'express';
import PQueue from 'p-queue';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import { renderTrailer, cachePath, ensureDir } from './trailer.js';
import { renderPoster } from './poster.js';
import { streamZip } from './export.js';

const PORT = Number(process.env.PORT || 3000);
const CACHE_DIR = process.env.CACHE_DIR || '/srv/cache';
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL || 2);

const app = express();
app.disable('x-powered-by');

app.use(express.json({ limit: '256kb' }));

const queue = new PQueue({ concurrency: MAX_PARALLEL });

const inFlight = new Map();

await ensureDir(CACHE_DIR);
await ensureDir(path.join(CACHE_DIR, 'posters'));

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

function parseParams(q) {
  const seed = String(q.seed ?? '');
  const index = Number(q.index);
  const locale = String(q.locale ?? 'en_US');

  if (!/^\d{1,15}$/.test(seed)) return { error: 'seed must be a number up to 15 digits' };
  if (!Number.isInteger(index) || index < 1 || index > 1e7) return { error: 'index out of range' };
  if (!/^[a-z]{2}_[A-Z]{2}$/.test(locale)) return { error: 'bad locale' };

  return {
    seed,
    index,
    locale,
    title: String(q.title ?? 'Untitled').slice(0, 80),
    genre: String(q.genre ?? '').slice(0, 40),
    year: Number(q.year) || 2000,
    tagline: String(q.tagline ?? 'COMING SOON').slice(0, 40),
    actor: String(q.actor ?? '').slice(0, 60),
  };
}

app.get('/video/health', (req, res) => {
  res.json({ status: 'ok', queue: queue.size, running: queue.pending });
});

app.get('/video/trailer', async (req, res) => {
  const p = parseParams(req.query);
  if (p.error) return badRequest(res, p.error);

  const file = cachePath(CACHE_DIR, p.seed, p.index, p.locale);

  try {
    let ready = false;
    try {
      const st = await fs.stat(file);
      ready = st.size > 0;
    } catch {
      ready = false;
    }

    if (!ready) {
      await ensureDir(path.dirname(file));
      const key = file;
      if (!inFlight.has(key)) {
        inFlight.set(
          key,
          queue.add(() => renderTrailer(p, file)).finally(() => inFlight.delete(key)),
        );
      }
      await inFlight.get(key);
    }

    const stat = await fs.stat(file);
    const range = req.headers.range;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? Number(m[1]) : 0;
      const end = m && m[2] ? Number(m[2]) : stat.size - 1;

      if (start >= stat.size || end >= stat.size || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
        return res.end();
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', end - start + 1);
      return createReadStream(file, { start, end }).pipe(res);
    }

    res.setHeader('Content-Length', stat.size);
    createReadStream(file).pipe(res);
  } catch (e) {
    res.status(500).json({ error: String(e.message).slice(0, 300) });
  }
});

app.get('/video/poster', async (req, res) => {
  const p = parseParams(req.query);
  if (p.error) return badRequest(res, p.error);

  const portrait = req.query.portrait === '1';
  const name = `${p.seed}_${p.index}_${p.locale}${portrait ? '_p' : ''}.jpg`.replace(/[^\w.-]/g, '_');
  const file = path.join(CACHE_DIR, 'posters', name);

  try {
    let ready = false;
    try {
      ready = (await fs.stat(file)).size > 0;
    } catch {
      ready = false;
    }

    if (!ready) {
      await ensureDir(path.dirname(file));
      const key = file;
      if (!inFlight.has(key)) {
        inFlight.set(
          key,
          queue.add(() => renderPoster({ ...p, portrait }, file)).finally(() => inFlight.delete(key)),
        );
      }
      await inFlight.get(key);
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    createReadStream(file).pipe(res);
  } catch (e) {
    res.status(500).json({ error: String(e.message).slice(0, 300) });
  }
});

app.post('/video/export', async (req, res) => {
  try {
    await streamZip(req, res, { queue, cacheDir: CACHE_DIR });
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: String(e.message).slice(0, 300) });
    }
  }
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`vimbo-video слушает :${PORT}, кэш ${CACHE_DIR}, потоков ${MAX_PARALLEL}`);
});
