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
import * as nls from "../../../../nls.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import { registerEditorContribution, EditorAction, registerEditorAction, EditorContributionInstantiation } from "../../../../editor/browser/editorExtensions.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Handler } from "../../../../editor/common/editorCommon.js";
import { EndOfLinePreference } from "../../../../editor/common/model.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { SelectionClipboardContributionID } from "../browser/selectionClipboard.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Event } from "../../../../base/common/event.js";
import { addDisposableListener, onDidRegisterWindow } from "../../../../base/browser/dom.js";
let SelectionClipboard = class extends Disposable {
  constructor(editor, clipboardService) {
    super();
    if (platform.isLinux) {
      let isEnabled = editor.getOption(EditorOption.selectionClipboard);
      this._register(editor.onDidChangeConfiguration((e) => {
        if (e.hasChanged(EditorOption.selectionClipboard)) {
          isEnabled = editor.getOption(EditorOption.selectionClipboard);
        }
      }));
      const setSelectionToClipboard = this._register(new RunOnceScheduler(() => {
        if (!editor.hasModel()) {
          return;
        }
        const model = editor.getModel();
        let selections = editor.getSelections();
        selections = selections.slice(0);
        selections.sort(Range.compareRangesUsingStarts);
        let resultLength = 0;
        for (const sel of selections) {
          if (sel.isEmpty()) {
            return;
          }
          resultLength += model.getValueLengthInRange(sel);
        }
        if (resultLength > SelectionClipboard.SELECTION_LENGTH_LIMIT) {
          return;
        }
        const result = [];
        for (const sel of selections) {
          result.push(model.getValueInRange(sel, EndOfLinePreference.TextDefined));
        }
        const textToCopy = result.join(model.getEOL());
        clipboardService.writeText(textToCopy, "selection");
      }, 100));
      this._register(editor.onDidChangeCursorSelection((e) => {
        if (!isEnabled) {
          return;
        }
        if (e.source === "restoreState") {
          return;
        }
        setSelectionToClipboard.schedule();
      }));
    }
  }
  dispose() {
    super.dispose();
  }
};
SelectionClipboard.SELECTION_LENGTH_LIMIT = 65536;
SelectionClipboard = __decorateClass([
  __decorateParam(1, IClipboardService)
], SelectionClipboard);
let LinuxSelectionClipboardPastePreventer = class extends Disposable {
  constructor(configurationService) {
    super();
    this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
      disposables.add(addDisposableListener(window.document, "mouseup", (e) => {
        if (e.button === 1) {
          const config = configurationService.getValue("editor");
          if (!config.selectionClipboard) {
            e.preventDefault();
          }
        }
      }));
    }, { window: mainWindow, disposables: this._store }));
  }
};
LinuxSelectionClipboardPastePreventer.ID = "workbench.contrib.linuxSelectionClipboardPastePreventer";
LinuxSelectionClipboardPastePreventer = __decorateClass([
  __decorateParam(0, IConfigurationService)
], LinuxSelectionClipboardPastePreventer);
class PasteSelectionClipboardAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.selectionClipboardPaste",
      label: nls.localize2("actions.pasteSelectionClipboard", "Paste Selection Clipboard"),
      precondition: EditorContextKeys.writable
    });
  }
  async run(accessor, editor, args) {
    const clipboardService = accessor.get(IClipboardService);
    const text = await clipboardService.readText("selection");
    editor.trigger("keyboard", Handler.Paste, {
      text,
      pasteOnNewLine: false,
      multicursorText: null
    });
  }
}
registerEditorContribution(SelectionClipboardContributionID, SelectionClipboard, EditorContributionInstantiation.Eager);
if (platform.isLinux) {
  registerWorkbenchContribution2(LinuxSelectionClipboardPastePreventer.ID, LinuxSelectionClipboardPastePreventer, WorkbenchPhase.BlockRestore);
  registerEditorAction(PasteSelectionClipboardAction);
}
export {
  SelectionClipboard
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2VsZWN0cm9uLXNhbmRib3gvc2VsZWN0aW9uQ2xpcGJvYXJkLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIEVkaXRvckFjdGlvbiwgU2VydmljZXNBY2Nlc3NvciwgcmVnaXN0ZXJFZGl0b3JBY3Rpb24sIEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSUN1cnNvclNlbGVjdGlvbkNoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY3Vyc29yRXZlbnRzLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElFZGl0b3JDb250cmlidXRpb24sIEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBFbmRPZkxpbmVQcmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb25DbGlwYm9hcmRDb250cmlidXRpb25JRCB9IGZyb20gJy4uL2Jyb3dzZXIvc2VsZWN0aW9uQ2xpcGJvYXJkLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgb25EaWRSZWdpc3RlcldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuXG5leHBvcnQgY2xhc3MgU2VsZWN0aW9uQ2xpcGJvYXJkIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBTRUxFQ1RJT05fTEVOR1RIX0xJTUlUID0gNjU1MzY7XG5cblx0Y29uc3RydWN0b3IoZWRpdG9yOiBJQ29kZUVkaXRvciwgQElDbGlwYm9hcmRTZXJ2aWNlIGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGlmIChwbGF0Zm9ybS5pc0xpbnV4KSB7XG5cdFx0XHRsZXQgaXNFbmFibGVkID0gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc2VsZWN0aW9uQ2xpcGJvYXJkKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZTogQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5zZWxlY3Rpb25DbGlwYm9hcmQpKSB7XG5cdFx0XHRcdFx0aXNFbmFibGVkID0gZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc2VsZWN0aW9uQ2xpcGJvYXJkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRjb25zdCBzZXRTZWxlY3Rpb25Ub0NsaXBib2FyZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvci5nZXRNb2RlbCgpO1xuXHRcdFx0XHRsZXQgc2VsZWN0aW9ucyA9IGVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cdFx0XHRcdHNlbGVjdGlvbnMgPSBzZWxlY3Rpb25zLnNsaWNlKDApO1xuXHRcdFx0XHRzZWxlY3Rpb25zLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblxuXHRcdFx0XHRsZXQgcmVzdWx0TGVuZ3RoID0gMDtcblx0XHRcdFx0Zm9yIChjb25zdCBzZWwgb2Ygc2VsZWN0aW9ucykge1xuXHRcdFx0XHRcdGlmIChzZWwuaXNFbXB0eSgpKSB7XG5cdFx0XHRcdFx0XHQvLyBPbmx5IHdyaXRlIGlmIGFsbCBjdXJzb3JzIGhhdmUgc2VsZWN0aW9uXG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlc3VsdExlbmd0aCArPSBtb2RlbC5nZXRWYWx1ZUxlbmd0aEluUmFuZ2Uoc2VsKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChyZXN1bHRMZW5ndGggPiBTZWxlY3Rpb25DbGlwYm9hcmQuU0VMRUNUSU9OX0xFTkdUSF9MSU1JVCkge1xuXHRcdFx0XHRcdC8vIFRoaXMgaXMgYSBsYXJnZSBzZWxlY3Rpb24hXG5cdFx0XHRcdFx0Ly8gPT4gZG8gbm90IHdyaXRlIGl0IHRvIHRoZSBzZWxlY3Rpb24gY2xpcGJvYXJkXG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNlbCBvZiBzZWxlY3Rpb25zKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2gobW9kZWwuZ2V0VmFsdWVJblJhbmdlKHNlbCwgRW5kT2ZMaW5lUHJlZmVyZW5jZS5UZXh0RGVmaW5lZCkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdGV4dFRvQ29weSA9IHJlc3VsdC5qb2luKG1vZGVsLmdldEVPTCgpKTtcblx0XHRcdFx0Y2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQodGV4dFRvQ29weSwgJ3NlbGVjdGlvbicpO1xuXHRcdFx0fSwgMTAwKSk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbigoZTogSUN1cnNvclNlbGVjdGlvbkNoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0XHRpZiAoIWlzRW5hYmxlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZS5zb3VyY2UgPT09ICdyZXN0b3JlU3RhdGUnKSB7XG5cdFx0XHRcdFx0Ly8gZG8gbm90IHNldCBzZWxlY3Rpb24gdG8gY2xpcGJvYXJkIGlmIHRoaXMgc2VsZWN0aW9uIGNoYW5nZVxuXHRcdFx0XHRcdC8vIHdhcyBjYXVzZWQgYnkgcmVzdG9yaW5nIGVkaXRvcnMuLi5cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2V0U2VsZWN0aW9uVG9DbGlwYm9hcmQuc2NoZWR1bGUoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgTGludXhTZWxlY3Rpb25DbGlwYm9hcmRQYXN0ZVByZXZlbnRlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIubGludXhTZWxlY3Rpb25DbGlwYm9hcmRQYXN0ZVByZXZlbnRlcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUob25EaWRSZWdpc3RlcldpbmRvdywgKHsgd2luZG93LCBkaXNwb3NhYmxlcyB9KSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpbmRvdy5kb2N1bWVudCwgJ21vdXNldXAnLCBlID0+IHtcblx0XHRcdFx0aWYgKGUuYnV0dG9uID09PSAxKSB7XG5cdFx0XHRcdFx0Ly8gbWlkZGxlIGJ1dHRvblxuXHRcdFx0XHRcdGNvbnN0IGNvbmZpZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHsgc2VsZWN0aW9uQ2xpcGJvYXJkOiBib29sZWFuIH0+KCdlZGl0b3InKTtcblx0XHRcdFx0XHRpZiAoIWNvbmZpZy5zZWxlY3Rpb25DbGlwYm9hcmQpIHtcblx0XHRcdFx0XHRcdC8vIHNlbGVjdGlvbiBjbGlwYm9hcmQgaXMgZGlzYWJsZWRcblx0XHRcdFx0XHRcdC8vIHRyeSB0byBzdG9wIHRoZSB1cGNvbWluZyBwYXN0ZVxuXHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0sIHsgd2luZG93OiBtYWluV2luZG93LCBkaXNwb3NhYmxlczogdGhpcy5fc3RvcmUgfSkpO1xuXHR9XG59XG5cbmNsYXNzIFBhc3RlU2VsZWN0aW9uQ2xpcGJvYXJkQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uc2VsZWN0aW9uQ2xpcGJvYXJkUGFzdGUnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2FjdGlvbnMucGFzdGVTZWxlY3Rpb25DbGlwYm9hcmQnLCBcIlBhc3RlIFNlbGVjdGlvbiBDbGlwYm9hcmRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblxuXHRcdC8vIHJlYWQgc2VsZWN0aW9uIGNsaXBib2FyZFxuXHRcdGNvbnN0IHRleHQgPSBhd2FpdCBjbGlwYm9hcmRTZXJ2aWNlLnJlYWRUZXh0KCdzZWxlY3Rpb24nKTtcblxuXHRcdGVkaXRvci50cmlnZ2VyKCdrZXlib2FyZCcsIEhhbmRsZXIuUGFzdGUsIHtcblx0XHRcdHRleHQ6IHRleHQsXG5cdFx0XHRwYXN0ZU9uTmV3TGluZTogZmFsc2UsXG5cdFx0XHRtdWx0aWN1cnNvclRleHQ6IG51bGxcblx0XHR9KTtcblx0fVxufVxuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihTZWxlY3Rpb25DbGlwYm9hcmRDb250cmlidXRpb25JRCwgU2VsZWN0aW9uQ2xpcGJvYXJkLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkVhZ2VyKTsgLy8gZWFnZXIgYmVjYXVzZSBpdCBuZWVkcyB0byBsaXN0ZW4gdG8gc2VsZWN0aW9uIGNoYW5nZSBldmVudHNcbmlmIChwbGF0Zm9ybS5pc0xpbnV4KSB7XG5cdHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihMaW51eFNlbGVjdGlvbkNsaXBib2FyZFBhc3RlUHJldmVudGVyLklELCBMaW51eFNlbGVjdGlvbkNsaXBib2FyZFBhc3RlUHJldmVudGVyLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpOyAvLyBlYWdlciBiZWNhdXNlIGl0IGxpc3RlbnMgdG8gbW91c2UtdXAgZXZlbnRzIGdsb2JhbGx5XG5cdHJlZ2lzdGVyRWRpdG9yQWN0aW9uKFBhc3RlU2VsZWN0aW9uQ2xpcGJvYXJkQWN0aW9uKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsa0JBQWtCO0FBQzNCLFlBQVksY0FBYztBQUUxQixTQUFTLDRCQUE0QixjQUFnQyxzQkFBc0IsdUNBQXVDO0FBQ2xJLFNBQW9DLG9CQUFvQjtBQUV4RCxTQUFTLGFBQWE7QUFDdEIsU0FBOEIsZUFBZTtBQUM3QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHdDQUF3QztBQUNqRCxTQUFpQyxnQkFBZ0Isc0NBQXNDO0FBQ3ZGLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHVCQUF1QiwyQkFBMkI7QUFFcEQsSUFBTSxxQkFBTixjQUFpQyxXQUEwQztBQUFBLEVBR2pGLFlBQVksUUFBd0Msa0JBQXFDO0FBQ3hGLFVBQU07QUFFTixRQUFJLFNBQVMsU0FBUztBQUNyQixVQUFJLFlBQVksT0FBTyxVQUFVLGFBQWEsa0JBQWtCO0FBRWhFLFdBQUssVUFBVSxPQUFPLHlCQUF5QixDQUFDLE1BQWlDO0FBQ2hGLFlBQUksRUFBRSxXQUFXLGFBQWEsa0JBQWtCLEdBQUc7QUFDbEQsc0JBQVksT0FBTyxVQUFVLGFBQWEsa0JBQWtCO0FBQUEsUUFDN0Q7QUFBQSxNQUNELENBQUMsQ0FBQztBQUVGLFlBQU0sMEJBQTBCLEtBQUssVUFBVSxJQUFJLGlCQUFpQixNQUFNO0FBQ3pFLFlBQUksQ0FBQyxPQUFPLFNBQVMs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
