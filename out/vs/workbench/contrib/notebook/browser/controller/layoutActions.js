import { Codicon } from "../../../../../base/common/codicons.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Categories } from "../../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { NOTEBOOK_ACTIONS_CATEGORY } from "./coreActions.js";
import { getNotebookEditorFromEditorPane } from "../notebookBrowser.js";
import { INotebookEditorService } from "../services/notebookEditorService.js";
import { NotebookSetting } from "../../common/notebookCommon.js";
import { NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR } from "../../common/notebookContextKeys.js";
import { INotebookService } from "../../common/notebookService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
registerAction2(class NotebookConfigureLayoutAction extends Action2 {
  constructor() {
    super({
      id: "workbench.notebook.layout.select",
      title: localize2("workbench.notebook.layout.select.label", "Select between Notebook Layouts"),
      f1: true,
      precondition: ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true),
      category: NOTEBOOK_ACTIONS_CATEGORY,
      menu: [
        {
          id: MenuId.EditorTitle,
          group: "notebookLayout",
          when: ContextKeyExpr.and(
            NOTEBOOK_IS_ACTIVE_EDITOR,
            ContextKeyExpr.notEquals("config.notebook.globalToolbar", true),
            ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true)
          ),
          order: 0
        },
        {
          id: MenuId.NotebookToolbar,
          group: "notebookLayout",
          when: ContextKeyExpr.and(
            ContextKeyExpr.equals("config.notebook.globalToolbar", true),
            ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true)
          ),
          order: 0
        }
      ]
    });
  }
  run(accessor) {
    accessor.get(ICommandService).executeCommand("workbench.action.openWalkthrough", { category: "notebooks", step: "notebookProfile" }, true);
  }
});
registerAction2(class NotebookConfigureLayoutAction2 extends Action2 {
  constructor() {
    super({
      id: "workbench.notebook.layout.configure",
      title: localize2("workbench.notebook.layout.configure.label", "Customize Notebook Layout"),
      f1: true,
      category: NOTEBOOK_ACTIONS_CATEGORY,
      menu: [
        {
          id: MenuId.NotebookToolbar,
          group: "notebookLayout",
          when: ContextKeyExpr.equals("config.notebook.globalToolbar", true),
          order: 1
        }
      ]
    });
  }
  run(accessor) {
    accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: "@tag:notebookLayout" });
  }
});
registerAction2(class NotebookConfigureLayoutFromEditorTitle extends Action2 {
  constructor() {
    super({
      id: "workbench.notebook.layout.configure.editorTitle",
      title: localize2("workbench.notebook.layout.configure.label", "Customize Notebook Layout"),
      f1: false,
      category: NOTEBOOK_ACTIONS_CATEGORY,
      menu: [
        {
          id: MenuId.NotebookEditorLayoutConfigure,
          group: "notebookLayout",
          when: NOTEBOOK_IS_ACTIVE_EDITOR,
          order: 1
        }
      ]
    });
  }
  run(accessor) {
    accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: "@tag:notebookLayout" });
  }
});
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
  submenu: MenuId.NotebookEditorLayoutConfigure,
  rememberDefaultAction: false,
  title: localize2("customizeNotebook", "Customize Notebook..."),
  icon: Codicon.gear,
  group: "navigation",
  order: -1,
  when: NOTEBOOK_IS_ACTIVE_EDITOR
});
registerAction2(class ToggleLineNumberFromEditorTitle extends Action2 {
  constructor() {
    super({
      id: "notebook.toggleLineNumbersFromEditorTitle",
      title: localize2("notebook.toggleLineNumbers", "Toggle Notebook Line Numbers"),
      precondition: NOTEBOOK_EDITOR_FOCUSED,
      menu: [
        {
          id: MenuId.NotebookEditorLayoutConfigure,
          group: "notebookLayoutDetails",
          order: 1,
          when: NOTEBOOK_IS_ACTIVE_EDITOR
        }
      ],
      category: NOTEBOOK_ACTIONS_CATEGORY,
      f1: true,
      toggled: {
        condition: ContextKeyExpr.notEquals("config.notebook.lineNumbers", "off"),
        title: localize("notebook.showLineNumbers", "Notebook Line Numbers")
      }
    });
  }
  async run(accessor) {
    return accessor.get(ICommandService).executeCommand("notebook.toggleLineNumbers");
  }
});
registerAction2(class ToggleCellToolbarPositionFromEditorTitle extends Action2 {
  constructor() {
    super({
      id: "notebook.toggleCellToolbarPositionFromEditorTitle",
      title: localize2("notebook.toggleCellToolbarPosition", "Toggle Cell Toolbar Position"),
      menu: [{
        id: MenuId.NotebookEditorLayoutConfigure,
        group: "notebookLayoutDetails",
        order: 3
      }],
      category: NOTEBOOK_ACTIONS_CATEGORY,
      f1: false
    });
  }
  async run(accessor, ...args) {
    return accessor.get(ICommandService).executeCommand("notebook.toggleCellToolbarPosition", ...args);
  }
});
registerAction2(class ToggleBreadcrumbFromEditorTitle extends Action2 {
  constructor() {
    super({
      id: "breadcrumbs.toggleFromEditorTitle",
      title: localize2("notebook.toggleBreadcrumb", "Toggle Breadcrumbs"),
      menu: [{
        id: MenuId.NotebookEditorLayoutConfigure,
        group: "notebookLayoutDetails",
        order: 2
      }],
      f1: false
    });
  }
  async run(accessor) {
    return accessor.get(ICommandService).executeCommand("breadcrumbs.toggle");
  }
});
registerAction2(class SaveMimeTypeDisplayOrder extends Action2 {
  constructor() {
    super({
      id: "notebook.saveMimeTypeOrder",
      title: localize2("notebook.saveMimeTypeOrder", "Save Mimetype Display Order"),
      f1: true,
      category: NOTEBOOK_ACTIONS_CATEGORY,
      precondition: NOTEBOOK_IS_ACTIVE_EDITOR
    });
  }
  run(accessor) {
    const service = accessor.get(INotebookService);
    const disposables = new DisposableStore();
    const qp = disposables.add(accessor.get(IQuickInputService).createQuickPick());
    qp.placeholder = localize("notebook.placeholder", "Settings file to save in");
    qp.items = [
      { target: ConfigurationTarget.USER, label: localize("saveTarget.machine", "User Settings") },
      { target: ConfigurationTarget.WORKSPACE, label: localize("saveTarget.workspace", "Workspace Settings") }
    ];
    disposables.add(qp.onDidAccept(() => {
      const target = qp.selectedItems[0]?.target;
      if (target !== void 0) {
        service.saveMimeDisplayOrder(target);
      }
      qp.dispose();
    }));
    disposables.add(qp.onDidHide(() => disposables.dispose()));
    qp.show();
  }
});
registerAction2(class NotebookWebviewResetAction extends Action2 {
  constructor() {
    super({
      id: "workbench.notebook.layout.webview.reset",
      title: localize2("workbench.notebook.layout.webview.reset.label", "Reset Notebook Webview"),
      f1: false,
      category: NOTEBOOK_ACTIONS_CATEGORY
    });
  }
  run(accessor, args) {
    const editorService = accessor.get(IEditorService);
    if (args) {
      const uri = URI.revive(args);
      const notebookEditorService = accessor.get(INotebookEditorService);
      const widgets = notebookEditorService.listNotebookEditors().filter((widget) => widget.hasModel() && widget.textModel.uri.toString() === uri.toString());
      for (const widget of widgets) {
        if (widget.hasModel()) {
          widget.getInnerWebview()?.reload();
        }
      }
    } else {
      const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
      if (!editor) {
        return;
      }
      editor.getInnerWebview()?.reload();
    }
  }
});
registerAction2(class ToggleNotebookStickyScroll extends Action2 {
  constructor() {
    super({
      id: "notebook.action.toggleNotebookStickyScroll",
      title: {
        ...localize2("toggleStickyScroll", "Toggle Notebook Sticky Scroll"),
        mnemonicTitle: localize({ key: "mitoggleNotebookStickyScroll", comment: ["&& denotes a mnemonic"] }, "&&Toggle Notebook Sticky Scroll")
      },
      category: Categories.View,
      toggled: {
        condition: ContextKeyExpr.equals("config.notebook.stickyScroll.enabled", true),
        title: localize("notebookStickyScroll", "Toggle Notebook Sticky Scroll"),
        mnemonicTitle: localize({ key: "mitoggleNotebookStickyScroll", comment: ["&& denotes a mnemonic"] }, "&&Toggle Notebook Sticky Scroll")
      },
      menu: [
        { id: MenuId.CommandPalette },
        { id: MenuId.NotebookStickyScrollContext, group: "notebookView", order: 2 },
        { id: MenuId.NotebookToolbarContext, group: "notebookView", order: 2 }
      ]
    });
  }
  async run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    const newValue = !configurationService.getValue("notebook.stickyScroll.enabled");
    return configurationService.updateValue("notebook.stickyScroll.enabled", newValue);
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvbGF5b3V0QWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIE1lbnVSZWdpc3RyeSwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWSB9IGZyb20gJy4vY29yZUFjdGlvbnMuanMnO1xuaW1wb3J0IHsgZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZSB9IGZyb20gJy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rU2V0dGluZyB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19FRElUT1JfRk9DVVNFRCwgTk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUiB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgTm90ZWJvb2tDb25maWd1cmVMYXlvdXRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gubm90ZWJvb2subGF5b3V0LnNlbGVjdCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2gubm90ZWJvb2subGF5b3V0LnNlbGVjdC5sYWJlbCcsIFwiU2VsZWN0IGJldHdlZW4gTm90ZWJvb2sgTGF5b3V0c1wiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5vcGVuR2V0dGluZ1N0YXJ0ZWR9YCwgdHJ1ZSksXG5cdFx0XHRjYXRlZ29yeTogTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0Z3JvdXA6ICdub3RlYm9va0xheW91dCcsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Tk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUixcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7Tm90ZWJvb2tTZXR0aW5nLm9wZW5HZXR0aW5nU3RhcnRlZH1gLCB0cnVlKVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0b3JkZXI6IDBcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tUb29sYmFyLFxuXHRcdFx0XHRcdGdyb3VwOiAnbm90ZWJvb2tMYXlvdXQnLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7Tm90ZWJvb2tTZXR0aW5nLm9wZW5HZXR0aW5nU3RhcnRlZH1gLCB0cnVlKVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0b3JkZXI6IDBcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLm9wZW5XYWxrdGhyb3VnaCcsIHsgY2F0ZWdvcnk6ICdub3RlYm9va3MnLCBzdGVwOiAnbm90ZWJvb2tQcm9maWxlJyB9LCB0cnVlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBOb3RlYm9va0NvbmZpZ3VyZUxheW91dEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5ub3RlYm9vay5sYXlvdXQuY29uZmlndXJlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5ub3RlYm9vay5sYXlvdXQuY29uZmlndXJlLmxhYmVsJywgXCJDdXN0b21pemUgTm90ZWJvb2sgTGF5b3V0XCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tUb29sYmFyLFxuXHRcdFx0XHRcdGdyb3VwOiAnbm90ZWJvb2tMYXlvdXQnLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXInLCB0cnVlKSxcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0YWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5TZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCBxdWVyeTogJ0B0YWc6bm90ZWJvb2tMYXlvdXQnIH0pO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE5vdGVib29rQ29uZmlndXJlTGF5b3V0RnJvbUVkaXRvclRpdGxlIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLm5vdGVib29rLmxheW91dC5jb25maWd1cmUuZWRpdG9yVGl0bGUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLm5vdGVib29rLmxheW91dC5jb25maWd1cmUubGFiZWwnLCBcIkN1c3RvbWl6ZSBOb3RlYm9vayBMYXlvdXRcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRjYXRlZ29yeTogTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tFZGl0b3JMYXlvdXRDb25maWd1cmUsXG5cdFx0XHRcdFx0Z3JvdXA6ICdub3RlYm9va0xheW91dCcsXG5cdFx0XHRcdFx0d2hlbjogTk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUixcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0YWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5TZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCBxdWVyeTogJ0B0YWc6bm90ZWJvb2tMYXlvdXQnIH0pO1xuXHR9XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZSwge1xuXHRzdWJtZW51OiBNZW51SWQuTm90ZWJvb2tFZGl0b3JMYXlvdXRDb25maWd1cmUsXG5cdHJlbWVtYmVyRGVmYXVsdEFjdGlvbjogZmFsc2UsXG5cdHRpdGxlOiBsb2NhbGl6ZTIoJ2N1c3RvbWl6ZU5vdGVib29rJywgXCJDdXN0b21pemUgTm90ZWJvb2suLi5cIiksXG5cdGljb246IENvZGljb24uZ2Vhcixcblx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0b3JkZXI6IC0xLFxuXHR3aGVuOiBOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SXG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFRvZ2dsZUxpbmVOdW1iZXJGcm9tRWRpdG9yVGl0bGUgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdub3RlYm9vay50b2dnbGVMaW5lTnVtYmVyc0Zyb21FZGl0b3JUaXRsZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdub3RlYm9vay50b2dnbGVMaW5lTnVtYmVycycsICdUb2dnbGUgTm90ZWJvb2sgTGluZSBOdW1iZXJzJyksXG5cdFx0XHRwcmVjb25kaXRpb246IE5PVEVCT09LX0VESVRPUl9GT0NVU0VELFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0VkaXRvckxheW91dENvbmZpZ3VyZSxcblx0XHRcdFx0XHRncm91cDogJ25vdGVib29rTGF5b3V0RGV0YWlscycsXG5cdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdFx0d2hlbjogTk9URUJPT0tfSVNfQUNUSVZFX0VESVRPUlxuXHRcdFx0XHR9XSxcblx0XHRcdGNhdGVnb3J5OiBOT1RFQk9PS19BQ1RJT05TX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR0b2dnbGVkOiB7XG5cdFx0XHRcdGNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjb25maWcubm90ZWJvb2subGluZU51bWJlcnMnLCAnb2ZmJyksXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbm90ZWJvb2suc2hvd0xpbmVOdW1iZXJzJywgXCJOb3RlYm9vayBMaW5lIE51bWJlcnNcIiksXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSkuZXhlY3V0ZUNvbW1hbmQoJ25vdGVib29rLnRvZ2dsZUxpbmVOdW1iZXJzJyk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlQ2VsbFRvb2xiYXJQb3NpdGlvbkZyb21FZGl0b3JUaXRsZSBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ25vdGVib29rLnRvZ2dsZUNlbGxUb29sYmFyUG9zaXRpb25Gcm9tRWRpdG9yVGl0bGUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbm90ZWJvb2sudG9nZ2xlQ2VsbFRvb2xiYXJQb3NpdGlvbicsICdUb2dnbGUgQ2VsbCBUb29sYmFyIFBvc2l0aW9uJyksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rRWRpdG9yTGF5b3V0Q29uZmlndXJlLFxuXHRcdFx0XHRncm91cDogJ25vdGVib29rTGF5b3V0RGV0YWlscycsXG5cdFx0XHRcdG9yZGVyOiAzXG5cdFx0XHR9XSxcblx0XHRcdGNhdGVnb3J5OiBOT1RFQk9PS19BQ1RJT05TX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IGZhbHNlXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpLmV4ZWN1dGVDb21tYW5kKCdub3RlYm9vay50b2dnbGVDZWxsVG9vbGJhclBvc2l0aW9uJywgLi4uYXJncyk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlQnJlYWRjcnVtYkZyb21FZGl0b3JUaXRsZSBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2JyZWFkY3J1bWJzLnRvZ2dsZUZyb21FZGl0b3JUaXRsZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdub3RlYm9vay50b2dnbGVCcmVhZGNydW1iJywgJ1RvZ2dsZSBCcmVhZGNydW1icycpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va0VkaXRvckxheW91dENvbmZpZ3VyZSxcblx0XHRcdFx0Z3JvdXA6ICdub3RlYm9va0xheW91dERldGFpbHMnLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fV0sXG5cdFx0XHRmMTogZmFsc2Vcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKS5leGVjdXRlQ29tbWFuZCgnYnJlYWRjcnVtYnMudG9nZ2xlJyk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgU2F2ZU1pbWVUeXBlRGlzcGxheU9yZGVyIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbm90ZWJvb2suc2F2ZU1pbWVUeXBlT3JkZXInLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbm90ZWJvb2suc2F2ZU1pbWVUeXBlT3JkZXInLCBcIlNhdmUgTWltZXR5cGUgRGlzcGxheSBPcmRlclwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IE5PVEVCT09LX0FDVElPTlNfQ0FURUdPUlksXG5cdFx0XHRwcmVjb25kaXRpb246IE5PVEVCT09LX0lTX0FDVElWRV9FRElUT1IsXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBzZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RlYm9va1NlcnZpY2UpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHFwID0gZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpLmNyZWF0ZVF1aWNrUGljazxJUXVpY2tQaWNrSXRlbSAmIHsgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0IH0+KCkpO1xuXHRcdHFwLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ25vdGVib29rLnBsYWNlaG9sZGVyJywgJ1NldHRpbmdzIGZpbGUgdG8gc2F2ZSBpbicpO1xuXHRcdHFwLml0ZW1zID0gW1xuXHRcdFx0eyB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUiwgbGFiZWw6IGxvY2FsaXplKCdzYXZlVGFyZ2V0Lm1hY2hpbmUnLCAnVXNlciBTZXR0aW5ncycpIH0sXG5cdFx0XHR7IHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UsIGxhYmVsOiBsb2NhbGl6ZSgnc2F2ZVRhcmdldC53b3Jrc3BhY2UnLCAnV29ya3NwYWNlIFNldHRpbmdzJykgfSxcblx0XHRdO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHFwLm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdGNvbnN0IHRhcmdldCA9IHFwLnNlbGVjdGVkSXRlbXNbMF0/LnRhcmdldDtcblx0XHRcdGlmICh0YXJnZXQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRzZXJ2aWNlLnNhdmVNaW1lRGlzcGxheU9yZGVyKHRhcmdldCk7XG5cdFx0XHR9XG5cdFx0XHRxcC5kaXNwb3NlKCk7XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHFwLm9uRGlkSGlkZSgoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpKTtcblxuXHRcdHFwLnNob3coKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBOb3RlYm9va1dlYnZpZXdSZXNldEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5ub3RlYm9vay5sYXlvdXQud2Vidmlldy5yZXNldCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2gubm90ZWJvb2subGF5b3V0LndlYnZpZXcucmVzZXQubGFiZWwnLCBcIlJlc2V0IE5vdGVib29rIFdlYnZpZXdcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRjYXRlZ29yeTogTk9URUJPT0tfQUNUSU9OU19DQVRFR09SWVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IFVyaUNvbXBvbmVudHMpOiB2b2lkIHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGlmIChhcmdzKSB7XG5cdFx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKGFyZ3MpO1xuXHRcdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RlYm9va0VkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgd2lkZ2V0cyA9IG5vdGVib29rRWRpdG9yU2VydmljZS5saXN0Tm90ZWJvb2tFZGl0b3JzKCkuZmlsdGVyKHdpZGdldCA9PiB3aWRnZXQuaGFzTW9kZWwoKSAmJiB3aWRnZXQudGV4dE1vZGVsLnVyaS50b1N0cmluZygpID09PSB1cmkudG9TdHJpbmcoKSk7XG5cdFx0XHRmb3IgKGNvbnN0IHdpZGdldCBvZiB3aWRnZXRzKSB7XG5cdFx0XHRcdGlmICh3aWRnZXQuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRcdHdpZGdldC5nZXRJbm5lcldlYnZpZXcoKT8ucmVsb2FkKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUpO1xuXHRcdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IuZ2V0SW5uZXJXZWJ2aWV3KCk/LnJlbG9hZCgpO1xuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUb2dnbGVOb3RlYm9va1N0aWNreVNjcm9sbCBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ25vdGVib29rLmFjdGlvbi50b2dnbGVOb3RlYm9va1N0aWNreVNjcm9sbCcsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5sb2NhbGl6ZTIoJ3RvZ2dsZVN0aWNreVNjcm9sbCcsIFwiVG9nZ2xlIE5vdGVib29rIFN0aWNreSBTY3JvbGxcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWl0b2dnbGVOb3RlYm9va1N0aWNreVNjcm9sbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlRvZ2dsZSBOb3RlYm9vayBTdGlja3kgU2Nyb2xsXCIpLFxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLlZpZXcsXG5cdFx0XHR0b2dnbGVkOiB7XG5cdFx0XHRcdGNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcubm90ZWJvb2suc3RpY2t5U2Nyb2xsLmVuYWJsZWQnLCB0cnVlKSxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdub3RlYm9va1N0aWNreVNjcm9sbCcsIFwiVG9nZ2xlIE5vdGVib29rIFN0aWNreSBTY3JvbGxcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWl0b2dnbGVOb3RlYm9va1N0aWNreVNjcm9sbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlRvZ2dsZSBOb3RlYm9vayBTdGlja3kgU2Nyb2xsXCIpLFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0eyBpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlIH0sXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5Ob3RlYm9va1N0aWNreVNjcm9sbENvbnRleHQsIGdyb3VwOiAnbm90ZWJvb2tWaWV3Jywgb3JkZXI6IDIgfSxcblx0XHRcdFx0eyBpZDogTWVudUlkLk5vdGVib29rVG9vbGJhckNvbnRleHQsIGdyb3VwOiAnbm90ZWJvb2tWaWV3Jywgb3JkZXI6IDIgfVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBuZXdWYWx1ZSA9ICFjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnbm90ZWJvb2suc3RpY2t5U2Nyb2xsLmVuYWJsZWQnKTtcblx0XHRyZXR1cm4gY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ25vdGVib29rLnN0aWNreVNjcm9sbC5lbmFibGVkJywgbmV3VmFsdWUpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQTBCO0FBQ25DLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLFFBQVEsY0FBYyx1QkFBdUI7QUFDL0QsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQkFBcUIsNkJBQTZCO0FBQzNELFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsMEJBQTBDO0FBQ25ELFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCLGlDQUFpQztBQUNuRSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUVwQyxnQkFBZ0IsTUFBTSxzQ0FBc0MsUUFBUTtBQUFBLEVBQ25FLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLFVBQVUsMENBQTBDLGlDQUFpQztBQUFBLE1BQzVGLElBQUk7QUFBQSxNQUNKLGNBQWMsZUFBZSxPQUFPLFVBQVUsZ0JBQWdCLGtCQUFrQixJQUFJLElBQUk7QUFBQSxNQUN4RixVQUFVO0FBQUEsTUFDVixNQUFNO0FB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LE1BQU07QUFDVCxZQUFNLE1BQU0sSUFBSSxPQUFPLElBQUk7QUFDM0IsWUFBTSx3QkFBd0IsU0FBUyxJQUFJLHNCQUFzQjtBQUNqRSxZQUFNLFVBQVUsc0JBQXNCLG9CQUFvQixFQUFFLE9BQU8sWUFBVSxPQUFPLFNBQVMsS0FBSyxPQUFPLFVBQVUsSUFBSSxTQUFTLE1BQU0sSUFBSSxTQUFTLENBQUM7QUFDcEosaUJBQVcsVUFBVSxTQUFTO0FBQzdCLFlBQUksT0FBTyxTQUFTLEdBQUc7QUFDdEIsaUJBQU8sZ0JBQWdCLEdBQUcsT0FBTztBQUFBLFFBQ2xDO0FBQUEsTUFDRDtBQUFBLElBQ0QsT0FBTztBQUNOLFlBQU0sU0FBUyxnQ0FBZ0MsY0FBYyxnQkFBZ0I7QUFDN0UsVUFBSSxDQUFDLFFBQVE7QUFDWjtBQUFBLE1BQ0Q7QUFFQSxhQUFPLGdCQUFnQixHQUFHLE9BQU87QUFBQSxJQUNsQztBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBRUQsZ0JBQWdCLE1BQU0sbUNBQW1DLFFBQVE7QUFBQSxFQUNoRSxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sR0FBRyxVQUFVLHNCQUFzQiwrQkFBK0I7QUFBQSxRQUNsRSxlQUFlLFNBQVMsRUFBRSxLQUFLLGdDQUFnQyxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxpQ0FBaUM7QUFBQSxNQUN2STtBQUFBLE1BQ0EsVUFBVSxXQUFXO0FBQUEsTUFDckIsU0FBUztBQUFBLFFBQ1IsV0FBVyxlQUFlLE9BQU8sd0NBQXdDLElBQUk7QUFBQSxRQUM3RSxPQUFPLFNBQVMsd0JBQXdCLCtCQUErQjtBQUFBLFFBQ3ZFLGVBQWUsU0FBUyxFQUFFLEtBQUssZ0NBQWdDLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLGlDQUFpQztBQUFBLE1BQ3ZJO0FBQUEsTUFDQSxNQUFNO0FBQUEsUUFDTCxFQUFFLElBQUksT0FBTyxlQUFlO0FBQUEsUUFDNUIsRUFBRSxJQUFJLE9BQU8sNkJBQTZCLE9BQU8sZ0JBQWdCLE9BQU8sRUFBRTtBQUFBLFFBQzFFLEVBQUUsSUFBSSxPQUFPLHdCQUF3QixPQUFPLGdCQUFnQixPQUFPLEVBQUU7QUFBQSxNQUN0RTtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQWUsSUFBSSxVQUEyQztBQUM3RCxVQUFNLHVCQUF1QixTQUFTLElBQUkscUJBQXFCO0FBQy9ELFVBQU0sV0FBVyxDQUFDLHFCQUFxQixTQUFTLCtCQUErQjtBQUMvRSxXQUFPLHFCQUFxQixZQUFZLGlDQUFpQyxRQUFRO0FBQUEsRUFDbEY7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJOb3RlYm9va0NvbmZpZ3VyZUxheW91dEFjdGlvbiJdCn0K
