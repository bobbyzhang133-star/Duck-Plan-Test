(function completionCardFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckCompletionCard = api;
})(typeof window !== "undefined" ? window : globalThis, function buildCompletionCard() {
  "use strict";
  const properties = ("box-sizing display position top right bottom left z-index width height min-width max-width min-height max-height " +
    "padding margin border border-radius box-shadow background color font text-align text-decoration white-space overflow overflow-wrap word-break text-overflow " +
    "grid-template-columns grid-template-rows grid-auto-flow grid-auto-rows grid-column grid-row gap align-items align-content align-self justify-content justify-items justify-self " +
    "flex flex-direction flex-wrap flex-shrink flex-grow order vertical-align appearance fill stroke stroke-width stroke-linecap stroke-linejoin").split(" ");

  function snapshot(card, { document: doc = card.ownerDocument } = {}) {
    const copy = card.cloneNode(true), originals = [card, ...card.querySelectorAll("*")], clones = [copy, ...copy.querySelectorAll("*")];
    // Resolve the existing card's essential layout once, while it still has its page ancestors.
    originals.forEach((source, index) => {
      const target = clones[index], style = doc.defaultView.getComputedStyle(source);
      properties.forEach(property => target.style.setProperty(property, style.getPropertyValue(property)));
      target.removeAttribute("id"); target.removeAttribute("name");
      target.removeAttribute("aria-describedby"); target.removeAttribute("aria-controls");
      for (const attribute of [...target.attributes]) if (attribute.name.startsWith("data-")) target.removeAttribute(attribute.name);
      target.removeAttribute("draggable");
      target.classList.remove("interaction-pressed", "interaction-released", "is-drag-source");
      if (target.matches("input,button,a,select,textarea")) target.tabIndex = -1;
    });
    copy.querySelectorAll(".task-date-icon").forEach(icon => icon.remove());
    copy.querySelectorAll(".task-date-line").forEach(line => { line.style.gridTemplateColumns = "32px minmax(0,1fr)"; });
    copy.querySelectorAll("input[type=checkbox]").forEach(input => {
      input.checked = true;
      input.style.removeProperty("background"); input.style.removeProperty("border");
    });
    copy.querySelectorAll(".task-title,h4").forEach(title => { title.style.textDecoration = "line-through"; });
    copy.classList.add("completion-exit-card");
    Object.assign(copy.style, { position: "absolute", inset: "0", width: "100%", height: "100%", margin: "0" });
    copy.setAttribute("aria-hidden", "true"); copy.inert = true;
    return copy;
  }
  return Object.freeze({ snapshot });
});
