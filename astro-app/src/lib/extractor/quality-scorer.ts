export type QualityGrade = 'A' | 'B' | 'C' | 'F';

export type FieldImportance = 'critical' | 'important' | 'optional';

export interface FieldResult {
  field: string;
  populated: boolean;
  importance: FieldImportance;
}

export interface GradeResult {
  grade: QualityGrade;
  label: string;
}

export interface QualityAssessment extends GradeResult {
  rate: number;
  expectedRate?: number;
  meetsExpectation: boolean;
  expectationGap?: number;
  expectationStatus?: 'unknown' | 'above' | 'meets' | 'below' | 'well_below';
  expectedGrade?: QualityGrade;
  weightedRate?: number;
  criticalFieldsMissing?: string[];
  confidenceScore: number;
  visibility: 'published' | 'pending' | 'spam';
}

const gradeThresholds: { min: number; grade: QualityGrade; label: string }[] = [
  { min: 0.80, grade: 'A', label: 'Excellent' },
  { min: 0.50, grade: 'B', label: 'Good' },
  { min: 0.20, grade: 'C', label: 'Partial' },
  { min: 0, grade: 'F', label: 'Failed' },
];

export const FIELD_WEIGHTS: Record<FieldImportance, number> = {
  critical: 3,
  important: 2,
  optional: 1,
};

export const FIELD_IMPORTANCE: Record<string, FieldImportance> = {
  title: 'critical',
  price_string: 'critical',
  price_float: 'critical',
  latitude: 'important',
  longitude: 'important',
  address_string: 'important',
  count_bedrooms: 'important',
  count_bathrooms: 'important',
  description: 'important',
  image_urls: 'important',
  reference: 'important',
};

export function getFieldImportance(fieldName: string): FieldImportance {
  return FIELD_IMPORTANCE[fieldName] || 'optional';
}

export function getFieldWeight(fieldName: string): number {
  return FIELD_WEIGHTS[getFieldImportance(fieldName)];
}

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
  const expectation = compareAgainstExpectation(rate, expectedRate);
  const expectedGrade = expectedRate != null ? computeQualityGrade(expectedRate).grade : undefined;
  return {
    grade,
    label,
    rate,
    expectedRate,
    expectedGrade,
    meetsExpectation: expectation.meetsExpectation,
    expectationGap: expectation.expectationGap,
    expectationStatus: expectation.expectationStatus,
  };
}

export function compareAgainstExpectation(
  rate: number,
  expectedRate?: number,
): Pick<QualityAssessment, 'meetsExpectation' | 'expectationGap' | 'expectationStatus'> {
  if (expectedRate == null) {
    return {
      meetsExpectation: true,
      expectationStatus: 'unknown',
    };
  }

  const gap = rate - expectedRate;
  const roundedGap = Math.round(gap * 1000) / 1000;
  const tolerance = 0.03;

  let expectationStatus: 'above' | 'meets' | 'below' | 'well_below';
  if (roundedGap > tolerance) {
    expectationStatus = 'above';
  } else if (Math.abs(roundedGap) <= tolerance) {
    expectationStatus = 'meets';
  } else if (roundedGap <= -0.15) {
    expectationStatus = 'well_below';
  } else {
    expectationStatus = 'below';
  }

  return {
    meetsExpectation: roundedGap >= 0,
    expectationGap: roundedGap,
    expectationStatus,
  };
}

export function assessQualityWeighted(
  fieldResults: FieldResult[],
  expectedRate?: number,
): QualityAssessment {
  let totalWeight = 0;
  let populatedWeight = 0;
  const criticalFieldsMissing: string[] = [];

  for (const fr of fieldResults) {
    const weight = FIELD_WEIGHTS[fr.importance];
    totalWeight += weight;
    if (fr.populated) {
      populatedWeight += weight;
    } else if (fr.importance === 'critical') {
      criticalFieldsMissing.push(fr.field);
    }
  }

  const weightedRate = totalWeight > 0 ? populatedWeight / totalWeight : 0;
  const flatRate = fieldResults.length > 0
    ? fieldResults.filter(f => f.populated).length / fieldResults.length
    : 0;

  let { grade, label } = computeQualityGrade(weightedRate);
 
   // Cap grade at C if any critical fields are missing
   if (criticalFieldsMissing.length > 0 && (grade === 'A' || grade === 'B')) {
     grade = 'C';
     label = 'Partial';
   }
 
   // Confidence score calculation (0 to 1)
   const gradeScores: Record<QualityGrade, number> = { A: 1.0, B: 0.8, C: 0.5, F: 0.1 };
   let confidenceScore = gradeScores[grade] * 0.6;
   
   // Bonus for having all critical fields
   if (criticalFieldsMissing.length === 0) {
     confidenceScore += 0.3;
   }
 
   // Bonus for image presence
   if (fieldResults.find(f => f.field === 'image_urls' && f.populated)) {
     confidenceScore += 0.1;
   }
 
   // Cap at 1.0
   confidenceScore = Math.min(1.0, confidenceScore);
 
   let visibility: 'published' | 'pending' | 'spam' = 'published';
   if (confidenceScore < 0.4 || grade === 'F') {
     visibility = 'spam';
   } else if (confidenceScore < 0.7 || criticalFieldsMissing.length > 0) {
     visibility = 'pending';
   }
 
   const expectation = compareAgainstExpectation(flatRate, expectedRate);
   const expectedGrade = expectedRate != null ? computeQualityGrade(expectedRate).grade : undefined;
 
   return {
     grade,
     label,
     rate: flatRate,
     expectedRate,
     expectedGrade,
     meetsExpectation: expectation.meetsExpectation,
     expectationGap: expectation.expectationGap,
     expectationStatus: expectation.expectationStatus,
     weightedRate,
     criticalFieldsMissing,
     confidenceScore,
     visibility,
   };
 }
