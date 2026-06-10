const MASTER_KEY_LS_KEY = 'onerouter_master_key';

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function getCryptoKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined') {
    throw new Error('Web Crypto is only available in the browser.');
  }

  let rawKeyBase64 = localStorage.getItem(MASTER_KEY_LS_KEY);
  let rawKey: Uint8Array;

  if (!rawKeyBase64) {
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const exported = await window.crypto.subtle.exportKey('raw', key);
    rawKey = new Uint8Array(exported);
    localStorage.setItem(MASTER_KEY_LS_KEY, uint8ArrayToBase64(rawKey));
  } else {
    rawKey = base64ToUint8Array(rawKeyBase64);
  }

  return window.crypto.subtle.importKey(
    'raw',
    rawKey as any,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(text: string): Promise<string> {
  if (!text) return '';
  try {
    const key = await getCryptoKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      encoded as any
    );

    const encryptedBytes = new Uint8Array(encrypted);
    const ivBase64 = uint8ArrayToBase64(iv);
    const ciphertextBase64 = uint8ArrayToBase64(encryptedBytes);
    return `${ivBase64}:${ciphertextBase64}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
}

export async function decryptText(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';
  if (!encryptedText.includes(':')) return encryptedText; // default fallback if unencrypted
  try {
    const key = await getCryptoKey();
    const [ivBase64, ciphertextBase64] = encryptedText.split(':');
    const iv = base64ToUint8Array(ivBase64);
    const ciphertext = base64ToUint8Array(ciphertextBase64);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}
