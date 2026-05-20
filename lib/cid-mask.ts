export const CID_REGEX = /^[A-Z]\d{2}$/;

export function maskCid(input: string): string {
  const upper = input.toUpperCase();
  const letter = upper.match(/[A-Z]/);
  if (!letter) return "";
  const digits = upper.slice(letter.index! + 1).replace(/[^0-9]/g, "").slice(0, 2);
  return letter[0] + digits;
}
