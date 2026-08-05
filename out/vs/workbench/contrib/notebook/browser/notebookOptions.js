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
import { PixelRatio } from "../../../../base/browser/pixelRatio.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { isObject } from "../../../../base/common/types.js";
import { FontMeasurements } from "../../../../editor/browser/config/fontMeasurements.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { BareFontInfo } from "../../../../editor/common/config/fontInfo.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { NotebookSetting } from "../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../common/notebookExecutionStateService.js";
const SCROLLABLE_ELEMENT_PADDING_TOP = 18;
const OutputInnerContainerTopPadding = 4;
const defaultConfigConstants = Object.freeze({
  codeCellLeftMargin: 28,
  cellRunGutter: 32,
  markdownCellTopMargin: 8,
  markdownCellBottomMargin: 8,
  markdownCellLeftMargin: 0,
  markdownCellGutter: 32,
  focusIndicatorLeftMargin: 4
});
const compactConfigConstants = Object.freeze({
  codeCellLeftMargin: 8,
  cellRunGutter: 36,
  markdownCellTopMargin: 6,
  markdownCellBottomMargin: 6,
  markdownCellLeftMargin: 8,
  markdownCellGutter: 36,
  focusIndicatorLeftMargin: 4
});
let NotebookOptions = class extends Disposable {
  constructor(targetWindow, isReadonly, overrides, configurationService, notebookExecutionStateService, codeEditorService) {
    super();
    this.targetWindow = targetWindow;
    this.isReadonly = isReadonly;
    this.overrides = overrides;
    this.configurationService = configurationService;
    this.notebookExecutionStateService = notebookExecutionStateService;
    this.codeEditorService = codeEditorService;
    this._onDidChangeOptions = this._register(new Emitter());
    this.onDidChangeOptions = this._onDidChangeOptions.event;
    this._editorTopPadding = 12;
    this.previousModelToCompare = observableValue("previousModelToCompare", void 0);
    const showCellStatusBar = this.configurationService.getValue(NotebookSetting.showCellStatusBar);
    const globalToolbar = overrides?.globalToolbar ?? this.configurationService.getValue(NotebookSetting.globalToolbar) ?? true;
    const stickyScrollEnabled = overrides?.stickyScrollEnabled ?? this.configurationService.getValue(NotebookSetting.stickyScrollEnabled) ?? false;
    const stickyScrollMode = this._computeStickyScrollModeOption();
    const consolidatedOutputButton = this.configurationService.getValue(NotebookSetting.consolidatedOutputButton) ?? true;
    const consolidatedRunButton = this.configurationService.getValue(NotebookSetting.consolidatedRunButton) ?? false;
    const dragAndDropEnabled = overrides?.dragAndDropEnabled ?? this.configurationService.getValue(NotebookSetting.dragAndDropEnabled) ?? true;
    const cellToolbarLocation = this.configurationService.getValue(NotebookSetting.cellToolbarLocation) ?? { "default": "right" };
    const cellToolbarInteraction = overrides?.cellToolbarInteraction ?? this.configurationService.getValue(NotebookSetting.cellToolbarVisibility);
    const compactView = this.configurationService.getValue(NotebookSetting.compactView) ?? true;
    const focusIndicator = this._computeFocusIndicatorOption();
    const insertToolbarPosition = this._computeInsertToolbarPositionOption(this.isReadonly);
    const insertToolbarAlignment = this._computeInsertToolbarAlignmentOption();
    const showFoldingControls = this._computeShowFoldingControlsOption();
    const fontSize = this.configurationService.getValue("editor.fontSize");
    const markupFontSize = this.configurationService.getValue(NotebookSetting.markupFontSize);
    const markdownLineHeight = this.configurationService.getValue(NotebookSetting.markdownLineHeight);
    let editorOptionsCustomizations = this.configurationService.getValue(NotebookSetting.cellEditorOptionsCustomizations) ?? {};
    editorOptionsCustomizations = isObject(editorOptionsCustomizations) ? editorOptionsCustomizations : {};
    const interactiveWindowCollapseCodeCells = this.configurationService.getValue(NotebookSetting.interactiveWindowCollapseCodeCells);
    let outputLineHeightSettingValue;
    const deprecatedOutputLineHeightSetting = this.configurationService.getValue(NotebookSetting.outputLineHeightDeprecated);
    if (deprecatedOutputLineHeightSetting !== void 0) {
      this._migrateDeprecatedSetting(NotebookSetting.outputLineHeightDeprecated, NotebookSetting.outputLineHeight);
      outputLineHeightSettingValue = deprecatedOutputLineHeightSetting;
    } else {
      outputLineHeightSettingValue = this.configurationService.getValue(NotebookSetting.outputLineHeight);
    }
    let outputFontSize;
    const deprecatedOutputFontSizeSetting = this.configurationService.getValue(NotebookSetting.outputFontSizeDeprecated);
    if (deprecatedOutputFontSizeSetting !== void 0) {
      this._migrateDeprecatedSetting(NotebookSetting.outputFontSizeDeprecated, NotebookSetting.outputFontSize);
      outputFontSize = deprecatedOutputFontSizeSetting;
    } else {
      outputFontSize = this.configurationService.getValue(NotebookSetting.outputFontSize) || fontSize;
    }
    let outputFontFamily;
    const deprecatedOutputFontFamilySetting = this.configurationService.getValue(NotebookSetting.outputFontFamilyDeprecated);
    if (deprecatedOutputFontFamilySetting !== void 0) {
      this._migrateDeprecatedSetting(NotebookSetting.outputFontFamilyDeprecated, NotebookSetting.outputFontFamily);
      outputFontFamily = deprecatedOutputFontFamilySetting;
    } else {
      outputFontFamily = this.configurationService.getValue(NotebookSetting.outputFontFamily);
    }
    let outputScrolling;
    const deprecatedOutputScrollingSetting = this.configurationService.getValue(NotebookSetting.outputScrollingDeprecated);
    if (deprecatedOutputScrollingSetting !== void 0) {
      this._migrateDeprecatedSetting(NotebookSetting.outputScrollingDeprecated, NotebookSetting.outputScrolling);
      outputScrolling = deprecatedOutputScrollingSetting;
    } else {
      outputScrolling = this.configurationService.getValue(NotebookSetting.outputScrolling);
    }
    const outputLineHeight = this._computeOutputLineHeight(outputLineHeightSettingValue, outputFontSize);
    const outputWordWrap = this.configurationService.getValue(NotebookSetting.outputWordWrap);
    const outputLineLimit = this.configurationService.getValue(NotebookSetting.textOutputLineLimit) ?? 30;
    const linkifyFilePaths = this.configurationService.getValue(NotebookSetting.LinkifyOutputFilePaths) ?? true;
    const minimalErrors = this.configurationService.getValue(NotebookSetting.minimalErrorRendering);
    const markupFontFamily = this.configurationService.getValue(NotebookSetting.markupFontFamily);
    const editorTopPadding = this._computeEditorTopPadding();
    this._layoutConfiguration = {
      ...compactView ? compactConfigConstants : defaultConfigConstants,
      cellTopMargin: 6,
      cellBottomMargin: 6,
      cellRightMargin: 16,
      cellStatusBarHeight: 22,
      cellOutputPadding: 8,
      markdownPreviewPadding: 8,
      // bottomToolbarHeight: bottomToolbarHeight,
      // bottomToolbarGap: bottomToolbarGap,
      editorToolbarHeight: 0,
      editorTopPadding,
      editorBottomPadding: 4,
      editorBottomPaddingWithoutStatusBar: 12,
      collapsedIndicatorHeight: 28,
      showCellStatusBar,
      globalToolbar,
      stickyScrollEnabled,
      stickyScrollMode,
      consolidatedOutputButton,
      consolidatedRunButton,
      dragAndDropEnabled,
      cellToolbarLocation,
      cellToolbarInteraction,
      compactView,
      focusIndicator,
      insertToolbarPosition,
      insertToolbarAlignment,
      showFoldingControls,
      fontSize,
      outputFontSize,
      outputFontFamily,
      outputLineHeight,
      markupFontSize,
      markdownLineHeight,
      editorOptionsCustomizations,
      focusIndicatorGap: 3,
      interactiveWindowCollapseCodeCells,
      markdownFoldHintHeight: 22,
      outputScrolling,
      outputWordWrap,
      outputLineLimit,
      outputLinkifyFilePaths: linkifyFilePaths,
      outputMinimalError: minimalErrors,
      markupFontFamily,
      disableRulers: overrides?.disableRulers
    };
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      this._updateConfiguration(e);
    }));
  }
  updateOptions(isReadonly) {
    if (this.isReadonly !== isReadonly) {
      this.isReadonly = isReadonly;
      this._updateConfiguration({
        affectsConfiguration(configuration) {
          return configuration === NotebookSetting.insertToolbarLocation;
        },
        source: ConfigurationTarget.DEFAULT,
        affectedKeys: /* @__PURE__ */ new Set([NotebookSetting.insertToolbarLocation]),
        change: { keys: [NotebookSetting.insertToolbarLocation], overrides: [] }
      });
    }
  }
  _computeEditorTopPadding() {
    let decorationTriggeredAdjustment = false;
    const updateEditorTopPadding = (top) => {
      this._editorTopPadding = top;
      const configuration = Object.assign({}, this._layoutConfiguration);
      configuration.editorTopPadding = this._editorTopPadding;
      this._layoutConfiguration = configuration;
      this._onDidChangeOptions.fire({ editorTopPadding: true });
    };
    const decorationCheckSet = /* @__PURE__ */ new Set();
    const onDidAddDecorationType = (e) => {
      if (decorationTriggeredAdjustment) {
        return;
      }
      if (decorationCheckSet.has(e)) {
        return;
      }
      try {
        const options = this.codeEditorService.resolveDecorationOptions(e, true);
        if (options.afterContentClassName || options.beforeContentClassName) {
          const cssRules = this.codeEditorService.resolveDecorationCSSRules(e);
          if (cssRules !== null) {
            for (let i = 0; i < cssRules.length; i++) {
              if ((cssRules[i].selectorText.endsWith("::after") || cssRules[i].selectorText.endsWith("::after")) && cssRules[i].cssText.indexOf("top:") > -1) {
                const editorOptions = this.configurationService.getValue("editor");
                updateEditorTopPadding(BareFontInfo.createFromRawSettings(editorOptions, PixelRatio.getInstance(this.targetWindow).value).lineHeight + 2);
                decorationTriggeredAdjustment = true;
                break;
              }
            }
          }
        }
        decorationCheckSet.add(e);
      } catch (_ex) {
      }
    };
    this._register(this.codeEditorService.onDecorationTypeRegistered(onDidAddDecorationType));
    this.codeEditorService.listDecorationTypes().forEach(onDidAddDecorationType);
    return this._editorTopPadding;
  }
  _migrateDeprecatedSetting(deprecatedKey, key) {
    const deprecatedSetting = this.configurationService.inspect(deprecatedKey);
    if (deprecatedSetting.application !== void 0) {
      this.configurationService.updateValue(deprecatedKey, void 0, ConfigurationTarget.APPLICATION);
      this.configurationService.updateValue(key, deprecatedSetting.application.value, ConfigurationTarget.APPLICATION);
    }
    if (deprecatedSetting.user !== void 0) {
      this.configurationService.updateValue(deprecatedKey, void 0, ConfigurationTarget.USER);
      this.configurationService.updateValue(key, deprecatedSetting.user.value, ConfigurationTarget.USER);
    }
    if (deprecatedSetting.userLocal !== void 0) {
      this.configurationService.updateValue(deprecatedKey, void 0, ConfigurationTarget.USER_LOCAL);
      this.configurationService.updateValue(key, deprecatedSetting.userLocal.value, ConfigurationTarget.USER_LOCAL);
    }
    if (deprecatedSetting.userRemote !== void 0) {
      this.configurationService.updateValue(deprecatedKey, void 0, ConfigurationTarget.USER_REMOTE);
      this.configurationService.updateValue(key, deprecatedSetting.userRemote.value, ConfigurationTarget.USER_REMOTE);
    }
    if (deprecatedSetting.workspace !== void 0) {
      this.configurationService.updateValue(deprecatedKey, void 0, ConfigurationTarget.WORKSPACE);
      this.configurationService.updateValue(key, deprecatedSetting.workspace.value, ConfigurationTarget.WORKSPACE);
    }
    if (deprecatedSetting.workspaceFolder !== void 0) {
      this.configurationService.updateValue(deprecatedKey, void 0, ConfigurationTarget.WORKSPACE_FOLDER);
      this.configurationService.updateValue(key, deprecatedSetting.workspaceFolder.value, ConfigurationTarget.WORKSPACE_FOLDER);
    }
  }
  _computeOutputLineHeight(lineHeight, outputFontSize) {
    const minimumLineHeight = 9;
    if (lineHeight === 0) {
      const editorOptions = this.configurationService.getValue("editor");
      const fontInfo = FontMeasurements.readFontInfo(this.targetWindow, BareFontInfo.createFromRawSettings(editorOptions, PixelRatio.getInstance(this.targetWindow).value));
      lineHeight = fontInfo.lineHeight;
    } else if (lineHeight < minimumLineHeight) {
      let fontSize = outputFontSize;
      if (fontSize === 0) {
        fontSize = this.configurationService.getValue("editor.fontSize");
      }
      lineHeight = lineHeight * fontSize;
    }
    lineHeight = Math.round(lineHeight);
    if (lineHeight < minimumLineHeight) {
      lineHeight = minimumLineHeight;
    }
    return lineHeight;
  }
  _updateConfiguration(e) {
    const cellStatusBarVisibility = e.affectsConfiguration(NotebookSetting.showCellStatusBar);
    const cellToolbarLocation = e.affectsConfiguration(NotebookSetting.cellToolbarLocation);
    const cellToolbarInteraction = e.affectsConfiguration(NotebookSetting.cellToolbarVisibility);
    const compactView = e.affectsConfiguration(NotebookSetting.compactView);
    const focusIndicator = e.affectsConfiguration(NotebookSetting.focusIndicator);
    const insertToolbarPosition = e.affectsConfiguration(NotebookSetting.insertToolbarLocation);
    const insertToolbarAlignment = e.affectsConfiguration(NotebookSetting.experimentalInsertToolbarAlignment);
    const globalToolbar = e.affectsConfiguration(NotebookSetting.globalToolbar);
    const stickyScrollEnabled = e.affectsConfiguration(NotebookSetting.stickyScrollEnabled);
    const stickyScrollMode = e.affectsConfiguration(NotebookSetting.stickyScrollMode);
    const consolidatedOutputButton = e.affectsConfiguration(NotebookSetting.consolidatedOutputButton);
    const consolidatedRunButton = e.affectsConfiguration(NotebookSetting.consolidatedRunButton);
    const showFoldingControls = e.affectsConfiguration(NotebookSetting.showFoldingControls);
    const dragAndDropEnabled = e.affectsConfiguration(NotebookSetting.dragAndDropEnabled);
    const fontSize = e.affectsConfiguration("editor.fontSize");
    const outputFontSize = e.affectsConfiguration(NotebookSetting.outputFontSize);
    const markupFontSize = e.affectsConfiguration(NotebookSetting.markupFontSize);
    const markdownLineHeight = e.affectsConfiguration(NotebookSetting.markdownLineHeight);
    const fontFamily = e.affectsConfiguration("editor.fontFamily");
    const outputFontFamily = e.affectsConfiguration(NotebookSetting.outputFontFamily);
    const editorOptionsCustomizations = e.affectsConfiguration(NotebookSetting.cellEditorOptionsCustomizations);
    const interactiveWindowCollapseCodeCells = e.affectsConfiguration(NotebookSetting.interactiveWindowCollapseCodeCells);
    const outputLineHeight = e.affectsConfiguration(NotebookSetting.outputLineHeight);
    const outputScrolling = e.affectsConfiguration(NotebookSetting.outputScrolling);
    const outputWordWrap = e.affectsConfiguration(NotebookSetting.outputWordWrap);
    const outputLinkifyFilePaths = e.affectsConfiguration(NotebookSetting.LinkifyOutputFilePaths);
    const minimalError = e.affectsConfiguration(NotebookSetting.minimalErrorRendering);
    const markupFontFamily = e.affectsConfiguration(NotebookSetting.markupFontFamily);
    if (!cellStatusBarVisibility && !cellToolbarLocation && !cellToolbarInteraction && !compactView && !focusIndicator && !insertToolbarPosition && !insertToolbarAlignment && !globalToolbar && !stickyScrollEnabled && !stickyScrollMode && !consolidatedOutputButton && !consolidatedRunButton && !showFoldingControls && !dragAndDropEnabled && !fontSize && !outputFontSize && !markupFontSize && !markdownLineHeight && !fontFamily && !outputFontFamily && !editorOptionsCustomizations && !interactiveWindowCollapseCodeCells && !outputLineHeight && !outputScrolling && !outputWordWrap && !outputLinkifyFilePaths && !minimalError && !markupFontFamily) {
      return;
    }
    let configuration = Object.assign({}, this._layoutConfiguration);
    if (cellStatusBarVisibility) {
      configuration.showCellStatusBar = this.configurationService.getValue(NotebookSetting.showCellStatusBar);
    }
    if (cellToolbarLocation) {
      configuration.cellToolbarLocation = this.configurationService.getValue(NotebookSetting.cellToolbarLocation) ?? { "default": "right" };
    }
    if (cellToolbarInteraction && !this.overrides?.cellToolbarInteraction) {
      configuration.cellToolbarInteraction = this.configurationService.getValue(NotebookSetting.cellToolbarVisibility);
    }
    if (focusIndicator) {
      configuration.focusIndicator = this._computeFocusIndicatorOption();
    }
    if (compactView) {
      const compactViewValue = this.configurationService.getValue(NotebookSetting.compactView) ?? true;
      configuration = Object.assign(configuration, {
        ...compactViewValue ? compactConfigConstants : defaultConfigConstants
      });
      configuration.compactView = compactViewValue;
    }
    if (insertToolbarAlignment) {
      configuration.insertToolbarAlignment = this._computeInsertToolbarAlignmentOption();
    }
    if (insertToolbarPosition) {
      configuration.insertToolbarPosition = this._computeInsertToolbarPositionOption(this.isReadonly);
    }
    if (globalToolbar && this.overrides?.globalToolbar === void 0) {
      configuration.globalToolbar = this.configurationService.getValue(NotebookSetting.globalToolbar) ?? true;
    }
    if (stickyScrollEnabled && this.overrides?.stickyScrollEnabled === void 0) {
      configuration.stickyScrollEnabled = this.configurationService.getValue(NotebookSetting.stickyScrollEnabled) ?? false;
    }
    if (stickyScrollMode) {
      configuration.stickyScrollMode = this.configurationService.getValue(NotebookSetting.stickyScrollMode) ?? "flat";
    }
    if (consolidatedOutputButton) {
      configuration.consolidatedOutputButton = this.configurationService.getValue(NotebookSetting.consolidatedOutputButton) ?? true;
    }
    if (consolidatedRunButton) {
      configuration.consolidatedRunButton = this.configurationService.getValue(NotebookSetting.consolidatedRunButton) ?? true;
    }
    if (showFoldingControls) {
      configuration.showFoldingControls = this._computeShowFoldingControlsOption();
    }
    if (dragAndDropEnabled) {
      configuration.dragAndDropEnabled = this.configurationService.getValue(NotebookSetting.dragAndDropEnabled) ?? true;
    }
    if (fontSize) {
      configuration.fontSize = this.configurationService.getValue("editor.fontSize");
    }
    if (outputFontSize || fontSize) {
      configuration.outputFontSize = this.configurationService.getValue(NotebookSetting.outputFontSize) || configuration.fontSize;
    }
    if (markupFontSize) {
      configuration.markupFontSize = this.configurationService.getValue(NotebookSetting.markupFontSize);
    }
    if (markdownLineHeight) {
      configuration.markdownLineHeight = this.configurationService.getValue(NotebookSetting.markdownLineHeight);
    }
    if (outputFontFamily) {
      configuration.outputFontFamily = this.configurationService.getValue(NotebookSetting.outputFontFamily);
    }
    if (editorOptionsCustomizations) {
      configuration.editorOptionsCustomizations = this.configurationService.getValue(NotebookSetting.cellEditorOptionsCustomizations);
    }
    if (interactiveWindowCollapseCodeCells) {
      configuration.interactiveWindowCollapseCodeCells = this.configurationService.getValue(NotebookSetting.interactiveWindowCollapseCodeCells);
    }
    if (outputLineHeight || fontSize || outputFontSize) {
      const lineHeight = this.configurationService.getValue(NotebookSetting.outputLineHeight);
      configuration.outputLineHeight = this._computeOutputLineHeight(lineHeight, configuration.outputFontSize);
    }
    if (outputWordWrap) {
      configuration.outputWordWrap = this.configurationService.getValue(NotebookSetting.outputWordWrap);
    }
    if (outputScrolling) {
      configuration.outputScrolling = this.configurationService.getValue(NotebookSetting.outputScrolling);
    }
    if (outputLinkifyFilePaths) {
      configuration.outputLinkifyFilePaths = this.configurationService.getValue(NotebookSetting.LinkifyOutputFilePaths);
    }
    if (minimalError) {
      configuration.outputMinimalError = this.configurationService.getValue(NotebookSetting.minimalErrorRendering);
    }
    if (markupFontFamily) {
      configuration.markupFontFamily = this.configurationService.getValue(NotebookSetting.markupFontFamily);
    }
    this._layoutConfiguration = Object.freeze(configuration);
    this._onDidChangeOptions.fire({
      cellStatusBarVisibility,
      cellToolbarLocation,
      cellToolbarInteraction,
      compactView,
      focusIndicator,
      insertToolbarPosition,
      insertToolbarAlignment,
      globalToolbar,
      stickyScrollEnabled,
      stickyScrollMode,
      showFoldingControls,
      consolidatedOutputButton,
      consolidatedRunButton,
      dragAndDropEnabled,
      fontSize,
      outputFontSize,
      markupFontSize,
      markdownLineHeight,
      fontFamily,
      outputFontFamily,
      editorOptionsCustomizations,
      interactiveWindowCollapseCodeCells,
      outputLineHeight,
      outputScrolling,
      outputWordWrap,
      outputLinkifyFilePaths,
      minimalError,
      markupFontFamily
    });
  }
  _computeInsertToolbarPositionOption(isReadOnly) {
    return isReadOnly ? "hidden" : this.configurationService.getValue(NotebookSetting.insertToolbarLocation) ?? "both";
  }
  _computeInsertToolbarAlignmentOption() {
    return this.configurationService.getValue(NotebookSetting.experimentalInsertToolbarAlignment) ?? "center";
  }
  _computeShowFoldingControlsOption() {
    return this.configurationService.getValue(NotebookSetting.showFoldingControls) ?? "mouseover";
  }
  _computeFocusIndicatorOption() {
    return this.configurationService.getValue(NotebookSetting.focusIndicator) ?? "gutter";
  }
  _computeStickyScrollModeOption() {
    return this.configurationService.getValue(NotebookSetting.stickyScrollMode) ?? "flat";
  }
  getCellCollapseDefault() {
    return this._layoutConfiguration.interactiveWindowCollapseCodeCells === "never" ? {
      codeCell: {
        inputCollapsed: false
      }
    } : {
      codeCell: {
        inputCollapsed: true
      }
    };
  }
  getLayoutConfiguration() {
    return this._layoutConfiguration;
  }
  getDisplayOptions() {
    return this._layoutConfiguration;
  }
  getCellEditorContainerLeftMargin() {
    const {
      codeCellLeftMargin,
      cellRunGutter
    } = this._layoutConfiguration;
    return codeCellLeftMargin + cellRunGutter;
  }
  computeCollapsedMarkdownCellHeight(viewType) {
    const { bottomToolbarGap } = this.computeBottomToolbarDimensions(viewType);
    return this._layoutConfiguration.markdownCellTopMargin + this._layoutConfiguration.collapsedIndicatorHeight + bottomToolbarGap + this._layoutConfiguration.markdownCellBottomMargin;
  }
  computeBottomToolbarOffset(totalHeight, viewType) {
    const { bottomToolbarGap, bottomToolbarHeight } = this.computeBottomToolbarDimensions(viewType);
    return totalHeight - bottomToolbarGap - bottomToolbarHeight / 2;
  }
  computeCodeCellEditorWidth(outerWidth) {
    return outerWidth - (this._layoutConfiguration.codeCellLeftMargin + this._layoutConfiguration.cellRunGutter + this._layoutConfiguration.cellRightMargin);
  }
  computeMarkdownCellEditorWidth(outerWidth) {
    return outerWidth - this._layoutConfiguration.markdownCellGutter - this._layoutConfiguration.markdownCellLeftMargin - this._layoutConfiguration.cellRightMargin;
  }
  computeStatusBarHeight() {
    return this._layoutConfiguration.cellStatusBarHeight;
  }
  _computeBottomToolbarDimensions(compactView, insertToolbarPosition, insertToolbarAlignment, cellToolbar) {
    if (insertToolbarAlignment === "left" || cellToolbar !== "hidden") {
      return {
        bottomToolbarGap: 18,
        bottomToolbarHeight: 18
      };
    }
    if (insertToolbarPosition === "betweenCells" || insertToolbarPosition === "both") {
      return compactView ? {
        bottomToolbarGap: 12,
        bottomToolbarHeight: 20
      } : {
        bottomToolbarGap: 20,
        bottomToolbarHeight: 20
      };
    } else {
      return {
        bottomToolbarGap: 0,
        bottomToolbarHeight: 0
      };
    }
  }
  computeBottomToolbarDimensions(viewType) {
    const configuration = this._layoutConfiguration;
    const cellToolbarPosition = this.computeCellToolbarLocation(viewType);
    const { bottomToolbarGap, bottomToolbarHeight } = this._computeBottomToolbarDimensions(configuration.compactView, configuration.insertToolbarPosition, configuration.insertToolbarAlignment, cellToolbarPosition);
    return {
      bottomToolbarGap,
      bottomToolbarHeight
    };
  }
  computeCellToolbarLocation(viewType) {
    const cellToolbarLocation = this._layoutConfiguration.cellToolbarLocation;
    if (typeof cellToolbarLocation === "string") {
      if (cellToolbarLocation === "left" || cellToolbarLocation === "right" || cellToolbarLocation === "hidden") {
        return cellToolbarLocation;
      }
    } else {
      if (viewType) {
        const notebookSpecificSetting = cellToolbarLocation[viewType] ?? cellToolbarLocation["default"];
        let cellToolbarLocationForCurrentView = "right";
        switch (notebookSpecificSetting) {
          case "left":
            cellToolbarLocationForCurrentView = "left";
            break;
          case "right":
            cellToolbarLocationForCurrentView = "right";
            break;
          case "hidden":
            cellToolbarLocationForCurrentView = "hidden";
            break;
          default:
            cellToolbarLocationForCurrentView = "right";
            break;
        }
        return cellToolbarLocationForCurrentView;
      }
    }
    return "right";
  }
  computeTopInsertToolbarHeight(viewType) {
    if (this._layoutConfiguration.insertToolbarPosition === "betweenCells" || this._layoutConfiguration.insertToolbarPosition === "both") {
      return SCROLLABLE_ELEMENT_PADDING_TOP;
    }
    const cellToolbarLocation = this.computeCellToolbarLocation(viewType);
    if (cellToolbarLocation === "left" || cellToolbarLocation === "right") {
      return SCROLLABLE_ELEMENT_PADDING_TOP;
    }
    return 0;
  }
  computeEditorPadding(internalMetadata, cellUri) {
    return {
      top: this._editorTopPadding,
      bottom: this.statusBarIsVisible(internalMetadata, cellUri) ? this._layoutConfiguration.editorBottomPadding : this._layoutConfiguration.editorBottomPaddingWithoutStatusBar
    };
  }
  computeEditorStatusbarHeight(internalMetadata, cellUri) {
    return this.statusBarIsVisible(internalMetadata, cellUri) ? this.computeStatusBarHeight() : 0;
  }
  statusBarIsVisible(internalMetadata, cellUri) {
    const exe = this.notebookExecutionStateService.getCellExecution(cellUri);
    if (this._layoutConfiguration.showCellStatusBar === "visible") {
      return true;
    } else if (this._layoutConfiguration.showCellStatusBar === "visibleAfterExecute") {
      return typeof internalMetadata.lastRunSuccess === "boolean" || exe !== void 0;
    } else {
      return false;
    }
  }
  computeWebviewOptions() {
    return {
      outputNodePadding: this._layoutConfiguration.cellOutputPadding,
      outputNodeLeftPadding: this._layoutConfiguration.cellOutputPadding,
      previewNodePadding: this._layoutConfiguration.markdownPreviewPadding,
      markdownLeftMargin: this._layoutConfiguration.markdownCellGutter + this._layoutConfiguration.markdownCellLeftMargin,
      leftMargin: this._layoutConfiguration.codeCellLeftMargin,
      rightMargin: this._layoutConfiguration.cellRightMargin,
      runGutter: this._layoutConfiguration.cellRunGutter,
      dragAndDropEnabled: this._layoutConfiguration.dragAndDropEnabled,
      fontSize: this._layoutConfiguration.fontSize,
      outputFontSize: this._layoutConfiguration.outputFontSize,
      outputFontFamily: this._layoutConfiguration.outputFontFamily,
      markupFontSize: this._layoutConfiguration.markupFontSize,
      markdownLineHeight: this._layoutConfiguration.markdownLineHeight,
      outputLineHeight: this._layoutConfiguration.outputLineHeight,
      outputScrolling: this._layoutConfiguration.outputScrolling,
      outputWordWrap: this._layoutConfiguration.outputWordWrap,
      outputLineLimit: this._layoutConfiguration.outputLineLimit,
      outputLinkifyFilePaths: this._layoutConfiguration.outputLinkifyFilePaths,
      minimalError: this._layoutConfiguration.outputMinimalError,
      markupFontFamily: this._layoutConfiguration.markupFontFamily
    };
  }
  computeDiffWebviewOptions() {
    return {
      outputNodePadding: this._layoutConfiguration.cellOutputPadding,
      outputNodeLeftPadding: 0,
      previewNodePadding: this._layoutConfiguration.markdownPreviewPadding,
      markdownLeftMargin: 0,
      leftMargin: 32,
      rightMargin: 0,
      runGutter: 0,
      dragAndDropEnabled: false,
      fontSize: this._layoutConfiguration.fontSize,
      outputFontSize: this._layoutConfiguration.outputFontSize,
      outputFontFamily: this._layoutConfiguration.outputFontFamily,
      markupFontSize: this._layoutConfiguration.markupFontSize,
      markdownLineHeight: this._layoutConfiguration.markdownLineHeight,
      outputLineHeight: this._layoutConfiguration.outputLineHeight,
      outputScrolling: this._layoutConfiguration.outputScrolling,
      outputWordWrap: this._layoutConfiguration.outputWordWrap,
      outputLineLimit: this._layoutConfiguration.outputLineLimit,
      outputLinkifyFilePaths: false,
      minimalError: false,
      markupFontFamily: this._layoutConfiguration.markupFontFamily
    };
  }
  computeIndicatorPosition(totalHeight, foldHintHeight, viewType) {
    const { bottomToolbarGap } = this.computeBottomToolbarDimensions(viewType);
    return {
      bottomIndicatorTop: totalHeight - bottomToolbarGap - this._layoutConfiguration.cellBottomMargin - foldHintHeight,
      verticalIndicatorHeight: totalHeight - bottomToolbarGap - foldHintHeight
    };
  }
};
NotebookOptions = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, INotebookExecutionStateService),
  __decorateParam(5, ICodeEditorService)
], NotebookOptions);
export {
  NotebookOptions,
  OutputInnerContainerTopPadding
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL25vdGVib29rT3B0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFBpeGVsUmF0aW8gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvcGl4ZWxSYXRpby5qcyc7XG5pbXBvcnQgeyBDb2RlV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGlzT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEZvbnRNZWFzdXJlbWVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9jb25maWcvZm9udE1lYXN1cmVtZW50cy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQmFyZUZvbnRJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZm9udEluZm8uanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1RleHRNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va1RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJbnRlcmFjdGl2ZVdpbmRvd0NvbGxhcHNlQ29kZUNlbGxzLCBOb3RlYm9va0NlbGxEZWZhdWx0Q29sbGFwc2VDb25maWcsIE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEsIE5vdGVib29rU2V0dGluZywgU2hvd0NlbGxTdGF0dXNCYXJUeXBlIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5qcyc7XG5cbmNvbnN0IFNDUk9MTEFCTEVfRUxFTUVOVF9QQURESU5HX1RPUCA9IDE4O1xuXG5leHBvcnQgY29uc3QgT3V0cHV0SW5uZXJDb250YWluZXJUb3BQYWRkaW5nID0gNDtcblxuZXhwb3J0IGludGVyZmFjZSBOb3RlYm9va0Rpc3BsYXlPcHRpb25zIHsgLy8gVE9ETyBAWW95b2tyYXp5IHJlbmFtZSB0byBhIG1vcmUgZ2VuZXJpYyBuYW1lLCBub3QgZGlzcGxheVxuXHRzaG93Q2VsbFN0YXR1c0JhcjogU2hvd0NlbGxTdGF0dXNCYXJUeXBlO1xuXHRjZWxsVG9vbGJhckxvY2F0aW9uOiBzdHJpbmcgfCB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuXHRjZWxsVG9vbGJhckludGVyYWN0aW9uOiBzdHJpbmc7XG5cdGNvbXBhY3RWaWV3OiBib29sZWFuO1xuXHRmb2N1c0luZGljYXRvcjogJ2JvcmRlcicgfCAnZ3V0dGVyJztcblx0aW5zZXJ0VG9vbGJhclBvc2l0aW9uOiAnYmV0d2VlbkNlbGxzJyB8ICdub3RlYm9va1Rvb2xiYXInIHwgJ2JvdGgnIHwgJ2hpZGRlbic7XG5cdGluc2VydFRvb2xiYXJBbGlnbm1lbnQ6ICdsZWZ0JyB8ICdjZW50ZXInO1xuXHRnbG9iYWxUb29sYmFyOiBib29sZWFuO1xuXHRzdGlja3lTY3JvbGxFbmFibGVkOiBib29sZWFuO1xuXHRzdGlja3lTY3JvbGxNb2RlOiAnZmxhdCcgfCAnaW5kZW50ZWQnO1xuXHRjb25zb2xpZGF0ZWRPdXRwdXRCdXR0b246IGJvb2xlYW47XG5cdGNvbnNvbGlkYXRlZFJ1bkJ1dHRvbjogYm9vbGVhbjtcblx0c2hvd0ZvbGRpbmdDb250cm9sczogJ2Fsd2F5cycgfCAnbmV2ZXInIHwgJ21vdXNlb3Zlcic7XG5cdGRyYWdBbmREcm9wRW5hYmxlZDogYm9vbGVhbjtcblx0aW50ZXJhY3RpdmVXaW5kb3dDb2xsYXBzZUNvZGVDZWxsczogSW50ZXJhY3RpdmVXaW5kb3dDb2xsYXBzZUNvZGVDZWxscztcblx0b3V0cHV0U2Nyb2xsaW5nOiBib29sZWFuO1xuXHRvdXRwdXRXb3JkV3JhcDogYm9vbGVhbjtcblx0b3V0cHV0TGluZUxpbWl0OiBudW1iZXI7XG5cdG91dHB1dExpbmtpZnlGaWxlUGF0aHM6IGJvb2xlYW47XG5cdG91dHB1dE1pbmltYWxFcnJvcjogYm9vbGVhbjtcblx0Zm9udFNpemU6IG51bWJlcjtcblx0b3V0cHV0Rm9udFNpemU6IG51bWJlcjtcblx0b3V0cHV0Rm9udEZhbWlseTogc3RyaW5nO1xuXHRvdXRwdXRMaW5lSGVpZ2h0OiBudW1iZXI7XG5cdG1hcmt1cEZvbnRTaXplOiBudW1iZXI7XG5cdG1hcmtkb3duTGluZUhlaWdodDogbnVtYmVyO1xuXHRlZGl0b3JPcHRpb25zQ3VzdG9taXphdGlvbnM6IFBhcnRpYWw8e1xuXHRcdCdlZGl0b3IuaW5kZW50U2l6ZSc6ICd0YWJTaXplJyB8IG51bWJlcjtcblx0XHQnZWRpdG9yLnRhYlNpemUnOiBudW1iZXI7XG5cdFx0J2VkaXRvci5pbnNlcnRTcGFjZXMnOiBib29sZWFuO1xuXHR9PiB8IHVuZGVmaW5lZDtcblx0bWFya3VwRm9udEZhbWlseTogc3RyaW5nO1xuXHRkaXNhYmxlUnVsZXJzOiBib29sZWFuIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVib29rTGF5b3V0Q29uZmlndXJhdGlvbiB7XG5cdGNlbGxSaWdodE1hcmdpbjogbnVtYmVyO1xuXHRjZWxsUnVuR3V0dGVyOiBudW1iZXI7XG5cdGNlbGxUb3BNYXJnaW46IG51bWJlcjtcblx0Y2VsbEJvdHRvbU1hcmdpbjogbnVtYmVyO1xuXHRjZWxsT3V0cHV0UGFkZGluZzogbnVtYmVyO1xuXHRjb2RlQ2VsbExlZnRNYXJnaW46IG51bWJlcjtcblx0bWFya2Rvd25DZWxsTGVmdE1hcmdpbjogbnVtYmVyO1xuXHRtYXJrZG93bkNlbGxHdXR0ZXI6IG51bWJlcjtcblx0bWFya2Rvd25DZWxsVG9wTWFyZ2luOiBudW1iZXI7XG5cdG1hcmtkb3duQ2VsbEJvdHRvbU1hcmdpbjogbnVtYmVyO1xuXHRtYXJrZG93blByZXZpZXdQYWRkaW5nOiBudW1iZXI7XG5cdG1hcmtkb3duRm9sZEhpbnRIZWlnaHQ6IG51bWJlcjtcblx0ZWRpdG9yVG9vbGJhckhlaWdodDogbnVtYmVyO1xuXHRlZGl0b3JUb3BQYWRkaW5nOiBudW1iZXI7XG5cdGVkaXRvckJvdHRvbVBhZGRpbmc6IG51bWJlcjtcblx0ZWRpdG9yQm90dG9tUGFkZGluZ1dpdGhvdXRTdGF0dXNCYXI6IG51bWJlcjtcblx0Y29sbGFwc2VkSW5kaWNhdG9ySGVpZ2h0OiBudW1iZXI7XG5cdGNlbGxTdGF0dXNCYXJIZWlnaHQ6IG51bWJlcjtcblx0Zm9jdXNJbmRpY2F0b3JMZWZ0TWFyZ2luOiBudW1iZXI7XG5cdGZvY3VzSW5kaWNhdG9yR2FwOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm90ZWJvb2tPcHRpb25zQ2hhbmdlRXZlbnQge1xuXHRyZWFkb25seSBjZWxsU3RhdHVzQmFyVmlzaWJpbGl0eT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNlbGxUb29sYmFyTG9jYXRpb24/OiBib29sZWFuO1xuXHRyZWFkb25seSBjZWxsVG9vbGJhckludGVyYWN0aW9uPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZWRpdG9yVG9wUGFkZGluZz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNvbXBhY3RWaWV3PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZm9jdXNJbmRpY2F0b3I/OiBib29sZWFuO1xuXHRyZWFkb25seSBpbnNlcnRUb29sYmFyUG9zaXRpb24/OiBib29sZWFuO1xuXHRyZWFkb25seSBpbnNlcnRUb29sYmFyQWxpZ25tZW50PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZ2xvYmFsVG9vbGJhcj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHN0aWNreVNjcm9sbEVuYWJsZWQ/OiBib29sZWFuO1xuXHRyZWFkb25seSBzdGlja3lTY3JvbGxNb2RlPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgc2hvd0ZvbGRpbmdDb250cm9scz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNvbnNvbGlkYXRlZE91dHB1dEJ1dHRvbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGNvbnNvbGlkYXRlZFJ1bkJ1dHRvbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGRyYWdBbmREcm9wRW5hYmxlZD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGZvbnRTaXplPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgb3V0cHV0Rm9udFNpemU/OiBib29sZWFuO1xuXHRyZWFkb25seSBtYXJrdXBGb250U2l6ZT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IG1hcmtkb3duTGluZUhlaWdodD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGZvbnRGYW1pbHk/OiBib29sZWFuO1xuXHRyZWFkb25seSBvdXRwdXRGb250RmFtaWx5PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25zPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgaW50ZXJhY3RpdmVXaW5kb3dDb2xsYXBzZUNvZGVDZWxscz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IG91dHB1dExpbmVIZWlnaHQ/OiBib29sZWFuO1xuXHRyZWFkb25seSBvdXRwdXRXb3JkV3JhcD86IGJvb2xlYW47XG5cdHJlYWRvbmx5IG91dHB1dFNjcm9sbGluZz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IG91dHB1dExpbmtpZnlGaWxlUGF0aHM/OiBib29sZWFuO1xuXHRyZWFkb25seSBtaW5pbWFsRXJyb3I/OiBib29sZWFuO1xuXHRyZWFkb25seSByZWFkb25seT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IG1hcmt1cEZvbnRGYW1pbHk/OiBib29sZWFuO1xufVxuXG5jb25zdCBkZWZhdWx0Q29uZmlnQ29uc3RhbnRzID0gT2JqZWN0LmZyZWV6ZSh7XG5cdGNvZGVDZWxsTGVmdE1hcmdpbjogMjgsXG5cdGNlbGxSdW5HdXR0ZXI6IDMyLFxuXHRtYXJrZG93bkNlbGxUb3BNYXJnaW46IDgsXG5cdG1hcmtkb3duQ2VsbEJvdHRvbU1hcmdpbjogOCxcblx0bWFya2Rvd25DZWxsTGVmdE1hcmdpbjogMCxcblx0bWFya2Rvd25DZWxsR3V0dGVyOiAzMixcblx0Zm9jdXNJbmRpY2F0b3JMZWZ0TWFyZ2luOiA0XG59KTtcblxuY29uc3QgY29tcGFjdENvbmZpZ0NvbnN0YW50cyA9IE9iamVjdC5mcmVlemUoe1xuXHRjb2RlQ2VsbExlZnRNYXJnaW46IDgsXG5cdGNlbGxSdW5HdXR0ZXI6IDM2LFxuXHRtYXJrZG93bkNlbGxUb3BNYXJnaW46IDYsXG5cdG1hcmtkb3duQ2VsbEJvdHRvbU1hcmdpbjogNixcblx0bWFya2Rvd25DZWxsTGVmdE1hcmdpbjogOCxcblx0bWFya2Rvd25DZWxsR3V0dGVyOiAzNixcblx0Zm9jdXNJbmRpY2F0b3JMZWZ0TWFyZ2luOiA0XG59KTtcblxuZXhwb3J0IGNsYXNzIE5vdGVib29rT3B0aW9ucyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIF9sYXlvdXRDb25maWd1cmF0aW9uOiBOb3RlYm9va0xheW91dENvbmZpZ3VyYXRpb24gJiBOb3RlYm9va0Rpc3BsYXlPcHRpb25zO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlT3B0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPE5vdGVib29rT3B0aW9uc0NoYW5nZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VPcHRpb25zID0gdGhpcy5fb25EaWRDaGFuZ2VPcHRpb25zLmV2ZW50O1xuXHRwcml2YXRlIF9lZGl0b3JUb3BQYWRkaW5nOiBudW1iZXIgPSAxMjtcblxuXHRyZWFkb25seSBwcmV2aW91c01vZGVsVG9Db21wYXJlID0gb2JzZXJ2YWJsZVZhbHVlPE5vdGVib29rVGV4dE1vZGVsIHwgdW5kZWZpbmVkPigncHJldmlvdXNNb2RlbFRvQ29tcGFyZScsIHVuZGVmaW5lZCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgdGFyZ2V0V2luZG93OiBDb2RlV2luZG93LFxuXHRcdHByaXZhdGUgaXNSZWFkb25seTogYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IG92ZXJyaWRlczogeyBjZWxsVG9vbGJhckludGVyYWN0aW9uOiBzdHJpbmc7IGdsb2JhbFRvb2xiYXI6IGJvb2xlYW47IHN0aWNreVNjcm9sbEVuYWJsZWQ6IGJvb2xlYW47IGRyYWdBbmREcm9wRW5hYmxlZDogYm9vbGVhbjsgZGlzYWJsZVJ1bGVyczogYm9vbGVhbiB9IHwgdW5kZWZpbmVkLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvbnN0IHNob3dDZWxsU3RhdHVzQmFyID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxTaG93Q2VsbFN0YXR1c0JhclR5cGU+KE5vdGVib29rU2V0dGluZy5zaG93Q2VsbFN0YXR1c0Jhcik7XG5cdFx0Y29uc3QgZ2xvYmFsVG9vbGJhciA9IG92ZXJyaWRlcz8uZ2xvYmFsVG9vbGJhciA/PyB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4gfCB1bmRlZmluZWQ+KE5vdGVib29rU2V0dGluZy5nbG9iYWxUb29sYmFyKSA/PyB0cnVlO1xuXHRcdGNvbnN0IHN0aWNreVNjcm9sbEVuYWJsZWQgPSBvdmVycmlkZXM/LnN0aWNreVNjcm9sbEVuYWJsZWQgPz8gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuIHwgdW5kZWZpbmVkPihOb3RlYm9va1NldHRpbmcuc3RpY2t5U2Nyb2xsRW5hYmxlZCkgPz8gZmFsc2U7XG5cdFx0Y29uc3Qgc3RpY2t5U2Nyb2xsTW9kZSA9IHRoaXMuX2NvbXB1dGVTdGlja3lTY3JvbGxNb2RlT3B0aW9uKCk7XG5cdFx0Y29uc3QgY29uc29saWRhdGVkT3V0cHV0QnV0dG9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuIHwgdW5kZWZpbmVkPihOb3RlYm9va1NldHRpbmcuY29uc29saWRhdGVkT3V0cHV0QnV0dG9uKSA/PyB0cnVlO1xuXHRcdGNvbnN0IGNvbnNvbGlkYXRlZFJ1bkJ1dHRvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbiB8IHVuZGVmaW5lZD4oTm90ZWJvb2tTZXR0aW5nLmNvbnNvbGlkYXRlZFJ1bkJ1dHRvbikgPz8gZmFsc2U7XG5cdFx0Y29uc3QgZHJhZ0FuZERyb3BFbmFibGVkID0gb3ZlcnJpZGVzPy5kcmFnQW5kRHJvcEVuYWJsZWQgPz8gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuIHwgdW5kZWZpbmVkPihOb3RlYm9va1NldHRpbmcuZHJhZ0FuZERyb3BFbmFibGVkKSA/PyB0cnVlO1xuXHRcdGNvbnN0IGNlbGxUb29sYmFyTG9jYXRpb24gPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZyB8IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0+KE5vdGVib29rU2V0dGluZy5jZWxsVG9vbGJhckxvY2F0aW9uKSA/PyB7ICdkZWZhdWx0JzogJ3JpZ2h0JyB9O1xuXHRcdGNvbnN0IGNlbGxUb29sYmFySW50ZXJhY3Rpb24gPSBvdmVycmlkZXM/LmNlbGxUb29sYmFySW50ZXJhY3Rpb24gPz8gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KE5vdGVib29rU2V0dGluZy5jZWxsVG9vbGJhclZpc2liaWxpdHkpO1xuXHRcdGNvbnN0IGNvbXBhY3RWaWV3ID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuIHwgdW5kZWZpbmVkPihOb3RlYm9va1NldHRpbmcuY29tcGFjdFZpZXcpID8/IHRydWU7XG5cdFx0Y29uc3QgZm9jdXNJbmRpY2F0b3IgPSB0aGlzLl9jb21wdXRlRm9jdXNJbmRpY2F0b3JPcHRpb24oKTtcblx0XHRjb25zdCBpbnNlcnRUb29sYmFyUG9zaXRpb24gPSB0aGlzLl9jb21wdXRlSW5zZXJ0VG9vbGJhclBvc2l0aW9uT3B0aW9uKHRoaXMuaXNSZWFkb25seSk7XG5cdFx0Y29uc3QgaW5zZXJ0VG9vbGJhckFsaWdubWVudCA9IHRoaXMuX2NvbXB1dGVJbnNlcnRUb29sYmFyQWxpZ25tZW50T3B0aW9uKCk7XG5cdFx0Y29uc3Qgc2hvd0ZvbGRpbmdDb250cm9scyA9IHRoaXMuX2NvbXB1dGVTaG93Rm9sZGluZ0NvbnRyb2xzT3B0aW9uKCk7XG5cdFx0Ly8gY29uc3QgeyBib3R0b21Ub29sYmFyR2FwLCBib3R0b21Ub29sYmFySGVpZ2h0IH0gPSB0aGlzLl9jb21wdXRlQm90dG9tVG9vbGJhckRpbWVuc2lvbnMoY29tcGFjdFZpZXcsIGluc2VydFRvb2xiYXJQb3NpdGlvbiwgaW5zZXJ0VG9vbGJhckFsaWdubWVudCk7XG5cdFx0Y29uc3QgZm9udFNpemUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oJ2VkaXRvci5mb250U2l6ZScpO1xuXHRcdGNvbnN0IG1hcmt1cEZvbnRTaXplID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KE5vdGVib29rU2V0dGluZy5tYXJrdXBGb250U2l6ZSk7XG5cdFx0Y29uc3QgbWFya2Rvd25MaW5lSGVpZ2h0ID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KE5vdGVib29rU2V0dGluZy5tYXJrZG93bkxpbmVIZWlnaHQpO1xuXHRcdGxldCBlZGl0b3JPcHRpb25zQ3VzdG9taXphdGlvbnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPFBhcnRpYWw8e1xuXHRcdFx0J2VkaXRvci5pbmRlbnRTaXplJzogJ3RhYlNpemUnIHwgbnVtYmVyO1xuXHRcdFx0J2VkaXRvci50YWJTaXplJzogbnVtYmVyO1xuXHRcdFx0J2VkaXRvci5pbnNlcnRTcGFjZXMnOiBib29sZWFuO1xuXHRcdH0+PihOb3RlYm9va1NldHRpbmcuY2VsbEVkaXRvck9wdGlvbnNDdXN0b21pemF0aW9ucykgPz8ge307XG5cdFx0ZWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25zID0gaXNPYmplY3QoZWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25zKSA/IGVkaXRvck9wdGlvbnNDdXN0b21pemF0aW9ucyA6IHt9O1xuXHRcdGNvbnN0IGludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHM6IEludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKE5vdGVib29rU2V0dGluZy5pbnRlcmFjdGl2ZVdpbmRvd0NvbGxhcHNlQ29kZUNlbGxzKTtcblxuXHRcdC8vIFRPT0QgQHJlYm9ybml4IHJlbW92ZSBhZnRlciBhIGZldyBpdGVyYXRpb25zIG9mIGRlcHJlY2F0ZWQgc2V0dGluZ1xuXHRcdGxldCBvdXRwdXRMaW5lSGVpZ2h0U2V0dGluZ1ZhbHVlOiBudW1iZXI7XG5cdFx0Y29uc3QgZGVwcmVjYXRlZE91dHB1dExpbmVIZWlnaHRTZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KE5vdGVib29rU2V0dGluZy5vdXRwdXRMaW5lSGVpZ2h0RGVwcmVjYXRlZCk7XG5cdFx0aWYgKGRlcHJlY2F0ZWRPdXRwdXRMaW5lSGVpZ2h0U2V0dGluZyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl9taWdyYXRlRGVwcmVjYXRlZFNldHRpbmcoTm90ZWJvb2tTZXR0aW5nLm91dHB1dExpbmVIZWlnaHREZXByZWNhdGVkLCBOb3RlYm9va1NldHRpbmcub3V0cHV0TGluZUhlaWdodCk7XG5cdFx0XHRvdXRwdXRMaW5lSGVpZ2h0U2V0dGluZ1ZhbHVlID0gZGVwcmVjYXRlZE91dHB1dExpbmVIZWlnaHRTZXR0aW5nO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvdXRwdXRMaW5lSGVpZ2h0U2V0dGluZ1ZhbHVlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KE5vdGVib29rU2V0dGluZy5vdXRwdXRMaW5lSGVpZ2h0KTtcblx0XHR9XG5cblx0XHRsZXQgb3V0cHV0Rm9udFNpemU6IG51bWJlcjtcblx0XHRjb25zdCBkZXByZWNhdGVkT3V0cHV0Rm9udFNpemVTZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KE5vdGVib29rU2V0dGluZy5vdXRwdXRGb250U2l6ZURlcHJlY2F0ZWQpO1xuXHRcdGlmIChkZXByZWNhdGVkT3V0cHV0Rm9udFNpemVTZXR0aW5nICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX21pZ3JhdGVEZXByZWNhdGVkU2V0dGluZyhOb3RlYm9va1NldHRpbmcub3V0cHV0Rm9udFNpemVEZXByZWNhdGVkLCBOb3RlYm9va1NldHRpbmcub3V0cHV0Rm9udFNpemUpO1xuXHRcdFx0b3V0cHV0Rm9udFNpemUgPSBkZXByZWNhdGVkT3V0cHV0Rm9udFNpemVTZXR0aW5nO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvdXRwdXRGb250U2l6ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihOb3RlYm9va1NldHRpbmcub3V0cHV0Rm9udFNpemUpIHx8IGZvbnRTaXplO1xuXHRcdH1cblxuXHRcdGxldCBvdXRwdXRGb250RmFtaWx5OiBzdHJpbmc7XG5cdFx0Y29uc3QgZGVwcmVjYXRlZE91dHB1dEZvbnRGYW1pbHlTZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KE5vdGVib29rU2V0dGluZy5vdXRwdXRGb250RmFtaWx5RGVwcmVjYXRlZCk7XG5cdFx0aWYgKGRlcHJlY2F0ZWRPdXRwdXRGb250RmFtaWx5U2V0dGluZyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl9taWdyYXRlRGVwcmVjYXRlZFNldHRpbmcoTm90ZWJvb2tTZXR0aW5nLm91dHB1dEZvbnRGYW1pbHlEZXByZWNhdGVkLCBOb3RlYm9va1NldHRpbmcub3V0cHV0Rm9udEZhbWlseSk7XG5cdFx0XHRvdXRwdXRGb250RmFtaWx5ID0gZGVwcmVjYXRlZE91dHB1dEZvbnRGYW1pbHlTZXR0aW5nO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvdXRwdXRGb250RmFtaWx5ID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KE5vdGVib29rU2V0dGluZy5vdXRwdXRGb250RmFtaWx5KTtcblx0XHR9XG5cblx0XHRsZXQgb3V0cHV0U2Nyb2xsaW5nOiBib29sZWFuO1xuXHRcdGNvbnN0IGRlcHJlY2F0ZWRPdXRwdXRTY3JvbGxpbmdTZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0cHV0U2Nyb2xsaW5nRGVwcmVjYXRlZCk7XG5cdFx0aWYgKGRlcHJlY2F0ZWRPdXRwdXRTY3JvbGxpbmdTZXR0aW5nICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX21pZ3JhdGVEZXByZWNhdGVkU2V0dGluZyhOb3RlYm9va1NldHRpbmcub3V0cHV0U2Nyb2xsaW5nRGVwcmVjYXRlZCwgTm90ZWJvb2tTZXR0aW5nLm91dHB1dFNjcm9sbGluZyk7XG5cdFx0XHRvdXRwdXRTY3JvbGxpbmcgPSBkZXByZWNhdGVkT3V0cHV0U2Nyb2xsaW5nU2V0dGluZztcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3V0cHV0U2Nyb2xsaW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0cHV0U2Nyb2xsaW5nKTtcblx0XHR9XG5cblx0XHRjb25zdCBvdXRwdXRMaW5lSGVpZ2h0ID0gdGhpcy5fY29tcHV0ZU91dHB1dExpbmVIZWlnaHQob3V0cHV0TGluZUhlaWdodFNldHRpbmdWYWx1ZSwgb3V0cHV0Rm9udFNpemUpO1xuXHRcdGNvbnN0IG91dHB1dFdvcmRXcmFwID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0cHV0V29yZFdyYXApO1xuXHRcdGNvbnN0IG91dHB1dExpbmVMaW1pdCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihOb3RlYm9va1NldHRpbmcudGV4dE91dHB1dExpbmVMaW1pdCkgPz8gMzA7XG5cdFx0Y29uc3QgbGlua2lmeUZpbGVQYXRocyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLkxpbmtpZnlPdXRwdXRGaWxlUGF0aHMpID8/IHRydWU7XG5cdFx0Y29uc3QgbWluaW1hbEVycm9ycyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLm1pbmltYWxFcnJvclJlbmRlcmluZyk7XG5cdFx0Y29uc3QgbWFya3VwRm9udEZhbWlseSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPihOb3RlYm9va1NldHRpbmcubWFya3VwRm9udEZhbWlseSk7XG5cblx0XHRjb25zdCBlZGl0b3JUb3BQYWRkaW5nID0gdGhpcy5fY29tcHV0ZUVkaXRvclRvcFBhZGRpbmcoKTtcblxuXHRcdHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHQuLi4oY29tcGFjdFZpZXcgPyBjb21wYWN0Q29uZmlnQ29uc3RhbnRzIDogZGVmYXVsdENvbmZpZ0NvbnN0YW50cyksXG5cdFx0XHRjZWxsVG9wTWFyZ2luOiA2LFxuXHRcdFx0Y2VsbEJvdHRvbU1hcmdpbjogNixcblx0XHRcdGNlbGxSaWdodE1hcmdpbjogMTYsXG5cdFx0XHRjZWxsU3RhdHVzQmFySGVpZ2h0OiAyMixcblx0XHRcdGNlbGxPdXRwdXRQYWRkaW5nOiA4LFxuXHRcdFx0bWFya2Rvd25QcmV2aWV3UGFkZGluZzogOCxcblx0XHRcdC8vIGJvdHRvbVRvb2xiYXJIZWlnaHQ6IGJvdHRvbVRvb2xiYXJIZWlnaHQsXG5cdFx0XHQvLyBib3R0b21Ub29sYmFyR2FwOiBib3R0b21Ub29sYmFyR2FwLFxuXHRcdFx0ZWRpdG9yVG9vbGJhckhlaWdodDogMCxcblx0XHRcdGVkaXRvclRvcFBhZGRpbmc6IGVkaXRvclRvcFBhZGRpbmcsXG5cdFx0XHRlZGl0b3JCb3R0b21QYWRkaW5nOiA0LFxuXHRcdFx0ZWRpdG9yQm90dG9tUGFkZGluZ1dpdGhvdXRTdGF0dXNCYXI6IDEyLFxuXHRcdFx0Y29sbGFwc2VkSW5kaWNhdG9ySGVpZ2h0OiAyOCxcblx0XHRcdHNob3dDZWxsU3RhdHVzQmFyLFxuXHRcdFx0Z2xvYmFsVG9vbGJhcixcblx0XHRcdHN0aWNreVNjcm9sbEVuYWJsZWQsXG5cdFx0XHRzdGlja3lTY3JvbGxNb2RlLFxuXHRcdFx0Y29uc29saWRhdGVkT3V0cHV0QnV0dG9uLFxuXHRcdFx0Y29uc29saWRhdGVkUnVuQnV0dG9uLFxuXHRcdFx0ZHJhZ0FuZERyb3BFbmFibGVkLFxuXHRcdFx0Y2VsbFRvb2xiYXJMb2NhdGlvbixcblx0XHRcdGNlbGxUb29sYmFySW50ZXJhY3Rpb24sXG5cdFx0XHRjb21wYWN0Vmlldyxcblx0XHRcdGZvY3VzSW5kaWNhdG9yLFxuXHRcdFx0aW5zZXJ0VG9vbGJhclBvc2l0aW9uLFxuXHRcdFx0aW5zZXJ0VG9vbGJhckFsaWdubWVudCxcblx0XHRcdHNob3dGb2xkaW5nQ29udHJvbHMsXG5cdFx0XHRmb250U2l6ZSxcblx0XHRcdG91dHB1dEZvbnRTaXplLFxuXHRcdFx0b3V0cHV0Rm9udEZhbWlseSxcblx0XHRcdG91dHB1dExpbmVIZWlnaHQsXG5cdFx0XHRtYXJrdXBGb250U2l6ZSxcblx0XHRcdG1hcmtkb3duTGluZUhlaWdodCxcblx0XHRcdGVkaXRvck9wdGlvbnNDdXN0b21pemF0aW9ucyxcblx0XHRcdGZvY3VzSW5kaWNhdG9yR2FwOiAzLFxuXHRcdFx0aW50ZXJhY3RpdmVXaW5kb3dDb2xsYXBzZUNvZGVDZWxscyxcblx0XHRcdG1hcmtkb3duRm9sZEhpbnRIZWlnaHQ6IDIyLFxuXHRcdFx0b3V0cHV0U2Nyb2xsaW5nOiBvdXRwdXRTY3JvbGxpbmcsXG5cdFx0XHRvdXRwdXRXb3JkV3JhcDogb3V0cHV0V29yZFdyYXAsXG5cdFx0XHRvdXRwdXRMaW5lTGltaXQ6IG91dHB1dExpbmVMaW1pdCxcblx0XHRcdG91dHB1dExpbmtpZnlGaWxlUGF0aHM6IGxpbmtpZnlGaWxlUGF0aHMsXG5cdFx0XHRvdXRwdXRNaW5pbWFsRXJyb3I6IG1pbmltYWxFcnJvcnMsXG5cdFx0XHRtYXJrdXBGb250RmFtaWx5LFxuXHRcdFx0ZGlzYWJsZVJ1bGVyczogb3ZlcnJpZGVzPy5kaXNhYmxlUnVsZXJzLFxuXHRcdH07XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdHRoaXMuX3VwZGF0ZUNvbmZpZ3VyYXRpb24oZSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0dXBkYXRlT3B0aW9ucyhpc1JlYWRvbmx5OiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuaXNSZWFkb25seSAhPT0gaXNSZWFkb25seSkge1xuXHRcdFx0dGhpcy5pc1JlYWRvbmx5ID0gaXNSZWFkb25seTtcblxuXHRcdFx0dGhpcy5fdXBkYXRlQ29uZmlndXJhdGlvbih7XG5cdFx0XHRcdGFmZmVjdHNDb25maWd1cmF0aW9uKGNvbmZpZ3VyYXRpb246IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdFx0XHRcdHJldHVybiBjb25maWd1cmF0aW9uID09PSBOb3RlYm9va1NldHRpbmcuaW5zZXJ0VG9vbGJhckxvY2F0aW9uO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzb3VyY2U6IENvbmZpZ3VyYXRpb25UYXJnZXQuREVGQVVMVCxcblx0XHRcdFx0YWZmZWN0ZWRLZXlzOiBuZXcgU2V0KFtOb3RlYm9va1NldHRpbmcuaW5zZXJ0VG9vbGJhckxvY2F0aW9uXSksXG5cdFx0XHRcdGNoYW5nZTogeyBrZXlzOiBbTm90ZWJvb2tTZXR0aW5nLmluc2VydFRvb2xiYXJMb2NhdGlvbl0sIG92ZXJyaWRlczogW10gfSxcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NvbXB1dGVFZGl0b3JUb3BQYWRkaW5nKCk6IG51bWJlciB7XG5cdFx0bGV0IGRlY29yYXRpb25UcmlnZ2VyZWRBZGp1c3RtZW50ID0gZmFsc2U7XG5cblx0XHRjb25zdCB1cGRhdGVFZGl0b3JUb3BQYWRkaW5nID0gKHRvcDogbnVtYmVyKSA9PiB7XG5cdFx0XHR0aGlzLl9lZGl0b3JUb3BQYWRkaW5nID0gdG9wO1xuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24pO1xuXHRcdFx0Y29uZmlndXJhdGlvbi5lZGl0b3JUb3BQYWRkaW5nID0gdGhpcy5fZWRpdG9yVG9wUGFkZGluZztcblx0XHRcdHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VPcHRpb25zLmZpcmUoeyBlZGl0b3JUb3BQYWRkaW5nOiB0cnVlIH0pO1xuXHRcdH07XG5cblx0XHRjb25zdCBkZWNvcmF0aW9uQ2hlY2tTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRjb25zdCBvbkRpZEFkZERlY29yYXRpb25UeXBlID0gKGU6IHN0cmluZykgPT4ge1xuXHRcdFx0aWYgKGRlY29yYXRpb25UcmlnZ2VyZWRBZGp1c3RtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGRlY29yYXRpb25DaGVja1NldC5oYXMoZSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5jb2RlRWRpdG9yU2VydmljZS5yZXNvbHZlRGVjb3JhdGlvbk9wdGlvbnMoZSwgdHJ1ZSk7XG5cdFx0XHRcdGlmIChvcHRpb25zLmFmdGVyQ29udGVudENsYXNzTmFtZSB8fCBvcHRpb25zLmJlZm9yZUNvbnRlbnRDbGFzc05hbWUpIHtcblx0XHRcdFx0XHRjb25zdCBjc3NSdWxlcyA9IHRoaXMuY29kZUVkaXRvclNlcnZpY2UucmVzb2x2ZURlY29yYXRpb25DU1NSdWxlcyhlKTtcblx0XHRcdFx0XHRpZiAoY3NzUnVsZXMgIT09IG51bGwpIHtcblx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY3NzUnVsZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0Ly8gVGhlIGZvbGxvd2luZyB3YXlzIHRvIGluZGV4IGludG8gdGhlIGxpc3QgYXJlIGVxdWl2YWxlbnRcblx0XHRcdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0XHRcdCgoY3NzUnVsZXNbaV0gYXMgQ1NTU3R5bGVSdWxlKS5zZWxlY3RvclRleHQuZW5kc1dpdGgoJzo6YWZ0ZXInKSB8fCAoY3NzUnVsZXNbaV0gYXMgQ1NTU3R5bGVSdWxlKS5zZWxlY3RvclRleHQuZW5kc1dpdGgoJzo6YWZ0ZXInKSlcblx0XHRcdFx0XHRcdFx0XHQmJiAoY3NzUnVsZXNbaV0gYXMgQ1NTU3R5bGVSdWxlKS5jc3NUZXh0LmluZGV4T2YoJ3RvcDonKSA+IC0xXG5cdFx0XHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIHRoZXJlIGlzIGEgYDo6YmVmb3JlYCBvciBgOjphZnRlcmAgdGV4dCBkZWNvcmF0aW9uIHdob3NlIHBvc2l0aW9uIGlzIGFib3ZlIG9yIGJlbG93IGN1cnJlbnQgbGluZVxuXHRcdFx0XHRcdFx0XHRcdC8vIHdlIGF0IGxlYXN0IG1ha2Ugc3VyZSB0aGF0IHRoZSBlZGl0b3IgdG9wIHBhZGRpbmcgaXMgYXQgbGVhc3Qgb25lIGxpbmVcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBlZGl0b3JPcHRpb25zID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRWRpdG9yT3B0aW9ucz4oJ2VkaXRvcicpO1xuXHRcdFx0XHRcdFx0XHRcdHVwZGF0ZUVkaXRvclRvcFBhZGRpbmcoQmFyZUZvbnRJbmZvLmNyZWF0ZUZyb21SYXdTZXR0aW5ncyhlZGl0b3JPcHRpb25zLCBQaXhlbFJhdGlvLmdldEluc3RhbmNlKHRoaXMudGFyZ2V0V2luZG93KS52YWx1ZSkubGluZUhlaWdodCArIDIpO1xuXHRcdFx0XHRcdFx0XHRcdGRlY29yYXRpb25UcmlnZ2VyZWRBZGp1c3RtZW50ID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRlY29yYXRpb25DaGVja1NldC5hZGQoZSk7XG5cdFx0XHR9IGNhdGNoIChfZXgpIHtcblx0XHRcdFx0Ly8gZG8gbm90IHRocm93IGFuZCBicmVhayBub3RlYm9va1xuXHRcdFx0fVxuXG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLm9uRGVjb3JhdGlvblR5cGVSZWdpc3RlcmVkKG9uRGlkQWRkRGVjb3JhdGlvblR5cGUpKTtcblx0XHR0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLmxpc3REZWNvcmF0aW9uVHlwZXMoKS5mb3JFYWNoKG9uRGlkQWRkRGVjb3JhdGlvblR5cGUpO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvclRvcFBhZGRpbmc7XG5cdH1cblxuXHRwcml2YXRlIF9taWdyYXRlRGVwcmVjYXRlZFNldHRpbmcoZGVwcmVjYXRlZEtleTogc3RyaW5nLCBrZXk6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGRlcHJlY2F0ZWRTZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KGRlcHJlY2F0ZWRLZXkpO1xuXG5cdFx0aWYgKGRlcHJlY2F0ZWRTZXR0aW5nLmFwcGxpY2F0aW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoZGVwcmVjYXRlZEtleSwgdW5kZWZpbmVkLCBDb25maWd1cmF0aW9uVGFyZ2V0LkFQUExJQ0FUSU9OKTtcblx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoa2V5LCBkZXByZWNhdGVkU2V0dGluZy5hcHBsaWNhdGlvbi52YWx1ZSwgQ29uZmlndXJhdGlvblRhcmdldC5BUFBMSUNBVElPTik7XG5cdFx0fVxuXG5cdFx0aWYgKGRlcHJlY2F0ZWRTZXR0aW5nLnVzZXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShkZXByZWNhdGVkS2V5LCB1bmRlZmluZWQsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGtleSwgZGVwcmVjYXRlZFNldHRpbmcudXNlci52YWx1ZSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblx0XHR9XG5cblx0XHRpZiAoZGVwcmVjYXRlZFNldHRpbmcudXNlckxvY2FsICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoZGVwcmVjYXRlZEtleSwgdW5kZWZpbmVkLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwpO1xuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShrZXksIGRlcHJlY2F0ZWRTZXR0aW5nLnVzZXJMb2NhbC52YWx1ZSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKTtcblx0XHR9XG5cblx0XHRpZiAoZGVwcmVjYXRlZFNldHRpbmcudXNlclJlbW90ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGRlcHJlY2F0ZWRLZXksIHVuZGVmaW5lZCwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URSk7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGtleSwgZGVwcmVjYXRlZFNldHRpbmcudXNlclJlbW90ZS52YWx1ZSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URSk7XG5cdFx0fVxuXG5cdFx0aWYgKGRlcHJlY2F0ZWRTZXR0aW5nLndvcmtzcGFjZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGRlcHJlY2F0ZWRLZXksIHVuZGVmaW5lZCwgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UpO1xuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShrZXksIGRlcHJlY2F0ZWRTZXR0aW5nLndvcmtzcGFjZS52YWx1ZSwgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UpO1xuXHRcdH1cblxuXHRcdGlmIChkZXByZWNhdGVkU2V0dGluZy53b3Jrc3BhY2VGb2xkZXIgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShkZXByZWNhdGVkS2V5LCB1bmRlZmluZWQsIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUik7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGtleSwgZGVwcmVjYXRlZFNldHRpbmcud29ya3NwYWNlRm9sZGVyLnZhbHVlLCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NvbXB1dGVPdXRwdXRMaW5lSGVpZ2h0KGxpbmVIZWlnaHQ6IG51bWJlciwgb3V0cHV0Rm9udFNpemU6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgbWluaW11bUxpbmVIZWlnaHQgPSA5O1xuXG5cdFx0aWYgKGxpbmVIZWlnaHQgPT09IDApIHtcblx0XHRcdC8vIHVzZSBlZGl0b3IgbGluZSBoZWlnaHRcblx0XHRcdGNvbnN0IGVkaXRvck9wdGlvbnMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JPcHRpb25zPignZWRpdG9yJyk7XG5cdFx0XHRjb25zdCBmb250SW5mbyA9IEZvbnRNZWFzdXJlbWVudHMucmVhZEZvbnRJbmZvKHRoaXMudGFyZ2V0V2luZG93LCBCYXJlRm9udEluZm8uY3JlYXRlRnJvbVJhd1NldHRpbmdzKGVkaXRvck9wdGlvbnMsIFBpeGVsUmF0aW8uZ2V0SW5zdGFuY2UodGhpcy50YXJnZXRXaW5kb3cpLnZhbHVlKSk7XG5cdFx0XHRsaW5lSGVpZ2h0ID0gZm9udEluZm8ubGluZUhlaWdodDtcblx0XHR9IGVsc2UgaWYgKGxpbmVIZWlnaHQgPCBtaW5pbXVtTGluZUhlaWdodCkge1xuXHRcdFx0Ly8gVmFsdWVzIHRvbyBzbWFsbCB0byBiZSBsaW5lIGhlaWdodHMgaW4gcGl4ZWxzIGFyZSBpbiBlbXMuXG5cdFx0XHRsZXQgZm9udFNpemUgPSBvdXRwdXRGb250U2l6ZTtcblx0XHRcdGlmIChmb250U2l6ZSA9PT0gMCkge1xuXHRcdFx0XHRmb250U2l6ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignZWRpdG9yLmZvbnRTaXplJyk7XG5cdFx0XHR9XG5cblx0XHRcdGxpbmVIZWlnaHQgPSBsaW5lSGVpZ2h0ICogZm9udFNpemU7XG5cdFx0fVxuXG5cdFx0Ly8gRW5mb3JjZSBpbnRlZ2VyLCBtaW5pbXVtIGNvbnN0cmFpbnRzXG5cdFx0bGluZUhlaWdodCA9IE1hdGgucm91bmQobGluZUhlaWdodCk7XG5cdFx0aWYgKGxpbmVIZWlnaHQgPCBtaW5pbXVtTGluZUhlaWdodCkge1xuXHRcdFx0bGluZUhlaWdodCA9IG1pbmltdW1MaW5lSGVpZ2h0O1xuXHRcdH1cblxuXHRcdHJldHVybiBsaW5lSGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlQ29uZmlndXJhdGlvbihlOiBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50KSB7XG5cdFx0Y29uc3QgY2VsbFN0YXR1c0JhclZpc2liaWxpdHkgPSBlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5zaG93Q2VsbFN0YXR1c0Jhcik7XG5cdFx0Y29uc3QgY2VsbFRvb2xiYXJMb2NhdGlvbiA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLmNlbGxUb29sYmFyTG9jYXRpb24pO1xuXHRcdGNvbnN0IGNlbGxUb29sYmFySW50ZXJhY3Rpb24gPSBlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5jZWxsVG9vbGJhclZpc2liaWxpdHkpO1xuXHRcdGNvbnN0IGNvbXBhY3RWaWV3ID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuY29tcGFjdFZpZXcpO1xuXHRcdGNvbnN0IGZvY3VzSW5kaWNhdG9yID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuZm9jdXNJbmRpY2F0b3IpO1xuXHRcdGNvbnN0IGluc2VydFRvb2xiYXJQb3NpdGlvbiA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLmluc2VydFRvb2xiYXJMb2NhdGlvbik7XG5cdFx0Y29uc3QgaW5zZXJ0VG9vbGJhckFsaWdubWVudCA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLmV4cGVyaW1lbnRhbEluc2VydFRvb2xiYXJBbGlnbm1lbnQpO1xuXHRcdGNvbnN0IGdsb2JhbFRvb2xiYXIgPSBlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5nbG9iYWxUb29sYmFyKTtcblx0XHRjb25zdCBzdGlja3lTY3JvbGxFbmFibGVkID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuc3RpY2t5U2Nyb2xsRW5hYmxlZCk7XG5cdFx0Y29uc3Qgc3RpY2t5U2Nyb2xsTW9kZSA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLnN0aWNreVNjcm9sbE1vZGUpO1xuXHRcdGNvbnN0IGNvbnNvbGlkYXRlZE91dHB1dEJ1dHRvbiA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLmNvbnNvbGlkYXRlZE91dHB1dEJ1dHRvbik7XG5cdFx0Y29uc3QgY29uc29saWRhdGVkUnVuQnV0dG9uID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuY29uc29saWRhdGVkUnVuQnV0dG9uKTtcblx0XHRjb25zdCBzaG93Rm9sZGluZ0NvbnRyb2xzID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuc2hvd0ZvbGRpbmdDb250cm9scyk7XG5cdFx0Y29uc3QgZHJhZ0FuZERyb3BFbmFibGVkID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuZHJhZ0FuZERyb3BFbmFibGVkKTtcblx0XHRjb25zdCBmb250U2l6ZSA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5mb250U2l6ZScpO1xuXHRcdGNvbnN0IG91dHB1dEZvbnRTaXplID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcub3V0cHV0Rm9udFNpemUpO1xuXHRcdGNvbnN0IG1hcmt1cEZvbnRTaXplID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcubWFya3VwRm9udFNpemUpO1xuXHRcdGNvbnN0IG1hcmtkb3duTGluZUhlaWdodCA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLm1hcmtkb3duTGluZUhlaWdodCk7XG5cdFx0Y29uc3QgZm9udEZhbWlseSA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5mb250RmFtaWx5Jyk7XG5cdFx0Y29uc3Qgb3V0cHV0Rm9udEZhbWlseSA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLm91dHB1dEZvbnRGYW1pbHkpO1xuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnNDdXN0b21pemF0aW9ucyA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLmNlbGxFZGl0b3JPcHRpb25zQ3VzdG9taXphdGlvbnMpO1xuXHRcdGNvbnN0IGludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHMgPSBlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5pbnRlcmFjdGl2ZVdpbmRvd0NvbGxhcHNlQ29kZUNlbGxzKTtcblx0XHRjb25zdCBvdXRwdXRMaW5lSGVpZ2h0ID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcub3V0cHV0TGluZUhlaWdodCk7XG5cdFx0Y29uc3Qgb3V0cHV0U2Nyb2xsaW5nID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcub3V0cHV0U2Nyb2xsaW5nKTtcblx0XHRjb25zdCBvdXRwdXRXb3JkV3JhcCA9IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLm91dHB1dFdvcmRXcmFwKTtcblx0XHRjb25zdCBvdXRwdXRMaW5raWZ5RmlsZVBhdGhzID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuTGlua2lmeU91dHB1dEZpbGVQYXRocyk7XG5cdFx0Y29uc3QgbWluaW1hbEVycm9yID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcubWluaW1hbEVycm9yUmVuZGVyaW5nKTtcblx0XHRjb25zdCBtYXJrdXBGb250RmFtaWx5ID0gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcubWFya3VwRm9udEZhbWlseSk7XG5cblx0XHRpZiAoXG5cdFx0XHQhY2VsbFN0YXR1c0JhclZpc2liaWxpdHlcblx0XHRcdCYmICFjZWxsVG9vbGJhckxvY2F0aW9uXG5cdFx0XHQmJiAhY2VsbFRvb2xiYXJJbnRlcmFjdGlvblxuXHRcdFx0JiYgIWNvbXBhY3RWaWV3XG5cdFx0XHQmJiAhZm9jdXNJbmRpY2F0b3Jcblx0XHRcdCYmICFpbnNlcnRUb29sYmFyUG9zaXRpb25cblx0XHRcdCYmICFpbnNlcnRUb29sYmFyQWxpZ25tZW50XG5cdFx0XHQmJiAhZ2xvYmFsVG9vbGJhclxuXHRcdFx0JiYgIXN0aWNreVNjcm9sbEVuYWJsZWRcblx0XHRcdCYmICFzdGlja3lTY3JvbGxNb2RlXG5cdFx0XHQmJiAhY29uc29saWRhdGVkT3V0cHV0QnV0dG9uXG5cdFx0XHQmJiAhY29uc29saWRhdGVkUnVuQnV0dG9uXG5cdFx0XHQmJiAhc2hvd0ZvbGRpbmdDb250cm9sc1xuXHRcdFx0JiYgIWRyYWdBbmREcm9wRW5hYmxlZFxuXHRcdFx0JiYgIWZvbnRTaXplXG5cdFx0XHQmJiAhb3V0cHV0Rm9udFNpemVcblx0XHRcdCYmICFtYXJrdXBGb250U2l6ZVxuXHRcdFx0JiYgIW1hcmtkb3duTGluZUhlaWdodFxuXHRcdFx0JiYgIWZvbnRGYW1pbHlcblx0XHRcdCYmICFvdXRwdXRGb250RmFtaWx5XG5cdFx0XHQmJiAhZWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25zXG5cdFx0XHQmJiAhaW50ZXJhY3RpdmVXaW5kb3dDb2xsYXBzZUNvZGVDZWxsc1xuXHRcdFx0JiYgIW91dHB1dExpbmVIZWlnaHRcblx0XHRcdCYmICFvdXRwdXRTY3JvbGxpbmdcblx0XHRcdCYmICFvdXRwdXRXb3JkV3JhcFxuXHRcdFx0JiYgIW91dHB1dExpbmtpZnlGaWxlUGF0aHNcblx0XHRcdCYmICFtaW5pbWFsRXJyb3Jcblx0XHRcdCYmICFtYXJrdXBGb250RmFtaWx5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGNvbmZpZ3VyYXRpb24gPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uKTtcblxuXHRcdGlmIChjZWxsU3RhdHVzQmFyVmlzaWJpbGl0eSkge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5zaG93Q2VsbFN0YXR1c0JhciA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8U2hvd0NlbGxTdGF0dXNCYXJUeXBlPihOb3RlYm9va1NldHRpbmcuc2hvd0NlbGxTdGF0dXNCYXIpO1xuXHRcdH1cblxuXHRcdGlmIChjZWxsVG9vbGJhckxvY2F0aW9uKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLmNlbGxUb29sYmFyTG9jYXRpb24gPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHN0cmluZyB8IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0+KE5vdGVib29rU2V0dGluZy5jZWxsVG9vbGJhckxvY2F0aW9uKSA/PyB7ICdkZWZhdWx0JzogJ3JpZ2h0JyB9O1xuXHRcdH1cblxuXHRcdGlmIChjZWxsVG9vbGJhckludGVyYWN0aW9uICYmICF0aGlzLm92ZXJyaWRlcz8uY2VsbFRvb2xiYXJJbnRlcmFjdGlvbikge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5jZWxsVG9vbGJhckludGVyYWN0aW9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KE5vdGVib29rU2V0dGluZy5jZWxsVG9vbGJhclZpc2liaWxpdHkpO1xuXHRcdH1cblxuXHRcdGlmIChmb2N1c0luZGljYXRvcikge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5mb2N1c0luZGljYXRvciA9IHRoaXMuX2NvbXB1dGVGb2N1c0luZGljYXRvck9wdGlvbigpO1xuXHRcdH1cblxuXHRcdGlmIChjb21wYWN0Vmlldykge1xuXHRcdFx0Y29uc3QgY29tcGFjdFZpZXdWYWx1ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbiB8IHVuZGVmaW5lZD4oTm90ZWJvb2tTZXR0aW5nLmNvbXBhY3RWaWV3KSA/PyB0cnVlO1xuXHRcdFx0Y29uZmlndXJhdGlvbiA9IE9iamVjdC5hc3NpZ24oY29uZmlndXJhdGlvbiwge1xuXHRcdFx0XHQuLi4oY29tcGFjdFZpZXdWYWx1ZSA/IGNvbXBhY3RDb25maWdDb25zdGFudHMgOiBkZWZhdWx0Q29uZmlnQ29uc3RhbnRzKSxcblx0XHRcdH0pO1xuXHRcdFx0Y29uZmlndXJhdGlvbi5jb21wYWN0VmlldyA9IGNvbXBhY3RWaWV3VmFsdWU7XG5cdFx0fVxuXG5cdFx0aWYgKGluc2VydFRvb2xiYXJBbGlnbm1lbnQpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24uaW5zZXJ0VG9vbGJhckFsaWdubWVudCA9IHRoaXMuX2NvbXB1dGVJbnNlcnRUb29sYmFyQWxpZ25tZW50T3B0aW9uKCk7XG5cdFx0fVxuXG5cdFx0aWYgKGluc2VydFRvb2xiYXJQb3NpdGlvbikge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5pbnNlcnRUb29sYmFyUG9zaXRpb24gPSB0aGlzLl9jb21wdXRlSW5zZXJ0VG9vbGJhclBvc2l0aW9uT3B0aW9uKHRoaXMuaXNSZWFkb25seSk7XG5cdFx0fVxuXG5cdFx0aWYgKGdsb2JhbFRvb2xiYXIgJiYgdGhpcy5vdmVycmlkZXM/Lmdsb2JhbFRvb2xiYXIgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5nbG9iYWxUb29sYmFyID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcuZ2xvYmFsVG9vbGJhcikgPz8gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAoc3RpY2t5U2Nyb2xsRW5hYmxlZCAmJiB0aGlzLm92ZXJyaWRlcz8uc3RpY2t5U2Nyb2xsRW5hYmxlZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLnN0aWNreVNjcm9sbEVuYWJsZWQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5zdGlja3lTY3JvbGxFbmFibGVkKSA/PyBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoc3RpY2t5U2Nyb2xsTW9kZSkge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5zdGlja3lTY3JvbGxNb2RlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnZmxhdCcgfCAnaW5kZW50ZWQnPihOb3RlYm9va1NldHRpbmcuc3RpY2t5U2Nyb2xsTW9kZSkgPz8gJ2ZsYXQnO1xuXHRcdH1cblxuXHRcdGlmIChjb25zb2xpZGF0ZWRPdXRwdXRCdXR0b24pIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24uY29uc29saWRhdGVkT3V0cHV0QnV0dG9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcuY29uc29saWRhdGVkT3V0cHV0QnV0dG9uKSA/PyB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChjb25zb2xpZGF0ZWRSdW5CdXR0b24pIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24uY29uc29saWRhdGVkUnVuQnV0dG9uID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcuY29uc29saWRhdGVkUnVuQnV0dG9uKSA/PyB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChzaG93Rm9sZGluZ0NvbnRyb2xzKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLnNob3dGb2xkaW5nQ29udHJvbHMgPSB0aGlzLl9jb21wdXRlU2hvd0ZvbGRpbmdDb250cm9sc09wdGlvbigpO1xuXHRcdH1cblxuXHRcdGlmIChkcmFnQW5kRHJvcEVuYWJsZWQpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24uZHJhZ0FuZERyb3BFbmFibGVkID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcuZHJhZ0FuZERyb3BFbmFibGVkKSA/PyB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChmb250U2l6ZSkge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5mb250U2l6ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignZWRpdG9yLmZvbnRTaXplJyk7XG5cdFx0fVxuXG5cdFx0aWYgKG91dHB1dEZvbnRTaXplIHx8IGZvbnRTaXplKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLm91dHB1dEZvbnRTaXplID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KE5vdGVib29rU2V0dGluZy5vdXRwdXRGb250U2l6ZSkgfHwgY29uZmlndXJhdGlvbi5mb250U2l6ZTtcblx0XHR9XG5cblx0XHRpZiAobWFya3VwRm9udFNpemUpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24ubWFya3VwRm9udFNpemUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oTm90ZWJvb2tTZXR0aW5nLm1hcmt1cEZvbnRTaXplKTtcblx0XHR9XG5cblx0XHRpZiAobWFya2Rvd25MaW5lSGVpZ2h0KSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLm1hcmtkb3duTGluZUhlaWdodCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihOb3RlYm9va1NldHRpbmcubWFya2Rvd25MaW5lSGVpZ2h0KTtcblx0XHR9XG5cblx0XHRpZiAob3V0cHV0Rm9udEZhbWlseSkge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5vdXRwdXRGb250RmFtaWx5ID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KE5vdGVib29rU2V0dGluZy5vdXRwdXRGb250RmFtaWx5KTtcblx0XHR9XG5cblx0XHRpZiAoZWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25zKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLmVkaXRvck9wdGlvbnNDdXN0b21pemF0aW9ucyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoTm90ZWJvb2tTZXR0aW5nLmNlbGxFZGl0b3JPcHRpb25zQ3VzdG9taXphdGlvbnMpO1xuXHRcdH1cblxuXHRcdGlmIChpbnRlcmFjdGl2ZVdpbmRvd0NvbGxhcHNlQ29kZUNlbGxzKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLmludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKE5vdGVib29rU2V0dGluZy5pbnRlcmFjdGl2ZVdpbmRvd0NvbGxhcHNlQ29kZUNlbGxzKTtcblx0XHR9XG5cblx0XHRpZiAob3V0cHV0TGluZUhlaWdodCB8fCBmb250U2l6ZSB8fCBvdXRwdXRGb250U2l6ZSkge1xuXHRcdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihOb3RlYm9va1NldHRpbmcub3V0cHV0TGluZUhlaWdodCk7XG5cdFx0XHRjb25maWd1cmF0aW9uLm91dHB1dExpbmVIZWlnaHQgPSB0aGlzLl9jb21wdXRlT3V0cHV0TGluZUhlaWdodChsaW5lSGVpZ2h0LCBjb25maWd1cmF0aW9uLm91dHB1dEZvbnRTaXplKTtcblx0XHR9XG5cblx0XHRpZiAob3V0cHV0V29yZFdyYXApIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24ub3V0cHV0V29yZFdyYXAgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5vdXRwdXRXb3JkV3JhcCk7XG5cdFx0fVxuXG5cdFx0aWYgKG91dHB1dFNjcm9sbGluZykge1xuXHRcdFx0Y29uZmlndXJhdGlvbi5vdXRwdXRTY3JvbGxpbmcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5vdXRwdXRTY3JvbGxpbmcpO1xuXHRcdH1cblxuXHRcdGlmIChvdXRwdXRMaW5raWZ5RmlsZVBhdGhzKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLm91dHB1dExpbmtpZnlGaWxlUGF0aHMgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5MaW5raWZ5T3V0cHV0RmlsZVBhdGhzKTtcblx0XHR9XG5cblx0XHRpZiAobWluaW1hbEVycm9yKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLm91dHB1dE1pbmltYWxFcnJvciA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLm1pbmltYWxFcnJvclJlbmRlcmluZyk7XG5cdFx0fVxuXG5cdFx0aWYgKG1hcmt1cEZvbnRGYW1pbHkpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24ubWFya3VwRm9udEZhbWlseSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8c3RyaW5nPihOb3RlYm9va1NldHRpbmcubWFya3VwRm9udEZhbWlseSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbiA9IE9iamVjdC5mcmVlemUoY29uZmlndXJhdGlvbik7XG5cblx0XHQvLyB0cmlnZ2VyIGV2ZW50XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VPcHRpb25zLmZpcmUoe1xuXHRcdFx0Y2VsbFN0YXR1c0JhclZpc2liaWxpdHksXG5cdFx0XHRjZWxsVG9vbGJhckxvY2F0aW9uLFxuXHRcdFx0Y2VsbFRvb2xiYXJJbnRlcmFjdGlvbixcblx0XHRcdGNvbXBhY3RWaWV3LFxuXHRcdFx0Zm9jdXNJbmRpY2F0b3IsXG5cdFx0XHRpbnNlcnRUb29sYmFyUG9zaXRpb24sXG5cdFx0XHRpbnNlcnRUb29sYmFyQWxpZ25tZW50LFxuXHRcdFx0Z2xvYmFsVG9vbGJhcixcblx0XHRcdHN0aWNreVNjcm9sbEVuYWJsZWQsXG5cdFx0XHRzdGlja3lTY3JvbGxNb2RlLFxuXHRcdFx0c2hvd0ZvbGRpbmdDb250cm9scyxcblx0XHRcdGNvbnNvbGlkYXRlZE91dHB1dEJ1dHRvbixcblx0XHRcdGNvbnNvbGlkYXRlZFJ1bkJ1dHRvbixcblx0XHRcdGRyYWdBbmREcm9wRW5hYmxlZCxcblx0XHRcdGZvbnRTaXplLFxuXHRcdFx0b3V0cHV0Rm9udFNpemUsXG5cdFx0XHRtYXJrdXBGb250U2l6ZSxcblx0XHRcdG1hcmtkb3duTGluZUhlaWdodCxcblx0XHRcdGZvbnRGYW1pbHksXG5cdFx0XHRvdXRwdXRGb250RmFtaWx5LFxuXHRcdFx0ZWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25zLFxuXHRcdFx0aW50ZXJhY3RpdmVXaW5kb3dDb2xsYXBzZUNvZGVDZWxscyxcblx0XHRcdG91dHB1dExpbmVIZWlnaHQsXG5cdFx0XHRvdXRwdXRTY3JvbGxpbmcsXG5cdFx0XHRvdXRwdXRXb3JkV3JhcCxcblx0XHRcdG91dHB1dExpbmtpZnlGaWxlUGF0aHMsXG5cdFx0XHRtaW5pbWFsRXJyb3IsXG5cdFx0XHRtYXJrdXBGb250RmFtaWx5XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9jb21wdXRlSW5zZXJ0VG9vbGJhclBvc2l0aW9uT3B0aW9uKGlzUmVhZE9ubHk6IGJvb2xlYW4pIHtcblx0XHRyZXR1cm4gaXNSZWFkT25seSA/ICdoaWRkZW4nIDogdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnYmV0d2VlbkNlbGxzJyB8ICdub3RlYm9va1Rvb2xiYXInIHwgJ2JvdGgnIHwgJ2hpZGRlbic+KE5vdGVib29rU2V0dGluZy5pbnNlcnRUb29sYmFyTG9jYXRpb24pID8/ICdib3RoJztcblx0fVxuXG5cdHByaXZhdGUgX2NvbXB1dGVJbnNlcnRUb29sYmFyQWxpZ25tZW50T3B0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdsZWZ0JyB8ICdjZW50ZXInPihOb3RlYm9va1NldHRpbmcuZXhwZXJpbWVudGFsSW5zZXJ0VG9vbGJhckFsaWdubWVudCkgPz8gJ2NlbnRlcic7XG5cdH1cblxuXHRwcml2YXRlIF9jb21wdXRlU2hvd0ZvbGRpbmdDb250cm9sc09wdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnYWx3YXlzJyB8ICduZXZlcicgfCAnbW91c2VvdmVyJz4oTm90ZWJvb2tTZXR0aW5nLnNob3dGb2xkaW5nQ29udHJvbHMpID8/ICdtb3VzZW92ZXInO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZUZvY3VzSW5kaWNhdG9yT3B0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdib3JkZXInIHwgJ2d1dHRlcic+KE5vdGVib29rU2V0dGluZy5mb2N1c0luZGljYXRvcikgPz8gJ2d1dHRlcic7XG5cdH1cblxuXHRwcml2YXRlIF9jb21wdXRlU3RpY2t5U2Nyb2xsTW9kZU9wdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnZmxhdCcgfCAnaW5kZW50ZWQnPihOb3RlYm9va1NldHRpbmcuc3RpY2t5U2Nyb2xsTW9kZSkgPz8gJ2ZsYXQnO1xuXHR9XG5cblx0Z2V0Q2VsbENvbGxhcHNlRGVmYXVsdCgpOiBOb3RlYm9va0NlbGxEZWZhdWx0Q29sbGFwc2VDb25maWcge1xuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLmludGVyYWN0aXZlV2luZG93Q29sbGFwc2VDb2RlQ2VsbHMgPT09ICduZXZlcicgP1xuXHRcdFx0e1xuXHRcdFx0XHRjb2RlQ2VsbDoge1xuXHRcdFx0XHRcdGlucHV0Q29sbGFwc2VkOiBmYWxzZVxuXHRcdFx0XHR9XG5cdFx0XHR9IDoge1xuXHRcdFx0XHRjb2RlQ2VsbDoge1xuXHRcdFx0XHRcdGlucHV0Q29sbGFwc2VkOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdH1cblxuXHRnZXRMYXlvdXRDb25maWd1cmF0aW9uKCk6IE5vdGVib29rTGF5b3V0Q29uZmlndXJhdGlvbiAmIE5vdGVib29rRGlzcGxheU9wdGlvbnMge1xuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0Z2V0RGlzcGxheU9wdGlvbnMoKTogTm90ZWJvb2tEaXNwbGF5T3B0aW9ucyB7XG5cdFx0cmV0dXJuIHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb247XG5cdH1cblxuXHRnZXRDZWxsRWRpdG9yQ29udGFpbmVyTGVmdE1hcmdpbigpIHtcblx0XHRjb25zdCB7XG5cdFx0XHRjb2RlQ2VsbExlZnRNYXJnaW4sXG5cdFx0XHRjZWxsUnVuR3V0dGVyXG5cdFx0fSA9IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb247XG5cdFx0cmV0dXJuIGNvZGVDZWxsTGVmdE1hcmdpbiArIGNlbGxSdW5HdXR0ZXI7XG5cdH1cblxuXHRjb21wdXRlQ29sbGFwc2VkTWFya2Rvd25DZWxsSGVpZ2h0KHZpZXdUeXBlOiBzdHJpbmcpOiBudW1iZXIge1xuXHRcdGNvbnN0IHsgYm90dG9tVG9vbGJhckdhcCB9ID0gdGhpcy5jb21wdXRlQm90dG9tVG9vbGJhckRpbWVuc2lvbnModmlld1R5cGUpO1xuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm1hcmtkb3duQ2VsbFRvcE1hcmdpblxuXHRcdFx0KyB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLmNvbGxhcHNlZEluZGljYXRvckhlaWdodFxuXHRcdFx0KyBib3R0b21Ub29sYmFyR2FwXG5cdFx0XHQrIHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ubWFya2Rvd25DZWxsQm90dG9tTWFyZ2luO1xuXHR9XG5cblx0Y29tcHV0ZUJvdHRvbVRvb2xiYXJPZmZzZXQodG90YWxIZWlnaHQ6IG51bWJlciwgdmlld1R5cGU6IHN0cmluZykge1xuXHRcdGNvbnN0IHsgYm90dG9tVG9vbGJhckdhcCwgYm90dG9tVG9vbGJhckhlaWdodCB9ID0gdGhpcy5jb21wdXRlQm90dG9tVG9vbGJhckRpbWVuc2lvbnModmlld1R5cGUpO1xuXG5cdFx0cmV0dXJuIHRvdGFsSGVpZ2h0XG5cdFx0XHQtIGJvdHRvbVRvb2xiYXJHYXBcblx0XHRcdC0gYm90dG9tVG9vbGJhckhlaWdodCAvIDI7XG5cdH1cblxuXHRjb21wdXRlQ29kZUNlbGxFZGl0b3JXaWR0aChvdXRlcldpZHRoOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiBvdXRlcldpZHRoIC0gKFxuXHRcdFx0dGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5jb2RlQ2VsbExlZnRNYXJnaW5cblx0XHRcdCsgdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5jZWxsUnVuR3V0dGVyXG5cdFx0XHQrIHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24uY2VsbFJpZ2h0TWFyZ2luXG5cdFx0KTtcblx0fVxuXG5cdGNvbXB1dGVNYXJrZG93bkNlbGxFZGl0b3JXaWR0aChvdXRlcldpZHRoOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiBvdXRlcldpZHRoXG5cdFx0XHQtIHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ubWFya2Rvd25DZWxsR3V0dGVyXG5cdFx0XHQtIHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ubWFya2Rvd25DZWxsTGVmdE1hcmdpblxuXHRcdFx0LSB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLmNlbGxSaWdodE1hcmdpbjtcblx0fVxuXG5cdGNvbXB1dGVTdGF0dXNCYXJIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5jZWxsU3RhdHVzQmFySGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZUJvdHRvbVRvb2xiYXJEaW1lbnNpb25zKGNvbXBhY3RWaWV3OiBib29sZWFuLCBpbnNlcnRUb29sYmFyUG9zaXRpb246ICdiZXR3ZWVuQ2VsbHMnIHwgJ25vdGVib29rVG9vbGJhcicgfCAnYm90aCcgfCAnaGlkZGVuJywgaW5zZXJ0VG9vbGJhckFsaWdubWVudDogJ2xlZnQnIHwgJ2NlbnRlcicsIGNlbGxUb29sYmFyOiAncmlnaHQnIHwgJ2xlZnQnIHwgJ2hpZGRlbicpOiB7IGJvdHRvbVRvb2xiYXJHYXA6IG51bWJlcjsgYm90dG9tVG9vbGJhckhlaWdodDogbnVtYmVyIH0ge1xuXHRcdGlmIChpbnNlcnRUb29sYmFyQWxpZ25tZW50ID09PSAnbGVmdCcgfHwgY2VsbFRvb2xiYXIgIT09ICdoaWRkZW4nKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRib3R0b21Ub29sYmFyR2FwOiAxOCxcblx0XHRcdFx0Ym90dG9tVG9vbGJhckhlaWdodDogMThcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGluc2VydFRvb2xiYXJQb3NpdGlvbiA9PT0gJ2JldHdlZW5DZWxscycgfHwgaW5zZXJ0VG9vbGJhclBvc2l0aW9uID09PSAnYm90aCcpIHtcblx0XHRcdHJldHVybiBjb21wYWN0VmlldyA/IHtcblx0XHRcdFx0Ym90dG9tVG9vbGJhckdhcDogMTIsXG5cdFx0XHRcdGJvdHRvbVRvb2xiYXJIZWlnaHQ6IDIwXG5cdFx0XHR9IDoge1xuXHRcdFx0XHRib3R0b21Ub29sYmFyR2FwOiAyMCxcblx0XHRcdFx0Ym90dG9tVG9vbGJhckhlaWdodDogMjBcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGJvdHRvbVRvb2xiYXJHYXA6IDAsXG5cdFx0XHRcdGJvdHRvbVRvb2xiYXJIZWlnaHQ6IDBcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0Y29tcHV0ZUJvdHRvbVRvb2xiYXJEaW1lbnNpb25zKHZpZXdUeXBlPzogc3RyaW5nKTogeyBib3R0b21Ub29sYmFyR2FwOiBudW1iZXI7IGJvdHRvbVRvb2xiYXJIZWlnaHQ6IG51bWJlciB9IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0gdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbjtcblx0XHRjb25zdCBjZWxsVG9vbGJhclBvc2l0aW9uID0gdGhpcy5jb21wdXRlQ2VsbFRvb2xiYXJMb2NhdGlvbih2aWV3VHlwZSk7XG5cdFx0Y29uc3QgeyBib3R0b21Ub29sYmFyR2FwLCBib3R0b21Ub29sYmFySGVpZ2h0IH0gPSB0aGlzLl9jb21wdXRlQm90dG9tVG9vbGJhckRpbWVuc2lvbnMoY29uZmlndXJhdGlvbi5jb21wYWN0VmlldywgY29uZmlndXJhdGlvbi5pbnNlcnRUb29sYmFyUG9zaXRpb24sIGNvbmZpZ3VyYXRpb24uaW5zZXJ0VG9vbGJhckFsaWdubWVudCwgY2VsbFRvb2xiYXJQb3NpdGlvbik7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGJvdHRvbVRvb2xiYXJHYXAsXG5cdFx0XHRib3R0b21Ub29sYmFySGVpZ2h0XG5cdFx0fTtcblx0fVxuXG5cdGNvbXB1dGVDZWxsVG9vbGJhckxvY2F0aW9uKHZpZXdUeXBlPzogc3RyaW5nKTogJ3JpZ2h0JyB8ICdsZWZ0JyB8ICdoaWRkZW4nIHtcblx0XHRjb25zdCBjZWxsVG9vbGJhckxvY2F0aW9uID0gdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5jZWxsVG9vbGJhckxvY2F0aW9uO1xuXG5cdFx0aWYgKHR5cGVvZiBjZWxsVG9vbGJhckxvY2F0aW9uID09PSAnc3RyaW5nJykge1xuXHRcdFx0aWYgKGNlbGxUb29sYmFyTG9jYXRpb24gPT09ICdsZWZ0JyB8fCBjZWxsVG9vbGJhckxvY2F0aW9uID09PSAncmlnaHQnIHx8IGNlbGxUb29sYmFyTG9jYXRpb24gPT09ICdoaWRkZW4nKSB7XG5cdFx0XHRcdHJldHVybiBjZWxsVG9vbGJhckxvY2F0aW9uO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodmlld1R5cGUpIHtcblx0XHRcdFx0Y29uc3Qgbm90ZWJvb2tTcGVjaWZpY1NldHRpbmcgPSBjZWxsVG9vbGJhckxvY2F0aW9uW3ZpZXdUeXBlXSA/PyBjZWxsVG9vbGJhckxvY2F0aW9uWydkZWZhdWx0J107XG5cdFx0XHRcdGxldCBjZWxsVG9vbGJhckxvY2F0aW9uRm9yQ3VycmVudFZpZXc6ICdyaWdodCcgfCAnbGVmdCcgfCAnaGlkZGVuJyA9ICdyaWdodCc7XG5cblx0XHRcdFx0c3dpdGNoIChub3RlYm9va1NwZWNpZmljU2V0dGluZykge1xuXHRcdFx0XHRcdGNhc2UgJ2xlZnQnOlxuXHRcdFx0XHRcdFx0Y2VsbFRvb2xiYXJMb2NhdGlvbkZvckN1cnJlbnRWaWV3ID0gJ2xlZnQnO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAncmlnaHQnOlxuXHRcdFx0XHRcdFx0Y2VsbFRvb2xiYXJMb2NhdGlvbkZvckN1cnJlbnRWaWV3ID0gJ3JpZ2h0Jztcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ2hpZGRlbic6XG5cdFx0XHRcdFx0XHRjZWxsVG9vbGJhckxvY2F0aW9uRm9yQ3VycmVudFZpZXcgPSAnaGlkZGVuJztcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0XHRjZWxsVG9vbGJhckxvY2F0aW9uRm9yQ3VycmVudFZpZXcgPSAncmlnaHQnO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gY2VsbFRvb2xiYXJMb2NhdGlvbkZvckN1cnJlbnRWaWV3O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiAncmlnaHQnO1xuXHR9XG5cblx0Y29tcHV0ZVRvcEluc2VydFRvb2xiYXJIZWlnaHQodmlld1R5cGU/OiBzdHJpbmcpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLmluc2VydFRvb2xiYXJQb3NpdGlvbiA9PT0gJ2JldHdlZW5DZWxscycgfHwgdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5pbnNlcnRUb29sYmFyUG9zaXRpb24gPT09ICdib3RoJykge1xuXHRcdFx0cmV0dXJuIFNDUk9MTEFCTEVfRUxFTUVOVF9QQURESU5HX1RPUDtcblx0XHR9XG5cblx0XHRjb25zdCBjZWxsVG9vbGJhckxvY2F0aW9uID0gdGhpcy5jb21wdXRlQ2VsbFRvb2xiYXJMb2NhdGlvbih2aWV3VHlwZSk7XG5cblx0XHRpZiAoY2VsbFRvb2xiYXJMb2NhdGlvbiA9PT0gJ2xlZnQnIHx8IGNlbGxUb29sYmFyTG9jYXRpb24gPT09ICdyaWdodCcpIHtcblx0XHRcdHJldHVybiBTQ1JPTExBQkxFX0VMRU1FTlRfUEFERElOR19UT1A7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRjb21wdXRlRWRpdG9yUGFkZGluZyhpbnRlcm5hbE1ldGFkYXRhOiBOb3RlYm9va0NlbGxJbnRlcm5hbE1ldGFkYXRhLCBjZWxsVXJpOiBVUkkpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dG9wOiB0aGlzLl9lZGl0b3JUb3BQYWRkaW5nLFxuXHRcdFx0Ym90dG9tOiB0aGlzLnN0YXR1c0JhcklzVmlzaWJsZShpbnRlcm5hbE1ldGFkYXRhLCBjZWxsVXJpKVxuXHRcdFx0XHQ/IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24uZWRpdG9yQm90dG9tUGFkZGluZ1xuXHRcdFx0XHQ6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24uZWRpdG9yQm90dG9tUGFkZGluZ1dpdGhvdXRTdGF0dXNCYXJcblx0XHR9O1xuXHR9XG5cblxuXHRjb21wdXRlRWRpdG9yU3RhdHVzYmFySGVpZ2h0KGludGVybmFsTWV0YWRhdGE6IE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEsIGNlbGxVcmk6IFVSSSkge1xuXHRcdHJldHVybiB0aGlzLnN0YXR1c0JhcklzVmlzaWJsZShpbnRlcm5hbE1ldGFkYXRhLCBjZWxsVXJpKSA/IHRoaXMuY29tcHV0ZVN0YXR1c0JhckhlaWdodCgpIDogMDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdHVzQmFySXNWaXNpYmxlKGludGVybmFsTWV0YWRhdGE6IE5vdGVib29rQ2VsbEludGVybmFsTWV0YWRhdGEsIGNlbGxVcmk6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGV4ZSA9IHRoaXMubm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuZ2V0Q2VsbEV4ZWN1dGlvbihjZWxsVXJpKTtcblx0XHRpZiAodGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5zaG93Q2VsbFN0YXR1c0JhciA9PT0gJ3Zpc2libGUnKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24uc2hvd0NlbGxTdGF0dXNCYXIgPT09ICd2aXNpYmxlQWZ0ZXJFeGVjdXRlJykge1xuXHRcdFx0cmV0dXJuIHR5cGVvZiBpbnRlcm5hbE1ldGFkYXRhLmxhc3RSdW5TdWNjZXNzID09PSAnYm9vbGVhbicgfHwgZXhlICE9PSB1bmRlZmluZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRjb21wdXRlV2Vidmlld09wdGlvbnMoKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG91dHB1dE5vZGVQYWRkaW5nOiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLmNlbGxPdXRwdXRQYWRkaW5nLFxuXHRcdFx0b3V0cHV0Tm9kZUxlZnRQYWRkaW5nOiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLmNlbGxPdXRwdXRQYWRkaW5nLFxuXHRcdFx0cHJldmlld05vZGVQYWRkaW5nOiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm1hcmtkb3duUHJldmlld1BhZGRpbmcsXG5cdFx0XHRtYXJrZG93bkxlZnRNYXJnaW46IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ubWFya2Rvd25DZWxsR3V0dGVyICsgdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5tYXJrZG93bkNlbGxMZWZ0TWFyZ2luLFxuXHRcdFx0bGVmdE1hcmdpbjogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5jb2RlQ2VsbExlZnRNYXJnaW4sXG5cdFx0XHRyaWdodE1hcmdpbjogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5jZWxsUmlnaHRNYXJnaW4sXG5cdFx0XHRydW5HdXR0ZXI6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24uY2VsbFJ1bkd1dHRlcixcblx0XHRcdGRyYWdBbmREcm9wRW5hYmxlZDogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5kcmFnQW5kRHJvcEVuYWJsZWQsXG5cdFx0XHRmb250U2l6ZTogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5mb250U2l6ZSxcblx0XHRcdG91dHB1dEZvbnRTaXplOiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm91dHB1dEZvbnRTaXplLFxuXHRcdFx0b3V0cHV0Rm9udEZhbWlseTogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5vdXRwdXRGb250RmFtaWx5LFxuXHRcdFx0bWFya3VwRm9udFNpemU6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ubWFya3VwRm9udFNpemUsXG5cdFx0XHRtYXJrZG93bkxpbmVIZWlnaHQ6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ubWFya2Rvd25MaW5lSGVpZ2h0LFxuXHRcdFx0b3V0cHV0TGluZUhlaWdodDogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5vdXRwdXRMaW5lSGVpZ2h0LFxuXHRcdFx0b3V0cHV0U2Nyb2xsaW5nOiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm91dHB1dFNjcm9sbGluZyxcblx0XHRcdG91dHB1dFdvcmRXcmFwOiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm91dHB1dFdvcmRXcmFwLFxuXHRcdFx0b3V0cHV0TGluZUxpbWl0OiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm91dHB1dExpbmVMaW1pdCxcblx0XHRcdG91dHB1dExpbmtpZnlGaWxlUGF0aHM6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ub3V0cHV0TGlua2lmeUZpbGVQYXRocyxcblx0XHRcdG1pbmltYWxFcnJvcjogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5vdXRwdXRNaW5pbWFsRXJyb3IsXG5cdFx0XHRtYXJrdXBGb250RmFtaWx5OiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm1hcmt1cEZvbnRGYW1pbHlcblx0XHR9O1xuXHR9XG5cblx0Y29tcHV0ZURpZmZXZWJ2aWV3T3B0aW9ucygpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0b3V0cHV0Tm9kZVBhZGRpbmc6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24uY2VsbE91dHB1dFBhZGRpbmcsXG5cdFx0XHRvdXRwdXROb2RlTGVmdFBhZGRpbmc6IDAsXG5cdFx0XHRwcmV2aWV3Tm9kZVBhZGRpbmc6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ubWFya2Rvd25QcmV2aWV3UGFkZGluZyxcblx0XHRcdG1hcmtkb3duTGVmdE1hcmdpbjogMCxcblx0XHRcdGxlZnRNYXJnaW46IDMyLFxuXHRcdFx0cmlnaHRNYXJnaW46IDAsXG5cdFx0XHRydW5HdXR0ZXI6IDAsXG5cdFx0XHRkcmFnQW5kRHJvcEVuYWJsZWQ6IGZhbHNlLFxuXHRcdFx0Zm9udFNpemU6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24uZm9udFNpemUsXG5cdFx0XHRvdXRwdXRGb250U2l6ZTogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5vdXRwdXRGb250U2l6ZSxcblx0XHRcdG91dHB1dEZvbnRGYW1pbHk6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ub3V0cHV0Rm9udEZhbWlseSxcblx0XHRcdG1hcmt1cEZvbnRTaXplOiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm1hcmt1cEZvbnRTaXplLFxuXHRcdFx0bWFya2Rvd25MaW5lSGVpZ2h0OiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm1hcmtkb3duTGluZUhlaWdodCxcblx0XHRcdG91dHB1dExpbmVIZWlnaHQ6IHRoaXMuX2xheW91dENvbmZpZ3VyYXRpb24ub3V0cHV0TGluZUhlaWdodCxcblx0XHRcdG91dHB1dFNjcm9sbGluZzogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5vdXRwdXRTY3JvbGxpbmcsXG5cdFx0XHRvdXRwdXRXb3JkV3JhcDogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5vdXRwdXRXb3JkV3JhcCxcblx0XHRcdG91dHB1dExpbmVMaW1pdDogdGhpcy5fbGF5b3V0Q29uZmlndXJhdGlvbi5vdXRwdXRMaW5lTGltaXQsXG5cdFx0XHRvdXRwdXRMaW5raWZ5RmlsZVBhdGhzOiBmYWxzZSxcblx0XHRcdG1pbmltYWxFcnJvcjogZmFsc2UsXG5cdFx0XHRtYXJrdXBGb250RmFtaWx5OiB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLm1hcmt1cEZvbnRGYW1pbHlcblx0XHR9O1xuXHR9XG5cblx0Y29tcHV0ZUluZGljYXRvclBvc2l0aW9uKHRvdGFsSGVpZ2h0OiBudW1iZXIsIGZvbGRIaW50SGVpZ2h0OiBudW1iZXIsIHZpZXdUeXBlPzogc3RyaW5nKSB7XG5cdFx0Y29uc3QgeyBib3R0b21Ub29sYmFyR2FwIH0gPSB0aGlzLmNvbXB1dGVCb3R0b21Ub29sYmFyRGltZW5zaW9ucyh2aWV3VHlwZSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Ym90dG9tSW5kaWNhdG9yVG9wOiB0b3RhbEhlaWdodCAtIGJvdHRvbVRvb2xiYXJHYXAgLSB0aGlzLl9sYXlvdXRDb25maWd1cmF0aW9uLmNlbGxCb3R0b21NYXJnaW4gLSBmb2xkSGludEhlaWdodCxcblx0XHRcdHZlcnRpY2FsSW5kaWNhdG9ySGVpZ2h0OiB0b3RhbEhlaWdodCAtIGJvdHRvbVRvb2xiYXJHYXAgLSBmb2xkSGludEhlaWdodFxuXHRcdH07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQWdELDZCQUE2QjtBQUV0RixTQUE4Ryx1QkFBOEM7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
