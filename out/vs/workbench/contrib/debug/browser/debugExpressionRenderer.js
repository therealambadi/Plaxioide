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
import * as dom from "../../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { Expression, ExpressionContainer, Variable } from "../common/debugModel.js";
import { ReplEvaluationResult } from "../common/replModel.js";
import { splitExpressionOrScopeHighlights } from "./baseDebugView.js";
import { handleANSIOutput } from "./debugANSIHandling.js";
import { COPY_EVALUATE_PATH_ID, COPY_VALUE_ID } from "./debugCommands.js";
import { DebugLinkHoverBehavior, LinkDetector } from "./linkDetector.js";
const MAX_VALUE_RENDER_LENGTH_IN_VIEWLET = 1024;
const booleanRegex = /^(true|false)$/i;
const stringRegex = /^(['"]).*\1$/;
var Cls = /* @__PURE__ */ ((Cls2) => {
  Cls2["Value"] = "value";
  Cls2["Unavailable"] = "unavailable";
  Cls2["Error"] = "error";
  Cls2["Changed"] = "changed";
  Cls2["Boolean"] = "boolean";
  Cls2["String"] = "string";
  Cls2["Number"] = "number";
  return Cls2;
})(Cls || {});
const allClasses = Object.keys({
  ["value" /* Value */]: 0,
  ["unavailable" /* Unavailable */]: 0,
  ["error" /* Error */]: 0,
  ["changed" /* Changed */]: 0,
  ["boolean" /* Boolean */]: 0,
  ["string" /* String */]: 0,
  ["number" /* Number */]: 0
});
let DebugExpressionRenderer = class {
  constructor(commandService, configurationService, instantiationService, hoverService) {
    this.commandService = commandService;
    this.hoverService = hoverService;
    this.linkDetector = instantiationService.createInstance(LinkDetector);
    this.displayType = observableConfigValue("debug.showVariableTypes", false, configurationService);
  }
  renderVariable(data, variable, options = {}) {
    const displayType = this.displayType.get();
    const highlights = splitExpressionOrScopeHighlights(variable, options.highlights || []);
    if (variable.available) {
      data.type.textContent = "";
      let text = variable.name;
      if (variable.value && typeof variable.name === "string") {
        if (variable.type && displayType) {
          text += ": ";
          data.type.textContent = variable.type + " =";
        } else {
          text += " =";
        }
      }
      data.label.set(text, highlights.name, variable.type && !displayType ? variable.type : variable.name);
      data.name.classList.toggle("virtual", variable.presentationHint?.kind === "virtual");
      data.name.classList.toggle("internal", variable.presentationHint?.visibility === "internal");
    } else if (variable.value && typeof variable.name === "string" && variable.name) {
      data.label.set(":");
    }
    data.expression.classList.toggle("lazy", !!variable.presentationHint?.lazy);
    const commands = [
      { id: COPY_VALUE_ID, args: [variable, [variable]] }
    ];
    if (variable.evaluateName) {
      commands.push({ id: COPY_EVALUATE_PATH_ID, args: [{ variable }] });
    }
    return this.renderValue(data.value, variable, {
      showChanged: options.showChanged,
      maxValueLength: MAX_VALUE_RENDER_LENGTH_IN_VIEWLET,
      hover: { commands },
      highlights: highlights.value,
      colorize: true,
      session: variable.getSession()
    });
  }
  renderValue(container, expressionOrValue, options = {}) {
    const store = new DisposableStore();
    const supportsANSI = options.session?.rememberedCapabilities?.supportsANSIStyling ?? options.wasANSI ?? false;
    let value = typeof expressionOrValue === "string" ? expressionOrValue : expressionOrValue.value;
    for (const cls of allClasses) {
      container.classList.remove(cls);
    }
    container.classList.add("value" /* Value */);
    if (value === null || (expressionOrValue instanceof Expression || expressionOrValue instanceof Variable || expressionOrValue instanceof ReplEvaluationResult) && !expressionOrValue.available) {
      container.classList.add("unavailable" /* Unavailable */);
      if (value !== Expression.DEFAULT_VALUE) {
        container.classList.add("error" /* Error */);
      }
    } else {
      if (typeof expressionOrValue !== "string" && options.showChanged && expressionOrValue.valueChanged && value !== Expression.DEFAULT_VALUE) {
        container.classList.add("changed" /* Changed */);
        expressionOrValue.valueChanged = false;
      }
      if (options.colorize && typeof expressionOrValue !== "string") {
        if (expressionOrValue.type === "number" || expressionOrValue.type === "boolean" || expressionOrValue.type === "string") {
          container.classList.add(expressionOrValue.type);
        } else if (!isNaN(+value)) {
          container.classList.add("number" /* Number */);
        } else if (booleanRegex.test(value)) {
          container.classList.add("boolean" /* Boolean */);
        } else if (stringRegex.test(value)) {
          container.classList.add("string" /* String */);
        }
      }
    }
    if (options.maxValueLength && value && value.length > options.maxValueLength) {
      value = value.substring(0, options.maxValueLength) + "...";
    }
    if (!value) {
      value = "";
    }
    const session = options.session ?? (expressionOrValue instanceof ExpressionContainer ? expressionOrValue.getSession() : void 0);
    const hoverBehavior = options.hover === false ? { type: DebugLinkHoverBehavior.Rich, store } : { type: DebugLinkHoverBehavior.None };
    dom.clearNode(container);
    const locationReference = options.locationReference ?? (expressionOrValue instanceof ExpressionContainer && expressionOrValue.valueLocationReference);
    let linkDetector = this.linkDetector;
    if (locationReference && session) {
      linkDetector = this.linkDetector.makeReferencedLinkDetector(locationReference, session);
    }
    if (supportsANSI) {
      container.appendChild(handleANSIOutput(value, linkDetector, session ? session.root : void 0, options.highlights));
    } else {
      container.appendChild(linkDetector.linkify(value, false, session?.root, true, hoverBehavior, options.highlights));
    }
    if (options.hover !== false) {
      const { commands = [] } = options.hover || {};
      store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), container, () => {
        const container2 = dom.$("div");
        const markdownHoverElement = dom.$("div.hover-row");
        const hoverContentsElement = dom.append(markdownHoverElement, dom.$("div.hover-contents"));
        const hoverContentsPre = dom.append(hoverContentsElement, dom.$("pre.debug-var-hover-pre"));
        if (supportsANSI) {
          hoverContentsPre.appendChild(handleANSIOutput(value, this.linkDetector, session ? session.root : void 0, options.highlights));
        } else {
          hoverContentsPre.textContent = value;
        }
        container2.appendChild(markdownHoverElement);
        return container2;
      }, {
        actions: commands.map(({ id, args }) => {
          const description = CommandsRegistry.getCommand(id)?.metadata?.description;
          return {
            label: typeof description === "string" ? description : description ? description.value : id,
            commandId: id,
            run: () => this.commandService.executeCommand(id, ...args)
          };
        })
      }));
    }
    return store;
  }
};
DebugExpressionRenderer = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IHoverService)
], DebugExpressionRenderer);
export {
  DebugExpressionRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnRXhwcmVzc2lvblJlbmRlcmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUhpZ2hsaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9oaWdobGlnaHRlZGxhYmVsL2hpZ2hsaWdodGVkTGFiZWwuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlQ29uZmlnVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vYnNlcnZhYmxlL2NvbW1vbi9wbGF0Zm9ybU9ic2VydmFibGVVdGlscy5qcyc7XG5pbXBvcnQgeyBJRGVidWdTZXNzaW9uLCBJRXhwcmVzc2lvblZhbHVlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IEV4cHJlc3Npb24sIEV4cHJlc3Npb25Db250YWluZXIsIFZhcmlhYmxlIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnTW9kZWwuanMnO1xuaW1wb3J0IHsgUmVwbEV2YWx1YXRpb25SZXN1bHQgfSBmcm9tICcuLi9jb21tb24vcmVwbE1vZGVsLmpzJztcbmltcG9ydCB7IElWYXJpYWJsZVRlbXBsYXRlRGF0YSwgc3BsaXRFeHByZXNzaW9uT3JTY29wZUhpZ2hsaWdodHMgfSBmcm9tICcuL2Jhc2VEZWJ1Z1ZpZXcuanMnO1xuaW1wb3J0IHsgaGFuZGxlQU5TSU91dHB1dCB9IGZyb20gJy4vZGVidWdBTlNJSGFuZGxpbmcuanMnO1xuaW1wb3J0IHsgQ09QWV9FVkFMVUFURV9QQVRIX0lELCBDT1BZX1ZBTFVFX0lEIH0gZnJvbSAnLi9kZWJ1Z0NvbW1hbmRzLmpzJztcbmltcG9ydCB7IERlYnVnTGlua0hvdmVyQmVoYXZpb3IsIERlYnVnTGlua0hvdmVyQmVoYXZpb3JUeXBlRGF0YSwgSUxpbmtEZXRlY3RvciwgTGlua0RldGVjdG9yIH0gZnJvbSAnLi9saW5rRGV0ZWN0b3IuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElWYWx1ZUhvdmVyT3B0aW9ucyB7XG5cdC8qKiBDb21tYW5kcyB0byBzaG93IGluIHRoZSBob3ZlciBmb290ZXIuICovXG5cdGNvbW1hbmRzPzogeyBpZDogc3RyaW5nOyBhcmdzOiB1bmtub3duW10gfVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZW5kZXJWYWx1ZU9wdGlvbnMge1xuXHRzaG93Q2hhbmdlZD86IGJvb2xlYW47XG5cdG1heFZhbHVlTGVuZ3RoPzogbnVtYmVyO1xuXHQvKiogSWYgbm90IGZhbHNlLCBhIHJpY2ggaG92ZXIgd2lsbCBiZSBzaG93biBvbiB0aGUgZWxlbWVudC4gKi9cblx0aG92ZXI/OiBmYWxzZSB8IElWYWx1ZUhvdmVyT3B0aW9ucztcblx0Y29sb3JpemU/OiBib29sZWFuO1xuXHRoaWdobGlnaHRzPzogSUhpZ2hsaWdodFtdO1xuXG5cdC8qKlxuXHQgKiBJbmRpY2F0ZXMgYXJlYXMgd2hlcmUgVlMgQ29kZSBpbXBsaWNpdGx5IGFsd2F5cyBzdXBwb3J0ZWQgQU5TSSBlc2NhcGVcblx0ICogc2VxdWVuY2VzLiBUaGVzZSBzaG91bGQgYmUgcmVuZGVyZWQgYXMgQU5TSSB3aGVuIHRoZSBEQSBkb2VzIG5vdCBzcGVjaWZ5XG5cdCAqIGFueSB2YWx1ZSBvZiBgc3VwcG9ydHNBTlNJU3R5bGluZ2AuXG5cdCAqIEBkZXByZWNhdGVkXG5cdCAqL1xuXHR3YXNBTlNJPzogYm9vbGVhbjtcblx0c2Vzc2lvbj86IElEZWJ1Z1Nlc3Npb247XG5cdGxvY2F0aW9uUmVmZXJlbmNlPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZW5kZXJWYXJpYWJsZU9wdGlvbnMge1xuXHRzaG93Q2hhbmdlZD86IGJvb2xlYW47XG5cdGhpZ2hsaWdodHM/OiBJSGlnaGxpZ2h0W107XG59XG5cblxuY29uc3QgTUFYX1ZBTFVFX1JFTkRFUl9MRU5HVEhfSU5fVklFV0xFVCA9IDEwMjQ7XG5jb25zdCBib29sZWFuUmVnZXggPSAvXih0cnVlfGZhbHNlKSQvaTtcbmNvbnN0IHN0cmluZ1JlZ2V4ID0gL14oWydcIl0pLipcXDEkLztcblxuY29uc3QgZW51bSBDbHMge1xuXHRWYWx1ZSA9ICd2YWx1ZScsXG5cdFVuYXZhaWxhYmxlID0gJ3VuYXZhaWxhYmxlJyxcblx0RXJyb3IgPSAnZXJyb3InLFxuXHRDaGFuZ2VkID0gJ2NoYW5nZWQnLFxuXHRCb29sZWFuID0gJ2Jvb2xlYW4nLFxuXHRTdHJpbmcgPSAnc3RyaW5nJyxcblx0TnVtYmVyID0gJ251bWJlcicsXG59XG5cbmNvbnN0IGFsbENsYXNzZXM6IHJlYWRvbmx5IENsc1tdID0gT2JqZWN0LmtleXMoe1xuXHRbQ2xzLlZhbHVlXTogMCxcblx0W0Nscy5VbmF2YWlsYWJsZV06IDAsXG5cdFtDbHMuRXJyb3JdOiAwLFxuXHRbQ2xzLkNoYW5nZWRdOiAwLFxuXHRbQ2xzLkJvb2xlYW5dOiAwLFxuXHRbQ2xzLlN0cmluZ106IDAsXG5cdFtDbHMuTnVtYmVyXTogMCxcbn0gc2F0aXNmaWVzIHsgW2tleSBpbiBDbHNdOiB1bmtub3duIH0pIGFzIENsc1tdO1xuXG5leHBvcnQgY2xhc3MgRGVidWdFeHByZXNzaW9uUmVuZGVyZXIge1xuXHRwcml2YXRlIGRpc3BsYXlUeXBlOiBJT2JzZXJ2YWJsZTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBsaW5rRGV0ZWN0b3I6IExpbmtEZXRlY3RvcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLmxpbmtEZXRlY3RvciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExpbmtEZXRlY3Rvcik7XG5cdFx0dGhpcy5kaXNwbGF5VHlwZSA9IG9ic2VydmFibGVDb25maWdWYWx1ZSgnZGVidWcuc2hvd1ZhcmlhYmxlVHlwZXMnLCBmYWxzZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHR9XG5cblx0cmVuZGVyVmFyaWFibGUoZGF0YTogSVZhcmlhYmxlVGVtcGxhdGVEYXRhLCB2YXJpYWJsZTogVmFyaWFibGUsIG9wdGlvbnM6IElSZW5kZXJWYXJpYWJsZU9wdGlvbnMgPSB7fSk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBkaXNwbGF5VHlwZSA9IHRoaXMuZGlzcGxheVR5cGUuZ2V0KCk7XG5cdFx0Y29uc3QgaGlnaGxpZ2h0cyA9IHNwbGl0RXhwcmVzc2lvbk9yU2NvcGVIaWdobGlnaHRzKHZhcmlhYmxlLCBvcHRpb25zLmhpZ2hsaWdodHMgfHwgW10pO1xuXG5cdFx0aWYgKHZhcmlhYmxlLmF2YWlsYWJsZSkge1xuXHRcdFx0ZGF0YS50eXBlLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRsZXQgdGV4dCA9IHZhcmlhYmxlLm5hbWU7XG5cdFx0XHRpZiAodmFyaWFibGUudmFsdWUgJiYgdHlwZW9mIHZhcmlhYmxlLm5hbWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGlmICh2YXJpYWJsZS50eXBlICYmIGRpc3BsYXlUeXBlKSB7XG5cdFx0XHRcdFx0dGV4dCArPSAnOiAnO1xuXHRcdFx0XHRcdGRhdGEudHlwZS50ZXh0Q29udGVudCA9IHZhcmlhYmxlLnR5cGUgKyAnID0nO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRleHQgKz0gJyA9Jztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRkYXRhLmxhYmVsLnNldCh0ZXh0LCBoaWdobGlnaHRzLm5hbWUsIHZhcmlhYmxlLnR5cGUgJiYgIWRpc3BsYXlUeXBlID8gdmFyaWFibGUudHlwZSA6IHZhcmlhYmxlLm5hbWUpO1xuXHRcdFx0ZGF0YS5uYW1lLmNsYXNzTGlzdC50b2dnbGUoJ3ZpcnR1YWwnLCB2YXJpYWJsZS5wcmVzZW50YXRpb25IaW50Py5raW5kID09PSAndmlydHVhbCcpO1xuXHRcdFx0ZGF0YS5uYW1lLmNsYXNzTGlzdC50b2dnbGUoJ2ludGVybmFsJywgdmFyaWFibGUucHJlc2VudGF0aW9uSGludD8udmlzaWJpbGl0eSA9PT0gJ2ludGVybmFsJyk7XG5cdFx0fSBlbHNlIGlmICh2YXJpYWJsZS52YWx1ZSAmJiB0eXBlb2YgdmFyaWFibGUubmFtZSA9PT0gJ3N0cmluZycgJiYgdmFyaWFibGUubmFtZSkge1xuXHRcdFx0ZGF0YS5sYWJlbC5zZXQoJzonKTtcblx0XHR9XG5cblx0XHRkYXRhLmV4cHJlc3Npb24uY2xhc3NMaXN0LnRvZ2dsZSgnbGF6eScsICEhdmFyaWFibGUucHJlc2VudGF0aW9uSGludD8ubGF6eSk7XG5cdFx0Y29uc3QgY29tbWFuZHMgPSBbXG5cdFx0XHR7IGlkOiBDT1BZX1ZBTFVFX0lELCBhcmdzOiBbdmFyaWFibGUsIFt2YXJpYWJsZV1dIGFzIHVua25vd25bXSB9XG5cdFx0XTtcblx0XHRpZiAodmFyaWFibGUuZXZhbHVhdGVOYW1lKSB7XG5cdFx0XHRjb21tYW5kcy5wdXNoKHsgaWQ6IENPUFlfRVZBTFVBVEVfUEFUSF9JRCwgYXJnczogW3sgdmFyaWFibGUgfV0gfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucmVuZGVyVmFsdWUoZGF0YS52YWx1ZSwgdmFyaWFibGUsIHtcblx0XHRcdHNob3dDaGFuZ2VkOiBvcHRpb25zLnNob3dDaGFuZ2VkLFxuXHRcdFx0bWF4VmFsdWVMZW5ndGg6IE1BWF9WQUxVRV9SRU5ERVJfTEVOR1RIX0lOX1ZJRVdMRVQsXG5cdFx0XHRob3ZlcjogeyBjb21tYW5kcyB9LFxuXHRcdFx0aGlnaGxpZ2h0czogaGlnaGxpZ2h0cy52YWx1ZSxcblx0XHRcdGNvbG9yaXplOiB0cnVlLFxuXHRcdFx0c2Vzc2lvbjogdmFyaWFibGUuZ2V0U2Vzc2lvbigpLFxuXHRcdH0pO1xuXHR9XG5cblx0cmVuZGVyVmFsdWUoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZXhwcmVzc2lvbk9yVmFsdWU6IElFeHByZXNzaW9uVmFsdWUgfCBzdHJpbmcsIG9wdGlvbnM6IElSZW5kZXJWYWx1ZU9wdGlvbnMgPSB7fSk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHQvLyBVc2UgcmVtZW1iZXJlZCBjYXBhYmlsaXRpZXMgc28gUkVQTCBlbGVtZW50cyBjYW4gcmVuZGVyIGV2ZW4gb25jZSBhIHNlc3Npb24gZW5kc1xuXHRcdGNvbnN0IHN1cHBvcnRzQU5TSTogYm9vbGVhbiA9IG9wdGlvbnMuc2Vzc2lvbj8ucmVtZW1iZXJlZENhcGFiaWxpdGllcz8uc3VwcG9ydHNBTlNJU3R5bGluZyA/PyBvcHRpb25zLndhc0FOU0kgPz8gZmFsc2U7XG5cblx0XHRsZXQgdmFsdWUgPSB0eXBlb2YgZXhwcmVzc2lvbk9yVmFsdWUgPT09ICdzdHJpbmcnID8gZXhwcmVzc2lvbk9yVmFsdWUgOiBleHByZXNzaW9uT3JWYWx1ZS52YWx1ZTtcblxuXHRcdC8vIHJlbW92ZSBzdGFsZSBjbGFzc2VzXG5cdFx0Zm9yIChjb25zdCBjbHMgb2YgYWxsQ2xhc3Nlcykge1xuXHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoY2xzKTtcblx0XHR9XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoQ2xzLlZhbHVlKTtcblx0XHQvLyB3aGVuIHJlc29sdmluZyBleHByZXNzaW9ucyB3ZSByZXByZXNlbnQgZXJyb3JzIGZyb20gdGhlIHNlcnZlciBhcyBhIHZhcmlhYmxlIHdpdGggbmFtZSA9PT0gbnVsbC5cblx0XHRpZiAodmFsdWUgPT09IG51bGwgfHwgKChleHByZXNzaW9uT3JWYWx1ZSBpbnN0YW5jZW9mIEV4cHJlc3Npb24gfHwgZXhwcmVzc2lvbk9yVmFsdWUgaW5zdGFuY2VvZiBWYXJpYWJsZSB8fCBleHByZXNzaW9uT3JWYWx1ZSBpbnN0YW5jZW9mIFJlcGxFdmFsdWF0aW9uUmVzdWx0KSAmJiAhZXhwcmVzc2lvbk9yVmFsdWUuYXZhaWxhYmxlKSkge1xuXHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoQ2xzLlVuYXZhaWxhYmxlKTtcblx0XHRcdGlmICh2YWx1ZSAhPT0gRXhwcmVzc2lvbi5ERUZBVUxUX1ZBTFVFKSB7XG5cdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKENscy5FcnJvcik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0eXBlb2YgZXhwcmVzc2lvbk9yVmFsdWUgIT09ICdzdHJpbmcnICYmIG9wdGlvbnMuc2hvd0NoYW5nZWQgJiYgZXhwcmVzc2lvbk9yVmFsdWUudmFsdWVDaGFuZ2VkICYmIHZhbHVlICE9PSBFeHByZXNzaW9uLkRFRkFVTFRfVkFMVUUpIHtcblx0XHRcdFx0Ly8gdmFsdWUgY2hhbmdlZCBjb2xvciBoYXMgcHJpb3JpdHkgb3ZlciBvdGhlciBjb2xvcnMuXG5cdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKENscy5DaGFuZ2VkKTtcblx0XHRcdFx0ZXhwcmVzc2lvbk9yVmFsdWUudmFsdWVDaGFuZ2VkID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvcHRpb25zLmNvbG9yaXplICYmIHR5cGVvZiBleHByZXNzaW9uT3JWYWx1ZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0aWYgKGV4cHJlc3Npb25PclZhbHVlLnR5cGUgPT09ICdudW1iZXInIHx8IGV4cHJlc3Npb25PclZhbHVlLnR5cGUgPT09ICdib29sZWFuJyB8fCBleHByZXNzaW9uT3JWYWx1ZS50eXBlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKGV4cHJlc3Npb25PclZhbHVlLnR5cGUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKCFpc05hTigrdmFsdWUpKSB7XG5cdFx0XHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoQ2xzLk51bWJlcik7XG5cdFx0XHRcdH0gZWxzZSBpZiAoYm9vbGVhblJlZ2V4LnRlc3QodmFsdWUpKSB7XG5cdFx0XHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoQ2xzLkJvb2xlYW4pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHN0cmluZ1JlZ2V4LnRlc3QodmFsdWUpKSB7XG5cdFx0XHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoQ2xzLlN0cmluZyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5tYXhWYWx1ZUxlbmd0aCAmJiB2YWx1ZSAmJiB2YWx1ZS5sZW5ndGggPiBvcHRpb25zLm1heFZhbHVlTGVuZ3RoKSB7XG5cdFx0XHR2YWx1ZSA9IHZhbHVlLnN1YnN0cmluZygwLCBvcHRpb25zLm1heFZhbHVlTGVuZ3RoKSArICcuLi4nO1xuXHRcdH1cblx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHR2YWx1ZSA9ICcnO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlc3Npb24gPSBvcHRpb25zLnNlc3Npb24gPz8gKChleHByZXNzaW9uT3JWYWx1ZSBpbnN0YW5jZW9mIEV4cHJlc3Npb25Db250YWluZXIpID8gZXhwcmVzc2lvbk9yVmFsdWUuZ2V0U2Vzc2lvbigpIDogdW5kZWZpbmVkKTtcblx0XHQvLyBPbmx5IHVzZSBob3ZlcnMgZm9yIGxpbmtzIGlmIHRocmUncyBub3QgZ29pbmcgdG8gYmUgYSBob3ZlciBmb3IgdGhlIHZhbHVlLlxuXHRcdGNvbnN0IGhvdmVyQmVoYXZpb3I6IERlYnVnTGlua0hvdmVyQmVoYXZpb3JUeXBlRGF0YSA9IG9wdGlvbnMuaG92ZXIgPT09IGZhbHNlID8geyB0eXBlOiBEZWJ1Z0xpbmtIb3ZlckJlaGF2aW9yLlJpY2gsIHN0b3JlIH0gOiB7IHR5cGU6IERlYnVnTGlua0hvdmVyQmVoYXZpb3IuTm9uZSB9O1xuXHRcdGRvbS5jbGVhck5vZGUoY29udGFpbmVyKTtcblx0XHRjb25zdCBsb2NhdGlvblJlZmVyZW5jZSA9IG9wdGlvbnMubG9jYXRpb25SZWZlcmVuY2UgPz8gKGV4cHJlc3Npb25PclZhbHVlIGluc3RhbmNlb2YgRXhwcmVzc2lvbkNvbnRhaW5lciAmJiBleHByZXNzaW9uT3JWYWx1ZS52YWx1ZUxvY2F0aW9uUmVmZXJlbmNlKTtcblxuXHRcdGxldCBsaW5rRGV0ZWN0b3I6IElMaW5rRGV0ZWN0b3IgPSB0aGlzLmxpbmtEZXRlY3Rvcjtcblx0XHRpZiAobG9jYXRpb25SZWZlcmVuY2UgJiYgc2Vzc2lvbikge1xuXHRcdFx0bGlua0RldGVjdG9yID0gdGhpcy5saW5rRGV0ZWN0b3IubWFrZVJlZmVyZW5jZWRMaW5rRGV0ZWN0b3IobG9jYXRpb25SZWZlcmVuY2UsIHNlc3Npb24pO1xuXHRcdH1cblxuXHRcdGlmIChzdXBwb3J0c0FOU0kpIHtcblx0XHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChoYW5kbGVBTlNJT3V0cHV0KHZhbHVlLCBsaW5rRGV0ZWN0b3IsIHNlc3Npb24gPyBzZXNzaW9uLnJvb3QgOiB1bmRlZmluZWQsIG9wdGlvbnMuaGlnaGxpZ2h0cykpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQobGlua0RldGVjdG9yLmxpbmtpZnkodmFsdWUsIGZhbHNlLCBzZXNzaW9uPy5yb290LCB0cnVlLCBob3ZlckJlaGF2aW9yLCBvcHRpb25zLmhpZ2hsaWdodHMpKTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5ob3ZlciAhPT0gZmFsc2UpIHtcblx0XHRcdGNvbnN0IHsgY29tbWFuZHMgPSBbXSB9ID0gb3B0aW9ucy5ob3ZlciB8fCB7fTtcblx0XHRcdHN0b3JlLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgY29udGFpbmVyLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvbS4kKCdkaXYnKTtcblx0XHRcdFx0Y29uc3QgbWFya2Rvd25Ib3ZlckVsZW1lbnQgPSBkb20uJCgnZGl2LmhvdmVyLXJvdycpO1xuXHRcdFx0XHRjb25zdCBob3ZlckNvbnRlbnRzRWxlbWVudCA9IGRvbS5hcHBlbmQobWFya2Rvd25Ib3ZlckVsZW1lbnQsIGRvbS4kKCdkaXYuaG92ZXItY29udGVudHMnKSk7XG5cdFx0XHRcdGNvbnN0IGhvdmVyQ29udGVudHNQcmUgPSBkb20uYXBwZW5kKGhvdmVyQ29udGVudHNFbGVtZW50LCBkb20uJCgncHJlLmRlYnVnLXZhci1ob3Zlci1wcmUnKSk7XG5cdFx0XHRcdGlmIChzdXBwb3J0c0FOU0kpIHtcblx0XHRcdFx0XHQvLyBub3RlOiBpbnRlbnRpb25hbGx5IHVzaW5nIGB0aGlzLmxpbmtEZXRlY3RvcmAgc28gd2UgZG9uJ3QgYmxpbmRseSBsaW5raWZ5IHRoZVxuXHRcdFx0XHRcdC8vIGVudGlyZSBjb250ZW50cyBhbmQgaW5zdGVhZCBvbmx5IGxpbmsgZmlsZSBwYXRocyB0aGF0IGl0IGNvbnRhaW5zLlxuXHRcdFx0XHRcdGhvdmVyQ29udGVudHNQcmUuYXBwZW5kQ2hpbGQoaGFuZGxlQU5TSU91dHB1dCh2YWx1ZSwgdGhpcy5saW5rRGV0ZWN0b3IsIHNlc3Npb24gPyBzZXNzaW9uLnJvb3QgOiB1bmRlZmluZWQsIG9wdGlvbnMuaGlnaGxpZ2h0cykpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhvdmVyQ29udGVudHNQcmUudGV4dENvbnRlbnQgPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQobWFya2Rvd25Ib3ZlckVsZW1lbnQpO1xuXHRcdFx0XHRyZXR1cm4gY29udGFpbmVyO1xuXHRcdFx0fSwge1xuXHRcdFx0XHRhY3Rpb25zOiBjb21tYW5kcy5tYXAoKHsgaWQsIGFyZ3MgfSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKGlkKT8ubWV0YWRhdGE/LmRlc2NyaXB0aW9uO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRsYWJlbDogdHlwZW9mIGRlc2NyaXB0aW9uID09PSAnc3RyaW5nJyA/IGRlc2NyaXB0aW9uIDogZGVzY3JpcHRpb24gPyBkZXNjcmlwdGlvbi52YWx1ZSA6IGlkLFxuXHRcdFx0XHRcdFx0Y29tbWFuZElkOiBpZCxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChpZCwgLi4uYXJncyksXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSlcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RvcmU7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsdUJBQW9DO0FBRTdDLFNBQVMsa0JBQWtCLHVCQUF1QjtBQUNsRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLFlBQVkscUJBQXFCLGdCQUFnQjtBQUMxRCxTQUFTLDRCQUE0QjtBQUNyQyxTQUFnQyx3Q0FBd0M7QUFDeEUsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx1QkFBdUIscUJBQXFCO0FBQ3JELFNBQVMsd0JBQXVFLG9CQUFvQjtBQWdDcEcsTUFBTSxxQ0FBcUM7QUFDM0MsTUFBTSxlQUFlO0FBQ3JCLE1BQU0sY0FBYztBQUVwQixJQUFXLE1BQVgsa0JBQVdBLFNBQVg7QUFD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
