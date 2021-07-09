import { Statistic } from '../metric-types';

export interface SimpleStatistic {
  type: 'simple';
  statistic: Statistic;
}

export interface PercentileStatistic {
  type: 'percentile';
  percentile: number;
}

export interface GenericStatistic {
  type: 'generic';
  statistic: string;
}

/**
 * Parse a statistic, returning the type of metric that was used (simple or percentile)
 */
export function parseStatistic(stat: string): SimpleStatistic | PercentileStatistic | GenericStatistic {
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

  // Percentile statistics
  const re = /^p([\d.]+)$/;
  const m = re.exec(lowerStat);
  if (m) {
    return {
      type: 'percentile',
      percentile: parseFloat(m[1]),
    };
  }

  return {
    type: 'generic',
    statistic: lowerStat,
  };
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