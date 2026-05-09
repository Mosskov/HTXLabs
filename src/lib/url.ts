import type { Mode } from '@/lab-guide/runner';

const MODES: readonly Mode[] = ['guided', 'semi-guided', 'open'];

export function parseModeParam(raw: string | null): Mode {
  return (MODES as readonly string[]).includes(raw ?? '') ? (raw as Mode) : 'guided';
}
