import { useState, useRef, useEffect } from 'react';
import { posterUrl, trailerUrl } from './api';

export function ThumbUp() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733q.086.18.138.363c.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z" />
    </svg>
  );
}

export function TrailerBox({ movie, seed, locale }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    setPlaying(false);
  }, [movie.index, seed, locale]);

  if (!playing) {
    return (
      <div className="poster">
        <img src={posterUrl(movie, seed, locale)} alt={movie.title} loading="lazy" />
        <button className="play" onClick={() => setPlaying(true)} aria-label="Play trailer" />
      </div>
    );
  }

  return (
    <div className="poster">
      <video
        ref={videoRef}
        src={trailerUrl(movie, seed, locale)}
        poster={posterUrl(movie, seed, locale)}
        controls
        autoPlay
        playsInline
      />
    </div>
  );
}

export function MovieDetail({ movie, seed, locale }) {
  return (
    <div className="detail-in">
      <div>
        <TrailerBox movie={movie} seed={seed} locale={locale} />
        <div className="likes">
          <ThumbUp />
          {movie.likes}
        </div>
      </div>

      <div>
        <div>
          <span className="d-title">{movie.title}</span>
          <span className="d-sub">
            {movie.year}, {movie.genre}
          </span>
        </div>

        <div className="badges">
          {movie.top10 && <span className="badge">TOP 10</span>}
          <span className="meta">{movie.duration} min</span>
          <span className="meta">
            <i>{movie.rating}</i>
          </span>
        </div>

        <div className="meta">
          Cast: <b>{movie.cast.join(', ')}</b>
        </div>
        <div className="meta">
          Director: <b>{movie.director}</b>
        </div>

        <p className="plot">{movie.plot}</p>

        <div className="rev-h">Reviews</div>
        {movie.reviews.length === 0 ? (
          <div className="rev" style={{ borderColor: 'transparent', paddingLeft: 0 }}>
            <cite>No reviews — increase the Reviews value</cite>
          </div>
        ) : (
          movie.reviews.map((r, i) => (
            <div className="rev" key={i}>
              <p>{r.text}</p>
              <cite>
                — <b>{r.author}</b>, {r.company}
              </cite>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function GalleryCard({ movie, seed, locale, onOpen }) {
  return (
    <div className="card" onClick={() => onOpen(movie)}>
      <img
        className="thumb"
        src={posterUrl(movie, seed, locale, true)}
        alt={movie.title}
        loading="lazy"
      />
      <div className="card-b">
        <div className="card-t" title={movie.title}>
          {movie.title}
        </div>
        <div className="card-m">
          <span>
            {movie.year} · {movie.genre}
          </span>
          <span className="glike">
            <ThumbUp />
            {movie.likes}
          </span>
        </div>
      </div>
    </div>
  );
}
