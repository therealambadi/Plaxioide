import { MainContext } from "./extHost.protocol.js";
import * as typeConvert from "./extHostTypeConverters.js";
import { StandardTokenType, Range, LanguageStatusSeverity } from "./extHostTypes.js";
import Severity from "../../../base/common/severity.js";
import { disposableTimeout } from "../../../base/common/async.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { checkProposedApiEnabled } from "../../services/extensions/common/extensions.js";
class ExtHostLanguages {
  constructor(mainContext, _documents, _commands, _uriTransformer) {
    this._documents = _documents;
    this._commands = _commands;
    this._uriTransformer = _uriTransformer;
    this._languageIds = [];
    this._handlePool = 0;
    this._ids = /* @__PURE__ */ new Set();
    this._proxy = mainContext.getProxy(MainContext.MainThreadLanguages);
  }
  $acceptLanguageIds(ids) {
    this._languageIds = ids;
  }
  async getLanguages() {
    return this._languageIds.slice(0);
  }
  async changeLanguage(uri, languageId) {
    await this._proxy.$changeLanguage(uri, languageId);
    const data = this._documents.getDocumentData(uri);
    if (!data) {
      throw new Error(`document '${uri.toString()}' NOT found`);
    }
    return data.document;
  }
  async tokenAtPosition(document, position) {
    const versionNow = document.version;
    const pos = typeConvert.Position.from(position);
    const info = await this._proxy.$tokensAtPosition(document.uri, pos);
    const defaultRange = {
      type: StandardTokenType.Other,
      range: document.getWordRangeAtPosition(position) ?? new Range(position.line, position.character, position.line, position.character)
    };
    if (!info) {
      return defaultRange;
    }
    const result = {
      range: typeConvert.Range.to(info.range),
      type: typeConvert.TokenType.to(info.type)
    };
    if (!result.range.contains(position)) {
      return defaultRange;
    }
    if (versionNow !== document.version) {
      return defaultRange;
    }
    return result;
  }
  createLanguageStatusItem(extension, id, selector) {
    const handle = this._handlePool++;
    const proxy = this._proxy;
    const ids = this._ids;
    const fullyQualifiedId = `${extension.identifier.value}/${id}`;
    if (ids.has(fullyQualifiedId)) {
      throw new Error(`LanguageStatusItem with id '${id}' ALREADY exists`);
    }
    ids.add(fullyQualifiedId);
    const data = {
      selector,
      id,
      name: extension.displayName ?? extension.name,
      severity: LanguageStatusSeverity.Information,
      command: void 0,
      text: "",
      detail: "",
      busy: false
    };
    let soonHandle;
    const commandDisposables = new DisposableStore();
    const updateAsync = () => {
      soonHandle?.dispose();
      if (!ids.has(fullyQualifiedId)) {
        console.warn(`LanguageStatusItem (${id}) from ${extension.identifier.value} has been disposed and CANNOT be updated anymore`);
        return;
      }
      soonHandle = disposableTimeout(() => {
        commandDisposables.clear();
        this._proxy.$setLanguageStatus(handle, {
          id: fullyQualifiedId,
          name: data.name ?? extension.displayName ?? extension.name,
          source: extension.displayName ?? extension.name,
          selector: typeConvert.DocumentSelector.from(data.selector, this._uriTransformer),
          label: data.text,
          detail: data.detail ?? "",
          severity: data.severity === LanguageStatusSeverity.Error ? Severity.Error : data.severity === LanguageStatusSeverity.Warning ? Severity.Warning : Severity.Info,
          command: data.command && this._commands.toInternal(data.command, commandDisposables),
          accessibilityInfo: data.accessibilityInformation,
          busy: data.busy
        });
      }, 0);
    };
    const result = {
      dispose() {
        commandDisposables.dispose();
        soonHandle?.dispose();
        proxy.$removeLanguageStatus(handle);
        ids.delete(fullyQualifiedId);
      },
      get id() {
        return data.id;
      },
      get name() {
        return data.name;
      },
      set name(value) {
        data.name = value;
        updateAsync();
      },
      get selector() {
        return data.selector;
      },
      set selector(value) {
        data.selector = value;
        updateAsync();
      },
      get text() {
        return data.text;
      },
      set text(value) {
        data.text = value;
        updateAsync();
      },
      set text2(value) {
        checkProposedApiEnabled(extension, "languageStatusText");
        data.text = value;
        updateAsync();
      },
      get text2() {
        checkProposedApiEnabled(extension, "languageStatusText");
        return data.text;
      },
      get detail() {
        return data.detail;
      },
      set detail(value) {
        data.detail = value;
        updateAsync();
      },
      get severity() {
        return data.severity;
      },
      set severity(value) {
        data.severity = value;
        updateAsync();
      },
      get accessibilityInformation() {
        return data.accessibilityInformation;
      },
      set accessibilityInformation(value) {
        data.accessibilityInformation = value;
        updateAsync();
      },
      get command() {
        return data.command;
      },
      set command(value) {
        data.command = value;
        updateAsync();
      },
      get busy() {
        return data.busy;
      },
      set busy(value) {
        data.busy = value;
        updateAsync();
      }
    };
    updateAsync();
    return result;
  }
}
export {
  ExtHostLanguages
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0TGFuZ3VhZ2VzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgTWFpbkNvbnRleHQsIE1haW5UaHJlYWRMYW5ndWFnZXNTaGFwZSwgSU1haW5Db250ZXh0LCBFeHRIb3N0TGFuZ3VhZ2VzU2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHMgfSBmcm9tICcuL2V4dEhvc3REb2N1bWVudHMuanMnO1xuaW1wb3J0ICogYXMgdHlwZUNvbnZlcnQgZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRUb2tlblR5cGUsIFJhbmdlLCBQb3NpdGlvbiwgTGFuZ3VhZ2VTdGF0dXNTZXZlcml0eSB9IGZyb20gJy4vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBkaXNwb3NhYmxlVGltZW91dCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc0NvbnZlcnRlciB9IGZyb20gJy4vZXh0SG9zdENvbW1hbmRzLmpzJztcbmltcG9ydCB7IElVUklUcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaUlwYy5qcyc7XG5pbXBvcnQgeyBjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgRXh0SG9zdExhbmd1YWdlcyBpbXBsZW1lbnRzIEV4dEhvc3RMYW5ndWFnZXNTaGFwZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IE1haW5UaHJlYWRMYW5ndWFnZXNTaGFwZTtcblxuXHRwcml2YXRlIF9sYW5ndWFnZUlkczogc3RyaW5nW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtYWluQ29udGV4dDogSU1haW5Db250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kczogQ29tbWFuZHNDb252ZXJ0ZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdXJpVHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lciB8IHVuZGVmaW5lZFxuXHQpIHtcblx0XHR0aGlzLl9wcm94eSA9IG1haW5Db250ZXh0LmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRMYW5ndWFnZXMpO1xuXHR9XG5cblx0JGFjY2VwdExhbmd1YWdlSWRzKGlkczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHR0aGlzLl9sYW5ndWFnZUlkcyA9IGlkcztcblx0fVxuXG5cdGFzeW5jIGdldExhbmd1YWdlcygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2xhbmd1YWdlSWRzLnNsaWNlKDApO1xuXHR9XG5cblx0YXN5bmMgY2hhbmdlTGFuZ3VhZ2UodXJpOiB2c2NvZGUuVXJpLCBsYW5ndWFnZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZzY29kZS5UZXh0RG9jdW1lbnQ+IHtcblx0XHRhd2FpdCB0aGlzLl9wcm94eS4kY2hhbmdlTGFuZ3VhZ2UodXJpLCBsYW5ndWFnZUlkKTtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50RGF0YSh1cmkpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBkb2N1bWVudCAnJHt1cmkudG9TdHJpbmcoKX0nIE5PVCBmb3VuZGApO1xuXHRcdH1cblx0XHRyZXR1cm4gZGF0YS5kb2N1bWVudDtcblx0fVxuXG5cdGFzeW5jIHRva2VuQXRQb3NpdGlvbihkb2N1bWVudDogdnNjb2RlLlRleHREb2N1bWVudCwgcG9zaXRpb246IHZzY29kZS5Qb3NpdGlvbik6IFByb21pc2U8dnNjb2RlLlRva2VuSW5mb3JtYXRpb24+IHtcblx0XHRjb25zdCB2ZXJzaW9uTm93ID0gZG9jdW1lbnQudmVyc2lvbjtcblx0XHRjb25zdCBwb3MgPSB0eXBlQ29udmVydC5Qb3NpdGlvbi5mcm9tKHBvc2l0aW9uKTtcblx0XHRjb25zdCBpbmZvID0gYXdhaXQgdGhpcy5fcHJveHkuJHRva2Vuc0F0UG9zaXRpb24oZG9jdW1lbnQudXJpLCBwb3MpO1xuXHRcdGNvbnN0IGRlZmF1bHRSYW5nZSA9IHtcblx0XHRcdHR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyLFxuXHRcdFx0cmFuZ2U6IGRvY3VtZW50LmdldFdvcmRSYW5nZUF0UG9zaXRpb24ocG9zaXRpb24pID8/IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lLCBwb3NpdGlvbi5jaGFyYWN0ZXIsIHBvc2l0aW9uLmxpbmUsIHBvc2l0aW9uLmNoYXJhY3Rlcilcblx0XHR9O1xuXHRcdGlmICghaW5mbykge1xuXHRcdFx0Ly8gbm8gcmVzdWx0XG5cdFx0XHRyZXR1cm4gZGVmYXVsdFJhbmdlO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSB7XG5cdFx0XHRyYW5nZTogdHlwZUNvbnZlcnQuUmFuZ2UudG8oaW5mby5yYW5nZSksXG5cdFx0XHR0eXBlOiB0eXBlQ29udmVydC5Ub2tlblR5cGUudG8oaW5mby50eXBlKVxuXHRcdH07XG5cdFx0aWYgKCFyZXN1bHQucmFuZ2UuY29udGFpbnMoPFBvc2l0aW9uPnBvc2l0aW9uKSkge1xuXHRcdFx0Ly8gYm9nb3VzIHJlc3VsdFxuXHRcdFx0cmV0dXJuIGRlZmF1bHRSYW5nZTtcblx0XHR9XG5cdFx0aWYgKHZlcnNpb25Ob3cgIT09IGRvY3VtZW50LnZlcnNpb24pIHtcblx0XHRcdC8vIGNvbmN1cnJlbnQgY2hhbmdlXG5cdFx0XHRyZXR1cm4gZGVmYXVsdFJhbmdlO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlUG9vbDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfaWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0Y3JlYXRlTGFuZ3VhZ2VTdGF0dXNJdGVtKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpZDogc3RyaW5nLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IpOiB2c2NvZGUuTGFuZ3VhZ2VTdGF0dXNJdGVtIHtcblxuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2hhbmRsZVBvb2wrKztcblx0XHRjb25zdCBwcm94eSA9IHRoaXMuX3Byb3h5O1xuXHRcdGNvbnN0IGlkcyA9IHRoaXMuX2lkcztcblxuXHRcdC8vIGVuZm9yY2UgZXh0ZW5zaW9uIHVuaXF1ZSBpZGVudGlmaWVyXG5cdFx0Y29uc3QgZnVsbHlRdWFsaWZpZWRJZCA9IGAke2V4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfS8ke2lkfWA7XG5cdFx0aWYgKGlkcy5oYXMoZnVsbHlRdWFsaWZpZWRJZCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTGFuZ3VhZ2VTdGF0dXNJdGVtIHdpdGggaWQgJyR7aWR9JyBBTFJFQURZIGV4aXN0c2ApO1xuXHRcdH1cblx0XHRpZHMuYWRkKGZ1bGx5UXVhbGlmaWVkSWQpO1xuXG5cdFx0Y29uc3QgZGF0YTogT21pdDx2c2NvZGUuTGFuZ3VhZ2VTdGF0dXNJdGVtLCAnZGlzcG9zZScgfCAndGV4dDInPiA9IHtcblx0XHRcdHNlbGVjdG9yLFxuXHRcdFx0aWQsXG5cdFx0XHRuYW1lOiBleHRlbnNpb24uZGlzcGxheU5hbWUgPz8gZXh0ZW5zaW9uLm5hbWUsXG5cdFx0XHRzZXZlcml0eTogTGFuZ3VhZ2VTdGF0dXNTZXZlcml0eS5JbmZvcm1hdGlvbixcblx0XHRcdGNvbW1hbmQ6IHVuZGVmaW5lZCxcblx0XHRcdHRleHQ6ICcnLFxuXHRcdFx0ZGV0YWlsOiAnJyxcblx0XHRcdGJ1c3k6IGZhbHNlXG5cdFx0fTtcblxuXG5cdFx0bGV0IHNvb25IYW5kbGU6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGNvbW1hbmREaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCB1cGRhdGVBc3luYyA9ICgpID0+IHtcblx0XHRcdHNvb25IYW5kbGU/LmRpc3Bvc2UoKTtcblxuXHRcdFx0aWYgKCFpZHMuaGFzKGZ1bGx5UXVhbGlmaWVkSWQpKSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgTGFuZ3VhZ2VTdGF0dXNJdGVtICgke2lkfSkgZnJvbSAke2V4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfSBoYXMgYmVlbiBkaXNwb3NlZCBhbmQgQ0FOTk9UIGJlIHVwZGF0ZWQgYW55bW9yZWApO1xuXHRcdFx0XHRyZXR1cm47IC8vIGRpc3Bvc2VkIGluIHRoZSBtZWFudGltZVxuXHRcdFx0fVxuXG5cdFx0XHRzb29uSGFuZGxlID0gZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRjb21tYW5kRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdFx0dGhpcy5fcHJveHkuJHNldExhbmd1YWdlU3RhdHVzKGhhbmRsZSwge1xuXHRcdFx0XHRcdGlkOiBmdWxseVF1YWxpZmllZElkLFxuXHRcdFx0XHRcdG5hbWU6IGRhdGEubmFtZSA/PyBleHRlbnNpb24uZGlzcGxheU5hbWUgPz8gZXh0ZW5zaW9uLm5hbWUsXG5cdFx0XHRcdFx0c291cmNlOiBleHRlbnNpb24uZGlzcGxheU5hbWUgPz8gZXh0ZW5zaW9uLm5hbWUsXG5cdFx0XHRcdFx0c2VsZWN0b3I6IHR5cGVDb252ZXJ0LkRvY3VtZW50U2VsZWN0b3IuZnJvbShkYXRhLnNlbGVjdG9yLCB0aGlzLl91cmlUcmFuc2Zvcm1lciksXG5cdFx0XHRcdFx0bGFiZWw6IGRhdGEudGV4dCxcblx0XHRcdFx0XHRkZXRhaWw6IGRhdGEuZGV0YWlsID8/ICcnLFxuXHRcdFx0XHRcdHNldmVyaXR5OiBkYXRhLnNldmVyaXR5ID09PSBMYW5ndWFnZVN0YXR1c1NldmVyaXR5LkVycm9yID8gU2V2ZXJpdHkuRXJyb3IgOiBkYXRhLnNldmVyaXR5ID09PSBMYW5ndWFnZVN0YXR1c1NldmVyaXR5Lldhcm5pbmcgPyBTZXZlcml0eS5XYXJuaW5nIDogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRjb21tYW5kOiBkYXRhLmNvbW1hbmQgJiYgdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChkYXRhLmNvbW1hbmQsIGNvbW1hbmREaXNwb3NhYmxlcyksXG5cdFx0XHRcdFx0YWNjZXNzaWJpbGl0eUluZm86IGRhdGEuYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uLFxuXHRcdFx0XHRcdGJ1c3k6IGRhdGEuYnVzeVxuXHRcdFx0XHR9KTtcblx0XHRcdH0sIDApO1xuXHRcdH07XG5cblx0XHRjb25zdCByZXN1bHQ6IHZzY29kZS5MYW5ndWFnZVN0YXR1c0l0ZW0gPSB7XG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRjb21tYW5kRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRzb29uSGFuZGxlPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHByb3h5LiRyZW1vdmVMYW5ndWFnZVN0YXR1cyhoYW5kbGUpO1xuXHRcdFx0XHRpZHMuZGVsZXRlKGZ1bGx5UXVhbGlmaWVkSWQpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBpZCgpIHtcblx0XHRcdFx0cmV0dXJuIGRhdGEuaWQ7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IG5hbWUoKSB7XG5cdFx0XHRcdHJldHVybiBkYXRhLm5hbWU7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IG5hbWUodmFsdWUpIHtcblx0XHRcdFx0ZGF0YS5uYW1lID0gdmFsdWU7XG5cdFx0XHRcdHVwZGF0ZUFzeW5jKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHNlbGVjdG9yKCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5zZWxlY3Rvcjtcblx0XHRcdH0sXG5cdFx0XHRzZXQgc2VsZWN0b3IodmFsdWUpIHtcblx0XHRcdFx0ZGF0YS5zZWxlY3RvciA9IHZhbHVlO1xuXHRcdFx0XHR1cGRhdGVBc3luYygpO1xuXHRcdFx0fSxcblx0XHRcdGdldCB0ZXh0KCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS50ZXh0O1xuXHRcdFx0fSxcblx0XHRcdHNldCB0ZXh0KHZhbHVlKSB7XG5cdFx0XHRcdGRhdGEudGV4dCA9IHZhbHVlO1xuXHRcdFx0XHR1cGRhdGVBc3luYygpO1xuXHRcdFx0fSxcblx0XHRcdHNldCB0ZXh0Mih2YWx1ZSkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdsYW5ndWFnZVN0YXR1c1RleHQnKTtcblx0XHRcdFx0ZGF0YS50ZXh0ID0gdmFsdWU7XG5cdFx0XHRcdHVwZGF0ZUFzeW5jKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHRleHQyKCkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdsYW5ndWFnZVN0YXR1c1RleHQnKTtcblx0XHRcdFx0cmV0dXJuIGRhdGEudGV4dDtcblx0XHRcdH0sXG5cdFx0XHRnZXQgZGV0YWlsKCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5kZXRhaWw7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGRldGFpbCh2YWx1ZSkge1xuXHRcdFx0XHRkYXRhLmRldGFpbCA9IHZhbHVlO1xuXHRcdFx0XHR1cGRhdGVBc3luYygpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBzZXZlcml0eSgpIHtcblx0XHRcdFx0cmV0dXJuIGRhdGEuc2V2ZXJpdHk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHNldmVyaXR5KHZhbHVlKSB7XG5cdFx0XHRcdGRhdGEuc2V2ZXJpdHkgPSB2YWx1ZTtcblx0XHRcdFx0dXBkYXRlQXN5bmMoKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb247XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRkYXRhLmFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbiA9IHZhbHVlO1xuXHRcdFx0XHR1cGRhdGVBc3luYygpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBjb21tYW5kKCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5jb21tYW5kO1xuXHRcdFx0fSxcblx0XHRcdHNldCBjb21tYW5kKHZhbHVlKSB7XG5cdFx0XHRcdGRhdGEuY29tbWFuZCA9IHZhbHVlO1xuXHRcdFx0XHR1cGRhdGVBc3luYygpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBidXN5KCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5idXN5O1xuXHRcdFx0fSxcblx0XHRcdHNldCBidXN5KHZhbHVlOiBib29sZWFuKSB7XG5cdFx0XHRcdGRhdGEuYnVzeSA9IHZhbHVlO1xuXHRcdFx0XHR1cGRhdGVBc3luYygpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dXBkYXRlQXN5bmMoKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLG1CQUFrRjtBQUczRixZQUFZLGlCQUFpQjtBQUM3QixTQUFTLG1CQUFtQixPQUFpQiw4QkFBOEI7QUFDM0UsT0FBTyxjQUFjO0FBQ3JCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsdUJBQW9DO0FBSTdDLFNBQVMsK0JBQStCO0FBRWpDLE1BQU0saUJBQWtEO0FBQUEsRUFNOUQsWUFDQyxhQUNpQixZQUNBLFdBQ0EsaUJBQ2hCO0FBSGdCO0FBQ0E7QUFDQTtBQU5sQixTQUFRLGVBQXlCLENBQUM7QUF1RGxDLFNBQVEsY0FBc0I7QUFDOUIsU0FBUSxPQUFPLG9CQUFJLElBQVk7QUFoRDlCLFNBQUssU0FBUyxZQUFZLFNBQVMsWUFBWSxtQkFBbUI7QUFBQSxFQUNuRTtBQUFBLEVBRUEsbUJBQW1CLEtBQXFCO0FBQ3ZDLFNBQUssZUFBZTtBQUFBLEVBQ3JCO0FBQUEsRUFFQSxNQUFNLGVBQWtDO0FBQ3ZDLFdBQU8sS0FBSyxhQUFhLE1BQU0sQ0FBQztBQUFBLEVBQ2pDO0FBQUEsRUFFQSxNQUFNLGVBQWUsS0FBaUIsWUFBa0Q7QUFDdkYsVUFBTSxLQUFLLE9BQU8sZ0JBQWdCLEtBQUssVUFBVTtBQUNqRCxVQUFNLE9BQU8sS0FBSyxXQUFXLGdCQUFnQixHQUFHO0FBQ2hELFFBQUksQ0FBQyxNQUFNO0FBQ1YsWUFBTSxJQUFJLE1BQU0sYUFBYSxJQUFJLFNBQVMsQ0FBQyxhQUFhO0FBQUEsSUFDekQ7QUFDQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxNQUFNLGdCQUFnQixVQUErQixVQUE2RDtBQUNqSCxVQUFNLGFBQWEsU0FBUztBQUM1QixV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
