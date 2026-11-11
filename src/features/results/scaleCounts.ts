/** Distributes `total` cells across counts by largest remainder, preserving proportions. */
export function scaleCounts(counts: number[], total: number): number[] {
  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum <= total) return counts;
  const exact = counts.map((c) => (c / sum) * total);
  const floored = exact.map(Math.floor);
  let remaining = total - floored.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floored[i] += 1;
    remaining -= 1;
  }
  return floored;
}
