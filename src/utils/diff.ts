export type DiffLineType = 'unchanged' | 'added' | 'removed';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

// LCS (Longest Common Subsequence) ベースの差分計算
export function computeDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // LCSを計算
  const lcs = computeLCS(oldLines, newLines);

  // 差分結果を生成
  const result: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let lcsIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      lcsIndex < lcs.length &&
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      oldLines[oldIndex] === lcs[lcsIndex] &&
      newLines[newIndex] === lcs[lcsIndex]
    ) {
      // 共通行
      result.push({
        type: 'unchanged',
        content: oldLines[oldIndex],
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
      });
      oldIndex++;
      newIndex++;
      lcsIndex++;
    } else if (
      newIndex < newLines.length &&
      (lcsIndex >= lcs.length || newLines[newIndex] !== lcs[lcsIndex])
    ) {
      // 追加行
      result.push({
        type: 'added',
        content: newLines[newIndex],
        newLineNumber: newIndex + 1,
      });
      newIndex++;
    } else if (
      oldIndex < oldLines.length &&
      (lcsIndex >= lcs.length || oldLines[oldIndex] !== lcs[lcsIndex])
    ) {
      // 削除行
      result.push({
        type: 'removed',
        content: oldLines[oldIndex],
        oldLineNumber: oldIndex + 1,
      });
      oldIndex++;
    }
  }

  // 統計を計算
  const addedCount = result.filter((l) => l.type === 'added').length;
  const removedCount = result.filter((l) => l.type === 'removed').length;
  const unchangedCount = result.filter((l) => l.type === 'unchanged').length;

  return { lines: result, addedCount, removedCount, unchangedCount };
}

// LCS計算（動的計画法）
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // LCSを復元
  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

// Side-by-side表示用のペア化
export interface SideBySidePair {
  left: DiffLine | null;
  right: DiffLine | null;
}

export function createSideBySidePairs(diffResult: DiffResult): SideBySidePair[] {
  const pairs: SideBySidePair[] = [];
  const lines = diffResult.lines;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'unchanged') {
      pairs.push({ left: line, right: line });
      i++;
    } else if (line.type === 'removed') {
      // 次の行がaddedならペアにする
      if (i + 1 < lines.length && lines[i + 1].type === 'added') {
        pairs.push({ left: line, right: lines[i + 1] });
        i += 2;
      } else {
        pairs.push({ left: line, right: null });
        i++;
      }
    } else if (line.type === 'added') {
      pairs.push({ left: null, right: line });
      i++;
    }
  }

  return pairs;
}
