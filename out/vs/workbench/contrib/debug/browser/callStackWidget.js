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
import * as dom from "../../../../base/browser/dom.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { assertNever } from "../../../../base/common/assert.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, observableValue, transaction } from "../../../../base/common/observable.js";
import { Constants } from "../../../../base/common/uint.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { EditorContributionInstantiation } from "../../../../editor/browser/editorExtensions.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ClickLinkGesture } from "../../../../editor/contrib/gotoSymbol/browser/link/clickLinkGesture.js";
import { localize, localize2 } from "../../../../nls.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { TextEditorSelectionRevealType } from "../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { ResourceLabel } from "../../../browser/labels.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { makeStackFrameColumnDecoration, TOP_STACK_FRAME_DECORATION } from "./callStackEditorContribution.js";
import "./media/callStackWidget.css";
class CallStackFrame {
  constructor(name, source, line = 1, column = 1) {
    this.name = name;
    this.source = source;
    this.line = line;
    this.column = column;
  }
}
class SkippedCallFrames {
  constructor(label, load) {
    this.label = label;
    this.load = load;
  }
}
class CustomStackFrame {
  constructor() {
    this.showHeader = observableValue("CustomStackFrame.showHeader", true);
  }
}
class WrappedCallStackFrame extends CallStackFrame {
  constructor(original) {
    super(original.name, original.source, original.line, original.column);
    this.editorHeight = observableValue("WrappedCallStackFrame.height", this.source ? 100 : 0);
    this.collapsed = observableValue("WrappedCallStackFrame.collapsed", false);
    this.height = derived((reader) => {
      return this.collapsed.read(reader) ? CALL_STACK_WIDGET_HEADER_HEIGHT : CALL_STACK_WIDGET_HEADER_HEIGHT + this.editorHeight.read(reader);
    });
  }
}
class WrappedCustomStackFrame {
  constructor(original) {
    this.original = original;
    this.collapsed = observableValue("WrappedCallStackFrame.collapsed", false);
    this.height = derived((reader) => {
      const headerHeight = this.original.showHeader.read(reader) ? CALL_STACK_WIDGET_HEADER_HEIGHT : 0;
      return this.collapsed.read(reader) ? headerHeight : headerHeight + this.original.height.read(reader);
    });
  }
}
const isFrameLike = (item) => item instanceof WrappedCallStackFrame || item instanceof WrappedCustomStackFrame;
const WIDGET_CLASS_NAME = "multiCallStackWidget";
let CallStackWidget = class extends Disposable {
  constructor(container, containingEditor, instantiationService) {
    super();
    this.layoutEmitter = this._register(new Emitter());
    this.currentFramesDs = this._register(new DisposableStore());
    container.classList.add(WIDGET_CLASS_NAME);
    this._register(toDisposable(() => container.classList.remove(WIDGET_CLASS_NAME)));
    this.list = this._register(instantiationService.createInstance(
      WorkbenchList,
      "TestResultStackWidget",
      container,
      new StackDelegate(),
      [
        instantiationService.createInstance(FrameCodeRenderer, containingEditor, this.layoutEmitter.event),
        instantiationService.createInstance(MissingCodeRenderer),
        instantiationService.createInstance(CustomRenderer),
        instantiationService.createInstance(SkippedRenderer, (i) => this.loadFrame(i))
      ],
      {
        multipleSelectionSupport: false,
        mouseSupport: false,
        keyboardSupport: false,
        setRowLineHeight: false,
        alwaysConsumeMouseWheel: false,
        accessibilityProvider: instantiationService.createInstance(StackAccessibilityProvider)
      }
    ));
  }
  get onDidChangeContentHeight() {
    return this.list.onDidChangeContentHeight;
  }
  get onDidScroll() {
    return this.list.onDidScroll;
  }
  get contentHeight() {
    return this.list.contentHeight;
  }
  /** Replaces the call frames display in the view. */
  setFrames(frames) {
    this.currentFramesDs.clear();
    this.cts = new CancellationTokenSource();
    this._register(toDisposable(() => this.cts.dispose(true)));
    this.list.splice(0, this.list.length, this.mapFrames(frames));
  }
  layout(height, width) {
    this.list.layout(height, width);
    this.layoutEmitter.fire();
  }
  collapseAll() {
    transaction((tx) => {
      for (let i = 0; i < this.list.length; i++) {
        const frame = this.list.element(i);
        if (isFrameLike(frame)) {
          frame.collapsed.set(true, tx);
        }
      }
    });
  }
  async loadFrame(replacing) {
    if (!this.cts) {
      return;
    }
    const frames = await replacing.load(this.cts.token);
    if (this.cts.token.isCancellationRequested) {
      return;
    }
    const index = this.list.indexOf(replacing);
    this.list.splice(index, 1, this.mapFrames(frames));
  }
  mapFrames(frames) {
    const result = [];
    for (const frame of frames) {
      if (frame instanceof SkippedCallFrames) {
        result.push(frame);
        continue;
      }
      const wrapped = frame instanceof CustomStackFrame ? new WrappedCustomStackFrame(frame) : new WrappedCallStackFrame(frame);
      result.push(wrapped);
      this.currentFramesDs.add(autorun((reader) => {
        const height = wrapped.height.read(reader);
        const idx = this.list.indexOf(wrapped);
        if (idx !== -1) {
          this.list.updateElementHeight(idx, height);
        }
      }));
    }
    return result;
  }
};
CallStackWidget = __decorateClass([
  __decorateParam(2, IInstantiationService)
], CallStackWidget);
let StackAccessibilityProvider = class {
  constructor(labelService) {
    this.labelService = labelService;
  }
  getAriaLabel(e) {
    if (e instanceof SkippedCallFrames) {
      return e.label;
    }
    if (e instanceof WrappedCustomStackFrame) {
      return e.original.label;
    }
    if (e instanceof CallStackFrame) {
      if (e.source && e.line) {
        return localize({
          comment: ["{0} is an extension-defined label, then line number and filename"],
          key: "stackTraceLabel"
        }, "{0}, line {1} in {2}", e.name, e.line, this.labelService.getUriLabel(e.source, { relative: true }));
      }
      return e.name;
    }
    assertNever(e);
  }
  getWidgetAriaLabel() {
    return localize("stackTrace", "Stack Trace");
  }
};
StackAccessibilityProvider = __decorateClass([
  __decorateParam(0, ILabelService)
], StackAccessibilityProvider);
class StackDelegate {
  getHeight(element) {
    if (element instanceof CallStackFrame || element instanceof WrappedCustomStackFrame) {
      return element.height.get();
    }
    if (element instanceof SkippedCallFrames) {
      return CALL_STACK_WIDGET_HEADER_HEIGHT;
    }
    assertNever(element);
  }
  getTemplateId(element) {
    if (element instanceof CallStackFrame) {
      return element.source ? FrameCodeRenderer.templateId : MissingCodeRenderer.templateId;
    }
    if (element instanceof SkippedCallFrames) {
      return SkippedRenderer.templateId;
    }
    if (element instanceof WrappedCustomStackFrame) {
      return CustomRenderer.templateId;
    }
    assertNever(element);
  }
}
const editorOptions = {
  scrollBeyondLastLine: false,
  scrollbar: {
    vertical: "hidden",
    horizontal: "hidden",
    handleMouseWheel: false,
    useShadows: false
  },
  overviewRulerLanes: 0,
  fixedOverflowWidgets: true,
  overviewRulerBorder: false,
  stickyScroll: { enabled: false },
  minimap: { enabled: false },
  readOnly: true,
  automaticLayout: false
};
const makeFrameElements = () => dom.h("div.multiCallStackFrame", [
  dom.h("div.header@header", [
    dom.h("div.collapse-button@collapseButton"),
    dom.h("div.title.show-file-icons@title"),
    dom.h("div.actions@actions")
  ]),
  dom.h("div.editorParent", [
    dom.h("div.editorContainer@editor")
  ])
]);
const CALL_STACK_WIDGET_HEADER_HEIGHT = 24;
let AbstractFrameRenderer = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
  }
  renderTemplate(container) {
    const elements = makeFrameElements();
    container.appendChild(elements.root);
    const templateStore = new DisposableStore();
    container.classList.add("multiCallStackFrameContainer");
    templateStore.add(toDisposable(() => {
      container.classList.remove("multiCallStackFrameContainer");
      elements.root.remove();
    }));
    const label = templateStore.add(this.instantiationService.createInstance(ResourceLabel, elements.title, {}));
    const collapse = templateStore.add(new Button(elements.collapseButton, {}));
    const contentId = generateUuid();
    elements.editor.id = contentId;
    elements.editor.role = "region";
    elements.collapseButton.setAttribute("aria-controls", contentId);
    return this.finishRenderTemplate({
      container,
      decorations: [],
      elements,
      label,
      collapse,
      elementStore: templateStore.add(new DisposableStore()),
      templateStore
    });
  }
  renderElement(element, index, template, height) {
    const { elementStore } = template;
    elementStore.clear();
    const item = element;
    this.setupCollapseButton(item, template);
  }
  setupCollapseButton(item, { elementStore, elements, collapse }) {
    elementStore.add(autorun((reader) => {
      collapse.element.className = "";
      const collapsed = item.collapsed.read(reader);
      collapse.icon = collapsed ? Codicon.chevronRight : Codicon.chevronDown;
      collapse.element.ariaExpanded = String(!collapsed);
      elements.root.classList.toggle("collapsed", collapsed);
    }));
    const toggleCollapse = () => item.collapsed.set(!item.collapsed.get(), void 0);
    elementStore.add(collapse.onDidClick(toggleCollapse));
    elementStore.add(dom.addDisposableListener(elements.title, "click", toggleCollapse));
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementStore.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateStore.dispose();
  }
};
AbstractFrameRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], AbstractFrameRenderer);
const CONTEXT_LINES = 2;
let FrameCodeRenderer = class extends AbstractFrameRenderer {
  constructor(containingEditor, onLayout, modelService, instantiationService) {
    super(instantiationService);
    this.containingEditor = containingEditor;
    this.onLayout = onLayout;
    this.modelService = modelService;
    this.templateId = FrameCodeRenderer.templateId;
  }
  finishRenderTemplate(data) {
    const contributions = [{
      id: ClickToLocationContribution.ID,
      instantiation: EditorContributionInstantiation.BeforeFirstInteraction,
      ctor: ClickToLocationContribution
    }];
    const editor = this.containingEditor ? this.instantiationService.createInstance(
      EmbeddedCodeEditorWidget,
      data.elements.editor,
      editorOptions,
      { isSimpleWidget: true, contributions },
      this.containingEditor
    ) : this.instantiationService.createInstance(
      CodeEditorWidget,
      data.elements.editor,
      editorOptions,
      { isSimpleWidget: true, contributions }
    );
    data.templateStore.add(editor);
    const toolbar = data.templateStore.add(this.instantiationService.createInstance(MenuWorkbenchToolBar, data.elements.actions, MenuId.DebugCallStackToolbar, {
      menuOptions: { shouldForwardArgs: true },
      actionViewItemProvider: (action, options) => createActionViewItem(this.instantiationService, action, options)
    }));
    return { ...data, editor, toolbar };
  }
  renderElement(element, index, template, height) {
    super.renderElement(element, index, template, height);
    const { elementStore, editor } = template;
    const item = element;
    const uri = item.source;
    template.label.element.setFile(uri);
    const cts = new CancellationTokenSource();
    elementStore.add(toDisposable(() => cts.dispose(true)));
    this.modelService.createModelReference(uri).then((reference) => {
      if (cts.token.isCancellationRequested) {
        return reference.dispose();
      }
      elementStore.add(reference);
      editor.setModel(reference.object.textEditorModel);
      this.setupEditorAfterModel(item, template);
      this.setupEditorLayout(item, template);
    });
  }
  setupEditorLayout(item, { elementStore, container, editor }) {
    const layout = () => {
      const prev = editor.getContentHeight();
      editor.layout({ width: container.clientWidth, height: prev });
      const next = editor.getContentHeight();
      if (next !== prev) {
        editor.layout({ width: container.clientWidth, height: next });
      }
      item.editorHeight.set(next, void 0);
    };
    elementStore.add(editor.onDidChangeModelDecorations(layout));
    elementStore.add(editor.onDidChangeModelContent(layout));
    elementStore.add(editor.onDidChangeModelOptions(layout));
    elementStore.add(this.onLayout(layout));
    layout();
  }
  setupEditorAfterModel(item, template) {
    const range = Range.fromPositions({
      column: item.column ?? 1,
      lineNumber: item.line ?? 1
    });
    template.toolbar.context = { uri: item.source, range };
    template.editor.setHiddenAreas([
      Range.fromPositions(
        { column: 1, lineNumber: 1 },
        { column: 1, lineNumber: Math.max(1, item.line - CONTEXT_LINES - 1) }
      ),
      Range.fromPositions(
        { column: 1, lineNumber: item.line + CONTEXT_LINES + 1 },
        { column: 1, lineNumber: Constants.MAX_SAFE_SMALL_INTEGER }
      )
    ]);
    template.editor.changeDecorations((accessor) => {
      for (const d of template.decorations) {
        accessor.removeDecoration(d);
      }
      template.decorations.length = 0;
      const beforeRange = range.setStartPosition(range.startLineNumber, 1);
      const hasCharactersBefore = !!template.editor.getModel()?.getValueInRange(beforeRange).trim();
      const decoRange = range.setEndPosition(range.startLineNumber, Constants.MAX_SAFE_SMALL_INTEGER);
      template.decorations.push(accessor.addDecoration(
        decoRange,
        makeStackFrameColumnDecoration(!hasCharactersBefore)
      ));
      template.decorations.push(accessor.addDecoration(
        decoRange,
        TOP_STACK_FRAME_DECORATION
      ));
    });
    item.editorHeight.set(template.editor.getContentHeight(), void 0);
  }
};
FrameCodeRenderer.templateId = "f";
FrameCodeRenderer = __decorateClass([
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IInstantiationService)
], FrameCodeRenderer);
let MissingCodeRenderer = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
    this.templateId = MissingCodeRenderer.templateId;
  }
  renderTemplate(container) {
    const elements = makeFrameElements();
    elements.root.classList.add("missing");
    container.appendChild(elements.root);
    const label = this.instantiationService.createInstance(ResourceLabel, elements.title, {});
    return { elements, label };
  }
  renderElement(element, _index, templateData) {
    const cast = element;
    templateData.label.element.setResource({
      name: cast.name,
      description: localize("stackFrameLocation", "Line {0} column {1}", cast.line, cast.column),
      range: { startLineNumber: cast.line, startColumn: cast.column, endColumn: cast.column, endLineNumber: cast.line }
    }, {
      icon: Codicon.fileBinary
    });
  }
  disposeTemplate(templateData) {
    templateData.label.dispose();
    templateData.elements.root.remove();
  }
};
MissingCodeRenderer.templateId = "m";
MissingCodeRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], MissingCodeRenderer);
const _CustomRenderer = class _CustomRenderer extends AbstractFrameRenderer {
  constructor() {
    super(...arguments);
    this.templateId = _CustomRenderer.templateId;
  }
  finishRenderTemplate(data) {
    return data;
  }
  renderElement(element, index, template, height) {
    super.renderElement(element, index, template, height);
    const item = element;
    const { elementStore, container, label } = template;
    label.element.setResource({ name: item.original.label }, { icon: item.original.icon });
    elementStore.add(autorun((reader) => {
      template.elements.header.style.display = item.original.showHeader.read(reader) ? "" : "none";
    }));
    elementStore.add(autorunWithStore((reader, store) => {
      if (!item.collapsed.read(reader)) {
        store.add(item.original.render(container));
      }
    }));
    const actions = item.original.renderActions?.(template.elements.actions);
    if (actions) {
      elementStore.add(actions);
    }
  }
};
_CustomRenderer.templateId = "c";
let CustomRenderer = _CustomRenderer;
let SkippedRenderer = class {
  constructor(loadFrames, notificationService) {
    this.loadFrames = loadFrames;
    this.notificationService = notificationService;
    this.templateId = SkippedRenderer.templateId;
  }
  renderTemplate(container) {
    const store = new DisposableStore();
    const button = new Button(container, { title: "", ...defaultButtonStyles });
    const data = { button, store };
    store.add(button);
    store.add(button.onDidClick(() => {
      if (!data.current || !button.enabled) {
        return;
      }
      button.enabled = false;
      this.loadFrames(data.current).catch((e) => {
        this.notificationService.error(localize("failedToLoadFrames", "Failed to load stack frames: {0}", e.message));
      });
    }));
    return data;
  }
  renderElement(element, index, templateData, height) {
    const cast = element;
    templateData.button.enabled = true;
    templateData.button.label = cast.label;
    templateData.current = cast;
  }
  disposeTemplate(templateData) {
    templateData.store.dispose();
  }
};
SkippedRenderer.templateId = "s";
SkippedRenderer = __decorateClass([
  __decorateParam(1, INotificationService)
], SkippedRenderer);
let ClickToLocationContribution = class extends Disposable {
  constructor(editor, editorService) {
    super();
    this.editor = editor;
    this.linkDecorations = editor.createDecorationsCollection();
    this._register(toDisposable(() => this.linkDecorations.clear()));
    const clickLinkGesture = this._register(new ClickLinkGesture(editor));
    this._register(clickLinkGesture.onMouseMoveOrRelevantKeyDown(([mouseEvent, keyboardEvent]) => {
      this.onMove(mouseEvent);
    }));
    this._register(clickLinkGesture.onExecute((e) => {
      const model = this.editor.getModel();
      if (!this.current || !model) {
        return;
      }
      editorService.openEditor({
        resource: model.uri,
        options: {
          selection: Range.fromPositions(new Position(this.current.line, this.current.word.startColumn)),
          selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport
        }
      }, e.hasSideBySideModifier ? SIDE_GROUP : void 0);
    }));
  }
  onMove(mouseEvent) {
    if (!mouseEvent.hasTriggerModifier) {
      return this.clear();
    }
    const position = mouseEvent.target.position;
    const word = position && this.editor.getModel()?.getWordAtPosition(position);
    if (!word) {
      return this.clear();
    }
    const prev = this.current?.word;
    if (prev && prev.startColumn === word.startColumn && prev.endColumn === word.endColumn && prev.word === word.word) {
      return;
    }
    this.current = { word, line: position.lineNumber };
    this.linkDecorations.set([{
      range: new Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
      options: {
        description: "call-stack-go-to-file-link",
        inlineClassName: "call-stack-go-to-file-link"
      }
    }]);
  }
  clear() {
    this.linkDecorations.clear();
    this.current = void 0;
  }
};
ClickToLocationContribution.ID = "clickToLocation";
ClickToLocationContribution = __decorateClass([
  __decorateParam(1, IEditorService)
], ClickToLocationContribution);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "callStackWidget.goToFile",
      title: localize2("goToFile", "Open File"),
      icon: Codicon.goToFile,
      menu: {
        id: MenuId.DebugCallStackToolbar,
        order: 22,
        group: "navigation"
      }
    });
  }
  async run(accessor, { uri, range }) {
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor({
      resource: uri,
      options: {
        selection: range,
        selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport
      }
    });
  }
});
export {
  CALL_STACK_WIDGET_HEADER_HEIGHT,
  CallStackFrame,
  CallStackWidget,
  CustomStackFrame,
  SkippedCallFrames
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2NhbGxTdGFja1dpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IElMaXN0UmVuZGVyZXIsIElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgYXNzZXJ0TmV2ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3NlcnQuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBhdXRvcnVuV2l0aFN0b3JlLCBkZXJpdmVkLCBJT2JzZXJ2YWJsZSwgSVNldHRhYmxlT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IENvbnN0YW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VpbnQuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRyaWJ1dGlvbkN0b3IsIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIElFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJV29yZEF0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvd29yZEhlbHBlci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uLCBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENsaWNrTGlua0dlc3R1cmUsIENsaWNrTGlua01vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9nb3RvU3ltYm9sL2Jyb3dzZXIvbGluay9jbGlja0xpbmtHZXN0dXJlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgTWVudVdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VMYWJlbCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IG1ha2VTdGFja0ZyYW1lQ29sdW1uRGVjb3JhdGlvbiwgVE9QX1NUQUNLX0ZSQU1FX0RFQ09SQVRJT04gfSBmcm9tICcuL2NhbGxTdGFja0VkaXRvckNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgJy4vbWVkaWEvY2FsbFN0YWNrV2lkZ2V0LmNzcyc7XG5cblxuZXhwb3J0IGNsYXNzIENhbGxTdGFja0ZyYW1lIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgc291cmNlPzogVVJJLFxuXHRcdHB1YmxpYyByZWFkb25seSBsaW5lID0gMSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgY29sdW1uID0gMSxcblx0KSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFNraXBwZWRDYWxsRnJhbWVzIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGxhYmVsOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlYWRvbmx5IGxvYWQ6ICh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IFByb21pc2U8QW55U3RhY2tGcmFtZVtdPixcblx0KSB7IH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEN1c3RvbVN0YWNrRnJhbWUge1xuXHRwdWJsaWMgcmVhZG9ubHkgc2hvd0hlYWRlciA9IG9ic2VydmFibGVWYWx1ZSgnQ3VzdG9tU3RhY2tGcmFtZS5zaG93SGVhZGVyJywgdHJ1ZSk7XG5cdHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSBoZWlnaHQ6IElPYnNlcnZhYmxlPG51bWJlcj47XG5cdHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSBsYWJlbDogc3RyaW5nO1xuXHRwdWJsaWMgaWNvbj86IFRoZW1lSWNvbjtcblx0cHVibGljIGFic3RyYWN0IHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogSURpc3Bvc2FibGU7XG5cdHB1YmxpYyByZW5kZXJBY3Rpb25zPyhjb250YWluZXI6IEhUTUxFbGVtZW50KTogSURpc3Bvc2FibGU7XG59XG5cbmV4cG9ydCB0eXBlIEFueVN0YWNrRnJhbWUgPSBTa2lwcGVkQ2FsbEZyYW1lcyB8IENhbGxTdGFja0ZyYW1lIHwgQ3VzdG9tU3RhY2tGcmFtZTtcblxuaW50ZXJmYWNlIElGcmFtZUxpa2VJdGVtIHtcblx0cmVhZG9ubHkgY29sbGFwc2VkOiBJU2V0dGFibGVPYnNlcnZhYmxlPGJvb2xlYW4+O1xuXHRyZWFkb25seSBoZWlnaHQ6IElPYnNlcnZhYmxlPG51bWJlcj47XG59XG5cbmNsYXNzIFdyYXBwZWRDYWxsU3RhY2tGcmFtZSBleHRlbmRzIENhbGxTdGFja0ZyYW1lIGltcGxlbWVudHMgSUZyYW1lTGlrZUl0ZW0ge1xuXHRwdWJsaWMgcmVhZG9ubHkgZWRpdG9ySGVpZ2h0ID0gb2JzZXJ2YWJsZVZhbHVlKCdXcmFwcGVkQ2FsbFN0YWNrRnJhbWUuaGVpZ2h0JywgdGhpcy5zb3VyY2UgPyAxMDAgOiAwKTtcblx0cHVibGljIHJlYWRvbmx5IGNvbGxhcHNlZCA9IG9ic2VydmFibGVWYWx1ZSgnV3JhcHBlZENhbGxTdGFja0ZyYW1lLmNvbGxhcHNlZCcsIGZhbHNlKTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaGVpZ2h0ID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdHJldHVybiB0aGlzLmNvbGxhcHNlZC5yZWFkKHJlYWRlcikgPyBDQUxMX1NUQUNLX1dJREdFVF9IRUFERVJfSEVJR0hUIDogQ0FMTF9TVEFDS19XSURHRVRfSEVBREVSX0hFSUdIVCArIHRoaXMuZWRpdG9ySGVpZ2h0LnJlYWQocmVhZGVyKTtcblx0fSk7XG5cblx0Y29uc3RydWN0b3Iob3JpZ2luYWw6IENhbGxTdGFja0ZyYW1lKSB7XG5cdFx0c3VwZXIob3JpZ2luYWwubmFtZSwgb3JpZ2luYWwuc291cmNlLCBvcmlnaW5hbC5saW5lLCBvcmlnaW5hbC5jb2x1bW4pO1xuXHR9XG59XG5cbmNsYXNzIFdyYXBwZWRDdXN0b21TdGFja0ZyYW1lIGltcGxlbWVudHMgSUZyYW1lTGlrZUl0ZW0ge1xuXHRwdWJsaWMgcmVhZG9ubHkgY29sbGFwc2VkID0gb2JzZXJ2YWJsZVZhbHVlKCdXcmFwcGVkQ2FsbFN0YWNrRnJhbWUuY29sbGFwc2VkJywgZmFsc2UpO1xuXG5cdHB1YmxpYyByZWFkb25seSBoZWlnaHQgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgaGVhZGVySGVpZ2h0ID0gdGhpcy5vcmlnaW5hbC5zaG93SGVhZGVyLnJlYWQocmVhZGVyKSA/IENBTExfU1RBQ0tfV0lER0VUX0hFQURFUl9IRUlHSFQgOiAwO1xuXHRcdHJldHVybiB0aGlzLmNvbGxhcHNlZC5yZWFkKHJlYWRlcikgPyBoZWFkZXJIZWlnaHQgOiBoZWFkZXJIZWlnaHQgKyB0aGlzLm9yaWdpbmFsLmhlaWdodC5yZWFkKHJlYWRlcik7XG5cdH0pO1xuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBvcmlnaW5hbDogQ3VzdG9tU3RhY2tGcmFtZSkgeyB9XG59XG5cbmNvbnN0IGlzRnJhbWVMaWtlID0gKGl0ZW06IHVua25vd24pOiBpdGVtIGlzIElGcmFtZUxpa2VJdGVtID0+XG5cdGl0ZW0gaW5zdGFuY2VvZiBXcmFwcGVkQ2FsbFN0YWNrRnJhbWUgfHwgaXRlbSBpbnN0YW5jZW9mIFdyYXBwZWRDdXN0b21TdGFja0ZyYW1lO1xuXG50eXBlIExpc3RJdGVtID0gV3JhcHBlZENhbGxTdGFja0ZyYW1lIHwgU2tpcHBlZENhbGxGcmFtZXMgfCBXcmFwcGVkQ3VzdG9tU3RhY2tGcmFtZTtcblxuY29uc3QgV0lER0VUX0NMQVNTX05BTUUgPSAnbXVsdGlDYWxsU3RhY2tXaWRnZXQnO1xuXG4vKipcbiAqIEEgcmV1c2FibGUgd2lkZ2V0IHRoYXQgZGlzcGxheXMgYSBjYWxsIHN0YWNrIGFzIGEgc2VyaWVzIG9mIGVkaXRvcnMuIE5vdGVcbiAqIHRoYXQgdGhpcyBib3RoIHVzZWQgaW4gZGVidWcncyBleGNlcHRpb24gd2lkZ2V0IGFzIHdlbGwgYXMgaW4gdGhlIHRlc3RpbmdcbiAqIGNhbGwgc3RhY2sgdmlldy5cbiAqL1xuZXhwb3J0IGNsYXNzIENhbGxTdGFja1dpZGdldCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IGxpc3Q6IFdvcmtiZW5jaExpc3Q8TGlzdEl0ZW0+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGxheW91dEVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBjdXJyZW50RnJhbWVzRHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIGN0cz86IENhbmNlbGxhdGlvblRva2VuU291cmNlO1xuXG5cdHB1YmxpYyBnZXQgb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLmxpc3Qub25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0O1xuXHR9XG5cblx0cHVibGljIGdldCBvbkRpZFNjcm9sbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5saXN0Lm9uRGlkU2Nyb2xsO1xuXHR9XG5cblx0cHVibGljIGdldCBjb250ZW50SGVpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLmxpc3QuY29udGVudEhlaWdodDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0Y29udGFpbmluZ0VkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoV0lER0VUX0NMQVNTX05BTUUpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiBjb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShXSURHRVRfQ0xBU1NfTkFNRSkpKTtcblxuXHRcdHRoaXMubGlzdCA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0V29ya2JlbmNoTGlzdCxcblx0XHRcdCdUZXN0UmVzdWx0U3RhY2tXaWRnZXQnLFxuXHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0bmV3IFN0YWNrRGVsZWdhdGUoKSxcblx0XHRcdFtcblx0XHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRnJhbWVDb2RlUmVuZGVyZXIsIGNvbnRhaW5pbmdFZGl0b3IsIHRoaXMubGF5b3V0RW1pdHRlci5ldmVudCksXG5cdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1pc3NpbmdDb2RlUmVuZGVyZXIpLFxuXHRcdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDdXN0b21SZW5kZXJlciksXG5cdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNraXBwZWRSZW5kZXJlciwgKGkpID0+IHRoaXMubG9hZEZyYW1lKGkpKSxcblx0XHRcdF0sXG5cdFx0XHR7XG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdG1vdXNlU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdGtleWJvYXJkU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdHNldFJvd0xpbmVIZWlnaHQ6IGZhbHNlLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3RhY2tBY2Nlc3NpYmlsaXR5UHJvdmlkZXIpLFxuXHRcdFx0fVxuXHRcdCkgYXMgV29ya2JlbmNoTGlzdDxMaXN0SXRlbT4pO1xuXHR9XG5cblx0LyoqIFJlcGxhY2VzIHRoZSBjYWxsIGZyYW1lcyBkaXNwbGF5IGluIHRoZSB2aWV3LiAqL1xuXHRwdWJsaWMgc2V0RnJhbWVzKGZyYW1lczogQW55U3RhY2tGcmFtZVtdKTogdm9pZCB7XG5cdFx0Ly8gY2FuY2VsIGFueSBleGlzdGluZyBsb2FkXG5cdFx0dGhpcy5jdXJyZW50RnJhbWVzRHMuY2xlYXIoKTtcblx0XHR0aGlzLmN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLmN0cyEuZGlzcG9zZSh0cnVlKSkpO1xuXG5cdFx0dGhpcy5saXN0LnNwbGljZSgwLCB0aGlzLmxpc3QubGVuZ3RoLCB0aGlzLm1hcEZyYW1lcyhmcmFtZXMpKTtcblx0fVxuXG5cdHB1YmxpYyBsYXlvdXQoaGVpZ2h0PzogbnVtYmVyLCB3aWR0aD86IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMubGlzdC5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0dGhpcy5sYXlvdXRFbWl0dGVyLmZpcmUoKTtcblx0fVxuXG5cdHB1YmxpYyBjb2xsYXBzZUFsbCgpIHtcblx0XHR0cmFuc2FjdGlvbih0eCA9PiB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGlzdC5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBmcmFtZSA9IHRoaXMubGlzdC5lbGVtZW50KGkpO1xuXHRcdFx0XHRpZiAoaXNGcmFtZUxpa2UoZnJhbWUpKSB7XG5cdFx0XHRcdFx0ZnJhbWUuY29sbGFwc2VkLnNldCh0cnVlLCB0eCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbG9hZEZyYW1lKHJlcGxhY2luZzogU2tpcHBlZENhbGxGcmFtZXMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuY3RzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnJhbWVzID0gYXdhaXQgcmVwbGFjaW5nLmxvYWQodGhpcy5jdHMudG9rZW4pO1xuXHRcdGlmICh0aGlzLmN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5saXN0LmluZGV4T2YocmVwbGFjaW5nKTtcblx0XHR0aGlzLmxpc3Quc3BsaWNlKGluZGV4LCAxLCB0aGlzLm1hcEZyYW1lcyhmcmFtZXMpKTtcblx0fVxuXG5cdHByaXZhdGUgbWFwRnJhbWVzKGZyYW1lczogQW55U3RhY2tGcmFtZVtdKTogTGlzdEl0ZW1bXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBMaXN0SXRlbVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBmcmFtZSBvZiBmcmFtZXMpIHtcblx0XHRcdGlmIChmcmFtZSBpbnN0YW5jZW9mIFNraXBwZWRDYWxsRnJhbWVzKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGZyYW1lKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHdyYXBwZWQgPSBmcmFtZSBpbnN0YW5jZW9mIEN1c3RvbVN0YWNrRnJhbWVcblx0XHRcdFx0PyBuZXcgV3JhcHBlZEN1c3RvbVN0YWNrRnJhbWUoZnJhbWUpIDogbmV3IFdyYXBwZWRDYWxsU3RhY2tGcmFtZShmcmFtZSk7XG5cdFx0XHRyZXN1bHQucHVzaCh3cmFwcGVkKTtcblxuXHRcdFx0dGhpcy5jdXJyZW50RnJhbWVzRHMuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdFx0Y29uc3QgaGVpZ2h0ID0gd3JhcHBlZC5oZWlnaHQucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBpZHggPSB0aGlzLmxpc3QuaW5kZXhPZih3cmFwcGVkKTtcblx0XHRcdFx0aWYgKGlkeCAhPT0gLTEpIHtcblx0XHRcdFx0XHR0aGlzLmxpc3QudXBkYXRlRWxlbWVudEhlaWdodChpZHgsIGhlaWdodCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmNsYXNzIFN0YWNrQWNjZXNzaWJpbGl0eVByb3ZpZGVyIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8TGlzdEl0ZW0+IHtcblx0Y29uc3RydWN0b3IoQElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UpIHsgfVxuXG5cdGdldEFyaWFMYWJlbChlOiBMaXN0SXRlbSk6IHN0cmluZyB8IElPYnNlcnZhYmxlPHN0cmluZz4gfCBudWxsIHtcblx0XHRpZiAoZSBpbnN0YW5jZW9mIFNraXBwZWRDYWxsRnJhbWVzKSB7XG5cdFx0XHRyZXR1cm4gZS5sYWJlbDtcblx0XHR9XG5cblx0XHRpZiAoZSBpbnN0YW5jZW9mIFdyYXBwZWRDdXN0b21TdGFja0ZyYW1lKSB7XG5cdFx0XHRyZXR1cm4gZS5vcmlnaW5hbC5sYWJlbDtcblx0XHR9XG5cblx0XHRpZiAoZSBpbnN0YW5jZW9mIENhbGxTdGFja0ZyYW1lKSB7XG5cdFx0XHRpZiAoZS5zb3VyY2UgJiYgZS5saW5lKSB7XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSh7XG5cdFx0XHRcdFx0Y29tbWVudDogWyd7MH0gaXMgYW4gZXh0ZW5zaW9uLWRlZmluZWQgbGFiZWwsIHRoZW4gbGluZSBudW1iZXIgYW5kIGZpbGVuYW1lJ10sXG5cdFx0XHRcdFx0a2V5OiAnc3RhY2tUcmFjZUxhYmVsJyxcblx0XHRcdFx0fSwgJ3swfSwgbGluZSB7MX0gaW4gezJ9JywgZS5uYW1lLCBlLmxpbmUsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGUuc291cmNlLCB7IHJlbGF0aXZlOiB0cnVlIH0pKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGUubmFtZTtcblx0XHR9XG5cblx0XHRhc3NlcnROZXZlcihlKTtcblx0fVxuXHRnZXRXaWRnZXRBcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ3N0YWNrVHJhY2UnLCAnU3RhY2sgVHJhY2UnKTtcblx0fVxufVxuXG5jbGFzcyBTdGFja0RlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8TGlzdEl0ZW0+IHtcblx0Z2V0SGVpZ2h0KGVsZW1lbnQ6IExpc3RJdGVtKTogbnVtYmVyIHtcblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIENhbGxTdGFja0ZyYW1lIHx8IGVsZW1lbnQgaW5zdGFuY2VvZiBXcmFwcGVkQ3VzdG9tU3RhY2tGcmFtZSkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQuaGVpZ2h0LmdldCgpO1xuXHRcdH1cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIFNraXBwZWRDYWxsRnJhbWVzKSB7XG5cdFx0XHRyZXR1cm4gQ0FMTF9TVEFDS19XSURHRVRfSEVBREVSX0hFSUdIVDtcblx0XHR9XG5cblx0XHRhc3NlcnROZXZlcihlbGVtZW50KTtcblx0fVxuXG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogTGlzdEl0ZW0pOiBzdHJpbmcge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQ2FsbFN0YWNrRnJhbWUpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LnNvdXJjZSA/IEZyYW1lQ29kZVJlbmRlcmVyLnRlbXBsYXRlSWQgOiBNaXNzaW5nQ29kZVJlbmRlcmVyLnRlbXBsYXRlSWQ7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgU2tpcHBlZENhbGxGcmFtZXMpIHtcblx0XHRcdHJldHVybiBTa2lwcGVkUmVuZGVyZXIudGVtcGxhdGVJZDtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBXcmFwcGVkQ3VzdG9tU3RhY2tGcmFtZSkge1xuXHRcdFx0cmV0dXJuIEN1c3RvbVJlbmRlcmVyLnRlbXBsYXRlSWQ7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0TmV2ZXIoZWxlbWVudCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElTdGFja1RlbXBsYXRlRGF0YSBleHRlbmRzIElBYnN0cmFjdEZyYW1lUmVuZGVyZXJUZW1wbGF0ZURhdGEge1xuXHRlZGl0b3I6IENvZGVFZGl0b3JXaWRnZXQ7XG5cdHRvb2xiYXI6IE1lbnVXb3JrYmVuY2hUb29sQmFyO1xufVxuXG5jb25zdCBlZGl0b3JPcHRpb25zOiBJRWRpdG9yT3B0aW9ucyA9IHtcblx0c2Nyb2xsQmV5b25kTGFzdExpbmU6IGZhbHNlLFxuXHRzY3JvbGxiYXI6IHtcblx0XHR2ZXJ0aWNhbDogJ2hpZGRlbicsXG5cdFx0aG9yaXpvbnRhbDogJ2hpZGRlbicsXG5cdFx0aGFuZGxlTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0dXNlU2hhZG93czogZmFsc2UsXG5cdH0sXG5cdG92ZXJ2aWV3UnVsZXJMYW5lczogMCxcblx0Zml4ZWRPdmVyZmxvd1dpZGdldHM6IHRydWUsXG5cdG92ZXJ2aWV3UnVsZXJCb3JkZXI6IGZhbHNlLFxuXHRzdGlja3lTY3JvbGw6IHsgZW5hYmxlZDogZmFsc2UgfSxcblx0bWluaW1hcDogeyBlbmFibGVkOiBmYWxzZSB9LFxuXHRyZWFkT25seTogdHJ1ZSxcblx0YXV0b21hdGljTGF5b3V0OiBmYWxzZSxcbn07XG5cbmNvbnN0IG1ha2VGcmFtZUVsZW1lbnRzID0gKCkgPT4gZG9tLmgoJ2Rpdi5tdWx0aUNhbGxTdGFja0ZyYW1lJywgW1xuXHRkb20uaCgnZGl2LmhlYWRlckBoZWFkZXInLCBbXG5cdFx0ZG9tLmgoJ2Rpdi5jb2xsYXBzZS1idXR0b25AY29sbGFwc2VCdXR0b24nKSxcblx0XHRkb20uaCgnZGl2LnRpdGxlLnNob3ctZmlsZS1pY29uc0B0aXRsZScpLFxuXHRcdGRvbS5oKCdkaXYuYWN0aW9uc0BhY3Rpb25zJyksXG5cdF0pLFxuXG5cdGRvbS5oKCdkaXYuZWRpdG9yUGFyZW50JywgW1xuXHRcdGRvbS5oKCdkaXYuZWRpdG9yQ29udGFpbmVyQGVkaXRvcicpLFxuXHRdKVxuXSk7XG5cbmV4cG9ydCBjb25zdCBDQUxMX1NUQUNLX1dJREdFVF9IRUFERVJfSEVJR0hUID0gMjQ7XG5cbmludGVyZmFjZSBJQWJzdHJhY3RGcmFtZVJlbmRlcmVyVGVtcGxhdGVEYXRhIHtcblx0Y29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0bGFiZWw6IFJlc291cmNlTGFiZWw7XG5cdGVsZW1lbnRzOiBSZXR1cm5UeXBlPHR5cGVvZiBtYWtlRnJhbWVFbGVtZW50cz47XG5cdGRlY29yYXRpb25zOiBzdHJpbmdbXTtcblx0Y29sbGFwc2U6IEJ1dHRvbjtcblx0ZWxlbWVudFN0b3JlOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHRlbXBsYXRlU3RvcmU6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RGcmFtZVJlbmRlcmVyPFQgZXh0ZW5kcyBJQWJzdHJhY3RGcmFtZVJlbmRlcmVyVGVtcGxhdGVEYXRhPiBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8TGlzdEl0ZW0sIFQ+IHtcblx0cHVibGljIGFic3RyYWN0IHRlbXBsYXRlSWQ6IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBUIHtcblx0XHRjb25zdCBlbGVtZW50cyA9IG1ha2VGcmFtZUVsZW1lbnRzKCk7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGVsZW1lbnRzLnJvb3QpO1xuXG5cblx0XHRjb25zdCB0ZW1wbGF0ZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdtdWx0aUNhbGxTdGFja0ZyYW1lQ29udGFpbmVyJyk7XG5cdFx0dGVtcGxhdGVTdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdtdWx0aUNhbGxTdGFja0ZyYW1lQ29udGFpbmVyJyk7XG5cdFx0XHRlbGVtZW50cy5yb290LnJlbW92ZSgpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGxhYmVsID0gdGVtcGxhdGVTdG9yZS5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZUxhYmVsLCBlbGVtZW50cy50aXRsZSwge30pKTtcblxuXHRcdGNvbnN0IGNvbGxhcHNlID0gdGVtcGxhdGVTdG9yZS5hZGQobmV3IEJ1dHRvbihlbGVtZW50cy5jb2xsYXBzZUJ1dHRvbiwge30pKTtcblxuXHRcdGNvbnN0IGNvbnRlbnRJZCA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdGVsZW1lbnRzLmVkaXRvci5pZCA9IGNvbnRlbnRJZDtcblx0XHRlbGVtZW50cy5lZGl0b3Iucm9sZSA9ICdyZWdpb24nO1xuXHRcdGVsZW1lbnRzLmNvbGxhcHNlQnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1jb250cm9scycsIGNvbnRlbnRJZCk7XG5cblx0XHRyZXR1cm4gdGhpcy5maW5pc2hSZW5kZXJUZW1wbGF0ZSh7XG5cdFx0XHRjb250YWluZXIsXG5cdFx0XHRkZWNvcmF0aW9uczogW10sXG5cdFx0XHRlbGVtZW50cyxcblx0XHRcdGxhYmVsLFxuXHRcdFx0Y29sbGFwc2UsXG5cdFx0XHRlbGVtZW50U3RvcmU6IHRlbXBsYXRlU3RvcmUuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSksXG5cdFx0XHR0ZW1wbGF0ZVN0b3JlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGZpbmlzaFJlbmRlclRlbXBsYXRlKGRhdGE6IElBYnN0cmFjdEZyYW1lUmVuZGVyZXJUZW1wbGF0ZURhdGEpOiBUO1xuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogTGlzdEl0ZW0sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlOiBULCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgZWxlbWVudFN0b3JlIH0gPSB0ZW1wbGF0ZTtcblx0XHRlbGVtZW50U3RvcmUuY2xlYXIoKTtcblx0XHRjb25zdCBpdGVtID0gZWxlbWVudCBhcyBJRnJhbWVMaWtlSXRlbTtcblxuXHRcdHRoaXMuc2V0dXBDb2xsYXBzZUJ1dHRvbihpdGVtLCB0ZW1wbGF0ZSk7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwQ29sbGFwc2VCdXR0b24oaXRlbTogSUZyYW1lTGlrZUl0ZW0sIHsgZWxlbWVudFN0b3JlLCBlbGVtZW50cywgY29sbGFwc2UgfTogVCkge1xuXHRcdGVsZW1lbnRTdG9yZS5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29sbGFwc2UuZWxlbWVudC5jbGFzc05hbWUgPSAnJztcblx0XHRcdGNvbnN0IGNvbGxhcHNlZCA9IGl0ZW0uY29sbGFwc2VkLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbGxhcHNlLmljb24gPSBjb2xsYXBzZWQgPyBDb2RpY29uLmNoZXZyb25SaWdodCA6IENvZGljb24uY2hldnJvbkRvd247XG5cdFx0XHRjb2xsYXBzZS5lbGVtZW50LmFyaWFFeHBhbmRlZCA9IFN0cmluZyghY29sbGFwc2VkKTtcblx0XHRcdGVsZW1lbnRzLnJvb3QuY2xhc3NMaXN0LnRvZ2dsZSgnY29sbGFwc2VkJywgY29sbGFwc2VkKTtcblx0XHR9KSk7XG5cdFx0Y29uc3QgdG9nZ2xlQ29sbGFwc2UgPSAoKSA9PiBpdGVtLmNvbGxhcHNlZC5zZXQoIWl0ZW0uY29sbGFwc2VkLmdldCgpLCB1bmRlZmluZWQpO1xuXHRcdGVsZW1lbnRTdG9yZS5hZGQoY29sbGFwc2Uub25EaWRDbGljayh0b2dnbGVDb2xsYXBzZSkpO1xuXHRcdGVsZW1lbnRTdG9yZS5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50cy50aXRsZSwgJ2NsaWNrJywgdG9nZ2xlQ29sbGFwc2UpKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IExpc3RJdGVtLCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IFQsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnRTdG9yZS5jbGVhcigpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogVCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS50ZW1wbGF0ZVN0b3JlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jb25zdCBDT05URVhUX0xJTkVTID0gMjtcblxuLyoqIFJlbmRlcmVyIGZvciBhIG5vcm1hbCBzdGFjayBmcmFtZSB3aGVyZSBjb2RlIGlzIGF2YWlsYWJsZS4gKi9cbmNsYXNzIEZyYW1lQ29kZVJlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RGcmFtZVJlbmRlcmVyPElTdGFja1RlbXBsYXRlRGF0YT4ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHRlbXBsYXRlSWQgPSAnZic7XG5cblx0cHVibGljIHJlYWRvbmx5IHRlbXBsYXRlSWQgPSBGcmFtZUNvZGVSZW5kZXJlci50ZW1wbGF0ZUlkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmluZ0VkaXRvcjogSUNvZGVFZGl0b3IgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBvbkxheW91dDogRXZlbnQ8dm9pZD4sXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBmaW5pc2hSZW5kZXJUZW1wbGF0ZShkYXRhOiBJQWJzdHJhY3RGcmFtZVJlbmRlcmVyVGVtcGxhdGVEYXRhKTogSVN0YWNrVGVtcGxhdGVEYXRhIHtcblx0XHQvLyBvdmVycmlkZSBkZWZhdWx0IGUuZy4gbGFuZ3VhZ2UgY29udHJpYnV0aW9ucywgb25seSBhbGxvdyB1c2VycyB0byBjbGlja1xuXHRcdC8vIG9uIGNvZGUgaW4gdGhlIGNhbGwgc3RhY2sgdG8gZ28gdG8gaXRzIHNvdXJjZSBsb2NhdGlvblxuXHRcdGNvbnN0IGNvbnRyaWJ1dGlvbnM6IElFZGl0b3JDb250cmlidXRpb25EZXNjcmlwdGlvbltdID0gW3tcblx0XHRcdGlkOiBDbGlja1RvTG9jYXRpb25Db250cmlidXRpb24uSUQsXG5cdFx0XHRpbnN0YW50aWF0aW9uOiBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkJlZm9yZUZpcnN0SW50ZXJhY3Rpb24sXG5cdFx0XHRjdG9yOiBDbGlja1RvTG9jYXRpb25Db250cmlidXRpb24gYXMgRWRpdG9yQ29udHJpYnV0aW9uQ3Rvcixcblx0XHR9XTtcblxuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuY29udGFpbmluZ0VkaXRvclxuXHRcdFx0PyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQsXG5cdFx0XHRcdGRhdGEuZWxlbWVudHMuZWRpdG9yLFxuXHRcdFx0XHRlZGl0b3JPcHRpb25zLFxuXHRcdFx0XHR7IGlzU2ltcGxlV2lkZ2V0OiB0cnVlLCBjb250cmlidXRpb25zIH0sXG5cdFx0XHRcdHRoaXMuY29udGFpbmluZ0VkaXRvcixcblx0XHRcdClcblx0XHRcdDogdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0Q29kZUVkaXRvcldpZGdldCxcblx0XHRcdFx0ZGF0YS5lbGVtZW50cy5lZGl0b3IsXG5cdFx0XHRcdGVkaXRvck9wdGlvbnMsXG5cdFx0XHRcdHsgaXNTaW1wbGVXaWRnZXQ6IHRydWUsIGNvbnRyaWJ1dGlvbnMgfSxcblx0XHRcdCk7XG5cblx0XHRkYXRhLnRlbXBsYXRlU3RvcmUuYWRkKGVkaXRvcik7XG5cblx0XHRjb25zdCB0b29sYmFyID0gZGF0YS50ZW1wbGF0ZVN0b3JlLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVXb3JrYmVuY2hUb29sQmFyLCBkYXRhLmVsZW1lbnRzLmFjdGlvbnMsIE1lbnVJZC5EZWJ1Z0NhbGxTdGFja1Rvb2xiYXIsIHtcblx0XHRcdG1lbnVPcHRpb25zOiB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0sXG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiBjcmVhdGVBY3Rpb25WaWV3SXRlbSh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCBhY3Rpb24sIG9wdGlvbnMpLFxuXHRcdH0pKTtcblxuXHRcdHJldHVybiB7IC4uLmRhdGEsIGVkaXRvciwgdG9vbGJhciB9O1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyRWxlbWVudChlbGVtZW50OiBMaXN0SXRlbSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGU6IElTdGFja1RlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZSwgaGVpZ2h0KTtcblxuXHRcdGNvbnN0IHsgZWxlbWVudFN0b3JlLCBlZGl0b3IgfSA9IHRlbXBsYXRlO1xuXG5cdFx0Y29uc3QgaXRlbSA9IGVsZW1lbnQgYXMgV3JhcHBlZENhbGxTdGFja0ZyYW1lO1xuXHRcdGNvbnN0IHVyaSA9IGl0ZW0uc291cmNlITtcblxuXHRcdHRlbXBsYXRlLmxhYmVsLmVsZW1lbnQuc2V0RmlsZSh1cmkpO1xuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdGVsZW1lbnRTdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cdFx0dGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UodXJpKS50aGVuKHJlZmVyZW5jZSA9PiB7XG5cdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybiByZWZlcmVuY2UuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRlbGVtZW50U3RvcmUuYWRkKHJlZmVyZW5jZSk7XG5cdFx0XHRlZGl0b3Iuc2V0TW9kZWwocmVmZXJlbmNlLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwpO1xuXHRcdFx0dGhpcy5zZXR1cEVkaXRvckFmdGVyTW9kZWwoaXRlbSwgdGVtcGxhdGUpO1xuXHRcdFx0dGhpcy5zZXR1cEVkaXRvckxheW91dChpdGVtLCB0ZW1wbGF0ZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwRWRpdG9yTGF5b3V0KGl0ZW06IFdyYXBwZWRDYWxsU3RhY2tGcmFtZSwgeyBlbGVtZW50U3RvcmUsIGNvbnRhaW5lciwgZWRpdG9yIH06IElTdGFja1RlbXBsYXRlRGF0YSkge1xuXHRcdGNvbnN0IGxheW91dCA9ICgpID0+IHtcblx0XHRcdGNvbnN0IHByZXYgPSBlZGl0b3IuZ2V0Q29udGVudEhlaWdodCgpO1xuXHRcdFx0ZWRpdG9yLmxheW91dCh7IHdpZHRoOiBjb250YWluZXIuY2xpZW50V2lkdGgsIGhlaWdodDogcHJldiB9KTtcblxuXHRcdFx0Y29uc3QgbmV4dCA9IGVkaXRvci5nZXRDb250ZW50SGVpZ2h0KCk7XG5cdFx0XHRpZiAobmV4dCAhPT0gcHJldikge1xuXHRcdFx0XHRlZGl0b3IubGF5b3V0KHsgd2lkdGg6IGNvbnRhaW5lci5jbGllbnRXaWR0aCwgaGVpZ2h0OiBuZXh0IH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpdGVtLmVkaXRvckhlaWdodC5zZXQobmV4dCwgdW5kZWZpbmVkKTtcblx0XHR9O1xuXHRcdGVsZW1lbnRTdG9yZS5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxEZWNvcmF0aW9ucyhsYXlvdXQpKTtcblx0XHRlbGVtZW50U3RvcmUuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudChsYXlvdXQpKTtcblx0XHRlbGVtZW50U3RvcmUuYWRkKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsT3B0aW9ucyhsYXlvdXQpKTtcblx0XHRlbGVtZW50U3RvcmUuYWRkKHRoaXMub25MYXlvdXQobGF5b3V0KSk7XG5cdFx0bGF5b3V0KCk7XG5cdH1cblxuXHRwcml2YXRlIHNldHVwRWRpdG9yQWZ0ZXJNb2RlbChpdGVtOiBXcmFwcGVkQ2FsbFN0YWNrRnJhbWUsIHRlbXBsYXRlOiBJU3RhY2tUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHRjb25zdCByYW5nZSA9IFJhbmdlLmZyb21Qb3NpdGlvbnMoe1xuXHRcdFx0Y29sdW1uOiBpdGVtLmNvbHVtbiA/PyAxLFxuXHRcdFx0bGluZU51bWJlcjogaXRlbS5saW5lID8/IDEsXG5cdFx0fSk7XG5cblx0XHR0ZW1wbGF0ZS50b29sYmFyLmNvbnRleHQgPSB7IHVyaTogaXRlbS5zb3VyY2UsIHJhbmdlIH07XG5cblx0XHR0ZW1wbGF0ZS5lZGl0b3Iuc2V0SGlkZGVuQXJlYXMoW1xuXHRcdFx0UmFuZ2UuZnJvbVBvc2l0aW9ucyhcblx0XHRcdFx0eyBjb2x1bW46IDEsIGxpbmVOdW1iZXI6IDEgfSxcblx0XHRcdFx0eyBjb2x1bW46IDEsIGxpbmVOdW1iZXI6IE1hdGgubWF4KDEsIGl0ZW0ubGluZSAtIENPTlRFWFRfTElORVMgLSAxKSB9LFxuXHRcdFx0KSxcblx0XHRcdFJhbmdlLmZyb21Qb3NpdGlvbnMoXG5cdFx0XHRcdHsgY29sdW1uOiAxLCBsaW5lTnVtYmVyOiBpdGVtLmxpbmUgKyBDT05URVhUX0xJTkVTICsgMSB9LFxuXHRcdFx0XHR7IGNvbHVtbjogMSwgbGluZU51bWJlcjogQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIgfSxcblx0XHRcdCksXG5cdFx0XSk7XG5cblx0XHR0ZW1wbGF0ZS5lZGl0b3IuY2hhbmdlRGVjb3JhdGlvbnMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBkIG9mIHRlbXBsYXRlLmRlY29yYXRpb25zKSB7XG5cdFx0XHRcdGFjY2Vzc29yLnJlbW92ZURlY29yYXRpb24oZCk7XG5cdFx0XHR9XG5cdFx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9ucy5sZW5ndGggPSAwO1xuXG5cdFx0XHRjb25zdCBiZWZvcmVSYW5nZSA9IHJhbmdlLnNldFN0YXJ0UG9zaXRpb24ocmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxKTtcblx0XHRcdGNvbnN0IGhhc0NoYXJhY3RlcnNCZWZvcmUgPSAhIXRlbXBsYXRlLmVkaXRvci5nZXRNb2RlbCgpPy5nZXRWYWx1ZUluUmFuZ2UoYmVmb3JlUmFuZ2UpLnRyaW0oKTtcblx0XHRcdGNvbnN0IGRlY29SYW5nZSA9IHJhbmdlLnNldEVuZFBvc2l0aW9uKHJhbmdlLnN0YXJ0TGluZU51bWJlciwgQ29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIpO1xuXG5cdFx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9ucy5wdXNoKGFjY2Vzc29yLmFkZERlY29yYXRpb24oXG5cdFx0XHRcdGRlY29SYW5nZSxcblx0XHRcdFx0bWFrZVN0YWNrRnJhbWVDb2x1bW5EZWNvcmF0aW9uKCFoYXNDaGFyYWN0ZXJzQmVmb3JlKSxcblx0XHRcdCkpO1xuXHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbnMucHVzaChhY2Nlc3Nvci5hZGREZWNvcmF0aW9uKFxuXHRcdFx0XHRkZWNvUmFuZ2UsXG5cdFx0XHRcdFRPUF9TVEFDS19GUkFNRV9ERUNPUkFUSU9OLFxuXHRcdFx0KSk7XG5cdFx0fSk7XG5cblx0XHRpdGVtLmVkaXRvckhlaWdodC5zZXQodGVtcGxhdGUuZWRpdG9yLmdldENvbnRlbnRIZWlnaHQoKSwgdW5kZWZpbmVkKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgSU1pc3NpbmdUZW1wbGF0ZURhdGEge1xuXHRlbGVtZW50czogUmV0dXJuVHlwZTx0eXBlb2YgbWFrZUZyYW1lRWxlbWVudHM+O1xuXHRsYWJlbDogUmVzb3VyY2VMYWJlbDtcbn1cblxuLyoqIFJlbmRlcmVyIGZvciBhIGNhbGwgZnJhbWUgdGhhdCdzIG1pc3NpbmcgYSBVUkkgKi9cbmNsYXNzIE1pc3NpbmdDb2RlUmVuZGVyZXIgaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPExpc3RJdGVtLCBJTWlzc2luZ1RlbXBsYXRlRGF0YT4ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHRlbXBsYXRlSWQgPSAnbSc7XG5cdHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZUlkID0gTWlzc2luZ0NvZGVSZW5kZXJlci50ZW1wbGF0ZUlkO1xuXG5cdGNvbnN0cnVjdG9yKEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKSB7IH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSU1pc3NpbmdUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGVsZW1lbnRzID0gbWFrZUZyYW1lRWxlbWVudHMoKTtcblx0XHRlbGVtZW50cy5yb290LmNsYXNzTGlzdC5hZGQoJ21pc3NpbmcnKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZWxlbWVudHMucm9vdCk7XG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlTGFiZWwsIGVsZW1lbnRzLnRpdGxlLCB7fSk7XG5cdFx0cmV0dXJuIHsgZWxlbWVudHMsIGxhYmVsIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IExpc3RJdGVtLCBfaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJTWlzc2luZ1RlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdGNvbnN0IGNhc3QgPSBlbGVtZW50IGFzIENhbGxTdGFja0ZyYW1lO1xuXHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5lbGVtZW50LnNldFJlc291cmNlKHtcblx0XHRcdG5hbWU6IGNhc3QubmFtZSxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc3RhY2tGcmFtZUxvY2F0aW9uJywgJ0xpbmUgezB9IGNvbHVtbiB7MX0nLCBjYXN0LmxpbmUsIGNhc3QuY29sdW1uKSxcblx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogY2FzdC5saW5lLCBzdGFydENvbHVtbjogY2FzdC5jb2x1bW4sIGVuZENvbHVtbjogY2FzdC5jb2x1bW4sIGVuZExpbmVOdW1iZXI6IGNhc3QubGluZSB9LFxuXHRcdH0sIHtcblx0XHRcdGljb246IENvZGljb24uZmlsZUJpbmFyeSxcblx0XHR9KTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElNaXNzaW5nVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmRpc3Bvc2UoKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudHMucm9vdC5yZW1vdmUoKTtcblx0fVxufVxuXG4vKiogUmVuZGVyZXIgZm9yIGEgY2FsbCBmcmFtZSB0aGF0J3MgbWlzc2luZyBhIFVSSSAqL1xuY2xhc3MgQ3VzdG9tUmVuZGVyZXIgZXh0ZW5kcyBBYnN0cmFjdEZyYW1lUmVuZGVyZXI8SUFic3RyYWN0RnJhbWVSZW5kZXJlclRlbXBsYXRlRGF0YT4ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHRlbXBsYXRlSWQgPSAnYyc7XG5cdHB1YmxpYyByZWFkb25seSB0ZW1wbGF0ZUlkID0gQ3VzdG9tUmVuZGVyZXIudGVtcGxhdGVJZDtcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZmluaXNoUmVuZGVyVGVtcGxhdGUoZGF0YTogSUFic3RyYWN0RnJhbWVSZW5kZXJlclRlbXBsYXRlRGF0YSk6IElBYnN0cmFjdEZyYW1lUmVuZGVyZXJUZW1wbGF0ZURhdGEge1xuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyRWxlbWVudChlbGVtZW50OiBMaXN0SXRlbSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGU6IElBYnN0cmFjdEZyYW1lUmVuZGVyZXJUZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyRWxlbWVudChlbGVtZW50LCBpbmRleCwgdGVtcGxhdGUsIGhlaWdodCk7XG5cblx0XHRjb25zdCBpdGVtID0gZWxlbWVudCBhcyBXcmFwcGVkQ3VzdG9tU3RhY2tGcmFtZTtcblx0XHRjb25zdCB7IGVsZW1lbnRTdG9yZSwgY29udGFpbmVyLCBsYWJlbCB9ID0gdGVtcGxhdGU7XG5cblx0XHRsYWJlbC5lbGVtZW50LnNldFJlc291cmNlKHsgbmFtZTogaXRlbS5vcmlnaW5hbC5sYWJlbCB9LCB7IGljb246IGl0ZW0ub3JpZ2luYWwuaWNvbiB9KTtcblxuXHRcdGVsZW1lbnRTdG9yZS5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0dGVtcGxhdGUuZWxlbWVudHMuaGVhZGVyLnN0eWxlLmRpc3BsYXkgPSBpdGVtLm9yaWdpbmFsLnNob3dIZWFkZXIucmVhZChyZWFkZXIpID8gJycgOiAnbm9uZSc7XG5cdFx0fSkpO1xuXG5cdFx0ZWxlbWVudFN0b3JlLmFkZChhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRpZiAoIWl0ZW0uY29sbGFwc2VkLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0XHRzdG9yZS5hZGQoaXRlbS5vcmlnaW5hbC5yZW5kZXIoY29udGFpbmVyKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgYWN0aW9ucyA9IGl0ZW0ub3JpZ2luYWwucmVuZGVyQWN0aW9ucz8uKHRlbXBsYXRlLmVsZW1lbnRzLmFjdGlvbnMpO1xuXHRcdGlmIChhY3Rpb25zKSB7XG5cdFx0XHRlbGVtZW50U3RvcmUuYWRkKGFjdGlvbnMpO1xuXHRcdH1cblx0fVxufVxuXG5pbnRlcmZhY2UgSVNraXBwZWRUZW1wbGF0ZURhdGEge1xuXHRidXR0b246IEJ1dHRvbjtcblx0Y3VycmVudD86IFNraXBwZWRDYWxsRnJhbWVzO1xuXHRzdG9yZTogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG4vKiogUmVuZGVyZXIgZm9yIGEgYnV0dG9uIHRvIGxvYWQgbW9yZSBjYWxsIGZyYW1lcyAqL1xuY2xhc3MgU2tpcHBlZFJlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxMaXN0SXRlbSwgSVNraXBwZWRUZW1wbGF0ZURhdGE+IHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSB0ZW1wbGF0ZUlkID0gJ3MnO1xuXHRwdWJsaWMgcmVhZG9ubHkgdGVtcGxhdGVJZCA9IFNraXBwZWRSZW5kZXJlci50ZW1wbGF0ZUlkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9hZEZyYW1lczogKGZyb21JdGVtOiBTa2lwcGVkQ2FsbEZyYW1lcykgPT4gUHJvbWlzZTx2b2lkPixcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0KSB7IH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVNraXBwZWRUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGJ1dHRvbiA9IG5ldyBCdXR0b24oY29udGFpbmVyLCB7IHRpdGxlOiAnJywgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KTtcblx0XHRjb25zdCBkYXRhOiBJU2tpcHBlZFRlbXBsYXRlRGF0YSA9IHsgYnV0dG9uLCBzdG9yZSB9O1xuXG5cdFx0c3RvcmUuYWRkKGJ1dHRvbik7XG5cdFx0c3RvcmUuYWRkKGJ1dHRvbi5vbkRpZENsaWNrKCgpID0+IHtcblx0XHRcdGlmICghZGF0YS5jdXJyZW50IHx8ICFidXR0b24uZW5hYmxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGJ1dHRvbi5lbmFibGVkID0gZmFsc2U7XG5cdFx0XHR0aGlzLmxvYWRGcmFtZXMoZGF0YS5jdXJyZW50KS5jYXRjaChlID0+IHtcblx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGxvY2FsaXplKCdmYWlsZWRUb0xvYWRGcmFtZXMnLCAnRmFpbGVkIHRvIGxvYWQgc3RhY2sgZnJhbWVzOiB7MH0nLCBlLm1lc3NhZ2UpKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiBkYXRhO1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBMaXN0SXRlbSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJU2tpcHBlZFRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBjYXN0ID0gZWxlbWVudCBhcyBTa2lwcGVkQ2FsbEZyYW1lcztcblx0XHR0ZW1wbGF0ZURhdGEuYnV0dG9uLmVuYWJsZWQgPSB0cnVlO1xuXHRcdHRlbXBsYXRlRGF0YS5idXR0b24ubGFiZWwgPSBjYXN0LmxhYmVsO1xuXHRcdHRlbXBsYXRlRGF0YS5jdXJyZW50ID0gY2FzdDtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElTa2lwcGVkVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnN0b3JlLmRpc3Bvc2UoKTtcblx0fVxufVxuXG4vKiogQSBzaW1wbGUgY29udHJpYnV0aW9uIHRoYXQgbWFrZXMgYWxsIGRhdGEgaW4gdGhlIGVkaXRvciBjbGlja2FibGUgdG8gZ28gdG8gdGhlIGxvY2F0aW9uICovXG5jbGFzcyBDbGlja1RvTG9jYXRpb25Db250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnY2xpY2tUb0xvY2F0aW9uJztcblx0cHJpdmF0ZSByZWFkb25seSBsaW5rRGVjb3JhdGlvbnM6IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb247XG5cdHByaXZhdGUgY3VycmVudDogeyBsaW5lOiBudW1iZXI7IHdvcmQ6IElXb3JkQXRQb3NpdGlvbiB9IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5saW5rRGVjb3JhdGlvbnMgPSBlZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMubGlua0RlY29yYXRpb25zLmNsZWFyKCkpKTtcblxuXHRcdGNvbnN0IGNsaWNrTGlua0dlc3R1cmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2xpY2tMaW5rR2VzdHVyZShlZGl0b3IpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNsaWNrTGlua0dlc3R1cmUub25Nb3VzZU1vdmVPclJlbGV2YW50S2V5RG93bigoW21vdXNlRXZlbnQsIGtleWJvYXJkRXZlbnRdKSA9PiB7XG5cdFx0XHR0aGlzLm9uTW92ZShtb3VzZUV2ZW50KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY2xpY2tMaW5rR2VzdHVyZS5vbkV4ZWN1dGUoKGUpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGlmICghdGhpcy5jdXJyZW50IHx8ICFtb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdHJlc291cmNlOiBtb2RlbC51cmksXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRzZWxlY3Rpb246IFJhbmdlLmZyb21Qb3NpdGlvbnMobmV3IFBvc2l0aW9uKHRoaXMuY3VycmVudC5saW5lLCB0aGlzLmN1cnJlbnQud29yZC5zdGFydENvbHVtbikpLFxuXHRcdFx0XHRcdHNlbGVjdGlvblJldmVhbFR5cGU6IFRleHRFZGl0b3JTZWxlY3Rpb25SZXZlYWxUeXBlLkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0LFxuXHRcdFx0XHR9LFxuXHRcdFx0fSwgZS5oYXNTaWRlQnlTaWRlTW9kaWZpZXIgPyBTSURFX0dST1VQIDogdW5kZWZpbmVkKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIG9uTW92ZShtb3VzZUV2ZW50OiBDbGlja0xpbmtNb3VzZUV2ZW50KSB7XG5cdFx0aWYgKCFtb3VzZUV2ZW50Lmhhc1RyaWdnZXJNb2RpZmllcikge1xuXHRcdFx0cmV0dXJuIHRoaXMuY2xlYXIoKTtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IG1vdXNlRXZlbnQudGFyZ2V0LnBvc2l0aW9uO1xuXHRcdGNvbnN0IHdvcmQgPSBwb3NpdGlvbiAmJiB0aGlzLmVkaXRvci5nZXRNb2RlbCgpPy5nZXRXb3JkQXRQb3NpdGlvbihwb3NpdGlvbik7XG5cdFx0aWYgKCF3b3JkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jbGVhcigpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByZXYgPSB0aGlzLmN1cnJlbnQ/LndvcmQ7XG5cdFx0aWYgKHByZXYgJiYgcHJldi5zdGFydENvbHVtbiA9PT0gd29yZC5zdGFydENvbHVtbiAmJiBwcmV2LmVuZENvbHVtbiA9PT0gd29yZC5lbmRDb2x1bW4gJiYgcHJldi53b3JkID09PSB3b3JkLndvcmQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmN1cnJlbnQgPSB7IHdvcmQsIGxpbmU6IHBvc2l0aW9uLmxpbmVOdW1iZXIgfTtcblx0XHR0aGlzLmxpbmtEZWNvcmF0aW9ucy5zZXQoW3tcblx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgd29yZC5zdGFydENvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgd29yZC5lbmRDb2x1bW4pLFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogJ2NhbGwtc3RhY2stZ28tdG8tZmlsZS1saW5rJyxcblx0XHRcdFx0aW5saW5lQ2xhc3NOYW1lOiAnY2FsbC1zdGFjay1nby10by1maWxlLWxpbmsnLFxuXHRcdFx0fSxcblx0XHR9XSk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyKCkge1xuXHRcdHRoaXMubGlua0RlY29yYXRpb25zLmNsZWFyKCk7XG5cdFx0dGhpcy5jdXJyZW50ID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2NhbGxTdGFja1dpZGdldC5nb1RvRmlsZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdnb1RvRmlsZScsICdPcGVuIEZpbGUnKSxcblx0XHRcdGljb246IENvZGljb24uZ29Ub0ZpbGUsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRGVidWdDYWxsU3RhY2tUb29sYmFyLFxuXHRcdFx0XHRvcmRlcjogMjIsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCB7IHVyaSwgcmFuZ2UgfTogTG9jYXRpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0cmVzb3VyY2U6IHVyaSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0c2VsZWN0aW9uOiByYW5nZSxcblx0XHRcdFx0c2VsZWN0aW9uUmV2ZWFsVHlwZTogVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUuQ2VudGVySWZPdXRzaWRlVmlld3BvcnQsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsY0FBYztBQUd2QixTQUFTLG1CQUFtQjtBQUM1QixTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsU0FBUyxTQUFTLGtCQUFrQixTQUEyQyxpQkFBaUIsbUJBQW1CO0FBRW5ILFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQWlDLHVDQUF1RTtBQUN4RyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdDQUFnQztBQUV6QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFJdEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx3QkFBNkM7QUFDdEQsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyw2QkFBK0M7QUFDeEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0Isa0JBQWtCO0FBQzNDLFNBQVMsZ0NBQWdDLGtDQUFrQztBQUMzRSxPQUFPO0FBR0EsTUFBTSxl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
