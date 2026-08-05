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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { localize2 } from "../../../../../../nls.js";
import { Categories } from "../../../../../../platform/action/common/actionCommonCategories.js";
import { Action2, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { Extensions as WorkbenchExtensions } from "../../../../../common/contributions.js";
import { Memento } from "../../../../../common/memento.js";
import { NotebookSetting } from "../../../common/notebookCommon.js";
import { HAS_OPENED_NOTEBOOK } from "../../../common/notebookContextKeys.js";
import { NotebookEditorInput } from "../../../common/notebookEditorInput.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
const hasOpenedNotebookKey = "hasOpenedNotebook";
const hasShownGettingStartedKey = "hasShownNotebookGettingStarted";
let NotebookGettingStarted = class extends Disposable {
  constructor(_editorService, _storageService, _contextKeyService, _commandService, _configurationService) {
    super();
    const hasOpenedNotebook = HAS_OPENED_NOTEBOOK.bindTo(_contextKeyService);
    const memento = new Memento("notebookGettingStarted2", _storageService);
    const storedValue = memento.getMemento(StorageScope.PROFILE, StorageTarget.USER);
    if (storedValue[hasOpenedNotebookKey]) {
      hasOpenedNotebook.set(true);
    }
    const needToShowGettingStarted = _configurationService.getValue(NotebookSetting.openGettingStarted) && !storedValue[hasShownGettingStartedKey];
    if (!storedValue[hasOpenedNotebookKey] || needToShowGettingStarted) {
      const onDidOpenNotebook = () => {
        hasOpenedNotebook.set(true);
        storedValue[hasOpenedNotebookKey] = true;
        if (needToShowGettingStarted) {
          _commandService.executeCommand("workbench.action.openWalkthrough", { category: "notebooks", step: "notebookProfile" }, true);
          storedValue[hasShownGettingStartedKey] = true;
        }
        memento.saveMemento();
      };
      if (_editorService.activeEditor?.typeId === NotebookEditorInput.ID) {
        onDidOpenNotebook();
        return;
      }
      const listener = this._register(_editorService.onDidActiveEditorChange(() => {
        if (_editorService.activeEditor?.typeId === NotebookEditorInput.ID) {
          listener.dispose();
          onDidOpenNotebook();
        }
      }));
    }
  }
};
NotebookGettingStarted = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IConfigurationService)
], NotebookGettingStarted);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookGettingStarted, LifecyclePhase.Restored);
registerAction2(class NotebookClearNotebookLayoutAction extends Action2 {
  constructor() {
    super({
      id: "workbench.notebook.layout.gettingStarted",
      title: localize2("workbench.notebook.layout.gettingStarted.label", "Reset notebook getting started"),
      f1: true,
      precondition: ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true),
      category: Categories.Developer
    });
  }
  run(accessor) {
    const storageService = accessor.get(IStorageService);
    const memento = new Memento("notebookGettingStarted", storageService);
    const storedValue = memento.getMemento(StorageScope.PROFILE, StorageTarget.USER);
    storedValue[hasOpenedNotebookKey] = void 0;
    memento.saveMemento();
  }
});
export {
  NotebookGettingStarted
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvZ2V0dGluZ1N0YXJ0ZWQvbm90ZWJvb2tHZXR0aW5nU3RhcnRlZC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgTWVtZW50byB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9tZW1lbnRvLmpzJztcbmltcG9ydCB7IE5vdGVib29rU2V0dGluZyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBIQVNfT1BFTkVEX05PVEVCT09LIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5jb25zdCBoYXNPcGVuZWROb3RlYm9va0tleSA9ICdoYXNPcGVuZWROb3RlYm9vayc7XG5jb25zdCBoYXNTaG93bkdldHRpbmdTdGFydGVkS2V5ID0gJ2hhc1Nob3duTm90ZWJvb2tHZXR0aW5nU3RhcnRlZCc7XG5cbi8qKlxuICogU2V0cyBhIGNvbnRleHQga2V5IHdoZW4gYSBub3RlYm9vayBoYXMgZXZlciBiZWVuIG9wZW5lZCBieSB0aGUgdXNlclxuICovXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tHZXR0aW5nU3RhcnRlZCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvclNlcnZpY2UgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBoYXNPcGVuZWROb3RlYm9vayA9IEhBU19PUEVORURfTk9URUJPT0suYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgbWVtZW50byA9IG5ldyBNZW1lbnRvKCdub3RlYm9va0dldHRpbmdTdGFydGVkMicsIF9zdG9yYWdlU2VydmljZSk7XG5cdFx0Y29uc3Qgc3RvcmVkVmFsdWUgPSBtZW1lbnRvLmdldE1lbWVudG8oU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0aWYgKHN0b3JlZFZhbHVlW2hhc09wZW5lZE5vdGVib29rS2V5XSkge1xuXHRcdFx0aGFzT3BlbmVkTm90ZWJvb2suc2V0KHRydWUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5lZWRUb1Nob3dHZXR0aW5nU3RhcnRlZCA9IF9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShOb3RlYm9va1NldHRpbmcub3BlbkdldHRpbmdTdGFydGVkKSAmJiAhc3RvcmVkVmFsdWVbaGFzU2hvd25HZXR0aW5nU3RhcnRlZEtleV07XG5cdFx0aWYgKCFzdG9yZWRWYWx1ZVtoYXNPcGVuZWROb3RlYm9va0tleV0gfHwgbmVlZFRvU2hvd0dldHRpbmdTdGFydGVkKSB7XG5cdFx0XHRjb25zdCBvbkRpZE9wZW5Ob3RlYm9vayA9ICgpID0+IHtcblx0XHRcdFx0aGFzT3BlbmVkTm90ZWJvb2suc2V0KHRydWUpO1xuXHRcdFx0XHRzdG9yZWRWYWx1ZVtoYXNPcGVuZWROb3RlYm9va0tleV0gPSB0cnVlO1xuXG5cdFx0XHRcdGlmIChuZWVkVG9TaG93R2V0dGluZ1N0YXJ0ZWQpIHtcblx0XHRcdFx0XHRfY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24ub3BlbldhbGt0aHJvdWdoJywgeyBjYXRlZ29yeTogJ25vdGVib29rcycsIHN0ZXA6ICdub3RlYm9va1Byb2ZpbGUnIH0sIHRydWUpO1xuXHRcdFx0XHRcdHN0b3JlZFZhbHVlW2hhc1Nob3duR2V0dGluZ1N0YXJ0ZWRLZXldID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG1lbWVudG8uc2F2ZU1lbWVudG8oKTtcblx0XHRcdH07XG5cblx0XHRcdGlmIChfZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I/LnR5cGVJZCA9PT0gTm90ZWJvb2tFZGl0b3JJbnB1dC5JRCkge1xuXHRcdFx0XHQvLyBhY3RpdmUgZWRpdG9yIGlzIG5vdGVib29rXG5cdFx0XHRcdG9uRGlkT3Blbk5vdGVib29rKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGlzdGVuZXIgPSB0aGlzLl9yZWdpc3RlcihfZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdGlmIChfZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I/LnR5cGVJZCA9PT0gTm90ZWJvb2tFZGl0b3JJbnB1dC5JRCkge1xuXHRcdFx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRvbkRpZE9wZW5Ob3RlYm9vaygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihOb3RlYm9va0dldHRpbmdTdGFydGVkLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBOb3RlYm9va0NsZWFyTm90ZWJvb2tMYXlvdXRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gubm90ZWJvb2subGF5b3V0LmdldHRpbmdTdGFydGVkJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5ub3RlYm9vay5sYXlvdXQuZ2V0dGluZ1N0YXJ0ZWQubGFiZWwnLCBcIlJlc2V0IG5vdGVib29rIGdldHRpbmcgc3RhcnRlZFwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke05vdGVib29rU2V0dGluZy5vcGVuR2V0dGluZ1N0YXJ0ZWR9YCwgdHJ1ZSksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RvcmFnZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCBtZW1lbnRvID0gbmV3IE1lbWVudG8oJ25vdGVib29rR2V0dGluZ1N0YXJ0ZWQnLCBzdG9yYWdlU2VydmljZSk7XG5cblx0XHRjb25zdCBzdG9yZWRWYWx1ZSA9IG1lbWVudG8uZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHRzdG9yZWRWYWx1ZVtoYXNPcGVuZWROb3RlYm9va0tleV0gPSB1bmRlZmluZWQ7XG5cdFx0bWVtZW50by5zYXZlTWVtZW50bygpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLHVCQUF1QjtBQUN6QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQiwwQkFBMEI7QUFFbkQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBa0UsY0FBYywyQkFBMkI7QUFDM0csU0FBUyxlQUFlO0FBQ3hCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FBRS9CLE1BQU0sdUJBQXVCO0FBQzdCLE1BQU0sNEJBQTRCO0FBSzNCLElBQU0seUJBQU4sY0FBcUMsV0FBNkM7QUFBQSxFQUV4RixZQUNpQixnQkFDQyxpQkFDRyxvQkFDSCxpQkFDTSx1QkFDdEI7QUFDRCxVQUFNO0FBRU4sVUFBTSxvQkFBb0Isb0JBQW9CLE9BQU8sa0JBQWtCO0FBQ3ZFLFVBQU0sVUFBVSxJQUFJLFFBQVEsMkJBQTJCLGVBQWU7QUFDdEUsVUFBTSxjQUFjLFFBQVEsV0FBVyxhQUFhLFNBQVMsY0FBYyxJQUFJO0FBQy9FLFFBQUksWUFBWSxvQkFBb0IsR0FBRztBQUN0Qyx3QkFBa0IsSUFBSSxJQUFJO0FBQUEsSUFDM0I7QUFFQSxVQUFNLDJCQUEyQixzQkFBc0IsU0FBUyxnQkFBZ0Isa0JBQWtCLEtBQUssQ0FBQyxZQUFZLHlCQUF5QjtBQUM3SSxRQUFJLENBQUMsWUFBWSxvQkFBb0IsS0FBSywwQkFBMEI7QUFDbkUsWUFBTSxvQkFBb0IsTUFBTTtBQUMvQiwwQkFBa0IsSUFBSSxJQUFJO0FBQzFCLG9CQUFZLG9CQUFvQixJQUFJO0FBRXBDLFlBQUksMEJBQTBCO0FBQzdCLDBCQUFnQixlQUFlLG9DQUFvQyxFQUFFLFVBQVUsYUFBYSxNQUFNLGtCQUFrQixHQUFHLElBQUk7QUFDM0gsc0JBQVkseUJBQXlCLElBQUk7QUFBQSxRQUMxQztBQUVBLGdCQUFRLFlBQVk7QUFBQSxNQUNyQjtBQUVBLFVBQUksZUFBZSxjQUFjLFdBQVcsb0JBQW9CLElBQUk7QUFFbkUsMEJBQWtCO0FBQ2xCO0FBQUEsTUFDRDtBQUVBLFlBQU0sV0FBVyxLQUFLLFVBQVUsZUFBZSx3QkFBd0IsTUFBTTtBQUM1RSxZQUFJLGVBQWUsY0FBYyxXQUFXLG9CQUFvQixJQUFJO0FBQ25FLG1CQUFTLFFBQVE7QUFDakIsNEJBQWtCO0FBQUEsUUFDbkI7QUFBQSxNQUNELENBQUMsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNEO0FBQ0Q7QUE5Q2EseUJBQU47QUFBQSxFQUdKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUFU7QUFnRGIsU0FBUyxHQUFvQyxvQkFBb0IsU0FBUyxFQUFFLDhCQUE4Qix3QkFBd0IsZUFBZSxRQUFRO0FBRXpKLGdCQUFnQixNQUFNLDBDQUEwQyxRQUFRO0FBQUEsRUFDdkUsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sVUFBVSxrREFBa0QsZ0NBQWdDO0FBQUEsTUFDbkcsSUFBSTtBQUFBLE1BQ0osY0FBYyxlQUFlLE9BQU8sVUFBVSxnQkFBZ0Isa0JBQWtCLElBQUksSUFBSTtBQUFBLE1BQ3hGLFVBQVUsV0FBVztBQUFBLElBQ3RCLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFDQSxJQUFJLFVBQWtDO0FBQ3JDLFVBQU0saUJBQWlCLFNBQVMsSUFBSSxlQUFlO0FBQ25ELFVBQU0sVUFBVSxJQUFJLFFBQVEsMEJBQTBCLGNBQWM7QUFFcEUsVUFBTSxjQUFjLFFBQVEsV0FBVyxhQUFhLFNBQVMsY0FBYyxJQUFJO0FBQy9FLGdCQUFZLG9CQUFvQixJQUFJO0FBQ3BDLFlBQVEsWUFBWTtBQUFBLEVBQ3JCO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
