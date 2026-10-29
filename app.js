// Default location: Boca Raton, FL
const DEFAULT_PLACE = { name: "Boca Raton", latitude: 26.3683, longitude: -80.1289 };

// WMO weather codes -> label + emoji
const WEATHER = {
  0: ["Clear", "☀️"], 1: ["Mostly Clear", "🌤️"], 2: ["Partly Cloudy", "⛅"], 3: ["Cloudy", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Fog", "🌫️"],
  51: ["Light Drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy Drizzle", "🌧️"],
  56: ["Freezing Drizzle", "🌧️"], 57: ["Freezing Drizzle", "🌧️"],
  61: ["Light Rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy Rain", "🌧️"],
  66: ["Freezing Rain", "🌧️"], 67: ["Freezing Rain", "🌧️"],
  71: ["Light Snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy Snow", "❄️"], 77: ["Snow Grains", "🌨️"],
  80: ["Showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Heavy Showers", "⛈️"],
  85: ["Snow Showers", "🌨️"], 86: ["Snow Showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm", "⛈️"], 99: ["Thunderstorm", "⛈️"],
};
const describe = (code) => WEATHER[code] || ["Unknown", "🌡️"];

const $ = (id) => document.getElementById(id);
const round = (n) => Math.round(n);

async function loadWeather(place) {
  $("location").textContent = place.name;
  $("condition").textContent = "Loading…";

  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto",
    forecast_days: 7,
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(res.status);
    render(await res.json());
  } catch (err) {
    $("condition").textContent = "Couldn't load weather. Try again later.";
  }
}

function render(data) {
  const { current, hourly, daily } = data;

  $("temp").textContent = `${round(current.temperature_2m)}°`;
  $("condition").textContent = describe(current.weather_code)[0];
  $("hilo").textContent = `H:${round(daily.temperature_2m_max[0])}°  L:${round(daily.temperature_2m_min[0])}°`;
  $("feels").textContent = `${round(current.apparent_temperature)}°`;
  $("humidity").textContent = `${current.relative_humidity_2m}%`;
  $("wind").textContent = `${round(current.wind_speed_10m)} mph`;
  $("uv").textContent = round(daily.uv_index_max[0]);

  // Next 24 hours, starting from the current hour
  const start = Math.max(0, hourly.time.findIndex((t) => t >= current.time.slice(0, 13)));
  $("hourly").innerHTML = hourly.time.slice(start, start + 24).map((t, i) => {
    const idx = start + i;
    const hour = new Date(t).toLocaleTimeString([], { hour: "numeric" });
    return `<div class="hour">
      <small>${i === 0 ? "Now" : hour}</small>
      <span class="icon">${describe(hourly.weather_code[idx])[1]}</span>
      <span>${round(hourly.temperature_2m[idx])}°</span>
    </div>`;
  }).join("");

  // 7-day list with temperature range bars
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const span = weekMax - weekMin || 1;
  $("daily").innerHTML = daily.time.map((d, i) => {
    const day = i === 0 ? "Today" : new Date(`${d}T00:00`).toLocaleDateString([], { weekday: "short" });
    const lo = daily.temperature_2m_min[i];
    const hi = daily.temperature_2m_max[i];
    const left = ((lo - weekMin) / span) * 100;
    const width = ((hi - lo) / span) * 100;
    return `<li>
      <span>${day}</span>
      <span class="icon">${describe(daily.weather_code[i])[1]}</span>
      <span class="range">
        <span class="lo">${round(lo)}°</span>
        <span class="bar"><i style="left:${left}%;width:${width}%"></i></span>
        <span class="hi">${round(hi)}°</span>
      </span>
    </li>`;
  }).join("");
}

// City search via Open-Meteo geocoding
const input = $("search-input");
const results = $("results");
let debounce;

input.addEventListener("input", () => {
  clearTimeout(debounce);
  const q = input.value.trim();
  if (q.length < 2) { results.hidden = true; return; }
  debounce = setTimeout(() => searchCities(q), 300);
});

async function searchCities(q) {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5`);
    const { results: places = [] } = await res.json();
    results.innerHTML = "";
    places.forEach((p) => {
      const li = document.createElement("li");
      li.tabIndex = 0;
      const region = [p.admin1, p.country].filter(Boolean).join(", ");
      li.innerHTML = `${p.name} <small>${region}</small>`;
      li.addEventListener("click", () => choose(p));
      li.addEventListener("keydown", (e) => { if (e.key === "Enter") choose(p); });
      results.appendChild(li);
    });
    results.hidden = places.length === 0;
  } catch {
    results.hidden = true;
  }
}

function choose(place) {
  input.value = "";
  results.hidden = true;
  loadWeather(place);
}

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const first = results.querySelector("li");
  if (first) first.click();
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) results.hidden = true;
});

loadWeather(DEFAULT_PLACE);
