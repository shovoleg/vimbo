import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { fetchLocales, fetchMovies, exportZip } from './api';
import { MovieDetail, GalleryCard } from './components';

const PER_PAGE = 10;
const MAX_SEED = 281474976710655;

export default function App() {
  const [seedInput, setSeedInput] = useState('58933423');
  const [locale, setLocale] = useState('en_US');
  const [likes, setLikes] = useState(4.2);
  const [reviews, setReviews] = useState(2.3);

  const [view, setView] = useState('table');
  const [page, setPage] = useState(1);
  const [openIndex, setOpenIndex] = useState(null);

  const [locales, setLocales] = useState([]);
  const [movies, setMovies] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [galleryPage, setGalleryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [seed] = useDebounce(seedInput, 280);

  const sentinelRef = useRef(null);
  const galleryBusy = useRef(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchLocales(ac.signal)
      .then(setLocales)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    setPage(1);
    setOpenIndex(null);
    setGallery([]);
    setGalleryPage(1);
    window.scrollTo({ top: 0 });
  }, [seed, locale]);

  useEffect(() => {
    if (view !== 'table') return;

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    fetchMovies({ seed, page, locale, likes, reviews }, ac.signal)
      .then((d) => {
        setMovies(d.movies);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setLoading(false);
      });

    return () => ac.abort();
  }, [seed, page, locale, likes, reviews, view]);

  useEffect(() => {
    if (view !== 'gallery') return;

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    fetchMovies({ seed, page: 1, locale, likes, reviews }, ac.signal)
      .then((d) => {
        setGallery(d.movies);
        setGalleryPage(1);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setLoading(false);
      });

    return () => ac.abort();
  }, [seed, locale, likes, reviews, view]);

  const loadMore = useCallback(async () => {
    if (galleryBusy.current || view !== 'gallery' || loading) return;

    galleryBusy.current = true;
    const next = galleryPage + 1;

    try {
      const d = await fetchMovies({ seed, page: next, locale, likes, reviews });
      setGallery((prev) => [...prev, ...d.movies]);
      setGalleryPage(next);
    } catch (e) {
      setError(e.message);
    } finally {
      galleryBusy.current = false;
    }
  }, [seed, locale, likes, reviews, galleryPage, view, loading]);

  useEffect(() => {
    if (view !== 'gallery') return;
    const node = sentinelRef.current;
    if (!node) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loadMore, view]);

  const onExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportZip({ seed, locale, movies });
    } catch (e) {
      setError(`Export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const randomSeed = () => {
    setSeedInput(String(Math.floor(Math.random() * MAX_SEED)));
  };

  const onSeedChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 15);
    setSeedInput(v);
  };

  const rangeStyle = { '--p': `${(likes / 10) * 100}%` };

  return (
    <div className="wrap">
      <div className="toolbar">
        <a className="logo" href="#" onClick={(e) => e.preventDefault()}>
          <span className="mk" />
          <span className="tx">
            <span className="v">v</span>imbo
          </span>
        </a>

        <div className="field">
          <label htmlFor="lang">Language</label>
          <div className="control">
            <select id="lang" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {locales.length === 0 && <option value="en_US">English (US)</option>}
              {locales.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="seed">Seed</label>
          <div className="control">
            <input id="seed" type="text" inputMode="numeric" value={seedInput} onChange={onSeedChange} />
            <button className="icon-btn" onClick={randomSeed} title="Random seed" aria-label="Random seed">
              &#9861;
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="likes">Likes</label>
          <div className="control">
            <input
              id="likes"
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={likes}
              style={rangeStyle}
              onChange={(e) => setLikes(Number(e.target.value))}
            />
            <span className="range-val">{likes.toFixed(1)}</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="reviews">Review</label>
          <div className="control">
            <input
              id="reviews"
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={reviews}
              onChange={(e) => {
                const v = Number(e.target.value);
                setReviews(Number.isFinite(v) ? Math.min(10, Math.max(0, v)) : 0);
              }}
            />
          </div>
        </div>

        <div className="spacer" />

        <div className="field">
          <label>View</label>
          <div className="seg">
            <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>
              &#9776; Table
            </button>
            <button className={view === 'gallery' ? 'on' : ''} onClick={() => setView('gallery')}>
              &#9638; Gallery
            </button>
          </div>
        </div>

        <div className="field">
          <label>Export</label>
          <button
            className="btn-export"
            disabled={view !== 'table' || movies.length === 0 || exporting}
            onClick={onExport}
            title="Download trailers of the current page"
          >
            {exporting ? '… ZIP' : '\u21E9 ZIP'}
          </button>
        </div>
      </div>

      {error && <div className="err">Error: {error}</div>}

      {view === 'table' ? (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th style={{ width: 74 }} />
                <th style={{ width: 130 }}>Genre</th>
                <th>Title</th>
                <th className="hide-sm">Cast</th>
                <th style={{ width: 80, textAlign: 'right' }}>Year</th>
              </tr>
            </thead>
            <tbody>
              {loading && movies.length === 0 &&
                Array.from({ length: PER_PAGE }).map((_, i) => (
                  <tr key={`sk${i}`}>
                    <td colSpan={5}>
                      <div className="skeleton" style={{ height: 20 }} />
                    </td>
                  </tr>
                ))}

              {movies.map((m) => (
                <FragmentRow
                  key={m.index}
                  movie={m}
                  seed={seed}
                  locale={locale}
                  open={openIndex === m.index}
                  onToggle={() => setOpenIndex(openIndex === m.index ? null : m.index)}
                />
              ))}
            </tbody>
          </table>

          <div className="pager">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              &laquo;
            </button>
            {Array.from({ length: 5 }, (_, i) => page - 2 + i)
              .filter((p) => p >= 1)
              .map((p) => (
                <button key={p} className={p === page ? 'on' : ''} onClick={() => setPage(p)}>
                  {p}
                </button>
              ))}
            <button onClick={() => setPage((p) => p + 1)}>&raquo;</button>
          </div>
        </div>
      ) : (
        <>
          <div className="gallery">
            {gallery.map((m) => (
              <GalleryCard
                key={m.index}
                movie={m}
                seed={seed}
                locale={locale}
                onOpen={(mv) => {
                  setView('table');
                  setPage(Math.ceil(mv.index / PER_PAGE));
                  setOpenIndex(mv.index);
                }}
              />
            ))}
          </div>
          <div ref={sentinelRef} className="hint">
            {loading ? 'Loading…' : 'Scroll for more'}
          </div>
        </>
      )}
    </div>
  );
}

function FragmentRow({ movie, seed, locale, open, onToggle }) {
  return (
    <>
      <tr className={`row${open ? ' open' : ''}`} onClick={onToggle}>
        <td className="num">
          <span className="num-in">
            <span className="chev">&#9654;</span>
            {movie.index}
          </span>
        </td>
        <td>
          <span className="genre-tag">{movie.genre}</span>
        </td>
        <td className="title">{movie.title}</td>
        <td className="cast hide-sm">{movie.cast.join(', ')}</td>
        <td className="year">{movie.year}</td>
      </tr>
      {open && (
        <tr className="detail">
          <td colSpan={5} style={{ padding: 0 }}>
            <MovieDetail movie={movie} seed={seed} locale={locale} />
          </td>
        </tr>
      )}
    </>
  );
}
