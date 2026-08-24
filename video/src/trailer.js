
import { spawn } from 'child_process';
import { SeedStream } from './rng.js';
import { promises as fs } from 'fs';
import path from 'path';

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

const GRADES = [
  'curves=preset=increase_contrast,colorbalance=rs=-0.06:bs=0.10',
  'eq=contrast=1.18:saturation=0.82,colorbalance=rs=0.08:bs=-0.05',
  'curves=preset=lighter,eq=saturation=1.15',
  'eq=contrast=1.25:brightness=-0.04:saturation=0.7',
  'colorbalance=rs=0.10:gs=-0.03:bs=-0.08,eq=contrast=1.1',
  'curves=preset=darker,eq=saturation=1.05:contrast=1.2',
  'eq=gamma=0.92:saturation=0.9,colorbalance=bs=0.12',
  'curves=preset=medium_contrast,eq=saturation=1.25',
];

const TRANSITIONS = [
  'fade', 'fadeblack', 'fadewhite', 'wipeleft', 'wiperight', 'wipeup', 'wipedown',
  'slideleft', 'slideright', 'slideup', 'slidedown', 'circlecrop', 'circleopen',
  'circleclose', 'radial', 'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
  'dissolve', 'pixelize', 'diagbl', 'diagbr', 'diagtl', 'diagtr', 'hlslice',
  'vuslice', 'revealleft', 'revealright', 'squeezeh', 'squeezev', 'zoomin',
];

const MUSIC_KEYS = [261.63, 293.66, 311.13, 349.23, 392.0, 415.3, 440.0, 466.16];

const MUSIC_SCALES = [
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 4, 7, 9],
  [0, 2, 4, 6, 7, 9, 11],
  [0, 2, 4, 5, 7, 9, 10],
];

const MUSIC_MOTIFS = [
  [0, 2, 4, 7, 4, 2, 1, 2],
  [0, 4, 2, 5, 4, 2, 0, 4],
  [7, 4, 2, 0, 2, 4, 7, 9],
  [0, 1, 2, 4, 5, 4, 2, 1],
  [4, 4, 2, 0, 4, 7, 5, 4],
  [0, 2, 4, 5, 7, 5, 4, 2],
  [2, 4, 7, 9, 7, 4, 2, 0],
  [0, 4, 7, 4, 9, 7, 4, 2],
];

const MUSIC_BASSES = [
  [0, 0, 4, 2],
  [0, 5, 3, 4],
  [0, 4, 5, 4],
  [0, 3, 4, 0],
];

function noteSequence(freqs, step, hold, decay, timbre) {
  const bar = (step * freqs.length).toFixed(4);

  return freqs
    .map((f, i) => {
      const start = (step * i).toFixed(4);
      const end = (step * (i + hold)).toFixed(4);
      const env = `exp(-${decay}*(mod(t,${bar})-${start}))`;
      const gate = `between(mod(t,${bar}),${start},${end})`;

      return `${env}*${gate}*${timbre(f.toFixed(3))}`;
    })
    .join('+');
}

const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const W = 854;
const H = 480;
const FPS = 25;

function esc(text) {
  return String(text)
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\u2019")
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,');
}

/**
 * Сцена одного кадра: рисуется фильтрами ffmpeg, без шума и клякс.
 * Небо градиентом, светило, слои рельефа, силуэты города или леса.
 */
function buildScene(s, seconds) {
  const pal = s.pick(PALETTES);
  const kind = s.int(0, 2);

  // Небо: вертикальный градиент из трёх цветов палитры.
  let filters = [
    `gradients=size=${W}x${H}:duration=${seconds}:rate=${FPS}` +
      `:c0=0x${pal[0]}:c1=0x${pal[1]}:c2=0x${pal[2]}` +
      `:x0=${s.int(0, W)}:y0=0:x1=${s.int(0, W)}:y1=${H}:nb_colors=3:type=linear` +
      // seed фиксируем: по умолчанию -1, то есть случайный при каждом запуске.
      // speed=0 убирает вращение градиента во времени.
      `:seed=${s.int(1, 2000000000)}:speed=0`,
  ];

  const chain = [];

  // Светило с мягким ореолом — не «пятно», а источник света в кадре.
  const sunX = s.int(Math.round(W * 0.2), Math.round(W * 0.8));
  const sunY = s.int(Math.round(H * 0.18), Math.round(H * 0.4));
  const sunR = s.int(18, 34);
  chain.push(
    `drawtext=fontfile=${FONT}:text='':x=0:y=0`,
  );

  // Слои рельефа: тёмные полосы разной высоты, дальние светлее ближних.
  const layers = s.int(3, 4);
  for (let i = 0; i < layers; i++) {
    const top = Math.round(H * (0.58 + i * 0.09));
    const alpha = (0.28 + i * 0.2).toFixed(2);
    chain.push(
      `drawbox=x=0:y=${top}:w=${W}:h=${H - top}:color=0x060a10@${alpha}:t=fill`,
    );
  }

  // Силуэты переднего плана.
  if (kind === 0) {
    // Городской контур: здания разной высоты со светящимися окнами.
    let x = Math.round(W * 0.04);
    while (x < W * 0.94) {
      const bw = s.int(30, 62);
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
    // Лес: треугольные кроны приближаем узкими блоками.
    for (let i = 0; i < 14; i++) {
      const tx = s.int(10, W - 30);
      const th = s.int(Math.round(H * 0.12), Math.round(H * 0.24));
      const tw = s.int(14, 26);
      chain.push(
        `drawbox=x=${tx}:y=${Math.round(H * 0.84) - th}:w=${tw}:h=${th + 60}:color=0x04070c@0.95:t=fill`,
      );
    }
  } else {
    // Одинокая фигура на переднем плане.
    const fx = s.int(Math.round(W * 0.25), Math.round(W * 0.7));
    const fh = Math.round(H * 0.2);
    chain.push(`drawbox=x=${fx}:y=${Math.round(H * 0.8) - fh}:w=26:h=${fh + 70}:color=0x04070c@0.96:t=fill`);
    chain.push(`drawbox=x=${fx - 5}:y=${Math.round(H * 0.8) - fh - 22}:w=36:h=24:color=0x04070c@0.96:t=fill`);
  }

  // Затемнение нижней части: белые титры обязаны читаться
  // на любой палитре, включая светлое небо.
  chain.push(`drawbox=x=0:y=${Math.round(H * 0.5)}:w=${W}:h=${Math.round(H * 0.5)}:color=black@0.28:t=fill`);

  // Виньетка и лёгкое размытие дальнего плана — киношная глубина.
  chain.push('vignette=PI/4');
  chain.push(`gblur=sigma=${(s.float() * 0.5 + 0.2).toFixed(2)}`);

  return { source: filters[0], chain: chain.filter(Boolean) };
}

/** Титр с плавным появлением и уходом. */
function titleFilter(text, fontsize, yExpr, from, to, s) {
  const fadeIn = 0.35;
  const fadeOut = 0.3;
  const alpha =
    `if(lt(t,${from}),0,` +
    `if(lt(t,${from + fadeIn}),(t-${from})/${fadeIn},` +
    `if(lt(t,${to - fadeOut}),1,` +
    `if(lt(t,${to}),(${to}-t)/${fadeOut},0))))`;

  return (
    `drawtext=fontfile=${FONT}:text='${esc(text)}'` +
    `:fontcolor=white:fontsize=${fontsize}` +
    `:x=(w-text_w)/2:y=${yExpr}` +
    `:alpha='${alpha}'` +
    `:shadowcolor=black@0.85:shadowx=2:shadowy=3` +
    `:enable='between(t,${from},${to})'`
  );
}

/**
 * Собрать трейлер.
 *
 * @param {object} opts
 * @param {string} opts.seed     seed пользователя
 * @param {number} opts.index    сквозной номер фильма
 * @param {string} opts.locale   код локали
 * @param {string} opts.title    название фильма — обязано совпадать с таблицей
 * @param {string} opts.genre    жанр
 * @param {number} opts.year     год
 * @param {string} opts.tagline  надпись вроде «THIS FALL»
 * @param {string} opts.actor    имя актёра для титра
 * @param {string} outPath       куда сохранить mp4
 */
export function renderTrailer(opts, outPath) {
  const { seed, index, locale, title, genre, year, tagline, actor } = opts;

  const s = new SeedStream(seed, 0, index, 'trailer', locale);

  const shots = 3;
  const shotLen = [2.6, 2.4, 2.8];
  const trans = [s.pick(TRANSITIONS), s.pick(TRANSITIONS)];
  const transDur = 0.7;

  const args = [];
  const parts = [];

  // Три сцены: каждая со своей палитрой, коррекцией и зумом.
  for (let i = 0; i < shots; i++) {
    const scene = buildScene(s, shotLen[i]);
    args.push('-f', 'lavfi', '-i', scene.source);

    const grade = s.pick(GRADES);
    const zoomIn = s.float() > 0.5;
    const zoomSpeed = (0.0008 + s.float() * 0.0014).toFixed(5);
    const frames = Math.round(shotLen[i] * FPS);
    const zoom = zoomIn
      ? `zoompan=z='min(zoom+${zoomSpeed},1.14)':d=${frames}:s=${W}x${H}:fps=${FPS}`
      : `zoompan=z='if(lte(zoom,1.0),1.14,max(1.001,zoom-${zoomSpeed}))':d=${frames}:s=${W}x${H}:fps=${FPS}`;

    parts.push(
      `[${i}:v]${scene.chain.join(',')},${grade},${zoom},` +
        `scale=${W}:${H},setsar=1,format=yuv420p[v${i}]`,
    );
  }

  // Переходы между сценами.
  const o1 = (shotLen[0] - transDur).toFixed(2);
  const o2 = (shotLen[0] + shotLen[1] - transDur * 2).toFixed(2);
  parts.push(`[v0][v1]xfade=transition=${trans[0]}:duration=${transDur}:offset=${o1}[x1]`);
  parts.push(`[x1][v2]xfade=transition=${trans[1]}:duration=${transDur}:offset=${o2}[x2]`);

  const total = shotLen.reduce((a, b) => a + b, 0) - transDur * 2;

  // Титры поверх смонтированного видео.
  const titles = [
    titleFilter(tagline, 34, 'h*0.28', 0.4, 2.0, s),
    titleFilter(actor, 30, 'h*0.30', 2.6, 4.2, s),
    titleFilter(title.toUpperCase(), title.length > 22 ? 42 : 56, 'h*0.40', 4.6, total - 0.2, s),
    titleFilter(`${year}   ${genre.toUpperCase()}`, 24, 'h*0.53', 5.4, total - 0.2, s),
  ];
  parts.push(`[x2]${titles.join(',')}[vout]`);

  // ── МУЗЫКА ──────────────────────────────────────────────────────
  //
  // Раньше здесь были три протяжные синусоиды в низком регистре: без
  // ритма и без лада это звучало как заунывный гул. Теперь собирается
  // короткая бодрая тема: мелодия щипковыми нотами поверх шагающего
  // баса и подчёркивающего долю «хлопка».
  //
  // Каждая нота задаётся выражением aevalsrc: экспоненциальная
  // огибающая exp(-k*dt) даёт атаку и затухание, то есть отчётливый
  // щипок вместо непрерывного тона. Из-за этого появляется ритм.

  const key = MUSIC_KEYS[s.int(0, MUSIC_KEYS.length - 1)];
  const scale = MUSIC_SCALES[s.int(0, MUSIC_SCALES.length - 1)];
  const motif = MUSIC_MOTIFS[s.int(0, MUSIC_MOTIFS.length - 1)];
  const bassLine = MUSIC_BASSES[s.int(0, MUSIC_BASSES.length - 1)];

  // Темп: 100–132 удара в минуту. Ниже брать нельзя — снова получится вяло.
  const bpm = 100 + s.int(0, 8) * 4;
  const beat = 60 / bpm;
  const eighth = beat / 2;

  // Полутон вверх по равномерному строю: частота умножается на 2^(n/12).
  const hz = (semitones) => key * Math.pow(2, semitones / 12);

  // Мелодия идёт восьмыми, бас — четвертями.
  const melodyExpr = noteSequence(
    motif.map((step) => hz(scale[step % scale.length] + 12 * Math.floor(step / scale.length))),
    eighth,
    0.85,
    14,
    (f) => `(0.55*sin(2*PI*${f}*t)+0.18*sin(2*PI*${(f * 2).toFixed(3)}*t))`,
  );

  const bassExpr = noteSequence(
    bassLine.map((step) => hz(scale[step % scale.length] - 24)),
    beat,
    0.5,
    7,
    (f) => `0.75*sin(2*PI*${f}*t)`,
  );

  // Хлопок на 2-ю и 4-ю долю: фильтрованный импульс, держит темп.
  const clapPeriod = (beat * 4).toFixed(4);
  const clapExpr = [1, 3]
    .map((b) => {
      const at = (beat * b).toFixed(4);
      return `exp(-42*(mod(t,${clapPeriod})-${at}))` +
        `*between(mod(t,${clapPeriod}),${at},${(beat * b + 0.09).toFixed(4)})` +
        `*0.5*sin(2*PI*1750*t)`;
    })
    .join('+');

  args.push('-f', 'lavfi', '-i', `aevalsrc='${melodyExpr}':d=${total.toFixed(2)}:s=44100`);
  args.push('-f', 'lavfi', '-i', `aevalsrc='${bassExpr}':d=${total.toFixed(2)}:s=44100`);
  args.push('-f', 'lavfi', '-i', `aevalsrc='${clapExpr}':d=${total.toFixed(2)}:s=44100`);

  parts.push(
    `[${shots}:a]volume=1.0[mel]`,
    `[${shots + 1}:a]volume=0.95[bs]`,
    `[${shots + 2}:a]volume=0.5,highpass=f=1200[clap]`,
    // normalize=0 обязателен: иначе amix делит громкость на число входов
    // и вся тема проваливается по уровню.
    `[mel][bs][clap]amix=inputs=3:duration=first:normalize=0,` +
      `aecho=0.7:0.5:45:0.15,alimiter=limit=0.92,` +
      `loudnorm=I=-16:TP=-1.5:LRA=11,` +
      `afade=t=in:d=0.1,afade=t=out:st=${(total - 0.7).toFixed(2)}:d=0.7[aout]`,
  );

  args.push(
    '-filter_complex', parts.join(';'),
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '26',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-t', total.toFixed(2),
    '-y', outPath,
  );

  // ffmpeg не создаёт каталоги сам: если кэш очистили на работающем
  // сервисе, запись упала бы с Input/output error.
  return fs.mkdir(path.dirname(outPath), { recursive: true }).then(() => new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args]);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => reject(new Error(`ffmpeg не запустился: ${e.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`ffmpeg код ${code}: ${stderr.slice(0, 500)}`));
    });
  }));
}

/** Путь в кэше: один и тот же фильм рендерится однократно. */
export function cachePath(cacheDir, seed, index, locale) {
  const key = `${seed}_${index}_${locale}`.replace(/[^\w.-]/g, '_');
  return path.join(cacheDir, `${key}.mp4`);
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
