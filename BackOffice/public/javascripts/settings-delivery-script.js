const pickupField = document.getElementById("pickupField");
const courierField = document.getElementById("courierField");

const pickupCostInput = document.querySelector(
  'input[name="deliveryCosts[pickup]"]'
);
const courierCostInput = document.querySelector(
  'input[name="deliveryCosts[courier]"]'
);

function applyDeliveryRules() {
  if (pickupField) pickupField.style.display = "block";
  if (courierField) courierField.style.display = "block";

  if (pickupCostInput) {
    pickupCostInput.value = 0;
    pickupCostInput.readOnly = true;
  }

  if (courierCostInput) {
    courierCostInput.required = true;
    courierCostInput.min = 0;
  }
}

applyDeliveryRules();