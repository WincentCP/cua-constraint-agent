// Only public HTML is fetched, on demand. Unopened panels are never prefetched.
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

const information = document.querySelector("#product-information");
if (information) {
  const status = document.querySelector(".panel-status");
  const add = document.querySelector(".add-form button");
  let pending;
  let committedUrl = location.pathname + location.search;

  async function showPanel(url, fromHistory = false) {
    pending?.abort();
    const request = new AbortController();
    pending = request;
    information.setAttribute("aria-busy", "true");
    information.style.minHeight = `${information.offsetHeight}px`;
    information.querySelector(".panel-content").hidden = true;
    add.disabled = true;
    status.textContent = "Memuat informasi…";
    const timer = setTimeout(() => request.abort("timeout"), 8000);
    try {
      const response = await fetch(url, {
        signal: request.signal,
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok || new URL(response.url).pathname !== location.pathname)
        throw Error("Invalid panel response");
      const html = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
      );
      const incoming = html.querySelector("#product-information");
      if (!incoming) throw Error("Missing panel");
      if (pending !== request) return;
      if (!fromHistory) history.pushState(null, "", url);
      information.replaceChildren(...incoming.childNodes);
      committedUrl = location.pathname + location.search;
      information.setAttribute("aria-busy", "false");
      information.style.minHeight = "";
      add.disabled = false;
      status.textContent = "";
      if (!fromHistory)
        information
          .querySelector('[aria-current="page"]')
          .focus({ preventScroll: true });
    } catch {
      if (pending === request) {
        // A regular page load remains the fallback for a failed enhancement.
        location.assign(url);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  information.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-panel-link]");
    if (
      !link ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname)
      return;
    event.preventDefault();
    if (
      url.pathname + url.search === committedUrl &&
      information.getAttribute("aria-busy") === "false"
    )
      return;
    void showPanel(url.pathname + url.search);
  });
  window.addEventListener("popstate", () => {
    if (
      location.pathname + location.search !== committedUrl ||
      information.getAttribute("aria-busy") === "true"
    ) {
      void showPanel(location.pathname + location.search, true);
    }
  });
}
