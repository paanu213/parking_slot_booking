/**
 * Server-side pagination for admin lists.
 *
 * Request: ?page=1&pageSize=25 (both optional, clamped to sane bounds).
 * Response: the list's usual `{ items }` plus `{ total, page, pageSize, pageCount }`,
 * so callers that only read `items` keep working.
 */
export interface PageInput {
  page?: unknown;
  pageSize?: unknown;
}

export const readPage = (q: PageInput, defaultSize = 25, maxSize = 100) => {
  const page = Math.max(1, Number.parseInt(String(q.page ?? 1), 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number.parseInt(String(q.pageSize ?? defaultSize), 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

export const pageMeta = (total: number, page: number, pageSize: number) => ({
  total,
  page,
  pageSize,
  pageCount: Math.max(1, Math.ceil(total / pageSize)),
});
