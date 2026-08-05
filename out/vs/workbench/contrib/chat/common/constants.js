var ChatConfiguration = /* @__PURE__ */ ((ChatConfiguration2) => {
  ChatConfiguration2["UnifiedChatView"] = "chat.unifiedChatView";
  ChatConfiguration2["UseFileStorage"] = "chat.useFileStorage";
  ChatConfiguration2["AgentEnabled"] = "chat.agent.enabled";
  ChatConfiguration2["Edits2Enabled"] = "chat.edits2.enabled";
  ChatConfiguration2["ExtensionToolsEnabled"] = "chat.extensionTools.enabled";
  return ChatConfiguration2;
})(ChatConfiguration || {});
var ChatMode = /* @__PURE__ */ ((ChatMode2) => {
  ChatMode2["Ask"] = "ask";
  ChatMode2["Edit"] = "edit";
  ChatMode2["Agent"] = "agent";
  return ChatMode2;
})(ChatMode || {});
function validateChatMode(mode) {
  switch (mode) {
    case "ask" /* Ask */:
    case "edit" /* Edit */:
    case "agent" /* Agent */:
      return mode;
    default:
      return void 0;
  }
}
var ChatAgentLocation = /* @__PURE__ */ ((ChatAgentLocation2) => {
  ChatAgentLocation2["Panel"] = "panel";
  ChatAgentLocation2["Terminal"] = "terminal";
  ChatAgentLocation2["Notebook"] = "notebook";
  ChatAgentLocation2["Editor"] = "editor";
  ChatAgentLocation2["EditingSession"] = "editing-session";
  return ChatAgentLocation2;
})(ChatAgentLocation || {});
((ChatAgentLocation2) => {
  function fromRaw(value) {
    switch (value) {
      case "panel":
        return "panel" /* Panel */;
      case "terminal":
        return "terminal" /* Terminal */;
      case "notebook":
        return "notebook" /* Notebook */;
      case "editor":
        return "editor" /* Editor */;
      case "editing-session":
        return "editing-session" /* EditingSession */;
    }
    return "panel" /* Panel */;
  }
  ChatAgentLocation2.fromRaw = fromRaw;
})(ChatAgentLocation || (ChatAgentLocation = {}));
export {
  ChatAgentLocation,
  ChatConfiguration,
  ChatMode,
  validateChatMode
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jb25zdGFudHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5leHBvcnQgZW51bSBDaGF0Q29uZmlndXJhdGlvbiB7XG5cdFVuaWZpZWRDaGF0VmlldyA9ICdjaGF0LnVuaWZpZWRDaGF0VmlldycsXG5cdFVzZUZpbGVTdG9yYWdlID0gJ2NoYXQudXNlRmlsZVN0b3JhZ2UnLFxuXHRBZ2VudEVuYWJsZWQgPSAnY2hhdC5hZ2VudC5lbmFibGVkJyxcblx0RWRpdHMyRW5hYmxlZCA9ICdjaGF0LmVkaXRzMi5lbmFibGVkJyxcblx0RXh0ZW5zaW9uVG9vbHNFbmFibGVkID0gJ2NoYXQuZXh0ZW5zaW9uVG9vbHMuZW5hYmxlZCcsXG59XG5cbmV4cG9ydCBlbnVtIENoYXRNb2RlIHtcblx0QXNrID0gJ2FzaycsXG5cdEVkaXQgPSAnZWRpdCcsXG5cdEFnZW50ID0gJ2FnZW50J1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVDaGF0TW9kZShtb2RlOiB1bmtub3duKTogQ2hhdE1vZGUgfCB1bmRlZmluZWQge1xuXHRzd2l0Y2ggKG1vZGUpIHtcblx0XHRjYXNlIENoYXRNb2RlLkFzazpcblx0XHRjYXNlIENoYXRNb2RlLkVkaXQ6XG5cdFx0Y2FzZSBDaGF0TW9kZS5BZ2VudDpcblx0XHRcdHJldHVybiBtb2RlIGFzIENoYXRNb2RlO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmV4cG9ydCB0eXBlIFJhd0NoYXRQYXJ0aWNpcGFudExvY2F0aW9uID0gJ3BhbmVsJyB8ICd0ZXJtaW5hbCcgfCAnbm90ZWJvb2snIHwgJ2VkaXRpbmctc2Vzc2lvbic7XG5cbmV4cG9ydCBlbnVtIENoYXRBZ2VudExvY2F0aW9uIHtcblx0UGFuZWwgPSAncGFuZWwnLFxuXHRUZXJtaW5hbCA9ICd0ZXJtaW5hbCcsXG5cdE5vdGVib29rID0gJ25vdGVib29rJyxcblx0RWRpdG9yID0gJ2VkaXRvcicsXG5cdEVkaXRpbmdTZXNzaW9uID0gJ2VkaXRpbmctc2Vzc2lvbicsXG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgQ2hhdEFnZW50TG9jYXRpb24ge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbVJhdyh2YWx1ZTogUmF3Q2hhdFBhcnRpY2lwYW50TG9jYXRpb24gfCBzdHJpbmcpOiBDaGF0QWdlbnRMb2NhdGlvbiB7XG5cdFx0c3dpdGNoICh2YWx1ZSkge1xuXHRcdFx0Y2FzZSAncGFuZWwnOiByZXR1cm4gQ2hhdEFnZW50TG9jYXRpb24uUGFuZWw7XG5cdFx0XHRjYXNlICd0ZXJtaW5hbCc6IHJldHVybiBDaGF0QWdlbnRMb2NhdGlvbi5UZXJtaW5hbDtcblx0XHRcdGNhc2UgJ25vdGVib29rJzogcmV0dXJuIENoYXRBZ2VudExvY2F0aW9uLk5vdGVib29rO1xuXHRcdFx0Y2FzZSAnZWRpdG9yJzogcmV0dXJuIENoYXRBZ2VudExvY2F0aW9uLkVkaXRvcjtcblx0XHRcdGNhc2UgJ2VkaXRpbmctc2Vzc2lvbic6IHJldHVybiBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbjtcblx0XHR9XG5cdFx0cmV0dXJuIENoYXRBZ2VudExvY2F0aW9uLlBhbmVsO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLTyxJQUFLLG9CQUFMLGtCQUFLQSx1QkFBTDtBQUNOLEVBQUFBLG1CQUFBLHFCQUFrQjtBQUNsQixFQUFBQSxtQkFBQSxvQkFBaUI7QUFDakIsRUFBQUEsbUJBQUEsa0JBQWU7QUFDZixFQUFBQSxtQkFBQSxtQkFBZ0I7QUFDaEIsRUFBQUEsbUJBQUEsMkJBQXdCO0FBTGIsU0FBQUE7QUFBQSxHQUFBO0FBUUwsSUFBSyxXQUFMLGtCQUFLQyxjQUFMO0FBQ04sRUFBQUEsVUFBQSxTQUFNO0FBQ04sRUFBQUEsVUFBQSxVQUFPO0FBQ1AsRUFBQUEsVUFBQSxXQUFRO0FBSEcsU0FBQUE7QUFBQSxHQUFBO0FBTUwsU0FBUyxpQkFBaUIsTUFBcUM7QUFDckUsVUFBUSxNQUFNO0FBQUEsSUFDYixLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQUEsSUFDTCxLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1I7QUFDQyxhQUFPO0FBQUEsRUFDVDtBQUNEO0FBSU8sSUFBSyxvQkFBTCxrQkFBS0MsdUJBQUw7QUFDTixFQUFBQSxtQkFBQSxXQUFRO0FBQ1IsRUFBQUEsbUJBQUEsY0FBVztBQUNYLEVBQUFBLG1CQUFBLGNBQVc7QUFDWCxFQUFBQSxtQkFBQSxZQUFTO0FBQ1QsRUFBQUEsbUJBQUEsb0JBQWlCO0FBTE4sU0FBQUE7QUFBQSxHQUFBO0FBQUEsQ0FRTCxDQUFVQSx1QkFBVjtBQUNDLFdBQVMsUUFBUSxPQUErRDtBQUN0RixZQUFRLE9BQU87QUFBQSxNQUNkLEtBQUs7QUFBUyxlQUFPO0FBQUEsTUFDckIsS0FBSztBQUFZLGVBQU87QUFBQSxNQUN4QixLQUFLO0FBQVksZUFBTztBQUFBLE1BQ3hCLEtBQUs7QUFBVSxlQUFPO0FBQUEsTUFDdEIsS0FBSztBQUFtQixlQUFPO0FBQUEsSUFDaEM7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQVRPLEVBQUFBLG1CQUFTO0FBQUEsR0FEQTsiLAogICJuYW1lcyI6IFsiQ2hhdENvbmZpZ3VyYXRpb24iLCAiQ2hhdE1vZGUiLCAiQ2hhdEFnZW50TG9jYXRpb24iXQp9Cg==
