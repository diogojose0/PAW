  document.addEventListener("DOMContentLoaded", () => {
    const discountTypeSelect = document.getElementById("discountTypeSelect");
    const discountValueInput = document.getElementById("discountValueInput");
    const discountValueHelp = document.getElementById("discountValueHelp");

    function updateDiscountValueField() {
      if (!discountTypeSelect || !discountValueInput) {
        return;
      }

      const isFreeShipping = discountTypeSelect.value === "free_shipping";

      if (isFreeShipping) {
        discountValueInput.value = 0;
        discountValueInput.readOnly = true;
        discountValueInput.min = 0;
        if (discountValueHelp) {
          discountValueHelp.textContent =
            "Free shipping uses the supermarket courier cost automatically.";
        }
      } else {
        discountValueInput.readOnly = false;
        discountValueInput.min = 0.01;
        if (discountValueHelp) {
          discountValueHelp.textContent =
            "For free shipping coupons, this value stays at 0.";
        }
      }
    }

    updateDiscountValueField();
    discountTypeSelect?.addEventListener("change", updateDiscountValueField);
  });