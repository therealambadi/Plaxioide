import { Iterable } from "../../../../base/common/iterator.js";
import { isLinux, isMacintosh, isWindows } from "../../../../base/common/platform.js";
const _ConfigurationResolverExpression = class _ConfigurationResolverExpression {
  constructor(object) {
    this.locations = /* @__PURE__ */ new Map();
    if (typeof object === "string") {
      this.stringRoot = true;
      this.root = { value: object };
    } else {
      this.stringRoot = false;
      this.root = structuredClone(object);
    }
  }
  /**
   * Creates a new {@link ConfigurationResolverExpression} from an object.
   * Note that platform-specific keys (i.e. `windows`, `osx`, `linux`) are
   * applied during parsing.
   */
  static parse(object) {
    if (object instanceof _ConfigurationResolverExpression) {
      return object;
    }
    const expr = new _ConfigurationResolverExpression(object);
    expr.applyPlatformSpecificKeys();
    expr.parseObject(expr.root);
    return expr;
  }
  applyPlatformSpecificKeys() {
    const config = this.root;
    const key = isWindows ? "windows" : isMacintosh ? "osx" : isLinux ? "linux" : void 0;
    if (key === void 0 || !config || typeof config !== "object" || !config.hasOwnProperty(key)) {
      return;
    }
    Object.keys(config[key]).forEach((k) => config[k] = config[key][k]);
    delete config.windows;
    delete config.osx;
    delete config.linux;
  }
  parseVariable(str, start) {
    if (str[start] !== "$" || str[start + 1] !== "{") {
      return void 0;
    }
    let end = start + 2;
    let braceCount = 1;
    while (end < str.length) {
      if (str[end] === "{") {
        braceCount++;
      } else if (str[end] === "}") {
        braceCount--;
        if (braceCount === 0) {
          break;
        }
      }
      end++;
    }
    if (braceCount !== 0) {
      return void 0;
    }
    const id = str.slice(start, end + 1);
    const inner = str.substring(start + 2, end);
    const colonIdx = inner.indexOf(":");
    if (colonIdx === -1) {
      return { replacement: { id, name: inner, inner }, end };
    }
    return {
      replacement: {
        id,
        inner,
        name: inner.slice(0, colonIdx),
        arg: inner.slice(colonIdx + 1)
      },
      end
    };
  }
  parseObject(obj) {
    if (typeof obj !== "object" || obj === null) {
      return;
    }
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const value = obj[i];
        if (typeof value === "string") {
          this.parseString(obj, i, value);
        } else {
          this.parseObject(value);
        }
      }
      return;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        this.parseString(obj, key, value);
      } else {
        this.parseObject(value);
      }
    }
  }
  parseString(object, propertyName, value) {
    let pos = 0;
    while (pos < value.length) {
      const match = value.indexOf("${", pos);
      if (match === -1) {
        break;
      }
      const parsed = this.parseVariable(value, match);
      if (parsed) {
        const locations = this.locations.get(parsed.replacement.id) || { locations: [], replacement: parsed.replacement };
        locations.locations.push({ object, propertyName });
        this.locations.set(parsed.replacement.id, locations);
        pos = parsed.end + 1;
      } else {
        pos = match + 2;
      }
    }
  }
  unresolved() {
    return Iterable.map(Iterable.filter(this.locations.values(), (l) => l.resolved === void 0), (l) => l.replacement);
  }
  resolved() {
    return Iterable.map(Iterable.filter(this.locations.values(), (l) => !!l.resolved), (l) => [l.replacement, l.resolved]);
  }
  resolve(replacement, data) {
    if (typeof data !== "object") {
      data = { value: String(data) };
    }
    const location = this.locations.get(replacement.id);
    if (!location) {
      return;
    }
    if (data.value !== void 0) {
      for (const { object, propertyName } of location.locations || []) {
        const newValue = object[propertyName].replaceAll(replacement.id, data.value);
        object[propertyName] = newValue;
      }
    }
    location.resolved = data;
  }
  toObject() {
    if (this.stringRoot) {
      return this.root.value;
    }
    return this.root;
  }
};
_ConfigurationResolverExpression.VARIABLE_LHS = "${";
let ConfigurationResolverExpression = _ConfigurationResolverExpression;
export {
  ConfigurationResolverExpression
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQ29uZmlndXJlZElucHV0IH0gZnJvbSAnLi9jb25maWd1cmF0aW9uUmVzb2x2ZXIuanMnO1xuXG4vKiogQSByZXBsYWNlbWVudCBmb3VuZCBpbiB0aGUgb2JqZWN0LCBhcyAke25hbWV9IG9yICR7bmFtZTphcmd9ICovXG5leHBvcnQgdHlwZSBSZXBsYWNlbWVudCA9IHtcblx0LyoqICR7bmFtZTphcmd9ICovXG5cdGlkOiBzdHJpbmc7XG5cdC8qKiBUaGUgYG5hbWU6YXJnYCBpbiAke25hbWU6YXJnfSAqL1xuXHRpbm5lcjogc3RyaW5nO1xuXHQvKiogVGhlIGBuYW1lYCBpbiAke25hbWU6YXJnfSAqL1xuXHRuYW1lOiBzdHJpbmc7XG5cdC8qKiBUaGUgYGFyZ2AgaW4gJHtuYW1lOmFyZ30gKi9cblx0YXJnPzogc3RyaW5nO1xufTtcblxuaW50ZXJmYWNlIElDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uPFQ+IHtcblx0LyoqXG5cdCAqIEdldHMgdGhlIHJlcGxhY2VtZW50cyB3aGljaCBoYXZlIG5vdCB5ZXQgYmVlblxuXHQgKiByZXNvbHZlZC5cblx0ICovXG5cdHVucmVzb2x2ZWQoKTogSXRlcmFibGU8UmVwbGFjZW1lbnQ+O1xuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSByZXBsYWNlbWVudHMgd2hpY2ggaGF2ZSBiZWVuIHJlc29sdmVkLlxuXHQgKi9cblx0cmVzb2x2ZWQoKTogSXRlcmFibGU8W1JlcGxhY2VtZW50LCBJUmVzb2x2ZWRWYWx1ZV0+O1xuXG5cdC8qKlxuXHQgKiBSZXNvbHZlcyBhIHJlcGxhY2VtZW50IGludG8gdGhlIHN0cmluZyB2YWx1ZS5cblx0ICogSWYgdGhlIHZhbHVlIGlzIHVuZGVmaW5lZCwgdGhlIG9yaWdpbmFsIHZhcmlhYmxlIHRleHQgd2lsbCBiZSBwcmVzZXJ2ZWQuXG5cdCAqL1xuXHRyZXNvbHZlKHJlcGxhY2VtZW50OiBSZXBsYWNlbWVudCwgZGF0YTogc3RyaW5nIHwgSVJlc29sdmVkVmFsdWUpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBjb21wbGV0ZSBvYmplY3QuIEFueSB1bnJlc29sdmVkIHJlcGxhY2VtZW50cyBhcmUgbGVmdCBpbnRhY3QuXG5cdCAqL1xuXHR0b09iamVjdCgpOiBUO1xufVxuXG50eXBlIFByb3BlcnR5TG9jYXRpb24gPSB7XG5cdG9iamVjdDogYW55O1xuXHRwcm9wZXJ0eU5hbWU6IHN0cmluZyB8IG51bWJlcjtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlc29sdmVkVmFsdWUge1xuXHR2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdC8qKiBQcmVzZW50IHdoZW4gdGhlIHZhcmlhYmxlIGlzIHJlc29sdmVkIGZyb20gYW4gaW5wdXQgZmllbGQuICovXG5cdGlucHV0PzogQ29uZmlndXJlZElucHV0O1xufVxuXG5pbnRlcmZhY2UgSVJlcGxhY2VtZW50TG9jYXRpb24ge1xuXHRyZXBsYWNlbWVudDogUmVwbGFjZW1lbnQ7XG5cdGxvY2F0aW9uczogUHJvcGVydHlMb2NhdGlvbltdO1xuXHRyZXNvbHZlZD86IElSZXNvbHZlZFZhbHVlO1xufVxuXG5leHBvcnQgY2xhc3MgQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbjxUPiBpbXBsZW1lbnRzIElDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uPFQ+IHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBWQVJJQUJMRV9MSFMgPSAnJHsnO1xuXG5cdHByaXZhdGUgbG9jYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIElSZXBsYWNlbWVudExvY2F0aW9uPigpO1xuXHRwcml2YXRlIHJvb3Q6IFQ7XG5cdHByaXZhdGUgc3RyaW5nUm9vdDogYm9vbGVhbjtcblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKG9iamVjdDogVCkge1xuXHRcdC8vIElmIHRoZSBpbnB1dCBpcyBhIHN0cmluZywgd3JhcCBpdCBpbiBhbiBvYmplY3Qgc28gd2UgY2FuIHVzZSB0aGUgc2FtZSBsb2dpY1xuXHRcdGlmICh0eXBlb2Ygb2JqZWN0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5zdHJpbmdSb290ID0gdHJ1ZTtcblx0XHRcdHRoaXMucm9vdCA9IHsgdmFsdWU6IG9iamVjdCB9IGFzIGFueTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zdHJpbmdSb290ID0gZmFsc2U7XG5cdFx0XHR0aGlzLnJvb3QgPSBzdHJ1Y3R1cmVkQ2xvbmUob2JqZWN0KTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyB7QGxpbmsgQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbn0gZnJvbSBhbiBvYmplY3QuXG5cdCAqIE5vdGUgdGhhdCBwbGF0Zm9ybS1zcGVjaWZpYyBrZXlzIChpLmUuIGB3aW5kb3dzYCwgYG9zeGAsIGBsaW51eGApIGFyZVxuXHQgKiBhcHBsaWVkIGR1cmluZyBwYXJzaW5nLlxuXHQgKi9cblx0cHVibGljIHN0YXRpYyBwYXJzZTxUPihvYmplY3Q6IFQpOiBDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uPFQ+IHtcblx0XHRpZiAob2JqZWN0IGluc3RhbmNlb2YgQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbikge1xuXHRcdFx0cmV0dXJuIG9iamVjdDtcblx0XHR9XG5cblx0XHRjb25zdCBleHByID0gbmV3IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb248VD4ob2JqZWN0KTtcblx0XHRleHByLmFwcGx5UGxhdGZvcm1TcGVjaWZpY0tleXMoKTtcblx0XHRleHByLnBhcnNlT2JqZWN0KGV4cHIucm9vdCk7XG5cdFx0cmV0dXJuIGV4cHI7XG5cdH1cblxuXHRwcml2YXRlIGFwcGx5UGxhdGZvcm1TcGVjaWZpY0tleXMoKSB7XG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5yb290IGFzIGFueTsgLy8gYWxyZWFkeSBjbG9uZWQgYnkgY3Rvciwgc2FmZSB0byBjaGFuZ2Vcblx0XHRjb25zdCBrZXkgPSBpc1dpbmRvd3MgPyAnd2luZG93cycgOiBpc01hY2ludG9zaCA/ICdvc3gnIDogaXNMaW51eCA/ICdsaW51eCcgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKGtleSA9PT0gdW5kZWZpbmVkIHx8ICFjb25maWcgfHwgdHlwZW9mIGNvbmZpZyAhPT0gJ29iamVjdCcgfHwgIWNvbmZpZy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0T2JqZWN0LmtleXMoY29uZmlnW2tleV0pLmZvckVhY2goayA9PiBjb25maWdba10gPSBjb25maWdba2V5XVtrXSk7XG5cblx0XHRkZWxldGUgY29uZmlnLndpbmRvd3M7XG5cdFx0ZGVsZXRlIGNvbmZpZy5vc3g7XG5cdFx0ZGVsZXRlIGNvbmZpZy5saW51eDtcblx0fVxuXG5cdHByaXZhdGUgcGFyc2VWYXJpYWJsZShzdHI6IHN0cmluZywgc3RhcnQ6IG51bWJlcik6IHsgcmVwbGFjZW1lbnQ6IFJlcGxhY2VtZW50OyBlbmQ6IG51bWJlciB9IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoc3RyW3N0YXJ0XSAhPT0gJyQnIHx8IHN0cltzdGFydCArIDFdICE9PSAneycpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0bGV0IGVuZCA9IHN0YXJ0ICsgMjtcblx0XHRsZXQgYnJhY2VDb3VudCA9IDE7XG5cdFx0d2hpbGUgKGVuZCA8IHN0ci5sZW5ndGgpIHtcblx0XHRcdGlmIChzdHJbZW5kXSA9PT0gJ3snKSB7XG5cdFx0XHRcdGJyYWNlQ291bnQrKztcblx0XHRcdH0gZWxzZSBpZiAoc3RyW2VuZF0gPT09ICd9Jykge1xuXHRcdFx0XHRicmFjZUNvdW50LS07XG5cdFx0XHRcdGlmIChicmFjZUNvdW50ID09PSAwKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGVuZCsrO1xuXHRcdH1cblxuXHRcdGlmIChicmFjZUNvdW50ICE9PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlkID0gc3RyLnNsaWNlKHN0YXJ0LCBlbmQgKyAxKTtcblx0XHRjb25zdCBpbm5lciA9IHN0ci5zdWJzdHJpbmcoc3RhcnQgKyAyLCBlbmQpO1xuXHRcdGNvbnN0IGNvbG9uSWR4ID0gaW5uZXIuaW5kZXhPZignOicpO1xuXHRcdGlmIChjb2xvbklkeCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiB7IHJlcGxhY2VtZW50OiB7IGlkLCBuYW1lOiBpbm5lciwgaW5uZXIgfSwgZW5kIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlcGxhY2VtZW50OiB7XG5cdFx0XHRcdGlkLFxuXHRcdFx0XHRpbm5lcixcblx0XHRcdFx0bmFtZTogaW5uZXIuc2xpY2UoMCwgY29sb25JZHgpLFxuXHRcdFx0XHRhcmc6IGlubmVyLnNsaWNlKGNvbG9uSWR4ICsgMSlcblx0XHRcdH0sXG5cdFx0XHRlbmRcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBwYXJzZU9iamVjdChvYmo6IGFueSk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCBvYmogPT09IG51bGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG9iai5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IG9ialtpXTtcblx0XHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHR0aGlzLnBhcnNlU3RyaW5nKG9iaiwgaSwgdmFsdWUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMucGFyc2VPYmplY3QodmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMob2JqKSkge1xuXHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0dGhpcy5wYXJzZVN0cmluZyhvYmosIGtleSwgdmFsdWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5wYXJzZU9iamVjdCh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBwYXJzZVN0cmluZyhvYmplY3Q6IGFueSwgcHJvcGVydHlOYW1lOiBzdHJpbmcgfCBudW1iZXIsIHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRsZXQgcG9zID0gMDtcblx0XHR3aGlsZSAocG9zIDwgdmFsdWUubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBtYXRjaCA9IHZhbHVlLmluZGV4T2YoJyR7JywgcG9zKTtcblx0XHRcdGlmIChtYXRjaCA9PT0gLTEpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwYXJzZWQgPSB0aGlzLnBhcnNlVmFyaWFibGUodmFsdWUsIG1hdGNoKTtcblx0XHRcdGlmIChwYXJzZWQpIHtcblx0XHRcdFx0Y29uc3QgbG9jYXRpb25zID0gdGhpcy5sb2NhdGlvbnMuZ2V0KHBhcnNlZC5yZXBsYWNlbWVudC5pZCkgfHwgeyBsb2NhdGlvbnM6IFtdLCByZXBsYWNlbWVudDogcGFyc2VkLnJlcGxhY2VtZW50IH07XG5cdFx0XHRcdGxvY2F0aW9ucy5sb2NhdGlvbnMucHVzaCh7IG9iamVjdCwgcHJvcGVydHlOYW1lIH0pO1xuXHRcdFx0XHR0aGlzLmxvY2F0aW9ucy5zZXQocGFyc2VkLnJlcGxhY2VtZW50LmlkLCBsb2NhdGlvbnMpO1xuXHRcdFx0XHRwb3MgPSBwYXJzZWQuZW5kICsgMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBvcyA9IG1hdGNoICsgMjtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgdW5yZXNvbHZlZCgpOiBJdGVyYWJsZTxSZXBsYWNlbWVudD4ge1xuXHRcdHJldHVybiBJdGVyYWJsZS5tYXAoSXRlcmFibGUuZmlsdGVyKHRoaXMubG9jYXRpb25zLnZhbHVlcygpLCBsID0+IGwucmVzb2x2ZWQgPT09IHVuZGVmaW5lZCksIGwgPT4gbC5yZXBsYWNlbWVudCk7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZWQoKTogSXRlcmFibGU8W1JlcGxhY2VtZW50LCBJUmVzb2x2ZWRWYWx1ZV0+IHtcblx0XHRyZXR1cm4gSXRlcmFibGUubWFwKEl0ZXJhYmxlLmZpbHRlcih0aGlzLmxvY2F0aW9ucy52YWx1ZXMoKSwgbCA9PiAhIWwucmVzb2x2ZWQpLCBsID0+IFtsLnJlcGxhY2VtZW50LCBsLnJlc29sdmVkIV0pO1xuXHR9XG5cblx0cHVibGljIHJlc29sdmUocmVwbGFjZW1lbnQ6IFJlcGxhY2VtZW50LCBkYXRhOiBzdHJpbmcgfCBJUmVzb2x2ZWRWYWx1ZSk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgZGF0YSAhPT0gJ29iamVjdCcpIHtcblx0XHRcdGRhdGEgPSB7IHZhbHVlOiBTdHJpbmcoZGF0YSkgfTtcblx0XHR9XG5cblx0XHRjb25zdCBsb2NhdGlvbiA9IHRoaXMubG9jYXRpb25zLmdldChyZXBsYWNlbWVudC5pZCk7XG5cdFx0aWYgKCFsb2NhdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChkYXRhLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGZvciAoY29uc3QgeyBvYmplY3QsIHByb3BlcnR5TmFtZSB9IG9mIGxvY2F0aW9uLmxvY2F0aW9ucyB8fCBbXSkge1xuXHRcdFx0XHRjb25zdCBuZXdWYWx1ZSA9IG9iamVjdFtwcm9wZXJ0eU5hbWVdLnJlcGxhY2VBbGwocmVwbGFjZW1lbnQuaWQsIGRhdGEudmFsdWUpO1xuXHRcdFx0XHRvYmplY3RbcHJvcGVydHlOYW1lXSA9IG5ld1ZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxvY2F0aW9uLnJlc29sdmVkID0gZGF0YTtcblx0fVxuXG5cdHB1YmxpYyB0b09iamVjdCgpOiBUIHtcblx0XHQvLyBJZiB3ZSB3cmFwcGVkIGEgc3RyaW5nLCB1bndyYXAgaXRcblx0XHRpZiAodGhpcy5zdHJpbmdSb290KSB7XG5cdFx0XHRyZXR1cm4gKHRoaXMucm9vdCBhcyBhbnkpLnZhbHVlIGFzIFQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucm9vdDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxTQUFTLGFBQWEsaUJBQWlCO0FBeUR6QyxNQUFNLG1DQUFOLE1BQU0saUNBQWtGO0FBQUEsRUFPdEYsWUFBWSxRQUFX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
