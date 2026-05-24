export function notificationTools(noParamsTool, withParamsTool) {
  return [
    withParamsTool({
      name: "vscode_get_notifications",
      label: "VS Code Notifications",
      description: "Read bridge notification queue.",
      rpcMethod: "getNotifications",
      parameters: {
        type: "object",
        properties: { since: { type: "number" }, limit: { type: "number" } },
        additionalProperties: false,
      },
    }),
    noParamsTool({
      name: "vscode_clear_notifications",
      label: "VS Code Clear Notifications",
      description: "Clear bridge notification queue.",
      rpcMethod: "clearNotifications",
    }),
    withParamsTool({
      name: "vscode_show_notification",
      label: "VS Code Show Notification",
      description: "Show notification in VS Code.",
      rpcMethod: "showNotification",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
          type: { type: "string", enum: ["info", "warning", "error"] },
        },
        required: ["message"],
        additionalProperties: false,
      },
    }),
  ];
}
