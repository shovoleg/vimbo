
import archiver from 'archiver';
import { promises as fs } from 'fs';
import { renderTrailer, cachePath } from './trailer.js';

function safeName(title, index) {
  const clean = String(title)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);

  const num = String(index).padStart(2, '0');
  return clean ? `${num} ${clean}.mp4` : `${num} untitled.mp4`;
}

/**
 * Собрать архив и отдать его потоком.
 *
 * Рендер идёт через ту же очередь, что и обычные запросы: экспорт
 * десяти роликов не должен блокировать остальных пользователей.
 */
export async function streamZip(req, res, { queue, cacheDir }) {
  const { seed, locale, movies } = req.body ?? {};

  if (!/^\d{1,15}$/.test(String(seed ?? ''))) {
    return res.status(400).json({ error: 'seed must be a number up to 15 digits' });
  }
  if (!/^[a-z]{2}_[A-Z]{2}$/.test(String(locale ?? ''))) {
    return res.status(400).json({ error: 'bad locale' });
  }
  if (!Array.isArray(movies) || movies.length === 0) {
    return res.status(400).json({ error: 'movies list is empty' });
  }
  // Ограничение сверху: страница таблицы — десять записей, запас на будущее.
  if (movies.length > 50) {
    return res.status(400).json({ error: 'too many movies, limit is 50' });
  }

  // Готовим файлы заранее: если рендер упадёт, лучше отдать ошибку
  // до начала передачи архива, а не оборвать поток на середине.
  const prepared = [];
  try {
    await Promise.all(
      movies.map(async (m) => {
        const index = Number(m.index);
        if (!Number.isInteger(index) || index < 1) return;

        const file = cachePath(cacheDir, seed, index, locale);

        let ready = false;
        try {
          ready = (await fs.stat(file)).size > 0;
        } catch {
          ready = false;
        }

        if (!ready) {
          await queue.add(() =>
            renderTrailer(
              {
                seed,
                index,
                locale,
                title: String(m.title ?? 'Untitled').slice(0, 80),
                genre: String(m.genre ?? '').slice(0, 40),
                year: Number(m.year) || 2000,
                tagline: String(m.tagline ?? 'COMING SOON').slice(0, 40),
                actor: String(m.cast?.[0] ?? '').toUpperCase().slice(0, 60),
              },
              file,
            ),
          );
        }

        prepared.push({ file, name: safeName(m.title, index) });
      }),
    );
  } catch (e) {
    return res.status(500).json({ error: `render failed: ${String(e.message).slice(0, 200)}` });
  }

  if (prepared.length === 0) {
    return res.status(400).json({ error: 'nothing to export' });
  }

  // Порядок как в таблице: файлы уходят в архив по возрастанию номера.
  prepared.sort((a, b) => a.name.localeCompare(b.name));

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="vimbo-${seed}-${locale}.zip"`);
  res.setHeader('Cache-Control', 'no-store');

  const archive = archiver('zip', { zlib: { level: 1 } });

  // mp4 уже сжат, поэтому уровень 1: экономим процессор, размер тот же.
  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') console.error('archiver warning:', err.message);
  });
  archive.on('error', (err) => {
    console.error('archiver error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'zip failed' });
    else res.destroy();
  });

  archive.pipe(res);
  for (const f of prepared) archive.file(f.file, { name: f.name });
  await archive.finalize();
}
