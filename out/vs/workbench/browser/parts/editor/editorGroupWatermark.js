var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { localize } from "../../../../nls.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { isMacintosh, isNative, OS } from "../../../../base/common/platform.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { isRecentFolder, IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { append, clearNode, $, h } from "../../../../base/browser/dom.js";
import { KeybindingLabel } from "../../../../base/browser/ui/keybindingLabel/keybindingLabel.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { defaultKeybindingLabelStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { editorForeground, registerColor, transparent } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ColorScheme } from "../../web.api.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { OpenFileFolderAction, OpenFolderAction } from "../../actions/workspaceActions.js";
import { splitRecentLabel } from "../../../../base/common/labels.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { VOID_CTRL_K_ACTION_ID, VOID_CTRL_L_ACTION_ID } from "../../../contrib/void/browser/actionIDs.js";
import { VIEWLET_ID as REMOTE_EXPLORER_VIEWLET_ID } from "../../../contrib/remote/browser/remoteExplorer.js";
const VOLT_PENDING_MESSAGE_KEY = "volt.pendingStartupMessage";
let EditorGroupWatermark = class extends Disposable {
  constructor(container, keybindingService, contextService, configurationService, themeService, workspacesService, commandService, hostService, labelService, viewsService) {
    super();
    this.keybindingService = keybindingService;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.themeService = themeService;
    this.workspacesService = workspacesService;
    this.commandService = commandService;
    this.hostService = hostService;
    this.labelService = labelService;
    this.viewsService = viewsService;
    this.transientDisposables = this._register(new DisposableStore());
    this.currentDisposables = /* @__PURE__ */ new Set();
    const elements = h(".editor-group-watermark", [
      h(".letterpress@icon"),
      h(".shortcuts@shortcuts")
    ]);
    append(container, elements.root);
    this.shortcuts = elements.shortcuts;
    const updateTheme = () => {
      const theme = this.themeService.getColorTheme().type;
      const isDark = theme === ColorScheme.DARK || theme === ColorScheme.HIGH_CONTRAST_DARK;
      elements.icon.style.maxWidth = "220px";
      elements.icon.style.opacity = "50%";
      elements.icon.style.filter = isDark ? "" : "invert(1)";
    };
    updateTheme();
    this._register(this.themeService.onDidColorThemeChange(updateTheme));
    this.registerListeners();
    this.workbenchState = contextService.getWorkbenchState();
    this.render();
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.tips.enabled")) {
        this.render();
      }
    }));
    this._register(this.contextService.onDidChangeWorkbenchState((workbenchState) => {
      if (this.workbenchState === workbenchState) {
        return;
      }
      this.workbenchState = workbenchState;
      this.render();
    }));
  }
  render() {
    this.clear();
    const voidIconBox = append(this.shortcuts, $(".watermark-box"));
    const recentsBox = append(this.shortcuts, $("div"));
    recentsBox.style.display = "flex";
    recentsBox.style.flex = "row";
    recentsBox.style.justifyContent = "center";
    const update = async () => {
      const recentlyOpened = await this.workspacesService.getRecentlyOpened()
        .catch(() => ({ files: [], workspaces: [] })).then((w) => w.workspaces);
      clearNode(voidIconBox);
      clearNode(recentsBox);
      this.currentDisposables.forEach((label) => label.dispose());
      this.currentDisposables.clear();
      if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
        const buttonContainer = $("div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.flexDirection = "column";
        buttonContainer.style.alignItems = "center";
        buttonContainer.style.gap = "8px";
        buttonContainer.style.marginBottom = "16px";
        voidIconBox.appendChild(buttonContainer);
        const openFolderButton = h("button");
        openFolderButton.root.classList.add("void-openfolder-button");
        openFolderButton.root.style.display = "block";
        openFolderButton.root.style.width = "124px";
        openFolderButton.root.textContent = "Open Folder";
        openFolderButton.root.onclick = () => {
          this.commandService.executeCommand(isMacintosh && isNative ? OpenFileFolderAction.ID : OpenFolderAction.ID);
        };
        buttonContainer.appendChild(openFolderButton.root);
        const openSSHButton = h("button");
        openSSHButton.root.classList.add("void-openssh-button");
        openSSHButton.root.style.display = "block";
        openSSHButton.root.style.backgroundColor = "#5a5a5a";
        openSSHButton.root.style.width = "124px";
        openSSHButton.root.textContent = "Open SSH";
        openSSHButton.root.onclick = () => {
          this.viewsService.openViewContainer(REMOTE_EXPLORER_VIEWLET_ID);
        };
        buttonContainer.appendChild(openSSHButton.root);
        if (recentlyOpened.length !== 0) {
          voidIconBox.append(
            ...recentlyOpened.map((w, i) => {
              let fullPath;
              let windowOpenable;
              if (isRecentFolder(w)) {
                windowOpenable = { folderUri: w.folderUri };
                fullPath = w.label || this.labelService.getWorkspaceLabel(w.folderUri, { verbose: Verbosity.LONG });
              } else {
                return null;
              }
              const { name, parentPath } = splitRecentLabel(fullPath);
              const linkSpan = $("span");
              linkSpan.classList.add("void-link");
              linkSpan.style.display = "flex";
              linkSpan.style.gap = "4px";
              linkSpan.style.padding = "8px";
              linkSpan.addEventListener("click", (e) => {
                this.hostService.openWindow([windowOpenable], {
                  forceNewWindow: e.ctrlKey || e.metaKey,
                  remoteAuthority: w.remoteAuthority || null
                });
                e.preventDefault();
                e.stopPropagation();
              });
              const nameSpan = $("span");
              nameSpan.innerText = name;
              nameSpan.title = fullPath;
              linkSpan.appendChild(nameSpan);
              const dirSpan = $("span");
              dirSpan.style.paddingLeft = "4px";
              dirSpan.style.whiteSpace = "nowrap";
              dirSpan.style.overflow = "hidden";
              dirSpan.style.maxWidth = "300px";
              dirSpan.innerText = parentPath;
              dirSpan.title = fullPath;
              linkSpan.appendChild(dirSpan);
              return linkSpan;
            }).filter((v) => !!v).slice(0, 5)
          );
        }
      } else {
        const keys = this.keybindingService.lookupKeybinding(VOID_CTRL_L_ACTION_ID);
        const dl = append(voidIconBox, $("dl"));
        const dt = append(dl, $("dt"));
        dt.textContent = "Chat";
        const dd = append(dl, $("dd"));
        const label = new KeybindingLabel(dd, OS, { renderUnboundKeybindings: true, ...defaultKeybindingLabelStyles });
        if (keys) label.set(keys);
        this.currentDisposables.add(label);
        const keys2 = this.keybindingService.lookupKeybinding(VOID_CTRL_K_ACTION_ID);
        const dl2 = append(voidIconBox, $("dl"));
        const dt2 = append(dl2, $("dt"));
        dt2.textContent = "Quick Edit";
        const dd2 = append(dl2, $("dd"));
        const label2 = new KeybindingLabel(dd2, OS, { renderUnboundKeybindings: true, ...defaultKeybindingLabelStyles });
        if (keys2) label2.set(keys2);
        this.currentDisposables.add(label2);
      }
    };
    update();
    this.transientDisposables.add(this.keybindingService.onDidUpdateKeybindings(update));
  }
  clear() {
    clearNode(this.shortcuts);
    this.transientDisposables.clear();
  }
  dispose() {
    super.dispose();
    this.clear();
    this.currentDisposables.forEach((label) => label.dispose());
  }
};
EditorGroupWatermark = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IWorkspacesService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IHostService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, IViewsService)
], EditorGroupWatermark);
registerColor("editorWatermark.foreground", { dark: transparent(editorForeground, 0.6), light: transparent(editorForeground, 0.68), hcDark: editorForeground, hcLight: editorForeground }, localize("editorLineHighlight", "Foreground color for the labels in the editor watermark."));
export {
  EditorGroupWatermark,
  VOLT_PENDING_MESSAGE_KEY
};
