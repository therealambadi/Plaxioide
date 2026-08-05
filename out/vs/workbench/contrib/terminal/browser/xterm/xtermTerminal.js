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
import * as dom from "../../../../../base/browser/dom.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { ITerminalLogService, TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { XtermTerminalConstants, ITerminalConfigurationService } from "../terminal.js";
import { LogLevel } from "../../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { MarkNavigationAddon, ScrollPosition } from "./markNavigationAddon.js";
import { localize } from "../../../../../nls.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { PANEL_BACKGROUND } from "../../../../common/theme.js";
import { TERMINAL_FOREGROUND_COLOR, TERMINAL_BACKGROUND_COLOR, TERMINAL_CURSOR_FOREGROUND_COLOR, TERMINAL_CURSOR_BACKGROUND_COLOR, ansiColorIdentifiers, TERMINAL_SELECTION_BACKGROUND_COLOR, TERMINAL_FIND_MATCH_BACKGROUND_COLOR, TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR, TERMINAL_FIND_MATCH_BORDER_COLOR, TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR, TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR, TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR, TERMINAL_SELECTION_FOREGROUND_COLOR, TERMINAL_INACTIVE_SELECTION_BACKGROUND_COLOR, TERMINAL_OVERVIEW_RULER_BORDER_COLOR } from "../../common/terminalColorRegistry.js";
import { ShellIntegrationAddon } from "../../../../../platform/terminal/common/xterm/shellIntegrationAddon.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { DecorationAddon } from "./decorationAddon.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { Emitter } from "../../../../../base/common/event.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { TerminalContextKeys } from "../../common/terminalContextKey.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { debounce } from "../../../../../base/common/decorators.js";
import { MouseWheelClassifier } from "../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { StandardWheelEvent } from "../../../../../base/browser/mouseEvent.js";
import { ILayoutService } from "../../../../../platform/layout/browser/layoutService.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground } from "../../../../../platform/theme/common/colorRegistry.js";
import { XtermAddonImporter } from "./xtermAddonImporter.js";
import { equals } from "../../../../../base/common/objects.js";
var RenderConstants = /* @__PURE__ */ ((RenderConstants2) => {
  RenderConstants2[RenderConstants2["SmoothScrollDuration"] = 125] = "SmoothScrollDuration";
  return RenderConstants2;
})(RenderConstants || {});
function getFullBufferLineAsString(lineIndex, buffer) {
  let line = buffer.getLine(lineIndex);
  if (!line) {
    return { lineData: void 0, lineIndex };
  }
  let lineData = line.translateToString(true);
  while (lineIndex > 0 && line.isWrapped) {
    line = buffer.getLine(--lineIndex);
    if (!line) {
      break;
    }
    lineData = line.translateToString(false) + lineData;
  }
  return { lineData, lineIndex };
}
let XtermTerminal = class extends Disposable {
  /**
   * @param xtermCtor The xterm.js constructor, this is passed in so it can be fetched lazily
   * outside of this class such that {@link raw} is not nullable.
   */
  constructor(xtermCtor, options, _configurationService, _instantiationService, _logService, _notificationService, _themeService, _telemetryService, _terminalConfigurationService, _clipboardService, contextKeyService, _accessibilitySignalService, layoutService) {
    super();
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._notificationService = _notificationService;
    this._themeService = _themeService;
    this._telemetryService = _telemetryService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._clipboardService = _clipboardService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._isPhysicalMouseWheel = MouseWheelClassifier.INSTANCE.isPhysicalMouseWheel();
    this._progressState = { state: 0, value: 0 };
    this._ligaturesAddon = this._register(new MutableDisposable());
    this._attachedDisposables = this._register(new DisposableStore());
    this._onDidRequestRunCommand = this._register(new Emitter());
    this.onDidRequestRunCommand = this._onDidRequestRunCommand.event;
    this._onDidRequestCopyAsHtml = this._register(new Emitter());
    this.onDidRequestCopyAsHtml = this._onDidRequestCopyAsHtml.event;
    this._onDidRequestRefreshDimensions = this._register(new Emitter());
    this.onDidRequestRefreshDimensions = this._onDidRequestRefreshDimensions.event;
    this._onDidChangeFindResults = this._register(new Emitter());
    this.onDidChangeFindResults = this._onDidChangeFindResults.event;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
    this._onDidChangeFocus = this._register(new Emitter());
    this.onDidChangeFocus = this._onDidChangeFocus.event;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._onDidChangeProgress = this._register(new Emitter());
    this.onDidChangeProgress = this._onDidChangeProgress.event;
    this._xtermAddonLoader = options.xtermAddonImporter ?? new XtermAddonImporter();
    this._xtermColorProvider = options.xtermColorProvider;
    this._capabilities = options.capabilities;
    const font = this._terminalConfigurationService.getFont(dom.getActiveWindow(), void 0, true);
    const config = this._terminalConfigurationService.config;
    const editorOptions = this._configurationService.getValue("editor");
    this.raw = this._register(new xtermCtor({
      allowProposedApi: true,
      cols: options.cols,
      rows: options.rows,
      documentOverride: layoutService.mainContainer.ownerDocument,
      altClickMovesCursor: config.altClickMovesCursor && editorOptions.multiCursorModifier === "alt",
      scrollback: config.scrollback,
      theme: this.getXtermTheme(),
      drawBoldTextInBrightColors: config.drawBoldTextInBrightColors,
      fontFamily: font.fontFamily,
      fontWeight: config.fontWeight,
      fontWeightBold: config.fontWeightBold,
      fontSize: font.fontSize,
      letterSpacing: font.letterSpacing,
      lineHeight: font.lineHeight,
      logLevel: vscodeToXtermLogLevel(this._logService.getLevel()),
      logger: this._logService,
      minimumContrastRatio: config.minimumContrastRatio,
      tabStopWidth: config.tabStopWidth,
      cursorBlink: config.cursorBlinking,
      cursorStyle: vscodeToXtermCursorStyle(config.cursorStyle),
      cursorInactiveStyle: vscodeToXtermCursorStyle(config.cursorStyleInactive),
      cursorWidth: config.cursorWidth,
      macOptionIsMeta: config.macOptionIsMeta,
      macOptionClickForcesSelection: config.macOptionClickForcesSelection,
      rightClickSelectsWord: config.rightClickBehavior === "selectWord",
      fastScrollModifier: "alt",
      fastScrollSensitivity: config.fastScrollSensitivity,
      scrollSensitivity: config.mouseWheelScrollSensitivity,
      wordSeparator: config.wordSeparators,
      overviewRuler: {
        width: 14,
        showTopBorder: true
      },
      ignoreBracketedPasteMode: config.ignoreBracketedPasteMode,
      rescaleOverlappingGlyphs: config.rescaleOverlappingGlyphs,
      windowOptions: {
        getWinSizePixels: true,
        getCellSizePixels: true,
        getWinSizeChars: true
      }
    }));
    this._updateSmoothScrolling();
    this._core = this.raw._core;
    this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration(TerminalSettingId.GpuAcceleration)) {
        XtermTerminal._suggestedRendererType = void 0;
      }
      if (e.affectsConfiguration("terminal.integrated") || e.affectsConfiguration("editor.fastScrollSensitivity") || e.affectsConfiguration("editor.mouseWheelScrollSensitivity") || e.affectsConfiguration("editor.multiCursorModifier")) {
        this.updateConfig();
      }
      if (e.affectsConfiguration(TerminalSettingId.UnicodeVersion)) {
        this._updateUnicodeVersion();
      }
      if (e.affectsConfiguration(TerminalSettingId.ShellIntegrationDecorationsEnabled)) {
        this._updateTheme();
      }
    }));
    this._register(this._themeService.onDidColorThemeChange((theme) => this._updateTheme(theme)));
    this._register(this._logService.onDidChangeLogLevel((e) => this.raw.options.logLevel = vscodeToXtermLogLevel(e)));
    this._register(this.raw.onSelectionChange(() => {
      this._onDidChangeSelection.fire();
      if (this.isFocused) {
        this._anyFocusedTerminalHasSelection.set(this.raw.hasSelection());
      }
    }));
    this._register(this.raw.onData((e) => this._lastInputEvent = e));
    this._updateUnicodeVersion();
    this._markNavigationAddon = this._instantiationService.createInstance(MarkNavigationAddon, options.capabilities);
    this.raw.loadAddon(this._markNavigationAddon);
    this._decorationAddon = this._instantiationService.createInstance(DecorationAddon, this._capabilities);
    this._register(this._decorationAddon.onDidRequestRunCommand((e) => this._onDidRequestRunCommand.fire(e)));
    this._register(this._decorationAddon.onDidRequestCopyAsHtml((e) => this._onDidRequestCopyAsHtml.fire(e)));
    this.raw.loadAddon(this._decorationAddon);
    this._shellIntegrationAddon = new ShellIntegrationAddon(options.shellIntegrationNonce ?? "", options.disableShellIntegrationReporting, this._telemetryService, this._logService);
    this.raw.loadAddon(this._shellIntegrationAddon);
    this._xtermAddonLoader.importAddon("clipboard").then((ClipboardAddon) => {
      if (this._store.isDisposed) {
        return;
      }
      this._clipboardAddon = this._instantiationService.createInstance(ClipboardAddon, void 0, {
        async readText(type) {
          return _clipboardService.readText(type === "p" ? "selection" : "clipboard");
        },
        async writeText(type, text) {
          return _clipboardService.writeText(text, type === "p" ? "selection" : "clipboard");
        }
      });
      this.raw.loadAddon(this._clipboardAddon);
    });
    this._xtermAddonLoader.importAddon("progress").then((ProgressAddon) => {
      if (this._store.isDisposed) {
        return;
      }
      const progressAddon = this._instantiationService.createInstance(ProgressAddon);
      this.raw.loadAddon(progressAddon);
      const updateProgress = () => {
        if (!equals(this._progressState, progressAddon.progress)) {
          this._progressState = progressAddon.progress;
          this._onDidChangeProgress.fire(this._progressState);
        }
      };
      this._register(progressAddon.onChange(() => updateProgress()));
      updateProgress();
      const commandDetection = this._capabilities.get(TerminalCapability.CommandDetection);
      if (commandDetection) {
        this._register(commandDetection.onCommandFinished(() => progressAddon.progress = { state: 0, value: 0 }));
      } else {
        const disposable = this._capabilities.onDidAddCapability((e) => {
          if (e.id === TerminalCapability.CommandDetection) {
            this._register(e.capability.onCommandFinished(() => progressAddon.progress = { state: 0, value: 0 }));
            this._store.delete(disposable);
          }
        });
        this._store.add(disposable);
      }
    });
    this._anyTerminalFocusContextKey = TerminalContextKeys.focusInAny.bindTo(contextKeyService);
    this._anyFocusedTerminalHasSelection = TerminalContextKeys.textSelectedInFocused.bindTo(contextKeyService);
  }
  get lastInputEvent() {
    return this._lastInputEvent;
  }
  get progressState() {
    return this._progressState;
  }
  get findResult() {
    return this._lastFindResult;
  }
  get isStdinDisabled() {
    return !!this.raw.options.disableStdin;
  }
  get isGpuAccelerated() {
    return !!this._webglAddon;
  }
  get markTracker() {
    return this._markNavigationAddon;
  }
  get shellIntegration() {
    return this._shellIntegrationAddon;
  }
  get decorationAddon() {
    return this._decorationAddon;
  }
  get textureAtlas() {
    const canvas = this._webglAddon?.textureAtlas;
    if (!canvas) {
      return void 0;
    }
    return createImageBitmap(canvas);
  }
  get isFocused() {
    if (!this.raw.element) {
      return false;
    }
    return dom.isAncestorOfActiveElement(this.raw.element);
  }
  *getBufferReverseIterator() {
    for (let i = this.raw.buffer.active.length; i >= 0; i--) {
      const { lineData, lineIndex } = getFullBufferLineAsString(i, this.raw.buffer.active);
      if (lineData) {
        i = lineIndex;
        yield lineData;
      }
    }
  }
  async getContentsAsHtml() {
    if (!this._serializeAddon) {
      const Addon = await this._xtermAddonLoader.importAddon("serialize");
      this._serializeAddon = new Addon();
      this.raw.loadAddon(this._serializeAddon);
    }
    return this._serializeAddon.serializeAsHTML();
  }
  async getSelectionAsHtml(command) {
    if (!this._serializeAddon) {
      const Addon = await this._xtermAddonLoader.importAddon("serialize");
      this._serializeAddon = new Addon();
      this.raw.loadAddon(this._serializeAddon);
    }
    if (command) {
      const length = command.getOutput()?.length;
      const row = command.marker?.line;
      if (!length || !row) {
        throw new Error(`No row ${row} or output length ${length} for command ${command}`);
      }
      this.raw.select(0, row + 1, length - Math.floor(length / this.raw.cols));
    }
    const result = this._serializeAddon.serializeAsHTML({ onlySelection: true });
    if (command) {
      this.raw.clearSelection();
    }
    return result;
  }
  attachToElement(container, partialOptions) {
    const options = { enableGpu: true, ...partialOptions };
    if (!this._attached) {
      this.raw.open(container);
    }
    if (options.enableGpu) {
      if (this._shouldLoadWebgl()) {
        this._enableWebglRenderer();
      }
    }
    if (!this.raw.element || !this.raw.textarea) {
      throw new Error("xterm elements not set after open");
    }
    const ad = this._attachedDisposables;
    ad.clear();
    ad.add(dom.addDisposableListener(this.raw.textarea, "focus", () => this._setFocused(true)));
    ad.add(dom.addDisposableListener(this.raw.textarea, "blur", () => this._setFocused(false)));
    ad.add(dom.addDisposableListener(this.raw.textarea, "focusout", () => this._setFocused(false)));
    ad.add(dom.addDisposableListener(this.raw.element, dom.EventType.MOUSE_WHEEL, (e) => {
      const classifier = MouseWheelClassifier.INSTANCE;
      classifier.acceptStandardWheelEvent(new StandardWheelEvent(e));
      const value = classifier.isPhysicalMouseWheel();
      if (value !== this._isPhysicalMouseWheel) {
        this._isPhysicalMouseWheel = value;
        this._updateSmoothScrolling();
      }
    }, { passive: true }));
    this._refreshLigaturesAddon();
    this._attached = { container, options };
    return this._attached?.container.querySelector(".xterm-screen");
  }
  _setFocused(isFocused) {
    this._onDidChangeFocus.fire(isFocused);
    this._anyTerminalFocusContextKey.set(isFocused);
    this._anyFocusedTerminalHasSelection.set(isFocused && this.raw.hasSelection());
  }
  write(data, callback) {
    this.raw.write(data, callback);
  }
  resize(columns, rows) {
    this.raw.resize(columns, rows);
  }
  updateConfig() {
    const config = this._terminalConfigurationService.config;
    this.raw.options.altClickMovesCursor = config.altClickMovesCursor;
    this._setCursorBlink(config.cursorBlinking);
    this._setCursorStyle(config.cursorStyle);
    this._setCursorStyleInactive(config.cursorStyleInactive);
    this._setCursorWidth(config.cursorWidth);
    this.raw.options.scrollback = config.scrollback;
    this.raw.options.drawBoldTextInBrightColors = config.drawBoldTextInBrightColors;
    this.raw.options.minimumContrastRatio = config.minimumContrastRatio;
    this.raw.options.tabStopWidth = config.tabStopWidth;
    this.raw.options.fastScrollSensitivity = config.fastScrollSensitivity;
    this.raw.options.scrollSensitivity = config.mouseWheelScrollSensitivity;
    this.raw.options.macOptionIsMeta = config.macOptionIsMeta;
    const editorOptions = this._configurationService.getValue("editor");
    this.raw.options.altClickMovesCursor = config.altClickMovesCursor && editorOptions.multiCursorModifier === "alt";
    this.raw.options.macOptionClickForcesSelection = config.macOptionClickForcesSelection;
    this.raw.options.rightClickSelectsWord = config.rightClickBehavior === "selectWord";
    this.raw.options.wordSeparator = config.wordSeparators;
    this.raw.options.customGlyphs = config.customGlyphs;
    this.raw.options.ignoreBracketedPasteMode = config.ignoreBracketedPasteMode;
    this.raw.options.rescaleOverlappingGlyphs = config.rescaleOverlappingGlyphs;
    this.raw.options.overviewRuler = {
      width: 14,
      showTopBorder: true
    };
    this._updateSmoothScrolling();
    if (this._attached) {
      if (this._attached.options.enableGpu) {
        if (this._shouldLoadWebgl()) {
          this._enableWebglRenderer();
        } else {
          this._disposeOfWebglRenderer();
        }
      }
      this._refreshLigaturesAddon();
    }
  }
  _updateSmoothScrolling() {
    this.raw.options.smoothScrollDuration = this._terminalConfigurationService.config.smoothScrolling && this._isPhysicalMouseWheel ? 125 /* SmoothScrollDuration */ : 0;
  }
  _shouldLoadWebgl() {
    return this._terminalConfigurationService.config.gpuAcceleration === "auto" && XtermTerminal._suggestedRendererType === void 0 || this._terminalConfigurationService.config.gpuAcceleration === "on";
  }
  forceRedraw() {
    this.raw.clearTextureAtlas();
  }
  clearDecorations() {
    this._decorationAddon?.clearDecorations();
  }
  forceRefresh() {
    this._core.viewport?._innerRefresh();
  }
  async findNext(term, searchOptions) {
    this._updateFindColors(searchOptions);
    return (await this._getSearchAddon()).findNext(term, searchOptions);
  }
  async findPrevious(term, searchOptions) {
    this._updateFindColors(searchOptions);
    return (await this._getSearchAddon()).findPrevious(term, searchOptions);
  }
  _updateFindColors(searchOptions) {
    const theme = this._themeService.getColorTheme();
    const terminalBackground = theme.getColor(TERMINAL_BACKGROUND_COLOR) || theme.getColor(PANEL_BACKGROUND);
    const findMatchBackground = theme.getColor(TERMINAL_FIND_MATCH_BACKGROUND_COLOR);
    const findMatchBorder = theme.getColor(TERMINAL_FIND_MATCH_BORDER_COLOR);
    const findMatchOverviewRuler = theme.getColor(TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR);
    const findMatchHighlightBackground = theme.getColor(TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR);
    const findMatchHighlightBorder = theme.getColor(TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR);
    const findMatchHighlightOverviewRuler = theme.getColor(TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR);
    searchOptions.decorations = {
      activeMatchBackground: findMatchBackground?.toString(),
      activeMatchBorder: findMatchBorder?.toString() || "transparent",
      activeMatchColorOverviewRuler: findMatchOverviewRuler?.toString() || "transparent",
      // decoration bgs don't support the alpha channel so blend it with the regular bg
      matchBackground: terminalBackground ? findMatchHighlightBackground?.blend(terminalBackground).toString() : void 0,
      matchBorder: findMatchHighlightBorder?.toString() || "transparent",
      matchOverviewRuler: findMatchHighlightOverviewRuler?.toString() || "transparent"
    };
  }
  _getSearchAddon() {
    if (!this._searchAddonPromise) {
      this._searchAddonPromise = this._xtermAddonLoader.importAddon("search").then((AddonCtor) => {
        if (this._store.isDisposed) {
          return Promise.reject("Could not create search addon, terminal is disposed");
        }
        this._searchAddon = new AddonCtor({ highlightLimit: XtermTerminalConstants.SearchHighlightLimit });
        this.raw.loadAddon(this._searchAddon);
        this._searchAddon.onDidChangeResults((results) => {
          this._lastFindResult = results;
          this._onDidChangeFindResults.fire(results);
        });
        return this._searchAddon;
      });
    }
    return this._searchAddonPromise;
  }
  clearSearchDecorations() {
    this._searchAddon?.clearDecorations();
  }
  clearActiveSearchDecoration() {
    this._searchAddon?.clearActiveDecoration();
  }
  getFont() {
    return this._terminalConfigurationService.getFont(dom.getWindow(this.raw.element), this._core);
  }
  getLongestViewportWrappedLineLength() {
    let maxLineLength = 0;
    for (let i = this.raw.buffer.active.length - 1; i >= this.raw.buffer.active.viewportY; i--) {
      const lineInfo = this._getWrappedLineCount(i, this.raw.buffer.active);
      maxLineLength = Math.max(maxLineLength, lineInfo.lineCount * this.raw.cols - lineInfo.endSpaces || 0);
      i = lineInfo.currentIndex;
    }
    return maxLineLength;
  }
  _getWrappedLineCount(index, buffer) {
    let line = buffer.getLine(index);
    if (!line) {
      throw new Error("Could not get line");
    }
    let currentIndex = index;
    let endSpaces = 0;
    for (let i = Math.min(line.length, this.raw.cols) - 1; i >= 0; i--) {
      if (!line?.getCell(i)?.getChars()) {
        endSpaces++;
      } else {
        break;
      }
    }
    while (line?.isWrapped && currentIndex > 0) {
      currentIndex--;
      line = buffer.getLine(currentIndex);
    }
    return { lineCount: index - currentIndex + 1, currentIndex, endSpaces };
  }
  scrollDownLine() {
    this.raw.scrollLines(1);
  }
  scrollDownPage() {
    this.raw.scrollPages(1);
  }
  scrollToBottom() {
    this.raw.scrollToBottom();
  }
  scrollUpLine() {
    this.raw.scrollLines(-1);
  }
  scrollUpPage() {
    this.raw.scrollPages(-1);
  }
  scrollToTop() {
    this.raw.scrollToTop();
  }
  scrollToLine(line, position = ScrollPosition.Top) {
    this.markTracker.scrollToLine(line, position);
  }
  clearBuffer() {
    this.raw.clear();
    this._capabilities.get(TerminalCapability.CommandDetection)?.handlePromptStart();
    this._capabilities.get(TerminalCapability.CommandDetection)?.handleCommandStart();
    this._accessibilitySignalService.playSignal(AccessibilitySignal.clear);
  }
  hasSelection() {
    return this.raw.hasSelection();
  }
  clearSelection() {
    this.raw.clearSelection();
  }
  selectMarkedRange(fromMarkerId, toMarkerId, scrollIntoView = false) {
    const detectionCapability = this.shellIntegration.capabilities.get(TerminalCapability.BufferMarkDetection);
    if (!detectionCapability) {
      return;
    }
    const start = detectionCapability.getMark(fromMarkerId);
    const end = detectionCapability.getMark(toMarkerId);
    if (start === void 0 || end === void 0) {
      return;
    }
    this.raw.selectLines(start.line, end.line);
    if (scrollIntoView) {
      this.raw.scrollToLine(start.line);
    }
  }
  selectAll() {
    this.raw.focus();
    this.raw.selectAll();
  }
  focus() {
    this.raw.focus();
  }
  async copySelection(asHtml, command) {
    if (this.hasSelection() || asHtml && command) {
      if (asHtml) {
        let listener2 = function(e) {
          if (!e.clipboardData.types.includes("text/plain")) {
            e.clipboardData.setData("text/plain", command?.getOutput() ?? "");
          }
          e.clipboardData.setData("text/html", textAsHtml);
          e.preventDefault();
        };
        var listener = listener2;
        const textAsHtml = await this.getSelectionAsHtml(command);
        const doc = dom.getDocument(this.raw.element);
        doc.addEventListener("copy", listener2);
        doc.execCommand("copy");
        doc.removeEventListener("copy", listener2);
      } else {
        await this._clipboardService.writeText(this.raw.getSelection());
      }
    } else {
      this._notificationService.warn(localize("terminal.integrated.copySelection.noSelection", "The terminal has no selection to copy"));
    }
  }
  _setCursorBlink(blink) {
    if (this.raw.options.cursorBlink !== blink) {
      this.raw.options.cursorBlink = blink;
      this.raw.refresh(0, this.raw.rows - 1);
    }
  }
  _setCursorStyle(style) {
    const mapped = vscodeToXtermCursorStyle(style);
    if (this.raw.options.cursorStyle !== mapped) {
      this.raw.options.cursorStyle = mapped;
    }
  }
  _setCursorStyleInactive(style) {
    const mapped = vscodeToXtermCursorStyle(style);
    if (this.raw.options.cursorInactiveStyle !== mapped) {
      this.raw.options.cursorInactiveStyle = mapped;
    }
  }
  _setCursorWidth(width) {
    if (this.raw.options.cursorWidth !== width) {
      this.raw.options.cursorWidth = width;
    }
  }
  async _enableWebglRenderer() {
    if (!this.raw.element || this._webglAddon) {
      return;
    }
    const Addon = await this._xtermAddonLoader.importAddon("webgl");
    this._webglAddon = new Addon();
    try {
      this.raw.loadAddon(this._webglAddon);
      this._logService.trace("Webgl was loaded");
      this._webglAddon.onContextLoss(() => {
        this._logService.info(`Webgl lost context, disposing of webgl renderer`);
        this._disposeOfWebglRenderer();
      });
      this._refreshImageAddon();
      this._onDidRequestRefreshDimensions.fire();
    } catch (e) {
      this._logService.warn(`Webgl could not be loaded. Falling back to the DOM renderer`, e);
      XtermTerminal._suggestedRendererType = "dom";
      this._disposeOfWebglRenderer();
    }
  }
  async _refreshLigaturesAddon() {
    if (!this.raw.element) {
      return;
    }
    const ligaturesConfig = this._terminalConfigurationService.config.fontLigatures;
    let shouldRecreateWebglRenderer = false;
    if (ligaturesConfig?.enabled) {
      if (this._ligaturesAddon.value && !equals(ligaturesConfig, this._ligaturesAddonConfig)) {
        this._ligaturesAddon.clear();
      }
      if (!this._ligaturesAddon.value) {
        const LigaturesAddon = await this._xtermAddonLoader.importAddon("ligatures");
        if (this._store.isDisposed) {
          return;
        }
        this._ligaturesAddon.value = this._instantiationService.createInstance(LigaturesAddon, {
          fontFeatureSettings: ligaturesConfig.featureSettings,
          fallbackLigatures: ligaturesConfig.fallbackLigatures
        });
        this.raw.loadAddon(this._ligaturesAddon.value);
        shouldRecreateWebglRenderer = true;
      }
    } else {
      if (!this._ligaturesAddon.value) {
        return;
      }
      this._ligaturesAddon.clear();
      shouldRecreateWebglRenderer = true;
    }
    if (shouldRecreateWebglRenderer && this._webglAddon) {
      this._disposeOfWebglRenderer();
      await this._enableWebglRenderer();
    }
  }
  async _refreshImageAddon() {
    if (this._terminalConfigurationService.config.enableImages && this._webglAddon) {
      if (!this._imageAddon) {
        const AddonCtor = await this._xtermAddonLoader.importAddon("image");
        this._imageAddon = new AddonCtor();
        this.raw.loadAddon(this._imageAddon);
      }
    } else {
      try {
        this._imageAddon?.dispose();
      } catch {
      }
      this._imageAddon = void 0;
    }
  }
  _disposeOfWebglRenderer() {
    try {
      this._webglAddon?.dispose();
    } catch {
    }
    this._webglAddon = void 0;
    this._refreshImageAddon();
    this._onDidRequestRefreshDimensions.fire();
  }
  getXtermTheme(theme) {
    if (!theme) {
      theme = this._themeService.getColorTheme();
    }
    const config = this._terminalConfigurationService.config;
    const hideOverviewRuler = ["never", "gutter"].includes(config.shellIntegration?.decorationsEnabled ?? "");
    const foregroundColor = theme.getColor(TERMINAL_FOREGROUND_COLOR);
    const backgroundColor = this._xtermColorProvider.getBackgroundColor(theme);
    const cursorColor = theme.getColor(TERMINAL_CURSOR_FOREGROUND_COLOR) || foregroundColor;
    const cursorAccentColor = theme.getColor(TERMINAL_CURSOR_BACKGROUND_COLOR) || backgroundColor;
    const selectionBackgroundColor = theme.getColor(TERMINAL_SELECTION_BACKGROUND_COLOR);
    const selectionInactiveBackgroundColor = theme.getColor(TERMINAL_INACTIVE_SELECTION_BACKGROUND_COLOR);
    const selectionForegroundColor = theme.getColor(TERMINAL_SELECTION_FOREGROUND_COLOR) || void 0;
    return {
      background: backgroundColor?.toString(),
      foreground: foregroundColor?.toString(),
      cursor: cursorColor?.toString(),
      cursorAccent: cursorAccentColor?.toString(),
      selectionBackground: selectionBackgroundColor?.toString(),
      selectionInactiveBackground: selectionInactiveBackgroundColor?.toString(),
      selectionForeground: selectionForegroundColor?.toString(),
      overviewRulerBorder: hideOverviewRuler ? "#0000" : theme.getColor(TERMINAL_OVERVIEW_RULER_BORDER_COLOR)?.toString(),
      scrollbarSliderActiveBackground: theme.getColor(scrollbarSliderActiveBackground)?.toString(),
      scrollbarSliderBackground: theme.getColor(scrollbarSliderBackground)?.toString(),
      scrollbarSliderHoverBackground: theme.getColor(scrollbarSliderHoverBackground)?.toString(),
      black: theme.getColor(ansiColorIdentifiers[0])?.toString(),
      red: theme.getColor(ansiColorIdentifiers[1])?.toString(),
      green: theme.getColor(ansiColorIdentifiers[2])?.toString(),
      yellow: theme.getColor(ansiColorIdentifiers[3])?.toString(),
      blue: theme.getColor(ansiColorIdentifiers[4])?.toString(),
      magenta: theme.getColor(ansiColorIdentifiers[5])?.toString(),
      cyan: theme.getColor(ansiColorIdentifiers[6])?.toString(),
      white: theme.getColor(ansiColorIdentifiers[7])?.toString(),
      brightBlack: theme.getColor(ansiColorIdentifiers[8])?.toString(),
      brightRed: theme.getColor(ansiColorIdentifiers[9])?.toString(),
      brightGreen: theme.getColor(ansiColorIdentifiers[10])?.toString(),
      brightYellow: theme.getColor(ansiColorIdentifiers[11])?.toString(),
      brightBlue: theme.getColor(ansiColorIdentifiers[12])?.toString(),
      brightMagenta: theme.getColor(ansiColorIdentifiers[13])?.toString(),
      brightCyan: theme.getColor(ansiColorIdentifiers[14])?.toString(),
      brightWhite: theme.getColor(ansiColorIdentifiers[15])?.toString()
    };
  }
  _updateTheme(theme) {
    this.raw.options.theme = this.getXtermTheme(theme);
  }
  refresh() {
    this._updateTheme();
    this._decorationAddon.refreshLayouts();
  }
  async _updateUnicodeVersion() {
    if (!this._unicode11Addon && this._terminalConfigurationService.config.unicodeVersion === "11") {
      const Addon = await this._xtermAddonLoader.importAddon("unicode11");
      this._unicode11Addon = new Addon();
      this.raw.loadAddon(this._unicode11Addon);
    }
    if (this.raw.unicode.activeVersion !== this._terminalConfigurationService.config.unicodeVersion) {
      this.raw.unicode.activeVersion = this._terminalConfigurationService.config.unicodeVersion;
    }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _writeText(data) {
    this.raw.write(data);
  }
  dispose() {
    this._anyTerminalFocusContextKey.reset();
    this._anyFocusedTerminalHasSelection.reset();
    this._onDidDispose.fire();
    super.dispose();
  }
};
XtermTerminal._suggestedRendererType = void 0;
__decorateClass([
  debounce(100)
], XtermTerminal.prototype, "_refreshLigaturesAddon", 1);
__decorateClass([
  debounce(100)
], XtermTerminal.prototype, "_refreshImageAddon", 1);
XtermTerminal = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITerminalLogService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, ITerminalConfigurationService),
  __decorateParam(9, IClipboardService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IAccessibilitySignalService),
  __decorateParam(12, ILayoutService)
], XtermTerminal);
function getXtermScaledDimensions(w, font, width, height) {
  if (!font.charWidth || !font.charHeight) {
    return null;
  }
  const scaledWidthAvailable = width * w.devicePixelRatio;
  const scaledCharWidth = font.charWidth * w.devicePixelRatio + font.letterSpacing;
  const cols = Math.max(Math.floor(scaledWidthAvailable / scaledCharWidth), 1);
  const scaledHeightAvailable = height * w.devicePixelRatio;
  const scaledCharHeight = Math.ceil(font.charHeight * w.devicePixelRatio);
  const scaledLineHeight = Math.floor(scaledCharHeight * font.lineHeight);
  const rows = Math.max(Math.floor(scaledHeightAvailable / scaledLineHeight), 1);
  return { rows, cols };
}
function vscodeToXtermLogLevel(logLevel) {
  switch (logLevel) {
    case LogLevel.Trace:
      return "trace";
    case LogLevel.Debug:
      return "debug";
    case LogLevel.Info:
      return "info";
    case LogLevel.Warning:
      return "warn";
    case LogLevel.Error:
      return "error";
    default:
      return "off";
  }
}
function vscodeToXtermCursorStyle(style) {
  if (style === "line") {
    return "bar";
  }
  return style;
}
export {
  XtermTerminal,
  getXtermScaledDimensions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3h0ZXJtL3h0ZXJtVGVybWluYWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSB7IElCdWZmZXIsIElUZXJtaW5hbE9wdGlvbnMsIElUaGVtZSwgVGVybWluYWwgYXMgUmF3WHRlcm1UZXJtaW5hbCwgTG9nTGV2ZWwgYXMgWHRlcm1Mb2dMZXZlbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgdHlwZSB7IElTZWFyY2hPcHRpb25zLCBTZWFyY2hBZGRvbiBhcyBTZWFyY2hBZGRvblR5cGUgfSBmcm9tICdAeHRlcm0vYWRkb24tc2VhcmNoJztcbmltcG9ydCB0eXBlIHsgVW5pY29kZTExQWRkb24gYXMgVW5pY29kZTExQWRkb25UeXBlIH0gZnJvbSAnQHh0ZXJtL2FkZG9uLXVuaWNvZGUxMSc7XG5pbXBvcnQgdHlwZSB7IElMaWdhdHVyZU9wdGlvbnMsIExpZ2F0dXJlc0FkZG9uIGFzIExpZ2F0dXJlc0FkZG9uVHlwZSB9IGZyb20gJ0B4dGVybS9hZGRvbi1saWdhdHVyZXMnO1xuaW1wb3J0IHR5cGUgeyBXZWJnbEFkZG9uIGFzIFdlYmdsQWRkb25UeXBlIH0gZnJvbSAnQHh0ZXJtL2FkZG9uLXdlYmdsJztcbmltcG9ydCB0eXBlIHsgU2VyaWFsaXplQWRkb24gYXMgU2VyaWFsaXplQWRkb25UeXBlIH0gZnJvbSAnQHh0ZXJtL2FkZG9uLXNlcmlhbGl6ZSc7XG5pbXBvcnQgdHlwZSB7IEltYWdlQWRkb24gYXMgSW1hZ2VBZGRvblR5cGUgfSBmcm9tICdAeHRlcm0vYWRkb24taW1hZ2UnO1xuaW1wb3J0IHR5cGUgeyBDbGlwYm9hcmRBZGRvbiBhcyBDbGlwYm9hcmRBZGRvblR5cGUsIENsaXBib2FyZFNlbGVjdGlvblR5cGUgfSBmcm9tICdAeHRlcm0vYWRkb24tY2xpcGJvYXJkJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElYdGVybUNvcmUgfSBmcm9tICcuLi94dGVybS1wcml2YXRlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVNoZWxsSW50ZWdyYXRpb24sIElUZXJtaW5hbExvZ1NlcnZpY2UsIFRlcm1pbmFsU2V0dGluZ0lkLCB0eXBlIElEZWNvcmF0aW9uQWRkb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsRm9udCwgSVRlcm1pbmFsQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJTWFya1RyYWNrZXIsIElJbnRlcm5hbFh0ZXJtVGVybWluYWwsIElYdGVybVRlcm1pbmFsLCBJWHRlcm1Db2xvclByb3ZpZGVyLCBYdGVybVRlcm1pbmFsQ29uc3RhbnRzLCBJWHRlcm1BdHRhY2hUb0VsZW1lbnRPcHRpb25zLCBJRGV0YWNoZWRYdGVybVRlcm1pbmFsLCBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IExvZ0xldmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBNYXJrTmF2aWdhdGlvbkFkZG9uLCBTY3JvbGxQb3NpdGlvbiB9IGZyb20gJy4vbWFya05hdmlnYXRpb25BZGRvbi5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29sb3JUaGVtZSwgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUEFORUxfQkFDS0dST1VORCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBURVJNSU5BTF9GT1JFR1JPVU5EX0NPTE9SLCBURVJNSU5BTF9CQUNLR1JPVU5EX0NPTE9SLCBURVJNSU5BTF9DVVJTT1JfRk9SRUdST1VORF9DT0xPUiwgVEVSTUlOQUxfQ1VSU09SX0JBQ0tHUk9VTkRfQ09MT1IsIGFuc2lDb2xvcklkZW50aWZpZXJzLCBURVJNSU5BTF9TRUxFQ1RJT05fQkFDS0dST1VORF9DT0xPUiwgVEVSTUlOQUxfRklORF9NQVRDSF9CQUNLR1JPVU5EX0NPTE9SLCBURVJNSU5BTF9GSU5EX01BVENIX0hJR0hMSUdIVF9CQUNLR1JPVU5EX0NPTE9SLCBURVJNSU5BTF9GSU5EX01BVENIX0JPUkRFUl9DT0xPUiwgVEVSTUlOQUxfT1ZFUlZJRVdfUlVMRVJfRklORF9NQVRDSF9GT1JFR1JPVU5EX0NPTE9SLCBURVJNSU5BTF9GSU5EX01BVENIX0hJR0hMSUdIVF9CT1JERVJfQ09MT1IsIFRFUk1JTkFMX09WRVJWSUVXX1JVTEVSX0NVUlNPUl9GT1JFR1JPVU5EX0NPTE9SLCBURVJNSU5BTF9TRUxFQ1RJT05fRk9SRUdST1VORF9DT0xPUiwgVEVSTUlOQUxfSU5BQ1RJVkVfU0VMRUNUSU9OX0JBQ0tHUk9VTkRfQ09MT1IsIFRFUk1JTkFMX09WRVJWSUVXX1JVTEVSX0JPUkRFUl9DT0xPUiB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbENvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgU2hlbGxJbnRlZ3JhdGlvbkFkZG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3h0ZXJtL3NoZWxsSW50ZWdyYXRpb25BZGRvbi5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IERlY29yYXRpb25BZGRvbiB9IGZyb20gJy4vZGVjb3JhdGlvbkFkZG9uLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSwgSVRlcm1pbmFsQ29tbWFuZCwgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbENvbnRleHRLZXkuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZGVib3VuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IE1vdXNlV2hlZWxDbGFzc2lmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Njcm9sbGJhci9zY3JvbGxhYmxlRWxlbWVudC5qcyc7XG5pbXBvcnQgeyBJTW91c2VXaGVlbEV2ZW50LCBTdGFuZGFyZFdoZWVsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBJTGF5b3V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHNjcm9sbGJhclNsaWRlckFjdGl2ZUJhY2tncm91bmQsIHNjcm9sbGJhclNsaWRlckJhY2tncm91bmQsIHNjcm9sbGJhclNsaWRlckhvdmVyQmFja2dyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFh0ZXJtQWRkb25JbXBvcnRlciB9IGZyb20gJy4veHRlcm1BZGRvbkltcG9ydGVyLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHR5cGUgeyBJUHJvZ3Jlc3NTdGF0ZSB9IGZyb20gJ0B4dGVybS9hZGRvbi1wcm9ncmVzcyc7XG5pbXBvcnQgdHlwZSB7IENvbW1hbmREZXRlY3Rpb25DYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eS5qcyc7XG5cbmNvbnN0IGVudW0gUmVuZGVyQ29uc3RhbnRzIHtcblx0U21vb3RoU2Nyb2xsRHVyYXRpb24gPSAxMjVcbn1cblxuXG5mdW5jdGlvbiBnZXRGdWxsQnVmZmVyTGluZUFzU3RyaW5nKGxpbmVJbmRleDogbnVtYmVyLCBidWZmZXI6IElCdWZmZXIpOiB7IGxpbmVEYXRhOiBzdHJpbmcgfCB1bmRlZmluZWQ7IGxpbmVJbmRleDogbnVtYmVyIH0ge1xuXHRsZXQgbGluZSA9IGJ1ZmZlci5nZXRMaW5lKGxpbmVJbmRleCk7XG5cdGlmICghbGluZSkge1xuXHRcdHJldHVybiB7IGxpbmVEYXRhOiB1bmRlZmluZWQsIGxpbmVJbmRleCB9O1xuXHR9XG5cdGxldCBsaW5lRGF0YSA9IGxpbmUudHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSk7XG5cdHdoaWxlIChsaW5lSW5kZXggPiAwICYmIGxpbmUuaXNXcmFwcGVkKSB7XG5cdFx0bGluZSA9IGJ1ZmZlci5nZXRMaW5lKC0tbGluZUluZGV4KTtcblx0XHRpZiAoIWxpbmUpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRsaW5lRGF0YSA9IGxpbmUudHJhbnNsYXRlVG9TdHJpbmcoZmFsc2UpICsgbGluZURhdGE7XG5cdH1cblx0cmV0dXJuIHsgbGluZURhdGEsIGxpbmVJbmRleCB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElYdGVybVRlcm1pbmFsT3B0aW9ucyB7XG5cdC8qKiBUaGUgY29sdW1ucyB0byBpbml0aWFsaXplIHRoZSB0ZXJtaW5hbCB3aXRoLiAqL1xuXHRjb2xzOiBudW1iZXI7XG5cdC8qKiBUaGUgcm93cyB0byBpbml0aWFsaXplIHRoZSB0ZXJtaW5hbCB3aXRoLiAqL1xuXHRyb3dzOiBudW1iZXI7XG5cdC8qKiBUaGUgY29sb3IgcHJvdmlkZXIgZm9yIHRoZSB0ZXJtaW5hbC4gKi9cblx0eHRlcm1Db2xvclByb3ZpZGVyOiBJWHRlcm1Db2xvclByb3ZpZGVyO1xuXHQvKiogVGhlIGNhcGFiaWxpdGllcyBvZiB0aGUgdGVybWluYWwuICovXG5cdGNhcGFiaWxpdGllczogSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlO1xuXHQvKiogVGhlIHNoZWxsIGludGVncmF0aW9uIG5vbmNlIHRvIHZlcmlmeSBkYXRhIGNvbWluZyBmcm9tIFNJIGlzIHRydXN0d29ydGh5LiAqL1xuXHRzaGVsbEludGVncmF0aW9uTm9uY2U/OiBzdHJpbmc7XG5cdC8qKiBXaGV0aGVyIHRvIGRpc2FibGUgc2hlbGwgaW50ZWdyYXRpb24gdGVsZW1ldHJ5IHJlcG9ydGluZy4gKi9cblx0ZGlzYWJsZVNoZWxsSW50ZWdyYXRpb25SZXBvcnRpbmc/OiBib29sZWFuO1xuXHQvKiogVGhlIG9iamVjdCB0aGF0IGltcG9ydHMgeHRlcm0gYWRkb25zLCBzZXQgdGhpcyB0byBpbmplY3QgYW4gaW1wb3J0ZXIgaW4gdGVzdHMuICovXG5cdHh0ZXJtQWRkb25JbXBvcnRlcj86IFh0ZXJtQWRkb25JbXBvcnRlcjtcbn1cblxuLyoqXG4gKiBXcmFwcyB0aGUgeHRlcm0gb2JqZWN0IHdpdGggYWRkaXRpb25hbCBmdW5jdGlvbmFsaXR5LiBJbnRlcmFjdGlvbiB3aXRoIHRoZSBiYWNraW5nIHByb2Nlc3MgaXMgb3V0XG4gKiBvZiB0aGUgc2NvcGUgb2YgdGhpcyBjbGFzcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFh0ZXJtVGVybWluYWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVh0ZXJtVGVybWluYWwsIElEZXRhY2hlZFh0ZXJtVGVybWluYWwsIElJbnRlcm5hbFh0ZXJtVGVybWluYWwge1xuXHQvKiogVGhlIHJhdyB4dGVybS5qcyBpbnN0YW5jZSAqL1xuXHRyZWFkb25seSByYXc6IFJhd1h0ZXJtVGVybWluYWw7XG5cdHByaXZhdGUgX2NvcmU6IElYdGVybUNvcmU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3h0ZXJtQWRkb25Mb2FkZXI6IFh0ZXJtQWRkb25JbXBvcnRlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfeHRlcm1Db2xvclByb3ZpZGVyOiBJWHRlcm1Db2xvclByb3ZpZGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jYXBhYmlsaXRpZXM6IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZTtcblxuXHRwcml2YXRlIHN0YXRpYyBfc3VnZ2VzdGVkUmVuZGVyZXJUeXBlOiAnZG9tJyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYXR0YWNoZWQ/OiB7IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7IG9wdGlvbnM6IElYdGVybUF0dGFjaFRvRWxlbWVudE9wdGlvbnMgfTtcblx0cHJpdmF0ZSBfaXNQaHlzaWNhbE1vdXNlV2hlZWwgPSBNb3VzZVdoZWVsQ2xhc3NpZmllci5JTlNUQU5DRS5pc1BoeXNpY2FsTW91c2VXaGVlbCgpO1xuXHRwcml2YXRlIF9sYXN0SW5wdXRFdmVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXQgbGFzdElucHV0RXZlbnQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2xhc3RJbnB1dEV2ZW50OyB9XG5cdHByaXZhdGUgX3Byb2dyZXNzU3RhdGU6IElQcm9ncmVzc1N0YXRlID0geyBzdGF0ZTogMCwgdmFsdWU6IDAgfTtcblx0Z2V0IHByb2dyZXNzU3RhdGUoKTogSVByb2dyZXNzU3RhdGUgeyByZXR1cm4gdGhpcy5fcHJvZ3Jlc3NTdGF0ZTsgfVxuXG5cdC8vIEFsd2F5cyBvbiBhZGRvbnNcblx0cHJpdmF0ZSBfbWFya05hdmlnYXRpb25BZGRvbjogTWFya05hdmlnYXRpb25BZGRvbjtcblx0cHJpdmF0ZSBfc2hlbGxJbnRlZ3JhdGlvbkFkZG9uOiBTaGVsbEludGVncmF0aW9uQWRkb247XG5cdHByaXZhdGUgX2RlY29yYXRpb25BZGRvbjogRGVjb3JhdGlvbkFkZG9uO1xuXG5cdC8vIEFsd2F5cyBvbiBkeW5hbWljbHkgaW1wb3J0ZWQgYWRkb25zXG5cdHByaXZhdGUgX2NsaXBib2FyZEFkZG9uPzogQ2xpcGJvYXJkQWRkb25UeXBlO1xuXG5cdC8vIE9wdGlvbmFsIGFkZG9uc1xuXHRwcml2YXRlIF9zZWFyY2hBZGRvbj86IFNlYXJjaEFkZG9uVHlwZTtcblx0cHJpdmF0ZSBfdW5pY29kZTExQWRkb24/OiBVbmljb2RlMTFBZGRvblR5cGU7XG5cdHByaXZhdGUgX3dlYmdsQWRkb24/OiBXZWJnbEFkZG9uVHlwZTtcblx0cHJpdmF0ZSBfc2VyaWFsaXplQWRkb24/OiBTZXJpYWxpemVBZGRvblR5cGU7XG5cdHByaXZhdGUgX2ltYWdlQWRkb24/OiBJbWFnZUFkZG9uVHlwZTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGlnYXR1cmVzQWRkb246IE11dGFibGVEaXNwb3NhYmxlPExpZ2F0dXJlc0FkZG9uVHlwZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpZ2F0dXJlc0FkZG9uQ29uZmlnPzogSUxpZ2F0dXJlT3B0aW9ucztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hdHRhY2hlZERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfYW55VGVybWluYWxGb2N1c0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hbnlGb2N1c2VkVGVybWluYWxIYXNTZWxlY3Rpb246IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgX2xhc3RGaW5kUmVzdWx0OiB7IHJlc3VsdEluZGV4OiBudW1iZXI7IHJlc3VsdENvdW50OiBudW1iZXIgfSB8IHVuZGVmaW5lZDtcblx0Z2V0IGZpbmRSZXN1bHQoKTogeyByZXN1bHRJbmRleDogbnVtYmVyOyByZXN1bHRDb3VudDogbnVtYmVyIH0gfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fbGFzdEZpbmRSZXN1bHQ7IH1cblxuXHRnZXQgaXNTdGRpbkRpc2FibGVkKCk6IGJvb2xlYW4geyByZXR1cm4gISF0aGlzLnJhdy5vcHRpb25zLmRpc2FibGVTdGRpbjsgfVxuXHRnZXQgaXNHcHVBY2NlbGVyYXRlZCgpOiBib29sZWFuIHsgcmV0dXJuICEhdGhpcy5fd2ViZ2xBZGRvbjsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVxdWVzdFJ1bkNvbW1hbmQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGNvbW1hbmQ6IElUZXJtaW5hbENvbW1hbmQ7IG5vTmV3TGluZT86IGJvb2xlYW4gfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVxdWVzdFJ1bkNvbW1hbmQgPSB0aGlzLl9vbkRpZFJlcXVlc3RSdW5Db21tYW5kLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlcXVlc3RDb3B5QXNIdG1sID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBjb21tYW5kOiBJVGVybWluYWxDb21tYW5kIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcXVlc3RDb3B5QXNIdG1sID0gdGhpcy5fb25EaWRSZXF1ZXN0Q29weUFzSHRtbC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXF1ZXN0UmVmcmVzaERpbWVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRSZXF1ZXN0UmVmcmVzaERpbWVuc2lvbnMgPSB0aGlzLl9vbkRpZFJlcXVlc3RSZWZyZXNoRGltZW5zaW9ucy5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VGaW5kUmVzdWx0cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgcmVzdWx0SW5kZXg6IG51bWJlcjsgcmVzdWx0Q291bnQ6IG51bWJlciB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGaW5kUmVzdWx0cyA9IHRoaXMuX29uRGlkQ2hhbmdlRmluZFJlc3VsdHMuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRm9jdXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGb2N1cyA9IHRoaXMuX29uRGlkQ2hhbmdlRm9jdXMuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZERpc3Bvc2UgPSB0aGlzLl9vbkRpZERpc3Bvc2UuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUHJvZ3Jlc3MgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHJvZ3Jlc3NTdGF0ZT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUHJvZ3Jlc3MgPSB0aGlzLl9vbkRpZENoYW5nZVByb2dyZXNzLmV2ZW50O1xuXG5cdGdldCBtYXJrVHJhY2tlcigpOiBJTWFya1RyYWNrZXIgeyByZXR1cm4gdGhpcy5fbWFya05hdmlnYXRpb25BZGRvbjsgfVxuXHRnZXQgc2hlbGxJbnRlZ3JhdGlvbigpOiBJU2hlbGxJbnRlZ3JhdGlvbiB7IHJldHVybiB0aGlzLl9zaGVsbEludGVncmF0aW9uQWRkb247IH1cblx0Z2V0IGRlY29yYXRpb25BZGRvbigpOiBJRGVjb3JhdGlvbkFkZG9uIHsgcmV0dXJuIHRoaXMuX2RlY29yYXRpb25BZGRvbjsgfVxuXG5cdGdldCB0ZXh0dXJlQXRsYXMoKTogUHJvbWlzZTxJbWFnZUJpdG1hcD4gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNhbnZhcyA9IHRoaXMuX3dlYmdsQWRkb24/LnRleHR1cmVBdGxhcztcblx0XHRpZiAoIWNhbnZhcykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIGNyZWF0ZUltYWdlQml0bWFwKGNhbnZhcyk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzRm9jdXNlZCgpIHtcblx0XHRpZiAoIXRoaXMucmF3LmVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGRvbS5pc0FuY2VzdG9yT2ZBY3RpdmVFbGVtZW50KHRoaXMucmF3LmVsZW1lbnQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB4dGVybUN0b3IgVGhlIHh0ZXJtLmpzIGNvbnN0cnVjdG9yLCB0aGlzIGlzIHBhc3NlZCBpbiBzbyBpdCBjYW4gYmUgZmV0Y2hlZCBsYXppbHlcblx0ICogb3V0c2lkZSBvZiB0aGlzIGNsYXNzIHN1Y2ggdGhhdCB7QGxpbmsgcmF3fSBpcyBub3QgbnVsbGFibGUuXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihcblx0XHR4dGVybUN0b3I6IHR5cGVvZiBSYXdYdGVybVRlcm1pbmFsLFxuXHRcdG9wdGlvbnM6IElYdGVybVRlcm1pbmFsT3B0aW9ucyxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElUZXJtaW5hbExvZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZTogSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLFxuXHRcdEBJTGF5b3V0U2VydmljZSBsYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5feHRlcm1BZGRvbkxvYWRlciA9IG9wdGlvbnMueHRlcm1BZGRvbkltcG9ydGVyID8/IG5ldyBYdGVybUFkZG9uSW1wb3J0ZXIoKTtcblx0XHR0aGlzLl94dGVybUNvbG9yUHJvdmlkZXIgPSBvcHRpb25zLnh0ZXJtQ29sb3JQcm92aWRlcjtcblx0XHR0aGlzLl9jYXBhYmlsaXRpZXMgPSBvcHRpb25zLmNhcGFiaWxpdGllcztcblxuXHRcdGNvbnN0IGZvbnQgPSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEZvbnQoZG9tLmdldEFjdGl2ZVdpbmRvdygpLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnO1xuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRWRpdG9yT3B0aW9ucz4oJ2VkaXRvcicpO1xuXG5cdFx0dGhpcy5yYXcgPSB0aGlzLl9yZWdpc3RlcihuZXcgeHRlcm1DdG9yKHtcblx0XHRcdGFsbG93UHJvcG9zZWRBcGk6IHRydWUsXG5cdFx0XHRjb2xzOiBvcHRpb25zLmNvbHMsXG5cdFx0XHRyb3dzOiBvcHRpb25zLnJvd3MsXG5cdFx0XHRkb2N1bWVudE92ZXJyaWRlOiBsYXlvdXRTZXJ2aWNlLm1haW5Db250YWluZXIub3duZXJEb2N1bWVudCxcblx0XHRcdGFsdENsaWNrTW92ZXNDdXJzb3I6IGNvbmZpZy5hbHRDbGlja01vdmVzQ3Vyc29yICYmIGVkaXRvck9wdGlvbnMubXVsdGlDdXJzb3JNb2RpZmllciA9PT0gJ2FsdCcsXG5cdFx0XHRzY3JvbGxiYWNrOiBjb25maWcuc2Nyb2xsYmFjayxcblx0XHRcdHRoZW1lOiB0aGlzLmdldFh0ZXJtVGhlbWUoKSxcblx0XHRcdGRyYXdCb2xkVGV4dEluQnJpZ2h0Q29sb3JzOiBjb25maWcuZHJhd0JvbGRUZXh0SW5CcmlnaHRDb2xvcnMsXG5cdFx0XHRmb250RmFtaWx5OiBmb250LmZvbnRGYW1pbHksXG5cdFx0XHRmb250V2VpZ2h0OiBjb25maWcuZm9udFdlaWdodCxcblx0XHRcdGZvbnRXZWlnaHRCb2xkOiBjb25maWcuZm9udFdlaWdodEJvbGQsXG5cdFx0XHRmb250U2l6ZTogZm9udC5mb250U2l6ZSxcblx0XHRcdGxldHRlclNwYWNpbmc6IGZvbnQubGV0dGVyU3BhY2luZyxcblx0XHRcdGxpbmVIZWlnaHQ6IGZvbnQubGluZUhlaWdodCxcblx0XHRcdGxvZ0xldmVsOiB2c2NvZGVUb1h0ZXJtTG9nTGV2ZWwodGhpcy5fbG9nU2VydmljZS5nZXRMZXZlbCgpKSxcblx0XHRcdGxvZ2dlcjogdGhpcy5fbG9nU2VydmljZSxcblx0XHRcdG1pbmltdW1Db250cmFzdFJhdGlvOiBjb25maWcubWluaW11bUNvbnRyYXN0UmF0aW8sXG5cdFx0XHR0YWJTdG9wV2lkdGg6IGNvbmZpZy50YWJTdG9wV2lkdGgsXG5cdFx0XHRjdXJzb3JCbGluazogY29uZmlnLmN1cnNvckJsaW5raW5nLFxuXHRcdFx0Y3Vyc29yU3R5bGU6IHZzY29kZVRvWHRlcm1DdXJzb3JTdHlsZTwnY3Vyc29yU3R5bGUnPihjb25maWcuY3Vyc29yU3R5bGUpLFxuXHRcdFx0Y3Vyc29ySW5hY3RpdmVTdHlsZTogdnNjb2RlVG9YdGVybUN1cnNvclN0eWxlKGNvbmZpZy5jdXJzb3JTdHlsZUluYWN0aXZlKSxcblx0XHRcdGN1cnNvcldpZHRoOiBjb25maWcuY3Vyc29yV2lkdGgsXG5cdFx0XHRtYWNPcHRpb25Jc01ldGE6IGNvbmZpZy5tYWNPcHRpb25Jc01ldGEsXG5cdFx0XHRtYWNPcHRpb25DbGlja0ZvcmNlc1NlbGVjdGlvbjogY29uZmlnLm1hY09wdGlvbkNsaWNrRm9yY2VzU2VsZWN0aW9uLFxuXHRcdFx0cmlnaHRDbGlja1NlbGVjdHNXb3JkOiBjb25maWcucmlnaHRDbGlja0JlaGF2aW9yID09PSAnc2VsZWN0V29yZCcsXG5cdFx0XHRmYXN0U2Nyb2xsTW9kaWZpZXI6ICdhbHQnLFxuXHRcdFx0ZmFzdFNjcm9sbFNlbnNpdGl2aXR5OiBjb25maWcuZmFzdFNjcm9sbFNlbnNpdGl2aXR5LFxuXHRcdFx0c2Nyb2xsU2Vuc2l0aXZpdHk6IGNvbmZpZy5tb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHksXG5cdFx0XHR3b3JkU2VwYXJhdG9yOiBjb25maWcud29yZFNlcGFyYXRvcnMsXG5cdFx0XHRvdmVydmlld1J1bGVyOiB7XG5cdFx0XHRcdHdpZHRoOiAxNCxcblx0XHRcdFx0c2hvd1RvcEJvcmRlcjogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRpZ25vcmVCcmFja2V0ZWRQYXN0ZU1vZGU6IGNvbmZpZy5pZ25vcmVCcmFja2V0ZWRQYXN0ZU1vZGUsXG5cdFx0XHRyZXNjYWxlT3ZlcmxhcHBpbmdHbHlwaHM6IGNvbmZpZy5yZXNjYWxlT3ZlcmxhcHBpbmdHbHlwaHMsXG5cdFx0XHR3aW5kb3dPcHRpb25zOiB7XG5cdFx0XHRcdGdldFdpblNpemVQaXhlbHM6IHRydWUsXG5cdFx0XHRcdGdldENlbGxTaXplUGl4ZWxzOiB0cnVlLFxuXHRcdFx0XHRnZXRXaW5TaXplQ2hhcnM6IHRydWUsXG5cdFx0XHR9LFxuXHRcdH0pKTtcblx0XHR0aGlzLl91cGRhdGVTbW9vdGhTY3JvbGxpbmcoKTtcblx0XHR0aGlzLl9jb3JlID0gKHRoaXMucmF3IGFzIGFueSkuX2NvcmUgYXMgSVh0ZXJtQ29yZTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihhc3luYyBlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsU2V0dGluZ0lkLkdwdUFjY2VsZXJhdGlvbikpIHtcblx0XHRcdFx0WHRlcm1UZXJtaW5hbC5fc3VnZ2VzdGVkUmVuZGVyZXJUeXBlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3Rlcm1pbmFsLmludGVncmF0ZWQnKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuZmFzdFNjcm9sbFNlbnNpdGl2aXR5JykgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZWRpdG9yLm1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eScpIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5tdWx0aUN1cnNvck1vZGlmaWVyJykpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVDb25maWcoKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsU2V0dGluZ0lkLlVuaWNvZGVWZXJzaW9uKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVVbmljb2RlVmVyc2lvbigpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuU2hlbGxJbnRlZ3JhdGlvbkRlY29yYXRpb25zRW5hYmxlZCkpIHtcblx0XHRcdFx0dGhpcy5fdXBkYXRlVGhlbWUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKHRoZW1lID0+IHRoaXMuX3VwZGF0ZVRoZW1lKHRoZW1lKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2xvZ1NlcnZpY2Uub25EaWRDaGFuZ2VMb2dMZXZlbChlID0+IHRoaXMucmF3Lm9wdGlvbnMubG9nTGV2ZWwgPSB2c2NvZGVUb1h0ZXJtTG9nTGV2ZWwoZSkpKTtcblxuXHRcdC8vIFJlZmlyZSBldmVudHNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJhdy5vblNlbGVjdGlvbkNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5maXJlKCk7XG5cdFx0XHRpZiAodGhpcy5pc0ZvY3VzZWQpIHtcblx0XHRcdFx0dGhpcy5fYW55Rm9jdXNlZFRlcm1pbmFsSGFzU2VsZWN0aW9uLnNldCh0aGlzLnJhdy5oYXNTZWxlY3Rpb24oKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmF3Lm9uRGF0YShlID0+IHRoaXMuX2xhc3RJbnB1dEV2ZW50ID0gZSkpO1xuXG5cdFx0Ly8gTG9hZCBhZGRvbnNcblx0XHR0aGlzLl91cGRhdGVVbmljb2RlVmVyc2lvbigpO1xuXHRcdHRoaXMuX21hcmtOYXZpZ2F0aW9uQWRkb24gPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrTmF2aWdhdGlvbkFkZG9uLCBvcHRpb25zLmNhcGFiaWxpdGllcyk7XG5cdFx0dGhpcy5yYXcubG9hZEFkZG9uKHRoaXMuX21hcmtOYXZpZ2F0aW9uQWRkb24pO1xuXHRcdHRoaXMuX2RlY29yYXRpb25BZGRvbiA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERlY29yYXRpb25BZGRvbiwgdGhpcy5fY2FwYWJpbGl0aWVzKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9kZWNvcmF0aW9uQWRkb24ub25EaWRSZXF1ZXN0UnVuQ29tbWFuZChlID0+IHRoaXMuX29uRGlkUmVxdWVzdFJ1bkNvbW1hbmQuZmlyZShlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2RlY29yYXRpb25BZGRvbi5vbkRpZFJlcXVlc3RDb3B5QXNIdG1sKGUgPT4gdGhpcy5fb25EaWRSZXF1ZXN0Q29weUFzSHRtbC5maXJlKGUpKSk7XG5cdFx0dGhpcy5yYXcubG9hZEFkZG9uKHRoaXMuX2RlY29yYXRpb25BZGRvbik7XG5cdFx0dGhpcy5fc2hlbGxJbnRlZ3JhdGlvbkFkZG9uID0gbmV3IFNoZWxsSW50ZWdyYXRpb25BZGRvbihvcHRpb25zLnNoZWxsSW50ZWdyYXRpb25Ob25jZSA/PyAnJywgb3B0aW9ucy5kaXNhYmxlU2hlbGxJbnRlZ3JhdGlvblJlcG9ydGluZywgdGhpcy5fdGVsZW1ldHJ5U2VydmljZSwgdGhpcy5fbG9nU2VydmljZSk7XG5cdFx0dGhpcy5yYXcubG9hZEFkZG9uKHRoaXMuX3NoZWxsSW50ZWdyYXRpb25BZGRvbik7XG5cdFx0dGhpcy5feHRlcm1BZGRvbkxvYWRlci5pbXBvcnRBZGRvbignY2xpcGJvYXJkJykudGhlbihDbGlwYm9hcmRBZGRvbiA9PiB7XG5cdFx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jbGlwYm9hcmRBZGRvbiA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENsaXBib2FyZEFkZG9uLCB1bmRlZmluZWQsIHtcblx0XHRcdFx0YXN5bmMgcmVhZFRleHQodHlwZTogQ2xpcGJvYXJkU2VsZWN0aW9uVHlwZSk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0XHRcdFx0cmV0dXJuIF9jbGlwYm9hcmRTZXJ2aWNlLnJlYWRUZXh0KHR5cGUgPT09ICdwJyA/ICdzZWxlY3Rpb24nIDogJ2NsaXBib2FyZCcpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRhc3luYyB3cml0ZVRleHQodHlwZTogQ2xpcGJvYXJkU2VsZWN0aW9uVHlwZSwgdGV4dDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0cmV0dXJuIF9jbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dCh0ZXh0LCB0eXBlID09PSAncCcgPyAnc2VsZWN0aW9uJyA6ICdjbGlwYm9hcmQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLnJhdy5sb2FkQWRkb24odGhpcy5fY2xpcGJvYXJkQWRkb24pO1xuXHRcdH0pO1xuXHRcdHRoaXMuX3h0ZXJtQWRkb25Mb2FkZXIuaW1wb3J0QWRkb24oJ3Byb2dyZXNzJykudGhlbihQcm9ncmVzc0FkZG9uID0+IHtcblx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHByb2dyZXNzQWRkb24gPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQcm9ncmVzc0FkZG9uKTtcblx0XHRcdHRoaXMucmF3LmxvYWRBZGRvbihwcm9ncmVzc0FkZG9uKTtcblx0XHRcdGNvbnN0IHVwZGF0ZVByb2dyZXNzID0gKCkgPT4ge1xuXHRcdFx0XHRpZiAoIWVxdWFscyh0aGlzLl9wcm9ncmVzc1N0YXRlLCBwcm9ncmVzc0FkZG9uLnByb2dyZXNzKSkge1xuXHRcdFx0XHRcdHRoaXMuX3Byb2dyZXNzU3RhdGUgPSBwcm9ncmVzc0FkZG9uLnByb2dyZXNzO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvZ3Jlc3MuZmlyZSh0aGlzLl9wcm9ncmVzc1N0YXRlKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHByb2dyZXNzQWRkb24ub25DaGFuZ2UoKCkgPT4gdXBkYXRlUHJvZ3Jlc3MoKSkpO1xuXHRcdFx0dXBkYXRlUHJvZ3Jlc3MoKTtcblx0XHRcdGNvbnN0IGNvbW1hbmREZXRlY3Rpb24gPSB0aGlzLl9jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKTtcblx0XHRcdGlmIChjb21tYW5kRGV0ZWN0aW9uKSB7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKGNvbW1hbmREZXRlY3Rpb24ub25Db21tYW5kRmluaXNoZWQoKCkgPT4gcHJvZ3Jlc3NBZGRvbi5wcm9ncmVzcyA9IHsgc3RhdGU6IDAsIHZhbHVlOiAwIH0pKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzLl9jYXBhYmlsaXRpZXMub25EaWRBZGRDYXBhYmlsaXR5KGUgPT4ge1xuXHRcdFx0XHRcdGlmIChlLmlkID09PSBUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbikge1xuXHRcdFx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoKGUuY2FwYWJpbGl0eSBhcyBDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSkub25Db21tYW5kRmluaXNoZWQoKCkgPT4gcHJvZ3Jlc3NBZGRvbi5wcm9ncmVzcyA9IHsgc3RhdGU6IDAsIHZhbHVlOiAwIH0pKTtcblx0XHRcdFx0XHRcdHRoaXMuX3N0b3JlLmRlbGV0ZShkaXNwb3NhYmxlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLl9zdG9yZS5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9hbnlUZXJtaW5hbEZvY3VzQ29udGV4dEtleSA9IFRlcm1pbmFsQ29udGV4dEtleXMuZm9jdXNJbkFueS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2FueUZvY3VzZWRUZXJtaW5hbEhhc1NlbGVjdGlvbiA9IFRlcm1pbmFsQ29udGV4dEtleXMudGV4dFNlbGVjdGVkSW5Gb2N1c2VkLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHQqZ2V0QnVmZmVyUmV2ZXJzZUl0ZXJhdG9yKCk6IEl0ZXJhYmxlSXRlcmF0b3I8c3RyaW5nPiB7XG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMucmF3LmJ1ZmZlci5hY3RpdmUubGVuZ3RoOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgeyBsaW5lRGF0YSwgbGluZUluZGV4IH0gPSBnZXRGdWxsQnVmZmVyTGluZUFzU3RyaW5nKGksIHRoaXMucmF3LmJ1ZmZlci5hY3RpdmUpO1xuXHRcdFx0aWYgKGxpbmVEYXRhKSB7XG5cdFx0XHRcdGkgPSBsaW5lSW5kZXg7XG5cdFx0XHRcdHlpZWxkIGxpbmVEYXRhO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGdldENvbnRlbnRzQXNIdG1sKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKCF0aGlzLl9zZXJpYWxpemVBZGRvbikge1xuXHRcdFx0Y29uc3QgQWRkb24gPSBhd2FpdCB0aGlzLl94dGVybUFkZG9uTG9hZGVyLmltcG9ydEFkZG9uKCdzZXJpYWxpemUnKTtcblx0XHRcdHRoaXMuX3NlcmlhbGl6ZUFkZG9uID0gbmV3IEFkZG9uKCk7XG5cdFx0XHR0aGlzLnJhdy5sb2FkQWRkb24odGhpcy5fc2VyaWFsaXplQWRkb24pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9zZXJpYWxpemVBZGRvbi5zZXJpYWxpemVBc0hUTUwoKTtcblx0fVxuXG5cdGFzeW5jIGdldFNlbGVjdGlvbkFzSHRtbChjb21tYW5kPzogSVRlcm1pbmFsQ29tbWFuZCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKCF0aGlzLl9zZXJpYWxpemVBZGRvbikge1xuXHRcdFx0Y29uc3QgQWRkb24gPSBhd2FpdCB0aGlzLl94dGVybUFkZG9uTG9hZGVyLmltcG9ydEFkZG9uKCdzZXJpYWxpemUnKTtcblx0XHRcdHRoaXMuX3NlcmlhbGl6ZUFkZG9uID0gbmV3IEFkZG9uKCk7XG5cdFx0XHR0aGlzLnJhdy5sb2FkQWRkb24odGhpcy5fc2VyaWFsaXplQWRkb24pO1xuXHRcdH1cblx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0Y29uc3QgbGVuZ3RoID0gY29tbWFuZC5nZXRPdXRwdXQoKT8ubGVuZ3RoO1xuXHRcdFx0Y29uc3Qgcm93ID0gY29tbWFuZC5tYXJrZXI/LmxpbmU7XG5cdFx0XHRpZiAoIWxlbmd0aCB8fCAhcm93KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgTm8gcm93ICR7cm93fSBvciBvdXRwdXQgbGVuZ3RoICR7bGVuZ3RofSBmb3IgY29tbWFuZCAke2NvbW1hbmR9YCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJhdy5zZWxlY3QoMCwgcm93ICsgMSwgbGVuZ3RoIC0gTWF0aC5mbG9vcihsZW5ndGggLyB0aGlzLnJhdy5jb2xzKSk7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX3NlcmlhbGl6ZUFkZG9uLnNlcmlhbGl6ZUFzSFRNTCh7IG9ubHlTZWxlY3Rpb246IHRydWUgfSk7XG5cdFx0aWYgKGNvbW1hbmQpIHtcblx0XHRcdHRoaXMucmF3LmNsZWFyU2VsZWN0aW9uKCk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRhdHRhY2hUb0VsZW1lbnQoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgcGFydGlhbE9wdGlvbnM/OiBQYXJ0aWFsPElYdGVybUF0dGFjaFRvRWxlbWVudE9wdGlvbnM+KTogSFRNTEVsZW1lbnQge1xuXHRcdGNvbnN0IG9wdGlvbnM6IElYdGVybUF0dGFjaFRvRWxlbWVudE9wdGlvbnMgPSB7IGVuYWJsZUdwdTogdHJ1ZSwgLi4ucGFydGlhbE9wdGlvbnMgfTtcblx0XHRpZiAoIXRoaXMuX2F0dGFjaGVkKSB7XG5cdFx0XHR0aGlzLnJhdy5vcGVuKGNvbnRhaW5lcik7XG5cdFx0fVxuXG5cdFx0Ly8gVE9ETzogTW92ZSBiZWZvcmUgb3BlbiBzbyB0aGUgRE9NIHJlbmRlcmVyIGRvZXNuJ3QgaW5pdGlhbGl6ZVxuXHRcdGlmIChvcHRpb25zLmVuYWJsZUdwdSkge1xuXHRcdFx0aWYgKHRoaXMuX3Nob3VsZExvYWRXZWJnbCgpKSB7XG5cdFx0XHRcdHRoaXMuX2VuYWJsZVdlYmdsUmVuZGVyZXIoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXRoaXMucmF3LmVsZW1lbnQgfHwgIXRoaXMucmF3LnRleHRhcmVhKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3h0ZXJtIGVsZW1lbnRzIG5vdCBzZXQgYWZ0ZXIgb3BlbicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFkID0gdGhpcy5fYXR0YWNoZWREaXNwb3NhYmxlcztcblx0XHRhZC5jbGVhcigpO1xuXHRcdGFkLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMucmF3LnRleHRhcmVhLCAnZm9jdXMnLCAoKSA9PiB0aGlzLl9zZXRGb2N1c2VkKHRydWUpKSk7XG5cdFx0YWQuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5yYXcudGV4dGFyZWEsICdibHVyJywgKCkgPT4gdGhpcy5fc2V0Rm9jdXNlZChmYWxzZSkpKTtcblx0XHRhZC5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnJhdy50ZXh0YXJlYSwgJ2ZvY3Vzb3V0JywgKCkgPT4gdGhpcy5fc2V0Rm9jdXNlZChmYWxzZSkpKTtcblxuXHRcdC8vIFRyYWNrIHdoZWVsIGV2ZW50cyBpbiBtb3VzZSB3aGVlbCBjbGFzc2lmaWVyIGFuZCB1cGRhdGUgc21vb3RoU2Nyb2xsaW5nIHdoZW4gaXQgY2hhbmdlc1xuXHRcdC8vIGFzIGl0IG11c3QgYmUgZGlzYWJsZWQgd2hlbiBhIHRyYWNrcGFkIGlzIHVzZWRcblx0XHRhZC5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnJhdy5lbGVtZW50LCBkb20uRXZlbnRUeXBlLk1PVVNFX1dIRUVMLCAoZTogSU1vdXNlV2hlZWxFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgY2xhc3NpZmllciA9IE1vdXNlV2hlZWxDbGFzc2lmaWVyLklOU1RBTkNFO1xuXHRcdFx0Y2xhc3NpZmllci5hY2NlcHRTdGFuZGFyZFdoZWVsRXZlbnQobmV3IFN0YW5kYXJkV2hlZWxFdmVudChlKSk7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGNsYXNzaWZpZXIuaXNQaHlzaWNhbE1vdXNlV2hlZWwoKTtcblx0XHRcdGlmICh2YWx1ZSAhPT0gdGhpcy5faXNQaHlzaWNhbE1vdXNlV2hlZWwpIHtcblx0XHRcdFx0dGhpcy5faXNQaHlzaWNhbE1vdXNlV2hlZWwgPSB2YWx1ZTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlU21vb3RoU2Nyb2xsaW5nKCk7XG5cdFx0XHR9XG5cdFx0fSwgeyBwYXNzaXZlOiB0cnVlIH0pKTtcblxuXHRcdHRoaXMuX3JlZnJlc2hMaWdhdHVyZXNBZGRvbigpO1xuXG5cdFx0dGhpcy5fYXR0YWNoZWQgPSB7IGNvbnRhaW5lciwgb3B0aW9ucyB9O1xuXHRcdC8vIFNjcmVlbiBtdXN0IGJlIGNyZWF0ZWQgYXQgdGhpcyBwb2ludCBhcyB4dGVybS5vcGVuIGlzIGNhbGxlZFxuXHRcdHJldHVybiB0aGlzLl9hdHRhY2hlZD8uY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy54dGVybS1zY3JlZW4nKSE7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRGb2N1c2VkKGlzRm9jdXNlZDogYm9vbGVhbikge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRm9jdXMuZmlyZShpc0ZvY3VzZWQpO1xuXHRcdHRoaXMuX2FueVRlcm1pbmFsRm9jdXNDb250ZXh0S2V5LnNldChpc0ZvY3VzZWQpO1xuXHRcdHRoaXMuX2FueUZvY3VzZWRUZXJtaW5hbEhhc1NlbGVjdGlvbi5zZXQoaXNGb2N1c2VkICYmIHRoaXMucmF3Lmhhc1NlbGVjdGlvbigpKTtcblx0fVxuXG5cdHdyaXRlKGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXksIGNhbGxiYWNrPzogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdHRoaXMucmF3LndyaXRlKGRhdGEsIGNhbGxiYWNrKTtcblx0fVxuXG5cdHJlc2l6ZShjb2x1bW5zOiBudW1iZXIsIHJvd3M6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMucmF3LnJlc2l6ZShjb2x1bW5zLCByb3dzKTtcblx0fVxuXG5cdHVwZGF0ZUNvbmZpZygpOiB2b2lkIHtcblx0XHRjb25zdCBjb25maWcgPSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZztcblx0XHR0aGlzLnJhdy5vcHRpb25zLmFsdENsaWNrTW92ZXNDdXJzb3IgPSBjb25maWcuYWx0Q2xpY2tNb3Zlc0N1cnNvcjtcblx0XHR0aGlzLl9zZXRDdXJzb3JCbGluayhjb25maWcuY3Vyc29yQmxpbmtpbmcpO1xuXHRcdHRoaXMuX3NldEN1cnNvclN0eWxlKGNvbmZpZy5jdXJzb3JTdHlsZSk7XG5cdFx0dGhpcy5fc2V0Q3Vyc29yU3R5bGVJbmFjdGl2ZShjb25maWcuY3Vyc29yU3R5bGVJbmFjdGl2ZSk7XG5cdFx0dGhpcy5fc2V0Q3Vyc29yV2lkdGgoY29uZmlnLmN1cnNvcldpZHRoKTtcblx0XHR0aGlzLnJhdy5vcHRpb25zLnNjcm9sbGJhY2sgPSBjb25maWcuc2Nyb2xsYmFjaztcblx0XHR0aGlzLnJhdy5vcHRpb25zLmRyYXdCb2xkVGV4dEluQnJpZ2h0Q29sb3JzID0gY29uZmlnLmRyYXdCb2xkVGV4dEluQnJpZ2h0Q29sb3JzO1xuXHRcdHRoaXMucmF3Lm9wdGlvbnMubWluaW11bUNvbnRyYXN0UmF0aW8gPSBjb25maWcubWluaW11bUNvbnRyYXN0UmF0aW87XG5cdFx0dGhpcy5yYXcub3B0aW9ucy50YWJTdG9wV2lkdGggPSBjb25maWcudGFiU3RvcFdpZHRoO1xuXHRcdHRoaXMucmF3Lm9wdGlvbnMuZmFzdFNjcm9sbFNlbnNpdGl2aXR5ID0gY29uZmlnLmZhc3RTY3JvbGxTZW5zaXRpdml0eTtcblx0XHR0aGlzLnJhdy5vcHRpb25zLnNjcm9sbFNlbnNpdGl2aXR5ID0gY29uZmlnLm1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eTtcblx0XHR0aGlzLnJhdy5vcHRpb25zLm1hY09wdGlvbklzTWV0YSA9IGNvbmZpZy5tYWNPcHRpb25Jc01ldGE7XG5cdFx0Y29uc3QgZWRpdG9yT3B0aW9ucyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JPcHRpb25zPignZWRpdG9yJyk7XG5cdFx0dGhpcy5yYXcub3B0aW9ucy5hbHRDbGlja01vdmVzQ3Vyc29yID0gY29uZmlnLmFsdENsaWNrTW92ZXNDdXJzb3IgJiYgZWRpdG9yT3B0aW9ucy5tdWx0aUN1cnNvck1vZGlmaWVyID09PSAnYWx0Jztcblx0XHR0aGlzLnJhdy5vcHRpb25zLm1hY09wdGlvbkNsaWNrRm9yY2VzU2VsZWN0aW9uID0gY29uZmlnLm1hY09wdGlvbkNsaWNrRm9yY2VzU2VsZWN0aW9uO1xuXHRcdHRoaXMucmF3Lm9wdGlvbnMucmlnaHRDbGlja1NlbGVjdHNXb3JkID0gY29uZmlnLnJpZ2h0Q2xpY2tCZWhhdmlvciA9PT0gJ3NlbGVjdFdvcmQnO1xuXHRcdHRoaXMucmF3Lm9wdGlvbnMud29yZFNlcGFyYXRvciA9IGNvbmZpZy53b3JkU2VwYXJhdG9ycztcblx0XHR0aGlzLnJhdy5vcHRpb25zLmN1c3RvbUdseXBocyA9IGNvbmZpZy5jdXN0b21HbHlwaHM7XG5cdFx0dGhpcy5yYXcub3B0aW9ucy5pZ25vcmVCcmFja2V0ZWRQYXN0ZU1vZGUgPSBjb25maWcuaWdub3JlQnJhY2tldGVkUGFzdGVNb2RlO1xuXHRcdHRoaXMucmF3Lm9wdGlvbnMucmVzY2FsZU92ZXJsYXBwaW5nR2x5cGhzID0gY29uZmlnLnJlc2NhbGVPdmVybGFwcGluZ0dseXBocztcblx0XHR0aGlzLnJhdy5vcHRpb25zLm92ZXJ2aWV3UnVsZXIgPSB7XG5cdFx0XHR3aWR0aDogMTQsXG5cdFx0XHRzaG93VG9wQm9yZGVyOiB0cnVlLFxuXHRcdH07XG5cdFx0dGhpcy5fdXBkYXRlU21vb3RoU2Nyb2xsaW5nKCk7XG5cdFx0aWYgKHRoaXMuX2F0dGFjaGVkKSB7XG5cdFx0XHRpZiAodGhpcy5fYXR0YWNoZWQub3B0aW9ucy5lbmFibGVHcHUpIHtcblx0XHRcdFx0aWYgKHRoaXMuX3Nob3VsZExvYWRXZWJnbCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5fZW5hYmxlV2ViZ2xSZW5kZXJlcigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX2Rpc3Bvc2VPZldlYmdsUmVuZGVyZXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fcmVmcmVzaExpZ2F0dXJlc0FkZG9uKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlU21vb3RoU2Nyb2xsaW5nKCkge1xuXHRcdHRoaXMucmF3Lm9wdGlvbnMuc21vb3RoU2Nyb2xsRHVyYXRpb24gPSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5zbW9vdGhTY3JvbGxpbmcgJiYgdGhpcy5faXNQaHlzaWNhbE1vdXNlV2hlZWwgPyBSZW5kZXJDb25zdGFudHMuU21vb3RoU2Nyb2xsRHVyYXRpb24gOiAwO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2hvdWxkTG9hZFdlYmdsKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZ3B1QWNjZWxlcmF0aW9uID09PSAnYXV0bycgJiYgWHRlcm1UZXJtaW5hbC5fc3VnZ2VzdGVkUmVuZGVyZXJUeXBlID09PSB1bmRlZmluZWQpIHx8IHRoaXMuX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuY29uZmlnLmdwdUFjY2VsZXJhdGlvbiA9PT0gJ29uJztcblx0fVxuXG5cdGZvcmNlUmVkcmF3KCkge1xuXHRcdHRoaXMucmF3LmNsZWFyVGV4dHVyZUF0bGFzKCk7XG5cdH1cblxuXHRjbGVhckRlY29yYXRpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMuX2RlY29yYXRpb25BZGRvbj8uY2xlYXJEZWNvcmF0aW9ucygpO1xuXHR9XG5cblx0Zm9yY2VSZWZyZXNoKCkge1xuXHRcdHRoaXMuX2NvcmUudmlld3BvcnQ/Ll9pbm5lclJlZnJlc2goKTtcblx0fVxuXG5cdGFzeW5jIGZpbmROZXh0KHRlcm06IHN0cmluZywgc2VhcmNoT3B0aW9uczogSVNlYXJjaE9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHR0aGlzLl91cGRhdGVGaW5kQ29sb3JzKHNlYXJjaE9wdGlvbnMpO1xuXHRcdHJldHVybiAoYXdhaXQgdGhpcy5fZ2V0U2VhcmNoQWRkb24oKSkuZmluZE5leHQodGVybSwgc2VhcmNoT3B0aW9ucyk7XG5cdH1cblxuXHRhc3luYyBmaW5kUHJldmlvdXModGVybTogc3RyaW5nLCBzZWFyY2hPcHRpb25zOiBJU2VhcmNoT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRoaXMuX3VwZGF0ZUZpbmRDb2xvcnMoc2VhcmNoT3B0aW9ucyk7XG5cdFx0cmV0dXJuIChhd2FpdCB0aGlzLl9nZXRTZWFyY2hBZGRvbigpKS5maW5kUHJldmlvdXModGVybSwgc2VhcmNoT3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVGaW5kQ29sb3JzKHNlYXJjaE9wdGlvbnM6IElTZWFyY2hPcHRpb25zKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhlbWUgPSB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpO1xuXHRcdC8vIFRoZW1lIGNvbG9yIG5hbWVzIGFsaWduIHdpdGggbW9uYWNvL3ZzY29kZSB3aGVyZWFzIHh0ZXJtLmpzIGhhcyBzb21lIGRpZmZlcmVudCBuYW1pbmcuXG5cdFx0Ly8gVGhlIG1hcHBpbmcgaXMgYXMgZm9sbG93czpcblx0XHQvLyAtIGZpbmRNYXRjaCAtPiBhY3RpdmVNYXRjaFxuXHRcdC8vIC0gZmluZE1hdGNoSGlnaGxpZ2h0IC0+IG1hdGNoXG5cdFx0Y29uc3QgdGVybWluYWxCYWNrZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoVEVSTUlOQUxfQkFDS0dST1VORF9DT0xPUikgfHwgdGhlbWUuZ2V0Q29sb3IoUEFORUxfQkFDS0dST1VORCk7XG5cdFx0Y29uc3QgZmluZE1hdGNoQmFja2dyb3VuZCA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX0ZJTkRfTUFUQ0hfQkFDS0dST1VORF9DT0xPUik7XG5cdFx0Y29uc3QgZmluZE1hdGNoQm9yZGVyID0gdGhlbWUuZ2V0Q29sb3IoVEVSTUlOQUxfRklORF9NQVRDSF9CT1JERVJfQ09MT1IpO1xuXHRcdGNvbnN0IGZpbmRNYXRjaE92ZXJ2aWV3UnVsZXIgPSB0aGVtZS5nZXRDb2xvcihURVJNSU5BTF9PVkVSVklFV19SVUxFUl9DVVJTT1JfRk9SRUdST1VORF9DT0xPUik7XG5cdFx0Y29uc3QgZmluZE1hdGNoSGlnaGxpZ2h0QmFja2dyb3VuZCA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX0ZJTkRfTUFUQ0hfSElHSExJR0hUX0JBQ0tHUk9VTkRfQ09MT1IpO1xuXHRcdGNvbnN0IGZpbmRNYXRjaEhpZ2hsaWdodEJvcmRlciA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX0ZJTkRfTUFUQ0hfSElHSExJR0hUX0JPUkRFUl9DT0xPUik7XG5cdFx0Y29uc3QgZmluZE1hdGNoSGlnaGxpZ2h0T3ZlcnZpZXdSdWxlciA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX09WRVJWSUVXX1JVTEVSX0ZJTkRfTUFUQ0hfRk9SRUdST1VORF9DT0xPUik7XG5cdFx0c2VhcmNoT3B0aW9ucy5kZWNvcmF0aW9ucyA9IHtcblx0XHRcdGFjdGl2ZU1hdGNoQmFja2dyb3VuZDogZmluZE1hdGNoQmFja2dyb3VuZD8udG9TdHJpbmcoKSxcblx0XHRcdGFjdGl2ZU1hdGNoQm9yZGVyOiBmaW5kTWF0Y2hCb3JkZXI/LnRvU3RyaW5nKCkgfHwgJ3RyYW5zcGFyZW50Jyxcblx0XHRcdGFjdGl2ZU1hdGNoQ29sb3JPdmVydmlld1J1bGVyOiBmaW5kTWF0Y2hPdmVydmlld1J1bGVyPy50b1N0cmluZygpIHx8ICd0cmFuc3BhcmVudCcsXG5cdFx0XHQvLyBkZWNvcmF0aW9uIGJncyBkb24ndCBzdXBwb3J0IHRoZSBhbHBoYSBjaGFubmVsIHNvIGJsZW5kIGl0IHdpdGggdGhlIHJlZ3VsYXIgYmdcblx0XHRcdG1hdGNoQmFja2dyb3VuZDogdGVybWluYWxCYWNrZ3JvdW5kID8gZmluZE1hdGNoSGlnaGxpZ2h0QmFja2dyb3VuZD8uYmxlbmQodGVybWluYWxCYWNrZ3JvdW5kKS50b1N0cmluZygpIDogdW5kZWZpbmVkLFxuXHRcdFx0bWF0Y2hCb3JkZXI6IGZpbmRNYXRjaEhpZ2hsaWdodEJvcmRlcj8udG9TdHJpbmcoKSB8fCAndHJhbnNwYXJlbnQnLFxuXHRcdFx0bWF0Y2hPdmVydmlld1J1bGVyOiBmaW5kTWF0Y2hIaWdobGlnaHRPdmVydmlld1J1bGVyPy50b1N0cmluZygpIHx8ICd0cmFuc3BhcmVudCdcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfc2VhcmNoQWRkb25Qcm9taXNlOiBQcm9taXNlPFNlYXJjaEFkZG9uVHlwZT4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2dldFNlYXJjaEFkZG9uKCk6IFByb21pc2U8U2VhcmNoQWRkb25UeXBlPiB7XG5cdFx0aWYgKCF0aGlzLl9zZWFyY2hBZGRvblByb21pc2UpIHtcblx0XHRcdHRoaXMuX3NlYXJjaEFkZG9uUHJvbWlzZSA9IHRoaXMuX3h0ZXJtQWRkb25Mb2FkZXIuaW1wb3J0QWRkb24oJ3NlYXJjaCcpLnRoZW4oKEFkZG9uQ3RvcikgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdCgnQ291bGQgbm90IGNyZWF0ZSBzZWFyY2ggYWRkb24sIHRlcm1pbmFsIGlzIGRpc3Bvc2VkJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fc2VhcmNoQWRkb24gPSBuZXcgQWRkb25DdG9yKHsgaGlnaGxpZ2h0TGltaXQ6IFh0ZXJtVGVybWluYWxDb25zdGFudHMuU2VhcmNoSGlnaGxpZ2h0TGltaXQgfSk7XG5cdFx0XHRcdHRoaXMucmF3LmxvYWRBZGRvbih0aGlzLl9zZWFyY2hBZGRvbik7XG5cdFx0XHRcdHRoaXMuX3NlYXJjaEFkZG9uLm9uRGlkQ2hhbmdlUmVzdWx0cygocmVzdWx0czogeyByZXN1bHRJbmRleDogbnVtYmVyOyByZXN1bHRDb3VudDogbnVtYmVyIH0pID0+IHtcblx0XHRcdFx0XHR0aGlzLl9sYXN0RmluZFJlc3VsdCA9IHJlc3VsdHM7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VGaW5kUmVzdWx0cy5maXJlKHJlc3VsdHMpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3NlYXJjaEFkZG9uO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9zZWFyY2hBZGRvblByb21pc2U7XG5cdH1cblxuXHRjbGVhclNlYXJjaERlY29yYXRpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMuX3NlYXJjaEFkZG9uPy5jbGVhckRlY29yYXRpb25zKCk7XG5cdH1cblxuXHRjbGVhckFjdGl2ZVNlYXJjaERlY29yYXRpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5fc2VhcmNoQWRkb24/LmNsZWFyQWN0aXZlRGVjb3JhdGlvbigpO1xuXHR9XG5cblx0Z2V0Rm9udCgpOiBJVGVybWluYWxGb250IHtcblx0XHRyZXR1cm4gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5nZXRGb250KGRvbS5nZXRXaW5kb3codGhpcy5yYXcuZWxlbWVudCksIHRoaXMuX2NvcmUpO1xuXHR9XG5cblx0Z2V0TG9uZ2VzdFZpZXdwb3J0V3JhcHBlZExpbmVMZW5ndGgoKTogbnVtYmVyIHtcblx0XHRsZXQgbWF4TGluZUxlbmd0aCA9IDA7XG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMucmF3LmJ1ZmZlci5hY3RpdmUubGVuZ3RoIC0gMTsgaSA+PSB0aGlzLnJhdy5idWZmZXIuYWN0aXZlLnZpZXdwb3J0WTsgaS0tKSB7XG5cdFx0XHRjb25zdCBsaW5lSW5mbyA9IHRoaXMuX2dldFdyYXBwZWRMaW5lQ291bnQoaSwgdGhpcy5yYXcuYnVmZmVyLmFjdGl2ZSk7XG5cdFx0XHRtYXhMaW5lTGVuZ3RoID0gTWF0aC5tYXgobWF4TGluZUxlbmd0aCwgKChsaW5lSW5mby5saW5lQ291bnQgKiB0aGlzLnJhdy5jb2xzKSAtIGxpbmVJbmZvLmVuZFNwYWNlcykgfHwgMCk7XG5cdFx0XHRpID0gbGluZUluZm8uY3VycmVudEluZGV4O1xuXHRcdH1cblx0XHRyZXR1cm4gbWF4TGluZUxlbmd0aDtcblx0fVxuXG5cdHByaXZhdGUgX2dldFdyYXBwZWRMaW5lQ291bnQoaW5kZXg6IG51bWJlciwgYnVmZmVyOiBJQnVmZmVyKTogeyBsaW5lQ291bnQ6IG51bWJlcjsgY3VycmVudEluZGV4OiBudW1iZXI7IGVuZFNwYWNlczogbnVtYmVyIH0ge1xuXHRcdGxldCBsaW5lID0gYnVmZmVyLmdldExpbmUoaW5kZXgpO1xuXHRcdGlmICghbGluZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZ2V0IGxpbmUnKTtcblx0XHR9XG5cdFx0bGV0IGN1cnJlbnRJbmRleCA9IGluZGV4O1xuXHRcdGxldCBlbmRTcGFjZXMgPSAwO1xuXHRcdC8vIGxpbmUubGVuZ3RoIG1heSBleGNlZWQgY29scyBhcyBpdCBkb2Vzbid0IG5lY2Vzc2FyaWx5IHRyaW0gdGhlIGJhY2tpbmcgYXJyYXkgb24gcmVzaXplXG5cdFx0Zm9yIChsZXQgaSA9IE1hdGgubWluKGxpbmUubGVuZ3RoLCB0aGlzLnJhdy5jb2xzKSAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRpZiAoIWxpbmU/LmdldENlbGwoaSk/LmdldENoYXJzKCkpIHtcblx0XHRcdFx0ZW5kU3BhY2VzKys7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0d2hpbGUgKGxpbmU/LmlzV3JhcHBlZCAmJiBjdXJyZW50SW5kZXggPiAwKSB7XG5cdFx0XHRjdXJyZW50SW5kZXgtLTtcblx0XHRcdGxpbmUgPSBidWZmZXIuZ2V0TGluZShjdXJyZW50SW5kZXgpO1xuXHRcdH1cblx0XHRyZXR1cm4geyBsaW5lQ291bnQ6IGluZGV4IC0gY3VycmVudEluZGV4ICsgMSwgY3VycmVudEluZGV4LCBlbmRTcGFjZXMgfTtcblx0fVxuXG5cdHNjcm9sbERvd25MaW5lKCk6IHZvaWQge1xuXHRcdHRoaXMucmF3LnNjcm9sbExpbmVzKDEpO1xuXHR9XG5cblx0c2Nyb2xsRG93blBhZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5yYXcuc2Nyb2xsUGFnZXMoMSk7XG5cdH1cblxuXHRzY3JvbGxUb0JvdHRvbSgpOiB2b2lkIHtcblx0XHR0aGlzLnJhdy5zY3JvbGxUb0JvdHRvbSgpO1xuXHR9XG5cblx0c2Nyb2xsVXBMaW5lKCk6IHZvaWQge1xuXHRcdHRoaXMucmF3LnNjcm9sbExpbmVzKC0xKTtcblx0fVxuXG5cdHNjcm9sbFVwUGFnZSgpOiB2b2lkIHtcblx0XHR0aGlzLnJhdy5zY3JvbGxQYWdlcygtMSk7XG5cdH1cblxuXHRzY3JvbGxUb1RvcCgpOiB2b2lkIHtcblx0XHR0aGlzLnJhdy5zY3JvbGxUb1RvcCgpO1xuXHR9XG5cblx0c2Nyb2xsVG9MaW5lKGxpbmU6IG51bWJlciwgcG9zaXRpb246IFNjcm9sbFBvc2l0aW9uID0gU2Nyb2xsUG9zaXRpb24uVG9wKTogdm9pZCB7XG5cdFx0dGhpcy5tYXJrVHJhY2tlci5zY3JvbGxUb0xpbmUobGluZSwgcG9zaXRpb24pO1xuXHR9XG5cblx0Y2xlYXJCdWZmZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5yYXcuY2xlYXIoKTtcblx0XHQvLyB4dGVybS5qcyBkb2VzIG5vdCBjbGVhciB0aGUgZmlyc3QgcHJvbXB0LCBzbyB0cmlnZ2VyIHRoZXNlIHRvIHNpbXVsYXRlXG5cdFx0Ly8gdGhlIHByb21wdCBiZWluZyB3cml0dGVuXG5cdFx0dGhpcy5fY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik/LmhhbmRsZVByb21wdFN0YXJ0KCk7XG5cdFx0dGhpcy5fY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik/LmhhbmRsZUNvbW1hbmRTdGFydCgpO1xuXHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5jbGVhcik7XG5cdH1cblxuXHRoYXNTZWxlY3Rpb24oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMucmF3Lmhhc1NlbGVjdGlvbigpO1xuXHR9XG5cblx0Y2xlYXJTZWxlY3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5yYXcuY2xlYXJTZWxlY3Rpb24oKTtcblx0fVxuXG5cdHNlbGVjdE1hcmtlZFJhbmdlKGZyb21NYXJrZXJJZDogc3RyaW5nLCB0b01hcmtlcklkOiBzdHJpbmcsIHNjcm9sbEludG9WaWV3ID0gZmFsc2UpIHtcblx0XHRjb25zdCBkZXRlY3Rpb25DYXBhYmlsaXR5ID0gdGhpcy5zaGVsbEludGVncmF0aW9uLmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb24pO1xuXHRcdGlmICghZGV0ZWN0aW9uQ2FwYWJpbGl0eSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXJ0ID0gZGV0ZWN0aW9uQ2FwYWJpbGl0eS5nZXRNYXJrKGZyb21NYXJrZXJJZCk7XG5cdFx0Y29uc3QgZW5kID0gZGV0ZWN0aW9uQ2FwYWJpbGl0eS5nZXRNYXJrKHRvTWFya2VySWQpO1xuXHRcdGlmIChzdGFydCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5yYXcuc2VsZWN0TGluZXMoc3RhcnQubGluZSwgZW5kLmxpbmUpO1xuXHRcdGlmIChzY3JvbGxJbnRvVmlldykge1xuXHRcdFx0dGhpcy5yYXcuc2Nyb2xsVG9MaW5lKHN0YXJ0LmxpbmUpO1xuXHRcdH1cblx0fVxuXG5cdHNlbGVjdEFsbCgpOiB2b2lkIHtcblx0XHR0aGlzLnJhdy5mb2N1cygpO1xuXHRcdHRoaXMucmF3LnNlbGVjdEFsbCgpO1xuXHR9XG5cblx0Zm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5yYXcuZm9jdXMoKTtcblx0fVxuXG5cdGFzeW5jIGNvcHlTZWxlY3Rpb24oYXNIdG1sPzogYm9vbGVhbiwgY29tbWFuZD86IElUZXJtaW5hbENvbW1hbmQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5oYXNTZWxlY3Rpb24oKSB8fCAoYXNIdG1sICYmIGNvbW1hbmQpKSB7XG5cdFx0XHRpZiAoYXNIdG1sKSB7XG5cdFx0XHRcdGNvbnN0IHRleHRBc0h0bWwgPSBhd2FpdCB0aGlzLmdldFNlbGVjdGlvbkFzSHRtbChjb21tYW5kKTtcblx0XHRcdFx0ZnVuY3Rpb24gbGlzdGVuZXIoZTogYW55KSB7XG5cdFx0XHRcdFx0aWYgKCFlLmNsaXBib2FyZERhdGEudHlwZXMuaW5jbHVkZXMoJ3RleHQvcGxhaW4nKSkge1xuXHRcdFx0XHRcdFx0ZS5jbGlwYm9hcmREYXRhLnNldERhdGEoJ3RleHQvcGxhaW4nLCBjb21tYW5kPy5nZXRPdXRwdXQoKSA/PyAnJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGUuY2xpcGJvYXJkRGF0YS5zZXREYXRhKCd0ZXh0L2h0bWwnLCB0ZXh0QXNIdG1sKTtcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZG9jID0gZG9tLmdldERvY3VtZW50KHRoaXMucmF3LmVsZW1lbnQpO1xuXHRcdFx0XHRkb2MuYWRkRXZlbnRMaXN0ZW5lcignY29weScsIGxpc3RlbmVyKTtcblx0XHRcdFx0ZG9jLmV4ZWNDb21tYW5kKCdjb3B5Jyk7XG5cdFx0XHRcdGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKCdjb3B5JywgbGlzdGVuZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQodGhpcy5yYXcuZ2V0U2VsZWN0aW9uKCkpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obG9jYWxpemUoJ3Rlcm1pbmFsLmludGVncmF0ZWQuY29weVNlbGVjdGlvbi5ub1NlbGVjdGlvbicsICdUaGUgdGVybWluYWwgaGFzIG5vIHNlbGVjdGlvbiB0byBjb3B5JykpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldEN1cnNvckJsaW5rKGJsaW5rOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMucmF3Lm9wdGlvbnMuY3Vyc29yQmxpbmsgIT09IGJsaW5rKSB7XG5cdFx0XHR0aGlzLnJhdy5vcHRpb25zLmN1cnNvckJsaW5rID0gYmxpbms7XG5cdFx0XHR0aGlzLnJhdy5yZWZyZXNoKDAsIHRoaXMucmF3LnJvd3MgLSAxKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zZXRDdXJzb3JTdHlsZShzdHlsZTogSVRlcm1pbmFsQ29uZmlndXJhdGlvblsnY3Vyc29yU3R5bGUnXSk6IHZvaWQge1xuXHRcdGNvbnN0IG1hcHBlZCA9IHZzY29kZVRvWHRlcm1DdXJzb3JTdHlsZTwnY3Vyc29yU3R5bGUnPihzdHlsZSk7XG5cdFx0aWYgKHRoaXMucmF3Lm9wdGlvbnMuY3Vyc29yU3R5bGUgIT09IG1hcHBlZCkge1xuXHRcdFx0dGhpcy5yYXcub3B0aW9ucy5jdXJzb3JTdHlsZSA9IG1hcHBlZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zZXRDdXJzb3JTdHlsZUluYWN0aXZlKHN0eWxlOiBJVGVybWluYWxDb25maWd1cmF0aW9uWydjdXJzb3JTdHlsZUluYWN0aXZlJ10pOiB2b2lkIHtcblx0XHRjb25zdCBtYXBwZWQgPSB2c2NvZGVUb1h0ZXJtQ3Vyc29yU3R5bGUoc3R5bGUpO1xuXHRcdGlmICh0aGlzLnJhdy5vcHRpb25zLmN1cnNvckluYWN0aXZlU3R5bGUgIT09IG1hcHBlZCkge1xuXHRcdFx0dGhpcy5yYXcub3B0aW9ucy5jdXJzb3JJbmFjdGl2ZVN0eWxlID0gbWFwcGVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NldEN1cnNvcldpZHRoKHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5yYXcub3B0aW9ucy5jdXJzb3JXaWR0aCAhPT0gd2lkdGgpIHtcblx0XHRcdHRoaXMucmF3Lm9wdGlvbnMuY3Vyc29yV2lkdGggPSB3aWR0aDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9lbmFibGVXZWJnbFJlbmRlcmVyKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5yYXcuZWxlbWVudCB8fCB0aGlzLl93ZWJnbEFkZG9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgQWRkb24gPSBhd2FpdCB0aGlzLl94dGVybUFkZG9uTG9hZGVyLmltcG9ydEFkZG9uKCd3ZWJnbCcpO1xuXHRcdHRoaXMuX3dlYmdsQWRkb24gPSBuZXcgQWRkb24oKTtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5yYXcubG9hZEFkZG9uKHRoaXMuX3dlYmdsQWRkb24pO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnV2ViZ2wgd2FzIGxvYWRlZCcpO1xuXHRcdFx0dGhpcy5fd2ViZ2xBZGRvbi5vbkNvbnRleHRMb3NzKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBXZWJnbCBsb3N0IGNvbnRleHQsIGRpc3Bvc2luZyBvZiB3ZWJnbCByZW5kZXJlcmApO1xuXHRcdFx0XHR0aGlzLl9kaXNwb3NlT2ZXZWJnbFJlbmRlcmVyKCk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3JlZnJlc2hJbWFnZUFkZG9uKCk7XG5cdFx0XHQvLyBXZWJHTCByZW5kZXJlciBjZWxsIGRpbWVuc2lvbnMgZGlmZmVyIGZyb20gdGhlIERPTSByZW5kZXJlciwgbWFrZSBzdXJlIHRoZSB0ZXJtaW5hbFxuXHRcdFx0Ly8gZ2V0cyByZXNpemVkIGFmdGVyIHRoZSB3ZWJnbCBhZGRvbiBpcyBsb2FkZWRcblx0XHRcdHRoaXMuX29uRGlkUmVxdWVzdFJlZnJlc2hEaW1lbnNpb25zLmZpcmUoKTtcblx0XHRcdC8vIFVuY29tbWVudCB0byBhZGQgdGhlIHRleHR1cmUgYXRsYXMgdG8gdGhlIERPTVxuXHRcdFx0Ly8gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHQvLyBcdGlmICh0aGlzLl93ZWJnbEFkZG9uPy50ZXh0dXJlQXRsYXMpIHtcblx0XHRcdC8vIFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuX3dlYmdsQWRkb24/LnRleHR1cmVBdGxhcyk7XG5cdFx0XHQvLyBcdH1cblx0XHRcdC8vIH0sIDUwMDApO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgV2ViZ2wgY291bGQgbm90IGJlIGxvYWRlZC4gRmFsbGluZyBiYWNrIHRvIHRoZSBET00gcmVuZGVyZXJgLCBlKTtcblx0XHRcdFh0ZXJtVGVybWluYWwuX3N1Z2dlc3RlZFJlbmRlcmVyVHlwZSA9ICdkb20nO1xuXHRcdFx0dGhpcy5fZGlzcG9zZU9mV2ViZ2xSZW5kZXJlcigpO1xuXHRcdH1cblx0fVxuXG5cdEBkZWJvdW5jZSgxMDApXG5cdHByaXZhdGUgYXN5bmMgX3JlZnJlc2hMaWdhdHVyZXNBZGRvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMucmF3LmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbGlnYXR1cmVzQ29uZmlnID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZm9udExpZ2F0dXJlcztcblx0XHRsZXQgc2hvdWxkUmVjcmVhdGVXZWJnbFJlbmRlcmVyID0gZmFsc2U7XG5cdFx0aWYgKGxpZ2F0dXJlc0NvbmZpZz8uZW5hYmxlZCkge1xuXHRcdFx0aWYgKHRoaXMuX2xpZ2F0dXJlc0FkZG9uLnZhbHVlICYmICFlcXVhbHMobGlnYXR1cmVzQ29uZmlnLCB0aGlzLl9saWdhdHVyZXNBZGRvbkNvbmZpZykpIHtcblx0XHRcdFx0dGhpcy5fbGlnYXR1cmVzQWRkb24uY2xlYXIoKTtcblx0XHRcdH1cblx0XHRcdGlmICghdGhpcy5fbGlnYXR1cmVzQWRkb24udmFsdWUpIHtcblx0XHRcdFx0Y29uc3QgTGlnYXR1cmVzQWRkb24gPSBhd2FpdCB0aGlzLl94dGVybUFkZG9uTG9hZGVyLmltcG9ydEFkZG9uKCdsaWdhdHVyZXMnKTtcblx0XHRcdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fbGlnYXR1cmVzQWRkb24udmFsdWUgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMaWdhdHVyZXNBZGRvbiwge1xuXHRcdFx0XHRcdGZvbnRGZWF0dXJlU2V0dGluZ3M6IGxpZ2F0dXJlc0NvbmZpZy5mZWF0dXJlU2V0dGluZ3MsXG5cdFx0XHRcdFx0ZmFsbGJhY2tMaWdhdHVyZXM6IGxpZ2F0dXJlc0NvbmZpZy5mYWxsYmFja0xpZ2F0dXJlcyxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMucmF3LmxvYWRBZGRvbih0aGlzLl9saWdhdHVyZXNBZGRvbi52YWx1ZSk7XG5cdFx0XHRcdHNob3VsZFJlY3JlYXRlV2ViZ2xSZW5kZXJlciA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICghdGhpcy5fbGlnYXR1cmVzQWRkb24udmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbGlnYXR1cmVzQWRkb24uY2xlYXIoKTtcblx0XHRcdHNob3VsZFJlY3JlYXRlV2ViZ2xSZW5kZXJlciA9IHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKHNob3VsZFJlY3JlYXRlV2ViZ2xSZW5kZXJlciAmJiB0aGlzLl93ZWJnbEFkZG9uKSB7XG5cdFx0XHQvLyBSZS1jcmVhdGUgdGhlIHdlYmdsIGFkZG9uIHdoZW4gbGlnYXR1cmVzIHN0YXRlIGNoYW5nZXMgdG8gc28gdGhlIHRleHR1cmUgYXRsYXMgcGlja3MgdXBcblx0XHRcdC8vIHN0eWxlcyBmcm9tIHRoZSBET00uXG5cdFx0XHR0aGlzLl9kaXNwb3NlT2ZXZWJnbFJlbmRlcmVyKCk7XG5cdFx0XHRhd2FpdCB0aGlzLl9lbmFibGVXZWJnbFJlbmRlcmVyKCk7XG5cdFx0fVxuXHR9XG5cblx0QGRlYm91bmNlKDEwMClcblx0cHJpdmF0ZSBhc3luYyBfcmVmcmVzaEltYWdlQWRkb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gT25seSBhbGxvdyB0aGUgaW1hZ2UgYWRkb24gd2hlbiB3ZWJnbCBpcyBiZWluZyB1c2VkIHRvIGF2b2lkIHBvc3NpYmxlIEdQVSBpc3N1ZXNcblx0XHRpZiAodGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuZW5hYmxlSW1hZ2VzICYmIHRoaXMuX3dlYmdsQWRkb24pIHtcblx0XHRcdGlmICghdGhpcy5faW1hZ2VBZGRvbikge1xuXHRcdFx0XHRjb25zdCBBZGRvbkN0b3IgPSBhd2FpdCB0aGlzLl94dGVybUFkZG9uTG9hZGVyLmltcG9ydEFkZG9uKCdpbWFnZScpO1xuXHRcdFx0XHR0aGlzLl9pbWFnZUFkZG9uID0gbmV3IEFkZG9uQ3RvcigpO1xuXHRcdFx0XHR0aGlzLnJhdy5sb2FkQWRkb24odGhpcy5faW1hZ2VBZGRvbik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMuX2ltYWdlQWRkb24/LmRpc3Bvc2UoKTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHQvLyBpZ25vcmVcblx0XHRcdH1cblx0XHRcdHRoaXMuX2ltYWdlQWRkb24gPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZGlzcG9zZU9mV2ViZ2xSZW5kZXJlcigpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fd2ViZ2xBZGRvbj8uZGlzcG9zZSgpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gaWdub3JlXG5cdFx0fVxuXHRcdHRoaXMuX3dlYmdsQWRkb24gPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fcmVmcmVzaEltYWdlQWRkb24oKTtcblx0XHQvLyBXZWJHTCByZW5kZXJlciBjZWxsIGRpbWVuc2lvbnMgZGlmZmVyIGZyb20gdGhlIERPTSByZW5kZXJlciwgbWFrZSBzdXJlIHRoZSB0ZXJtaW5hbFxuXHRcdC8vIGdldHMgcmVzaXplZCBhZnRlciB0aGUgd2ViZ2wgYWRkb24gaXMgZGlzcG9zZWRcblx0XHR0aGlzLl9vbkRpZFJlcXVlc3RSZWZyZXNoRGltZW5zaW9ucy5maXJlKCk7XG5cdH1cblxuXHRnZXRYdGVybVRoZW1lKHRoZW1lPzogSUNvbG9yVGhlbWUpOiBJVGhlbWUge1xuXHRcdGlmICghdGhlbWUpIHtcblx0XHRcdHRoZW1lID0gdGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKTtcblx0XHR9XG5cblx0XHRjb25zdCBjb25maWcgPSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZztcblx0XHRjb25zdCBoaWRlT3ZlcnZpZXdSdWxlciA9IFsnbmV2ZXInLCAnZ3V0dGVyJ10uaW5jbHVkZXMoY29uZmlnLnNoZWxsSW50ZWdyYXRpb24/LmRlY29yYXRpb25zRW5hYmxlZCA/PyAnJyk7XG5cblx0XHRjb25zdCBmb3JlZ3JvdW5kQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihURVJNSU5BTF9GT1JFR1JPVU5EX0NPTE9SKTtcblx0XHRjb25zdCBiYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLl94dGVybUNvbG9yUHJvdmlkZXIuZ2V0QmFja2dyb3VuZENvbG9yKHRoZW1lKTtcblx0XHRjb25zdCBjdXJzb3JDb2xvciA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX0NVUlNPUl9GT1JFR1JPVU5EX0NPTE9SKSB8fCBmb3JlZ3JvdW5kQ29sb3I7XG5cdFx0Y29uc3QgY3Vyc29yQWNjZW50Q29sb3IgPSB0aGVtZS5nZXRDb2xvcihURVJNSU5BTF9DVVJTT1JfQkFDS0dST1VORF9DT0xPUikgfHwgYmFja2dyb3VuZENvbG9yO1xuXHRcdGNvbnN0IHNlbGVjdGlvbkJhY2tncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX1NFTEVDVElPTl9CQUNLR1JPVU5EX0NPTE9SKTtcblx0XHRjb25zdCBzZWxlY3Rpb25JbmFjdGl2ZUJhY2tncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX0lOQUNUSVZFX1NFTEVDVElPTl9CQUNLR1JPVU5EX0NPTE9SKTtcblx0XHRjb25zdCBzZWxlY3Rpb25Gb3JlZ3JvdW5kQ29sb3IgPSB0aGVtZS5nZXRDb2xvcihURVJNSU5BTF9TRUxFQ1RJT05fRk9SRUdST1VORF9DT0xPUikgfHwgdW5kZWZpbmVkO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGJhY2tncm91bmQ6IGJhY2tncm91bmRDb2xvcj8udG9TdHJpbmcoKSxcblx0XHRcdGZvcmVncm91bmQ6IGZvcmVncm91bmRDb2xvcj8udG9TdHJpbmcoKSxcblx0XHRcdGN1cnNvcjogY3Vyc29yQ29sb3I/LnRvU3RyaW5nKCksXG5cdFx0XHRjdXJzb3JBY2NlbnQ6IGN1cnNvckFjY2VudENvbG9yPy50b1N0cmluZygpLFxuXHRcdFx0c2VsZWN0aW9uQmFja2dyb3VuZDogc2VsZWN0aW9uQmFja2dyb3VuZENvbG9yPy50b1N0cmluZygpLFxuXHRcdFx0c2VsZWN0aW9uSW5hY3RpdmVCYWNrZ3JvdW5kOiBzZWxlY3Rpb25JbmFjdGl2ZUJhY2tncm91bmRDb2xvcj8udG9TdHJpbmcoKSxcblx0XHRcdHNlbGVjdGlvbkZvcmVncm91bmQ6IHNlbGVjdGlvbkZvcmVncm91bmRDb2xvcj8udG9TdHJpbmcoKSxcblx0XHRcdG92ZXJ2aWV3UnVsZXJCb3JkZXI6IGhpZGVPdmVydmlld1J1bGVyID8gJyMwMDAwJyA6IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX09WRVJWSUVXX1JVTEVSX0JPUkRFUl9DT0xPUik/LnRvU3RyaW5nKCksXG5cdFx0XHRzY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kOiB0aGVtZS5nZXRDb2xvcihzY3JvbGxiYXJTbGlkZXJBY3RpdmVCYWNrZ3JvdW5kKT8udG9TdHJpbmcoKSxcblx0XHRcdHNjcm9sbGJhclNsaWRlckJhY2tncm91bmQ6IHRoZW1lLmdldENvbG9yKHNjcm9sbGJhclNsaWRlckJhY2tncm91bmQpPy50b1N0cmluZygpLFxuXHRcdFx0c2Nyb2xsYmFyU2xpZGVySG92ZXJCYWNrZ3JvdW5kOiB0aGVtZS5nZXRDb2xvcihzY3JvbGxiYXJTbGlkZXJIb3ZlckJhY2tncm91bmQpPy50b1N0cmluZygpLFxuXHRcdFx0YmxhY2s6IHRoZW1lLmdldENvbG9yKGFuc2lDb2xvcklkZW50aWZpZXJzWzBdKT8udG9TdHJpbmcoKSxcblx0XHRcdHJlZDogdGhlbWUuZ2V0Q29sb3IoYW5zaUNvbG9ySWRlbnRpZmllcnNbMV0pPy50b1N0cmluZygpLFxuXHRcdFx0Z3JlZW46IHRoZW1lLmdldENvbG9yKGFuc2lDb2xvcklkZW50aWZpZXJzWzJdKT8udG9TdHJpbmcoKSxcblx0XHRcdHllbGxvdzogdGhlbWUuZ2V0Q29sb3IoYW5zaUNvbG9ySWRlbnRpZmllcnNbM10pPy50b1N0cmluZygpLFxuXHRcdFx0Ymx1ZTogdGhlbWUuZ2V0Q29sb3IoYW5zaUNvbG9ySWRlbnRpZmllcnNbNF0pPy50b1N0cmluZygpLFxuXHRcdFx0bWFnZW50YTogdGhlbWUuZ2V0Q29sb3IoYW5zaUNvbG9ySWRlbnRpZmllcnNbNV0pPy50b1N0cmluZygpLFxuXHRcdFx0Y3lhbjogdGhlbWUuZ2V0Q29sb3IoYW5zaUNvbG9ySWRlbnRpZmllcnNbNl0pPy50b1N0cmluZygpLFxuXHRcdFx0d2hpdGU6IHRoZW1lLmdldENvbG9yKGFuc2lDb2xvcklkZW50aWZpZXJzWzddKT8udG9TdHJpbmcoKSxcblx0XHRcdGJyaWdodEJsYWNrOiB0aGVtZS5nZXRDb2xvcihhbnNpQ29sb3JJZGVudGlmaWVyc1s4XSk/LnRvU3RyaW5nKCksXG5cdFx0XHRicmlnaHRSZWQ6IHRoZW1lLmdldENvbG9yKGFuc2lDb2xvcklkZW50aWZpZXJzWzldKT8udG9TdHJpbmcoKSxcblx0XHRcdGJyaWdodEdyZWVuOiB0aGVtZS5nZXRDb2xvcihhbnNpQ29sb3JJZGVudGlmaWVyc1sxMF0pPy50b1N0cmluZygpLFxuXHRcdFx0YnJpZ2h0WWVsbG93OiB0aGVtZS5nZXRDb2xvcihhbnNpQ29sb3JJZGVudGlmaWVyc1sxMV0pPy50b1N0cmluZygpLFxuXHRcdFx0YnJpZ2h0Qmx1ZTogdGhlbWUuZ2V0Q29sb3IoYW5zaUNvbG9ySWRlbnRpZmllcnNbMTJdKT8udG9TdHJpbmcoKSxcblx0XHRcdGJyaWdodE1hZ2VudGE6IHRoZW1lLmdldENvbG9yKGFuc2lDb2xvcklkZW50aWZpZXJzWzEzXSk/LnRvU3RyaW5nKCksXG5cdFx0XHRicmlnaHRDeWFuOiB0aGVtZS5nZXRDb2xvcihhbnNpQ29sb3JJZGVudGlmaWVyc1sxNF0pPy50b1N0cmluZygpLFxuXHRcdFx0YnJpZ2h0V2hpdGU6IHRoZW1lLmdldENvbG9yKGFuc2lDb2xvcklkZW50aWZpZXJzWzE1XSk/LnRvU3RyaW5nKClcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlVGhlbWUodGhlbWU/OiBJQ29sb3JUaGVtZSk6IHZvaWQge1xuXHRcdHRoaXMucmF3Lm9wdGlvbnMudGhlbWUgPSB0aGlzLmdldFh0ZXJtVGhlbWUodGhlbWUpO1xuXHR9XG5cblx0cmVmcmVzaCgpIHtcblx0XHR0aGlzLl91cGRhdGVUaGVtZSgpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25BZGRvbi5yZWZyZXNoTGF5b3V0cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfdXBkYXRlVW5pY29kZVZlcnNpb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLl91bmljb2RlMTFBZGRvbiAmJiB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy51bmljb2RlVmVyc2lvbiA9PT0gJzExJykge1xuXHRcdFx0Y29uc3QgQWRkb24gPSBhd2FpdCB0aGlzLl94dGVybUFkZG9uTG9hZGVyLmltcG9ydEFkZG9uKCd1bmljb2RlMTEnKTtcblx0XHRcdHRoaXMuX3VuaWNvZGUxMUFkZG9uID0gbmV3IEFkZG9uKCk7XG5cdFx0XHR0aGlzLnJhdy5sb2FkQWRkb24odGhpcy5fdW5pY29kZTExQWRkb24pO1xuXHRcdH1cblx0XHRpZiAodGhpcy5yYXcudW5pY29kZS5hY3RpdmVWZXJzaW9uICE9PSB0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy51bmljb2RlVmVyc2lvbikge1xuXHRcdFx0dGhpcy5yYXcudW5pY29kZS5hY3RpdmVWZXJzaW9uID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcudW5pY29kZVZlcnNpb247XG5cdFx0fVxuXHR9XG5cblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuXHRfd3JpdGVUZXh0KGRhdGE6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMucmF3LndyaXRlKGRhdGEpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9hbnlUZXJtaW5hbEZvY3VzQ29udGV4dEtleS5yZXNldCgpO1xuXHRcdHRoaXMuX2FueUZvY3VzZWRUZXJtaW5hbEhhc1NlbGVjdGlvbi5yZXNldCgpO1xuXHRcdHRoaXMuX29uRGlkRGlzcG9zZS5maXJlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRYdGVybVNjYWxlZERpbWVuc2lvbnModzogV2luZG93LCBmb250OiBJVGVybWluYWxGb250LCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHsgcm93czogbnVtYmVyOyBjb2xzOiBudW1iZXIgfSB8IG51bGwge1xuXHRpZiAoIWZvbnQuY2hhcldpZHRoIHx8ICFmb250LmNoYXJIZWlnaHQpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8vIEJlY2F1c2UgeHRlcm0uanMgY29udmVydHMgZnJvbSBDU1MgcGl4ZWxzIHRvIGFjdHVhbCBwaXhlbHMgdGhyb3VnaFxuXHQvLyB0aGUgdXNlIG9mIGNhbnZhcywgd2luZG93LmRldmljZVBpeGVsUmF0aW8gbmVlZHMgdG8gYmUgdXNlZCBoZXJlIGluXG5cdC8vIG9yZGVyIHRvIGJlIHByZWNpc2UuIGZvbnQuY2hhcldpZHRoL2NoYXJIZWlnaHQgYWxvbmUgYXMgaW5zdWZmaWNpZW50XG5cdC8vIHdoZW4gd2luZG93LmRldmljZVBpeGVsUmF0aW8gY2hhbmdlcy5cblx0Y29uc3Qgc2NhbGVkV2lkdGhBdmFpbGFibGUgPSB3aWR0aCAqIHcuZGV2aWNlUGl4ZWxSYXRpbztcblxuXHRjb25zdCBzY2FsZWRDaGFyV2lkdGggPSBmb250LmNoYXJXaWR0aCAqIHcuZGV2aWNlUGl4ZWxSYXRpbyArIGZvbnQubGV0dGVyU3BhY2luZztcblx0Y29uc3QgY29scyA9IE1hdGgubWF4KE1hdGguZmxvb3Ioc2NhbGVkV2lkdGhBdmFpbGFibGUgLyBzY2FsZWRDaGFyV2lkdGgpLCAxKTtcblxuXHRjb25zdCBzY2FsZWRIZWlnaHRBdmFpbGFibGUgPSBoZWlnaHQgKiB3LmRldmljZVBpeGVsUmF0aW87XG5cdGNvbnN0IHNjYWxlZENoYXJIZWlnaHQgPSBNYXRoLmNlaWwoZm9udC5jaGFySGVpZ2h0ICogdy5kZXZpY2VQaXhlbFJhdGlvKTtcblx0Y29uc3Qgc2NhbGVkTGluZUhlaWdodCA9IE1hdGguZmxvb3Ioc2NhbGVkQ2hhckhlaWdodCAqIGZvbnQubGluZUhlaWdodCk7XG5cdGNvbnN0IHJvd3MgPSBNYXRoLm1heChNYXRoLmZsb29yKHNjYWxlZEhlaWdodEF2YWlsYWJsZSAvIHNjYWxlZExpbmVIZWlnaHQpLCAxKTtcblxuXHRyZXR1cm4geyByb3dzLCBjb2xzIH07XG59XG5cbmZ1bmN0aW9uIHZzY29kZVRvWHRlcm1Mb2dMZXZlbChsb2dMZXZlbDogTG9nTGV2ZWwpOiBYdGVybUxvZ0xldmVsIHtcblx0c3dpdGNoIChsb2dMZXZlbCkge1xuXHRcdGNhc2UgTG9nTGV2ZWwuVHJhY2U6IHJldHVybiAndHJhY2UnO1xuXHRcdGNhc2UgTG9nTGV2ZWwuRGVidWc6IHJldHVybiAnZGVidWcnO1xuXHRcdGNhc2UgTG9nTGV2ZWwuSW5mbzogcmV0dXJuICdpbmZvJztcblx0XHRjYXNlIExvZ0xldmVsLldhcm5pbmc6IHJldHVybiAnd2Fybic7XG5cdFx0Y2FzZSBMb2dMZXZlbC5FcnJvcjogcmV0dXJuICdlcnJvcic7XG5cdFx0ZGVmYXVsdDogcmV0dXJuICdvZmYnO1xuXHR9XG59XG5cbmludGVyZmFjZSBJQ3Vyc29yU3R5bGVWc2NvZGVUb1h0ZXJtTWFwIHtcblx0J2N1cnNvclN0eWxlJzogTm9uTnVsbGFibGU8SVRlcm1pbmFsT3B0aW9uc1snY3Vyc29yU3R5bGUnXT47XG5cdCdjdXJzb3JTdHlsZUluYWN0aXZlJzogTm9uTnVsbGFibGU8SVRlcm1pbmFsT3B0aW9uc1snY3Vyc29ySW5hY3RpdmVTdHlsZSddPjtcbn1cbmZ1bmN0aW9uIHZzY29kZVRvWHRlcm1DdXJzb3JTdHlsZTxUIGV4dGVuZHMgJ2N1cnNvclN0eWxlJyB8ICdjdXJzb3JTdHlsZUluYWN0aXZlJz4oc3R5bGU6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25bVF0pOiBJQ3Vyc29yU3R5bGVWc2NvZGVUb1h0ZXJtTWFwW1RdIHtcblx0Ly8gJ2xpbmUnIGlzIHVzZWQgaW5zdGVhZCBvZiBiYXIgaW4gVlMgQ29kZSB0byBiZSBjb25zaXN0ZW50IHdpdGggZWRpdG9yLmN1cnNvclN0eWxlXG5cdGlmIChzdHlsZSA9PT0gJ2xpbmUnKSB7XG5cdFx0cmV0dXJuICdiYXInO1xuXHR9XG5cdHJldHVybiBzdHlsZSBhcyBJQ3Vyc29yU3R5bGVWc2NvZGVUb1h0ZXJtTWFwW1RdO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFhQSxZQUFZLFNBQVM7QUFFckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxZQUFZLGlCQUFpQix5QkFBeUI7QUFFL0QsU0FBNEIscUJBQXFCLHlCQUFnRDtBQUVqRyxTQUFvRix3QkFBOEUscUNBQXFDO0FBQ3ZNLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUJBQXFCLHNCQUFzQjtBQUNwRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFzQixxQkFBcUI7QUFDM0MsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywyQkFBMkIsMkJBQTJCLGtDQUFrQyxrQ0FBa0Msc0JBQXNCLHFDQUFxQyxzQ0FBc0MsZ0RBQWdELGtDQUFrQyxxREFBcUQsNENBQTRDLGlEQUFpRCxxQ0FBcUMsOENBQThDLDRDQUE0QztBQUN2a0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2QkFBNkI7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
