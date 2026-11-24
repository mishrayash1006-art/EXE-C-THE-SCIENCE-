function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(passphrase: string, saltText: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(saltText),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSessionPayload(
  payload: Record<string, unknown>,
  uid: string
): Promise<{ algorithm: 'AES-256-GCM'; iv: string; ciphertext: string; checksum: string }> {
  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(JSON.stringify(payload));
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(`helios-vault-${uid}`, `salt-${uid}-2026`);
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    plaintextBytes
  );
  const hashBuf = await crypto.subtle.digest('SHA-256', plaintextBytes);
  const checksum = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    algorithm: 'AES-256-GCM',
    iv: bytesToBase64(ivBytes),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuf)),
    checksum,
  };
}

export async function decryptSessionPayload(
  ciphertextB64: string,
  ivB64: string,
  uid: string
): Promise<Record<string, unknown>> {
  const key = await deriveKey(`helios-vault-${uid}`, `salt-${uid}-2026`);
  const ivBytes = base64ToBytes(ivB64);
  const cipherBytes = base64ToBytes(ciphertextB64);
  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes as BufferSource },
    key,
    cipherBytes as BufferSource
  );
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuf)) as Record<string, unknown>;
}
