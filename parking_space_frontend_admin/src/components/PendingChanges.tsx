import { ChangeTable, computeChanges } from '@/components/ChangeTable';

/**
 * Current-vs-requested diff for a space's pending edits. When a vendor edits an
 * APPROVED space, the proposed values are stored as JSON in `space.pendingData`
 * while the live values stay on `space` itself.
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

export const PendingChanges = ({ space }: { space: any }) => {
  if (!space?.pendingData) return null;
  const rows = computeChanges(space.pendingData, (k) => space[k], FIELD_LABELS);
  return (
    <ChangeTable
      rows={rows}
      title="Requested changes — review before approving"
      submittedAt={space.updatedAt}
      footerNote="Amenities & photos are applied immediately and aren't part of this approval."
    />
  );
};
