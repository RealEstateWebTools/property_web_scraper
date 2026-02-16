import { describe, it, expect } from 'vitest';
import { computeQualityGrade, assessQuality } from '../../src/lib/extractor/quality-scorer.js';

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
    });
  });
});
