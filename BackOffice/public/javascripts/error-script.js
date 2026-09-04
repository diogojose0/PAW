document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("loginError");

  if (el) {
    setTimeout(() => {
      el.remove();
    }, 3000);
  }
});