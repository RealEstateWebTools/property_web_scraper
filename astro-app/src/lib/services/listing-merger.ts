import type { ExtractionResult } from '../extractor/html-extractor.js';

export interface MergedListing {
  fingerprint: string;
  sources: string[];
  properties: Record<string, unknown>;
  bestQualityGrade: string;
}

/**
 * Merge multiple extraction results by fingerprint.
 * When the same listing appears on multiple portals, merge the properties,
 * preferring the source with the most populated fields.
 */
export function mergeListings(
  results: { sourceUrl: string; result: ExtractionResult }[],
): MergedListing[] {
  const grouped = new Map<string, { sourceUrl: string; result: ExtractionResult }[]>();

  for (const entry of results) {
    if (!entry.result.success || entry.result.properties.length === 0) continue;
    const fp = entry.result.fingerprint || 'unknown';
    const group = grouped.get(fp) || [];
    group.push(entry);
    grouped.set(fp, group);
  }

  const merged: MergedListing[] = [];

  for (const [fingerprint, group] of grouped) {
    // Sort by number of populated fields (descending)
    const scored = group.map((g) => {
      const props = g.result.properties[0];
      let populated = 0;
      for (const value of Object.values(props)) {
        if (value !== undefined && value !== null && value !== '' && value !== 0 && value !== false) {
          if (Array.isArray(value) && value.length === 0) continue;
          populated++;
        }
      }
      return { ...g, populated };
    }).sort((a, b) => b.populated - a.populated);

    // Base properties from the best source, then fill gaps from others
    const base = { ...scored[0].result.properties[0] };
    for (let i = 1; i < scored.length; i++) {
      const other = scored[i].result.properties[0];
      for (const [key, value] of Object.entries(other)) {
        const existing = base[key];
        const isEmpty = existing === undefined || existing === null || existing === '' || existing === 0;
        if (isEmpty && value !== undefined && value !== null && value !== '' && value !== 0) {
          base[key] = value;
        }
      }
    }

    // Best quality grade from any source
    const grades = ['A', 'B', 'C', 'F'];
    let bestGrade = 'F';
    for (const g of scored) {
      const grade = g.result.diagnostics?.qualityGrade || 'F';
      if (grades.indexOf(grade) < grades.indexOf(bestGrade)) {
        bestGrade = grade;
      }
    }

    merged.push({
      fingerprint,
      sources: group.map((g) => g.sourceUrl),
      properties: base,
      bestQualityGrade: bestGrade,
    });
  }

  return merged;
}
