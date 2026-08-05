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
import { getClientArea, getTopLeftOffset, isHTMLDivElement, isHTMLTextAreaElement } from "../../../../base/browser/dom.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { language, locale } from "../../../../base/common/platform.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import localizedStrings from "../../../../platform/languagePacks/common/localizedStrings.js";
import { getLogs } from "../../../../platform/log/browser/log.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
let BrowserWindowDriver = class {
  constructor(fileService, environmentService, lifecycleService, logService) {
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.lifecycleService = lifecycleService;
    this.logService = logService;
  }
  async getLogs() {
    return getLogs(this.fileService, this.environmentService);
  }
  async whenWorkbenchRestored() {
    this.logService.info("[driver] Waiting for restored lifecycle phase...");
    await this.lifecycleService.when(LifecyclePhase.Restored);
    this.logService.info("[driver] Restored lifecycle phase reached. Waiting for contributions...");
    await Registry.as(WorkbenchExtensions.Workbench).whenRestored;
    this.logService.info("[driver] Workbench contributions created.");
  }
  async setValue(selector, text) {
    const element = mainWindow.document.querySelector(selector);
    if (!element) {
      return Promise.reject(new Error(`Element not found: ${selector}`));
    }
    const inputElement = element;
    inputElement.value = text;
    const event = new Event("input", { bubbles: true, cancelable: true });
    inputElement.dispatchEvent(event);
  }
  async isActiveElement(selector) {
    const element = mainWindow.document.querySelector(selector);
    if (element !== mainWindow.document.activeElement) {
      const chain = [];
      let el = mainWindow.document.activeElement;
      while (el) {
        const tagName = el.tagName;
        const id = el.id ? `#${el.id}` : "";
        const classes = coalesce(el.className.split(/\s+/g).map((c) => c.trim())).map((c) => `.${c}`).join("");
        chain.unshift(`${tagName}${id}${classes}`);
        el = el.parentElement;
      }
      throw new Error(`Active element not found. Current active element is '${chain.join(" > ")}'. Looking for ${selector}`);
    }
    return true;
  }
  async getElements(selector, recursive) {
    const query = mainWindow.document.querySelectorAll(selector);
    const result = [];
    for (let i = 0; i < query.length; i++) {
      const element = query.item(i);
      result.push(this.serializeElement(element, recursive));
    }
    return result;
  }
  serializeElement(element, recursive) {
    const attributes = /* @__PURE__ */ Object.create(null);
    for (let j = 0; j < element.attributes.length; j++) {
      const attr = element.attributes.item(j);
      if (attr) {
        attributes[attr.name] = attr.value;
      }
    }
    const children = [];
    if (recursive) {
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children.item(i);
        if (child) {
          children.push(this.serializeElement(child, true));
        }
      }
    }
    const { left, top } = getTopLeftOffset(element);
    return {
      tagName: element.tagName,
      className: element.className,
      textContent: element.textContent || "",
      attributes,
      children,
      left,
      top
    };
  }
  async getElementXY(selector, xoffset, yoffset) {
    const offset = typeof xoffset === "number" && typeof yoffset === "number" ? { x: xoffset, y: yoffset } : void 0;
    return this._getElementXY(selector, offset);
  }
  async typeInEditor(selector, text) {
    const element = mainWindow.document.querySelector(selector);
    if (!element) {
      throw new Error(`Editor not found: ${selector}`);
    }
    if (isHTMLDivElement(element)) {
      const editContext = element.editContext;
      if (!editContext) {
        throw new Error(`Edit context not found: ${selector}`);
      }
      const selectionStart = editContext.selectionStart;
      const selectionEnd = editContext.selectionEnd;
      const event = new TextUpdateEvent("textupdate", {
        updateRangeStart: selectionStart,
        updateRangeEnd: selectionEnd,
        text,
        selectionStart: selectionStart + text.length,
        selectionEnd: selectionStart + text.length,
        compositionStart: 0,
        compositionEnd: 0
      });
      editContext.dispatchEvent(event);
    } else if (isHTMLTextAreaElement(element)) {
      const start = element.selectionStart;
      const newStart = start + text.length;
      const value = element.value;
      const newValue = value.substr(0, start) + text + value.substr(start);
      element.value = newValue;
      element.setSelectionRange(newStart, newStart);
      const event = new Event("input", { "bubbles": true, "cancelable": true });
      element.dispatchEvent(event);
    }
  }
  async getEditorSelection(selector) {
    const element = mainWindow.document.querySelector(selector);
    if (!element) {
      throw new Error(`Editor not found: ${selector}`);
    }
    if (isHTMLDivElement(element)) {
      const editContext = element.editContext;
      if (!editContext) {
        throw new Error(`Edit context not found: ${selector}`);
      }
      return { selectionStart: editContext.selectionStart, selectionEnd: editContext.selectionEnd };
    } else if (isHTMLTextAreaElement(element)) {
      return { selectionStart: element.selectionStart, selectionEnd: element.selectionEnd };
    } else {
      throw new Error(`Unknown type of element: ${selector}`);
    }
  }
  async getTerminalBuffer(selector) {
    const element = mainWindow.document.querySelector(selector);
    if (!element) {
      throw new Error(`Terminal not found: ${selector}`);
    }
    const xterm = element.xterm;
    if (!xterm) {
      throw new Error(`Xterm not found: ${selector}`);
    }
    const lines = [];
    for (let i = 0; i < xterm.buffer.active.length; i++) {
      lines.push(xterm.buffer.active.getLine(i).translateToString(true));
    }
    return lines;
  }
  async writeInTerminal(selector, text) {
    const element = mainWindow.document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    const xterm = element.xterm;
    if (!xterm) {
      throw new Error(`Xterm not found: ${selector}`);
    }
    xterm.input(text);
  }
  getLocaleInfo() {
    return Promise.resolve({
      language,
      locale
    });
  }
  getLocalizedStrings() {
    return Promise.resolve({
      open: localizedStrings.open,
      close: localizedStrings.close,
      find: localizedStrings.find
    });
  }
  async _getElementXY(selector, offset) {
    const element = mainWindow.document.querySelector(selector);
    if (!element) {
      return Promise.reject(new Error(`Element not found: ${selector}`));
    }
    const { left, top } = getTopLeftOffset(element);
    const { width, height } = getClientArea(element);
    let x, y;
    if (offset) {
      x = left + offset.x;
      y = top + offset.y;
    } else {
      x = left + width / 2;
      y = top + height / 2;
    }
    x = Math.round(x);
    y = Math.round(y);
    return { x, y };
  }
  async exitApplication() {
  }
};
BrowserWindowDriver = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IEnvironmentService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, ILogService)
], BrowserWindowDriver);
function registerWindowDriver(instantiationService) {
  Object.assign(mainWindow, { driver: instantiationService.createInstance(BrowserWindowDriver) });
}
export {
  BrowserWindowDriver,
  registerWindowDriver
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZHJpdmVyL2Jyb3dzZXIvZHJpdmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZ2V0Q2xpZW50QXJlYSwgZ2V0VG9wTGVmdE9mZnNldCwgaXNIVE1MRGl2RWxlbWVudCwgaXNIVE1MVGV4dEFyZWFFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBsYW5ndWFnZSwgbG9jYWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgbG9jYWxpemVkU3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYW5ndWFnZVBhY2tzL2NvbW1vbi9sb2NhbGl6ZWRTdHJpbmdzLmpzJztcbmltcG9ydCB7IElMb2dGaWxlLCBnZXRMb2dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2Jyb3dzZXIvbG9nLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSVdpbmRvd0RyaXZlciwgSUVsZW1lbnQsIElMb2NhbGVJbmZvLCBJTG9jYWxpemVkU3RyaW5ncyB9IGZyb20gJy4uL2NvbW1vbi9kcml2ZXIuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHR5cGUgeyBUZXJtaW5hbCBhcyBYdGVybVRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcblxuZXhwb3J0IGNsYXNzIEJyb3dzZXJXaW5kb3dEcml2ZXIgaW1wbGVtZW50cyBJV2luZG93RHJpdmVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0fVxuXG5cdGFzeW5jIGdldExvZ3MoKTogUHJvbWlzZTxJTG9nRmlsZVtdPiB7XG5cdFx0cmV0dXJuIGdldExvZ3ModGhpcy5maWxlU2VydmljZSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UpO1xuXHR9XG5cblx0YXN5bmMgd2hlbldvcmtiZW5jaFJlc3RvcmVkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbZHJpdmVyXSBXYWl0aW5nIGZvciByZXN0b3JlZCBsaWZlY3ljbGUgcGhhc2UuLi4nKTtcblx0XHRhd2FpdCB0aGlzLmxpZmVjeWNsZVNlcnZpY2Uud2hlbihMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1tkcml2ZXJdIFJlc3RvcmVkIGxpZmVjeWNsZSBwaGFzZSByZWFjaGVkLiBXYWl0aW5nIGZvciBjb250cmlidXRpb25zLi4uJyk7XG5cdFx0YXdhaXQgUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLndoZW5SZXN0b3JlZDtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnW2RyaXZlcl0gV29ya2JlbmNoIGNvbnRyaWJ1dGlvbnMgY3JlYXRlZC4nKTtcblx0fVxuXG5cdGFzeW5jIHNldFZhbHVlKHNlbGVjdG9yOiBzdHJpbmcsIHRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBtYWluV2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG5cdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGBFbGVtZW50IG5vdCBmb3VuZDogJHtzZWxlY3Rvcn1gKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXRFbGVtZW50ID0gZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50O1xuXHRcdGlucHV0RWxlbWVudC52YWx1ZSA9IHRleHQ7XG5cblx0XHRjb25zdCBldmVudCA9IG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUsIGNhbmNlbGFibGU6IHRydWUgfSk7XG5cdFx0aW5wdXRFbGVtZW50LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0YXN5bmMgaXNBY3RpdmVFbGVtZW50KHNlbGVjdG9yOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBlbGVtZW50ID0gbWFpbldpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuXHRcdGlmIChlbGVtZW50ICE9PSBtYWluV2luZG93LmRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpIHtcblx0XHRcdGNvbnN0IGNoYWluOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0bGV0IGVsID0gbWFpbldpbmRvdy5kb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXG5cdFx0XHR3aGlsZSAoZWwpIHtcblx0XHRcdFx0Y29uc3QgdGFnTmFtZSA9IGVsLnRhZ05hbWU7XG5cdFx0XHRcdGNvbnN0IGlkID0gZWwuaWQgPyBgIyR7ZWwuaWR9YCA6ICcnO1xuXHRcdFx0XHRjb25zdCBjbGFzc2VzID0gY29hbGVzY2UoZWwuY2xhc3NOYW1lLnNwbGl0KC9cXHMrL2cpLm1hcChjID0+IGMudHJpbSgpKSkubWFwKGMgPT4gYC4ke2N9YCkuam9pbignJyk7XG5cdFx0XHRcdGNoYWluLnVuc2hpZnQoYCR7dGFnTmFtZX0ke2lkfSR7Y2xhc3Nlc31gKTtcblxuXHRcdFx0XHRlbCA9IGVsLnBhcmVudEVsZW1lbnQ7XG5cdFx0XHR9XG5cblx0XHRcdHRocm93IG5ldyBFcnJvcihgQWN0aXZlIGVsZW1lbnQgbm90IGZvdW5kLiBDdXJyZW50IGFjdGl2ZSBlbGVtZW50IGlzICcke2NoYWluLmpvaW4oJyA+ICcpfScuIExvb2tpbmcgZm9yICR7c2VsZWN0b3J9YCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRhc3luYyBnZXRFbGVtZW50cyhzZWxlY3Rvcjogc3RyaW5nLCByZWN1cnNpdmU6IGJvb2xlYW4pOiBQcm9taXNlPElFbGVtZW50W10+IHtcblx0XHRjb25zdCBxdWVyeSA9IG1haW5XaW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG5cdFx0Y29uc3QgcmVzdWx0OiBJRWxlbWVudFtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBxdWVyeS5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IHF1ZXJ5Lml0ZW0oaSk7XG5cdFx0XHRyZXN1bHQucHVzaCh0aGlzLnNlcmlhbGl6ZUVsZW1lbnQoZWxlbWVudCwgcmVjdXJzaXZlKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc2VyaWFsaXplRWxlbWVudChlbGVtZW50OiBFbGVtZW50LCByZWN1cnNpdmU6IGJvb2xlYW4pOiBJRWxlbWVudCB7XG5cdFx0Y29uc3QgYXR0cmlidXRlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0XHRmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1lbnQuYXR0cmlidXRlcy5sZW5ndGg7IGorKykge1xuXHRcdFx0Y29uc3QgYXR0ciA9IGVsZW1lbnQuYXR0cmlidXRlcy5pdGVtKGopO1xuXHRcdFx0aWYgKGF0dHIpIHtcblx0XHRcdFx0YXR0cmlidXRlc1thdHRyLm5hbWVdID0gYXR0ci52YWx1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjaGlsZHJlbjogSUVsZW1lbnRbXSA9IFtdO1xuXG5cdFx0aWYgKHJlY3Vyc2l2ZSkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50LmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNoaWxkID0gZWxlbWVudC5jaGlsZHJlbi5pdGVtKGkpO1xuXHRcdFx0XHRpZiAoY2hpbGQpIHtcblx0XHRcdFx0XHRjaGlsZHJlbi5wdXNoKHRoaXMuc2VyaWFsaXplRWxlbWVudChjaGlsZCwgdHJ1ZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBsZWZ0LCB0b3AgfSA9IGdldFRvcExlZnRPZmZzZXQoZWxlbWVudCBhcyBIVE1MRWxlbWVudCk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dGFnTmFtZTogZWxlbWVudC50YWdOYW1lLFxuXHRcdFx0Y2xhc3NOYW1lOiBlbGVtZW50LmNsYXNzTmFtZSxcblx0XHRcdHRleHRDb250ZW50OiBlbGVtZW50LnRleHRDb250ZW50IHx8ICcnLFxuXHRcdFx0YXR0cmlidXRlcyxcblx0XHRcdGNoaWxkcmVuLFxuXHRcdFx0bGVmdCxcblx0XHRcdHRvcFxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBnZXRFbGVtZW50WFkoc2VsZWN0b3I6IHN0cmluZywgeG9mZnNldD86IG51bWJlciwgeW9mZnNldD86IG51bWJlcik6IFByb21pc2U8eyB4OiBudW1iZXI7IHk6IG51bWJlciB9PiB7XG5cdFx0Y29uc3Qgb2Zmc2V0ID0gdHlwZW9mIHhvZmZzZXQgPT09ICdudW1iZXInICYmIHR5cGVvZiB5b2Zmc2V0ID09PSAnbnVtYmVyJyA/IHsgeDogeG9mZnNldCwgeTogeW9mZnNldCB9IDogdW5kZWZpbmVkO1xuXHRcdHJldHVybiB0aGlzLl9nZXRFbGVtZW50WFkoc2VsZWN0b3IsIG9mZnNldCk7XG5cdH1cblxuXHRhc3luYyB0eXBlSW5FZGl0b3Ioc2VsZWN0b3I6IHN0cmluZywgdGV4dDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IG1haW5XaW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG5cblx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgRWRpdG9yIG5vdCBmb3VuZDogJHtzZWxlY3Rvcn1gKTtcblx0XHR9XG5cdFx0aWYgKGlzSFRNTERpdkVsZW1lbnQoZWxlbWVudCkpIHtcblx0XHRcdC8vIEVkaXQgY29udGV4dCBpcyBlbmFibGVkXG5cdFx0XHRjb25zdCBlZGl0Q29udGV4dCA9IGVsZW1lbnQuZWRpdENvbnRleHQ7XG5cdFx0XHRpZiAoIWVkaXRDb250ZXh0KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgRWRpdCBjb250ZXh0IG5vdCBmb3VuZDogJHtzZWxlY3Rvcn1gKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHNlbGVjdGlvblN0YXJ0ID0gZWRpdENvbnRleHQuc2VsZWN0aW9uU3RhcnQ7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb25FbmQgPSBlZGl0Q29udGV4dC5zZWxlY3Rpb25FbmQ7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBUZXh0VXBkYXRlRXZlbnQoJ3RleHR1cGRhdGUnLCB7XG5cdFx0XHRcdHVwZGF0ZVJhbmdlU3RhcnQ6IHNlbGVjdGlvblN0YXJ0LFxuXHRcdFx0XHR1cGRhdGVSYW5nZUVuZDogc2VsZWN0aW9uRW5kLFxuXHRcdFx0XHR0ZXh0LFxuXHRcdFx0XHRzZWxlY3Rpb25TdGFydDogc2VsZWN0aW9uU3RhcnQgKyB0ZXh0Lmxlbmd0aCxcblx0XHRcdFx0c2VsZWN0aW9uRW5kOiBzZWxlY3Rpb25TdGFydCArIHRleHQubGVuZ3RoLFxuXHRcdFx0XHRjb21wb3NpdGlvblN0YXJ0OiAwLFxuXHRcdFx0XHRjb21wb3NpdGlvbkVuZDogMFxuXHRcdFx0fSk7XG5cdFx0XHRlZGl0Q29udGV4dC5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcblx0XHR9IGVsc2UgaWYgKGlzSFRNTFRleHRBcmVhRWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0Y29uc3Qgc3RhcnQgPSBlbGVtZW50LnNlbGVjdGlvblN0YXJ0O1xuXHRcdFx0Y29uc3QgbmV3U3RhcnQgPSBzdGFydCArIHRleHQubGVuZ3RoO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBlbGVtZW50LnZhbHVlO1xuXHRcdFx0Y29uc3QgbmV3VmFsdWUgPSB2YWx1ZS5zdWJzdHIoMCwgc3RhcnQpICsgdGV4dCArIHZhbHVlLnN1YnN0cihzdGFydCk7XG5cblx0XHRcdGVsZW1lbnQudmFsdWUgPSBuZXdWYWx1ZTtcblx0XHRcdGVsZW1lbnQuc2V0U2VsZWN0aW9uUmFuZ2UobmV3U3RhcnQsIG5ld1N0YXJ0KTtcblxuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgRXZlbnQoJ2lucHV0JywgeyAnYnViYmxlcyc6IHRydWUsICdjYW5jZWxhYmxlJzogdHJ1ZSB9KTtcblx0XHRcdGVsZW1lbnQuZGlzcGF0Y2hFdmVudChldmVudCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0RWRpdG9yU2VsZWN0aW9uKHNlbGVjdG9yOiBzdHJpbmcpOiBQcm9taXNlPHsgc2VsZWN0aW9uU3RhcnQ6IG51bWJlcjsgc2VsZWN0aW9uRW5kOiBudW1iZXIgfT4ge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBtYWluV2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBFZGl0b3Igbm90IGZvdW5kOiAke3NlbGVjdG9yfWApO1xuXHRcdH1cblx0XHRpZiAoaXNIVE1MRGl2RWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0Y29uc3QgZWRpdENvbnRleHQgPSBlbGVtZW50LmVkaXRDb250ZXh0O1xuXHRcdFx0aWYgKCFlZGl0Q29udGV4dCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEVkaXQgY29udGV4dCBub3QgZm91bmQ6ICR7c2VsZWN0b3J9YCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyBzZWxlY3Rpb25TdGFydDogZWRpdENvbnRleHQuc2VsZWN0aW9uU3RhcnQsIHNlbGVjdGlvbkVuZDogZWRpdENvbnRleHQuc2VsZWN0aW9uRW5kIH07XG5cdFx0fSBlbHNlIGlmIChpc0hUTUxUZXh0QXJlYUVsZW1lbnQoZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiB7IHNlbGVjdGlvblN0YXJ0OiBlbGVtZW50LnNlbGVjdGlvblN0YXJ0LCBzZWxlY3Rpb25FbmQ6IGVsZW1lbnQuc2VsZWN0aW9uRW5kIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0eXBlIG9mIGVsZW1lbnQ6ICR7c2VsZWN0b3J9YCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0VGVybWluYWxCdWZmZXIoc2VsZWN0b3I6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHRjb25zdCBlbGVtZW50ID0gbWFpbldpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBUZXJtaW5hbCBub3QgZm91bmQ6ICR7c2VsZWN0b3J9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeHRlcm0gPSAoZWxlbWVudCBhcyBhbnkpLnh0ZXJtO1xuXG5cdFx0aWYgKCF4dGVybSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBYdGVybSBub3QgZm91bmQ6ICR7c2VsZWN0b3J9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB4dGVybS5idWZmZXIuYWN0aXZlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRsaW5lcy5wdXNoKHh0ZXJtLmJ1ZmZlci5hY3RpdmUuZ2V0TGluZShpKSEudHJhbnNsYXRlVG9TdHJpbmcodHJ1ZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBsaW5lcztcblx0fVxuXG5cdGFzeW5jIHdyaXRlSW5UZXJtaW5hbChzZWxlY3Rvcjogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlbGVtZW50ID0gbWFpbldpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBFbGVtZW50IG5vdCBmb3VuZDogJHtzZWxlY3Rvcn1gKTtcblx0XHR9XG5cblx0XHRjb25zdCB4dGVybSA9IChlbGVtZW50IGFzIGFueSkueHRlcm0gYXMgKFh0ZXJtVGVybWluYWwgfCB1bmRlZmluZWQpO1xuXG5cdFx0aWYgKCF4dGVybSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBYdGVybSBub3QgZm91bmQ6ICR7c2VsZWN0b3J9YCk7XG5cdFx0fVxuXG5cdFx0eHRlcm0uaW5wdXQodGV4dCk7XG5cdH1cblxuXHRnZXRMb2NhbGVJbmZvKCk6IFByb21pc2U8SUxvY2FsZUluZm8+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcblx0XHRcdGxhbmd1YWdlOiBsYW5ndWFnZSxcblx0XHRcdGxvY2FsZTogbG9jYWxlXG5cdFx0fSk7XG5cdH1cblxuXHRnZXRMb2NhbGl6ZWRTdHJpbmdzKCk6IFByb21pc2U8SUxvY2FsaXplZFN0cmluZ3M+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcblx0XHRcdG9wZW46IGxvY2FsaXplZFN0cmluZ3Mub3Blbixcblx0XHRcdGNsb3NlOiBsb2NhbGl6ZWRTdHJpbmdzLmNsb3NlLFxuXHRcdFx0ZmluZDogbG9jYWxpemVkU3RyaW5ncy5maW5kXG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgX2dldEVsZW1lbnRYWShzZWxlY3Rvcjogc3RyaW5nLCBvZmZzZXQ/OiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0pOiBQcm9taXNlPHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfT4ge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBtYWluV2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG5cdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGBFbGVtZW50IG5vdCBmb3VuZDogJHtzZWxlY3Rvcn1gKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBsZWZ0LCB0b3AgfSA9IGdldFRvcExlZnRPZmZzZXQoZWxlbWVudCBhcyBIVE1MRWxlbWVudCk7XG5cdFx0Y29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRDbGllbnRBcmVhKGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpO1xuXHRcdGxldCB4OiBudW1iZXIsIHk6IG51bWJlcjtcblxuXHRcdGlmIChvZmZzZXQpIHtcblx0XHRcdHggPSBsZWZ0ICsgb2Zmc2V0Lng7XG5cdFx0XHR5ID0gdG9wICsgb2Zmc2V0Lnk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHggPSBsZWZ0ICsgKHdpZHRoIC8gMik7XG5cdFx0XHR5ID0gdG9wICsgKGhlaWdodCAvIDIpO1xuXHRcdH1cblxuXHRcdHggPSBNYXRoLnJvdW5kKHgpO1xuXHRcdHkgPSBNYXRoLnJvdW5kKHkpO1xuXG5cdFx0cmV0dXJuIHsgeCwgeSB9O1xuXHR9XG5cblx0YXN5bmMgZXhpdEFwcGxpY2F0aW9uKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIE5vLW9wIGluIHdlYlxuXHR9XG5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyV2luZG93RHJpdmVyKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiB2b2lkIHtcblx0T2JqZWN0LmFzc2lnbihtYWluV2luZG93LCB7IGRyaXZlcjogaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQnJvd3NlcldpbmRvd0RyaXZlcikgfSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZSxrQkFBa0Isa0JBQWtCLDZCQUE2QjtBQUN6RixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFVBQVUsY0FBYztBQUNqQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9CQUFvQjtBQUU3QixPQUFPLHNCQUFzQjtBQUM3QixTQUFtQixlQUFlO0FBQ2xDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQTBDLGNBQWMsMkJBQTJCO0FBRW5GLFNBQVMsbUJBQW1CLHNCQUFzQjtBQUczQyxJQUFNLHNCQUFOLE1BQW1EO0FBQUEsRUFFekQsWUFDZ0MsYUFDTyxvQkFDRixrQkFDTixZQUM3QjtBQUo4QjtBQUNPO0FBQ0Y7QUFDTjtBQUFBLEVBRS9CO0FBQUEsRUFFQSxNQUFNLFVBQStCO0FBQ3BDLFdBQU8sUUFBUSxLQUFLLGFBQWEsS0FBSyxrQkFBa0I7QUFBQSxFQUN6RDtBQUFBLEVBRUEsTUFBTSx3QkFBdUM7QUFDNUMsU0FBSyxXQUFXLEtBQUssa0RBQWtEO0FBQ3ZFLFVBQU0sS0FBSyxpQkFBaUIsS0FBSyxlQUFlLFFBQVE7QUFDeEQsU0FBSyxXQUFXLEtBQUsseUVBQXlFO0FBQzlGLFVBQU0sU0FBUyxHQUFvQyxvQkFBb0IsU0FBUyxFQUFFO0FBQ2xGLFNBQUssV0FBVyxLQUFLLDJDQUEyQztBQUFBLEVBQ2pFO0FBQUEsRUFFQSxNQUFNLFNBQVMsVUFBa0IsTUFBNkI7QUFDN0QsVUFBTSxVQUFVLFdBQVcsU0FBUyxjQUFjLFFBQVE7QUFFMUQsUUFBSSxDQUFDLFNBQVM7QUFDYixhQUFPLFFBQVEsT0FBTyxJQUFJLE1BQU0sc0JBQXNCLFFBQVEsRUFBRSxDQUFDO0FBQUEsSUFDbEU7QUFFQSxVQUFNLGVBQWU7QUFDckIsaUJBQWEsUUFB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
