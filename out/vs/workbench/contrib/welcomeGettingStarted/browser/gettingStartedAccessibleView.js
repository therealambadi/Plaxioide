import { AccessibleViewType, AccessibleViewProviderId } from "../../../../platform/accessibility/browser/accessibleView.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { GettingStartedPage, inWelcomeContext } from "./gettingStarted.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IWalkthroughsService } from "./gettingStartedService.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { GettingStartedInput } from "./gettingStartedInput.js";
import { localize } from "../../../../nls.js";
import { Action } from "../../../../base/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { URI } from "../../../../base/common/uri.js";
import { parse } from "../../../../base/common/marshalling.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
class GettingStartedAccessibleView {
  constructor() {
    this.type = AccessibleViewType.View;
    this.priority = 110;
    this.name = "walkthroughs";
    this.when = inWelcomeContext;
    this.getProvider = (accessor) => {
      const editorService = accessor.get(IEditorService);
      const editorPane = editorService.activeEditorPane;
      if (!(editorPane instanceof GettingStartedPage)) {
        return;
      }
      const gettingStartedInput = editorPane.input;
      if (!(gettingStartedInput instanceof GettingStartedInput) || !gettingStartedInput.selectedCategory) {
        return;
      }
      const gettingStartedService = accessor.get(IWalkthroughsService);
      const currentWalkthrough = gettingStartedService.getWalkthrough(gettingStartedInput.selectedCategory);
      const currentStepIds = gettingStartedInput.selectedStep;
      if (currentWalkthrough) {
        return new GettingStartedAccessibleProvider(
          accessor.get(IContextKeyService),
          accessor.get(ICommandService),
          accessor.get(IOpenerService),
          editorPane,
          currentWalkthrough,
          currentStepIds
        );
      }
      return;
    };
  }
}
class GettingStartedAccessibleProvider extends Disposable {
  constructor(contextService, commandService, openerService, _gettingStartedPage, _walkthrough, _focusedStep) {
    super();
    this.contextService = contextService;
    this.commandService = commandService;
    this.openerService = openerService;
    this._gettingStartedPage = _gettingStartedPage;
    this._walkthrough = _walkthrough;
    this._focusedStep = _focusedStep;
    this._currentStepIndex = 0;
    this._activeWalkthroughSteps = [];
    this.id = AccessibleViewProviderId.Walkthrough;
    this.verbositySettingKey = AccessibilityVerbositySettingId.Walkthrough;
    this.options = { type: AccessibleViewType.View };
    this._activeWalkthroughSteps = _walkthrough.steps.filter((step) => !step.when || this.contextService.contextMatchesRules(step.when));
  }
  get actions() {
    const actions = [];
    const step = this._activeWalkthroughSteps[this._currentStepIndex];
    const nodes = step.description.map((lt) => lt.nodes.filter((node) => typeof node !== "string").map((node) => ({ href: node.href, label: node.label }))).flat();
    if (nodes.length === 1) {
      const node = nodes[0];
      actions.push(new Action("walthrough.step.action", node.label, ThemeIcon.asClassName(Codicon.run), true, () => {
        const isCommand = node.href.startsWith("command:");
        const command = node.href.replace(/command:(toSide:)?/, "command:");
        if (isCommand) {
          const commandURI = URI.parse(command);
          let args = [];
          try {
            args = parse(decodeURIComponent(commandURI.query));
          } catch {
            try {
              args = parse(commandURI.query);
            } catch {
            }
          }
          if (!Array.isArray(args)) {
            args = [args];
          }
          this.commandService.executeCommand(commandURI.path, ...args);
        } else {
          this.openerService.open(command, { allowCommands: true });
        }
      }));
    }
    return actions;
  }
  provideContent() {
    if (this._focusedStep) {
      const stepIndex = this._activeWalkthroughSteps.findIndex((step) => step.id === this._focusedStep);
      if (stepIndex !== -1) {
        this._currentStepIndex = stepIndex;
      }
    }
    return this._getContent(
      this._walkthrough,
      this._activeWalkthroughSteps[this._currentStepIndex],
      /* includeTitle */
      true
    );
  }
  _getContent(waltkrough, step, includeTitle) {
    const description = step.description.map((lt) => lt.nodes.filter((node) => typeof node === "string")).join("\n");
    const stepsContent = localize("gettingStarted.step", "{0}\n{1}", step.title, description);
    if (includeTitle) {
      return [
        localize("gettingStarted.title", "Title: {0}", waltkrough.title),
        localize("gettingStarted.description", "Description: {0}", waltkrough.description),
        stepsContent
      ].join("\n");
    } else {
      return stepsContent;
    }
  }
  provideNextContent() {
    if (++this._currentStepIndex >= this._activeWalkthroughSteps.length) {
      --this._currentStepIndex;
      return;
    }
    return this._getContent(this._walkthrough, this._activeWalkthroughSteps[this._currentStepIndex]);
  }
  providePreviousContent() {
    if (--this._currentStepIndex < 0) {
      ++this._currentStepIndex;
      return;
    }
    return this._getContent(this._walkthrough, this._activeWalkthroughSteps[this._currentStepIndex]);
  }
  onClose() {
    if (this._currentStepIndex > -1) {
      const currentStep = this._activeWalkthroughSteps[this._currentStepIndex];
      this._gettingStartedPage.makeCategoryVisibleWhenAvailable(this._walkthrough.id, currentStep.id);
    }
  }
}
export {
  GettingStartedAccessibleView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvYnJvd3Nlci9nZXR0aW5nU3RhcnRlZEFjY2Vzc2libGVWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7IEFjY2Vzc2libGVWaWV3VHlwZSwgQWNjZXNzaWJsZUNvbnRlbnRQcm92aWRlciwgRXh0ZW5zaW9uQ29udGVudFByb3ZpZGVyLCBJQWNjZXNzaWJsZVZpZXdDb250ZW50UHJvdmlkZXIsIEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlldy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJsZVZpZXdJbXBsZW1lbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgR2V0dGluZ1N0YXJ0ZWRQYWdlLCBpbldlbGNvbWVDb250ZXh0IH0gZnJvbSAnLi9nZXR0aW5nU3RhcnRlZC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElSZXNvbHZlZFdhbGt0aHJvdWdoLCBJUmVzb2x2ZWRXYWxrdGhyb3VnaFN0ZXAsIElXYWxrdGhyb3VnaHNTZXJ2aWNlIH0gZnJvbSAnLi9nZXR0aW5nU3RhcnRlZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBHZXR0aW5nU3RhcnRlZElucHV0IH0gZnJvbSAnLi9nZXR0aW5nU3RhcnRlZElucHV0LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUxpbmsgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saW5rZWRUZXh0LmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgR2V0dGluZ1N0YXJ0ZWRBY2Nlc3NpYmxlVmlldyBpbXBsZW1lbnRzIElBY2Nlc3NpYmxlVmlld0ltcGxlbWVudGF0aW9uIHtcblx0cmVhZG9ubHkgdHlwZSA9IEFjY2Vzc2libGVWaWV3VHlwZS5WaWV3O1xuXHRyZWFkb25seSBwcmlvcml0eSA9IDExMDtcblx0cmVhZG9ubHkgbmFtZSA9ICd3YWxrdGhyb3VnaHMnO1xuXHRyZWFkb25seSB3aGVuID0gaW5XZWxjb21lQ29udGV4dDtcblxuXHRnZXRQcm92aWRlciA9IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IEFjY2Vzc2libGVDb250ZW50UHJvdmlkZXIgfCBFeHRlbnNpb25Db250ZW50UHJvdmlkZXIgfCB1bmRlZmluZWQgPT4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclBhbmUgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0aWYgKCEoZWRpdG9yUGFuZSBpbnN0YW5jZW9mIEdldHRpbmdTdGFydGVkUGFnZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZ2V0dGluZ1N0YXJ0ZWRJbnB1dCA9IGVkaXRvclBhbmUuaW5wdXQ7XG5cdFx0aWYgKCEoZ2V0dGluZ1N0YXJ0ZWRJbnB1dCBpbnN0YW5jZW9mIEdldHRpbmdTdGFydGVkSW5wdXQpIHx8ICFnZXR0aW5nU3RhcnRlZElucHV0LnNlbGVjdGVkQ2F0ZWdvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBnZXR0aW5nU3RhcnRlZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdhbGt0aHJvdWdoc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGN1cnJlbnRXYWxrdGhyb3VnaCA9IGdldHRpbmdTdGFydGVkU2VydmljZS5nZXRXYWxrdGhyb3VnaChnZXR0aW5nU3RhcnRlZElucHV0LnNlbGVjdGVkQ2F0ZWdvcnkpO1xuXHRcdGNvbnN0IGN1cnJlbnRTdGVwSWRzID0gZ2V0dGluZ1N0YXJ0ZWRJbnB1dC5zZWxlY3RlZFN0ZXA7XG5cdFx0aWYgKGN1cnJlbnRXYWxrdGhyb3VnaCkge1xuXG5cdFx0XHRyZXR1cm4gbmV3IEdldHRpbmdTdGFydGVkQWNjZXNzaWJsZVByb3ZpZGVyKFxuXHRcdFx0XHRhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKSxcblx0XHRcdFx0YWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSksXG5cdFx0XHRcdGFjY2Vzc29yLmdldChJT3BlbmVyU2VydmljZSksXG5cdFx0XHRcdGVkaXRvclBhbmUsXG5cdFx0XHRcdGN1cnJlbnRXYWxrdGhyb3VnaCxcblx0XHRcdFx0Y3VycmVudFN0ZXBJZHMpO1xuXHRcdH1cblx0XHRyZXR1cm47XG5cdH07XG59XG5cbmNsYXNzIEdldHRpbmdTdGFydGVkQWNjZXNzaWJsZVByb3ZpZGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElBY2Nlc3NpYmxlVmlld0NvbnRlbnRQcm92aWRlciB7XG5cblx0cHJpdmF0ZSBfY3VycmVudFN0ZXBJbmRleDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfYWN0aXZlV2Fsa3Rocm91Z2hTdGVwczogSVJlc29sdmVkV2Fsa3Rocm91Z2hTdGVwW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGNvbnRleHRTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZ2V0dGluZ1N0YXJ0ZWRQYWdlOiBHZXR0aW5nU3RhcnRlZFBhZ2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfd2Fsa3Rocm91Z2g6IElSZXNvbHZlZFdhbGt0aHJvdWdoLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2ZvY3VzZWRTdGVwPzogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2FjdGl2ZVdhbGt0aHJvdWdoU3RlcHMgPSBfd2Fsa3Rocm91Z2guc3RlcHMuZmlsdGVyKHN0ZXAgPT4gIXN0ZXAud2hlbiB8fCB0aGlzLmNvbnRleHRTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoc3RlcC53aGVuKSk7XG5cdH1cblxuXHRyZWFkb25seSBpZCA9IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5XYWxrdGhyb3VnaDtcblx0cmVhZG9ubHkgdmVyYm9zaXR5U2V0dGluZ0tleSA9IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuV2Fsa3Rocm91Z2g7XG5cdHJlYWRvbmx5IG9wdGlvbnMgPSB7IHR5cGU6IEFjY2Vzc2libGVWaWV3VHlwZS5WaWV3IH07XG5cblx0cHVibGljIGdldCBhY3Rpb25zKCk6IElBY3Rpb25bXSB7XG5cdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0Y29uc3Qgc3RlcCA9IHRoaXMuX2FjdGl2ZVdhbGt0aHJvdWdoU3RlcHNbdGhpcy5fY3VycmVudFN0ZXBJbmRleF07XG5cdFx0Y29uc3Qgbm9kZXMgPSBzdGVwLmRlc2NyaXB0aW9uLm1hcChsdCA9PiBsdC5ub2Rlcy5maWx0ZXIoKG5vZGUpOiBub2RlIGlzIElMaW5rID0+IHR5cGVvZiBub2RlICE9PSAnc3RyaW5nJykubWFwKG5vZGUgPT4gKHsgaHJlZjogbm9kZS5ocmVmLCBsYWJlbDogbm9kZS5sYWJlbCB9KSkpLmZsYXQoKTtcblx0XHRpZiAobm9kZXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRjb25zdCBub2RlID0gbm9kZXNbMF07XG5cblx0XHRcdGFjdGlvbnMucHVzaChuZXcgQWN0aW9uKCd3YWx0aHJvdWdoLnN0ZXAuYWN0aW9uJywgbm9kZS5sYWJlbCwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24ucnVuKSwgdHJ1ZSwgKCkgPT4ge1xuXG5cdFx0XHRcdGNvbnN0IGlzQ29tbWFuZCA9IG5vZGUuaHJlZi5zdGFydHNXaXRoKCdjb21tYW5kOicpO1xuXHRcdFx0XHRjb25zdCBjb21tYW5kID0gbm9kZS5ocmVmLnJlcGxhY2UoL2NvbW1hbmQ6KHRvU2lkZTopPy8sICdjb21tYW5kOicpO1xuXG5cdFx0XHRcdGlmIChpc0NvbW1hbmQpIHtcblx0XHRcdFx0XHRjb25zdCBjb21tYW5kVVJJID0gVVJJLnBhcnNlKGNvbW1hbmQpO1xuXG5cdFx0XHRcdFx0bGV0IGFyZ3M6IGFueSA9IFtdO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhcmdzID0gcGFyc2UoZGVjb2RlVVJJQ29tcG9uZW50KGNvbW1hbmRVUkkucXVlcnkpKTtcblx0XHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGFyZ3MgPSBwYXJzZShjb21tYW5kVVJJLnF1ZXJ5KTtcblx0XHRcdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdFx0XHQvLyBpZ25vcmUgZXJyb3Jcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KGFyZ3MpKSB7XG5cdFx0XHRcdFx0XHRhcmdzID0gW2FyZ3NdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmRVUkkucGF0aCwgLi4uYXJncyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oY29tbWFuZCwgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdHJldHVybiBhY3Rpb25zO1xuXHR9XG5cblx0cHJvdmlkZUNvbnRlbnQoKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5fZm9jdXNlZFN0ZXApIHtcblx0XHRcdGNvbnN0IHN0ZXBJbmRleCA9IHRoaXMuX2FjdGl2ZVdhbGt0aHJvdWdoU3RlcHMuZmluZEluZGV4KHN0ZXAgPT4gc3RlcC5pZCA9PT0gdGhpcy5fZm9jdXNlZFN0ZXApO1xuXHRcdFx0aWYgKHN0ZXBJbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0dGhpcy5fY3VycmVudFN0ZXBJbmRleCA9IHN0ZXBJbmRleDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2dldENvbnRlbnQodGhpcy5fd2Fsa3Rocm91Z2gsIHRoaXMuX2FjdGl2ZVdhbGt0aHJvdWdoU3RlcHNbdGhpcy5fY3VycmVudFN0ZXBJbmRleF0sIC8qIGluY2x1ZGVUaXRsZSAqL3RydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q29udGVudCh3YWx0a3JvdWdoOiBJUmVzb2x2ZWRXYWxrdGhyb3VnaCwgc3RlcDogSVJlc29sdmVkV2Fsa3Rocm91Z2hTdGVwLCBpbmNsdWRlVGl0bGU/OiBib29sZWFuKTogc3RyaW5nIHtcblxuXHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gc3RlcC5kZXNjcmlwdGlvbi5tYXAobHQgPT4gbHQubm9kZXMuZmlsdGVyKG5vZGUgPT4gdHlwZW9mIG5vZGUgPT09ICdzdHJpbmcnKSkuam9pbignXFxuJyk7XG5cdFx0Y29uc3Qgc3RlcHNDb250ZW50ID1cblx0XHRcdGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5zdGVwJywgJ3swfVxcbnsxfScsIHN0ZXAudGl0bGUsIGRlc2NyaXB0aW9uKTtcblxuXHRcdGlmIChpbmNsdWRlVGl0bGUpIHtcblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC50aXRsZScsICdUaXRsZTogezB9Jywgd2FsdGtyb3VnaC50aXRsZSksXG5cdFx0XHRcdGxvY2FsaXplKCdnZXR0aW5nU3RhcnRlZC5kZXNjcmlwdGlvbicsICdEZXNjcmlwdGlvbjogezB9Jywgd2FsdGtyb3VnaC5kZXNjcmlwdGlvbiksXG5cdFx0XHRcdHN0ZXBzQ29udGVudFxuXHRcdFx0XS5qb2luKCdcXG4nKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRyZXR1cm4gc3RlcHNDb250ZW50O1xuXHRcdH1cblx0fVxuXG5cdHByb3ZpZGVOZXh0Q29udGVudCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICgrK3RoaXMuX2N1cnJlbnRTdGVwSW5kZXggPj0gdGhpcy5fYWN0aXZlV2Fsa3Rocm91Z2hTdGVwcy5sZW5ndGgpIHtcblx0XHRcdC0tdGhpcy5fY3VycmVudFN0ZXBJbmRleDtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2dldENvbnRlbnQodGhpcy5fd2Fsa3Rocm91Z2gsIHRoaXMuX2FjdGl2ZVdhbGt0aHJvdWdoU3RlcHNbdGhpcy5fY3VycmVudFN0ZXBJbmRleF0pO1xuXHR9XG5cblx0cHJvdmlkZVByZXZpb3VzQ29udGVudCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICgtLXRoaXMuX2N1cnJlbnRTdGVwSW5kZXggPCAwKSB7XG5cdFx0XHQrK3RoaXMuX2N1cnJlbnRTdGVwSW5kZXg7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9nZXRDb250ZW50KHRoaXMuX3dhbGt0aHJvdWdoLCB0aGlzLl9hY3RpdmVXYWxrdGhyb3VnaFN0ZXBzW3RoaXMuX2N1cnJlbnRTdGVwSW5kZXhdKTtcblx0fVxuXG5cdG9uQ2xvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRTdGVwSW5kZXggPiAtMSkge1xuXHRcdFx0Y29uc3QgY3VycmVudFN0ZXAgPSB0aGlzLl9hY3RpdmVXYWxrdGhyb3VnaFN0ZXBzW3RoaXMuX2N1cnJlbnRTdGVwSW5kZXhdO1xuXHRcdFx0dGhpcy5fZ2V0dGluZ1N0YXJ0ZWRQYWdlLm1ha2VDYXRlZ29yeVZpc2libGVXaGVuQXZhaWxhYmxlKHRoaXMuX3dhbGt0aHJvdWdoLmlkLCBjdXJyZW50U3RlcC5pZCk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxTQUFTLG9CQUF5RyxnQ0FBZ0M7QUFFbEosU0FBUywwQkFBMEI7QUFFbkMsU0FBUyxvQkFBb0Isd0JBQXdCO0FBQ3JELFNBQVMsa0JBQWtCO0FBQzNCLFNBQXlELDRCQUE0QjtBQUNyRixTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQXVCO0FBRWhDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsV0FBVztBQUNwQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxlQUFlO0FBRWpCLE1BQU0sNkJBQXNFO0FBQUEsRUFBNUU7QUFDTixTQUFTLE9BQU8sbUJBQW1CO0FBQ25DLFNBQVMsV0FBVztBQUNwQixTQUFTLE9BQU87QUFDaEIsU0FBUyxPQUFPO0FBRWhCLHVCQUFjLENBQUMsYUFBaUc7QUFDL0csWUFBTSxnQkFBZ0IsU0FBUyxJQUFJLGNBQWM7QUFDakQsWUFBTSxhQUFhLGNBQWM7QUFDakMsVUFBSSxFQUFFLHNCQUFzQixxQkFBcUI7QUFDaEQ7QUFBQSxNQUNEO0FBQ0EsWUFBTSxzQkFBc0IsV0FBVztBQUN2QyxVQUFJLEVBQUUsK0JBQStCLHdC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
