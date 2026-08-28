/* arranque de la aplicación */
bootstrap().catch(e => {
  if (e.message !== "sesión")
    document.body.innerHTML =
      `<div class='empty'>No se pudo cargar: ${esc(e.message)}</div>`;
});
