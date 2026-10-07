/**
 * Phone-number input rules for every QR-flow form: digits only, exactly 10
 * (Indian mobile). Anything else — letters, dots, spaces, `+`, dashes — is
 * stripped as it's typed or pasted. A pasted "+91 98765 43210" or "098765…"
 * keeps just the 10-digit mobile number.
 */
export const sanitizePhone = (raw: string): string => {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};

export const PHONE_PATTERN = /^\d{10}$/;
export const PHONE_ERROR = 'Enter a 10-digit mobile number';

/** Props for any <input> that takes a phone number — mobile numeric keypad, hard 10-char cap. */
export const phoneInputProps = {
  type: 'tel' as const,
  inputMode: 'numeric' as const,
  maxLength: 10,
  autoComplete: 'tel-national',
};

/** react-hook-form `register` options: sanitises on every change (typing and paste) and validates. */
export const phoneRules = (required: string | false = 'Enter a mobile number') => ({
  ...(required ? { required } : {}),
  pattern: { value: PHONE_PATTERN, message: PHONE_ERROR },
  onChange: (e: { target: { value: string } }) => {
    e.target.value = sanitizePhone(e.target.value);
  },
});
