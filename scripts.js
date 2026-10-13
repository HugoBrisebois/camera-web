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

if (savedApiKey = readCookie("weatherAPIKEY")) {
    FetchWeatherForecast(savedApiKey, location1, base_url);
}
else {
    console.error("No API key found in cookies.");
    const ApiKey = prompt("please enter your api key: "); 
    setCookie("weatherAPIKEY", ApiKey);
}