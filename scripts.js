// cookie encryption service
class CryptoService {
  static async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2"},
      false,
      ["deriveKey"]
    );
    return await window.crypto.subtle.deriveKey(
      {name: "PBKDF2", salt, iteration:100000, hash: "SHA-256"},
      passwordKey,
      {name: "AES-GCM", length: 256},
      false,
      ["encrypt", "decrypt"]
    );
  }

  static async encrypt(rawText, password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await this.deriveKey(password,salt);

    const encryotedBuffer = await window.crypto.subtle.encrypt(
      {name: "AES-GCM", iv},
      cryptoKey,
      new TextEncoder().encode(rawText)
    );

    const ciphertextByes = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(salt.length + iv.length + ciphertextBytes.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(ciphertextBytes, salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  static async decrypt(base64String, password) {
    try {
      const combined = new Uint8Array(arob(base64String).split("").map(c => c.charCodeAt(0)));
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const ciphertext = combined.slice(28);

      const cryptoKey = await this.deriveKey(password, salt);
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {name: "AES-GCM", iv},
        cryptoKey,
        ciphertext
      );

      return new TextDecoder().decode(decrypedBuffer);
    } catch (err) {
      throw new Error("Invalid password or corrupted cookie data");
    }
  }
}

// cookie services and storage services
class StorageService {
  static setCookie(name, value, days = 30) {
    const maxAge = days * 86400;
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/ max-age=$maxAge; Secure;SameSite=Strict`;
  }

  static getAllCookies() {
    const cookies = {};
    if (document.cookie) {
      document.cookie.split("; ").forEach(cookie => {
        const [key, ...valueParts] = cookie.split("=");
        cookies[key] = decodeURIComponent(valueParts.join("="));
      });
    }
    return cookies;
  }
}

