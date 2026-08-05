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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorunWithStore, observableSignalFromEvent } from "../../../../../base/common/observable.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { InlineEditTriggerKind } from "../../../../common/languages.js";
import { ILanguageFeaturesService } from "../../../../common/services/languageFeatures.js";
let InlineEditsAdapterContribution = class extends Disposable {
  constructor(_editor, instantiationService) {
    super();
    this.instantiationService = instantiationService;
    if (InlineEditsAdapterContribution.isFirst) {
      InlineEditsAdapterContribution.isFirst = false;
      this.instantiationService.createInstance(InlineEditsAdapter);
    }
  }
};
InlineEditsAdapterContribution.ID = "editor.contrib.inlineEditsAdapter";
InlineEditsAdapterContribution.isFirst = true;
InlineEditsAdapterContribution = __decorateClass([
  __decorateParam(1, IInstantiationService)
], InlineEditsAdapterContribution);
let InlineEditsAdapter = class extends Disposable {
  constructor(_languageFeaturesService, _commandService) {
    super();
    this._languageFeaturesService = _languageFeaturesService;
    this._commandService = _commandService;
    const didChangeSignal = observableSignalFromEvent("didChangeSignal", this._languageFeaturesService.inlineEditProvider.onDidChange);
    this._register(autorunWithStore((reader, store) => {
      didChangeSignal.read(reader);
      store.add(this._languageFeaturesService.inlineCompletionsProvider.register("*", {
        async provideInlineCompletions(model, position, context, token) {
          if (!context.includeInlineEdits) {
            return void 0;
          }
          const allInlineEditProvider = _languageFeaturesService.inlineEditProvider.all(model);
          const inlineEdits = await Promise.all(allInlineEditProvider.map(async (provider) => {
            const result = await provider.provideInlineEdit(model, {
              triggerKind: InlineEditTriggerKind.Automatic,
              requestUuid: context.requestUuid
            }, token);
            if (!result) {
              return void 0;
            }
            return { result, provider };
          }));
          const definedEdits = inlineEdits.filter((e) => !!e);
          return {
            edits: definedEdits,
            items: definedEdits.map((e) => {
              return {
                range: e.result.range,
                showRange: e.result.showRange,
                insertText: e.result.text,
                command: e.result.accepted,
                shownCommand: e.result.shown,
                action: e.result.action,
                isInlineEdit: true,
                edit: e.result
              };
            }),
            commands: definedEdits.flatMap((e) => e.result.commands ?? []),
            enableForwardStability: true
          };
        },
        handleRejection: (completions, item) => {
          if (item.edit.rejected) {
            this._commandService.executeCommand(item.edit.rejected.id, ...item.edit.rejected.arguments ?? []);
          }
        },
        freeInlineCompletions(c) {
          for (const e of c.edits) {
            e.provider.freeInlineEdit(e.result);
          }
        },
        toString() {
          return "InlineEditsAdapter";
        }
      }));
    }));
  }
};
InlineEditsAdapter = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, ICommandService)
], InlineEditsAdapter);
export {
  InlineEditsAdapter,
  InlineEditsAdapterContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL21vZGVsL2lubGluZUVkaXRzQWRhcHRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1bldpdGhTdG9yZSwgb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJSW5saW5lRWRpdCwgSW5saW5lQ29tcGxldGlvbiwgSW5saW5lQ29tcGxldGlvbkNvbnRleHQsIElubGluZUNvbXBsZXRpb25zLCBJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyLCBJbmxpbmVFZGl0UHJvdmlkZXIsIElubGluZUVkaXRUcmlnZ2VyS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVFZGl0c0FkYXB0ZXJDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHN0YXRpYyBJRCA9ICdlZGl0b3IuY29udHJpYi5pbmxpbmVFZGl0c0FkYXB0ZXInO1xuXHRwdWJsaWMgc3RhdGljIGlzRmlyc3QgPSB0cnVlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKElubGluZUVkaXRzQWRhcHRlckNvbnRyaWJ1dGlvbi5pc0ZpcnN0KSB7XG5cdFx0XHRJbmxpbmVFZGl0c0FkYXB0ZXJDb250cmlidXRpb24uaXNGaXJzdCA9IGZhbHNlO1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbmxpbmVFZGl0c0FkYXB0ZXIpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5saW5lRWRpdHNBZGFwdGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBkaWRDaGFuZ2VTaWduYWwgPSBvYnNlcnZhYmxlU2lnbmFsRnJvbUV2ZW50KCdkaWRDaGFuZ2VTaWduYWwnLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbmxpbmVFZGl0UHJvdmlkZXIub25EaWRDaGFuZ2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bldpdGhTdG9yZSgocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0ZGlkQ2hhbmdlU2lnbmFsLnJlYWQocmVhZGVyKTtcblxuXHRcdFx0dHlwZSBJbmxpbmVDb21wbGV0aW9uc0FuZEVkaXRzID0gSW5saW5lQ29tcGxldGlvbnM8SW5saW5lQ29tcGxldGlvbiAmIHsgZWRpdDogSUlubGluZUVkaXQgfT4gJiB7XG5cdFx0XHRcdGVkaXRzOiB7XG5cdFx0XHRcdFx0cmVzdWx0OiBJSW5saW5lRWRpdDtcblx0XHRcdFx0XHRwcm92aWRlcjogSW5saW5lRWRpdFByb3ZpZGVyPElJbmxpbmVFZGl0Pjtcblx0XHRcdFx0fVtdO1xuXHRcdFx0fTtcblxuXHRcdFx0c3RvcmUuYWRkKHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGluZUNvbXBsZXRpb25zUHJvdmlkZXIucmVnaXN0ZXIoJyonLCB7XG5cdFx0XHRcdGFzeW5jIHByb3ZpZGVJbmxpbmVDb21wbGV0aW9ucyhtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBjb250ZXh0OiBJbmxpbmVDb21wbGV0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJbmxpbmVDb21wbGV0aW9uc0FuZEVkaXRzIHwgdW5kZWZpbmVkPiB7XG5cdFx0XHRcdFx0aWYgKCFjb250ZXh0LmluY2x1ZGVJbmxpbmVFZGl0cykgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cblx0XHRcdFx0XHRjb25zdCBhbGxJbmxpbmVFZGl0UHJvdmlkZXIgPSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW5saW5lRWRpdFByb3ZpZGVyLmFsbChtb2RlbCk7XG5cdFx0XHRcdFx0Y29uc3QgaW5saW5lRWRpdHMgPSBhd2FpdCBQcm9taXNlLmFsbChhbGxJbmxpbmVFZGl0UHJvdmlkZXIubWFwKGFzeW5jIHByb3ZpZGVyID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVJbmxpbmVFZGl0KG1vZGVsLCB7XG5cdFx0XHRcdFx0XHRcdHRyaWdnZXJLaW5kOiBJbmxpbmVFZGl0VHJpZ2dlcktpbmQuQXV0b21hdGljLFxuXHRcdFx0XHRcdFx0XHRyZXF1ZXN0VXVpZDogY29udGV4dC5yZXF1ZXN0VXVpZFxuXHRcdFx0XHRcdFx0fSwgdG9rZW4pO1xuXHRcdFx0XHRcdFx0aWYgKCFyZXN1bHQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdFx0XHRcdFx0cmV0dXJuIHsgcmVzdWx0LCBwcm92aWRlciB9O1xuXHRcdFx0XHRcdH0pKTtcblxuXHRcdFx0XHRcdGNvbnN0IGRlZmluZWRFZGl0cyA9IGlubGluZUVkaXRzLmZpbHRlcihlID0+ICEhZSk7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGVkaXRzOiBkZWZpbmVkRWRpdHMsXG5cdFx0XHRcdFx0XHRpdGVtczogZGVmaW5lZEVkaXRzLm1hcChlID0+IHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRyYW5nZTogZS5yZXN1bHQucmFuZ2UsXG5cdFx0XHRcdFx0XHRcdFx0c2hvd1JhbmdlOiBlLnJlc3VsdC5zaG93UmFuZ2UsXG5cdFx0XHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogZS5yZXN1bHQudGV4dCxcblx0XHRcdFx0XHRcdFx0XHRjb21tYW5kOiBlLnJlc3VsdC5hY2NlcHRlZCxcblx0XHRcdFx0XHRcdFx0XHRzaG93bkNvbW1hbmQ6IGUucmVzdWx0LnNob3duLFxuXHRcdFx0XHRcdFx0XHRcdGFjdGlvbjogZS5yZXN1bHQuYWN0aW9uLFxuXHRcdFx0XHRcdFx0XHRcdGlzSW5saW5lRWRpdDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRlZGl0OiBlLnJlc3VsdCxcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdFx0Y29tbWFuZHM6IGRlZmluZWRFZGl0cy5mbGF0TWFwKGUgPT4gZS5yZXN1bHQuY29tbWFuZHMgPz8gW10pLFxuXHRcdFx0XHRcdFx0ZW5hYmxlRm9yd2FyZFN0YWJpbGl0eTogdHJ1ZSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRoYW5kbGVSZWplY3Rpb246IChjb21wbGV0aW9uczogSW5saW5lQ29tcGxldGlvbnMsIGl0ZW06IElubGluZUNvbXBsZXRpb25zQW5kRWRpdHNbJ2l0ZW1zJ11bbnVtYmVyXSk6IHZvaWQgPT4ge1xuXHRcdFx0XHRcdGlmIChpdGVtLmVkaXQucmVqZWN0ZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGl0ZW0uZWRpdC5yZWplY3RlZC5pZCwgLi4uKGl0ZW0uZWRpdC5yZWplY3RlZC5hcmd1bWVudHMgPz8gW10pKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZyZWVJbmxpbmVDb21wbGV0aW9ucyhjOiBJbmxpbmVDb21wbGV0aW9uc0FuZEVkaXRzKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBlIG9mIGMuZWRpdHMpIHtcblx0XHRcdFx0XHRcdGUucHJvdmlkZXIuZnJlZUlubGluZUVkaXQoZS5yZXN1bHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0dG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRcdFx0XHRyZXR1cm4gJ0lubGluZUVkaXRzQWRhcHRlcic7XG5cdFx0XHRcdH1cblx0XHRcdH0gc2F0aXNmaWVzIElubGluZUNvbXBsZXRpb25zUHJvdmlkZXI8SW5saW5lQ29tcGxldGlvbnNBbmRFZGl0cz4pKTtcblx0XHR9KSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0IsaUNBQWlDO0FBQzVELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBR3RDLFNBQW1JLDZCQUE2QjtBQUVoSyxTQUFTLGdDQUFnQztBQUVsQyxJQUFNLGlDQUFOLGNBQTZDLFdBQVc7QUFBQSxFQUk5RCxZQUNDLFNBQ3dDLHNCQUN2QztBQUNELFVBQU07QUFGa0M7QUFJeEMsUUFBSSwrQkFBK0IsU0FBUztBQUMzQyxxQ0FBK0IsVUFBVTtBQUN6QyxXQUFLLHFCQUFxQixlQUFlLGtCQUFrQjtBQUFBLElBQzVEO0FBQUEsRUFDRDtBQUNEO0FBZmEsK0JBQ0UsS0FBSztBQURQLCtCQUVFLFVBQVU7QUFGWixpQ0FBTjtBQUFBLEVBTUo7QUFBQSxHQU5VO0FBaUJOLElBQU0scUJBQU4sY0FBaUMsV0FBVztBQUFBLEVBQ2xELFlBQzRDLDBCQUNULGlCQUNqQztBQUNELFVBQU07QUFIcUM7QUFDVDtBQUlsQyxVQUFNLGtCQUFrQiwwQkFBMEIsbUJBQW1CLEtBQUsseUJBQXlCLG1CQUFtQixXQUFXO0FBRWpJLFNBQUssVUFBVSxpQkFBaUIsQ0FBQyxRQUFRLFVBQVU7QUFDbEQsc0JBQWdCLEtBQUssTUFBTTtBQVMzQixZQUFNLElBQUksS0FBSyx5QkFBeUIsMEJBQTBCLFNBQVMsS0FBSztBQUFBLFFBQy9FLE1BQU0seUJBQXlCLE9BQW1CLFVBQW9CLFNBQWtDLE9BQTBFO0FBQ2pMLGNBQUksQ0FBQyxRQUFRLG9CQUFvQjtBQUFFLG1CQUFPO0FBQUEsVUFBVztBQUVyRCxnQkFBTSx3QkFBd0IseUJBQXlCLG1CQUFtQixJQUFJLEtBQUs7QUFDbkYsZ0JBQU0sY0FBYyxNQUFNLFFBQVEsSUFBSSxzQkFBc0IsSUFBSSxPQUFNLGFBQVk7QUFDakYsa0JBQU0sU0FBUyxNQUFNLFNBQVMsa0JBQWtCLE9BQU87QUFBQSxjQUN0RCxhQUFhLHNCQUFzQjtBQUFBLGNBQ25DLGFBQWEsUUFBUTtBQUFBLFlBQ3RCLEdBQUcsS0FBSztBQUNSLGdCQUFJLENBQUMsUUFBUTtBQUFFLHFCQUFPO0FBQUEsWUFBVztBQUNqQyxtQkFBTyxFQUFFLFFBQVEsU0FBUztBQUFBLFVBQzNCLENBQUMsQ0FBQztBQUVGLGdCQUFNLGVBQWUsWUFBWSxPQUFPLE9BQUssQ0FBQyxDQUFDLENBQUM7QUFDaEQsaUJBQU87QUFBQSxZQUNOLE9BQU87QUFBQSxZQUNQLE9BQU8sYUFBYSxJQUFJLE9BQUs7QUFDNUIscUJBQU87QUFBQSxnQkFDTixPQUFPLEVBQUUsT0FBTztBQUFBLGdCQUNoQixXQUFXLEVBQUUsT0FBTztBQUFBLGdCQUNwQixZQUFZLEVBQUUsT0FBTztBQUFBLGdCQUNyQixTQUFTLEVBQUUsT0FBTztBQUFBLGdCQUNsQixjQUFjLEVBQUUsT0FBTztBQUFBLGdCQUN2QixRQUFRLEVBQUUsT0FBTztBQUFBLGdCQUNqQixjQUFjO0FBQUEsZ0JBQ2QsTUFBTSxFQUFFO0FBQUEsY0FDVDtBQUFBLFlBQ0QsQ0FBQztBQUFBLFlBQ0QsVUFBVSxhQUFhLFFBQVEsT0FBSyxFQUFFLE9BQU8sWUFBWSxDQUFDLENBQUM7QUFBQSxZQUMzRCx3QkFBd0I7QUFBQSxVQUN6QjtBQUFBLFFBQ0Q7QUFBQSxRQUNBLGlCQUFpQixDQUFDLGFBQWdDLFNBQTJEO0FBQzVHLGNBQUksS0FBSyxLQUFLLFVBQVU7QUFDdkIsaUJBQUssZ0JBQWdCLGVBQWUsS0FBSyxLQUFLLFNBQVMsSUFBSSxHQUFJLEtBQUssS0FBSyxTQUFTLGFBQWEsQ0FBQyxDQUFFO0FBQUEsVUFDbkc7QUFBQSxRQUNEO0FBQUEsUUFDQSxzQkFBc0IsR0FBOEI7QUFDbkQscUJBQVcsS0FBSyxFQUFFLE9BQU87QUFDeEIsY0FBRSxTQUFTLGVBQWUsRUFBRSxNQUFNO0FBQUEsVUFDbkM7QUFBQSxRQUNEO0FBQUEsUUFDQSxXQUFtQjtBQUNsQixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNELENBQWdFLENBQUM7QUFBQSxJQUNsRSxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQ0Q7QUFwRWEscUJBQU47QUFBQSxFQUVKO0FBQUEsRUFDQTtBQUFBLEdBSFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
