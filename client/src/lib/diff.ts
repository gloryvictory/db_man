export interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
}

const MAX_CELLS = 20_000_000; // ограничение памяти для LCS (n*m)

/**
 * Построчный diff через LCS (Longest Common Subsequence).
 * Используется Int32Array для экономии памяти; при превышении лимита —
 * вырожденный diff (вся левая сторона как удалённые, вся правая как добавленные).
 */
export function diffLines(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map((text) => ({ type: 'add', text }));
  if (m === 0) return a.map((text) => ({ type: 'del', text }));
  if (n * m > MAX_CELLS) return fallbackDiff(a, b);

  const idx = (i: number, j: number) => i * (m + 1) + j;
  const dp = new Int32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const ai = a[i];
    for (let j = m - 1; j >= 0; j--) {
      dp[idx(i, j)] = ai === b[j] ? dp[idx(i + 1, j + 1)] + 1 : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] });
  while (j < m) out.push({ type: 'add', text: b[j++] });
  return out;
}

function fallbackDiff(a: string[], b: string[]): DiffLine[] {
  const out: DiffLine[] = [];
  for (const t of a) out.push({ type: 'del', text: t });
  for (const t of b) out.push({ type: 'add', text: t });
  return out;
}
