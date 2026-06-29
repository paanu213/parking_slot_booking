import { ChangeTable, diffObjects } from '@/components/ChangeTable';

/**
 * Current-vs-requested diff for a space's pending edits. Edits are stored as a
 * LIST on `space.pendingData` (each entry = the full field snapshot the vendor
 * submitted), so multiple un-approved requests accumulate. We render one diff
 * section per request — request #1 vs the live values, each later request vs the
 * one before it — so the admin sees every submission, not just the latest.
 *
 * Note: amenities and photos are applied live (not queued), so they aren't part
 * of this approval diff.
 */
const FIELD_LABELS: Record<string, string> = {
  name:        'Space Name',
  description: 'Description',
  addressLine: 'Street Address',
  landmark:    'Landmark',
  area:        'Area / Locality',
  city:        'City',
  state:       'State',
  pincode:     'Pincode',
  latitude:    'Latitude',
  longitude:   'Longitude',
};

type EditRequest = { data: Record<string, unknown>; submittedAt: string };

const parseRequests = (pendingData: unknown): EditRequest[] => {
  if (!pendingData || typeof pendingData !== 'string') return [];
  try {
    const parsed = JSON.parse(pendingData);
    if (Array.isArray(parsed)) return parsed.filter((e) => e && typeof e === 'object' && e.data);
    if (parsed && typeof parsed === 'object') return [{ data: parsed, submittedAt: '' }];
  } catch { /* ignore */ }
  return [];
};

export const PendingChanges = ({ space }: { space: any }) => {
  const requests = parseRequests(space?.pendingData);
  if (requests.length === 0) return null;

  const live: Record<string, unknown> = Object.fromEntries(
    Object.keys(FIELD_LABELS).map((k) => [k, space[k]]),
  );
  const multiple = requests.length > 1;

  return (
    <>
      {requests.map((req, i) => {
        const prev = i === 0 ? live : requests[i - 1].data;
        const rows = diffObjects(prev, req.data, FIELD_LABELS);
        if (rows.length === 0) return null;
        return (
          <ChangeTable
            key={i}
            rows={rows}
            title={multiple ? `Change request #${i + 1}` : 'Requested changes — review before approving'}
            submittedAt={req.submittedAt || space.updatedAt}
            footerNote={
              i === requests.length - 1
                ? "Amenities & photos are applied immediately and aren't part of this approval."
                : undefined
            }
          />
        );
      })}
    </>
  );
};
