// Markdown -> safe HTML. Falls back to plain text if the CDN scripts failed to load.
const ready = typeof marked !== "undefined" && typeof DOMPurify !== "undefined";

if (ready) {
  marked.setOptions({ gfm: true, breaks: true });
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function renderMarkdown(el, text) {
  if (!ready) {
    el.style.whiteSpace = "pre-wrap";
    el.textContent = text;
    return;
  }
  el.innerHTML = DOMPurify.sanitize(marked.parse(text));
}
