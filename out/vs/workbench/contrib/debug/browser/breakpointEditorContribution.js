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
import { isSafari } from "../../../../base/browser/browser.js";
import { BrowserFeatures } from "../../../../base/browser/canIUse.js";
import * as dom from "../../../../base/browser/dom.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { Action, Separator, SubmenuAction } from "../../../../base/common/actions.js";
import { distinct } from "../../../../base/common/arrays.js";
import { RunOnceScheduler, timeout } from "../../../../base/common/async.js";
import { memoize } from "../../../../base/common/decorators.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { dispose, disposeIfDisposable } from "../../../../base/common/lifecycle.js";
import * as env from "../../../../base/common/platform.js";
import severity from "../../../../base/common/severity.js";
import { noBreakWhitespace } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ContentWidgetPositionPreference, MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { GlyphMarginLane, OverviewRulerLane, TrackedRangeStickiness } from "../../../../editor/common/model.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { registerThemingParticipant, themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { GutterActionsRegistry } from "../../codeEditor/browser/editorLineNumberMenu.js";
import { getBreakpointMessageAndIcon } from "./breakpointsView.js";
import { BreakpointWidget } from "./breakpointWidget.js";
import * as icons from "./debugIcons.js";
import { BREAKPOINT_EDITOR_CONTRIBUTION_ID, BreakpointWidgetContext, CONTEXT_BREAKPOINT_WIDGET_VISIBLE, DebuggerString, IDebugService, State } from "../common/debug.js";
const $ = dom.$;
const breakpointHelperDecoration = {
  description: "breakpoint-helper-decoration",
  glyphMarginClassName: ThemeIcon.asClassName(icons.debugBreakpointHint),
  glyphMargin: { position: GlyphMarginLane.Right },
  glyphMarginHoverMessage: new MarkdownString().appendText(nls.localize("breakpointHelper", "Click to add a breakpoint")),
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
};
function createBreakpointDecorations(accessor, model, breakpoints, state, breakpointsActivated, showBreakpointsInOverviewRuler) {
  const result = [];
  breakpoints.forEach((breakpoint) => {
    if (breakpoint.lineNumber > model.getLineCount()) {
      return;
    }
    const hasOtherBreakpointsOnLine = breakpoints.some((bp) => bp !== breakpoint && bp.lineNumber === breakpoint.lineNumber);
    const column = model.getLineFirstNonWhitespaceColumn(breakpoint.lineNumber);
    const range = model.validateRange(
      breakpoint.column ? new Range(breakpoint.lineNumber, breakpoint.column, breakpoint.lineNumber, breakpoint.column + 1) : new Range(breakpoint.lineNumber, column, breakpoint.lineNumber, column + 1)
      // Decoration has to have a width #20688
    );
    result.push({
      options: getBreakpointDecorationOptions(accessor, model, breakpoint, state, breakpointsActivated, showBreakpointsInOverviewRuler, hasOtherBreakpointsOnLine),
      range
    });
  });
  return result;
}
function getBreakpointDecorationOptions(accessor, model, breakpoint, state, breakpointsActivated, showBreakpointsInOverviewRuler, hasOtherBreakpointsOnLine) {
  const debugService = accessor.get(IDebugService);
  const languageService = accessor.get(ILanguageService);
  const labelService = accessor.get(ILabelService);
  const { icon, message, showAdapterUnverifiedMessage } = getBreakpointMessageAndIcon(state, breakpointsActivated, breakpoint, labelService, debugService.getModel());
  let glyphMarginHoverMessage;
  let unverifiedMessage;
  if (showAdapterUnverifiedMessage) {
    let langId;
    unverifiedMessage = debugService.getModel().getSessions().map((s) => {
      const dbg = debugService.getAdapterManager().getDebugger(s.configuration.type);
      const message2 = dbg?.strings?.[DebuggerString.UnverifiedBreakpoints];
      if (message2) {
        if (!langId) {
          langId = languageService.guessLanguageIdByFilepathOrFirstLine(breakpoint.uri) ?? void 0;
        }
        return langId && dbg.interestedInLanguage(langId) ? message2 : void 0;
      }
      return void 0;
    }).find((messages) => !!messages);
  }
  if (message) {
    glyphMarginHoverMessage = new MarkdownString(void 0, { isTrusted: true, supportThemeIcons: true });
    if (breakpoint.condition || breakpoint.hitCondition) {
      const languageId = model.getLanguageId();
      glyphMarginHoverMessage.appendCodeblock(languageId, message);
      if (unverifiedMessage) {
        glyphMarginHoverMessage.appendMarkdown("$(warning) " + unverifiedMessage);
      }
    } else {
      glyphMarginHoverMessage.appendText(message);
      if (unverifiedMessage) {
        glyphMarginHoverMessage.appendMarkdown("\n\n$(warning) " + unverifiedMessage);
      }
    }
  } else if (unverifiedMessage) {
    glyphMarginHoverMessage = new MarkdownString(void 0, { isTrusted: true, supportThemeIcons: true }).appendMarkdown(unverifiedMessage);
  }
  let overviewRulerDecoration = null;
  if (showBreakpointsInOverviewRuler) {
    overviewRulerDecoration = {
      color: themeColorFromId(debugIconBreakpointForeground),
      position: OverviewRulerLane.Left
    };
  }
  const renderInline = breakpoint.column && (hasOtherBreakpointsOnLine || breakpoint.column > model.getLineFirstNonWhitespaceColumn(breakpoint.lineNumber));
  return {
    description: "breakpoint-decoration",
    glyphMargin: { position: GlyphMarginLane.Right },
    glyphMarginClassName: ThemeIcon.asClassName(icon),
    glyphMarginHoverMessage,
    stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    before: renderInline ? {
      content: noBreakWhitespace,
      inlineClassName: `debug-breakpoint-placeholder`,
      inlineClassNameAffectsLetterSpacing: true
    } : void 0,
    overviewRuler: overviewRulerDecoration,
    zIndex: 9999
  };
}
async function requestBreakpointCandidateLocations(model, lineNumbers, session) {
  if (!session.capabilities.supportsBreakpointLocationsRequest) {
    return [];
  }
  return await Promise.all(distinct(lineNumbers, (l) => l).map(async (lineNumber) => {
    try {
      return { lineNumber, positions: await session.breakpointsLocations(model.uri, lineNumber) };
    } catch {
      return { lineNumber, positions: [] };
    }
  }));
}
function createCandidateDecorations(model, breakpointDecorations, lineBreakpoints) {
  const result = [];
  for (const { positions, lineNumber } of lineBreakpoints) {
    if (positions.length === 0) {
      continue;
    }
    const firstColumn = model.getLineFirstNonWhitespaceColumn(lineNumber);
    const lastColumn = model.getLineLastNonWhitespaceColumn(lineNumber);
    positions.forEach((p) => {
      const range = new Range(p.lineNumber, p.column, p.lineNumber, p.column + 1);
      if (p.column <= firstColumn && !breakpointDecorations.some((bp) => bp.range.startColumn > firstColumn && bp.range.startLineNumber === p.lineNumber) || p.column > lastColumn) {
        return;
      }
      const breakpointAtPosition = breakpointDecorations.find((bpd) => bpd.range.equalsRange(range));
      if (breakpointAtPosition && breakpointAtPosition.inlineWidget) {
        return;
      }
      result.push({
        range,
        options: {
          description: "breakpoint-placeholder-decoration",
          stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          before: breakpointAtPosition ? void 0 : {
            content: noBreakWhitespace,
            inlineClassName: `debug-breakpoint-placeholder`,
            inlineClassNameAffectsLetterSpacing: true
          }
        },
        breakpoint: breakpointAtPosition ? breakpointAtPosition.breakpoint : void 0
      });
    });
  }
  return result;
}
let BreakpointEditorContribution = class {
  constructor(editor, debugService, contextMenuService, instantiationService, contextKeyService, dialogService, configurationService, labelService) {
    this.editor = editor;
    this.debugService = debugService;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.dialogService = dialogService;
    this.configurationService = configurationService;
    this.labelService = labelService;
    this.breakpointHintDecoration = null;
    this.toDispose = [];
    this.ignoreDecorationsChangedEvent = false;
    this.ignoreBreakpointsChangeEvent = false;
    this.breakpointDecorations = [];
    this.candidateDecorations = [];
    this.breakpointWidgetVisible = CONTEXT_BREAKPOINT_WIDGET_VISIBLE.bindTo(contextKeyService);
    this.setDecorationsScheduler = new RunOnceScheduler(() => this.setDecorations(), 30);
    this.setDecorationsScheduler.schedule();
    this.registerListeners();
  }
  /**
   * Returns context menu actions at the line number if breakpoints can be
   * set. This is used by the {@link TestingDecorations} to allow breakpoint
   * setting on lines where breakpoint "run" actions are present.
   */
  getContextMenuActionsAtPosition(lineNumber, model) {
    if (!this.debugService.getAdapterManager().hasEnabledDebuggers()) {
      return [];
    }
    if (!this.debugService.canSetBreakpointsIn(model)) {
      return [];
    }
    const breakpoints = this.debugService.getModel().getBreakpoints({ lineNumber, uri: model.uri });
    return this.getContextMenuActions(breakpoints, model.uri, lineNumber);
  }
  registerListeners() {
    this.toDispose.push(this.editor.onMouseDown(async (e) => {
      if (!this.debugService.getAdapterManager().hasEnabledDebuggers()) {
        return;
      }
      const model = this.editor.getModel();
      if (!e.target.position || !model || e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.detail.isAfterLines || !this.marginFreeFromNonDebugDecorations(e.target.position.lineNumber) && !e.target.element?.className.includes("breakpoint")) {
        return;
      }
      const canSetBreakpoints = this.debugService.canSetBreakpointsIn(model);
      const lineNumber = e.target.position.lineNumber;
      const uri = model.uri;
      if (e.event.rightButton || env.isMacintosh && e.event.leftButton && e.event.ctrlKey) {
        return;
      } else {
        const breakpoints = this.debugService.getModel().getBreakpoints({ uri, lineNumber });
        if (breakpoints.length) {
          const isShiftPressed = e.event.shiftKey;
          const enabled = breakpoints.some((bp) => bp.enabled);
          if (isShiftPressed) {
            breakpoints.forEach((bp) => this.debugService.enableOrDisableBreakpoints(!enabled, bp));
          } else if (!env.isLinux && breakpoints.some((bp) => !!bp.condition || !!bp.logMessage || !!bp.hitCondition || !!bp.triggeredBy)) {
            const logPoint = breakpoints.every((bp) => !!bp.logMessage);
            const breakpointType = logPoint ? nls.localize("logPoint", "Logpoint") : nls.localize("breakpoint", "Breakpoint");
            const disabledBreakpointDialogMessage = nls.localize(
              "breakpointHasConditionDisabled",
              "This {0} has a {1} that will get lost on remove. Consider enabling the {0} instead.",
              breakpointType.toLowerCase(),
              logPoint ? nls.localize("message", "message") : nls.localize("condition", "condition")
            );
            const enabledBreakpointDialogMessage = nls.localize(
              "breakpointHasConditionEnabled",
              "This {0} has a {1} that will get lost on remove. Consider disabling the {0} instead.",
              breakpointType.toLowerCase(),
              logPoint ? nls.localize("message", "message") : nls.localize("condition", "condition")
            );
            await this.dialogService.prompt({
              type: severity.Info,
              message: enabled ? enabledBreakpointDialogMessage : disabledBreakpointDialogMessage,
              buttons: [
                {
                  label: nls.localize({ key: "removeLogPoint", comment: ["&& denotes a mnemonic"] }, "&&Remove {0}", breakpointType),
                  run: () => breakpoints.forEach((bp) => this.debugService.removeBreakpoints(bp.getId()))
                },
                {
                  label: nls.localize("disableLogPoint", "{0} {1}", enabled ? nls.localize({ key: "disable", comment: ["&& denotes a mnemonic"] }, "&&Disable") : nls.localize({ key: "enable", comment: ["&& denotes a mnemonic"] }, "&&Enable"), breakpointType),
                  run: () => breakpoints.forEach((bp) => this.debugService.enableOrDisableBreakpoints(!enabled, bp))
                }
              ],
              cancelButton: true
            });
          } else {
            if (!enabled) {
              breakpoints.forEach((bp) => this.debugService.enableOrDisableBreakpoints(!enabled, bp));
            } else {
              breakpoints.forEach((bp) => this.debugService.removeBreakpoints(bp.getId()));
            }
          }
        } else if (canSetBreakpoints) {
          if (e.event.middleButton) {
            const action = this.configurationService.getValue("debug").gutterMiddleClickAction;
            if (action !== "none") {
              let context;
              switch (action) {
                case "logpoint":
                  context = BreakpointWidgetContext.LOG_MESSAGE;
                  break;
                case "conditionalBreakpoint":
                  context = BreakpointWidgetContext.CONDITION;
                  break;
                case "triggeredBreakpoint":
                  context = BreakpointWidgetContext.TRIGGER_POINT;
              }
              this.showBreakpointWidget(lineNumber, void 0, context);
            }
          } else {
            this.debugService.addBreakpoints(uri, [{ lineNumber }]);
          }
        }
      }
    }));
    if (!(BrowserFeatures.pointerEvents && isSafari)) {
      this.toDispose.push(this.editor.onMouseMove((e) => {
        if (!this.debugService.getAdapterManager().hasEnabledDebuggers()) {
          return;
        }
        let showBreakpointHintAtLineNumber = -1;
        const model = this.editor.getModel();
        if (model && e.target.position && (e.target.type === MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.type === MouseTargetType.GUTTER_LINE_NUMBERS) && this.debugService.canSetBreakpointsIn(model) && this.marginFreeFromNonDebugDecorations(e.target.position.lineNumber)) {
          const data = e.target.detail;
          if (!data.isAfterLines) {
            showBreakpointHintAtLineNumber = e.target.position.lineNumber;
          }
        }
        this.ensureBreakpointHintDecoration(showBreakpointHintAtLineNumber);
      }));
      this.toDispose.push(this.editor.onMouseLeave(() => {
        this.ensureBreakpointHintDecoration(-1);
      }));
    }
    this.toDispose.push(this.editor.onDidChangeModel(async () => {
      this.closeBreakpointWidget();
      await this.setDecorations();
    }));
    this.toDispose.push(this.debugService.getModel().onDidChangeBreakpoints(() => {
      if (!this.ignoreBreakpointsChangeEvent && !this.setDecorationsScheduler.isScheduled()) {
        this.setDecorationsScheduler.schedule();
      }
    }));
    this.toDispose.push(this.debugService.onDidChangeState(() => {
      if (!this.setDecorationsScheduler.isScheduled()) {
        this.setDecorationsScheduler.schedule();
      }
    }));
    this.toDispose.push(this.editor.onDidChangeModelDecorations(() => this.onModelDecorationsChanged()));
    this.toDispose.push(this.configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("debug.showBreakpointsInOverviewRuler") || e.affectsConfiguration("debug.showInlineBreakpointCandidates")) {
        await this.setDecorations();
      }
    }));
  }
  getContextMenuActions(breakpoints, uri, lineNumber, column) {
    const actions = [];
    if (breakpoints.length === 1) {
      const breakpointType = breakpoints[0].logMessage ? nls.localize("logPoint", "Logpoint") : nls.localize("breakpoint", "Breakpoint");
      actions.push(new Action("debug.removeBreakpoint", nls.localize("removeBreakpoint", "Remove {0}", breakpointType), void 0, true, async () => {
        await this.debugService.removeBreakpoints(breakpoints[0].getId());
      }));
      actions.push(new Action(
        "workbench.debug.action.editBreakpointAction",
        nls.localize("editBreakpoint", "Edit {0}...", breakpointType),
        void 0,
        true,
        () => Promise.resolve(this.showBreakpointWidget(breakpoints[0].lineNumber, breakpoints[0].column))
      ));
      actions.push(new Action(
        `workbench.debug.viewlet.action.toggleBreakpoint`,
        breakpoints[0].enabled ? nls.localize("disableBreakpoint", "Disable {0}", breakpointType) : nls.localize("enableBreakpoint", "Enable {0}", breakpointType),
        void 0,
        true,
        () => this.debugService.enableOrDisableBreakpoints(!breakpoints[0].enabled, breakpoints[0])
      ));
    } else if (breakpoints.length > 1) {
      const sorted = breakpoints.slice().sort((first, second) => first.column && second.column ? first.column - second.column : 1);
      actions.push(new SubmenuAction("debug.removeBreakpoints", nls.localize("removeBreakpoints", "Remove Breakpoints"), sorted.map((bp) => new Action(
        "removeInlineBreakpoint",
        bp.column ? nls.localize("removeInlineBreakpointOnColumn", "Remove Inline Breakpoint on Column {0}", bp.column) : nls.localize("removeLineBreakpoint", "Remove Line Breakpoint"),
        void 0,
        true,
        () => this.debugService.removeBreakpoints(bp.getId())
      ))));
      actions.push(new SubmenuAction("debug.editBreakpoints", nls.localize("editBreakpoints", "Edit Breakpoints"), sorted.map(
        (bp) => new Action(
          "editBreakpoint",
          bp.column ? nls.localize("editInlineBreakpointOnColumn", "Edit Inline Breakpoint on Column {0}", bp.column) : nls.localize("editLineBreakpoint", "Edit Line Breakpoint"),
          void 0,
          true,
          () => Promise.resolve(this.showBreakpointWidget(bp.lineNumber, bp.column))
        )
      )));
      actions.push(new SubmenuAction("debug.enableDisableBreakpoints", nls.localize("enableDisableBreakpoints", "Enable/Disable Breakpoints"), sorted.map((bp) => new Action(
        bp.enabled ? "disableColumnBreakpoint" : "enableColumnBreakpoint",
        bp.enabled ? bp.column ? nls.localize("disableInlineColumnBreakpoint", "Disable Inline Breakpoint on Column {0}", bp.column) : nls.localize("disableBreakpointOnLine", "Disable Line Breakpoint") : bp.column ? nls.localize("enableBreakpoints", "Enable Inline Breakpoint on Column {0}", bp.column) : nls.localize("enableBreakpointOnLine", "Enable Line Breakpoint"),
        void 0,
        true,
        () => this.debugService.enableOrDisableBreakpoints(!bp.enabled, bp)
      ))));
    } else {
      actions.push(new Action(
        "addBreakpoint",
        nls.localize("addBreakpoint", "Add Breakpoint"),
        void 0,
        true,
        () => this.debugService.addBreakpoints(uri, [{ lineNumber, column }])
      ));
      actions.push(new Action(
        "addConditionalBreakpoint",
        nls.localize("addConditionalBreakpoint", "Add Conditional Breakpoint..."),
        void 0,
        true,
        () => Promise.resolve(this.showBreakpointWidget(lineNumber, column, BreakpointWidgetContext.CONDITION))
      ));
      actions.push(new Action(
        "addLogPoint",
        nls.localize("addLogPoint", "Add Logpoint..."),
        void 0,
        true,
        () => Promise.resolve(this.showBreakpointWidget(lineNumber, column, BreakpointWidgetContext.LOG_MESSAGE))
      ));
      actions.push(new Action(
        "addTriggeredBreakpoint",
        nls.localize("addTriggeredBreakpoint", "Add Triggered Breakpoint..."),
        void 0,
        true,
        () => Promise.resolve(this.showBreakpointWidget(lineNumber, column, BreakpointWidgetContext.TRIGGER_POINT))
      ));
    }
    if (this.debugService.state === State.Stopped) {
      actions.push(new Separator());
      actions.push(new Action(
        "runToLine",
        nls.localize("runToLine", "Run to Line"),
        void 0,
        true,
        () => this.debugService.runTo(uri, lineNumber).catch(onUnexpectedError)
      ));
    }
    return actions;
  }
  marginFreeFromNonDebugDecorations(line) {
    const decorations = this.editor.getLineDecorations(line);
    if (decorations) {
      for (const { options } of decorations) {
        const clz = options.glyphMarginClassName;
        if (!clz) {
          continue;
        }
        const hasSomeActionableCodicon = !(clz.includes("codicon-") || clz.startsWith("coverage-deco-")) || clz.includes("codicon-testing-") || clz.includes("codicon-merge-") || clz.includes("codicon-arrow-") || clz.includes("codicon-loading") || clz.includes("codicon-fold") || clz.includes("codicon-gutter-lightbulb") || clz.includes("codicon-lightbulb-sparkle");
        if (hasSomeActionableCodicon) {
          return false;
        }
      }
    }
    return true;
  }
  ensureBreakpointHintDecoration(showBreakpointHintAtLineNumber) {
    this.editor.changeDecorations((accessor) => {
      if (this.breakpointHintDecoration) {
        accessor.removeDecoration(this.breakpointHintDecoration);
        this.breakpointHintDecoration = null;
      }
      if (showBreakpointHintAtLineNumber !== -1) {
        this.breakpointHintDecoration = accessor.addDecoration(
          {
            startLineNumber: showBreakpointHintAtLineNumber,
            startColumn: 1,
            endLineNumber: showBreakpointHintAtLineNumber,
            endColumn: 1
          },
          breakpointHelperDecoration
        );
      }
    });
  }
  async setDecorations() {
    if (!this.editor.hasModel()) {
      return;
    }
    const setCandidateDecorations = (changeAccessor, desiredCandidatePositions2) => {
      const desiredCandidateDecorations = createCandidateDecorations(model, this.breakpointDecorations, desiredCandidatePositions2);
      const candidateDecorationIds = changeAccessor.deltaDecorations(this.candidateDecorations.map((c) => c.decorationId), desiredCandidateDecorations);
      this.candidateDecorations.forEach((candidate) => {
        candidate.inlineWidget.dispose();
      });
      this.candidateDecorations = candidateDecorationIds.map((decorationId, index) => {
        const candidate = desiredCandidateDecorations[index];
        const icon = candidate.breakpoint ? getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), candidate.breakpoint, this.labelService, this.debugService.getModel()).icon : icons.breakpoint.disabled;
        const contextMenuActions = () => this.getContextMenuActions(candidate.breakpoint ? [candidate.breakpoint] : [], activeCodeEditor.getModel().uri, candidate.range.startLineNumber, candidate.range.startColumn);
        const inlineWidget = new InlineBreakpointWidget(activeCodeEditor, decorationId, ThemeIcon.asClassName(icon), candidate.breakpoint, this.debugService, this.contextMenuService, contextMenuActions);
        return {
          decorationId,
          inlineWidget
        };
      });
    };
    const activeCodeEditor = this.editor;
    const model = activeCodeEditor.getModel();
    const breakpoints = this.debugService.getModel().getBreakpoints({ uri: model.uri });
    const debugSettings = this.configurationService.getValue("debug");
    const desiredBreakpointDecorations = this.instantiationService.invokeFunction((accessor) => createBreakpointDecorations(accessor, model, breakpoints, this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), debugSettings.showBreakpointsInOverviewRuler));
    const session = this.debugService.getViewModel().focusedSession;
    const desiredCandidatePositions = debugSettings.showInlineBreakpointCandidates && session ? requestBreakpointCandidateLocations(this.editor.getModel(), desiredBreakpointDecorations.map((bp) => bp.range.startLineNumber), session) : Promise.resolve([]);
    const desiredCandidatePositionsRaced = await Promise.race([desiredCandidatePositions, timeout(500).then(() => void 0)]);
    if (desiredCandidatePositionsRaced === void 0) {
      desiredCandidatePositions.then((v) => activeCodeEditor.changeDecorations((d) => setCandidateDecorations(d, v)));
    }
    try {
      this.ignoreDecorationsChangedEvent = true;
      activeCodeEditor.changeDecorations((changeAccessor) => {
        const decorationIds = changeAccessor.deltaDecorations(this.breakpointDecorations.map((bpd) => bpd.decorationId), desiredBreakpointDecorations);
        this.breakpointDecorations.forEach((bpd) => {
          bpd.inlineWidget?.dispose();
        });
        this.breakpointDecorations = decorationIds.map((decorationId, index) => {
          let inlineWidget = void 0;
          const breakpoint = breakpoints[index];
          if (desiredBreakpointDecorations[index].options.before) {
            const contextMenuActions = () => this.getContextMenuActions([breakpoint], activeCodeEditor.getModel().uri, breakpoint.lineNumber, breakpoint.column);
            inlineWidget = new InlineBreakpointWidget(activeCodeEditor, decorationId, desiredBreakpointDecorations[index].options.glyphMarginClassName, breakpoint, this.debugService, this.contextMenuService, contextMenuActions);
          }
          return {
            decorationId,
            breakpoint,
            range: desiredBreakpointDecorations[index].range,
            inlineWidget
          };
        });
        if (desiredCandidatePositionsRaced) {
          setCandidateDecorations(changeAccessor, desiredCandidatePositionsRaced);
        }
      });
    } finally {
      this.ignoreDecorationsChangedEvent = false;
    }
    for (const d of this.breakpointDecorations) {
      if (d.inlineWidget) {
        this.editor.layoutContentWidget(d.inlineWidget);
      }
    }
  }
  async onModelDecorationsChanged() {
    if (this.breakpointDecorations.length === 0 || this.ignoreDecorationsChangedEvent || !this.editor.hasModel()) {
      return;
    }
    let somethingChanged = false;
    const model = this.editor.getModel();
    this.breakpointDecorations.forEach((breakpointDecoration) => {
      if (somethingChanged) {
        return;
      }
      const newBreakpointRange = model.getDecorationRange(breakpointDecoration.decorationId);
      if (newBreakpointRange && !breakpointDecoration.range.equalsRange(newBreakpointRange)) {
        somethingChanged = true;
        breakpointDecoration.range = newBreakpointRange;
      }
    });
    if (!somethingChanged) {
      return;
    }
    const data = /* @__PURE__ */ new Map();
    for (let i = 0, len = this.breakpointDecorations.length; i < len; i++) {
      const breakpointDecoration = this.breakpointDecorations[i];
      const decorationRange = model.getDecorationRange(breakpointDecoration.decorationId);
      if (decorationRange) {
        if (breakpointDecoration.breakpoint) {
          data.set(breakpointDecoration.breakpoint.getId(), {
            lineNumber: decorationRange.startLineNumber,
            column: breakpointDecoration.breakpoint.column ? decorationRange.startColumn : void 0
          });
        }
      }
    }
    try {
      this.ignoreBreakpointsChangeEvent = true;
      await this.debugService.updateBreakpoints(model.uri, data, true);
    } finally {
      this.ignoreBreakpointsChangeEvent = false;
    }
  }
  // breakpoint widget
  showBreakpointWidget(lineNumber, column, context) {
    this.breakpointWidget?.dispose();
    this.breakpointWidget = this.instantiationService.createInstance(BreakpointWidget, this.editor, lineNumber, column, context);
    this.breakpointWidget.show({ lineNumber, column: 1 });
    this.breakpointWidgetVisible.set(true);
  }
  closeBreakpointWidget() {
    if (this.breakpointWidget) {
      this.breakpointWidget.dispose();
      this.breakpointWidget = void 0;
      this.breakpointWidgetVisible.reset();
      this.editor.focus();
    }
  }
  dispose() {
    this.breakpointWidget?.dispose();
    this.editor.removeDecorations(this.breakpointDecorations.map((bpd) => bpd.decorationId));
    dispose(this.toDispose);
  }
};
BreakpointEditorContribution = __decorateClass([
  __decorateParam(1, IDebugService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILabelService)
], BreakpointEditorContribution);
GutterActionsRegistry.registerGutterActionsGenerator(({ lineNumber, editor, accessor }, result) => {
  const model = editor.getModel();
  const debugService = accessor.get(IDebugService);
  if (!model || !debugService.getAdapterManager().hasEnabledDebuggers() || !debugService.canSetBreakpointsIn(model)) {
    return;
  }
  const breakpointEditorContribution = editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID);
  if (!breakpointEditorContribution) {
    return;
  }
  const actions = breakpointEditorContribution.getContextMenuActionsAtPosition(lineNumber, model);
  for (const action of actions) {
    result.push(action, "2_debug");
  }
});
class InlineBreakpointWidget {
  constructor(editor, decorationId, cssClass, breakpoint, debugService, contextMenuService, getContextMenuActions) {
    this.editor = editor;
    this.decorationId = decorationId;
    this.breakpoint = breakpoint;
    this.debugService = debugService;
    this.contextMenuService = contextMenuService;
    this.getContextMenuActions = getContextMenuActions;
    // editor.IContentWidget.allowEditorOverflow
    this.allowEditorOverflow = false;
    this.suppressMouseDown = true;
    this.toDispose = [];
    this.range = this.editor.getModel().getDecorationRange(decorationId);
    this.toDispose.push(this.editor.onDidChangeModelDecorations(() => {
      const model = this.editor.getModel();
      const range = model.getDecorationRange(this.decorationId);
      if (this.range && !this.range.equalsRange(range)) {
        this.range = range;
        this.editor.layoutContentWidget(this);
      }
    }));
    this.create(cssClass);
    this.editor.addContentWidget(this);
    this.editor.layoutContentWidget(this);
  }
  create(cssClass) {
    this.domNode = $(".inline-breakpoint-widget");
    if (cssClass) {
      this.domNode.classList.add(...cssClass.split(" "));
    }
    this.toDispose.push(dom.addDisposableListener(this.domNode, dom.EventType.CLICK, async (e) => {
      switch (this.breakpoint?.enabled) {
        case void 0:
          await this.debugService.addBreakpoints(this.editor.getModel().uri, [{ lineNumber: this.range.startLineNumber, column: this.range.startColumn }]);
          break;
        case true:
          await this.debugService.removeBreakpoints(this.breakpoint.getId());
          break;
        case false:
          this.debugService.enableOrDisableBreakpoints(true, this.breakpoint);
          break;
      }
    }));
    this.toDispose.push(dom.addDisposableListener(this.domNode, dom.EventType.CONTEXT_MENU, (e) => {
      const event = new StandardMouseEvent(dom.getWindow(this.domNode), e);
      const actions = this.getContextMenuActions();
      this.contextMenuService.showContextMenu({
        getAnchor: () => event,
        getActions: () => actions,
        getActionsContext: () => this.breakpoint,
        onHide: () => disposeIfDisposable(actions)
      });
    }));
    const updateSize = () => {
      const lineHeight = this.editor.getOption(EditorOption.lineHeight);
      this.domNode.style.height = `${lineHeight}px`;
      this.domNode.style.width = `${Math.ceil(0.8 * lineHeight)}px`;
      this.domNode.style.marginLeft = `4px`;
    };
    updateSize();
    this.toDispose.push(this.editor.onDidChangeConfiguration((c) => {
      if (c.hasChanged(EditorOption.fontSize) || c.hasChanged(EditorOption.lineHeight)) {
        updateSize();
      }
    }));
  }
  getId() {
    return generateUuid();
  }
  getDomNode() {
    return this.domNode;
  }
  getPosition() {
    if (!this.range) {
      return null;
    }
    this.domNode.classList.toggle("line-start", this.range.startColumn === 1);
    return {
      position: { lineNumber: this.range.startLineNumber, column: this.range.startColumn - 1 },
      preference: [ContentWidgetPositionPreference.EXACT]
    };
  }
  dispose() {
    this.editor.removeContentWidget(this);
    dispose(this.toDispose);
  }
}
__decorateClass([
  memoize
], InlineBreakpointWidget.prototype, "getId", 1);
registerThemingParticipant((theme, collector) => {
  const scope = ".monaco-editor .glyph-margin-widgets, .monaco-workbench .debug-breakpoints, .monaco-workbench .disassembly-view, .monaco-editor .contentWidgets";
  const debugIconBreakpointColor = theme.getColor(debugIconBreakpointForeground);
  if (debugIconBreakpointColor) {
    collector.addRule(`${scope} {
			${icons.allBreakpoints.map((b) => `${ThemeIcon.asCSSSelector(b.regular)}`).join(",\n		")},
			${ThemeIcon.asCSSSelector(icons.debugBreakpointUnsupported)},
			${ThemeIcon.asCSSSelector(icons.debugBreakpointHint)}:not([class*='codicon-debug-breakpoint']):not([class*='codicon-debug-stackframe']),
			${ThemeIcon.asCSSSelector(icons.breakpoint.regular)}${ThemeIcon.asCSSSelector(icons.debugStackframeFocused)}::after,
			${ThemeIcon.asCSSSelector(icons.breakpoint.regular)}${ThemeIcon.asCSSSelector(icons.debugStackframe)}::after {
				color: ${debugIconBreakpointColor} !important;
			}
		}`);
    collector.addRule(`${scope} {
			${ThemeIcon.asCSSSelector(icons.breakpoint.pending)} {
				color: ${debugIconBreakpointColor} !important;
				font-size: 12px !important;
			}
		}`);
  }
  const debugIconBreakpointDisabledColor = theme.getColor(debugIconBreakpointDisabledForeground);
  if (debugIconBreakpointDisabledColor) {
    collector.addRule(`${scope} {
			${icons.allBreakpoints.map((b) => ThemeIcon.asCSSSelector(b.disabled)).join(",\n		")} {
				color: ${debugIconBreakpointDisabledColor};
			}
		}`);
  }
  const debugIconBreakpointUnverifiedColor = theme.getColor(debugIconBreakpointUnverifiedForeground);
  if (debugIconBreakpointUnverifiedColor) {
    collector.addRule(`${scope} {
			${icons.allBreakpoints.map((b) => ThemeIcon.asCSSSelector(b.unverified)).join(",\n		")} {
				color: ${debugIconBreakpointUnverifiedColor};
			}
		}`);
  }
  const debugIconBreakpointCurrentStackframeForegroundColor = theme.getColor(debugIconBreakpointCurrentStackframeForeground);
  if (debugIconBreakpointCurrentStackframeForegroundColor) {
    collector.addRule(`
		.monaco-editor .debug-top-stack-frame-column {
			color: ${debugIconBreakpointCurrentStackframeForegroundColor} !important;
		}
		${scope} {
			${ThemeIcon.asCSSSelector(icons.debugStackframe)} {
				color: ${debugIconBreakpointCurrentStackframeForegroundColor} !important;
			}
		}
		`);
  }
  const debugIconBreakpointStackframeFocusedColor = theme.getColor(debugIconBreakpointStackframeForeground);
  if (debugIconBreakpointStackframeFocusedColor) {
    collector.addRule(`${scope} {
			${ThemeIcon.asCSSSelector(icons.debugStackframeFocused)} {
				color: ${debugIconBreakpointStackframeFocusedColor} !important;
			}
		}`);
  }
});
const debugIconBreakpointForeground = registerColor("debugIcon.breakpointForeground", "#E51400", nls.localize("debugIcon.breakpointForeground", "Icon color for breakpoints."));
const debugIconBreakpointDisabledForeground = registerColor("debugIcon.breakpointDisabledForeground", "#848484", nls.localize("debugIcon.breakpointDisabledForeground", "Icon color for disabled breakpoints."));
const debugIconBreakpointUnverifiedForeground = registerColor("debugIcon.breakpointUnverifiedForeground", "#848484", nls.localize("debugIcon.breakpointUnverifiedForeground", "Icon color for unverified breakpoints."));
const debugIconBreakpointCurrentStackframeForeground = registerColor("debugIcon.breakpointCurrentStackframeForeground", { dark: "#FFCC00", light: "#BE8700", hcDark: "#FFCC00", hcLight: "#BE8700" }, nls.localize("debugIcon.breakpointCurrentStackframeForeground", "Icon color for the current breakpoint stack frame."));
const debugIconBreakpointStackframeForeground = registerColor("debugIcon.breakpointStackframeForeground", "#89D185", nls.localize("debugIcon.breakpointStackframeForeground", "Icon color for all breakpoint stack frames."));
export {
  BreakpointEditorContribution,
  createBreakpointDecorations,
  debugIconBreakpointForeground
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2JyZWFrcG9pbnRFZGl0b3JDb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc1NhZmFyaSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IEJyb3dzZXJGZWF0dXJlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jYW5JVXNlLmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiwgU2VwYXJhdG9yLCBTdWJtZW51QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBkaXNwb3NlLCBkaXNwb3NlSWZEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBlbnYgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IG5vQnJlYWtXaGl0ZXNwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSwgSUFjdGl2ZUNvZGVFZGl0b3IsIElDb2RlRWRpdG9yLCBJQ29udGVudFdpZGdldCwgSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiwgSUVkaXRvck1vdXNlRXZlbnQsIE1vdXNlVGFyZ2V0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IEdseXBoTWFyZ2luTGFuZSwgSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMsIElNb2RlbERlY29yYXRpb25PdmVydmlld1J1bGVyT3B0aW9ucywgSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgSVRleHRNb2RlbCwgT3ZlcnZpZXdSdWxlckxhbmUsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCwgdGhlbWVDb2xvckZyb21JZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgR3V0dGVyQWN0aW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL2VkaXRvckxpbmVOdW1iZXJNZW51LmpzJztcbmltcG9ydCB7IGdldEJyZWFrcG9pbnRNZXNzYWdlQW5kSWNvbiB9IGZyb20gJy4vYnJlYWtwb2ludHNWaWV3LmpzJztcbmltcG9ydCB7IEJyZWFrcG9pbnRXaWRnZXQgfSBmcm9tICcuL2JyZWFrcG9pbnRXaWRnZXQuanMnO1xuaW1wb3J0ICogYXMgaWNvbnMgZnJvbSAnLi9kZWJ1Z0ljb25zLmpzJztcbmltcG9ydCB7IEJSRUFLUE9JTlRfRURJVE9SX0NPTlRSSUJVVElPTl9JRCwgQnJlYWtwb2ludFdpZGdldENvbnRleHQsIENPTlRFWFRfQlJFQUtQT0lOVF9XSURHRVRfVklTSUJMRSwgRGVidWdnZXJTdHJpbmcsIElCcmVha3BvaW50LCBJQnJlYWtwb2ludEVkaXRvckNvbnRyaWJ1dGlvbiwgSUJyZWFrcG9pbnRVcGRhdGVEYXRhLCBJRGVidWdDb25maWd1cmF0aW9uLCBJRGVidWdTZXJ2aWNlLCBJRGVidWdTZXNzaW9uLCBTdGF0ZSB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuaW50ZXJmYWNlIElCcmVha3BvaW50RGVjb3JhdGlvbiB7XG5cdGRlY29yYXRpb25JZDogc3RyaW5nO1xuXHRicmVha3BvaW50OiBJQnJlYWtwb2ludDtcblx0cmFuZ2U6IFJhbmdlO1xuXHRpbmxpbmVXaWRnZXQ/OiBJbmxpbmVCcmVha3BvaW50V2lkZ2V0O1xufVxuXG5jb25zdCBicmVha3BvaW50SGVscGVyRGVjb3JhdGlvbjogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgPSB7XG5cdGRlc2NyaXB0aW9uOiAnYnJlYWtwb2ludC1oZWxwZXItZGVjb3JhdGlvbicsXG5cdGdseXBoTWFyZ2luQ2xhc3NOYW1lOiBUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbnMuZGVidWdCcmVha3BvaW50SGludCksXG5cdGdseXBoTWFyZ2luOiB7IHBvc2l0aW9uOiBHbHlwaE1hcmdpbkxhbmUuUmlnaHQgfSxcblx0Z2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZFRleHQobmxzLmxvY2FsaXplKCdicmVha3BvaW50SGVscGVyJywgXCJDbGljayB0byBhZGQgYSBicmVha3BvaW50XCIpKSxcblx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXNcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCcmVha3BvaW50RGVjb3JhdGlvbnMoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG1vZGVsOiBJVGV4dE1vZGVsLCBicmVha3BvaW50czogUmVhZG9ubHlBcnJheTxJQnJlYWtwb2ludD4sIHN0YXRlOiBTdGF0ZSwgYnJlYWtwb2ludHNBY3RpdmF0ZWQ6IGJvb2xlYW4sIHNob3dCcmVha3BvaW50c0luT3ZlcnZpZXdSdWxlcjogYm9vbGVhbik6IHsgcmFuZ2U6IFJhbmdlOyBvcHRpb25zOiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9W10ge1xuXHRjb25zdCByZXN1bHQ6IHsgcmFuZ2U6IFJhbmdlOyBvcHRpb25zOiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9W10gPSBbXTtcblx0YnJlYWtwb2ludHMuZm9yRWFjaCgoYnJlYWtwb2ludCkgPT4ge1xuXHRcdGlmIChicmVha3BvaW50LmxpbmVOdW1iZXIgPiBtb2RlbC5nZXRMaW5lQ291bnQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBoYXNPdGhlckJyZWFrcG9pbnRzT25MaW5lID0gYnJlYWtwb2ludHMuc29tZShicCA9PiBicCAhPT0gYnJlYWtwb2ludCAmJiBicC5saW5lTnVtYmVyID09PSBicmVha3BvaW50LmxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IGNvbHVtbiA9IG1vZGVsLmdldExpbmVGaXJzdE5vbldoaXRlc3BhY2VDb2x1bW4oYnJlYWtwb2ludC5saW5lTnVtYmVyKTtcblx0XHRjb25zdCByYW5nZSA9IG1vZGVsLnZhbGlkYXRlUmFuZ2UoXG5cdFx0XHRicmVha3BvaW50LmNvbHVtbiA/IG5ldyBSYW5nZShicmVha3BvaW50LmxpbmVOdW1iZXIsIGJyZWFrcG9pbnQuY29sdW1uLCBicmVha3BvaW50LmxpbmVOdW1iZXIsIGJyZWFrcG9pbnQuY29sdW1uICsgMSlcblx0XHRcdFx0OiBuZXcgUmFuZ2UoYnJlYWtwb2ludC5saW5lTnVtYmVyLCBjb2x1bW4sIGJyZWFrcG9pbnQubGluZU51bWJlciwgY29sdW1uICsgMSkgLy8gRGVjb3JhdGlvbiBoYXMgdG8gaGF2ZSBhIHdpZHRoICMyMDY4OFxuXHRcdCk7XG5cblx0XHRyZXN1bHQucHVzaCh7XG5cdFx0XHRvcHRpb25zOiBnZXRCcmVha3BvaW50RGVjb3JhdGlvbk9wdGlvbnMoYWNjZXNzb3IsIG1vZGVsLCBicmVha3BvaW50LCBzdGF0ZSwgYnJlYWtwb2ludHNBY3RpdmF0ZWQsIHNob3dCcmVha3BvaW50c0luT3ZlcnZpZXdSdWxlciwgaGFzT3RoZXJCcmVha3BvaW50c09uTGluZSksXG5cdFx0XHRyYW5nZVxuXHRcdH0pO1xuXHR9KTtcblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBnZXRCcmVha3BvaW50RGVjb3JhdGlvbk9wdGlvbnMoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG1vZGVsOiBJVGV4dE1vZGVsLCBicmVha3BvaW50OiBJQnJlYWtwb2ludCwgc3RhdGU6IFN0YXRlLCBicmVha3BvaW50c0FjdGl2YXRlZDogYm9vbGVhbiwgc2hvd0JyZWFrcG9pbnRzSW5PdmVydmlld1J1bGVyOiBib29sZWFuLCBoYXNPdGhlckJyZWFrcG9pbnRzT25MaW5lOiBib29sZWFuKTogSU1vZGVsRGVjb3JhdGlvbk9wdGlvbnMge1xuXHRjb25zdCBkZWJ1Z1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlYnVnU2VydmljZSk7XG5cdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0Y29uc3QgbGFiZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYWJlbFNlcnZpY2UpO1xuXHRjb25zdCB7IGljb24sIG1lc3NhZ2UsIHNob3dBZGFwdGVyVW52ZXJpZmllZE1lc3NhZ2UgfSA9IGdldEJyZWFrcG9pbnRNZXNzYWdlQW5kSWNvbihzdGF0ZSwgYnJlYWtwb2ludHNBY3RpdmF0ZWQsIGJyZWFrcG9pbnQsIGxhYmVsU2VydmljZSwgZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkpO1xuXHRsZXQgZ2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2U6IE1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdGxldCB1bnZlcmlmaWVkTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRpZiAoc2hvd0FkYXB0ZXJVbnZlcmlmaWVkTWVzc2FnZSkge1xuXHRcdGxldCBsYW5nSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHR1bnZlcmlmaWVkTWVzc2FnZSA9IGRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFNlc3Npb25zKCkubWFwKHMgPT4ge1xuXHRcdFx0Y29uc3QgZGJnID0gZGVidWdTZXJ2aWNlLmdldEFkYXB0ZXJNYW5hZ2VyKCkuZ2V0RGVidWdnZXIocy5jb25maWd1cmF0aW9uLnR5cGUpO1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGRiZz8uc3RyaW5ncz8uW0RlYnVnZ2VyU3RyaW5nLlVudmVyaWZpZWRCcmVha3BvaW50c107XG5cdFx0XHRpZiAobWVzc2FnZSkge1xuXHRcdFx0XHRpZiAoIWxhbmdJZCkge1xuXHRcdFx0XHRcdC8vIExhemlseSBjb21wdXRlIHRoaXMsIG9ubHkgaWYgbmVlZGVkIGZvciBzb21lIGRlYnVnIGFkYXB0ZXJcblx0XHRcdFx0XHRsYW5nSWQgPSBsYW5ndWFnZVNlcnZpY2UuZ3Vlc3NMYW5ndWFnZUlkQnlGaWxlcGF0aE9yRmlyc3RMaW5lKGJyZWFrcG9pbnQudXJpKSA/PyB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGxhbmdJZCAmJiBkYmcuaW50ZXJlc3RlZEluTGFuZ3VhZ2UobGFuZ0lkKSA/IG1lc3NhZ2UgOiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSlcblx0XHRcdC5maW5kKG1lc3NhZ2VzID0+ICEhbWVzc2FnZXMpO1xuXHR9XG5cblx0aWYgKG1lc3NhZ2UpIHtcblx0XHRnbHlwaE1hcmdpbkhvdmVyTWVzc2FnZSA9IG5ldyBNYXJrZG93blN0cmluZyh1bmRlZmluZWQsIHsgaXNUcnVzdGVkOiB0cnVlLCBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KTtcblx0XHRpZiAoYnJlYWtwb2ludC5jb25kaXRpb24gfHwgYnJlYWtwb2ludC5oaXRDb25kaXRpb24pIHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSBtb2RlbC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0XHRnbHlwaE1hcmdpbkhvdmVyTWVzc2FnZS5hcHBlbmRDb2RlYmxvY2sobGFuZ3VhZ2VJZCwgbWVzc2FnZSk7XG5cdFx0XHRpZiAodW52ZXJpZmllZE1lc3NhZ2UpIHtcblx0XHRcdFx0Z2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2UuYXBwZW5kTWFya2Rvd24oJyQod2FybmluZykgJyArIHVudmVyaWZpZWRNZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Z2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2UuYXBwZW5kVGV4dChtZXNzYWdlKTtcblx0XHRcdGlmICh1bnZlcmlmaWVkTWVzc2FnZSkge1xuXHRcdFx0XHRnbHlwaE1hcmdpbkhvdmVyTWVzc2FnZS5hcHBlbmRNYXJrZG93bignXFxuXFxuJCh3YXJuaW5nKSAnICsgdW52ZXJpZmllZE1lc3NhZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIGlmICh1bnZlcmlmaWVkTWVzc2FnZSkge1xuXHRcdGdseXBoTWFyZ2luSG92ZXJNZXNzYWdlID0gbmV3IE1hcmtkb3duU3RyaW5nKHVuZGVmaW5lZCwgeyBpc1RydXN0ZWQ6IHRydWUsIHN1cHBvcnRUaGVtZUljb25zOiB0cnVlIH0pLmFwcGVuZE1hcmtkb3duKHVudmVyaWZpZWRNZXNzYWdlKTtcblx0fVxuXG5cdGxldCBvdmVydmlld1J1bGVyRGVjb3JhdGlvbjogSU1vZGVsRGVjb3JhdGlvbk92ZXJ2aWV3UnVsZXJPcHRpb25zIHwgbnVsbCA9IG51bGw7XG5cdGlmIChzaG93QnJlYWtwb2ludHNJbk92ZXJ2aWV3UnVsZXIpIHtcblx0XHRvdmVydmlld1J1bGVyRGVjb3JhdGlvbiA9IHtcblx0XHRcdGNvbG9yOiB0aGVtZUNvbG9yRnJvbUlkKGRlYnVnSWNvbkJyZWFrcG9pbnRGb3JlZ3JvdW5kKSxcblx0XHRcdHBvc2l0aW9uOiBPdmVydmlld1J1bGVyTGFuZS5MZWZ0XG5cdFx0fTtcblx0fVxuXG5cdGNvbnN0IHJlbmRlcklubGluZSA9IGJyZWFrcG9pbnQuY29sdW1uICYmIChoYXNPdGhlckJyZWFrcG9pbnRzT25MaW5lIHx8IGJyZWFrcG9pbnQuY29sdW1uID4gbW9kZWwuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbihicmVha3BvaW50LmxpbmVOdW1iZXIpKTtcblx0cmV0dXJuIHtcblx0XHRkZXNjcmlwdGlvbjogJ2JyZWFrcG9pbnQtZGVjb3JhdGlvbicsXG5cdFx0Z2x5cGhNYXJnaW46IHsgcG9zaXRpb246IEdseXBoTWFyZ2luTGFuZS5SaWdodCB9LFxuXHRcdGdseXBoTWFyZ2luQ2xhc3NOYW1lOiBUaGVtZUljb24uYXNDbGFzc05hbWUoaWNvbiksXG5cdFx0Z2x5cGhNYXJnaW5Ib3Zlck1lc3NhZ2UsXG5cdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdFx0YmVmb3JlOiByZW5kZXJJbmxpbmUgPyB7XG5cdFx0XHRjb250ZW50OiBub0JyZWFrV2hpdGVzcGFjZSxcblx0XHRcdGlubGluZUNsYXNzTmFtZTogYGRlYnVnLWJyZWFrcG9pbnQtcGxhY2Vob2xkZXJgLFxuXHRcdFx0aW5saW5lQ2xhc3NOYW1lQWZmZWN0c0xldHRlclNwYWNpbmc6IHRydWVcblx0XHR9IDogdW5kZWZpbmVkLFxuXHRcdG92ZXJ2aWV3UnVsZXI6IG92ZXJ2aWV3UnVsZXJEZWNvcmF0aW9uLFxuXHRcdHpJbmRleDogOTk5OVxuXHR9O1xufVxuXG50eXBlIEJyZWFrcG9pbnRzRm9yTGluZSA9IHsgbGluZU51bWJlcjogbnVtYmVyOyBwb3NpdGlvbnM6IElQb3NpdGlvbltdIH07XG5cbmFzeW5jIGZ1bmN0aW9uIHJlcXVlc3RCcmVha3BvaW50Q2FuZGlkYXRlTG9jYXRpb25zKG1vZGVsOiBJVGV4dE1vZGVsLCBsaW5lTnVtYmVyczogbnVtYmVyW10sIHNlc3Npb246IElEZWJ1Z1Nlc3Npb24pOiBQcm9taXNlPEJyZWFrcG9pbnRzRm9yTGluZVtdPiB7XG5cdGlmICghc2Vzc2lvbi5jYXBhYmlsaXRpZXMuc3VwcG9ydHNCcmVha3BvaW50TG9jYXRpb25zUmVxdWVzdCkge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHJldHVybiBhd2FpdCBQcm9taXNlLmFsbChkaXN0aW5jdChsaW5lTnVtYmVycywgbCA9PiBsKS5tYXAoYXN5bmMgbGluZU51bWJlciA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiB7IGxpbmVOdW1iZXIsIHBvc2l0aW9uczogYXdhaXQgc2Vzc2lvbi5icmVha3BvaW50c0xvY2F0aW9ucyhtb2RlbC51cmksIGxpbmVOdW1iZXIpIH07XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4geyBsaW5lTnVtYmVyLCBwb3NpdGlvbnM6IFtdIH07XG5cdFx0fVxuXHR9KSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNhbmRpZGF0ZURlY29yYXRpb25zKG1vZGVsOiBJVGV4dE1vZGVsLCBicmVha3BvaW50RGVjb3JhdGlvbnM6IElCcmVha3BvaW50RGVjb3JhdGlvbltdLCBsaW5lQnJlYWtwb2ludHM6IEJyZWFrcG9pbnRzRm9yTGluZVtdKTogeyByYW5nZTogUmFuZ2U7IG9wdGlvbnM6IElNb2RlbERlY29yYXRpb25PcHRpb25zOyBicmVha3BvaW50OiBJQnJlYWtwb2ludCB8IHVuZGVmaW5lZCB9W10ge1xuXHRjb25zdCByZXN1bHQ6IHsgcmFuZ2U6IFJhbmdlOyBvcHRpb25zOiBJTW9kZWxEZWNvcmF0aW9uT3B0aW9uczsgYnJlYWtwb2ludDogSUJyZWFrcG9pbnQgfCB1bmRlZmluZWQgfVtdID0gW107XG5cdGZvciAoY29uc3QgeyBwb3NpdGlvbnMsIGxpbmVOdW1iZXIgfSBvZiBsaW5lQnJlYWtwb2ludHMpIHtcblx0XHRpZiAocG9zaXRpb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Ly8gRG8gbm90IHJlbmRlciBjYW5kaWRhdGVzIGlmIHRoZXJlIGlzIG9ubHkgb25lLCBzaW5jZSBpdCBpcyBhbHJlYWR5IGNvdmVyZWQgYnkgdGhlIGxpbmUgYnJlYWtwb2ludFxuXHRcdGNvbnN0IGZpcnN0Q29sdW1uID0gbW9kZWwuZ2V0TGluZUZpcnN0Tm9uV2hpdGVzcGFjZUNvbHVtbihsaW5lTnVtYmVyKTtcblx0XHRjb25zdCBsYXN0Q29sdW1uID0gbW9kZWwuZ2V0TGluZUxhc3ROb25XaGl0ZXNwYWNlQ29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdHBvc2l0aW9ucy5mb3JFYWNoKHAgPT4ge1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSBuZXcgUmFuZ2UocC5saW5lTnVtYmVyLCBwLmNvbHVtbiwgcC5saW5lTnVtYmVyLCBwLmNvbHVtbiArIDEpO1xuXHRcdFx0aWYgKChwLmNvbHVtbiA8PSBmaXJzdENvbHVtbiAmJiAhYnJlYWtwb2ludERlY29yYXRpb25zLnNvbWUoYnAgPT4gYnAucmFuZ2Uuc3RhcnRDb2x1bW4gPiBmaXJzdENvbHVtbiAmJiBicC5yYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IHAubGluZU51bWJlcikpIHx8IHAuY29sdW1uID4gbGFzdENvbHVtbikge1xuXHRcdFx0XHQvLyBEbyBub3QgcmVuZGVyIGNhbmRpZGF0ZXMgb24gdGhlIHN0YXJ0IG9mIHRoZSBsaW5lIGlmIHRoZXJlJ3Mgbm8gb3RoZXIgYnJlYWtwb2ludCBvbiB0aGUgbGluZS5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBicmVha3BvaW50QXRQb3NpdGlvbiA9IGJyZWFrcG9pbnREZWNvcmF0aW9ucy5maW5kKGJwZCA9PiBicGQucmFuZ2UuZXF1YWxzUmFuZ2UocmFuZ2UpKTtcblx0XHRcdGlmIChicmVha3BvaW50QXRQb3NpdGlvbiAmJiBicmVha3BvaW50QXRQb3NpdGlvbi5pbmxpbmVXaWRnZXQpIHtcblx0XHRcdFx0Ly8gU3BhY2UgYWxyZWFkeSBvY2N1cGllZCwgZG8gbm90IHJlbmRlciBjYW5kaWRhdGUuXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ2JyZWFrcG9pbnQtcGxhY2Vob2xkZXItZGVjb3JhdGlvbicsXG5cdFx0XHRcdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdFx0XHRcdFx0YmVmb3JlOiBicmVha3BvaW50QXRQb3NpdGlvbiA/IHVuZGVmaW5lZCA6IHtcblx0XHRcdFx0XHRcdGNvbnRlbnQ6IG5vQnJlYWtXaGl0ZXNwYWNlLFxuXHRcdFx0XHRcdFx0aW5saW5lQ2xhc3NOYW1lOiBgZGVidWctYnJlYWtwb2ludC1wbGFjZWhvbGRlcmAsXG5cdFx0XHRcdFx0XHRpbmxpbmVDbGFzc05hbWVBZmZlY3RzTGV0dGVyU3BhY2luZzogdHJ1ZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGJyZWFrcG9pbnQ6IGJyZWFrcG9pbnRBdFBvc2l0aW9uID8gYnJlYWtwb2ludEF0UG9zaXRpb24uYnJlYWtwb2ludCA6IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgY2xhc3MgQnJlYWtwb2ludEVkaXRvckNvbnRyaWJ1dGlvbiBpbXBsZW1lbnRzIElCcmVha3BvaW50RWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRwcml2YXRlIGJyZWFrcG9pbnRIaW50RGVjb3JhdGlvbjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgYnJlYWtwb2ludFdpZGdldDogQnJlYWtwb2ludFdpZGdldCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBicmVha3BvaW50V2lkZ2V0VmlzaWJsZSE6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHRvRGlzcG9zZTogSURpc3Bvc2FibGVbXSA9IFtdO1xuXHRwcml2YXRlIGlnbm9yZURlY29yYXRpb25zQ2hhbmdlZEV2ZW50ID0gZmFsc2U7XG5cdHByaXZhdGUgaWdub3JlQnJlYWtwb2ludHNDaGFuZ2VFdmVudCA9IGZhbHNlO1xuXHRwcml2YXRlIGJyZWFrcG9pbnREZWNvcmF0aW9uczogSUJyZWFrcG9pbnREZWNvcmF0aW9uW10gPSBbXTtcblx0cHJpdmF0ZSBjYW5kaWRhdGVEZWNvcmF0aW9uczogeyBkZWNvcmF0aW9uSWQ6IHN0cmluZzsgaW5saW5lV2lkZ2V0OiBJbmxpbmVCcmVha3BvaW50V2lkZ2V0IH1bXSA9IFtdO1xuXHRwcml2YXRlIHNldERlY29yYXRpb25zU2NoZWR1bGVyITogUnVuT25jZVNjaGVkdWxlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWJ1Z1NlcnZpY2U6IElEZWJ1Z1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuYnJlYWtwb2ludFdpZGdldFZpc2libGUgPSBDT05URVhUX0JSRUFLUE9JTlRfV0lER0VUX1ZJU0lCTEUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNldERlY29yYXRpb25zU2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5zZXREZWNvcmF0aW9ucygpLCAzMCk7XG5cdFx0dGhpcy5zZXREZWNvcmF0aW9uc1NjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGNvbnRleHQgbWVudSBhY3Rpb25zIGF0IHRoZSBsaW5lIG51bWJlciBpZiBicmVha3BvaW50cyBjYW4gYmVcblx0ICogc2V0LiBUaGlzIGlzIHVzZWQgYnkgdGhlIHtAbGluayBUZXN0aW5nRGVjb3JhdGlvbnN9IHRvIGFsbG93IGJyZWFrcG9pbnRcblx0ICogc2V0dGluZyBvbiBsaW5lcyB3aGVyZSBicmVha3BvaW50IFwicnVuXCIgYWN0aW9ucyBhcmUgcHJlc2VudC5cblx0ICovXG5cdHB1YmxpYyBnZXRDb250ZXh0TWVudUFjdGlvbnNBdFBvc2l0aW9uKGxpbmVOdW1iZXI6IG51bWJlciwgbW9kZWw6IElUZXh0TW9kZWwpIHtcblx0XHRpZiAoIXRoaXMuZGVidWdTZXJ2aWNlLmdldEFkYXB0ZXJNYW5hZ2VyKCkuaGFzRW5hYmxlZERlYnVnZ2VycygpKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmRlYnVnU2VydmljZS5jYW5TZXRCcmVha3BvaW50c0luKG1vZGVsKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJyZWFrcG9pbnRzID0gdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50cyh7IGxpbmVOdW1iZXIsIHVyaTogbW9kZWwudXJpIH0pO1xuXHRcdHJldHVybiB0aGlzLmdldENvbnRleHRNZW51QWN0aW9ucyhicmVha3BvaW50cywgbW9kZWwudXJpLCBsaW5lTnVtYmVyKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmVkaXRvci5vbk1vdXNlRG93bihhc3luYyAoZTogSUVkaXRvck1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlmICghdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0QWRhcHRlck1hbmFnZXIoKS5oYXNFbmFibGVkRGVidWdnZXJzKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRpZiAoIWUudGFyZ2V0LnBvc2l0aW9uXG5cdFx0XHRcdHx8ICFtb2RlbFxuXHRcdFx0XHR8fCBlLnRhcmdldC50eXBlICE9PSBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0dMWVBIX01BUkdJTlxuXHRcdFx0XHR8fCBlLnRhcmdldC5kZXRhaWwuaXNBZnRlckxpbmVzXG5cdFx0XHRcdHx8ICF0aGlzLm1hcmdpbkZyZWVGcm9tTm9uRGVidWdEZWNvcmF0aW9ucyhlLnRhcmdldC5wb3NpdGlvbi5saW5lTnVtYmVyKVxuXHRcdFx0XHQvLyBkb24ndCByZXR1cm4gZWFybHkgaWYgdGhlcmUncyBhIGJyZWFrcG9pbnRcblx0XHRcdFx0JiYgIWUudGFyZ2V0LmVsZW1lbnQ/LmNsYXNzTmFtZS5pbmNsdWRlcygnYnJlYWtwb2ludCcpXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY2FuU2V0QnJlYWtwb2ludHMgPSB0aGlzLmRlYnVnU2VydmljZS5jYW5TZXRCcmVha3BvaW50c0luKG1vZGVsKTtcblx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBlLnRhcmdldC5wb3NpdGlvbi5saW5lTnVtYmVyO1xuXHRcdFx0Y29uc3QgdXJpID0gbW9kZWwudXJpO1xuXG5cdFx0XHRpZiAoZS5ldmVudC5yaWdodEJ1dHRvbiB8fCAoZW52LmlzTWFjaW50b3NoICYmIGUuZXZlbnQubGVmdEJ1dHRvbiAmJiBlLmV2ZW50LmN0cmxLZXkpKSB7XG5cdFx0XHRcdC8vIGhhbmRsZWQgYnkgZWRpdG9yIGd1dHRlciBjb250ZXh0IG1lbnVcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgYnJlYWtwb2ludHMgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldEJyZWFrcG9pbnRzKHsgdXJpLCBsaW5lTnVtYmVyIH0pO1xuXG5cdFx0XHRcdGlmIChicmVha3BvaW50cy5sZW5ndGgpIHtcblx0XHRcdFx0XHRjb25zdCBpc1NoaWZ0UHJlc3NlZCA9IGUuZXZlbnQuc2hpZnRLZXk7XG5cdFx0XHRcdFx0Y29uc3QgZW5hYmxlZCA9IGJyZWFrcG9pbnRzLnNvbWUoYnAgPT4gYnAuZW5hYmxlZCk7XG5cblx0XHRcdFx0XHRpZiAoaXNTaGlmdFByZXNzZWQpIHtcblx0XHRcdFx0XHRcdGJyZWFrcG9pbnRzLmZvckVhY2goYnAgPT4gdGhpcy5kZWJ1Z1NlcnZpY2UuZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHMoIWVuYWJsZWQsIGJwKSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICghZW52LmlzTGludXggJiYgYnJlYWtwb2ludHMuc29tZShicCA9PiAhIWJwLmNvbmRpdGlvbiB8fCAhIWJwLmxvZ01lc3NhZ2UgfHwgISFicC5oaXRDb25kaXRpb24gfHwgISFicC50cmlnZ2VyZWRCeSkpIHtcblx0XHRcdFx0XHRcdC8vIFNob3cgdGhlIGRpYWxvZyBpZiB0aGVyZSBpcyBhIHBvdGVudGlhbCBjb25kaXRpb24gdG8gYmUgYWNjaWRlbnRseSBsb3N0LlxuXHRcdFx0XHRcdFx0Ly8gRG8gbm90IHNob3cgZGlhbG9nIG9uIGxpbnV4IGR1ZSB0byBlbGVjdHJvbiBpc3N1ZSBmcmVlemluZyB0aGUgbW91c2UgIzUwMDI2XG5cdFx0XHRcdFx0XHRjb25zdCBsb2dQb2ludCA9IGJyZWFrcG9pbnRzLmV2ZXJ5KGJwID0+ICEhYnAubG9nTWVzc2FnZSk7XG5cdFx0XHRcdFx0XHRjb25zdCBicmVha3BvaW50VHlwZSA9IGxvZ1BvaW50ID8gbmxzLmxvY2FsaXplKCdsb2dQb2ludCcsIFwiTG9ncG9pbnRcIikgOiBubHMubG9jYWxpemUoJ2JyZWFrcG9pbnQnLCBcIkJyZWFrcG9pbnRcIik7XG5cblx0XHRcdFx0XHRcdGNvbnN0IGRpc2FibGVkQnJlYWtwb2ludERpYWxvZ01lc3NhZ2UgPSBubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0XHRcdCdicmVha3BvaW50SGFzQ29uZGl0aW9uRGlzYWJsZWQnLFxuXHRcdFx0XHRcdFx0XHRcIlRoaXMgezB9IGhhcyBhIHsxfSB0aGF0IHdpbGwgZ2V0IGxvc3Qgb24gcmVtb3ZlLiBDb25zaWRlciBlbmFibGluZyB0aGUgezB9IGluc3RlYWQuXCIsXG5cdFx0XHRcdFx0XHRcdGJyZWFrcG9pbnRUeXBlLnRvTG93ZXJDYXNlKCksXG5cdFx0XHRcdFx0XHRcdGxvZ1BvaW50ID8gbmxzLmxvY2FsaXplKCdtZXNzYWdlJywgXCJtZXNzYWdlXCIpIDogbmxzLmxvY2FsaXplKCdjb25kaXRpb24nLCBcImNvbmRpdGlvblwiKVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdGNvbnN0IGVuYWJsZWRCcmVha3BvaW50RGlhbG9nTWVzc2FnZSA9IG5scy5sb2NhbGl6ZShcblx0XHRcdFx0XHRcdFx0J2JyZWFrcG9pbnRIYXNDb25kaXRpb25FbmFibGVkJyxcblx0XHRcdFx0XHRcdFx0XCJUaGlzIHswfSBoYXMgYSB7MX0gdGhhdCB3aWxsIGdldCBsb3N0IG9uIHJlbW92ZS4gQ29uc2lkZXIgZGlzYWJsaW5nIHRoZSB7MH0gaW5zdGVhZC5cIixcblx0XHRcdFx0XHRcdFx0YnJlYWtwb2ludFR5cGUudG9Mb3dlckNhc2UoKSxcblx0XHRcdFx0XHRcdFx0bG9nUG9pbnQgPyBubHMubG9jYWxpemUoJ21lc3NhZ2UnLCBcIm1lc3NhZ2VcIikgOiBubHMubG9jYWxpemUoJ2NvbmRpdGlvbicsIFwiY29uZGl0aW9uXCIpXG5cdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdFx0XHRcdFx0dHlwZTogc2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogZW5hYmxlZCA/IGVuYWJsZWRCcmVha3BvaW50RGlhbG9nTWVzc2FnZSA6IGRpc2FibGVkQnJlYWtwb2ludERpYWxvZ01lc3NhZ2UsXG5cdFx0XHRcdFx0XHRcdGJ1dHRvbnM6IFtcblx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKHsga2V5OiAncmVtb3ZlTG9nUG9pbnQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZW1vdmUgezB9XCIsIGJyZWFrcG9pbnRUeXBlKSxcblx0XHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gYnJlYWtwb2ludHMuZm9yRWFjaChicCA9PiB0aGlzLmRlYnVnU2VydmljZS5yZW1vdmVCcmVha3BvaW50cyhicC5nZXRJZCgpKSlcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2Rpc2FibGVMb2dQb2ludCcsIFwiezB9IHsxfVwiLCBlbmFibGVkID8gbmxzLmxvY2FsaXplKHsga2V5OiAnZGlzYWJsZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkRpc2FibGVcIikgOiBubHMubG9jYWxpemUoeyBrZXk6ICdlbmFibGUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZFbmFibGVcIiksIGJyZWFrcG9pbnRUeXBlKSxcblx0XHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gYnJlYWtwb2ludHMuZm9yRWFjaChicCA9PiB0aGlzLmRlYnVnU2VydmljZS5lbmFibGVPckRpc2FibGVCcmVha3BvaW50cyghZW5hYmxlZCwgYnApKVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0Y2FuY2VsQnV0dG9uOiB0cnVlXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0aWYgKCFlbmFibGVkKSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrcG9pbnRzLmZvckVhY2goYnAgPT4gdGhpcy5kZWJ1Z1NlcnZpY2UuZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHMoIWVuYWJsZWQsIGJwKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRicmVha3BvaW50cy5mb3JFYWNoKGJwID0+IHRoaXMuZGVidWdTZXJ2aWNlLnJlbW92ZUJyZWFrcG9pbnRzKGJwLmdldElkKCkpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoY2FuU2V0QnJlYWtwb2ludHMpIHtcblx0XHRcdFx0XHRpZiAoZS5ldmVudC5taWRkbGVCdXR0b24pIHtcblx0XHRcdFx0XHRcdGNvbnN0IGFjdGlvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJykuZ3V0dGVyTWlkZGxlQ2xpY2tBY3Rpb247XG5cdFx0XHRcdFx0XHRpZiAoYWN0aW9uICE9PSAnbm9uZScpIHtcblx0XHRcdFx0XHRcdFx0bGV0IGNvbnRleHQ6IEJyZWFrcG9pbnRXaWRnZXRDb250ZXh0O1xuXHRcdFx0XHRcdFx0XHRzd2l0Y2ggKGFjdGlvbikge1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ2xvZ3BvaW50Jzpcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRleHQgPSBCcmVha3BvaW50V2lkZ2V0Q29udGV4dC5MT0dfTUVTU0FHRTtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ2NvbmRpdGlvbmFsQnJlYWtwb2ludCc6XG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZXh0ID0gQnJlYWtwb2ludFdpZGdldENvbnRleHQuQ09ORElUSU9OO1xuXHRcdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdFx0Y2FzZSAndHJpZ2dlcmVkQnJlYWtwb2ludCc6XG5cdFx0XHRcdFx0XHRcdFx0XHRjb250ZXh0ID0gQnJlYWtwb2ludFdpZGdldENvbnRleHQuVFJJR0dFUl9QT0lOVDtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR0aGlzLnNob3dCcmVha3BvaW50V2lkZ2V0KGxpbmVOdW1iZXIsIHVuZGVmaW5lZCwgY29udGV4dCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuZGVidWdTZXJ2aWNlLmFkZEJyZWFrcG9pbnRzKHVyaSwgW3sgbGluZU51bWJlciB9XSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKCEoQnJvd3NlckZlYXR1cmVzLnBvaW50ZXJFdmVudHMgJiYgaXNTYWZhcmkpKSB7XG5cdFx0XHQvKipcblx0XHRcdCAqIFdlIGRpc2FibGUgdGhlIGhvdmVyIGZlYXR1cmUgZm9yIFNhZmFyaSBvbiBpT1MgYXNcblx0XHRcdCAqIDEuIEJyb3dzZXIgaG92ZXIgZXZlbnRzIGFyZSBoYW5kbGVkIHNwZWNpYWxseSBieSB0aGUgc3lzdGVtIChpdCB0cmVhdHMgZmlyc3QgY2xpY2sgYXMgaG92ZXIgaWYgdGhlcmUgaXMgYDpob3ZlcmAgY3NzIHJlZ2lzdGVyZWQpLiBCZWxvdyBob3ZlciBiZWhhdmlvciB3aWxsIGNvbmZ1c2UgdXNlcnMgd2l0aCBpbmNvbnNpc3RlbnQgZXhwZWlyZW5jZS5cblx0XHRcdCAqIDIuIFdoZW4gdXNlcnMgY2xpY2sgb24gbGluZSBudW1iZXJzLCB0aGUgYnJlYWtwb2ludCBoaW50IGRpc3BsYXlzIGltbWVkaWF0ZWx5LCBob3dldmVyIGl0IGRvZXNuJ3QgY3JlYXRlIHRoZSBicmVha3BvaW50IHVubGVzcyB1c2VycyBjbGljayBvbiB0aGUgbGVmdCBndXR0ZXIuIE9uIGEgdG91Y2ggc2NyZWVuLCBpdCdzIGhhcmQgdG8gY2xpY2sgb24gdGhhdCBzbWFsbCBhcmVhLlxuXHRcdFx0ICovXG5cdFx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZWRpdG9yLm9uTW91c2VNb3ZlKChlOiBJRWRpdG9yTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuZGVidWdTZXJ2aWNlLmdldEFkYXB0ZXJNYW5hZ2VyKCkuaGFzRW5hYmxlZERlYnVnZ2VycygpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IHNob3dCcmVha3BvaW50SGludEF0TGluZU51bWJlciA9IC0xO1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0XHRcdGlmIChtb2RlbCAmJiBlLnRhcmdldC5wb3NpdGlvbiAmJiAoZS50YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9HTFlQSF9NQVJHSU4gfHwgZS50YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9MSU5FX05VTUJFUlMpICYmIHRoaXMuZGVidWdTZXJ2aWNlLmNhblNldEJyZWFrcG9pbnRzSW4obW9kZWwpICYmXG5cdFx0XHRcdFx0dGhpcy5tYXJnaW5GcmVlRnJvbU5vbkRlYnVnRGVjb3JhdGlvbnMoZS50YXJnZXQucG9zaXRpb24ubGluZU51bWJlcikpIHtcblx0XHRcdFx0XHRjb25zdCBkYXRhID0gZS50YXJnZXQuZGV0YWlsO1xuXHRcdFx0XHRcdGlmICghZGF0YS5pc0FmdGVyTGluZXMpIHtcblx0XHRcdFx0XHRcdHNob3dCcmVha3BvaW50SGludEF0TGluZU51bWJlciA9IGUudGFyZ2V0LnBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuZW5zdXJlQnJlYWtwb2ludEhpbnREZWNvcmF0aW9uKHNob3dCcmVha3BvaW50SGludEF0TGluZU51bWJlcik7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZWRpdG9yLm9uTW91c2VMZWF2ZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZW5zdXJlQnJlYWtwb2ludEhpbnREZWNvcmF0aW9uKC0xKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblxuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbChhc3luYyAoKSA9PiB7XG5cdFx0XHR0aGlzLmNsb3NlQnJlYWtwb2ludFdpZGdldCgpO1xuXHRcdFx0YXdhaXQgdGhpcy5zZXREZWNvcmF0aW9ucygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZGVidWdTZXJ2aWNlLmdldE1vZGVsKCkub25EaWRDaGFuZ2VCcmVha3BvaW50cygoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuaWdub3JlQnJlYWtwb2ludHNDaGFuZ2VFdmVudCAmJiAhdGhpcy5zZXREZWNvcmF0aW9uc1NjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdHRoaXMuc2V0RGVjb3JhdGlvbnNTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmRlYnVnU2VydmljZS5vbkRpZENoYW5nZVN0YXRlKCgpID0+IHtcblx0XHRcdC8vIFdlIG5lZWQgdG8gdXBkYXRlIGJyZWFrcG9pbnQgZGVjb3JhdGlvbnMgd2hlbiBzdGF0ZSBjaGFuZ2VzIHNpbmNlIHRoZSB0b3Agc3RhY2sgZnJhbWUgYW5kIGJyZWFrcG9pbnQgZGVjb3JhdGlvbiBtaWdodCBjaGFuZ2Vcblx0XHRcdGlmICghdGhpcy5zZXREZWNvcmF0aW9uc1NjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdHRoaXMuc2V0RGVjb3JhdGlvbnNTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZU1vZGVsRGVjb3JhdGlvbnMoKCkgPT4gdGhpcy5vbk1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VkKCkpKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGFzeW5jIChlKSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZGVidWcuc2hvd0JyZWFrcG9pbnRzSW5PdmVydmlld1J1bGVyJykgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZGVidWcuc2hvd0lubGluZUJyZWFrcG9pbnRDYW5kaWRhdGVzJykpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5zZXREZWNvcmF0aW9ucygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29udGV4dE1lbnVBY3Rpb25zKGJyZWFrcG9pbnRzOiBSZWFkb25seUFycmF5PElCcmVha3BvaW50PiwgdXJpOiBVUkksIGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uPzogbnVtYmVyKTogSUFjdGlvbltdIHtcblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblxuXHRcdGlmIChicmVha3BvaW50cy5sZW5ndGggPT09IDEpIHtcblx0XHRcdGNvbnN0IGJyZWFrcG9pbnRUeXBlID0gYnJlYWtwb2ludHNbMF0ubG9nTWVzc2FnZSA/IG5scy5sb2NhbGl6ZSgnbG9nUG9pbnQnLCBcIkxvZ3BvaW50XCIpIDogbmxzLmxvY2FsaXplKCdicmVha3BvaW50JywgXCJCcmVha3BvaW50XCIpO1xuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oJ2RlYnVnLnJlbW92ZUJyZWFrcG9pbnQnLCBubHMubG9jYWxpemUoJ3JlbW92ZUJyZWFrcG9pbnQnLCBcIlJlbW92ZSB7MH1cIiwgYnJlYWtwb2ludFR5cGUpLCB1bmRlZmluZWQsIHRydWUsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5kZWJ1Z1NlcnZpY2UucmVtb3ZlQnJlYWtwb2ludHMoYnJlYWtwb2ludHNbMF0uZ2V0SWQoKSk7XG5cdFx0XHR9KSk7XG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0J3dvcmtiZW5jaC5kZWJ1Zy5hY3Rpb24uZWRpdEJyZWFrcG9pbnRBY3Rpb24nLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2VkaXRCcmVha3BvaW50JywgXCJFZGl0IHswfS4uLlwiLCBicmVha3BvaW50VHlwZSksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0KCkgPT4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuc2hvd0JyZWFrcG9pbnRXaWRnZXQoYnJlYWtwb2ludHNbMF0ubGluZU51bWJlciwgYnJlYWtwb2ludHNbMF0uY29sdW1uKSlcblx0XHRcdCkpO1xuXG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0YHdvcmtiZW5jaC5kZWJ1Zy52aWV3bGV0LmFjdGlvbi50b2dnbGVCcmVha3BvaW50YCxcblx0XHRcdFx0YnJlYWtwb2ludHNbMF0uZW5hYmxlZCA/IG5scy5sb2NhbGl6ZSgnZGlzYWJsZUJyZWFrcG9pbnQnLCBcIkRpc2FibGUgezB9XCIsIGJyZWFrcG9pbnRUeXBlKSA6IG5scy5sb2NhbGl6ZSgnZW5hYmxlQnJlYWtwb2ludCcsIFwiRW5hYmxlIHswfVwiLCBicmVha3BvaW50VHlwZSksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0KCkgPT4gdGhpcy5kZWJ1Z1NlcnZpY2UuZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHMoIWJyZWFrcG9pbnRzWzBdLmVuYWJsZWQsIGJyZWFrcG9pbnRzWzBdKVxuXHRcdFx0KSk7XG5cdFx0fSBlbHNlIGlmIChicmVha3BvaW50cy5sZW5ndGggPiAxKSB7XG5cdFx0XHRjb25zdCBzb3J0ZWQgPSBicmVha3BvaW50cy5zbGljZSgpLnNvcnQoKGZpcnN0LCBzZWNvbmQpID0+IChmaXJzdC5jb2x1bW4gJiYgc2Vjb25kLmNvbHVtbikgPyBmaXJzdC5jb2x1bW4gLSBzZWNvbmQuY29sdW1uIDogMSk7XG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IFN1Ym1lbnVBY3Rpb24oJ2RlYnVnLnJlbW92ZUJyZWFrcG9pbnRzJywgbmxzLmxvY2FsaXplKCdyZW1vdmVCcmVha3BvaW50cycsIFwiUmVtb3ZlIEJyZWFrcG9pbnRzXCIpLCBzb3J0ZWQubWFwKGJwID0+IG5ldyBBY3Rpb24oXG5cdFx0XHRcdCdyZW1vdmVJbmxpbmVCcmVha3BvaW50Jyxcblx0XHRcdFx0YnAuY29sdW1uID8gbmxzLmxvY2FsaXplKCdyZW1vdmVJbmxpbmVCcmVha3BvaW50T25Db2x1bW4nLCBcIlJlbW92ZSBJbmxpbmUgQnJlYWtwb2ludCBvbiBDb2x1bW4gezB9XCIsIGJwLmNvbHVtbikgOiBubHMubG9jYWxpemUoJ3JlbW92ZUxpbmVCcmVha3BvaW50JywgXCJSZW1vdmUgTGluZSBCcmVha3BvaW50XCIpLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdCgpID0+IHRoaXMuZGVidWdTZXJ2aWNlLnJlbW92ZUJyZWFrcG9pbnRzKGJwLmdldElkKCkpXG5cdFx0XHQpKSkpO1xuXG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IFN1Ym1lbnVBY3Rpb24oJ2RlYnVnLmVkaXRCcmVha3BvaW50cycsIG5scy5sb2NhbGl6ZSgnZWRpdEJyZWFrcG9pbnRzJywgXCJFZGl0IEJyZWFrcG9pbnRzXCIpLCBzb3J0ZWQubWFwKGJwID0+XG5cdFx0XHRcdG5ldyBBY3Rpb24oJ2VkaXRCcmVha3BvaW50Jyxcblx0XHRcdFx0XHRicC5jb2x1bW4gPyBubHMubG9jYWxpemUoJ2VkaXRJbmxpbmVCcmVha3BvaW50T25Db2x1bW4nLCBcIkVkaXQgSW5saW5lIEJyZWFrcG9pbnQgb24gQ29sdW1uIHswfVwiLCBicC5jb2x1bW4pIDogbmxzLmxvY2FsaXplKCdlZGl0TGluZUJyZWFrcG9pbnQnLCBcIkVkaXQgTGluZSBCcmVha3BvaW50XCIpLFxuXHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHR0cnVlLFxuXHRcdFx0XHRcdCgpID0+IFByb21pc2UucmVzb2x2ZSh0aGlzLnNob3dCcmVha3BvaW50V2lkZ2V0KGJwLmxpbmVOdW1iZXIsIGJwLmNvbHVtbikpXG5cdFx0XHRcdClcblx0XHRcdCkpKTtcblxuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBTdWJtZW51QWN0aW9uKCdkZWJ1Zy5lbmFibGVEaXNhYmxlQnJlYWtwb2ludHMnLCBubHMubG9jYWxpemUoJ2VuYWJsZURpc2FibGVCcmVha3BvaW50cycsIFwiRW5hYmxlL0Rpc2FibGUgQnJlYWtwb2ludHNcIiksIHNvcnRlZC5tYXAoYnAgPT4gbmV3IEFjdGlvbihcblx0XHRcdFx0YnAuZW5hYmxlZCA/ICdkaXNhYmxlQ29sdW1uQnJlYWtwb2ludCcgOiAnZW5hYmxlQ29sdW1uQnJlYWtwb2ludCcsXG5cdFx0XHRcdGJwLmVuYWJsZWQgPyAoYnAuY29sdW1uID8gbmxzLmxvY2FsaXplKCdkaXNhYmxlSW5saW5lQ29sdW1uQnJlYWtwb2ludCcsIFwiRGlzYWJsZSBJbmxpbmUgQnJlYWtwb2ludCBvbiBDb2x1bW4gezB9XCIsIGJwLmNvbHVtbikgOiBubHMubG9jYWxpemUoJ2Rpc2FibGVCcmVha3BvaW50T25MaW5lJywgXCJEaXNhYmxlIExpbmUgQnJlYWtwb2ludFwiKSlcblx0XHRcdFx0XHQ6IChicC5jb2x1bW4gPyBubHMubG9jYWxpemUoJ2VuYWJsZUJyZWFrcG9pbnRzJywgXCJFbmFibGUgSW5saW5lIEJyZWFrcG9pbnQgb24gQ29sdW1uIHswfVwiLCBicC5jb2x1bW4pIDogbmxzLmxvY2FsaXplKCdlbmFibGVCcmVha3BvaW50T25MaW5lJywgXCJFbmFibGUgTGluZSBCcmVha3BvaW50XCIpKSxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmRlYnVnU2VydmljZS5lbmFibGVPckRpc2FibGVCcmVha3BvaW50cyghYnAuZW5hYmxlZCwgYnApXG5cdFx0XHQpKSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0J2FkZEJyZWFrcG9pbnQnLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2FkZEJyZWFrcG9pbnQnLCBcIkFkZCBCcmVha3BvaW50XCIpLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdCgpID0+IHRoaXMuZGVidWdTZXJ2aWNlLmFkZEJyZWFrcG9pbnRzKHVyaSwgW3sgbGluZU51bWJlciwgY29sdW1uIH1dKVxuXHRcdFx0KSk7XG5cdFx0XHRhY3Rpb25zLnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0J2FkZENvbmRpdGlvbmFsQnJlYWtwb2ludCcsXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnYWRkQ29uZGl0aW9uYWxCcmVha3BvaW50JywgXCJBZGQgQ29uZGl0aW9uYWwgQnJlYWtwb2ludC4uLlwiKSxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHQoKSA9PiBQcm9taXNlLnJlc29sdmUodGhpcy5zaG93QnJlYWtwb2ludFdpZGdldChsaW5lTnVtYmVyLCBjb2x1bW4sIEJyZWFrcG9pbnRXaWRnZXRDb250ZXh0LkNPTkRJVElPTikpXG5cdFx0XHQpKTtcblx0XHRcdGFjdGlvbnMucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHQnYWRkTG9nUG9pbnQnLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2FkZExvZ1BvaW50JywgXCJBZGQgTG9ncG9pbnQuLi5cIiksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0KCkgPT4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuc2hvd0JyZWFrcG9pbnRXaWRnZXQobGluZU51bWJlciwgY29sdW1uLCBCcmVha3BvaW50V2lkZ2V0Q29udGV4dC5MT0dfTUVTU0FHRSkpXG5cdFx0XHQpKTtcblx0XHRcdGFjdGlvbnMucHVzaChuZXcgQWN0aW9uKFxuXHRcdFx0XHQnYWRkVHJpZ2dlcmVkQnJlYWtwb2ludCcsXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnYWRkVHJpZ2dlcmVkQnJlYWtwb2ludCcsIFwiQWRkIFRyaWdnZXJlZCBCcmVha3BvaW50Li4uXCIpLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdCgpID0+IFByb21pc2UucmVzb2x2ZSh0aGlzLnNob3dCcmVha3BvaW50V2lkZ2V0KGxpbmVOdW1iZXIsIGNvbHVtbiwgQnJlYWtwb2ludFdpZGdldENvbnRleHQuVFJJR0dFUl9QT0lOVCkpXG5cdFx0XHQpKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5kZWJ1Z1NlcnZpY2Uuc3RhdGUgPT09IFN0YXRlLlN0b3BwZWQpIHtcblx0XHRcdGFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdCdydW5Ub0xpbmUnLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3J1blRvTGluZScsIFwiUnVuIHRvIExpbmVcIiksXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0KCkgPT4gdGhpcy5kZWJ1Z1NlcnZpY2UucnVuVG8odXJpLCBsaW5lTnVtYmVyKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcilcblx0XHRcdCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBhY3Rpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBtYXJnaW5GcmVlRnJvbU5vbkRlYnVnRGVjb3JhdGlvbnMobGluZTogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbnMgPSB0aGlzLmVkaXRvci5nZXRMaW5lRGVjb3JhdGlvbnMobGluZSk7XG5cdFx0aWYgKGRlY29yYXRpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHsgb3B0aW9ucyB9IG9mIGRlY29yYXRpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGNseiA9IG9wdGlvbnMuZ2x5cGhNYXJnaW5DbGFzc05hbWU7XG5cdFx0XHRcdGlmICghY2x6KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgaGFzU29tZUFjdGlvbmFibGVDb2RpY29uID0gIShjbHouaW5jbHVkZXMoJ2NvZGljb24tJykgfHwgY2x6LnN0YXJ0c1dpdGgoJ2NvdmVyYWdlLWRlY28tJykpIHx8IGNsei5pbmNsdWRlcygnY29kaWNvbi10ZXN0aW5nLScpIHx8IGNsei5pbmNsdWRlcygnY29kaWNvbi1tZXJnZS0nKSB8fCBjbHouaW5jbHVkZXMoJ2NvZGljb24tYXJyb3ctJykgfHwgY2x6LmluY2x1ZGVzKCdjb2RpY29uLWxvYWRpbmcnKSB8fCBjbHouaW5jbHVkZXMoJ2NvZGljb24tZm9sZCcpIHx8IGNsei5pbmNsdWRlcygnY29kaWNvbi1ndXR0ZXItbGlnaHRidWxiJykgfHwgY2x6LmluY2x1ZGVzKCdjb2RpY29uLWxpZ2h0YnVsYi1zcGFya2xlJyk7XG5cdFx0XHRcdGlmIChoYXNTb21lQWN0aW9uYWJsZUNvZGljb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgZW5zdXJlQnJlYWtwb2ludEhpbnREZWNvcmF0aW9uKHNob3dCcmVha3BvaW50SGludEF0TGluZU51bWJlcjogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5lZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5icmVha3BvaW50SGludERlY29yYXRpb24pIHtcblx0XHRcdFx0YWNjZXNzb3IucmVtb3ZlRGVjb3JhdGlvbih0aGlzLmJyZWFrcG9pbnRIaW50RGVjb3JhdGlvbik7XG5cdFx0XHRcdHRoaXMuYnJlYWtwb2ludEhpbnREZWNvcmF0aW9uID0gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmIChzaG93QnJlYWtwb2ludEhpbnRBdExpbmVOdW1iZXIgIT09IC0xKSB7XG5cdFx0XHRcdHRoaXMuYnJlYWtwb2ludEhpbnREZWNvcmF0aW9uID0gYWNjZXNzb3IuYWRkRGVjb3JhdGlvbih7XG5cdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBzaG93QnJlYWtwb2ludEhpbnRBdExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogc2hvd0JyZWFrcG9pbnRIaW50QXRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdGVuZENvbHVtbjogMVxuXHRcdFx0XHR9LCBicmVha3BvaW50SGVscGVyRGVjb3JhdGlvblxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZXREZWNvcmF0aW9ucygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzZXRDYW5kaWRhdGVEZWNvcmF0aW9ucyA9IChjaGFuZ2VBY2Nlc3NvcjogSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgZGVzaXJlZENhbmRpZGF0ZVBvc2l0aW9uczogQnJlYWtwb2ludHNGb3JMaW5lW10pID0+IHtcblx0XHRcdGNvbnN0IGRlc2lyZWRDYW5kaWRhdGVEZWNvcmF0aW9ucyA9IGNyZWF0ZUNhbmRpZGF0ZURlY29yYXRpb25zKG1vZGVsLCB0aGlzLmJyZWFrcG9pbnREZWNvcmF0aW9ucywgZGVzaXJlZENhbmRpZGF0ZVBvc2l0aW9ucyk7XG5cdFx0XHRjb25zdCBjYW5kaWRhdGVEZWNvcmF0aW9uSWRzID0gY2hhbmdlQWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyh0aGlzLmNhbmRpZGF0ZURlY29yYXRpb25zLm1hcChjID0+IGMuZGVjb3JhdGlvbklkKSwgZGVzaXJlZENhbmRpZGF0ZURlY29yYXRpb25zKTtcblx0XHRcdHRoaXMuY2FuZGlkYXRlRGVjb3JhdGlvbnMuZm9yRWFjaChjYW5kaWRhdGUgPT4ge1xuXHRcdFx0XHRjYW5kaWRhdGUuaW5saW5lV2lkZ2V0LmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5jYW5kaWRhdGVEZWNvcmF0aW9ucyA9IGNhbmRpZGF0ZURlY29yYXRpb25JZHMubWFwKChkZWNvcmF0aW9uSWQsIGluZGV4KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IGRlc2lyZWRDYW5kaWRhdGVEZWNvcmF0aW9uc1tpbmRleF07XG5cdFx0XHRcdC8vIENhbmRpZGF0ZSBkZWNvcmF0aW9uIGhhcyBhIGJyZWFrcG9pbnQgYXR0YWNoZWQgd2hlbiBhIGJyZWFrcG9pbnQgaXMgYWxyZWFkeSBhdCB0aGF0IGxvY2F0aW9uIGFuZCB3ZSBkaWQgbm90IHlldCBzZXQgYSBkZWNvcmF0aW9uIHRoZXJlXG5cdFx0XHRcdC8vIEluIHByYWN0aWNlIHRoaXMgaGFwcGVucyBmb3IgdGhlIGZpcnN0IGJyZWFrcG9pbnQgdGhhdCB3YXMgc2V0IG9uIGEgbGluZVxuXHRcdFx0XHQvLyBXZSBjb3VsZCBoYXZlIGFsc28gcmVuZGVyZWQgdGhpcyBmaXJzdCBkZWNvcmF0aW9uIGFzIHBhcnQgb2YgZGVzaXJlZEJyZWFrcG9pbnREZWNvcmF0aW9ucyBob3dldmVyIGF0IHRoYXQgbW9tZW50IHdlIGhhdmUgbm8gbG9jYXRpb24gaW5mb3JtYXRpb25cblx0XHRcdFx0Y29uc3QgaWNvbiA9IGNhbmRpZGF0ZS5icmVha3BvaW50ID8gZ2V0QnJlYWtwb2ludE1lc3NhZ2VBbmRJY29uKHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlLCB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCksIGNhbmRpZGF0ZS5icmVha3BvaW50LCB0aGlzLmxhYmVsU2VydmljZSwgdGhpcy5kZWJ1Z1NlcnZpY2UuZ2V0TW9kZWwoKSkuaWNvbiA6IGljb25zLmJyZWFrcG9pbnQuZGlzYWJsZWQ7XG5cdFx0XHRcdGNvbnN0IGNvbnRleHRNZW51QWN0aW9ucyA9ICgpID0+IHRoaXMuZ2V0Q29udGV4dE1lbnVBY3Rpb25zKGNhbmRpZGF0ZS5icmVha3BvaW50ID8gW2NhbmRpZGF0ZS5icmVha3BvaW50XSA6IFtdLCBhY3RpdmVDb2RlRWRpdG9yLmdldE1vZGVsKCkudXJpLCBjYW5kaWRhdGUucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBjYW5kaWRhdGUucmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXHRcdFx0XHRjb25zdCBpbmxpbmVXaWRnZXQgPSBuZXcgSW5saW5lQnJlYWtwb2ludFdpZGdldChhY3RpdmVDb2RlRWRpdG9yLCBkZWNvcmF0aW9uSWQsIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShpY29uKSwgY2FuZGlkYXRlLmJyZWFrcG9pbnQsIHRoaXMuZGVidWdTZXJ2aWNlLCB0aGlzLmNvbnRleHRNZW51U2VydmljZSwgY29udGV4dE1lbnVBY3Rpb25zKTtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGRlY29yYXRpb25JZCxcblx0XHRcdFx0XHRpbmxpbmVXaWRnZXRcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXHRcdH07XG5cblx0XHRjb25zdCBhY3RpdmVDb2RlRWRpdG9yID0gdGhpcy5lZGl0b3I7XG5cdFx0Y29uc3QgbW9kZWwgPSBhY3RpdmVDb2RlRWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3QgYnJlYWtwb2ludHMgPSB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldEJyZWFrcG9pbnRzKHsgdXJpOiBtb2RlbC51cmkgfSk7XG5cdFx0Y29uc3QgZGVidWdTZXR0aW5ncyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SURlYnVnQ29uZmlndXJhdGlvbj4oJ2RlYnVnJyk7XG5cdFx0Y29uc3QgZGVzaXJlZEJyZWFrcG9pbnREZWNvcmF0aW9ucyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gY3JlYXRlQnJlYWtwb2ludERlY29yYXRpb25zKGFjY2Vzc29yLCBtb2RlbCwgYnJlYWtwb2ludHMsIHRoaXMuZGVidWdTZXJ2aWNlLnN0YXRlLCB0aGlzLmRlYnVnU2VydmljZS5nZXRNb2RlbCgpLmFyZUJyZWFrcG9pbnRzQWN0aXZhdGVkKCksIGRlYnVnU2V0dGluZ3Muc2hvd0JyZWFrcG9pbnRzSW5PdmVydmlld1J1bGVyKSk7XG5cblx0XHQvLyB0cnkgdG8gc2V0IGJyZWFrcG9pbnQgbG9jYXRpb24gY2FuZGlkYXRlcyBpbiB0aGUgc2FtZSBjaGFuZ2VEZWNvcmF0aW9ucygpXG5cdFx0Ly8gY2FsbCB0byBhdm9pZCBmbGlja2VyaW5nLCBpZiB0aGUgREEgcmVzcG9uZHMgcmVhc29uYWJseSBxdWlja2x5LlxuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmRlYnVnU2VydmljZS5nZXRWaWV3TW9kZWwoKS5mb2N1c2VkU2Vzc2lvbjtcblx0XHRjb25zdCBkZXNpcmVkQ2FuZGlkYXRlUG9zaXRpb25zID0gZGVidWdTZXR0aW5ncy5zaG93SW5saW5lQnJlYWtwb2ludENhbmRpZGF0ZXMgJiYgc2Vzc2lvbiA/IHJlcXVlc3RCcmVha3BvaW50Q2FuZGlkYXRlTG9jYXRpb25zKHRoaXMuZWRpdG9yLmdldE1vZGVsKCksIGRlc2lyZWRCcmVha3BvaW50RGVjb3JhdGlvbnMubWFwKGJwID0+IGJwLnJhbmdlLnN0YXJ0TGluZU51bWJlciksIHNlc3Npb24pIDogUHJvbWlzZS5yZXNvbHZlKFtdKTtcblx0XHRjb25zdCBkZXNpcmVkQ2FuZGlkYXRlUG9zaXRpb25zUmFjZWQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW2Rlc2lyZWRDYW5kaWRhdGVQb3NpdGlvbnMsIHRpbWVvdXQoNTAwKS50aGVuKCgpID0+IHVuZGVmaW5lZCldKTtcblx0XHRpZiAoZGVzaXJlZENhbmRpZGF0ZVBvc2l0aW9uc1JhY2VkID09PSB1bmRlZmluZWQpIHsgLy8gdGhlIHRpbWVvdXQgcmVzb2x2ZWQgZmlyc3Rcblx0XHRcdGRlc2lyZWRDYW5kaWRhdGVQb3NpdGlvbnMudGhlbih2ID0+IGFjdGl2ZUNvZGVFZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoZCA9PiBzZXRDYW5kaWRhdGVEZWNvcmF0aW9ucyhkLCB2KSkpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLmlnbm9yZURlY29yYXRpb25zQ2hhbmdlZEV2ZW50ID0gdHJ1ZTtcblxuXHRcdFx0Ly8gU2V0IGJyZWFrcG9pbnQgZGVjb3JhdGlvbnNcblx0XHRcdGFjdGl2ZUNvZGVFZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoKGNoYW5nZUFjY2Vzc29yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGRlY29yYXRpb25JZHMgPSBjaGFuZ2VBY2Nlc3Nvci5kZWx0YURlY29yYXRpb25zKHRoaXMuYnJlYWtwb2ludERlY29yYXRpb25zLm1hcChicGQgPT4gYnBkLmRlY29yYXRpb25JZCksIGRlc2lyZWRCcmVha3BvaW50RGVjb3JhdGlvbnMpO1xuXHRcdFx0XHR0aGlzLmJyZWFrcG9pbnREZWNvcmF0aW9ucy5mb3JFYWNoKGJwZCA9PiB7XG5cdFx0XHRcdFx0YnBkLmlubGluZVdpZGdldD8uZGlzcG9zZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5icmVha3BvaW50RGVjb3JhdGlvbnMgPSBkZWNvcmF0aW9uSWRzLm1hcCgoZGVjb3JhdGlvbklkLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRcdGxldCBpbmxpbmVXaWRnZXQ6IElubGluZUJyZWFrcG9pbnRXaWRnZXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Y29uc3QgYnJlYWtwb2ludCA9IGJyZWFrcG9pbnRzW2luZGV4XTtcblx0XHRcdFx0XHRpZiAoZGVzaXJlZEJyZWFrcG9pbnREZWNvcmF0aW9uc1tpbmRleF0ub3B0aW9ucy5iZWZvcmUpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvbnRleHRNZW51QWN0aW9ucyA9ICgpID0+IHRoaXMuZ2V0Q29udGV4dE1lbnVBY3Rpb25zKFticmVha3BvaW50XSwgYWN0aXZlQ29kZUVkaXRvci5nZXRNb2RlbCgpLnVyaSwgYnJlYWtwb2ludC5saW5lTnVtYmVyLCBicmVha3BvaW50LmNvbHVtbik7XG5cdFx0XHRcdFx0XHRpbmxpbmVXaWRnZXQgPSBuZXcgSW5saW5lQnJlYWtwb2ludFdpZGdldChhY3RpdmVDb2RlRWRpdG9yLCBkZWNvcmF0aW9uSWQsIGRlc2lyZWRCcmVha3BvaW50RGVjb3JhdGlvbnNbaW5kZXhdLm9wdGlvbnMuZ2x5cGhNYXJnaW5DbGFzc05hbWUsIGJyZWFrcG9pbnQsIHRoaXMuZGVidWdTZXJ2aWNlLCB0aGlzLmNvbnRleHRNZW51U2VydmljZSwgY29udGV4dE1lbnVBY3Rpb25zKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZGVjb3JhdGlvbklkLFxuXHRcdFx0XHRcdFx0YnJlYWtwb2ludCxcblx0XHRcdFx0XHRcdHJhbmdlOiBkZXNpcmVkQnJlYWtwb2ludERlY29yYXRpb25zW2luZGV4XS5yYW5nZSxcblx0XHRcdFx0XHRcdGlubGluZVdpZGdldFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChkZXNpcmVkQ2FuZGlkYXRlUG9zaXRpb25zUmFjZWQpIHtcblx0XHRcdFx0XHRzZXRDYW5kaWRhdGVEZWNvcmF0aW9ucyhjaGFuZ2VBY2Nlc3NvciwgZGVzaXJlZENhbmRpZGF0ZVBvc2l0aW9uc1JhY2VkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuaWdub3JlRGVjb3JhdGlvbnNDaGFuZ2VkRXZlbnQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGQgb2YgdGhpcy5icmVha3BvaW50RGVjb3JhdGlvbnMpIHtcblx0XHRcdGlmIChkLmlubGluZVdpZGdldCkge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KGQuaW5saW5lV2lkZ2V0KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uTW9kZWxEZWNvcmF0aW9uc0NoYW5nZWQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuYnJlYWtwb2ludERlY29yYXRpb25zLmxlbmd0aCA9PT0gMCB8fCB0aGlzLmlnbm9yZURlY29yYXRpb25zQ2hhbmdlZEV2ZW50IHx8ICF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHQvLyBJIGhhdmUgbm8gZGVjb3JhdGlvbnNcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IHNvbWV0aGluZ0NoYW5nZWQgPSBmYWxzZTtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0dGhpcy5icmVha3BvaW50RGVjb3JhdGlvbnMuZm9yRWFjaChicmVha3BvaW50RGVjb3JhdGlvbiA9PiB7XG5cdFx0XHRpZiAoc29tZXRoaW5nQ2hhbmdlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBuZXdCcmVha3BvaW50UmFuZ2UgPSBtb2RlbC5nZXREZWNvcmF0aW9uUmFuZ2UoYnJlYWtwb2ludERlY29yYXRpb24uZGVjb3JhdGlvbklkKTtcblx0XHRcdGlmIChuZXdCcmVha3BvaW50UmFuZ2UgJiYgKCFicmVha3BvaW50RGVjb3JhdGlvbi5yYW5nZS5lcXVhbHNSYW5nZShuZXdCcmVha3BvaW50UmFuZ2UpKSkge1xuXHRcdFx0XHRzb21ldGhpbmdDaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0YnJlYWtwb2ludERlY29yYXRpb24ucmFuZ2UgPSBuZXdCcmVha3BvaW50UmFuZ2U7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0aWYgKCFzb21ldGhpbmdDaGFuZ2VkKSB7XG5cdFx0XHQvLyBub3RoaW5nIHRvIGRvLCBteSBkZWNvcmF0aW9ucyBkaWQgbm90IGNoYW5nZS5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0gbmV3IE1hcDxzdHJpbmcsIElCcmVha3BvaW50VXBkYXRlRGF0YT4oKTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5icmVha3BvaW50RGVjb3JhdGlvbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGJyZWFrcG9pbnREZWNvcmF0aW9uID0gdGhpcy5icmVha3BvaW50RGVjb3JhdGlvbnNbaV07XG5cdFx0XHRjb25zdCBkZWNvcmF0aW9uUmFuZ2UgPSBtb2RlbC5nZXREZWNvcmF0aW9uUmFuZ2UoYnJlYWtwb2ludERlY29yYXRpb24uZGVjb3JhdGlvbklkKTtcblx0XHRcdC8vIGNoZWNrIGlmIHRoZSBsaW5lIGdvdCBkZWxldGVkLlxuXHRcdFx0aWYgKGRlY29yYXRpb25SYW5nZSkge1xuXHRcdFx0XHQvLyBzaW5jZSB3ZSBrbm93IGl0IGlzIGNvbGxhcHNlZCwgaXQgY2Fubm90IGdyb3cgdG8gbXVsdGlwbGUgbGluZXNcblx0XHRcdFx0aWYgKGJyZWFrcG9pbnREZWNvcmF0aW9uLmJyZWFrcG9pbnQpIHtcblx0XHRcdFx0XHRkYXRhLnNldChicmVha3BvaW50RGVjb3JhdGlvbi5icmVha3BvaW50LmdldElkKCksIHtcblx0XHRcdFx0XHRcdGxpbmVOdW1iZXI6IGRlY29yYXRpb25SYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRjb2x1bW46IGJyZWFrcG9pbnREZWNvcmF0aW9uLmJyZWFrcG9pbnQuY29sdW1uID8gZGVjb3JhdGlvblJhbmdlLnN0YXJ0Q29sdW1uIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuaWdub3JlQnJlYWtwb2ludHNDaGFuZ2VFdmVudCA9IHRydWU7XG5cdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS51cGRhdGVCcmVha3BvaW50cyhtb2RlbC51cmksIGRhdGEsIHRydWUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLmlnbm9yZUJyZWFrcG9pbnRzQ2hhbmdlRXZlbnQgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHQvLyBicmVha3BvaW50IHdpZGdldFxuXHRzaG93QnJlYWtwb2ludFdpZGdldChsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyIHwgdW5kZWZpbmVkLCBjb250ZXh0PzogQnJlYWtwb2ludFdpZGdldENvbnRleHQpOiB2b2lkIHtcblx0XHR0aGlzLmJyZWFrcG9pbnRXaWRnZXQ/LmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuYnJlYWtwb2ludFdpZGdldCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQnJlYWtwb2ludFdpZGdldCwgdGhpcy5lZGl0b3IsIGxpbmVOdW1iZXIsIGNvbHVtbiwgY29udGV4dCk7XG5cdFx0dGhpcy5icmVha3BvaW50V2lkZ2V0LnNob3coeyBsaW5lTnVtYmVyLCBjb2x1bW46IDEgfSk7XG5cdFx0dGhpcy5icmVha3BvaW50V2lkZ2V0VmlzaWJsZS5zZXQodHJ1ZSk7XG5cdH1cblxuXHRjbG9zZUJyZWFrcG9pbnRXaWRnZXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuYnJlYWtwb2ludFdpZGdldCkge1xuXHRcdFx0dGhpcy5icmVha3BvaW50V2lkZ2V0LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuYnJlYWtwb2ludFdpZGdldCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuYnJlYWtwb2ludFdpZGdldFZpc2libGUucmVzZXQoKTtcblx0XHRcdHRoaXMuZWRpdG9yLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmJyZWFrcG9pbnRXaWRnZXQ/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLmVkaXRvci5yZW1vdmVEZWNvcmF0aW9ucyh0aGlzLmJyZWFrcG9pbnREZWNvcmF0aW9ucy5tYXAoYnBkID0+IGJwZC5kZWNvcmF0aW9uSWQpKTtcblx0XHRkaXNwb3NlKHRoaXMudG9EaXNwb3NlKTtcblx0fVxufVxuXG5HdXR0ZXJBY3Rpb25zUmVnaXN0cnkucmVnaXN0ZXJHdXR0ZXJBY3Rpb25zR2VuZXJhdG9yKCh7IGxpbmVOdW1iZXIsIGVkaXRvciwgYWNjZXNzb3IgfSwgcmVzdWx0KSA9PiB7XG5cdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdGNvbnN0IGRlYnVnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGVidWdTZXJ2aWNlKTtcblx0aWYgKCFtb2RlbCB8fCAhZGVidWdTZXJ2aWNlLmdldEFkYXB0ZXJNYW5hZ2VyKCkuaGFzRW5hYmxlZERlYnVnZ2VycygpIHx8ICFkZWJ1Z1NlcnZpY2UuY2FuU2V0QnJlYWtwb2ludHNJbihtb2RlbCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCBicmVha3BvaW50RWRpdG9yQ29udHJpYnV0aW9uID0gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxJQnJlYWtwb2ludEVkaXRvckNvbnRyaWJ1dGlvbj4oQlJFQUtQT0lOVF9FRElUT1JfQ09OVFJJQlVUSU9OX0lEKTtcblx0aWYgKCFicmVha3BvaW50RWRpdG9yQ29udHJpYnV0aW9uKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgYWN0aW9ucyA9IGJyZWFrcG9pbnRFZGl0b3JDb250cmlidXRpb24uZ2V0Q29udGV4dE1lbnVBY3Rpb25zQXRQb3NpdGlvbihsaW5lTnVtYmVyLCBtb2RlbCk7XG5cblx0Zm9yIChjb25zdCBhY3Rpb24gb2YgYWN0aW9ucykge1xuXHRcdHJlc3VsdC5wdXNoKGFjdGlvbiwgJzJfZGVidWcnKTtcblx0fVxufSk7XG5cbmNsYXNzIElubGluZUJyZWFrcG9pbnRXaWRnZXQgaW1wbGVtZW50cyBJQ29udGVudFdpZGdldCwgSURpc3Bvc2FibGUge1xuXG5cdC8vIGVkaXRvci5JQ29udGVudFdpZGdldC5hbGxvd0VkaXRvck92ZXJmbG93XG5cdGFsbG93RWRpdG9yT3ZlcmZsb3cgPSBmYWxzZTtcblx0c3VwcHJlc3NNb3VzZURvd24gPSB0cnVlO1xuXG5cdHByaXZhdGUgZG9tTm9kZSE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJhbmdlOiBSYW5nZSB8IG51bGw7XG5cdHByaXZhdGUgdG9EaXNwb3NlOiBJRGlzcG9zYWJsZVtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGVjb3JhdGlvbklkOiBzdHJpbmcsXG5cdFx0Y3NzQ2xhc3M6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBicmVha3BvaW50OiBJQnJlYWtwb2ludCB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRlYnVnU2VydmljZTogSURlYnVnU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGdldENvbnRleHRNZW51QWN0aW9uczogKCkgPT4gSUFjdGlvbltdXG5cdCkge1xuXHRcdHRoaXMucmFuZ2UgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLmdldERlY29yYXRpb25SYW5nZShkZWNvcmF0aW9uSWQpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbERlY29yYXRpb25zKCgpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGNvbnN0IHJhbmdlID0gbW9kZWwuZ2V0RGVjb3JhdGlvblJhbmdlKHRoaXMuZGVjb3JhdGlvbklkKTtcblx0XHRcdGlmICh0aGlzLnJhbmdlICYmICF0aGlzLnJhbmdlLmVxdWFsc1JhbmdlKHJhbmdlKSkge1xuXHRcdFx0XHR0aGlzLnJhbmdlID0gcmFuZ2U7XG5cdFx0XHRcdHRoaXMuZWRpdG9yLmxheW91dENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuY3JlYXRlKGNzc0NsYXNzKTtcblxuXHRcdHRoaXMuZWRpdG9yLmFkZENvbnRlbnRXaWRnZXQodGhpcyk7XG5cdFx0dGhpcy5lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlKGNzc0NsYXNzOiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5kb21Ob2RlID0gJCgnLmlubGluZS1icmVha3BvaW50LXdpZGdldCcpO1xuXHRcdGlmIChjc3NDbGFzcykge1xuXHRcdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoLi4uY3NzQ2xhc3Muc3BsaXQoJyAnKSk7XG5cdFx0fVxuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2goZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmRvbU5vZGUsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGFzeW5jIGUgPT4ge1xuXHRcdFx0c3dpdGNoICh0aGlzLmJyZWFrcG9pbnQ/LmVuYWJsZWQpIHtcblx0XHRcdFx0Y2FzZSB1bmRlZmluZWQ6XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5kZWJ1Z1NlcnZpY2UuYWRkQnJlYWtwb2ludHModGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS51cmksIFt7IGxpbmVOdW1iZXI6IHRoaXMucmFuZ2UhLnN0YXJ0TGluZU51bWJlciwgY29sdW1uOiB0aGlzLnJhbmdlIS5zdGFydENvbHVtbiB9XSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgdHJ1ZTpcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRlYnVnU2VydmljZS5yZW1vdmVCcmVha3BvaW50cyh0aGlzLmJyZWFrcG9pbnQuZ2V0SWQoKSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgZmFsc2U6XG5cdFx0XHRcdFx0dGhpcy5kZWJ1Z1NlcnZpY2UuZW5hYmxlT3JEaXNhYmxlQnJlYWtwb2ludHModHJ1ZSwgdGhpcy5icmVha3BvaW50KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZG9tTm9kZSwgZG9tLkV2ZW50VHlwZS5DT05URVhUX01FTlUsIGUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGRvbS5nZXRXaW5kb3codGhpcy5kb21Ob2RlKSwgZSk7XG5cdFx0XHRjb25zdCBhY3Rpb25zID0gdGhpcy5nZXRDb250ZXh0TWVudUFjdGlvbnMoKTtcblx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMsXG5cdFx0XHRcdGdldEFjdGlvbnNDb250ZXh0OiAoKSA9PiB0aGlzLmJyZWFrcG9pbnQsXG5cdFx0XHRcdG9uSGlkZTogKCkgPT4gZGlzcG9zZUlmRGlzcG9zYWJsZShhY3Rpb25zKVxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdXBkYXRlU2l6ZSA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGxpbmVIZWlnaHQgPSB0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdFx0dGhpcy5kb21Ob2RlLnN0eWxlLmhlaWdodCA9IGAke2xpbmVIZWlnaHR9cHhgO1xuXHRcdFx0dGhpcy5kb21Ob2RlLnN0eWxlLndpZHRoID0gYCR7TWF0aC5jZWlsKDAuOCAqIGxpbmVIZWlnaHQpfXB4YDtcblx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5tYXJnaW5MZWZ0ID0gYDRweGA7XG5cdFx0fTtcblx0XHR1cGRhdGVTaXplKCk7XG5cblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihjID0+IHtcblx0XHRcdGlmIChjLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmZvbnRTaXplKSB8fCBjLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpKSB7XG5cdFx0XHRcdHVwZGF0ZVNpemUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRAbWVtb2l6ZVxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBnZW5lcmF0ZVV1aWQoKTtcblx0fVxuXG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLmRvbU5vZGU7XG5cdH1cblxuXHRnZXRQb3NpdGlvbigpOiBJQ29udGVudFdpZGdldFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLnJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Ly8gV29ya2Fyb3VuZDogc2luY2UgdGhlIGNvbnRlbnQgd2lkZ2V0IGNhbiBub3QgYmUgcGxhY2VkIGJlZm9yZSB0aGUgZmlyc3QgY29sdW1uIHdlIG5lZWQgdG8gZm9yY2UgdGhlIGxlZnQgcG9zaXRpb25cblx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnbGluZS1zdGFydCcsIHRoaXMucmFuZ2Uuc3RhcnRDb2x1bW4gPT09IDEpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHBvc2l0aW9uOiB7IGxpbmVOdW1iZXI6IHRoaXMucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBjb2x1bW46IHRoaXMucmFuZ2Uuc3RhcnRDb2x1bW4gLSAxIH0sXG5cdFx0XHRwcmVmZXJlbmNlOiBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5FWEFDVF1cblx0XHR9O1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvci5yZW1vdmVDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHRcdGRpc3Bvc2UodGhpcy50b0Rpc3Bvc2UpO1xuXHR9XG59XG5cbnJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50KCh0aGVtZSwgY29sbGVjdG9yKSA9PiB7XG5cdGNvbnN0IHNjb3BlID0gJy5tb25hY28tZWRpdG9yIC5nbHlwaC1tYXJnaW4td2lkZ2V0cywgLm1vbmFjby13b3JrYmVuY2ggLmRlYnVnLWJyZWFrcG9pbnRzLCAubW9uYWNvLXdvcmtiZW5jaCAuZGlzYXNzZW1ibHktdmlldywgLm1vbmFjby1lZGl0b3IgLmNvbnRlbnRXaWRnZXRzJztcblx0Y29uc3QgZGVidWdJY29uQnJlYWtwb2ludENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdJY29uQnJlYWtwb2ludEZvcmVncm91bmQpO1xuXHRpZiAoZGVidWdJY29uQnJlYWtwb2ludENvbG9yKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYCR7c2NvcGV9IHtcblx0XHRcdCR7aWNvbnMuYWxsQnJlYWtwb2ludHMubWFwKGIgPT4gYCR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoYi5yZWd1bGFyKX1gKS5qb2luKCcsXFxuXHRcdCcpfSxcblx0XHRcdCR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuZGVidWdCcmVha3BvaW50VW5zdXBwb3J0ZWQpfSxcblx0XHRcdCR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuZGVidWdCcmVha3BvaW50SGludCl9Om5vdChbY2xhc3MqPSdjb2RpY29uLWRlYnVnLWJyZWFrcG9pbnQnXSk6bm90KFtjbGFzcyo9J2NvZGljb24tZGVidWctc3RhY2tmcmFtZSddKSxcblx0XHRcdCR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuYnJlYWtwb2ludC5yZWd1bGFyKX0ke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RhY2tmcmFtZUZvY3VzZWQpfTo6YWZ0ZXIsXG5cdFx0XHQke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmJyZWFrcG9pbnQucmVndWxhcil9JHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z1N0YWNrZnJhbWUpfTo6YWZ0ZXIge1xuXHRcdFx0XHRjb2xvcjogJHtkZWJ1Z0ljb25CcmVha3BvaW50Q29sb3J9ICFpbXBvcnRhbnQ7XG5cdFx0XHR9XG5cdFx0fWApO1xuXG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYCR7c2NvcGV9IHtcblx0XHRcdCR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaWNvbnMuYnJlYWtwb2ludC5wZW5kaW5nKX0ge1xuXHRcdFx0XHRjb2xvcjogJHtkZWJ1Z0ljb25CcmVha3BvaW50Q29sb3J9ICFpbXBvcnRhbnQ7XG5cdFx0XHRcdGZvbnQtc2l6ZTogMTJweCAhaW1wb3J0YW50O1xuXHRcdFx0fVxuXHRcdH1gKTtcblx0fVxuXG5cdGNvbnN0IGRlYnVnSWNvbkJyZWFrcG9pbnREaXNhYmxlZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdJY29uQnJlYWtwb2ludERpc2FibGVkRm9yZWdyb3VuZCk7XG5cdGlmIChkZWJ1Z0ljb25CcmVha3BvaW50RGlzYWJsZWRDb2xvcikge1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAke3Njb3BlfSB7XG5cdFx0XHQke2ljb25zLmFsbEJyZWFrcG9pbnRzLm1hcChiID0+IFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGIuZGlzYWJsZWQpKS5qb2luKCcsXFxuXHRcdCcpfSB7XG5cdFx0XHRcdGNvbG9yOiAke2RlYnVnSWNvbkJyZWFrcG9pbnREaXNhYmxlZENvbG9yfTtcblx0XHRcdH1cblx0XHR9YCk7XG5cdH1cblxuXHRjb25zdCBkZWJ1Z0ljb25CcmVha3BvaW50VW52ZXJpZmllZENvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZGVidWdJY29uQnJlYWtwb2ludFVudmVyaWZpZWRGb3JlZ3JvdW5kKTtcblx0aWYgKGRlYnVnSWNvbkJyZWFrcG9pbnRVbnZlcmlmaWVkQ29sb3IpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgJHtzY29wZX0ge1xuXHRcdFx0JHtpY29ucy5hbGxCcmVha3BvaW50cy5tYXAoYiA9PiBUaGVtZUljb24uYXNDU1NTZWxlY3RvcihiLnVudmVyaWZpZWQpKS5qb2luKCcsXFxuXHRcdCcpfSB7XG5cdFx0XHRcdGNvbG9yOiAke2RlYnVnSWNvbkJyZWFrcG9pbnRVbnZlcmlmaWVkQ29sb3J9O1xuXHRcdFx0fVxuXHRcdH1gKTtcblx0fVxuXG5cdGNvbnN0IGRlYnVnSWNvbkJyZWFrcG9pbnRDdXJyZW50U3RhY2tmcmFtZUZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnSWNvbkJyZWFrcG9pbnRDdXJyZW50U3RhY2tmcmFtZUZvcmVncm91bmQpO1xuXHRpZiAoZGVidWdJY29uQnJlYWtwb2ludEN1cnJlbnRTdGFja2ZyYW1lRm9yZWdyb3VuZENvbG9yKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYFxuXHRcdC5tb25hY28tZWRpdG9yIC5kZWJ1Zy10b3Atc3RhY2stZnJhbWUtY29sdW1uIHtcblx0XHRcdGNvbG9yOiAke2RlYnVnSWNvbkJyZWFrcG9pbnRDdXJyZW50U3RhY2tmcmFtZUZvcmVncm91bmRDb2xvcn0gIWltcG9ydGFudDtcblx0XHR9XG5cdFx0JHtzY29wZX0ge1xuXHRcdFx0JHtUaGVtZUljb24uYXNDU1NTZWxlY3RvcihpY29ucy5kZWJ1Z1N0YWNrZnJhbWUpfSB7XG5cdFx0XHRcdGNvbG9yOiAke2RlYnVnSWNvbkJyZWFrcG9pbnRDdXJyZW50U3RhY2tmcmFtZUZvcmVncm91bmRDb2xvcn0gIWltcG9ydGFudDtcblx0XHRcdH1cblx0XHR9XG5cdFx0YCk7XG5cdH1cblxuXHRjb25zdCBkZWJ1Z0ljb25CcmVha3BvaW50U3RhY2tmcmFtZUZvY3VzZWRDb2xvciA9IHRoZW1lLmdldENvbG9yKGRlYnVnSWNvbkJyZWFrcG9pbnRTdGFja2ZyYW1lRm9yZWdyb3VuZCk7XG5cdGlmIChkZWJ1Z0ljb25CcmVha3BvaW50U3RhY2tmcmFtZUZvY3VzZWRDb2xvcikge1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAke3Njb3BlfSB7XG5cdFx0XHQke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb25zLmRlYnVnU3RhY2tmcmFtZUZvY3VzZWQpfSB7XG5cdFx0XHRcdGNvbG9yOiAke2RlYnVnSWNvbkJyZWFrcG9pbnRTdGFja2ZyYW1lRm9jdXNlZENvbG9yfSAhaW1wb3J0YW50O1xuXHRcdFx0fVxuXHRcdH1gKTtcblx0fVxufSk7XG5cbmV4cG9ydCBjb25zdCBkZWJ1Z0ljb25CcmVha3BvaW50Rm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnSWNvbi5icmVha3BvaW50Rm9yZWdyb3VuZCcsICcjRTUxNDAwJywgbmxzLmxvY2FsaXplKCdkZWJ1Z0ljb24uYnJlYWtwb2ludEZvcmVncm91bmQnLCAnSWNvbiBjb2xvciBmb3IgYnJlYWtwb2ludHMuJykpO1xuY29uc3QgZGVidWdJY29uQnJlYWtwb2ludERpc2FibGVkRm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnSWNvbi5icmVha3BvaW50RGlzYWJsZWRGb3JlZ3JvdW5kJywgJyM4NDg0ODQnLCBubHMubG9jYWxpemUoJ2RlYnVnSWNvbi5icmVha3BvaW50RGlzYWJsZWRGb3JlZ3JvdW5kJywgJ0ljb24gY29sb3IgZm9yIGRpc2FibGVkIGJyZWFrcG9pbnRzLicpKTtcbmNvbnN0IGRlYnVnSWNvbkJyZWFrcG9pbnRVbnZlcmlmaWVkRm9yZWdyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2RlYnVnSWNvbi5icmVha3BvaW50VW52ZXJpZmllZEZvcmVncm91bmQnLCAnIzg0ODQ4NCcsIG5scy5sb2NhbGl6ZSgnZGVidWdJY29uLmJyZWFrcG9pbnRVbnZlcmlmaWVkRm9yZWdyb3VuZCcsICdJY29uIGNvbG9yIGZvciB1bnZlcmlmaWVkIGJyZWFrcG9pbnRzLicpKTtcbmNvbnN0IGRlYnVnSWNvbkJyZWFrcG9pbnRDdXJyZW50U3RhY2tmcmFtZUZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0ljb24uYnJlYWtwb2ludEN1cnJlbnRTdGFja2ZyYW1lRm9yZWdyb3VuZCcsIHsgZGFyazogJyNGRkNDMDAnLCBsaWdodDogJyNCRTg3MDAnLCBoY0Rhcms6ICcjRkZDQzAwJywgaGNMaWdodDogJyNCRTg3MDAnIH0sIG5scy5sb2NhbGl6ZSgnZGVidWdJY29uLmJyZWFrcG9pbnRDdXJyZW50U3RhY2tmcmFtZUZvcmVncm91bmQnLCAnSWNvbiBjb2xvciBmb3IgdGhlIGN1cnJlbnQgYnJlYWtwb2ludCBzdGFjayBmcmFtZS4nKSk7XG5jb25zdCBkZWJ1Z0ljb25CcmVha3BvaW50U3RhY2tmcmFtZUZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdkZWJ1Z0ljb24uYnJlYWtwb2ludFN0YWNrZnJhbWVGb3JlZ3JvdW5kJywgJyM4OUQxODUnLCBubHMubG9jYWxpemUoJ2RlYnVnSWNvbi5icmVha3BvaW50U3RhY2tmcmFtZUZvcmVncm91bmQnLCAnSWNvbiBjb2xvciBmb3IgYWxsIGJyZWFrcG9pbnQgc3RhY2sgZnJhbWVzLicpKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsUUFBaUIsV0FBVyxxQkFBcUI7QUFDMUQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBa0IsZUFBZTtBQUMxQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxTQUFTLDJCQUF3QztBQUMxRCxZQUFZLFNBQVM7QUFDckIsT0FBTyxjQUFjO0FBQ3JCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsaUNBQTRILHVCQUF1QjtBQUM1SixTQUFTLG9CQUFvQjtBQUU3QixTQUFTLGFBQWE7QUFDdEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxpQkFBNkgsbUJBQW1CLDhCQUE4QjtBQUN2TCxZQUFZLFNBQVM7QUFDckIsU0FBUyw2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
