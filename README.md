# vimbo — movie store showcase

Project 5. PHP · Symfony · Node.js · React · ffmpeg

Generates fake movies with reproducible data and video trailers.

## Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Data | PHP 8.4 + FakerPHP | Seeded generation, locale dictionaries, JSON API |
| Video | Node.js + ffmpeg | Trailer rendering, posters, cache, ZIP export |
| UI | React + Vite | Toolbar, table, gallery, player |
| Gateway | nginx | Routing `/api` and `/video` |

## Languages

English (US), Русский, Беларуская, Español.
Dictionaries live in `data/locales/*.json` — adding a language needs no code changes.

## Third-party libraries

| Library | Where | Role |
|---|---|---|
| `fakerphp/faker` | `api/src/Service/FakerNames.php` | People and company names for en_US, ru_RU, es_ES |
| `archiver` | `video/src/export.js` | ZIP export of the current table page |
| `express`, `p-queue` | `video/src/server.js` | HTTP layer and render queue |
| `react`, `vite` | `web/` | SPA, toolbar, table and gallery |

Belarusian has no provider in Faker, so `be_BY` falls back to `data/locales/be_BY.json`.
The fallback is automatic — a locale is used from the library only if it really ships one.

## Run

```bash
cd web && npm install && npm run build && cd ..
sudo bash install.sh
```

Opens on port 8087.

## Key points

- Same seed always produces identical data and identical trailers
- Changing likes or reviews does not alter titles, cast or genres
- All generation happens server-side; nothing is stored in a database
- 58 xfade transitions, 8 color grades, 8 musical keys
