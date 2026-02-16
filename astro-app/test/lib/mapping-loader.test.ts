import { describe, it, expect, beforeEach } from 'vitest';
import { findByName, clearCache, allMappingNames } from '../../src/lib/extractor/mapping-loader.js';

describe('MappingLoader', () => {
  beforeEach(() => {
    clearCache();
  });

  it('loads the idealista mapping', () => {
    const mapping = findByName('idealista');
    expect(mapping).not.toBeNull();
    expect(mapping!.name).toBe('idealista');
    expect(mapping!.textFields).toBeDefined();
    expect(mapping!.floatFields).toBeDefined();
    expect(mapping!.intFields).toBeDefined();
    expect(mapping!.booleanFields).toBeDefined();
    expect(mapping!.images).toBeDefined();
  });

  it('loads the rightmove mapping', () => {
    const mapping = findByName('rightmove');
    expect(mapping).not.toBeNull();
    expect(mapping!.name).toBe('rightmove');
    expect(mapping!.defaultValues).toBeDefined();
    expect(mapping!.defaultValues!['country']!.value).toBe('UK');
  });

  it('loads the zoopla mapping', () => {
    const mapping = findByName('zoopla');
    expect(mapping).not.toBeNull();
    expect(mapping!.name).toBe('zoopla');
  });

  it('returns null for unknown mapping', () => {
    const mapping = findByName('nonexistent');
    expect(mapping).toBeNull();
  });

  it('caches mappings', () => {
    const first = findByName('idealista');
    const second = findByName('idealista');
    expect(first).toBe(second); // same object reference
  });

  it('lists all known mapping names', () => {
    const names = allMappingNames();
    expect(names).toContain('idealista');
    expect(names).toContain('rightmove');
    expect(names).toContain('zoopla');
    expect(names).toContain('realtor');
    expect(names.length).toBeGreaterThanOrEqual(14);
  });
});
