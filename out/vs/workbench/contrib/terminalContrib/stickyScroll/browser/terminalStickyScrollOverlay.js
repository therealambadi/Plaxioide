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
import { $, addDisposableListener, addStandardDisposableListener, getWindow } from "../../../../../base/browser/dom.js";
import { throttle } from "../../../../../base/common/decorators.js";
import { Event } from "../../../../../base/common/event.js";
import { Disposable, MutableDisposable, combinedDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { removeAnsiEscapeCodes } from "../../../../../base/common/strings.js";
import "./media/stickyScroll.css";
import { localize } from "../../../../../nls.js";
import { IMenuService, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { ITerminalConfigurationService } from "../../../terminal/browser/terminal.js";
import { openContextMenu } from "../../../terminal/browser/terminalContextMenu.js";
import { TERMINAL_CONFIG_SECTION, TerminalCommandId } from "../../../terminal/common/terminal.js";
import { terminalStrings } from "../../../terminal/common/terminalStrings.js";
import { TerminalStickyScrollSettingId } from "../common/terminalStickyScrollConfiguration.js";
import { terminalStickyScrollBackground, terminalStickyScrollHoverBackground } from "./terminalStickyScrollColorRegistry.js";
import { XtermAddonImporter } from "../../../terminal/browser/xterm/xtermAddonImporter.js";
var OverlayState = /* @__PURE__ */ ((OverlayState2) => {
  OverlayState2[OverlayState2["Off"] = 0] = "Off";
  OverlayState2[OverlayState2["On"] = 1] = "On";
  return OverlayState2;
})(OverlayState || {});
var CssClasses = /* @__PURE__ */ ((CssClasses2) => {
  CssClasses2["Visible"] = "visible";
  return CssClasses2;
})(CssClasses || {});
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["StickyScrollPercentageCap"] = 0.4] = "StickyScrollPercentageCap";
  return Constants2;
})(Constants || {});
let TerminalStickyScrollOverlay = class extends Disposable {
  constructor(_instance, _xterm, _xtermColorProvider, _commandDetection, xtermCtor, configurationService, contextKeyService, _contextMenuService, _keybindingService, menuService, _terminalConfigurationService, _themeService) {
    super();
    this._instance = _instance;
    this._xterm = _xterm;
    this._xtermColorProvider = _xtermColorProvider;
    this._commandDetection = _commandDetection;
    this._contextMenuService = _contextMenuService;
    this._keybindingService = _keybindingService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._themeService = _themeService;
    this._xtermAddonLoader = new XtermAddonImporter();
    this._refreshListeners = this._register(new MutableDisposable());
    this._state = 0 /* Off */;
    this._isRefreshQueued = false;
    this._rawMaxLineCount = 5;
    this._contextMenu = this._register(menuService.createMenu(MenuId.TerminalStickyScrollContext, contextKeyService));
    this._register(Event.runAndSubscribe(this._xterm.raw.buffer.onBufferChange, (buffer) => {
      this._setState((buffer ?? this._xterm.raw.buffer.active).type === "normal" ? 1 /* On */ : 0 /* Off */);
    }));
    this._register(Event.runAndSubscribe(configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(TerminalStickyScrollSettingId.MaxLineCount)) {
        this._rawMaxLineCount = configurationService.getValue(TerminalStickyScrollSettingId.MaxLineCount);
      }
    }));
    this._register(this._instance.onDidChangeTarget(() => this._syncOptions()));
    xtermCtor.then((ctor) => {
      if (this._store.isDisposed) {
        return;
      }
      this._stickyScrollOverlay = this._register(new ctor({
        rows: 1,
        cols: this._xterm.raw.cols,
        allowProposedApi: true,
        ...this._getOptions()
      }));
      this._refreshGpuAcceleration();
      this._register(configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(TERMINAL_CONFIG_SECTION)) {
          this._syncOptions();
        }
      }));
      this._register(this._themeService.onDidColorThemeChange(() => {
        this._syncOptions();
      }));
      this._register(this._xterm.raw.onResize(() => {
        this._syncOptions();
        this._refresh();
      }));
      this._register(this._instance.onDidChangeVisibility((isVisible) => {
        if (isVisible) {
          this._refresh();
        }
      }));
      this._xtermAddonLoader.importAddon("serialize").then((SerializeAddon) => {
        if (this._store.isDisposed) {
          return;
        }
        this._serializeAddon = this._register(new SerializeAddon());
        this._xterm.raw.loadAddon(this._serializeAddon);
        this._refresh();
      });
    });
  }
  lockHide() {
    this._element?.classList.add("lock-hide");
  }
  unlockHide() {
    this._element?.classList.remove("lock-hide");
  }
  _setState(state) {
    if (this._state === state) {
      return;
    }
    switch (state) {
      case 0 /* Off */: {
        this._setVisible(false);
        this._uninstallRefreshListeners();
        break;
      }
      case 1 /* On */: {
        this._refresh();
        this._installRefreshListeners();
        break;
      }
    }
  }
  _installRefreshListeners() {
    if (!this._refreshListeners.value) {
      this._refreshListeners.value = combinedDisposable(
        Event.any(
          this._xterm.raw.onScroll,
          this._xterm.raw.onLineFeed,
          // Rarely an update may be required after just a cursor move, like when
          // scrolling horizontally in a pager
          this._xterm.raw.onCursorMove
        )(() => this._refresh()),
        addStandardDisposableListener(this._xterm.raw.element.querySelector(".xterm-viewport"), "scroll", () => this._refresh())
      );
    }
  }
  _uninstallRefreshListeners() {
    this._refreshListeners.clear();
  }
  _setVisible(isVisible) {
    if (isVisible) {
      this._ensureElement();
    }
    this._element?.classList.toggle("visible" /* Visible */, isVisible);
  }
  _refresh() {
    if (this._isRefreshQueued) {
      return;
    }
    this._isRefreshQueued = true;
    queueMicrotask(() => {
      this._refreshNow();
      this._isRefreshQueued = false;
    });
  }
  _refreshNow() {
    const command = this._commandDetection.getCommandForLine(this._xterm.raw.buffer.active.viewportY);
    this._currentStickyCommand = void 0;
    if (!command) {
      this._setVisible(false);
      return;
    }
    if (!("marker" in command)) {
      const partialCommand = this._commandDetection.currentCommand;
      if (partialCommand?.commandStartMarker && partialCommand.commandExecutedMarker) {
        this._updateContent(partialCommand, partialCommand.commandStartMarker);
        return;
      }
      this._setVisible(false);
      return;
    }
    const marker = command.marker;
    if (!marker || marker.line === -1) {
      this._setVisible(false);
      return;
    }
    this._updateContent(command, marker);
  }
  _updateContent(command, startMarker) {
    const xterm = this._xterm.raw;
    if (!xterm.element?.parentElement || !this._stickyScrollOverlay || !this._serializeAddon) {
      return;
    }
    if (command.promptStartMarker?.line === -1) {
      this._setVisible(false);
      return;
    }
    const buffer = xterm.buffer.active;
    const promptRowCount = command.getPromptRowCount();
    const commandRowCount = command.getCommandRowCount();
    const stickyScrollLineStart = startMarker.line - (promptRowCount - 1);
    const isPartialCommand = !("getOutput" in command);
    const rowOffset = !isPartialCommand && command.endMarker ? Math.max(buffer.viewportY - command.endMarker.line + 1, 0) : 0;
    const maxLineCount = Math.min(this._rawMaxLineCount, Math.floor(xterm.rows * 0.4 /* StickyScrollPercentageCap */));
    const stickyScrollLineCount = Math.min(promptRowCount + commandRowCount - 1, maxLineCount) - rowOffset;
    const isTruncated = stickyScrollLineCount < promptRowCount + commandRowCount - 1;
    if (buffer.viewportY <= stickyScrollLineStart) {
      this._setVisible(false);
      return;
    }
    if (isPartialCommand && buffer.viewportY === buffer.baseY && buffer.cursorY === xterm.rows - 1) {
      const line = buffer.getLine(buffer.baseY + xterm.rows - 1);
      if (buffer.cursorX === 1 && lineStartsWith(line, ":") || buffer.cursorX === 5 && lineStartsWith(line, "(END)")) {
        this._setVisible(false);
        return;
      }
    }
    const content = this._serializeAddon.serialize({
      range: {
        start: stickyScrollLineStart + rowOffset,
        end: stickyScrollLineStart + rowOffset + Math.max(stickyScrollLineCount - 1, 0)
      }
    }) + (isTruncated ? "\x1B[0m \u2026" : "");
    if (isPartialCommand && removeAnsiEscapeCodes(content).length === 0) {
      this._setVisible(false);
      return;
    }
    if (content && this._currentContent !== content || this._stickyScrollOverlay.cols !== xterm.cols || this._stickyScrollOverlay.rows !== stickyScrollLineCount) {
      this._stickyScrollOverlay.resize(this._stickyScrollOverlay.cols, stickyScrollLineCount);
      this._stickyScrollOverlay.write("\x1B[0m\x1B[H\x1B[2J");
      this._stickyScrollOverlay.write(content);
      this._currentContent = content;
    }
    if (content) {
      this._currentStickyCommand = command;
      this._setVisible(true);
      if (this._element) {
        const termBox = xterm.element.getBoundingClientRect();
        if (termBox.height > 0) {
          const rowHeight = termBox.height / xterm.rows;
          const overlayHeight = stickyScrollLineCount * rowHeight;
          let endMarkerOffset = 0;
          if (!isPartialCommand && command.endMarker && command.endMarker.line !== -1) {
            if (buffer.viewportY + stickyScrollLineCount > command.endMarker.line) {
              const diff = buffer.viewportY + stickyScrollLineCount - command.endMarker.line;
              endMarkerOffset = diff * rowHeight;
            }
          }
          this._element.style.bottom = `${termBox.height - overlayHeight + 1 + endMarkerOffset}px`;
        }
      }
    } else {
      this._setVisible(false);
    }
  }
  _ensureElement() {
    if (
      // The element is already created
      this._element || // If the overlay is yet to be created, the terminal cannot be opened so defer to next call
      !this._stickyScrollOverlay || // The xterm.js instance isn't opened yet
      !this._xterm?.raw.element?.parentElement
    ) {
      return;
    }
    const overlay = this._stickyScrollOverlay;
    const hoverOverlay = $(".hover-overlay");
    this._element = $(".terminal-sticky-scroll", void 0, hoverOverlay);
    this._xterm.raw.element.parentElement.append(this._element);
    this._register(toDisposable(() => this._element?.remove()));
    let hoverTitle = localize("stickyScrollHoverTitle", "Navigate to Command");
    const scrollToPreviousCommandKeybinding = this._keybindingService.lookupKeybinding(TerminalCommandId.ScrollToPreviousCommand);
    if (scrollToPreviousCommandKeybinding) {
      const label = scrollToPreviousCommandKeybinding.getLabel();
      if (label) {
        hoverTitle += "\n" + localize("labelWithKeybinding", "{0} ({1})", terminalStrings.scrollToPreviousCommand.value, label);
      }
    }
    const scrollToNextCommandKeybinding = this._keybindingService.lookupKeybinding(TerminalCommandId.ScrollToNextCommand);
    if (scrollToNextCommandKeybinding) {
      const label = scrollToNextCommandKeybinding.getLabel();
      if (label) {
        hoverTitle += "\n" + localize("labelWithKeybinding", "{0} ({1})", terminalStrings.scrollToNextCommand.value, label);
      }
    }
    hoverOverlay.title = hoverTitle;
    const scrollBarWidth = this._xterm.raw._core.viewport?.scrollBarWidth;
    if (scrollBarWidth !== void 0) {
      this._element.style.right = `${scrollBarWidth}px`;
    }
    this._stickyScrollOverlay.open(this._element);
    this._xtermAddonLoader.importAddon("ligatures").then((LigaturesAddon) => {
      if (this._store.isDisposed || !this._stickyScrollOverlay) {
        return;
      }
      this._ligaturesAddon = new LigaturesAddon();
      this._stickyScrollOverlay.loadAddon(this._ligaturesAddon);
    });
    this._register(addStandardDisposableListener(hoverOverlay, "click", () => {
      if (this._xterm && this._currentStickyCommand) {
        this._xterm.markTracker.revealCommand(this._currentStickyCommand);
        this._instance.focus();
      }
    }));
    this._register(addStandardDisposableListener(hoverOverlay, "wheel", (e) => this._xterm?.raw.element?.dispatchEvent(new WheelEvent(e.type, e))));
    this._register(addDisposableListener(hoverOverlay, "mousedown", (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
    }));
    this._register(addDisposableListener(hoverOverlay, "contextmenu", (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
      openContextMenu(getWindow(hoverOverlay), e, this._instance, this._contextMenu, this._contextMenuService);
    }));
    this._register(addStandardDisposableListener(hoverOverlay, "mouseover", () => overlay.options.theme = this._getTheme(true)));
    this._register(addStandardDisposableListener(hoverOverlay, "mouseleave", () => overlay.options.theme = this._getTheme(false)));
  }
  _syncOptions() {
    if (!this._stickyScrollOverlay) {
      return;
    }
    this._stickyScrollOverlay.resize(this._xterm.raw.cols, this._stickyScrollOverlay.rows);
    this._stickyScrollOverlay.options = this._getOptions();
    this._refreshGpuAcceleration();
  }
  _getOptions() {
    const o = this._xterm.raw.options;
    return {
      cursorInactiveStyle: "none",
      scrollback: 0,
      logLevel: "off",
      theme: this._getTheme(false),
      documentOverride: o.documentOverride,
      fontFamily: o.fontFamily,
      fontWeight: o.fontWeight,
      fontWeightBold: o.fontWeightBold,
      fontSize: o.fontSize,
      letterSpacing: o.letterSpacing,
      lineHeight: o.lineHeight,
      drawBoldTextInBrightColors: o.drawBoldTextInBrightColors,
      minimumContrastRatio: o.minimumContrastRatio,
      tabStopWidth: o.tabStopWidth,
      customGlyphs: o.customGlyphs
    };
  }
  async _refreshGpuAcceleration() {
    if (this._shouldLoadWebgl() && !this._webglAddon) {
      const WebglAddon = await this._xtermAddonLoader.importAddon("webgl");
      if (this._store.isDisposed) {
        return;
      }
      this._webglAddon = this._register(new WebglAddon());
      this._stickyScrollOverlay?.loadAddon(this._webglAddon);
    } else if (!this._shouldLoadWebgl() && this._webglAddon) {
      this._webglAddon.dispose();
      this._webglAddon = void 0;
    }
  }
  _shouldLoadWebgl() {
    return this._terminalConfigurationService.config.gpuAcceleration === "auto" || this._terminalConfigurationService.config.gpuAcceleration === "on";
  }
  _getTheme(isHovering) {
    const theme = this._themeService.getColorTheme();
    return {
      ...this._xterm.getXtermTheme(),
      background: isHovering ? theme.getColor(terminalStickyScrollHoverBackground)?.toString() ?? this._xtermColorProvider.getBackgroundColor(theme)?.toString() : theme.getColor(terminalStickyScrollBackground)?.toString() ?? this._xtermColorProvider.getBackgroundColor(theme)?.toString(),
      selectionBackground: void 0,
      selectionInactiveBackground: void 0
    };
  }
};
__decorateClass([
  throttle(0)
], TerminalStickyScrollOverlay.prototype, "_syncOptions", 1);
__decorateClass([
  throttle(0)
], TerminalStickyScrollOverlay.prototype, "_refreshGpuAcceleration", 1);
TerminalStickyScrollOverlay = __decorateClass([
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, ITerminalConfigurationService),
  __decorateParam(11, IThemeService)
], TerminalStickyScrollOverlay);
function lineStartsWith(line, text) {
  if (!line) {
    return false;
  }
  for (let i = 0; i < text.length; i++) {
    if (line.getCell(i)?.getChars() !== text[i]) {
      return false;
    }
  }
  return true;
}
export {
  TerminalStickyScrollOverlay
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3RpY2t5U2Nyb2xsL2Jyb3dzZXIvdGVybWluYWxTdGlja3lTY3JvbGxPdmVybGF5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgeyBTZXJpYWxpemVBZGRvbiBhcyBTZXJpYWxpemVBZGRvblR5cGUgfSBmcm9tICdAeHRlcm0vYWRkb24tc2VyaWFsaXplJztcbmltcG9ydCB0eXBlIHsgV2ViZ2xBZGRvbiBhcyBXZWJnbEFkZG9uVHlwZSB9IGZyb20gJ0B4dGVybS9hZGRvbi13ZWJnbCc7XG5pbXBvcnQgdHlwZSB7IExpZ2F0dXJlc0FkZG9uIGFzIExpZ2F0dXJlc0FkZG9uVHlwZSB9IGZyb20gJ0B4dGVybS9hZGRvbi1saWdhdHVyZXMnO1xuaW1wb3J0IHR5cGUgeyBJQnVmZmVyTGluZSwgSU1hcmtlciwgSVRlcm1pbmFsT3B0aW9ucywgSVRoZW1lLCBUZXJtaW5hbCBhcyBSYXdYdGVybVRlcm1pbmFsLCBUZXJtaW5hbCBhcyBYVGVybVRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIsIGdldFdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgdGhyb3R0bGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIGNvbWJpbmVkRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHJlbW92ZUFuc2lFc2NhcGVDb2RlcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0ICcuL21lZGlhL3N0aWNreVNjcm9sbC5jc3MnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU1lbnUsIElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZERldGVjdGlvbkNhcGFiaWxpdHksIElUZXJtaW5hbENvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBJQ3VycmVudFBhcnRpYWxDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jb21tYW5kRGV0ZWN0aW9uL3Rlcm1pbmFsQ29tbWFuZC5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSwgSVRlcm1pbmFsSW5zdGFuY2UsIElYdGVybUNvbG9yUHJvdmlkZXIsIElYdGVybVRlcm1pbmFsIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBvcGVuQ29udGV4dE1lbnUgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsQ29udGV4dE1lbnUuanMnO1xuaW1wb3J0IHsgSVh0ZXJtQ29yZSB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIveHRlcm0tcHJpdmF0ZS5qcyc7XG5pbXBvcnQgeyBURVJNSU5BTF9DT05GSUdfU0VDVElPTiwgVGVybWluYWxDb21tYW5kSWQgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgdGVybWluYWxTdHJpbmdzIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsU3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFN0aWNreVNjcm9sbFNldHRpbmdJZCB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbFN0aWNreVNjcm9sbENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgdGVybWluYWxTdGlja3lTY3JvbGxCYWNrZ3JvdW5kLCB0ZXJtaW5hbFN0aWNreVNjcm9sbEhvdmVyQmFja2dyb3VuZCB9IGZyb20gJy4vdGVybWluYWxTdGlja3lTY3JvbGxDb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFh0ZXJtQWRkb25JbXBvcnRlciB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIveHRlcm0veHRlcm1BZGRvbkltcG9ydGVyLmpzJztcblxuY29uc3QgZW51bSBPdmVybGF5U3RhdGUge1xuXHQvKiogSW5pdGlhbCBzdGF0ZS9kaXNhYmxlZCBieSB0aGUgYWx0IGJ1ZmZlci4gKi9cblx0T2ZmID0gMCxcblx0T24gPSAxXG59XG5cbmNvbnN0IGVudW0gQ3NzQ2xhc3NlcyB7XG5cdFZpc2libGUgPSAndmlzaWJsZSdcbn1cblxuY29uc3QgZW51bSBDb25zdGFudHMge1xuXHRTdGlja3lTY3JvbGxQZXJjZW50YWdlQ2FwID0gMC40XG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbFN0aWNreVNjcm9sbE92ZXJsYXkgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfc3RpY2t5U2Nyb2xsT3ZlcmxheT86IFJhd1h0ZXJtVGVybWluYWw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfeHRlcm1BZGRvbkxvYWRlciA9IG5ldyBYdGVybUFkZG9uSW1wb3J0ZXIoKTtcblx0cHJpdmF0ZSBfc2VyaWFsaXplQWRkb24/OiBTZXJpYWxpemVBZGRvblR5cGU7XG5cdHByaXZhdGUgX3dlYmdsQWRkb24/OiBXZWJnbEFkZG9uVHlwZTtcblx0cHJpdmF0ZSBfbGlnYXR1cmVzQWRkb24/OiBMaWdhdHVyZXNBZGRvblR5cGU7XG5cblx0cHJpdmF0ZSBfZWxlbWVudD86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9jdXJyZW50U3RpY2t5Q29tbWFuZD86IElUZXJtaW5hbENvbW1hbmQgfCBJQ3VycmVudFBhcnRpYWxDb21tYW5kO1xuXHRwcml2YXRlIF9jdXJyZW50Q29udGVudD86IHN0cmluZztcblx0cHJpdmF0ZSBfY29udGV4dE1lbnU6IElNZW51O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlZnJlc2hMaXN0ZW5lcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cHJpdmF0ZSBfc3RhdGU6IE92ZXJsYXlTdGF0ZSA9IE92ZXJsYXlTdGF0ZS5PZmY7XG5cdHByaXZhdGUgX2lzUmVmcmVzaFF1ZXVlZCA9IGZhbHNlO1xuXHRwcml2YXRlIF9yYXdNYXhMaW5lQ291bnQ6IG51bWJlciA9IDU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3h0ZXJtOiBJWHRlcm1UZXJtaW5hbCAmIHsgcmF3OiBSYXdYdGVybVRlcm1pbmFsIH0sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfeHRlcm1Db2xvclByb3ZpZGVyOiBJWHRlcm1Db2xvclByb3ZpZGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmREZXRlY3Rpb246IElDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSxcblx0XHR4dGVybUN0b3I6IFByb21pc2U8dHlwZW9mIFhUZXJtVGVybWluYWw+LFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2NvbnRleHRNZW51ID0gdGhpcy5fcmVnaXN0ZXIobWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuVGVybWluYWxTdGlja3lTY3JvbGxDb250ZXh0LCBjb250ZXh0S2V5U2VydmljZSkpO1xuXG5cdFx0Ly8gT25seSBzaG93IHN0aWNreSBzY3JvbGwgaW4gdGhlIG5vcm1hbCBidWZmZXJcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5feHRlcm0ucmF3LmJ1ZmZlci5vbkJ1ZmZlckNoYW5nZSwgYnVmZmVyID0+IHtcblx0XHRcdHRoaXMuX3NldFN0YXRlKChidWZmZXIgPz8gdGhpcy5feHRlcm0ucmF3LmJ1ZmZlci5hY3RpdmUpLnR5cGUgPT09ICdub3JtYWwnID8gT3ZlcmxheVN0YXRlLk9uIDogT3ZlcmxheVN0YXRlLk9mZik7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVhY3QgdG8gY29uZmlndXJhdGlvbiBjaGFuZ2VzXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbiwgZSA9PiB7XG5cdFx0XHRpZiAoIWUgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFN0aWNreVNjcm9sbFNldHRpbmdJZC5NYXhMaW5lQ291bnQpKSB7XG5cdFx0XHRcdHRoaXMuX3Jhd01heExpbmVDb3VudCA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU3RpY2t5U2Nyb2xsU2V0dGluZ0lkLk1heExpbmVDb3VudCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVhY3QgdG8gdGVybWluYWwgbG9jYXRpb24gY2hhbmdlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbmNlLm9uRGlkQ2hhbmdlVGFyZ2V0KCgpID0+IHRoaXMuX3N5bmNPcHRpb25zKCkpKTtcblxuXHRcdC8vIEVhZ2VybHkgY3JlYXRlIHRoZSBvdmVybGF5XG5cdFx0eHRlcm1DdG9yLnRoZW4oY3RvciA9PiB7XG5cdFx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IGN0b3Ioe1xuXHRcdFx0XHRyb3dzOiAxLFxuXHRcdFx0XHRjb2xzOiB0aGlzLl94dGVybS5yYXcuY29scyxcblx0XHRcdFx0YWxsb3dQcm9wb3NlZEFwaTogdHJ1ZSxcblx0XHRcdFx0Li4udGhpcy5fZ2V0T3B0aW9ucygpXG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWZyZXNoR3B1QWNjZWxlcmF0aW9uKCk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVEVSTUlOQUxfQ09ORklHX1NFQ1RJT04pKSB7XG5cdFx0XHRcdFx0dGhpcy5fc3luY09wdGlvbnMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3N5bmNPcHRpb25zKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl94dGVybS5yYXcub25SZXNpemUoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9zeW5jT3B0aW9ucygpO1xuXHRcdFx0XHR0aGlzLl9yZWZyZXNoKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW5jZS5vbkRpZENoYW5nZVZpc2liaWxpdHkoaXNWaXNpYmxlID0+IHtcblx0XHRcdFx0aWYgKGlzVmlzaWJsZSkge1xuXHRcdFx0XHRcdHRoaXMuX3JlZnJlc2goKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl94dGVybUFkZG9uTG9hZGVyLmltcG9ydEFkZG9uKCdzZXJpYWxpemUnKS50aGVuKFNlcmlhbGl6ZUFkZG9uID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fc2VyaWFsaXplQWRkb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgU2VyaWFsaXplQWRkb24oKSk7XG5cdFx0XHRcdHRoaXMuX3h0ZXJtLnJhdy5sb2FkQWRkb24odGhpcy5fc2VyaWFsaXplQWRkb24pO1xuXHRcdFx0XHQvLyBUcmlnZ2VyIGEgcmVuZGVyIGFzIHRoZSBzZXJpYWxpemUgYWRkb24gaXMgcmVxdWlyZWQgdG8gcmVuZGVyXG5cdFx0XHRcdHRoaXMuX3JlZnJlc2goKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0bG9ja0hpZGUoKSB7XG5cdFx0dGhpcy5fZWxlbWVudD8uY2xhc3NMaXN0LmFkZCgnbG9jay1oaWRlJyk7XG5cdH1cblxuXHR1bmxvY2tIaWRlKCkge1xuXHRcdHRoaXMuX2VsZW1lbnQ/LmNsYXNzTGlzdC5yZW1vdmUoJ2xvY2staGlkZScpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0U3RhdGUoc3RhdGU6IE92ZXJsYXlTdGF0ZSkge1xuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gc3RhdGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3dpdGNoIChzdGF0ZSkge1xuXHRcdFx0Y2FzZSBPdmVybGF5U3RhdGUuT2ZmOiB7XG5cdFx0XHRcdHRoaXMuX3NldFZpc2libGUoZmFsc2UpO1xuXHRcdFx0XHR0aGlzLl91bmluc3RhbGxSZWZyZXNoTGlzdGVuZXJzKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBPdmVybGF5U3RhdGUuT246IHtcblx0XHRcdFx0dGhpcy5fcmVmcmVzaCgpO1xuXHRcdFx0XHR0aGlzLl9pbnN0YWxsUmVmcmVzaExpc3RlbmVycygpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9pbnN0YWxsUmVmcmVzaExpc3RlbmVycygpIHtcblx0XHRpZiAoIXRoaXMuX3JlZnJlc2hMaXN0ZW5lcnMudmFsdWUpIHtcblx0XHRcdHRoaXMuX3JlZnJlc2hMaXN0ZW5lcnMudmFsdWUgPSBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHRcdEV2ZW50LmFueShcblx0XHRcdFx0XHR0aGlzLl94dGVybS5yYXcub25TY3JvbGwsXG5cdFx0XHRcdFx0dGhpcy5feHRlcm0ucmF3Lm9uTGluZUZlZWQsXG5cdFx0XHRcdFx0Ly8gUmFyZWx5IGFuIHVwZGF0ZSBtYXkgYmUgcmVxdWlyZWQgYWZ0ZXIganVzdCBhIGN1cnNvciBtb3ZlLCBsaWtlIHdoZW5cblx0XHRcdFx0XHQvLyBzY3JvbGxpbmcgaG9yaXpvbnRhbGx5IGluIGEgcGFnZXJcblx0XHRcdFx0XHR0aGlzLl94dGVybS5yYXcub25DdXJzb3JNb3ZlLFxuXHRcdFx0XHQpKCgpID0+IHRoaXMuX3JlZnJlc2goKSksXG5cdFx0XHRcdGFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX3h0ZXJtLnJhdy5lbGVtZW50IS5xdWVyeVNlbGVjdG9yKCcueHRlcm0tdmlld3BvcnQnKSEsICdzY3JvbGwnLCAoKSA9PiB0aGlzLl9yZWZyZXNoKCkpLFxuXHRcdFx0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91bmluc3RhbGxSZWZyZXNoTGlzdGVuZXJzKCkge1xuXHRcdHRoaXMuX3JlZnJlc2hMaXN0ZW5lcnMuY2xlYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldFZpc2libGUoaXNWaXNpYmxlOiBib29sZWFuKSB7XG5cdFx0aWYgKGlzVmlzaWJsZSkge1xuXHRcdFx0dGhpcy5fZW5zdXJlRWxlbWVudCgpO1xuXHRcdH1cblx0XHR0aGlzLl9lbGVtZW50Py5jbGFzc0xpc3QudG9nZ2xlKENzc0NsYXNzZXMuVmlzaWJsZSwgaXNWaXNpYmxlKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZnJlc2goKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2lzUmVmcmVzaFF1ZXVlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9pc1JlZnJlc2hRdWV1ZWQgPSB0cnVlO1xuXHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdHRoaXMuX3JlZnJlc2hOb3coKTtcblx0XHRcdHRoaXMuX2lzUmVmcmVzaFF1ZXVlZCA9IGZhbHNlO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVmcmVzaE5vdygpOiB2b2lkIHtcblx0XHRjb25zdCBjb21tYW5kID0gdGhpcy5fY29tbWFuZERldGVjdGlvbi5nZXRDb21tYW5kRm9yTGluZSh0aGlzLl94dGVybS5yYXcuYnVmZmVyLmFjdGl2ZS52aWV3cG9ydFkpO1xuXG5cdFx0Ly8gVGhlIGNvbW1hbmQgZnJvbSB2aWV3cG9ydFkgKyAxIGlzIHVzZWQgYmVjYXVzZSB0aGlzIG9uZSB3aWxsIG5vdCBiZSBvYnNjdXJlZCBieSBzdGlja3lcblx0XHQvLyBzY3JvbGwuXG5cdFx0dGhpcy5fY3VycmVudFN0aWNreUNvbW1hbmQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBObyBjb21tYW5kXG5cdFx0aWYgKCFjb21tYW5kKSB7XG5cdFx0XHR0aGlzLl9zZXRWaXNpYmxlKGZhbHNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBQYXJ0aWFsIGNvbW1hbmRcblx0XHRpZiAoISgnbWFya2VyJyBpbiBjb21tYW5kKSkge1xuXHRcdFx0Y29uc3QgcGFydGlhbENvbW1hbmQgPSB0aGlzLl9jb21tYW5kRGV0ZWN0aW9uLmN1cnJlbnRDb21tYW5kO1xuXHRcdFx0aWYgKHBhcnRpYWxDb21tYW5kPy5jb21tYW5kU3RhcnRNYXJrZXIgJiYgcGFydGlhbENvbW1hbmQuY29tbWFuZEV4ZWN1dGVkTWFya2VyKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUNvbnRlbnQocGFydGlhbENvbW1hbmQsIHBhcnRpYWxDb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlcik7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3NldFZpc2libGUoZmFsc2UpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZSBtYXJrZXIgZG9lc24ndCBleGlzdCBvciBpdCB3YXMgdHJpbW1lZCBmcm9tIHNjcm9sbGJhY2tcblx0XHRjb25zdCBtYXJrZXIgPSBjb21tYW5kLm1hcmtlcjtcblx0XHRpZiAoIW1hcmtlciB8fCBtYXJrZXIubGluZSA9PT0gLTEpIHtcblx0XHRcdC8vIFRPRE86IEl0IHdvdWxkIGJlIG5pY2UgaWYgd2Uga2VwdCB0aGUgY2FjaGVkIGNvbW1hbmQgYXJvdW5kIGV2ZW4gaWYgaXQgd2FzIHRyaW1tZWRcblx0XHRcdC8vIGZyb20gc2Nyb2xsYmFja1xuXHRcdFx0dGhpcy5fc2V0VmlzaWJsZShmYWxzZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fdXBkYXRlQ29udGVudChjb21tYW5kLCBtYXJrZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlQ29udGVudChjb21tYW5kOiBJVGVybWluYWxDb21tYW5kIHwgSUN1cnJlbnRQYXJ0aWFsQ29tbWFuZCwgc3RhcnRNYXJrZXI6IElNYXJrZXIpIHtcblx0XHRjb25zdCB4dGVybSA9IHRoaXMuX3h0ZXJtLnJhdztcblx0XHRpZiAoIXh0ZXJtLmVsZW1lbnQ/LnBhcmVudEVsZW1lbnQgfHwgIXRoaXMuX3N0aWNreVNjcm9sbE92ZXJsYXkgfHwgIXRoaXMuX3NlcmlhbGl6ZUFkZG9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gSGlkZSBzdGlja3kgc2Nyb2xsIGlmIHRoZSBwcm9tcHQgaGFzIGJlZW4gdHJpbW1lZCBmcm9tIHRoZSBidWZmZXJcblx0XHRpZiAoY29tbWFuZC5wcm9tcHRTdGFydE1hcmtlcj8ubGluZSA9PT0gLTEpIHtcblx0XHRcdHRoaXMuX3NldFZpc2libGUoZmFsc2UpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIERldGVybWluZSBzdGlja3kgc2Nyb2xsIGxpbmUgY291bnRcblx0XHRjb25zdCBidWZmZXIgPSB4dGVybS5idWZmZXIuYWN0aXZlO1xuXHRcdGNvbnN0IHByb21wdFJvd0NvdW50ID0gY29tbWFuZC5nZXRQcm9tcHRSb3dDb3VudCgpO1xuXHRcdGNvbnN0IGNvbW1hbmRSb3dDb3VudCA9IGNvbW1hbmQuZ2V0Q29tbWFuZFJvd0NvdW50KCk7XG5cdFx0Y29uc3Qgc3RpY2t5U2Nyb2xsTGluZVN0YXJ0ID0gc3RhcnRNYXJrZXIubGluZSAtIChwcm9tcHRSb3dDb3VudCAtIDEpO1xuXG5cdFx0Ly8gQ2FsY3VsYXRlIHRoZSByb3cgb2Zmc2V0LCB0aGlzIGlzIHRoZSBudW1iZXIgb2Ygcm93cyB0aGF0IHdpbGwgYmUgY2xpcHBlZCBmcm9tIHRoZSB0b3Bcblx0XHQvLyBvZiB0aGUgc3RpY2t5IG92ZXJsYXkgYmVjYXVzZSB3ZSBkbyBub3Qgd2FudCB0byBzaG93IGFueSBjb250ZW50IGFib3ZlIHRoZSBib3VuZHMgb2YgdGhlXG5cdFx0Ly8gb3JpZ2luYWwgdGVybWluYWwuIFRoaXMgaXMgZG9uZSBiZWNhdXNlIGl0IHNlZW1zIGxpa2Ugc2Nyb2xsaW5nIGZsaWNrZXJzIG1vcmUgd2hlbiBhXG5cdFx0Ly8gcGFydGlhbCBsaW5lIGNhbiBiZSBkcmF3biBvbiB0aGUgdG9wLlxuXHRcdGNvbnN0IGlzUGFydGlhbENvbW1hbmQgPSAhKCdnZXRPdXRwdXQnIGluIGNvbW1hbmQpO1xuXHRcdGNvbnN0IHJvd09mZnNldCA9ICFpc1BhcnRpYWxDb21tYW5kICYmIGNvbW1hbmQuZW5kTWFya2VyID8gTWF0aC5tYXgoYnVmZmVyLnZpZXdwb3J0WSAtIGNvbW1hbmQuZW5kTWFya2VyLmxpbmUgKyAxLCAwKSA6IDA7XG5cdFx0Y29uc3QgbWF4TGluZUNvdW50ID0gTWF0aC5taW4odGhpcy5fcmF3TWF4TGluZUNvdW50LCBNYXRoLmZsb29yKHh0ZXJtLnJvd3MgKiBDb25zdGFudHMuU3RpY2t5U2Nyb2xsUGVyY2VudGFnZUNhcCkpO1xuXHRcdGNvbnN0IHN0aWNreVNjcm9sbExpbmVDb3VudCA9IE1hdGgubWluKHByb21wdFJvd0NvdW50ICsgY29tbWFuZFJvd0NvdW50IC0gMSwgbWF4TGluZUNvdW50KSAtIHJvd09mZnNldDtcblx0XHRjb25zdCBpc1RydW5jYXRlZCA9IHN0aWNreVNjcm9sbExpbmVDb3VudCA8IHByb21wdFJvd0NvdW50ICsgY29tbWFuZFJvd0NvdW50IC0gMTtcblxuXHRcdC8vIEhpZGUgc3RpY2t5IHNjcm9sbCBpZiBpdCdzIGN1cnJlbnRseSBvbiBhIGxpbmUgdGhhdCBjb250YWlucyBpdFxuXHRcdGlmIChidWZmZXIudmlld3BvcnRZIDw9IHN0aWNreVNjcm9sbExpbmVTdGFydCkge1xuXHRcdFx0dGhpcy5fc2V0VmlzaWJsZShmYWxzZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gSGlkZSBzdGlja3kgc2Nyb2xsIGZvciB0aGUgcGFydGlhbCBjb21tYW5kIGlmIGl0IGxvb2tzIGxpa2UgdGhlcmUgaXMgYSBwYWdlciBsaWtlIGBsZXNzYFxuXHRcdC8vIG9yIGBnaXQgbG9nYCBhY3RpdmUuIFRoaXMgaXMgZG9uZSBieSBjaGVja2luZyBpZiB0aGUgYm90dG9tIGxlZnQgY2VsbCBjb250YWlucyB0aGUgOlxuXHRcdC8vIGNoYXJhY3RlciBhbmQgdGhlIGN1cnNvciBpcyBpbW1lZGlhdGVseSB0byBpdHMgcmlnaHQuIFRoaXMgaW1wcm92ZXMgdGhlIGJlaGF2aW9yIG9mIGFcblx0XHQvLyBjb21tb24gY2FzZSB3aGVyZSB0aGUgdG9wIG9mIHRoZSB0ZXh0IGJlaW5nIHZpZXdwb3J0IHdvdWxkIG90aGVyd2lzZSBiZSBvYnNjdXJlZC5cblx0XHRpZiAoaXNQYXJ0aWFsQ29tbWFuZCAmJiBidWZmZXIudmlld3BvcnRZID09PSBidWZmZXIuYmFzZVkgJiYgYnVmZmVyLmN1cnNvclkgPT09IHh0ZXJtLnJvd3MgLSAxKSB7XG5cdFx0XHRjb25zdCBsaW5lID0gYnVmZmVyLmdldExpbmUoYnVmZmVyLmJhc2VZICsgeHRlcm0ucm93cyAtIDEpO1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQoYnVmZmVyLmN1cnNvclggPT09IDEgJiYgbGluZVN0YXJ0c1dpdGgobGluZSwgJzonKSkgfHxcblx0XHRcdFx0KGJ1ZmZlci5jdXJzb3JYID09PSA1ICYmIGxpbmVTdGFydHNXaXRoKGxpbmUsICcoRU5EKScpKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHRoaXMuX3NldFZpc2libGUoZmFsc2UpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gR2V0IHRoZSBsaW5lIGNvbnRlbnQgb2YgdGhlIGNvbW1hbmQgZnJvbSB0aGUgdGVybWluYWxcblx0XHRjb25zdCBjb250ZW50ID0gdGhpcy5fc2VyaWFsaXplQWRkb24uc2VyaWFsaXplKHtcblx0XHRcdHJhbmdlOiB7XG5cdFx0XHRcdHN0YXJ0OiBzdGlja3lTY3JvbGxMaW5lU3RhcnQgKyByb3dPZmZzZXQsXG5cdFx0XHRcdGVuZDogc3RpY2t5U2Nyb2xsTGluZVN0YXJ0ICsgcm93T2Zmc2V0ICsgTWF0aC5tYXgoc3RpY2t5U2Nyb2xsTGluZUNvdW50IC0gMSwgMClcblx0XHRcdH1cblx0XHR9KSArIChpc1RydW5jYXRlZCA/ICdcXHgxYlswbSBcdTIwMjYnIDogJycpO1xuXG5cdFx0Ly8gSWYgYSBwYXJ0aWFsIGNvbW1hbmQncyBzdGlja3kgc2Nyb2xsIHdvdWxkIHNob3cgbm90aGluZywganVzdCBoaWRlIGl0LiBUaGlzIGlzIGFub3RoZXJcblx0XHQvLyBlZGdlIGNhc2Ugd2hlbiB1c2luZyBhIHBhZ2VyIG9yIGludGVyYWN0aXZlIGVkaXRvci5cblx0XHRpZiAoaXNQYXJ0aWFsQ29tbWFuZCAmJiByZW1vdmVBbnNpRXNjYXBlQ29kZXMoY29udGVudCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLl9zZXRWaXNpYmxlKGZhbHNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBXcml0ZSBjb250ZW50IGlmIGl0IGRpZmZlcnNcblx0XHRpZiAoXG5cdFx0XHRjb250ZW50ICYmIHRoaXMuX2N1cnJlbnRDb250ZW50ICE9PSBjb250ZW50IHx8XG5cdFx0XHR0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5LmNvbHMgIT09IHh0ZXJtLmNvbHMgfHxcblx0XHRcdHRoaXMuX3N0aWNreVNjcm9sbE92ZXJsYXkucm93cyAhPT0gc3RpY2t5U2Nyb2xsTGluZUNvdW50XG5cdFx0KSB7XG5cdFx0XHR0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5LnJlc2l6ZSh0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5LmNvbHMsIHN0aWNreVNjcm9sbExpbmVDb3VudCk7XG5cdFx0XHQvLyBDbGVhciBhdHRycywgcmVzZXQgY3Vyc29yIHBvc2l0aW9uLCBjbGVhciByaWdodFxuXHRcdFx0dGhpcy5fc3RpY2t5U2Nyb2xsT3ZlcmxheS53cml0ZSgnXFx4MWJbMG1cXHgxYltIXFx4MWJbMkonKTtcblx0XHRcdHRoaXMuX3N0aWNreVNjcm9sbE92ZXJsYXkud3JpdGUoY29udGVudCk7XG5cdFx0XHR0aGlzLl9jdXJyZW50Q29udGVudCA9IGNvbnRlbnQ7XG5cdFx0XHQvLyBERUJVRzogTG9nIHRvIHNob3cgdGhlIGNvbW1hbmQgbGluZSB3ZSBrbm93XG5cdFx0XHQvLyB0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5LndyaXRlKGAgWyR7Y29tbWFuZD8uY29tbWFuZH1dYCk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRTdGlja3lDb21tYW5kID0gY29tbWFuZDtcblx0XHRcdHRoaXMuX3NldFZpc2libGUodHJ1ZSk7XG5cblx0XHRcdC8vIFBvc2l0aW9uIHRoZSBzdGlja3kgc2Nyb2xsIHN1Y2ggdGhhdCBpdCBuZXZlciBvdmVybGFwcyB0aGUgcHJvbXB0L291dHB1dCBvZiB0aGVcblx0XHRcdC8vIGZvbGxvd2luZyBjb21tYW5kLiBUaGlzIG11c3QgaGFwcGVuIGFmdGVyIHNldFZpc2libGUgdG8gZW5zdXJlIHRoZSBlbGVtZW50IGlzXG5cdFx0XHQvLyBpbml0aWFsaXplZC5cblx0XHRcdGlmICh0aGlzLl9lbGVtZW50KSB7XG5cdFx0XHRcdGNvbnN0IHRlcm1Cb3ggPSB4dGVybS5lbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHQvLyBPbmx5IHRyeSByZXBvc2l0aW9uIGlmIHRoZSBlbGVtZW50IGlzIHZpc2libGUsIGlmIG5vdCBhIHJlZnJlc2ggd2lsbCBvY2N1ciB3aGVuXG5cdFx0XHRcdC8vIGl0IGJlY29tZXMgdmlzaWJsZVxuXHRcdFx0XHRpZiAodGVybUJveC5oZWlnaHQgPiAwKSB7XG5cdFx0XHRcdFx0Y29uc3Qgcm93SGVpZ2h0ID0gdGVybUJveC5oZWlnaHQgLyB4dGVybS5yb3dzO1xuXHRcdFx0XHRcdGNvbnN0IG92ZXJsYXlIZWlnaHQgPSBzdGlja3lTY3JvbGxMaW5lQ291bnQgKiByb3dIZWlnaHQ7XG5cblx0XHRcdFx0XHQvLyBBZGp1c3Qgc3RpY2t5IHNjcm9sbCBjb250ZW50IGlmIGl0IHdvdWxkIGJlbG93IHRoZSBlbmQgb2YgdGhlIGNvbW1hbmQsIG9ic2N1cmluZyB0aGVcblx0XHRcdFx0XHQvLyBmb2xsb3dpbmcgY29tbWFuZC5cblx0XHRcdFx0XHRsZXQgZW5kTWFya2VyT2Zmc2V0ID0gMDtcblx0XHRcdFx0XHRpZiAoIWlzUGFydGlhbENvbW1hbmQgJiYgY29tbWFuZC5lbmRNYXJrZXIgJiYgY29tbWFuZC5lbmRNYXJrZXIubGluZSAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdGlmIChidWZmZXIudmlld3BvcnRZICsgc3RpY2t5U2Nyb2xsTGluZUNvdW50ID4gY29tbWFuZC5lbmRNYXJrZXIubGluZSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBkaWZmID0gYnVmZmVyLnZpZXdwb3J0WSArIHN0aWNreVNjcm9sbExpbmVDb3VudCAtIGNvbW1hbmQuZW5kTWFya2VyLmxpbmU7XG5cdFx0XHRcdFx0XHRcdGVuZE1hcmtlck9mZnNldCA9IGRpZmYgKiByb3dIZWlnaHQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5fZWxlbWVudC5zdHlsZS5ib3R0b20gPSBgJHt0ZXJtQm94LmhlaWdodCAtIG92ZXJsYXlIZWlnaHQgKyAxICsgZW5kTWFya2VyT2Zmc2V0fXB4YDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zZXRWaXNpYmxlKGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9lbnN1cmVFbGVtZW50KCkge1xuXHRcdGlmIChcblx0XHRcdC8vIFRoZSBlbGVtZW50IGlzIGFscmVhZHkgY3JlYXRlZFxuXHRcdFx0dGhpcy5fZWxlbWVudCB8fFxuXHRcdFx0Ly8gSWYgdGhlIG92ZXJsYXkgaXMgeWV0IHRvIGJlIGNyZWF0ZWQsIHRoZSB0ZXJtaW5hbCBjYW5ub3QgYmUgb3BlbmVkIHNvIGRlZmVyIHRvIG5leHQgY2FsbFxuXHRcdFx0IXRoaXMuX3N0aWNreVNjcm9sbE92ZXJsYXkgfHxcblx0XHRcdC8vIFRoZSB4dGVybS5qcyBpbnN0YW5jZSBpc24ndCBvcGVuZWQgeWV0XG5cdFx0XHQhdGhpcy5feHRlcm0/LnJhdy5lbGVtZW50Py5wYXJlbnRFbGVtZW50XG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3ZlcmxheSA9IHRoaXMuX3N0aWNreVNjcm9sbE92ZXJsYXk7XG5cblx0XHRjb25zdCBob3Zlck92ZXJsYXkgPSAkKCcuaG92ZXItb3ZlcmxheScpO1xuXHRcdHRoaXMuX2VsZW1lbnQgPSAkKCcudGVybWluYWwtc3RpY2t5LXNjcm9sbCcsIHVuZGVmaW5lZCwgaG92ZXJPdmVybGF5KTtcblx0XHR0aGlzLl94dGVybS5yYXcuZWxlbWVudC5wYXJlbnRFbGVtZW50LmFwcGVuZCh0aGlzLl9lbGVtZW50KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5fZWxlbWVudD8ucmVtb3ZlKCkpKTtcblxuXHRcdC8vIEZpbGwgdG9vbHRpcFxuXHRcdGxldCBob3ZlclRpdGxlID0gbG9jYWxpemUoJ3N0aWNreVNjcm9sbEhvdmVyVGl0bGUnLCAnTmF2aWdhdGUgdG8gQ29tbWFuZCcpO1xuXHRcdGNvbnN0IHNjcm9sbFRvUHJldmlvdXNDb21tYW5kS2V5YmluZGluZyA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoVGVybWluYWxDb21tYW5kSWQuU2Nyb2xsVG9QcmV2aW91c0NvbW1hbmQpO1xuXHRcdGlmIChzY3JvbGxUb1ByZXZpb3VzQ29tbWFuZEtleWJpbmRpbmcpIHtcblx0XHRcdGNvbnN0IGxhYmVsID0gc2Nyb2xsVG9QcmV2aW91c0NvbW1hbmRLZXliaW5kaW5nLmdldExhYmVsKCk7XG5cdFx0XHRpZiAobGFiZWwpIHtcblx0XHRcdFx0aG92ZXJUaXRsZSArPSAnXFxuJyArIGxvY2FsaXplKCdsYWJlbFdpdGhLZXliaW5kaW5nJywgXCJ7MH0gKHsxfSlcIiwgdGVybWluYWxTdHJpbmdzLnNjcm9sbFRvUHJldmlvdXNDb21tYW5kLnZhbHVlLCBsYWJlbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHNjcm9sbFRvTmV4dENvbW1hbmRLZXliaW5kaW5nID0gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhUZXJtaW5hbENvbW1hbmRJZC5TY3JvbGxUb05leHRDb21tYW5kKTtcblx0XHRpZiAoc2Nyb2xsVG9OZXh0Q29tbWFuZEtleWJpbmRpbmcpIHtcblx0XHRcdGNvbnN0IGxhYmVsID0gc2Nyb2xsVG9OZXh0Q29tbWFuZEtleWJpbmRpbmcuZ2V0TGFiZWwoKTtcblx0XHRcdGlmIChsYWJlbCkge1xuXHRcdFx0XHRob3ZlclRpdGxlICs9ICdcXG4nICsgbG9jYWxpemUoJ2xhYmVsV2l0aEtleWJpbmRpbmcnLCBcInswfSAoezF9KVwiLCB0ZXJtaW5hbFN0cmluZ3Muc2Nyb2xsVG9OZXh0Q29tbWFuZC52YWx1ZSwgbGFiZWwpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRob3Zlck92ZXJsYXkudGl0bGUgPSBob3ZlclRpdGxlO1xuXG5cdFx0Y29uc3Qgc2Nyb2xsQmFyV2lkdGggPSAodGhpcy5feHRlcm0ucmF3IGFzIGFueSBhcyB7IF9jb3JlOiBJWHRlcm1Db3JlIH0pLl9jb3JlLnZpZXdwb3J0Py5zY3JvbGxCYXJXaWR0aDtcblx0XHRpZiAoc2Nyb2xsQmFyV2lkdGggIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fZWxlbWVudC5zdHlsZS5yaWdodCA9IGAke3Njcm9sbEJhcldpZHRofXB4YDtcblx0XHR9XG5cblx0XHR0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5Lm9wZW4odGhpcy5fZWxlbWVudCk7XG5cblx0XHR0aGlzLl94dGVybUFkZG9uTG9hZGVyLmltcG9ydEFkZG9uKCdsaWdhdHVyZXMnKS50aGVuKExpZ2F0dXJlc0FkZG9uID0+IHtcblx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkIHx8ICF0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2xpZ2F0dXJlc0FkZG9uID0gbmV3IExpZ2F0dXJlc0FkZG9uKCk7XG5cdFx0XHR0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5LmxvYWRBZGRvbih0aGlzLl9saWdhdHVyZXNBZGRvbik7XG5cdFx0fSk7XG5cblx0XHQvLyBTY3JvbGwgdG8gdGhlIGNvbW1hbmQgb24gY2xpY2tcblx0XHR0aGlzLl9yZWdpc3RlcihhZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihob3Zlck92ZXJsYXksICdjbGljaycsICgpID0+IHtcblx0XHRcdGlmICh0aGlzLl94dGVybSAmJiB0aGlzLl9jdXJyZW50U3RpY2t5Q29tbWFuZCkge1xuXHRcdFx0XHR0aGlzLl94dGVybS5tYXJrVHJhY2tlci5yZXZlYWxDb21tYW5kKHRoaXMuX2N1cnJlbnRTdGlja3lDb21tYW5kKTtcblx0XHRcdFx0dGhpcy5faW5zdGFuY2UuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBGb3J3YXJkIG1vdXNlIGV2ZW50cyB0byB0aGUgdGVybWluYWxcblx0XHR0aGlzLl9yZWdpc3RlcihhZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihob3Zlck92ZXJsYXksICd3aGVlbCcsIGUgPT4gdGhpcy5feHRlcm0/LnJhdy5lbGVtZW50Py5kaXNwYXRjaEV2ZW50KG5ldyBXaGVlbEV2ZW50KGUudHlwZSwgZSkpKSk7XG5cblx0XHQvLyBDb250ZXh0IG1lbnUgLSBzdG9wIHByb3BhZ2F0aW9uIG9uIG1vdXNlZG93biBiZWNhdXNlIHJpZ2h0Q2xpY2tCZWhhdmlvciBsaXN0ZW5zIG9uXG5cdFx0Ly8gbW91c2Vkb3duLCBub3QgY29udGV4dG1lbnVcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIoaG92ZXJPdmVybGF5LCAnbW91c2Vkb3duJywgZSA9PiB7XG5cdFx0XHRlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIoaG92ZXJPdmVybGF5LCAnY29udGV4dG1lbnUnLCBlID0+IHtcblx0XHRcdGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRvcGVuQ29udGV4dE1lbnUoZ2V0V2luZG93KGhvdmVyT3ZlcmxheSksIGUsIHRoaXMuX2luc3RhbmNlLCB0aGlzLl9jb250ZXh0TWVudSwgdGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlKTtcblx0XHR9KSk7XG5cblx0XHQvLyBJbnN0ZWFkIG9mIGp1Z2dsaW5nIGRlY29yYXRpb25zIGZvciBob3ZlciBzdHlsZXMsIHN3YXAgb3V0IHRoZSB0aGVtZSB0byBpbmRpY2F0ZSB0aGVcblx0XHQvLyBob3ZlciBzdGF0ZS4gVGhpcyBjb21lcyB3aXRoIHRoZSBiZW5lZml0IG92ZXIgb3RoZXIgbWV0aG9kcyBvZiB3b3JraW5nIHdlbGwgd2l0aCBzcGVjaWFsXG5cdFx0Ly8gZGVjb3JhdGl2ZSBjaGFyYWN0ZXJzIGxpa2UgcG93ZXJsaW5lIHN5bWJvbHMuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoaG92ZXJPdmVybGF5LCAnbW91c2VvdmVyJywgKCkgPT4gb3ZlcmxheS5vcHRpb25zLnRoZW1lID0gdGhpcy5fZ2V0VGhlbWUodHJ1ZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihob3Zlck92ZXJsYXksICdtb3VzZWxlYXZlJywgKCkgPT4gb3ZlcmxheS5vcHRpb25zLnRoZW1lID0gdGhpcy5fZ2V0VGhlbWUoZmFsc2UpKSk7XG5cdH1cblxuXHRAdGhyb3R0bGUoMClcblx0cHJpdmF0ZSBfc3luY09wdGlvbnMoKSB7XG5cdFx0aWYgKCF0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3N0aWNreVNjcm9sbE92ZXJsYXkucmVzaXplKHRoaXMuX3h0ZXJtLnJhdy5jb2xzLCB0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5LnJvd3MpO1xuXHRcdHRoaXMuX3N0aWNreVNjcm9sbE92ZXJsYXkub3B0aW9ucyA9IHRoaXMuX2dldE9wdGlvbnMoKTtcblx0XHR0aGlzLl9yZWZyZXNoR3B1QWNjZWxlcmF0aW9uKCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRPcHRpb25zKCk6IElUZXJtaW5hbE9wdGlvbnMge1xuXHRcdGNvbnN0IG8gPSB0aGlzLl94dGVybS5yYXcub3B0aW9ucztcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y3Vyc29ySW5hY3RpdmVTdHlsZTogJ25vbmUnLFxuXHRcdFx0c2Nyb2xsYmFjazogMCxcblx0XHRcdGxvZ0xldmVsOiAnb2ZmJyxcblxuXHRcdFx0dGhlbWU6IHRoaXMuX2dldFRoZW1lKGZhbHNlKSxcblx0XHRcdGRvY3VtZW50T3ZlcnJpZGU6IG8uZG9jdW1lbnRPdmVycmlkZSxcblx0XHRcdGZvbnRGYW1pbHk6IG8uZm9udEZhbWlseSxcblx0XHRcdGZvbnRXZWlnaHQ6IG8uZm9udFdlaWdodCxcblx0XHRcdGZvbnRXZWlnaHRCb2xkOiBvLmZvbnRXZWlnaHRCb2xkLFxuXHRcdFx0Zm9udFNpemU6IG8uZm9udFNpemUsXG5cdFx0XHRsZXR0ZXJTcGFjaW5nOiBvLmxldHRlclNwYWNpbmcsXG5cdFx0XHRsaW5lSGVpZ2h0OiBvLmxpbmVIZWlnaHQsXG5cdFx0XHRkcmF3Qm9sZFRleHRJbkJyaWdodENvbG9yczogby5kcmF3Qm9sZFRleHRJbkJyaWdodENvbG9ycyxcblx0XHRcdG1pbmltdW1Db250cmFzdFJhdGlvOiBvLm1pbmltdW1Db250cmFzdFJhdGlvLFxuXHRcdFx0dGFiU3RvcFdpZHRoOiBvLnRhYlN0b3BXaWR0aCxcblx0XHRcdGN1c3RvbUdseXBoczogby5jdXN0b21HbHlwaHMsXG5cdFx0fTtcblx0fVxuXG5cdEB0aHJvdHRsZSgwKVxuXHRwcml2YXRlIGFzeW5jIF9yZWZyZXNoR3B1QWNjZWxlcmF0aW9uKCkge1xuXHRcdGlmICh0aGlzLl9zaG91bGRMb2FkV2ViZ2woKSAmJiAhdGhpcy5fd2ViZ2xBZGRvbikge1xuXHRcdFx0Y29uc3QgV2ViZ2xBZGRvbiA9IGF3YWl0IHRoaXMuX3h0ZXJtQWRkb25Mb2FkZXIuaW1wb3J0QWRkb24oJ3dlYmdsJyk7XG5cdFx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl93ZWJnbEFkZG9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IFdlYmdsQWRkb24oKSk7XG5cdFx0XHR0aGlzLl9zdGlja3lTY3JvbGxPdmVybGF5Py5sb2FkQWRkb24odGhpcy5fd2ViZ2xBZGRvbik7XG5cdFx0fSBlbHNlIGlmICghdGhpcy5fc2hvdWxkTG9hZFdlYmdsKCkgJiYgdGhpcy5fd2ViZ2xBZGRvbikge1xuXHRcdFx0dGhpcy5fd2ViZ2xBZGRvbi5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl93ZWJnbEFkZG9uID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Nob3VsZExvYWRXZWJnbCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZ3B1QWNjZWxlcmF0aW9uID09PSAnYXV0bycgfHwgdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZ3B1QWNjZWxlcmF0aW9uID09PSAnb24nO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VGhlbWUoaXNIb3ZlcmluZzogYm9vbGVhbik6IElUaGVtZSB7XG5cdFx0Y29uc3QgdGhlbWUgPSB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpO1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi50aGlzLl94dGVybS5nZXRYdGVybVRoZW1lKCksXG5cdFx0XHRiYWNrZ3JvdW5kOiBpc0hvdmVyaW5nXG5cdFx0XHRcdD8gdGhlbWUuZ2V0Q29sb3IodGVybWluYWxTdGlja3lTY3JvbGxIb3ZlckJhY2tncm91bmQpPy50b1N0cmluZygpID8/IHRoaXMuX3h0ZXJtQ29sb3JQcm92aWRlci5nZXRCYWNrZ3JvdW5kQ29sb3IodGhlbWUpPy50b1N0cmluZygpXG5cdFx0XHRcdDogdGhlbWUuZ2V0Q29sb3IodGVybWluYWxTdGlja3lTY3JvbGxCYWNrZ3JvdW5kKT8udG9TdHJpbmcoKSA/PyB0aGlzLl94dGVybUNvbG9yUHJvdmlkZXIuZ2V0QmFja2dyb3VuZENvbG9yKHRoZW1lKT8udG9TdHJpbmcoKSxcblx0XHRcdHNlbGVjdGlvbkJhY2tncm91bmQ6IHVuZGVmaW5lZCxcblx0XHRcdHNlbGVjdGlvbkluYWN0aXZlQmFja2dyb3VuZDogdW5kZWZpbmVkXG5cdFx0fTtcblx0fVxufVxuXG5mdW5jdGlvbiBsaW5lU3RhcnRzV2l0aChsaW5lOiBJQnVmZmVyTGluZSB8IHVuZGVmaW5lZCwgdGV4dDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdGlmICghbGluZSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAobGluZS5nZXRDZWxsKGkpPy5nZXRDaGFycygpICE9PSB0ZXh0W2ldKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB0cnVlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFTQSxTQUFTLEdBQUcsdUJBQXVCLCtCQUErQixpQkFBaUI7QUFDbkYsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsWUFBWSxtQkFBbUIsb0JBQW9CLG9CQUFvQjtBQUNoRixTQUFTLDZCQUE2QjtBQUN0QyxPQUFPO0FB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
