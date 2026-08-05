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
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ExplorerTestCoverageBars } from "./testCoverageBars.js";
import { AutoOpenTesting, getTestingConfiguration, TestingConfigKeys } from "../common/configuration.js";
import { Testing } from "../common/constants.js";
import { ITestCoverageService } from "../common/testCoverageService.js";
import { isFailedState } from "../common/testingStates.js";
import { TestResultItemChangeReason } from "../common/testResult.js";
import { ITestResultService } from "../common/testResultService.js";
import { TestResultState } from "../common/testTypes.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
let TestingProgressTrigger = class extends Disposable {
  constructor(resultService, testCoverageService, configurationService, viewsService) {
    super();
    this.configurationService = configurationService;
    this.viewsService = viewsService;
    this._register(resultService.onResultsChanged((e) => {
      if ("started" in e) {
        this.attachAutoOpenForNewResults(e.started);
      }
    }));
    const barContributionRegistration = autorun((reader) => {
      const hasCoverage = !!testCoverageService.selected.read(reader);
      if (!hasCoverage) {
        return;
      }
      barContributionRegistration.dispose();
      ExplorerTestCoverageBars.register();
    });
    this._register(barContributionRegistration);
  }
  attachAutoOpenForNewResults(result) {
    if (result.request.preserveFocus === true) {
      return;
    }
    const cfg = getTestingConfiguration(this.configurationService, TestingConfigKeys.OpenResults);
    if (cfg === AutoOpenTesting.NeverOpen) {
      return;
    }
    if (cfg === AutoOpenTesting.OpenExplorerOnTestStart) {
      return this.openExplorerView();
    }
    if (cfg === AutoOpenTesting.OpenOnTestStart) {
      return this.openResultsView();
    }
    const disposable = new DisposableStore();
    disposable.add(result.onComplete(() => disposable.dispose()));
    disposable.add(result.onChange((e) => {
      if (e.reason === TestResultItemChangeReason.OwnStateChange && isFailedState(e.item.ownComputedState)) {
        this.openResultsView();
        disposable.dispose();
      }
    }));
  }
  openExplorerView() {
    this.viewsService.openView(Testing.ExplorerViewId, false);
  }
  openResultsView() {
    this.viewsService.openView(Testing.ResultsViewId, false);
  }
};
TestingProgressTrigger = __decorateClass([
  __decorateParam(0, ITestResultService),
  __decorateParam(1, ITestCoverageService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IViewsService)
], TestingProgressTrigger);
const collectTestStateCounts = (isRunning, results) => {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let running = 0;
  let queued = 0;
  for (const result of results) {
    const count = result.counts;
    failed += count[TestResultState.Errored] + count[TestResultState.Failed];
    passed += count[TestResultState.Passed];
    skipped += count[TestResultState.Skipped];
    running += count[TestResultState.Running];
    queued += count[TestResultState.Queued];
  }
  return {
    isRunning,
    passed,
    failed,
    runSoFar: passed + failed,
    totalWillBeRun: passed + failed + queued + running,
    skipped
  };
};
const getTestProgressText = ({ isRunning, passed, runSoFar, totalWillBeRun, skipped, failed }) => {
  let percent = passed / runSoFar * 100;
  if (failed > 0) {
    percent = Math.min(percent, 99.9);
  } else if (runSoFar === 0) {
    percent = 0;
  }
  if (isRunning) {
    if (runSoFar === 0) {
      return localize("testProgress.runningInitial", "Running tests...");
    } else if (skipped === 0) {
      return localize("testProgress.running", "Running tests, {0}/{1} passed ({2}%)", passed, totalWillBeRun, percent.toPrecision(3));
    } else {
      return localize("testProgressWithSkip.running", "Running tests, {0}/{1} tests passed ({2}%, {3} skipped)", passed, totalWillBeRun, percent.toPrecision(3), skipped);
    }
  } else {
    if (skipped === 0) {
      return localize("testProgress.completed", "{0}/{1} tests passed ({2}%)", passed, runSoFar, percent.toPrecision(3));
    } else {
      return localize("testProgressWithSkip.completed", "{0}/{1} tests passed ({2}%, {3} skipped)", passed, runSoFar, percent.toPrecision(3), skipped);
    }
  }
};
export {
  TestingProgressTrigger,
  collectTestStateCounts,
  getTestProgressText
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdGluZ1Byb2dyZXNzVWlTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGF1dG9ydW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRXhwbG9yZXJUZXN0Q292ZXJhZ2VCYXJzIH0gZnJvbSAnLi90ZXN0Q292ZXJhZ2VCYXJzLmpzJztcbmltcG9ydCB7IEF1dG9PcGVuVGVzdGluZywgZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24sIFRlc3RpbmdDb25maWdLZXlzIH0gZnJvbSAnLi4vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdGluZyB9IGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSVRlc3RDb3ZlcmFnZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vdGVzdENvdmVyYWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc0ZhaWxlZFN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL3Rlc3RpbmdTdGF0ZXMuanMnO1xuaW1wb3J0IHsgSVRlc3RSZXN1bHQsIExpdmVUZXN0UmVzdWx0LCBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbiB9IGZyb20gJy4uL2NvbW1vbi90ZXN0UmVzdWx0LmpzJztcbmltcG9ydCB7IElUZXN0UmVzdWx0U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi90ZXN0UmVzdWx0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0UmVzdWx0U3RhdGUgfSBmcm9tICcuLi9jb21tb24vdGVzdFR5cGVzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcblxuLyoqIFdvcmtiZW5jaCBjb250cmlidXRpb24gdGhhdCB0cmlnZ2VycyB1cGRhdGVzIGluIHRoZSBUZXN0aW5nUHJvZ3Jlc3NVaSBzZXJ2aWNlICovXG5leHBvcnQgY2xhc3MgVGVzdGluZ1Byb2dyZXNzVHJpZ2dlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRlc3RSZXN1bHRTZXJ2aWNlIHJlc3VsdFNlcnZpY2U6IElUZXN0UmVzdWx0U2VydmljZSxcblx0XHRASVRlc3RDb3ZlcmFnZVNlcnZpY2UgdGVzdENvdmVyYWdlU2VydmljZTogSVRlc3RDb3ZlcmFnZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2aWV3c1NlcnZpY2U6IElWaWV3c1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZXN1bHRTZXJ2aWNlLm9uUmVzdWx0c0NoYW5nZWQoKGUpID0+IHtcblx0XHRcdGlmICgnc3RhcnRlZCcgaW4gZSkge1xuXHRcdFx0XHR0aGlzLmF0dGFjaEF1dG9PcGVuRm9yTmV3UmVzdWx0cyhlLnN0YXJ0ZWQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGJhckNvbnRyaWJ1dGlvblJlZ2lzdHJhdGlvbiA9IGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IGhhc0NvdmVyYWdlID0gISF0ZXN0Q292ZXJhZ2VTZXJ2aWNlLnNlbGVjdGVkLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghaGFzQ292ZXJhZ2UpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRiYXJDb250cmlidXRpb25SZWdpc3RyYXRpb24uZGlzcG9zZSgpO1xuXHRcdFx0RXhwbG9yZXJUZXN0Q292ZXJhZ2VCYXJzLnJlZ2lzdGVyKCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihiYXJDb250cmlidXRpb25SZWdpc3RyYXRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBhdHRhY2hBdXRvT3BlbkZvck5ld1Jlc3VsdHMocmVzdWx0OiBMaXZlVGVzdFJlc3VsdCkge1xuXHRcdGlmIChyZXN1bHQucmVxdWVzdC5wcmVzZXJ2ZUZvY3VzID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2ZnID0gZ2V0VGVzdGluZ0NvbmZpZ3VyYXRpb24odGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgVGVzdGluZ0NvbmZpZ0tleXMuT3BlblJlc3VsdHMpO1xuXHRcdGlmIChjZmcgPT09IEF1dG9PcGVuVGVzdGluZy5OZXZlck9wZW4pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoY2ZnID09PSBBdXRvT3BlblRlc3RpbmcuT3BlbkV4cGxvcmVyT25UZXN0U3RhcnQpIHtcblx0XHRcdHJldHVybiB0aGlzLm9wZW5FeHBsb3JlclZpZXcoKTtcblx0XHR9XG5cblx0XHRpZiAoY2ZnID09PSBBdXRvT3BlblRlc3RpbmcuT3Blbk9uVGVzdFN0YXJ0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5vcGVuUmVzdWx0c1ZpZXcoKTtcblx0XHR9XG5cblx0XHQvLyBvcGVuIG9uIGZhaWx1cmVcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGUuYWRkKHJlc3VsdC5vbkNvbXBsZXRlKCgpID0+IGRpc3Bvc2FibGUuZGlzcG9zZSgpKSk7XG5cdFx0ZGlzcG9zYWJsZS5hZGQocmVzdWx0Lm9uQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUucmVhc29uID09PSBUZXN0UmVzdWx0SXRlbUNoYW5nZVJlYXNvbi5Pd25TdGF0ZUNoYW5nZSAmJiBpc0ZhaWxlZFN0YXRlKGUuaXRlbS5vd25Db21wdXRlZFN0YXRlKSkge1xuXHRcdFx0XHR0aGlzLm9wZW5SZXN1bHRzVmlldygpO1xuXHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5FeHBsb3JlclZpZXcoKSB7XG5cdFx0dGhpcy52aWV3c1NlcnZpY2Uub3BlblZpZXcoVGVzdGluZy5FeHBsb3JlclZpZXdJZCwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuUmVzdWx0c1ZpZXcoKSB7XG5cdFx0dGhpcy52aWV3c1NlcnZpY2Uub3BlblZpZXcoVGVzdGluZy5SZXN1bHRzVmlld0lkLCBmYWxzZSk7XG5cdH1cbn1cblxuZXhwb3J0IHR5cGUgQ291bnRTdW1tYXJ5ID0gUmV0dXJuVHlwZTx0eXBlb2YgY29sbGVjdFRlc3RTdGF0ZUNvdW50cz47XG5cbmV4cG9ydCBjb25zdCBjb2xsZWN0VGVzdFN0YXRlQ291bnRzID0gKGlzUnVubmluZzogYm9vbGVhbiwgcmVzdWx0czogUmVhZG9ubHlBcnJheTxJVGVzdFJlc3VsdD4pID0+IHtcblx0bGV0IHBhc3NlZCA9IDA7XG5cdGxldCBmYWlsZWQgPSAwO1xuXHRsZXQgc2tpcHBlZCA9IDA7XG5cdGxldCBydW5uaW5nID0gMDtcblx0bGV0IHF1ZXVlZCA9IDA7XG5cblx0Zm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuXHRcdGNvbnN0IGNvdW50ID0gcmVzdWx0LmNvdW50cztcblx0XHRmYWlsZWQgKz0gY291bnRbVGVzdFJlc3VsdFN0YXRlLkVycm9yZWRdICsgY291bnRbVGVzdFJlc3VsdFN0YXRlLkZhaWxlZF07XG5cdFx0cGFzc2VkICs9IGNvdW50W1Rlc3RSZXN1bHRTdGF0ZS5QYXNzZWRdO1xuXHRcdHNraXBwZWQgKz0gY291bnRbVGVzdFJlc3VsdFN0YXRlLlNraXBwZWRdO1xuXHRcdHJ1bm5pbmcgKz0gY291bnRbVGVzdFJlc3VsdFN0YXRlLlJ1bm5pbmddO1xuXHRcdHF1ZXVlZCArPSBjb3VudFtUZXN0UmVzdWx0U3RhdGUuUXVldWVkXTtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0aXNSdW5uaW5nLFxuXHRcdHBhc3NlZCxcblx0XHRmYWlsZWQsXG5cdFx0cnVuU29GYXI6IHBhc3NlZCArIGZhaWxlZCxcblx0XHR0b3RhbFdpbGxCZVJ1bjogcGFzc2VkICsgZmFpbGVkICsgcXVldWVkICsgcnVubmluZyxcblx0XHRza2lwcGVkLFxuXHR9O1xufTtcblxuZXhwb3J0IGNvbnN0IGdldFRlc3RQcm9ncmVzc1RleHQgPSAoeyBpc1J1bm5pbmcsIHBhc3NlZCwgcnVuU29GYXIsIHRvdGFsV2lsbEJlUnVuLCBza2lwcGVkLCBmYWlsZWQgfTogQ291bnRTdW1tYXJ5KSA9PiB7XG5cdGxldCBwZXJjZW50ID0gcGFzc2VkIC8gcnVuU29GYXIgKiAxMDA7XG5cdGlmIChmYWlsZWQgPiAwKSB7XG5cdFx0Ly8gZml4OiBwcmV2ZW50IGZyb20gcm91bmRpbmcgdG8gMTAwIGlmIHRoZXJlJ3MgYW55IGZhaWxlZCB0ZXN0XG5cdFx0cGVyY2VudCA9IE1hdGgubWluKHBlcmNlbnQsIDk5LjkpO1xuXHR9IGVsc2UgaWYgKHJ1blNvRmFyID09PSAwKSB7XG5cdFx0cGVyY2VudCA9IDA7XG5cdH1cblxuXHRpZiAoaXNSdW5uaW5nKSB7XG5cdFx0aWYgKHJ1blNvRmFyID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Rlc3RQcm9ncmVzcy5ydW5uaW5nSW5pdGlhbCcsICdSdW5uaW5nIHRlc3RzLi4uJyk7XG5cdFx0fSBlbHNlIGlmIChza2lwcGVkID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Rlc3RQcm9ncmVzcy5ydW5uaW5nJywgJ1J1bm5pbmcgdGVzdHMsIHswfS97MX0gcGFzc2VkICh7Mn0lKScsIHBhc3NlZCwgdG90YWxXaWxsQmVSdW4sIHBlcmNlbnQudG9QcmVjaXNpb24oMykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Rlc3RQcm9ncmVzc1dpdGhTa2lwLnJ1bm5pbmcnLCAnUnVubmluZyB0ZXN0cywgezB9L3sxfSB0ZXN0cyBwYXNzZWQgKHsyfSUsIHszfSBza2lwcGVkKScsIHBhc3NlZCwgdG90YWxXaWxsQmVSdW4sIHBlcmNlbnQudG9QcmVjaXNpb24oMyksIHNraXBwZWQpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRpZiAoc2tpcHBlZCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0ZXN0UHJvZ3Jlc3MuY29tcGxldGVkJywgJ3swfS97MX0gdGVzdHMgcGFzc2VkICh7Mn0lKScsIHBhc3NlZCwgcnVuU29GYXIsIHBlcmNlbnQudG9QcmVjaXNpb24oMykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Rlc3RQcm9ncmVzc1dpdGhTa2lwLmNvbXBsZXRlZCcsICd7MH0vezF9IHRlc3RzIHBhc3NlZCAoezJ9JSwgezN9IHNraXBwZWQpJywgcGFzc2VkLCBydW5Tb0ZhciwgcGVyY2VudC50b1ByZWNpc2lvbigzKSwgc2tpcHBlZCk7XG5cdFx0fVxuXHR9XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGlCQUFpQix5QkFBeUIseUJBQXlCO0FBQzVFLFNBQVMsZUFBZTtBQUN4QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFzQyxrQ0FBa0M7QUFDeEUsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQkFBcUI7QUFHdkIsSUFBTSx5QkFBTixjQUFxQyxXQUFXO0FBQUEsRUFDdEQsWUFDcUIsZUFDRSxxQkFDa0Isc0JBQ1IsY0FDL0I7QUFDRCxVQUFNO0FBSGtDO0FBQ1I7QUFJaEMsU0FBSyxVQUFVLGNBQWMsaUJBQWlCLENBQUMsTUFBTTtBQUNwRCxVQUFJLGFBQWEsR0FBRztBQUNuQixhQUFLLDRCQUE0QixFQUFFLE9BQU87QUFBQSxNQUMzQztBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsVUFBTSw4QkFBOEIsUUFBUSxZQUFVO0FBQ3JELFlBQU0sY0FBYyxDQUFDLENBQUMsb0JBQW9CLFNBQVMsS0FBSyxNQUFNO0FBQzlELFVBQUksQ0FBQyxhQUFhO0FBQ2pCO0FBQUEsTUFDRDtBQUVBLGtDQUE0QixRQUFRO0FBQ3BDLCtCQUF5QixTQUFTO0FBQUEsSUFDbkMsQ0FBQztBQUVELFNBQUssVUFBVSwyQkFBMkI7QUFBQSxFQUMzQztBQUFBLEVBRVEsNEJBQTRCLFFBQXdCO0FBQzNELFFBQUksT0FBTyxRQUFRLGtCQUFrQixNQUFNO0FBQzFDO0FBQUEsSUFDRDtBQUVBLFVB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
