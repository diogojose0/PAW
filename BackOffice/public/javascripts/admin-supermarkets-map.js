document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById("adminSupermarketsMap");
  const dataElement = document.getElementById("adminSupermarketsMapData");

  if (!mapElement || !dataElement || typeof L === "undefined") {
    return;
  }

  let supermarkets = [];

  try {
    supermarkets = JSON.parse(dataElement.textContent || "[]");
  } catch (err) {
    supermarkets = [];
  }

  if (!Array.isArray(supermarkets) || supermarkets.length === 0) {
    return;
  }

  const map = L.map(mapElement).setView([39.3999, -8.2245], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const bounds = [];

  supermarkets.forEach((supermarket) => {
    const lat = Number(supermarket.lat);
    const lng = Number(supermarket.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const marker = L.marker([lat, lng]).addTo(map);

    marker.bindPopup(`
      <div style="min-width: 180px;">
        <strong>${supermarket.name}</strong><br>
        <span>${supermarket.location || "-"}</span>
      </div>
    `);

    bounds.push([lat, lng]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 15);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, {
      padding: [30, 30],
    });
  }
});