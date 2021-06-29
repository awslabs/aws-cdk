import { Statistic } from '../metric-types';

export interface SimpleStatistic {
  type: 'simple';
  statistic: Statistic;
}

export interface PercentileStatistic {
  type: 'percentile';
  percentile: number;
}

export interface TrimmedMeanStatistic {
  type: 'trimmedMean';
  trimmedMean: number;
}

/**
 * Parse a statistic, returning the type of metric that was used (simple or percentile)
 */
export function parseStatistic(stat: string): SimpleStatistic | PercentileStatistic | TrimmedMeanStatistic {
  const lowerStat = stat.toLowerCase();

  // Simple statistics
  const statMap: {[k: string]: Statistic} = {
    average: Statistic.AVERAGE,
    avg: Statistic.AVERAGE,
    minimum: Statistic.MINIMUM,
    min: Statistic.MINIMUM,
    maximum: Statistic.MAXIMUM,
    max: Statistic.MAXIMUM,
    samplecount: Statistic.SAMPLE_COUNT,
    n: Statistic.SAMPLE_COUNT,
    sum: Statistic.SUM,
  };

  if (lowerStat in statMap) {
    return {
      type: 'simple',
      statistic: statMap[lowerStat],
    };
  }

  // Percentile or Trimmed Mean statistics
  const re = /^(p|tm)([\d.]+)$/;
  const m = re.exec(lowerStat);
  if (m && m[1] === 'p') {
    return {
      type: 'percentile',
      percentile: parseFloat(m[2]),
    };
  }
  if (m && m[1] === 'tm') {
    return {
      type: 'trimmedMean',
      trimmedMean: parseFloat(m[2]),
    };
  }

  const supportedStats = ['Average', 'Minimum', 'Maximum', 'SampleCount', 'Sum', 'pNN.NN', 'tmNN.NN'];
  throw new Error(`Not a valid statistic: '${stat}', must be one of ${supportedStats.join(' | ')}`);
}

export function normalizeStatistic(stat: string): string {
  const parsed = parseStatistic(stat);
  if (parsed.type === 'simple') {
    return parsed.statistic;
  } else {
    // Already percentile. Avoid parsing because we might get into
    // floating point rounding issues, return as-is but lowercase the p.
    return stat.toLowerCase();
  }
}