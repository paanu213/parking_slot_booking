/**
 * A space's pending vendor edits are stored as a JSON list on
 * ParkingLocation.pendingData, so multiple un-approved edit requests accumulate
 * (instead of each new edit overwriting the previous one). Each entry is the
 * full field snapshot the vendor submitted, plus when they submitted it.
 *
 * Backwards compatible: a legacy single-object pendingData is read as one entry.
 */
export type SpaceEditRequest = { data: Record<string, unknown>; submittedAt: string };

export const parsePendingEdits = (pendingData: string | null | undefined): SpaceEditRequest[] => {
  if (!pendingData) return [];
  try {
    const parsed = JSON.parse(pendingData);
    if (Array.isArray(parsed)) {
      return parsed.filter((e) => e && typeof e === 'object' && e.data) as SpaceEditRequest[];
    }
    if (parsed && typeof parsed === 'object') {
      // legacy: a single full-snapshot edit, no timestamp recorded
      return [{ data: parsed as Record<string, unknown>, submittedAt: '' }];
    }
  } catch { /* fall through */ }
  return [];
};

/**
 * The net change to apply on approval: merge every request in order (later
 * requests win per field). Since each entry is a cumulative full snapshot, this
 * resolves to the vendor's latest intended state.
 */
export const mergePendingEdits = (requests: SpaceEditRequest[]): Record<string, unknown> =>
  requests.reduce((acc, r) => ({ ...acc, ...(r.data ?? {}) }), {} as Record<string, unknown>);

const SPACE_EDIT_FIELDS = [
  'name', 'description', 'addressLine', 'landmark', 'district', 'city', 'state', 'pincode', 'area', 'latitude', 'longitude',
] as const;

/** Vendor profile edit fields (mix of user- and vendor-level), used for the same
 *  accumulate-pending-requests flow as space edits. */
export const PROFILE_EDIT_FIELDS = [
  'fullName', 'phone', 'email', 'businessName', 'contactPhone', 'address',
  'gstNumber', 'panNumber', 'payoutUpiId', 'aadharNumber', 'aadharDocUrl',
] as const;

export const sameValue = (a: unknown, b: unknown): boolean => {
  const na = a == null ? '' : String(a).trim();
  const nb = b == null ? '' : String(b).trim();
  if (na === nb) return true;
  const fa = Number(a), fb = Number(b);
  return !Number.isNaN(fa) && !Number.isNaN(fb) && fa === fb;
};

/** True if `body` actually changes anything vs the given baseline (live row or latest snapshot). */
export const editChangesAnything = (
  baseline: Record<string, unknown>,
  body: Record<string, unknown>,
  fields: readonly string[] = SPACE_EDIT_FIELDS,
): boolean =>
  fields.some((f) => f in body && !sameValue(body[f], baseline[f]));
