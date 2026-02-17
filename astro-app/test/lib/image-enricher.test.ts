import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enrichImages } from '../../src/lib/services/image-enricher.js';
import type { ImageInfo } from '../../src/lib/types/image-info.js';

// Build a minimal PNG buffer (8-byte signature + 13-byte IHDR)
function makePngBuffer(width: number, height: number): ArrayBuffer {
  const buf = new ArrayBuffer(24);
  const view = new DataView(buf);
  // PNG signature
  view.setUint32(0, 0x89504e47);
  view.setUint32(4, 0x0d0a1a0a);
  // IHDR chunk length
  view.setUint32(8, 13);
  // IHDR type
  view.setUint32(12, 0x49484452);
  // Width & height
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buf;
}

// Build a minimal JPEG buffer with SOF0 marker
// Needs enough padding so parser's `offset < length - 9` check passes
function makeJpegBuffer(width: number, height: number): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  const view = new DataView(buf);
  view.setUint8(0, 0xff); // SOI
  view.setUint8(1, 0xd8);
  view.setUint8(2, 0xff); // SOF0 marker
  view.setUint8(3, 0xc0);
  view.setUint16(4, 17); // segment length (includes precision, height, width, etc.)
  view.setUint8(6, 8); // precision
  view.setUint16(7, height);
  view.setUint16(9, width);
  return buf;
}

describe('enrichImages', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('enriches PNG images with dimensions and metadata', async () => {
    const pngBuf = makePngBuffer(800, 600);

    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      if (opts?.method === 'HEAD') {
        return Promise.resolve({
          ok: true,
          headers: new Headers({
            'content-length': '12345',
            'content-type': 'image/png',
          }),
        });
      }
      // Range request
      return Promise.resolve({
        ok: true,
        status: 206,
        arrayBuffer: () => Promise.resolve(pngBuf),
      });
    });

    const images: ImageInfo[] = [{ url: 'https://example.com/photo.png' }];
    const result = await enrichImages(images);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/photo.png');
    expect(result[0].width).toBe(800);
    expect(result[0].height).toBe(600);
    expect(result[0].sizeBytes).toBe(12345);
    expect(result[0].format).toBe('png');
    expect(result[0].enriched).toBe(true);
  });

  it('enriches JPEG images with dimensions', async () => {
    const jpegBuf = makeJpegBuffer(1024, 768);

    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      if (opts?.method === 'HEAD') {
        return Promise.resolve({
          ok: true,
          headers: new Headers({
            'content-length': '54321',
            'content-type': 'image/jpeg',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 206,
        arrayBuffer: () => Promise.resolve(jpegBuf),
      });
    });

    const images: ImageInfo[] = [{ url: 'https://example.com/photo.jpg' }];
    const result = await enrichImages(images);

    expect(result).toHaveLength(1);
    expect(result[0].width).toBe(1024);
    expect(result[0].height).toBe(768);
    expect(result[0].format).toBe('jpg');
    expect(result[0].enriched).toBe(true);
  });

  it('handles network errors gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const images: ImageInfo[] = [{ url: 'https://example.com/broken.jpg' }];
    const result = await enrichImages(images);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/broken.jpg');
    expect(result[0].enriched).toBeUndefined();
  });

  it('passes through unenriched images unchanged', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      if (opts?.method === 'HEAD') {
        return Promise.resolve({ ok: false, status: 404, headers: new Headers() });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const images: ImageInfo[] = [{ url: 'https://example.com/missing.jpg' }];
    const result = await enrichImages(images);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ url: 'https://example.com/missing.jpg' });
    expect(result[0].enriched).toBeUndefined();
  });

  it('processes multiple images with concurrency', async () => {
    const pngBuf = makePngBuffer(100, 200);
    let fetchCount = 0;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      fetchCount++;
      if (opts?.method === 'HEAD') {
        return Promise.resolve({
          ok: true,
          headers: new Headers({
            'content-length': '1000',
            'content-type': 'image/png',
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 206,
        arrayBuffer: () => Promise.resolve(pngBuf),
      });
    });

    const images: ImageInfo[] = Array.from({ length: 8 }, (_, i) => ({
      url: `https://example.com/img${i}.png`,
    }));

    const result = await enrichImages(images);

    expect(result).toHaveLength(8);
    result.forEach((img) => {
      expect(img.enriched).toBe(true);
      expect(img.width).toBe(100);
      expect(img.height).toBe(200);
    });
    // 2 fetches per image (HEAD + Range GET)
    expect(fetchCount).toBe(16);
  });
});
