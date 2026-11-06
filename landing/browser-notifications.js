(function browserNotificationsFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DuckBrowserNotifications = api;
})(typeof window !== "undefined" ? window : globalThis, function buildBrowserNotifications() {
  function capability(NotificationApi) {
    if (!NotificationApi || typeof NotificationApi.requestPermission !== "function") return "unsupported";
    return ["default", "granted", "denied"].includes(NotificationApi.permission)
      ? NotificationApi.permission
      : "unsupported";
  }

  function settingsCopy(state) {
    if (state === "granted") {
      return { label: "Allowed", action: "Send test notification", disabled: false };
    }
    if (state === "denied") {
      return { label: "Blocked in browser", action: "Notifications blocked", disabled: true };
    }
    if (state === "default") {
      return { label: "Not allowed yet", action: "Allow device notifications", disabled: false };
    }
    return { label: "Not supported", action: "Device notifications unavailable", disabled: true };
  }

  function formatDue(deadline, locale) {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(deadline));
  }

  function taskNotification(task, deadline, options = {}) {
    const className = task.className ? `${task.className} · ` : "";
    return {
      title: "DuckPlan deadline reminder",
      options: {
        body: `${task.title}\n${className}Due ${formatDue(deadline, options.locale)}`,
        icon: options.icon,
        badge: options.badge || options.icon,
        tag: `duckplan-deadline-${task.id}-${task.dueDate || "date"}-${task.dueTime || "anytime"}`,
        renotify: false,
        data: { taskId: task.id },
      },
    };
  }

  function testNotification(options = {}) {
    return {
      title: "DuckPlan notifications are ready",
      options: {
        body: "Deadline reminders can now appear on this device while DuckPlan is open.",
        icon: options.icon,
        badge: options.badge || options.icon,
        tag: "duckplan-notification-test",
        renotify: false,
      },
    };
  }

  return { capability, settingsCopy, taskNotification, testNotification };
});
