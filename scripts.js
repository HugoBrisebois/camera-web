// variables for testing and debugging location data
const location1 = "montreal";

// encryption functions
async function deriveKeyFromPassword(password, salt){
    const encoder = new TextEncoder();
    const passwordkey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        {
            name: "PBKDF2",
        },
        false,
        ["deriveKey"]
    );
    return await window.crypto.subtle.deriveKey (
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        {name: "AES-GCM", length: 256},
        false,
        ["encrypt", "decrypt"]
    );
}

// function to encrypt text and save it to a combined Salt + IV +Ciphertext to a cookie
async function encryptAndSaveCookie(cookieName, rawText, password) {
    const salt = window.crypto.getRandomValues(new Unint8Array(16)); //unique salt
    const iv = window.crypto.getRandomValues(new Unint8Array(12)); // unique IV

    const cryptoKay = await deriveKeyFromPassword(password, salt);
    const encoder = new TextEncoder();
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        {name: "AES-GCM", iv: iv},
        cryptoKey,
        encoder(rawText)
    );

    const ciphertextBytes = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(salt.length + iv.length + ciphertextBytes.length);

    // Convert to clean base64 string for cookies compliance
    const base64string = btoa(String.fromCharCode(...combined));

    // set a secure cookie lasting 30 days
    document.cookie = `${encodeURIComponent(cookieName)} =${encodeURIComponent(base64String)}; path=/; max-age=2592000; Secure; SameSite=strict`;   
}

// decrypt function to read the cookies back into plain text using the password
async function getAndDecryptCookie(cookieName, password) {
    const matches = document.cookie.match(new RegExp('(?:^|; )' + encodeURI(cookieName) + '=([^;]*)'));
    if (!matches) return null;

    try {
        const base64String = decodeURIComponent(matches[1]);
        const combined = new Uint8Array(atob(base64String).split("").map(c => c.charCodeAt(0)));

        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const ciphertext = combined.slice(28);

        const cryptoKey = await deriveKeyFromPassword(password, salt);
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {name: "AES-GCM", iv: iv},
            cryptoKey,
            ciphertext
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
        throw new Error("invalid password or corrupted cookie data");
    }
}


// app flowand ui control functions

let decrytedApiKey = null;
const COOKIE_NAME = "encrypted_api_vault";

// check cookie presence on page load
function checkVaultStatus() {
    const hasCookie = document.cookie.includes(Cookie_NAME + '=');
    document.getElementById("setup-view").style.displat = hasCookie ? "none" : "block";
    document.getElementById("unlock-view").style.display = hasCookie ? "block" : "none";
    document.getElementById("dashboard-view").style.display = "none";
}


async function handleSave() {
    const apiKey = document.getElementById("api-key").value;
    const password = document.getElementById("setup-password").value;
    const msg = document.getElementById("setup-message");

    if (!apiKey || !password) {
        msg.classNAme = "error";
        msg.innerText = "Please fill out both fields";
        return;
    }

    try {
        await encryptAndSaveCookie(COOKIE_NAME, apiKey, password);
        // put the key inte a volatie system memory for immediate use
        decryptApiKey = apiKey;

        document.getElementById("setup-password").value = "";
        ducument.getElementById("api-key").value = "";

        showDashboard();
    } catch (e) {
        msg.className = "error";
        msg.innerText = "Encryption error occurded";
    }
}


async function handleUnlock() {
    const password = document.getElementById("unlock-password").value;
    const msg = document.getElementById("unlock-message");

    try {
        // attempt to decrypt the cookie string
        decryptApiKey = await getAndDecryptCookie(COOKIE_NAME, password );

        if (decryptApiKey) {
            document.getElementById("unlock-password").value = "";
            showDashboard();
        }
    } catch (err) {
        msg.className = "error";
        msg.innerText = "Incorrect password. try again";
    }
}


function showDashboard() {
    document.getElementById("setup-view").style.display = "none";
    document.getElementById("unlock-view").style.display = "none";
    document.getElementById("dashboard-view").style.display = "block";

    console.log("Your active api key is ready for fetch requests: " , decryptedApiKey);

    // TODO: call api fetch function here with decryptedApiKey variable
}

function handleLogout() {
    // clear the keys and cookies completey
    decryptedApiKey = null;
    document.getElementById("unlock-message").innerText = "";
    checkVaultStatus();
}

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



