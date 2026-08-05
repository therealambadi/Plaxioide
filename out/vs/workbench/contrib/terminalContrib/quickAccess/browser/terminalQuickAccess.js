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
import { localize } from "../../../../../nls.js";
import { PickerQuickAccessProvider, TriggerAction } from "../../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { matchesFuzzy } from "../../../../../base/common/filters.js";
import { ITerminalEditorService, ITerminalGroupService, ITerminalService } from "../../../terminal/browser/terminal.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { TerminalCommandId } from "../../../terminal/common/terminal.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { killTerminalIcon, renameTerminalIcon } from "../../../terminal/browser/terminalIcons.js";
import { getColorClass, getIconId, getUriClasses } from "../../../terminal/browser/terminalIcon.js";
import { terminalStrings } from "../../../terminal/common/terminalStrings.js";
import { TerminalLocation } from "../../../../../platform/terminal/common/terminal.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
let terminalPicks = [];
let TerminalQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(_commandService, _editorService, _instantiationService, _terminalEditorService, _terminalGroupService, _terminalService, _themeService) {
    super(TerminalQuickAccessProvider.PREFIX, { canAcceptInBackground: true });
    this._commandService = _commandService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._terminalEditorService = _terminalEditorService;
    this._terminalGroupService = _terminalGroupService;
    this._terminalService = _terminalService;
    this._themeService = _themeService;
  }
  _getPicks(filter) {
    terminalPicks = [];
    terminalPicks.push({ type: "separator", label: "panel" });
    const terminalGroups = this._terminalGroupService.groups;
    for (let groupIndex = 0; groupIndex < terminalGroups.length; groupIndex++) {
      const terminalGroup = terminalGroups[groupIndex];
      for (let terminalIndex = 0; terminalIndex < terminalGroup.terminalInstances.length; terminalIndex++) {
        const terminal = terminalGroup.terminalInstances[terminalIndex];
        const pick = this._createPick(terminal, terminalIndex, filter, { groupIndex, groupSize: terminalGroup.terminalInstances.length });
        if (pick) {
          terminalPicks.push(pick);
        }
      }
    }
    if (terminalPicks.length > 0) {
      terminalPicks.push({ type: "separator", label: "editor" });
    }
    const terminalEditors = this._terminalEditorService.instances;
    for (let editorIndex = 0; editorIndex < terminalEditors.length; editorIndex++) {
      const term = terminalEditors[editorIndex];
      term.target = TerminalLocation.Editor;
      const pick = this._createPick(term, editorIndex, filter);
      if (pick) {
        terminalPicks.push(pick);
      }
    }
    if (terminalPicks.length > 0) {
      terminalPicks.push({ type: "separator" });
    }
    const createTerminalLabel = localize("workbench.action.terminal.newplus", "Create New Terminal");
    terminalPicks.push({
      label: `$(plus) ${createTerminalLabel}`,
      ariaLabel: createTerminalLabel,
      accept: () => this._commandService.executeCommand(TerminalCommandId.New)
    });
    const createWithProfileLabel = localize("workbench.action.terminal.newWithProfilePlus", "Create New Terminal With Profile...");
    terminalPicks.push({
      label: `$(plus) ${createWithProfileLabel}`,
      ariaLabel: createWithProfileLabel,
      accept: () => this._commandService.executeCommand(TerminalCommandId.NewWithProfile)
    });
    return terminalPicks;
  }
  _createPick(terminal, terminalIndex, filter, groupInfo) {
    const iconId = this._instantiationService.invokeFunction(getIconId, terminal);
    const index = groupInfo ? groupInfo.groupSize > 1 ? `${groupInfo.groupIndex + 1}.${terminalIndex + 1}` : `${groupInfo.groupIndex + 1}` : `${terminalIndex + 1}`;
    const label = `$(${iconId}) ${index}: ${terminal.title}`;
    const iconClasses = [];
    const colorClass = getColorClass(terminal);
    if (colorClass) {
      iconClasses.push(colorClass);
    }
    const uriClasses = getUriClasses(terminal, this._themeService.getColorTheme().type);
    if (uriClasses) {
      iconClasses.push(...uriClasses);
    }
    const highlights = matchesFuzzy(filter, label, true);
    if (highlights) {
      return {
        label,
        description: terminal.description,
        highlights: { label: highlights },
        buttons: [
          {
            iconClass: ThemeIcon.asClassName(renameTerminalIcon),
            tooltip: localize("renameTerminal", "Rename Terminal")
          },
          {
            iconClass: ThemeIcon.asClassName(killTerminalIcon),
            tooltip: terminalStrings.kill.value
          }
        ],
        iconClasses,
        trigger: (buttonIndex) => {
          switch (buttonIndex) {
            case 0:
              this._commandService.executeCommand(TerminalCommandId.Rename, terminal);
              return TriggerAction.NO_ACTION;
            case 1:
              this._terminalService.safeDisposeTerminal(terminal);
              return TriggerAction.REMOVE_ITEM;
          }
          return TriggerAction.NO_ACTION;
        },
        accept: (keyMod, event) => {
          if (terminal.target === TerminalLocation.Editor) {
            const existingEditors = this._editorService.findEditors(terminal.resource);
            this._terminalEditorService.openEditor(terminal, { viewColumn: existingEditors?.[0].groupId });
            this._terminalEditorService.setActiveInstance(terminal);
          } else {
            this._terminalGroupService.showPanel(!event.inBackground);
            this._terminalGroupService.setActiveInstance(terminal);
          }
        }
      };
    }
    return void 0;
  }
};
TerminalQuickAccessProvider.PREFIX = "term ";
TerminalQuickAccessProvider = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ITerminalEditorService),
  __decorateParam(4, ITerminalGroupService),
  __decorateParam(5, ITerminalService),
  __decorateParam(6, IThemeService)
], TerminalQuickAccessProvider);
export {
  TerminalQuickAccessProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvcXVpY2tBY2Nlc3MvYnJvd3Nlci90ZXJtaW5hbFF1aWNrQWNjZXNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVF1aWNrUGlja1NlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVBpY2tlclF1aWNrQWNjZXNzSXRlbSwgUGlja2VyUXVpY2tBY2Nlc3NQcm92aWRlciwgVHJpZ2dlckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci9waWNrZXJRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBtYXRjaGVzRnV6enkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbEVkaXRvclNlcnZpY2UsIElUZXJtaW5hbEdyb3VwU2VydmljZSwgSVRlcm1pbmFsSW5zdGFuY2UsIElUZXJtaW5hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENvbW1hbmRJZCB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsga2lsbFRlcm1pbmFsSWNvbiwgcmVuYW1lVGVybWluYWxJY29uIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEljb25zLmpzJztcbmltcG9ydCB7IGdldENvbG9yQ2xhc3MsIGdldEljb25JZCwgZ2V0VXJpQ2xhc3NlcyB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWxJY29uLmpzJztcbmltcG9ydCB7IHRlcm1pbmFsU3RyaW5ncyB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbFN0cmluZ3MuanMnO1xuaW1wb3J0IHsgVGVybWluYWxMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmxldCB0ZXJtaW5hbFBpY2tzOiBBcnJheTxJUGlja2VyUXVpY2tBY2Nlc3NJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4gPSBbXTtcblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsUXVpY2tBY2Nlc3NQcm92aWRlciBleHRlbmRzIFBpY2tlclF1aWNrQWNjZXNzUHJvdmlkZXI8SVBpY2tlclF1aWNrQWNjZXNzSXRlbT4ge1xuXG5cdHN0YXRpYyBQUkVGSVggPSAndGVybSAnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsRWRpdG9yU2VydmljZTogSVRlcm1pbmFsRWRpdG9yU2VydmljZSxcblx0XHRASVRlcm1pbmFsR3JvdXBTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlOiBJVGVybWluYWxHcm91cFNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxTZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoVGVybWluYWxRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCwgeyBjYW5BY2NlcHRJbkJhY2tncm91bmQ6IHRydWUgfSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFBpY2tzKGZpbHRlcjogc3RyaW5nKTogQXJyYXk8SVBpY2tlclF1aWNrQWNjZXNzSXRlbSB8IElRdWlja1BpY2tTZXBhcmF0b3I+IHtcblx0XHR0ZXJtaW5hbFBpY2tzID0gW107XG5cdFx0dGVybWluYWxQaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiAncGFuZWwnIH0pO1xuXHRcdGNvbnN0IHRlcm1pbmFsR3JvdXBzID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuZ3JvdXBzO1xuXHRcdGZvciAobGV0IGdyb3VwSW5kZXggPSAwOyBncm91cEluZGV4IDwgdGVybWluYWxHcm91cHMubGVuZ3RoOyBncm91cEluZGV4KyspIHtcblx0XHRcdGNvbnN0IHRlcm1pbmFsR3JvdXAgPSB0ZXJtaW5hbEdyb3Vwc1tncm91cEluZGV4XTtcblx0XHRcdGZvciAobGV0IHRlcm1pbmFsSW5kZXggPSAwOyB0ZXJtaW5hbEluZGV4IDwgdGVybWluYWxHcm91cC50ZXJtaW5hbEluc3RhbmNlcy5sZW5ndGg7IHRlcm1pbmFsSW5kZXgrKykge1xuXHRcdFx0XHRjb25zdCB0ZXJtaW5hbCA9IHRlcm1pbmFsR3JvdXAudGVybWluYWxJbnN0YW5jZXNbdGVybWluYWxJbmRleF07XG5cdFx0XHRcdGNvbnN0IHBpY2sgPSB0aGlzLl9jcmVhdGVQaWNrKHRlcm1pbmFsLCB0ZXJtaW5hbEluZGV4LCBmaWx0ZXIsIHsgZ3JvdXBJbmRleCwgZ3JvdXBTaXplOiB0ZXJtaW5hbEdyb3VwLnRlcm1pbmFsSW5zdGFuY2VzLmxlbmd0aCB9KTtcblx0XHRcdFx0aWYgKHBpY2spIHtcblx0XHRcdFx0XHR0ZXJtaW5hbFBpY2tzLnB1c2gocGljayk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGVybWluYWxQaWNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0ZXJtaW5hbFBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6ICdlZGl0b3InIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRlcm1pbmFsRWRpdG9ycyA9IHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZS5pbnN0YW5jZXM7XG5cdFx0Zm9yIChsZXQgZWRpdG9ySW5kZXggPSAwOyBlZGl0b3JJbmRleCA8IHRlcm1pbmFsRWRpdG9ycy5sZW5ndGg7IGVkaXRvckluZGV4KyspIHtcblx0XHRcdGNvbnN0IHRlcm0gPSB0ZXJtaW5hbEVkaXRvcnNbZWRpdG9ySW5kZXhdO1xuXHRcdFx0dGVybS50YXJnZXQgPSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvcjtcblx0XHRcdGNvbnN0IHBpY2sgPSB0aGlzLl9jcmVhdGVQaWNrKHRlcm0sIGVkaXRvckluZGV4LCBmaWx0ZXIpO1xuXHRcdFx0aWYgKHBpY2spIHtcblx0XHRcdFx0dGVybWluYWxQaWNrcy5wdXNoKHBpY2spO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0ZXJtaW5hbFBpY2tzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRlcm1pbmFsUGlja3MucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNyZWF0ZVRlcm1pbmFsTGFiZWwgPSBsb2NhbGl6ZShcIndvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3cGx1c1wiLCBcIkNyZWF0ZSBOZXcgVGVybWluYWxcIik7XG5cdFx0dGVybWluYWxQaWNrcy5wdXNoKHtcblx0XHRcdGxhYmVsOiBgJChwbHVzKSAke2NyZWF0ZVRlcm1pbmFsTGFiZWx9YCxcblx0XHRcdGFyaWFMYWJlbDogY3JlYXRlVGVybWluYWxMYWJlbCxcblx0XHRcdGFjY2VwdDogKCkgPT4gdGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoVGVybWluYWxDb21tYW5kSWQuTmV3KVxuXHRcdH0pO1xuXHRcdGNvbnN0IGNyZWF0ZVdpdGhQcm9maWxlTGFiZWwgPSBsb2NhbGl6ZShcIndvcmtiZW5jaC5hY3Rpb24udGVybWluYWwubmV3V2l0aFByb2ZpbGVQbHVzXCIsIFwiQ3JlYXRlIE5ldyBUZXJtaW5hbCBXaXRoIFByb2ZpbGUuLi5cIik7XG5cdFx0dGVybWluYWxQaWNrcy5wdXNoKHtcblx0XHRcdGxhYmVsOiBgJChwbHVzKSAke2NyZWF0ZVdpdGhQcm9maWxlTGFiZWx9YCxcblx0XHRcdGFyaWFMYWJlbDogY3JlYXRlV2l0aFByb2ZpbGVMYWJlbCxcblx0XHRcdGFjY2VwdDogKCkgPT4gdGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoVGVybWluYWxDb21tYW5kSWQuTmV3V2l0aFByb2ZpbGUpXG5cdFx0fSk7XG5cdFx0cmV0dXJuIHRlcm1pbmFsUGlja3M7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVQaWNrKHRlcm1pbmFsOiBJVGVybWluYWxJbnN0YW5jZSwgdGVybWluYWxJbmRleDogbnVtYmVyLCBmaWx0ZXI6IHN0cmluZywgZ3JvdXBJbmZvPzogeyBncm91cEluZGV4OiBudW1iZXI7IGdyb3VwU2l6ZTogbnVtYmVyIH0pOiBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBpY29uSWQgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihnZXRJY29uSWQsIHRlcm1pbmFsKTtcblx0XHRjb25zdCBpbmRleCA9IGdyb3VwSW5mb1xuXHRcdFx0PyAoZ3JvdXBJbmZvLmdyb3VwU2l6ZSA+IDFcblx0XHRcdFx0PyBgJHtncm91cEluZm8uZ3JvdXBJbmRleCArIDF9LiR7dGVybWluYWxJbmRleCArIDF9YFxuXHRcdFx0XHQ6IGAke2dyb3VwSW5mby5ncm91cEluZGV4ICsgMX1gKVxuXHRcdFx0OiBgJHt0ZXJtaW5hbEluZGV4ICsgMX1gO1xuXHRcdGNvbnN0IGxhYmVsID0gYCQoJHtpY29uSWR9KSAke2luZGV4fTogJHt0ZXJtaW5hbC50aXRsZX1gO1xuXHRcdGNvbnN0IGljb25DbGFzc2VzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbG9yQ2xhc3MgPSBnZXRDb2xvckNsYXNzKHRlcm1pbmFsKTtcblx0XHRpZiAoY29sb3JDbGFzcykge1xuXHRcdFx0aWNvbkNsYXNzZXMucHVzaChjb2xvckNsYXNzKTtcblx0XHR9XG5cdFx0Y29uc3QgdXJpQ2xhc3NlcyA9IGdldFVyaUNsYXNzZXModGVybWluYWwsIHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkudHlwZSk7XG5cdFx0aWYgKHVyaUNsYXNzZXMpIHtcblx0XHRcdGljb25DbGFzc2VzLnB1c2goLi4udXJpQ2xhc3Nlcyk7XG5cdFx0fVxuXHRcdGNvbnN0IGhpZ2hsaWdodHMgPSBtYXRjaGVzRnV6enkoZmlsdGVyLCBsYWJlbCwgdHJ1ZSk7XG5cdFx0aWYgKGhpZ2hsaWdodHMpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogdGVybWluYWwuZGVzY3JpcHRpb24sXG5cdFx0XHRcdGhpZ2hsaWdodHM6IHsgbGFiZWw6IGhpZ2hsaWdodHMgfSxcblx0XHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHJlbmFtZVRlcm1pbmFsSWNvbiksXG5cdFx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgncmVuYW1lVGVybWluYWwnLCBcIlJlbmFtZSBUZXJtaW5hbFwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoa2lsbFRlcm1pbmFsSWNvbiksXG5cdFx0XHRcdFx0XHR0b29sdGlwOiB0ZXJtaW5hbFN0cmluZ3Mua2lsbC52YWx1ZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0aWNvbkNsYXNzZXMsXG5cdFx0XHRcdHRyaWdnZXI6IGJ1dHRvbkluZGV4ID0+IHtcblx0XHRcdFx0XHRzd2l0Y2ggKGJ1dHRvbkluZGV4KSB7XG5cdFx0XHRcdFx0XHRjYXNlIDA6XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFRlcm1pbmFsQ29tbWFuZElkLlJlbmFtZSwgdGVybWluYWwpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gVHJpZ2dlckFjdGlvbi5OT19BQ1RJT047XG5cdFx0XHRcdFx0XHRjYXNlIDE6XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS5zYWZlRGlzcG9zZVRlcm1pbmFsKHRlcm1pbmFsKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIFRyaWdnZXJBY3Rpb24uUkVNT1ZFX0lURU07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIFRyaWdnZXJBY3Rpb24uTk9fQUNUSU9OO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRhY2NlcHQ6IChrZXlNb2QsIGV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRlcm1pbmFsLnRhcmdldCA9PT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGV4aXN0aW5nRWRpdG9ycyA9IHRoaXMuX2VkaXRvclNlcnZpY2UuZmluZEVkaXRvcnModGVybWluYWwucmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0dGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IodGVybWluYWwsIHsgdmlld0NvbHVtbjogZXhpc3RpbmdFZGl0b3JzPy5bMF0uZ3JvdXBJZCB9KTtcblx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsRWRpdG9yU2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZSh0ZXJtaW5hbCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNob3dQYW5lbCghZXZlbnQuaW5CYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNldEFjdGl2ZUluc3RhbmNlKHRlcm1pbmFsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFFekIsU0FBaUMsMkJBQTJCLHFCQUFxQjtBQUNqRixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHdCQUF3Qix1QkFBMEMsd0JBQXdCO0FBQ25HLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsa0JBQWtCLDBCQUEwQjtBQUNyRCxTQUFTLGVBQWUsV0FBVyxxQkFBcUI7QUFDeEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw2QkFBNkI7QUFDdEMsSUFBSSxnQkFBcUUsQ0FBQztBQUVuRSxJQUFNLDhCQUFOLGNBQTBDLDBCQUFrRDtBQUFBLEVBSWxHLFlBQ21DLGlCQUNELGdCQUNPLHVCQUNDLHdCQUNELHVCQUNMLGtCQUNILGVBQy9CO0FBQ0QsVUFBTSw0QkFBNEIsUUFBUSxFQUFFLHVCQUF1QixLQUFLLENBQUM7QUFSdkM7QUFDRDtBQUNPO0FBQ0M7QUFDRDtBQUNMO0FBQ0g7QUFBQSxFQUdqQztBQUFBLEVBRVUsVUFBVSxRQUFxRTtBQUN4RixvQkFBZ0IsQ0FBQztBQUNqQixrQkFBYyxLQUFLLEVBQUUsTUFBTSxhQUFhLE9BQU8sUUFBUSxDQUFDO0FBQ3hELFVBQU0saUJBQWlCLEtBQUssc0JBQXNCO0FBQ2xELGFBQVMsYUFBYSxHQUFHLGFBQWEsZUFBZSxRQUFRLGNBQWM7QUFDMUUsWUFBTSxnQkFBZ0IsZUFBZSxVQUFVO0FBQy9DLGVBQVMsZ0JBQWdCLEdBQUcsZ0JBQWdCLGNBQWMsa0JBQWtCLFFBQVEsaUJBQWlCO0FBQ3BHLGNBQU0sV0FBVyxjQUFjLGtCQUFrQixhQUFhO0FBQzlELGNBQU0sT0FBTyxLQUFLLFlBQVksVUFBVSxlQUFlLFFBQVEsRUFBRSxZQUFZLFdBQVcsY0FBYyxrQkFBa0IsT0FBTyxDQUFDO0FBQ2hJLFlBQUksTUFBTTtBQUNULHdCQUFjLEtBQUssSUFBSTtBQUFBLFFBQ3hCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxRQUFJLGNBQWMsU0FBUyxHQUFHO0FBQzdCLG9CQUFjLEtBQUssRUFBRSxNQUFNLGFBQWEsT0FBTyxTQUFTLENBQUM7QUFBQSxJQUMxRDtBQUVBLFVBQU0sa0JBQWtCLEtBQUssdUJBQXVCO0FBQ3BELGFBQVMsY0FBYyxHQUFHLGNBQWMsZ0JBQWdCLFFBQVEsZUFBZTtBQUM5RSxZQUFNLE9BQU8sZ0JBQWdCLFdBQVc7QUFDeEMsV0FBSyxTQUFTLGlCQUFpQjtBQUMvQixZQUFNLE9BQU8sS0FBSyxZQUFZLE1BQU0sYUFBYSxNQUFNO0FBQ3ZELFVBQUksTUFBTTtBQUNULHNCQUFjLEtBQUssSUFBSTtBQUFBLE1BQ3hCO0FBQUEsSUFDRDtBQUVBLFFBQUksY0FBYyxTQUFTLEdBQUc7QUFDN0Isb0JBQWMsS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQUEsSUFDekM7QUFFQSxVQUFNLHNCQUFzQixTQUFTLHFDQUFxQyxxQkFBcUI7QUFDL0Ysa0JBQWMsS0FBSztBQUFBLE1BQ2xCLE9BQU8sV0FBVyxtQkFBbUI7QUFBQSxNQUNyQyxXQUFXO0FBQUEsTUFDWCxRQUFRLE1BQU0sS0FBSyxnQkFBZ0IsZUFBZSxrQkFBa0IsR0FBRztBQUFBLElBQ3hFLENBQUM7QUFDRCxVQUFNLHlCQUF5QixTQUFTLGdEQUFnRCxxQ0FBcUM7QUFDN0gsa0JBQWMsS0FBSztBQUFBLE1BQ2xCLE9BQU8sV0FBVyxzQkFBc0I7QUFBQSxNQUN4QyxXQUFXO0FBQUEsTUFDWCxRQUFRLE1BQU0sS0FBSyxnQkFBZ0IsZUFBZSxrQkFBa0IsY0FBYztBQUFBLElBQ25GLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsWUFBWSxVQUE2QixlQUF1QixRQUFnQixXQUEyRjtBQUNsTCxVQUFNLFNBQVMsS0FBSyxzQkFBc0IsZUFBZSxXQUFXLFFBQVE7QUFDNUUsVUFBTSxRQUFRLFlBQ1YsVUFBVSxZQUFZLElBQ3RCLEdBQUcsVUFBVSxhQUFhLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxLQUNoRCxHQUFHLFVBQVUsYUFBYSxDQUFDLEtBQzVCLEdBQUcsZ0JBQWdCLENBQUM7QUFDdkIsVUFBTSxRQUFRLEtBQUssTUFBTSxLQUFLLEtBQUssS0FBSyxTQUFTLEtBQUs7QUFDdEQsVUFBTSxjQUF3QixDQUFDO0FBQy9CLFVBQU0sYUFBYSxjQUFjLFFBQVE7QUFDekMsUUFBSSxZQUFZO0FBQ2Ysa0JBQVksS0FBSyxVQUFVO0FBQUEsSUFDNUI7QUFDQSxVQUFNLGFBQWEsY0FBYyxVQUFVLEtBQUssY0FBYyxjQUFjLEVBQUUsSUFBSTtBQUNsRixRQUFJLFlBQVk7QUFDZixrQkFBWSxLQUFLLEdBQUcsVUFBVTtBQUFBLElBQy9CO0FBQ0EsVUFBTSxhQUFhLGFBQWEsUUFBUSxPQUFPLElBQUk7QUFDbkQsUUFBSSxZQUFZO0FBQ2YsYUFBTztBQUFBLFFBQ047QUFBQSxRQUNBLGFBQWEsU0FBUztBQUFBLFFBQ3RCLFlBQVksRUFBRSxPQUFPLFdBQVc7QUFBQSxRQUNoQyxTQUFTO0FBQUEsVUFDUjtBQUFBLFlBQ0MsV0FBVyxVQUFVLFlBQVksa0JBQWtCO0FBQUEsWUFDbkQsU0FBUyxTQUFTLGtCQUFrQixpQkFBaUI7QUFBQSxVQUN0RDtBQUFBLFVBQ0E7QUFBQSxZQUNDLFdBQVcsVUFBVSxZQUFZLGdCQUFnQjtBQUFBLFlBQ2pELFNBQVMsZ0JBQWdCLEtBQUs7QUFBQSxVQUMvQjtBQUFBLFFBQ0Q7QUFBQSxRQUNBO0FBQUEsUUFDQSxTQUFTLGlCQUFlO0FBQ3ZCLGtCQUFRLGFBQWE7QUFBQSxZQUNwQixLQUFLO0FBQ0osbUJBQUssZ0JBQWdCLGVBQWUsa0JBQWtCLFFBQVEsUUFBUTtBQUN0RSxxQkFBTyxjQUFjO0FBQUEsWUFDdEIsS0FBSztBQUNKLG1CQUFLLGlCQUFpQixvQkFBb0IsUUFBUTtBQUNsRCxxQkFBTyxjQUFjO0FBQUEsVUFDdkI7QUFFQSxpQkFBTyxjQUFjO0FBQUEsUUFDdEI7QUFBQSxRQUNBLFFBQVEsQ0FBQyxRQUFRLFVBQVU7QUFDMUIsY0FBSSxTQUFTLFdBQVcsaUJBQWlCLFFBQVE7QUFDaEQsa0JBQU0sa0JBQWtCLEtBQUssZUFBZSxZQUFZLFNBQVMsUUFBUTtBQUN6RSxpQkFBSyx1QkFBdUIsV0FBVyxVQUFVLEVBQUUsWUFBWSxrQkFBa0IsQ0FBQyxFQUFFLFFBQVEsQ0FBQztBQUM3RixpQkFBSyx1QkFBdUIsa0JBQWtCLFFBQVE7QUFBQSxVQUN2RCxPQUFPO0FBQ04saUJBQUssc0JBQXNCLFVBQVUsQ0FBQyxNQUFNLFlBQVk7QUFDeEQsaUJBQUssc0JBQXNCLGtCQUFrQixRQUFRO0FBQUEsVUFDdEQ7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBNUhhLDRCQUVMLFNBQVM7QUFGSiw4QkFBTjtBQUFBLEVBS0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVhVOyIsCiAgIm5hbWVzIjogW10KfQo=
