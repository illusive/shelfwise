export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowIso(now: () => Date = () => new Date()): string {
  return now().toISOString();
}
