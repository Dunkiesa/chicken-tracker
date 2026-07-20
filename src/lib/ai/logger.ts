const isDev = process.env.NODE_ENV !== "production";

export function aiLog(...args: unknown[]): void {
  if (isDev) console.log(...args);
}

export function aiError(...args: unknown[]): void {
  if (isDev) console.error(...args);
}
