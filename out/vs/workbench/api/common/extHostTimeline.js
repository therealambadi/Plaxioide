import { URI } from "../../../base/common/uri.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { MainContext } from "./extHost.protocol.js";
import { toDisposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { ThemeIcon, MarkdownString as MarkdownStringType } from "./extHostTypes.js";
import { MarkdownString } from "./extHostTypeConverters.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { isString } from "../../../base/common/types.js";
import { isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
const IExtHostTimeline = createDecorator("IExtHostTimeline");
class ExtHostTimeline {
  constructor(mainContext, commands) {
    this._providers = /* @__PURE__ */ new Map();
    this._itemsBySourceAndUriMap = /* @__PURE__ */ new Map();
    this._proxy = mainContext.getProxy(MainContext.MainThreadTimeline);
    commands.registerArgumentProcessor({
      processArgument: (arg, extension) => {
        if (arg && arg.$mid === MarshalledId.TimelineActionContext) {
          if (this._providers.get(arg.source) && extension && isProposedApiEnabled(extension, "timeline")) {
            const uri = arg.uri === void 0 ? void 0 : URI.revive(arg.uri);
            return this._itemsBySourceAndUriMap.get(arg.source)?.get(getUriKey(uri))?.get(arg.handle);
          } else {
            return void 0;
          }
        }
        return arg;
      }
    });
  }
  async $getTimeline(id, uri, options, token) {
    const item = this._providers.get(id);
    return item?.provider.provideTimeline(URI.revive(uri), options, token);
  }
  registerTimelineProvider(scheme, provider, extensionId, commandConverter) {
    const timelineDisposables = new DisposableStore();
    const convertTimelineItem = this.convertTimelineItem(provider.id, commandConverter, timelineDisposables).bind(this);
    let disposable;
    if (provider.onDidChange) {
      disposable = provider.onDidChange((e) => this._proxy.$emitTimelineChangeEvent({ uri: void 0, reset: true, ...e, id: provider.id }), this);
    }
    const itemsBySourceAndUriMap = this._itemsBySourceAndUriMap;
    return this.registerTimelineProviderCore({
      ...provider,
      scheme,
      onDidChange: void 0,
      async provideTimeline(uri, options, token) {
        if (options?.resetCache) {
          timelineDisposables.clear();
          itemsBySourceAndUriMap.get(provider.id)?.clear();
        }
        const result = await provider.provideTimeline(uri, options, token);
        if (result === void 0 || result === null) {
          return void 0;
        }
        const convertItem = convertTimelineItem(uri, options);
        return {
          ...result,
          source: provider.id,
          items: result.items.map(convertItem)
        };
      },
      dispose() {
        for (const sourceMap of itemsBySourceAndUriMap.values()) {
          sourceMap.get(provider.id)?.clear();
        }
        disposable?.dispose();
        timelineDisposables.dispose();
      }
    }, extensionId);
  }
  convertTimelineItem(source, commandConverter, disposables) {
    return (uri, options) => {
      let items;
      if (options?.cacheResults) {
        let itemsByUri = this._itemsBySourceAndUriMap.get(source);
        if (itemsByUri === void 0) {
          itemsByUri = /* @__PURE__ */ new Map();
          this._itemsBySourceAndUriMap.set(source, itemsByUri);
        }
        const uriKey = getUriKey(uri);
        items = itemsByUri.get(uriKey);
        if (items === void 0) {
          items = /* @__PURE__ */ new Map();
          itemsByUri.set(uriKey, items);
        }
      }
      return (item) => {
        const { iconPath, ...props } = item;
        const handle = `${source}|${item.id ?? item.timestamp}`;
        items?.set(handle, item);
        let icon;
        let iconDark;
        let themeIcon;
        if (item.iconPath) {
          if (iconPath instanceof ThemeIcon) {
            themeIcon = { id: iconPath.id, color: iconPath.color };
          } else if (URI.isUri(iconPath)) {
            icon = iconPath;
            iconDark = iconPath;
          } else {
            ({ light: icon, dark: iconDark } = iconPath);
          }
        }
        let tooltip;
        if (MarkdownStringType.isMarkdownString(props.tooltip)) {
          tooltip = MarkdownString.from(props.tooltip);
        } else if (isString(props.tooltip)) {
          tooltip = props.tooltip;
        } else if (MarkdownStringType.isMarkdownString(props.detail)) {
          console.warn("Using deprecated TimelineItem.detail, migrate to TimelineItem.tooltip");
          tooltip = MarkdownString.from(props.detail);
        } else if (isString(props.detail)) {
          console.warn("Using deprecated TimelineItem.detail, migrate to TimelineItem.tooltip");
          tooltip = props.detail;
        }
        return {
          ...props,
          id: props.id ?? void 0,
          handle,
          source,
          command: item.command ? commandConverter.toInternal(item.command, disposables) : void 0,
          icon,
          iconDark,
          themeIcon,
          tooltip,
          accessibilityInformation: item.accessibilityInformation
        };
      };
    };
  }
  registerTimelineProviderCore(provider, extension) {
    const existing = this._providers.get(provider.id);
    if (existing) {
      throw new Error(`Timeline Provider ${provider.id} already exists.`);
    }
    this._proxy.$registerTimelineProvider({
      id: provider.id,
      label: provider.label,
      scheme: provider.scheme
    });
    this._providers.set(provider.id, { provider, extension });
    return toDisposable(() => {
      for (const sourceMap of this._itemsBySourceAndUriMap.values()) {
        sourceMap.get(provider.id)?.clear();
      }
      this._providers.delete(provider.id);
      this._proxy.$unregisterTimelineProvider(provider.id);
      provider.dispose();
    });
  }
}
function getUriKey(uri) {
  return uri?.toString();
}
export {
  ExtHostTimeline,
  IExtHostTimeline
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VGltZWxpbmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IFVyaUNvbXBvbmVudHMsIFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEV4dEhvc3RUaW1lbGluZVNoYXBlLCBNYWluVGhyZWFkVGltZWxpbmVTaGFwZSwgSU1haW5Db250ZXh0LCBNYWluQ29udGV4dCB9IGZyb20gJy4vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBUaW1lbGluZSwgVGltZWxpbmVJdGVtLCBUaW1lbGluZU9wdGlvbnMsIFRpbWVsaW5lUHJvdmlkZXIgfSBmcm9tICcuLi8uLi9jb250cmliL3RpbWVsaW5lL2NvbW1vbi90aW1lbGluZS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNDb252ZXJ0ZXIsIEV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4vZXh0SG9zdENvbW1hbmRzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiwgTWFya2Rvd25TdHJpbmcgYXMgTWFya2Rvd25TdHJpbmdUeXBlIH0gZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuL2V4dEhvc3RUeXBlQ29udmVydGVycy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IGlzUHJvcG9zZWRBcGlFbmFibGVkIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dEhvc3RUaW1lbGluZSBleHRlbmRzIEV4dEhvc3RUaW1lbGluZVNoYXBlIHtcblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHQkZ2V0VGltZWxpbmUoaWQ6IHN0cmluZywgdXJpOiBVcmlDb21wb25lbnRzLCBvcHRpb25zOiB2c2NvZGUuVGltZWxpbmVPcHRpb25zLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUaW1lbGluZSB8IHVuZGVmaW5lZD47XG59XG5cbmV4cG9ydCBjb25zdCBJRXh0SG9zdFRpbWVsaW5lID0gY3JlYXRlRGVjb3JhdG9yPElFeHRIb3N0VGltZWxpbmU+KCdJRXh0SG9zdFRpbWVsaW5lJyk7XG5cbmV4cG9ydCBjbGFzcyBFeHRIb3N0VGltZWxpbmUgaW1wbGVtZW50cyBJRXh0SG9zdFRpbWVsaW5lIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfcHJveHk6IE1haW5UaHJlYWRUaW1lbGluZVNoYXBlO1xuXG5cdHByaXZhdGUgX3Byb3ZpZGVycyA9IG5ldyBNYXA8c3RyaW5nLCB7IHByb3ZpZGVyOiBUaW1lbGluZVByb3ZpZGVyOyBleHRlbnNpb246IEV4dGVuc2lvbklkZW50aWZpZXIgfT4oKTtcblxuXHRwcml2YXRlIF9pdGVtc0J5U291cmNlQW5kVXJpTWFwID0gbmV3IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcgfCB1bmRlZmluZWQsIE1hcDxzdHJpbmcsIHZzY29kZS5UaW1lbGluZUl0ZW0+Pj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtYWluQ29udGV4dDogSU1haW5Db250ZXh0LFxuXHRcdGNvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHMsXG5cdCkge1xuXHRcdHRoaXMuX3Byb3h5ID0gbWFpbkNvbnRleHQuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZFRpbWVsaW5lKTtcblxuXHRcdGNvbW1hbmRzLnJlZ2lzdGVyQXJndW1lbnRQcm9jZXNzb3Ioe1xuXHRcdFx0cHJvY2Vzc0FyZ3VtZW50OiAoYXJnLCBleHRlbnNpb24pID0+IHtcblx0XHRcdFx0aWYgKGFyZyAmJiBhcmcuJG1pZCA9PT0gTWFyc2hhbGxlZElkLlRpbWVsaW5lQWN0aW9uQ29udGV4dCkge1xuXHRcdFx0XHRcdGlmICh0aGlzLl9wcm92aWRlcnMuZ2V0KGFyZy5zb3VyY2UpICYmIGV4dGVuc2lvbiAmJiBpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0aW1lbGluZScpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB1cmkgPSBhcmcudXJpID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBVUkkucmV2aXZlKGFyZy51cmkpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2l0ZW1zQnlTb3VyY2VBbmRVcmlNYXAuZ2V0KGFyZy5zb3VyY2UpPy5nZXQoZ2V0VXJpS2V5KHVyaSkpPy5nZXQoYXJnLmhhbmRsZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBhcmc7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyAkZ2V0VGltZWxpbmUoaWQ6IHN0cmluZywgdXJpOiBVcmlDb21wb25lbnRzLCBvcHRpb25zOiB2c2NvZGUuVGltZWxpbmVPcHRpb25zLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUaW1lbGluZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGl0ZW0gPSB0aGlzLl9wcm92aWRlcnMuZ2V0KGlkKTtcblx0XHRyZXR1cm4gaXRlbT8ucHJvdmlkZXIucHJvdmlkZVRpbWVsaW5lKFVSSS5yZXZpdmUodXJpKSwgb3B0aW9ucywgdG9rZW4pO1xuXHR9XG5cblx0cmVnaXN0ZXJUaW1lbGluZVByb3ZpZGVyKHNjaGVtZTogc3RyaW5nIHwgc3RyaW5nW10sIHByb3ZpZGVyOiB2c2NvZGUuVGltZWxpbmVQcm92aWRlciwgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGNvbW1hbmRDb252ZXJ0ZXI6IENvbW1hbmRzQ29udmVydGVyKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHRpbWVsaW5lRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBjb252ZXJ0VGltZWxpbmVJdGVtID0gdGhpcy5jb252ZXJ0VGltZWxpbmVJdGVtKHByb3ZpZGVyLmlkLCBjb21tYW5kQ29udmVydGVyLCB0aW1lbGluZURpc3Bvc2FibGVzKS5iaW5kKHRoaXMpO1xuXG5cdFx0bGV0IGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChwcm92aWRlci5vbkRpZENoYW5nZSkge1xuXHRcdFx0ZGlzcG9zYWJsZSA9IHByb3ZpZGVyLm9uRGlkQ2hhbmdlKGUgPT4gdGhpcy5fcHJveHkuJGVtaXRUaW1lbGluZUNoYW5nZUV2ZW50KHsgdXJpOiB1bmRlZmluZWQsIHJlc2V0OiB0cnVlLCAuLi5lLCBpZDogcHJvdmlkZXIuaWQgfSksIHRoaXMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGl0ZW1zQnlTb3VyY2VBbmRVcmlNYXAgPSB0aGlzLl9pdGVtc0J5U291cmNlQW5kVXJpTWFwO1xuXHRcdHJldHVybiB0aGlzLnJlZ2lzdGVyVGltZWxpbmVQcm92aWRlckNvcmUoe1xuXHRcdFx0Li4ucHJvdmlkZXIsXG5cdFx0XHRzY2hlbWU6IHNjaGVtZSxcblx0XHRcdG9uRGlkQ2hhbmdlOiB1bmRlZmluZWQsXG5cdFx0XHRhc3luYyBwcm92aWRlVGltZWxpbmUodXJpOiBVUkksIG9wdGlvbnM6IFRpbWVsaW5lT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0XHRcdGlmIChvcHRpb25zPy5yZXNldENhY2hlKSB7XG5cdFx0XHRcdFx0dGltZWxpbmVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0XHRcdFx0Ly8gRm9yIG5vdywgb25seSBhbGxvdyB0aGUgY2FjaGluZyBvZiBhIHNpbmdsZSBVcmlcblx0XHRcdFx0XHQvLyBpdGVtc0J5U291cmNlQW5kVXJpTWFwLmdldChwcm92aWRlci5pZCk/LmdldChnZXRVcmlLZXkodXJpKSk/LmNsZWFyKCk7XG5cdFx0XHRcdFx0aXRlbXNCeVNvdXJjZUFuZFVyaU1hcC5nZXQocHJvdmlkZXIuaWQpPy5jbGVhcigpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZVRpbWVsaW5lKHVyaSwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0XHRpZiAocmVzdWx0ID09PSB1bmRlZmluZWQgfHwgcmVzdWx0ID09PSBudWxsKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFRPRE86IFNob3VsZCB3ZSBib3RoZXIgY29udmVydGluZyBhbGwgdGhlIGRhdGEgaWYgd2UgYXJlbid0IGNhY2hpbmc/IE1lYW5pbmcgaXQgaXMgYmVpbmcgcmVxdWVzdGVkIGJ5IGFuIGV4dGVuc2lvbj9cblxuXHRcdFx0XHRjb25zdCBjb252ZXJ0SXRlbSA9IGNvbnZlcnRUaW1lbGluZUl0ZW0odXJpLCBvcHRpb25zKTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHQuLi5yZXN1bHQsXG5cdFx0XHRcdFx0c291cmNlOiBwcm92aWRlci5pZCxcblx0XHRcdFx0XHRpdGVtczogcmVzdWx0Lml0ZW1zLm1hcChjb252ZXJ0SXRlbSlcblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHNvdXJjZU1hcCBvZiBpdGVtc0J5U291cmNlQW5kVXJpTWFwLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0c291cmNlTWFwLmdldChwcm92aWRlci5pZCk/LmNsZWFyKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRkaXNwb3NhYmxlPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRpbWVsaW5lRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0sIGV4dGVuc2lvbklkKTtcblx0fVxuXG5cdHByaXZhdGUgY29udmVydFRpbWVsaW5lSXRlbShzb3VyY2U6IHN0cmluZywgY29tbWFuZENvbnZlcnRlcjogQ29tbWFuZHNDb252ZXJ0ZXIsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpIHtcblx0XHRyZXR1cm4gKHVyaTogVVJJLCBvcHRpb25zPzogVGltZWxpbmVPcHRpb25zKSA9PiB7XG5cdFx0XHRsZXQgaXRlbXM6IE1hcDxzdHJpbmcsIHZzY29kZS5UaW1lbGluZUl0ZW0+IHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKG9wdGlvbnM/LmNhY2hlUmVzdWx0cykge1xuXHRcdFx0XHRsZXQgaXRlbXNCeVVyaSA9IHRoaXMuX2l0ZW1zQnlTb3VyY2VBbmRVcmlNYXAuZ2V0KHNvdXJjZSk7XG5cdFx0XHRcdGlmIChpdGVtc0J5VXJpID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRpdGVtc0J5VXJpID0gbmV3IE1hcCgpO1xuXHRcdFx0XHRcdHRoaXMuX2l0ZW1zQnlTb3VyY2VBbmRVcmlNYXAuc2V0KHNvdXJjZSwgaXRlbXNCeVVyaSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB1cmlLZXkgPSBnZXRVcmlLZXkodXJpKTtcblx0XHRcdFx0aXRlbXMgPSBpdGVtc0J5VXJpLmdldCh1cmlLZXkpO1xuXHRcdFx0XHRpZiAoaXRlbXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGl0ZW1zID0gbmV3IE1hcCgpO1xuXHRcdFx0XHRcdGl0ZW1zQnlVcmkuc2V0KHVyaUtleSwgaXRlbXMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAoaXRlbTogdnNjb2RlLlRpbWVsaW5lSXRlbSk6IFRpbWVsaW5lSXRlbSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgaWNvblBhdGgsIC4uLnByb3BzIH0gPSBpdGVtO1xuXG5cdFx0XHRcdGNvbnN0IGhhbmRsZSA9IGAke3NvdXJjZX18JHtpdGVtLmlkID8/IGl0ZW0udGltZXN0YW1wfWA7XG5cdFx0XHRcdGl0ZW1zPy5zZXQoaGFuZGxlLCBpdGVtKTtcblxuXHRcdFx0XHRsZXQgaWNvbjtcblx0XHRcdFx0bGV0IGljb25EYXJrO1xuXHRcdFx0XHRsZXQgdGhlbWVJY29uO1xuXHRcdFx0XHRpZiAoaXRlbS5pY29uUGF0aCkge1xuXHRcdFx0XHRcdGlmIChpY29uUGF0aCBpbnN0YW5jZW9mIFRoZW1lSWNvbikge1xuXHRcdFx0XHRcdFx0dGhlbWVJY29uID0geyBpZDogaWNvblBhdGguaWQsIGNvbG9yOiBpY29uUGF0aC5jb2xvciB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIGlmIChVUkkuaXNVcmkoaWNvblBhdGgpKSB7XG5cdFx0XHRcdFx0XHRpY29uID0gaWNvblBhdGg7XG5cdFx0XHRcdFx0XHRpY29uRGFyayA9IGljb25QYXRoO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdCh7IGxpZ2h0OiBpY29uLCBkYXJrOiBpY29uRGFyayB9ID0gaWNvblBhdGggYXMgeyBsaWdodDogVVJJOyBkYXJrOiBVUkkgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IHRvb2x0aXA7XG5cdFx0XHRcdGlmIChNYXJrZG93blN0cmluZ1R5cGUuaXNNYXJrZG93blN0cmluZyhwcm9wcy50b29sdGlwKSkge1xuXHRcdFx0XHRcdHRvb2x0aXAgPSBNYXJrZG93blN0cmluZy5mcm9tKHByb3BzLnRvb2x0aXApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKGlzU3RyaW5nKHByb3BzLnRvb2x0aXApKSB7XG5cdFx0XHRcdFx0dG9vbHRpcCA9IHByb3BzLnRvb2x0aXA7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gVE9ETyBAamtlYXJsLCByZW1vdmUgb25jZSBtaWdyYXRpb24gY29tcGxldGUuXG5cdFx0XHRcdGVsc2UgaWYgKE1hcmtkb3duU3RyaW5nVHlwZS5pc01hcmtkb3duU3RyaW5nKChwcm9wcyBhcyBhbnkpLmRldGFpbCkpIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oJ1VzaW5nIGRlcHJlY2F0ZWQgVGltZWxpbmVJdGVtLmRldGFpbCwgbWlncmF0ZSB0byBUaW1lbGluZUl0ZW0udG9vbHRpcCcpO1xuXHRcdFx0XHRcdHRvb2x0aXAgPSBNYXJrZG93blN0cmluZy5mcm9tKChwcm9wcyBhcyBhbnkpLmRldGFpbCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAoaXNTdHJpbmcoKHByb3BzIGFzIGFueSkuZGV0YWlsKSkge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybignVXNpbmcgZGVwcmVjYXRlZCBUaW1lbGluZUl0ZW0uZGV0YWlsLCBtaWdyYXRlIHRvIFRpbWVsaW5lSXRlbS50b29sdGlwJyk7XG5cdFx0XHRcdFx0dG9vbHRpcCA9IChwcm9wcyBhcyBhbnkpLmRldGFpbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Li4ucHJvcHMsXG5cdFx0XHRcdFx0aWQ6IHByb3BzLmlkID8/IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRoYW5kbGU6IGhhbmRsZSxcblx0XHRcdFx0XHRzb3VyY2U6IHNvdXJjZSxcblx0XHRcdFx0XHRjb21tYW5kOiBpdGVtLmNvbW1hbmQgPyBjb21tYW5kQ29udmVydGVyLnRvSW50ZXJuYWwoaXRlbS5jb21tYW5kLCBkaXNwb3NhYmxlcykgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0aWNvbjogaWNvbixcblx0XHRcdFx0XHRpY29uRGFyazogaWNvbkRhcmssXG5cdFx0XHRcdFx0dGhlbWVJY29uOiB0aGVtZUljb24sXG5cdFx0XHRcdFx0dG9vbHRpcCxcblx0XHRcdFx0XHRhY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb246IGl0ZW0uYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uXG5cdFx0XHRcdH07XG5cdFx0XHR9O1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVGltZWxpbmVQcm92aWRlckNvcmUocHJvdmlkZXI6IFRpbWVsaW5lUHJvdmlkZXIsIGV4dGVuc2lvbjogRXh0ZW5zaW9uSWRlbnRpZmllcik6IElEaXNwb3NhYmxlIHtcblx0XHQvLyBjb25zb2xlLmxvZyhgRXh0SG9zdFRpbWVsaW5lI3JlZ2lzdGVyVGltZWxpbmVQcm92aWRlcjogaWQ9JHtwcm92aWRlci5pZH1gKTtcblxuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5fcHJvdmlkZXJzLmdldChwcm92aWRlci5pZCk7XG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRpbWVsaW5lIFByb3ZpZGVyICR7cHJvdmlkZXIuaWR9IGFscmVhZHkgZXhpc3RzLmApO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlclRpbWVsaW5lUHJvdmlkZXIoe1xuXHRcdFx0aWQ6IHByb3ZpZGVyLmlkLFxuXHRcdFx0bGFiZWw6IHByb3ZpZGVyLmxhYmVsLFxuXHRcdFx0c2NoZW1lOiBwcm92aWRlci5zY2hlbWVcblx0XHR9KTtcblx0XHR0aGlzLl9wcm92aWRlcnMuc2V0KHByb3ZpZGVyLmlkLCB7IHByb3ZpZGVyLCBleHRlbnNpb24gfSk7XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGZvciAoY29uc3Qgc291cmNlTWFwIG9mIHRoaXMuX2l0ZW1zQnlTb3VyY2VBbmRVcmlNYXAudmFsdWVzKCkpIHtcblx0XHRcdFx0c291cmNlTWFwLmdldChwcm92aWRlci5pZCk/LmNsZWFyKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3Byb3ZpZGVycy5kZWxldGUocHJvdmlkZXIuaWQpO1xuXHRcdFx0dGhpcy5fcHJveHkuJHVucmVnaXN0ZXJUaW1lbGluZVByb3ZpZGVyKHByb3ZpZGVyLmlkKTtcblx0XHRcdHByb3ZpZGVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRVcmlLZXkodXJpOiBVUkkgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gdXJpPy50b1N0cmluZygpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBd0IsV0FBVztBQUNuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFzRSxtQkFBbUI7QUFFekYsU0FBc0IsY0FBYyx1QkFBdUI7QUFHM0QsU0FBUyxXQUFXLGtCQUFrQiwwQkFBMEI7QUFDaEUsU0FBUyxzQkFBc0I7QUFFL0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw0QkFBNEI7QUFPOUIsTUFBTSxtQkFBbUIsZ0JBQWtDLGtCQUFrQjtBQUU3RSxNQUFNLGdCQUE0QztBQUFBLEVBU3hELFlBQ0MsYUFDQSxVQUNDO0FBUEYsU0FBUSxhQUFhLG9CQUFJLElBQTRFO0FBRXJHLFNBQVEsMEJBQTBCLG9CQUFJLElBQXVFO0FBTTVHLFNBQUssU0FBUyxZQUFZLFNBQVMsWUFBWSxrQkFBa0I7QUFFakUsYUFBUywwQkFBMEI7QUFBQSxNQUNsQyxpQkFBaUIsQ0FBQyxLQUFLLGNBQWM7QUFDcEMsWUFBSSxPQUFPLElBQUksU0FBUyxhQUFhLHVCQUF1QjtBQUMzRCxjQUFJLEtBQUssV0FBVyxJQUFJLElBQUksTUFBTSxLQUFLLGFBQWEscUJBQXFCLFdBQVcsVUFBVSxHQUFHO0FBQ2hHLGtCQUFNLE1BQU0sSUFBSSxRQUFRLFNBQVksU0FBWSxJQUFJLE9BQU8sSUFBSSxHQUFHO0FBQ2xFLG1CQUFPLEtBQUssd0JBQXdCLElBQUksSUFBSSxNQUFNLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksSUFBSSxNQUFNO0FBQUEsVUFDekYsT0FBTztBQUNOLG1CQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0Q7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLE1BQU0sYUFBYSxJQUFZLEtBQW9CLFNBQWlDLE9BQWdFO0FBQ25KLFVBQU0sT0FBTyxLQUFLLFdBQVcsSUFBSSxFQUFFO0FBQ25DLFdBQU8sTUFBTSxTQUFTLGdCQUFnQixJQUFJLE9BQU8sR0FBRyxHQUFHLFNBQVMsS0FBSztBQUFBLEVBQ3RFO0FBQUEsRUFFQSx5QkFBeUIsUUFBMkIsVUFBbUMsYUFBa0Msa0JBQWtEO0FBQzFLLFVBQU0sc0JBQXNCLElBQUksZ0JBQWdCO0FBRWhELFVBQU0sc0JBQXNCLEtBQUssb0JBQW9CLFNBQVMsSUFBSSxrQkFBa0IsbUJBQW1CLEVBQUUsS0FBSyxJQUFJO0FBRWxILFFBQUk7QUFDSixRQUFJLFNBQVMsYUFBYTtBQUN6QixtQkFBYSxTQUFTLFlBQVksT0FBSyxLQUFLLE9BQU8seUJBQXlCLEVBQUUsS0FBSyxRQUFXLE9BQU8sTUFBTSxHQUFHLEdBQUcsSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLElBQUk7QUFBQSxJQUMxSTtBQUVBLFVBQU0seUJBQXlCLEtBQUs7QUFDcEMsV0FBTyxLQUFLLDZCQUE2QjtBQUFBLE1BQ3hDLEdBQUc7QUFBQSxNQUNIO0FBQUEsTUFDQSxhQUFhO0FBQUEsTUFDYixNQUFNLGdCQUFnQixLQUFVLFNBQTBCLE9BQTBCO0FBQ25GLFlBQUksU0FBUyxZQUFZO0FBQ3hCLDhCQUFvQixNQUFNO0FBSTFCLGlDQUF1QixJQUFJLFNBQVMsRUFBRSxHQUFHLE1BQU07QUFBQSxRQUNoRDtBQUVBLGNBQU0sU0FBUyxNQUFNLFNBQVMsZ0JBQWdCLEtBQUssU0FBUyxLQUFLO0FBQ2pFLFlBQUksV0FBVyxVQUFhLFdBQVcsTUFBTTtBQUM1QyxpQkFBTztBQUFBLFFBQ1I7QUFJQSxjQUFNLGNBQWMsb0JBQW9CLEtBQUssT0FBTztBQUNwRCxlQUFPO0FBQUEsVUFDTixHQUFHO0FBQUEsVUFDSCxRQUFRLFNBQVM7QUFBQSxVQUNqQixPQUFPLE9BQU8sTUFBTSxJQUFJLFdBQVc7QUFBQSxRQUNwQztBQUFBLE1BQ0Q7QUFBQSxNQUNBLFVBQVU7QUFDVCxtQkFBVyxhQUFhLHVCQUF1QixPQUFPLEdBQUc7QUFDeEQsb0JBQVUsSUFBSSxTQUFTLEVBQUUsR0FBRyxNQUFNO0FBQUEsUUFDbkM7QUFFQSxvQkFBWSxRQUFRO0FBQ3BCLDRCQUFvQixRQUFRO0FBQUEsTUFDN0I7QUFBQSxJQUNELEdBQUcsV0FBVztBQUFBLEVBQ2Y7QUFBQSxFQUVRLG9CQUFvQixRQUFnQixrQkFBcUMsYUFBOEI7QUFDOUcsV0FBTyxDQUFDLEtBQVUsWUFBOEI7QUFDL0MsVUFBSTtBQUNKLFVBQUksU0FBUyxjQUFjO0FBQzFCLFlBQUksYUFBYSxLQUFLLHdCQUF3QixJQUFJLE1BQU07QUFDeEQsWUFBSSxlQUFlLFFBQVc7QUFDN0IsdUJBQWEsb0JBQUksSUFBSTtBQUNyQixlQUFLLHdCQUF3QixJQUFJLFFBQVEsVUFBVTtBQUFBLFFBQ3BEO0FBRUEsY0FBTSxTQUFTLFVBQVUsR0FBRztBQUM1QixnQkFBUSxXQUFXLElBQUksTUFBTTtBQUM3QixZQUFJLFVBQVUsUUFBVztBQUN4QixrQkFBUSxvQkFBSSxJQUFJO0FBQ2hCLHFCQUFXLElBQUksUUFBUSxLQUFLO0FBQUEsUUFDN0I7QUFBQSxNQUNEO0FBRUEsYUFBTyxDQUFDLFNBQTRDO0FBQ25ELGNBQU0sRUFBRSxVQUFVLEdBQUcsTUFBTSxJQUFJO0FBRS9CLGNBQU0sU0FBUyxHQUFHLE1BQU0sSUFBSSxLQUFLLE1BQU0sS0FBSyxTQUFTO0FBQ3JELGVBQU8sSUFBSSxRQUFRLElBQUk7QUFFdkIsWUFBSTtBQUNKLFlBQUk7QUFDSixZQUFJO0FBQ0osWUFBSSxLQUFLLFVBQVU7QUFDbEIsY0FBSSxvQkFBb0IsV0FBVztBQUNsQyx3QkFBWSxFQUFFLElBQUksU0FBUyxJQUFJLE9BQU8sU0FBUyxNQUFNO0FBQUEsVUFDdEQsV0FDUyxJQUFJLE1BQU0sUUFBUSxHQUFHO0FBQzdCLG1CQUFPO0FBQ1AsdUJBQVc7QUFBQSxVQUNaLE9BQ0s7QUFDSixhQUFDLEVBQUUsT0FBTyxNQUFNLE1BQU0sU0FBUyxJQUFJO0FBQUEsVUFDcEM7QUFBQSxRQUNEO0FBRUEsWUFBSTtBQUNKLFlBQUksbUJBQW1CLGlCQUFpQixNQUFNLE9BQU8sR0FBRztBQUN2RCxvQkFBVSxlQUFlLEtBQUssTUFBTSxPQUFPO0FBQUEsUUFDNUMsV0FDUyxTQUFTLE1BQU0sT0FBTyxHQUFHO0FBQ2pDLG9CQUFVLE1BQU07QUFBQSxRQUNqQixXQUVTLG1CQUFtQixpQkFBa0IsTUFBYyxNQUFNLEdBQUc7QUFDcEUsa0JBQVEsS0FBSyx1RUFBdUU7QUFDcEYsb0JBQVUsZUFBZSxLQUFNLE1BQWMsTUFBTTtBQUFBLFFBQ3BELFdBQ1MsU0FBVSxNQUFjLE1BQU0sR0FBRztBQUN6QyxrQkFBUSxLQUFLLHVFQUF1RTtBQUNwRixvQkFBVyxNQUFjO0FBQUEsUUFDMUI7QUFFQSxlQUFPO0FBQUEsVUFDTixHQUFHO0FBQUEsVUFDSCxJQUFJLE1BQU0sTUFBTTtBQUFBLFVBQ2hCO0FBQUEsVUFDQTtBQUFBLFVBQ0EsU0FBUyxLQUFLLFVBQVUsaUJBQWlCLFdBQVcsS0FBSyxTQUFTLFdBQVcsSUFBSTtBQUFBLFVBQ2pGO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQSwwQkFBMEIsS0FBSztBQUFBLFFBQ2hDO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSw2QkFBNkIsVUFBNEIsV0FBNkM7QUFHN0csVUFBTSxXQUFXLEtBQUssV0FBVyxJQUFJLFNBQVMsRUFBRTtBQUNoRCxRQUFJLFVBQVU7QUFDYixZQUFNLElBQUksTUFBTSxxQkFBcUIsU0FBUyxFQUFFLGtCQUFrQjtBQUFBLElBQ25FO0FBRUEsU0FBSyxPQUFPLDBCQUEwQjtBQUFBLE1BQ3JDLElBQUksU0FBUztBQUFBLE1BQ2IsT0FBTyxTQUFTO0FBQUEsTUFDaEIsUUFBUSxTQUFTO0FBQUEsSUFDbEIsQ0FBQztBQUNELFNBQUssV0FBVyxJQUFJLFNBQVMsSUFBSSxFQUFFLFVBQVUsVUFBVSxDQUFDO0FBRXhELFdBQU8sYUFBYSxNQUFNO0FBQ3pCLGlCQUFXLGFBQWEsS0FBSyx3QkFBd0IsT0FBTyxHQUFHO0FBQzlELGtCQUFVLElBQUksU0FBUyxFQUFFLEdBQUcsTUFBTTtBQUFBLE1BQ25DO0FBRUEsV0FBSyxXQUFXLE9BQU8sU0FBUyxFQUFFO0FBQ2xDLFdBQUssT0FBTyw0QkFBNEIsU0FBUyxFQUFFO0FBQ25ELGVBQVMsUUFBUTtBQUFBLElBQ2xCLENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUFFQSxTQUFTLFVBQVUsS0FBMEM7QUFDNUQsU0FBTyxLQUFLLFNBQVM7QUFDdEI7IiwKICAibmFtZXMiOiBbXQp9Cg==
