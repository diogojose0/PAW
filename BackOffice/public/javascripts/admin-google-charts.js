document.addEventListener("DOMContentLoaded", () => {
  const usersChartElement = document.getElementById("adminUsersRoleChart");
  const ordersChartElement = document.getElementById("adminOrdersStatusChart");
  const usersDataElement = document.getElementById("adminUsersByRoleData");
  const ordersDataElement = document.getElementById("adminOrdersByStatusData");

  if (
    !usersChartElement ||
    !ordersChartElement ||
    !usersDataElement ||
    !ordersDataElement ||
    typeof google === "undefined"
  ) {
    return;
  }

  let usersByRole = {};
  let ordersByStatus = {};

  try {
    usersByRole = JSON.parse(usersDataElement.textContent || "{}");
    ordersByStatus = JSON.parse(ordersDataElement.textContent || "{}");
  } catch (error) {
    console.error("[admin-google-charts] Failed to parse chart data:", error);
    return;
  }

  google.charts.load("current", { packages: ["corechart"] });
  google.charts.setOnLoadCallback(drawCharts);

  function drawCharts() {
    drawUsersByRoleChart();
    drawOrdersByStatusChart();
  }

  function drawUsersByRoleChart() {
    const data = google.visualization.arrayToDataTable([
      ["Role", "Users"],
      ["Admins", Number(usersByRole.admin || 0)],
      ["Supermarkets", Number(usersByRole.supermarket || 0)],
      ["Couriers", Number(usersByRole.courier || 0)],
      ["Clients", Number(usersByRole.client || 0)],
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

    const chart = new google.visualization.PieChart(usersChartElement);
    chart.draw(data, options);
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
      legend: {
        position: "none",
      },
      chartArea: {
        width: "70%",
        height: "75%",
      },
      hAxis: {
        minValue: 0,
      },
    };

    const chart = new google.visualization.ColumnChart(ordersChartElement);
    chart.draw(data, options);
  }

  window.addEventListener("resize", drawCharts);
});