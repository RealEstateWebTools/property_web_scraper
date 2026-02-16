import { describe, it, expect } from 'vitest';
import { parseFlightData, searchFlightData } from '../../src/lib/extractor/flight-data-parser.js';

describe('flight-data-parser', () => {
  describe('parseFlightData', () => {
    it('parses simple flight data chunks', () => {
      const html = `
        <script>self.__next_f.push([1, "1:{\\"name\\":\\"test\\",\\"value\\":42}\\n"])</script>
      `;
      const result = parseFlightData(html);
      expect(result['1']).toEqual({ name: 'test', value: 42 });
    });

    it('handles multiple script tags', () => {
      const html = `
        <script>self.__next_f.push([1, "1:{\\"beds\\":3}\\n"])</script>
        <script>self.__next_f.push([1, "2:{\\"price\\":500000}\\n"])</script>
      `;
      const result = parseFlightData(html);
      expect(result['1']).toEqual({ beds: 3 });
      expect(result['2']).toEqual({ price: 500000 });
    });

    it('handles escaped content with newlines', () => {
      const html = `
        <script>self.__next_f.push([1, "5:{\\"desc\\":\\"Line1\\\\nLine2\\"}\\n"])</script>
      `;
      const result = parseFlightData(html);
      const chunk = result['5'] as Record<string, unknown>;
      expect(chunk.desc).toBe('Line1\nLine2');
    });

    it('resolves $N back-references', () => {
      const html = `
        <script>self.__next_f.push([1, "10:{\\"city\\":\\"London\\"}\\n11:{\\"location\\":\\"$10\\"}\\n"])</script>
      `;
      const result = parseFlightData(html);
      expect(result['11']).toEqual({ location: { city: 'London' } });
    });

    it('resolves nested back-references', () => {
      const html = `
        <script>self.__next_f.push([1, "20:{\\"lat\\":51.5}\\n21:{\\"coords\\":\\"$20\\"}\\n22:{\\"property\\":\\"$21\\"}\\n"])</script>
      `;
      const result = parseFlightData(html);
      const chunk22 = result['22'] as Record<string, unknown>;
      const prop = chunk22.property as Record<string, unknown>;
      const coords = prop.coords as Record<string, unknown>;
      expect(coords.lat).toBe(51.5);
    });

    it('returns empty object when no flight data found', () => {
      const html = '<html><body><script>var x = 1;</script></body></html>';
      const result = parseFlightData(html);
      expect(result).toEqual({});
    });

    it('handles malformed chunks gracefully', () => {
      const html = `
        <script>self.__next_f.push([1, "1:{not valid json}\\n2:{\\"valid\\":true}\\n"])</script>
      `;
      const result = parseFlightData(html);
      expect(result['1']).toBeUndefined();
      expect(result['2']).toEqual({ valid: true });
    });

    it('handles chunks split across multiple push calls', () => {
      const html = `
        <script>self.__next_f.push([1, "3:{\\"a\\":1}\\n"])</script>
        <script>self.__next_f.push([1, "4:{\\"b\\":2}\\n"])</script>
        <script>self.__next_f.push([1, "5:{\\"c\\":3}\\n"])</script>
      `;
      const result = parseFlightData(html);
      expect(Object.keys(result)).toHaveLength(3);
      expect(result['3']).toEqual({ a: 1 });
      expect(result['4']).toEqual({ b: 2 });
      expect(result['5']).toEqual({ c: 3 });
    });
  });

  describe('searchFlightData', () => {
    it('finds a simple key in any chunk', () => {
      const data: Record<string, unknown> = {
        '1': { beds: 3 },
        '2': { price: 500000 },
      };
      expect(searchFlightData(data, 'price')).toBe(500000);
    });

    it('finds a nested path', () => {
      const data: Record<string, unknown> = {
        '1': { location: { latitude: 51.5, longitude: -0.1 } },
      };
      expect(searchFlightData(data, 'location.latitude')).toBe(51.5);
    });

    it('returns first match when multiple chunks have the same key', () => {
      const data: Record<string, unknown> = {
        '1': { name: 'first' },
        '2': { name: 'second' },
      };
      const result = searchFlightData(data, 'name');
      expect(result).toBe('first');
    });

    it('returns undefined when path not found', () => {
      const data: Record<string, unknown> = {
        '1': { beds: 3 },
      };
      expect(searchFlightData(data, 'nonexistent')).toBeUndefined();
      expect(searchFlightData(data, 'beds.deep.path')).toBeUndefined();
    });

    it('handles empty flight data', () => {
      expect(searchFlightData({}, 'anything')).toBeUndefined();
    });

    it('finds deeply nested values', () => {
      const data: Record<string, unknown> = {
        '1': { a: { b: { c: { d: 'deep' } } } },
      };
      expect(searchFlightData(data, 'a.b.c.d')).toBe('deep');
    });
  });
});
