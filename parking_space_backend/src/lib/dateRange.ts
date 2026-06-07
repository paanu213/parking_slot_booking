/**
 * Resolve a UI filter selection (daily / monthly / yearly / financial-year /
 * custom) into a concrete { gte, lte } date window for Prisma `where` clauses.
 *
 * Returns `null` for "all time" (no constraint). Default — when nothing or an
 * unknown period is passed — is the CURRENT MONTH, matching the UI default.
 *
 * Financial Year follows India's convention: 1 April → 31 March.
 */
export type RangePeriod = 'day' | 'month' | 'year' | 'fy' | 'custom' | 'all';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export const resolveDateRange = (
  period?: string,
  from?: string,
  to?: string,
): { gte: Date; lte: Date } | null => {
  const now = new Date();

  switch (period) {
    case 'all':
      return null;

    case 'day':
      return { gte: startOfDay(now), lte: endOfDay(now) };

    case 'year':
      return {
        gte: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
        lte: endOfDay(new Date(now.getFullYear(), 11, 31)),
      };

    case 'fy': {
      // India FY: Apr (month 3) → Mar. Before April we're still in last year's FY.
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return {
        gte: new Date(startYear, 3, 1, 0, 0, 0, 0),
        lte: endOfDay(new Date(startYear + 1, 2, 31)),
      };
    }

    case 'custom': {
      if (!from || !to) return null;
      const g = new Date(from);
      const l = new Date(to);
      if (Number.isNaN(+g) || Number.isNaN(+l)) return null;
      return { gte: startOfDay(g), lte: endOfDay(l) };
    }

    case 'month':
    default:
      return {
        gte: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        lte: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
  }
};
