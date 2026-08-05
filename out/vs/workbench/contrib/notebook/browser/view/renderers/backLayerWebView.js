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
import { getWindow } from "../../../../../../base/browser/dom.js";
import { coalesce } from "../../../../../../base/common/arrays.js";
import { DeferredPromise, runWhenGlobalIdle } from "../../../../../../base/common/async.js";
import { decodeBase64 } from "../../../../../../base/common/buffer.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { getExtensionForMimeType } from "../../../../../../base/common/mime.js";
import { FileAccess, Schemas, matchesScheme, matchesSomeScheme } from "../../../../../../base/common/network.js";
import { equals } from "../../../../../../base/common/objects.js";
import * as osPath from "../../../../../../base/common/path.js";
import { isMacintosh, isWeb } from "../../../../../../base/common/platform.js";
import { dirname, extname, isEqual, joinPath } from "../../../../../../base/common/resources.js";
import { URI } from "../../../../../../base/common/uri.js";
import * as UUID from "../../../../../../base/common/uuid.js";
import { TokenizationRegistry } from "../../../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { generateTokensCSSForColorMap } from "../../../../../../editor/common/languages/supports/tokenization.js";
import { tokenizeToString } from "../../../../../../editor/common/languages/textToHtmlTokenizer.js";
import * as nls from "../../../../../../nls.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IFileDialogService } from "../../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { editorFindMatch, editorFindMatchHighlight } from "../../../../../../platform/theme/common/colorRegistry.js";
import { IThemeService, Themable } from "../../../../../../platform/theme/common/themeService.js";
import { IWorkspaceContextService } from "../../../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService } from "../../../../../../platform/workspace/common/workspaceTrust.js";
import { CellEditState, RenderOutputType } from "../../notebookBrowser.js";
import { NOTEBOOK_WEBVIEW_BOUNDARY } from "../notebookCellList.js";
import { preloadsScriptStr } from "./webviewPreloads.js";
import { transformWebviewThemeVars } from "./webviewThemeMapping.js";
import { MarkupCellViewModel } from "../../viewModel/markupCellViewModel.js";
import { CellUri, RendererMessagingSpec } from "../../../common/notebookCommon.js";
import { INotebookLoggingService } from "../../../common/notebookLoggingService.js";
import { INotebookService } from "../../../common/notebookService.js";
import { IWebviewService, WebviewContentPurpose, WebviewOriginStore } from "../../../../webview/browser/webview.js";
import { WebviewWindowDragMonitor } from "../../../../webview/browser/webviewWindowDragMonitor.js";
import { asWebviewUri, webviewGenericCspSource } from "../../../../webview/common/webview.js";
import { IEditorGroupsService } from "../../../../../services/editor/common/editorGroupsService.js";
import { IWorkbenchEnvironmentService } from "../../../../../services/environment/common/environmentService.js";
import { IPathService } from "../../../../../services/path/common/pathService.js";
const LINE_COLUMN_REGEX = /:([\d]+)(?::([\d]+))?$/;
const LineQueryRegex = /line=(\d+)$/;
const FRAGMENT_REGEX = /^(.*)#([^#]*)$/;
let BackLayerWebView = class extends Themable {
  constructor(notebookEditor, id, notebookViewType, documentUri, options, rendererMessaging, webviewService, openerService, notebookService, contextService, environmentService, fileDialogService, fileService, contextMenuService, contextKeyService, workspaceTrustManagementService, configurationService, languageService, workspaceContextService, editorGroupService, storageService, pathService, notebookLogService, themeService, telemetryService) {
    super(themeService);
    this.notebookEditor = notebookEditor;
    this.id = id;
    this.notebookViewType = notebookViewType;
    this.documentUri = documentUri;
    this.options = options;
    this.rendererMessaging = rendererMessaging;
    this.webviewService = webviewService;
    this.openerService = openerService;
    this.notebookService = notebookService;
    this.contextService = contextService;
    this.environmentService = environmentService;
    this.fileDialogService = fileDialogService;
    this.fileService = fileService;
    this.contextMenuService = contextMenuService;
    this.contextKeyService = contextKeyService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.configurationService = configurationService;
    this.languageService = languageService;
    this.workspaceContextService = workspaceContextService;
    this.editorGroupService = editorGroupService;
    this.storageService = storageService;
    this.pathService = pathService;
    this.notebookLogService = notebookLogService;
    this.telemetryService = telemetryService;
    this.webview = void 0;
    this.insetMapping = /* @__PURE__ */ new Map();
    this.pendingWebviewIdleCreationRequest = /* @__PURE__ */ new Map();
    this.pendingWebviewIdleInsetMapping = /* @__PURE__ */ new Map();
    this.reversedPendingWebviewIdleInsetMapping = /* @__PURE__ */ new Map();
    this.markupPreviewMapping = /* @__PURE__ */ new Map();
    this.hiddenInsetMapping = /* @__PURE__ */ new Set();
    this.reversedInsetMapping = /* @__PURE__ */ new Map();
    this.localResourceRootsCache = void 0;
    this._onMessage = this._register(new Emitter());
    this._preloadsCache = /* @__PURE__ */ new Set();
    this.onMessage = this._onMessage.event;
    this._disposed = false;
    this.firstInit = true;
    this.nonce = UUID.generateUuid();
    this._logRendererDebugMessage("Creating backlayer webview for notebook");
    this.element = document.createElement("div");
    this.element.style.height = "1400px";
    this.element.style.position = "absolute";
    if (rendererMessaging) {
      this._register(rendererMessaging);
      rendererMessaging.receiveMessageHandler = (rendererId, message) => {
        if (!this.webview || this._disposed) {
          return Promise.resolve(false);
        }
        this._sendMessageToWebview({
          __vscode_notebook_message: true,
          type: "customRendererMessage",
          rendererId,
          message
        });
        return Promise.resolve(true);
      };
    }
    this._register(workspaceTrustManagementService.onDidChangeTrust((e) => {
      const baseUrl = this.asWebviewUri(this.getNotebookBaseUri(), void 0);
      const htmlContent = this.generateContent(baseUrl.toString());
      this.webview?.setHtml(htmlContent);
    }));
    this._register(TokenizationRegistry.onDidChange(() => {
      this._sendMessageToWebview({
        type: "tokenizedStylesChanged",
        css: getTokenizationCss()
      });
    }));
  }
  static getOriginStore(storageService) {
    this._originStore ??= new WebviewOriginStore("notebook.backlayerWebview.origins", storageService);
    return this._originStore;
  }
  updateOptions(options) {
    this.options = options;
    this._updateStyles();
    this._updateOptions();
  }
  _logRendererDebugMessage(msg) {
    this.notebookLogService.debug("BacklayerWebview", `${this.documentUri} (${this.id}) - ${msg}`);
  }
  _updateStyles() {
    this._sendMessageToWebview({
      type: "notebookStyles",
      styles: this._generateStyles()
    });
  }
  _updateOptions() {
    this._sendMessageToWebview({
      type: "notebookOptions",
      options: {
        dragAndDropEnabled: this.options.dragAndDropEnabled
      },
      renderOptions: {
        lineLimit: this.options.outputLineLimit,
        outputScrolling: this.options.outputScrolling,
        outputWordWrap: this.options.outputWordWrap,
        linkifyFilePaths: this.options.outputLinkifyFilePaths,
        minimalError: this.options.minimalError
      }
    });
  }
  _generateStyles() {
    return {
      "notebook-output-left-margin": `${this.options.leftMargin + this.options.runGutter}px`,
      "notebook-output-width": `calc(100% - ${this.options.leftMargin + this.options.rightMargin + this.options.runGutter}px)`,
      "notebook-output-node-padding": `${this.options.outputNodePadding}px`,
      "notebook-run-gutter": `${this.options.runGutter}px`,
      "notebook-preview-node-padding": `${this.options.previewNodePadding}px`,
      "notebook-markdown-left-margin": `${this.options.markdownLeftMargin}px`,
      "notebook-output-node-left-padding": `${this.options.outputNodeLeftPadding}px`,
      "notebook-markdown-min-height": `${this.options.previewNodePadding * 2}px`,
      "notebook-markup-font-size": typeof this.options.markupFontSize === "number" && this.options.markupFontSize > 0 ? `${this.options.markupFontSize}px` : `calc(${this.options.fontSize}px * 1.2)`,
      "notebook-markdown-line-height": typeof this.options.markdownLineHeight === "number" && this.options.markdownLineHeight > 0 ? `${this.options.markdownLineHeight}px` : `normal`,
      "notebook-cell-output-font-size": `${this.options.outputFontSize || this.options.fontSize}px`,
      "notebook-cell-output-line-height": `${this.options.outputLineHeight}px`,
      "notebook-cell-output-max-height": `${this.options.outputLineHeight * this.options.outputLineLimit + 2}px`,
      "notebook-cell-output-font-family": this.options.outputFontFamily || this.options.fontFamily,
      "notebook-cell-markup-empty-content": nls.localize("notebook.emptyMarkdownPlaceholder", "Empty markdown cell, double-click or press enter to edit."),
      "notebook-cell-renderer-not-found-error": nls.localize({
        key: "notebook.error.rendererNotFound",
        comment: ["$0 is a placeholder for the mime type"]
      }, "No renderer found for '$0'"),
      "notebook-cell-renderer-fallbacks-exhausted": nls.localize({
        key: "notebook.error.rendererFallbacksExhausted",
        comment: ["$0 is a placeholder for the mime type"]
      }, "Could not render content for '$0'"),
      "notebook-markup-font-family": this.options.markupFontFamily
    };
  }
  generateContent(baseUrl) {
    const renderersData = this.getRendererData();
    const preloadsData = this.getStaticPreloadsData();
    const renderOptions = {
      lineLimit: this.options.outputLineLimit,
      outputScrolling: this.options.outputScrolling,
      outputWordWrap: this.options.outputWordWrap,
      linkifyFilePaths: this.options.outputLinkifyFilePaths,
      minimalError: this.options.minimalError
    };
    const preloadScript = preloadsScriptStr(
      {
        ...this.options,
        tokenizationCss: getTokenizationCss()
      },
      { dragAndDropEnabled: this.options.dragAndDropEnabled },
      renderOptions,
      renderersData,
      preloadsData,
      this.workspaceTrustManagementService.isWorkspaceTrusted(),
      this.nonce
    );
    const enableCsp = this.configurationService.getValue("notebook.experimental.enableCsp");
    const currentHighlight = this.getColor(editorFindMatch);
    const findMatchHighlight = this.getColor(editorFindMatchHighlight);
    return (
      /* html */
      `
		<html lang="en">
			<head>
				<meta charset="UTF-8">
				<base href="${baseUrl}/" />
				${enableCsp ? `<meta http-equiv="Content-Security-Policy" content="
					default-src 'none';
					script-src ${webviewGenericCspSource} 'unsafe-inline' 'unsafe-eval';
					style-src ${webviewGenericCspSource} 'unsafe-inline';
					img-src ${webviewGenericCspSource} https: http: data:;
					font-src ${webviewGenericCspSource} https:;
					connect-src https:;
					child-src https: data:;
				">` : ""}
				<style nonce="${this.nonce}">
					::highlight(find-highlight) {
						background-color: var(--vscode-editor-findMatchBackground, ${findMatchHighlight});
					}

					::highlight(current-find-highlight) {
						background-color: var(--vscode-editor-findMatchHighlightBackground, ${currentHighlight});
					}

					#container .cell_container {
						width: 100%;
					}

					#container .output_container {
						width: 100%;
					}

					#container .cell_container.nb-insertHighlight div.output_container div.output {
						background-color: var(--vscode-diffEditor-insertedLineBackground, var(--vscode-diffEditor-insertedTextBackground));
					}

					#container > div > div > div.output {
						font-size: var(--notebook-cell-output-font-size);
						width: var(--notebook-output-width);
						margin-left: var(--notebook-output-left-margin);
						background-color: var(--theme-notebook-output-background);
						padding-top: var(--notebook-output-node-padding);
						padding-right: var(--notebook-output-node-padding);
						padding-bottom: var(--notebook-output-node-padding);
						padding-left: var(--notebook-output-node-left-padding);
						box-sizing: border-box;
						border-top: none;
					}

					/* markdown */
					#container div.preview {
						width: 100%;
						padding-right: var(--notebook-preview-node-padding);
						padding-left: var(--notebook-markdown-left-margin);
						padding-top: var(--notebook-preview-node-padding);
						padding-bottom: var(--notebook-preview-node-padding);

						box-sizing: border-box;
						white-space: nowrap;
						overflow: hidden;
						white-space: initial;

						font-size: var(--notebook-markup-font-size);
						line-height: var(--notebook-markdown-line-height);
						color: var(--theme-ui-foreground);
						font-family: var(--notebook-markup-font-family);
					}

					#container div.preview.draggable {
						user-select: none;
						-webkit-user-select: none;
						-ms-user-select: none;
						cursor: grab;
					}

					#container div.preview.selected {
						background: var(--theme-notebook-cell-selected-background);
					}

					#container div.preview.dragging {
						background-color: var(--theme-background);
						opacity: 0.5 !important;
					}

					.monaco-workbench.vs-dark .notebookOverlay .cell.markdown .latex img,
					.monaco-workbench.vs-dark .notebookOverlay .cell.markdown .latex-block img {
						filter: brightness(0) invert(1)
					}

					#container .markup > div.nb-symbolHighlight {
						background-color: var(--theme-notebook-symbol-highlight-background);
					}

					#container .markup > div.nb-insertHighlight {
						background-color: var(--vscode-diffEditor-insertedLineBackground, var(--vscode-diffEditor-insertedTextBackground));
					}

					#container .nb-symbolHighlight .output_container .output {
						background-color: var(--theme-notebook-symbol-highlight-background);
					}

					#container .markup > div.nb-multiCellHighlight {
						background-color: var(--theme-notebook-symbol-highlight-background);
					}

					#container .nb-multiCellHighlight .output_container .output {
						background-color: var(--theme-notebook-symbol-highlight-background);
					}

					#container .nb-chatGenerationHighlight .output_container .output {
						background-color: var(--vscode-notebook-selectedCellBackground);
					}

					#container > div.nb-cellDeleted .output_container {
						background-color: var(--theme-notebook-diff-removed-background);
					}

					#container > div.nb-cellAdded .output_container {
						background-color: var(--theme-notebook-diff-inserted-background);
					}

					#container > div > div:not(.preview) > div {
						overflow-x: auto;
					}

					#container .no-renderer-error {
						color: var(--vscode-editorError-foreground);
					}

					body {
						padding: 0px;
						height: 100%;
						width: 100%;
					}

					table, thead, tr, th, td, tbody {
						border: none;
						border-color: transparent;
						border-spacing: 0;
						border-collapse: collapse;
					}

					table, th, tr {
						vertical-align: middle;
						text-align: right;
					}

					thead {
						font-weight: bold;
						background-color: rgba(130, 130, 130, 0.16);
					}

					th, td {
						padding: 4px 8px;
					}

					tr:nth-child(even) {
						background-color: rgba(130, 130, 130, 0.08);
					}

					tbody th {
						font-weight: normal;
					}

					.find-match {
						background-color: var(--vscode-editor-findMatchHighlightBackground);
					}

					.current-find-match {
						background-color: var(--vscode-editor-findMatchBackground);
					}

					#_defaultColorPalatte {
						color: var(--vscode-editor-findMatchHighlightBackground);
						background-color: var(--vscode-editor-findMatchBackground);
					}
				</style>
			</head>
			<body style="overflow: hidden;">
				<div id='findStart' tabIndex=-1></div>
				<div id='container' class="widgetarea" style="position: absolute;width:100%;top: 0px"></div>
				<div id="_defaultColorPalatte"></div>
				<script type="module">${preloadScript}<\/script>
			</body>
		</html>`
    );
  }
  getRendererData() {
    return this.notebookService.getRenderers().map((renderer) => {
      const entrypoint = {
        extends: renderer.entrypoint.extends,
        path: this.asWebviewUri(renderer.entrypoint.path, renderer.extensionLocation).toString()
      };
      return {
        id: renderer.id,
        entrypoint,
        mimeTypes: renderer.mimeTypes,
        messaging: renderer.messaging !== RendererMessagingSpec.Never && !!this.rendererMessaging,
        isBuiltin: renderer.isBuiltin
      };
    });
  }
  getStaticPreloadsData() {
    return Array.from(this.notebookService.getStaticPreloads(this.notebookViewType), (preload) => {
      return { entrypoint: this.asWebviewUri(preload.entrypoint, preload.extensionLocation).toString().toString() };
    });
  }
  asWebviewUri(uri, fromExtension) {
    return asWebviewUri(uri, fromExtension?.scheme === Schemas.vscodeRemote ? { isRemote: true, authority: fromExtension.authority } : void 0);
  }
  postKernelMessage(message) {
    this._sendMessageToWebview({
      __vscode_notebook_message: true,
      type: "customKernelMessage",
      message
    });
  }
  resolveOutputId(id) {
    const output = this.reversedInsetMapping.get(id);
    if (!output) {
      return;
    }
    const cellInfo = this.insetMapping.get(output).cellInfo;
    return { cellInfo, output };
  }
  isResolved() {
    return !!this.webview;
  }
  createWebview(targetWindow) {
    const baseUrl = this.asWebviewUri(this.getNotebookBaseUri(), void 0);
    const htmlContent = this.generateContent(baseUrl.toString());
    return this._initialize(htmlContent, targetWindow);
  }
  getNotebookBaseUri() {
    if (this.documentUri.scheme === Schemas.untitled) {
      const folder = this.workspaceContextService.getWorkspaceFolder(this.documentUri);
      if (folder) {
        return folder.uri;
      }
      const folders = this.workspaceContextService.getWorkspace().folders;
      if (folders.length) {
        return folders[0].uri;
      }
    }
    return dirname(this.documentUri);
  }
  getBuiltinLocalResourceRoots() {
    if (!this.documentUri.path.toLowerCase().endsWith(".ipynb")) {
      return [];
    }
    if (isWeb) {
      return [];
    }
    return [
      dirname(FileAccess.asFileUri("vs/nls.js"))
    ];
  }
  _initialize(content, targetWindow) {
    if (!getWindow(this.element).document.body.contains(this.element)) {
      throw new Error("Element is already detached from the DOM tree");
    }
    this.webview = this._createInset(this.webviewService, content);
    this.webview.mountTo(this.element, targetWindow);
    this._register(this.webview);
    this._register(new WebviewWindowDragMonitor(targetWindow, () => this.webview));
    const initializePromise = new DeferredPromise();
    this._register(this.webview.onFatalError((e) => {
      initializePromise.error(new Error(`Could not initialize webview: ${e.message}}`));
    }));
    this._register(this.webview.onMessage(async (message) => {
      const data = message.message;
      if (this._disposed) {
        return;
      }
      if (!data.__vscode_notebook_message) {
        return;
      }
      switch (data.type) {
        case "initialized": {
          initializePromise.complete();
          this.initializeWebViewState();
          break;
        }
        case "initializedMarkup": {
          if (this.initializeMarkupPromise?.requestId === data.requestId) {
            this.initializeMarkupPromise?.p.complete();
            this.initializeMarkupPromise = void 0;
          }
          break;
        }
        case "dimension": {
          for (const update of data.updates) {
            const height = update.height;
            if (update.isOutput) {
              const resolvedResult = this.resolveOutputId(update.id);
              if (resolvedResult) {
                const { cellInfo, output } = resolvedResult;
                this.notebookEditor.updateOutputHeight(cellInfo, output, height, !!update.init, "webview#dimension");
                this.notebookEditor.scheduleOutputHeightAck(cellInfo, update.id, height);
              } else if (update.init) {
                const outputRequest = this.reversedPendingWebviewIdleInsetMapping.get(update.id);
                if (outputRequest) {
                  const inset = this.pendingWebviewIdleInsetMapping.get(outputRequest);
                  this.pendingWebviewIdleCreationRequest.delete(outputRequest);
                  this.pendingWebviewIdleCreationRequest.delete(outputRequest);
                  const cellInfo = inset.cellInfo;
                  this.reversedInsetMapping.set(update.id, outputRequest);
                  this.insetMapping.set(outputRequest, inset);
                  this.notebookEditor.updateOutputHeight(cellInfo, outputRequest, height, !!update.init, "webview#dimension");
                  this.notebookEditor.scheduleOutputHeightAck(cellInfo, update.id, height);
                }
                this.reversedPendingWebviewIdleInsetMapping.delete(update.id);
              }
              {
                if (!update.init) {
                  continue;
                }
                const output = this.reversedInsetMapping.get(update.id);
                if (!output) {
                  continue;
                }
                const inset = this.insetMapping.get(output);
                inset.initialized = true;
              }
            } else {
              this.notebookEditor.updateMarkupCellHeight(update.id, height, !!update.init);
            }
          }
          break;
        }
        case "mouseenter": {
          const resolvedResult = this.resolveOutputId(data.id);
          if (resolvedResult) {
            const latestCell = this.notebookEditor.getCellByInfo(resolvedResult.cellInfo);
            if (latestCell) {
              latestCell.outputIsHovered = true;
            }
          }
          break;
        }
        case "mouseleave": {
          const resolvedResult = this.resolveOutputId(data.id);
          if (resolvedResult) {
            const latestCell = this.notebookEditor.getCellByInfo(resolvedResult.cellInfo);
            if (latestCell) {
              latestCell.outputIsHovered = false;
            }
          }
          break;
        }
        case "outputFocus": {
          const resolvedResult = this.resolveOutputId(data.id);
          if (resolvedResult) {
            const latestCell = this.notebookEditor.getCellByInfo(resolvedResult.cellInfo);
            if (latestCell) {
              latestCell.outputIsFocused = true;
              this.notebookEditor.focusNotebookCell(latestCell, "output", { outputId: resolvedResult.output.model.outputId, skipReveal: true, outputWebviewFocused: true });
            }
          }
          break;
        }
        case "outputBlur": {
          const resolvedResult = this.resolveOutputId(data.id);
          if (resolvedResult) {
            const latestCell = this.notebookEditor.getCellByInfo(resolvedResult.cellInfo);
            if (latestCell) {
              latestCell.outputIsFocused = false;
              latestCell.inputInOutputIsFocused = false;
            }
          }
          break;
        }
        case "scroll-ack": {
          break;
        }
        case "scroll-to-reveal": {
          this.notebookEditor.setScrollTop(data.scrollTop - NOTEBOOK_WEBVIEW_BOUNDARY);
          break;
        }
        case "did-scroll-wheel": {
          this.notebookEditor.triggerScroll({
            ...data.payload,
            preventDefault: () => {
            },
            stopPropagation: () => {
            }
          });
          break;
        }
        case "focus-editor": {
          const cell = this.notebookEditor.getCellById(data.cellId);
          if (cell) {
            if (data.focusNext) {
              this.notebookEditor.focusNextNotebookCell(cell, "editor");
            } else {
              await this.notebookEditor.focusNotebookCell(cell, "editor");
            }
          }
          break;
        }
        case "clicked-data-url": {
          this._onDidClickDataLink(data);
          break;
        }
        case "clicked-link": {
          if (matchesScheme(data.href, Schemas.command)) {
            const uri = URI.parse(data.href);
            if (uri.path === "workbench.action.openLargeOutput") {
              const outputId = uri.query;
              const group = this.editorGroupService.activeGroup;
              if (group) {
                if (group.activeEditor) {
                  group.pinEditor(group.activeEditor);
                }
              }
              this.openerService.open(CellUri.generateCellOutputUriWithId(this.documentUri, outputId));
              return;
            }
            if (uri.path === "cellOutput.enableScrolling") {
              const outputId = uri.query;
              const cell = this.reversedInsetMapping.get(outputId);
              if (cell) {
                this.telemetryService.publicLog2("workbenchActionExecuted", { id: "notebook.cell.toggleOutputScrolling", from: "inlineLink" });
                cell.cellViewModel.outputsViewModels.forEach((vm) => {
                  if (vm.model.metadata) {
                    vm.model.metadata["scrollable"] = true;
                    vm.resetRenderer();
                  }
                });
              }
              return;
            }
            this.openerService.open(data.href, {
              fromUserGesture: true,
              fromWorkspace: true,
              allowCommands: [
                "github-issues.authNow",
                "workbench.extensions.search",
                "workbench.action.openSettings",
                "_notebook.selectKernel",
                // TODO@rebornix explore open output channel with name command
                "jupyter.viewOutput",
                "jupyter.createPythonEnvAndSelectController"
              ]
            });
            return;
          }
          if (matchesSomeScheme(data.href, Schemas.http, Schemas.https, Schemas.mailto)) {
            this.openerService.open(data.href, { fromUserGesture: true, fromWorkspace: true });
          } else if (matchesScheme(data.href, Schemas.vscodeNotebookCell)) {
            const uri = URI.parse(data.href);
            await this._handleNotebookCellResource(uri);
          } else if (!/^[\w\-]+:/.test(data.href)) {
            await this._handleResourceOpening(tryDecodeURIComponent(data.href));
          } else {
            if (osPath.isAbsolute(data.href)) {
              this._openUri(URI.file(data.href));
            } else {
              this._openUri(URI.parse(data.href));
            }
          }
          break;
        }
        case "customKernelMessage": {
          this._onMessage.fire({ message: data.message });
          break;
        }
        case "customRendererMessage": {
          this.rendererMessaging?.postMessage(data.rendererId, data.message);
          break;
        }
        case "clickMarkupCell": {
          const cell = this.notebookEditor.getCellById(data.cellId);
          if (cell) {
            if (data.shiftKey || (isMacintosh ? data.metaKey : data.ctrlKey)) {
              this.notebookEditor.toggleNotebookCellSelection(
                cell,
                /* fromPrevious */
                data.shiftKey
              );
            } else {
              await this.notebookEditor.focusNotebookCell(cell, "container", { skipReveal: true });
            }
          }
          break;
        }
        case "contextMenuMarkupCell": {
          const cell = this.notebookEditor.getCellById(data.cellId);
          if (cell) {
            await this.notebookEditor.focusNotebookCell(cell, "container", { skipReveal: true });
            const webviewRect = this.element.getBoundingClientRect();
            this.contextMenuService.showContextMenu({
              menuId: MenuId.NotebookCellTitle,
              contextKeyService: this.contextKeyService,
              getAnchor: () => ({
                x: webviewRect.x + data.clientX,
                y: webviewRect.y + data.clientY
              })
            });
          }
          break;
        }
        case "toggleMarkupPreview": {
          const cell = this.notebookEditor.getCellById(data.cellId);
          if (cell && !this.notebookEditor.creationOptions.isReadOnly) {
            this.notebookEditor.setMarkupCellEditState(data.cellId, CellEditState.Editing);
            await this.notebookEditor.focusNotebookCell(cell, "editor", { skipReveal: true });
          }
          break;
        }
        case "mouseEnterMarkupCell": {
          const cell = this.notebookEditor.getCellById(data.cellId);
          if (cell instanceof MarkupCellViewModel) {
            cell.cellIsHovered = true;
          }
          break;
        }
        case "mouseLeaveMarkupCell": {
          const cell = this.notebookEditor.getCellById(data.cellId);
          if (cell instanceof MarkupCellViewModel) {
            cell.cellIsHovered = false;
          }
          break;
        }
        case "cell-drag-start": {
          this.notebookEditor.didStartDragMarkupCell(data.cellId, data);
          break;
        }
        case "cell-drag": {
          this.notebookEditor.didDragMarkupCell(data.cellId, data);
          break;
        }
        case "cell-drop": {
          this.notebookEditor.didDropMarkupCell(data.cellId, {
            dragOffsetY: data.dragOffsetY,
            ctrlKey: data.ctrlKey,
            altKey: data.altKey
          });
          break;
        }
        case "cell-drag-end": {
          this.notebookEditor.didEndDragMarkupCell(data.cellId);
          break;
        }
        case "renderedMarkup": {
          const cell = this.notebookEditor.getCellById(data.cellId);
          if (cell instanceof MarkupCellViewModel) {
            cell.renderedHtml = data.html;
          }
          this._handleHighlightCodeBlock(data.codeBlocks);
          break;
        }
        case "renderedCellOutput": {
          this._handleHighlightCodeBlock(data.codeBlocks);
          break;
        }
        case "outputResized": {
          this.notebookEditor.didResizeOutput(data.cellId);
          break;
        }
        case "getOutputItem": {
          const resolvedResult = this.resolveOutputId(data.outputId);
          const output = resolvedResult?.output.model.outputs.find((output2) => output2.mime === data.mime);
          this._sendMessageToWebview({
            type: "returnOutputItem",
            requestId: data.requestId,
            output: output ? { mime: output.mime, valueBytes: output.data.buffer } : void 0
          });
          break;
        }
        case "logRendererDebugMessage": {
          this._logRendererDebugMessage(`${data.message}${data.data ? " " + JSON.stringify(data.data, null, 4) : ""}`);
          break;
        }
        case "notebookPerformanceMessage": {
          this.notebookEditor.updatePerformanceMetadata(data.cellId, data.executionId, data.duration, data.rendererId);
          if (data.outputSize && data.rendererId === "vscode.builtin-renderer") {
            this._sendPerformanceData(data.outputSize, data.duration);
          }
          break;
        }
        case "outputInputFocus": {
          const resolvedResult = this.resolveOutputId(data.id);
          if (resolvedResult) {
            const latestCell = this.notebookEditor.getCellByInfo(resolvedResult.cellInfo);
            if (latestCell) {
              latestCell.inputInOutputIsFocused = data.inputFocused;
            }
          }
          this.notebookEditor.didFocusOutputInputChange(data.inputFocused);
        }
      }
    }));
    return initializePromise.p;
  }
  _sendPerformanceData(outputSize, renderTime) {
    const telemetryData = {
      outputSize,
      renderTime
    };
    this.telemetryService.publicLog2("NotebookCellOutputRender", telemetryData);
  }
  _handleNotebookCellResource(uri) {
    const notebookResource = uri.path.length > 0 ? uri : this.documentUri;
    const lineMatch = /(?:^|&)line=([^&]+)/.exec(uri.query);
    let editorOptions = void 0;
    if (lineMatch) {
      const parsedLineNumber = parseInt(lineMatch[1], 10);
      if (!isNaN(parsedLineNumber)) {
        const lineNumber = parsedLineNumber;
        editorOptions = {
          selection: { startLineNumber: lineNumber, startColumn: 1 }
        };
      }
    }
    const executionMatch = /(?:^|&)execution_count=([^&]+)/.exec(uri.query);
    if (executionMatch) {
      const executionCount = parseInt(executionMatch[1], 10);
      if (!isNaN(executionCount)) {
        const notebookModel = this.notebookService.getNotebookTextModel(notebookResource);
        const cell = notebookModel?.cells.slice().reverse().find((cell2) => {
          return cell2.internalMetadata.executionOrder === executionCount;
        });
        if (cell?.uri) {
          return this.openerService.open(cell.uri, {
            fromUserGesture: true,
            fromWorkspace: true,
            editorOptions
          });
        }
      }
    }
    const fragmentLineMatch = /\?line=(\d+)$/.exec(uri.fragment);
    if (fragmentLineMatch) {
      const parsedLineNumber = parseInt(fragmentLineMatch[1], 10);
      if (!isNaN(parsedLineNumber)) {
        const lineNumber = parsedLineNumber + 1;
        const fragment = uri.fragment.substring(0, fragmentLineMatch.index);
        const editorOptions2 = {
          selection: { startLineNumber: lineNumber, startColumn: 1, endLineNumber: lineNumber, endColumn: 1 }
        };
        return this.openerService.open(notebookResource.with({ fragment }), {
          fromUserGesture: true,
          fromWorkspace: true,
          editorOptions: editorOptions2
        });
      }
    }
    return this.openerService.open(notebookResource, { fromUserGesture: true, fromWorkspace: true });
  }
  async _handleResourceOpening(href) {
    let linkToOpen = void 0;
    let fragment = void 0;
    const hrefWithFragment = FRAGMENT_REGEX.exec(href);
    if (hrefWithFragment) {
      href = hrefWithFragment[1];
      fragment = hrefWithFragment[2];
    }
    if (href.startsWith("/")) {
      linkToOpen = await this.pathService.fileURI(href);
      const folders = this.workspaceContextService.getWorkspace().folders;
      if (folders.length) {
        linkToOpen = linkToOpen.with({
          scheme: folders[0].uri.scheme,
          authority: folders[0].uri.authority
        });
      }
    } else if (href.startsWith("~")) {
      const userHome = await this.pathService.userHome();
      if (userHome) {
        linkToOpen = URI.joinPath(userHome, href.substring(2));
      }
    } else {
      if (this.documentUri.scheme === Schemas.untitled) {
        const folders = this.workspaceContextService.getWorkspace().folders;
        if (!folders.length) {
          return;
        }
        linkToOpen = URI.joinPath(folders[0].uri, href);
      } else {
        linkToOpen = URI.joinPath(dirname(this.documentUri), href);
      }
    }
    if (linkToOpen) {
      if (fragment) {
        linkToOpen = linkToOpen.with({ fragment });
      }
      this._openUri(linkToOpen);
    }
  }
  _openUri(uri) {
    let lineNumber = void 0;
    let column = void 0;
    const lineCol = LINE_COLUMN_REGEX.exec(uri.path);
    if (lineCol) {
      uri = uri.with({
        path: uri.path.slice(0, lineCol.index),
        fragment: `L${lineCol[0].slice(1)}`
      });
      lineNumber = parseInt(lineCol[1], 10);
      column = parseInt(lineCol[2], 10);
    }
    const lineMatch = LineQueryRegex.exec(uri.query);
    if (lineMatch) {
      const parsedLineNumber = parseInt(lineMatch[1], 10);
      if (!isNaN(parsedLineNumber)) {
        lineNumber = parsedLineNumber + 1;
        column = 1;
        uri = uri.with({ fragment: `L${lineNumber}` });
      }
    }
    uri = uri.with({
      query: null
    });
    let match = void 0;
    for (const group of this.editorGroupService.groups) {
      const editorInput = group.editors.find((editor) => editor.resource && isEqual(editor.resource, uri, true));
      if (editorInput) {
        match = { group, editor: editorInput };
        break;
      }
    }
    if (match) {
      const selection = lineNumber !== void 0 && column !== void 0 ? { startLineNumber: lineNumber, startColumn: column } : void 0;
      const textEditorOptions = { selection };
      match.group.openEditor(match.editor, selection ? textEditorOptions : void 0);
    } else {
      this.openerService.open(uri, { fromUserGesture: true, fromWorkspace: true });
    }
  }
  _handleHighlightCodeBlock(codeBlocks) {
    for (const { id, value, lang } of codeBlocks) {
      const languageId = this.languageService.getLanguageIdByLanguageName(lang);
      if (!languageId) {
        continue;
      }
      tokenizeToString(this.languageService, value, languageId).then((html) => {
        if (this._disposed) {
          return;
        }
        this._sendMessageToWebview({
          type: "tokenizedCodeBlock",
          html,
          codeBlockId: id
        });
      });
    }
  }
  async _onDidClickDataLink(event) {
    if (typeof event.data !== "string") {
      return;
    }
    const [splitStart, splitData] = event.data.split(";base64,");
    if (!splitData || !splitStart) {
      return;
    }
    const defaultDir = extname(this.documentUri) === ".interactive" ? this.workspaceContextService.getWorkspace().folders[0]?.uri ?? await this.fileDialogService.defaultFilePath() : dirname(this.documentUri);
    let defaultName;
    if (event.downloadName) {
      defaultName = event.downloadName;
    } else {
      const mimeType = splitStart.replace(/^data:/, "");
      const candidateExtension = mimeType && getExtensionForMimeType(mimeType);
      defaultName = candidateExtension ? `download${candidateExtension}` : "download";
    }
    const defaultUri = joinPath(defaultDir, defaultName);
    const newFileUri = await this.fileDialogService.showSaveDialog({
      defaultUri
    });
    if (!newFileUri) {
      return;
    }
    const buff = decodeBase64(splitData);
    await this.fileService.writeFile(newFileUri, buff);
    await this.openerService.open(newFileUri);
  }
  _createInset(webviewService, content) {
    this.localResourceRootsCache = this._getResourceRootsCache();
    const webview = webviewService.createWebviewElement({
      origin: BackLayerWebView.getOriginStore(this.storageService).getOrigin(this.notebookViewType, void 0),
      title: nls.localize("webview title", "Notebook webview content"),
      options: {
        purpose: WebviewContentPurpose.NotebookRenderer,
        enableFindWidget: false,
        transformCssVariables: transformWebviewThemeVars
      },
      contentOptions: {
        allowMultipleAPIAcquire: true,
        allowScripts: true,
        localResourceRoots: this.localResourceRootsCache
      },
      extension: void 0,
      providedViewType: "notebook.output"
    });
    webview.setHtml(content);
    webview.setContextKeyService(this.contextKeyService);
    return webview;
  }
  _getResourceRootsCache() {
    const workspaceFolders = this.contextService.getWorkspace().folders.map((x) => x.uri);
    const notebookDir = this.getNotebookBaseUri();
    return [
      this.notebookService.getNotebookProviderResourceRoots(),
      this.notebookService.getRenderers().map((x) => dirname(x.entrypoint.path)),
      ...Array.from(this.notebookService.getStaticPreloads(this.notebookViewType), (x) => [
        dirname(x.entrypoint),
        ...x.localResourceRoots
      ]),
      workspaceFolders,
      notebookDir,
      this.getBuiltinLocalResourceRoots()
    ].flat();
  }
  initializeWebViewState() {
    this._preloadsCache.clear();
    if (this._currentKernel) {
      this._updatePreloadsFromKernel(this._currentKernel);
    }
    for (const [output, inset] of this.insetMapping.entries()) {
      this._sendMessageToWebview({ ...inset.cachedCreation, initiallyHidden: this.hiddenInsetMapping.has(output) });
    }
    if (this.initializeMarkupPromise?.isFirstInit) {
    } else {
      const mdCells = [...this.markupPreviewMapping.values()];
      this.markupPreviewMapping.clear();
      this.initializeMarkup(mdCells);
    }
    this._updateStyles();
    this._updateOptions();
  }
  shouldUpdateInset(cell, output, cellTop, outputOffset) {
    if (this._disposed) {
      return false;
    }
    if ("isOutputCollapsed" in cell && cell.isOutputCollapsed) {
      return false;
    }
    if (this.hiddenInsetMapping.has(output)) {
      return true;
    }
    const outputCache = this.insetMapping.get(output);
    if (!outputCache) {
      return false;
    }
    if (outputOffset === outputCache.cachedCreation.outputOffset && cellTop === outputCache.cachedCreation.cellTop) {
      return false;
    }
    return true;
  }
  ackHeight(updates) {
    this._sendMessageToWebview({
      type: "ack-dimension",
      updates
    });
  }
  updateScrollTops(outputRequests, markupPreviews) {
    if (this._disposed) {
      return;
    }
    const widgets = coalesce(outputRequests.map((request) => {
      const outputCache = this.insetMapping.get(request.output);
      if (!outputCache) {
        return;
      }
      if (!request.forceDisplay && !this.shouldUpdateInset(request.cell, request.output, request.cellTop, request.outputOffset)) {
        return;
      }
      const id = outputCache.outputId;
      outputCache.cachedCreation.cellTop = request.cellTop;
      outputCache.cachedCreation.outputOffset = request.outputOffset;
      this.hiddenInsetMapping.delete(request.output);
      return {
        cellId: request.cell.id,
        outputId: id,
        cellTop: request.cellTop,
        outputOffset: request.outputOffset,
        forceDisplay: request.forceDisplay
      };
    }));
    if (!widgets.length && !markupPreviews.length) {
      return;
    }
    this._sendMessageToWebview({
      type: "view-scroll",
      widgets,
      markupCells: markupPreviews
    });
  }
  async createMarkupPreview(initialization) {
    if (this._disposed) {
      return;
    }
    if (this.markupPreviewMapping.has(initialization.cellId)) {
      console.error("Trying to create markup preview that already exists");
      return;
    }
    this.markupPreviewMapping.set(initialization.cellId, initialization);
    this._sendMessageToWebview({
      type: "createMarkupCell",
      cell: initialization
    });
  }
  async showMarkupPreview(newContent) {
    if (this._disposed) {
      return;
    }
    const entry = this.markupPreviewMapping.get(newContent.cellId);
    if (!entry) {
      return this.createMarkupPreview(newContent);
    }
    const sameContent = newContent.content === entry.content;
    const sameMetadata = equals(newContent.metadata, entry.metadata);
    if (!sameContent || !sameMetadata || !entry.visible) {
      this._sendMessageToWebview({
        type: "showMarkupCell",
        id: newContent.cellId,
        handle: newContent.cellHandle,
        // If the content has not changed, we still want to make sure the
        // preview is visible but don't need to send anything over
        content: sameContent ? void 0 : newContent.content,
        top: newContent.offset,
        metadata: sameMetadata ? void 0 : newContent.metadata
      });
    }
    entry.metadata = newContent.metadata;
    entry.content = newContent.content;
    entry.offset = newContent.offset;
    entry.visible = true;
  }
  async hideMarkupPreviews(cellIds) {
    if (this._disposed) {
      return;
    }
    const cellsToHide = [];
    for (const cellId of cellIds) {
      const entry = this.markupPreviewMapping.get(cellId);
      if (entry) {
        if (entry.visible) {
          cellsToHide.push(cellId);
          entry.visible = false;
        }
      }
    }
    if (cellsToHide.length) {
      this._sendMessageToWebview({
        type: "hideMarkupCells",
        ids: cellsToHide
      });
    }
  }
  async unhideMarkupPreviews(cellIds) {
    if (this._disposed) {
      return;
    }
    const toUnhide = [];
    for (const cellId of cellIds) {
      const entry = this.markupPreviewMapping.get(cellId);
      if (entry) {
        if (!entry.visible) {
          entry.visible = true;
          toUnhide.push(cellId);
        }
      } else {
        console.error(`Trying to unhide a preview that does not exist: ${cellId}`);
      }
    }
    this._sendMessageToWebview({
      type: "unhideMarkupCells",
      ids: toUnhide
    });
  }
  async deleteMarkupPreviews(cellIds) {
    if (this._disposed) {
      return;
    }
    for (const id of cellIds) {
      if (!this.markupPreviewMapping.has(id)) {
        console.error(`Trying to delete a preview that does not exist: ${id}`);
      }
      this.markupPreviewMapping.delete(id);
    }
    if (cellIds.length) {
      this._sendMessageToWebview({
        type: "deleteMarkupCell",
        ids: cellIds
      });
    }
  }
  async updateMarkupPreviewSelections(selectedCellsIds) {
    if (this._disposed) {
      return;
    }
    this._sendMessageToWebview({
      type: "updateSelectedMarkupCells",
      selectedCellIds: selectedCellsIds.filter((id) => this.markupPreviewMapping.has(id))
    });
  }
  async initializeMarkup(cells) {
    if (this._disposed) {
      return;
    }
    this.initializeMarkupPromise?.p.complete();
    const requestId = UUID.generateUuid();
    this.initializeMarkupPromise = { p: new DeferredPromise(), requestId, isFirstInit: this.firstInit };
    this.firstInit = false;
    for (const cell of cells) {
      this.markupPreviewMapping.set(cell.cellId, cell);
    }
    this._sendMessageToWebview({
      type: "initializeMarkup",
      cells,
      requestId
    });
    return this.initializeMarkupPromise.p.p;
  }
  /**
   * Validate if cached inset is out of date and require a rerender
   * Note that it doesn't account for output content change.
   */
  _cachedInsetEqual(cachedInset, content) {
    if (content.type === RenderOutputType.Extension) {
      return cachedInset.renderer?.id === content.renderer.id;
    } else {
      return cachedInset.cachedCreation.type === "html";
    }
  }
  requestCreateOutputWhenWebviewIdle(cellInfo, content, cellTop, offset) {
    if (this._disposed) {
      return;
    }
    if (this.insetMapping.has(content.source)) {
      return;
    }
    if (this.pendingWebviewIdleCreationRequest.has(content.source)) {
      return;
    }
    if (this.pendingWebviewIdleInsetMapping.has(content.source)) {
      return;
    }
    this.pendingWebviewIdleCreationRequest.set(content.source, runWhenGlobalIdle(() => {
      const { message, renderer, transfer: transferable } = this._createOutputCreationMessage(cellInfo, content, cellTop, offset, true, true);
      this._sendMessageToWebview(message, transferable);
      this.pendingWebviewIdleInsetMapping.set(content.source, { outputId: message.outputId, versionId: content.source.model.versionId, cellInfo, renderer, cachedCreation: message });
      this.reversedPendingWebviewIdleInsetMapping.set(message.outputId, content.source);
      this.pendingWebviewIdleCreationRequest.delete(content.source);
    }));
  }
  createOutput(cellInfo, content, cellTop, offset) {
    if (this._disposed) {
      return;
    }
    const cachedInset = this.insetMapping.get(content.source);
    this.pendingWebviewIdleCreationRequest.get(content.source)?.dispose();
    this.pendingWebviewIdleCreationRequest.delete(content.source);
    this.pendingWebviewIdleInsetMapping.delete(content.source);
    if (cachedInset) {
      this.reversedPendingWebviewIdleInsetMapping.delete(cachedInset.outputId);
    }
    if (cachedInset && this._cachedInsetEqual(cachedInset, content)) {
      this.hiddenInsetMapping.delete(content.source);
      this._sendMessageToWebview({
        type: "showOutput",
        cellId: cachedInset.cellInfo.cellId,
        outputId: cachedInset.outputId,
        cellTop,
        outputOffset: offset
      });
      return;
    }
    const { message, renderer, transfer: transferable } = this._createOutputCreationMessage(cellInfo, content, cellTop, offset, false, false);
    this._sendMessageToWebview(message, transferable);
    this.insetMapping.set(content.source, { outputId: message.outputId, versionId: content.source.model.versionId, cellInfo, renderer, cachedCreation: message });
    this.hiddenInsetMapping.delete(content.source);
    this.reversedInsetMapping.set(message.outputId, content.source);
  }
  createMetadata(output, mimeType) {
    if (mimeType.startsWith("image")) {
      const buffer = output.outputs.find((out) => out.mime === "text/plain")?.data.buffer;
      if (buffer?.length && buffer?.length > 0) {
        const altText = new TextDecoder().decode(buffer);
        return { ...output.metadata, vscode_altText: altText };
      }
    }
    return output.metadata;
  }
  _createOutputCreationMessage(cellInfo, content, cellTop, offset, createOnIdle, initiallyHidden) {
    const messageBase = {
      type: "html",
      executionId: cellInfo.executionId,
      cellId: cellInfo.cellId,
      cellTop,
      outputOffset: offset,
      left: 0,
      requiredPreloads: [],
      createOnIdle
    };
    const transfer = [];
    let message;
    let renderer;
    if (content.type === RenderOutputType.Extension) {
      const output = content.source.model;
      renderer = content.renderer;
      const first = output.outputs.find((op) => op.mime === content.mimeType);
      const metadata = this.createMetadata(output, content.mimeType);
      const valueBytes = copyBufferIfNeeded(first.data.buffer, transfer);
      message = {
        ...messageBase,
        outputId: output.outputId,
        rendererId: content.renderer.id,
        content: {
          type: RenderOutputType.Extension,
          outputId: output.outputId,
          metadata,
          output: {
            mime: first.mime,
            valueBytes
          },
          allOutputs: output.outputs.map((output2) => ({ mime: output2.mime }))
        },
        initiallyHidden
      };
    } else {
      message = {
        ...messageBase,
        outputId: UUID.generateUuid(),
        content: {
          type: content.type,
          htmlContent: content.htmlContent
        },
        initiallyHidden
      };
    }
    return {
      message,
      renderer,
      transfer
    };
  }
  updateOutput(cellInfo, content, cellTop, offset) {
    if (this._disposed) {
      return;
    }
    if (!this.insetMapping.has(content.source)) {
      this.createOutput(cellInfo, content, cellTop, offset);
      return;
    }
    const outputCache = this.insetMapping.get(content.source);
    if (outputCache.versionId === content.source.model.versionId) {
      return;
    }
    this.hiddenInsetMapping.delete(content.source);
    let updatedContent = void 0;
    const transfer = [];
    if (content.type === RenderOutputType.Extension) {
      const output = content.source.model;
      const firstBuffer = output.outputs.find((op) => op.mime === content.mimeType);
      const appenededData = output.appendedSinceVersion(outputCache.versionId, content.mimeType);
      const appended = appenededData ? { valueBytes: appenededData.buffer, previousVersion: outputCache.versionId } : void 0;
      const valueBytes = copyBufferIfNeeded(firstBuffer.data.buffer, transfer);
      updatedContent = {
        type: RenderOutputType.Extension,
        outputId: outputCache.outputId,
        metadata: output.metadata,
        output: {
          mime: content.mimeType,
          valueBytes,
          appended
        },
        allOutputs: output.outputs.map((output2) => ({ mime: output2.mime }))
      };
    }
    this._sendMessageToWebview({
      type: "showOutput",
      cellId: outputCache.cellInfo.cellId,
      outputId: outputCache.outputId,
      cellTop,
      outputOffset: offset,
      content: updatedContent
    }, transfer);
    outputCache.versionId = content.source.model.versionId;
    return;
  }
  async copyImage(output) {
    this._sendMessageToWebview({
      type: "copyImage",
      outputId: output.model.outputId,
      altOutputId: output.model.alternativeOutputId
    });
  }
  removeInsets(outputs) {
    if (this._disposed) {
      return;
    }
    for (const output of outputs) {
      const outputCache = this.insetMapping.get(output);
      if (!outputCache) {
        continue;
      }
      const id = outputCache.outputId;
      this._sendMessageToWebview({
        type: "clearOutput",
        rendererId: outputCache.cachedCreation.rendererId,
        cellUri: outputCache.cellInfo.cellUri.toString(),
        outputId: id,
        cellId: outputCache.cellInfo.cellId
      });
      this.insetMapping.delete(output);
      this.pendingWebviewIdleCreationRequest.get(output)?.dispose();
      this.pendingWebviewIdleCreationRequest.delete(output);
      this.pendingWebviewIdleInsetMapping.delete(output);
      this.reversedPendingWebviewIdleInsetMapping.delete(id);
      this.reversedInsetMapping.delete(id);
    }
  }
  hideInset(output) {
    if (this._disposed) {
      return;
    }
    const outputCache = this.insetMapping.get(output);
    if (!outputCache) {
      return;
    }
    this.hiddenInsetMapping.add(output);
    this._sendMessageToWebview({
      type: "hideOutput",
      outputId: outputCache.outputId,
      cellId: outputCache.cellInfo.cellId
    });
  }
  focusWebview() {
    if (this._disposed) {
      return;
    }
    this.webview?.focus();
  }
  selectOutputContents(cell) {
    if (this._disposed) {
      return;
    }
    const output = cell.outputsViewModels.find((o) => o.model.outputId === cell.focusedOutputId);
    const outputId = output ? this.insetMapping.get(output)?.outputId : void 0;
    this._sendMessageToWebview({
      type: "select-output-contents",
      cellOrOutputId: outputId || cell.id
    });
  }
  selectInputContents(cell) {
    if (this._disposed) {
      return;
    }
    const output = cell.outputsViewModels.find((o) => o.model.outputId === cell.focusedOutputId);
    const outputId = output ? this.insetMapping.get(output)?.outputId : void 0;
    this._sendMessageToWebview({
      type: "select-input-contents",
      cellOrOutputId: outputId || cell.id
    });
  }
  focusOutput(cellOrOutputId, alternateId, viewFocused) {
    if (this._disposed) {
      return;
    }
    if (!viewFocused) {
      this.webview?.focus();
    }
    this._sendMessageToWebview({
      type: "focus-output",
      cellOrOutputId,
      alternateId
    });
  }
  blurOutput() {
    if (this._disposed) {
      return;
    }
    this._sendMessageToWebview({
      type: "blur-output"
    });
  }
  async find(query, options) {
    if (query === "") {
      this._sendMessageToWebview({
        type: "findStop",
        ownerID: options.ownerID
      });
      return [];
    }
    const p = new Promise((resolve) => {
      const sub = this.webview?.onMessage((e) => {
        if (e.message.type === "didFind") {
          resolve(e.message.matches);
          sub?.dispose();
        }
      });
    });
    this._sendMessageToWebview({
      type: "find",
      query,
      options
    });
    const ret = await p;
    return ret;
  }
  findStop(ownerID) {
    this._sendMessageToWebview({
      type: "findStop",
      ownerID
    });
  }
  async findHighlightCurrent(index, ownerID) {
    const p = new Promise((resolve) => {
      const sub = this.webview?.onMessage((e) => {
        if (e.message.type === "didFindHighlightCurrent") {
          resolve(e.message.offset);
          sub?.dispose();
        }
      });
    });
    this._sendMessageToWebview({
      type: "findHighlightCurrent",
      index,
      ownerID
    });
    const ret = await p;
    return ret;
  }
  async findUnHighlightCurrent(index, ownerID) {
    this._sendMessageToWebview({
      type: "findUnHighlightCurrent",
      index,
      ownerID
    });
  }
  deltaCellOutputContainerClassNames(cellId, added, removed) {
    this._sendMessageToWebview({
      type: "decorations",
      cellId,
      addedClassNames: added,
      removedClassNames: removed
    });
  }
  deltaMarkupPreviewClassNames(cellId, added, removed) {
    if (this.markupPreviewMapping.get(cellId)) {
      this._sendMessageToWebview({
        type: "markupDecorations",
        cellId,
        addedClassNames: added,
        removedClassNames: removed
      });
    }
  }
  updateOutputRenderers() {
    if (!this.webview) {
      return;
    }
    const renderersData = this.getRendererData();
    this.localResourceRootsCache = this._getResourceRootsCache();
    const mixedResourceRoots = [
      ...this.localResourceRootsCache || [],
      ...this._currentKernel ? [this._currentKernel.localResourceRoot] : []
    ];
    this.webview.localResourcesRoot = mixedResourceRoots;
    this._sendMessageToWebview({
      type: "updateRenderers",
      rendererData: renderersData
    });
  }
  async updateKernelPreloads(kernel) {
    if (this._disposed || kernel === this._currentKernel) {
      return;
    }
    const previousKernel = this._currentKernel;
    this._currentKernel = kernel;
    if (previousKernel && previousKernel.preloadUris.length > 0) {
      this.webview?.reload();
    } else if (kernel) {
      this._updatePreloadsFromKernel(kernel);
    }
  }
  _updatePreloadsFromKernel(kernel) {
    const resources = [];
    for (const preload of kernel.preloadUris) {
      const uri = this.environmentService.isExtensionDevelopment && (preload.scheme === "http" || preload.scheme === "https") ? preload : this.asWebviewUri(preload, void 0);
      if (!this._preloadsCache.has(uri.toString())) {
        resources.push({ uri: uri.toString(), originalUri: preload.toString() });
        this._preloadsCache.add(uri.toString());
      }
    }
    if (!resources.length) {
      return;
    }
    this._updatePreloads(resources);
  }
  _updatePreloads(resources) {
    if (!this.webview) {
      return;
    }
    const mixedResourceRoots = [
      ...this.localResourceRootsCache || [],
      ...this._currentKernel ? [this._currentKernel.localResourceRoot] : []
    ];
    this.webview.localResourcesRoot = mixedResourceRoots;
    this._sendMessageToWebview({
      type: "preload",
      resources
    });
  }
  _sendMessageToWebview(message, transfer) {
    if (this._disposed) {
      return;
    }
    this.webview?.postMessage(message, transfer);
  }
  dispose() {
    this._disposed = true;
    this.webview?.dispose();
    this.webview = void 0;
    this.notebookEditor = null;
    this.insetMapping.clear();
    this.pendingWebviewIdleCreationRequest.clear();
    super.dispose();
  }
};
BackLayerWebView = __decorateClass([
  __decorateParam(6, IWebviewService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, INotebookService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, IWorkbenchEnvironmentService),
  __decorateParam(11, IFileDialogService),
  __decorateParam(12, IFileService),
  __decorateParam(13, IContextMenuService),
  __decorateParam(14, IContextKeyService),
  __decorateParam(15, IWorkspaceTrustManagementService),
  __decorateParam(16, IConfigurationService),
  __decorateParam(17, ILanguageService),
  __decorateParam(18, IWorkspaceContextService),
  __decorateParam(19, IEditorGroupsService),
  __decorateParam(20, IStorageService),
  __decorateParam(21, IPathService),
  __decorateParam(22, INotebookLoggingService),
  __decorateParam(23, IThemeService),
  __decorateParam(24, ITelemetryService)
], BackLayerWebView);
function copyBufferIfNeeded(buffer, transfer) {
  if (buffer.byteLength === buffer.buffer.byteLength) {
    return buffer;
  } else {
    const valueBytes = new Uint8Array(buffer);
    transfer.push(valueBytes.buffer);
    return valueBytes;
  }
}
function getTokenizationCss() {
  const colorMap = TokenizationRegistry.getColorMap();
  const tokenizationCss = colorMap ? generateTokensCSSForColorMap(colorMap) : "";
  return tokenizationCss;
}
function tryDecodeURIComponent(uri) {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}
export {
  BackLayerWebView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvcmVuZGVyZXJzL2JhY2tMYXllcldlYlZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBnZXRXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElNb3VzZVdoZWVsRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBDb2RlV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHJ1bldoZW5HbG9iYWxJZGxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZGVjb2RlQmFzZTY0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZ2V0RXh0ZW5zaW9uRm9yTWltZVR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9taW1lLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MsIFNjaGVtYXMsIG1hdGNoZXNTY2hlbWUsIG1hdGNoZXNTb21lU2NoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCAqIGFzIG9zUGF0aCBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGlzTWFjaW50b3NoLCBpc1dlYiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGRpcm5hbWUsIGV4dG5hbWUsIGlzRXF1YWwsIGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBVVUlEIGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVUb2tlbnNDU1NGb3JDb2xvck1hcCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL3N1cHBvcnRzL3Rva2VuaXphdGlvbi5qcyc7XG5pbXBvcnQgeyB0b2tlbml6ZVRvU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvdGV4dFRvSHRtbFRva2VuaXplci5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElGaWxlRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSVRleHRFZGl0b3JPcHRpb25zLCBJVGV4dEVkaXRvclNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBlZGl0b3JGaW5kTWF0Y2gsIGVkaXRvckZpbmRNYXRjaEhpZ2hsaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIFRoZW1hYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IENlbGxFZGl0U3RhdGUsIElDZWxsT3V0cHV0Vmlld01vZGVsLCBJQ2VsbFZpZXdNb2RlbCwgSUNvbW1vbkNlbGxJbmZvLCBJRGlzcGxheU91dHB1dExheW91dFVwZGF0ZVJlcXVlc3QsIElEaXNwbGF5T3V0cHV0Vmlld01vZGVsLCBJRm9jdXNOb3RlYm9va0NlbGxPcHRpb25zLCBJR2VuZXJpY0NlbGxWaWV3TW9kZWwsIElJbnNldFJlbmRlck91dHB1dCwgSU5vdGVib29rRWRpdG9yQ3JlYXRpb25PcHRpb25zLCBJTm90ZWJvb2tXZWJ2aWV3TWVzc2FnZSwgUmVuZGVyT3V0cHV0VHlwZSB9IGZyb20gJy4uLy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19XRUJWSUVXX0JPVU5EQVJZIH0gZnJvbSAnLi4vbm90ZWJvb2tDZWxsTGlzdC5qcyc7XG5pbXBvcnQgeyBwcmVsb2Fkc1NjcmlwdFN0ciB9IGZyb20gJy4vd2Vidmlld1ByZWxvYWRzLmpzJztcbmltcG9ydCB7IHRyYW5zZm9ybVdlYnZpZXdUaGVtZVZhcnMgfSBmcm9tICcuL3dlYnZpZXdUaGVtZU1hcHBpbmcuanMnO1xuaW1wb3J0IHsgTWFya3VwQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL3ZpZXdNb2RlbC9tYXJrdXBDZWxsVmlld01vZGVsLmpzJztcbmltcG9ydCB7IENlbGxVcmksIElDZWxsT3V0cHV0LCBJTm90ZWJvb2tSZW5kZXJlckluZm8sIFJlbmRlcmVyTWVzc2FnaW5nU3BlYyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tLZXJuZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tLZXJuZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0xvZ2dpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rTG9nZ2luZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVNjb3BlZFJlbmRlcmVyTWVzc2FnaW5nIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rUmVuZGVyZXJNZXNzYWdpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXZWJ2aWV3RWxlbWVudCwgSVdlYnZpZXdTZXJ2aWNlLCBXZWJ2aWV3Q29udGVudFB1cnBvc2UsIFdlYnZpZXdPcmlnaW5TdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL3dlYnZpZXcvYnJvd3Nlci93ZWJ2aWV3LmpzJztcbmltcG9ydCB7IFdlYnZpZXdXaW5kb3dEcmFnTW9uaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3dlYnZpZXcvYnJvd3Nlci93ZWJ2aWV3V2luZG93RHJhZ01vbml0b3IuanMnO1xuaW1wb3J0IHsgYXNXZWJ2aWV3VXJpLCB3ZWJ2aWV3R2VuZXJpY0NzcFNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3dlYnZpZXcvY29tbW9uL3dlYnZpZXcuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwLCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGcm9tV2Vidmlld01lc3NhZ2UsIElBY2tPdXRwdXRIZWlnaHQsIElDbGlja2VkRGF0YVVybE1lc3NhZ2UsIElDb2RlQmxvY2tIaWdobGlnaHRSZXF1ZXN0LCBJQ29udGVudFdpZGdldFRvcFJlcXVlc3QsIElDb250cm9sbGVyUHJlbG9hZCwgSUNyZWF0aW9uQ29udGVudCwgSUNyZWF0aW9uUmVxdWVzdE1lc3NhZ2UsIElGaW5kTWF0Y2gsIElNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb24sIFJlbmRlcmVyTWV0YWRhdGEsIFN0YXRpY1ByZWxvYWRNZXRhZGF0YSwgVG9XZWJ2aWV3TWVzc2FnZSB9IGZyb20gJy4vd2Vidmlld01lc3NhZ2VzLmpzJztcblxuY29uc3QgTElORV9DT0xVTU5fUkVHRVggPSAvOihbXFxkXSspKD86OihbXFxkXSspKT8kLztcbmNvbnN0IExpbmVRdWVyeVJlZ2V4ID0gL2xpbmU9KFxcZCspJC87XG5jb25zdCBGUkFHTUVOVF9SRUdFWCA9IC9eKC4qKSMoW14jXSopJC87XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNhY2hlZEluc2V0PEsgZXh0ZW5kcyBJQ29tbW9uQ2VsbEluZm8+IHtcblx0b3V0cHV0SWQ6IHN0cmluZztcblx0dmVyc2lvbklkOiBudW1iZXI7XG5cdGNlbGxJbmZvOiBLO1xuXHRyZW5kZXJlcj86IElOb3RlYm9va1JlbmRlcmVySW5mbztcblx0Y2FjaGVkQ3JlYXRpb246IElDcmVhdGlvblJlcXVlc3RNZXNzYWdlO1xuXHRpbml0aWFsaXplZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlc29sdmVkQmFja0xheWVyV2VidmlldyB7XG5cdHdlYnZpZXc6IElXZWJ2aWV3RWxlbWVudDtcbn1cblxuLyoqXG4gKiBOb3RlYm9vayBFZGl0b3IgRGVsZWdhdGUgZm9yIGJhY2sgbGF5ZXIgd2Vidmlld1xuICovXG5leHBvcnQgaW50ZXJmYWNlIElOb3RlYm9va0RlbGVnYXRlRm9yV2VidmlldyB7XG5cdHJlYWRvbmx5IGNyZWF0aW9uT3B0aW9uczogSU5vdGVib29rRWRpdG9yQ3JlYXRpb25PcHRpb25zO1xuXHRnZXRDZWxsQnlJZChjZWxsSWQ6IHN0cmluZyk6IElHZW5lcmljQ2VsbFZpZXdNb2RlbCB8IHVuZGVmaW5lZDtcblx0Zm9jdXNOb3RlYm9va0NlbGwoY2VsbDogSUdlbmVyaWNDZWxsVmlld01vZGVsLCBmb2N1czogJ2VkaXRvcicgfCAnY29udGFpbmVyJyB8ICdvdXRwdXQnLCBvcHRpb25zPzogSUZvY3VzTm90ZWJvb2tDZWxsT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdHRvZ2dsZU5vdGVib29rQ2VsbFNlbGVjdGlvbihjZWxsOiBJR2VuZXJpY0NlbGxWaWV3TW9kZWwsIHNlbGVjdEZyb21QcmV2aW91czogYm9vbGVhbik6IHZvaWQ7XG5cdGdldENlbGxCeUluZm8oY2VsbEluZm86IElDb21tb25DZWxsSW5mbyk6IElHZW5lcmljQ2VsbFZpZXdNb2RlbDtcblx0Zm9jdXNOZXh0Tm90ZWJvb2tDZWxsKGNlbGw6IElHZW5lcmljQ2VsbFZpZXdNb2RlbCwgZm9jdXM6ICdlZGl0b3InIHwgJ2NvbnRhaW5lcicgfCAnb3V0cHV0Jyk6IFByb21pc2U8dm9pZD47XG5cdHVwZGF0ZU91dHB1dEhlaWdodChjZWxsSW5mbzogSUNvbW1vbkNlbGxJbmZvLCBvdXRwdXQ6IElEaXNwbGF5T3V0cHV0Vmlld01vZGVsLCBoZWlnaHQ6IG51bWJlciwgaXNJbml0OiBib29sZWFuLCBzb3VyY2U/OiBzdHJpbmcpOiB2b2lkO1xuXHRzY2hlZHVsZU91dHB1dEhlaWdodEFjayhjZWxsSW5mbzogSUNvbW1vbkNlbGxJbmZvLCBvdXRwdXRJZDogc3RyaW5nLCBoZWlnaHQ6IG51bWJlcik6IHZvaWQ7XG5cdHVwZGF0ZU1hcmt1cENlbGxIZWlnaHQoY2VsbElkOiBzdHJpbmcsIGhlaWdodDogbnVtYmVyLCBpc0luaXQ6IGJvb2xlYW4pOiB2b2lkO1xuXHRzZXRNYXJrdXBDZWxsRWRpdFN0YXRlKGNlbGxJZDogc3RyaW5nLCBlZGl0U3RhdGU6IENlbGxFZGl0U3RhdGUpOiB2b2lkO1xuXHRkaWRTdGFydERyYWdNYXJrdXBDZWxsKGNlbGxJZDogc3RyaW5nLCBldmVudDogeyBkcmFnT2Zmc2V0WTogbnVtYmVyIH0pOiB2b2lkO1xuXHRkaWREcmFnTWFya3VwQ2VsbChjZWxsSWQ6IHN0cmluZywgZXZlbnQ6IHsgZHJhZ09mZnNldFk6IG51bWJlciB9KTogdm9pZDtcblx0ZGlkRHJvcE1hcmt1cENlbGwoY2VsbElkOiBzdHJpbmcsIGV2ZW50OiB7IGRyYWdPZmZzZXRZOiBudW1iZXI7IGN0cmxLZXk6IGJvb2xlYW47IGFsdEtleTogYm9vbGVhbiB9KTogdm9pZDtcblx0ZGlkRW5kRHJhZ01hcmt1cENlbGwoY2VsbElkOiBzdHJpbmcpOiB2b2lkO1xuXHRkaWRSZXNpemVPdXRwdXQoY2VsbElkOiBzdHJpbmcpOiB2b2lkO1xuXHRzZXRTY3JvbGxUb3Aoc2Nyb2xsVG9wOiBudW1iZXIpOiB2b2lkO1xuXHR0cmlnZ2VyU2Nyb2xsKGV2ZW50OiBJTW91c2VXaGVlbEV2ZW50KTogdm9pZDtcblx0dXBkYXRlUGVyZm9ybWFuY2VNZXRhZGF0YShjZWxsSWQ6IHN0cmluZywgZXhlY3V0aW9uSWQ6IHN0cmluZywgZHVyYXRpb246IG51bWJlciwgcmVuZGVyZXJJZDogc3RyaW5nKTogdm9pZDtcblx0ZGlkRm9jdXNPdXRwdXRJbnB1dENoYW5nZShpbnB1dEZvY3VzZWQ6IGJvb2xlYW4pOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgQmFja2xheWVyV2Vidmlld09wdGlvbnMge1xuXHRyZWFkb25seSBvdXRwdXROb2RlUGFkZGluZzogbnVtYmVyO1xuXHRyZWFkb25seSBvdXRwdXROb2RlTGVmdFBhZGRpbmc6IG51bWJlcjtcblx0cmVhZG9ubHkgcHJldmlld05vZGVQYWRkaW5nOiBudW1iZXI7XG5cdHJlYWRvbmx5IG1hcmtkb3duTGVmdE1hcmdpbjogbnVtYmVyO1xuXHRyZWFkb25seSBsZWZ0TWFyZ2luOiBudW1iZXI7XG5cdHJlYWRvbmx5IHJpZ2h0TWFyZ2luOiBudW1iZXI7XG5cdHJlYWRvbmx5IHJ1bkd1dHRlcjogbnVtYmVyO1xuXHRyZWFkb25seSBkcmFnQW5kRHJvcEVuYWJsZWQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGZvbnRTaXplOiBudW1iZXI7XG5cdHJlYWRvbmx5IG91dHB1dEZvbnRTaXplOiBudW1iZXI7XG5cdHJlYWRvbmx5IGZvbnRGYW1pbHk6IHN0cmluZztcblx0cmVhZG9ubHkgb3V0cHV0Rm9udEZhbWlseTogc3RyaW5nO1xuXHRyZWFkb25seSBtYXJrdXBGb250U2l6ZTogbnVtYmVyO1xuXHRyZWFkb25seSBtYXJrZG93bkxpbmVIZWlnaHQ6IG51bWJlcjtcblx0cmVhZG9ubHkgb3V0cHV0TGluZUhlaWdodDogbnVtYmVyO1xuXHRyZWFkb25seSBvdXRwdXRTY3JvbGxpbmc6IGJvb2xlYW47XG5cdHJlYWRvbmx5IG91dHB1dFdvcmRXcmFwOiBib29sZWFuO1xuXHRyZWFkb25seSBvdXRwdXRMaW5lTGltaXQ6IG51bWJlcjtcblx0cmVhZG9ubHkgb3V0cHV0TGlua2lmeUZpbGVQYXRoczogYm9vbGVhbjtcblx0cmVhZG9ubHkgbWluaW1hbEVycm9yOiBib29sZWFuO1xuXHRyZWFkb25seSBtYXJrdXBGb250RmFtaWx5OiBzdHJpbmc7XG59XG5cblxuZXhwb3J0IGNsYXNzIEJhY2tMYXllcldlYlZpZXc8VCBleHRlbmRzIElDb21tb25DZWxsSW5mbz4gZXh0ZW5kcyBUaGVtYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX29yaWdpblN0b3JlPzogV2Vidmlld09yaWdpblN0b3JlO1xuXG5cdHByaXZhdGUgc3RhdGljIGdldE9yaWdpblN0b3JlKHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpOiBXZWJ2aWV3T3JpZ2luU3RvcmUge1xuXHRcdHRoaXMuX29yaWdpblN0b3JlID8/PSBuZXcgV2Vidmlld09yaWdpblN0b3JlKCdub3RlYm9vay5iYWNrbGF5ZXJXZWJ2aWV3Lm9yaWdpbnMnLCBzdG9yYWdlU2VydmljZSk7XG5cdFx0cmV0dXJuIHRoaXMuX29yaWdpblN0b3JlO1xuXHR9XG5cblx0ZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHdlYnZpZXc6IElXZWJ2aWV3RWxlbWVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0aW5zZXRNYXBwaW5nOiBNYXA8SURpc3BsYXlPdXRwdXRWaWV3TW9kZWwsIElDYWNoZWRJbnNldDxUPj4gPSBuZXcgTWFwKCk7XG5cdHBlbmRpbmdXZWJ2aWV3SWRsZUNyZWF0aW9uUmVxdWVzdDogTWFwPElEaXNwbGF5T3V0cHV0Vmlld01vZGVsLCBJRGlzcG9zYWJsZT4gPSBuZXcgTWFwKCk7XG5cdHBlbmRpbmdXZWJ2aWV3SWRsZUluc2V0TWFwcGluZzogTWFwPElEaXNwbGF5T3V0cHV0Vmlld01vZGVsLCBJQ2FjaGVkSW5zZXQ8VD4+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIHJldmVyc2VkUGVuZGluZ1dlYnZpZXdJZGxlSW5zZXRNYXBwaW5nOiBNYXA8c3RyaW5nLCBJRGlzcGxheU91dHB1dFZpZXdNb2RlbD4gPSBuZXcgTWFwKCk7XG5cblx0cmVhZG9ubHkgbWFya3VwUHJldmlld01hcHBpbmcgPSBuZXcgTWFwPHN0cmluZywgSU1hcmt1cENlbGxJbml0aWFsaXphdGlvbj4oKTtcblx0cHJpdmF0ZSBoaWRkZW5JbnNldE1hcHBpbmc6IFNldDxJRGlzcGxheU91dHB1dFZpZXdNb2RlbD4gPSBuZXcgU2V0KCk7XG5cdHByaXZhdGUgcmV2ZXJzZWRJbnNldE1hcHBpbmc6IE1hcDxzdHJpbmcsIElEaXNwbGF5T3V0cHV0Vmlld01vZGVsPiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSBsb2NhbFJlc291cmNlUm9vdHNDYWNoZTogVVJJW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTWVzc2FnZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElOb3RlYm9va1dlYnZpZXdNZXNzYWdlPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJlbG9hZHNDYWNoZSA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25NZXNzYWdlOiBFdmVudDxJTm90ZWJvb2tXZWJ2aWV3TWVzc2FnZT4gPSB0aGlzLl9vbk1lc3NhZ2UuZXZlbnQ7XG5cdHByaXZhdGUgX2Rpc3Bvc2VkID0gZmFsc2U7XG5cdHByaXZhdGUgX2N1cnJlbnRLZXJuZWw/OiBJTm90ZWJvb2tLZXJuZWw7XG5cblx0cHJpdmF0ZSBmaXJzdEluaXQgPSB0cnVlO1xuXHRwcml2YXRlIGluaXRpYWxpemVNYXJrdXBQcm9taXNlPzogeyByZWFkb25seSByZXF1ZXN0SWQ6IHN0cmluZzsgcmVhZG9ubHkgcDogRGVmZXJyZWRQcm9taXNlPHZvaWQ+OyByZWFkb25seSBpc0ZpcnN0SW5pdDogYm9vbGVhbiB9O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbm9uY2UgPSBVVUlELmdlbmVyYXRlVXVpZCgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyBub3RlYm9va0VkaXRvcjogSU5vdGVib29rRGVsZWdhdGVGb3JXZWJ2aWV3LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaWQ6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbm90ZWJvb2tWaWV3VHlwZTogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBkb2N1bWVudFVyaTogVVJJLFxuXHRcdHByaXZhdGUgb3B0aW9uczogQmFja2xheWVyV2Vidmlld09wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSByZW5kZXJlck1lc3NhZ2luZzogSVNjb3BlZFJlbmRlcmVyTWVzc2FnaW5nIHwgdW5kZWZpbmVkLFxuXHRcdEBJV2Vidmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3ZWJ2aWV3U2VydmljZTogSVdlYnZpZXdTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJRmlsZURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlRGlhbG9nU2VydmljZTogSUZpbGVEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElQYXRoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0xvZ2dpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tMb2dTZXJ2aWNlOiBJTm90ZWJvb2tMb2dnaW5nU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIodGhlbWVTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX2xvZ1JlbmRlcmVyRGVidWdNZXNzYWdlKCdDcmVhdGluZyBiYWNrbGF5ZXIgd2VidmlldyBmb3Igbm90ZWJvb2snKTtcblxuXHRcdHRoaXMuZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG5cdFx0dGhpcy5lbGVtZW50LnN0eWxlLmhlaWdodCA9ICcxNDAwcHgnO1xuXHRcdHRoaXMuZWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cblx0XHRpZiAocmVuZGVyZXJNZXNzYWdpbmcpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHJlbmRlcmVyTWVzc2FnaW5nKTtcblx0XHRcdHJlbmRlcmVyTWVzc2FnaW5nLnJlY2VpdmVNZXNzYWdlSGFuZGxlciA9IChyZW5kZXJlcklkLCBtZXNzYWdlKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy53ZWJ2aWV3IHx8IHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHRcdFx0X192c2NvZGVfbm90ZWJvb2tfbWVzc2FnZTogdHJ1ZSxcblx0XHRcdFx0XHR0eXBlOiAnY3VzdG9tUmVuZGVyZXJNZXNzYWdlJyxcblx0XHRcdFx0XHRyZW5kZXJlcklkOiByZW5kZXJlcklkLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IG1lc3NhZ2Vcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIod29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZVRydXN0KGUgPT4ge1xuXHRcdFx0Y29uc3QgYmFzZVVybCA9IHRoaXMuYXNXZWJ2aWV3VXJpKHRoaXMuZ2V0Tm90ZWJvb2tCYXNlVXJpKCksIHVuZGVmaW5lZCk7XG5cdFx0XHRjb25zdCBodG1sQ29udGVudCA9IHRoaXMuZ2VuZXJhdGVDb250ZW50KGJhc2VVcmwudG9TdHJpbmcoKSk7XG5cdFx0XHR0aGlzLndlYnZpZXc/LnNldEh0bWwoaHRtbENvbnRlbnQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKFRva2VuaXphdGlvblJlZ2lzdHJ5Lm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdFx0dHlwZTogJ3Rva2VuaXplZFN0eWxlc0NoYW5nZWQnLFxuXHRcdFx0XHRjc3M6IGdldFRva2VuaXphdGlvbkNzcygpLFxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0dXBkYXRlT3B0aW9ucyhvcHRpb25zOiBCYWNrbGF5ZXJXZWJ2aWV3T3B0aW9ucykge1xuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0dGhpcy5fdXBkYXRlU3R5bGVzKCk7XG5cdFx0dGhpcy5fdXBkYXRlT3B0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbG9nUmVuZGVyZXJEZWJ1Z01lc3NhZ2UobXNnOiBzdHJpbmcpIHtcblx0XHR0aGlzLm5vdGVib29rTG9nU2VydmljZS5kZWJ1ZygnQmFja2xheWVyV2VidmlldycsIGAke3RoaXMuZG9jdW1lbnRVcml9ICgke3RoaXMuaWR9KSAtICR7bXNnfWApO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlU3R5bGVzKCkge1xuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICdub3RlYm9va1N0eWxlcycsXG5cdFx0XHRzdHlsZXM6IHRoaXMuX2dlbmVyYXRlU3R5bGVzKClcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZU9wdGlvbnMoKSB7XG5cdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0dHlwZTogJ25vdGVib29rT3B0aW9ucycsXG5cdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdGRyYWdBbmREcm9wRW5hYmxlZDogdGhpcy5vcHRpb25zLmRyYWdBbmREcm9wRW5hYmxlZFxuXHRcdFx0fSxcblx0XHRcdHJlbmRlck9wdGlvbnM6IHtcblx0XHRcdFx0bGluZUxpbWl0OiB0aGlzLm9wdGlvbnMub3V0cHV0TGluZUxpbWl0LFxuXHRcdFx0XHRvdXRwdXRTY3JvbGxpbmc6IHRoaXMub3B0aW9ucy5vdXRwdXRTY3JvbGxpbmcsXG5cdFx0XHRcdG91dHB1dFdvcmRXcmFwOiB0aGlzLm9wdGlvbnMub3V0cHV0V29yZFdyYXAsXG5cdFx0XHRcdGxpbmtpZnlGaWxlUGF0aHM6IHRoaXMub3B0aW9ucy5vdXRwdXRMaW5raWZ5RmlsZVBhdGhzLFxuXHRcdFx0XHRtaW5pbWFsRXJyb3I6IHRoaXMub3B0aW9ucy5taW5pbWFsRXJyb3Jcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX2dlbmVyYXRlU3R5bGVzKCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHQnbm90ZWJvb2stb3V0cHV0LWxlZnQtbWFyZ2luJzogYCR7dGhpcy5vcHRpb25zLmxlZnRNYXJnaW4gKyB0aGlzLm9wdGlvbnMucnVuR3V0dGVyfXB4YCxcblx0XHRcdCdub3RlYm9vay1vdXRwdXQtd2lkdGgnOiBgY2FsYygxMDAlIC0gJHt0aGlzLm9wdGlvbnMubGVmdE1hcmdpbiArIHRoaXMub3B0aW9ucy5yaWdodE1hcmdpbiArIHRoaXMub3B0aW9ucy5ydW5HdXR0ZXJ9cHgpYCxcblx0XHRcdCdub3RlYm9vay1vdXRwdXQtbm9kZS1wYWRkaW5nJzogYCR7dGhpcy5vcHRpb25zLm91dHB1dE5vZGVQYWRkaW5nfXB4YCxcblx0XHRcdCdub3RlYm9vay1ydW4tZ3V0dGVyJzogYCR7dGhpcy5vcHRpb25zLnJ1bkd1dHRlcn1weGAsXG5cdFx0XHQnbm90ZWJvb2stcHJldmlldy1ub2RlLXBhZGRpbmcnOiBgJHt0aGlzLm9wdGlvbnMucHJldmlld05vZGVQYWRkaW5nfXB4YCxcblx0XHRcdCdub3RlYm9vay1tYXJrZG93bi1sZWZ0LW1hcmdpbic6IGAke3RoaXMub3B0aW9ucy5tYXJrZG93bkxlZnRNYXJnaW59cHhgLFxuXHRcdFx0J25vdGVib29rLW91dHB1dC1ub2RlLWxlZnQtcGFkZGluZyc6IGAke3RoaXMub3B0aW9ucy5vdXRwdXROb2RlTGVmdFBhZGRpbmd9cHhgLFxuXHRcdFx0J25vdGVib29rLW1hcmtkb3duLW1pbi1oZWlnaHQnOiBgJHt0aGlzLm9wdGlvbnMucHJldmlld05vZGVQYWRkaW5nICogMn1weGAsXG5cdFx0XHQnbm90ZWJvb2stbWFya3VwLWZvbnQtc2l6ZSc6IHR5cGVvZiB0aGlzLm9wdGlvbnMubWFya3VwRm9udFNpemUgPT09ICdudW1iZXInICYmIHRoaXMub3B0aW9ucy5tYXJrdXBGb250U2l6ZSA+IDAgPyBgJHt0aGlzLm9wdGlvbnMubWFya3VwRm9udFNpemV9cHhgIDogYGNhbGMoJHt0aGlzLm9wdGlvbnMuZm9udFNpemV9cHggKiAxLjIpYCxcblx0XHRcdCdub3RlYm9vay1tYXJrZG93bi1saW5lLWhlaWdodCc6IHR5cGVvZiB0aGlzLm9wdGlvbnMubWFya2Rvd25MaW5lSGVpZ2h0ID09PSAnbnVtYmVyJyAmJiB0aGlzLm9wdGlvbnMubWFya2Rvd25MaW5lSGVpZ2h0ID4gMCA/IGAke3RoaXMub3B0aW9ucy5tYXJrZG93bkxpbmVIZWlnaHR9cHhgIDogYG5vcm1hbGAsXG5cdFx0XHQnbm90ZWJvb2stY2VsbC1vdXRwdXQtZm9udC1zaXplJzogYCR7dGhpcy5vcHRpb25zLm91dHB1dEZvbnRTaXplIHx8IHRoaXMub3B0aW9ucy5mb250U2l6ZX1weGAsXG5cdFx0XHQnbm90ZWJvb2stY2VsbC1vdXRwdXQtbGluZS1oZWlnaHQnOiBgJHt0aGlzLm9wdGlvbnMub3V0cHV0TGluZUhlaWdodH1weGAsXG5cdFx0XHQnbm90ZWJvb2stY2VsbC1vdXRwdXQtbWF4LWhlaWdodCc6IGAke3RoaXMub3B0aW9ucy5vdXRwdXRMaW5lSGVpZ2h0ICogdGhpcy5vcHRpb25zLm91dHB1dExpbmVMaW1pdCArIDJ9cHhgLFxuXHRcdFx0J25vdGVib29rLWNlbGwtb3V0cHV0LWZvbnQtZmFtaWx5JzogdGhpcy5vcHRpb25zLm91dHB1dEZvbnRGYW1pbHkgfHwgdGhpcy5vcHRpb25zLmZvbnRGYW1pbHksXG5cdFx0XHQnbm90ZWJvb2stY2VsbC1tYXJrdXAtZW1wdHktY29udGVudCc6IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suZW1wdHlNYXJrZG93blBsYWNlaG9sZGVyJywgXCJFbXB0eSBtYXJrZG93biBjZWxsLCBkb3VibGUtY2xpY2sgb3IgcHJlc3MgZW50ZXIgdG8gZWRpdC5cIiksXG5cdFx0XHQnbm90ZWJvb2stY2VsbC1yZW5kZXJlci1ub3QtZm91bmQtZXJyb3InOiBubHMubG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICdub3RlYm9vay5lcnJvci5yZW5kZXJlck5vdEZvdW5kJyxcblx0XHRcdFx0Y29tbWVudDogWyckMCBpcyBhIHBsYWNlaG9sZGVyIGZvciB0aGUgbWltZSB0eXBlJ11cblx0XHRcdH0sIFwiTm8gcmVuZGVyZXIgZm91bmQgZm9yICckMCdcIiksXG5cdFx0XHQnbm90ZWJvb2stY2VsbC1yZW5kZXJlci1mYWxsYmFja3MtZXhoYXVzdGVkJzogbmxzLmxvY2FsaXplKHtcblx0XHRcdFx0a2V5OiAnbm90ZWJvb2suZXJyb3IucmVuZGVyZXJGYWxsYmFja3NFeGhhdXN0ZWQnLFxuXHRcdFx0XHRjb21tZW50OiBbJyQwIGlzIGEgcGxhY2Vob2xkZXIgZm9yIHRoZSBtaW1lIHR5cGUnXVxuXHRcdFx0fSwgXCJDb3VsZCBub3QgcmVuZGVyIGNvbnRlbnQgZm9yICckMCdcIiksXG5cdFx0XHQnbm90ZWJvb2stbWFya3VwLWZvbnQtZmFtaWx5JzogdGhpcy5vcHRpb25zLm1hcmt1cEZvbnRGYW1pbHksXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZ2VuZXJhdGVDb250ZW50KGJhc2VVcmw6IHN0cmluZykge1xuXHRcdGNvbnN0IHJlbmRlcmVyc0RhdGEgPSB0aGlzLmdldFJlbmRlcmVyRGF0YSgpO1xuXHRcdGNvbnN0IHByZWxvYWRzRGF0YSA9IHRoaXMuZ2V0U3RhdGljUHJlbG9hZHNEYXRhKCk7XG5cdFx0Y29uc3QgcmVuZGVyT3B0aW9ucyA9IHtcblx0XHRcdGxpbmVMaW1pdDogdGhpcy5vcHRpb25zLm91dHB1dExpbmVMaW1pdCxcblx0XHRcdG91dHB1dFNjcm9sbGluZzogdGhpcy5vcHRpb25zLm91dHB1dFNjcm9sbGluZyxcblx0XHRcdG91dHB1dFdvcmRXcmFwOiB0aGlzLm9wdGlvbnMub3V0cHV0V29yZFdyYXAsXG5cdFx0XHRsaW5raWZ5RmlsZVBhdGhzOiB0aGlzLm9wdGlvbnMub3V0cHV0TGlua2lmeUZpbGVQYXRocyxcblx0XHRcdG1pbmltYWxFcnJvcjogdGhpcy5vcHRpb25zLm1pbmltYWxFcnJvclxuXHRcdH07XG5cdFx0Y29uc3QgcHJlbG9hZFNjcmlwdCA9IHByZWxvYWRzU2NyaXB0U3RyKFxuXHRcdFx0e1xuXHRcdFx0XHQuLi50aGlzLm9wdGlvbnMsXG5cdFx0XHRcdHRva2VuaXphdGlvbkNzczogZ2V0VG9rZW5pemF0aW9uQ3NzKCksXG5cdFx0XHR9LFxuXHRcdFx0eyBkcmFnQW5kRHJvcEVuYWJsZWQ6IHRoaXMub3B0aW9ucy5kcmFnQW5kRHJvcEVuYWJsZWQgfSxcblx0XHRcdHJlbmRlck9wdGlvbnMsXG5cdFx0XHRyZW5kZXJlcnNEYXRhLFxuXHRcdFx0cHJlbG9hZHNEYXRhLFxuXHRcdFx0dGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpLFxuXHRcdFx0dGhpcy5ub25jZSk7XG5cblx0XHRjb25zdCBlbmFibGVDc3AgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdub3RlYm9vay5leHBlcmltZW50YWwuZW5hYmxlQ3NwJyk7XG5cdFx0Y29uc3QgY3VycmVudEhpZ2hsaWdodCA9IHRoaXMuZ2V0Q29sb3IoZWRpdG9yRmluZE1hdGNoKTtcblx0XHRjb25zdCBmaW5kTWF0Y2hIaWdobGlnaHQgPSB0aGlzLmdldENvbG9yKGVkaXRvckZpbmRNYXRjaEhpZ2hsaWdodCk7XG5cdFx0cmV0dXJuIC8qIGh0bWwgKi9gXG5cdFx0PGh0bWwgbGFuZz1cImVuXCI+XG5cdFx0XHQ8aGVhZD5cblx0XHRcdFx0PG1ldGEgY2hhcnNldD1cIlVURi04XCI+XG5cdFx0XHRcdDxiYXNlIGhyZWY9XCIke2Jhc2VVcmx9L1wiIC8+XG5cdFx0XHRcdCR7ZW5hYmxlQ3NwID9cblx0XHRcdFx0YDxtZXRhIGh0dHAtZXF1aXY9XCJDb250ZW50LVNlY3VyaXR5LVBvbGljeVwiIGNvbnRlbnQ9XCJcblx0XHRcdFx0XHRkZWZhdWx0LXNyYyAnbm9uZSc7XG5cdFx0XHRcdFx0c2NyaXB0LXNyYyAke3dlYnZpZXdHZW5lcmljQ3NwU291cmNlfSAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJztcblx0XHRcdFx0XHRzdHlsZS1zcmMgJHt3ZWJ2aWV3R2VuZXJpY0NzcFNvdXJjZX0gJ3Vuc2FmZS1pbmxpbmUnO1xuXHRcdFx0XHRcdGltZy1zcmMgJHt3ZWJ2aWV3R2VuZXJpY0NzcFNvdXJjZX0gaHR0cHM6IGh0dHA6IGRhdGE6O1xuXHRcdFx0XHRcdGZvbnQtc3JjICR7d2Vidmlld0dlbmVyaWNDc3BTb3VyY2V9IGh0dHBzOjtcblx0XHRcdFx0XHRjb25uZWN0LXNyYyBodHRwczo7XG5cdFx0XHRcdFx0Y2hpbGQtc3JjIGh0dHBzOiBkYXRhOjtcblx0XHRcdFx0XCI+YCA6ICcnfVxuXHRcdFx0XHQ8c3R5bGUgbm9uY2U9XCIke3RoaXMubm9uY2V9XCI+XG5cdFx0XHRcdFx0OjpoaWdobGlnaHQoZmluZC1oaWdobGlnaHQpIHtcblx0XHRcdFx0XHRcdGJhY2tncm91bmQtY29sb3I6IHZhcigtLXZzY29kZS1lZGl0b3ItZmluZE1hdGNoQmFja2dyb3VuZCwgJHtmaW5kTWF0Y2hIaWdobGlnaHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQ6OmhpZ2hsaWdodChjdXJyZW50LWZpbmQtaGlnaGxpZ2h0KSB7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS12c2NvZGUtZWRpdG9yLWZpbmRNYXRjaEhpZ2hsaWdodEJhY2tncm91bmQsICR7Y3VycmVudEhpZ2hsaWdodH0pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdCNjb250YWluZXIgLmNlbGxfY29udGFpbmVyIHtcblx0XHRcdFx0XHRcdHdpZHRoOiAxMDAlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdCNjb250YWluZXIgLm91dHB1dF9jb250YWluZXIge1xuXHRcdFx0XHRcdFx0d2lkdGg6IDEwMCU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0I2NvbnRhaW5lciAuY2VsbF9jb250YWluZXIubmItaW5zZXJ0SGlnaGxpZ2h0IGRpdi5vdXRwdXRfY29udGFpbmVyIGRpdi5vdXRwdXQge1xuXHRcdFx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdnNjb2RlLWRpZmZFZGl0b3ItaW5zZXJ0ZWRMaW5lQmFja2dyb3VuZCwgdmFyKC0tdnNjb2RlLWRpZmZFZGl0b3ItaW5zZXJ0ZWRUZXh0QmFja2dyb3VuZCkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdCNjb250YWluZXIgPiBkaXYgPiBkaXYgPiBkaXYub3V0cHV0IHtcblx0XHRcdFx0XHRcdGZvbnQtc2l6ZTogdmFyKC0tbm90ZWJvb2stY2VsbC1vdXRwdXQtZm9udC1zaXplKTtcblx0XHRcdFx0XHRcdHdpZHRoOiB2YXIoLS1ub3RlYm9vay1vdXRwdXQtd2lkdGgpO1xuXHRcdFx0XHRcdFx0bWFyZ2luLWxlZnQ6IHZhcigtLW5vdGVib29rLW91dHB1dC1sZWZ0LW1hcmdpbik7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS10aGVtZS1ub3RlYm9vay1vdXRwdXQtYmFja2dyb3VuZCk7XG5cdFx0XHRcdFx0XHRwYWRkaW5nLXRvcDogdmFyKC0tbm90ZWJvb2stb3V0cHV0LW5vZGUtcGFkZGluZyk7XG5cdFx0XHRcdFx0XHRwYWRkaW5nLXJpZ2h0OiB2YXIoLS1ub3RlYm9vay1vdXRwdXQtbm9kZS1wYWRkaW5nKTtcblx0XHRcdFx0XHRcdHBhZGRpbmctYm90dG9tOiB2YXIoLS1ub3RlYm9vay1vdXRwdXQtbm9kZS1wYWRkaW5nKTtcblx0XHRcdFx0XHRcdHBhZGRpbmctbGVmdDogdmFyKC0tbm90ZWJvb2stb3V0cHV0LW5vZGUtbGVmdC1wYWRkaW5nKTtcblx0XHRcdFx0XHRcdGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG5cdFx0XHRcdFx0XHRib3JkZXItdG9wOiBub25lO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8qIG1hcmtkb3duICovXG5cdFx0XHRcdFx0I2NvbnRhaW5lciBkaXYucHJldmlldyB7XG5cdFx0XHRcdFx0XHR3aWR0aDogMTAwJTtcblx0XHRcdFx0XHRcdHBhZGRpbmctcmlnaHQ6IHZhcigtLW5vdGVib29rLXByZXZpZXctbm9kZS1wYWRkaW5nKTtcblx0XHRcdFx0XHRcdHBhZGRpbmctbGVmdDogdmFyKC0tbm90ZWJvb2stbWFya2Rvd24tbGVmdC1tYXJnaW4pO1xuXHRcdFx0XHRcdFx0cGFkZGluZy10b3A6IHZhcigtLW5vdGVib29rLXByZXZpZXctbm9kZS1wYWRkaW5nKTtcblx0XHRcdFx0XHRcdHBhZGRpbmctYm90dG9tOiB2YXIoLS1ub3RlYm9vay1wcmV2aWV3LW5vZGUtcGFkZGluZyk7XG5cblx0XHRcdFx0XHRcdGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG5cdFx0XHRcdFx0XHR3aGl0ZS1zcGFjZTogbm93cmFwO1xuXHRcdFx0XHRcdFx0b3ZlcmZsb3c6IGhpZGRlbjtcblx0XHRcdFx0XHRcdHdoaXRlLXNwYWNlOiBpbml0aWFsO1xuXG5cdFx0XHRcdFx0XHRmb250LXNpemU6IHZhcigtLW5vdGVib29rLW1hcmt1cC1mb250LXNpemUpO1xuXHRcdFx0XHRcdFx0bGluZS1oZWlnaHQ6IHZhcigtLW5vdGVib29rLW1hcmtkb3duLWxpbmUtaGVpZ2h0KTtcblx0XHRcdFx0XHRcdGNvbG9yOiB2YXIoLS10aGVtZS11aS1mb3JlZ3JvdW5kKTtcblx0XHRcdFx0XHRcdGZvbnQtZmFtaWx5OiB2YXIoLS1ub3RlYm9vay1tYXJrdXAtZm9udC1mYW1pbHkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdCNjb250YWluZXIgZGl2LnByZXZpZXcuZHJhZ2dhYmxlIHtcblx0XHRcdFx0XHRcdHVzZXItc2VsZWN0OiBub25lO1xuXHRcdFx0XHRcdFx0LXdlYmtpdC11c2VyLXNlbGVjdDogbm9uZTtcblx0XHRcdFx0XHRcdC1tcy11c2VyLXNlbGVjdDogbm9uZTtcblx0XHRcdFx0XHRcdGN1cnNvcjogZ3JhYjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQjY29udGFpbmVyIGRpdi5wcmV2aWV3LnNlbGVjdGVkIHtcblx0XHRcdFx0XHRcdGJhY2tncm91bmQ6IHZhcigtLXRoZW1lLW5vdGVib29rLWNlbGwtc2VsZWN0ZWQtYmFja2dyb3VuZCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0I2NvbnRhaW5lciBkaXYucHJldmlldy5kcmFnZ2luZyB7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS10aGVtZS1iYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHRcdG9wYWNpdHk6IDAuNSAhaW1wb3J0YW50O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC5tb25hY28td29ya2JlbmNoLnZzLWRhcmsgLm5vdGVib29rT3ZlcmxheSAuY2VsbC5tYXJrZG93biAubGF0ZXggaW1nLFxuXHRcdFx0XHRcdC5tb25hY28td29ya2JlbmNoLnZzLWRhcmsgLm5vdGVib29rT3ZlcmxheSAuY2VsbC5tYXJrZG93biAubGF0ZXgtYmxvY2sgaW1nIHtcblx0XHRcdFx0XHRcdGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSlcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQjY29udGFpbmVyIC5tYXJrdXAgPiBkaXYubmItc3ltYm9sSGlnaGxpZ2h0IHtcblx0XHRcdFx0XHRcdGJhY2tncm91bmQtY29sb3I6IHZhcigtLXRoZW1lLW5vdGVib29rLXN5bWJvbC1oaWdobGlnaHQtYmFja2dyb3VuZCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0I2NvbnRhaW5lciAubWFya3VwID4gZGl2Lm5iLWluc2VydEhpZ2hsaWdodCB7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS12c2NvZGUtZGlmZkVkaXRvci1pbnNlcnRlZExpbmVCYWNrZ3JvdW5kLCB2YXIoLS12c2NvZGUtZGlmZkVkaXRvci1pbnNlcnRlZFRleHRCYWNrZ3JvdW5kKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0I2NvbnRhaW5lciAubmItc3ltYm9sSGlnaGxpZ2h0IC5vdXRwdXRfY29udGFpbmVyIC5vdXRwdXQge1xuXHRcdFx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdGhlbWUtbm90ZWJvb2stc3ltYm9sLWhpZ2hsaWdodC1iYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQjY29udGFpbmVyIC5tYXJrdXAgPiBkaXYubmItbXVsdGlDZWxsSGlnaGxpZ2h0IHtcblx0XHRcdFx0XHRcdGJhY2tncm91bmQtY29sb3I6IHZhcigtLXRoZW1lLW5vdGVib29rLXN5bWJvbC1oaWdobGlnaHQtYmFja2dyb3VuZCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0I2NvbnRhaW5lciAubmItbXVsdGlDZWxsSGlnaGxpZ2h0IC5vdXRwdXRfY29udGFpbmVyIC5vdXRwdXQge1xuXHRcdFx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdGhlbWUtbm90ZWJvb2stc3ltYm9sLWhpZ2hsaWdodC1iYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQjY29udGFpbmVyIC5uYi1jaGF0R2VuZXJhdGlvbkhpZ2hsaWdodCAub3V0cHV0X2NvbnRhaW5lciAub3V0cHV0IHtcblx0XHRcdFx0XHRcdGJhY2tncm91bmQtY29sb3I6IHZhcigtLXZzY29kZS1ub3RlYm9vay1zZWxlY3RlZENlbGxCYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQjY29udGFpbmVyID4gZGl2Lm5iLWNlbGxEZWxldGVkIC5vdXRwdXRfY29udGFpbmVyIHtcblx0XHRcdFx0XHRcdGJhY2tncm91bmQtY29sb3I6IHZhcigtLXRoZW1lLW5vdGVib29rLWRpZmYtcmVtb3ZlZC1iYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQjY29udGFpbmVyID4gZGl2Lm5iLWNlbGxBZGRlZCAub3V0cHV0X2NvbnRhaW5lciB7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS10aGVtZS1ub3RlYm9vay1kaWZmLWluc2VydGVkLWJhY2tncm91bmQpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdCNjb250YWluZXIgPiBkaXYgPiBkaXY6bm90KC5wcmV2aWV3KSA+IGRpdiB7XG5cdFx0XHRcdFx0XHRvdmVyZmxvdy14OiBhdXRvO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdCNjb250YWluZXIgLm5vLXJlbmRlcmVyLWVycm9yIHtcblx0XHRcdFx0XHRcdGNvbG9yOiB2YXIoLS12c2NvZGUtZWRpdG9yRXJyb3ItZm9yZWdyb3VuZCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ym9keSB7XG5cdFx0XHRcdFx0XHRwYWRkaW5nOiAwcHg7XG5cdFx0XHRcdFx0XHRoZWlnaHQ6IDEwMCU7XG5cdFx0XHRcdFx0XHR3aWR0aDogMTAwJTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0YWJsZSwgdGhlYWQsIHRyLCB0aCwgdGQsIHRib2R5IHtcblx0XHRcdFx0XHRcdGJvcmRlcjogbm9uZTtcblx0XHRcdFx0XHRcdGJvcmRlci1jb2xvcjogdHJhbnNwYXJlbnQ7XG5cdFx0XHRcdFx0XHRib3JkZXItc3BhY2luZzogMDtcblx0XHRcdFx0XHRcdGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGFibGUsIHRoLCB0ciB7XG5cdFx0XHRcdFx0XHR2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlO1xuXHRcdFx0XHRcdFx0dGV4dC1hbGlnbjogcmlnaHQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhlYWQge1xuXHRcdFx0XHRcdFx0Zm9udC13ZWlnaHQ6IGJvbGQ7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiByZ2JhKDEzMCwgMTMwLCAxMzAsIDAuMTYpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoLCB0ZCB7XG5cdFx0XHRcdFx0XHRwYWRkaW5nOiA0cHggOHB4O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRyOm50aC1jaGlsZChldmVuKSB7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiByZ2JhKDEzMCwgMTMwLCAxMzAsIDAuMDgpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRib2R5IHRoIHtcblx0XHRcdFx0XHRcdGZvbnQtd2VpZ2h0OiBub3JtYWw7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0LmZpbmQtbWF0Y2gge1xuXHRcdFx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdnNjb2RlLWVkaXRvci1maW5kTWF0Y2hIaWdobGlnaHRCYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQuY3VycmVudC1maW5kLW1hdGNoIHtcblx0XHRcdFx0XHRcdGJhY2tncm91bmQtY29sb3I6IHZhcigtLXZzY29kZS1lZGl0b3ItZmluZE1hdGNoQmFja2dyb3VuZCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0I19kZWZhdWx0Q29sb3JQYWxhdHRlIHtcblx0XHRcdFx0XHRcdGNvbG9yOiB2YXIoLS12c2NvZGUtZWRpdG9yLWZpbmRNYXRjaEhpZ2hsaWdodEJhY2tncm91bmQpO1xuXHRcdFx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdnNjb2RlLWVkaXRvci1maW5kTWF0Y2hCYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdDwvc3R5bGU+XG5cdFx0XHQ8L2hlYWQ+XG5cdFx0XHQ8Ym9keSBzdHlsZT1cIm92ZXJmbG93OiBoaWRkZW47XCI+XG5cdFx0XHRcdDxkaXYgaWQ9J2ZpbmRTdGFydCcgdGFiSW5kZXg9LTE+PC9kaXY+XG5cdFx0XHRcdDxkaXYgaWQ9J2NvbnRhaW5lcicgY2xhc3M9XCJ3aWRnZXRhcmVhXCIgc3R5bGU9XCJwb3NpdGlvbjogYWJzb2x1dGU7d2lkdGg6MTAwJTt0b3A6IDBweFwiPjwvZGl2PlxuXHRcdFx0XHQ8ZGl2IGlkPVwiX2RlZmF1bHRDb2xvclBhbGF0dGVcIj48L2Rpdj5cblx0XHRcdFx0PHNjcmlwdCB0eXBlPVwibW9kdWxlXCI+JHtwcmVsb2FkU2NyaXB0fTwvc2NyaXB0PlxuXHRcdFx0PC9ib2R5PlxuXHRcdDwvaHRtbD5gO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSZW5kZXJlckRhdGEoKTogUmVuZGVyZXJNZXRhZGF0YVtdIHtcblx0XHRyZXR1cm4gdGhpcy5ub3RlYm9va1NlcnZpY2UuZ2V0UmVuZGVyZXJzKCkubWFwKChyZW5kZXJlcik6IFJlbmRlcmVyTWV0YWRhdGEgPT4ge1xuXHRcdFx0Y29uc3QgZW50cnlwb2ludCA9IHtcblx0XHRcdFx0ZXh0ZW5kczogcmVuZGVyZXIuZW50cnlwb2ludC5leHRlbmRzLFxuXHRcdFx0XHRwYXRoOiB0aGlzLmFzV2Vidmlld1VyaShyZW5kZXJlci5lbnRyeXBvaW50LnBhdGgsIHJlbmRlcmVyLmV4dGVuc2lvbkxvY2F0aW9uKS50b1N0cmluZygpXG5cdFx0XHR9O1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWQ6IHJlbmRlcmVyLmlkLFxuXHRcdFx0XHRlbnRyeXBvaW50LFxuXHRcdFx0XHRtaW1lVHlwZXM6IHJlbmRlcmVyLm1pbWVUeXBlcyxcblx0XHRcdFx0bWVzc2FnaW5nOiByZW5kZXJlci5tZXNzYWdpbmcgIT09IFJlbmRlcmVyTWVzc2FnaW5nU3BlYy5OZXZlciAmJiAhIXRoaXMucmVuZGVyZXJNZXNzYWdpbmcsXG5cdFx0XHRcdGlzQnVpbHRpbjogcmVuZGVyZXIuaXNCdWlsdGluXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTdGF0aWNQcmVsb2Fkc0RhdGEoKTogU3RhdGljUHJlbG9hZE1ldGFkYXRhW10ge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMubm90ZWJvb2tTZXJ2aWNlLmdldFN0YXRpY1ByZWxvYWRzKHRoaXMubm90ZWJvb2tWaWV3VHlwZSksIHByZWxvYWQgPT4ge1xuXHRcdFx0cmV0dXJuIHsgZW50cnlwb2ludDogdGhpcy5hc1dlYnZpZXdVcmkocHJlbG9hZC5lbnRyeXBvaW50LCBwcmVsb2FkLmV4dGVuc2lvbkxvY2F0aW9uKS50b1N0cmluZygpLnRvU3RyaW5nKCkgfTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXNXZWJ2aWV3VXJpKHVyaTogVVJJLCBmcm9tRXh0ZW5zaW9uOiBVUkkgfCB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gYXNXZWJ2aWV3VXJpKHVyaSwgZnJvbUV4dGVuc2lvbj8uc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVJlbW90ZSA/IHsgaXNSZW1vdGU6IHRydWUsIGF1dGhvcml0eTogZnJvbUV4dGVuc2lvbi5hdXRob3JpdHkgfSA6IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwb3N0S2VybmVsTWVzc2FnZShtZXNzYWdlOiBhbnkpIHtcblx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHRfX3ZzY29kZV9ub3RlYm9va19tZXNzYWdlOiB0cnVlLFxuXHRcdFx0dHlwZTogJ2N1c3RvbUtlcm5lbE1lc3NhZ2UnLFxuXHRcdFx0bWVzc2FnZSxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZU91dHB1dElkKGlkOiBzdHJpbmcpOiB7IGNlbGxJbmZvOiBUOyBvdXRwdXQ6IElDZWxsT3V0cHV0Vmlld01vZGVsIH0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG91dHB1dCA9IHRoaXMucmV2ZXJzZWRJbnNldE1hcHBpbmcuZ2V0KGlkKTtcblx0XHRpZiAoIW91dHB1dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGxJbmZvID0gdGhpcy5pbnNldE1hcHBpbmcuZ2V0KG91dHB1dCkhLmNlbGxJbmZvO1xuXHRcdHJldHVybiB7IGNlbGxJbmZvLCBvdXRwdXQgfTtcblx0fVxuXG5cdGlzUmVzb2x2ZWQoKTogdGhpcyBpcyBJUmVzb2x2ZWRCYWNrTGF5ZXJXZWJ2aWV3IHtcblx0XHRyZXR1cm4gISF0aGlzLndlYnZpZXc7XG5cdH1cblxuXHRjcmVhdGVXZWJ2aWV3KHRhcmdldFdpbmRvdzogQ29kZVdpbmRvdyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGJhc2VVcmwgPSB0aGlzLmFzV2Vidmlld1VyaSh0aGlzLmdldE5vdGVib29rQmFzZVVyaSgpLCB1bmRlZmluZWQpO1xuXHRcdGNvbnN0IGh0bWxDb250ZW50ID0gdGhpcy5nZW5lcmF0ZUNvbnRlbnQoYmFzZVVybC50b1N0cmluZygpKTtcblx0XHRyZXR1cm4gdGhpcy5faW5pdGlhbGl6ZShodG1sQ29udGVudCwgdGFyZ2V0V2luZG93KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Tm90ZWJvb2tCYXNlVXJpKCkge1xuXHRcdGlmICh0aGlzLmRvY3VtZW50VXJpLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0Y29uc3QgZm9sZGVyID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2VGb2xkZXIodGhpcy5kb2N1bWVudFVyaSk7XG5cdFx0XHRpZiAoZm9sZGVyKSB7XG5cdFx0XHRcdHJldHVybiBmb2xkZXIudXJpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmb2xkZXJzID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdFx0aWYgKGZvbGRlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiBmb2xkZXJzWzBdLnVyaTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZGlybmFtZSh0aGlzLmRvY3VtZW50VXJpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QnVpbHRpbkxvY2FsUmVzb3VyY2VSb290cygpOiBVUklbXSB7XG5cdFx0Ly8gUHl0aG9uIG5vdGVib29rcyBhc3N1bWUgdGhhdCByZXF1aXJlanMgaXMgYSBnbG9iYWwuXG5cdFx0Ly8gRm9yIGFsbCBvdGhlciBub3RlYm9va3MsIHRoZXkgbmVlZCB0byBwcm92aWRlIHRoZWlyIG93biBsb2FkZXIuXG5cdFx0aWYgKCF0aGlzLmRvY3VtZW50VXJpLnBhdGgudG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgnLmlweW5iJykpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRpZiAoaXNXZWIpIHtcblx0XHRcdHJldHVybiBbXTsgLy8gc2NyaXB0IGlzIGlubGluZWRcblx0XHR9XG5cblx0XHRyZXR1cm4gW1xuXHRcdFx0ZGlybmFtZShGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvbmxzLmpzJykpLFxuXHRcdF07XG5cdH1cblxuXHRwcml2YXRlIF9pbml0aWFsaXplKGNvbnRlbnQ6IHN0cmluZywgdGFyZ2V0V2luZG93OiBDb2RlV2luZG93KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFnZXRXaW5kb3codGhpcy5lbGVtZW50KS5kb2N1bWVudC5ib2R5LmNvbnRhaW5zKHRoaXMuZWxlbWVudCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRWxlbWVudCBpcyBhbHJlYWR5IGRldGFjaGVkIGZyb20gdGhlIERPTSB0cmVlJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy53ZWJ2aWV3ID0gdGhpcy5fY3JlYXRlSW5zZXQodGhpcy53ZWJ2aWV3U2VydmljZSwgY29udGVudCk7XG5cdFx0dGhpcy53ZWJ2aWV3Lm1vdW50VG8odGhpcy5lbGVtZW50LCB0YXJnZXRXaW5kb3cpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud2Vidmlldyk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihuZXcgV2Vidmlld1dpbmRvd0RyYWdNb25pdG9yKHRhcmdldFdpbmRvdywgKCkgPT4gdGhpcy53ZWJ2aWV3KSk7XG5cblx0XHRjb25zdCBpbml0aWFsaXplUHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud2Vidmlldy5vbkZhdGFsRXJyb3IoZSA9PiB7XG5cdFx0XHRpbml0aWFsaXplUHJvbWlzZS5lcnJvcihuZXcgRXJyb3IoYENvdWxkIG5vdCBpbml0aWFsaXplIHdlYnZpZXc6ICR7ZS5tZXNzYWdlfX1gKSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53ZWJ2aWV3Lm9uTWVzc2FnZShhc3luYyAobWVzc2FnZSkgPT4ge1xuXHRcdFx0Y29uc3QgZGF0YTogRnJvbVdlYnZpZXdNZXNzYWdlIHwgeyByZWFkb25seSBfX3ZzY29kZV9ub3RlYm9va19tZXNzYWdlOiB1bmRlZmluZWQgfSA9IG1lc3NhZ2UubWVzc2FnZTtcblx0XHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghZGF0YS5fX3ZzY29kZV9ub3RlYm9va19tZXNzYWdlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c3dpdGNoIChkYXRhLnR5cGUpIHtcblx0XHRcdFx0Y2FzZSAnaW5pdGlhbGl6ZWQnOiB7XG5cdFx0XHRcdFx0aW5pdGlhbGl6ZVByb21pc2UuY29tcGxldGUoKTtcblx0XHRcdFx0XHR0aGlzLmluaXRpYWxpemVXZWJWaWV3U3RhdGUoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdpbml0aWFsaXplZE1hcmt1cCc6IHtcblx0XHRcdFx0XHRpZiAodGhpcy5pbml0aWFsaXplTWFya3VwUHJvbWlzZT8ucmVxdWVzdElkID09PSBkYXRhLnJlcXVlc3RJZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5pbml0aWFsaXplTWFya3VwUHJvbWlzZT8ucC5jb21wbGV0ZSgpO1xuXHRcdFx0XHRcdFx0dGhpcy5pbml0aWFsaXplTWFya3VwUHJvbWlzZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAnZGltZW5zaW9uJzoge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgdXBkYXRlIG9mIGRhdGEudXBkYXRlcykge1xuXHRcdFx0XHRcdFx0Y29uc3QgaGVpZ2h0ID0gdXBkYXRlLmhlaWdodDtcblx0XHRcdFx0XHRcdGlmICh1cGRhdGUuaXNPdXRwdXQpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRSZXN1bHQgPSB0aGlzLnJlc29sdmVPdXRwdXRJZCh1cGRhdGUuaWQpO1xuXHRcdFx0XHRcdFx0XHRpZiAocmVzb2x2ZWRSZXN1bHQpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCB7IGNlbGxJbmZvLCBvdXRwdXQgfSA9IHJlc29sdmVkUmVzdWx0O1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IudXBkYXRlT3V0cHV0SGVpZ2h0KGNlbGxJbmZvLCBvdXRwdXQsIGhlaWdodCwgISF1cGRhdGUuaW5pdCwgJ3dlYnZpZXcjZGltZW5zaW9uJyk7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5zY2hlZHVsZU91dHB1dEhlaWdodEFjayhjZWxsSW5mbywgdXBkYXRlLmlkLCBoZWlnaHQpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHVwZGF0ZS5pbml0KSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gbWlnaHQgYmUgaWRsZSByZW5kZXIgcmVxdWVzdCdzIGFja1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG91dHB1dFJlcXVlc3QgPSB0aGlzLnJldmVyc2VkUGVuZGluZ1dlYnZpZXdJZGxlSW5zZXRNYXBwaW5nLmdldCh1cGRhdGUuaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChvdXRwdXRSZXF1ZXN0KSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBpbnNldCA9IHRoaXMucGVuZGluZ1dlYnZpZXdJZGxlSW5zZXRNYXBwaW5nLmdldChvdXRwdXRSZXF1ZXN0KSE7XG5cblx0XHRcdFx0XHRcdFx0XHRcdC8vIGNsZWFyIHRoZSBwZW5kaW5nIG1hcHBpbmdcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMucGVuZGluZ1dlYnZpZXdJZGxlQ3JlYXRpb25SZXF1ZXN0LmRlbGV0ZShvdXRwdXRSZXF1ZXN0KTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMucGVuZGluZ1dlYnZpZXdJZGxlQ3JlYXRpb25SZXF1ZXN0LmRlbGV0ZShvdXRwdXRSZXF1ZXN0KTtcblxuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgY2VsbEluZm8gPSBpbnNldC5jZWxsSW5mbztcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMucmV2ZXJzZWRJbnNldE1hcHBpbmcuc2V0KHVwZGF0ZS5pZCwgb3V0cHV0UmVxdWVzdCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmluc2V0TWFwcGluZy5zZXQob3V0cHV0UmVxdWVzdCwgaW5zZXQpO1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci51cGRhdGVPdXRwdXRIZWlnaHQoY2VsbEluZm8sIG91dHB1dFJlcXVlc3QsIGhlaWdodCwgISF1cGRhdGUuaW5pdCwgJ3dlYnZpZXcjZGltZW5zaW9uJyk7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnNjaGVkdWxlT3V0cHV0SGVpZ2h0QWNrKGNlbGxJbmZvLCB1cGRhdGUuaWQsIGhlaWdodCk7XG5cblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHR0aGlzLnJldmVyc2VkUGVuZGluZ1dlYnZpZXdJZGxlSW5zZXRNYXBwaW5nLmRlbGV0ZSh1cGRhdGUuaWQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdGlmICghdXBkYXRlLmluaXQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG91dHB1dCA9IHRoaXMucmV2ZXJzZWRJbnNldE1hcHBpbmcuZ2V0KHVwZGF0ZS5pZCk7XG5cblx0XHRcdFx0XHRcdFx0XHRpZiAoIW91dHB1dCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgaW5zZXQgPSB0aGlzLmluc2V0TWFwcGluZy5nZXQob3V0cHV0KSE7XG5cdFx0XHRcdFx0XHRcdFx0aW5zZXQuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnVwZGF0ZU1hcmt1cENlbGxIZWlnaHQodXBkYXRlLmlkLCBoZWlnaHQsICEhdXBkYXRlLmluaXQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdtb3VzZWVudGVyJzoge1xuXHRcdFx0XHRcdGNvbnN0IHJlc29sdmVkUmVzdWx0ID0gdGhpcy5yZXNvbHZlT3V0cHV0SWQoZGF0YS5pZCk7XG5cdFx0XHRcdFx0aWYgKHJlc29sdmVkUmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsYXRlc3RDZWxsID0gdGhpcy5ub3RlYm9va0VkaXRvci5nZXRDZWxsQnlJbmZvKHJlc29sdmVkUmVzdWx0LmNlbGxJbmZvKTtcblx0XHRcdFx0XHRcdGlmIChsYXRlc3RDZWxsKSB7XG5cdFx0XHRcdFx0XHRcdGxhdGVzdENlbGwub3V0cHV0SXNIb3ZlcmVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAnbW91c2VsZWF2ZSc6IHtcblx0XHRcdFx0XHRjb25zdCByZXNvbHZlZFJlc3VsdCA9IHRoaXMucmVzb2x2ZU91dHB1dElkKGRhdGEuaWQpO1xuXHRcdFx0XHRcdGlmIChyZXNvbHZlZFJlc3VsdCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGF0ZXN0Q2VsbCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEJ5SW5mbyhyZXNvbHZlZFJlc3VsdC5jZWxsSW5mbyk7XG5cdFx0XHRcdFx0XHRpZiAobGF0ZXN0Q2VsbCkge1xuXHRcdFx0XHRcdFx0XHRsYXRlc3RDZWxsLm91dHB1dElzSG92ZXJlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdvdXRwdXRGb2N1cyc6IHtcblx0XHRcdFx0XHRjb25zdCByZXNvbHZlZFJlc3VsdCA9IHRoaXMucmVzb2x2ZU91dHB1dElkKGRhdGEuaWQpO1xuXHRcdFx0XHRcdGlmIChyZXNvbHZlZFJlc3VsdCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGF0ZXN0Q2VsbCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEJ5SW5mbyhyZXNvbHZlZFJlc3VsdC5jZWxsSW5mbyk7XG5cdFx0XHRcdFx0XHRpZiAobGF0ZXN0Q2VsbCkge1xuXHRcdFx0XHRcdFx0XHRsYXRlc3RDZWxsLm91dHB1dElzRm9jdXNlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZm9jdXNOb3RlYm9va0NlbGwobGF0ZXN0Q2VsbCwgJ291dHB1dCcsIHsgb3V0cHV0SWQ6IHJlc29sdmVkUmVzdWx0Lm91dHB1dC5tb2RlbC5vdXRwdXRJZCwgc2tpcFJldmVhbDogdHJ1ZSwgb3V0cHV0V2Vidmlld0ZvY3VzZWQ6IHRydWUgfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ291dHB1dEJsdXInOiB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRSZXN1bHQgPSB0aGlzLnJlc29sdmVPdXRwdXRJZChkYXRhLmlkKTtcblx0XHRcdFx0XHRpZiAocmVzb2x2ZWRSZXN1bHQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxhdGVzdENlbGwgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldENlbGxCeUluZm8ocmVzb2x2ZWRSZXN1bHQuY2VsbEluZm8pO1xuXHRcdFx0XHRcdFx0aWYgKGxhdGVzdENlbGwpIHtcblx0XHRcdFx0XHRcdFx0bGF0ZXN0Q2VsbC5vdXRwdXRJc0ZvY3VzZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0bGF0ZXN0Q2VsbC5pbnB1dEluT3V0cHV0SXNGb2N1c2VkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ3Njcm9sbC1hY2snOiB7XG5cdFx0XHRcdFx0Ly8gY29uc3QgZGF0ZSA9IG5ldyBEYXRlKCk7XG5cdFx0XHRcdFx0Ly8gY29uc3QgdG9wID0gZGF0YS5kYXRhLnRvcDtcblx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZygnYWNrIHRvcCAnLCB0b3AsICcgdmVyc2lvbjogJywgZGF0YS52ZXJzaW9uLCAnIC0gJywgZGF0ZS5nZXRNaW51dGVzKCkgKyAnOicgKyBkYXRlLmdldFNlY29uZHMoKSArICc6JyArIGRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ3Njcm9sbC10by1yZXZlYWwnOiB7XG5cdFx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5zZXRTY3JvbGxUb3AoZGF0YS5zY3JvbGxUb3AgLSBOT1RFQk9PS19XRUJWSUVXX0JPVU5EQVJZKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdkaWQtc2Nyb2xsLXdoZWVsJzoge1xuXHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IudHJpZ2dlclNjcm9sbCh7XG5cdFx0XHRcdFx0XHQuLi5kYXRhLnBheWxvYWQsXG5cdFx0XHRcdFx0XHRwcmV2ZW50RGVmYXVsdDogKCkgPT4geyB9LFxuXHRcdFx0XHRcdFx0c3RvcFByb3BhZ2F0aW9uOiAoKSA9PiB7IH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdmb2N1cy1lZGl0b3InOiB7XG5cdFx0XHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEJ5SWQoZGF0YS5jZWxsSWQpO1xuXHRcdFx0XHRcdGlmIChjZWxsKSB7XG5cdFx0XHRcdFx0XHRpZiAoZGF0YS5mb2N1c05leHQpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5mb2N1c05leHROb3RlYm9va0NlbGwoY2VsbCwgJ2VkaXRvcicpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbChjZWxsLCAnZWRpdG9yJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ2NsaWNrZWQtZGF0YS11cmwnOiB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDbGlja0RhdGFMaW5rKGRhdGEpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ2NsaWNrZWQtbGluayc6IHtcblx0XHRcdFx0XHRpZiAobWF0Y2hlc1NjaGVtZShkYXRhLmhyZWYsIFNjaGVtYXMuY29tbWFuZCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShkYXRhLmhyZWYpO1xuXG5cdFx0XHRcdFx0XHRpZiAodXJpLnBhdGggPT09ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5MYXJnZU91dHB1dCcpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3Qgb3V0cHV0SWQgPSB1cmkucXVlcnk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGdyb3VwID0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXA7XG5cdFx0XHRcdFx0XHRcdGlmIChncm91cCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChncm91cC5hY3RpdmVFZGl0b3IpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGdyb3VwLnBpbkVkaXRvcihncm91cC5hY3RpdmVFZGl0b3IpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKENlbGxVcmkuZ2VuZXJhdGVDZWxsT3V0cHV0VXJpV2l0aElkKHRoaXMuZG9jdW1lbnRVcmksIG91dHB1dElkKSk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICh1cmkucGF0aCA9PT0gJ2NlbGxPdXRwdXQuZW5hYmxlU2Nyb2xsaW5nJykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBvdXRwdXRJZCA9IHVyaS5xdWVyeTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMucmV2ZXJzZWRJbnNldE1hcHBpbmcuZ2V0KG91dHB1dElkKTtcblxuXHRcdFx0XHRcdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQsIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24+XG5cdFx0XHRcdFx0XHRcdFx0XHQoJ3dvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkJywgeyBpZDogJ25vdGVib29rLmNlbGwudG9nZ2xlT3V0cHV0U2Nyb2xsaW5nJywgZnJvbTogJ2lubGluZUxpbmsnIH0pO1xuXG5cdFx0XHRcdFx0XHRcdFx0Y2VsbC5jZWxsVmlld01vZGVsLm91dHB1dHNWaWV3TW9kZWxzLmZvckVhY2goKHZtKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAodm0ubW9kZWwubWV0YWRhdGEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dm0ubW9kZWwubWV0YWRhdGFbJ3Njcm9sbGFibGUnXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHZtLnJlc2V0UmVuZGVyZXIoKTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gV2UgYWxsb3cgYSB2ZXJ5IGxpbWl0ZWQgc2V0IG9mIGNvbW1hbmRzXG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihkYXRhLmhyZWYsIHtcblx0XHRcdFx0XHRcdFx0ZnJvbVVzZXJHZXN0dXJlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRmcm9tV29ya3NwYWNlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRhbGxvd0NvbW1hbmRzOiBbXG5cdFx0XHRcdFx0XHRcdFx0J2dpdGh1Yi1pc3N1ZXMuYXV0aE5vdycsXG5cdFx0XHRcdFx0XHRcdFx0J3dvcmtiZW5jaC5leHRlbnNpb25zLnNlYXJjaCcsXG5cdFx0XHRcdFx0XHRcdFx0J3dvcmtiZW5jaC5hY3Rpb24ub3BlblNldHRpbmdzJyxcblx0XHRcdFx0XHRcdFx0XHQnX25vdGVib29rLnNlbGVjdEtlcm5lbCcsXG5cdFx0XHRcdFx0XHRcdFx0Ly8gVE9ET0ByZWJvcm5peCBleHBsb3JlIG9wZW4gb3V0cHV0IGNoYW5uZWwgd2l0aCBuYW1lIGNvbW1hbmRcblx0XHRcdFx0XHRcdFx0XHQnanVweXRlci52aWV3T3V0cHV0Jyxcblx0XHRcdFx0XHRcdFx0XHQnanVweXRlci5jcmVhdGVQeXRob25FbnZBbmRTZWxlY3RDb250cm9sbGVyJyxcblx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChtYXRjaGVzU29tZVNjaGVtZShkYXRhLmhyZWYsIFNjaGVtYXMuaHR0cCwgU2NoZW1hcy5odHRwcywgU2NoZW1hcy5tYWlsdG8pKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihkYXRhLmhyZWYsIHsgZnJvbVVzZXJHZXN0dXJlOiB0cnVlLCBmcm9tV29ya3NwYWNlOiB0cnVlIH0pO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAobWF0Y2hlc1NjaGVtZShkYXRhLmhyZWYsIFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsKSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKGRhdGEuaHJlZik7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLl9oYW5kbGVOb3RlYm9va0NlbGxSZXNvdXJjZSh1cmkpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIS9eW1xcd1xcLV0rOi8udGVzdChkYXRhLmhyZWYpKSB7XG5cdFx0XHRcdFx0XHQvLyBVcmkgd2l0aG91dCBzY2hlbWUsIHN1Y2ggYXMgYSBmaWxlIHBhdGhcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX2hhbmRsZVJlc291cmNlT3BlbmluZyh0cnlEZWNvZGVVUklDb21wb25lbnQoZGF0YS5ocmVmKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdC8vIHVyaSB3aXRoIHNjaGVtZVxuXHRcdFx0XHRcdFx0aWYgKG9zUGF0aC5pc0Fic29sdXRlKGRhdGEuaHJlZikpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fb3BlblVyaShVUkkuZmlsZShkYXRhLmhyZWYpKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX29wZW5VcmkoVVJJLnBhcnNlKGRhdGEuaHJlZikpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdjdXN0b21LZXJuZWxNZXNzYWdlJzoge1xuXHRcdFx0XHRcdHRoaXMuX29uTWVzc2FnZS5maXJlKHsgbWVzc2FnZTogZGF0YS5tZXNzYWdlIH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ2N1c3RvbVJlbmRlcmVyTWVzc2FnZSc6IHtcblx0XHRcdFx0XHR0aGlzLnJlbmRlcmVyTWVzc2FnaW5nPy5wb3N0TWVzc2FnZShkYXRhLnJlbmRlcmVySWQsIGRhdGEubWVzc2FnZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAnY2xpY2tNYXJrdXBDZWxsJzoge1xuXHRcdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldENlbGxCeUlkKGRhdGEuY2VsbElkKTtcblx0XHRcdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRcdFx0aWYgKGRhdGEuc2hpZnRLZXkgfHwgKGlzTWFjaW50b3NoID8gZGF0YS5tZXRhS2V5IDogZGF0YS5jdHJsS2V5KSkge1xuXHRcdFx0XHRcdFx0XHQvLyBNb2RpZnkgc2VsZWN0aW9uXG5cdFx0XHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IudG9nZ2xlTm90ZWJvb2tDZWxsU2VsZWN0aW9uKGNlbGwsIC8qIGZyb21QcmV2aW91cyAqLyBkYXRhLnNoaWZ0S2V5KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIE5vcm1hbCBjbGlja1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLm5vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKGNlbGwsICdjb250YWluZXInLCB7IHNraXBSZXZlYWw6IHRydWUgfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ2NvbnRleHRNZW51TWFya3VwQ2VsbCc6IHtcblx0XHRcdFx0XHRjb25zdCBjZWxsID0gdGhpcy5ub3RlYm9va0VkaXRvci5nZXRDZWxsQnlJZChkYXRhLmNlbGxJZCk7XG5cdFx0XHRcdFx0aWYgKGNlbGwpIHtcblx0XHRcdFx0XHRcdC8vIEZvY3VzIHRoZSBjZWxsIGZpcnN0XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLm5vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKGNlbGwsICdjb250YWluZXInLCB7IHNraXBSZXZlYWw6IHRydWUgfSk7XG5cblx0XHRcdFx0XHRcdC8vIFRoZW4gc2hvdyB0aGUgY29udGV4dCBtZW51XG5cdFx0XHRcdFx0XHRjb25zdCB3ZWJ2aWV3UmVjdCA9IHRoaXMuZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdFx0XHRcdG1lbnVJZDogTWVudUlkLk5vdGVib29rQ2VsbFRpdGxlLFxuXHRcdFx0XHRcdFx0XHRjb250ZXh0S2V5U2VydmljZTogdGhpcy5jb250ZXh0S2V5U2VydmljZSxcblx0XHRcdFx0XHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiAoe1xuXHRcdFx0XHRcdFx0XHRcdHg6IHdlYnZpZXdSZWN0LnggKyBkYXRhLmNsaWVudFgsXG5cdFx0XHRcdFx0XHRcdFx0eTogd2Vidmlld1JlY3QueSArIGRhdGEuY2xpZW50WVxuXHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ3RvZ2dsZU1hcmt1cFByZXZpZXcnOiB7XG5cdFx0XHRcdFx0Y29uc3QgY2VsbCA9IHRoaXMubm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEJ5SWQoZGF0YS5jZWxsSWQpO1xuXHRcdFx0XHRcdGlmIChjZWxsICYmICF0aGlzLm5vdGVib29rRWRpdG9yLmNyZWF0aW9uT3B0aW9ucy5pc1JlYWRPbmx5KSB7XG5cdFx0XHRcdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLnNldE1hcmt1cENlbGxFZGl0U3RhdGUoZGF0YS5jZWxsSWQsIENlbGxFZGl0U3RhdGUuRWRpdGluZyk7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLm5vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKGNlbGwsICdlZGl0b3InLCB7IHNraXBSZXZlYWw6IHRydWUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ21vdXNlRW50ZXJNYXJrdXBDZWxsJzoge1xuXHRcdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldENlbGxCeUlkKGRhdGEuY2VsbElkKTtcblx0XHRcdFx0XHRpZiAoY2VsbCBpbnN0YW5jZW9mIE1hcmt1cENlbGxWaWV3TW9kZWwpIHtcblx0XHRcdFx0XHRcdGNlbGwuY2VsbElzSG92ZXJlZCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ21vdXNlTGVhdmVNYXJrdXBDZWxsJzoge1xuXHRcdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldENlbGxCeUlkKGRhdGEuY2VsbElkKTtcblx0XHRcdFx0XHRpZiAoY2VsbCBpbnN0YW5jZW9mIE1hcmt1cENlbGxWaWV3TW9kZWwpIHtcblx0XHRcdFx0XHRcdGNlbGwuY2VsbElzSG92ZXJlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdjZWxsLWRyYWctc3RhcnQnOiB7XG5cdFx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5kaWRTdGFydERyYWdNYXJrdXBDZWxsKGRhdGEuY2VsbElkLCBkYXRhKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdjZWxsLWRyYWcnOiB7XG5cdFx0XHRcdFx0dGhpcy5ub3RlYm9va0VkaXRvci5kaWREcmFnTWFya3VwQ2VsbChkYXRhLmNlbGxJZCwgZGF0YSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAnY2VsbC1kcm9wJzoge1xuXHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGlkRHJvcE1hcmt1cENlbGwoZGF0YS5jZWxsSWQsIHtcblx0XHRcdFx0XHRcdGRyYWdPZmZzZXRZOiBkYXRhLmRyYWdPZmZzZXRZLFxuXHRcdFx0XHRcdFx0Y3RybEtleTogZGF0YS5jdHJsS2V5LFxuXHRcdFx0XHRcdFx0YWx0S2V5OiBkYXRhLmFsdEtleSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdjZWxsLWRyYWctZW5kJzoge1xuXHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGlkRW5kRHJhZ01hcmt1cENlbGwoZGF0YS5jZWxsSWQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ3JlbmRlcmVkTWFya3VwJzoge1xuXHRcdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLm5vdGVib29rRWRpdG9yLmdldENlbGxCeUlkKGRhdGEuY2VsbElkKTtcblx0XHRcdFx0XHRpZiAoY2VsbCBpbnN0YW5jZW9mIE1hcmt1cENlbGxWaWV3TW9kZWwpIHtcblx0XHRcdFx0XHRcdGNlbGwucmVuZGVyZWRIdG1sID0gZGF0YS5odG1sO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuX2hhbmRsZUhpZ2hsaWdodENvZGVCbG9jayhkYXRhLmNvZGVCbG9ja3MpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ3JlbmRlcmVkQ2VsbE91dHB1dCc6IHtcblx0XHRcdFx0XHR0aGlzLl9oYW5kbGVIaWdobGlnaHRDb2RlQmxvY2soZGF0YS5jb2RlQmxvY2tzKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdvdXRwdXRSZXNpemVkJzoge1xuXHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IuZGlkUmVzaXplT3V0cHV0KGRhdGEuY2VsbElkKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdnZXRPdXRwdXRJdGVtJzoge1xuXHRcdFx0XHRcdGNvbnN0IHJlc29sdmVkUmVzdWx0ID0gdGhpcy5yZXNvbHZlT3V0cHV0SWQoZGF0YS5vdXRwdXRJZCk7XG5cdFx0XHRcdFx0Y29uc3Qgb3V0cHV0ID0gcmVzb2x2ZWRSZXN1bHQ/Lm91dHB1dC5tb2RlbC5vdXRwdXRzLmZpbmQob3V0cHV0ID0+IG91dHB1dC5taW1lID09PSBkYXRhLm1pbWUpO1xuXG5cdFx0XHRcdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0XHRcdFx0dHlwZTogJ3JldHVybk91dHB1dEl0ZW0nLFxuXHRcdFx0XHRcdFx0cmVxdWVzdElkOiBkYXRhLnJlcXVlc3RJZCxcblx0XHRcdFx0XHRcdG91dHB1dDogb3V0cHV0ID8geyBtaW1lOiBvdXRwdXQubWltZSwgdmFsdWVCeXRlczogb3V0cHV0LmRhdGEuYnVmZmVyIH0gOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSAnbG9nUmVuZGVyZXJEZWJ1Z01lc3NhZ2UnOiB7XG5cdFx0XHRcdFx0dGhpcy5fbG9nUmVuZGVyZXJEZWJ1Z01lc3NhZ2UoYCR7ZGF0YS5tZXNzYWdlfSR7ZGF0YS5kYXRhID8gJyAnICsgSlNPTi5zdHJpbmdpZnkoZGF0YS5kYXRhLCBudWxsLCA0KSA6ICcnfWApO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgJ25vdGVib29rUGVyZm9ybWFuY2VNZXNzYWdlJzoge1xuXHRcdFx0XHRcdHRoaXMubm90ZWJvb2tFZGl0b3IudXBkYXRlUGVyZm9ybWFuY2VNZXRhZGF0YShkYXRhLmNlbGxJZCwgZGF0YS5leGVjdXRpb25JZCwgZGF0YS5kdXJhdGlvbiwgZGF0YS5yZW5kZXJlcklkKTtcblx0XHRcdFx0XHRpZiAoZGF0YS5vdXRwdXRTaXplICYmIGRhdGEucmVuZGVyZXJJZCA9PT0gJ3ZzY29kZS5idWlsdGluLXJlbmRlcmVyJykge1xuXHRcdFx0XHRcdFx0dGhpcy5fc2VuZFBlcmZvcm1hbmNlRGF0YShkYXRhLm91dHB1dFNpemUsIGRhdGEuZHVyYXRpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlICdvdXRwdXRJbnB1dEZvY3VzJzoge1xuXHRcdFx0XHRcdGNvbnN0IHJlc29sdmVkUmVzdWx0ID0gdGhpcy5yZXNvbHZlT3V0cHV0SWQoZGF0YS5pZCk7XG5cdFx0XHRcdFx0aWYgKHJlc29sdmVkUmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsYXRlc3RDZWxsID0gdGhpcy5ub3RlYm9va0VkaXRvci5nZXRDZWxsQnlJbmZvKHJlc29sdmVkUmVzdWx0LmNlbGxJbmZvKTtcblx0XHRcdFx0XHRcdGlmIChsYXRlc3RDZWxsKSB7XG5cdFx0XHRcdFx0XHRcdGxhdGVzdENlbGwuaW5wdXRJbk91dHB1dElzRm9jdXNlZCA9IGRhdGEuaW5wdXRGb2N1c2VkO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLm5vdGVib29rRWRpdG9yLmRpZEZvY3VzT3V0cHV0SW5wdXRDaGFuZ2UoZGF0YS5pbnB1dEZvY3VzZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGluaXRpYWxpemVQcm9taXNlLnA7XG5cdH1cblxuXHRwcml2YXRlIF9zZW5kUGVyZm9ybWFuY2VEYXRhKG91dHB1dFNpemU6IG51bWJlciwgcmVuZGVyVGltZTogbnVtYmVyKSB7XG5cdFx0dHlwZSBOb3RlYm9va091dHB1dFJlbmRlckNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdhbXVuZ2VyJztcblx0XHRcdGNvbW1lbnQ6ICdUcmFjayBwZXJmb3JtYW5jZSBkYXRhIGZvciBvdXRwdXQgcmVuZGVyaW5nJztcblx0XHRcdG91dHB1dFNpemU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdTaXplIG9mIHRoZSBvdXRwdXQgZGF0YSBidWZmZXIuJzsgaXNNZWFzdXJlbWVudDogdHJ1ZSB9O1xuXHRcdFx0cmVuZGVyVGltZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RpbWUgc3BlbnQgcmVuZGVyaW5nIG91dHB1dC4nOyBpc01lYXN1cmVtZW50OiB0cnVlIH07XG5cdFx0fTtcblxuXHRcdHR5cGUgTm90ZWJvb2tPdXRwdXRSZW5kZXJFdmVudCA9IHtcblx0XHRcdG91dHB1dFNpemU6IG51bWJlcjtcblx0XHRcdHJlbmRlclRpbWU6IG51bWJlcjtcblx0XHR9O1xuXG5cdFx0Y29uc3QgdGVsZW1ldHJ5RGF0YSA9IHtcblx0XHRcdG91dHB1dFNpemUsXG5cdFx0XHRyZW5kZXJUaW1lXG5cdFx0fTtcblxuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPE5vdGVib29rT3V0cHV0UmVuZGVyRXZlbnQsIE5vdGVib29rT3V0cHV0UmVuZGVyQ2xhc3NpZmljYXRpb24+KCdOb3RlYm9va0NlbGxPdXRwdXRSZW5kZXInLCB0ZWxlbWV0cnlEYXRhKTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZU5vdGVib29rQ2VsbFJlc291cmNlKHVyaTogVVJJKSB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tSZXNvdXJjZSA9IHVyaS5wYXRoLmxlbmd0aCA+IDAgPyB1cmkgOiB0aGlzLmRvY3VtZW50VXJpO1xuXG5cdFx0Y29uc3QgbGluZU1hdGNoID0gLyg/Ol58JilsaW5lPShbXiZdKykvLmV4ZWModXJpLnF1ZXJ5KTtcblx0XHRsZXQgZWRpdG9yT3B0aW9uczogSVRleHRFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChsaW5lTWF0Y2gpIHtcblx0XHRcdGNvbnN0IHBhcnNlZExpbmVOdW1iZXIgPSBwYXJzZUludChsaW5lTWF0Y2hbMV0sIDEwKTtcblx0XHRcdGlmICghaXNOYU4ocGFyc2VkTGluZU51bWJlcikpIHtcblx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHBhcnNlZExpbmVOdW1iZXI7XG5cblx0XHRcdFx0ZWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRzZWxlY3Rpb246IHsgc3RhcnRMaW5lTnVtYmVyOiBsaW5lTnVtYmVyLCBzdGFydENvbHVtbjogMSB9XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhlY3V0aW9uTWF0Y2ggPSAvKD86XnwmKWV4ZWN1dGlvbl9jb3VudD0oW14mXSspLy5leGVjKHVyaS5xdWVyeSk7XG5cdFx0aWYgKGV4ZWN1dGlvbk1hdGNoKSB7XG5cdFx0XHRjb25zdCBleGVjdXRpb25Db3VudCA9IHBhcnNlSW50KGV4ZWN1dGlvbk1hdGNoWzFdLCAxMCk7XG5cdFx0XHRpZiAoIWlzTmFOKGV4ZWN1dGlvbkNvdW50KSkge1xuXHRcdFx0XHRjb25zdCBub3RlYm9va01vZGVsID0gdGhpcy5ub3RlYm9va1NlcnZpY2UuZ2V0Tm90ZWJvb2tUZXh0TW9kZWwobm90ZWJvb2tSZXNvdXJjZSk7XG5cdFx0XHRcdC8vIG11bHRpcGxlIGNlbGxzIHdpdGggdGhlIHNhbWUgZXhlY3V0aW9uIGNvdW50IGNhbiBleGlzdCBpZiB0aGUga2VybmVsIGlzIHJlc3RhcnRlZFxuXHRcdFx0XHQvLyBzbyBsb29rIGZvciB0aGUgbW9zdCByZWNlbnRseSBhZGRlZCBjZWxsIHdpdGggdGhlIG1hdGNoaW5nIGV4ZWN1dGlvbiBjb3VudC5cblx0XHRcdFx0Ly8gU29tZXdoYXQgbW9yZSBsaWtlbHkgdG8gYmUgY29ycmVjdCBpbiBub3RlYm9va3MsIGFuIG11Y2ggbW9yZSBsaWtlbHkgZm9yIHRoZSBpbnRlcmFjdGl2ZSB3aW5kb3dcblx0XHRcdFx0Y29uc3QgY2VsbCA9IG5vdGVib29rTW9kZWw/LmNlbGxzLnNsaWNlKCkucmV2ZXJzZSgpLmZpbmQoY2VsbCA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGNlbGwuaW50ZXJuYWxNZXRhZGF0YS5leGVjdXRpb25PcmRlciA9PT0gZXhlY3V0aW9uQ291bnQ7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAoY2VsbD8udXJpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMub3BlbmVyU2VydmljZS5vcGVuKGNlbGwudXJpLCB7XG5cdFx0XHRcdFx0XHRmcm9tVXNlckdlc3R1cmU6IHRydWUsXG5cdFx0XHRcdFx0XHRmcm9tV29ya3NwYWNlOiB0cnVlLFxuXHRcdFx0XHRcdFx0ZWRpdG9yT3B0aW9uczogZWRpdG9yT3B0aW9uc1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVVJMcyBidWlsdCBieSB0aGUganVweXRlciBleHRlbnNpb24gcHV0IHRoZSBsaW5lIHF1ZXJ5IHBhcmFtIGluIHRoZSBmcmFnbWVudFxuXHRcdC8vIFRoZXkgYWxzbyBoYXZlIHRoZSBjZWxsIGZyYWdtZW50IHByZS1jYWxjdWxhdGVkXG5cdFx0Y29uc3QgZnJhZ21lbnRMaW5lTWF0Y2ggPSAvXFw/bGluZT0oXFxkKykkLy5leGVjKHVyaS5mcmFnbWVudCk7XG5cdFx0aWYgKGZyYWdtZW50TGluZU1hdGNoKSB7XG5cdFx0XHRjb25zdCBwYXJzZWRMaW5lTnVtYmVyID0gcGFyc2VJbnQoZnJhZ21lbnRMaW5lTWF0Y2hbMV0sIDEwKTtcblx0XHRcdGlmICghaXNOYU4ocGFyc2VkTGluZU51bWJlcikpIHtcblx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHBhcnNlZExpbmVOdW1iZXIgKyAxO1xuXHRcdFx0XHRjb25zdCBmcmFnbWVudCA9IHVyaS5mcmFnbWVudC5zdWJzdHJpbmcoMCwgZnJhZ21lbnRMaW5lTWF0Y2guaW5kZXgpO1xuXG5cdFx0XHRcdC8vIG9wZW4gdGhlIHVyaSB3aXRoIHNlbGVjdGlvblxuXHRcdFx0XHRjb25zdCBlZGl0b3JPcHRpb25zOiBJVGV4dEVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0c2VsZWN0aW9uOiB7IHN0YXJ0TGluZU51bWJlcjogbGluZU51bWJlciwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IGxpbmVOdW1iZXIsIGVuZENvbHVtbjogMSB9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMub3BlbmVyU2VydmljZS5vcGVuKG5vdGVib29rUmVzb3VyY2Uud2l0aCh7IGZyYWdtZW50IH0pLCB7XG5cdFx0XHRcdFx0ZnJvbVVzZXJHZXN0dXJlOiB0cnVlLFxuXHRcdFx0XHRcdGZyb21Xb3Jrc3BhY2U6IHRydWUsXG5cdFx0XHRcdFx0ZWRpdG9yT3B0aW9uczogZWRpdG9yT3B0aW9uc1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4obm90ZWJvb2tSZXNvdXJjZSwgeyBmcm9tVXNlckdlc3R1cmU6IHRydWUsIGZyb21Xb3Jrc3BhY2U6IHRydWUgfSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9oYW5kbGVSZXNvdXJjZU9wZW5pbmcoaHJlZjogc3RyaW5nKSB7XG5cdFx0bGV0IGxpbmtUb09wZW46IFVSSSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgZnJhZ21lbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdC8vIFNlcGFyYXRlIG91dCB0aGUgZnJhZ21lbnQgc28gdGhhdCB0aGUgc3Vic2VxdWVudCBjYWxsc1xuXHRcdC8vIHRvIFVSSS5qb2luUGF0aCgpIGRvbid0IFVSTCBlbmNvZGUgaXQuIFRoaXMgYWxsb3dzIG9wZW5pbmdcblx0XHQvLyBsaW5rcyB3aXRoIGJvdGggcGF0aHMgYW5kIGZyYWdtZW50cy5cblx0XHRjb25zdCBocmVmV2l0aEZyYWdtZW50ID0gRlJBR01FTlRfUkVHRVguZXhlYyhocmVmKTtcblx0XHRpZiAoaHJlZldpdGhGcmFnbWVudCkge1xuXHRcdFx0aHJlZiA9IGhyZWZXaXRoRnJhZ21lbnRbMV07XG5cdFx0XHRmcmFnbWVudCA9IGhyZWZXaXRoRnJhZ21lbnRbMl07XG5cdFx0fVxuXG5cdFx0aWYgKGhyZWYuc3RhcnRzV2l0aCgnLycpKSB7XG5cdFx0XHRsaW5rVG9PcGVuID0gYXdhaXQgdGhpcy5wYXRoU2VydmljZS5maWxlVVJJKGhyZWYpO1xuXHRcdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRcdGlmIChmb2xkZXJzLmxlbmd0aCkge1xuXHRcdFx0XHRsaW5rVG9PcGVuID0gbGlua1RvT3Blbi53aXRoKHtcblx0XHRcdFx0XHRzY2hlbWU6IGZvbGRlcnNbMF0udXJpLnNjaGVtZSxcblx0XHRcdFx0XHRhdXRob3JpdHk6IGZvbGRlcnNbMF0udXJpLmF1dGhvcml0eVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGhyZWYuc3RhcnRzV2l0aCgnficpKSB7XG5cdFx0XHRjb25zdCB1c2VySG9tZSA9IGF3YWl0IHRoaXMucGF0aFNlcnZpY2UudXNlckhvbWUoKTtcblx0XHRcdGlmICh1c2VySG9tZSkge1xuXHRcdFx0XHRsaW5rVG9PcGVuID0gVVJJLmpvaW5QYXRoKHVzZXJIb21lLCBocmVmLnN1YnN0cmluZygyKSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLmRvY3VtZW50VXJpLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0XHRjb25zdCBmb2xkZXJzID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdFx0XHRpZiAoIWZvbGRlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxpbmtUb09wZW4gPSBVUkkuam9pblBhdGgoZm9sZGVyc1swXS51cmksIGhyZWYpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gUmVzb2x2ZSByZWxhdGl2ZSB0byBub3RlYm9vayBkb2N1bWVudFxuXHRcdFx0XHRsaW5rVG9PcGVuID0gVVJJLmpvaW5QYXRoKGRpcm5hbWUodGhpcy5kb2N1bWVudFVyaSksIGhyZWYpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChsaW5rVG9PcGVuKSB7XG5cdFx0XHQvLyBSZS1hdHRhY2ggZnJhZ21lbnQgbm93IHRoYXQgd2UgaGF2ZSB0aGUgZnVsbCBmaWxlIHBhdGguXG5cdFx0XHRpZiAoZnJhZ21lbnQpIHtcblx0XHRcdFx0bGlua1RvT3BlbiA9IGxpbmtUb09wZW4ud2l0aCh7IGZyYWdtZW50IH0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb3BlblVyaShsaW5rVG9PcGVuKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vcGVuVXJpKHVyaTogVVJJKSB7XG5cdFx0bGV0IGxpbmVOdW1iZXI6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgY29sdW1uOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgbGluZUNvbCA9IExJTkVfQ09MVU1OX1JFR0VYLmV4ZWModXJpLnBhdGgpO1xuXHRcdGlmIChsaW5lQ29sKSB7XG5cdFx0XHR1cmkgPSB1cmkud2l0aCh7XG5cdFx0XHRcdHBhdGg6IHVyaS5wYXRoLnNsaWNlKDAsIGxpbmVDb2wuaW5kZXgpLFxuXHRcdFx0XHRmcmFnbWVudDogYEwke2xpbmVDb2xbMF0uc2xpY2UoMSl9YFxuXHRcdFx0fSk7XG5cdFx0XHRsaW5lTnVtYmVyID0gcGFyc2VJbnQobGluZUNvbFsxXSwgMTApO1xuXHRcdFx0Y29sdW1uID0gcGFyc2VJbnQobGluZUNvbFsyXSwgMTApO1xuXHRcdH1cblxuXHRcdC8vI3JlZ2lvbiBlcnJvciByZW5kZXJlciBtaWdyYXRpb24sIHJlbW92ZSBvbmNlIGRvbmVcblx0XHRjb25zdCBsaW5lTWF0Y2ggPSBMaW5lUXVlcnlSZWdleC5leGVjKHVyaS5xdWVyeSk7XG5cdFx0aWYgKGxpbmVNYXRjaCkge1xuXHRcdFx0Y29uc3QgcGFyc2VkTGluZU51bWJlciA9IHBhcnNlSW50KGxpbmVNYXRjaFsxXSwgMTApO1xuXHRcdFx0aWYgKCFpc05hTihwYXJzZWRMaW5lTnVtYmVyKSkge1xuXHRcdFx0XHRsaW5lTnVtYmVyID0gcGFyc2VkTGluZU51bWJlciArIDE7XG5cdFx0XHRcdGNvbHVtbiA9IDE7XG5cdFx0XHRcdHVyaSA9IHVyaS53aXRoKHsgZnJhZ21lbnQ6IGBMJHtsaW5lTnVtYmVyfWAgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dXJpID0gdXJpLndpdGgoe1xuXHRcdFx0cXVlcnk6IG51bGxcblx0XHR9KTtcblx0XHQvLyNlbmRyZWdpb25cblxuXHRcdGxldCBtYXRjaDogeyBncm91cDogSUVkaXRvckdyb3VwOyBlZGl0b3I6IEVkaXRvcklucHV0IH0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIHRoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmdyb3Vwcykge1xuXHRcdFx0Y29uc3QgZWRpdG9ySW5wdXQgPSBncm91cC5lZGl0b3JzLmZpbmQoZWRpdG9yID0+IGVkaXRvci5yZXNvdXJjZSAmJiBpc0VxdWFsKGVkaXRvci5yZXNvdXJjZSwgdXJpLCB0cnVlKSk7XG5cdFx0XHRpZiAoZWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0bWF0Y2ggPSB7IGdyb3VwLCBlZGl0b3I6IGVkaXRvcklucHV0IH07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChtYXRjaCkge1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uOiBJVGV4dEVkaXRvclNlbGVjdGlvbiB8IHVuZGVmaW5lZCA9IGxpbmVOdW1iZXIgIT09IHVuZGVmaW5lZCAmJiBjb2x1bW4gIT09IHVuZGVmaW5lZCA/IHsgc3RhcnRMaW5lTnVtYmVyOiBsaW5lTnVtYmVyLCBzdGFydENvbHVtbjogY29sdW1uIH0gOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCB0ZXh0RWRpdG9yT3B0aW9uczogSVRleHRFZGl0b3JPcHRpb25zID0geyBzZWxlY3Rpb246IHNlbGVjdGlvbiB9O1xuXHRcdFx0bWF0Y2guZ3JvdXAub3BlbkVkaXRvcihtYXRjaC5lZGl0b3IsIHNlbGVjdGlvbiA/IHRleHRFZGl0b3JPcHRpb25zIDogdW5kZWZpbmVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4odXJpLCB7IGZyb21Vc2VyR2VzdHVyZTogdHJ1ZSwgZnJvbVdvcmtzcGFjZTogdHJ1ZSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVIaWdobGlnaHRDb2RlQmxvY2soY29kZUJsb2NrczogUmVhZG9ubHlBcnJheTxJQ29kZUJsb2NrSGlnaGxpZ2h0UmVxdWVzdD4pIHtcblx0XHRmb3IgKGNvbnN0IHsgaWQsIHZhbHVlLCBsYW5nIH0gb2YgY29kZUJsb2Nrcykge1xuXHRcdFx0Ly8gVGhlIGxhbmd1YWdlIGlkIG1heSBiZSBhIGxhbmd1YWdlIGFsaWFzZXMgKGUuZy5qcyBpbnN0ZWFkIG9mIGphdmFzY3JpcHQpXG5cdFx0XHRjb25zdCBsYW5ndWFnZUlkID0gdGhpcy5sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKGxhbmcpO1xuXHRcdFx0aWYgKCFsYW5ndWFnZUlkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHR0b2tlbml6ZVRvU3RyaW5nKHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLCB2YWx1ZSwgbGFuZ3VhZ2VJZCkudGhlbigoaHRtbCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0XHRcdHR5cGU6ICd0b2tlbml6ZWRDb2RlQmxvY2snLFxuXHRcdFx0XHRcdGh0bWwsXG5cdFx0XHRcdFx0Y29kZUJsb2NrSWQ6IGlkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cdHByaXZhdGUgYXN5bmMgX29uRGlkQ2xpY2tEYXRhTGluayhldmVudDogSUNsaWNrZWREYXRhVXJsTWVzc2FnZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0eXBlb2YgZXZlbnQuZGF0YSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBbc3BsaXRTdGFydCwgc3BsaXREYXRhXSA9IGV2ZW50LmRhdGEuc3BsaXQoJztiYXNlNjQsJyk7XG5cdFx0aWYgKCFzcGxpdERhdGEgfHwgIXNwbGl0U3RhcnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkZWZhdWx0RGlyID0gZXh0bmFtZSh0aGlzLmRvY3VtZW50VXJpKSA9PT0gJy5pbnRlcmFjdGl2ZScgP1xuXHRcdFx0dGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzWzBdPy51cmkgPz8gYXdhaXQgdGhpcy5maWxlRGlhbG9nU2VydmljZS5kZWZhdWx0RmlsZVBhdGgoKSA6XG5cdFx0XHRkaXJuYW1lKHRoaXMuZG9jdW1lbnRVcmkpO1xuXHRcdGxldCBkZWZhdWx0TmFtZTogc3RyaW5nO1xuXHRcdGlmIChldmVudC5kb3dubG9hZE5hbWUpIHtcblx0XHRcdGRlZmF1bHROYW1lID0gZXZlbnQuZG93bmxvYWROYW1lO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBtaW1lVHlwZSA9IHNwbGl0U3RhcnQucmVwbGFjZSgvXmRhdGE6LywgJycpO1xuXHRcdFx0Y29uc3QgY2FuZGlkYXRlRXh0ZW5zaW9uID0gbWltZVR5cGUgJiYgZ2V0RXh0ZW5zaW9uRm9yTWltZVR5cGUobWltZVR5cGUpO1xuXHRcdFx0ZGVmYXVsdE5hbWUgPSBjYW5kaWRhdGVFeHRlbnNpb24gPyBgZG93bmxvYWQke2NhbmRpZGF0ZUV4dGVuc2lvbn1gIDogJ2Rvd25sb2FkJztcblx0XHR9XG5cblx0XHRjb25zdCBkZWZhdWx0VXJpID0gam9pblBhdGgoZGVmYXVsdERpciwgZGVmYXVsdE5hbWUpO1xuXHRcdGNvbnN0IG5ld0ZpbGVVcmkgPSBhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnNob3dTYXZlRGlhbG9nKHtcblx0XHRcdGRlZmF1bHRVcmlcblx0XHR9KTtcblx0XHRpZiAoIW5ld0ZpbGVVcmkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBidWZmID0gZGVjb2RlQmFzZTY0KHNwbGl0RGF0YSk7XG5cdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUobmV3RmlsZVVyaSwgYnVmZik7XG5cdFx0YXdhaXQgdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4obmV3RmlsZVVyaSk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVJbnNldCh3ZWJ2aWV3U2VydmljZTogSVdlYnZpZXdTZXJ2aWNlLCBjb250ZW50OiBzdHJpbmcpIHtcblx0XHR0aGlzLmxvY2FsUmVzb3VyY2VSb290c0NhY2hlID0gdGhpcy5fZ2V0UmVzb3VyY2VSb290c0NhY2hlKCk7XG5cdFx0Y29uc3Qgd2VidmlldyA9IHdlYnZpZXdTZXJ2aWNlLmNyZWF0ZVdlYnZpZXdFbGVtZW50KHtcblx0XHRcdG9yaWdpbjogQmFja0xheWVyV2ViVmlldy5nZXRPcmlnaW5TdG9yZSh0aGlzLnN0b3JhZ2VTZXJ2aWNlKS5nZXRPcmlnaW4odGhpcy5ub3RlYm9va1ZpZXdUeXBlLCB1bmRlZmluZWQpLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnd2VidmlldyB0aXRsZScsIFwiTm90ZWJvb2sgd2VidmlldyBjb250ZW50XCIpLFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRwdXJwb3NlOiBXZWJ2aWV3Q29udGVudFB1cnBvc2UuTm90ZWJvb2tSZW5kZXJlcixcblx0XHRcdFx0ZW5hYmxlRmluZFdpZGdldDogZmFsc2UsXG5cdFx0XHRcdHRyYW5zZm9ybUNzc1ZhcmlhYmxlczogdHJhbnNmb3JtV2Vidmlld1RoZW1lVmFycyxcblx0XHRcdH0sXG5cdFx0XHRjb250ZW50T3B0aW9uczoge1xuXHRcdFx0XHRhbGxvd011bHRpcGxlQVBJQWNxdWlyZTogdHJ1ZSxcblx0XHRcdFx0YWxsb3dTY3JpcHRzOiB0cnVlLFxuXHRcdFx0XHRsb2NhbFJlc291cmNlUm9vdHM6IHRoaXMubG9jYWxSZXNvdXJjZVJvb3RzQ2FjaGUsXG5cdFx0XHR9LFxuXHRcdFx0ZXh0ZW5zaW9uOiB1bmRlZmluZWQsXG5cdFx0XHRwcm92aWRlZFZpZXdUeXBlOiAnbm90ZWJvb2sub3V0cHV0J1xuXHRcdH0pO1xuXG5cdFx0d2Vidmlldy5zZXRIdG1sKGNvbnRlbnQpO1xuXHRcdHdlYnZpZXcuc2V0Q29udGV4dEtleVNlcnZpY2UodGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0cmV0dXJuIHdlYnZpZXc7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRSZXNvdXJjZVJvb3RzQ2FjaGUoKTogVVJJW10ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlcnMgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubWFwKHggPT4geC51cmkpO1xuXHRcdGNvbnN0IG5vdGVib29rRGlyID0gdGhpcy5nZXROb3RlYm9va0Jhc2VVcmkoKTtcblx0XHRyZXR1cm4gW1xuXHRcdFx0dGhpcy5ub3RlYm9va1NlcnZpY2UuZ2V0Tm90ZWJvb2tQcm92aWRlclJlc291cmNlUm9vdHMoKSxcblx0XHRcdHRoaXMubm90ZWJvb2tTZXJ2aWNlLmdldFJlbmRlcmVycygpLm1hcCh4ID0+IGRpcm5hbWUoeC5lbnRyeXBvaW50LnBhdGgpKSxcblx0XHRcdC4uLkFycmF5LmZyb20odGhpcy5ub3RlYm9va1NlcnZpY2UuZ2V0U3RhdGljUHJlbG9hZHModGhpcy5ub3RlYm9va1ZpZXdUeXBlKSwgeCA9PiBbXG5cdFx0XHRcdGRpcm5hbWUoeC5lbnRyeXBvaW50KSxcblx0XHRcdFx0Li4ueC5sb2NhbFJlc291cmNlUm9vdHMsXG5cdFx0XHRdKSxcblx0XHRcdHdvcmtzcGFjZUZvbGRlcnMsXG5cdFx0XHRub3RlYm9va0Rpcixcblx0XHRcdHRoaXMuZ2V0QnVpbHRpbkxvY2FsUmVzb3VyY2VSb290cygpXG5cdFx0XS5mbGF0KCk7XG5cdH1cblxuXHRwcml2YXRlIGluaXRpYWxpemVXZWJWaWV3U3RhdGUoKSB7XG5cdFx0dGhpcy5fcHJlbG9hZHNDYWNoZS5jbGVhcigpO1xuXHRcdGlmICh0aGlzLl9jdXJyZW50S2VybmVsKSB7XG5cdFx0XHR0aGlzLl91cGRhdGVQcmVsb2Fkc0Zyb21LZXJuZWwodGhpcy5fY3VycmVudEtlcm5lbCk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBbb3V0cHV0LCBpbnNldF0gb2YgdGhpcy5pbnNldE1hcHBpbmcuZW50cmllcygpKSB7XG5cdFx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7IC4uLmluc2V0LmNhY2hlZENyZWF0aW9uLCBpbml0aWFsbHlIaWRkZW46IHRoaXMuaGlkZGVuSW5zZXRNYXBwaW5nLmhhcyhvdXRwdXQpIH0pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmluaXRpYWxpemVNYXJrdXBQcm9taXNlPy5pc0ZpcnN0SW5pdCkge1xuXHRcdFx0Ly8gT24gZmlyc3QgcnVuIHRoZSBjb250ZW50cyBoYXZlIGFscmVhZHkgYmVlbiBpbml0aWFsaXplZCBzbyB3ZSBkb24ndCBuZWVkIHRvIGluaXQgdGhlbSBhZ2FpblxuXHRcdFx0Ly8gbm8gb3Bcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbWRDZWxscyA9IFsuLi50aGlzLm1hcmt1cFByZXZpZXdNYXBwaW5nLnZhbHVlcygpXTtcblx0XHRcdHRoaXMubWFya3VwUHJldmlld01hcHBpbmcuY2xlYXIoKTtcblx0XHRcdHRoaXMuaW5pdGlhbGl6ZU1hcmt1cChtZENlbGxzKTtcblx0XHR9XG5cblx0XHR0aGlzLl91cGRhdGVTdHlsZXMoKTtcblx0XHR0aGlzLl91cGRhdGVPcHRpb25zKCk7XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZFVwZGF0ZUluc2V0KGNlbGw6IElHZW5lcmljQ2VsbFZpZXdNb2RlbCwgb3V0cHV0OiBJQ2VsbE91dHB1dFZpZXdNb2RlbCwgY2VsbFRvcDogbnVtYmVyLCBvdXRwdXRPZmZzZXQ6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICgnaXNPdXRwdXRDb2xsYXBzZWQnIGluIGNlbGwgJiYgKGNlbGwgYXMgSUNlbGxWaWV3TW9kZWwpLmlzT3V0cHV0Q29sbGFwc2VkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaGlkZGVuSW5zZXRNYXBwaW5nLmhhcyhvdXRwdXQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBvdXRwdXRDYWNoZSA9IHRoaXMuaW5zZXRNYXBwaW5nLmdldChvdXRwdXQpO1xuXHRcdGlmICghb3V0cHV0Q2FjaGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAob3V0cHV0T2Zmc2V0ID09PSBvdXRwdXRDYWNoZS5jYWNoZWRDcmVhdGlvbi5vdXRwdXRPZmZzZXQgJiYgY2VsbFRvcCA9PT0gb3V0cHV0Q2FjaGUuY2FjaGVkQ3JlYXRpb24uY2VsbFRvcCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0YWNrSGVpZ2h0KHVwZGF0ZXM6IHJlYWRvbmx5IElBY2tPdXRwdXRIZWlnaHRbXSk6IHZvaWQge1xuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICdhY2stZGltZW5zaW9uJyxcblx0XHRcdHVwZGF0ZXNcblx0XHR9KTtcblx0fVxuXG5cdHVwZGF0ZVNjcm9sbFRvcHMob3V0cHV0UmVxdWVzdHM6IElEaXNwbGF5T3V0cHV0TGF5b3V0VXBkYXRlUmVxdWVzdFtdLCBtYXJrdXBQcmV2aWV3czogeyBpZDogc3RyaW5nOyB0b3A6IG51bWJlciB9W10pIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB3aWRnZXRzID0gY29hbGVzY2Uob3V0cHV0UmVxdWVzdHMubWFwKChyZXF1ZXN0KTogSUNvbnRlbnRXaWRnZXRUb3BSZXF1ZXN0IHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdGNvbnN0IG91dHB1dENhY2hlID0gdGhpcy5pbnNldE1hcHBpbmcuZ2V0KHJlcXVlc3Qub3V0cHV0KTtcblx0XHRcdGlmICghb3V0cHV0Q2FjaGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXJlcXVlc3QuZm9yY2VEaXNwbGF5ICYmICF0aGlzLnNob3VsZFVwZGF0ZUluc2V0KHJlcXVlc3QuY2VsbCwgcmVxdWVzdC5vdXRwdXQsIHJlcXVlc3QuY2VsbFRvcCwgcmVxdWVzdC5vdXRwdXRPZmZzZXQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaWQgPSBvdXRwdXRDYWNoZS5vdXRwdXRJZDtcblx0XHRcdG91dHB1dENhY2hlLmNhY2hlZENyZWF0aW9uLmNlbGxUb3AgPSByZXF1ZXN0LmNlbGxUb3A7XG5cdFx0XHRvdXRwdXRDYWNoZS5jYWNoZWRDcmVhdGlvbi5vdXRwdXRPZmZzZXQgPSByZXF1ZXN0Lm91dHB1dE9mZnNldDtcblx0XHRcdHRoaXMuaGlkZGVuSW5zZXRNYXBwaW5nLmRlbGV0ZShyZXF1ZXN0Lm91dHB1dCk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNlbGxJZDogcmVxdWVzdC5jZWxsLmlkLFxuXHRcdFx0XHRvdXRwdXRJZDogaWQsXG5cdFx0XHRcdGNlbGxUb3A6IHJlcXVlc3QuY2VsbFRvcCxcblx0XHRcdFx0b3V0cHV0T2Zmc2V0OiByZXF1ZXN0Lm91dHB1dE9mZnNldCxcblx0XHRcdFx0Zm9yY2VEaXNwbGF5OiByZXF1ZXN0LmZvcmNlRGlzcGxheSxcblx0XHRcdH07XG5cdFx0fSkpO1xuXG5cdFx0aWYgKCF3aWRnZXRzLmxlbmd0aCAmJiAhbWFya3VwUHJldmlld3MubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0dHlwZTogJ3ZpZXctc2Nyb2xsJyxcblx0XHRcdHdpZGdldHM6IHdpZGdldHMsXG5cdFx0XHRtYXJrdXBDZWxsczogbWFya3VwUHJldmlld3MsXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZU1hcmt1cFByZXZpZXcoaW5pdGlhbGl6YXRpb246IElNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb24pIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5tYXJrdXBQcmV2aWV3TWFwcGluZy5oYXMoaW5pdGlhbGl6YXRpb24uY2VsbElkKSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignVHJ5aW5nIHRvIGNyZWF0ZSBtYXJrdXAgcHJldmlldyB0aGF0IGFscmVhZHkgZXhpc3RzJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5tYXJrdXBQcmV2aWV3TWFwcGluZy5zZXQoaW5pdGlhbGl6YXRpb24uY2VsbElkLCBpbml0aWFsaXphdGlvbik7XG5cdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0dHlwZTogJ2NyZWF0ZU1hcmt1cENlbGwnLFxuXHRcdFx0Y2VsbDogaW5pdGlhbGl6YXRpb25cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHNob3dNYXJrdXBQcmV2aWV3KG5ld0NvbnRlbnQ6IElNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb24pIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbnRyeSA9IHRoaXMubWFya3VwUHJldmlld01hcHBpbmcuZ2V0KG5ld0NvbnRlbnQuY2VsbElkKTtcblx0XHRpZiAoIWVudHJ5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVNYXJrdXBQcmV2aWV3KG5ld0NvbnRlbnQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNhbWVDb250ZW50ID0gbmV3Q29udGVudC5jb250ZW50ID09PSBlbnRyeS5jb250ZW50O1xuXHRcdGNvbnN0IHNhbWVNZXRhZGF0YSA9IChlcXVhbHMobmV3Q29udGVudC5tZXRhZGF0YSwgZW50cnkubWV0YWRhdGEpKTtcblx0XHRpZiAoIXNhbWVDb250ZW50IHx8ICFzYW1lTWV0YWRhdGEgfHwgIWVudHJ5LnZpc2libGUpIHtcblx0XHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdFx0dHlwZTogJ3Nob3dNYXJrdXBDZWxsJyxcblx0XHRcdFx0aWQ6IG5ld0NvbnRlbnQuY2VsbElkLFxuXHRcdFx0XHRoYW5kbGU6IG5ld0NvbnRlbnQuY2VsbEhhbmRsZSxcblx0XHRcdFx0Ly8gSWYgdGhlIGNvbnRlbnQgaGFzIG5vdCBjaGFuZ2VkLCB3ZSBzdGlsbCB3YW50IHRvIG1ha2Ugc3VyZSB0aGVcblx0XHRcdFx0Ly8gcHJldmlldyBpcyB2aXNpYmxlIGJ1dCBkb24ndCBuZWVkIHRvIHNlbmQgYW55dGhpbmcgb3ZlclxuXHRcdFx0XHRjb250ZW50OiBzYW1lQ29udGVudCA/IHVuZGVmaW5lZCA6IG5ld0NvbnRlbnQuY29udGVudCxcblx0XHRcdFx0dG9wOiBuZXdDb250ZW50Lm9mZnNldCxcblx0XHRcdFx0bWV0YWRhdGE6IHNhbWVNZXRhZGF0YSA/IHVuZGVmaW5lZCA6IG5ld0NvbnRlbnQubWV0YWRhdGFcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRlbnRyeS5tZXRhZGF0YSA9IG5ld0NvbnRlbnQubWV0YWRhdGE7XG5cdFx0ZW50cnkuY29udGVudCA9IG5ld0NvbnRlbnQuY29udGVudDtcblx0XHRlbnRyeS5vZmZzZXQgPSBuZXdDb250ZW50Lm9mZnNldDtcblx0XHRlbnRyeS52aXNpYmxlID0gdHJ1ZTtcblx0fVxuXG5cdGFzeW5jIGhpZGVNYXJrdXBQcmV2aWV3cyhjZWxsSWRzOiByZWFkb25seSBzdHJpbmdbXSkge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGxzVG9IaWRlOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY2VsbElkIG9mIGNlbGxJZHMpIHtcblx0XHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5tYXJrdXBQcmV2aWV3TWFwcGluZy5nZXQoY2VsbElkKTtcblx0XHRcdGlmIChlbnRyeSkge1xuXHRcdFx0XHRpZiAoZW50cnkudmlzaWJsZSkge1xuXHRcdFx0XHRcdGNlbGxzVG9IaWRlLnB1c2goY2VsbElkKTtcblx0XHRcdFx0XHRlbnRyeS52aXNpYmxlID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoY2VsbHNUb0hpZGUubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHRcdHR5cGU6ICdoaWRlTWFya3VwQ2VsbHMnLFxuXHRcdFx0XHRpZHM6IGNlbGxzVG9IaWRlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB1bmhpZGVNYXJrdXBQcmV2aWV3cyhjZWxsSWRzOiByZWFkb25seSBzdHJpbmdbXSkge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvVW5oaWRlOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY2VsbElkIG9mIGNlbGxJZHMpIHtcblx0XHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5tYXJrdXBQcmV2aWV3TWFwcGluZy5nZXQoY2VsbElkKTtcblx0XHRcdGlmIChlbnRyeSkge1xuXHRcdFx0XHRpZiAoIWVudHJ5LnZpc2libGUpIHtcblx0XHRcdFx0XHRlbnRyeS52aXNpYmxlID0gdHJ1ZTtcblx0XHRcdFx0XHR0b1VuaGlkZS5wdXNoKGNlbGxJZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoYFRyeWluZyB0byB1bmhpZGUgYSBwcmV2aWV3IHRoYXQgZG9lcyBub3QgZXhpc3Q6ICR7Y2VsbElkfWApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICd1bmhpZGVNYXJrdXBDZWxscycsXG5cdFx0XHRpZHM6IHRvVW5oaWRlLFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgZGVsZXRlTWFya3VwUHJldmlld3MoY2VsbElkczogcmVhZG9ubHkgc3RyaW5nW10pIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGlkIG9mIGNlbGxJZHMpIHtcblx0XHRcdGlmICghdGhpcy5tYXJrdXBQcmV2aWV3TWFwcGluZy5oYXMoaWQpKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoYFRyeWluZyB0byBkZWxldGUgYSBwcmV2aWV3IHRoYXQgZG9lcyBub3QgZXhpc3Q6ICR7aWR9YCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm1hcmt1cFByZXZpZXdNYXBwaW5nLmRlbGV0ZShpZCk7XG5cdFx0fVxuXG5cdFx0aWYgKGNlbGxJZHMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHRcdHR5cGU6ICdkZWxldGVNYXJrdXBDZWxsJyxcblx0XHRcdFx0aWRzOiBjZWxsSWRzXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB1cGRhdGVNYXJrdXBQcmV2aWV3U2VsZWN0aW9ucyhzZWxlY3RlZENlbGxzSWRzOiBzdHJpbmdbXSkge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICd1cGRhdGVTZWxlY3RlZE1hcmt1cENlbGxzJyxcblx0XHRcdHNlbGVjdGVkQ2VsbElkczogc2VsZWN0ZWRDZWxsc0lkcy5maWx0ZXIoaWQgPT4gdGhpcy5tYXJrdXBQcmV2aWV3TWFwcGluZy5oYXMoaWQpKSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGluaXRpYWxpemVNYXJrdXAoY2VsbHM6IHJlYWRvbmx5IElNYXJrdXBDZWxsSW5pdGlhbGl6YXRpb25bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaW5pdGlhbGl6ZU1hcmt1cFByb21pc2U/LnAuY29tcGxldGUoKTtcblx0XHRjb25zdCByZXF1ZXN0SWQgPSBVVUlELmdlbmVyYXRlVXVpZCgpO1xuXHRcdHRoaXMuaW5pdGlhbGl6ZU1hcmt1cFByb21pc2UgPSB7IHA6IG5ldyBEZWZlcnJlZFByb21pc2UoKSwgcmVxdWVzdElkLCBpc0ZpcnN0SW5pdDogdGhpcy5maXJzdEluaXQgfTtcblxuXHRcdHRoaXMuZmlyc3RJbml0ID0gZmFsc2U7XG5cblx0XHRmb3IgKGNvbnN0IGNlbGwgb2YgY2VsbHMpIHtcblx0XHRcdHRoaXMubWFya3VwUHJldmlld01hcHBpbmcuc2V0KGNlbGwuY2VsbElkLCBjZWxsKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHR0eXBlOiAnaW5pdGlhbGl6ZU1hcmt1cCcsXG5cdFx0XHRjZWxscyxcblx0XHRcdHJlcXVlc3RJZCxcblx0XHR9KTtcblxuXHRcdHJldHVybiB0aGlzLmluaXRpYWxpemVNYXJrdXBQcm9taXNlLnAucDtcblx0fVxuXG5cdC8qKlxuXHQgKiBWYWxpZGF0ZSBpZiBjYWNoZWQgaW5zZXQgaXMgb3V0IG9mIGRhdGUgYW5kIHJlcXVpcmUgYSByZXJlbmRlclxuXHQgKiBOb3RlIHRoYXQgaXQgZG9lc24ndCBhY2NvdW50IGZvciBvdXRwdXQgY29udGVudCBjaGFuZ2UuXG5cdCAqL1xuXHRwcml2YXRlIF9jYWNoZWRJbnNldEVxdWFsKGNhY2hlZEluc2V0OiBJQ2FjaGVkSW5zZXQ8VD4sIGNvbnRlbnQ6IElJbnNldFJlbmRlck91dHB1dCkge1xuXHRcdGlmIChjb250ZW50LnR5cGUgPT09IFJlbmRlck91dHB1dFR5cGUuRXh0ZW5zaW9uKSB7XG5cdFx0XHQvLyBVc2UgYSBuZXcgcmVuZGVyZXJcblx0XHRcdHJldHVybiBjYWNoZWRJbnNldC5yZW5kZXJlcj8uaWQgPT09IGNvbnRlbnQucmVuZGVyZXIuaWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFRoZSBuZXcgcmVuZGVyZXIgaXMgdGhlIGRlZmF1bHQgSFRNTCByZW5kZXJlclxuXHRcdFx0cmV0dXJuIGNhY2hlZEluc2V0LmNhY2hlZENyZWF0aW9uLnR5cGUgPT09ICdodG1sJztcblx0XHR9XG5cdH1cblxuXHRyZXF1ZXN0Q3JlYXRlT3V0cHV0V2hlbldlYnZpZXdJZGxlKGNlbGxJbmZvOiBULCBjb250ZW50OiBJSW5zZXRSZW5kZXJPdXRwdXQsIGNlbGxUb3A6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIpIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pbnNldE1hcHBpbmcuaGFzKGNvbnRlbnQuc291cmNlKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnBlbmRpbmdXZWJ2aWV3SWRsZUNyZWF0aW9uUmVxdWVzdC5oYXMoY29udGVudC5zb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucGVuZGluZ1dlYnZpZXdJZGxlSW5zZXRNYXBwaW5nLmhhcyhjb250ZW50LnNvdXJjZSkpIHtcblx0XHRcdC8vIGhhbmRsZWQgaW4gcmVuZGVyZXIgcHJvY2Vzcywgd2FpdGluZyBmb3Igd2VidmlldyB0byBwcm9jZXNzIGl0IHdoZW4gaWRsZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMucGVuZGluZ1dlYnZpZXdJZGxlQ3JlYXRpb25SZXF1ZXN0LnNldChjb250ZW50LnNvdXJjZSwgcnVuV2hlbkdsb2JhbElkbGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgeyBtZXNzYWdlLCByZW5kZXJlciwgdHJhbnNmZXI6IHRyYW5zZmVyYWJsZSB9ID0gdGhpcy5fY3JlYXRlT3V0cHV0Q3JlYXRpb25NZXNzYWdlKGNlbGxJbmZvLCBjb250ZW50LCBjZWxsVG9wLCBvZmZzZXQsIHRydWUsIHRydWUpO1xuXHRcdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcobWVzc2FnZSwgdHJhbnNmZXJhYmxlKTtcblx0XHRcdHRoaXMucGVuZGluZ1dlYnZpZXdJZGxlSW5zZXRNYXBwaW5nLnNldChjb250ZW50LnNvdXJjZSwgeyBvdXRwdXRJZDogbWVzc2FnZS5vdXRwdXRJZCwgdmVyc2lvbklkOiBjb250ZW50LnNvdXJjZS5tb2RlbC52ZXJzaW9uSWQsIGNlbGxJbmZvOiBjZWxsSW5mbywgcmVuZGVyZXIsIGNhY2hlZENyZWF0aW9uOiBtZXNzYWdlIH0pO1xuXHRcdFx0dGhpcy5yZXZlcnNlZFBlbmRpbmdXZWJ2aWV3SWRsZUluc2V0TWFwcGluZy5zZXQobWVzc2FnZS5vdXRwdXRJZCwgY29udGVudC5zb3VyY2UpO1xuXHRcdFx0dGhpcy5wZW5kaW5nV2Vidmlld0lkbGVDcmVhdGlvblJlcXVlc3QuZGVsZXRlKGNvbnRlbnQuc291cmNlKTtcblx0XHR9KSk7XG5cdH1cblxuXHRjcmVhdGVPdXRwdXQoY2VsbEluZm86IFQsIGNvbnRlbnQ6IElJbnNldFJlbmRlck91dHB1dCwgY2VsbFRvcDogbnVtYmVyLCBvZmZzZXQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhY2hlZEluc2V0ID0gdGhpcy5pbnNldE1hcHBpbmcuZ2V0KGNvbnRlbnQuc291cmNlKTtcblxuXHRcdC8vIHdlIG5vdyByZXF1ZXN0IHRvIHJlbmRlciB0aGUgb3V0cHV0IGltbWVkaWF0ZWx5LCBzbyB3ZSBjYW4gcmVtb3ZlIHRoZSBwZW5kaW5nIHJlcXVlc3Rcblx0XHQvLyBkaXNwb3NlIHRoZSBwZW5kaW5nIHJlcXVlc3QgaW4gcmVuZGVyZXIgcHJvY2VzcyBpZiBpdCBleGlzdHNcblx0XHR0aGlzLnBlbmRpbmdXZWJ2aWV3SWRsZUNyZWF0aW9uUmVxdWVzdC5nZXQoY29udGVudC5zb3VyY2UpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5wZW5kaW5nV2Vidmlld0lkbGVDcmVhdGlvblJlcXVlc3QuZGVsZXRlKGNvbnRlbnQuc291cmNlKTtcblxuXHRcdC8vIGlmIHJlcXVlc3QgaGFzIGFscmVhZHkgYmVlbiBzZW50IG91dCwgd2UgdGhlbiByZW1vdmUgaXQgZnJvbSB0aGUgcGVuZGluZyBtYXBwaW5nXG5cdFx0dGhpcy5wZW5kaW5nV2Vidmlld0lkbGVJbnNldE1hcHBpbmcuZGVsZXRlKGNvbnRlbnQuc291cmNlKTtcblx0XHRpZiAoY2FjaGVkSW5zZXQpIHtcblx0XHRcdHRoaXMucmV2ZXJzZWRQZW5kaW5nV2Vidmlld0lkbGVJbnNldE1hcHBpbmcuZGVsZXRlKGNhY2hlZEluc2V0Lm91dHB1dElkKTtcblx0XHR9XG5cblx0XHRpZiAoY2FjaGVkSW5zZXQgJiYgdGhpcy5fY2FjaGVkSW5zZXRFcXVhbChjYWNoZWRJbnNldCwgY29udGVudCkpIHtcblx0XHRcdHRoaXMuaGlkZGVuSW5zZXRNYXBwaW5nLmRlbGV0ZShjb250ZW50LnNvdXJjZSk7XG5cdFx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHRcdHR5cGU6ICdzaG93T3V0cHV0Jyxcblx0XHRcdFx0Y2VsbElkOiBjYWNoZWRJbnNldC5jZWxsSW5mby5jZWxsSWQsXG5cdFx0XHRcdG91dHB1dElkOiBjYWNoZWRJbnNldC5vdXRwdXRJZCxcblx0XHRcdFx0Y2VsbFRvcDogY2VsbFRvcCxcblx0XHRcdFx0b3V0cHV0T2Zmc2V0OiBvZmZzZXRcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIGNyZWF0ZSBuZXcgb3V0cHV0XG5cdFx0Y29uc3QgeyBtZXNzYWdlLCByZW5kZXJlciwgdHJhbnNmZXI6IHRyYW5zZmVyYWJsZSB9ID0gdGhpcy5fY3JlYXRlT3V0cHV0Q3JlYXRpb25NZXNzYWdlKGNlbGxJbmZvLCBjb250ZW50LCBjZWxsVG9wLCBvZmZzZXQsIGZhbHNlLCBmYWxzZSk7XG5cdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcobWVzc2FnZSwgdHJhbnNmZXJhYmxlKTtcblx0XHR0aGlzLmluc2V0TWFwcGluZy5zZXQoY29udGVudC5zb3VyY2UsIHsgb3V0cHV0SWQ6IG1lc3NhZ2Uub3V0cHV0SWQsIHZlcnNpb25JZDogY29udGVudC5zb3VyY2UubW9kZWwudmVyc2lvbklkLCBjZWxsSW5mbzogY2VsbEluZm8sIHJlbmRlcmVyLCBjYWNoZWRDcmVhdGlvbjogbWVzc2FnZSB9KTtcblx0XHR0aGlzLmhpZGRlbkluc2V0TWFwcGluZy5kZWxldGUoY29udGVudC5zb3VyY2UpO1xuXHRcdHRoaXMucmV2ZXJzZWRJbnNldE1hcHBpbmcuc2V0KG1lc3NhZ2Uub3V0cHV0SWQsIGNvbnRlbnQuc291cmNlKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlTWV0YWRhdGEob3V0cHV0OiBJQ2VsbE91dHB1dCwgbWltZVR5cGU6IHN0cmluZykge1xuXHRcdGlmIChtaW1lVHlwZS5zdGFydHNXaXRoKCdpbWFnZScpKSB7XG5cdFx0XHRjb25zdCBidWZmZXIgPSBvdXRwdXQub3V0cHV0cy5maW5kKG91dCA9PiBvdXQubWltZSA9PT0gJ3RleHQvcGxhaW4nKT8uZGF0YS5idWZmZXI7XG5cdFx0XHRpZiAoYnVmZmVyPy5sZW5ndGggJiYgYnVmZmVyPy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IGFsdFRleHQgPSBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYnVmZmVyKTtcblx0XHRcdFx0cmV0dXJuIHsgLi4ub3V0cHV0Lm1ldGFkYXRhLCB2c2NvZGVfYWx0VGV4dDogYWx0VGV4dCB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0Lm1ldGFkYXRhO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlT3V0cHV0Q3JlYXRpb25NZXNzYWdlKGNlbGxJbmZvOiBULCBjb250ZW50OiBJSW5zZXRSZW5kZXJPdXRwdXQsIGNlbGxUb3A6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIsIGNyZWF0ZU9uSWRsZTogYm9vbGVhbiwgaW5pdGlhbGx5SGlkZGVuOiBib29sZWFuKTogeyByZWFkb25seSBtZXNzYWdlOiBJQ3JlYXRpb25SZXF1ZXN0TWVzc2FnZTsgcmVhZG9ubHkgcmVuZGVyZXI6IElOb3RlYm9va1JlbmRlcmVySW5mbyB8IHVuZGVmaW5lZDsgdHJhbnNmZXI6IHJlYWRvbmx5IEFycmF5QnVmZmVyW10gfSB7XG5cdFx0Y29uc3QgbWVzc2FnZUJhc2UgPSB7XG5cdFx0XHR0eXBlOiAnaHRtbCcsXG5cdFx0XHRleGVjdXRpb25JZDogY2VsbEluZm8uZXhlY3V0aW9uSWQsXG5cdFx0XHRjZWxsSWQ6IGNlbGxJbmZvLmNlbGxJZCxcblx0XHRcdGNlbGxUb3A6IGNlbGxUb3AsXG5cdFx0XHRvdXRwdXRPZmZzZXQ6IG9mZnNldCxcblx0XHRcdGxlZnQ6IDAsXG5cdFx0XHRyZXF1aXJlZFByZWxvYWRzOiBbXSxcblx0XHRcdGNyZWF0ZU9uSWRsZTogY3JlYXRlT25JZGxlXG5cdFx0fSBhcyBjb25zdDtcblxuXHRcdGNvbnN0IHRyYW5zZmVyOiBBcnJheUJ1ZmZlcltdID0gW107XG5cblx0XHRsZXQgbWVzc2FnZTogSUNyZWF0aW9uUmVxdWVzdE1lc3NhZ2U7XG5cdFx0bGV0IHJlbmRlcmVyOiBJTm90ZWJvb2tSZW5kZXJlckluZm8gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGNvbnRlbnQudHlwZSA9PT0gUmVuZGVyT3V0cHV0VHlwZS5FeHRlbnNpb24pIHtcblx0XHRcdGNvbnN0IG91dHB1dCA9IGNvbnRlbnQuc291cmNlLm1vZGVsO1xuXHRcdFx0cmVuZGVyZXIgPSBjb250ZW50LnJlbmRlcmVyO1xuXHRcdFx0Y29uc3QgZmlyc3QgPSBvdXRwdXQub3V0cHV0cy5maW5kKG9wID0+IG9wLm1pbWUgPT09IGNvbnRlbnQubWltZVR5cGUpITtcblx0XHRcdGNvbnN0IG1ldGFkYXRhID0gdGhpcy5jcmVhdGVNZXRhZGF0YShvdXRwdXQsIGNvbnRlbnQubWltZVR5cGUpO1xuXHRcdFx0Y29uc3QgdmFsdWVCeXRlcyA9IGNvcHlCdWZmZXJJZk5lZWRlZChmaXJzdC5kYXRhLmJ1ZmZlciwgdHJhbnNmZXIpO1xuXHRcdFx0bWVzc2FnZSA9IHtcblx0XHRcdFx0Li4ubWVzc2FnZUJhc2UsXG5cdFx0XHRcdG91dHB1dElkOiBvdXRwdXQub3V0cHV0SWQsXG5cdFx0XHRcdHJlbmRlcmVySWQ6IGNvbnRlbnQucmVuZGVyZXIuaWQsXG5cdFx0XHRcdGNvbnRlbnQ6IHtcblx0XHRcdFx0XHR0eXBlOiBSZW5kZXJPdXRwdXRUeXBlLkV4dGVuc2lvbixcblx0XHRcdFx0XHRvdXRwdXRJZDogb3V0cHV0Lm91dHB1dElkLFxuXHRcdFx0XHRcdG1ldGFkYXRhOiBtZXRhZGF0YSxcblx0XHRcdFx0XHRvdXRwdXQ6IHtcblx0XHRcdFx0XHRcdG1pbWU6IGZpcnN0Lm1pbWUsXG5cdFx0XHRcdFx0XHR2YWx1ZUJ5dGVzLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YWxsT3V0cHV0czogb3V0cHV0Lm91dHB1dHMubWFwKG91dHB1dCA9PiAoeyBtaW1lOiBvdXRwdXQubWltZSB9KSksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGluaXRpYWxseUhpZGRlbjogaW5pdGlhbGx5SGlkZGVuXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlID0ge1xuXHRcdFx0XHQuLi5tZXNzYWdlQmFzZSxcblx0XHRcdFx0b3V0cHV0SWQ6IFVVSUQuZ2VuZXJhdGVVdWlkKCksXG5cdFx0XHRcdGNvbnRlbnQ6IHtcblx0XHRcdFx0XHR0eXBlOiBjb250ZW50LnR5cGUsXG5cdFx0XHRcdFx0aHRtbENvbnRlbnQ6IGNvbnRlbnQuaHRtbENvbnRlbnQsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGluaXRpYWxseUhpZGRlbjogaW5pdGlhbGx5SGlkZGVuXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRtZXNzYWdlLFxuXHRcdFx0cmVuZGVyZXIsXG5cdFx0XHR0cmFuc2Zlcixcblx0XHR9O1xuXHR9XG5cblx0dXBkYXRlT3V0cHV0KGNlbGxJbmZvOiBULCBjb250ZW50OiBJSW5zZXRSZW5kZXJPdXRwdXQsIGNlbGxUb3A6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuaW5zZXRNYXBwaW5nLmhhcyhjb250ZW50LnNvdXJjZSkpIHtcblx0XHRcdHRoaXMuY3JlYXRlT3V0cHV0KGNlbGxJbmZvLCBjb250ZW50LCBjZWxsVG9wLCBvZmZzZXQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG91dHB1dENhY2hlID0gdGhpcy5pbnNldE1hcHBpbmcuZ2V0KGNvbnRlbnQuc291cmNlKSE7XG5cblx0XHRpZiAob3V0cHV0Q2FjaGUudmVyc2lvbklkID09PSBjb250ZW50LnNvdXJjZS5tb2RlbC52ZXJzaW9uSWQpIHtcblx0XHRcdC8vIGFscmVhZHkgc2VudCB0aGlzIG91dHB1dCB2ZXJzaW9uIHRvIHRoZSByZW5kZXJlclxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlkZGVuSW5zZXRNYXBwaW5nLmRlbGV0ZShjb250ZW50LnNvdXJjZSk7XG5cdFx0bGV0IHVwZGF0ZWRDb250ZW50OiBJQ3JlYXRpb25Db250ZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgdHJhbnNmZXI6IEFycmF5QnVmZmVyW10gPSBbXTtcblx0XHRpZiAoY29udGVudC50eXBlID09PSBSZW5kZXJPdXRwdXRUeXBlLkV4dGVuc2lvbikge1xuXHRcdFx0Y29uc3Qgb3V0cHV0ID0gY29udGVudC5zb3VyY2UubW9kZWw7XG5cdFx0XHRjb25zdCBmaXJzdEJ1ZmZlciA9IG91dHB1dC5vdXRwdXRzLmZpbmQob3AgPT4gb3AubWltZSA9PT0gY29udGVudC5taW1lVHlwZSkhO1xuXHRcdFx0Y29uc3QgYXBwZW5lZGVkRGF0YSA9IG91dHB1dC5hcHBlbmRlZFNpbmNlVmVyc2lvbihvdXRwdXRDYWNoZS52ZXJzaW9uSWQsIGNvbnRlbnQubWltZVR5cGUpO1xuXHRcdFx0Y29uc3QgYXBwZW5kZWQgPSBhcHBlbmVkZWREYXRhID8geyB2YWx1ZUJ5dGVzOiBhcHBlbmVkZWREYXRhLmJ1ZmZlciwgcHJldmlvdXNWZXJzaW9uOiBvdXRwdXRDYWNoZS52ZXJzaW9uSWQgfSA6IHVuZGVmaW5lZDtcblxuXHRcdFx0Y29uc3QgdmFsdWVCeXRlcyA9IGNvcHlCdWZmZXJJZk5lZWRlZChmaXJzdEJ1ZmZlci5kYXRhLmJ1ZmZlciwgdHJhbnNmZXIpO1xuXHRcdFx0dXBkYXRlZENvbnRlbnQgPSB7XG5cdFx0XHRcdHR5cGU6IFJlbmRlck91dHB1dFR5cGUuRXh0ZW5zaW9uLFxuXHRcdFx0XHRvdXRwdXRJZDogb3V0cHV0Q2FjaGUub3V0cHV0SWQsXG5cdFx0XHRcdG1ldGFkYXRhOiBvdXRwdXQubWV0YWRhdGEsXG5cdFx0XHRcdG91dHB1dDoge1xuXHRcdFx0XHRcdG1pbWU6IGNvbnRlbnQubWltZVR5cGUsXG5cdFx0XHRcdFx0dmFsdWVCeXRlcyxcblx0XHRcdFx0XHRhcHBlbmRlZDogYXBwZW5kZWRcblx0XHRcdFx0fSxcblx0XHRcdFx0YWxsT3V0cHV0czogb3V0cHV0Lm91dHB1dHMubWFwKG91dHB1dCA9PiAoeyBtaW1lOiBvdXRwdXQubWltZSB9KSlcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0dHlwZTogJ3Nob3dPdXRwdXQnLFxuXHRcdFx0Y2VsbElkOiBvdXRwdXRDYWNoZS5jZWxsSW5mby5jZWxsSWQsXG5cdFx0XHRvdXRwdXRJZDogb3V0cHV0Q2FjaGUub3V0cHV0SWQsXG5cdFx0XHRjZWxsVG9wOiBjZWxsVG9wLFxuXHRcdFx0b3V0cHV0T2Zmc2V0OiBvZmZzZXQsXG5cdFx0XHRjb250ZW50OiB1cGRhdGVkQ29udGVudFxuXHRcdH0sIHRyYW5zZmVyKTtcblxuXHRcdG91dHB1dENhY2hlLnZlcnNpb25JZCA9IGNvbnRlbnQuc291cmNlLm1vZGVsLnZlcnNpb25JZDtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRhc3luYyBjb3B5SW1hZ2Uob3V0cHV0OiBJQ2VsbE91dHB1dFZpZXdNb2RlbCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICdjb3B5SW1hZ2UnLFxuXHRcdFx0b3V0cHV0SWQ6IG91dHB1dC5tb2RlbC5vdXRwdXRJZCxcblx0XHRcdGFsdE91dHB1dElkOiBvdXRwdXQubW9kZWwuYWx0ZXJuYXRpdmVPdXRwdXRJZFxuXHRcdH0pO1xuXHR9XG5cblx0cmVtb3ZlSW5zZXRzKG91dHB1dHM6IHJlYWRvbmx5IElDZWxsT3V0cHV0Vmlld01vZGVsW10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IG91dHB1dCBvZiBvdXRwdXRzKSB7XG5cdFx0XHRjb25zdCBvdXRwdXRDYWNoZSA9IHRoaXMuaW5zZXRNYXBwaW5nLmdldChvdXRwdXQpO1xuXHRcdFx0aWYgKCFvdXRwdXRDYWNoZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaWQgPSBvdXRwdXRDYWNoZS5vdXRwdXRJZDtcblxuXHRcdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0XHR0eXBlOiAnY2xlYXJPdXRwdXQnLFxuXHRcdFx0XHRyZW5kZXJlcklkOiBvdXRwdXRDYWNoZS5jYWNoZWRDcmVhdGlvbi5yZW5kZXJlcklkLFxuXHRcdFx0XHRjZWxsVXJpOiBvdXRwdXRDYWNoZS5jZWxsSW5mby5jZWxsVXJpLnRvU3RyaW5nKCksXG5cdFx0XHRcdG91dHB1dElkOiBpZCxcblx0XHRcdFx0Y2VsbElkOiBvdXRwdXRDYWNoZS5jZWxsSW5mby5jZWxsSWRcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5pbnNldE1hcHBpbmcuZGVsZXRlKG91dHB1dCk7XG5cdFx0XHR0aGlzLnBlbmRpbmdXZWJ2aWV3SWRsZUNyZWF0aW9uUmVxdWVzdC5nZXQob3V0cHV0KT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5wZW5kaW5nV2Vidmlld0lkbGVDcmVhdGlvblJlcXVlc3QuZGVsZXRlKG91dHB1dCk7XG5cdFx0XHR0aGlzLnBlbmRpbmdXZWJ2aWV3SWRsZUluc2V0TWFwcGluZy5kZWxldGUob3V0cHV0KTtcblx0XHRcdHRoaXMucmV2ZXJzZWRQZW5kaW5nV2Vidmlld0lkbGVJbnNldE1hcHBpbmcuZGVsZXRlKGlkKTtcblx0XHRcdHRoaXMucmV2ZXJzZWRJbnNldE1hcHBpbmcuZGVsZXRlKGlkKTtcblx0XHR9XG5cdH1cblxuXHRoaWRlSW5zZXQob3V0cHV0OiBJQ2VsbE91dHB1dFZpZXdNb2RlbCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG91dHB1dENhY2hlID0gdGhpcy5pbnNldE1hcHBpbmcuZ2V0KG91dHB1dCk7XG5cdFx0aWYgKCFvdXRwdXRDYWNoZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlkZGVuSW5zZXRNYXBwaW5nLmFkZChvdXRwdXQpO1xuXG5cdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0dHlwZTogJ2hpZGVPdXRwdXQnLFxuXHRcdFx0b3V0cHV0SWQ6IG91dHB1dENhY2hlLm91dHB1dElkLFxuXHRcdFx0Y2VsbElkOiBvdXRwdXRDYWNoZS5jZWxsSW5mby5jZWxsSWQsXG5cdFx0fSk7XG5cdH1cblxuXHRmb2N1c1dlYnZpZXcoKSB7XG5cdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy53ZWJ2aWV3Py5mb2N1cygpO1xuXHR9XG5cblx0c2VsZWN0T3V0cHV0Q29udGVudHMoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgb3V0cHV0ID0gY2VsbC5vdXRwdXRzVmlld01vZGVscy5maW5kKG8gPT4gby5tb2RlbC5vdXRwdXRJZCA9PT0gY2VsbC5mb2N1c2VkT3V0cHV0SWQpO1xuXHRcdGNvbnN0IG91dHB1dElkID0gb3V0cHV0ID8gdGhpcy5pbnNldE1hcHBpbmcuZ2V0KG91dHB1dCk/Lm91dHB1dElkIDogdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICdzZWxlY3Qtb3V0cHV0LWNvbnRlbnRzJyxcblx0XHRcdGNlbGxPck91dHB1dElkOiBvdXRwdXRJZCB8fCBjZWxsLmlkXG5cdFx0fSk7XG5cdH1cblxuXHRzZWxlY3RJbnB1dENvbnRlbnRzKGNlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IG91dHB1dCA9IGNlbGwub3V0cHV0c1ZpZXdNb2RlbHMuZmluZChvID0+IG8ubW9kZWwub3V0cHV0SWQgPT09IGNlbGwuZm9jdXNlZE91dHB1dElkKTtcblx0XHRjb25zdCBvdXRwdXRJZCA9IG91dHB1dCA/IHRoaXMuaW5zZXRNYXBwaW5nLmdldChvdXRwdXQpPy5vdXRwdXRJZCA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHR0eXBlOiAnc2VsZWN0LWlucHV0LWNvbnRlbnRzJyxcblx0XHRcdGNlbGxPck91dHB1dElkOiBvdXRwdXRJZCB8fCBjZWxsLmlkXG5cdFx0fSk7XG5cdH1cblxuXHRmb2N1c091dHB1dChjZWxsT3JPdXRwdXRJZDogc3RyaW5nLCBhbHRlcm5hdGVJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCB2aWV3Rm9jdXNlZDogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdmlld0ZvY3VzZWQpIHtcblx0XHRcdHRoaXMud2Vidmlldz8uZm9jdXMoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHR0eXBlOiAnZm9jdXMtb3V0cHV0Jyxcblx0XHRcdGNlbGxPck91dHB1dElkOiBjZWxsT3JPdXRwdXRJZCxcblx0XHRcdGFsdGVybmF0ZUlkOiBhbHRlcm5hdGVJZFxuXHRcdH0pO1xuXHR9XG5cblx0Ymx1ck91dHB1dCgpIHtcblx0XHRpZiAodGhpcy5fZGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHR0eXBlOiAnYmx1ci1vdXRwdXQnXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBmaW5kKHF1ZXJ5OiBzdHJpbmcsIG9wdGlvbnM6IHsgd2hvbGVXb3JkPzogYm9vbGVhbjsgY2FzZVNlbnNpdGl2ZT86IGJvb2xlYW47IGluY2x1ZGVNYXJrdXA6IGJvb2xlYW47IGluY2x1ZGVPdXRwdXQ6IGJvb2xlYW47IHNob3VsZEdldFNlYXJjaFByZXZpZXdJbmZvOiBib29sZWFuOyBvd25lcklEOiBzdHJpbmc7IGZpbmRJZHM6IHN0cmluZ1tdIH0pOiBQcm9taXNlPElGaW5kTWF0Y2hbXT4ge1xuXHRcdGlmIChxdWVyeSA9PT0gJycpIHtcblx0XHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdFx0dHlwZTogJ2ZpbmRTdG9wJyxcblx0XHRcdFx0b3duZXJJRDogb3B0aW9ucy5vd25lcklEXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBwID0gbmV3IFByb21pc2U8SUZpbmRNYXRjaFtdPihyZXNvbHZlID0+IHtcblx0XHRcdGNvbnN0IHN1YiA9IHRoaXMud2Vidmlldz8ub25NZXNzYWdlKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5tZXNzYWdlLnR5cGUgPT09ICdkaWRGaW5kJykge1xuXHRcdFx0XHRcdHJlc29sdmUoZS5tZXNzYWdlLm1hdGNoZXMpO1xuXHRcdFx0XHRcdHN1Yj8uZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICdmaW5kJyxcblx0XHRcdHF1ZXJ5OiBxdWVyeSxcblx0XHRcdG9wdGlvbnNcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJldCA9IGF3YWl0IHA7XG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdGZpbmRTdG9wKG93bmVySUQ6IHN0cmluZykge1xuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICdmaW5kU3RvcCcsXG5cdFx0XHRvd25lcklEXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBmaW5kSGlnaGxpZ2h0Q3VycmVudChpbmRleDogbnVtYmVyLCBvd25lcklEOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGNvbnN0IHAgPSBuZXcgUHJvbWlzZTxudW1iZXI+KHJlc29sdmUgPT4ge1xuXHRcdFx0Y29uc3Qgc3ViID0gdGhpcy53ZWJ2aWV3Py5vbk1lc3NhZ2UoZSA9PiB7XG5cdFx0XHRcdGlmIChlLm1lc3NhZ2UudHlwZSA9PT0gJ2RpZEZpbmRIaWdobGlnaHRDdXJyZW50Jykge1xuXHRcdFx0XHRcdHJlc29sdmUoZS5tZXNzYWdlLm9mZnNldCk7XG5cdFx0XHRcdFx0c3ViPy5kaXNwb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0dHlwZTogJ2ZpbmRIaWdobGlnaHRDdXJyZW50Jyxcblx0XHRcdGluZGV4LFxuXHRcdFx0b3duZXJJRFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmV0ID0gYXdhaXQgcDtcblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0YXN5bmMgZmluZFVuSGlnaGxpZ2h0Q3VycmVudChpbmRleDogbnVtYmVyLCBvd25lcklEOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHR0eXBlOiAnZmluZFVuSGlnaGxpZ2h0Q3VycmVudCcsXG5cdFx0XHRpbmRleCxcblx0XHRcdG93bmVySURcblx0XHR9KTtcblx0fVxuXG5cblx0ZGVsdGFDZWxsT3V0cHV0Q29udGFpbmVyQ2xhc3NOYW1lcyhjZWxsSWQ6IHN0cmluZywgYWRkZWQ6IHN0cmluZ1tdLCByZW1vdmVkOiBzdHJpbmdbXSkge1xuXHRcdHRoaXMuX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KHtcblx0XHRcdHR5cGU6ICdkZWNvcmF0aW9ucycsXG5cdFx0XHRjZWxsSWQsXG5cdFx0XHRhZGRlZENsYXNzTmFtZXM6IGFkZGVkLFxuXHRcdFx0cmVtb3ZlZENsYXNzTmFtZXM6IHJlbW92ZWRcblx0XHR9KTtcblx0fVxuXG5cdGRlbHRhTWFya3VwUHJldmlld0NsYXNzTmFtZXMoY2VsbElkOiBzdHJpbmcsIGFkZGVkOiBzdHJpbmdbXSwgcmVtb3ZlZDogc3RyaW5nW10pIHtcblx0XHRpZiAodGhpcy5tYXJrdXBQcmV2aWV3TWFwcGluZy5nZXQoY2VsbElkKSkge1xuXHRcdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0XHR0eXBlOiAnbWFya3VwRGVjb3JhdGlvbnMnLFxuXHRcdFx0XHRjZWxsSWQsXG5cdFx0XHRcdGFkZGVkQ2xhc3NOYW1lczogYWRkZWQsXG5cdFx0XHRcdHJlbW92ZWRDbGFzc05hbWVzOiByZW1vdmVkXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHR1cGRhdGVPdXRwdXRSZW5kZXJlcnMoKSB7XG5cdFx0aWYgKCF0aGlzLndlYnZpZXcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZW5kZXJlcnNEYXRhID0gdGhpcy5nZXRSZW5kZXJlckRhdGEoKTtcblx0XHR0aGlzLmxvY2FsUmVzb3VyY2VSb290c0NhY2hlID0gdGhpcy5fZ2V0UmVzb3VyY2VSb290c0NhY2hlKCk7XG5cdFx0Y29uc3QgbWl4ZWRSZXNvdXJjZVJvb3RzID0gW1xuXHRcdFx0Li4uKHRoaXMubG9jYWxSZXNvdXJjZVJvb3RzQ2FjaGUgfHwgW10pLFxuXHRcdFx0Li4uKHRoaXMuX2N1cnJlbnRLZXJuZWwgPyBbdGhpcy5fY3VycmVudEtlcm5lbC5sb2NhbFJlc291cmNlUm9vdF0gOiBbXSksXG5cdFx0XTtcblxuXHRcdHRoaXMud2Vidmlldy5sb2NhbFJlc291cmNlc1Jvb3QgPSBtaXhlZFJlc291cmNlUm9vdHM7XG5cdFx0dGhpcy5fc2VuZE1lc3NhZ2VUb1dlYnZpZXcoe1xuXHRcdFx0dHlwZTogJ3VwZGF0ZVJlbmRlcmVycycsXG5cdFx0XHRyZW5kZXJlckRhdGE6IHJlbmRlcmVyc0RhdGFcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZUtlcm5lbFByZWxvYWRzKGtlcm5lbDogSU5vdGVib29rS2VybmVsIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRoaXMuX2Rpc3Bvc2VkIHx8IGtlcm5lbCA9PT0gdGhpcy5fY3VycmVudEtlcm5lbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXZpb3VzS2VybmVsID0gdGhpcy5fY3VycmVudEtlcm5lbDtcblx0XHR0aGlzLl9jdXJyZW50S2VybmVsID0ga2VybmVsO1xuXG5cdFx0aWYgKHByZXZpb3VzS2VybmVsICYmIHByZXZpb3VzS2VybmVsLnByZWxvYWRVcmlzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMud2Vidmlldz8ucmVsb2FkKCk7IC8vIHByZWxvYWRzIHdpbGwgYmUgcmVzdG9yZWQgYWZ0ZXIgcmVsb2FkXG5cdFx0fSBlbHNlIGlmIChrZXJuZWwpIHtcblx0XHRcdHRoaXMuX3VwZGF0ZVByZWxvYWRzRnJvbUtlcm5lbChrZXJuZWwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVByZWxvYWRzRnJvbUtlcm5lbChrZXJuZWw6IElOb3RlYm9va0tlcm5lbCkge1xuXHRcdGNvbnN0IHJlc291cmNlczogSUNvbnRyb2xsZXJQcmVsb2FkW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHByZWxvYWQgb2Yga2VybmVsLnByZWxvYWRVcmlzKSB7XG5cdFx0XHRjb25zdCB1cmkgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS5pc0V4dGVuc2lvbkRldmVsb3BtZW50ICYmIChwcmVsb2FkLnNjaGVtZSA9PT0gJ2h0dHAnIHx8IHByZWxvYWQuc2NoZW1lID09PSAnaHR0cHMnKVxuXHRcdFx0XHQ/IHByZWxvYWQgOiB0aGlzLmFzV2Vidmlld1VyaShwcmVsb2FkLCB1bmRlZmluZWQpO1xuXG5cdFx0XHRpZiAoIXRoaXMuX3ByZWxvYWRzQ2FjaGUuaGFzKHVyaS50b1N0cmluZygpKSkge1xuXHRcdFx0XHRyZXNvdXJjZXMucHVzaCh7IHVyaTogdXJpLnRvU3RyaW5nKCksIG9yaWdpbmFsVXJpOiBwcmVsb2FkLnRvU3RyaW5nKCkgfSk7XG5cdFx0XHRcdHRoaXMuX3ByZWxvYWRzQ2FjaGUuYWRkKHVyaS50b1N0cmluZygpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXJlc291cmNlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl91cGRhdGVQcmVsb2FkcyhyZXNvdXJjZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlUHJlbG9hZHMocmVzb3VyY2VzOiBJQ29udHJvbGxlclByZWxvYWRbXSkge1xuXHRcdGlmICghdGhpcy53ZWJ2aWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWl4ZWRSZXNvdXJjZVJvb3RzID0gW1xuXHRcdFx0Li4uKHRoaXMubG9jYWxSZXNvdXJjZVJvb3RzQ2FjaGUgfHwgW10pLFxuXHRcdFx0Li4uKHRoaXMuX2N1cnJlbnRLZXJuZWwgPyBbdGhpcy5fY3VycmVudEtlcm5lbC5sb2NhbFJlc291cmNlUm9vdF0gOiBbXSksXG5cdFx0XTtcblxuXHRcdHRoaXMud2Vidmlldy5sb2NhbFJlc291cmNlc1Jvb3QgPSBtaXhlZFJlc291cmNlUm9vdHM7XG5cblx0XHR0aGlzLl9zZW5kTWVzc2FnZVRvV2Vidmlldyh7XG5cdFx0XHR0eXBlOiAncHJlbG9hZCcsXG5cdFx0XHRyZXNvdXJjZXM6IHJlc291cmNlcyxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3NlbmRNZXNzYWdlVG9XZWJ2aWV3KG1lc3NhZ2U6IFRvV2Vidmlld01lc3NhZ2UsIHRyYW5zZmVyPzogcmVhZG9ubHkgQXJyYXlCdWZmZXJbXSkge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMud2Vidmlldz8ucG9zdE1lc3NhZ2UobWVzc2FnZSwgdHJhbnNmZXIpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9kaXNwb3NlZCA9IHRydWU7XG5cdFx0dGhpcy53ZWJ2aWV3Py5kaXNwb3NlKCk7XG5cdFx0dGhpcy53ZWJ2aWV3ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMubm90ZWJvb2tFZGl0b3IgPSBudWxsITtcblx0XHR0aGlzLmluc2V0TWFwcGluZy5jbGVhcigpO1xuXHRcdHRoaXMucGVuZGluZ1dlYnZpZXdJZGxlQ3JlYXRpb25SZXF1ZXN0LmNsZWFyKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNvcHlCdWZmZXJJZk5lZWRlZChidWZmZXI6IFVpbnQ4QXJyYXksIHRyYW5zZmVyOiBBcnJheUJ1ZmZlcltdKTogVWludDhBcnJheSB7XG5cdGlmIChidWZmZXIuYnl0ZUxlbmd0aCA9PT0gYnVmZmVyLmJ1ZmZlci5ieXRlTGVuZ3RoKSB7XG5cdFx0Ly8gTm8gY29weSBuZWVkZWQgYnV0IHdlIGNhbid0IHRyYW5zZmVyIGVpdGhlclxuXHRcdHJldHVybiBidWZmZXI7XG5cdH0gZWxzZSB7XG5cdFx0Ly8gVGhlIGJ1ZmZlciBpcyBzbWFsbGVyIHRoYW4gaXRzIGJhY2tpbmcgYXJyYXkgYnVmZmVyLlxuXHRcdC8vIENyZWF0ZSBhIGNvcHkgdG8gYXZvaWQgc2VuZGluZyB0aGUgZW50aXJlIGFycmF5IGJ1ZmZlci5cblx0XHRjb25zdCB2YWx1ZUJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcblx0XHR0cmFuc2Zlci5wdXNoKHZhbHVlQnl0ZXMuYnVmZmVyKTtcblx0XHRyZXR1cm4gdmFsdWVCeXRlcztcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRUb2tlbml6YXRpb25Dc3MoKSB7XG5cdGNvbnN0IGNvbG9yTWFwID0gVG9rZW5pemF0aW9uUmVnaXN0cnkuZ2V0Q29sb3JNYXAoKTtcblx0Y29uc3QgdG9rZW5pemF0aW9uQ3NzID0gY29sb3JNYXAgPyBnZW5lcmF0ZVRva2Vuc0NTU0ZvckNvbG9yTWFwKGNvbG9yTWFwKSA6ICcnO1xuXHRyZXR1cm4gdG9rZW5pemF0aW9uQ3NzO1xufVxuXG5mdW5jdGlvbiB0cnlEZWNvZGVVUklDb21wb25lbnQodXJpOiBzdHJpbmcpIHtcblx0dHJ5IHtcblx0XHRyZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHVyaSk7XG5cdH0gY2F0Y2gge1xuXHRcdHJldHVybiB1cmk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxpQkFBaUI7QUFJMUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUIseUJBQXlCO0FBQ25ELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBc0I7QUFFL0IsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxZQUFZLFNBQVMsZUFBZSx5QkFBeUI7QUFDdEUsU0FBUyxjQUFjO0FBQ3ZCLFlBQVksWUFBWTtBQUN4QixTQUFTLGFBQWEsYUFBYTtBQUNuQyxTQUFTLFNBQVMsU0FBUyxTQUFTLGdCQUFnQjtBQUNwRCxTQUFTLFdBQVc7QUFDcEIsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsd0JBQXdCO0FBQ2pDLFlBQVksU0FBUztBQUNyQixTQUFTLGNBQWM7QUFDdkIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyxvQkFBb0I7QUFDN0IsU0FB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QXNDSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBeERVO0FBZ3pEYixTQUFTLG1CQUFtQixRQUFvQixVQUFxQztBQUNwRixNQUFJLE9BQU8sZUFBZSxPQUFPLE9BQU8sWUFBWTtBQUVuRCxXQUFPO0FBQUEsRUFDUixPQUFPO0FBR04sVUFBTSxhQUFhLElBQUksV0FBVyxNQUFNO0FBQ3hDLGFBQVMsS0FBSyxXQUFXLE1BQU07QUFDL0IsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQUVBLFNBQVMscUJBQXFCO0FBQzdCLFFBQU0sV0FBVyxxQkFBcUIsWUFBWTtBQUNsRCxRQUFNLGtCQUFrQixXQUFXLDZCQUE2QixRQUFRLElBQUk7QUFDNUUsU0FBTztBQUNSO0FBRUEsU0FBUyxzQkFBc0IsS0FBYTtBQUMzQyxNQUFJO0FBQ0gsV0FBTyxtQkFBbUIsR0FBRztBQUFBLEVBQzlCLFFBQVE7QUFDUCxXQUFPO0FBQUEsRUFDUjtBQUNEOyIsCiAgIm5hbWVzIjogWyJvdXRwdXQiLCAiY2VsbCIsICJlZGl0b3JPcHRpb25zIl0KfQo=
