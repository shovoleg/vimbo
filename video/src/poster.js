
import { spawn } from 'child_process';
import { SeedStream } from './rng.js';
import { promises as fsp } from 'fs';
import path from 'path';

const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

const PALETTES = [
  ['0f2027', '2c5364', '8fb8d8'],
  ['1a0f2e', '6b2d5c', 'c96b7a'],
  ['0d2818', '2d6a4f', '95d5b2'],
  ['2b1055', '5b4b8a', '9d8bc4'],
  ['3a1c1c', '8c3d1e', 'e0913f'],
  ['101822', '33506b', '7d9bb5'],
  ['1b1b3a', '7b3b5e', 'd98fa8'],
  ['0d1b2a', '3d5a80', '98c1d9'],
];

function esc(text) {
  return String(text)
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '\u2019')
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,');
}

/** Перенос длинного названия по словам — иначе оно уедет за край кадра. */
function wrapTitle(title, maxChars) {
  const words = title.toUpperCase().split(' ');
  const lines = [];
  let cur = '';

  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (t.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);

  return lines.slice(0, 3);
}

export function renderPoster(opts, outPath) {
  const { seed, index, locale, title, genre, year, portrait } = opts;

  const W = portrait ? 400 : 854;
  const H = portrait ? 600 : 480;

  // Тот же аспект 'trailer', что у ролика: постер обязан быть кадром
  // из того же фильма, а не самостоятельной случайной картинкой.
  const s = new SeedStream(seed, 0, index, 'trailer', locale);
  const pal = s.pick(PALETTES);
  const kind = s.int(0, 2);

  const chain = [];

  // Слои рельефа: чем ближе, тем темнее.
  const layers = s.int(3, 4);
  for (let i = 0; i < layers; i++) {
    const top = Math.round(H * (0.58 + i * 0.09));
    const alpha = (0.28 + i * 0.2).toFixed(2);
    chain.push(`drawbox=x=0:y=${top}:w=${W}:h=${H - top}:color=0x060a10@${alpha}:t=fill`);
  }

  if (kind === 0) {
    let x = Math.round(W * 0.04);
    while (x < W * 0.94) {
      const bw = s.int(portrait ? 20 : 30, portrait ? 40 : 62);
      const bh = s.int(Math.round(H * 0.12), Math.round(H * 0.3));
      const top = Math.round(H * 0.82) - bh;
      chain.push(`drawbox=x=${x}:y=${top}:w=${bw}:h=${bh + 90}:color=0x04070c@0.95:t=fill`);
      for (let wy = top + 8; wy < H * 0.8 - 8; wy += 16) {
        for (let wx = x + 6; wx < x + bw - 7; wx += 14) {
          if (s.float() > 0.55) {
            chain.push(`drawbox=x=${wx}:y=${wy}:w=4:h=6:color=0xffd68c@0.6:t=fill`);
          }
        }
      }
      x += bw + s.int(6, 16);
    }
  } else if (kind === 1) {
    for (let i = 0; i < 14; i++) {
      const tx = s.int(10, W - 30);
      const th = s.int(Math.round(H * 0.12), Math.round(H * 0.24));
      const tw = s.int(14, 26);
      chain.push(
        `drawbox=x=${tx}:y=${Math.round(H * 0.84) - th}:w=${tw}:h=${th + 60}:color=0x04070c@0.95:t=fill`,
      );
    }
  } else {
    const fx = s.int(Math.round(W * 0.25), Math.round(W * 0.7));
    const fh = Math.round(H * 0.2);
    chain.push(`drawbox=x=${fx}:y=${Math.round(H * 0.8) - fh}:w=26:h=${fh + 70}:color=0x04070c@0.96:t=fill`);
    chain.push(`drawbox=x=${fx - 5}:y=${Math.round(H * 0.8) - fh - 22}:w=36:h=24:color=0x04070c@0.96:t=fill`);
  }

  // Затемнение под текст: белые титры должны читаться на любой палитре.
  chain.push(`drawbox=x=0:y=${Math.round(H * 0.45)}:w=${W}:h=${Math.round(H * 0.55)}:color=black@0.42:t=fill`);
  chain.push('vignette=PI/4');

  // Название — обязано совпадать со строкой таблицы.
  const maxChars = portrait ? 14 : 20;
  const lines = wrapTitle(title, maxChars);
  let fs = portrait ? 40 : 54;
  if (lines.some((l) => l.length > maxChars - 2)) fs -= 8;
  if (lines.length > 2) fs -= 6;

  const baseY = H - (portrait ? 110 : 96) - (lines.length - 1) * fs * 1.1;
  lines.forEach((line, i) => {
    chain.push(
      `drawtext=fontfile=${FONT}:text='${esc(line)}':fontcolor=white:fontsize=${fs}` +
        `:x=(w-text_w)/2:y=${Math.round(baseY + i * fs * 1.1)}` +
        `:shadowcolor=black@0.9:shadowx=2:shadowy=3`,
    );
  });

  chain.push(
    `drawtext=fontfile=${FONT}:text='${esc(`${year}   ${genre.toUpperCase()}`)}'` +
      `:fontcolor=white@0.85:fontsize=${portrait ? 18 : 22}` +
      `:x=(w-text_w)/2:y=${H - (portrait ? 56 : 48)}` +
      `:shadowcolor=black@0.9:shadowx=1:shadowy=2`,
  );

  const source =
    `gradients=size=${W}x${H}:duration=1:rate=1` +
    `:c0=0x${pal[0]}:c1=0x${pal[1]}:c2=0x${pal[2]}` +
    `:x0=${s.int(0, W)}:y0=0:x1=${s.int(0, W)}:y1=${H}:nb_colors=3:type=linear` +
    `:seed=${s.int(1, 2000000000)}:speed=0`;

  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', source,
    '-vf', chain.join(','),
    '-frames:v', '1',
    '-q:v', '4',
    '-y', outPath,
  ];

  // Каталог кэша мог исчезнуть после старта сервиса — создаём заново.
  return fsp.mkdir(path.dirname(outPath), { recursive: true }).then(() => new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => reject(new Error(`ffmpeg не запустился: ${e.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`ffmpeg код ${code}: ${stderr.slice(0, 400)}`));
    });
  }));
}
