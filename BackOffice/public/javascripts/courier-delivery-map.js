document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("courierDeliveryMap");
  const dataElement = document.getElementById("courierDeliveryMapData");
  const statusBadge = document.getElementById("deliveryMapStatus");

  if (!mapElement || !dataElement || !statusBadge || typeof L === "undefined") {
    return;
  }

  let mapData = {
    customer: {},
    supermarket: {},
  };

  try {
    mapData = JSON.parse(dataElement.textContent || "{}");
  } catch (error) {
    mapData = { customer: {}, supermarket: {} };
  }

  const map = L.map(mapElement).setView([39.3999, -8.2245], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  function setBadge(text, type = "secondary") {
    statusBadge.className = `badge text-bg-${type}`;
    statusBadge.textContent = text;
  }

  async function geocodeAddress(query) {
    if (!query || !query.trim()) {
      return null;
    }

    const normalizedQuery = query.trim();

    const attempts = [normalizedQuery, `${normalizedQuery}, Portugal`];

    for (const attempt of attempts) {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(attempt)}&limit=1`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to geocode address");
      }

      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        continue;
      }

      const result = results[0];
      const lat = Number(result.lat);
      const lng = Number(result.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      return {
        lat,
        lng,
        label: result.display_name || attempt,
      };
    }

    return null;
  }

  async function loadMap() {
    try {
      setBadge("Searching addresses...", "info");

      const [customerPoint, supermarketPoint] = await Promise.all([
        geocodeAddress(mapData.customer?.address || ""),
        geocodeAddress(mapData.supermarket?.location || ""),
      ]);

      const bounds = [];

      if (supermarketPoint) {
        const supermarketMarker = L.marker([
          supermarketPoint.lat,
          supermarketPoint.lng,
        ]).addTo(map);
        supermarketMarker.bindPopup(`
          <div style="min-width: 180px;">
            <strong>Supermarket</strong><br>
            <span>${mapData.supermarket?.name || "-"}</span><br>
            <small>${supermarketPoint.label}</small>
          </div>
        `);
        bounds.push([supermarketPoint.lat, supermarketPoint.lng]);
      }

      if (customerPoint) {
        const customerMarker = L.marker([
          customerPoint.lat,
          customerPoint.lng,
        ]).addTo(map);
        customerMarker.bindPopup(`
          <div style="min-width: 180px;">
            <strong>Customer</strong><br>
            <span>${mapData.customer?.name || "-"}</span><br>
            <small>${customerPoint.label}</small>
          </div>
        `);
        bounds.push([customerPoint.lat, customerPoint.lng]);
      }

      if (supermarketPoint && customerPoint) {
        const routeLine = L.polyline(
          [
            [supermarketPoint.lat, supermarketPoint.lng],
            [customerPoint.lat, customerPoint.lng],
          ],
          {
            weight: 4,
            opacity: 0.8,
          },
        ).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
        setBadge("Pickup and destination loaded", "success");
        return;
      }

      if (customerPoint) {
        map.setView([customerPoint.lat, customerPoint.lng], 15);
        setBadge("Customer address loaded", "success");
        return;
      }

      if (supermarketPoint) {
        map.setView([supermarketPoint.lat, supermarketPoint.lng], 15);
        setBadge("Supermarket location loaded", "success");
        return;
      }

      setBadge("Unable to locate addresses on map", "warning");
    } catch (error) {
      console.error("[courier-delivery-map]", error);
      setBadge("Failed to load map", "danger");
    }
  }

  loadMap();
});
