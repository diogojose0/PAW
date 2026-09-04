const roleSelect = document.getElementById("roleSelect");
const supermarketFields = document.getElementById("supermarketFields");

const supermarketName = document.querySelector('input[name="supermarketName"]');
const supermarketOpeningHours = document.querySelector(
  'input[name="supermarketOpeningHours"]'
);
const supermarketLocation = document.querySelector(
  'input[name="supermarketLocation"]'
);
const pickupCostInput = document.querySelector(
  'input[name="deliveryCosts[pickup]"]'
);
const courierCostInput = document.querySelector(
  'input[name="deliveryCosts[courier]"]'
);

function toggleSupermarketFields() {
  const isSupermarket = roleSelect.value === "supermarket";
  supermarketFields.style.display = isSupermarket ? "block" : "none";

  supermarketName.required = isSupermarket;
  supermarketOpeningHours.required = isSupermarket;
  supermarketLocation.required = isSupermarket;
  courierCostInput.required = isSupermarket;

  if (pickupCostInput) {
    pickupCostInput.value = 0;
    pickupCostInput.readOnly = true;
  }

  if (!isSupermarket) {
    supermarketFields.querySelectorAll("input, textarea").forEach((field) => {
      if (field.type !== "hidden") {
        if (field.name === "deliveryCosts[pickup]") {
          field.value = 0;
        } else {
          field.value = "";
        }
      }
    });
  }
}

toggleSupermarketFields();
roleSelect.addEventListener("change", toggleSupermarketFields);