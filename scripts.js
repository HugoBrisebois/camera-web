// variables for testing and debugging location data
const location1 = "montreal";

// api call functions
const base_url = "https://api.weatherapi.com/v1/";

async function FetchWeatherForecast(apiKey, location, URL) {
    try {
        const response = await fetch(`${URL}current.json?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(location)}&days=1&aqi=no&alerts=no`);
        if (!response.ok) {
            throw new Error(`HTTPS error. Status: ${response.status}`);
        }

        const data = await response.json();
        document.getElementById("location").textContent = location;
        document.getElementById("temperature").textContent = `${data.current.temp_c}°C`;
        document.getElementById("conditions").textContent = data.current.condition.text;
        return data;
    }
    catch (error) {
        console.error("fetch failed:", error);
        document.getElementById("weather-error").textContent = "Unable to load weather data.";
    }
}



// encryption functions
async function deriveKeyFromPassword(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // High iterations block brute-force cracking
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// function to encrypt text and save it to a combined Salt + IV + Ciphertext to a cookie
async function encryptAndSaveCookie(cookieName, rawText, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16)); // Unique salt
  const iv = window.crypto.getRandomValues(new Uint8Array(12));   // Unique IV
  
  const cryptoKey = await deriveKeyFromPassword(password, salt);
  const encoder = new TextEncoder();
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    encoder.encode(rawText)
  );

  const ciphertextBytes = new Uint8Array(encryptedBuffer);
  const combined = new Uint8Array(salt.length + iv.length + ciphertextBytes.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(ciphertextBytes, salt.length + iv.length);

  // Convert to clean Base64 string for cookie compliance
  const base64String = btoa(String.fromCharCode(...combined));
  
  // Set a secure cookie lasting 30 days
  document.cookie = `${encodeURIComponent(cookieName)}=${encodeURIComponent(base64String)}; path=/; max-age=2592000; Secure; SameSite=Strict`;
}

// decrypt function to read the cookies back into plain text using the password
async function getAndDecryptCookie(cookieName, password) {
  const matches = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(cookieName) + '=([^;]*)'));
  if (!matches) return null;

  try {
    // decode from base64 into a binary array
    const base64String = decodeURIComponent(matches[1]);
    const combined = new Uint8Array(atob(base64String).split("").map(c => c.charCodeAt(0)));

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);

    const cryptoKey = await deriveKeyFromPassword(password, salt);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    throw new Error("Invalid password or corrupted cookie data.");
  }
}


// app flowand ui control functions

let decryptedApiKey = null; 
const COOKIE_NAME = "encrypted_api_vault";

// Check cookie presence on page load to direct user to Setup vs Unlock
function checkVaultStatus() {
    const hasCookie = document.cookie.includes(COOKIE_NAME + "=");
    document.getElementById("setup-view").style.display = hasCookie ? "none" : "block";
    document.getElementById("unlock-view").style.display = hasCookie ? "block" : "none";
    document.getElementById("dashboard-view").style.display = "none";
}

async function handleSave() {
    const apiKey = document.getElementById("api-key").value;
    const password = document.getElementById("setup-password").value;
    const camera_body = document.getElementById("CameraBody").value;
    const camera_lens = document.getElementById("CameraLens").value;
    const msg = document.getElementById("setup-message");

    if (!apiKey || !password) {
        msg.className = "error";
        msg.innerText = "Please fill out both fields.";
        return;
    }

    try {
        await encryptAndSaveCookie(COOKIE_NAME, apiKey, password);
        // Put the key directly into volatile system memory for immediate use
        decryptedApiKey = apiKey; 
        
        document.getElementById("setup-password").value = "";
        document.getElementById("api-key").value = "";
        
        await showDashboard();
    } catch(e) {
        msg.className = "error";
        msg.innerText = "Encryption error occurred.";
    }
}

async function handleUnlock() {
    const password = document.getElementById("unlock-password").value;
    const msg = document.getElementById("unlock-message");

    try {
        // Attempt to decrypt the cookie string
        decryptedApiKey = await getAndDecryptCookie(COOKIE_NAME, password);
        
        if (decryptedApiKey) {
            document.getElementById("unlock-password").value = "";
            showDashboard();
        }
    } catch (err) {
        console.error("Decryption failed:", err);
        msg.className = "error";
        msg.innerText = "Incorrect Password. Try again.";
    }
}

async function showDashboard() {
    document.getElementById("setup-view").style.display = "none";
    document.getElementById("unlock-view").style.display = "none";
    document.getElementById("dashboard-view").style.display = "block";
    
    console.log("Your active API Key is ready for fetch requests:", decryptedApiKey);
    
    // call the fetchWeatherForecast function with the decrypted API key and location
    await FetchWeatherForecast(decryptedApiKey, location1, base_url); // Fetch weather data if API key is available
}

function handleLogOut() {
    // Completely clear the key from active browser memory
    decryptedApiKey = null; 
    document.getElementById("unlock-message").innerText = "";
    checkVaultStatus();
}

// functions for camera brand in a cookie 

function store_camera(camera) {
  // store the camera model and put it in a a cookie
  
} 




checkVaultStatus(); // Initialize the app state on page load


