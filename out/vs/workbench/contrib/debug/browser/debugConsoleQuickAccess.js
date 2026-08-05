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
import { matchesFuzzy } from "../../../../base/common/filters.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { PickerQuickAccessProvider } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { DEBUG_CONSOLE_QUICK_ACCESS_PREFIX, SELECT_AND_START_ID } from "./debugCommands.js";
import { IDebugService, REPL_VIEW_ID } from "../common/debug.js";
let DebugConsoleQuickAccess = class extends PickerQuickAccessProvider {
  constructor(_debugService, _viewsService, _commandService) {
    super(DEBUG_CONSOLE_QUICK_ACCESS_PREFIX, { canAcceptInBackground: true });
    this._debugService = _debugService;
    this._viewsService = _viewsService;
    this._commandService = _commandService;
  }
  _getPicks(filter, disposables, token) {
    const debugConsolePicks = [];
    this._debugService.getModel().getSessions(true).filter((s) => s.hasSeparateRepl()).forEach((session, index) => {
      const pick = this._createPick(session, index, filter);
      if (pick) {
        debugConsolePicks.push(pick);
      }
    });
    if (debugConsolePicks.length > 0) {
      debugConsolePicks.push({ type: "separator" });
    }
    const createTerminalLabel = localize("workbench.action.debug.startDebug", "Start a New Debug Session");
    debugConsolePicks.push({
      label: `$(plus) ${createTerminalLabel}`,
      ariaLabel: createTerminalLabel,
      accept: () => this._commandService.executeCommand(SELECT_AND_START_ID)
    });
    return debugConsolePicks;
  }
  _createPick(session, sessionIndex, filter) {
    const label = session.name;
    const highlights = matchesFuzzy(filter, label, true);
    if (highlights) {
      return {
        label,
        highlights: { label: highlights },
        accept: (keyMod, event) => {
          this._debugService.focusStackFrame(void 0, void 0, session, { explicit: true });
          if (!this._viewsService.isViewVisible(REPL_VIEW_ID)) {
            this._viewsService.openView(REPL_VIEW_ID, true);
          }
        }
      };
    }
    return void 0;
  }
};
DebugConsoleQuickAccess = __decorateClass([
  __decorateParam(0, IDebugService),
  __decorateParam(1, IViewsService),
  __decorateParam(2, ICommandService)
], DebugConsoleQuickAccess);
export {
  DebugConsoleQuickAccess
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnQ29uc29sZVF1aWNrQWNjZXNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IG1hdGNoZXNGdXp6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBGYXN0QW5kU2xvd1BpY2tzLCBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtLCBQaWNrZXJRdWlja0FjY2Vzc1Byb3ZpZGVyLCBQaWNrcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci9waWNrZXJRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBERUJVR19DT05TT0xFX1FVSUNLX0FDQ0VTU19QUkVGSVgsIFNFTEVDVF9BTkRfU1RBUlRfSUQgfSBmcm9tICcuL2RlYnVnQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSURlYnVnU2VydmljZSwgSURlYnVnU2Vzc2lvbiwgUkVQTF9WSUVXX0lEIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcblxuZXhwb3J0IGNsYXNzIERlYnVnQ29uc29sZVF1aWNrQWNjZXNzIGV4dGVuZHMgUGlja2VyUXVpY2tBY2Nlc3NQcm92aWRlcjxJUGlja2VyUXVpY2tBY2Nlc3NJdGVtPiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElEZWJ1Z1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJVmlld3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKERFQlVHX0NPTlNPTEVfUVVJQ0tfQUNDRVNTX1BSRUZJWCwgeyBjYW5BY2NlcHRJbkJhY2tncm91bmQ6IHRydWUgfSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFBpY2tzKGZpbHRlcjogc3RyaW5nLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQaWNrczxJUGlja2VyUXVpY2tBY2Nlc3NJdGVtPiB8IFByb21pc2U8UGlja3M8SVBpY2tlclF1aWNrQWNjZXNzSXRlbT4+IHwgRmFzdEFuZFNsb3dQaWNrczxJUGlja2VyUXVpY2tBY2Nlc3NJdGVtPiB8IG51bGwge1xuXHRcdGNvbnN0IGRlYnVnQ29uc29sZVBpY2tzOiBBcnJheTxJUGlja2VyUXVpY2tBY2Nlc3NJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4gPSBbXTtcblxuXHRcdHRoaXMuX2RlYnVnU2VydmljZS5nZXRNb2RlbCgpLmdldFNlc3Npb25zKHRydWUpLmZpbHRlcihzID0+IHMuaGFzU2VwYXJhdGVSZXBsKCkpLmZvckVhY2goKHNlc3Npb24sIGluZGV4KSA9PiB7XG5cdFx0XHRjb25zdCBwaWNrID0gdGhpcy5fY3JlYXRlUGljayhzZXNzaW9uLCBpbmRleCwgZmlsdGVyKTtcblx0XHRcdGlmIChwaWNrKSB7XG5cdFx0XHRcdGRlYnVnQ29uc29sZVBpY2tzLnB1c2gocGljayk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblxuXHRcdGlmIChkZWJ1Z0NvbnNvbGVQaWNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRkZWJ1Z0NvbnNvbGVQaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicgfSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3JlYXRlVGVybWluYWxMYWJlbCA9IGxvY2FsaXplKFwid29ya2JlbmNoLmFjdGlvbi5kZWJ1Zy5zdGFydERlYnVnXCIsIFwiU3RhcnQgYSBOZXcgRGVidWcgU2Vzc2lvblwiKTtcblx0XHRkZWJ1Z0NvbnNvbGVQaWNrcy5wdXNoKHtcblx0XHRcdGxhYmVsOiBgJChwbHVzKSAke2NyZWF0ZVRlcm1pbmFsTGFiZWx9YCxcblx0XHRcdGFyaWFMYWJlbDogY3JlYXRlVGVybWluYWxMYWJlbCxcblx0XHRcdGFjY2VwdDogKCkgPT4gdGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoU0VMRUNUX0FORF9TVEFSVF9JRClcblx0XHR9KTtcblx0XHRyZXR1cm4gZGVidWdDb25zb2xlUGlja3M7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVQaWNrKHNlc3Npb246IElEZWJ1Z1Nlc3Npb24sIHNlc3Npb25JbmRleDogbnVtYmVyLCBmaWx0ZXI6IHN0cmluZyk6IElQaWNrZXJRdWlja0FjY2Vzc0l0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGxhYmVsID0gc2Vzc2lvbi5uYW1lO1xuXG5cdFx0Y29uc3QgaGlnaGxpZ2h0cyA9IG1hdGNoZXNGdXp6eShmaWx0ZXIsIGxhYmVsLCB0cnVlKTtcblx0XHRpZiAoaGlnaGxpZ2h0cykge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGFiZWwsXG5cdFx0XHRcdGhpZ2hsaWdodHM6IHsgbGFiZWw6IGhpZ2hsaWdodHMgfSxcblx0XHRcdFx0YWNjZXB0OiAoa2V5TW9kLCBldmVudCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2RlYnVnU2VydmljZS5mb2N1c1N0YWNrRnJhbWUodW5kZWZpbmVkLCB1bmRlZmluZWQsIHNlc3Npb24sIHsgZXhwbGljaXQ6IHRydWUgfSk7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLl92aWV3c1NlcnZpY2UuaXNWaWV3VmlzaWJsZShSRVBMX1ZJRVdfSUQpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl92aWV3c1NlcnZpY2Uub3BlblZpZXcoUkVQTF9WSUVXX0lELCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBbUQsaUNBQXdDO0FBRTNGLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsbUNBQW1DLDJCQUEyQjtBQUN2RSxTQUFTLGVBQThCLG9CQUFvQjtBQUVwRCxJQUFNLDBCQUFOLGNBQXNDLDBCQUFrRDtBQUFBLEVBRTlGLFlBQ2lDLGVBQ0EsZUFDRSxpQkFDakM7QUFDRCxVQUFNLG1DQUFtQyxFQUFFLHVCQUF1QixLQUFLLENBQUM7QUFKeEM7QUFDQTtBQUNFO0FBQUEsRUFHbkM7QUFBQSxFQUVVLFVBQVUsUUFBZ0IsYUFBOEIsT0FBb0o7QUFDck4sVUFBTSxvQkFBeUUsQ0FBQztBQUVoRixTQUFLLGNBQWMsU0FBUyxFQUFFLFlBQVksSUFBSSxFQUFFLE9BQU8sT0FBSyxFQUFFLGdCQUFnQixDQUFDLEVBQUUsUUFBUSxDQUFDLFNBQVMsVUFBVTtBQUM1RyxZQUFNLE9BQU8sS0FBSyxZQUFZLFNBQVMsT0FBTyxNQUFNO0FBQ3BELFVBQUksTUFBTTtBQUNULDBCQUFrQixLQUFLLElBQUk7QUFBQSxNQUM1QjtBQUFBLElBQ0QsQ0FBQztBQUdELFFBQUksa0JBQWtCLFNBQVMsR0FBRztBQUNqQyx3QkFBa0IsS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQUEsSUFDN0M7QUFFQSxVQUFNLHNCQUFzQixTQUFTLHFDQUFxQywyQkFBMkI7QUFDckcsc0JBQWtCLEtBQUs7QUFBQSxNQUN0QixPQUFPLFdBQVcsbUJBQW1CO0FBQUEsTUFDckMsV0FBVztBQUFBLE1BQ1gsUUFBUSxNQUFNLEtBQUssZ0JBQWdCLGVBQWUsbUJBQW1CO0FBQUEsSUFDdEUsQ0FBQztBQUNELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxZQUFZLFNBQXdCLGNBQXNCLFFBQW9EO0FBQ3JILFVBQU0sUUFBUSxRQUFRO0FBRXRCLFVBQU0sYUFBYSxhQUFhLFFBQVEsT0FBTyxJQUFJO0FBQ25ELFFBQUksWUFBWTtBQUNmLGFBQU87QUFBQSxRQUNOO0FBQUEsUUFDQSxZQUFZLEVBQUUsT0FBTyxXQUFXO0FBQUEsUUFDaEMsUUFBUSxDQUFDLFFBQVEsVUFBVTtBQUMxQixlQUFLLGNBQWMsZ0JBQWdCLFFBQVcsUUFBVyxTQUFTLEVBQUUsVUFBVSxLQUFLLENBQUM7QUFDcEYsY0FBSSxDQUFDLEtBQUssY0FBYyxjQUFjLFlBQVksR0FBRztBQUNwRCxpQkFBSyxjQUFjLFNBQVMsY0FBYyxJQUFJO0FBQUEsVUFDL0M7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBcERhLDBCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FMVTsiLAogICJuYW1lcyI6IFtdCn0K
