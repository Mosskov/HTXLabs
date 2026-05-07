/**
 * SHA-256 helper for the light cheat-resistance layer (§15 of spec).
 * Used to compare student input against a stored hash without leaking
 * the plaintext correct answer in the JS bundle.
 */
export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function normaliseAnswer(text: string): string {
  return text.trim().toLowerCase().normalize('NFKC');
}
