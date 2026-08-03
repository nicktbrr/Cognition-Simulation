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

/**
 * Regularized incomplete beta function I_x(a, b), evaluated with the
 * continued-fraction expansion (Numerical Recipes `betai`/`betacf`). Returns a
 * value in [0, 1]; used to get the tail probability of the t and F statistics.
 */
function betaIncomplete(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const front = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x)
  );

  // The continued fraction converges quickly on one side of the symmetry point;
  // use the reflection I_x(a,b) = 1 - I_{1-x}(b,a) on the other side.
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Lentz's algorithm for the continued fraction of the incomplete beta function. */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 200;
  const epsilon = 1e-12;
  const tiny = 1e-30;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;

    // Even step.
    let numerator = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;

    // Odd step.
    numerator = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < epsilon) break;
  }

  return h;
}

/** Log-gamma via the Lanczos approximation (stable for large arguments). */
function logGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
