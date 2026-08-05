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
import { n, trackFocus } from "../../../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { timeout } from "../../../../../../../base/common/async.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { BugIndicatingError } from "../../../../../../../base/common/errors.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, constObservable, derived, observableFromEvent, observableValue, runOnChange } from "../../../../../../../base/common/observable.js";
import { debouncedObservable } from "../../../../../../../base/common/observableInternal/utils.js";
import { IAccessibilityService } from "../../../../../../../platform/accessibility/common/accessibility.js";
import { IHoverService } from "../../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../../platform/storage/common/storage.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { Point } from "../../../../../../browser/point.js";
import { Rect } from "../../../../../../browser/rect.js";
import { EditorOption, RenderLineNumbersType } from "../../../../../../common/config/editorOptions.js";
import { OffsetRange } from "../../../../../../common/core/offsetRange.js";
import { StickyScrollController } from "../../../../../stickyScroll/browser/stickyScrollController.js";
import { InlineEditTabAction } from "../inlineEditsViewInterface.js";
import { getEditorBlendedColor, inlineEditIndicatorBackground, inlineEditIndicatorPrimaryBackground, inlineEditIndicatorPrimaryBorder, inlineEditIndicatorPrimaryForeground, inlineEditIndicatorSecondaryBackground, inlineEditIndicatorSecondaryBorder, inlineEditIndicatorSecondaryForeground, inlineEditIndicatorsuccessfulBackground, inlineEditIndicatorsuccessfulBorder, inlineEditIndicatorsuccessfulForeground } from "../theme.js";
import { mapOutFalsy, rectToProps } from "../utils/utils.js";
import { GutterIndicatorMenuContent } from "./gutterIndicatorMenu.js";
var UserKind = /* @__PURE__ */ ((UserKind2) => {
  UserKind2["FirstTime"] = "firstTime";
  UserKind2["SecondTime"] = "secondTime";
  UserKind2["Active"] = "active";
  return UserKind2;
})(UserKind || {});
let InlineEditsGutterIndicator = class extends Disposable {
  constructor(_editorObs, _originalRange, _verticalOffset, _host, _model, _isHoveringOverInlineEdit, _focusIsInMenu, _hoverService, _instantiationService, _storageService, _accessibilityService, themeService) {
    super();
    this._editorObs = _editorObs;
    this._originalRange = _originalRange;
    this._verticalOffset = _verticalOffset;
    this._host = _host;
    this._model = _model;
    this._isHoveringOverInlineEdit = _isHoveringOverInlineEdit;
    this._focusIsInMenu = _focusIsInMenu;
    this._hoverService = _hoverService;
    this._instantiationService = _instantiationService;
    this._storageService = _storageService;
    this._accessibilityService = _accessibilityService;
    this._activeCompletionId = derived((reader) => {
      const layout = this._layout.read(reader);
      if (!layout) {
        return void 0;
      }
      const model = this._model.read(reader);
      if (!model) {
        return void 0;
      }
      return model.inlineEdit.inlineCompletion.id;
    });
    this._newUserAnimationDisposable = this._register(new MutableDisposable());
    this._firstToSecondTimeUserDisposable = this._register(new MutableDisposable());
    this._secondTimeToActiveUserDisposable = this._register(new MutableDisposable());
    this._originalRangeObs = mapOutFalsy(this._originalRange);
    this._state = derived((reader) => {
      const range = this._originalRangeObs.read(reader);
      if (!range) {
        return void 0;
      }
      return {
        range,
        lineOffsetRange: this._editorObs.observeLineOffsetRange(range, this._store)
      };
    });
    this._stickyScrollController = StickyScrollController.get(this._editorObs.editor);
    this._stickyScrollHeight = this._stickyScrollController ? observableFromEvent(this._stickyScrollController.onDidChangeStickyScrollHeight, () => this._stickyScrollController.stickyScrollWidgetHeight) : constObservable(0);
    this._lineNumberToRender = derived(this, (reader) => {
      if (this._verticalOffset.read(reader) !== 0) {
        return "";
      }
      const lineNumber = this._originalRange.read(reader)?.startLineNumber;
      const lineNumberOptions = this._editorObs.getOption(EditorOption.lineNumbers).read(reader);
      if (lineNumber === void 0 || lineNumberOptions.renderType === RenderLineNumbersType.Off) {
        return "";
      }
      if (lineNumberOptions.renderType === RenderLineNumbersType.Interval) {
        const cursorPosition = this._editorObs.cursorPosition.read(reader);
        if (lineNumber % 10 === 0 || cursorPosition && cursorPosition.lineNumber === lineNumber) {
          return lineNumber.toString();
        }
        return "";
      }
      if (lineNumberOptions.renderType === RenderLineNumbersType.Relative) {
        const cursorPosition = this._editorObs.cursorPosition.read(reader);
        if (!cursorPosition) {
          return "";
        }
        const relativeLineNumber = Math.abs(lineNumber - cursorPosition.lineNumber);
        if (relativeLineNumber === 0) {
          return lineNumber.toString();
        }
        return relativeLineNumber.toString();
      }
      if (lineNumberOptions.renderType === RenderLineNumbersType.Custom) {
        if (lineNumberOptions.renderFn) {
          return lineNumberOptions.renderFn(lineNumber);
        }
        return "";
      }
      return lineNumber.toString();
    });
    this._layout = derived(this, (reader) => {
      const s = this._state.read(reader);
      if (!s) {
        return void 0;
      }
      const layout = this._editorObs.layoutInfo.read(reader);
      const lineHeight = this._editorObs.getOption(EditorOption.lineHeight).read(reader);
      const bottomPadding = 1;
      const leftPadding = 1;
      const rightPadding = 1;
      const fullViewPort = Rect.fromLeftTopRightBottom(0, 0, layout.width, layout.height - bottomPadding);
      const viewPortWithStickyScroll = fullViewPort.withTop(this._stickyScrollHeight.read(reader));
      const targetVertRange = s.lineOffsetRange.read(reader);
      const targetRect = Rect.fromRanges(OffsetRange.fromTo(leftPadding + layout.glyphMarginLeft, layout.decorationsLeft + layout.decorationsWidth - rightPadding), targetVertRange);
      const pillOffset = this._verticalOffset.read(reader);
      let pillRect = targetRect.withHeight(lineHeight).withWidth(22).translateY(pillOffset);
      const pillRectMoved = pillRect.moveToBeContainedIn(viewPortWithStickyScroll);
      const rect = targetRect;
      pillRect = targetRect.containsRect(pillRectMoved) ? pillRectMoved : pillRectMoved.moveToBeContainedIn(fullViewPort.intersect(targetRect.union(fullViewPort.withHeight(lineHeight))));
      const docked = rect.containsRect(pillRect) && viewPortWithStickyScroll.containsRect(pillRect);
      let iconDirecion = targetRect.containsRect(pillRect) ? "right" : pillRect.top > targetRect.top ? "top" : "bottom";
      let lineNumberRect = pillRect.withWidth(0);
      let iconRect = pillRect;
      if (docked && pillRect.top === targetRect.top + pillOffset) {
        pillRect = pillRect.withWidth(layout.decorationsLeft + layout.decorationsWidth - layout.glyphMarginLeft - leftPadding - rightPadding);
        lineNumberRect = pillRect.intersectHorizontal(new OffsetRange(0, Math.max(layout.lineNumbersLeft + layout.lineNumbersWidth - leftPadding - 1, 0)));
        iconRect = iconRect.translateX(lineNumberRect.width);
      }
      let icon;
      if (docked && (this._isHoveredOverIconDebounced.read(reader) || this._isHoveredOverInlineEditDebounced.read(reader))) {
        icon = renderIcon(Codicon.check);
        iconDirecion = "right";
      } else {
        icon = this._tabAction.read(reader) === InlineEditTabAction.Accept ? renderIcon(Codicon.keyboardTab) : renderIcon(Codicon.arrowRight);
      }
      let rotation = 0;
      switch (iconDirecion) {
        case "right":
          rotation = 0;
          break;
        case "bottom":
          rotation = 90;
          break;
        case "top":
          rotation = -90;
          break;
      }
      return {
        rect,
        icon,
        rotation,
        docked,
        iconRect,
        pillRect,
        lineHeight,
        lineNumberRect
      };
    });
    this._iconRef = n.ref();
    this._hoverVisible = observableValue(this, false);
    this.isHoverVisible = this._hoverVisible;
    this._isHoveredOverIcon = observableValue(this, false);
    this._isHoveredOverIconDebounced = debouncedObservable(this._isHoveredOverIcon, 100);
    this._tabAction = derived(this, (reader) => {
      const model = this._model.read(reader);
      if (!model) {
        return InlineEditTabAction.Inactive;
      }
      return model.tabAction.read(reader);
    });
    this._indicator = n.div({
      class: "inline-edits-view-gutter-indicator",
      onclick: () => {
        const docked = this._layout.map((l) => l && l.docked).get();
        this._editorObs.editor.focus();
        if (docked) {
          this.model.accept();
        } else {
          this.model.jump();
        }
      },
      tabIndex: 0,
      style: {
        position: "absolute",
        overflow: "visible"
      }
    }, mapOutFalsy(this._layout).map((layout) => !layout ? [] : [
      n.div({
        style: {
          position: "absolute",
          background: asCssVariable(inlineEditIndicatorBackground),
          borderRadius: "4px",
          ...rectToProps((reader) => layout.read(reader).rect)
        }
      }),
      n.div({
        class: "icon",
        ref: this._iconRef,
        onmouseenter: () => {
          this._showHover();
        },
        style: {
          cursor: "pointer",
          zIndex: "1000",
          position: "absolute",
          backgroundColor: this._gutterIndicatorStyles.map((v) => v.background),
          ["--vscodeIconForeground"]: this._gutterIndicatorStyles.map((v) => v.foreground),
          border: this._gutterIndicatorStyles.map((v) => `1px solid ${v.border}`),
          boxSizing: "border-box",
          borderRadius: "4px",
          display: "flex",
          justifyContent: "center",
          transition: "background-color 0.2s ease-in-out, width 0.2s ease-in-out",
          ...rectToProps((reader) => layout.read(reader).pillRect)
        }
      }, [
        n.div(
          {
            className: "line-number",
            style: {
              lineHeight: layout.map((l) => `${l.lineHeight}px`),
              display: layout.map((l) => l.lineNumberRect.width > 0 ? "flex" : "none"),
              alignItems: "center",
              justifyContent: "flex-end",
              width: layout.map((l) => l.lineNumberRect.width),
              height: "100%",
              color: this._gutterIndicatorStyles.map((v) => v.foreground)
            }
          },
          this._lineNumberToRender
        ),
        n.div({
          style: {
            rotate: layout.map((i) => `${i.rotation}deg`),
            transition: "rotate 0.2s ease-in-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: layout.map((l) => `${l.iconRect.width}px`)
          }
        }, [
          layout.map((i) => i.icon)
        ])
      ])
    ])).keepUpdated(this._store);
    this._gutterIndicatorStyles = this._tabAction.map((v, reader) => {
      switch (v) {
        case InlineEditTabAction.Inactive:
          return {
            background: getEditorBlendedColor(inlineEditIndicatorSecondaryBackground, themeService).read(reader).toString(),
            foreground: getEditorBlendedColor(inlineEditIndicatorSecondaryForeground, themeService).read(reader).toString(),
            border: getEditorBlendedColor(inlineEditIndicatorSecondaryBorder, themeService).read(reader).toString()
          };
        case InlineEditTabAction.Jump:
          return {
            background: getEditorBlendedColor(inlineEditIndicatorPrimaryBackground, themeService).read(reader).toString(),
            foreground: getEditorBlendedColor(inlineEditIndicatorPrimaryForeground, themeService).read(reader).toString(),
            border: getEditorBlendedColor(inlineEditIndicatorPrimaryBorder, themeService).read(reader).toString()
          };
        case InlineEditTabAction.Accept:
          return {
            background: getEditorBlendedColor(inlineEditIndicatorsuccessfulBackground, themeService).read(reader).toString(),
            foreground: getEditorBlendedColor(inlineEditIndicatorsuccessfulForeground, themeService).read(reader).toString(),
            border: getEditorBlendedColor(inlineEditIndicatorsuccessfulBorder, themeService).read(reader).toString()
          };
      }
    });
    this._register(this._editorObs.createOverlayWidget({
      domNode: this._indicator.element,
      position: constObservable(null),
      allowEditorOverflow: false,
      minContentWidthInPx: constObservable(0)
    }));
    this._register(this._editorObs.editor.onMouseMove((e) => {
      const el = this._iconRef.element;
      const rect = el.getBoundingClientRect();
      const rectangularArea = Rect.fromLeftTopWidthHeight(rect.left, rect.top, rect.width, rect.height);
      const point = new Point(e.event.posx, e.event.posy);
      this._isHoveredOverIcon.set(rectangularArea.containsPoint(point), void 0);
    }));
    this._register(this._editorObs.editor.onDidScrollChange(() => {
      this._isHoveredOverIcon.set(false, void 0);
    }));
    this._isHoveredOverInlineEditDebounced = debouncedObservable(this._isHoveringOverInlineEdit, 100);
    this._register(runOnChange(this._isHoveredOverInlineEditDebounced, (isHovering) => {
      if (isHovering) {
        this._triggerAnimation();
      }
    }));
    if (this._newUserType === "active" /* Active */) {
      this._register(this.setupNewUserExperience());
    }
    this._register(autorun((reader) => {
      this._indicator.readEffect(reader);
      if (this._indicator.element) {
        this._editorObs.editor.applyFontInfo(this._indicator.element);
      }
    }));
    this._register(autorunWithStore((reader, store) => {
      const host = this._host.read(reader);
      if (!host) {
        return;
      }
      store.add(host.onDidAccept(() => {
        this._storageService.store("inlineEditsGutterIndicatorUserKind", "active" /* Active */, StorageScope.APPLICATION, StorageTarget.USER);
      }));
    }));
  }
  get model() {
    const model = this._model.get();
    if (!model) {
      throw new BugIndicatingError("Inline Edit Model not available");
    }
    return model;
  }
  get _newUserType() {
    return this._storageService.get("inlineEditsGutterIndicatorUserKind", StorageScope.APPLICATION, "firstTime" /* FirstTime */);
  }
  set _newUserType(value) {
    switch (value) {
      case "firstTime" /* FirstTime */:
        throw new BugIndicatingError("UserKind should not be set to first time");
      case "secondTime" /* SecondTime */:
        this._firstToSecondTimeUserDisposable.clear();
        break;
      case "active" /* Active */:
        this._newUserAnimationDisposable.clear();
        this._firstToSecondTimeUserDisposable.clear();
        this._secondTimeToActiveUserDisposable.clear();
        break;
    }
    this._storageService.store("inlineEditsGutterIndicatorUserKind", value, StorageScope.APPLICATION, StorageTarget.USER);
  }
  setupNewUserExperience() {
    if (this._newUserType === "active" /* Active */) {
      return Disposable.None;
    }
    const disposableStore = new DisposableStore();
    let userHasHoveredOverIcon = false;
    let inlineEditHasBeenAccepted = false;
    let firstTimeUserAnimationCount = 0;
    let secondTimeUserAnimationCount = 0;
    disposableStore.add(runOnChange(this._activeCompletionId, async (id) => {
      if (id === void 0) {
        return;
      }
      const userType = this._newUserType;
      switch (userType) {
        case "firstTime" /* FirstTime */: {
          for (let i = 0; i < 3 && this._activeCompletionId.get() === id; i++) {
            await this._triggerAnimation();
            await timeout(500);
          }
          break;
        }
        case "secondTime" /* SecondTime */: {
          this._triggerAnimation();
          break;
        }
      }
      switch (userType) {
        case "firstTime" /* FirstTime */: {
          if (++firstTimeUserAnimationCount >= 5 || userHasHoveredOverIcon) {
            this._newUserType = "secondTime" /* SecondTime */;
          }
          break;
        }
        case "secondTime" /* SecondTime */: {
          if (++secondTimeUserAnimationCount >= 5 && inlineEditHasBeenAccepted) {
            this._newUserType = "active" /* Active */;
          }
          break;
        }
      }
    }));
    disposableStore.add(runOnChange(this._isHoveredOverIconDebounced, async (isHovered) => {
      if (isHovered) {
        userHasHoveredOverIcon = true;
      }
    }));
    disposableStore.add(autorunWithStore((reader, store) => {
      const host = this._host.read(reader);
      if (!host) {
        return;
      }
      store.add(host.onDidAccept(() => {
        inlineEditHasBeenAccepted = true;
      }));
    }));
    return disposableStore;
  }
  _triggerAnimation() {
    if (this._accessibilityService.isMotionReduced()) {
      return new Animation(null, null).finished;
    }
    const animation = this._iconRef.element.animate([
      {
        outline: `2px solid ${this._gutterIndicatorStyles.map((v) => v.border).get()}`,
        outlineOffset: "-1px",
        offset: 0
      },
      {
        outline: `2px solid transparent`,
        outlineOffset: "10px",
        offset: 1
      }
    ], { duration: 500 });
    return animation.finished;
  }
  _showHover() {
    if (this._hoverVisible.get()) {
      return;
    }
    const disposableStore = new DisposableStore();
    const content = disposableStore.add(this._instantiationService.createInstance(
      GutterIndicatorMenuContent,
      this.model,
      (focusEditor) => {
        if (focusEditor) {
          this._editorObs.editor.focus();
        }
        h?.dispose();
      },
      this._editorObs
    ).toDisposableLiveElement());
    const focusTracker = disposableStore.add(trackFocus(content.element));
    disposableStore.add(focusTracker.onDidBlur(() => this._focusIsInMenu.set(false, void 0)));
    disposableStore.add(focusTracker.onDidFocus(() => this._focusIsInMenu.set(true, void 0)));
    disposableStore.add(toDisposable(() => this._focusIsInMenu.set(false, void 0)));
    const h = this._hoverService.showInstantHover({
      target: this._iconRef.element,
      content: content.element
    });
    if (h) {
      this._hoverVisible.set(true, void 0);
      disposableStore.add(this._editorObs.editor.onDidScrollChange(() => h.dispose()));
      disposableStore.add(h.onDispose(() => {
        this._hoverVisible.set(false, void 0);
        disposableStore.dispose();
      }));
    } else {
      disposableStore.dispose();
    }
  }
};
InlineEditsGutterIndicator = __decorateClass([
  __decorateParam(7, IHoverService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, IAccessibilityService),
  __decorateParam(11, IThemeService)
], InlineEditsGutterIndicator);
export {
  InlineEditsGutterIndicator
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvY29tcG9uZW50cy9ndXR0ZXJJbmRpY2F0b3JWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbiwgdHJhY2tGb2N1cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgcmVuZGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBJU2V0dGFibGVPYnNlcnZhYmxlLCBhdXRvcnVuLCBhdXRvcnVuV2l0aFN0b3JlLCBjb25zdE9ic2VydmFibGUsIGRlcml2ZWQsIG9ic2VydmFibGVGcm9tRXZlbnQsIG9ic2VydmFibGVWYWx1ZSwgcnVuT25DaGFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGRlYm91bmNlZE9ic2VydmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvdXRpbHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yVXRpbHMuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvck1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IFBvaW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9wb2ludC5qcyc7XG5pbXBvcnQgeyBSZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYnJvd3Nlci9yZWN0LmpzJztcbmltcG9ydCB7IEhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvaG92ZXJTZXJ2aWNlL2hvdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBIb3ZlcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvaG92ZXJTZXJ2aWNlL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiwgUmVuZGVyTGluZU51bWJlcnNUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBPZmZzZXRSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL29mZnNldFJhbmdlLmpzJztcbmltcG9ydCB7IFN0aWNreVNjcm9sbENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zdGlja3lTY3JvbGwvYnJvd3Nlci9zdGlja3lTY3JvbGxDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IElubGluZUVkaXRIb3N0IH0gZnJvbSAnLi4vaW5saW5lRWRpdHNNb2RlbC5qcyc7XG5pbXBvcnQgeyBJSW5saW5lRWRpdE1vZGVsLCBJbmxpbmVFZGl0VGFiQWN0aW9uIH0gZnJvbSAnLi4vaW5saW5lRWRpdHNWaWV3SW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IGdldEVkaXRvckJsZW5kZWRDb2xvciwgaW5saW5lRWRpdEluZGljYXRvckJhY2tncm91bmQsIGlubGluZUVkaXRJbmRpY2F0b3JQcmltYXJ5QmFja2dyb3VuZCwgaW5saW5lRWRpdEluZGljYXRvclByaW1hcnlCb3JkZXIsIGlubGluZUVkaXRJbmRpY2F0b3JQcmltYXJ5Rm9yZWdyb3VuZCwgaW5saW5lRWRpdEluZGljYXRvclNlY29uZGFyeUJhY2tncm91bmQsIGlubGluZUVkaXRJbmRpY2F0b3JTZWNvbmRhcnlCb3JkZXIsIGlubGluZUVkaXRJbmRpY2F0b3JTZWNvbmRhcnlGb3JlZ3JvdW5kLCBpbmxpbmVFZGl0SW5kaWNhdG9yc3VjY2Vzc2Z1bEJhY2tncm91bmQsIGlubGluZUVkaXRJbmRpY2F0b3JzdWNjZXNzZnVsQm9yZGVyLCBpbmxpbmVFZGl0SW5kaWNhdG9yc3VjY2Vzc2Z1bEZvcmVncm91bmQgfSBmcm9tICcuLi90aGVtZS5qcyc7XG5pbXBvcnQgeyBtYXBPdXRGYWxzeSwgcmVjdFRvUHJvcHMgfSBmcm9tICcuLi91dGlscy91dGlscy5qcyc7XG5pbXBvcnQgeyBHdXR0ZXJJbmRpY2F0b3JNZW51Q29udGVudCB9IGZyb20gJy4vZ3V0dGVySW5kaWNhdG9yTWVudS5qcyc7XG5cbi8vIFJlcHJlc2VudHMgdGhlIHVzZXIncyBmYW1pbGlhcml0eSB3aXRoIHRoZSBpbmxpbmUgZWRpdHMgZmVhdHVyZS5cbmVudW0gVXNlcktpbmQge1xuXHRGaXJzdFRpbWUgPSAnZmlyc3RUaW1lJyxcblx0U2Vjb25kVGltZSA9ICdzZWNvbmRUaW1lJyxcblx0QWN0aXZlID0gJ2FjdGl2ZSdcbn1cblxuZXhwb3J0IGNsYXNzIElubGluZUVkaXRzR3V0dGVySW5kaWNhdG9yIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBnZXQgbW9kZWwoKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbC5nZXQoKTtcblx0XHRpZiAoIW1vZGVsKSB7IHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ0lubGluZSBFZGl0IE1vZGVsIG5vdCBhdmFpbGFibGUnKTsgfVxuXHRcdHJldHVybiBtb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGl2ZUNvbXBsZXRpb25JZCA9IGRlcml2ZWQ8c3RyaW5nIHwgdW5kZWZpbmVkPihyZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGxheW91dCA9IHRoaXMuX2xheW91dC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFsYXlvdXQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdGlmICghbW9kZWwpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdHJldHVybiBtb2RlbC5pbmxpbmVFZGl0LmlubGluZUNvbXBsZXRpb24uaWQ7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2d1dHRlckluZGljYXRvclN0eWxlczogSU9ic2VydmFibGU8eyBiYWNrZ3JvdW5kOiBzdHJpbmc7IGZvcmVncm91bmQ6IHN0cmluZzsgYm9yZGVyOiBzdHJpbmcgfT47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2lzSG92ZXJlZE92ZXJJbmxpbmVFZGl0RGVib3VuY2VkOiBJT2JzZXJ2YWJsZTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9uZXdVc2VyQW5pbWF0aW9uRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZmlyc3RUb1NlY29uZFRpbWVVc2VyRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfc2Vjb25kVGltZVRvQWN0aXZlVXNlckRpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cHJpdmF0ZSBnZXQgX25ld1VzZXJUeXBlKCk6IFVzZXJLaW5kIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KCdpbmxpbmVFZGl0c0d1dHRlckluZGljYXRvclVzZXJLaW5kJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBVc2VyS2luZC5GaXJzdFRpbWUpIGFzIFVzZXJLaW5kO1xuXHR9XG5cdHByaXZhdGUgc2V0IF9uZXdVc2VyVHlwZSh2YWx1ZTogVXNlcktpbmQpIHtcblx0XHRzd2l0Y2ggKHZhbHVlKSB7XG5cdFx0XHRjYXNlIFVzZXJLaW5kLkZpcnN0VGltZTpcblx0XHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcignVXNlcktpbmQgc2hvdWxkIG5vdCBiZSBzZXQgdG8gZmlyc3QgdGltZScpO1xuXHRcdFx0Y2FzZSBVc2VyS2luZC5TZWNvbmRUaW1lOlxuXHRcdFx0XHR0aGlzLl9maXJzdFRvU2Vjb25kVGltZVVzZXJEaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBVc2VyS2luZC5BY3RpdmU6XG5cdFx0XHRcdHRoaXMuX25ld1VzZXJBbmltYXRpb25EaXNwb3NhYmxlLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMuX2ZpcnN0VG9TZWNvbmRUaW1lVXNlckRpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy5fc2Vjb25kVGltZVRvQWN0aXZlVXNlckRpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2lubGluZUVkaXRzR3V0dGVySW5kaWNhdG9yVXNlcktpbmQnLCB2YWx1ZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yT2JzOiBPYnNlcnZhYmxlQ29kZUVkaXRvcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbFJhbmdlOiBJT2JzZXJ2YWJsZTxMaW5lUmFuZ2UgfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3ZlcnRpY2FsT2Zmc2V0OiBJT2JzZXJ2YWJsZTxudW1iZXI+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hvc3Q6IElPYnNlcnZhYmxlPElubGluZUVkaXRIb3N0IHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogSU9ic2VydmFibGU8SUlubGluZUVkaXRNb2RlbCB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaXNIb3ZlcmluZ092ZXJJbmxpbmVFZGl0OiBJT2JzZXJ2YWJsZTxib29sZWFuPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1c0lzSW5NZW51OiBJU2V0dGFibGVPYnNlcnZhYmxlPGJvb2xlYW4+LFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSG92ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2d1dHRlckluZGljYXRvclN0eWxlcyA9IHRoaXMuX3RhYkFjdGlvbi5tYXAoKHYsIHJlYWRlcikgPT4ge1xuXHRcdFx0c3dpdGNoICh2KSB7XG5cdFx0XHRcdGNhc2UgSW5saW5lRWRpdFRhYkFjdGlvbi5JbmFjdGl2ZTogcmV0dXJuIHtcblx0XHRcdFx0XHRiYWNrZ3JvdW5kOiBnZXRFZGl0b3JCbGVuZGVkQ29sb3IoaW5saW5lRWRpdEluZGljYXRvclNlY29uZGFyeUJhY2tncm91bmQsIHRoZW1lU2VydmljZSkucmVhZChyZWFkZXIpLnRvU3RyaW5nKCksXG5cdFx0XHRcdFx0Zm9yZWdyb3VuZDogZ2V0RWRpdG9yQmxlbmRlZENvbG9yKGlubGluZUVkaXRJbmRpY2F0b3JTZWNvbmRhcnlGb3JlZ3JvdW5kLCB0aGVtZVNlcnZpY2UpLnJlYWQocmVhZGVyKS50b1N0cmluZygpLFxuXHRcdFx0XHRcdGJvcmRlcjogZ2V0RWRpdG9yQmxlbmRlZENvbG9yKGlubGluZUVkaXRJbmRpY2F0b3JTZWNvbmRhcnlCb3JkZXIsIHRoZW1lU2VydmljZSkucmVhZChyZWFkZXIpLnRvU3RyaW5nKCksXG5cdFx0XHRcdH07XG5cdFx0XHRcdGNhc2UgSW5saW5lRWRpdFRhYkFjdGlvbi5KdW1wOiByZXR1cm4ge1xuXHRcdFx0XHRcdGJhY2tncm91bmQ6IGdldEVkaXRvckJsZW5kZWRDb2xvcihpbmxpbmVFZGl0SW5kaWNhdG9yUHJpbWFyeUJhY2tncm91bmQsIHRoZW1lU2VydmljZSkucmVhZChyZWFkZXIpLnRvU3RyaW5nKCksXG5cdFx0XHRcdFx0Zm9yZWdyb3VuZDogZ2V0RWRpdG9yQmxlbmRlZENvbG9yKGlubGluZUVkaXRJbmRpY2F0b3JQcmltYXJ5Rm9yZWdyb3VuZCwgdGhlbWVTZXJ2aWNlKS5yZWFkKHJlYWRlcikudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRib3JkZXI6IGdldEVkaXRvckJsZW5kZWRDb2xvcihpbmxpbmVFZGl0SW5kaWNhdG9yUHJpbWFyeUJvcmRlciwgdGhlbWVTZXJ2aWNlKS5yZWFkKHJlYWRlcikudG9TdHJpbmcoKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRjYXNlIElubGluZUVkaXRUYWJBY3Rpb24uQWNjZXB0OiByZXR1cm4ge1xuXHRcdFx0XHRcdGJhY2tncm91bmQ6IGdldEVkaXRvckJsZW5kZWRDb2xvcihpbmxpbmVFZGl0SW5kaWNhdG9yc3VjY2Vzc2Z1bEJhY2tncm91bmQsIHRoZW1lU2VydmljZSkucmVhZChyZWFkZXIpLnRvU3RyaW5nKCksXG5cdFx0XHRcdFx0Zm9yZWdyb3VuZDogZ2V0RWRpdG9yQmxlbmRlZENvbG9yKGlubGluZUVkaXRJbmRpY2F0b3JzdWNjZXNzZnVsRm9yZWdyb3VuZCwgdGhlbWVTZXJ2aWNlKS5yZWFkKHJlYWRlcikudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRib3JkZXI6IGdldEVkaXRvckJsZW5kZWRDb2xvcihpbmxpbmVFZGl0SW5kaWNhdG9yc3VjY2Vzc2Z1bEJvcmRlciwgdGhlbWVTZXJ2aWNlKS5yZWFkKHJlYWRlcikudG9TdHJpbmcoKVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yT2JzLmNyZWF0ZU92ZXJsYXlXaWRnZXQoe1xuXHRcdFx0ZG9tTm9kZTogdGhpcy5faW5kaWNhdG9yLmVsZW1lbnQsXG5cdFx0XHRwb3NpdGlvbjogY29uc3RPYnNlcnZhYmxlKG51bGwpLFxuXHRcdFx0YWxsb3dFZGl0b3JPdmVyZmxvdzogZmFsc2UsXG5cdFx0XHRtaW5Db250ZW50V2lkdGhJblB4OiBjb25zdE9ic2VydmFibGUoMCksXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yT2JzLmVkaXRvci5vbk1vdXNlTW92ZSgoZTogSUVkaXRvck1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IGVsID0gdGhpcy5faWNvblJlZi5lbGVtZW50O1xuXHRcdFx0Y29uc3QgcmVjdCA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0Y29uc3QgcmVjdGFuZ3VsYXJBcmVhID0gUmVjdC5mcm9tTGVmdFRvcFdpZHRoSGVpZ2h0KHJlY3QubGVmdCwgcmVjdC50b3AsIHJlY3Qud2lkdGgsIHJlY3QuaGVpZ2h0KTtcblx0XHRcdGNvbnN0IHBvaW50ID0gbmV3IFBvaW50KGUuZXZlbnQucG9zeCwgZS5ldmVudC5wb3N5KTtcblx0XHRcdHRoaXMuX2lzSG92ZXJlZE92ZXJJY29uLnNldChyZWN0YW5ndWxhckFyZWEuY29udGFpbnNQb2ludChwb2ludCksIHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZWRpdG9yT2JzLmVkaXRvci5vbkRpZFNjcm9sbENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9pc0hvdmVyZWRPdmVySWNvbi5zZXQoZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5faXNIb3ZlcmVkT3ZlcklubGluZUVkaXREZWJvdW5jZWQgPSBkZWJvdW5jZWRPYnNlcnZhYmxlKHRoaXMuX2lzSG92ZXJpbmdPdmVySW5saW5lRWRpdCwgMTAwKTtcblxuXHRcdC8vIHB1bHNlIGFuaW1hdGlvbiB3aGVuIGhvdmVyaW5nIGlubGluZSBlZGl0XG5cdFx0dGhpcy5fcmVnaXN0ZXIocnVuT25DaGFuZ2UodGhpcy5faXNIb3ZlcmVkT3ZlcklubGluZUVkaXREZWJvdW5jZWQsIChpc0hvdmVyaW5nKSA9PiB7XG5cdFx0XHRpZiAoaXNIb3ZlcmluZykge1xuXHRcdFx0XHR0aGlzLl90cmlnZ2VyQW5pbWF0aW9uKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKHRoaXMuX25ld1VzZXJUeXBlID09PSBVc2VyS2luZC5BY3RpdmUpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2V0dXBOZXdVc2VyRXhwZXJpZW5jZSgpKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHR0aGlzLl9pbmRpY2F0b3IucmVhZEVmZmVjdChyZWFkZXIpO1xuXHRcdFx0aWYgKHRoaXMuX2luZGljYXRvci5lbGVtZW50KSB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvck9icy5lZGl0b3IuYXBwbHlGb250SW5mbyh0aGlzLl9pbmRpY2F0b3IuZWxlbWVudCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bldpdGhTdG9yZSgocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0Y29uc3QgaG9zdCA9IHRoaXMuX2hvc3QucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFob3N0KSB7IHJldHVybjsgfVxuXHRcdFx0c3RvcmUuYWRkKGhvc3Qub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZSgnaW5saW5lRWRpdHNHdXR0ZXJJbmRpY2F0b3JVc2VyS2luZCcsIFVzZXJLaW5kLkFjdGl2ZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0LlVTRVIpO1xuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0dXBOZXdVc2VyRXhwZXJpZW5jZSgpOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKHRoaXMuX25ld1VzZXJUeXBlID09PSBVc2VyS2luZC5BY3RpdmUpIHtcblx0XHRcdHJldHVybiBEaXNwb3NhYmxlLk5vbmU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0bGV0IHVzZXJIYXNIb3ZlcmVkT3Zlckljb24gPSBmYWxzZTtcblx0XHRsZXQgaW5saW5lRWRpdEhhc0JlZW5BY2NlcHRlZCA9IGZhbHNlO1xuXHRcdGxldCBmaXJzdFRpbWVVc2VyQW5pbWF0aW9uQ291bnQgPSAwO1xuXHRcdGxldCBzZWNvbmRUaW1lVXNlckFuaW1hdGlvbkNvdW50ID0gMDtcblxuXHRcdC8vIHB1bHNlIGFuaW1hdGlvbiBmb3IgbmV3IHVzZXJzXG5cdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZChydW5PbkNoYW5nZSh0aGlzLl9hY3RpdmVDb21wbGV0aW9uSWQsIGFzeW5jIChpZCkgPT4ge1xuXHRcdFx0aWYgKGlkID09PSB1bmRlZmluZWQpIHsgcmV0dXJuOyB9XG5cdFx0XHRjb25zdCB1c2VyVHlwZSA9IHRoaXMuX25ld1VzZXJUeXBlO1xuXG5cdFx0XHQvLyBBbmltYXRpb25cblx0XHRcdHN3aXRjaCAodXNlclR5cGUpIHtcblx0XHRcdFx0Y2FzZSBVc2VyS2luZC5GaXJzdFRpbWU6IHtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDMgJiYgdGhpcy5fYWN0aXZlQ29tcGxldGlvbklkLmdldCgpID09PSBpZDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLl90cmlnZ2VyQW5pbWF0aW9uKCk7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDUwMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgVXNlcktpbmQuU2Vjb25kVGltZToge1xuXHRcdFx0XHRcdHRoaXMuX3RyaWdnZXJBbmltYXRpb24oKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBVc2VyIEtpbmQgVHJhbnNpdGlvblxuXHRcdFx0c3dpdGNoICh1c2VyVHlwZSkge1xuXHRcdFx0XHRjYXNlIFVzZXJLaW5kLkZpcnN0VGltZToge1xuXHRcdFx0XHRcdGlmICgrK2ZpcnN0VGltZVVzZXJBbmltYXRpb25Db3VudCA+PSA1IHx8IHVzZXJIYXNIb3ZlcmVkT3Zlckljb24pIHtcblx0XHRcdFx0XHRcdHRoaXMuX25ld1VzZXJUeXBlID0gVXNlcktpbmQuU2Vjb25kVGltZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSBVc2VyS2luZC5TZWNvbmRUaW1lOiB7XG5cdFx0XHRcdFx0aWYgKCsrc2Vjb25kVGltZVVzZXJBbmltYXRpb25Db3VudCA+PSA1ICYmIGlubGluZUVkaXRIYXNCZWVuQWNjZXB0ZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX25ld1VzZXJUeXBlID0gVXNlcktpbmQuQWN0aXZlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIFJlbWVtYmVyIHdoZW4gdGhlIHVzZXIgaGFzIGhvdmVyZWQgb3ZlciB0aGUgaWNvblxuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQocnVuT25DaGFuZ2UodGhpcy5faXNIb3ZlcmVkT3Zlckljb25EZWJvdW5jZWQsIGFzeW5jIChpc0hvdmVyZWQpID0+IHtcblx0XHRcdGlmIChpc0hvdmVyZWQpIHtcblx0XHRcdFx0dXNlckhhc0hvdmVyZWRPdmVySWNvbiA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVtZW1iZXIgd2hlbiB0aGUgdXNlciBoYXMgYWNjZXB0ZWQgYW4gaW5saW5lIGVkaXRcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGF1dG9ydW5XaXRoU3RvcmUoKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdGNvbnN0IGhvc3QgPSB0aGlzLl9ob3N0LnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghaG9zdCkgeyByZXR1cm47IH1cblx0XHRcdHN0b3JlLmFkZChob3N0Lm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdFx0aW5saW5lRWRpdEhhc0JlZW5BY2NlcHRlZCA9IHRydWU7XG5cdFx0XHR9KSk7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVTdG9yZTtcblx0fVxuXG5cdHByaXZhdGUgX3RyaWdnZXJBbmltYXRpb24oKTogUHJvbWlzZTxBbmltYXRpb24+IHtcblx0XHRpZiAodGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNNb3Rpb25SZWR1Y2VkKCkpIHtcblx0XHRcdHJldHVybiBuZXcgQW5pbWF0aW9uKG51bGwsIG51bGwpLmZpbmlzaGVkO1xuXHRcdH1cblx0XHQvLyBXSUdHTEUgQU5JTUFUSU9OOlxuXHRcdC8qIHRoaXMuX2ljb25SZWYuZWxlbWVudC5hbmltYXRlKFtcblx0XHRcdHsgdHJhbnNmb3JtOiAncm90YXRlKDApIHNjYWxlKDEpJywgb2Zmc2V0OiAwIH0sXG5cdFx0XHR7IHRyYW5zZm9ybTogJ3JvdGF0ZSgxNC40ZGVnKSBzY2FsZSgxLjEpJywgb2Zmc2V0OiAwLjE1IH0sXG5cdFx0XHR7IHRyYW5zZm9ybTogJ3JvdGF0ZSgtMTQuNGRlZykgc2NhbGUoMS4yKScsIG9mZnNldDogMC4zIH0sXG5cdFx0XHR7IHRyYW5zZm9ybTogJ3JvdGF0ZSgxNC40ZGVnKSBzY2FsZSgxLjEpJywgb2Zmc2V0OiAwLjQ1IH0sXG5cdFx0XHR7IHRyYW5zZm9ybTogJ3JvdGF0ZSgtMTQuNGRlZykgc2NhbGUoMS4yKScsIG9mZnNldDogMC42IH0sXG5cdFx0XHR7IHRyYW5zZm9ybTogJ3JvdGF0ZSgwKSBzY2FsZSgxKScsIG9mZnNldDogMSB9XG5cdFx0XSwgeyBkdXJhdGlvbjogODAwIH0pOyAqL1xuXG5cdFx0Ly8gUFVMU0UgQU5JTUFUSU9OOlxuXHRcdGNvbnN0IGFuaW1hdGlvbiA9IHRoaXMuX2ljb25SZWYuZWxlbWVudC5hbmltYXRlKFtcblx0XHRcdHtcblx0XHRcdFx0b3V0bGluZTogYDJweCBzb2xpZCAke3RoaXMuX2d1dHRlckluZGljYXRvclN0eWxlcy5tYXAodiA9PiB2LmJvcmRlcikuZ2V0KCl9YCxcblx0XHRcdFx0b3V0bGluZU9mZnNldDogJy0xcHgnLFxuXHRcdFx0XHRvZmZzZXQ6IDBcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG91dGxpbmU6IGAycHggc29saWQgdHJhbnNwYXJlbnRgLFxuXHRcdFx0XHRvdXRsaW5lT2Zmc2V0OiAnMTBweCcsXG5cdFx0XHRcdG9mZnNldDogMVxuXHRcdFx0fSxcblx0XHRdLCB7IGR1cmF0aW9uOiA1MDAgfSk7XG5cblx0XHRyZXR1cm4gYW5pbWF0aW9uLmZpbmlzaGVkO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3JpZ2luYWxSYW5nZU9icyA9IG1hcE91dEZhbHN5KHRoaXMuX29yaWdpbmFsUmFuZ2UpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRlID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdGNvbnN0IHJhbmdlID0gdGhpcy5fb3JpZ2luYWxSYW5nZU9icy5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFyYW5nZSkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJhbmdlLFxuXHRcdFx0bGluZU9mZnNldFJhbmdlOiB0aGlzLl9lZGl0b3JPYnMub2JzZXJ2ZUxpbmVPZmZzZXRSYW5nZShyYW5nZSwgdGhpcy5fc3RvcmUpLFxuXHRcdH07XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0aWNreVNjcm9sbENvbnRyb2xsZXIgPSBTdGlja3lTY3JvbGxDb250cm9sbGVyLmdldCh0aGlzLl9lZGl0b3JPYnMuZWRpdG9yKTtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RpY2t5U2Nyb2xsSGVpZ2h0ID0gdGhpcy5fc3RpY2t5U2Nyb2xsQ29udHJvbGxlclxuXHRcdD8gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLl9zdGlja3lTY3JvbGxDb250cm9sbGVyLm9uRGlkQ2hhbmdlU3RpY2t5U2Nyb2xsSGVpZ2h0LCAoKSA9PiB0aGlzLl9zdGlja3lTY3JvbGxDb250cm9sbGVyIS5zdGlja3lTY3JvbGxXaWRnZXRIZWlnaHQpXG5cdFx0OiBjb25zdE9ic2VydmFibGUoMCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGluZU51bWJlclRvUmVuZGVyID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGlmICh0aGlzLl92ZXJ0aWNhbE9mZnNldC5yZWFkKHJlYWRlcikgIT09IDApIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRjb25zdCBsaW5lTnVtYmVyID0gdGhpcy5fb3JpZ2luYWxSYW5nZS5yZWFkKHJlYWRlcik/LnN0YXJ0TGluZU51bWJlcjtcblx0XHRjb25zdCBsaW5lTnVtYmVyT3B0aW9ucyA9IHRoaXMuX2VkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVOdW1iZXJzKS5yZWFkKHJlYWRlcik7XG5cblx0XHRpZiAobGluZU51bWJlciA9PT0gdW5kZWZpbmVkIHx8IGxpbmVOdW1iZXJPcHRpb25zLnJlbmRlclR5cGUgPT09IFJlbmRlckxpbmVOdW1iZXJzVHlwZS5PZmYpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRpZiAobGluZU51bWJlck9wdGlvbnMucmVuZGVyVHlwZSA9PT0gUmVuZGVyTGluZU51bWJlcnNUeXBlLkludGVydmFsKSB7XG5cdFx0XHRjb25zdCBjdXJzb3JQb3NpdGlvbiA9IHRoaXMuX2VkaXRvck9icy5jdXJzb3JQb3NpdGlvbi5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAobGluZU51bWJlciAlIDEwID09PSAwIHx8IGN1cnNvclBvc2l0aW9uICYmIGN1cnNvclBvc2l0aW9uLmxpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIpIHtcblx0XHRcdFx0cmV0dXJuIGxpbmVOdW1iZXIudG9TdHJpbmcoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRpZiAobGluZU51bWJlck9wdGlvbnMucmVuZGVyVHlwZSA9PT0gUmVuZGVyTGluZU51bWJlcnNUeXBlLlJlbGF0aXZlKSB7XG5cdFx0XHRjb25zdCBjdXJzb3JQb3NpdGlvbiA9IHRoaXMuX2VkaXRvck9icy5jdXJzb3JQb3NpdGlvbi5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIWN1cnNvclBvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlbGF0aXZlTGluZU51bWJlciA9IE1hdGguYWJzKGxpbmVOdW1iZXIgLSBjdXJzb3JQb3NpdGlvbi5saW5lTnVtYmVyKTtcblx0XHRcdGlmIChyZWxhdGl2ZUxpbmVOdW1iZXIgPT09IDApIHtcblx0XHRcdFx0cmV0dXJuIGxpbmVOdW1iZXIudG9TdHJpbmcoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZWxhdGl2ZUxpbmVOdW1iZXIudG9TdHJpbmcoKTtcblx0XHR9XG5cblx0XHRpZiAobGluZU51bWJlck9wdGlvbnMucmVuZGVyVHlwZSA9PT0gUmVuZGVyTGluZU51bWJlcnNUeXBlLkN1c3RvbSkge1xuXHRcdFx0aWYgKGxpbmVOdW1iZXJPcHRpb25zLnJlbmRlckZuKSB7XG5cdFx0XHRcdHJldHVybiBsaW5lTnVtYmVyT3B0aW9ucy5yZW5kZXJGbihsaW5lTnVtYmVyKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRyZXR1cm4gbGluZU51bWJlci50b1N0cmluZygpO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sYXlvdXQgPSBkZXJpdmVkKHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgcyA9IHRoaXMuX3N0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIXMpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0Y29uc3QgbGF5b3V0ID0gdGhpcy5fZWRpdG9yT2JzLmxheW91dEluZm8ucmVhZChyZWFkZXIpO1xuXG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuX2VkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCBib3R0b21QYWRkaW5nID0gMTtcblx0XHRjb25zdCBsZWZ0UGFkZGluZyA9IDE7XG5cdFx0Y29uc3QgcmlnaHRQYWRkaW5nID0gMTtcblxuXHRcdC8vIEVudGlyZSBlZGl0b3IgYXJlYSB3aXRob3V0IHN0aWNreSBzY3JvbGxcblx0XHRjb25zdCBmdWxsVmlld1BvcnQgPSBSZWN0LmZyb21MZWZ0VG9wUmlnaHRCb3R0b20oMCwgMCwgbGF5b3V0LndpZHRoLCBsYXlvdXQuaGVpZ2h0IC0gYm90dG9tUGFkZGluZyk7XG5cdFx0Y29uc3Qgdmlld1BvcnRXaXRoU3RpY2t5U2Nyb2xsID0gZnVsbFZpZXdQb3J0LndpdGhUb3AodGhpcy5fc3RpY2t5U2Nyb2xsSGVpZ2h0LnJlYWQocmVhZGVyKSk7XG5cblx0XHQvLyBUaGUgZ2x5cGggbWFyZ2luIGFyZWEgYWNyb3NzIGFsbCByZWxldmFudCBsaW5lc1xuXHRcdGNvbnN0IHRhcmdldFZlcnRSYW5nZSA9IHMubGluZU9mZnNldFJhbmdlLnJlYWQocmVhZGVyKTtcblx0XHRjb25zdCB0YXJnZXRSZWN0ID0gUmVjdC5mcm9tUmFuZ2VzKE9mZnNldFJhbmdlLmZyb21UbyhsZWZ0UGFkZGluZyArIGxheW91dC5nbHlwaE1hcmdpbkxlZnQsIGxheW91dC5kZWNvcmF0aW9uc0xlZnQgKyBsYXlvdXQuZGVjb3JhdGlvbnNXaWR0aCAtIHJpZ2h0UGFkZGluZyksIHRhcmdldFZlcnRSYW5nZSk7XG5cblx0XHQvLyBUaGUgZ3V0dGVyIHZpZXcgY29udGFpbmVyIChwaWxsKVxuXHRcdGNvbnN0IHBpbGxPZmZzZXQgPSB0aGlzLl92ZXJ0aWNhbE9mZnNldC5yZWFkKHJlYWRlcik7XG5cdFx0bGV0IHBpbGxSZWN0ID0gdGFyZ2V0UmVjdC53aXRoSGVpZ2h0KGxpbmVIZWlnaHQpLndpdGhXaWR0aCgyMikudHJhbnNsYXRlWShwaWxsT2Zmc2V0KTtcblx0XHRjb25zdCBwaWxsUmVjdE1vdmVkID0gcGlsbFJlY3QubW92ZVRvQmVDb250YWluZWRJbih2aWV3UG9ydFdpdGhTdGlja3lTY3JvbGwpO1xuXG5cdFx0Y29uc3QgcmVjdCA9IHRhcmdldFJlY3Q7XG5cblx0XHQvLyBNb3ZlIHBpbGwgdG8gYmUgaW4gdmlld3BvcnQgaWYgaXQgaXMgbm90XG5cdFx0cGlsbFJlY3QgPSAodGFyZ2V0UmVjdC5jb250YWluc1JlY3QocGlsbFJlY3RNb3ZlZCkpXG5cdFx0XHQ/IHBpbGxSZWN0TW92ZWRcblx0XHRcdDogcGlsbFJlY3RNb3ZlZC5tb3ZlVG9CZUNvbnRhaW5lZEluKGZ1bGxWaWV3UG9ydC5pbnRlcnNlY3QodGFyZ2V0UmVjdC51bmlvbihmdWxsVmlld1BvcnQud2l0aEhlaWdodChsaW5lSGVpZ2h0KSkpISk7IC8vdmlld1BvcnRXaXRoU3RpY2t5U2Nyb2xsLmludGVyc2VjdChyZWN0KSE7XG5cblx0XHQvLyBkb2NrZWQgPSBwaWxsIHdhcyBhbHJlYWR5IGluIHRoZSB2aWV3cG9ydFxuXHRcdGNvbnN0IGRvY2tlZCA9IHJlY3QuY29udGFpbnNSZWN0KHBpbGxSZWN0KSAmJiB2aWV3UG9ydFdpdGhTdGlja3lTY3JvbGwuY29udGFpbnNSZWN0KHBpbGxSZWN0KTtcblx0XHRsZXQgaWNvbkRpcmVjaW9uID0gdGFyZ2V0UmVjdC5jb250YWluc1JlY3QocGlsbFJlY3QpID9cblx0XHRcdCdyaWdodCcgYXMgY29uc3Rcblx0XHRcdDogcGlsbFJlY3QudG9wID4gdGFyZ2V0UmVjdC50b3AgP1xuXHRcdFx0XHQndG9wJyBhcyBjb25zdCA6XG5cdFx0XHRcdCdib3R0b20nIGFzIGNvbnN0O1xuXG5cdFx0Ly8gR3JvdyBpY29uIHRoZSB0aGUgd2hvbGUgZ2x5cGggbWFyZ2luIGFyZWEgaWYgaXQgaXMgZG9ja2VkXG5cdFx0bGV0IGxpbmVOdW1iZXJSZWN0ID0gcGlsbFJlY3Qud2l0aFdpZHRoKDApO1xuXHRcdGxldCBpY29uUmVjdCA9IHBpbGxSZWN0O1xuXHRcdGlmIChkb2NrZWQgJiYgcGlsbFJlY3QudG9wID09PSB0YXJnZXRSZWN0LnRvcCArIHBpbGxPZmZzZXQpIHtcblx0XHRcdHBpbGxSZWN0ID0gcGlsbFJlY3Qud2l0aFdpZHRoKGxheW91dC5kZWNvcmF0aW9uc0xlZnQgKyBsYXlvdXQuZGVjb3JhdGlvbnNXaWR0aCAtIGxheW91dC5nbHlwaE1hcmdpbkxlZnQgLSBsZWZ0UGFkZGluZyAtIHJpZ2h0UGFkZGluZyk7XG5cdFx0XHRsaW5lTnVtYmVyUmVjdCA9IHBpbGxSZWN0LmludGVyc2VjdEhvcml6b250YWwobmV3IE9mZnNldFJhbmdlKDAsIE1hdGgubWF4KGxheW91dC5saW5lTnVtYmVyc0xlZnQgKyBsYXlvdXQubGluZU51bWJlcnNXaWR0aCAtIGxlZnRQYWRkaW5nIC0gMSwgMCkpKTtcblx0XHRcdGljb25SZWN0ID0gaWNvblJlY3QudHJhbnNsYXRlWChsaW5lTnVtYmVyUmVjdC53aWR0aCk7XG5cdFx0fVxuXG5cdFx0bGV0IGljb247XG5cdFx0aWYgKGRvY2tlZCAmJiAodGhpcy5faXNIb3ZlcmVkT3Zlckljb25EZWJvdW5jZWQucmVhZChyZWFkZXIpIHx8IHRoaXMuX2lzSG92ZXJlZE92ZXJJbmxpbmVFZGl0RGVib3VuY2VkLnJlYWQocmVhZGVyKSkpIHtcblx0XHRcdGljb24gPSByZW5kZXJJY29uKENvZGljb24uY2hlY2spO1xuXHRcdFx0aWNvbkRpcmVjaW9uID0gJ3JpZ2h0Jztcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWNvbiA9IHRoaXMuX3RhYkFjdGlvbi5yZWFkKHJlYWRlcikgPT09IElubGluZUVkaXRUYWJBY3Rpb24uQWNjZXB0ID8gcmVuZGVySWNvbihDb2RpY29uLmtleWJvYXJkVGFiKSA6IHJlbmRlckljb24oQ29kaWNvbi5hcnJvd1JpZ2h0KTtcblx0XHR9XG5cblx0XHRsZXQgcm90YXRpb24gPSAwO1xuXHRcdHN3aXRjaCAoaWNvbkRpcmVjaW9uKSB7XG5cdFx0XHRjYXNlICdyaWdodCc6IHJvdGF0aW9uID0gMDsgYnJlYWs7XG5cdFx0XHRjYXNlICdib3R0b20nOiByb3RhdGlvbiA9IDkwOyBicmVhaztcblx0XHRcdGNhc2UgJ3RvcCc6IHJvdGF0aW9uID0gLTkwOyBicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVjdCxcblx0XHRcdGljb24sXG5cdFx0XHRyb3RhdGlvbixcblx0XHRcdGRvY2tlZCxcblx0XHRcdGljb25SZWN0LFxuXHRcdFx0cGlsbFJlY3QsXG5cdFx0XHRsaW5lSGVpZ2h0LFxuXHRcdFx0bGluZU51bWJlclJlY3QsXG5cdFx0fTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaWNvblJlZiA9IG4ucmVmPEhUTUxEaXZFbGVtZW50PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ob3ZlclZpc2libGUgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXHRwdWJsaWMgcmVhZG9ubHkgaXNIb3ZlclZpc2libGU6IElPYnNlcnZhYmxlPGJvb2xlYW4+ID0gdGhpcy5faG92ZXJWaXNpYmxlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc0hvdmVyZWRPdmVySWNvbiA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCBmYWxzZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2lzSG92ZXJlZE92ZXJJY29uRGVib3VuY2VkOiBJT2JzZXJ2YWJsZTxib29sZWFuPiA9IGRlYm91bmNlZE9ic2VydmFibGUodGhpcy5faXNIb3ZlcmVkT3Zlckljb24sIDEwMCk7XG5cblx0cHJpdmF0ZSBfc2hvd0hvdmVyKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9ob3ZlclZpc2libGUuZ2V0KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY29udGVudCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRHdXR0ZXJJbmRpY2F0b3JNZW51Q29udGVudCxcblx0XHRcdHRoaXMubW9kZWwsXG5cdFx0XHQoZm9jdXNFZGl0b3IpID0+IHtcblx0XHRcdFx0aWYgKGZvY3VzRWRpdG9yKSB7XG5cdFx0XHRcdFx0dGhpcy5fZWRpdG9yT2JzLmVkaXRvci5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGg/LmRpc3Bvc2UoKTtcblx0XHRcdH0sXG5cdFx0XHR0aGlzLl9lZGl0b3JPYnMsXG5cdFx0KS50b0Rpc3Bvc2FibGVMaXZlRWxlbWVudCgpKTtcblxuXHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQodHJhY2tGb2N1cyhjb250ZW50LmVsZW1lbnQpKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4gdGhpcy5fZm9jdXNJc0luTWVudS5zZXQoZmFsc2UsIHVuZGVmaW5lZCkpKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHRoaXMuX2ZvY3VzSXNJbk1lbnUuc2V0KHRydWUsIHVuZGVmaW5lZCkpKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9mb2N1c0lzSW5NZW51LnNldChmYWxzZSwgdW5kZWZpbmVkKSkpO1xuXG5cdFx0Y29uc3QgaCA9IHRoaXMuX2hvdmVyU2VydmljZS5zaG93SW5zdGFudEhvdmVyKHtcblx0XHRcdHRhcmdldDogdGhpcy5faWNvblJlZi5lbGVtZW50LFxuXHRcdFx0Y29udGVudDogY29udGVudC5lbGVtZW50LFxuXHRcdH0pIGFzIEhvdmVyV2lkZ2V0IHwgdW5kZWZpbmVkO1xuXHRcdGlmIChoKSB7XG5cdFx0XHR0aGlzLl9ob3ZlclZpc2libGUuc2V0KHRydWUsIHVuZGVmaW5lZCk7XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX2VkaXRvck9icy5lZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UoKCkgPT4gaC5kaXNwb3NlKCkpKTtcblx0XHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQoaC5vbkRpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9ob3ZlclZpc2libGUuc2V0KGZhbHNlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3RhYkFjdGlvbiA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIW1vZGVsKSB7IHJldHVybiBJbmxpbmVFZGl0VGFiQWN0aW9uLkluYWN0aXZlOyB9XG5cdFx0cmV0dXJuIG1vZGVsLnRhYkFjdGlvbi5yZWFkKHJlYWRlcik7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2luZGljYXRvciA9IG4uZGl2KHtcblx0XHRjbGFzczogJ2lubGluZS1lZGl0cy12aWV3LWd1dHRlci1pbmRpY2F0b3InLFxuXHRcdG9uY2xpY2s6ICgpID0+IHtcblx0XHRcdGNvbnN0IGRvY2tlZCA9IHRoaXMuX2xheW91dC5tYXAobCA9PiBsICYmIGwuZG9ja2VkKS5nZXQoKTtcblx0XHRcdHRoaXMuX2VkaXRvck9icy5lZGl0b3IuZm9jdXMoKTtcblx0XHRcdGlmIChkb2NrZWQpIHtcblx0XHRcdFx0dGhpcy5tb2RlbC5hY2NlcHQoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubW9kZWwuanVtcCgpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0dGFiSW5kZXg6IDAsXG5cdFx0c3R5bGU6IHtcblx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0b3ZlcmZsb3c6ICd2aXNpYmxlJyxcblx0XHR9LFxuXHR9LCBtYXBPdXRGYWxzeSh0aGlzLl9sYXlvdXQpLm1hcChsYXlvdXQgPT4gIWxheW91dCA/IFtdIDogW1xuXHRcdG4uZGl2KHtcblx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0XHRiYWNrZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKGlubGluZUVkaXRJbmRpY2F0b3JCYWNrZ3JvdW5kKSxcblx0XHRcdFx0Ym9yZGVyUmFkaXVzOiAnNHB4Jyxcblx0XHRcdFx0Li4ucmVjdFRvUHJvcHMocmVhZGVyID0+IGxheW91dC5yZWFkKHJlYWRlcikucmVjdCksXG5cdFx0XHR9XG5cdFx0fSksXG5cdFx0bi5kaXYoe1xuXHRcdFx0Y2xhc3M6ICdpY29uJyxcblx0XHRcdHJlZjogdGhpcy5faWNvblJlZixcblx0XHRcdG9ubW91c2VlbnRlcjogKCkgPT4ge1xuXHRcdFx0XHQvLyBUT0RPIHNob3cgaG92ZXIgd2hlbiBob3ZlcmluZyBnaG9zdCB0ZXh0IGV0Yy5cblx0XHRcdFx0dGhpcy5fc2hvd0hvdmVyKCk7XG5cdFx0XHR9LFxuXHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0Y3Vyc29yOiAncG9pbnRlcicsXG5cdFx0XHRcdHpJbmRleDogJzEwMDAnLFxuXHRcdFx0XHRwb3NpdGlvbjogJ2Fic29sdXRlJyxcblx0XHRcdFx0YmFja2dyb3VuZENvbG9yOiB0aGlzLl9ndXR0ZXJJbmRpY2F0b3JTdHlsZXMubWFwKHYgPT4gdi5iYWNrZ3JvdW5kKSxcblx0XHRcdFx0WyctLXZzY29kZUljb25Gb3JlZ3JvdW5kJyBhcyBhbnldOiB0aGlzLl9ndXR0ZXJJbmRpY2F0b3JTdHlsZXMubWFwKHYgPT4gdi5mb3JlZ3JvdW5kKSxcblx0XHRcdFx0Ym9yZGVyOiB0aGlzLl9ndXR0ZXJJbmRpY2F0b3JTdHlsZXMubWFwKHYgPT4gYDFweCBzb2xpZCAke3YuYm9yZGVyfWApLFxuXHRcdFx0XHRib3hTaXppbmc6ICdib3JkZXItYm94Jyxcblx0XHRcdFx0Ym9yZGVyUmFkaXVzOiAnNHB4Jyxcblx0XHRcdFx0ZGlzcGxheTogJ2ZsZXgnLFxuXHRcdFx0XHRqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXG5cdFx0XHRcdHRyYW5zaXRpb246ICdiYWNrZ3JvdW5kLWNvbG9yIDAuMnMgZWFzZS1pbi1vdXQsIHdpZHRoIDAuMnMgZWFzZS1pbi1vdXQnLFxuXHRcdFx0XHQuLi5yZWN0VG9Qcm9wcyhyZWFkZXIgPT4gbGF5b3V0LnJlYWQocmVhZGVyKS5waWxsUmVjdCksXG5cdFx0XHR9XG5cdFx0fSwgW1xuXHRcdFx0bi5kaXYoe1xuXHRcdFx0XHRjbGFzc05hbWU6ICdsaW5lLW51bWJlcicsXG5cdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0bGluZUhlaWdodDogbGF5b3V0Lm1hcChsID0+IGAke2wubGluZUhlaWdodH1weGApLFxuXHRcdFx0XHRcdGRpc3BsYXk6IGxheW91dC5tYXAobCA9PiBsLmxpbmVOdW1iZXJSZWN0LndpZHRoID4gMCA/ICdmbGV4JyA6ICdub25lJyksXG5cdFx0XHRcdFx0YWxpZ25JdGVtczogJ2NlbnRlcicsXG5cdFx0XHRcdFx0anVzdGlmeUNvbnRlbnQ6ICdmbGV4LWVuZCcsXG5cdFx0XHRcdFx0d2lkdGg6IGxheW91dC5tYXAobCA9PiBsLmxpbmVOdW1iZXJSZWN0LndpZHRoKSxcblx0XHRcdFx0XHRoZWlnaHQ6ICcxMDAlJyxcblx0XHRcdFx0XHRjb2xvcjogdGhpcy5fZ3V0dGVySW5kaWNhdG9yU3R5bGVzLm1hcCh2ID0+IHYuZm9yZWdyb3VuZCksXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRcdHRoaXMuX2xpbmVOdW1iZXJUb1JlbmRlclxuXHRcdFx0KSxcblx0XHRcdG4uZGl2KHtcblx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRyb3RhdGU6IGxheW91dC5tYXAoaSA9PiBgJHtpLnJvdGF0aW9ufWRlZ2ApLFxuXHRcdFx0XHRcdHRyYW5zaXRpb246ICdyb3RhdGUgMC4ycyBlYXNlLWluLW91dCcsXG5cdFx0XHRcdFx0ZGlzcGxheTogJ2ZsZXgnLFxuXHRcdFx0XHRcdGFsaWduSXRlbXM6ICdjZW50ZXInLFxuXHRcdFx0XHRcdGp1c3RpZnlDb250ZW50OiAnY2VudGVyJyxcblx0XHRcdFx0XHRoZWlnaHQ6ICcxMDAlJyxcblx0XHRcdFx0XHR3aWR0aDogbGF5b3V0Lm1hcChsID0+IGAke2wuaWNvblJlY3Qud2lkdGh9cHhgKSxcblx0XHRcdFx0fVxuXHRcdFx0fSwgW1xuXHRcdFx0XHRsYXlvdXQubWFwKGkgPT4gaS5pY29uKSxcblx0XHRcdF0pXG5cdFx0XSksXG5cdF0pKS5rZWVwVXBkYXRlZCh0aGlzLl9zdG9yZSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsR0FBRyxrQkFBa0I7QUFDOUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLFlBQVksaUJBQThCLG1CQUFtQixvQkFBb0I7QUFDMUYsU0FBMkMsU0FBUyxrQkFBa0IsaUJBQWlCLFNBQVMscUJBQXFCLGlCQUFpQixtQkFBbUI7QUFDekosU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxxQkFBcUI7QUFHOUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsWUFBWTtBQUdyQixTQUFTLGNBQWMsNkJBQTZCO0FBRXBELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsOEJBQThCO0FBRXZDLFNBQTJCLDJCQUEyQjtBQUN0RCxTQUFTLHVCQUF1QiwrQkFBK0Isc0NBQXNDLGtDQUFrQyxzQ0FBc0Msd0NBQXdDLG9DQUFvQyx3Q0FBd0MseUNBQXlDLHFDQUFxQywrQ0FBK0M7QUFDOVosU0FBUyxhQUFhLG1CQUFtQjtBQUN6QyxTQUFTLGtDQUFrQztBQUczQyxJQUFLLFdBQUwsa0JBQUtBLGNBQUw7QUFDQyxFQUFBQSxVQUFBLGVBQVk7QUFDWixFQUFBQSxVQUFBLGdCQUFhO0FBQ2IsRUFBQUEsVUFBQSxZQUFTO0FBSEwsU0FBQUE7QUFBQSxHQUFBO0FBTUUsSUFBTSw2QkFBTixjQUF5QyxXQUFXO0FBQUEsRUEyQzFELFlBQ2tCLFlBQ0EsZ0JBQ0EsaUJBQ0EsT0FDQSxRQUNBLDJCQUNBLGdCQUNlLGVBQ1EsdUJBQ04saUJBQ00sdUJBQ3pCLGNBQ2Q7QUFDRCxVQUFNO0FBYlc7QUFDQTtB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
