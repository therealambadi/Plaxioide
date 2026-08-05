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
import * as nls from "../../../nls.js";
import { addDisposableListener, getActiveWindow } from "../../../base/browser/dom.js";
import { createFastDomNode } from "../../../base/browser/fastDomNode.js";
import { BugIndicatingError } from "../../../base/common/errors.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { observableValue, runOnChange } from "../../../base/common/observable.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { TextureAtlas } from "./atlas/textureAtlas.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { INotificationService, Severity } from "../../../platform/notification/common/notification.js";
import { GPULifecycle } from "./gpuDisposable.js";
import { ensureNonNullable, observeDevicePixelDimensions } from "./gpuUtils.js";
import { RectangleRenderer } from "./rectangleRenderer.js";
import { DecorationCssRuleExtractor } from "./css/decorationCssRuleExtractor.js";
import { Event } from "../../../base/common/event.js";
import { EditorOption } from "../../common/config/editorOptions.js";
import { InlineDecorationType } from "../../common/viewModel.js";
import { DecorationStyleCache } from "./css/decorationStyleCache.js";
import { ViewportRenderStrategy } from "./renderStrategy/viewportRenderStrategy.js";
let ViewGpuContext = class extends Disposable {
  constructor(context, _instantiationService, _notificationService, configurationService) {
    super();
    this._instantiationService = _instantiationService;
    this._notificationService = _notificationService;
    this.configurationService = configurationService;
    /**
     * The hard cap for line columns rendered by the GPU renderer.
     */
    this.maxGpuCols = ViewportRenderStrategy.maxSupportedColumns;
    this.canvas = createFastDomNode(document.createElement("canvas"));
    this.canvas.setClassName("editorCanvas");
    this._register(Event.runAndSubscribe(configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration("editor.scrollbar.verticalScrollbarSize")) {
        const verticalScrollbarSize = configurationService.getValue("editor").scrollbar?.verticalScrollbarSize ?? 14;
        this.canvas.domNode.style.boxSizing = "border-box";
        this.canvas.domNode.style.paddingRight = `${verticalScrollbarSize}px`;
      }
    }));
    this.ctx = ensureNonNullable(this.canvas.domNode.getContext("webgpu"));
    if (!ViewGpuContext.device) {
      ViewGpuContext.device = GPULifecycle.requestDevice((message) => {
        const choices = [{
          label: nls.localize("editor.dom.render", "Use DOM-based rendering"),
          run: () => this.configurationService.updateValue("editor.experimentalGpuAcceleration", "off")
        }];
        this._notificationService.prompt(Severity.Warning, message, choices);
      }).then((ref) => {
        ViewGpuContext.deviceSync = ref.object;
        if (!ViewGpuContext._atlas) {
          ViewGpuContext._atlas = this._instantiationService.createInstance(TextureAtlas, ref.object.limits.maxTextureDimension2D, void 0);
        }
        return ref.object;
      });
    }
    const dprObs = observableValue(this, getActiveWindow().devicePixelRatio);
    this._register(addDisposableListener(getActiveWindow(), "resize", () => {
      dprObs.set(getActiveWindow().devicePixelRatio, void 0);
    }));
    this.devicePixelRatio = dprObs;
    this._register(runOnChange(this.devicePixelRatio, () => ViewGpuContext.atlas?.clear()));
    const canvasDevicePixelDimensions = observableValue(this, { width: this.canvas.domNode.width, height: this.canvas.domNode.height });
    this._register(observeDevicePixelDimensions(
      this.canvas.domNode,
      getActiveWindow(),
      (width, height) => {
        this.canvas.domNode.width = width;
        this.canvas.domNode.height = height;
        canvasDevicePixelDimensions.set({ width, height }, void 0);
      }
    ));
    this.canvasDevicePixelDimensions = canvasDevicePixelDimensions;
    const contentLeft = observableValue(this, 0);
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      contentLeft.set(context.configuration.options.get(EditorOption.layoutInfo).contentLeft, void 0);
    }));
    this.contentLeft = contentLeft;
    this.rectangleRenderer = this._instantiationService.createInstance(RectangleRenderer, context, this.contentLeft, this.devicePixelRatio, this.canvas.domNode, this.ctx, ViewGpuContext.device);
  }
  static get decorationCssRuleExtractor() {
    return ViewGpuContext._decorationCssRuleExtractor;
  }
  static get decorationStyleCache() {
    return ViewGpuContext._decorationStyleCache;
  }
  /**
   * The shared texture atlas to use across all views.
   *
   * @throws if called before the GPU device is resolved
   */
  static get atlas() {
    if (!ViewGpuContext._atlas) {
      throw new BugIndicatingError("Cannot call ViewGpuContext.textureAtlas before device is resolved");
    }
    return ViewGpuContext._atlas;
  }
  /**
   * The shared texture atlas to use across all views. This is a convenience alias for
   * {@link ViewGpuContext.atlas}.
   *
   * @throws if called before the GPU device is resolved
   */
  get atlas() {
    return ViewGpuContext.atlas;
  }
  /**
   * This method determines which lines can be and are allowed to be rendered using the GPU
   * renderer. Eventually this should trend all lines, except maybe exceptional cases like
   * decorations that use class names.
   */
  canRender(options, viewportData, lineNumber) {
    const data = viewportData.getViewLineRenderingData(lineNumber);
    if (data.containsRTL || data.maxColumn > this.maxGpuCols) {
      return false;
    }
    if (data.inlineDecorations.length > 0) {
      let supported = true;
      for (const decoration of data.inlineDecorations) {
        if (decoration.type !== InlineDecorationType.Regular) {
          supported = false;
          break;
        }
        const styleRules = ViewGpuContext._decorationCssRuleExtractor.getStyleRules(this.canvas.domNode, decoration.inlineClassName);
        supported &&= styleRules.every((rule) => {
          if (rule.selectorText.includes(":")) {
            return false;
          }
          for (const r of rule.style) {
            if (!supportsCssRule(r, rule.style)) {
              return false;
            }
          }
          return true;
        });
        if (!supported) {
          break;
        }
      }
      return supported;
    }
    return true;
  }
  /**
   * Like {@link canRender} but returns detailed information about why the line cannot be rendered.
   */
  canRenderDetailed(options, viewportData, lineNumber) {
    const data = viewportData.getViewLineRenderingData(lineNumber);
    const reasons = [];
    if (data.containsRTL) {
      reasons.push("containsRTL");
    }
    if (data.maxColumn > this.maxGpuCols) {
      reasons.push("maxColumn > maxGpuCols");
    }
    if (data.inlineDecorations.length > 0) {
      let supported = true;
      const problemTypes = [];
      const problemSelectors = [];
      const problemRules = [];
      for (const decoration of data.inlineDecorations) {
        if (decoration.type !== InlineDecorationType.Regular) {
          problemTypes.push(decoration.type);
          supported = false;
          continue;
        }
        const styleRules = ViewGpuContext._decorationCssRuleExtractor.getStyleRules(this.canvas.domNode, decoration.inlineClassName);
        supported &&= styleRules.every((rule) => {
          if (rule.selectorText.includes(":")) {
            problemSelectors.push(rule.selectorText);
            return false;
          }
          for (const r of rule.style) {
            if (!supportsCssRule(r, rule.style)) {
              problemRules.push(`${r}: ${rule.style[r]}`);
              return false;
            }
          }
          return true;
        });
        if (!supported) {
          continue;
        }
      }
      if (problemTypes.length > 0) {
        reasons.push(`inlineDecorations with unsupported types (${problemTypes.map((e) => `\`${e}\``).join(", ")})`);
      }
      if (problemRules.length > 0) {
        reasons.push(`inlineDecorations with unsupported CSS rules (${problemRules.map((e) => `\`${e}\``).join(", ")})`);
      }
      if (problemSelectors.length > 0) {
        reasons.push(`inlineDecorations with unsupported CSS selectors (${problemSelectors.map((e) => `\`${e}\``).join(", ")})`);
      }
    }
    return reasons;
  }
};
ViewGpuContext._decorationCssRuleExtractor = new DecorationCssRuleExtractor();
ViewGpuContext._decorationStyleCache = new DecorationStyleCache();
ViewGpuContext = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, IConfigurationService)
], ViewGpuContext);
const gpuSupportedDecorationCssRules = [
  "color",
  "font-weight",
  "opacity"
];
function supportsCssRule(rule, style) {
  if (!gpuSupportedDecorationCssRules.includes(rule)) {
    return false;
  }
  switch (rule) {
    default:
      return true;
  }
}
export {
  ViewGpuContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9ncHUvdmlld0dwdUNvbnRleHQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgZ2V0QWN0aXZlV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVGYXN0RG9tTm9kZSwgdHlwZSBGYXN0RG9tTm9kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9mYXN0RG9tTm9kZS5qcyc7XG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdwb3J0RGF0YSB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3TGF5b3V0L3ZpZXdMaW5lc1ZpZXdwb3J0RGF0YS5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdMaW5lT3B0aW9ucyB9IGZyb20gJy4uL3ZpZXdQYXJ0cy92aWV3TGluZXMvdmlld0xpbmVPcHRpb25zLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVWYWx1ZSwgcnVuT25DaGFuZ2UsIHR5cGUgSU9ic2VydmFibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgVGV4dHVyZUF0bGFzIH0gZnJvbSAnLi9hdGxhcy90ZXh0dXJlQXRsYXMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgSVByb21wdENob2ljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBHUFVMaWZlY3ljbGUgfSBmcm9tICcuL2dwdURpc3Bvc2FibGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9uTnVsbGFibGUsIG9ic2VydmVEZXZpY2VQaXhlbERpbWVuc2lvbnMgfSBmcm9tICcuL2dwdVV0aWxzLmpzJztcbmltcG9ydCB7IFJlY3RhbmdsZVJlbmRlcmVyIH0gZnJvbSAnLi9yZWN0YW5nbGVSZW5kZXJlci5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdDb250ZXh0IH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC92aWV3Q29udGV4dC5qcyc7XG5pbXBvcnQgeyBEZWNvcmF0aW9uQ3NzUnVsZUV4dHJhY3RvciB9IGZyb20gJy4vY3NzL2RlY29yYXRpb25Dc3NSdWxlRXh0cmFjdG9yLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uLCB0eXBlIElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElubGluZURlY29yYXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBEZWNvcmF0aW9uU3R5bGVDYWNoZSB9IGZyb20gJy4vY3NzL2RlY29yYXRpb25TdHlsZUNhY2hlLmpzJztcbmltcG9ydCB7IFZpZXdwb3J0UmVuZGVyU3RyYXRlZ3kgfSBmcm9tICcuL3JlbmRlclN0cmF0ZWd5L3ZpZXdwb3J0UmVuZGVyU3RyYXRlZ3kuanMnO1xuXG5leHBvcnQgY2xhc3MgVmlld0dwdUNvbnRleHQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0LyoqXG5cdCAqIFRoZSBoYXJkIGNhcCBmb3IgbGluZSBjb2x1bW5zIHJlbmRlcmVkIGJ5IHRoZSBHUFUgcmVuZGVyZXIuXG5cdCAqL1xuXHRyZWFkb25seSBtYXhHcHVDb2xzID0gVmlld3BvcnRSZW5kZXJTdHJhdGVneS5tYXhTdXBwb3J0ZWRDb2x1bW5zO1xuXG5cdHJlYWRvbmx5IGNhbnZhczogRmFzdERvbU5vZGU8SFRNTENhbnZhc0VsZW1lbnQ+O1xuXHRyZWFkb25seSBjdHg6IEdQVUNhbnZhc0NvbnRleHQ7XG5cblx0c3RhdGljIGRldmljZTogUHJvbWlzZTxHUFVEZXZpY2U+O1xuXHRzdGF0aWMgZGV2aWNlU3luYzogR1BVRGV2aWNlIHwgdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IHJlY3RhbmdsZVJlbmRlcmVyOiBSZWN0YW5nbGVSZW5kZXJlcjtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfZGVjb3JhdGlvbkNzc1J1bGVFeHRyYWN0b3IgPSBuZXcgRGVjb3JhdGlvbkNzc1J1bGVFeHRyYWN0b3IoKTtcblx0c3RhdGljIGdldCBkZWNvcmF0aW9uQ3NzUnVsZUV4dHJhY3RvcigpOiBEZWNvcmF0aW9uQ3NzUnVsZUV4dHJhY3RvciB7XG5cdFx0cmV0dXJuIFZpZXdHcHVDb250ZXh0Ll9kZWNvcmF0aW9uQ3NzUnVsZUV4dHJhY3Rvcjtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9kZWNvcmF0aW9uU3R5bGVDYWNoZSA9IG5ldyBEZWNvcmF0aW9uU3R5bGVDYWNoZSgpO1xuXHRzdGF0aWMgZ2V0IGRlY29yYXRpb25TdHlsZUNhY2hlKCk6IERlY29yYXRpb25TdHlsZUNhY2hlIHtcblx0XHRyZXR1cm4gVmlld0dwdUNvbnRleHQuX2RlY29yYXRpb25TdHlsZUNhY2hlO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2F0bGFzOiBUZXh0dXJlQXRsYXMgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIFRoZSBzaGFyZWQgdGV4dHVyZSBhdGxhcyB0byB1c2UgYWNyb3NzIGFsbCB2aWV3cy5cblx0ICpcblx0ICogQHRocm93cyBpZiBjYWxsZWQgYmVmb3JlIHRoZSBHUFUgZGV2aWNlIGlzIHJlc29sdmVkXG5cdCAqL1xuXHRzdGF0aWMgZ2V0IGF0bGFzKCk6IFRleHR1cmVBdGxhcyB7XG5cdFx0aWYgKCFWaWV3R3B1Q29udGV4dC5fYXRsYXMpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ0Nhbm5vdCBjYWxsIFZpZXdHcHVDb250ZXh0LnRleHR1cmVBdGxhcyBiZWZvcmUgZGV2aWNlIGlzIHJlc29sdmVkJyk7XG5cdFx0fVxuXHRcdHJldHVybiBWaWV3R3B1Q29udGV4dC5fYXRsYXM7XG5cdH1cblx0LyoqXG5cdCAqIFRoZSBzaGFyZWQgdGV4dHVyZSBhdGxhcyB0byB1c2UgYWNyb3NzIGFsbCB2aWV3cy4gVGhpcyBpcyBhIGNvbnZlbmllbmNlIGFsaWFzIGZvclxuXHQgKiB7QGxpbmsgVmlld0dwdUNvbnRleHQuYXRsYXN9LlxuXHQgKlxuXHQgKiBAdGhyb3dzIGlmIGNhbGxlZCBiZWZvcmUgdGhlIEdQVSBkZXZpY2UgaXMgcmVzb2x2ZWRcblx0ICovXG5cdGdldCBhdGxhcygpOiBUZXh0dXJlQXRsYXMge1xuXHRcdHJldHVybiBWaWV3R3B1Q29udGV4dC5hdGxhcztcblx0fVxuXG5cdHJlYWRvbmx5IGNhbnZhc0RldmljZVBpeGVsRGltZW5zaW9uczogSU9ic2VydmFibGU8eyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9Pjtcblx0cmVhZG9ubHkgZGV2aWNlUGl4ZWxSYXRpbzogSU9ic2VydmFibGU8bnVtYmVyPjtcblx0cmVhZG9ubHkgY29udGVudExlZnQ6IElPYnNlcnZhYmxlPG51bWJlcj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udGV4dDogVmlld0NvbnRleHQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuY2FudmFzID0gY3JlYXRlRmFzdERvbU5vZGUoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJykpO1xuXHRcdHRoaXMuY2FudmFzLnNldENsYXNzTmFtZSgnZWRpdG9yQ2FudmFzJyk7XG5cblx0XHQvLyBBZGp1c3QgdGhlIGNhbnZhcyBzaXplIHRvIGF2b2lkIGRyYXdpbmcgdW5kZXIgdGhlIHNjcm9sbCBiYXJcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IHtcblx0XHRcdGlmICghZSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3Iuc2Nyb2xsYmFyLnZlcnRpY2FsU2Nyb2xsYmFyU2l6ZScpKSB7XG5cdFx0XHRcdGNvbnN0IHZlcnRpY2FsU2Nyb2xsYmFyU2l6ZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElFZGl0b3JPcHRpb25zPignZWRpdG9yJykuc2Nyb2xsYmFyPy52ZXJ0aWNhbFNjcm9sbGJhclNpemUgPz8gMTQ7XG5cdFx0XHRcdHRoaXMuY2FudmFzLmRvbU5vZGUuc3R5bGUuYm94U2l6aW5nID0gJ2JvcmRlci1ib3gnO1xuXHRcdFx0XHR0aGlzLmNhbnZhcy5kb21Ob2RlLnN0eWxlLnBhZGRpbmdSaWdodCA9IGAke3ZlcnRpY2FsU2Nyb2xsYmFyU2l6ZX1weGA7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5jdHggPSBlbnN1cmVOb25OdWxsYWJsZSh0aGlzLmNhbnZhcy5kb21Ob2RlLmdldENvbnRleHQoJ3dlYmdwdScpKTtcblxuXHRcdC8vIFJlcXVlc3QgdGhlIEdQVSBkZXZpY2UsIHdlIG9ubHkgd2FudCB0byBkbyB0aGlzIGEgc2luZ2xlIHRpbWUgcGVyIHdpbmRvdyBhcyBpdCdzIGFzeW5jXG5cdFx0Ly8gYW5kIGNhbiBkZWxheSB0aGUgaW5pdGlhbCByZW5kZXIuXG5cdFx0aWYgKCFWaWV3R3B1Q29udGV4dC5kZXZpY2UpIHtcblx0XHRcdFZpZXdHcHVDb250ZXh0LmRldmljZSA9IEdQVUxpZmVjeWNsZS5yZXF1ZXN0RGV2aWNlKChtZXNzYWdlKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNob2ljZXM6IElQcm9tcHRDaG9pY2VbXSA9IFt7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnZWRpdG9yLmRvbS5yZW5kZXInLCBcIlVzZSBET00tYmFzZWQgcmVuZGVyaW5nXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSgnZWRpdG9yLmV4cGVyaW1lbnRhbEdwdUFjY2VsZXJhdGlvbicsICdvZmYnKSxcblx0XHRcdFx0fV07XG5cdFx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5Lldhcm5pbmcsIG1lc3NhZ2UsIGNob2ljZXMpO1xuXHRcdFx0fSkudGhlbihyZWYgPT4ge1xuXHRcdFx0XHRWaWV3R3B1Q29udGV4dC5kZXZpY2VTeW5jID0gcmVmLm9iamVjdDtcblx0XHRcdFx0aWYgKCFWaWV3R3B1Q29udGV4dC5fYXRsYXMpIHtcblx0XHRcdFx0XHRWaWV3R3B1Q29udGV4dC5fYXRsYXMgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0dXJlQXRsYXMsIHJlZi5vYmplY3QubGltaXRzLm1heFRleHR1cmVEaW1lbnNpb24yRCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVmLm9iamVjdDtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRwck9icyA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCBnZXRBY3RpdmVXaW5kb3coKS5kZXZpY2VQaXhlbFJhdGlvKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIoZ2V0QWN0aXZlV2luZG93KCksICdyZXNpemUnLCAoKSA9PiB7XG5cdFx0XHRkcHJPYnMuc2V0KGdldEFjdGl2ZVdpbmRvdygpLmRldmljZVBpeGVsUmF0aW8sIHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuZGV2aWNlUGl4ZWxSYXRpbyA9IGRwck9icztcblx0XHR0aGlzLl9yZWdpc3RlcihydW5PbkNoYW5nZSh0aGlzLmRldmljZVBpeGVsUmF0aW8sICgpID0+IFZpZXdHcHVDb250ZXh0LmF0bGFzPy5jbGVhcigpKSk7XG5cblx0XHRjb25zdCBjYW52YXNEZXZpY2VQaXhlbERpbWVuc2lvbnMgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgeyB3aWR0aDogdGhpcy5jYW52YXMuZG9tTm9kZS53aWR0aCwgaGVpZ2h0OiB0aGlzLmNhbnZhcy5kb21Ob2RlLmhlaWdodCB9KTtcblx0XHR0aGlzLl9yZWdpc3RlcihvYnNlcnZlRGV2aWNlUGl4ZWxEaW1lbnNpb25zKFxuXHRcdFx0dGhpcy5jYW52YXMuZG9tTm9kZSxcblx0XHRcdGdldEFjdGl2ZVdpbmRvdygpLFxuXHRcdFx0KHdpZHRoLCBoZWlnaHQpID0+IHtcblx0XHRcdFx0dGhpcy5jYW52YXMuZG9tTm9kZS53aWR0aCA9IHdpZHRoO1xuXHRcdFx0XHR0aGlzLmNhbnZhcy5kb21Ob2RlLmhlaWdodCA9IGhlaWdodDtcblx0XHRcdFx0Y2FudmFzRGV2aWNlUGl4ZWxEaW1lbnNpb25zLnNldCh7IHdpZHRoLCBoZWlnaHQgfSwgdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHQpKTtcblx0XHR0aGlzLmNhbnZhc0RldmljZVBpeGVsRGltZW5zaW9ucyA9IGNhbnZhc0RldmljZVBpeGVsRGltZW5zaW9ucztcblxuXHRcdGNvbnN0IGNvbnRlbnRMZWZ0ID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIDApO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0Y29udGVudExlZnQuc2V0KGNvbnRleHQuY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ubGF5b3V0SW5mbykuY29udGVudExlZnQsIHVuZGVmaW5lZCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuY29udGVudExlZnQgPSBjb250ZW50TGVmdDtcblxuXHRcdHRoaXMucmVjdGFuZ2xlUmVuZGVyZXIgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZWN0YW5nbGVSZW5kZXJlciwgY29udGV4dCwgdGhpcy5jb250ZW50TGVmdCwgdGhpcy5kZXZpY2VQaXhlbFJhdGlvLCB0aGlzLmNhbnZhcy5kb21Ob2RlLCB0aGlzLmN0eCwgVmlld0dwdUNvbnRleHQuZGV2aWNlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGlzIG1ldGhvZCBkZXRlcm1pbmVzIHdoaWNoIGxpbmVzIGNhbiBiZSBhbmQgYXJlIGFsbG93ZWQgdG8gYmUgcmVuZGVyZWQgdXNpbmcgdGhlIEdQVVxuXHQgKiByZW5kZXJlci4gRXZlbnR1YWxseSB0aGlzIHNob3VsZCB0cmVuZCBhbGwgbGluZXMsIGV4Y2VwdCBtYXliZSBleGNlcHRpb25hbCBjYXNlcyBsaWtlXG5cdCAqIGRlY29yYXRpb25zIHRoYXQgdXNlIGNsYXNzIG5hbWVzLlxuXHQgKi9cblx0cHVibGljIGNhblJlbmRlcihvcHRpb25zOiBWaWV3TGluZU9wdGlvbnMsIHZpZXdwb3J0RGF0YTogVmlld3BvcnREYXRhLCBsaW5lTnVtYmVyOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRjb25zdCBkYXRhID0gdmlld3BvcnREYXRhLmdldFZpZXdMaW5lUmVuZGVyaW5nRGF0YShsaW5lTnVtYmVyKTtcblxuXHRcdC8vIENoZWNrIGlmIHRoZSBsaW5lIGhhcyBzaW1wbGUgYXR0cmlidXRlcyB0aGF0IGFyZW4ndCBzdXBwb3J0ZWRcblx0XHRpZiAoXG5cdFx0XHRkYXRhLmNvbnRhaW5zUlRMIHx8XG5cdFx0XHRkYXRhLm1heENvbHVtbiA+IHRoaXMubWF4R3B1Q29sc1xuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGlmIGFsbCBpbmxpbmUgZGVjb3JhdGlvbnMgYXJlIHN1cHBvcnRlZFxuXHRcdGlmIChkYXRhLmlubGluZURlY29yYXRpb25zLmxlbmd0aCA+IDApIHtcblx0XHRcdGxldCBzdXBwb3J0ZWQgPSB0cnVlO1xuXHRcdFx0Zm9yIChjb25zdCBkZWNvcmF0aW9uIG9mIGRhdGEuaW5saW5lRGVjb3JhdGlvbnMpIHtcblx0XHRcdFx0aWYgKGRlY29yYXRpb24udHlwZSAhPT0gSW5saW5lRGVjb3JhdGlvblR5cGUuUmVndWxhcikge1xuXHRcdFx0XHRcdHN1cHBvcnRlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHN0eWxlUnVsZXMgPSBWaWV3R3B1Q29udGV4dC5fZGVjb3JhdGlvbkNzc1J1bGVFeHRyYWN0b3IuZ2V0U3R5bGVSdWxlcyh0aGlzLmNhbnZhcy5kb21Ob2RlLCBkZWNvcmF0aW9uLmlubGluZUNsYXNzTmFtZSk7XG5cdFx0XHRcdHN1cHBvcnRlZCAmJj0gc3R5bGVSdWxlcy5ldmVyeShydWxlID0+IHtcblx0XHRcdFx0XHQvLyBQc2V1ZG8gY2xhc3NlcyBhcmVuJ3Qgc3VwcG9ydGVkIGN1cnJlbnRseVxuXHRcdFx0XHRcdGlmIChydWxlLnNlbGVjdG9yVGV4dC5pbmNsdWRlcygnOicpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZvciAoY29uc3QgciBvZiBydWxlLnN0eWxlKSB7XG5cdFx0XHRcdFx0XHRpZiAoIXN1cHBvcnRzQ3NzUnVsZShyLCBydWxlLnN0eWxlKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKCFzdXBwb3J0ZWQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHN1cHBvcnRlZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBMaWtlIHtAbGluayBjYW5SZW5kZXJ9IGJ1dCByZXR1cm5zIGRldGFpbGVkIGluZm9ybWF0aW9uIGFib3V0IHdoeSB0aGUgbGluZSBjYW5ub3QgYmUgcmVuZGVyZWQuXG5cdCAqL1xuXHRwdWJsaWMgY2FuUmVuZGVyRGV0YWlsZWQob3B0aW9uczogVmlld0xpbmVPcHRpb25zLCB2aWV3cG9ydERhdGE6IFZpZXdwb3J0RGF0YSwgbGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IGRhdGEgPSB2aWV3cG9ydERhdGEuZ2V0Vmlld0xpbmVSZW5kZXJpbmdEYXRhKGxpbmVOdW1iZXIpO1xuXHRcdGNvbnN0IHJlYXNvbnM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKGRhdGEuY29udGFpbnNSVEwpIHtcblx0XHRcdHJlYXNvbnMucHVzaCgnY29udGFpbnNSVEwnKTtcblx0XHR9XG5cdFx0aWYgKGRhdGEubWF4Q29sdW1uID4gdGhpcy5tYXhHcHVDb2xzKSB7XG5cdFx0XHRyZWFzb25zLnB1c2goJ21heENvbHVtbiA+IG1heEdwdUNvbHMnKTtcblx0XHR9XG5cdFx0aWYgKGRhdGEuaW5saW5lRGVjb3JhdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0bGV0IHN1cHBvcnRlZCA9IHRydWU7XG5cdFx0XHRjb25zdCBwcm9ibGVtVHlwZXM6IElubGluZURlY29yYXRpb25UeXBlW10gPSBbXTtcblx0XHRcdGNvbnN0IHByb2JsZW1TZWxlY3RvcnM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRjb25zdCBwcm9ibGVtUnVsZXM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGRlY29yYXRpb24gb2YgZGF0YS5pbmxpbmVEZWNvcmF0aW9ucykge1xuXHRcdFx0XHRpZiAoZGVjb3JhdGlvbi50eXBlICE9PSBJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyKSB7XG5cdFx0XHRcdFx0cHJvYmxlbVR5cGVzLnB1c2goZGVjb3JhdGlvbi50eXBlKTtcblx0XHRcdFx0XHRzdXBwb3J0ZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBzdHlsZVJ1bGVzID0gVmlld0dwdUNvbnRleHQuX2RlY29yYXRpb25Dc3NSdWxlRXh0cmFjdG9yLmdldFN0eWxlUnVsZXModGhpcy5jYW52YXMuZG9tTm9kZSwgZGVjb3JhdGlvbi5pbmxpbmVDbGFzc05hbWUpO1xuXHRcdFx0XHRzdXBwb3J0ZWQgJiY9IHN0eWxlUnVsZXMuZXZlcnkocnVsZSA9PiB7XG5cdFx0XHRcdFx0Ly8gUHNldWRvIGNsYXNzZXMgYXJlbid0IHN1cHBvcnRlZCBjdXJyZW50bHlcblx0XHRcdFx0XHRpZiAocnVsZS5zZWxlY3RvclRleHQuaW5jbHVkZXMoJzonKSkge1xuXHRcdFx0XHRcdFx0cHJvYmxlbVNlbGVjdG9ycy5wdXNoKHJ1bGUuc2VsZWN0b3JUZXh0KTtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Zm9yIChjb25zdCByIG9mIHJ1bGUuc3R5bGUpIHtcblx0XHRcdFx0XHRcdGlmICghc3VwcG9ydHNDc3NSdWxlKHIsIHJ1bGUuc3R5bGUpKSB7XG5cdFx0XHRcdFx0XHRcdHByb2JsZW1SdWxlcy5wdXNoKGAke3J9OiAke3J1bGUuc3R5bGVbciBhcyBhbnldfWApO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKCFzdXBwb3J0ZWQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHByb2JsZW1UeXBlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHJlYXNvbnMucHVzaChgaW5saW5lRGVjb3JhdGlvbnMgd2l0aCB1bnN1cHBvcnRlZCB0eXBlcyAoJHtwcm9ibGVtVHlwZXMubWFwKGUgPT4gYFxcYCR7ZX1cXGBgKS5qb2luKCcsICcpfSlgKTtcblx0XHRcdH1cblx0XHRcdGlmIChwcm9ibGVtUnVsZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZWFzb25zLnB1c2goYGlubGluZURlY29yYXRpb25zIHdpdGggdW5zdXBwb3J0ZWQgQ1NTIHJ1bGVzICgke3Byb2JsZW1SdWxlcy5tYXAoZSA9PiBgXFxgJHtlfVxcYGApLmpvaW4oJywgJyl9KWApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHByb2JsZW1TZWxlY3RvcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZWFzb25zLnB1c2goYGlubGluZURlY29yYXRpb25zIHdpdGggdW5zdXBwb3J0ZWQgQ1NTIHNlbGVjdG9ycyAoJHtwcm9ibGVtU2VsZWN0b3JzLm1hcChlID0+IGBcXGAke2V9XFxgYCkuam9pbignLCAnKX0pYCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZWFzb25zO1xuXHR9XG59XG5cbi8qKlxuICogQSBsaXN0IG9mIHN1cHBvcnRlZCBkZWNvcmF0aW9uIENTUyBydWxlcyB0aGF0IGNhbiBiZSB1c2VkIGluIHRoZSBHUFUgcmVuZGVyZXIuXG4gKi9cbmNvbnN0IGdwdVN1cHBvcnRlZERlY29yYXRpb25Dc3NSdWxlcyA9IFtcblx0J2NvbG9yJyxcblx0J2ZvbnQtd2VpZ2h0Jyxcblx0J29wYWNpdHknLFxuXTtcblxuZnVuY3Rpb24gc3VwcG9ydHNDc3NSdWxlKHJ1bGU6IHN0cmluZywgc3R5bGU6IENTU1N0eWxlRGVjbGFyYXRpb24pIHtcblx0aWYgKCFncHVTdXBwb3J0ZWREZWNvcmF0aW9uQ3NzUnVsZXMuaW5jbHVkZXMocnVsZSkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Ly8gQ2hlY2sgZm9yIHZhbHVlcyB0aGF0IGFyZW4ndCBzdXBwb3J0ZWRcblx0c3dpdGNoIChydWxlKSB7XG5cdFx0ZGVmYXVsdDogcmV0dXJuIHRydWU7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsdUJBQXVCLHVCQUF1QjtBQUN2RCxTQUFTLHlCQUEyQztBQUNwRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGtCQUFrQjtBQUczQixTQUFTLGlCQUFpQixtQkFBcUM7QUFDL0QsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBcUMsZ0JBQWdCO0FBQzlELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsbUJBQW1CLG9DQUFvQztBQUNoRSxTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxvQkFBeUM7QUFDbEQsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw4QkFBOEI7QUFFaEMsSUFBTSxpQkFBTixjQUE2QixXQUFXO0FBQUEsRUFtRDlDLFlBQ0MsU0FDd0MsdUJBQ0Qsc0JBQ0Msc0JBQ3ZDO0FBQ0QsVUFBTTtBQUprQztBQUNEO0FBQ0M7QUFuRHpDO0FBQUE7QUFBQTtBQUFBLFNBQVMsYUFBYSx1QkFBdUI7QUF1RDVDLFNBQUssU0FBUyxrQkFBa0IsU0FBUyxjQUFjLFFBQVEsQ0FBQztBQUNoRSxTQUFLLE9BQU8sYUFBYSxjQUFjO0FBR3ZDLFNBQUssVUFBVSxNQUFNLGdCQUFnQixxQkFBcUIsMEJBQTBCLE9BQUs7QUFDeEYsVUFBSSxDQUFDLEtBQUssRUFBRSxxQkFBcUIsd0NBQXdDLEdBQUc7QUFDM0UsY0FBTSx3QkFBd0IscUJBQXFCLFNBQXlCLFFBQVEsRUFBRSxXQUFXLHlCQUF5QjtBQUMxSCxhQUFLLE9BQU8sUUFBUSxNQUFNLFlBQVk7QUFDdEMsYUFBSyxPQUFPLFFBQVEsTUFBTSxlQUFlLEdBQUcscUJBQXFCO0FBQUEsTUFDbEU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssTUFBTSxrQkFBa0IsS0FBSyxPQUFPLFFBQVEsV0FBVyxRQUFRLENBQUM7QUFJckUsUUFBSSxDQUFDLGVBQWUsUUFBUTtBQUMzQixxQkFBZSxTQUFTLGFBQWEsY0FBYyxDQUFDLFlBQVk7QUFDL0QsY0FBTSxVQUEyQixDQUFDO0FBQUEsVUFDakMsT0FBTyxJQUFJLFNBQVMscUJBQXFCLHlCQUF5QjtBQUFBLFVBQ2xFLEtBQUssTUFBTSxLQUFLLHFCQUFxQixZQUFZLHNDQUFzQyxLQUFLO0FBQUEsUUFDN0YsQ0FBQztBQUNELGFBQUsscUJBQXFCLE9BQU8sU0FBUyxTQUFTLFNBQVMsT0FBTztBQUFBLE1BQ3BFLENBQUMsRUFBRSxLQUFLLFNBQU87QUFDZCx1QkFBZSxhQUFhLElBQUk7QUFDaEMsWUFBSSxDQUFDLGVBQWUsUUFBUTtBQUMzQix5QkFBZSxTQUFTLEtBQUssc0JBQXNCLGVBQWUsY0FBYyxJQUFJLE9BQU8sT0FBTyx1QkFBdUIsTUFBUztBQUFBLFFBQ25JO0FBQ0EsZUFBTyxJQUFJO0FBQUEsTUFDWixDQUFDO0FBQUEsSUFDRjtBQUVBLFVBQU0sU0FBUyxnQkFBZ0IsTUFBTSxnQkFBZ0IsRUFBRSxnQkFBZ0I7QUFDdkUsU0FBSyxVQUFVLHNCQUFzQixnQkFBZ0IsR0FBRyxVQUFVLE1BQU07QUFDdkUsYUFBTyxJQUFJLGdCQUFnQixFQUFFLGtCQUFrQixNQUFTO0FBQUEsSUFDekQsQ0FBQyxDQUFDO0FBQ0YsU0FBSyxtQkFBbUI7QUFDeEIsU0FBSyxVQUFVLFlBQVksS0FBSyxrQkFBa0IsTUFBTSxlQUFlLE9BQU8sTUFBTSxDQUFDLENBQUM7QUFFdEYsVUFBTSw4QkFBOEIsZ0JBQWdCLE1BQU0sRUFBRSxPQUFPLEtBQUssT0FBTyxRQUFRLE9BQU8sUUFBUSxLQUFLLE9BQU8sUUFBUSxPQUFPLENBQUM7QUFDbEksU0FBSyxVQUFVO0FBQUEsTUFDZCxLQUFLLE9BQU87QUFBQSxNQUNaLGdCQUFnQjtBQUFBLE1BQ2hCLENBQUMsT0FBTyxXQUFXO0FBQ2xCLGFBQUssT0FBTyxRQUFRLFFBQVE7QUFDNUIsYUFBSyxPQUFPLFFBQVEsU0FBUztBQUM3QixvQ0FBNEIsSUFBSSxFQUFFLE9BQU8sT0FBTyxHQUFHLE1BQVM7QUFBQSxNQUM3RDtBQUFBLElBQ0QsQ0FBQztBQUNELFNBQUssOEJBQThCO0FBRW5DLFVBQU0sY0FBYyxnQkFBZ0IsTUFBTSxDQUFDO0FBQzNDLFNBQUssVUFBVSxLQUFLLHFCQUFxQix5QkFBeUIsT0FBSztBQUN0RSxrQkFBWSxJQUFJLFFBQVEsY0FBYyxRQUFRLElBQUksYUFBYSxVQUFVLEVBQUUsYUFBYSxNQUFTO0FBQUEsSUFDbEcsQ0FBQyxDQUFDO0FBQ0YsU0FBSyxjQUFjO0FBRW5CLFNBQUssb0JBQW9CLEtBQUssc0JBQXNCLGVBQWUsbUJBQW1CLFNBQVMsS0FBSyxhQUFhLEtBQUssa0JBQWtCLEtBQUssT0FBTyxTQUFTLEtBQUssS0FBSyxlQUFlLE1BQU07QUFBQSxFQUM3TDtBQUFBLEVBdEdBLFdBQVcsNkJBQXlEO0FBQ25FLFdBQU8sZUFBZTtBQUFBLEVBQ3ZCO0FBQUEsRUFHQSxXQUFXLHVCQUE2QztBQUN2RCxXQUFPLGVBQWU7QUFBQSxFQUN2QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVNBLFdBQVcsUUFBc0I7QUFDaEMsUUFBSSxDQUFDLGVBQWUsUUFBUTtBQUMzQixZQUFNLElBQUksbUJBQW1CLG1FQUFtRTtBQUFBLElBQ2pHO0FBQ0EsV0FBTyxlQUFlO0FBQUEsRUFDdkI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9BLElBQUksUUFBc0I7QUFDekIsV0FBTyxlQUFlO0FBQUEsRUFDdkI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUErRU8sVUFBVSxTQUEwQixjQUE0QixZQUE2QjtBQUNuRyxVQUFNLE9BQU8sYUFBYSx5QkFBeUIsVUFBVTtBQUc3RCxRQUNDLEtBQUssZUFDTCxLQUFLLFlBQVksS0FBSyxZQUNyQjtBQUNELGFBQU87QUFBQSxJQUNSO0FBR0EsUUFBSSxLQUFLLGtCQUFrQixTQUFTLEdBQUc7QUFDdEMsVUFBSSxZQUFZO0FBQ2hCLGlCQUFXLGNBQWMsS0FBSyxtQkFBbUI7QUFDaEQsWUFBSSxXQUFXLFNBQVMscUJBQXFCLFNBQVM7QUFDckQsc0JBQVk7QUFDWjtBQUFBLFFBQ0Q7QUFDQSxjQUFNLGFBQWEsZUFBZSw0QkFBNEIsY0FBYyxLQUFLLE9BQU8sU0FBUyxXQUFXLGVBQWU7QUFDM0gsc0JBQWMsV0FBVyxNQUFNLFVBQVE7QUFFdEMsY0FBSSxLQUFLLGFBQWEsU0FBUyxHQUFHLEdBQUc7QUFDcEMsbUJBQU87QUFBQSxVQUNSO0FBQ0EscUJBQVcsS0FBSyxLQUFLLE9BQU87QUFDM0IsZ0JBQUksQ0FBQyxnQkFBZ0IsR0FBRyxLQUFLLEtBQUssR0FBRztBQUNwQyxxQkFBTztBQUFBLFlBQ1I7QUFBQSxVQUNEO0FBQ0EsaUJBQU87QUFBQSxRQUNSLENBQUM7QUFDRCxZQUFJLENBQUMsV0FBVztBQUNmO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLTyxrQkFBa0IsU0FBMEIsY0FBNEIsWUFBOEI7QUFDNUcsVUFBTSxPQUFPLGFBQWEseUJBQXlCLFVBQVU7QUFDN0QsVUFBTSxVQUFvQixDQUFDO0FBQzNCLFFBQUksS0FBSyxhQUFhO0FBQ3JCLGNBQVEsS0FBSyxhQUFhO0FBQUEsSUFDM0I7QUFDQSxRQUFJLEtBQUssWUFBWSxLQUFLLFlBQVk7QUFDckMsY0FBUSxLQUFLLHdCQUF3QjtBQUFBLElBQ3RDO0FBQ0EsUUFBSSxLQUFLLGtCQUFrQixTQUFTLEdBQUc7QUFDdEMsVUFBSSxZQUFZO0FBQ2hCLFlBQU0sZUFBdUMsQ0FBQztBQUM5QyxZQUFNLG1CQUE2QixDQUFDO0FBQ3BDLFlBQU0sZUFBeUIsQ0FBQztBQUNoQyxpQkFBVyxjQUFjLEtBQUssbUJBQW1CO0FBQ2hELFlBQUksV0FBVyxTQUFTLHFCQUFxQixTQUFTO0FBQ3JELHVCQUFhLEtBQUssV0FBVyxJQUFJO0FBQ2pDLHNCQUFZO0FBQ1o7QUFBQSxRQUNEO0FBQ0EsY0FBTSxhQUFhLGVBQWUsNEJBQTRCLGNBQWMsS0FBSyxPQUFPLFNBQVMsV0FBVyxlQUFlO0FBQzNILHNCQUFjLFdBQVcsTUFBTSxVQUFRO0FBRXRDLGNBQUksS0FBSyxhQUFhLFNBQVMsR0FBRyxHQUFHO0FBQ3BDLDZCQUFpQixLQUFLLEtBQUssWUFBWTtBQUN2QyxtQkFBTztBQUFBLFVBQ1I7QUFDQSxxQkFBVyxLQUFLLEtBQUssT0FBTztBQUMzQixnQkFBSSxDQUFDLGdCQUFnQixHQUFHLEtBQUssS0FBSyxHQUFHO0FBQ3BDLDJCQUFhLEtBQUssR0FBRyxDQUFDLEtBQUssS0FBSyxNQUFNLENBQVEsQ0FBQyxFQUFFO0FBQ2pELHFCQUFPO0FBQUEsWUFDUjtBQUFBLFVBQ0Q7QUFDQSxpQkFBTztBQUFBLFFBQ1IsQ0FBQztBQUNELFlBQUksQ0FBQyxXQUFXO0FBQ2Y7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUNBLFVBQUksYUFBYSxTQUFTLEdBQUc7QUFDNUIsZ0JBQVEsS0FBSyw2Q0FBNkMsYUFBYSxJQUFJLE9BQUssS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHO0FBQUEsTUFDMUc7QUFDQSxVQUFJLGFBQWEsU0FBUyxHQUFHO0FBQzVCLGdCQUFRLEtBQUssaURBQWlELGFBQWEsSUFBSSxPQUFLLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRztBQUFBLE1BQzlHO0FBQ0EsVUFBSSxpQkFBaUIsU0FBUyxHQUFHO0FBQ2hDLGdCQUFRLEtBQUsscURBQXFELGlCQUFpQixJQUFJLE9BQUssS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHO0FBQUEsTUFDdEg7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQTVOYSxlQWNZLDhCQUE4QixJQUFJLDJCQUEyQjtBQWR6RSxlQW1CWSx3QkFBd0IsSUFBSSxxQkFBcUI7QUFuQjdELGlCQUFOO0FBQUEsRUFxREo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBdkRVO0FBaU9iLE1BQU0saUNBQWlDO0FBQUEsRUFDdEM7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUNEO0FBRUEsU0FBUyxnQkFBZ0IsTUFBYyxPQUE0QjtBQUNsRSxNQUFJLENBQUMsK0JBQStCLFNBQVMsSUFBSSxHQUFHO0FBQ25ELFdBQU87QUFBQSxFQUNSO0FBRUEsVUFBUSxNQUFNO0FBQUEsSUFDYjtBQUFTLGFBQU87QUFBQSxFQUNqQjtBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
