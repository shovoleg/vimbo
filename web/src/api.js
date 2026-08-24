
export async function fetchLocales(signal) {
  const r = await fetch('/api/locales', { signal });
  if (!r.ok) throw new Error(`Locales: HTTP ${r.status}`);
  return (await r.json()).locales;
}

export async function fetchMovies({ seed, page, locale, likes, reviews }, signal) {
  const q = new URLSearchParams({
    seed: String(seed),
    page: String(page),
    locale,
    likes: String(likes),
    reviews: String(reviews),
  });

  const r = await fetch(`/api/movies?${q}`, { signal });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      if (body.error) msg = body.error;
    } catch {
    }
    throw new Error(msg);
  }
  return r.json();
}

function mediaQuery(movie, seed, locale) {
  return new URLSearchParams({
    seed: String(seed),
    index: String(movie.index),
    locale,
    title: movie.title,
    genre: movie.genre,
    year: String(movie.year),
    tagline: movie.tagline ?? '',
    actor: (movie.cast?.[0] ?? '').toUpperCase(),
  });
}

export function posterUrl(movie, seed, locale, portrait = false) {
  const q = mediaQuery(movie, seed, locale);
  if (portrait) q.set('portrait', '1');
  return `/video/poster?${q}`;
}

export function trailerUrl(movie, seed, locale) {
  return `/video/trailer?${mediaQuery(movie, seed, locale)}`;
}

export async function exportZip({ seed, locale, movies }) {
  const r = await fetch('/video/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seed: String(seed),
      locale,
      movies: movies.map((m) => ({
        index: m.index,
        title: m.title,
        genre: m.genre,
        year: m.year,
        cast: m.cast,
      })),
    }),
  });

  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const b = await r.json();
      if (b.error) msg = b.error;
    } catch {
    }
    throw new Error(msg);
  }

  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vimbo-${seed}-${locale}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
