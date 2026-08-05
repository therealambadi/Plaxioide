import { isWeb, isWindows } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
const defaultCommonlyUsedSettings = [
  "files.autoSave",
  "editor.fontSize",
  "editor.fontFamily",
  "editor.tabSize",
  "editor.renderWhitespace",
  "editor.cursorStyle",
  "editor.multiCursorModifier",
  "editor.insertSpaces",
  "editor.wordWrap",
  "files.exclude",
  "files.associations",
  "workbench.editor.enablePreview"
];
function getCommonlyUsedData(toggleData) {
  return {
    id: "commonlyUsed",
    label: localize("commonlyUsed", "Commonly Used"),
    settings: toggleData?.commonlyUsed ?? defaultCommonlyUsedSettings
  };
}
const tocData = {
  id: "root",
  label: "root",
  children: [
    {
      id: "editor",
      label: localize("textEditor", "Text Editor"),
      settings: ["editor.*"],
      children: [
        {
          id: "editor/cursor",
          label: localize("cursor", "Cursor"),
          settings: ["editor.cursor*"]
        },
        {
          id: "editor/find",
          label: localize("find", "Find"),
          settings: ["editor.find.*"]
        },
        {
          id: "editor/font",
          label: localize("font", "Font"),
          settings: ["editor.font*"]
        },
        {
          id: "editor/format",
          label: localize("formatting", "Formatting"),
          settings: ["editor.format*"]
        },
        {
          id: "editor/diffEditor",
          label: localize("diffEditor", "Diff Editor"),
          settings: ["diffEditor.*"]
        },
        {
          id: "editor/multiDiffEditor",
          label: localize("multiDiffEditor", "Multi-File Diff Editor"),
          settings: ["multiDiffEditor.*"]
        },
        {
          id: "editor/minimap",
          label: localize("minimap", "Minimap"),
          settings: ["editor.minimap.*"]
        },
        {
          id: "editor/suggestions",
          label: localize("suggestions", "Suggestions"),
          settings: ["editor.*suggest*"]
        },
        {
          id: "editor/files",
          label: localize("files", "Files"),
          settings: ["files.*"]
        }
      ]
    },
    {
      id: "workbench",
      label: localize("workbench", "Workbench"),
      settings: ["workbench.*"],
      children: [
        {
          id: "workbench/appearance",
          label: localize("appearance", "Appearance"),
          settings: ["workbench.activityBar.*", "workbench.*color*", "workbench.fontAliasing", "workbench.iconTheme", "workbench.sidebar.location", "workbench.*.visible", "workbench.tips.enabled", "workbench.tree.*", "workbench.view.*"]
        },
        {
          id: "workbench/breadcrumbs",
          label: localize("breadcrumbs", "Breadcrumbs"),
          settings: ["breadcrumbs.*"]
        },
        {
          id: "workbench/editor",
          label: localize("editorManagement", "Editor Management"),
          settings: ["workbench.editor.*"]
        },
        {
          id: "workbench/settings",
          label: localize("settings", "Settings Editor"),
          settings: ["workbench.settings.*"]
        },
        {
          id: "workbench/zenmode",
          label: localize("zenMode", "Zen Mode"),
          settings: ["zenmode.*"]
        },
        {
          id: "workbench/screencastmode",
          label: localize("screencastMode", "Screencast Mode"),
          settings: ["screencastMode.*"]
        }
      ]
    },
    {
      id: "window",
      label: localize("window", "Window"),
      settings: ["window.*"],
      children: [
        {
          id: "window/newWindow",
          label: localize("newWindow", "New Window"),
          settings: ["window.*newwindow*"]
        }
      ]
    },
    {
      id: "features",
      label: localize("features", "Features"),
      children: [
        {
          id: "features/accessibilitySignals",
          label: localize("accessibility.signals", "Accessibility Signals"),
          settings: ["accessibility.signal*"]
        },
        {
          id: "features/accessibility",
          label: localize("accessibility", "Accessibility"),
          settings: ["accessibility.*"]
        },
        {
          id: "features/explorer",
          label: localize("fileExplorer", "Explorer"),
          settings: ["explorer.*", "outline.*"]
        },
        {
          id: "features/search",
          label: localize("search", "Search"),
          settings: ["search.*"]
        },
        {
          id: "features/debug",
          label: localize("debug", "Debug"),
          settings: ["debug.*", "launch"]
        },
        {
          id: "features/testing",
          label: localize("testing", "Testing"),
          settings: ["testing.*"]
        },
        {
          id: "features/scm",
          label: localize("scm", "Source Control"),
          settings: ["scm.*"]
        },
        {
          id: "features/extensions",
          label: localize("extensions", "Extensions"),
          settings: ["extensions.*"]
        },
        {
          id: "features/terminal",
          label: localize("terminal", "Terminal"),
          settings: ["terminal.*"]
        },
        {
          id: "features/task",
          label: localize("task", "Task"),
          settings: ["task.*"]
        },
        {
          id: "features/problems",
          label: localize("problems", "Problems"),
          settings: ["problems.*"]
        },
        {
          id: "features/output",
          label: localize("output", "Output"),
          settings: ["output.*"]
        },
        {
          id: "features/comments",
          label: localize("comments", "Comments"),
          settings: ["comments.*"]
        },
        {
          id: "features/remote",
          label: localize("remote", "Remote"),
          settings: ["remote.*"]
        },
        {
          id: "features/timeline",
          label: localize("timeline", "Timeline"),
          settings: ["timeline.*"]
        },
        {
          id: "features/notebook",
          label: localize("notebook", "Notebook"),
          settings: ["notebook.*", "interactiveWindow.*"]
        },
        {
          id: "features/mergeEditor",
          label: localize("mergeEditor", "Merge Editor"),
          settings: ["mergeEditor.*"]
        },
        {
          id: "features/chat",
          label: localize("chat", "Chat"),
          settings: ["chat.*", "inlineChat.*", "mcp"]
        },
        {
          id: "features/issueReporter",
          label: localize("issueReporter", "Issue Reporter"),
          settings: ["issueReporter.*"],
          hide: !isWeb
        }
      ]
    },
    {
      id: "application",
      label: localize("application", "Application"),
      children: [
        {
          id: "application/http",
          label: localize("proxy", "Proxy"),
          settings: ["http.*"]
        },
        {
          id: "application/keyboard",
          label: localize("keyboard", "Keyboard"),
          settings: ["keyboard.*"]
        },
        {
          id: "application/update",
          label: localize("update", "Update"),
          settings: ["update.*"]
        },
        {
          id: "application/telemetry",
          label: localize("telemetry", "Telemetry"),
          settings: ["telemetry.*"]
        },
        {
          id: "application/settingsSync",
          label: localize("settingsSync", "Settings Sync"),
          settings: ["settingsSync.*"]
        },
        {
          id: "application/experimental",
          label: localize("experimental", "Experimental"),
          settings: ["application.experimental.*"]
        },
        {
          id: "application/other",
          label: localize("other", "Other"),
          settings: ["application.*"],
          hide: isWindows
        }
      ]
    },
    {
      id: "security",
      label: localize("security", "Security"),
      settings: ["security.*"],
      children: [
        {
          id: "security/workspace",
          label: localize("workspace", "Workspace"),
          settings: ["security.workspace.*"]
        }
      ]
    }
  ]
};
const knownAcronyms = /* @__PURE__ */ new Set();
[
  "css",
  "html",
  "scss",
  "less",
  "json",
  "js",
  "ts",
  "ie",
  "id",
  "php",
  "scm"
].forEach((str) => knownAcronyms.add(str));
const knownTermMappings = /* @__PURE__ */ new Map();
knownTermMappings.set("power shell", "PowerShell");
knownTermMappings.set("powershell", "PowerShell");
knownTermMappings.set("javascript", "JavaScript");
knownTermMappings.set("typescript", "TypeScript");
knownTermMappings.set("github", "GitHub");
export {
  getCommonlyUsedData,
  knownAcronyms,
  knownTermMappings,
  tocData
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzTGF5b3V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaXNXZWIsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblRvZ2dsZURhdGEgfSBmcm9tICcuLi9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElUT0NFbnRyeTxUPiB7XG5cdGlkOiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdG9yZGVyPzogbnVtYmVyO1xuXHRjaGlsZHJlbj86IElUT0NFbnRyeTxUPltdO1xuXHRzZXR0aW5ncz86IEFycmF5PFQ+O1xuXHRoaWRlPzogYm9vbGVhbjtcbn1cblxuY29uc3QgZGVmYXVsdENvbW1vbmx5VXNlZFNldHRpbmdzOiBzdHJpbmdbXSA9IFtcblx0J2ZpbGVzLmF1dG9TYXZlJyxcblx0J2VkaXRvci5mb250U2l6ZScsXG5cdCdlZGl0b3IuZm9udEZhbWlseScsXG5cdCdlZGl0b3IudGFiU2l6ZScsXG5cdCdlZGl0b3IucmVuZGVyV2hpdGVzcGFjZScsXG5cdCdlZGl0b3IuY3Vyc29yU3R5bGUnLFxuXHQnZWRpdG9yLm11bHRpQ3Vyc29yTW9kaWZpZXInLFxuXHQnZWRpdG9yLmluc2VydFNwYWNlcycsXG5cdCdlZGl0b3Iud29yZFdyYXAnLFxuXHQnZmlsZXMuZXhjbHVkZScsXG5cdCdmaWxlcy5hc3NvY2lhdGlvbnMnLFxuXHQnd29ya2JlbmNoLmVkaXRvci5lbmFibGVQcmV2aWV3J1xuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvbW1vbmx5VXNlZERhdGEodG9nZ2xlRGF0YTogRXh0ZW5zaW9uVG9nZ2xlRGF0YSB8IHVuZGVmaW5lZCk6IElUT0NFbnRyeTxzdHJpbmc+IHtcblx0cmV0dXJuIHtcblx0XHRpZDogJ2NvbW1vbmx5VXNlZCcsXG5cdFx0bGFiZWw6IGxvY2FsaXplKCdjb21tb25seVVzZWQnLCBcIkNvbW1vbmx5IFVzZWRcIiksXG5cdFx0c2V0dGluZ3M6IHRvZ2dsZURhdGE/LmNvbW1vbmx5VXNlZCA/PyBkZWZhdWx0Q29tbW9ubHlVc2VkU2V0dGluZ3Ncblx0fTtcbn1cblxuZXhwb3J0IGNvbnN0IHRvY0RhdGE6IElUT0NFbnRyeTxzdHJpbmc+ID0ge1xuXHRpZDogJ3Jvb3QnLFxuXHRsYWJlbDogJ3Jvb3QnLFxuXHRjaGlsZHJlbjogW1xuXHRcdHtcblx0XHRcdGlkOiAnZWRpdG9yJyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndGV4dEVkaXRvcicsIFwiVGV4dCBFZGl0b3JcIiksXG5cdFx0XHRzZXR0aW5nczogWydlZGl0b3IuKiddLFxuXHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZWRpdG9yL2N1cnNvcicsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdjdXJzb3InLCBcIkN1cnNvclwiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydlZGl0b3IuY3Vyc29yKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2VkaXRvci9maW5kJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2ZpbmQnLCBcIkZpbmRcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnZWRpdG9yLmZpbmQuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2VkaXRvci9mb250Jyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2ZvbnQnLCBcIkZvbnRcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnZWRpdG9yLmZvbnQqJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZWRpdG9yL2Zvcm1hdCcsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdmb3JtYXR0aW5nJywgXCJGb3JtYXR0aW5nXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ2VkaXRvci5mb3JtYXQqJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZWRpdG9yL2RpZmZFZGl0b3InLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZGlmZkVkaXRvcicsIFwiRGlmZiBFZGl0b3JcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnZGlmZkVkaXRvci4qJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZWRpdG9yL211bHRpRGlmZkVkaXRvcicsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdtdWx0aURpZmZFZGl0b3InLCBcIk11bHRpLUZpbGUgRGlmZiBFZGl0b3JcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnbXVsdGlEaWZmRWRpdG9yLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdlZGl0b3IvbWluaW1hcCcsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdtaW5pbWFwJywgXCJNaW5pbWFwXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ2VkaXRvci5taW5pbWFwLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdlZGl0b3Ivc3VnZ2VzdGlvbnMnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc3VnZ2VzdGlvbnMnLCBcIlN1Z2dlc3Rpb25zXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ2VkaXRvci4qc3VnZ2VzdConXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdlZGl0b3IvZmlsZXMnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZmlsZXMnLCBcIkZpbGVzXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ2ZpbGVzLionXVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaCcsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ3dvcmtiZW5jaCcsIFwiV29ya2JlbmNoXCIpLFxuXHRcdFx0c2V0dGluZ3M6IFsnd29ya2JlbmNoLionXSxcblx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC9hcHBlYXJhbmNlJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2FwcGVhcmFuY2UnLCBcIkFwcGVhcmFuY2VcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnd29ya2JlbmNoLmFjdGl2aXR5QmFyLionLCAnd29ya2JlbmNoLipjb2xvcionLCAnd29ya2JlbmNoLmZvbnRBbGlhc2luZycsICd3b3JrYmVuY2guaWNvblRoZW1lJywgJ3dvcmtiZW5jaC5zaWRlYmFyLmxvY2F0aW9uJywgJ3dvcmtiZW5jaC4qLnZpc2libGUnLCAnd29ya2JlbmNoLnRpcHMuZW5hYmxlZCcsICd3b3JrYmVuY2gudHJlZS4qJywgJ3dvcmtiZW5jaC52aWV3LionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gvYnJlYWRjcnVtYnMnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnYnJlYWRjcnVtYnMnLCBcIkJyZWFkY3J1bWJzXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ2JyZWFkY3J1bWJzLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gvZWRpdG9yJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2VkaXRvck1hbmFnZW1lbnQnLCBcIkVkaXRvciBNYW5hZ2VtZW50XCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ3dvcmtiZW5jaC5lZGl0b3IuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC9zZXR0aW5ncycsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzZXR0aW5ncycsIFwiU2V0dGluZ3MgRWRpdG9yXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ3dvcmtiZW5jaC5zZXR0aW5ncy4qJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoL3plbm1vZGUnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnemVuTW9kZScsIFwiWmVuIE1vZGVcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnemVubW9kZS4qJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoL3NjcmVlbmNhc3Rtb2RlJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3NjcmVlbmNhc3RNb2RlJywgXCJTY3JlZW5jYXN0IE1vZGVcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnc2NyZWVuY2FzdE1vZGUuKiddXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9LFxuXHRcdHtcblx0XHRcdGlkOiAnd2luZG93Jyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnd2luZG93JywgXCJXaW5kb3dcIiksXG5cdFx0XHRzZXR0aW5nczogWyd3aW5kb3cuKiddLFxuXHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnd2luZG93L25ld1dpbmRvdycsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCduZXdXaW5kb3cnLCBcIk5ldyBXaW5kb3dcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnd2luZG93LipuZXd3aW5kb3cqJ11cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0aWQ6ICdmZWF0dXJlcycsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2ZlYXR1cmVzJywgXCJGZWF0dXJlc1wiKSxcblx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL2FjY2Vzc2liaWxpdHlTaWduYWxzJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscycsICdBY2Nlc3NpYmlsaXR5IFNpZ25hbHMnKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydhY2Nlc3NpYmlsaXR5LnNpZ25hbConXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdmZWF0dXJlcy9hY2Nlc3NpYmlsaXR5Jyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHknLCBcIkFjY2Vzc2liaWxpdHlcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnYWNjZXNzaWJpbGl0eS4qJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZmVhdHVyZXMvZXhwbG9yZXInLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZmlsZUV4cGxvcmVyJywgXCJFeHBsb3JlclwiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydleHBsb3Jlci4qJywgJ291dGxpbmUuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL3NlYXJjaCcsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzZWFyY2gnLCBcIlNlYXJjaFwiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydzZWFyY2guKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL2RlYnVnJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2RlYnVnJywgXCJEZWJ1Z1wiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydkZWJ1Zy4qJywgJ2xhdW5jaCddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL3Rlc3RpbmcnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndGVzdGluZycsIFwiVGVzdGluZ1wiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWyd0ZXN0aW5nLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdmZWF0dXJlcy9zY20nLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2NtJywgXCJTb3VyY2UgQ29udHJvbFwiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydzY20uKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL2V4dGVuc2lvbnMnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZXh0ZW5zaW9ucycsIFwiRXh0ZW5zaW9uc1wiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydleHRlbnNpb25zLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdmZWF0dXJlcy90ZXJtaW5hbCcsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCd0ZXJtaW5hbCcsIFwiVGVybWluYWxcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsndGVybWluYWwuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL3Rhc2snLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndGFzaycsIFwiVGFza1wiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWyd0YXNrLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdmZWF0dXJlcy9wcm9ibGVtcycsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdwcm9ibGVtcycsIFwiUHJvYmxlbXNcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsncHJvYmxlbXMuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL291dHB1dCcsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdvdXRwdXQnLCBcIk91dHB1dFwiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydvdXRwdXQuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL2NvbW1lbnRzJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NvbW1lbnRzJywgXCJDb21tZW50c1wiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydjb21tZW50cy4qJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZmVhdHVyZXMvcmVtb3RlJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3JlbW90ZScsIFwiUmVtb3RlXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ3JlbW90ZS4qJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZmVhdHVyZXMvdGltZWxpbmUnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndGltZWxpbmUnLCBcIlRpbWVsaW5lXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ3RpbWVsaW5lLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdmZWF0dXJlcy9ub3RlYm9vaycsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdub3RlYm9vaycsICdOb3RlYm9vaycpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ25vdGVib29rLionLCAnaW50ZXJhY3RpdmVXaW5kb3cuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2ZlYXR1cmVzL21lcmdlRWRpdG9yJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ21lcmdlRWRpdG9yJywgJ01lcmdlIEVkaXRvcicpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ21lcmdlRWRpdG9yLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdmZWF0dXJlcy9jaGF0Jyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NoYXQnLCAnQ2hhdCcpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ2NoYXQuKicsICdpbmxpbmVDaGF0LionLCAnbWNwJ11cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnZmVhdHVyZXMvaXNzdWVSZXBvcnRlcicsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdpc3N1ZVJlcG9ydGVyJywgJ0lzc3VlIFJlcG9ydGVyJyksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnaXNzdWVSZXBvcnRlci4qJ10sXG5cdFx0XHRcdFx0aGlkZTogIWlzV2ViXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9LFxuXHRcdHtcblx0XHRcdGlkOiAnYXBwbGljYXRpb24nLFxuXHRcdFx0bGFiZWw6IGxvY2FsaXplKCdhcHBsaWNhdGlvbicsIFwiQXBwbGljYXRpb25cIiksXG5cdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdhcHBsaWNhdGlvbi9odHRwJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3Byb3h5JywgXCJQcm94eVwiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWydodHRwLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdhcHBsaWNhdGlvbi9rZXlib2FyZCcsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdrZXlib2FyZCcsIFwiS2V5Ym9hcmRcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsna2V5Ym9hcmQuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2FwcGxpY2F0aW9uL3VwZGF0ZScsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCd1cGRhdGUnLCBcIlVwZGF0ZVwiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWyd1cGRhdGUuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2FwcGxpY2F0aW9uL3RlbGVtZXRyeScsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCd0ZWxlbWV0cnknLCBcIlRlbGVtZXRyeVwiKSxcblx0XHRcdFx0XHRzZXR0aW5nczogWyd0ZWxlbWV0cnkuKiddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogJ2FwcGxpY2F0aW9uL3NldHRpbmdzU3luYycsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdzZXR0aW5nc1N5bmMnLCBcIlNldHRpbmdzIFN5bmNcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnc2V0dGluZ3NTeW5jLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdhcHBsaWNhdGlvbi9leHBlcmltZW50YWwnLFxuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZXhwZXJpbWVudGFsJywgXCJFeHBlcmltZW50YWxcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnYXBwbGljYXRpb24uZXhwZXJpbWVudGFsLionXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6ICdhcHBsaWNhdGlvbi9vdGhlcicsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdvdGhlcicsIFwiT3RoZXJcIiksXG5cdFx0XHRcdFx0c2V0dGluZ3M6IFsnYXBwbGljYXRpb24uKiddLFxuXHRcdFx0XHRcdGhpZGU6IGlzV2luZG93c1xuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHR7XG5cdFx0XHRpZDogJ3NlY3VyaXR5Jyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2VjdXJpdHknLCBcIlNlY3VyaXR5XCIpLFxuXHRcdFx0c2V0dGluZ3M6IFsnc2VjdXJpdHkuKiddLFxuXHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiAnc2VjdXJpdHkvd29ya3NwYWNlJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3dvcmtzcGFjZScsIFwiV29ya3NwYWNlXCIpLFxuXHRcdFx0XHRcdHNldHRpbmdzOiBbJ3NlY3VyaXR5LndvcmtzcGFjZS4qJ11cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH1cblx0XVxufTtcblxuZXhwb3J0IGNvbnN0IGtub3duQWNyb255bXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbltcblx0J2NzcycsXG5cdCdodG1sJyxcblx0J3Njc3MnLFxuXHQnbGVzcycsXG5cdCdqc29uJyxcblx0J2pzJyxcblx0J3RzJyxcblx0J2llJyxcblx0J2lkJyxcblx0J3BocCcsXG5cdCdzY20nLFxuXS5mb3JFYWNoKHN0ciA9PiBrbm93bkFjcm9ueW1zLmFkZChzdHIpKTtcblxuZXhwb3J0IGNvbnN0IGtub3duVGVybU1hcHBpbmdzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbmtub3duVGVybU1hcHBpbmdzLnNldCgncG93ZXIgc2hlbGwnLCAnUG93ZXJTaGVsbCcpO1xua25vd25UZXJtTWFwcGluZ3Muc2V0KCdwb3dlcnNoZWxsJywgJ1Bvd2VyU2hlbGwnKTtcbmtub3duVGVybU1hcHBpbmdzLnNldCgnamF2YXNjcmlwdCcsICdKYXZhU2NyaXB0Jyk7XG5rbm93blRlcm1NYXBwaW5ncy5zZXQoJ3R5cGVzY3JpcHQnLCAnVHlwZVNjcmlwdCcpO1xua25vd25UZXJtTWFwcGluZ3Muc2V0KCdnaXRodWInLCAnR2l0SHViJyk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxT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
