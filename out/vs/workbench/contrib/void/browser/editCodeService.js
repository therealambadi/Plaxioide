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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { findDiffs } from "./helpers/findDiffs.js";
import { EndOfLinePreference } from "../../../../editor/common/model.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { IUndoRedoService, UndoRedoElementType } from "../../../../platform/undoRedo/common/undoRedo.js";
import { RenderOptions } from "../../../../editor/browser/widget/diffEditor/components/diffEditorViewZones/renderLines.js";
import * as dom from "../../../../base/browser/dom.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { IConsistentEditorItemService, IConsistentItemService } from "./helperServices/consistentItemService.js";
import { voidPrefixAndSuffix, ctrlKStream_userMessage, ctrlKStream_systemMessage, defaultQuickEditFimTags, rewriteCode_systemMessage, rewriteCode_userMessage, searchReplaceGivenDescription_systemMessage, searchReplaceGivenDescription_userMessage, tripleTick } from "../common/prompt/prompts.js";
import { IVoidCommandBarService } from "./voidCommandBarService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { VOID_ACCEPT_DIFF_ACTION_ID, VOID_REJECT_DIFF_ACTION_ID } from "./actionIDs.js";
import { mountCtrlK } from "./react/out/quick-edit-tsx/index.js";
import { extractCodeFromFIM, extractCodeFromRegular, extractSearchReplaceBlocks } from "../common/helpers/extractCodeFromResult.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Emitter } from "../../../../base/common/event.js";
import { ILLMMessageService } from "../common/sendLLMMessageService.js";
import { IMetricsService } from "../common/metricsService.js";
import { IEditCodeService } from "./editCodeServiceInterface.js";
import { IVoidSettingsService } from "../common/voidSettingsService.js";
import { IVoidModelService } from "../common/voidModelService.js";
import { deepClone } from "../../../../base/common/objects.js";
import { acceptBg, acceptBorder, buttonFontSize, buttonTextColor, rejectBg, rejectBorder } from "../common/helpers/colors.js";
import { diffAreaSnapshotKeys } from "../common/editCodeServiceTypes.js";
import { IConvertToLLMMessageService } from "./convertToLLMMessageService.js";
const numLinesOfStr = (str) => str.split("\n").length;
const getLengthOfTextPx = ({ tabWidth, spaceWidth, content }) => {
  let lengthOfTextPx = 0;
  for (const char of content) {
    if (char === "	") {
      lengthOfTextPx += tabWidth;
    } else {
      lengthOfTextPx += spaceWidth;
    }
  }
  return lengthOfTextPx;
};
const getLeadingWhitespacePx = (editor, startLine) => {
  const model = editor.getModel();
  if (!model) {
    return 0;
  }
  const lineContent = model.getLineContent(startLine) || "";
  const firstNonWhitespaceIndex = lineContent.search(/\S/);
  const leadingWhitespace = firstNonWhitespaceIndex === -1 ? lineContent : lineContent.slice(0, firstNonWhitespaceIndex);
  const { tabSize: numSpacesInTab } = model.getFormattingOptions();
  const spaceWidth = editor.getOption(EditorOption.fontInfo).spaceWidth;
  const tabWidth = numSpacesInTab * spaceWidth;
  const leftWhitespacePx = getLengthOfTextPx({
    tabWidth,
    spaceWidth,
    content: leadingWhitespace
  });
  return leftWhitespacePx;
};
const removeWhitespaceExceptNewlines = (str) => {
  return str.replace(/[^\S\n]+/g, "");
};
const findTextInCode = (text, fileContents, canFallbackToRemoveWhitespace, opts) => {
  const returnAns = (fileContents2, idx2) => {
    const startLine = numLinesOfStr(fileContents2.substring(0, idx2 + 1));
    const numLines = numLinesOfStr(text);
    const endLine = startLine + numLines - 1;
    return [startLine, endLine];
  };
  const startingAtLineIdx = (fileContents2) => opts?.startingAtLine !== void 0 ? fileContents2.split("\n").slice(0, opts.startingAtLine).join("\n").length : 0;
  let idx = fileContents.indexOf(text, startingAtLineIdx(fileContents));
  if (idx !== -1) {
    return returnAns(fileContents, idx);
  }
  if (!canFallbackToRemoveWhitespace)
    return "Not found";
  text = removeWhitespaceExceptNewlines(text);
  fileContents = removeWhitespaceExceptNewlines(fileContents);
  idx = fileContents.indexOf(text, startingAtLineIdx(fileContents));
  if (idx === -1) return "Not found";
  const lastIdx = fileContents.lastIndexOf(text);
  if (lastIdx !== idx) return "Not unique";
  return returnAns(fileContents, idx);
};
let EditCodeService = class extends Disposable {
  constructor(_codeEditorService, _modelService, _undoRedoService, _llmMessageService, _consistentItemService, _instantiationService, _consistentEditorItemService, _metricsService, _notificationService, _settingsService, _voidModelService, _convertToLLMMessageService) {
    super();
    this._codeEditorService = _codeEditorService;
    this._modelService = _modelService;
    this._undoRedoService = _undoRedoService;
    this._llmMessageService = _llmMessageService;
    this._consistentItemService = _consistentItemService;
    this._instantiationService = _instantiationService;
    this._consistentEditorItemService = _consistentEditorItemService;
    this._metricsService = _metricsService;
    this._notificationService = _notificationService;
    this._settingsService = _settingsService;
    this._voidModelService = _voidModelService;
    this._convertToLLMMessageService = _convertToLLMMessageService;
    // URI <--> model
    this.diffAreasOfURI = {};
    // uri -> diffareaId
    this.diffAreaOfId = {};
    // diffareaId -> diffArea
    this.diffOfId = {};
    // diffid -> diff (redundant with diffArea._diffOfId)
    // events
    // uri: diffZones  // listen on change diffZones
    this._onDidAddOrDeleteDiffZones = new Emitter();
    this.onDidAddOrDeleteDiffZones = this._onDidAddOrDeleteDiffZones.event;
    // diffZone: [uri], diffs, isStreaming  // listen on change diffs, change streaming (uri is const)
    this._onDidChangeDiffsInDiffZoneNotStreaming = new Emitter();
    this._onDidChangeStreamingInDiffZone = new Emitter();
    this.onDidChangeDiffsInDiffZoneNotStreaming = this._onDidChangeDiffsInDiffZoneNotStreaming.event;
    this.onDidChangeStreamingInDiffZone = this._onDidChangeStreamingInDiffZone.event;
    // ctrlKZone: [uri], isStreaming  // listen on change streaming
    this._onDidChangeStreamingInCtrlKZone = new Emitter();
    this.onDidChangeStreamingInCtrlKZone = this._onDidChangeStreamingInCtrlKZone.event;
    // private _notifyError = (e: Parameters<OnError>[0]) => {
    // 	const details = errorDetails(e.fullError)
    // 	this._notificationService.notify({
    // 		severity: Severity.Warning,
    // 		message: `Void Error: ${e.message}`,
    // 		actions: {
    // 			secondary: [{
    // 				id: 'void.onerror.opensettings',
    // 				enabled: true,
    // 				label: `Open Void's settings`,
    // 				tooltip: '',
    // 				class: undefined,
    // 				run: () => { this._commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID) }
    // 			}]
    // 		},
    // 		source: details ? `(Hold ${isMacintosh ? 'Option' : 'Alt'} to hover) - ${details}\n\nIf this persists, feel free to [report](https://github.com/voideditor/void/issues/new) it.` : undefined
    // 	})
    // }
    // highlight the region
    this._addLineDecoration = (model, startLine, endLine, className, options) => {
      if (model === null) return;
      const id = model.changeDecorations((accessor) => accessor.addDecoration(
        { startLineNumber: startLine, startColumn: 1, endLineNumber: endLine, endColumn: Number.MAX_SAFE_INTEGER },
        {
          className,
          description: className,
          isWholeLine: true,
          ...options
        }
      ));
      const disposeHighlight = () => {
        if (id && !model.isDisposed()) model.changeDecorations((accessor) => accessor.removeDecoration(id));
      };
      return disposeHighlight;
    };
    this._addDiffAreaStylesToURI = (uri) => {
      const { model } = this._voidModelService.getModel(uri);
      for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
        const diffArea = this.diffAreaOfId[diffareaid];
        if (diffArea.type === "DiffZone") {
          if (diffArea._streamState.isStreaming) {
            const fn1 = this._addLineDecoration(model, diffArea._streamState.line, diffArea._streamState.line, "void-sweepIdxBG");
            const fn2 = diffArea._streamState.line + 1 <= diffArea.endLine ? this._addLineDecoration(model, diffArea._streamState.line + 1, diffArea.endLine, "void-sweepBG") : null;
            diffArea._removeStylesFns.add(() => {
              fn1?.();
              fn2?.();
            });
          }
        } else if (diffArea.type === "CtrlKZone" && diffArea._linkedStreamingDiffZone === null) {
          const fn = this._addLineDecoration(model, diffArea.startLine, diffArea.endLine, "void-highlightBG");
          diffArea._removeStylesFns.add(() => fn?.());
        }
      }
    };
    this._computeDiffsAndAddStylesToURI = (uri) => {
      const { model } = this._voidModelService.getModel(uri);
      if (model === null) return;
      const fullFileText = model.getValue(EndOfLinePreference.LF);
      for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
        const diffArea = this.diffAreaOfId[diffareaid];
        if (diffArea.type !== "DiffZone") continue;
        const newDiffAreaCode = fullFileText.split("\n").slice(diffArea.startLine - 1, diffArea.endLine - 1 + 1).join("\n");
        const computedDiffs = findDiffs(diffArea.originalCode, newDiffAreaCode);
        for (let computedDiff of computedDiffs) {
          if (computedDiff.type === "deletion") {
            computedDiff.startLine += diffArea.startLine - 1;
          }
          if (computedDiff.type === "edit" || computedDiff.type === "insertion") {
            computedDiff.startLine += diffArea.startLine - 1;
            computedDiff.endLine += diffArea.startLine - 1;
          }
          this._addDiff(computedDiff, diffArea);
        }
      }
    };
    this.mostRecentTextOfCtrlKZoneId = {};
    this._addCtrlKZoneInput = (ctrlKZone) => {
      const { editorId } = ctrlKZone;
      const editor = this._codeEditorService.listCodeEditors().find((e) => e.getId() === editorId);
      if (!editor) {
        return null;
      }
      let zoneId = null;
      let viewZone_ = null;
      const textAreaRef = { current: null };
      const paddingLeft = getLeadingWhitespacePx(editor, ctrlKZone.startLine);
      const itemId = this._consistentEditorItemService.addToEditor(editor, () => {
        const domNode = document.createElement("div");
        domNode.style.zIndex = "1";
        domNode.style.height = "auto";
        domNode.style.paddingLeft = `${paddingLeft}px`;
        const viewZone = {
          afterLineNumber: ctrlKZone.startLine - 1,
          domNode,
          // heightInPx: 80,
          suppressMouseDown: false,
          showInHiddenAreas: true
        };
        viewZone_ = viewZone;
        editor.changeViewZones((accessor) => {
          zoneId = accessor.addZone(viewZone);
        });
        let disposeFn = void 0;
        this._instantiationService.invokeFunction((accessor) => {
          disposeFn = mountCtrlK(domNode, accessor, {
            diffareaid: ctrlKZone.diffareaid,
            textAreaRef: (r) => {
              textAreaRef.current = r;
              if (!textAreaRef.current) return;
              if (!(ctrlKZone.diffareaid in this.mostRecentTextOfCtrlKZoneId)) {
                this.mostRecentTextOfCtrlKZoneId[ctrlKZone.diffareaid] = void 0;
                setTimeout(() => textAreaRef.current?.focus(), 100);
              }
            },
            onChangeHeight(height) {
              if (height === 0) return;
              viewZone.heightInPx = height;
              editor.changeViewZones((accessor2) => {
                if (zoneId) accessor2.layoutZone(zoneId);
              });
            },
            onChangeText: (text) => {
              this.mostRecentTextOfCtrlKZoneId[ctrlKZone.diffareaid] = text;
            },
            initText: this.mostRecentTextOfCtrlKZoneId[ctrlKZone.diffareaid] ?? null
          })?.dispose;
        });
        return () => {
          editor.changeViewZones((accessor) => {
            if (zoneId) accessor.removeZone(zoneId);
          });
          disposeFn?.();
        };
      });
      return {
        textAreaRef,
        refresh: () => editor.changeViewZones((accessor) => {
          if (zoneId && viewZone_) {
            viewZone_.afterLineNumber = ctrlKZone.startLine - 1;
            accessor.layoutZone(zoneId);
          }
        }),
        dispose: () => {
          this._consistentEditorItemService.removeFromEditor(itemId);
        }
      };
    };
    this._refreshCtrlKInputs = async (uri) => {
      for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
        const diffArea = this.diffAreaOfId[diffareaid];
        if (diffArea.type !== "CtrlKZone") continue;
        if (!diffArea._mountInfo) {
          diffArea._mountInfo = this._addCtrlKZoneInput(diffArea);
          console.log("MOUNTED CTRLK", diffArea.diffareaid);
        } else {
          diffArea._mountInfo.refresh();
        }
      }
    };
    this._addDiffStylesToURI = (uri, diff) => {
      const { type, diffid } = diff;
      const disposeInThisEditorFns = [];
      const { model } = this._voidModelService.getModel(uri);
      if (type !== "deletion") {
        const fn = this._addLineDecoration(model, diff.startLine, diff.endLine, "void-greenBG", {
          minimap: { color: { id: "minimapGutter.addedBackground" }, position: 2 },
          overviewRuler: { color: { id: "editorOverviewRuler.addedForeground" }, position: 7 }
        });
        disposeInThisEditorFns.push(() => {
          fn?.();
        });
      }
      if (type !== "insertion") {
        const consistentZoneId = this._consistentItemService.addConsistentItemToURI({
          uri,
          fn: (editor) => {
            const domNode = document.createElement("div");
            domNode.className = "void-redBG";
            const renderOptions = RenderOptions.fromEditor(editor);
            const processedText = diff.originalCode.replace(/\t/g, " ".repeat(renderOptions.tabSize));
            const lines = processedText.split("\n");
            const linesContainer = document.createElement("div");
            linesContainer.style.fontFamily = renderOptions.fontInfo.fontFamily;
            linesContainer.style.fontSize = `${renderOptions.fontInfo.fontSize}px`;
            linesContainer.style.lineHeight = `${renderOptions.fontInfo.lineHeight}px`;
            linesContainer.style.whiteSpace = "pre";
            linesContainer.style.position = "relative";
            linesContainer.style.width = "100%";
            lines.forEach((line) => {
              const lineDiv = document.createElement("div");
              lineDiv.className = "view-line";
              lineDiv.style.whiteSpace = "pre";
              lineDiv.style.position = "relative";
              lineDiv.style.height = `${renderOptions.fontInfo.lineHeight}px`;
              const span = document.createElement("span");
              span.textContent = line || "\xA0";
              span.style.whiteSpace = "pre";
              span.style.display = "inline-block";
              lineDiv.appendChild(span);
              linesContainer.appendChild(lineDiv);
            });
            domNode.appendChild(linesContainer);
            const heightInLines = lines.length;
            const minWidthInPx = Math.max(...lines.map(
              (line) => Math.ceil(renderOptions.fontInfo.typicalFullwidthCharacterWidth * line.length)
            ));
            const viewZone = {
              afterLineNumber: diff.startLine - 1,
              heightInLines,
              minWidthInPx,
              domNode,
              marginDomNode: document.createElement("div"),
              suppressMouseDown: false,
              showInHiddenAreas: false
            };
            let zoneId = null;
            editor.changeViewZones((accessor) => {
              zoneId = accessor.addZone(viewZone);
            });
            return () => editor.changeViewZones((accessor) => {
              if (zoneId) accessor.removeZone(zoneId);
            });
          }
        });
        disposeInThisEditorFns.push(() => {
          this._consistentItemService.removeConsistentItemFromURI(consistentZoneId);
        });
      }
      const diffZone = this.diffAreaOfId[diff.diffareaid];
      if (diffZone.type === "DiffZone" && !diffZone._streamState.isStreaming) {
        const consistentWidgetId = this._consistentItemService.addConsistentItemToURI({
          uri,
          fn: (editor) => {
            let startLine;
            let offsetLines;
            if (diff.type === "insertion" || diff.type === "edit") {
              startLine = diff.startLine;
              offsetLines = 0;
            } else if (diff.type === "deletion") {
              if (diff.startLine === 1) {
                const numRedLines = diff.originalEndLine - diff.originalStartLine + 1;
                startLine = diff.startLine;
                offsetLines = -numRedLines;
              } else {
                startLine = diff.startLine - 1;
                offsetLines = 1;
              }
            } else {
              throw new Error("Void 1");
            }
            const buttonsWidget = this._instantiationService.createInstance(AcceptRejectInlineWidget, {
              editor,
              onAccept: () => {
                this.acceptDiff({ diffid });
                this._metricsService.capture("Accept Diff", { diffid });
              },
              onReject: () => {
                this.rejectDiff({ diffid });
                this._metricsService.capture("Reject Diff", { diffid });
              },
              diffid: diffid.toString(),
              startLine,
              offsetLines
            });
            return () => {
              buttonsWidget.dispose();
            };
          }
        });
        disposeInThisEditorFns.push(() => {
          this._consistentItemService.removeConsistentItemFromURI(consistentWidgetId);
        });
      }
      const disposeInEditor = () => {
        disposeInThisEditorFns.forEach((f) => f());
      };
      return disposeInEditor;
    };
    this.weAreWriting = false;
    this._getCurrentVoidFileSnapshot = (uri) => {
      const { model } = this._voidModelService.getModel(uri);
      const snapshottedDiffAreaOfId = {};
      for (const diffareaid in this.diffAreaOfId) {
        const diffArea = this.diffAreaOfId[diffareaid];
        if (diffArea._URI.fsPath !== uri.fsPath) continue;
        snapshottedDiffAreaOfId[diffareaid] = deepClone(
          Object.fromEntries(diffAreaSnapshotKeys.map((key) => [key, diffArea[key]]))
        );
      }
      const entireFileCode = model ? model.getValue(EndOfLinePreference.LF) : "";
      return {
        snapshottedDiffAreaOfId,
        entireFileCode
        // the whole file's code
      };
    };
    this._restoreVoidFileSnapshot = async (uri, snapshot) => {
      for (const diffareaid in this.diffAreaOfId) {
        const diffArea = this.diffAreaOfId[diffareaid];
        if (diffArea.type === "DiffZone")
          this._stopIfStreaming(diffArea);
      }
      this._deleteAllDiffAreas(uri);
      const { snapshottedDiffAreaOfId, entireFileCode: entireModelCode } = deepClone(snapshot);
      for (const diffareaid in snapshottedDiffAreaOfId) {
        const snapshottedDiffArea = snapshottedDiffAreaOfId[diffareaid];
        if (snapshottedDiffArea.type === "DiffZone") {
          this.diffAreaOfId[diffareaid] = {
            ...snapshottedDiffArea,
            type: "DiffZone",
            _diffOfId: {},
            _URI: uri,
            _streamState: { isStreaming: false },
            // when restoring, we will never be streaming
            _removeStylesFns: /* @__PURE__ */ new Set()
          };
        } else if (snapshottedDiffArea.type === "CtrlKZone") {
          this.diffAreaOfId[diffareaid] = {
            ...snapshottedDiffArea,
            _URI: uri,
            _removeStylesFns: /* @__PURE__ */ new Set(),
            _mountInfo: null,
            _linkedStreamingDiffZone: null
            // when restoring, we will never be streaming
          };
        }
        this._addOrInitializeDiffAreaAtURI(uri, diffareaid);
      }
      this._onDidAddOrDeleteDiffZones.fire({ uri });
      this._writeURIText(
        uri,
        entireModelCode,
        "wholeFileRange",
        { shouldRealignDiffAreas: false }
      );
    };
    this._addOrInitializeDiffAreaAtURI = (uri, diffareaid) => {
      if (!(uri.fsPath in this.diffAreasOfURI)) this.diffAreasOfURI[uri.fsPath] = /* @__PURE__ */ new Set();
      this.diffAreasOfURI[uri.fsPath]?.add(diffareaid.toString());
    };
    this._diffareaidPool = 0;
    this._diffidPool = 0;
    /**
     * Generates a human-readable error message for an invalid ORIGINAL search block.
     */
    this._errContentOfInvalidStr = (str, blockOrig) => {
      const problematicCode = `${tripleTick[0]}
${JSON.stringify(blockOrig)}
${tripleTick[1]}`;
      let descStr;
      switch (str) {
        case "Not found":
          descStr = `The edit was not applied. The text in ORIGINAL must EXACTLY match lines of code in the file, but there was no match for:
${problematicCode}. Ensure you have the latest version of the file, and ensure the ORIGINAL code matches a code excerpt exactly.`;
          break;
        case "Not unique":
          descStr = `The edit was not applied. The text in ORIGINAL must be unique in the file being edited, but the following ORIGINAL code appears multiple times in the file:
${problematicCode}. Ensure you have the latest version of the file, and ensure the ORIGINAL code is unique.`;
          break;
        case "Has overlap":
          descStr = `The edit was not applied. The text in the ORIGINAL blocks must not overlap, but the following ORIGINAL code had overlap with another ORIGINAL string:
${problematicCode}. Ensure you have the latest version of the file, and ensure the ORIGINAL code blocks do not overlap.`;
          break;
        default:
          descStr = "";
      }
      return descStr;
    };
    // remove a batch of diffareas all at once (and handle accept/reject of their diffs)
    this.acceptOrRejectAllDiffAreas = async ({ uri, behavior, removeCtrlKs, _addToHistory }) => {
      const diffareaids = this.diffAreasOfURI[uri.fsPath];
      if ((diffareaids?.size ?? 0) === 0) return;
      const { onFinishEdit } = _addToHistory === false ? { onFinishEdit: () => {
      } } : this._addToHistory(uri);
      for (const diffareaid of diffareaids ?? []) {
        const diffArea = this.diffAreaOfId[diffareaid];
        if (!diffArea) continue;
        if (diffArea.type === "DiffZone") {
          if (behavior === "reject") {
            this._revertDiffZone(diffArea);
            this._deleteDiffZone(diffArea);
          } else if (behavior === "accept") this._deleteDiffZone(diffArea);
        } else if (diffArea.type === "CtrlKZone" && removeCtrlKs) {
          this._deleteCtrlKZone(diffArea);
        }
      }
      this._refreshStylesAndDiffsInURI(uri);
      onFinishEdit();
    };
    const registeredModelURIs = /* @__PURE__ */ new Set();
    const initializeModel = async (model) => {
      await this._voidModelService.initializeModel(model.uri);
      if (registeredModelURIs.has(model.uri.fsPath)) return;
      registeredModelURIs.add(model.uri.fsPath);
      if (!(model.uri.fsPath in this.diffAreasOfURI)) {
        this.diffAreasOfURI[model.uri.fsPath] = /* @__PURE__ */ new Set();
      }
      this._register(
        model.onDidChangeContent((e) => {
          if (this.weAreWriting) return;
          const uri = model.uri;
          this._onUserChangeContent(uri, e);
        })
      );
      this._refreshStylesAndDiffsInURI(model.uri);
    };
    for (let model of this._modelService.getModels()) {
      initializeModel(model);
    }
    this._register(this._modelService.onModelAdded((model) => {
      initializeModel(model);
    }));
    let initializeEditor = (editor) => {
      const uri = editor.getModel()?.uri ?? null;
      if (uri) this._refreshStylesAndDiffsInURI(uri);
    };
    for (let editor of this._codeEditorService.listCodeEditors()) {
      initializeEditor(editor);
    }
    this._register(this._codeEditorService.onCodeEditorAdd((editor) => {
      initializeEditor(editor);
    }));
  }
  _onUserChangeContent(uri, e) {
    for (const change of e.changes) {
      this._realignAllDiffAreasLines(uri, change.text, change.range);
    }
    this._refreshStylesAndDiffsInURI(uri);
    const diffAreasToDelete = [];
    for (const diffareaid of this.diffAreasOfURI[uri.fsPath] ?? []) {
      const diffArea = this.diffAreaOfId[diffareaid] ?? null;
      const shouldDelete = diffArea?.type === "DiffZone" && Object.keys(diffArea._diffOfId).length === 0;
      if (shouldDelete) {
        diffAreasToDelete.push(diffArea);
      }
    }
    if (diffAreasToDelete.length !== 0) {
      const { onFinishEdit } = this._addToHistory(uri);
      diffAreasToDelete.forEach((da) => this._deleteDiffZone(da));
      onFinishEdit();
    }
  }
  processRawKeybindingText(keybindingStr) {
    return keybindingStr.replace(/Enter/g, "\u21B5").replace(/Backspace/g, "\u232B");
  }
  _getActiveEditorURI() {
    const editor = this._codeEditorService.getActiveCodeEditor();
    if (!editor) return null;
    const uri = editor.getModel()?.uri;
    if (!uri) return null;
    return uri;
  }
  _writeURIText(uri, text, range_, { shouldRealignDiffAreas }) {
    const { model } = this._voidModelService.getModel(uri);
    if (!model) {
      this._refreshStylesAndDiffsInURI(uri);
      return;
    }
    const range = range_ === "wholeFileRange" ? { startLineNumber: 1, startColumn: 1, endLineNumber: model.getLineCount(), endColumn: Number.MAX_SAFE_INTEGER } : range_;
    if (shouldRealignDiffAreas) {
      const newText = text;
      const oldRange = range;
      this._realignAllDiffAreasLines(uri, newText, oldRange);
    }
    const uriStr = model.getValue(EndOfLinePreference.LF);
    const dontNeedToWrite = uriStr === text;
    if (dontNeedToWrite) {
      this._refreshStylesAndDiffsInURI(uri);
      return;
    }
    this.weAreWriting = true;
    model.applyEdits([{ range, text }]);
    this.weAreWriting = false;
    this._refreshStylesAndDiffsInURI(uri);
  }
  _addToHistory(uri, opts) {
    const beforeSnapshot = this._getCurrentVoidFileSnapshot(uri);
    let afterSnapshot = null;
    const elt = {
      type: UndoRedoElementType.Resource,
      resource: uri,
      label: "Plaxio Agent",
      code: "undoredo.editCode",
      undo: async () => {
        opts?.onWillUndo?.();
        await this._restoreVoidFileSnapshot(uri, beforeSnapshot);
      },
      redo: async () => {
        if (afterSnapshot) await this._restoreVoidFileSnapshot(uri, afterSnapshot);
      }
    };
    this._undoRedoService.pushElement(elt);
    const onFinishEdit = async () => {
      afterSnapshot = this._getCurrentVoidFileSnapshot(uri);
      await this._voidModelService.saveModel(uri);
    };
    return { onFinishEdit };
  }
  getVoidFileSnapshot(uri) {
    return this._getCurrentVoidFileSnapshot(uri);
  }
  restoreVoidFileSnapshot(uri, snapshot) {
    this._restoreVoidFileSnapshot(uri, snapshot);
  }
  // delete diffOfId and diffArea._diffOfId
  _deleteDiff(diff) {
    const diffArea = this.diffAreaOfId[diff.diffareaid];
    if (diffArea.type !== "DiffZone") return;
    delete diffArea._diffOfId[diff.diffid];
    delete this.diffOfId[diff.diffid];
  }
  _deleteDiffs(diffZone) {
    for (const diffid in diffZone._diffOfId) {
      const diff = diffZone._diffOfId[diffid];
      this._deleteDiff(diff);
    }
  }
  _clearAllDiffAreaEffects(diffArea) {
    if (diffArea.type === "DiffZone")
      this._deleteDiffs(diffArea);
    diffArea._removeStylesFns?.forEach((removeStyles) => removeStyles());
    diffArea._removeStylesFns?.clear();
  }
  // clears all Diffs (and their styles) and all styles of DiffAreas, etc
  _clearAllEffects(uri) {
    for (let diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
      const diffArea = this.diffAreaOfId[diffareaid];
      this._clearAllDiffAreaEffects(diffArea);
    }
  }
  // delete all diffs, update diffAreaOfId, update diffAreasOfModelId
  _deleteDiffZone(diffZone) {
    this._clearAllDiffAreaEffects(diffZone);
    delete this.diffAreaOfId[diffZone.diffareaid];
    this.diffAreasOfURI[diffZone._URI.fsPath]?.delete(diffZone.diffareaid.toString());
    this._onDidAddOrDeleteDiffZones.fire({ uri: diffZone._URI });
  }
  _deleteTrackingZone(trackingZone) {
    delete this.diffAreaOfId[trackingZone.diffareaid];
    this.diffAreasOfURI[trackingZone._URI.fsPath]?.delete(trackingZone.diffareaid.toString());
  }
  _deleteCtrlKZone(ctrlKZone) {
    this._clearAllEffects(ctrlKZone._URI);
    ctrlKZone._mountInfo?.dispose();
    delete this.diffAreaOfId[ctrlKZone.diffareaid];
    this.diffAreasOfURI[ctrlKZone._URI.fsPath]?.delete(ctrlKZone.diffareaid.toString());
  }
  _deleteAllDiffAreas(uri) {
    const diffAreas = this.diffAreasOfURI[uri.fsPath];
    diffAreas?.forEach((diffareaid) => {
      const diffArea = this.diffAreaOfId[diffareaid];
      if (diffArea.type === "DiffZone")
        this._deleteDiffZone(diffArea);
      else if (diffArea.type === "CtrlKZone")
        this._deleteCtrlKZone(diffArea);
    });
    this.diffAreasOfURI[uri.fsPath]?.clear();
  }
  // each diffarea has an id
  _addDiffArea(diffArea) {
    const diffareaid = this._diffareaidPool++;
    const diffArea2 = { ...diffArea, diffareaid };
    this._addOrInitializeDiffAreaAtURI(diffArea._URI, diffareaid);
    this.diffAreaOfId[diffareaid] = diffArea2;
    return diffArea2;
  }
  // each diff has an id
  _addDiff(computedDiff, diffZone) {
    const uri = diffZone._URI;
    const diffid = this._diffidPool++;
    const newDiff = {
      ...computedDiff,
      diffid,
      diffareaid: diffZone.diffareaid
    };
    const fn = this._addDiffStylesToURI(uri, newDiff);
    if (fn) diffZone._removeStylesFns.add(fn);
    this.diffOfId[diffid] = newDiff;
    diffZone._diffOfId[diffid] = newDiff;
    return newDiff;
  }
  // changes the start/line locations of all DiffAreas on the page (adjust their start/end based on the change) based on the change that was recently made
  _realignAllDiffAreasLines(uri, text, recentChange) {
    const startLine = recentChange.startLineNumber;
    const endLine = recentChange.endLineNumber;
    const newTextHeight = (text.match(/\n/g) || []).length + 1;
    for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
      const diffArea = this.diffAreaOfId[diffareaid];
      if (diffArea.endLine < startLine) {
        continue;
      } else if (endLine < diffArea.startLine) {
        const changedRangeHeight = endLine - startLine + 1;
        const deltaNewlines = newTextHeight - changedRangeHeight;
        diffArea.startLine += deltaNewlines;
        diffArea.endLine += deltaNewlines;
      } else if (startLine >= diffArea.startLine && endLine <= diffArea.endLine) {
        const changedRangeHeight = endLine - startLine + 1;
        const deltaNewlines = newTextHeight - changedRangeHeight;
        diffArea.endLine += deltaNewlines;
      } else if (diffArea.startLine > startLine && diffArea.endLine < endLine) {
        diffArea.startLine = startLine;
        diffArea.endLine = startLine + newTextHeight;
      } else if (startLine < diffArea.startLine && diffArea.startLine <= endLine) {
        const numOverlappingLines = endLine - diffArea.startLine + 1;
        const numRemainingLinesInDA = diffArea.endLine - diffArea.startLine + 1 - numOverlappingLines;
        const newHeight = numRemainingLinesInDA - 1 + (newTextHeight - 1) + 1;
        diffArea.startLine = startLine;
        diffArea.endLine = startLine + newHeight;
      } else if (startLine <= diffArea.endLine && diffArea.endLine < endLine) {
        const numOverlappingLines = diffArea.endLine - startLine + 1;
        diffArea.endLine += newTextHeight - numOverlappingLines;
      }
    }
  }
  _fireChangeDiffsIfNotStreaming(uri) {
    for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
      const diffArea = this.diffAreaOfId[diffareaid];
      if (diffArea?.type !== "DiffZone") continue;
      if (!diffArea._streamState.isStreaming) {
        this._onDidChangeDiffsInDiffZoneNotStreaming.fire({ uri, diffareaid: diffArea.diffareaid });
      }
    }
  }
  _refreshStylesAndDiffsInURI(uri) {
    this._clearAllEffects(uri);
    this._addDiffAreaStylesToURI(uri);
    this._computeDiffsAndAddStylesToURI(uri);
    this._refreshCtrlKInputs(uri);
    this._fireChangeDiffsIfNotStreaming(uri);
  }
  // @throttle(100)
  _writeStreamedDiffZoneLLMText(uri, originalCode, llmTextSoFar, deltaText, latestMutable) {
    let numNewLines = 0;
    const computedDiffs = findDiffs(originalCode, llmTextSoFar);
    let endLineInLlmTextSoFar;
    let startLineInOriginalCode;
    const lastDiff = computedDiffs.pop();
    if (!lastDiff) {
      startLineInOriginalCode = 1;
      endLineInLlmTextSoFar = 1;
    } else {
      startLineInOriginalCode = lastDiff.originalStartLine;
      if (lastDiff.type === "insertion" || lastDiff.type === "edit")
        endLineInLlmTextSoFar = lastDiff.endLine;
      else if (lastDiff.type === "deletion")
        endLineInLlmTextSoFar = lastDiff.startLine;
      else
        throw new Error(`Plaxio: diff.type not recognized on: ${lastDiff}`);
    }
    if (!latestMutable.addedSplitYet) {
      this._writeURIText(
        uri,
        "\n",
        { startLineNumber: latestMutable.line, startColumn: latestMutable.col, endLineNumber: latestMutable.line, endColumn: latestMutable.col },
        { shouldRealignDiffAreas: true }
      );
      latestMutable.addedSplitYet = true;
      numNewLines += 1;
    }
    this._writeURIText(
      uri,
      deltaText,
      { startLineNumber: latestMutable.line, startColumn: latestMutable.col, endLineNumber: latestMutable.line, endColumn: latestMutable.col },
      { shouldRealignDiffAreas: true }
    );
    const deltaNumNewLines = deltaText.split("\n").length - 1;
    latestMutable.line += deltaNumNewLines;
    const lastNewlineIdx = deltaText.lastIndexOf("\n");
    latestMutable.col = lastNewlineIdx === -1 ? latestMutable.col + deltaText.length : deltaText.length - lastNewlineIdx;
    numNewLines += deltaNumNewLines;
    if (latestMutable.originalCodeStartLine < startLineInOriginalCode) {
      const numLinesDeleted = startLineInOriginalCode - latestMutable.originalCodeStartLine;
      this._writeURIText(
        uri,
        "",
        { startLineNumber: latestMutable.line, startColumn: latestMutable.col, endLineNumber: latestMutable.line + numLinesDeleted, endColumn: Number.MAX_SAFE_INTEGER },
        { shouldRealignDiffAreas: true }
      );
      numNewLines -= numLinesDeleted;
    } else if (latestMutable.originalCodeStartLine > startLineInOriginalCode) {
      const newText = "\n" + originalCode.split("\n").slice(startLineInOriginalCode - 1, latestMutable.originalCodeStartLine - 1 - 1 + 1).join("\n");
      this._writeURIText(
        uri,
        newText,
        { startLineNumber: latestMutable.line, startColumn: latestMutable.col, endLineNumber: latestMutable.line, endColumn: latestMutable.col },
        { shouldRealignDiffAreas: true }
      );
      numNewLines += newText.split("\n").length - 1;
    }
    latestMutable.originalCodeStartLine = startLineInOriginalCode;
    return { endLineInLlmTextSoFar, numNewLines };
  }
  // called first, then call startApplying
  addCtrlKZone({ startLine, endLine, editor }) {
    const uri = editor.getModel()?.uri;
    if (!uri) return;
    const overlappingCtrlKZone = this._findOverlappingDiffArea({ startLine, endLine, uri, filter: (diffArea) => diffArea.type === "CtrlKZone" });
    if (overlappingCtrlKZone) {
      editor.revealLine(overlappingCtrlKZone.startLine);
      setTimeout(() => overlappingCtrlKZone._mountInfo?.textAreaRef.current?.focus(), 100);
      return;
    }
    const overlappingDiffZone = this._findOverlappingDiffArea({ startLine, endLine, uri, filter: (diffArea) => diffArea.type === "DiffZone" });
    if (overlappingDiffZone)
      return;
    editor.revealLine(startLine);
    editor.setSelection({ startLineNumber: startLine, endLineNumber: startLine, startColumn: 1, endColumn: 1 });
    const { onFinishEdit } = this._addToHistory(uri);
    const adding = {
      type: "CtrlKZone",
      startLine,
      endLine,
      editorId: editor.getId(),
      _URI: uri,
      _removeStylesFns: /* @__PURE__ */ new Set(),
      _mountInfo: null,
      _linkedStreamingDiffZone: null
    };
    const ctrlKZone = this._addDiffArea(adding);
    this._refreshStylesAndDiffsInURI(uri);
    onFinishEdit();
    return ctrlKZone.diffareaid;
  }
  // _remove means delete and also add to history
  removeCtrlKZone({ diffareaid }) {
    const ctrlKZone = this.diffAreaOfId[diffareaid];
    if (!ctrlKZone) return;
    if (ctrlKZone.type !== "CtrlKZone") return;
    const uri = ctrlKZone._URI;
    const { onFinishEdit } = this._addToHistory(uri);
    this._deleteCtrlKZone(ctrlKZone);
    this._refreshStylesAndDiffsInURI(uri);
    onFinishEdit();
  }
  _getURIBeforeStartApplying(opts) {
    if (opts.from === "ClickApply") {
      const uri = this._uriOfGivenURI(opts.uri);
      if (!uri) return;
      return uri;
    } else if (opts.from === "QuickEdit") {
      const { diffareaid } = opts;
      const ctrlKZone = this.diffAreaOfId[diffareaid];
      if (ctrlKZone?.type !== "CtrlKZone") return;
      const { _URI: uri } = ctrlKZone;
      return uri;
    }
    return;
  }
  async callBeforeApplyOrEdit(givenURI) {
    const uri = this._uriOfGivenURI(givenURI);
    if (!uri) return;
    await this._voidModelService.initializeModel(uri);
    await this._voidModelService.saveModel(uri);
  }
  // the applyDonePromise this returns can reject, and should be caught with .catch
  startApplying(opts) {
    let res = void 0;
    if (opts.from === "QuickEdit") {
      res = this._initializeWriteoverStream(opts);
    } else if (opts.from === "ClickApply") {
      if (this._settingsService.state.globalSettings.enableFastApply) {
        const numCharsInFile = this._fileLengthOfGivenURI(opts.uri);
        if (numCharsInFile === null) return null;
        if (numCharsInFile < 1e3) {
          res = this._initializeWriteoverStream(opts);
        } else {
          res = this._initializeSearchAndReplaceStream(opts);
        }
      } else {
        res = this._initializeWriteoverStream(opts);
      }
    }
    if (!res) return null;
    const [diffZone, applyDonePromise] = res;
    return [diffZone._URI, applyDonePromise];
  }
  instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks }) {
    const res = this._startStreamingDiffZone({
      uri,
      streamRequestIdRef: { current: null },
      startBehavior: "keep-conflicts",
      linkedCtrlKZone: null,
      onWillUndo: () => {
      }
    });
    if (!res) return;
    const { diffZone, onFinishEdit } = res;
    const onDone = () => {
      diffZone._streamState = { isStreaming: false };
      this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid });
      this._refreshStylesAndDiffsInURI(uri);
      onFinishEdit();
      if (this._settingsService.state.globalSettings.autoAcceptLLMChanges) {
        this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: false, behavior: "accept" });
      }
    };
    const onError = (e) => {
      onDone();
      this._undoHistory(uri);
      throw e.fullError || new Error(e.message);
    };
    try {
      this._instantlyApplySRBlocks(uri, searchReplaceBlocks);
    } catch (e) {
      onError({ message: e + "", fullError: null });
    }
    onDone();
  }
  instantlyRewriteFile({ uri, newContent }) {
    const res = this._startStreamingDiffZone({
      uri,
      streamRequestIdRef: { current: null },
      startBehavior: "keep-conflicts",
      linkedCtrlKZone: null,
      onWillUndo: () => {
      }
    });
    if (!res) return;
    const { diffZone, onFinishEdit } = res;
    const onDone = () => {
      diffZone._streamState = { isStreaming: false };
      this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid });
      this._refreshStylesAndDiffsInURI(uri);
      onFinishEdit();
      if (this._settingsService.state.globalSettings.autoAcceptLLMChanges) {
        this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: false, behavior: "accept" });
      }
    };
    this._writeURIText(uri, newContent, "wholeFileRange", { shouldRealignDiffAreas: true });
    onDone();
  }
  _findOverlappingDiffArea({ startLine, endLine, uri, filter }) {
    for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
      const diffArea = this.diffAreaOfId[diffareaid];
      if (!diffArea) continue;
      if (!filter?.(diffArea)) continue;
      const noOverlap = diffArea.startLine > endLine || diffArea.endLine < startLine;
      if (!noOverlap) {
        return diffArea;
      }
    }
    return null;
  }
  _startStreamingDiffZone({
    uri,
    startBehavior,
    streamRequestIdRef,
    linkedCtrlKZone,
    onWillUndo
  }) {
    const { model } = this._voidModelService.getModel(uri);
    if (!model) return;
    const startLine = linkedCtrlKZone ? linkedCtrlKZone.startLine : 1;
    const endLine = linkedCtrlKZone ? linkedCtrlKZone.endLine : model.getLineCount();
    const range = { startLineNumber: startLine, startColumn: 1, endLineNumber: endLine, endColumn: Number.MAX_SAFE_INTEGER };
    const originalFileStr = model.getValue(EndOfLinePreference.LF);
    let originalCode = model.getValueInRange(range, EndOfLinePreference.LF);
    const { onFinishEdit } = this._addToHistory(uri, { onWillUndo });
    if (startBehavior === "keep-conflicts") {
      if (linkedCtrlKZone) {
      } else {
        this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: "reject", _addToHistory: false });
        const oldFileStr = model.getValue(EndOfLinePreference.LF);
        this._writeURIText(uri, originalFileStr, "wholeFileRange", { shouldRealignDiffAreas: true });
        originalCode = oldFileStr;
      }
    } else if (startBehavior === "accept-conflicts" || startBehavior === "reject-conflicts") {
      const behavior = startBehavior === "accept-conflicts" ? "accept" : "reject";
      this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior, _addToHistory: false });
    }
    const adding = {
      type: "DiffZone",
      originalCode,
      startLine,
      endLine,
      _URI: uri,
      _streamState: {
        isStreaming: true,
        streamRequestIdRef,
        line: startLine
      },
      _diffOfId: {},
      // added later
      _removeStylesFns: /* @__PURE__ */ new Set()
    };
    const diffZone = this._addDiffArea(adding);
    this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid });
    this._onDidAddOrDeleteDiffZones.fire({ uri });
    if (linkedCtrlKZone) {
      const ctrlKZone = linkedCtrlKZone;
      ctrlKZone._linkedStreamingDiffZone = diffZone.diffareaid;
      this._onDidChangeStreamingInCtrlKZone.fire({ uri, diffareaid: ctrlKZone.diffareaid });
    }
    return { diffZone, onFinishEdit };
  }
  _uriIsStreaming(uri) {
    const diffAreas = this.diffAreasOfURI[uri.fsPath];
    if (!diffAreas) return false;
    for (const diffareaid of diffAreas) {
      const diffArea = this.diffAreaOfId[diffareaid];
      if (diffArea?.type !== "DiffZone") continue;
      if (diffArea._streamState.isStreaming) return true;
    }
    return false;
  }
  _initializeWriteoverStream(opts) {
    const { from } = opts;
    const featureName = opts.from === "ClickApply" ? "Apply" : "Ctrl+K";
    const overridesOfModel = this._settingsService.state.overridesOfModel;
    const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName];
    const modelSelectionOptions = modelSelection ? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName] : void 0;
    const uri = this._getURIBeforeStartApplying(opts);
    if (!uri) return;
    let startRange;
    let ctrlKZoneIfQuickEdit = null;
    if (from === "ClickApply") {
      startRange = "fullFile";
    } else if (from === "QuickEdit") {
      const { diffareaid } = opts;
      const ctrlKZone = this.diffAreaOfId[diffareaid];
      if (ctrlKZone?.type !== "CtrlKZone") return;
      ctrlKZoneIfQuickEdit = ctrlKZone;
      const { startLine: startLine_, endLine: endLine_ } = ctrlKZone;
      startRange = [startLine_, endLine_];
    } else {
      throw new Error(`Plaxio: diff.type not recognized on: ${from}`);
    }
    const { model } = this._voidModelService.getModel(uri);
    if (!model) return;
    let streamRequestIdRef = { current: null };
    const quickEditFIMTags = defaultQuickEditFimTags;
    const originalFileCode = model.getValue(EndOfLinePreference.LF);
    const originalCode = startRange === "fullFile" ? originalFileCode : originalFileCode.split("\n").slice(startRange[0] - 1, startRange[1] - 1 + 1).join("\n");
    const language = model.getLanguageId();
    let messages;
    let separateSystemMessage;
    if (from === "ClickApply") {
      const { messages: a, separateSystemMessage: b } = this._convertToLLMMessageService.prepareLLMSimpleMessages({
        systemMessage: rewriteCode_systemMessage,
        simpleMessages: [{ role: "user", content: rewriteCode_userMessage({ originalCode, applyStr: opts.applyStr, language }) }],
        featureName,
        modelSelection
      });
      messages = a;
      separateSystemMessage = b;
    } else if (from === "QuickEdit") {
      if (!ctrlKZoneIfQuickEdit) return;
      const { _mountInfo } = ctrlKZoneIfQuickEdit;
      const instructions = _mountInfo?.textAreaRef.current?.value ?? "";
      const startLine = startRange === "fullFile" ? 1 : startRange[0];
      const endLine = startRange === "fullFile" ? model.getLineCount() : startRange[1];
      const { prefix, suffix } = voidPrefixAndSuffix({ fullFileStr: originalFileCode, startLine, endLine });
      const userContent = ctrlKStream_userMessage({ selection: originalCode, instructions, prefix, suffix, fimTags: quickEditFIMTags, language });
      const { messages: a, separateSystemMessage: b } = this._convertToLLMMessageService.prepareLLMSimpleMessages({
        systemMessage: ctrlKStream_systemMessage({ quickEditFIMTags }),
        simpleMessages: [{ role: "user", content: userContent }],
        featureName,
        modelSelection
      });
      messages = a;
      separateSystemMessage = b;
    } else {
      throw new Error(`featureName ${from} is invalid`);
    }
    if (this._uriIsStreaming(uri)) return;
    const res = this._startStreamingDiffZone({
      uri,
      streamRequestIdRef,
      startBehavior: opts.startBehavior,
      linkedCtrlKZone: ctrlKZoneIfQuickEdit,
      onWillUndo: () => {
        if (streamRequestIdRef.current) {
          this._llmMessageService.abort(streamRequestIdRef.current);
        }
      }
    });
    if (!res) return;
    const { diffZone, onFinishEdit } = res;
    const onDone = () => {
      console.log("called onDone");
      diffZone._streamState = { isStreaming: false };
      this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid });
      if (ctrlKZoneIfQuickEdit) {
        const ctrlKZone = ctrlKZoneIfQuickEdit;
        ctrlKZone._linkedStreamingDiffZone = null;
        this._onDidChangeStreamingInCtrlKZone.fire({ uri, diffareaid: ctrlKZone.diffareaid });
        this._deleteCtrlKZone(ctrlKZone);
      }
      this._refreshStylesAndDiffsInURI(uri);
      onFinishEdit();
      if (this._settingsService.state.globalSettings.autoAcceptLLMChanges) {
        this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: false, behavior: "accept" });
      }
    };
    const onError = (e) => {
      onDone();
      this._undoHistory(uri);
      throw e.fullError || new Error(e.message);
    };
    const extractText = (fullText, recentlyAddedTextLen) => {
      if (from === "QuickEdit") {
        return extractCodeFromFIM({ text: fullText, recentlyAddedTextLen, midTag: quickEditFIMTags.midTag });
      } else if (from === "ClickApply") {
        return extractCodeFromRegular({ text: fullText, recentlyAddedTextLen });
      }
      throw new Error("Void 1");
    };
    this._refreshStylesAndDiffsInURI(uri);
    const latestStreamLocationMutable = { line: diffZone.startLine, addedSplitYet: false, col: 1, originalCodeStartLine: 1 };
    const runWriteover = async () => {
      let shouldSendAnotherMessage = true;
      while (shouldSendAnotherMessage) {
        shouldSendAnotherMessage = false;
        let resMessageDonePromise = () => {
        };
        const messageDonePromise = new Promise((res_) => {
          resMessageDonePromise = res_;
        });
        let fullTextSoFar = "";
        let prevIgnoredSuffix = "";
        let aborted = false;
        let weAreAborting = false;
        streamRequestIdRef.current = this._llmMessageService.sendLLMMessage({
          messagesType: "chatMessages",
          logging: { loggingName: `Edit (Writeover) - ${from}` },
          messages,
          modelSelection,
          modelSelectionOptions,
          overridesOfModel,
          separateSystemMessage,
          chatMode: null,
          // not chat
          onText: (params) => {
            const { fullText: fullText_ } = params;
            const newText_ = fullText_.substring(fullTextSoFar.length, Infinity);
            const newText = prevIgnoredSuffix + newText_;
            fullTextSoFar += newText;
            const [croppedText, deltaCroppedText, croppedSuffix] = extractText(fullTextSoFar, newText.length);
            const { endLineInLlmTextSoFar } = this._writeStreamedDiffZoneLLMText(uri, originalCode, croppedText, deltaCroppedText, latestStreamLocationMutable);
            diffZone._streamState.line = diffZone.startLine - 1 + endLineInLlmTextSoFar;
            this._refreshStylesAndDiffsInURI(uri);
            prevIgnoredSuffix = croppedSuffix;
          },
          onFinalMessage: (params) => {
            const { fullText } = params;
            const [croppedText, _1, _2] = extractText(fullText, 0);
            this._writeURIText(
              uri,
              croppedText,
              { startLineNumber: diffZone.startLine, startColumn: 1, endLineNumber: diffZone.endLine, endColumn: Number.MAX_SAFE_INTEGER },
              // 1-indexed
              { shouldRealignDiffAreas: true }
            );
            onDone();
            resMessageDonePromise();
          },
          onError: (e) => {
            onError(e);
          },
          onAbort: () => {
            if (weAreAborting) return;
            aborted = true;
            resMessageDonePromise();
          }
        });
        if (streamRequestIdRef.current === null) {
          return;
        }
        await messageDonePromise;
        if (aborted) {
          throw new Error(`Edit was interrupted by the user.`);
        }
      }
    };
    const applyDonePromise = new Promise((res2, rej) => {
      runWriteover().then(res2).catch(rej);
    });
    return [diffZone, applyDonePromise];
  }
  _uriOfGivenURI(givenURI) {
    if (givenURI === "current") {
      const uri_ = this._getActiveEditorURI();
      if (!uri_) return;
      return uri_;
    }
    return givenURI;
  }
  _fileLengthOfGivenURI(givenURI) {
    const uri = this._uriOfGivenURI(givenURI);
    if (!uri) return null;
    const { model } = this._voidModelService.getModel(uri);
    if (!model) return null;
    const numCharsInFile = model.getValueLength(EndOfLinePreference.LF);
    return numCharsInFile;
  }
  _instantlyApplySRBlocks(uri, blocksStr) {
    const blocks = extractSearchReplaceBlocks(blocksStr);
    if (blocks.length === 0) throw new Error(`No Search/Replace blocks were received!`);
    const { model } = this._voidModelService.getModel(uri);
    if (!model) throw new Error(`Error applying Search/Replace blocks: File does not exist.`);
    const modelStr = model.getValue(EndOfLinePreference.LF);
    const modelStrLines = modelStr.split("\n");
    const replacements = [];
    for (const b of blocks) {
      const res = findTextInCode(b.orig, modelStr, true, { returnType: "lines" });
      if (typeof res === "string")
        throw new Error(this._errContentOfInvalidStr(res, b.orig));
      let [startLine, endLine] = res;
      startLine -= 1;
      endLine -= 1;
      const origStart = (startLine !== 0 ? modelStrLines.slice(0, startLine).join("\n") + "\n" : "").length;
      const origEnd = modelStrLines.slice(0, endLine + 1).join("\n").length - 1;
      replacements.push({ origStart, origEnd, block: b });
    }
    replacements.sort((a, b) => a.origStart - b.origStart);
    for (let i = 1; i < replacements.length; i++) {
      if (replacements[i].origStart <= replacements[i - 1].origEnd) {
        throw new Error(this._errContentOfInvalidStr("Has overlap", replacements[i]?.block?.orig));
      }
    }
    let newCode = modelStr;
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { origStart, origEnd, block } = replacements[i];
      newCode = newCode.slice(0, origStart) + block.final + newCode.slice(origEnd + 1, Infinity);
    }
    this._writeURIText(
      uri,
      newCode,
      "wholeFileRange",
      { shouldRealignDiffAreas: true }
    );
  }
  _initializeSearchAndReplaceStream(opts) {
    const { from, applyStr } = opts;
    const featureName = "Apply";
    const overridesOfModel = this._settingsService.state.overridesOfModel;
    const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName];
    const modelSelectionOptions = modelSelection ? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName] : void 0;
    const uri = this._getURIBeforeStartApplying(opts);
    if (!uri) return;
    const { model } = this._voidModelService.getModel(uri);
    if (!model) return;
    let streamRequestIdRef = { current: null };
    const originalFileCode = model.getValue(EndOfLinePreference.LF);
    const userMessageContent = searchReplaceGivenDescription_userMessage({ originalCode: originalFileCode, applyStr });
    const { messages, separateSystemMessage } = this._convertToLLMMessageService.prepareLLMSimpleMessages({
      systemMessage: searchReplaceGivenDescription_systemMessage,
      simpleMessages: [{ role: "user", content: userMessageContent }],
      featureName,
      modelSelection
    });
    if (this._uriIsStreaming(uri)) return;
    const res = this._startStreamingDiffZone({
      uri,
      streamRequestIdRef,
      startBehavior: opts.startBehavior,
      linkedCtrlKZone: null,
      onWillUndo: () => {
        if (streamRequestIdRef.current) {
          this._llmMessageService.abort(streamRequestIdRef.current);
        }
      }
    });
    if (!res) return;
    const { diffZone, onFinishEdit } = res;
    const convertOriginalRangeToFinalRange = (originalRange) => {
      const [originalStart, originalEnd] = originalRange;
      let lineOffset = 0;
      for (const blockDiffArea of addedTrackingZoneOfBlockNum) {
        const {
          startLine,
          endLine,
          metadata: { originalBounds: [originalStart2, originalEnd2] }
        } = blockDiffArea;
        if (originalStart2 >= originalEnd) continue;
        const numNewLines = endLine - startLine + 1;
        const numOldLines = originalEnd2 - originalStart2 + 1;
        lineOffset += numNewLines - numOldLines;
      }
      return [originalStart + lineOffset, originalEnd + lineOffset];
    };
    const onDone = () => {
      diffZone._streamState = { isStreaming: false };
      this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid });
      this._refreshStylesAndDiffsInURI(uri);
      for (const trackingZone of addedTrackingZoneOfBlockNum)
        this._deleteTrackingZone(trackingZone);
      onFinishEdit();
      if (this._settingsService.state.globalSettings.autoAcceptLLMChanges) {
        this.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: false, behavior: "accept" });
      }
    };
    const onError = (e) => {
      onDone();
      this._undoHistory(uri);
      throw e.fullError || new Error(e.message);
    };
    this._refreshStylesAndDiffsInURI(uri);
    let latestStreamLocationMutable = null;
    let shouldUpdateOrigStreamStyle = true;
    let oldBlocks = [];
    const addedTrackingZoneOfBlockNum = [];
    diffZone._streamState.line = 1;
    const N_RETRIES = 4;
    const runSearchReplace = async () => {
      let shouldSendAnotherMessage = true;
      let nMessagesSent = 0;
      let currStreamingBlockNum = 0;
      let aborted = false;
      let weAreAborting = false;
      while (shouldSendAnotherMessage) {
        shouldSendAnotherMessage = false;
        nMessagesSent += 1;
        if (nMessagesSent >= N_RETRIES) {
          const e = {
            message: `Tried to Fast Apply ${N_RETRIES} times but failed. This may be related to model intelligence, or it may an edit that's too complex. Please retry or disable Fast Apply.`,
            fullError: null
          };
          onError(e);
          break;
        }
        let resMessageDonePromise = () => {
        };
        const messageDonePromise = new Promise((res2, rej) => {
          resMessageDonePromise = res2;
        });
        const onText = (params) => {
          const { fullText } = params;
          const blocks = extractSearchReplaceBlocks(fullText);
          for (let blockNum = currStreamingBlockNum; blockNum < blocks.length; blockNum += 1) {
            const block = blocks[blockNum];
            if (block.state === "writingOriginal") {
              if (shouldUpdateOrigStreamStyle && block.orig.trim().length >= 20) {
                const startingAtLine = diffZone._streamState.line ?? 1;
                const originalRange = findTextInCode(block.orig, originalFileCode, false, { startingAtLine, returnType: "lines" });
                if (typeof originalRange !== "string") {
                  const [startLine, _] = convertOriginalRangeToFinalRange(originalRange);
                  diffZone._streamState.line = startLine;
                  shouldUpdateOrigStreamStyle = false;
                }
              }
              continue;
            }
            shouldUpdateOrigStreamStyle = true;
            if (!(blockNum in addedTrackingZoneOfBlockNum)) {
              const originalBounds = findTextInCode(block.orig, originalFileCode, true, { returnType: "lines" });
              const hasOverlap = addedTrackingZoneOfBlockNum.some((trackingZone2) => {
                const [existingStart, existingEnd] = trackingZone2.metadata.originalBounds;
                const hasNoOverlap = endLine < existingStart || startLine > existingEnd;
                return !hasNoOverlap;
              });
              if (typeof originalBounds === "string" || hasOverlap) {
                const errorMessage = typeof originalBounds === "string" ? originalBounds : "Has overlap";
                console.log("--------------Error finding text in code:");
                console.log("originalFileCode", { originalFileCode });
                console.log("fullText", { fullText });
                console.log("error:", errorMessage);
                console.log("block.orig:", block.orig);
                console.log("---------");
                const content = this._errContentOfInvalidStr(errorMessage, block.orig);
                const retryMsg = "All of your previous outputs have been ignored. Please re-output ALL SEARCH/REPLACE blocks starting from the first one, and avoid the error this time.";
                messages.push(
                  { role: "assistant", content: fullText },
                  // latest output
                  { role: "user", content: content + "\n" + retryMsg }
                  // user explanation of what's wrong
                );
                currStreamingBlockNum = 0;
                latestStreamLocationMutable = null;
                shouldUpdateOrigStreamStyle = true;
                oldBlocks = [];
                for (const trackingZone2 of addedTrackingZoneOfBlockNum)
                  this._deleteTrackingZone(trackingZone2);
                addedTrackingZoneOfBlockNum.splice(0, Infinity);
                this._writeURIText(uri, originalFileCode, "wholeFileRange", { shouldRealignDiffAreas: true });
                shouldSendAnotherMessage = true;
                if (streamRequestIdRef.current) {
                  weAreAborting = true;
                  this._llmMessageService.abort(streamRequestIdRef.current);
                  weAreAborting = false;
                }
                diffZone._streamState.line = 1;
                resMessageDonePromise();
                this._refreshStylesAndDiffsInURI(uri);
                return;
              }
              const [startLine, endLine] = convertOriginalRangeToFinalRange(originalBounds);
              const adding = {
                type: "TrackingZone",
                startLine,
                endLine,
                _URI: uri,
                metadata: {
                  originalBounds: [...originalBounds],
                  originalCode: block.orig
                }
              };
              const trackingZone = this._addDiffArea(adding);
              addedTrackingZoneOfBlockNum.push(trackingZone);
              latestStreamLocationMutable = { line: startLine, addedSplitYet: false, col: 1, originalCodeStartLine: 1 };
            }
            if (!diffZone._streamState.isStreaming) {
              console.error("DiffZone was not in streaming state in _initializeSearchAndReplaceStream");
              continue;
            }
            if (block.state === "done") {
              const { startLine: finalStartLine, endLine: finalEndLine } = addedTrackingZoneOfBlockNum[blockNum];
              this._writeURIText(
                uri,
                block.final,
                { startLineNumber: finalStartLine, startColumn: 1, endLineNumber: finalEndLine, endColumn: Number.MAX_SAFE_INTEGER },
                // 1-indexed
                { shouldRealignDiffAreas: true }
              );
              diffZone._streamState.line = finalEndLine + 1;
              currStreamingBlockNum = blockNum + 1;
              continue;
            }
            if (!latestStreamLocationMutable) continue;
            const oldBlock = oldBlocks[blockNum];
            const oldFinalLen = (oldBlock?.final ?? "").length;
            const deltaFinalText = block.final.substring(oldFinalLen, Infinity);
            this._writeStreamedDiffZoneLLMText(uri, block.orig, block.final, deltaFinalText, latestStreamLocationMutable);
            oldBlocks = blocks;
            diffZone._streamState.line = latestStreamLocationMutable.line;
          }
          this._refreshStylesAndDiffsInURI(uri);
        };
        streamRequestIdRef.current = this._llmMessageService.sendLLMMessage({
          messagesType: "chatMessages",
          logging: { loggingName: `Edit (Search/Replace) - ${from}` },
          messages,
          modelSelection,
          modelSelectionOptions,
          overridesOfModel,
          separateSystemMessage,
          chatMode: null,
          // not chat
          onText: (params) => {
            onText(params);
          },
          onFinalMessage: async (params) => {
            const { fullText } = params;
            onText(params);
            const blocks = extractSearchReplaceBlocks(fullText);
            if (blocks.length === 0) {
              this._notificationService.info(`Plaxio: We ran Fast Apply, but the LLM didn't output any changes.`);
            }
            this._writeURIText(uri, originalFileCode, "wholeFileRange", { shouldRealignDiffAreas: true });
            try {
              this._instantlyApplySRBlocks(uri, fullText);
              onDone();
              resMessageDonePromise();
            } catch (e) {
              onError(e);
            }
          },
          onError: (e) => {
            onError(e);
          },
          onAbort: () => {
            if (weAreAborting) return;
            aborted = true;
            resMessageDonePromise();
          }
        });
        if (streamRequestIdRef.current === null) {
          break;
        }
        await messageDonePromise;
        if (aborted) {
          throw new Error(`Edit was interrupted by the user.`);
        }
      }
    };
    const applyDonePromise = new Promise((res2, rej) => {
      runSearchReplace().then(res2).catch(rej);
    });
    return [diffZone, applyDonePromise];
  }
  _undoHistory(uri) {
    this._undoRedoService.undo(uri);
  }
  isCtrlKZoneStreaming({ diffareaid }) {
    const ctrlKZone = this.diffAreaOfId[diffareaid];
    if (!ctrlKZone) return false;
    if (ctrlKZone.type !== "CtrlKZone") return false;
    return !!ctrlKZone._linkedStreamingDiffZone;
  }
  _stopIfStreaming(diffZone) {
    const uri = diffZone._URI;
    const streamRequestId = diffZone._streamState.streamRequestIdRef?.current;
    if (!streamRequestId) return;
    this._llmMessageService.abort(streamRequestId);
    diffZone._streamState = { isStreaming: false };
    this._onDidChangeStreamingInDiffZone.fire({ uri, diffareaid: diffZone.diffareaid });
  }
  // diffareaid of the ctrlKZone (even though the stream state is dictated by the linked diffZone)
  interruptCtrlKStreaming({ diffareaid }) {
    const ctrlKZone = this.diffAreaOfId[diffareaid];
    if (ctrlKZone?.type !== "CtrlKZone") return;
    if (!ctrlKZone._linkedStreamingDiffZone) return;
    const linkedStreamingDiffZone = this.diffAreaOfId[ctrlKZone._linkedStreamingDiffZone];
    if (!linkedStreamingDiffZone) return;
    if (linkedStreamingDiffZone.type !== "DiffZone") return;
    this._stopIfStreaming(linkedStreamingDiffZone);
    this._undoHistory(linkedStreamingDiffZone._URI);
  }
  interruptURIStreaming({ uri }) {
    if (!this._uriIsStreaming(uri)) return;
    this._undoHistory(uri);
    for (const diffareaid of this.diffAreasOfURI[uri.fsPath] || []) {
      const diffArea = this.diffAreaOfId[diffareaid];
      if (diffArea?.type !== "DiffZone") continue;
      if (!diffArea._streamState.isStreaming) continue;
      this._stopIfStreaming(diffArea);
    }
  }
  // public removeDiffZone(diffZone: DiffZone, behavior: 'reject' | 'accept') {
  // 	const uri = diffZone._URI
  // 	const { onFinishEdit } = this._addToHistory(uri)
  // 	if (behavior === 'reject') this._revertAndDeleteDiffZone(diffZone)
  // 	else if (behavior === 'accept') this._deleteDiffZone(diffZone)
  // 	this._refreshStylesAndDiffsInURI(uri)
  // 	onFinishEdit()
  // }
  _revertDiffZone(diffZone) {
    const uri = diffZone._URI;
    const writeText = diffZone.originalCode;
    const toRange = { startLineNumber: diffZone.startLine, startColumn: 1, endLineNumber: diffZone.endLine, endColumn: Number.MAX_SAFE_INTEGER };
    this._writeURIText(uri, writeText, toRange, { shouldRealignDiffAreas: true });
  }
  // called on void.acceptDiff
  async acceptDiff({ diffid }) {
    const diff = this.diffOfId[diffid];
    if (!diff) return;
    const { diffareaid } = diff;
    const diffArea = this.diffAreaOfId[diffareaid];
    if (!diffArea) return;
    if (diffArea.type !== "DiffZone") return;
    const uri = diffArea._URI;
    const { onFinishEdit } = this._addToHistory(uri);
    const originalLines = diffArea.originalCode.split("\n");
    let newOriginalCode;
    if (diff.type === "deletion") {
      newOriginalCode = [
        ...originalLines.slice(0, diff.originalStartLine - 1),
        // everything before startLine
        // <-- deletion has nothing here
        ...originalLines.slice(diff.originalEndLine - 1 + 1, Infinity)
        // everything after endLine
      ].join("\n");
    } else if (diff.type === "insertion") {
      newOriginalCode = [
        ...originalLines.slice(0, diff.originalStartLine - 1),
        // everything before startLine
        diff.code,
        // code
        ...originalLines.slice(diff.originalStartLine - 1, Infinity)
        // startLine (inclusive) and on (no +1)
      ].join("\n");
    } else if (diff.type === "edit") {
      newOriginalCode = [
        ...originalLines.slice(0, diff.originalStartLine - 1),
        // everything before startLine
        diff.code,
        // code
        ...originalLines.slice(diff.originalEndLine - 1 + 1, Infinity)
        // everything after endLine
      ].join("\n");
    } else {
      throw new Error(`Void error: ${diff}.type not recognized`);
    }
    diffArea.originalCode = newOriginalCode;
    this._deleteDiff(diff);
    if (Object.keys(diffArea._diffOfId).length === 0) {
      this._deleteDiffZone(diffArea);
    }
    this._refreshStylesAndDiffsInURI(uri);
    onFinishEdit();
  }
  // called on void.rejectDiff
  async rejectDiff({ diffid }) {
    const diff = this.diffOfId[diffid];
    if (!diff) return;
    const { diffareaid } = diff;
    const diffArea = this.diffAreaOfId[diffareaid];
    if (!diffArea) return;
    if (diffArea.type !== "DiffZone") return;
    const uri = diffArea._URI;
    const { onFinishEdit } = this._addToHistory(uri);
    let writeText;
    let toRange;
    if (diff.type === "deletion") {
      if (diff.startLine - 1 === diffArea.endLine) {
        writeText = "\n" + diff.originalCode;
        toRange = { startLineNumber: diff.startLine - 1, startColumn: Number.MAX_SAFE_INTEGER, endLineNumber: diff.startLine - 1, endColumn: Number.MAX_SAFE_INTEGER };
      } else {
        writeText = diff.originalCode + "\n";
        toRange = { startLineNumber: diff.startLine, startColumn: 1, endLineNumber: diff.startLine, endColumn: 1 };
      }
    } else if (diff.type === "insertion") {
      if (diff.endLine === diffArea.endLine) {
        writeText = "";
        toRange = { startLineNumber: diff.startLine - 1, startColumn: Number.MAX_SAFE_INTEGER, endLineNumber: diff.endLine, endColumn: 1 };
      } else {
        writeText = "";
        toRange = { startLineNumber: diff.startLine, startColumn: 1, endLineNumber: diff.endLine + 1, endColumn: 1 };
      }
    } else if (diff.type === "edit") {
      writeText = diff.originalCode;
      toRange = { startLineNumber: diff.startLine, startColumn: 1, endLineNumber: diff.endLine, endColumn: Number.MAX_SAFE_INTEGER };
    } else {
      throw new Error(`Void error: ${diff}.type not recognized`);
    }
    this._writeURIText(uri, writeText, toRange, { shouldRealignDiffAreas: true });
    this._deleteDiff(diff);
    if (Object.keys(diffArea._diffOfId).length === 0) {
      this._deleteDiffZone(diffArea);
    }
    this._refreshStylesAndDiffsInURI(uri);
    onFinishEdit();
  }
};
EditCodeService = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, IModelService),
  __decorateParam(2, IUndoRedoService),
  __decorateParam(3, ILLMMessageService),
  __decorateParam(4, IConsistentItemService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IConsistentEditorItemService),
  __decorateParam(7, IMetricsService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IVoidSettingsService),
  __decorateParam(10, IVoidModelService),
  __decorateParam(11, IConvertToLLMMessageService)
], EditCodeService);
registerSingleton(IEditCodeService, EditCodeService, InstantiationType.Eager);
let AcceptRejectInlineWidget = class extends Widget {
  constructor({ editor, onAccept, onReject, diffid, startLine, offsetLines }, _voidCommandBarService, _keybindingService, _editCodeService) {
    super();
    this._voidCommandBarService = _voidCommandBarService;
    this._keybindingService = _keybindingService;
    this._editCodeService = _editCodeService;
    const uri = editor.getModel()?.uri;
    this.ID = "";
    this.editor = editor;
    this.startLine = startLine;
    if (!uri) {
      const { dummyDiv } = dom.h("div@dummyDiv");
      this._domNode = dummyDiv;
      return;
    }
    this.ID = uri.fsPath + diffid;
    const lineHeight = editor.getOption(EditorOption.lineHeight);
    const getAcceptRejectText = () => {
      const acceptKeybinding = this._keybindingService.lookupKeybinding(VOID_ACCEPT_DIFF_ACTION_ID);
      const rejectKeybinding = this._keybindingService.lookupKeybinding(VOID_REJECT_DIFF_ACTION_ID);
      const acceptKeybindLabel = this._editCodeService.processRawKeybindingText(acceptKeybinding && acceptKeybinding.getLabel() || "");
      const rejectKeybindLabel = this._editCodeService.processRawKeybindingText(rejectKeybinding && rejectKeybinding.getLabel() || "");
      const commandBarStateAtUri = this._voidCommandBarService.stateOfURI[uri.fsPath];
      const selectedDiffIdx = commandBarStateAtUri?.diffIdx ?? 0;
      const thisDiffIdx = commandBarStateAtUri?.sortedDiffIds.indexOf(diffid) ?? null;
      const showLabel = thisDiffIdx === selectedDiffIdx;
      const acceptText2 = `Accept${showLabel ? ` ` + acceptKeybindLabel : ""}`;
      const rejectText2 = `Reject${showLabel ? ` ` + rejectKeybindLabel : ""}`;
      return { acceptText: acceptText2, rejectText: rejectText2 };
    };
    const { acceptText, rejectText } = getAcceptRejectText();
    const { acceptButton, rejectButton, buttons } = dom.h("div@buttons", [
      dom.h("button@acceptButton", []),
      dom.h("button@rejectButton", [])
    ]);
    buttons.style.display = "flex";
    buttons.style.position = "absolute";
    buttons.style.gap = "4px";
    buttons.style.paddingRight = "4px";
    buttons.style.zIndex = "1";
    buttons.style.transform = `translateY(${offsetLines * lineHeight}px)`;
    buttons.style.justifyContent = "flex-end";
    buttons.style.width = "100%";
    buttons.style.pointerEvents = "none";
    acceptButton.onclick = onAccept;
    acceptButton.textContent = acceptText;
    acceptButton.style.backgroundColor = acceptBg;
    acceptButton.style.border = acceptBorder;
    acceptButton.style.color = buttonTextColor;
    acceptButton.style.fontSize = buttonFontSize;
    acceptButton.style.borderTop = "none";
    acceptButton.style.padding = "1px 4px";
    acceptButton.style.borderBottomLeftRadius = "6px";
    acceptButton.style.borderBottomRightRadius = "6px";
    acceptButton.style.borderTopLeftRadius = "0";
    acceptButton.style.borderTopRightRadius = "0";
    acceptButton.style.cursor = "pointer";
    acceptButton.style.height = "100%";
    acceptButton.style.boxShadow = "0 2px 3px rgba(0,0,0,0.2)";
    acceptButton.style.pointerEvents = "auto";
    rejectButton.onclick = onReject;
    rejectButton.textContent = rejectText;
    rejectButton.style.backgroundColor = rejectBg;
    rejectButton.style.border = rejectBorder;
    rejectButton.style.color = buttonTextColor;
    rejectButton.style.fontSize = buttonFontSize;
    rejectButton.style.borderTop = "none";
    rejectButton.style.padding = "1px 4px";
    rejectButton.style.borderBottomLeftRadius = "6px";
    rejectButton.style.borderBottomRightRadius = "6px";
    rejectButton.style.borderTopLeftRadius = "0";
    rejectButton.style.borderTopRightRadius = "0";
    rejectButton.style.cursor = "pointer";
    rejectButton.style.height = "100%";
    rejectButton.style.boxShadow = "0 2px 3px rgba(0,0,0,0.2)";
    rejectButton.style.pointerEvents = "auto";
    this._domNode = buttons;
    const updateTop = () => {
      const topPx = editor.getTopForLineNumber(this.startLine) - editor.getScrollTop();
      this._domNode.style.top = `${topPx}px`;
    };
    const updateLeft = () => {
      const layoutInfo = editor.getLayoutInfo();
      const minimapWidth = layoutInfo.minimap.minimapWidth;
      const verticalScrollbarWidth = layoutInfo.verticalScrollbarWidth;
      const buttonWidth = this._domNode.offsetWidth;
      const leftPx = layoutInfo.width - minimapWidth - verticalScrollbarWidth - buttonWidth;
      this._domNode.style.left = `${leftPx}px`;
    };
    setTimeout(() => {
      updateTop();
      updateLeft();
    }, 0);
    this._register(editor.onDidScrollChange((e) => {
      updateTop();
    }));
    this._register(editor.onDidChangeModelContent((e) => {
      updateTop();
    }));
    this._register(editor.onDidLayoutChange((e) => {
      updateTop();
      updateLeft();
    }));
    this._register(this._voidCommandBarService.onDidChangeState((e) => {
      if (uri && e.uri.fsPath === uri.fsPath) {
        const { acceptText: acceptText2, rejectText: rejectText2 } = getAcceptRejectText();
        acceptButton.textContent = acceptText2;
        rejectButton.textContent = rejectText2;
      }
    }));
    editor.addOverlayWidget(this);
  }
  getId() {
    return this.ID || "";
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    return null;
  }
  dispose() {
    this.editor.removeOverlayWidget(this);
    super.dispose();
  }
};
AcceptRejectInlineWidget = __decorateClass([
  __decorateParam(1, IVoidCommandBarService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IEditCodeService)
], AcceptRejectInlineWidget);
export {
  getLengthOfTextPx
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvZWRpdENvZGVTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclNpbmdsZXRvbiwgSW5zdGFudGlhdGlvblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IsIElPdmVybGF5V2lkZ2V0LCBJVmlld1pvbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcblxuLy8gaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG4vLyBpbXBvcnQgeyB0aHJvdHRsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgZmluZERpZmZzIH0gZnJvbSAnLi9oZWxwZXJzL2ZpbmREaWZmcy5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlLCBJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucywgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElVbmRvUmVkb0VsZW1lbnQsIElVbmRvUmVkb1NlcnZpY2UsIFVuZG9SZWRvRWxlbWVudFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuaW1wb3J0IHsgUmVuZGVyT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2NvbXBvbmVudHMvZGlmZkVkaXRvclZpZXdab25lcy9yZW5kZXJMaW5lcy5qcyc7XG4vLyBpbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFdpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS93aWRnZXQuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25zaXN0ZW50RWRpdG9ySXRlbVNlcnZpY2UsIElDb25zaXN0ZW50SXRlbVNlcnZpY2UgfSBmcm9tICcuL2hlbHBlclNlcnZpY2VzL2NvbnNpc3RlbnRJdGVtU2VydmljZS5qcyc7XG5pbXBvcnQgeyB2b2lkUHJlZml4QW5kU3VmZml4LCBjdHJsS1N0cmVhbV91c2VyTWVzc2FnZSwgY3RybEtTdHJlYW1fc3lzdGVtTWVzc2FnZSwgZGVmYXVsdFF1aWNrRWRpdEZpbVRhZ3MsIHJld3JpdGVDb2RlX3N5c3RlbU1lc3NhZ2UsIHJld3JpdGVDb2RlX3VzZXJNZXNzYWdlLCBzZWFyY2hSZXBsYWNlR2l2ZW5EZXNjcmlwdGlvbl9zeXN0ZW1NZXNzYWdlLCBzZWFyY2hSZXBsYWNlR2l2ZW5EZXNjcmlwdGlvbl91c2VyTWVzc2FnZSwgdHJpcGxlVGljaywgfSBmcm9tICcuLi9jb21tb24vcHJvbXB0L3Byb21wdHMuanMnO1xuaW1wb3J0IHsgSVZvaWRDb21tYW5kQmFyU2VydmljZSB9IGZyb20gJy4vdm9pZENvbW1hbmRCYXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgVk9JRF9BQ0NFUFRfRElGRl9BQ1RJT05fSUQsIFZPSURfUkVKRUNUX0RJRkZfQUNUSU9OX0lEIH0gZnJvbSAnLi9hY3Rpb25JRHMuanMnO1xuXG5pbXBvcnQgeyBtb3VudEN0cmxLIH0gZnJvbSAnLi9yZWFjdC9vdXQvcXVpY2stZWRpdC10c3gvaW5kZXguanMnXG5pbXBvcnQgeyBRdWlja0VkaXRQcm9wc1R5cGUgfSBmcm9tICcuL3F1aWNrRWRpdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSU1vZGVsQ29udGVudENoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vdGV4dE1vZGVsRXZlbnRzLmpzJztcbmltcG9ydCB7IGV4dHJhY3RDb2RlRnJvbUZJTSwgZXh0cmFjdENvZGVGcm9tUmVndWxhciwgRXh0cmFjdGVkU2VhcmNoUmVwbGFjZUJsb2NrLCBleHRyYWN0U2VhcmNoUmVwbGFjZUJsb2NrcyB9IGZyb20gJy4uL2NvbW1vbi9oZWxwZXJzL2V4dHJhY3RDb2RlRnJvbVJlc3VsdC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTExNTWVzc2FnZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc2VuZExMTU1lc3NhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IExMTUNoYXRNZXNzYWdlIH0gZnJvbSAnLi4vY29tbW9uL3NlbmRMTE1NZXNzYWdlVHlwZXMuanMnO1xuaW1wb3J0IHsgSU1ldHJpY3NTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL21ldHJpY3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0Q29kZVNlcnZpY2UsIEFkZEN0cmxLT3B0cywgU3RhcnRBcHBseWluZ09wdHMsIENhbGxCZWZvcmVTdGFydEFwcGx5aW5nT3B0cywgfSBmcm9tICcuL2VkaXRDb2RlU2VydmljZUludGVyZmFjZS5qcyc7XG5pbXBvcnQgeyBJVm9pZFNldHRpbmdzU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi92b2lkU2V0dGluZ3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEZlYXR1cmVOYW1lIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRTZXR0aW5nc1R5cGVzLmpzJztcbmltcG9ydCB7IElWb2lkTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRNb2RlbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZGVlcENsb25lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBhY2NlcHRCZywgYWNjZXB0Qm9yZGVyLCBidXR0b25Gb250U2l6ZSwgYnV0dG9uVGV4dENvbG9yLCByZWplY3RCZywgcmVqZWN0Qm9yZGVyIH0gZnJvbSAnLi4vY29tbW9uL2hlbHBlcnMvY29sb3JzLmpzJztcbmltcG9ydCB7IERpZmZBcmVhLCBEaWZmLCBDdHJsS1pvbmUsIFZvaWRGaWxlU25hcHNob3QsIERpZmZBcmVhU25hcHNob3RFbnRyeSwgZGlmZkFyZWFTbmFwc2hvdEtleXMsIERpZmZab25lLCBUcmFja2luZ1pvbmUsIENvbXB1dGVkRGlmZiB9IGZyb20gJy4uL2NvbW1vbi9lZGl0Q29kZVNlcnZpY2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBJQ29udmVydFRvTExNTWVzc2FnZVNlcnZpY2UgfSBmcm9tICcuL2NvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlLmpzJztcbi8vIGltcG9ydCB7IGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuLy8gaW1wb3J0IHsgVk9JRF9PUEVOX1NFVFRJTkdTX0FDVElPTl9JRCB9IGZyb20gJy4vdm9pZFNldHRpbmdzUGFuZS5qcyc7XG5cbmNvbnN0IG51bUxpbmVzT2ZTdHIgPSAoc3RyOiBzdHJpbmcpID0+IHN0ci5zcGxpdCgnXFxuJykubGVuZ3RoXG5cblxuZXhwb3J0IGNvbnN0IGdldExlbmd0aE9mVGV4dFB4ID0gKHsgdGFiV2lkdGgsIHNwYWNlV2lkdGgsIGNvbnRlbnQgfTogeyB0YWJXaWR0aDogbnVtYmVyLCBzcGFjZVdpZHRoOiBudW1iZXIsIGNvbnRlbnQ6IHN0cmluZyB9KSA9PiB7XG5cdGxldCBsZW5ndGhPZlRleHRQeCA9IDA7XG5cdGZvciAoY29uc3QgY2hhciBvZiBjb250ZW50KSB7XG5cdFx0aWYgKGNoYXIgPT09ICdcXHQnKSB7XG5cdFx0XHRsZW5ndGhPZlRleHRQeCArPSB0YWJXaWR0aFxuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZW5ndGhPZlRleHRQeCArPSBzcGFjZVdpZHRoO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBsZW5ndGhPZlRleHRQeFxufVxuXG5cbmNvbnN0IGdldExlYWRpbmdXaGl0ZXNwYWNlUHggPSAoZWRpdG9yOiBJQ29kZUVkaXRvciwgc3RhcnRMaW5lOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuXG5cdGNvbnN0IG1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdGlmICghbW9kZWwpIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdC8vIEdldCB0aGUgbGluZSBjb250ZW50LCBkZWZhdWx0aW5nIHRvIGVtcHR5IHN0cmluZyBpZiBsaW5lIGRvZXNuJ3QgZXhpc3Rcblx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChzdGFydExpbmUpIHx8ICcnO1xuXG5cdC8vIEZpbmQgdGhlIGZpcnN0IG5vbi13aGl0ZXNwYWNlIGNoYXJhY3RlclxuXHRjb25zdCBmaXJzdE5vbldoaXRlc3BhY2VJbmRleCA9IGxpbmVDb250ZW50LnNlYXJjaCgvXFxTLyk7XG5cblx0Ly8gRXh0cmFjdCBsZWFkaW5nIHdoaXRlc3BhY2UsIGhhbmRsaW5nIGNhc2Ugd2hlcmUgbGluZSBpcyBhbGwgd2hpdGVzcGFjZVxuXHRjb25zdCBsZWFkaW5nV2hpdGVzcGFjZSA9IGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4ID09PSAtMVxuXHRcdD8gbGluZUNvbnRlbnRcblx0XHQ6IGxpbmVDb250ZW50LnNsaWNlKDAsIGZpcnN0Tm9uV2hpdGVzcGFjZUluZGV4KTtcblxuXHQvLyBHZXQgZm9udCBpbmZvcm1hdGlvbiBmcm9tIGVkaXRvciByZW5kZXIgb3B0aW9uc1xuXHRjb25zdCB7IHRhYlNpemU6IG51bVNwYWNlc0luVGFiIH0gPSBtb2RlbC5nZXRGb3JtYXR0aW5nT3B0aW9ucygpO1xuXHRjb25zdCBzcGFjZVdpZHRoID0gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZm9udEluZm8pLnNwYWNlV2lkdGg7XG5cdGNvbnN0IHRhYldpZHRoID0gbnVtU3BhY2VzSW5UYWIgKiBzcGFjZVdpZHRoO1xuXG5cdGNvbnN0IGxlZnRXaGl0ZXNwYWNlUHggPSBnZXRMZW5ndGhPZlRleHRQeCh7XG5cdFx0dGFiV2lkdGgsXG5cdFx0c3BhY2VXaWR0aCxcblx0XHRjb250ZW50OiBsZWFkaW5nV2hpdGVzcGFjZVxuXHR9KTtcblxuXG5cdHJldHVybiBsZWZ0V2hpdGVzcGFjZVB4O1xufTtcblxuXG4vLyBIZWxwZXIgZnVuY3Rpb24gdG8gcmVtb3ZlIHdoaXRlc3BhY2UgZXhjZXB0IG5ld2xpbmVzXG5jb25zdCByZW1vdmVXaGl0ZXNwYWNlRXhjZXB0TmV3bGluZXMgPSAoc3RyOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuXHRyZXR1cm4gc3RyLnJlcGxhY2UoL1teXFxTXFxuXSsvZywgJycpO1xufVxuXG5cblxuLy8gZmluZHMgYmxvY2sub3JpZyBpbiBmaWxlQ29udGVudHMgYW5kIHJldHVybiBpdHMgcmFuZ2UgaW4gZmlsZVxuLy8gc3RhcnRpbmdBdExpbmUgaXMgMS1pbmRleGVkIGFuZCBpbmNsdXNpdmVcbi8vIHJldHVybnMgMS1pbmRleGVkIGxpbmVzXG5jb25zdCBmaW5kVGV4dEluQ29kZSA9ICh0ZXh0OiBzdHJpbmcsIGZpbGVDb250ZW50czogc3RyaW5nLCBjYW5GYWxsYmFja1RvUmVtb3ZlV2hpdGVzcGFjZTogYm9vbGVhbiwgb3B0czogeyBzdGFydGluZ0F0TGluZT86IG51bWJlciwgcmV0dXJuVHlwZTogJ2xpbmVzJyB9KSA9PiB7XG5cblx0Y29uc3QgcmV0dXJuQW5zID0gKGZpbGVDb250ZW50czogc3RyaW5nLCBpZHg6IG51bWJlcikgPT4ge1xuXHRcdGNvbnN0IHN0YXJ0TGluZSA9IG51bUxpbmVzT2ZTdHIoZmlsZUNvbnRlbnRzLnN1YnN0cmluZygwLCBpZHggKyAxKSlcblx0XHRjb25zdCBudW1MaW5lcyA9IG51bUxpbmVzT2ZTdHIodGV4dClcblx0XHRjb25zdCBlbmRMaW5lID0gc3RhcnRMaW5lICsgbnVtTGluZXMgLSAxXG5cblx0XHRyZXR1cm4gW3N0YXJ0TGluZSwgZW5kTGluZV0gYXMgY29uc3Rcblx0fVxuXG5cdGNvbnN0IHN0YXJ0aW5nQXRMaW5lSWR4ID0gKGZpbGVDb250ZW50czogc3RyaW5nKSA9PiBvcHRzPy5zdGFydGluZ0F0TGluZSAhPT0gdW5kZWZpbmVkID9cblx0XHRmaWxlQ29udGVudHMuc3BsaXQoJ1xcbicpLnNsaWNlKDAsIG9wdHMuc3RhcnRpbmdBdExpbmUpLmpvaW4oJ1xcbicpLmxlbmd0aCAvLyBudW0gY2hhcmFjdGVycyBpbiBhbGwgbGluZXMgYmVmb3JlIHN0YXJ0aW5nQXRMaW5lXG5cdFx0OiAwXG5cblx0Ly8gaWR4ID0gc3RhcnRpbmcgaW5kZXggaW4gZmlsZUNvbnRlbnRzXG5cdGxldCBpZHggPSBmaWxlQ29udGVudHMuaW5kZXhPZih0ZXh0LCBzdGFydGluZ0F0TGluZUlkeChmaWxlQ29udGVudHMpKVxuXG5cdC8vIGlmIGlkeCB3YXMgZm91bmRcblx0aWYgKGlkeCAhPT0gLTEpIHtcblx0XHRyZXR1cm4gcmV0dXJuQW5zKGZpbGVDb250ZW50cywgaWR4KVxuXHR9XG5cblx0aWYgKCFjYW5GYWxsYmFja1RvUmVtb3ZlV2hpdGVzcGFjZSlcblx0XHRyZXR1cm4gJ05vdCBmb3VuZCcgYXMgY29uc3RcblxuXHQvLyB0cnkgdG8gZmluZCBpdCBpZ25vcmluZyBhbGwgd2hpdGVzcGFjZSB0aGlzIHRpbWVcblx0dGV4dCA9IHJlbW92ZVdoaXRlc3BhY2VFeGNlcHROZXdsaW5lcyh0ZXh0KVxuXHRmaWxlQ29udGVudHMgPSByZW1vdmVXaGl0ZXNwYWNlRXhjZXB0TmV3bGluZXMoZmlsZUNvbnRlbnRzKVxuXHRpZHggPSBmaWxlQ29udGVudHMuaW5kZXhPZih0ZXh0LCBzdGFydGluZ0F0TGluZUlkeChmaWxlQ29udGVudHMpKTtcblxuXHRpZiAoaWR4ID09PSAtMSkgcmV0dXJuICdOb3QgZm91bmQnIGFzIGNvbnN0XG5cdGNvbnN0IGxhc3RJZHggPSBmaWxlQ29udGVudHMubGFzdEluZGV4T2YodGV4dClcblx0aWYgKGxhc3RJZHggIT09IGlkeCkgcmV0dXJuICdOb3QgdW5pcXVlJyBhcyBjb25zdFxuXG5cdHJldHVybiByZXR1cm5BbnMoZmlsZUNvbnRlbnRzLCBpZHgpXG59XG5cblxuXG4vLyBsaW5lL2NvbCBpcyB0aGUgbG9jYXRpb24sIG9yaWdpbmFsQ29kZVN0YXJ0TGluZSBpcyB0aGUgc3RhcnQgbGluZSBvZiB0aGUgb3JpZ2luYWwgY29kZSBiZWluZyBkaXNwbGF5ZWRcbnR5cGUgU3RyZWFtTG9jYXRpb25NdXRhYmxlID0geyBsaW5lOiBudW1iZXIsIGNvbDogbnVtYmVyLCBhZGRlZFNwbGl0WWV0OiBib29sZWFuLCBvcmlnaW5hbENvZGVTdGFydExpbmU6IG51bWJlciB9XG5cblxuXG5jbGFzcyBFZGl0Q29kZVNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRDb2RlU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHQvLyBVUkkgPC0tPiBtb2RlbFxuXHRkaWZmQXJlYXNPZlVSSTogUmVjb3JkPHN0cmluZywgU2V0PHN0cmluZz4gfCB1bmRlZmluZWQ+ID0ge307IC8vIHVyaSAtPiBkaWZmYXJlYUlkXG5cblx0ZGlmZkFyZWFPZklkOiBSZWNvcmQ8c3RyaW5nLCBEaWZmQXJlYT4gPSB7fTsgLy8gZGlmZmFyZWFJZCAtPiBkaWZmQXJlYVxuXHRkaWZmT2ZJZDogUmVjb3JkPHN0cmluZywgRGlmZj4gPSB7fTsgLy8gZGlmZmlkIC0+IGRpZmYgKHJlZHVuZGFudCB3aXRoIGRpZmZBcmVhLl9kaWZmT2ZJZClcblxuXHQvLyBldmVudHNcblxuXHQvLyB1cmk6IGRpZmZab25lcyAgLy8gbGlzdGVuIG9uIGNoYW5nZSBkaWZmWm9uZXNcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBZGRPckRlbGV0ZURpZmZab25lcyA9IG5ldyBFbWl0dGVyPHsgdXJpOiBVUkkgfT4oKTtcblx0b25EaWRBZGRPckRlbGV0ZURpZmZab25lcyA9IHRoaXMuX29uRGlkQWRkT3JEZWxldGVEaWZmWm9uZXMuZXZlbnQ7XG5cblx0Ly8gZGlmZlpvbmU6IFt1cmldLCBkaWZmcywgaXNTdHJlYW1pbmcgIC8vIGxpc3RlbiBvbiBjaGFuZ2UgZGlmZnMsIGNoYW5nZSBzdHJlYW1pbmcgKHVyaSBpcyBjb25zdClcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VEaWZmc0luRGlmZlpvbmVOb3RTdHJlYW1pbmcgPSBuZXcgRW1pdHRlcjx7IHVyaTogVVJJLCBkaWZmYXJlYWlkOiBudW1iZXIgfT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdHJlYW1pbmdJbkRpZmZab25lID0gbmV3IEVtaXR0ZXI8eyB1cmk6IFVSSSwgZGlmZmFyZWFpZDogbnVtYmVyIH0+KCk7XG5cdG9uRGlkQ2hhbmdlRGlmZnNJbkRpZmZab25lTm90U3RyZWFtaW5nID0gdGhpcy5fb25EaWRDaGFuZ2VEaWZmc0luRGlmZlpvbmVOb3RTdHJlYW1pbmcuZXZlbnQ7XG5cdG9uRGlkQ2hhbmdlU3RyZWFtaW5nSW5EaWZmWm9uZSA9IHRoaXMuX29uRGlkQ2hhbmdlU3RyZWFtaW5nSW5EaWZmWm9uZS5ldmVudDtcblxuXHQvLyBjdHJsS1pvbmU6IFt1cmldLCBpc1N0cmVhbWluZyAgLy8gbGlzdGVuIG9uIGNoYW5nZSBzdHJlYW1pbmdcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdHJlYW1pbmdJbkN0cmxLWm9uZSA9IG5ldyBFbWl0dGVyPHsgdXJpOiBVUkk7IGRpZmZhcmVhaWQ6IG51bWJlciB9PigpO1xuXHRvbkRpZENoYW5nZVN0cmVhbWluZ0luQ3RybEtab25lID0gdGhpcy5fb25EaWRDaGFuZ2VTdHJlYW1pbmdJbkN0cmxLWm9uZS5ldmVudDtcblxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdC8vIEBJSGlzdG9yeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaGlzdG9yeVNlcnZpY2U6IElIaXN0b3J5U2VydmljZSwgLy8gaGlzdG9yeSBzZXJ2aWNlIGlzIHRoZSBoaXN0b3J5IG9mIHByZXNzaW5nIGFsdCBsZWZ0L3JpZ2h0XG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVVuZG9SZWRvU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91bmRvUmVkb1NlcnZpY2U6IElVbmRvUmVkb1NlcnZpY2UsIC8vIHVuZG9SZWRvIHNlcnZpY2UgaXMgdGhlIGhpc3Rvcnkgb2YgcHJlc3NpbmcgY3RybCt6XG5cdFx0QElMTE1NZXNzYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sbG1NZXNzYWdlU2VydmljZTogSUxMTU1lc3NhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29uc2lzdGVudEl0ZW1TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnNpc3RlbnRJdGVtU2VydmljZTogSUNvbnNpc3RlbnRJdGVtU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb25zaXN0ZW50RWRpdG9ySXRlbVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uc2lzdGVudEVkaXRvckl0ZW1TZXJ2aWNlOiBJQ29uc2lzdGVudEVkaXRvckl0ZW1TZXJ2aWNlLFxuXHRcdEBJTWV0cmljc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWV0cmljc1NlcnZpY2U6IElNZXRyaWNzU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0Ly8gQElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJVm9pZFNldHRpbmdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zZXR0aW5nc1NlcnZpY2U6IElWb2lkU2V0dGluZ3NTZXJ2aWNlLFxuXHRcdC8vIEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVZvaWRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdm9pZE1vZGVsU2VydmljZTogSVZvaWRNb2RlbFNlcnZpY2UsXG5cdFx0QElDb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZTogSUNvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gdGhpcyBmdW5jdGlvbiBpbml0aWFsaXplcyBkYXRhIHN0cnVjdHVyZXMgYW5kIGxpc3RlbnMgZm9yIGNoYW5nZXNcblx0XHRjb25zdCByZWdpc3RlcmVkTW9kZWxVUklzID0gbmV3IFNldDxzdHJpbmc+KClcblx0XHRjb25zdCBpbml0aWFsaXplTW9kZWwgPSBhc3luYyAobW9kZWw6IElUZXh0TW9kZWwpID0+IHtcblxuXHRcdFx0YXdhaXQgdGhpcy5fdm9pZE1vZGVsU2VydmljZS5pbml0aWFsaXplTW9kZWwobW9kZWwudXJpKVxuXG5cdFx0XHQvLyBkbyBub3QgYWRkIGxpc3RlbmVycyB0byB0aGUgc2FtZSBtb2RlbCB0d2ljZSAtIGltcG9ydGFudCwgb3Igd2lsbCBzZWUgZHVwbGljYXRlc1xuXHRcdFx0aWYgKHJlZ2lzdGVyZWRNb2RlbFVSSXMuaGFzKG1vZGVsLnVyaS5mc1BhdGgpKSByZXR1cm5cblx0XHRcdHJlZ2lzdGVyZWRNb2RlbFVSSXMuYWRkKG1vZGVsLnVyaS5mc1BhdGgpXG5cblx0XHRcdGlmICghKG1vZGVsLnVyaS5mc1BhdGggaW4gdGhpcy5kaWZmQXJlYXNPZlVSSSkpIHtcblx0XHRcdFx0dGhpcy5kaWZmQXJlYXNPZlVSSVttb2RlbC51cmkuZnNQYXRoXSA9IG5ldyBTZXQoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gd2hlbiB0aGUgdXNlciB0eXBlcywgcmVhbGlnbiBkaWZmIGFyZWFzIGFuZCByZS1yZW5kZXIgdGhlbVxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRcdG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudChlID0+IHtcblx0XHRcdFx0XHQvLyBpdCdzIGFzIGlmIHdlIGp1c3QgY2FsbGVkIF93cml0ZSwgbm93IGFsbCB3ZSBuZWVkIHRvIGRvIGlzIHJlYWxpZ24gYW5kIHJlZnJlc2hcblx0XHRcdFx0XHRpZiAodGhpcy53ZUFyZVdyaXRpbmcpIHJldHVyblxuXHRcdFx0XHRcdGNvbnN0IHVyaSA9IG1vZGVsLnVyaVxuXHRcdFx0XHRcdHRoaXMuX29uVXNlckNoYW5nZUNvbnRlbnQodXJpLCBlKVxuXHRcdFx0XHR9KVxuXHRcdFx0KVxuXG5cdFx0XHQvLyB3aGVuIHRoZSBtb2RlbCBmaXJzdCBtb3VudHMsIHJlZnJlc2ggYW55IGRpZmZzIHRoYXQgbWlnaHQgYmUgb24gaXQgKGhhcHBlbnMgaWYgZGlmZnMgd2VyZSBhZGRlZCBpbiB0aGUgQkcpXG5cdFx0XHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSShtb2RlbC51cmkpXG5cdFx0fVxuXHRcdC8vIGluaXRpYWxpemUgYWxsIGV4aXN0aW5nIG1vZGVscyArIGluaXRpYWxpemUgd2hlbiBhIG5ldyBtb2RlbCBtb3VudHNcblx0XHRmb3IgKGxldCBtb2RlbCBvZiB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWxzKCkpIHsgaW5pdGlhbGl6ZU1vZGVsKG1vZGVsKSB9XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbW9kZWxTZXJ2aWNlLm9uTW9kZWxBZGRlZChtb2RlbCA9PiB7IGluaXRpYWxpemVNb2RlbChtb2RlbCkgfSkpO1xuXG5cblx0XHQvLyB0aGlzIGZ1bmN0aW9uIGFkZHMgbGlzdGVuZXJzIHRvIHJlZnJlc2ggc3R5bGVzIHdoZW4gZWRpdG9yIGNoYW5nZXMgdGFiXG5cdFx0bGV0IGluaXRpYWxpemVFZGl0b3IgPSAoZWRpdG9yOiBJQ29kZUVkaXRvcikgPT4ge1xuXHRcdFx0Y29uc3QgdXJpID0gZWRpdG9yLmdldE1vZGVsKCk/LnVyaSA/PyBudWxsXG5cdFx0XHRpZiAodXJpKSB0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpXG5cdFx0fVxuXG5cdFx0Ly8gYWRkIGxpc3RlbmVycyBmb3IgYWxsIGV4aXN0aW5nIGVkaXRvcnMgKyBsaXN0ZW4gZm9yIGVkaXRvciBiZWluZyBhZGRlZFxuXHRcdGZvciAobGV0IGVkaXRvciBvZiB0aGlzLl9jb2RlRWRpdG9yU2VydmljZS5saXN0Q29kZUVkaXRvcnMoKSkgeyBpbml0aWFsaXplRWRpdG9yKGVkaXRvcikgfVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLm9uQ29kZUVkaXRvckFkZChlZGl0b3IgPT4geyBpbml0aWFsaXplRWRpdG9yKGVkaXRvcikgfSkpXG5cblxuXHR9XG5cblxuXHRwcml2YXRlIF9vblVzZXJDaGFuZ2VDb250ZW50KHVyaTogVVJJLCBlOiBJTW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50KSB7XG5cdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgZS5jaGFuZ2VzKSB7XG5cdFx0XHR0aGlzLl9yZWFsaWduQWxsRGlmZkFyZWFzTGluZXModXJpLCBjaGFuZ2UudGV4dCwgY2hhbmdlLnJhbmdlKVxuXHRcdH1cblx0XHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpXG5cblx0XHQvLyBpZiBkaWZmYXJlYSBoYXMgbm8gZGlmZnMgYWZ0ZXIgYSB1c2VyIGVkaXQsIGRlbGV0ZSBpdFxuXHRcdGNvbnN0IGRpZmZBcmVhc1RvRGVsZXRlOiBEaWZmWm9uZVtdID0gW11cblx0XHRmb3IgKGNvbnN0IGRpZmZhcmVhaWQgb2YgdGhpcy5kaWZmQXJlYXNPZlVSSVt1cmkuZnNQYXRoXSA/PyBbXSkge1xuXHRcdFx0Y29uc3QgZGlmZkFyZWEgPSB0aGlzLmRpZmZBcmVhT2ZJZFtkaWZmYXJlYWlkXSA/PyBudWxsXG5cdFx0XHRjb25zdCBzaG91bGREZWxldGUgPSBkaWZmQXJlYT8udHlwZSA9PT0gJ0RpZmZab25lJyAmJiBPYmplY3Qua2V5cyhkaWZmQXJlYS5fZGlmZk9mSWQpLmxlbmd0aCA9PT0gMFxuXHRcdFx0aWYgKHNob3VsZERlbGV0ZSkge1xuXHRcdFx0XHRkaWZmQXJlYXNUb0RlbGV0ZS5wdXNoKGRpZmZBcmVhKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoZGlmZkFyZWFzVG9EZWxldGUubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRjb25zdCB7IG9uRmluaXNoRWRpdCB9ID0gdGhpcy5fYWRkVG9IaXN0b3J5KHVyaSlcblx0XHRcdGRpZmZBcmVhc1RvRGVsZXRlLmZvckVhY2goZGEgPT4gdGhpcy5fZGVsZXRlRGlmZlpvbmUoZGEpKVxuXHRcdFx0b25GaW5pc2hFZGl0KClcblx0XHR9XG5cblx0fVxuXG5cblx0cHVibGljIHByb2Nlc3NSYXdLZXliaW5kaW5nVGV4dChrZXliaW5kaW5nU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiBrZXliaW5kaW5nU3RyXG5cdFx0XHQucmVwbGFjZSgvRW50ZXIvZywgJ1x1MjFCNScpIC8vIFx1MjNDRVxuXHRcdFx0LnJlcGxhY2UoL0JhY2tzcGFjZS9nLCAnXHUyMzJCJyk7XG5cdH1cblxuXHQvLyBwcml2YXRlIF9ub3RpZnlFcnJvciA9IChlOiBQYXJhbWV0ZXJzPE9uRXJyb3I+WzBdKSA9PiB7XG5cdC8vIFx0Y29uc3QgZGV0YWlscyA9IGVycm9yRGV0YWlscyhlLmZ1bGxFcnJvcilcblx0Ly8gXHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdC8vIFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyxcblx0Ly8gXHRcdG1lc3NhZ2U6IGBWb2lkIEVycm9yOiAke2UubWVzc2FnZX1gLFxuXHQvLyBcdFx0YWN0aW9uczoge1xuXHQvLyBcdFx0XHRzZWNvbmRhcnk6IFt7XG5cdC8vIFx0XHRcdFx0aWQ6ICd2b2lkLm9uZXJyb3Iub3BlbnNldHRpbmdzJyxcblx0Ly8gXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHQvLyBcdFx0XHRcdGxhYmVsOiBgT3BlbiBWb2lkJ3Mgc2V0dGluZ3NgLFxuXHQvLyBcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHQvLyBcdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdC8vIFx0XHRcdFx0cnVuOiAoKSA9PiB7IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFZPSURfT1BFTl9TRVRUSU5HU19BQ1RJT05fSUQpIH1cblx0Ly8gXHRcdFx0fV1cblx0Ly8gXHRcdH0sXG5cdC8vIFx0XHRzb3VyY2U6IGRldGFpbHMgPyBgKEhvbGQgJHtpc01hY2ludG9zaCA/ICdPcHRpb24nIDogJ0FsdCd9IHRvIGhvdmVyKSAtICR7ZGV0YWlsc31cXG5cXG5JZiB0aGlzIHBlcnNpc3RzLCBmZWVsIGZyZWUgdG8gW3JlcG9ydF0oaHR0cHM6Ly9naXRodWIuY29tL3ZvaWRlZGl0b3Ivdm9pZC9pc3N1ZXMvbmV3KSBpdC5gIDogdW5kZWZpbmVkXG5cdC8vIFx0fSlcblx0Ly8gfVxuXG5cblxuXHQvLyBoaWdobGlnaHQgdGhlIHJlZ2lvblxuXHRwcml2YXRlIF9hZGRMaW5lRGVjb3JhdGlvbiA9IChtb2RlbDogSVRleHRNb2RlbCB8IG51bGwsIHN0YXJ0TGluZTogbnVtYmVyLCBlbmRMaW5lOiBudW1iZXIsIGNsYXNzTmFtZTogc3RyaW5nLCBvcHRpb25zPzogUGFydGlhbDxJTW9kZWxEZWNvcmF0aW9uT3B0aW9ucz4pID0+IHtcblx0XHRpZiAobW9kZWwgPT09IG51bGwpIHJldHVyblxuXHRcdGNvbnN0IGlkID0gbW9kZWwuY2hhbmdlRGVjb3JhdGlvbnMoYWNjZXNzb3IgPT4gYWNjZXNzb3IuYWRkRGVjb3JhdGlvbihcblx0XHRcdHsgc3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmUsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiBlbmRMaW5lLCBlbmRDb2x1bW46IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSIH0sXG5cdFx0XHR7XG5cdFx0XHRcdGNsYXNzTmFtZTogY2xhc3NOYW1lLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogY2xhc3NOYW1lLFxuXHRcdFx0XHRpc1dob2xlTGluZTogdHJ1ZSxcblx0XHRcdFx0Li4ub3B0aW9uc1xuXHRcdFx0fSkpXG5cdFx0Y29uc3QgZGlzcG9zZUhpZ2hsaWdodCA9ICgpID0+IHtcblx0XHRcdGlmIChpZCAmJiAhbW9kZWwuaXNEaXNwb3NlZCgpKSBtb2RlbC5jaGFuZ2VEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiBhY2Nlc3Nvci5yZW1vdmVEZWNvcmF0aW9uKGlkKSlcblx0XHR9XG5cdFx0cmV0dXJuIGRpc3Bvc2VIaWdobGlnaHRcblx0fVxuXG5cblx0cHJpdmF0ZSBfYWRkRGlmZkFyZWFTdHlsZXNUb1VSSSA9ICh1cmk6IFVSSSkgPT4ge1xuXHRcdGNvbnN0IHsgbW9kZWwgfSA9IHRoaXMuX3ZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWwodXJpKVxuXG5cdFx0Zm9yIChjb25zdCBkaWZmYXJlYWlkIG9mIHRoaXMuZGlmZkFyZWFzT2ZVUklbdXJpLmZzUGF0aF0gfHwgW10pIHtcblx0XHRcdGNvbnN0IGRpZmZBcmVhID0gdGhpcy5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF1cblxuXHRcdFx0aWYgKGRpZmZBcmVhLnR5cGUgPT09ICdEaWZmWm9uZScpIHtcblx0XHRcdFx0Ly8gYWRkIHN3ZWVwIHN0eWxlcyB0byB0aGUgZGlmZlpvbmVcblx0XHRcdFx0aWYgKGRpZmZBcmVhLl9zdHJlYW1TdGF0ZS5pc1N0cmVhbWluZykge1xuXHRcdFx0XHRcdC8vIHN3ZWVwTGluZSAuLi4gc3dlZXBMaW5lXG5cdFx0XHRcdFx0Y29uc3QgZm4xID0gdGhpcy5fYWRkTGluZURlY29yYXRpb24obW9kZWwsIGRpZmZBcmVhLl9zdHJlYW1TdGF0ZS5saW5lLCBkaWZmQXJlYS5fc3RyZWFtU3RhdGUubGluZSwgJ3ZvaWQtc3dlZXBJZHhCRycpXG5cdFx0XHRcdFx0Ly8gc3dlZXBMaW5lKzEgLi4uIGVuZExpbmVcblx0XHRcdFx0XHRjb25zdCBmbjIgPSBkaWZmQXJlYS5fc3RyZWFtU3RhdGUubGluZSArIDEgPD0gZGlmZkFyZWEuZW5kTGluZSA/XG5cdFx0XHRcdFx0XHR0aGlzLl9hZGRMaW5lRGVjb3JhdGlvbihtb2RlbCwgZGlmZkFyZWEuX3N0cmVhbVN0YXRlLmxpbmUgKyAxLCBkaWZmQXJlYS5lbmRMaW5lLCAndm9pZC1zd2VlcEJHJylcblx0XHRcdFx0XHRcdDogbnVsbFxuXHRcdFx0XHRcdGRpZmZBcmVhLl9yZW1vdmVTdHlsZXNGbnMuYWRkKCgpID0+IHsgZm4xPy4oKTsgZm4yPy4oKTsgfSlcblxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGVsc2UgaWYgKGRpZmZBcmVhLnR5cGUgPT09ICdDdHJsS1pvbmUnICYmIGRpZmZBcmVhLl9saW5rZWRTdHJlYW1pbmdEaWZmWm9uZSA9PT0gbnVsbCkge1xuXHRcdFx0XHQvLyBoaWdobGlnaHQgem9uZSdzIHRleHRcblx0XHRcdFx0Y29uc3QgZm4gPSB0aGlzLl9hZGRMaW5lRGVjb3JhdGlvbihtb2RlbCwgZGlmZkFyZWEuc3RhcnRMaW5lLCBkaWZmQXJlYS5lbmRMaW5lLCAndm9pZC1oaWdobGlnaHRCRycpXG5cdFx0XHRcdGRpZmZBcmVhLl9yZW1vdmVTdHlsZXNGbnMuYWRkKCgpID0+IGZuPy4oKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblxuXHRwcml2YXRlIF9jb21wdXRlRGlmZnNBbmRBZGRTdHlsZXNUb1VSSSA9ICh1cmk6IFVSSSkgPT4ge1xuXHRcdGNvbnN0IHsgbW9kZWwgfSA9IHRoaXMuX3ZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWwodXJpKVxuXHRcdGlmIChtb2RlbCA9PT0gbnVsbCkgcmV0dXJuXG5cdFx0Y29uc3QgZnVsbEZpbGVUZXh0ID0gbW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRilcblxuXHRcdGZvciAoY29uc3QgZGlmZmFyZWFpZCBvZiB0aGlzLmRpZmZBcmVhc09mVVJJW3VyaS5mc1BhdGhdIHx8IFtdKSB7XG5cdFx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0XHRpZiAoZGlmZkFyZWEudHlwZSAhPT0gJ0RpZmZab25lJykgY29udGludWVcblxuXHRcdFx0Y29uc3QgbmV3RGlmZkFyZWFDb2RlID0gZnVsbEZpbGVUZXh0LnNwbGl0KCdcXG4nKS5zbGljZSgoZGlmZkFyZWEuc3RhcnRMaW5lIC0gMSksIChkaWZmQXJlYS5lbmRMaW5lIC0gMSkgKyAxKS5qb2luKCdcXG4nKVxuXHRcdFx0Y29uc3QgY29tcHV0ZWREaWZmcyA9IGZpbmREaWZmcyhkaWZmQXJlYS5vcmlnaW5hbENvZGUsIG5ld0RpZmZBcmVhQ29kZSlcblx0XHRcdGZvciAobGV0IGNvbXB1dGVkRGlmZiBvZiBjb21wdXRlZERpZmZzKSB7XG5cdFx0XHRcdGlmIChjb21wdXRlZERpZmYudHlwZSA9PT0gJ2RlbGV0aW9uJykge1xuXHRcdFx0XHRcdGNvbXB1dGVkRGlmZi5zdGFydExpbmUgKz0gZGlmZkFyZWEuc3RhcnRMaW5lIC0gMVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChjb21wdXRlZERpZmYudHlwZSA9PT0gJ2VkaXQnIHx8IGNvbXB1dGVkRGlmZi50eXBlID09PSAnaW5zZXJ0aW9uJykge1xuXHRcdFx0XHRcdGNvbXB1dGVkRGlmZi5zdGFydExpbmUgKz0gZGlmZkFyZWEuc3RhcnRMaW5lIC0gMVxuXHRcdFx0XHRcdGNvbXB1dGVkRGlmZi5lbmRMaW5lICs9IGRpZmZBcmVhLnN0YXJ0TGluZSAtIDFcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9hZGREaWZmKGNvbXB1dGVkRGlmZiwgZGlmZkFyZWEpXG5cdFx0XHR9XG5cblx0XHR9XG5cdH1cblxuXG5cblx0bW9zdFJlY2VudFRleHRPZkN0cmxLWm9uZUlkOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCB1bmRlZmluZWQ+ID0ge31cblx0cHJpdmF0ZSBfYWRkQ3RybEtab25lSW5wdXQgPSAoY3RybEtab25lOiBDdHJsS1pvbmUpID0+IHtcblxuXHRcdGNvbnN0IHsgZWRpdG9ySWQgfSA9IGN0cmxLWm9uZVxuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLmxpc3RDb2RlRWRpdG9ycygpLmZpbmQoZSA9PiBlLmdldElkKCkgPT09IGVkaXRvcklkKVxuXHRcdGlmICghZWRpdG9yKSB7IHJldHVybiBudWxsIH1cblxuXHRcdGxldCB6b25lSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsXG5cdFx0bGV0IHZpZXdab25lXzogSVZpZXdab25lIHwgbnVsbCA9IG51bGxcblx0XHRjb25zdCB0ZXh0QXJlYVJlZjogeyBjdXJyZW50OiBIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbCB9ID0geyBjdXJyZW50OiBudWxsIH1cblxuXG5cdFx0Y29uc3QgcGFkZGluZ0xlZnQgPSBnZXRMZWFkaW5nV2hpdGVzcGFjZVB4KGVkaXRvciwgY3RybEtab25lLnN0YXJ0TGluZSlcblxuXHRcdGNvbnN0IGl0ZW1JZCA9IHRoaXMuX2NvbnNpc3RlbnRFZGl0b3JJdGVtU2VydmljZS5hZGRUb0VkaXRvcihlZGl0b3IsICgpID0+IHtcblx0XHRcdGNvbnN0IGRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRvbU5vZGUuc3R5bGUuekluZGV4ID0gJzEnXG5cdFx0XHRkb21Ob2RlLnN0eWxlLmhlaWdodCA9ICdhdXRvJ1xuXHRcdFx0ZG9tTm9kZS5zdHlsZS5wYWRkaW5nTGVmdCA9IGAke3BhZGRpbmdMZWZ0fXB4YFxuXHRcdFx0Y29uc3Qgdmlld1pvbmU6IElWaWV3Wm9uZSA9IHtcblx0XHRcdFx0YWZ0ZXJMaW5lTnVtYmVyOiBjdHJsS1pvbmUuc3RhcnRMaW5lIC0gMSxcblx0XHRcdFx0ZG9tTm9kZTogZG9tTm9kZSxcblx0XHRcdFx0Ly8gaGVpZ2h0SW5QeDogODAsXG5cdFx0XHRcdHN1cHByZXNzTW91c2VEb3duOiBmYWxzZSxcblx0XHRcdFx0c2hvd0luSGlkZGVuQXJlYXM6IHRydWUsXG5cdFx0XHR9O1xuXHRcdFx0dmlld1pvbmVfID0gdmlld1pvbmVcblxuXHRcdFx0Ly8gbW91bnQgem9uZVxuXHRcdFx0ZWRpdG9yLmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdHpvbmVJZCA9IGFjY2Vzc29yLmFkZFpvbmUodmlld1pvbmUpXG5cdFx0XHR9KVxuXG5cdFx0XHQvLyBtb3VudCByZWFjdFxuXHRcdFx0bGV0IGRpc3Bvc2VGbjogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkXG5cdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdGRpc3Bvc2VGbiA9IG1vdW50Q3RybEsoZG9tTm9kZSwgYWNjZXNzb3IsIHtcblxuXHRcdFx0XHRcdGRpZmZhcmVhaWQ6IGN0cmxLWm9uZS5kaWZmYXJlYWlkLFxuXG5cdFx0XHRcdFx0dGV4dEFyZWFSZWY6IChyKSA9PiB7XG5cdFx0XHRcdFx0XHR0ZXh0QXJlYVJlZi5jdXJyZW50ID0gclxuXHRcdFx0XHRcdFx0aWYgKCF0ZXh0QXJlYVJlZi5jdXJyZW50KSByZXR1cm5cblxuXHRcdFx0XHRcdFx0aWYgKCEoY3RybEtab25lLmRpZmZhcmVhaWQgaW4gdGhpcy5tb3N0UmVjZW50VGV4dE9mQ3RybEtab25lSWQpKSB7IC8vIGRldGVjdCBmaXJzdCBtb3VudCB0aGlzIHdheSAoYSBoYWNrKVxuXHRcdFx0XHRcdFx0XHR0aGlzLm1vc3RSZWNlbnRUZXh0T2ZDdHJsS1pvbmVJZFtjdHJsS1pvbmUuZGlmZmFyZWFpZF0gPSB1bmRlZmluZWRcblx0XHRcdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB0ZXh0QXJlYVJlZi5jdXJyZW50Py5mb2N1cygpLCAxMDApXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvbkNoYW5nZUhlaWdodChoZWlnaHQpIHtcblx0XHRcdFx0XHRcdGlmIChoZWlnaHQgPT09IDApIHJldHVybiAvLyB0aGUgdmlld1pvbmUgc2V0cyB0aGlzIGhlaWdodCB0byB0aGUgY29udGFpbmVyIGlmIGl0J3Mgb3V0IG9mIHZpZXcsIGlnbm9yZSBpdFxuXHRcdFx0XHRcdFx0dmlld1pvbmUuaGVpZ2h0SW5QeCA9IGhlaWdodFxuXHRcdFx0XHRcdFx0Ly8gcmUtcmVuZGVyIHdpdGggdGhpcyBuZXcgaGVpZ2h0XG5cdFx0XHRcdFx0XHRlZGl0b3IuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKHpvbmVJZCkgYWNjZXNzb3IubGF5b3V0Wm9uZSh6b25lSWQpXG5cdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b25DaGFuZ2VUZXh0OiAodGV4dCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5tb3N0UmVjZW50VGV4dE9mQ3RybEtab25lSWRbY3RybEtab25lLmRpZmZhcmVhaWRdID0gdGV4dDtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGluaXRUZXh0OiB0aGlzLm1vc3RSZWNlbnRUZXh0T2ZDdHJsS1pvbmVJZFtjdHJsS1pvbmUuZGlmZmFyZWFpZF0gPz8gbnVsbCxcblx0XHRcdFx0fSBzYXRpc2ZpZXMgUXVpY2tFZGl0UHJvcHNUeXBlKT8uZGlzcG9zZVxuXHRcdFx0fSlcblxuXHRcdFx0Ly8gY2xlYW51cFxuXHRcdFx0cmV0dXJuICgpID0+IHtcblx0XHRcdFx0ZWRpdG9yLmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7IGlmICh6b25lSWQpIGFjY2Vzc29yLnJlbW92ZVpvbmUoem9uZUlkKSB9KVxuXHRcdFx0XHRkaXNwb3NlRm4/LigpXG5cdFx0XHR9XG5cdFx0fSlcblxuXHRcdHJldHVybiB7XG5cdFx0XHR0ZXh0QXJlYVJlZixcblx0XHRcdHJlZnJlc2g6ICgpID0+IGVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRpZiAoem9uZUlkICYmIHZpZXdab25lXykge1xuXHRcdFx0XHRcdHZpZXdab25lXy5hZnRlckxpbmVOdW1iZXIgPSBjdHJsS1pvbmUuc3RhcnRMaW5lIC0gMVxuXHRcdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUoem9uZUlkKVxuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5fY29uc2lzdGVudEVkaXRvckl0ZW1TZXJ2aWNlLnJlbW92ZUZyb21FZGl0b3IoaXRlbUlkKVxuXHRcdFx0fSxcblx0XHR9IHNhdGlzZmllcyBDdHJsS1pvbmVbJ19tb3VudEluZm8nXVxuXHR9XG5cblxuXG5cdHByaXZhdGUgX3JlZnJlc2hDdHJsS0lucHV0cyA9IGFzeW5jICh1cmk6IFVSSSkgPT4ge1xuXHRcdGZvciAoY29uc3QgZGlmZmFyZWFpZCBvZiB0aGlzLmRpZmZBcmVhc09mVVJJW3VyaS5mc1BhdGhdIHx8IFtdKSB7XG5cdFx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0XHRpZiAoZGlmZkFyZWEudHlwZSAhPT0gJ0N0cmxLWm9uZScpIGNvbnRpbnVlXG5cdFx0XHRpZiAoIWRpZmZBcmVhLl9tb3VudEluZm8pIHtcblx0XHRcdFx0ZGlmZkFyZWEuX21vdW50SW5mbyA9IHRoaXMuX2FkZEN0cmxLWm9uZUlucHV0KGRpZmZBcmVhKVxuXHRcdFx0XHRjb25zb2xlLmxvZygnTU9VTlRFRCBDVFJMSycsIGRpZmZBcmVhLmRpZmZhcmVhaWQpXG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0ZGlmZkFyZWEuX21vdW50SW5mby5yZWZyZXNoKClcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXG5cdHByaXZhdGUgX2FkZERpZmZTdHlsZXNUb1VSSSA9ICh1cmk6IFVSSSwgZGlmZjogRGlmZikgPT4ge1xuXHRcdGNvbnN0IHsgdHlwZSwgZGlmZmlkIH0gPSBkaWZmXG5cblx0XHRjb25zdCBkaXNwb3NlSW5UaGlzRWRpdG9yRm5zOiAoKCkgPT4gdm9pZClbXSA9IFtdXG5cblx0XHRjb25zdCB7IG1vZGVsIH0gPSB0aGlzLl92b2lkTW9kZWxTZXJ2aWNlLmdldE1vZGVsKHVyaSlcblxuXHRcdC8vIGdyZWVuIGRlY29yYXRpb24gYW5kIG1pbmltYXAgZGVjb3JhdGlvblxuXHRcdGlmICh0eXBlICE9PSAnZGVsZXRpb24nKSB7XG5cdFx0XHRjb25zdCBmbiA9IHRoaXMuX2FkZExpbmVEZWNvcmF0aW9uKG1vZGVsLCBkaWZmLnN0YXJ0TGluZSwgZGlmZi5lbmRMaW5lLCAndm9pZC1ncmVlbkJHJywge1xuXHRcdFx0XHRtaW5pbWFwOiB7IGNvbG9yOiB7IGlkOiAnbWluaW1hcEd1dHRlci5hZGRlZEJhY2tncm91bmQnIH0sIHBvc2l0aW9uOiAyIH0sXG5cdFx0XHRcdG92ZXJ2aWV3UnVsZXI6IHsgY29sb3I6IHsgaWQ6ICdlZGl0b3JPdmVydmlld1J1bGVyLmFkZGVkRm9yZWdyb3VuZCcgfSwgcG9zaXRpb246IDcgfVxuXHRcdFx0fSlcblx0XHRcdGRpc3Bvc2VJblRoaXNFZGl0b3JGbnMucHVzaCgoKSA9PiB7IGZuPy4oKSB9KVxuXHRcdH1cblxuXG5cdFx0Ly8gcmVkIGluIGEgdmlldyB6b25lXG5cdFx0aWYgKHR5cGUgIT09ICdpbnNlcnRpb24nKSB7XG5cdFx0XHRjb25zdCBjb25zaXN0ZW50Wm9uZUlkID0gdGhpcy5fY29uc2lzdGVudEl0ZW1TZXJ2aWNlLmFkZENvbnNpc3RlbnRJdGVtVG9VUkkoe1xuXHRcdFx0XHR1cmksXG5cdFx0XHRcdGZuOiAoZWRpdG9yKSA9PiB7XG5cblx0XHRcdFx0XHRjb25zdCBkb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0ZG9tTm9kZS5jbGFzc05hbWUgPSAndm9pZC1yZWRCRydcblxuXHRcdFx0XHRcdGNvbnN0IHJlbmRlck9wdGlvbnMgPSBSZW5kZXJPcHRpb25zLmZyb21FZGl0b3IoZWRpdG9yKVxuXG5cdFx0XHRcdFx0Y29uc3QgcHJvY2Vzc2VkVGV4dCA9IGRpZmYub3JpZ2luYWxDb2RlLnJlcGxhY2UoL1xcdC9nLCAnICcucmVwZWF0KHJlbmRlck9wdGlvbnMudGFiU2l6ZSkpO1xuXG5cdFx0XHRcdFx0Y29uc3QgbGluZXMgPSBwcm9jZXNzZWRUZXh0LnNwbGl0KCdcXG4nKTtcblxuXHRcdFx0XHRcdGNvbnN0IGxpbmVzQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0bGluZXNDb250YWluZXIuc3R5bGUuZm9udEZhbWlseSA9IHJlbmRlck9wdGlvbnMuZm9udEluZm8uZm9udEZhbWlseVxuXHRcdFx0XHRcdGxpbmVzQ29udGFpbmVyLnN0eWxlLmZvbnRTaXplID0gYCR7cmVuZGVyT3B0aW9ucy5mb250SW5mby5mb250U2l6ZX1weGBcblx0XHRcdFx0XHRsaW5lc0NvbnRhaW5lci5zdHlsZS5saW5lSGVpZ2h0ID0gYCR7cmVuZGVyT3B0aW9ucy5mb250SW5mby5saW5lSGVpZ2h0fXB4YFxuXHRcdFx0XHRcdC8vIGxpbmVzQ29udGFpbmVyLnN0eWxlLnRhYlNpemUgPSBgJHt0YWJXaWR0aH1weGAgLy8gXFx0XG5cdFx0XHRcdFx0bGluZXNDb250YWluZXIuc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUnXG5cdFx0XHRcdFx0bGluZXNDb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnXG5cdFx0XHRcdFx0bGluZXNDb250YWluZXIuc3R5bGUud2lkdGggPSAnMTAwJSdcblxuXHRcdFx0XHRcdGxpbmVzLmZvckVhY2gobGluZSA9PiB7XG5cdFx0XHRcdFx0XHQvLyBkaXYgZm9yIGN1cnJlbnQgbGluZVxuXHRcdFx0XHRcdFx0Y29uc3QgbGluZURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRcdFx0bGluZURpdi5jbGFzc05hbWUgPSAndmlldy1saW5lJztcblx0XHRcdFx0XHRcdGxpbmVEaXYuc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUnXG5cdFx0XHRcdFx0XHRsaW5lRGl2LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJ1xuXHRcdFx0XHRcdFx0bGluZURpdi5zdHlsZS5oZWlnaHQgPSBgJHtyZW5kZXJPcHRpb25zLmZvbnRJbmZvLmxpbmVIZWlnaHR9cHhgXG5cblx0XHRcdFx0XHRcdC8vIHNwYW4gKHRoaXMgaXMganVzdCBob3cgdnNjb2RlIGRvZXMgaXQpXG5cdFx0XHRcdFx0XHRjb25zdCBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdFx0XHRcdFx0c3Bhbi50ZXh0Q29udGVudCA9IGxpbmUgfHwgJ1xcdTAwYTAnO1xuXHRcdFx0XHRcdFx0c3Bhbi5zdHlsZS53aGl0ZVNwYWNlID0gJ3ByZSdcblx0XHRcdFx0XHRcdHNwYW4uc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snXG5cblx0XHRcdFx0XHRcdGxpbmVEaXYuYXBwZW5kQ2hpbGQoc3Bhbik7XG5cdFx0XHRcdFx0XHRsaW5lc0NvbnRhaW5lci5hcHBlbmRDaGlsZChsaW5lRGl2KTtcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGRvbU5vZGUuYXBwZW5kQ2hpbGQobGluZXNDb250YWluZXIpO1xuXG5cdFx0XHRcdFx0Ly8gQ2FsY3VsYXRlIGhlaWdodCBiYXNlZCBvbiBudW1iZXIgb2YgbGluZXMgYW5kIGxpbmUgaGVpZ2h0XG5cdFx0XHRcdFx0Y29uc3QgaGVpZ2h0SW5MaW5lcyA9IGxpbmVzLmxlbmd0aDtcblx0XHRcdFx0XHRjb25zdCBtaW5XaWR0aEluUHggPSBNYXRoLm1heCguLi5saW5lcy5tYXAobGluZSA9PlxuXHRcdFx0XHRcdFx0TWF0aC5jZWlsKHJlbmRlck9wdGlvbnMuZm9udEluZm8udHlwaWNhbEZ1bGx3aWR0aENoYXJhY3RlcldpZHRoICogbGluZS5sZW5ndGgpXG5cdFx0XHRcdFx0KSk7XG5cblx0XHRcdFx0XHRjb25zdCB2aWV3Wm9uZTogSVZpZXdab25lID0ge1xuXHRcdFx0XHRcdFx0YWZ0ZXJMaW5lTnVtYmVyOiBkaWZmLnN0YXJ0TGluZSAtIDEsXG5cdFx0XHRcdFx0XHRoZWlnaHRJbkxpbmVzLFxuXHRcdFx0XHRcdFx0bWluV2lkdGhJblB4LFxuXHRcdFx0XHRcdFx0ZG9tTm9kZSxcblx0XHRcdFx0XHRcdG1hcmdpbkRvbU5vZGU6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuXHRcdFx0XHRcdFx0c3VwcHJlc3NNb3VzZURvd246IGZhbHNlLFxuXHRcdFx0XHRcdFx0c2hvd0luSGlkZGVuQXJlYXM6IGZhbHNlLFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRsZXQgem9uZUlkOiBzdHJpbmcgfCBudWxsID0gbnVsbFxuXHRcdFx0XHRcdGVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4geyB6b25lSWQgPSBhY2Nlc3Nvci5hZGRab25lKHZpZXdab25lKSB9KVxuXHRcdFx0XHRcdHJldHVybiAoKSA9PiBlZGl0b3IuY2hhbmdlVmlld1pvbmVzKGFjY2Vzc29yID0+IHsgaWYgKHpvbmVJZCkgYWNjZXNzb3IucmVtb3ZlWm9uZSh6b25lSWQpIH0pXG5cdFx0XHRcdH0sXG5cdFx0XHR9KVxuXG5cdFx0XHRkaXNwb3NlSW5UaGlzRWRpdG9yRm5zLnB1c2goKCkgPT4geyB0aGlzLl9jb25zaXN0ZW50SXRlbVNlcnZpY2UucmVtb3ZlQ29uc2lzdGVudEl0ZW1Gcm9tVVJJKGNvbnNpc3RlbnRab25lSWQpIH0pXG5cblx0XHR9XG5cblxuXG5cdFx0Y29uc3QgZGlmZlpvbmUgPSB0aGlzLmRpZmZBcmVhT2ZJZFtkaWZmLmRpZmZhcmVhaWRdXG5cdFx0aWYgKGRpZmZab25lLnR5cGUgPT09ICdEaWZmWm9uZScgJiYgIWRpZmZab25lLl9zdHJlYW1TdGF0ZS5pc1N0cmVhbWluZykge1xuXHRcdFx0Ly8gQWNjZXB0IHwgUmVqZWN0IHdpZGdldFxuXHRcdFx0Y29uc3QgY29uc2lzdGVudFdpZGdldElkID0gdGhpcy5fY29uc2lzdGVudEl0ZW1TZXJ2aWNlLmFkZENvbnNpc3RlbnRJdGVtVG9VUkkoe1xuXHRcdFx0XHR1cmksXG5cdFx0XHRcdGZuOiAoZWRpdG9yKSA9PiB7XG5cdFx0XHRcdFx0bGV0IHN0YXJ0TGluZTogbnVtYmVyXG5cdFx0XHRcdFx0bGV0IG9mZnNldExpbmVzOiBudW1iZXJcblx0XHRcdFx0XHRpZiAoZGlmZi50eXBlID09PSAnaW5zZXJ0aW9uJyB8fCBkaWZmLnR5cGUgPT09ICdlZGl0Jykge1xuXHRcdFx0XHRcdFx0c3RhcnRMaW5lID0gZGlmZi5zdGFydExpbmUgLy8gZ3JlZW4gc3RhcnRcblx0XHRcdFx0XHRcdG9mZnNldExpbmVzID0gMFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChkaWZmLnR5cGUgPT09ICdkZWxldGlvbicpIHtcblx0XHRcdFx0XHRcdC8vIGlmIGRpZmYuc3RhcnRMaW5lIGlzIG91dCBvZiBib3VuZHNcblx0XHRcdFx0XHRcdGlmIChkaWZmLnN0YXJ0TGluZSA9PT0gMSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBudW1SZWRMaW5lcyA9IGRpZmYub3JpZ2luYWxFbmRMaW5lIC0gZGlmZi5vcmlnaW5hbFN0YXJ0TGluZSArIDFcblx0XHRcdFx0XHRcdFx0c3RhcnRMaW5lID0gZGlmZi5zdGFydExpbmVcblx0XHRcdFx0XHRcdFx0b2Zmc2V0TGluZXMgPSAtbnVtUmVkTGluZXNcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRzdGFydExpbmUgPSBkaWZmLnN0YXJ0TGluZSAtIDFcblx0XHRcdFx0XHRcdFx0b2Zmc2V0TGluZXMgPSAxXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgeyB0aHJvdyBuZXcgRXJyb3IoJ1ZvaWQgMScpIH1cblxuXHRcdFx0XHRcdGNvbnN0IGJ1dHRvbnNXaWRnZXQgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShBY2NlcHRSZWplY3RJbmxpbmVXaWRnZXQsIHtcblx0XHRcdFx0XHRcdGVkaXRvcixcblx0XHRcdFx0XHRcdG9uQWNjZXB0OiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuYWNjZXB0RGlmZih7IGRpZmZpZCB9KVxuXHRcdFx0XHRcdFx0XHR0aGlzLl9tZXRyaWNzU2VydmljZS5jYXB0dXJlKCdBY2NlcHQgRGlmZicsIHsgZGlmZmlkIH0pXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0b25SZWplY3Q6ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5yZWplY3REaWZmKHsgZGlmZmlkIH0pXG5cdFx0XHRcdFx0XHRcdHRoaXMuX21ldHJpY3NTZXJ2aWNlLmNhcHR1cmUoJ1JlamVjdCBEaWZmJywgeyBkaWZmaWQgfSlcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRkaWZmaWQ6IGRpZmZpZC50b1N0cmluZygpLFxuXHRcdFx0XHRcdFx0c3RhcnRMaW5lLFxuXHRcdFx0XHRcdFx0b2Zmc2V0TGluZXNcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdHJldHVybiAoKSA9PiB7IGJ1dHRvbnNXaWRnZXQuZGlzcG9zZSgpIH1cblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRcdGRpc3Bvc2VJblRoaXNFZGl0b3JGbnMucHVzaCgoKSA9PiB7IHRoaXMuX2NvbnNpc3RlbnRJdGVtU2VydmljZS5yZW1vdmVDb25zaXN0ZW50SXRlbUZyb21VUkkoY29uc2lzdGVudFdpZGdldElkKSB9KVxuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2VJbkVkaXRvciA9ICgpID0+IHsgZGlzcG9zZUluVGhpc0VkaXRvckZucy5mb3JFYWNoKGYgPT4gZigpKSB9XG5cdFx0cmV0dXJuIGRpc3Bvc2VJbkVkaXRvcjtcblxuXHR9XG5cblxuXG5cblx0cHJpdmF0ZSBfZ2V0QWN0aXZlRWRpdG9yVVJJKCk6IFVSSSB8IG51bGwge1xuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLmdldEFjdGl2ZUNvZGVFZGl0b3IoKVxuXHRcdGlmICghZWRpdG9yKSByZXR1cm4gbnVsbFxuXHRcdGNvbnN0IHVyaSA9IGVkaXRvci5nZXRNb2RlbCgpPy51cmlcblx0XHRpZiAoIXVyaSkgcmV0dXJuIG51bGxcblx0XHRyZXR1cm4gdXJpXG5cdH1cblxuXHR3ZUFyZVdyaXRpbmcgPSBmYWxzZVxuXHRwcml2YXRlIF93cml0ZVVSSVRleHQodXJpOiBVUkksIHRleHQ6IHN0cmluZywgcmFuZ2VfOiBJUmFuZ2UgfCAnd2hvbGVGaWxlUmFuZ2UnLCB7IHNob3VsZFJlYWxpZ25EaWZmQXJlYXMsIH06IHsgc2hvdWxkUmVhbGlnbkRpZmZBcmVhczogYm9vbGVhbiwgfSkge1xuXHRcdGNvbnN0IHsgbW9kZWwgfSA9IHRoaXMuX3ZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWwodXJpKVxuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHRoaXMuX3JlZnJlc2hTdHlsZXNBbmREaWZmc0luVVJJKHVyaSkgLy8gYXQgdGhlIGVuZCBvZiBhIHdyaXRlLCB3ZSBzdGlsbCBleHBlY3QgdG8gcmVmcmVzaCBhbGwgc3R5bGVzLiBlLmcuIHNvbWV0aW1lcyB3ZSBleHBlY3QgdG8gcmVzdG9yZSBhbGwgdGhlIGRlY29yYXRpb25zIGV2ZW4gaWYgbm8gZWRpdHMgd2VyZSBtYWRlIHdoZW4gX3dyaXRlVGV4dCBpcyB1c2VkXG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cblx0XHRjb25zdCByYW5nZTogSVJhbmdlID0gcmFuZ2VfID09PSAnd2hvbGVGaWxlUmFuZ2UnID9cblx0XHRcdHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogbW9kZWwuZ2V0TGluZUNvdW50KCksIGVuZENvbHVtbjogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIgfSAvLyB3aG9sZSBmaWxlXG5cdFx0XHQ6IHJhbmdlX1xuXG5cdFx0Ly8gcmVhbGlnbiBpcyAxMDAlIGluZGVwZW5kZW50IGZyb20gd3JpdHRlbiB0ZXh0IChkaWZmYXJlYXMgYXJlIG5vbnBoeXNpY2FsKSwgY2FuIGRvIHRoaXMgZmlyc3Rcblx0XHRpZiAoc2hvdWxkUmVhbGlnbkRpZmZBcmVhcykge1xuXHRcdFx0Y29uc3QgbmV3VGV4dCA9IHRleHRcblx0XHRcdGNvbnN0IG9sZFJhbmdlID0gcmFuZ2Vcblx0XHRcdHRoaXMuX3JlYWxpZ25BbGxEaWZmQXJlYXNMaW5lcyh1cmksIG5ld1RleHQsIG9sZFJhbmdlKVxuXHRcdH1cblxuXHRcdGNvbnN0IHVyaVN0ciA9IG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpXG5cblx0XHQvLyBoZXVyaXN0aWMgY2hlY2tcblx0XHRjb25zdCBkb250TmVlZFRvV3JpdGUgPSB1cmlTdHIgPT09IHRleHRcblx0XHRpZiAoZG9udE5lZWRUb1dyaXRlKSB7XG5cdFx0XHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpIC8vIGF0IHRoZSBlbmQgb2YgYSB3cml0ZSwgd2Ugc3RpbGwgZXhwZWN0IHRvIHJlZnJlc2ggYWxsIHN0eWxlcy4gZS5nLiBzb21ldGltZXMgd2UgZXhwZWN0IHRvIHJlc3RvcmUgYWxsIHRoZSBkZWNvcmF0aW9ucyBldmVuIGlmIG5vIGVkaXRzIHdlcmUgbWFkZSB3aGVuIF93cml0ZVRleHQgaXMgdXNlZFxuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXG5cdFx0dGhpcy53ZUFyZVdyaXRpbmcgPSB0cnVlXG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbeyByYW5nZSwgdGV4dCB9XSlcblx0XHR0aGlzLndlQXJlV3JpdGluZyA9IGZhbHNlXG5cblx0XHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpXG5cdH1cblxuXG5cblxuXG5cblx0cHJpdmF0ZSBfZ2V0Q3VycmVudFZvaWRGaWxlU25hcHNob3QgPSAodXJpOiBVUkkpOiBWb2lkRmlsZVNuYXBzaG90ID0+IHtcblx0XHRjb25zdCB7IG1vZGVsIH0gPSB0aGlzLl92b2lkTW9kZWxTZXJ2aWNlLmdldE1vZGVsKHVyaSlcblx0XHRjb25zdCBzbmFwc2hvdHRlZERpZmZBcmVhT2ZJZDogUmVjb3JkPHN0cmluZywgRGlmZkFyZWFTbmFwc2hvdEVudHJ5PiA9IHt9XG5cblx0XHRmb3IgKGNvbnN0IGRpZmZhcmVhaWQgaW4gdGhpcy5kaWZmQXJlYU9mSWQpIHtcblx0XHRcdGNvbnN0IGRpZmZBcmVhID0gdGhpcy5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF1cblxuXHRcdFx0aWYgKGRpZmZBcmVhLl9VUkkuZnNQYXRoICE9PSB1cmkuZnNQYXRoKSBjb250aW51ZVxuXG5cdFx0XHRzbmFwc2hvdHRlZERpZmZBcmVhT2ZJZFtkaWZmYXJlYWlkXSA9IGRlZXBDbG9uZShcblx0XHRcdFx0T2JqZWN0LmZyb21FbnRyaWVzKGRpZmZBcmVhU25hcHNob3RLZXlzLm1hcChrZXkgPT4gW2tleSwgZGlmZkFyZWFba2V5XV0pKVxuXHRcdFx0KSBhcyBEaWZmQXJlYVNuYXBzaG90RW50cnlcblx0XHR9XG5cblx0XHRjb25zdCBlbnRpcmVGaWxlQ29kZSA9IG1vZGVsID8gbW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRikgOiAnJ1xuXG5cdFx0Ly8gdGhpcy5fbm9Mb25nZXJOZWVkTW9kZWxSZWZlcmVuY2UodXJpKVxuXHRcdHJldHVybiB7XG5cdFx0XHRzbmFwc2hvdHRlZERpZmZBcmVhT2ZJZCxcblx0XHRcdGVudGlyZUZpbGVDb2RlLCAvLyB0aGUgd2hvbGUgZmlsZSdzIGNvZGVcblx0XHR9XG5cdH1cblxuXG5cdHByaXZhdGUgX3Jlc3RvcmVWb2lkRmlsZVNuYXBzaG90ID0gYXN5bmMgKHVyaTogVVJJLCBzbmFwc2hvdDogVm9pZEZpbGVTbmFwc2hvdCkgPT4ge1xuXHRcdC8vIGZvciBlYWNoIGRpZmZhcmVhIGluIHRoaXMgdXJpLCBzdG9wIHN0cmVhbWluZyBpZiBjdXJyZW50bHkgc3RyZWFtaW5nXG5cdFx0Zm9yIChjb25zdCBkaWZmYXJlYWlkIGluIHRoaXMuZGlmZkFyZWFPZklkKSB7XG5cdFx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0XHRpZiAoZGlmZkFyZWEudHlwZSA9PT0gJ0RpZmZab25lJylcblx0XHRcdFx0dGhpcy5fc3RvcElmU3RyZWFtaW5nKGRpZmZBcmVhKVxuXHRcdH1cblxuXHRcdC8vIGRlbGV0ZSBhbGwgZGlmZmFyZWFzIG9uIHRoaXMgdXJpIChjbGVhcmluZyB0aGVpciBzdHlsZXMpXG5cdFx0dGhpcy5fZGVsZXRlQWxsRGlmZkFyZWFzKHVyaSlcblxuXHRcdGNvbnN0IHsgc25hcHNob3R0ZWREaWZmQXJlYU9mSWQsIGVudGlyZUZpbGVDb2RlOiBlbnRpcmVNb2RlbENvZGUgfSA9IGRlZXBDbG9uZShzbmFwc2hvdCkgLy8gZG9uJ3Qgd2FudCB0byBkZXN0cm95IHRoZSBzbmFwc2hvdFxuXG5cdFx0Ly8gcmVzdG9yZSBkaWZmQXJlYU9mSWQgYW5kIGRpZmZBcmVhc09mTW9kZWxJZFxuXHRcdGZvciAoY29uc3QgZGlmZmFyZWFpZCBpbiBzbmFwc2hvdHRlZERpZmZBcmVhT2ZJZCkge1xuXG5cdFx0XHRjb25zdCBzbmFwc2hvdHRlZERpZmZBcmVhID0gc25hcHNob3R0ZWREaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF1cblxuXHRcdFx0aWYgKHNuYXBzaG90dGVkRGlmZkFyZWEudHlwZSA9PT0gJ0RpZmZab25lJykge1xuXHRcdFx0XHR0aGlzLmRpZmZBcmVhT2ZJZFtkaWZmYXJlYWlkXSA9IHtcblx0XHRcdFx0XHQuLi5zbmFwc2hvdHRlZERpZmZBcmVhIGFzIERpZmZBcmVhU25hcHNob3RFbnRyeTxEaWZmWm9uZT4sXG5cdFx0XHRcdFx0dHlwZTogJ0RpZmZab25lJyxcblx0XHRcdFx0XHRfZGlmZk9mSWQ6IHt9LFxuXHRcdFx0XHRcdF9VUkk6IHVyaSxcblx0XHRcdFx0XHRfc3RyZWFtU3RhdGU6IHsgaXNTdHJlYW1pbmc6IGZhbHNlIH0sIC8vIHdoZW4gcmVzdG9yaW5nLCB3ZSB3aWxsIG5ldmVyIGJlIHN0cmVhbWluZ1xuXHRcdFx0XHRcdF9yZW1vdmVTdHlsZXNGbnM6IG5ldyBTZXQoKSxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoc25hcHNob3R0ZWREaWZmQXJlYS50eXBlID09PSAnQ3RybEtab25lJykge1xuXHRcdFx0XHR0aGlzLmRpZmZBcmVhT2ZJZFtkaWZmYXJlYWlkXSA9IHtcblx0XHRcdFx0XHQuLi5zbmFwc2hvdHRlZERpZmZBcmVhIGFzIERpZmZBcmVhU25hcHNob3RFbnRyeTxDdHJsS1pvbmU+LFxuXHRcdFx0XHRcdF9VUkk6IHVyaSxcblx0XHRcdFx0XHRfcmVtb3ZlU3R5bGVzRm5zOiBuZXcgU2V0PEZ1bmN0aW9uPigpLFxuXHRcdFx0XHRcdF9tb3VudEluZm86IG51bGwsXG5cdFx0XHRcdFx0X2xpbmtlZFN0cmVhbWluZ0RpZmZab25lOiBudWxsLCAvLyB3aGVuIHJlc3RvcmluZywgd2Ugd2lsbCBuZXZlciBiZSBzdHJlYW1pbmdcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fYWRkT3JJbml0aWFsaXplRGlmZkFyZWFBdFVSSSh1cmksIGRpZmZhcmVhaWQpXG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkQWRkT3JEZWxldGVEaWZmWm9uZXMuZmlyZSh7IHVyaSB9KVxuXG5cdFx0Ly8gcmVzdG9yZSBmaWxlIGNvbnRlbnRcblx0XHR0aGlzLl93cml0ZVVSSVRleHQodXJpLCBlbnRpcmVNb2RlbENvZGUsXG5cdFx0XHQnd2hvbGVGaWxlUmFuZ2UnLFxuXHRcdFx0eyBzaG91bGRSZWFsaWduRGlmZkFyZWFzOiBmYWxzZSB9XG5cdFx0KVxuXHRcdC8vIHRoaXMuX25vTG9uZ2VyTmVlZE1vZGVsUmVmZXJlbmNlKHVyaSlcblx0fVxuXG5cdHByaXZhdGUgX2FkZFRvSGlzdG9yeSh1cmk6IFVSSSwgb3B0cz86IHsgb25XaWxsVW5kbz86ICgpID0+IHZvaWQgfSkge1xuXHRcdGNvbnN0IGJlZm9yZVNuYXBzaG90OiBWb2lkRmlsZVNuYXBzaG90ID0gdGhpcy5fZ2V0Q3VycmVudFZvaWRGaWxlU25hcHNob3QodXJpKVxuXHRcdGxldCBhZnRlclNuYXBzaG90OiBWb2lkRmlsZVNuYXBzaG90IHwgbnVsbCA9IG51bGxcblxuXHRcdGNvbnN0IGVsdDogSVVuZG9SZWRvRWxlbWVudCA9IHtcblx0XHRcdHR5cGU6IFVuZG9SZWRvRWxlbWVudFR5cGUuUmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZTogdXJpLFxuXHRcdFx0bGFiZWw6ICdWb2lkIEFnZW50Jyxcblx0XHRcdGNvZGU6ICd1bmRvcmVkby5lZGl0Q29kZScsXG5cdFx0XHR1bmRvOiBhc3luYyAoKSA9PiB7IG9wdHM/Lm9uV2lsbFVuZG8/LigpOyBhd2FpdCB0aGlzLl9yZXN0b3JlVm9pZEZpbGVTbmFwc2hvdCh1cmksIGJlZm9yZVNuYXBzaG90KSB9LFxuXHRcdFx0cmVkbzogYXN5bmMgKCkgPT4geyBpZiAoYWZ0ZXJTbmFwc2hvdCkgYXdhaXQgdGhpcy5fcmVzdG9yZVZvaWRGaWxlU25hcHNob3QodXJpLCBhZnRlclNuYXBzaG90KSB9XG5cdFx0fVxuXHRcdHRoaXMuX3VuZG9SZWRvU2VydmljZS5wdXNoRWxlbWVudChlbHQpXG5cblx0XHRjb25zdCBvbkZpbmlzaEVkaXQgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRhZnRlclNuYXBzaG90ID0gdGhpcy5fZ2V0Q3VycmVudFZvaWRGaWxlU25hcHNob3QodXJpKVxuXHRcdFx0YXdhaXQgdGhpcy5fdm9pZE1vZGVsU2VydmljZS5zYXZlTW9kZWwodXJpKVxuXHRcdH1cblx0XHRyZXR1cm4geyBvbkZpbmlzaEVkaXQgfVxuXHR9XG5cblxuXHRwdWJsaWMgZ2V0Vm9pZEZpbGVTbmFwc2hvdCh1cmk6IFVSSSkge1xuXHRcdHJldHVybiB0aGlzLl9nZXRDdXJyZW50Vm9pZEZpbGVTbmFwc2hvdCh1cmkpXG5cdH1cblxuXG5cdHB1YmxpYyByZXN0b3JlVm9pZEZpbGVTbmFwc2hvdCh1cmk6IFVSSSwgc25hcHNob3Q6IFZvaWRGaWxlU25hcHNob3QpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXN0b3JlVm9pZEZpbGVTbmFwc2hvdCh1cmksIHNuYXBzaG90KVxuXHR9XG5cblxuXHQvLyBkZWxldGUgZGlmZk9mSWQgYW5kIGRpZmZBcmVhLl9kaWZmT2ZJZFxuXHRwcml2YXRlIF9kZWxldGVEaWZmKGRpZmY6IERpZmYpIHtcblx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmYuZGlmZmFyZWFpZF1cblx0XHRpZiAoZGlmZkFyZWEudHlwZSAhPT0gJ0RpZmZab25lJykgcmV0dXJuXG5cdFx0ZGVsZXRlIGRpZmZBcmVhLl9kaWZmT2ZJZFtkaWZmLmRpZmZpZF1cblx0XHRkZWxldGUgdGhpcy5kaWZmT2ZJZFtkaWZmLmRpZmZpZF1cblx0fVxuXG5cdHByaXZhdGUgX2RlbGV0ZURpZmZzKGRpZmZab25lOiBEaWZmWm9uZSkge1xuXHRcdGZvciAoY29uc3QgZGlmZmlkIGluIGRpZmZab25lLl9kaWZmT2ZJZCkge1xuXHRcdFx0Y29uc3QgZGlmZiA9IGRpZmZab25lLl9kaWZmT2ZJZFtkaWZmaWRdXG5cdFx0XHR0aGlzLl9kZWxldGVEaWZmKGRpZmYpXG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY2xlYXJBbGxEaWZmQXJlYUVmZmVjdHMoZGlmZkFyZWE6IERpZmZBcmVhKSB7XG5cdFx0Ly8gY2xlYXIgZGlmZlpvbmUgZWZmZWN0cyAoZGlmZnMpXG5cdFx0aWYgKGRpZmZBcmVhLnR5cGUgPT09ICdEaWZmWm9uZScpXG5cdFx0XHR0aGlzLl9kZWxldGVEaWZmcyhkaWZmQXJlYSlcblxuXHRcdGRpZmZBcmVhLl9yZW1vdmVTdHlsZXNGbnM/LmZvckVhY2gocmVtb3ZlU3R5bGVzID0+IHJlbW92ZVN0eWxlcygpKVxuXHRcdGRpZmZBcmVhLl9yZW1vdmVTdHlsZXNGbnM/LmNsZWFyKClcblx0fVxuXG5cblx0Ly8gY2xlYXJzIGFsbCBEaWZmcyAoYW5kIHRoZWlyIHN0eWxlcykgYW5kIGFsbCBzdHlsZXMgb2YgRGlmZkFyZWFzLCBldGNcblx0cHJpdmF0ZSBfY2xlYXJBbGxFZmZlY3RzKHVyaTogVVJJKSB7XG5cdFx0Zm9yIChsZXQgZGlmZmFyZWFpZCBvZiB0aGlzLmRpZmZBcmVhc09mVVJJW3VyaS5mc1BhdGhdIHx8IFtdKSB7XG5cdFx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0XHR0aGlzLl9jbGVhckFsbERpZmZBcmVhRWZmZWN0cyhkaWZmQXJlYSlcblx0XHR9XG5cdH1cblxuXG5cdC8vIGRlbGV0ZSBhbGwgZGlmZnMsIHVwZGF0ZSBkaWZmQXJlYU9mSWQsIHVwZGF0ZSBkaWZmQXJlYXNPZk1vZGVsSWRcblx0cHJpdmF0ZSBfZGVsZXRlRGlmZlpvbmUoZGlmZlpvbmU6IERpZmZab25lKSB7XG5cdFx0dGhpcy5fY2xlYXJBbGxEaWZmQXJlYUVmZmVjdHMoZGlmZlpvbmUpXG5cdFx0ZGVsZXRlIHRoaXMuZGlmZkFyZWFPZklkW2RpZmZab25lLmRpZmZhcmVhaWRdXG5cdFx0dGhpcy5kaWZmQXJlYXNPZlVSSVtkaWZmWm9uZS5fVVJJLmZzUGF0aF0/LmRlbGV0ZShkaWZmWm9uZS5kaWZmYXJlYWlkLnRvU3RyaW5nKCkpXG5cdFx0dGhpcy5fb25EaWRBZGRPckRlbGV0ZURpZmZab25lcy5maXJlKHsgdXJpOiBkaWZmWm9uZS5fVVJJIH0pXG5cdH1cblxuXHRwcml2YXRlIF9kZWxldGVUcmFja2luZ1pvbmUodHJhY2tpbmdab25lOiBUcmFja2luZ1pvbmU8dW5rbm93bj4pIHtcblx0XHRkZWxldGUgdGhpcy5kaWZmQXJlYU9mSWRbdHJhY2tpbmdab25lLmRpZmZhcmVhaWRdXG5cdFx0dGhpcy5kaWZmQXJlYXNPZlVSSVt0cmFja2luZ1pvbmUuX1VSSS5mc1BhdGhdPy5kZWxldGUodHJhY2tpbmdab25lLmRpZmZhcmVhaWQudG9TdHJpbmcoKSlcblx0fVxuXG5cdHByaXZhdGUgX2RlbGV0ZUN0cmxLWm9uZShjdHJsS1pvbmU6IEN0cmxLWm9uZSkge1xuXHRcdHRoaXMuX2NsZWFyQWxsRWZmZWN0cyhjdHJsS1pvbmUuX1VSSSlcblx0XHRjdHJsS1pvbmUuX21vdW50SW5mbz8uZGlzcG9zZSgpXG5cdFx0ZGVsZXRlIHRoaXMuZGlmZkFyZWFPZklkW2N0cmxLWm9uZS5kaWZmYXJlYWlkXVxuXHRcdHRoaXMuZGlmZkFyZWFzT2ZVUklbY3RybEtab25lLl9VUkkuZnNQYXRoXT8uZGVsZXRlKGN0cmxLWm9uZS5kaWZmYXJlYWlkLnRvU3RyaW5nKCkpXG5cdH1cblxuXG5cdHByaXZhdGUgX2RlbGV0ZUFsbERpZmZBcmVhcyh1cmk6IFVSSSkge1xuXHRcdGNvbnN0IGRpZmZBcmVhcyA9IHRoaXMuZGlmZkFyZWFzT2ZVUklbdXJpLmZzUGF0aF1cblx0XHRkaWZmQXJlYXM/LmZvckVhY2goZGlmZmFyZWFpZCA9PiB7XG5cdFx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0XHRpZiAoZGlmZkFyZWEudHlwZSA9PT0gJ0RpZmZab25lJylcblx0XHRcdFx0dGhpcy5fZGVsZXRlRGlmZlpvbmUoZGlmZkFyZWEpXG5cdFx0XHRlbHNlIGlmIChkaWZmQXJlYS50eXBlID09PSAnQ3RybEtab25lJylcblx0XHRcdFx0dGhpcy5fZGVsZXRlQ3RybEtab25lKGRpZmZBcmVhKVxuXHRcdH0pXG5cdFx0dGhpcy5kaWZmQXJlYXNPZlVSSVt1cmkuZnNQYXRoXT8uY2xlYXIoKVxuXHR9XG5cblx0cHJpdmF0ZSBfYWRkT3JJbml0aWFsaXplRGlmZkFyZWFBdFVSSSA9ICh1cmk6IFVSSSwgZGlmZmFyZWFpZDogc3RyaW5nIHwgbnVtYmVyKSA9PiB7XG5cdFx0aWYgKCEodXJpLmZzUGF0aCBpbiB0aGlzLmRpZmZBcmVhc09mVVJJKSkgdGhpcy5kaWZmQXJlYXNPZlVSSVt1cmkuZnNQYXRoXSA9IG5ldyBTZXQoKVxuXHRcdHRoaXMuZGlmZkFyZWFzT2ZVUklbdXJpLmZzUGF0aF0/LmFkZChkaWZmYXJlYWlkLnRvU3RyaW5nKCkpXG5cdH1cblxuXHRwcml2YXRlIF9kaWZmYXJlYWlkUG9vbCA9IDAgLy8gZWFjaCBkaWZmYXJlYSBoYXMgYW4gaWRcblx0cHJpdmF0ZSBfYWRkRGlmZkFyZWE8VCBleHRlbmRzIERpZmZBcmVhPihkaWZmQXJlYTogT21pdDxULCAnZGlmZmFyZWFpZCc+KTogVCB7XG5cdFx0Y29uc3QgZGlmZmFyZWFpZCA9IHRoaXMuX2RpZmZhcmVhaWRQb29sKytcblx0XHRjb25zdCBkaWZmQXJlYTIgPSB7IC4uLmRpZmZBcmVhLCBkaWZmYXJlYWlkIH0gYXMgVFxuXHRcdHRoaXMuX2FkZE9ySW5pdGlhbGl6ZURpZmZBcmVhQXRVUkkoZGlmZkFyZWEuX1VSSSwgZGlmZmFyZWFpZClcblx0XHR0aGlzLmRpZmZBcmVhT2ZJZFtkaWZmYXJlYWlkXSA9IGRpZmZBcmVhMlxuXHRcdHJldHVybiBkaWZmQXJlYTJcblx0fVxuXG5cdHByaXZhdGUgX2RpZmZpZFBvb2wgPSAwIC8vIGVhY2ggZGlmZiBoYXMgYW4gaWRcblx0cHJpdmF0ZSBfYWRkRGlmZihjb21wdXRlZERpZmY6IENvbXB1dGVkRGlmZiwgZGlmZlpvbmU6IERpZmZab25lKTogRGlmZiB7XG5cdFx0Y29uc3QgdXJpID0gZGlmZlpvbmUuX1VSSVxuXHRcdGNvbnN0IGRpZmZpZCA9IHRoaXMuX2RpZmZpZFBvb2wrK1xuXG5cdFx0Ly8gY3JlYXRlIGEgRGlmZiBvZiBpdFxuXHRcdGNvbnN0IG5ld0RpZmY6IERpZmYgPSB7XG5cdFx0XHQuLi5jb21wdXRlZERpZmYsXG5cdFx0XHRkaWZmaWQ6IGRpZmZpZCxcblx0XHRcdGRpZmZhcmVhaWQ6IGRpZmZab25lLmRpZmZhcmVhaWQsXG5cdFx0fVxuXG5cdFx0Y29uc3QgZm4gPSB0aGlzLl9hZGREaWZmU3R5bGVzVG9VUkkodXJpLCBuZXdEaWZmKVxuXHRcdGlmIChmbikgZGlmZlpvbmUuX3JlbW92ZVN0eWxlc0Zucy5hZGQoZm4pXG5cblx0XHR0aGlzLmRpZmZPZklkW2RpZmZpZF0gPSBuZXdEaWZmXG5cdFx0ZGlmZlpvbmUuX2RpZmZPZklkW2RpZmZpZF0gPSBuZXdEaWZmXG5cblx0XHRyZXR1cm4gbmV3RGlmZlxuXHR9XG5cblxuXG5cblx0Ly8gY2hhbmdlcyB0aGUgc3RhcnQvbGluZSBsb2NhdGlvbnMgb2YgYWxsIERpZmZBcmVhcyBvbiB0aGUgcGFnZSAoYWRqdXN0IHRoZWlyIHN0YXJ0L2VuZCBiYXNlZCBvbiB0aGUgY2hhbmdlKSBiYXNlZCBvbiB0aGUgY2hhbmdlIHRoYXQgd2FzIHJlY2VudGx5IG1hZGVcblx0cHJpdmF0ZSBfcmVhbGlnbkFsbERpZmZBcmVhc0xpbmVzKHVyaTogVVJJLCB0ZXh0OiBzdHJpbmcsIHJlY2VudENoYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IG51bWJlcjsgZW5kTGluZU51bWJlcjogbnVtYmVyIH0pIHtcblxuXHRcdC8vIGNvbnNvbGUubG9nKCdyZWNlbnQgY2hhbmdlJywgcmVjZW50Q2hhbmdlKVxuXG5cdFx0Ly8gY29tcHV0ZSBuZXQgbnVtYmVyIG9mIG5ld2xpbmVzIGxpbmVzIHRoYXQgd2VyZSBhZGRlZC9yZW1vdmVkXG5cdFx0Y29uc3Qgc3RhcnRMaW5lID0gcmVjZW50Q2hhbmdlLnN0YXJ0TGluZU51bWJlclxuXHRcdGNvbnN0IGVuZExpbmUgPSByZWNlbnRDaGFuZ2UuZW5kTGluZU51bWJlclxuXG5cdFx0Y29uc3QgbmV3VGV4dEhlaWdodCA9ICh0ZXh0Lm1hdGNoKC9cXG4vZykgfHwgW10pLmxlbmd0aCArIDEgLy8gbnVtYmVyIG9mIG5ld2xpbmVzIGlzIG51bWJlciBvZiBcXG4ncyArIDEsIGUuZy4gXCJhYlxcbmNkXCJcblxuXHRcdC8vIGNvbXB1dGUgb3ZlcmxhcCB3aXRoIGVhY2ggZGlmZkFyZWEgYW5kIHNocmluay9lbG9uZ2F0ZSBlYWNoIGRpZmZBcmVhIGFjY29yZGluZ2x5XG5cdFx0Zm9yIChjb25zdCBkaWZmYXJlYWlkIG9mIHRoaXMuZGlmZkFyZWFzT2ZVUklbdXJpLmZzUGF0aF0gfHwgW10pIHtcblx0XHRcdGNvbnN0IGRpZmZBcmVhID0gdGhpcy5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF1cblxuXHRcdFx0Ly8gaWYgdGhlIGRpZmZBcmVhIGlzIGVudGlyZWx5IGFib3ZlIHRoZSByYW5nZSwgaXQgaXMgbm90IGFmZmVjdGVkXG5cdFx0XHRpZiAoZGlmZkFyZWEuZW5kTGluZSA8IHN0YXJ0TGluZSkge1xuXHRcdFx0XHQvLyBjb25zb2xlLmxvZygnQ0hBTkdFIEZVTExZIEJFTE9XIERBIChkb2luZyBub3RoaW5nKScpXG5cdFx0XHRcdGNvbnRpbnVlXG5cdFx0XHR9XG5cdFx0XHQvLyBpZiBhIGRpZmZBcmVhIGlzIGVudGlyZWx5IGJlbG93IHRoZSByYW5nZSwgc2hpZnQgdGhlIGRpZmZBcmVhIHVwL2Rvd24gYnkgdGhlIGRlbHRhIGFtb3VudCBvZiBuZXdsaW5lc1xuXHRcdFx0ZWxzZSBpZiAoZW5kTGluZSA8IGRpZmZBcmVhLnN0YXJ0TGluZSkge1xuXHRcdFx0XHQvLyBjb25zb2xlLmxvZygnQ0hBTkdFIEZVTExZIEFCT1ZFIERBJylcblx0XHRcdFx0Y29uc3QgY2hhbmdlZFJhbmdlSGVpZ2h0ID0gZW5kTGluZSAtIHN0YXJ0TGluZSArIDFcblx0XHRcdFx0Y29uc3QgZGVsdGFOZXdsaW5lcyA9IG5ld1RleHRIZWlnaHQgLSBjaGFuZ2VkUmFuZ2VIZWlnaHRcblx0XHRcdFx0ZGlmZkFyZWEuc3RhcnRMaW5lICs9IGRlbHRhTmV3bGluZXNcblx0XHRcdFx0ZGlmZkFyZWEuZW5kTGluZSArPSBkZWx0YU5ld2xpbmVzXG5cdFx0XHR9XG5cdFx0XHQvLyBpZiB0aGUgZGlmZkFyZWEgZnVsbHkgY29udGFpbnMgdGhlIGNoYW5nZSwgZWxvbmdhdGUgaXQgYnkgdGhlIGRlbHRhIGFtb3VudCBvZiBuZXdsaW5lc1xuXHRcdFx0ZWxzZSBpZiAoc3RhcnRMaW5lID49IGRpZmZBcmVhLnN0YXJ0TGluZSAmJiBlbmRMaW5lIDw9IGRpZmZBcmVhLmVuZExpbmUpIHtcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ0RBIEZVTExZIENPTlRBSU5TIENIQU5HRScpXG5cdFx0XHRcdGNvbnN0IGNoYW5nZWRSYW5nZUhlaWdodCA9IGVuZExpbmUgLSBzdGFydExpbmUgKyAxXG5cdFx0XHRcdGNvbnN0IGRlbHRhTmV3bGluZXMgPSBuZXdUZXh0SGVpZ2h0IC0gY2hhbmdlZFJhbmdlSGVpZ2h0XG5cdFx0XHRcdGRpZmZBcmVhLmVuZExpbmUgKz0gZGVsdGFOZXdsaW5lc1xuXHRcdFx0fVxuXHRcdFx0Ly8gaWYgdGhlIGNoYW5nZSBmdWxseSBjb250YWlucyB0aGUgZGlmZkFyZWEsIG1ha2UgdGhlIGRpZmZBcmVhIGhhdmUgdGhlIHNhbWUgcmFuZ2UgYXMgdGhlIGNoYW5nZVxuXHRcdFx0ZWxzZSBpZiAoZGlmZkFyZWEuc3RhcnRMaW5lID4gc3RhcnRMaW5lICYmIGRpZmZBcmVhLmVuZExpbmUgPCBlbmRMaW5lKSB7XG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKCdDSEFOR0UgRlVMTFkgQ09OVEFJTlMgREEnKVxuXHRcdFx0XHRkaWZmQXJlYS5zdGFydExpbmUgPSBzdGFydExpbmVcblx0XHRcdFx0ZGlmZkFyZWEuZW5kTGluZSA9IHN0YXJ0TGluZSArIG5ld1RleHRIZWlnaHRcblx0XHRcdH1cblx0XHRcdC8vIGlmIHRoZSBjaGFuZ2UgY29udGFpbnMgb25seSB0aGUgZGlmZkFyZWEncyB0b3Bcblx0XHRcdGVsc2UgaWYgKHN0YXJ0TGluZSA8IGRpZmZBcmVhLnN0YXJ0TGluZSAmJiBkaWZmQXJlYS5zdGFydExpbmUgPD0gZW5kTGluZSkge1xuXHRcdFx0XHQvLyBjb25zb2xlLmxvZygnQ0hBTkdFIENPTlRBSU5TIFRPUCBPRiBEQSBPTkxZJylcblx0XHRcdFx0Y29uc3QgbnVtT3ZlcmxhcHBpbmdMaW5lcyA9IGVuZExpbmUgLSBkaWZmQXJlYS5zdGFydExpbmUgKyAxXG5cdFx0XHRcdGNvbnN0IG51bVJlbWFpbmluZ0xpbmVzSW5EQSA9IGRpZmZBcmVhLmVuZExpbmUgLSBkaWZmQXJlYS5zdGFydExpbmUgKyAxIC0gbnVtT3ZlcmxhcHBpbmdMaW5lc1xuXHRcdFx0XHRjb25zdCBuZXdIZWlnaHQgPSAobnVtUmVtYWluaW5nTGluZXNJbkRBIC0gMSkgKyAobmV3VGV4dEhlaWdodCAtIDEpICsgMVxuXHRcdFx0XHRkaWZmQXJlYS5zdGFydExpbmUgPSBzdGFydExpbmVcblx0XHRcdFx0ZGlmZkFyZWEuZW5kTGluZSA9IHN0YXJ0TGluZSArIG5ld0hlaWdodFxuXHRcdFx0fVxuXHRcdFx0Ly8gaWYgdGhlIGNoYW5nZSBjb250YWlucyBvbmx5IHRoZSBkaWZmQXJlYSdzIGJvdHRvbVxuXHRcdFx0ZWxzZSBpZiAoc3RhcnRMaW5lIDw9IGRpZmZBcmVhLmVuZExpbmUgJiYgZGlmZkFyZWEuZW5kTGluZSA8IGVuZExpbmUpIHtcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ0NIQU5HRSBDT05UQUlOUyBCT1RUT00gT0YgREEgT05MWScpXG5cdFx0XHRcdGNvbnN0IG51bU92ZXJsYXBwaW5nTGluZXMgPSBkaWZmQXJlYS5lbmRMaW5lIC0gc3RhcnRMaW5lICsgMVxuXHRcdFx0XHRkaWZmQXJlYS5lbmRMaW5lICs9IG5ld1RleHRIZWlnaHQgLSBudW1PdmVybGFwcGluZ0xpbmVzXG5cdFx0XHR9XG5cdFx0fVxuXG5cdH1cblxuXG5cblx0cHJpdmF0ZSBfZmlyZUNoYW5nZURpZmZzSWZOb3RTdHJlYW1pbmcodXJpOiBVUkkpIHtcblx0XHRmb3IgKGNvbnN0IGRpZmZhcmVhaWQgb2YgdGhpcy5kaWZmQXJlYXNPZlVSSVt1cmkuZnNQYXRoXSB8fCBbXSkge1xuXHRcdFx0Y29uc3QgZGlmZkFyZWEgPSB0aGlzLmRpZmZBcmVhT2ZJZFtkaWZmYXJlYWlkXVxuXHRcdFx0aWYgKGRpZmZBcmVhPy50eXBlICE9PSAnRGlmZlpvbmUnKSBjb250aW51ZVxuXHRcdFx0Ly8gZmlyZSBjaGFuZ2VkIGRpZmZzICh0aGlzIGlzIHRoZSBvbmx5IHBsYWNlIERpZmZzIGFyZSBhZGRlZClcblx0XHRcdGlmICghZGlmZkFyZWEuX3N0cmVhbVN0YXRlLmlzU3RyZWFtaW5nKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGlmZnNJbkRpZmZab25lTm90U3RyZWFtaW5nLmZpcmUoeyB1cmksIGRpZmZhcmVhaWQ6IGRpZmZBcmVhLmRpZmZhcmVhaWQgfSlcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXG5cdHByaXZhdGUgX3JlZnJlc2hTdHlsZXNBbmREaWZmc0luVVJJKHVyaTogVVJJKSB7XG5cblx0XHQvLyAxLiBjbGVhciBEaWZmQXJlYSBzdHlsZXMgYW5kIERpZmZzXG5cdFx0dGhpcy5fY2xlYXJBbGxFZmZlY3RzKHVyaSlcblxuXHRcdC8vIDIuIHN0eWxlIERpZmZBcmVhcyAoc3dlZXAsIGV0Yylcblx0XHR0aGlzLl9hZGREaWZmQXJlYVN0eWxlc1RvVVJJKHVyaSlcblxuXHRcdC8vIDMuIGFkZCBEaWZmc1xuXHRcdHRoaXMuX2NvbXB1dGVEaWZmc0FuZEFkZFN0eWxlc1RvVVJJKHVyaSlcblxuXHRcdC8vIDQuIHJlZnJlc2ggY3RybEsgem9uZXNcblx0XHR0aGlzLl9yZWZyZXNoQ3RybEtJbnB1dHModXJpKVxuXG5cdFx0Ly8gNS4gdGhpcyBpcyB0aGUgb25seSBwbGFjZSB3aGVyZSBkaWZmcyBhcmUgY2hhbmdlZCwgc28gY2FuIGZpcmUgaGVyZSBvbmx5XG5cdFx0dGhpcy5fZmlyZUNoYW5nZURpZmZzSWZOb3RTdHJlYW1pbmcodXJpKVxuXHR9XG5cblxuXG5cblx0Ly8gQHRocm90dGxlKDEwMClcblx0cHJpdmF0ZSBfd3JpdGVTdHJlYW1lZERpZmZab25lTExNVGV4dCh1cmk6IFVSSSwgb3JpZ2luYWxDb2RlOiBzdHJpbmcsIGxsbVRleHRTb0Zhcjogc3RyaW5nLCBkZWx0YVRleHQ6IHN0cmluZywgbGF0ZXN0TXV0YWJsZTogU3RyZWFtTG9jYXRpb25NdXRhYmxlKSB7XG5cblx0XHRsZXQgbnVtTmV3TGluZXMgPSAwXG5cblx0XHQvLyAtLS0tLS0tLS0tLSAxLiBXcml0ZSB0aGUgbmV3IGNvZGUgdG8gdGhlIGRvY3VtZW50IC0tLS0tLS0tLS0tXG5cdFx0Ly8gZmlndXJlIG91dCB3aGVyZSB0byBoaWdobGlnaHQgYmFzZWQgb24gd2hlcmUgdGhlIEFJIGlzIGluIHRoZSBzdHJlYW0gcmlnaHQgbm93LCB1c2UgdGhlIGxhc3QgZGlmZiB0byBmaWd1cmUgdGhhdCBvdXRcblx0XHRjb25zdCBjb21wdXRlZERpZmZzID0gZmluZERpZmZzKG9yaWdpbmFsQ29kZSwgbGxtVGV4dFNvRmFyKVxuXG5cdFx0Ly8gaWYgc3RyZWFtaW5nLCB1c2UgZGlmZnMgdG8gZmlndXJlIG91dCB3aGVyZSB0byB3cml0ZSBuZXcgY29kZVxuXHRcdC8vIHRoZXNlIGFyZSB0d28gZGlmZmVyZW50IGNvb3JkaW5hdGUgc3lzdGVtcyAtIG5ldyBhbmQgb2xkIGxpbmUgbnVtYmVyXG5cdFx0bGV0IGVuZExpbmVJbkxsbVRleHRTb0ZhcjogbnVtYmVyIC8vIGdldCBmaWxlW2RpZmZBcmVhLnN0YXJ0TGluZS4uLm5ld0ZpbGVFbmRMaW5lXSB3aXRoIGxpbmU9bmV3RmlsZUVuZExpbmUgaGlnaGxpZ2h0ZWRcblx0XHRsZXQgc3RhcnRMaW5lSW5PcmlnaW5hbENvZGU6IG51bWJlciAvLyBnZXQgb3JpZ2luYWxbb2xkU3RhcnRpbmdQb2ludC4uLl0gKGxpbmUgaW4gdGhlIG9yaWdpbmFsIGNvZGUsIHNvIHN0YXJ0cyBhdCAxKVxuXG5cdFx0Y29uc3QgbGFzdERpZmYgPSBjb21wdXRlZERpZmZzLnBvcCgpXG5cblx0XHRpZiAoIWxhc3REaWZmKSB7XG5cdFx0XHQvLyBjb25zb2xlLmxvZygnIWxhc3REaWZmJylcblx0XHRcdC8vIGlmIHRoZSB3cml0aW5nIGlzIGlkZW50aWNhbCBzbyBmYXIsIGRpc3BsYXkgbm8gY2hhbmdlc1xuXHRcdFx0c3RhcnRMaW5lSW5PcmlnaW5hbENvZGUgPSAxXG5cdFx0XHRlbmRMaW5lSW5MbG1UZXh0U29GYXIgPSAxXG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0c3RhcnRMaW5lSW5PcmlnaW5hbENvZGUgPSBsYXN0RGlmZi5vcmlnaW5hbFN0YXJ0TGluZVxuXHRcdFx0aWYgKGxhc3REaWZmLnR5cGUgPT09ICdpbnNlcnRpb24nIHx8IGxhc3REaWZmLnR5cGUgPT09ICdlZGl0Jylcblx0XHRcdFx0ZW5kTGluZUluTGxtVGV4dFNvRmFyID0gbGFzdERpZmYuZW5kTGluZVxuXHRcdFx0ZWxzZSBpZiAobGFzdERpZmYudHlwZSA9PT0gJ2RlbGV0aW9uJylcblx0XHRcdFx0ZW5kTGluZUluTGxtVGV4dFNvRmFyID0gbGFzdERpZmYuc3RhcnRMaW5lXG5cdFx0XHRlbHNlXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVm9pZDogZGlmZi50eXBlIG5vdCByZWNvZ25pemVkIG9uOiAke2xhc3REaWZmfWApXG5cdFx0fVxuXG5cdFx0Ly8gYXQgdGhlIHN0YXJ0LCBhZGQgYSBuZXdsaW5lIGJldHdlZW4gdGhlIHN0cmVhbSBhbmQgb3JpZ2luYWxDb2RlIHRvIG1ha2UgcmVhc29uaW5nIGVhc2llclxuXHRcdGlmICghbGF0ZXN0TXV0YWJsZS5hZGRlZFNwbGl0WWV0KSB7XG5cdFx0XHR0aGlzLl93cml0ZVVSSVRleHQodXJpLCAnXFxuJyxcblx0XHRcdFx0eyBzdGFydExpbmVOdW1iZXI6IGxhdGVzdE11dGFibGUubGluZSwgc3RhcnRDb2x1bW46IGxhdGVzdE11dGFibGUuY29sLCBlbmRMaW5lTnVtYmVyOiBsYXRlc3RNdXRhYmxlLmxpbmUsIGVuZENvbHVtbjogbGF0ZXN0TXV0YWJsZS5jb2wsIH0sXG5cdFx0XHRcdHsgc2hvdWxkUmVhbGlnbkRpZmZBcmVhczogdHJ1ZSB9XG5cdFx0XHQpXG5cdFx0XHRsYXRlc3RNdXRhYmxlLmFkZGVkU3BsaXRZZXQgPSB0cnVlXG5cdFx0XHRudW1OZXdMaW5lcyArPSAxXG5cdFx0fVxuXG5cdFx0Ly8gaW5zZXJ0IGRlbHRhVGV4dCBhdCBsYXRlc3QgbGluZSBhbmQgY29sXG5cdFx0dGhpcy5fd3JpdGVVUklUZXh0KHVyaSwgZGVsdGFUZXh0LFxuXHRcdFx0eyBzdGFydExpbmVOdW1iZXI6IGxhdGVzdE11dGFibGUubGluZSwgc3RhcnRDb2x1bW46IGxhdGVzdE11dGFibGUuY29sLCBlbmRMaW5lTnVtYmVyOiBsYXRlc3RNdXRhYmxlLmxpbmUsIGVuZENvbHVtbjogbGF0ZXN0TXV0YWJsZS5jb2wgfSxcblx0XHRcdHsgc2hvdWxkUmVhbGlnbkRpZmZBcmVhczogdHJ1ZSB9XG5cdFx0KVxuXHRcdGNvbnN0IGRlbHRhTnVtTmV3TGluZXMgPSBkZWx0YVRleHQuc3BsaXQoJ1xcbicpLmxlbmd0aCAtIDFcblx0XHRsYXRlc3RNdXRhYmxlLmxpbmUgKz0gZGVsdGFOdW1OZXdMaW5lc1xuXHRcdGNvbnN0IGxhc3ROZXdsaW5lSWR4ID0gZGVsdGFUZXh0Lmxhc3RJbmRleE9mKCdcXG4nKVxuXHRcdGxhdGVzdE11dGFibGUuY29sID0gbGFzdE5ld2xpbmVJZHggPT09IC0xID8gbGF0ZXN0TXV0YWJsZS5jb2wgKyBkZWx0YVRleHQubGVuZ3RoIDogZGVsdGFUZXh0Lmxlbmd0aCAtIGxhc3ROZXdsaW5lSWR4XG5cdFx0bnVtTmV3TGluZXMgKz0gZGVsdGFOdW1OZXdMaW5lc1xuXG5cdFx0Ly8gZGVsZXRlIG9yIGluc2VydCB0byBnZXQgb3JpZ2luYWwgdXAgdG8gc3BlZWRcblx0XHRpZiAobGF0ZXN0TXV0YWJsZS5vcmlnaW5hbENvZGVTdGFydExpbmUgPCBzdGFydExpbmVJbk9yaWdpbmFsQ29kZSkge1xuXHRcdFx0Ly8gbW92ZWQgdXAsIGRlbGV0ZVxuXHRcdFx0Y29uc3QgbnVtTGluZXNEZWxldGVkID0gc3RhcnRMaW5lSW5PcmlnaW5hbENvZGUgLSBsYXRlc3RNdXRhYmxlLm9yaWdpbmFsQ29kZVN0YXJ0TGluZVxuXHRcdFx0dGhpcy5fd3JpdGVVUklUZXh0KHVyaSwgJycsXG5cdFx0XHRcdHsgc3RhcnRMaW5lTnVtYmVyOiBsYXRlc3RNdXRhYmxlLmxpbmUsIHN0YXJ0Q29sdW1uOiBsYXRlc3RNdXRhYmxlLmNvbCwgZW5kTGluZU51bWJlcjogbGF0ZXN0TXV0YWJsZS5saW5lICsgbnVtTGluZXNEZWxldGVkLCBlbmRDb2x1bW46IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCB9LFxuXHRcdFx0XHR7IHNob3VsZFJlYWxpZ25EaWZmQXJlYXM6IHRydWUgfVxuXHRcdFx0KVxuXHRcdFx0bnVtTmV3TGluZXMgLT0gbnVtTGluZXNEZWxldGVkXG5cdFx0fVxuXHRcdGVsc2UgaWYgKGxhdGVzdE11dGFibGUub3JpZ2luYWxDb2RlU3RhcnRMaW5lID4gc3RhcnRMaW5lSW5PcmlnaW5hbENvZGUpIHtcblx0XHRcdGNvbnN0IG5ld1RleHQgPSAnXFxuJyArIG9yaWdpbmFsQ29kZS5zcGxpdCgnXFxuJykuc2xpY2UoKHN0YXJ0TGluZUluT3JpZ2luYWxDb2RlIC0gMSksIChsYXRlc3RNdXRhYmxlLm9yaWdpbmFsQ29kZVN0YXJ0TGluZSAtIDEpIC0gMSArIDEpLmpvaW4oJ1xcbicpXG5cdFx0XHR0aGlzLl93cml0ZVVSSVRleHQodXJpLCBuZXdUZXh0LFxuXHRcdFx0XHR7IHN0YXJ0TGluZU51bWJlcjogbGF0ZXN0TXV0YWJsZS5saW5lLCBzdGFydENvbHVtbjogbGF0ZXN0TXV0YWJsZS5jb2wsIGVuZExpbmVOdW1iZXI6IGxhdGVzdE11dGFibGUubGluZSwgZW5kQ29sdW1uOiBsYXRlc3RNdXRhYmxlLmNvbCB9LFxuXHRcdFx0XHR7IHNob3VsZFJlYWxpZ25EaWZmQXJlYXM6IHRydWUgfVxuXHRcdFx0KVxuXHRcdFx0bnVtTmV3TGluZXMgKz0gbmV3VGV4dC5zcGxpdCgnXFxuJykubGVuZ3RoIC0gMVxuXHRcdH1cblx0XHRsYXRlc3RNdXRhYmxlLm9yaWdpbmFsQ29kZVN0YXJ0TGluZSA9IHN0YXJ0TGluZUluT3JpZ2luYWxDb2RlXG5cblx0XHRyZXR1cm4geyBlbmRMaW5lSW5MbG1UZXh0U29GYXIsIG51bU5ld0xpbmVzIH0gLy8gbnVtTmV3TGluZXMgaGVyZSBtaWdodCBub3QgYmUgY29ycmVjdC4uLi5cblx0fVxuXG5cblxuXG5cdC8vIGNhbGxlZCBmaXJzdCwgdGhlbiBjYWxsIHN0YXJ0QXBwbHlpbmdcblx0cHVibGljIGFkZEN0cmxLWm9uZSh7IHN0YXJ0TGluZSwgZW5kTGluZSwgZWRpdG9yIH06IEFkZEN0cmxLT3B0cykge1xuXG5cdFx0Ly8gZG9uJ3QgbmVlZCB0byBhd2FpdCB0aGlzLCBiZWNhdXNlIGluIG9yZGVyIHRvIGFkZCBhIGN0cmwrSyB6b25lIG11c3QgYWxyZWFkeSBoYXZlIHRoZSBtb2RlbCBvcGVuIG9uIHlvdXIgc2NyZWVuXG5cdFx0Ly8gYXdhaXQgdGhpcy5fZW5zdXJlTW9kZWxFeGlzdHModXJpKVxuXG5cdFx0Y29uc3QgdXJpID0gZWRpdG9yLmdldE1vZGVsKCk/LnVyaVxuXHRcdGlmICghdXJpKSByZXR1cm5cblxuXG5cdFx0Ly8gY2hlY2sgaWYgdGhlcmUncyBvdmVybGFwIHdpdGggYW55IG90aGVyIGN0cmxLWm9uZSBhbmQgaWYgc28sIGZvY3VzIGl0XG5cdFx0Y29uc3Qgb3ZlcmxhcHBpbmdDdHJsS1pvbmUgPSB0aGlzLl9maW5kT3ZlcmxhcHBpbmdEaWZmQXJlYSh7IHN0YXJ0TGluZSwgZW5kTGluZSwgdXJpLCBmaWx0ZXI6IChkaWZmQXJlYSkgPT4gZGlmZkFyZWEudHlwZSA9PT0gJ0N0cmxLWm9uZScgfSlcblx0XHRpZiAob3ZlcmxhcHBpbmdDdHJsS1pvbmUpIHtcblx0XHRcdGVkaXRvci5yZXZlYWxMaW5lKG92ZXJsYXBwaW5nQ3RybEtab25lLnN0YXJ0TGluZSkgLy8gaW1wb3J0YW50XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IChvdmVybGFwcGluZ0N0cmxLWm9uZSBhcyBDdHJsS1pvbmUpLl9tb3VudEluZm8/LnRleHRBcmVhUmVmLmN1cnJlbnQ/LmZvY3VzKCksIDEwMClcblx0XHRcdHJldHVyblxuXHRcdH1cblxuXHRcdGNvbnN0IG92ZXJsYXBwaW5nRGlmZlpvbmUgPSB0aGlzLl9maW5kT3ZlcmxhcHBpbmdEaWZmQXJlYSh7IHN0YXJ0TGluZSwgZW5kTGluZSwgdXJpLCBmaWx0ZXI6IChkaWZmQXJlYSkgPT4gZGlmZkFyZWEudHlwZSA9PT0gJ0RpZmZab25lJyB9KVxuXHRcdGlmIChvdmVybGFwcGluZ0RpZmZab25lKVxuXHRcdFx0cmV0dXJuXG5cblx0XHRlZGl0b3IucmV2ZWFsTGluZShzdGFydExpbmUpXG5cdFx0ZWRpdG9yLnNldFNlbGVjdGlvbih7IHN0YXJ0TGluZU51bWJlcjogc3RhcnRMaW5lLCBlbmRMaW5lTnVtYmVyOiBzdGFydExpbmUsIHN0YXJ0Q29sdW1uOiAxLCBlbmRDb2x1bW46IDEgfSlcblxuXHRcdGNvbnN0IHsgb25GaW5pc2hFZGl0IH0gPSB0aGlzLl9hZGRUb0hpc3RvcnkodXJpKVxuXG5cdFx0Y29uc3QgYWRkaW5nOiBPbWl0PEN0cmxLWm9uZSwgJ2RpZmZhcmVhaWQnPiA9IHtcblx0XHRcdHR5cGU6ICdDdHJsS1pvbmUnLFxuXHRcdFx0c3RhcnRMaW5lOiBzdGFydExpbmUsXG5cdFx0XHRlbmRMaW5lOiBlbmRMaW5lLFxuXHRcdFx0ZWRpdG9ySWQ6IGVkaXRvci5nZXRJZCgpLFxuXHRcdFx0X1VSSTogdXJpLFxuXHRcdFx0X3JlbW92ZVN0eWxlc0ZuczogbmV3IFNldCgpLFxuXHRcdFx0X21vdW50SW5mbzogbnVsbCxcblx0XHRcdF9saW5rZWRTdHJlYW1pbmdEaWZmWm9uZTogbnVsbCxcblx0XHR9XG5cdFx0Y29uc3QgY3RybEtab25lID0gdGhpcy5fYWRkRGlmZkFyZWEoYWRkaW5nKVxuXHRcdHRoaXMuX3JlZnJlc2hTdHlsZXNBbmREaWZmc0luVVJJKHVyaSlcblxuXHRcdG9uRmluaXNoRWRpdCgpXG5cdFx0cmV0dXJuIGN0cmxLWm9uZS5kaWZmYXJlYWlkXG5cdH1cblxuXHQvLyBfcmVtb3ZlIG1lYW5zIGRlbGV0ZSBhbmQgYWxzbyBhZGQgdG8gaGlzdG9yeVxuXHRwdWJsaWMgcmVtb3ZlQ3RybEtab25lKHsgZGlmZmFyZWFpZCB9OiB7IGRpZmZhcmVhaWQ6IG51bWJlciB9KSB7XG5cdFx0Y29uc3QgY3RybEtab25lID0gdGhpcy5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF1cblx0XHRpZiAoIWN0cmxLWm9uZSkgcmV0dXJuXG5cdFx0aWYgKGN0cmxLWm9uZS50eXBlICE9PSAnQ3RybEtab25lJykgcmV0dXJuXG5cblx0XHRjb25zdCB1cmkgPSBjdHJsS1pvbmUuX1VSSVxuXHRcdGNvbnN0IHsgb25GaW5pc2hFZGl0IH0gPSB0aGlzLl9hZGRUb0hpc3RvcnkodXJpKVxuXHRcdHRoaXMuX2RlbGV0ZUN0cmxLWm9uZShjdHJsS1pvbmUpXG5cdFx0dGhpcy5fcmVmcmVzaFN0eWxlc0FuZERpZmZzSW5VUkkodXJpKVxuXHRcdG9uRmluaXNoRWRpdCgpXG5cdH1cblxuXG5cblxuXHRwcml2YXRlIF9nZXRVUklCZWZvcmVTdGFydEFwcGx5aW5nKG9wdHM6IENhbGxCZWZvcmVTdGFydEFwcGx5aW5nT3B0cykge1xuXHRcdC8vIFNSXG5cdFx0aWYgKG9wdHMuZnJvbSA9PT0gJ0NsaWNrQXBwbHknKSB7XG5cdFx0XHRjb25zdCB1cmkgPSB0aGlzLl91cmlPZkdpdmVuVVJJKG9wdHMudXJpKVxuXHRcdFx0aWYgKCF1cmkpIHJldHVyblxuXHRcdFx0cmV0dXJuIHVyaVxuXHRcdH1cblx0XHRlbHNlIGlmIChvcHRzLmZyb20gPT09ICdRdWlja0VkaXQnKSB7XG5cdFx0XHRjb25zdCB7IGRpZmZhcmVhaWQgfSA9IG9wdHNcblx0XHRcdGNvbnN0IGN0cmxLWm9uZSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0XHRpZiAoY3RybEtab25lPy50eXBlICE9PSAnQ3RybEtab25lJykgcmV0dXJuXG5cdFx0XHRjb25zdCB7IF9VUkk6IHVyaSB9ID0gY3RybEtab25lXG5cdFx0XHRyZXR1cm4gdXJpXG5cdFx0fVxuXHRcdHJldHVyblxuXHR9XG5cblx0cHVibGljIGFzeW5jIGNhbGxCZWZvcmVBcHBseU9yRWRpdChnaXZlblVSSTogVVJJIHwgJ2N1cnJlbnQnKSB7XG5cdFx0Y29uc3QgdXJpID0gdGhpcy5fdXJpT2ZHaXZlblVSSShnaXZlblVSSSlcblx0XHRpZiAoIXVyaSkgcmV0dXJuXG5cdFx0YXdhaXQgdGhpcy5fdm9pZE1vZGVsU2VydmljZS5pbml0aWFsaXplTW9kZWwodXJpKVxuXHRcdGF3YWl0IHRoaXMuX3ZvaWRNb2RlbFNlcnZpY2Uuc2F2ZU1vZGVsKHVyaSkgLy8gc2F2ZSB0aGUgVVJJXG5cdH1cblxuXG5cdC8vIHRoZSBhcHBseURvbmVQcm9taXNlIHRoaXMgcmV0dXJucyBjYW4gcmVqZWN0LCBhbmQgc2hvdWxkIGJlIGNhdWdodCB3aXRoIC5jYXRjaFxuXHRwdWJsaWMgc3RhcnRBcHBseWluZyhvcHRzOiBTdGFydEFwcGx5aW5nT3B0cyk6IFtVUkksIFByb21pc2U8dm9pZD5dIHwgbnVsbCB7XG5cdFx0bGV0IHJlczogW0RpZmZab25lLCBQcm9taXNlPHZvaWQ+XSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXG5cdFx0aWYgKG9wdHMuZnJvbSA9PT0gJ1F1aWNrRWRpdCcpIHtcblx0XHRcdHJlcyA9IHRoaXMuX2luaXRpYWxpemVXcml0ZW92ZXJTdHJlYW0ob3B0cykgLy8gcmV3cml0ZVxuXHRcdH1cblx0XHRlbHNlIGlmIChvcHRzLmZyb20gPT09ICdDbGlja0FwcGx5Jykge1xuXHRcdFx0aWYgKHRoaXMuX3NldHRpbmdzU2VydmljZS5zdGF0ZS5nbG9iYWxTZXR0aW5ncy5lbmFibGVGYXN0QXBwbHkpIHtcblx0XHRcdFx0Y29uc3QgbnVtQ2hhcnNJbkZpbGUgPSB0aGlzLl9maWxlTGVuZ3RoT2ZHaXZlblVSSShvcHRzLnVyaSlcblx0XHRcdFx0aWYgKG51bUNoYXJzSW5GaWxlID09PSBudWxsKSByZXR1cm4gbnVsbFxuXHRcdFx0XHRpZiAobnVtQ2hhcnNJbkZpbGUgPCAxMDAwKSB7IC8vIHNsb3cgYXBwbHkgZm9yIHNob3J0IGZpbGVzIChlc3BlY2lhbGx5IGltcG9ydGFudCBmb3IgZW1wdHkgZmlsZXMpXG5cdFx0XHRcdFx0cmVzID0gdGhpcy5faW5pdGlhbGl6ZVdyaXRlb3ZlclN0cmVhbShvcHRzKVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHJlcyA9IHRoaXMuX2luaXRpYWxpemVTZWFyY2hBbmRSZXBsYWNlU3RyZWFtKG9wdHMpIC8vIGZhc3QgYXBwbHlcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHJlcyA9IHRoaXMuX2luaXRpYWxpemVXcml0ZW92ZXJTdHJlYW0ob3B0cykgLy8gcmV3cml0ZVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghcmVzKSByZXR1cm4gbnVsbFxuXHRcdGNvbnN0IFtkaWZmWm9uZSwgYXBwbHlEb25lUHJvbWlzZV0gPSByZXNcblx0XHRyZXR1cm4gW2RpZmZab25lLl9VUkksIGFwcGx5RG9uZVByb21pc2VdXG5cdH1cblxuXG5cdHB1YmxpYyBpbnN0YW50bHlBcHBseVNlYXJjaFJlcGxhY2VCbG9ja3MoeyB1cmksIHNlYXJjaFJlcGxhY2VCbG9ja3MgfTogeyB1cmk6IFVSSSwgc2VhcmNoUmVwbGFjZUJsb2Nrczogc3RyaW5nIH0pIHtcblx0XHQvLyBzdGFydCBkaWZmem9uZVxuXHRcdGNvbnN0IHJlcyA9IHRoaXMuX3N0YXJ0U3RyZWFtaW5nRGlmZlpvbmUoe1xuXHRcdFx0dXJpLFxuXHRcdFx0c3RyZWFtUmVxdWVzdElkUmVmOiB7IGN1cnJlbnQ6IG51bGwgfSxcblx0XHRcdHN0YXJ0QmVoYXZpb3I6ICdrZWVwLWNvbmZsaWN0cycsXG5cdFx0XHRsaW5rZWRDdHJsS1pvbmU6IG51bGwsXG5cdFx0XHRvbldpbGxVbmRvOiAoKSA9PiB7IH0sXG5cdFx0fSlcblx0XHRpZiAoIXJlcykgcmV0dXJuXG5cdFx0Y29uc3QgeyBkaWZmWm9uZSwgb25GaW5pc2hFZGl0IH0gPSByZXNcblxuXG5cdFx0Y29uc3Qgb25Eb25lID0gKCkgPT4ge1xuXHRcdFx0ZGlmZlpvbmUuX3N0cmVhbVN0YXRlID0geyBpc1N0cmVhbWluZzogZmFsc2UsIH1cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RyZWFtaW5nSW5EaWZmWm9uZS5maXJlKHsgdXJpLCBkaWZmYXJlYWlkOiBkaWZmWm9uZS5kaWZmYXJlYWlkIH0pXG5cdFx0XHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpXG5cdFx0XHRvbkZpbmlzaEVkaXQoKVxuXG5cdFx0XHQvLyBhdXRvIGFjY2VwdFxuXHRcdFx0aWYgKHRoaXMuX3NldHRpbmdzU2VydmljZS5zdGF0ZS5nbG9iYWxTZXR0aW5ncy5hdXRvQWNjZXB0TExNQ2hhbmdlcykge1xuXHRcdFx0XHR0aGlzLmFjY2VwdE9yUmVqZWN0QWxsRGlmZkFyZWFzKHsgdXJpLCByZW1vdmVDdHJsS3M6IGZhbHNlLCBiZWhhdmlvcjogJ2FjY2VwdCcgfSlcblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdGNvbnN0IG9uRXJyb3IgPSAoZTogeyBtZXNzYWdlOiBzdHJpbmc7IGZ1bGxFcnJvcjogRXJyb3IgfCBudWxsOyB9KSA9PiB7XG5cdFx0XHQvLyB0aGlzLl9ub3RpZnlFcnJvcihlKVxuXHRcdFx0b25Eb25lKClcblx0XHRcdHRoaXMuX3VuZG9IaXN0b3J5KHVyaSlcblx0XHRcdHRocm93IGUuZnVsbEVycm9yIHx8IG5ldyBFcnJvcihlLm1lc3NhZ2UpXG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2luc3RhbnRseUFwcGx5U1JCbG9ja3ModXJpLCBzZWFyY2hSZXBsYWNlQmxvY2tzKVxuXHRcdH1cblx0XHRjYXRjaCAoZSkge1xuXHRcdFx0b25FcnJvcih7IG1lc3NhZ2U6IGUgKyAnJywgZnVsbEVycm9yOiBudWxsIH0pXG5cdFx0fVxuXG5cdFx0b25Eb25lKClcblx0fVxuXG5cblx0cHVibGljIGluc3RhbnRseVJld3JpdGVGaWxlKHsgdXJpLCBuZXdDb250ZW50IH06IHsgdXJpOiBVUkksIG5ld0NvbnRlbnQ6IHN0cmluZyB9KSB7XG5cdFx0Ly8gc3RhcnQgZGlmZnpvbmVcblx0XHRjb25zdCByZXMgPSB0aGlzLl9zdGFydFN0cmVhbWluZ0RpZmZab25lKHtcblx0XHRcdHVyaSxcblx0XHRcdHN0cmVhbVJlcXVlc3RJZFJlZjogeyBjdXJyZW50OiBudWxsIH0sXG5cdFx0XHRzdGFydEJlaGF2aW9yOiAna2VlcC1jb25mbGljdHMnLFxuXHRcdFx0bGlua2VkQ3RybEtab25lOiBudWxsLFxuXHRcdFx0b25XaWxsVW5kbzogKCkgPT4geyB9LFxuXHRcdH0pXG5cdFx0aWYgKCFyZXMpIHJldHVyblxuXHRcdGNvbnN0IHsgZGlmZlpvbmUsIG9uRmluaXNoRWRpdCB9ID0gcmVzXG5cblxuXHRcdGNvbnN0IG9uRG9uZSA9ICgpID0+IHtcblx0XHRcdGRpZmZab25lLl9zdHJlYW1TdGF0ZSA9IHsgaXNTdHJlYW1pbmc6IGZhbHNlLCB9XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0cmVhbWluZ0luRGlmZlpvbmUuZmlyZSh7IHVyaSwgZGlmZmFyZWFpZDogZGlmZlpvbmUuZGlmZmFyZWFpZCB9KVxuXHRcdFx0dGhpcy5fcmVmcmVzaFN0eWxlc0FuZERpZmZzSW5VUkkodXJpKVxuXHRcdFx0b25GaW5pc2hFZGl0KClcblxuXHRcdFx0Ly8gYXV0byBhY2NlcHRcblx0XHRcdGlmICh0aGlzLl9zZXR0aW5nc1NlcnZpY2Uuc3RhdGUuZ2xvYmFsU2V0dGluZ3MuYXV0b0FjY2VwdExMTUNoYW5nZXMpIHtcblx0XHRcdFx0dGhpcy5hY2NlcHRPclJlamVjdEFsbERpZmZBcmVhcyh7IHVyaSwgcmVtb3ZlQ3RybEtzOiBmYWxzZSwgYmVoYXZpb3I6ICdhY2NlcHQnIH0pXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fd3JpdGVVUklUZXh0KHVyaSwgbmV3Q29udGVudCwgJ3dob2xlRmlsZVJhbmdlJywgeyBzaG91bGRSZWFsaWduRGlmZkFyZWFzOiB0cnVlIH0pXG5cdFx0b25Eb25lKClcblx0fVxuXG5cblx0cHJpdmF0ZSBfZmluZE92ZXJsYXBwaW5nRGlmZkFyZWEoeyBzdGFydExpbmUsIGVuZExpbmUsIHVyaSwgZmlsdGVyIH06IHsgc3RhcnRMaW5lOiBudW1iZXIsIGVuZExpbmU6IG51bWJlciwgdXJpOiBVUkksIGZpbHRlcj86IChkaWZmQXJlYTogRGlmZkFyZWEpID0+IGJvb2xlYW4gfSk6IERpZmZBcmVhIHwgbnVsbCB7XG5cdFx0Ly8gY2hlY2sgaWYgdGhlcmUncyBvdmVybGFwIHdpdGggYW55IG90aGVyIGRpZmZBcmVhcyBhbmQgcmV0dXJuIGVhcmx5IGlmIHRoZXJlIGlzXG5cdFx0Zm9yIChjb25zdCBkaWZmYXJlYWlkIG9mIHRoaXMuZGlmZkFyZWFzT2ZVUklbdXJpLmZzUGF0aF0gfHwgW10pIHtcblx0XHRcdGNvbnN0IGRpZmZBcmVhID0gdGhpcy5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF1cblx0XHRcdGlmICghZGlmZkFyZWEpIGNvbnRpbnVlXG5cdFx0XHRpZiAoIWZpbHRlcj8uKGRpZmZBcmVhKSkgY29udGludWVcblx0XHRcdGNvbnN0IG5vT3ZlcmxhcCA9IGRpZmZBcmVhLnN0YXJ0TGluZSA+IGVuZExpbmUgfHwgZGlmZkFyZWEuZW5kTGluZSA8IHN0YXJ0TGluZVxuXHRcdFx0aWYgKCFub092ZXJsYXApIHtcblx0XHRcdFx0cmV0dXJuIGRpZmZBcmVhXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsXG5cdH1cblxuXG5cblxuXG5cblxuXG5cdHByaXZhdGUgX3N0YXJ0U3RyZWFtaW5nRGlmZlpvbmUoe1xuXHRcdHVyaSxcblx0XHRzdGFydEJlaGF2aW9yLFxuXHRcdHN0cmVhbVJlcXVlc3RJZFJlZixcblx0XHRsaW5rZWRDdHJsS1pvbmUsXG5cdFx0b25XaWxsVW5kbyxcblx0fToge1xuXHRcdHVyaTogVVJJLFxuXHRcdHN0YXJ0QmVoYXZpb3I6ICdhY2NlcHQtY29uZmxpY3RzJyB8ICdyZWplY3QtY29uZmxpY3RzJyB8ICdrZWVwLWNvbmZsaWN0cycsXG5cdFx0c3RyZWFtUmVxdWVzdElkUmVmOiB7IGN1cnJlbnQ6IHN0cmluZyB8IG51bGwgfSxcblx0XHRsaW5rZWRDdHJsS1pvbmU6IEN0cmxLWm9uZSB8IG51bGwsXG5cdFx0b25XaWxsVW5kbzogKCkgPT4gdm9pZCxcblx0fSkge1xuXHRcdGNvbnN0IHsgbW9kZWwgfSA9IHRoaXMuX3ZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWwodXJpKVxuXHRcdGlmICghbW9kZWwpIHJldHVyblxuXG5cdFx0Ly8gdHJlYXQgbGlrZSBmdWxsIGZpbGUsIHVubGVzcyBsaW5rZWRDdHJsS1pvbmUgd2FzIHByb3ZpZGVkIGluIHdoaWNoIGNhc2UgdXNlIGl0cyBkaWZmJ3MgcmFuZ2VcblxuXHRcdGNvbnN0IHN0YXJ0TGluZSA9IGxpbmtlZEN0cmxLWm9uZSA/IGxpbmtlZEN0cmxLWm9uZS5zdGFydExpbmUgOiAxXG5cdFx0Y29uc3QgZW5kTGluZSA9IGxpbmtlZEN0cmxLWm9uZSA/IGxpbmtlZEN0cmxLWm9uZS5lbmRMaW5lIDogbW9kZWwuZ2V0TGluZUNvdW50KClcblx0XHRjb25zdCByYW5nZSA9IHsgc3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmUsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiBlbmRMaW5lLCBlbmRDb2x1bW46IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSIH1cblxuXHRcdGNvbnN0IG9yaWdpbmFsRmlsZVN0ciA9IG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpXG5cdFx0bGV0IG9yaWdpbmFsQ29kZSA9IG1vZGVsLmdldFZhbHVlSW5SYW5nZShyYW5nZSwgRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRilcblxuXG5cdFx0Ly8gYWRkIHRvIGhpc3RvcnkgYXMgYSBjaGVja3BvaW50LCBiZWZvcmUgd2Ugc3RhcnQgbW9kaWZ5aW5nXG5cdFx0Y29uc3QgeyBvbkZpbmlzaEVkaXQgfSA9IHRoaXMuX2FkZFRvSGlzdG9yeSh1cmksIHsgb25XaWxsVW5kbyB9KVxuXG5cdFx0Ly8gY2xlYXIgZGlmZlpvbmVzIHNvIG5vIGNvbmZsaWN0XG5cdFx0aWYgKHN0YXJ0QmVoYXZpb3IgPT09ICdrZWVwLWNvbmZsaWN0cycpIHtcblx0XHRcdGlmIChsaW5rZWRDdHJsS1pvbmUpIHtcblx0XHRcdFx0Ly8gY3RybGt6b25lIHNob3VsZCBuZXZlciBoYXZlIGFueSBjb25mbGljdHNcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHQvLyBrZWVwIGNvbmZsaWN0IG9uIHdob2xlIGZpbGUgLSB0byBrZWVwIGNvbmZsaWN0LCByZXZlcnQgdGhlIGNoYW5nZSBhbmQgdXNlIHRob3NlIGNvbnRlbnRzIGFzIG9yaWdpbmFsLCB0aGVuIHVuLXJldmVydCB0aGUgZmlsZVxuXHRcdFx0XHR0aGlzLmFjY2VwdE9yUmVqZWN0QWxsRGlmZkFyZWFzKHsgdXJpLCByZW1vdmVDdHJsS3M6IHRydWUsIGJlaGF2aW9yOiAncmVqZWN0JywgX2FkZFRvSGlzdG9yeTogZmFsc2UgfSlcblx0XHRcdFx0Y29uc3Qgb2xkRmlsZVN0ciA9IG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpIC8vIHVzZSB0aGlzIGFzIG9yaWdpbmFsIGNvZGVcblx0XHRcdFx0dGhpcy5fd3JpdGVVUklUZXh0KHVyaSwgb3JpZ2luYWxGaWxlU3RyLCAnd2hvbGVGaWxlUmFuZ2UnLCB7IHNob3VsZFJlYWxpZ25EaWZmQXJlYXM6IHRydWUgfSkgLy8gdW4tcmV2ZXJ0XG5cdFx0XHRcdG9yaWdpbmFsQ29kZSA9IG9sZEZpbGVTdHJcblx0XHRcdH1cblxuXHRcdH1cblx0XHRlbHNlIGlmIChzdGFydEJlaGF2aW9yID09PSAnYWNjZXB0LWNvbmZsaWN0cycgfHwgc3RhcnRCZWhhdmlvciA9PT0gJ3JlamVjdC1jb25mbGljdHMnKSB7XG5cdFx0XHRjb25zdCBiZWhhdmlvciA9IHN0YXJ0QmVoYXZpb3IgPT09ICdhY2NlcHQtY29uZmxpY3RzJyA/ICdhY2NlcHQnIDogJ3JlamVjdCdcblx0XHRcdHRoaXMuYWNjZXB0T3JSZWplY3RBbGxEaWZmQXJlYXMoeyB1cmksIHJlbW92ZUN0cmxLczogdHJ1ZSwgYmVoYXZpb3IsIF9hZGRUb0hpc3Rvcnk6IGZhbHNlIH0pXG5cdFx0fVxuXG5cdFx0Y29uc3QgYWRkaW5nOiBPbWl0PERpZmZab25lLCAnZGlmZmFyZWFpZCc+ID0ge1xuXHRcdFx0dHlwZTogJ0RpZmZab25lJyxcblx0XHRcdG9yaWdpbmFsQ29kZSxcblx0XHRcdHN0YXJ0TGluZSxcblx0XHRcdGVuZExpbmUsXG5cdFx0XHRfVVJJOiB1cmksXG5cdFx0XHRfc3RyZWFtU3RhdGU6IHtcblx0XHRcdFx0aXNTdHJlYW1pbmc6IHRydWUsXG5cdFx0XHRcdHN0cmVhbVJlcXVlc3RJZFJlZixcblx0XHRcdFx0bGluZTogc3RhcnRMaW5lLFxuXHRcdFx0fSxcblx0XHRcdF9kaWZmT2ZJZDoge30sIC8vIGFkZGVkIGxhdGVyXG5cdFx0XHRfcmVtb3ZlU3R5bGVzRm5zOiBuZXcgU2V0KCksXG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlmZlpvbmUgPSB0aGlzLl9hZGREaWZmQXJlYShhZGRpbmcpXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdHJlYW1pbmdJbkRpZmZab25lLmZpcmUoeyB1cmksIGRpZmZhcmVhaWQ6IGRpZmZab25lLmRpZmZhcmVhaWQgfSlcblx0XHR0aGlzLl9vbkRpZEFkZE9yRGVsZXRlRGlmZlpvbmVzLmZpcmUoeyB1cmkgfSlcblxuXHRcdC8vIGEgZmV3IGl0ZW1zIHJlbGF0ZWQgdG8gdGhlIGN0cmxLWm9uZSB0aGF0IHN0YXJ0ZWQgc3RyZWFtaW5nIHRoaXMgZGlmZlpvbmVcblx0XHRpZiAobGlua2VkQ3RybEtab25lKSB7XG5cdFx0XHRjb25zdCBjdHJsS1pvbmUgPSBsaW5rZWRDdHJsS1pvbmVcblx0XHRcdGN0cmxLWm9uZS5fbGlua2VkU3RyZWFtaW5nRGlmZlpvbmUgPSBkaWZmWm9uZS5kaWZmYXJlYWlkXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0cmVhbWluZ0luQ3RybEtab25lLmZpcmUoeyB1cmksIGRpZmZhcmVhaWQ6IGN0cmxLWm9uZS5kaWZmYXJlYWlkIH0pXG5cdFx0fVxuXG5cblx0XHRyZXR1cm4geyBkaWZmWm9uZSwgb25GaW5pc2hFZGl0IH1cblx0fVxuXG5cblxuXG5cdHByaXZhdGUgX3VyaUlzU3RyZWFtaW5nKHVyaTogVVJJKSB7XG5cdFx0Y29uc3QgZGlmZkFyZWFzID0gdGhpcy5kaWZmQXJlYXNPZlVSSVt1cmkuZnNQYXRoXVxuXHRcdGlmICghZGlmZkFyZWFzKSByZXR1cm4gZmFsc2Vcblx0XHRmb3IgKGNvbnN0IGRpZmZhcmVhaWQgb2YgZGlmZkFyZWFzKSB7XG5cdFx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0XHRpZiAoZGlmZkFyZWE/LnR5cGUgIT09ICdEaWZmWm9uZScpIGNvbnRpbnVlXG5cdFx0XHRpZiAoZGlmZkFyZWEuX3N0cmVhbVN0YXRlLmlzU3RyZWFtaW5nKSByZXR1cm4gdHJ1ZVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG5cblx0cHJpdmF0ZSBfaW5pdGlhbGl6ZVdyaXRlb3ZlclN0cmVhbShvcHRzOiBTdGFydEFwcGx5aW5nT3B0cyk6IFtEaWZmWm9uZSwgUHJvbWlzZTx2b2lkPl0gfCB1bmRlZmluZWQge1xuXG5cdFx0Y29uc3QgeyBmcm9tLCB9ID0gb3B0c1xuXHRcdGNvbnN0IGZlYXR1cmVOYW1lOiBGZWF0dXJlTmFtZSA9IG9wdHMuZnJvbSA9PT0gJ0NsaWNrQXBwbHknID8gJ0FwcGx5JyA6ICdDdHJsK0snXG5cdFx0Y29uc3Qgb3ZlcnJpZGVzT2ZNb2RlbCA9IHRoaXMuX3NldHRpbmdzU2VydmljZS5zdGF0ZS5vdmVycmlkZXNPZk1vZGVsXG5cdFx0Y29uc3QgbW9kZWxTZWxlY3Rpb24gPSB0aGlzLl9zZXR0aW5nc1NlcnZpY2Uuc3RhdGUubW9kZWxTZWxlY3Rpb25PZkZlYXR1cmVbZmVhdHVyZU5hbWVdXG5cdFx0Y29uc3QgbW9kZWxTZWxlY3Rpb25PcHRpb25zID0gbW9kZWxTZWxlY3Rpb24gPyB0aGlzLl9zZXR0aW5nc1NlcnZpY2Uuc3RhdGUub3B0aW9uc09mTW9kZWxTZWxlY3Rpb25bZmVhdHVyZU5hbWVdW21vZGVsU2VsZWN0aW9uLnByb3ZpZGVyTmFtZV0/Llttb2RlbFNlbGVjdGlvbi5tb2RlbE5hbWVdIDogdW5kZWZpbmVkXG5cblxuXHRcdGNvbnN0IHVyaSA9IHRoaXMuX2dldFVSSUJlZm9yZVN0YXJ0QXBwbHlpbmcob3B0cylcblx0XHRpZiAoIXVyaSkgcmV0dXJuXG5cblx0XHRsZXQgc3RhcnRSYW5nZTogJ2Z1bGxGaWxlJyB8IFtudW1iZXIsIG51bWJlcl1cblx0XHRsZXQgY3RybEtab25lSWZRdWlja0VkaXQ6IEN0cmxLWm9uZSB8IG51bGwgPSBudWxsXG5cblx0XHRpZiAoZnJvbSA9PT0gJ0NsaWNrQXBwbHknKSB7XG5cdFx0XHRzdGFydFJhbmdlID0gJ2Z1bGxGaWxlJ1xuXHRcdH1cblx0XHRlbHNlIGlmIChmcm9tID09PSAnUXVpY2tFZGl0Jykge1xuXHRcdFx0Y29uc3QgeyBkaWZmYXJlYWlkIH0gPSBvcHRzXG5cdFx0XHRjb25zdCBjdHJsS1pvbmUgPSB0aGlzLmRpZmZBcmVhT2ZJZFtkaWZmYXJlYWlkXVxuXHRcdFx0aWYgKGN0cmxLWm9uZT8udHlwZSAhPT0gJ0N0cmxLWm9uZScpIHJldHVyblxuXHRcdFx0Y3RybEtab25lSWZRdWlja0VkaXQgPSBjdHJsS1pvbmVcblx0XHRcdGNvbnN0IHsgc3RhcnRMaW5lOiBzdGFydExpbmVfLCBlbmRMaW5lOiBlbmRMaW5lXyB9ID0gY3RybEtab25lXG5cdFx0XHRzdGFydFJhbmdlID0gW3N0YXJ0TGluZV8sIGVuZExpbmVfXVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVm9pZDogZGlmZi50eXBlIG5vdCByZWNvZ25pemVkIG9uOiAke2Zyb219YClcblx0XHR9XG5cblx0XHRjb25zdCB7IG1vZGVsIH0gPSB0aGlzLl92b2lkTW9kZWxTZXJ2aWNlLmdldE1vZGVsKHVyaSlcblx0XHRpZiAoIW1vZGVsKSByZXR1cm5cblxuXHRcdGxldCBzdHJlYW1SZXF1ZXN0SWRSZWY6IHsgY3VycmVudDogc3RyaW5nIHwgbnVsbCB9ID0geyBjdXJyZW50OiBudWxsIH0gLy8gY2FuIHVzZSB0aGlzIGFzIGEgcHJveHkgdG8gc2V0IHRoZSBkaWZmQXJlYSdzIHN0cmVhbSBzdGF0ZSByZXF1ZXN0SWRcblxuXHRcdC8vIGJ1aWxkIG1lc3NhZ2VzXG5cdFx0Y29uc3QgcXVpY2tFZGl0RklNVGFncyA9IGRlZmF1bHRRdWlja0VkaXRGaW1UYWdzIC8vIFRPRE8gY2FuIGV2ZW50dWFsbHkgbGV0IHVzZXJzIGN1c3RvbWl6ZSBtb2RlbEZpbVRhZ3Ncblx0XHRjb25zdCBvcmlnaW5hbEZpbGVDb2RlID0gbW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRilcblx0XHRjb25zdCBvcmlnaW5hbENvZGUgPSBzdGFydFJhbmdlID09PSAnZnVsbEZpbGUnID8gb3JpZ2luYWxGaWxlQ29kZSA6IG9yaWdpbmFsRmlsZUNvZGUuc3BsaXQoJ1xcbicpLnNsaWNlKChzdGFydFJhbmdlWzBdIC0gMSksIChzdGFydFJhbmdlWzFdIC0gMSkgKyAxKS5qb2luKCdcXG4nKVxuXHRcdGNvbnN0IGxhbmd1YWdlID0gbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpXG5cdFx0bGV0IG1lc3NhZ2VzOiBMTE1DaGF0TWVzc2FnZVtdXG5cdFx0bGV0IHNlcGFyYXRlU3lzdGVtTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkXG5cdFx0aWYgKGZyb20gPT09ICdDbGlja0FwcGx5Jykge1xuXHRcdFx0Y29uc3QgeyBtZXNzYWdlczogYSwgc2VwYXJhdGVTeXN0ZW1NZXNzYWdlOiBiIH0gPSB0aGlzLl9jb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZS5wcmVwYXJlTExNU2ltcGxlTWVzc2FnZXMoe1xuXHRcdFx0XHRzeXN0ZW1NZXNzYWdlOiByZXdyaXRlQ29kZV9zeXN0ZW1NZXNzYWdlLFxuXHRcdFx0XHRzaW1wbGVNZXNzYWdlczogW3sgcm9sZTogJ3VzZXInLCBjb250ZW50OiByZXdyaXRlQ29kZV91c2VyTWVzc2FnZSh7IG9yaWdpbmFsQ29kZSwgYXBwbHlTdHI6IG9wdHMuYXBwbHlTdHIsIGxhbmd1YWdlIH0pLCB9XSxcblx0XHRcdFx0ZmVhdHVyZU5hbWUsXG5cdFx0XHRcdG1vZGVsU2VsZWN0aW9uLFxuXHRcdFx0fSlcblx0XHRcdG1lc3NhZ2VzID0gYVxuXHRcdFx0c2VwYXJhdGVTeXN0ZW1NZXNzYWdlID0gYlxuXHRcdH1cblx0XHRlbHNlIGlmIChmcm9tID09PSAnUXVpY2tFZGl0Jykge1xuXHRcdFx0aWYgKCFjdHJsS1pvbmVJZlF1aWNrRWRpdCkgcmV0dXJuXG5cdFx0XHRjb25zdCB7IF9tb3VudEluZm8gfSA9IGN0cmxLWm9uZUlmUXVpY2tFZGl0XG5cdFx0XHRjb25zdCBpbnN0cnVjdGlvbnMgPSBfbW91bnRJbmZvPy50ZXh0QXJlYVJlZi5jdXJyZW50Py52YWx1ZSA/PyAnJ1xuXG5cdFx0XHRjb25zdCBzdGFydExpbmUgPSBzdGFydFJhbmdlID09PSAnZnVsbEZpbGUnID8gMSA6IHN0YXJ0UmFuZ2VbMF1cblx0XHRcdGNvbnN0IGVuZExpbmUgPSBzdGFydFJhbmdlID09PSAnZnVsbEZpbGUnID8gbW9kZWwuZ2V0TGluZUNvdW50KCkgOiBzdGFydFJhbmdlWzFdXG5cdFx0XHRjb25zdCB7IHByZWZpeCwgc3VmZml4IH0gPSB2b2lkUHJlZml4QW5kU3VmZml4KHsgZnVsbEZpbGVTdHI6IG9yaWdpbmFsRmlsZUNvZGUsIHN0YXJ0TGluZSwgZW5kTGluZSB9KVxuXHRcdFx0Y29uc3QgdXNlckNvbnRlbnQgPSBjdHJsS1N0cmVhbV91c2VyTWVzc2FnZSh7IHNlbGVjdGlvbjogb3JpZ2luYWxDb2RlLCBpbnN0cnVjdGlvbnM6IGluc3RydWN0aW9ucywgcHJlZml4LCBzdWZmaXgsIGZpbVRhZ3M6IHF1aWNrRWRpdEZJTVRhZ3MsIGxhbmd1YWdlIH0pXG5cblx0XHRcdGNvbnN0IHsgbWVzc2FnZXM6IGEsIHNlcGFyYXRlU3lzdGVtTWVzc2FnZTogYiB9ID0gdGhpcy5fY29udmVydFRvTExNTWVzc2FnZVNlcnZpY2UucHJlcGFyZUxMTVNpbXBsZU1lc3NhZ2VzKHtcblx0XHRcdFx0c3lzdGVtTWVzc2FnZTogY3RybEtTdHJlYW1fc3lzdGVtTWVzc2FnZSh7IHF1aWNrRWRpdEZJTVRhZ3M6IHF1aWNrRWRpdEZJTVRhZ3MgfSksXG5cdFx0XHRcdHNpbXBsZU1lc3NhZ2VzOiBbeyByb2xlOiAndXNlcicsIGNvbnRlbnQ6IHVzZXJDb250ZW50LCB9XSxcblx0XHRcdFx0ZmVhdHVyZU5hbWUsXG5cdFx0XHRcdG1vZGVsU2VsZWN0aW9uLFxuXHRcdFx0fSlcblx0XHRcdG1lc3NhZ2VzID0gYVxuXHRcdFx0c2VwYXJhdGVTeXN0ZW1NZXNzYWdlID0gYlxuXG5cdFx0fVxuXHRcdGVsc2UgeyB0aHJvdyBuZXcgRXJyb3IoYGZlYXR1cmVOYW1lICR7ZnJvbX0gaXMgaW52YWxpZGApIH1cblxuXHRcdC8vIGlmIFVSSSBpcyBhbHJlYWR5IHN0cmVhbWluZywgcmV0dXJuIChzaG91bGQgbmV2ZXIgaGFwcGVuLCBjYWxsZXIgaXMgcmVzcG9uc2libGUgZm9yIGNoZWNraW5nKVxuXHRcdGlmICh0aGlzLl91cmlJc1N0cmVhbWluZyh1cmkpKSByZXR1cm5cblxuXHRcdC8vIHN0YXJ0IGRpZmZ6b25lXG5cdFx0Y29uc3QgcmVzID0gdGhpcy5fc3RhcnRTdHJlYW1pbmdEaWZmWm9uZSh7XG5cdFx0XHR1cmksXG5cdFx0XHRzdHJlYW1SZXF1ZXN0SWRSZWYsXG5cdFx0XHRzdGFydEJlaGF2aW9yOiBvcHRzLnN0YXJ0QmVoYXZpb3IsXG5cdFx0XHRsaW5rZWRDdHJsS1pvbmU6IGN0cmxLWm9uZUlmUXVpY2tFZGl0LFxuXHRcdFx0b25XaWxsVW5kbzogKCkgPT4ge1xuXHRcdFx0XHRpZiAoc3RyZWFtUmVxdWVzdElkUmVmLmN1cnJlbnQpIHtcblx0XHRcdFx0XHR0aGlzLl9sbG1NZXNzYWdlU2VydmljZS5hYm9ydChzdHJlYW1SZXF1ZXN0SWRSZWYuY3VycmVudClcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdH0pXG5cdFx0aWYgKCFyZXMpIHJldHVyblxuXHRcdGNvbnN0IHsgZGlmZlpvbmUsIG9uRmluaXNoRWRpdCwgfSA9IHJlc1xuXG5cblx0XHQvLyBoZWxwZXJzXG5cdFx0Y29uc3Qgb25Eb25lID0gKCkgPT4ge1xuXHRcdFx0Y29uc29sZS5sb2coJ2NhbGxlZCBvbkRvbmUnKVxuXHRcdFx0ZGlmZlpvbmUuX3N0cmVhbVN0YXRlID0geyBpc1N0cmVhbWluZzogZmFsc2UsIH1cblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RyZWFtaW5nSW5EaWZmWm9uZS5maXJlKHsgdXJpLCBkaWZmYXJlYWlkOiBkaWZmWm9uZS5kaWZmYXJlYWlkIH0pXG5cblx0XHRcdGlmIChjdHJsS1pvbmVJZlF1aWNrRWRpdCkge1xuXHRcdFx0XHRjb25zdCBjdHJsS1pvbmUgPSBjdHJsS1pvbmVJZlF1aWNrRWRpdFxuXG5cdFx0XHRcdGN0cmxLWm9uZS5fbGlua2VkU3RyZWFtaW5nRGlmZlpvbmUgPSBudWxsXG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RyZWFtaW5nSW5DdHJsS1pvbmUuZmlyZSh7IHVyaSwgZGlmZmFyZWFpZDogY3RybEtab25lLmRpZmZhcmVhaWQgfSlcblx0XHRcdFx0dGhpcy5fZGVsZXRlQ3RybEtab25lKGN0cmxLWm9uZSlcblx0XHRcdH1cblx0XHRcdHRoaXMuX3JlZnJlc2hTdHlsZXNBbmREaWZmc0luVVJJKHVyaSlcblx0XHRcdG9uRmluaXNoRWRpdCgpXG5cblx0XHRcdC8vIGF1dG8gYWNjZXB0XG5cdFx0XHRpZiAodGhpcy5fc2V0dGluZ3NTZXJ2aWNlLnN0YXRlLmdsb2JhbFNldHRpbmdzLmF1dG9BY2NlcHRMTE1DaGFuZ2VzKSB7XG5cdFx0XHRcdHRoaXMuYWNjZXB0T3JSZWplY3RBbGxEaWZmQXJlYXMoeyB1cmksIHJlbW92ZUN0cmxLczogZmFsc2UsIGJlaGF2aW9yOiAnYWNjZXB0JyB9KVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHRocm93c1xuXHRcdGNvbnN0IG9uRXJyb3IgPSAoZTogeyBtZXNzYWdlOiBzdHJpbmc7IGZ1bGxFcnJvcjogRXJyb3IgfCBudWxsOyB9KSA9PiB7XG5cdFx0XHQvLyB0aGlzLl9ub3RpZnlFcnJvcihlKVxuXHRcdFx0b25Eb25lKClcblx0XHRcdHRoaXMuX3VuZG9IaXN0b3J5KHVyaSlcblx0XHRcdHRocm93IGUuZnVsbEVycm9yIHx8IG5ldyBFcnJvcihlLm1lc3NhZ2UpXG5cdFx0fVxuXG5cdFx0Y29uc3QgZXh0cmFjdFRleHQgPSAoZnVsbFRleHQ6IHN0cmluZywgcmVjZW50bHlBZGRlZFRleHRMZW46IG51bWJlcikgPT4ge1xuXHRcdFx0aWYgKGZyb20gPT09ICdRdWlja0VkaXQnKSB7XG5cdFx0XHRcdHJldHVybiBleHRyYWN0Q29kZUZyb21GSU0oeyB0ZXh0OiBmdWxsVGV4dCwgcmVjZW50bHlBZGRlZFRleHRMZW4sIG1pZFRhZzogcXVpY2tFZGl0RklNVGFncy5taWRUYWcgfSlcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGZyb20gPT09ICdDbGlja0FwcGx5Jykge1xuXHRcdFx0XHRyZXR1cm4gZXh0cmFjdENvZGVGcm9tUmVndWxhcih7IHRleHQ6IGZ1bGxUZXh0LCByZWNlbnRseUFkZGVkVGV4dExlbiB9KVxuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdWb2lkIDEnKVxuXHRcdH1cblxuXHRcdC8vIHJlZnJlc2ggbm93IGluIGNhc2Ugb25UZXh0IHRha2VzIGEgd2hpbGUgdG8gZ2V0IDFzdCBtZXNzYWdlXG5cdFx0dGhpcy5fcmVmcmVzaFN0eWxlc0FuZERpZmZzSW5VUkkodXJpKVxuXG5cdFx0Y29uc3QgbGF0ZXN0U3RyZWFtTG9jYXRpb25NdXRhYmxlOiBTdHJlYW1Mb2NhdGlvbk11dGFibGUgPSB7IGxpbmU6IGRpZmZab25lLnN0YXJ0TGluZSwgYWRkZWRTcGxpdFlldDogZmFsc2UsIGNvbDogMSwgb3JpZ2luYWxDb2RlU3RhcnRMaW5lOiAxIH1cblxuXHRcdC8vIGFsbG93ZWQgdG8gdGhyb3cgZXJyb3JzIC0gdGhpcyBpcyBjYWxsZWQgaW5zaWRlIGEgcHJvbWlzZSB0aGF0IGhhbmRsZXMgZXZlcnl0aGluZ1xuXHRcdGNvbnN0IHJ1bldyaXRlb3ZlciA9IGFzeW5jICgpID0+IHtcblx0XHRcdGxldCBzaG91bGRTZW5kQW5vdGhlck1lc3NhZ2UgPSB0cnVlXG5cdFx0XHR3aGlsZSAoc2hvdWxkU2VuZEFub3RoZXJNZXNzYWdlKSB7XG5cdFx0XHRcdHNob3VsZFNlbmRBbm90aGVyTWVzc2FnZSA9IGZhbHNlXG5cblx0XHRcdFx0bGV0IHJlc01lc3NhZ2VEb25lUHJvbWlzZTogKCkgPT4gdm9pZCA9ICgpID0+IHsgfVxuXHRcdFx0XHRjb25zdCBtZXNzYWdlRG9uZVByb21pc2UgPSBuZXcgUHJvbWlzZTx2b2lkPigocmVzXykgPT4geyByZXNNZXNzYWdlRG9uZVByb21pc2UgPSByZXNfIH0pXG5cblx0XHRcdFx0Ly8gc3RhdGUgdXNlZCBpbiBvblRleHQ6XG5cdFx0XHRcdGxldCBmdWxsVGV4dFNvRmFyID0gJycgLy8gc28gZmFyIChJTkNMVURJTkcgaWdub3JlZCBzdWZmaXgpXG5cdFx0XHRcdGxldCBwcmV2SWdub3JlZFN1ZmZpeCA9ICcnXG5cdFx0XHRcdGxldCBhYm9ydGVkID0gZmFsc2Vcblx0XHRcdFx0bGV0IHdlQXJlQWJvcnRpbmcgPSBmYWxzZVxuXG5cblx0XHRcdFx0c3RyZWFtUmVxdWVzdElkUmVmLmN1cnJlbnQgPSB0aGlzLl9sbG1NZXNzYWdlU2VydmljZS5zZW5kTExNTWVzc2FnZSh7XG5cdFx0XHRcdFx0bWVzc2FnZXNUeXBlOiAnY2hhdE1lc3NhZ2VzJyxcblx0XHRcdFx0XHRsb2dnaW5nOiB7IGxvZ2dpbmdOYW1lOiBgRWRpdCAoV3JpdGVvdmVyKSAtICR7ZnJvbX1gIH0sXG5cdFx0XHRcdFx0bWVzc2FnZXMsXG5cdFx0XHRcdFx0bW9kZWxTZWxlY3Rpb24sXG5cdFx0XHRcdFx0bW9kZWxTZWxlY3Rpb25PcHRpb25zLFxuXHRcdFx0XHRcdG92ZXJyaWRlc09mTW9kZWwsXG5cdFx0XHRcdFx0c2VwYXJhdGVTeXN0ZW1NZXNzYWdlLFxuXHRcdFx0XHRcdGNoYXRNb2RlOiBudWxsLCAvLyBub3QgY2hhdFxuXHRcdFx0XHRcdG9uVGV4dDogKHBhcmFtcykgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgeyBmdWxsVGV4dDogZnVsbFRleHRfIH0gPSBwYXJhbXNcblx0XHRcdFx0XHRcdGNvbnN0IG5ld1RleHRfID0gZnVsbFRleHRfLnN1YnN0cmluZyhmdWxsVGV4dFNvRmFyLmxlbmd0aCwgSW5maW5pdHkpXG5cblx0XHRcdFx0XHRcdGNvbnN0IG5ld1RleHQgPSBwcmV2SWdub3JlZFN1ZmZpeCArIG5ld1RleHRfIC8vIGFkZCB0aGUgcHJldmlvdXNseSBpZ25vcmVkIHN1ZmZpeCBiZWNhdXNlIGl0J3Mgbm8gbG9uZ2VyIHRoZSBzdWZmaXghXG5cdFx0XHRcdFx0XHRmdWxsVGV4dFNvRmFyICs9IG5ld1RleHQgLy8gZnVsbCB0ZXh0LCBpbmNsdWRpbmcgYGBgLCBldGNcblxuXHRcdFx0XHRcdFx0Y29uc3QgW2Nyb3BwZWRUZXh0LCBkZWx0YUNyb3BwZWRUZXh0LCBjcm9wcGVkU3VmZml4XSA9IGV4dHJhY3RUZXh0KGZ1bGxUZXh0U29GYXIsIG5ld1RleHQubGVuZ3RoKVxuXHRcdFx0XHRcdFx0Y29uc3QgeyBlbmRMaW5lSW5MbG1UZXh0U29GYXIgfSA9IHRoaXMuX3dyaXRlU3RyZWFtZWREaWZmWm9uZUxMTVRleHQodXJpLCBvcmlnaW5hbENvZGUsIGNyb3BwZWRUZXh0LCBkZWx0YUNyb3BwZWRUZXh0LCBsYXRlc3RTdHJlYW1Mb2NhdGlvbk11dGFibGUpXG5cdFx0XHRcdFx0XHRkaWZmWm9uZS5fc3RyZWFtU3RhdGUubGluZSA9IChkaWZmWm9uZS5zdGFydExpbmUgLSAxKSArIGVuZExpbmVJbkxsbVRleHRTb0ZhciAvLyBjaGFuZ2UgY29vcmRpbmF0ZSBzeXN0ZW1zIGZyb20gb3JpZ2luYWxDb2RlIHRvIGZ1bGwgZmlsZVxuXG5cdFx0XHRcdFx0XHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpXG5cblx0XHRcdFx0XHRcdHByZXZJZ25vcmVkU3VmZml4ID0gY3JvcHBlZFN1ZmZpeFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b25GaW5hbE1lc3NhZ2U6IChwYXJhbXMpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHsgZnVsbFRleHQgfSA9IHBhcmFtc1xuXHRcdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ0RPTkUhIEZVTEwgVEVYVFxcbicsIGV4dHJhY3RUZXh0KGZ1bGxUZXh0KSwgZGlmZlpvbmUuc3RhcnRMaW5lLCBkaWZmWm9uZS5lbmRMaW5lKVxuXHRcdFx0XHRcdFx0Ly8gYXQgdGhlIGVuZCwgcmUtd3JpdGUgd2hvbGUgdGhpbmcgdG8gbWFrZSBzdXJlIG5vIHN5bmMgZXJyb3JzXG5cdFx0XHRcdFx0XHRjb25zdCBbY3JvcHBlZFRleHQsIF8xLCBfMl0gPSBleHRyYWN0VGV4dChmdWxsVGV4dCwgMClcblx0XHRcdFx0XHRcdHRoaXMuX3dyaXRlVVJJVGV4dCh1cmksIGNyb3BwZWRUZXh0LFxuXHRcdFx0XHRcdFx0XHR7IHN0YXJ0TGluZU51bWJlcjogZGlmZlpvbmUuc3RhcnRMaW5lLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogZGlmZlpvbmUuZW5kTGluZSwgZW5kQ29sdW1uOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiB9LCAvLyAxLWluZGV4ZWRcblx0XHRcdFx0XHRcdFx0eyBzaG91bGRSZWFsaWduRGlmZkFyZWFzOiB0cnVlIH1cblx0XHRcdFx0XHRcdClcblxuXHRcdFx0XHRcdFx0b25Eb25lKClcblx0XHRcdFx0XHRcdHJlc01lc3NhZ2VEb25lUHJvbWlzZSgpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvbkVycm9yOiAoZSkgPT4ge1xuXHRcdFx0XHRcdFx0b25FcnJvcihlKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b25BYm9ydDogKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHdlQXJlQWJvcnRpbmcpIHJldHVyblxuXHRcdFx0XHRcdFx0Ly8gc3RvcCB0aGUgbG9vcCB0byBmcmVlIHVwIHRoZSBwcm9taXNlLCBidXQgZG9uJ3QgbW9kaWZ5IHN0YXRlIChhbHJlYWR5IGhhbmRsZWQgYnkgd2hhdGV2ZXIgc3RvcHBlZCBpdClcblx0XHRcdFx0XHRcdGFib3J0ZWQgPSB0cnVlXG5cdFx0XHRcdFx0XHRyZXNNZXNzYWdlRG9uZVByb21pc2UoKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pXG5cdFx0XHRcdC8vIHNob3VsZCBuZXZlciBoYXBwZW4sIGp1c3QgZm9yIHNhZmV0eVxuXHRcdFx0XHRpZiAoc3RyZWFtUmVxdWVzdElkUmVmLmN1cnJlbnQgPT09IG51bGwpIHsgcmV0dXJuIH1cblxuXHRcdFx0XHRhd2FpdCBtZXNzYWdlRG9uZVByb21pc2Vcblx0XHRcdFx0aWYgKGFib3J0ZWQpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEVkaXQgd2FzIGludGVycnVwdGVkIGJ5IHRoZSB1c2VyLmApXG5cdFx0XHRcdH1cblx0XHRcdH0gLy8gZW5kIHdoaWxlXG5cdFx0fSAvLyBlbmQgd3JpdGVvdmVyXG5cblx0XHRjb25zdCBhcHBseURvbmVQcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4oKHJlcywgcmVqKSA9PiB7IHJ1bldyaXRlb3ZlcigpLnRoZW4ocmVzKS5jYXRjaChyZWopIH0pXG5cdFx0cmV0dXJuIFtkaWZmWm9uZSwgYXBwbHlEb25lUHJvbWlzZV1cblx0fVxuXG5cblxuXHRfdXJpT2ZHaXZlblVSSShnaXZlblVSSTogVVJJIHwgJ2N1cnJlbnQnKSB7XG5cdFx0aWYgKGdpdmVuVVJJID09PSAnY3VycmVudCcpIHtcblx0XHRcdGNvbnN0IHVyaV8gPSB0aGlzLl9nZXRBY3RpdmVFZGl0b3JVUkkoKVxuXHRcdFx0aWYgKCF1cmlfKSByZXR1cm5cblx0XHRcdHJldHVybiB1cmlfXG5cdFx0fVxuXHRcdHJldHVybiBnaXZlblVSSVxuXHR9XG5cdF9maWxlTGVuZ3RoT2ZHaXZlblVSSShnaXZlblVSSTogVVJJIHwgJ2N1cnJlbnQnKSB7XG5cdFx0Y29uc3QgdXJpID0gdGhpcy5fdXJpT2ZHaXZlblVSSShnaXZlblVSSSlcblx0XHRpZiAoIXVyaSkgcmV0dXJuIG51bGxcblx0XHRjb25zdCB7IG1vZGVsIH0gPSB0aGlzLl92b2lkTW9kZWxTZXJ2aWNlLmdldE1vZGVsKHVyaSlcblx0XHRpZiAoIW1vZGVsKSByZXR1cm4gbnVsbFxuXHRcdGNvbnN0IG51bUNoYXJzSW5GaWxlID0gbW9kZWwuZ2V0VmFsdWVMZW5ndGgoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRilcblx0XHRyZXR1cm4gbnVtQ2hhcnNJbkZpbGVcblx0fVxuXG5cblx0LyoqXG5cdCAqIEdlbmVyYXRlcyBhIGh1bWFuLXJlYWRhYmxlIGVycm9yIG1lc3NhZ2UgZm9yIGFuIGludmFsaWQgT1JJR0lOQUwgc2VhcmNoIGJsb2NrLlxuXHQgKi9cblx0cHJpdmF0ZSBfZXJyQ29udGVudE9mSW52YWxpZFN0ciA9IChcblx0XHRzdHI6ICdOb3QgZm91bmQnIHwgJ05vdCB1bmlxdWUnIHwgJ0hhcyBvdmVybGFwJyxcblx0XHRibG9ja09yaWc6IHN0cmluZyxcblx0KTogc3RyaW5nID0+IHtcblx0XHRjb25zdCBwcm9ibGVtYXRpY0NvZGUgPSBgJHt0cmlwbGVUaWNrWzBdfVxcbiR7SlNPTi5zdHJpbmdpZnkoYmxvY2tPcmlnKX1cXG4ke3RyaXBsZVRpY2tbMV19YFxuXG5cdFx0Ly8gdXNlIGEgc3dpdGNoIGZvciBiZXR0ZXIgcmVhZGFiaWxpdHkgLyBleGhhdXN0aXZlbmVzcyBjaGVja1xuXHRcdGxldCBkZXNjU3RyOiBzdHJpbmdcblx0XHRzd2l0Y2ggKHN0cikge1xuXHRcdFx0Y2FzZSAnTm90IGZvdW5kJzpcblx0XHRcdFx0ZGVzY1N0ciA9IGBUaGUgZWRpdCB3YXMgbm90IGFwcGxpZWQuIFRoZSB0ZXh0IGluIE9SSUdJTkFMIG11c3QgRVhBQ1RMWSBtYXRjaCBsaW5lcyBvZiBjb2RlIGluIHRoZSBmaWxlLCBidXQgdGhlcmUgd2FzIG5vIG1hdGNoIGZvcjpcXG4ke3Byb2JsZW1hdGljQ29kZX0uIEVuc3VyZSB5b3UgaGF2ZSB0aGUgbGF0ZXN0IHZlcnNpb24gb2YgdGhlIGZpbGUsIGFuZCBlbnN1cmUgdGhlIE9SSUdJTkFMIGNvZGUgbWF0Y2hlcyBhIGNvZGUgZXhjZXJwdCBleGFjdGx5LmBcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgJ05vdCB1bmlxdWUnOlxuXHRcdFx0XHRkZXNjU3RyID0gYFRoZSBlZGl0IHdhcyBub3QgYXBwbGllZC4gVGhlIHRleHQgaW4gT1JJR0lOQUwgbXVzdCBiZSB1bmlxdWUgaW4gdGhlIGZpbGUgYmVpbmcgZWRpdGVkLCBidXQgdGhlIGZvbGxvd2luZyBPUklHSU5BTCBjb2RlIGFwcGVhcnMgbXVsdGlwbGUgdGltZXMgaW4gdGhlIGZpbGU6XFxuJHtwcm9ibGVtYXRpY0NvZGV9LiBFbnN1cmUgeW91IGhhdmUgdGhlIGxhdGVzdCB2ZXJzaW9uIG9mIHRoZSBmaWxlLCBhbmQgZW5zdXJlIHRoZSBPUklHSU5BTCBjb2RlIGlzIHVuaXF1ZS5gXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlICdIYXMgb3ZlcmxhcCc6XG5cdFx0XHRcdGRlc2NTdHIgPSBgVGhlIGVkaXQgd2FzIG5vdCBhcHBsaWVkLiBUaGUgdGV4dCBpbiB0aGUgT1JJR0lOQUwgYmxvY2tzIG11c3Qgbm90IG92ZXJsYXAsIGJ1dCB0aGUgZm9sbG93aW5nIE9SSUdJTkFMIGNvZGUgaGFkIG92ZXJsYXAgd2l0aCBhbm90aGVyIE9SSUdJTkFMIHN0cmluZzpcXG4ke3Byb2JsZW1hdGljQ29kZX0uIEVuc3VyZSB5b3UgaGF2ZSB0aGUgbGF0ZXN0IHZlcnNpb24gb2YgdGhlIGZpbGUsIGFuZCBlbnN1cmUgdGhlIE9SSUdJTkFMIGNvZGUgYmxvY2tzIGRvIG5vdCBvdmVybGFwLmBcblx0XHRcdFx0YnJlYWtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGRlc2NTdHIgPSAnJ1xuXHRcdH1cblx0XHRyZXR1cm4gZGVzY1N0clxuXHR9XG5cblxuXHRwcml2YXRlIF9pbnN0YW50bHlBcHBseVNSQmxvY2tzKHVyaTogVVJJLCBibG9ja3NTdHI6IHN0cmluZykge1xuXHRcdGNvbnN0IGJsb2NrcyA9IGV4dHJhY3RTZWFyY2hSZXBsYWNlQmxvY2tzKGJsb2Nrc1N0cilcblx0XHRpZiAoYmxvY2tzLmxlbmd0aCA9PT0gMCkgdGhyb3cgbmV3IEVycm9yKGBObyBTZWFyY2gvUmVwbGFjZSBibG9ja3Mgd2VyZSByZWNlaXZlZCFgKVxuXG5cdFx0Y29uc3QgeyBtb2RlbCB9ID0gdGhpcy5fdm9pZE1vZGVsU2VydmljZS5nZXRNb2RlbCh1cmkpXG5cdFx0aWYgKCFtb2RlbCkgdGhyb3cgbmV3IEVycm9yKGBFcnJvciBhcHBseWluZyBTZWFyY2gvUmVwbGFjZSBibG9ja3M6IEZpbGUgZG9lcyBub3QgZXhpc3QuYClcblx0XHRjb25zdCBtb2RlbFN0ciA9IG1vZGVsLmdldFZhbHVlKEVuZE9mTGluZVByZWZlcmVuY2UuTEYpXG5cdFx0Ly8gLnNwbGl0KCdcXG4nKS5tYXAobCA9PiAnXFx0JyArIGwpLmpvaW4oJ1xcbicpIC8vIGZvciB0ZXN0aW5nIHB1cnBvc2VzIG9ubHksIHJlbWVtYmVyIHRvIHJlbW92ZSB0aGlzXG5cdFx0Y29uc3QgbW9kZWxTdHJMaW5lcyA9IG1vZGVsU3RyLnNwbGl0KCdcXG4nKVxuXG5cblxuXG5cdFx0Y29uc3QgcmVwbGFjZW1lbnRzOiB7IG9yaWdTdGFydDogbnVtYmVyOyBvcmlnRW5kOiBudW1iZXI7IGJsb2NrOiBFeHRyYWN0ZWRTZWFyY2hSZXBsYWNlQmxvY2sgfVtdID0gW11cblx0XHRmb3IgKGNvbnN0IGIgb2YgYmxvY2tzKSB7XG5cdFx0XHRjb25zdCByZXMgPSBmaW5kVGV4dEluQ29kZShiLm9yaWcsIG1vZGVsU3RyLCB0cnVlLCB7IHJldHVyblR5cGU6ICdsaW5lcycgfSlcblx0XHRcdGlmICh0eXBlb2YgcmVzID09PSAnc3RyaW5nJylcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKHRoaXMuX2VyckNvbnRlbnRPZkludmFsaWRTdHIocmVzLCBiLm9yaWcpKVxuXHRcdFx0bGV0IFtzdGFydExpbmUsIGVuZExpbmVdID0gcmVzXG5cdFx0XHRzdGFydExpbmUgLT0gMSAvLyAwLWluZGV4XG5cdFx0XHRlbmRMaW5lIC09IDFcblxuXHRcdFx0Ly8gaW5jbHVkaW5nIG5ld2xpbmUgYmVmb3JlIHN0YXJ0XG5cdFx0XHRjb25zdCBvcmlnU3RhcnQgPSAoc3RhcnRMaW5lICE9PSAwID9cblx0XHRcdFx0bW9kZWxTdHJMaW5lcy5zbGljZSgwLCBzdGFydExpbmUpLmpvaW4oJ1xcbicpICsgJ1xcbidcblx0XHRcdFx0OiAnJykubGVuZ3RoXG5cblx0XHRcdC8vIGluY2x1ZGluZyBlbmRsaW5lIGF0IGVuZFxuXHRcdFx0Y29uc3Qgb3JpZ0VuZCA9IG1vZGVsU3RyTGluZXMuc2xpY2UoMCwgZW5kTGluZSArIDEpLmpvaW4oJ1xcbicpLmxlbmd0aCAtIDFcblxuXHRcdFx0cmVwbGFjZW1lbnRzLnB1c2goeyBvcmlnU3RhcnQsIG9yaWdFbmQsIGJsb2NrOiBiIH0pO1xuXHRcdH1cblx0XHQvLyBzb3J0IGluIGluY3JlYXNpbmcgb3JkZXJcblx0XHRyZXBsYWNlbWVudHMuc29ydCgoYSwgYikgPT4gYS5vcmlnU3RhcnQgLSBiLm9yaWdTdGFydClcblxuXHRcdC8vIGVuc3VyZSBubyBvdmVybGFwXG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCByZXBsYWNlbWVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmIChyZXBsYWNlbWVudHNbaV0ub3JpZ1N0YXJ0IDw9IHJlcGxhY2VtZW50c1tpIC0gMV0ub3JpZ0VuZCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IodGhpcy5fZXJyQ29udGVudE9mSW52YWxpZFN0cignSGFzIG92ZXJsYXAnLCByZXBsYWNlbWVudHNbaV0/LmJsb2NrPy5vcmlnKSlcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBhcHBseSBlYWNoIHJlcGxhY2VtZW50IGZyb20gcmlnaHQgdG8gbGVmdCAoc28gaW5kZXhlcyBkb24ndCBzaGlmdClcblx0XHRsZXQgbmV3Q29kZTogc3RyaW5nID0gbW9kZWxTdHJcblx0XHRmb3IgKGxldCBpID0gcmVwbGFjZW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCB7IG9yaWdTdGFydCwgb3JpZ0VuZCwgYmxvY2sgfSA9IHJlcGxhY2VtZW50c1tpXVxuXHRcdFx0bmV3Q29kZSA9IG5ld0NvZGUuc2xpY2UoMCwgb3JpZ1N0YXJ0KSArIGJsb2NrLmZpbmFsICsgbmV3Q29kZS5zbGljZShvcmlnRW5kICsgMSwgSW5maW5pdHkpXG5cdFx0fVxuXG5cdFx0dGhpcy5fd3JpdGVVUklUZXh0KHVyaSwgbmV3Q29kZSxcblx0XHRcdCd3aG9sZUZpbGVSYW5nZScsXG5cdFx0XHR7IHNob3VsZFJlYWxpZ25EaWZmQXJlYXM6IHRydWUgfVxuXHRcdClcblx0fVxuXG5cdHByaXZhdGUgX2luaXRpYWxpemVTZWFyY2hBbmRSZXBsYWNlU3RyZWFtKG9wdHM6IFN0YXJ0QXBwbHlpbmdPcHRzICYgeyBmcm9tOiAnQ2xpY2tBcHBseScgfSk6IFtEaWZmWm9uZSwgUHJvbWlzZTx2b2lkPl0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHsgZnJvbSwgYXBwbHlTdHIsIH0gPSBvcHRzXG5cdFx0Y29uc3QgZmVhdHVyZU5hbWU6IEZlYXR1cmVOYW1lID0gJ0FwcGx5J1xuXHRcdGNvbnN0IG92ZXJyaWRlc09mTW9kZWwgPSB0aGlzLl9zZXR0aW5nc1NlcnZpY2Uuc3RhdGUub3ZlcnJpZGVzT2ZNb2RlbFxuXHRcdGNvbnN0IG1vZGVsU2VsZWN0aW9uID0gdGhpcy5fc2V0dGluZ3NTZXJ2aWNlLnN0YXRlLm1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlW2ZlYXR1cmVOYW1lXVxuXHRcdGNvbnN0IG1vZGVsU2VsZWN0aW9uT3B0aW9ucyA9IG1vZGVsU2VsZWN0aW9uID8gdGhpcy5fc2V0dGluZ3NTZXJ2aWNlLnN0YXRlLm9wdGlvbnNPZk1vZGVsU2VsZWN0aW9uW2ZlYXR1cmVOYW1lXVttb2RlbFNlbGVjdGlvbi5wcm92aWRlck5hbWVdPy5bbW9kZWxTZWxlY3Rpb24ubW9kZWxOYW1lXSA6IHVuZGVmaW5lZFxuXG5cdFx0Y29uc3QgdXJpID0gdGhpcy5fZ2V0VVJJQmVmb3JlU3RhcnRBcHBseWluZyhvcHRzKVxuXHRcdGlmICghdXJpKSByZXR1cm5cblxuXHRcdGNvbnN0IHsgbW9kZWwgfSA9IHRoaXMuX3ZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWwodXJpKVxuXHRcdGlmICghbW9kZWwpIHJldHVyblxuXG5cdFx0bGV0IHN0cmVhbVJlcXVlc3RJZFJlZjogeyBjdXJyZW50OiBzdHJpbmcgfCBudWxsIH0gPSB7IGN1cnJlbnQ6IG51bGwgfSAvLyBjYW4gdXNlIHRoaXMgYXMgYSBwcm94eSB0byBzZXQgdGhlIGRpZmZBcmVhJ3Mgc3RyZWFtIHN0YXRlIHJlcXVlc3RJZFxuXG5cblx0XHQvLyBidWlsZCBtZXNzYWdlcyAtIGFzayBMTE0gdG8gZ2VuZXJhdGUgc2VhcmNoL3JlcGxhY2UgYmxvY2sgdGV4dFxuXHRcdGNvbnN0IG9yaWdpbmFsRmlsZUNvZGUgPSBtb2RlbC5nZXRWYWx1ZShFbmRPZkxpbmVQcmVmZXJlbmNlLkxGKVxuXHRcdGNvbnN0IHVzZXJNZXNzYWdlQ29udGVudCA9IHNlYXJjaFJlcGxhY2VHaXZlbkRlc2NyaXB0aW9uX3VzZXJNZXNzYWdlKHsgb3JpZ2luYWxDb2RlOiBvcmlnaW5hbEZpbGVDb2RlLCBhcHBseVN0cjogYXBwbHlTdHIgfSlcblxuXHRcdGNvbnN0IHsgbWVzc2FnZXMsIHNlcGFyYXRlU3lzdGVtTWVzc2FnZTogc2VwYXJhdGVTeXN0ZW1NZXNzYWdlIH0gPSB0aGlzLl9jb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZS5wcmVwYXJlTExNU2ltcGxlTWVzc2FnZXMoe1xuXHRcdFx0c3lzdGVtTWVzc2FnZTogc2VhcmNoUmVwbGFjZUdpdmVuRGVzY3JpcHRpb25fc3lzdGVtTWVzc2FnZSxcblx0XHRcdHNpbXBsZU1lc3NhZ2VzOiBbeyByb2xlOiAndXNlcicsIGNvbnRlbnQ6IHVzZXJNZXNzYWdlQ29udGVudCwgfV0sXG5cdFx0XHRmZWF0dXJlTmFtZSxcblx0XHRcdG1vZGVsU2VsZWN0aW9uLFxuXHRcdH0pXG5cblx0XHQvLyBpZiBVUkkgaXMgYWxyZWFkeSBzdHJlYW1pbmcsIHJldHVybiAoc2hvdWxkIG5ldmVyIGhhcHBlbiwgY2FsbGVyIGlzIHJlc3BvbnNpYmxlIGZvciBjaGVja2luZylcblx0XHRpZiAodGhpcy5fdXJpSXNTdHJlYW1pbmcodXJpKSkgcmV0dXJuXG5cblx0XHQvLyBzdGFydCBkaWZmem9uZVxuXHRcdGNvbnN0IHJlcyA9IHRoaXMuX3N0YXJ0U3RyZWFtaW5nRGlmZlpvbmUoe1xuXHRcdFx0dXJpLFxuXHRcdFx0c3RyZWFtUmVxdWVzdElkUmVmLFxuXHRcdFx0c3RhcnRCZWhhdmlvcjogb3B0cy5zdGFydEJlaGF2aW9yLFxuXHRcdFx0bGlua2VkQ3RybEtab25lOiBudWxsLFxuXHRcdFx0b25XaWxsVW5kbzogKCkgPT4ge1xuXHRcdFx0XHRpZiAoc3RyZWFtUmVxdWVzdElkUmVmLmN1cnJlbnQpIHtcblx0XHRcdFx0XHR0aGlzLl9sbG1NZXNzYWdlU2VydmljZS5hYm9ydChzdHJlYW1SZXF1ZXN0SWRSZWYuY3VycmVudCkgLy8gdHJpZ2dlcnMgb25BYm9ydCgpXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSlcblx0XHRpZiAoIXJlcykgcmV0dXJuXG5cdFx0Y29uc3QgeyBkaWZmWm9uZSwgb25GaW5pc2hFZGl0IH0gPSByZXNcblxuXG5cdFx0Ly8gaGVscGVyc1xuXHRcdHR5cGUgU2VhcmNoUmVwbGFjZURpZmZBcmVhTWV0YWRhdGEgPSB7XG5cdFx0XHRvcmlnaW5hbEJvdW5kczogW251bWJlciwgbnVtYmVyXSwgLy8gMS1pbmRleGVkXG5cdFx0XHRvcmlnaW5hbENvZGU6IHN0cmluZyxcblx0XHR9XG5cdFx0Y29uc3QgY29udmVydE9yaWdpbmFsUmFuZ2VUb0ZpbmFsUmFuZ2UgPSAob3JpZ2luYWxSYW5nZTogcmVhZG9ubHkgW251bWJlciwgbnVtYmVyXSk6IFtudW1iZXIsIG51bWJlcl0gPT4ge1xuXHRcdFx0Ly8gYWRqdXN0IGJhc2VkIG9uIHRoZSBjaGFuZ2VzIGJ5IGNvbXB1dGluZyBsaW5lIG9mZnNldFxuXHRcdFx0Y29uc3QgW29yaWdpbmFsU3RhcnQsIG9yaWdpbmFsRW5kXSA9IG9yaWdpbmFsUmFuZ2Vcblx0XHRcdGxldCBsaW5lT2Zmc2V0ID0gMFxuXHRcdFx0Zm9yIChjb25zdCBibG9ja0RpZmZBcmVhIG9mIGFkZGVkVHJhY2tpbmdab25lT2ZCbG9ja051bSkge1xuXHRcdFx0XHRjb25zdCB7XG5cdFx0XHRcdFx0c3RhcnRMaW5lLCBlbmRMaW5lLFxuXHRcdFx0XHRcdG1ldGFkYXRhOiB7IG9yaWdpbmFsQm91bmRzOiBbb3JpZ2luYWxTdGFydDIsIG9yaWdpbmFsRW5kMl0sIH0sXG5cdFx0XHRcdH0gPSBibG9ja0RpZmZBcmVhXG5cdFx0XHRcdGlmIChvcmlnaW5hbFN0YXJ0MiA+PSBvcmlnaW5hbEVuZCkgY29udGludWVcblx0XHRcdFx0Y29uc3QgbnVtTmV3TGluZXMgPSBlbmRMaW5lIC0gc3RhcnRMaW5lICsgMVxuXHRcdFx0XHRjb25zdCBudW1PbGRMaW5lcyA9IG9yaWdpbmFsRW5kMiAtIG9yaWdpbmFsU3RhcnQyICsgMVxuXHRcdFx0XHRsaW5lT2Zmc2V0ICs9IG51bU5ld0xpbmVzIC0gbnVtT2xkTGluZXNcblx0XHRcdH1cblx0XHRcdHJldHVybiBbb3JpZ2luYWxTdGFydCArIGxpbmVPZmZzZXQsIG9yaWdpbmFsRW5kICsgbGluZU9mZnNldF1cblx0XHR9XG5cblxuXHRcdGNvbnN0IG9uRG9uZSA9ICgpID0+IHtcblx0XHRcdGRpZmZab25lLl9zdHJlYW1TdGF0ZSA9IHsgaXNTdHJlYW1pbmc6IGZhbHNlLCB9XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0cmVhbWluZ0luRGlmZlpvbmUuZmlyZSh7IHVyaSwgZGlmZmFyZWFpZDogZGlmZlpvbmUuZGlmZmFyZWFpZCB9KVxuXHRcdFx0dGhpcy5fcmVmcmVzaFN0eWxlc0FuZERpZmZzSW5VUkkodXJpKVxuXG5cdFx0XHQvLyBkZWxldGUgdGhlIHRyYWNraW5nIHpvbmVzXG5cdFx0XHRmb3IgKGNvbnN0IHRyYWNraW5nWm9uZSBvZiBhZGRlZFRyYWNraW5nWm9uZU9mQmxvY2tOdW0pXG5cdFx0XHRcdHRoaXMuX2RlbGV0ZVRyYWNraW5nWm9uZSh0cmFja2luZ1pvbmUpXG5cblx0XHRcdG9uRmluaXNoRWRpdCgpXG5cblx0XHRcdC8vIGF1dG8gYWNjZXB0XG5cdFx0XHRpZiAodGhpcy5fc2V0dGluZ3NTZXJ2aWNlLnN0YXRlLmdsb2JhbFNldHRpbmdzLmF1dG9BY2NlcHRMTE1DaGFuZ2VzKSB7XG5cdFx0XHRcdHRoaXMuYWNjZXB0T3JSZWplY3RBbGxEaWZmQXJlYXMoeyB1cmksIHJlbW92ZUN0cmxLczogZmFsc2UsIGJlaGF2aW9yOiAnYWNjZXB0JyB9KVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG9uRXJyb3IgPSAoZTogeyBtZXNzYWdlOiBzdHJpbmc7IGZ1bGxFcnJvcjogRXJyb3IgfCBudWxsOyB9KSA9PiB7XG5cdFx0XHQvLyB0aGlzLl9ub3RpZnlFcnJvcihlKVxuXHRcdFx0b25Eb25lKClcblx0XHRcdHRoaXMuX3VuZG9IaXN0b3J5KHVyaSlcblx0XHRcdHRocm93IGUuZnVsbEVycm9yIHx8IG5ldyBFcnJvcihlLm1lc3NhZ2UpXG5cdFx0fVxuXG5cdFx0Ly8gcmVmcmVzaCBub3cgaW4gY2FzZSBvblRleHQgdGFrZXMgYSB3aGlsZSB0byBnZXQgMXN0IG1lc3NhZ2Vcblx0XHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpXG5cblx0XHQvLyBzdHJlYW0gc3R5bGUgcmVsYXRlZCAtIFRPRE8gcmVwbGFjZSB0aGVzZSB3aXRoIHdoYXRldmVyIGJsb2NrIHdlJ3JlIG9uIGluaXRpYWxseSBpZiBhbHJlYWR5IHN0YXJ0ZWQgKGlmIGFkZCBjYWNoaW5nIG9mIGFwcGx5IFMvUiBibG9ja3MpXG5cdFx0bGV0IGxhdGVzdFN0cmVhbUxvY2F0aW9uTXV0YWJsZTogU3RyZWFtTG9jYXRpb25NdXRhYmxlIHwgbnVsbCA9IG51bGxcblx0XHRsZXQgc2hvdWxkVXBkYXRlT3JpZ1N0cmVhbVN0eWxlID0gdHJ1ZVxuXHRcdGxldCBvbGRCbG9ja3M6IEV4dHJhY3RlZFNlYXJjaFJlcGxhY2VCbG9ja1tdID0gW11cblx0XHRjb25zdCBhZGRlZFRyYWNraW5nWm9uZU9mQmxvY2tOdW06IFRyYWNraW5nWm9uZTxTZWFyY2hSZXBsYWNlRGlmZkFyZWFNZXRhZGF0YT5bXSA9IFtdXG5cdFx0ZGlmZlpvbmUuX3N0cmVhbVN0YXRlLmxpbmUgPSAxXG5cblx0XHRjb25zdCBOX1JFVFJJRVMgPSA0XG5cblx0XHQvLyBhbGxvd2VkIHRvIHRocm93IGVycm9ycyAtIHRoaXMgaXMgY2FsbGVkIGluc2lkZSBhIHByb21pc2UgdGhhdCBoYW5kbGVzIGV2ZXJ5dGhpbmdcblx0XHRjb25zdCBydW5TZWFyY2hSZXBsYWNlID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0Ly8gdGhpcyBnZW5lcmF0ZXMgPj4+Pj4+PiBPUklHSU5BTCA8PDw8PDw8IFJFUExBQ0UgYmxvY2tzIGFuZCBhbmQgc2ltdWx0YW5lb3VzbHkgYXBwbGllcyBpdFxuXHRcdFx0bGV0IHNob3VsZFNlbmRBbm90aGVyTWVzc2FnZSA9IHRydWVcblx0XHRcdGxldCBuTWVzc2FnZXNTZW50ID0gMFxuXHRcdFx0bGV0IGN1cnJTdHJlYW1pbmdCbG9ja051bSA9IDBcblx0XHRcdGxldCBhYm9ydGVkID0gZmFsc2Vcblx0XHRcdGxldCB3ZUFyZUFib3J0aW5nID0gZmFsc2Vcblx0XHRcdHdoaWxlIChzaG91bGRTZW5kQW5vdGhlck1lc3NhZ2UpIHtcblx0XHRcdFx0c2hvdWxkU2VuZEFub3RoZXJNZXNzYWdlID0gZmFsc2Vcblx0XHRcdFx0bk1lc3NhZ2VzU2VudCArPSAxXG5cdFx0XHRcdGlmIChuTWVzc2FnZXNTZW50ID49IE5fUkVUUklFUykge1xuXHRcdFx0XHRcdGNvbnN0IGUgPSB7XG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBgVHJpZWQgdG8gRmFzdCBBcHBseSAke05fUkVUUklFU30gdGltZXMgYnV0IGZhaWxlZC4gVGhpcyBtYXkgYmUgcmVsYXRlZCB0byBtb2RlbCBpbnRlbGxpZ2VuY2UsIG9yIGl0IG1heSBhbiBlZGl0IHRoYXQncyB0b28gY29tcGxleC4gUGxlYXNlIHJldHJ5IG9yIGRpc2FibGUgRmFzdCBBcHBseS5gLFxuXHRcdFx0XHRcdFx0ZnVsbEVycm9yOiBudWxsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG9uRXJyb3IoZSlcblx0XHRcdFx0XHRicmVha1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IHJlc01lc3NhZ2VEb25lUHJvbWlzZTogKCkgPT4gdm9pZCA9ICgpID0+IHsgfVxuXHRcdFx0XHRjb25zdCBtZXNzYWdlRG9uZVByb21pc2UgPSBuZXcgUHJvbWlzZTx2b2lkPigocmVzLCByZWopID0+IHsgcmVzTWVzc2FnZURvbmVQcm9taXNlID0gcmVzIH0pXG5cblxuXHRcdFx0XHRjb25zdCBvblRleHQgPSAocGFyYW1zOiB7IGZ1bGxUZXh0OiBzdHJpbmc7IGZ1bGxSZWFzb25pbmc6IHN0cmluZyB9KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgeyBmdWxsVGV4dCB9ID0gcGFyYW1zXG5cdFx0XHRcdFx0Ly8gYmxvY2tzIGFyZSBbZG9uZSBkb25lIGRvbmUgLi4uIHt3cml0aW5nRmluYWx8d3JpdGluZ09yaWdpbmFsfV1cblx0XHRcdFx0XHQvLyAgICAgICAgICAgICAgIF5cblx0XHRcdFx0XHQvLyAgICAgICAgICAgICAgY3VyclN0cmVhbWluZ0Jsb2NrTnVtXG5cblx0XHRcdFx0XHRjb25zdCBibG9ja3MgPSBleHRyYWN0U2VhcmNoUmVwbGFjZUJsb2NrcyhmdWxsVGV4dClcblxuXHRcdFx0XHRcdGZvciAobGV0IGJsb2NrTnVtID0gY3VyclN0cmVhbWluZ0Jsb2NrTnVtOyBibG9ja051bSA8IGJsb2Nrcy5sZW5ndGg7IGJsb2NrTnVtICs9IDEpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGJsb2NrID0gYmxvY2tzW2Jsb2NrTnVtXVxuXG5cdFx0XHRcdFx0XHRpZiAoYmxvY2suc3RhdGUgPT09ICd3cml0aW5nT3JpZ2luYWwnKSB7XG5cdFx0XHRcdFx0XHRcdC8vIHVwZGF0ZSBzdHJlYW0gc3RhdGUgdG8gdGhlIGZpcnN0IGxpbmUgb2Ygb3JpZ2luYWwgaWYgc29tZSBwb3J0aW9uIG9mIG9yaWdpbmFsIGhhcyBiZWVuIHdyaXR0ZW5cblx0XHRcdFx0XHRcdFx0aWYgKHNob3VsZFVwZGF0ZU9yaWdTdHJlYW1TdHlsZSAmJiBibG9jay5vcmlnLnRyaW0oKS5sZW5ndGggPj0gMjApIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBzdGFydGluZ0F0TGluZSA9IGRpZmZab25lLl9zdHJlYW1TdGF0ZS5saW5lID8/IDEgLy8gZG9udCBnbyBiYWNrd2FyZHMgaWYgYWxyZWFkeSBoYXZlIGEgc3RyZWFtIGxpbmVcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbFJhbmdlID0gZmluZFRleHRJbkNvZGUoYmxvY2sub3JpZywgb3JpZ2luYWxGaWxlQ29kZSwgZmFsc2UsIHsgc3RhcnRpbmdBdExpbmUsIHJldHVyblR5cGU6ICdsaW5lcycgfSlcblx0XHRcdFx0XHRcdFx0XHRpZiAodHlwZW9mIG9yaWdpbmFsUmFuZ2UgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBbc3RhcnRMaW5lLCBfXSA9IGNvbnZlcnRPcmlnaW5hbFJhbmdlVG9GaW5hbFJhbmdlKG9yaWdpbmFsUmFuZ2UpXG5cdFx0XHRcdFx0XHRcdFx0XHRkaWZmWm9uZS5fc3RyZWFtU3RhdGUubGluZSA9IHN0YXJ0TGluZVxuXHRcdFx0XHRcdFx0XHRcdFx0c2hvdWxkVXBkYXRlT3JpZ1N0cmVhbVN0eWxlID0gZmFsc2Vcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHQvLyAvLyBzdGFydGluZyBsaW5lIGlzIGF0IGxlYXN0IHRoZSBudW1iZXIgb2YgbGluZXMgaW4gdGhlIGdlbmVyYXRlZCBjb2RlIG1pbnVzIDFcblx0XHRcdFx0XHRcdFx0Ly8gY29uc3QgbnVtTGluZXNJbk9yaWcgPSBudW1MaW5lc09mU3RyKGJsb2NrLm9yaWcpXG5cdFx0XHRcdFx0XHRcdC8vIGNvbnN0IG5ld0xpbmUgPSBNYXRoLm1heChudW1MaW5lc0luT3JpZyAtIDEsIDEsIGRpZmZab25lLl9zdHJlYW1TdGF0ZS5saW5lID8/IDEpXG5cdFx0XHRcdFx0XHRcdC8vIGlmIChuZXdMaW5lICE9PSBkaWZmWm9uZS5fc3RyZWFtU3RhdGUubGluZSkge1xuXHRcdFx0XHRcdFx0XHQvLyBcdGRpZmZab25lLl9zdHJlYW1TdGF0ZS5saW5lID0gbmV3TGluZVxuXHRcdFx0XHRcdFx0XHQvLyBcdHRoaXMuX3JlZnJlc2hTdHlsZXNBbmREaWZmc0luVVJJKHVyaSlcblx0XHRcdFx0XHRcdFx0Ly8gfVxuXG5cblx0XHRcdFx0XHRcdFx0Ly8gbXVzdCBiZSBkb25lIHdyaXRpbmcgb3JpZ2luYWwgdG8gbW92ZSBvbiB0byB3cml0aW5nIHN0cmVhbWVkIGNvbnRlbnRcblx0XHRcdFx0XHRcdFx0Y29udGludWVcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHNob3VsZFVwZGF0ZU9yaWdTdHJlYW1TdHlsZSA9IHRydWVcblxuXG5cdFx0XHRcdFx0XHQvLyBpZiB0aGlzIGlzIHRoZSBmaXJzdCB0aW1lIHdlJ3JlIHNlZWluZyB0aGlzIGJsb2NrLCBhZGQgaXQgYXMgYSBkaWZmYXJlYSBzbyB3ZSBjYW4gc3RhcnQgc3RyZWFtaW5nIGluIGl0XG5cdFx0XHRcdFx0XHRpZiAoIShibG9ja051bSBpbiBhZGRlZFRyYWNraW5nWm9uZU9mQmxvY2tOdW0pKSB7XG5cblx0XHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxCb3VuZHMgPSBmaW5kVGV4dEluQ29kZShibG9jay5vcmlnLCBvcmlnaW5hbEZpbGVDb2RlLCB0cnVlLCB7IHJldHVyblR5cGU6ICdsaW5lcycgfSlcblx0XHRcdFx0XHRcdFx0Ly8gaWYgZXJyb3Jcblx0XHRcdFx0XHRcdFx0Ly8gQ2hlY2sgZm9yIG92ZXJsYXAgd2l0aCBleGlzdGluZyBtb2RpZmllZCByYW5nZXNcblx0XHRcdFx0XHRcdFx0Y29uc3QgaGFzT3ZlcmxhcCA9IGFkZGVkVHJhY2tpbmdab25lT2ZCbG9ja051bS5zb21lKHRyYWNraW5nWm9uZSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgW2V4aXN0aW5nU3RhcnQsIGV4aXN0aW5nRW5kXSA9IHRyYWNraW5nWm9uZS5tZXRhZGF0YS5vcmlnaW5hbEJvdW5kcztcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBoYXNOb092ZXJsYXAgPSBlbmRMaW5lIDwgZXhpc3RpbmdTdGFydCB8fCBzdGFydExpbmUgPiBleGlzdGluZ0VuZFxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiAhaGFzTm9PdmVybGFwXG5cdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2Ygb3JpZ2luYWxCb3VuZHMgPT09ICdzdHJpbmcnIHx8IGhhc092ZXJsYXApIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBlcnJvck1lc3NhZ2UgPSB0eXBlb2Ygb3JpZ2luYWxCb3VuZHMgPT09ICdzdHJpbmcnID8gb3JpZ2luYWxCb3VuZHMgOiAnSGFzIG92ZXJsYXAnIGFzIGNvbnN0XG5cblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnLS0tLS0tLS0tLS0tLS1FcnJvciBmaW5kaW5nIHRleHQgaW4gY29kZTonKVxuXHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdvcmlnaW5hbEZpbGVDb2RlJywgeyBvcmlnaW5hbEZpbGVDb2RlIH0pXG5cdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ2Z1bGxUZXh0JywgeyBmdWxsVGV4dCB9KVxuXHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdlcnJvcjonLCBlcnJvck1lc3NhZ2UpXG5cdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ2Jsb2NrLm9yaWc6JywgYmxvY2sub3JpZylcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnLS0tLS0tLS0tJylcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gdGhpcy5fZXJyQ29udGVudE9mSW52YWxpZFN0cihlcnJvck1lc3NhZ2UsIGJsb2NrLm9yaWcpXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgcmV0cnlNc2cgPSAnQWxsIG9mIHlvdXIgcHJldmlvdXMgb3V0cHV0cyBoYXZlIGJlZW4gaWdub3JlZC4gUGxlYXNlIHJlLW91dHB1dCBBTEwgU0VBUkNIL1JFUExBQ0UgYmxvY2tzIHN0YXJ0aW5nIGZyb20gdGhlIGZpcnN0IG9uZSwgYW5kIGF2b2lkIHRoZSBlcnJvciB0aGlzIHRpbWUuJ1xuXHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2VzLnB1c2goXG5cdFx0XHRcdFx0XHRcdFx0XHR7IHJvbGU6ICdhc3Npc3RhbnQnLCBjb250ZW50OiBmdWxsVGV4dCB9LCAvLyBsYXRlc3Qgb3V0cHV0XG5cdFx0XHRcdFx0XHRcdFx0XHR7IHJvbGU6ICd1c2VyJywgY29udGVudDogY29udGVudCArICdcXG4nICsgcmV0cnlNc2cgfSAvLyB1c2VyIGV4cGxhbmF0aW9uIG9mIHdoYXQncyB3cm9uZ1xuXHRcdFx0XHRcdFx0XHRcdClcblxuXHRcdFx0XHRcdFx0XHRcdC8vIFJFVkVSVCBBTEwgQkxPQ0tTXG5cdFx0XHRcdFx0XHRcdFx0Y3VyclN0cmVhbWluZ0Jsb2NrTnVtID0gMFxuXHRcdFx0XHRcdFx0XHRcdGxhdGVzdFN0cmVhbUxvY2F0aW9uTXV0YWJsZSA9IG51bGxcblx0XHRcdFx0XHRcdFx0XHRzaG91bGRVcGRhdGVPcmlnU3RyZWFtU3R5bGUgPSB0cnVlXG5cdFx0XHRcdFx0XHRcdFx0b2xkQmxvY2tzID0gW11cblx0XHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHRyYWNraW5nWm9uZSBvZiBhZGRlZFRyYWNraW5nWm9uZU9mQmxvY2tOdW0pXG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl9kZWxldGVUcmFja2luZ1pvbmUodHJhY2tpbmdab25lKVxuXHRcdFx0XHRcdFx0XHRcdGFkZGVkVHJhY2tpbmdab25lT2ZCbG9ja051bS5zcGxpY2UoMCwgSW5maW5pdHkpXG5cblx0XHRcdFx0XHRcdFx0XHR0aGlzLl93cml0ZVVSSVRleHQodXJpLCBvcmlnaW5hbEZpbGVDb2RlLCAnd2hvbGVGaWxlUmFuZ2UnLCB7IHNob3VsZFJlYWxpZ25EaWZmQXJlYXM6IHRydWUgfSlcblxuXHRcdFx0XHRcdFx0XHRcdC8vIGFib3J0IGFuZCByZXNvbHZlXG5cdFx0XHRcdFx0XHRcdFx0c2hvdWxkU2VuZEFub3RoZXJNZXNzYWdlID0gdHJ1ZVxuXHRcdFx0XHRcdFx0XHRcdGlmIChzdHJlYW1SZXF1ZXN0SWRSZWYuY3VycmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0d2VBcmVBYm9ydGluZyA9IHRydWVcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMuX2xsbU1lc3NhZ2VTZXJ2aWNlLmFib3J0KHN0cmVhbVJlcXVlc3RJZFJlZi5jdXJyZW50KVxuXHRcdFx0XHRcdFx0XHRcdFx0d2VBcmVBYm9ydGluZyA9IGZhbHNlXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdGRpZmZab25lLl9zdHJlYW1TdGF0ZS5saW5lID0gMVxuXHRcdFx0XHRcdFx0XHRcdHJlc01lc3NhZ2VEb25lUHJvbWlzZSgpXG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fcmVmcmVzaFN0eWxlc0FuZERpZmZzSW5VUkkodXJpKVxuXHRcdFx0XHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHRcdFx0XHR9XG5cblxuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IFtzdGFydExpbmUsIGVuZExpbmVdID0gY29udmVydE9yaWdpbmFsUmFuZ2VUb0ZpbmFsUmFuZ2Uob3JpZ2luYWxCb3VuZHMpXG5cblx0XHRcdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJy0tLS0tLS0tLWFkZGluZy0tLS0tLS0nKVxuXHRcdFx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZygnQ1VSUkVOVCBURVhUISEhJywgeyBjdXJyZW50OiBtb2RlbD8uZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRikgfSlcblx0XHRcdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ2Jsb2NrJywgZGVlcENsb25lKGJsb2NrKSlcblx0XHRcdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ29yaWdCb3VuZHMnLCBvcmlnaW5hbEJvdW5kcylcblx0XHRcdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ3N0YXJ0IGVuZCcsIHN0YXJ0TGluZSwgZW5kTGluZSlcblxuXHRcdFx0XHRcdFx0XHQvLyBvdGhlcndpc2UgaWYgbm8gZXJyb3IsIGFkZCB0aGUgcG9zaXRpb24gYXMgYSBkaWZmYXJlYVxuXHRcdFx0XHRcdFx0XHRjb25zdCBhZGRpbmc6IE9taXQ8VHJhY2tpbmdab25lPFNlYXJjaFJlcGxhY2VEaWZmQXJlYU1ldGFkYXRhPiwgJ2RpZmZhcmVhaWQnPiA9IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnVHJhY2tpbmdab25lJyxcblx0XHRcdFx0XHRcdFx0XHRzdGFydExpbmU6IHN0YXJ0TGluZSxcblx0XHRcdFx0XHRcdFx0XHRlbmRMaW5lOiBlbmRMaW5lLFxuXHRcdFx0XHRcdFx0XHRcdF9VUkk6IHVyaSxcblx0XHRcdFx0XHRcdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRcdFx0XHRcdFx0b3JpZ2luYWxCb3VuZHM6IFsuLi5vcmlnaW5hbEJvdW5kc10sXG5cdFx0XHRcdFx0XHRcdFx0XHRvcmlnaW5hbENvZGU6IGJsb2NrLm9yaWcsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRjb25zdCB0cmFja2luZ1pvbmUgPSB0aGlzLl9hZGREaWZmQXJlYShhZGRpbmcpXG5cdFx0XHRcdFx0XHRcdGFkZGVkVHJhY2tpbmdab25lT2ZCbG9ja051bS5wdXNoKHRyYWNraW5nWm9uZSlcblx0XHRcdFx0XHRcdFx0bGF0ZXN0U3RyZWFtTG9jYXRpb25NdXRhYmxlID0geyBsaW5lOiBzdGFydExpbmUsIGFkZGVkU3BsaXRZZXQ6IGZhbHNlLCBjb2w6IDEsIG9yaWdpbmFsQ29kZVN0YXJ0TGluZTogMSB9XG5cdFx0XHRcdFx0XHR9IC8vIGVuZCBhZGRpbmcgZGlmZmFyZWFcblxuXG5cdFx0XHRcdFx0XHQvLyBzaG91bGQgYWx3YXlzIGJlIGluIHN0cmVhbWluZyBzdGF0ZSBoZXJlXG5cdFx0XHRcdFx0XHRpZiAoIWRpZmZab25lLl9zdHJlYW1TdGF0ZS5pc1N0cmVhbWluZykge1xuXHRcdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdEaWZmWm9uZSB3YXMgbm90IGluIHN0cmVhbWluZyBzdGF0ZSBpbiBfaW5pdGlhbGl6ZVNlYXJjaEFuZFJlcGxhY2VTdHJlYW0nKVxuXHRcdFx0XHRcdFx0XHRjb250aW51ZVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBpZiBhIGJsb2NrIGlzIGRvbmUsIGZpbmlzaCBpdCBieSB3cml0aW5nIGFsbFxuXHRcdFx0XHRcdFx0aWYgKGJsb2NrLnN0YXRlID09PSAnZG9uZScpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgeyBzdGFydExpbmU6IGZpbmFsU3RhcnRMaW5lLCBlbmRMaW5lOiBmaW5hbEVuZExpbmUgfSA9IGFkZGVkVHJhY2tpbmdab25lT2ZCbG9ja051bVtibG9ja051bV1cblx0XHRcdFx0XHRcdFx0dGhpcy5fd3JpdGVVUklUZXh0KHVyaSwgYmxvY2suZmluYWwsXG5cdFx0XHRcdFx0XHRcdFx0eyBzdGFydExpbmVOdW1iZXI6IGZpbmFsU3RhcnRMaW5lLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogZmluYWxFbmRMaW5lLCBlbmRDb2x1bW46IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSIH0sIC8vIDEtaW5kZXhlZFxuXHRcdFx0XHRcdFx0XHRcdHsgc2hvdWxkUmVhbGlnbkRpZmZBcmVhczogdHJ1ZSB9XG5cdFx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdFx0ZGlmZlpvbmUuX3N0cmVhbVN0YXRlLmxpbmUgPSBmaW5hbEVuZExpbmUgKyAxXG5cdFx0XHRcdFx0XHRcdGN1cnJTdHJlYW1pbmdCbG9ja051bSA9IGJsb2NrTnVtICsgMVxuXHRcdFx0XHRcdFx0XHRjb250aW51ZVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyB3cml0ZSB0aGUgYWRkZWQgdGV4dCB0byB0aGUgZmlsZVxuXHRcdFx0XHRcdFx0aWYgKCFsYXRlc3RTdHJlYW1Mb2NhdGlvbk11dGFibGUpIGNvbnRpbnVlXG5cdFx0XHRcdFx0XHRjb25zdCBvbGRCbG9jayA9IG9sZEJsb2Nrc1tibG9ja051bV1cblx0XHRcdFx0XHRcdGNvbnN0IG9sZEZpbmFsTGVuID0gKG9sZEJsb2NrPy5maW5hbCA/PyAnJykubGVuZ3RoXG5cdFx0XHRcdFx0XHRjb25zdCBkZWx0YUZpbmFsVGV4dCA9IGJsb2NrLmZpbmFsLnN1YnN0cmluZyhvbGRGaW5hbExlbiwgSW5maW5pdHkpXG5cblx0XHRcdFx0XHRcdHRoaXMuX3dyaXRlU3RyZWFtZWREaWZmWm9uZUxMTVRleHQodXJpLCBibG9jay5vcmlnLCBibG9jay5maW5hbCwgZGVsdGFGaW5hbFRleHQsIGxhdGVzdFN0cmVhbUxvY2F0aW9uTXV0YWJsZSlcblx0XHRcdFx0XHRcdG9sZEJsb2NrcyA9IGJsb2NrcyAvLyBvbGRibG9ja3MgaXMgb25seSB1c2VkIGlmIHdyaXRpbmdGaW5hbFxuXG5cdFx0XHRcdFx0XHQvLyBjb25zdCB7IGVuZExpbmU6IGN1cnJlbnRFbmRMaW5lIH0gPSBhZGRlZFRyYWNraW5nWm9uZU9mQmxvY2tOdW1bYmxvY2tOdW1dIC8vIHdvdWxkIGJlIGJhZCB0byBkbyB0aGlzIGJlY2F1c2UgYSBsb3Qgb2YgdGhlIGJvdHRvbSBsaW5lcyBtaWdodCBiZSB0aGUgc2FtZS4gbW9yZSBhY2N1cmF0ZSB0byBnbyB3aXRoIGxhdGVzdFN0cmVhbUxvY2F0aW9uTXV0YWJsZVxuXHRcdFx0XHRcdFx0Ly8gZGlmZlpvbmUuX3N0cmVhbVN0YXRlLmxpbmUgPSBjdXJyZW50RW5kTGluZVxuXHRcdFx0XHRcdFx0ZGlmZlpvbmUuX3N0cmVhbVN0YXRlLmxpbmUgPSBsYXRlc3RTdHJlYW1Mb2NhdGlvbk11dGFibGUubGluZVxuXG5cdFx0XHRcdFx0fSAvLyBlbmQgZm9yXG5cblx0XHRcdFx0XHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzdHJlYW1SZXF1ZXN0SWRSZWYuY3VycmVudCA9IHRoaXMuX2xsbU1lc3NhZ2VTZXJ2aWNlLnNlbmRMTE1NZXNzYWdlKHtcblx0XHRcdFx0XHRtZXNzYWdlc1R5cGU6ICdjaGF0TWVzc2FnZXMnLFxuXHRcdFx0XHRcdGxvZ2dpbmc6IHsgbG9nZ2luZ05hbWU6IGBFZGl0IChTZWFyY2gvUmVwbGFjZSkgLSAke2Zyb219YCB9LFxuXHRcdFx0XHRcdG1lc3NhZ2VzLFxuXHRcdFx0XHRcdG1vZGVsU2VsZWN0aW9uLFxuXHRcdFx0XHRcdG1vZGVsU2VsZWN0aW9uT3B0aW9ucyxcblx0XHRcdFx0XHRvdmVycmlkZXNPZk1vZGVsLFxuXHRcdFx0XHRcdHNlcGFyYXRlU3lzdGVtTWVzc2FnZSxcblx0XHRcdFx0XHRjaGF0TW9kZTogbnVsbCwgLy8gbm90IGNoYXRcblx0XHRcdFx0XHRvblRleHQ6IChwYXJhbXMpID0+IHtcblx0XHRcdFx0XHRcdG9uVGV4dChwYXJhbXMpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvbkZpbmFsTWVzc2FnZTogYXN5bmMgKHBhcmFtcykgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgeyBmdWxsVGV4dCB9ID0gcGFyYW1zXG5cdFx0XHRcdFx0XHRvblRleHQocGFyYW1zKVxuXG5cdFx0XHRcdFx0XHRjb25zdCBibG9ja3MgPSBleHRyYWN0U2VhcmNoUmVwbGFjZUJsb2NrcyhmdWxsVGV4dClcblx0XHRcdFx0XHRcdGlmIChibG9ja3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UuaW5mbyhgVm9pZDogV2UgcmFuIEZhc3QgQXBwbHksIGJ1dCB0aGUgTExNIGRpZG4ndCBvdXRwdXQgYW55IGNoYW5nZXMuYClcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMuX3dyaXRlVVJJVGV4dCh1cmksIG9yaWdpbmFsRmlsZUNvZGUsICd3aG9sZUZpbGVSYW5nZScsIHsgc2hvdWxkUmVhbGlnbkRpZmZBcmVhczogdHJ1ZSB9KVxuXG5cblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2luc3RhbnRseUFwcGx5U1JCbG9ja3ModXJpLCBmdWxsVGV4dClcblx0XHRcdFx0XHRcdFx0b25Eb25lKClcblx0XHRcdFx0XHRcdFx0cmVzTWVzc2FnZURvbmVQcm9taXNlKClcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRcdG9uRXJyb3IoZSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdG9uRXJyb3I6IChlKSA9PiB7XG5cdFx0XHRcdFx0XHRvbkVycm9yKGUpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvbkFib3J0OiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAod2VBcmVBYm9ydGluZykgcmV0dXJuXG5cdFx0XHRcdFx0XHQvLyBzdG9wIHRoZSBsb29wIHRvIGZyZWUgdXAgdGhlIHByb21pc2UsIGJ1dCBkb24ndCBtb2RpZnkgc3RhdGUgKGFscmVhZHkgaGFuZGxlZCBieSB3aGF0ZXZlciBzdG9wcGVkIGl0KVxuXHRcdFx0XHRcdFx0YWJvcnRlZCA9IHRydWVcblx0XHRcdFx0XHRcdHJlc01lc3NhZ2VEb25lUHJvbWlzZSgpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSlcblxuXHRcdFx0XHQvLyBzaG91bGQgbmV2ZXIgaGFwcGVuLCBqdXN0IGZvciBzYWZldHlcblx0XHRcdFx0aWYgKHN0cmVhbVJlcXVlc3RJZFJlZi5jdXJyZW50ID09PSBudWxsKSB7IGJyZWFrIH1cblxuXHRcdFx0XHRhd2FpdCBtZXNzYWdlRG9uZVByb21pc2Vcblx0XHRcdFx0aWYgKGFib3J0ZWQpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEVkaXQgd2FzIGludGVycnVwdGVkIGJ5IHRoZSB1c2VyLmApXG5cdFx0XHRcdH1cblx0XHRcdH0gLy8gZW5kIHdoaWxlXG5cblx0XHR9IC8vIGVuZCByZXRyeUxvb3BcblxuXHRcdGNvbnN0IGFwcGx5RG9uZVByb21pc2UgPSBuZXcgUHJvbWlzZTx2b2lkPigocmVzLCByZWopID0+IHsgcnVuU2VhcmNoUmVwbGFjZSgpLnRoZW4ocmVzKS5jYXRjaChyZWopIH0pXG5cdFx0cmV0dXJuIFtkaWZmWm9uZSwgYXBwbHlEb25lUHJvbWlzZV1cblx0fVxuXG5cblx0X3VuZG9IaXN0b3J5KHVyaTogVVJJKSB7XG5cdFx0dGhpcy5fdW5kb1JlZG9TZXJ2aWNlLnVuZG8odXJpKVxuXHR9XG5cblxuXG5cdGlzQ3RybEtab25lU3RyZWFtaW5nKHsgZGlmZmFyZWFpZCB9OiB7IGRpZmZhcmVhaWQ6IG51bWJlciB9KSB7XG5cdFx0Y29uc3QgY3RybEtab25lID0gdGhpcy5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF1cblx0XHRpZiAoIWN0cmxLWm9uZSkgcmV0dXJuIGZhbHNlXG5cdFx0aWYgKGN0cmxLWm9uZS50eXBlICE9PSAnQ3RybEtab25lJykgcmV0dXJuIGZhbHNlXG5cdFx0cmV0dXJuICEhY3RybEtab25lLl9saW5rZWRTdHJlYW1pbmdEaWZmWm9uZVxuXHR9XG5cblxuXHRwcml2YXRlIF9zdG9wSWZTdHJlYW1pbmcoZGlmZlpvbmU6IERpZmZab25lKSB7XG5cdFx0Y29uc3QgdXJpID0gZGlmZlpvbmUuX1VSSVxuXG5cdFx0Y29uc3Qgc3RyZWFtUmVxdWVzdElkID0gZGlmZlpvbmUuX3N0cmVhbVN0YXRlLnN0cmVhbVJlcXVlc3RJZFJlZj8uY3VycmVudFxuXHRcdGlmICghc3RyZWFtUmVxdWVzdElkKSByZXR1cm5cblxuXHRcdHRoaXMuX2xsbU1lc3NhZ2VTZXJ2aWNlLmFib3J0KHN0cmVhbVJlcXVlc3RJZClcblxuXHRcdGRpZmZab25lLl9zdHJlYW1TdGF0ZSA9IHsgaXNTdHJlYW1pbmc6IGZhbHNlLCB9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdHJlYW1pbmdJbkRpZmZab25lLmZpcmUoeyB1cmksIGRpZmZhcmVhaWQ6IGRpZmZab25lLmRpZmZhcmVhaWQgfSlcblx0fVxuXG5cblx0Ly8gZGlmZmFyZWFpZCBvZiB0aGUgY3RybEtab25lIChldmVuIHRob3VnaCB0aGUgc3RyZWFtIHN0YXRlIGlzIGRpY3RhdGVkIGJ5IHRoZSBsaW5rZWQgZGlmZlpvbmUpXG5cdGludGVycnVwdEN0cmxLU3RyZWFtaW5nKHsgZGlmZmFyZWFpZCB9OiB7IGRpZmZhcmVhaWQ6IG51bWJlciB9KSB7XG5cdFx0Y29uc3QgY3RybEtab25lID0gdGhpcy5kaWZmQXJlYU9mSWRbZGlmZmFyZWFpZF1cblx0XHRpZiAoY3RybEtab25lPy50eXBlICE9PSAnQ3RybEtab25lJykgcmV0dXJuXG5cdFx0aWYgKCFjdHJsS1pvbmUuX2xpbmtlZFN0cmVhbWluZ0RpZmZab25lKSByZXR1cm5cblxuXHRcdGNvbnN0IGxpbmtlZFN0cmVhbWluZ0RpZmZab25lID0gdGhpcy5kaWZmQXJlYU9mSWRbY3RybEtab25lLl9saW5rZWRTdHJlYW1pbmdEaWZmWm9uZV1cblx0XHRpZiAoIWxpbmtlZFN0cmVhbWluZ0RpZmZab25lKSByZXR1cm5cblx0XHRpZiAobGlua2VkU3RyZWFtaW5nRGlmZlpvbmUudHlwZSAhPT0gJ0RpZmZab25lJykgcmV0dXJuXG5cblx0XHR0aGlzLl9zdG9wSWZTdHJlYW1pbmcobGlua2VkU3RyZWFtaW5nRGlmZlpvbmUpXG5cdFx0dGhpcy5fdW5kb0hpc3RvcnkobGlua2VkU3RyZWFtaW5nRGlmZlpvbmUuX1VSSSlcblx0fVxuXG5cblx0aW50ZXJydXB0VVJJU3RyZWFtaW5nKHsgdXJpIH06IHsgdXJpOiBVUkkgfSkge1xuXHRcdGlmICghdGhpcy5fdXJpSXNTdHJlYW1pbmcodXJpKSkgcmV0dXJuXG5cdFx0dGhpcy5fdW5kb0hpc3RvcnkodXJpKVxuXHRcdC8vIGJydXRlIGZvcmNlIGZvciBub3cgaXMgT0tcblx0XHRmb3IgKGNvbnN0IGRpZmZhcmVhaWQgb2YgdGhpcy5kaWZmQXJlYXNPZlVSSVt1cmkuZnNQYXRoXSB8fCBbXSkge1xuXHRcdFx0Y29uc3QgZGlmZkFyZWEgPSB0aGlzLmRpZmZBcmVhT2ZJZFtkaWZmYXJlYWlkXVxuXHRcdFx0aWYgKGRpZmZBcmVhPy50eXBlICE9PSAnRGlmZlpvbmUnKSBjb250aW51ZVxuXHRcdFx0aWYgKCFkaWZmQXJlYS5fc3RyZWFtU3RhdGUuaXNTdHJlYW1pbmcpIGNvbnRpbnVlXG5cdFx0XHR0aGlzLl9zdG9wSWZTdHJlYW1pbmcoZGlmZkFyZWEpXG5cdFx0fVxuXHR9XG5cblxuXHQvLyBwdWJsaWMgcmVtb3ZlRGlmZlpvbmUoZGlmZlpvbmU6IERpZmZab25lLCBiZWhhdmlvcjogJ3JlamVjdCcgfCAnYWNjZXB0Jykge1xuXHQvLyBcdGNvbnN0IHVyaSA9IGRpZmZab25lLl9VUklcblx0Ly8gXHRjb25zdCB7IG9uRmluaXNoRWRpdCB9ID0gdGhpcy5fYWRkVG9IaXN0b3J5KHVyaSlcblxuXHQvLyBcdGlmIChiZWhhdmlvciA9PT0gJ3JlamVjdCcpIHRoaXMuX3JldmVydEFuZERlbGV0ZURpZmZab25lKGRpZmZab25lKVxuXHQvLyBcdGVsc2UgaWYgKGJlaGF2aW9yID09PSAnYWNjZXB0JykgdGhpcy5fZGVsZXRlRGlmZlpvbmUoZGlmZlpvbmUpXG5cblx0Ly8gXHR0aGlzLl9yZWZyZXNoU3R5bGVzQW5kRGlmZnNJblVSSSh1cmkpXG5cdC8vIFx0b25GaW5pc2hFZGl0KClcblx0Ly8gfVxuXG5cdHByaXZhdGUgX3JldmVydERpZmZab25lKGRpZmZab25lOiBEaWZmWm9uZSkge1xuXHRcdGNvbnN0IHVyaSA9IGRpZmZab25lLl9VUklcblxuXHRcdGNvbnN0IHdyaXRlVGV4dCA9IGRpZmZab25lLm9yaWdpbmFsQ29kZVxuXHRcdGNvbnN0IHRvUmFuZ2U6IElSYW5nZSA9IHsgc3RhcnRMaW5lTnVtYmVyOiBkaWZmWm9uZS5zdGFydExpbmUsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiBkaWZmWm9uZS5lbmRMaW5lLCBlbmRDb2x1bW46IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSIH1cblx0XHR0aGlzLl93cml0ZVVSSVRleHQodXJpLCB3cml0ZVRleHQsIHRvUmFuZ2UsIHsgc2hvdWxkUmVhbGlnbkRpZmZBcmVhczogdHJ1ZSB9KVxuXHR9XG5cblxuXHQvLyByZW1vdmUgYSBiYXRjaCBvZiBkaWZmYXJlYXMgYWxsIGF0IG9uY2UgKGFuZCBoYW5kbGUgYWNjZXB0L3JlamVjdCBvZiB0aGVpciBkaWZmcylcblx0cHVibGljIGFjY2VwdE9yUmVqZWN0QWxsRGlmZkFyZWFzOiBJRWRpdENvZGVTZXJ2aWNlWydhY2NlcHRPclJlamVjdEFsbERpZmZBcmVhcyddID0gYXN5bmMgKHsgdXJpLCBiZWhhdmlvciwgcmVtb3ZlQ3RybEtzLCBfYWRkVG9IaXN0b3J5IH0pID0+IHtcblxuXHRcdGNvbnN0IGRpZmZhcmVhaWRzID0gdGhpcy5kaWZmQXJlYXNPZlVSSVt1cmkuZnNQYXRoXVxuXHRcdGlmICgoZGlmZmFyZWFpZHM/LnNpemUgPz8gMCkgPT09IDApIHJldHVybiAvLyBkbyBub3RoaW5nXG5cblx0XHRjb25zdCB7IG9uRmluaXNoRWRpdCB9ID0gX2FkZFRvSGlzdG9yeSA9PT0gZmFsc2UgPyB7IG9uRmluaXNoRWRpdDogKCkgPT4geyB9IH0gOiB0aGlzLl9hZGRUb0hpc3RvcnkodXJpKVxuXG5cdFx0Zm9yIChjb25zdCBkaWZmYXJlYWlkIG9mIGRpZmZhcmVhaWRzID8/IFtdKSB7XG5cdFx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0XHRpZiAoIWRpZmZBcmVhKSBjb250aW51ZVxuXG5cdFx0XHRpZiAoZGlmZkFyZWEudHlwZSA9PT0gJ0RpZmZab25lJykge1xuXHRcdFx0XHRpZiAoYmVoYXZpb3IgPT09ICdyZWplY3QnKSB7XG5cdFx0XHRcdFx0dGhpcy5fcmV2ZXJ0RGlmZlpvbmUoZGlmZkFyZWEpXG5cdFx0XHRcdFx0dGhpcy5fZGVsZXRlRGlmZlpvbmUoZGlmZkFyZWEpXG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAoYmVoYXZpb3IgPT09ICdhY2NlcHQnKSB0aGlzLl9kZWxldGVEaWZmWm9uZShkaWZmQXJlYSlcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGRpZmZBcmVhLnR5cGUgPT09ICdDdHJsS1pvbmUnICYmIHJlbW92ZUN0cmxLcykge1xuXHRcdFx0XHR0aGlzLl9kZWxldGVDdHJsS1pvbmUoZGlmZkFyZWEpXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVmcmVzaFN0eWxlc0FuZERpZmZzSW5VUkkodXJpKVxuXHRcdG9uRmluaXNoRWRpdCgpXG5cdH1cblxuXG5cblx0Ly8gY2FsbGVkIG9uIHZvaWQuYWNjZXB0RGlmZlxuXHRwdWJsaWMgYXN5bmMgYWNjZXB0RGlmZih7IGRpZmZpZCB9OiB7IGRpZmZpZDogbnVtYmVyIH0pIHtcblxuXHRcdC8vIFRPRE8gY291bGQgdXNlIGFuIElUZXh0TW9kZWx0byBkbyB0aGlzIGluc3RlYWQsIHdvdWxkIGJlIG11Y2ggc2ltcGxlclxuXG5cdFx0Y29uc3QgZGlmZiA9IHRoaXMuZGlmZk9mSWRbZGlmZmlkXVxuXHRcdGlmICghZGlmZikgcmV0dXJuXG5cblx0XHRjb25zdCB7IGRpZmZhcmVhaWQgfSA9IGRpZmZcblx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0aWYgKCFkaWZmQXJlYSkgcmV0dXJuXG5cblx0XHRpZiAoZGlmZkFyZWEudHlwZSAhPT0gJ0RpZmZab25lJykgcmV0dXJuXG5cblx0XHRjb25zdCB1cmkgPSBkaWZmQXJlYS5fVVJJXG5cblx0XHQvLyBhZGQgdG8gaGlzdG9yeVxuXHRcdGNvbnN0IHsgb25GaW5pc2hFZGl0IH0gPSB0aGlzLl9hZGRUb0hpc3RvcnkodXJpKVxuXG5cdFx0Y29uc3Qgb3JpZ2luYWxMaW5lcyA9IGRpZmZBcmVhLm9yaWdpbmFsQ29kZS5zcGxpdCgnXFxuJylcblx0XHRsZXQgbmV3T3JpZ2luYWxDb2RlOiBzdHJpbmdcblxuXHRcdGlmIChkaWZmLnR5cGUgPT09ICdkZWxldGlvbicpIHtcblx0XHRcdG5ld09yaWdpbmFsQ29kZSA9IFtcblx0XHRcdFx0Li4ub3JpZ2luYWxMaW5lcy5zbGljZSgwLCAoZGlmZi5vcmlnaW5hbFN0YXJ0TGluZSAtIDEpKSwgLy8gZXZlcnl0aGluZyBiZWZvcmUgc3RhcnRMaW5lXG5cdFx0XHRcdC8vIDwtLSBkZWxldGlvbiBoYXMgbm90aGluZyBoZXJlXG5cdFx0XHRcdC4uLm9yaWdpbmFsTGluZXMuc2xpY2UoKGRpZmYub3JpZ2luYWxFbmRMaW5lIC0gMSkgKyAxLCBJbmZpbml0eSkgLy8gZXZlcnl0aGluZyBhZnRlciBlbmRMaW5lXG5cdFx0XHRdLmpvaW4oJ1xcbicpXG5cdFx0fVxuXHRcdGVsc2UgaWYgKGRpZmYudHlwZSA9PT0gJ2luc2VydGlvbicpIHtcblx0XHRcdG5ld09yaWdpbmFsQ29kZSA9IFtcblx0XHRcdFx0Li4ub3JpZ2luYWxMaW5lcy5zbGljZSgwLCAoZGlmZi5vcmlnaW5hbFN0YXJ0TGluZSAtIDEpKSwgLy8gZXZlcnl0aGluZyBiZWZvcmUgc3RhcnRMaW5lXG5cdFx0XHRcdGRpZmYuY29kZSwgLy8gY29kZVxuXHRcdFx0XHQuLi5vcmlnaW5hbExpbmVzLnNsaWNlKChkaWZmLm9yaWdpbmFsU3RhcnRMaW5lIC0gMSksIEluZmluaXR5KSAvLyBzdGFydExpbmUgKGluY2x1c2l2ZSkgYW5kIG9uIChubyArMSlcblx0XHRcdF0uam9pbignXFxuJylcblx0XHR9XG5cdFx0ZWxzZSBpZiAoZGlmZi50eXBlID09PSAnZWRpdCcpIHtcblx0XHRcdG5ld09yaWdpbmFsQ29kZSA9IFtcblx0XHRcdFx0Li4ub3JpZ2luYWxMaW5lcy5zbGljZSgwLCAoZGlmZi5vcmlnaW5hbFN0YXJ0TGluZSAtIDEpKSwgLy8gZXZlcnl0aGluZyBiZWZvcmUgc3RhcnRMaW5lXG5cdFx0XHRcdGRpZmYuY29kZSwgLy8gY29kZVxuXHRcdFx0XHQuLi5vcmlnaW5hbExpbmVzLnNsaWNlKChkaWZmLm9yaWdpbmFsRW5kTGluZSAtIDEpICsgMSwgSW5maW5pdHkpIC8vIGV2ZXJ5dGhpbmcgYWZ0ZXIgZW5kTGluZVxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVm9pZCBlcnJvcjogJHtkaWZmfS50eXBlIG5vdCByZWNvZ25pemVkYClcblx0XHR9XG5cblx0XHQvLyBjb25zb2xlLmxvZygnRElGRicsIGRpZmYpXG5cdFx0Ly8gY29uc29sZS5sb2coJ0RJRkZBUkVBJywgZGlmZkFyZWEpXG5cdFx0Ly8gY29uc29sZS5sb2coJ09SSUdJTkFMJywgZGlmZkFyZWEub3JpZ2luYWxDb2RlKVxuXHRcdC8vIGNvbnNvbGUubG9nKCduZXcgb3JpZ2luYWwgQ29kZScsIG5ld09yaWdpbmFsQ29kZSlcblxuXHRcdC8vIHVwZGF0ZSBjb2RlIG5vdyBhY2NlcHRlZCBhcyBvcmlnaW5hbFxuXHRcdGRpZmZBcmVhLm9yaWdpbmFsQ29kZSA9IG5ld09yaWdpbmFsQ29kZVxuXG5cdFx0Ly8gZGVsZXRlIHRoZSBkaWZmXG5cdFx0dGhpcy5fZGVsZXRlRGlmZihkaWZmKVxuXG5cdFx0Ly8gZGlmZkFyZWEgc2hvdWxkIGJlIHJlbW92ZWQgaWYgaXQgaGFzIG5vIG1vcmUgZGlmZnMgaW4gaXRcblx0XHRpZiAoT2JqZWN0LmtleXMoZGlmZkFyZWEuX2RpZmZPZklkKS5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMuX2RlbGV0ZURpZmZab25lKGRpZmZBcmVhKVxuXHRcdH1cblxuXHRcdHRoaXMuX3JlZnJlc2hTdHlsZXNBbmREaWZmc0luVVJJKHVyaSlcblxuXHRcdG9uRmluaXNoRWRpdCgpXG5cblx0fVxuXG5cblxuXHQvLyBjYWxsZWQgb24gdm9pZC5yZWplY3REaWZmXG5cdHB1YmxpYyBhc3luYyByZWplY3REaWZmKHsgZGlmZmlkIH06IHsgZGlmZmlkOiBudW1iZXIgfSkge1xuXG5cdFx0Y29uc3QgZGlmZiA9IHRoaXMuZGlmZk9mSWRbZGlmZmlkXVxuXHRcdGlmICghZGlmZikgcmV0dXJuXG5cblx0XHRjb25zdCB7IGRpZmZhcmVhaWQgfSA9IGRpZmZcblx0XHRjb25zdCBkaWZmQXJlYSA9IHRoaXMuZGlmZkFyZWFPZklkW2RpZmZhcmVhaWRdXG5cdFx0aWYgKCFkaWZmQXJlYSkgcmV0dXJuXG5cblx0XHRpZiAoZGlmZkFyZWEudHlwZSAhPT0gJ0RpZmZab25lJykgcmV0dXJuXG5cblx0XHRjb25zdCB1cmkgPSBkaWZmQXJlYS5fVVJJXG5cblx0XHQvLyBhZGQgdG8gaGlzdG9yeVxuXHRcdGNvbnN0IHsgb25GaW5pc2hFZGl0IH0gPSB0aGlzLl9hZGRUb0hpc3RvcnkodXJpKVxuXG5cdFx0bGV0IHdyaXRlVGV4dDogc3RyaW5nXG5cdFx0bGV0IHRvUmFuZ2U6IElSYW5nZVxuXG5cdFx0Ly8gaWYgaXQgd2FzIGEgZGVsZXRpb24sIG5lZWQgdG8gcmUtaW5zZXJ0XG5cdFx0Ly8gKHRoaXMgaW1hZ2UgYXBwbGllcyB0byB3cml0ZVRleHQgYW5kIHRvUmFuZ2UsIG5vdCBuZXdPcmlnaW5hbENvZGUpXG5cdFx0Ly8gIEFcblx0XHQvLyB8QiAgIDwtLSBkZWxldGVkIGhlcmUsIGRpZmYuc3RhcnRMaW5lID09IGRpZmYuZW5kTGluZVxuXHRcdC8vICBDXG5cdFx0aWYgKGRpZmYudHlwZSA9PT0gJ2RlbGV0aW9uJykge1xuXHRcdFx0Ly8gaWYgc3RhcnRMaW5lIGlzIG91dCBvZiBib3VuZHMgKGRlbGV0ZWQgbGluZXMgcGFzdCB0aGUgZGlmZmFyZWEpLCBhcHBseUVkaXQgd2lsbCBkbyBhIHdlaXJkIHJvdW5kaW5nIHRoaW5nLCB0byBhY2NvdW50IGZvciB0aGF0IHdlIGFwcGx5IHRoZSBlZGl0IHRoZSBsaW5lIGJlZm9yZVxuXHRcdFx0aWYgKGRpZmYuc3RhcnRMaW5lIC0gMSA9PT0gZGlmZkFyZWEuZW5kTGluZSkge1xuXHRcdFx0XHR3cml0ZVRleHQgPSAnXFxuJyArIGRpZmYub3JpZ2luYWxDb2RlXG5cdFx0XHRcdHRvUmFuZ2UgPSB7IHN0YXJ0TGluZU51bWJlcjogZGlmZi5zdGFydExpbmUgLSAxLCBzdGFydENvbHVtbjogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIGVuZExpbmVOdW1iZXI6IGRpZmYuc3RhcnRMaW5lIC0gMSwgZW5kQ29sdW1uOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiB9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0d3JpdGVUZXh0ID0gZGlmZi5vcmlnaW5hbENvZGUgKyAnXFxuJ1xuXHRcdFx0XHR0b1JhbmdlID0geyBzdGFydExpbmVOdW1iZXI6IGRpZmYuc3RhcnRMaW5lLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogZGlmZi5zdGFydExpbmUsIGVuZENvbHVtbjogMSB9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIGlmIGl0IHdhcyBhbiBpbnNlcnRpb24sIG5lZWQgdG8gZGVsZXRlIGFsbCB0aGUgbGluZXNcblx0XHQvLyAodGhpcyBpbWFnZSBhcHBsaWVzIHRvIHdyaXRlVGV4dCBhbmQgdG9SYW5nZSwgbm90IG5ld09yaWdpbmFsQ29kZSlcblx0XHQvLyB8QSAgIDwtLSBzdGFydExpbmVcblx0XHQvLyAgQnwgIDwtLSBlbmRMaW5lICh3ZSB3YW50IHRvIGRlbGV0ZSB0aGlzIHdob2xlIGxpbmUpXG5cdFx0Ly8gIENcblx0XHRlbHNlIGlmIChkaWZmLnR5cGUgPT09ICdpbnNlcnRpb24nKSB7XG5cdFx0XHQvLyBjb25zb2xlLmxvZygnUkVKRUNUSU5HOicsIGRpZmYpXG5cdFx0XHQvLyBoYW5kbGUgdGhlIGNhc2Ugd2hlcmUgdGhlIGluc2VydGlvbiB3YXMgYSBuZXdsaW5lIGF0IGVuZCBvZiBkaWZmYXJlYSAoYXBwbHlpbmcgdG8gdGhlIG5leHQgbGluZSBkb2VzbnQgd29yayBiZWNhdXNlIGl0IGRvZXNudCBleGlzdCwgdnNjb2RlIGp1c3QgZG9lc250IGRlbGV0ZSB0aGUgY29ycmVjdCAjIG9mIG5ld2xpbmVzKVxuXHRcdFx0aWYgKGRpZmYuZW5kTGluZSA9PT0gZGlmZkFyZWEuZW5kTGluZSkge1xuXHRcdFx0XHQvLyBkZWxldGUgdGhlIGxpbmUgYmVmb3JlIGluc3RlYWQgb2YgYWZ0ZXJcblx0XHRcdFx0d3JpdGVUZXh0ID0gJydcblx0XHRcdFx0dG9SYW5nZSA9IHsgc3RhcnRMaW5lTnVtYmVyOiBkaWZmLnN0YXJ0TGluZSAtIDEsIHN0YXJ0Q29sdW1uOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgZW5kTGluZU51bWJlcjogZGlmZi5lbmRMaW5lLCBlbmRDb2x1bW46IDEgfSAvLyAxLWluZGV4ZWRcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR3cml0ZVRleHQgPSAnJ1xuXHRcdFx0XHR0b1JhbmdlID0geyBzdGFydExpbmVOdW1iZXI6IGRpZmYuc3RhcnRMaW5lLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogZGlmZi5lbmRMaW5lICsgMSwgZW5kQ29sdW1uOiAxIH0gLy8gMS1pbmRleGVkXG5cdFx0XHR9XG5cblx0XHR9XG5cdFx0Ly8gaWYgaXQgd2FzIGFuIGVkaXQsIGp1c3QgZWRpdCB0aGUgcmFuZ2Vcblx0XHQvLyAodGhpcyBpbWFnZSBhcHBsaWVzIHRvIHdyaXRlVGV4dCBhbmQgdG9SYW5nZSwgbm90IG5ld09yaWdpbmFsQ29kZSlcblx0XHQvLyB8QSAgICA8LS0gc3RhcnRMaW5lXG5cdFx0Ly8gIEJ8ICAgPC0tIGVuZExpbmUgKGp1c3Qgc3dhcCBvdXQgdGhlc2UgbGluZXMgZm9yIHRoZSBvcmlnaW5hbENvZGUpXG5cdFx0Ly8gIENcblx0XHRlbHNlIGlmIChkaWZmLnR5cGUgPT09ICdlZGl0Jykge1xuXHRcdFx0d3JpdGVUZXh0ID0gZGlmZi5vcmlnaW5hbENvZGVcblx0XHRcdHRvUmFuZ2UgPSB7IHN0YXJ0TGluZU51bWJlcjogZGlmZi5zdGFydExpbmUsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiBkaWZmLmVuZExpbmUsIGVuZENvbHVtbjogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIgfSAvLyAxLWluZGV4ZWRcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFZvaWQgZXJyb3I6ICR7ZGlmZn0udHlwZSBub3QgcmVjb2duaXplZGApXG5cdFx0fVxuXG5cdFx0Ly8gdXBkYXRlIHRoZSBmaWxlXG5cdFx0dGhpcy5fd3JpdGVVUklUZXh0KHVyaSwgd3JpdGVUZXh0LCB0b1JhbmdlLCB7IHNob3VsZFJlYWxpZ25EaWZmQXJlYXM6IHRydWUgfSlcblxuXHRcdC8vIG9yaWdpbmFsQ29kZSBkb2VzIG5vdCBjaGFuZ2UhXG5cblx0XHQvLyBkZWxldGUgdGhlIGRpZmZcblx0XHR0aGlzLl9kZWxldGVEaWZmKGRpZmYpXG5cblx0XHQvLyBkaWZmQXJlYSBzaG91bGQgYmUgcmVtb3ZlZCBpZiBpdCBoYXMgbm8gbW9yZSBkaWZmcyBpbiBpdFxuXHRcdGlmIChPYmplY3Qua2V5cyhkaWZmQXJlYS5fZGlmZk9mSWQpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fZGVsZXRlRGlmZlpvbmUoZGlmZkFyZWEpXG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVmcmVzaFN0eWxlc0FuZERpZmZzSW5VUkkodXJpKVxuXG5cdFx0b25GaW5pc2hFZGl0KClcblxuXHR9XG5cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUVkaXRDb2RlU2VydmljZSwgRWRpdENvZGVTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5cblxuXG5cbmNsYXNzIEFjY2VwdFJlamVjdElubGluZVdpZGdldCBleHRlbmRzIFdpZGdldCBpbXBsZW1lbnRzIElPdmVybGF5V2lkZ2V0IHtcblxuXHRwdWJsaWMgZ2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5JRCB8fCAnJzsgLy8gRW5zdXJlIHdlIGFsd2F5cyByZXR1cm4gYSBzdHJpbmdcblx0fVxuXHRwdWJsaWMgZ2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblx0cHVibGljIGdldFBvc2l0aW9uKCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZTogSFRNTEVsZW1lbnQ7IC8vIFVzaW5nIHRoZSBkZWZpbml0ZSBhc3NpZ25tZW50IGFzc2VydGlvblxuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3I7XG5cdHByaXZhdGUgcmVhZG9ubHkgSUQ6IHN0cmluZztcblx0cHJpdmF0ZSByZWFkb25seSBzdGFydExpbmU6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR7IGVkaXRvciwgb25BY2NlcHQsIG9uUmVqZWN0LCBkaWZmaWQsIHN0YXJ0TGluZSwgb2Zmc2V0TGluZXMgfToge1xuXHRcdFx0ZWRpdG9yOiBJQ29kZUVkaXRvcjtcblx0XHRcdG9uQWNjZXB0OiAoKSA9PiB2b2lkO1xuXHRcdFx0b25SZWplY3Q6ICgpID0+IHZvaWQ7XG5cdFx0XHRkaWZmaWQ6IHN0cmluZyxcblx0XHRcdHN0YXJ0TGluZTogbnVtYmVyLFxuXHRcdFx0b2Zmc2V0TGluZXM6IG51bWJlclxuXHRcdH0sXG5cdFx0QElWb2lkQ29tbWFuZEJhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdm9pZENvbW1hbmRCYXJTZXJ2aWNlOiBJVm9pZENvbW1hbmRCYXJTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUVkaXRDb2RlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0Q29kZVNlcnZpY2U6IElFZGl0Q29kZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCB1cmkgPSBlZGl0b3IuZ2V0TW9kZWwoKT8udXJpO1xuXHRcdC8vIEluaXRpYWxpemUgd2l0aCBkZWZhdWx0IHZhbHVlc1xuXHRcdHRoaXMuSUQgPSAnJ1xuXHRcdHRoaXMuZWRpdG9yID0gZWRpdG9yO1xuXHRcdHRoaXMuc3RhcnRMaW5lID0gc3RhcnRMaW5lO1xuXG5cdFx0aWYgKCF1cmkpIHtcblx0XHRcdGNvbnN0IHsgZHVtbXlEaXYgfSA9IGRvbS5oKCdkaXZAZHVtbXlEaXYnKTtcblx0XHRcdHRoaXMuX2RvbU5vZGUgPSBkdW1teURpdlxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuSUQgPSB1cmkuZnNQYXRoICsgZGlmZmlkO1xuXG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IGVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXG5cdFx0Y29uc3QgZ2V0QWNjZXB0UmVqZWN0VGV4dCA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGFjY2VwdEtleWJpbmRpbmcgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKFZPSURfQUNDRVBUX0RJRkZfQUNUSU9OX0lEKTtcblx0XHRcdGNvbnN0IHJlamVjdEtleWJpbmRpbmcgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKFZPSURfUkVKRUNUX0RJRkZfQUNUSU9OX0lEKTtcblxuXHRcdFx0Ly8gVXNlIHRoZSBzdGFuZGFsb25lIGZ1bmN0aW9uIGRpcmVjdGx5IHNpbmNlIHdlJ3JlIGluIGEgbmVzdGVkIGNsYXNzIHRoYXRcblx0XHRcdC8vIGNhbid0IGFjY2VzcyBFZGl0Q29kZVNlcnZpY2UncyBtZXRob2RzXG5cdFx0XHRjb25zdCBhY2NlcHRLZXliaW5kTGFiZWwgPSB0aGlzLl9lZGl0Q29kZVNlcnZpY2UucHJvY2Vzc1Jhd0tleWJpbmRpbmdUZXh0KGFjY2VwdEtleWJpbmRpbmcgJiYgYWNjZXB0S2V5YmluZGluZy5nZXRMYWJlbCgpIHx8ICcnKTtcblx0XHRcdGNvbnN0IHJlamVjdEtleWJpbmRMYWJlbCA9IHRoaXMuX2VkaXRDb2RlU2VydmljZS5wcm9jZXNzUmF3S2V5YmluZGluZ1RleHQocmVqZWN0S2V5YmluZGluZyAmJiByZWplY3RLZXliaW5kaW5nLmdldExhYmVsKCkgfHwgJycpO1xuXG5cdFx0XHRjb25zdCBjb21tYW5kQmFyU3RhdGVBdFVyaSA9IHRoaXMuX3ZvaWRDb21tYW5kQmFyU2VydmljZS5zdGF0ZU9mVVJJW3VyaS5mc1BhdGhdO1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWREaWZmSWR4ID0gY29tbWFuZEJhclN0YXRlQXRVcmk/LmRpZmZJZHggPz8gMDsgLy8gMHRoIGl0ZW0gaXMgc2VsZWN0ZWQgYnkgZGVmYXVsdFxuXHRcdFx0Y29uc3QgdGhpc0RpZmZJZHggPSBjb21tYW5kQmFyU3RhdGVBdFVyaT8uc29ydGVkRGlmZklkcy5pbmRleE9mKGRpZmZpZCkgPz8gbnVsbDtcblxuXHRcdFx0Y29uc3Qgc2hvd0xhYmVsID0gdGhpc0RpZmZJZHggPT09IHNlbGVjdGVkRGlmZklkeFxuXG5cdFx0XHRjb25zdCBhY2NlcHRUZXh0ID0gYEFjY2VwdCR7c2hvd0xhYmVsID8gYCBgICsgYWNjZXB0S2V5YmluZExhYmVsIDogJyd9YDtcblx0XHRcdGNvbnN0IHJlamVjdFRleHQgPSBgUmVqZWN0JHtzaG93TGFiZWwgPyBgIGAgKyByZWplY3RLZXliaW5kTGFiZWwgOiAnJ31gO1xuXG5cdFx0XHRyZXR1cm4geyBhY2NlcHRUZXh0LCByZWplY3RUZXh0IH1cblx0XHR9XG5cblx0XHRjb25zdCB7IGFjY2VwdFRleHQsIHJlamVjdFRleHQgfSA9IGdldEFjY2VwdFJlamVjdFRleHQoKVxuXG5cdFx0Ly8gQ3JlYXRlIGNvbnRhaW5lciBkaXYgd2l0aCBidXR0b25zXG5cdFx0Y29uc3QgeyBhY2NlcHRCdXR0b24sIHJlamVjdEJ1dHRvbiwgYnV0dG9ucyB9ID0gZG9tLmgoJ2RpdkBidXR0b25zJywgW1xuXHRcdFx0ZG9tLmgoJ2J1dHRvbkBhY2NlcHRCdXR0b24nLCBbXSksXG5cdFx0XHRkb20uaCgnYnV0dG9uQHJlamVjdEJ1dHRvbicsIFtdKVxuXHRcdF0pO1xuXG5cdFx0Ly8gU3R5bGUgdGhlIGNvbnRhaW5lclxuXHRcdGJ1dHRvbnMuc3R5bGUuZGlzcGxheSA9ICdmbGV4Jztcblx0XHRidXR0b25zLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRidXR0b25zLnN0eWxlLmdhcCA9ICc0cHgnO1xuXHRcdGJ1dHRvbnMuc3R5bGUucGFkZGluZ1JpZ2h0ID0gJzRweCc7XG5cdFx0YnV0dG9ucy5zdHlsZS56SW5kZXggPSAnMSc7XG5cdFx0YnV0dG9ucy5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWSgke29mZnNldExpbmVzICogbGluZUhlaWdodH1weClgO1xuXHRcdGJ1dHRvbnMuc3R5bGUuanVzdGlmeUNvbnRlbnQgPSAnZmxleC1lbmQnO1xuXHRcdGJ1dHRvbnMuc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cdFx0YnV0dG9ucy5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuXG5cblx0XHQvLyBTdHlsZSBhY2NlcHQgYnV0dG9uXG5cdFx0YWNjZXB0QnV0dG9uLm9uY2xpY2sgPSBvbkFjY2VwdDtcblx0XHRhY2NlcHRCdXR0b24udGV4dENvbnRlbnQgPSBhY2NlcHRUZXh0O1xuXHRcdGFjY2VwdEJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBhY2NlcHRCZztcblx0XHRhY2NlcHRCdXR0b24uc3R5bGUuYm9yZGVyID0gYWNjZXB0Qm9yZGVyO1xuXHRcdGFjY2VwdEJ1dHRvbi5zdHlsZS5jb2xvciA9IGJ1dHRvblRleHRDb2xvcjtcblx0XHRhY2NlcHRCdXR0b24uc3R5bGUuZm9udFNpemUgPSBidXR0b25Gb250U2l6ZTtcblx0XHRhY2NlcHRCdXR0b24uc3R5bGUuYm9yZGVyVG9wID0gJ25vbmUnO1xuXHRcdGFjY2VwdEJ1dHRvbi5zdHlsZS5wYWRkaW5nID0gJzFweCA0cHgnO1xuXHRcdGFjY2VwdEJ1dHRvbi5zdHlsZS5ib3JkZXJCb3R0b21MZWZ0UmFkaXVzID0gJzZweCc7XG5cdFx0YWNjZXB0QnV0dG9uLnN0eWxlLmJvcmRlckJvdHRvbVJpZ2h0UmFkaXVzID0gJzZweCc7XG5cdFx0YWNjZXB0QnV0dG9uLnN0eWxlLmJvcmRlclRvcExlZnRSYWRpdXMgPSAnMCc7XG5cdFx0YWNjZXB0QnV0dG9uLnN0eWxlLmJvcmRlclRvcFJpZ2h0UmFkaXVzID0gJzAnO1xuXHRcdGFjY2VwdEJ1dHRvbi5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG5cdFx0YWNjZXB0QnV0dG9uLnN0eWxlLmhlaWdodCA9ICcxMDAlJztcblx0XHRhY2NlcHRCdXR0b24uc3R5bGUuYm94U2hhZG93ID0gJzAgMnB4IDNweCByZ2JhKDAsMCwwLDAuMiknO1xuXHRcdGFjY2VwdEJ1dHRvbi5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ2F1dG8nO1xuXG5cblx0XHQvLyBTdHlsZSByZWplY3QgYnV0dG9uXG5cdFx0cmVqZWN0QnV0dG9uLm9uY2xpY2sgPSBvblJlamVjdDtcblx0XHRyZWplY3RCdXR0b24udGV4dENvbnRlbnQgPSByZWplY3RUZXh0O1xuXHRcdHJlamVjdEJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSByZWplY3RCZztcblx0XHRyZWplY3RCdXR0b24uc3R5bGUuYm9yZGVyID0gcmVqZWN0Qm9yZGVyO1xuXHRcdHJlamVjdEJ1dHRvbi5zdHlsZS5jb2xvciA9IGJ1dHRvblRleHRDb2xvcjtcblx0XHRyZWplY3RCdXR0b24uc3R5bGUuZm9udFNpemUgPSBidXR0b25Gb250U2l6ZTtcblx0XHRyZWplY3RCdXR0b24uc3R5bGUuYm9yZGVyVG9wID0gJ25vbmUnO1xuXHRcdHJlamVjdEJ1dHRvbi5zdHlsZS5wYWRkaW5nID0gJzFweCA0cHgnO1xuXHRcdHJlamVjdEJ1dHRvbi5zdHlsZS5ib3JkZXJCb3R0b21MZWZ0UmFkaXVzID0gJzZweCc7XG5cdFx0cmVqZWN0QnV0dG9uLnN0eWxlLmJvcmRlckJvdHRvbVJpZ2h0UmFkaXVzID0gJzZweCc7XG5cdFx0cmVqZWN0QnV0dG9uLnN0eWxlLmJvcmRlclRvcExlZnRSYWRpdXMgPSAnMCc7XG5cdFx0cmVqZWN0QnV0dG9uLnN0eWxlLmJvcmRlclRvcFJpZ2h0UmFkaXVzID0gJzAnO1xuXHRcdHJlamVjdEJ1dHRvbi5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG5cdFx0cmVqZWN0QnV0dG9uLnN0eWxlLmhlaWdodCA9ICcxMDAlJztcblx0XHRyZWplY3RCdXR0b24uc3R5bGUuYm94U2hhZG93ID0gJzAgMnB4IDNweCByZ2JhKDAsMCwwLDAuMiknO1xuXHRcdHJlamVjdEJ1dHRvbi5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ2F1dG8nO1xuXG5cblxuXHRcdHRoaXMuX2RvbU5vZGUgPSBidXR0b25zO1xuXG5cdFx0Y29uc3QgdXBkYXRlVG9wID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgdG9wUHggPSBlZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcih0aGlzLnN0YXJ0TGluZSkgLSBlZGl0b3IuZ2V0U2Nyb2xsVG9wKClcblx0XHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUudG9wID0gYCR7dG9wUHh9cHhgXG5cdFx0fVxuXHRcdGNvbnN0IHVwZGF0ZUxlZnQgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBsYXlvdXRJbmZvID0gZWRpdG9yLmdldExheW91dEluZm8oKTtcblx0XHRcdGNvbnN0IG1pbmltYXBXaWR0aCA9IGxheW91dEluZm8ubWluaW1hcC5taW5pbWFwV2lkdGg7XG5cdFx0XHRjb25zdCB2ZXJ0aWNhbFNjcm9sbGJhcldpZHRoID0gbGF5b3V0SW5mby52ZXJ0aWNhbFNjcm9sbGJhcldpZHRoO1xuXHRcdFx0Y29uc3QgYnV0dG9uV2lkdGggPSB0aGlzLl9kb21Ob2RlLm9mZnNldFdpZHRoO1xuXG5cdFx0XHRjb25zdCBsZWZ0UHggPSBsYXlvdXRJbmZvLndpZHRoIC0gbWluaW1hcFdpZHRoIC0gdmVydGljYWxTY3JvbGxiYXJXaWR0aCAtIGJ1dHRvbldpZHRoO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS5sZWZ0ID0gYCR7bGVmdFB4fXB4YDtcblx0XHR9XG5cblx0XHQvLyBNb3VudCBmaXJzdCwgdGhlbiB1cGRhdGUgcG9zaXRpb25zXG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR1cGRhdGVUb3AoKVxuXHRcdFx0dXBkYXRlTGVmdCgpXG5cdFx0fSwgMClcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZFNjcm9sbENoYW5nZShlID0+IHsgdXBkYXRlVG9wKCkgfSkpXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KGUgPT4geyB1cGRhdGVUb3AoKSB9KSlcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRMYXlvdXRDaGFuZ2UoZSA9PiB7IHVwZGF0ZVRvcCgpOyB1cGRhdGVMZWZ0KCkgfSkpXG5cblxuXHRcdC8vIExpc3RlbiBmb3Igc3RhdGUgY2hhbmdlcyBpbiB0aGUgY29tbWFuZCBiYXIgc2VydmljZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3ZvaWRDb21tYW5kQmFyU2VydmljZS5vbkRpZENoYW5nZVN0YXRlKGUgPT4ge1xuXHRcdFx0aWYgKHVyaSAmJiBlLnVyaS5mc1BhdGggPT09IHVyaS5mc1BhdGgpIHtcblxuXHRcdFx0XHRjb25zdCB7IGFjY2VwdFRleHQsIHJlamVjdFRleHQgfSA9IGdldEFjY2VwdFJlamVjdFRleHQoKVxuXG5cdFx0XHRcdGFjY2VwdEJ1dHRvbi50ZXh0Q29udGVudCA9IGFjY2VwdFRleHQ7XG5cdFx0XHRcdHJlamVjdEJ1dHRvbi50ZXh0Q29udGVudCA9IHJlamVjdFRleHQ7XG5cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBtb3VudCB0aGlzIHdpZGdldFxuXG5cdFx0ZWRpdG9yLmFkZE92ZXJsYXlXaWRnZXQodGhpcyk7XG5cdFx0Ly8gY29uc29sZS5sb2coJ2NyZWF0ZWQgZWx0JywgdGhpcy5fZG9tTm9kZSlcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yLnJlbW92ZU92ZXJsYXlXaWRnZXQodGhpcyk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cbn1cblxuXG5cblxuXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLDZCQUE2QjtBQUl0QyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLDJCQUFnRTtBQUV6RSxTQUFTLHFCQUFxQjtBQUM5QixTQUEyQixrQkFBa0IsMkJBQTJCO0FBQ3hFLFNBQVMscUJBQXFCO0FBRzlCLFlBQVksU0FBUztBQUNyQixTQUFTLGNBQWM7QUFFdkIsU0FBUyw4QkFBOEIsOEJBQThCO0FBQ3JFLFNBQVMscUJBQXFCLHlCQUF5QiwyQkFBMkIseUJBQXlCLDJCQUEyQix5QkFBeUIsNkNBQTZDLDJDQUEyQyxrQkFBbUI7QUFDMVEsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw0QkFBNEIsa0NBQWtDO0FBRXZFLFNBQVMsa0JBQWtCO0FBRzNCLFNBQVMsb0JBQW9CLHdCQUFxRCxrQ0FBa0M7QUFDcEgsU0FBUyw0QkFBNkI7QUFDdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsd0JBQXVGO0FBQ2hHLFNBQVMsNEJBQTRCO0FBRXJDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsVUFBVSxjQUFjLGdCQUFnQixpQkFBaUIsVUFBVSxvQkFBb0I7QUFDaEcsU0FBNkUsNEJBQWtFO0FBQy9JLFNBQVMsbUNBQW1DO0FBSTVDLE1BQU0sZ0JBQWdCLENBQUMsUUFBZ0IsSUFBSSxNQUFNLElBQUksRUFBRTtBQUdoRCxNQUFNLG9CQUFvQixDQUFDLEVBQUUsVUFBVSxZQUFZLFFBQVEsTUFBaUU7QUFDbEksTUFBSSxpQkFBaUI7QUFDckIsYUFBVyxRQUFRLFNBQVM7QUFDM0IsUUFBSSxTQUFTLEtBQU07QUFDbEIsd0JBQWtCO0FBQUEsSUFDbkIsT0FBTztBQUNOLHdCQUFrQjtBQUFBLElBQ25CO0FBQUEsRUFDRDtBQUVBLFNBQU87QUFDUjtBQUdBLE1BQU0seUJBQXlCLENBQUMsUUFBcUIsY0FBOEI7QUFFbEYsUUFBTSxRQUFRLE9BQU8sU0FBUztBQUM5QixNQUFJLENBQUMsT0FBTztBQUNYLFdBQU87QUFBQSxFQUNSO0FBR0EsUUFBTSxjQUFjLE1BQU0sZUFBZSxTQUFTLEtBQUs7QUFHdkQsUUFBTSwwQkFBMEIsWUFBWSxPQUFPLElBQUk7QUFHdkQsUUFBTSxvQkFBb0IsNEJBQTRCLEtBQ25ELGNBQ0EsWUFBWSxNQUFNLEdBQUcsdUJBQXVCO0FBRy9DLFFBQU0sRUFBRSxTQUFTLGVBQWUsSUFBSSxNQUFNLHFCQUFxQjtBQUMvRCxRQUFNLGFBQWEsT0FBTyxVQUFVLGFBQWEsUUFBUSxFQUFFO0FBQzNELFFBQU0sV0FBVyxpQkFBaUI7QUFFbEMsUUFBTSxtQkFBbUIsa0JBQWtCO0FBQUEsSUFDMUM7QUFBQSxJQUNBO0FBQUEsSUFDQSxTQUFTO0FBQUEsRUFDVixDQUFDO0FBR0QsU0FBTztBQUNSO0FBSUEsTUFBTSxpQ0FBaUMsQ0FBQyxRQUF3QjtBQUMvRCxTQUFPLElBQUksUUFBUSxhQUFhLEVBQUU7QUFDbkM7QUFPQSxNQUFNLGlCQUFpQixDQUFDLE1BQWMsY0FBc0IsK0JBQXdDLFNBQTJEO0FBRTlKLFFBQU0sWUFBWSxDQUFDQSxlQUFzQkMsU0FBZ0I7QUFDeEQsVUFBTSxZQUFZLGNBQWNELGNBQWEsVUFBVSxHQUFHQyxPQUFNLENBQUMsQ0FBQztBQUNsRSxVQUFNLFdBQVcsY0FBYyxJQUFJO0FBQ25DLFVBQU0sVUFBVSxZQUFZLFdBQVc7QUFFdkMsV0FBTyxDQUFDLFdBQVcsT0FBTztBQUFBLEVBQzNCO0FBRUEsUUFBTSxvQkFBb0IsQ0FBQ0Qsa0JBQXlCLE1BQU0sbUJBQW1CLFNBQzVFQSxjQUFhLE1BQU0sSUFBSSxFQUFFLE1BQU0sR0FBRyxLQUFLLGNBQWMsRUFBRSxLQUFLLElBQUksRUFBRSxTQUNoRTtBQUdILE1BQUksTUFBTSxhQUFhLFFBQVEsTUFBTSxrQkFBa0IsWUFBWSxDQUFDO0FBR3BFLE1BQUksUUFBUSxJQUFJO0FBQ2YsV0FBTyxVQUFVLGNBQWMsR0FBRztBQUFBLEVBQ25DO0FBRUEsTUFBSSxDQUFDO0FBQ0osV0FBTztBQUdSLFNBQU8sK0JBQStCLElBQUk7QUFDMUMsaUJBQWUsK0JBQStCLFlBQVk7QUFDMUQsUUFBTSxhQUFhLFFBQVEsTUFBTSxrQkFBa0IsWUFBWSxDQUFDO0FBRWhFLE1BQUksUUFBUSxHQUFJLFFBQU87QUFDdkIsUUFBTSxVQUFVLGFBQWEsWUFBWSxJQUFJO0FBQzdDLE1BQUksWUFBWSxJQUFLLFFBQU87QUFFNUIsU0FBTyxVQUFVLGNBQWMsR0FBRztBQUNuQztBQVNBLElBQU0sa0JBQU4sY0FBOEIsV0FBdUM7QUFBQSxFQTBCcEUsWUFFc0Msb0JBQ0wsZUFDRyxrQkFDRSxvQkFDSSx3QkFDRCx1QkFDTyw4QkFDYixpQkFDSyxzQkFFQSxrQkFFSCxtQkFDVSw2QkFDN0M7QUFDRCxVQUFNO0FBZitCO0FBQ0w7QUFDRztBQUNFO0FBQ0k7QUFDRDtBQUNPO0FBQ2I7QUFDSztBQUVBO0FBRUg7QUFDVTtBQXJDL0M7QUFBQSwwQkFBMEQsQ0FBQztBQUUzRDtBQUFBLHdCQUF5QyxDQUFDO0FBQzFDO0FBQUEsb0JBQWlDLENBQUM7QUFLbEM7QUFBQTtBQUFBO0FBQUEsU0FBaUIsNkJBQTZCLElBQUksUUFBc0I7QUFDeEUscUNBQTRCLEtBQUssMkJBQTJCO0FBRzVEO0FBQUEsU0FBaUIsMENBQTBDLElBQUksUUFBMEM7QUFDekcsU0FBaUIsa0NBQWtDLElBQUksUUFBMEM7QUFDakcsa0RBQXlDLEtBQUssd0NBQXdDO0FBQ3RGLDBDQUFpQyxLQUFLLGdDQUFnQztBQUd0RTtBQUFBLFNBQWlCLG1DQUFtQyxJQUFJLFFBQTBDO0FBQ2xHLDJDQUFrQyxLQUFLLGlDQUFpQztBQXdIeEU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUFRLHFCQUFxQixDQUFDLE9BQTBCLFdBQW1CLFNBQWlCLFdBQW1CLFlBQStDO0FBQzdKLFVBQUksVUFBVSxLQUFNO0FBQ3BCLFlBQU0sS0FBSyxNQUFNLGtCQUFrQixjQUFZLFNBQVM7QUFBQSxRQUN2RCxFQUFFLGlCQUFpQixXQUFXLGFBQWEsR0FBRyxlQUFlLFNBQVMsV0FBVyxPQUFPLGlCQUFpQjtBQUFBLFFBQ3pHO0FBQUEsVUFDQztBQUFBLFVBQ0EsYUFBYTtBQUFBLFVBQ2IsYUFBYTtBQUFBLFVBQ2IsR0FBRztBQUFBLFFBQ0o7QUFBQSxNQUFDLENBQUM7QUFDSCxZQUFNLG1CQUFtQixNQUFNO0FBQzlCLFlBQUksTUFBTSxDQUFDLE1BQU0sV0FBVyxFQUFHLE9BQU0sa0JBQWtCLGNBQVksU0FBUyxpQkFBaUIsRUFBRSxDQUFDO0FBQUEsTUFDakc7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUdBLFNBQVEsMEJBQTBCLENBQUMsUUFBYTtBQUMvQyxZQUFNLEVBQUUsTUFBTSxJQUFJLEtBQUssa0JBQWtCLFNBQVMsR0FBRztBQUVyRCxpQkFBVyxjQUFjLEtBQUssZUFBZSxJQUFJLE1BQU0sS0FBSyxDQUFDLEdBQUc7QUFDL0QsY0FBTSxXQUFXLEtBQUssYUFBYSxVQUFVO0FBRTdDLFlBQUksU0FBUyxTQUFTLFlBQVk7QUFFakMsY0FBSSxTQUFTLGFBQWEsYUFBYTtBQUV0QyxrQkFBTSxNQUFNLEtBQUssbUJBQW1CLE9BQU8sU0FBUyxhQUFhLE1BQU0sU0FBUyxhQUFhLE1BQU0saUJBQWlCO0FBRXBILGtCQUFNLE1BQU0sU0FBUyxhQUFhLE9BQU8sS0FBSyxTQUFTLFVBQ3RELEtBQUssbUJBQW1CLE9BQU8sU0FBUyxhQUFhLE9BQU8sR0FBRyxTQUFTLFNBQVMsY0FBYyxJQUM3RjtBQUNILHFCQUFTLGlCQUFpQixJQUFJLE1BQU07QUFBRSxvQkFBTTtBQUFHLG9CQUFNO0FBQUEsWUFBRyxDQUFDO0FBQUEsVUFFMUQ7QUFBQSxRQUNELFdBRVMsU0FBUyxTQUFTLGVBQWUsU0FBUyw2QkFBNkIsTUFBTTtBQUVyRixnQkFBTSxLQUFLLEtBQUssbUJBQW1CLE9BQU8sU0FBUyxXQUFXLFNBQVMsU0FBUyxrQkFBa0I7QUFDbEcsbUJBQVMsaUJBQWlCLElBQUksTUFBTSxLQUFLLENBQUM7QUFBQSxRQUMzQztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBR0EsU0FBUSxpQ0FBaUMsQ0FBQyxRQUFhO0FBQ3RELFlBQU0sRUFBRSxNQUFNLElBQUksS0FBSyxrQkFBa0IsU0FBUyxHQUFHO0FBQ3JELFVBQUksVUFBVSxLQUFNO0FBQ3BCLFlBQU0sZUFBZSxNQUFNLFNBQVMsb0JBQW9CLEVBQUU7QUFFMUQsaUJBQVcsY0FBYyxLQUFLLGVBQWUsSUFBSSxNQUFNLEtBQUssQ0FBQyxHQUFHO0FBQy9ELGNBQU0sV0FBVyxLQUFLLGFBQWEsVUFBVTtBQUM3QyxZQUFJLFNBQVMsU0FBUyxXQUFZO0FBRWxDLGNBQU0sa0JBQWtCLGFBQWEsTUFBTSxJQUFJLEVBQUUsTUFBTyxTQUFTLFlBQVksR0FBSyxTQUFTLFVBQVUsSUFBSyxDQUFDLEVBQUUsS0FBSyxJQUFJO0FBQ3RILGNBQU0sZ0JBQWdCLFVBQVUsU0FBUyxjQUFjLGVBQWU7QUFDdEUsaUJBQVMsZ0JBQWdCLGVBQWU7QUFDdkMsY0FBSSxhQUFhLFNBQVMsWUFBWTtBQUNyQyx5QkFBYSxhQUFhLFNBQVMsWUFBWTtBQUFBLFVBQ2hEO0FBQ0EsY0FBSSxhQUFhLFNBQVMsVUFBVSxhQUFhLFNBQVMsYUFBYTtBQUN0RSx5QkFBYSxhQUFhLFNBQVMsWUFBWTtBQUMvQyx5QkFBYSxXQUFXLFNBQVMsWUFBWTtBQUFBLFVBQzlDO0FBQ0EsZUFBSyxTQUFTLGNBQWMsUUFBUTtBQUFBLFFBQ3JDO0FBQUEsTUFFRDtBQUFBLElBQ0Q7QUFJQSx1Q0FBa0UsQ0FBQztBQUNuRSxTQUFRLHFCQUFxQixDQUFDLGNBQXlCO0FBRXRELFlBQU0sRUFBRSxTQUFTLElBQUk7QUFDckIsWUFBTSxTQUFTLEtBQUssbUJBQW1CLGdCQUFnQixFQUFFLEtBQUssT0FBSyxFQUFFLE1BQU0sTUFBTSxRQUFRO0FBQ3pGLFVBQUksQ0FBQyxRQUFRO0FBQUUsZUFBTztBQUFBLE1BQUs7QUFFM0IsVUFBSSxTQUF3QjtBQUM1QixVQUFJLFlBQThCO0FBQ2xDLFlBQU0sY0FBdUQsRUFBRSxTQUFTLEtBQUs7QUFHN0UsWUFBTSxjQUFjLHVCQUF1QixRQUFRLFVBQVUsU0FBUztBQUV0RSxZQUFNLFNBQVMsS0FBSyw2QkFBNkIsWUFBWSxRQUFRLE1BQU07QUFDMUUsY0FBTSxVQUFVLFNBQVMsY0FBYyxLQUFLO0FBQzVDLGdCQUFRLE1BQU0sU0FBUztBQUN2QixnQkFBUSxNQUFNLFNBQVM7QUFDdkIsZ0JBQVEsTUFBTSxjQUFjLEdBQUcsV0FBVztBQUMxQyxjQUFNLFdBQXNCO0FBQUEsVUFDM0IsaUJBQWlCLFVBQVUsWUFBWTtBQUFBLFVBQ3ZDO0FBQUE7QUFBQSxVQUVBLG1CQUFtQjtBQUFBLFVBQ25CLG1CQUFtQjtBQUFBLFFBQ3BCO0FBQ0Esb0JBQVk7QUFHWixlQUFPLGdCQUFnQixjQUFZO0FBQ2xDLG1CQUFTLFNBQVMsUUFBUSxRQUFRO0FBQUEsUUFDbkMsQ0FBQztBQUdELFlBQUksWUFBc0M7QUFDMUMsYUFBSyxzQkFBc0IsZUFBZSxjQUFZO0FBQ3JELHNCQUFZLFdBQVcsU0FBUyxVQUFVO0FBQUEsWUFFekMsWUFBWSxVQUFVO0FBQUEsWUFFdEIsYUFBYSxDQUFDLE1BQU07QUFDbkIsMEJBQVksVUFBVTtBQUN0QixrQkFBSSxDQUFDLFlBQVksUUFBUztBQUUxQixrQkFBSSxFQUFFLFVBQVUsY0FBYyxLQUFLLDhCQUE4QjtBQUNoRSxxQkFBSyw0QkFBNEIsVUFBVSxVQUFVLElBQUk7QUFDekQsMkJBQVcsTUFBTSxZQUFZLFNBQVMsTUFBTSxHQUFHLEdBQUc7QUFBQSxjQUNuRDtBQUFBLFlBQ0Q7QUFBQSxZQUNBLGVBQWUsUUFBUTtBQUN0QixrQkFBSSxXQUFXLEVBQUc7QUFDbEIsdUJBQVMsYUFBYTtBQUV0QixxQkFBTyxnQkFBZ0IsQ0FBQUUsY0FBWTtBQUNsQyxvQkFBSSxPQUFRLENBQUFBLFVBQVMsV0FBVyxNQUFNO0FBQUEsY0FDdkMsQ0FBQztBQUFBLFlBQ0Y7QUFBQSxZQUNBLGNBQWMsQ0FBQyxTQUFTO0FBQ3ZCLG1CQUFLLDRCQUE0QixVQUFVLFVBQVUsSUFBSTtBQUFBLFlBQzFEO0FBQUEsWUFDQSxVQUFVLEtBQUssNEJBQTRCLFVBQVUsVUFBVSxLQUFLO0FBQUEsVUFDckUsQ0FBOEIsR0FBRztBQUFBLFFBQ2xDLENBQUM7QUFHRCxlQUFPLE1BQU07QUFDWixpQkFBTyxnQkFBZ0IsY0FBWTtBQUFFLGdCQUFJLE9BQVEsVUFBUyxXQUFXLE1BQU07QUFBQSxVQUFFLENBQUM7QUFDOUUsc0JBQVk7QUFBQSxRQUNiO0FBQUEsTUFDRCxDQUFDO0FBRUQsYUFBTztBQUFBLFFBQ047QUFBQSxRQUNBLFNBQVMsTUFBTSxPQUFPLGdCQUFnQixjQUFZO0FBQ2pELGNBQUksVUFBVSxXQUFXO0FBQ3hCLHNCQUFVLGtCQUFrQixVQUFVLFlBQVk7QUFDbEQscUJBQVMsV0FBVyxNQUFNO0FBQUEsVUFDM0I7QUFBQSxRQUNELENBQUM7QUFBQSxRQUNELFNBQVMsTUFBTTtBQUNkLGVBQUssNkJBQTZCLGlCQUFpQixNQUFNO0FBQUEsUUFDMUQ7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUlBLFNBQVEsc0JBQXNCLE9BQU8sUUFBYTtBQUNqRCxpQkFBVyxjQUFjLEtBQUssZUFBZSxJQUFJLE1BQU0sS0FBSyxDQUFDLEdBQUc7QUFDL0QsY0FBTSxXQUFXLEtBQUssYUFBYSxVQUFVO0FBQzdDLFlBQUksU0FBUyxTQUFTLFlBQWE7QUFDbkMsWUFBSSxDQUFDLFNBQVMsWUFBWTtBQUN6QixtQkFBUyxhQUFhLEtBQUssbUJBQW1CLFFBQVE7QUFDdEQsa0JBQVEsSUFBSSxpQkFBaUIsU0FBUyxVQUFVO0FBQUEsUUFDakQsT0FDSztBQUNKLG1CQUFTLFdBQVcsUUFBUTtBQUFBLFFBQzdCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxTQUFRLHNCQUFzQixDQUFDLEtBQVUsU0FBZTtBQUN2RCxZQUFNLEVBQUUsTUFBTSxPQUFPLElBQUk7QUFFekIsWUFBTSx5QkFBeUMsQ0FBQztBQUVoRCxZQUFNLEVBQUUsTUFBTSxJQUFJLEtBQUssa0JBQWtCLFNBQVMsR0FBRztBQUdyRCxVQUFJLFNBQVMsWUFBWTtBQUN4QixjQUFNLEtBQUssS0FBSyxtQkFBbUIsT0FBTyxLQUFLLFdBQVcsS0FBSyxTQUFTLGdCQUFnQjtBQUFBLFVBQ3ZGLFNBQVMsRUFBRSxPQUFPLEVBQUUsSUFBSSxnQ0FBZ0MsR0FBRyxVQUFVLEVBQUU7QUFBQSxVQUN2RSxlQUFlLEVBQUUsT0FBTyxFQUFFLElBQUksc0NBQXNDLEdBQUcsVUFBVSxFQUFFO0FBQUEsUUFDcEYsQ0FBQztBQUNELCtCQUF1QixLQUFLLE1BQU07QUFBRSxlQUFLO0FBQUEsUUFBRSxDQUFDO0FBQUEsTUFDN0M7QUFJQSxVQUFJLFNBQVMsYUFBYTtBQUN6QixjQUFNLG1CQUFtQixLQUFLLHVCQUF1Qix1QkFBdUI7QUFBQSxVQUMzRTtBQUFBLFVBQ0EsSUFBSSxDQUFDLFdBQVc7QUFFZixrQkFBTSxVQUFVLFNBQVMsY0FBYyxLQUFLO0FBQzVDLG9CQUFRLFlBQVk7QUFFcEIsa0JBQU0sZ0JBQWdCLGNBQWMsV0FBVyxNQUFNO0FBRXJELGtCQUFNLGdCQUFnQixLQUFLLGFBQWEsUUFBUSxPQUFPLElBQUksT0FBTyxjQUFjLE9BQU8sQ0FBQztBQUV4RixrQkFBTSxRQUFRLGNBQWMsTUFBTSxJQUFJO0FBRXRDLGtCQUFNLGlCQUFpQixTQUFTLGNBQWMsS0FBSztBQUNuRCwyQkFBZSxNQUFNLGFBQWEsY0FBYyxTQUFTO0FBQ3pELDJCQUFlLE1BQU0sV0FBVyxHQUFHLGNBQWMsU0FBUyxRQUFRO0FBQ2xFLDJCQUFlLE1BQU0sYUFBYSxHQUFHLGNBQWMsU0FBUyxVQUFVO0FBRXRFLDJCQUFlLE1BQU0sYUFBYTtBQUNsQywyQkFBZSxNQUFNLFdBQVc7QUFDaEMsMkJBQWUsTUFBTSxRQUFRO0FBRTdCLGtCQUFNLFFBQVEsVUFBUTtBQUVyQixvQkFBTSxVQUFVLFNBQVMsY0FBYyxLQUFLO0FBQzVDLHNCQUFRLFlBQVk7QUFDcEIsc0JBQVEsTUFBTSxhQUFhO0FBQzNCLHNCQUFRLE1BQU0sV0FBVztBQUN6QixzQkFBUSxNQUFNLFNBQVMsR0FBRyxjQUFjLFNBQVMsVUFBVTtBQUczRCxvQkFBTSxPQUFPLFNBQVMsY0FBYyxNQUFNO0FBQzFDLG1CQUFLLGNBQWMsUUFBUTtBQUMzQixtQkFBSyxNQUFNLGFBQWE7QUFDeEIsbUJBQUssTUFBTSxVQUFVO0FBRXJCLHNCQUFRLFlBQVksSUFBSTtBQUN4Qiw2QkFBZSxZQUFZLE9BQU87QUFBQSxZQUNuQyxDQUFDO0FBRUQsb0JBQVEsWUFBWSxjQUFjO0FBR2xDLGtCQUFNLGdCQUFnQixNQUFNO0FBQzVCLGtCQUFNLGVBQWUsS0FBSyxJQUFJLEdBQUcsTUFBTTtBQUFBLGNBQUksVUFDMUMsS0FBSyxLQUFLLGNBQWMsU0FBUyxpQ0FBaUMsS0FBSyxNQUFNO0FBQUEsWUFDOUUsQ0FBQztBQUVELGtCQUFNLFdBQXNCO0FBQUEsY0FDM0IsaUJBQWlCLEtBQUssWUFBWTtBQUFBLGNBQ2xDO0FBQUEsY0FDQTtBQUFBLGNBQ0E7QUFBQSxjQUNBLGVBQWUsU0FBUyxjQUFjLEtBQUs7QUFBQSxjQUMzQyxtQkFBbUI7QUFBQSxjQUNuQixtQkFBbUI7QUFBQSxZQUNwQjtBQUVBLGdCQUFJLFNBQXdCO0FBQzVCLG1CQUFPLGdCQUFnQixjQUFZO0FBQUUsdUJBQVMsU0FBUyxRQUFRLFFBQVE7QUFBQSxZQUFFLENBQUM7QUFDMUUsbUJBQU8sTUFBTSxPQUFPLGdCQUFnQixjQUFZO0FBQUUsa0JBQUksT0FBUSxVQUFTLFdBQVcsTUFBTTtBQUFBLFlBQUUsQ0FBQztBQUFBLFVBQzVGO0FBQUEsUUFDRCxDQUFDO0FBRUQsK0JBQXVCLEtBQUssTUFBTTtBQUFFLGVBQUssdUJBQXVCLDRCQUE0QixnQkFBZ0I7QUFBQSxRQUFFLENBQUM7QUFBQSxNQUVoSDtBQUlBLFlBQU0sV0FBVyxLQUFLLGFBQWEsS0FBSyxVQUFVO0FBQ2xELFVBQUksU0FBUyxTQUFTLGNBQWMsQ0FBQyxTQUFTLGFBQWEsYUFBYTtBQUV2RSxjQUFNLHFCQUFxQixLQUFLLHVCQUF1Qix1QkFBdUI7QUFBQSxVQUM3RTtBQUFBLFVBQ0EsSUFBSSxDQUFDLFdBQVc7QUFDZixnQkFBSTtBQUNKLGdCQUFJO0FBQ0osZ0JBQUksS0FBSyxTQUFTLGVBQWUsS0FBSyxTQUFTLFFBQVE7QUFDdEQsMEJBQVksS0FBSztBQUNqQiw0QkFBYztBQUFBLFlBQ2YsV0FDUyxLQUFLLFNBQVMsWUFBWTtBQUVsQyxrQkFBSSxLQUFLLGNBQWMsR0FBRztBQUN6QixzQkFBTSxjQUFjLEtBQUssa0JBQWtCLEtBQUssb0JBQW9CO0FBQ3BFLDRCQUFZLEtBQUs7QUFDakIsOEJBQWMsQ0FBQztBQUFBLGNBQ2hCLE9BQ0s7QUFDSiw0QkFBWSxLQUFLLFlBQVk7QUFDN0IsOEJBQWM7QUFBQSxjQUNmO0FBQUEsWUFDRCxPQUNLO0FBQUUsb0JBQU0sSUFBSSxNQUFNLFFBQVE7QUFBQSxZQUFFO0FBRWpDLGtCQUFNLGdCQUFnQixLQUFLLHNCQUFzQixlQUFlLDBCQUEwQjtBQUFBLGNBQ3pGO0FBQUEsY0FDQSxVQUFVLE1BQU07QUFDZixxQkFBSyxXQUFXLEVBQUUsT0FBTyxDQUFDO0FBQzFCLHFCQUFLLGdCQUFnQixRQUFRLGVBQWUsRUFBRSxPQUFPLENBQUM7QUFBQSxjQUN2RDtBQUFBLGNBQ0EsVUFBVSxNQUFNO0FBQ2YscUJBQUssV0FBVyxFQUFFLE9BQU8sQ0FBQztBQUMxQixxQkFBSyxnQkFBZ0IsUUFBUSxlQUFlLEVBQUUsT0FBTyxDQUFDO0FBQUEsY0FDdkQ7QUFBQSxjQUNBLFFBQVEsT0FBTyxTQUFTO0FBQUEsY0FDeEI7QUFBQSxjQUNBO0FBQUEsWUFDRCxDQUFDO0FBQ0QsbUJBQU8sTUFBTTtBQUFFLDRCQUFjLFFBQVE7QUFBQSxZQUFFO0FBQUEsVUFDeEM7QUFBQSxRQUNELENBQUM7QUFDRCwrQkFBdUIsS0FBSyxNQUFNO0FBQUUsZUFBSyx1QkFBdUIsNEJBQTRCLGtCQUFrQjtBQUFBLFFBQUUsQ0FBQztBQUFBLE1BQ2xIO0FBRUEsWUFBTSxrQkFBa0IsTUFBTTtBQUFFLCtCQUF1QixRQUFRLE9BQUssRUFBRSxDQUFDO0FBQUEsTUFBRTtBQUN6RSxhQUFPO0FBQUEsSUFFUjtBQWFBLHdCQUFlO0FBd0NmLFNBQVEsOEJBQThCLENBQUMsUUFBK0I7QUFDckUsWUFBTSxFQUFFLE1BQU0sSUFBSSxLQUFLLGtCQUFrQixTQUFTLEdBQUc7QUFDckQsWUFBTSwwQkFBaUUsQ0FBQztBQUV4RSxpQkFBVyxjQUFjLEtBQUssY0FBYztBQUMzQyxjQUFNLFdBQVcsS0FBSyxhQUFhLFVBQVU7QUFFN0MsWUFBSSxTQUFTLEtBQUssV0FBVyxJQUFJLE9BQVE7QUFFekMsZ0NBQXdCLFVBQVUsSUFBSTtBQUFBLFVBQ3JDLE9BQU8sWUFBWSxxQkFBcUIsSUFBSSxTQUFPLENBQUMsS0FBSyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFBQSxRQUN6RTtBQUFBLE1BQ0Q7QUFFQSxZQUFNLGlCQUFpQixRQUFRLE1BQU0sU0FBUyxvQkFBb0IsRUFBRSxJQUFJO0FBR3hFLGFBQU87QUFBQSxRQUNOO0FBQUEsUUFDQTtBQUFBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxTQUFRLDJCQUEyQixPQUFPLEtBQVUsYUFBK0I7QUFFbEYsaUJBQVcsY0FBYyxLQUFLLGNBQWM7QUFDM0MsY0FBTSxXQUFXLEtBQUssYUFBYSxVQUFVO0FBQzdDLFlBQUksU0FBUyxTQUFTO0FBQ3JCLGVBQUssaUJBQWlCLFFBQVE7QUFBQSxNQUNoQztBQUdBLFdBQUssb0JBQW9CLEdBQUc7QUFFNUIsWUFBTSxFQUFFLHlCQUF5QixnQkFBZ0IsZ0JBQWdCLElBQUksVUFBVSxRQUFRO0FBR3ZGLGlCQUFXLGNBQWMseUJBQXlCO0FBRWpELGNBQU0sc0JBQXNCLHdCQUF3QixVQUFVO0FBRTlELFlBQUksb0JBQW9CLFNBQVMsWUFBWTtBQUM1QyxlQUFLLGFBQWEsVUFBVSxJQUFJO0FBQUEsWUFDL0IsR0FBRztBQUFBLFlBQ0gsTUFBTTtBQUFBLFlBQ04sV0FBVyxDQUFDO0FBQUEsWUFDWixNQUFNO0FBQUEsWUFDTixjQUFjLEVBQUUsYUFBYSxNQUFNO0FBQUE7QUFBQSxZQUNuQyxrQkFBa0Isb0JBQUksSUFBSTtBQUFBLFVBQzNCO0FBQUEsUUFDRCxXQUNTLG9CQUFvQixTQUFTLGFBQWE7QUFDbEQsZUFBSyxhQUFhLFVBQVUsSUFBSTtBQUFBLFlBQy9CLEdBQUc7QUFBQSxZQUNILE1BQU07QUFBQSxZQUNOLGtCQUFrQixvQkFBSSxJQUFjO0FBQUEsWUFDcEMsWUFBWTtBQUFBLFlBQ1osMEJBQTBCO0FBQUE7QUFBQSxVQUMzQjtBQUFBLFFBQ0Q7QUFDQSxhQUFLLDhCQUE4QixLQUFLLFVBQVU7QUFBQSxNQUNuRDtBQUNBLFdBQUssMkJBQTJCLEtBQUssRUFBRSxJQUFJLENBQUM7QUFHNUMsV0FBSztBQUFBLFFBQWM7QUFBQSxRQUFLO0FBQUEsUUFDdkI7QUFBQSxRQUNBLEVBQUUsd0JBQXdCLE1BQU07QUFBQSxNQUNqQztBQUFBLElBRUQ7QUFxR0EsU0FBUSxnQ0FBZ0MsQ0FBQyxLQUFVLGVBQWdDO0FBQ2xGLFVBQUksRUFBRSxJQUFJLFVBQVUsS0FBSyxnQkFBaUIsTUFBSyxlQUFlLElBQUksTUFBTSxJQUFJLG9CQUFJLElBQUk7QUFDcEYsV0FBSyxlQUFlLElBQUksTUFBTSxHQUFHLElBQUksV0FBVyxTQUFTLENBQUM7QUFBQSxJQUMzRDtBQUVBLFNBQVEsa0JBQWtCO0FBUzFCLFNBQVEsY0FBYztBQW11QnRCO0FBQUE7QUFBQTtBQUFBLFNBQVEsMEJBQTBCLENBQ2pDLEtBQ0EsY0FDWTtBQUNaLFlBQU0sa0JBQWtCLEdBQUcsV0FBVyxDQUFDLENBQUM7QUFBQSxFQUFLLEtBQUssVUFBVSxTQUFTLENBQUM7QUFBQSxFQUFLLFdBQVcsQ0FBQyxDQUFDO0FBR3hGLFVBQUk7QUFDSixjQUFRLEtBQUs7QUFBQSxRQUNaLEtBQUs7QUFDSixvQkFBVTtBQUFBLEVBQTZILGVBQWU7QUFDdEo7QUFBQSxRQUNELEtBQUs7QUFDSixvQkFBVTtBQUFBLEVBQWdLLGVBQWU7QUFDekw7QUFBQSxRQUNELEtBQUs7QUFDSixvQkFBVTtBQUFBLEVBQTBKLGVBQWU7QUFDbkw7QUFBQSxRQUNEO0FBQ0Msb0JBQVU7QUFBQSxNQUNaO0FBQ0EsYUFBTztBQUFBLElBQ1I7QUEyZEE7QUFBQSxTQUFPLDZCQUE2RSxPQUFPLEVBQUUsS0FBSyxVQUFVLGNBQWMsY0FBYyxNQUFNO0FBRTdJLFlBQU0sY0FBYyxLQUFLLGVBQWUsSUFBSSxNQUFNO0FBQ2xELFdBQUssYUFBYSxRQUFRLE9BQU8sRUFBRztBQUVwQyxZQUFNLEVBQUUsYUFBYSxJQUFJLGtCQUFrQixRQUFRLEVBQUUsY0FBYyxNQUFNO0FBQUEsTUFBRSxFQUFFLElBQUksS0FBSyxjQUFjLEdBQUc7QUFFdkcsaUJBQVcsY0FBYyxlQUFlLENBQUMsR0FBRztBQUMzQyxjQUFNLFdBQVcsS0FBSyxhQUFhLFVBQVU7QUFDN0MsWUFBSSxDQUFDLFNBQVU7QUFFZixZQUFJLFNBQVMsU0FBUyxZQUFZO0FBQ2pDLGNBQUksYUFBYSxVQUFVO0FBQzFCLGlCQUFLLGdCQUFnQixRQUFRO0FBQzdCLGlCQUFLLGdCQUFnQixRQUFRO0FBQUEsVUFDOUIsV0FDUyxhQUFhLFNBQVUsTUFBSyxnQkFBZ0IsUUFBUTtBQUFBLFFBQzlELFdBQ1MsU0FBUyxTQUFTLGVBQWUsY0FBYztBQUN2RCxlQUFLLGlCQUFpQixRQUFRO0FBQUEsUUFDL0I7QUFBQSxNQUNEO0FBRUEsV0FBSyw0QkFBNEIsR0FBRztBQUNwQyxtQkFBYTtBQUFBLElBQ2Q7QUF0M0RDLFVBQU0sc0JBQXNCLG9CQUFJLElBQVk7QUFDNUMsVUFBTSxrQkFBa0IsT0FBTyxVQUFzQjtBQUVwRCxZQUFNLEtBQUssa0JBQWtCLGdCQUFnQixNQUFNLEdBQUc7QUFHdEQsVUFBSSxvQkFBb0IsSUFBSSxNQUFNLElBQUksTUFBTSxFQUFHO0FBQy9DLDBCQUFvQixJQUFJLE1BQU0sSUFBSSxNQUFNO0FBRXhDLFVBQUksRUFBRSxNQUFNLElBQUksVUFBVSxLQUFLLGlCQUFpQjtBQUMvQyxhQUFLLGVBQWUsTUFBTSxJQUFJLE1BQU0sSUFBSSxvQkFBSSxJQUFJO0FBQUEsTUFDakQ7QUFHQSxXQUFLO0FBQUEsUUFDSixNQUFNLG1CQUFtQixPQUFLO0FBRTdCLGNBQUksS0FBSyxhQUFjO0FBQ3ZCLGdCQUFNLE1BQU0sTUFBTTtBQUNsQixlQUFLLHFCQUFxQixLQUFLLENBQUM7QUFBQSxRQUNqQyxDQUFDO0FBQUEsTUFDRjtBQUdBLFdBQUssNEJBQTRCLE1BQU0sR0FBRztBQUFBLElBQzNDO0FBRUEsYUFBUyxTQUFTLEtBQUssY0FBYyxVQUFVLEdBQUc7QUFBRSxzQkFBZ0IsS0FBSztBQUFBLElBQUU7QUFDM0UsU0FBSyxVQUFVLEtBQUssY0FBYyxhQUFhLFdBQVM7QUFBRSxzQkFBZ0IsS0FBSztBQUFBLElBQUUsQ0FBQyxDQUFDO0FBSW5GLFFBQUksbUJBQW1CLENBQUMsV0FBd0I7QUFDL0MsWUFBTSxNQUFNLE9BQU8sU0FBUyxHQUFHLE9BQU87QUFDdEMsVUFBSSxJQUFLLE1BQUssNEJBQTRCLEdBQUc7QUFBQSxJQUM5QztBQUdBLGFBQVMsVUFBVSxLQUFLLG1CQUFtQixnQkFBZ0IsR0FBRztBQUFFLHVCQUFpQixNQUFNO0FBQUEsSUFBRTtBQUN6RixTQUFLLFVBQVUsS0FBSyxtQkFBbUIsZ0JBQWdCLFlBQVU7QUFBRSx1QkFBaUIsTUFBTTtBQUFBLElBQUUsQ0FBQyxDQUFDO0FBQUEsRUFHL0Y7QUFBQSxFQUdRLHFCQUFxQixLQUFVLEdBQThCO0FBQ3BFLGVBQVcsVUFBVSxFQUFFLFNBQVM7QUFDL0IsV0FBSywwQkFBMEIsS0FBSyxPQUFPLE1BQU0sT0FBTyxLQUFLO0FBQUEsSUFDOUQ7QUFDQSxTQUFLLDRCQUE0QixHQUFHO0FBR3BDLFVBQU0sb0JBQWdDLENBQUM7QUFDdkMsZUFBVyxjQUFjLEtBQUssZUFBZSxJQUFJLE1BQU0sS0FBSyxDQUFDLEdBQUc7QUFDL0QsWUFBTSxXQUFXLEtBQUssYUFBYSxVQUFVLEtBQUs7QUFDbEQsWUFBTSxlQUFlLFVBQVUsU0FBUyxjQUFjLE9BQU8sS0FBSyxTQUFTLFNBQVMsRUFBRSxXQUFXO0FBQ2pHLFVBQUksY0FBYztBQUNqQiwwQkFBa0IsS0FBSyxRQUFRO0FBQUEsTUFDaEM7QUFBQSxJQUNEO0FBQ0EsUUFBSSxrQkFBa0IsV0FBVyxHQUFHO0FBQ25DLFlBQU0sRUFBRSxhQUFhLElBQUksS0FBSyxjQUFjLEdBQUc7QUFDL0Msd0JBQWtCLFFBQVEsUUFBTSxLQUFLLGdCQUFnQixFQUFFLENBQUM7QUFDeEQsbUJBQWE7QUFBQSxJQUNkO0FBQUEsRUFFRDtBQUFBLEVBR08seUJBQXlCLGVBQStCO0FBQzlELFdBQU8sY0FDTCxRQUFRLFVBQVUsUUFBRyxFQUNyQixRQUFRLGNBQWMsUUFBRztBQUFBLEVBQzVCO0FBQUEsRUFzVlEsc0JBQWtDO0FBQ3pDLFVBQU0sU0FBUyxLQUFLLG1CQUFtQixvQkFBb0I7QUFDM0QsUUFBSSxDQUFDLE9BQVEsUUFBTztBQUNwQixVQUFNLE1BQU0sT0FBTyxTQUFTLEdBQUc7QUFDL0IsUUFBSSxDQUFDLElBQUssUUFBTztBQUNqQixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBR1EsY0FBYyxLQUFVLE1BQWMsUUFBbUMsRUFBRSx1QkFBd0IsR0FBeUM7QUFDbkosVUFBTSxFQUFFLE1BQU0sSUFBSSxLQUFLLGtCQUFrQixTQUFTLEdBQUc7QUFDckQsUUFBSSxDQUFDLE9BQU87QUFDWCxXQUFLLDRCQUE0QixHQUFHO0FBQ3BDO0FBQUEsSUFDRDtBQUVBLFVBQU0sUUFBZ0IsV0FBVyxtQkFDaEMsRUFBRSxpQkFBaUIsR0FBRyxhQUFhLEdBQUcsZUFBZSxNQUFNLGFBQWEsR0FBRyxXQUFXLE9BQU8saUJBQWlCLElBQzVHO0FBR0gsUUFBSSx3QkFBd0I7QUFDM0IsWUFBTSxVQUFVO0FBQ2hCLFlBQU0sV0FBVztBQUNqQixXQUFLLDBCQUEwQixLQUFLLFNBQVMsUUFBUTtBQUFBLElBQ3REO0FBRUEsVUFBTSxTQUFTLE1BQU0sU0FBUyxvQkFBb0IsRUFBRTtBQUdwRCxVQUFNLGtCQUFrQixXQUFXO0FBQ25DLFFBQUksaUJBQWlCO0FBQ3BCLFdBQUssNEJBQTRCLEdBQUc7QUFDcEM7QUFBQSxJQUNEO0FBRUEsU0FBSyxlQUFlO0FBQ3BCLFVBQU0sV0FBVyxDQUFDLEVBQUUsT0FBTyxLQUFLLENBQUMsQ0FBQztBQUNsQyxTQUFLLGVBQWU7QUFFcEIsU0FBSyw0QkFBNEIsR0FBRztBQUFBLEVBQ3JDO0FBQUEsRUFnRlEsY0FBYyxLQUFVLE1BQW9DO0FBQ25FLFVBQU0saUJBQW1DLEtBQUssNEJBQTRCLEdBQUc7QUFDN0UsUUFBSSxnQkFBeUM7QUFFN0MsVUFBTSxNQUF3QjtBQUFBLE1BQzdCLE1BQU0sb0JBQW9CO0FBQUEsTUFDMUIsVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLE1BQ1AsTUFBTTtBQUFBLE1BQ04sTUFBTSxZQUFZO0FBQUUsY0FBTSxhQUFhO0FBQUcsY0FBTSxLQUFLLHlCQUF5QixLQUFLLGNBQWM7QUFBQSxNQUFFO0FBQUEsTUFDbkcsTUFBTSxZQUFZO0FBQUUsWUFBSSxjQUFlLE9BQU0sS0FBSyx5QkFBeUIsS0FBSyxhQUFhO0FBQUEsTUFBRTtBQUFBLElBQ2hHO0FBQ0EsU0FBSyxpQkFBaUIsWUFBWSxHQUFHO0FBRXJDLFVBQU0sZUFBZSxZQUFZO0FBQ2hDLHNCQUFnQixLQUFLLDRCQUE0QixHQUFHO0FBQ3BELFlBQU0sS0FBSyxrQkFBa0IsVUFBVSxHQUFHO0FBQUEsSUFDM0M7QUFDQSxXQUFPLEVBQUUsYUFBYTtBQUFBLEVBQ3ZCO0FBQUEsRUFHTyxvQkFBb0IsS0FBVTtBQUNwQyxXQUFPLEtBQUssNEJBQTRCLEdBQUc7QUFBQSxFQUM1QztBQUFBLEVBR08sd0JBQXdCLEtBQVUsVUFBa0M7QUFDMUUsU0FBSyx5QkFBeUIsS0FBSyxRQUFRO0FBQUEsRUFDNUM7QUFBQTtBQUFBLEVBSVEsWUFBWSxNQUFZO0FBQy9CLFVBQU0sV0FBVyxLQUFLLGFBQWEsS0FBSyxVQUFVO0FBQ2xELFFBQUksU0FBUyxTQUFTLFdBQVk7QUFDbEMsV0FBTyxTQUFTLFVBQVUsS0FBSyxNQUFNO0FBQ3JDLFdBQU8sS0FBSyxTQUFTLEtBQUssTUFBTTtBQUFBLEVBQ2pDO0FBQUEsRUFFUSxhQUFhLFVBQW9CO0FBQ3hDLGVBQVcsVUFBVSxTQUFTLFdBQVc7QUFDeEMsWUFBTSxPQUFPLFNBQVMsVUFBVSxNQUFNO0FBQ3RDLFdBQUssWUFBWSxJQUFJO0FBQUEsSUFDdEI7QUFBQSxFQUNEO0FBQUEsRUFFUSx5QkFBeUIsVUFBb0I7QUFFcEQsUUFBSSxTQUFTLFNBQVM7QUFDckIsV0FBSyxhQUFhLFFBQVE7QUFFM0IsYUFBUyxrQkFBa0IsUUFBUSxrQkFBZ0IsYUFBYSxDQUFDO0FBQ2pFLGFBQVMsa0JBQWtCLE1BQU07QUFBQSxFQUNsQztBQUFBO0FBQUEsRUFJUSxpQkFBaUIsS0FBVTtBQUNsQyxhQUFTLGNBQWMsS0FBSyxlQUFlLElBQUksTUFBTSxLQUFLLENBQUMsR0FBRztBQUM3RCxZQUFNLFdBQVcsS0FBSyxhQUFhLFVBQVU7QUFDN0MsV0FBSyx5QkFBeUIsUUFBUTtBQUFBLElBQ3ZDO0FBQUEsRUFDRDtBQUFBO0FBQUEsRUFJUSxnQkFBZ0IsVUFBb0I7QUFDM0MsU0FBSyx5QkFBeUIsUUFBUTtBQUN0QyxXQUFPLEtBQUssYUFBYSxTQUFTLFVBQVU7QUFDNUMsU0FBSyxlQUFlLFNBQVMsS0FBSyxNQUFNLEdBQUcsT0FBTyxTQUFTLFdBQVcsU0FBUyxDQUFDO0FBQ2hGLFNBQUssMkJBQTJCLEtBQUssRUFBRSxLQUFLLFNBQVMsS0FBSyxDQUFDO0FBQUEsRUFDNUQ7QUFBQSxFQUVRLG9CQUFvQixjQUFxQztBQUNoRSxXQUFPLEtBQUssYUFBYSxhQUFhLFVBQVU7QUFDaEQsU0FBSyxlQUFlLGFBQWEsS0FBSyxNQUFNLEdBQUcsT0FBTyxhQUFhLFdBQVcsU0FBUyxDQUFDO0FBQUEsRUFDekY7QUFBQSxFQUVRLGlCQUFpQixXQUFzQjtBQUM5QyxTQUFLLGlCQUFpQixVQUFVLElBQUk7QUFDcEMsY0FBVSxZQUFZLFFBQVE7QUFDOUIsV0FBTyxLQUFLLGFBQWEsVUFBVSxVQUFVO0FBQzdDLFNBQUssZUFBZSxVQUFVLEtBQUssTUFBTSxHQUFHLE9BQU8sVUFBVSxXQUFXLFNBQVMsQ0FBQztBQUFBLEVBQ25GO0FBQUEsRUFHUSxvQkFBb0IsS0FBVTtBQUNyQyxVQUFNLFlBQVksS0FBSyxlQUFlLElBQUksTUFBTTtBQUNoRCxlQUFXLFFBQVEsZ0JBQWM7QUFDaEMsWUFBTSxXQUFXLEtBQUssYUFBYSxVQUFVO0FBQzdDLFVBQUksU0FBUyxTQUFTO0FBQ3JCLGFBQUssZ0JBQWdCLFFBQVE7QUFBQSxlQUNyQixTQUFTLFNBQVM7QUFDMUIsYUFBSyxpQkFBaUIsUUFBUTtBQUFBLElBQ2hDLENBQUM7QUFDRCxTQUFLLGVBQWUsSUFBSSxNQUFNLEdBQUcsTUFBTTtBQUFBLEVBQ3hDO0FBQUE7QUFBQSxFQVFRLGFBQWlDLFVBQW9DO0FBQzVFLFVBQU0sYUFBYSxLQUFLO0FBQ3hCLFVBQU0sWUFBWSxFQUFFLEdBQUcsVUFBVSxXQUFXO0FBQzVDLFNBQUssOEJBQThCLFNBQVMsTUFBTSxVQUFVO0FBQzVELFNBQUssYUFBYSxVQUFVLElBQUk7QUFDaEMsV0FBTztBQUFBLEVBQ1I7QUFBQTtBQUFBLEVBR1EsU0FBUyxjQUE0QixVQUEwQjtBQUN0RSxVQUFNLE1BQU0sU0FBUztBQUNyQixVQUFNLFNBQVMsS0FBSztBQUdwQixVQUFNLFVBQWdCO0FBQUEsTUFDckIsR0FBRztBQUFBLE1BQ0g7QUFBQSxNQUNBLFlBQVksU0FBUztBQUFBLElBQ3RCO0FBRUEsVUFBTSxLQUFLLEtBQUssb0JBQW9CLEtBQUssT0FBTztBQUNoRCxRQUFJLEdBQUksVUFBUyxpQkFBaUIsSUFBSSxFQUFFO0FBRXhDLFNBQUssU0FBUyxNQUFNLElBQUk7QUFDeEIsYUFBUyxVQUFVLE1BQU0sSUFBSTtBQUU3QixXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUEsRUFNUSwwQkFBMEIsS0FBVSxNQUFjLGNBQWtFO0FBSzNILFVBQU0sWUFBWSxhQUFhO0FBQy9CLFVBQU0sVUFBVSxhQUFhO0FBRTdCLFVBQU0saUJBQWlCLEtBQUssTUFBTSxLQUFLLEtBQUssQ0FBQyxHQUFHLFNBQVM7QUFHekQsZUFBVyxjQUFjLEtBQUssZUFBZSxJQUFJLE1BQU0sS0FBSyxDQUFDLEdBQUc7QUFDL0QsWUFBTSxXQUFXLEtBQUssYUFBYSxVQUFVO0FBRzdDLFVBQUksU0FBUyxVQUFVLFdBQVc7QUFFakM7QUFBQSxNQUNELFdBRVMsVUFBVSxTQUFTLFdBQVc7QUFFdEMsY0FBTSxxQkFBcUIsVUFBVSxZQUFZO0FBQ2pELGNBQU0sZ0JBQWdCLGdCQUFnQjtBQUN0QyxpQkFBUyxhQUFhO0FBQ3RCLGlCQUFTLFdBQVc7QUFBQSxNQUNyQixXQUVTLGFBQWEsU0FBUyxhQUFhLFdBQVcsU0FBUyxTQUFTO0FBRXhFLGNBQU0scUJBQXFCLFVBQVUsWUFBWTtBQUNqRCxjQUFNLGdCQUFnQixnQkFBZ0I7QUFDdEMsaUJBQVMsV0FBVztBQUFBLE1BQ3JCLFdBRVMsU0FBUyxZQUFZLGFBQWEsU0FBUyxVQUFVLFNBQVM7QUFFdEUsaUJBQVMsWUFBWTtBQUNyQixpQkFBUyxVQUFVLFlBQVk7QUFBQSxNQUNoQyxXQUVTLFlBQVksU0FBUyxhQUFhLFNBQVMsYUFBYSxTQUFTO0FBRXpFLGNBQU0sc0JBQXNCLFVBQVUsU0FBUyxZQUFZO0FBQzNELGNBQU0sd0JBQXdCLFNBQVMsVUFBVSxTQUFTLFlBQVksSUFBSTtBQUMxRSxjQUFNLFlBQWEsd0JBQXdCLEtBQU0sZ0JBQWdCLEtBQUs7QUFDdEUsaUJBQVMsWUFBWTtBQUNyQixpQkFBUyxVQUFVLFlBQVk7QUFBQSxNQUNoQyxXQUVTLGFBQWEsU0FBUyxXQUFXLFNBQVMsVUFBVSxTQUFTO0FBRXJFLGNBQU0sc0JBQXNCLFNBQVMsVUFBVSxZQUFZO0FBQzNELGlCQUFTLFdBQVcsZ0JBQWdCO0FBQUEsTUFDckM7QUFBQSxJQUNEO0FBQUEsRUFFRDtBQUFBLEVBSVEsK0JBQStCLEtBQVU7QUFDaEQsZUFBVyxjQUFjLEtBQUssZUFBZSxJQUFJLE1BQU0sS0FBSyxDQUFDLEdBQUc7QUFDL0QsWUFBTSxXQUFXLEtBQUssYUFBYSxVQUFVO0FBQzdDLFVBQUksVUFBVSxTQUFTLFdBQVk7QUFFbkMsVUFBSSxDQUFDLFNBQVMsYUFBYSxhQUFhO0FBQ3ZDLGFBQUssd0NBQXdDLEtBQUssRUFBRSxLQUFLLFlBQVksU0FBUyxXQUFXLENBQUM7QUFBQSxNQUMzRjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFHUSw0QkFBNEIsS0FBVTtBQUc3QyxTQUFLLGlCQUFpQixHQUFHO0FBR3pCLFNBQUssd0JBQXdCLEdBQUc7QUFHaEMsU0FBSywrQkFBK0IsR0FBRztBQUd2QyxTQUFLLG9CQUFvQixHQUFHO0FBRzVCLFNBQUssK0JBQStCLEdBQUc7QUFBQSxFQUN4QztBQUFBO0FBQUEsRUFNUSw4QkFBOEIsS0FBVSxjQUFzQixjQUFzQixXQUFtQixlQUFzQztBQUVwSixRQUFJLGNBQWM7QUFJbEIsVUFBTSxnQkFBZ0IsVUFBVSxjQUFjLFlBQVk7QUFJMUQsUUFBSTtBQUNKLFFBQUk7QUFFSixVQUFNLFdBQVcsY0FBYyxJQUFJO0FBRW5DLFFBQUksQ0FBQyxVQUFVO0FBR2QsZ0NBQTBCO0FBQzFCLDhCQUF3QjtBQUFBLElBQ3pCLE9BQ0s7QUFDSixnQ0FBMEIsU0FBUztBQUNuQyxVQUFJLFNBQVMsU0FBUyxlQUFlLFNBQVMsU0FBUztBQUN0RCxnQ0FBd0IsU0FBUztBQUFBLGVBQ3pCLFNBQVMsU0FBUztBQUMxQixnQ0FBd0IsU0FBUztBQUFBO0FBRWpDLGNBQU0sSUFBSSxNQUFNLHNDQUFzQyxRQUFRLEVBQUU7QUFBQSxJQUNsRTtBQUdBLFFBQUksQ0FBQyxjQUFjLGVBQWU7QUFDakMsV0FBSztBQUFBLFFBQWM7QUFBQSxRQUFLO0FBQUEsUUFDdkIsRUFBRSxpQkFBaUIsY0FBYyxNQUFNLGFBQWEsY0FBYyxLQUFLLGVBQWUsY0FBYyxNQUFNLFdBQVcsY0FBYyxJQUFLO0FBQUEsUUFDeEksRUFBRSx3QkFBd0IsS0FBSztBQUFBLE1BQ2hDO0FBQ0Esb0JBQWMsZ0JBQWdCO0FBQzlCLHFCQUFlO0FBQUEsSUFDaEI7QUFHQSxTQUFLO0FBQUEsTUFBYztBQUFBLE1BQUs7QUFBQSxNQUN2QixFQUFFLGlCQUFpQixjQUFjLE1BQU0sYUFBYSxjQUFjLEtBQUssZUFBZSxjQUFjLE1BQU0sV0FBVyxjQUFjLElBQUk7QUFBQSxNQUN2SSxFQUFFLHdCQUF3QixLQUFLO0FBQUEsSUFDaEM7QUFDQSxVQUFNLG1CQUFtQixVQUFVLE1BQU0sSUFBSSxFQUFFLFNBQVM7QUFDeEQsa0JBQWMsUUFBUTtBQUN0QixVQUFNLGlCQUFpQixVQUFVLFlBQVksSUFBSTtBQUNqRCxrQkFBYyxNQUFNLG1CQUFtQixLQUFLLGNBQWMsTUFBTSxVQUFVLFNBQVMsVUFBVSxTQUFTO0FBQ3RHLG1CQUFlO0FBR2YsUUFBSSxjQUFjLHdCQUF3Qix5QkFBeUI7QUFFbEUsWUFBTSxrQkFBa0IsMEJBQTBCLGNBQWM7QUFDaEUsV0FBSztBQUFBLFFBQWM7QUFBQSxRQUFLO0FBQUEsUUFDdkIsRUFBRSxpQkFBaUIsY0FBYyxNQUFNLGFBQWEsY0FBYyxLQUFLLGVBQWUsY0FBYyxPQUFPLGlCQUFpQixXQUFXLE9BQU8saUJBQWtCO0FBQUEsUUFDaEssRUFBRSx3QkFBd0IsS0FBSztBQUFBLE1BQ2hDO0FBQ0EscUJBQWU7QUFBQSxJQUNoQixXQUNTLGNBQWMsd0JBQXdCLHlCQUF5QjtBQUN2RSxZQUFNLFVBQVUsT0FBTyxhQUFhLE1BQU0sSUFBSSxFQUFFLE1BQU8sMEJBQTBCLEdBQUssY0FBYyx3QkFBd0IsSUFBSyxJQUFJLENBQUMsRUFBRSxLQUFLLElBQUk7QUFDakosV0FBSztBQUFBLFFBQWM7QUFBQSxRQUFLO0FBQUEsUUFDdkIsRUFBRSxpQkFBaUIsY0FBYyxNQUFNLGFBQWEsY0FBYyxLQUFLLGVBQWUsY0FBYyxNQUFNLFdBQVcsY0FBYyxJQUFJO0FBQUEsUUFDdkksRUFBRSx3QkFBd0IsS0FBSztBQUFBLE1BQ2hDO0FBQ0EscUJBQWUsUUFBUSxNQUFNLElBQUksRUFBRSxTQUFTO0FBQUEsSUFDN0M7QUFDQSxrQkFBYyx3QkFBd0I7QUFFdEMsV0FBTyxFQUFFLHVCQUF1QixZQUFZO0FBQUEsRUFDN0M7QUFBQTtBQUFBLEVBTU8sYUFBYSxFQUFFLFdBQVcsU0FBUyxPQUFPLEdBQWlCO0FBS2pFLFVBQU0sTUFBTSxPQUFPLFNBQVMsR0FBRztBQUMvQixRQUFJLENBQUMsSUFBSztBQUlWLFVBQU0sdUJBQXVCLEtBQUsseUJBQXlCLEVBQUUsV0FBVyxTQUFTLEtBQUssUUFBUSxDQUFDLGFBQWEsU0FBUyxTQUFTLFlBQVksQ0FBQztBQUMzSSxRQUFJLHNCQUFzQjtBQUN6QixhQUFPLFdBQVcscUJBQXFCLFNBQVM7QUFDaEQsaUJBQVcsTUFBTyxxQkFBbUMsWUFBWSxZQUFZLFNBQVMsTUFBTSxHQUFHLEdBQUc7QUFDbEc7QUFBQSxJQUNEO0FBRUEsVUFBTSxzQkFBc0IsS0FBSyx5QkFBeUIsRUFBRSxXQUFXLFNBQVMsS0FBSyxRQUFRLENBQUMsYUFBYSxTQUFTLFNBQVMsV0FBVyxDQUFDO0FBQ3pJLFFBQUk7QUFDSDtBQUVELFdBQU8sV0FBVyxTQUFTO0FBQzNCLFdBQU8sYUFBYSxFQUFFLGlCQUFpQixXQUFXLGVBQWUsV0FBVyxhQUFhLEdBQUcsV0FBVyxFQUFFLENBQUM7QUFFMUcsVUFBTSxFQUFFLGFBQWEsSUFBSSxLQUFLLGNBQWMsR0FBRztBQUUvQyxVQUFNLFNBQXdDO0FBQUEsTUFDN0MsTUFBTTtBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQSxVQUFVLE9BQU8sTUFBTTtBQUFBLE1BQ3ZCLE1BQU07QUFBQSxNQUNOLGtCQUFrQixvQkFBSSxJQUFJO0FBQUEsTUFDMUIsWUFBWTtBQUFBLE1BQ1osMEJBQTBCO0FBQUEsSUFDM0I7QUFDQSxVQUFNLFlBQVksS0FBSyxhQUFhLE1BQU07QUFDMUMsU0FBSyw0QkFBNEIsR0FBRztBQUVwQyxpQkFBYTtBQUNiLFdBQU8sVUFBVTtBQUFBLEVBQ2xCO0FBQUE7QUFBQSxFQUdPLGdCQUFnQixFQUFFLFdBQVcsR0FBMkI7QUFDOUQsVUFBTSxZQUFZLEtBQUssYUFBYSxVQUFVO0FBQzlDLFFBQUksQ0FBQyxVQUFXO0FBQ2hCLFFBQUksVUFBVSxTQUFTLFlBQWE7QUFFcEMsVUFBTSxNQUFNLFVBQVU7QUFDdEIsVUFBTSxFQUFFLGFBQWEsSUFBSSxLQUFLLGNBQWMsR0FBRztBQUMvQyxTQUFLLGlCQUFpQixTQUFTO0FBQy9CLFNBQUssNEJBQTRCLEdBQUc7QUFDcEMsaUJBQWE7QUFBQSxFQUNkO0FBQUEsRUFLUSwyQkFBMkIsTUFBbUM7QUFFckUsUUFBSSxLQUFLLFNBQVMsY0FBYztBQUMvQixZQUFNLE1BQU0sS0FBSyxlQUFlLEtBQUssR0FBRztBQUN4QyxVQUFJLENBQUMsSUFBSztBQUNWLGFBQU87QUFBQSxJQUNSLFdBQ1MsS0FBSyxTQUFTLGFBQWE7QUFDbkMsWUFBTSxFQUFFLFdBQVcsSUFBSTtBQUN2QixZQUFNLFlBQVksS0FBSyxhQUFhLFVBQVU7QUFDOUMsVUFBSSxXQUFXLFNBQVMsWUFBYTtBQUNyQyxZQUFNLEVBQUUsTUFBTSxJQUFJLElBQUk7QUFDdEIsYUFBTztBQUFBLElBQ1I7QUFDQTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWEsc0JBQXNCLFVBQTJCO0FBQzdELFVBQU0sTUFBTSxLQUFLLGVBQWUsUUFBUTtBQUN4QyxRQUFJLENBQUMsSUFBSztBQUNWLFVBQU0sS0FBSyxrQkFBa0IsZ0JBQWdCLEdBQUc7QUFDaEQsVUFBTSxLQUFLLGtCQUFrQixVQUFVLEdBQUc7QUFBQSxFQUMzQztBQUFBO0FBQUEsRUFJTyxjQUFjLE1BQXNEO0FBQzFFLFFBQUksTUFBNkM7QUFFakQsUUFBSSxLQUFLLFNBQVMsYUFBYTtBQUM5QixZQUFNLEtBQUssMkJBQTJCLElBQUk7QUFBQSxJQUMzQyxXQUNTLEtBQUssU0FBUyxjQUFjO0FBQ3BDLFVBQUksS0FBSyxpQkFBaUIsTUFBTSxlQUFlLGlCQUFpQjtBQUMvRCxjQUFNLGlCQUFpQixLQUFLLHNCQUFzQixLQUFLLEdBQUc7QUFDMUQsWUFBSSxtQkFBbUIsS0FBTSxRQUFPO0FBQ3BDLFlBQUksaUJBQWlCLEtBQU07QUFDMUIsZ0JBQU0sS0FBSywyQkFBMkIsSUFBSTtBQUFBLFFBQzNDLE9BQ0s7QUFDSixnQkFBTSxLQUFLLGtDQUFrQyxJQUFJO0FBQUEsUUFDbEQ7QUFBQSxNQUNELE9BQ0s7QUFDSixjQUFNLEtBQUssMkJBQTJCLElBQUk7QUFBQSxNQUMzQztBQUFBLElBQ0Q7QUFFQSxRQUFJLENBQUMsSUFBSyxRQUFPO0FBQ2pCLFVBQU0sQ0FBQyxVQUFVLGdCQUFnQixJQUFJO0FBQ3JDLFdBQU8sQ0FBQyxTQUFTLE1BQU0sZ0JBQWdCO0FBQUEsRUFDeEM7QUFBQSxFQUdPLGtDQUFrQyxFQUFFLEtBQUssb0JBQW9CLEdBQThDO0FBRWpILFVBQU0sTUFBTSxLQUFLLHdCQUF3QjtBQUFBLE1BQ3hDO0FBQUEsTUFDQSxvQkFBb0IsRUFBRSxTQUFTLEtBQUs7QUFBQSxNQUNwQyxlQUFlO0FBQUEsTUFDZixpQkFBaUI7QUFBQSxNQUNqQixZQUFZLE1BQU07QUFBQSxNQUFFO0FBQUEsSUFDckIsQ0FBQztBQUNELFFBQUksQ0FBQyxJQUFLO0FBQ1YsVUFBTSxFQUFFLFVBQVUsYUFBYSxJQUFJO0FBR25DLFVBQU0sU0FBUyxNQUFNO0FBQ3BCLGVBQVMsZUFBZSxFQUFFLGFBQWEsTUFBTztBQUM5QyxXQUFLLGdDQUFnQyxLQUFLLEVBQUUsS0FBSyxZQUFZLFNBQVMsV0FBVyxDQUFDO0FBQ2xGLFdBQUssNEJBQTRCLEdBQUc7QUFDcEMsbUJBQWE7QUFHYixVQUFJLEtBQUssaUJBQWlCLE1BQU0sZUFBZSxzQkFBc0I7QUFDcEUsYUFBSywyQkFBMkIsRUFBRSxLQUFLLGNBQWMsT0FBTyxVQUFVLFNBQVMsQ0FBQztBQUFBLE1BQ2pGO0FBQUEsSUFDRDtBQUdBLFVBQU0sVUFBVSxDQUFDLE1BQXFEO0FBRXJFLGFBQU87QUFDUCxXQUFLLGFBQWEsR0FBRztBQUNyQixZQUFNLEVBQUUsYUFBYSxJQUFJLE1BQU0sRUFBRSxPQUFPO0FBQUEsSUFDekM7QUFFQSxRQUFJO0FBQ0gsV0FBSyx3QkFBd0IsS0FBSyxtQkFBbUI7QUFBQSxJQUN0RCxTQUNPLEdBQUc7QUFDVCxjQUFRLEVBQUUsU0FBUyxJQUFJLElBQUksV0FBVyxLQUFLLENBQUM7QUFBQSxJQUM3QztBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFHTyxxQkFBcUIsRUFBRSxLQUFLLFdBQVcsR0FBcUM7QUFFbEYsVUFBTSxNQUFNLEtBQUssd0JBQXdCO0FBQUEsTUFDeEM7QUFBQSxNQUNBLG9CQUFvQixFQUFFLFNBQVMsS0FBSztBQUFBLE1BQ3BDLGVBQWU7QUFBQSxNQUNmLGlCQUFpQjtBQUFBLE1BQ2pCLFlBQVksTUFBTTtBQUFBLE1BQUU7QUFBQSxJQUNyQixDQUFDO0FBQ0QsUUFBSSxDQUFDLElBQUs7QUFDVixVQUFNLEVBQUUsVUFBVSxhQUFhLElBQUk7QUFHbkMsVUFBTSxTQUFTLE1BQU07QUFDcEIsZUFBUyxlQUFlLEVBQUUsYUFBYSxNQUFPO0FBQzlDLFdBQUssZ0NBQWdDLEtBQUssRUFBRSxLQUFLLFlBQVksU0FBUyxXQUFXLENBQUM7QUFDbEYsV0FBSyw0QkFBNEIsR0FBRztBQUNwQyxtQkFBYTtBQUdiLFVBQUksS0FBSyxpQkFBaUIsTUFBTSxlQUFlLHNCQUFzQjtBQUNwRSxhQUFLLDJCQUEyQixFQUFFLEtBQUssY0FBYyxPQUFPLFVBQVUsU0FBUyxDQUFDO0FBQUEsTUFDakY7QUFBQSxJQUNEO0FBRUEsU0FBSyxjQUFjLEtBQUssWUFBWSxrQkFBa0IsRUFBRSx3QkFBd0IsS0FBSyxDQUFDO0FBQ3RGLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFHUSx5QkFBeUIsRUFBRSxXQUFXLFNBQVMsS0FBSyxPQUFPLEdBQWdIO0FBRWxMLGVBQVcsY0FBYyxLQUFLLGVBQWUsSUFBSSxNQUFNLEtBQUssQ0FBQyxHQUFHO0FBQy9ELFlBQU0sV0FBVyxLQUFLLGFBQWEsVUFBVTtBQUM3QyxVQUFJLENBQUMsU0FBVTtBQUNmLFVBQUksQ0FBQyxTQUFTLFFBQVEsRUFBRztBQUN6QixZQUFNLFlBQVksU0FBUyxZQUFZLFdBQVcsU0FBUyxVQUFVO0FBQ3JFLFVBQUksQ0FBQyxXQUFXO0FBQ2YsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQVNRLHdCQUF3QjtBQUFBLElBQy9CO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0QsR0FNRztBQUNGLFVBQU0sRUFBRSxNQUFNLElBQUksS0FBSyxrQkFBa0IsU0FBUyxHQUFHO0FBQ3JELFFBQUksQ0FBQyxNQUFPO0FBSVosVUFBTSxZQUFZLGtCQUFrQixnQkFBZ0IsWUFBWTtBQUNoRSxVQUFNLFVBQVUsa0JBQWtCLGdCQUFnQixVQUFVLE1BQU0sYUFBYTtBQUMvRSxVQUFNLFFBQVEsRUFBRSxpQkFBaUIsV0FBVyxhQUFhLEdBQUcsZUFBZSxTQUFTLFdBQVcsT0FBTyxpQkFBaUI7QUFFdkgsVUFBTSxrQkFBa0IsTUFBTSxTQUFTLG9CQUFvQixFQUFFO0FBQzdELFFBQUksZUFBZSxNQUFNLGdCQUFnQixPQUFPLG9CQUFvQixFQUFFO0FBSXRFLFVBQU0sRUFBRSxhQUFhLElBQUksS0FBSyxjQUFjLEtBQUssRUFBRSxXQUFXLENBQUM7QUFHL0QsUUFBSSxrQkFBa0Isa0JBQWtCO0FBQ3ZDLFVBQUksaUJBQWlCO0FBQUEsTUFFckIsT0FDSztBQUVKLGFBQUssMkJBQTJCLEVBQUUsS0FBSyxjQUFjLE1BQU0sVUFBVSxVQUFVLGVBQWUsTUFBTSxDQUFDO0FBQ3JHLGNBQU0sYUFBYSxNQUFNLFNBQVMsb0JBQW9CLEVBQUU7QUFDeEQsYUFBSyxjQUFjLEtBQUssaUJBQWlCLGtCQUFrQixFQUFFLHdCQUF3QixLQUFLLENBQUM7QUFDM0YsdUJBQWU7QUFBQSxNQUNoQjtBQUFBLElBRUQsV0FDUyxrQkFBa0Isc0JBQXNCLGtCQUFrQixvQkFBb0I7QUFDdEYsWUFBTSxXQUFXLGtCQUFrQixxQkFBcUIsV0FBVztBQUNuRSxXQUFLLDJCQUEyQixFQUFFLEtBQUssY0FBYyxNQUFNLFVBQVUsZUFBZSxNQUFNLENBQUM7QUFBQSxJQUM1RjtBQUVBLFVBQU0sU0FBdUM7QUFBQSxNQUM1QyxNQUFNO0FBQUEsTUFDTjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxNQUFNO0FBQUEsTUFDTixjQUFjO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0EsTUFBTTtBQUFBLE1BQ1A7QUFBQSxNQUNBLFdBQVcsQ0FBQztBQUFBO0FBQUEsTUFDWixrQkFBa0Isb0JBQUksSUFBSTtBQUFBLElBQzNCO0FBRUEsVUFBTSxXQUFXLEtBQUssYUFBYSxNQUFNO0FBQ3pDLFNBQUssZ0NBQWdDLEtBQUssRUFBRSxLQUFLLFlBQVksU0FBUyxXQUFXLENBQUM7QUFDbEYsU0FBSywyQkFBMkIsS0FBSyxFQUFFLElBQUksQ0FBQztBQUc1QyxRQUFJLGlCQUFpQjtBQUNwQixZQUFNLFlBQVk7QUFDbEIsZ0JBQVUsMkJBQTJCLFNBQVM7QUFDOUMsV0FBSyxpQ0FBaUMsS0FBSyxFQUFFLEtBQUssWUFBWSxVQUFVLFdBQVcsQ0FBQztBQUFBLElBQ3JGO0FBR0EsV0FBTyxFQUFFLFVBQVUsYUFBYTtBQUFBLEVBQ2pDO0FBQUEsRUFLUSxnQkFBZ0IsS0FBVTtBQUNqQyxVQUFNLFlBQVksS0FBSyxlQUFlLElBQUksTUFBTTtBQUNoRCxRQUFJLENBQUMsVUFBVyxRQUFPO0FBQ3ZCLGVBQVcsY0FBYyxXQUFXO0FBQ25DLFlBQU0sV0FBVyxLQUFLLGFBQWEsVUFBVTtBQUM3QyxVQUFJLFVBQVUsU0FBUyxXQUFZO0FBQ25DLFVBQUksU0FBUyxhQUFhLFlBQWEsUUFBTztBQUFBLElBQy9DO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUdRLDJCQUEyQixNQUFnRTtBQUVsRyxVQUFNLEVBQUUsS0FBTSxJQUFJO0FBQ2xCLFVBQU0sY0FBMkIsS0FBSyxTQUFTLGVBQWUsVUFBVTtBQUN4RSxVQUFNLG1CQUFtQixLQUFLLGlCQUFpQixNQUFNO0FBQ3JELFVBQU0saUJBQWlCLEtBQUssaUJBQWlCLE1BQU0sd0JBQXdCLFdBQVc7QUFDdEYsVUFBTSx3QkFBd0IsaUJBQWlCLEtBQUssaUJBQWlCLE1BQU0sd0JBQXdCLFdBQVcsRUFBRSxlQUFlLFlBQVksSUFBSSxlQUFlLFNBQVMsSUFBSTtBQUczSyxVQUFNLE1BQU0sS0FBSywyQkFBMkIsSUFBSTtBQUNoRCxRQUFJLENBQUMsSUFBSztBQUVWLFFBQUk7QUFDSixRQUFJLHVCQUF5QztBQUU3QyxRQUFJLFNBQVMsY0FBYztBQUMxQixtQkFBYTtBQUFBLElBQ2QsV0FDUyxTQUFTLGFBQWE7QUFDOUIsWUFBTSxFQUFFLFdBQVcsSUFBSTtBQUN2QixZQUFNLFlBQVksS0FBSyxhQUFhLFVBQVU7QUFDOUMsVUFBSSxXQUFXLFNBQVMsWUFBYTtBQUNyQyw2QkFBdUI7QUFDdkIsWUFBTSxFQUFFLFdBQVcsWUFBWSxTQUFTLFNBQVMsSUFBSTtBQUNyRCxtQkFBYSxDQUFDLFlBQVksUUFBUTtBQUFBLElBQ25DLE9BQ0s7QUFDSixZQUFNLElBQUksTUFBTSxzQ0FBc0MsSUFBSSxFQUFFO0FBQUEsSUFDN0Q7QUFFQSxVQUFNLEVBQUUsTUFBTSxJQUFJLEtBQUssa0JBQWtCLFNBQVMsR0FBRztBQUNyRCxRQUFJLENBQUMsTUFBTztBQUVaLFFBQUkscUJBQWlELEVBQUUsU0FBUyxLQUFLO0FBR3JFLFVBQU0sbUJBQW1CO0FBQ3pCLFVBQU0sbUJBQW1CLE1BQU0sU0FBUyxvQkFBb0IsRUFBRTtBQUM5RCxVQUFNLGVBQWUsZUFBZSxhQUFhLG1CQUFtQixpQkFBaUIsTUFBTSxJQUFJLEVBQUUsTUFBTyxXQUFXLENBQUMsSUFBSSxHQUFLLFdBQVcsQ0FBQyxJQUFJLElBQUssQ0FBQyxFQUFFLEtBQUssSUFBSTtBQUM5SixVQUFNLFdBQVcsTUFBTSxjQUFjO0FBQ3JDLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSSxTQUFTLGNBQWM7QUFDMUIsWUFBTSxFQUFFLFVBQVUsR0FBRyx1QkFBdUIsRUFBRSxJQUFJLEtBQUssNEJBQTRCLHlCQUF5QjtBQUFBLFFBQzNHLGVBQWU7QUFBQSxRQUNmLGdCQUFnQixDQUFDLEVBQUUsTUFBTSxRQUFRLFNBQVMsd0JBQXdCLEVBQUUsY0FBYyxVQUFVLEtBQUssVUFBVSxTQUFTLENBQUMsRUFBRyxDQUFDO0FBQUEsUUFDekg7QUFBQSxRQUNBO0FBQUEsTUFDRCxDQUFDO0FBQ0QsaUJBQVc7QUFDWCw4QkFBd0I7QUFBQSxJQUN6QixXQUNTLFNBQVMsYUFBYTtBQUM5QixVQUFJLENBQUMscUJBQXNCO0FBQzNCLFlBQU0sRUFBRSxXQUFXLElBQUk7QUFDdkIsWUFBTSxlQUFlLFlBQVksWUFBWSxTQUFTLFNBQVM7QUFFL0QsWUFBTSxZQUFZLGVBQWUsYUFBYSxJQUFJLFdBQVcsQ0FBQztBQUM5RCxZQUFNLFVBQVUsZUFBZSxhQUFhLE1BQU0sYUFBYSxJQUFJLFdBQVcsQ0FBQztBQUMvRSxZQUFNLEVBQUUsUUFBUSxPQUFPLElBQUksb0JBQW9CLEVBQUUsYUFBYSxrQkFBa0IsV0FBVyxRQUFRLENBQUM7QUFDcEcsWUFBTSxjQUFjLHdCQUF3QixFQUFFLFdBQVcsY0FBYyxjQUE0QixRQUFRLFFBQVEsU0FBUyxrQkFBa0IsU0FBUyxDQUFDO0FBRXhKLFlBQU0sRUFBRSxVQUFVLEdBQUcsdUJBQXVCLEVBQUUsSUFBSSxLQUFLLDRCQUE0Qix5QkFBeUI7QUFBQSxRQUMzRyxlQUFlLDBCQUEwQixFQUFFLGlCQUFtQyxDQUFDO0FBQUEsUUFDL0UsZ0JBQWdCLENBQUMsRUFBRSxNQUFNLFFBQVEsU0FBUyxZQUFhLENBQUM7QUFBQSxRQUN4RDtBQUFBLFFBQ0E7QUFBQSxNQUNELENBQUM7QUFDRCxpQkFBVztBQUNYLDhCQUF3QjtBQUFBLElBRXpCLE9BQ0s7QUFBRSxZQUFNLElBQUksTUFBTSxlQUFlLElBQUksYUFBYTtBQUFBLElBQUU7QUFHekQsUUFBSSxLQUFLLGdCQUFnQixHQUFHLEVBQUc7QUFHL0IsVUFBTSxNQUFNLEtBQUssd0JBQXdCO0FBQUEsTUFDeEM7QUFBQSxNQUNBO0FBQUEsTUFDQSxlQUFlLEtBQUs7QUFBQSxNQUNwQixpQkFBaUI7QUFBQSxNQUNqQixZQUFZLE1BQU07QUFDakIsWUFBSSxtQkFBbUIsU0FBUztBQUMvQixlQUFLLG1CQUFtQixNQUFNLG1CQUFtQixPQUFPO0FBQUEsUUFDekQ7QUFBQSxNQUNEO0FBQUEsSUFFRCxDQUFDO0FBQ0QsUUFBSSxDQUFDLElBQUs7QUFDVixVQUFNLEVBQUUsVUFBVSxhQUFjLElBQUk7QUFJcEMsVUFBTSxTQUFTLE1BQU07QUFDcEIsY0FBUSxJQUFJLGVBQWU7QUFDM0IsZUFBUyxlQUFlLEVBQUUsYUFBYSxNQUFPO0FBQzlDLFdBQUssZ0NBQWdDLEtBQUssRUFBRSxLQUFLLFlBQVksU0FBUyxXQUFXLENBQUM7QUFFbEYsVUFBSSxzQkFBc0I7QUFDekIsY0FBTSxZQUFZO0FBRWxCLGtCQUFVLDJCQUEyQjtBQUNyQyxhQUFLLGlDQUFpQyxLQUFLLEVBQUUsS0FBSyxZQUFZLFVBQVUsV0FBVyxDQUFDO0FBQ3BGLGFBQUssaUJBQWlCLFNBQVM7QUFBQSxNQUNoQztBQUNBLFdBQUssNEJBQTRCLEdBQUc7QUFDcEMsbUJBQWE7QUFHYixVQUFJLEtBQUssaUJBQWlCLE1BQU0sZUFBZSxzQkFBc0I7QUFDcEUsYUFBSywyQkFBMkIsRUFBRSxLQUFLLGNBQWMsT0FBTyxVQUFVLFNBQVMsQ0FBQztBQUFBLE1BQ2pGO0FBQUEsSUFDRDtBQUdBLFVBQU0sVUFBVSxDQUFDLE1BQXFEO0FBRXJFLGFBQU87QUFDUCxXQUFLLGFBQWEsR0FBRztBQUNyQixZQUFNLEVBQUUsYUFBYSxJQUFJLE1BQU0sRUFBRSxPQUFPO0FBQUEsSUFDekM7QUFFQSxVQUFNLGNBQWMsQ0FBQyxVQUFrQix5QkFBaUM7QUFDdkUsVUFBSSxTQUFTLGFBQWE7QUFDekIsZUFBTyxtQkFBbUIsRUFBRSxNQUFNLFVBQVUsc0JBQXNCLFFBQVEsaUJBQWlCLE9BQU8sQ0FBQztBQUFBLE1BQ3BHLFdBQ1MsU0FBUyxjQUFjO0FBQy9CLGVBQU8sdUJBQXVCLEVBQUUsTUFBTSxVQUFVLHFCQUFxQixDQUFDO0FBQUEsTUFDdkU7QUFDQSxZQUFNLElBQUksTUFBTSxRQUFRO0FBQUEsSUFDekI7QUFHQSxTQUFLLDRCQUE0QixHQUFHO0FBRXBDLFVBQU0sOEJBQXFELEVBQUUsTUFBTSxTQUFTLFdBQVcsZUFBZSxPQUFPLEtBQUssR0FBRyx1QkFBdUIsRUFBRTtBQUc5SSxVQUFNLGVBQWUsWUFBWTtBQUNoQyxVQUFJLDJCQUEyQjtBQUMvQixhQUFPLDBCQUEwQjtBQUNoQyxtQ0FBMkI7QUFFM0IsWUFBSSx3QkFBb0MsTUFBTTtBQUFBLFFBQUU7QUFDaEQsY0FBTSxxQkFBcUIsSUFBSSxRQUFjLENBQUMsU0FBUztBQUFFLGtDQUF3QjtBQUFBLFFBQUssQ0FBQztBQUd2RixZQUFJLGdCQUFnQjtBQUNwQixZQUFJLG9CQUFvQjtBQUN4QixZQUFJLFVBQVU7QUFDZCxZQUFJLGdCQUFnQjtBQUdwQiwyQkFBbUIsVUFBVSxLQUFLLG1CQUFtQixlQUFlO0FBQUEsVUFDbkUsY0FBYztBQUFBLFVBQ2QsU0FBUyxFQUFFLGFBQWEsc0JBQXNCLElBQUksR0FBRztBQUFBLFVBQ3JEO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0EsVUFBVTtBQUFBO0FBQUEsVUFDVixRQUFRLENBQUMsV0FBVztBQUNuQixrQkFBTSxFQUFFLFVBQVUsVUFBVSxJQUFJO0FBQ2hDLGtCQUFNLFdBQVcsVUFBVSxVQUFVLGNBQWMsUUFBUSxRQUFRO0FBRW5FLGtCQUFNLFVBQVUsb0JBQW9CO0FBQ3BDLDZCQUFpQjtBQUVqQixrQkFBTSxDQUFDLGFBQWEsa0JBQWtCLGFBQWEsSUFBSSxZQUFZLGVBQWUsUUFBUSxNQUFNO0FBQ2hHLGtCQUFNLEVBQUUsc0JBQXNCLElBQUksS0FBSyw4QkFBOEIsS0FBSyxjQUFjLGFBQWEsa0JBQWtCLDJCQUEyQjtBQUNsSixxQkFBUyxhQUFhLE9BQVEsU0FBUyxZQUFZLElBQUs7QUFFeEQsaUJBQUssNEJBQTRCLEdBQUc7QUFFcEMsZ0NBQW9CO0FBQUEsVUFDckI7QUFBQSxVQUNBLGdCQUFnQixDQUFDLFdBQVc7QUFDM0Isa0JBQU0sRUFBRSxTQUFTLElBQUk7QUFHckIsa0JBQU0sQ0FBQyxhQUFhLElBQUksRUFBRSxJQUFJLFlBQVksVUFBVSxDQUFDO0FBQ3JELGlCQUFLO0FBQUEsY0FBYztBQUFBLGNBQUs7QUFBQSxjQUN2QixFQUFFLGlCQUFpQixTQUFTLFdBQVcsYUFBYSxHQUFHLGVBQWUsU0FBUyxTQUFTLFdBQVcsT0FBTyxpQkFBaUI7QUFBQTtBQUFBLGNBQzNILEVBQUUsd0JBQXdCLEtBQUs7QUFBQSxZQUNoQztBQUVBLG1CQUFPO0FBQ1Asa0NBQXNCO0FBQUEsVUFDdkI7QUFBQSxVQUNBLFNBQVMsQ0FBQyxNQUFNO0FBQ2Ysb0JBQVEsQ0FBQztBQUFBLFVBQ1Y7QUFBQSxVQUNBLFNBQVMsTUFBTTtBQUNkLGdCQUFJLGNBQWU7QUFFbkIsc0JBQVU7QUFDVixrQ0FBc0I7QUFBQSxVQUN2QjtBQUFBLFFBQ0QsQ0FBQztBQUVELFlBQUksbUJBQW1CLFlBQVksTUFBTTtBQUFFO0FBQUEsUUFBTztBQUVsRCxjQUFNO0FBQ04sWUFBSSxTQUFTO0FBQ1osZ0JBQU0sSUFBSSxNQUFNLG1DQUFtQztBQUFBLFFBQ3BEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLG1CQUFtQixJQUFJLFFBQWMsQ0FBQ0MsTUFBSyxRQUFRO0FBQUUsbUJBQWEsRUFBRSxLQUFLQSxJQUFHLEVBQUUsTUFBTSxHQUFHO0FBQUEsSUFBRSxDQUFDO0FBQ2hHLFdBQU8sQ0FBQyxVQUFVLGdCQUFnQjtBQUFBLEVBQ25DO0FBQUEsRUFJQSxlQUFlLFVBQTJCO0FBQ3pDLFFBQUksYUFBYSxXQUFXO0FBQzNCLFlBQU0sT0FBTyxLQUFLLG9CQUFvQjtBQUN0QyxVQUFJLENBQUMsS0FBTTtBQUNYLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNBLHNCQUFzQixVQUEyQjtBQUNoRCxVQUFNLE1BQU0sS0FBSyxlQUFlLFFBQVE7QUFDeEMsUUFBSSxDQUFDLElBQUssUUFBTztBQUNqQixVQUFNLEVBQUUsTUFBTSxJQUFJLEtBQUssa0JBQWtCLFNBQVMsR0FBRztBQUNyRCxRQUFJLENBQUMsTUFBTyxRQUFPO0FBQ25CLFVBQU0saUJBQWlCLE1BQU0sZUFBZSxvQkFBb0IsRUFBRTtBQUNsRSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBK0JRLHdCQUF3QixLQUFVLFdBQW1CO0FBQzVELFVBQU0sU0FBUywyQkFBMkIsU0FBUztBQUNuRCxRQUFJLE9BQU8sV0FBVyxFQUFHLE9BQU0sSUFBSSxNQUFNLHlDQUF5QztBQUVsRixVQUFNLEVBQUUsTUFBTSxJQUFJLEtBQUssa0JBQWtCLFNBQVMsR0FBRztBQUNyRCxRQUFJLENBQUMsTUFBTyxPQUFNLElBQUksTUFBTSw0REFBNEQ7QUFDeEYsVUFBTSxXQUFXLE1BQU0sU0FBUyxvQkFBb0IsRUFBRTtBQUV0RCxVQUFNLGdCQUFnQixTQUFTLE1BQU0sSUFBSTtBQUt6QyxVQUFNLGVBQTZGLENBQUM7QUFDcEcsZUFBVyxLQUFLLFFBQVE7QUFDdkIsWUFBTSxNQUFNLGVBQWUsRUFBRSxNQUFNLFVBQVUsTUFBTSxFQUFFLFlBQVksUUFBUSxDQUFDO0FBQzFFLFVBQUksT0FBTyxRQUFRO0FBQ2xCLGNBQU0sSUFBSSxNQUFNLEtBQUssd0JBQXdCLEtBQUssRUFBRSxJQUFJLENBQUM7QUFDMUQsVUFBSSxDQUFDLFdBQVcsT0FBTyxJQUFJO0FBQzNCLG1CQUFhO0FBQ2IsaUJBQVc7QUFHWCxZQUFNLGFBQWEsY0FBYyxJQUNoQyxjQUFjLE1BQU0sR0FBRyxTQUFTLEVBQUUsS0FBSyxJQUFJLElBQUksT0FDN0MsSUFBSTtBQUdQLFlBQU0sVUFBVSxjQUFjLE1BQU0sR0FBRyxVQUFVLENBQUMsRUFBRSxLQUFLLElBQUksRUFBRSxTQUFTO0FBRXhFLG1CQUFhLEtBQUssRUFBRSxXQUFXLFNBQVMsT0FBTyxFQUFFLENBQUM7QUFBQSxJQUNuRDtBQUVBLGlCQUFhLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxZQUFZLEVBQUUsU0FBUztBQUdyRCxhQUFTLElBQUksR0FBRyxJQUFJLGFBQWEsUUFBUSxLQUFLO0FBQzdDLFVBQUksYUFBYSxDQUFDLEVBQUUsYUFBYSxhQUFhLElBQUksQ0FBQyxFQUFFLFNBQVM7QUFDN0QsY0FBTSxJQUFJLE1BQU0sS0FBSyx3QkFBd0IsZUFBZSxhQUFhLENBQUMsR0FBRyxPQUFPLElBQUksQ0FBQztBQUFBLE1BQzFGO0FBQUEsSUFDRDtBQUdBLFFBQUksVUFBa0I7QUFDdEIsYUFBUyxJQUFJLGFBQWEsU0FBUyxHQUFHLEtBQUssR0FBRyxLQUFLO0FBQ2xELFlBQU0sRUFBRSxXQUFXLFNBQVMsTUFBTSxJQUFJLGFBQWEsQ0FBQztBQUNwRCxnQkFBVSxRQUFRLE1BQU0sR0FBRyxTQUFTLElBQUksTUFBTSxRQUFRLFFBQVEsTUFBTSxVQUFVLEdBQUcsUUFBUTtBQUFBLElBQzFGO0FBRUEsU0FBSztBQUFBLE1BQWM7QUFBQSxNQUFLO0FBQUEsTUFDdkI7QUFBQSxNQUNBLEVBQUUsd0JBQXdCLEtBQUs7QUFBQSxJQUNoQztBQUFBLEVBQ0Q7QUFBQSxFQUVRLGtDQUFrQyxNQUF5RjtBQUNsSSxVQUFNLEVBQUUsTUFBTSxTQUFVLElBQUk7QUFDNUIsVUFBTSxjQUEyQjtBQUNqQyxVQUFNLG1CQUFtQixLQUFLLGlCQUFpQixNQUFNO0FBQ3JELFVBQU0saUJBQWlCLEtBQUssaUJBQWlCLE1BQU0sd0JBQXdCLFdBQVc7QUFDdEYsVUFBTSx3QkFBd0IsaUJBQWlCLEtBQUssaUJBQWlCLE1BQU0sd0JBQXdCLFdBQVcsRUFBRSxlQUFlLFlBQVksSUFBSSxlQUFlLFNBQVMsSUFBSTtBQUUzSyxVQUFNLE1BQU0sS0FBSywyQkFBMkIsSUFBSTtBQUNoRCxRQUFJLENBQUMsSUFBSztBQUVWLFVBQU0sRUFBRSxNQUFNLElBQUksS0FBSyxrQkFBa0IsU0FBUyxHQUFHO0FBQ3JELFFBQUksQ0FBQyxNQUFPO0FBRVosUUFBSSxxQkFBaUQsRUFBRSxTQUFTLEtBQUs7QUFJckUsVUFBTSxtQkFBbUIsTUFBTSxTQUFTLG9CQUFvQixFQUFFO0FBQzlELFVBQU0scUJBQXFCLDBDQUEwQyxFQUFFLGNBQWMsa0JBQWtCLFNBQW1CLENBQUM7QUFFM0gsVUFBTSxFQUFFLFVBQVUsc0JBQTZDLElBQUksS0FBSyw0QkFBNEIseUJBQXlCO0FBQUEsTUFDNUgsZUFBZTtBQUFBLE1BQ2YsZ0JBQWdCLENBQUMsRUFBRSxNQUFNLFFBQVEsU0FBUyxtQkFBb0IsQ0FBQztBQUFBLE1BQy9EO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUdELFFBQUksS0FBSyxnQkFBZ0IsR0FBRyxFQUFHO0FBRy9CLFVBQU0sTUFBTSxLQUFLLHdCQUF3QjtBQUFBLE1BQ3hDO0FBQUEsTUFDQTtBQUFBLE1BQ0EsZUFBZSxLQUFLO0FBQUEsTUFDcEIsaUJBQWlCO0FBQUEsTUFDakIsWUFBWSxNQUFNO0FBQ2pCLFlBQUksbUJBQW1CLFNBQVM7QUFDL0IsZUFBSyxtQkFBbUIsTUFBTSxtQkFBbUIsT0FBTztBQUFBLFFBQ3pEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUNELFFBQUksQ0FBQyxJQUFLO0FBQ1YsVUFBTSxFQUFFLFVBQVUsYUFBYSxJQUFJO0FBUW5DLFVBQU0sbUNBQW1DLENBQUMsa0JBQStEO0FBRXhHLFlBQU0sQ0FBQyxlQUFlLFdBQVcsSUFBSTtBQUNyQyxVQUFJLGFBQWE7QUFDakIsaUJBQVcsaUJBQWlCLDZCQUE2QjtBQUN4RCxjQUFNO0FBQUEsVUFDTDtBQUFBLFVBQVc7QUFBQSxVQUNYLFVBQVUsRUFBRSxnQkFBZ0IsQ0FBQyxnQkFBZ0IsWUFBWSxFQUFHO0FBQUEsUUFDN0QsSUFBSTtBQUNKLFlBQUksa0JBQWtCLFlBQWE7QUFDbkMsY0FBTSxjQUFjLFVBQVUsWUFBWTtBQUMxQyxjQUFNLGNBQWMsZUFBZSxpQkFBaUI7QUFDcEQsc0JBQWMsY0FBYztBQUFBLE1BQzdCO0FBQ0EsYUFBTyxDQUFDLGdCQUFnQixZQUFZLGNBQWMsVUFBVTtBQUFBLElBQzdEO0FBR0EsVUFBTSxTQUFTLE1BQU07QUFDcEIsZUFBUyxlQUFlLEVBQUUsYUFBYSxNQUFPO0FBQzlDLFdBQUssZ0NBQWdDLEtBQUssRUFBRSxLQUFLLFlBQVksU0FBUyxXQUFXLENBQUM7QUFDbEYsV0FBSyw0QkFBNEIsR0FBRztBQUdwQyxpQkFBVyxnQkFBZ0I7QUFDMUIsYUFBSyxvQkFBb0IsWUFBWTtBQUV0QyxtQkFBYTtBQUdiLFVBQUksS0FBSyxpQkFBaUIsTUFBTSxlQUFlLHNCQUFzQjtBQUNwRSxhQUFLLDJCQUEyQixFQUFFLEtBQUssY0FBYyxPQUFPLFVBQVUsU0FBUyxDQUFDO0FBQUEsTUFDakY7QUFBQSxJQUNEO0FBRUEsVUFBTSxVQUFVLENBQUMsTUFBcUQ7QUFFckUsYUFBTztBQUNQLFdBQUssYUFBYSxHQUFHO0FBQ3JCLFlBQU0sRUFBRSxhQUFhLElBQUksTUFBTSxFQUFFLE9BQU87QUFBQSxJQUN6QztBQUdBLFNBQUssNEJBQTRCLEdBQUc7QUFHcEMsUUFBSSw4QkFBNEQ7QUFDaEUsUUFBSSw4QkFBOEI7QUFDbEMsUUFBSSxZQUEyQyxDQUFDO0FBQ2hELFVBQU0sOEJBQTZFLENBQUM7QUFDcEYsYUFBUyxhQUFhLE9BQU87QUFFN0IsVUFBTSxZQUFZO0FBR2xCLFVBQU0sbUJBQW1CLFlBQVk7QUFFcEMsVUFBSSwyQkFBMkI7QUFDL0IsVUFBSSxnQkFBZ0I7QUFDcEIsVUFBSSx3QkFBd0I7QUFDNUIsVUFBSSxVQUFVO0FBQ2QsVUFBSSxnQkFBZ0I7QUFDcEIsYUFBTywwQkFBMEI7QUFDaEMsbUNBQTJCO0FBQzNCLHlCQUFpQjtBQUNqQixZQUFJLGlCQUFpQixXQUFXO0FBQy9CLGdCQUFNLElBQUk7QUFBQSxZQUNULFNBQVMsdUJBQXVCLFNBQVM7QUFBQSxZQUN6QyxXQUFXO0FBQUEsVUFDWjtBQUNBLGtCQUFRLENBQUM7QUFDVDtBQUFBLFFBQ0Q7QUFFQSxZQUFJLHdCQUFvQyxNQUFNO0FBQUEsUUFBRTtBQUNoRCxjQUFNLHFCQUFxQixJQUFJLFFBQWMsQ0FBQ0EsTUFBSyxRQUFRO0FBQUUsa0NBQXdCQTtBQUFBLFFBQUksQ0FBQztBQUcxRixjQUFNLFNBQVMsQ0FBQyxXQUF3RDtBQUN2RSxnQkFBTSxFQUFFLFNBQVMsSUFBSTtBQUtyQixnQkFBTSxTQUFTLDJCQUEyQixRQUFRO0FBRWxELG1CQUFTLFdBQVcsdUJBQXVCLFdBQVcsT0FBTyxRQUFRLFlBQVksR0FBRztBQUNuRixrQkFBTSxRQUFRLE9BQU8sUUFBUTtBQUU3QixnQkFBSSxNQUFNLFVBQVUsbUJBQW1CO0FBRXRDLGtCQUFJLCtCQUErQixNQUFNLEtBQUssS0FBSyxFQUFFLFVBQVUsSUFBSTtBQUNsRSxzQkFBTSxpQkFBaUIsU0FBUyxhQUFhLFFBQVE7QUFDckQsc0JBQU0sZ0JBQWdCLGVBQWUsTUFBTSxNQUFNLGtCQUFrQixPQUFPLEVBQUUsZ0JBQWdCLFlBQVksUUFBUSxDQUFDO0FBQ2pILG9CQUFJLE9BQU8sa0JBQWtCLFVBQVU7QUFDdEMsd0JBQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxpQ0FBaUMsYUFBYTtBQUNyRSwyQkFBUyxhQUFhLE9BQU87QUFDN0IsZ0RBQThCO0FBQUEsZ0JBQy9CO0FBQUEsY0FDRDtBQVlBO0FBQUEsWUFDRDtBQUNBLDBDQUE4QjtBQUk5QixnQkFBSSxFQUFFLFlBQVksOEJBQThCO0FBRS9DLG9CQUFNLGlCQUFpQixlQUFlLE1BQU0sTUFBTSxrQkFBa0IsTUFBTSxFQUFFLFlBQVksUUFBUSxDQUFDO0FBR2pHLG9CQUFNLGFBQWEsNEJBQTRCLEtBQUssQ0FBQUMsa0JBQWdCO0FBQ25FLHNCQUFNLENBQUMsZUFBZSxXQUFXLElBQUlBLGNBQWEsU0FBUztBQUMzRCxzQkFBTSxlQUFlLFVBQVUsaUJBQWlCLFlBQVk7QUFDNUQsdUJBQU8sQ0FBQztBQUFBLGNBQ1QsQ0FBQztBQUVELGtCQUFJLE9BQU8sbUJBQW1CLFlBQVksWUFBWTtBQUNyRCxzQkFBTSxlQUFlLE9BQU8sbUJBQW1CLFdBQVcsaUJBQWlCO0FBRTNFLHdCQUFRLElBQUksMkNBQTJDO0FBQ3ZELHdCQUFRLElBQUksb0JBQW9CLEVBQUUsaUJBQWlCLENBQUM7QUFDcEQsd0JBQVEsSUFBSSxZQUFZLEVBQUUsU0FBUyxDQUFDO0FBQ3BDLHdCQUFRLElBQUksVUFBVSxZQUFZO0FBQ2xDLHdCQUFRLElBQUksZUFBZSxNQUFNLElBQUk7QUFDckMsd0JBQVEsSUFBSSxXQUFXO0FBQ3ZCLHNCQUFNLFVBQVUsS0FBSyx3QkFBd0IsY0FBYyxNQUFNLElBQUk7QUFDckUsc0JBQU0sV0FBVztBQUNqQix5QkFBUztBQUFBLGtCQUNSLEVBQUUsTUFBTSxhQUFhLFNBQVMsU0FBUztBQUFBO0FBQUEsa0JBQ3ZDLEVBQUUsTUFBTSxRQUFRLFNBQVMsVUFBVSxPQUFPLFNBQVM7QUFBQTtBQUFBLGdCQUNwRDtBQUdBLHdDQUF3QjtBQUN4Qiw4Q0FBOEI7QUFDOUIsOENBQThCO0FBQzlCLDRCQUFZLENBQUM7QUFDYiwyQkFBV0EsaUJBQWdCO0FBQzFCLHVCQUFLLG9CQUFvQkEsYUFBWTtBQUN0Qyw0Q0FBNEIsT0FBTyxHQUFHLFFBQVE7QUFFOUMscUJBQUssY0FBYyxLQUFLLGtCQUFrQixrQkFBa0IsRUFBRSx3QkFBd0IsS0FBSyxDQUFDO0FBRzVGLDJDQUEyQjtBQUMzQixvQkFBSSxtQkFBbUIsU0FBUztBQUMvQixrQ0FBZ0I7QUFDaEIsdUJBQUssbUJBQW1CLE1BQU0sbUJBQW1CLE9BQU87QUFDeEQsa0NBQWdCO0FBQUEsZ0JBQ2pCO0FBQ0EseUJBQVMsYUFBYSxPQUFPO0FBQzdCLHNDQUFzQjtBQUN0QixxQkFBSyw0QkFBNEIsR0FBRztBQUNwQztBQUFBLGNBQ0Q7QUFJQSxvQkFBTSxDQUFDLFdBQVcsT0FBTyxJQUFJLGlDQUFpQyxjQUFjO0FBUzVFLG9CQUFNLFNBQTBFO0FBQUEsZ0JBQy9FLE1BQU07QUFBQSxnQkFDTjtBQUFBLGdCQUNBO0FBQUEsZ0JBQ0EsTUFBTTtBQUFBLGdCQUNOLFVBQVU7QUFBQSxrQkFDVCxnQkFBZ0IsQ0FBQyxHQUFHLGNBQWM7QUFBQSxrQkFDbEMsY0FBYyxNQUFNO0FBQUEsZ0JBQ3JCO0FBQUEsY0FDRDtBQUNBLG9CQUFNLGVBQWUsS0FBSyxhQUFhLE1BQU07QUFDN0MsMENBQTRCLEtBQUssWUFBWTtBQUM3Qyw0Q0FBOEIsRUFBRSxNQUFNLFdBQVcsZUFBZSxPQUFPLEtBQUssR0FBRyx1QkFBdUIsRUFBRTtBQUFBLFlBQ3pHO0FBSUEsZ0JBQUksQ0FBQyxTQUFTLGFBQWEsYUFBYTtBQUN2QyxzQkFBUSxNQUFNLDBFQUEwRTtBQUN4RjtBQUFBLFlBQ0Q7QUFHQSxnQkFBSSxNQUFNLFVBQVUsUUFBUTtBQUMzQixvQkFBTSxFQUFFLFdBQVcsZ0JBQWdCLFNBQVMsYUFBYSxJQUFJLDRCQUE0QixRQUFRO0FBQ2pHLG1CQUFLO0FBQUEsZ0JBQWM7QUFBQSxnQkFBSyxNQUFNO0FBQUEsZ0JBQzdCLEVBQUUsaUJBQWlCLGdCQUFnQixhQUFhLEdBQUcsZUFBZSxjQUFjLFdBQVcsT0FBTyxpQkFBaUI7QUFBQTtBQUFBLGdCQUNuSCxFQUFFLHdCQUF3QixLQUFLO0FBQUEsY0FDaEM7QUFDQSx1QkFBUyxhQUFhLE9BQU8sZUFBZTtBQUM1QyxzQ0FBd0IsV0FBVztBQUNuQztBQUFBLFlBQ0Q7QUFHQSxnQkFBSSxDQUFDLDRCQUE2QjtBQUNsQyxrQkFBTSxXQUFXLFVBQVUsUUFBUTtBQUNuQyxrQkFBTSxlQUFlLFVBQVUsU0FBUyxJQUFJO0FBQzVDLGtCQUFNLGlCQUFpQixNQUFNLE1BQU0sVUFBVSxhQUFhLFFBQVE7QUFFbEUsaUJBQUssOEJBQThCLEtBQUssTUFBTSxNQUFNLE1BQU0sT0FBTyxnQkFBZ0IsMkJBQTJCO0FBQzVHLHdCQUFZO0FBSVoscUJBQVMsYUFBYSxPQUFPLDRCQUE0QjtBQUFBLFVBRTFEO0FBRUEsZUFBSyw0QkFBNEIsR0FBRztBQUFBLFFBQ3JDO0FBRUEsMkJBQW1CLFVBQVUsS0FBSyxtQkFBbUIsZUFBZTtBQUFBLFVBQ25FLGNBQWM7QUFBQSxVQUNkLFNBQVMsRUFBRSxhQUFhLDJCQUEyQixJQUFJLEdBQUc7QUFBQSxVQUMxRDtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBLFVBQVU7QUFBQTtBQUFBLFVBQ1YsUUFBUSxDQUFDLFdBQVc7QUFDbkIsbUJBQU8sTUFBTTtBQUFBLFVBQ2Q7QUFBQSxVQUNBLGdCQUFnQixPQUFPLFdBQVc7QUFDakMsa0JBQU0sRUFBRSxTQUFTLElBQUk7QUFDckIsbUJBQU8sTUFBTTtBQUViLGtCQUFNLFNBQVMsMkJBQTJCLFFBQVE7QUFDbEQsZ0JBQUksT0FBTyxXQUFXLEdBQUc7QUFDeEIsbUJBQUsscUJBQXFCLEtBQUssaUVBQWlFO0FBQUEsWUFDakc7QUFDQSxpQkFBSyxjQUFjLEtBQUssa0JBQWtCLGtCQUFrQixFQUFFLHdCQUF3QixLQUFLLENBQUM7QUFHNUYsZ0JBQUk7QUFDSCxtQkFBSyx3QkFBd0IsS0FBSyxRQUFRO0FBQzFDLHFCQUFPO0FBQ1Asb0NBQXNCO0FBQUEsWUFDdkIsU0FDTyxHQUFHO0FBQ1Qsc0JBQVEsQ0FBQztBQUFBLFlBQ1Y7QUFBQSxVQUNEO0FBQUEsVUFDQSxTQUFTLENBQUMsTUFBTTtBQUNmLG9CQUFRLENBQUM7QUFBQSxVQUNWO0FBQUEsVUFDQSxTQUFTLE1BQU07QUFDZCxnQkFBSSxjQUFlO0FBRW5CLHNCQUFVO0FBQ1Ysa0NBQXNCO0FBQUEsVUFDdkI7QUFBQSxRQUNELENBQUM7QUFHRCxZQUFJLG1CQUFtQixZQUFZLE1BQU07QUFBRTtBQUFBLFFBQU07QUFFakQsY0FBTTtBQUNOLFlBQUksU0FBUztBQUNaLGdCQUFNLElBQUksTUFBTSxtQ0FBbUM7QUFBQSxRQUNwRDtBQUFBLE1BQ0Q7QUFBQSxJQUVEO0FBRUEsVUFBTSxtQkFBbUIsSUFBSSxRQUFjLENBQUNELE1BQUssUUFBUTtBQUFFLHVCQUFpQixFQUFFLEtBQUtBLElBQUcsRUFBRSxNQUFNLEdBQUc7QUFBQSxJQUFFLENBQUM7QUFDcEcsV0FBTyxDQUFDLFVBQVUsZ0JBQWdCO0FBQUEsRUFDbkM7QUFBQSxFQUdBLGFBQWEsS0FBVTtBQUN0QixTQUFLLGlCQUFpQixLQUFLLEdBQUc7QUFBQSxFQUMvQjtBQUFBLEVBSUEscUJBQXFCLEVBQUUsV0FBVyxHQUEyQjtBQUM1RCxVQUFNLFlBQVksS0FBSyxhQUFhLFVBQVU7QUFDOUMsUUFBSSxDQUFDLFVBQVcsUUFBTztBQUN2QixRQUFJLFVBQVUsU0FBUyxZQUFhLFFBQU87QUFDM0MsV0FBTyxDQUFDLENBQUMsVUFBVTtBQUFBLEVBQ3BCO0FBQUEsRUFHUSxpQkFBaUIsVUFBb0I7QUFDNUMsVUFBTSxNQUFNLFNBQVM7QUFFckIsVUFBTSxrQkFBa0IsU0FBUyxhQUFhLG9CQUFvQjtBQUNsRSxRQUFJLENBQUMsZ0JBQWlCO0FBRXRCLFNBQUssbUJBQW1CLE1BQU0sZUFBZTtBQUU3QyxhQUFTLGVBQWUsRUFBRSxhQUFhLE1BQU87QUFDOUMsU0FBSyxnQ0FBZ0MsS0FBSyxFQUFFLEtBQUssWUFBWSxTQUFTLFdBQVcsQ0FBQztBQUFBLEVBQ25GO0FBQUE7QUFBQSxFQUlBLHdCQUF3QixFQUFFLFdBQVcsR0FBMkI7QUFDL0QsVUFBTSxZQUFZLEtBQUssYUFBYSxVQUFVO0FBQzlDLFFBQUksV0FBVyxTQUFTLFlBQWE7QUFDckMsUUFBSSxDQUFDLFVBQVUseUJBQTBCO0FBRXpDLFVBQU0sMEJBQTBCLEtBQUssYUFBYSxVQUFVLHdCQUF3QjtBQUNwRixRQUFJLENBQUMsd0JBQXlCO0FBQzlCLFFBQUksd0JBQXdCLFNBQVMsV0FBWTtBQUVqRCxTQUFLLGlCQUFpQix1QkFBdUI7QUFDN0MsU0FBSyxhQUFhLHdCQUF3QixJQUFJO0FBQUEsRUFDL0M7QUFBQSxFQUdBLHNCQUFzQixFQUFFLElBQUksR0FBaUI7QUFDNUMsUUFBSSxDQUFDLEtBQUssZ0JBQWdCLEdBQUcsRUFBRztBQUNoQyxTQUFLLGFBQWEsR0FBRztBQUVyQixlQUFXLGNBQWMsS0FBSyxlQUFlLElBQUksTUFBTSxLQUFLLENBQUMsR0FBRztBQUMvRCxZQUFNLFdBQVcsS0FBSyxhQUFhLFVBQVU7QUFDN0MsVUFBSSxVQUFVLFNBQVMsV0FBWTtBQUNuQyxVQUFJLENBQUMsU0FBUyxhQUFhLFlBQWE7QUFDeEMsV0FBSyxpQkFBaUIsUUFBUTtBQUFBLElBQy9CO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWNRLGdCQUFnQixVQUFvQjtBQUMzQyxVQUFNLE1BQU0sU0FBUztBQUVyQixVQUFNLFlBQVksU0FBUztBQUMzQixVQUFNLFVBQWtCLEVBQUUsaUJBQWlCLFNBQVMsV0FBVyxhQUFhLEdBQUcsZUFBZSxTQUFTLFNBQVMsV0FBVyxPQUFPLGlCQUFpQjtBQUNuSixTQUFLLGNBQWMsS0FBSyxXQUFXLFNBQVMsRUFBRSx3QkFBd0IsS0FBSyxDQUFDO0FBQUEsRUFDN0U7QUFBQTtBQUFBLEVBa0NBLE1BQWEsV0FBVyxFQUFFLE9BQU8sR0FBdUI7QUFJdkQsVUFBTSxPQUFPLEtBQUssU0FBUyxNQUFNO0FBQ2pDLFFBQUksQ0FBQyxLQUFNO0FBRVgsVUFBTSxFQUFFLFdBQVcsSUFBSTtBQUN2QixVQUFNLFdBQVcsS0FBSyxhQUFhLFVBQVU7QUFDN0MsUUFBSSxDQUFDLFNBQVU7QUFFZixRQUFJLFNBQVMsU0FBUyxXQUFZO0FBRWxDLFVBQU0sTUFBTSxTQUFTO0FBR3JCLFVBQU0sRUFBRSxhQUFhLElBQUksS0FBSyxjQUFjLEdBQUc7QUFFL0MsVUFBTSxnQkFBZ0IsU0FBUyxhQUFhLE1BQU0sSUFBSTtBQUN0RCxRQUFJO0FBRUosUUFBSSxLQUFLLFNBQVMsWUFBWTtBQUM3Qix3QkFBa0I7QUFBQSxRQUNqQixHQUFHLGNBQWMsTUFBTSxHQUFJLEtBQUssb0JBQW9CLENBQUU7QUFBQTtBQUFBO0FBQUEsUUFFdEQsR0FBRyxjQUFjLE1BQU8sS0FBSyxrQkFBa0IsSUFBSyxHQUFHLFFBQVE7QUFBQTtBQUFBLE1BQ2hFLEVBQUUsS0FBSyxJQUFJO0FBQUEsSUFDWixXQUNTLEtBQUssU0FBUyxhQUFhO0FBQ25DLHdCQUFrQjtBQUFBLFFBQ2pCLEdBQUcsY0FBYyxNQUFNLEdBQUksS0FBSyxvQkFBb0IsQ0FBRTtBQUFBO0FBQUEsUUFDdEQsS0FBSztBQUFBO0FBQUEsUUFDTCxHQUFHLGNBQWMsTUFBTyxLQUFLLG9CQUFvQixHQUFJLFFBQVE7QUFBQTtBQUFBLE1BQzlELEVBQUUsS0FBSyxJQUFJO0FBQUEsSUFDWixXQUNTLEtBQUssU0FBUyxRQUFRO0FBQzlCLHdCQUFrQjtBQUFBLFFBQ2pCLEdBQUcsY0FBYyxNQUFNLEdBQUksS0FBSyxvQkFBb0IsQ0FBRTtBQUFBO0FBQUEsUUFDdEQsS0FBSztBQUFBO0FBQUEsUUFDTCxHQUFHLGNBQWMsTUFBTyxLQUFLLGtCQUFrQixJQUFLLEdBQUcsUUFBUTtBQUFBO0FBQUEsTUFDaEUsRUFBRSxLQUFLLElBQUk7QUFBQSxJQUNaLE9BQ0s7QUFDSixZQUFNLElBQUksTUFBTSxlQUFlLElBQUksc0JBQXNCO0FBQUEsSUFDMUQ7QUFRQSxhQUFTLGVBQWU7QUFHeEIsU0FBSyxZQUFZLElBQUk7QUFHckIsUUFBSSxPQUFPLEtBQUssU0FBUyxTQUFTLEVBQUUsV0FBVyxHQUFHO0FBQ2pELFdBQUssZ0JBQWdCLFFBQVE7QUFBQSxJQUM5QjtBQUVBLFNBQUssNEJBQTRCLEdBQUc7QUFFcEMsaUJBQWE7QUFBQSxFQUVkO0FBQUE7QUFBQSxFQUtBLE1BQWEsV0FBVyxFQUFFLE9BQU8sR0FBdUI7QUFFdkQsVUFBTSxPQUFPLEtBQUssU0FBUyxNQUFNO0FBQ2pDLFFBQUksQ0FBQyxLQUFNO0FBRVgsVUFBTSxFQUFFLFdBQVcsSUFBSTtBQUN2QixVQUFNLFdBQVcsS0FBSyxhQUFhLFVBQVU7QUFDN0MsUUFBSSxDQUFDLFNBQVU7QUFFZixRQUFJLFNBQVMsU0FBUyxXQUFZO0FBRWxDLFVBQU0sTUFBTSxTQUFTO0FBR3JCLFVBQU0sRUFBRSxhQUFhLElBQUksS0FBSyxjQUFjLEdBQUc7QUFFL0MsUUFBSTtBQUNKLFFBQUk7QUFPSixRQUFJLEtBQUssU0FBUyxZQUFZO0FBRTdCLFVBQUksS0FBSyxZQUFZLE1BQU0sU0FBUyxTQUFTO0FBQzVDLG9CQUFZLE9BQU8sS0FBSztBQUN4QixrQkFBVSxFQUFFLGlCQUFpQixLQUFLLFlBQVksR0FBRyxhQUFhLE9BQU8sa0JBQWtCLGVBQWUsS0FBSyxZQUFZLEdBQUcsV0FBVyxPQUFPLGlCQUFpQjtBQUFBLE1BQzlKLE9BQ0s7QUFDSixvQkFBWSxLQUFLLGVBQWU7QUFDaEMsa0JBQVUsRUFBRSxpQkFBaUIsS0FBSyxXQUFXLGFBQWEsR0FBRyxlQUFlLEtBQUssV0FBVyxXQUFXLEVBQUU7QUFBQSxNQUMxRztBQUFBLElBQ0QsV0FNUyxLQUFLLFNBQVMsYUFBYTtBQUduQyxVQUFJLEtBQUssWUFBWSxTQUFTLFNBQVM7QUFFdEMsb0JBQVk7QUFDWixrQkFBVSxFQUFFLGlCQUFpQixLQUFLLFlBQVksR0FBRyxhQUFhLE9BQU8sa0JBQWtCLGVBQWUsS0FBSyxTQUFTLFdBQVcsRUFBRTtBQUFBLE1BQ2xJLE9BQ0s7QUFDSixvQkFBWTtBQUNaLGtCQUFVLEVBQUUsaUJBQWlCLEtBQUssV0FBVyxhQUFhLEdBQUcsZUFBZSxLQUFLLFVBQVUsR0FBRyxXQUFXLEVBQUU7QUFBQSxNQUM1RztBQUFBLElBRUQsV0FNUyxLQUFLLFNBQVMsUUFBUTtBQUM5QixrQkFBWSxLQUFLO0FBQ2pCLGdCQUFVLEVBQUUsaUJBQWlCLEtBQUssV0FBVyxhQUFhLEdBQUcsZUFBZSxLQUFLLFNBQVMsV0FBVyxPQUFPLGlCQUFpQjtBQUFBLElBQzlILE9BQ0s7QUFDSixZQUFNLElBQUksTUFBTSxlQUFlLElBQUksc0JBQXNCO0FBQUEsSUFDMUQ7QUFHQSxTQUFLLGNBQWMsS0FBSyxXQUFXLFNBQVMsRUFBRSx3QkFBd0IsS0FBSyxDQUFDO0FBSzVFLFNBQUssWUFBWSxJQUFJO0FBR3JCLFFBQUksT0FBTyxLQUFLLFNBQVMsU0FBUyxFQUFFLFdBQVcsR0FBRztBQUNqRCxXQUFLLGdCQUFnQixRQUFRO0FBQUEsSUFDOUI7QUFFQSxTQUFLLDRCQUE0QixHQUFHO0FBRXBDLGlCQUFhO0FBQUEsRUFFZDtBQUVEO0FBdGtFTSxrQkFBTjtBQUFBLEVBNEJHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUVBO0FBQUEsRUFFQTtBQUFBLEVBQ0E7QUFBQSxHQXpDRztBQXdrRU4sa0JBQWtCLGtCQUFrQixpQkFBaUIsa0JBQWtCLEtBQUs7QUFLNUUsSUFBTSwyQkFBTixjQUF1QyxPQUFpQztBQUFBLEVBaUJ2RSxZQUNDLEVBQUUsUUFBUSxVQUFVLFVBQVUsUUFBUSxXQUFXLFlBQVksR0FRcEIsd0JBQ0osb0JBQ0Ysa0JBQ2xDO0FBQ0QsVUFBTTtBQUptQztBQUNKO0FBQ0Y7QUFJbkMsVUFBTSxNQUFNLE9BQU8sU0FBUyxHQUFHO0FBRS9CLFNBQUssS0FBSztBQUNWLFNBQUssU0FBUztBQUNkLFNBQUssWUFBWTtBQUVqQixRQUFJLENBQUMsS0FBSztBQUNULFlBQU0sRUFBRSxTQUFTLElBQUksSUFBSSxFQUFFLGNBQWM7QUFDekMsV0FBSyxXQUFXO0FBQ2hCO0FBQUEsSUFDRDtBQUVBLFNBQUssS0FBSyxJQUFJLFNBQVM7QUFFdkIsVUFBTSxhQUFhLE9BQU8sVUFBVSxhQUFhLFVBQVU7QUFFM0QsVUFBTSxzQkFBc0IsTUFBTTtBQUNqQyxZQUFNLG1CQUFtQixLQUFLLG1CQUFtQixpQkFBaUIsMEJBQTBCO0FBQzVGLFlBQU0sbUJBQW1CLEtBQUssbUJBQW1CLGlCQUFpQiwwQkFBMEI7QUFJNUYsWUFBTSxxQkFBcUIsS0FBSyxpQkFBaUIseUJBQXlCLG9CQUFvQixpQkFBaUIsU0FBUyxLQUFLLEVBQUU7QUFDL0gsWUFBTSxxQkFBcUIsS0FBSyxpQkFBaUIseUJBQXlCLG9CQUFvQixpQkFBaUIsU0FBUyxLQUFLLEVBQUU7QUFFL0gsWUFBTSx1QkFBdUIsS0FBSyx1QkFBdUIsV0FBVyxJQUFJLE1BQU07QUFDOUUsWUFBTSxrQkFBa0Isc0JBQXNCLFdBQVc7QUFDekQsWUFBTSxjQUFjLHNCQUFzQixjQUFjLFFBQVEsTUFBTSxLQUFLO0FBRTNFLFlBQU0sWUFBWSxnQkFBZ0I7QUFFbEMsWUFBTUUsY0FBYSxTQUFTLFlBQVksTUFBTSxxQkFBcUIsRUFBRTtBQUNyRSxZQUFNQyxjQUFhLFNBQVMsWUFBWSxNQUFNLHFCQUFxQixFQUFFO0FBRXJFLGFBQU8sRUFBRSxZQUFBRCxhQUFZLFlBQUFDLFlBQVc7QUFBQSxJQUNqQztBQUVBLFVBQU0sRUFBRSxZQUFZLFdBQVcsSUFBSSxvQkFBb0I7QUFHdkQsVUFBTSxFQUFFLGNBQWMsY0FBYyxRQUFRLElBQUksSUFBSSxFQUFFLGVBQWU7QUFBQSxNQUNwRSxJQUFJLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztBQUFBLE1BQy9CLElBQUksRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO0FBQUEsSUFDaEMsQ0FBQztBQUdELFlBQVEsTUFBTSxVQUFVO0FBQ3hCLFlBQVEsTUFBTSxXQUFXO0FBQ3pCLFlBQVEsTUFBTSxNQUFNO0FBQ3BCLFlBQVEsTUFBTSxlQUFlO0FBQzdCLFlBQVEsTUFBTSxTQUFTO0FBQ3ZCLFlBQVEsTUFBTSxZQUFZLGNBQWMsY0FBYyxVQUFVO0FBQ2hFLFlBQVEsTUFBTSxpQkFBaUI7QUFDL0IsWUFBUSxNQUFNLFFBQVE7QUFDdEIsWUFBUSxNQUFNLGdCQUFnQjtBQUk5QixpQkFBYSxVQUFVO0FBQ3ZCLGlCQUFhLGNBQWM7QUFDM0IsaUJBQWEsTUFBTSxrQkFBa0I7QUFDckMsaUJBQWEsTUFBTSxTQUFTO0FBQzVCLGlCQUFhLE1BQU0sUUFBUTtBQUMzQixpQkFBYSxNQUFNLFdBQVc7QUFDOUIsaUJBQWEsTUFBTSxZQUFZO0FBQy9CLGlCQUFhLE1BQU0sVUFBVTtBQUM3QixpQkFBYSxNQUFNLHlCQUF5QjtBQUM1QyxpQkFBYSxNQUFNLDBCQUEwQjtBQUM3QyxpQkFBYSxNQUFNLHNCQUFzQjtBQUN6QyxpQkFBYSxNQUFNLHVCQUF1QjtBQUMxQyxpQkFBYSxNQUFNLFNBQVM7QUFDNUIsaUJBQWEsTUFBTSxTQUFTO0FBQzVCLGlCQUFhLE1BQU0sWUFBWTtBQUMvQixpQkFBYSxNQUFNLGdCQUFnQjtBQUluQyxpQkFBYSxVQUFVO0FBQ3ZCLGlCQUFhLGNBQWM7QUFDM0IsaUJBQWEsTUFBTSxrQkFBa0I7QUFDckMsaUJBQWEsTUFBTSxTQUFTO0FBQzVCLGlCQUFhLE1BQU0sUUFBUTtBQUMzQixpQkFBYSxNQUFNLFdBQVc7QUFDOUIsaUJBQWEsTUFBTSxZQUFZO0FBQy9CLGlCQUFhLE1BQU0sVUFBVTtBQUM3QixpQkFBYSxNQUFNLHlCQUF5QjtBQUM1QyxpQkFBYSxNQUFNLDBCQUEwQjtBQUM3QyxpQkFBYSxNQUFNLHNCQUFzQjtBQUN6QyxpQkFBYSxNQUFNLHVCQUF1QjtBQUMxQyxpQkFBYSxNQUFNLFNBQVM7QUFDNUIsaUJBQWEsTUFBTSxTQUFTO0FBQzVCLGlCQUFhLE1BQU0sWUFBWTtBQUMvQixpQkFBYSxNQUFNLGdCQUFnQjtBQUluQyxTQUFLLFdBQVc7QUFFaEIsVUFBTSxZQUFZLE1BQU07QUFDdkIsWUFBTSxRQUFRLE9BQU8sb0JBQW9CLEtBQUssU0FBUyxJQUFJLE9BQU8sYUFBYTtBQUMvRSxXQUFLLFNBQVMsTUFBTSxNQUFNLEdBQUcsS0FBSztBQUFBLElBQ25DO0FBQ0EsVUFBTSxhQUFhLE1BQU07QUFDeEIsWUFBTSxhQUFhLE9BQU8sY0FBYztBQUN4QyxZQUFNLGVBQWUsV0FBVyxRQUFRO0FBQ3hDLFlBQU0seUJBQXlCLFdBQVc7QUFDMUMsWUFBTSxjQUFjLEtBQUssU0FBUztBQUVsQyxZQUFNLFNBQVMsV0FBVyxRQUFRLGVBQWUseUJBQXlCO0FBQzFFLFdBQUssU0FBUyxNQUFNLE9BQU8sR0FBRyxNQUFNO0FBQUEsSUFDckM7QUFHQSxlQUFXLE1BQU07QUFDaEIsZ0JBQVU7QUFDVixpQkFBVztBQUFBLElBQ1osR0FBRyxDQUFDO0FBRUosU0FBSyxVQUFVLE9BQU8sa0JBQWtCLE9BQUs7QUFBRSxnQkFBVTtBQUFBLElBQUUsQ0FBQyxDQUFDO0FBQzdELFNBQUssVUFBVSxPQUFPLHdCQUF3QixPQUFLO0FBQUUsZ0JBQVU7QUFBQSxJQUFFLENBQUMsQ0FBQztBQUNuRSxTQUFLLFVBQVUsT0FBTyxrQkFBa0IsT0FBSztBQUFFLGdCQUFVO0FBQUcsaUJBQVc7QUFBQSxJQUFFLENBQUMsQ0FBQztBQUkzRSxTQUFLLFVBQVUsS0FBSyx1QkFBdUIsaUJBQWlCLE9BQUs7QUFDaEUsVUFBSSxPQUFPLEVBQUUsSUFBSSxXQUFXLElBQUksUUFBUTtBQUV2QyxjQUFNLEVBQUUsWUFBQUQsYUFBWSxZQUFBQyxZQUFXLElBQUksb0JBQW9CO0FBRXZELHFCQUFhLGNBQWNEO0FBQzNCLHFCQUFhLGNBQWNDO0FBQUEsTUFFNUI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUlGLFdBQU8saUJBQWlCLElBQUk7QUFBQSxFQUU3QjtBQUFBLEVBektPLFFBQWdCO0FBQ3RCLFdBQU8sS0FBSyxNQUFNO0FBQUEsRUFDbkI7QUFBQSxFQUNPLGFBQTBCO0FBQ2hDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUNPLGNBQWM7QUFDcEIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQW1LZ0IsVUFBZ0I7QUFDL0IsU0FBSyxPQUFPLG9CQUFvQixJQUFJO0FBQ3BDLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFFRDtBQWxMTSwyQkFBTjtBQUFBLEVBMEJHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQTVCRzsiLAogICJuYW1lcyI6IFsiZmlsZUNvbnRlbnRzIiwgImlkeCIsICJhY2Nlc3NvciIsICJyZXMiLCAidHJhY2tpbmdab25lIiwgImFjY2VwdFRleHQiLCAicmVqZWN0VGV4dCJdCn0K
