import { describe, it, expect } from 'vitest';
import { primaryLanguage } from '../../src/lib/utils/locale.js';

describe('primaryLanguage', () => {
  it('returns simple code unchanged',  () => expect(primaryLanguage('en')).toBe('en'));
  it('strips region subtag',           () => expect(primaryLanguage('de-DE')).toBe('de'));
  it('handles three-part tags',        () => expect(primaryLanguage('zh-Hant-TW')).toBe('zh'));
  it('lowercases the result',          () => expect(primaryLanguage('EN-AU')).toBe('en'));
});
