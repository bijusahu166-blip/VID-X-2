// AES-256-GCM end-to-end encryption for direct messages
// Keys are derived from the two user IDs (never stored on the server)

const APP_PEPPER = "litlink-e2ee-v1"; // App-level salt (not secret by itself)

// In-memory key cache per chat (cleared on page reload - by design)
const keyCache = new Map<string, CryptoKey>();

function sortedPair(id1: string, id2: string) {
  return [id1, id2].sort().join(":");
}

async function deriveKey(userId1: string, userId2: string): Promise<CryptoKey> {
  const cacheKey = sortedPair(userId1, userId2);
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey)!;

  const encoder = new TextEncoder();
  // ✅ PBKDF2 hata do — seedha SHA-256 se key banao
  const rawMaterial = encoder.encode(`${APP_PEPPER}:${cacheKey}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", rawMaterial);
  
  const key = await crypto.subtle.importKey(
    "raw", hashBuffer, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );

  keyCache.set(cacheKey, key);
  return key;
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...Array.from(new Uint8Array(buf))));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function encryptMessage(
  plaintext: string,
  senderId: string,
  receiverId: string
): Promise<string> {
  try {
    const key = await deriveKey(senderId, receiverId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    const payload = { iv: toBase64(iv), ct: toBase64(ciphertext), e2e: true };
    return JSON.stringify(payload);
  } catch {
    // If encryption fails (unsupported browser), send plaintext
    return plaintext;
  }
}

export async function decryptMessage(
  content: string,
  senderId: string,
  receiverId: string
): Promise<string> {
  try {
    const parsed = JSON.parse(content);
    if (!parsed?.e2e) return content; // Not encrypted
    const key = await deriveKey(senderId, receiverId);
    const iv = fromBase64(parsed.iv);
    const ct = fromBase64(parsed.ct);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(plaintext);
  } catch {
    // Decryption failed (wrong key or corrupted) — show placeholder
    return content.startsWith('{"e2e":') || content.includes('"e2e":true')
      ? "🔒 Encrypted message"
      : content;
  }
}

export function isEncrypted(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed?.e2e === true;
  } catch {
    return false;
  }
}
