document.addEventListener("DOMContentLoaded", () => {
  const statusChartElement = document.getElementById("courierDeliveriesStatusChart");
  const topSupermarketsChartElement = document.getElementById("courierTopSupermarketsChart");
  const statusesDataElement = document.getElementById("courierStatusesData");
  const topSupermarketsDataElement = document.getElementById("courierTopSupermarketsData");

  if (
    !statusChartElement ||
    !topSupermarketsChartElement ||
    !statusesDataElement ||
    !topSupermarketsDataElement ||
    typeof google === "undefined"
  ) {
    return;
  }

  let statusesData = {};
  let topSupermarketsData = [];

  try {
    statusesData = JSON.parse(statusesDataElement.textContent || "{}");
    topSupermarketsData = JSON.parse(topSupermarketsDataElement.textContent || "[]");
  } catch (error) {
    console.error("[courier-google-charts] Failed to parse chart data:", error);
    return;
  }

  google.charts.load("current", { packages: ["corechart"] });
  google.charts.setOnLoadCallback(drawCharts);

  function drawCharts() {
    drawStatusesChart();
    drawTopSupermarketsChart();
  }

  function drawStatusesChart() {
    const data = google.visualization.arrayToDataTable([
      ["Status", "Deliveries"],
      ["Accepted", Number(statusesData.accepted || 0)],
      ["Picked Up", Number(statusesData.picked_up || 0)],
      ["Delivered", Number(statusesData.delivered || 0)],
      ["Available", Number(statusesData.available || 0)],
    ]);

    const options = {
      pieHole: 0.45,
      chartArea: {
        width: "90%",
        height: "80%",
      },
      legend: {
        position: "bottom",
      },
    };

    const chart = new google.visualization.PieChart(statusChartElement);
    chart.draw(data, options);
  }

  function drawTopSupermarketsChart() {
    const rows = [["Supermarket", "Deliveries"]];

    if (Array.isArray(topSupermarketsData) && topSupermarketsData.length > 0) {
      topSupermarketsData.forEach((item) => {
        rows.push([item.supermarketName, Number(item.deliveries || 0)]);
      });
    } else {
      rows.push(["No deliveries yet", 0]);
    }

    const data = google.visualization.arrayToDataTable(rows);

    const options = {
      legend: { position: "none" },
      chartArea: {
        width: "70%",
        height: "75%",
      },
      hAxis: {
        minValue: 0,
      },
    };

    const chart = new google.visualization.BarChart(topSupermarketsChartElement);
    chart.draw(data, options);
  }

  window.addEventListener("resize", drawCharts);
});