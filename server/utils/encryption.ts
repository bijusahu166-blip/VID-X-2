import crypto from 'crypto';

// Generate a random encryption key
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Encrypt message content
export const encryptMessage = (content: string, key: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

// Decrypt message content
export const decryptMessage = (encryptedContent: string, key: string): string => {
  const parts = encryptedContent.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  const decipher = crypto.createDecipher('aes-256-cbc', key);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Hash content for integrity checks
export const hashContent = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

// Verify content integrity
export const verifyContentIntegrity = (content: string, expectedHash: string): boolean => {
  const actualHash = hashContent(content);
  return crypto.timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  );
};