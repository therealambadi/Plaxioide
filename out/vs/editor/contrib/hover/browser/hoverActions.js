import { DECREASE_HOVER_VERBOSITY_ACTION_ID, DECREASE_HOVER_VERBOSITY_ACTION_LABEL, GO_TO_BOTTOM_HOVER_ACTION_ID, GO_TO_TOP_HOVER_ACTION_ID, HIDE_HOVER_ACTION_ID, INCREASE_HOVER_VERBOSITY_ACTION_ID, INCREASE_HOVER_VERBOSITY_ACTION_LABEL, PAGE_DOWN_HOVER_ACTION_ID, PAGE_UP_HOVER_ACTION_ID, SCROLL_DOWN_HOVER_ACTION_ID, SCROLL_LEFT_HOVER_ACTION_ID, SCROLL_RIGHT_HOVER_ACTION_ID, SCROLL_UP_HOVER_ACTION_ID, SHOW_DEFINITION_PREVIEW_HOVER_ACTION_ID, SHOW_OR_FOCUS_HOVER_ACTION_ID } from "./hoverActionIds.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { EditorAction } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { GotoDefinitionAtPositionEditorContribution } from "../../gotoSymbol/browser/link/goToDefinitionAtPosition.js";
import { HoverStartMode, HoverStartSource } from "./hoverOperation.js";
import { AccessibilitySupport } from "../../../../platform/accessibility/common/accessibility.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ContentHoverController } from "./contentHoverController.js";
import { HoverVerbosityAction } from "../../../common/languages.js";
import * as nls from "../../../../nls.js";
import "./hover.css";
var HoverFocusBehavior = /* @__PURE__ */ ((HoverFocusBehavior2) => {
  HoverFocusBehavior2["NoAutoFocus"] = "noAutoFocus";
  HoverFocusBehavior2["FocusIfVisible"] = "focusIfVisible";
  HoverFocusBehavior2["AutoFocusImmediately"] = "autoFocusImmediately";
  return HoverFocusBehavior2;
})(HoverFocusBehavior || {});
class ShowOrFocusHoverAction extends EditorAction {
  constructor() {
    super({
      id: SHOW_OR_FOCUS_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "showOrFocusHover",
        comment: [
          "Label for action that will trigger the showing/focusing of a hover in the editor.",
          "If the hover is not visible, it will show the hover.",
          "This allows for users to show the hover without using the mouse."
        ]
      }, "Show or Focus Hover"),
      metadata: {
        description: nls.localize2("showOrFocusHoverDescription", "Show or focus the editor hover which shows documentation, references, and other content for a symbol at the current cursor position."),
        args: [{
          name: "args",
          schema: {
            type: "object",
            properties: {
              "focus": {
                description: "Controls if and when the hover should take focus upon being triggered by this action.",
                enum: ["noAutoFocus" /* NoAutoFocus */, "focusIfVisible" /* FocusIfVisible */, "autoFocusImmediately" /* AutoFocusImmediately */],
                enumDescriptions: [
                  nls.localize("showOrFocusHover.focus.noAutoFocus", "The hover will not automatically take focus."),
                  nls.localize("showOrFocusHover.focus.focusIfVisible", "The hover will take focus only if it is already visible."),
                  nls.localize("showOrFocusHover.focus.autoFocusImmediately", "The hover will automatically take focus when it appears.")
                ],
                default: "focusIfVisible" /* FocusIfVisible */
              }
            }
          }
        }]
      },
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyI),
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, editor, args) {
    if (!editor.hasModel()) {
      return;
    }
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    const focusArgument = args?.focus;
    let focusOption = "focusIfVisible" /* FocusIfVisible */;
    if (Object.values(HoverFocusBehavior).includes(focusArgument)) {
      focusOption = focusArgument;
    } else if (typeof focusArgument === "boolean" && focusArgument) {
      focusOption = "autoFocusImmediately" /* AutoFocusImmediately */;
    }
    const showContentHover = (focus) => {
      const position = editor.getPosition();
      const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
      controller.showContentHover(range, HoverStartMode.Immediate, HoverStartSource.Keyboard, focus);
    };
    const accessibilitySupportEnabled = editor.getOption(EditorOption.accessibilitySupport) === AccessibilitySupport.Enabled;
    if (controller.isHoverVisible) {
      if (focusOption !== "noAutoFocus" /* NoAutoFocus */) {
        controller.focus();
      } else {
        showContentHover(accessibilitySupportEnabled);
      }
    } else {
      showContentHover(accessibilitySupportEnabled || focusOption === "autoFocusImmediately" /* AutoFocusImmediately */);
    }
  }
}
class ShowDefinitionPreviewHoverAction extends EditorAction {
  constructor() {
    super({
      id: SHOW_DEFINITION_PREVIEW_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "showDefinitionPreviewHover",
        comment: [
          "Label for action that will trigger the showing of definition preview hover in the editor.",
          "This allows for users to show the definition preview hover without using the mouse."
        ]
      }, "Show Definition Preview Hover"),
      precondition: void 0,
      metadata: {
        description: nls.localize2("showDefinitionPreviewHoverDescription", "Show the definition preview hover in the editor.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    const position = editor.getPosition();
    if (!position) {
      return;
    }
    const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
    const goto = GotoDefinitionAtPositionEditorContribution.get(editor);
    if (!goto) {
      return;
    }
    const promise = goto.startFindDefinitionFromCursor(position);
    promise.then(() => {
      controller.showContentHover(range, HoverStartMode.Immediate, HoverStartSource.Keyboard, true);
    });
  }
}
class HideContentHoverAction extends EditorAction {
  constructor() {
    super({
      id: HIDE_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "hideHover",
        comment: ["Label for action that will hide the hover in the editor."]
      }, "Hide Hover"),
      alias: "Hide Content Hover",
      precondition: void 0
    });
  }
  run(accessor, editor) {
    ContentHoverController.get(editor)?.hideContentHover();
  }
}
class ScrollUpHoverAction extends EditorAction {
  constructor() {
    super({
      id: SCROLL_UP_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "scrollUpHover",
        comment: [
          "Action that allows to scroll up in the hover widget with the up arrow when the hover widget is focused."
        ]
      }, "Scroll Up Hover"),
      precondition: EditorContextKeys.hoverFocused,
      kbOpts: {
        kbExpr: EditorContextKeys.hoverFocused,
        primary: KeyCode.UpArrow,
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: nls.localize2("scrollUpHoverDescription", "Scroll up the editor hover.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    controller.scrollUp();
  }
}
class ScrollDownHoverAction extends EditorAction {
  constructor() {
    super({
      id: SCROLL_DOWN_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "scrollDownHover",
        comment: [
          "Action that allows to scroll down in the hover widget with the up arrow when the hover widget is focused."
        ]
      }, "Scroll Down Hover"),
      precondition: EditorContextKeys.hoverFocused,
      kbOpts: {
        kbExpr: EditorContextKeys.hoverFocused,
        primary: KeyCode.DownArrow,
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: nls.localize2("scrollDownHoverDescription", "Scroll down the editor hover.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    controller.scrollDown();
  }
}
class ScrollLeftHoverAction extends EditorAction {
  constructor() {
    super({
      id: SCROLL_LEFT_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "scrollLeftHover",
        comment: [
          "Action that allows to scroll left in the hover widget with the left arrow when the hover widget is focused."
        ]
      }, "Scroll Left Hover"),
      precondition: EditorContextKeys.hoverFocused,
      kbOpts: {
        kbExpr: EditorContextKeys.hoverFocused,
        primary: KeyCode.LeftArrow,
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: nls.localize2("scrollLeftHoverDescription", "Scroll left the editor hover.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    controller.scrollLeft();
  }
}
class ScrollRightHoverAction extends EditorAction {
  constructor() {
    super({
      id: SCROLL_RIGHT_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "scrollRightHover",
        comment: [
          "Action that allows to scroll right in the hover widget with the right arrow when the hover widget is focused."
        ]
      }, "Scroll Right Hover"),
      precondition: EditorContextKeys.hoverFocused,
      kbOpts: {
        kbExpr: EditorContextKeys.hoverFocused,
        primary: KeyCode.RightArrow,
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: nls.localize2("scrollRightHoverDescription", "Scroll right the editor hover.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    controller.scrollRight();
  }
}
class PageUpHoverAction extends EditorAction {
  constructor() {
    super({
      id: PAGE_UP_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "pageUpHover",
        comment: [
          "Action that allows to page up in the hover widget with the page up command when the hover widget is focused."
        ]
      }, "Page Up Hover"),
      precondition: EditorContextKeys.hoverFocused,
      kbOpts: {
        kbExpr: EditorContextKeys.hoverFocused,
        primary: KeyCode.PageUp,
        secondary: [KeyMod.Alt | KeyCode.UpArrow],
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: nls.localize2("pageUpHoverDescription", "Page up the editor hover.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    controller.pageUp();
  }
}
class PageDownHoverAction extends EditorAction {
  constructor() {
    super({
      id: PAGE_DOWN_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "pageDownHover",
        comment: [
          "Action that allows to page down in the hover widget with the page down command when the hover widget is focused."
        ]
      }, "Page Down Hover"),
      precondition: EditorContextKeys.hoverFocused,
      kbOpts: {
        kbExpr: EditorContextKeys.hoverFocused,
        primary: KeyCode.PageDown,
        secondary: [KeyMod.Alt | KeyCode.DownArrow],
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: nls.localize2("pageDownHoverDescription", "Page down the editor hover.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    controller.pageDown();
  }
}
class GoToTopHoverAction extends EditorAction {
  constructor() {
    super({
      id: GO_TO_TOP_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "goToTopHover",
        comment: [
          "Action that allows to go to the top of the hover widget with the home command when the hover widget is focused."
        ]
      }, "Go To Top Hover"),
      precondition: EditorContextKeys.hoverFocused,
      kbOpts: {
        kbExpr: EditorContextKeys.hoverFocused,
        primary: KeyCode.Home,
        secondary: [KeyMod.CtrlCmd | KeyCode.UpArrow],
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: nls.localize2("goToTopHoverDescription", "Go to the top of the editor hover.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    controller.goToTop();
  }
}
class GoToBottomHoverAction extends EditorAction {
  constructor() {
    super({
      id: GO_TO_BOTTOM_HOVER_ACTION_ID,
      label: nls.localize2({
        key: "goToBottomHover",
        comment: [
          "Action that allows to go to the bottom in the hover widget with the end command when the hover widget is focused."
        ]
      }, "Go To Bottom Hover"),
      precondition: EditorContextKeys.hoverFocused,
      kbOpts: {
        kbExpr: EditorContextKeys.hoverFocused,
        primary: KeyCode.End,
        secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow],
        weight: KeybindingWeight.EditorContrib
      },
      metadata: {
        description: nls.localize2("goToBottomHoverDescription", "Go to the bottom of the editor hover.")
      }
    });
  }
  run(accessor, editor) {
    const controller = ContentHoverController.get(editor);
    if (!controller) {
      return;
    }
    controller.goToBottom();
  }
}
class IncreaseHoverVerbosityLevel extends EditorAction {
  constructor() {
    super({
      id: INCREASE_HOVER_VERBOSITY_ACTION_ID,
      label: INCREASE_HOVER_VERBOSITY_ACTION_LABEL,
      alias: "Increase Hover Verbosity Level",
      precondition: EditorContextKeys.hoverVisible
    });
  }
  run(accessor, editor, args) {
    const hoverController = ContentHoverController.get(editor);
    if (!hoverController) {
      return;
    }
    const index = args?.index !== void 0 ? args.index : hoverController.focusedHoverPartIndex();
    hoverController.updateHoverVerbosityLevel(HoverVerbosityAction.Increase, index, args?.focus);
  }
}
class DecreaseHoverVerbosityLevel extends EditorAction {
  constructor() {
    super({
      id: DECREASE_HOVER_VERBOSITY_ACTION_ID,
      label: DECREASE_HOVER_VERBOSITY_ACTION_LABEL,
      alias: "Decrease Hover Verbosity Level",
      precondition: EditorContextKeys.hoverVisible
    });
  }
  run(accessor, editor, args) {
    const hoverController = ContentHoverController.get(editor);
    if (!hoverController) {
      return;
    }
    const index = args?.index !== void 0 ? args.index : hoverController.focusedHoverPartIndex();
    ContentHoverController.get(editor)?.updateHoverVerbosityLevel(HoverVerbosityAction.Decrease, index, args?.focus);
  }
}
export {
  DecreaseHoverVerbosityLevel,
  GoToBottomHoverAction,
  GoToTopHoverAction,
  HideContentHoverAction,
  IncreaseHoverVerbosityLevel,
  PageDownHoverAction,
  PageUpHoverAction,
  ScrollDownHoverAction,
  ScrollLeftHoverAction,
  ScrollRightHoverAction,
  ScrollUpHoverAction,
  ShowDefinitionPreviewHoverAction,
  ShowOrFocusHoverAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2hvdmVyQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERFQ1JFQVNFX0hPVkVSX1ZFUkJPU0lUWV9BQ1RJT05fSUQsIERFQ1JFQVNFX0hPVkVSX1ZFUkJPU0lUWV9BQ1RJT05fTEFCRUwsIEdPX1RPX0JPVFRPTV9IT1ZFUl9BQ1RJT05fSUQsIEdPX1RPX1RPUF9IT1ZFUl9BQ1RJT05fSUQsIEhJREVfSE9WRVJfQUNUSU9OX0lELCBJTkNSRUFTRV9IT1ZFUl9WRVJCT1NJVFlfQUNUSU9OX0lELCBJTkNSRUFTRV9IT1ZFUl9WRVJCT1NJVFlfQUNUSU9OX0xBQkVMLCBQQUdFX0RPV05fSE9WRVJfQUNUSU9OX0lELCBQQUdFX1VQX0hPVkVSX0FDVElPTl9JRCwgU0NST0xMX0RPV05fSE9WRVJfQUNUSU9OX0lELCBTQ1JPTExfTEVGVF9IT1ZFUl9BQ1RJT05fSUQsIFNDUk9MTF9SSUdIVF9IT1ZFUl9BQ1RJT05fSUQsIFNDUk9MTF9VUF9IT1ZFUl9BQ1RJT05fSUQsIFNIT1dfREVGSU5JVElPTl9QUkVWSUVXX0hPVkVSX0FDVElPTl9JRCwgU0hPV19PUl9GT0NVU19IT1ZFUl9BQ1RJT05fSUQgfSBmcm9tICcuL2hvdmVyQWN0aW9uSWRzLmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgR290b0RlZmluaXRpb25BdFBvc2l0aW9uRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vZ290b1N5bWJvbC9icm93c2VyL2xpbmsvZ29Ub0RlZmluaXRpb25BdFBvc2l0aW9uLmpzJztcbmltcG9ydCB7IEhvdmVyU3RhcnRNb2RlLCBIb3ZlclN0YXJ0U291cmNlIH0gZnJvbSAnLi9ob3Zlck9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5U3VwcG9ydCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29udGVudEhvdmVyQ29udHJvbGxlciB9IGZyb20gJy4vY29udGVudEhvdmVyQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBIb3ZlclZlcmJvc2l0eUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgJy4vaG92ZXIuY3NzJztcblxuZW51bSBIb3ZlckZvY3VzQmVoYXZpb3Ige1xuXHROb0F1dG9Gb2N1cyA9ICdub0F1dG9Gb2N1cycsXG5cdEZvY3VzSWZWaXNpYmxlID0gJ2ZvY3VzSWZWaXNpYmxlJyxcblx0QXV0b0ZvY3VzSW1tZWRpYXRlbHkgPSAnYXV0b0ZvY3VzSW1tZWRpYXRlbHknXG59XG5cbmV4cG9ydCBjbGFzcyBTaG93T3JGb2N1c0hvdmVyQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU0hPV19PUl9GT0NVU19IT1ZFUl9BQ1RJT05fSUQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMih7XG5cdFx0XHRcdGtleTogJ3Nob3dPckZvY3VzSG92ZXInLFxuXHRcdFx0XHRjb21tZW50OiBbXG5cdFx0XHRcdFx0J0xhYmVsIGZvciBhY3Rpb24gdGhhdCB3aWxsIHRyaWdnZXIgdGhlIHNob3dpbmcvZm9jdXNpbmcgb2YgYSBob3ZlciBpbiB0aGUgZWRpdG9yLicsXG5cdFx0XHRcdFx0J0lmIHRoZSBob3ZlciBpcyBub3QgdmlzaWJsZSwgaXQgd2lsbCBzaG93IHRoZSBob3Zlci4nLFxuXHRcdFx0XHRcdCdUaGlzIGFsbG93cyBmb3IgdXNlcnMgdG8gc2hvdyB0aGUgaG92ZXIgd2l0aG91dCB1c2luZyB0aGUgbW91c2UuJ1xuXHRcdFx0XHRdXG5cdFx0XHR9LCBcIlNob3cgb3IgRm9jdXMgSG92ZXJcIiksXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignc2hvd09yRm9jdXNIb3ZlckRlc2NyaXB0aW9uJywgJ1Nob3cgb3IgZm9jdXMgdGhlIGVkaXRvciBob3ZlciB3aGljaCBzaG93cyBkb2N1bWVudGF0aW9uLCByZWZlcmVuY2VzLCBhbmQgb3RoZXIgY29udGVudCBmb3IgYSBzeW1ib2wgYXQgdGhlIGN1cnJlbnQgY3Vyc29yIHBvc2l0aW9uLicpLFxuXHRcdFx0XHRhcmdzOiBbe1xuXHRcdFx0XHRcdG5hbWU6ICdhcmdzJyxcblx0XHRcdFx0XHRzY2hlbWE6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHQnZm9jdXMnOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdDb250cm9scyBpZiBhbmQgd2hlbiB0aGUgaG92ZXIgc2hvdWxkIHRha2UgZm9jdXMgdXBvbiBiZWluZyB0cmlnZ2VyZWQgYnkgdGhpcyBhY3Rpb24uJyxcblx0XHRcdFx0XHRcdFx0XHRlbnVtOiBbSG92ZXJGb2N1c0JlaGF2aW9yLk5vQXV0b0ZvY3VzLCBIb3ZlckZvY3VzQmVoYXZpb3IuRm9jdXNJZlZpc2libGUsIEhvdmVyRm9jdXNCZWhhdmlvci5BdXRvRm9jdXNJbW1lZGlhdGVseV0sXG5cdFx0XHRcdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzaG93T3JGb2N1c0hvdmVyLmZvY3VzLm5vQXV0b0ZvY3VzJywgJ1RoZSBob3ZlciB3aWxsIG5vdCBhdXRvbWF0aWNhbGx5IHRha2UgZm9jdXMuJyksXG5cdFx0XHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ3Nob3dPckZvY3VzSG92ZXIuZm9jdXMuZm9jdXNJZlZpc2libGUnLCAnVGhlIGhvdmVyIHdpbGwgdGFrZSBmb2N1cyBvbmx5IGlmIGl0IGlzIGFscmVhZHkgdmlzaWJsZS4nKSxcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2hvd09yRm9jdXNIb3Zlci5mb2N1cy5hdXRvRm9jdXNJbW1lZGlhdGVseScsICdUaGUgaG92ZXIgd2lsbCBhdXRvbWF0aWNhbGx5IHRha2UgZm9jdXMgd2hlbiBpdCBhcHBlYXJzLicpLFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogSG92ZXJGb2N1c0JlaGF2aW9yLkZvY3VzSWZWaXNpYmxlLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV1cblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlJKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250cm9sbGVyID0gQ29udGVudEhvdmVyQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmb2N1c0FyZ3VtZW50ID0gYXJncz8uZm9jdXM7XG5cdFx0bGV0IGZvY3VzT3B0aW9uID0gSG92ZXJGb2N1c0JlaGF2aW9yLkZvY3VzSWZWaXNpYmxlO1xuXHRcdGlmIChPYmplY3QudmFsdWVzKEhvdmVyRm9jdXNCZWhhdmlvcikuaW5jbHVkZXMoZm9jdXNBcmd1bWVudCkpIHtcblx0XHRcdGZvY3VzT3B0aW9uID0gZm9jdXNBcmd1bWVudDtcblx0XHR9IGVsc2UgaWYgKHR5cGVvZiBmb2N1c0FyZ3VtZW50ID09PSAnYm9vbGVhbicgJiYgZm9jdXNBcmd1bWVudCkge1xuXHRcdFx0Zm9jdXNPcHRpb24gPSBIb3ZlckZvY3VzQmVoYXZpb3IuQXV0b0ZvY3VzSW1tZWRpYXRlbHk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2hvd0NvbnRlbnRIb3ZlciA9IChmb2N1czogYm9vbGVhbikgPT4ge1xuXHRcdFx0Y29uc3QgcG9zaXRpb24gPSBlZGl0b3IuZ2V0UG9zaXRpb24oKTtcblx0XHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKTtcblx0XHRcdGNvbnRyb2xsZXIuc2hvd0NvbnRlbnRIb3ZlcihyYW5nZSwgSG92ZXJTdGFydE1vZGUuSW1tZWRpYXRlLCBIb3ZlclN0YXJ0U291cmNlLktleWJvYXJkLCBmb2N1cyk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTdXBwb3J0RW5hYmxlZCA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmFjY2Vzc2liaWxpdHlTdXBwb3J0KSA9PT0gQWNjZXNzaWJpbGl0eVN1cHBvcnQuRW5hYmxlZDtcblxuXHRcdGlmIChjb250cm9sbGVyLmlzSG92ZXJWaXNpYmxlKSB7XG5cdFx0XHRpZiAoZm9jdXNPcHRpb24gIT09IEhvdmVyRm9jdXNCZWhhdmlvci5Ob0F1dG9Gb2N1cykge1xuXHRcdFx0XHRjb250cm9sbGVyLmZvY3VzKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzaG93Q29udGVudEhvdmVyKGFjY2Vzc2liaWxpdHlTdXBwb3J0RW5hYmxlZCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNob3dDb250ZW50SG92ZXIoYWNjZXNzaWJpbGl0eVN1cHBvcnRFbmFibGVkIHx8IGZvY3VzT3B0aW9uID09PSBIb3ZlckZvY3VzQmVoYXZpb3IuQXV0b0ZvY3VzSW1tZWRpYXRlbHkpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2hvd0RlZmluaXRpb25QcmV2aWV3SG92ZXJBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTSE9XX0RFRklOSVRJT05fUFJFVklFV19IT1ZFUl9BQ1RJT05fSUQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMih7XG5cdFx0XHRcdGtleTogJ3Nob3dEZWZpbml0aW9uUHJldmlld0hvdmVyJyxcblx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdCdMYWJlbCBmb3IgYWN0aW9uIHRoYXQgd2lsbCB0cmlnZ2VyIHRoZSBzaG93aW5nIG9mIGRlZmluaXRpb24gcHJldmlldyBob3ZlciBpbiB0aGUgZWRpdG9yLicsXG5cdFx0XHRcdFx0J1RoaXMgYWxsb3dzIGZvciB1c2VycyB0byBzaG93IHRoZSBkZWZpbml0aW9uIHByZXZpZXcgaG92ZXIgd2l0aG91dCB1c2luZyB0aGUgbW91c2UuJ1xuXHRcdFx0XHRdXG5cdFx0XHR9LCBcIlNob3cgRGVmaW5pdGlvbiBQcmV2aWV3IEhvdmVyXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignc2hvd0RlZmluaXRpb25QcmV2aWV3SG92ZXJEZXNjcmlwdGlvbicsICdTaG93IHRoZSBkZWZpbml0aW9uIHByZXZpZXcgaG92ZXIgaW4gdGhlIGVkaXRvci4nKSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IENvbnRlbnRIb3ZlckNvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHBvc2l0aW9uID0gZWRpdG9yLmdldFBvc2l0aW9uKCk7XG5cblx0XHRpZiAoIXBvc2l0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4pO1xuXHRcdGNvbnN0IGdvdG8gPSBHb3RvRGVmaW5pdGlvbkF0UG9zaXRpb25FZGl0b3JDb250cmlidXRpb24uZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFnb3RvKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvbWlzZSA9IGdvdG8uc3RhcnRGaW5kRGVmaW5pdGlvbkZyb21DdXJzb3IocG9zaXRpb24pO1xuXHRcdHByb21pc2UudGhlbigoKSA9PiB7XG5cdFx0XHRjb250cm9sbGVyLnNob3dDb250ZW50SG92ZXIocmFuZ2UsIEhvdmVyU3RhcnRNb2RlLkltbWVkaWF0ZSwgSG92ZXJTdGFydFNvdXJjZS5LZXlib2FyZCwgdHJ1ZSk7XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEhpZGVDb250ZW50SG92ZXJBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBISURFX0hPVkVSX0FDVElPTl9JRCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKHtcblx0XHRcdFx0a2V5OiAnaGlkZUhvdmVyJyxcblx0XHRcdFx0Y29tbWVudDogWydMYWJlbCBmb3IgYWN0aW9uIHRoYXQgd2lsbCBoaWRlIHRoZSBob3ZlciBpbiB0aGUgZWRpdG9yLiddXG5cdFx0XHR9LCBcIkhpZGUgSG92ZXJcIiksXG5cdFx0XHRhbGlhczogJ0hpZGUgQ29udGVudCBIb3ZlcicsXG5cdFx0XHRwcmVjb25kaXRpb246IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdENvbnRlbnRIb3ZlckNvbnRyb2xsZXIuZ2V0KGVkaXRvcik/LmhpZGVDb250ZW50SG92ZXIoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2Nyb2xsVXBIb3ZlckFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNDUk9MTF9VUF9IT1ZFUl9BQ1RJT05fSUQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMih7XG5cdFx0XHRcdGtleTogJ3Njcm9sbFVwSG92ZXInLFxuXHRcdFx0XHRjb21tZW50OiBbXG5cdFx0XHRcdFx0J0FjdGlvbiB0aGF0IGFsbG93cyB0byBzY3JvbGwgdXAgaW4gdGhlIGhvdmVyIHdpZGdldCB3aXRoIHRoZSB1cCBhcnJvdyB3aGVuIHRoZSBob3ZlciB3aWRnZXQgaXMgZm9jdXNlZC4nXG5cdFx0XHRcdF1cblx0XHRcdH0sIFwiU2Nyb2xsIFVwIEhvdmVyXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy5ob3ZlckZvY3VzZWQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5ob3ZlckZvY3VzZWQsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignc2Nyb2xsVXBIb3ZlckRlc2NyaXB0aW9uJywgJ1Njcm9sbCB1cCB0aGUgZWRpdG9yIGhvdmVyLicpXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb250ZW50SG92ZXJDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb250cm9sbGVyLnNjcm9sbFVwKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNjcm9sbERvd25Ib3ZlckFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFNDUk9MTF9ET1dOX0hPVkVSX0FDVElPTl9JRCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKHtcblx0XHRcdFx0a2V5OiAnc2Nyb2xsRG93bkhvdmVyJyxcblx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdCdBY3Rpb24gdGhhdCBhbGxvd3MgdG8gc2Nyb2xsIGRvd24gaW4gdGhlIGhvdmVyIHdpZGdldCB3aXRoIHRoZSB1cCBhcnJvdyB3aGVuIHRoZSBob3ZlciB3aWRnZXQgaXMgZm9jdXNlZC4nXG5cdFx0XHRcdF1cblx0XHRcdH0sIFwiU2Nyb2xsIERvd24gSG92ZXJcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLmhvdmVyRm9jdXNlZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmhvdmVyRm9jdXNlZCxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZTIoJ3Njcm9sbERvd25Ib3ZlckRlc2NyaXB0aW9uJywgJ1Njcm9sbCBkb3duIHRoZSBlZGl0b3IgaG92ZXIuJyksXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb250ZW50SG92ZXJDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb250cm9sbGVyLnNjcm9sbERvd24oKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2Nyb2xsTGVmdEhvdmVyQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU0NST0xMX0xFRlRfSE9WRVJfQUNUSU9OX0lELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoe1xuXHRcdFx0XHRrZXk6ICdzY3JvbGxMZWZ0SG92ZXInLFxuXHRcdFx0XHRjb21tZW50OiBbXG5cdFx0XHRcdFx0J0FjdGlvbiB0aGF0IGFsbG93cyB0byBzY3JvbGwgbGVmdCBpbiB0aGUgaG92ZXIgd2lkZ2V0IHdpdGggdGhlIGxlZnQgYXJyb3cgd2hlbiB0aGUgaG92ZXIgd2lkZ2V0IGlzIGZvY3VzZWQuJ1xuXHRcdFx0XHRdXG5cdFx0XHR9LCBcIlNjcm9sbCBMZWZ0IEhvdmVyXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy5ob3ZlckZvY3VzZWQsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0a2JFeHByOiBFZGl0b3JDb250ZXh0S2V5cy5ob3ZlckZvY3VzZWQsXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuTGVmdEFycm93LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdzY3JvbGxMZWZ0SG92ZXJEZXNjcmlwdGlvbicsICdTY3JvbGwgbGVmdCB0aGUgZWRpdG9yIGhvdmVyLicpLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gQ29udGVudEhvdmVyQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29udHJvbGxlci5zY3JvbGxMZWZ0KCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNjcm9sbFJpZ2h0SG92ZXJBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTQ1JPTExfUklHSFRfSE9WRVJfQUNUSU9OX0lELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoe1xuXHRcdFx0XHRrZXk6ICdzY3JvbGxSaWdodEhvdmVyJyxcblx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdCdBY3Rpb24gdGhhdCBhbGxvd3MgdG8gc2Nyb2xsIHJpZ2h0IGluIHRoZSBob3ZlciB3aWRnZXQgd2l0aCB0aGUgcmlnaHQgYXJyb3cgd2hlbiB0aGUgaG92ZXIgd2lkZ2V0IGlzIGZvY3VzZWQuJ1xuXHRcdFx0XHRdXG5cdFx0XHR9LCBcIlNjcm9sbCBSaWdodCBIb3ZlclwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMuaG92ZXJGb2N1c2VkLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuaG92ZXJGb2N1c2VkLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLlJpZ2h0QXJyb3csXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZTIoJ3Njcm9sbFJpZ2h0SG92ZXJEZXNjcmlwdGlvbicsICdTY3JvbGwgcmlnaHQgdGhlIGVkaXRvciBob3Zlci4nKVxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gQ29udGVudEhvdmVyQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29udHJvbGxlci5zY3JvbGxSaWdodCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBQYWdlVXBIb3ZlckFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFBBR0VfVVBfSE9WRVJfQUNUSU9OX0lELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoe1xuXHRcdFx0XHRrZXk6ICdwYWdlVXBIb3ZlcicsXG5cdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHQnQWN0aW9uIHRoYXQgYWxsb3dzIHRvIHBhZ2UgdXAgaW4gdGhlIGhvdmVyIHdpZGdldCB3aXRoIHRoZSBwYWdlIHVwIGNvbW1hbmQgd2hlbiB0aGUgaG92ZXIgd2lkZ2V0IGlzIGZvY3VzZWQuJ1xuXHRcdFx0XHRdXG5cdFx0XHR9LCBcIlBhZ2UgVXAgSG92ZXJcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLmhvdmVyRm9jdXNlZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmhvdmVyRm9jdXNlZCxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5QYWdlVXAsXG5cdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5BbHQgfCBLZXlDb2RlLlVwQXJyb3ddLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdwYWdlVXBIb3ZlckRlc2NyaXB0aW9uJywgJ1BhZ2UgdXAgdGhlIGVkaXRvciBob3Zlci4nKSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IENvbnRlbnRIb3ZlckNvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnRyb2xsZXIucGFnZVVwKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFBhZ2VEb3duSG92ZXJBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBQQUdFX0RPV05fSE9WRVJfQUNUSU9OX0lELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoe1xuXHRcdFx0XHRrZXk6ICdwYWdlRG93bkhvdmVyJyxcblx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdCdBY3Rpb24gdGhhdCBhbGxvd3MgdG8gcGFnZSBkb3duIGluIHRoZSBob3ZlciB3aWRnZXQgd2l0aCB0aGUgcGFnZSBkb3duIGNvbW1hbmQgd2hlbiB0aGUgaG92ZXIgd2lkZ2V0IGlzIGZvY3VzZWQuJ1xuXHRcdFx0XHRdXG5cdFx0XHR9LCBcIlBhZ2UgRG93biBIb3ZlclwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMuaG92ZXJGb2N1c2VkLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuaG92ZXJGb2N1c2VkLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLlBhZ2VEb3duLFxuXHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQWx0IHwgS2V5Q29kZS5Eb3duQXJyb3ddLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdwYWdlRG93bkhvdmVyRGVzY3JpcHRpb24nLCAnUGFnZSBkb3duIHRoZSBlZGl0b3IgaG92ZXIuJyksXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb250ZW50SG92ZXJDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb250cm9sbGVyLnBhZ2VEb3duKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEdvVG9Ub3BIb3ZlckFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEdPX1RPX1RPUF9IT1ZFUl9BQ1RJT05fSUQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMih7XG5cdFx0XHRcdGtleTogJ2dvVG9Ub3BIb3ZlcicsXG5cdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHQnQWN0aW9uIHRoYXQgYWxsb3dzIHRvIGdvIHRvIHRoZSB0b3Agb2YgdGhlIGhvdmVyIHdpZGdldCB3aXRoIHRoZSBob21lIGNvbW1hbmQgd2hlbiB0aGUgaG92ZXIgd2lkZ2V0IGlzIGZvY3VzZWQuJ1xuXHRcdFx0XHRdXG5cdFx0XHR9LCBcIkdvIFRvIFRvcCBIb3ZlclwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMuaG92ZXJGb2N1c2VkLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuaG92ZXJGb2N1c2VkLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkhvbWUsXG5cdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5VcEFycm93XSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignZ29Ub1RvcEhvdmVyRGVzY3JpcHRpb24nLCAnR28gdG8gdGhlIHRvcCBvZiB0aGUgZWRpdG9yIGhvdmVyLicpLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gQ29udGVudEhvdmVyQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29udHJvbGxlci5nb1RvVG9wKCk7XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgR29Ub0JvdHRvbUhvdmVyQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogR09fVE9fQk9UVE9NX0hPVkVSX0FDVElPTl9JRCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKHtcblx0XHRcdFx0a2V5OiAnZ29Ub0JvdHRvbUhvdmVyJyxcblx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdCdBY3Rpb24gdGhhdCBhbGxvd3MgdG8gZ28gdG8gdGhlIGJvdHRvbSBpbiB0aGUgaG92ZXIgd2lkZ2V0IHdpdGggdGhlIGVuZCBjb21tYW5kIHdoZW4gdGhlIGhvdmVyIHdpZGdldCBpcyBmb2N1c2VkLidcblx0XHRcdFx0XVxuXHRcdFx0fSwgXCJHbyBUbyBCb3R0b20gSG92ZXJcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLmhvdmVyRm9jdXNlZCxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHRrYkV4cHI6IEVkaXRvckNvbnRleHRLZXlzLmhvdmVyRm9jdXNlZCxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbmQsXG5cdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3ddLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdnb1RvQm90dG9tSG92ZXJEZXNjcmlwdGlvbicsICdHbyB0byB0aGUgYm90dG9tIG9mIHRoZSBlZGl0b3IgaG92ZXIuJylcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IENvbnRlbnRIb3ZlckNvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnRyb2xsZXIuZ29Ub0JvdHRvbSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbmNyZWFzZUhvdmVyVmVyYm9zaXR5TGV2ZWwgZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBJTkNSRUFTRV9IT1ZFUl9WRVJCT1NJVFlfQUNUSU9OX0lELFxuXHRcdFx0bGFiZWw6IElOQ1JFQVNFX0hPVkVSX1ZFUkJPU0lUWV9BQ1RJT05fTEFCRUwsXG5cdFx0XHRhbGlhczogJ0luY3JlYXNlIEhvdmVyIFZlcmJvc2l0eSBMZXZlbCcsXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLmhvdmVyVmlzaWJsZVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvciwgYXJncz86IHsgaW5kZXg6IG51bWJlcjsgZm9jdXM6IGJvb2xlYW4gfSk6IHZvaWQge1xuXHRcdGNvbnN0IGhvdmVyQ29udHJvbGxlciA9IENvbnRlbnRIb3ZlckNvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFob3ZlckNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaW5kZXggPSBhcmdzPy5pbmRleCAhPT0gdW5kZWZpbmVkID8gYXJncy5pbmRleCA6IGhvdmVyQ29udHJvbGxlci5mb2N1c2VkSG92ZXJQYXJ0SW5kZXgoKTtcblx0XHRob3ZlckNvbnRyb2xsZXIudXBkYXRlSG92ZXJWZXJib3NpdHlMZXZlbChIb3ZlclZlcmJvc2l0eUFjdGlvbi5JbmNyZWFzZSwgaW5kZXgsIGFyZ3M/LmZvY3VzKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGVjcmVhc2VIb3ZlclZlcmJvc2l0eUxldmVsIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogREVDUkVBU0VfSE9WRVJfVkVSQk9TSVRZX0FDVElPTl9JRCxcblx0XHRcdGxhYmVsOiBERUNSRUFTRV9IT1ZFUl9WRVJCT1NJVFlfQUNUSU9OX0xBQkVMLFxuXHRcdFx0YWxpYXM6ICdEZWNyZWFzZSBIb3ZlciBWZXJib3NpdHkgTGV2ZWwnLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBFZGl0b3JDb250ZXh0S2V5cy5ob3ZlclZpc2libGVcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IsIGFyZ3M/OiB7IGluZGV4OiBudW1iZXI7IGZvY3VzOiBib29sZWFuIH0pOiB2b2lkIHtcblx0XHRjb25zdCBob3ZlckNvbnRyb2xsZXIgPSBDb250ZW50SG92ZXJDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmICghaG92ZXJDb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGluZGV4ID0gYXJncz8uaW5kZXggIT09IHVuZGVmaW5lZCA/IGFyZ3MuaW5kZXggOiBob3ZlckNvbnRyb2xsZXIuZm9jdXNlZEhvdmVyUGFydEluZGV4KCk7XG5cdFx0Q29udGVudEhvdmVyQ29udHJvbGxlci5nZXQoZWRpdG9yKT8udXBkYXRlSG92ZXJWZXJib3NpdHlMZXZlbChIb3ZlclZlcmJvc2l0eUFjdGlvbi5EZWNyZWFzZSwgaW5kZXgsIGFyZ3M/LmZvY3VzKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxvQ0FBb0MsdUNBQXVDLDhCQUE4QiwyQkFBMkIsc0JBQXNCLG9DQUFvQyx1Q0FBdUMsMkJBQTJCLHlCQUF5Qiw2QkFBNkIsNkJBQTZCLDhCQUE4QiwyQkFBMkIseUNBQXlDLHFDQUFxQztBQUNuZSxTQUFTLFVBQVUsU0FBUyxjQUFjO0FBRTFDLFNBQVMsb0JBQXNDO0FBQy9DLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGtEQUFr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
