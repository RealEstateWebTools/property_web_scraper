export type QualityGrade = 'A' | 'B' | 'C' | 'F';

export interface GradeResult {
  grade: QualityGrade;
  label: string;
}

export interface QualityAssessment extends GradeResult {
  rate: number;
  expectedRate?: number;
  meetsExpectation: boolean;
}

const gradeThresholds: { min: number; grade: QualityGrade; label: string }[] = [
  { min: 0.80, grade: 'A', label: 'Excellent' },
  { min: 0.50, grade: 'B', label: 'Good' },
  { min: 0.20, grade: 'C', label: 'Partial' },
  { min: 0, grade: 'F', label: 'Failed' },
];

export function computeQualityGrade(rate: number): GradeResult {
  for (const t of gradeThresholds) {
    if (rate >= t.min) {
      return { grade: t.grade, label: t.label };
    }
  }
  return { grade: 'F', label: 'Failed' };
}

export function assessQuality(rate: number, expectedRate?: number): QualityAssessment {
  const { grade, label } = computeQualityGrade(rate);
  const meetsExpectation = expectedRate != null ? rate >= expectedRate : true;
  return { grade, label, rate, expectedRate, meetsExpectation };
}
