const UNIT_TO_SECONDS = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  M: 30 * 86400, // 30-day month approximation (2,592,000s)
  y: Math.round(365.25 * 86400), // 365.25-day year approximation (31,557,600s)
} as const;

export type DurationUnit = keyof typeof UNIT_TO_SECONDS;
export type JwtExpiryDuration = `${number}${DurationUnit}` | number;

/**
 * Converts a duration string like "10d", "23m", "2M", "1y", or numeric seconds
 * into an integer number of seconds for Redis EX.
 * Note: "m" is minutes and "M" is months (case-sensitive).
 */
export function durationToRedisExSeconds(
  duration: JwtExpiryDuration | string,
  fallbackSeconds = 60,
): number {
  if (typeof duration === 'number') {
    if (!Number.isFinite(duration) || duration <= 0) {
      return Math.max(1, Math.floor(fallbackSeconds));
    }
    return Math.max(1, Math.floor(duration));
  }

  const trimmed = duration.trim();

  // Plain numeric string treated as seconds
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed);
    return parsed > 0
      ? Math.max(1, Math.floor(parsed))
      : Math.max(1, Math.floor(fallbackSeconds));
  }

  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d|w|M|y)$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}". Expected a value like "10d", "23m", "2M", "1y", or seconds.`,
    );
  }

  const amount = Number(match[1]);
  const unit = match[2] as DurationUnit;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      `Duration "${duration}" must be a positive finite number for Redis EX.`,
    );
  }

  const seconds = Math.floor(amount * UNIT_TO_SECONDS[unit]);

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(
      `Duration "${duration}" resolves to an unsafe or non-positive TTL: ${seconds}.`,
    );
  }

  return seconds;
}
