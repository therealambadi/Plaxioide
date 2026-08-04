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
import { Disposable } from "../../../../base/common/lifecycle.js";
import Severity from "../../../../base/common/severity.js";
import { localize2 } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IMetricsService } from "../common/metricsService.js";
import { IVoidUpdateService } from "../common/voidUpdateService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import * as dom from "../../../../base/browser/dom.js";
import { IUpdateService } from "../../../../platform/update/common/update.js";
const notifyUpdate = (res, notifService, updateService) => {
  const message = res?.message || "This is a very old version of Void, please download the latest version! [Void Editor](https://voideditor.com/download-beta)!";
  let actions;
  if (res?.action) {
    const primary = [];
    if (res.action === "reinstall") {
      primary.push({
        label: `Reinstall`,
        id: "void.updater.reinstall",
        enabled: true,
        tooltip: "",
        class: void 0,
        run: () => {
          const { window } = dom.getActiveWindow();
          window.open("https://voideditor.com/download-beta");
        }
      });
    }
    if (res.action === "download") {
      primary.push({
        label: `Download`,
        id: "void.updater.download",
        enabled: true,
        tooltip: "",
        class: void 0,
        run: () => {
          updateService.downloadUpdate();
        }
      });
    }
    if (res.action === "apply") {
      primary.push({
        label: `Apply`,
        id: "void.updater.apply",
        enabled: true,
        tooltip: "",
        class: void 0,
        run: () => {
          updateService.applyUpdate();
        }
      });
    }
    if (res.action === "restart") {
      primary.push({
        label: `Restart`,
        id: "void.updater.restart",
        enabled: true,
        tooltip: "",
        class: void 0,
        run: () => {
          updateService.quitAndInstall();
        }
      });
    }
    primary.push({
      id: "void.updater.site",
      enabled: true,
      label: `Plaxio Site`,
      tooltip: "",
      class: void 0,
      run: () => {
        const { window } = dom.getActiveWindow();
        window.open("https://voideditor.com/");
      }
    });
    actions = {
      primary,
      secondary: [{
        id: "void.updater.close",
        enabled: true,
        label: `Keep current version`,
        tooltip: "",
        class: void 0,
        run: () => {
          notifController.close();
        }
      }]
    };
  } else {
    actions = void 0;
  }
  const notifController = notifService.notify({
    severity: Severity.Info,
    message,
    sticky: true,
    progress: actions ? { worked: 0, total: 100 } : void 0,
    actions
  });
  return notifController;
};
const notifyErrChecking = (notifService) => {
  const message = `Void Error: There was an error checking for updates. If this persists, please get in touch or reinstall Void [here](https://voideditor.com/download-beta)!`;
  const notifController = notifService.notify({
    severity: Severity.Info,
    message,
    sticky: true
  });
  return notifController;
};
const performVoidCheck = async (explicit, notifService, voidUpdateService, metricsService, updateService) => {
  const metricsTag = explicit ? "Manual" : "Auto";
  metricsService.capture(`Void Update ${metricsTag}: Checking...`, {});
  const res = await voidUpdateService.check(explicit);
  if (!res) {
    const notifController = notifyErrChecking(notifService);
    metricsService.capture(`Void Update ${metricsTag}: Error`, { res });
    return notifController;
  } else {
    if (res.message) {
      const notifController = notifyUpdate(res, notifService, updateService);
      metricsService.capture(`Void Update ${metricsTag}: Yes`, { res });
      return notifController;
    } else {
      metricsService.capture(`Void Update ${metricsTag}: No`, { res });
      return null;
    }
  }
};
let lastNotifController = null;
registerAction2(class extends Action2 {
  constructor() {
    super({
      f1: true,
      id: "void.voidCheckUpdate",
      title: localize2("voidCheckUpdate", "Plaxio: Check for Updates")
    });
  }
  async run(accessor) {
    const voidUpdateService = accessor.get(IVoidUpdateService);
    const notifService = accessor.get(INotificationService);
    const metricsService = accessor.get(IMetricsService);
    const updateService = accessor.get(IUpdateService);
    const currNotifController = lastNotifController;
    const newController = await performVoidCheck(true, notifService, voidUpdateService, metricsService, updateService);
    if (newController) {
      currNotifController?.close();
      lastNotifController = newController;
    }
  }
});
let VoidUpdateWorkbenchContribution = class extends Disposable {
  constructor(voidUpdateService, metricsService, notifService, updateService) {
    super();
    const autoCheck = () => {
      performVoidCheck(false, notifService, voidUpdateService, metricsService, updateService);
    };
    const { window } = dom.getActiveWindow();
    const initId = window.setTimeout(() => autoCheck(), 5 * 1e3);
    this._register({ dispose: () => window.clearTimeout(initId) });
    const intervalId = window.setInterval(() => autoCheck(), 3 * 60 * 60 * 1e3);
    this._register({ dispose: () => window.clearInterval(intervalId) });
  }
};
VoidUpdateWorkbenchContribution.ID = "workbench.contrib.void.voidUpdate";
VoidUpdateWorkbenchContribution = __decorateClass([
  __decorateParam(0, IVoidUpdateService),
  __decorateParam(1, IMetricsService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IUpdateService)
], VoidUpdateWorkbenchContribution);
registerWorkbenchContribution2(VoidUpdateWorkbenchContribution.ID, VoidUpdateWorkbenchContribution, WorkbenchPhase.BlockRestore);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvdm9pZFVwZGF0ZUFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgMjAyNSBHbGFzcyBEZXZ0b29scywgSW5jLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAuIFNlZSBMSUNFTlNFLnR4dCBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uQWN0aW9ucywgSU5vdGlmaWNhdGlvbkhhbmRsZSwgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWV0cmljc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbWV0cmljc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZvaWRVcGRhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRVcGRhdGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiwgV29ya2JlbmNoUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJVXBkYXRlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VwZGF0ZS9jb21tb24vdXBkYXRlLmpzJztcbmltcG9ydCB7IFZvaWRDaGVja1VwZGF0ZVJlc3Bvc2UgfSBmcm9tICcuLi9jb21tb24vdm9pZFVwZGF0ZVNlcnZpY2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5cblxuXG5cbmNvbnN0IG5vdGlmeVVwZGF0ZSA9IChyZXM6IFZvaWRDaGVja1VwZGF0ZVJlc3Bvc2UgJiB7IG1lc3NhZ2U6IHN0cmluZyB9LCBub3RpZlNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLCB1cGRhdGVTZXJ2aWNlOiBJVXBkYXRlU2VydmljZSk6IElOb3RpZmljYXRpb25IYW5kbGUgPT4ge1xuXHRjb25zdCBtZXNzYWdlID0gcmVzPy5tZXNzYWdlIHx8ICdUaGlzIGlzIGEgdmVyeSBvbGQgdmVyc2lvbiBvZiBWb2lkLCBwbGVhc2UgZG93bmxvYWQgdGhlIGxhdGVzdCB2ZXJzaW9uISBbVm9pZCBFZGl0b3JdKGh0dHBzOi8vdm9pZGVkaXRvci5jb20vZG93bmxvYWQtYmV0YSkhJ1xuXG5cdGxldCBhY3Rpb25zOiBJTm90aWZpY2F0aW9uQWN0aW9ucyB8IHVuZGVmaW5lZFxuXG5cdGlmIChyZXM/LmFjdGlvbikge1xuXHRcdGNvbnN0IHByaW1hcnk6IElBY3Rpb25bXSA9IFtdXG5cblx0XHRpZiAocmVzLmFjdGlvbiA9PT0gJ3JlaW5zdGFsbCcpIHtcblx0XHRcdHByaW1hcnkucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBgUmVpbnN0YWxsYCxcblx0XHRcdFx0aWQ6ICd2b2lkLnVwZGF0ZXIucmVpbnN0YWxsJyxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHsgd2luZG93IH0gPSBkb20uZ2V0QWN0aXZlV2luZG93KClcblx0XHRcdFx0XHR3aW5kb3cub3BlbignaHR0cHM6Ly92b2lkZWRpdG9yLmNvbS9kb3dubG9hZC1iZXRhJylcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHR9XG5cblx0XHRpZiAocmVzLmFjdGlvbiA9PT0gJ2Rvd25sb2FkJykge1xuXHRcdFx0cHJpbWFyeS5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGBEb3dubG9hZGAsXG5cdFx0XHRcdGlkOiAndm9pZC51cGRhdGVyLmRvd25sb2FkJyxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdHVwZGF0ZVNlcnZpY2UuZG93bmxvYWRVcGRhdGUoKVxuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdH1cblxuXG5cdFx0aWYgKHJlcy5hY3Rpb24gPT09ICdhcHBseScpIHtcblx0XHRcdHByaW1hcnkucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBgQXBwbHlgLFxuXHRcdFx0XHRpZDogJ3ZvaWQudXBkYXRlci5hcHBseScsXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHR1cGRhdGVTZXJ2aWNlLmFwcGx5VXBkYXRlKClcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHR9XG5cblx0XHRpZiAocmVzLmFjdGlvbiA9PT0gJ3Jlc3RhcnQnKSB7XG5cdFx0XHRwcmltYXJ5LnB1c2goe1xuXHRcdFx0XHRsYWJlbDogYFJlc3RhcnRgLFxuXHRcdFx0XHRpZDogJ3ZvaWQudXBkYXRlci5yZXN0YXJ0Jyxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdHVwZGF0ZVNlcnZpY2UucXVpdEFuZEluc3RhbGwoKVxuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdH1cblxuXHRcdHByaW1hcnkucHVzaCh7XG5cdFx0XHRpZDogJ3ZvaWQudXBkYXRlci5zaXRlJyxcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRsYWJlbDogYFZvaWQgU2l0ZWAsXG5cdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgeyB3aW5kb3cgfSA9IGRvbS5nZXRBY3RpdmVXaW5kb3coKVxuXHRcdFx0XHR3aW5kb3cub3BlbignaHR0cHM6Ly92b2lkZWRpdG9yLmNvbS8nKVxuXHRcdFx0fVxuXHRcdH0pXG5cblx0XHRhY3Rpb25zID0ge1xuXHRcdFx0cHJpbWFyeTogcHJpbWFyeSxcblx0XHRcdHNlY29uZGFyeTogW3tcblx0XHRcdFx0aWQ6ICd2b2lkLnVwZGF0ZXIuY2xvc2UnLFxuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRsYWJlbDogYEtlZXAgY3VycmVudCB2ZXJzaW9uYCxcblx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdG5vdGlmQ29udHJvbGxlci5jbG9zZSgpXG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0fVxuXHR9XG5cdGVsc2Uge1xuXHRcdGFjdGlvbnMgPSB1bmRlZmluZWRcblx0fVxuXG5cdGNvbnN0IG5vdGlmQ29udHJvbGxlciA9IG5vdGlmU2VydmljZS5ub3RpZnkoe1xuXHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdG1lc3NhZ2U6IG1lc3NhZ2UsXG5cdFx0c3RpY2t5OiB0cnVlLFxuXHRcdHByb2dyZXNzOiBhY3Rpb25zID8geyB3b3JrZWQ6IDAsIHRvdGFsOiAxMDAgfSA6IHVuZGVmaW5lZCxcblx0XHRhY3Rpb25zOiBhY3Rpb25zLFxuXHR9KVxuXG5cdHJldHVybiBub3RpZkNvbnRyb2xsZXJcblx0Ly8gY29uc3QgZCA9IG5vdGlmQ29udHJvbGxlci5vbkRpZENsb3NlKCgpID0+IHtcblx0Ly8gXHRub3RpZnlZZXNVcGRhdGUobm90aWZTZXJ2aWNlLCByZXMpXG5cdC8vIFx0ZC5kaXNwb3NlKClcblx0Ly8gfSlcbn1cbmNvbnN0IG5vdGlmeUVyckNoZWNraW5nID0gKG5vdGlmU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UpOiBJTm90aWZpY2F0aW9uSGFuZGxlID0+IHtcblx0Y29uc3QgbWVzc2FnZSA9IGBWb2lkIEVycm9yOiBUaGVyZSB3YXMgYW4gZXJyb3IgY2hlY2tpbmcgZm9yIHVwZGF0ZXMuIElmIHRoaXMgcGVyc2lzdHMsIHBsZWFzZSBnZXQgaW4gdG91Y2ggb3IgcmVpbnN0YWxsIFZvaWQgW2hlcmVdKGh0dHBzOi8vdm9pZGVkaXRvci5jb20vZG93bmxvYWQtYmV0YSkhYFxuXHRjb25zdCBub3RpZkNvbnRyb2xsZXIgPSBub3RpZlNlcnZpY2Uubm90aWZ5KHtcblx0XHRzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyxcblx0XHRtZXNzYWdlOiBtZXNzYWdlLFxuXHRcdHN0aWNreTogdHJ1ZSxcblx0fSlcblx0cmV0dXJuIG5vdGlmQ29udHJvbGxlclxufVxuXG5cbmNvbnN0IHBlcmZvcm1Wb2lkQ2hlY2sgPSBhc3luYyAoXG5cdGV4cGxpY2l0OiBib29sZWFuLFxuXHRub3RpZlNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHR2b2lkVXBkYXRlU2VydmljZTogSVZvaWRVcGRhdGVTZXJ2aWNlLFxuXHRtZXRyaWNzU2VydmljZTogSU1ldHJpY3NTZXJ2aWNlLFxuXHR1cGRhdGVTZXJ2aWNlOiBJVXBkYXRlU2VydmljZSxcbik6IFByb21pc2U8SU5vdGlmaWNhdGlvbkhhbmRsZSB8IG51bGw+ID0+IHtcblxuXHRjb25zdCBtZXRyaWNzVGFnID0gZXhwbGljaXQgPyAnTWFudWFsJyA6ICdBdXRvJ1xuXG5cdG1ldHJpY3NTZXJ2aWNlLmNhcHR1cmUoYFZvaWQgVXBkYXRlICR7bWV0cmljc1RhZ306IENoZWNraW5nLi4uYCwge30pXG5cdGNvbnN0IHJlcyA9IGF3YWl0IHZvaWRVcGRhdGVTZXJ2aWNlLmNoZWNrKGV4cGxpY2l0KVxuXHRpZiAoIXJlcykge1xuXHRcdGNvbnN0IG5vdGlmQ29udHJvbGxlciA9IG5vdGlmeUVyckNoZWNraW5nKG5vdGlmU2VydmljZSk7XG5cdFx0bWV0cmljc1NlcnZpY2UuY2FwdHVyZShgVm9pZCBVcGRhdGUgJHttZXRyaWNzVGFnfTogRXJyb3JgLCB7IHJlcyB9KVxuXHRcdHJldHVybiBub3RpZkNvbnRyb2xsZXJcblx0fVxuXHRlbHNlIHtcblx0XHRpZiAocmVzLm1lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IG5vdGlmQ29udHJvbGxlciA9IG5vdGlmeVVwZGF0ZShyZXMsIG5vdGlmU2VydmljZSwgdXBkYXRlU2VydmljZSlcblx0XHRcdG1ldHJpY3NTZXJ2aWNlLmNhcHR1cmUoYFZvaWQgVXBkYXRlICR7bWV0cmljc1RhZ306IFllc2AsIHsgcmVzIH0pXG5cdFx0XHRyZXR1cm4gbm90aWZDb250cm9sbGVyXG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0bWV0cmljc1NlcnZpY2UuY2FwdHVyZShgVm9pZCBVcGRhdGUgJHttZXRyaWNzVGFnfTogTm9gLCB7IHJlcyB9KVxuXHRcdFx0cmV0dXJuIG51bGxcblx0XHR9XG5cdH1cbn1cblxuXG4vLyBBY3Rpb25cbmxldCBsYXN0Tm90aWZDb250cm9sbGVyOiBJTm90aWZpY2F0aW9uSGFuZGxlIHwgbnVsbCA9IG51bGxcblxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRpZDogJ3ZvaWQudm9pZENoZWNrVXBkYXRlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3ZvaWRDaGVja1VwZGF0ZScsICdWb2lkOiBDaGVjayBmb3IgVXBkYXRlcycpLFxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZvaWRVcGRhdGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWb2lkVXBkYXRlU2VydmljZSlcblx0XHRjb25zdCBub3RpZlNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpXG5cdFx0Y29uc3QgbWV0cmljc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU1ldHJpY3NTZXJ2aWNlKVxuXHRcdGNvbnN0IHVwZGF0ZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVwZGF0ZVNlcnZpY2UpXG5cblx0XHRjb25zdCBjdXJyTm90aWZDb250cm9sbGVyID0gbGFzdE5vdGlmQ29udHJvbGxlclxuXG5cdFx0Y29uc3QgbmV3Q29udHJvbGxlciA9IGF3YWl0IHBlcmZvcm1Wb2lkQ2hlY2sodHJ1ZSwgbm90aWZTZXJ2aWNlLCB2b2lkVXBkYXRlU2VydmljZSwgbWV0cmljc1NlcnZpY2UsIHVwZGF0ZVNlcnZpY2UpXG5cblx0XHRpZiAobmV3Q29udHJvbGxlcikge1xuXHRcdFx0Y3Vyck5vdGlmQ29udHJvbGxlcj8uY2xvc2UoKVxuXHRcdFx0bGFzdE5vdGlmQ29udHJvbGxlciA9IG5ld0NvbnRyb2xsZXJcblx0XHR9XG5cdH1cbn0pXG5cbi8vIG9uIG1vdW50XG5jbGFzcyBWb2lkVXBkYXRlV29ya2JlbmNoQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIudm9pZC52b2lkVXBkYXRlJ1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVZvaWRVcGRhdGVTZXJ2aWNlIHZvaWRVcGRhdGVTZXJ2aWNlOiBJVm9pZFVwZGF0ZVNlcnZpY2UsXG5cdFx0QElNZXRyaWNzU2VydmljZSBtZXRyaWNzU2VydmljZTogSU1ldHJpY3NTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZlNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJVXBkYXRlU2VydmljZSB1cGRhdGVTZXJ2aWNlOiBJVXBkYXRlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKVxuXG5cdFx0Y29uc3QgYXV0b0NoZWNrID0gKCkgPT4ge1xuXHRcdFx0cGVyZm9ybVZvaWRDaGVjayhmYWxzZSwgbm90aWZTZXJ2aWNlLCB2b2lkVXBkYXRlU2VydmljZSwgbWV0cmljc1NlcnZpY2UsIHVwZGF0ZVNlcnZpY2UpXG5cdFx0fVxuXG5cdFx0Ly8gY2hlY2sgb25jZSA1IHNlY29uZHMgYWZ0ZXIgbW91bnRcblx0XHQvLyBjaGVjayBldmVyeSAzIGhvdXJzXG5cdFx0Y29uc3QgeyB3aW5kb3cgfSA9IGRvbS5nZXRBY3RpdmVXaW5kb3coKVxuXG5cdFx0Y29uc3QgaW5pdElkID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4gYXV0b0NoZWNrKCksIDUgKiAxMDAwKVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHsgZGlzcG9zZTogKCkgPT4gd2luZG93LmNsZWFyVGltZW91dChpbml0SWQpIH0pXG5cblxuXHRcdGNvbnN0IGludGVydmFsSWQgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gYXV0b0NoZWNrKCksIDMgKiA2MCAqIDYwICogMTAwMCkgLy8gZXZlcnkgMyBocnNcblx0XHR0aGlzLl9yZWdpc3Rlcih7IGRpc3Bvc2U6ICgpID0+IHdpbmRvdy5jbGVhckludGVydmFsKGludGVydmFsSWQpIH0pXG5cblx0fVxufVxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFZvaWRVcGRhdGVXb3JrYmVuY2hDb250cmlidXRpb24uSUQsIFZvaWRVcGRhdGVXb3JrYmVuY2hDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLE9BQU8sY0FBYztBQUVyQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFNBQVMsdUJBQXVCO0FBQ3pDLFNBQW9ELDRCQUE0QjtBQUNoRixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFpQyxnQ0FBZ0Msc0JBQXNCO0FBQ3ZGLFlBQVksU0FBUztBQUNyQixTQUFTLHNCQUFzQjtBQU8vQixNQUFNLGVBQWUsQ0FBQyxLQUFtRCxjQUFvQyxrQkFBdUQ7QUFDbkssUUFBTSxVQUFVLEtBQUssV0FBVztBQUVoQyxNQUFJO0FBRUosTUFBSSxLQUFLLFFBQVE7QUFDaEIsVUFBTSxVQUFxQixDQUFDO0FBRTVCLFFBQUksSUFBSSxXQUFXLGFBQWE7QUFDL0IsY0FBUSxLQUFLO0FBQUEsUUFDWixPQUFPO0FBQUEsUUFDUCxJQUFJO0FBQUEsUUFDSixTQUFTO0FBQUEsUUFDVCxTQUFTO0FBQUEsUUFDVCxPQUFPO0FBQUEsUUFDUCxLQUFLLE1BQU07QUFDVixnQkFBTSxFQUFFLE9B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
