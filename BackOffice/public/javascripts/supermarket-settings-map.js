document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("supermarketSettingsMap");
  const searchButton = document.getElementById("geocodeLocationBtn");
  const locationInput = document.getElementById("locationInput");
  const latInput = document.getElementById("coordinatesLat");
  const lngInput = document.getElementById("coordinatesLng");
  const statusBadge = document.getElementById("mapStatusBadge");
  const mapDataElement = document.getElementById("supermarketMapData");

  if (
    !mapElement ||
    !searchButton ||
    !locationInput ||
    !latInput ||
    !lngInput ||
    !statusBadge ||
    !mapDataElement ||
    typeof L === "undefined"
  ) {
    return;
  }

  let initialData = {};

  try {
    initialData = JSON.parse(mapDataElement.textContent || "{}");
  } catch (err) {
    initialData = {};
  }

  const initialLat = Number(initialData.lat);
  const initialLng = Number(initialData.lng);

  const hasInitialCoordinates =
    Number.isFinite(initialLat) && Number.isFinite(initialLng);

  const defaultCenter = hasInitialCoordinates
    ? [initialLat, initialLng]
    : [39.3999, -8.2245];

  const defaultZoom = hasInitialCoordinates ? 15 : 6;

  const map = L.map(mapElement).setView(defaultCenter, defaultZoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  let marker = null;

  function setBadge(text, type = "secondary") {
    statusBadge.className = `badge text-bg-${type}`;
    statusBadge.textContent = text;
  }

  function updateCoordinateInputs(lat, lng) {
    latInput.value = Number(lat).toFixed(6);
    lngInput.value = Number(lng).toFixed(6);
  }

  function placeMarker(lat, lng, popupText = "Selected location") {
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);

      marker.on("dragend", (event) => {
        const position = event.target.getLatLng();
        updateCoordinateInputs(position.lat, position.lng);
        setBadge("Coordinates selected", "success");
      });
    } else {
      marker.setLatLng([lat, lng]);
    }

    marker.bindPopup(popupText).openPopup();
  }

  if (hasInitialCoordinates) {
    placeMarker(initialLat, initialLng, initialData.location || "Current supermarket location");
    setBadge("Coordinates loaded", "success");
  } else {
    setBadge("No coordinates yet", "warning");
  }

  map.on("click", (event) => {
    const { lat, lng } = event.latlng;
    updateCoordinateInputs(lat, lng);
    placeMarker(lat, lng);
    setBadge("Coordinates selected", "success");
  });

  locationInput.addEventListener("input", () => {
    if (latInput.value && lngInput.value) {
      setBadge("Address changed - review map", "warning");
    } else {
      setBadge("Search the address on the map", "secondary");
    }
  });

  searchButton.addEventListener("click", async () => {
    const query = locationInput.value.trim();

    if (!query) {
      setBadge("Write an address first", "danger");
      return;
    }

    const originalText = searchButton.textContent;
    searchButton.disabled = true;
    searchButton.textContent = "Searching...";

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to search location");
      }

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        setBadge("Address not found", "danger");
        return;
      }

      const result = results[0];
      const lat = Number(result.lat);
      const lng = Number(result.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Invalid coordinates returned");
      }

      map.setView([lat, lng], 16);
      updateCoordinateInputs(lat, lng);
      placeMarker(lat, lng, result.display_name || query);
      setBadge("Coordinates found", "success");
    } catch (error) {
      setBadge("Unable to search address", "danger");
      console.error("[supermarket-settings-map]", error);
    } finally {
      searchButton.disabled = false;
      searchButton.textContent = originalText;
    }
  });
});