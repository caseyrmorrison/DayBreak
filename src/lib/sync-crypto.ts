import { gcm } from "@noble/ciphers/aes.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

// The pairing code is both identity and key. From one 160-bit random
// code we derive, with domain separation:
//   - syncId  (safe to send to the server; names the blob)
//   - syncKey (never leaves the device; AES-256-GCM key)
// The server only ever sees syncId + ciphertext, so it cannot read
// the data and cannot recover the code from the id.
//
// noble (pure JS) is used instead of WebCrypto's subtle API because
// subtle is unavailable in insecure contexts — and syncing from a
// phone to http://<your-mac>.local over the LAN is a primary use case.

// Crockford base32: no I, L, O, U — unambiguous to read aloud or type.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 32;

export function generateSyncCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += ALPHABET[byte & 31];
  return code;
}

export function normalizeSyncCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const ch of cleaned) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return cleaned;
}

export function formatSyncCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function deriveSyncId(code: string): string {
  return bytesToHex(sha256(utf8(`daybreak:sync-id:v1:${code}`)));
}

export function deriveSyncKey(code: string): Uint8Array {
  return sha256(utf8(`daybreak:sync-key:v1:${code}`));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function encryptState(key: Uint8Array, value: unknown): string {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = gcm(key, iv).encrypt(utf8(JSON.stringify(value)));
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv);
  packed.set(ciphertext, iv.length);
  return toBase64(packed);
}

// Throws on tampering or a wrong key (GCM authentication failure).
export function decryptState(key: Uint8Array, encoded: string): unknown {
  const packed = fromBase64(encoded);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const plaintext = gcm(key, iv).decrypt(ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
