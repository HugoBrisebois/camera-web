const base_url = "https://api.weatherapi.com/v1/"

async function FetchWeatherForecast(apiKey, location, URL) {
    try {
        // send a request to weatherAPI
        const response = await fetch(`${URL}current.json?key=${apiKey}&q=${location}&days=1&aqi=no&alerts=no/`);
        
        // check if reponse is successful
        if (!response.ok) {
            throw new Error(`HTTPS error. Status: ${respone.status}`);
        }

        // parse the stream fo data returned from the json call
        const data = await response.json();
        console.log(data);

        // get elements from the parsed json to display tempaerature
        const tempObject = data.current;
        const temperature = data.current.temp_c; // gets temperature in celcius
        const conditionText = data.current.condition.text; // gets conditions like sunny, cloudy and more
        
        document.getElementById("weather").textContent = `conditions: 
        temperature: ${temperature}C
        weather: ${conditionText}
        location: ${location} `;
        
        return data;
    }
    catch (error) {
        // handle errors
        console.error("fetch failed:", error);
    }
}

ApiKey = "";
location1 = "montreal";


FetchWeatherForecast(ApiKey, location1, base_url);
