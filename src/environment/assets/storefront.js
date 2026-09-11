// Progressive navigation only. No product data, storage or cart state in the client.
document.querySelectorAll("a[data-collection]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    window.location.assign("/#koleksi");
  });
});
