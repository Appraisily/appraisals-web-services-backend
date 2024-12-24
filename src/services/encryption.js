const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.encryptionKey = null;
  }

  initialize(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid encryption key');
    }
    // Convert the base64 key to buffer
    this.encryptionKey = Buffer.from(key, 'base64');
  }

  encrypt(text) {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized');
    }

    // Generate a random IV
    const iv = crypto.randomBytes(12);
    
    // Create cipher
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      iv
    );

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get the auth tag
    const authTag = cipher.getAuthTag();

    // Return everything needed for decryption
    return {
      encrypted: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }

  decrypt(encryptedData) {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized');
    }

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(encryptedData.iv, 'base64')
      );

      // Set auth tag
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));

      // Decrypt
      let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }
}

module.exports = new EncryptionService();