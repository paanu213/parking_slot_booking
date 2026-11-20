/**
 * QR sticker validity: 10 years from when the vehicle was registered, unless
 * admin has set a custom end date (VehicleRegistration.validUntil). Clearing
 * the custom date (null) puts the vehicle back on this default.
 */
export const QR_VALIDITY_YEARS = 10;

type ValiditySource = { validUntil: Date | null; createdAt: Date };

/** The date this vehicle's QR stops working. */
export const effectiveValidUntil = (r: ValiditySource): Date => {
  if (r.validUntil) return r.validUntil;
  const d = new Date(r.createdAt);
  d.setFullYear(d.getFullYear() + QR_VALIDITY_YEARS);
  return d;
};

export const isQrExpired = (r: ValiditySource) => effectiveValidUntil(r).getTime() < Date.now();
