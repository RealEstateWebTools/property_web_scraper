import { describe, it, expect } from 'vitest';
import {
  applyModifiers,
  parseModifierString,
  MODIFIER_REGISTRY,
} from '../../src/lib/extractor/modifiers.js';

describe('modifiers', () => {
  describe('individual modifiers', () => {
    it('trim removes leading and trailing whitespace', () => {
      expect(MODIFIER_REGISTRY.trim('  hello  ')).toBe('hello');
      expect(MODIFIER_REGISTRY.trim('\thello\n')).toBe('hello');
    });

    it('int parses integer from string', () => {
      expect(MODIFIER_REGISTRY.int('42')).toBe('42');
      expect(MODIFIER_REGISTRY.int('3.7')).toBe('3');
      expect(MODIFIER_REGISTRY.int('abc')).toBe('0');
      expect(MODIFIER_REGISTRY.int('  99 rooms')).toBe('99');
    });

    it('float parses float from string', () => {
      expect(MODIFIER_REGISTRY.float('3.14')).toBe('3.14');
      expect(MODIFIER_REGISTRY.float('42')).toBe('42');
      expect(MODIFIER_REGISTRY.float('abc')).toBe('0');
      expect(MODIFIER_REGISTRY.float('  12.5 m2')).toBe('12.5');
    });

    it('removeNewline replaces newlines with spaces', () => {
      expect(MODIFIER_REGISTRY.removeNewline('hello\nworld')).toBe('hello world');
      expect(MODIFIER_REGISTRY.removeNewline('a\r\nb')).toBe('a b');
      expect(MODIFIER_REGISTRY.removeNewline('a\n\n\nb')).toBe('a b');
    });

    it('stripPunct removes periods and commas', () => {
      expect(MODIFIER_REGISTRY.stripPunct('1,234.56')).toBe('123456');
      expect(MODIFIER_REGISTRY.stripPunct('hello, world.')).toBe('hello world');
    });

    it('stripFirstChar removes the first character', () => {
      expect(MODIFIER_REGISTRY.stripFirstChar('$100')).toBe('100');
      expect(MODIFIER_REGISTRY.stripFirstChar('abc')).toBe('bc');
    });

    it('lowercase converts to lower case', () => {
      expect(MODIFIER_REGISTRY.lowercase('Hello World')).toBe('hello world');
      expect(MODIFIER_REGISTRY.lowercase('ABC')).toBe('abc');
    });

    it('uppercase converts to upper case', () => {
      expect(MODIFIER_REGISTRY.uppercase('Hello World')).toBe('HELLO WORLD');
      expect(MODIFIER_REGISTRY.uppercase('abc')).toBe('ABC');
    });

    it('collapseWhitespace collapses multiple spaces and trims', () => {
      expect(MODIFIER_REGISTRY.collapseWhitespace('  hello   world  ')).toBe('hello world');
      expect(MODIFIER_REGISTRY.collapseWhitespace('a\t\t b')).toBe('a b');
    });

    it('stripHtmlEntities removes HTML entities', () => {
      expect(MODIFIER_REGISTRY.stripHtmlEntities('price &euro; 100')).toBe('price  100');
      expect(MODIFIER_REGISTRY.stripHtmlEntities('a &amp; b &lt; c')).toBe('a  b  c');
    });

    it('stripCurrency removes currency symbols', () => {
      expect(MODIFIER_REGISTRY.stripCurrency('$100')).toBe('100');
      expect(MODIFIER_REGISTRY.stripCurrency('£250')).toBe('250');
      expect(MODIFIER_REGISTRY.stripCurrency('€300')).toBe('300');
      expect(MODIFIER_REGISTRY.stripCurrency('¥5000')).toBe('5000');
      expect(MODIFIER_REGISTRY.stripCurrency('₹750')).toBe('750');
    });

    it('digitsOnly keeps only digits', () => {
      expect(MODIFIER_REGISTRY.digitsOnly('$1,234.56')).toBe('123456');
      expect(MODIFIER_REGISTRY.digitsOnly('abc123def')).toBe('123');
      expect(MODIFIER_REGISTRY.digitsOnly('no digits')).toBe('');
    });
  });

  describe('applyModifiers', () => {
    it('applies a chain of modifiers in order', () => {
      const result = applyModifiers('  \n 42 rooms \n ', ['removeNewline', 'trim', 'int']);
      expect(result).toBe('42');
    });

    it('returns original text when modifier list is empty', () => {
      expect(applyModifiers('hello', [])).toBe('hello');
    });

    it('skips unknown modifiers without throwing', () => {
      const result = applyModifiers('  hello  ', ['trim', 'nonExistentModifier', 'uppercase']);
      expect(result).toBe('HELLO');
    });

    it('chains stripCurrency, stripPunct, trim, and int', () => {
      const result = applyModifiers('  $1,234.00  ', ['stripCurrency', 'stripPunct', 'trim', 'int']);
      expect(result).toBe('123400');
    });
  });

  describe('parseModifierString', () => {
    it('parses pipe-delimited string into array', () => {
      expect(parseModifierString('removeNewline | trim | int')).toEqual([
        'removeNewline',
        'trim',
        'int',
      ]);
    });

    it('handles no spaces around pipes', () => {
      expect(parseModifierString('trim|uppercase')).toEqual(['trim', 'uppercase']);
    });

    it('filters out empty segments', () => {
      expect(parseModifierString('trim | | uppercase')).toEqual(['trim', 'uppercase']);
    });

    it('handles single modifier', () => {
      expect(parseModifierString('trim')).toEqual(['trim']);
    });

    it('handles leading and trailing pipes', () => {
      expect(parseModifierString('| trim | int |')).toEqual(['trim', 'int']);
    });
  });
});
