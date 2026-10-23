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

// api service

class ApiService {
  constructor(baseUrl= "https://api.weatherapi.com/v1/") {
    this.baseUrl = baseUrl;
  }

  async fetchWeather() {
    try {
      const url = `${this.baseUrl}current.json?key=${encodeURICompenent(apiKey)}&=${encodeURIComponent(location)}&aqi=no`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`https error. status: ${response.status}`);

      return await response.json();
    } catch (error) {
      console.error("Weather fetch failed", error);
      throw error;
    }
  }
}


// App manager
class AppManager {
  constructor() {
    this.cookieName = "encrypted_api_vault";
    this.devryptedapiKey = null;
    this.ApiService = new ApiService();
    this.testLocation = "montreal";
  }
  init() {
    this.checkVaultStatus();
  }
  checkVaultStatus() {
    if (this.decryptedApiKey) {
      this.switchView("dashboard-view");
      return;
    }
    
    const hasCookie = StorageService.getAllCookies(this.cookieName) !== null;
    this.switchView(hasCookie ? "unlock-view": "setup-view");
  }

  switchView(activeViewId) {
        const views = ["setup-view", "unlock-view", "dashboard-view", "camera-view"];
        views.forEach(viewId => {
            const element = document.getElementById(viewId);
            if (element) {
                element.style.display = (viewId === activeViewId) ? "block" : "none";
            }
        });
    }

  async handleSave() {
    const apiKey = document.getElementById("api-key").value;
    const password = document.getElementById("setup-password").value;
    const cameraBody = document.getElementById("CameraBody").value;
    const cameraLens = document.getElementById("CameraLens").value;
    const msg = document.getElementById("setup-message");

    if (!apiKey || !password) {
      msg.className = "error";
      msg.innerText = "Please fiil out both fields";
      return;
    }

    try {
      const encryptedKey = apiKey;
      StorageService.setCookie(this.cookieName, encryptedKey);
      StorageService.setCookie("CameraBody", cameraBody);
      StorageService.setCookie("CameraLens", cameraLens);

      this.decryptedApiKey = apiKey;
      document.getElementById("setup-password").value = "";
      document,getElementById("api-key").value = "";
      
      await this.loadDashboard(cameraBody, cameraLens);
    } catch (e) {
      msg.className = "error";
      msg.innerText = "Encryption error occurred";
    }
  }

  async handleUnlock() {
    const password = document.getElementById("unlock-password").value;
    const msg = document.getElementById("unlock-message");
    const encryptedCookie = StorageService.getAllCookies(this.cookieName);

    try {
      this.decryptedApiKey = await CryptoService.decrypt(encryptedCookie, password);
      document.getElementById("unlock-password").value = "";

      const cameraBody = StorageService.getAllCookies("CameraBody");
      const cameraLens = StorageService.getAllCookies("CameraLens");

      await this.loadDashboard(cameraBody, cameraLens);
    } catch (err) {
      msg.className = "error";
      msg.innerText = "incorrect password. try again";
    }
  }

  async loadDashboard(cameraBody, cameraLens) {
    this.switchView("dashboard-view");

    // fetch weather
    try {
      const data = await this.ApiService.fetchWeather(this.decryptedApiKey, this.testLocation);
      document.getElementById("location").textContent = this.testLocation;
      document.getElementById("temperature").textContent = `${data.current.temp_c}`;
      document.getElementById("conditions").textContent = data.current.codition.text;

      
    } catch (e) {
      document.getElementById("weather-error").textContent = "Unable to load weather data";
    }

    // render camera gear
    const cameraContainer = document.getElementById("Camera-equipement");
    if (cameraContainer) {
      cameraContainer.innerHTML = `
      <h3>Your Camera Equipement</h3>
      <p><strong>Camera Body:</strong> ${cameraBody ? cameraBody : 'Not set'}</p>
      <p><strong>Camera Lens:</strong> ${cameraLens ? cameraLens : 'Not set'}</p>
      `;
    }
  }

  handleLogOut() {
    this.decryptedApiKey = null;
    document.getElementById("unlock-message").innerText = "";
    this.checkVaultStatus();
  }
}

// initialization
const app = new AppManager();
document.addEventListener("DOMContentLoaded", () => app.init());