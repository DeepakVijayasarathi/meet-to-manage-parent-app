/** Short, stable context label for a crash report. Anything that isn't a simple label (e.g. a component stack) becomes "render". */
export function crashContext(context?: string): string | null {
  if (!context) return null;
  const firstLine = context.trim().split("\n")[0]?.trim() ?? "";
  return /^[\w.-]{1,64}$/.test(firstLine) ? firstLine : "render";
}
