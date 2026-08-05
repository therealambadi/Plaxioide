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
import * as nls from "../../../../nls.js";
import "./media/dirtydiffDecorator.css";
import { Disposable, DisposableStore, DisposableMap } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ModelDecorationOptions } from "../../../../editor/common/model/textModel.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { OverviewRulerLane, MinimapPosition } from "../../../../editor/common/model.js";
import * as domStylesheetsJs from "../../../../base/browser/domStylesheets.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ChangeType, getChangeType, minimapGutterAddedBackground, minimapGutterDeletedBackground, minimapGutterModifiedBackground, overviewRulerAddedForeground, overviewRulerDeletedForeground, overviewRulerModifiedForeground } from "../common/quickDiff.js";
import { IQuickDiffModelService } from "./quickDiffModel.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { autorun, autorunWithStore, observableFromEvent } from "../../../../base/common/observable.js";
const quickDiffDecorationCount = new RawContextKey("quickDiffDecorationCount", 0);
let QuickDiffDecorator = class extends Disposable {
  constructor(codeEditor, quickDiffModelRef, configurationService) {
    super();
    this.codeEditor = codeEditor;
    this.quickDiffModelRef = quickDiffModelRef;
    this.configurationService = configurationService;
    const decorations = configurationService.getValue("scm.diffDecorations");
    const gutter = decorations === "all" || decorations === "gutter";
    const overview = decorations === "all" || decorations === "overview";
    const minimap = decorations === "all" || decorations === "minimap";
    const diffAdded = nls.localize("diffAdded", "Added lines");
    this.addedOptions = QuickDiffDecorator.createDecoration("dirty-diff-added", diffAdded, {
      gutter,
      overview: { active: overview, color: overviewRulerAddedForeground },
      minimap: { active: minimap, color: minimapGutterAddedBackground },
      isWholeLine: true
    });
    this.addedPatternOptions = QuickDiffDecorator.createDecoration("dirty-diff-added-pattern", diffAdded, {
      gutter,
      overview: { active: overview, color: overviewRulerAddedForeground },
      minimap: { active: minimap, color: minimapGutterAddedBackground },
      isWholeLine: true
    });
    const diffModified = nls.localize("diffModified", "Changed lines");
    this.modifiedOptions = QuickDiffDecorator.createDecoration("dirty-diff-modified", diffModified, {
      gutter,
      overview: { active: overview, color: overviewRulerModifiedForeground },
      minimap: { active: minimap, color: minimapGutterModifiedBackground },
      isWholeLine: true
    });
    this.modifiedPatternOptions = QuickDiffDecorator.createDecoration("dirty-diff-modified-pattern", diffModified, {
      gutter,
      overview: { active: overview, color: overviewRulerModifiedForeground },
      minimap: { active: minimap, color: minimapGutterModifiedBackground },
      isWholeLine: true
    });
    this.deletedOptions = QuickDiffDecorator.createDecoration("dirty-diff-deleted", nls.localize("diffDeleted", "Removed lines"), {
      gutter,
      overview: { active: overview, color: overviewRulerDeletedForeground },
      minimap: { active: minimap, color: minimapGutterDeletedBackground },
      isWholeLine: false
    });
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("scm.diffDecorationsGutterPattern")) {
        this.onDidChange();
      }
    }));
    this._register(Event.runAndSubscribe(this.quickDiffModelRef.object.onDidChange, () => this.onDidChange()));
  }
  static createDecoration(className, tooltip, options) {
    const decorationOptions = {
      description: "dirty-diff-decoration",
      isWholeLine: options.isWholeLine
    };
    if (options.gutter) {
      decorationOptions.linesDecorationsClassName = `dirty-diff-glyph ${className}`;
      decorationOptions.linesDecorationsTooltip = tooltip;
    }
    if (options.overview.active) {
      decorationOptions.overviewRuler = {
        color: themeColorFromId(options.overview.color),
        position: OverviewRulerLane.Left
      };
    }
    if (options.minimap.active) {
      decorationOptions.minimap = {
        color: themeColorFromId(options.minimap.color),
        position: MinimapPosition.Gutter
      };
    }
    return ModelDecorationOptions.createDynamic(decorationOptions);
  }
  onDidChange() {
    if (!this.codeEditor.hasModel()) {
      return;
    }
    const visibleQuickDiffs = this.quickDiffModelRef.object.quickDiffs.filter((quickDiff) => quickDiff.visible);
    const pattern = this.configurationService.getValue("scm.diffDecorationsGutterPattern");
    const decorations = this.quickDiffModelRef.object.changes.filter((labeledChange) => visibleQuickDiffs.some((quickDiff) => quickDiff.label === labeledChange.label)).map((labeledChange) => {
      const change = labeledChange.change;
      const changeType = getChangeType(change);
      const startLineNumber = change.modifiedStartLineNumber;
      const endLineNumber = change.modifiedEndLineNumber || startLineNumber;
      switch (changeType) {
        case ChangeType.Add:
          return {
            range: {
              startLineNumber,
              startColumn: 1,
              endLineNumber,
              endColumn: 1
            },
            options: pattern.added ? this.addedPatternOptions : this.addedOptions
          };
        case ChangeType.Delete:
          return {
            range: {
              startLineNumber,
              startColumn: Number.MAX_VALUE,
              endLineNumber: startLineNumber,
              endColumn: Number.MAX_VALUE
            },
            options: this.deletedOptions
          };
        case ChangeType.Modify:
          return {
            range: {
              startLineNumber,
              startColumn: 1,
              endLineNumber,
              endColumn: 1
            },
            options: pattern.modified ? this.modifiedPatternOptions : this.modifiedOptions
          };
      }
    });
    if (!this.decorationsCollection) {
      this.decorationsCollection = this.codeEditor.createDecorationsCollection(decorations);
    } else {
      this.decorationsCollection.set(decorations);
    }
  }
  dispose() {
    if (this.decorationsCollection) {
      this.decorationsCollection.clear();
    }
    this.decorationsCollection = void 0;
    this.quickDiffModelRef.dispose();
    super.dispose();
  }
};
QuickDiffDecorator = __decorateClass([
  __decorateParam(2, IConfigurationService)
], QuickDiffDecorator);
let QuickDiffWorkbenchController = class extends Disposable {
  constructor(editorService, configurationService, quickDiffModelService, uriIdentityService, contextKeyService) {
    super();
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.quickDiffModelService = quickDiffModelService;
    this.uriIdentityService = uriIdentityService;
    this.enabled = false;
    // Resource URI -> Code Editor Id -> Decoration (Disposable)
    this.decorators = new ResourceMap();
    this.viewState = { width: 3, visibility: "always" };
    this.transientDisposables = this._register(new DisposableStore());
    this.stylesheet = domStylesheetsJs.createStyleSheet(void 0, void 0, this._store);
    this.quickDiffDecorationCount = quickDiffDecorationCount.bindTo(contextKeyService);
    this.activeEditor = observableFromEvent(
      this,
      this.editorService.onDidActiveEditorChange,
      () => this.editorService.activeEditor
    );
    const onDidChangeConfiguration = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.diffDecorations"));
    this._register(onDidChangeConfiguration(this.onDidChangeConfiguration, this));
    this.onDidChangeConfiguration();
    const onDidChangeDiffWidthConfiguration = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.diffDecorationsGutterWidth"));
    this._register(onDidChangeDiffWidthConfiguration(this.onDidChangeDiffWidthConfiguration, this));
    this.onDidChangeDiffWidthConfiguration();
    const onDidChangeDiffVisibilityConfiguration = Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("scm.diffDecorationsGutterVisibility"));
    this._register(onDidChangeDiffVisibilityConfiguration(this.onDidChangeDiffVisibilityConfiguration, this));
    this.onDidChangeDiffVisibilityConfiguration();
  }
  onDidChangeConfiguration() {
    const enabled = this.configurationService.getValue("scm.diffDecorations") !== "none";
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
  onDidChangeDiffWidthConfiguration() {
    let width = this.configurationService.getValue("scm.diffDecorationsGutterWidth");
    if (isNaN(width) || width <= 0 || width > 5) {
      width = 3;
    }
    this.setViewState({ ...this.viewState, width });
  }
  onDidChangeDiffVisibilityConfiguration() {
    const visibility = this.configurationService.getValue("scm.diffDecorationsGutterVisibility");
    this.setViewState({ ...this.viewState, visibility });
  }
  setViewState(state) {
    this.viewState = state;
    this.stylesheet.textContent = `
			.monaco-editor .dirty-diff-added,
			.monaco-editor .dirty-diff-modified {
				border-left-width:${state.width}px;
			}
			.monaco-editor .dirty-diff-added-pattern,
			.monaco-editor .dirty-diff-added-pattern:before,
			.monaco-editor .dirty-diff-modified-pattern,
			.monaco-editor .dirty-diff-modified-pattern:before {
				background-size: ${state.width}px ${state.width}px;
			}
			.monaco-editor .dirty-diff-added,
			.monaco-editor .dirty-diff-added-pattern,
			.monaco-editor .dirty-diff-modified,
			.monaco-editor .dirty-diff-modified-pattern,
			.monaco-editor .dirty-diff-deleted {
				opacity: ${state.visibility === "always" ? 1 : 0};
			}
		`;
  }
  enable() {
    if (this.enabled) {
      this.disable();
    }
    this.transientDisposables.add(Event.any(this.editorService.onDidCloseEditor, this.editorService.onDidVisibleEditorsChange)(() => this.onEditorsChanged()));
    this.onEditorsChanged();
    this.onDidActiveEditorChange();
    this.enabled = true;
  }
  disable() {
    if (!this.enabled) {
      return;
    }
    this.transientDisposables.clear();
    this.quickDiffDecorationCount.set(0);
    for (const [uri, decoratorMap] of this.decorators.entries()) {
      decoratorMap.dispose();
      this.decorators.delete(uri);
    }
    this.enabled = false;
  }
  onDidActiveEditorChange() {
    this.transientDisposables.add(autorunWithStore((reader, store) => {
      const activeEditor = this.activeEditor.read(reader);
      const activeTextEditorControl = this.editorService.activeTextEditorControl;
      if (!isCodeEditor(activeTextEditorControl) || !activeEditor?.resource) {
        this.quickDiffDecorationCount.set(0);
        return;
      }
      const quickDiffModelRef = this.quickDiffModelService.createQuickDiffModelReference(activeEditor.resource);
      if (!quickDiffModelRef) {
        this.quickDiffDecorationCount.set(0);
        return;
      }
      store.add(quickDiffModelRef);
      const visibleDecorationCount = observableFromEvent(
        this,
        quickDiffModelRef.object.onDidChange,
        () => {
          const visibleQuickDiffs = quickDiffModelRef.object.quickDiffs.filter((quickDiff) => quickDiff.visible);
          return quickDiffModelRef.object.changes.filter((labeledChange) => visibleQuickDiffs.some((quickDiff) => quickDiff.label === labeledChange.label)).length;
        }
      );
      store.add(autorun((reader2) => {
        const count = visibleDecorationCount.read(reader2);
        this.quickDiffDecorationCount.set(count);
      }));
    }));
  }
  onEditorsChanged() {
    for (const editor of this.editorService.visibleTextEditorControls) {
      if (!isCodeEditor(editor)) {
        continue;
      }
      const textModel = editor.getModel();
      if (!textModel) {
        continue;
      }
      const editorId = editor.getId();
      if (this.decorators.get(textModel.uri)?.has(editorId)) {
        continue;
      }
      const quickDiffModelRef = this.quickDiffModelService.createQuickDiffModelReference(textModel.uri);
      if (!quickDiffModelRef) {
        continue;
      }
      if (!this.decorators.has(textModel.uri)) {
        this.decorators.set(textModel.uri, new DisposableMap());
      }
      this.decorators.get(textModel.uri).set(editorId, new QuickDiffDecorator(editor, quickDiffModelRef, this.configurationService));
    }
    for (const [uri, decoratorMap] of this.decorators.entries()) {
      for (const editorId of decoratorMap.keys()) {
        const codeEditor = this.editorService.visibleTextEditorControls.find((editor) => isCodeEditor(editor) && editor.getId() === editorId && this.uriIdentityService.extUri.isEqual(editor.getModel()?.uri, uri));
        if (!codeEditor) {
          decoratorMap.deleteAndDispose(editorId);
        }
      }
      if (decoratorMap.size === 0) {
        decoratorMap.dispose();
        this.decorators.delete(uri);
      }
    }
  }
  dispose() {
    this.disable();
    super.dispose();
  }
};
QuickDiffWorkbenchController = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IQuickDiffModelService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, IContextKeyService)
], QuickDiffWorkbenchController);
export {
  QuickDiffWorkbenchController,
  quickDiffDecorationCount
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci9xdWlja0RpZmZEZWNvcmF0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcblxuaW1wb3J0ICcuL21lZGlhL2RpcnR5ZGlmZkRlY29yYXRvci5jc3MnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBEaXNwb3NhYmxlTWFwLCBJUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBNb2RlbERlY29yYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgdGhlbWVDb2xvckZyb21JZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIGlzQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IE92ZXJ2aWV3UnVsZXJMYW5lLCBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgTWluaW1hcFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgKiBhcyBkb21TdHlsZXNoZWV0c0pzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGFuZ2VUeXBlLCBnZXRDaGFuZ2VUeXBlLCBtaW5pbWFwR3V0dGVyQWRkZWRCYWNrZ3JvdW5kLCBtaW5pbWFwR3V0dGVyRGVsZXRlZEJhY2tncm91bmQsIG1pbmltYXBHdXR0ZXJNb2RpZmllZEJhY2tncm91bmQsIG92ZXJ2aWV3UnVsZXJBZGRlZEZvcmVncm91bmQsIG92ZXJ2aWV3UnVsZXJEZWxldGVkRm9yZWdyb3VuZCwgb3ZlcnZpZXdSdWxlck1vZGlmaWVkRm9yZWdyb3VuZCB9IGZyb20gJy4uL2NvbW1vbi9xdWlja0RpZmYuanMnO1xuaW1wb3J0IHsgUXVpY2tEaWZmTW9kZWwsIElRdWlja0RpZmZNb2RlbFNlcnZpY2UgfSBmcm9tICcuL3F1aWNrRGlmZk1vZGVsLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGF1dG9ydW4sIGF1dG9ydW5XaXRoU3RvcmUsIElPYnNlcnZhYmxlLCBvYnNlcnZhYmxlRnJvbUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuXG5leHBvcnQgY29uc3QgcXVpY2tEaWZmRGVjb3JhdGlvbkNvdW50ID0gbmV3IFJhd0NvbnRleHRLZXk8bnVtYmVyPigncXVpY2tEaWZmRGVjb3JhdGlvbkNvdW50JywgMCk7XG5cbmNsYXNzIFF1aWNrRGlmZkRlY29yYXRvciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHN0YXRpYyBjcmVhdGVEZWNvcmF0aW9uKGNsYXNzTmFtZTogc3RyaW5nLCB0b29sdGlwOiBzdHJpbmcgfCBudWxsLCBvcHRpb25zOiB7IGd1dHRlcjogYm9vbGVhbjsgb3ZlcnZpZXc6IHsgYWN0aXZlOiBib29sZWFuOyBjb2xvcjogc3RyaW5nIH07IG1pbmltYXA6IHsgYWN0aXZlOiBib29sZWFuOyBjb2xvcjogc3RyaW5nIH07IGlzV2hvbGVMaW5lOiBib29sZWFuIH0pOiBNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblx0XHRjb25zdCBkZWNvcmF0aW9uT3B0aW9uczogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgPSB7XG5cdFx0XHRkZXNjcmlwdGlvbjogJ2RpcnR5LWRpZmYtZGVjb3JhdGlvbicsXG5cdFx0XHRpc1dob2xlTGluZTogb3B0aW9ucy5pc1dob2xlTGluZSxcblx0XHR9O1xuXG5cdFx0aWYgKG9wdGlvbnMuZ3V0dGVyKSB7XG5cdFx0XHRkZWNvcmF0aW9uT3B0aW9ucy5saW5lc0RlY29yYXRpb25zQ2xhc3NOYW1lID0gYGRpcnR5LWRpZmYtZ2x5cGggJHtjbGFzc05hbWV9YDtcblx0XHRcdGRlY29yYXRpb25PcHRpb25zLmxpbmVzRGVjb3JhdGlvbnNUb29sdGlwID0gdG9vbHRpcDtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5vdmVydmlldy5hY3RpdmUpIHtcblx0XHRcdGRlY29yYXRpb25PcHRpb25zLm92ZXJ2aWV3UnVsZXIgPSB7XG5cdFx0XHRcdGNvbG9yOiB0aGVtZUNvbG9yRnJvbUlkKG9wdGlvbnMub3ZlcnZpZXcuY29sb3IpLFxuXHRcdFx0XHRwb3NpdGlvbjogT3ZlcnZpZXdSdWxlckxhbmUuTGVmdFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5taW5pbWFwLmFjdGl2ZSkge1xuXHRcdFx0ZGVjb3JhdGlvbk9wdGlvbnMubWluaW1hcCA9IHtcblx0XHRcdFx0Y29sb3I6IHRoZW1lQ29sb3JGcm9tSWQob3B0aW9ucy5taW5pbWFwLmNvbG9yKSxcblx0XHRcdFx0cG9zaXRpb246IE1pbmltYXBQb3NpdGlvbi5HdXR0ZXJcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMuY3JlYXRlRHluYW1pYyhkZWNvcmF0aW9uT3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIGFkZGVkT3B0aW9uczogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucztcblx0cHJpdmF0ZSBhZGRlZFBhdHRlcm5PcHRpb25zOiBNb2RlbERlY29yYXRpb25PcHRpb25zO1xuXHRwcml2YXRlIG1vZGlmaWVkT3B0aW9uczogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucztcblx0cHJpdmF0ZSBtb2RpZmllZFBhdHRlcm5PcHRpb25zOiBNb2RlbERlY29yYXRpb25PcHRpb25zO1xuXHRwcml2YXRlIGRlbGV0ZWRPcHRpb25zOiBNb2RlbERlY29yYXRpb25PcHRpb25zO1xuXHRwcml2YXRlIGRlY29yYXRpb25zQ29sbGVjdGlvbjogSUVkaXRvckRlY29yYXRpb25zQ29sbGVjdGlvbiB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvZGVFZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcXVpY2tEaWZmTW9kZWxSZWY6IElSZWZlcmVuY2U8UXVpY2tEaWZmTW9kZWw+LFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oJ3NjbS5kaWZmRGVjb3JhdGlvbnMnKTtcblx0XHRjb25zdCBndXR0ZXIgPSBkZWNvcmF0aW9ucyA9PT0gJ2FsbCcgfHwgZGVjb3JhdGlvbnMgPT09ICdndXR0ZXInO1xuXHRcdGNvbnN0IG92ZXJ2aWV3ID0gZGVjb3JhdGlvbnMgPT09ICdhbGwnIHx8IGRlY29yYXRpb25zID09PSAnb3ZlcnZpZXcnO1xuXHRcdGNvbnN0IG1pbmltYXAgPSBkZWNvcmF0aW9ucyA9PT0gJ2FsbCcgfHwgZGVjb3JhdGlvbnMgPT09ICdtaW5pbWFwJztcblxuXHRcdGNvbnN0IGRpZmZBZGRlZCA9IG5scy5sb2NhbGl6ZSgnZGlmZkFkZGVkJywgJ0FkZGVkIGxpbmVzJyk7XG5cdFx0dGhpcy5hZGRlZE9wdGlvbnMgPSBRdWlja0RpZmZEZWNvcmF0b3IuY3JlYXRlRGVjb3JhdGlvbignZGlydHktZGlmZi1hZGRlZCcsIGRpZmZBZGRlZCwge1xuXHRcdFx0Z3V0dGVyLFxuXHRcdFx0b3ZlcnZpZXc6IHsgYWN0aXZlOiBvdmVydmlldywgY29sb3I6IG92ZXJ2aWV3UnVsZXJBZGRlZEZvcmVncm91bmQgfSxcblx0XHRcdG1pbmltYXA6IHsgYWN0aXZlOiBtaW5pbWFwLCBjb2xvcjogbWluaW1hcEd1dHRlckFkZGVkQmFja2dyb3VuZCB9LFxuXHRcdFx0aXNXaG9sZUxpbmU6IHRydWVcblx0XHR9KTtcblx0XHR0aGlzLmFkZGVkUGF0dGVybk9wdGlvbnMgPSBRdWlja0RpZmZEZWNvcmF0b3IuY3JlYXRlRGVjb3JhdGlvbignZGlydHktZGlmZi1hZGRlZC1wYXR0ZXJuJywgZGlmZkFkZGVkLCB7XG5cdFx0XHRndXR0ZXIsXG5cdFx0XHRvdmVydmlldzogeyBhY3RpdmU6IG92ZXJ2aWV3LCBjb2xvcjogb3ZlcnZpZXdSdWxlckFkZGVkRm9yZWdyb3VuZCB9LFxuXHRcdFx0bWluaW1hcDogeyBhY3RpdmU6IG1pbmltYXAsIGNvbG9yOiBtaW5pbWFwR3V0dGVyQWRkZWRCYWNrZ3JvdW5kIH0sXG5cdFx0XHRpc1dob2xlTGluZTogdHJ1ZVxuXHRcdH0pO1xuXHRcdGNvbnN0IGRpZmZNb2RpZmllZCA9IG5scy5sb2NhbGl6ZSgnZGlmZk1vZGlmaWVkJywgJ0NoYW5nZWQgbGluZXMnKTtcblx0XHR0aGlzLm1vZGlmaWVkT3B0aW9ucyA9IFF1aWNrRGlmZkRlY29yYXRvci5jcmVhdGVEZWNvcmF0aW9uKCdkaXJ0eS1kaWZmLW1vZGlmaWVkJywgZGlmZk1vZGlmaWVkLCB7XG5cdFx0XHRndXR0ZXIsXG5cdFx0XHRvdmVydmlldzogeyBhY3RpdmU6IG92ZXJ2aWV3LCBjb2xvcjogb3ZlcnZpZXdSdWxlck1vZGlmaWVkRm9yZWdyb3VuZCB9LFxuXHRcdFx0bWluaW1hcDogeyBhY3RpdmU6IG1pbmltYXAsIGNvbG9yOiBtaW5pbWFwR3V0dGVyTW9kaWZpZWRCYWNrZ3JvdW5kIH0sXG5cdFx0XHRpc1dob2xlTGluZTogdHJ1ZVxuXHRcdH0pO1xuXHRcdHRoaXMubW9kaWZpZWRQYXR0ZXJuT3B0aW9ucyA9IFF1aWNrRGlmZkRlY29yYXRvci5jcmVhdGVEZWNvcmF0aW9uKCdkaXJ0eS1kaWZmLW1vZGlmaWVkLXBhdHRlcm4nLCBkaWZmTW9kaWZpZWQsIHtcblx0XHRcdGd1dHRlcixcblx0XHRcdG92ZXJ2aWV3OiB7IGFjdGl2ZTogb3ZlcnZpZXcsIGNvbG9yOiBvdmVydmlld1J1bGVyTW9kaWZpZWRGb3JlZ3JvdW5kIH0sXG5cdFx0XHRtaW5pbWFwOiB7IGFjdGl2ZTogbWluaW1hcCwgY29sb3I6IG1pbmltYXBHdXR0ZXJNb2RpZmllZEJhY2tncm91bmQgfSxcblx0XHRcdGlzV2hvbGVMaW5lOiB0cnVlXG5cdFx0fSk7XG5cdFx0dGhpcy5kZWxldGVkT3B0aW9ucyA9IFF1aWNrRGlmZkRlY29yYXRvci5jcmVhdGVEZWNvcmF0aW9uKCdkaXJ0eS1kaWZmLWRlbGV0ZWQnLCBubHMubG9jYWxpemUoJ2RpZmZEZWxldGVkJywgJ1JlbW92ZWQgbGluZXMnKSwge1xuXHRcdFx0Z3V0dGVyLFxuXHRcdFx0b3ZlcnZpZXc6IHsgYWN0aXZlOiBvdmVydmlldywgY29sb3I6IG92ZXJ2aWV3UnVsZXJEZWxldGVkRm9yZWdyb3VuZCB9LFxuXHRcdFx0bWluaW1hcDogeyBhY3RpdmU6IG1pbmltYXAsIGNvbG9yOiBtaW5pbWFwR3V0dGVyRGVsZXRlZEJhY2tncm91bmQgfSxcblx0XHRcdGlzV2hvbGVMaW5lOiBmYWxzZVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3NjbS5kaWZmRGVjb3JhdGlvbnNHdXR0ZXJQYXR0ZXJuJykpIHtcblx0XHRcdFx0dGhpcy5vbkRpZENoYW5nZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LnJ1bkFuZFN1YnNjcmliZSh0aGlzLnF1aWNrRGlmZk1vZGVsUmVmLm9iamVjdC5vbkRpZENoYW5nZSwgKCkgPT4gdGhpcy5vbkRpZENoYW5nZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5jb2RlRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB2aXNpYmxlUXVpY2tEaWZmcyA9IHRoaXMucXVpY2tEaWZmTW9kZWxSZWYub2JqZWN0LnF1aWNrRGlmZnMuZmlsdGVyKHF1aWNrRGlmZiA9PiBxdWlja0RpZmYudmlzaWJsZSk7XG5cdFx0Y29uc3QgcGF0dGVybiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8eyBhZGRlZDogYm9vbGVhbjsgbW9kaWZpZWQ6IGJvb2xlYW4gfT4oJ3NjbS5kaWZmRGVjb3JhdGlvbnNHdXR0ZXJQYXR0ZXJuJyk7XG5cblx0XHRjb25zdCBkZWNvcmF0aW9ucyA9IHRoaXMucXVpY2tEaWZmTW9kZWxSZWYub2JqZWN0LmNoYW5nZXNcblx0XHRcdC5maWx0ZXIobGFiZWxlZENoYW5nZSA9PiB2aXNpYmxlUXVpY2tEaWZmcy5zb21lKHF1aWNrRGlmZiA9PiBxdWlja0RpZmYubGFiZWwgPT09IGxhYmVsZWRDaGFuZ2UubGFiZWwpKVxuXHRcdFx0Lm1hcCgobGFiZWxlZENoYW5nZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBjaGFuZ2UgPSBsYWJlbGVkQ2hhbmdlLmNoYW5nZTtcblx0XHRcdFx0Y29uc3QgY2hhbmdlVHlwZSA9IGdldENoYW5nZVR5cGUoY2hhbmdlKTtcblx0XHRcdFx0Y29uc3Qgc3RhcnRMaW5lTnVtYmVyID0gY2hhbmdlLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyO1xuXHRcdFx0XHRjb25zdCBlbmRMaW5lTnVtYmVyID0gY2hhbmdlLm1vZGlmaWVkRW5kTGluZU51bWJlciB8fCBzdGFydExpbmVOdW1iZXI7XG5cblx0XHRcdFx0c3dpdGNoIChjaGFuZ2VUeXBlKSB7XG5cdFx0XHRcdFx0Y2FzZSBDaGFuZ2VUeXBlLkFkZDpcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHJhbmdlOiB7XG5cdFx0XHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbjogMVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiBwYXR0ZXJuLmFkZGVkID8gdGhpcy5hZGRlZFBhdHRlcm5PcHRpb25zIDogdGhpcy5hZGRlZE9wdGlvbnNcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y2FzZSBDaGFuZ2VUeXBlLkRlbGV0ZTpcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHJhbmdlOiB7XG5cdFx0XHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiBOdW1iZXIuTUFYX1ZBTFVFLFxuXHRcdFx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHN0YXJ0TGluZU51bWJlciwgZW5kQ29sdW1uOiBOdW1iZXIuTUFYX1ZBTFVFXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHRoaXMuZGVsZXRlZE9wdGlvbnNcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y2FzZSBDaGFuZ2VUeXBlLk1vZGlmeTpcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdHJhbmdlOiB7XG5cdFx0XHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbjogMVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiBwYXR0ZXJuLm1vZGlmaWVkID8gdGhpcy5tb2RpZmllZFBhdHRlcm5PcHRpb25zIDogdGhpcy5tb2RpZmllZE9wdGlvbnNcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0aWYgKCF0aGlzLmRlY29yYXRpb25zQ29sbGVjdGlvbikge1xuXHRcdFx0dGhpcy5kZWNvcmF0aW9uc0NvbGxlY3Rpb24gPSB0aGlzLmNvZGVFZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKGRlY29yYXRpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kZWNvcmF0aW9uc0NvbGxlY3Rpb24uc2V0KGRlY29yYXRpb25zKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmRlY29yYXRpb25zQ29sbGVjdGlvbikge1xuXHRcdFx0dGhpcy5kZWNvcmF0aW9uc0NvbGxlY3Rpb24uY2xlYXIoKTtcblx0XHR9XG5cdFx0dGhpcy5kZWNvcmF0aW9uc0NvbGxlY3Rpb24gPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5xdWlja0RpZmZNb2RlbFJlZi5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmludGVyZmFjZSBRdWlja0RpZmZXb3JrYmVuY2hDb250cm9sbGVyVmlld1N0YXRlIHtcblx0cmVhZG9ubHkgd2lkdGg6IG51bWJlcjtcblx0cmVhZG9ubHkgdmlzaWJpbGl0eTogJ2Fsd2F5cycgfCAnaG92ZXInO1xufVxuXG5leHBvcnQgY2xhc3MgUXVpY2tEaWZmV29ya2JlbmNoQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRwcml2YXRlIGVuYWJsZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSByZWFkb25seSBxdWlja0RpZmZEZWNvcmF0aW9uQ291bnQ6IElDb250ZXh0S2V5PG51bWJlcj47XG5cblx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmVFZGl0b3I6IElPYnNlcnZhYmxlPEVkaXRvcklucHV0IHwgdW5kZWZpbmVkPjtcblxuXHQvLyBSZXNvdXJjZSBVUkkgLT4gQ29kZSBFZGl0b3IgSWQgLT4gRGVjb3JhdGlvbiAoRGlzcG9zYWJsZSlcblx0cHJpdmF0ZSByZWFkb25seSBkZWNvcmF0b3JzID0gbmV3IFJlc291cmNlTWFwPERpc3Bvc2FibGVNYXA8c3RyaW5nPj4oKTtcblx0cHJpdmF0ZSB2aWV3U3RhdGU6IFF1aWNrRGlmZldvcmtiZW5jaENvbnRyb2xsZXJWaWV3U3RhdGUgPSB7IHdpZHRoOiAzLCB2aXNpYmlsaXR5OiAnYWx3YXlzJyB9O1xuXHRwcml2YXRlIHJlYWRvbmx5IHRyYW5zaWVudERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBzdHlsZXNoZWV0OiBIVE1MU3R5bGVFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJUXVpY2tEaWZmTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tEaWZmTW9kZWxTZXJ2aWNlOiBJUXVpY2tEaWZmTW9kZWxTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnN0eWxlc2hlZXQgPSBkb21TdHlsZXNoZWV0c0pzLmNyZWF0ZVN0eWxlU2hlZXQodW5kZWZpbmVkLCB1bmRlZmluZWQsIHRoaXMuX3N0b3JlKTtcblxuXHRcdHRoaXMucXVpY2tEaWZmRGVjb3JhdGlvbkNvdW50ID0gcXVpY2tEaWZmRGVjb3JhdGlvbkNvdW50LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLmFjdGl2ZUVkaXRvciA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcyxcblx0XHRcdHRoaXMuZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSwgKCkgPT4gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcik7XG5cblx0XHRjb25zdCBvbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24gPSBFdmVudC5maWx0ZXIoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3NjbS5kaWZmRGVjb3JhdGlvbnMnKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKHRoaXMub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCB0aGlzKSk7XG5cdFx0dGhpcy5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oKTtcblxuXHRcdGNvbnN0IG9uRGlkQ2hhbmdlRGlmZldpZHRoQ29uZmlndXJhdGlvbiA9IEV2ZW50LmZpbHRlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2NtLmRpZmZEZWNvcmF0aW9uc0d1dHRlcldpZHRoJykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG9uRGlkQ2hhbmdlRGlmZldpZHRoQ29uZmlndXJhdGlvbih0aGlzLm9uRGlkQ2hhbmdlRGlmZldpZHRoQ29uZmlndXJhdGlvbiwgdGhpcykpO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VEaWZmV2lkdGhDb25maWd1cmF0aW9uKCk7XG5cblx0XHRjb25zdCBvbkRpZENoYW5nZURpZmZWaXNpYmlsaXR5Q29uZmlndXJhdGlvbiA9IEV2ZW50LmZpbHRlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2NtLmRpZmZEZWNvcmF0aW9uc0d1dHRlclZpc2liaWxpdHknKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob25EaWRDaGFuZ2VEaWZmVmlzaWJpbGl0eUNvbmZpZ3VyYXRpb24odGhpcy5vbkRpZENoYW5nZURpZmZWaXNpYmlsaXR5Q29uZmlndXJhdGlvbiwgdGhpcykpO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VEaWZmVmlzaWJpbGl0eUNvbmZpZ3VyYXRpb24oKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IGVuYWJsZWQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oJ3NjbS5kaWZmRGVjb3JhdGlvbnMnKSAhPT0gJ25vbmUnO1xuXG5cdFx0aWYgKGVuYWJsZWQpIHtcblx0XHRcdHRoaXMuZW5hYmxlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZGlzYWJsZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VEaWZmV2lkdGhDb25maWd1cmF0aW9uKCk6IHZvaWQge1xuXHRcdGxldCB3aWR0aCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignc2NtLmRpZmZEZWNvcmF0aW9uc0d1dHRlcldpZHRoJyk7XG5cblx0XHRpZiAoaXNOYU4od2lkdGgpIHx8IHdpZHRoIDw9IDAgfHwgd2lkdGggPiA1KSB7XG5cdFx0XHR3aWR0aCA9IDM7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZXRWaWV3U3RhdGUoeyAuLi50aGlzLnZpZXdTdGF0ZSwgd2lkdGggfSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRGlmZlZpc2liaWxpdHlDb25maWd1cmF0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHZpc2liaWxpdHkgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdhbHdheXMnIHwgJ2hvdmVyJz4oJ3NjbS5kaWZmRGVjb3JhdGlvbnNHdXR0ZXJWaXNpYmlsaXR5Jyk7XG5cdFx0dGhpcy5zZXRWaWV3U3RhdGUoeyAuLi50aGlzLnZpZXdTdGF0ZSwgdmlzaWJpbGl0eSB9KTtcblx0fVxuXG5cdHByaXZhdGUgc2V0Vmlld1N0YXRlKHN0YXRlOiBRdWlja0RpZmZXb3JrYmVuY2hDb250cm9sbGVyVmlld1N0YXRlKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3U3RhdGUgPSBzdGF0ZTtcblx0XHR0aGlzLnN0eWxlc2hlZXQudGV4dENvbnRlbnQgPSBgXG5cdFx0XHQubW9uYWNvLWVkaXRvciAuZGlydHktZGlmZi1hZGRlZCxcblx0XHRcdC5tb25hY28tZWRpdG9yIC5kaXJ0eS1kaWZmLW1vZGlmaWVkIHtcblx0XHRcdFx0Ym9yZGVyLWxlZnQtd2lkdGg6JHtzdGF0ZS53aWR0aH1weDtcblx0XHRcdH1cblx0XHRcdC5tb25hY28tZWRpdG9yIC5kaXJ0eS1kaWZmLWFkZGVkLXBhdHRlcm4sXG5cdFx0XHQubW9uYWNvLWVkaXRvciAuZGlydHktZGlmZi1hZGRlZC1wYXR0ZXJuOmJlZm9yZSxcblx0XHRcdC5tb25hY28tZWRpdG9yIC5kaXJ0eS1kaWZmLW1vZGlmaWVkLXBhdHRlcm4sXG5cdFx0XHQubW9uYWNvLWVkaXRvciAuZGlydHktZGlmZi1tb2RpZmllZC1wYXR0ZXJuOmJlZm9yZSB7XG5cdFx0XHRcdGJhY2tncm91bmQtc2l6ZTogJHtzdGF0ZS53aWR0aH1weCAke3N0YXRlLndpZHRofXB4O1xuXHRcdFx0fVxuXHRcdFx0Lm1vbmFjby1lZGl0b3IgLmRpcnR5LWRpZmYtYWRkZWQsXG5cdFx0XHQubW9uYWNvLWVkaXRvciAuZGlydHktZGlmZi1hZGRlZC1wYXR0ZXJuLFxuXHRcdFx0Lm1vbmFjby1lZGl0b3IgLmRpcnR5LWRpZmYtbW9kaWZpZWQsXG5cdFx0XHQubW9uYWNvLWVkaXRvciAuZGlydHktZGlmZi1tb2RpZmllZC1wYXR0ZXJuLFxuXHRcdFx0Lm1vbmFjby1lZGl0b3IgLmRpcnR5LWRpZmYtZGVsZXRlZCB7XG5cdFx0XHRcdG9wYWNpdHk6ICR7c3RhdGUudmlzaWJpbGl0eSA9PT0gJ2Fsd2F5cycgPyAxIDogMH07XG5cdFx0XHR9XG5cdFx0YDtcblx0fVxuXG5cdHByaXZhdGUgZW5hYmxlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVuYWJsZWQpIHtcblx0XHRcdHRoaXMuZGlzYWJsZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMudHJhbnNpZW50RGlzcG9zYWJsZXMuYWRkKEV2ZW50LmFueSh0aGlzLmVkaXRvclNlcnZpY2Uub25EaWRDbG9zZUVkaXRvciwgdGhpcy5lZGl0b3JTZXJ2aWNlLm9uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UpKCgpID0+IHRoaXMub25FZGl0b3JzQ2hhbmdlZCgpKSk7XG5cdFx0dGhpcy5vbkVkaXRvcnNDaGFuZ2VkKCk7XG5cblx0XHR0aGlzLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCk7XG5cblx0XHR0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBkaXNhYmxlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5lbmFibGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy50cmFuc2llbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMucXVpY2tEaWZmRGVjb3JhdGlvbkNvdW50LnNldCgwKTtcblxuXHRcdGZvciAoY29uc3QgW3VyaSwgZGVjb3JhdG9yTWFwXSBvZiB0aGlzLmRlY29yYXRvcnMuZW50cmllcygpKSB7XG5cdFx0XHRkZWNvcmF0b3JNYXAuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5kZWNvcmF0b3JzLmRlbGV0ZSh1cmkpO1xuXHRcdH1cblxuXHRcdHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgpOiB2b2lkIHtcblx0XHR0aGlzLnRyYW5zaWVudERpc3Bvc2FibGVzLmFkZChhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSB0aGlzLmFjdGl2ZUVkaXRvci5yZWFkKHJlYWRlcik7XG5cdFx0XHRjb25zdCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCA9IHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbDtcblxuXHRcdFx0aWYgKCFpc0NvZGVFZGl0b3IoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpIHx8ICFhY3RpdmVFZGl0b3I/LnJlc291cmNlKSB7XG5cdFx0XHRcdHRoaXMucXVpY2tEaWZmRGVjb3JhdGlvbkNvdW50LnNldCgwKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBxdWlja0RpZmZNb2RlbFJlZiA9IHRoaXMucXVpY2tEaWZmTW9kZWxTZXJ2aWNlLmNyZWF0ZVF1aWNrRGlmZk1vZGVsUmVmZXJlbmNlKGFjdGl2ZUVkaXRvci5yZXNvdXJjZSk7XG5cdFx0XHRpZiAoIXF1aWNrRGlmZk1vZGVsUmVmKSB7XG5cdFx0XHRcdHRoaXMucXVpY2tEaWZmRGVjb3JhdGlvbkNvdW50LnNldCgwKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzdG9yZS5hZGQocXVpY2tEaWZmTW9kZWxSZWYpO1xuXG5cdFx0XHRjb25zdCB2aXNpYmxlRGVjb3JhdGlvbkNvdW50ID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLFxuXHRcdFx0XHRxdWlja0RpZmZNb2RlbFJlZi5vYmplY3Qub25EaWRDaGFuZ2UsICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCB2aXNpYmxlUXVpY2tEaWZmcyA9IHF1aWNrRGlmZk1vZGVsUmVmLm9iamVjdC5xdWlja0RpZmZzLmZpbHRlcihxdWlja0RpZmYgPT4gcXVpY2tEaWZmLnZpc2libGUpO1xuXHRcdFx0XHRcdHJldHVybiBxdWlja0RpZmZNb2RlbFJlZi5vYmplY3QuY2hhbmdlcy5maWx0ZXIobGFiZWxlZENoYW5nZSA9PiB2aXNpYmxlUXVpY2tEaWZmcy5zb21lKHF1aWNrRGlmZiA9PiBxdWlja0RpZmYubGFiZWwgPT09IGxhYmVsZWRDaGFuZ2UubGFiZWwpKS5sZW5ndGg7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRzdG9yZS5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRjb25zdCBjb3VudCA9IHZpc2libGVEZWNvcmF0aW9uQ291bnQucmVhZChyZWFkZXIpO1xuXHRcdFx0XHR0aGlzLnF1aWNrRGlmZkRlY29yYXRpb25Db3VudC5zZXQoY291bnQpO1xuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgb25FZGl0b3JzQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiB0aGlzLmVkaXRvclNlcnZpY2UudmlzaWJsZVRleHRFZGl0b3JDb250cm9scykge1xuXHRcdFx0aWYgKCFpc0NvZGVFZGl0b3IoZWRpdG9yKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAoIXRleHRNb2RlbCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZWRpdG9ySWQgPSBlZGl0b3IuZ2V0SWQoKTtcblx0XHRcdGlmICh0aGlzLmRlY29yYXRvcnMuZ2V0KHRleHRNb2RlbC51cmkpPy5oYXMoZWRpdG9ySWQpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBxdWlja0RpZmZNb2RlbFJlZiA9IHRoaXMucXVpY2tEaWZmTW9kZWxTZXJ2aWNlLmNyZWF0ZVF1aWNrRGlmZk1vZGVsUmVmZXJlbmNlKHRleHRNb2RlbC51cmkpO1xuXHRcdFx0aWYgKCFxdWlja0RpZmZNb2RlbFJlZikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLmRlY29yYXRvcnMuaGFzKHRleHRNb2RlbC51cmkpKSB7XG5cdFx0XHRcdHRoaXMuZGVjb3JhdG9ycy5zZXQodGV4dE1vZGVsLnVyaSwgbmV3IERpc3Bvc2FibGVNYXA8c3RyaW5nPigpKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5kZWNvcmF0b3JzLmdldCh0ZXh0TW9kZWwudXJpKSEuc2V0KGVkaXRvcklkLCBuZXcgUXVpY2tEaWZmRGVjb3JhdG9yKGVkaXRvciwgcXVpY2tEaWZmTW9kZWxSZWYsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblx0XHR9XG5cblx0XHQvLyBEaXNwb3NlIGRlY29yYXRvcnMgZm9yIGVkaXRvcnMgdGhhdCBhcmUgbm8gbG9uZ2VyIHZpc2libGUuXG5cdFx0Zm9yIChjb25zdCBbdXJpLCBkZWNvcmF0b3JNYXBdIG9mIHRoaXMuZGVjb3JhdG9ycy5lbnRyaWVzKCkpIHtcblx0XHRcdGZvciAoY29uc3QgZWRpdG9ySWQgb2YgZGVjb3JhdG9yTWFwLmtleXMoKSkge1xuXHRcdFx0XHRjb25zdCBjb2RlRWRpdG9yID0gdGhpcy5lZGl0b3JTZXJ2aWNlLnZpc2libGVUZXh0RWRpdG9yQ29udHJvbHNcblx0XHRcdFx0XHQuZmluZChlZGl0b3IgPT4gaXNDb2RlRWRpdG9yKGVkaXRvcikgJiYgZWRpdG9yLmdldElkKCkgPT09IGVkaXRvcklkICYmXG5cdFx0XHRcdFx0XHR0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChlZGl0b3IuZ2V0TW9kZWwoKT8udXJpLCB1cmkpKTtcblxuXHRcdFx0XHRpZiAoIWNvZGVFZGl0b3IpIHtcblx0XHRcdFx0XHRkZWNvcmF0b3JNYXAuZGVsZXRlQW5kRGlzcG9zZShlZGl0b3JJZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGRlY29yYXRvck1hcC5zaXplID09PSAwKSB7XG5cdFx0XHRcdGRlY29yYXRvck1hcC5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuZGVjb3JhdG9ycy5kZWxldGUodXJpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlzYWJsZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFFckIsT0FBTztBQUNQLFNBQVMsWUFBWSxpQkFBaUIscUJBQWlDO0FBQ3ZFLFNBQVMsYUFBYTtBQUN0QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFzQixvQkFBb0I7QUFFMUMsU0FBUyxtQkFBNEMsdUJBQXVCO0FBQzVFLFlBQVksc0JBQXNCO0FBQ2xDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsWUFBWSxlQUFlLDhCQUE4QixnQ0FBZ0MsaUNBQWlDLDhCQUE4QixnQ0FBZ0MsdUNBQXVDO0FBQ3hPLFNBQXlCLDhCQUE4QjtBQUV2RCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFzQixvQkFBb0IscUJBQXFCO0FBQy9ELFNBQVMsU0FBUyxrQkFBK0IsMkJBQTJCO0FBR3JFLE1BQU0sMkJBQTJCLElBQUksY0FBc0IsNEJBQTRCLENBQUM7QUFFL0YsSUFBTSxxQkFBTixjQUFpQyxXQUFXO0FBQUEsRUFxQzNDLFlBQ2tCLFlBQ0EsbUJBQ3VCLHNCQUN2QztBQUNELFVBQU07QUFKVztBQUNBO0FBQ3VCO0FBSXhDLFVBQU0sY0FBYyxxQkFBcUIsU0FBaUIscUJBQXFCO0FBQy9FLFVBQU0sU0FBUyxnQkFBZ0IsU0FBUyxnQkFBZ0I7QUFDeEQsVUFBTSxXQUFXLGdCQUFnQixTQUFTLGdCQUFnQjtBQUMxRCxVQUFNLFVBQVUsZ0JBQWdCLFNBQVMsZ0JBQWdCO0FBRXpELFVBQU0sWUFBWSxJQUFJLFNBQVMsYUFBYSxhQUFhO0FBQ3pELFNBQUssZUFBZSxtQkFBbUIsaUJBQWlCLG9CQUFvQixXQUFXO0FBQUEsTUFDdEY7QUFBQSxNQUNBLFVBQVUsRUFBRSxRQUFRLFVBQVUsT0FBTyw2QkFBNkI7QUFBQSxNQUNsRSxTQUFTLEVBQUUsUUFBUSxTQUFTLE9BQU8sNkJBQTZCO0FBQUEsTUFDaEUsYUFBYTtBQUFBLElBQ2QsQ0FBQztBQUNELFNBQUssc0JBQXNCLG1CQUFtQixpQkFBaUIsNEJBQTRCLFdBQVc7QUFBQSxNQUNyRztBQUFBLE1BQ0EsVUFBVSxFQUFFLFFBQVEsVUFBVSxPQUFPLDZCQUE2QjtBQUFBLE1BQ2xFLFNBQVMsRUFBRSxRQUFRLFNBQVMsT0FBTyw2QkFBNkI7QUFBQSxNQUNoRSxhQUFhO0FBQUEsSUFDZCxDQUFDO0FBQ0QsVUFBTSxlQUFlLElBQUksU0FBUyxnQkFBZ0IsZUFBZTtBQUNqRSxTQUFLLGtCQUFrQixtQkFBbUIsaUJBQWlCLHVCQUF1QixjQUFjO0FBQUEsTUFDL0Y7QUFBQSxNQUNBLFVBQVUsRUFBRSxRQUFRLFVBQVUsT0FBTyxnQ0FBZ0M7QUFBQSxNQUNyRSxTQUFTLEVBQUUsUUFBUSxTQUFTLE9BQU8sZ0NBQWdDO0FBQUEsTUFDbkUsYUFBYTtBQUFBLElBQ2QsQ0FBQztBQUNELFNBQUsseUJBQXlCLG1CQUFtQixpQkFBaUIsK0JBQStCLGNBQWM7QUFBQSxNQUM5RztBQUFBLE1BQ0EsVUFBVSxFQUFFLFFBQVEsVUFBVSxPQUFPLGdDQUFnQztBQUFBLE1BQ3JFLFNBQVMsRUFBRSxRQUFRLFNBQVMsT0FBTyxnQ0FBZ0M7QUFBQSxNQUNuRSxhQUFhO0FBQUEsSUFDZCxDQUFDO0FBQ0QsU0FBSyxpQkFBaUIsbUJBQW1CLGlCQUFpQixzQkFBc0IsSUFBSSxTQUFTLGVBQWUsZUFBZSxHQUFHO0FBQUEsTUFDN0g7QUFBQSxNQUNBLFVBQVUsRUFBRSxRQUFRLFVBQVUsT0FBTywrQkFBK0I7QUFBQSxNQUNwRSxTQUFTLEVBQUUsUUFBUSxTQUFTLE9BQU8sK0JBQStCO0FBQUEsTUFDbEUsYUFBYTtBQUFBLElBQ2QsQ0FBQztBQUVELFNBQUssVUFBVSxxQkFBcUIseUJBQXlCLE9BQUs7QUFDakUsVUFBSSxFQUFFLHFCQUFxQixrQ0FBa0MsR0FBRztBQUMvRCxhQUFLLFlBQVk7QUFBQSxNQUNsQjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxVQUFVLE1BQU0sZ0JBQWdCLEtBQUssa0JBQWtCLE9BQU8sYUFBYSxNQUFNLEtBQUssWUFBWSxDQUFDLENBQUM7QUFBQSxFQUMxRztBQUFBLEVBdkZBLE9BQU8saUJBQWlCLFdBQW1CLFNBQXdCLFNBQXVLO0FBQ3pPLFVBQU0sb0JBQTZDO0FBQUEsTUFDbEQsYUFBYTtBQUFBLE1BQ2IsYUFBYSxRQUFRO0FBQUEsSUFDdEI7QUFFQSxRQUFJLFFBQVEsUUFBUTtBQUNuQix3QkFBa0IsNEJBQTRCLG9CQUFvQixTQUFTO0FBQzNFLHdCQUFrQiwwQkFBMEI7QUFBQSxJQUM3QztBQUVBLFFBQUksUUFBUSxTQUFTLFFBQVE7QUFDNUIsd0JBQWtCLGdCQUFnQjtBQUFBLFFBQ2pDLE9BQU8saUJBQWlCLFFBQVEsU0FBUyxLQUFLO0FBQUEsUUFDOUMsVUFBVSxrQkFBa0I7QUFBQSxNQUM3QjtBQUFBLElBQ0Q7QUFFQSxRQUFJLFFBQVEsUUFBUSxRQUFRO0FBQzNCLHdCQUFrQixVQUFVO0FBQUEsUUFDM0IsT0FBTyxpQkFBaUIsUUFBUSxRQUFRLEtBQUs7QUFBQSxRQUM3QyxVQUFVLGdCQUFnQjtBQUFBLE1BQzNCO0FBQUEsSUFDRDtBQUVBLFdBQU8sdUJBQXVCLGNBQWMsaUJBQWlCO0FBQUEsRUFDOUQ7QUFBQSxFQStEUSxjQUFvQjtBQUMzQixRQUFJLENBQUMsS0FBSyxXQUFXLFNBQVMsR0FBRztBQUNoQztBQUFBLElBQ0Q7QUFFQSxVQUFNLG9CQUFvQixLQUFLLGtCQUFrQixPQUFPLFdBQVcsT0FBTyxlQUFhLFVBQVUsT0FBTztBQUN4RyxVQUFNLFVBQVUsS0FBSyxxQkFBcUIsU0FBZ0Qsa0NBQWtDO0FBRTVILFVBQU0sY0FBYyxLQUFLLGtCQUFrQixPQUFPLFFBQ2hELE9BQU8sbUJBQWlCLGtCQUFrQixLQUFLLGVBQWEsVUFBVSxVQUFVLGNBQWMsS0FBSyxDQUFDLEVBQ3BHLElBQUksQ0FBQyxrQkFBa0I7QUFDdkIsWUFBTSxTQUFTLGNBQWM7QUFDN0IsWUFBTSxhQUFhLGNBQWMsTUFBTTtBQUN2QyxZQUFNLGtCQUFrQixPQUFPO0FBQy9CLFlBQU0sZ0JBQWdCLE9BQU8seUJBQXlCO0FBRXRELGNBQVEsWUFBWTtBQUFBLFFBQ25CLEtBQUssV0FBVztBQUNmLGlCQUFPO0FBQUEsWUFDTixPQUFPO0FBQUEsY0FDTjtBQUFBLGNBQWtDLGFBQWE7QUFBQSxjQUMvQztBQUFBLGNBQThCLFdBQVc7QUFBQSxZQUMxQztBQUFBLFlBQ0EsU0FBUyxRQUFRLFFBQVEsS0FBSyxzQkFBc0IsS0FBSztBQUFBLFVBQzFEO0FBQUEsUUFDRCxLQUFLLFdBQVc7QUFDZixpQkFBTztBQUFBLFlBQ04sT0FBTztBQUFBLGNBQ047QUFBQSxjQUFrQyxhQUFhLE9BQU87QUFBQSxjQUN0RCxlQUFlO0FBQUEsY0FBaUIsV0FBVyxPQUFPO0FBQUEsWUFDbkQ7QUFBQSxZQUNBLFNBQVMsS0FBSztBQUFBLFVBQ2Y7QUFBQSxRQUNELEtBQUssV0FBVztBQUNmLGlCQUFPO0FBQUEsWUFDTixPQUFPO0FBQUEsY0FDTjtBQUFBLGNBQWtDLGFBQWE7QUFBQSxjQUMvQztBQUFBLGNBQThCLFdBQVc7QUFBQSxZQUMxQztBQUFBLFlBQ0EsU0FBUyxRQUFRLFdBQVcsS0FBSyx5QkFBeUIsS0FBSztBQUFBLFVBQ2hFO0FBQUEsTUFDRjtBQUFBLElBQ0QsQ0FBQztBQUVGLFFBQUksQ0FBQyxLQUFLLHVCQUF1QjtBQUNoQyxXQUFLLHdCQUF3QixLQUFLLFdBQVcsNEJBQTRCLFdBQVc7QUFBQSxJQUNyRixPQUFPO0FBQ04sV0FBSyxzQkFBc0IsSUFBSSxXQUFXO0FBQUEsSUFDM0M7QUFBQSxFQUNEO0FBQUEsRUFFUyxVQUFnQjtBQUN4QixRQUFJLEtBQUssdUJBQXVCO0FBQy9CLFdBQUssc0JBQXNCLE1BQU07QUFBQSxJQUNsQztBQUNBLFNBQUssd0JBQXdCO0FBQzdCLFNBQUssa0JBQWtCLFFBQVE7QUFDL0IsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUNEO0FBdEpNLHFCQUFOO0FBQUEsRUF3Q0c7QUFBQSxHQXhDRztBQTZKQyxJQUFNLCtCQUFOLGNBQTJDLFdBQTZDO0FBQUEsRUFhOUYsWUFDa0MsZUFDTyxzQkFDQyx1QkFDSCxvQkFDbEIsbUJBQ25CO0FBQ0QsVUFBTTtBQU4yQjtBQUNPO0FBQ0M7QUFDSDtBQWZ2QyxTQUFRLFVBQVU7QUFNbEI7QUFBQSxTQUFpQixhQUFhLElBQUksWUFBbUM7QUFDckUsU0FBUSxZQUFtRCxFQUFFLE9BQU8sR0FBRyxZQUFZLFNBQVM7QUFDNUYsU0FBaUIsdUJBQXVCLEtBQUssVUFBVSxJQUFJLGdCQUFnQixDQUFDO0FBVzNFLFNBQUssYUFBYSxpQkFBaUIsaUJBQWlCLFFBQVcsUUFBVyxLQUFLLE1BQU07QUFFckYsU0FBSywyQkFBMkIseUJBQXlCLE9BQU8saUJBQWlCO0FBRWpGLFNBQUssZUFBZTtBQUFBLE1BQW9CO0FBQUEsTUFDdkMsS0FBSyxjQUFjO0FBQUEsTUFBeUIsTUFBTSxLQUFLLGNBQWM7QUFBQSxJQUFZO0FBRWxGLFVBQU0sMkJBQTJCLE1BQU0sT0FBTyxxQkFBcUIsMEJBQTBCLE9BQUssRUFBRSxxQkFBcUIscUJBQXFCLENBQUM7QUFDL0ksU0FBSyxVQUFVLHlCQUF5QixLQUFLLDBCQUEwQixJQUFJLENBQUM7QUFDNUUsU0FBSyx5QkFBeUI7QUFFOUIsVUFBTSxvQ0FBb0MsTUFBTSxPQUFPLHFCQUFxQiwwQkFBMEIsT0FBSyxFQUFFLHFCQUFxQixnQ0FBZ0MsQ0FBQztBQUNuSyxTQUFLLFVBQVUsa0NBQWtDLEtBQUssbUNBQW1DLElBQUksQ0FBQztBQUM5RixTQUFLLGtDQUFrQztBQUV2QyxVQUFNLHlDQUF5QyxNQUFNLE9BQU8scUJBQXFCLDBCQUEwQixPQUFLLEVBQUUscUJBQXFCLHFDQUFxQyxDQUFDO0FBQzdLLFNBQUssVUFBVSx1Q0FBdUMsS0FBSyx3Q0FBd0MsSUFBSSxDQUFDO0FBQ3hHLFNBQUssdUNBQXVDO0FBQUEsRUFDN0M7QUFBQSxFQUVRLDJCQUFpQztBQUN4QyxVQUFNLFVBQVUsS0FBSyxxQkFBcUIsU0FBaUIscUJBQXFCLE1BQU07QUFFdEYsUUFBSSxTQUFTO0FBQ1osV0FBSyxPQUFPO0FBQUEsSUFDYixPQUFPO0FBQ04sV0FBSyxRQUFRO0FBQUEsSUFDZDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLG9DQUEwQztBQUNqRCxRQUFJLFFBQVEsS0FBSyxxQkFBcUIsU0FBaUIsZ0NBQWdDO0FBRXZGLFFBQUksTUFBTSxLQUFLLEtBQUssU0FBUyxLQUFLLFFBQVEsR0FBRztBQUM1QyxjQUFRO0FBQUEsSUFDVDtBQUVBLFNBQUssYUFBYSxFQUFFLEdBQUcsS0FBSyxXQUFXLE1BQU0sQ0FBQztBQUFBLEVBQy9DO0FBQUEsRUFFUSx5Q0FBK0M7QUFDdEQsVUFBTSxhQUFhLEtBQUsscUJBQXFCLFNBQTZCLHFDQUFxQztBQUMvRyxTQUFLLGFBQWEsRUFBRSxHQUFHLEtBQUssV0FBVyxXQUFXLENBQUM7QUFBQSxFQUNwRDtBQUFBLEVBRVEsYUFBYSxPQUFvRDtBQUN4RSxTQUFLLFlBQVk7QUFDakIsU0FBSyxXQUFXLGNBQWM7QUFBQTtBQUFBO0FBQUEsd0JBR1IsTUFBTSxLQUFLO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQU1aLE1BQU0sS0FBSyxNQUFNLE1BQU0sS0FBSztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBT3BDLE1BQU0sZUFBZSxXQUFXLElBQUksQ0FBQztBQUFBO0FBQUE7QUFBQSxFQUduRDtBQUFBLEVBRVEsU0FBZTtBQUN0QixRQUFJLEtBQUssU0FBUztBQUNqQixXQUFLLFFBQVE7QUFBQSxJQUNkO0FBRUEsU0FBSyxxQkFBcUIsSUFBSSxNQUFNLElBQUksS0FBSyxjQUFjLGtCQUFrQixLQUFLLGNBQWMseUJBQXlCLEVBQUUsTUFBTSxLQUFLLGlCQUFpQixDQUFDLENBQUM7QUFDekosU0FBSyxpQkFBaUI7QUFFdEIsU0FBSyx3QkFBd0I7QUFFN0IsU0FBSyxVQUFVO0FBQUEsRUFDaEI7QUFBQSxFQUVRLFVBQWdCO0FBQ3ZCLFFBQUksQ0FBQyxLQUFLLFNBQVM7QUFDbEI7QUFBQSxJQUNEO0FBRUEsU0FBSyxxQkFBcUIsTUFBTTtBQUNoQyxTQUFLLHlCQUF5QixJQUFJLENBQUM7QUFFbkMsZUFBVyxDQUFDLEtBQUssWUFBWSxLQUFLLEtBQUssV0FBVyxRQUFRLEdBQUc7QUFDNUQsbUJBQWEsUUFBUTtBQUNyQixXQUFLLFdBQVcsT0FBTyxHQUFHO0FBQUEsSUFDM0I7QUFFQSxTQUFLLFVBQVU7QUFBQSxFQUNoQjtBQUFBLEVBRVEsMEJBQWdDO0FBQ3ZDLFNBQUsscUJBQXFCLElBQUksaUJBQWlCLENBQUMsUUFBUSxVQUFVO0FBQ2pFLFlBQU0sZUFBZSxLQUFLLGFBQWEsS0FBSyxNQUFNO0FBQ2xELFlBQU0sMEJBQTBCLEtBQUssY0FBYztBQUVuRCxVQUFJLENBQUMsYUFBYSx1QkFBdUIsS0FBSyxDQUFDLGNBQWMsVUFBVTtBQUN0RSxhQUFLLHlCQUF5QixJQUFJLENBQUM7QUFDbkM7QUFBQSxNQUNEO0FBRUEsWUFBTSxvQkFBb0IsS0FBSyxzQkFBc0IsOEJBQThCLGFBQWEsUUFBUTtBQUN4RyxVQUFJLENBQUMsbUJBQW1CO0FBQ3ZCLGFBQUsseUJBQXlCLElBQUksQ0FBQztBQUNuQztBQUFBLE1BQ0Q7QUFFQSxZQUFNLElBQUksaUJBQWlCO0FBRTNCLFlBQU0seUJBQXlCO0FBQUEsUUFBb0I7QUFBQSxRQUNsRCxrQkFBa0IsT0FBTztBQUFBLFFBQWEsTUFBTTtBQUMzQyxnQkFBTSxvQkFBb0Isa0JBQWtCLE9BQU8sV0FBVyxPQUFPLGVBQWEsVUFBVSxPQUFPO0FBQ25HLGlCQUFPLGtCQUFrQixPQUFPLFFBQVEsT0FBTyxtQkFBaUIsa0JBQWtCLEtBQUssZUFBYSxVQUFVLFVBQVUsY0FBYyxLQUFLLENBQUMsRUFBRTtBQUFBLFFBQy9JO0FBQUEsTUFBQztBQUVGLFlBQU0sSUFBSSxRQUFRLENBQUFBLFlBQVU7QUFDM0IsY0FBTSxRQUFRLHVCQUF1QixLQUFLQSxPQUFNO0FBQ2hELGFBQUsseUJBQXlCLElBQUksS0FBSztBQUFBLE1BQ3hDLENBQUMsQ0FBQztBQUFBLElBQ0gsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRVEsbUJBQXlCO0FBQ2hDLGVBQVcsVUFBVSxLQUFLLGNBQWMsMkJBQTJCO0FBQ2xFLFVBQUksQ0FBQyxhQUFhLE1BQU0sR0FBRztBQUMxQjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLFlBQVksT0FBTyxTQUFTO0FBQ2xDLFVBQUksQ0FBQyxXQUFXO0FBQ2Y7QUFBQSxNQUNEO0FBRUEsWUFBTSxXQUFXLE9BQU8sTUFBTTtBQUM5QixVQUFJLEtBQUssV0FBVyxJQUFJLFVBQVUsR0FBRyxHQUFHLElBQUksUUFBUSxHQUFHO0FBQ3REO0FBQUEsTUFDRDtBQUVBLFlBQU0sb0JBQW9CLEtBQUssc0JBQXNCLDhCQUE4QixVQUFVLEdBQUc7QUFDaEcsVUFBSSxDQUFDLG1CQUFtQjtBQUN2QjtBQUFBLE1BQ0Q7QUFFQSxVQUFJLENBQUMsS0FBSyxXQUFXLElBQUksVUFBVSxHQUFHLEdBQUc7QUFDeEMsYUFBSyxXQUFXLElBQUksVUFBVSxLQUFLLElBQUksY0FBc0IsQ0FBQztBQUFBLE1BQy9EO0FBRUEsV0FBSyxXQUFXLElBQUksVUFBVSxHQUFHLEVBQUcsSUFBSSxVQUFVLElBQUksbUJBQW1CLFFBQVEsbUJBQW1CLEtBQUssb0JBQW9CLENBQUM7QUFBQSxJQUMvSDtBQUdBLGVBQVcsQ0FBQyxLQUFLLFlBQVksS0FBSyxLQUFLLFdBQVcsUUFBUSxHQUFHO0FBQzVELGlCQUFXLFlBQVksYUFBYSxLQUFLLEdBQUc7QUFDM0MsY0FBTSxhQUFhLEtBQUssY0FBYywwQkFDcEMsS0FBSyxZQUFVLGFBQWEsTUFBTSxLQUFLLE9BQU8sTUFBTSxNQUFNLFlBQzFELEtBQUssbUJBQW1CLE9BQU8sUUFBUSxPQUFPLFNBQVMsR0FBRyxLQUFLLEdBQUcsQ0FBQztBQUVyRSxZQUFJLENBQUMsWUFBWTtBQUNoQix1QkFBYSxpQkFBaUIsUUFBUTtBQUFBLFFBQ3ZDO0FBQUEsTUFDRDtBQUVBLFVBQUksYUFBYSxTQUFTLEdBQUc7QUFDNUIscUJBQWEsUUFBUTtBQUNyQixhQUFLLFdBQVcsT0FBTyxHQUFHO0FBQUEsTUFDM0I7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRVMsVUFBZ0I7QUFDeEIsU0FBSyxRQUFRO0FBQ2IsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUNEO0FBeE1hLCtCQUFOO0FBQUEsRUFjSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWxCVTsiLAogICJuYW1lcyI6IFsicmVhZGVyIl0KfQo=
