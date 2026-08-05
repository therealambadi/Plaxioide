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
import "./output.css";
import * as nls from "../../../../nls.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { AbstractTextResourceEditor } from "../../../browser/parts/editor/textResourceEditor.js";
import { OUTPUT_VIEW_ID, CONTEXT_IN_OUTPUT, CONTEXT_OUTPUT_SCROLL_LOCK, IOutputService, OUTPUT_FILTER_FOCUS_CONTEXT, HIDE_CATEGORY_FILTER_CONTEXT } from "../../../services/output/common/output.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { CursorChangeReason } from "../../../../editor/common/cursorEvents.js";
import { FilterViewPane } from "../../../browser/parts/views/viewPane.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { TextResourceEditorInput } from "../../../common/editor/textResourceEditorInput.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Dimension } from "../../../../base/browser/dom.js";
import { createCancelablePromise } from "../../../../base/common/async.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ResourceContextKey } from "../../../common/contextkeys.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { computeEditorAriaLabel } from "../../../browser/editor.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { localize } from "../../../../nls.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { LogLevel } from "../../../../platform/log/common/log.js";
import { EditorExtensionsRegistry, EditorContributionInstantiation } from "../../../../editor/browser/editorExtensions.js";
import { Range } from "../../../../editor/common/core/range.js";
import { FindDecorations } from "../../../../editor/contrib/find/browser/findDecorations.js";
import { Memento } from "../../../common/memento.js";
import { Markers } from "../../markers/common/markers.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { viewFilterSubmenu } from "../../../browser/parts/views/viewFilter.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
let OutputViewPane = class extends FilterViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, outputService, storageService) {
    const memento = new Memento(Markers.MARKERS_VIEW_STORAGE_ID, storageService);
    const viewState = memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    super({
      ...options,
      filterOptions: {
        placeholder: localize("outputView.filter.placeholder", "Filter"),
        focusContextKey: OUTPUT_FILTER_FOCUS_CONTEXT.key,
        text: viewState["filter"] || "",
        history: []
      }
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.outputService = outputService;
    this.editorPromise = null;
    this.memento = memento;
    this.panelState = viewState;
    const filters = outputService.filters;
    filters.text = this.panelState["filter"] || "";
    filters.trace = this.panelState["showTrace"] ?? true;
    filters.debug = this.panelState["showDebug"] ?? true;
    filters.info = this.panelState["showInfo"] ?? true;
    filters.warning = this.panelState["showWarning"] ?? true;
    filters.error = this.panelState["showError"] ?? true;
    filters.categories = this.panelState["categories"] ?? "";
    this.scrollLockContextKey = CONTEXT_OUTPUT_SCROLL_LOCK.bindTo(this.contextKeyService);
    const editorInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
    this.editor = this._register(editorInstantiationService.createInstance(OutputEditor));
    this._register(this.editor.onTitleAreaUpdate(() => {
      this.updateTitle(this.editor.getTitle());
      this.updateActions();
    }));
    this._register(this.onDidChangeBodyVisibility(() => this.onDidChangeVisibility(this.isBodyVisible())));
    this._register(this.filterWidget.onDidChangeFilterText((text) => outputService.filters.text = text));
    this.checkMoreFilters();
    this._register(outputService.filters.onDidChange(() => this.checkMoreFilters()));
  }
  get scrollLock() {
    return !!this.scrollLockContextKey.get();
  }
  set scrollLock(scrollLock) {
    this.scrollLockContextKey.set(scrollLock);
  }
  showChannel(channel, preserveFocus) {
    if (this.channelId !== channel.id) {
      this.setInput(channel);
    }
    if (!preserveFocus) {
      this.focus();
    }
  }
  focus() {
    super.focus();
    this.editorPromise?.then(() => this.editor.focus());
  }
  clearFilterText() {
    this.filterWidget.setFilterText("");
  }
  renderBody(container) {
    super.renderBody(container);
    this.editor.create(container);
    container.classList.add("output-view");
    const codeEditor = this.editor.getControl();
    codeEditor.setAriaOptions({ role: "document", activeDescendant: void 0 });
    this._register(codeEditor.onDidChangeModelContent(() => {
      if (!this.scrollLock) {
        this.editor.revealLastLine();
      }
    }));
    this._register(codeEditor.onDidChangeCursorPosition((e) => {
      if (e.reason !== CursorChangeReason.Explicit) {
        return;
      }
      if (!this.configurationService.getValue("output.smartScroll.enabled")) {
        return;
      }
      const model = codeEditor.getModel();
      if (model) {
        const newPositionLine = e.position.lineNumber;
        const lastLine = model.getLineCount();
        this.scrollLock = lastLine !== newPositionLine;
      }
    }));
  }
  layoutBodyContent(height, width) {
    this.editor.layout(new Dimension(width, height));
  }
  onDidChangeVisibility(visible) {
    this.editor.setVisible(visible);
    if (!visible) {
      this.clearInput();
    }
  }
  setInput(channel) {
    this.channelId = channel.id;
    this.checkMoreFilters();
    const input = this.createInput(channel);
    if (!this.editor.input || !input.matches(this.editor.input)) {
      this.editorPromise?.cancel();
      this.editorPromise = createCancelablePromise((token) => this.editor.setInput(this.createInput(channel), { preserveFocus: true }, /* @__PURE__ */ Object.create(null), token).then(() => this.editor));
    }
  }
  checkMoreFilters() {
    const filters = this.outputService.filters;
    this.filterWidget.checkMoreFilters(!filters.trace || !filters.debug || !filters.info || !filters.warning || !filters.error || !!this.channelId && filters.categories.includes(`,${this.channelId}:`));
  }
  clearInput() {
    this.channelId = void 0;
    this.editor.clearInput();
    this.editorPromise = null;
  }
  createInput(channel) {
    return this.instantiationService.createInstance(TextResourceEditorInput, channel.uri, nls.localize("output model title", "{0} - Output", channel.label), nls.localize("channel", "Output channel for '{0}'", channel.label), void 0, void 0);
  }
  saveState() {
    const filters = this.outputService.filters;
    this.panelState["filter"] = filters.text;
    this.panelState["showTrace"] = filters.trace;
    this.panelState["showDebug"] = filters.debug;
    this.panelState["showInfo"] = filters.info;
    this.panelState["showWarning"] = filters.warning;
    this.panelState["showError"] = filters.error;
    this.panelState["categories"] = filters.categories;
    this.memento.saveMemento();
    super.saveState();
  }
};
OutputViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IOutputService),
  __decorateParam(11, IStorageService)
], OutputViewPane);
let OutputEditor = class extends AbstractTextResourceEditor {
  constructor(telemetryService, instantiationService, storageService, configurationService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService) {
    super(OUTPUT_VIEW_ID, editorGroupService.activeGroup, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService);
    this.configurationService = configurationService;
    this.resourceContext = this._register(instantiationService.createInstance(ResourceContextKey));
  }
  getId() {
    return OUTPUT_VIEW_ID;
  }
  getTitle() {
    return nls.localize("output", "Output");
  }
  getConfigurationOverrides(configuration) {
    const options = super.getConfigurationOverrides(configuration);
    options.wordWrap = "on";
    options.lineNumbers = "off";
    options.glyphMargin = false;
    options.lineDecorationsWidth = 20;
    options.rulers = [];
    options.folding = false;
    options.scrollBeyondLastLine = false;
    options.renderLineHighlight = "none";
    options.minimap = { enabled: false };
    options.renderValidationDecorations = "editable";
    options.padding = void 0;
    options.readOnly = true;
    options.domReadOnly = true;
    options.unicodeHighlight = {
      nonBasicASCII: false,
      invisibleCharacters: false,
      ambiguousCharacters: false
    };
    const outputConfig = this.configurationService.getValue("[Log]");
    if (outputConfig) {
      if (outputConfig["editor.minimap.enabled"]) {
        options.minimap = { enabled: true };
      }
      if ("editor.wordWrap" in outputConfig) {
        options.wordWrap = outputConfig["editor.wordWrap"];
      }
    }
    return options;
  }
  getAriaLabel() {
    return this.input ? this.input.getAriaLabel() : nls.localize("outputViewAriaLabel", "Output panel");
  }
  computeAriaLabel() {
    return this.input ? computeEditorAriaLabel(this.input, void 0, void 0, this.editorGroupService.count) : this.getAriaLabel();
  }
  async setInput(input, options, context, token) {
    const focus = !(options && options.preserveFocus);
    if (this.input && input.matches(this.input)) {
      return;
    }
    if (this.input) {
      this.input.dispose();
    }
    await super.setInput(input, options, context, token);
    this.resourceContext.set(input.resource);
    if (focus) {
      this.focus();
    }
    this.revealLastLine();
  }
  clearInput() {
    if (this.input) {
      this.input.dispose();
    }
    super.clearInput();
    this.resourceContext.reset();
  }
  createEditor(parent) {
    parent.setAttribute("role", "document");
    super.createEditor(parent);
    const scopedContextKeyService = this.scopedContextKeyService;
    if (scopedContextKeyService) {
      CONTEXT_IN_OUTPUT.bindTo(scopedContextKeyService).set(true);
    }
  }
  _getContributions() {
    return [
      ...EditorExtensionsRegistry.getEditorContributions(),
      {
        id: FilterController.ID,
        ctor: FilterController,
        instantiation: EditorContributionInstantiation.Eager
      }
    ];
  }
  getCodeEditorWidgetOptions() {
    return { contributions: this._getContributions() };
  }
};
OutputEditor = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ITextResourceConfigurationService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IEditorGroupsService),
  __decorateParam(7, IEditorService),
  __decorateParam(8, IFileService)
], OutputEditor);
let FilterController = class extends Disposable {
  constructor(editor, outputService) {
    super();
    this.editor = editor;
    this.outputService = outputService;
    this.modelDisposables = this._register(new DisposableStore());
    this.hiddenAreas = [];
    this.categories = /* @__PURE__ */ new Map();
    this.decorationsCollection = editor.createDecorationsCollection();
    this._register(editor.onDidChangeModel(() => this.onDidChangeModel()));
    this._register(this.outputService.filters.onDidChange(() => editor.hasModel() && this.filter(editor.getModel())));
  }
  onDidChangeModel() {
    this.modelDisposables.clear();
    this.hiddenAreas = [];
    this.categories.clear();
    if (!this.editor.hasModel()) {
      return;
    }
    const model = this.editor.getModel();
    this.filter(model);
    const computeEndLineNumber = () => {
      const endLineNumber2 = model.getLineCount();
      return endLineNumber2 > 1 && model.getLineMaxColumn(endLineNumber2) === 1 ? endLineNumber2 - 1 : endLineNumber2;
    };
    let endLineNumber = computeEndLineNumber();
    this.modelDisposables.add(model.onDidChangeContent((e) => {
      if (e.changes.every((e2) => e2.range.startLineNumber > endLineNumber)) {
        this.filterIncremental(model, endLineNumber + 1);
      } else {
        this.filter(model);
      }
      endLineNumber = computeEndLineNumber();
    }));
  }
  filter(model) {
    this.hiddenAreas = [];
    this.decorationsCollection.clear();
    this.filterIncremental(model, 1);
  }
  filterIncremental(model, fromLineNumber) {
    const { findMatches, hiddenAreas, categories: sources } = this.compute(model, fromLineNumber);
    this.hiddenAreas.push(...hiddenAreas);
    this.editor.setHiddenAreas(this.hiddenAreas, this);
    if (findMatches.length) {
      this.decorationsCollection.append(findMatches);
    }
    if (sources.size) {
      const that = this;
      for (const [categoryFilter, categoryName] of sources) {
        if (this.categories.has(categoryFilter)) {
          continue;
        }
        this.categories.set(categoryFilter, categoryName);
        this.modelDisposables.add(registerAction2(class extends Action2 {
          constructor() {
            super({
              id: `workbench.actions.${OUTPUT_VIEW_ID}.toggle.${categoryFilter}`,
              title: categoryName,
              toggled: ContextKeyExpr.regex(HIDE_CATEGORY_FILTER_CONTEXT.key, new RegExp(`.*,${escapeRegExpCharacters(categoryFilter)},.*`)).negate(),
              menu: {
                id: viewFilterSubmenu,
                group: "1_category_filter",
                when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OUTPUT_VIEW_ID))
              }
            });
          }
          async run() {
            that.outputService.filters.toggleCategory(categoryFilter);
          }
        }));
      }
    }
  }
  compute(model, fromLineNumber) {
    const filters = this.outputService.filters;
    const activeChannel = this.outputService.getActiveChannel();
    const findMatches = [];
    const hiddenAreas = [];
    const categories = /* @__PURE__ */ new Map();
    const logEntries = activeChannel?.getLogEntries();
    if (activeChannel && logEntries?.length) {
      const hasLogLevelFilter = !filters.trace || !filters.debug || !filters.info || !filters.warning || !filters.error;
      const fromLogLevelEntryIndex = logEntries.findIndex((entry) => fromLineNumber >= entry.range.startLineNumber && fromLineNumber <= entry.range.endLineNumber);
      if (fromLogLevelEntryIndex === -1) {
        return { findMatches, hiddenAreas, categories };
      }
      for (let i = fromLogLevelEntryIndex; i < logEntries.length; i++) {
        const entry = logEntries[i];
        if (entry.category) {
          categories.set(`${activeChannel.id}:${entry.category}`, entry.category);
        }
        if (hasLogLevelFilter && !this.shouldShowLogLevel(entry, filters)) {
          hiddenAreas.push(entry.range);
          continue;
        }
        if (!this.shouldShowCategory(activeChannel.id, entry, filters)) {
          hiddenAreas.push(entry.range);
          continue;
        }
        if (filters.text) {
          const matches = model.findMatches(filters.text, entry.range, false, false, null, false);
          if (matches.length) {
            for (const match of matches) {
              findMatches.push({ range: match.range, options: FindDecorations._FIND_MATCH_DECORATION });
            }
          } else {
            hiddenAreas.push(entry.range);
          }
        }
      }
      return { findMatches, hiddenAreas, categories };
    }
    if (!filters.text) {
      return { findMatches, hiddenAreas, categories };
    }
    const lineCount = model.getLineCount();
    for (let lineNumber = fromLineNumber; lineNumber <= lineCount; lineNumber++) {
      const lineRange = new Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber));
      const matches = model.findMatches(filters.text, lineRange, false, false, null, false);
      if (matches.length) {
        for (const match of matches) {
          findMatches.push({ range: match.range, options: FindDecorations._FIND_MATCH_DECORATION });
        }
      } else {
        hiddenAreas.push(lineRange);
      }
    }
    return { findMatches, hiddenAreas, categories };
  }
  shouldShowLogLevel(entry, filters) {
    switch (entry.logLevel) {
      case LogLevel.Trace:
        return filters.trace;
      case LogLevel.Debug:
        return filters.debug;
      case LogLevel.Info:
        return filters.info;
      case LogLevel.Warning:
        return filters.warning;
      case LogLevel.Error:
        return filters.error;
    }
    return true;
  }
  shouldShowCategory(activeChannelId, entry, filters) {
    if (!entry.category) {
      return true;
    }
    return !filters.hasCategory(`${activeChannelId}:${entry.category}`);
  }
};
FilterController.ID = "output.editor.contrib.filterController";
FilterController = __decorateClass([
  __decorateParam(1, IOutputService)
], FilterController);
export {
  FilterController,
  OutputEditor,
  OutputViewPane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9vdXRwdXQvYnJvd3Nlci9vdXRwdXRWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCAnLi9vdXRwdXQuY3NzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIGFzIElDb2RlRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlLCBJQ29udGV4dEtleSwgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElFZGl0b3JPcGVuQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RUZXh0UmVzb3VyY2VFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci90ZXh0UmVzb3VyY2VFZGl0b3IuanMnO1xuaW1wb3J0IHsgT1VUUFVUX1ZJRVdfSUQsIENPTlRFWFRfSU5fT1VUUFVULCBJT3V0cHV0Q2hhbm5lbCwgQ09OVEVYVF9PVVRQVVRfU0NST0xMX0xPQ0ssIElPdXRwdXRTZXJ2aWNlLCBJT3V0cHV0Vmlld0ZpbHRlcnMsIE9VVFBVVF9GSUxURVJfRk9DVVNfQ09OVEVYVCwgSUxvZ0VudHJ5LCBISURFX0NBVEVHT1JZX0ZJTFRFUl9DT05URVhUIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvb3V0cHV0L2NvbW1vbi9vdXRwdXQuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDdXJzb3JDaGFuZ2VSZWFzb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2N1cnNvckV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJVmlld1BhbmVPcHRpb25zLCBGaWx0ZXJWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IFRleHRSZXNvdXJjZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci90ZXh0UmVzb3VyY2VFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IERpbWVuc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSVRleHRFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvdGV4dEVkaXRvci5qcyc7XG5pbXBvcnQgeyBjb21wdXRlRWRpdG9yQXJpYUxhYmVsIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IExvZ0xldmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbkRlc2NyaXB0aW9uLCBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnksIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIEVkaXRvckNvbnRyaWJ1dGlvbkN0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiwgSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiwgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRmluZERlY29yYXRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZmluZC9icm93c2VyL2ZpbmREZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBNZW1lbnRvLCBNZW1lbnRvT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21lbWVudG8uanMnO1xuaW1wb3J0IHsgTWFya2VycyB9IGZyb20gJy4uLy4uL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyB2aWV3RmlsdGVyU3VibWVudSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld0ZpbHRlci5qcyc7XG5pbXBvcnQgeyBlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBPdXRwdXRWaWV3UGFuZSBleHRlbmRzIEZpbHRlclZpZXdQYW5lIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogT3V0cHV0RWRpdG9yO1xuXHRwcml2YXRlIGNoYW5uZWxJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGVkaXRvclByb21pc2U6IENhbmNlbGFibGVQcm9taXNlPE91dHB1dEVkaXRvcj4gfCBudWxsID0gbnVsbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHNjcm9sbExvY2tDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0Z2V0IHNjcm9sbExvY2soKTogYm9vbGVhbiB7IHJldHVybiAhIXRoaXMuc2Nyb2xsTG9ja0NvbnRleHRLZXkuZ2V0KCk7IH1cblx0c2V0IHNjcm9sbExvY2soc2Nyb2xsTG9jazogYm9vbGVhbikgeyB0aGlzLnNjcm9sbExvY2tDb250ZXh0S2V5LnNldChzY3JvbGxMb2NrKTsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWVtZW50bzogTWVtZW50bztcblx0cHJpdmF0ZSByZWFkb25seSBwYW5lbFN0YXRlOiBNZW1lbnRvT2JqZWN0O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3UGFuZU9wdGlvbnMsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElPdXRwdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0U2VydmljZTogSU91dHB1dFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBtZW1lbnRvID0gbmV3IE1lbWVudG8oTWFya2Vycy5NQVJLRVJTX1ZJRVdfU1RPUkFHRV9JRCwgc3RvcmFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXdTdGF0ZSA9IG1lbWVudG8uZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdHN1cGVyKHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRmaWx0ZXJPcHRpb25zOiB7XG5cdFx0XHRcdHBsYWNlaG9sZGVyOiBsb2NhbGl6ZSgnb3V0cHV0Vmlldy5maWx0ZXIucGxhY2Vob2xkZXInLCBcIkZpbHRlclwiKSxcblx0XHRcdFx0Zm9jdXNDb250ZXh0S2V5OiBPVVRQVVRfRklMVEVSX0ZPQ1VTX0NPTlRFWFQua2V5LFxuXHRcdFx0XHR0ZXh0OiB2aWV3U3RhdGVbJ2ZpbHRlciddIHx8ICcnLFxuXHRcdFx0XHRoaXN0b3J5OiBbXVxuXHRcdFx0fVxuXHRcdH0sIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHRcdHRoaXMubWVtZW50byA9IG1lbWVudG87XG5cdFx0dGhpcy5wYW5lbFN0YXRlID0gdmlld1N0YXRlO1xuXG5cdFx0Y29uc3QgZmlsdGVycyA9IG91dHB1dFNlcnZpY2UuZmlsdGVycztcblx0XHRmaWx0ZXJzLnRleHQgPSB0aGlzLnBhbmVsU3RhdGVbJ2ZpbHRlciddIHx8ICcnO1xuXHRcdGZpbHRlcnMudHJhY2UgPSB0aGlzLnBhbmVsU3RhdGVbJ3Nob3dUcmFjZSddID8/IHRydWU7XG5cdFx0ZmlsdGVycy5kZWJ1ZyA9IHRoaXMucGFuZWxTdGF0ZVsnc2hvd0RlYnVnJ10gPz8gdHJ1ZTtcblx0XHRmaWx0ZXJzLmluZm8gPSB0aGlzLnBhbmVsU3RhdGVbJ3Nob3dJbmZvJ10gPz8gdHJ1ZTtcblx0XHRmaWx0ZXJzLndhcm5pbmcgPSB0aGlzLnBhbmVsU3RhdGVbJ3Nob3dXYXJuaW5nJ10gPz8gdHJ1ZTtcblx0XHRmaWx0ZXJzLmVycm9yID0gdGhpcy5wYW5lbFN0YXRlWydzaG93RXJyb3InXSA/PyB0cnVlO1xuXHRcdGZpbHRlcnMuY2F0ZWdvcmllcyA9IHRoaXMucGFuZWxTdGF0ZVsnY2F0ZWdvcmllcyddID8/ICcnO1xuXG5cdFx0dGhpcy5zY3JvbGxMb2NrQ29udGV4dEtleSA9IENPTlRFWFRfT1VUUFVUX1NDUk9MTF9MT0NLLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGVkaXRvckluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJQ29udGV4dEtleVNlcnZpY2UsIHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2VdKSkpO1xuXHRcdHRoaXMuZWRpdG9yID0gdGhpcy5fcmVnaXN0ZXIoZWRpdG9ySW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoT3V0cHV0RWRpdG9yKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3Iub25UaXRsZUFyZWFVcGRhdGUoKCkgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVUaXRsZSh0aGlzLmVkaXRvci5nZXRUaXRsZSgpKTtcblx0XHRcdHRoaXMudXBkYXRlQWN0aW9ucygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkoKCkgPT4gdGhpcy5vbkRpZENoYW5nZVZpc2liaWxpdHkodGhpcy5pc0JvZHlWaXNpYmxlKCkpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWx0ZXJXaWRnZXQub25EaWRDaGFuZ2VGaWx0ZXJUZXh0KHRleHQgPT4gb3V0cHV0U2VydmljZS5maWx0ZXJzLnRleHQgPSB0ZXh0KSk7XG5cblx0XHR0aGlzLmNoZWNrTW9yZUZpbHRlcnMoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihvdXRwdXRTZXJ2aWNlLmZpbHRlcnMub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5jaGVja01vcmVGaWx0ZXJzKCkpKTtcblx0fVxuXG5cdHNob3dDaGFubmVsKGNoYW5uZWw6IElPdXRwdXRDaGFubmVsLCBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY2hhbm5lbElkICE9PSBjaGFubmVsLmlkKSB7XG5cdFx0XHR0aGlzLnNldElucHV0KGNoYW5uZWwpO1xuXHRcdH1cblx0XHRpZiAoIXByZXNlcnZlRm9jdXMpIHtcblx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpOiB2b2lkIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXHRcdHRoaXMuZWRpdG9yUHJvbWlzZT8udGhlbigoKSA9PiB0aGlzLmVkaXRvci5mb2N1cygpKTtcblx0fVxuXG5cdHB1YmxpYyBjbGVhckZpbHRlclRleHQoKTogdm9pZCB7XG5cdFx0dGhpcy5maWx0ZXJXaWRnZXQuc2V0RmlsdGVyVGV4dCgnJyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXHRcdHRoaXMuZWRpdG9yLmNyZWF0ZShjb250YWluZXIpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdvdXRwdXQtdmlldycpO1xuXHRcdGNvbnN0IGNvZGVFZGl0b3IgPSA8SUNvZGVFZGl0b3I+dGhpcy5lZGl0b3IuZ2V0Q29udHJvbCgpO1xuXHRcdGNvZGVFZGl0b3Iuc2V0QXJpYU9wdGlvbnMoeyByb2xlOiAnZG9jdW1lbnQnLCBhY3RpdmVEZXNjZW5kYW50OiB1bmRlZmluZWQgfSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29kZUVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuc2Nyb2xsTG9jaykge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5yZXZlYWxMYXN0TGluZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb2RlRWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24oKGUpID0+IHtcblx0XHRcdGlmIChlLnJlYXNvbiAhPT0gQ3Vyc29yQ2hhbmdlUmVhc29uLkV4cGxpY2l0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdvdXRwdXQuc21hcnRTY3JvbGwuZW5hYmxlZCcpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbW9kZWwgPSBjb2RlRWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAobW9kZWwpIHtcblx0XHRcdFx0Y29uc3QgbmV3UG9zaXRpb25MaW5lID0gZS5wb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0XHRjb25zdCBsYXN0TGluZSA9IG1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdFx0XHR0aGlzLnNjcm9sbExvY2sgPSBsYXN0TGluZSAhPT0gbmV3UG9zaXRpb25MaW5lO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBsYXlvdXRCb2R5Q29udGVudChoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yLmxheW91dChuZXcgRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VWaXNpYmlsaXR5KHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvci5zZXRWaXNpYmxlKHZpc2libGUpO1xuXHRcdGlmICghdmlzaWJsZSkge1xuXHRcdFx0dGhpcy5jbGVhcklucHV0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXRJbnB1dChjaGFubmVsOiBJT3V0cHV0Q2hhbm5lbCk6IHZvaWQge1xuXHRcdHRoaXMuY2hhbm5lbElkID0gY2hhbm5lbC5pZDtcblx0XHR0aGlzLmNoZWNrTW9yZUZpbHRlcnMoKTtcblxuXHRcdGNvbnN0IGlucHV0ID0gdGhpcy5jcmVhdGVJbnB1dChjaGFubmVsKTtcblx0XHRpZiAoIXRoaXMuZWRpdG9yLmlucHV0IHx8ICFpbnB1dC5tYXRjaGVzKHRoaXMuZWRpdG9yLmlucHV0KSkge1xuXHRcdFx0dGhpcy5lZGl0b3JQcm9taXNlPy5jYW5jZWwoKTtcblx0XHRcdHRoaXMuZWRpdG9yUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHRoaXMuZWRpdG9yLnNldElucHV0KHRoaXMuY3JlYXRlSW5wdXQoY2hhbm5lbCksIHsgcHJlc2VydmVGb2N1czogdHJ1ZSB9LCBPYmplY3QuY3JlYXRlKG51bGwpLCB0b2tlbilcblx0XHRcdFx0LnRoZW4oKCkgPT4gdGhpcy5lZGl0b3IpKTtcblx0XHR9XG5cblx0fVxuXG5cdHByaXZhdGUgY2hlY2tNb3JlRmlsdGVycygpOiB2b2lkIHtcblx0XHRjb25zdCBmaWx0ZXJzID0gdGhpcy5vdXRwdXRTZXJ2aWNlLmZpbHRlcnM7XG5cdFx0dGhpcy5maWx0ZXJXaWRnZXQuY2hlY2tNb3JlRmlsdGVycyghZmlsdGVycy50cmFjZSB8fCAhZmlsdGVycy5kZWJ1ZyB8fCAhZmlsdGVycy5pbmZvIHx8ICFmaWx0ZXJzLndhcm5pbmcgfHwgIWZpbHRlcnMuZXJyb3IgfHwgKCEhdGhpcy5jaGFubmVsSWQgJiYgZmlsdGVycy5jYXRlZ29yaWVzLmluY2x1ZGVzKGAsJHt0aGlzLmNoYW5uZWxJZH06YCkpKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJJbnB1dCgpOiB2b2lkIHtcblx0XHR0aGlzLmNoYW5uZWxJZCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmVkaXRvci5jbGVhcklucHV0KCk7XG5cdFx0dGhpcy5lZGl0b3JQcm9taXNlID0gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlSW5wdXQoY2hhbm5lbDogSU91dHB1dENoYW5uZWwpOiBUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dFJlc291cmNlRWRpdG9ySW5wdXQsIGNoYW5uZWwudXJpLCBubHMubG9jYWxpemUoJ291dHB1dCBtb2RlbCB0aXRsZScsIFwiezB9IC0gT3V0cHV0XCIsIGNoYW5uZWwubGFiZWwpLCBubHMubG9jYWxpemUoJ2NoYW5uZWwnLCBcIk91dHB1dCBjaGFubmVsIGZvciAnezB9J1wiLCBjaGFubmVsLmxhYmVsKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2F2ZVN0YXRlKCk6IHZvaWQge1xuXHRcdGNvbnN0IGZpbHRlcnMgPSB0aGlzLm91dHB1dFNlcnZpY2UuZmlsdGVycztcblx0XHR0aGlzLnBhbmVsU3RhdGVbJ2ZpbHRlciddID0gZmlsdGVycy50ZXh0O1xuXHRcdHRoaXMucGFuZWxTdGF0ZVsnc2hvd1RyYWNlJ10gPSBmaWx0ZXJzLnRyYWNlO1xuXHRcdHRoaXMucGFuZWxTdGF0ZVsnc2hvd0RlYnVnJ10gPSBmaWx0ZXJzLmRlYnVnO1xuXHRcdHRoaXMucGFuZWxTdGF0ZVsnc2hvd0luZm8nXSA9IGZpbHRlcnMuaW5mbztcblx0XHR0aGlzLnBhbmVsU3RhdGVbJ3Nob3dXYXJuaW5nJ10gPSBmaWx0ZXJzLndhcm5pbmc7XG5cdFx0dGhpcy5wYW5lbFN0YXRlWydzaG93RXJyb3InXSA9IGZpbHRlcnMuZXJyb3I7XG5cdFx0dGhpcy5wYW5lbFN0YXRlWydjYXRlZ29yaWVzJ10gPSBmaWx0ZXJzLmNhdGVnb3JpZXM7XG5cblx0XHR0aGlzLm1lbWVudG8uc2F2ZU1lbWVudG8oKTtcblx0XHRzdXBlci5zYXZlU3RhdGUoKTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBPdXRwdXRFZGl0b3IgZXh0ZW5kcyBBYnN0cmFjdFRleHRSZXNvdXJjZUVkaXRvciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVzb3VyY2VDb250ZXh0OiBSZXNvdXJjZUNvbnRleHRLZXk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZTogSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKE9VVFBVVF9WSUVXX0lELCBlZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXAgLyogdGhpcyBpcyBub3QgY29ycmVjdCBidXQgcHJhZ21hdGljICovLCB0ZWxlbWV0cnlTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGVkaXRvckdyb3VwU2VydmljZSwgZWRpdG9yU2VydmljZSwgZmlsZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5yZXNvdXJjZUNvbnRleHQgPSB0aGlzLl9yZWdpc3RlcihpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUNvbnRleHRLZXkpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIE9VVFBVVF9WSUVXX0lEO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0VGl0bGUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdvdXRwdXQnLCBcIk91dHB1dFwiKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRDb25maWd1cmF0aW9uT3ZlcnJpZGVzKGNvbmZpZ3VyYXRpb246IElFZGl0b3JDb25maWd1cmF0aW9uKTogSUNvZGVFZGl0b3JPcHRpb25zIHtcblx0XHRjb25zdCBvcHRpb25zID0gc3VwZXIuZ2V0Q29uZmlndXJhdGlvbk92ZXJyaWRlcyhjb25maWd1cmF0aW9uKTtcblx0XHRvcHRpb25zLndvcmRXcmFwID0gJ29uJztcdFx0XHRcdC8vIGFsbCBvdXRwdXQgZWRpdG9ycyB3cmFwXG5cdFx0b3B0aW9ucy5saW5lTnVtYmVycyA9ICdvZmYnO1x0XHRcdC8vIGFsbCBvdXRwdXQgZWRpdG9ycyBoaWRlIGxpbmUgbnVtYmVyc1xuXHRcdG9wdGlvbnMuZ2x5cGhNYXJnaW4gPSBmYWxzZTtcblx0XHRvcHRpb25zLmxpbmVEZWNvcmF0aW9uc1dpZHRoID0gMjA7XG5cdFx0b3B0aW9ucy5ydWxlcnMgPSBbXTtcblx0XHRvcHRpb25zLmZvbGRpbmcgPSBmYWxzZTtcblx0XHRvcHRpb25zLnNjcm9sbEJleW9uZExhc3RMaW5lID0gZmFsc2U7XG5cdFx0b3B0aW9ucy5yZW5kZXJMaW5lSGlnaGxpZ2h0ID0gJ25vbmUnO1xuXHRcdG9wdGlvbnMubWluaW1hcCA9IHsgZW5hYmxlZDogZmFsc2UgfTtcblx0XHRvcHRpb25zLnJlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9ucyA9ICdlZGl0YWJsZSc7XG5cdFx0b3B0aW9ucy5wYWRkaW5nID0gdW5kZWZpbmVkO1xuXHRcdG9wdGlvbnMucmVhZE9ubHkgPSB0cnVlO1xuXHRcdG9wdGlvbnMuZG9tUmVhZE9ubHkgPSB0cnVlO1xuXHRcdG9wdGlvbnMudW5pY29kZUhpZ2hsaWdodCA9IHtcblx0XHRcdG5vbkJhc2ljQVNDSUk6IGZhbHNlLFxuXHRcdFx0aW52aXNpYmxlQ2hhcmFjdGVyczogZmFsc2UsXG5cdFx0XHRhbWJpZ3VvdXNDaGFyYWN0ZXJzOiBmYWxzZSxcblx0XHR9O1xuXG5cdFx0Y29uc3Qgb3V0cHV0Q29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxhbnk+KCdbTG9nXScpO1xuXHRcdGlmIChvdXRwdXRDb25maWcpIHtcblx0XHRcdGlmIChvdXRwdXRDb25maWdbJ2VkaXRvci5taW5pbWFwLmVuYWJsZWQnXSkge1xuXHRcdFx0XHRvcHRpb25zLm1pbmltYXAgPSB7IGVuYWJsZWQ6IHRydWUgfTtcblx0XHRcdH1cblx0XHRcdGlmICgnZWRpdG9yLndvcmRXcmFwJyBpbiBvdXRwdXRDb25maWcpIHtcblx0XHRcdFx0b3B0aW9ucy53b3JkV3JhcCA9IG91dHB1dENvbmZpZ1snZWRpdG9yLndvcmRXcmFwJ107XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9wdGlvbnM7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXQgPyB0aGlzLmlucHV0LmdldEFyaWFMYWJlbCgpIDogbmxzLmxvY2FsaXplKCdvdXRwdXRWaWV3QXJpYUxhYmVsJywgXCJPdXRwdXQgcGFuZWxcIik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY29tcHV0ZUFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmlucHV0ID8gY29tcHV0ZUVkaXRvckFyaWFMYWJlbCh0aGlzLmlucHV0LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuY291bnQpIDogdGhpcy5nZXRBcmlhTGFiZWwoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHNldElucHV0KGlucHV0OiBUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCwgb3B0aW9uczogSVRleHRFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZvY3VzID0gIShvcHRpb25zICYmIG9wdGlvbnMucHJlc2VydmVGb2N1cyk7XG5cdFx0aWYgKHRoaXMuaW5wdXQgJiYgaW5wdXQubWF0Y2hlcyh0aGlzLmlucHV0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlucHV0KSB7XG5cdFx0XHQvLyBEaXNwb3NlIHByZXZpb3VzIGlucHV0IChPdXRwdXQgcGFuZWwgaXMgbm90IGEgd29ya2JlbmNoIGVkaXRvcilcblx0XHRcdHRoaXMuaW5wdXQuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRhd2FpdCBzdXBlci5zZXRJbnB1dChpbnB1dCwgb3B0aW9ucywgY29udGV4dCwgdG9rZW4pO1xuXG5cdFx0dGhpcy5yZXNvdXJjZUNvbnRleHQuc2V0KGlucHV0LnJlc291cmNlKTtcblxuXHRcdGlmIChmb2N1cykge1xuXHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdH1cblx0XHR0aGlzLnJldmVhbExhc3RMaW5lKCk7XG5cdH1cblxuXHRvdmVycmlkZSBjbGVhcklucHV0KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlucHV0KSB7XG5cdFx0XHQvLyBEaXNwb3NlIGN1cnJlbnQgaW5wdXQgKE91dHB1dCBwYW5lbCBpcyBub3QgYSB3b3JrYmVuY2ggZWRpdG9yKVxuXHRcdFx0dGhpcy5pbnB1dC5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdHN1cGVyLmNsZWFySW5wdXQoKTtcblxuXHRcdHRoaXMucmVzb3VyY2VDb250ZXh0LnJlc2V0KCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlRWRpdG9yKHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblxuXHRcdHBhcmVudC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZG9jdW1lbnQnKTtcblxuXHRcdHN1cGVyLmNyZWF0ZUVkaXRvcihwYXJlbnQpO1xuXG5cdFx0Y29uc3Qgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPSB0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlO1xuXHRcdGlmIChzY29wZWRDb250ZXh0S2V5U2VydmljZSkge1xuXHRcdFx0Q09OVEVYVF9JTl9PVVRQVVQuYmluZFRvKHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKS5zZXQodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q29udHJpYnV0aW9ucygpOiBJRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb25bXSB7XG5cdFx0cmV0dXJuIFtcblx0XHRcdC4uLkVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRFZGl0b3JDb250cmlidXRpb25zKCksXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBGaWx0ZXJDb250cm9sbGVyLklELFxuXHRcdFx0XHRjdG9yOiBGaWx0ZXJDb250cm9sbGVyIGFzIEVkaXRvckNvbnRyaWJ1dGlvbkN0b3IsXG5cdFx0XHRcdGluc3RhbnRpYXRpb246IEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24uRWFnZXJcblx0XHRcdH1cblx0XHRdO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldENvZGVFZGl0b3JXaWRnZXRPcHRpb25zKCk6IElDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyB7XG5cdFx0cmV0dXJuIHsgY29udHJpYnV0aW9uczogdGhpcy5fZ2V0Q29udHJpYnV0aW9ucygpIH07XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgRmlsdGVyQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ291dHB1dC5lZGl0b3IuY29udHJpYi5maWx0ZXJDb250cm9sbGVyJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgaGlkZGVuQXJlYXM6IFJhbmdlW10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBjYXRlZ29yaWVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBkZWNvcmF0aW9uc0NvbGxlY3Rpb246IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb247XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJT3V0cHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG91dHB1dFNlcnZpY2U6IElPdXRwdXRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuZGVjb3JhdGlvbnNDb2xsZWN0aW9uID0gZWRpdG9yLmNyZWF0ZURlY29yYXRpb25zQ29sbGVjdGlvbigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHRoaXMub25EaWRDaGFuZ2VNb2RlbCgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vdXRwdXRTZXJ2aWNlLmZpbHRlcnMub25EaWRDaGFuZ2UoKCkgPT4gZWRpdG9yLmhhc01vZGVsKCkgJiYgdGhpcy5maWx0ZXIoZWRpdG9yLmdldE1vZGVsKCkpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlTW9kZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5tb2RlbERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5oaWRkZW5BcmVhcyA9IFtdO1xuXHRcdHRoaXMuY2F0ZWdvcmllcy5jbGVhcigpO1xuXG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdHRoaXMuZmlsdGVyKG1vZGVsKTtcblxuXHRcdGNvbnN0IGNvbXB1dGVFbmRMaW5lTnVtYmVyID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgZW5kTGluZU51bWJlciA9IG1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdFx0cmV0dXJuIGVuZExpbmVOdW1iZXIgPiAxICYmIG1vZGVsLmdldExpbmVNYXhDb2x1bW4oZW5kTGluZU51bWJlcikgPT09IDEgPyBlbmRMaW5lTnVtYmVyIC0gMSA6IGVuZExpbmVOdW1iZXI7XG5cdFx0fTtcblxuXHRcdGxldCBlbmRMaW5lTnVtYmVyID0gY29tcHV0ZUVuZExpbmVOdW1iZXIoKTtcblxuXHRcdHRoaXMubW9kZWxEaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRDaGFuZ2VDb250ZW50KGUgPT4ge1xuXHRcdFx0aWYgKGUuY2hhbmdlcy5ldmVyeShlID0+IGUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyID4gZW5kTGluZU51bWJlcikpIHtcblx0XHRcdFx0dGhpcy5maWx0ZXJJbmNyZW1lbnRhbChtb2RlbCwgZW5kTGluZU51bWJlciArIDEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5maWx0ZXIobW9kZWwpO1xuXHRcdFx0fVxuXHRcdFx0ZW5kTGluZU51bWJlciA9IGNvbXB1dGVFbmRMaW5lTnVtYmVyKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXIobW9kZWw6IElUZXh0TW9kZWwpOiB2b2lkIHtcblx0XHR0aGlzLmhpZGRlbkFyZWFzID0gW107XG5cdFx0dGhpcy5kZWNvcmF0aW9uc0NvbGxlY3Rpb24uY2xlYXIoKTtcblx0XHR0aGlzLmZpbHRlckluY3JlbWVudGFsKG1vZGVsLCAxKTtcblx0fVxuXG5cdHByaXZhdGUgZmlsdGVySW5jcmVtZW50YWwobW9kZWw6IElUZXh0TW9kZWwsIGZyb21MaW5lTnVtYmVyOiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCB7IGZpbmRNYXRjaGVzLCBoaWRkZW5BcmVhcywgY2F0ZWdvcmllczogc291cmNlcyB9ID0gdGhpcy5jb21wdXRlKG1vZGVsLCBmcm9tTGluZU51bWJlcik7XG5cdFx0dGhpcy5oaWRkZW5BcmVhcy5wdXNoKC4uLmhpZGRlbkFyZWFzKTtcblx0XHR0aGlzLmVkaXRvci5zZXRIaWRkZW5BcmVhcyh0aGlzLmhpZGRlbkFyZWFzLCB0aGlzKTtcblx0XHRpZiAoZmluZE1hdGNoZXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmRlY29yYXRpb25zQ29sbGVjdGlvbi5hcHBlbmQoZmluZE1hdGNoZXMpO1xuXHRcdH1cblx0XHRpZiAoc291cmNlcy5zaXplKSB7XG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdGZvciAoY29uc3QgW2NhdGVnb3J5RmlsdGVyLCBjYXRlZ29yeU5hbWVdIG9mIHNvdXJjZXMpIHtcblx0XHRcdFx0aWYgKHRoaXMuY2F0ZWdvcmllcy5oYXMoY2F0ZWdvcnlGaWx0ZXIpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5jYXRlZ29yaWVzLnNldChjYXRlZ29yeUZpbHRlciwgY2F0ZWdvcnlOYW1lKTtcblx0XHRcdFx0dGhpcy5tb2RlbERpc3Bvc2FibGVzLmFkZChyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9ucy4ke09VVFBVVF9WSUVXX0lEfS50b2dnbGUuJHtjYXRlZ29yeUZpbHRlcn1gLFxuXHRcdFx0XHRcdFx0XHR0aXRsZTogY2F0ZWdvcnlOYW1lLFxuXHRcdFx0XHRcdFx0XHR0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5yZWdleChISURFX0NBVEVHT1JZX0ZJTFRFUl9DT05URVhULmtleSwgbmV3IFJlZ0V4cChgLiosJHtlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzKGNhdGVnb3J5RmlsdGVyKX0sLipgKSkubmVnYXRlKCksXG5cdFx0XHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdFx0XHRpZDogdmlld0ZpbHRlclN1Ym1lbnUsXG5cdFx0XHRcdFx0XHRcdFx0Z3JvdXA6ICcxX2NhdGVnb3J5X2ZpbHRlcicsXG5cdFx0XHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9VVFBVVF9WSUVXX0lEKSksXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0XHR0aGF0Lm91dHB1dFNlcnZpY2UuZmlsdGVycy50b2dnbGVDYXRlZ29yeShjYXRlZ29yeUZpbHRlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjb21wdXRlKG1vZGVsOiBJVGV4dE1vZGVsLCBmcm9tTGluZU51bWJlcjogbnVtYmVyKTogeyBmaW5kTWF0Y2hlczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW107IGhpZGRlbkFyZWFzOiBSYW5nZVtdOyBjYXRlZ29yaWVzOiBNYXA8c3RyaW5nLCBzdHJpbmc+IH0ge1xuXHRcdGNvbnN0IGZpbHRlcnMgPSB0aGlzLm91dHB1dFNlcnZpY2UuZmlsdGVycztcblx0XHRjb25zdCBhY3RpdmVDaGFubmVsID0gdGhpcy5vdXRwdXRTZXJ2aWNlLmdldEFjdGl2ZUNoYW5uZWwoKTtcblx0XHRjb25zdCBmaW5kTWF0Y2hlczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRjb25zdCBoaWRkZW5BcmVhczogUmFuZ2VbXSA9IFtdO1xuXHRcdGNvbnN0IGNhdGVnb3JpZXMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG5cdFx0Y29uc3QgbG9nRW50cmllcyA9IGFjdGl2ZUNoYW5uZWw/LmdldExvZ0VudHJpZXMoKTtcblx0XHRpZiAoYWN0aXZlQ2hhbm5lbCAmJiBsb2dFbnRyaWVzPy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGhhc0xvZ0xldmVsRmlsdGVyID0gIWZpbHRlcnMudHJhY2UgfHwgIWZpbHRlcnMuZGVidWcgfHwgIWZpbHRlcnMuaW5mbyB8fCAhZmlsdGVycy53YXJuaW5nIHx8ICFmaWx0ZXJzLmVycm9yO1xuXG5cdFx0XHRjb25zdCBmcm9tTG9nTGV2ZWxFbnRyeUluZGV4ID0gbG9nRW50cmllcy5maW5kSW5kZXgoZW50cnkgPT4gZnJvbUxpbmVOdW1iZXIgPj0gZW50cnkucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICYmIGZyb21MaW5lTnVtYmVyIDw9IGVudHJ5LnJhbmdlLmVuZExpbmVOdW1iZXIpO1xuXHRcdFx0aWYgKGZyb21Mb2dMZXZlbEVudHJ5SW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdHJldHVybiB7IGZpbmRNYXRjaGVzLCBoaWRkZW5BcmVhcywgY2F0ZWdvcmllcyB9O1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGxldCBpID0gZnJvbUxvZ0xldmVsRW50cnlJbmRleDsgaSA8IGxvZ0VudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSBsb2dFbnRyaWVzW2ldO1xuXHRcdFx0XHRpZiAoZW50cnkuY2F0ZWdvcnkpIHtcblx0XHRcdFx0XHRjYXRlZ29yaWVzLnNldChgJHthY3RpdmVDaGFubmVsLmlkfToke2VudHJ5LmNhdGVnb3J5fWAsIGVudHJ5LmNhdGVnb3J5KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaGFzTG9nTGV2ZWxGaWx0ZXIgJiYgIXRoaXMuc2hvdWxkU2hvd0xvZ0xldmVsKGVudHJ5LCBmaWx0ZXJzKSkge1xuXHRcdFx0XHRcdGhpZGRlbkFyZWFzLnB1c2goZW50cnkucmFuZ2UpO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghdGhpcy5zaG91bGRTaG93Q2F0ZWdvcnkoYWN0aXZlQ2hhbm5lbC5pZCwgZW50cnksIGZpbHRlcnMpKSB7XG5cdFx0XHRcdFx0aGlkZGVuQXJlYXMucHVzaChlbnRyeS5yYW5nZSk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZpbHRlcnMudGV4dCkge1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoZXMgPSBtb2RlbC5maW5kTWF0Y2hlcyhmaWx0ZXJzLnRleHQsIGVudHJ5LnJhbmdlLCBmYWxzZSwgZmFsc2UsIG51bGwsIGZhbHNlKTtcblx0XHRcdFx0XHRpZiAobWF0Y2hlcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgbWF0Y2ggb2YgbWF0Y2hlcykge1xuXHRcdFx0XHRcdFx0XHRmaW5kTWF0Y2hlcy5wdXNoKHsgcmFuZ2U6IG1hdGNoLnJhbmdlLCBvcHRpb25zOiBGaW5kRGVjb3JhdGlvbnMuX0ZJTkRfTUFUQ0hfREVDT1JBVElPTiB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aGlkZGVuQXJlYXMucHVzaChlbnRyeS5yYW5nZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyBmaW5kTWF0Y2hlcywgaGlkZGVuQXJlYXMsIGNhdGVnb3JpZXMgfTtcblx0XHR9XG5cblx0XHRpZiAoIWZpbHRlcnMudGV4dCkge1xuXHRcdFx0cmV0dXJuIHsgZmluZE1hdGNoZXMsIGhpZGRlbkFyZWFzLCBjYXRlZ29yaWVzIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZUNvdW50ID0gbW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdFx0Zm9yIChsZXQgbGluZU51bWJlciA9IGZyb21MaW5lTnVtYmVyOyBsaW5lTnVtYmVyIDw9IGxpbmVDb3VudDsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRjb25zdCBsaW5lUmFuZ2UgPSBuZXcgUmFuZ2UobGluZU51bWJlciwgMSwgbGluZU51bWJlciwgbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSk7XG5cdFx0XHRjb25zdCBtYXRjaGVzID0gbW9kZWwuZmluZE1hdGNoZXMoZmlsdGVycy50ZXh0LCBsaW5lUmFuZ2UsIGZhbHNlLCBmYWxzZSwgbnVsbCwgZmFsc2UpO1xuXHRcdFx0aWYgKG1hdGNoZXMubGVuZ3RoKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgbWF0Y2ggb2YgbWF0Y2hlcykge1xuXHRcdFx0XHRcdGZpbmRNYXRjaGVzLnB1c2goeyByYW5nZTogbWF0Y2gucmFuZ2UsIG9wdGlvbnM6IEZpbmREZWNvcmF0aW9ucy5fRklORF9NQVRDSF9ERUNPUkFUSU9OIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoaWRkZW5BcmVhcy5wdXNoKGxpbmVSYW5nZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB7IGZpbmRNYXRjaGVzLCBoaWRkZW5BcmVhcywgY2F0ZWdvcmllcyB9O1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRTaG93TG9nTGV2ZWwoZW50cnk6IElMb2dFbnRyeSwgZmlsdGVyczogSU91dHB1dFZpZXdGaWx0ZXJzKTogYm9vbGVhbiB7XG5cdFx0c3dpdGNoIChlbnRyeS5sb2dMZXZlbCkge1xuXHRcdFx0Y2FzZSBMb2dMZXZlbC5UcmFjZTpcblx0XHRcdFx0cmV0dXJuIGZpbHRlcnMudHJhY2U7XG5cdFx0XHRjYXNlIExvZ0xldmVsLkRlYnVnOlxuXHRcdFx0XHRyZXR1cm4gZmlsdGVycy5kZWJ1Zztcblx0XHRcdGNhc2UgTG9nTGV2ZWwuSW5mbzpcblx0XHRcdFx0cmV0dXJuIGZpbHRlcnMuaW5mbztcblx0XHRcdGNhc2UgTG9nTGV2ZWwuV2FybmluZzpcblx0XHRcdFx0cmV0dXJuIGZpbHRlcnMud2FybmluZztcblx0XHRcdGNhc2UgTG9nTGV2ZWwuRXJyb3I6XG5cdFx0XHRcdHJldHVybiBmaWx0ZXJzLmVycm9yO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkU2hvd0NhdGVnb3J5KGFjdGl2ZUNoYW5uZWxJZDogc3RyaW5nLCBlbnRyeTogSUxvZ0VudHJ5LCBmaWx0ZXJzOiBJT3V0cHV0Vmlld0ZpbHRlcnMpOiBib29sZWFuIHtcblx0XHRpZiAoIWVudHJ5LmNhdGVnb3J5KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuICFmaWx0ZXJzLmhhc0NhdGVnb3J5KGAke2FjdGl2ZUNoYW5uZWxJZH06JHtlbnRyeS5jYXRlZ29yeX1gKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFJQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBR3JCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsb0JBQWlDLHNCQUFzQjtBQUVoRSxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGdCQUFnQixtQkFBbUMsNEJBQTRCLGdCQUFvQyw2QkFBd0Msb0NBQW9DO0FBQ3hNLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMEJBQTBCO0FBQ25DLFNBQTJCLHNCQUFzQjtBQUNqRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGlCQUFpQjtBQUUxQixTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLGdCQUFnQjtBQUN6QixTQUF5QywwQkFBMEIsdUNBQStEO0FBSWxJLFNBQVMsYUFBYTtBQUN0QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQThCO0FBQ3ZDLFNBQVMsZUFBZTtBQUN4QixTQUFTLFNBQVMsdUJBQXVCO0FBQ3pDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsOEJBQThCO0FBRWhDLElBQU0saUJBQU4sY0FB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
