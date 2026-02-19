import { describe, it, expect } from 'vitest';
import {
  computeQualityGrade,
  assessQuality,
  assessQualityWeighted,
  compareAgainstExpectation,
  getFieldImportance,
  getFieldWeight,
  FIELD_WEIGHTS,
  FIELD_IMPORTANCE,
  type FieldResult,
} from '../../src/lib/extractor/quality-scorer.js';

describe('quality-scorer', () => {
  describe('computeQualityGrade', () => {
    it('returns grade A for rate >= 80%', () => {
      expect(computeQualityGrade(0.80)).toEqual({ grade: 'A', label: 'Excellent' });
      expect(computeQualityGrade(0.95)).toEqual({ grade: 'A', label: 'Excellent' });
      expect(computeQualityGrade(1.0)).toEqual({ grade: 'A', label: 'Excellent' });
    });

    it('returns grade B for rate >= 50% and < 80%', () => {
      expect(computeQualityGrade(0.50)).toEqual({ grade: 'B', label: 'Good' });
      expect(computeQualityGrade(0.65)).toEqual({ grade: 'B', label: 'Good' });
      expect(computeQualityGrade(0.79)).toEqual({ grade: 'B', label: 'Good' });
    });

    it('returns grade C for rate >= 20% and < 50%', () => {
      expect(computeQualityGrade(0.20)).toEqual({ grade: 'C', label: 'Partial' });
      expect(computeQualityGrade(0.35)).toEqual({ grade: 'C', label: 'Partial' });
      expect(computeQualityGrade(0.49)).toEqual({ grade: 'C', label: 'Partial' });
    });

    it('returns grade F for rate < 20%', () => {
      expect(computeQualityGrade(0)).toEqual({ grade: 'F', label: 'Failed' });
      expect(computeQualityGrade(0.10)).toEqual({ grade: 'F', label: 'Failed' });
      expect(computeQualityGrade(0.19)).toEqual({ grade: 'F', label: 'Failed' });
    });
  });

  describe('assessQuality', () => {
    it('returns full assessment with rate and grade', () => {
      const result = assessQuality(0.85);
      expect(result.grade).toBe('A');
      expect(result.label).toBe('Excellent');
      expect(result.rate).toBe(0.85);
      expect(result.meetsExpectation).toBe(true);
    });

    it('meets expectation when rate >= expectedRate', () => {
      const result = assessQuality(0.85, 0.80);
      expect(result.meetsExpectation).toBe(true);
      expect(result.expectedRate).toBe(0.80);
    });

    it('fails expectation when rate < expectedRate', () => {
      const result = assessQuality(0.40, 0.80);
      expect(result.meetsExpectation).toBe(false);
      expect(result.grade).toBe('C');
    });

    it('meets expectation when no expectedRate is provided', () => {
      const result = assessQuality(0.10);
      expect(result.meetsExpectation).toBe(true);
      expect(result.expectedRate).toBeUndefined();
    });

    it('meets expectation when rate exactly equals expectedRate', () => {
      const result = assessQuality(0.50, 0.50);
      expect(result.meetsExpectation).toBe(true);
      expect(result.expectationStatus).toBe('meets');
      expect(result.expectedGrade).toBe('B');
    });
  });

  describe('compareAgainstExpectation', () => {
    it('returns unknown when expected rate is missing', () => {
      const result = compareAgainstExpectation(0.7);
      expect(result.expectationStatus).toBe('unknown');
      expect(result.meetsExpectation).toBe(true);
      expect(result.expectationGap).toBeUndefined();
    });

    it('classifies above, meets, below and well_below correctly', () => {
      expect(compareAgainstExpectation(0.9, 0.7).expectationStatus).toBe('above');
      expect(compareAgainstExpectation(0.71, 0.7).expectationStatus).toBe('meets');
      expect(compareAgainstExpectation(0.6, 0.7).expectationStatus).toBe('below');
      expect(compareAgainstExpectation(0.5, 0.7).expectationStatus).toBe('well_below');
    });
  });

  describe('getFieldImportance', () => {
    it('returns critical for title', () => {
      expect(getFieldImportance('title')).toBe('critical');
    });

    it('returns critical for price_string', () => {
      expect(getFieldImportance('price_string')).toBe('critical');
    });

    it('returns critical for price_float', () => {
      expect(getFieldImportance('price_float')).toBe('critical');
    });

    it('returns important for latitude', () => {
      expect(getFieldImportance('latitude')).toBe('important');
    });

    it('returns important for description', () => {
      expect(getFieldImportance('description')).toBe('important');
    });

    it('returns important for image_urls', () => {
      expect(getFieldImportance('image_urls')).toBe('important');
    });

    it('returns optional for unknown fields', () => {
      expect(getFieldImportance('some_unknown_field')).toBe('optional');
    });

    it('returns optional for country', () => {
      expect(getFieldImportance('country')).toBe('optional');
    });
  });

  describe('getFieldWeight', () => {
    it('returns 3 for critical fields', () => {
      expect(getFieldWeight('title')).toBe(3);
    });

    it('returns 2 for important fields', () => {
      expect(getFieldWeight('latitude')).toBe(2);
    });

    it('returns 1 for optional fields', () => {
      expect(getFieldWeight('country')).toBe(1);
    });
  });

  describe('FIELD_WEIGHTS', () => {
    it('has correct weight values', () => {
      expect(FIELD_WEIGHTS.critical).toBe(3);
      expect(FIELD_WEIGHTS.important).toBe(2);
      expect(FIELD_WEIGHTS.optional).toBe(1);
    });
  });

  describe('assessQualityWeighted', () => {
    it('returns grade A when all fields populated', () => {
      const fields: FieldResult[] = [
        { field: 'title', populated: true, importance: 'critical' },
        { field: 'price_string', populated: true, importance: 'critical' },
        { field: 'latitude', populated: true, importance: 'important' },
        { field: 'country', populated: true, importance: 'optional' },
      ];

      const result = assessQualityWeighted(fields);
      expect(result.grade).toBe('A');
      expect(result.weightedRate).toBe(1);
      expect(result.criticalFieldsMissing).toEqual([]);
      expect(result.rate).toBe(1);
    });

    it('caps grade to C when critical fields are missing', () => {
      const fields: FieldResult[] = [
        { field: 'title', populated: false, importance: 'critical' },
        { field: 'latitude', populated: true, importance: 'important' },
        { field: 'longitude', populated: true, importance: 'important' },
        { field: 'count_bedrooms', populated: true, importance: 'important' },
        { field: 'count_bathrooms', populated: true, importance: 'important' },
        { field: 'description', populated: true, importance: 'important' },
        { field: 'country', populated: true, importance: 'optional' },
        { field: 'region', populated: true, importance: 'optional' },
      ];

      const result = assessQualityWeighted(fields);
      expect(result.grade).toBe('C');
      expect(result.criticalFieldsMissing).toContain('title');
    });

    it('reports all missing critical fields', () => {
      const fields: FieldResult[] = [
        { field: 'title', populated: false, importance: 'critical' },
        { field: 'price_string', populated: false, importance: 'critical' },
        { field: 'price_float', populated: false, importance: 'critical' },
        { field: 'country', populated: true, importance: 'optional' },
      ];

      const result = assessQualityWeighted(fields);
      expect(result.criticalFieldsMissing).toHaveLength(3);
      expect(result.criticalFieldsMissing).toContain('title');
      expect(result.criticalFieldsMissing).toContain('price_string');
      expect(result.criticalFieldsMissing).toContain('price_float');
    });

    it('weights critical fields more heavily', () => {
      // All optional populated, all critical empty
      const fields: FieldResult[] = [
        { field: 'title', populated: false, importance: 'critical' },
        { field: 'country', populated: true, importance: 'optional' },
        { field: 'region', populated: true, importance: 'optional' },
        { field: 'city', populated: true, importance: 'optional' },
      ];

      const result = assessQualityWeighted(fields);
      // flat rate = 3/4 = 0.75 → B
      // weighted = 3/(3+3) = 0.5 but critical missing → C
      expect(result.rate).toBe(0.75);
      expect(result.weightedRate).toBeLessThan(result.rate);
    });

    it('returns grade F when no fields populated', () => {
      const fields: FieldResult[] = [
        { field: 'title', populated: false, importance: 'critical' },
        { field: 'latitude', populated: false, importance: 'important' },
        { field: 'country', populated: false, importance: 'optional' },
      ];

      const result = assessQualityWeighted(fields);
      expect(result.grade).toBe('F');
      expect(result.weightedRate).toBe(0);
      expect(result.rate).toBe(0);
    });

    it('handles empty field list', () => {
      const result = assessQualityWeighted([]);
      expect(result.grade).toBe('F');
      expect(result.weightedRate).toBe(0);
      expect(result.rate).toBe(0);
      expect(result.criticalFieldsMissing).toEqual([]);
    });

    it('checks expectation against flat rate', () => {
      const fields: FieldResult[] = [
        { field: 'title', populated: true, importance: 'critical' },
        { field: 'country', populated: false, importance: 'optional' },
      ];

      const result = assessQualityWeighted(fields, 0.80);
      // flat rate = 1/2 = 0.5 < 0.80
      expect(result.meetsExpectation).toBe(false);
      expect(result.expectationGap).toBe(-0.3);
      expect(result.expectationStatus).toBe('well_below');
    });

    it('meets expectation when no expectedRate provided', () => {
      const fields: FieldResult[] = [
        { field: 'title', populated: true, importance: 'critical' },
      ];

      const result = assessQualityWeighted(fields);
      expect(result.meetsExpectation).toBe(true);
    });
  });
});
