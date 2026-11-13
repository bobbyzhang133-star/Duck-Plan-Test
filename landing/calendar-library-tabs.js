(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DuckCalendarLibraryTabs = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function create({ document: doc = document, getOwner = () => "local", onChange = () => {} } = {}) {
    const toolbar = doc.querySelector("#calendar-library-toolbar");
    const scroller = doc.querySelector("#daily-task-panel");
    const buttons = [...doc.querySelectorAll("[data-calendar-library-tab]")];
    const panels = {
      tasks: doc.querySelector("#calendar-tasks-panel"),
      templates: doc.querySelector("#calendar-assignment-templates"),
    };
    if (!toolbar || !scroller || buttons.length !== 2 || !panels.tasks || !panels.templates) return null;
    let selected = "tasks";
    let owner = getOwner();
    let destroyed = false;
    const positions = { tasks: 0, templates: 0 };
    const selectedButton = () => buttons.find(button => button.dataset.calendarLibraryTab === selected);

    function apply() {
      for (const button of buttons) {
        const active = button.dataset.calendarLibraryTab === selected;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      }
      for (const [name, panel] of Object.entries(panels)) {
        panel.hidden = name !== selected;
        panel.inert = name !== selected;
      }
    }

    function select(name, { focus = false, reset = false } = {}) {
      if (destroyed || !panels[name]) return;
      const changed = name !== selected;
      const leavingContent = changed && panels[selected].contains(doc.activeElement);
      if (changed) positions[selected] = scroller.scrollTop;
      selected = name;
      if (reset) { positions.tasks = 0; positions.templates = 0; }
      apply();
      if (changed || reset) {
        scroller.scrollTop = positions[selected];
        onChange(selected);
      }
      if (focus || leavingContent) selectedButton()?.focus({ preventScroll: true });
    }

    function render() {
      if (destroyed) return;
      const next = getOwner();
      if (next !== owner) {
        owner = next;
        select("tasks", { reset: true });
      } else apply();
    }

    function onClick(event) {
      const button = event.target.closest("[data-calendar-library-tab]");
      if (button && buttons.includes(button)) select(button.dataset.calendarLibraryTab);
    }

    function onKeyDown(event) {
      const button = event.target.closest("[data-calendar-library-tab]");
      if (!button || !buttons.includes(button) || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = buttons.indexOf(button);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length;
      select(buttons[next].dataset.calendarLibraryTab, { focus: true });
    }

    toolbar.addEventListener("click", onClick);
    toolbar.addEventListener("keydown", onKeyDown);
    apply();
    return {
      select, render,
      get selected() { return selected; },
      destroy() {
        destroyed = true;
        toolbar.removeEventListener("click", onClick);
        toolbar.removeEventListener("keydown", onKeyDown);
      },
    };
  }
  return { create };
});
