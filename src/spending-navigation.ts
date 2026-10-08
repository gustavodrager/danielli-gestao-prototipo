export function focusSpendingForm() {
  requestAnimationFrame(() => {
    // Restaurar o foco depois da montagem e da rolagem da rota de origem.
    requestAnimationFrame(() => {
      const form = document.getElementById("spending-form");
      form?.focus({ preventScroll: true });
      form?.scrollIntoView({ block: "start" });
    });
  });
}
