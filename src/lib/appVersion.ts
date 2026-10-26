/** Compare dotted app-store versions without treating missing segments as different. */
export function isOlderVersion(current: string, minimum: string): boolean {
  const parts = (value: string) => value.split(".").map(x => Number.parseInt(x, 10) || 0);
  const a = parts(current), b = parts(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}
