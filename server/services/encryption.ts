import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Cached encryption key to ensure consistency across encrypt/decrypt operations
let cachedKey: Buffer | null = null;

/**
 * Generate encryption key from environment secret or create stable session key
 * CRITICAL: The key must be consistent across encrypt/decrypt operations
 */
function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const keyString = process.env.ENCRYPTION_KEY;
  
  if (!keyString) {
    // Generate and cache a stable session key for development
    // PRODUCTION: Set ENCRYPTION_KEY environment variable to a 64-character hex string
    console.warn('WARNING: ENCRYPTION_KEY not set. Generating session key. Data will be lost on restart!');
    console.warn('For production, generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    cachedKey = crypto.randomBytes(KEY_LENGTH);
    return cachedKey;
  }
  
  // Parse and validate the hex key
  cachedKey = Buffer.from(keyString, "hex");
  
  if (cachedKey.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${cachedKey.length} bytes`);
  }
  
  return cachedKey;
}

/**
 * Encrypt sensitive data (transcripts, PII)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + encrypted + authTag
  return iv.toString("hex") + ":" + encrypted + ":" + authTag.toString("hex");
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Hash sensitive data for storage (one-way)
 */
export function hashData(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Securely compare hashed values
 */
export function secureCompare(a: string, b: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
