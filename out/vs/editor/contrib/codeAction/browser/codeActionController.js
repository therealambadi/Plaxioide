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
import { getDomNodePagePosition } from "../../../../base/browser/dom.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IMarkerService } from "../../../../platform/markers/common/markers.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { editorFindMatchHighlight, editorFindMatchHighlightBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { isHighContrast } from "../../../../platform/theme/common/theme.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { Position } from "../../../common/core/position.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { CodeActionTriggerType } from "../../../common/languages.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { MessageController } from "../../message/browser/messageController.js";
import { CodeActionAutoApply, CodeActionKind, CodeActionTriggerSource } from "../common/types.js";
import { ApplyCodeActionReason, applyCodeAction } from "./codeAction.js";
import { CodeActionKeybindingResolver } from "./codeActionKeybindingResolver.js";
import { toMenuItems } from "./codeActionMenu.js";
import { CodeActionModel, CodeActionsState } from "./codeActionModel.js";
import { LightBulbWidget } from "./lightBulbWidget.js";
const DECORATION_CLASS_NAME = "quickfix-edit-highlight";
let CodeActionController = class extends Disposable {
  constructor(editor, markerService, contextKeyService, instantiationService, languageFeaturesService, progressService, _commandService, _configurationService, _actionWidgetService, _instantiationService, _progressService) {
    super();
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._actionWidgetService = _actionWidgetService;
    this._instantiationService = _instantiationService;
    this._progressService = _progressService;
    this._activeCodeActions = this._register(new MutableDisposable());
    this._showDisabled = false;
    this._disposed = false;
    this._editor = editor;
    this._model = this._register(new CodeActionModel(this._editor, languageFeaturesService.codeActionProvider, markerService, contextKeyService, progressService, _configurationService));
    this._register(this._model.onDidChangeState((newState) => this.update(newState)));
    this._lightBulbWidget = new Lazy(() => {
      const widget = this._editor.getContribution(LightBulbWidget.ID);
      if (widget) {
        this._register(widget.onClick((e) => this.showCodeActionsFromLightbulb(e.actions, e)));
      }
      return widget;
    });
    this._resolver = instantiationService.createInstance(CodeActionKeybindingResolver);
    this._register(this._editor.onDidLayoutChange(() => this._actionWidgetService.hide()));
  }
  static get(editor) {
    return editor.getContribution(CodeActionController.ID);
  }
  dispose() {
    this._disposed = true;
    super.dispose();
  }
  async showCodeActionsFromLightbulb(actions, at) {
    if (actions.allAIFixes && actions.validActions.length === 1) {
      const actionItem = actions.validActions[0];
      const command = actionItem.action.command;
      if (command && command.id === "inlineChat.start") {
        if (command.arguments && command.arguments.length >= 1) {
          command.arguments[0] = { ...command.arguments[0], autoSend: false };
        }
      }
      await this.applyCodeAction(actionItem, false, false, ApplyCodeActionReason.FromAILightbulb);
      return;
    }
    await this.showCodeActionList(actions, at, { includeDisabledActions: false, fromLightbulb: true });
  }
  showCodeActions(_trigger, actions, at) {
    return this.showCodeActionList(actions, at, { includeDisabledActions: false, fromLightbulb: false });
  }
  hideCodeActions() {
    this._actionWidgetService.hide();
  }
  manualTriggerAtCurrentPosition(notAvailableMessage, triggerAction, filter, autoApply) {
    if (!this._editor.hasModel()) {
      return;
    }
    MessageController.get(this._editor)?.closeMessage();
    const triggerPosition = this._editor.getPosition();
    this._trigger({ type: CodeActionTriggerType.Invoke, triggerAction, filter, autoApply, context: { notAvailableMessage, position: triggerPosition } });
  }
  _trigger(trigger) {
    return this._model.trigger(trigger);
  }
  async applyCodeAction(action, retrigger, preview, actionReason) {
    const progress = this._progressService.show(true, 500);
    try {
      await this._instantiationService.invokeFunction(applyCodeAction, action, actionReason, { preview, editor: this._editor });
    } finally {
      if (retrigger) {
        this._trigger({ type: CodeActionTriggerType.Auto, triggerAction: CodeActionTriggerSource.QuickFix, filter: {} });
      }
      progress.done();
    }
  }
  hideLightBulbWidget() {
    this._lightBulbWidget.rawValue?.hide();
    this._lightBulbWidget.rawValue?.gutterHide();
  }
  async update(newState) {
    if (newState.type !== CodeActionsState.Type.Triggered) {
      this.hideLightBulbWidget();
      return;
    }
    let actions;
    try {
      actions = await newState.actions;
    } catch (e) {
      onUnexpectedError(e);
      return;
    }
    if (this._disposed) {
      return;
    }
    const selection = this._editor.getSelection();
    if (selection?.startLineNumber !== newState.position.lineNumber) {
      return;
    }
    this._lightBulbWidget.value?.update(actions, newState.trigger, newState.position);
    if (newState.trigger.type === CodeActionTriggerType.Invoke) {
      if (newState.trigger.filter?.include) {
        const validActionToApply = this.tryGetValidActionToApply(newState.trigger, actions);
        if (validActionToApply) {
          try {
            this.hideLightBulbWidget();
            await this.applyCodeAction(validActionToApply, false, false, ApplyCodeActionReason.FromCodeActions);
          } finally {
            actions.dispose();
          }
          return;
        }
        if (newState.trigger.context) {
          const invalidAction = this.getInvalidActionThatWouldHaveBeenApplied(newState.trigger, actions);
          if (invalidAction && invalidAction.action.disabled) {
            MessageController.get(this._editor)?.showMessage(invalidAction.action.disabled, newState.trigger.context.position);
            actions.dispose();
            return;
          }
        }
      }
      const includeDisabledActions = !!newState.trigger.filter?.include;
      if (newState.trigger.context) {
        if (!actions.allActions.length || !includeDisabledActions && !actions.validActions.length) {
          MessageController.get(this._editor)?.showMessage(newState.trigger.context.notAvailableMessage, newState.trigger.context.position);
          this._activeCodeActions.value = actions;
          actions.dispose();
          return;
        }
      }
      this._activeCodeActions.value = actions;
      this.showCodeActionList(actions, this.toCoords(newState.position), { includeDisabledActions, fromLightbulb: false });
    } else {
      if (this._actionWidgetService.isVisible) {
        actions.dispose();
      } else {
        this._activeCodeActions.value = actions;
      }
    }
  }
  getInvalidActionThatWouldHaveBeenApplied(trigger, actions) {
    if (!actions.allActions.length) {
      return void 0;
    }
    if (trigger.autoApply === CodeActionAutoApply.First && actions.validActions.length === 0 || trigger.autoApply === CodeActionAutoApply.IfSingle && actions.allActions.length === 1) {
      return actions.allActions.find(({ action }) => action.disabled);
    }
    return void 0;
  }
  tryGetValidActionToApply(trigger, actions) {
    if (!actions.validActions.length) {
      return void 0;
    }
    if (trigger.autoApply === CodeActionAutoApply.First && actions.validActions.length > 0 || trigger.autoApply === CodeActionAutoApply.IfSingle && actions.validActions.length === 1) {
      return actions.validActions[0];
    }
    return void 0;
  }
  async showCodeActionList(actions, at, options) {
    const currentDecorations = this._editor.createDecorationsCollection();
    const editorDom = this._editor.getDomNode();
    if (!editorDom) {
      return;
    }
    const actionsToShow = options.includeDisabledActions && (this._showDisabled || actions.validActions.length === 0) ? actions.allActions : actions.validActions;
    if (!actionsToShow.length) {
      return;
    }
    const anchor = Position.isIPosition(at) ? this.toCoords(at) : at;
    const delegate = {
      onSelect: async (action, preview) => {
        this.applyCodeAction(
          action,
          /* retrigger */
          true,
          !!preview,
          options.fromLightbulb ? ApplyCodeActionReason.FromAILightbulb : ApplyCodeActionReason.FromCodeActions
        );
        this._actionWidgetService.hide(false);
        currentDecorations.clear();
      },
      onHide: (didCancel) => {
        this._editor?.focus();
        currentDecorations.clear();
      },
      onHover: async (action, token) => {
        if (token.isCancellationRequested) {
          return;
        }
        let canPreview = false;
        const actionKind = action.action.kind;
        if (actionKind) {
          const hierarchicalKind = new HierarchicalKind(actionKind);
          const refactorKinds = [
            CodeActionKind.RefactorExtract,
            CodeActionKind.RefactorInline,
            CodeActionKind.RefactorRewrite,
            CodeActionKind.RefactorMove,
            CodeActionKind.Source
          ];
          canPreview = refactorKinds.some((refactorKind) => refactorKind.contains(hierarchicalKind));
        }
        return { canPreview: canPreview || !!action.action.edit?.edits.length };
      },
      onFocus: (action) => {
        if (action && action.action) {
          const ranges = action.action.ranges;
          const diagnostics = action.action.diagnostics;
          currentDecorations.clear();
          if (ranges && ranges.length > 0) {
            const decorations = diagnostics && diagnostics?.length > 1 ? diagnostics.map((diagnostic) => ({ range: diagnostic, options: CodeActionController.DECORATION })) : ranges.map((range) => ({ range, options: CodeActionController.DECORATION }));
            currentDecorations.set(decorations);
          } else if (diagnostics && diagnostics.length > 0) {
            const decorations = diagnostics.map((diagnostic2) => ({ range: diagnostic2, options: CodeActionController.DECORATION }));
            currentDecorations.set(decorations);
            const diagnostic = diagnostics[0];
            if (diagnostic.startLineNumber && diagnostic.startColumn) {
              const selectionText = this._editor.getModel()?.getWordAtPosition({ lineNumber: diagnostic.startLineNumber, column: diagnostic.startColumn })?.word;
              aria.status(localize("editingNewSelection", "Context: {0} at line {1} and column {2}.", selectionText, diagnostic.startLineNumber, diagnostic.startColumn));
            }
          }
        } else {
          currentDecorations.clear();
        }
      }
    };
    this._actionWidgetService.show(
      "codeActionWidget",
      true,
      toMenuItems(actionsToShow, this._shouldShowHeaders(), this._resolver.getResolver()),
      delegate,
      anchor,
      editorDom,
      this._getActionBarActions(actions, at, options)
    );
  }
  toCoords(position) {
    if (!this._editor.hasModel()) {
      return { x: 0, y: 0 };
    }
    this._editor.revealPosition(position, ScrollType.Immediate);
    this._editor.render();
    const cursorCoords = this._editor.getScrolledVisiblePosition(position);
    const editorCoords = getDomNodePagePosition(this._editor.getDomNode());
    const x = editorCoords.left + cursorCoords.left;
    const y = editorCoords.top + cursorCoords.top + cursorCoords.height;
    return { x, y };
  }
  _shouldShowHeaders() {
    const model = this._editor?.getModel();
    return this._configurationService.getValue("editor.codeActionWidget.showHeaders", { resource: model?.uri });
  }
  _getActionBarActions(actions, at, options) {
    if (options.fromLightbulb) {
      return [];
    }
    const resultActions = actions.documentation.map((command) => ({
      id: command.id,
      label: command.title,
      tooltip: command.tooltip ?? "",
      class: void 0,
      enabled: true,
      run: () => this._commandService.executeCommand(command.id, ...command.arguments ?? [])
    }));
    if (options.includeDisabledActions && actions.validActions.length > 0 && actions.allActions.length !== actions.validActions.length) {
      resultActions.push(this._showDisabled ? {
        id: "hideMoreActions",
        label: localize("hideMoreActions", "Hide Disabled"),
        enabled: true,
        tooltip: "",
        class: void 0,
        run: () => {
          this._showDisabled = false;
          return this.showCodeActionList(actions, at, options);
        }
      } : {
        id: "showMoreActions",
        label: localize("showMoreActions", "Show Disabled"),
        enabled: true,
        tooltip: "",
        class: void 0,
        run: () => {
          this._showDisabled = true;
          return this.showCodeActionList(actions, at, options);
        }
      });
    }
    return resultActions;
  }
};
CodeActionController.ID = "editor.contrib.codeActionController";
CodeActionController.DECORATION = ModelDecorationOptions.register({
  description: "quickfix-highlight",
  className: DECORATION_CLASS_NAME
});
CodeActionController = __decorateClass([
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IEditorProgressService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IActionWidgetService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IEditorProgressService)
], CodeActionController);
registerThemingParticipant((theme, collector) => {
  const addBackgroundColorRule = (selector, color) => {
    if (color) {
      collector.addRule(`.monaco-editor ${selector} { background-color: ${color}; }`);
    }
  };
  addBackgroundColorRule(".quickfix-edit-highlight", theme.getColor(editorFindMatchHighlight));
  const findMatchHighlightBorder = theme.getColor(editorFindMatchHighlightBorder);
  if (findMatchHighlightBorder) {
    collector.addRule(`.monaco-editor .quickfix-edit-highlight { border: 1px ${isHighContrast(theme.type) ? "dotted" : "solid"} ${findMatchHighlightBorder}; box-sizing: border-box; }`);
  }
});
export {
  CodeActionController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2Jyb3dzZXIvY29kZUFjdGlvbkNvbnRyb2xsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBnZXREb21Ob2RlUGFnZVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBhcmlhIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgSUFuY2hvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEhpZXJhcmNoaWNhbEtpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oaWVyYXJjaGljYWxLaW5kLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElBY3Rpb25MaXN0RGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25XaWRnZXQvYnJvd3Nlci9hY3Rpb25MaXN0LmpzJztcbmltcG9ydCB7IElBY3Rpb25XaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uV2lkZ2V0L2Jyb3dzZXIvYWN0aW9uV2lkZ2V0LmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWFya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBlZGl0b3JGaW5kTWF0Y2hIaWdobGlnaHQsIGVkaXRvckZpbmRNYXRjaEhpZ2hsaWdodEJvcmRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGlzSGlnaENvbnRyYXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24sIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiwgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvblRyaWdnZXJUeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWx0YURlY29yYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgTWVzc2FnZUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi9tZXNzYWdlL2Jyb3dzZXIvbWVzc2FnZUNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvbkF1dG9BcHBseSwgQ29kZUFjdGlvbkZpbHRlciwgQ29kZUFjdGlvbkl0ZW0sIENvZGVBY3Rpb25LaW5kLCBDb2RlQWN0aW9uU2V0LCBDb2RlQWN0aW9uVHJpZ2dlciwgQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UgfSBmcm9tICcuLi9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgQXBwbHlDb2RlQWN0aW9uUmVhc29uLCBhcHBseUNvZGVBY3Rpb24gfSBmcm9tICcuL2NvZGVBY3Rpb24uanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvbktleWJpbmRpbmdSZXNvbHZlciB9IGZyb20gJy4vY29kZUFjdGlvbktleWJpbmRpbmdSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyB0b01lbnVJdGVtcyB9IGZyb20gJy4vY29kZUFjdGlvbk1lbnUuanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvbk1vZGVsLCBDb2RlQWN0aW9uc1N0YXRlIH0gZnJvbSAnLi9jb2RlQWN0aW9uTW9kZWwuanMnO1xuaW1wb3J0IHsgTGlnaHRCdWxiV2lkZ2V0IH0gZnJvbSAnLi9saWdodEJ1bGJXaWRnZXQuanMnO1xuXG5pbnRlcmZhY2UgSUFjdGlvblNob3dPcHRpb25zIHtcblx0cmVhZG9ubHkgaW5jbHVkZURpc2FibGVkQWN0aW9ucz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGZyb21MaWdodGJ1bGI/OiBib29sZWFuO1xufVxuXG5cbmNvbnN0IERFQ09SQVRJT05fQ0xBU1NfTkFNRSA9ICdxdWlja2ZpeC1lZGl0LWhpZ2hsaWdodCc7XG5cbmV4cG9ydCBjbGFzcyBDb2RlQWN0aW9uQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEID0gJ2VkaXRvci5jb250cmliLmNvZGVBY3Rpb25Db250cm9sbGVyJztcblxuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElDb2RlRWRpdG9yKTogQ29kZUFjdGlvbkNvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxDb2RlQWN0aW9uQ29udHJvbGxlcj4oQ29kZUFjdGlvbkNvbnRyb2xsZXIuSUQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcjtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IENvZGVBY3Rpb25Nb2RlbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9saWdodEJ1bGJXaWRnZXQ6IExhenk8TGlnaHRCdWxiV2lkZ2V0IHwgbnVsbD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGl2ZUNvZGVBY3Rpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPENvZGVBY3Rpb25TZXQ+KCkpO1xuXHRwcml2YXRlIF9zaG93RGlzYWJsZWQgPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXNvbHZlcjogQ29kZUFjdGlvbktleWJpbmRpbmdSZXNvbHZlcjtcblxuXHRwcml2YXRlIF9kaXNwb3NlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIG1hcmtlclNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlIHByb2dyZXNzU2VydmljZTogSUVkaXRvclByb2dyZXNzU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWN0aW9uV2lkZ2V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY3Rpb25XaWRnZXRTZXJ2aWNlOiBJQWN0aW9uV2lkZ2V0U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJvZ3Jlc3NTZXJ2aWNlOiBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMuX21vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvZGVBY3Rpb25Nb2RlbCh0aGlzLl9lZGl0b3IsIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvZGVBY3Rpb25Qcm92aWRlciwgbWFya2VyU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIHByb2dyZXNzU2VydmljZSwgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbW9kZWwub25EaWRDaGFuZ2VTdGF0ZShuZXdTdGF0ZSA9PiB0aGlzLnVwZGF0ZShuZXdTdGF0ZSkpKTtcblxuXHRcdHRoaXMuX2xpZ2h0QnVsYldpZGdldCA9IG5ldyBMYXp5KCgpID0+IHtcblx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuX2VkaXRvci5nZXRDb250cmlidXRpb248TGlnaHRCdWxiV2lkZ2V0PihMaWdodEJ1bGJXaWRnZXQuSUQpO1xuXHRcdFx0aWYgKHdpZGdldCkge1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih3aWRnZXQub25DbGljayhlID0+IHRoaXMuc2hvd0NvZGVBY3Rpb25zRnJvbUxpZ2h0YnVsYihlLmFjdGlvbnMsIGUpKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gd2lkZ2V0O1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fcmVzb2x2ZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlQWN0aW9uS2V5YmluZGluZ1Jlc29sdmVyKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2VkaXRvci5vbkRpZExheW91dENoYW5nZSgoKSA9PiB0aGlzLl9hY3Rpb25XaWRnZXRTZXJ2aWNlLmhpZGUoKSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9kaXNwb3NlZCA9IHRydWU7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzaG93Q29kZUFjdGlvbnNGcm9tTGlnaHRidWxiKGFjdGlvbnM6IENvZGVBY3Rpb25TZXQsIGF0OiBJQW5jaG9yIHwgSVBvc2l0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGFjdGlvbnMuYWxsQUlGaXhlcyAmJiBhY3Rpb25zLnZhbGlkQWN0aW9ucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdGNvbnN0IGFjdGlvbkl0ZW0gPSBhY3Rpb25zLnZhbGlkQWN0aW9uc1swXTtcblx0XHRcdGNvbnN0IGNvbW1hbmQgPSBhY3Rpb25JdGVtLmFjdGlvbi5jb21tYW5kO1xuXHRcdFx0aWYgKGNvbW1hbmQgJiYgY29tbWFuZC5pZCA9PT0gJ2lubGluZUNoYXQuc3RhcnQnKSB7XG5cdFx0XHRcdGlmIChjb21tYW5kLmFyZ3VtZW50cyAmJiBjb21tYW5kLmFyZ3VtZW50cy5sZW5ndGggPj0gMSkge1xuXHRcdFx0XHRcdGNvbW1hbmQuYXJndW1lbnRzWzBdID0geyAuLi5jb21tYW5kLmFyZ3VtZW50c1swXSwgYXV0b1NlbmQ6IGZhbHNlIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMuYXBwbHlDb2RlQWN0aW9uKGFjdGlvbkl0ZW0sIGZhbHNlLCBmYWxzZSwgQXBwbHlDb2RlQWN0aW9uUmVhc29uLkZyb21BSUxpZ2h0YnVsYik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuc2hvd0NvZGVBY3Rpb25MaXN0KGFjdGlvbnMsIGF0LCB7IGluY2x1ZGVEaXNhYmxlZEFjdGlvbnM6IGZhbHNlLCBmcm9tTGlnaHRidWxiOiB0cnVlIH0pO1xuXHR9XG5cblx0cHVibGljIHNob3dDb2RlQWN0aW9ucyhfdHJpZ2dlcjogQ29kZUFjdGlvblRyaWdnZXIsIGFjdGlvbnM6IENvZGVBY3Rpb25TZXQsIGF0OiBJQW5jaG9yIHwgSVBvc2l0aW9uKSB7XG5cdFx0cmV0dXJuIHRoaXMuc2hvd0NvZGVBY3Rpb25MaXN0KGFjdGlvbnMsIGF0LCB7IGluY2x1ZGVEaXNhYmxlZEFjdGlvbnM6IGZhbHNlLCBmcm9tTGlnaHRidWxiOiBmYWxzZSB9KTtcblx0fVxuXG5cdHB1YmxpYyBoaWRlQ29kZUFjdGlvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWN0aW9uV2lkZ2V0U2VydmljZS5oaWRlKCk7XG5cdH1cblxuXHRwdWJsaWMgbWFudWFsVHJpZ2dlckF0Q3VycmVudFBvc2l0aW9uKFxuXHRcdG5vdEF2YWlsYWJsZU1lc3NhZ2U6IHN0cmluZyxcblx0XHR0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZSxcblx0XHRmaWx0ZXI/OiBDb2RlQWN0aW9uRmlsdGVyLFxuXHRcdGF1dG9BcHBseT86IENvZGVBY3Rpb25BdXRvQXBwbHksXG5cdCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRNZXNzYWdlQ29udHJvbGxlci5nZXQodGhpcy5fZWRpdG9yKT8uY2xvc2VNZXNzYWdlKCk7XG5cdFx0Y29uc3QgdHJpZ2dlclBvc2l0aW9uID0gdGhpcy5fZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cdFx0dGhpcy5fdHJpZ2dlcih7IHR5cGU6IENvZGVBY3Rpb25UcmlnZ2VyVHlwZS5JbnZva2UsIHRyaWdnZXJBY3Rpb24sIGZpbHRlciwgYXV0b0FwcGx5LCBjb250ZXh0OiB7IG5vdEF2YWlsYWJsZU1lc3NhZ2UsIHBvc2l0aW9uOiB0cmlnZ2VyUG9zaXRpb24gfSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX3RyaWdnZXIodHJpZ2dlcjogQ29kZUFjdGlvblRyaWdnZXIpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwudHJpZ2dlcih0cmlnZ2VyKTtcblx0fVxuXG5cdGFzeW5jIGFwcGx5Q29kZUFjdGlvbihhY3Rpb246IENvZGVBY3Rpb25JdGVtLCByZXRyaWdnZXI6IGJvb2xlYW4sIHByZXZpZXc6IGJvb2xlYW4sIGFjdGlvblJlYXNvbjogQXBwbHlDb2RlQWN0aW9uUmVhc29uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJvZ3Jlc3MgPSB0aGlzLl9wcm9ncmVzc1NlcnZpY2Uuc2hvdyh0cnVlLCA1MDApO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhcHBseUNvZGVBY3Rpb24sIGFjdGlvbiwgYWN0aW9uUmVhc29uLCB7IHByZXZpZXcsIGVkaXRvcjogdGhpcy5fZWRpdG9yIH0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRpZiAocmV0cmlnZ2VyKSB7XG5cdFx0XHRcdHRoaXMuX3RyaWdnZXIoeyB0eXBlOiBDb2RlQWN0aW9uVHJpZ2dlclR5cGUuQXV0bywgdHJpZ2dlckFjdGlvbjogQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UuUXVpY2tGaXgsIGZpbHRlcjoge30gfSk7XG5cdFx0XHR9XG5cdFx0XHRwcm9ncmVzcy5kb25lKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGhpZGVMaWdodEJ1bGJXaWRnZXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fbGlnaHRCdWxiV2lkZ2V0LnJhd1ZhbHVlPy5oaWRlKCk7XG5cdFx0dGhpcy5fbGlnaHRCdWxiV2lkZ2V0LnJhd1ZhbHVlPy5ndXR0ZXJIaWRlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZShuZXdTdGF0ZTogQ29kZUFjdGlvbnNTdGF0ZS5TdGF0ZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChuZXdTdGF0ZS50eXBlICE9PSBDb2RlQWN0aW9uc1N0YXRlLlR5cGUuVHJpZ2dlcmVkKSB7XG5cdFx0XHR0aGlzLmhpZGVMaWdodEJ1bGJXaWRnZXQoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgYWN0aW9uczogQ29kZUFjdGlvblNldDtcblx0XHR0cnkge1xuXHRcdFx0YWN0aW9ucyA9IGF3YWl0IG5ld1N0YXRlLmFjdGlvbnM7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0aWYgKHNlbGVjdGlvbj8uc3RhcnRMaW5lTnVtYmVyICE9PSBuZXdTdGF0ZS5wb3NpdGlvbi5saW5lTnVtYmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbGlnaHRCdWxiV2lkZ2V0LnZhbHVlPy51cGRhdGUoYWN0aW9ucywgbmV3U3RhdGUudHJpZ2dlciwgbmV3U3RhdGUucG9zaXRpb24pO1xuXG5cdFx0aWYgKG5ld1N0YXRlLnRyaWdnZXIudHlwZSA9PT0gQ29kZUFjdGlvblRyaWdnZXJUeXBlLkludm9rZSkge1xuXHRcdFx0aWYgKG5ld1N0YXRlLnRyaWdnZXIuZmlsdGVyPy5pbmNsdWRlKSB7IC8vIFRyaWdnZXJlZCBmb3Igc3BlY2lmaWMgc2NvcGVcblx0XHRcdFx0Ly8gQ2hlY2sgdG8gc2VlIGlmIHdlIHdhbnQgdG8gYXV0byBhcHBseS5cblxuXHRcdFx0XHRjb25zdCB2YWxpZEFjdGlvblRvQXBwbHkgPSB0aGlzLnRyeUdldFZhbGlkQWN0aW9uVG9BcHBseShuZXdTdGF0ZS50cmlnZ2VyLCBhY3Rpb25zKTtcblx0XHRcdFx0aWYgKHZhbGlkQWN0aW9uVG9BcHBseSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHR0aGlzLmhpZGVMaWdodEJ1bGJXaWRnZXQoKTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuYXBwbHlDb2RlQWN0aW9uKHZhbGlkQWN0aW9uVG9BcHBseSwgZmFsc2UsIGZhbHNlLCBBcHBseUNvZGVBY3Rpb25SZWFzb24uRnJvbUNvZGVBY3Rpb25zKTtcblx0XHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdFx0YWN0aW9ucy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIENoZWNrIHRvIHNlZSBpZiB0aGVyZSBpcyBhbiBhY3Rpb24gdGhhdCB3ZSB3b3VsZCBoYXZlIGFwcGxpZWQgd2VyZSBpdCBub3QgaW52YWxpZFxuXHRcdFx0XHRpZiAobmV3U3RhdGUudHJpZ2dlci5jb250ZXh0KSB7XG5cdFx0XHRcdFx0Y29uc3QgaW52YWxpZEFjdGlvbiA9IHRoaXMuZ2V0SW52YWxpZEFjdGlvblRoYXRXb3VsZEhhdmVCZWVuQXBwbGllZChuZXdTdGF0ZS50cmlnZ2VyLCBhY3Rpb25zKTtcblx0XHRcdFx0XHRpZiAoaW52YWxpZEFjdGlvbiAmJiBpbnZhbGlkQWN0aW9uLmFjdGlvbi5kaXNhYmxlZCkge1xuXHRcdFx0XHRcdFx0TWVzc2FnZUNvbnRyb2xsZXIuZ2V0KHRoaXMuX2VkaXRvcik/LnNob3dNZXNzYWdlKGludmFsaWRBY3Rpb24uYWN0aW9uLmRpc2FibGVkLCBuZXdTdGF0ZS50cmlnZ2VyLmNvbnRleHQucG9zaXRpb24pO1xuXHRcdFx0XHRcdFx0YWN0aW9ucy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGluY2x1ZGVEaXNhYmxlZEFjdGlvbnMgPSAhIW5ld1N0YXRlLnRyaWdnZXIuZmlsdGVyPy5pbmNsdWRlO1xuXHRcdFx0aWYgKG5ld1N0YXRlLnRyaWdnZXIuY29udGV4dCkge1xuXHRcdFx0XHRpZiAoIWFjdGlvbnMuYWxsQWN0aW9ucy5sZW5ndGggfHwgIWluY2x1ZGVEaXNhYmxlZEFjdGlvbnMgJiYgIWFjdGlvbnMudmFsaWRBY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRcdE1lc3NhZ2VDb250cm9sbGVyLmdldCh0aGlzLl9lZGl0b3IpPy5zaG93TWVzc2FnZShuZXdTdGF0ZS50cmlnZ2VyLmNvbnRleHQubm90QXZhaWxhYmxlTWVzc2FnZSwgbmV3U3RhdGUudHJpZ2dlci5jb250ZXh0LnBvc2l0aW9uKTtcblx0XHRcdFx0XHR0aGlzLl9hY3RpdmVDb2RlQWN0aW9ucy52YWx1ZSA9IGFjdGlvbnM7XG5cdFx0XHRcdFx0YWN0aW9ucy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2FjdGl2ZUNvZGVBY3Rpb25zLnZhbHVlID0gYWN0aW9ucztcblx0XHRcdHRoaXMuc2hvd0NvZGVBY3Rpb25MaXN0KGFjdGlvbnMsIHRoaXMudG9Db29yZHMobmV3U3RhdGUucG9zaXRpb24pLCB7IGluY2x1ZGVEaXNhYmxlZEFjdGlvbnMsIGZyb21MaWdodGJ1bGI6IGZhbHNlIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBhdXRvIG1hZ2ljYWxseSB0cmlnZ2VyZWRcblx0XHRcdGlmICh0aGlzLl9hY3Rpb25XaWRnZXRTZXJ2aWNlLmlzVmlzaWJsZSkge1xuXHRcdFx0XHQvLyBUT0RPOiBGaWd1cmUgb3V0IGlmIHdlIHNob3VsZCB1cGRhdGUgdGhlIHNob3dpbmcgbWVudT9cblx0XHRcdFx0YWN0aW9ucy5kaXNwb3NlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9hY3RpdmVDb2RlQWN0aW9ucy52YWx1ZSA9IGFjdGlvbnM7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRJbnZhbGlkQWN0aW9uVGhhdFdvdWxkSGF2ZUJlZW5BcHBsaWVkKHRyaWdnZXI6IENvZGVBY3Rpb25UcmlnZ2VyLCBhY3Rpb25zOiBDb2RlQWN0aW9uU2V0KTogQ29kZUFjdGlvbkl0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGlmICghYWN0aW9ucy5hbGxBY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoKHRyaWdnZXIuYXV0b0FwcGx5ID09PSBDb2RlQWN0aW9uQXV0b0FwcGx5LkZpcnN0ICYmIGFjdGlvbnMudmFsaWRBY3Rpb25zLmxlbmd0aCA9PT0gMClcblx0XHRcdHx8ICh0cmlnZ2VyLmF1dG9BcHBseSA9PT0gQ29kZUFjdGlvbkF1dG9BcHBseS5JZlNpbmdsZSAmJiBhY3Rpb25zLmFsbEFjdGlvbnMubGVuZ3RoID09PSAxKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGFjdGlvbnMuYWxsQWN0aW9ucy5maW5kKCh7IGFjdGlvbiB9KSA9PiBhY3Rpb24uZGlzYWJsZWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHRyeUdldFZhbGlkQWN0aW9uVG9BcHBseSh0cmlnZ2VyOiBDb2RlQWN0aW9uVHJpZ2dlciwgYWN0aW9uczogQ29kZUFjdGlvblNldCk6IENvZGVBY3Rpb25JdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWFjdGlvbnMudmFsaWRBY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoKHRyaWdnZXIuYXV0b0FwcGx5ID09PSBDb2RlQWN0aW9uQXV0b0FwcGx5LkZpcnN0ICYmIGFjdGlvbnMudmFsaWRBY3Rpb25zLmxlbmd0aCA+IDApXG5cdFx0XHR8fCAodHJpZ2dlci5hdXRvQXBwbHkgPT09IENvZGVBY3Rpb25BdXRvQXBwbHkuSWZTaW5nbGUgJiYgYWN0aW9ucy52YWxpZEFjdGlvbnMubGVuZ3RoID09PSAxKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGFjdGlvbnMudmFsaWRBY3Rpb25zWzBdO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUNPUkFUSU9OID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0ZGVzY3JpcHRpb246ICdxdWlja2ZpeC1oaWdobGlnaHQnLFxuXHRcdGNsYXNzTmFtZTogREVDT1JBVElPTl9DTEFTU19OQU1FXG5cdH0pO1xuXG5cdHB1YmxpYyBhc3luYyBzaG93Q29kZUFjdGlvbkxpc3QoYWN0aW9uczogQ29kZUFjdGlvblNldCwgYXQ6IElBbmNob3IgfCBJUG9zaXRpb24sIG9wdGlvbnM6IElBY3Rpb25TaG93T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgY3VycmVudERlY29yYXRpb25zID0gdGhpcy5fZWRpdG9yLmNyZWF0ZURlY29yYXRpb25zQ29sbGVjdGlvbigpO1xuXG5cdFx0Y29uc3QgZWRpdG9yRG9tID0gdGhpcy5fZWRpdG9yLmdldERvbU5vZGUoKTtcblx0XHRpZiAoIWVkaXRvckRvbSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGlvbnNUb1Nob3cgPSBvcHRpb25zLmluY2x1ZGVEaXNhYmxlZEFjdGlvbnMgJiYgKHRoaXMuX3Nob3dEaXNhYmxlZCB8fCBhY3Rpb25zLnZhbGlkQWN0aW9ucy5sZW5ndGggPT09IDApID8gYWN0aW9ucy5hbGxBY3Rpb25zIDogYWN0aW9ucy52YWxpZEFjdGlvbnM7XG5cdFx0aWYgKCFhY3Rpb25zVG9TaG93Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFuY2hvciA9IFBvc2l0aW9uLmlzSVBvc2l0aW9uKGF0KSA/IHRoaXMudG9Db29yZHMoYXQpIDogYXQ7XG5cblx0XHRjb25zdCBkZWxlZ2F0ZTogSUFjdGlvbkxpc3REZWxlZ2F0ZTxDb2RlQWN0aW9uSXRlbT4gPSB7XG5cdFx0XHRvblNlbGVjdDogYXN5bmMgKGFjdGlvbjogQ29kZUFjdGlvbkl0ZW0sIHByZXZpZXc/OiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdHRoaXMuYXBwbHlDb2RlQWN0aW9uKGFjdGlvbiwgLyogcmV0cmlnZ2VyICovIHRydWUsICEhcHJldmlldywgb3B0aW9ucy5mcm9tTGlnaHRidWxiID8gQXBwbHlDb2RlQWN0aW9uUmVhc29uLkZyb21BSUxpZ2h0YnVsYiA6IEFwcGx5Q29kZUFjdGlvblJlYXNvbi5Gcm9tQ29kZUFjdGlvbnMpO1xuXHRcdFx0XHR0aGlzLl9hY3Rpb25XaWRnZXRTZXJ2aWNlLmhpZGUoZmFsc2UpO1xuXHRcdFx0XHRjdXJyZW50RGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRcdH0sXG5cdFx0XHRvbkhpZGU6IChkaWRDYW5jZWw/KSA9PiB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvcj8uZm9jdXMoKTtcblx0XHRcdFx0Y3VycmVudERlY29yYXRpb25zLmNsZWFyKCk7XG5cdFx0XHR9LFxuXHRcdFx0b25Ib3ZlcjogYXN5bmMgKGFjdGlvbjogQ29kZUFjdGlvbkl0ZW0sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4ge1xuXHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgY2FuUHJldmlldyA9IGZhbHNlO1xuXHRcdFx0XHRjb25zdCBhY3Rpb25LaW5kID0gYWN0aW9uLmFjdGlvbi5raW5kO1xuXG5cdFx0XHRcdGlmIChhY3Rpb25LaW5kKSB7XG5cdFx0XHRcdFx0Y29uc3QgaGllcmFyY2hpY2FsS2luZCA9IG5ldyBIaWVyYXJjaGljYWxLaW5kKGFjdGlvbktpbmQpO1xuXHRcdFx0XHRcdGNvbnN0IHJlZmFjdG9yS2luZHMgPSBbXG5cdFx0XHRcdFx0XHRDb2RlQWN0aW9uS2luZC5SZWZhY3RvckV4dHJhY3QsXG5cdFx0XHRcdFx0XHRDb2RlQWN0aW9uS2luZC5SZWZhY3RvcklubGluZSxcblx0XHRcdFx0XHRcdENvZGVBY3Rpb25LaW5kLlJlZmFjdG9yUmV3cml0ZSxcblx0XHRcdFx0XHRcdENvZGVBY3Rpb25LaW5kLlJlZmFjdG9yTW92ZSxcblx0XHRcdFx0XHRcdENvZGVBY3Rpb25LaW5kLlNvdXJjZVxuXHRcdFx0XHRcdF07XG5cblx0XHRcdFx0XHRjYW5QcmV2aWV3ID0gcmVmYWN0b3JLaW5kcy5zb21lKHJlZmFjdG9yS2luZCA9PiByZWZhY3RvcktpbmQuY29udGFpbnMoaGllcmFyY2hpY2FsS2luZCkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHsgY2FuUHJldmlldzogY2FuUHJldmlldyB8fCAhIWFjdGlvbi5hY3Rpb24uZWRpdD8uZWRpdHMubGVuZ3RoIH07XG5cdFx0XHR9LFxuXHRcdFx0b25Gb2N1czogKGFjdGlvbjogQ29kZUFjdGlvbkl0ZW0gfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbiAmJiBhY3Rpb24uYWN0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmFuZ2VzID0gYWN0aW9uLmFjdGlvbi5yYW5nZXM7XG5cdFx0XHRcdFx0Y29uc3QgZGlhZ25vc3RpY3MgPSBhY3Rpb24uYWN0aW9uLmRpYWdub3N0aWNzO1xuXHRcdFx0XHRcdGN1cnJlbnREZWNvcmF0aW9ucy5jbGVhcigpO1xuXHRcdFx0XHRcdGlmIChyYW5nZXMgJiYgcmFuZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdC8vIEhhbmRsZXMgY2FzZSBmb3IgYGZpeCBhbGxgIHdoZXJlIHRoZXJlIGFyZSBtdWx0aXBsZSBkaWFnbm9zdGljcy5cblx0XHRcdFx0XHRcdGNvbnN0IGRlY29yYXRpb25zOiBJTW9kZWxEZWx0YURlY29yYXRpb25bXSA9IChkaWFnbm9zdGljcyAmJiBkaWFnbm9zdGljcz8ubGVuZ3RoID4gMSlcblx0XHRcdFx0XHRcdFx0PyBkaWFnbm9zdGljcy5tYXAoZGlhZ25vc3RpYyA9PiAoeyByYW5nZTogZGlhZ25vc3RpYywgb3B0aW9uczogQ29kZUFjdGlvbkNvbnRyb2xsZXIuREVDT1JBVElPTiB9KSlcblx0XHRcdFx0XHRcdFx0OiByYW5nZXMubWFwKHJhbmdlID0+ICh7IHJhbmdlLCBvcHRpb25zOiBDb2RlQWN0aW9uQ29udHJvbGxlci5ERUNPUkFUSU9OIH0pKTtcblx0XHRcdFx0XHRcdGN1cnJlbnREZWNvcmF0aW9ucy5zZXQoZGVjb3JhdGlvbnMpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZGlhZ25vc3RpY3MgJiYgZGlhZ25vc3RpY3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gZGlhZ25vc3RpY3MubWFwKGRpYWdub3N0aWMgPT4gKHsgcmFuZ2U6IGRpYWdub3N0aWMsIG9wdGlvbnM6IENvZGVBY3Rpb25Db250cm9sbGVyLkRFQ09SQVRJT04gfSkpO1xuXHRcdFx0XHRcdFx0Y3VycmVudERlY29yYXRpb25zLnNldChkZWNvcmF0aW9ucyk7XG5cdFx0XHRcdFx0XHRjb25zdCBkaWFnbm9zdGljID0gZGlhZ25vc3RpY3NbMF07XG5cdFx0XHRcdFx0XHRpZiAoZGlhZ25vc3RpYy5zdGFydExpbmVOdW1iZXIgJiYgZGlhZ25vc3RpYy5zdGFydENvbHVtbikge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzZWxlY3Rpb25UZXh0ID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk/LmdldFdvcmRBdFBvc2l0aW9uKHsgbGluZU51bWJlcjogZGlhZ25vc3RpYy5zdGFydExpbmVOdW1iZXIsIGNvbHVtbjogZGlhZ25vc3RpYy5zdGFydENvbHVtbiB9KT8ud29yZDtcblx0XHRcdFx0XHRcdFx0YXJpYS5zdGF0dXMobG9jYWxpemUoJ2VkaXRpbmdOZXdTZWxlY3Rpb24nLCBcIkNvbnRleHQ6IHswfSBhdCBsaW5lIHsxfSBhbmQgY29sdW1uIHsyfS5cIiwgc2VsZWN0aW9uVGV4dCwgZGlhZ25vc3RpYy5zdGFydExpbmVOdW1iZXIsIGRpYWdub3N0aWMuc3RhcnRDb2x1bW4pKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y3VycmVudERlY29yYXRpb25zLmNsZWFyKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fYWN0aW9uV2lkZ2V0U2VydmljZS5zaG93KFxuXHRcdFx0J2NvZGVBY3Rpb25XaWRnZXQnLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHRvTWVudUl0ZW1zKGFjdGlvbnNUb1Nob3csIHRoaXMuX3Nob3VsZFNob3dIZWFkZXJzKCksIHRoaXMuX3Jlc29sdmVyLmdldFJlc29sdmVyKCkpLFxuXHRcdFx0ZGVsZWdhdGUsXG5cdFx0XHRhbmNob3IsXG5cdFx0XHRlZGl0b3JEb20sXG5cdFx0XHR0aGlzLl9nZXRBY3Rpb25CYXJBY3Rpb25zKGFjdGlvbnMsIGF0LCBvcHRpb25zKSk7XG5cdH1cblxuXHRwcml2YXRlIHRvQ29vcmRzKHBvc2l0aW9uOiBJUG9zaXRpb24pOiBJQW5jaG9yIHtcblx0XHRpZiAoIXRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4geyB4OiAwLCB5OiAwIH07XG5cdFx0fVxuXG5cdFx0dGhpcy5fZWRpdG9yLnJldmVhbFBvc2l0aW9uKHBvc2l0aW9uLCBTY3JvbGxUeXBlLkltbWVkaWF0ZSk7XG5cdFx0dGhpcy5fZWRpdG9yLnJlbmRlcigpO1xuXG5cdFx0Ly8gVHJhbnNsYXRlIHRvIGFic29sdXRlIGVkaXRvciBwb3NpdGlvblxuXHRcdGNvbnN0IGN1cnNvckNvb3JkcyA9IHRoaXMuX2VkaXRvci5nZXRTY3JvbGxlZFZpc2libGVQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0Y29uc3QgZWRpdG9yQ29vcmRzID0gZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLl9lZGl0b3IuZ2V0RG9tTm9kZSgpKTtcblx0XHRjb25zdCB4ID0gZWRpdG9yQ29vcmRzLmxlZnQgKyBjdXJzb3JDb29yZHMubGVmdDtcblx0XHRjb25zdCB5ID0gZWRpdG9yQ29vcmRzLnRvcCArIGN1cnNvckNvb3Jkcy50b3AgKyBjdXJzb3JDb29yZHMuaGVpZ2h0O1xuXG5cdFx0cmV0dXJuIHsgeCwgeSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfc2hvdWxkU2hvd0hlYWRlcnMoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3I/LmdldE1vZGVsKCk7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3IuY29kZUFjdGlvbldpZGdldC5zaG93SGVhZGVycycsIHsgcmVzb3VyY2U6IG1vZGVsPy51cmkgfSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRBY3Rpb25CYXJBY3Rpb25zKGFjdGlvbnM6IENvZGVBY3Rpb25TZXQsIGF0OiBJQW5jaG9yIHwgSVBvc2l0aW9uLCBvcHRpb25zOiBJQWN0aW9uU2hvd09wdGlvbnMpOiBJQWN0aW9uW10ge1xuXHRcdGlmIChvcHRpb25zLmZyb21MaWdodGJ1bGIpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHRBY3Rpb25zID0gYWN0aW9ucy5kb2N1bWVudGF0aW9uLm1hcCgoY29tbWFuZCk6IElBY3Rpb24gPT4gKHtcblx0XHRcdGlkOiBjb21tYW5kLmlkLFxuXHRcdFx0bGFiZWw6IGNvbW1hbmQudGl0bGUsXG5cdFx0XHR0b29sdGlwOiBjb21tYW5kLnRvb2x0aXAgPz8gJycsXG5cdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdHJ1bjogKCkgPT4gdGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZC5pZCwgLi4uKGNvbW1hbmQuYXJndW1lbnRzID8/IFtdKSksXG5cdFx0fSkpO1xuXG5cdFx0aWYgKG9wdGlvbnMuaW5jbHVkZURpc2FibGVkQWN0aW9ucyAmJiBhY3Rpb25zLnZhbGlkQWN0aW9ucy5sZW5ndGggPiAwICYmIGFjdGlvbnMuYWxsQWN0aW9ucy5sZW5ndGggIT09IGFjdGlvbnMudmFsaWRBY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0cmVzdWx0QWN0aW9ucy5wdXNoKHRoaXMuX3Nob3dEaXNhYmxlZCA/IHtcblx0XHRcdFx0aWQ6ICdoaWRlTW9yZUFjdGlvbnMnLFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2hpZGVNb3JlQWN0aW9ucycsICdIaWRlIERpc2FibGVkJyksXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9zaG93RGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zaG93Q29kZUFjdGlvbkxpc3QoYWN0aW9ucywgYXQsIG9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IDoge1xuXHRcdFx0XHRpZDogJ3Nob3dNb3JlQWN0aW9ucycsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2hvd01vcmVBY3Rpb25zJywgJ1Nob3cgRGlzYWJsZWQnKSxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX3Nob3dEaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2hvd0NvZGVBY3Rpb25MaXN0KGFjdGlvbnMsIGF0LCBvcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdEFjdGlvbnM7XG5cdH1cbn1cblxucmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQoKHRoZW1lLCBjb2xsZWN0b3IpID0+IHtcblx0Y29uc3QgYWRkQmFja2dyb3VuZENvbG9yUnVsZSA9IChzZWxlY3Rvcjogc3RyaW5nLCBjb2xvcjogQ29sb3IgfCB1bmRlZmluZWQpOiB2b2lkID0+IHtcblx0XHRpZiAoY29sb3IpIHtcblx0XHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLWVkaXRvciAke3NlbGVjdG9yfSB7IGJhY2tncm91bmQtY29sb3I6ICR7Y29sb3J9OyB9YCk7XG5cdFx0fVxuXHR9O1xuXG5cdGFkZEJhY2tncm91bmRDb2xvclJ1bGUoJy5xdWlja2ZpeC1lZGl0LWhpZ2hsaWdodCcsIHRoZW1lLmdldENvbG9yKGVkaXRvckZpbmRNYXRjaEhpZ2hsaWdodCkpO1xuXHRjb25zdCBmaW5kTWF0Y2hIaWdobGlnaHRCb3JkZXIgPSB0aGVtZS5nZXRDb2xvcihlZGl0b3JGaW5kTWF0Y2hIaWdobGlnaHRCb3JkZXIpO1xuXG5cdGlmIChmaW5kTWF0Y2hIaWdobGlnaHRCb3JkZXIpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1lZGl0b3IgLnF1aWNrZml4LWVkaXQtaGlnaGxpZ2h0IHsgYm9yZGVyOiAxcHggJHtpc0hpZ2hDb250cmFzdCh0aGVtZS50eXBlKSA/ICdkb3R0ZWQnIDogJ3NvbGlkJ30gJHtmaW5kTWF0Y2hIaWdobGlnaHRCb3JkZXJ9OyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9YCk7XG5c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
