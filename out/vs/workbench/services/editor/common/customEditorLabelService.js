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
import { Emitter } from "../../../../base/common/event.js";
import { parse as parseGlob } from "../../../../base/common/glob.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isAbsolute, parse as parsePath, dirname } from "../../../../base/common/path.js";
import { dirname as resourceDirname, relativePath as getRelativePath } from "../../../../base/common/resources.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { MRUCache } from "../../../../base/common/map.js";
let CustomEditorLabelService = class extends Disposable {
  constructor(configurationService, workspaceContextService) {
    super();
    this.configurationService = configurationService;
    this.workspaceContextService = workspaceContextService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.patterns = [];
    this.enabled = true;
    this.cache = new MRUCache(1e3);
    this._templateRegexValidation = /[a-zA-Z0-9]/;
    this._parsedTemplateExpression = /\$\{(dirname|filename|extname|extname\((?<extnameN>[-+]?\d+)\)|dirname\((?<dirnameN>[-+]?\d+)\))\}/g;
    this._filenameCaptureExpression = /(?<filename>^\.*[^.]*)/;
    this.storeEnablementState();
    this.storeCustomPatterns();
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CustomEditorLabelService.SETTING_ID_ENABLED)) {
        const oldEnablement = this.enabled;
        this.storeEnablementState();
        if (oldEnablement !== this.enabled && this.patterns.length > 0) {
          this._onDidChange.fire();
        }
      } else if (e.affectsConfiguration(CustomEditorLabelService.SETTING_ID_PATTERNS)) {
        this.cache.clear();
        this.storeCustomPatterns();
        this._onDidChange.fire();
      }
    }));
  }
  storeEnablementState() {
    this.enabled = this.configurationService.getValue(CustomEditorLabelService.SETTING_ID_ENABLED);
  }
  storeCustomPatterns() {
    this.patterns = [];
    const customLabelPatterns = this.configurationService.getValue(CustomEditorLabelService.SETTING_ID_PATTERNS);
    for (const pattern in customLabelPatterns) {
      const template = customLabelPatterns[pattern];
      if (!this._templateRegexValidation.test(template)) {
        continue;
      }
      const isAbsolutePath = isAbsolute(pattern);
      const parsedPattern = parseGlob(pattern);
      this.patterns.push({ pattern, template, isAbsolutePath, parsedPattern });
    }
    this.patterns.sort((a, b) => this.patternWeight(b.pattern) - this.patternWeight(a.pattern));
  }
  patternWeight(pattern) {
    let weight = 0;
    for (const fragment of pattern.split("/")) {
      if (fragment === "**") {
        weight += 1;
      } else if (fragment === "*") {
        weight += 10;
      } else if (fragment.includes("*") || fragment.includes("?")) {
        weight += 50;
      } else if (fragment !== "") {
        weight += 100;
      }
    }
    return weight;
  }
  getName(resource) {
    if (!this.enabled || this.patterns.length === 0) {
      return void 0;
    }
    const key = resource.toString();
    const cached = this.cache.get(key);
    if (cached !== void 0) {
      return cached ?? void 0;
    }
    const result = this.applyPatterns(resource);
    this.cache.set(key, result ?? null);
    return result;
  }
  applyPatterns(resource) {
    const root = this.workspaceContextService.getWorkspaceFolder(resource);
    let relativePath;
    for (const pattern of this.patterns) {
      let relevantPath;
      if (root && !pattern.isAbsolutePath) {
        if (!relativePath) {
          relativePath = getRelativePath(resourceDirname(root.uri), resource) ?? resource.path;
        }
        relevantPath = relativePath;
      } else {
        relevantPath = resource.path;
      }
      if (pattern.parsedPattern(relevantPath)) {
        return this.applyTemplate(pattern.template, resource, relevantPath);
      }
    }
    return void 0;
  }
  applyTemplate(template, resource, relevantPath) {
    let parsedPath;
    return template.replace(this._parsedTemplateExpression, (match, variable, ...args) => {
      parsedPath = parsedPath ?? parsePath(resource.path);
      const { dirnameN = "0", extnameN = "0" } = args.pop();
      if (variable === "filename") {
        const { filename } = this._filenameCaptureExpression.exec(parsedPath.base)?.groups ?? {};
        if (filename) {
          return filename;
        }
      } else if (variable === "extname") {
        const extension = this.getExtnames(parsedPath.base);
        if (extension) {
          return extension;
        }
      } else if (variable.startsWith("extname")) {
        const n = parseInt(extnameN);
        const nthExtname = this.getNthExtname(parsedPath.base, n);
        if (nthExtname) {
          return nthExtname;
        }
      } else if (variable.startsWith("dirname")) {
        const n = parseInt(dirnameN);
        const nthDir = this.getNthDirname(dirname(relevantPath), n);
        if (nthDir) {
          return nthDir;
        }
      }
      return match;
    });
  }
  removeLeadingDot(path) {
    let withoutLeadingDot = path;
    while (withoutLeadingDot.startsWith(".")) {
      withoutLeadingDot = withoutLeadingDot.slice(1);
    }
    return withoutLeadingDot;
  }
  getNthDirname(path, n) {
    path = path.startsWith("/") ? path.slice(1) : path;
    const pathFragments = path.split("/");
    return this.getNthFragment(pathFragments, n);
  }
  getExtnames(fullFileName) {
    return this.removeLeadingDot(fullFileName).split(".").slice(1).join(".");
  }
  getNthExtname(fullFileName, n) {
    const extensionNameFragments = this.removeLeadingDot(fullFileName).split(".");
    extensionNameFragments.shift();
    return this.getNthFragment(extensionNameFragments, n);
  }
  getNthFragment(fragments, n) {
    const length = fragments.length;
    let nth;
    if (n < 0) {
      nth = Math.abs(n) - 1;
    } else {
      nth = length - n - 1;
    }
    const nthFragment = fragments[nth];
    if (nthFragment === void 0 || nthFragment === "") {
      return void 0;
    }
    return nthFragment;
  }
};
CustomEditorLabelService.SETTING_ID_PATTERNS = "workbench.editor.customLabels.patterns";
CustomEditorLabelService.SETTING_ID_ENABLED = "workbench.editor.customLabels.enabled";
CustomEditorLabelService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IWorkspaceContextService)
], CustomEditorLabelService);
const ICustomEditorLabelService = createDecorator("ICustomEditorLabelService");
registerSingleton(ICustomEditorLabelService, CustomEditorLabelService, InstantiationType.Delayed);
export {
  CustomEditorLabelService,
  ICustomEditorLabelService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZWRpdG9yL2NvbW1vbi9jdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFBhcnNlZFBhdHRlcm4sIHBhcnNlIGFzIHBhcnNlR2xvYiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0Fic29sdXRlLCBwYXJzZSBhcyBwYXJzZVBhdGgsIFBhcnNlZFBhdGgsIGRpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGRpcm5hbWUgYXMgcmVzb3VyY2VEaXJuYW1lLCByZWxhdGl2ZVBhdGggYXMgZ2V0UmVsYXRpdmVQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBNUlVDYWNoZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5cbmludGVyZmFjZSBJQ3VzdG9tRWRpdG9yTGFiZWxPYmplY3Qge1xuXHRyZWFkb25seSBba2V5OiBzdHJpbmddOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJQ3VzdG9tRWRpdG9yTGFiZWxQYXR0ZXJuIHtcblx0cmVhZG9ubHkgcGF0dGVybjogc3RyaW5nO1xuXHRyZWFkb25seSB0ZW1wbGF0ZTogc3RyaW5nO1xuXG5cdHJlYWRvbmx5IGlzQWJzb2x1dGVQYXRoOiBib29sZWFuO1xuXHRyZWFkb25seSBwYXJzZWRQYXR0ZXJuOiBQYXJzZWRQYXR0ZXJuO1xufVxuXG5leHBvcnQgY2xhc3MgQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRzdGF0aWMgcmVhZG9ubHkgU0VUVElOR19JRF9QQVRURVJOUyA9ICd3b3JrYmVuY2guZWRpdG9yLmN1c3RvbUxhYmVscy5wYXR0ZXJucyc7XG5cdHN0YXRpYyByZWFkb25seSBTRVRUSU5HX0lEX0VOQUJMRUQgPSAnd29ya2JlbmNoLmVkaXRvci5jdXN0b21MYWJlbHMuZW5hYmxlZCc7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHBhdHRlcm5zOiBJQ3VzdG9tRWRpdG9yTGFiZWxQYXR0ZXJuW10gPSBbXTtcblx0cHJpdmF0ZSBlbmFibGVkID0gdHJ1ZTtcblxuXHRwcml2YXRlIGNhY2hlID0gbmV3IE1SVUNhY2hlPHN0cmluZywgc3RyaW5nIHwgbnVsbD4oMTAwMCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnN0b3JlRW5hYmxlbWVudFN0YXRlKCk7XG5cdFx0dGhpcy5zdG9yZUN1c3RvbVBhdHRlcm5zKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0Ly8gQ2FjaGUgdGhlIGVuYWJsZWQgc3RhdGVcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKEN1c3RvbUVkaXRvckxhYmVsU2VydmljZS5TRVRUSU5HX0lEX0VOQUJMRUQpKSB7XG5cdFx0XHRcdGNvbnN0IG9sZEVuYWJsZW1lbnQgPSB0aGlzLmVuYWJsZWQ7XG5cdFx0XHRcdHRoaXMuc3RvcmVFbmFibGVtZW50U3RhdGUoKTtcblx0XHRcdFx0aWYgKG9sZEVuYWJsZW1lbnQgIT09IHRoaXMuZW5hYmxlZCAmJiB0aGlzLnBhdHRlcm5zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2FjaGUgdGhlIHBhdHRlcm5zXG5cdFx0XHRlbHNlIGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKEN1c3RvbUVkaXRvckxhYmVsU2VydmljZS5TRVRUSU5HX0lEX1BBVFRFUk5TKSkge1xuXHRcdFx0XHR0aGlzLmNhY2hlLmNsZWFyKCk7XG5cdFx0XHRcdHRoaXMuc3RvcmVDdXN0b21QYXR0ZXJucygpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdG9yZUVuYWJsZW1lbnRTdGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLmVuYWJsZWQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KEN1c3RvbUVkaXRvckxhYmVsU2VydmljZS5TRVRUSU5HX0lEX0VOQUJMRUQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdGVtcGxhdGVSZWdleFZhbGlkYXRpb246IFJlZ0V4cCA9IC9bYS16QS1aMC05XS87XG5cdHByaXZhdGUgc3RvcmVDdXN0b21QYXR0ZXJucygpOiB2b2lkIHtcblx0XHR0aGlzLnBhdHRlcm5zID0gW107XG5cdFx0Y29uc3QgY3VzdG9tTGFiZWxQYXR0ZXJucyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUN1c3RvbUVkaXRvckxhYmVsT2JqZWN0PihDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuU0VUVElOR19JRF9QQVRURVJOUyk7XG5cdFx0Zm9yIChjb25zdCBwYXR0ZXJuIGluIGN1c3RvbUxhYmVsUGF0dGVybnMpIHtcblx0XHRcdGNvbnN0IHRlbXBsYXRlID0gY3VzdG9tTGFiZWxQYXR0ZXJuc1twYXR0ZXJuXTtcblxuXHRcdFx0aWYgKCF0aGlzLl90ZW1wbGF0ZVJlZ2V4VmFsaWRhdGlvbi50ZXN0KHRlbXBsYXRlKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaXNBYnNvbHV0ZVBhdGggPSBpc0Fic29sdXRlKHBhdHRlcm4pO1xuXHRcdFx0Y29uc3QgcGFyc2VkUGF0dGVybiA9IHBhcnNlR2xvYihwYXR0ZXJuKTtcblxuXHRcdFx0dGhpcy5wYXR0ZXJucy5wdXNoKHsgcGF0dGVybiwgdGVtcGxhdGUsIGlzQWJzb2x1dGVQYXRoLCBwYXJzZWRQYXR0ZXJuIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMucGF0dGVybnMuc29ydCgoYSwgYikgPT4gdGhpcy5wYXR0ZXJuV2VpZ2h0KGIucGF0dGVybikgLSB0aGlzLnBhdHRlcm5XZWlnaHQoYS5wYXR0ZXJuKSk7XG5cdH1cblxuXHRwcml2YXRlIHBhdHRlcm5XZWlnaHQocGF0dGVybjogc3RyaW5nKTogbnVtYmVyIHtcblx0XHRsZXQgd2VpZ2h0ID0gMDtcblx0XHRmb3IgKGNvbnN0IGZyYWdtZW50IG9mIHBhdHRlcm4uc3BsaXQoJy8nKSkge1xuXHRcdFx0aWYgKGZyYWdtZW50ID09PSAnKionKSB7XG5cdFx0XHRcdHdlaWdodCArPSAxO1xuXHRcdFx0fSBlbHNlIGlmIChmcmFnbWVudCA9PT0gJyonKSB7XG5cdFx0XHRcdHdlaWdodCArPSAxMDtcblx0XHRcdH0gZWxzZSBpZiAoZnJhZ21lbnQuaW5jbHVkZXMoJyonKSB8fCBmcmFnbWVudC5pbmNsdWRlcygnPycpKSB7XG5cdFx0XHRcdHdlaWdodCArPSA1MDtcblx0XHRcdH0gZWxzZSBpZiAoZnJhZ21lbnQgIT09ICcnKSB7XG5cdFx0XHRcdHdlaWdodCArPSAxMDA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHdlaWdodDtcblx0fVxuXG5cdGdldE5hbWUocmVzb3VyY2U6IFVSSSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLmVuYWJsZWQgfHwgdGhpcy5wYXR0ZXJucy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qga2V5ID0gcmVzb3VyY2UudG9TdHJpbmcoKTtcblx0XHRjb25zdCBjYWNoZWQgPSB0aGlzLmNhY2hlLmdldChrZXkpO1xuXHRcdGlmIChjYWNoZWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGNhY2hlZCA/PyB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5hcHBseVBhdHRlcm5zKHJlc291cmNlKTtcblx0XHR0aGlzLmNhY2hlLnNldChrZXksIHJlc3VsdCA/PyBudWxsKTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5UGF0dGVybnMocmVzb3VyY2U6IFVSSSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgcm9vdCA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKHJlc291cmNlKTtcblx0XHRsZXQgcmVsYXRpdmVQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0XHRmb3IgKGNvbnN0IHBhdHRlcm4gb2YgdGhpcy5wYXR0ZXJucykge1xuXHRcdFx0bGV0IHJlbGV2YW50UGF0aDogc3RyaW5nO1xuXHRcdFx0aWYgKHJvb3QgJiYgIXBhdHRlcm4uaXNBYnNvbHV0ZVBhdGgpIHtcblx0XHRcdFx0aWYgKCFyZWxhdGl2ZVBhdGgpIHtcblx0XHRcdFx0XHRyZWxhdGl2ZVBhdGggPSBnZXRSZWxhdGl2ZVBhdGgocmVzb3VyY2VEaXJuYW1lKHJvb3QudXJpKSwgcmVzb3VyY2UpID8/IHJlc291cmNlLnBhdGg7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVsZXZhbnRQYXRoID0gcmVsYXRpdmVQYXRoO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVsZXZhbnRQYXRoID0gcmVzb3VyY2UucGF0aDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhdHRlcm4ucGFyc2VkUGF0dGVybihyZWxldmFudFBhdGgpKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmFwcGx5VGVtcGxhdGUocGF0dGVybi50ZW1wbGF0ZSwgcmVzb3VyY2UsIHJlbGV2YW50UGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3BhcnNlZFRlbXBsYXRlRXhwcmVzc2lvbiA9IC9cXCRcXHsoZGlybmFtZXxmaWxlbmFtZXxleHRuYW1lfGV4dG5hbWVcXCgoPzxleHRuYW1lTj5bLStdP1xcZCspXFwpfGRpcm5hbWVcXCgoPzxkaXJuYW1lTj5bLStdP1xcZCspXFwpKVxcfS9nO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9maWxlbmFtZUNhcHR1cmVFeHByZXNzaW9uID0gLyg/PGZpbGVuYW1lPl5cXC4qW14uXSopLztcblx0cHJpdmF0ZSBhcHBseVRlbXBsYXRlKHRlbXBsYXRlOiBzdHJpbmcsIHJlc291cmNlOiBVUkksIHJlbGV2YW50UGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRsZXQgcGFyc2VkUGF0aDogdW5kZWZpbmVkIHwgUGFyc2VkUGF0aDtcblx0XHRyZXR1cm4gdGVtcGxhdGUucmVwbGFjZSh0aGlzLl9wYXJzZWRUZW1wbGF0ZUV4cHJlc3Npb24sIChtYXRjaDogc3RyaW5nLCB2YXJpYWJsZTogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSkgPT4ge1xuXHRcdFx0cGFyc2VkUGF0aCA9IHBhcnNlZFBhdGggPz8gcGFyc2VQYXRoKHJlc291cmNlLnBhdGgpO1xuXHRcdFx0Ly8gbmFtZWQgZ3JvdXAgbWF0Y2hlc1xuXHRcdFx0Y29uc3QgeyBkaXJuYW1lTiA9ICcwJywgZXh0bmFtZU4gPSAnMCcgfTogeyBkaXJuYW1lTj86IHN0cmluZzsgZXh0bmFtZU4/OiBzdHJpbmcgfSA9IGFyZ3MucG9wKCk7XG5cblx0XHRcdGlmICh2YXJpYWJsZSA9PT0gJ2ZpbGVuYW1lJykge1xuXHRcdFx0XHRjb25zdCB7IGZpbGVuYW1lIH0gPSB0aGlzLl9maWxlbmFtZUNhcHR1cmVFeHByZXNzaW9uLmV4ZWMocGFyc2VkUGF0aC5iYXNlKT8uZ3JvdXBzID8/IHt9O1xuXHRcdFx0XHRpZiAoZmlsZW5hbWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmlsZW5hbWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAodmFyaWFibGUgPT09ICdleHRuYW1lJykge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSB0aGlzLmdldEV4dG5hbWVzKHBhcnNlZFBhdGguYmFzZSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gZXh0ZW5zaW9uO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHZhcmlhYmxlLnN0YXJ0c1dpdGgoJ2V4dG5hbWUnKSkge1xuXHRcdFx0XHRjb25zdCBuID0gcGFyc2VJbnQoZXh0bmFtZU4pO1xuXHRcdFx0XHRjb25zdCBudGhFeHRuYW1lID0gdGhpcy5nZXROdGhFeHRuYW1lKHBhcnNlZFBhdGguYmFzZSwgbik7XG5cdFx0XHRcdGlmIChudGhFeHRuYW1lKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG50aEV4dG5hbWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAodmFyaWFibGUuc3RhcnRzV2l0aCgnZGlybmFtZScpKSB7XG5cdFx0XHRcdGNvbnN0IG4gPSBwYXJzZUludChkaXJuYW1lTik7XG5cdFx0XHRcdGNvbnN0IG50aERpciA9IHRoaXMuZ2V0TnRoRGlybmFtZShkaXJuYW1lKHJlbGV2YW50UGF0aCksIG4pO1xuXHRcdFx0XHRpZiAobnRoRGlyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG50aERpcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbWF0Y2g7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUxlYWRpbmdEb3QocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRsZXQgd2l0aG91dExlYWRpbmdEb3QgPSBwYXRoO1xuXHRcdHdoaWxlICh3aXRob3V0TGVhZGluZ0RvdC5zdGFydHNXaXRoKCcuJykpIHtcblx0XHRcdHdpdGhvdXRMZWFkaW5nRG90ID0gd2l0aG91dExlYWRpbmdEb3Quc2xpY2UoMSk7XG5cdFx0fVxuXHRcdHJldHVybiB3aXRob3V0TGVhZGluZ0RvdDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TnRoRGlybmFtZShwYXRoOiBzdHJpbmcsIG46IG51bWJlcik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Ly8gZ3JhbmQtcGFyZW50L3BhcmVudC9maWxlbmFtZS5leHQxLmV4dDIgLT4gW2dyYW5kLXBhcmVudCwgcGFyZW50XVxuXHRcdHBhdGggPSBwYXRoLnN0YXJ0c1dpdGgoJy8nKSA/IHBhdGguc2xpY2UoMSkgOiBwYXRoO1xuXHRcdGNvbnN0IHBhdGhGcmFnbWVudHMgPSBwYXRoLnNwbGl0KCcvJyk7XG5cblx0XHRyZXR1cm4gdGhpcy5nZXROdGhGcmFnbWVudChwYXRoRnJhZ21lbnRzLCBuKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RXh0bmFtZXMoZnVsbEZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnJlbW92ZUxlYWRpbmdEb3QoZnVsbEZpbGVOYW1lKS5zcGxpdCgnLicpLnNsaWNlKDEpLmpvaW4oJy4nKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TnRoRXh0bmFtZShmdWxsRmlsZU5hbWU6IHN0cmluZywgbjogbnVtYmVyKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHQvLyBmaWxlLmV4dDEuZXh0Mi5leHQzIC0+IFtmaWxlLCBleHQxLCBleHQyLCBleHQzXVxuXHRcdGNvbnN0IGV4dGVuc2lvbk5hbWVGcmFnbWVudHMgPSB0aGlzLnJlbW92ZUxlYWRpbmdEb3QoZnVsbEZpbGVOYW1lKS5zcGxpdCgnLicpO1xuXHRcdGV4dGVuc2lvbk5hbWVGcmFnbWVudHMuc2hpZnQoKTsgLy8gcmVtb3ZlIHRoZSBmaXJzdCBlbGVtZW50IHdoaWNoIGlzIHRoZSBmaWxlIG5hbWVcblxuXHRcdHJldHVybiB0aGlzLmdldE50aEZyYWdtZW50KGV4dGVuc2lvbk5hbWVGcmFnbWVudHMsIG4pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXROdGhGcmFnbWVudChmcmFnbWVudHM6IHN0cmluZ1tdLCBuOiBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGxlbmd0aCA9IGZyYWdtZW50cy5sZW5ndGg7XG5cblx0XHRsZXQgbnRoO1xuXHRcdGlmIChuIDwgMCkge1xuXHRcdFx0bnRoID0gTWF0aC5hYnMobikgLSAxO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRudGggPSBsZW5ndGggLSBuIC0gMTtcblx0XHR9XG5cblx0XHRjb25zdCBudGhGcmFnbWVudCA9IGZyYWdtZW50c1tudGhdO1xuXHRcdGlmIChudGhGcmFnbWVudCA9PT0gdW5kZWZpbmVkIHx8IG50aEZyYWdtZW50ID09PSAnJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIG50aEZyYWdtZW50O1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBJQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2U+KCdJQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUN1c3RvbUVkaXRvckxhYmVsU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+O1xuXHRnZXROYW1lKHJlc291cmNlOiBVUkkpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UsIEN1c3RvbUVkaXRvckxhYmVsU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBc0I7QUFDL0IsU0FBd0IsU0FBUyxpQkFBaUI7QUFDbEQsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxZQUFZLFNBQVMsV0FBdUIsZUFBZTtBQUNwRSxTQUFTLFdBQVcsaUJBQWlCLGdCQUFnQix1QkFBdUI7QUFFNUUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0JBQWdCO0FBY2xCLElBQU0sMkJBQU4sY0FBdUMsV0FBZ0Q7QUFBQSxFQWU3RixZQUN5QyxzQkFDRyx5QkFDMUM7QUFDRCxVQUFNO0FBSGtDO0FBQ0c7QUFWNUMsU0FBaUIsZUFBZSxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDbEUsU0FBUyxjQUFjLEtBQUssYUFBYTtBQUV6QyxTQUFRLFdBQXdDLENBQUM7QUFDakQsU0FBUSxVQUFVO0FBRWxCLFNBQVEsUUFBUSxJQUFJLFNBQWdDLEdBQUk7QUFzQ3hELFNBQVEsMkJBQW1DO0FBNkUzQyxTQUFpQiw0QkFBNEI7QUFDN0MsU0FBaUIsNkJBQTZCO0FBNUc3QyxTQUFLLHFCQUFxQjtBQUMxQixTQUFLLG9CQUFvQjtBQUV6QixTQUFLLGtCQUFrQjtBQUFBLEVBQ3hCO0FBQUEsRUFFUSxvQkFBMEI7QUFDakMsU0FBSyxVQUFVLEtBQUsscUJBQXFCLHlCQUF5QixP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
