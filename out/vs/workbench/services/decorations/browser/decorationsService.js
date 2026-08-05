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
import { Emitter, DebounceEmitter } from "../../../../base/common/event.js";
import { IDecorationsService } from "../common/decorations.js";
import { TernarySearchTree } from "../../../../base/common/ternarySearchTree.js";
import { toDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { isThenable } from "../../../../base/common/async.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { createStyleSheet, createCSSRule, removeCSSRulesContainingSelector } from "../../../../base/browser/domStylesheets.js";
import * as cssValue from "../../../../base/browser/cssValue.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { localize } from "../../../../nls.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { hash } from "../../../../base/common/hash.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { asArray, distinct } from "../../../../base/common/arrays.js";
import { asCssVariable } from "../../../../platform/theme/common/colorRegistry.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
const _DecorationRule = class _DecorationRule {
  constructor(themeService, data, key) {
    this.themeService = themeService;
    this._refCounter = 0;
    this.data = data;
    const suffix = hash(key).toString(36);
    this.itemColorClassName = `${_DecorationRule._classNamesPrefix}-itemColor-${suffix}`;
    this.itemBadgeClassName = `${_DecorationRule._classNamesPrefix}-itemBadge-${suffix}`;
    this.bubbleBadgeClassName = `${_DecorationRule._classNamesPrefix}-bubbleBadge-${suffix}`;
    this.iconBadgeClassName = `${_DecorationRule._classNamesPrefix}-iconBadge-${suffix}`;
  }
  static keyOf(data) {
    if (Array.isArray(data)) {
      return data.map(_DecorationRule.keyOf).join(",");
    } else {
      const { color, letter } = data;
      if (ThemeIcon.isThemeIcon(letter)) {
        return `${color}+${letter.id}`;
      } else {
        return `${color}/${letter}`;
      }
    }
  }
  acquire() {
    this._refCounter += 1;
  }
  release() {
    return --this._refCounter === 0;
  }
  appendCSSRules(element) {
    if (!Array.isArray(this.data)) {
      this._appendForOne(this.data, element);
    } else {
      this._appendForMany(this.data, element);
    }
  }
  _appendForOne(data, element) {
    const { color, letter } = data;
    createCSSRule(`.${this.itemColorClassName}`, `color: ${getColor(color)};`, element);
    if (ThemeIcon.isThemeIcon(letter)) {
      this._createIconCSSRule(letter, color, element);
    } else if (letter) {
      createCSSRule(`.${this.itemBadgeClassName}::after`, `content: "${letter}"; color: ${getColor(color)};`, element);
    }
  }
  _appendForMany(data, element) {
    const { color } = data.find((d) => !!d.color) ?? data[0];
    createCSSRule(`.${this.itemColorClassName}`, `color: ${getColor(color)};`, element);
    const letters = [];
    let icon;
    for (const d of data) {
      if (ThemeIcon.isThemeIcon(d.letter)) {
        icon = d.letter;
        break;
      } else if (d.letter) {
        letters.push(d.letter);
      }
    }
    if (icon) {
      this._createIconCSSRule(icon, color, element);
    } else {
      if (letters.length) {
        createCSSRule(`.${this.itemBadgeClassName}::after`, `content: "${letters.join(", ")}"; color: ${getColor(color)};`, element);
      }
      createCSSRule(
        `.${this.bubbleBadgeClassName}::after`,
        `content: "\uEA71"; color: ${getColor(color)}; font-family: codicon; font-size: 14px; margin-right: 14px; opacity: 0.4;`,
        element
      );
    }
  }
  _createIconCSSRule(icon, color, element) {
    const modifier = ThemeIcon.getModifier(icon);
    if (modifier) {
      icon = ThemeIcon.modify(icon, void 0);
    }
    const iconContribution = getIconRegistry().getIcon(icon.id);
    if (!iconContribution) {
      return;
    }
    const definition = this.themeService.getProductIconTheme().getIcon(iconContribution);
    if (!definition) {
      return;
    }
    createCSSRule(
      `.${this.iconBadgeClassName}::after`,
      `content: '${definition.fontCharacter}';
			color: ${icon.color ? getColor(icon.color.id) : getColor(color)};
			font-family: ${cssValue.stringValue(definition.font?.id ?? "codicon")};
			font-size: 16px;
			margin-right: 14px;
			font-weight: normal;
			${modifier === "spin" ? "animation: codicon-spin 1.5s steps(30) infinite; font-style: normal !important;" : ""};
			`,
      element
    );
  }
  removeCSSRules(element) {
    removeCSSRulesContainingSelector(this.itemColorClassName, element);
    removeCSSRulesContainingSelector(this.itemBadgeClassName, element);
    removeCSSRulesContainingSelector(this.bubbleBadgeClassName, element);
    removeCSSRulesContainingSelector(this.iconBadgeClassName, element);
  }
};
_DecorationRule._classNamesPrefix = "monaco-decoration";
let DecorationRule = _DecorationRule;
class DecorationStyles {
  constructor(_themeService) {
    this._themeService = _themeService;
    this._dispoables = new DisposableStore();
    this._styleElement = createStyleSheet(void 0, void 0, this._dispoables);
    this._decorationRules = /* @__PURE__ */ new Map();
  }
  dispose() {
    this._dispoables.dispose();
  }
  asDecoration(data, onlyChildren) {
    data.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    const key = DecorationRule.keyOf(data);
    let rule = this._decorationRules.get(key);
    if (!rule) {
      rule = new DecorationRule(this._themeService, data, key);
      this._decorationRules.set(key, rule);
      rule.appendCSSRules(this._styleElement);
    }
    rule.acquire();
    const labelClassName = rule.itemColorClassName;
    let badgeClassName = rule.itemBadgeClassName;
    const iconClassName = rule.iconBadgeClassName;
    let tooltip = distinct(data.filter((d) => !isFalsyOrWhitespace(d.tooltip)).map((d) => d.tooltip)).join(" \u2022 ");
    const strikethrough = data.some((d) => d.strikethrough);
    if (onlyChildren) {
      badgeClassName = rule.bubbleBadgeClassName;
      tooltip = localize("bubbleTitle", "Contains emphasized items");
    }
    return {
      labelClassName,
      badgeClassName,
      iconClassName,
      strikethrough,
      tooltip,
      dispose: () => {
        if (rule?.release()) {
          this._decorationRules.delete(key);
          rule.removeCSSRules(this._styleElement);
          rule = void 0;
        }
      }
    };
  }
}
class FileDecorationChangeEvent {
  // events ignore all path casings
  constructor(all) {
    this._data = TernarySearchTree.forUris((_uri) => true);
    this._data.fill(true, asArray(all));
  }
  affectsResource(uri) {
    return this._data.hasElementOrSubtree(uri);
  }
}
class DecorationDataRequest {
  constructor(source, thenable) {
    this.source = source;
    this.thenable = thenable;
  }
}
function getColor(color) {
  return color ? asCssVariable(color) : "inherit";
}
let DecorationsService = class {
  constructor(uriIdentityService, themeService) {
    this._store = new DisposableStore();
    this._onDidChangeDecorationsDelayed = this._store.add(new DebounceEmitter({ merge: (all) => all.flat() }));
    this._onDidChangeDecorations = this._store.add(new Emitter());
    this.onDidChangeDecorations = this._onDidChangeDecorations.event;
    this._provider = new LinkedList();
    this._decorationStyles = new DecorationStyles(themeService);
    this._data = TernarySearchTree.forUris((key) => uriIdentityService.extUri.ignorePathCasing(key));
    this._store.add(this._onDidChangeDecorationsDelayed.event((event) => {
      this._onDidChangeDecorations.fire(new FileDecorationChangeEvent(event));
    }));
  }
  dispose() {
    this._store.dispose();
    this._data.clear();
  }
  registerDecorationsProvider(provider) {
    const rm = this._provider.unshift(provider);
    this._onDidChangeDecorations.fire({
      // everything might have changed
      affectsResource() {
        return true;
      }
    });
    const removeAll = () => {
      const uris = [];
      for (const [uri, map] of this._data) {
        if (map.delete(provider)) {
          uris.push(uri);
        }
      }
      if (uris.length > 0) {
        this._onDidChangeDecorationsDelayed.fire(uris);
      }
    };
    const listener = provider.onDidChange((uris) => {
      if (!uris) {
        removeAll();
      } else {
        for (const uri of uris) {
          const map = this._ensureEntry(uri);
          this._fetchData(map, uri, provider);
        }
      }
    });
    return toDisposable(() => {
      rm();
      listener.dispose();
      removeAll();
    });
  }
  _ensureEntry(uri) {
    let map = this._data.get(uri);
    if (!map) {
      map = /* @__PURE__ */ new Map();
      this._data.set(uri, map);
    }
    return map;
  }
  getDecoration(uri, includeChildren) {
    const all = [];
    let containsChildren = false;
    const map = this._ensureEntry(uri);
    for (const provider of this._provider) {
      let data = map.get(provider);
      if (data === void 0) {
        data = this._fetchData(map, uri, provider);
      }
      if (data && !(data instanceof DecorationDataRequest)) {
        all.push(data);
      }
    }
    if (includeChildren) {
      const iter = this._data.findSuperstr(uri);
      if (iter) {
        for (const tuple of iter) {
          for (const data of tuple[1].values()) {
            if (data && !(data instanceof DecorationDataRequest)) {
              if (data.bubble) {
                all.push(data);
                containsChildren = true;
              }
            }
          }
        }
      }
    }
    return all.length === 0 ? void 0 : this._decorationStyles.asDecoration(all, containsChildren);
  }
  _fetchData(map, uri, provider) {
    const pendingRequest = map.get(provider);
    if (pendingRequest instanceof DecorationDataRequest) {
      pendingRequest.source.cancel();
      map.delete(provider);
    }
    const cts = new CancellationTokenSource();
    const dataOrThenable = provider.provideDecorations(uri, cts.token);
    if (!isThenable(dataOrThenable)) {
      cts.dispose();
      return this._keepItem(map, provider, uri, dataOrThenable);
    } else {
      const request = new DecorationDataRequest(cts, Promise.resolve(dataOrThenable).then((data) => {
        if (map.get(provider) === request) {
          this._keepItem(map, provider, uri, data);
        }
      }).catch((err) => {
        if (!isCancellationError(err) && map.get(provider) === request) {
          map.delete(provider);
        }
      }).finally(() => {
        cts.dispose();
      }));
      map.set(provider, request);
      return null;
    }
  }
  _keepItem(map, provider, uri, data) {
    const deco = data ? data : null;
    const old = map.get(provider);
    map.set(provider, deco);
    if (deco || old) {
      this._onDidChangeDecorationsDelayed.fire(uri);
    }
    return deco;
  }
};
DecorationsService = __decorateClass([
  __decorateParam(0, IUriIdentityService),
  __decorateParam(1, IThemeService)
], DecorationsService);
registerSingleton(IDecorationsService, DecorationsService, InstantiationType.Delayed);
export {
  DecorationsService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZGVjb3JhdGlvbnMvYnJvd3Nlci9kZWNvcmF0aW9uc1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRGVib3VuY2VFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElEZWNvcmF0aW9uc1NlcnZpY2UsIElEZWNvcmF0aW9uLCBJUmVzb3VyY2VEZWNvcmF0aW9uQ2hhbmdlRXZlbnQsIElEZWNvcmF0aW9uc1Byb3ZpZGVyLCBJRGVjb3JhdGlvbkRhdGEgfSBmcm9tICcuLi9jb21tb24vZGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgVGVybmFyeVNlYXJjaFRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90ZXJuYXJ5U2VhcmNoVHJlZS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNUaGVuYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IExpbmtlZExpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saW5rZWRMaXN0LmpzJztcbmltcG9ydCB7IGNyZWF0ZVN0eWxlU2hlZXQsIGNyZWF0ZUNTU1J1bGUsIHJlbW92ZUNTU1J1bGVzQ29udGFpbmluZ1NlbGVjdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCAqIGFzIGNzc1ZhbHVlIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgaXNGYWxzeU9yV2hpdGVzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgYXNBcnJheSwgZGlzdGluY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZSwgQ29sb3JJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgZ2V0SWNvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5cbmNsYXNzIERlY29yYXRpb25SdWxlIHtcblxuXHRzdGF0aWMga2V5T2YoZGF0YTogSURlY29yYXRpb25EYXRhIHwgSURlY29yYXRpb25EYXRhW10pOiBzdHJpbmcge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG5cdFx0XHRyZXR1cm4gZGF0YS5tYXAoRGVjb3JhdGlvblJ1bGUua2V5T2YpLmpvaW4oJywnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgeyBjb2xvciwgbGV0dGVyIH0gPSBkYXRhO1xuXHRcdFx0aWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihsZXR0ZXIpKSB7XG5cdFx0XHRcdHJldHVybiBgJHtjb2xvcn0rJHtsZXR0ZXIuaWR9YDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBgJHtjb2xvcn0vJHtsZXR0ZXJ9YDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfY2xhc3NOYW1lc1ByZWZpeCA9ICdtb25hY28tZGVjb3JhdGlvbic7XG5cblx0cmVhZG9ubHkgZGF0YTogSURlY29yYXRpb25EYXRhIHwgSURlY29yYXRpb25EYXRhW107XG5cdHJlYWRvbmx5IGl0ZW1Db2xvckNsYXNzTmFtZTogc3RyaW5nO1xuXHRyZWFkb25seSBpdGVtQmFkZ2VDbGFzc05hbWU6IHN0cmluZztcblx0cmVhZG9ubHkgaWNvbkJhZGdlQ2xhc3NOYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGJ1YmJsZUJhZGdlQ2xhc3NOYW1lOiBzdHJpbmc7XG5cblx0cHJpdmF0ZSBfcmVmQ291bnRlcjogbnVtYmVyID0gMDtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsIGRhdGE6IElEZWNvcmF0aW9uRGF0YSB8IElEZWNvcmF0aW9uRGF0YVtdLCBrZXk6IHN0cmluZykge1xuXHRcdHRoaXMuZGF0YSA9IGRhdGE7XG5cdFx0Y29uc3Qgc3VmZml4ID0gaGFzaChrZXkpLnRvU3RyaW5nKDM2KTtcblx0XHR0aGlzLml0ZW1Db2xvckNsYXNzTmFtZSA9IGAke0RlY29yYXRpb25SdWxlLl9jbGFzc05hbWVzUHJlZml4fS1pdGVtQ29sb3ItJHtzdWZmaXh9YDtcblx0XHR0aGlzLml0ZW1CYWRnZUNsYXNzTmFtZSA9IGAke0RlY29yYXRpb25SdWxlLl9jbGFzc05hbWVzUHJlZml4fS1pdGVtQmFkZ2UtJHtzdWZmaXh9YDtcblx0XHR0aGlzLmJ1YmJsZUJhZGdlQ2xhc3NOYW1lID0gYCR7RGVjb3JhdGlvblJ1bGUuX2NsYXNzTmFtZXNQcmVmaXh9LWJ1YmJsZUJhZGdlLSR7c3VmZml4fWA7XG5cdFx0dGhpcy5pY29uQmFkZ2VDbGFzc05hbWUgPSBgJHtEZWNvcmF0aW9uUnVsZS5fY2xhc3NOYW1lc1ByZWZpeH0taWNvbkJhZGdlLSR7c3VmZml4fWA7XG5cdH1cblxuXHRhY3F1aXJlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZkNvdW50ZXIgKz0gMTtcblx0fVxuXG5cdHJlbGVhc2UoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC0tdGhpcy5fcmVmQ291bnRlciA9PT0gMDtcblx0fVxuXG5cdGFwcGVuZENTU1J1bGVzKGVsZW1lbnQ6IEhUTUxTdHlsZUVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkodGhpcy5kYXRhKSkge1xuXHRcdFx0dGhpcy5fYXBwZW5kRm9yT25lKHRoaXMuZGF0YSwgZWxlbWVudCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2FwcGVuZEZvck1hbnkodGhpcy5kYXRhLCBlbGVtZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9hcHBlbmRGb3JPbmUoZGF0YTogSURlY29yYXRpb25EYXRhLCBlbGVtZW50OiBIVE1MU3R5bGVFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb2xvciwgbGV0dGVyIH0gPSBkYXRhO1xuXHRcdC8vIGxhYmVsXG5cdFx0Y3JlYXRlQ1NTUnVsZShgLiR7dGhpcy5pdGVtQ29sb3JDbGFzc05hbWV9YCwgYGNvbG9yOiAke2dldENvbG9yKGNvbG9yKX07YCwgZWxlbWVudCk7XG5cdFx0aWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihsZXR0ZXIpKSB7XG5cdFx0XHR0aGlzLl9jcmVhdGVJY29uQ1NTUnVsZShsZXR0ZXIsIGNvbG9yLCBlbGVtZW50KTtcblx0XHR9IGVsc2UgaWYgKGxldHRlcikge1xuXHRcdFx0Y3JlYXRlQ1NTUnVsZShgLiR7dGhpcy5pdGVtQmFkZ2VDbGFzc05hbWV9OjphZnRlcmAsIGBjb250ZW50OiBcIiR7bGV0dGVyfVwiOyBjb2xvcjogJHtnZXRDb2xvcihjb2xvcil9O2AsIGVsZW1lbnQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2FwcGVuZEZvck1hbnkoZGF0YTogSURlY29yYXRpb25EYXRhW10sIGVsZW1lbnQ6IEhUTUxTdHlsZUVsZW1lbnQpOiB2b2lkIHtcblx0XHQvLyBsYWJlbFxuXHRcdGNvbnN0IHsgY29sb3IgfSA9IGRhdGEuZmluZChkID0+ICEhZC5jb2xvcikgPz8gZGF0YVswXTtcblx0XHRjcmVhdGVDU1NSdWxlKGAuJHt0aGlzLml0ZW1Db2xvckNsYXNzTmFtZX1gLCBgY29sb3I6ICR7Z2V0Q29sb3IoY29sb3IpfTtgLCBlbGVtZW50KTtcblxuXHRcdC8vIGJhZGdlIG9yIGljb25cblx0XHRjb25zdCBsZXR0ZXJzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGxldCBpY29uOiBUaGVtZUljb24gfCB1bmRlZmluZWQ7XG5cblx0XHRmb3IgKGNvbnN0IGQgb2YgZGF0YSkge1xuXHRcdFx0aWYgKFRoZW1lSWNvbi5pc1RoZW1lSWNvbihkLmxldHRlcikpIHtcblx0XHRcdFx0aWNvbiA9IGQubGV0dGVyO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH0gZWxzZSBpZiAoZC5sZXR0ZXIpIHtcblx0XHRcdFx0bGV0dGVycy5wdXNoKGQubGV0dGVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaWNvbikge1xuXHRcdFx0dGhpcy5fY3JlYXRlSWNvbkNTU1J1bGUoaWNvbiwgY29sb3IsIGVsZW1lbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAobGV0dGVycy5sZW5ndGgpIHtcblx0XHRcdFx0Y3JlYXRlQ1NTUnVsZShgLiR7dGhpcy5pdGVtQmFkZ2VDbGFzc05hbWV9OjphZnRlcmAsIGBjb250ZW50OiBcIiR7bGV0dGVycy5qb2luKCcsICcpfVwiOyBjb2xvcjogJHtnZXRDb2xvcihjb2xvcil9O2AsIGVsZW1lbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBidWJibGUgYmFkZ2Vcblx0XHRcdC8vIFRPRE8gQG1pc29sb3JpIHVwZGF0ZSBidWJibGUgYmFkZ2UgdG8gYWRvcHQgbGV0dGVyOiBUaGVtZUljb24gaW5zdGVhZCBvZiB1bmljb2RlXG5cdFx0XHRjcmVhdGVDU1NSdWxlKFxuXHRcdFx0XHRgLiR7dGhpcy5idWJibGVCYWRnZUNsYXNzTmFtZX06OmFmdGVyYCxcblx0XHRcdFx0YGNvbnRlbnQ6IFwiXFx1ZWE3MVwiOyBjb2xvcjogJHtnZXRDb2xvcihjb2xvcil9OyBmb250LWZhbWlseTogY29kaWNvbjsgZm9udC1zaXplOiAxNHB4OyBtYXJnaW4tcmlnaHQ6IDE0cHg7IG9wYWNpdHk6IDAuNDtgLFxuXHRcdFx0XHRlbGVtZW50XG5cdFx0XHQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUljb25DU1NSdWxlKGljb246IFRoZW1lSWNvbiwgY29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZCwgZWxlbWVudDogSFRNTFN0eWxlRWxlbWVudCkge1xuXG5cdFx0Y29uc3QgbW9kaWZpZXIgPSBUaGVtZUljb24uZ2V0TW9kaWZpZXIoaWNvbik7XG5cdFx0aWYgKG1vZGlmaWVyKSB7XG5cdFx0XHRpY29uID0gVGhlbWVJY29uLm1vZGlmeShpY29uLCB1bmRlZmluZWQpO1xuXHRcdH1cblx0XHRjb25zdCBpY29uQ29udHJpYnV0aW9uID0gZ2V0SWNvblJlZ2lzdHJ5KCkuZ2V0SWNvbihpY29uLmlkKTtcblx0XHRpZiAoIWljb25Db250cmlidXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZGVmaW5pdGlvbiA9IHRoaXMudGhlbWVTZXJ2aWNlLmdldFByb2R1Y3RJY29uVGhlbWUoKS5nZXRJY29uKGljb25Db250cmlidXRpb24pO1xuXHRcdGlmICghZGVmaW5pdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjcmVhdGVDU1NSdWxlKFxuXHRcdFx0YC4ke3RoaXMuaWNvbkJhZGdlQ2xhc3NOYW1lfTo6YWZ0ZXJgLFxuXHRcdFx0YGNvbnRlbnQ6ICcke2RlZmluaXRpb24uZm9udENoYXJhY3Rlcn0nO1xuXHRcdFx0Y29sb3I6ICR7aWNvbi5jb2xvciA/IGdldENvbG9yKGljb24uY29sb3IuaWQpIDogZ2V0Q29sb3IoY29sb3IpfTtcblx0XHRcdGZvbnQtZmFtaWx5OiAke2Nzc1ZhbHVlLnN0cmluZ1ZhbHVlKGRlZmluaXRpb24uZm9udD8uaWQgPz8gJ2NvZGljb24nKX07XG5cdFx0XHRmb250LXNpemU6IDE2cHg7XG5cdFx0XHRtYXJnaW4tcmlnaHQ6IDE0cHg7XG5cdFx0XHRmb250LXdlaWdodDogbm9ybWFsO1xuXHRcdFx0JHttb2RpZmllciA9PT0gJ3NwaW4nID8gJ2FuaW1hdGlvbjogY29kaWNvbi1zcGluIDEuNXMgc3RlcHMoMzApIGluZmluaXRlOyBmb250LXN0eWxlOiBub3JtYWwgIWltcG9ydGFudDsnIDogJyd9O1xuXHRcdFx0YCxcblx0XHRcdGVsZW1lbnRcblx0XHQpO1xuXHR9XG5cblx0cmVtb3ZlQ1NTUnVsZXMoZWxlbWVudDogSFRNTFN0eWxlRWxlbWVudCk6IHZvaWQge1xuXHRcdHJlbW92ZUNTU1J1bGVzQ29udGFpbmluZ1NlbGVjdG9yKHRoaXMuaXRlbUNvbG9yQ2xhc3NOYW1lLCBlbGVtZW50KTtcblx0XHRyZW1vdmVDU1NSdWxlc0NvbnRhaW5pbmdTZWxlY3Rvcih0aGlzLml0ZW1CYWRnZUNsYXNzTmFtZSwgZWxlbWVudCk7XG5cdFx0cmVtb3ZlQ1NTUnVsZXNDb250YWluaW5nU2VsZWN0b3IodGhpcy5idWJibGVCYWRnZUNsYXNzTmFtZSwgZWxlbWVudCk7XG5cdFx0cmVtb3ZlQ1NTUnVsZXNDb250YWluaW5nU2VsZWN0b3IodGhpcy5pY29uQmFkZ2VDbGFzc05hbWUsIGVsZW1lbnQpO1xuXHR9XG59XG5cbmNsYXNzIERlY29yYXRpb25TdHlsZXMge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3BvYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0eWxlRWxlbWVudCA9IGNyZWF0ZVN0eWxlU2hlZXQodW5kZWZpbmVkLCB1bmRlZmluZWQsIHRoaXMuX2Rpc3BvYWJsZXMpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uUnVsZXMgPSBuZXcgTWFwPHN0cmluZywgRGVjb3JhdGlvblJ1bGU+KCk7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlKSB7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2Rpc3BvYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0YXNEZWNvcmF0aW9uKGRhdGE6IElEZWNvcmF0aW9uRGF0YVtdLCBvbmx5Q2hpbGRyZW46IGJvb2xlYW4pOiBJRGVjb3JhdGlvbiB7XG5cblx0XHQvLyBzb3J0IGJ5IHdlaWdodFxuXHRcdGRhdGEuc29ydCgoYSwgYikgPT4gKGIud2VpZ2h0IHx8IDApIC0gKGEud2VpZ2h0IHx8IDApKTtcblxuXHRcdGNvbnN0IGtleSA9IERlY29yYXRpb25SdWxlLmtleU9mKGRhdGEpO1xuXHRcdGxldCBydWxlID0gdGhpcy5fZGVjb3JhdGlvblJ1bGVzLmdldChrZXkpO1xuXG5cdFx0aWYgKCFydWxlKSB7XG5cdFx0XHQvLyBuZXcgY3NzIHJ1bGVcblx0XHRcdHJ1bGUgPSBuZXcgRGVjb3JhdGlvblJ1bGUodGhpcy5fdGhlbWVTZXJ2aWNlLCBkYXRhLCBrZXkpO1xuXHRcdFx0dGhpcy5fZGVjb3JhdGlvblJ1bGVzLnNldChrZXksIHJ1bGUpO1xuXHRcdFx0cnVsZS5hcHBlbmRDU1NSdWxlcyh0aGlzLl9zdHlsZUVsZW1lbnQpO1xuXHRcdH1cblxuXHRcdHJ1bGUuYWNxdWlyZSgpO1xuXG5cdFx0Y29uc3QgbGFiZWxDbGFzc05hbWUgPSBydWxlLml0ZW1Db2xvckNsYXNzTmFtZTtcblx0XHRsZXQgYmFkZ2VDbGFzc05hbWUgPSBydWxlLml0ZW1CYWRnZUNsYXNzTmFtZTtcblx0XHRjb25zdCBpY29uQ2xhc3NOYW1lID0gcnVsZS5pY29uQmFkZ2VDbGFzc05hbWU7XG5cdFx0bGV0IHRvb2x0aXAgPSBkaXN0aW5jdChkYXRhLmZpbHRlcihkID0+ICFpc0ZhbHN5T3JXaGl0ZXNwYWNlKGQudG9vbHRpcCkpLm1hcChkID0+IGQudG9vbHRpcCkpLmpvaW4oJyBcdTIwMjIgJyk7XG5cdFx0Y29uc3Qgc3RyaWtldGhyb3VnaCA9IGRhdGEuc29tZShkID0+IGQuc3RyaWtldGhyb3VnaCk7XG5cblx0XHRpZiAob25seUNoaWxkcmVuKSB7XG5cdFx0XHQvLyBzaG93IGl0ZW1zIGZyb20gaXRzIGNoaWxkcmVuIG9ubHlcblx0XHRcdGJhZGdlQ2xhc3NOYW1lID0gcnVsZS5idWJibGVCYWRnZUNsYXNzTmFtZTtcblx0XHRcdHRvb2x0aXAgPSBsb2NhbGl6ZSgnYnViYmxlVGl0bGUnLCBcIkNvbnRhaW5zIGVtcGhhc2l6ZWQgaXRlbXNcIik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsQ2xhc3NOYW1lLFxuXHRcdFx0YmFkZ2VDbGFzc05hbWUsXG5cdFx0XHRpY29uQ2xhc3NOYW1lLFxuXHRcdFx0c3RyaWtldGhyb3VnaCxcblx0XHRcdHRvb2x0aXAsXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGlmIChydWxlPy5yZWxlYXNlKCkpIHtcblx0XHRcdFx0XHR0aGlzLl9kZWNvcmF0aW9uUnVsZXMuZGVsZXRlKGtleSk7XG5cdFx0XHRcdFx0cnVsZS5yZW1vdmVDU1NSdWxlcyh0aGlzLl9zdHlsZUVsZW1lbnQpO1xuXHRcdFx0XHRcdHJ1bGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIEZpbGVEZWNvcmF0aW9uQ2hhbmdlRXZlbnQgaW1wbGVtZW50cyBJUmVzb3VyY2VEZWNvcmF0aW9uQ2hhbmdlRXZlbnQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RhdGEgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JVcmlzPHRydWU+KF91cmkgPT4gdHJ1ZSk7IC8vIGV2ZW50cyBpZ25vcmUgYWxsIHBhdGggY2FzaW5nc1xuXG5cdGNvbnN0cnVjdG9yKGFsbDogVVJJIHwgVVJJW10pIHtcblx0XHR0aGlzLl9kYXRhLmZpbGwodHJ1ZSwgYXNBcnJheShhbGwpKTtcblx0fVxuXG5cdGFmZmVjdHNSZXNvdXJjZSh1cmk6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9kYXRhLmhhc0VsZW1lbnRPclN1YnRyZWUodXJpKTtcblx0fVxufVxuXG5jbGFzcyBEZWNvcmF0aW9uRGF0YVJlcXVlc3Qge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBzb3VyY2U6IENhbmNlbGxhdGlvblRva2VuU291cmNlLFxuXHRcdHJlYWRvbmx5IHRoZW5hYmxlOiBQcm9taXNlPHZvaWQ+LFxuXHQpIHsgfVxufVxuXG5mdW5jdGlvbiBnZXRDb2xvcihjb2xvcjogQ29sb3JJZGVudGlmaWVyIHwgdW5kZWZpbmVkKSB7XG5cdHJldHVybiBjb2xvciA/IGFzQ3NzVmFyaWFibGUoY29sb3IpIDogJ2luaGVyaXQnO1xufVxuXG50eXBlIERlY29yYXRpb25FbnRyeSA9IE1hcDxJRGVjb3JhdGlvbnNQcm92aWRlciwgRGVjb3JhdGlvbkRhdGFSZXF1ZXN0IHwgSURlY29yYXRpb25EYXRhIHwgbnVsbD47XG5cbmV4cG9ydCBjbGFzcyBEZWNvcmF0aW9uc1NlcnZpY2UgaW1wbGVtZW50cyBJRGVjb3JhdGlvbnNTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VEZWNvcmF0aW9uc0RlbGF5ZWQgPSB0aGlzLl9zdG9yZS5hZGQobmV3IERlYm91bmNlRW1pdHRlcjxVUkkgfCBVUklbXT4oeyBtZXJnZTogYWxsID0+IGFsbC5mbGF0KCkgfSkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZURlY29yYXRpb25zID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBFbWl0dGVyPElSZXNvdXJjZURlY29yYXRpb25DaGFuZ2VFdmVudD4oKSk7XG5cblx0b25EaWRDaGFuZ2VEZWNvcmF0aW9uczogRXZlbnQ8SVJlc291cmNlRGVjb3JhdGlvbkNoYW5nZUV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXIgPSBuZXcgTGlua2VkTGlzdDxJRGVjb3JhdGlvbnNQcm92aWRlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGVjb3JhdGlvblN0eWxlczogRGVjb3JhdGlvblN0eWxlcztcblx0cHJpdmF0ZSByZWFkb25seSBfZGF0YTogVGVybmFyeVNlYXJjaFRyZWU8VVJJLCBEZWNvcmF0aW9uRW50cnk+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2RlY29yYXRpb25TdHlsZXMgPSBuZXcgRGVjb3JhdGlvblN0eWxlcyh0aGVtZVNlcnZpY2UpO1xuXHRcdHRoaXMuX2RhdGEgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JVcmlzKGtleSA9PiB1cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlnbm9yZVBhdGhDYXNpbmcoa2V5KSk7XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQodGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9uc0RlbGF5ZWQuZXZlbnQoZXZlbnQgPT4geyB0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zLmZpcmUobmV3IEZpbGVEZWNvcmF0aW9uQ2hhbmdlRXZlbnQoZXZlbnQpKTsgfSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9zdG9yZS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGF0YS5jbGVhcigpO1xuXHR9XG5cblx0cmVnaXN0ZXJEZWNvcmF0aW9uc1Byb3ZpZGVyKHByb3ZpZGVyOiBJRGVjb3JhdGlvbnNQcm92aWRlcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBybSA9IHRoaXMuX3Byb3ZpZGVyLnVuc2hpZnQocHJvdmlkZXIpO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VEZWNvcmF0aW9ucy5maXJlKHtcblx0XHRcdC8vIGV2ZXJ5dGhpbmcgbWlnaHQgaGF2ZSBjaGFuZ2VkXG5cdFx0XHRhZmZlY3RzUmVzb3VyY2UoKSB7IHJldHVybiB0cnVlOyB9XG5cdFx0fSk7XG5cblx0XHQvLyByZW1vdmUgZXZlcnl0aGluZyB3aGF0IGNhbWUgZnJvbSB0aGlzIHByb3ZpZGVyXG5cdFx0Y29uc3QgcmVtb3ZlQWxsID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgdXJpczogVVJJW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgW3VyaSwgbWFwXSBvZiB0aGlzLl9kYXRhKSB7XG5cdFx0XHRcdGlmIChtYXAuZGVsZXRlKHByb3ZpZGVyKSkge1xuXHRcdFx0XHRcdHVyaXMucHVzaCh1cmkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodXJpcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGVjb3JhdGlvbnNEZWxheWVkLmZpcmUodXJpcyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGxpc3RlbmVyID0gcHJvdmlkZXIub25EaWRDaGFuZ2UodXJpcyA9PiB7XG5cdFx0XHRpZiAoIXVyaXMpIHtcblx0XHRcdFx0Ly8gZmx1c2ggZXZlbnQgLT4gZHJvcCBhbGwgZGF0YSwgY2FuIGFmZmVjdCBldmVyeXRoaW5nXG5cdFx0XHRcdHJlbW92ZUFsbCgpO1xuXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBzZWxlY3RpdmUgY2hhbmdlcyAtPiBkcm9wIGZvciByZXNvdXJjZSwgZmV0Y2ggYWdhaW4sIHNlbmQgZXZlbnRcblx0XHRcdFx0Zm9yIChjb25zdCB1cmkgb2YgdXJpcykge1xuXHRcdFx0XHRcdGNvbnN0IG1hcCA9IHRoaXMuX2Vuc3VyZUVudHJ5KHVyaSk7XG5cdFx0XHRcdFx0dGhpcy5fZmV0Y2hEYXRhKG1hcCwgdXJpLCBwcm92aWRlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0cm0oKTtcblx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdHJlbW92ZUFsbCgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZW5zdXJlRW50cnkodXJpOiBVUkkpOiBEZWNvcmF0aW9uRW50cnkge1xuXHRcdGxldCBtYXAgPSB0aGlzLl9kYXRhLmdldCh1cmkpO1xuXHRcdGlmICghbWFwKSB7XG5cdFx0XHQvLyBub3RoaW5nIGtub3duIGFib3V0IHRoaXMgdXJpXG5cdFx0XHRtYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHR0aGlzLl9kYXRhLnNldCh1cmksIG1hcCk7XG5cdFx0fVxuXHRcdHJldHVybiBtYXA7XG5cdH1cblxuXHRnZXREZWNvcmF0aW9uKHVyaTogVVJJLCBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4pOiBJRGVjb3JhdGlvbiB8IHVuZGVmaW5lZCB7XG5cblx0XHRjb25zdCBhbGw6IElEZWNvcmF0aW9uRGF0YVtdID0gW107XG5cdFx0bGV0IGNvbnRhaW5zQ2hpbGRyZW46IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRcdGNvbnN0IG1hcCA9IHRoaXMuX2Vuc3VyZUVudHJ5KHVyaSk7XG5cblx0XHRmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIHRoaXMuX3Byb3ZpZGVyKSB7XG5cblx0XHRcdGxldCBkYXRhID0gbWFwLmdldChwcm92aWRlcik7XG5cdFx0XHRpZiAoZGF0YSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdC8vIHNldHMgZGF0YSBpZiBmZXRjaCBpcyBzeW5jXG5cdFx0XHRcdGRhdGEgPSB0aGlzLl9mZXRjaERhdGEobWFwLCB1cmksIHByb3ZpZGVyKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGRhdGEgJiYgIShkYXRhIGluc3RhbmNlb2YgRGVjb3JhdGlvbkRhdGFSZXF1ZXN0KSkge1xuXHRcdFx0XHQvLyBoYXZpbmcgZGF0YVxuXHRcdFx0XHRhbGwucHVzaChkYXRhKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaW5jbHVkZUNoaWxkcmVuKSB7XG5cdFx0XHQvLyAocmVzb2x2ZWQpIGNoaWxkcmVuXG5cdFx0XHRjb25zdCBpdGVyID0gdGhpcy5fZGF0YS5maW5kU3VwZXJzdHIodXJpKTtcblx0XHRcdGlmIChpdGVyKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdHVwbGUgb2YgaXRlcikge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgZGF0YSBvZiB0dXBsZVsxXS52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdFx0aWYgKGRhdGEgJiYgIShkYXRhIGluc3RhbmNlb2YgRGVjb3JhdGlvbkRhdGFSZXF1ZXN0KSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoZGF0YS5idWJibGUpIHtcblx0XHRcdFx0XHRcdFx0XHRhbGwucHVzaChkYXRhKTtcblx0XHRcdFx0XHRcdFx0XHRjb250YWluc0NoaWxkcmVuID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBhbGwubGVuZ3RoID09PSAwXG5cdFx0XHQ/IHVuZGVmaW5lZFxuXHRcdFx0OiB0aGlzLl9kZWNvcmF0aW9uU3R5bGVzLmFzRGVjb3JhdGlvbihhbGwsIGNvbnRhaW5zQ2hpbGRyZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmV0Y2hEYXRhKG1hcDogRGVjb3JhdGlvbkVudHJ5LCB1cmk6IFVSSSwgcHJvdmlkZXI6IElEZWNvcmF0aW9uc1Byb3ZpZGVyKTogSURlY29yYXRpb25EYXRhIHwgbnVsbCB7XG5cblx0XHQvLyBjaGVjayBmb3IgcGVuZGluZyByZXF1ZXN0IGFuZCBjYW5jZWwgaXRcblx0XHRjb25zdCBwZW5kaW5nUmVxdWVzdCA9IG1hcC5nZXQocHJvdmlkZXIpO1xuXHRcdGlmIChwZW5kaW5nUmVxdWVzdCBpbnN0YW5jZW9mIERlY29yYXRpb25EYXRhUmVxdWVzdCkge1xuXHRcdFx0cGVuZGluZ1JlcXVlc3Quc291cmNlLmNhbmNlbCgpO1xuXHRcdFx0bWFwLmRlbGV0ZShwcm92aWRlcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0Y29uc3QgZGF0YU9yVGhlbmFibGUgPSBwcm92aWRlci5wcm92aWRlRGVjb3JhdGlvbnModXJpLCBjdHMudG9rZW4pO1xuXHRcdGlmICghaXNUaGVuYWJsZTxJRGVjb3JhdGlvbkRhdGEgfCBQcm9taXNlPElEZWNvcmF0aW9uRGF0YSB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQ+KGRhdGFPclRoZW5hYmxlKSkge1xuXHRcdFx0Ly8gc3luYyAtPiB3ZSBoYXZlIGEgcmVzdWx0IG5vd1xuXHRcdFx0Y3RzLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybiB0aGlzLl9rZWVwSXRlbShtYXAsIHByb3ZpZGVyLCB1cmksIGRhdGFPclRoZW5hYmxlKTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBhc3luYyAtPiB3ZSBoYXZlIGEgcmVzdWx0IHNvb25cblx0XHRcdGNvbnN0IHJlcXVlc3QgPSBuZXcgRGVjb3JhdGlvbkRhdGFSZXF1ZXN0KGN0cywgUHJvbWlzZS5yZXNvbHZlKGRhdGFPclRoZW5hYmxlKS50aGVuKGRhdGEgPT4ge1xuXHRcdFx0XHRpZiAobWFwLmdldChwcm92aWRlcikgPT09IHJlcXVlc3QpIHtcblx0XHRcdFx0XHR0aGlzLl9rZWVwSXRlbShtYXAsIHByb3ZpZGVyLCB1cmksIGRhdGEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KS5jYXRjaChlcnIgPT4ge1xuXHRcdFx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSAmJiBtYXAuZ2V0KHByb3ZpZGVyKSA9PT0gcmVxdWVzdCkge1xuXHRcdFx0XHRcdG1hcC5kZWxldGUocHJvdmlkZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KS5maW5hbGx5KCgpID0+IHtcblx0XHRcdFx0Y3RzLmRpc3Bvc2UoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0bWFwLnNldChwcm92aWRlciwgcmVxdWVzdCk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9rZWVwSXRlbShtYXA6IERlY29yYXRpb25FbnRyeSwgcHJvdmlkZXI6IElEZWNvcmF0aW9uc1Byb3ZpZGVyLCB1cmk6IFVSSSwgZGF0YTogSURlY29yYXRpb25EYXRhIHwgdW5kZWZpbmVkKTogSURlY29yYXRpb25EYXRhIHwgbnVsbCB7XG5cdFx0Y29uc3QgZGVjbyA9IGRhdGEgPyBkYXRhIDogbnVsbDtcblx0XHRjb25zdCBvbGQgPSBtYXAuZ2V0KHByb3ZpZGVyKTtcblx0XHRtYXAuc2V0KHByb3ZpZGVyLCBkZWNvKTtcblx0XHRpZiAoZGVjbyB8fCBvbGQpIHtcblx0XHRcdC8vIG9ubHkgZmlyZSBldmVudCB3aGVuIHNvbWV0aGluZyBjaGFuZ2VkXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURlY29yYXRpb25zRGVsYXllZC5maXJlKHVyaSk7XG5cdFx0fVxuXHRcdHJldHVybiBkZWNvO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElEZWNvcmF0aW9uc1NlcnZpY2UsIERlY29yYXRpb25zU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsU0FBUyx1QkFBOEI7QUFDaEQsU0FBUywyQkFBK0c7QUFDeEgsU0FBUyx5QkFBeUI7QUFDbEMsU0FBc0IsY0FBYyx1QkFBdUI7QUFDM0QsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0IsZUFBZSx3Q0FBd0M7QUFDbEYsWUFBWSxjQUFjO0FBQzFCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLFlBQVk7QUFDckIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxTQUFTLGdCQUFnQjtB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
