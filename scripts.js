// crypto service
class CryptoService {
    static async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordKey = await window.crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        return await window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
            passwordKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    static async encrypt(rawText, password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const cryptoKey = await this.deriveKey(password, salt);
        
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            cryptoKey,
            new TextEncoder().encode(rawText)
        );

        const ciphertextBytes = new Uint8Array(encryptedBuffer);
        const combined = new Uint8Array(salt.length + iv.length + ciphertextBytes.length);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(ciphertextBytes, salt.length + iv.length);

        return btoa(String.fromCharCode(...combined));
    }

    static async decrypt(base64String, password) {
        try {
            const combined = new Uint8Array(atob(base64String).split("").map(c => c.charCodeAt(0)));
            const salt = combined.slice(0, 16);
            const iv = combined.slice(16, 28);
            const ciphertext = combined.slice(28);

            const cryptoKey = await this.deriveKey(password, salt);
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                cryptoKey,
                ciphertext
            );

            return new TextDecoder().decode(decryptedBuffer);
        } catch (err) {
            throw new Error("Invalid password or corrupted cookie data.");
        }
    }
}

// storage service
class StorageService {
    static setCookie(name, value, days = 30) {
        const maxAge = days * 86400;
        document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; Secure; SameSite=Strict`;
    }

    static getCookie(name) {
        const matches = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)'));
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    // Helper to store objects/arrays easily as JSON
    static setJSONCookie(name, obj, days = 30) {
        this.setCookie(name, JSON.stringify(obj), days);
    }

    // Helper to retrieve objects/arrays
    static getJSONCookie(name) {
        const value = this.getCookie(name);
        try {
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error("Failed to parse JSON cookie:", e);
            return null;
        }
    }
}

// api service
class ApiService {
    constructor(baseUrl = "https://api.weatherapi.com/v1/") {
        this.baseUrl = baseUrl;
    }

    async fetchWeather(apiKey, location) {
        const url = `${this.baseUrl}current.json?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(location)}&aqi=no`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error. Status: ${response.status}`);
        return await response.json();
    }
}

// app manager
class AppManager {
    constructor() {
        this.cookieName = "encrypted_api_vault";
        this.gearCookieName = "camera_equipment_list";
        this.decryptedApiKey = null;
        this.apiService = new ApiService();

        // load saved location from cookies or default to montreal
        this.currentLocation = StorageService.getCookie(this.locationCookieName) || "montreal";
        this.equipmentList = [];
        this.editingIndex = null;
    }

    // handle changing for weather location updates
    async handleLocationUpdate() {
        const input = document.getElementById("location-input");
        const newLocation = input.value.trim();
        const errorEL = document.getElementById("weather-error");

        if (!newLocation) {
            errorEL.textContent = "Please enter a valid city name";
            return;
        }

        errorEL.textContent = "";
        this.currentLocation = newLocation;
        StorageService.setCookie(this.locationCookieName, newLocation);

        input.value = "";
        await this.fetchAndDisplayWeather();

    }

    async fetchAndDisplayWeather() {
        const errorEl = document.getElementById("weather-error");
        errorEl.textContent = "";

        try {
            const data = await this.apiService.fetchWeather(this.decryptedApiKey, this.currentLocation);
            document.getElementById("location").textContent = data.location.name + ", " + data.location.country;
            document.getElementById("temperature").textContent = `${data.current.temp_c}C`;
            document.getElementById("conditions").textContent = data.current.condition.text;
        } catch (e) {
            console.error("weather fetch failed:", e);
            errorEl.textContent = `unable to load weather data for "${this.currentLocation}"`;
            document.getElementById("location").textContent = "N/A";
            document.getElementById("temperature").textContent = "N/A";
            document.getElementById("conditions").textContent = "N/A";
        }
    }

    init() {
        console.log("App initializing...");
        this.setupEventListeners();
        this.loadStoredEquipment();
        this.checkVaultStatus();
    }

    loadStoredEquipment() {
        // Load existing gear array from cookies if available
        this.equipmentList = StorageService.getJSONCookie(this.gearCookieName) || [];
    }

    setupEventListeners() {
        // Navigation links
        document.getElementById("nav-home")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.switchView(this.decryptedApiKey ? "dashboard-view" : "unlock-view");
        });

        document.getElementById("nav-camera")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.switchView("camera-view");
            this.renderEquipmentManagementView();
        });

        // Form buttons
        document.getElementById("save-btn")?.addEventListener("click", () => this.handleSave());
        document.getElementById("unlock-btn")?.addEventListener("click", () => this.handleUnlock());
        document.getElementById("add-gear-btn")?.addEventListener("click", () => this.handleAddOrUpdateGear());

        // listen for weather location updates
        document.getElementById("update-location-btn")?.addEventListener("click", () => this.handleLocationUpdate());
    }

    checkVaultStatus() {
        const cookieValue = StorageService.getCookie(this.cookieName);
        if (cookieValue) {
            this.switchView("unlock-view");
        } else {
            this.switchView("setup-view");
        }
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
            msg.innerText = "Please fill out both fields.";
            return;
        }

        try {
            const encryptedKey = await CryptoService.encrypt(apiKey, password);
            StorageService.setCookie(this.cookieName, encryptedKey);

            // Add initial gear if provided
            if (cameraBody || cameraLens) {
                this.equipmentList.push({ body: cameraBody || "Not set", lens: cameraLens || "Not set" });
                StorageService.setJSONCookie(this.gearCookieName, this.equipmentList);
            }

            this.decryptedApiKey = apiKey;
            await this.loadDashboard();
        } catch (e) {
            console.error(e);
            msg.className = "error";
            msg.innerText = "Encryption error occurred.";
        }
    }

    async handleUnlock() {
        const password = document.getElementById("unlock-password").value;
        const msg = document.getElementById("unlock-message");
        const encryptedCookie = StorageService.getCookie(this.cookieName);

        try {
            this.decryptedApiKey = await CryptoService.decrypt(encryptedCookie, password);
            await this.loadDashboard();
        } catch (err) {
            msg.className = "error";
            msg.innerText = "Incorrect Password. Try again.";
        }
    }

    handleAddOrUpdateGear() {
        const bodyInput = document.getElementById("new-camera-body");
        const lensInput = document.getElementById("new-camera-lens");
        const msg = document.getElementById("gear-message");
        const actionBtn = document.getElementById("add-gear-btn");

        const body = bodyInput.value.trim();
        const lens = lensInput.value.trim();

        if (!body && !lens) {
            msg.className = "error";
            msg.innerText = "Please enter at least a camera body or lens.";
            return;
        }

        if (this.editingIndex !== null) {
            // update existing equipement entry
            this.equipmentList[this.editingIndex] = {
                body: body || "Not specified",
                lens: lens || "Not Specified"
            };
            this.editingindex = null;
            actionBtn.textContent = "add equipment";
            msg.innerText = " Equipment updated successfully";
        } else {
            // add brand new equipment entry
            this.equipmentList.push({
                body: body || "Not Specified",
                lens: lens || "Not Specified"
            });
            msg.innerText = "equipment added successfully";
        }

        // save changes to storage
        StorageService.setJSONCookie(this.gearCookieName, this.equipmentList);

        // Clear inputs and refresh view
        bodyInput.value = "";
        lensInput.value = "";
        msg.className = "";
        msg.innerText = "Equipment added successfully!";
        
        this.renderEquipmentManagementView();
        this.loadDashboard();
    }

    // load item data into inputs to edit
    startEdit(index) {
        const item = this.equipmentList[index];
        document.getElementById("new-camera-body").value = item.body;
        document.getElementById("new-camera-lens").value = item.lens;

        this.editingIndex = index;
        document.getElementById("add-gear-btn").textContent = "Upadte equipment";

        // scroll smoothly back up to the form inputs
        document.getElementById("new-camera-body").focus();
    }

    // delete item from list
    deleteGear(index) {
        this.equipmentList.splice(index, 1);
        StorageService.setJSONCookie(this.gearCookieName, this.equipmentList);

        // if the user is actively editing the deleted item reset the form
        if (this.editingIdex === index) {
            this.editingIndex = null;
            document.getElementById("new-camra-body").value = "";
            document.getElementById("new-camera-lens").value = "";
            document.getElementById("add-gear-btn").textContent = "Add Equipement";
        }

        this.renderEquipmentManagementView();
        this.loadDashboard();
    }

    renderEquipmentManagementView() {
        const container = document.getElementById("full-gear-list");
        if (!container) return;

        if (this.equipmentList.length === 0) {
            container.innerHTML = "<p>No equipment stored yet.</p>";
            return;
        }

        let html = "<h4>Your Equipment Inventory:</h4><ul style='list-style: none; padding: 0;'>";
        this.equipmentList.forEach((item, index) => {
            html += `
                <li style="background: white; margin-bottom: 10px; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Body:</strong> ${item.body} <br>
                        <strong>Lens:</strong> ${item.lens}
                    </div>
                    <div>
                        <button onclick="window.app.startEdit(${index})" style="padding: 5px 10px; margin-right: 5px; cursor: pointer;">Edit</button>
                        <button onclick="window.app.deleteGear(${index})" style="padding: 5px 10px; background-color: #b30000; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button>
                    </div>
                </li>`;
        });
        html += "</ul>";
        container.innerHTML = html;
    }

    async loadDashboard() {
        this.switchView("dashboard-view");

        // Fetch Weather
        await this.fetchAndDisplayWeather();

        // Render Equipment summary on Dashboard
        const cameraContainer = document.getElementById("Camera-equipment");
        if (cameraContainer) {
            if (this.equipmentList.length === 0) {
                cameraContainer.innerHTML = "<h3>Your Camera Equipment</h3><p>No equipment added yet.</p>";
                return;
            }

            let gearHtml = "<h3>Your Camera Equipment</h3><ul>";
            this.equipmentList.forEach(item => {
                gearHtml += `<li><strong>Body:</strong> ${item.body} — <strong>Lens:</strong> ${item.lens}</li>`;
            });
            gearHtml += "</ul>";
            cameraContainer.innerHTML = gearHtml;
        }
    }
}

// initialization
window.app = new AppManager();
document.addEventListener("DOMContentLoaded", () => {
    window.app.init();
});