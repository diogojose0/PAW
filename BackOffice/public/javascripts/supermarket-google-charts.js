document.addEventListener("DOMContentLoaded", () => {
  const ordersChartElement = document.getElementById("supermarketOrdersStatusChart");
  const topProductsChartElement = document.getElementById("supermarketTopProductsChart");
  const ordersDataElement = document.getElementById("supermarketOrdersByStatusData");
  const topProductsDataElement = document.getElementById("supermarketTopProductsData");

  if (
    !ordersChartElement ||
    !topProductsChartElement ||
    !ordersDataElement ||
    !topProductsDataElement ||
    typeof google === "undefined"
  ) {
    return;
  }

  let ordersByStatus = {};
  let topProducts = [];

  try {
    ordersByStatus = JSON.parse(ordersDataElement.textContent || "{}");
    topProducts = JSON.parse(topProductsDataElement.textContent || "[]");
  } catch (error) {
    console.error("[supermarket-google-charts] Failed to parse chart data:", error);
    return;
  }

  google.charts.load("current", { packages: ["corechart"] });
  google.charts.setOnLoadCallback(drawCharts);

  function drawCharts() {
    drawOrdersByStatusChart();
    drawTopProductsChart();
  }

  function drawOrdersByStatusChart() {
    const data = google.visualization.arrayToDataTable([
      ["Status", "Orders"],
      ["Pending", Number(ordersByStatus.pending || 0)],
      ["Confirmed", Number(ordersByStatus.confirmed || 0)],
      ["Preparing", Number(ordersByStatus.preparing || 0)],
      ["Delivering", Number(ordersByStatus.delivering || 0)],
      ["Delivered", Number(ordersByStatus.delivered || 0)],
      ["Cancelled", Number(ordersByStatus.cancelled || 0)],
    ]);

    const options = {
      legend: { position: "none" },
      chartArea: {
        width: "75%",
        height: "75%",
      },
      hAxis: {
        minValue: 0,
      },
    };

    const chart = new google.visualization.ColumnChart(ordersChartElement);
    chart.draw(data, options);
  }

  function drawTopProductsChart() {
    const rows = [["Product", "Units Sold"]];

    if (Array.isArray(topProducts) && topProducts.length > 0) {
      topProducts.forEach((product) => {
        rows.push([product.name, Number(product.quantitySold || 0)]);
      });
    } else {
      rows.push(["No sales yet", 0]);
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

    const chart = new google.visualization.BarChart(topProductsChartElement);
    chart.draw(data, options);
  }

  window.addEventListener("resize", drawCharts);
});