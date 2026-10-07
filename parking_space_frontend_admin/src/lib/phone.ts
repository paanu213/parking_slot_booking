/** Admin phone inputs: digits only, max 10 (Indian mobile). Strips letters, dots, spaces, `+`. */
export const digits10 = (raw: string): string => {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};
export const isPhone10 = (v: string) => /^\d{10}$/.test(v);
export const phoneInputProps = { type: 'tel' as const, inputMode: 'numeric' as const, maxLength: 10 };
