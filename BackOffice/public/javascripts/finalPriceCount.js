document.addEventListener("DOMContentLoaded", () => {
  const itemsTotalElement = document.getElementById("itemsTotalValue");
  const couponDiscountElement = document.getElementById("couponDiscountValue");
  const deliveryRadios = document.querySelectorAll(".delivery-method-radio");
  const deliveryCostValue = document.getElementById("deliveryCostValue");
  const finalTotalValue = document.getElementById("finalTotalValue");

  const itemsTotal = Number(itemsTotalElement?.dataset.raw || 0);
  const baseCouponDiscount = Number(couponDiscountElement?.dataset.discount || 0);
  const couponType = couponDiscountElement?.dataset.couponType || "";

  function updateTotals() {
    let selectedDeliveryCost = 0;
    let selectedDeliveryMethod = null;

    deliveryRadios.forEach((radio) => {
      if (radio.checked) {
        selectedDeliveryCost = Number(radio.dataset.cost || 0);
        selectedDeliveryMethod = radio.value;
      }
    });

    let effectiveCouponDiscount = baseCouponDiscount;

    if (couponType === "free_shipping") {
      effectiveCouponDiscount =
        selectedDeliveryMethod === "courier" ? selectedDeliveryCost : 0;
    }

    const finalTotal = Math.max(
      itemsTotal + selectedDeliveryCost - effectiveCouponDiscount,
      0,
    );

    if (couponDiscountElement) {
      couponDiscountElement.textContent = effectiveCouponDiscount.toFixed(2);
    }

    if (deliveryCostValue) {
      deliveryCostValue.textContent = selectedDeliveryCost.toFixed(2);
    }

    if (finalTotalValue) {
      finalTotalValue.textContent = finalTotal.toFixed(2);
    }
  }

  deliveryRadios.forEach((radio) => {
    radio.addEventListener("change", updateTotals);
  });

  updateTotals();
});