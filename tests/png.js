/**
 * Minimal PNG reader for screenshot assertions.
 *
 * Bounding boxes alone cannot prove the *content* fills the box — a letterboxed
 * frame inside a full-size element has a perfect bounding box. These helpers
 * read the actual rendered pixels instead.
 *
 * Handles what Playwright emits: 8-bit truecolour with alpha, non-interlaced.
 */
import { inflateSync } from 'node:zlib';

export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');

  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colourType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colourType = data[9];
      if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
      if (data[12] !== 0) throw new Error('interlaced PNG is not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported colour type ${colourType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prior = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prior ? prior[x] : 0;
      const c = prior && x >= channels ? prior[x - channels] : 0;
      let value = line[x];
      switch (filter) {
        case 0: break;
        case 1: value += a; break;
        case 2: value += b; break;
        case 3: value += Math.floor((a + b) / 2); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`unknown filter ${filter}`);
      }
      out[x] = value & 0xff;
    }
  }

  return { width, height, channels, pixels };
}

export function pixelAt(image, x, y) {
  const i = (y * image.width + x) * image.channels;
  return {
    r: image.pixels[i],
    g: image.pixels[i + 1],
    b: image.pixels[i + 2],
    a: image.channels === 4 ? image.pixels[i + 3] : 255
  };
}

export function luminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Extent of bright pixels along a horizontal line, as [first, last]. */
export function brightSpanX(image, y, threshold = 180, from = 0, to = image.width - 1) {
  let first = -1;
  let last = -1;
  for (let x = from; x <= to; x += 1) {
    if (luminance(pixelAt(image, x, y)) >= threshold) {
      if (first === -1) first = x;
      last = x;
    }
  }
  return [first, last];
}

/** Extent of bright pixels along a vertical line, as [first, last]. */
export function brightSpanY(image, x, threshold = 180, from = 0, to = image.height - 1) {
  let first = -1;
  let last = -1;
  for (let y = from; y <= to; y += 1) {
    if (luminance(pixelAt(image, x, y)) >= threshold) {
      if (first === -1) first = y;
      last = y;
    }
  }
  return [first, last];
}

/** True when every pixel on a line is (near) pure black — i.e. a black bar. */
export function isBlackRow(image, y, tolerance = 12) {
  for (let x = 0; x < image.width; x += 1) {
    if (luminance(pixelAt(image, x, y)) > tolerance) return false;
  }
  return true;
}

export function isBlackColumn(image, x, tolerance = 12) {
  for (let y = 0; y < image.height; y += 1) {
    if (luminance(pixelAt(image, x, y)) > tolerance) return false;
  }
  return true;
}
