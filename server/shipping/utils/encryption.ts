/**
 * Encryption Service
 * 
 * Provides AES-256-GCM encryption/decryption for sensitive data.
 * Uses environment variable ENCRYPTION_KEY (32 bytes for AES-256).
 */

import crypto from "crypto";
import { DomainError } from "@server/shared/domain-error";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

class EncryptionService {
  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable is required");
    }
    
    if (key.length === 64) {
      return Buffer.from(key, "hex");
    }
    
    return crypto.pbkdf2Sync(key, "shipping-provider-salt", 100000, KEY_LENGTH, "sha256");
  }

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag();
    
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const key = this.getEncryptionKey();
    const parts = ciphertext.split(":");
    
    if (parts.length !== 3) {
      throw new DomainError("Invalid ciphertext format");
    }
    
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }
}

export const encryptionService = new EncryptionService();