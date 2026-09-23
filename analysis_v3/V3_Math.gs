/* Pure numerical helpers audited and retained from V2; no Apps Script dependencies. */

function v3Levenshtein_(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const previous = [];
  for (let j = 0; j <= right.length; j++) previous[j] = j;
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left.charAt(i - 1) === right.charAt(j - 1) ? 0 : 1)
      );
    }
    for (let k = 0; k < current.length; k++) previous[k] = current[k];
  }
  return previous[right.length];
}


function v3LcsLength_(left, right) {
  const a = left || [];
  const b = right || [];
  const matrix = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [];
    for (let j = 0; j <= b.length; j++) matrix[i][j] = 0;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = a[i - 1] === b[j - 1] ?
        matrix[i - 1][j - 1] + 1 :
        Math.max(matrix[i - 1][j], matrix[i][j - 1]);
    }
  }
  return matrix[a.length][b.length];
}


function v3KendallTau_(sequence) {
  const values = sequence || [];
  if (values.length < 2) return '';
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i] < values[j]) concordant++;
      else if (values[i] > values[j]) discordant++;
    }
  }
  const pairs = concordant + discordant;
  return pairs ? (concordant - discordant) / pairs : '';
}


function v3Mean_(values) {
  const clean = (values || []).filter(function(value) {
    return typeof value === 'number' && isFinite(value);
  });
  return clean.length ? clean.reduce(function(sum, value) {
    return sum + value;
  }, 0) / clean.length : '';
}


function v3Median_(values) {
  const clean = (values || []).filter(function(value) {
    return typeof value === 'number' && isFinite(value);
  }).sort(function(a, b) {
    return a - b;
  });
  if (!clean.length) return '';
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}


function v3Rank_(values) {
  const indexed = (values || []).map(function(value, index) {
      return {
        value: value,
        index: index
      };
    })
    .sort(function(a, b) {
      return a.value - b.value || a.index - b.index;
    });
  const ranks = new Array(indexed.length);
  let index = 0;
  while (index < indexed.length) {
    let end = index + 1;
    while (end < indexed.length && indexed[end].value === indexed[index].value) end++;
    const rank = (index + 1 + end) / 2;
    for (let i = index; i < end; i++) ranks[indexed[i].index] = rank;
    index = end;
  }
  return ranks;
}


function v3Spearman_(x, y) {
  const pairs = [];
  for (let i = 0; i < Math.min((x || []).length, (y || []).length); i++) {
    if (typeof x[i] === 'number' && isFinite(x[i]) && typeof y[i] === 'number' && isFinite(y[i])) pairs.push([
      x[i], y[i]
    ]);
  }
  if (pairs.length < 2) return '';
  const xr = v3Rank_(pairs.map(function(pair) {
    return pair[0];
  }));
  const yr = v3Rank_(pairs.map(function(pair) {
    return pair[1];
  }));
  const xm = v3Mean_(xr);
  const ym = v3Mean_(yr);
  let numerator = 0;
  let xsum = 0;
  let ysum = 0;
  for (let i = 0; i < pairs.length; i++) {
    const dx = xr[i] - xm;
    const dy = yr[i] - ym;
    numerator += dx * dy;
    xsum += dx * dx;
    ysum += dy * dy;
  }
  return xsum && ysum ? numerator / Math.sqrt(xsum * ysum) : '';
}


function v3SampleStandardDeviation_(values) {
  const clean = (values || []).filter(function(value) {
    return typeof value === 'number' && isFinite(value);
  });
  if (clean.length < 2) return null;
  const mean = v3Mean_(clean);
  return Math.sqrt(clean.reduce(function(sum, value) {
    return sum + Math.pow(value - mean, 2);
  }, 0) / (clean.length - 1));
}


function v3LogGamma_(value) {
  const coefficients = [
    0.9999999999998099,
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - v3LogGamma_(1 - value);
  }
  let shifted = value - 1;
  let sum = coefficients[0];
  for (let i = 1; i < coefficients.length; i++) sum += coefficients[i] / (shifted + i);
  const t = shifted + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
}


function v3BetaContinuedFraction_(a, b, x) {
  const maxIterations = 200;
  const epsilon = 3e-14;
  const floor = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let result = d;
  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let coefficient = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + coefficient * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + coefficient / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    result *= d * c;

    coefficient = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + coefficient * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + coefficient / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return result;
}


function v3RegularizedIncompleteBeta_(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    v3LogGamma_(a + b) - v3LogGamma_(a) - v3LogGamma_(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return front * v3BetaContinuedFraction_(a, b, x) / a;
  }
  return 1 - front * v3BetaContinuedFraction_(b, a, 1 - x) / b;
}


function v3StudentTTwoSidedP_(tStatistic, degreesOfFreedom) {
  if (typeof tStatistic !== 'number' || !isFinite(tStatistic) || degreesOfFreedom < 1) return '';
  const x = degreesOfFreedom / (degreesOfFreedom + tStatistic * tStatistic);
  const p = v3RegularizedIncompleteBeta_(x, degreesOfFreedom / 2, 0.5);
  return Math.max(0, Math.min(1, p));
}


function v3PairedTTest_(differences) {
  const clean = (differences || []).filter(function(value) {
    return typeof value === 'number' && isFinite(value);
  });
  const result = {
    n: clean.length,
    mean_difference: v3Mean_(clean),
    sd_difference: '',
    t: '',
    df: clean.length >= 2 ? clean.length - 1 : '',
    p: '',
    cohens_dz: ''
  };
  if (clean.length < 2) return result;
  const sd = v3SampleStandardDeviation_(clean);
  result.sd_difference = sd;
  if (sd === null || sd === 0) return result;
  result.t = result.mean_difference / (sd / Math.sqrt(clean.length));
  result.p = v3StudentTTwoSidedP_(result.t, result.df);
  result.cohens_dz = result.mean_difference / sd;
  return result;
}
