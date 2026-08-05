import { createCancelablePromise, TimeoutTimer } from "../../../../base/common/async.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { EditorOption, ShowLightbulbIconMode } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { Selection } from "../../../common/core/selection.js";
import { CodeActionTriggerType } from "../../../common/languages.js";
import { CodeActionKind, CodeActionTriggerSource } from "../common/types.js";
import { getCodeActions } from "./codeAction.js";
const SUPPORTED_CODE_ACTIONS = new RawContextKey("supportedCodeAction", "");
const APPLY_FIX_ALL_COMMAND_ID = "_typescript.applyFixAllCodeAction";
class CodeActionOracle extends Disposable {
  constructor(_editor, _markerService, _signalChange, _delay = 250) {
    super();
    this._editor = _editor;
    this._markerService = _markerService;
    this._signalChange = _signalChange;
    this._delay = _delay;
    this._autoTriggerTimer = this._register(new TimeoutTimer());
    this._register(this._markerService.onMarkerChanged((e) => this._onMarkerChanges(e)));
    this._register(this._editor.onDidChangeCursorPosition(() => this._tryAutoTrigger()));
  }
  trigger(trigger) {
    const selection = this._getRangeOfSelectionUnlessWhitespaceEnclosed(trigger);
    this._signalChange(selection ? { trigger, selection } : void 0);
  }
  _onMarkerChanges(resources) {
    const model = this._editor.getModel();
    if (model && resources.some((resource) => isEqual(resource, model.uri))) {
      this._tryAutoTrigger();
    }
  }
  _tryAutoTrigger() {
    this._autoTriggerTimer.cancelAndSet(() => {
      this.trigger({ type: CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.Default });
    }, this._delay);
  }
  _getRangeOfSelectionUnlessWhitespaceEnclosed(trigger) {
    if (!this._editor.hasModel()) {
      return void 0;
    }
    const selection = this._editor.getSelection();
    if (trigger.type === CodeActionTriggerType.Invoke) {
      return selection;
    }
    const enabled = this._editor.getOption(EditorOption.lightbulb).enabled;
    if (enabled === ShowLightbulbIconMode.Off) {
      return void 0;
    } else if (enabled === ShowLightbulbIconMode.On) {
      return selection;
    } else if (enabled === ShowLightbulbIconMode.OnCode) {
      const isSelectionEmpty = selection.isEmpty();
      if (!isSelectionEmpty) {
        return selection;
      }
      const model = this._editor.getModel();
      const { lineNumber, column } = selection.getPosition();
      const line = model.getLineContent(lineNumber);
      if (line.length === 0) {
        return void 0;
      } else if (column === 1) {
        if (/\s/.test(line[0])) {
          return void 0;
        }
      } else if (column === model.getLineMaxColumn(lineNumber)) {
        if (/\s/.test(line[line.length - 1])) {
          return void 0;
        }
      } else {
        if (/\s/.test(line[column - 2]) && /\s/.test(line[column - 1])) {
          return void 0;
        }
      }
    }
    return selection;
  }
}
var CodeActionsState;
((CodeActionsState2) => {
  let Type;
  ((Type2) => {
    Type2[Type2["Empty"] = 0] = "Empty";
    Type2[Type2["Triggered"] = 1] = "Triggered";
  })(Type = CodeActionsState2.Type || (CodeActionsState2.Type = {}));
  CodeActionsState2.Empty = { type: 0 /* Empty */ };
  class Triggered {
    constructor(trigger, position, _cancellablePromise) {
      this.trigger = trigger;
      this.position = position;
      this._cancellablePromise = _cancellablePromise;
      this.type = 1 /* Triggered */;
      this.actions = _cancellablePromise.catch((e) => {
        if (isCancellationError(e)) {
          return emptyCodeActionSet;
        }
        throw e;
      });
    }
    cancel() {
      this._cancellablePromise.cancel();
    }
  }
  CodeActionsState2.Triggered = Triggered;
})(CodeActionsState || (CodeActionsState = {}));
const emptyCodeActionSet = Object.freeze({
  allActions: [],
  validActions: [],
  dispose: () => {
  },
  documentation: [],
  hasAutoFix: false,
  hasAIFix: false,
  allAIFixes: false
});
class CodeActionModel extends Disposable {
  constructor(_editor, _registry, _markerService, contextKeyService, _progressService, _configurationService) {
    super();
    this._editor = _editor;
    this._registry = _registry;
    this._markerService = _markerService;
    this._progressService = _progressService;
    this._configurationService = _configurationService;
    this._codeActionOracle = this._register(new MutableDisposable());
    this._state = CodeActionsState.Empty;
    this._onDidChangeState = this._register(new Emitter());
    this.onDidChangeState = this._onDidChangeState.event;
    this.codeActionsDisposable = this._register(new MutableDisposable());
    this._disposed = false;
    this._supportedCodeActions = SUPPORTED_CODE_ACTIONS.bindTo(contextKeyService);
    this._register(this._editor.onDidChangeModel(() => this._update()));
    this._register(this._editor.onDidChangeModelLanguage(() => this._update()));
    this._register(this._registry.onDidChange(() => this._update()));
    this._register(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.lightbulb)) {
        this._update();
      }
    }));
    this._update();
  }
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    super.dispose();
    this.setState(CodeActionsState.Empty, true);
  }
  _settingEnabledNearbyQuickfixes() {
    const model = this._editor?.getModel();
    return this._configurationService ? this._configurationService.getValue("editor.codeActionWidget.includeNearbyQuickFixes", { resource: model?.uri }) : false;
  }
  _update() {
    if (this._disposed) {
      return;
    }
    this._codeActionOracle.value = void 0;
    this.setState(CodeActionsState.Empty);
    const model = this._editor.getModel();
    if (model && this._registry.has(model) && !this._editor.getOption(EditorOption.readOnly)) {
      const supportedActions = this._registry.all(model).flatMap((provider) => provider.providedCodeActionKinds ?? []);
      this._supportedCodeActions.set(supportedActions.join(" "));
      this._codeActionOracle.value = new CodeActionOracle(this._editor, this._markerService, (trigger) => {
        if (!trigger) {
          this.setState(CodeActionsState.Empty);
          return;
        }
        const startPosition = trigger.selection.getStartPosition();
        const actions = createCancelablePromise(async (token) => {
          if (this._settingEnabledNearbyQuickfixes() && trigger.trigger.type === CodeActionTriggerType.Invoke && (trigger.trigger.triggerAction === CodeActionTriggerSource.QuickFix || trigger.trigger.filter?.include?.contains(CodeActionKind.QuickFix))) {
            const codeActionSet2 = await getCodeActions(this._registry, model, trigger.selection, trigger.trigger, Progress.None, token);
            const allCodeActions = [...codeActionSet2.allActions];
            if (token.isCancellationRequested) {
              codeActionSet2.dispose();
              return emptyCodeActionSet;
            }
            const foundQuickfix = codeActionSet2.validActions?.some((action) => action.action.kind ? CodeActionKind.QuickFix.contains(new HierarchicalKind(action.action.kind)) : false);
            const allMarkers = this._markerService.read({ resource: model.uri });
            if (foundQuickfix) {
              for (const action of codeActionSet2.validActions) {
                if (action.action.command?.arguments?.some((arg) => typeof arg === "string" && arg.includes(APPLY_FIX_ALL_COMMAND_ID))) {
                  action.action.diagnostics = [...allMarkers.filter((marker) => marker.relatedInformation)];
                }
              }
              return { validActions: codeActionSet2.validActions, allActions: allCodeActions, documentation: codeActionSet2.documentation, hasAutoFix: codeActionSet2.hasAutoFix, hasAIFix: codeActionSet2.hasAIFix, allAIFixes: codeActionSet2.allAIFixes, dispose: () => {
                this.codeActionsDisposable.value = codeActionSet2;
              } };
            } else if (!foundQuickfix) {
              if (allMarkers.length > 0) {
                const currPosition = trigger.selection.getPosition();
                let trackedPosition = currPosition;
                let distance = Number.MAX_VALUE;
                const currentActions = [...codeActionSet2.validActions];
                for (const marker of allMarkers) {
                  const col = marker.endColumn;
                  const row = marker.endLineNumber;
                  const startRow = marker.startLineNumber;
                  if (row === currPosition.lineNumber || startRow === currPosition.lineNumber) {
                    trackedPosition = new Position(row, col);
                    const newCodeActionTrigger = {
                      type: trigger.trigger.type,
                      triggerAction: trigger.trigger.triggerAction,
                      filter: { include: trigger.trigger.filter?.include ? trigger.trigger.filter?.include : CodeActionKind.QuickFix },
                      autoApply: trigger.trigger.autoApply,
                      context: { notAvailableMessage: trigger.trigger.context?.notAvailableMessage || "", position: trackedPosition }
                    };
                    const selectionAsPosition = new Selection(trackedPosition.lineNumber, trackedPosition.column, trackedPosition.lineNumber, trackedPosition.column);
                    const actionsAtMarker = await getCodeActions(this._registry, model, selectionAsPosition, newCodeActionTrigger, Progress.None, token);
                    if (token.isCancellationRequested) {
                      actionsAtMarker.dispose();
                      return emptyCodeActionSet;
                    }
                    if (actionsAtMarker.validActions.length !== 0) {
                      for (const action of actionsAtMarker.validActions) {
                        if (action.action.command?.arguments?.some((arg) => typeof arg === "string" && arg.includes(APPLY_FIX_ALL_COMMAND_ID))) {
                          action.action.diagnostics = [...allMarkers.filter((marker2) => marker2.relatedInformation)];
                        }
                      }
                      if (codeActionSet2.allActions.length === 0) {
                        allCodeActions.push(...actionsAtMarker.allActions);
                      }
                      if (Math.abs(currPosition.column - col) < distance) {
                        currentActions.unshift(...actionsAtMarker.validActions);
                      } else {
                        currentActions.push(...actionsAtMarker.validActions);
                      }
                    }
                    distance = Math.abs(currPosition.column - col);
                  }
                }
                const filteredActions = currentActions.filter((action, index, self) => self.findIndex((a) => a.action.title === action.action.title) === index);
                filteredActions.sort((a, b) => {
                  if (a.action.isPreferred && !b.action.isPreferred) {
                    return -1;
                  } else if (!a.action.isPreferred && b.action.isPreferred) {
                    return 1;
                  } else if (a.action.isAI && !b.action.isAI) {
                    return 1;
                  } else if (!a.action.isAI && b.action.isAI) {
                    return -1;
                  } else {
                    return 0;
                  }
                });
                return { validActions: filteredActions, allActions: allCodeActions, documentation: codeActionSet2.documentation, hasAutoFix: codeActionSet2.hasAutoFix, hasAIFix: codeActionSet2.hasAIFix, allAIFixes: codeActionSet2.allAIFixes, dispose: () => {
                  this.codeActionsDisposable.value = codeActionSet2;
                } };
              }
            }
          }
          if (trigger.trigger.type === CodeActionTriggerType.Invoke) {
            const codeActions = await getCodeActions(this._registry, model, trigger.selection, trigger.trigger, Progress.None, token);
            return codeActions;
          }
          const codeActionSet = await getCodeActions(this._registry, model, trigger.selection, trigger.trigger, Progress.None, token);
          this.codeActionsDisposable.value = codeActionSet;
          return codeActionSet;
        });
        if (trigger.trigger.type === CodeActionTriggerType.Invoke) {
          this._progressService?.showWhile(actions, 250);
        }
        const newState = new CodeActionsState.Triggered(trigger.trigger, startPosition, actions);
        let isManualToAutoTransition = false;
        if (this._state.type === 1 /* Triggered */) {
          isManualToAutoTransition = this._state.trigger.type === CodeActionTriggerType.Invoke && newState.type === 1 /* Triggered */ && newState.trigger.type === CodeActionTriggerType.Auto && this._state.position !== newState.position;
        }
        if (!isManualToAutoTransition) {
          this.setState(newState);
        } else {
          setTimeout(() => {
            this.setState(newState);
          }, 500);
        }
      }, void 0);
      this._codeActionOracle.value.trigger({ type: CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.Default });
    } else {
      this._supportedCodeActions.reset();
    }
  }
  trigger(trigger) {
    this._codeActionOracle.value?.trigger(trigger);
    this.codeActionsDisposable.clear();
  }
  setState(newState, skipNotify) {
    if (newState === this._state) {
      return;
    }
    if (this._state.type === 1 /* Triggered */) {
      this._state.cancel();
    }
    this._state = newState;
    if (!skipNotify && !this._disposed) {
      this._onDidChangeState.fire(newState);
    }
  }
}
export {
  APPLY_FIX_ALL_COMMAND_ID,
  CodeActionModel,
  CodeActionsState,
  SUPPORTED_CODE_ACTIONS
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2Jyb3dzZXIvY29kZUFjdGlvbk1vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBUaW1lb3V0VGltZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBIaWVyYXJjaGljYWxLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGllcmFyY2hpY2FsS2luZC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJTWFya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uLCBTaG93TGlnaHRidWxiSWNvbk1vZGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvblByb3ZpZGVyLCBDb2RlQWN0aW9uVHJpZ2dlclR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IENvZGVBY3Rpb25LaW5kLCBDb2RlQWN0aW9uU2V0LCBDb2RlQWN0aW9uVHJpZ2dlciwgQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UgfSBmcm9tICcuLi9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgZ2V0Q29kZUFjdGlvbnMgfSBmcm9tICcuL2NvZGVBY3Rpb24uanMnO1xuXG5leHBvcnQgY29uc3QgU1VQUE9SVEVEX0NPREVfQUNUSU9OUyA9IG5ldyBSYXdDb250ZXh0S2V5PHN0cmluZz4oJ3N1cHBvcnRlZENvZGVBY3Rpb24nLCAnJyk7XG5cbmV4cG9ydCBjb25zdCBBUFBMWV9GSVhfQUxMX0NPTU1BTkRfSUQgPSAnX3R5cGVzY3JpcHQuYXBwbHlGaXhBbGxDb2RlQWN0aW9uJztcblxudHlwZSBUcmlnZ2VyZWRDb2RlQWN0aW9uID0ge1xuXHRyZWFkb25seSBzZWxlY3Rpb246IFNlbGVjdGlvbjtcblx0cmVhZG9ubHkgdHJpZ2dlcjogQ29kZUFjdGlvblRyaWdnZXI7XG59O1xuXG5jbGFzcyBDb2RlQWN0aW9uT3JhY2xlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYXV0b1RyaWdnZXJUaW1lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUaW1lb3V0VGltZXIoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tYXJrZXJTZXJ2aWNlOiBJTWFya2VyU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zaWduYWxDaGFuZ2U6ICh0cmlnZ2VyZWQ6IFRyaWdnZXJlZENvZGVBY3Rpb24gfCB1bmRlZmluZWQpID0+IHZvaWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGVsYXk6IG51bWJlciA9IDI1MCxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9tYXJrZXJTZXJ2aWNlLm9uTWFya2VyQ2hhbmdlZChlID0+IHRoaXMuX29uTWFya2VyQ2hhbmdlcyhlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKCgpID0+IHRoaXMuX3RyeUF1dG9UcmlnZ2VyKCkpKTtcblx0fVxuXG5cdHB1YmxpYyB0cmlnZ2VyKHRyaWdnZXI6IENvZGVBY3Rpb25UcmlnZ2VyKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5fZ2V0UmFuZ2VPZlNlbGVjdGlvblVubGVzc1doaXRlc3BhY2VFbmNsb3NlZCh0cmlnZ2VyKTtcblx0XHR0aGlzLl9zaWduYWxDaGFuZ2Uoc2VsZWN0aW9uID8geyB0cmlnZ2VyLCBzZWxlY3Rpb24gfSA6IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbk1hcmtlckNoYW5nZXMocmVzb3VyY2VzOiByZWFkb25seSBVUklbXSk6IHZvaWQge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsICYmIHJlc291cmNlcy5zb21lKHJlc291cmNlID0+IGlzRXF1YWwocmVzb3VyY2UsIG1vZGVsLnVyaSkpKSB7XG5cdFx0XHR0aGlzLl90cnlBdXRvVHJpZ2dlcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3RyeUF1dG9UcmlnZ2VyKCkge1xuXHRcdHRoaXMuX2F1dG9UcmlnZ2VyVGltZXIuY2FuY2VsQW5kU2V0KCgpID0+IHtcblx0XHRcdHRoaXMudHJpZ2dlcih7IHR5cGU6IENvZGVBY3Rpb25UcmlnZ2VyVHlwZS5BdXRvLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5EZWZhdWx0IH0pO1xuXHRcdH0sIHRoaXMuX2RlbGF5KTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFJhbmdlT2ZTZWxlY3Rpb25Vbmxlc3NXaGl0ZXNwYWNlRW5jbG9zZWQodHJpZ2dlcjogQ29kZUFjdGlvblRyaWdnZXIpOiBTZWxlY3Rpb24gfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAodHJpZ2dlci50eXBlID09PSBDb2RlQWN0aW9uVHJpZ2dlclR5cGUuSW52b2tlKSB7XG5cdFx0XHRyZXR1cm4gc2VsZWN0aW9uO1xuXHRcdH1cblx0XHRjb25zdCBlbmFibGVkID0gdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGlnaHRidWxiKS5lbmFibGVkO1xuXHRcdGlmIChlbmFibGVkID09PSBTaG93TGlnaHRidWxiSWNvbk1vZGUuT2ZmKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAoZW5hYmxlZCA9PT0gU2hvd0xpZ2h0YnVsYkljb25Nb2RlLk9uKSB7XG5cdFx0XHRyZXR1cm4gc2VsZWN0aW9uO1xuXHRcdH0gZWxzZSBpZiAoZW5hYmxlZCA9PT0gU2hvd0xpZ2h0YnVsYkljb25Nb2RlLk9uQ29kZSkge1xuXHRcdFx0Y29uc3QgaXNTZWxlY3Rpb25FbXB0eSA9IHNlbGVjdGlvbi5pc0VtcHR5KCk7XG5cdFx0XHRpZiAoIWlzU2VsZWN0aW9uRW1wdHkpIHtcblx0XHRcdFx0cmV0dXJuIHNlbGVjdGlvbjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRjb25zdCB7IGxpbmVOdW1iZXIsIGNvbHVtbiB9ID0gc2VsZWN0aW9uLmdldFBvc2l0aW9uKCk7XG5cdFx0XHRjb25zdCBsaW5lID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZU51bWJlcik7XG5cdFx0XHRpZiAobGluZS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Ly8gZW1wdHkgbGluZVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIGlmIChjb2x1bW4gPT09IDEpIHtcblx0XHRcdFx0Ly8gbG9vayBvbmx5IHJpZ2h0XG5cdFx0XHRcdGlmICgvXFxzLy50ZXN0KGxpbmVbMF0pKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChjb2x1bW4gPT09IG1vZGVsLmdldExpbmVNYXhDb2x1bW4obGluZU51bWJlcikpIHtcblx0XHRcdFx0Ly8gbG9vayBvbmx5IGxlZnRcblx0XHRcdFx0aWYgKC9cXHMvLnRlc3QobGluZVtsaW5lLmxlbmd0aCAtIDFdKSkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGxvb2sgbGVmdCBhbmQgcmlnaHRcblx0XHRcdFx0aWYgKC9cXHMvLnRlc3QobGluZVtjb2x1bW4gLSAyXSkgJiYgL1xccy8udGVzdChsaW5lW2NvbHVtbiAtIDFdKSkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHNlbGVjdGlvbjtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIENvZGVBY3Rpb25zU3RhdGUge1xuXG5cdGV4cG9ydCBjb25zdCBlbnVtIFR5cGUgeyBFbXB0eSwgVHJpZ2dlcmVkIH1cblxuXHRleHBvcnQgY29uc3QgRW1wdHkgPSB7IHR5cGU6IFR5cGUuRW1wdHkgfSBhcyBjb25zdDtcblxuXHRleHBvcnQgY2xhc3MgVHJpZ2dlcmVkIHtcblx0XHRyZWFkb25seSB0eXBlID0gVHlwZS5UcmlnZ2VyZWQ7XG5cblx0XHRwdWJsaWMgcmVhZG9ubHkgYWN0aW9uczogUHJvbWlzZTxDb2RlQWN0aW9uU2V0PjtcblxuXHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0cHVibGljIHJlYWRvbmx5IHRyaWdnZXI6IENvZGVBY3Rpb25UcmlnZ2VyLFxuXHRcdFx0cHVibGljIHJlYWRvbmx5IHBvc2l0aW9uOiBQb3NpdGlvbixcblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgX2NhbmNlbGxhYmxlUHJvbWlzZTogQ2FuY2VsYWJsZVByb21pc2U8Q29kZUFjdGlvblNldD4sXG5cdFx0KSB7XG5cdFx0XHR0aGlzLmFjdGlvbnMgPSBfY2FuY2VsbGFibGVQcm9taXNlLmNhdGNoKChlKTogQ29kZUFjdGlvblNldCA9PiB7XG5cdFx0XHRcdGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVtcHR5Q29kZUFjdGlvblNldDtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHVibGljIGNhbmNlbCgpIHtcblx0XHRcdHRoaXMuX2NhbmNlbGxhYmxlUHJvbWlzZS5jYW5jZWwoKTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgdHlwZSBTdGF0ZSA9IHR5cGVvZiBFbXB0eSB8IFRyaWdnZXJlZDtcbn1cblxuY29uc3QgZW1wdHlDb2RlQWN0aW9uU2V0ID0gT2JqZWN0LmZyZWV6ZTxDb2RlQWN0aW9uU2V0Pih7XG5cdGFsbEFjdGlvbnM6IFtdLFxuXHR2YWxpZEFjdGlvbnM6IFtdLFxuXHRkaXNwb3NlOiAoKSA9PiB7IH0sXG5cdGRvY3VtZW50YXRpb246IFtdLFxuXHRoYXNBdXRvRml4OiBmYWxzZSxcblx0aGFzQUlGaXg6IGZhbHNlLFxuXHRhbGxBSUZpeGVzOiBmYWxzZSxcbn0pO1xuXG5cbmV4cG9ydCBjbGFzcyBDb2RlQWN0aW9uTW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb2RlQWN0aW9uT3JhY2xlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPENvZGVBY3Rpb25PcmFjbGU+KCkpO1xuXHRwcml2YXRlIF9zdGF0ZTogQ29kZUFjdGlvbnNTdGF0ZS5TdGF0ZSA9IENvZGVBY3Rpb25zU3RhdGUuRW1wdHk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3VwcG9ydGVkQ29kZUFjdGlvbnM6IElDb250ZXh0S2V5PHN0cmluZz47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdGF0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPENvZGVBY3Rpb25zU3RhdGUuU3RhdGU+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VTdGF0ZSA9IHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb2RlQWN0aW9uc0Rpc3Bvc2FibGU6IE11dGFibGVEaXNwb3NhYmxlPElEaXNwb3NhYmxlPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRwcml2YXRlIF9kaXNwb3NlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmVnaXN0cnk6IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5PENvZGVBY3Rpb25Qcm92aWRlcj4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsXG5cdFx0Y29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm9ncmVzc1NlcnZpY2U/OiBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlPzogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3N1cHBvcnRlZENvZGVBY3Rpb25zID0gU1VQUE9SVEVEX0NPREVfQUNUSU9OUy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoKCkgPT4gdGhpcy5fdXBkYXRlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbExhbmd1YWdlKCgpID0+IHRoaXMuX3VwZGF0ZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcmVnaXN0cnkub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5fdXBkYXRlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5saWdodGJ1bGIpKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl91cGRhdGUoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2Rpc3Bvc2VkID0gdHJ1ZTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLnNldFN0YXRlKENvZGVBY3Rpb25zU3RhdGUuRW1wdHksIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0dGluZ0VuYWJsZWROZWFyYnlRdWlja2ZpeGVzKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yPy5nZXRNb2RlbCgpO1xuXHRcdHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSA/IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3IuY29kZUFjdGlvbldpZGdldC5pbmNsdWRlTmVhcmJ5UXVpY2tGaXhlcycsIHsgcmVzb3VyY2U6IG1vZGVsPy51cmkgfSkgOiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jb2RlQWN0aW9uT3JhY2xlLnZhbHVlID0gdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5zZXRTdGF0ZShDb2RlQWN0aW9uc1N0YXRlLkVtcHR5KTtcblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKG1vZGVsXG5cdFx0XHQmJiB0aGlzLl9yZWdpc3RyeS5oYXMobW9kZWwpXG5cdFx0XHQmJiAhdGhpcy5fZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ucmVhZE9ubHkpXG5cdFx0KSB7XG5cdFx0XHRjb25zdCBzdXBwb3J0ZWRBY3Rpb25zOiBzdHJpbmdbXSA9IHRoaXMuX3JlZ2lzdHJ5LmFsbChtb2RlbCkuZmxhdE1hcChwcm92aWRlciA9PiBwcm92aWRlci5wcm92aWRlZENvZGVBY3Rpb25LaW5kcyA/PyBbXSk7XG5cdFx0XHR0aGlzLl9zdXBwb3J0ZWRDb2RlQWN0aW9ucy5zZXQoc3VwcG9ydGVkQWN0aW9ucy5qb2luKCcgJykpO1xuXG5cdFx0XHR0aGlzLl9jb2RlQWN0aW9uT3JhY2xlLnZhbHVlID0gbmV3IENvZGVBY3Rpb25PcmFjbGUodGhpcy5fZWRpdG9yLCB0aGlzLl9tYXJrZXJTZXJ2aWNlLCB0cmlnZ2VyID0+IHtcblx0XHRcdFx0aWYgKCF0cmlnZ2VyKSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRTdGF0ZShDb2RlQWN0aW9uc1N0YXRlLkVtcHR5KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzdGFydFBvc2l0aW9uID0gdHJpZ2dlci5zZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpO1xuXG5cdFx0XHRcdGNvbnN0IGFjdGlvbnMgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShhc3luYyB0b2tlbiA9PiB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX3NldHRpbmdFbmFibGVkTmVhcmJ5UXVpY2tmaXhlcygpICYmIHRyaWdnZXIudHJpZ2dlci50eXBlID09PSBDb2RlQWN0aW9uVHJpZ2dlclR5cGUuSW52b2tlICYmICh0cmlnZ2VyLnRyaWdnZXIudHJpZ2dlckFjdGlvbiA9PT0gQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UuUXVpY2tGaXggfHwgdHJpZ2dlci50cmlnZ2VyLmZpbHRlcj8uaW5jbHVkZT8uY29udGFpbnMoQ29kZUFjdGlvbktpbmQuUXVpY2tGaXgpKSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY29kZUFjdGlvblNldCA9IGF3YWl0IGdldENvZGVBY3Rpb25zKHRoaXMuX3JlZ2lzdHJ5LCBtb2RlbCwgdHJpZ2dlci5zZWxlY3Rpb24sIHRyaWdnZXIudHJpZ2dlciwgUHJvZ3Jlc3MuTm9uZSwgdG9rZW4pO1xuXHRcdFx0XHRcdFx0Y29uc3QgYWxsQ29kZUFjdGlvbnMgPSBbLi4uY29kZUFjdGlvblNldC5hbGxBY3Rpb25zXTtcblx0XHRcdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0XHRjb2RlQWN0aW9uU2V0LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGVtcHR5Q29kZUFjdGlvblNldDtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gU2VhcmNoIGZvciBxdWlja2ZpeGVzIGluIHRoZSBjdXJyZXQgY29kZSBhY3Rpb24gc2V0LlxuXHRcdFx0XHRcdFx0Y29uc3QgZm91bmRRdWlja2ZpeCA9IGNvZGVBY3Rpb25TZXQudmFsaWRBY3Rpb25zPy5zb21lKGFjdGlvbiA9PiBhY3Rpb24uYWN0aW9uLmtpbmQgPyBDb2RlQWN0aW9uS2luZC5RdWlja0ZpeC5jb250YWlucyhuZXcgSGllcmFyY2hpY2FsS2luZChhY3Rpb24uYWN0aW9uLmtpbmQpKSA6IGZhbHNlKTtcblx0XHRcdFx0XHRcdGNvbnN0IGFsbE1hcmtlcnMgPSB0aGlzLl9tYXJrZXJTZXJ2aWNlLnJlYWQoeyByZXNvdXJjZTogbW9kZWwudXJpIH0pO1xuXHRcdFx0XHRcdFx0aWYgKGZvdW5kUXVpY2tmaXgpIHtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgY29kZUFjdGlvblNldC52YWxpZEFjdGlvbnMpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYWN0aW9uLmFjdGlvbi5jb21tYW5kPy5hcmd1bWVudHM/LnNvbWUoYXJnID0+IHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnICYmIGFyZy5pbmNsdWRlcyhBUFBMWV9GSVhfQUxMX0NPTU1BTkRfSUQpKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0YWN0aW9uLmFjdGlvbi5kaWFnbm9zdGljcyA9IFsuLi5hbGxNYXJrZXJzLmZpbHRlcihtYXJrZXIgPT4gbWFya2VyLnJlbGF0ZWRJbmZvcm1hdGlvbildO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4geyB2YWxpZEFjdGlvbnM6IGNvZGVBY3Rpb25TZXQudmFsaWRBY3Rpb25zLCBhbGxBY3Rpb25zOiBhbGxDb2RlQWN0aW9ucywgZG9jdW1lbnRhdGlvbjogY29kZUFjdGlvblNldC5kb2N1bWVudGF0aW9uLCBoYXNBdXRvRml4OiBjb2RlQWN0aW9uU2V0Lmhhc0F1dG9GaXgsIGhhc0FJRml4OiBjb2RlQWN0aW9uU2V0Lmhhc0FJRml4LCBhbGxBSUZpeGVzOiBjb2RlQWN0aW9uU2V0LmFsbEFJRml4ZXMsIGRpc3Bvc2U6ICgpID0+IHsgdGhpcy5jb2RlQWN0aW9uc0Rpc3Bvc2FibGUudmFsdWUgPSBjb2RlQWN0aW9uU2V0OyB9IH07XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCFmb3VuZFF1aWNrZml4KSB7XG5cdFx0XHRcdFx0XHRcdC8vIElmIG1hcmtlcnMgZXhpc3QsIGFuZCB0aGVyZSBhcmUgbm8gcXVpY2tmaXhlcyBmb3VuZCBvciBsZW5ndGggaXMgemVybywgY2hlY2sgZm9yIHF1aWNrZml4ZXMgb24gdGhhdCBsaW5lLlxuXHRcdFx0XHRcdFx0XHRpZiAoYWxsTWFya2Vycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgY3VyclBvc2l0aW9uID0gdHJpZ2dlci5zZWxlY3Rpb24uZ2V0UG9zaXRpb24oKTtcblx0XHRcdFx0XHRcdFx0XHRsZXQgdHJhY2tlZFBvc2l0aW9uID0gY3VyclBvc2l0aW9uO1xuXHRcdFx0XHRcdFx0XHRcdGxldCBkaXN0YW5jZSA9IE51bWJlci5NQVhfVkFMVUU7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgY3VycmVudEFjdGlvbnMgPSBbLi4uY29kZUFjdGlvblNldC52YWxpZEFjdGlvbnNdO1xuXG5cdFx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBtYXJrZXIgb2YgYWxsTWFya2Vycykge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgY29sID0gbWFya2VyLmVuZENvbHVtbjtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJvdyA9IG1hcmtlci5lbmRMaW5lTnVtYmVyO1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3Qgc3RhcnRSb3cgPSBtYXJrZXIuc3RhcnRMaW5lTnVtYmVyO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBGb3VuZCBxdWlja2ZpeCBvbiB0aGUgc2FtZSBsaW5lIGFuZCBjaGVjayByZWxhdGl2ZSBkaXN0YW5jZSB0byBvdGhlciBtYXJrZXJzXG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoKHJvdyA9PT0gY3VyclBvc2l0aW9uLmxpbmVOdW1iZXIgfHwgc3RhcnRSb3cgPT09IGN1cnJQb3NpdGlvbi5saW5lTnVtYmVyKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0cmFja2VkUG9zaXRpb24gPSBuZXcgUG9zaXRpb24ocm93LCBjb2wpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBuZXdDb2RlQWN0aW9uVHJpZ2dlcjogQ29kZUFjdGlvblRyaWdnZXIgPSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogdHJpZ2dlci50cmlnZ2VyLnR5cGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHJpZ2dlckFjdGlvbjogdHJpZ2dlci50cmlnZ2VyLnRyaWdnZXJBY3Rpb24sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZmlsdGVyOiB7IGluY2x1ZGU6IHRyaWdnZXIudHJpZ2dlci5maWx0ZXI/LmluY2x1ZGUgPyB0cmlnZ2VyLnRyaWdnZXIuZmlsdGVyPy5pbmNsdWRlIDogQ29kZUFjdGlvbktpbmQuUXVpY2tGaXggfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhdXRvQXBwbHk6IHRyaWdnZXIudHJpZ2dlci5hdXRvQXBwbHksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGV4dDogeyBub3RBdmFpbGFibGVNZXNzYWdlOiB0cmlnZ2VyLnRyaWdnZXIuY29udGV4dD8ubm90QXZhaWxhYmxlTWVzc2FnZSB8fCAnJywgcG9zaXRpb246IHRyYWNrZWRQb3NpdGlvbiB9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uQXNQb3NpdGlvbiA9IG5ldyBTZWxlY3Rpb24odHJhY2tlZFBvc2l0aW9uLmxpbmVOdW1iZXIsIHRyYWNrZWRQb3NpdGlvbi5jb2x1bW4sIHRyYWNrZWRQb3NpdGlvbi5saW5lTnVtYmVyLCB0cmFja2VkUG9zaXRpb24uY29sdW1uKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgYWN0aW9uc0F0TWFya2VyID0gYXdhaXQgZ2V0Q29kZUFjdGlvbnModGhpcy5fcmVnaXN0cnksIG1vZGVsLCBzZWxlY3Rpb25Bc1Bvc2l0aW9uLCBuZXdDb2RlQWN0aW9uVHJpZ2dlciwgUHJvZ3Jlc3MuTm9uZSwgdG9rZW4pO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhY3Rpb25zQXRNYXJrZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBlbXB0eUNvZGVBY3Rpb25TZXQ7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAoYWN0aW9uc0F0TWFya2VyLnZhbGlkQWN0aW9ucy5sZW5ndGggIT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBhY3Rpb25zQXRNYXJrZXIudmFsaWRBY3Rpb25zKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAoYWN0aW9uLmFjdGlvbi5jb21tYW5kPy5hcmd1bWVudHM/LnNvbWUoYXJnID0+IHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnICYmIGFyZy5pbmNsdWRlcyhBUFBMWV9GSVhfQUxMX0NPTU1BTkRfSUQpKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhY3Rpb24uYWN0aW9uLmRpYWdub3N0aWNzID0gWy4uLmFsbE1hcmtlcnMuZmlsdGVyKG1hcmtlciA9PiBtYXJrZXIucmVsYXRlZEluZm9ybWF0aW9uKV07XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0aWYgKGNvZGVBY3Rpb25TZXQuYWxsQWN0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGFsbENvZGVBY3Rpb25zLnB1c2goLi4uYWN0aW9uc0F0TWFya2VyLmFsbEFjdGlvbnMpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEFscmVhZHkgZmlsdGVyZWQgdGhyb3VnaCB0byBvbmx5IGdldCBxdWlja2ZpeGVzLCBzbyBubyBuZWVkIHRvIGZpbHRlciBhZ2Fpbi5cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAoTWF0aC5hYnMoY3VyclBvc2l0aW9uLmNvbHVtbiAtIGNvbCkgPCBkaXN0YW5jZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y3VycmVudEFjdGlvbnMudW5zaGlmdCguLi5hY3Rpb25zQXRNYXJrZXIudmFsaWRBY3Rpb25zKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y3VycmVudEFjdGlvbnMucHVzaCguLi5hY3Rpb25zQXRNYXJrZXIudmFsaWRBY3Rpb25zKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGlzdGFuY2UgPSBNYXRoLmFicyhjdXJyUG9zaXRpb24uY29sdW1uIC0gY29sKTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZmlsdGVyZWRBY3Rpb25zID0gY3VycmVudEFjdGlvbnMuZmlsdGVyKChhY3Rpb24sIGluZGV4LCBzZWxmKSA9PlxuXHRcdFx0XHRcdFx0XHRcdFx0c2VsZi5maW5kSW5kZXgoKGEpID0+IGEuYWN0aW9uLnRpdGxlID09PSBhY3Rpb24uYWN0aW9uLnRpdGxlKSA9PT0gaW5kZXgpO1xuXG5cdFx0XHRcdFx0XHRcdFx0ZmlsdGVyZWRBY3Rpb25zLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChhLmFjdGlvbi5pc1ByZWZlcnJlZCAmJiAhYi5hY3Rpb24uaXNQcmVmZXJyZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmICghYS5hY3Rpb24uaXNQcmVmZXJyZWQgJiYgYi5hY3Rpb24uaXNQcmVmZXJyZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGEuYWN0aW9uLmlzQUkgJiYgIWIuYWN0aW9uLmlzQUkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCFhLmFjdGlvbi5pc0FJICYmIGIuYWN0aW9uLmlzQUkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIDA7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdFx0XHQvLyBPbmx5IHJldHJpZ2dlcnMgaWYgYWN0dWFsbHkgZm91bmQgcXVpY2tmaXggb24gdGhlIHNhbWUgbGluZSBhcyBjdXJzb3Jcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyB2YWxpZEFjdGlvbnM6IGZpbHRlcmVkQWN0aW9ucywgYWxsQWN0aW9uczogYWxsQ29kZUFjdGlvbnMsIGRvY3VtZW50YXRpb246IGNvZGVBY3Rpb25TZXQuZG9jdW1lbnRhdGlvbiwgaGFzQXV0b0ZpeDogY29kZUFjdGlvblNldC5oYXNBdXRvRml4LCBoYXNBSUZpeDogY29kZUFjdGlvblNldC5oYXNBSUZpeCwgYWxsQUlGaXhlczogY29kZUFjdGlvblNldC5hbGxBSUZpeGVzLCBkaXNwb3NlOiAoKSA9PiB7IHRoaXMuY29kZUFjdGlvbnNEaXNwb3NhYmxlLnZhbHVlID0gY29kZUFjdGlvblNldDsgfSB9O1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gQ2FzZSBmb3IgbWFudWFsIHRyaWdnZXJzIC0gc3BlY2lmaWNhbGx5IFNvdXJjZSBBY3Rpb25zIGFuZCBSZWZhY3RvcnNcblx0XHRcdFx0XHRpZiAodHJpZ2dlci50cmlnZ2VyLnR5cGUgPT09IENvZGVBY3Rpb25UcmlnZ2VyVHlwZS5JbnZva2UpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvZGVBY3Rpb25zID0gYXdhaXQgZ2V0Q29kZUFjdGlvbnModGhpcy5fcmVnaXN0cnksIG1vZGVsLCB0cmlnZ2VyLnNlbGVjdGlvbiwgdHJpZ2dlci50cmlnZ2VyLCBQcm9ncmVzcy5Ob25lLCB0b2tlbik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gY29kZUFjdGlvbnM7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgY29kZUFjdGlvblNldCA9IGF3YWl0IGdldENvZGVBY3Rpb25zKHRoaXMuX3JlZ2lzdHJ5LCBtb2RlbCwgdHJpZ2dlci5zZWxlY3Rpb24sIHRyaWdnZXIudHJpZ2dlciwgUHJvZ3Jlc3MuTm9uZSwgdG9rZW4pO1xuXHRcdFx0XHRcdHRoaXMuY29kZUFjdGlvbnNEaXNwb3NhYmxlLnZhbHVlID0gY29kZUFjdGlvblNldDtcblx0XHRcdFx0XHRyZXR1cm4gY29kZUFjdGlvblNldDtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKHRyaWdnZXIudHJpZ2dlci50eXBlID09PSBDb2RlQWN0aW9uVHJpZ2dlclR5cGUuSW52b2tlKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJvZ3Jlc3NTZXJ2aWNlPy5zaG93V2hpbGUoYWN0aW9ucywgMjUwKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBuZXdTdGF0ZSA9IG5ldyBDb2RlQWN0aW9uc1N0YXRlLlRyaWdnZXJlZCh0cmlnZ2VyLnRyaWdnZXIsIHN0YXJ0UG9zaXRpb24sIGFjdGlvbnMpO1xuXHRcdFx0XHRsZXQgaXNNYW51YWxUb0F1dG9UcmFuc2l0aW9uID0gZmFsc2U7XG5cdFx0XHRcdGlmICh0aGlzLl9zdGF0ZS50eXBlID09PSBDb2RlQWN0aW9uc1N0YXRlLlR5cGUuVHJpZ2dlcmVkKSB7XG5cdFx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGN1cnJlbnQgc3RhdGUgaXMgbWFudWFsIGFuZCB0aGUgbmV3IHN0YXRlIGlzIGF1dG9tYXRpY1xuXHRcdFx0XHRcdGlzTWFudWFsVG9BdXRvVHJhbnNpdGlvbiA9IHRoaXMuX3N0YXRlLnRyaWdnZXIudHlwZSA9PT0gQ29kZUFjdGlvblRyaWdnZXJUeXBlLkludm9rZSAmJlxuXHRcdFx0XHRcdFx0bmV3U3RhdGUudHlwZSA9PT0gQ29kZUFjdGlvbnNTdGF0ZS5UeXBlLlRyaWdnZXJlZCAmJlxuXHRcdFx0XHRcdFx0bmV3U3RhdGUudHJpZ2dlci50eXBlID09PSBDb2RlQWN0aW9uVHJpZ2dlclR5cGUuQXV0byAmJlxuXHRcdFx0XHRcdFx0dGhpcy5fc3RhdGUucG9zaXRpb24gIT09IG5ld1N0YXRlLnBvc2l0aW9uO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRG8gbm90IHRyaWdnZXIgc3RhdGUgaWYgY3VycmVudCBzdGF0ZSBpcyBtYW51YWwgYW5kIGluY29taW5nIHN0YXRlIGlzIGF1dG9tYXRpY1xuXHRcdFx0XHRpZiAoIWlzTWFudWFsVG9BdXRvVHJhbnNpdGlvbikge1xuXHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUobmV3U3RhdGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFJlc2V0IHRoZSBuZXcgc3RhdGUgYWZ0ZXIgZ2V0dGluZyBjb2RlIGFjdGlvbnMgYmFjay5cblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuc2V0U3RhdGUobmV3U3RhdGUpO1xuXHRcdFx0XHRcdH0sIDUwMCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl9jb2RlQWN0aW9uT3JhY2xlLnZhbHVlLnRyaWdnZXIoeyB0eXBlOiBDb2RlQWN0aW9uVHJpZ2dlclR5cGUuQXV0bywgdHJpZ2dlckFjdGlvbjogQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UuRGVmYXVsdCB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc3VwcG9ydGVkQ29kZUFjdGlvbnMucmVzZXQoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgdHJpZ2dlcih0cmlnZ2VyOiBDb2RlQWN0aW9uVHJpZ2dlcikge1xuXHRcdHRoaXMuX2NvZGVBY3Rpb25PcmFjbGUudmFsdWU/LnRyaWdnZXIodHJpZ2dlcik7XG5cdFx0dGhpcy5jb2RlQWN0aW9uc0Rpc3Bvc2FibGUuY2xlYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0U3RhdGUobmV3U3RhdGU6IENvZGVBY3Rpb25zU3RhdGUuU3RhdGUsIHNraXBOb3RpZnk/OiBib29sZWFuKSB7XG5cdFx0aWYgKG5ld1N0YXRlID09PSB0aGlzLl9zdGF0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIENhbmNlbCBvbGQgcmVxdWVzdFxuXHRcdGlmICh0aGlzLl9zdGF0ZS50eXBlID09PSBDb2RlQWN0aW9uc1N0YXRlLlR5cGUuVHJpZ2dlcmVkKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZS5jYW5jZWwoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zdGF0ZSA9IG5ld1N0YXRlO1xuXG5cdFx0aWYgKCFza2lwTm90aWZ5ICYmICF0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKG5ld1N0YXRlKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQTRCLHlCQUF5QixvQkFBb0I7QUFDekUsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsWUFBeUIseUJBQXlCO0FBQzNELFNBQVMsZUFBZTtBQUd4QixTQUEwQyxxQkFBcUI7QUFFL0QsU0FBaUMsZ0JBQWdCO0FBRWpELFNBQVMsY0FBYyw2QkFBNkI7QUFDcEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUI7QUFFMUIsU0FBNkIsNkJBQTZCO0FBQzFELFNBQVMsZ0JBQWtELCtCQUErQjtBQUMxRixTQUFTLHNCQUFzQjtBQUV4QixNQUFNLHlCQUF5QixJQUFJLGNBQXNCLHVCQUF1QixFQUFFO0FBRWxGLE1BQU0sMkJBQTJCO0FBT3hDLE1BQU0seUJBQXlCLFdBQVc7QUFBQSxFQUl6QyxZQUNrQixTQUNBLGdCQUNBLGVBQ0EsU0FBaUIsS0FDakM7QUFDRCxVQUFNO0FBTFc7QUFDQTtBQUNBO0FBQ0E7QUFObEIsU0FBaUIsb0JBQW9CLEtBQUssVUFBVSxJQUFJLGFBQWEsQ0FBQztBQVNyRSxTQUFLLFVBQVUsS0FBSyxlQUFlLGdCQUFnQixPQUFLLEtBQUssaUJBQWlCLENBQUMsQ0FBQyxD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SSxRQUFRLFFBQVEsU0FBUyxzQkFBc0IsUUFBUTtBQUMxRCxrQkFBTSxjQUFjLE1BQU0sZUFBZSxLQUFLLFdBQVcsT0FBTyxRQUFRLFdBQVcsUUFBUSxTQUFTLFNBQVMsTUFBTSxLQUFLO0FBQ3hILG1CQUFPO0FBQUEsVUFDUjtBQUVBLGdCQUFNLGdCQUFnQixNQUFNLGVBQWUsS0FBSyxXQUFXLE9BQU8sUUFBUSxXQUFXLFFBQVEsU0FBUyxTQUFTLE1BQU0sS0FBSztBQUMxSCxlQUFLLHNCQUFzQixRQUFRO0FBQ25DLGlCQUFPO0FBQUEsUUFDUixDQUFDO0FBRUQsWUFBSSxRQUFRLFFBQVEsU0FBUyxzQkFBc0IsUUFBUTtBQUMxRCxlQUFLLGtCQUFrQixVQUFVLFNBQVMsR0FBRztBQUFBLFFBQzlDO0FBQ0EsY0FBTSxXQUFXLElBQUksaUJBQWlCLFVBQVUsUUFBUSxTQUFTLGVBQWUsT0FBTztBQUN2RixZQUFJLDJCQUEyQjtBQUMvQixZQUFJLEtBQUssT0FBTyxTQUFTLG1CQUFpQztBQUV6RCxxQ0FBMkIsS0FBSyxPQUFPLFFBQVEsU0FBUyxzQkFBc0IsVUFDN0UsU0FBUyxTQUFTLHFCQUNsQixTQUFTLFFBQVEsU0FBUyxzQkFBc0IsUUFDaEQsS0FBSyxPQUFPLGFBQWEsU0FBUztBQUFBLFFBQ3BDO0FBR0EsWUFBSSxDQUFDLDBCQUEwQjtBQUM5QixlQUFLLFNBQVMsUUFBUTtBQUFBLFFBQ3ZCLE9BQU87QUFFTixxQkFBVyxNQUFNO0FBQ2hCLGlCQUFLLFNBQVMsUUFBUTtBQUFBLFVBQ3ZCLEdBQUcsR0FBRztBQUFBLFFBQ1A7QUFBQSxNQUNELEdBQUcsTUFBUztBQUNaLFdBQUssa0JBQWtCLE1BQU0sUUFBUSxFQUFFLE1BQU0sc0JBQXNCLE1BQU0sZUFBZSx3QkFBd0IsUUFBUSxDQUFDO0FBQUEsSUFDMUgsT0FBTztBQUNOLFdBQUssc0JBQXNCLE1BQU07QUFBQSxJQUNsQztBQUFBLEVBQ0Q7QUFBQSxFQUVPLFFBQVEsU0FBNEI7QUFDMUMsU0FBSyxrQkFBa0IsT0FBTyxRQUFRLE9BQU87QUFDN0MsU0FBSyxzQkFBc0IsTUFBTTtBQUFBLEVBQ2xDO0FBQUEsRUFFUSxTQUFTLFVBQWtDLFlBQXNCO0FBQ3hFLFFBQUksYUFBYSxLQUFLLFFBQVE7QUFDN0I7QUFBQSxJQUNEO0FBR0EsUUFBSSxLQUFLLE9BQU8sU0FBUyxtQkFBaUM7QUFDekQsV0FBSyxPQUFPLE9BQU87QUFBQSxJQUNwQjtBQUVBLFNBQUssU0FBUztBQUVkLFFBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxXQUFXO0FBQ25DLFdBQUssa0JBQWtCLEtBQUssUUFBUTtBQUFBLElBQ3JDO0FBQUEsRUFDRDtBQUNEOyIsCiAgIm5hbWVzIjogWyJDb2RlQWN0aW9uc1N0YXRlIiwgIlR5cGUiLCAiY29kZUFjdGlvblNldCIsICJtYXJrZXIiXQp9Cg==
