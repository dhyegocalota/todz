export type SparkleClient = { appVersion: string; macosMajor: string };

export function sparkleClientOf(userAgent: string | null): SparkleClient | null {
  throw new Error('sparkleClientOf is not implemented');
}
