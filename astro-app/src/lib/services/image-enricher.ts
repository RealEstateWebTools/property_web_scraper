import type { ImageInfo } from '../types/image-info.js';

const CONCURRENCY = 5;
const HEADER_BYTES = 32768;

/**
 * Enrich images with metadata (dimensions, file size, format).
 * Uses HEAD requests for size/format, partial GET for dimensions.
 */
export async function enrichImages(images: ImageInfo[]): Promise<ImageInfo[]> {
  const results: ImageInfo[] = new Array(images.length);

  // Process in batches of CONCURRENCY
  for (let i = 0; i < images.length; i += CONCURRENCY) {
    const batch = images.slice(i, i + CONCURRENCY);
    const enriched = await Promise.all(batch.map((img) => enrichSingleImage(img)));
    for (let j = 0; j < enriched.length; j++) {
      results[i + j] = enriched[j];
    }
  }

  return results;
}

async function enrichSingleImage(img: ImageInfo): Promise<ImageInfo> {
  try {
    const enriched: ImageInfo = { ...img };

    // HEAD request for content-length and content-type
    const headRes = await fetch(img.url, { method: 'HEAD' });
    if (!headRes.ok) return img;

    const contentLength = headRes.headers.get('content-length');
    if (contentLength) {
      enriched.sizeBytes = parseInt(contentLength, 10) || undefined;
    }

    const contentType = headRes.headers.get('content-type');
    if (contentType) {
      enriched.format = parseFormat(contentType);
    }

    // Partial GET for dimension parsing
    const dims = await fetchDimensions(img.url, enriched.format);
    if (dims) {
      enriched.width = dims.width;
      enriched.height = dims.height;
    }

    enriched.enriched = true;
    return enriched;
  } catch {
    return img;
  }
}

function parseFormat(contentType: string): string | undefined {
  const match = contentType.match(/image\/(\w+)/);
  if (!match) return undefined;
  const fmt = match[1].toLowerCase();
  if (fmt === 'jpeg') return 'jpg';
  return fmt;
}

async function fetchDimensions(
  url: string,
  format?: string
): Promise<{ width: number; height: number } | null> {
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
    });
    if (!res.ok && res.status !== 206) return null;

    const buffer = await res.arrayBuffer();
    const view = new DataView(buffer);

    if (format === 'png' || (!format && isPng(view))) {
      return parsePngDimensions(view);
    }
    if (format === 'jpg' || (!format && isJpeg(view))) {
      return parseJpegDimensions(view, buffer.byteLength);
    }
    if (format === 'webp' || (!format && isWebp(view))) {
      return parseWebpDimensions(view);
    }
    if (format === 'gif' || (!format && isGif(view))) {
      return parseGifDimensions(view);
    }

    return null;
  } catch {
    return null;
  }
}

function isPng(view: DataView): boolean {
  return view.byteLength >= 8 && view.getUint32(0) === 0x89504e47;
}

function isJpeg(view: DataView): boolean {
  return view.byteLength >= 2 && view.getUint8(0) === 0xff && view.getUint8(1) === 0xd8;
}

function isWebp(view: DataView): boolean {
  return (
    view.byteLength >= 12 &&
    view.getUint32(0) === 0x52494646 && // RIFF
    view.getUint32(8) === 0x57454250 // WEBP
  );
}

function isGif(view: DataView): boolean {
  return (
    view.byteLength >= 6 &&
    view.getUint8(0) === 0x47 && // G
    view.getUint8(1) === 0x49 && // I
    view.getUint8(2) === 0x46 // F
  );
}

/** PNG: width/height at IHDR chunk bytes 16-23 */
function parsePngDimensions(view: DataView): { width: number; height: number } | null {
  if (view.byteLength < 24) return null;
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

/** JPEG: scan SOF markers for dimensions */
function parseJpegDimensions(
  view: DataView,
  length: number
): { width: number; height: number } | null {
  let offset = 2;
  while (offset < length - 9) {
    if (view.getUint8(offset) !== 0xff) return null;
    const marker = view.getUint8(offset + 1);
    // SOF0-SOF3 markers
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    const segLen = view.getUint16(offset + 2);
    offset += 2 + segLen;
  }
  return null;
}

/** WebP: VP8 or VP8L dimensions */
function parseWebpDimensions(view: DataView): { width: number; height: number } | null {
  if (view.byteLength < 30) return null;
  // Check VP8 chunk type at offset 12
  const chunk = String.fromCharCode(
    view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15)
  );
  if (chunk === 'VP8 ' && view.byteLength >= 30) {
    // Lossy VP8: dimensions at offset 26-29 (little-endian 16-bit)
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (chunk === 'VP8L' && view.byteLength >= 25) {
    // Lossless VP8L: dimensions packed at offset 21
    const bits = view.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

/** GIF: Logical Screen Descriptor at offset 6 (little-endian) */
function parseGifDimensions(view: DataView): { width: number; height: number } | null {
  if (view.byteLength < 10) return null;
  return {
    width: view.getUint16(6, true),
    height: view.getUint16(8, true),
  };
}
