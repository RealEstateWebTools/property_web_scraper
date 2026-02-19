import { describe, it, expect } from 'vitest';
import {
  getFieldName,
  getMappingsForStandard,
  getInternalFieldName,
} from '../../src/lib/exporters/field-mappings.js';

describe('FieldMappings', () => {
  describe('getFieldName', () => {
    it('returns RESO name for known field', () => {
      expect(getFieldName('reference', 'reso')).toBe('ListingKey');
      expect(getFieldName('price_float', 'reso')).toBe('ListPrice');
      expect(getFieldName('count_bedrooms', 'reso')).toBe('BedroomsTotal');
    });

    it('returns BLM name for known field', () => {
      expect(getFieldName('reference', 'blm')).toBe('AGENT_REF');
      expect(getFieldName('price_float', 'blm')).toBe('PRICE');
      expect(getFieldName('count_bedrooms', 'blm')).toBe('BEDROOMS');
    });

    it('returns Kyero name for known field', () => {
      expect(getFieldName('reference', 'kyero')).toBe('ref');
      expect(getFieldName('price_float', 'kyero')).toBe('price');
      expect(getFieldName('count_bedrooms', 'kyero')).toBe('beds');
    });

    it('returns Schema.org name for known field', () => {
      expect(getFieldName('title', 'schema_org')).toBe('name');
      expect(getFieldName('price_float', 'schema_org')).toBe('offers.price');
    });

    it('returns undefined for unmapped field', () => {
      expect(getFieldName('nonexistent_field', 'reso')).toBeUndefined();
    });

    it('returns undefined when field has no mapping for standard', () => {
      expect(getFieldName('tenure', 'kyero')).toBeUndefined();
    });

    it('maps new interoperability fields', () => {
      expect(getFieldName('property_type', 'reso')).toBe('PropertyType');
      expect(getFieldName('property_type', 'blm')).toBe('PROP_SUB_ID');
      expect(getFieldName('property_type', 'kyero')).toBe('type');
      expect(getFieldName('tenure', 'reso')).toBe('Tenure');
      expect(getFieldName('tenure', 'blm')).toBe('TENURE_TYPE_ID');
      expect(getFieldName('agent_name', 'reso')).toBe('ListAgentFullName');
      expect(getFieldName('agent_name', 'blm')).toBe('AGENT_NAME');
      expect(getFieldName('listing_status', 'reso')).toBe('StandardStatus');
    });
  });

  describe('getMappingsForStandard', () => {
    it('returns all RESO mappings', () => {
      const reso = getMappingsForStandard('reso');
      expect(reso['reference']).toBe('ListingKey');
      expect(reso['price_float']).toBe('ListPrice');
      expect(reso['property_type']).toBe('PropertyType');
      expect(Object.keys(reso).length).toBeGreaterThan(20);
    });

    it('returns all BLM mappings', () => {
      const blm = getMappingsForStandard('blm');
      expect(blm['reference']).toBe('AGENT_REF');
      expect(blm['price_float']).toBe('PRICE');
      expect(Object.keys(blm).length).toBeGreaterThan(15);
    });

    it('returns all Kyero mappings', () => {
      const kyero = getMappingsForStandard('kyero');
      expect(kyero['reference']).toBe('ref');
      expect(kyero['price_float']).toBe('price');
      expect(Object.keys(kyero).length).toBeGreaterThan(10);
    });

    it('returns all Schema.org mappings', () => {
      const schema = getMappingsForStandard('schema_org');
      expect(schema['title']).toBe('name');
      expect(Object.keys(schema).length).toBeGreaterThan(5);
    });
  });

  describe('getInternalFieldName', () => {
    it('reverse-looks up RESO names', () => {
      expect(getInternalFieldName('ListingKey', 'reso')).toBe('reference');
      expect(getInternalFieldName('ListPrice', 'reso')).toBe('price_float');
      expect(getInternalFieldName('BedroomsTotal', 'reso')).toBe('count_bedrooms');
    });

    it('reverse-looks up BLM names', () => {
      expect(getInternalFieldName('AGENT_REF', 'blm')).toBe('reference');
      expect(getInternalFieldName('PRICE', 'blm')).toBe('price_float');
    });

    it('reverse-looks up Kyero names', () => {
      expect(getInternalFieldName('ref', 'kyero')).toBe('reference');
      expect(getInternalFieldName('beds', 'kyero')).toBe('count_bedrooms');
    });

    it('returns undefined for unknown external field', () => {
      expect(getInternalFieldName('NonExistentField', 'reso')).toBeUndefined();
    });
  });
});
