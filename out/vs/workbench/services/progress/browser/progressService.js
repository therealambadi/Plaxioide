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
import "./media/progressService.css";
import { localize } from "../../../../nls.js";
import { dispose, DisposableStore, Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { IProgressService, ProgressLocation, Progress } from "../../../../platform/progress/common/progress.js";
import { StatusbarAlignment, IStatusbarService } from "../../statusbar/browser/statusbar.js";
import { DeferredPromise, RunOnceScheduler, timeout } from "../../../../base/common/async.js";
import { ProgressBadge, IActivityService } from "../../activity/common/activity.js";
import { INotificationService, Severity, NotificationPriority, isNotificationSource, NotificationsFilter } from "../../../../platform/notification/common/notification.js";
import { Action } from "../../../../base/common/actions.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { Dialog } from "../../../../base/browser/ui/dialog/dialog.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../views/common/viewsService.js";
import { IPaneCompositePartService } from "../../panecomposite/browser/panecomposite.js";
import { stripIcons } from "../../../../base/common/iconLabels.js";
import { IUserActivityService } from "../../userActivity/common/userActivityService.js";
import { createWorkbenchDialogOptions } from "../../../../platform/dialogs/browser/dialog.js";
let ProgressService = class extends Disposable {
  constructor(activityService, paneCompositeService, viewDescriptorService, viewsService, notificationService, statusbarService, layoutService, keybindingService, userActivityService) {
    super();
    this.activityService = activityService;
    this.paneCompositeService = paneCompositeService;
    this.viewDescriptorService = viewDescriptorService;
    this.viewsService = viewsService;
    this.notificationService = notificationService;
    this.statusbarService = statusbarService;
    this.layoutService = layoutService;
    this.keybindingService = keybindingService;
    this.userActivityService = userActivityService;
    this.windowProgressStack = [];
    this.windowProgressStatusEntry = void 0;
  }
  async withProgress(options, originalTask, onDidCancel) {
    const { location } = options;
    const task = async (progress) => {
      const activeLock = this.userActivityService.markActive({ whenHeldFor: 15e3 });
      try {
        return await originalTask(progress);
      } finally {
        activeLock.dispose();
      }
    };
    const handleStringLocation = (location2) => {
      const viewContainer = this.viewDescriptorService.getViewContainerById(location2);
      if (viewContainer) {
        const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
        if (viewContainerLocation !== null) {
          return this.withPaneCompositeProgress(location2, viewContainerLocation, task, { ...options, location: location2 });
        }
      }
      if (this.viewDescriptorService.getViewDescriptorById(location2) !== null) {
        return this.withViewProgress(location2, task, { ...options, location: location2 });
      }
      throw new Error(`Bad progress location: ${location2}`);
    };
    if (typeof location === "string") {
      return handleStringLocation(location);
    }
    switch (location) {
      case ProgressLocation.Notification: {
        let priority = options.priority;
        if (priority !== NotificationPriority.URGENT) {
          if (this.notificationService.getFilter() === NotificationsFilter.ERROR) {
            priority = NotificationPriority.SILENT;
          } else if (isNotificationSource(options.source) && this.notificationService.getFilter(options.source) === NotificationsFilter.ERROR) {
            priority = NotificationPriority.SILENT;
          }
        }
        return this.withNotificationProgress({ ...options, location, priority }, task, onDidCancel);
      }
      case ProgressLocation.Window: {
        const type = options.type;
        if (options.command) {
          return this.withWindowProgress({ ...options, location, type }, task);
        }
        return this.withNotificationProgress({ delay: 150, ...options, priority: NotificationPriority.SILENT, location: ProgressLocation.Notification, type }, task, onDidCancel);
      }
      case ProgressLocation.Explorer:
        return this.withPaneCompositeProgress("workbench.view.explorer", ViewContainerLocation.Sidebar, task, { ...options, location });
      case ProgressLocation.Scm:
        return handleStringLocation("workbench.scm");
      case ProgressLocation.Extensions:
        return this.withPaneCompositeProgress("workbench.view.extensions", ViewContainerLocation.Sidebar, task, { ...options, location });
      case ProgressLocation.Dialog:
        return this.withDialogProgress(options, task, onDidCancel);
      default:
        throw new Error(`Bad progress location: ${location}`);
    }
  }
  withWindowProgress(options, callback) {
    const task = [options, new Progress(() => this.updateWindowProgress())];
    const promise = callback(task[1]);
    let delayHandle = setTimeout(() => {
      delayHandle = void 0;
      this.windowProgressStack.unshift(task);
      this.updateWindowProgress();
      Promise.all([
        timeout(150),
        promise
      ]).finally(() => {
        const idx = this.windowProgressStack.indexOf(task);
        this.windowProgressStack.splice(idx, 1);
        this.updateWindowProgress();
      });
    }, 150);
    return promise.finally(() => clearTimeout(delayHandle));
  }
  updateWindowProgress(idx = 0) {
    if (idx < this.windowProgressStack.length) {
      const [options, progress] = this.windowProgressStack[idx];
      const progressTitle = options.title;
      const progressMessage = progress.value && progress.value.message;
      const progressCommand = options.command;
      let text;
      let title;
      const source = options.source && typeof options.source !== "string" ? options.source.label : options.source;
      if (progressTitle && progressMessage) {
        text = localize("progress.text2", "{0}: {1}", progressTitle, progressMessage);
        title = source ? localize("progress.title3", "[{0}] {1}: {2}", source, progressTitle, progressMessage) : text;
      } else if (progressTitle) {
        text = progressTitle;
        title = source ? localize("progress.title2", "[{0}]: {1}", source, progressTitle) : text;
      } else if (progressMessage) {
        text = progressMessage;
        title = source ? localize("progress.title2", "[{0}]: {1}", source, progressMessage) : text;
      } else {
        this.updateWindowProgress(idx + 1);
        return;
      }
      const statusEntryProperties = {
        name: localize("status.progress", "Progress Message"),
        text,
        showProgress: options.type || true,
        ariaLabel: text,
        tooltip: stripIcons(title).trim(),
        command: progressCommand
      };
      if (this.windowProgressStatusEntry) {
        this.windowProgressStatusEntry.update(statusEntryProperties);
      } else {
        this.windowProgressStatusEntry = this.statusbarService.addEntry(
          statusEntryProperties,
          "status.progress",
          StatusbarAlignment.LEFT,
          -Number.MAX_VALUE
          /* almost last entry */
        );
      }
    } else {
      this.windowProgressStatusEntry?.dispose();
      this.windowProgressStatusEntry = void 0;
    }
  }
  withNotificationProgress(options, callback, onDidCancel) {
    const progressStateModel = new class extends Disposable {
      constructor() {
        super();
        this._onDidReport = this._register(new Emitter());
        this.onDidReport = this._onDidReport.event;
        this._onWillDispose = this._register(new Emitter());
        this.onWillDispose = this._onWillDispose.event;
        this._step = void 0;
        this._done = false;
        this.promise = callback(this);
        this.promise.finally(() => {
          this.dispose();
        });
      }
      get step() {
        return this._step;
      }
      get done() {
        return this._done;
      }
      report(step) {
        this._step = step;
        this._onDidReport.fire(step);
      }
      cancel(choice) {
        onDidCancel?.(choice);
        this.dispose();
      }
      dispose() {
        this._done = true;
        this._onWillDispose.fire();
        super.dispose();
      }
    }();
    const createWindowProgress = () => {
      const promise = new DeferredPromise();
      this.withWindowProgress({
        location: ProgressLocation.Window,
        title: options.title ? parseLinkedText(options.title).toString() : void 0,
        // convert markdown links => string
        command: "notifications.showList",
        type: options.type
      }, (progress) => {
        function reportProgress(step) {
          if (step.message) {
            progress.report({
              message: parseLinkedText(step.message).toString()
              // convert markdown links => string
            });
          }
        }
        if (progressStateModel.step) {
          reportProgress(progressStateModel.step);
        }
        const onDidReportListener = progressStateModel.onDidReport((step) => reportProgress(step));
        promise.p.finally(() => onDidReportListener.dispose());
        Event.once(progressStateModel.onWillDispose)(() => promise.complete());
        return promise.p;
      });
      return toDisposable(() => promise.complete());
    };
    const createNotification = (message, priority, increment) => {
      const notificationDisposables = new DisposableStore();
      const primaryActions = options.primaryActions ? Array.from(options.primaryActions) : [];
      const secondaryActions = options.secondaryActions ? Array.from(options.secondaryActions) : [];
      if (options.buttons) {
        options.buttons.forEach((button, index) => {
          const buttonAction = new class extends Action {
            constructor() {
              super(`progress.button.${button}`, button, void 0, true);
            }
            async run() {
              progressStateModel.cancel(index);
            }
          }();
          notificationDisposables.add(buttonAction);
          primaryActions.push(buttonAction);
        });
      }
      if (options.cancellable) {
        const cancelAction = new class extends Action {
          constructor() {
            super("progress.cancel", typeof options.cancellable === "string" ? options.cancellable : localize("cancel", "Cancel"), void 0, true);
          }
          async run() {
            progressStateModel.cancel();
          }
        }();
        notificationDisposables.add(cancelAction);
        primaryActions.push(cancelAction);
      }
      const notification = this.notificationService.notify({
        severity: Severity.Info,
        message: stripIcons(message),
        // status entries support codicons, but notifications do not (https://github.com/microsoft/vscode/issues/145722)
        source: options.source,
        actions: { primary: primaryActions, secondary: secondaryActions },
        progress: typeof increment === "number" && increment >= 0 ? { total: 100, worked: increment } : { infinite: true },
        priority
      });
      let windowProgressDisposable = void 0;
      const onVisibilityChange = (visible) => {
        dispose(windowProgressDisposable);
        if (!visible && !progressStateModel.done) {
          windowProgressDisposable = createWindowProgress();
        }
      };
      notificationDisposables.add(notification.onDidChangeVisibility(onVisibilityChange));
      if (priority === NotificationPriority.SILENT) {
        onVisibilityChange(false);
      }
      Event.once(notification.onDidClose)(() => {
        notificationDisposables.dispose();
        dispose(windowProgressDisposable);
      });
      return notification;
    };
    const updateProgress = (notification, increment) => {
      if (typeof increment === "number" && increment >= 0) {
        notification.progress.total(100);
        notification.progress.worked(increment);
      } else {
        notification.progress.infinite();
      }
    };
    let notificationHandle;
    let notificationTimeout;
    let titleAndMessage;
    const updateNotification = (step) => {
      if (step?.message && options.title) {
        titleAndMessage = `${options.title}: ${step.message}`;
      } else {
        titleAndMessage = options.title || step?.message;
      }
      if (!notificationHandle && titleAndMessage) {
        if (typeof options.delay === "number" && options.delay > 0) {
          if (typeof notificationTimeout !== "number") {
            notificationTimeout = setTimeout(() => notificationHandle = createNotification(titleAndMessage, options.priority, step?.increment), options.delay);
          }
        } else {
          notificationHandle = createNotification(titleAndMessage, options.priority, step?.increment);
        }
      }
      if (notificationHandle) {
        if (titleAndMessage) {
          notificationHandle.updateMessage(titleAndMessage);
        }
        if (typeof step?.increment === "number") {
          updateProgress(notificationHandle, step.increment);
        }
      }
    };
    updateNotification(progressStateModel.step);
    const listener = progressStateModel.onDidReport((step) => updateNotification(step));
    Event.once(progressStateModel.onWillDispose)(() => listener.dispose());
    (async () => {
      try {
        if (typeof options.delay === "number" && options.delay > 0) {
          await progressStateModel.promise;
        } else {
          await Promise.all([timeout(800), progressStateModel.promise]);
        }
      } finally {
        clearTimeout(notificationTimeout);
        notificationHandle?.close();
      }
    })();
    return progressStateModel.promise;
  }
  withPaneCompositeProgress(paneCompositeId, viewContainerLocation, task, options) {
    const progressIndicator = this.paneCompositeService.getProgressIndicator(paneCompositeId, viewContainerLocation);
    const promise = progressIndicator ? this.withCompositeProgress(progressIndicator, task, options) : task({ report: () => {
    } });
    if (viewContainerLocation === ViewContainerLocation.Sidebar) {
      this.showOnActivityBar(paneCompositeId, options, promise);
    }
    return promise;
  }
  withViewProgress(viewId, task, options) {
    const progressIndicator = this.viewsService.getViewProgressIndicator(viewId);
    const promise = progressIndicator ? this.withCompositeProgress(progressIndicator, task, options) : task({ report: () => {
    } });
    const viewletId = this.viewDescriptorService.getViewContainerByViewId(viewId)?.id;
    if (viewletId === void 0) {
      return promise;
    }
    this.showOnActivityBar(viewletId, options, promise);
    return promise;
  }
  showOnActivityBar(viewletId, options, promise) {
    let activityProgress;
    let delayHandle = setTimeout(() => {
      delayHandle = void 0;
      const handle = this.activityService.showViewContainerActivity(viewletId, { badge: new ProgressBadge(() => "") });
      const startTimeVisible = Date.now();
      const minTimeVisible = 300;
      activityProgress = {
        dispose() {
          const d = Date.now() - startTimeVisible;
          if (d < minTimeVisible) {
            setTimeout(() => handle.dispose(), minTimeVisible - d);
          } else {
            handle.dispose();
          }
        }
      };
    }, options.delay || 300);
    promise.finally(() => {
      clearTimeout(delayHandle);
      dispose(activityProgress);
    });
  }
  withCompositeProgress(progressIndicator, task, options) {
    let discreteProgressRunner = void 0;
    function updateProgress(stepOrTotal) {
      let total = void 0;
      let increment = void 0;
      if (typeof stepOrTotal !== "undefined") {
        if (typeof stepOrTotal === "number") {
          total = stepOrTotal;
        } else if (typeof stepOrTotal.increment === "number") {
          total = stepOrTotal.total ?? 100;
          increment = stepOrTotal.increment;
        }
      }
      if (typeof total === "number") {
        if (!discreteProgressRunner) {
          discreteProgressRunner = progressIndicator.show(total, options.delay);
          promise.catch(
            () => void 0
            /* ignore */
          ).finally(() => discreteProgressRunner?.done());
        }
        if (typeof increment === "number") {
          discreteProgressRunner.worked(increment);
        }
      } else {
        discreteProgressRunner?.done();
        progressIndicator.showWhile(promise, options.delay);
      }
      return discreteProgressRunner;
    }
    const promise = task({
      report: (progress) => {
        updateProgress(progress);
      }
    });
    updateProgress(options.total);
    return promise;
  }
  withDialogProgress(options, task, onDidCancel) {
    const disposables = new DisposableStore();
    let dialog;
    let taskCompleted = false;
    const createDialog = (message) => {
      const buttons = options.buttons || [];
      if (!options.sticky) {
        buttons.push(
          options.cancellable ? typeof options.cancellable === "boolean" ? localize("cancel", "Cancel") : options.cancellable : localize("dismiss", "Dismiss")
        );
      }
      dialog = new Dialog(
        this.layoutService.activeContainer,
        message,
        buttons,
        createWorkbenchDialogOptions({
          type: "pending",
          detail: options.detail,
          cancelId: buttons.length - 1,
          disableCloseAction: options.sticky,
          disableDefaultAction: options.sticky
        }, this.keybindingService, this.layoutService)
      );
      disposables.add(dialog);
      dialog.show().then((dialogResult) => {
        if (!taskCompleted) {
          onDidCancel?.(dialogResult.button);
        }
        dispose(dialog);
      });
      return dialog;
    };
    let delay = options.delay ?? 0;
    let latestMessage = void 0;
    const scheduler = disposables.add(new RunOnceScheduler(() => {
      delay = 0;
      if (latestMessage && !dialog) {
        dialog = createDialog(latestMessage);
      } else if (latestMessage) {
        dialog.updateMessage(latestMessage);
      }
    }, 0));
    const updateDialog = function(message) {
      latestMessage = message;
      if (!scheduler.isScheduled()) {
        scheduler.schedule(delay);
      }
    };
    const promise = task({
      report: (progress) => {
        updateDialog(progress.message);
      }
    });
    promise.finally(() => {
      taskCompleted = true;
      dispose(disposables);
    });
    if (options.title) {
      updateDialog(options.title);
    }
    return promise;
  }
};
ProgressService = __decorateClass([
  __decorateParam(0, IActivityService),
  __decorateParam(1, IPaneCompositePartService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IViewsService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IStatusbarService),
  __decorateParam(6, ILayoutService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IUserActivityService)
], ProgressService);
registerSingleton(IProgressService, ProgressService, InstantiationType.Delayed);
export {
  ProgressService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcHJvZ3Jlc3MvYnJvd3Nlci9wcm9ncmVzc1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvcHJvZ3Jlc3NTZXJ2aWNlLmNzcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSwgRGlzcG9zYWJsZVN0b3JlLCBEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgSVByb2dyZXNzT3B0aW9ucywgSVByb2dyZXNzU3RlcCwgUHJvZ3Jlc3NMb2NhdGlvbiwgSVByb2dyZXNzLCBQcm9ncmVzcywgSVByb2dyZXNzQ29tcG9zaXRlT3B0aW9ucywgSVByb2dyZXNzTm90aWZpY2F0aW9uT3B0aW9ucywgSVByb2dyZXNzUnVubmVyLCBJUHJvZ3Jlc3NJbmRpY2F0b3IsIElQcm9ncmVzc1dpbmRvd09wdGlvbnMsIElQcm9ncmVzc0RpYWxvZ09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgU3RhdHVzYmFyQWxpZ25tZW50LCBJU3RhdHVzYmFyU2VydmljZSwgSVN0YXR1c2JhckVudHJ5QWNjZXNzb3IsIElTdGF0dXNiYXJFbnRyeSB9IGZyb20gJy4uLy4uL3N0YXR1c2Jhci9icm93c2VyL3N0YXR1c2Jhci5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIFJ1bk9uY2VTY2hlZHVsZXIsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzc0JhZGdlLCBJQWN0aXZpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYWN0aXZpdHkvY29tbW9uL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSwgSU5vdGlmaWNhdGlvbkhhbmRsZSwgTm90aWZpY2F0aW9uUHJpb3JpdHksIGlzTm90aWZpY2F0aW9uU291cmNlLCBOb3RpZmljYXRpb25zRmlsdGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpYWxvZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9kaWFsb2cvZGlhbG9nLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgcGFyc2VMaW5rZWRUZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkVGV4dC5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IHN0cmlwSWNvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IElVc2VyQWN0aXZpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckFjdGl2aXR5L2NvbW1vbi91c2VyQWN0aXZpdHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNyZWF0ZVdvcmtiZW5jaERpYWxvZ09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2Jyb3dzZXIvZGlhbG9nLmpzJztcblxuZXhwb3J0IGNsYXNzIFByb2dyZXNzU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJUHJvZ3Jlc3NTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUFjdGl2aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjdGl2aXR5U2VydmljZTogSUFjdGl2aXR5U2VydmljZSxcblx0XHRASVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhbmVDb21wb3NpdGVTZXJ2aWNlOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJVmlld3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdmlld3NTZXJ2aWNlOiBJVmlld3NTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RhdHVzYmFyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0YXR1c2JhclNlcnZpY2U6IElTdGF0dXNiYXJTZXJ2aWNlLFxuXHRcdEBJTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJVXNlckFjdGl2aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJBY3Rpdml0eVNlcnZpY2U6IElVc2VyQWN0aXZpdHlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0YXN5bmMgd2l0aFByb2dyZXNzPFIgPSB1bmtub3duPihvcHRpb25zOiBJUHJvZ3Jlc3NPcHRpb25zLCBvcmlnaW5hbFRhc2s6IChwcm9ncmVzczogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+KSA9PiBQcm9taXNlPFI+LCBvbkRpZENhbmNlbD86IChjaG9pY2U/OiBudW1iZXIpID0+IHZvaWQpOiBQcm9taXNlPFI+IHtcblx0XHRjb25zdCB7IGxvY2F0aW9uIH0gPSBvcHRpb25zO1xuXG5cdFx0Y29uc3QgdGFzayA9IGFzeW5jIChwcm9ncmVzczogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+KSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVMb2NrID0gdGhpcy51c2VyQWN0aXZpdHlTZXJ2aWNlLm1hcmtBY3RpdmUoeyB3aGVuSGVsZEZvcjogMTVfMDAwIH0pO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIGF3YWl0IG9yaWdpbmFsVGFzayhwcm9ncmVzcyk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRhY3RpdmVMb2NrLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgaGFuZGxlU3RyaW5nTG9jYXRpb24gPSAobG9jYXRpb246IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3Qgdmlld0NvbnRhaW5lciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeUlkKGxvY2F0aW9uKTtcblx0XHRcdGlmICh2aWV3Q29udGFpbmVyKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdDb250YWluZXJMb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJMb2NhdGlvbih2aWV3Q29udGFpbmVyKTtcblx0XHRcdFx0aWYgKHZpZXdDb250YWluZXJMb2NhdGlvbiAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLndpdGhQYW5lQ29tcG9zaXRlUHJvZ3Jlc3MobG9jYXRpb24sIHZpZXdDb250YWluZXJMb2NhdGlvbiwgdGFzaywgeyAuLi5vcHRpb25zLCBsb2NhdGlvbiB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKGxvY2F0aW9uKSAhPT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy53aXRoVmlld1Byb2dyZXNzKGxvY2F0aW9uLCB0YXNrLCB7IC4uLm9wdGlvbnMsIGxvY2F0aW9uIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEJhZCBwcm9ncmVzcyBsb2NhdGlvbjogJHtsb2NhdGlvbn1gKTtcblx0XHR9O1xuXG5cdFx0aWYgKHR5cGVvZiBsb2NhdGlvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBoYW5kbGVTdHJpbmdMb2NhdGlvbihsb2NhdGlvbik7XG5cdFx0fVxuXG5cdFx0c3dpdGNoIChsb2NhdGlvbikge1xuXHRcdFx0Y2FzZSBQcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbjoge1xuXHRcdFx0XHRsZXQgcHJpb3JpdHkgPSAob3B0aW9ucyBhcyBJUHJvZ3Jlc3NOb3RpZmljYXRpb25PcHRpb25zKS5wcmlvcml0eTtcblx0XHRcdFx0aWYgKHByaW9yaXR5ICE9PSBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlQpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmdldEZpbHRlcigpID09PSBOb3RpZmljYXRpb25zRmlsdGVyLkVSUk9SKSB7XG5cdFx0XHRcdFx0XHRwcmlvcml0eSA9IE5vdGlmaWNhdGlvblByaW9yaXR5LlNJTEVOVDtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGlzTm90aWZpY2F0aW9uU291cmNlKG9wdGlvbnMuc291cmNlKSAmJiB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZ2V0RmlsdGVyKG9wdGlvbnMuc291cmNlKSA9PT0gTm90aWZpY2F0aW9uc0ZpbHRlci5FUlJPUikge1xuXHRcdFx0XHRcdFx0cHJpb3JpdHkgPSBOb3RpZmljYXRpb25Qcmlvcml0eS5TSUxFTlQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMud2l0aE5vdGlmaWNhdGlvblByb2dyZXNzKHsgLi4ub3B0aW9ucywgbG9jYXRpb24sIHByaW9yaXR5IH0sIHRhc2ssIG9uRGlkQ2FuY2VsKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgUHJvZ3Jlc3NMb2NhdGlvbi5XaW5kb3c6IHtcblx0XHRcdFx0Y29uc3QgdHlwZSA9IChvcHRpb25zIGFzIElQcm9ncmVzc1dpbmRvd09wdGlvbnMpLnR5cGU7XG5cdFx0XHRcdGlmICgob3B0aW9ucyBhcyBJUHJvZ3Jlc3NXaW5kb3dPcHRpb25zKS5jb21tYW5kKSB7XG5cdFx0XHRcdFx0Ly8gV2luZG93IHByb2dyZXNzIHdpdGggY29tbWFuZCBnZXQncyBzaG93biBpbiB0aGUgc3RhdHVzIGJhclxuXHRcdFx0XHRcdHJldHVybiB0aGlzLndpdGhXaW5kb3dQcm9ncmVzcyh7IC4uLm9wdGlvbnMsIGxvY2F0aW9uLCB0eXBlIH0sIHRhc2spO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFdpbmRvdyBwcm9ncmVzcyB3aXRob3V0IGNvbW1hbmQgY2FuIGJlIHNob3duIGFzIHNpbGVudCBub3RpZmljYXRpb25cblx0XHRcdFx0Ly8gd2hpY2ggd2lsbCBmaXJzdCBhcHBlYXIgaW4gdGhlIHN0YXR1cyBiYXIgYW5kIGNhbiB0aGVuIGJlIGJyb3VnaHQgdG9cblx0XHRcdFx0Ly8gdGhlIGZyb250IHdoZW4gY2xpY2tpbmcuXG5cdFx0XHRcdHJldHVybiB0aGlzLndpdGhOb3RpZmljYXRpb25Qcm9ncmVzcyh7IGRlbGF5OiAxNTAgLyogZGVmYXVsdCBmb3IgUHJvZ3Jlc3NMb2NhdGlvbi5XaW5kb3cgKi8sIC4uLm9wdGlvbnMsIHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5TSUxFTlQsIGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbiwgdHlwZSB9LCB0YXNrLCBvbkRpZENhbmNlbCk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFByb2dyZXNzTG9jYXRpb24uRXhwbG9yZXI6XG5cdFx0XHRcdHJldHVybiB0aGlzLndpdGhQYW5lQ29tcG9zaXRlUHJvZ3Jlc3MoJ3dvcmtiZW5jaC52aWV3LmV4cGxvcmVyJywgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIHRhc2ssIHsgLi4ub3B0aW9ucywgbG9jYXRpb24gfSk7XG5cdFx0XHRjYXNlIFByb2dyZXNzTG9jYXRpb24uU2NtOlxuXHRcdFx0XHRyZXR1cm4gaGFuZGxlU3RyaW5nTG9jYXRpb24oJ3dvcmtiZW5jaC5zY20nKTtcblx0XHRcdGNhc2UgUHJvZ3Jlc3NMb2NhdGlvbi5FeHRlbnNpb25zOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy53aXRoUGFuZUNvbXBvc2l0ZVByb2dyZXNzKCd3b3JrYmVuY2gudmlldy5leHRlbnNpb25zJywgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIHRhc2ssIHsgLi4ub3B0aW9ucywgbG9jYXRpb24gfSk7XG5cdFx0XHRjYXNlIFByb2dyZXNzTG9jYXRpb24uRGlhbG9nOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy53aXRoRGlhbG9nUHJvZ3Jlc3Mob3B0aW9ucywgdGFzaywgb25EaWRDYW5jZWwpO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBCYWQgcHJvZ3Jlc3MgbG9jYXRpb246ICR7bG9jYXRpb259YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSB3aW5kb3dQcm9ncmVzc1N0YWNrOiBbSVByb2dyZXNzV2luZG93T3B0aW9ucywgUHJvZ3Jlc3M8SVByb2dyZXNzU3RlcD5dW10gPSBbXTtcblx0cHJpdmF0ZSB3aW5kb3dQcm9ncmVzc1N0YXR1c0VudHJ5OiBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHdpdGhXaW5kb3dQcm9ncmVzczxSID0gdW5rbm93bj4ob3B0aW9uczogSVByb2dyZXNzV2luZG93T3B0aW9ucywgY2FsbGJhY2s6IChwcm9ncmVzczogSVByb2dyZXNzPHsgbWVzc2FnZT86IHN0cmluZyB9PikgPT4gUHJvbWlzZTxSPik6IFByb21pc2U8Uj4ge1xuXHRcdGNvbnN0IHRhc2s6IFtJUHJvZ3Jlc3NXaW5kb3dPcHRpb25zLCBQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPl0gPSBbb3B0aW9ucywgbmV3IFByb2dyZXNzPElQcm9ncmVzc1N0ZXA+KCgpID0+IHRoaXMudXBkYXRlV2luZG93UHJvZ3Jlc3MoKSldO1xuXG5cdFx0Y29uc3QgcHJvbWlzZSA9IGNhbGxiYWNrKHRhc2tbMV0pO1xuXG5cdFx0bGV0IGRlbGF5SGFuZGxlOiBhbnkgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGRlbGF5SGFuZGxlID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy53aW5kb3dQcm9ncmVzc1N0YWNrLnVuc2hpZnQodGFzayk7XG5cdFx0XHR0aGlzLnVwZGF0ZVdpbmRvd1Byb2dyZXNzKCk7XG5cblx0XHRcdC8vIHNob3cgcHJvZ3Jlc3MgZm9yIGF0IGxlYXN0IDE1MG1zXG5cdFx0XHRQcm9taXNlLmFsbChbXG5cdFx0XHRcdHRpbWVvdXQoMTUwKSxcblx0XHRcdFx0cHJvbWlzZVxuXHRcdFx0XSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGlkeCA9IHRoaXMud2luZG93UHJvZ3Jlc3NTdGFjay5pbmRleE9mKHRhc2spO1xuXHRcdFx0XHR0aGlzLndpbmRvd1Byb2dyZXNzU3RhY2suc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV2luZG93UHJvZ3Jlc3MoKTtcblx0XHRcdH0pO1xuXHRcdH0sIDE1MCk7XG5cblx0XHQvLyBjYW5jZWwgZGVsYXkgaWYgcHJvbWlzZSBmaW5pc2hlcyBiZWxvdyAxNTBtc1xuXHRcdHJldHVybiBwcm9taXNlLmZpbmFsbHkoKCkgPT4gY2xlYXJUaW1lb3V0KGRlbGF5SGFuZGxlKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVdpbmRvd1Byb2dyZXNzKGlkeDogbnVtYmVyID0gMCkge1xuXG5cdFx0Ly8gV2Ugc3RpbGwgaGF2ZSBwcm9ncmVzcyB0byBzaG93XG5cdFx0aWYgKGlkeCA8IHRoaXMud2luZG93UHJvZ3Jlc3NTdGFjay5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IFtvcHRpb25zLCBwcm9ncmVzc10gPSB0aGlzLndpbmRvd1Byb2dyZXNzU3RhY2tbaWR4XTtcblxuXHRcdFx0Y29uc3QgcHJvZ3Jlc3NUaXRsZSA9IG9wdGlvbnMudGl0bGU7XG5cdFx0XHRjb25zdCBwcm9ncmVzc01lc3NhZ2UgPSBwcm9ncmVzcy52YWx1ZSAmJiBwcm9ncmVzcy52YWx1ZS5tZXNzYWdlO1xuXHRcdFx0Y29uc3QgcHJvZ3Jlc3NDb21tYW5kID0gKDxJUHJvZ3Jlc3NXaW5kb3dPcHRpb25zPm9wdGlvbnMpLmNvbW1hbmQ7XG5cdFx0XHRsZXQgdGV4dDogc3RyaW5nO1xuXHRcdFx0bGV0IHRpdGxlOiBzdHJpbmc7XG5cdFx0XHRjb25zdCBzb3VyY2UgPSBvcHRpb25zLnNvdXJjZSAmJiB0eXBlb2Ygb3B0aW9ucy5zb3VyY2UgIT09ICdzdHJpbmcnID8gb3B0aW9ucy5zb3VyY2UubGFiZWwgOiBvcHRpb25zLnNvdXJjZTtcblxuXHRcdFx0aWYgKHByb2dyZXNzVGl0bGUgJiYgcHJvZ3Jlc3NNZXNzYWdlKSB7XG5cdFx0XHRcdC8vIDx0aXRsZT46IDxtZXNzYWdlPlxuXHRcdFx0XHR0ZXh0ID0gbG9jYWxpemUoJ3Byb2dyZXNzLnRleHQyJywgXCJ7MH06IHsxfVwiLCBwcm9ncmVzc1RpdGxlLCBwcm9ncmVzc01lc3NhZ2UpO1xuXHRcdFx0XHR0aXRsZSA9IHNvdXJjZSA/IGxvY2FsaXplKCdwcm9ncmVzcy50aXRsZTMnLCBcIlt7MH1dIHsxfTogezJ9XCIsIHNvdXJjZSwgcHJvZ3Jlc3NUaXRsZSwgcHJvZ3Jlc3NNZXNzYWdlKSA6IHRleHQ7XG5cblx0XHRcdH0gZWxzZSBpZiAocHJvZ3Jlc3NUaXRsZSkge1xuXHRcdFx0XHQvLyA8dGl0bGU+XG5cdFx0XHRcdHRleHQgPSBwcm9ncmVzc1RpdGxlO1xuXHRcdFx0XHR0aXRsZSA9IHNvdXJjZSA/IGxvY2FsaXplKCdwcm9ncmVzcy50aXRsZTInLCBcIlt7MH1dOiB7MX1cIiwgc291cmNlLCBwcm9ncmVzc1RpdGxlKSA6IHRleHQ7XG5cblx0XHRcdH0gZWxzZSBpZiAocHJvZ3Jlc3NNZXNzYWdlKSB7XG5cdFx0XHRcdC8vIDxtZXNzYWdlPlxuXHRcdFx0XHR0ZXh0ID0gcHJvZ3Jlc3NNZXNzYWdlO1xuXHRcdFx0XHR0aXRsZSA9IHNvdXJjZSA/IGxvY2FsaXplKCdwcm9ncmVzcy50aXRsZTInLCBcIlt7MH1dOiB7MX1cIiwgc291cmNlLCBwcm9ncmVzc01lc3NhZ2UpIDogdGV4dDtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gbm8gdGl0bGUsIG5vIG1lc3NhZ2UgLT4gbm8gcHJvZ3Jlc3MuIHRyeSB3aXRoIG5leHQgb24gc3RhY2tcblx0XHRcdFx0dGhpcy51cGRhdGVXaW5kb3dQcm9ncmVzcyhpZHggKyAxKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzdGF0dXNFbnRyeVByb3BlcnRpZXM6IElTdGF0dXNiYXJFbnRyeSA9IHtcblx0XHRcdFx0bmFtZTogbG9jYWxpemUoJ3N0YXR1cy5wcm9ncmVzcycsIFwiUHJvZ3Jlc3MgTWVzc2FnZVwiKSxcblx0XHRcdFx0dGV4dCxcblx0XHRcdFx0c2hvd1Byb2dyZXNzOiBvcHRpb25zLnR5cGUgfHwgdHJ1ZSxcblx0XHRcdFx0YXJpYUxhYmVsOiB0ZXh0LFxuXHRcdFx0XHR0b29sdGlwOiBzdHJpcEljb25zKHRpdGxlKS50cmltKCksXG5cdFx0XHRcdGNvbW1hbmQ6IHByb2dyZXNzQ29tbWFuZFxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKHRoaXMud2luZG93UHJvZ3Jlc3NTdGF0dXNFbnRyeSkge1xuXHRcdFx0XHR0aGlzLndpbmRvd1Byb2dyZXNzU3RhdHVzRW50cnkudXBkYXRlKHN0YXR1c0VudHJ5UHJvcGVydGllcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLndpbmRvd1Byb2dyZXNzU3RhdHVzRW50cnkgPSB0aGlzLnN0YXR1c2JhclNlcnZpY2UuYWRkRW50cnkoc3RhdHVzRW50cnlQcm9wZXJ0aWVzLCAnc3RhdHVzLnByb2dyZXNzJywgU3RhdHVzYmFyQWxpZ25tZW50LkxFRlQsIC1OdW1iZXIuTUFYX1ZBTFVFIC8qIGFsbW9zdCBsYXN0IGVudHJ5ICovKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBQcm9ncmVzcyBpcyBkb25lIHNvIHdlIHJlbW92ZSB0aGUgc3RhdHVzIGVudHJ5XG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLndpbmRvd1Byb2dyZXNzU3RhdHVzRW50cnk/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMud2luZG93UHJvZ3Jlc3NTdGF0dXNFbnRyeSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHdpdGhOb3RpZmljYXRpb25Qcm9ncmVzczxQIGV4dGVuZHMgUHJvbWlzZTxSPiwgUiA9IHVua25vd24+KG9wdGlvbnM6IElQcm9ncmVzc05vdGlmaWNhdGlvbk9wdGlvbnMsIGNhbGxiYWNrOiAocHJvZ3Jlc3M6IElQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPikgPT4gUCwgb25EaWRDYW5jZWw/OiAoY2hvaWNlPzogbnVtYmVyKSA9PiB2b2lkKTogUCB7XG5cblx0XHRjb25zdCBwcm9ncmVzc1N0YXRlTW9kZWwgPSBuZXcgY2xhc3MgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRcdFx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXBvcnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJUHJvZ3Jlc3NTdGVwPigpKTtcblx0XHRcdHJlYWRvbmx5IG9uRGlkUmVwb3J0ID0gdGhpcy5fb25EaWRSZXBvcnQuZXZlbnQ7XG5cblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbERpc3Bvc2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0XHRcdHJlYWRvbmx5IG9uV2lsbERpc3Bvc2UgPSB0aGlzLl9vbldpbGxEaXNwb3NlLmV2ZW50O1xuXG5cdFx0XHRwcml2YXRlIF9zdGVwOiBJUHJvZ3Jlc3NTdGVwIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0Z2V0IHN0ZXAoKSB7IHJldHVybiB0aGlzLl9zdGVwOyB9XG5cblx0XHRcdHByaXZhdGUgX2RvbmUgPSBmYWxzZTtcblx0XHRcdGdldCBkb25lKCkgeyByZXR1cm4gdGhpcy5fZG9uZTsgfVxuXG5cdFx0XHRyZWFkb25seSBwcm9taXNlOiBQO1xuXG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoKTtcblxuXHRcdFx0XHR0aGlzLnByb21pc2UgPSBjYWxsYmFjayh0aGlzKTtcblxuXHRcdFx0XHR0aGlzLnByb21pc2UuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXBvcnQoc3RlcDogSVByb2dyZXNzU3RlcCk6IHZvaWQge1xuXHRcdFx0XHR0aGlzLl9zdGVwID0gc3RlcDtcblxuXHRcdFx0XHR0aGlzLl9vbkRpZFJlcG9ydC5maXJlKHN0ZXApO1xuXHRcdFx0fVxuXG5cdFx0XHRjYW5jZWwoY2hvaWNlPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0XHRcdG9uRGlkQ2FuY2VsPy4oY2hvaWNlKTtcblxuXHRcdFx0XHR0aGlzLmRpc3Bvc2UoKTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRcdFx0dGhpcy5fZG9uZSA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX29uV2lsbERpc3Bvc2UuZmlyZSgpO1xuXG5cdFx0XHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgY3JlYXRlV2luZG93UHJvZ3Jlc3MgPSAoKSA9PiB7XG5cblx0XHRcdC8vIENyZWF0ZSBhIHByb21pc2UgdGhhdCB3ZSBjYW4gcmVzb2x2ZSBhcyBuZWVkZWRcblx0XHRcdC8vIHdoZW4gdGhlIG91dHNpZGUgY2FsbHMgZGlzcG9zZSBvbiB1c1xuXHRcdFx0Y29uc3QgcHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblxuXHRcdFx0dGhpcy53aXRoV2luZG93UHJvZ3Jlc3Moe1xuXHRcdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5XaW5kb3csXG5cdFx0XHRcdHRpdGxlOiBvcHRpb25zLnRpdGxlID8gcGFyc2VMaW5rZWRUZXh0KG9wdGlvbnMudGl0bGUpLnRvU3RyaW5nKCkgOiB1bmRlZmluZWQsIC8vIGNvbnZlcnQgbWFya2Rvd24gbGlua3MgPT4gc3RyaW5nXG5cdFx0XHRcdGNvbW1hbmQ6ICdub3RpZmljYXRpb25zLnNob3dMaXN0Jyxcblx0XHRcdFx0dHlwZTogb3B0aW9ucy50eXBlXG5cdFx0XHR9LCBwcm9ncmVzcyA9PiB7XG5cblx0XHRcdFx0ZnVuY3Rpb24gcmVwb3J0UHJvZ3Jlc3Moc3RlcDogSVByb2dyZXNzU3RlcCkge1xuXHRcdFx0XHRcdGlmIChzdGVwLm1lc3NhZ2UpIHtcblx0XHRcdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7XG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IHBhcnNlTGlua2VkVGV4dChzdGVwLm1lc3NhZ2UpLnRvU3RyaW5nKCkgIC8vIGNvbnZlcnQgbWFya2Rvd24gbGlua3MgPT4gc3RyaW5nXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBBcHBseSBhbnkgcHJvZ3Jlc3MgdGhhdCB3YXMgbWFkZSBhbHJlYWR5XG5cdFx0XHRcdGlmIChwcm9ncmVzc1N0YXRlTW9kZWwuc3RlcCkge1xuXHRcdFx0XHRcdHJlcG9ydFByb2dyZXNzKHByb2dyZXNzU3RhdGVNb2RlbC5zdGVwKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIENvbnRpbnVlIHRvIHJlcG9ydCBwcm9ncmVzcyBhcyBpdCBoYXBwZW5zXG5cdFx0XHRcdGNvbnN0IG9uRGlkUmVwb3J0TGlzdGVuZXIgPSBwcm9ncmVzc1N0YXRlTW9kZWwub25EaWRSZXBvcnQoc3RlcCA9PiByZXBvcnRQcm9ncmVzcyhzdGVwKSk7XG5cdFx0XHRcdHByb21pc2UucC5maW5hbGx5KCgpID0+IG9uRGlkUmVwb3J0TGlzdGVuZXIuZGlzcG9zZSgpKTtcblxuXHRcdFx0XHQvLyBXaGVuIHRoZSBwcm9ncmVzcyBtb2RlbCBnZXRzIGRpc3Bvc2VkLCB3ZSBhcmUgZG9uZSBhcyB3ZWxsXG5cdFx0XHRcdEV2ZW50Lm9uY2UocHJvZ3Jlc3NTdGF0ZU1vZGVsLm9uV2lsbERpc3Bvc2UpKCgpID0+IHByb21pc2UuY29tcGxldGUoKSk7XG5cblx0XHRcdFx0cmV0dXJuIHByb21pc2UucDtcblx0XHRcdH0pO1xuXG5cdFx0XHQvLyBEaXNwb3NlIG1lYW5zIGNvbXBsZXRpbmcgb3VyIHByb21pc2Vcblx0XHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4gcHJvbWlzZS5jb21wbGV0ZSgpKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgY3JlYXRlTm90aWZpY2F0aW9uID0gKG1lc3NhZ2U6IHN0cmluZywgcHJpb3JpdHk/OiBOb3RpZmljYXRpb25Qcmlvcml0eSwgaW5jcmVtZW50PzogbnVtYmVyKTogSU5vdGlmaWNhdGlvbkhhbmRsZSA9PiB7XG5cdFx0XHRjb25zdCBub3RpZmljYXRpb25EaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdFx0Y29uc3QgcHJpbWFyeUFjdGlvbnMgPSBvcHRpb25zLnByaW1hcnlBY3Rpb25zID8gQXJyYXkuZnJvbShvcHRpb25zLnByaW1hcnlBY3Rpb25zKSA6IFtdO1xuXHRcdFx0Y29uc3Qgc2Vjb25kYXJ5QWN0aW9ucyA9IG9wdGlvbnMuc2Vjb25kYXJ5QWN0aW9ucyA/IEFycmF5LmZyb20ob3B0aW9ucy5zZWNvbmRhcnlBY3Rpb25zKSA6IFtdO1xuXG5cdFx0XHRpZiAob3B0aW9ucy5idXR0b25zKSB7XG5cdFx0XHRcdG9wdGlvbnMuYnV0dG9ucy5mb3JFYWNoKChidXR0b24sIGluZGV4KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgYnV0dG9uQWN0aW9uID0gbmV3IGNsYXNzIGV4dGVuZHMgQWN0aW9uIHtcblx0XHRcdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdFx0XHRzdXBlcihgcHJvZ3Jlc3MuYnV0dG9uLiR7YnV0dG9ufWAsIGJ1dHRvbiwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRcdFx0XHRwcm9ncmVzc1N0YXRlTW9kZWwuY2FuY2VsKGluZGV4KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdG5vdGlmaWNhdGlvbkRpc3Bvc2FibGVzLmFkZChidXR0b25BY3Rpb24pO1xuXG5cdFx0XHRcdFx0cHJpbWFyeUFjdGlvbnMucHVzaChidXR0b25BY3Rpb24pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG9wdGlvbnMuY2FuY2VsbGFibGUpIHtcblx0XHRcdFx0Y29uc3QgY2FuY2VsQWN0aW9uID0gbmV3IGNsYXNzIGV4dGVuZHMgQWN0aW9uIHtcblx0XHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRcdHN1cGVyKCdwcm9ncmVzcy5jYW5jZWwnLCB0eXBlb2Ygb3B0aW9ucy5jYW5jZWxsYWJsZSA9PT0gJ3N0cmluZycgPyBvcHRpb25zLmNhbmNlbGxhYmxlIDogbG9jYWxpemUoJ2NhbmNlbCcsIFwiQ2FuY2VsXCIpLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0XHRcdHByb2dyZXNzU3RhdGVNb2RlbC5jYW5jZWwoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdG5vdGlmaWNhdGlvbkRpc3Bvc2FibGVzLmFkZChjYW5jZWxBY3Rpb24pO1xuXG5cdFx0XHRcdHByaW1hcnlBY3Rpb25zLnB1c2goY2FuY2VsQWN0aW9uKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uID0gdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRtZXNzYWdlOiBzdHJpcEljb25zKG1lc3NhZ2UpLCAvLyBzdGF0dXMgZW50cmllcyBzdXBwb3J0IGNvZGljb25zLCBidXQgbm90aWZpY2F0aW9ucyBkbyBub3QgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDU3MjIpXG5cdFx0XHRcdHNvdXJjZTogb3B0aW9ucy5zb3VyY2UsXG5cdFx0XHRcdGFjdGlvbnM6IHsgcHJpbWFyeTogcHJpbWFyeUFjdGlvbnMsIHNlY29uZGFyeTogc2Vjb25kYXJ5QWN0aW9ucyB9LFxuXHRcdFx0XHRwcm9ncmVzczogdHlwZW9mIGluY3JlbWVudCA9PT0gJ251bWJlcicgJiYgaW5jcmVtZW50ID49IDAgPyB7IHRvdGFsOiAxMDAsIHdvcmtlZDogaW5jcmVtZW50IH0gOiB7IGluZmluaXRlOiB0cnVlIH0sXG5cdFx0XHRcdHByaW9yaXR5XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gU3dpdGNoIHRvIHdpbmRvdyBiYXNlZCBwcm9ncmVzcyBvbmNlIHRoZSBub3RpZmljYXRpb25cblx0XHRcdC8vIGNoYW5nZXMgdmlzaWJpbGl0eSB0byBoaWRkZW4gYW5kIGlzIHN0aWxsIG9uZ29pbmcuXG5cdFx0XHQvLyBSZW1vdmUgdGhhdCB3aW5kb3cgYmFzZWQgcHJvZ3Jlc3Mgb25jZSB0aGUgbm90aWZpY2F0aW9uXG5cdFx0XHQvLyBzaG93cyBhZ2Fpbi5cblx0XHRcdGxldCB3aW5kb3dQcm9ncmVzc0Rpc3Bvc2FibGU6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgb25WaXNpYmlsaXR5Q2hhbmdlID0gKHZpc2libGU6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0Ly8gQ2xlYXIgYW55IHByZXZpb3VzIHJ1bm5pbmcgd2luZG93IHByb2dyZXNzXG5cdFx0XHRcdGRpc3Bvc2Uod2luZG93UHJvZ3Jlc3NEaXNwb3NhYmxlKTtcblxuXHRcdFx0XHQvLyBDcmVhdGUgbmV3IHdpbmRvdyBwcm9ncmVzcyBpZiBub3RpZmljYXRpb24gZ290IGhpZGRlblxuXHRcdFx0XHRpZiAoIXZpc2libGUgJiYgIXByb2dyZXNzU3RhdGVNb2RlbC5kb25lKSB7XG5cdFx0XHRcdFx0d2luZG93UHJvZ3Jlc3NEaXNwb3NhYmxlID0gY3JlYXRlV2luZG93UHJvZ3Jlc3MoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdG5vdGlmaWNhdGlvbkRpc3Bvc2FibGVzLmFkZChub3RpZmljYXRpb24ub25EaWRDaGFuZ2VWaXNpYmlsaXR5KG9uVmlzaWJpbGl0eUNoYW5nZSkpO1xuXHRcdFx0aWYgKHByaW9yaXR5ID09PSBOb3RpZmljYXRpb25Qcmlvcml0eS5TSUxFTlQpIHtcblx0XHRcdFx0b25WaXNpYmlsaXR5Q2hhbmdlKGZhbHNlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2xlYXIgdXBvbiBkaXNwb3NlXG5cdFx0XHRFdmVudC5vbmNlKG5vdGlmaWNhdGlvbi5vbkRpZENsb3NlKSgoKSA9PiB7XG5cdFx0XHRcdG5vdGlmaWNhdGlvbkRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdFx0ZGlzcG9zZSh3aW5kb3dQcm9ncmVzc0Rpc3Bvc2FibGUpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiBub3RpZmljYXRpb247XG5cdFx0fTtcblxuXHRcdGNvbnN0IHVwZGF0ZVByb2dyZXNzID0gKG5vdGlmaWNhdGlvbjogSU5vdGlmaWNhdGlvbkhhbmRsZSwgaW5jcmVtZW50PzogbnVtYmVyKTogdm9pZCA9PiB7XG5cdFx0XHRpZiAodHlwZW9mIGluY3JlbWVudCA9PT0gJ251bWJlcicgJiYgaW5jcmVtZW50ID49IDApIHtcblx0XHRcdFx0bm90aWZpY2F0aW9uLnByb2dyZXNzLnRvdGFsKDEwMCk7IC8vIGFsd2F5cyBwZXJjZW50YWdlIGJhc2VkXG5cdFx0XHRcdG5vdGlmaWNhdGlvbi5wcm9ncmVzcy53b3JrZWQoaW5jcmVtZW50KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5vdGlmaWNhdGlvbi5wcm9ncmVzcy5pbmZpbml0ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRsZXQgbm90aWZpY2F0aW9uSGFuZGxlOiBJTm90aWZpY2F0aW9uSGFuZGxlIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBub3RpZmljYXRpb25UaW1lb3V0OiBhbnkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHRpdGxlQW5kTWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkOyAvLyBob2lzdGVkIHRvIG1ha2Ugc3VyZSBhIGRlbGF5ZWQgbm90aWZpY2F0aW9uIHNob3dzIHRoZSBtb3N0IHJlY2VudCBtZXNzYWdlXG5cblx0XHRjb25zdCB1cGRhdGVOb3RpZmljYXRpb24gPSAoc3RlcD86IElQcm9ncmVzc1N0ZXApOiB2b2lkID0+IHtcblxuXHRcdFx0Ly8gZnVsbCBtZXNzYWdlIChpbml0YWwgb3IgdXBkYXRlKVxuXHRcdFx0aWYgKHN0ZXA/Lm1lc3NhZ2UgJiYgb3B0aW9ucy50aXRsZSkge1xuXHRcdFx0XHR0aXRsZUFuZE1lc3NhZ2UgPSBgJHtvcHRpb25zLnRpdGxlfTogJHtzdGVwLm1lc3NhZ2V9YDsgLy8gYWx3YXlzIHByZWZpeCB3aXRoIG92ZXJhbGwgdGl0bGUgaWYgd2UgaGF2ZSBpdCAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzUwOTMyKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGl0bGVBbmRNZXNzYWdlID0gb3B0aW9ucy50aXRsZSB8fCBzdGVwPy5tZXNzYWdlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIW5vdGlmaWNhdGlvbkhhbmRsZSAmJiB0aXRsZUFuZE1lc3NhZ2UpIHtcblxuXHRcdFx0XHQvLyBjcmVhdGUgbm90aWZpY2F0aW9uIG5vdyBvciBhZnRlciBhIGRlbGF5XG5cdFx0XHRcdGlmICh0eXBlb2Ygb3B0aW9ucy5kZWxheSA9PT0gJ251bWJlcicgJiYgb3B0aW9ucy5kZWxheSA+IDApIHtcblx0XHRcdFx0XHRpZiAodHlwZW9mIG5vdGlmaWNhdGlvblRpbWVvdXQgIT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRub3RpZmljYXRpb25UaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiBub3RpZmljYXRpb25IYW5kbGUgPSBjcmVhdGVOb3RpZmljYXRpb24odGl0bGVBbmRNZXNzYWdlISwgb3B0aW9ucy5wcmlvcml0eSwgc3RlcD8uaW5jcmVtZW50KSwgb3B0aW9ucy5kZWxheSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5vdGlmaWNhdGlvbkhhbmRsZSA9IGNyZWF0ZU5vdGlmaWNhdGlvbih0aXRsZUFuZE1lc3NhZ2UsIG9wdGlvbnMucHJpb3JpdHksIHN0ZXA/LmluY3JlbWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKG5vdGlmaWNhdGlvbkhhbmRsZSkge1xuXHRcdFx0XHRpZiAodGl0bGVBbmRNZXNzYWdlKSB7XG5cdFx0XHRcdFx0bm90aWZpY2F0aW9uSGFuZGxlLnVwZGF0ZU1lc3NhZ2UodGl0bGVBbmRNZXNzYWdlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0eXBlb2Ygc3RlcD8uaW5jcmVtZW50ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdHVwZGF0ZVByb2dyZXNzKG5vdGlmaWNhdGlvbkhhbmRsZSwgc3RlcC5pbmNyZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIFNob3cgaW5pdGlhbGx5XG5cdFx0dXBkYXRlTm90aWZpY2F0aW9uKHByb2dyZXNzU3RhdGVNb2RlbC5zdGVwKTtcblx0XHRjb25zdCBsaXN0ZW5lciA9IHByb2dyZXNzU3RhdGVNb2RlbC5vbkRpZFJlcG9ydChzdGVwID0+IHVwZGF0ZU5vdGlmaWNhdGlvbihzdGVwKSk7XG5cdFx0RXZlbnQub25jZShwcm9ncmVzc1N0YXRlTW9kZWwub25XaWxsRGlzcG9zZSkoKCkgPT4gbGlzdGVuZXIuZGlzcG9zZSgpKTtcblxuXHRcdC8vIENsZWFuIHVwIGV2ZW50dWFsbHlcblx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblxuXHRcdFx0XHQvLyB3aXRoIGEgZGVsYXkgd2Ugb25seSB3YWl0IGZvciB0aGUgZmluaXNoIG9mIHRoZSBwcm9taXNlXG5cdFx0XHRcdGlmICh0eXBlb2Ygb3B0aW9ucy5kZWxheSA9PT0gJ251bWJlcicgJiYgb3B0aW9ucy5kZWxheSA+IDApIHtcblx0XHRcdFx0XHRhd2FpdCBwcm9ncmVzc1N0YXRlTW9kZWwucHJvbWlzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIHdpdGhvdXQgYSBkZWxheSB3ZSBzaG93IHRoZSBub3RpZmljYXRpb24gZm9yIGF0IGxlYXN0IDgwMG1zXG5cdFx0XHRcdC8vIHRvIHJlZHVjZSB0aGUgY2hhbmNlIG9mIHRoZSBub3RpZmljYXRpb24gZmxhc2hpbmcgdXAgYW5kIGhpZGluZ1xuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbdGltZW91dCg4MDApLCBwcm9ncmVzc1N0YXRlTW9kZWwucHJvbWlzZV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQobm90aWZpY2F0aW9uVGltZW91dCk7XG5cdFx0XHRcdG5vdGlmaWNhdGlvbkhhbmRsZT8uY2xvc2UoKTtcblx0XHRcdH1cblx0XHR9KSgpO1xuXG5cdFx0cmV0dXJuIHByb2dyZXNzU3RhdGVNb2RlbC5wcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSB3aXRoUGFuZUNvbXBvc2l0ZVByb2dyZXNzPFAgZXh0ZW5kcyBQcm9taXNlPFI+LCBSID0gdW5rbm93bj4ocGFuZUNvbXBvc2l0ZUlkOiBzdHJpbmcsIHZpZXdDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uLCB0YXNrOiAocHJvZ3Jlc3M6IElQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPikgPT4gUCwgb3B0aW9uczogSVByb2dyZXNzQ29tcG9zaXRlT3B0aW9ucyk6IFAge1xuXG5cdFx0Ly8gc2hvdyBpbiB2aWV3bGV0XG5cdFx0Y29uc3QgcHJvZ3Jlc3NJbmRpY2F0b3IgPSB0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLmdldFByb2dyZXNzSW5kaWNhdG9yKHBhbmVDb21wb3NpdGVJZCwgdmlld0NvbnRhaW5lckxvY2F0aW9uKTtcblx0XHRjb25zdCBwcm9taXNlID0gcHJvZ3Jlc3NJbmRpY2F0b3IgPyB0aGlzLndpdGhDb21wb3NpdGVQcm9ncmVzcyhwcm9ncmVzc0luZGljYXRvciwgdGFzaywgb3B0aW9ucykgOiB0YXNrKHsgcmVwb3J0OiAoKSA9PiB7IH0gfSk7XG5cblx0XHQvLyBzaG93IG9uIGFjdGl2aXR5IGJhclxuXHRcdGlmICh2aWV3Q29udGFpbmVyTG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKSB7XG5cdFx0XHR0aGlzLnNob3dPbkFjdGl2aXR5QmFyPFAsIFI+KHBhbmVDb21wb3NpdGVJZCwgb3B0aW9ucywgcHJvbWlzZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByb21pc2U7XG5cdH1cblxuXHRwcml2YXRlIHdpdGhWaWV3UHJvZ3Jlc3M8UCBleHRlbmRzIFByb21pc2U8Uj4sIFIgPSB1bmtub3duPih2aWV3SWQ6IHN0cmluZywgdGFzazogKHByb2dyZXNzOiBJUHJvZ3Jlc3M8SVByb2dyZXNzU3RlcD4pID0+IFAsIG9wdGlvbnM6IElQcm9ncmVzc0NvbXBvc2l0ZU9wdGlvbnMpOiBQIHtcblxuXHRcdC8vIHNob3cgaW4gdmlld2xldFxuXHRcdGNvbnN0IHByb2dyZXNzSW5kaWNhdG9yID0gdGhpcy52aWV3c1NlcnZpY2UuZ2V0Vmlld1Byb2dyZXNzSW5kaWNhdG9yKHZpZXdJZCk7XG5cdFx0Y29uc3QgcHJvbWlzZSA9IHByb2dyZXNzSW5kaWNhdG9yID8gdGhpcy53aXRoQ29tcG9zaXRlUHJvZ3Jlc3MocHJvZ3Jlc3NJbmRpY2F0b3IsIHRhc2ssIG9wdGlvbnMpIDogdGFzayh7IHJlcG9ydDogKCkgPT4geyB9IH0pO1xuXG5cdFx0Y29uc3Qgdmlld2xldElkID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHZpZXdJZCk/LmlkO1xuXHRcdGlmICh2aWV3bGV0SWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHByb21pc2U7XG5cdFx0fVxuXG5cdFx0Ly8gc2hvdyBvbiBhY3Rpdml0eSBiYXJcblx0XHR0aGlzLnNob3dPbkFjdGl2aXR5QmFyKHZpZXdsZXRJZCwgb3B0aW9ucywgcHJvbWlzZSk7XG5cblx0XHRyZXR1cm4gcHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgc2hvd09uQWN0aXZpdHlCYXI8UCBleHRlbmRzIFByb21pc2U8Uj4sIFIgPSB1bmtub3duPih2aWV3bGV0SWQ6IHN0cmluZywgb3B0aW9uczogSVByb2dyZXNzQ29tcG9zaXRlT3B0aW9ucywgcHJvbWlzZTogUCk6IHZvaWQge1xuXHRcdGxldCBhY3Rpdml0eVByb2dyZXNzOiBJRGlzcG9zYWJsZTtcblx0XHRsZXQgZGVsYXlIYW5kbGU6IGFueSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0ZGVsYXlIYW5kbGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLmFjdGl2aXR5U2VydmljZS5zaG93Vmlld0NvbnRhaW5lckFjdGl2aXR5KHZpZXdsZXRJZCwgeyBiYWRnZTogbmV3IFByb2dyZXNzQmFkZ2UoKCkgPT4gJycpIH0pO1xuXHRcdFx0Y29uc3Qgc3RhcnRUaW1lVmlzaWJsZSA9IERhdGUubm93KCk7XG5cdFx0XHRjb25zdCBtaW5UaW1lVmlzaWJsZSA9IDMwMDtcblx0XHRcdGFjdGl2aXR5UHJvZ3Jlc3MgPSB7XG5cdFx0XHRcdGRpc3Bvc2UoKSB7XG5cdFx0XHRcdFx0Y29uc3QgZCA9IERhdGUubm93KCkgLSBzdGFydFRpbWVWaXNpYmxlO1xuXHRcdFx0XHRcdGlmIChkIDwgbWluVGltZVZpc2libGUpIHtcblx0XHRcdFx0XHRcdC8vIHNob3VsZCBhdCBsZWFzdCBzaG93IGZvciBObXNcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gaGFuZGxlLmRpc3Bvc2UoKSwgbWluVGltZVZpc2libGUgLSBkKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gc2hvd24gbG9uZyBlbm91Z2hcblx0XHRcdFx0XHRcdGhhbmRsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH0sIG9wdGlvbnMuZGVsYXkgfHwgMzAwKTtcblx0XHRwcm9taXNlLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KGRlbGF5SGFuZGxlKTtcblx0XHRcdGRpc3Bvc2UoYWN0aXZpdHlQcm9ncmVzcyk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHdpdGhDb21wb3NpdGVQcm9ncmVzczxQIGV4dGVuZHMgUHJvbWlzZTxSPiwgUiA9IHVua25vd24+KHByb2dyZXNzSW5kaWNhdG9yOiBJUHJvZ3Jlc3NJbmRpY2F0b3IsIHRhc2s6IChwcm9ncmVzczogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+KSA9PiBQLCBvcHRpb25zOiBJUHJvZ3Jlc3NDb21wb3NpdGVPcHRpb25zKTogUCB7XG5cdFx0bGV0IGRpc2NyZXRlUHJvZ3Jlc3NSdW5uZXI6IElQcm9ncmVzc1J1bm5lciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGZ1bmN0aW9uIHVwZGF0ZVByb2dyZXNzKHN0ZXBPclRvdGFsOiBJUHJvZ3Jlc3NTdGVwIHwgbnVtYmVyIHwgdW5kZWZpbmVkKTogSVByb2dyZXNzUnVubmVyIHwgdW5kZWZpbmVkIHtcblxuXHRcdFx0Ly8gRmlndXJlIG91dCB3aGV0aGVyIGRpc2NyZXRlIHByb2dyZXNzIGFwcGxpZXNcblx0XHRcdC8vIGJ5IGZpZ3VyaW5nIG91dCB0aGUgXCJ0b3RhbFwiIHByb2dyZXNzIHRvIHNob3dcblx0XHRcdC8vIGFuZCB0aGUgaW5jcmVtZW50IGlmIGFueS5cblx0XHRcdGxldCB0b3RhbDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGluY3JlbWVudDogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHR5cGVvZiBzdGVwT3JUb3RhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBzdGVwT3JUb3RhbCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHR0b3RhbCA9IHN0ZXBPclRvdGFsO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiBzdGVwT3JUb3RhbC5pbmNyZW1lbnQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0dG90YWwgPSBzdGVwT3JUb3RhbC50b3RhbCA/PyAxMDA7IC8vIGFsd2F5cyBwZXJjZW50YWdlIGJhc2VkXG5cdFx0XHRcdFx0aW5jcmVtZW50ID0gc3RlcE9yVG90YWwuaW5jcmVtZW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIERpc2NyZXRlXG5cdFx0XHRpZiAodHlwZW9mIHRvdGFsID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRpZiAoIWRpc2NyZXRlUHJvZ3Jlc3NSdW5uZXIpIHtcblx0XHRcdFx0XHRkaXNjcmV0ZVByb2dyZXNzUnVubmVyID0gcHJvZ3Jlc3NJbmRpY2F0b3Iuc2hvdyh0b3RhbCwgb3B0aW9ucy5kZWxheSk7XG5cdFx0XHRcdFx0cHJvbWlzZS5jYXRjaCgoKSA9PiB1bmRlZmluZWQgLyogaWdub3JlICovKS5maW5hbGx5KCgpID0+IGRpc2NyZXRlUHJvZ3Jlc3NSdW5uZXI/LmRvbmUoKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodHlwZW9mIGluY3JlbWVudCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRkaXNjcmV0ZVByb2dyZXNzUnVubmVyLndvcmtlZChpbmNyZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluZmluaXRlXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0ZGlzY3JldGVQcm9ncmVzc1J1bm5lcj8uZG9uZSgpO1xuXHRcdFx0XHRwcm9ncmVzc0luZGljYXRvci5zaG93V2hpbGUocHJvbWlzZSwgb3B0aW9ucy5kZWxheSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBkaXNjcmV0ZVByb2dyZXNzUnVubmVyO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb21pc2UgPSB0YXNrKHtcblx0XHRcdHJlcG9ydDogcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0XHR1cGRhdGVQcm9ncmVzcyhwcm9ncmVzcyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR1cGRhdGVQcm9ncmVzcyhvcHRpb25zLnRvdGFsKTtcblxuXHRcdHJldHVybiBwcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSB3aXRoRGlhbG9nUHJvZ3Jlc3M8UCBleHRlbmRzIFByb21pc2U8Uj4sIFIgPSB1bmtub3duPihvcHRpb25zOiBJUHJvZ3Jlc3NEaWFsb2dPcHRpb25zLCB0YXNrOiAocHJvZ3Jlc3M6IElQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPikgPT4gUCwgb25EaWRDYW5jZWw/OiAoY2hvaWNlPzogbnVtYmVyKSA9PiB2b2lkKTogUCB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRsZXQgZGlhbG9nOiBEaWFsb2c7XG5cdFx0bGV0IHRhc2tDb21wbGV0ZWQgPSBmYWxzZTtcblxuXHRcdGNvbnN0IGNyZWF0ZURpYWxvZyA9IChtZXNzYWdlOiBzdHJpbmcpID0+IHtcblx0XHRcdGNvbnN0IGJ1dHRvbnMgPSBvcHRpb25zLmJ1dHRvbnMgfHwgW107XG5cdFx0XHRpZiAoIW9wdGlvbnMuc3RpY2t5KSB7XG5cdFx0XHRcdGJ1dHRvbnMucHVzaChvcHRpb25zLmNhbmNlbGxhYmxlXG5cdFx0XHRcdFx0PyAodHlwZW9mIG9wdGlvbnMuY2FuY2VsbGFibGUgPT09ICdib29sZWFuJyA/IGxvY2FsaXplKCdjYW5jZWwnLCBcIkNhbmNlbFwiKSA6IG9wdGlvbnMuY2FuY2VsbGFibGUpXG5cdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGlzbWlzcycsIFwiRGlzbWlzc1wiKVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRkaWFsb2cgPSBuZXcgRGlhbG9nKFxuXHRcdFx0XHR0aGlzLmxheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyLFxuXHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHRidXR0b25zLFxuXHRcdFx0XHRjcmVhdGVXb3JrYmVuY2hEaWFsb2dPcHRpb25zKHtcblx0XHRcdFx0XHR0eXBlOiAncGVuZGluZycsXG5cdFx0XHRcdFx0ZGV0YWlsOiBvcHRpb25zLmRldGFpbCxcblx0XHRcdFx0XHRjYW5jZWxJZDogYnV0dG9ucy5sZW5ndGggLSAxLFxuXHRcdFx0XHRcdGRpc2FibGVDbG9zZUFjdGlvbjogb3B0aW9ucy5zdGlja3ksXG5cdFx0XHRcdFx0ZGlzYWJsZURlZmF1bHRBY3Rpb246IG9wdGlvbnMuc3RpY2t5XG5cdFx0XHRcdH0sIHRoaXMua2V5YmluZGluZ1NlcnZpY2UsIHRoaXMubGF5b3V0U2VydmljZSlcblx0XHRcdCk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChkaWFsb2cpO1xuXG5cdFx0XHRkaWFsb2cuc2hvdygpLnRoZW4oZGlhbG9nUmVzdWx0ID0+IHtcblx0XHRcdFx0aWYgKCF0YXNrQ29tcGxldGVkKSB7XG5cdFx0XHRcdFx0b25EaWRDYW5jZWw/LihkaWFsb2dSZXN1bHQuYnV0dG9uKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkaXNwb3NlKGRpYWxvZyk7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIGRpYWxvZztcblx0XHR9O1xuXG5cdFx0Ly8gSW4gb3JkZXIgdG8gc3VwcG9ydCB0aGUgYGRlbGF5YCBvcHRpb24sIHdlIHVzZSBhIHNjaGVkdWxlclxuXHRcdC8vIHRoYXQgd2lsbCBndWFyZCBlYWNoIGFjY2VzcyB0byB0aGUgZGlhbG9nIGJlaGluZCBhIGRlbGF5XG5cdFx0Ly8gdGhhdCBpcyBlaXRoZXIgdGhlIG9yaWdpbmFsIGRlbGF5IGZvciBvbmUgaW52b2NhdGlvbiBhbmRcblx0XHQvLyBvdGhlcndpc2UgcnVucyB3aXRob3V0IGRlbGF5LlxuXHRcdGxldCBkZWxheSA9IG9wdGlvbnMuZGVsYXkgPz8gMDtcblx0XHRsZXQgbGF0ZXN0TWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHNjaGVkdWxlciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHRkZWxheSA9IDA7IC8vIHNpbmNlIHdlIGhhdmUgcnVuIG9uY2UsIHdlIHJlc2V0IHRoZSBkZWxheVxuXG5cdFx0XHRpZiAobGF0ZXN0TWVzc2FnZSAmJiAhZGlhbG9nKSB7XG5cdFx0XHRcdGRpYWxvZyA9IGNyZWF0ZURpYWxvZyhsYXRlc3RNZXNzYWdlKTtcblx0XHRcdH0gZWxzZSBpZiAobGF0ZXN0TWVzc2FnZSkge1xuXHRcdFx0XHRkaWFsb2cudXBkYXRlTWVzc2FnZShsYXRlc3RNZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9LCAwKSk7XG5cblx0XHRjb25zdCB1cGRhdGVEaWFsb2cgPSBmdW5jdGlvbiAobWVzc2FnZT86IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0bGF0ZXN0TWVzc2FnZSA9IG1lc3NhZ2U7XG5cblx0XHRcdC8vIE1ha2Ugc3VyZSB0byBvbmx5IHJ1biBvbmUgZGlhbG9nIHVwZGF0ZSBhbmQgbm90IG11bHRpcGxlXG5cdFx0XHRpZiAoIXNjaGVkdWxlci5pc1NjaGVkdWxlZCgpKSB7XG5cdFx0XHRcdHNjaGVkdWxlci5zY2hlZHVsZShkZWxheSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHByb21pc2UgPSB0YXNrKHtcblx0XHRcdHJlcG9ydDogcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0XHR1cGRhdGVEaWFsb2cocHJvZ3Jlc3MubWVzc2FnZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRwcm9taXNlLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0dGFza0NvbXBsZXRlZCA9IHRydWU7XG5cdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGVzKTtcblx0XHR9KTtcblxuXHRcdGlmIChvcHRpb25zLnRpdGxlKSB7XG5cdFx0XHR1cGRhdGVEaWFsb2cob3B0aW9ucy50aXRsZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByb21pc2U7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQXNCLFNBQVMsaUJBQWlCLFlBQVksb0JBQW9CO0FBQ2hGLFNBQVMsa0JBQW1ELGtCQUE2QixnQkFBOEo7QUFDdlAsU0FBUyxvQkFBb0IseUJBQW1FO0FBQ2hHLFNBQVMsaUJBQWlCLGtCQUFrQixlQUFlO0FBQzNELFNBQVMsZUFBZSx3QkFBd0I7QUFDaEQsU0FBUyxzQkFBc0IsVUFBK0Isc0JBQXNCLHNCQUFzQiwyQkFBMkI7QUFDckksU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGNBQWM7QUFDdkIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx3QkFBd0IsNkJBQTZCO0FBQzlELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsb0NBQW9DO0FBRXRDLElBQU0sa0JBQU4sY0FBOEIsV0FBdUM7QUFBQSxFQUkzRSxZQUNvQyxpQkFDUyxzQkFDSCx1QkFDVCxjQUNPLHFCQUNILGtCQUNILGVBQ0ks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
