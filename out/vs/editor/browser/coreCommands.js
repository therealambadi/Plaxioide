import * as nls from "../../nls.js";
import { isFirefox } from "../../base/browser/browser.js";
import { KeyCode, KeyMod } from "../../base/common/keyCodes.js";
import * as types from "../../base/common/types.js";
import { status } from "../../base/browser/ui/aria/aria.js";
import { Command, EditorCommand, registerEditorCommand, UndoCommand, RedoCommand, SelectAllCommand } from "./editorExtensions.js";
import { ICodeEditorService } from "./services/codeEditorService.js";
import { ColumnSelection } from "../common/cursor/cursorColumnSelection.js";
import { CursorState, EditOperationType } from "../common/cursorCommon.js";
import { DeleteOperations } from "../common/cursor/cursorDeleteOperations.js";
import { CursorChangeReason } from "../common/cursorEvents.js";
import { CursorMove as CursorMove_, CursorMoveCommands } from "../common/cursor/cursorMoveCommands.js";
import { TypeOperations } from "../common/cursor/cursorTypeOperations.js";
import { Position } from "../common/core/position.js";
import { Range } from "../common/core/range.js";
import { Handler, ScrollType } from "../common/editorCommon.js";
import { EditorContextKeys } from "../common/editorContextKeys.js";
import { VerticalRevealType } from "../common/viewEvents.js";
import { ContextKeyExpr } from "../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight, KeybindingsRegistry } from "../../platform/keybinding/common/keybindingsRegistry.js";
import { EditorOption } from "../common/config/editorOptions.js";
import { getActiveElement, isEditableElement } from "../../base/browser/dom.js";
import { EnterOperation } from "../common/cursor/cursorTypeEditOperations.js";
const CORE_WEIGHT = KeybindingWeight.EditorCore;
class CoreEditorCommand extends EditorCommand {
  runEditorCommand(accessor, editor, args) {
    const viewModel = editor._getViewModel();
    if (!viewModel) {
      return;
    }
    this.runCoreEditorCommand(viewModel, args || {});
  }
}
var EditorScroll_;
((EditorScroll_2) => {
  const isEditorScrollArgs = function(arg) {
    if (!types.isObject(arg)) {
      return false;
    }
    const scrollArg = arg;
    if (!types.isString(scrollArg.to)) {
      return false;
    }
    if (!types.isUndefined(scrollArg.by) && !types.isString(scrollArg.by)) {
      return false;
    }
    if (!types.isUndefined(scrollArg.value) && !types.isNumber(scrollArg.value)) {
      return false;
    }
    if (!types.isUndefined(scrollArg.revealCursor) && !types.isBoolean(scrollArg.revealCursor)) {
      return false;
    }
    return true;
  };
  EditorScroll_2.metadata = {
    description: "Scroll editor in the given direction",
    args: [
      {
        name: "Editor scroll argument object",
        description: `Property-value pairs that can be passed through this argument:
					* 'to': A mandatory direction value.
						\`\`\`
						'up', 'down'
						\`\`\`
					* 'by': Unit to move. Default is computed based on 'to' value.
						\`\`\`
						'line', 'wrappedLine', 'page', 'halfPage', 'editor'
						\`\`\`
					* 'value': Number of units to move. Default is '1'.
					* 'revealCursor': If 'true' reveals the cursor if it is outside view port.
				`,
        constraint: isEditorScrollArgs,
        schema: {
          "type": "object",
          "required": ["to"],
          "properties": {
            "to": {
              "type": "string",
              "enum": ["up", "down"]
            },
            "by": {
              "type": "string",
              "enum": ["line", "wrappedLine", "page", "halfPage", "editor"]
            },
            "value": {
              "type": "number",
              "default": 1
            },
            "revealCursor": {
              "type": "boolean"
            }
          }
        }
      }
    ]
  };
  EditorScroll_2.RawDirection = {
    Up: "up",
    Right: "right",
    Down: "down",
    Left: "left"
  };
  EditorScroll_2.RawUnit = {
    Line: "line",
    WrappedLine: "wrappedLine",
    Page: "page",
    HalfPage: "halfPage",
    Editor: "editor",
    Column: "column"
  };
  function parse(args) {
    let direction;
    switch (args.to) {
      case EditorScroll_2.RawDirection.Up:
        direction = 1 /* Up */;
        break;
      case EditorScroll_2.RawDirection.Right:
        direction = 2 /* Right */;
        break;
      case EditorScroll_2.RawDirection.Down:
        direction = 3 /* Down */;
        break;
      case EditorScroll_2.RawDirection.Left:
        direction = 4 /* Left */;
        break;
      default:
        return null;
    }
    let unit;
    switch (args.by) {
      case EditorScroll_2.RawUnit.Line:
        unit = 1 /* Line */;
        break;
      case EditorScroll_2.RawUnit.WrappedLine:
        unit = 2 /* WrappedLine */;
        break;
      case EditorScroll_2.RawUnit.Page:
        unit = 3 /* Page */;
        break;
      case EditorScroll_2.RawUnit.HalfPage:
        unit = 4 /* HalfPage */;
        break;
      case EditorScroll_2.RawUnit.Editor:
        unit = 5 /* Editor */;
        break;
      case EditorScroll_2.RawUnit.Column:
        unit = 6 /* Column */;
        break;
      default:
        unit = 2 /* WrappedLine */;
    }
    const value = Math.floor(args.value || 1);
    const revealCursor = !!args.revealCursor;
    return {
      direction,
      unit,
      value,
      revealCursor,
      select: !!args.select
    };
  }
  EditorScroll_2.parse = parse;
  let Direction;
  ((Direction2) => {
    Direction2[Direction2["Up"] = 1] = "Up";
    Direction2[Direction2["Right"] = 2] = "Right";
    Direction2[Direction2["Down"] = 3] = "Down";
    Direction2[Direction2["Left"] = 4] = "Left";
  })(Direction = EditorScroll_2.Direction || (EditorScroll_2.Direction = {}));
  let Unit;
  ((Unit2) => {
    Unit2[Unit2["Line"] = 1] = "Line";
    Unit2[Unit2["WrappedLine"] = 2] = "WrappedLine";
    Unit2[Unit2["Page"] = 3] = "Page";
    Unit2[Unit2["HalfPage"] = 4] = "HalfPage";
    Unit2[Unit2["Editor"] = 5] = "Editor";
    Unit2[Unit2["Column"] = 6] = "Column";
  })(Unit = EditorScroll_2.Unit || (EditorScroll_2.Unit = {}));
})(EditorScroll_ || (EditorScroll_ = {}));
var RevealLine_;
((RevealLine_2) => {
  const isRevealLineArgs = function(arg) {
    if (!types.isObject(arg)) {
      return false;
    }
    const reveaLineArg = arg;
    if (!types.isNumber(reveaLineArg.lineNumber) && !types.isString(reveaLineArg.lineNumber)) {
      return false;
    }
    if (!types.isUndefined(reveaLineArg.at) && !types.isString(reveaLineArg.at)) {
      return false;
    }
    return true;
  };
  RevealLine_2.metadata = {
    description: "Reveal the given line at the given logical position",
    args: [
      {
        name: "Reveal line argument object",
        description: `Property-value pairs that can be passed through this argument:
					* 'lineNumber': A mandatory line number value.
					* 'at': Logical position at which line has to be revealed.
						\`\`\`
						'top', 'center', 'bottom'
						\`\`\`
				`,
        constraint: isRevealLineArgs,
        schema: {
          "type": "object",
          "required": ["lineNumber"],
          "properties": {
            "lineNumber": {
              "type": ["number", "string"]
            },
            "at": {
              "type": "string",
              "enum": ["top", "center", "bottom"]
            }
          }
        }
      }
    ]
  };
  RevealLine_2.RawAtArgument = {
    Top: "top",
    Center: "center",
    Bottom: "bottom"
  };
})(RevealLine_ || (RevealLine_ = {}));
class EditorOrNativeTextInputCommand {
  constructor(target) {
    target.addImplementation(1e4, "code-editor", (accessor, args) => {
      const focusedEditor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
      if (focusedEditor && focusedEditor.hasTextFocus()) {
        return this._runEditorCommand(accessor, focusedEditor, args);
      }
      return false;
    });
    target.addImplementation(1e3, "generic-dom-input-textarea", (accessor, args) => {
      const activeElement = getActiveElement();
      if (activeElement && isEditableElement(activeElement)) {
        this.runDOMCommand(activeElement);
        return true;
      }
      return false;
    });
    target.addImplementation(0, "generic-dom", (accessor, args) => {
      const activeEditor = accessor.get(ICodeEditorService).getActiveCodeEditor();
      if (activeEditor) {
        activeEditor.focus();
        return this._runEditorCommand(accessor, activeEditor, args);
      }
      return false;
    });
  }
  _runEditorCommand(accessor, editor, args) {
    const result = this.runEditorCommand(accessor, editor, args);
    if (result) {
      return result;
    }
    return true;
  }
}
var NavigationCommandRevealType = /* @__PURE__ */ ((NavigationCommandRevealType2) => {
  NavigationCommandRevealType2[NavigationCommandRevealType2["Regular"] = 0] = "Regular";
  NavigationCommandRevealType2[NavigationCommandRevealType2["Minimal"] = 1] = "Minimal";
  NavigationCommandRevealType2[NavigationCommandRevealType2["None"] = 2] = "None";
  return NavigationCommandRevealType2;
})(NavigationCommandRevealType || {});
var CoreNavigationCommands;
((CoreNavigationCommands2) => {
  class BaseMoveToCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      viewModel.model.pushStackElement();
      const cursorStateChanged = viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.moveTo(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position, args.viewPosition)
        ]
      );
      if (cursorStateChanged && args.revealType !== 2 /* None */) {
        viewModel.revealAllCursors(args.source, true, true);
      }
    }
  }
  CoreNavigationCommands2.MoveTo = registerEditorCommand(new BaseMoveToCommand({
    id: "_moveTo",
    inSelectionMode: false,
    precondition: void 0
  }));
  CoreNavigationCommands2.MoveToSelect = registerEditorCommand(new BaseMoveToCommand({
    id: "_moveToSelect",
    inSelectionMode: true,
    precondition: void 0
  }));
  class ColumnSelectCommand extends CoreEditorCommand {
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      const result = this._getColumnSelectResult(viewModel, viewModel.getPrimaryCursorState(), viewModel.getCursorColumnSelectData(), args);
      if (result === null) {
        return;
      }
      viewModel.setCursorStates(args.source, CursorChangeReason.Explicit, result.viewStates.map((viewState) => CursorState.fromViewState(viewState)));
      viewModel.setCursorColumnSelectData({
        isReal: true,
        fromViewLineNumber: result.fromLineNumber,
        fromViewVisualColumn: result.fromVisualColumn,
        toViewLineNumber: result.toLineNumber,
        toViewVisualColumn: result.toVisualColumn
      });
      if (result.reversed) {
        viewModel.revealTopMostCursor(args.source);
      } else {
        viewModel.revealBottomMostCursor(args.source);
      }
    }
  }
  CoreNavigationCommands2.ColumnSelect = registerEditorCommand(new class extends ColumnSelectCommand {
    constructor() {
      super({
        id: "columnSelect",
        precondition: void 0
      });
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      if (typeof args.position === "undefined" || typeof args.viewPosition === "undefined" || typeof args.mouseColumn === "undefined") {
        return null;
      }
      const validatedPosition = viewModel.model.validatePosition(args.position);
      const validatedViewPosition = viewModel.coordinatesConverter.validateViewPosition(new Position(args.viewPosition.lineNumber, args.viewPosition.column), validatedPosition);
      const fromViewLineNumber = args.doColumnSelect ? prevColumnSelectData.fromViewLineNumber : validatedViewPosition.lineNumber;
      const fromViewVisualColumn = args.doColumnSelect ? prevColumnSelectData.fromViewVisualColumn : args.mouseColumn - 1;
      return ColumnSelection.columnSelect(viewModel.cursorConfig, viewModel, fromViewLineNumber, fromViewVisualColumn, validatedViewPosition.lineNumber, args.mouseColumn - 1);
    }
  }());
  CoreNavigationCommands2.CursorColumnSelectLeft = registerEditorCommand(new class extends ColumnSelectCommand {
    constructor() {
      super({
        id: "cursorColumnSelectLeft",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.LeftArrow,
          linux: { primary: 0 }
        }
      });
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      return ColumnSelection.columnSelectLeft(viewModel.cursorConfig, viewModel, prevColumnSelectData);
    }
  }());
  CoreNavigationCommands2.CursorColumnSelectRight = registerEditorCommand(new class extends ColumnSelectCommand {
    constructor() {
      super({
        id: "cursorColumnSelectRight",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.RightArrow,
          linux: { primary: 0 }
        }
      });
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      return ColumnSelection.columnSelectRight(viewModel.cursorConfig, viewModel, prevColumnSelectData);
    }
  }());
  class ColumnSelectUpCommand extends ColumnSelectCommand {
    constructor(opts) {
      super(opts);
      this._isPaged = opts.isPaged;
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      return ColumnSelection.columnSelectUp(viewModel.cursorConfig, viewModel, prevColumnSelectData, this._isPaged);
    }
  }
  CoreNavigationCommands2.CursorColumnSelectUp = registerEditorCommand(new ColumnSelectUpCommand({
    isPaged: false,
    id: "cursorColumnSelectUp",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.UpArrow,
      linux: { primary: 0 }
    }
  }));
  CoreNavigationCommands2.CursorColumnSelectPageUp = registerEditorCommand(new ColumnSelectUpCommand({
    isPaged: true,
    id: "cursorColumnSelectPageUp",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.PageUp,
      linux: { primary: 0 }
    }
  }));
  class ColumnSelectDownCommand extends ColumnSelectCommand {
    constructor(opts) {
      super(opts);
      this._isPaged = opts.isPaged;
    }
    _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
      return ColumnSelection.columnSelectDown(viewModel.cursorConfig, viewModel, prevColumnSelectData, this._isPaged);
    }
  }
  CoreNavigationCommands2.CursorColumnSelectDown = registerEditorCommand(new ColumnSelectDownCommand({
    isPaged: false,
    id: "cursorColumnSelectDown",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.DownArrow,
      linux: { primary: 0 }
    }
  }));
  CoreNavigationCommands2.CursorColumnSelectPageDown = registerEditorCommand(new ColumnSelectDownCommand({
    isPaged: true,
    id: "cursorColumnSelectPageDown",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyMod.Alt | KeyCode.PageDown,
      linux: { primary: 0 }
    }
  }));
  class CursorMoveImpl extends CoreEditorCommand {
    constructor() {
      super({
        id: "cursorMove",
        precondition: void 0,
        metadata: CursorMove_.metadata
      });
    }
    runCoreEditorCommand(viewModel, args) {
      const parsed = CursorMove_.parse(args);
      if (!parsed) {
        return;
      }
      this._runCursorMove(viewModel, args.source, parsed);
    }
    _runCursorMove(viewModel, source, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        source,
        CursorChangeReason.Explicit,
        CursorMoveImpl._move(viewModel, viewModel.getCursorStates(), args)
      );
      viewModel.revealAllCursors(source, true);
    }
    static _move(viewModel, cursors, args) {
      const inSelectionMode = args.select;
      const value = args.value;
      switch (args.direction) {
        case CursorMove_.Direction.Left:
        case CursorMove_.Direction.Right:
        case CursorMove_.Direction.Up:
        case CursorMove_.Direction.Down:
        case CursorMove_.Direction.PrevBlankLine:
        case CursorMove_.Direction.NextBlankLine:
        case CursorMove_.Direction.WrappedLineStart:
        case CursorMove_.Direction.WrappedLineFirstNonWhitespaceCharacter:
        case CursorMove_.Direction.WrappedLineColumnCenter:
        case CursorMove_.Direction.WrappedLineEnd:
        case CursorMove_.Direction.WrappedLineLastNonWhitespaceCharacter:
          return CursorMoveCommands.simpleMove(viewModel, cursors, args.direction, inSelectionMode, value, args.unit);
        case CursorMove_.Direction.ViewPortTop:
        case CursorMove_.Direction.ViewPortBottom:
        case CursorMove_.Direction.ViewPortCenter:
        case CursorMove_.Direction.ViewPortIfOutside:
          return CursorMoveCommands.viewportMove(viewModel, cursors, args.direction, inSelectionMode, value);
        default:
          return null;
      }
    }
  }
  CoreNavigationCommands2.CursorMoveImpl = CursorMoveImpl;
  CoreNavigationCommands2.CursorMove = registerEditorCommand(new CursorMoveImpl());
  let Constants;
  ((Constants2) => {
    Constants2[Constants2["PAGE_SIZE_MARKER"] = -1] = "PAGE_SIZE_MARKER";
  })(Constants || (Constants = {}));
  class CursorMoveBasedCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._staticArgs = opts.args;
    }
    runCoreEditorCommand(viewModel, dynamicArgs) {
      let args = this._staticArgs;
      if (this._staticArgs.value === -1 /* PAGE_SIZE_MARKER */) {
        args = {
          direction: this._staticArgs.direction,
          unit: this._staticArgs.unit,
          select: this._staticArgs.select,
          value: dynamicArgs.pageSize || viewModel.cursorConfig.pageSize
        };
      }
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        dynamicArgs.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.simpleMove(viewModel, viewModel.getCursorStates(), args.direction, args.select, args.value, args.unit)
      );
      viewModel.revealAllCursors(dynamicArgs.source, true);
    }
  }
  CoreNavigationCommands2.CursorLeft = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Left,
      unit: CursorMove_.Unit.None,
      select: false,
      value: 1
    },
    id: "cursorLeft",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.LeftArrow,
      mac: { primary: KeyCode.LeftArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyB] }
    }
  }));
  CoreNavigationCommands2.CursorLeftSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Left,
      unit: CursorMove_.Unit.None,
      select: true,
      value: 1
    },
    id: "cursorLeftSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.LeftArrow
    }
  }));
  CoreNavigationCommands2.CursorRight = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Right,
      unit: CursorMove_.Unit.None,
      select: false,
      value: 1
    },
    id: "cursorRight",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.RightArrow,
      mac: { primary: KeyCode.RightArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyF] }
    }
  }));
  CoreNavigationCommands2.CursorRightSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Right,
      unit: CursorMove_.Unit.None,
      select: true,
      value: 1
    },
    id: "cursorRightSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.RightArrow
    }
  }));
  CoreNavigationCommands2.CursorUp = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Up,
      unit: CursorMove_.Unit.WrappedLine,
      select: false,
      value: 1
    },
    id: "cursorUp",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.UpArrow,
      mac: { primary: KeyCode.UpArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyP] }
    }
  }));
  CoreNavigationCommands2.CursorUpSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Up,
      unit: CursorMove_.Unit.WrappedLine,
      select: true,
      value: 1
    },
    id: "cursorUpSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.UpArrow,
      secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.UpArrow],
      mac: { primary: KeyMod.Shift | KeyCode.UpArrow },
      linux: { primary: KeyMod.Shift | KeyCode.UpArrow }
    }
  }));
  CoreNavigationCommands2.CursorPageUp = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Up,
      unit: CursorMove_.Unit.WrappedLine,
      select: false,
      value: -1 /* PAGE_SIZE_MARKER */
    },
    id: "cursorPageUp",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.PageUp
    }
  }));
  CoreNavigationCommands2.CursorPageUpSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Up,
      unit: CursorMove_.Unit.WrappedLine,
      select: true,
      value: -1 /* PAGE_SIZE_MARKER */
    },
    id: "cursorPageUpSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.PageUp
    }
  }));
  CoreNavigationCommands2.CursorDown = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Down,
      unit: CursorMove_.Unit.WrappedLine,
      select: false,
      value: 1
    },
    id: "cursorDown",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.DownArrow,
      mac: { primary: KeyCode.DownArrow, secondary: [KeyMod.WinCtrl | KeyCode.KeyN] }
    }
  }));
  CoreNavigationCommands2.CursorDownSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Down,
      unit: CursorMove_.Unit.WrappedLine,
      select: true,
      value: 1
    },
    id: "cursorDownSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.DownArrow,
      secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.DownArrow],
      mac: { primary: KeyMod.Shift | KeyCode.DownArrow },
      linux: { primary: KeyMod.Shift | KeyCode.DownArrow }
    }
  }));
  CoreNavigationCommands2.CursorPageDown = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Down,
      unit: CursorMove_.Unit.WrappedLine,
      select: false,
      value: -1 /* PAGE_SIZE_MARKER */
    },
    id: "cursorPageDown",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.PageDown
    }
  }));
  CoreNavigationCommands2.CursorPageDownSelect = registerEditorCommand(new CursorMoveBasedCommand({
    args: {
      direction: CursorMove_.Direction.Down,
      unit: CursorMove_.Unit.WrappedLine,
      select: true,
      value: -1 /* PAGE_SIZE_MARKER */
    },
    id: "cursorPageDownSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.PageDown
    }
  }));
  CoreNavigationCommands2.CreateCursor = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "createCursor",
        precondition: void 0
      });
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      let newState;
      if (args.wholeLine) {
        newState = CursorMoveCommands.line(viewModel, viewModel.getPrimaryCursorState(), false, args.position, args.viewPosition);
      } else {
        newState = CursorMoveCommands.moveTo(viewModel, viewModel.getPrimaryCursorState(), false, args.position, args.viewPosition);
      }
      const states = viewModel.getCursorStates();
      if (states.length > 1) {
        const newModelPosition = newState.modelState ? newState.modelState.position : null;
        const newViewPosition = newState.viewState ? newState.viewState.position : null;
        for (let i = 0, len = states.length; i < len; i++) {
          const state = states[i];
          if (newModelPosition && !state.modelState.selection.containsPosition(newModelPosition)) {
            continue;
          }
          if (newViewPosition && !state.viewState.selection.containsPosition(newViewPosition)) {
            continue;
          }
          states.splice(i, 1);
          viewModel.model.pushStackElement();
          viewModel.setCursorStates(
            args.source,
            CursorChangeReason.Explicit,
            states
          );
          return;
        }
      }
      states.push(newState);
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        states
      );
    }
  }());
  CoreNavigationCommands2.LastCursorMoveToSelect = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "_lastCursorMoveToSelect",
        precondition: void 0
      });
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
      const states = viewModel.getCursorStates();
      const newStates = states.slice(0);
      newStates[lastAddedCursorIndex] = CursorMoveCommands.moveTo(viewModel, states[lastAddedCursorIndex], true, args.position, args.viewPosition);
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        newStates
      );
    }
  }());
  class HomeCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.moveToBeginningOfLine(viewModel, viewModel.getCursorStates(), this._inSelectionMode)
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }
  CoreNavigationCommands2.CursorHome = registerEditorCommand(new HomeCommand({
    inSelectionMode: false,
    id: "cursorHome",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.Home,
      mac: { primary: KeyCode.Home, secondary: [KeyMod.CtrlCmd | KeyCode.LeftArrow] }
    }
  }));
  CoreNavigationCommands2.CursorHomeSelect = registerEditorCommand(new HomeCommand({
    inSelectionMode: true,
    id: "cursorHomeSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.Home,
      mac: { primary: KeyMod.Shift | KeyCode.Home, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.LeftArrow] }
    }
  }));
  class LineStartCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        this._exec(viewModel.getCursorStates())
      );
      viewModel.revealAllCursors(args.source, true);
    }
    _exec(cursors) {
      const result = [];
      for (let i = 0, len = cursors.length; i < len; i++) {
        const cursor = cursors[i];
        const lineNumber = cursor.modelState.position.lineNumber;
        result[i] = CursorState.fromModelState(cursor.modelState.move(this._inSelectionMode, lineNumber, 1, 0));
      }
      return result;
    }
  }
  CoreNavigationCommands2.CursorLineStart = registerEditorCommand(new LineStartCommand({
    inSelectionMode: false,
    id: "cursorLineStart",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: 0,
      mac: { primary: KeyMod.WinCtrl | KeyCode.KeyA }
    }
  }));
  CoreNavigationCommands2.CursorLineStartSelect = registerEditorCommand(new LineStartCommand({
    inSelectionMode: true,
    id: "cursorLineStartSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: 0,
      mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyA }
    }
  }));
  class EndCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.moveToEndOfLine(viewModel, viewModel.getCursorStates(), this._inSelectionMode, args.sticky || false)
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }
  CoreNavigationCommands2.CursorEnd = registerEditorCommand(new EndCommand({
    inSelectionMode: false,
    id: "cursorEnd",
    precondition: void 0,
    kbOpts: {
      args: { sticky: false },
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyCode.End,
      mac: { primary: KeyCode.End, secondary: [KeyMod.CtrlCmd | KeyCode.RightArrow] }
    },
    metadata: {
      description: `Go to End`,
      args: [{
        name: "args",
        schema: {
          type: "object",
          properties: {
            "sticky": {
              description: nls.localize("stickydesc", "Stick to the end even when going to longer lines"),
              type: "boolean",
              default: false
            }
          }
        }
      }]
    }
  }));
  CoreNavigationCommands2.CursorEndSelect = registerEditorCommand(new EndCommand({
    inSelectionMode: true,
    id: "cursorEndSelect",
    precondition: void 0,
    kbOpts: {
      args: { sticky: false },
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.Shift | KeyCode.End,
      mac: { primary: KeyMod.Shift | KeyCode.End, secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.RightArrow] }
    },
    metadata: {
      description: `Select to End`,
      args: [{
        name: "args",
        schema: {
          type: "object",
          properties: {
            "sticky": {
              description: nls.localize("stickydesc", "Stick to the end even when going to longer lines"),
              type: "boolean",
              default: false
            }
          }
        }
      }]
    }
  }));
  class LineEndCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        this._exec(viewModel, viewModel.getCursorStates())
      );
      viewModel.revealAllCursors(args.source, true);
    }
    _exec(viewModel, cursors) {
      const result = [];
      for (let i = 0, len = cursors.length; i < len; i++) {
        const cursor = cursors[i];
        const lineNumber = cursor.modelState.position.lineNumber;
        const maxColumn = viewModel.model.getLineMaxColumn(lineNumber);
        result[i] = CursorState.fromModelState(cursor.modelState.move(this._inSelectionMode, lineNumber, maxColumn, 0));
      }
      return result;
    }
  }
  CoreNavigationCommands2.CursorLineEnd = registerEditorCommand(new LineEndCommand({
    inSelectionMode: false,
    id: "cursorLineEnd",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: 0,
      mac: { primary: KeyMod.WinCtrl | KeyCode.KeyE }
    }
  }));
  CoreNavigationCommands2.CursorLineEndSelect = registerEditorCommand(new LineEndCommand({
    inSelectionMode: true,
    id: "cursorLineEndSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: 0,
      mac: { primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyE }
    }
  }));
  class TopCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.moveToBeginningOfBuffer(viewModel, viewModel.getCursorStates(), this._inSelectionMode)
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }
  CoreNavigationCommands2.CursorTop = registerEditorCommand(new TopCommand({
    inSelectionMode: false,
    id: "cursorTop",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyCode.Home,
      mac: { primary: KeyMod.CtrlCmd | KeyCode.UpArrow }
    }
  }));
  CoreNavigationCommands2.CursorTopSelect = registerEditorCommand(new TopCommand({
    inSelectionMode: true,
    id: "cursorTopSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Home,
      mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.UpArrow }
    }
  }));
  class BottomCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        CursorMoveCommands.moveToEndOfBuffer(viewModel, viewModel.getCursorStates(), this._inSelectionMode)
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }
  CoreNavigationCommands2.CursorBottom = registerEditorCommand(new BottomCommand({
    inSelectionMode: false,
    id: "cursorBottom",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyCode.End,
      mac: { primary: KeyMod.CtrlCmd | KeyCode.DownArrow }
    }
  }));
  CoreNavigationCommands2.CursorBottomSelect = registerEditorCommand(new BottomCommand({
    inSelectionMode: true,
    id: "cursorBottomSelect",
    precondition: void 0,
    kbOpts: {
      weight: CORE_WEIGHT,
      kbExpr: EditorContextKeys.textInputFocus,
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.End,
      mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.DownArrow }
    }
  }));
  class EditorScrollImpl extends CoreEditorCommand {
    constructor() {
      super({
        id: "editorScroll",
        precondition: void 0,
        metadata: EditorScroll_.metadata
      });
    }
    determineScrollMethod(args) {
      const horizontalUnits = [6 /* Column */];
      const verticalUnits = [
        1 /* Line */,
        2 /* WrappedLine */,
        3 /* Page */,
        4 /* HalfPage */,
        5 /* Editor */,
        6 /* Column */
      ];
      const horizontalDirections = [4 /* Left */, 2 /* Right */];
      const verticalDirections = [1 /* Up */, 3 /* Down */];
      if (horizontalUnits.includes(args.unit) && horizontalDirections.includes(args.direction)) {
        return this._runHorizontalEditorScroll.bind(this);
      }
      if (verticalUnits.includes(args.unit) && verticalDirections.includes(args.direction)) {
        return this._runVerticalEditorScroll.bind(this);
      }
      return null;
    }
    runCoreEditorCommand(viewModel, args) {
      const parsed = EditorScroll_.parse(args);
      if (!parsed) {
        return;
      }
      const runEditorScroll = this.determineScrollMethod(parsed);
      if (!runEditorScroll) {
        return;
      }
      runEditorScroll(viewModel, args.source, parsed);
    }
    _runVerticalEditorScroll(viewModel, source, args) {
      const desiredScrollTop = this._computeDesiredScrollTop(viewModel, args);
      if (args.revealCursor) {
        const desiredVisibleViewRange = viewModel.getCompletelyVisibleViewRangeAtScrollTop(desiredScrollTop);
        viewModel.setCursorStates(
          source,
          CursorChangeReason.Explicit,
          [
            CursorMoveCommands.findPositionInViewportIfOutside(viewModel, viewModel.getPrimaryCursorState(), desiredVisibleViewRange, args.select)
          ]
        );
      }
      viewModel.viewLayout.setScrollPosition({ scrollTop: desiredScrollTop }, ScrollType.Smooth);
    }
    _computeDesiredScrollTop(viewModel, args) {
      if (args.unit === 1 /* Line */) {
        const futureViewport = viewModel.viewLayout.getFutureViewport();
        const visibleViewRange = viewModel.getCompletelyVisibleViewRangeAtScrollTop(futureViewport.top);
        const visibleModelRange = viewModel.coordinatesConverter.convertViewRangeToModelRange(visibleViewRange);
        let desiredTopModelLineNumber;
        if (args.direction === 1 /* Up */) {
          desiredTopModelLineNumber = Math.max(1, visibleModelRange.startLineNumber - args.value);
        } else {
          desiredTopModelLineNumber = Math.min(viewModel.model.getLineCount(), visibleModelRange.startLineNumber + args.value);
        }
        const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(new Position(desiredTopModelLineNumber, 1));
        return viewModel.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber);
      }
      if (args.unit === 5 /* Editor */) {
        let desiredTopModelLineNumber = 0;
        if (args.direction === 3 /* Down */) {
          desiredTopModelLineNumber = viewModel.model.getLineCount() - viewModel.cursorConfig.pageSize;
        }
        return viewModel.viewLayout.getVerticalOffsetForLineNumber(desiredTopModelLineNumber);
      }
      let noOfLines;
      if (args.unit === 3 /* Page */) {
        noOfLines = viewModel.cursorConfig.pageSize * args.value;
      } else if (args.unit === 4 /* HalfPage */) {
        noOfLines = Math.round(viewModel.cursorConfig.pageSize / 2) * args.value;
      } else {
        noOfLines = args.value;
      }
      const deltaLines = (args.direction === 1 /* Up */ ? -1 : 1) * noOfLines;
      return viewModel.viewLayout.getCurrentScrollTop() + deltaLines * viewModel.cursorConfig.lineHeight;
    }
    _runHorizontalEditorScroll(viewModel, source, args) {
      const desiredScrollLeft = this._computeDesiredScrollLeft(viewModel, args);
      viewModel.viewLayout.setScrollPosition({ scrollLeft: desiredScrollLeft }, ScrollType.Smooth);
    }
    _computeDesiredScrollLeft(viewModel, args) {
      const deltaColumns = (args.direction === 4 /* Left */ ? -1 : 1) * args.value;
      return viewModel.viewLayout.getCurrentScrollLeft() + deltaColumns * viewModel.cursorConfig.typicalHalfwidthCharacterWidth;
    }
  }
  CoreNavigationCommands2.EditorScrollImpl = EditorScrollImpl;
  CoreNavigationCommands2.EditorScroll = registerEditorCommand(new EditorScrollImpl());
  CoreNavigationCommands2.ScrollLineUp = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollLineUp",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
          mac: { primary: KeyMod.WinCtrl | KeyCode.PageUp }
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Up,
        by: EditorScroll_.RawUnit.WrappedLine,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollPageUp = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollPageUp",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyCode.PageUp,
          win: { primary: KeyMod.Alt | KeyCode.PageUp },
          linux: { primary: KeyMod.Alt | KeyCode.PageUp }
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Up,
        by: EditorScroll_.RawUnit.Page,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollEditorTop = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollEditorTop",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Up,
        by: EditorScroll_.RawUnit.Editor,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollLineDown = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollLineDown",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
          mac: { primary: KeyMod.WinCtrl | KeyCode.PageDown }
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Down,
        by: EditorScroll_.RawUnit.WrappedLine,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollPageDown = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollPageDown",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyMod.CtrlCmd | KeyCode.PageDown,
          win: { primary: KeyMod.Alt | KeyCode.PageDown },
          linux: { primary: KeyMod.Alt | KeyCode.PageDown }
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Down,
        by: EditorScroll_.RawUnit.Page,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollEditorBottom = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollEditorBottom",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Down,
        by: EditorScroll_.RawUnit.Editor,
        value: 1,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollLeft = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollLeft",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Left,
        by: EditorScroll_.RawUnit.Column,
        value: 2,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  CoreNavigationCommands2.ScrollRight = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "scrollRight",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      CoreNavigationCommands2.EditorScroll.runCoreEditorCommand(viewModel, {
        to: EditorScroll_.RawDirection.Right,
        by: EditorScroll_.RawUnit.Column,
        value: 2,
        revealCursor: false,
        select: false,
        source: args.source
      });
    }
  }());
  class WordCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.word(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position)
        ]
      );
      if (args.revealType !== 2 /* None */) {
        viewModel.revealAllCursors(args.source, true, true);
      }
    }
  }
  CoreNavigationCommands2.WordSelect = registerEditorCommand(new WordCommand({
    inSelectionMode: false,
    id: "_wordSelect",
    precondition: void 0
  }));
  CoreNavigationCommands2.WordSelectDrag = registerEditorCommand(new WordCommand({
    inSelectionMode: true,
    id: "_wordSelectDrag",
    precondition: void 0
  }));
  CoreNavigationCommands2.LastCursorWordSelect = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "lastCursorWordSelect",
        precondition: void 0
      });
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
      const states = viewModel.getCursorStates();
      const newStates = states.slice(0);
      const lastAddedState = states[lastAddedCursorIndex];
      newStates[lastAddedCursorIndex] = CursorMoveCommands.word(viewModel, lastAddedState, lastAddedState.modelState.hasSelection(), args.position);
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        newStates
      );
    }
  }());
  class LineCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.line(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position, args.viewPosition)
        ]
      );
      if (args.revealType !== 2 /* None */) {
        viewModel.revealAllCursors(args.source, false, true);
      }
    }
  }
  CoreNavigationCommands2.LineSelect = registerEditorCommand(new LineCommand({
    inSelectionMode: false,
    id: "_lineSelect",
    precondition: void 0
  }));
  CoreNavigationCommands2.LineSelectDrag = registerEditorCommand(new LineCommand({
    inSelectionMode: true,
    id: "_lineSelectDrag",
    precondition: void 0
  }));
  class LastCursorLineCommand extends CoreEditorCommand {
    constructor(opts) {
      super(opts);
      this._inSelectionMode = opts.inSelectionMode;
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.position) {
        return;
      }
      const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
      const states = viewModel.getCursorStates();
      const newStates = states.slice(0);
      newStates[lastAddedCursorIndex] = CursorMoveCommands.line(viewModel, states[lastAddedCursorIndex], this._inSelectionMode, args.position, args.viewPosition);
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        newStates
      );
    }
  }
  CoreNavigationCommands2.LastCursorLineSelect = registerEditorCommand(new LastCursorLineCommand({
    inSelectionMode: false,
    id: "lastCursorLineSelect",
    precondition: void 0
  }));
  CoreNavigationCommands2.LastCursorLineSelectDrag = registerEditorCommand(new LastCursorLineCommand({
    inSelectionMode: true,
    id: "lastCursorLineSelectDrag",
    precondition: void 0
  }));
  CoreNavigationCommands2.CancelSelection = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "cancelSelection",
        precondition: EditorContextKeys.hasNonEmptySelection,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyCode.Escape,
          secondary: [KeyMod.Shift | KeyCode.Escape]
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.cancelSelection(viewModel, viewModel.getPrimaryCursorState())
        ]
      );
      viewModel.revealAllCursors(args.source, true);
    }
  }());
  CoreNavigationCommands2.RemoveSecondaryCursors = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "removeSecondaryCursors",
        precondition: EditorContextKeys.hasMultipleSelections,
        kbOpts: {
          weight: CORE_WEIGHT + 1,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyCode.Escape,
          secondary: [KeyMod.Shift | KeyCode.Escape]
        }
      });
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          viewModel.getPrimaryCursorState()
        ]
      );
      viewModel.revealAllCursors(args.source, true);
      status(nls.localize("removedCursor", "Removed secondary cursors"));
    }
  }());
  CoreNavigationCommands2.RevealLine = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "revealLine",
        precondition: void 0,
        metadata: RevealLine_.metadata
      });
    }
    runCoreEditorCommand(viewModel, args) {
      const revealLineArg = args;
      const lineNumberArg = revealLineArg.lineNumber || 0;
      let lineNumber = typeof lineNumberArg === "number" ? lineNumberArg + 1 : parseInt(lineNumberArg) + 1;
      if (lineNumber < 1) {
        lineNumber = 1;
      }
      const lineCount = viewModel.model.getLineCount();
      if (lineNumber > lineCount) {
        lineNumber = lineCount;
      }
      const range = new Range(
        lineNumber,
        1,
        lineNumber,
        viewModel.model.getLineMaxColumn(lineNumber)
      );
      let revealAt = VerticalRevealType.Simple;
      if (revealLineArg.at) {
        switch (revealLineArg.at) {
          case RevealLine_.RawAtArgument.Top:
            revealAt = VerticalRevealType.Top;
            break;
          case RevealLine_.RawAtArgument.Center:
            revealAt = VerticalRevealType.Center;
            break;
          case RevealLine_.RawAtArgument.Bottom:
            revealAt = VerticalRevealType.Bottom;
            break;
          default:
            break;
        }
      }
      const viewRange = viewModel.coordinatesConverter.convertModelRangeToViewRange(range);
      viewModel.revealRange(args.source, false, viewRange, revealAt, ScrollType.Smooth);
    }
  }());
  CoreNavigationCommands2.SelectAll = new class extends EditorOrNativeTextInputCommand {
    constructor() {
      super(SelectAllCommand);
    }
    runDOMCommand(activeElement) {
      if (isFirefox) {
        activeElement.focus();
        activeElement.select();
      }
      activeElement.ownerDocument.execCommand("selectAll");
    }
    runEditorCommand(accessor, editor, args) {
      const viewModel = editor._getViewModel();
      if (!viewModel) {
        return;
      }
      this.runCoreEditorCommand(viewModel, args);
    }
    runCoreEditorCommand(viewModel, args) {
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        "keyboard",
        CursorChangeReason.Explicit,
        [
          CursorMoveCommands.selectAll(viewModel, viewModel.getPrimaryCursorState())
        ]
      );
    }
  }();
  CoreNavigationCommands2.SetSelection = registerEditorCommand(new class extends CoreEditorCommand {
    constructor() {
      super({
        id: "setSelection",
        precondition: void 0
      });
    }
    runCoreEditorCommand(viewModel, args) {
      if (!args.selection) {
        return;
      }
      viewModel.model.pushStackElement();
      viewModel.setCursorStates(
        args.source,
        CursorChangeReason.Explicit,
        [
          CursorState.fromModelSelection(args.selection)
        ]
      );
    }
  }());
})(CoreNavigationCommands || (CoreNavigationCommands = {}));
const columnSelectionCondition = ContextKeyExpr.and(
  EditorContextKeys.textInputFocus,
  EditorContextKeys.columnSelection
);
function registerColumnSelection(id, keybinding) {
  KeybindingsRegistry.registerKeybindingRule({
    id,
    primary: keybinding,
    when: columnSelectionCondition,
    weight: CORE_WEIGHT + 1
  });
}
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectLeft.id, KeyMod.Shift | KeyCode.LeftArrow);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectRight.id, KeyMod.Shift | KeyCode.RightArrow);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectUp.id, KeyMod.Shift | KeyCode.UpArrow);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectPageUp.id, KeyMod.Shift | KeyCode.PageUp);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectDown.id, KeyMod.Shift | KeyCode.DownArrow);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectPageDown.id, KeyMod.Shift | KeyCode.PageDown);
function registerCommand(command) {
  command.register();
  return command;
}
var CoreEditingCommands;
((CoreEditingCommands2) => {
  class CoreEditingCommand extends EditorCommand {
    runEditorCommand(accessor, editor, args) {
      const viewModel = editor._getViewModel();
      if (!viewModel) {
        return;
      }
      this.runCoreEditingCommand(editor, viewModel, args || {});
    }
  }
  CoreEditingCommands2.CoreEditingCommand = CoreEditingCommand;
  CoreEditingCommands2.LineBreakInsert = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "lineBreakInsert",
        precondition: EditorContextKeys.writable,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: 0,
          mac: { primary: KeyMod.WinCtrl | KeyCode.KeyO }
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      editor.pushUndoStop();
      editor.executeCommands(this.id, EnterOperation.lineBreakInsert(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection)));
    }
  }());
  CoreEditingCommands2.Outdent = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "outdent",
        precondition: EditorContextKeys.writable,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: ContextKeyExpr.and(
            EditorContextKeys.editorTextFocus,
            EditorContextKeys.tabDoesNotMoveFocus
          ),
          primary: KeyMod.Shift | KeyCode.Tab
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      editor.pushUndoStop();
      editor.executeCommands(this.id, TypeOperations.outdent(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection)));
      editor.pushUndoStop();
    }
  }());
  CoreEditingCommands2.Tab = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "tab",
        precondition: EditorContextKeys.writable,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: ContextKeyExpr.and(
            EditorContextKeys.editorTextFocus,
            EditorContextKeys.tabDoesNotMoveFocus
          ),
          primary: KeyCode.Tab
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      editor.pushUndoStop();
      editor.executeCommands(this.id, TypeOperations.tab(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection)));
      editor.pushUndoStop();
    }
  }());
  CoreEditingCommands2.DeleteLeft = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "deleteLeft",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyCode.Backspace,
          secondary: [KeyMod.Shift | KeyCode.Backspace],
          mac: { primary: KeyCode.Backspace, secondary: [KeyMod.Shift | KeyCode.Backspace, KeyMod.WinCtrl | KeyCode.KeyH, KeyMod.WinCtrl | KeyCode.Backspace] }
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      const [shouldPushStackElementBefore, commands] = DeleteOperations.deleteLeft(viewModel.getPrevEditOperationType(), viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection), viewModel.getCursorAutoClosedCharacters());
      if (shouldPushStackElementBefore) {
        editor.pushUndoStop();
      }
      editor.executeCommands(this.id, commands);
      viewModel.setPrevEditOperationType(EditOperationType.DeletingLeft);
    }
  }());
  CoreEditingCommands2.DeleteRight = registerEditorCommand(new class extends CoreEditingCommand {
    constructor() {
      super({
        id: "deleteRight",
        precondition: void 0,
        kbOpts: {
          weight: CORE_WEIGHT,
          kbExpr: EditorContextKeys.textInputFocus,
          primary: KeyCode.Delete,
          mac: { primary: KeyCode.Delete, secondary: [KeyMod.WinCtrl | KeyCode.KeyD, KeyMod.WinCtrl | KeyCode.Delete] }
        }
      });
    }
    runCoreEditingCommand(editor, viewModel, args) {
      const [shouldPushStackElementBefore, commands] = DeleteOperations.deleteRight(viewModel.getPrevEditOperationType(), viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map((s) => s.modelState.selection));
      if (shouldPushStackElementBefore) {
        editor.pushUndoStop();
      }
      editor.executeCommands(this.id, commands);
      viewModel.setPrevEditOperationType(EditOperationType.DeletingRight);
    }
  }());
  CoreEditingCommands2.Undo = new class extends EditorOrNativeTextInputCommand {
    constructor() {
      super(UndoCommand);
    }
    runDOMCommand(activeElement) {
      activeElement.ownerDocument.execCommand("undo");
    }
    runEditorCommand(accessor, editor, args) {
      if (!editor.hasModel() || editor.getOption(EditorOption.readOnly) === true) {
        return;
      }
      return editor.getModel().undo();
    }
  }();
  CoreEditingCommands2.Redo = new class extends EditorOrNativeTextInputCommand {
    constructor() {
      super(RedoCommand);
    }
    runDOMCommand(activeElement) {
      activeElement.ownerDocument.execCommand("redo");
    }
    runEditorCommand(accessor, editor, args) {
      if (!editor.hasModel() || editor.getOption(EditorOption.readOnly) === true) {
        return;
      }
      return editor.getModel().redo();
    }
  }();
})(CoreEditingCommands || (CoreEditingCommands = {}));
class EditorHandlerCommand extends Command {
  constructor(id, handlerId, metadata) {
    super({
      id,
      precondition: void 0,
      metadata
    });
    this._handlerId = handlerId;
  }
  runCommand(accessor, args) {
    const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    if (!editor) {
      return;
    }
    editor.trigger("keyboard", this._handlerId, args);
  }
}
function registerOverwritableCommand(handlerId, metadata) {
  registerCommand(new EditorHandlerCommand("default:" + handlerId, handlerId));
  registerCommand(new EditorHandlerCommand(handlerId, handlerId, metadata));
}
registerOverwritableCommand(Handler.Type, {
  description: `Type`,
  args: [{
    name: "args",
    schema: {
      "type": "object",
      "required": ["text"],
      "properties": {
        "text": {
          "type": "string"
        }
      }
    }
  }]
});
registerOverwritableCommand(Handler.ReplacePreviousChar);
registerOverwritableCommand(Handler.CompositionType);
registerOverwritableCommand(Handler.CompositionStart);
registerOverwritableCommand(Handler.CompositionEnd);
registerOverwritableCommand(Handler.Paste);
registerOverwritableCommand(Handler.Cut);
export {
  CoreEditingCommands,
  CoreEditorCommand,
  CoreNavigationCommands,
  EditorScroll_,
  NavigationCommandRevealType,
  RevealLine_
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9jb3JlQ29tbWFuZHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGlzRmlyZWZveCB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9icm93c2VyLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCAqIGFzIHR5cGVzIGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IHN0YXR1cyB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ29tbWFuZCwgRWRpdG9yQ29tbWFuZCwgSUNvbW1hbmRPcHRpb25zLCByZWdpc3RlckVkaXRvckNvbW1hbmQsIE11bHRpQ29tbWFuZCwgVW5kb0NvbW1hbmQsIFJlZG9Db21tYW5kLCBTZWxlY3RBbGxDb21tYW5kIH0gZnJvbSAnLi9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29sdW1uU2VsZWN0aW9uLCBJQ29sdW1uU2VsZWN0UmVzdWx0IH0gZnJvbSAnLi4vY29tbW9uL2N1cnNvci9jdXJzb3JDb2x1bW5TZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgQ3Vyc29yU3RhdGUsIEVkaXRPcGVyYXRpb25UeXBlLCBJQ29sdW1uU2VsZWN0RGF0YSwgUGFydGlhbEN1cnNvclN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL2N1cnNvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBEZWxldGVPcGVyYXRpb25zIH0gZnJvbSAnLi4vY29tbW9uL2N1cnNvci9jdXJzb3JEZWxldGVPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IEN1cnNvckNoYW5nZVJlYXNvbiB9IGZyb20gJy4uL2NvbW1vbi9jdXJzb3JFdmVudHMuanMnO1xuaW1wb3J0IHsgQ3Vyc29yTW92ZSBhcyBDdXJzb3JNb3ZlXywgQ3Vyc29yTW92ZUNvbW1hbmRzIH0gZnJvbSAnLi4vY29tbW9uL2N1cnNvci9jdXJzb3JNb3ZlQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgVHlwZU9wZXJhdGlvbnMgfSBmcm9tICcuLi9jb21tb24vY3Vyc29yL2N1cnNvclR5cGVPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiwgUG9zaXRpb24gfSBmcm9tICcuLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IEhhbmRsZXIsIFNjcm9sbFR5cGUgfSBmcm9tICcuLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IFZlcnRpY2FsUmV2ZWFsVHlwZSB9IGZyb20gJy4uL2NvbW1vbi92aWV3RXZlbnRzLmpzJztcbmltcG9ydCB7IElDb21tYW5kTWV0YWRhdGEgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQsIEtleWJpbmRpbmdzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVmlld01vZGVsIH0gZnJvbSAnLi4vY29tbW9uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJU2VsZWN0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IGdldEFjdGl2ZUVsZW1lbnQsIGlzRWRpdGFibGVFbGVtZW50IH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBFbnRlck9wZXJhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jdXJzb3IvY3Vyc29yVHlwZUVkaXRPcGVyYXRpb25zLmpzJztcblxuY29uc3QgQ09SRV9XRUlHSFQgPSBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvcmU7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBDb3JlRWRpdG9yQ29tbWFuZDxUPiBleHRlbmRzIEVkaXRvckNvbW1hbmQge1xuXHRwdWJsaWMgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IG51bGwsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M/OiBQYXJ0aWFsPFQ+IHwgbnVsbCk6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IGVkaXRvci5fZ2V0Vmlld01vZGVsKCk7XG5cdFx0aWYgKCF2aWV3TW9kZWwpIHtcblx0XHRcdC8vIHRoZSBlZGl0b3IgaGFzIG5vIHZpZXcgPT4gaGFzIG5vIGN1cnNvcnNcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIGFyZ3MgfHwge30pO1xuXHR9XG5cblx0cHVibGljIGFic3RyYWN0IHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxUPik6IHZvaWQ7XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRWRpdG9yU2Nyb2xsXyB7XG5cblx0Y29uc3QgaXNFZGl0b3JTY3JvbGxBcmdzID0gZnVuY3Rpb24gKGFyZzogYW55KTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0eXBlcy5pc09iamVjdChhcmcpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Nyb2xsQXJnOiBSYXdBcmd1bWVudHMgPSBhcmc7XG5cblx0XHRpZiAoIXR5cGVzLmlzU3RyaW5nKHNjcm9sbEFyZy50bykpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIXR5cGVzLmlzVW5kZWZpbmVkKHNjcm9sbEFyZy5ieSkgJiYgIXR5cGVzLmlzU3RyaW5nKHNjcm9sbEFyZy5ieSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIXR5cGVzLmlzVW5kZWZpbmVkKHNjcm9sbEFyZy52YWx1ZSkgJiYgIXR5cGVzLmlzTnVtYmVyKHNjcm9sbEFyZy52YWx1ZSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIXR5cGVzLmlzVW5kZWZpbmVkKHNjcm9sbEFyZy5yZXZlYWxDdXJzb3IpICYmICF0eXBlcy5pc0Jvb2xlYW4oc2Nyb2xsQXJnLnJldmVhbEN1cnNvcikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fTtcblxuXHRleHBvcnQgY29uc3QgbWV0YWRhdGE6IElDb21tYW5kTWV0YWRhdGEgPSB7XG5cdFx0ZGVzY3JpcHRpb246ICdTY3JvbGwgZWRpdG9yIGluIHRoZSBnaXZlbiBkaXJlY3Rpb24nLFxuXHRcdGFyZ3M6IFtcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogJ0VkaXRvciBzY3JvbGwgYXJndW1lbnQgb2JqZWN0Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGBQcm9wZXJ0eS12YWx1ZSBwYWlycyB0aGF0IGNhbiBiZSBwYXNzZWQgdGhyb3VnaCB0aGlzIGFyZ3VtZW50OlxuXHRcdFx0XHRcdCogJ3RvJzogQSBtYW5kYXRvcnkgZGlyZWN0aW9uIHZhbHVlLlxuXHRcdFx0XHRcdFx0XFxgXFxgXFxgXG5cdFx0XHRcdFx0XHQndXAnLCAnZG93bidcblx0XHRcdFx0XHRcdFxcYFxcYFxcYFxuXHRcdFx0XHRcdCogJ2J5JzogVW5pdCB0byBtb3ZlLiBEZWZhdWx0IGlzIGNvbXB1dGVkIGJhc2VkIG9uICd0bycgdmFsdWUuXG5cdFx0XHRcdFx0XHRcXGBcXGBcXGBcblx0XHRcdFx0XHRcdCdsaW5lJywgJ3dyYXBwZWRMaW5lJywgJ3BhZ2UnLCAnaGFsZlBhZ2UnLCAnZWRpdG9yJ1xuXHRcdFx0XHRcdFx0XFxgXFxgXFxgXG5cdFx0XHRcdFx0KiAndmFsdWUnOiBOdW1iZXIgb2YgdW5pdHMgdG8gbW92ZS4gRGVmYXVsdCBpcyAnMScuXG5cdFx0XHRcdFx0KiAncmV2ZWFsQ3Vyc29yJzogSWYgJ3RydWUnIHJldmVhbHMgdGhlIGN1cnNvciBpZiBpdCBpcyBvdXRzaWRlIHZpZXcgcG9ydC5cblx0XHRcdFx0YCxcblx0XHRcdFx0Y29uc3RyYWludDogaXNFZGl0b3JTY3JvbGxBcmdzLFxuXHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHRcdCdyZXF1aXJlZCc6IFsndG8nXSxcblx0XHRcdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0XHRcdCd0byc6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0J2VudW0nOiBbJ3VwJywgJ2Rvd24nXVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdCdieSc6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0J2VudW0nOiBbJ2xpbmUnLCAnd3JhcHBlZExpbmUnLCAncGFnZScsICdoYWxmUGFnZScsICdlZGl0b3InXVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdCd2YWx1ZSc6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnbnVtYmVyJyxcblx0XHRcdFx0XHRcdFx0J2RlZmF1bHQnOiAxXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0J3JldmVhbEN1cnNvcic6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBEaXJlY3Rpb25zIGluIHRoZSB2aWV3IGZvciBlZGl0b3Igc2Nyb2xsIGNvbW1hbmQuXG5cdCAqL1xuXHRleHBvcnQgY29uc3QgUmF3RGlyZWN0aW9uID0ge1xuXHRcdFVwOiAndXAnLFxuXHRcdFJpZ2h0OiAncmlnaHQnLFxuXHRcdERvd246ICdkb3duJyxcblx0XHRMZWZ0OiAnbGVmdCdcblx0fTtcblxuXHQvKipcblx0ICogVW5pdHMgZm9yIGVkaXRvciBzY3JvbGwgJ2J5JyBhcmd1bWVudFxuXHQgKi9cblx0ZXhwb3J0IGNvbnN0IFJhd1VuaXQgPSB7XG5cdFx0TGluZTogJ2xpbmUnLFxuXHRcdFdyYXBwZWRMaW5lOiAnd3JhcHBlZExpbmUnLFxuXHRcdFBhZ2U6ICdwYWdlJyxcblx0XHRIYWxmUGFnZTogJ2hhbGZQYWdlJyxcblx0XHRFZGl0b3I6ICdlZGl0b3InLFxuXHRcdENvbHVtbjogJ2NvbHVtbidcblx0fTtcblxuXHQvKipcblx0ICogQXJndW1lbnRzIGZvciBlZGl0b3Igc2Nyb2xsIGNvbW1hbmRcblx0ICovXG5cdGV4cG9ydCBpbnRlcmZhY2UgUmF3QXJndW1lbnRzIHtcblx0XHR0bzogc3RyaW5nO1xuXHRcdGJ5Pzogc3RyaW5nO1xuXHRcdHZhbHVlPzogbnVtYmVyO1xuXHRcdHJldmVhbEN1cnNvcj86IGJvb2xlYW47XG5cdFx0c2VsZWN0PzogYm9vbGVhbjtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBwYXJzZShhcmdzOiBQYXJ0aWFsPFJhd0FyZ3VtZW50cz4pOiBQYXJzZWRBcmd1bWVudHMgfCBudWxsIHtcblx0XHRsZXQgZGlyZWN0aW9uOiBEaXJlY3Rpb247XG5cdFx0c3dpdGNoIChhcmdzLnRvKSB7XG5cdFx0XHRjYXNlIFJhd0RpcmVjdGlvbi5VcDpcblx0XHRcdFx0ZGlyZWN0aW9uID0gRGlyZWN0aW9uLlVwO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUmF3RGlyZWN0aW9uLlJpZ2h0OlxuXHRcdFx0XHRkaXJlY3Rpb24gPSBEaXJlY3Rpb24uUmlnaHQ7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSYXdEaXJlY3Rpb24uRG93bjpcblx0XHRcdFx0ZGlyZWN0aW9uID0gRGlyZWN0aW9uLkRvd247XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSYXdEaXJlY3Rpb24uTGVmdDpcblx0XHRcdFx0ZGlyZWN0aW9uID0gRGlyZWN0aW9uLkxlZnQ7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0Ly8gSWxsZWdhbCBhcmd1bWVudHNcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0bGV0IHVuaXQ6IFVuaXQ7XG5cdFx0c3dpdGNoIChhcmdzLmJ5KSB7XG5cdFx0XHRjYXNlIFJhd1VuaXQuTGluZTpcblx0XHRcdFx0dW5pdCA9IFVuaXQuTGluZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFJhd1VuaXQuV3JhcHBlZExpbmU6XG5cdFx0XHRcdHVuaXQgPSBVbml0LldyYXBwZWRMaW5lO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUmF3VW5pdC5QYWdlOlxuXHRcdFx0XHR1bml0ID0gVW5pdC5QYWdlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUmF3VW5pdC5IYWxmUGFnZTpcblx0XHRcdFx0dW5pdCA9IFVuaXQuSGFsZlBhZ2U7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBSYXdVbml0LkVkaXRvcjpcblx0XHRcdFx0dW5pdCA9IFVuaXQuRWRpdG9yO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgUmF3VW5pdC5Db2x1bW46XG5cdFx0XHRcdHVuaXQgPSBVbml0LkNvbHVtbjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR1bml0ID0gVW5pdC5XcmFwcGVkTGluZTtcblx0XHR9XG5cblx0XHRjb25zdCB2YWx1ZSA9IE1hdGguZmxvb3IoYXJncy52YWx1ZSB8fCAxKTtcblx0XHRjb25zdCByZXZlYWxDdXJzb3IgPSAhIWFyZ3MucmV2ZWFsQ3Vyc29yO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpcmVjdGlvbjogZGlyZWN0aW9uLFxuXHRcdFx0dW5pdDogdW5pdCxcblx0XHRcdHZhbHVlOiB2YWx1ZSxcblx0XHRcdHJldmVhbEN1cnNvcjogcmV2ZWFsQ3Vyc29yLFxuXHRcdFx0c2VsZWN0OiAoISFhcmdzLnNlbGVjdClcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGludGVyZmFjZSBQYXJzZWRBcmd1bWVudHMge1xuXHRcdGRpcmVjdGlvbjogRGlyZWN0aW9uO1xuXHRcdHVuaXQ6IFVuaXQ7XG5cdFx0dmFsdWU6IG51bWJlcjtcblx0XHRyZXZlYWxDdXJzb3I6IGJvb2xlYW47XG5cdFx0c2VsZWN0OiBib29sZWFuO1xuXHR9XG5cblxuXHRleHBvcnQgY29uc3QgZW51bSBEaXJlY3Rpb24ge1xuXHRcdFVwID0gMSxcblx0XHRSaWdodCA9IDIsXG5cdFx0RG93biA9IDMsXG5cdFx0TGVmdCA9IDRcblx0fVxuXG5cdGV4cG9ydCBjb25zdCBlbnVtIFVuaXQge1xuXHRcdExpbmUgPSAxLFxuXHRcdFdyYXBwZWRMaW5lID0gMixcblx0XHRQYWdlID0gMyxcblx0XHRIYWxmUGFnZSA9IDQsXG5cdFx0RWRpdG9yID0gNSxcblx0XHRDb2x1bW4gPSA2XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBSZXZlYWxMaW5lXyB7XG5cblx0Y29uc3QgaXNSZXZlYWxMaW5lQXJncyA9IGZ1bmN0aW9uIChhcmc6IGFueSk6IGJvb2xlYW4ge1xuXHRcdGlmICghdHlwZXMuaXNPYmplY3QoYXJnKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJldmVhTGluZUFyZzogUmF3QXJndW1lbnRzID0gYXJnO1xuXG5cdFx0aWYgKCF0eXBlcy5pc051bWJlcihyZXZlYUxpbmVBcmcubGluZU51bWJlcikgJiYgIXR5cGVzLmlzU3RyaW5nKHJldmVhTGluZUFyZy5saW5lTnVtYmVyKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICghdHlwZXMuaXNVbmRlZmluZWQocmV2ZWFMaW5lQXJnLmF0KSAmJiAhdHlwZXMuaXNTdHJpbmcocmV2ZWFMaW5lQXJnLmF0KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9O1xuXG5cdGV4cG9ydCBjb25zdCBtZXRhZGF0YTogSUNvbW1hbmRNZXRhZGF0YSA9IHtcblx0XHRkZXNjcmlwdGlvbjogJ1JldmVhbCB0aGUgZ2l2ZW4gbGluZSBhdCB0aGUgZ2l2ZW4gbG9naWNhbCBwb3NpdGlvbicsXG5cdFx0YXJnczogW1xuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiAnUmV2ZWFsIGxpbmUgYXJndW1lbnQgb2JqZWN0Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGBQcm9wZXJ0eS12YWx1ZSBwYWlycyB0aGF0IGNhbiBiZSBwYXNzZWQgdGhyb3VnaCB0aGlzIGFyZ3VtZW50OlxuXHRcdFx0XHRcdCogJ2xpbmVOdW1iZXInOiBBIG1hbmRhdG9yeSBsaW5lIG51bWJlciB2YWx1ZS5cblx0XHRcdFx0XHQqICdhdCc6IExvZ2ljYWwgcG9zaXRpb24gYXQgd2hpY2ggbGluZSBoYXMgdG8gYmUgcmV2ZWFsZWQuXG5cdFx0XHRcdFx0XHRcXGBcXGBcXGBcblx0XHRcdFx0XHRcdCd0b3AnLCAnY2VudGVyJywgJ2JvdHRvbSdcblx0XHRcdFx0XHRcdFxcYFxcYFxcYFxuXHRcdFx0XHRgLFxuXHRcdFx0XHRjb25zdHJhaW50OiBpc1JldmVhbExpbmVBcmdzLFxuXHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHRcdCdyZXF1aXJlZCc6IFsnbGluZU51bWJlciddLFxuXHRcdFx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHRcdFx0J2xpbmVOdW1iZXInOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogWydudW1iZXInLCAnc3RyaW5nJ10sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0J2F0Jzoge1xuXHRcdFx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHQnZW51bSc6IFsndG9wJywgJ2NlbnRlcicsICdib3R0b20nXVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdF1cblx0fTtcblxuXHQvKipcblx0ICogQXJndW1lbnRzIGZvciByZXZlYWwgbGluZSBjb21tYW5kXG5cdCAqL1xuXHRleHBvcnQgaW50ZXJmYWNlIFJhd0FyZ3VtZW50cyB7XG5cdFx0bGluZU51bWJlcj86IG51bWJlciB8IHN0cmluZztcblx0XHRhdD86IHN0cmluZztcblx0fVxuXG5cdC8qKlxuXHQgKiBWYWx1ZXMgZm9yIHJldmVhbCBsaW5lICdhdCcgYXJndW1lbnRcblx0ICovXG5cdGV4cG9ydCBjb25zdCBSYXdBdEFyZ3VtZW50ID0ge1xuXHRcdFRvcDogJ3RvcCcsXG5cdFx0Q2VudGVyOiAnY2VudGVyJyxcblx0XHRCb3R0b206ICdib3R0b20nXG5cdH07XG59XG5cbmFic3RyYWN0IGNsYXNzIEVkaXRvck9yTmF0aXZlVGV4dElucHV0Q29tbWFuZCB7XG5cblx0Y29uc3RydWN0b3IodGFyZ2V0OiBNdWx0aUNvbW1hbmQpIHtcblx0XHQvLyAxLiBoYW5kbGUgY2FzZSB3aGVuIGZvY3VzIGlzIGluIGVkaXRvci5cblx0XHR0YXJnZXQuYWRkSW1wbGVtZW50YXRpb24oMTAwMDAsICdjb2RlLWVkaXRvcicsIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogdW5rbm93bikgPT4ge1xuXHRcdFx0Ly8gT25seSBpZiBlZGl0b3IgdGV4dCBmb2N1cyAoaS5lLiBub3QgaWYgZWRpdG9yIGhhcyB3aWRnZXQgZm9jdXMpLlxuXHRcdFx0Y29uc3QgZm9jdXNlZEVkaXRvciA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmdldEZvY3VzZWRDb2RlRWRpdG9yKCk7XG5cdFx0XHRpZiAoZm9jdXNlZEVkaXRvciAmJiBmb2N1c2VkRWRpdG9yLmhhc1RleHRGb2N1cygpKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9ydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yLCBmb2N1c2VkRWRpdG9yLCBhcmdzKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblxuXHRcdC8vIDIuIGhhbmRsZSBjYXNlIHdoZW4gZm9jdXMgaXMgaW4gc29tZSBvdGhlciBgaW5wdXRgIC8gYHRleHRhcmVhYC5cblx0XHR0YXJnZXQuYWRkSW1wbGVtZW50YXRpb24oMTAwMCwgJ2dlbmVyaWMtZG9tLWlucHV0LXRleHRhcmVhJywgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiB1bmtub3duKSA9PiB7XG5cdFx0XHQvLyBPbmx5IGlmIGZvY3VzZWQgb24gYW4gZWxlbWVudCB0aGF0IGFsbG93cyBmb3IgZW50ZXJpbmcgdGV4dFxuXHRcdFx0Y29uc3QgYWN0aXZlRWxlbWVudCA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRcdGlmIChhY3RpdmVFbGVtZW50ICYmIGlzRWRpdGFibGVFbGVtZW50KGFjdGl2ZUVsZW1lbnQpKSB7XG5cdFx0XHRcdHRoaXMucnVuRE9NQ29tbWFuZChhY3RpdmVFbGVtZW50KTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cblx0XHQvLyAzLiAoZGVmYXVsdCkgaGFuZGxlIGNhc2Ugd2hlbiBmb2N1cyBpcyBzb21ld2hlcmUgZWxzZS5cblx0XHR0YXJnZXQuYWRkSW1wbGVtZW50YXRpb24oMCwgJ2dlbmVyaWMtZG9tJywgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiB1bmtub3duKSA9PiB7XG5cdFx0XHQvLyBSZWRpcmVjdGluZyB0byBhY3RpdmUgZWRpdG9yXG5cdFx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKS5nZXRBY3RpdmVDb2RlRWRpdG9yKCk7XG5cdFx0XHRpZiAoYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdGFjdGl2ZUVkaXRvci5mb2N1cygpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvciwgYWN0aXZlRWRpdG9yLCBhcmdzKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBfcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IG51bGwsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IHVua25vd24pOiBib29sZWFuIHwgUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5ydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yLCBlZGl0b3IsIGFyZ3MpO1xuXHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIGFic3RyYWN0IHJ1bkRPTUNvbW1hbmQoYWN0aXZlRWxlbWVudDogRWxlbWVudCk6IHZvaWQ7XG5cdHB1YmxpYyBhYnN0cmFjdCBydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgbnVsbCwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJnczogdW5rbm93bik6IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBOYXZpZ2F0aW9uQ29tbWFuZFJldmVhbFR5cGUge1xuXHQvKipcblx0ICogRG8gcmVndWxhciByZXZlYWxpbmcuXG5cdCAqL1xuXHRSZWd1bGFyID0gMCxcblx0LyoqXG5cdCAqIERvIG9ubHkgbWluaW1hbCByZXZlYWxpbmcuXG5cdCAqL1xuXHRNaW5pbWFsID0gMSxcblx0LyoqXG5cdCAqIERvIG5vdCByZXZlYWwgdGhlIHBvc2l0aW9uLlxuXHQgKi9cblx0Tm9uZSA9IDJcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDb3JlTmF2aWdhdGlvbkNvbW1hbmRzIHtcblxuXHRleHBvcnQgaW50ZXJmYWNlIEJhc2VDb21tYW5kT3B0aW9ucyB7XG5cdFx0c291cmNlPzogJ21vdXNlJyB8ICdrZXlib2FyZCcgfCBzdHJpbmc7XG5cdH1cblxuXHRleHBvcnQgaW50ZXJmYWNlIE1vdmVDb21tYW5kT3B0aW9ucyBleHRlbmRzIEJhc2VDb21tYW5kT3B0aW9ucyB7XG5cdFx0cG9zaXRpb246IElQb3NpdGlvbjtcblx0XHR2aWV3UG9zaXRpb24/OiBJUG9zaXRpb247XG5cdFx0cmV2ZWFsVHlwZTogTmF2aWdhdGlvbkNvbW1hbmRSZXZlYWxUeXBlO1xuXHR9XG5cblx0Y2xhc3MgQmFzZU1vdmVUb0NvbW1hbmQgZXh0ZW5kcyBDb3JlRWRpdG9yQ29tbWFuZDxNb3ZlQ29tbWFuZE9wdGlvbnM+IHtcblxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2luU2VsZWN0aW9uTW9kZTogYm9vbGVhbjtcblxuXHRcdGNvbnN0cnVjdG9yKG9wdHM6IElDb21tYW5kT3B0aW9ucyAmIHsgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuIH0pIHtcblx0XHRcdHN1cGVyKG9wdHMpO1xuXHRcdFx0dGhpcy5faW5TZWxlY3Rpb25Nb2RlID0gb3B0cy5pblNlbGVjdGlvbk1vZGU7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxNb3ZlQ29tbWFuZE9wdGlvbnM+KTogdm9pZCB7XG5cdFx0XHRpZiAoIWFyZ3MucG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdGNvbnN0IGN1cnNvclN0YXRlQ2hhbmdlZCA9IHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRDdXJzb3JNb3ZlQ29tbWFuZHMubW92ZVRvKHZpZXdNb2RlbCwgdmlld01vZGVsLmdldFByaW1hcnlDdXJzb3JTdGF0ZSgpLCB0aGlzLl9pblNlbGVjdGlvbk1vZGUsIGFyZ3MucG9zaXRpb24sIGFyZ3Mudmlld1Bvc2l0aW9uKVxuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGN1cnNvclN0YXRlQ2hhbmdlZCAmJiBhcmdzLnJldmVhbFR5cGUgIT09IE5hdmlnYXRpb25Db21tYW5kUmV2ZWFsVHlwZS5Ob25lKSB7XG5cdFx0XHRcdHZpZXdNb2RlbC5yZXZlYWxBbGxDdXJzb3JzKGFyZ3Muc291cmNlLCB0cnVlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRleHBvcnQgY29uc3QgTW92ZVRvOiBDb3JlRWRpdG9yQ29tbWFuZDxNb3ZlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBCYXNlTW92ZVRvQ29tbWFuZCh7XG5cdFx0aWQ6ICdfbW92ZVRvJyxcblx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgTW92ZVRvU2VsZWN0OiBDb3JlRWRpdG9yQ29tbWFuZDxNb3ZlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBCYXNlTW92ZVRvQ29tbWFuZCh7XG5cdFx0aWQ6ICdfbW92ZVRvU2VsZWN0Jyxcblx0XHRpblNlbGVjdGlvbk1vZGU6IHRydWUsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0fSkpO1xuXG5cdGFic3RyYWN0IGNsYXNzIENvbHVtblNlbGVjdENvbW1hbmQ8VCBleHRlbmRzIEJhc2VDb21tYW5kT3B0aW9ucyA9IEJhc2VDb21tYW5kT3B0aW9ucz4gZXh0ZW5kcyBDb3JlRWRpdG9yQ29tbWFuZDxUPiB7XG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxUPik6IHZvaWQge1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX2dldENvbHVtblNlbGVjdFJlc3VsdCh2aWV3TW9kZWwsIHZpZXdNb2RlbC5nZXRQcmltYXJ5Q3Vyc29yU3RhdGUoKSwgdmlld01vZGVsLmdldEN1cnNvckNvbHVtblNlbGVjdERhdGEoKSwgYXJncyk7XG5cdFx0XHRpZiAocmVzdWx0ID09PSBudWxsKSB7XG5cdFx0XHRcdC8vIGludmFsaWQgYXJndW1lbnRzXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoYXJncy5zb3VyY2UsIEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCwgcmVzdWx0LnZpZXdTdGF0ZXMubWFwKCh2aWV3U3RhdGUpID0+IEN1cnNvclN0YXRlLmZyb21WaWV3U3RhdGUodmlld1N0YXRlKSkpO1xuXHRcdFx0dmlld01vZGVsLnNldEN1cnNvckNvbHVtblNlbGVjdERhdGEoe1xuXHRcdFx0XHRpc1JlYWw6IHRydWUsXG5cdFx0XHRcdGZyb21WaWV3TGluZU51bWJlcjogcmVzdWx0LmZyb21MaW5lTnVtYmVyLFxuXHRcdFx0XHRmcm9tVmlld1Zpc3VhbENvbHVtbjogcmVzdWx0LmZyb21WaXN1YWxDb2x1bW4sXG5cdFx0XHRcdHRvVmlld0xpbmVOdW1iZXI6IHJlc3VsdC50b0xpbmVOdW1iZXIsXG5cdFx0XHRcdHRvVmlld1Zpc3VhbENvbHVtbjogcmVzdWx0LnRvVmlzdWFsQ29sdW1uXG5cdFx0XHR9KTtcblx0XHRcdGlmIChyZXN1bHQucmV2ZXJzZWQpIHtcblx0XHRcdFx0dmlld01vZGVsLnJldmVhbFRvcE1vc3RDdXJzb3IoYXJncy5zb3VyY2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dmlld01vZGVsLnJldmVhbEJvdHRvbU1vc3RDdXJzb3IoYXJncy5zb3VyY2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHByb3RlY3RlZCBhYnN0cmFjdCBfZ2V0Q29sdW1uU2VsZWN0UmVzdWx0KHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgcHJpbWFyeTogQ3Vyc29yU3RhdGUsIHByZXZDb2x1bW5TZWxlY3REYXRhOiBJQ29sdW1uU2VsZWN0RGF0YSwgYXJnczogUGFydGlhbDxUPik6IElDb2x1bW5TZWxlY3RSZXN1bHQgfCBudWxsO1xuXG5cdH1cblxuXHRleHBvcnQgaW50ZXJmYWNlIENvbHVtblNlbGVjdENvbW1hbmRPcHRpb25zIGV4dGVuZHMgQmFzZUNvbW1hbmRPcHRpb25zIHtcblx0XHRwb3NpdGlvbjogSVBvc2l0aW9uO1xuXHRcdHZpZXdQb3NpdGlvbjogSVBvc2l0aW9uO1xuXHRcdG1vdXNlQ29sdW1uOiBudW1iZXI7XG5cdFx0ZG9Db2x1bW5TZWxlY3Q6IGJvb2xlYW47XG5cdH1cblxuXHRleHBvcnQgY29uc3QgQ29sdW1uU2VsZWN0OiBDb3JlRWRpdG9yQ29tbWFuZDxDb2x1bW5TZWxlY3RDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29sdW1uU2VsZWN0Q29tbWFuZDxDb2x1bW5TZWxlY3RDb21tYW5kT3B0aW9ucz4ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ2NvbHVtblNlbGVjdCcsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwcm90ZWN0ZWQgX2dldENvbHVtblNlbGVjdFJlc3VsdCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIHByaW1hcnk6IEN1cnNvclN0YXRlLCBwcmV2Q29sdW1uU2VsZWN0RGF0YTogSUNvbHVtblNlbGVjdERhdGEsIGFyZ3M6IFBhcnRpYWw8Q29sdW1uU2VsZWN0Q29tbWFuZE9wdGlvbnM+KTogSUNvbHVtblNlbGVjdFJlc3VsdCB8IG51bGwge1xuXHRcdFx0aWYgKHR5cGVvZiBhcmdzLnBvc2l0aW9uID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgYXJncy52aWV3UG9zaXRpb24gPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiBhcmdzLm1vdXNlQ29sdW1uID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdC8vIHZhbGlkYXRlIGBhcmdzYFxuXHRcdFx0Y29uc3QgdmFsaWRhdGVkUG9zaXRpb24gPSB2aWV3TW9kZWwubW9kZWwudmFsaWRhdGVQb3NpdGlvbihhcmdzLnBvc2l0aW9uKTtcblx0XHRcdGNvbnN0IHZhbGlkYXRlZFZpZXdQb3NpdGlvbiA9IHZpZXdNb2RlbC5jb29yZGluYXRlc0NvbnZlcnRlci52YWxpZGF0ZVZpZXdQb3NpdGlvbihuZXcgUG9zaXRpb24oYXJncy52aWV3UG9zaXRpb24ubGluZU51bWJlciwgYXJncy52aWV3UG9zaXRpb24uY29sdW1uKSwgdmFsaWRhdGVkUG9zaXRpb24pO1xuXG5cdFx0XHRjb25zdCBmcm9tVmlld0xpbmVOdW1iZXIgPSBhcmdzLmRvQ29sdW1uU2VsZWN0ID8gcHJldkNvbHVtblNlbGVjdERhdGEuZnJvbVZpZXdMaW5lTnVtYmVyIDogdmFsaWRhdGVkVmlld1Bvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHRjb25zdCBmcm9tVmlld1Zpc3VhbENvbHVtbiA9IGFyZ3MuZG9Db2x1bW5TZWxlY3QgPyBwcmV2Q29sdW1uU2VsZWN0RGF0YS5mcm9tVmlld1Zpc3VhbENvbHVtbiA6IGFyZ3MubW91c2VDb2x1bW4gLSAxO1xuXHRcdFx0cmV0dXJuIENvbHVtblNlbGVjdGlvbi5jb2x1bW5TZWxlY3Qodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLCBmcm9tVmlld0xpbmVOdW1iZXIsIGZyb21WaWV3VmlzdWFsQ29sdW1uLCB2YWxpZGF0ZWRWaWV3UG9zaXRpb24ubGluZU51bWJlciwgYXJncy5tb3VzZUNvbHVtbiAtIDEpO1xuXHRcdH1cblx0fSk7XG5cblx0ZXhwb3J0IGNvbnN0IEN1cnNvckNvbHVtblNlbGVjdExlZnQ6IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29sdW1uU2VsZWN0Q29tbWFuZCB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnY3Vyc29yQ29sdW1uU2VsZWN0TGVmdCcsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5MZWZ0QXJyb3csXG5cdFx0XHRcdFx0bGludXg6IHsgcHJpbWFyeTogMCB9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHByb3RlY3RlZCBfZ2V0Q29sdW1uU2VsZWN0UmVzdWx0KHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgcHJpbWFyeTogQ3Vyc29yU3RhdGUsIHByZXZDb2x1bW5TZWxlY3REYXRhOiBJQ29sdW1uU2VsZWN0RGF0YSwgYXJnczogUGFydGlhbDxCYXNlQ29tbWFuZE9wdGlvbnM+KTogSUNvbHVtblNlbGVjdFJlc3VsdCB7XG5cdFx0XHRyZXR1cm4gQ29sdW1uU2VsZWN0aW9uLmNvbHVtblNlbGVjdExlZnQodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLCBwcmV2Q29sdW1uU2VsZWN0RGF0YSk7XG5cdFx0fVxuXHR9KTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQ6IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29sdW1uU2VsZWN0Q29tbWFuZCB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnY3Vyc29yQ29sdW1uU2VsZWN0UmlnaHQnLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuUmlnaHRBcnJvdyxcblx0XHRcdFx0XHRsaW51eDogeyBwcmltYXJ5OiAwIH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHJvdGVjdGVkIF9nZXRDb2x1bW5TZWxlY3RSZXN1bHQodmlld01vZGVsOiBJVmlld01vZGVsLCBwcmltYXJ5OiBDdXJzb3JTdGF0ZSwgcHJldkNvbHVtblNlbGVjdERhdGE6IElDb2x1bW5TZWxlY3REYXRhLCBhcmdzOiBQYXJ0aWFsPEJhc2VDb21tYW5kT3B0aW9ucz4pOiBJQ29sdW1uU2VsZWN0UmVzdWx0IHtcblx0XHRcdHJldHVybiBDb2x1bW5TZWxlY3Rpb24uY29sdW1uU2VsZWN0UmlnaHQodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLCBwcmV2Q29sdW1uU2VsZWN0RGF0YSk7XG5cdFx0fVxuXHR9KTtcblxuXHRjbGFzcyBDb2x1bW5TZWxlY3RVcENvbW1hbmQgZXh0ZW5kcyBDb2x1bW5TZWxlY3RDb21tYW5kIHtcblxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lzUGFnZWQ6IGJvb2xlYW47XG5cblx0XHRjb25zdHJ1Y3RvcihvcHRzOiBJQ29tbWFuZE9wdGlvbnMgJiB7IGlzUGFnZWQ6IGJvb2xlYW4gfSkge1xuXHRcdFx0c3VwZXIob3B0cyk7XG5cdFx0XHR0aGlzLl9pc1BhZ2VkID0gb3B0cy5pc1BhZ2VkO1xuXHRcdH1cblxuXHRcdHByb3RlY3RlZCBfZ2V0Q29sdW1uU2VsZWN0UmVzdWx0KHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgcHJpbWFyeTogQ3Vyc29yU3RhdGUsIHByZXZDb2x1bW5TZWxlY3REYXRhOiBJQ29sdW1uU2VsZWN0RGF0YSwgYXJnczogUGFydGlhbDxCYXNlQ29tbWFuZE9wdGlvbnM+KTogSUNvbHVtblNlbGVjdFJlc3VsdCB7XG5cdFx0XHRyZXR1cm4gQ29sdW1uU2VsZWN0aW9uLmNvbHVtblNlbGVjdFVwKHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbCwgcHJldkNvbHVtblNlbGVjdERhdGEsIHRoaXMuX2lzUGFnZWQpO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JDb2x1bW5TZWxlY3RVcDogQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ29sdW1uU2VsZWN0VXBDb21tYW5kKHtcblx0XHRpc1BhZ2VkOiBmYWxzZSxcblx0XHRpZDogJ2N1cnNvckNvbHVtblNlbGVjdFVwJyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5VcEFycm93LFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogMCB9XG5cdFx0fVxuXHR9KSk7XG5cblx0ZXhwb3J0IGNvbnN0IEN1cnNvckNvbHVtblNlbGVjdFBhZ2VVcDogQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ29sdW1uU2VsZWN0VXBDb21tYW5kKHtcblx0XHRpc1BhZ2VkOiB0cnVlLFxuXHRcdGlkOiAnY3Vyc29yQ29sdW1uU2VsZWN0UGFnZVVwJyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5QYWdlVXAsXG5cdFx0XHRsaW51eDogeyBwcmltYXJ5OiAwIH1cblx0XHR9XG5cdH0pKTtcblxuXHRjbGFzcyBDb2x1bW5TZWxlY3REb3duQ29tbWFuZCBleHRlbmRzIENvbHVtblNlbGVjdENvbW1hbmQge1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaXNQYWdlZDogYm9vbGVhbjtcblxuXHRcdGNvbnN0cnVjdG9yKG9wdHM6IElDb21tYW5kT3B0aW9ucyAmIHsgaXNQYWdlZDogYm9vbGVhbiB9KSB7XG5cdFx0XHRzdXBlcihvcHRzKTtcblx0XHRcdHRoaXMuX2lzUGFnZWQgPSBvcHRzLmlzUGFnZWQ7XG5cdFx0fVxuXG5cdFx0cHJvdGVjdGVkIF9nZXRDb2x1bW5TZWxlY3RSZXN1bHQodmlld01vZGVsOiBJVmlld01vZGVsLCBwcmltYXJ5OiBDdXJzb3JTdGF0ZSwgcHJldkNvbHVtblNlbGVjdERhdGE6IElDb2x1bW5TZWxlY3REYXRhLCBhcmdzOiBQYXJ0aWFsPEJhc2VDb21tYW5kT3B0aW9ucz4pOiBJQ29sdW1uU2VsZWN0UmVzdWx0IHtcblx0XHRcdHJldHVybiBDb2x1bW5TZWxlY3Rpb24uY29sdW1uU2VsZWN0RG93bih2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwsIHByZXZDb2x1bW5TZWxlY3REYXRhLCB0aGlzLl9pc1BhZ2VkKTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yQ29sdW1uU2VsZWN0RG93bjogQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ29sdW1uU2VsZWN0RG93bkNvbW1hbmQoe1xuXHRcdGlzUGFnZWQ6IGZhbHNlLFxuXHRcdGlkOiAnY3Vyc29yQ29sdW1uU2VsZWN0RG93bicsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0a2JPcHRzOiB7XG5cdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogMCB9XG5cdFx0fVxuXHR9KSk7XG5cblx0ZXhwb3J0IGNvbnN0IEN1cnNvckNvbHVtblNlbGVjdFBhZ2VEb3duOiBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDb2x1bW5TZWxlY3REb3duQ29tbWFuZCh7XG5cdFx0aXNQYWdlZDogdHJ1ZSxcblx0XHRpZDogJ2N1cnNvckNvbHVtblNlbGVjdFBhZ2VEb3duJyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5QYWdlRG93bixcblx0XHRcdGxpbnV4OiB7IHByaW1hcnk6IDAgfVxuXHRcdH1cblx0fSkpO1xuXG5cdGV4cG9ydCBjbGFzcyBDdXJzb3JNb3ZlSW1wbCBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPEN1cnNvck1vdmVfLlJhd0FyZ3VtZW50cz4ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ2N1cnNvck1vdmUnLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0bWV0YWRhdGE6IEN1cnNvck1vdmVfLm1ldGFkYXRhXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgcnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiBQYXJ0aWFsPEJhc2VDb21tYW5kT3B0aW9ucyAmIEN1cnNvck1vdmVfLlJhd0FyZ3VtZW50cz4pOiB2b2lkIHtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IEN1cnNvck1vdmVfLnBhcnNlKGFyZ3MpO1xuXHRcdFx0aWYgKCFwYXJzZWQpIHtcblx0XHRcdFx0Ly8gaWxsZWdhbCBhcmd1bWVudHNcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fcnVuQ3Vyc29yTW92ZSh2aWV3TW9kZWwsIGFyZ3Muc291cmNlLCBwYXJzZWQpO1xuXHRcdH1cblxuXHRcdHByaXZhdGUgX3J1bkN1cnNvck1vdmUodmlld01vZGVsOiBJVmlld01vZGVsLCBzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGFyZ3M6IEN1cnNvck1vdmVfLlBhcnNlZEFyZ3VtZW50cyk6IHZvaWQge1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdHNvdXJjZSxcblx0XHRcdFx0Q3Vyc29yQ2hhbmdlUmVhc29uLkV4cGxpY2l0LFxuXHRcdFx0XHRDdXJzb3JNb3ZlSW1wbC5fbW92ZSh2aWV3TW9kZWwsIHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKSwgYXJncylcblx0XHRcdCk7XG5cdFx0XHR2aWV3TW9kZWwucmV2ZWFsQWxsQ3Vyc29ycyhzb3VyY2UsIHRydWUpO1xuXHRcdH1cblxuXHRcdHByaXZhdGUgc3RhdGljIF9tb3ZlKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgY3Vyc29yczogQ3Vyc29yU3RhdGVbXSwgYXJnczogQ3Vyc29yTW92ZV8uUGFyc2VkQXJndW1lbnRzKTogUGFydGlhbEN1cnNvclN0YXRlW10gfCBudWxsIHtcblx0XHRcdGNvbnN0IGluU2VsZWN0aW9uTW9kZSA9IGFyZ3Muc2VsZWN0O1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBhcmdzLnZhbHVlO1xuXG5cdFx0XHRzd2l0Y2ggKGFyZ3MuZGlyZWN0aW9uKSB7XG5cdFx0XHRcdGNhc2UgQ3Vyc29yTW92ZV8uRGlyZWN0aW9uLkxlZnQ6XG5cdFx0XHRcdGNhc2UgQ3Vyc29yTW92ZV8uRGlyZWN0aW9uLlJpZ2h0OlxuXHRcdFx0XHRjYXNlIEN1cnNvck1vdmVfLkRpcmVjdGlvbi5VcDpcblx0XHRcdFx0Y2FzZSBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uRG93bjpcblx0XHRcdFx0Y2FzZSBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uUHJldkJsYW5rTGluZTpcblx0XHRcdFx0Y2FzZSBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uTmV4dEJsYW5rTGluZTpcblx0XHRcdFx0Y2FzZSBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uV3JhcHBlZExpbmVTdGFydDpcblx0XHRcdFx0Y2FzZSBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uV3JhcHBlZExpbmVGaXJzdE5vbldoaXRlc3BhY2VDaGFyYWN0ZXI6XG5cdFx0XHRcdGNhc2UgQ3Vyc29yTW92ZV8uRGlyZWN0aW9uLldyYXBwZWRMaW5lQ29sdW1uQ2VudGVyOlxuXHRcdFx0XHRjYXNlIEN1cnNvck1vdmVfLkRpcmVjdGlvbi5XcmFwcGVkTGluZUVuZDpcblx0XHRcdFx0Y2FzZSBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uV3JhcHBlZExpbmVMYXN0Tm9uV2hpdGVzcGFjZUNoYXJhY3Rlcjpcblx0XHRcdFx0XHRyZXR1cm4gQ3Vyc29yTW92ZUNvbW1hbmRzLnNpbXBsZU1vdmUodmlld01vZGVsLCBjdXJzb3JzLCBhcmdzLmRpcmVjdGlvbiwgaW5TZWxlY3Rpb25Nb2RlLCB2YWx1ZSwgYXJncy51bml0KTtcblxuXHRcdFx0XHRjYXNlIEN1cnNvck1vdmVfLkRpcmVjdGlvbi5WaWV3UG9ydFRvcDpcblx0XHRcdFx0Y2FzZSBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uVmlld1BvcnRCb3R0b206XG5cdFx0XHRcdGNhc2UgQ3Vyc29yTW92ZV8uRGlyZWN0aW9uLlZpZXdQb3J0Q2VudGVyOlxuXHRcdFx0XHRjYXNlIEN1cnNvck1vdmVfLkRpcmVjdGlvbi5WaWV3UG9ydElmT3V0c2lkZTpcblx0XHRcdFx0XHRyZXR1cm4gQ3Vyc29yTW92ZUNvbW1hbmRzLnZpZXdwb3J0TW92ZSh2aWV3TW9kZWwsIGN1cnNvcnMsIGFyZ3MuZGlyZWN0aW9uLCBpblNlbGVjdGlvbk1vZGUsIHZhbHVlKTtcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yTW92ZTogQ3Vyc29yTW92ZUltcGwgPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvck1vdmVJbXBsKCkpO1xuXG5cdGNvbnN0IGVudW0gQ29uc3RhbnRzIHtcblx0XHRQQUdFX1NJWkVfTUFSS0VSID0gLTFcblx0fVxuXG5cdGV4cG9ydCBpbnRlcmZhY2UgQ3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zIGV4dGVuZHMgQmFzZUNvbW1hbmRPcHRpb25zIHtcblx0XHRwYWdlU2l6ZT86IG51bWJlcjtcblx0fVxuXG5cdGNsYXNzIEN1cnNvck1vdmVCYXNlZENvbW1hbmQgZXh0ZW5kcyBDb3JlRWRpdG9yQ29tbWFuZDxDdXJzb3JNb3ZlQ29tbWFuZE9wdGlvbnM+IHtcblxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRpY0FyZ3M6IEN1cnNvck1vdmVfLlNpbXBsZU1vdmVBcmd1bWVudHM7XG5cblx0XHRjb25zdHJ1Y3RvcihvcHRzOiBJQ29tbWFuZE9wdGlvbnMgJiB7IGFyZ3M6IEN1cnNvck1vdmVfLlNpbXBsZU1vdmVBcmd1bWVudHMgfSkge1xuXHRcdFx0c3VwZXIob3B0cyk7XG5cdFx0XHR0aGlzLl9zdGF0aWNBcmdzID0gb3B0cy5hcmdzO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGR5bmFtaWNBcmdzOiBQYXJ0aWFsPEN1cnNvck1vdmVDb21tYW5kT3B0aW9ucz4pOiB2b2lkIHtcblx0XHRcdGxldCBhcmdzID0gdGhpcy5fc3RhdGljQXJncztcblx0XHRcdGlmICh0aGlzLl9zdGF0aWNBcmdzLnZhbHVlID09PSBDb25zdGFudHMuUEFHRV9TSVpFX01BUktFUikge1xuXHRcdFx0XHQvLyAtMSBpcyBhIG1hcmtlciBmb3IgcGFnZSBzaXplXG5cdFx0XHRcdGFyZ3MgPSB7XG5cdFx0XHRcdFx0ZGlyZWN0aW9uOiB0aGlzLl9zdGF0aWNBcmdzLmRpcmVjdGlvbixcblx0XHRcdFx0XHR1bml0OiB0aGlzLl9zdGF0aWNBcmdzLnVuaXQsXG5cdFx0XHRcdFx0c2VsZWN0OiB0aGlzLl9zdGF0aWNBcmdzLnNlbGVjdCxcblx0XHRcdFx0XHR2YWx1ZTogZHluYW1pY0FyZ3MucGFnZVNpemUgfHwgdmlld01vZGVsLmN1cnNvckNvbmZpZy5wYWdlU2l6ZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdFx0dmlld01vZGVsLnNldEN1cnNvclN0YXRlcyhcblx0XHRcdFx0ZHluYW1pY0FyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdEN1cnNvck1vdmVDb21tYW5kcy5zaW1wbGVNb3ZlKHZpZXdNb2RlbCwgdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpLCBhcmdzLmRpcmVjdGlvbiwgYXJncy5zZWxlY3QsIGFyZ3MudmFsdWUsIGFyZ3MudW5pdClcblx0XHRcdCk7XG5cdFx0XHR2aWV3TW9kZWwucmV2ZWFsQWxsQ3Vyc29ycyhkeW5hbWljQXJncy5zb3VyY2UsIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JMZWZ0OiBDb3JlRWRpdG9yQ29tbWFuZDxDdXJzb3JNb3ZlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDdXJzb3JNb3ZlQmFzZWRDb21tYW5kKHtcblx0XHRhcmdzOiB7XG5cdFx0XHRkaXJlY3Rpb246IEN1cnNvck1vdmVfLkRpcmVjdGlvbi5MZWZ0LFxuXHRcdFx0dW5pdDogQ3Vyc29yTW92ZV8uVW5pdC5Ob25lLFxuXHRcdFx0c2VsZWN0OiBmYWxzZSxcblx0XHRcdHZhbHVlOiAxXG5cdFx0fSxcblx0XHRpZDogJ2N1cnNvckxlZnQnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkxlZnRBcnJvdyxcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkxlZnRBcnJvdywgc2Vjb25kYXJ5OiBbS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleUJdIH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yTGVmdFNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8Q3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yTW92ZUJhc2VkQ29tbWFuZCh7XG5cdFx0YXJnczoge1xuXHRcdFx0ZGlyZWN0aW9uOiBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uTGVmdCxcblx0XHRcdHVuaXQ6IEN1cnNvck1vdmVfLlVuaXQuTm9uZSxcblx0XHRcdHNlbGVjdDogdHJ1ZSxcblx0XHRcdHZhbHVlOiAxXG5cdFx0fSxcblx0XHRpZDogJ2N1cnNvckxlZnRTZWxlY3QnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkxlZnRBcnJvd1xuXHRcdH1cblx0fSkpO1xuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JSaWdodDogQ29yZUVkaXRvckNvbW1hbmQ8Q3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yTW92ZUJhc2VkQ29tbWFuZCh7XG5cdFx0YXJnczoge1xuXHRcdFx0ZGlyZWN0aW9uOiBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uUmlnaHQsXG5cdFx0XHR1bml0OiBDdXJzb3JNb3ZlXy5Vbml0Lk5vbmUsXG5cdFx0XHRzZWxlY3Q6IGZhbHNlLFxuXHRcdFx0dmFsdWU6IDFcblx0XHR9LFxuXHRcdGlkOiAnY3Vyc29yUmlnaHQnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiBLZXlDb2RlLlJpZ2h0QXJyb3csXG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5Q29kZS5SaWdodEFycm93LCBzZWNvbmRhcnk6IFtLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuS2V5Rl0gfVxuXHRcdH1cblx0fSkpO1xuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JSaWdodFNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8Q3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yTW92ZUJhc2VkQ29tbWFuZCh7XG5cdFx0YXJnczoge1xuXHRcdFx0ZGlyZWN0aW9uOiBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uUmlnaHQsXG5cdFx0XHR1bml0OiBDdXJzb3JNb3ZlXy5Vbml0Lk5vbmUsXG5cdFx0XHRzZWxlY3Q6IHRydWUsXG5cdFx0XHR2YWx1ZTogMVxuXHRcdH0sXG5cdFx0aWQ6ICdjdXJzb3JSaWdodFNlbGVjdCcsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0a2JPcHRzOiB7XG5cdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUmlnaHRBcnJvd1xuXHRcdH1cblx0fSkpO1xuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JVcDogQ29yZUVkaXRvckNvbW1hbmQ8Q3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yTW92ZUJhc2VkQ29tbWFuZCh7XG5cdFx0YXJnczoge1xuXHRcdFx0ZGlyZWN0aW9uOiBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uVXAsXG5cdFx0XHR1bml0OiBDdXJzb3JNb3ZlXy5Vbml0LldyYXBwZWRMaW5lLFxuXHRcdFx0c2VsZWN0OiBmYWxzZSxcblx0XHRcdHZhbHVlOiAxXG5cdFx0fSxcblx0XHRpZDogJ2N1cnNvclVwJyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5Q29kZS5VcEFycm93LFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleUNvZGUuVXBBcnJvdywgc2Vjb25kYXJ5OiBbS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleVBdIH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yVXBTZWxlY3Q6IENvcmVFZGl0b3JDb21tYW5kPEN1cnNvck1vdmVDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvck1vdmVCYXNlZENvbW1hbmQoe1xuXHRcdGFyZ3M6IHtcblx0XHRcdGRpcmVjdGlvbjogQ3Vyc29yTW92ZV8uRGlyZWN0aW9uLlVwLFxuXHRcdFx0dW5pdDogQ3Vyc29yTW92ZV8uVW5pdC5XcmFwcGVkTGluZSxcblx0XHRcdHNlbGVjdDogdHJ1ZSxcblx0XHRcdHZhbHVlOiAxXG5cdFx0fSxcblx0XHRpZDogJ2N1cnNvclVwU2VsZWN0Jyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5VcEFycm93LFxuXHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlVwQXJyb3ddLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuVXBBcnJvdyB9LFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5VcEFycm93IH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yUGFnZVVwOiBDb3JlRWRpdG9yQ29tbWFuZDxDdXJzb3JNb3ZlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBDdXJzb3JNb3ZlQmFzZWRDb21tYW5kKHtcblx0XHRhcmdzOiB7XG5cdFx0XHRkaXJlY3Rpb246IEN1cnNvck1vdmVfLkRpcmVjdGlvbi5VcCxcblx0XHRcdHVuaXQ6IEN1cnNvck1vdmVfLlVuaXQuV3JhcHBlZExpbmUsXG5cdFx0XHRzZWxlY3Q6IGZhbHNlLFxuXHRcdFx0dmFsdWU6IENvbnN0YW50cy5QQUdFX1NJWkVfTUFSS0VSXG5cdFx0fSxcblx0XHRpZDogJ2N1cnNvclBhZ2VVcCcsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0a2JPcHRzOiB7XG5cdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdHByaW1hcnk6IEtleUNvZGUuUGFnZVVwXG5cdFx0fVxuXHR9KSk7XG5cblx0ZXhwb3J0IGNvbnN0IEN1cnNvclBhZ2VVcFNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8Q3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yTW92ZUJhc2VkQ29tbWFuZCh7XG5cdFx0YXJnczoge1xuXHRcdFx0ZGlyZWN0aW9uOiBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uVXAsXG5cdFx0XHR1bml0OiBDdXJzb3JNb3ZlXy5Vbml0LldyYXBwZWRMaW5lLFxuXHRcdFx0c2VsZWN0OiB0cnVlLFxuXHRcdFx0dmFsdWU6IENvbnN0YW50cy5QQUdFX1NJWkVfTUFSS0VSXG5cdFx0fSxcblx0XHRpZDogJ2N1cnNvclBhZ2VVcFNlbGVjdCcsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0a2JPcHRzOiB7XG5cdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUGFnZVVwXG5cdFx0fVxuXHR9KSk7XG5cblx0ZXhwb3J0IGNvbnN0IEN1cnNvckRvd246IENvcmVFZGl0b3JDb21tYW5kPEN1cnNvck1vdmVDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEN1cnNvck1vdmVCYXNlZENvbW1hbmQoe1xuXHRcdGFyZ3M6IHtcblx0XHRcdGRpcmVjdGlvbjogQ3Vyc29yTW92ZV8uRGlyZWN0aW9uLkRvd24sXG5cdFx0XHR1bml0OiBDdXJzb3JNb3ZlXy5Vbml0LldyYXBwZWRMaW5lLFxuXHRcdFx0c2VsZWN0OiBmYWxzZSxcblx0XHRcdHZhbHVlOiAxXG5cdFx0fSxcblx0XHRpZDogJ2N1cnNvckRvd24nLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkRvd25BcnJvdywgc2Vjb25kYXJ5OiBbS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleU5dIH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yRG93blNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8Q3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yTW92ZUJhc2VkQ29tbWFuZCh7XG5cdFx0YXJnczoge1xuXHRcdFx0ZGlyZWN0aW9uOiBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uRG93bixcblx0XHRcdHVuaXQ6IEN1cnNvck1vdmVfLlVuaXQuV3JhcHBlZExpbmUsXG5cdFx0XHRzZWxlY3Q6IHRydWUsXG5cdFx0XHR2YWx1ZTogMVxuXHRcdH0sXG5cdFx0aWQ6ICdjdXJzb3JEb3duU2VsZWN0Jyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRG93bkFycm93XSxcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkRvd25BcnJvdyB9LFxuXHRcdFx0bGludXg6IHsgcHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Eb3duQXJyb3cgfVxuXHRcdH1cblx0fSkpO1xuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JQYWdlRG93bjogQ29yZUVkaXRvckNvbW1hbmQ8Q3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yTW92ZUJhc2VkQ29tbWFuZCh7XG5cdFx0YXJnczoge1xuXHRcdFx0ZGlyZWN0aW9uOiBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uRG93bixcblx0XHRcdHVuaXQ6IEN1cnNvck1vdmVfLlVuaXQuV3JhcHBlZExpbmUsXG5cdFx0XHRzZWxlY3Q6IGZhbHNlLFxuXHRcdFx0dmFsdWU6IENvbnN0YW50cy5QQUdFX1NJWkVfTUFSS0VSXG5cdFx0fSxcblx0XHRpZDogJ2N1cnNvclBhZ2VEb3duJyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5Q29kZS5QYWdlRG93blxuXHRcdH1cblx0fSkpO1xuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JQYWdlRG93blNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8Q3Vyc29yTW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgQ3Vyc29yTW92ZUJhc2VkQ29tbWFuZCh7XG5cdFx0YXJnczoge1xuXHRcdFx0ZGlyZWN0aW9uOiBDdXJzb3JNb3ZlXy5EaXJlY3Rpb24uRG93bixcblx0XHRcdHVuaXQ6IEN1cnNvck1vdmVfLlVuaXQuV3JhcHBlZExpbmUsXG5cdFx0XHRzZWxlY3Q6IHRydWUsXG5cdFx0XHR2YWx1ZTogQ29uc3RhbnRzLlBBR0VfU0laRV9NQVJLRVJcblx0XHR9LFxuXHRcdGlkOiAnY3Vyc29yUGFnZURvd25TZWxlY3QnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlBhZ2VEb3duXG5cdFx0fVxuXHR9KSk7XG5cblx0ZXhwb3J0IGludGVyZmFjZSBDcmVhdGVDdXJzb3JDb21tYW5kT3B0aW9ucyBleHRlbmRzIE1vdmVDb21tYW5kT3B0aW9ucyB7XG5cdFx0d2hvbGVMaW5lPzogYm9vbGVhbjtcblx0fVxuXG5cdGV4cG9ydCBjb25zdCBDcmVhdGVDdXJzb3I6IENvcmVFZGl0b3JDb21tYW5kPENyZWF0ZUN1cnNvckNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgY2xhc3MgZXh0ZW5kcyBDb3JlRWRpdG9yQ29tbWFuZDxDcmVhdGVDdXJzb3JDb21tYW5kT3B0aW9ucz4ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ2NyZWF0ZUN1cnNvcicsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgcnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiBQYXJ0aWFsPENyZWF0ZUN1cnNvckNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0aWYgKCFhcmdzLnBvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGxldCBuZXdTdGF0ZTogUGFydGlhbEN1cnNvclN0YXRlO1xuXHRcdFx0aWYgKGFyZ3Mud2hvbGVMaW5lKSB7XG5cdFx0XHRcdG5ld1N0YXRlID0gQ3Vyc29yTW92ZUNvbW1hbmRzLmxpbmUodmlld01vZGVsLCB2aWV3TW9kZWwuZ2V0UHJpbWFyeUN1cnNvclN0YXRlKCksIGZhbHNlLCBhcmdzLnBvc2l0aW9uLCBhcmdzLnZpZXdQb3NpdGlvbik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXdTdGF0ZSA9IEN1cnNvck1vdmVDb21tYW5kcy5tb3ZlVG8odmlld01vZGVsLCB2aWV3TW9kZWwuZ2V0UHJpbWFyeUN1cnNvclN0YXRlKCksIGZhbHNlLCBhcmdzLnBvc2l0aW9uLCBhcmdzLnZpZXdQb3NpdGlvbik7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN0YXRlczogUGFydGlhbEN1cnNvclN0YXRlW10gPSB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCk7XG5cblx0XHRcdC8vIENoZWNrIGlmIHdlIHNob3VsZCByZW1vdmUgYSBjdXJzb3IgKHNvcnQgb2YgbGlrZSBhIHRvZ2dsZSlcblx0XHRcdGlmIChzdGF0ZXMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRjb25zdCBuZXdNb2RlbFBvc2l0aW9uID0gKG5ld1N0YXRlLm1vZGVsU3RhdGUgPyBuZXdTdGF0ZS5tb2RlbFN0YXRlLnBvc2l0aW9uIDogbnVsbCk7XG5cdFx0XHRcdGNvbnN0IG5ld1ZpZXdQb3NpdGlvbiA9IChuZXdTdGF0ZS52aWV3U3RhdGUgPyBuZXdTdGF0ZS52aWV3U3RhdGUucG9zaXRpb24gOiBudWxsKTtcblxuXHRcdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gc3RhdGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhdGUgPSBzdGF0ZXNbaV07XG5cblx0XHRcdFx0XHRpZiAobmV3TW9kZWxQb3NpdGlvbiAmJiAhc3RhdGUubW9kZWxTdGF0ZSEuc2VsZWN0aW9uLmNvbnRhaW5zUG9zaXRpb24obmV3TW9kZWxQb3NpdGlvbikpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChuZXdWaWV3UG9zaXRpb24gJiYgIXN0YXRlLnZpZXdTdGF0ZSEuc2VsZWN0aW9uLmNvbnRhaW5zUG9zaXRpb24obmV3Vmlld1Bvc2l0aW9uKSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gPT4gUmVtb3ZlIHRoZSBjdXJzb3Jcblx0XHRcdFx0XHRzdGF0ZXMuc3BsaWNlKGksIDEpO1xuXG5cdFx0XHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdFx0XHR2aWV3TW9kZWwuc2V0Q3Vyc29yU3RhdGVzKFxuXHRcdFx0XHRcdFx0YXJncy5zb3VyY2UsXG5cdFx0XHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdFx0XHRzdGF0ZXNcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyA9PiBBZGQgdGhlIG5ldyBjdXJzb3Jcblx0XHRcdHN0YXRlcy5wdXNoKG5ld1N0YXRlKTtcblxuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdHN0YXRlc1xuXHRcdFx0KTtcblx0XHR9XG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBMYXN0Q3Vyc29yTW92ZVRvU2VsZWN0OiBDb3JlRWRpdG9yQ29tbWFuZDxNb3ZlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBjbGFzcyBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPE1vdmVDb21tYW5kT3B0aW9ucz4ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ19sYXN0Q3Vyc29yTW92ZVRvU2VsZWN0Jyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8TW92ZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0aWYgKCFhcmdzLnBvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGxhc3RBZGRlZEN1cnNvckluZGV4ID0gdmlld01vZGVsLmdldExhc3RBZGRlZEN1cnNvckluZGV4KCk7XG5cblx0XHRcdGNvbnN0IHN0YXRlcyA9IHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKTtcblx0XHRcdGNvbnN0IG5ld1N0YXRlczogUGFydGlhbEN1cnNvclN0YXRlW10gPSBzdGF0ZXMuc2xpY2UoMCk7XG5cdFx0XHRuZXdTdGF0ZXNbbGFzdEFkZGVkQ3Vyc29ySW5kZXhdID0gQ3Vyc29yTW92ZUNvbW1hbmRzLm1vdmVUbyh2aWV3TW9kZWwsIHN0YXRlc1tsYXN0QWRkZWRDdXJzb3JJbmRleF0sIHRydWUsIGFyZ3MucG9zaXRpb24sIGFyZ3Mudmlld1Bvc2l0aW9uKTtcblxuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdG5ld1N0YXRlc1xuXHRcdFx0KTtcblx0XHR9XG5cdH0pO1xuXG5cdGNsYXNzIEhvbWVDb21tYW5kIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pblNlbGVjdGlvbk1vZGU6IGJvb2xlYW47XG5cblx0XHRjb25zdHJ1Y3RvcihvcHRzOiBJQ29tbWFuZE9wdGlvbnMgJiB7IGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiB9KSB7XG5cdFx0XHRzdXBlcihvcHRzKTtcblx0XHRcdHRoaXMuX2luU2VsZWN0aW9uTW9kZSA9IG9wdHMuaW5TZWxlY3Rpb25Nb2RlO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8QmFzZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdEN1cnNvck1vdmVDb21tYW5kcy5tb3ZlVG9CZWdpbm5pbmdPZkxpbmUodmlld01vZGVsLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCksIHRoaXMuX2luU2VsZWN0aW9uTW9kZSlcblx0XHRcdCk7XG5cdFx0XHR2aWV3TW9kZWwucmV2ZWFsQWxsQ3Vyc29ycyhhcmdzLnNvdXJjZSwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IEN1cnNvckhvbWU6IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEhvbWVDb21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdGlkOiAnY3Vyc29ySG9tZScsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0a2JPcHRzOiB7XG5cdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdHByaW1hcnk6IEtleUNvZGUuSG9tZSxcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkhvbWUsIHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5MZWZ0QXJyb3ddIH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29ySG9tZVNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgSG9tZUNvbW1hbmQoe1xuXHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRpZDogJ2N1cnNvckhvbWVTZWxlY3QnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkhvbWUsXG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Ib21lLCBzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuTGVmdEFycm93XSB9XG5cdFx0fVxuXHR9KSk7XG5cblx0Y2xhc3MgTGluZVN0YXJ0Q29tbWFuZCBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4ge1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuO1xuXG5cdFx0Y29uc3RydWN0b3Iob3B0czogSUNvbW1hbmRPcHRpb25zICYgeyBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4gfSkge1xuXHRcdFx0c3VwZXIob3B0cyk7XG5cdFx0XHR0aGlzLl9pblNlbGVjdGlvbk1vZGUgPSBvcHRzLmluU2VsZWN0aW9uTW9kZTtcblx0XHR9XG5cblx0XHRwdWJsaWMgcnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiBQYXJ0aWFsPEJhc2VDb21tYW5kT3B0aW9ucz4pOiB2b2lkIHtcblx0XHRcdHZpZXdNb2RlbC5tb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHR2aWV3TW9kZWwuc2V0Q3Vyc29yU3RhdGVzKFxuXHRcdFx0XHRhcmdzLnNvdXJjZSxcblx0XHRcdFx0Q3Vyc29yQ2hhbmdlUmVhc29uLkV4cGxpY2l0LFxuXHRcdFx0XHR0aGlzLl9leGVjKHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKSlcblx0XHRcdCk7XG5cdFx0XHR2aWV3TW9kZWwucmV2ZWFsQWxsQ3Vyc29ycyhhcmdzLnNvdXJjZSwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0cHJpdmF0ZSBfZXhlYyhjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdKTogUGFydGlhbEN1cnNvclN0YXRlW10ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgY3Vyc29yID0gY3Vyc29yc1tpXTtcblx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IGN1cnNvci5tb2RlbFN0YXRlLnBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHRcdHJlc3VsdFtpXSA9IEN1cnNvclN0YXRlLmZyb21Nb2RlbFN0YXRlKGN1cnNvci5tb2RlbFN0YXRlLm1vdmUodGhpcy5faW5TZWxlY3Rpb25Nb2RlLCBsaW5lTnVtYmVyLCAxLCAwKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JMaW5lU3RhcnQ6IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IExpbmVTdGFydENvbW1hbmQoe1xuXHRcdGluU2VsZWN0aW9uTW9kZTogZmFsc2UsXG5cdFx0aWQ6ICdjdXJzb3JMaW5lU3RhcnQnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiAwLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlBIH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yTGluZVN0YXJ0U2VsZWN0OiBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBMaW5lU3RhcnRDb21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IHRydWUsXG5cdFx0aWQ6ICdjdXJzb3JMaW5lU3RhcnRTZWxlY3QnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiAwLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlBIH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgaW50ZXJmYWNlIEVuZENvbW1hbmRPcHRpb25zIGV4dGVuZHMgQmFzZUNvbW1hbmRPcHRpb25zIHtcblx0XHRzdGlja3k/OiBib29sZWFuO1xuXHR9XG5cblx0Y2xhc3MgRW5kQ29tbWFuZCBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPEVuZENvbW1hbmRPcHRpb25zPiB7XG5cblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pblNlbGVjdGlvbk1vZGU6IGJvb2xlYW47XG5cblx0XHRjb25zdHJ1Y3RvcihvcHRzOiBJQ29tbWFuZE9wdGlvbnMgJiB7IGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiB9KSB7XG5cdFx0XHRzdXBlcihvcHRzKTtcblx0XHRcdHRoaXMuX2luU2VsZWN0aW9uTW9kZSA9IG9wdHMuaW5TZWxlY3Rpb25Nb2RlO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8RW5kQ29tbWFuZE9wdGlvbnM+KTogdm9pZCB7XG5cdFx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdFx0dmlld01vZGVsLnNldEN1cnNvclN0YXRlcyhcblx0XHRcdFx0YXJncy5zb3VyY2UsXG5cdFx0XHRcdEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCxcblx0XHRcdFx0Q3Vyc29yTW92ZUNvbW1hbmRzLm1vdmVUb0VuZE9mTGluZSh2aWV3TW9kZWwsIHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKSwgdGhpcy5faW5TZWxlY3Rpb25Nb2RlLCBhcmdzLnN0aWNreSB8fCBmYWxzZSlcblx0XHRcdCk7XG5cdFx0XHR2aWV3TW9kZWwucmV2ZWFsQWxsQ3Vyc29ycyhhcmdzLnNvdXJjZSwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IEN1cnNvckVuZDogQ29yZUVkaXRvckNvbW1hbmQ8RW5kQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBFbmRDb21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdGlkOiAnY3Vyc29yRW5kJyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdGFyZ3M6IHsgc3RpY2t5OiBmYWxzZSB9LFxuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVuZCxcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkVuZCwgc2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlJpZ2h0QXJyb3ddIH1cblx0XHR9LFxuXHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogYEdvIHRvIEVuZGAsXG5cdFx0XHRhcmdzOiBbe1xuXHRcdFx0XHRuYW1lOiAnYXJncycsXG5cdFx0XHRcdHNjaGVtYToge1xuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdCdzdGlja3knOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3N0aWNreWRlc2MnLCBcIlN0aWNrIHRvIHRoZSBlbmQgZXZlbiB3aGVuIGdvaW5nIHRvIGxvbmdlciBsaW5lc1wiKSxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fV1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yRW5kU2VsZWN0OiBDb3JlRWRpdG9yQ29tbWFuZDxFbmRDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IEVuZENvbW1hbmQoe1xuXHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRpZDogJ2N1cnNvckVuZFNlbGVjdCcsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0a2JPcHRzOiB7XG5cdFx0XHRhcmdzOiB7IHN0aWNreTogZmFsc2UgfSxcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbmQsXG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbmQsIHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5SaWdodEFycm93XSB9XG5cdFx0fSxcblx0XHRtZXRhZGF0YToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGBTZWxlY3QgdG8gRW5kYCxcblx0XHRcdGFyZ3M6IFt7XG5cdFx0XHRcdG5hbWU6ICdhcmdzJyxcblx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0J3N0aWNreSc6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3RpY2t5ZGVzYycsIFwiU3RpY2sgdG8gdGhlIGVuZCBldmVuIHdoZW4gZ29pbmcgdG8gbG9uZ2VyIGxpbmVzXCIpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XVxuXHRcdH1cblx0fSkpO1xuXG5cdGNsYXNzIExpbmVFbmRDb21tYW5kIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pblNlbGVjdGlvbk1vZGU6IGJvb2xlYW47XG5cblx0XHRjb25zdHJ1Y3RvcihvcHRzOiBJQ29tbWFuZE9wdGlvbnMgJiB7IGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiB9KSB7XG5cdFx0XHRzdXBlcihvcHRzKTtcblx0XHRcdHRoaXMuX2luU2VsZWN0aW9uTW9kZSA9IG9wdHMuaW5TZWxlY3Rpb25Nb2RlO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8QmFzZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdHRoaXMuX2V4ZWModmlld01vZGVsLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCkpXG5cdFx0XHQpO1xuXHRcdFx0dmlld01vZGVsLnJldmVhbEFsbEN1cnNvcnMoYXJncy5zb3VyY2UsIHRydWUpO1xuXHRcdH1cblxuXHRcdHByaXZhdGUgX2V4ZWModmlld01vZGVsOiBJVmlld01vZGVsLCBjdXJzb3JzOiBDdXJzb3JTdGF0ZVtdKTogUGFydGlhbEN1cnNvclN0YXRlW10ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGN1cnNvcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgY3Vyc29yID0gY3Vyc29yc1tpXTtcblx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IGN1cnNvci5tb2RlbFN0YXRlLnBvc2l0aW9uLmxpbmVOdW1iZXI7XG5cdFx0XHRcdGNvbnN0IG1heENvbHVtbiA9IHZpZXdNb2RlbC5tb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRyZXN1bHRbaV0gPSBDdXJzb3JTdGF0ZS5mcm9tTW9kZWxTdGF0ZShjdXJzb3IubW9kZWxTdGF0ZS5tb3ZlKHRoaXMuX2luU2VsZWN0aW9uTW9kZSwgbGluZU51bWJlciwgbWF4Q29sdW1uLCAwKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JMaW5lRW5kOiBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBMaW5lRW5kQ29tbWFuZCh7XG5cdFx0aW5TZWxlY3Rpb25Nb2RlOiBmYWxzZSxcblx0XHRpZDogJ2N1cnNvckxpbmVFbmQnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiAwLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlFIH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yTGluZUVuZFNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgTGluZUVuZENvbW1hbmQoe1xuXHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRpZDogJ2N1cnNvckxpbmVFbmRTZWxlY3QnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiAwLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlFIH1cblx0XHR9XG5cdH0pKTtcblxuXHRjbGFzcyBUb3BDb21tYW5kIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pblNlbGVjdGlvbk1vZGU6IGJvb2xlYW47XG5cblx0XHRjb25zdHJ1Y3RvcihvcHRzOiBJQ29tbWFuZE9wdGlvbnMgJiB7IGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiB9KSB7XG5cdFx0XHRzdXBlcihvcHRzKTtcblx0XHRcdHRoaXMuX2luU2VsZWN0aW9uTW9kZSA9IG9wdHMuaW5TZWxlY3Rpb25Nb2RlO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8QmFzZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdEN1cnNvck1vdmVDb21tYW5kcy5tb3ZlVG9CZWdpbm5pbmdPZkJ1ZmZlcih2aWV3TW9kZWwsIHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKSwgdGhpcy5faW5TZWxlY3Rpb25Nb2RlKVxuXHRcdFx0KTtcblx0XHRcdHZpZXdNb2RlbC5yZXZlYWxBbGxDdXJzb3JzKGFyZ3Muc291cmNlLCB0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yVG9wOiBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBUb3BDb21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdGlkOiAnY3Vyc29yVG9wJyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkhvbWUsXG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlVwQXJyb3cgfVxuXHRcdH1cblx0fSkpO1xuXG5cdGV4cG9ydCBjb25zdCBDdXJzb3JUb3BTZWxlY3Q6IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFRvcENvbW1hbmQoe1xuXHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRpZDogJ2N1cnNvclRvcFNlbGVjdCcsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0a2JPcHRzOiB7XG5cdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Ib21lLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5VcEFycm93IH1cblx0XHR9XG5cdH0pKTtcblxuXHRjbGFzcyBCb3R0b21Db21tYW5kIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pblNlbGVjdGlvbk1vZGU6IGJvb2xlYW47XG5cblx0XHRjb25zdHJ1Y3RvcihvcHRzOiBJQ29tbWFuZE9wdGlvbnMgJiB7IGluU2VsZWN0aW9uTW9kZTogYm9vbGVhbiB9KSB7XG5cdFx0XHRzdXBlcihvcHRzKTtcblx0XHRcdHRoaXMuX2luU2VsZWN0aW9uTW9kZSA9IG9wdHMuaW5TZWxlY3Rpb25Nb2RlO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8QmFzZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdEN1cnNvck1vdmVDb21tYW5kcy5tb3ZlVG9FbmRPZkJ1ZmZlcih2aWV3TW9kZWwsIHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKSwgdGhpcy5faW5TZWxlY3Rpb25Nb2RlKVxuXHRcdFx0KTtcblx0XHRcdHZpZXdNb2RlbC5yZXZlYWxBbGxDdXJzb3JzKGFyZ3Muc291cmNlLCB0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yQm90dG9tOiBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBCb3R0b21Db21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdGlkOiAnY3Vyc29yQm90dG9tJyxcblx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRrYk9wdHM6IHtcblx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVuZCxcblx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93IH1cblx0XHR9XG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgQ3Vyc29yQm90dG9tU2VsZWN0OiBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBCb3R0b21Db21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IHRydWUsXG5cdFx0aWQ6ICdjdXJzb3JCb3R0b21TZWxlY3QnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdGtiT3B0czoge1xuXHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRW5kLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Eb3duQXJyb3cgfVxuXHRcdH1cblx0fSkpO1xuXG5cdGV4cG9ydCB0eXBlIEVkaXRvclNjcm9sbENvbW1hbmRPcHRpb25zID0gRWRpdG9yU2Nyb2xsXy5SYXdBcmd1bWVudHMgJiBCYXNlQ29tbWFuZE9wdGlvbnM7XG5cblx0ZXhwb3J0IGNsYXNzIEVkaXRvclNjcm9sbEltcGwgZXh0ZW5kcyBDb3JlRWRpdG9yQ29tbWFuZDxFZGl0b3JTY3JvbGxDb21tYW5kT3B0aW9ucz4ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ2VkaXRvclNjcm9sbCcsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRtZXRhZGF0YTogRWRpdG9yU2Nyb2xsXy5tZXRhZGF0YVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0ZGV0ZXJtaW5lU2Nyb2xsTWV0aG9kKGFyZ3M6IEVkaXRvclNjcm9sbF8uUGFyc2VkQXJndW1lbnRzKSB7XG5cdFx0XHRjb25zdCBob3Jpem9udGFsVW5pdHMgPSBbRWRpdG9yU2Nyb2xsXy5Vbml0LkNvbHVtbl07XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbFVuaXRzID0gW1xuXHRcdFx0XHRFZGl0b3JTY3JvbGxfLlVuaXQuTGluZSxcblx0XHRcdFx0RWRpdG9yU2Nyb2xsXy5Vbml0LldyYXBwZWRMaW5lLFxuXHRcdFx0XHRFZGl0b3JTY3JvbGxfLlVuaXQuUGFnZSxcblx0XHRcdFx0RWRpdG9yU2Nyb2xsXy5Vbml0LkhhbGZQYWdlLFxuXHRcdFx0XHRFZGl0b3JTY3JvbGxfLlVuaXQuRWRpdG9yLFxuXHRcdFx0XHRFZGl0b3JTY3JvbGxfLlVuaXQuQ29sdW1uXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgaG9yaXpvbnRhbERpcmVjdGlvbnMgPSBbRWRpdG9yU2Nyb2xsXy5EaXJlY3Rpb24uTGVmdCwgRWRpdG9yU2Nyb2xsXy5EaXJlY3Rpb24uUmlnaHRdO1xuXHRcdFx0Y29uc3QgdmVydGljYWxEaXJlY3Rpb25zID0gW0VkaXRvclNjcm9sbF8uRGlyZWN0aW9uLlVwLCBFZGl0b3JTY3JvbGxfLkRpcmVjdGlvbi5Eb3duXTtcblxuXHRcdFx0aWYgKGhvcml6b250YWxVbml0cy5pbmNsdWRlcyhhcmdzLnVuaXQpICYmIGhvcml6b250YWxEaXJlY3Rpb25zLmluY2x1ZGVzKGFyZ3MuZGlyZWN0aW9uKSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcnVuSG9yaXpvbnRhbEVkaXRvclNjcm9sbC5iaW5kKHRoaXMpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHZlcnRpY2FsVW5pdHMuaW5jbHVkZXMoYXJncy51bml0KSAmJiB2ZXJ0aWNhbERpcmVjdGlvbnMuaW5jbHVkZXMoYXJncy5kaXJlY3Rpb24pKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9ydW5WZXJ0aWNhbEVkaXRvclNjcm9sbC5iaW5kKHRoaXMpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxFZGl0b3JTY3JvbGxDb21tYW5kT3B0aW9ucz4pOiB2b2lkIHtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IEVkaXRvclNjcm9sbF8ucGFyc2UoYXJncyk7XG5cdFx0XHRpZiAoIXBhcnNlZCkge1xuXHRcdFx0XHQvLyBpbGxlZ2FsIGFyZ3VtZW50c1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBydW5FZGl0b3JTY3JvbGwgPSB0aGlzLmRldGVybWluZVNjcm9sbE1ldGhvZChwYXJzZWQpO1xuXHRcdFx0aWYgKCFydW5FZGl0b3JTY3JvbGwpIHtcblx0XHRcdFx0Ly8gSW5jb21wYXRpYmxlIHVuaXQgYW5kIGRpcmVjdGlvblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRydW5FZGl0b3JTY3JvbGwodmlld01vZGVsLCBhcmdzLnNvdXJjZSwgcGFyc2VkKTtcblx0XHR9XG5cblx0XHRfcnVuVmVydGljYWxFZGl0b3JTY3JvbGwodmlld01vZGVsOiBJVmlld01vZGVsLCBzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGFyZ3M6IEVkaXRvclNjcm9sbF8uUGFyc2VkQXJndW1lbnRzKTogdm9pZCB7XG5cblx0XHRcdGNvbnN0IGRlc2lyZWRTY3JvbGxUb3AgPSB0aGlzLl9jb21wdXRlRGVzaXJlZFNjcm9sbFRvcCh2aWV3TW9kZWwsIGFyZ3MpO1xuXG5cdFx0XHRpZiAoYXJncy5yZXZlYWxDdXJzb3IpIHtcblx0XHRcdFx0Ly8gbXVzdCBlbnN1cmUgY3Vyc29yIGlzIGluIG5ldyB2aXNpYmxlIHJhbmdlXG5cdFx0XHRcdGNvbnN0IGRlc2lyZWRWaXNpYmxlVmlld1JhbmdlID0gdmlld01vZGVsLmdldENvbXBsZXRlbHlWaXNpYmxlVmlld1JhbmdlQXRTY3JvbGxUb3AoZGVzaXJlZFNjcm9sbFRvcCk7XG5cdFx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdFx0c291cmNlLFxuXHRcdFx0XHRcdEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRDdXJzb3JNb3ZlQ29tbWFuZHMuZmluZFBvc2l0aW9uSW5WaWV3cG9ydElmT3V0c2lkZSh2aWV3TW9kZWwsIHZpZXdNb2RlbC5nZXRQcmltYXJ5Q3Vyc29yU3RhdGUoKSwgZGVzaXJlZFZpc2libGVWaWV3UmFuZ2UsIGFyZ3Muc2VsZWN0KVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0KTtcblx0XHRcdH1cblxuXHRcdFx0dmlld01vZGVsLnZpZXdMYXlvdXQuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxUb3A6IGRlc2lyZWRTY3JvbGxUb3AgfSwgU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHRcdH1cblxuXHRcdHByaXZhdGUgX2NvbXB1dGVEZXNpcmVkU2Nyb2xsVG9wKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogRWRpdG9yU2Nyb2xsXy5QYXJzZWRBcmd1bWVudHMpOiBudW1iZXIge1xuXG5cdFx0XHRpZiAoYXJncy51bml0ID09PSBFZGl0b3JTY3JvbGxfLlVuaXQuTGluZSkge1xuXHRcdFx0XHQvLyBzY3JvbGxpbmcgYnkgbW9kZWwgbGluZXNcblx0XHRcdFx0Y29uc3QgZnV0dXJlVmlld3BvcnQgPSB2aWV3TW9kZWwudmlld0xheW91dC5nZXRGdXR1cmVWaWV3cG9ydCgpO1xuXHRcdFx0XHRjb25zdCB2aXNpYmxlVmlld1JhbmdlID0gdmlld01vZGVsLmdldENvbXBsZXRlbHlWaXNpYmxlVmlld1JhbmdlQXRTY3JvbGxUb3AoZnV0dXJlVmlld3BvcnQudG9wKTtcblx0XHRcdFx0Y29uc3QgdmlzaWJsZU1vZGVsUmFuZ2UgPSB2aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydFZpZXdSYW5nZVRvTW9kZWxSYW5nZSh2aXNpYmxlVmlld1JhbmdlKTtcblxuXHRcdFx0XHRsZXQgZGVzaXJlZFRvcE1vZGVsTGluZU51bWJlcjogbnVtYmVyO1xuXHRcdFx0XHRpZiAoYXJncy5kaXJlY3Rpb24gPT09IEVkaXRvclNjcm9sbF8uRGlyZWN0aW9uLlVwKSB7XG5cdFx0XHRcdFx0Ly8gbXVzdCBnbyB4IG1vZGVsIGxpbmVzIHVwXG5cdFx0XHRcdFx0ZGVzaXJlZFRvcE1vZGVsTGluZU51bWJlciA9IE1hdGgubWF4KDEsIHZpc2libGVNb2RlbFJhbmdlLnN0YXJ0TGluZU51bWJlciAtIGFyZ3MudmFsdWUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIG11c3QgZ28geCBtb2RlbCBsaW5lcyBkb3duXG5cdFx0XHRcdFx0ZGVzaXJlZFRvcE1vZGVsTGluZU51bWJlciA9IE1hdGgubWluKHZpZXdNb2RlbC5tb2RlbC5nZXRMaW5lQ291bnQoKSwgdmlzaWJsZU1vZGVsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICsgYXJncy52YWx1ZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB2aWV3UG9zaXRpb24gPSB2aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihuZXcgUG9zaXRpb24oZGVzaXJlZFRvcE1vZGVsTGluZU51bWJlciwgMSkpO1xuXHRcdFx0XHRyZXR1cm4gdmlld01vZGVsLnZpZXdMYXlvdXQuZ2V0VmVydGljYWxPZmZzZXRGb3JMaW5lTnVtYmVyKHZpZXdQb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFyZ3MudW5pdCA9PT0gRWRpdG9yU2Nyb2xsXy5Vbml0LkVkaXRvcikge1xuXHRcdFx0XHRsZXQgZGVzaXJlZFRvcE1vZGVsTGluZU51bWJlciA9IDA7XG5cdFx0XHRcdGlmIChhcmdzLmRpcmVjdGlvbiA9PT0gRWRpdG9yU2Nyb2xsXy5EaXJlY3Rpb24uRG93bikge1xuXHRcdFx0XHRcdGRlc2lyZWRUb3BNb2RlbExpbmVOdW1iZXIgPSB2aWV3TW9kZWwubW9kZWwuZ2V0TGluZUNvdW50KCkgLSB2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLnBhZ2VTaXplO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB2aWV3TW9kZWwudmlld0xheW91dC5nZXRWZXJ0aWNhbE9mZnNldEZvckxpbmVOdW1iZXIoZGVzaXJlZFRvcE1vZGVsTGluZU51bWJlcik7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBub09mTGluZXM6IG51bWJlcjtcblx0XHRcdGlmIChhcmdzLnVuaXQgPT09IEVkaXRvclNjcm9sbF8uVW5pdC5QYWdlKSB7XG5cdFx0XHRcdG5vT2ZMaW5lcyA9IHZpZXdNb2RlbC5jdXJzb3JDb25maWcucGFnZVNpemUgKiBhcmdzLnZhbHVlO1xuXHRcdFx0fSBlbHNlIGlmIChhcmdzLnVuaXQgPT09IEVkaXRvclNjcm9sbF8uVW5pdC5IYWxmUGFnZSkge1xuXHRcdFx0XHRub09mTGluZXMgPSBNYXRoLnJvdW5kKHZpZXdNb2RlbC5jdXJzb3JDb25maWcucGFnZVNpemUgLyAyKSAqIGFyZ3MudmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRub09mTGluZXMgPSBhcmdzLnZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGVsdGFMaW5lcyA9IChhcmdzLmRpcmVjdGlvbiA9PT0gRWRpdG9yU2Nyb2xsXy5EaXJlY3Rpb24uVXAgPyAtMSA6IDEpICogbm9PZkxpbmVzO1xuXHRcdFx0cmV0dXJuIHZpZXdNb2RlbC52aWV3TGF5b3V0LmdldEN1cnJlbnRTY3JvbGxUb3AoKSArIGRlbHRhTGluZXMgKiB2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLmxpbmVIZWlnaHQ7XG5cdFx0fVxuXG5cdFx0X3J1bkhvcml6b250YWxFZGl0b3JTY3JvbGwodmlld01vZGVsOiBJVmlld01vZGVsLCBzb3VyY2U6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIGFyZ3M6IEVkaXRvclNjcm9sbF8uUGFyc2VkQXJndW1lbnRzKTogdm9pZCB7XG5cdFx0XHRjb25zdCBkZXNpcmVkU2Nyb2xsTGVmdCA9IHRoaXMuX2NvbXB1dGVEZXNpcmVkU2Nyb2xsTGVmdCh2aWV3TW9kZWwsIGFyZ3MpO1xuXHRcdFx0dmlld01vZGVsLnZpZXdMYXlvdXQuc2V0U2Nyb2xsUG9zaXRpb24oeyBzY3JvbGxMZWZ0OiBkZXNpcmVkU2Nyb2xsTGVmdCB9LCBTY3JvbGxUeXBlLlNtb290aCk7XG5cdFx0fVxuXG5cdFx0X2NvbXB1dGVEZXNpcmVkU2Nyb2xsTGVmdCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IEVkaXRvclNjcm9sbF8uUGFyc2VkQXJndW1lbnRzKSB7XG5cdFx0XHRjb25zdCBkZWx0YUNvbHVtbnMgPSAoYXJncy5kaXJlY3Rpb24gPT09IEVkaXRvclNjcm9sbF8uRGlyZWN0aW9uLkxlZnQgPyAtMSA6IDEpICogYXJncy52YWx1ZTtcblx0XHRcdHJldHVybiB2aWV3TW9kZWwudmlld0xheW91dC5nZXRDdXJyZW50U2Nyb2xsTGVmdCgpICsgZGVsdGFDb2x1bW5zICogdmlld01vZGVsLmN1cnNvckNvbmZpZy50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGg7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IEVkaXRvclNjcm9sbDogRWRpdG9yU2Nyb2xsSW1wbCA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgRWRpdG9yU2Nyb2xsSW1wbCgpKTtcblxuXHRleHBvcnQgY29uc3QgU2Nyb2xsTGluZVVwOiBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBjbGFzcyBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3Njcm9sbExpbmVVcCcsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlVwQXJyb3csXG5cdFx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5QYWdlVXAgfVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8QmFzZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0RWRpdG9yU2Nyb2xsLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge1xuXHRcdFx0XHR0bzogRWRpdG9yU2Nyb2xsXy5SYXdEaXJlY3Rpb24uVXAsXG5cdFx0XHRcdGJ5OiBFZGl0b3JTY3JvbGxfLlJhd1VuaXQuV3JhcHBlZExpbmUsXG5cdFx0XHRcdHZhbHVlOiAxLFxuXHRcdFx0XHRyZXZlYWxDdXJzb3I6IGZhbHNlLFxuXHRcdFx0XHRzZWxlY3Q6IGZhbHNlLFxuXHRcdFx0XHRzb3VyY2U6IGFyZ3Muc291cmNlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBTY3JvbGxQYWdlVXA6IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnc2Nyb2xsUGFnZVVwJyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuUGFnZVVwLFxuXHRcdFx0XHRcdHdpbjogeyBwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5QYWdlVXAgfSxcblx0XHRcdFx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5QYWdlVXAgfVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8QmFzZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0RWRpdG9yU2Nyb2xsLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge1xuXHRcdFx0XHR0bzogRWRpdG9yU2Nyb2xsXy5SYXdEaXJlY3Rpb24uVXAsXG5cdFx0XHRcdGJ5OiBFZGl0b3JTY3JvbGxfLlJhd1VuaXQuUGFnZSxcblx0XHRcdFx0dmFsdWU6IDEsXG5cdFx0XHRcdHJldmVhbEN1cnNvcjogZmFsc2UsXG5cdFx0XHRcdHNlbGVjdDogZmFsc2UsXG5cdFx0XHRcdHNvdXJjZTogYXJncy5zb3VyY2Vcblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG5cblx0ZXhwb3J0IGNvbnN0IFNjcm9sbEVkaXRvclRvcDogQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgY2xhc3MgZXh0ZW5kcyBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+IHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICdzY3JvbGxFZGl0b3JUb3AnLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8QmFzZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0RWRpdG9yU2Nyb2xsLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge1xuXHRcdFx0XHR0bzogRWRpdG9yU2Nyb2xsXy5SYXdEaXJlY3Rpb24uVXAsXG5cdFx0XHRcdGJ5OiBFZGl0b3JTY3JvbGxfLlJhd1VuaXQuRWRpdG9yLFxuXHRcdFx0XHR2YWx1ZTogMSxcblx0XHRcdFx0cmV2ZWFsQ3Vyc29yOiBmYWxzZSxcblx0XHRcdFx0c2VsZWN0OiBmYWxzZSxcblx0XHRcdFx0c291cmNlOiBhcmdzLnNvdXJjZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRleHBvcnQgY29uc3QgU2Nyb2xsTGluZURvd246IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnc2Nyb2xsTGluZURvd24nLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5QYWdlRG93biB9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxCYXNlQ29tbWFuZE9wdGlvbnM+KTogdm9pZCB7XG5cdFx0XHRFZGl0b3JTY3JvbGwucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7XG5cdFx0XHRcdHRvOiBFZGl0b3JTY3JvbGxfLlJhd0RpcmVjdGlvbi5Eb3duLFxuXHRcdFx0XHRieTogRWRpdG9yU2Nyb2xsXy5SYXdVbml0LldyYXBwZWRMaW5lLFxuXHRcdFx0XHR2YWx1ZTogMSxcblx0XHRcdFx0cmV2ZWFsQ3Vyc29yOiBmYWxzZSxcblx0XHRcdFx0c2VsZWN0OiBmYWxzZSxcblx0XHRcdFx0c291cmNlOiBhcmdzLnNvdXJjZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRleHBvcnQgY29uc3QgU2Nyb2xsUGFnZURvd246IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnc2Nyb2xsUGFnZURvd24nLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5QYWdlRG93bixcblx0XHRcdFx0XHR3aW46IHsgcHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuUGFnZURvd24gfSxcblx0XHRcdFx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5QYWdlRG93biB9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxCYXNlQ29tbWFuZE9wdGlvbnM+KTogdm9pZCB7XG5cdFx0XHRFZGl0b3JTY3JvbGwucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCB7XG5cdFx0XHRcdHRvOiBFZGl0b3JTY3JvbGxfLlJhd0RpcmVjdGlvbi5Eb3duLFxuXHRcdFx0XHRieTogRWRpdG9yU2Nyb2xsXy5SYXdVbml0LlBhZ2UsXG5cdFx0XHRcdHZhbHVlOiAxLFxuXHRcdFx0XHRyZXZlYWxDdXJzb3I6IGZhbHNlLFxuXHRcdFx0XHRzZWxlY3Q6IGZhbHNlLFxuXHRcdFx0XHRzb3VyY2U6IGFyZ3Muc291cmNlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBTY3JvbGxFZGl0b3JCb3R0b206IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnc2Nyb2xsRWRpdG9yQm90dG9tJyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiBQYXJ0aWFsPEJhc2VDb21tYW5kT3B0aW9ucz4pOiB2b2lkIHtcblx0XHRcdEVkaXRvclNjcm9sbC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHtcblx0XHRcdFx0dG86IEVkaXRvclNjcm9sbF8uUmF3RGlyZWN0aW9uLkRvd24sXG5cdFx0XHRcdGJ5OiBFZGl0b3JTY3JvbGxfLlJhd1VuaXQuRWRpdG9yLFxuXHRcdFx0XHR2YWx1ZTogMSxcblx0XHRcdFx0cmV2ZWFsQ3Vyc29yOiBmYWxzZSxcblx0XHRcdFx0c2VsZWN0OiBmYWxzZSxcblx0XHRcdFx0c291cmNlOiBhcmdzLnNvdXJjZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRleHBvcnQgY29uc3QgU2Nyb2xsTGVmdDogQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgY2xhc3MgZXh0ZW5kcyBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+IHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICdzY3JvbGxMZWZ0Jyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiBQYXJ0aWFsPEJhc2VDb21tYW5kT3B0aW9ucz4pOiB2b2lkIHtcblx0XHRcdEVkaXRvclNjcm9sbC5ydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWwsIHtcblx0XHRcdFx0dG86IEVkaXRvclNjcm9sbF8uUmF3RGlyZWN0aW9uLkxlZnQsXG5cdFx0XHRcdGJ5OiBFZGl0b3JTY3JvbGxfLlJhd1VuaXQuQ29sdW1uLFxuXHRcdFx0XHR2YWx1ZTogMixcblx0XHRcdFx0cmV2ZWFsQ3Vyc29yOiBmYWxzZSxcblx0XHRcdFx0c2VsZWN0OiBmYWxzZSxcblx0XHRcdFx0c291cmNlOiBhcmdzLnNvdXJjZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRleHBvcnQgY29uc3QgU2Nyb2xsUmlnaHQ6IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnc2Nyb2xsUmlnaHQnLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8QmFzZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0RWRpdG9yU2Nyb2xsLnJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbCwge1xuXHRcdFx0XHR0bzogRWRpdG9yU2Nyb2xsXy5SYXdEaXJlY3Rpb24uUmlnaHQsXG5cdFx0XHRcdGJ5OiBFZGl0b3JTY3JvbGxfLlJhd1VuaXQuQ29sdW1uLFxuXHRcdFx0XHR2YWx1ZTogMixcblx0XHRcdFx0cmV2ZWFsQ3Vyc29yOiBmYWxzZSxcblx0XHRcdFx0c2VsZWN0OiBmYWxzZSxcblx0XHRcdFx0c291cmNlOiBhcmdzLnNvdXJjZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRjbGFzcyBXb3JkQ29tbWFuZCBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPE1vdmVDb21tYW5kT3B0aW9ucz4ge1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuO1xuXG5cdFx0Y29uc3RydWN0b3Iob3B0czogSUNvbW1hbmRPcHRpb25zICYgeyBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4gfSkge1xuXHRcdFx0c3VwZXIob3B0cyk7XG5cdFx0XHR0aGlzLl9pblNlbGVjdGlvbk1vZGUgPSBvcHRzLmluU2VsZWN0aW9uTW9kZTtcblx0XHR9XG5cblx0XHRwdWJsaWMgcnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiBQYXJ0aWFsPE1vdmVDb21tYW5kT3B0aW9ucz4pOiB2b2lkIHtcblx0XHRcdGlmICghYXJncy5wb3NpdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdFx0dmlld01vZGVsLnNldEN1cnNvclN0YXRlcyhcblx0XHRcdFx0YXJncy5zb3VyY2UsXG5cdFx0XHRcdEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdEN1cnNvck1vdmVDb21tYW5kcy53b3JkKHZpZXdNb2RlbCwgdmlld01vZGVsLmdldFByaW1hcnlDdXJzb3JTdGF0ZSgpLCB0aGlzLl9pblNlbGVjdGlvbk1vZGUsIGFyZ3MucG9zaXRpb24pXG5cdFx0XHRcdF1cblx0XHRcdCk7XG5cdFx0XHRpZiAoYXJncy5yZXZlYWxUeXBlICE9PSBOYXZpZ2F0aW9uQ29tbWFuZFJldmVhbFR5cGUuTm9uZSkge1xuXHRcdFx0XHR2aWV3TW9kZWwucmV2ZWFsQWxsQ3Vyc29ycyhhcmdzLnNvdXJjZSwgdHJ1ZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IFdvcmRTZWxlY3Q6IENvcmVFZGl0b3JDb21tYW5kPE1vdmVDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFdvcmRDb21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdGlkOiAnX3dvcmRTZWxlY3QnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgV29yZFNlbGVjdERyYWc6IENvcmVFZGl0b3JDb21tYW5kPE1vdmVDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IFdvcmRDb21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IHRydWUsXG5cdFx0aWQ6ICdfd29yZFNlbGVjdERyYWcnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgTGFzdEN1cnNvcldvcmRTZWxlY3Q6IENvcmVFZGl0b3JDb21tYW5kPE1vdmVDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8TW92ZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnbGFzdEN1cnNvcldvcmRTZWxlY3QnLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxNb3ZlQ29tbWFuZE9wdGlvbnM+KTogdm9pZCB7XG5cdFx0XHRpZiAoIWFyZ3MucG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGFzdEFkZGVkQ3Vyc29ySW5kZXggPSB2aWV3TW9kZWwuZ2V0TGFzdEFkZGVkQ3Vyc29ySW5kZXgoKTtcblxuXHRcdFx0Y29uc3Qgc3RhdGVzID0gdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpO1xuXHRcdFx0Y29uc3QgbmV3U3RhdGVzOiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSA9IHN0YXRlcy5zbGljZSgwKTtcblx0XHRcdGNvbnN0IGxhc3RBZGRlZFN0YXRlID0gc3RhdGVzW2xhc3RBZGRlZEN1cnNvckluZGV4XTtcblx0XHRcdG5ld1N0YXRlc1tsYXN0QWRkZWRDdXJzb3JJbmRleF0gPSBDdXJzb3JNb3ZlQ29tbWFuZHMud29yZCh2aWV3TW9kZWwsIGxhc3RBZGRlZFN0YXRlLCBsYXN0QWRkZWRTdGF0ZS5tb2RlbFN0YXRlLmhhc1NlbGVjdGlvbigpLCBhcmdzLnBvc2l0aW9uKTtcblxuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdGFyZ3Muc291cmNlLFxuXHRcdFx0XHRDdXJzb3JDaGFuZ2VSZWFzb24uRXhwbGljaXQsXG5cdFx0XHRcdG5ld1N0YXRlc1xuXHRcdFx0KTtcblx0XHR9XG5cdH0pO1xuXG5cdGNsYXNzIExpbmVDb21tYW5kIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8TW92ZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuO1xuXG5cdFx0Y29uc3RydWN0b3Iob3B0czogSUNvbW1hbmRPcHRpb25zICYgeyBpblNlbGVjdGlvbk1vZGU6IGJvb2xlYW4gfSkge1xuXHRcdFx0c3VwZXIob3B0cyk7XG5cdFx0XHR0aGlzLl9pblNlbGVjdGlvbk1vZGUgPSBvcHRzLmluU2VsZWN0aW9uTW9kZTtcblx0XHR9XG5cblx0XHRwdWJsaWMgcnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiBQYXJ0aWFsPE1vdmVDb21tYW5kT3B0aW9ucz4pOiB2b2lkIHtcblx0XHRcdGlmICghYXJncy5wb3NpdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdFx0dmlld01vZGVsLnNldEN1cnNvclN0YXRlcyhcblx0XHRcdFx0YXJncy5zb3VyY2UsXG5cdFx0XHRcdEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdEN1cnNvck1vdmVDb21tYW5kcy5saW5lKHZpZXdNb2RlbCwgdmlld01vZGVsLmdldFByaW1hcnlDdXJzb3JTdGF0ZSgpLCB0aGlzLl9pblNlbGVjdGlvbk1vZGUsIGFyZ3MucG9zaXRpb24sIGFyZ3Mudmlld1Bvc2l0aW9uKVxuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGFyZ3MucmV2ZWFsVHlwZSAhPT0gTmF2aWdhdGlvbkNvbW1hbmRSZXZlYWxUeXBlLk5vbmUpIHtcblx0XHRcdFx0dmlld01vZGVsLnJldmVhbEFsbEN1cnNvcnMoYXJncy5zb3VyY2UsIGZhbHNlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRleHBvcnQgY29uc3QgTGluZVNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8TW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgTGluZUNvbW1hbmQoe1xuXHRcdGluU2VsZWN0aW9uTW9kZTogZmFsc2UsXG5cdFx0aWQ6ICdfbGluZVNlbGVjdCcsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0fSkpO1xuXG5cdGV4cG9ydCBjb25zdCBMaW5lU2VsZWN0RHJhZzogQ29yZUVkaXRvckNvbW1hbmQ8TW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgTGluZUNvbW1hbmQoe1xuXHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRpZDogJ19saW5lU2VsZWN0RHJhZycsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0fSkpO1xuXG5cdGNsYXNzIExhc3RDdXJzb3JMaW5lQ29tbWFuZCBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPE1vdmVDb21tYW5kT3B0aW9ucz4ge1xuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2luU2VsZWN0aW9uTW9kZTogYm9vbGVhbjtcblxuXHRcdGNvbnN0cnVjdG9yKG9wdHM6IElDb21tYW5kT3B0aW9ucyAmIHsgaW5TZWxlY3Rpb25Nb2RlOiBib29sZWFuIH0pIHtcblx0XHRcdHN1cGVyKG9wdHMpO1xuXHRcdFx0dGhpcy5faW5TZWxlY3Rpb25Nb2RlID0gb3B0cy5pblNlbGVjdGlvbk1vZGU7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxNb3ZlQ29tbWFuZE9wdGlvbnM+KTogdm9pZCB7XG5cdFx0XHRpZiAoIWFyZ3MucG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGFzdEFkZGVkQ3Vyc29ySW5kZXggPSB2aWV3TW9kZWwuZ2V0TGFzdEFkZGVkQ3Vyc29ySW5kZXgoKTtcblxuXHRcdFx0Y29uc3Qgc3RhdGVzID0gdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpO1xuXHRcdFx0Y29uc3QgbmV3U3RhdGVzOiBQYXJ0aWFsQ3Vyc29yU3RhdGVbXSA9IHN0YXRlcy5zbGljZSgwKTtcblx0XHRcdG5ld1N0YXRlc1tsYXN0QWRkZWRDdXJzb3JJbmRleF0gPSBDdXJzb3JNb3ZlQ29tbWFuZHMubGluZSh2aWV3TW9kZWwsIHN0YXRlc1tsYXN0QWRkZWRDdXJzb3JJbmRleF0sIHRoaXMuX2luU2VsZWN0aW9uTW9kZSwgYXJncy5wb3NpdGlvbiwgYXJncy52aWV3UG9zaXRpb24pO1xuXG5cdFx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdFx0dmlld01vZGVsLnNldEN1cnNvclN0YXRlcyhcblx0XHRcdFx0YXJncy5zb3VyY2UsXG5cdFx0XHRcdEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCxcblx0XHRcdFx0bmV3U3RhdGVzXG5cdFx0XHQpO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBjb25zdCBMYXN0Q3Vyc29yTGluZVNlbGVjdDogQ29yZUVkaXRvckNvbW1hbmQ8TW92ZUNvbW1hbmRPcHRpb25zPiA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgTGFzdEN1cnNvckxpbmVDb21tYW5kKHtcblx0XHRpblNlbGVjdGlvbk1vZGU6IGZhbHNlLFxuXHRcdGlkOiAnbGFzdEN1cnNvckxpbmVTZWxlY3QnLFxuXHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkXG5cdH0pKTtcblxuXHRleHBvcnQgY29uc3QgTGFzdEN1cnNvckxpbmVTZWxlY3REcmFnOiBDb3JlRWRpdG9yQ29tbWFuZDxNb3ZlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBMYXN0Q3Vyc29yTGluZUNvbW1hbmQoe1xuXHRcdGluU2VsZWN0aW9uTW9kZTogdHJ1ZSxcblx0XHRpZDogJ2xhc3RDdXJzb3JMaW5lU2VsZWN0RHJhZycsXG5cdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0fSkpO1xuXG5cdGV4cG9ydCBjb25zdCBDYW5jZWxTZWxlY3Rpb246IENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8QmFzZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnY2FuY2VsU2VsZWN0aW9uJyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy5oYXNOb25FbXB0eVNlbGVjdGlvbixcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5TaGlmdCB8IEtleUNvZGUuRXNjYXBlXVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgcnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiBQYXJ0aWFsPEJhc2VDb21tYW5kT3B0aW9ucz4pOiB2b2lkIHtcblx0XHRcdHZpZXdNb2RlbC5tb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHR2aWV3TW9kZWwuc2V0Q3Vyc29yU3RhdGVzKFxuXHRcdFx0XHRhcmdzLnNvdXJjZSxcblx0XHRcdFx0Q3Vyc29yQ2hhbmdlUmVhc29uLkV4cGxpY2l0LFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Q3Vyc29yTW92ZUNvbW1hbmRzLmNhbmNlbFNlbGVjdGlvbih2aWV3TW9kZWwsIHZpZXdNb2RlbC5nZXRQcmltYXJ5Q3Vyc29yU3RhdGUoKSlcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHRcdHZpZXdNb2RlbC5yZXZlYWxBbGxDdXJzb3JzKGFyZ3Muc291cmNlLCB0cnVlKTtcblx0XHR9XG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBSZW1vdmVTZWNvbmRhcnlDdXJzb3JzOiBDb3JlRWRpdG9yQ29tbWFuZDxCYXNlQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBjbGFzcyBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPEJhc2VDb21tYW5kT3B0aW9ucz4ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3JlbW92ZVNlY29uZGFyeUN1cnNvcnMnLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLmhhc011bHRpcGxlU2VsZWN0aW9ucyxcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCArIDEsXG5cdFx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cyxcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVzY2FwZV1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogUGFydGlhbDxCYXNlQ29tbWFuZE9wdGlvbnM+KTogdm9pZCB7XG5cdFx0XHR2aWV3TW9kZWwubW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdFx0dmlld01vZGVsLnNldEN1cnNvclN0YXRlcyhcblx0XHRcdFx0YXJncy5zb3VyY2UsXG5cdFx0XHRcdEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHZpZXdNb2RlbC5nZXRQcmltYXJ5Q3Vyc29yU3RhdGUoKVxuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdFx0dmlld01vZGVsLnJldmVhbEFsbEN1cnNvcnMoYXJncy5zb3VyY2UsIHRydWUpO1xuXHRcdFx0c3RhdHVzKG5scy5sb2NhbGl6ZSgncmVtb3ZlZEN1cnNvcicsIFwiUmVtb3ZlZCBzZWNvbmRhcnkgY3Vyc29yc1wiKSk7XG5cdFx0fVxuXHR9KTtcblxuXHRleHBvcnQgdHlwZSBSZXZlYWxMaW5lQ29tbWFuZE9wdGlvbnMgPSBSZXZlYWxMaW5lXy5SYXdBcmd1bWVudHMgJiBCYXNlQ29tbWFuZE9wdGlvbnM7XG5cblx0ZXhwb3J0IGNvbnN0IFJldmVhbExpbmU6IENvcmVFZGl0b3JDb21tYW5kPFJldmVhbExpbmVDb21tYW5kT3B0aW9ucz4gPSByZWdpc3RlckVkaXRvckNvbW1hbmQobmV3IGNsYXNzIGV4dGVuZHMgQ29yZUVkaXRvckNvbW1hbmQ8UmV2ZWFsTGluZUNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAncmV2ZWFsTGluZScsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRtZXRhZGF0YTogUmV2ZWFsTGluZV8ubWV0YWRhdGFcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8UmV2ZWFsTGluZUNvbW1hbmRPcHRpb25zPik6IHZvaWQge1xuXHRcdFx0Y29uc3QgcmV2ZWFsTGluZUFyZyA9IGFyZ3M7XG5cdFx0XHRjb25zdCBsaW5lTnVtYmVyQXJnID0gcmV2ZWFsTGluZUFyZy5saW5lTnVtYmVyIHx8IDA7XG5cdFx0XHRsZXQgbGluZU51bWJlciA9IHR5cGVvZiBsaW5lTnVtYmVyQXJnID09PSAnbnVtYmVyJyA/IChsaW5lTnVtYmVyQXJnICsgMSkgOiAocGFyc2VJbnQobGluZU51bWJlckFyZykgKyAxKTtcblx0XHRcdGlmIChsaW5lTnVtYmVyIDwgMSkge1xuXHRcdFx0XHRsaW5lTnVtYmVyID0gMTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGxpbmVDb3VudCA9IHZpZXdNb2RlbC5tb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRcdGlmIChsaW5lTnVtYmVyID4gbGluZUNvdW50KSB7XG5cdFx0XHRcdGxpbmVOdW1iZXIgPSBsaW5lQ291bnQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKFxuXHRcdFx0XHRsaW5lTnVtYmVyLCAxLFxuXHRcdFx0XHRsaW5lTnVtYmVyLCB2aWV3TW9kZWwubW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKVxuXHRcdFx0KTtcblxuXHRcdFx0bGV0IHJldmVhbEF0ID0gVmVydGljYWxSZXZlYWxUeXBlLlNpbXBsZTtcblx0XHRcdGlmIChyZXZlYWxMaW5lQXJnLmF0KSB7XG5cdFx0XHRcdHN3aXRjaCAocmV2ZWFsTGluZUFyZy5hdCkge1xuXHRcdFx0XHRcdGNhc2UgUmV2ZWFsTGluZV8uUmF3QXRBcmd1bWVudC5Ub3A6XG5cdFx0XHRcdFx0XHRyZXZlYWxBdCA9IFZlcnRpY2FsUmV2ZWFsVHlwZS5Ub3A7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIFJldmVhbExpbmVfLlJhd0F0QXJndW1lbnQuQ2VudGVyOlxuXHRcdFx0XHRcdFx0cmV2ZWFsQXQgPSBWZXJ0aWNhbFJldmVhbFR5cGUuQ2VudGVyO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSBSZXZlYWxMaW5lXy5SYXdBdEFyZ3VtZW50LkJvdHRvbTpcblx0XHRcdFx0XHRcdHJldmVhbEF0ID0gVmVydGljYWxSZXZlYWxUeXBlLkJvdHRvbTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB2aWV3UmFuZ2UgPSB2aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydE1vZGVsUmFuZ2VUb1ZpZXdSYW5nZShyYW5nZSk7XG5cblx0XHRcdHZpZXdNb2RlbC5yZXZlYWxSYW5nZShhcmdzLnNvdXJjZSwgZmFsc2UsIHZpZXdSYW5nZSwgcmV2ZWFsQXQsIFNjcm9sbFR5cGUuU21vb3RoKTtcblx0XHR9XG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBTZWxlY3RBbGwgPSBuZXcgY2xhc3MgZXh0ZW5kcyBFZGl0b3JPck5hdGl2ZVRleHRJbnB1dENvbW1hbmQge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoU2VsZWN0QWxsQ29tbWFuZCk7XG5cdFx0fVxuXHRcdHB1YmxpYyBydW5ET01Db21tYW5kKGFjdGl2ZUVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHtcblx0XHRcdGlmIChpc0ZpcmVmb3gpIHtcblx0XHRcdFx0KDxIVE1MSW5wdXRFbGVtZW50PmFjdGl2ZUVsZW1lbnQpLmZvY3VzKCk7XG5cdFx0XHRcdCg8SFRNTElucHV0RWxlbWVudD5hY3RpdmVFbGVtZW50KS5zZWxlY3QoKTtcblx0XHRcdH1cblxuXHRcdFx0YWN0aXZlRWxlbWVudC5vd25lckRvY3VtZW50LmV4ZWNDb21tYW5kKCdzZWxlY3RBbGwnKTtcblx0XHR9XG5cdFx0cHVibGljIHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IHVua25vd24pOiB2b2lkIHtcblx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IGVkaXRvci5fZ2V0Vmlld01vZGVsKCk7XG5cdFx0XHRpZiAoIXZpZXdNb2RlbCkge1xuXHRcdFx0XHQvLyB0aGUgZWRpdG9yIGhhcyBubyB2aWV3ID0+IGhhcyBubyBjdXJzb3JzXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMucnVuQ29yZUVkaXRvckNvbW1hbmQodmlld01vZGVsLCBhcmdzKTtcblx0XHR9XG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0b3JDb21tYW5kKHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogdW5rbm93bik6IHZvaWQge1xuXHRcdFx0dmlld01vZGVsLm1vZGVsLnB1c2hTdGFja0VsZW1lbnQoKTtcblx0XHRcdHZpZXdNb2RlbC5zZXRDdXJzb3JTdGF0ZXMoXG5cdFx0XHRcdCdrZXlib2FyZCcsXG5cdFx0XHRcdEN1cnNvckNoYW5nZVJlYXNvbi5FeHBsaWNpdCxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdEN1cnNvck1vdmVDb21tYW5kcy5zZWxlY3RBbGwodmlld01vZGVsLCB2aWV3TW9kZWwuZ2V0UHJpbWFyeUN1cnNvclN0YXRlKCkpXG5cdFx0XHRcdF1cblx0XHRcdCk7XG5cdFx0fVxuXHR9KCk7XG5cblx0ZXhwb3J0IGludGVyZmFjZSBTZXRTZWxlY3Rpb25Db21tYW5kT3B0aW9ucyBleHRlbmRzIEJhc2VDb21tYW5kT3B0aW9ucyB7XG5cdFx0c2VsZWN0aW9uOiBJU2VsZWN0aW9uO1xuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IFNldFNlbGVjdGlvbjogQ29yZUVkaXRvckNvbW1hbmQ8U2V0U2VsZWN0aW9uQ29tbWFuZE9wdGlvbnM+ID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBjbGFzcyBleHRlbmRzIENvcmVFZGl0b3JDb21tYW5kPFNldFNlbGVjdGlvbkNvbW1hbmRPcHRpb25zPiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnc2V0U2VsZWN0aW9uJyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdG9yQ29tbWFuZCh2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IFBhcnRpYWw8U2V0U2VsZWN0aW9uQ29tbWFuZE9wdGlvbnM+KTogdm9pZCB7XG5cdFx0XHRpZiAoIWFyZ3Muc2VsZWN0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZpZXdNb2RlbC5tb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHR2aWV3TW9kZWwuc2V0Q3Vyc29yU3RhdGVzKFxuXHRcdFx0XHRhcmdzLnNvdXJjZSxcblx0XHRcdFx0Q3Vyc29yQ2hhbmdlUmVhc29uLkV4cGxpY2l0LFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Q3Vyc29yU3RhdGUuZnJvbU1vZGVsU2VsZWN0aW9uKGFyZ3Muc2VsZWN0aW9uKVxuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdH1cblx0fSk7XG59XG5cbmNvbnN0IGNvbHVtblNlbGVjdGlvbkNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChcblx0RWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdEVkaXRvckNvbnRleHRLZXlzLmNvbHVtblNlbGVjdGlvblxuKTtcbmZ1bmN0aW9uIHJlZ2lzdGVyQ29sdW1uU2VsZWN0aW9uKGlkOiBzdHJpbmcsIGtleWJpbmRpbmc6IG51bWJlcik6IHZvaWQge1xuXHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyS2V5YmluZGluZ1J1bGUoe1xuXHRcdGlkOiBpZCxcblx0XHRwcmltYXJ5OiBrZXliaW5kaW5nLFxuXHRcdHdoZW46IGNvbHVtblNlbGVjdGlvbkNvbmRpdGlvbixcblx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hUICsgMVxuXHR9KTtcbn1cblxucmVnaXN0ZXJDb2x1bW5TZWxlY3Rpb24oQ29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RMZWZ0LmlkLCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkxlZnRBcnJvdyk7XG5yZWdpc3RlckNvbHVtblNlbGVjdGlvbihDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdFJpZ2h0LmlkLCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlJpZ2h0QXJyb3cpO1xucmVnaXN0ZXJDb2x1bW5TZWxlY3Rpb24oQ29yZU5hdmlnYXRpb25Db21tYW5kcy5DdXJzb3JDb2x1bW5TZWxlY3RVcC5pZCwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5VcEFycm93KTtcbnJlZ2lzdGVyQ29sdW1uU2VsZWN0aW9uKENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UGFnZVVwLmlkLCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlBhZ2VVcCk7XG5yZWdpc3RlckNvbHVtblNlbGVjdGlvbihDb3JlTmF2aWdhdGlvbkNvbW1hbmRzLkN1cnNvckNvbHVtblNlbGVjdERvd24uaWQsIEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRG93bkFycm93KTtcbnJlZ2lzdGVyQ29sdW1uU2VsZWN0aW9uKENvcmVOYXZpZ2F0aW9uQ29tbWFuZHMuQ3Vyc29yQ29sdW1uU2VsZWN0UGFnZURvd24uaWQsIEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUGFnZURvd24pO1xuXG5mdW5jdGlvbiByZWdpc3RlckNvbW1hbmQ8VCBleHRlbmRzIENvbW1hbmQ+KGNvbW1hbmQ6IFQpOiBUIHtcblx0Y29tbWFuZC5yZWdpc3RlcigpO1xuXHRyZXR1cm4gY29tbWFuZDtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDb3JlRWRpdGluZ0NvbW1hbmRzIHtcblxuXHRleHBvcnQgYWJzdHJhY3QgY2xhc3MgQ29yZUVkaXRpbmdDb21tYW5kIGV4dGVuZHMgRWRpdG9yQ29tbWFuZCB7XG5cdFx0cHVibGljIHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IHVua25vd24pOiB2b2lkIHtcblx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IGVkaXRvci5fZ2V0Vmlld01vZGVsKCk7XG5cdFx0XHRpZiAoIXZpZXdNb2RlbCkge1xuXHRcdFx0XHQvLyB0aGUgZWRpdG9yIGhhcyBubyB2aWV3ID0+IGhhcyBubyBjdXJzb3JzXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMucnVuQ29yZUVkaXRpbmdDb21tYW5kKGVkaXRvciwgdmlld01vZGVsLCBhcmdzIHx8IHt9KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgYWJzdHJhY3QgcnVuQ29yZUVkaXRpbmdDb21tYW5kKGVkaXRvcjogSUNvZGVFZGl0b3IsIHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogdW5rbm93bik6IHZvaWQ7XG5cdH1cblxuXHRleHBvcnQgY29uc3QgTGluZUJyZWFrSW5zZXJ0OiBFZGl0b3JDb21tYW5kID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBjbGFzcyBleHRlbmRzIENvcmVFZGl0aW5nQ29tbWFuZCB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnbGluZUJyZWFrSW5zZXJ0Jyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSxcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRcdHByaW1hcnk6IDAsXG5cdFx0XHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlPIH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0aW5nQ29tbWFuZChlZGl0b3I6IElDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IHVua25vd24pOiB2b2lkIHtcblx0XHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgRW50ZXJPcGVyYXRpb24ubGluZUJyZWFrSW5zZXJ0KHZpZXdNb2RlbC5jdXJzb3JDb25maWcsIHZpZXdNb2RlbC5tb2RlbCwgdmlld01vZGVsLmdldEN1cnNvclN0YXRlcygpLm1hcChzID0+IHMubW9kZWxTdGF0ZS5zZWxlY3Rpb24pKSk7XG5cdFx0fVxuXHR9KTtcblxuXHRleHBvcnQgY29uc3QgT3V0ZGVudDogRWRpdG9yQ29tbWFuZCA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgY2xhc3MgZXh0ZW5kcyBDb3JlRWRpdGluZ0NvbW1hbmQge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ291dGRlbnQnLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0XHRcdGtiRXhwcjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuZWRpdG9yVGV4dEZvY3VzLFxuXHRcdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMudGFiRG9lc05vdE1vdmVGb2N1c1xuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5UYWJcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0aW5nQ29tbWFuZChlZGl0b3I6IElDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IHVua25vd24pOiB2b2lkIHtcblx0XHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgVHlwZU9wZXJhdGlvbnMub3V0ZGVudCh2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCB2aWV3TW9kZWwubW9kZWwsIHZpZXdNb2RlbC5nZXRDdXJzb3JTdGF0ZXMoKS5tYXAocyA9PiBzLm1vZGVsU3RhdGUuc2VsZWN0aW9uKSkpO1xuXHRcdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdH1cblx0fSk7XG5cblx0ZXhwb3J0IGNvbnN0IFRhYjogRWRpdG9yQ29tbWFuZCA9IHJlZ2lzdGVyRWRpdG9yQ29tbWFuZChuZXcgY2xhc3MgZXh0ZW5kcyBDb3JlRWRpdGluZ0NvbW1hbmQge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3RhYicsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRcdHdlaWdodDogQ09SRV9XRUlHSFQsXG5cdFx0XHRcdFx0a2JFeHByOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5lZGl0b3JUZXh0Rm9jdXMsXG5cdFx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy50YWJEb2VzTm90TW92ZUZvY3VzXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLlRhYlxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwdWJsaWMgcnVuQ29yZUVkaXRpbmdDb21tYW5kKGVkaXRvcjogSUNvZGVFZGl0b3IsIHZpZXdNb2RlbDogSVZpZXdNb2RlbCwgYXJnczogdW5rbm93bik6IHZvaWQge1xuXHRcdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVDb21tYW5kcyh0aGlzLmlkLCBUeXBlT3BlcmF0aW9ucy50YWIodmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLm1vZGVsLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCkubWFwKHMgPT4gcy5tb2RlbFN0YXRlLnNlbGVjdGlvbikpKTtcblx0XHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHR9XG5cdH0pO1xuXG5cdGV4cG9ydCBjb25zdCBEZWxldGVMZWZ0OiBFZGl0b3JDb21tYW5kID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBjbGFzcyBleHRlbmRzIENvcmVFZGl0aW5nQ29tbWFuZCB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnZGVsZXRlTGVmdCcsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0XHR3ZWlnaHQ6IENPUkVfV0VJR0hULFxuXHRcdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsXG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5CYWNrc3BhY2UsXG5cdFx0XHRcdFx0c2Vjb25kYXJ5OiBbS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CYWNrc3BhY2VdLFxuXHRcdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkJhY2tzcGFjZSwgc2Vjb25kYXJ5OiBbS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5CYWNrc3BhY2UsIEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlILCBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuQmFja3NwYWNlXSB9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHB1YmxpYyBydW5Db3JlRWRpdGluZ0NvbW1hbmQoZWRpdG9yOiBJQ29kZUVkaXRvciwgdmlld01vZGVsOiBJVmlld01vZGVsLCBhcmdzOiB1bmtub3duKTogdm9pZCB7XG5cdFx0XHRjb25zdCBbc2hvdWxkUHVzaFN0YWNrRWxlbWVudEJlZm9yZSwgY29tbWFuZHNdID0gRGVsZXRlT3BlcmF0aW9ucy5kZWxldGVMZWZ0KHZpZXdNb2RlbC5nZXRQcmV2RWRpdE9wZXJhdGlvblR5cGUoKSwgdmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLm1vZGVsLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCkubWFwKHMgPT4gcy5tb2RlbFN0YXRlLnNlbGVjdGlvbiksIHZpZXdNb2RlbC5nZXRDdXJzb3JBdXRvQ2xvc2VkQ2hhcmFjdGVycygpKTtcblx0XHRcdGlmIChzaG91bGRQdXNoU3RhY2tFbGVtZW50QmVmb3JlKSB7XG5cdFx0XHRcdGVkaXRvci5wdXNoVW5kb1N0b3AoKTtcblx0XHRcdH1cblx0XHRcdGVkaXRvci5leGVjdXRlQ29tbWFuZHModGhpcy5pZCwgY29tbWFuZHMpO1xuXHRcdFx0dmlld01vZGVsLnNldFByZXZFZGl0T3BlcmF0aW9uVHlwZShFZGl0T3BlcmF0aW9uVHlwZS5EZWxldGluZ0xlZnQpO1xuXHRcdH1cblx0fSk7XG5cblx0ZXhwb3J0IGNvbnN0IERlbGV0ZVJpZ2h0OiBFZGl0b3JDb21tYW5kID0gcmVnaXN0ZXJFZGl0b3JDb21tYW5kKG5ldyBjbGFzcyBleHRlbmRzIENvcmVFZGl0aW5nQ29tbWFuZCB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnZGVsZXRlUmlnaHQnLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdFx0d2VpZ2h0OiBDT1JFX1dFSUdIVCxcblx0XHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLnRleHRJbnB1dEZvY3VzLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRGVsZXRlLFxuXHRcdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlDb2RlLkRlbGV0ZSwgc2Vjb25kYXJ5OiBbS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleUQsIEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5EZWxldGVdIH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJ1bkNvcmVFZGl0aW5nQ29tbWFuZChlZGl0b3I6IElDb2RlRWRpdG9yLCB2aWV3TW9kZWw6IElWaWV3TW9kZWwsIGFyZ3M6IHVua25vd24pOiB2b2lkIHtcblx0XHRcdGNvbnN0IFtzaG91bGRQdXNoU3RhY2tFbGVtZW50QmVmb3JlLCBjb21tYW5kc10gPSBEZWxldGVPcGVyYXRpb25zLmRlbGV0ZVJpZ2h0KHZpZXdNb2RlbC5nZXRQcmV2RWRpdE9wZXJhdGlvblR5cGUoKSwgdmlld01vZGVsLmN1cnNvckNvbmZpZywgdmlld01vZGVsLm1vZGVsLCB2aWV3TW9kZWwuZ2V0Q3Vyc29yU3RhdGVzKCkubWFwKHMgPT4gcy5tb2RlbFN0YXRlLnNlbGVjdGlvbikpO1xuXHRcdFx0aWYgKHNob3VsZFB1c2hTdGFja0VsZW1lbnRCZWZvcmUpIHtcblx0XHRcdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdFx0fVxuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVDb21tYW5kcyh0aGlzLmlkLCBjb21tYW5kcyk7XG5cdFx0XHR2aWV3TW9kZWwuc2V0UHJldkVkaXRPcGVyYXRpb25UeXBlKEVkaXRPcGVyYXRpb25UeXBlLkRlbGV0aW5nUmlnaHQpO1xuXHRcdH1cblx0fSk7XG5cblx0ZXhwb3J0IGNvbnN0IFVuZG8gPSBuZXcgY2xhc3MgZXh0ZW5kcyBFZGl0b3JPck5hdGl2ZVRleHRJbnB1dENvbW1hbmQge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoVW5kb0NvbW1hbmQpO1xuXHRcdH1cblx0XHRwdWJsaWMgcnVuRE9NQ29tbWFuZChhY3RpdmVFbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG5cdFx0XHRhY3RpdmVFbGVtZW50Lm93bmVyRG9jdW1lbnQuZXhlY0NvbW1hbmQoJ3VuZG8nKTtcblx0XHR9XG5cdFx0cHVibGljIHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IgfCBudWxsLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiB1bmtub3duKTogdm9pZCB8IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSB8fCBlZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5yZWFkT25seSkgPT09IHRydWUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGVkaXRvci5nZXRNb2RlbCgpLnVuZG8oKTtcblx0XHR9XG5cdH0oKTtcblxuXHRleHBvcnQgY29uc3QgUmVkbyA9IG5ldyBjbGFzcyBleHRlbmRzIEVkaXRvck9yTmF0aXZlVGV4dElucHV0Q29tbWFuZCB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcihSZWRvQ29tbWFuZCk7XG5cdFx0fVxuXHRcdHB1YmxpYyBydW5ET01Db21tYW5kKGFjdGl2ZUVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHtcblx0XHRcdGFjdGl2ZUVsZW1lbnQub3duZXJEb2N1bWVudC5leGVjQ29tbWFuZCgncmVkbycpO1xuXHRcdH1cblx0XHRwdWJsaWMgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IG51bGwsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IHVua25vd24pOiB2b2lkIHwgUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpIHx8IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnJlYWRPbmx5KSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZWRpdG9yLmdldE1vZGVsKCkucmVkbygpO1xuXHRcdH1cblx0fSgpO1xufVxuXG4vKipcbiAqIEEgY29tbWFuZCB0aGF0IHdpbGwgaW52b2tlIGEgY29tbWFuZCBvbiB0aGUgZm9jdXNlZCBlZGl0b3IuXG4gKi9cbmNsYXNzIEVkaXRvckhhbmRsZXJDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaGFuZGxlcklkOiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZywgaGFuZGxlcklkOiBzdHJpbmcsIG1ldGFkYXRhPzogSUNvbW1hbmRNZXRhZGF0YSkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBpZCxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0bWV0YWRhdGFcblx0XHR9KTtcblx0XHR0aGlzLl9oYW5kbGVySWQgPSBoYW5kbGVySWQ7XG5cdH1cblxuXHRwdWJsaWMgcnVuQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogdW5rbm93bik6IHZvaWQge1xuXHRcdGNvbnN0IGVkaXRvciA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmdldEZvY3VzZWRDb2RlRWRpdG9yKCk7XG5cdFx0aWYgKCFlZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRlZGl0b3IudHJpZ2dlcigna2V5Ym9hcmQnLCB0aGlzLl9oYW5kbGVySWQsIGFyZ3MpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyT3ZlcndyaXRhYmxlQ29tbWFuZChoYW5kbGVySWQ6IHN0cmluZywgbWV0YWRhdGE/OiBJQ29tbWFuZE1ldGFkYXRhKTogdm9pZCB7XG5cdHJlZ2lzdGVyQ29tbWFuZChuZXcgRWRpdG9ySGFuZGxlckNvbW1hbmQoJ2RlZmF1bHQ6JyArIGhhbmRsZXJJZCwgaGFuZGxlcklkKSk7XG5cdHJlZ2lzdGVyQ29tbWFuZChuZXcgRWRpdG9ySGFuZGxlckNvbW1hbmQoaGFuZGxlcklkLCBoYW5kbGVySWQsIG1ldGFkYXRhKSk7XG59XG5cbnJlZ2lzdGVyT3ZlcndyaXRhYmxlQ29tbWFuZChIYW5kbGVyLlR5cGUsIHtcblx0ZGVzY3JpcHRpb246IGBUeXBlYCxcblx0YXJnczogW3tcblx0XHRuYW1lOiAnYXJncycsXG5cdFx0c2NoZW1hOiB7XG5cdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0J3JlcXVpcmVkJzogWyd0ZXh0J10sXG5cdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0J3RleHQnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJ1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdH1cblx0fV1cbn0pO1xucmVnaXN0ZXJPdmVyd3JpdGFibGVDb21tYW5kKEhhbmRsZXIuUmVwbGFjZVByZXZpb3VzQ2hhcik7XG5yZWdpc3Rlck92ZXJ3cml0YWJsZUNvbW1hbmQoSGFuZGxlci5Db21wb3NpdGlvblR5cGUpO1xucmVnaXN0ZXJPdmVyd3JpdGFibGVDb21tYW5kKEhhbmRsZXIuQ29tcG9zaXRpb25TdGFydCk7XG5yZWdpc3Rlck92ZXJ3cml0YWJsZUNvbW1hbmQoSGFuZGxlci5Db21wb3NpdGlvbkVuZCk7XG5yZWdpc3Rlck92ZXJ3cml0YWJsZUNvbW1hbmQoSGFuZGxlci5QYXN0ZSk7XG5yZWdpc3Rlck92ZXJ3cml0YWJsZUNvbW1hbmQoSGFuZGxlci5DdXQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFlBQVksV0FBVztBQUN2QixTQUFTLGNBQWM7QUFFdkIsU0FBUyxTQUFTLGVBQWdDLHVCQUFxQyxhQUFhLGFBQWEsd0JBQXdCO0FBQ3pJLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsdUJBQTRDO0FBQ3JELFNBQVMsYUFBYSx5QkFBZ0U7QUFDdEYsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxjQUFjLGFBQWEsMEJBQTBCO0FBQzlELFNBQVMsc0JBQXNCO0FBQy9CLFNBQW9CLGdCQUFnQjtBQUNwQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxTQUFTLGtCQUFrQjtBQUNwQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLGtCQUFrQiwyQkFBMkI7QUFDdEQsU0FBUyxvQkFBb0I7QUFHN0IsU0FBUyxrQkFBa0IseUJBQXlCO0FBQ3BELFNBQVMsc0JBQXNCO0FBRS9CLE1BQU0sY0FBYyxpQkFBaUI7QUFFOUIsTUFBZSwwQkFBNkIsY0FBYztBQUFBLEVBQ3pELGlCQUFpQixVQUFtQyxRQUFxQixNQUFnQztBQUMvRyxVQUFNLFlBQVksT0FBTyxjQUFjO0FBQ3ZDLFFBQUksQ0FBQyxXQUFXO0FBRWY7QUFBQSxJQUNEO0FBQ0EsU0FBSyxxQkFBcUIsV0FBVyxRQUFRLENBQUMsQ0FBQztBQUFBLEVBQ2hEO0FBR0Q7QUFFTyxJQUFVO0FBQUEsQ0FBVixDQUFVQSxtQkFB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LElBQUksY0FBYywrQkFBK0I7QUFBQSxJQUNwRSxjQUFjO0FBQ2IsWUFBTSxXQUFXO0FBQUEsSUFDbEI7QUFBQSxJQUNPLGNBQWMsZUFBOEI7QUFDbEQsb0JBQWMsY0FBYyxZQUFZLE1BQU07QUFBQSxJQUMvQztBQUFBLElBQ08saUJBQWlCLFVBQW1DLFFBQXFCLE1BQXFDO0FBQ3BILFVBQUksQ0FBQyxPQUFPLFNBQVMsS0FBSyxPQUFPLFVBQVUsYUFBYSxRQUFRLE1BQU0sTUFBTTtBQUMzRTtBQUFBLE1BQ0Q7QUFDQSxhQUFPLE9BQU8sU0FBUyxFQUFFLEtBQUs7QUFBQSxJQUMvQjtBQUFBLEVBQ0QsRUFBRTtBQUFBLEdBOUpjO0FBb0tqQixNQUFNLDZCQUE2QixRQUFRO0FBQUEsRUFJMUMsWUFBWSxJQUFZLFdBQW1CLFVBQTZCO0FBQ3ZFLFVBQU07QUFBQSxNQUNMO0FBQUEsTUFDQSxjQUFjO0FBQUEsTUFDZDtBQUFBLElBQ0QsQ0FBQztBQUNELFNBQUssYUFBYTtBQUFBLEVBQ25CO0FBQUEsRUFFTyxXQUFXLFVBQTRCLE1BQXFCO0FBQ2xFLFVBQU0sU0FBUyxTQUFTLElBQUksa0JBQWtCLEVBQUUscUJBQXFCO0FBQ3JFLFFBQUksQ0FBQyxRQUFRO0FBQ1o7QUFBQSxJQUNEO0FBRUEsV0FBTyxRQUFRLFlBQVksS0FBSyxZQUFZLElBQUk7QUFBQSxFQUNqRDtBQUNEO0FBRUEsU0FBUyw0QkFBNEIsV0FBbUIsVUFBbUM7QUFDMUYsa0JBQWdCLElBQUkscUJBQXFCLGFBQWEsV0FBVyxTQUFTLENBQUM7QUFDM0Usa0JBQWdCLElBQUkscUJBQXFCLFdBQVcsV0FBVyxRQUFRLENBQUM7QUFDekU7QUFFQSw0QkFBNEIsUUFBUSxNQUFNO0FBQUEsRUFDekMsYUFBYTtBQUFBLEVBQ2IsTUFBTSxDQUFDO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixZQUFZLENBQUMsTUFBTTtBQUFBLE1BQ25CLGNBQWM7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNQLFFBQVE7QUFBQSxRQUNUO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFDRixDQUFDO0FBQ0QsNEJBQTRCLFFBQVEsbUJBQW1CO0FBQ3ZELDRCQUE0QixRQUFRLGVBQWU7QUFDbkQsNEJBQTRCLFFBQVEsZ0JBQWdCO0FBQ3BELDRCQUE0QixRQUFRLGNBQWM7QUFDbEQsNEJBQTRCLFFBQVEsS0FBSztBQUN6Qyw0QkFBNEIsUUFBUSxHQUFHOyIsCiAgIm5hbWVzIjogWyJFZGl0b3JTY3JvbGxfIiwgIkRpcmVjdGlvbiIsICJVbml0IiwgIlJldmVhbExpbmVfIiwgIk5hdmlnYXRpb25Db21tYW5kUmV2ZWFsVHlwZSIsICJDb3JlTmF2aWdhdGlvbkNvbW1hbmRzIiwgIkNvbnN0YW50cyIsICJDb3JlRWRpdGluZ0NvbW1hbmRzIl0KfQo=
