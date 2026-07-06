/**
 * Statistical tests for the Analysis "Compare" mode.
 *
 * Ported from the standalone `Analysis Animation.html` prototype so the app runs
 * the exact same math: an independent two-sample t-test (pooled variance) and a
 * one-way ANOVA, each with an approximate p-value from the incomplete beta
 * function. Sample statistics use n-1 (Bessel's correction) throughout.
 */

export interface TTestResult {
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  mean1: number;
  mean2: number;
  sd1: number;
  sd2: number;
}

export interface AnovaGroupStat {
  n: number;
  mean: number;
}

export interface AnovaResult {
  fStatistic: number;
  dfBetween: number;
  dfWithin: number;
  pValue: number;
  SSB: number;
  SSW: number;
  SST: number;
  MSB: number;
  MSW: number;
  etaSquared: number;
  groupStats: AnovaGroupStat[];
}

export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Sample variance (n - 1 denominator). */
function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((acc, val) => acc + (val - m) ** 2, 0) / (arr.length - 1);
}

export function standardDeviation(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

function pooledVariance(arr1: number[], arr2: number[]): number {
  const n1 = arr1.length;
  const n2 = arr2.length;
  const var1 = variance(arr1);
  const var2 = variance(arr2);
  return ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
}

/** Two-sample t-test (independent samples, pooled variance). */
export function tTest(arr1: number[], arr2: number[]): TTestResult {
  const n1 = arr1.length;
  const n2 = arr2.length;
  const mean1 = mean(arr1);
  const mean2 = mean(arr2);
  const pooledVar = pooledVariance(arr1, arr2);
  const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));
  const tStat = (mean1 - mean2) / se;
  const df = n1 + n2 - 2;

  return {
    tStatistic: tStat,
    degreesOfFreedom: df,
    pValue: tDistributionPValue(Math.abs(tStat), df),
    mean1,
    mean2,
    sd1: standardDeviation(arr1),
    sd2: standardDeviation(arr2),
  };
}

/** One-way ANOVA across two or more groups. */
export function anova(groups: number[][]): AnovaResult {
  const k = groups.length;
  const allData = groups.flat();
  const N = allData.length;
  const grandMean = mean(allData);

  const groupStats = groups.map((g) => ({ n: g.length, mean: mean(g), data: g }));

  const SSB = groupStats.reduce(
    (acc, g) => acc + g.n * (g.mean - grandMean) ** 2,
    0
  );
  const SSW = groupStats.reduce(
    (acc, g) => acc + g.data.reduce((sum, val) => sum + (val - g.mean) ** 2, 0),
    0
  );
  const SST = SSB + SSW;

  const dfBetween = k - 1;
  const dfWithin = N - k;
  const MSB = SSB / dfBetween;
  const MSW = SSW / dfWithin;
  const fStat = MSB / MSW;

  return {
    fStatistic: fStat,
    dfBetween,
    dfWithin,
    pValue: fDistributionPValue(fStat, dfBetween, dfWithin),
    SSB,
    SSW,
    SST,
    MSB,
    MSW,
    etaSquared: SSB / SST,
    groupStats: groupStats.map(({ n, mean }) => ({ n, mean })),
  };
}

/** All unordered pairs (i < j) of the given array. */
export function getPairCombinations<T>(arr: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]]);
    }
  }
  return pairs;
}

/** Approximate two-tailed p-value for a t-statistic. */
function tDistributionPValue(t: number, df: number): number {
  const x = df / (df + t * t);
  return betaIncomplete(df / 2, 0.5, x);
}

/** Approximate p-value for an F-statistic. */
function fDistributionPValue(f: number, df1: number, df2: number): number {
  const x = df2 / (df2 + df1 * f);
  return betaIncomplete(df2 / 2, df1 / 2, x);
}

/** Series approximation of the regularized incomplete beta function. */
function betaIncomplete(a: number, b: number, x: number): number {
  if (x === 0) return 1;
  if (x === 1) return 0;

  const maxIterations = 200;
  const epsilon = 1e-10;

  let result = 0;
  let term = 1;

  for (let n = 0; n < maxIterations; n++) {
    if (n === 0) {
      term = (x ** a * (1 - x) ** b) / a;
    } else {
      term *= ((a + n - 1) * x) / n;
    }
    result += term;
    if (Math.abs(term) < epsilon) break;
  }

  const beta = (gamma(a) * gamma(b)) / gamma(a + b);
  return 1 - result / beta;
}

/** Lanczos approximation of the gamma function. */
function gamma(n: number): number {
  if (n === 1) return 1;
  if (n === 0.5) return Math.sqrt(Math.PI);
  if (n < 0.5) return Math.PI / (Math.sin(Math.PI * n) * gamma(1 - n));

  n -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (n + i);
  }

  const t = n + g + 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (n + 0.5) * Math.exp(-t) * x;
}
