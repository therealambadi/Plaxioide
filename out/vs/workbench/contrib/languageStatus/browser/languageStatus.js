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
import "./media/languageStatus.css";
import * as dom from "../../../../base/browser/dom.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import Severity from "../../../../base/common/severity.js";
import { getCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { localize, localize2 } from "../../../../nls.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ILanguageStatusService } from "../../../services/languageStatus/common/languageStatusService.js";
import { IStatusbarService, ShowTooltipCommand, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Action } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { equals } from "../../../../base/common/arrays.js";
import { URI } from "../../../../base/common/uri.js";
import { Action2 } from "../../../../platform/actions/common/actions.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IHoverService, nativeHoverDelegate } from "../../../../platform/hover/browser/hover.js";
import { Event } from "../../../../base/common/event.js";
import { joinStrings } from "../../../../base/common/strings.js";
class LanguageStatusViewModel {
  constructor(combined, dedicated) {
    this.combined = combined;
    this.dedicated = dedicated;
  }
  isEqual(other) {
    return equals(this.combined, other.combined) && equals(this.dedicated, other.dedicated);
  }
}
let StoredCounter = class {
  constructor(_storageService, _key) {
    this._storageService = _storageService;
    this._key = _key;
  }
  get value() {
    return this._storageService.getNumber(this._key, StorageScope.PROFILE, 0);
  }
  increment() {
    const n = this.value + 1;
    this._storageService.store(this._key, n, StorageScope.PROFILE, StorageTarget.MACHINE);
    return n;
  }
};
StoredCounter = __decorateClass([
  __decorateParam(0, IStorageService)
], StoredCounter);
let LanguageStatusContribution = class extends Disposable {
  constructor(editorGroupService) {
    super();
    this.editorGroupService = editorGroupService;
    for (const part of editorGroupService.parts) {
      this.createLanguageStatus(part);
    }
    this._register(editorGroupService.onDidCreateAuxiliaryEditorPart((part) => this.createLanguageStatus(part)));
  }
  createLanguageStatus(part) {
    const disposables = new DisposableStore();
    Event.once(part.onWillDispose)(() => disposables.dispose());
    const scopedInstantiationService = this.editorGroupService.getScopedInstantiationService(part);
    disposables.add(scopedInstantiationService.createInstance(LanguageStatus));
  }
};
LanguageStatusContribution.Id = "status.languageStatus";
LanguageStatusContribution = __decorateClass([
  __decorateParam(0, IEditorGroupsService)
], LanguageStatusContribution);
let LanguageStatus = class {
  constructor(_languageStatusService, _statusBarService, _editorService, _hoverService, _openerService, _storageService) {
    this._languageStatusService = _languageStatusService;
    this._statusBarService = _statusBarService;
    this._editorService = _editorService;
    this._hoverService = _hoverService;
    this._openerService = _openerService;
    this._storageService = _storageService;
    this._disposables = new DisposableStore();
    this._dedicated = /* @__PURE__ */ new Set();
    this._dedicatedEntries = /* @__PURE__ */ new Map();
    this._renderDisposables = new DisposableStore();
    this._combinedEntryTooltip = document.createElement("div");
    _storageService.onDidChangeValue(StorageScope.PROFILE, LanguageStatus._keyDedicatedItems, this._disposables)(this._handleStorageChange, this, this._disposables);
    this._restoreState();
    this._interactionCounter = new StoredCounter(_storageService, "languageStatus.interactCount");
    _languageStatusService.onDidChange(this._update, this, this._disposables);
    _editorService.onDidActiveEditorChange(this._update, this, this._disposables);
    this._update();
    _statusBarService.onDidChangeEntryVisibility((e) => {
      if (!e.visible && this._dedicated.has(e.id)) {
        this._dedicated.delete(e.id);
        this._update();
        this._storeState();
      }
    }, void 0, this._disposables);
  }
  dispose() {
    this._disposables.dispose();
    this._combinedEntry?.dispose();
    dispose(this._dedicatedEntries.values());
    this._renderDisposables.dispose();
  }
  // --- persisting dedicated items
  _handleStorageChange() {
    this._restoreState();
    this._update();
  }
  _restoreState() {
    const raw = this._storageService.get(LanguageStatus._keyDedicatedItems, StorageScope.PROFILE, "[]");
    try {
      const ids = JSON.parse(raw);
      this._dedicated = new Set(ids);
    } catch {
      this._dedicated.clear();
    }
  }
  _storeState() {
    if (this._dedicated.size === 0) {
      this._storageService.remove(LanguageStatus._keyDedicatedItems, StorageScope.PROFILE);
    } else {
      const raw = JSON.stringify(Array.from(this._dedicated.keys()));
      this._storageService.store(LanguageStatus._keyDedicatedItems, raw, StorageScope.PROFILE, StorageTarget.USER);
    }
  }
  // --- language status model and UI
  _createViewModel(editor) {
    if (!editor?.hasModel()) {
      return new LanguageStatusViewModel([], []);
    }
    const all = this._languageStatusService.getLanguageStatus(editor.getModel());
    const combined = [];
    const dedicated = [];
    for (const item of all) {
      if (this._dedicated.has(item.id)) {
        dedicated.push(item);
      }
      combined.push(item);
    }
    return new LanguageStatusViewModel(combined, dedicated);
  }
  _update() {
    const editor = getCodeEditor(this._editorService.activeTextEditorControl);
    const model = this._createViewModel(editor);
    if (this._model?.isEqual(model)) {
      return;
    }
    this._renderDisposables.clear();
    this._model = model;
    editor?.onDidChangeModelLanguage(this._update, this, this._renderDisposables);
    if (model.combined.length === 0) {
      this._combinedEntry?.dispose();
      this._combinedEntry = void 0;
    } else {
      const [first] = model.combined;
      const showSeverity = first.severity >= Severity.Warning;
      const text = LanguageStatus._severityToComboCodicon(first.severity);
      let isOneBusy = false;
      const ariaLabels = [];
      for (const status of model.combined) {
        const isPinned = model.dedicated.includes(status);
        this._renderStatus(this._combinedEntryTooltip, status, showSeverity, isPinned, this._renderDisposables);
        ariaLabels.push(LanguageStatus._accessibilityInformation(status).label);
        isOneBusy = isOneBusy || !isPinned && status.busy;
      }
      const props = {
        name: localize("langStatus.name", "Editor Language Status"),
        ariaLabel: localize("langStatus.aria", "Editor Language Status: {0}", ariaLabels.join(", next: ")),
        tooltip: this._combinedEntryTooltip,
        command: ShowTooltipCommand,
        text: isOneBusy ? "$(loading~spin)" : text
      };
      if (!this._combinedEntry) {
        this._combinedEntry = this._statusBarService.addEntry(props, LanguageStatus._id, StatusbarAlignment.RIGHT, { location: { id: "status.editor.mode", priority: 100.1 }, alignment: StatusbarAlignment.LEFT, compact: true });
      } else {
        this._combinedEntry.update(props);
      }
      const userHasInteractedWithStatus = this._interactionCounter.value >= 3;
      const targetWindow = dom.getWindow(editor?.getContainerDomNode());
      const node = targetWindow.document.querySelector(".monaco-workbench .statusbar DIV#status\\.languageStatus A>SPAN.codicon");
      const container = targetWindow.document.querySelector(".monaco-workbench .statusbar DIV#status\\.languageStatus");
      if (dom.isHTMLElement(node) && container) {
        const _wiggle = "wiggle";
        const _flash = "flash";
        if (!isOneBusy) {
          node.classList.toggle(_wiggle, showSeverity || !userHasInteractedWithStatus);
          this._renderDisposables.add(dom.addDisposableListener(node, "animationend", (_e) => node.classList.remove(_wiggle)));
          container.classList.toggle(_flash, showSeverity);
          this._renderDisposables.add(dom.addDisposableListener(container, "animationend", (_e) => container.classList.remove(_flash)));
        } else {
          node.classList.remove(_wiggle);
          container.classList.remove(_flash);
        }
      }
      if (!userHasInteractedWithStatus) {
        const hoverTarget = targetWindow.document.querySelector(".monaco-workbench .context-view");
        if (dom.isHTMLElement(hoverTarget)) {
          const observer = new MutationObserver(() => {
            if (targetWindow.document.contains(this._combinedEntryTooltip)) {
              this._interactionCounter.increment();
              observer.disconnect();
            }
          });
          observer.observe(hoverTarget, { childList: true, subtree: true });
          this._renderDisposables.add(toDisposable(() => observer.disconnect()));
        }
      }
    }
    const newDedicatedEntries = /* @__PURE__ */ new Map();
    for (const status of model.dedicated) {
      const props = LanguageStatus._asStatusbarEntry(status);
      let entry = this._dedicatedEntries.get(status.id);
      if (!entry) {
        entry = this._statusBarService.addEntry(props, status.id, StatusbarAlignment.RIGHT, { location: { id: "status.editor.mode", priority: 100.1 }, alignment: StatusbarAlignment.RIGHT });
      } else {
        entry.update(props);
        this._dedicatedEntries.delete(status.id);
      }
      newDedicatedEntries.set(status.id, entry);
    }
    dispose(this._dedicatedEntries.values());
    this._dedicatedEntries = newDedicatedEntries;
  }
  _renderStatus(container, status, showSeverity, isPinned, store) {
    const parent = document.createElement("div");
    parent.classList.add("hover-language-status");
    container.appendChild(parent);
    store.add(toDisposable(() => parent.remove()));
    const severity = document.createElement("div");
    severity.classList.add("severity", `sev${status.severity}`);
    severity.classList.toggle("show", showSeverity);
    const severityText = LanguageStatus._severityToSingleCodicon(status.severity);
    dom.append(severity, ...renderLabelWithIcons(severityText));
    parent.appendChild(severity);
    const element = document.createElement("div");
    element.classList.add("element");
    parent.appendChild(element);
    const left = document.createElement("div");
    left.classList.add("left");
    element.appendChild(left);
    const label = document.createElement("span");
    label.classList.add("label");
    const labelValue = typeof status.label === "string" ? status.label : status.label.value;
    dom.append(label, ...renderLabelWithIcons(computeText(labelValue, status.busy)));
    left.appendChild(label);
    const detail = document.createElement("span");
    detail.classList.add("detail");
    this._renderTextPlus(detail, status.detail, store);
    left.appendChild(detail);
    const right = document.createElement("div");
    right.classList.add("right");
    element.appendChild(right);
    const { command } = status;
    if (command) {
      store.add(new Link(right, {
        label: command.title,
        title: command.tooltip,
        href: URI.from({
          scheme: "command",
          path: command.id,
          query: command.arguments && JSON.stringify(command.arguments)
        }).toString()
      }, { hoverDelegate: nativeHoverDelegate }, this._hoverService, this._openerService));
    }
    const actionBar = new ActionBar(right, { hoverDelegate: nativeHoverDelegate });
    const actionLabel = isPinned ? localize("unpin", "Remove from Status Bar") : localize("pin", "Add to Status Bar");
    actionBar.setAriaLabel(actionLabel);
    store.add(actionBar);
    let action;
    if (!isPinned) {
      action = new Action("pin", actionLabel, ThemeIcon.asClassName(Codicon.pin), true, () => {
        this._dedicated.add(status.id);
        this._statusBarService.updateEntryVisibility(status.id, true);
        this._update();
        this._storeState();
      });
    } else {
      action = new Action("unpin", actionLabel, ThemeIcon.asClassName(Codicon.pinned), true, () => {
        this._dedicated.delete(status.id);
        this._statusBarService.updateEntryVisibility(status.id, false);
        this._update();
        this._storeState();
      });
    }
    actionBar.push(action, { icon: true, label: false });
    store.add(action);
    return parent;
  }
  static _severityToComboCodicon(sev) {
    switch (sev) {
      case Severity.Error:
        return "$(bracket-error)";
      case Severity.Warning:
        return "$(bracket-dot)";
      default:
        return "$(bracket)";
    }
  }
  static _severityToSingleCodicon(sev) {
    switch (sev) {
      case Severity.Error:
        return "$(error)";
      case Severity.Warning:
        return "$(info)";
      default:
        return "$(check)";
    }
  }
  _renderTextPlus(target, text, store) {
    for (const node of parseLinkedText(text).nodes) {
      if (typeof node === "string") {
        const parts = renderLabelWithIcons(node);
        dom.append(target, ...parts);
      } else {
        store.add(new Link(target, node, void 0, this._hoverService, this._openerService));
      }
    }
  }
  static _accessibilityInformation(status) {
    if (status.accessibilityInfo) {
      return status.accessibilityInfo;
    }
    const textValue = typeof status.label === "string" ? status.label : status.label.value;
    if (status.detail) {
      return { label: localize("aria.1", "{0}, {1}", textValue, status.detail) };
    } else {
      return { label: localize("aria.2", "{0}", textValue) };
    }
  }
  // ---
  static _asStatusbarEntry(item) {
    let kind;
    if (item.severity === Severity.Warning) {
      kind = "warning";
    } else if (item.severity === Severity.Error) {
      kind = "error";
    }
    const textValue = typeof item.label === "string" ? item.label : item.label.shortValue;
    return {
      name: localize("name.pattern", "{0} (Language Status)", item.name),
      text: computeText(textValue, item.busy),
      ariaLabel: LanguageStatus._accessibilityInformation(item).label,
      role: item.accessibilityInfo?.role,
      tooltip: item.command?.tooltip || new MarkdownString(item.detail, { isTrusted: true, supportThemeIcons: true }),
      kind,
      command: item.command
    };
  }
};
LanguageStatus._id = "status.languageStatus";
LanguageStatus._keyDedicatedItems = "languageStatus.dedicated";
LanguageStatus = __decorateClass([
  __decorateParam(0, ILanguageStatusService),
  __decorateParam(1, IStatusbarService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IStorageService)
], LanguageStatus);
class ResetAction extends Action2 {
  constructor() {
    super({
      id: "editor.inlayHints.Reset",
      title: localize2("reset", "Reset Language Status Interaction Counter"),
      category: Categories.View,
      f1: true
    });
  }
  run(accessor) {
    accessor.get(IStorageService).remove("languageStatus.interactCount", StorageScope.PROFILE);
  }
}
function computeText(text, loading) {
  return joinStrings([text !== "" && text, loading && "$(loading~spin)"], "\xA0\xA0");
}
export {
  LanguageStatusContribution,
  ResetAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9sYW5ndWFnZVN0YXR1cy9icm93c2VyL2xhbmd1YWdlU3RhdHVzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL2xhbmd1YWdlU3RhdHVzLmNzcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgZ2V0Q29kZUVkaXRvciwgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTdGF0dXMsIElMYW5ndWFnZVN0YXR1c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYW5ndWFnZVN0YXR1cy9jb21tb24vbGFuZ3VhZ2VTdGF0dXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdGF0dXNiYXJFbnRyeSwgSVN0YXR1c2JhckVudHJ5QWNjZXNzb3IsIElTdGF0dXNiYXJTZXJ2aWNlLCBTaG93VG9vbHRpcENvbW1hbmQsIFN0YXR1c2JhckFsaWdubWVudCwgU3RhdHVzYmFyRW50cnlLaW5kIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc3RhdHVzYmFyL2Jyb3dzZXIvc3RhdHVzYmFyLmpzJztcbmltcG9ydCB7IHBhcnNlTGlua2VkVGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZFRleHQuanMnO1xuaW1wb3J0IHsgTGluayB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9icm93c2VyL2xpbmsuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UsIElFZGl0b3JQYXJ0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UsIG5hdGl2ZUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgam9pblN0cmluZ3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcblxuY2xhc3MgTGFuZ3VhZ2VTdGF0dXNWaWV3TW9kZWwge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGNvbWJpbmVkOiByZWFkb25seSBJTGFuZ3VhZ2VTdGF0dXNbXSxcblx0XHRyZWFkb25seSBkZWRpY2F0ZWQ6IHJlYWRvbmx5IElMYW5ndWFnZVN0YXR1c1tdXG5cdCkgeyB9XG5cblx0aXNFcXVhbChvdGhlcjogTGFuZ3VhZ2VTdGF0dXNWaWV3TW9kZWwpIHtcblx0XHRyZXR1cm4gZXF1YWxzKHRoaXMuY29tYmluZWQsIG90aGVyLmNvbWJpbmVkKSAmJiBlcXVhbHModGhpcy5kZWRpY2F0ZWQsIG90aGVyLmRlZGljYXRlZCk7XG5cdH1cbn1cblxuY2xhc3MgU3RvcmVkQ291bnRlciB7XG5cblx0Y29uc3RydWN0b3IoQElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLCBwcml2YXRlIHJlYWRvbmx5IF9rZXk6IHN0cmluZykgeyB9XG5cblx0Z2V0IHZhbHVlKCkge1xuXHRcdHJldHVybiB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXROdW1iZXIodGhpcy5fa2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgMCk7XG5cdH1cblxuXHRpbmNyZW1lbnQoKTogbnVtYmVyIHtcblx0XHRjb25zdCBuID0gdGhpcy52YWx1ZSArIDE7XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUodGhpcy5fa2V5LCBuLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRyZXR1cm4gbjtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTGFuZ3VhZ2VTdGF0dXNDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElkID0gJ3N0YXR1cy5sYW5ndWFnZVN0YXR1cyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGZvciAoY29uc3QgcGFydCBvZiBlZGl0b3JHcm91cFNlcnZpY2UucGFydHMpIHtcblx0XHRcdHRoaXMuY3JlYXRlTGFuZ3VhZ2VTdGF0dXMocGFydCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yR3JvdXBTZXJ2aWNlLm9uRGlkQ3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydChwYXJ0ID0+IHRoaXMuY3JlYXRlTGFuZ3VhZ2VTdGF0dXMocGFydCkpKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlTGFuZ3VhZ2VTdGF0dXMocGFydDogSUVkaXRvclBhcnQpOiB2b2lkIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRFdmVudC5vbmNlKHBhcnQub25XaWxsRGlzcG9zZSkoKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpKTtcblxuXHRcdGNvbnN0IHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuZ2V0U2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UocGFydCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExhbmd1YWdlU3RhdHVzKSk7XG5cdH1cbn1cblxuY2xhc3MgTGFuZ3VhZ2VTdGF0dXMge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9pZCA9ICdzdGF0dXMubGFuZ3VhZ2VTdGF0dXMnO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9rZXlEZWRpY2F0ZWRJdGVtcyA9ICdsYW5ndWFnZVN0YXR1cy5kZWRpY2F0ZWQnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnRlcmFjdGlvbkNvdW50ZXI6IFN0b3JlZENvdW50ZXI7XG5cblx0cHJpdmF0ZSBfZGVkaWNhdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0cHJpdmF0ZSBfbW9kZWw/OiBMYW5ndWFnZVN0YXR1c1ZpZXdNb2RlbDtcblx0cHJpdmF0ZSBfY29tYmluZWRFbnRyeT86IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yO1xuXHRwcml2YXRlIF9kZWRpY2F0ZWRFbnRyaWVzID0gbmV3IE1hcDxzdHJpbmcsIElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZW5kZXJEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb21iaW5lZEVudHJ5VG9vbHRpcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFuZ3VhZ2VTdGF0dXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU3RhdHVzU2VydmljZTogSUxhbmd1YWdlU3RhdHVzU2VydmljZSxcblx0XHRASVN0YXR1c2JhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RhdHVzQmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRfc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuUFJPRklMRSwgTGFuZ3VhZ2VTdGF0dXMuX2tleURlZGljYXRlZEl0ZW1zLCB0aGlzLl9kaXNwb3NhYmxlcykodGhpcy5faGFuZGxlU3RvcmFnZUNoYW5nZSwgdGhpcywgdGhpcy5fZGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMuX3Jlc3RvcmVTdGF0ZSgpO1xuXHRcdHRoaXMuX2ludGVyYWN0aW9uQ291bnRlciA9IG5ldyBTdG9yZWRDb3VudGVyKF9zdG9yYWdlU2VydmljZSwgJ2xhbmd1YWdlU3RhdHVzLmludGVyYWN0Q291bnQnKTtcblxuXHRcdF9sYW5ndWFnZVN0YXR1c1NlcnZpY2Uub25EaWRDaGFuZ2UodGhpcy5fdXBkYXRlLCB0aGlzLCB0aGlzLl9kaXNwb3NhYmxlcyk7XG5cdFx0X2VkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UodGhpcy5fdXBkYXRlLCB0aGlzLCB0aGlzLl9kaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy5fdXBkYXRlKCk7XG5cblx0XHRfc3RhdHVzQmFyU2VydmljZS5vbkRpZENoYW5nZUVudHJ5VmlzaWJpbGl0eShlID0+IHtcblx0XHRcdGlmICghZS52aXNpYmxlICYmIHRoaXMuX2RlZGljYXRlZC5oYXMoZS5pZCkpIHtcblx0XHRcdFx0dGhpcy5fZGVkaWNhdGVkLmRlbGV0ZShlLmlkKTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlKCk7XG5cdFx0XHRcdHRoaXMuX3N0b3JlU3RhdGUoKTtcblx0XHRcdH1cblx0XHR9LCB1bmRlZmluZWQsIHRoaXMuX2Rpc3Bvc2FibGVzKTtcblxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY29tYmluZWRFbnRyeT8uZGlzcG9zZSgpO1xuXHRcdGRpc3Bvc2UodGhpcy5fZGVkaWNhdGVkRW50cmllcy52YWx1ZXMoKSk7XG5cdFx0dGhpcy5fcmVuZGVyRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0Ly8gLS0tIHBlcnNpc3RpbmcgZGVkaWNhdGVkIGl0ZW1zXG5cblx0cHJpdmF0ZSBfaGFuZGxlU3RvcmFnZUNoYW5nZSgpIHtcblx0XHR0aGlzLl9yZXN0b3JlU3RhdGUoKTtcblx0XHR0aGlzLl91cGRhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgX3Jlc3RvcmVTdGF0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCByYXcgPSB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXQoTGFuZ3VhZ2VTdGF0dXMuX2tleURlZGljYXRlZEl0ZW1zLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgJ1tdJyk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGlkcyA9IDxzdHJpbmdbXT5KU09OLnBhcnNlKHJhdyk7XG5cdFx0XHR0aGlzLl9kZWRpY2F0ZWQgPSBuZXcgU2V0KGlkcyk7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHR0aGlzLl9kZWRpY2F0ZWQuY2xlYXIoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zdG9yZVN0YXRlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kZWRpY2F0ZWQuc2l6ZSA9PT0gMCkge1xuXHRcdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2UucmVtb3ZlKExhbmd1YWdlU3RhdHVzLl9rZXlEZWRpY2F0ZWRJdGVtcywgU3RvcmFnZVNjb3BlLlBST0ZJTEUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCByYXcgPSBKU09OLnN0cmluZ2lmeShBcnJheS5mcm9tKHRoaXMuX2RlZGljYXRlZC5rZXlzKCkpKTtcblx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKExhbmd1YWdlU3RhdHVzLl9rZXlEZWRpY2F0ZWRJdGVtcywgcmF3LCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0gbGFuZ3VhZ2Ugc3RhdHVzIG1vZGVsIGFuZCBVSVxuXG5cdHByaXZhdGUgX2NyZWF0ZVZpZXdNb2RlbChlZGl0b3I6IElDb2RlRWRpdG9yIHwgbnVsbCk6IExhbmd1YWdlU3RhdHVzVmlld01vZGVsIHtcblx0XHRpZiAoIWVkaXRvcj8uaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIG5ldyBMYW5ndWFnZVN0YXR1c1ZpZXdNb2RlbChbXSwgW10pO1xuXHRcdH1cblx0XHRjb25zdCBhbGwgPSB0aGlzLl9sYW5ndWFnZVN0YXR1c1NlcnZpY2UuZ2V0TGFuZ3VhZ2VTdGF0dXMoZWRpdG9yLmdldE1vZGVsKCkpO1xuXHRcdGNvbnN0IGNvbWJpbmVkOiBJTGFuZ3VhZ2VTdGF0dXNbXSA9IFtdO1xuXHRcdGNvbnN0IGRlZGljYXRlZDogSUxhbmd1YWdlU3RhdHVzW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgYWxsKSB7XG5cdFx0XHRpZiAodGhpcy5fZGVkaWNhdGVkLmhhcyhpdGVtLmlkKSkge1xuXHRcdFx0XHRkZWRpY2F0ZWQucHVzaChpdGVtKTtcblx0XHRcdH1cblx0XHRcdGNvbWJpbmVkLnB1c2goaXRlbSk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgTGFuZ3VhZ2VTdGF0dXNWaWV3TW9kZWwoY29tYmluZWQsIGRlZGljYXRlZCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgZWRpdG9yID0gZ2V0Q29kZUVkaXRvcih0aGlzLl9lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sKTtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2NyZWF0ZVZpZXdNb2RlbChlZGl0b3IpO1xuXG5cdFx0aWYgKHRoaXMuX21vZGVsPy5pc0VxdWFsKG1vZGVsKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9yZW5kZXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0dGhpcy5fbW9kZWwgPSBtb2RlbDtcblxuXHRcdC8vIHVwZGF0ZSB3aGVuIGVkaXRvciBsYW5ndWFnZSBjaGFuZ2VzXG5cdFx0ZWRpdG9yPy5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UodGhpcy5fdXBkYXRlLCB0aGlzLCB0aGlzLl9yZW5kZXJEaXNwb3NhYmxlcyk7XG5cblx0XHQvLyBjb21iaW5lZCBzdGF0dXMgYmFyIGl0ZW0gaXMgYSBzaW5nbGUgaXRlbSB3aGljaCBob3ZlciBzaG93c1xuXHRcdC8vIGVhY2ggc3RhdHVzIGl0ZW1cblx0XHRpZiAobW9kZWwuY29tYmluZWQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQvLyBub3RoaW5nXG5cdFx0XHR0aGlzLl9jb21iaW5lZEVudHJ5Py5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9jb21iaW5lZEVudHJ5ID0gdW5kZWZpbmVkO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IFtmaXJzdF0gPSBtb2RlbC5jb21iaW5lZDtcblx0XHRcdGNvbnN0IHNob3dTZXZlcml0eSA9IGZpcnN0LnNldmVyaXR5ID49IFNldmVyaXR5Lldhcm5pbmc7XG5cdFx0XHRjb25zdCB0ZXh0ID0gTGFuZ3VhZ2VTdGF0dXMuX3NldmVyaXR5VG9Db21ib0NvZGljb24oZmlyc3Quc2V2ZXJpdHkpO1xuXG5cdFx0XHRsZXQgaXNPbmVCdXN5ID0gZmFsc2U7XG5cdFx0XHRjb25zdCBhcmlhTGFiZWxzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBzdGF0dXMgb2YgbW9kZWwuY29tYmluZWQpIHtcblx0XHRcdFx0Y29uc3QgaXNQaW5uZWQgPSBtb2RlbC5kZWRpY2F0ZWQuaW5jbHVkZXMoc3RhdHVzKTtcblx0XHRcdFx0dGhpcy5fcmVuZGVyU3RhdHVzKHRoaXMuX2NvbWJpbmVkRW50cnlUb29sdGlwLCBzdGF0dXMsIHNob3dTZXZlcml0eSwgaXNQaW5uZWQsIHRoaXMuX3JlbmRlckRpc3Bvc2FibGVzKTtcblx0XHRcdFx0YXJpYUxhYmVscy5wdXNoKExhbmd1YWdlU3RhdHVzLl9hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb24oc3RhdHVzKS5sYWJlbCk7XG5cdFx0XHRcdGlzT25lQnVzeSA9IGlzT25lQnVzeSB8fCAoIWlzUGlubmVkICYmIHN0YXR1cy5idXN5KTsgLy8gdW5waW5uZWQgaXRlbXMgY29udHJpYnV0ZSB0byB0aGUgYnVzeS1pbmRpY2F0b3Igb2YgdGhlIGNvbXBvc2l0ZSBzdGF0dXMgaXRlbVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwcm9wczogSVN0YXR1c2JhckVudHJ5ID0ge1xuXHRcdFx0XHRuYW1lOiBsb2NhbGl6ZSgnbGFuZ1N0YXR1cy5uYW1lJywgXCJFZGl0b3IgTGFuZ3VhZ2UgU3RhdHVzXCIpLFxuXHRcdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdsYW5nU3RhdHVzLmFyaWEnLCBcIkVkaXRvciBMYW5ndWFnZSBTdGF0dXM6IHswfVwiLCBhcmlhTGFiZWxzLmpvaW4oJywgbmV4dDogJykpLFxuXHRcdFx0XHR0b29sdGlwOiB0aGlzLl9jb21iaW5lZEVudHJ5VG9vbHRpcCxcblx0XHRcdFx0Y29tbWFuZDogU2hvd1Rvb2x0aXBDb21tYW5kLFxuXHRcdFx0XHR0ZXh0OiBpc09uZUJ1c3kgPyAnJChsb2FkaW5nfnNwaW4pJyA6IHRleHQsXG5cdFx0XHR9O1xuXHRcdFx0aWYgKCF0aGlzLl9jb21iaW5lZEVudHJ5KSB7XG5cdFx0XHRcdHRoaXMuX2NvbWJpbmVkRW50cnkgPSB0aGlzLl9zdGF0dXNCYXJTZXJ2aWNlLmFkZEVudHJ5KHByb3BzLCBMYW5ndWFnZVN0YXR1cy5faWQsIFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCwgeyBsb2NhdGlvbjogeyBpZDogJ3N0YXR1cy5lZGl0b3IubW9kZScsIHByaW9yaXR5OiAxMDAuMSB9LCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudC5MRUZULCBjb21wYWN0OiB0cnVlIH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fY29tYmluZWRFbnRyeS51cGRhdGUocHJvcHMpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBhbmltYXRlIHRoZSBzdGF0dXMgYmFyIGljb24gd2hlbmV2ZXIgbGFuZ3VhZ2Ugc3RhdHVzIGNoYW5nZXMsIHJlcGVhdCBhbmltYXRpb25cblx0XHRcdC8vIHdoZW4gc2V2ZXJpdHkgaXMgd2FybmluZyBvciBlcnJvciwgZG9uJ3Qgc2hvdyBhbmltYXRpb24gd2hlbiBzaG93aW5nIHByb2dyZXNzL2J1c3lcblx0XHRcdGNvbnN0IHVzZXJIYXNJbnRlcmFjdGVkV2l0aFN0YXR1cyA9IHRoaXMuX2ludGVyYWN0aW9uQ291bnRlci52YWx1ZSA+PSAzO1xuXHRcdFx0Y29uc3QgdGFyZ2V0V2luZG93ID0gZG9tLmdldFdpbmRvdyhlZGl0b3I/LmdldENvbnRhaW5lckRvbU5vZGUoKSk7XG5cdFx0XHRjb25zdCBub2RlID0gdGFyZ2V0V2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tb25hY28td29ya2JlbmNoIC5zdGF0dXNiYXIgRElWI3N0YXR1c1xcXFwubGFuZ3VhZ2VTdGF0dXMgQT5TUEFOLmNvZGljb24nKTtcblx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IHRhcmdldFdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLXdvcmtiZW5jaCAuc3RhdHVzYmFyIERJViNzdGF0dXNcXFxcLmxhbmd1YWdlU3RhdHVzJyk7XG5cdFx0XHRpZiAoZG9tLmlzSFRNTEVsZW1lbnQobm9kZSkgJiYgY29udGFpbmVyKSB7XG5cdFx0XHRcdGNvbnN0IF93aWdnbGUgPSAnd2lnZ2xlJztcblx0XHRcdFx0Y29uc3QgX2ZsYXNoID0gJ2ZsYXNoJztcblx0XHRcdFx0aWYgKCFpc09uZUJ1c3kpIHtcblx0XHRcdFx0XHQvLyB3aWdnbGUgaWNvbiB3aGVuIHNldmVyZSBvciBcIm5ld1wiXG5cdFx0XHRcdFx0bm9kZS5jbGFzc0xpc3QudG9nZ2xlKF93aWdnbGUsIHNob3dTZXZlcml0eSB8fCAhdXNlckhhc0ludGVyYWN0ZWRXaXRoU3RhdHVzKTtcblx0XHRcdFx0XHR0aGlzLl9yZW5kZXJEaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihub2RlLCAnYW5pbWF0aW9uZW5kJywgX2UgPT4gbm9kZS5jbGFzc0xpc3QucmVtb3ZlKF93aWdnbGUpKSk7XG5cdFx0XHRcdFx0Ly8gZmxhc2ggYmFja2dyb3VuZCB3aGVuIHNldmVyZVxuXHRcdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKF9mbGFzaCwgc2hvd1NldmVyaXR5KTtcblx0XHRcdFx0XHR0aGlzLl9yZW5kZXJEaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihjb250YWluZXIsICdhbmltYXRpb25lbmQnLCBfZSA9PiBjb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShfZmxhc2gpKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bm9kZS5jbGFzc0xpc3QucmVtb3ZlKF93aWdnbGUpO1xuXHRcdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKF9mbGFzaCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gdHJhY2sgd2hlbiB0aGUgaG92ZXIgc2hvd3MgKHRoaXMgaXMgYXV0b21hZ2ljIGFuZCBET00gbXV0YXRpb24gc3B5aW5nIGlzIG5lZWRlZC4uLilcblx0XHRcdC8vICB1c2UgdGhhdCBhcyBzaWduYWwgdGhhdCB0aGUgdXNlciBoYXMgaW50ZXJhY3RlZC9sZWFybmVkIGxhbmd1YWdlIHN0YXR1cyBpdGVtcyB3b3JrXG5cdFx0XHRpZiAoIXVzZXJIYXNJbnRlcmFjdGVkV2l0aFN0YXR1cykge1xuXHRcdFx0XHRjb25zdCBob3ZlclRhcmdldCA9IHRhcmdldFdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLXdvcmtiZW5jaCAuY29udGV4dC12aWV3Jyk7XG5cdFx0XHRcdGlmIChkb20uaXNIVE1MRWxlbWVudChob3ZlclRhcmdldCkpIHtcblx0XHRcdFx0XHRjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcblx0XHRcdFx0XHRcdGlmICh0YXJnZXRXaW5kb3cuZG9jdW1lbnQuY29udGFpbnModGhpcy5fY29tYmluZWRFbnRyeVRvb2x0aXApKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2ludGVyYWN0aW9uQ291bnRlci5pbmNyZW1lbnQoKTtcblx0XHRcdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdG9ic2VydmVyLm9ic2VydmUoaG92ZXJUYXJnZXQsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuXHRcdFx0XHRcdHRoaXMuX3JlbmRlckRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gb2JzZXJ2ZXIuZGlzY29ubmVjdCgpKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBkZWRpY2F0ZWQgc3RhdHVzIGJhciBpdGVtcyBhcmUgc2hvd3MgYXMtaXMgaW4gdGhlIHN0YXR1cyBiYXJcblx0XHRjb25zdCBuZXdEZWRpY2F0ZWRFbnRyaWVzID0gbmV3IE1hcDxzdHJpbmcsIElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yPigpO1xuXHRcdGZvciAoY29uc3Qgc3RhdHVzIG9mIG1vZGVsLmRlZGljYXRlZCkge1xuXHRcdFx0Y29uc3QgcHJvcHMgPSBMYW5ndWFnZVN0YXR1cy5fYXNTdGF0dXNiYXJFbnRyeShzdGF0dXMpO1xuXHRcdFx0bGV0IGVudHJ5ID0gdGhpcy5fZGVkaWNhdGVkRW50cmllcy5nZXQoc3RhdHVzLmlkKTtcblx0XHRcdGlmICghZW50cnkpIHtcblx0XHRcdFx0ZW50cnkgPSB0aGlzLl9zdGF0dXNCYXJTZXJ2aWNlLmFkZEVudHJ5KHByb3BzLCBzdGF0dXMuaWQsIFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCwgeyBsb2NhdGlvbjogeyBpZDogJ3N0YXR1cy5lZGl0b3IubW9kZScsIHByaW9yaXR5OiAxMDAuMSB9LCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVudHJ5LnVwZGF0ZShwcm9wcyk7XG5cdFx0XHRcdHRoaXMuX2RlZGljYXRlZEVudHJpZXMuZGVsZXRlKHN0YXR1cy5pZCk7XG5cdFx0XHR9XG5cdFx0XHRuZXdEZWRpY2F0ZWRFbnRyaWVzLnNldChzdGF0dXMuaWQsIGVudHJ5KTtcblx0XHR9XG5cdFx0ZGlzcG9zZSh0aGlzLl9kZWRpY2F0ZWRFbnRyaWVzLnZhbHVlcygpKTtcblx0XHR0aGlzLl9kZWRpY2F0ZWRFbnRyaWVzID0gbmV3RGVkaWNhdGVkRW50cmllcztcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlclN0YXR1cyhjb250YWluZXI6IEhUTUxFbGVtZW50LCBzdGF0dXM6IElMYW5ndWFnZVN0YXR1cywgc2hvd1NldmVyaXR5OiBib29sZWFuLCBpc1Bpbm5lZDogYm9vbGVhbiwgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSk6IEhUTUxFbGVtZW50IHtcblxuXHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHBhcmVudC5jbGFzc0xpc3QuYWRkKCdob3Zlci1sYW5ndWFnZS1zdGF0dXMnKTtcblxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gcGFyZW50LnJlbW92ZSgpKSk7XG5cblx0XHRjb25zdCBzZXZlcml0eSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHNldmVyaXR5LmNsYXNzTGlzdC5hZGQoJ3NldmVyaXR5JywgYHNldiR7c3RhdHVzLnNldmVyaXR5fWApO1xuXHRcdHNldmVyaXR5LmNsYXNzTGlzdC50b2dnbGUoJ3Nob3cnLCBzaG93U2V2ZXJpdHkpO1xuXHRcdGNvbnN0IHNldmVyaXR5VGV4dCA9IExhbmd1YWdlU3RhdHVzLl9zZXZlcml0eVRvU2luZ2xlQ29kaWNvbihzdGF0dXMuc2V2ZXJpdHkpO1xuXHRcdGRvbS5hcHBlbmQoc2V2ZXJpdHksIC4uLnJlbmRlckxhYmVsV2l0aEljb25zKHNldmVyaXR5VGV4dCkpO1xuXHRcdHBhcmVudC5hcHBlbmRDaGlsZChzZXZlcml0eSk7XG5cblx0XHRjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdlbGVtZW50Jyk7XG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKGVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgbGVmdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGxlZnQuY2xhc3NMaXN0LmFkZCgnbGVmdCcpO1xuXHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQobGVmdCk7XG5cblx0XHRjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRsYWJlbC5jbGFzc0xpc3QuYWRkKCdsYWJlbCcpO1xuXHRcdGNvbnN0IGxhYmVsVmFsdWUgPSB0eXBlb2Ygc3RhdHVzLmxhYmVsID09PSAnc3RyaW5nJyA/IHN0YXR1cy5sYWJlbCA6IHN0YXR1cy5sYWJlbC52YWx1ZTtcblx0XHRkb20uYXBwZW5kKGxhYmVsLCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyhjb21wdXRlVGV4dChsYWJlbFZhbHVlLCBzdGF0dXMuYnVzeSkpKTtcblx0XHRsZWZ0LmFwcGVuZENoaWxkKGxhYmVsKTtcblxuXHRcdGNvbnN0IGRldGFpbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRkZXRhaWwuY2xhc3NMaXN0LmFkZCgnZGV0YWlsJyk7XG5cdFx0dGhpcy5fcmVuZGVyVGV4dFBsdXMoZGV0YWlsLCBzdGF0dXMuZGV0YWlsLCBzdG9yZSk7XG5cdFx0bGVmdC5hcHBlbmRDaGlsZChkZXRhaWwpO1xuXG5cdFx0Y29uc3QgcmlnaHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRyaWdodC5jbGFzc0xpc3QuYWRkKCdyaWdodCcpO1xuXHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQocmlnaHQpO1xuXG5cdFx0Ly8gLS0gY29tbWFuZCAoaWYgYXZhaWxhYmxlKVxuXHRcdGNvbnN0IHsgY29tbWFuZCB9ID0gc3RhdHVzO1xuXHRcdGlmIChjb21tYW5kKSB7XG5cdFx0XHRzdG9yZS5hZGQobmV3IExpbmsocmlnaHQsIHtcblx0XHRcdFx0bGFiZWw6IGNvbW1hbmQudGl0bGUsXG5cdFx0XHRcdHRpdGxlOiBjb21tYW5kLnRvb2x0aXAsXG5cdFx0XHRcdGhyZWY6IFVSSS5mcm9tKHtcblx0XHRcdFx0XHRzY2hlbWU6ICdjb21tYW5kJywgcGF0aDogY29tbWFuZC5pZCwgcXVlcnk6IGNvbW1hbmQuYXJndW1lbnRzICYmIEpTT04uc3RyaW5naWZ5KGNvbW1hbmQuYXJndW1lbnRzKVxuXHRcdFx0XHR9KS50b1N0cmluZygpXG5cdFx0XHR9LCB7IGhvdmVyRGVsZWdhdGU6IG5hdGl2ZUhvdmVyRGVsZWdhdGUgfSwgdGhpcy5faG92ZXJTZXJ2aWNlLCB0aGlzLl9vcGVuZXJTZXJ2aWNlKSk7XG5cdFx0fVxuXG5cdFx0Ly8gLS0gcGluXG5cdFx0Y29uc3QgYWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcihyaWdodCwgeyBob3ZlckRlbGVnYXRlOiBuYXRpdmVIb3ZlckRlbGVnYXRlIH0pO1xuXHRcdGNvbnN0IGFjdGlvbkxhYmVsOiBzdHJpbmcgPSBpc1Bpbm5lZCA/IGxvY2FsaXplKCd1bnBpbicsIFwiUmVtb3ZlIGZyb20gU3RhdHVzIEJhclwiKSA6IGxvY2FsaXplKCdwaW4nLCBcIkFkZCB0byBTdGF0dXMgQmFyXCIpO1xuXHRcdGFjdGlvbkJhci5zZXRBcmlhTGFiZWwoYWN0aW9uTGFiZWwpO1xuXHRcdHN0b3JlLmFkZChhY3Rpb25CYXIpO1xuXHRcdGxldCBhY3Rpb246IEFjdGlvbjtcblx0XHRpZiAoIWlzUGlubmVkKSB7XG5cdFx0XHRhY3Rpb24gPSBuZXcgQWN0aW9uKCdwaW4nLCBhY3Rpb25MYWJlbCwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24ucGluKSwgdHJ1ZSwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9kZWRpY2F0ZWQuYWRkKHN0YXR1cy5pZCk7XG5cdFx0XHRcdHRoaXMuX3N0YXR1c0JhclNlcnZpY2UudXBkYXRlRW50cnlWaXNpYmlsaXR5KHN0YXR1cy5pZCwgdHJ1ZSk7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdFx0XHR0aGlzLl9zdG9yZVN0YXRlKCk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YWN0aW9uID0gbmV3IEFjdGlvbigndW5waW4nLCBhY3Rpb25MYWJlbCwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24ucGlubmVkKSwgdHJ1ZSwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9kZWRpY2F0ZWQuZGVsZXRlKHN0YXR1cy5pZCk7XG5cdFx0XHRcdHRoaXMuX3N0YXR1c0JhclNlcnZpY2UudXBkYXRlRW50cnlWaXNpYmlsaXR5KHN0YXR1cy5pZCwgZmFsc2UpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRcdFx0dGhpcy5fc3RvcmVTdGF0ZSgpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGFjdGlvbkJhci5wdXNoKGFjdGlvbiwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0c3RvcmUuYWRkKGFjdGlvbik7XG5cblx0XHRyZXR1cm4gcGFyZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3NldmVyaXR5VG9Db21ib0NvZGljb24oc2V2OiBTZXZlcml0eSk6IHN0cmluZyB7XG5cdFx0c3dpdGNoIChzZXYpIHtcblx0XHRcdGNhc2UgU2V2ZXJpdHkuRXJyb3I6IHJldHVybiAnJChicmFja2V0LWVycm9yKSc7XG5cdFx0XHRjYXNlIFNldmVyaXR5Lldhcm5pbmc6IHJldHVybiAnJChicmFja2V0LWRvdCknO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuICckKGJyYWNrZXQpJztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc2V2ZXJpdHlUb1NpbmdsZUNvZGljb24oc2V2OiBTZXZlcml0eSk6IHN0cmluZyB7XG5cdFx0c3dpdGNoIChzZXYpIHtcblx0XHRcdGNhc2UgU2V2ZXJpdHkuRXJyb3I6IHJldHVybiAnJChlcnJvciknO1xuXHRcdFx0Y2FzZSBTZXZlcml0eS5XYXJuaW5nOiByZXR1cm4gJyQoaW5mbyknO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuICckKGNoZWNrKSc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyVGV4dFBsdXModGFyZ2V0OiBIVE1MRWxlbWVudCwgdGV4dDogc3RyaW5nLCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHBhcnNlTGlua2VkVGV4dCh0ZXh0KS5ub2Rlcykge1xuXHRcdFx0aWYgKHR5cGVvZiBub2RlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRjb25zdCBwYXJ0cyA9IHJlbmRlckxhYmVsV2l0aEljb25zKG5vZGUpO1xuXHRcdFx0XHRkb20uYXBwZW5kKHRhcmdldCwgLi4ucGFydHMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0c3RvcmUuYWRkKG5ldyBMaW5rKHRhcmdldCwgbm9kZSwgdW5kZWZpbmVkLCB0aGlzLl9ob3ZlclNlcnZpY2UsIHRoaXMuX29wZW5lclNlcnZpY2UpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uKHN0YXR1czogSUxhbmd1YWdlU3RhdHVzKTogSUFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbiB7XG5cdFx0aWYgKHN0YXR1cy5hY2Nlc3NpYmlsaXR5SW5mbykge1xuXHRcdFx0cmV0dXJuIHN0YXR1cy5hY2Nlc3NpYmlsaXR5SW5mbztcblx0XHR9XG5cdFx0Y29uc3QgdGV4dFZhbHVlID0gdHlwZW9mIHN0YXR1cy5sYWJlbCA9PT0gJ3N0cmluZycgPyBzdGF0dXMubGFiZWwgOiBzdGF0dXMubGFiZWwudmFsdWU7XG5cdFx0aWYgKHN0YXR1cy5kZXRhaWwpIHtcblx0XHRcdHJldHVybiB7IGxhYmVsOiBsb2NhbGl6ZSgnYXJpYS4xJywgJ3swfSwgezF9JywgdGV4dFZhbHVlLCBzdGF0dXMuZGV0YWlsKSB9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4geyBsYWJlbDogbG9jYWxpemUoJ2FyaWEuMicsICd7MH0nLCB0ZXh0VmFsdWUpIH07XG5cdFx0fVxuXHR9XG5cblx0Ly8gLS0tXG5cblx0cHJpdmF0ZSBzdGF0aWMgX2FzU3RhdHVzYmFyRW50cnkoaXRlbTogSUxhbmd1YWdlU3RhdHVzKTogSVN0YXR1c2JhckVudHJ5IHtcblxuXHRcdGxldCBraW5kOiBTdGF0dXNiYXJFbnRyeUtpbmQgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGl0ZW0uc2V2ZXJpdHkgPT09IFNldmVyaXR5Lldhcm5pbmcpIHtcblx0XHRcdGtpbmQgPSAnd2FybmluZyc7XG5cdFx0fSBlbHNlIGlmIChpdGVtLnNldmVyaXR5ID09PSBTZXZlcml0eS5FcnJvcikge1xuXHRcdFx0a2luZCA9ICdlcnJvcic7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dFZhbHVlID0gdHlwZW9mIGl0ZW0ubGFiZWwgPT09ICdzdHJpbmcnID8gaXRlbS5sYWJlbCA6IGl0ZW0ubGFiZWwuc2hvcnRWYWx1ZTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lOiBsb2NhbGl6ZSgnbmFtZS5wYXR0ZXJuJywgJ3swfSAoTGFuZ3VhZ2UgU3RhdHVzKScsIGl0ZW0ubmFtZSksXG5cdFx0XHR0ZXh0OiBjb21wdXRlVGV4dCh0ZXh0VmFsdWUsIGl0ZW0uYnVzeSksXG5cdFx0XHRhcmlhTGFiZWw6IExhbmd1YWdlU3RhdHVzLl9hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb24oaXRlbSkubGFiZWwsXG5cdFx0XHRyb2xlOiBpdGVtLmFjY2Vzc2liaWxpdHlJbmZvPy5yb2xlLFxuXHRcdFx0dG9vbHRpcDogaXRlbS5jb21tYW5kPy50b29sdGlwIHx8IG5ldyBNYXJrZG93blN0cmluZyhpdGVtLmRldGFpbCwgeyBpc1RydXN0ZWQ6IHRydWUsIHN1cHBvcnRUaGVtZUljb25zOiB0cnVlIH0pLFxuXHRcdFx0a2luZCxcblx0XHRcdGNvbW1hbmQ6IGl0ZW0uY29tbWFuZFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlc2V0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuaW5sYXlIaW50cy5SZXNldCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdyZXNldCcsIFwiUmVzZXQgTGFuZ3VhZ2UgU3RhdHVzIEludGVyYWN0aW9uIENvdW50ZXJcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGFjY2Vzc29yLmdldChJU3RvcmFnZVNlcnZpY2UpLnJlbW92ZSgnbGFuZ3VhZ2VTdGF0dXMuaW50ZXJhY3RDb3VudCcsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0fVxufVxuXG5mdW5jdGlvbiBjb21wdXRlVGV4dCh0ZXh0OiBzdHJpbmcsIGxvYWRpbmc6IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRyZXR1cm4gam9pblN0cmluZ3MoW3RleHQgIT09ICcnICYmIHRleHQsIGxvYWRpbmcgJiYgJyQobG9hZGlu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
