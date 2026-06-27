/** Browser-side coverage: 1 - (mean NN dist / diameter) */

export function computeCoverage(
  selectedIndices: number[],
  allVectors: number[][],
): number {
  if (selectedIndices.length < 2 || allVectors.length === 0) {
    return selectedIndices.length > 0 ? 0.5 : 0;
  }

  const selected = selectedIndices.map((i) => allVectors[i]);
  let diameter = 0;
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      const d = euclidean(selected[i], selected[j]);
      if (d > diameter) diameter = d;
    }
  }
  if (diameter === 0) return 1;

  let nnSum = 0;
  for (let i = 0; i < allVectors.length; i++) {
    let minD = Infinity;
    for (const s of selected) {
      const d = euclidean(allVectors[i], s);
      if (d < minD) minD = d;
    }
    nnSum += minD;
  }

  return 1 - nnSum / allVectors.length / diameter;
}

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function indicesFromLines(
  cellLines: string[],
  lineOrder: string[],
): number[] {
  const indexOf = new Map(lineOrder.map((l, i) => [l, i]));
  return cellLines
    .map((l) => indexOf.get(l))
    .filter((i): i is number => i !== undefined);
}
