// URL-param parsing helpers (?mode=) with safe defaults.
import { Mode } from '@/lib/schema';

export function parseModeParam(raw: string | null): Mode {
  return Mode.safeParse(raw).data ?? 'guided';
}
