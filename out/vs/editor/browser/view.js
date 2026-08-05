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
import * as dom from "../../base/browser/dom.js";
import { createFastDomNode } from "../../base/browser/fastDomNode.js";
import { inputLatency } from "../../base/browser/performance.js";
import { BugIndicatingError, onUnexpectedError } from "../../base/common/errors.js";
import { Disposable } from "../../base/common/lifecycle.js";
import { PointerHandlerLastRenderData } from "./controller/mouseTarget.js";
import { PointerHandler } from "./controller/pointerHandler.js";
import { RenderingContext } from "./view/renderingContext.js";
import { ViewController } from "./view/viewController.js";
import { ContentViewOverlays, MarginViewOverlays } from "./view/viewOverlays.js";
import { PartFingerprint, PartFingerprints } from "./view/viewPart.js";
import { ViewUserInputEvents } from "./view/viewUserInputEvents.js";
import { BlockDecorations } from "./viewParts/blockDecorations/blockDecorations.js";
import { ViewContentWidgets } from "./viewParts/contentWidgets/contentWidgets.js";
import { CurrentLineHighlightOverlay, CurrentLineMarginHighlightOverlay } from "./viewParts/currentLineHighlight/currentLineHighlight.js";
import { DecorationsOverlay } from "./viewParts/decorations/decorations.js";
import { EditorScrollbar } from "./viewParts/editorScrollbar/editorScrollbar.js";
import { GlyphMarginWidgets } from "./viewParts/glyphMargin/glyphMargin.js";
import { IndentGuidesOverlay } from "./viewParts/indentGuides/indentGuides.js";
import { LineNumbersOverlay } from "./viewParts/lineNumbers/lineNumbers.js";
import { ViewLines } from "./viewParts/viewLines/viewLines.js";
import { LinesDecorationsOverlay } from "./viewParts/linesDecorations/linesDecorations.js";
import { Margin } from "./viewParts/margin/margin.js";
import { MarginViewLineDecorationsOverlay } from "./viewParts/marginDecorations/marginDecorations.js";
import { Minimap } from "./viewParts/minimap/minimap.js";
import { ViewOverlayWidgets } from "./viewParts/overlayWidgets/overlayWidgets.js";
import { DecorationsOverviewRuler } from "./viewParts/overviewRuler/decorationsOverviewRuler.js";
import { OverviewRuler } from "./viewParts/overviewRuler/overviewRuler.js";
import { Rulers } from "./viewParts/rulers/rulers.js";
import { ScrollDecorationViewPart } from "./viewParts/scrollDecoration/scrollDecoration.js";
import { SelectionsOverlay } from "./viewParts/selections/selections.js";
import { ViewCursors } from "./viewParts/viewCursors/viewCursors.js";
import { ViewZones } from "./viewParts/viewZones/viewZones.js";
import { WhitespaceOverlay } from "./viewParts/whitespace/whitespace.js";
import { EditorOption } from "../common/config/editorOptions.js";
import { Position } from "../common/core/position.js";
import { Range } from "../common/core/range.js";
import { Selection } from "../common/core/selection.js";
import { ScrollType } from "../common/editorCommon.js";
import { GlyphMarginLane } from "../common/model.js";
import { ViewEventHandler } from "../common/viewEventHandler.js";
import { ViewportData } from "../common/viewLayout/viewLinesViewportData.js";
import { ViewContext } from "../common/viewModel/viewContext.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { getThemeTypeSelector } from "../../platform/theme/common/themeService.js";
import { ViewGpuContext } from "./gpu/viewGpuContext.js";
import { ViewLinesGpu } from "./viewParts/viewLinesGpu/viewLinesGpu.js";
import { TextAreaEditContext } from "./controller/editContext/textArea/textAreaEditContext.js";
import { NativeEditContext } from "./controller/editContext/native/nativeEditContext.js";
import { RulersGpu } from "./viewParts/rulersGpu/rulersGpu.js";
import { GpuMarkOverlay } from "./viewParts/gpuMark/gpuMark.js";
import { Emitter } from "../../base/common/event.js";
let View = class extends ViewEventHandler {
  constructor(editorContainer, ownerID, commandDelegate, configuration, colorTheme, model, userInputEvents, overflowWidgetsDomNode, _instantiationService) {
    super();
    this._instantiationService = _instantiationService;
    // Actual mutable state
    this._shouldRecomputeGlyphMarginLanes = false;
    this._ownerID = ownerID;
    this._widgetFocusTracker = this._register(
      new CodeEditorWidgetFocusTracker(editorContainer, overflowWidgetsDomNode)
    );
    this._register(this._widgetFocusTracker.onChange(() => {
      this._context.viewModel.setHasWidgetFocus(this._widgetFocusTracker.hasFocus());
    }));
    this._selections = [new Selection(1, 1, 1, 1)];
    this._renderAnimationFrame = null;
    this._overflowGuardContainer = createFastDomNode(document.createElement("div"));
    PartFingerprints.write(this._overflowGuardContainer, PartFingerprint.OverflowGuard);
    this._overflowGuardContainer.setClassName("overflow-guard");
    this._viewController = new ViewController(configuration, model, userInputEvents, commandDelegate);
    this._context = new ViewContext(configuration, colorTheme, model);
    this._context.addEventHandler(this);
    this._viewParts = [];
    this._experimentalEditContextEnabled = this._context.configuration.options.get(EditorOption.effectiveExperimentalEditContextEnabled);
    this._accessibilitySupport = this._context.configuration.options.get(EditorOption.accessibilitySupport);
    this._editContext = this._instantiateEditContext();
    this._viewParts.push(this._editContext);
    this._linesContent = createFastDomNode(document.createElement("div"));
    this._linesContent.setClassName("lines-content monaco-editor-background");
    this._linesContent.setPosition("absolute");
    this.domNode = createFastDomNode(document.createElement("div"));
    this.domNode.setClassName(this._getEditorClassName());
    this.domNode.setAttribute("role", "code");
    if (this._context.configuration.options.get(EditorOption.experimentalGpuAcceleration) === "on") {
      this._viewGpuContext = this._instantiationService.createInstance(ViewGpuContext, this._context);
    }
    this._scrollbar = new EditorScrollbar(this._context, this._linesContent, this.domNode, this._overflowGuardContainer);
    this._viewParts.push(this._scrollbar);
    this._viewLines = new ViewLines(this._context, this._viewGpuContext, this._linesContent);
    if (this._viewGpuContext) {
      this._viewLinesGpu = this._instantiationService.createInstance(ViewLinesGpu, this._context, this._viewGpuContext);
    }
    this._viewZones = new ViewZones(this._context);
    this._viewParts.push(this._viewZones);
    const decorationsOverviewRuler = new DecorationsOverviewRuler(this._context);
    this._viewParts.push(decorationsOverviewRuler);
    const scrollDecoration = new ScrollDecorationViewPart(this._context);
    this._viewParts.push(scrollDecoration);
    const contentViewOverlays = new ContentViewOverlays(this._context);
    this._viewParts.push(contentViewOverlays);
    contentViewOverlays.addDynamicOverlay(new CurrentLineHighlightOverlay(this._context));
    contentViewOverlays.addDynamicOverlay(new SelectionsOverlay(this._context));
    contentViewOverlays.addDynamicOverlay(new IndentGuidesOverlay(this._context));
    contentViewOverlays.addDynamicOverlay(new DecorationsOverlay(this._context));
    contentViewOverlays.addDynamicOverlay(new WhitespaceOverlay(this._context));
    const marginViewOverlays = new MarginViewOverlays(this._context);
    this._viewParts.push(marginViewOverlays);
    marginViewOverlays.addDynamicOverlay(new CurrentLineMarginHighlightOverlay(this._context));
    marginViewOverlays.addDynamicOverlay(new MarginViewLineDecorationsOverlay(this._context));
    marginViewOverlays.addDynamicOverlay(new LinesDecorationsOverlay(this._context));
    marginViewOverlays.addDynamicOverlay(new LineNumbersOverlay(this._context));
    if (this._viewGpuContext) {
      marginViewOverlays.addDynamicOverlay(new GpuMarkOverlay(this._context, this._viewGpuContext));
    }
    this._glyphMarginWidgets = new GlyphMarginWidgets(this._context);
    this._viewParts.push(this._glyphMarginWidgets);
    const margin = new Margin(this._context);
    margin.getDomNode().appendChild(this._viewZones.marginDomNode);
    margin.getDomNode().appendChild(marginViewOverlays.getDomNode());
    margin.getDomNode().appendChild(this._glyphMarginWidgets.domNode);
    this._viewParts.push(margin);
    this._contentWidgets = new ViewContentWidgets(this._context, this.domNode);
    this._viewParts.push(this._contentWidgets);
    this._viewCursors = new ViewCursors(this._context);
    this._viewParts.push(this._viewCursors);
    this._overlayWidgets = new ViewOverlayWidgets(this._context, this.domNode);
    this._viewParts.push(this._overlayWidgets);
    const rulers = this._viewGpuContext ? new RulersGpu(this._context, this._viewGpuContext) : new Rulers(this._context);
    this._viewParts.push(rulers);
    const blockOutline = new BlockDecorations(this._context);
    this._viewParts.push(blockOutline);
    const minimap = new Minimap(this._context);
    this._viewParts.push(minimap);
    if (decorationsOverviewRuler) {
      const overviewRulerData = this._scrollbar.getOverviewRulerLayoutInfo();
      overviewRulerData.parent.insertBefore(decorationsOverviewRuler.getDomNode(), overviewRulerData.insertBefore);
    }
    this._linesContent.appendChild(contentViewOverlays.getDomNode());
    if ("domNode" in rulers) {
      this._linesContent.appendChild(rulers.domNode);
    }
    this._linesContent.appendChild(this._viewZones.domNode);
    this._linesContent.appendChild(this._viewLines.getDomNode());
    this._linesContent.appendChild(this._contentWidgets.domNode);
    this._linesContent.appendChild(this._viewCursors.getDomNode());
    this._overflowGuardContainer.appendChild(margin.getDomNode());
    this._overflowGuardContainer.appendChild(this._scrollbar.getDomNode());
    if (this._viewGpuContext) {
      this._overflowGuardContainer.appendChild(this._viewGpuContext.canvas);
    }
    this._overflowGuardContainer.appendChild(scrollDecoration.getDomNode());
    this._overflowGuardContainer.appendChild(this._overlayWidgets.getDomNode());
    this._overflowGuardContainer.appendChild(minimap.getDomNode());
    this._overflowGuardContainer.appendChild(blockOutline.domNode);
    this.domNode.appendChild(this._overflowGuardContainer);
    if (overflowWidgetsDomNode) {
      overflowWidgetsDomNode.appendChild(this._contentWidgets.overflowingContentWidgetsDomNode.domNode);
      overflowWidgetsDomNode.appendChild(this._overlayWidgets.overflowingOverlayWidgetsDomNode.domNode);
    } else {
      this.domNode.appendChild(this._contentWidgets.overflowingContentWidgetsDomNode);
      this.domNode.appendChild(this._overlayWidgets.overflowingOverlayWidgetsDomNode);
    }
    this._applyLayout();
    this._pointerHandler = this._register(new PointerHandler(this._context, this._viewController, this._createPointerHandlerHelper()));
  }
  _instantiateEditContext() {
    const usingExperimentalEditContext = this._context.configuration.options.get(EditorOption.effectiveExperimentalEditContextEnabled);
    if (usingExperimentalEditContext) {
      return this._instantiationService.createInstance(NativeEditContext, this._ownerID, this._context, this._overflowGuardContainer, this._viewController, this._createTextAreaHandlerHelper());
    } else {
      return this._instantiationService.createInstance(TextAreaEditContext, this._context, this._overflowGuardContainer, this._viewController, this._createTextAreaHandlerHelper());
    }
  }
  _updateEditContext() {
    const experimentalEditContextEnabled = this._context.configuration.options.get(EditorOption.effectiveExperimentalEditContextEnabled);
    const accessibilitySupport = this._context.configuration.options.get(EditorOption.accessibilitySupport);
    if (this._experimentalEditContextEnabled === experimentalEditContextEnabled && this._accessibilitySupport === accessibilitySupport) {
      return;
    }
    this._experimentalEditContextEnabled = experimentalEditContextEnabled;
    this._accessibilitySupport = accessibilitySupport;
    const isEditContextFocused = this._editContext.isFocused();
    const indexOfEditContext = this._viewParts.indexOf(this._editContext);
    this._editContext.dispose();
    this._editContext = this._instantiateEditContext();
    if (isEditContextFocused) {
      this._editContext.focus();
    }
    if (indexOfEditContext !== -1) {
      this._viewParts.splice(indexOfEditContext, 1, this._editContext);
    }
  }
  _computeGlyphMarginLanes() {
    const model = this._context.viewModel.model;
    const laneModel = this._context.viewModel.glyphLanes;
    let glyphs = [];
    let maxLineNumber = 0;
    glyphs = glyphs.concat(model.getAllMarginDecorations().map((decoration) => {
      const lane = decoration.options.glyphMargin?.position ?? GlyphMarginLane.Center;
      maxLineNumber = Math.max(maxLineNumber, decoration.range.endLineNumber);
      return { range: decoration.range, lane, persist: decoration.options.glyphMargin?.persistLane };
    }));
    glyphs = glyphs.concat(this._glyphMarginWidgets.getWidgets().map((widget) => {
      const range = model.validateRange(widget.preference.range);
      maxLineNumber = Math.max(maxLineNumber, range.endLineNumber);
      return { range, lane: widget.preference.lane };
    }));
    glyphs.sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
    laneModel.reset(maxLineNumber);
    for (const glyph of glyphs) {
      laneModel.push(glyph.lane, glyph.range, glyph.persist);
    }
    return laneModel;
  }
  _createPointerHandlerHelper() {
    return {
      viewDomNode: this.domNode.domNode,
      linesContentDomNode: this._linesContent.domNode,
      viewLinesDomNode: this._viewLines.getDomNode().domNode,
      viewLinesGpu: this._viewLinesGpu,
      focusTextArea: () => {
        this.focus();
      },
      dispatchTextAreaEvent: (event) => {
        this._editContext.domNode.domNode.dispatchEvent(event);
      },
      getLastRenderData: () => {
        const lastViewCursorsRenderData = this._viewCursors.getLastRenderData() || [];
        const lastTextareaPosition = this._editContext.getLastRenderData();
        return new PointerHandlerLastRenderData(lastViewCursorsRenderData, lastTextareaPosition);
      },
      renderNow: () => {
        this.render(true, false);
      },
      shouldSuppressMouseDownOnViewZone: (viewZoneId) => {
        return this._viewZones.shouldSuppressMouseDownOnViewZone(viewZoneId);
      },
      shouldSuppressMouseDownOnWidget: (widgetId) => {
        return this._contentWidgets.shouldSuppressMouseDownOnWidget(widgetId);
      },
      getPositionFromDOMInfo: (spanNode, offset) => {
        this._flushAccumulatedAndRenderNow();
        return this._viewLines.getPositionFromDOMInfo(spanNode, offset);
      },
      visibleRangeForPosition: (lineNumber, column) => {
        this._flushAccumulatedAndRenderNow();
        const position = new Position(lineNumber, column);
        return this._viewLines.visibleRangeForPosition(position) ?? this._viewLinesGpu?.visibleRangeForPosition(position) ?? null;
      },
      getLineWidth: (lineNumber) => {
        this._flushAccumulatedAndRenderNow();
        if (this._viewLinesGpu) {
          const result = this._viewLinesGpu.getLineWidth(lineNumber);
          if (result !== void 0) {
            return result;
          }
        }
        return this._viewLines.getLineWidth(lineNumber);
      }
    };
  }
  _createTextAreaHandlerHelper() {
    return {
      visibleRangeForPosition: (position) => {
        this._flushAccumulatedAndRenderNow();
        return this._viewLines.visibleRangeForPosition(position);
      },
      linesVisibleRangesForRange: (range, includeNewLines) => {
        this._flushAccumulatedAndRenderNow();
        return this._viewLines.linesVisibleRangesForRange(range, includeNewLines);
      }
    };
  }
  _applyLayout() {
    const options = this._context.configuration.options;
    const layoutInfo = options.get(EditorOption.layoutInfo);
    this.domNode.setWidth(layoutInfo.width);
    this.domNode.setHeight(layoutInfo.height);
    this._overflowGuardContainer.setWidth(layoutInfo.width);
    this._overflowGuardContainer.setHeight(layoutInfo.height);
    this._linesContent.setWidth(16777216);
    this._linesContent.setHeight(16777216);
  }
  _getEditorClassName() {
    const focused = this._editContext.isFocused() ? " focused" : "";
    return this._context.configuration.options.get(EditorOption.editorClassName) + " " + getThemeTypeSelector(this._context.theme.type) + focused;
  }
  // --- begin event handlers
  handleEvents(events) {
    super.handleEvents(events);
    this._scheduleRender();
  }
  onConfigurationChanged(e) {
    this.domNode.setClassName(this._getEditorClassName());
    this._updateEditContext();
    this._applyLayout();
    return false;
  }
  onCursorStateChanged(e) {
    this._selections = e.selections;
    return false;
  }
  onDecorationsChanged(e) {
    if (e.affectsGlyphMargin) {
      this._shouldRecomputeGlyphMarginLanes = true;
    }
    return false;
  }
  onFocusChanged(e) {
    this.domNode.setClassName(this._getEditorClassName());
    return false;
  }
  onThemeChanged(e) {
    this._context.theme.update(e.theme);
    this.domNode.setClassName(this._getEditorClassName());
    return false;
  }
  // --- end event handlers
  dispose() {
    if (this._renderAnimationFrame !== null) {
      this._renderAnimationFrame.dispose();
      this._renderAnimationFrame = null;
    }
    this._contentWidgets.overflowingContentWidgetsDomNode.domNode.remove();
    this._overlayWidgets.overflowingOverlayWidgetsDomNode.domNode.remove();
    this._context.removeEventHandler(this);
    this._viewGpuContext?.dispose();
    this._viewLines.dispose();
    this._viewLinesGpu?.dispose();
    for (const viewPart of this._viewParts) {
      viewPart.dispose();
    }
    super.dispose();
  }
  _scheduleRender() {
    if (this._store.isDisposed) {
      throw new BugIndicatingError();
    }
    if (this._renderAnimationFrame === null) {
      if (this._editContext instanceof NativeEditContext) {
        this._editContext.setEditContextOnDomNode();
      }
      const rendering = this._createCoordinatedRendering();
      this._renderAnimationFrame = EditorRenderingCoordinator.INSTANCE.scheduleCoordinatedRendering({
        window: dom.getWindow(this.domNode?.domNode),
        prepareRenderText: () => {
          if (this._store.isDisposed) {
            throw new BugIndicatingError();
          }
          try {
            return rendering.prepareRenderText();
          } finally {
            this._renderAnimationFrame = null;
          }
        },
        renderText: () => {
          if (this._store.isDisposed) {
            throw new BugIndicatingError();
          }
          return rendering.renderText();
        },
        prepareRender: (viewParts, ctx) => {
          if (this._store.isDisposed) {
            throw new BugIndicatingError();
          }
          return rendering.prepareRender(viewParts, ctx);
        },
        render: (viewParts, ctx) => {
          if (this._store.isDisposed) {
            throw new BugIndicatingError();
          }
          return rendering.render(viewParts, ctx);
        }
      });
    }
  }
  _flushAccumulatedAndRenderNow() {
    const rendering = this._createCoordinatedRendering();
    safeInvokeNoArg(() => rendering.prepareRenderText());
    const data = safeInvokeNoArg(() => rendering.renderText());
    if (data) {
      const [viewParts, ctx] = data;
      safeInvokeNoArg(() => rendering.prepareRender(viewParts, ctx));
      safeInvokeNoArg(() => rendering.render(viewParts, ctx));
    }
  }
  _getViewPartsToRender() {
    const result = [];
    let resultLen = 0;
    for (const viewPart of this._viewParts) {
      if (viewPart.shouldRender()) {
        result[resultLen++] = viewPart;
      }
    }
    return result;
  }
  _createCoordinatedRendering() {
    return {
      prepareRenderText: () => {
        if (this._shouldRecomputeGlyphMarginLanes) {
          this._shouldRecomputeGlyphMarginLanes = false;
          const model = this._computeGlyphMarginLanes();
          this._context.configuration.setGlyphMarginDecorationLaneCount(model.requiredLanes);
        }
        inputLatency.onRenderStart();
      },
      renderText: () => {
        if (!this.domNode.domNode.isConnected) {
          return null;
        }
        let viewPartsToRender = this._getViewPartsToRender();
        if (!this._viewLines.shouldRender() && viewPartsToRender.length === 0) {
          return null;
        }
        const partialViewportData = this._context.viewLayout.getLinesViewportData();
        this._context.viewModel.setViewport(partialViewportData.startLineNumber, partialViewportData.endLineNumber, partialViewportData.centeredLineNumber);
        const viewportData = new ViewportData(
          this._selections,
          partialViewportData,
          this._context.viewLayout.getWhitespaceViewportData(),
          this._context.viewModel
        );
        if (this._contentWidgets.shouldRender()) {
          this._contentWidgets.onBeforeRender(viewportData);
        }
        if (this._viewLines.shouldRender()) {
          this._viewLines.renderText(viewportData);
          this._viewLines.onDidRender();
          viewPartsToRender = this._getViewPartsToRender();
        }
        if (this._viewLinesGpu?.shouldRender()) {
          this._viewLinesGpu.renderText(viewportData);
          this._viewLinesGpu.onDidRender();
        }
        return [viewPartsToRender, new RenderingContext(this._context.viewLayout, viewportData, this._viewLines, this._viewLinesGpu)];
      },
      prepareRender: (viewPartsToRender, ctx) => {
        for (const viewPart of viewPartsToRender) {
          viewPart.prepareRender(ctx);
        }
      },
      render: (viewPartsToRender, ctx) => {
        for (const viewPart of viewPartsToRender) {
          viewPart.render(ctx);
          viewPart.onDidRender();
        }
      }
    };
  }
  // --- BEGIN CodeEditor helpers
  delegateVerticalScrollbarPointerDown(browserEvent) {
    this._scrollbar.delegateVerticalScrollbarPointerDown(browserEvent);
  }
  delegateScrollFromMouseWheelEvent(browserEvent) {
    this._scrollbar.delegateScrollFromMouseWheelEvent(browserEvent);
  }
  restoreState(scrollPosition) {
    this._context.viewModel.viewLayout.setScrollPosition({
      scrollTop: scrollPosition.scrollTop,
      scrollLeft: scrollPosition.scrollLeft
    }, ScrollType.Immediate);
    this._context.viewModel.visibleLinesStabilized();
  }
  getOffsetForColumn(modelLineNumber, modelColumn) {
    const modelPosition = this._context.viewModel.model.validatePosition({
      lineNumber: modelLineNumber,
      column: modelColumn
    });
    const viewPosition = this._context.viewModel.coordinatesConverter.convertModelPositionToViewPosition(modelPosition);
    this._flushAccumulatedAndRenderNow();
    const visibleRange = this._viewLines.visibleRangeForPosition(new Position(viewPosition.lineNumber, viewPosition.column));
    if (!visibleRange) {
      return -1;
    }
    return visibleRange.left;
  }
  getTargetAtClientPoint(clientX, clientY) {
    const mouseTarget = this._pointerHandler.getTargetAtClientPoint(clientX, clientY);
    if (!mouseTarget) {
      return null;
    }
    return ViewUserInputEvents.convertViewToModelMouseTarget(mouseTarget, this._context.viewModel.coordinatesConverter);
  }
  createOverviewRuler(cssClassName) {
    return new OverviewRuler(this._context, cssClassName);
  }
  change(callback) {
    this._viewZones.changeViewZones(callback);
    this._scheduleRender();
  }
  render(now, everything) {
    if (everything) {
      this._viewLines.forceShouldRender();
      for (const viewPart of this._viewParts) {
        viewPart.forceShouldRender();
      }
    }
    if (now) {
      this._flushAccumulatedAndRenderNow();
    } else {
      this._scheduleRender();
    }
  }
  writeScreenReaderContent(reason) {
    this._editContext.writeScreenReaderContent(reason);
  }
  focus() {
    this._editContext.focus();
  }
  isFocused() {
    return this._editContext.isFocused();
  }
  isWidgetFocused() {
    return this._widgetFocusTracker.hasFocus();
  }
  refreshFocusState() {
    this._editContext.refreshFocusState();
    this._widgetFocusTracker.refreshState();
  }
  setAriaOptions(options) {
    this._editContext.setAriaOptions(options);
  }
  addContentWidget(widgetData) {
    this._contentWidgets.addWidget(widgetData.widget);
    this.layoutContentWidget(widgetData);
    this._scheduleRender();
  }
  layoutContentWidget(widgetData) {
    this._contentWidgets.setWidgetPosition(
      widgetData.widget,
      widgetData.position?.position ?? null,
      widgetData.position?.secondaryPosition ?? null,
      widgetData.position?.preference ?? null,
      widgetData.position?.positionAffinity ?? null
    );
    this._scheduleRender();
  }
  removeContentWidget(widgetData) {
    this._contentWidgets.removeWidget(widgetData.widget);
    this._scheduleRender();
  }
  addOverlayWidget(widgetData) {
    this._overlayWidgets.addWidget(widgetData.widget);
    this.layoutOverlayWidget(widgetData);
    this._scheduleRender();
  }
  layoutOverlayWidget(widgetData) {
    const shouldRender = this._overlayWidgets.setWidgetPosition(widgetData.widget, widgetData.position);
    if (shouldRender) {
      this._scheduleRender();
    }
  }
  removeOverlayWidget(widgetData) {
    this._overlayWidgets.removeWidget(widgetData.widget);
    this._scheduleRender();
  }
  addGlyphMarginWidget(widgetData) {
    this._glyphMarginWidgets.addWidget(widgetData.widget);
    this._shouldRecomputeGlyphMarginLanes = true;
    this._scheduleRender();
  }
  layoutGlyphMarginWidget(widgetData) {
    const newPreference = widgetData.position;
    const shouldRender = this._glyphMarginWidgets.setWidgetPosition(widgetData.widget, newPreference);
    if (shouldRender) {
      this._shouldRecomputeGlyphMarginLanes = true;
      this._scheduleRender();
    }
  }
  removeGlyphMarginWidget(widgetData) {
    this._glyphMarginWidgets.removeWidget(widgetData.widget);
    this._shouldRecomputeGlyphMarginLanes = true;
    this._scheduleRender();
  }
  // --- END CodeEditor helpers
};
View = __decorateClass([
  __decorateParam(8, IInstantiationService)
], View);
function safeInvokeNoArg(func) {
  try {
    return func();
  } catch (e) {
    onUnexpectedError(e);
    return null;
  }
}
const _EditorRenderingCoordinator = class _EditorRenderingCoordinator {
  constructor() {
    this._coordinatedRenderings = [];
    this._animationFrameRunners = /* @__PURE__ */ new Map();
  }
  scheduleCoordinatedRendering(rendering) {
    this._coordinatedRenderings.push(rendering);
    this._scheduleRender(rendering.window);
    return {
      dispose: () => {
        const renderingIndex = this._coordinatedRenderings.indexOf(rendering);
        if (renderingIndex === -1) {
          return;
        }
        this._coordinatedRenderings.splice(renderingIndex, 1);
        if (this._coordinatedRenderings.length === 0) {
          for (const [_, disposable] of this._animationFrameRunners) {
            disposable.dispose();
          }
          this._animationFrameRunners.clear();
        }
      }
    };
  }
  _scheduleRender(window) {
    if (!this._animationFrameRunners.has(window)) {
      const runner = () => {
        this._animationFrameRunners.delete(window);
        this._onRenderScheduled();
      };
      this._animationFrameRunners.set(window, dom.runAtThisOrScheduleAtNextAnimationFrame(window, runner, 100));
    }
  }
  _onRenderScheduled() {
    const coordinatedRenderings = this._coordinatedRenderings.slice(0);
    this._coordinatedRenderings = [];
    for (const rendering of coordinatedRenderings) {
      safeInvokeNoArg(() => rendering.prepareRenderText());
    }
    const datas = [];
    for (let i = 0, len = coordinatedRenderings.length; i < len; i++) {
      const rendering = coordinatedRenderings[i];
      datas[i] = safeInvokeNoArg(() => rendering.renderText());
    }
    for (let i = 0, len = coordinatedRenderings.length; i < len; i++) {
      const rendering = coordinatedRenderings[i];
      const data = datas[i];
      if (!data) {
        continue;
      }
      const [viewParts, ctx] = data;
      safeInvokeNoArg(() => rendering.prepareRender(viewParts, ctx));
    }
    for (let i = 0, len = coordinatedRenderings.length; i < len; i++) {
      const rendering = coordinatedRenderings[i];
      const data = datas[i];
      if (!data) {
        continue;
      }
      const [viewParts, ctx] = data;
      safeInvokeNoArg(() => rendering.render(viewParts, ctx));
    }
  }
};
_EditorRenderingCoordinator.INSTANCE = new _EditorRenderingCoordinator();
let EditorRenderingCoordinator = _EditorRenderingCoordinator;
class CodeEditorWidgetFocusTracker extends Disposable {
  constructor(domElement, overflowWidgetsDomNode) {
    super();
    this._onChange = this._register(new Emitter());
    this.onChange = this._onChange.event;
    this._hadFocus = void 0;
    this._hasDomElementFocus = false;
    this._domFocusTracker = this._register(dom.trackFocus(domElement));
    this._overflowWidgetsDomNodeHasFocus = false;
    this._register(this._domFocusTracker.onDidFocus(() => {
      this._hasDomElementFocus = true;
      this._update();
    }));
    this._register(this._domFocusTracker.onDidBlur(() => {
      this._hasDomElementFocus = false;
      this._update();
    }));
    if (overflowWidgetsDomNode) {
      this._overflowWidgetsDomNode = this._register(dom.trackFocus(overflowWidgetsDomNode));
      this._register(this._overflowWidgetsDomNode.onDidFocus(() => {
        this._overflowWidgetsDomNodeHasFocus = true;
        this._update();
      }));
      this._register(this._overflowWidgetsDomNode.onDidBlur(() => {
        this._overflowWidgetsDomNodeHasFocus = false;
        this._update();
      }));
    }
  }
  _update() {
    const focused = this._hasDomElementFocus || this._overflowWidgetsDomNodeHasFocus;
    if (this._hadFocus !== focused) {
      this._hadFocus = focused;
      this._onChange.fire(void 0);
    }
  }
  hasFocus() {
    return this._hadFocus ?? false;
  }
  refreshState() {
    this._domFocusTracker.refreshState();
    this._overflowWidgetsDomNode?.refreshState?.();
  }
}
export {
  View
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci92aWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRmFzdERvbU5vZGUsIGNyZWF0ZUZhc3REb21Ob2RlIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2Zhc3REb21Ob2RlLmpzJztcbmltcG9ydCB7IElNb3VzZVdoZWVsRXZlbnQgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBpbnB1dExhdGVuY3kgfSBmcm9tICcuLi8uLi9iYXNlL2Jyb3dzZXIvcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgQ29kZVdpbmRvdyB9IGZyb20gJy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgQnVnSW5kaWNhdGluZ0Vycm9yLCBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUG9pbnRlckhhbmRsZXJIZWxwZXIgfSBmcm9tICcuL2NvbnRyb2xsZXIvbW91c2VIYW5kbGVyLmpzJztcbmltcG9ydCB7IFBvaW50ZXJIYW5kbGVyTGFzdFJlbmRlckRhdGEgfSBmcm9tICcuL2NvbnRyb2xsZXIvbW91c2VUYXJnZXQuanMnO1xuaW1wb3J0IHsgUG9pbnRlckhhbmRsZXIgfSBmcm9tICcuL2NvbnRyb2xsZXIvcG9pbnRlckhhbmRsZXIuanMnO1xuaW1wb3J0IHsgSUNvbnRlbnRXaWRnZXQsIElDb250ZW50V2lkZ2V0UG9zaXRpb24sIElFZGl0b3JBcmlhT3B0aW9ucywgSUdseXBoTWFyZ2luV2lkZ2V0LCBJR2x5cGhNYXJnaW5XaWRnZXRQb3NpdGlvbiwgSU1vdXNlVGFyZ2V0LCBJT3ZlcmxheVdpZGdldCwgSU92ZXJsYXlXaWRnZXRQb3NpdGlvbiwgSVZpZXdab25lQ2hhbmdlQWNjZXNzb3IgfSBmcm9tICcuL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgTGluZVZpc2libGVSYW5nZXMsIFJlbmRlcmluZ0NvbnRleHQsIFJlc3RyaWN0ZWRSZW5kZXJpbmdDb250ZXh0IH0gZnJvbSAnLi92aWV3L3JlbmRlcmluZ0NvbnRleHQuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmREZWxlZ2F0ZSwgVmlld0NvbnRyb2xsZXIgfSBmcm9tICcuL3ZpZXcvdmlld0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgQ29udGVudFZpZXdPdmVybGF5cywgTWFyZ2luVmlld092ZXJsYXlzIH0gZnJvbSAnLi92aWV3L3ZpZXdPdmVybGF5cy5qcyc7XG5pbXBvcnQgeyBQYXJ0RmluZ2VycHJpbnQsIFBhcnRGaW5nZXJwcmludHMsIFZpZXdQYXJ0IH0gZnJvbSAnLi92aWV3L3ZpZXdQYXJ0LmpzJztcbmltcG9ydCB7IFZpZXdVc2VySW5wdXRFdmVudHMgfSBmcm9tICcuL3ZpZXcvdmlld1VzZXJJbnB1dEV2ZW50cy5qcyc7XG5pbXBvcnQgeyBCbG9ja0RlY29yYXRpb25zIH0gZnJvbSAnLi92aWV3UGFydHMvYmxvY2tEZWNvcmF0aW9ucy9ibG9ja0RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IFZpZXdDb250ZW50V2lkZ2V0cyB9IGZyb20gJy4vdmlld1BhcnRzL2NvbnRlbnRXaWRnZXRzL2NvbnRlbnRXaWRnZXRzLmpzJztcbmltcG9ydCB7IEN1cnJlbnRMaW5lSGlnaGxpZ2h0T3ZlcmxheSwgQ3VycmVudExpbmVNYXJnaW5IaWdobGlnaHRPdmVybGF5IH0gZnJvbSAnLi92aWV3UGFydHMvY3VycmVudExpbmVIaWdobGlnaHQvY3VycmVudExpbmVIaWdobGlnaHQuanMnO1xuaW1wb3J0IHsgRGVjb3JhdGlvbnNPdmVybGF5IH0gZnJvbSAnLi92aWV3UGFydHMvZGVjb3JhdGlvbnMvZGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yU2Nyb2xsYmFyIH0gZnJvbSAnLi92aWV3UGFydHMvZWRpdG9yU2Nyb2xsYmFyL2VkaXRvclNjcm9sbGJhci5qcyc7XG5pbXBvcnQgeyBHbHlwaE1hcmdpbldpZGdldHMgfSBmcm9tICcuL3ZpZXdQYXJ0cy9nbHlwaE1hcmdpbi9nbHlwaE1hcmdpbi5qcyc7XG5pbXBvcnQgeyBJbmRlbnRHdWlkZXNPdmVybGF5IH0gZnJvbSAnLi92aWV3UGFydHMvaW5kZW50R3VpZGVzL2luZGVudEd1aWRlcy5qcyc7XG5pbXBvcnQgeyBMaW5lTnVtYmVyc092ZXJsYXkgfSBmcm9tICcuL3ZpZXdQYXJ0cy9saW5lTnVtYmVycy9saW5lTnVtYmVycy5qcyc7XG5pbXBvcnQgeyBWaWV3TGluZXMgfSBmcm9tICcuL3ZpZXdQYXJ0cy92aWV3TGluZXMvdmlld0xpbmVzLmpzJztcbmltcG9ydCB7IExpbmVzRGVjb3JhdGlvbnNPdmVybGF5IH0gZnJvbSAnLi92aWV3UGFydHMvbGluZXNEZWNvcmF0aW9ucy9saW5lc0RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IE1hcmdpbiB9IGZyb20gJy4vdmlld1BhcnRzL21hcmdpbi9tYXJnaW4uanMnO1xuaW1wb3J0IHsgTWFyZ2luVmlld0xpbmVEZWNvcmF0aW9uc092ZXJsYXkgfSBmcm9tICcuL3ZpZXdQYXJ0cy9tYXJnaW5EZWNvcmF0aW9ucy9tYXJnaW5EZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBNaW5pbWFwIH0gZnJvbSAnLi92aWV3UGFydHMvbWluaW1hcC9taW5pbWFwLmpzJztcbmltcG9ydCB7IFZpZXdPdmVybGF5V2lkZ2V0cyB9IGZyb20gJy4vdmlld1BhcnRzL292ZXJsYXlXaWRnZXRzL292ZXJsYXlXaWRnZXRzLmpzJztcbmltcG9ydCB7IERlY29yYXRpb25zT3ZlcnZpZXdSdWxlciB9IGZyb20gJy4vdmlld1BhcnRzL292ZXJ2aWV3UnVsZXIvZGVjb3JhdGlvbnNPdmVydmlld1J1bGVyLmpzJztcbmltcG9ydCB7IE92ZXJ2aWV3UnVsZXIgfSBmcm9tICcuL3ZpZXdQYXJ0cy9vdmVydmlld1J1bGVyL292ZXJ2aWV3UnVsZXIuanMnO1xuaW1wb3J0IHsgUnVsZXJzIH0gZnJvbSAnLi92aWV3UGFydHMvcnVsZXJzL3J1bGVycy5qcyc7XG5pbXBvcnQgeyBTY3JvbGxEZWNvcmF0aW9uVmlld1BhcnQgfSBmcm9tICcuL3ZpZXdQYXJ0cy9zY3JvbGxEZWNvcmF0aW9uL3Njcm9sbERlY29yYXRpb24uanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uc092ZXJsYXkgfSBmcm9tICcuL3ZpZXdQYXJ0cy9zZWxlY3Rpb25zL3NlbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgVmlld0N1cnNvcnMgfSBmcm9tICcuL3ZpZXdQYXJ0cy92aWV3Q3Vyc29ycy92aWV3Q3Vyc29ycy5qcyc7XG5pbXBvcnQgeyBWaWV3Wm9uZXMgfSBmcm9tICcuL3ZpZXdQYXJ0cy92aWV3Wm9uZXMvdmlld1pvbmVzLmpzJztcbmltcG9ydCB7IFdoaXRlc3BhY2VPdmVybGF5IH0gZnJvbSAnLi92aWV3UGFydHMvd2hpdGVzcGFjZS93aGl0ZXNwYWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IFNjcm9sbFR5cGUgfSBmcm9tICcuLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEdseXBoTWFyZ2luTGFuZSwgSUdseXBoTWFyZ2luTGFuZXNNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBWaWV3RXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29tbW9uL3ZpZXdFdmVudEhhbmRsZXIuanMnO1xuaW1wb3J0ICogYXMgdmlld0V2ZW50cyBmcm9tICcuLi9jb21tb24vdmlld0V2ZW50cy5qcyc7XG5pbXBvcnQgeyBWaWV3cG9ydERhdGEgfSBmcm9tICcuLi9jb21tb24vdmlld0xheW91dC92aWV3TGluZXNWaWV3cG9ydERhdGEuanMnO1xuaW1wb3J0IHsgSVZpZXdNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi92aWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRleHQgfSBmcm9tICcuLi9jb21tb24vdmlld01vZGVsL3ZpZXdDb250ZXh0LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbG9yVGhlbWUsIGdldFRoZW1lVHlwZVNlbGVjdG9yIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBWaWV3R3B1Q29udGV4dCB9IGZyb20gJy4vZ3B1L3ZpZXdHcHVDb250ZXh0LmpzJztcbmltcG9ydCB7IFZpZXdMaW5lc0dwdSB9IGZyb20gJy4vdmlld1BhcnRzL3ZpZXdMaW5lc0dwdS92aWV3TGluZXNHcHUuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RFZGl0Q29udGV4dCB9IGZyb20gJy4vY29udHJvbGxlci9lZGl0Q29udGV4dC9lZGl0Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBJVmlzaWJsZVJhbmdlUHJvdmlkZXIsIFRleHRBcmVhRWRpdENvbnRleHQgfSBmcm9tICcuL2NvbnRyb2xsZXIvZWRpdENvbnRleHQvdGV4dEFyZWEvdGV4dEFyZWFFZGl0Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBOYXRpdmVFZGl0Q29udGV4dCB9IGZyb20gJy4vY29udHJvbGxlci9lZGl0Q29udGV4dC9uYXRpdmUvbmF0aXZlRWRpdENvbnRleHQuanMnO1xuaW1wb3J0IHsgUnVsZXJzR3B1IH0gZnJvbSAnLi92aWV3UGFydHMvcnVsZXJzR3B1L3J1bGVyc0dwdS5qcyc7XG5pbXBvcnQgeyBHcHVNYXJrT3ZlcmxheSB9IGZyb20gJy4vdmlld1BhcnRzL2dwdU1hcmsvZ3B1TWFyay5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5U3VwcG9ydCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5cblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGVudFdpZGdldERhdGEge1xuXHR3aWRnZXQ6IElDb250ZW50V2lkZ2V0O1xuXHRwb3NpdGlvbjogSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB8IG51bGw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU92ZXJsYXlXaWRnZXREYXRhIHtcblx0d2lkZ2V0OiBJT3ZlcmxheVdpZGdldDtcblx0cG9zaXRpb246IElPdmVybGF5V2lkZ2V0UG9zaXRpb24gfCBudWxsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElHbHlwaE1hcmdpbldpZGdldERhdGEge1xuXHR3aWRnZXQ6IElHbHlwaE1hcmdpbldpZGdldDtcblx0cG9zaXRpb246IElHbHlwaE1hcmdpbldpZGdldFBvc2l0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgVmlldyBleHRlbmRzIFZpZXdFdmVudEhhbmRsZXIge1xuXG5cdHByaXZhdGUgX3dpZGdldEZvY3VzVHJhY2tlcjogQ29kZUVkaXRvcldpZGdldEZvY3VzVHJhY2tlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zY3JvbGxiYXI6IEVkaXRvclNjcm9sbGJhcjtcblx0cHJpdmF0ZSByZWFkb25seSBfY29udGV4dDogVmlld0NvbnRleHQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdHcHVDb250ZXh0PzogVmlld0dwdUNvbnRleHQ7XG5cdHByaXZhdGUgX3NlbGVjdGlvbnM6IFNlbGVjdGlvbltdO1xuXG5cdC8vIFRoZSB2aWV3IGxpbmVzXG5cdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdMaW5lczogVmlld0xpbmVzO1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3TGluZXNHcHU/OiBWaWV3TGluZXNHcHU7XG5cblx0Ly8gVGhlc2UgYXJlIHBhcnRzLCBidXQgd2UgbXVzdCBkbyBzb21lIEFQSSByZWxhdGVkIGNhbGxzIG9uIHRoZW0sIHNvIHdlIGtlZXAgYSByZWZlcmVuY2Vcblx0cHJpdmF0ZSByZWFkb25seSBfdmlld1pvbmVzOiBWaWV3Wm9uZXM7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRlbnRXaWRnZXRzOiBWaWV3Q29udGVudFdpZGdldHM7XG5cdHByaXZhdGUgcmVhZG9ubHkgX292ZXJsYXlXaWRnZXRzOiBWaWV3T3ZlcmxheVdpZGdldHM7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2dseXBoTWFyZ2luV2lkZ2V0czogR2x5cGhNYXJnaW5XaWRnZXRzO1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aWV3Q3Vyc29yczogVmlld0N1cnNvcnM7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdQYXJ0czogVmlld1BhcnRbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfdmlld0NvbnRyb2xsZXI6IFZpZXdDb250cm9sbGVyO1xuXG5cdHByaXZhdGUgX2V4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZDogYm9vbGVhbjtcblx0cHJpdmF0ZSBfYWNjZXNzaWJpbGl0eVN1cHBvcnQ6IEFjY2Vzc2liaWxpdHlTdXBwb3J0O1xuXHRwcml2YXRlIF9lZGl0Q29udGV4dDogQWJzdHJhY3RFZGl0Q29udGV4dDtcblx0cHJpdmF0ZSByZWFkb25seSBfcG9pbnRlckhhbmRsZXI6IFBvaW50ZXJIYW5kbGVyO1xuXG5cdC8vIERvbSBub2Rlc1xuXHRwcml2YXRlIHJlYWRvbmx5IF9saW5lc0NvbnRlbnQ6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50Pjtcblx0cHVibGljIHJlYWRvbmx5IGRvbU5vZGU6IEZhc3REb21Ob2RlPEhUTUxFbGVtZW50Pjtcblx0cHJpdmF0ZSByZWFkb25seSBfb3ZlcmZsb3dHdWFyZENvbnRhaW5lcjogRmFzdERvbU5vZGU8SFRNTEVsZW1lbnQ+O1xuXG5cdC8vIEFjdHVhbCBtdXRhYmxlIHN0YXRlXG5cdHByaXZhdGUgX3Nob3VsZFJlY29tcHV0ZUdseXBoTWFyZ2luTGFuZXM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfcmVuZGVyQW5pbWF0aW9uRnJhbWU6IElEaXNwb3NhYmxlIHwgbnVsbDtcblx0cHJpdmF0ZSBfb3duZXJJRDogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGVkaXRvckNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0b3duZXJJRDogc3RyaW5nLFxuXHRcdGNvbW1hbmREZWxlZ2F0ZTogSUNvbW1hbmREZWxlZ2F0ZSxcblx0XHRjb25maWd1cmF0aW9uOiBJRWRpdG9yQ29uZmlndXJhdGlvbixcblx0XHRjb2xvclRoZW1lOiBJQ29sb3JUaGVtZSxcblx0XHRtb2RlbDogSVZpZXdNb2RlbCxcblx0XHR1c2VySW5wdXRFdmVudHM6IFZpZXdVc2VySW5wdXRFdmVudHMsXG5cdFx0b3ZlcmZsb3dXaWRnZXRzRG9tTm9kZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fb3duZXJJRCA9IG93bmVySUQ7XG5cblx0XHR0aGlzLl93aWRnZXRGb2N1c1RyYWNrZXIgPSB0aGlzLl9yZWdpc3Rlcihcblx0XHRcdG5ldyBDb2RlRWRpdG9yV2lkZ2V0Rm9jdXNUcmFja2VyKGVkaXRvckNvbnRhaW5lciwgb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSlcblx0XHQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3dpZGdldEZvY3VzVHJhY2tlci5vbkNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5zZXRIYXNXaWRnZXRGb2N1cyh0aGlzLl93aWRnZXRGb2N1c1RyYWNrZXIuaGFzRm9jdXMoKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fc2VsZWN0aW9ucyA9IFtuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXTtcblx0XHR0aGlzLl9yZW5kZXJBbmltYXRpb25GcmFtZSA9IG51bGw7XG5cblx0XHR0aGlzLl9vdmVyZmxvd0d1YXJkQ29udGFpbmVyID0gY3JlYXRlRmFzdERvbU5vZGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpO1xuXHRcdFBhcnRGaW5nZXJwcmludHMud3JpdGUodGhpcy5fb3ZlcmZsb3dHdWFyZENvbnRhaW5lciwgUGFydEZpbmdlcnByaW50Lk92ZXJmbG93R3VhcmQpO1xuXHRcdHRoaXMuX292ZXJmbG93R3VhcmRDb250YWluZXIuc2V0Q2xhc3NOYW1lKCdvdmVyZmxvdy1ndWFyZCcpO1xuXG5cdFx0dGhpcy5fdmlld0NvbnRyb2xsZXIgPSBuZXcgVmlld0NvbnRyb2xsZXIoY29uZmlndXJhdGlvbiwgbW9kZWwsIHVzZXJJbnB1dEV2ZW50cywgY29tbWFuZERlbGVnYXRlKTtcblxuXHRcdC8vIFRoZSB2aWV3IGNvbnRleHQgaXMgcGFzc2VkIG9uIHRvIG1vc3QgY2xhc3NlcyAoYmFzaWNhbGx5IHRvIHJlZHVjZSBwYXJhbS4gY291bnRzIGluIGN0b3JzKVxuXHRcdHRoaXMuX2NvbnRleHQgPSBuZXcgVmlld0NvbnRleHQoY29uZmlndXJhdGlvbiwgY29sb3JUaGVtZSwgbW9kZWwpO1xuXG5cdFx0Ly8gRW5zdXJlIHRoZSB2aWV3IGlzIHRoZSBmaXJzdCBldmVudCBoYW5kbGVyIGluIG9yZGVyIHRvIHVwZGF0ZSB0aGUgbGF5b3V0XG5cdFx0dGhpcy5fY29udGV4dC5hZGRFdmVudEhhbmRsZXIodGhpcyk7XG5cblx0XHR0aGlzLl92aWV3UGFydHMgPSBbXTtcblxuXHRcdC8vIEtleWJvYXJkIGhhbmRsZXJcblx0XHR0aGlzLl9leHBlcmltZW50YWxFZGl0Q29udGV4dEVuYWJsZWQgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmVmZmVjdGl2ZUV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCk7XG5cdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVN1cHBvcnQgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmFjY2Vzc2liaWxpdHlTdXBwb3J0KTtcblx0XHR0aGlzLl9lZGl0Q29udGV4dCA9IHRoaXMuX2luc3RhbnRpYXRlRWRpdENvbnRleHQoKTtcblxuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKHRoaXMuX2VkaXRDb250ZXh0KTtcblxuXHRcdC8vIFRoZXNlIHR3byBkb20gbm9kZXMgbXVzdCBiZSBjb25zdHJ1Y3RlZCB1cCBmcm9udCwgc2luY2UgcmVmZXJlbmNlcyBhcmUgbmVlZGVkIGluIHRoZSBsYXlvdXQgcHJvdmlkZXIgKHNjcm9sbGluZyAmIGNvLilcblx0XHR0aGlzLl9saW5lc0NvbnRlbnQgPSBjcmVhdGVGYXN0RG9tTm9kZShkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSk7XG5cdFx0dGhpcy5fbGluZXNDb250ZW50LnNldENsYXNzTmFtZSgnbGluZXMtY29udGVudCcgKyAnIG1vbmFjby1lZGl0b3ItYmFja2dyb3VuZCcpO1xuXHRcdHRoaXMuX2xpbmVzQ29udGVudC5zZXRQb3NpdGlvbignYWJzb2x1dGUnKTtcblxuXHRcdHRoaXMuZG9tTm9kZSA9IGNyZWF0ZUZhc3REb21Ob2RlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKTtcblx0XHR0aGlzLmRvbU5vZGUuc2V0Q2xhc3NOYW1lKHRoaXMuX2dldEVkaXRvckNsYXNzTmFtZSgpKTtcblx0XHQvLyBTZXQgcm9sZSAnY29kZScgZm9yIGJldHRlciBzY3JlZW4gcmVhZGVyIHN1cHBvcnQgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzkzNDM4XG5cdFx0dGhpcy5kb21Ob2RlLnNldEF0dHJpYnV0ZSgncm9sZScsICdjb2RlJyk7XG5cblx0XHRpZiAodGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5leHBlcmltZW50YWxHcHVBY2NlbGVyYXRpb24pID09PSAnb24nKSB7XG5cdFx0XHR0aGlzLl92aWV3R3B1Q29udGV4dCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZpZXdHcHVDb250ZXh0LCB0aGlzLl9jb250ZXh0KTtcblx0XHR9XG5cblx0XHR0aGlzLl9zY3JvbGxiYXIgPSBuZXcgRWRpdG9yU2Nyb2xsYmFyKHRoaXMuX2NvbnRleHQsIHRoaXMuX2xpbmVzQ29udGVudCwgdGhpcy5kb21Ob2RlLCB0aGlzLl9vdmVyZmxvd0d1YXJkQ29udGFpbmVyKTtcblx0XHR0aGlzLl92aWV3UGFydHMucHVzaCh0aGlzLl9zY3JvbGxiYXIpO1xuXG5cdFx0Ly8gVmlldyBMaW5lc1xuXHRcdHRoaXMuX3ZpZXdMaW5lcyA9IG5ldyBWaWV3TGluZXModGhpcy5fY29udGV4dCwgdGhpcy5fdmlld0dwdUNvbnRleHQsIHRoaXMuX2xpbmVzQ29udGVudCk7XG5cdFx0aWYgKHRoaXMuX3ZpZXdHcHVDb250ZXh0KSB7XG5cdFx0XHR0aGlzLl92aWV3TGluZXNHcHUgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShWaWV3TGluZXNHcHUsIHRoaXMuX2NvbnRleHQsIHRoaXMuX3ZpZXdHcHVDb250ZXh0KTtcblx0XHR9XG5cblx0XHQvLyBWaWV3IFpvbmVzXG5cdFx0dGhpcy5fdmlld1pvbmVzID0gbmV3IFZpZXdab25lcyh0aGlzLl9jb250ZXh0KTtcblx0XHR0aGlzLl92aWV3UGFydHMucHVzaCh0aGlzLl92aWV3Wm9uZXMpO1xuXG5cdFx0Ly8gRGVjb3JhdGlvbnMgb3ZlcnZpZXcgcnVsZXJcblx0XHRjb25zdCBkZWNvcmF0aW9uc092ZXJ2aWV3UnVsZXIgPSBuZXcgRGVjb3JhdGlvbnNPdmVydmlld1J1bGVyKHRoaXMuX2NvbnRleHQpO1xuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKGRlY29yYXRpb25zT3ZlcnZpZXdSdWxlcik7XG5cblxuXHRcdGNvbnN0IHNjcm9sbERlY29yYXRpb24gPSBuZXcgU2Nyb2xsRGVjb3JhdGlvblZpZXdQYXJ0KHRoaXMuX2NvbnRleHQpO1xuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKHNjcm9sbERlY29yYXRpb24pO1xuXG5cdFx0Y29uc3QgY29udGVudFZpZXdPdmVybGF5cyA9IG5ldyBDb250ZW50Vmlld092ZXJsYXlzKHRoaXMuX2NvbnRleHQpO1xuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKGNvbnRlbnRWaWV3T3ZlcmxheXMpO1xuXHRcdGNvbnRlbnRWaWV3T3ZlcmxheXMuYWRkRHluYW1pY092ZXJsYXkobmV3IEN1cnJlbnRMaW5lSGlnaGxpZ2h0T3ZlcmxheSh0aGlzLl9jb250ZXh0KSk7XG5cdFx0Y29udGVudFZpZXdPdmVybGF5cy5hZGREeW5hbWljT3ZlcmxheShuZXcgU2VsZWN0aW9uc092ZXJsYXkodGhpcy5fY29udGV4dCkpO1xuXHRcdGNvbnRlbnRWaWV3T3ZlcmxheXMuYWRkRHluYW1pY092ZXJsYXkobmV3IEluZGVudEd1aWRlc092ZXJsYXkodGhpcy5fY29udGV4dCkpO1xuXHRcdGNvbnRlbnRWaWV3T3ZlcmxheXMuYWRkRHluYW1pY092ZXJsYXkobmV3IERlY29yYXRpb25zT3ZlcmxheSh0aGlzLl9jb250ZXh0KSk7XG5cdFx0Y29udGVudFZpZXdPdmVybGF5cy5hZGREeW5hbWljT3ZlcmxheShuZXcgV2hpdGVzcGFjZU92ZXJsYXkodGhpcy5fY29udGV4dCkpO1xuXG5cdFx0Y29uc3QgbWFyZ2luVmlld092ZXJsYXlzID0gbmV3IE1hcmdpblZpZXdPdmVybGF5cyh0aGlzLl9jb250ZXh0KTtcblx0XHR0aGlzLl92aWV3UGFydHMucHVzaChtYXJnaW5WaWV3T3ZlcmxheXMpO1xuXHRcdG1hcmdpblZpZXdPdmVybGF5cy5hZGREeW5hbWljT3ZlcmxheShuZXcgQ3VycmVudExpbmVNYXJnaW5IaWdobGlnaHRPdmVybGF5KHRoaXMuX2NvbnRleHQpKTtcblx0XHRtYXJnaW5WaWV3T3ZlcmxheXMuYWRkRHluYW1pY092ZXJsYXkobmV3IE1hcmdpblZpZXdMaW5lRGVjb3JhdGlvbnNPdmVybGF5KHRoaXMuX2NvbnRleHQpKTtcblx0XHRtYXJnaW5WaWV3T3ZlcmxheXMuYWRkRHluYW1pY092ZXJsYXkobmV3IExpbmVzRGVjb3JhdGlvbnNPdmVybGF5KHRoaXMuX2NvbnRleHQpKTtcblx0XHRtYXJnaW5WaWV3T3ZlcmxheXMuYWRkRHluYW1pY092ZXJsYXkobmV3IExpbmVOdW1iZXJzT3ZlcmxheSh0aGlzLl9jb250ZXh0KSk7XG5cdFx0aWYgKHRoaXMuX3ZpZXdHcHVDb250ZXh0KSB7XG5cdFx0XHRtYXJnaW5WaWV3T3ZlcmxheXMuYWRkRHluYW1pY092ZXJsYXkobmV3IEdwdU1hcmtPdmVybGF5KHRoaXMuX2NvbnRleHQsIHRoaXMuX3ZpZXdHcHVDb250ZXh0KSk7XG5cdFx0fVxuXG5cdFx0Ly8gR2x5cGggbWFyZ2luIHdpZGdldHNcblx0XHR0aGlzLl9nbHlwaE1hcmdpbldpZGdldHMgPSBuZXcgR2x5cGhNYXJnaW5XaWRnZXRzKHRoaXMuX2NvbnRleHQpO1xuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKHRoaXMuX2dseXBoTWFyZ2luV2lkZ2V0cyk7XG5cblx0XHRjb25zdCBtYXJnaW4gPSBuZXcgTWFyZ2luKHRoaXMuX2NvbnRleHQpO1xuXHRcdG1hcmdpbi5nZXREb21Ob2RlKCkuYXBwZW5kQ2hpbGQodGhpcy5fdmlld1pvbmVzLm1hcmdpbkRvbU5vZGUpO1xuXHRcdG1hcmdpbi5nZXREb21Ob2RlKCkuYXBwZW5kQ2hpbGQobWFyZ2luVmlld092ZXJsYXlzLmdldERvbU5vZGUoKSk7XG5cdFx0bWFyZ2luLmdldERvbU5vZGUoKS5hcHBlbmRDaGlsZCh0aGlzLl9nbHlwaE1hcmdpbldpZGdldHMuZG9tTm9kZSk7XG5cdFx0dGhpcy5fdmlld1BhcnRzLnB1c2gobWFyZ2luKTtcblxuXHRcdC8vIENvbnRlbnQgd2lkZ2V0c1xuXHRcdHRoaXMuX2NvbnRlbnRXaWRnZXRzID0gbmV3IFZpZXdDb250ZW50V2lkZ2V0cyh0aGlzLl9jb250ZXh0LCB0aGlzLmRvbU5vZGUpO1xuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKHRoaXMuX2NvbnRlbnRXaWRnZXRzKTtcblxuXHRcdHRoaXMuX3ZpZXdDdXJzb3JzID0gbmV3IFZpZXdDdXJzb3JzKHRoaXMuX2NvbnRleHQpO1xuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKHRoaXMuX3ZpZXdDdXJzb3JzKTtcblxuXHRcdC8vIE92ZXJsYXkgd2lkZ2V0c1xuXHRcdHRoaXMuX292ZXJsYXlXaWRnZXRzID0gbmV3IFZpZXdPdmVybGF5V2lkZ2V0cyh0aGlzLl9jb250ZXh0LCB0aGlzLmRvbU5vZGUpO1xuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKHRoaXMuX292ZXJsYXlXaWRnZXRzKTtcblxuXHRcdGNvbnN0IHJ1bGVycyA9IHRoaXMuX3ZpZXdHcHVDb250ZXh0XG5cdFx0XHQ/IG5ldyBSdWxlcnNHcHUodGhpcy5fY29udGV4dCwgdGhpcy5fdmlld0dwdUNvbnRleHQpXG5cdFx0XHQ6IG5ldyBSdWxlcnModGhpcy5fY29udGV4dCk7XG5cdFx0dGhpcy5fdmlld1BhcnRzLnB1c2gocnVsZXJzKTtcblxuXHRcdGNvbnN0IGJsb2NrT3V0bGluZSA9IG5ldyBCbG9ja0RlY29yYXRpb25zKHRoaXMuX2NvbnRleHQpO1xuXHRcdHRoaXMuX3ZpZXdQYXJ0cy5wdXNoKGJsb2NrT3V0bGluZSk7XG5cblx0XHRjb25zdCBtaW5pbWFwID0gbmV3IE1pbmltYXAodGhpcy5fY29udGV4dCk7XG5cdFx0dGhpcy5fdmlld1BhcnRzLnB1c2gobWluaW1hcCk7XG5cblx0XHQvLyAtLS0tLS0tLS0tLS0tLSBXaXJlIGRvbSBub2RlcyB1cFxuXG5cdFx0aWYgKGRlY29yYXRpb25zT3ZlcnZpZXdSdWxlcikge1xuXHRcdFx0Y29uc3Qgb3ZlcnZpZXdSdWxlckRhdGEgPSB0aGlzLl9zY3JvbGxiYXIuZ2V0T3ZlcnZpZXdSdWxlckxheW91dEluZm8oKTtcblx0XHRcdG92ZXJ2aWV3UnVsZXJEYXRhLnBhcmVudC5pbnNlcnRCZWZvcmUoZGVjb3JhdGlvbnNPdmVydmlld1J1bGVyLmdldERvbU5vZGUoKSwgb3ZlcnZpZXdSdWxlckRhdGEuaW5zZXJ0QmVmb3JlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9saW5lc0NvbnRlbnQuYXBwZW5kQ2hpbGQoY29udGVudFZpZXdPdmVybGF5cy5nZXREb21Ob2RlKCkpO1xuXHRcdGlmICgnZG9tTm9kZScgaW4gcnVsZXJzKSB7XG5cdFx0XHR0aGlzLl9saW5lc0NvbnRlbnQuYXBwZW5kQ2hpbGQocnVsZXJzLmRvbU5vZGUpO1xuXHRcdH1cblx0XHR0aGlzLl9saW5lc0NvbnRlbnQuYXBwZW5kQ2hpbGQodGhpcy5fdmlld1pvbmVzLmRvbU5vZGUpO1xuXHRcdHRoaXMuX2xpbmVzQ29udGVudC5hcHBlbmRDaGlsZCh0aGlzLl92aWV3TGluZXMuZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLl9saW5lc0NvbnRlbnQuYXBwZW5kQ2hpbGQodGhpcy5fY29udGVudFdpZGdldHMuZG9tTm9kZSk7XG5cdFx0dGhpcy5fbGluZXNDb250ZW50LmFwcGVuZENoaWxkKHRoaXMuX3ZpZXdDdXJzb3JzLmdldERvbU5vZGUoKSk7XG5cdFx0dGhpcy5fb3ZlcmZsb3dHdWFyZENvbnRhaW5lci5hcHBlbmRDaGlsZChtYXJnaW4uZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLl9vdmVyZmxvd0d1YXJkQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3Njcm9sbGJhci5nZXREb21Ob2RlKCkpO1xuXHRcdGlmICh0aGlzLl92aWV3R3B1Q29udGV4dCkge1xuXHRcdFx0dGhpcy5fb3ZlcmZsb3dHdWFyZENvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl92aWV3R3B1Q29udGV4dC5jYW52YXMpO1xuXHRcdH1cblx0XHR0aGlzLl9vdmVyZmxvd0d1YXJkQ29udGFpbmVyLmFwcGVuZENoaWxkKHNjcm9sbERlY29yYXRpb24uZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLl9vdmVyZmxvd0d1YXJkQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX292ZXJsYXlXaWRnZXRzLmdldERvbU5vZGUoKSk7XG5cdFx0dGhpcy5fb3ZlcmZsb3dHdWFyZENvbnRhaW5lci5hcHBlbmRDaGlsZChtaW5pbWFwLmdldERvbU5vZGUoKSk7XG5cdFx0dGhpcy5fb3ZlcmZsb3dHdWFyZENvbnRhaW5lci5hcHBlbmRDaGlsZChibG9ja091dGxpbmUuZG9tTm9kZSk7XG5cdFx0dGhpcy5kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX292ZXJmbG93R3VhcmRDb250YWluZXIpO1xuXG5cdFx0aWYgKG92ZXJmbG93V2lkZ2V0c0RvbU5vZGUpIHtcblx0XHRcdG92ZXJmbG93V2lkZ2V0c0RvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5fY29udGVudFdpZGdldHMub3ZlcmZsb3dpbmdDb250ZW50V2lkZ2V0c0RvbU5vZGUuZG9tTm9kZSk7XG5cdFx0XHRvdmVyZmxvd1dpZGdldHNEb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX292ZXJsYXlXaWRnZXRzLm92ZXJmbG93aW5nT3ZlcmxheVdpZGdldHNEb21Ob2RlLmRvbU5vZGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5fY29udGVudFdpZGdldHMub3ZlcmZsb3dpbmdDb250ZW50V2lkZ2V0c0RvbU5vZGUpO1xuXHRcdFx0dGhpcy5kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX292ZXJsYXlXaWRnZXRzLm92ZXJmbG93aW5nT3ZlcmxheVdpZGdldHNEb21Ob2RlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9hcHBseUxheW91dCgpO1xuXG5cdFx0Ly8gUG9pbnRlciBoYW5kbGVyXG5cdFx0dGhpcy5fcG9pbnRlckhhbmRsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUG9pbnRlckhhbmRsZXIodGhpcy5fY29udGV4dCwgdGhpcy5fdmlld0NvbnRyb2xsZXIsIHRoaXMuX2NyZWF0ZVBvaW50ZXJIYW5kbGVySGVscGVyKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgX2luc3RhbnRpYXRlRWRpdENvbnRleHQoKTogQWJzdHJhY3RFZGl0Q29udGV4dCB7XG5cdFx0Y29uc3QgdXNpbmdFeHBlcmltZW50YWxFZGl0Q29udGV4dCA9IHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24uZWZmZWN0aXZlRXhwZXJpbWVudGFsRWRpdENvbnRleHRFbmFibGVkKTtcblx0XHRpZiAodXNpbmdFeHBlcmltZW50YWxFZGl0Q29udGV4dCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5hdGl2ZUVkaXRDb250ZXh0LCB0aGlzLl9vd25lcklELCB0aGlzLl9jb250ZXh0LCB0aGlzLl9vdmVyZmxvd0d1YXJkQ29udGFpbmVyLCB0aGlzLl92aWV3Q29udHJvbGxlciwgdGhpcy5fY3JlYXRlVGV4dEFyZWFIYW5kbGVySGVscGVyKCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEFyZWFFZGl0Q29udGV4dCwgdGhpcy5fY29udGV4dCwgdGhpcy5fb3ZlcmZsb3dHdWFyZENvbnRhaW5lciwgdGhpcy5fdmlld0NvbnRyb2xsZXIsIHRoaXMuX2NyZWF0ZVRleHRBcmVhSGFuZGxlckhlbHBlcigpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVFZGl0Q29udGV4dCgpOiB2b2lkIHtcblx0XHRjb25zdCBleHBlcmltZW50YWxFZGl0Q29udGV4dEVuYWJsZWQgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmVmZmVjdGl2ZUV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCk7XG5cdFx0Y29uc3QgYWNjZXNzaWJpbGl0eVN1cHBvcnQgPSB0aGlzLl9jb250ZXh0LmNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmFjY2Vzc2liaWxpdHlTdXBwb3J0KTtcblx0XHRpZiAodGhpcy5fZXhwZXJpbWVudGFsRWRpdENvbnRleHRFbmFibGVkID09PSBleHBlcmltZW50YWxFZGl0Q29udGV4dEVuYWJsZWQgJiYgdGhpcy5fYWNjZXNzaWJpbGl0eVN1cHBvcnQgPT09IGFjY2Vzc2liaWxpdHlTdXBwb3J0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2V4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZCA9IGV4cGVyaW1lbnRhbEVkaXRDb250ZXh0RW5hYmxlZDtcblx0XHR0aGlzLl9hY2Nlc3NpYmlsaXR5U3VwcG9ydCA9IGFjY2Vzc2liaWxpdHlTdXBwb3J0O1xuXHRcdGNvbnN0IGlzRWRpdENvbnRleHRGb2N1c2VkID0gdGhpcy5fZWRpdENvbnRleHQuaXNGb2N1c2VkKCk7XG5cdFx0Y29uc3QgaW5kZXhPZkVkaXRDb250ZXh0ID0gdGhpcy5fdmlld1BhcnRzLmluZGV4T2YodGhpcy5fZWRpdENvbnRleHQpO1xuXHRcdHRoaXMuX2VkaXRDb250ZXh0LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9lZGl0Q29udGV4dCA9IHRoaXMuX2luc3RhbnRpYXRlRWRpdENvbnRleHQoKTtcblx0XHRpZiAoaXNFZGl0Q29udGV4dEZvY3VzZWQpIHtcblx0XHRcdHRoaXMuX2VkaXRDb250ZXh0LmZvY3VzKCk7XG5cdFx0fVxuXHRcdGlmIChpbmRleE9mRWRpdENvbnRleHQgIT09IC0xKSB7XG5cdFx0XHR0aGlzLl92aWV3UGFydHMuc3BsaWNlKGluZGV4T2ZFZGl0Q29udGV4dCwgMSwgdGhpcy5fZWRpdENvbnRleHQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NvbXB1dGVHbHlwaE1hcmdpbkxhbmVzKCk6IElHbHlwaE1hcmdpbkxhbmVzTW9kZWwge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwubW9kZWw7XG5cdFx0Y29uc3QgbGFuZU1vZGVsID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuZ2x5cGhMYW5lcztcblx0XHR0eXBlIEdseXBoID0geyByYW5nZTogUmFuZ2U7IGxhbmU6IEdseXBoTWFyZ2luTGFuZTsgcGVyc2lzdD86IGJvb2xlYW4gfTtcblx0XHRsZXQgZ2x5cGhzOiBHbHlwaFtdID0gW107XG5cdFx0bGV0IG1heExpbmVOdW1iZXIgPSAwO1xuXG5cdFx0Ly8gQWRkIGFsbCBtYXJnaW4gZGVjb3JhdGlvbnNcblx0XHRnbHlwaHMgPSBnbHlwaHMuY29uY2F0KG1vZGVsLmdldEFsbE1hcmdpbkRlY29yYXRpb25zKCkubWFwKChkZWNvcmF0aW9uKSA9PiB7XG5cdFx0XHRjb25zdCBsYW5lID0gZGVjb3JhdGlvbi5vcHRpb25zLmdseXBoTWFyZ2luPy5wb3NpdGlvbiA/PyBHbHlwaE1hcmdpbkxhbmUuQ2VudGVyO1xuXHRcdFx0bWF4TGluZU51bWJlciA9IE1hdGgubWF4KG1heExpbmVOdW1iZXIsIGRlY29yYXRpb24ucmFuZ2UuZW5kTGluZU51bWJlcik7XG5cdFx0XHRyZXR1cm4geyByYW5nZTogZGVjb3JhdGlvbi5yYW5nZSwgbGFuZSwgcGVyc2lzdDogZGVjb3JhdGlvbi5vcHRpb25zLmdseXBoTWFyZ2luPy5wZXJzaXN0TGFuZSB9O1xuXHRcdH0pKTtcblxuXHRcdC8vIEFkZCBhbGwgZ2x5cGggbWFyZ2luIHdpZGdldHNcblx0XHRnbHlwaHMgPSBnbHlwaHMuY29uY2F0KHRoaXMuX2dseXBoTWFyZ2luV2lkZ2V0cy5nZXRXaWRnZXRzKCkubWFwKCh3aWRnZXQpID0+IHtcblx0XHRcdGNvbnN0IHJhbmdlID0gbW9kZWwudmFsaWRhdGVSYW5nZSh3aWRnZXQucHJlZmVyZW5jZS5yYW5nZSk7XG5cdFx0XHRtYXhMaW5lTnVtYmVyID0gTWF0aC5tYXgobWF4TGluZU51bWJlciwgcmFuZ2UuZW5kTGluZU51bWJlcik7XG5cdFx0XHRyZXR1cm4geyByYW5nZSwgbGFuZTogd2lkZ2V0LnByZWZlcmVuY2UubGFuZSB9O1xuXHRcdH0pKTtcblxuXHRcdC8vIFNvcnRlZCBieSB0aGVpciBzdGFydCBwb3NpdGlvblxuXHRcdGdseXBocy5zb3J0KChhLCBiKSA9PiBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYS5yYW5nZSwgYi5yYW5nZSkpO1xuXG5cdFx0bGFuZU1vZGVsLnJlc2V0KG1heExpbmVOdW1iZXIpO1xuXHRcdGZvciAoY29uc3QgZ2x5cGggb2YgZ2x5cGhzKSB7XG5cdFx0XHRsYW5lTW9kZWwucHVzaChnbHlwaC5sYW5lLCBnbHlwaC5yYW5nZSwgZ2x5cGgucGVyc2lzdCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxhbmVNb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVBvaW50ZXJIYW5kbGVySGVscGVyKCk6IElQb2ludGVySGFuZGxlckhlbHBlciB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHZpZXdEb21Ob2RlOiB0aGlzLmRvbU5vZGUuZG9tTm9kZSxcblx0XHRcdGxpbmVzQ29udGVudERvbU5vZGU6IHRoaXMuX2xpbmVzQ29udGVudC5kb21Ob2RlLFxuXHRcdFx0dmlld0xpbmVzRG9tTm9kZTogdGhpcy5fdmlld0xpbmVzLmdldERvbU5vZGUoKS5kb21Ob2RlLFxuXHRcdFx0dmlld0xpbmVzR3B1OiB0aGlzLl92aWV3TGluZXNHcHUsXG5cblx0XHRcdGZvY3VzVGV4dEFyZWE6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdFx0fSxcblxuXHRcdFx0ZGlzcGF0Y2hUZXh0QXJlYUV2ZW50OiAoZXZlbnQ6IEN1c3RvbUV2ZW50KSA9PiB7XG5cdFx0XHRcdHRoaXMuX2VkaXRDb250ZXh0LmRvbU5vZGUuZG9tTm9kZS5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcblx0XHRcdH0sXG5cblx0XHRcdGdldExhc3RSZW5kZXJEYXRhOiAoKTogUG9pbnRlckhhbmRsZXJMYXN0UmVuZGVyRGF0YSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxhc3RWaWV3Q3Vyc29yc1JlbmRlckRhdGEgPSB0aGlzLl92aWV3Q3Vyc29ycy5nZXRMYXN0UmVuZGVyRGF0YSgpIHx8IFtdO1xuXHRcdFx0XHRjb25zdCBsYXN0VGV4dGFyZWFQb3NpdGlvbiA9IHRoaXMuX2VkaXRDb250ZXh0LmdldExhc3RSZW5kZXJEYXRhKCk7XG5cdFx0XHRcdHJldHVybiBuZXcgUG9pbnRlckhhbmRsZXJMYXN0UmVuZGVyRGF0YShsYXN0Vmlld0N1cnNvcnNSZW5kZXJEYXRhLCBsYXN0VGV4dGFyZWFQb3NpdGlvbik7XG5cdFx0XHR9LFxuXHRcdFx0cmVuZGVyTm93OiAoKTogdm9pZCA9PiB7XG5cdFx0XHRcdHRoaXMucmVuZGVyKHRydWUsIGZhbHNlKTtcblx0XHRcdH0sXG5cdFx0XHRzaG91bGRTdXBwcmVzc01vdXNlRG93bk9uVmlld1pvbmU6ICh2aWV3Wm9uZUlkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3ZpZXdab25lcy5zaG91bGRTdXBwcmVzc01vdXNlRG93bk9uVmlld1pvbmUodmlld1pvbmVJZCk7XG5cdFx0XHR9LFxuXHRcdFx0c2hvdWxkU3VwcHJlc3NNb3VzZURvd25PbldpZGdldDogKHdpZGdldElkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnRXaWRnZXRzLnNob3VsZFN1cHByZXNzTW91c2VEb3duT25XaWRnZXQod2lkZ2V0SWQpO1xuXHRcdFx0fSxcblx0XHRcdGdldFBvc2l0aW9uRnJvbURPTUluZm86IChzcGFuTm9kZTogSFRNTEVsZW1lbnQsIG9mZnNldDogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2ZsdXNoQWNjdW11bGF0ZWRBbmRSZW5kZXJOb3coKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3ZpZXdMaW5lcy5nZXRQb3NpdGlvbkZyb21ET01JbmZvKHNwYW5Ob2RlLCBvZmZzZXQpO1xuXHRcdFx0fSxcblxuXHRcdFx0dmlzaWJsZVJhbmdlRm9yUG9zaXRpb246IChsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2ZsdXNoQWNjdW11bGF0ZWRBbmRSZW5kZXJOb3coKTtcblx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSBuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3ZpZXdMaW5lcy52aXNpYmxlUmFuZ2VGb3JQb3NpdGlvbihwb3NpdGlvbikgPz8gdGhpcy5fdmlld0xpbmVzR3B1Py52aXNpYmxlUmFuZ2VGb3JQb3NpdGlvbihwb3NpdGlvbikgPz8gbnVsbDtcblx0XHRcdH0sXG5cblx0XHRcdGdldExpbmVXaWR0aDogKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0XHR0aGlzLl9mbHVzaEFjY3VtdWxhdGVkQW5kUmVuZGVyTm93KCk7XG5cdFx0XHRcdGlmICh0aGlzLl92aWV3TGluZXNHcHUpIHtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl92aWV3TGluZXNHcHUuZ2V0TGluZVdpZHRoKGxpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuX3ZpZXdMaW5lcy5nZXRMaW5lV2lkdGgobGluZU51bWJlcik7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVRleHRBcmVhSGFuZGxlckhlbHBlcigpOiBJVmlzaWJsZVJhbmdlUHJvdmlkZXIge1xuXHRcdHJldHVybiB7XG5cdFx0XHR2aXNpYmxlUmFuZ2VGb3JQb3NpdGlvbjogKHBvc2l0aW9uOiBQb3NpdGlvbikgPT4ge1xuXHRcdFx0XHR0aGlzLl9mbHVzaEFjY3VtdWxhdGVkQW5kUmVuZGVyTm93KCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLl92aWV3TGluZXMudmlzaWJsZVJhbmdlRm9yUG9zaXRpb24ocG9zaXRpb24pO1xuXHRcdFx0fSxcblx0XHRcdGxpbmVzVmlzaWJsZVJhbmdlc0ZvclJhbmdlOiAocmFuZ2U6IFJhbmdlLCBpbmNsdWRlTmV3TGluZXM6IGJvb2xlYW4pOiBMaW5lVmlzaWJsZVJhbmdlc1tdIHwgbnVsbCA9PiB7XG5cdFx0XHRcdHRoaXMuX2ZsdXNoQWNjdW11bGF0ZWRBbmRSZW5kZXJOb3coKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3ZpZXdMaW5lcy5saW5lc1Zpc2libGVSYW5nZXNGb3JSYW5nZShyYW5nZSwgaW5jbHVkZU5ld0xpbmVzKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfYXBwbHlMYXlvdXQoKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuX2NvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zO1xuXHRcdGNvbnN0IGxheW91dEluZm8gPSBvcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGF5b3V0SW5mbyk7XG5cblx0XHR0aGlzLmRvbU5vZGUuc2V0V2lkdGgobGF5b3V0SW5mby53aWR0aCk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldEhlaWdodChsYXlvdXRJbmZvLmhlaWdodCk7XG5cblx0XHR0aGlzLl9vdmVyZmxvd0d1YXJkQ29udGFpbmVyLnNldFdpZHRoKGxheW91dEluZm8ud2lkdGgpO1xuXHRcdHRoaXMuX292ZXJmbG93R3VhcmRDb250YWluZXIuc2V0SGVpZ2h0KGxheW91dEluZm8uaGVpZ2h0KTtcblxuXHRcdC8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM4OTA1OTE2L2NvbnRlbnQtaW4tZ29vZ2xlLWNocm9tZS1sYXJnZXItdGhhbi0xNjc3NzIxNi1weC1ub3QtYmVpbmctcmVuZGVyZWRcblx0XHR0aGlzLl9saW5lc0NvbnRlbnQuc2V0V2lkdGgoMTY3NzcyMTYpO1xuXHRcdHRoaXMuX2xpbmVzQ29udGVudC5zZXRIZWlnaHQoMTY3NzcyMTYpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RWRpdG9yQ2xhc3NOYW1lKCkge1xuXHRcdGNvbnN0IGZvY3VzZWQgPSB0aGlzLl9lZGl0Q29udGV4dC5pc0ZvY3VzZWQoKSA/ICcgZm9jdXNlZCcgOiAnJztcblx0XHRyZXR1cm4gdGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5lZGl0b3JDbGFzc05hbWUpICsgJyAnICsgZ2V0VGhlbWVUeXBlU2VsZWN0b3IodGhpcy5fY29udGV4dC50aGVtZS50eXBlKSArIGZvY3VzZWQ7XG5cdH1cblxuXHQvLyAtLS0gYmVnaW4gZXZlbnQgaGFuZGxlcnNcblx0cHVibGljIG92ZXJyaWRlIGhhbmRsZUV2ZW50cyhldmVudHM6IHZpZXdFdmVudHMuVmlld0V2ZW50W10pOiB2b2lkIHtcblx0XHRzdXBlci5oYW5kbGVFdmVudHMoZXZlbnRzKTtcblx0XHR0aGlzLl9zY2hlZHVsZVJlbmRlcigpO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0NvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLmRvbU5vZGUuc2V0Q2xhc3NOYW1lKHRoaXMuX2dldEVkaXRvckNsYXNzTmFtZSgpKTtcblx0XHR0aGlzLl91cGRhdGVFZGl0Q29udGV4dCgpO1xuXHRcdHRoaXMuX2FwcGx5TGF5b3V0KCk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkN1cnNvclN0YXRlQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdDdXJzb3JTdGF0ZUNoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX3NlbGVjdGlvbnMgPSBlLnNlbGVjdGlvbnM7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBvbkRlY29yYXRpb25zQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGlmIChlLmFmZmVjdHNHbHlwaE1hcmdpbikge1xuXHRcdFx0dGhpcy5fc2hvdWxkUmVjb21wdXRlR2x5cGhNYXJnaW5MYW5lcyA9IHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb3ZlcnJpZGUgb25Gb2N1c0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Rm9jdXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHR0aGlzLmRvbU5vZGUuc2V0Q2xhc3NOYW1lKHRoaXMuX2dldEVkaXRvckNsYXNzTmFtZSgpKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cHVibGljIG92ZXJyaWRlIG9uVGhlbWVDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1RoZW1lQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fY29udGV4dC50aGVtZS51cGRhdGUoZS50aGVtZSk7XG5cdFx0dGhpcy5kb21Ob2RlLnNldENsYXNzTmFtZSh0aGlzLl9nZXRFZGl0b3JDbGFzc05hbWUoKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8gLS0tIGVuZCBldmVudCBoYW5kbGVyc1xuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9yZW5kZXJBbmltYXRpb25GcmFtZSAhPT0gbnVsbCkge1xuXHRcdFx0dGhpcy5fcmVuZGVyQW5pbWF0aW9uRnJhbWUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fcmVuZGVyQW5pbWF0aW9uRnJhbWUgPSBudWxsO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NvbnRlbnRXaWRnZXRzLm92ZXJmbG93aW5nQ29udGVudFdpZGdldHNEb21Ob2RlLmRvbU5vZGUucmVtb3ZlKCk7XG5cdFx0dGhpcy5fb3ZlcmxheVdpZGdldHMub3ZlcmZsb3dpbmdPdmVybGF5V2lkZ2V0c0RvbU5vZGUuZG9tTm9kZS5yZW1vdmUoKTtcblxuXHRcdHRoaXMuX2NvbnRleHQucmVtb3ZlRXZlbnRIYW5kbGVyKHRoaXMpO1xuXHRcdHRoaXMuX3ZpZXdHcHVDb250ZXh0Py5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLl92aWV3TGluZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3ZpZXdMaW5lc0dwdT8uZGlzcG9zZSgpO1xuXG5cdFx0Ly8gRGVzdHJveSB2aWV3IHBhcnRzXG5cdFx0Zm9yIChjb25zdCB2aWV3UGFydCBvZiB0aGlzLl92aWV3UGFydHMpIHtcblx0XHRcdHZpZXdQYXJ0LmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9zY2hlZHVsZVJlbmRlcigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fcmVuZGVyQW5pbWF0aW9uRnJhbWUgPT09IG51bGwpIHtcblx0XHRcdC8vIFRPRE86IHdvcmthcm91bmQgZml4IGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjI5ODI1XG5cdFx0XHRpZiAodGhpcy5fZWRpdENvbnRleHQgaW5zdGFuY2VvZiBOYXRpdmVFZGl0Q29udGV4dCkge1xuXHRcdFx0XHR0aGlzLl9lZGl0Q29udGV4dC5zZXRFZGl0Q29udGV4dE9uRG9tTm9kZSgpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmVuZGVyaW5nID0gdGhpcy5fY3JlYXRlQ29vcmRpbmF0ZWRSZW5kZXJpbmcoKTtcblx0XHRcdHRoaXMuX3JlbmRlckFuaW1hdGlvbkZyYW1lID0gRWRpdG9yUmVuZGVyaW5nQ29vcmRpbmF0b3IuSU5TVEFOQ0Uuc2NoZWR1bGVDb29yZGluYXRlZFJlbmRlcmluZyh7XG5cdFx0XHRcdHdpbmRvdzogZG9tLmdldFdpbmRvdyh0aGlzLmRvbU5vZGU/LmRvbU5vZGUpLFxuXHRcdFx0XHRwcmVwYXJlUmVuZGVyVGV4dDogKCkgPT4ge1xuXHRcdFx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVuZGVyaW5nLnByZXBhcmVSZW5kZXJUZXh0KCk7XG5cdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdHRoaXMuX3JlbmRlckFuaW1hdGlvbkZyYW1lID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlbmRlclRleHQ6ICgpID0+IHtcblx0XHRcdFx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEJ1Z0luZGljYXRpbmdFcnJvcigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcmVuZGVyaW5nLnJlbmRlclRleHQoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cHJlcGFyZVJlbmRlcjogKHZpZXdQYXJ0czogVmlld1BhcnRbXSwgY3R4OiBSZW5kZXJpbmdDb250ZXh0KSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHJlbmRlcmluZy5wcmVwYXJlUmVuZGVyKHZpZXdQYXJ0cywgY3R4KTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVuZGVyOiAodmlld1BhcnRzOiBWaWV3UGFydFtdLCBjdHg6IFJlc3RyaWN0ZWRSZW5kZXJpbmdDb250ZXh0KSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHJlbmRlcmluZy5yZW5kZXIodmlld1BhcnRzLCBjdHgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9mbHVzaEFjY3VtdWxhdGVkQW5kUmVuZGVyTm93KCk6IHZvaWQge1xuXHRcdGNvbnN0IHJlbmRlcmluZyA9IHRoaXMuX2NyZWF0ZUNvb3JkaW5hdGVkUmVuZGVyaW5nKCk7XG5cdFx0c2FmZUludm9rZU5vQXJnKCgpID0+IHJlbmRlcmluZy5wcmVwYXJlUmVuZGVyVGV4dCgpKTtcblx0XHRjb25zdCBkYXRhID0gc2FmZUludm9rZU5vQXJnKCgpID0+IHJlbmRlcmluZy5yZW5kZXJUZXh0KCkpO1xuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHRjb25zdCBbdmlld1BhcnRzLCBjdHhdID0gZGF0YTtcblx0XHRcdHNhZmVJbnZva2VOb0FyZygoKSA9PiByZW5kZXJpbmcucHJlcGFyZVJlbmRlcih2aWV3UGFydHMsIGN0eCkpO1xuXHRcdFx0c2FmZUludm9rZU5vQXJnKCgpID0+IHJlbmRlcmluZy5yZW5kZXIodmlld1BhcnRzLCBjdHgpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRWaWV3UGFydHNUb1JlbmRlcigpOiBWaWV3UGFydFtdIHtcblx0XHRjb25zdCByZXN1bHQ6IFZpZXdQYXJ0W10gPSBbXTtcblx0XHRsZXQgcmVzdWx0TGVuID0gMDtcblx0XHRmb3IgKGNvbnN0IHZpZXdQYXJ0IG9mIHRoaXMuX3ZpZXdQYXJ0cykge1xuXHRcdFx0aWYgKHZpZXdQYXJ0LnNob3VsZFJlbmRlcigpKSB7XG5cdFx0XHRcdHJlc3VsdFtyZXN1bHRMZW4rK10gPSB2aWV3UGFydDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUNvb3JkaW5hdGVkUmVuZGVyaW5nKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRwcmVwYXJlUmVuZGVyVGV4dDogKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fc2hvdWxkUmVjb21wdXRlR2x5cGhNYXJnaW5MYW5lcykge1xuXHRcdFx0XHRcdHRoaXMuX3Nob3VsZFJlY29tcHV0ZUdseXBoTWFyZ2luTGFuZXMgPSBmYWxzZTtcblx0XHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2NvbXB1dGVHbHlwaE1hcmdpbkxhbmVzKCk7XG5cdFx0XHRcdFx0dGhpcy5fY29udGV4dC5jb25maWd1cmF0aW9uLnNldEdseXBoTWFyZ2luRGVjb3JhdGlvbkxhbmVDb3VudChtb2RlbC5yZXF1aXJlZExhbmVzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnB1dExhdGVuY3kub25SZW5kZXJTdGFydCgpO1xuXHRcdFx0fSxcblx0XHRcdHJlbmRlclRleHQ6ICgpOiBbVmlld1BhcnRbXSwgUmVuZGVyaW5nQ29udGV4dF0gfCBudWxsID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLmRvbU5vZGUuZG9tTm9kZS5pc0Nvbm5lY3RlZCkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCB2aWV3UGFydHNUb1JlbmRlciA9IHRoaXMuX2dldFZpZXdQYXJ0c1RvUmVuZGVyKCk7XG5cdFx0XHRcdGlmICghdGhpcy5fdmlld0xpbmVzLnNob3VsZFJlbmRlcigpICYmIHZpZXdQYXJ0c1RvUmVuZGVyLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdC8vIE5vdGhpbmcgdG8gcmVuZGVyXG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcGFydGlhbFZpZXdwb3J0RGF0YSA9IHRoaXMuX2NvbnRleHQudmlld0xheW91dC5nZXRMaW5lc1ZpZXdwb3J0RGF0YSgpO1xuXHRcdFx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC5zZXRWaWV3cG9ydChwYXJ0aWFsVmlld3BvcnREYXRhLnN0YXJ0TGluZU51bWJlciwgcGFydGlhbFZpZXdwb3J0RGF0YS5lbmRMaW5lTnVtYmVyLCBwYXJ0aWFsVmlld3BvcnREYXRhLmNlbnRlcmVkTGluZU51bWJlcik7XG5cblx0XHRcdFx0Y29uc3Qgdmlld3BvcnREYXRhID0gbmV3IFZpZXdwb3J0RGF0YShcblx0XHRcdFx0XHR0aGlzLl9zZWxlY3Rpb25zLFxuXHRcdFx0XHRcdHBhcnRpYWxWaWV3cG9ydERhdGEsXG5cdFx0XHRcdFx0dGhpcy5fY29udGV4dC52aWV3TGF5b3V0LmdldFdoaXRlc3BhY2VWaWV3cG9ydERhdGEoKSxcblx0XHRcdFx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbFxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9jb250ZW50V2lkZ2V0cy5zaG91bGRSZW5kZXIoKSkge1xuXHRcdFx0XHRcdC8vIEdpdmUgdGhlIGNvbnRlbnQgd2lkZ2V0cyBhIGNoYW5jZSB0byBzZXQgdGhlaXIgbWF4IHdpZHRoIGJlZm9yZSBhIHBvc3NpYmxlIHN5bmNocm9ub3VzIGxheW91dFxuXHRcdFx0XHRcdHRoaXMuX2NvbnRlbnRXaWRnZXRzLm9uQmVmb3JlUmVuZGVyKHZpZXdwb3J0RGF0YSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGhpcy5fdmlld0xpbmVzLnNob3VsZFJlbmRlcigpKSB7XG5cdFx0XHRcdFx0dGhpcy5fdmlld0xpbmVzLnJlbmRlclRleHQodmlld3BvcnREYXRhKTtcblx0XHRcdFx0XHR0aGlzLl92aWV3TGluZXMub25EaWRSZW5kZXIoKTtcblxuXHRcdFx0XHRcdC8vIFJlbmRlcmluZyBvZiB2aWV3TGluZXMgbWlnaHQgY2F1c2Ugc2Nyb2xsIGV2ZW50cyB0byBvY2N1ciwgc28gY29sbGVjdCB2aWV3IHBhcnRzIHRvIHJlbmRlciBhZ2FpblxuXHRcdFx0XHRcdHZpZXdQYXJ0c1RvUmVuZGVyID0gdGhpcy5fZ2V0Vmlld1BhcnRzVG9SZW5kZXIoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl92aWV3TGluZXNHcHU/LnNob3VsZFJlbmRlcigpKSB7XG5cdFx0XHRcdFx0dGhpcy5fdmlld0xpbmVzR3B1LnJlbmRlclRleHQodmlld3BvcnREYXRhKTtcblx0XHRcdFx0XHR0aGlzLl92aWV3TGluZXNHcHUub25EaWRSZW5kZXIoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBbdmlld1BhcnRzVG9SZW5kZXIsIG5ldyBSZW5kZXJpbmdDb250ZXh0KHRoaXMuX2NvbnRleHQudmlld0xheW91dCwgdmlld3BvcnREYXRhLCB0aGlzLl92aWV3TGluZXMsIHRoaXMuX3ZpZXdMaW5lc0dwdSldO1xuXHRcdFx0fSxcblx0XHRcdHByZXBhcmVSZW5kZXI6ICh2aWV3UGFydHNUb1JlbmRlcjogVmlld1BhcnRbXSwgY3R4OiBSZW5kZXJpbmdDb250ZXh0KSA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3Qgdmlld1BhcnQgb2Ygdmlld1BhcnRzVG9SZW5kZXIpIHtcblx0XHRcdFx0XHR2aWV3UGFydC5wcmVwYXJlUmVuZGVyKGN0eCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRyZW5kZXI6ICh2aWV3UGFydHNUb1JlbmRlcjogVmlld1BhcnRbXSwgY3R4OiBSZXN0cmljdGVkUmVuZGVyaW5nQ29udGV4dCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHZpZXdQYXJ0IG9mIHZpZXdQYXJ0c1RvUmVuZGVyKSB7XG5cdFx0XHRcdFx0dmlld1BhcnQucmVuZGVyKGN0eCk7XG5cdFx0XHRcdFx0dmlld1BhcnQub25EaWRSZW5kZXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHQvLyAtLS0gQkVHSU4gQ29kZUVkaXRvciBoZWxwZXJzXG5cblx0cHVibGljIGRlbGVnYXRlVmVydGljYWxTY3JvbGxiYXJQb2ludGVyRG93bihicm93c2VyRXZlbnQ6IFBvaW50ZXJFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuX3Njcm9sbGJhci5kZWxlZ2F0ZVZlcnRpY2FsU2Nyb2xsYmFyUG9pbnRlckRvd24oYnJvd3NlckV2ZW50KTtcblx0fVxuXG5cdHB1YmxpYyBkZWxlZ2F0ZVNjcm9sbEZyb21Nb3VzZVdoZWVsRXZlbnQoYnJvd3NlckV2ZW50OiBJTW91c2VXaGVlbEV2ZW50KSB7XG5cdFx0dGhpcy5fc2Nyb2xsYmFyLmRlbGVnYXRlU2Nyb2xsRnJvbU1vdXNlV2hlZWxFdmVudChicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0cHVibGljIHJlc3RvcmVTdGF0ZShzY3JvbGxQb3NpdGlvbjogeyBzY3JvbGxMZWZ0OiBudW1iZXI7IHNjcm9sbFRvcDogbnVtYmVyIH0pOiB2b2lkIHtcblx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC52aWV3TGF5b3V0LnNldFNjcm9sbFBvc2l0aW9uKHtcblx0XHRcdHNjcm9sbFRvcDogc2Nyb2xsUG9zaXRpb24uc2Nyb2xsVG9wLFxuXHRcdFx0c2Nyb2xsTGVmdDogc2Nyb2xsUG9zaXRpb24uc2Nyb2xsTGVmdFxuXHRcdH0sIFNjcm9sbFR5cGUuSW1tZWRpYXRlKTtcblx0XHR0aGlzLl9jb250ZXh0LnZpZXdNb2RlbC52aXNpYmxlTGluZXNTdGFiaWxpemVkKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0T2Zmc2V0Rm9yQ29sdW1uKG1vZGVsTGluZU51bWJlcjogbnVtYmVyLCBtb2RlbENvbHVtbjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRjb25zdCBtb2RlbFBvc2l0aW9uID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwubW9kZWwudmFsaWRhdGVQb3NpdGlvbih7XG5cdFx0XHRsaW5lTnVtYmVyOiBtb2RlbExpbmVOdW1iZXIsXG5cdFx0XHRjb2x1bW46IG1vZGVsQ29sdW1uXG5cdFx0fSk7XG5cdFx0Y29uc3Qgdmlld1Bvc2l0aW9uID0gdGhpcy5fY29udGV4dC52aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIuY29udmVydE1vZGVsUG9zaXRpb25Ub1ZpZXdQb3NpdGlvbihtb2RlbFBvc2l0aW9uKTtcblx0XHR0aGlzLl9mbHVzaEFjY3VtdWxhdGVkQW5kUmVuZGVyTm93KCk7XG5cdFx0Y29uc3QgdmlzaWJsZVJhbmdlID0gdGhpcy5fdmlld0xpbmVzLnZpc2libGVSYW5nZUZvclBvc2l0aW9uKG5ldyBQb3NpdGlvbih2aWV3UG9zaXRpb24ubGluZU51bWJlciwgdmlld1Bvc2l0aW9uLmNvbHVtbikpO1xuXHRcdGlmICghdmlzaWJsZVJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHRcdHJldHVybiB2aXNpYmxlUmFuZ2UubGVmdDtcblx0fVxuXG5cdHB1YmxpYyBnZXRUYXJnZXRBdENsaWVudFBvaW50KGNsaWVudFg6IG51bWJlciwgY2xpZW50WTogbnVtYmVyKTogSU1vdXNlVGFyZ2V0IHwgbnVsbCB7XG5cdFx0Y29uc3QgbW91c2VUYXJnZXQgPSB0aGlzLl9wb2ludGVySGFuZGxlci5nZXRUYXJnZXRBdENsaWVudFBvaW50KGNsaWVudFgsIGNsaWVudFkpO1xuXHRcdGlmICghbW91c2VUYXJnZXQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gVmlld1VzZXJJbnB1dEV2ZW50cy5jb252ZXJ0Vmlld1RvTW9kZWxNb3VzZVRhcmdldChtb3VzZVRhcmdldCwgdGhpcy5fY29udGV4dC52aWV3TW9kZWwuY29vcmRpbmF0ZXNDb252ZXJ0ZXIpO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZU92ZXJ2aWV3UnVsZXIoY3NzQ2xhc3NOYW1lOiBzdHJpbmcpOiBPdmVydmlld1J1bGVyIHtcblx0XHRyZXR1cm4gbmV3IE92ZXJ2aWV3UnVsZXIodGhpcy5fY29udGV4dCwgY3NzQ2xhc3NOYW1lKTtcblx0fVxuXG5cdHB1YmxpYyBjaGFuZ2UoY2FsbGJhY2s6IChjaGFuZ2VBY2Nlc3NvcjogSVZpZXdab25lQ2hhbmdlQWNjZXNzb3IpID0+IGFueSk6IHZvaWQge1xuXHRcdHRoaXMuX3ZpZXdab25lcy5jaGFuZ2VWaWV3Wm9uZXMoY2FsbGJhY2spO1xuXHRcdHRoaXMuX3NjaGVkdWxlUmVuZGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgcmVuZGVyKG5vdzogYm9vbGVhbiwgZXZlcnl0aGluZzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChldmVyeXRoaW5nKSB7XG5cdFx0XHQvLyBGb3JjZSBldmVyeXRoaW5nIHRvIHJlbmRlci4uLlxuXHRcdFx0dGhpcy5fdmlld0xpbmVzLmZvcmNlU2hvdWxkUmVuZGVyKCk7XG5cdFx0XHRmb3IgKGNvbnN0IHZpZXdQYXJ0IG9mIHRoaXMuX3ZpZXdQYXJ0cykge1xuXHRcdFx0XHR2aWV3UGFydC5mb3JjZVNob3VsZFJlbmRlcigpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAobm93KSB7XG5cdFx0XHR0aGlzLl9mbHVzaEFjY3VtdWxhdGVkQW5kUmVuZGVyTm93KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3NjaGVkdWxlUmVuZGVyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHdyaXRlU2NyZWVuUmVhZGVyQ29udGVudChyZWFzb246IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRDb250ZXh0LndyaXRlU2NyZWVuUmVhZGVyQ29udGVudChyZWFzb24pO1xuXHR9XG5cblx0cHVibGljIGZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRDb250ZXh0LmZvY3VzKCk7XG5cdH1cblxuXHRwdWJsaWMgaXNGb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0Q29udGV4dC5pc0ZvY3VzZWQoKTtcblx0fVxuXG5cdHB1YmxpYyBpc1dpZGdldEZvY3VzZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZGdldEZvY3VzVHJhY2tlci5oYXNGb2N1cygpO1xuXHR9XG5cblx0cHVibGljIHJlZnJlc2hGb2N1c1N0YXRlKCkge1xuXHRcdHRoaXMuX2VkaXRDb250ZXh0LnJlZnJlc2hGb2N1c1N0YXRlKCk7XG5cdFx0dGhpcy5fd2lkZ2V0Rm9jdXNUcmFja2VyLnJlZnJlc2hTdGF0ZSgpO1xuXHR9XG5cblx0cHVibGljIHNldEFyaWFPcHRpb25zKG9wdGlvbnM6IElFZGl0b3JBcmlhT3B0aW9ucyk6IHZvaWQge1xuXHRcdHRoaXMuX2VkaXRDb250ZXh0LnNldEFyaWFPcHRpb25zKG9wdGlvbnMpO1xuXHR9XG5cblx0cHVibGljIGFkZENvbnRlbnRXaWRnZXQod2lkZ2V0RGF0YTogSUNvbnRlbnRXaWRnZXREYXRhKTogdm9pZCB7XG5cdFx0dGhpcy5fY29udGVudFdpZGdldHMuYWRkV2lkZ2V0KHdpZGdldERhdGEud2lkZ2V0KTtcblx0XHR0aGlzLmxheW91dENvbnRlbnRXaWRnZXQod2lkZ2V0RGF0YSk7XG5cdFx0dGhpcy5fc2NoZWR1bGVSZW5kZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBsYXlvdXRDb250ZW50V2lkZ2V0KHdpZGdldERhdGE6IElDb250ZW50V2lkZ2V0RGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRlbnRXaWRnZXRzLnNldFdpZGdldFBvc2l0aW9uKFxuXHRcdFx0d2lkZ2V0RGF0YS53aWRnZXQsXG5cdFx0XHR3aWRnZXREYXRhLnBvc2l0aW9uPy5wb3NpdGlvbiA/PyBudWxsLFxuXHRcdFx0d2lkZ2V0RGF0YS5wb3NpdGlvbj8uc2Vjb25kYXJ5UG9zaXRpb24gPz8gbnVsbCxcblx0XHRcdHdpZGdldERhdGEucG9zaXRpb24/LnByZWZlcmVuY2UgPz8gbnVsbCxcblx0XHRcdHdpZGdldERhdGEucG9zaXRpb24/LnBvc2l0aW9uQWZmaW5pdHkgPz8gbnVsbFxuXHRcdCk7XG5cdFx0dGhpcy5fc2NoZWR1bGVSZW5kZXIoKTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVDb250ZW50V2lkZ2V0KHdpZGdldERhdGE6IElDb250ZW50V2lkZ2V0RGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRlbnRXaWRnZXRzLnJlbW92ZVdpZGdldCh3aWRnZXREYXRhLndpZGdldCk7XG5cdFx0dGhpcy5fc2NoZWR1bGVSZW5kZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBhZGRPdmVybGF5V2lkZ2V0KHdpZGdldERhdGE6IElPdmVybGF5V2lkZ2V0RGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX292ZXJsYXlXaWRnZXRzLmFkZFdpZGdldCh3aWRnZXREYXRhLndpZGdldCk7XG5cdFx0dGhpcy5sYXlvdXRPdmVybGF5V2lkZ2V0KHdpZGdldERhdGEpO1xuXHRcdHRoaXMuX3NjaGVkdWxlUmVuZGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0T3ZlcmxheVdpZGdldCh3aWRnZXREYXRhOiBJT3ZlcmxheVdpZGdldERhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBzaG91bGRSZW5kZXIgPSB0aGlzLl9vdmVybGF5V2lkZ2V0cy5zZXRXaWRnZXRQb3NpdGlvbih3aWRnZXREYXRhLndpZGdldCwgd2lkZ2V0RGF0YS5wb3NpdGlvbik7XG5cdFx0aWYgKHNob3VsZFJlbmRlcikge1xuXHRcdFx0dGhpcy5fc2NoZWR1bGVSZW5kZXIoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlT3ZlcmxheVdpZGdldCh3aWRnZXREYXRhOiBJT3ZlcmxheVdpZGdldERhdGEpOiB2b2lkIHtcblx0XHR0aGlzLl9vdmVybGF5V2lkZ2V0cy5yZW1vdmVXaWRnZXQod2lkZ2V0RGF0YS53aWRnZXQpO1xuXHRcdHRoaXMuX3NjaGVkdWxlUmVuZGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgYWRkR2x5cGhNYXJnaW5XaWRnZXQod2lkZ2V0RGF0YTogSUdseXBoTWFyZ2luV2lkZ2V0RGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX2dseXBoTWFyZ2luV2lkZ2V0cy5hZGRXaWRnZXQod2lkZ2V0RGF0YS53aWRnZXQpO1xuXHRcdHRoaXMuX3Nob3VsZFJlY29tcHV0ZUdseXBoTWFyZ2luTGFuZXMgPSB0cnVlO1xuXHRcdHRoaXMuX3NjaGVkdWxlUmVuZGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgbGF5b3V0R2x5cGhNYXJnaW5XaWRnZXQod2lkZ2V0RGF0YTogSUdseXBoTWFyZ2luV2lkZ2V0RGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IG5ld1ByZWZlcmVuY2UgPSB3aWRnZXREYXRhLnBvc2l0aW9uO1xuXHRcdGNvbnN0IHNob3VsZFJlbmRlciA9IHRoaXMuX2dseXBoTWFyZ2luV2lkZ2V0cy5zZXRXaWRnZXRQb3NpdGlvbih3aWRnZXREYXRhLndpZGdldCwgbmV3UHJlZmVyZW5jZSk7XG5cdFx0aWYgKHNob3VsZFJlbmRlcikge1xuXHRcdFx0dGhpcy5fc2hvdWxkUmVjb21wdXRlR2x5cGhNYXJnaW5MYW5lcyA9IHRydWU7XG5cdFx0XHR0aGlzLl9zY2hlZHVsZVJlbmRlcigpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZW1vdmVHbHlwaE1hcmdpbldpZGdldCh3aWRnZXREYXRhOiBJR2x5cGhNYXJnaW5XaWRnZXREYXRhKTogdm9pZCB7XG5cdFx0dGhpcy5fZ2x5cGhNYXJnaW5XaWRnZXRzLnJlbW92ZVdpZGdldCh3aWRnZXREYXRhLndpZGdldCk7XG5cdFx0dGhpcy5fc2hvdWxkUmVjb21wdXRlR2x5cGhNYXJnaW5MYW5lcyA9IHRydWU7XG5cdFx0dGhpcy5fc2NoZWR1bGVSZW5kZXIoKTtcblx0fVxuXG5cdC8vIC0tLSBFTkQgQ29kZUVkaXRvciBoZWxwZXJzXG5cbn1cblxuZnVuY3Rpb24gc2FmZUludm9rZU5vQXJnPFQ+KGZ1bmM6ICgpID0+IFQpOiBUIHwgbnVsbCB7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIGZ1bmMoKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG5cbmludGVyZmFjZSBJQ29vcmRpbmF0ZWRSZW5kZXJpbmcge1xuXHRyZWFkb25seSB3aW5kb3c6IENvZGVXaW5kb3c7XG5cdHByZXBhcmVSZW5kZXJUZXh0KCk6IHZvaWQ7XG5cdHJlbmRlclRleHQoKTogW1ZpZXdQYXJ0W10sIFJlbmRlcmluZ0NvbnRleHRdIHwgbnVsbDtcblx0cHJlcGFyZVJlbmRlcih2aWV3UGFydHM6IFZpZXdQYXJ0W10sIGN0eDogUmVuZGVyaW5nQ29udGV4dCk6IHZvaWQ7XG5cdHJlbmRlcih2aWV3UGFydHM6IFZpZXdQYXJ0W10sIGN0eDogUmVzdHJpY3RlZFJlbmRlcmluZ0NvbnRleHQpOiB2b2lkO1xufVxuXG5jbGFzcyBFZGl0b3JSZW5kZXJpbmdDb29yZGluYXRvciB7XG5cblx0cHVibGljIHN0YXRpYyBJTlNUQU5DRSA9IG5ldyBFZGl0b3JSZW5kZXJpbmdDb29yZGluYXRvcigpO1xuXG5cdHByaXZhdGUgX2Nvb3JkaW5hdGVkUmVuZGVyaW5nczogSUNvb3JkaW5hdGVkUmVuZGVyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSBfYW5pbWF0aW9uRnJhbWVSdW5uZXJzID0gbmV3IE1hcDxDb2RlV2luZG93LCBJRGlzcG9zYWJsZT4oKTtcblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKCkgeyB9XG5cblx0c2NoZWR1bGVDb29yZGluYXRlZFJlbmRlcmluZyhyZW5kZXJpbmc6IElDb29yZGluYXRlZFJlbmRlcmluZyk6IElEaXNwb3NhYmxlIHtcblx0XHR0aGlzLl9jb29yZGluYXRlZFJlbmRlcmluZ3MucHVzaChyZW5kZXJpbmcpO1xuXHRcdHRoaXMuX3NjaGVkdWxlUmVuZGVyKHJlbmRlcmluZy53aW5kb3cpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlbmRlcmluZ0luZGV4ID0gdGhpcy5fY29vcmRpbmF0ZWRSZW5kZXJpbmdzLmluZGV4T2YocmVuZGVyaW5nKTtcblx0XHRcdFx0aWYgKHJlbmRlcmluZ0luZGV4ID09PSAtMSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9jb29yZGluYXRlZFJlbmRlcmluZ3Muc3BsaWNlKHJlbmRlcmluZ0luZGV4LCAxKTtcblxuXHRcdFx0XHRpZiAodGhpcy5fY29vcmRpbmF0ZWRSZW5kZXJpbmdzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdC8vIFRoZXJlIGFyZSBubyBtb3JlIHJlbmRlcmluZ3MgdG8gY29vcmRpbmF0ZSA9PiBjYW5jZWwgYW5pbWF0aW9uIGZyYW1lc1xuXHRcdFx0XHRcdGZvciAoY29uc3QgW18sIGRpc3Bvc2FibGVdIG9mIHRoaXMuX2FuaW1hdGlvbkZyYW1lUnVubmVycykge1xuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuX2FuaW1hdGlvbkZyYW1lUnVubmVycy5jbGVhcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX3NjaGVkdWxlUmVuZGVyKHdpbmRvdzogQ29kZVdpbmRvdyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fYW5pbWF0aW9uRnJhbWVSdW5uZXJzLmhhcyh3aW5kb3cpKSB7XG5cdFx0XHRjb25zdCBydW5uZXIgPSAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2FuaW1hdGlvbkZyYW1lUnVubmVycy5kZWxldGUod2luZG93KTtcblx0XHRcdFx0dGhpcy5fb25SZW5kZXJTY2hlZHVsZWQoKTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLl9hbmltYXRpb25GcmFtZVJ1bm5lcnMuc2V0KHdpbmRvdywgZG9tLnJ1bkF0VGhpc09yU2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZSh3aW5kb3csIHJ1bm5lciwgMTAwKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25SZW5kZXJTY2hlZHVsZWQoKTogdm9pZCB7XG5cdFx0Y29uc3QgY29vcmRpbmF0ZWRSZW5kZXJpbmdzID0gdGhpcy5fY29vcmRpbmF0ZWRSZW5kZXJpbmdzLnNsaWNlKDApO1xuXHRcdHRoaXMuX2Nvb3JkaW5hdGVkUmVuZGVyaW5ncyA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCByZW5kZXJpbmcgb2YgY29vcmRpbmF0ZWRSZW5kZXJpbmdzKSB7XG5cdFx0XHRzYWZlSW52b2tlTm9BcmcoKCkgPT4gcmVuZGVyaW5nLnByZXBhcmVSZW5kZXJUZXh0KCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhdGFzOiAoW1ZpZXdQYXJ0W10sIFJlbmRlcmluZ0NvbnRleHRdIHwgbnVsbClbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjb29yZGluYXRlZFJlbmRlcmluZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHJlbmRlcmluZyA9IGNvb3JkaW5hdGVkUmVuZGVyaW5nc1tpXTtcblx0XHRcdGRhdGFzW2ldID0gc2FmZUludm9rZU5vQXJnKCgpID0+IHJlbmRlcmluZy5yZW5kZXJUZXh0KCkpO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBjb29yZGluYXRlZFJlbmRlcmluZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHJlbmRlcmluZyA9IGNvb3JkaW5hdGVkUmVuZGVyaW5nc1tpXTtcblx0XHRcdGNvbnN0IGRhdGEgPSBkYXRhc1tpXTtcblx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IFt2aWV3UGFydHMsIGN0eF0gPSBkYXRhO1xuXHRcdFx0c2FmZUludm9rZU5vQXJnKCgpID0+IHJlbmRlcmluZy5wcmVwYXJlUmVuZGVyKHZpZXdQYXJ0cywgY3R4KSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGNvb3JkaW5hdGVkUmVuZGVyaW5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgcmVuZGVyaW5nID0gY29vcmRpbmF0ZWRSZW5kZXJpbmdzW2ldO1xuXHRcdFx0Y29uc3QgZGF0YSA9IGRhdGFzW2ldO1xuXHRcdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgW3ZpZXdQYXJ0cywgY3R4XSA9IGRhdGE7XG5cdFx0XHRzYWZlSW52b2tlTm9BcmcoKCkgPT4gcmVuZGVyaW5nLnJlbmRlcih2aWV3UGFydHMsIGN0eCkpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBDb2RlRWRpdG9yV2lkZ2V0Rm9jdXNUcmFja2VyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBfaGFzRG9tRWxlbWVudEZvY3VzOiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kb21Gb2N1c1RyYWNrZXI6IGRvbS5JRm9jdXNUcmFja2VyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vdmVyZmxvd1dpZGdldHNEb21Ob2RlOiBkb20uSUZvY3VzVHJhY2tlciB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkNoYW5nZTogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25DaGFuZ2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25DaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZUhhc0ZvY3VzOiBib29sZWFuO1xuXG5cdHByaXZhdGUgX2hhZEZvY3VzOiBib29sZWFuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKGRvbUVsZW1lbnQ6IEhUTUxFbGVtZW50LCBvdmVyZmxvd1dpZGdldHNEb21Ob2RlOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9oYXNEb21FbGVtZW50Rm9jdXMgPSBmYWxzZTtcblx0XHR0aGlzLl9kb21Gb2N1c1RyYWNrZXIgPSB0aGlzLl9yZWdpc3Rlcihkb20udHJhY2tGb2N1cyhkb21FbGVtZW50KSk7XG5cblx0XHR0aGlzLl9vdmVyZmxvd1dpZGdldHNEb21Ob2RlSGFzRm9jdXMgPSBmYWxzZTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2RvbUZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdHRoaXMuX2hhc0RvbUVsZW1lbnRGb2N1cyA9IHRydWU7XG5cdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZG9tRm9jdXNUcmFja2VyLm9uRGlkQmx1cigoKSA9PiB7XG5cdFx0XHR0aGlzLl9oYXNEb21FbGVtZW50Rm9jdXMgPSBmYWxzZTtcblx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdH0pKTtcblxuXHRcdGlmIChvdmVyZmxvd1dpZGdldHNEb21Ob2RlKSB7XG5cdFx0XHR0aGlzLl9vdmVyZmxvd1dpZGdldHNEb21Ob2RlID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXMob3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZS5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZUhhc0ZvY3VzID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9vdmVyZmxvd1dpZGdldHNEb21Ob2RlLm9uRGlkQmx1cigoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX292ZXJmbG93V2lkZ2V0c0RvbU5vZGVIYXNGb2N1cyA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGUoKSB7XG5cdFx0Y29uc3QgZm9jdXNlZCA9IHRoaXMuX2hhc0RvbUVsZW1lbnRGb2N1cyB8fCB0aGlzLl9vdmVyZmxvd1dpZGdldHNEb21Ob2RlSGFzRm9jdXM7XG5cdFx0aWYgKHRoaXMuX2hhZEZvY3VzICE9PSBmb2N1c2VkKSB7XG5cdFx0XHR0aGlzLl9oYWRGb2N1cyA9IGZvY3VzZWQ7XG5cdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGhhc0ZvY3VzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9oYWRGb2N1cyA/PyBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyByZWZyZXNoU3RhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fZG9tRm9jdXNUcmFja2VyLnJlZnJlc2hTdGF0ZSgpO1xuXHRcdHRoaXMuX292ZXJmbG93V2lkZ2V0c0RvbU5vZGU/LnJlZnJlc2hTdGF0ZT8uKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQXNCLHlCQUF5QjtBQUUvQyxTQUFTLG9CQUFvQjtBQUU3QixTQUFTLG9CQUFvQix5QkFBeUI7QUFDdEQsU0FBUyxrQkFBK0I7QUFFeEMsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxzQkFBc0I7QUFFL0IsU0FBNEIsd0JBQW9EO0FBQ2hGLFNBQTJCLHNCQUFzQjtBQUNqRCxTQUFTLHFCQUFxQiwwQkFBMEI7QUFDeEQsU0FBUyxpQkFBaUIsd0JBQWtDO0FBQzVELFNBQVMsMkJB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
