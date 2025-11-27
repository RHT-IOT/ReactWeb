export const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function asset(path: string): string {
  if (!path) return BASE_PATH;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}
