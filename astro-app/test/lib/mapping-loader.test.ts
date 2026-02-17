import { describe, it, expect, beforeEach } from 'vitest';
import { findByName, clearCache, allMappingNames } from '../../src/lib/extractor/mapping-loader.js';

describe('MappingLoader', () => {
  beforeEach(() => {
    clearCache();
  });

  it('loads the idealista mapping', () => {
    const mapping = findByName('es_idealista');
    expect(mapping).not.toBeNull();
    expect(mapping!.name).toBe('es_idealista');
    expect(mapping!.textFields).toBeDefined();
    expect(mapping!.floatFields).toBeDefined();
    expect(mapping!.intFields).toBeDefined();
    expect(mapping!.booleanFields).toBeDefined();
    expect(mapping!.images).toBeDefined();
  });

  it('loads the rightmove mapping', () => {
    const mapping = findByName('uk_rightmove');
    expect(mapping).not.toBeNull();
    expect(mapping!.name).toBe('uk_rightmove');
    expect(mapping!.defaultValues).toBeDefined();
    expect(mapping!.defaultValues!['country']!.value).toBe('UK');
  });

  it('loads the zoopla mapping', () => {
    const mapping = findByName('uk_zoopla');
    expect(mapping).not.toBeNull();
    expect(mapping!.name).toBe('uk_zoopla');
  });

  it('returns null for unknown mapping', () => {
    const mapping = findByName('nonexistent');
    expect(mapping).toBeNull();
  });

  it('caches mappings', () => {
    const first = findByName('es_idealista');
    const second = findByName('es_idealista');
    expect(first).toBe(second); // same object reference
  });

  it('lists all known mapping names', () => {
    const names = allMappingNames();
    expect(names).toContain('es_idealista');
    expect(names).toContain('uk_rightmove');
    expect(names).toContain('uk_zoopla');
    expect(names).toContain('us_realtor');
    expect(names.length).toBeGreaterThanOrEqual(13);
  });
});
