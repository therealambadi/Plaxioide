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
import { coalesce } from "../../../../../base/common/arrays.js";
import { Disposable, DisposableStore, MutableDisposable, dispose } from "../../../../../base/common/lifecycle.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { timeout } from "../../../../../base/common/async.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR } from "../../common/terminalColorRegistry.js";
import { getWindow } from "../../../../../base/browser/dom.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TerminalContribSettingId } from "../../terminalContribExports.js";
var Boundary = /* @__PURE__ */ ((Boundary2) => {
  Boundary2[Boundary2["Top"] = 0] = "Top";
  Boundary2[Boundary2["Bottom"] = 1] = "Bottom";
  return Boundary2;
})(Boundary || {});
var ScrollPosition = /* @__PURE__ */ ((ScrollPosition2) => {
  ScrollPosition2[ScrollPosition2["Top"] = 0] = "Top";
  ScrollPosition2[ScrollPosition2["Middle"] = 1] = "Middle";
  return ScrollPosition2;
})(ScrollPosition || {});
let MarkNavigationAddon = class extends Disposable {
  constructor(_capabilities, _configurationService, _themeService) {
    super();
    this._capabilities = _capabilities;
    this._configurationService = _configurationService;
    this._themeService = _themeService;
    this._currentMarker = 1 /* Bottom */;
    this._selectionStart = null;
    this._isDisposable = false;
    this._commandGuideDecorations = this._register(new MutableDisposable());
  }
  activate(terminal) {
    this._terminal = terminal;
    this._register(this._terminal.onData(() => {
      this._currentMarker = 1 /* Bottom */;
    }));
  }
  _getMarkers(skipEmptyCommands) {
    const commandCapability = this._capabilities.get(TerminalCapability.CommandDetection);
    const partialCommandCapability = this._capabilities.get(TerminalCapability.PartialCommandDetection);
    const markCapability = this._capabilities.get(TerminalCapability.BufferMarkDetection);
    let markers = [];
    if (commandCapability) {
      markers = coalesce(commandCapability.commands.filter((e) => skipEmptyCommands ? e.exitCode !== void 0 : true).map((e) => e.promptStartMarker ?? e.marker));
      if (commandCapability.currentCommand?.promptStartMarker && commandCapability.currentCommand.commandExecutedMarker) {
        markers.push(commandCapability.currentCommand?.promptStartMarker);
      }
    } else if (partialCommandCapability) {
      markers.push(...partialCommandCapability.commands);
    }
    if (markCapability && !skipEmptyCommands) {
      let next = markCapability.markers().next()?.value;
      const arr = [];
      while (next) {
        arr.push(next);
        next = markCapability.markers().next()?.value;
      }
      markers = arr;
    }
    return markers;
  }
  _findCommand(marker) {
    const commandCapability = this._capabilities.get(TerminalCapability.CommandDetection);
    if (commandCapability) {
      const command = commandCapability.commands.find((e) => e.marker?.line === marker.line || e.promptStartMarker?.line === marker.line);
      if (command) {
        return command;
      }
      if (commandCapability.currentCommand) {
        return commandCapability.currentCommand;
      }
    }
    return void 0;
  }
  clear() {
    this._currentMarker = 1 /* Bottom */;
    this._resetNavigationDecorations();
    this._selectionStart = null;
  }
  _resetNavigationDecorations() {
    if (this._navigationDecorations) {
      dispose(this._navigationDecorations);
    }
    this._navigationDecorations = [];
  }
  _isEmptyCommand(marker) {
    if (marker === 1 /* Bottom */) {
      return true;
    }
    if (marker === 0 /* Top */) {
      return !this._getMarkers(true).map((e) => e.line).includes(0);
    }
    return !this._getMarkers(true).includes(marker);
  }
  scrollToPreviousMark(scrollPosition = 1 /* Middle */, retainSelection = false, skipEmptyCommands = true) {
    if (!this._terminal) {
      return;
    }
    if (!retainSelection) {
      this._selectionStart = null;
    }
    let markerIndex;
    const currentLineY = typeof this._currentMarker === "object" ? this.getTargetScrollLine(this._currentMarker.line, scrollPosition) : Math.min(getLine(this._terminal, this._currentMarker), this._terminal.buffer.active.baseY);
    const viewportY = this._terminal.buffer.active.viewportY;
    if (typeof this._currentMarker === "object" ? !this._isMarkerInViewport(this._terminal, this._currentMarker) : currentLineY !== viewportY) {
      const markersBelowViewport = this._getMarkers(skipEmptyCommands).filter((e) => e.line >= viewportY).length;
      markerIndex = this._getMarkers(skipEmptyCommands).length - markersBelowViewport - 1;
    } else if (this._currentMarker === 1 /* Bottom */) {
      markerIndex = this._getMarkers(skipEmptyCommands).length - 1;
    } else if (this._currentMarker === 0 /* Top */) {
      markerIndex = -1;
    } else if (this._isDisposable) {
      markerIndex = this._findPreviousMarker(skipEmptyCommands);
      this._currentMarker.dispose();
      this._isDisposable = false;
    } else {
      if (skipEmptyCommands && this._isEmptyCommand(this._currentMarker)) {
        markerIndex = this._findPreviousMarker(true);
      } else {
        markerIndex = this._getMarkers(skipEmptyCommands).indexOf(this._currentMarker) - 1;
      }
    }
    if (markerIndex < 0) {
      this._currentMarker = 0 /* Top */;
      this._terminal.scrollToTop();
      this._resetNavigationDecorations();
      return;
    }
    this._currentMarker = this._getMarkers(skipEmptyCommands)[markerIndex];
    this._scrollToCommand(this._currentMarker, scrollPosition);
  }
  scrollToNextMark(scrollPosition = 1 /* Middle */, retainSelection = false, skipEmptyCommands = true) {
    if (!this._terminal) {
      return;
    }
    if (!retainSelection) {
      this._selectionStart = null;
    }
    let markerIndex;
    const currentLineY = typeof this._currentMarker === "object" ? this.getTargetScrollLine(this._currentMarker.line, scrollPosition) : Math.min(getLine(this._terminal, this._currentMarker), this._terminal.buffer.active.baseY);
    const viewportY = this._terminal.buffer.active.viewportY;
    if (typeof this._currentMarker === "object" ? !this._isMarkerInViewport(this._terminal, this._currentMarker) : currentLineY !== viewportY) {
      const markersAboveViewport = this._getMarkers(skipEmptyCommands).filter((e) => e.line <= viewportY).length;
      markerIndex = markersAboveViewport;
    } else if (this._currentMarker === 1 /* Bottom */) {
      markerIndex = this._getMarkers(skipEmptyCommands).length;
    } else if (this._currentMarker === 0 /* Top */) {
      markerIndex = 0;
    } else if (this._isDisposable) {
      markerIndex = this._findNextMarker(skipEmptyCommands);
      this._currentMarker.dispose();
      this._isDisposable = false;
    } else {
      if (skipEmptyCommands && this._isEmptyCommand(this._currentMarker)) {
        markerIndex = this._findNextMarker(true);
      } else {
        markerIndex = this._getMarkers(skipEmptyCommands).indexOf(this._currentMarker) + 1;
      }
    }
    if (markerIndex >= this._getMarkers(skipEmptyCommands).length) {
      this._currentMarker = 1 /* Bottom */;
      this._terminal.scrollToBottom();
      this._resetNavigationDecorations();
      return;
    }
    this._currentMarker = this._getMarkers(skipEmptyCommands)[markerIndex];
    this._scrollToCommand(this._currentMarker, scrollPosition);
  }
  _scrollToCommand(marker, position) {
    const command = this._findCommand(marker);
    if (command) {
      this.revealCommand(command, position);
    } else {
      this._scrollToMarker(marker, position);
    }
  }
  _scrollToMarker(start, position, end, options) {
    if (!this._terminal) {
      return;
    }
    if (!this._isMarkerInViewport(this._terminal, start) || options?.forceScroll) {
      const line = this.getTargetScrollLine(toLineIndex(start), position);
      this._terminal.scrollToLine(line);
    }
    if (!options?.hideDecoration) {
      if (options?.bufferRange) {
        this._highlightBufferRange(options.bufferRange);
      } else {
        this.registerTemporaryDecoration(start, end, true);
      }
    }
  }
  _createMarkerForOffset(marker, offset) {
    if (offset === 0 && isMarker(marker)) {
      return marker;
    } else {
      const offsetMarker = this._terminal?.registerMarker(-this._terminal.buffer.active.cursorY + toLineIndex(marker) - this._terminal.buffer.active.baseY + offset);
      if (offsetMarker) {
        return offsetMarker;
      } else {
        throw new Error(`Could not register marker with offset ${toLineIndex(marker)}, ${offset}`);
      }
    }
  }
  revealCommand(command, position = 1 /* Middle */) {
    const marker = "getOutput" in command ? command.marker : command.commandStartMarker;
    if (!this._terminal || !marker) {
      return;
    }
    const line = toLineIndex(marker);
    const promptRowCount = command.getPromptRowCount();
    const commandRowCount = command.getCommandRowCount();
    this._scrollToMarker(
      line - (promptRowCount - 1),
      position,
      line + (commandRowCount - 1)
    );
  }
  revealRange(range) {
    this._scrollToMarker(
      range.start.y - 1,
      1 /* Middle */,
      range.end.y - 1,
      {
        bufferRange: range,
        // Ensure scroll shows the line when sticky scroll is enabled
        forceScroll: !!this._configurationService.getValue(TerminalContribSettingId.StickyScrollEnabled)
      }
    );
  }
  showCommandGuide(command) {
    if (!this._terminal) {
      return;
    }
    if (!command) {
      this._commandGuideDecorations.clear();
      this._activeCommandGuide = void 0;
      return;
    }
    if (this._activeCommandGuide === command) {
      return;
    }
    if (command.marker) {
      this._activeCommandGuide = command;
      const store = this._commandGuideDecorations.value = new DisposableStore();
      if (!command.executedMarker || !command.endMarker) {
        return;
      }
      const startLine = command.marker.line - (command.getPromptRowCount() - 1);
      const decorationCount = toLineIndex(command.endMarker) - startLine;
      if (decorationCount > 200) {
        return;
      }
      for (let i = 0; i < decorationCount; i++) {
        const decoration = this._terminal.registerDecoration({
          marker: this._createMarkerForOffset(startLine, i)
        });
        if (decoration) {
          store.add(decoration);
          let renderedElement;
          store.add(decoration.onRender((element) => {
            if (!renderedElement) {
              renderedElement = element;
              element.classList.add("terminal-command-guide");
              if (i === 0) {
                element.classList.add("top");
              }
              if (i === decorationCount - 1) {
                element.classList.add("bottom");
              }
            }
            if (this._terminal?.element) {
              element.style.marginLeft = `-${getWindow(this._terminal.element).getComputedStyle(this._terminal.element).paddingLeft}`;
            }
          }));
        }
      }
    }
  }
  saveScrollState() {
    this._scrollState = { viewportY: this._terminal?.buffer.active.viewportY ?? 0 };
  }
  restoreScrollState() {
    if (this._scrollState && this._terminal) {
      this._terminal.scrollToLine(this._scrollState.viewportY);
      this._scrollState = void 0;
    }
  }
  _highlightBufferRange(range) {
    if (!this._terminal) {
      return;
    }
    this._resetNavigationDecorations();
    const startLine = range.start.y;
    const decorationCount = range.end.y - range.start.y + 1;
    for (let i = 0; i < decorationCount; i++) {
      const decoration = this._terminal.registerDecoration({
        marker: this._createMarkerForOffset(startLine - 1, i),
        x: range.start.x - 1,
        width: range.end.x - 1 - (range.start.x - 1) + 1,
        overviewRulerOptions: void 0
      });
      if (decoration) {
        this._navigationDecorations?.push(decoration);
        let renderedElement;
        decoration.onRender((element) => {
          if (!renderedElement) {
            renderedElement = element;
            element.classList.add("terminal-range-highlight");
          }
        });
        decoration.onDispose(() => {
          this._navigationDecorations = this._navigationDecorations?.filter((d) => d !== decoration);
        });
      }
    }
  }
  registerTemporaryDecoration(marker, endMarker, showOutline) {
    if (!this._terminal) {
      return;
    }
    this._resetNavigationDecorations();
    const color = this._themeService.getColorTheme().getColor(TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR);
    const startLine = toLineIndex(marker);
    const decorationCount = endMarker ? toLineIndex(endMarker) - startLine + 1 : 1;
    for (let i = 0; i < decorationCount; i++) {
      const decoration = this._terminal.registerDecoration({
        marker: this._createMarkerForOffset(marker, i),
        width: this._terminal.cols,
        overviewRulerOptions: i === 0 ? {
          color: color?.toString() || "#a0a0a0cc"
        } : void 0
      });
      if (decoration) {
        this._navigationDecorations?.push(decoration);
        let renderedElement;
        decoration.onRender((element) => {
          if (!renderedElement) {
            renderedElement = element;
            element.classList.add("terminal-scroll-highlight");
            if (showOutline) {
              element.classList.add("terminal-scroll-highlight-outline");
            }
            if (i === 0) {
              element.classList.add("top");
            }
            if (i === decorationCount - 1) {
              element.classList.add("bottom");
            }
          } else {
            element.classList.add("terminal-scroll-highlight");
          }
          if (this._terminal?.element) {
            element.style.marginLeft = `-${getWindow(this._terminal.element).getComputedStyle(this._terminal.element).paddingLeft}`;
          }
        });
        decoration.onDispose(() => {
          this._navigationDecorations = this._navigationDecorations?.filter((d) => d !== decoration);
        });
        if (showOutline) {
          timeout(350).then(() => {
            if (renderedElement) {
              renderedElement.classList.remove("terminal-scroll-highlight-outline");
            }
          });
        }
      }
    }
  }
  scrollToLine(line, position) {
    this._terminal?.scrollToLine(this.getTargetScrollLine(line, position));
  }
  getTargetScrollLine(line, position) {
    if (this._terminal && position === 1 /* Middle */) {
      return Math.max(line - Math.floor(this._terminal.rows / 4), 0);
    }
    return line;
  }
  _isMarkerInViewport(terminal, marker) {
    const viewportY = terminal.buffer.active.viewportY;
    const line = toLineIndex(marker);
    return line >= viewportY && line < viewportY + terminal.rows;
  }
  scrollToClosestMarker(startMarkerId, endMarkerId, highlight) {
    const detectionCapability = this._capabilities.get(TerminalCapability.BufferMarkDetection);
    if (!detectionCapability) {
      return;
    }
    const startMarker = detectionCapability.getMark(startMarkerId);
    if (!startMarker) {
      return;
    }
    const endMarker = endMarkerId ? detectionCapability.getMark(endMarkerId) : startMarker;
    this._scrollToMarker(startMarker, 0 /* Top */, endMarker, { hideDecoration: !highlight });
  }
  selectToPreviousMark() {
    if (!this._terminal) {
      return;
    }
    if (this._selectionStart === null) {
      this._selectionStart = this._currentMarker;
    }
    if (this._capabilities.has(TerminalCapability.CommandDetection)) {
      this.scrollToPreviousMark(1 /* Middle */, true, true);
    } else {
      this.scrollToPreviousMark(1 /* Middle */, true, false);
    }
    selectLines(this._terminal, this._currentMarker, this._selectionStart);
  }
  selectToNextMark() {
    if (!this._terminal) {
      return;
    }
    if (this._selectionStart === null) {
      this._selectionStart = this._currentMarker;
    }
    if (this._capabilities.has(TerminalCapability.CommandDetection)) {
      this.scrollToNextMark(1 /* Middle */, true, true);
    } else {
      this.scrollToNextMark(1 /* Middle */, true, false);
    }
    selectLines(this._terminal, this._currentMarker, this._selectionStart);
  }
  selectToPreviousLine() {
    if (!this._terminal) {
      return;
    }
    if (this._selectionStart === null) {
      this._selectionStart = this._currentMarker;
    }
    this.scrollToPreviousLine(this._terminal, 1 /* Middle */, true);
    selectLines(this._terminal, this._currentMarker, this._selectionStart);
  }
  selectToNextLine() {
    if (!this._terminal) {
      return;
    }
    if (this._selectionStart === null) {
      this._selectionStart = this._currentMarker;
    }
    this.scrollToNextLine(this._terminal, 1 /* Middle */, true);
    selectLines(this._terminal, this._currentMarker, this._selectionStart);
  }
  scrollToPreviousLine(xterm, scrollPosition = 1 /* Middle */, retainSelection = false) {
    if (!retainSelection) {
      this._selectionStart = null;
    }
    if (this._currentMarker === 0 /* Top */) {
      xterm.scrollToTop();
      return;
    }
    if (this._currentMarker === 1 /* Bottom */) {
      this._currentMarker = this._registerMarkerOrThrow(xterm, this._getOffset(xterm) - 1);
    } else {
      const offset = this._getOffset(xterm);
      if (this._isDisposable) {
        this._currentMarker.dispose();
      }
      this._currentMarker = this._registerMarkerOrThrow(xterm, offset - 1);
    }
    this._isDisposable = true;
    this._scrollToMarker(this._currentMarker, scrollPosition);
  }
  scrollToNextLine(xterm, scrollPosition = 1 /* Middle */, retainSelection = false) {
    if (!retainSelection) {
      this._selectionStart = null;
    }
    if (this._currentMarker === 1 /* Bottom */) {
      xterm.scrollToBottom();
      return;
    }
    if (this._currentMarker === 0 /* Top */) {
      this._currentMarker = this._registerMarkerOrThrow(xterm, this._getOffset(xterm) + 1);
    } else {
      const offset = this._getOffset(xterm);
      if (this._isDisposable) {
        this._currentMarker.dispose();
      }
      this._currentMarker = this._registerMarkerOrThrow(xterm, offset + 1);
    }
    this._isDisposable = true;
    this._scrollToMarker(this._currentMarker, scrollPosition);
  }
  _registerMarkerOrThrow(xterm, cursorYOffset) {
    const marker = xterm.registerMarker(cursorYOffset);
    if (!marker) {
      throw new Error(`Could not create marker for ${cursorYOffset}`);
    }
    return marker;
  }
  _getOffset(xterm) {
    if (this._currentMarker === 1 /* Bottom */) {
      return 0;
    } else if (this._currentMarker === 0 /* Top */) {
      return 0 - (xterm.buffer.active.baseY + xterm.buffer.active.cursorY);
    } else {
      let offset = getLine(xterm, this._currentMarker);
      offset -= xterm.buffer.active.baseY + xterm.buffer.active.cursorY;
      return offset;
    }
  }
  _findPreviousMarker(skipEmptyCommands = false) {
    if (this._currentMarker === 0 /* Top */) {
      return 0;
    } else if (this._currentMarker === 1 /* Bottom */) {
      return this._getMarkers(skipEmptyCommands).length - 1;
    }
    let i;
    for (i = this._getMarkers(skipEmptyCommands).length - 1; i >= 0; i--) {
      if (this._getMarkers(skipEmptyCommands)[i].line < this._currentMarker.line) {
        return i;
      }
    }
    return -1;
  }
  _findNextMarker(skipEmptyCommands = false) {
    if (this._currentMarker === 0 /* Top */) {
      return 0;
    } else if (this._currentMarker === 1 /* Bottom */) {
      return this._getMarkers(skipEmptyCommands).length - 1;
    }
    let i;
    for (i = 0; i < this._getMarkers(skipEmptyCommands).length; i++) {
      if (this._getMarkers(skipEmptyCommands)[i].line > this._currentMarker.line) {
        return i;
      }
    }
    return this._getMarkers(skipEmptyCommands).length;
  }
};
MarkNavigationAddon = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IThemeService)
], MarkNavigationAddon);
function getLine(xterm, marker) {
  if (marker === 1 /* Bottom */) {
    return xterm.buffer.active.baseY + xterm.rows - 1;
  }
  if (marker === 0 /* Top */) {
    return 0;
  }
  return marker.line;
}
function selectLines(xterm, start, end) {
  if (end === null) {
    end = 1 /* Bottom */;
  }
  let startLine = getLine(xterm, start);
  let endLine = getLine(xterm, end);
  if (startLine > endLine) {
    const temp = startLine;
    startLine = endLine;
    endLine = temp;
  }
  endLine -= 1;
  xterm.selectLines(startLine, endLine);
}
function isMarker(value) {
  return typeof value !== "number";
}
function toLineIndex(line) {
  return isMarker(line) ? line.line : line;
}
export {
  MarkNavigationAddon,
  ScrollPosition,
  getLine,
  selectLines
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3h0ZXJtL21hcmtOYXZpZ2F0aW9uQWRkb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElNYXJrVHJhY2tlciB9IGZyb20gJy4uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSwgSVRlcm1pbmFsQ29tbWFuZCwgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHR5cGUgeyBUZXJtaW5hbCwgSU1hcmtlciwgSVRlcm1pbmFsQWRkb24sIElEZWNvcmF0aW9uLCBJQnVmZmVyUmFuZ2UgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRFUk1JTkFMX09WRVJWSUVXX1JVTEVSX0NVUlNPUl9GT1JFR1JPVU5EX0NPTE9SIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlcm1pbmFsQ29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBnZXRXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElDdXJyZW50UGFydGlhbENvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb24vdGVybWluYWxDb21tYW5kLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250cmliU2V0dGluZ0lkIH0gZnJvbSAnLi4vLi4vdGVybWluYWxDb250cmliRXhwb3J0cy5qcyc7XG5cbmVudW0gQm91bmRhcnkge1xuXHRUb3AsXG5cdEJvdHRvbVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBTY3JvbGxQb3NpdGlvbiB7XG5cdFRvcCxcblx0TWlkZGxlXG59XG5cbmludGVyZmFjZSBJU2Nyb2xsVG9NYXJrZXJPcHRpb25zIHtcblx0aGlkZURlY29yYXRpb24/OiBib29sZWFuO1xuXHQvKiogU2Nyb2xsIGV2ZW4gaWYgdGhlIGxpbmUgaXMgd2l0aGluIHRoZSB2aWV3cG9ydCAqL1xuXHRmb3JjZVNjcm9sbD86IGJvb2xlYW47XG5cdGJ1ZmZlclJhbmdlPzogSUJ1ZmZlclJhbmdlO1xufVxuXG5leHBvcnQgY2xhc3MgTWFya05hdmlnYXRpb25BZGRvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTWFya1RyYWNrZXIsIElUZXJtaW5hbEFkZG9uIHtcblx0cHJpdmF0ZSBfY3VycmVudE1hcmtlcjogSU1hcmtlciB8IEJvdW5kYXJ5ID0gQm91bmRhcnkuQm90dG9tO1xuXHRwcml2YXRlIF9zZWxlY3Rpb25TdGFydDogSU1hcmtlciB8IEJvdW5kYXJ5IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2lzRGlzcG9zYWJsZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcm90ZWN0ZWQgX3Rlcm1pbmFsOiBUZXJtaW5hbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfbmF2aWdhdGlvbkRlY29yYXRpb25zOiBJRGVjb3JhdGlvbltdIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX2FjdGl2ZUNvbW1hbmRHdWlkZT86IElUZXJtaW5hbENvbW1hbmQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRHdWlkZURlY29yYXRpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPERpc3Bvc2FibGVTdG9yZT4oKSk7XG5cblx0YWN0aXZhdGUodGVybWluYWw6IFRlcm1pbmFsKTogdm9pZCB7XG5cdFx0dGhpcy5fdGVybWluYWwgPSB0ZXJtaW5hbDtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbC5vbkRhdGEoKCkgPT4ge1xuXHRcdFx0dGhpcy5fY3VycmVudE1hcmtlciA9IEJvdW5kYXJ5LkJvdHRvbTtcblx0XHR9KSk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jYXBhYmlsaXRpZXM6IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRNYXJrZXJzKHNraXBFbXB0eUNvbW1hbmRzPzogYm9vbGVhbik6IHJlYWRvbmx5IElNYXJrZXJbXSB7XG5cdFx0Y29uc3QgY29tbWFuZENhcGFiaWxpdHkgPSB0aGlzLl9jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKTtcblx0XHRjb25zdCBwYXJ0aWFsQ29tbWFuZENhcGFiaWxpdHkgPSB0aGlzLl9jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5QYXJ0aWFsQ29tbWFuZERldGVjdGlvbik7XG5cdFx0Y29uc3QgbWFya0NhcGFiaWxpdHkgPSB0aGlzLl9jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5CdWZmZXJNYXJrRGV0ZWN0aW9uKTtcblx0XHRsZXQgbWFya2VyczogSU1hcmtlcltdID0gW107XG5cdFx0aWYgKGNvbW1hbmRDYXBhYmlsaXR5KSB7XG5cdFx0XHRtYXJrZXJzID0gY29hbGVzY2UoY29tbWFuZENhcGFiaWxpdHkuY29tbWFuZHMuZmlsdGVyKGUgPT4gc2tpcEVtcHR5Q29tbWFuZHMgPyBlLmV4aXRDb2RlICE9PSB1bmRlZmluZWQgOiB0cnVlKS5tYXAoZSA9PiBlLnByb21wdFN0YXJ0TWFya2VyID8/IGUubWFya2VyKSk7XG5cdFx0XHQvLyBBbGxvdyBuYXZpZ2F0aW5nIHRvIHRoZSBjdXJyZW50IGNvbW1hbmQgaWZmIGl0IGhhcyBiZWVuIGV4ZWN1dGVkLCB0aGlzIGlnbm9yZXMgdGhlXG5cdFx0XHQvLyBza2lwRW1wdHlDb21tYW5kcyBmbGFnIGludGVuaW9uYWxseSBhcyBjaGFuY2VzIGFyZSBpdCdzIG5vdCBnb2luZyB0byBiZSBlbXB0eSBpZiBhblxuXHRcdFx0Ly8gZXhlY3V0ZWQgbWFya2VyIGV4aXN0cyB3aGVuIHRoaXMgaXMgcmVxdWVzdGVkLlxuXHRcdFx0aWYgKGNvbW1hbmRDYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kPy5wcm9tcHRTdGFydE1hcmtlciAmJiBjb21tYW5kQ2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZC5jb21tYW5kRXhlY3V0ZWRNYXJrZXIpIHtcblx0XHRcdFx0bWFya2Vycy5wdXNoKGNvbW1hbmRDYXBhYmlsaXR5LmN1cnJlbnRDb21tYW5kPy5wcm9tcHRTdGFydE1hcmtlcik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChwYXJ0aWFsQ29tbWFuZENhcGFiaWxpdHkpIHtcblx0XHRcdG1hcmtlcnMucHVzaCguLi5wYXJ0aWFsQ29tbWFuZENhcGFiaWxpdHkuY29tbWFuZHMpO1xuXHRcdH1cblxuXHRcdGlmIChtYXJrQ2FwYWJpbGl0eSAmJiAhc2tpcEVtcHR5Q29tbWFuZHMpIHtcblx0XHRcdGxldCBuZXh0ID0gbWFya0NhcGFiaWxpdHkubWFya2VycygpLm5leHQoKT8udmFsdWU7XG5cdFx0XHRjb25zdCBhcnI6IElNYXJrZXJbXSA9IFtdO1xuXHRcdFx0d2hpbGUgKG5leHQpIHtcblx0XHRcdFx0YXJyLnB1c2gobmV4dCk7XG5cdFx0XHRcdG5leHQgPSBtYXJrQ2FwYWJpbGl0eS5tYXJrZXJzKCkubmV4dCgpPy52YWx1ZTtcblx0XHRcdH1cblx0XHRcdG1hcmtlcnMgPSBhcnI7XG5cdFx0fVxuXHRcdHJldHVybiBtYXJrZXJzO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZENvbW1hbmQobWFya2VyOiBJTWFya2VyKTogSVRlcm1pbmFsQ29tbWFuZCB8IElDdXJyZW50UGFydGlhbENvbW1hbmQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNvbW1hbmRDYXBhYmlsaXR5ID0gdGhpcy5fY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik7XG5cdFx0aWYgKGNvbW1hbmRDYXBhYmlsaXR5KSB7XG5cdFx0XHRjb25zdCBjb21tYW5kID0gY29tbWFuZENhcGFiaWxpdHkuY29tbWFuZHMuZmluZChlID0+IGUubWFya2VyPy5saW5lID09PSBtYXJrZXIubGluZSB8fCBlLnByb21wdFN0YXJ0TWFya2VyPy5saW5lID09PSBtYXJrZXIubGluZSk7XG5cdFx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZDtcblx0XHRcdH1cblx0XHRcdGlmIChjb21tYW5kQ2FwYWJpbGl0eS5jdXJyZW50Q29tbWFuZCkge1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZENhcGFiaWxpdHkuY3VycmVudENvbW1hbmQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHQvLyBDbGVhciB0aGUgY3VycmVudCBtYXJrZXIgc28gc3VjY2Vzc2l2ZSBmb2N1cy9zZWxlY3Rpb24gYWN0aW9ucyBhcmUgcGVyZm9ybWVkIGZyb20gdGhlXG5cdFx0Ly8gYm90dG9tIG9mIHRoZSBidWZmZXJcblx0XHR0aGlzLl9jdXJyZW50TWFya2VyID0gQm91bmRhcnkuQm90dG9tO1xuXHRcdHRoaXMuX3Jlc2V0TmF2aWdhdGlvbkRlY29yYXRpb25zKCk7XG5cdFx0dGhpcy5fc2VsZWN0aW9uU3RhcnQgPSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzZXROYXZpZ2F0aW9uRGVjb3JhdGlvbnMoKSB7XG5cdFx0aWYgKHRoaXMuX25hdmlnYXRpb25EZWNvcmF0aW9ucykge1xuXHRcdFx0ZGlzcG9zZSh0aGlzLl9uYXZpZ2F0aW9uRGVjb3JhdGlvbnMpO1xuXHRcdH1cblx0XHR0aGlzLl9uYXZpZ2F0aW9uRGVjb3JhdGlvbnMgPSBbXTtcblx0fVxuXG5cdHByaXZhdGUgX2lzRW1wdHlDb21tYW5kKG1hcmtlcjogSU1hcmtlciB8IEJvdW5kYXJ5KSB7XG5cdFx0aWYgKG1hcmtlciA9PT0gQm91bmRhcnkuQm90dG9tKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAobWFya2VyID09PSBCb3VuZGFyeS5Ub3ApIHtcblx0XHRcdHJldHVybiAhdGhpcy5fZ2V0TWFya2Vycyh0cnVlKS5tYXAoZSA9PiBlLmxpbmUpLmluY2x1ZGVzKDApO1xuXHRcdH1cblxuXHRcdHJldHVybiAhdGhpcy5fZ2V0TWFya2Vycyh0cnVlKS5pbmNsdWRlcyhtYXJrZXIpO1xuXHR9XG5cblx0c2Nyb2xsVG9QcmV2aW91c01hcmsoc2Nyb2xsUG9zaXRpb246IFNjcm9sbFBvc2l0aW9uID0gU2Nyb2xsUG9zaXRpb24uTWlkZGxlLCByZXRhaW5TZWxlY3Rpb246IGJvb2xlYW4gPSBmYWxzZSwgc2tpcEVtcHR5Q29tbWFuZHM6IGJvb2xlYW4gPSB0cnVlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90ZXJtaW5hbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXJldGFpblNlbGVjdGlvbikge1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uU3RhcnQgPSBudWxsO1xuXHRcdH1cblxuXHRcdGxldCBtYXJrZXJJbmRleDtcblx0XHRjb25zdCBjdXJyZW50TGluZVkgPSB0eXBlb2YgdGhpcy5fY3VycmVudE1hcmtlciA9PT0gJ29iamVjdCdcblx0XHRcdD8gdGhpcy5nZXRUYXJnZXRTY3JvbGxMaW5lKHRoaXMuX2N1cnJlbnRNYXJrZXIubGluZSwgc2Nyb2xsUG9zaXRpb24pXG5cdFx0XHQ6IE1hdGgubWluKGdldExpbmUodGhpcy5fdGVybWluYWwsIHRoaXMuX2N1cnJlbnRNYXJrZXIpLCB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmJhc2VZKTtcblx0XHRjb25zdCB2aWV3cG9ydFkgPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLnZpZXdwb3J0WTtcblx0XHRpZiAodHlwZW9mIHRoaXMuX2N1cnJlbnRNYXJrZXIgPT09ICdvYmplY3QnID8gIXRoaXMuX2lzTWFya2VySW5WaWV3cG9ydCh0aGlzLl90ZXJtaW5hbCwgdGhpcy5fY3VycmVudE1hcmtlcikgOiBjdXJyZW50TGluZVkgIT09IHZpZXdwb3J0WSkge1xuXHRcdFx0Ly8gVGhlIHVzZXIgaGFzIHNjcm9sbGVkLCBmaW5kIHRoZSBsaW5lIGJhc2VkIG9uIHRoZSBjdXJyZW50IHNjcm9sbCBwb3NpdGlvbi4gVGhpcyBvbmx5XG5cdFx0XHQvLyB3b3JrcyB3aGVuIG5vdCByZXRhaW5pbmcgc2VsZWN0aW9uXG5cdFx0XHRjb25zdCBtYXJrZXJzQmVsb3dWaWV3cG9ydCA9IHRoaXMuX2dldE1hcmtlcnMoc2tpcEVtcHR5Q29tbWFuZHMpLmZpbHRlcihlID0+IGUubGluZSA+PSB2aWV3cG9ydFkpLmxlbmd0aDtcblx0XHRcdC8vIC0xIHdpbGwgc2Nyb2xsIHRvIHRoZSB0b3Bcblx0XHRcdG1hcmtlckluZGV4ID0gdGhpcy5fZ2V0TWFya2Vycyhza2lwRW1wdHlDb21tYW5kcykubGVuZ3RoIC0gbWFya2Vyc0JlbG93Vmlld3BvcnQgLSAxO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fY3VycmVudE1hcmtlciA9PT0gQm91bmRhcnkuQm90dG9tKSB7XG5cdFx0XHRtYXJrZXJJbmRleCA9IHRoaXMuX2dldE1hcmtlcnMoc2tpcEVtcHR5Q29tbWFuZHMpLmxlbmd0aCAtIDE7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9jdXJyZW50TWFya2VyID09PSBCb3VuZGFyeS5Ub3ApIHtcblx0XHRcdG1hcmtlckluZGV4ID0gLTE7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9pc0Rpc3Bvc2FibGUpIHtcblx0XHRcdG1hcmtlckluZGV4ID0gdGhpcy5fZmluZFByZXZpb3VzTWFya2VyKHNraXBFbXB0eUNvbW1hbmRzKTtcblx0XHRcdHRoaXMuX2N1cnJlbnRNYXJrZXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5faXNEaXNwb3NhYmxlID0gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChza2lwRW1wdHlDb21tYW5kcyAmJiB0aGlzLl9pc0VtcHR5Q29tbWFuZCh0aGlzLl9jdXJyZW50TWFya2VyKSkge1xuXHRcdFx0XHRtYXJrZXJJbmRleCA9IHRoaXMuX2ZpbmRQcmV2aW91c01hcmtlcih0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1hcmtlckluZGV4ID0gdGhpcy5fZ2V0TWFya2Vycyhza2lwRW1wdHlDb21tYW5kcykuaW5kZXhPZih0aGlzLl9jdXJyZW50TWFya2VyKSAtIDE7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKG1hcmtlckluZGV4IDwgMCkge1xuXHRcdFx0dGhpcy5fY3VycmVudE1hcmtlciA9IEJvdW5kYXJ5LlRvcDtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsLnNjcm9sbFRvVG9wKCk7XG5cdFx0XHR0aGlzLl9yZXNldE5hdmlnYXRpb25EZWNvcmF0aW9ucygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2N1cnJlbnRNYXJrZXIgPSB0aGlzLl9nZXRNYXJrZXJzKHNraXBFbXB0eUNvbW1hbmRzKVttYXJrZXJJbmRleF07XG5cdFx0dGhpcy5fc2Nyb2xsVG9Db21tYW5kKHRoaXMuX2N1cnJlbnRNYXJrZXIsIHNjcm9sbFBvc2l0aW9uKTtcblx0fVxuXG5cdHNjcm9sbFRvTmV4dE1hcmsoc2Nyb2xsUG9zaXRpb246IFNjcm9sbFBvc2l0aW9uID0gU2Nyb2xsUG9zaXRpb24uTWlkZGxlLCByZXRhaW5TZWxlY3Rpb246IGJvb2xlYW4gPSBmYWxzZSwgc2tpcEVtcHR5Q29tbWFuZHM6IGJvb2xlYW4gPSB0cnVlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90ZXJtaW5hbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXJldGFpblNlbGVjdGlvbikge1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uU3RhcnQgPSBudWxsO1xuXHRcdH1cblxuXHRcdGxldCBtYXJrZXJJbmRleDtcblx0XHRjb25zdCBjdXJyZW50TGluZVkgPSB0eXBlb2YgdGhpcy5fY3VycmVudE1hcmtlciA9PT0gJ29iamVjdCdcblx0XHRcdD8gdGhpcy5nZXRUYXJnZXRTY3JvbGxMaW5lKHRoaXMuX2N1cnJlbnRNYXJrZXIubGluZSwgc2Nyb2xsUG9zaXRpb24pXG5cdFx0XHQ6IE1hdGgubWluKGdldExpbmUodGhpcy5fdGVybWluYWwsIHRoaXMuX2N1cnJlbnRNYXJrZXIpLCB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmJhc2VZKTtcblx0XHRjb25zdCB2aWV3cG9ydFkgPSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLnZpZXdwb3J0WTtcblx0XHRpZiAodHlwZW9mIHRoaXMuX2N1cnJlbnRNYXJrZXIgPT09ICdvYmplY3QnID8gIXRoaXMuX2lzTWFya2VySW5WaWV3cG9ydCh0aGlzLl90ZXJtaW5hbCwgdGhpcy5fY3VycmVudE1hcmtlcikgOiBjdXJyZW50TGluZVkgIT09IHZpZXdwb3J0WSkge1xuXHRcdFx0Ly8gVGhlIHVzZXIgaGFzIHNjcm9sbGVkLCBmaW5kIHRoZSBsaW5lIGJhc2VkIG9uIHRoZSBjdXJyZW50IHNjcm9sbCBwb3NpdGlvbi4gVGhpcyBvbmx5XG5cdFx0XHQvLyB3b3JrcyB3aGVuIG5vdCByZXRhaW5pbmcgc2VsZWN0aW9uXG5cdFx0XHRjb25zdCBtYXJrZXJzQWJvdmVWaWV3cG9ydCA9IHRoaXMuX2dldE1hcmtlcnMoc2tpcEVtcHR5Q29tbWFuZHMpLmZpbHRlcihlID0+IGUubGluZSA8PSB2aWV3cG9ydFkpLmxlbmd0aDtcblx0XHRcdC8vIG1hcmtlcnMubGVuZ3RoIHdpbGwgc2Nyb2xsIHRvIHRoZSBib3R0b21cblx0XHRcdG1hcmtlckluZGV4ID0gbWFya2Vyc0Fib3ZlVmlld3BvcnQ7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9jdXJyZW50TWFya2VyID09PSBCb3VuZGFyeS5Cb3R0b20pIHtcblx0XHRcdG1hcmtlckluZGV4ID0gdGhpcy5fZ2V0TWFya2Vycyhza2lwRW1wdHlDb21tYW5kcykubGVuZ3RoO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fY3VycmVudE1hcmtlciA9PT0gQm91bmRhcnkuVG9wKSB7XG5cdFx0XHRtYXJrZXJJbmRleCA9IDA7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9pc0Rpc3Bvc2FibGUpIHtcblx0XHRcdG1hcmtlckluZGV4ID0gdGhpcy5fZmluZE5leHRNYXJrZXIoc2tpcEVtcHR5Q29tbWFuZHMpO1xuXHRcdFx0dGhpcy5fY3VycmVudE1hcmtlci5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl9pc0Rpc3Bvc2FibGUgPSBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHNraXBFbXB0eUNvbW1hbmRzICYmIHRoaXMuX2lzRW1wdHlDb21tYW5kKHRoaXMuX2N1cnJlbnRNYXJrZXIpKSB7XG5cdFx0XHRcdG1hcmtlckluZGV4ID0gdGhpcy5fZmluZE5leHRNYXJrZXIodHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtYXJrZXJJbmRleCA9IHRoaXMuX2dldE1hcmtlcnMoc2tpcEVtcHR5Q29tbWFuZHMpLmluZGV4T2YodGhpcy5fY3VycmVudE1hcmtlcikgKyAxO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChtYXJrZXJJbmRleCA+PSB0aGlzLl9nZXRNYXJrZXJzKHNraXBFbXB0eUNvbW1hbmRzKS5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRNYXJrZXIgPSBCb3VuZGFyeS5Cb3R0b207XG5cdFx0XHR0aGlzLl90ZXJtaW5hbC5zY3JvbGxUb0JvdHRvbSgpO1xuXHRcdFx0dGhpcy5fcmVzZXROYXZpZ2F0aW9uRGVjb3JhdGlvbnMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jdXJyZW50TWFya2VyID0gdGhpcy5fZ2V0TWFya2Vycyhza2lwRW1wdHlDb21tYW5kcylbbWFya2VySW5kZXhdO1xuXHRcdHRoaXMuX3Njcm9sbFRvQ29tbWFuZCh0aGlzLl9jdXJyZW50TWFya2VyLCBzY3JvbGxQb3NpdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIF9zY3JvbGxUb0NvbW1hbmQobWFya2VyOiBJTWFya2VyLCBwb3NpdGlvbjogU2Nyb2xsUG9zaXRpb24pOiB2b2lkIHtcblx0XHRjb25zdCBjb21tYW5kID0gdGhpcy5fZmluZENvbW1hbmQobWFya2VyKTtcblx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0dGhpcy5yZXZlYWxDb21tYW5kKGNvbW1hbmQsIHBvc2l0aW9uKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2Nyb2xsVG9NYXJrZXIobWFya2VyLCBwb3NpdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2Nyb2xsVG9NYXJrZXIoc3RhcnQ6IElNYXJrZXIgfCBudW1iZXIsIHBvc2l0aW9uOiBTY3JvbGxQb3NpdGlvbiwgZW5kPzogSU1hcmtlciB8IG51bWJlciwgb3B0aW9ucz86IElTY3JvbGxUb01hcmtlck9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghdGhpcy5faXNNYXJrZXJJblZpZXdwb3J0KHRoaXMuX3Rlcm1pbmFsLCBzdGFydCkgfHwgb3B0aW9ucz8uZm9yY2VTY3JvbGwpIHtcblx0XHRcdGNvbnN0IGxpbmUgPSB0aGlzLmdldFRhcmdldFNjcm9sbExpbmUodG9MaW5lSW5kZXgoc3RhcnQpLCBwb3NpdGlvbik7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbC5zY3JvbGxUb0xpbmUobGluZSk7XG5cdFx0fVxuXHRcdGlmICghb3B0aW9ucz8uaGlkZURlY29yYXRpb24pIHtcblx0XHRcdGlmIChvcHRpb25zPy5idWZmZXJSYW5nZSkge1xuXHRcdFx0XHR0aGlzLl9oaWdobGlnaHRCdWZmZXJSYW5nZShvcHRpb25zLmJ1ZmZlclJhbmdlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucmVnaXN0ZXJUZW1wb3JhcnlEZWNvcmF0aW9uKHN0YXJ0LCBlbmQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZU1hcmtlckZvck9mZnNldChtYXJrZXI6IElNYXJrZXIgfCBudW1iZXIsIG9mZnNldDogbnVtYmVyKTogSU1hcmtlciB7XG5cdFx0aWYgKG9mZnNldCA9PT0gMCAmJiBpc01hcmtlcihtYXJrZXIpKSB7XG5cdFx0XHRyZXR1cm4gbWFya2VyO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBvZmZzZXRNYXJrZXIgPSB0aGlzLl90ZXJtaW5hbD8ucmVnaXN0ZXJNYXJrZXIoLXRoaXMuX3Rlcm1pbmFsLmJ1ZmZlci5hY3RpdmUuY3Vyc29yWSArIHRvTGluZUluZGV4KG1hcmtlcikgLSB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmJhc2VZICsgb2Zmc2V0KTtcblx0XHRcdGlmIChvZmZzZXRNYXJrZXIpIHtcblx0XHRcdFx0cmV0dXJuIG9mZnNldE1hcmtlcjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHJlZ2lzdGVyIG1hcmtlciB3aXRoIG9mZnNldCAke3RvTGluZUluZGV4KG1hcmtlcil9LCAke29mZnNldH1gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXZlYWxDb21tYW5kKGNvbW1hbmQ6IElUZXJtaW5hbENvbW1hbmQgfCBJQ3VycmVudFBhcnRpYWxDb21tYW5kLCBwb3NpdGlvbjogU2Nyb2xsUG9zaXRpb24gPSBTY3JvbGxQb3NpdGlvbi5NaWRkbGUpOiB2b2lkIHtcblx0XHRjb25zdCBtYXJrZXIgPSAnZ2V0T3V0cHV0JyBpbiBjb21tYW5kID8gY29tbWFuZC5tYXJrZXIgOiBjb21tYW5kLmNvbW1hbmRTdGFydE1hcmtlcjtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsIHx8ICFtYXJrZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbGluZSA9IHRvTGluZUluZGV4KG1hcmtlcik7XG5cdFx0Y29uc3QgcHJvbXB0Um93Q291bnQgPSBjb21tYW5kLmdldFByb21wdFJvd0NvdW50KCk7XG5cdFx0Y29uc3QgY29tbWFuZFJvd0NvdW50ID0gY29tbWFuZC5nZXRDb21tYW5kUm93Q291bnQoKTtcblx0XHR0aGlzLl9zY3JvbGxUb01hcmtlcihcblx0XHRcdGxpbmUgLSAocHJvbXB0Um93Q291bnQgLSAxKSxcblx0XHRcdHBvc2l0aW9uLFxuXHRcdFx0bGluZSArIChjb21tYW5kUm93Q291bnQgLSAxKVxuXHRcdCk7XG5cdH1cblxuXHRyZXZlYWxSYW5nZShyYW5nZTogSUJ1ZmZlclJhbmdlKTogdm9pZCB7XG5cdFx0dGhpcy5fc2Nyb2xsVG9NYXJrZXIoXG5cdFx0XHRyYW5nZS5zdGFydC55IC0gMSxcblx0XHRcdFNjcm9sbFBvc2l0aW9uLk1pZGRsZSxcblx0XHRcdHJhbmdlLmVuZC55IC0gMSxcblx0XHRcdHtcblx0XHRcdFx0YnVmZmVyUmFuZ2U6IHJhbmdlLFxuXHRcdFx0XHQvLyBFbnN1cmUgc2Nyb2xsIHNob3dzIHRoZSBsaW5lIHdoZW4gc3RpY2t5IHNjcm9sbCBpcyBlbmFibGVkXG5cdFx0XHRcdGZvcmNlU2Nyb2xsOiAhIXRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsQ29udHJpYlNldHRpbmdJZC5TdGlja3lTY3JvbGxFbmFibGVkKVxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRzaG93Q29tbWFuZEd1aWRlKGNvbW1hbmQ6IElUZXJtaW5hbENvbW1hbmQgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghY29tbWFuZCkge1xuXHRcdFx0dGhpcy5fY29tbWFuZEd1aWRlRGVjb3JhdGlvbnMuY2xlYXIoKTtcblx0XHRcdHRoaXMuX2FjdGl2ZUNvbW1hbmRHdWlkZSA9IHVuZGVmaW5lZDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2FjdGl2ZUNvbW1hbmRHdWlkZSA9PT0gY29tbWFuZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoY29tbWFuZC5tYXJrZXIpIHtcblx0XHRcdHRoaXMuX2FjdGl2ZUNvbW1hbmRHdWlkZSA9IGNvbW1hbmQ7XG5cblx0XHRcdC8vIEhpZ2hsaWdodCBvdXRwdXRcblx0XHRcdGNvbnN0IHN0b3JlID0gdGhpcy5fY29tbWFuZEd1aWRlRGVjb3JhdGlvbnMudmFsdWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRpZiAoIWNvbW1hbmQuZXhlY3V0ZWRNYXJrZXIgfHwgIWNvbW1hbmQuZW5kTWFya2VyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHN0YXJ0TGluZSA9IGNvbW1hbmQubWFya2VyLmxpbmUgLSAoY29tbWFuZC5nZXRQcm9tcHRSb3dDb3VudCgpIC0gMSk7XG5cdFx0XHRjb25zdCBkZWNvcmF0aW9uQ291bnQgPSB0b0xpbmVJbmRleChjb21tYW5kLmVuZE1hcmtlcikgLSBzdGFydExpbmU7XG5cdFx0XHQvLyBBYm9ydCBpZiB0aGUgY29tbWFuZCBpcyBleGNlc3NpdmVseSBsb25nIHRvIGF2b2lkIHBlcmZvcm1hbmNlIG9uIGhvdmVyL2xlYXZlXG5cdFx0XHRpZiAoZGVjb3JhdGlvbkNvdW50ID4gMjAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZGVjb3JhdGlvbkNvdW50OyBpKyspIHtcblx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbiA9IHRoaXMuX3Rlcm1pbmFsLnJlZ2lzdGVyRGVjb3JhdGlvbih7XG5cdFx0XHRcdFx0bWFya2VyOiB0aGlzLl9jcmVhdGVNYXJrZXJGb3JPZmZzZXQoc3RhcnRMaW5lLCBpKVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKGRlY29yYXRpb24pIHtcblx0XHRcdFx0XHRzdG9yZS5hZGQoZGVjb3JhdGlvbik7XG5cdFx0XHRcdFx0bGV0IHJlbmRlcmVkRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGRlY29yYXRpb24ub25SZW5kZXIoZWxlbWVudCA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXJlbmRlcmVkRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0XHRyZW5kZXJlZEVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdFx0XHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3Rlcm1pbmFsLWNvbW1hbmQtZ3VpZGUnKTtcblx0XHRcdFx0XHRcdFx0aWYgKGkgPT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3RvcCcpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChpID09PSBkZWNvcmF0aW9uQ291bnQgLSAxKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdib3R0b20nKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX3Rlcm1pbmFsPy5lbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRcdGVsZW1lbnQuc3R5bGUubWFyZ2luTGVmdCA9IGAtJHtnZXRXaW5kb3codGhpcy5fdGVybWluYWwuZWxlbWVudCkuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLl90ZXJtaW5hbC5lbGVtZW50KS5wYWRkaW5nTGVmdH1gO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cblx0cHJpdmF0ZSBfc2Nyb2xsU3RhdGU6IHsgdmlld3BvcnRZOiBudW1iZXIgfSB8IHVuZGVmaW5lZDtcblxuXHRzYXZlU2Nyb2xsU3RhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2Nyb2xsU3RhdGUgPSB7IHZpZXdwb3J0WTogdGhpcy5fdGVybWluYWw/LmJ1ZmZlci5hY3RpdmUudmlld3BvcnRZID8/IDAgfTtcblx0fVxuXG5cdHJlc3RvcmVTY3JvbGxTdGF0ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc2Nyb2xsU3RhdGUgJiYgdGhpcy5fdGVybWluYWwpIHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsLnNjcm9sbFRvTGluZSh0aGlzLl9zY3JvbGxTdGF0ZS52aWV3cG9ydFkpO1xuXHRcdFx0dGhpcy5fc2Nyb2xsU3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaGlnaGxpZ2h0QnVmZmVyUmFuZ2UocmFuZ2U6IElCdWZmZXJSYW5nZSk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9yZXNldE5hdmlnYXRpb25EZWNvcmF0aW9ucygpO1xuXHRcdGNvbnN0IHN0YXJ0TGluZSA9IHJhbmdlLnN0YXJ0Lnk7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbkNvdW50ID0gcmFuZ2UuZW5kLnkgLSByYW5nZS5zdGFydC55ICsgMTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGRlY29yYXRpb25Db3VudDsgaSsrKSB7XG5cdFx0XHRjb25zdCBkZWNvcmF0aW9uID0gdGhpcy5fdGVybWluYWwucmVnaXN0ZXJEZWNvcmF0aW9uKHtcblx0XHRcdFx0bWFya2VyOiB0aGlzLl9jcmVhdGVNYXJrZXJGb3JPZmZzZXQoc3RhcnRMaW5lIC0gMSwgaSksXG5cdFx0XHRcdHg6IHJhbmdlLnN0YXJ0LnggLSAxLFxuXHRcdFx0XHR3aWR0aDogKHJhbmdlLmVuZC54IC0gMSkgLSAocmFuZ2Uuc3RhcnQueCAtIDEpICsgMSxcblx0XHRcdFx0b3ZlcnZpZXdSdWxlck9wdGlvbnM6IHVuZGVmaW5lZFxuXHRcdFx0fSk7XG5cdFx0XHRpZiAoZGVjb3JhdGlvbikge1xuXHRcdFx0XHR0aGlzLl9uYXZpZ2F0aW9uRGVjb3JhdGlvbnM/LnB1c2goZGVjb3JhdGlvbik7XG5cdFx0XHRcdGxldCByZW5kZXJlZEVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGRlY29yYXRpb24ub25SZW5kZXIoZWxlbWVudCA9PiB7XG5cdFx0XHRcdFx0aWYgKCFyZW5kZXJlZEVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdHJlbmRlcmVkRWxlbWVudCA9IGVsZW1lbnQ7XG5cdFx0XHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3Rlcm1pbmFsLXJhbmdlLWhpZ2hsaWdodCcpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdGRlY29yYXRpb24ub25EaXNwb3NlKCgpID0+IHsgdGhpcy5fbmF2aWdhdGlvbkRlY29yYXRpb25zID0gdGhpcy5fbmF2aWdhdGlvbkRlY29yYXRpb25zPy5maWx0ZXIoZCA9PiBkICE9PSBkZWNvcmF0aW9uKTsgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmVnaXN0ZXJUZW1wb3JhcnlEZWNvcmF0aW9uKG1hcmtlcjogSU1hcmtlciB8IG51bWJlciwgZW5kTWFya2VyOiBJTWFya2VyIHwgbnVtYmVyIHwgdW5kZWZpbmVkLCBzaG93T3V0bGluZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fcmVzZXROYXZpZ2F0aW9uRGVjb3JhdGlvbnMoKTtcblx0XHRjb25zdCBjb2xvciA9IHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3IoVEVSTUlOQUxfT1ZFUlZJRVdfUlVMRVJfQ1VSU09SX0ZPUkVHUk9VTkRfQ09MT1IpO1xuXHRcdGNvbnN0IHN0YXJ0TGluZSA9IHRvTGluZUluZGV4KG1hcmtlcik7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbkNvdW50ID0gZW5kTWFya2VyID8gdG9MaW5lSW5kZXgoZW5kTWFya2VyKSAtIHN0YXJ0TGluZSArIDEgOiAxO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZGVjb3JhdGlvbkNvdW50OyBpKyspIHtcblx0XHRcdGNvbnN0IGRlY29yYXRpb24gPSB0aGlzLl90ZXJtaW5hbC5yZWdpc3RlckRlY29yYXRpb24oe1xuXHRcdFx0XHRtYXJrZXI6IHRoaXMuX2NyZWF0ZU1hcmtlckZvck9mZnNldChtYXJrZXIsIGkpLFxuXHRcdFx0XHR3aWR0aDogdGhpcy5fdGVybWluYWwuY29scyxcblx0XHRcdFx0b3ZlcnZpZXdSdWxlck9wdGlvbnM6IGkgPT09IDAgPyB7XG5cdFx0XHRcdFx0Y29sb3I6IGNvbG9yPy50b1N0cmluZygpIHx8ICcjYTBhMGEwY2MnXG5cdFx0XHRcdH0gOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdFx0aWYgKGRlY29yYXRpb24pIHtcblx0XHRcdFx0dGhpcy5fbmF2aWdhdGlvbkRlY29yYXRpb25zPy5wdXNoKGRlY29yYXRpb24pO1xuXHRcdFx0XHRsZXQgcmVuZGVyZWRFbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRkZWNvcmF0aW9uLm9uUmVuZGVyKGVsZW1lbnQgPT4ge1xuXHRcdFx0XHRcdGlmICghcmVuZGVyZWRFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRyZW5kZXJlZEVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKCd0ZXJtaW5hbC1zY3JvbGwtaGlnaGxpZ2h0Jyk7XG5cdFx0XHRcdFx0XHRpZiAoc2hvd091dGxpbmUpIHtcblx0XHRcdFx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKCd0ZXJtaW5hbC1zY3JvbGwtaGlnaGxpZ2h0LW91dGxpbmUnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChpID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdGVsZW1lbnQuY2xhc3NMaXN0LmFkZCgndG9wJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoaSA9PT0gZGVjb3JhdGlvbkNvdW50IC0gMSkge1xuXHRcdFx0XHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2JvdHRvbScpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3Rlcm1pbmFsLXNjcm9sbC1oaWdobGlnaHQnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRoaXMuX3Rlcm1pbmFsPy5lbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRlbGVtZW50LnN0eWxlLm1hcmdpbkxlZnQgPSBgLSR7Z2V0V2luZG93KHRoaXMuX3Rlcm1pbmFsLmVsZW1lbnQpLmdldENvbXB1dGVkU3R5bGUodGhpcy5fdGVybWluYWwuZWxlbWVudCkucGFkZGluZ0xlZnR9YDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHQvLyBUT0RPOiBUaGlzIGlzIG5vdCBlZmZpY2llbnQgZm9yIGEgbGFyZ2UgZGVjb3JhdGlvbkNvdW50XG5cdFx0XHRcdGRlY29yYXRpb24ub25EaXNwb3NlKCgpID0+IHsgdGhpcy5fbmF2aWdhdGlvbkRlY29yYXRpb25zID0gdGhpcy5fbmF2aWdhdGlvbkRlY29yYXRpb25zPy5maWx0ZXIoZCA9PiBkICE9PSBkZWNvcmF0aW9uKTsgfSk7XG5cdFx0XHRcdC8vIE51bWJlciBwaWNrZWQgdG8gYWxpZ24gd2l0aCBzeW1ib2wgaGlnaGxpZ2h0IGluIHRoZSBlZGl0b3Jcblx0XHRcdFx0aWYgKHNob3dPdXRsaW5lKSB7XG5cdFx0XHRcdFx0dGltZW91dCgzNTApLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHJlbmRlcmVkRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0XHRyZW5kZXJlZEVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgndGVybWluYWwtc2Nyb2xsLWhpZ2hsaWdodC1vdXRsaW5lJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRzY3JvbGxUb0xpbmUobGluZTogbnVtYmVyLCBwb3NpdGlvbjogU2Nyb2xsUG9zaXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLl90ZXJtaW5hbD8uc2Nyb2xsVG9MaW5lKHRoaXMuZ2V0VGFyZ2V0U2Nyb2xsTGluZShsaW5lLCBwb3NpdGlvbikpO1xuXHR9XG5cblx0Z2V0VGFyZ2V0U2Nyb2xsTGluZShsaW5lOiBudW1iZXIsIHBvc2l0aW9uOiBTY3JvbGxQb3NpdGlvbik6IG51bWJlciB7XG5cdFx0Ly8gTWlkZGxlIGlzIHRyZWF0ZWQgYXMgMS80IG9mIHRoZSB2aWV3cG9ydCdzIHNpemUgYmVjYXVzZSBjb250ZXh0IGJlbG93IGlzIGFsbW9zdCBhbHdheXNcblx0XHQvLyBtb3JlIGltcG9ydGFudCB0aGFuIGNvbnRleHQgYWJvdmUgaW4gdGhlIHRlcm1pbmFsLlxuXHRcdGlmICh0aGlzLl90ZXJtaW5hbCAmJiBwb3NpdGlvbiA9PT0gU2Nyb2xsUG9zaXRpb24uTWlkZGxlKSB7XG5cdFx0XHRyZXR1cm4gTWF0aC5tYXgobGluZSAtIE1hdGguZmxvb3IodGhpcy5fdGVybWluYWwucm93cyAvIDQpLCAwKTtcblx0XHR9XG5cdFx0cmV0dXJuIGxpbmU7XG5cdH1cblxuXHRwcml2YXRlIF9pc01hcmtlckluVmlld3BvcnQodGVybWluYWw6IFRlcm1pbmFsLCBtYXJrZXI6IElNYXJrZXIgfCBudW1iZXIpIHtcblx0XHRjb25zdCB2aWV3cG9ydFkgPSB0ZXJtaW5hbC5idWZmZXIuYWN0aXZlLnZpZXdwb3J0WTtcblx0XHRjb25zdCBsaW5lID0gdG9MaW5lSW5kZXgobWFya2VyKTtcblx0XHRyZXR1cm4gbGluZSA+PSB2aWV3cG9ydFkgJiYgbGluZSA8IHZpZXdwb3J0WSArIHRlcm1pbmFsLnJvd3M7XG5cdH1cblxuXHRzY3JvbGxUb0Nsb3Nlc3RNYXJrZXIoc3RhcnRNYXJrZXJJZDogc3RyaW5nLCBlbmRNYXJrZXJJZD86IHN0cmluZywgaGlnaGxpZ2h0PzogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGRldGVjdGlvbkNhcGFiaWxpdHkgPSB0aGlzLl9jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5CdWZmZXJNYXJrRGV0ZWN0aW9uKTtcblx0XHRpZiAoIWRldGVjdGlvbkNhcGFiaWxpdHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc3RhcnRNYXJrZXIgPSBkZXRlY3Rpb25DYXBhYmlsaXR5LmdldE1hcmsoc3RhcnRNYXJrZXJJZCk7XG5cdFx0aWYgKCFzdGFydE1hcmtlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBlbmRNYXJrZXIgPSBlbmRNYXJrZXJJZCA/IGRldGVjdGlvbkNhcGFiaWxpdHkuZ2V0TWFyayhlbmRNYXJrZXJJZCkgOiBzdGFydE1hcmtlcjtcblx0XHR0aGlzLl9zY3JvbGxUb01hcmtlcihzdGFydE1hcmtlciwgU2Nyb2xsUG9zaXRpb24uVG9wLCBlbmRNYXJrZXIsIHsgaGlkZURlY29yYXRpb246ICFoaWdobGlnaHQgfSk7XG5cdH1cblxuXHRzZWxlY3RUb1ByZXZpb3VzTWFyaygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9zZWxlY3Rpb25TdGFydCA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uU3RhcnQgPSB0aGlzLl9jdXJyZW50TWFya2VyO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fY2FwYWJpbGl0aWVzLmhhcyhUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbikpIHtcblx0XHRcdHRoaXMuc2Nyb2xsVG9QcmV2aW91c01hcmsoU2Nyb2xsUG9zaXRpb24uTWlkZGxlLCB0cnVlLCB0cnVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zY3JvbGxUb1ByZXZpb3VzTWFyayhTY3JvbGxQb3NpdGlvbi5NaWRkbGUsIHRydWUsIGZhbHNlKTtcblx0XHR9XG5cdFx0c2VsZWN0TGluZXModGhpcy5fdGVybWluYWwsIHRoaXMuX2N1cnJlbnRNYXJrZXIsIHRoaXMuX3NlbGVjdGlvblN0YXJ0KTtcblx0fVxuXG5cdHNlbGVjdFRvTmV4dE1hcmsoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90ZXJtaW5hbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fc2VsZWN0aW9uU3RhcnQgPT09IG51bGwpIHtcblx0XHRcdHRoaXMuX3NlbGVjdGlvblN0YXJ0ID0gdGhpcy5fY3VycmVudE1hcmtlcjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX2NhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pKSB7XG5cdFx0XHR0aGlzLnNjcm9sbFRvTmV4dE1hcmsoU2Nyb2xsUG9zaXRpb24uTWlkZGxlLCB0cnVlLCB0cnVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zY3JvbGxUb05leHRNYXJrKFNjcm9sbFBvc2l0aW9uLk1pZGRsZSwgdHJ1ZSwgZmFsc2UpO1xuXHRcdH1cblx0XHRzZWxlY3RMaW5lcyh0aGlzLl90ZXJtaW5hbCwgdGhpcy5fY3VycmVudE1hcmtlciwgdGhpcy5fc2VsZWN0aW9uU3RhcnQpO1xuXHR9XG5cblx0c2VsZWN0VG9QcmV2aW91c0xpbmUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90ZXJtaW5hbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fc2VsZWN0aW9uU3RhcnQgPT09IG51bGwpIHtcblx0XHRcdHRoaXMuX3NlbGVjdGlvblN0YXJ0ID0gdGhpcy5fY3VycmVudE1hcmtlcjtcblx0XHR9XG5cdFx0dGhpcy5zY3JvbGxUb1ByZXZpb3VzTGluZSh0aGlzLl90ZXJtaW5hbCwgU2Nyb2xsUG9zaXRpb24uTWlkZGxlLCB0cnVlKTtcblx0XHRzZWxlY3RMaW5lcyh0aGlzLl90ZXJtaW5hbCwgdGhpcy5fY3VycmVudE1hcmtlciwgdGhpcy5fc2VsZWN0aW9uU3RhcnQpO1xuXHR9XG5cblx0c2VsZWN0VG9OZXh0TGluZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9zZWxlY3Rpb25TdGFydCA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uU3RhcnQgPSB0aGlzLl9jdXJyZW50TWFya2VyO1xuXHRcdH1cblx0XHR0aGlzLnNjcm9sbFRvTmV4dExpbmUodGhpcy5fdGVybWluYWwsIFNjcm9sbFBvc2l0aW9uLk1pZGRsZSwgdHJ1ZSk7XG5cdFx0c2VsZWN0TGluZXModGhpcy5fdGVybWluYWwsIHRoaXMuX2N1cnJlbnRNYXJrZXIsIHRoaXMuX3NlbGVjdGlvblN0YXJ0KTtcblx0fVxuXG5cdHNjcm9sbFRvUHJldmlvdXNMaW5lKHh0ZXJtOiBUZXJtaW5hbCwgc2Nyb2xsUG9zaXRpb246IFNjcm9sbFBvc2l0aW9uID0gU2Nyb2xsUG9zaXRpb24uTWlkZGxlLCByZXRhaW5TZWxlY3Rpb246IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdGlmICghcmV0YWluU2VsZWN0aW9uKSB7XG5cdFx0XHR0aGlzLl9zZWxlY3Rpb25TdGFydCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRNYXJrZXIgPT09IEJvdW5kYXJ5LlRvcCkge1xuXHRcdFx0eHRlcm0uc2Nyb2xsVG9Ub3AoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fY3VycmVudE1hcmtlciA9PT0gQm91bmRhcnkuQm90dG9tKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50TWFya2VyID0gdGhpcy5fcmVnaXN0ZXJNYXJrZXJPclRocm93KHh0ZXJtLCB0aGlzLl9nZXRPZmZzZXQoeHRlcm0pIC0gMSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IG9mZnNldCA9IHRoaXMuX2dldE9mZnNldCh4dGVybSk7XG5cdFx0XHRpZiAodGhpcy5faXNEaXNwb3NhYmxlKSB7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRNYXJrZXIuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fY3VycmVudE1hcmtlciA9IHRoaXMuX3JlZ2lzdGVyTWFya2VyT3JUaHJvdyh4dGVybSwgb2Zmc2V0IC0gMSk7XG5cdFx0fVxuXHRcdHRoaXMuX2lzRGlzcG9zYWJsZSA9IHRydWU7XG5cdFx0dGhpcy5fc2Nyb2xsVG9NYXJrZXIodGhpcy5fY3VycmVudE1hcmtlciwgc2Nyb2xsUG9zaXRpb24pO1xuXHR9XG5cblx0c2Nyb2xsVG9OZXh0TGluZSh4dGVybTogVGVybWluYWwsIHNjcm9sbFBvc2l0aW9uOiBTY3JvbGxQb3NpdGlvbiA9IFNjcm9sbFBvc2l0aW9uLk1pZGRsZSwgcmV0YWluU2VsZWN0aW9uOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAoIXJldGFpblNlbGVjdGlvbikge1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uU3RhcnQgPSBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jdXJyZW50TWFya2VyID09PSBCb3VuZGFyeS5Cb3R0b20pIHtcblx0XHRcdHh0ZXJtLnNjcm9sbFRvQm90dG9tKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRNYXJrZXIgPT09IEJvdW5kYXJ5LlRvcCkge1xuXHRcdFx0dGhpcy5fY3VycmVudE1hcmtlciA9IHRoaXMuX3JlZ2lzdGVyTWFya2VyT3JUaHJvdyh4dGVybSwgdGhpcy5fZ2V0T2Zmc2V0KHh0ZXJtKSArIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBvZmZzZXQgPSB0aGlzLl9nZXRPZmZzZXQoeHRlcm0pO1xuXHRcdFx0aWYgKHRoaXMuX2lzRGlzcG9zYWJsZSkge1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50TWFya2VyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2N1cnJlbnRNYXJrZXIgPSB0aGlzLl9yZWdpc3Rlck1hcmtlck9yVGhyb3coeHRlcm0sIG9mZnNldCArIDEpO1xuXHRcdH1cblx0XHR0aGlzLl9pc0Rpc3Bvc2FibGUgPSB0cnVlO1xuXHRcdHRoaXMuX3Njcm9sbFRvTWFya2VyKHRoaXMuX2N1cnJlbnRNYXJrZXIsIHNjcm9sbFBvc2l0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVyTWFya2VyT3JUaHJvdyh4dGVybTogVGVybWluYWwsIGN1cnNvcllPZmZzZXQ6IG51bWJlcik6IElNYXJrZXIge1xuXHRcdGNvbnN0IG1hcmtlciA9IHh0ZXJtLnJlZ2lzdGVyTWFya2VyKGN1cnNvcllPZmZzZXQpO1xuXHRcdGlmICghbWFya2VyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBjcmVhdGUgbWFya2VyIGZvciAke2N1cnNvcllPZmZzZXR9YCk7XG5cdFx0fVxuXHRcdHJldHVybiBtYXJrZXI7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRPZmZzZXQoeHRlcm06IFRlcm1pbmFsKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5fY3VycmVudE1hcmtlciA9PT0gQm91bmRhcnkuQm90dG9tKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2N1cnJlbnRNYXJrZXIgPT09IEJvdW5kYXJ5LlRvcCkge1xuXHRcdFx0cmV0dXJuIDAgLSAoeHRlcm0uYnVmZmVyLmFjdGl2ZS5iYXNlWSArIHh0ZXJtLmJ1ZmZlci5hY3RpdmUuY3Vyc29yWSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxldCBvZmZzZXQgPSBnZXRMaW5lKHh0ZXJtLCB0aGlzLl9jdXJyZW50TWFya2VyKTtcblx0XHRcdG9mZnNldCAtPSB4dGVybS5idWZmZXIuYWN0aXZlLmJhc2VZICsgeHRlcm0uYnVmZmVyLmFjdGl2ZS5jdXJzb3JZO1xuXHRcdFx0cmV0dXJuIG9mZnNldDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9maW5kUHJldmlvdXNNYXJrZXIoc2tpcEVtcHR5Q29tbWFuZHM6IGJvb2xlYW4gPSBmYWxzZSk6IG51bWJlciB7XG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRNYXJrZXIgPT09IEJvdW5kYXJ5LlRvcCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9jdXJyZW50TWFya2VyID09PSBCb3VuZGFyeS5Cb3R0b20pIHtcblx0XHRcdHJldHVybiB0aGlzLl9nZXRNYXJrZXJzKHNraXBFbXB0eUNvbW1hbmRzKS5sZW5ndGggLSAxO1xuXHRcdH1cblxuXHRcdGxldCBpO1xuXHRcdGZvciAoaSA9IHRoaXMuX2dldE1hcmtlcnMoc2tpcEVtcHR5Q29tbWFuZHMpLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRpZiAodGhpcy5fZ2V0TWFya2Vycyhza2lwRW1wdHlDb21tYW5kcylbaV0ubGluZSA8IHRoaXMuX2N1cnJlbnRNYXJrZXIubGluZSkge1xuXHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gLTE7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kTmV4dE1hcmtlcihza2lwRW1wdHlDb21tYW5kczogYm9vbGVhbiA9IGZhbHNlKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5fY3VycmVudE1hcmtlciA9PT0gQm91bmRhcnkuVG9wKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2N1cnJlbnRNYXJrZXIgPT09IEJvdW5kYXJ5LkJvdHRvbSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2dldE1hcmtlcnMoc2tpcEVtcHR5Q29tbWFuZHMpLmxlbmd0aCAtIDE7XG5cdFx0fVxuXG5cdFx0bGV0IGk7XG5cdFx0Zm9yIChpID0gMDsgaSA8IHRoaXMuX2dldE1hcmtlcnMoc2tpcEVtcHR5Q29tbWFuZHMpLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAodGhpcy5fZ2V0TWFya2Vycyhza2lwRW1wdHlDb21tYW5kcylbaV0ubGluZSA+IHRoaXMuX2N1cnJlbnRNYXJrZXIubGluZSkge1xuXHRcdFx0XHRyZXR1cm4gaTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZ2V0TWFya2Vycyhza2lwRW1wdHlDb21tYW5kcykubGVuZ3RoO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMaW5lKHh0ZXJtOiBUZXJtaW5hbCwgbWFya2VyOiBJTWFya2VyIHwgQm91bmRhcnkpOiBudW1iZXIge1xuXHQvLyBVc2UgdGhlIF9zZWNvbmQgbGFzdF8gcm93IGFzIHRoZSBsYXN0IHJvdyBpcyBsaWtlbHkgdGhlIHByb21wdFxuXHRpZiAobWFya2VyID09PSBCb3VuZGFyeS5Cb3R0b20pIHtcblx0XHRyZXR1cm4geHRlcm0uYnVmZmVyLmFjdGl2ZS5iYXNlWSArIHh0ZXJtLnJvd3MgLSAxO1xuXHR9XG5cblx0aWYgKG1hcmtlciA9PT0gQm91bmRhcnkuVG9wKSB7XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRyZXR1cm4gbWFya2VyLmxpbmU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZWxlY3RMaW5lcyh4dGVybTogVGVybWluYWwsIHN0YXJ0OiBJTWFya2VyIHwgQm91bmRhcnksIGVuZDogSU1hcmtlciB8IEJvdW5kYXJ5IHwgbnVsbCk6IHZvaWQge1xuXHRpZiAoZW5kID09PSBudWxsKSB7XG5cdFx0ZW5kID0gQm91bmRhcnkuQm90dG9tO1xuXHR9XG5cblx0bGV0IHN0YXJ0TGluZSA9IGdldExpbmUoeHRlcm0sIHN0YXJ0KTtcblx0bGV0IGVuZExpbmUgPSBnZXRMaW5lKHh0ZXJtLCBlbmQpO1xuXG5cdGlmIChzdGFydExpbmUgPiBlbmRMaW5lKSB7XG5cdFx0Y29uc3QgdGVtcCA9IHN0YXJ0TGluZTtcblx0XHRzdGFydExpbmUgPSBlbmRMaW5lO1xuXHRcdGVuZExpbmUgPSB0ZW1wO1xuXHR9XG5cblx0Ly8gU3VidHJhY3QgYSBsaW5lIGFzIHRoZSBtYXJrZXIgaXMgb24gdGhlIGxpbmUgdGhlIGNvbW1hbmQgcnVuLCB3ZSBkbyBub3Qgd2FudCB0aGUgbmV4dFxuXHQvLyBjb21tYW5kIGluIHRoZSBzZWxlY3Rpb24gZm9yIHRoZSBjdXJyZW50IGNvbW1hbmRcblx0ZW5kTGluZSAtPSAxO1xuXG5cdHh0ZXJtLnNlbGVjdExpbmVzKHN0YXJ0TGluZSwgZW5kTGluZSk7XG59XG5cbmZ1bmN0aW9uIGlzTWFya2VyKHZhbHVlOiBJTWFya2VyIHwgbnVtYmVyKTogdmFsdWUgaXMgSU1hcmtlciB7XG5cdHJldHVybiB0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiB0b0xpbmVJbmRleChsaW5lOiBJTWFya2VyIHwgbnVtYmVyKTogbnVtYmVyIHtcblx0cmV0dXJuIGlzTWFya2VyKGxpbmUpID8gbGluZS5saW5lIDogbGluZTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxZQUFZLGlCQUFpQixtQkFBbUIsZUFBZTtBQUV4RSxTQUFxRCwwQkFBMEI7QUFFL0UsU0FBUyxlQUFlO0FBQ3hCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsdURBQXVEO0FBQ2hFLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBRXpDLElBQUssV0FBTCxrQkFBS0EsY0FBTDtBQUNDLEVBQUFBLG9CQUFBO0FBQ0EsRUFBQUEsb0JBQUE7QUFGSSxTQUFBQTtBQUFBLEdBQUE7QUFLRSxJQUFXLGlCQUFYLGtCQUFXQyxvQkFBWDtBQUNOLEVBQUFBLGdDQUFBO0FBQ0EsRUFBQUEsZ0NBQUE7QUFGaUIsU0FBQUE7QUFBQSxHQUFBO0FBWVgsSUFBTSxzQkFBTixjQUFrQyxXQUFtRDtBQUFBLEVBaUIzRixZQUNrQixlQUN1Qix1QkFDUixlQUMvQjtBQUNELFVBQU07QUFKVztBQUN1QjtBQUNSO0FBbkJqQyxTQUFRLGlCQUFxQztBQUM3QyxTQUFRLGtCQUE2QztBQUNyRCxTQUFRLGdCQUF5QjtBQUtqQyxTQUFpQiwyQkFBMkIsS0FBSyxVQUFVLElBQUksa0JBQW1DLENBQUM7QUFBQSxFQWVuRztBQUFBLEVBYkEsU0FBUyxVQUEwQjtBQUNsQyxTQUFLLFlBQVk7QUFDakIsU0FBSyxVQUFVLEtBQUssVUFBVSxPQUFPLE1BQU07QUFDMUMsV0FBSyxpQkFBaUI7QUFBQSxJQUN2QixDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFVUSxZQUFZLG1CQUFpRDtBQUNwRSxVQUFNLG9CQUFv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
