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
import "./editorDictation.css";
import { localize, localize2 } from "../../../../../nls.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ContentWidgetPositionPreference } from "../../../../../editor/browser/editorBrowser.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { HasSpeechProvider, ISpeechService, SpeechToTextInProgress, SpeechToTextStatus } from "../../../speech/common/speechService.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { EditorOption } from "../../../../../editor/common/config/editorOptions.js";
import { EditorAction2, EditorContributionInstantiation, registerEditorContribution } from "../../../../../editor/browser/editorExtensions.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { EditOperation } from "../../../../../editor/common/core/editOperation.js";
import { Selection } from "../../../../../editor/common/core/selection.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { assertIsDefined } from "../../../../../base/common/types.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { toAction } from "../../../../../base/common/actions.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isWindows } from "../../../../../base/common/platform.js";
const EDITOR_DICTATION_IN_PROGRESS = new RawContextKey("editorDictation.inProgress", false);
const VOICE_CATEGORY = localize2("voiceCategory", "Voice");
class EditorDictationStartAction extends EditorAction2 {
  constructor() {
    super({
      id: "workbench.action.editorDictation.start",
      title: localize2("startDictation", "Start Dictation in Editor"),
      category: VOICE_CATEGORY,
      precondition: ContextKeyExpr.and(
        HasSpeechProvider,
        SpeechToTextInProgress.toNegated(),
        // disable when any speech-to-text is in progress
        EditorContextKeys.readOnly.toNegated()
        // disable in read-only editors
      ),
      f1: true,
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyV,
        weight: KeybindingWeight.WorkbenchContrib,
        secondary: isWindows ? [
          KeyMod.Alt | KeyCode.Backquote
        ] : void 0
      }
    });
  }
  runEditorCommand(accessor, editor) {
    const keybindingService = accessor.get(IKeybindingService);
    const holdMode = keybindingService.enableKeybindingHoldMode(this.desc.id);
    if (holdMode) {
      let shouldCallStop = false;
      const handle = setTimeout(() => {
        shouldCallStop = true;
      }, 500);
      holdMode.finally(() => {
        clearTimeout(handle);
        if (shouldCallStop) {
          EditorDictation.get(editor)?.stop();
        }
      });
    }
    EditorDictation.get(editor)?.start();
  }
}
const _EditorDictationStopAction = class _EditorDictationStopAction extends EditorAction2 {
  constructor() {
    super({
      id: _EditorDictationStopAction.ID,
      title: localize2("stopDictation", "Stop Dictation in Editor"),
      category: VOICE_CATEGORY,
      precondition: EDITOR_DICTATION_IN_PROGRESS,
      f1: true,
      keybinding: {
        primary: KeyCode.Escape,
        weight: KeybindingWeight.WorkbenchContrib + 100
      }
    });
  }
  runEditorCommand(_accessor, editor) {
    EditorDictation.get(editor)?.stop();
  }
};
_EditorDictationStopAction.ID = "workbench.action.editorDictation.stop";
let EditorDictationStopAction = _EditorDictationStopAction;
class DictationWidget extends Disposable {
  constructor(editor, keybindingService) {
    super();
    this.editor = editor;
    this.suppressMouseDown = true;
    this.allowEditorOverflow = true;
    this.domNode = document.createElement("div");
    const actionBar = this._register(new ActionBar(this.domNode));
    const stopActionKeybinding = keybindingService.lookupKeybinding(EditorDictationStopAction.ID)?.getLabel();
    actionBar.push(toAction({
      id: EditorDictationStopAction.ID,
      label: stopActionKeybinding ? localize("stopDictationShort1", "Stop Dictation ({0})", stopActionKeybinding) : localize("stopDictationShort2", "Stop Dictation"),
      class: ThemeIcon.asClassName(Codicon.micFilled),
      run: () => EditorDictation.get(editor)?.stop()
    }), { icon: true, label: false, keybinding: stopActionKeybinding });
    this.domNode.classList.add("editor-dictation-widget");
    this.domNode.appendChild(actionBar.domNode);
  }
  getId() {
    return "editorDictation";
  }
  getDomNode() {
    return this.domNode;
  }
  getPosition() {
    if (!this.editor.hasModel()) {
      return null;
    }
    const selection = this.editor.getSelection();
    return {
      position: selection.getPosition(),
      preference: [
        selection.getPosition().equals(selection.getStartPosition()) ? ContentWidgetPositionPreference.ABOVE : ContentWidgetPositionPreference.BELOW,
        ContentWidgetPositionPreference.EXACT
      ]
    };
  }
  beforeRender() {
    const lineHeight = this.editor.getOption(EditorOption.lineHeight);
    const width = this.editor.getLayoutInfo().contentWidth * 0.7;
    this.domNode.style.setProperty("--vscode-editor-dictation-widget-height", `${lineHeight}px`);
    this.domNode.style.setProperty("--vscode-editor-dictation-widget-width", `${width}px`);
    return null;
  }
  show() {
    this.editor.addContentWidget(this);
  }
  layout() {
    this.editor.layoutContentWidget(this);
  }
  active() {
    this.domNode.classList.add("recording");
  }
  hide() {
    this.domNode.classList.remove("recording");
    this.editor.removeContentWidget(this);
  }
}
let EditorDictation = class extends Disposable {
  constructor(editor, speechService, contextKeyService, keybindingService) {
    super();
    this.editor = editor;
    this.speechService = speechService;
    this.sessionDisposables = this._register(new MutableDisposable());
    this.widget = this._register(new DictationWidget(this.editor, keybindingService));
    this.editorDictationInProgress = EDITOR_DICTATION_IN_PROGRESS.bindTo(contextKeyService);
  }
  static get(editor) {
    return editor.getContribution(EditorDictation.ID);
  }
  async start() {
    const disposables = new DisposableStore();
    this.sessionDisposables.value = disposables;
    this.widget.show();
    disposables.add(toDisposable(() => this.widget.hide()));
    this.editorDictationInProgress.set(true);
    disposables.add(toDisposable(() => this.editorDictationInProgress.reset()));
    const collection = this.editor.createDecorationsCollection();
    disposables.add(toDisposable(() => collection.clear()));
    disposables.add(this.editor.onDidChangeCursorPosition(() => this.widget.layout()));
    let previewStart = void 0;
    let lastReplaceTextLength = 0;
    const replaceText = (text, isPreview) => {
      if (!previewStart) {
        previewStart = assertIsDefined(this.editor.getPosition());
      }
      const endPosition = new Position(previewStart.lineNumber, previewStart.column + text.length);
      this.editor.executeEdits(EditorDictation.ID, [
        EditOperation.replace(Range.fromPositions(previewStart, previewStart.with(void 0, previewStart.column + lastReplaceTextLength)), text)
      ], [
        Selection.fromPositions(endPosition)
      ]);
      if (isPreview) {
        collection.set([
          {
            range: Range.fromPositions(previewStart, previewStart.with(void 0, previewStart.column + text.length)),
            options: {
              description: "editor-dictation-preview",
              inlineClassName: "ghost-text-decoration-preview"
            }
          }
        ]);
      } else {
        collection.clear();
      }
      lastReplaceTextLength = text.length;
      if (!isPreview) {
        previewStart = void 0;
        lastReplaceTextLength = 0;
      }
      this.editor.revealPositionInCenterIfOutsideViewport(endPosition);
    };
    const cts = new CancellationTokenSource();
    disposables.add(toDisposable(() => cts.dispose(true)));
    const session = await this.speechService.createSpeechToTextSession(cts.token, "editor");
    disposables.add(session.onDidChange((e) => {
      if (cts.token.isCancellationRequested) {
        return;
      }
      switch (e.status) {
        case SpeechToTextStatus.Started:
          this.widget.active();
          break;
        case SpeechToTextStatus.Stopped:
          disposables.dispose();
          break;
        case SpeechToTextStatus.Recognizing: {
          if (!e.text) {
            return;
          }
          replaceText(e.text, true);
          break;
        }
        case SpeechToTextStatus.Recognized: {
          if (!e.text) {
            return;
          }
          replaceText(`${e.text} `, false);
          break;
        }
      }
    }));
  }
  stop() {
    this.sessionDisposables.clear();
  }
};
EditorDictation.ID = "editorDictation";
EditorDictation = __decorateClass([
  __decorateParam(1, ISpeechService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IKeybindingService)
], EditorDictation);
registerEditorContribution(EditorDictation.ID, EditorDictation, EditorContributionInstantiation.Lazy);
registerAction2(EditorDictationStartAction);
registerAction2(EditorDictationStopAction);
export {
  DictationWidget,
  EditorDictation,
  EditorDictationStartAction,
  EditorDictationStopAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvZGljdGF0aW9uL2VkaXRvckRpY3RhdGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9lZGl0b3JEaWN0YXRpb24uY3NzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSURpbWVuc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UsIElDb2RlRWRpdG9yLCBJQ29udGVudFdpZGdldCwgSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBIYXNTcGVlY2hQcm92aWRlciwgSVNwZWVjaFNlcnZpY2UsIFNwZWVjaFRvVGV4dEluUHJvZ3Jlc3MsIFNwZWVjaFRvVGV4dFN0YXR1cyB9IGZyb20gJy4uLy4uLy4uL3NwZWVjaC9jb21tb24vc3BlZWNoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24yLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLCByZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcblxuY29uc3QgRURJVE9SX0RJQ1RBVElPTl9JTl9QUk9HUkVTUyA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdlZGl0b3JEaWN0YXRpb24uaW5Qcm9ncmVzcycsIGZhbHNlKTtcbmNvbnN0IFZPSUNFX0NBVEVHT1JZID0gbG9jYWxpemUyKCd2b2ljZUNhdGVnb3J5JywgXCJWb2ljZVwiKTtcblxuZXhwb3J0IGNsYXNzIEVkaXRvckRpY3RhdGlvblN0YXJ0QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmVkaXRvckRpY3RhdGlvbi5zdGFydCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzdGFydERpY3RhdGlvbicsIFwiU3RhcnQgRGljdGF0aW9uIGluIEVkaXRvclwiKSxcblx0XHRcdGNhdGVnb3J5OiBWT0lDRV9DQVRFR09SWSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRIYXNTcGVlY2hQcm92aWRlcixcblx0XHRcdFx0U3BlZWNoVG9UZXh0SW5Qcm9ncmVzcy50b05lZ2F0ZWQoKSxcdFx0Ly8gZGlzYWJsZSB3aGVuIGFueSBzcGVlY2gtdG8tdGV4dCBpcyBpbiBwcm9ncmVzc1xuXHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5yZWFkT25seS50b05lZ2F0ZWQoKVx0Ly8gZGlzYWJsZSBpbiByZWFkLW9ubHkgZWRpdG9yc1xuXHRcdFx0KSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleVYsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRzZWNvbmRhcnk6IGlzV2luZG93cyA/IFtcblx0XHRcdFx0XHRLZXlNb2QuQWx0IHwgS2V5Q29kZS5CYWNrcXVvdGVcblx0XHRcdFx0XSA6IHVuZGVmaW5lZFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQge1xuXHRcdGNvbnN0IGtleWJpbmRpbmdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElLZXliaW5kaW5nU2VydmljZSk7XG5cblx0XHRjb25zdCBob2xkTW9kZSA9IGtleWJpbmRpbmdTZXJ2aWNlLmVuYWJsZUtleWJpbmRpbmdIb2xkTW9kZSh0aGlzLmRlc2MuaWQpO1xuXHRcdGlmIChob2xkTW9kZSkge1xuXHRcdFx0bGV0IHNob3VsZENhbGxTdG9wID0gZmFsc2U7XG5cblx0XHRcdGNvbnN0IGhhbmRsZSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRzaG91bGRDYWxsU3RvcCA9IHRydWU7XG5cdFx0XHR9LCA1MDApO1xuXG5cdFx0XHRob2xkTW9kZS5maW5hbGx5KCgpID0+IHtcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KGhhbmRsZSk7XG5cblx0XHRcdFx0aWYgKHNob3VsZENhbGxTdG9wKSB7XG5cdFx0XHRcdFx0RWRpdG9yRGljdGF0aW9uLmdldChlZGl0b3IpPy5zdG9wKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdEVkaXRvckRpY3RhdGlvbi5nZXQoZWRpdG9yKT8uc3RhcnQoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRWRpdG9yRGljdGF0aW9uU3RvcEFjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmVkaXRvckRpY3RhdGlvbi5zdG9wJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRWRpdG9yRGljdGF0aW9uU3RvcEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3N0b3BEaWN0YXRpb24nLCBcIlN0b3AgRGljdGF0aW9uIGluIEVkaXRvclwiKSxcblx0XHRcdGNhdGVnb3J5OiBWT0lDRV9DQVRFR09SWSxcblx0XHRcdHByZWNvbmRpdGlvbjogRURJVE9SX0RJQ1RBVElPTl9JTl9QUk9HUkVTUyxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxMDBcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bkVkaXRvckNvbW1hbmQoX2FjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0RWRpdG9yRGljdGF0aW9uLmdldChlZGl0b3IpPy5zdG9wKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERpY3RhdGlvbldpZGdldCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ29udGVudFdpZGdldCB7XG5cblx0cmVhZG9ubHkgc3VwcHJlc3NNb3VzZURvd24gPSB0cnVlO1xuXHRyZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93ID0gdHJ1ZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3QgYWN0aW9uQmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcih0aGlzLmRvbU5vZGUpKTtcblx0XHRjb25zdCBzdG9wQWN0aW9uS2V5YmluZGluZyA9IGtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoRWRpdG9yRGljdGF0aW9uU3RvcEFjdGlvbi5JRCk/LmdldExhYmVsKCk7XG5cdFx0YWN0aW9uQmFyLnB1c2godG9BY3Rpb24oe1xuXHRcdFx0aWQ6IEVkaXRvckRpY3RhdGlvblN0b3BBY3Rpb24uSUQsXG5cdFx0XHRsYWJlbDogc3RvcEFjdGlvbktleWJpbmRpbmcgPyBsb2NhbGl6ZSgnc3RvcERpY3RhdGlvblNob3J0MScsIFwiU3RvcCBEaWN0YXRpb24gKHswfSlcIiwgc3RvcEFjdGlvbktleWJpbmRpbmcpIDogbG9jYWxpemUoJ3N0b3BEaWN0YXRpb25TaG9ydDInLCBcIlN0b3AgRGljdGF0aW9uXCIpLFxuXHRcdFx0Y2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLm1pY0ZpbGxlZCksXG5cdFx0XHRydW46ICgpID0+IEVkaXRvckRpY3RhdGlvbi5nZXQoZWRpdG9yKT8uc3RvcCgpXG5cdFx0fSksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlLCBrZXliaW5kaW5nOiBzdG9wQWN0aW9uS2V5YmluZGluZyB9KTtcblxuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdlZGl0b3ItZGljdGF0aW9uLXdpZGdldCcpO1xuXHRcdHRoaXMuZG9tTm9kZS5hcHBlbmRDaGlsZChhY3Rpb25CYXIuZG9tTm9kZSk7XG5cdH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnZWRpdG9yRGljdGF0aW9uJztcblx0fVxuXG5cdGdldERvbU5vZGUoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLmRvbU5vZGU7XG5cdH1cblxuXHRnZXRQb3NpdGlvbigpOiBJQ29udGVudFdpZGdldFBvc2l0aW9uIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLmVkaXRvci5nZXRTZWxlY3Rpb24oKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRwb3NpdGlvbjogc2VsZWN0aW9uLmdldFBvc2l0aW9uKCksXG5cdFx0XHRwcmVmZXJlbmNlOiBbXG5cdFx0XHRcdHNlbGVjdGlvbi5nZXRQb3NpdGlvbigpLmVxdWFscyhzZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpKSA/IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQUJPVkUgOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkJFTE9XLFxuXHRcdFx0XHRDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkVYQUNUXG5cdFx0XHRdXG5cdFx0fTtcblx0fVxuXG5cdGJlZm9yZVJlbmRlcigpOiBJRGltZW5zaW9uIHwgbnVsbCB7XG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ubGluZUhlaWdodCk7XG5cdFx0Y29uc3Qgd2lkdGggPSB0aGlzLmVkaXRvci5nZXRMYXlvdXRJbmZvKCkuY29udGVudFdpZHRoICogMC43O1xuXG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLnNldFByb3BlcnR5KCctLXZzY29kZS1lZGl0b3ItZGljdGF0aW9uLXdpZGdldC1oZWlnaHQnLCBgJHtsaW5lSGVpZ2h0fXB4YCk7XG5cdFx0dGhpcy5kb21Ob2RlLnN0eWxlLnNldFByb3BlcnR5KCctLXZzY29kZS1lZGl0b3ItZGljdGF0aW9uLXdpZGdldC13aWR0aCcsIGAke3dpZHRofXB4YCk7XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHNob3coKSB7XG5cdFx0dGhpcy5lZGl0b3IuYWRkQ29udGVudFdpZGdldCh0aGlzKTtcblx0fVxuXG5cdGxheW91dCgpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0YWN0aXZlKCk6IHZvaWQge1xuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdyZWNvcmRpbmcnKTtcblx0fVxuXG5cdGhpZGUoKSB7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ3JlY29yZGluZycpO1xuXHRcdHRoaXMuZWRpdG9yLnJlbW92ZUNvbnRlbnRXaWRnZXQodGhpcyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVkaXRvckRpY3RhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yRGljdGF0aW9uJztcblxuXHRzdGF0aWMgZ2V0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiBFZGl0b3JEaWN0YXRpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxFZGl0b3JEaWN0YXRpb24+KEVkaXRvckRpY3RhdGlvbi5JRCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHdpZGdldDogRGljdGF0aW9uV2lkZ2V0O1xuXHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvckRpY3RhdGlvbkluUHJvZ3Jlc3M6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc2Vzc2lvbkRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASVNwZWVjaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzcGVlY2hTZXJ2aWNlOiBJU3BlZWNoU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLndpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaWN0YXRpb25XaWRnZXQodGhpcy5lZGl0b3IsIGtleWJpbmRpbmdTZXJ2aWNlKSk7XG5cdFx0dGhpcy5lZGl0b3JEaWN0YXRpb25JblByb2dyZXNzID0gRURJVE9SX0RJQ1RBVElPTl9JTl9QUk9HUkVTUy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0YXN5bmMgc3RhcnQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5zZXNzaW9uRGlzcG9zYWJsZXMudmFsdWUgPSBkaXNwb3NhYmxlcztcblxuXHRcdHRoaXMud2lkZ2V0LnNob3coKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMud2lkZ2V0LmhpZGUoKSkpO1xuXG5cdFx0dGhpcy5lZGl0b3JEaWN0YXRpb25JblByb2dyZXNzLnNldCh0cnVlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuZWRpdG9yRGljdGF0aW9uSW5Qcm9ncmVzcy5yZXNldCgpKSk7XG5cblx0XHRjb25zdCBjb2xsZWN0aW9uID0gdGhpcy5lZGl0b3IuY3JlYXRlRGVjb3JhdGlvbnNDb2xsZWN0aW9uKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjb2xsZWN0aW9uLmNsZWFyKCkpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKCgpID0+IHRoaXMud2lkZ2V0LmxheW91dCgpKSk7XG5cblx0XHRsZXQgcHJldmlld1N0YXJ0OiBQb3NpdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGxldCBsYXN0UmVwbGFjZVRleHRMZW5ndGggPSAwO1xuXHRcdGNvbnN0IHJlcGxhY2VUZXh0ID0gKHRleHQ6IHN0cmluZywgaXNQcmV2aWV3OiBib29sZWFuKSA9PiB7XG5cdFx0XHRpZiAoIXByZXZpZXdTdGFydCkge1xuXHRcdFx0XHRwcmV2aWV3U3RhcnQgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVuZFBvc2l0aW9uID0gbmV3IFBvc2l0aW9uKHByZXZpZXdTdGFydC5saW5lTnVtYmVyLCBwcmV2aWV3U3RhcnQuY29sdW1uICsgdGV4dC5sZW5ndGgpO1xuXHRcdFx0dGhpcy5lZGl0b3IuZXhlY3V0ZUVkaXRzKEVkaXRvckRpY3RhdGlvbi5JRCwgW1xuXHRcdFx0XHRFZGl0T3BlcmF0aW9uLnJlcGxhY2UoUmFuZ2UuZnJvbVBvc2l0aW9ucyhwcmV2aWV3U3RhcnQsIHByZXZpZXdTdGFydC53aXRoKHVuZGVmaW5lZCwgcHJldmlld1N0YXJ0LmNvbHVtbiArIGxhc3RSZXBsYWNlVGV4dExlbmd0aCkpLCB0ZXh0KVxuXHRcdFx0XSwgW1xuXHRcdFx0XHRTZWxlY3Rpb24uZnJvbVBvc2l0aW9ucyhlbmRQb3NpdGlvbilcblx0XHRcdF0pO1xuXG5cdFx0XHRpZiAoaXNQcmV2aWV3KSB7XG5cdFx0XHRcdGNvbGxlY3Rpb24uc2V0KFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyYW5nZTogUmFuZ2UuZnJvbVBvc2l0aW9ucyhwcmV2aWV3U3RhcnQsIHByZXZpZXdTdGFydC53aXRoKHVuZGVmaW5lZCwgcHJldmlld1N0YXJ0LmNvbHVtbiArIHRleHQubGVuZ3RoKSksXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAnZWRpdG9yLWRpY3RhdGlvbi1wcmV2aWV3Jyxcblx0XHRcdFx0XHRcdFx0aW5saW5lQ2xhc3NOYW1lOiAnZ2hvc3QtdGV4dC1kZWNvcmF0aW9uLXByZXZpZXcnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbGxlY3Rpb24uY2xlYXIoKTtcblx0XHRcdH1cblxuXHRcdFx0bGFzdFJlcGxhY2VUZXh0TGVuZ3RoID0gdGV4dC5sZW5ndGg7XG5cdFx0XHRpZiAoIWlzUHJldmlldykge1xuXHRcdFx0XHRwcmV2aWV3U3RhcnQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGxhc3RSZXBsYWNlVGV4dExlbmd0aCA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuZWRpdG9yLnJldmVhbFBvc2l0aW9uSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChlbmRQb3NpdGlvbik7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gY3RzLmRpc3Bvc2UodHJ1ZSkpKTtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCB0aGlzLnNwZWVjaFNlcnZpY2UuY3JlYXRlU3BlZWNoVG9UZXh0U2Vzc2lvbihjdHMudG9rZW4sICdlZGl0b3InKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2Vzc2lvbi5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzd2l0Y2ggKGUuc3RhdHVzKSB7XG5cdFx0XHRcdGNhc2UgU3BlZWNoVG9UZXh0U3RhdHVzLlN0YXJ0ZWQ6XG5cdFx0XHRcdFx0dGhpcy53aWRnZXQuYWN0aXZlKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgU3BlZWNoVG9UZXh0U3RhdHVzLlN0b3BwZWQ6XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZzoge1xuXHRcdFx0XHRcdGlmICghZS50ZXh0KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmVwbGFjZVRleHQoZS50ZXh0LCB0cnVlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkOiB7XG5cdFx0XHRcdFx0aWYgKCFlLnRleHQpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXBsYWNlVGV4dChgJHtlLnRleHR9IGAsIGZhbHNlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHN0b3AoKTogdm9pZCB7XG5cdFx0dGhpcy5zZXNzaW9uRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxufVxuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihFZGl0b3JEaWN0YXRpb24uSUQsIEVkaXRvckRpY3RhdGlvbiwgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbi5MYXp5KTtcbnJlZ2lzdGVyQWN0aW9uMihFZGl0b3JEaWN0YXRpb25TdGFydEFjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoRWRpdG9yRGljdGF0aW9uU3RvcEFjdGlvbik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLFVBQVUsaUJBQWlCO0FBRXBDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsWUFBWSxpQkFBaUIsbUJBQW1CLG9CQUFvQjtBQUM3RSxTQUFTLHVDQUE0RjtBQUVyRyxTQUFTLGdCQUE2QixvQkFBb0IscUJBQXFCO0FBQy9FLFNBQVMsbUJBQW1CLGdCQUFn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
