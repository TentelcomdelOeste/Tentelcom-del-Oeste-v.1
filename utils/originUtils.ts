export function normalizeOrigin(origin: string) {
  if (!origin) return "---";

  if (origin.includes("IBUX-CLARO")) {
    return "IBUX-CLARO";
  }

  return origin;
}
