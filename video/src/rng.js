
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function crc32(str) {
  const bytes = Buffer.from(str, 'utf8');
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export class SeedStream {
  constructor(userSeed, page, index, aspect, locale = '') {
    const key = `${userSeed}|${page}|${index}|${aspect}|${locale}`;
    this.state = crc32(key) & 0x7fffffff;

    if (this.state === 0) this.state = 0x2545f491;
  }

  next() {
    let x = this.state;
    x ^= (x << 13) & 0x7fffffff;
    x ^= x >> 17;
    x ^= (x << 5) & 0x7fffffff;
    this.state = x & 0x7fffffff;
    return this.state;
  }

  float() {
    return this.next() / 2147483648.0;
  }

  int(min, max) {
    if (min >= max) return min;
    return min + (this.next() % (max - min + 1));
  }

  pick(items) {
    if (!items.length) throw new Error('Пустой массив для выбора');
    return items[this.next() % items.length];
  }

  pickMany(items, count) {
    const pool = [...items];
    const out = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i++) {
      out.push(pool.splice(this.next() % pool.length, 1)[0]);
    }
    return out;
  }

  fractionalCount(average) {
    const whole = Math.floor(average);
    return this.float() < average - whole ? whole + 1 : whole;
  }
}
