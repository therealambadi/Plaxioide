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
import { Delayer } from "../../../../../base/common/async.js";
import { Event } from "../../../../../base/common/event.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { Lazy } from "../../../../../base/common/lazy.js";
import { Disposable, DisposableStore, MutableDisposable, combinedDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { CodeEditorWidget } from "../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EmbeddedCodeEditorWidget } from "../../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { DiffEditorWidget } from "../../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { EmbeddedDiffEditorWidget } from "../../../../../editor/browser/widget/diffEditor/embeddedDiffEditorWidget.js";
import { MarkdownRenderer } from "../../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { peekViewResultsBackground } from "../../../../../editor/contrib/peekView/browser/peekView.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalCapabilityStore } from "../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js";
import { formatMessageForTerminal } from "../../../../../platform/terminal/common/terminalStrings.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { EditorModel } from "../../../../common/editor/editorModel.js";
import { PANEL_BACKGROUND, SIDE_BAR_BACKGROUND } from "../../../../common/theme.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../common/views.js";
import { DetachedProcessInfo } from "../../../terminal/browser/detachedTerminal.js";
import { ITerminalService } from "../../../terminal/browser/terminal.js";
import { getXtermScaledDimensions } from "../../../terminal/browser/xterm/xtermTerminal.js";
import { TERMINAL_BACKGROUND_COLOR } from "../../../terminal/common/terminalColorRegistry.js";
import { colorizeTestMessageInEditor } from "../testMessageColorizer.js";
import { MessageSubject, TaskSubject, TestOutputSubject } from "./testResultsSubject.js";
import { Testing } from "../../common/constants.js";
import { MutableObservableValue } from "../../common/observableValue.js";
import { LiveTestResult, TestResultItemChangeReason } from "../../common/testResult.js";
import { ITestMessage, TestMessageType, getMarkId } from "../../common/testTypes.js";
import { CALL_STACK_WIDGET_HEADER_HEIGHT } from "../../../debug/browser/callStackWidget.js";
class SimpleDiffEditorModel extends EditorModel {
  constructor(_original, _modified) {
    super();
    this._original = _original;
    this._modified = _modified;
    this.original = this._original.object.textEditorModel;
    this.modified = this._modified.object.textEditorModel;
  }
  dispose() {
    super.dispose();
    this._original.dispose();
    this._modified.dispose();
  }
}
const commonEditorOptions = {
  scrollBeyondLastLine: false,
  links: true,
  lineNumbers: "off",
  glyphMargin: false,
  scrollbar: {
    vertical: "hidden",
    horizontal: "auto",
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    handleMouseWheel: false
  },
  overviewRulerLanes: 0,
  fixedOverflowWidgets: true,
  readOnly: true,
  stickyScroll: { enabled: false },
  minimap: { enabled: false },
  automaticLayout: false
};
const diffEditorOptions = {
  ...commonEditorOptions,
  enableSplitViewResizing: true,
  isInEmbeddedEditor: true,
  renderOverviewRuler: false,
  ignoreTrimWhitespace: false,
  renderSideBySide: true,
  useInlineViewWhenSpaceIsLimited: false,
  originalAriaLabel: localize("testingOutputExpected", "Expected result"),
  modifiedAriaLabel: localize("testingOutputActual", "Actual result"),
  diffAlgorithm: "advanced"
};
let DiffContentProvider = class extends Disposable {
  constructor(editor, container, instantiationService, modelService) {
    super();
    this.editor = editor;
    this.container = container;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.widget = this._register(new MutableDisposable());
    this.model = this._register(new MutableDisposable());
  }
  get onDidContentSizeChange() {
    return this.widget.value?.onDidContentSizeChange || Event.None;
  }
  async update(subject) {
    if (!(subject instanceof MessageSubject)) {
      this.clear();
      return false;
    }
    const message = subject.message;
    if (!ITestMessage.isDiffable(message)) {
      this.clear();
      return false;
    }
    const [original, modified] = await Promise.all([
      this.modelService.createModelReference(subject.expectedUri),
      this.modelService.createModelReference(subject.actualUri)
    ]);
    const model = this.model.value = new SimpleDiffEditorModel(original, modified);
    if (!this.widget.value) {
      this.widget.value = this.editor ? this.instantiationService.createInstance(
        EmbeddedDiffEditorWidget,
        this.container,
        diffEditorOptions,
        {},
        this.editor
      ) : this.instantiationService.createInstance(
        DiffEditorWidget,
        this.container,
        diffEditorOptions,
        {}
      );
      if (this.dimension) {
        this.widget.value.layout(this.dimension);
      }
    }
    this.widget.value.setModel(model);
    this.widget.value.updateOptions(this.getOptions(
      isMultiline(message.expected) || isMultiline(message.actual)
    ));
    return true;
  }
  clear() {
    this.model.clear();
    this.widget.clear();
  }
  layout(dimensions, hasMultipleFrames) {
    this.dimension = dimensions;
    const editor = this.widget.value;
    if (!editor) {
      return;
    }
    editor.layout(dimensions);
    const height = Math.max(
      editor.getOriginalEditor().getContentHeight(),
      editor.getModifiedEditor().getContentHeight()
    );
    this.helper = new ScrollHelper(hasMultipleFrames, height, dimensions.height);
    return height;
  }
  onScrolled(evt) {
    this.helper?.onScrolled(evt, this.widget.value?.getDomNode(), this.widget.value?.getOriginalEditor());
  }
  getOptions(isMultiline2) {
    return isMultiline2 ? { ...diffEditorOptions, lineNumbers: "on" } : { ...diffEditorOptions, lineNumbers: "off" };
  }
};
DiffContentProvider = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ITextModelService)
], DiffContentProvider);
let MarkdownTestMessagePeek = class extends Disposable {
  constructor(container, instantiationService) {
    super();
    this.container = container;
    this.instantiationService = instantiationService;
    this.markdown = new Lazy(
      () => this.instantiationService.createInstance(MarkdownRenderer, {})
    );
    this.rendered = this._register(new DisposableStore());
    this._register(toDisposable(() => this.clear()));
  }
  async update(subject) {
    this.clear();
    if (!(subject instanceof MessageSubject)) {
      return false;
    }
    const message = subject.message;
    if (ITestMessage.isDiffable(message) || typeof message.message === "string") {
      return false;
    }
    const rendered = this.rendered.add(this.markdown.value.render(message.message, {}));
    rendered.element.style.userSelect = "text";
    rendered.element.classList.add("preview-text");
    this.container.appendChild(rendered.element);
    this.element = rendered.element;
    this.rendered.add(toDisposable(() => rendered.element.remove()));
    return true;
  }
  layout(dimension) {
    if (!this.element) {
      return void 0;
    }
    this.element.style.width = `${dimension.width - 32}px`;
    return this.element.clientHeight;
  }
  clear() {
    this.rendered.clear();
    this.element = void 0;
  }
};
MarkdownTestMessagePeek = __decorateClass([
  __decorateParam(1, IInstantiationService)
], MarkdownTestMessagePeek);
class ScrollHelper {
  constructor(hasMultipleFrames, contentHeight, viewHeight) {
    this.hasMultipleFrames = hasMultipleFrames;
    this.contentHeight = contentHeight;
    this.viewHeight = viewHeight;
  }
  onScrolled(evt, container, editor) {
    if (!editor || !container) {
      return;
    }
    let delta = Math.max(0, evt.scrollTop - (this.hasMultipleFrames ? CALL_STACK_WIDGET_HEADER_HEIGHT : 0));
    delta = Math.min(Math.max(0, this.contentHeight - this.viewHeight), delta);
    editor.setScrollTop(delta);
    container.style.transform = `translateY(${delta}px)`;
  }
}
let PlainTextMessagePeek = class extends Disposable {
  constructor(editor, container, instantiationService, modelService) {
    super();
    this.editor = editor;
    this.container = container;
    this.instantiationService = instantiationService;
    this.modelService = modelService;
    this.widgetDecorations = this._register(new MutableDisposable());
    this.widget = this._register(new MutableDisposable());
    this.model = this._register(new MutableDisposable());
  }
  get onDidContentSizeChange() {
    return this.widget.value?.onDidContentSizeChange || Event.None;
  }
  async update(subject) {
    if (!(subject instanceof MessageSubject)) {
      this.clear();
      return false;
    }
    const message = subject.message;
    if (ITestMessage.isDiffable(message) || message.type === TestMessageType.Output || typeof message.message !== "string") {
      this.clear();
      return false;
    }
    const modelRef = this.model.value = await this.modelService.createModelReference(subject.messageUri);
    if (!this.widget.value) {
      this.widget.value = this.editor ? this.instantiationService.createInstance(
        EmbeddedCodeEditorWidget,
        this.container,
        commonEditorOptions,
        {},
        this.editor
      ) : this.instantiationService.createInstance(
        CodeEditorWidget,
        this.container,
        commonEditorOptions,
        { isSimpleWidget: true }
      );
      if (this.dimension) {
        this.widget.value.layout(this.dimension);
      }
    }
    this.widget.value.setModel(modelRef.object.textEditorModel);
    this.widget.value.updateOptions(commonEditorOptions);
    this.widgetDecorations.value = colorizeTestMessageInEditor(message.message, this.widget.value);
    return true;
  }
  clear() {
    this.widgetDecorations.clear();
    this.widget.clear();
    this.model.clear();
  }
  onScrolled(evt) {
    this.helper?.onScrolled(evt, this.widget.value?.getDomNode(), this.widget.value);
  }
  layout(dimensions, hasMultipleFrames) {
    this.dimension = dimensions;
    const editor = this.widget.value;
    if (!editor) {
      return;
    }
    editor.layout(dimensions);
    const height = editor.getContentHeight();
    this.helper = new ScrollHelper(hasMultipleFrames, height, dimensions.height);
    return height;
  }
};
PlainTextMessagePeek = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ITextModelService)
], PlainTextMessagePeek);
let TerminalMessagePeek = class extends Disposable {
  constructor(container, isInPeekView, terminalService, viewDescriptorService, workspaceContext) {
    super();
    this.container = container;
    this.isInPeekView = isInPeekView;
    this.terminalService = terminalService;
    this.viewDescriptorService = viewDescriptorService;
    this.workspaceContext = workspaceContext;
    this.terminalCwd = this._register(new MutableObservableValue(""));
    this.xtermLayoutDelayer = this._register(new Delayer(50));
    /** Active terminal instance. */
    this.terminal = this._register(new MutableDisposable());
    /** Listener for streaming result data */
    this.outputDataListener = this._register(new MutableDisposable());
  }
  async makeTerminal() {
    const prev = this.terminal.value;
    if (prev) {
      prev.xterm.clearBuffer();
      prev.xterm.clearSearchDecorations();
      prev.xterm.write(`\x1Bc`);
      return prev;
    }
    const capabilities = new TerminalCapabilityStore();
    const cwd = this.terminalCwd;
    capabilities.add(TerminalCapability.CwdDetection, {
      type: TerminalCapability.CwdDetection,
      get cwds() {
        return [cwd.value];
      },
      onDidChangeCwd: cwd.onDidChange,
      getCwd: () => cwd.value,
      updateCwd: () => {
      }
    });
    return this.terminal.value = await this.terminalService.createDetachedTerminal({
      rows: 10,
      cols: 80,
      readonly: true,
      capabilities,
      processInfo: new DetachedProcessInfo({ initialCwd: cwd.value }),
      colorProvider: {
        getBackgroundColor: (theme) => {
          const terminalBackground = theme.getColor(TERMINAL_BACKGROUND_COLOR);
          if (terminalBackground) {
            return terminalBackground;
          }
          if (this.isInPeekView) {
            return theme.getColor(peekViewResultsBackground);
          }
          const location = this.viewDescriptorService.getViewLocationById(Testing.ResultsViewId);
          return location === ViewContainerLocation.Panel ? theme.getColor(PANEL_BACKGROUND) : theme.getColor(SIDE_BAR_BACKGROUND);
        }
      }
    });
  }
  async update(subject) {
    this.outputDataListener.clear();
    if (subject instanceof TaskSubject) {
      await this.updateForTaskSubject(subject);
    } else if (subject instanceof TestOutputSubject || subject instanceof MessageSubject && subject.message.type === TestMessageType.Output) {
      await this.updateForTestSubject(subject);
    } else {
      this.clear();
      return false;
    }
    return true;
  }
  async updateForTestSubject(subject) {
    const that = this;
    const testItem = subject instanceof TestOutputSubject ? subject.test.item : subject.test;
    const terminal = await this.updateGenerically({
      subject,
      noOutputMessage: localize("caseNoOutput", "The test case did not report any output."),
      getTarget: (result) => result?.tasks[subject.taskIndex].output,
      *doInitialWrite(output, results) {
        that.updateCwd(testItem.uri);
        const state = subject instanceof TestOutputSubject ? subject.test : results.getStateById(testItem.extId);
        if (!state) {
          return;
        }
        for (const message of state.tasks[subject.taskIndex].messages) {
          if (message.type === TestMessageType.Output) {
            yield* output.getRangeIter(message.offset, message.length);
          }
        }
      },
      doListenForMoreData: (output, result, write) => result.onChange((e) => {
        if (e.reason === TestResultItemChangeReason.NewMessage && e.item.item.extId === testItem.extId && e.message.type === TestMessageType.Output) {
          for (const chunk of output.getRangeIter(e.message.offset, e.message.length)) {
            write(chunk.buffer);
          }
        }
      })
    });
    if (subject instanceof MessageSubject && subject.message.type === TestMessageType.Output && subject.message.marker !== void 0) {
      terminal?.xterm.selectMarkedRange(
        getMarkId(subject.message.marker, true),
        getMarkId(subject.message.marker, false),
        /* scrollIntoView= */
        true
      );
    }
  }
  updateForTaskSubject(subject) {
    return this.updateGenerically({
      subject,
      noOutputMessage: localize("runNoOutput", "The test run did not record any output."),
      getTarget: (result) => result?.tasks[subject.taskIndex],
      doInitialWrite: (task, result) => {
        this.updateCwd(Iterable.find(result.tests, (t) => !!t.item.uri)?.item.uri);
        return task.output.buffers;
      },
      doListenForMoreData: (task, _result, write) => task.output.onDidWriteData((e) => write(e.buffer))
    });
  }
  async updateGenerically(opts) {
    const result = opts.subject.result;
    const target = opts.getTarget(result);
    if (!target) {
      return this.clear();
    }
    const terminal = await this.makeTerminal();
    let didWriteData = false;
    const pendingWrites = new MutableObservableValue(0);
    if (result instanceof LiveTestResult) {
      for (const chunk of opts.doInitialWrite(target, result)) {
        didWriteData ||= chunk.byteLength > 0;
        pendingWrites.value++;
        terminal.xterm.write(chunk.buffer, () => pendingWrites.value--);
      }
    } else {
      didWriteData = true;
      this.writeNotice(terminal, localize("runNoOutputForPast", "Test output is only available for new test runs."));
    }
    this.attachTerminalToDom(terminal);
    this.outputDataListener.clear();
    if (result instanceof LiveTestResult && !result.completedAt) {
      const l1 = result.onComplete(() => {
        if (!didWriteData) {
          this.writeNotice(terminal, opts.noOutputMessage);
        }
      });
      const l2 = opts.doListenForMoreData(target, result, (data) => {
        terminal.xterm.write(data);
        didWriteData ||= data.byteLength > 0;
      });
      this.outputDataListener.value = combinedDisposable(l1, l2);
    }
    if (!this.outputDataListener.value && !didWriteData) {
      this.writeNotice(terminal, opts.noOutputMessage);
    }
    if (pendingWrites.value > 0) {
      await new Promise((resolve) => {
        const l = pendingWrites.onDidChange(() => {
          if (pendingWrites.value === 0) {
            l.dispose();
            resolve();
          }
        });
      });
    }
    return terminal;
  }
  updateCwd(testUri) {
    const wf = testUri && this.workspaceContext.getWorkspaceFolder(testUri) || this.workspaceContext.getWorkspace().folders[0];
    if (wf) {
      this.terminalCwd.value = wf.uri.fsPath;
    }
  }
  writeNotice(terminal, str) {
    terminal.xterm.write(formatMessageForTerminal(str));
  }
  attachTerminalToDom(terminal) {
    terminal.xterm.write("\x1B[?25l");
    dom.scheduleAtNextAnimationFrame(dom.getWindow(this.container), () => this.layoutTerminal(terminal));
    terminal.attachToElement(this.container, { enableGpu: false });
  }
  clear() {
    this.outputDataListener.clear();
    this.xtermLayoutDelayer.cancel();
    this.terminal.clear();
  }
  layout(dimensions) {
    this.dimensions = dimensions;
    if (this.terminal.value) {
      this.layoutTerminal(this.terminal.value, dimensions.width, dimensions.height);
      return dimensions.height;
    }
    return void 0;
  }
  layoutTerminal({ xterm }, width = this.dimensions?.width ?? this.container.clientWidth, height = this.dimensions?.height ?? this.container.clientHeight) {
    width -= 10 + 20;
    this.xtermLayoutDelayer.trigger(() => {
      const scaled = getXtermScaledDimensions(dom.getWindow(this.container), xterm.getFont(), width, height);
      if (scaled) {
        xterm.resize(scaled.cols, scaled.rows);
      }
    });
  }
};
TerminalMessagePeek = __decorateClass([
  __decorateParam(2, ITerminalService),
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, IWorkspaceContextService)
], TerminalMessagePeek);
const isMultiline = (str) => !!str && str.includes("\n");
export {
  DiffContentProvider,
  MarkdownTestMessagePeek,
  PlainTextMessagePeek,
  TerminalMessagePeek
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdFJlc3VsdHNWaWV3L3Rlc3RSZXN1bHRzT3V0cHV0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBJUmVmZXJlbmNlLCBNdXRhYmxlRGlzcG9zYWJsZSwgY29tYmluZWREaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJRGlmZkVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2VtYmVkZGVkQ29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZGlmZkVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBFbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9lbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJRGlmZkVkaXRvck9wdGlvbnMsIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgcGVla1ZpZXdSZXN1bHRzQmFja2dyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3BlZWtWaWV3L2Jyb3dzZXIvcGVla1ZpZXcuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvdGVybWluYWxDYXBhYmlsaXR5U3RvcmUuanMnO1xuaW1wb3J0IHsgZm9ybWF0TWVzc2FnZUZvclRlcm1pbmFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsU3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgUEFORUxfQkFDS0dST1VORCwgU0lERV9CQVJfQkFDS0dST1VORCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgRGV0YWNoZWRQcm9jZXNzSW5mbyB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvZGV0YWNoZWRUZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJRGV0YWNoZWRUZXJtaW5hbEluc3RhbmNlLCBJVGVybWluYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBnZXRYdGVybVNjYWxlZERpbWVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3h0ZXJtL3h0ZXJtVGVybWluYWwuanMnO1xuaW1wb3J0IHsgVEVSTUlOQUxfQkFDS0dST1VORF9DT0xPUiB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbENvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgY29sb3JpemVUZXN0TWVzc2FnZUluRWRpdG9yIH0gZnJvbSAnLi4vdGVzdE1lc3NhZ2VDb2xvcml6ZXIuanMnO1xuaW1wb3J0IHsgSW5zcGVjdFN1YmplY3QsIE1lc3NhZ2VTdWJqZWN0LCBUYXNrU3ViamVjdCwgVGVzdE91dHB1dFN1YmplY3QgfSBmcm9tICcuL3Rlc3RSZXN1bHRzU3ViamVjdC5qcyc7XG5pbXBvcnQgeyBUZXN0aW5nIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNdXRhYmxlT2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vY29tbW9uL29ic2VydmFibGVWYWx1ZS5qcyc7XG5pbXBvcnQgeyBJVGFza1Jhd091dHB1dCwgSVRlc3RSZXN1bHQsIElUZXN0UnVuVGFza1Jlc3VsdHMsIExpdmVUZXN0UmVzdWx0LCBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXN0UmVzdWx0LmpzJztcbmltcG9ydCB7IElUZXN0TWVzc2FnZSwgVGVzdE1lc3NhZ2VUeXBlLCBnZXRNYXJrSWQgfSBmcm9tICcuLi8uLi9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IFNjcm9sbEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgeyBDQUxMX1NUQUNLX1dJREdFVF9IRUFERVJfSEVJR0hUIH0gZnJvbSAnLi4vLi4vLi4vZGVidWcvYnJvd3Nlci9jYWxsU3RhY2tXaWRnZXQuanMnO1xuXG5cbmNsYXNzIFNpbXBsZURpZmZFZGl0b3JNb2RlbCBleHRlbmRzIEVkaXRvck1vZGVsIHtcblx0cHVibGljIHJlYWRvbmx5IG9yaWdpbmFsID0gdGhpcy5fb3JpZ2luYWwub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblx0cHVibGljIHJlYWRvbmx5IG1vZGlmaWVkID0gdGhpcy5fbW9kaWZpZWQub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbDogSVJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vZGlmaWVkOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4sXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb3JpZ2luYWwuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX21vZGlmaWVkLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBlZWtPdXRwdXRSZW5kZXJlciBleHRlbmRzIElEaXNwb3NhYmxlIHtcblx0b25EaWRDb250ZW50U2l6ZUNoYW5nZT86IEV2ZW50PHZvaWQ+O1xuXHRvblNjcm9sbGVkPyhldnQ6IFNjcm9sbEV2ZW50KTogdm9pZDtcblx0LyoqIFVwZGF0ZXMgdGhlIGRpc3BsYXllZCB0ZXN0LiBTaG91bGQgY2xlYXIgaWYgaXQgY2Fubm90IGRpc3BsYXkgdGhlIHRlc3QuICovXG5cdHVwZGF0ZShzdWJqZWN0OiBJbnNwZWN0U3ViamVjdCk6IFByb21pc2U8Ym9vbGVhbj47XG5cdC8qKiBSZWNhbGN1bGF0ZSBjb250ZW50IGxheW91dC4gUmV0dXJucyB0aGUgaGVpZ2h0IGl0IHNob3VsZCBiZSByZW5kZXJlZCBhdC4gKi9cblx0bGF5b3V0KGRpbWVuc2lvbjogZG9tLklEaW1lbnNpb24sIGhhc011bHRpcGxlRnJhbWVzOiBib29sZWFuKTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHQvKiogRGlzcG9zZSB0aGUgY29udGVudCBwcm92aWRlci4gKi9cblx0ZGlzcG9zZSgpOiB2b2lkO1xufVxuXG5jb25zdCBjb21tb25FZGl0b3JPcHRpb25zOiBJRWRpdG9yT3B0aW9ucyA9IHtcblx0c2Nyb2xsQmV5b25kTGFzdExpbmU6IGZhbHNlLFxuXHRsaW5rczogdHJ1ZSxcblx0bGluZU51bWJlcnM6ICdvZmYnLFxuXHRnbHlwaE1hcmdpbjogZmFsc2UsXG5cdHNjcm9sbGJhcjoge1xuXHRcdHZlcnRpY2FsOiAnaGlkZGVuJyxcblx0XHRob3Jpem9udGFsOiAnYXV0bycsXG5cdFx0dXNlU2hhZG93czogZmFsc2UsXG5cdFx0dmVydGljYWxIYXNBcnJvd3M6IGZhbHNlLFxuXHRcdGhvcml6b250YWxIYXNBcnJvd3M6IGZhbHNlLFxuXHRcdGhhbmRsZU1vdXNlV2hlZWw6IGZhbHNlLFxuXHR9LFxuXHRvdmVydmlld1J1bGVyTGFuZXM6IDAsXG5cdGZpeGVkT3ZlcmZsb3dXaWRnZXRzOiB0cnVlLFxuXHRyZWFkT25seTogdHJ1ZSxcblx0c3RpY2t5U2Nyb2xsOiB7IGVuYWJsZWQ6IGZhbHNlIH0sXG5cdG1pbmltYXA6IHsgZW5hYmxlZDogZmFsc2UgfSxcblx0YXV0b21hdGljTGF5b3V0OiBmYWxzZSxcbn07XG5cbmNvbnN0IGRpZmZFZGl0b3JPcHRpb25zOiBJRGlmZkVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMgPSB7XG5cdC4uLmNvbW1vbkVkaXRvck9wdGlvbnMsXG5cdGVuYWJsZVNwbGl0Vmlld1Jlc2l6aW5nOiB0cnVlLFxuXHRpc0luRW1iZWRkZWRFZGl0b3I6IHRydWUsXG5cdHJlbmRlck92ZXJ2aWV3UnVsZXI6IGZhbHNlLFxuXHRpZ25vcmVUcmltV2hpdGVzcGFjZTogZmFsc2UsXG5cdHJlbmRlclNpZGVCeVNpZGU6IHRydWUsXG5cdHVzZUlubGluZVZpZXdXaGVuU3BhY2VJc0xpbWl0ZWQ6IGZhbHNlLFxuXHRvcmlnaW5hbEFyaWFMYWJlbDogbG9jYWxpemUoJ3Rlc3RpbmdPdXRwdXRFeHBlY3RlZCcsICdFeHBlY3RlZCByZXN1bHQnKSxcblx0bW9kaWZpZWRBcmlhTGFiZWw6IGxvY2FsaXplKCd0ZXN0aW5nT3V0cHV0QWN0dWFsJywgJ0FjdHVhbCByZXN1bHQnKSxcblx0ZGlmZkFsZ29yaXRobTogJ2FkdmFuY2VkJyxcbn07XG5cblxuZXhwb3J0IGNsYXNzIERpZmZDb250ZW50UHJvdmlkZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVBlZWtPdXRwdXRSZW5kZXJlciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgd2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPERpZmZFZGl0b3JXaWRnZXQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIGRpbWVuc2lvbj86IGRvbS5JRGltZW5zaW9uO1xuXHRwcml2YXRlIGhlbHBlcj86IFNjcm9sbEhlbHBlcjtcblxuXHRwdWJsaWMgZ2V0IG9uRGlkQ29udGVudFNpemVDaGFuZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMud2lkZ2V0LnZhbHVlPy5vbkRpZENvbnRlbnRTaXplQ2hhbmdlIHx8IEV2ZW50Lk5vbmU7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgdXBkYXRlKHN1YmplY3Q6IEluc3BlY3RTdWJqZWN0KSB7XG5cdFx0aWYgKCEoc3ViamVjdCBpbnN0YW5jZW9mIE1lc3NhZ2VTdWJqZWN0KSkge1xuXHRcdFx0dGhpcy5jbGVhcigpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBtZXNzYWdlID0gc3ViamVjdC5tZXNzYWdlO1xuXHRcdGlmICghSVRlc3RNZXNzYWdlLmlzRGlmZmFibGUobWVzc2FnZSkpIHtcblx0XHRcdHRoaXMuY2xlYXIoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBbb3JpZ2luYWwsIG1vZGlmaWVkXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHRoaXMubW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHN1YmplY3QuZXhwZWN0ZWRVcmkpLFxuXHRcdFx0dGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2Uoc3ViamVjdC5hY3R1YWxVcmkpLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsLnZhbHVlID0gbmV3IFNpbXBsZURpZmZFZGl0b3JNb2RlbChvcmlnaW5hbCwgbW9kaWZpZWQpO1xuXHRcdGlmICghdGhpcy53aWRnZXQudmFsdWUpIHtcblx0XHRcdHRoaXMud2lkZ2V0LnZhbHVlID0gdGhpcy5lZGl0b3IgPyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRFbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQsXG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLFxuXHRcdFx0XHRkaWZmRWRpdG9yT3B0aW9ucyxcblx0XHRcdFx0e30sXG5cdFx0XHRcdHRoaXMuZWRpdG9yLFxuXHRcdFx0KSA6IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdERpZmZFZGl0b3JXaWRnZXQsXG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLFxuXHRcdFx0XHRkaWZmRWRpdG9yT3B0aW9ucyxcblx0XHRcdFx0e30sXG5cdFx0XHQpO1xuXG5cdFx0XHRpZiAodGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdFx0dGhpcy53aWRnZXQudmFsdWUubGF5b3V0KHRoaXMuZGltZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLndpZGdldC52YWx1ZS5zZXRNb2RlbChtb2RlbCk7XG5cdFx0dGhpcy53aWRnZXQudmFsdWUudXBkYXRlT3B0aW9ucyh0aGlzLmdldE9wdGlvbnMoXG5cdFx0XHRpc011bHRpbGluZShtZXNzYWdlLmV4cGVjdGVkKSB8fCBpc011bHRpbGluZShtZXNzYWdlLmFjdHVhbClcblx0XHQpKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpIHtcblx0XHR0aGlzLm1vZGVsLmNsZWFyKCk7XG5cdFx0dGhpcy53aWRnZXQuY2xlYXIoKTtcblx0fVxuXG5cdHB1YmxpYyBsYXlvdXQoZGltZW5zaW9uczogZG9tLklEaW1lbnNpb24sIGhhc011bHRpcGxlRnJhbWVzOiBib29sZWFuKSB7XG5cdFx0dGhpcy5kaW1lbnNpb24gPSBkaW1lbnNpb25zO1xuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMud2lkZ2V0LnZhbHVlO1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZWRpdG9yLmxheW91dChkaW1lbnNpb25zKTtcblx0XHRjb25zdCBoZWlnaHQgPSBNYXRoLm1heChcblx0XHRcdGVkaXRvci5nZXRPcmlnaW5hbEVkaXRvcigpLmdldENvbnRlbnRIZWlnaHQoKSxcblx0XHRcdGVkaXRvci5nZXRNb2RpZmllZEVkaXRvcigpLmdldENvbnRlbnRIZWlnaHQoKVxuXHRcdCk7XG5cdFx0dGhpcy5oZWxwZXIgPSBuZXcgU2Nyb2xsSGVscGVyKGhhc011bHRpcGxlRnJhbWVzLCBoZWlnaHQsIGRpbWVuc2lvbnMuaGVpZ2h0KTtcblx0XHRyZXR1cm4gaGVpZ2h0O1xuXHR9XG5cblx0cHVibGljIG9uU2Nyb2xsZWQoZXZ0OiBTY3JvbGxFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuaGVscGVyPy5vblNjcm9sbGVkKGV2dCwgdGhpcy53aWRnZXQudmFsdWU/LmdldERvbU5vZGUoKSwgdGhpcy53aWRnZXQudmFsdWU/LmdldE9yaWdpbmFsRWRpdG9yKCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldE9wdGlvbnMoaXNNdWx0aWxpbmU6IGJvb2xlYW4pOiBJRGlmZkVkaXRvck9wdGlvbnMge1xuXHRcdHJldHVybiBpc011bHRpbGluZVxuXHRcdFx0PyB7IC4uLmRpZmZFZGl0b3JPcHRpb25zLCBsaW5lTnVtYmVyczogJ29uJyB9XG5cdFx0XHQ6IHsgLi4uZGlmZkVkaXRvck9wdGlvbnMsIGxpbmVOdW1iZXJzOiAnb2ZmJyB9O1xuXHR9XG59XG5cblxuZXhwb3J0IGNsYXNzIE1hcmtkb3duVGVzdE1lc3NhZ2VQZWVrIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElQZWVrT3V0cHV0UmVuZGVyZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IG1hcmtkb3duID0gbmV3IExhenkoXG5cdFx0KCkgPT4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZG93blJlbmRlcmVyLCB7fSksXG5cdCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVuZGVyZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHByaXZhdGUgZWxlbWVudD86IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCwgQElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLmNsZWFyKCkpKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyB1cGRhdGUoc3ViamVjdDogSW5zcGVjdFN1YmplY3QpIHtcblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0aWYgKCEoc3ViamVjdCBpbnN0YW5jZW9mIE1lc3NhZ2VTdWJqZWN0KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lc3NhZ2UgPSBzdWJqZWN0Lm1lc3NhZ2U7XG5cdFx0aWYgKElUZXN0TWVzc2FnZS5pc0RpZmZhYmxlKG1lc3NhZ2UpIHx8IHR5cGVvZiBtZXNzYWdlLm1lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cblx0XHRjb25zdCByZW5kZXJlZCA9IHRoaXMucmVuZGVyZWQuYWRkKHRoaXMubWFya2Rvd24udmFsdWUucmVuZGVyKG1lc3NhZ2UubWVzc2FnZSwge30pKTtcblx0XHRyZW5kZXJlZC5lbGVtZW50LnN0eWxlLnVzZXJTZWxlY3QgPSAndGV4dCc7XG5cdFx0cmVuZGVyZWQuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdwcmV2aWV3LXRleHQnKTtcblx0XHR0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZChyZW5kZXJlZC5lbGVtZW50KTtcblx0XHR0aGlzLmVsZW1lbnQgPSByZW5kZXJlZC5lbGVtZW50O1xuXHRcdHRoaXMucmVuZGVyZWQuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiByZW5kZXJlZC5lbGVtZW50LnJlbW92ZSgpKSk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBsYXlvdXQoZGltZW5zaW9uOiBkb20uSURpbWVuc2lvbik6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLmVsZW1lbnQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5lbGVtZW50LnN0eWxlLndpZHRoID0gYCR7ZGltZW5zaW9uLndpZHRoIC0gMzJ9cHhgO1xuXHRcdHJldHVybiB0aGlzLmVsZW1lbnQuY2xpZW50SGVpZ2h0O1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpIHtcblx0XHR0aGlzLnJlbmRlcmVkLmNsZWFyKCk7XG5cdFx0dGhpcy5lbGVtZW50ID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmNsYXNzIFNjcm9sbEhlbHBlciB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaGFzTXVsdGlwbGVGcmFtZXM6IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250ZW50SGVpZ2h0OiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2aWV3SGVpZ2h0OiBudW1iZXIsXG5cdCkgeyB9XG5cblx0cHVibGljIG9uU2Nyb2xsZWQoZXZ0OiBTY3JvbGxFdmVudCwgY29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCB8IG51bGwsIGVkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAoIWVkaXRvciB8fCAhY29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGRlbHRhID0gTWF0aC5tYXgoMCwgZXZ0LnNjcm9sbFRvcCAtICh0aGlzLmhhc011bHRpcGxlRnJhbWVzID8gQ0FMTF9TVEFDS19XSURHRVRfSEVBREVSX0hFSUdIVCA6IDApKTtcblx0XHRkZWx0YSA9IE1hdGgubWluKE1hdGgubWF4KDAsIHRoaXMuY29udGVudEhlaWdodCAtIHRoaXMudmlld0hlaWdodCksIGRlbHRhKTtcblxuXHRcdGVkaXRvci5zZXRTY3JvbGxUb3AoZGVsdGEpO1xuXHRcdGNvbnRhaW5lci5zdHlsZS50cmFuc2Zvcm0gPSBgdHJhbnNsYXRlWSgke2RlbHRhfXB4KWA7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFBsYWluVGV4dE1lc3NhZ2VQZWVrIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElQZWVrT3V0cHV0UmVuZGVyZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IHdpZGdldERlY29yYXRpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxDb2RlRWRpdG9yV2lkZ2V0PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBtb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSBkaW1lbnNpb24/OiBkb20uSURpbWVuc2lvbjtcblx0cHJpdmF0ZSBoZWxwZXI/OiBTY3JvbGxIZWxwZXI7XG5cblx0cHVibGljIGdldCBvbkRpZENvbnRlbnRTaXplQ2hhbmdlKCkge1xuXHRcdHJldHVybiB0aGlzLndpZGdldC52YWx1ZT8ub25EaWRDb250ZW50U2l6ZUNoYW5nZSB8fCBFdmVudC5Ob25lO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3I6IElDb2RlRWRpdG9yIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHVwZGF0ZShzdWJqZWN0OiBJbnNwZWN0U3ViamVjdCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICghKHN1YmplY3QgaW5zdGFuY2VvZiBNZXNzYWdlU3ViamVjdCkpIHtcblx0XHRcdHRoaXMuY2xlYXIoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0gc3ViamVjdC5tZXNzYWdlO1xuXHRcdGlmIChJVGVzdE1lc3NhZ2UuaXNEaWZmYWJsZShtZXNzYWdlKSB8fCBtZXNzYWdlLnR5cGUgPT09IFRlc3RNZXNzYWdlVHlwZS5PdXRwdXQgfHwgdHlwZW9mIG1lc3NhZ2UubWVzc2FnZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuY2xlYXIoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbFJlZiA9IHRoaXMubW9kZWwudmFsdWUgPSBhd2FpdCB0aGlzLm1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShzdWJqZWN0Lm1lc3NhZ2VVcmkpO1xuXHRcdGlmICghdGhpcy53aWRnZXQudmFsdWUpIHtcblx0XHRcdHRoaXMud2lkZ2V0LnZhbHVlID0gdGhpcy5lZGl0b3IgPyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQsXG5cdFx0XHRcdHRoaXMuY29udGFpbmVyLFxuXHRcdFx0XHRjb21tb25FZGl0b3JPcHRpb25zLFxuXHRcdFx0XHR7fSxcblx0XHRcdFx0dGhpcy5lZGl0b3IsXG5cdFx0XHQpIDogdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0Q29kZUVkaXRvcldpZGdldCxcblx0XHRcdFx0dGhpcy5jb250YWluZXIsXG5cdFx0XHRcdGNvbW1vbkVkaXRvck9wdGlvbnMsXG5cdFx0XHRcdHsgaXNTaW1wbGVXaWRnZXQ6IHRydWUgfVxuXHRcdFx0KTtcblxuXHRcdFx0aWYgKHRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHRcdHRoaXMud2lkZ2V0LnZhbHVlLmxheW91dCh0aGlzLmRpbWVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy53aWRnZXQudmFsdWUuc2V0TW9kZWwobW9kZWxSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbCk7XG5cdFx0dGhpcy53aWRnZXQudmFsdWUudXBkYXRlT3B0aW9ucyhjb21tb25FZGl0b3JPcHRpb25zKTtcblx0XHR0aGlzLndpZGdldERlY29yYXRpb25zLnZhbHVlID0gY29sb3JpemVUZXN0TWVzc2FnZUluRWRpdG9yKG1lc3NhZ2UubWVzc2FnZSwgdGhpcy53aWRnZXQudmFsdWUpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpIHtcblx0XHR0aGlzLndpZGdldERlY29yYXRpb25zLmNsZWFyKCk7XG5cdFx0dGhpcy53aWRnZXQuY2xlYXIoKTtcblx0XHR0aGlzLm1vZGVsLmNsZWFyKCk7XG5cdH1cblxuXHRvblNjcm9sbGVkKGV2dDogU2Nyb2xsRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLmhlbHBlcj8ub25TY3JvbGxlZChldnQsIHRoaXMud2lkZ2V0LnZhbHVlPy5nZXREb21Ob2RlKCksIHRoaXMud2lkZ2V0LnZhbHVlKTtcblx0fVxuXG5cdHB1YmxpYyBsYXlvdXQoZGltZW5zaW9uczogZG9tLklEaW1lbnNpb24sIGhhc011bHRpcGxlRnJhbWVzOiBib29sZWFuKSB7XG5cdFx0dGhpcy5kaW1lbnNpb24gPSBkaW1lbnNpb25zO1xuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMud2lkZ2V0LnZhbHVlO1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZWRpdG9yLmxheW91dChkaW1lbnNpb25zKTtcblx0XHRjb25zdCBoZWlnaHQgPSBlZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdHRoaXMuaGVscGVyID0gbmV3IFNjcm9sbEhlbHBlcihoYXNNdWx0aXBsZUZyYW1lcywgaGVpZ2h0LCBkaW1lbnNpb25zLmhlaWdodCk7XG5cdFx0cmV0dXJuIGhlaWdodDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVybWluYWxNZXNzYWdlUGVlayBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJUGVla091dHB1dFJlbmRlcmVyIHtcblx0cHJpdmF0ZSBkaW1lbnNpb25zPzogZG9tLklEaW1lbnNpb247XG5cdHByaXZhdGUgcmVhZG9ubHkgdGVybWluYWxDd2QgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZU9ic2VydmFibGVWYWx1ZTxzdHJpbmc+KCcnKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgeHRlcm1MYXlvdXREZWxheWVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERlbGF5ZXIoNTApKTtcblxuXHQvKiogQWN0aXZlIHRlcm1pbmFsIGluc3RhbmNlLiAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IHRlcm1pbmFsID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElEZXRhY2hlZFRlcm1pbmFsSW5zdGFuY2U+KCkpO1xuXHQvKiogTGlzdGVuZXIgZm9yIHN0cmVhbWluZyByZXN1bHQgZGF0YSAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IG91dHB1dERhdGFMaXN0ZW5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpc0luUGVla1ZpZXc6IGJvb2xlYW4sXG5cdFx0QElUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXJtaW5hbFNlcnZpY2U6IElUZXJtaW5hbFNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHQ6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbWFrZVRlcm1pbmFsKCkge1xuXHRcdGNvbnN0IHByZXYgPSB0aGlzLnRlcm1pbmFsLnZhbHVlO1xuXHRcdGlmIChwcmV2KSB7XG5cdFx0XHRwcmV2Lnh0ZXJtLmNsZWFyQnVmZmVyKCk7XG5cdFx0XHRwcmV2Lnh0ZXJtLmNsZWFyU2VhcmNoRGVjb3JhdGlvbnMoKTtcblx0XHRcdC8vIGNsZWFyQnVmZmVyIHRyaWVzIHRvIHJldGFpbiB0aGUgcHJvbXB0LiBSZXNldCBwcm9tcHQsIHNjcm9sbGluZyBzdGF0ZSwgZXRjLlxuXHRcdFx0cHJldi54dGVybS53cml0ZShgXFx4MWJjYCk7XG5cdFx0XHRyZXR1cm4gcHJldjtcblx0XHR9XG5cblx0XHRjb25zdCBjYXBhYmlsaXRpZXMgPSBuZXcgVGVybWluYWxDYXBhYmlsaXR5U3RvcmUoKTtcblx0XHRjb25zdCBjd2QgPSB0aGlzLnRlcm1pbmFsQ3dkO1xuXHRcdGNhcGFiaWxpdGllcy5hZGQoVGVybWluYWxDYXBhYmlsaXR5LkN3ZERldGVjdGlvbiwge1xuXHRcdFx0dHlwZTogVGVybWluYWxDYXBhYmlsaXR5LkN3ZERldGVjdGlvbixcblx0XHRcdGdldCBjd2RzKCkgeyByZXR1cm4gW2N3ZC52YWx1ZV07IH0sXG5cdFx0XHRvbkRpZENoYW5nZUN3ZDogY3dkLm9uRGlkQ2hhbmdlLFxuXHRcdFx0Z2V0Q3dkOiAoKSA9PiBjd2QudmFsdWUsXG5cdFx0XHR1cGRhdGVDd2Q6ICgpID0+IHsgfSxcblx0XHR9KTtcblxuXHRcdHJldHVybiB0aGlzLnRlcm1pbmFsLnZhbHVlID0gYXdhaXQgdGhpcy50ZXJtaW5hbFNlcnZpY2UuY3JlYXRlRGV0YWNoZWRUZXJtaW5hbCh7XG5cdFx0XHRyb3dzOiAxMCxcblx0XHRcdGNvbHM6IDgwLFxuXHRcdFx0cmVhZG9ubHk6IHRydWUsXG5cdFx0XHRjYXBhYmlsaXRpZXMsXG5cdFx0XHRwcm9jZXNzSW5mbzogbmV3IERldGFjaGVkUHJvY2Vzc0luZm8oeyBpbml0aWFsQ3dkOiBjd2QudmFsdWUgfSksXG5cdFx0XHRjb2xvclByb3ZpZGVyOiB7XG5cdFx0XHRcdGdldEJhY2tncm91bmRDb2xvcjogdGhlbWUgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRlcm1pbmFsQmFja2dyb3VuZCA9IHRoZW1lLmdldENvbG9yKFRFUk1JTkFMX0JBQ0tHUk9VTkRfQ09MT1IpO1xuXHRcdFx0XHRcdGlmICh0ZXJtaW5hbEJhY2tncm91bmQpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0ZXJtaW5hbEJhY2tncm91bmQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh0aGlzLmlzSW5QZWVrVmlldykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoZW1lLmdldENvbG9yKHBlZWtWaWV3UmVzdWx0c0JhY2tncm91bmQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBsb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQoVGVzdGluZy5SZXN1bHRzVmlld0lkKTtcblx0XHRcdFx0XHRyZXR1cm4gbG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbFxuXHRcdFx0XHRcdFx0PyB0aGVtZS5nZXRDb2xvcihQQU5FTF9CQUNLR1JPVU5EKVxuXHRcdFx0XHRcdFx0OiB0aGVtZS5nZXRDb2xvcihTSURFX0JBUl9CQUNLR1JPVU5EKTtcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyB1cGRhdGUoc3ViamVjdDogSW5zcGVjdFN1YmplY3QpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHR0aGlzLm91dHB1dERhdGFMaXN0ZW5lci5jbGVhcigpO1xuXHRcdGlmIChzdWJqZWN0IGluc3RhbmNlb2YgVGFza1N1YmplY3QpIHtcblx0XHRcdGF3YWl0IHRoaXMudXBkYXRlRm9yVGFza1N1YmplY3Qoc3ViamVjdCk7XG5cdFx0fSBlbHNlIGlmIChzdWJqZWN0IGluc3RhbmNlb2YgVGVzdE91dHB1dFN1YmplY3QgfHwgKHN1YmplY3QgaW5zdGFuY2VvZiBNZXNzYWdlU3ViamVjdCAmJiBzdWJqZWN0Lm1lc3NhZ2UudHlwZSA9PT0gVGVzdE1lc3NhZ2VUeXBlLk91dHB1dCkpIHtcblx0XHRcdGF3YWl0IHRoaXMudXBkYXRlRm9yVGVzdFN1YmplY3Qoc3ViamVjdCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY2xlYXIoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlRm9yVGVzdFN1YmplY3Qoc3ViamVjdDogVGVzdE91dHB1dFN1YmplY3QgfCBNZXNzYWdlU3ViamVjdCkge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdGNvbnN0IHRlc3RJdGVtID0gc3ViamVjdCBpbnN0YW5jZW9mIFRlc3RPdXRwdXRTdWJqZWN0ID8gc3ViamVjdC50ZXN0Lml0ZW0gOiBzdWJqZWN0LnRlc3Q7XG5cdFx0Y29uc3QgdGVybWluYWwgPSBhd2FpdCB0aGlzLnVwZGF0ZUdlbmVyaWNhbGx5PElUYXNrUmF3T3V0cHV0Pih7XG5cdFx0XHRzdWJqZWN0LFxuXHRcdFx0bm9PdXRwdXRNZXNzYWdlOiBsb2NhbGl6ZSgnY2FzZU5vT3V0cHV0JywgJ1RoZSB0ZXN0IGNhc2UgZGlkIG5vdCByZXBvcnQgYW55IG91dHB1dC4nKSxcblx0XHRcdGdldFRhcmdldDogcmVzdWx0ID0+IHJlc3VsdD8udGFza3Nbc3ViamVjdC50YXNrSW5kZXhdLm91dHB1dCxcblx0XHRcdCpkb0luaXRpYWxXcml0ZShvdXRwdXQsIHJlc3VsdHMpIHtcblx0XHRcdFx0dGhhdC51cGRhdGVDd2QodGVzdEl0ZW0udXJpKTtcblx0XHRcdFx0Y29uc3Qgc3RhdGUgPSBzdWJqZWN0IGluc3RhbmNlb2YgVGVzdE91dHB1dFN1YmplY3QgPyBzdWJqZWN0LnRlc3QgOiByZXN1bHRzLmdldFN0YXRlQnlJZCh0ZXN0SXRlbS5leHRJZCk7XG5cdFx0XHRcdGlmICghc3RhdGUpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IG1lc3NhZ2Ugb2Ygc3RhdGUudGFza3Nbc3ViamVjdC50YXNrSW5kZXhdLm1lc3NhZ2VzKSB7XG5cdFx0XHRcdFx0aWYgKG1lc3NhZ2UudHlwZSA9PT0gVGVzdE1lc3NhZ2VUeXBlLk91dHB1dCkge1xuXHRcdFx0XHRcdFx0eWllbGQqIG91dHB1dC5nZXRSYW5nZUl0ZXIobWVzc2FnZS5vZmZzZXQsIG1lc3NhZ2UubGVuZ3RoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRkb0xpc3RlbkZvck1vcmVEYXRhOiAob3V0cHV0LCByZXN1bHQsIHdyaXRlKSA9PiByZXN1bHQub25DaGFuZ2UoZSA9PiB7XG5cdFx0XHRcdGlmIChlLnJlYXNvbiA9PT0gVGVzdFJlc3VsdEl0ZW1DaGFuZ2VSZWFzb24uTmV3TWVzc2FnZSAmJiBlLml0ZW0uaXRlbS5leHRJZCA9PT0gdGVzdEl0ZW0uZXh0SWQgJiYgZS5tZXNzYWdlLnR5cGUgPT09IFRlc3RNZXNzYWdlVHlwZS5PdXRwdXQpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNodW5rIG9mIG91dHB1dC5nZXRSYW5nZUl0ZXIoZS5tZXNzYWdlLm9mZnNldCwgZS5tZXNzYWdlLmxlbmd0aCkpIHtcblx0XHRcdFx0XHRcdHdyaXRlKGNodW5rLmJ1ZmZlcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHR9KTtcblxuXHRcdGlmIChzdWJqZWN0IGluc3RhbmNlb2YgTWVzc2FnZVN1YmplY3QgJiYgc3ViamVjdC5tZXNzYWdlLnR5cGUgPT09IFRlc3RNZXNzYWdlVHlwZS5PdXRwdXQgJiYgc3ViamVjdC5tZXNzYWdlLm1hcmtlciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0ZXJtaW5hbD8ueHRlcm0uc2VsZWN0TWFya2VkUmFuZ2UoZ2V0TWFya0lkKHN1YmplY3QubWVzc2FnZS5tYXJrZXIsIHRydWUpLCBnZXRNYXJrSWQoc3ViamVjdC5tZXNzYWdlLm1hcmtlciwgZmFsc2UpLCAvKiBzY3JvbGxJbnRvVmlldz0gKi8gdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVGb3JUYXNrU3ViamVjdChzdWJqZWN0OiBUYXNrU3ViamVjdCkge1xuXHRcdHJldHVybiB0aGlzLnVwZGF0ZUdlbmVyaWNhbGx5PElUZXN0UnVuVGFza1Jlc3VsdHM+KHtcblx0XHRcdHN1YmplY3QsXG5cdFx0XHRub091dHB1dE1lc3NhZ2U6IGxvY2FsaXplKCdydW5Ob091dHB1dCcsICdUaGUgdGVzdCBydW4gZGlkIG5vdCByZWNvcmQgYW55IG91dHB1dC4nKSxcblx0XHRcdGdldFRhcmdldDogcmVzdWx0ID0+IHJlc3VsdD8udGFza3Nbc3ViamVjdC50YXNrSW5kZXhdLFxuXHRcdFx0ZG9Jbml0aWFsV3JpdGU6ICh0YXNrLCByZXN1bHQpID0+IHtcblx0XHRcdFx0Ly8gVXBkYXRlIHRoZSBjd2QgYW5kIHVzZSB0aGUgZmlyc3QgdGVzdCB0byB0cnkgdG8gaGludCBhdCB0aGUgY29ycmVjdCBjd2QsXG5cdFx0XHRcdC8vIGJ1dCBvZnRlbiB0aGlzIHdpbGwgZmFsbCBiYWNrIHRvIHRoZSBmaXJzdCB3b3Jrc3BhY2UgZm9sZGVyLlxuXHRcdFx0XHR0aGlzLnVwZGF0ZUN3ZChJdGVyYWJsZS5maW5kKHJlc3VsdC50ZXN0cywgdCA9PiAhIXQuaXRlbS51cmkpPy5pdGVtLnVyaSk7XG5cdFx0XHRcdHJldHVybiB0YXNrLm91dHB1dC5idWZmZXJzO1xuXHRcdFx0fSxcblx0XHRcdGRvTGlzdGVuRm9yTW9yZURhdGE6ICh0YXNrLCBfcmVzdWx0LCB3cml0ZSkgPT4gdGFzay5vdXRwdXQub25EaWRXcml0ZURhdGEoZSA9PiB3cml0ZShlLmJ1ZmZlcikpLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVHZW5lcmljYWxseTxUPihvcHRzOiB7XG5cdFx0c3ViamVjdDogSW5zcGVjdFN1YmplY3Q7XG5cdFx0bm9PdXRwdXRNZXNzYWdlOiBzdHJpbmc7XG5cdFx0Z2V0VGFyZ2V0OiAocmVzdWx0OiBJVGVzdFJlc3VsdCkgPT4gVCB8IHVuZGVmaW5lZDtcblx0XHRkb0luaXRpYWxXcml0ZTogKHRhcmdldDogVCwgcmVzdWx0OiBMaXZlVGVzdFJlc3VsdCkgPT4gSXRlcmFibGU8VlNCdWZmZXI+O1xuXHRcdGRvTGlzdGVuRm9yTW9yZURhdGE6ICh0YXJnZXQ6IFQsIHJlc3VsdDogTGl2ZVRlc3RSZXN1bHQsIHdyaXRlOiAoczogVWludDhBcnJheSkgPT4gdm9pZCkgPT4gSURpc3Bvc2FibGU7XG5cdH0pIHtcblx0XHRjb25zdCByZXN1bHQgPSBvcHRzLnN1YmplY3QucmVzdWx0O1xuXHRcdGNvbnN0IHRhcmdldCA9IG9wdHMuZ2V0VGFyZ2V0KHJlc3VsdCk7XG5cdFx0aWYgKCF0YXJnZXQpIHtcblx0XHRcdHJldHVybiB0aGlzLmNsZWFyKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGVybWluYWwgPSBhd2FpdCB0aGlzLm1ha2VUZXJtaW5hbCgpO1xuXHRcdGxldCBkaWRXcml0ZURhdGEgPSBmYWxzZTtcblxuXHRcdGNvbnN0IHBlbmRpbmdXcml0ZXMgPSBuZXcgTXV0YWJsZU9ic2VydmFibGVWYWx1ZSgwKTtcblx0XHRpZiAocmVzdWx0IGluc3RhbmNlb2YgTGl2ZVRlc3RSZXN1bHQpIHtcblx0XHRcdGZvciAoY29uc3QgY2h1bmsgb2Ygb3B0cy5kb0luaXRpYWxXcml0ZSh0YXJnZXQsIHJlc3VsdCkpIHtcblx0XHRcdFx0ZGlkV3JpdGVEYXRhIHx8PSBjaHVuay5ieXRlTGVuZ3RoID4gMDtcblx0XHRcdFx0cGVuZGluZ1dyaXRlcy52YWx1ZSsrO1xuXHRcdFx0XHR0ZXJtaW5hbC54dGVybS53cml0ZShjaHVuay5idWZmZXIsICgpID0+IHBlbmRpbmdXcml0ZXMudmFsdWUtLSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRpZFdyaXRlRGF0YSA9IHRydWU7XG5cdFx0XHR0aGlzLndyaXRlTm90aWNlKHRlcm1pbmFsLCBsb2NhbGl6ZSgncnVuTm9PdXRwdXRGb3JQYXN0JywgJ1Rlc3Qgb3V0cHV0IGlzIG9ubHkgYXZhaWxhYmxlIGZvciBuZXcgdGVzdCBydW5zLicpKTtcblx0XHR9XG5cblx0XHR0aGlzLmF0dGFjaFRlcm1pbmFsVG9Eb20odGVybWluYWwpO1xuXHRcdHRoaXMub3V0cHV0RGF0YUxpc3RlbmVyLmNsZWFyKCk7XG5cblx0XHRpZiAocmVzdWx0IGluc3RhbmNlb2YgTGl2ZVRlc3RSZXN1bHQgJiYgIXJlc3VsdC5jb21wbGV0ZWRBdCkge1xuXHRcdFx0Y29uc3QgbDEgPSByZXN1bHQub25Db21wbGV0ZSgoKSA9PiB7XG5cdFx0XHRcdGlmICghZGlkV3JpdGVEYXRhKSB7XG5cdFx0XHRcdFx0dGhpcy53cml0ZU5vdGljZSh0ZXJtaW5hbCwgb3B0cy5ub091dHB1dE1lc3NhZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGwyID0gb3B0cy5kb0xpc3RlbkZvck1vcmVEYXRhKHRhcmdldCwgcmVzdWx0LCBkYXRhID0+IHtcblx0XHRcdFx0dGVybWluYWwueHRlcm0ud3JpdGUoZGF0YSk7XG5cdFx0XHRcdGRpZFdyaXRlRGF0YSB8fD0gZGF0YS5ieXRlTGVuZ3RoID4gMDtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLm91dHB1dERhdGFMaXN0ZW5lci52YWx1ZSA9IGNvbWJpbmVkRGlzcG9zYWJsZShsMSwgbDIpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5vdXRwdXREYXRhTGlzdGVuZXIudmFsdWUgJiYgIWRpZFdyaXRlRGF0YSkge1xuXHRcdFx0dGhpcy53cml0ZU5vdGljZSh0ZXJtaW5hbCwgb3B0cy5ub091dHB1dE1lc3NhZ2UpO1xuXHRcdH1cblxuXHRcdC8vIEVuc3VyZSBwZW5kaW5nIHdyaXRlcyBmaW5pc2gsIG90aGVyd2lzZSB0aGUgc2VsZWN0aW9uIGluIGB1cGRhdGVGb3JUZXN0U3ViamVjdGBcblx0XHQvLyBjYW4gaGFwcGVuIGJlZm9yZSB0aGUgbWFya2VycyBhcmUgcHJvY2Vzc2VkLlxuXHRcdGlmIChwZW5kaW5nV3JpdGVzLnZhbHVlID4gMCkge1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGwgPSBwZW5kaW5nV3JpdGVzLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdFx0XHRpZiAocGVuZGluZ1dyaXRlcy52YWx1ZSA9PT0gMCkge1xuXHRcdFx0XHRcdFx0bC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0ZXJtaW5hbDtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ3dkKHRlc3RVcmk/OiBVUkkpIHtcblx0XHRjb25zdCB3ZiA9ICh0ZXN0VXJpICYmIHRoaXMud29ya3NwYWNlQ29udGV4dC5nZXRXb3Jrc3BhY2VGb2xkZXIodGVzdFVyaSkpXG5cdFx0XHR8fCB0aGlzLndvcmtzcGFjZUNvbnRleHQuZ2V0V29ya3NwYWNlKCkuZm9sZGVyc1swXTtcblx0XHRpZiAod2YpIHtcblx0XHRcdHRoaXMudGVybWluYWxDd2QudmFsdWUgPSB3Zi51cmkuZnNQYXRoO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgd3JpdGVOb3RpY2UodGVybWluYWw6IElEZXRhY2hlZFRlcm1pbmFsSW5zdGFuY2UsIHN0cjogc3RyaW5nKSB7XG5cdFx0dGVybWluYWwueHRlcm0ud3JpdGUoZm9ybWF0TWVzc2FnZUZvclRlcm1pbmFsKHN0cikpO1xuXHR9XG5cblx0cHJpdmF0ZSBhdHRhY2hUZXJtaW5hbFRvRG9tKHRlcm1pbmFsOiBJRGV0YWNoZWRUZXJtaW5hbEluc3RhbmNlKSB7XG5cdFx0dGVybWluYWwueHRlcm0ud3JpdGUoJ1xceDFiWz8yNWwnKTsgLy8gaGlkZSBjdXJzb3Jcblx0XHRkb20uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShkb20uZ2V0V2luZG93KHRoaXMuY29udGFpbmVyKSwgKCkgPT4gdGhpcy5sYXlvdXRUZXJtaW5hbCh0ZXJtaW5hbCkpO1xuXHRcdHRlcm1pbmFsLmF0dGFjaFRvRWxlbWVudCh0aGlzLmNvbnRhaW5lciwgeyBlbmFibGVHcHU6IGZhbHNlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpIHtcblx0XHR0aGlzLm91dHB1dERhdGFMaXN0ZW5lci5jbGVhcigpO1xuXHRcdHRoaXMueHRlcm1MYXlvdXREZWxheWVyLmNhbmNlbCgpO1xuXHRcdHRoaXMudGVybWluYWwuY2xlYXIoKTtcblx0fVxuXG5cdHB1YmxpYyBsYXlvdXQoZGltZW5zaW9uczogZG9tLklEaW1lbnNpb24pIHtcblx0XHR0aGlzLmRpbWVuc2lvbnMgPSBkaW1lbnNpb25zO1xuXHRcdGlmICh0aGlzLnRlcm1pbmFsLnZhbHVlKSB7XG5cdFx0XHR0aGlzLmxheW91dFRlcm1pbmFsKHRoaXMudGVybWluYWwudmFsdWUsIGRpbWVuc2lvbnMud2lkdGgsIGRpbWVuc2lvbnMuaGVpZ2h0KTtcblx0XHRcdHJldHVybiBkaW1lbnNpb25zLmhlaWdodDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBsYXlvdXRUZXJtaW5hbChcblx0XHR7IHh0ZXJtIH06IElEZXRhY2hlZFRlcm1pbmFsSW5zdGFuY2UsXG5cdFx0d2lkdGggPSB0aGlzLmRpbWVuc2lvbnM/LndpZHRoID8/IHRoaXMuY29udGFpbmVyLmNsaWVudFdpZHRoLFxuXHRcdGhlaWdodCA9IHRoaXMuZGltZW5zaW9ucz8uaGVpZ2h0ID8/IHRoaXMuY29udGFpbmVyLmNsaWVudEhlaWdodFxuXHQpIHtcblx0XHR3aWR0aCAtPSAxMCArIDIwOyAvLyBzY3JvbGxiYXIgd2lkdGggKyBtYXJnaW5cblx0XHR0aGlzLnh0ZXJtTGF5b3V0RGVsYXllci50cmlnZ2VyKCgpID0+IHtcblx0XHRcdGNvbnN0IHNjYWxlZCA9IGdldFh0ZXJtU2NhbGVkRGltZW5zaW9ucyhkb20uZ2V0V2luZG93KHRoaXMuY29udGFpbmVyKSwgeHRlcm0uZ2V0Rm9udCgpLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRcdGlmIChzY2FsZWQpIHtcblx0XHRcdFx0eHRlcm0ucmVzaXplKHNjYWxlZC5jb2xzLCBzY2FsZWQucm93cyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY29uc3QgaXNNdWx0aWxpbmUgPSAoc3RyOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+ICEhc3RyICYmIHN0ci5pbmNsdWRlcygnXFxuJyk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGVBQWU7QUFFeEIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsWUFBWTtBQUNyQixTQUFTLFlBQVksaUJBQTBDLG1CQUFtQixvQkFBb0Isb0JBQW9CO0FBRzFILFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsd0JBQXdCO0FB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
