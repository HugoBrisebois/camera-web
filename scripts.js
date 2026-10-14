

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

const location1 = "montreal";



// cookie functions
function setCookie(name, apiKey) {
    let apiKeyCookie = `${name}=${encodeURIComponent(apiKey)}; path=/; max-age=31536000`; // 1 year
    document.cookie = apiKeyCookie;
    console.log(`Cookie set: ${apiKeyCookie}`);
}

function readCookie(name)  {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [cookieName, cookieValue] = cookie.trim().split('=');
        if (cookieName === name) {
            console.log(`Cookie read: ${cookieName}=${cookieValue}`);
            return decodeURIComponent(cookieValue);
        }
    }
    return null;
}


// fetching cookies
if (savedApiKey = readCookie("weatherAPIKEY")) {
    FetchWeatherForecast(savedApiKey, location1, base_url);
}
else {
    console.error("No API key found in cookies.");
    const ApiKey = prompt("please enter your api key: "); 
    setCookie("weatherAPIKEY", ApiKey);
}