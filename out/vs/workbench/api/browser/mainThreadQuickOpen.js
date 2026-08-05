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
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { URI } from "../../../base/common/uri.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
function reviveIconPathUris(iconPath) {
  iconPath.dark = URI.revive(iconPath.dark);
  if (iconPath.light) {
    iconPath.light = URI.revive(iconPath.light);
  }
}
let MainThreadQuickOpen = class {
  constructor(extHostContext, quickInputService) {
    this._items = {};
    // ---- QuickInput
    this.sessions = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostQuickOpen);
    this._quickInputService = quickInputService;
  }
  dispose() {
    for (const [_id, session] of this.sessions) {
      session.store.dispose();
    }
  }
  $show(instance, options, token) {
    const contents = new Promise((resolve, reject) => {
      this._items[instance] = { resolve, reject };
    });
    options = {
      ...options,
      onDidFocus: (el) => {
        if (el) {
          this._proxy.$onItemSelected(el.handle);
        }
      }
    };
    if (options.canPickMany) {
      return this._quickInputService.pick(contents, options, token).then((items) => {
        if (items) {
          return items.map((item) => item.handle);
        }
        return void 0;
      });
    } else {
      return this._quickInputService.pick(contents, options, token).then((item) => {
        if (item) {
          return item.handle;
        }
        return void 0;
      });
    }
  }
  $setItems(instance, items) {
    if (this._items[instance]) {
      this._items[instance].resolve(items);
      delete this._items[instance];
    }
    return Promise.resolve();
  }
  $setError(instance, error) {
    if (this._items[instance]) {
      this._items[instance].reject(error);
      delete this._items[instance];
    }
    return Promise.resolve();
  }
  // ---- input
  $input(options, validateInput, token) {
    const inputOptions = /* @__PURE__ */ Object.create(null);
    if (options) {
      inputOptions.title = options.title;
      inputOptions.password = options.password;
      inputOptions.placeHolder = options.placeHolder;
      inputOptions.valueSelection = options.valueSelection;
      inputOptions.prompt = options.prompt;
      inputOptions.value = options.value;
      inputOptions.ignoreFocusLost = options.ignoreFocusOut;
    }
    if (validateInput) {
      inputOptions.validateInput = (value) => {
        return this._proxy.$validateInput(value);
      };
    }
    return this._quickInputService.input(inputOptions, token);
  }
  $createOrUpdate(params) {
    const sessionId = params.id;
    let session = this.sessions.get(sessionId);
    if (!session) {
      const store = new DisposableStore();
      const input2 = params.type === "quickPick" ? this._quickInputService.createQuickPick() : this._quickInputService.createInputBox();
      store.add(input2);
      store.add(input2.onDidAccept(() => {
        this._proxy.$onDidAccept(sessionId);
      }));
      store.add(input2.onDidTriggerButton((button) => {
        this._proxy.$onDidTriggerButton(sessionId, button.handle);
      }));
      store.add(input2.onDidChangeValue((value) => {
        this._proxy.$onDidChangeValue(sessionId, value);
      }));
      store.add(input2.onDidHide(() => {
        this._proxy.$onDidHide(sessionId);
      }));
      if (params.type === "quickPick") {
        const quickpick = input2;
        store.add(quickpick.onDidChangeActive((items) => {
          this._proxy.$onDidChangeActive(sessionId, items.map((item) => item.handle));
        }));
        store.add(quickpick.onDidChangeSelection((items) => {
          this._proxy.$onDidChangeSelection(sessionId, items.map((item) => item.handle));
        }));
        store.add(quickpick.onDidTriggerItemButton((e) => {
          this._proxy.$onDidTriggerItemButton(sessionId, e.item.handle, e.button.handle);
        }));
      }
      session = {
        input: input2,
        handlesToItems: /* @__PURE__ */ new Map(),
        store
      };
      this.sessions.set(sessionId, session);
    }
    const { input, handlesToItems } = session;
    for (const param in params) {
      if (param === "id" || param === "type") {
        continue;
      }
      if (param === "visible") {
        if (params.visible) {
          input.show();
        } else {
          input.hide();
        }
      } else if (param === "items") {
        handlesToItems.clear();
        params[param].forEach((item) => {
          if (item.type === "separator") {
            return;
          }
          if (item.buttons) {
            item.buttons = item.buttons.map((button) => {
              if (button.iconPath) {
                reviveIconPathUris(button.iconPath);
              }
              return button;
            });
          }
          handlesToItems.set(item.handle, item);
        });
        input[param] = params[param];
      } else if (param === "activeItems" || param === "selectedItems") {
        input[param] = params[param].filter((handle) => handlesToItems.has(handle)).map((handle) => handlesToItems.get(handle));
      } else if (param === "buttons") {
        input[param] = params.buttons.map((button) => {
          if (button.handle === -1) {
            return this._quickInputService.backButton;
          }
          if (button.iconPath) {
            reviveIconPathUris(button.iconPath);
          }
          return button;
        });
      } else {
        input[param] = params[param];
      }
    }
    return Promise.resolve(void 0);
  }
  $dispose(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.store.dispose();
      this.sessions.delete(sessionId);
    }
    return Promise.resolve(void 0);
  }
};
MainThreadQuickOpen = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadQuickOpen),
  __decorateParam(1, IQuickInputService)
], MainThreadQuickOpen);
export {
  MainThreadQuickOpen
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFF1aWNrT3Blbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElQaWNrT3B0aW9ucywgSUlucHV0T3B0aW9ucywgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tJbnB1dCwgSVF1aWNrUGljaywgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb250ZXh0LCBNYWluVGhyZWFkUXVpY2tPcGVuU2hhcGUsIEV4dEhvc3RRdWlja09wZW5TaGFwZSwgVHJhbnNmZXJRdWlja1BpY2tJdGVtLCBNYWluQ29udGV4dCwgVHJhbnNmZXJRdWlja0lucHV0LCBUcmFuc2ZlclF1aWNrSW5wdXRCdXR0b24sIElJbnB1dEJveE9wdGlvbnMsIFRyYW5zZmVyUXVpY2tQaWNrSXRlbU9yU2VwYXJhdG9yIH0gZnJvbSAnLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgZXh0SG9zdE5hbWVkQ3VzdG9tZXIsIElFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmludGVyZmFjZSBRdWlja0lucHV0U2Vzc2lvbiB7XG5cdGlucHV0OiBJUXVpY2tJbnB1dDtcblx0aGFuZGxlc1RvSXRlbXM6IE1hcDxudW1iZXIsIFRyYW5zZmVyUXVpY2tQaWNrSXRlbT47XG5cdHN0b3JlOiBEaXNwb3NhYmxlU3RvcmU7XG59XG5cbmZ1bmN0aW9uIHJldml2ZUljb25QYXRoVXJpcyhpY29uUGF0aDogeyBkYXJrOiBVUkk7IGxpZ2h0PzogVVJJIHwgdW5kZWZpbmVkIH0pIHtcblx0aWNvblBhdGguZGFyayA9IFVSSS5yZXZpdmUoaWNvblBhdGguZGFyayk7XG5cdGlmIChpY29uUGF0aC5saWdodCkge1xuXHRcdGljb25QYXRoLmxpZ2h0ID0gVVJJLnJldml2ZShpY29uUGF0aC5saWdodCk7XG5cdH1cbn1cblxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWRRdWlja09wZW4pXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZFF1aWNrT3BlbiBpbXBsZW1lbnRzIE1haW5UaHJlYWRRdWlja09wZW5TaGFwZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IEV4dEhvc3RRdWlja09wZW5TaGFwZTtcblx0cHJpdmF0ZSByZWFkb25seSBfcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfaXRlbXM6IFJlY29yZDxudW1iZXIsIHtcblx0XHRyZXNvbHZlKGl0ZW1zOiBUcmFuc2ZlclF1aWNrUGlja0l0ZW1PclNlcGFyYXRvcltdKTogdm9pZDtcblx0XHRyZWplY3QoZXJyb3I6IEVycm9yKTogdm9pZDtcblx0fT4gPSB7fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRleHRIb3N0Q29udGV4dDogSUV4dEhvc3RDb250ZXh0LFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZVxuXHQpIHtcblx0XHR0aGlzLl9wcm94eSA9IGV4dEhvc3RDb250ZXh0LmdldFByb3h5KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RRdWlja09wZW4pO1xuXHRcdHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlID0gcXVpY2tJbnB1dFNlcnZpY2U7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IFtfaWQsIHNlc3Npb25dIG9mIHRoaXMuc2Vzc2lvbnMpIHtcblx0XHRcdHNlc3Npb24uc3RvcmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdCRzaG93KGluc3RhbmNlOiBudW1iZXIsIG9wdGlvbnM6IElQaWNrT3B0aW9uczxUcmFuc2ZlclF1aWNrUGlja0l0ZW0+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPG51bWJlciB8IG51bWJlcltdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgY29udGVudHMgPSBuZXcgUHJvbWlzZTxUcmFuc2ZlclF1aWNrUGlja0l0ZW1PclNlcGFyYXRvcltdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0aGlzLl9pdGVtc1tpbnN0YW5jZV0gPSB7IHJlc29sdmUsIHJlamVjdCB9O1xuXHRcdH0pO1xuXG5cdFx0b3B0aW9ucyA9IHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRvbkRpZEZvY3VzOiBlbCA9PiB7XG5cdFx0XHRcdGlmIChlbCkge1xuXHRcdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkl0ZW1TZWxlY3RlZCgoPFRyYW5zZmVyUXVpY2tQaWNrSXRlbT5lbCkuaGFuZGxlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRpZiAob3B0aW9ucy5jYW5QaWNrTWFueSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLnBpY2soY29udGVudHMsIG9wdGlvbnMgYXMgeyBjYW5QaWNrTWFueTogdHJ1ZSB9LCB0b2tlbikudGhlbihpdGVtcyA9PiB7XG5cdFx0XHRcdGlmIChpdGVtcykge1xuXHRcdFx0XHRcdHJldHVybiBpdGVtcy5tYXAoaXRlbSA9PiBpdGVtLmhhbmRsZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UucGljayhjb250ZW50cywgb3B0aW9ucywgdG9rZW4pLnRoZW4oaXRlbSA9PiB7XG5cdFx0XHRcdGlmIChpdGVtKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGl0ZW0uaGFuZGxlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQkc2V0SXRlbXMoaW5zdGFuY2U6IG51bWJlciwgaXRlbXM6IFRyYW5zZmVyUXVpY2tQaWNrSXRlbU9yU2VwYXJhdG9yW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5faXRlbXNbaW5zdGFuY2VdKSB7XG5cdFx0XHR0aGlzLl9pdGVtc1tpbnN0YW5jZV0ucmVzb2x2ZShpdGVtcyk7XG5cdFx0XHRkZWxldGUgdGhpcy5faXRlbXNbaW5zdGFuY2VdO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHQkc2V0RXJyb3IoaW5zdGFuY2U6IG51bWJlciwgZXJyb3I6IEVycm9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuX2l0ZW1zW2luc3RhbmNlXSkge1xuXHRcdFx0dGhpcy5faXRlbXNbaW5zdGFuY2VdLnJlamVjdChlcnJvcik7XG5cdFx0XHRkZWxldGUgdGhpcy5faXRlbXNbaW5zdGFuY2VdO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHQvLyAtLS0tIGlucHV0XG5cblx0JGlucHV0KG9wdGlvbnM6IElJbnB1dEJveE9wdGlvbnMgfCB1bmRlZmluZWQsIHZhbGlkYXRlSW5wdXQ6IGJvb2xlYW4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgaW5wdXRPcHRpb25zOiBJSW5wdXRPcHRpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRcdGlmIChvcHRpb25zKSB7XG5cdFx0XHRpbnB1dE9wdGlvbnMudGl0bGUgPSBvcHRpb25zLnRpdGxlO1xuXHRcdFx0aW5wdXRPcHRpb25zLnBhc3N3b3JkID0gb3B0aW9ucy5wYXNzd29yZDtcblx0XHRcdGlucHV0T3B0aW9ucy5wbGFjZUhvbGRlciA9IG9wdGlvbnMucGxhY2VIb2xkZXI7XG5cdFx0XHRpbnB1dE9wdGlvbnMudmFsdWVTZWxlY3Rpb24gPSBvcHRpb25zLnZhbHVlU2VsZWN0aW9uO1xuXHRcdFx0aW5wdXRPcHRpb25zLnByb21wdCA9IG9wdGlvbnMucHJvbXB0O1xuXHRcdFx0aW5wdXRPcHRpb25zLnZhbHVlID0gb3B0aW9ucy52YWx1ZTtcblx0XHRcdGlucHV0T3B0aW9ucy5pZ25vcmVGb2N1c0xvc3QgPSBvcHRpb25zLmlnbm9yZUZvY3VzT3V0O1xuXHRcdH1cblxuXHRcdGlmICh2YWxpZGF0ZUlucHV0KSB7XG5cdFx0XHRpbnB1dE9wdGlvbnMudmFsaWRhdGVJbnB1dCA9ICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHZhbGlkYXRlSW5wdXQodmFsdWUpO1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoaW5wdXRPcHRpb25zLCB0b2tlbik7XG5cdH1cblxuXHQvLyAtLS0tIFF1aWNrSW5wdXRcblxuXHRwcml2YXRlIHNlc3Npb25zID0gbmV3IE1hcDxudW1iZXIsIFF1aWNrSW5wdXRTZXNzaW9uPigpO1xuXG5cdCRjcmVhdGVPclVwZGF0ZShwYXJhbXM6IFRyYW5zZmVyUXVpY2tJbnB1dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHBhcmFtcy5pZDtcblx0XHRsZXQgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnMuZ2V0KHNlc3Npb25JZCk7XG5cdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IGlucHV0ID0gcGFyYW1zLnR5cGUgPT09ICdxdWlja1BpY2snID8gdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrKCkgOiB0aGlzLl9xdWlja0lucHV0U2VydmljZS5jcmVhdGVJbnB1dEJveCgpO1xuXHRcdFx0c3RvcmUuYWRkKGlucHV0KTtcblx0XHRcdHN0b3JlLmFkZChpbnB1dC5vbkRpZEFjY2VwdCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZEFjY2VwdChzZXNzaW9uSWQpO1xuXHRcdFx0fSkpO1xuXHRcdFx0c3RvcmUuYWRkKGlucHV0Lm9uRGlkVHJpZ2dlckJ1dHRvbihidXR0b24gPT4ge1xuXHRcdFx0XHR0aGlzLl9wcm94eS4kb25EaWRUcmlnZ2VyQnV0dG9uKHNlc3Npb25JZCwgKGJ1dHRvbiBhcyBUcmFuc2ZlclF1aWNrSW5wdXRCdXR0b24pLmhhbmRsZSk7XG5cdFx0XHR9KSk7XG5cdFx0XHRzdG9yZS5hZGQoaW5wdXQub25EaWRDaGFuZ2VWYWx1ZSh2YWx1ZSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZENoYW5nZVZhbHVlKHNlc3Npb25JZCwgdmFsdWUpO1xuXHRcdFx0fSkpO1xuXHRcdFx0c3RvcmUuYWRkKGlucHV0Lm9uRGlkSGlkZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZEhpZGUoc2Vzc2lvbklkKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0aWYgKHBhcmFtcy50eXBlID09PSAncXVpY2tQaWNrJykge1xuXHRcdFx0XHQvLyBBZGQgZXh0cmEgZXZlbnRzIHNwZWNpZmljIGZvciBxdWlja3BpY2tcblx0XHRcdFx0Y29uc3QgcXVpY2twaWNrID0gaW5wdXQgYXMgSVF1aWNrUGljazxJUXVpY2tQaWNrSXRlbT47XG5cdFx0XHRcdHN0b3JlLmFkZChxdWlja3BpY2sub25EaWRDaGFuZ2VBY3RpdmUoaXRlbXMgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZENoYW5nZUFjdGl2ZShzZXNzaW9uSWQsIGl0ZW1zLm1hcChpdGVtID0+IChpdGVtIGFzIFRyYW5zZmVyUXVpY2tQaWNrSXRlbSkuaGFuZGxlKSk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdFx0c3RvcmUuYWRkKHF1aWNrcGljay5vbkRpZENoYW5nZVNlbGVjdGlvbihpdGVtcyA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fcHJveHkuJG9uRGlkQ2hhbmdlU2VsZWN0aW9uKHNlc3Npb25JZCwgaXRlbXMubWFwKGl0ZW0gPT4gKGl0ZW0gYXMgVHJhbnNmZXJRdWlja1BpY2tJdGVtKS5oYW5kbGUpKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRzdG9yZS5hZGQocXVpY2twaWNrLm9uRGlkVHJpZ2dlckl0ZW1CdXR0b24oKGUpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9wcm94eS4kb25EaWRUcmlnZ2VySXRlbUJ1dHRvbihzZXNzaW9uSWQsIChlLml0ZW0gYXMgVHJhbnNmZXJRdWlja1BpY2tJdGVtKS5oYW5kbGUsIChlLmJ1dHRvbiBhcyBUcmFuc2ZlclF1aWNrSW5wdXRCdXR0b24pLmhhbmRsZSk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblxuXHRcdFx0c2Vzc2lvbiA9IHtcblx0XHRcdFx0aW5wdXQsXG5cdFx0XHRcdGhhbmRsZXNUb0l0ZW1zOiBuZXcgTWFwKCksXG5cdFx0XHRcdHN0b3JlXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5zZXNzaW9ucy5zZXQoc2Vzc2lvbklkLCBzZXNzaW9uKTtcblx0XHR9XG5cdFx0Y29uc3QgeyBpbnB1dCwgaGFuZGxlc1RvSXRlbXMgfSA9IHNlc3Npb247XG5cdFx0Zm9yIChjb25zdCBwYXJhbSBpbiBwYXJhbXMpIHtcblx0XHRcdGlmIChwYXJhbSA9PT0gJ2lkJyB8fCBwYXJhbSA9PT0gJ3R5cGUnKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHBhcmFtID09PSAndmlzaWJsZScpIHtcblx0XHRcdFx0aWYgKHBhcmFtcy52aXNpYmxlKSB7XG5cdFx0XHRcdFx0aW5wdXQuc2hvdygpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlucHV0LmhpZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChwYXJhbSA9PT0gJ2l0ZW1zJykge1xuXHRcdFx0XHRoYW5kbGVzVG9JdGVtcy5jbGVhcigpO1xuXHRcdFx0XHRwYXJhbXNbcGFyYW1dLmZvckVhY2goKGl0ZW06IFRyYW5zZmVyUXVpY2tQaWNrSXRlbU9yU2VwYXJhdG9yKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGl0ZW0udHlwZSA9PT0gJ3NlcGFyYXRvcicpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoaXRlbS5idXR0b25zKSB7XG5cdFx0XHRcdFx0XHRpdGVtLmJ1dHRvbnMgPSBpdGVtLmJ1dHRvbnMubWFwKChidXR0b246IFRyYW5zZmVyUXVpY2tJbnB1dEJ1dHRvbikgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoYnV0dG9uLmljb25QYXRoKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV2aXZlSWNvblBhdGhVcmlzKGJ1dHRvbi5pY29uUGF0aCk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gYnV0dG9uO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGhhbmRsZXNUb0l0ZW1zLnNldChpdGVtLmhhbmRsZSwgaXRlbSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHQoaW5wdXQgYXMgYW55KVtwYXJhbV0gPSBwYXJhbXNbcGFyYW1dO1xuXHRcdFx0fSBlbHNlIGlmIChwYXJhbSA9PT0gJ2FjdGl2ZUl0ZW1zJyB8fCBwYXJhbSA9PT0gJ3NlbGVjdGVkSXRlbXMnKSB7XG5cdFx0XHRcdChpbnB1dCBhcyBhbnkpW3BhcmFtXSA9IHBhcmFtc1twYXJhbV1cblx0XHRcdFx0XHQuZmlsdGVyKChoYW5kbGU6IG51bWJlcikgPT4gaGFuZGxlc1RvSXRlbXMuaGFzKGhhbmRsZSkpXG5cdFx0XHRcdFx0Lm1hcCgoaGFuZGxlOiBudW1iZXIpID0+IGhhbmRsZXNUb0l0ZW1zLmdldChoYW5kbGUpKTtcblx0XHRcdH0gZWxzZSBpZiAocGFyYW0gPT09ICdidXR0b25zJykge1xuXHRcdFx0XHQoaW5wdXQgYXMgYW55KVtwYXJhbV0gPSBwYXJhbXMuYnV0dG9ucyEubWFwKGJ1dHRvbiA9PiB7XG5cdFx0XHRcdFx0aWYgKGJ1dHRvbi5oYW5kbGUgPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuYmFja0J1dHRvbjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoYnV0dG9uLmljb25QYXRoKSB7XG5cdFx0XHRcdFx0XHRyZXZpdmVJY29uUGF0aFVyaXMoYnV0dG9uLmljb25QYXRoKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gYnV0dG9uO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdChpbnB1dCBhcyBhbnkpW3BhcmFtXSA9IHBhcmFtc1twYXJhbV07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdCRkaXNwb3NlKHNlc3Npb25JZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuc2Vzc2lvbnMuZ2V0KHNlc3Npb25JZCk7XG5cdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdHNlc3Npb24uc3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5zZXNzaW9ucy5kZWxldGUoc2Vzc2lvbklkKTtcblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQXNDLDBCQUFtRTtBQUN6RyxTQUFTLGdCQUF3RixtQkFBcUg7QUFDdE4sU0FBUyw0QkFBNkM7QUFDdEQsU0FBUyxXQUFXO0FBRXBCLFNBQVMsdUJBQXVCO0FBUWhDLFNBQVMsbUJBQW1CLFVBQWtEO0FBQzdFLFdBQVMsT0FBTyxJQUFJLE9BQU8sU0FBUyxJQUFJO0FBQ3hDLE1BQUksU0FBUyxPQUFPO0FBQ25CLGFBQVMsUUFBUSxJQUFJLE9BQU8sU0FBUyxLQUFLO0FBQUEsRUFDM0M7QUFDRDtBQUdPLElBQU0sc0JBQU4sTUFBOEQ7QUFBQSxFQVNwRSxZQUNDLGdCQUNvQixtQkFDbkI7QUFSRixTQUFpQixTQUdaLENBQUM7QUF5Rk47QUFBQSxTQUFRLFdBQVcsb0JBQUksSUFBK0I7QUFuRnJELFNBQUssU0FBUyxlQUFlLFNBQVMsZUFBZSxnQkFBZ0I7QUFDckUsU0FBSyxxQkFBcUI7QUFBQSxFQUMzQjtBQUFBLEVBRU8sVUFBZ0I7QUFDdEIsZUFBVyxDQUFDLEtBQUssT0FBTyxLQUFLLEtBQUssVUFBVTtBQUMzQyxjQUFRLE1BQU0sUUFBUTtBQUFBLElBQ3ZCO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxVQUFrQixTQUE4QyxPQUFrRTtBQUN2SSxVQUFNLFdBQVcsSUFBSSxRQUE0QyxDQUFDLFNBQVMsV0FBVztBQUNyRixXQUFLLE9BQU8sUUFBUSxJQUFJLEVBQUUsU0FBUyxPQUFPO0FBQUEsSUFDM0MsQ0FBQztBQUVELGNBQVU7QUFBQSxNQUNULEdBQUc7QUFBQSxNQUNILFlBQVksUUFBTTtBQUNqQixZQUFJLElBQUk7QUFDUCxlQUFLLE9BQU8sZ0JBQXdDLEdBQUksTUFBTTtBQUFBLFFBQy9EO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxRQUFJLFFBQVEsYUFBYTtBQUN4QixhQUFPLEtBQUssbUJBQW1CLEtBQUssVUFBVSxTQUFrQyxLQUFLLEVBQUUsS0FBSyxXQUFTO0FBQ3BHLFlBQUksT0FBTztBQUNWLGlCQUFPLE1BQU0sSUFBSSxVQUFRLEtBQUssTUFBTTtBQUFBLFFBQ3JDO0FBQ0EsZUFBTztBQUFBLE1BQ1IsQ0FBQztBQUFBLElBQ0YsT0FBTztBQUNOLGFBQU8sS0FBSyxtQkFBbUIsS0FBSyxVQUFVLFNBQVMsS0FBSyxFQUFFLEtBQUssVUFBUTtBQUMxRSxZQUFJLE1BQU07QUFDVCxpQkFBTyxLQUFLO0FBQUEsUUFDYjtBQUNBLGVBQU87QUFBQSxNQUNSLENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUFBLEVBRUEsVUFBVSxVQUFrQixPQUEwRDtBQUNyRixRQUFJLEtBQUssT0FBTyxRQUFRLEdBQUc7QUFDMUIsV0FBSyxPQUFPLFFBQVEsRUFBRSxRQUFRLEtBQUs7QUFDbkMsYUFBTyxLQUFLLE9BQU8sUUFBUTtBQUFBLElBQzVCO0FBQ0EsV0FBTyxRQUFRLFFBQVE7QUFBQSxFQUN4QjtBQUFBLEVBRUEsVUFBVSxVQUFrQixPQUE2QjtBQUN4RCxRQUFJLEtBQUssT0FBTyxRQUFRLEdBQUc7QUFDMUIsV0FBSyxPQUFPLFFBQVEsRUFBRSxPQUFPLEtBQUs7QUFDbEMsYUFBTyxLQUFLLE9BQU8sUUFBUTtBQUFBLElBQzVCO0FBQ0EsV0FBTyxRQUFRLFFBQVE7QUFBQSxFQUN4QjtBQUFBO0FBQUEsRUFJQSxPQUFPLFNBQXVDLGVBQXdCLE9BQXVEO0FBQzVILFVBQU0sZUFBOEIsdUJBQU8sT0FBTyxJQUFJO0FBRXRELFFBQUksU0FBUztBQUNaLG1CQUFhLFFBQVEsUUFBUTtBQUM3QixtQkFBYSxXQUFXLFFBQVE7QUFDaEMsbUJBQWEsY0FBYyxRQUFRO0FBQ25DLG1CQUFhLGlCQUFpQixRQUFRO0FBQ3RDLG1CQUFhLFNBQVMsUUFBUTtBQUM5QixtQkFBYSxRQUFRLFFBQVE7QUFDN0IsbUJBQWEsa0JBQWtCLFFBQVE7QUFBQSxJQUN4QztBQUVBLFFBQUksZUFBZTtBQUNsQixtQkFBYSxnQkFBZ0IsQ0FBQyxVQUFVO0FBQ3ZDLGVBQU8sS0FBSyxPQUFPLGVBQWUsS0FBSztBQUFBLE1BQ3hDO0FBQUEsSUFDRDtBQUVBLFdBQU8sS0FBSyxtQkFBbUIsTUFBTSxjQUFjLEtBQUs7QUFBQSxFQUN6RDtBQUFBLEVBTUEsZ0JBQWdCLFFBQTJDO0FBQzFELFVBQU0sWUFBWSxPQUFPO0FBQ3pCLFFBQUksVUFBVSxLQUFLLFNBQVMsSUFBSSxTQUFTO0FBQ3pDLFFBQUksQ0FBQyxTQUFTO0FBQ2IsWUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBQ2xDLFlBQU1BLFNBQVEsT0FBTyxTQUFTLGNBQWMsS0FBSyxtQkFBbUIsZ0JBQWdCLElBQUksS0FBSyxtQkFBbUIsZUFBZTtBQUMvSCxZQUFNLElBQUlBLE1BQUs7QUFDZixZQUFNLElBQUlBLE9BQU0sWUFBWSxNQUFNO0FBQ2pDLGFBQUssT0FBTyxhQUFhLFNBQVM7QUFBQSxNQUNuQyxDQUFDLENBQUM7QUFDRixZQUFNLElBQUlBLE9BQU0sbUJBQW1CLFlBQVU7QUFDNUMsYUFBSyxPQUFPLG9CQUFvQixXQUFZLE9BQW9DLE1BQU07QUFBQSxNQUN2RixDQUFDLENBQUM7QUFDRixZQUFNLElBQUlBLE9BQU0saUJBQWlCLFdBQVM7QUFDekMsYUFBSyxPQUFPLGtCQUFrQixXQUFXLEtBQUs7QUFBQSxNQUMvQyxDQUFDLENBQUM7QUFDRixZQUFNLElBQUlBLE9BQU0sVUFBVSxNQUFNO0FBQy9CLGFBQUssT0FBTyxXQUFXLFNBQVM7QUFBQSxNQUNqQyxDQUFDLENBQUM7QUFFRixVQUFJLE9BQU8sU0FBUyxhQUFhO0FBRWhDLGNBQU0sWUFBWUE7QUFDbEIsY0FBTSxJQUFJLFVBQVUsa0JBQWtCLFdBQVM7QUFDOUMsZUFBSyxPQUFPLG1CQUFtQixXQUFXLE1BQU0sSUFBSSxVQUFTLEtBQStCLE1BQU0sQ0FBQztBQUFBLFFBQ3BHLENBQUMsQ0FBQztBQUNGLGNBQU0sSUFBSSxVQUFVLHFCQUFxQixXQUFTO0FBQ2pELGVBQUssT0FBTyxzQkFBc0IsV0FBVyxNQUFNLElBQUksVUFBUyxLQUErQixNQUFNLENBQUM7QUFBQSxRQUN2RyxDQUFDLENBQUM7QUFDRixjQUFNLElBQUksVUFBVSx1QkFBdUIsQ0FBQyxNQUFNO0FBQ2pELGVBQUssT0FBTyx3QkFBd0IsV0FBWSxFQUFFLEtBQStCLFFBQVMsRUFBRSxPQUFvQyxNQUFNO0FBQUEsUUFDdkksQ0FBQyxDQUFDO0FBQUEsTUFDSDtBQUVBLGdCQUFVO0FBQUEsUUFDVCxPQUFBQTtBQUFBLFFBQ0EsZ0JBQWdCLG9CQUFJLElBQUk7QUFBQSxRQUN4QjtBQUFBLE1BQ0Q7QUFDQSxXQUFLLFNBQVMsSUFBSSxXQUFXLE9BQU87QUFBQSxJQUNyQztBQUNBLFVBQU0sRUFBRSxPQUFPLGVBQWUsSUFBSTtBQUNsQyxlQUFXLFNBQVMsUUFBUTtBQUMzQixVQUFJLFVBQVUsUUFBUSxVQUFVLFFBQVE7QUFDdkM7QUFBQSxNQUNEO0FBQ0EsVUFBSSxVQUFVLFdBQVc7QUFDeEIsWUFBSSxPQUFPLFNBQVM7QUFDbkIsZ0JBQU0sS0FBSztBQUFBLFFBQ1osT0FBTztBQUNOLGdCQUFNLEtBQUs7QUFBQSxRQUNaO0FBQUEsTUFDRCxXQUFXLFVBQVUsU0FBUztBQUM3Qix1QkFBZSxNQUFNO0FBQ3JCLGVBQU8sS0FBSyxFQUFFLFFBQVEsQ0FBQyxTQUEyQztBQUNqRSxjQUFJLEtBQUssU0FBUyxhQUFhO0FBQzlCO0FBQUEsVUFDRDtBQUVBLGNBQUksS0FBSyxTQUFTO0FBQ2pCLGlCQUFLLFVBQVUsS0FBSyxRQUFRLElBQUksQ0FBQyxXQUFxQztBQUNyRSxrQkFBSSxPQUFPLFVBQVU7QUFDcEIsbUNBQW1CLE9BQU8sUUFBUTtBQUFBLGNBQ25DO0FBRUEscUJBQU87QUFBQSxZQUNSLENBQUM7QUFBQSxVQUNGO0FBQ0EseUJBQWUsSUFBSSxLQUFLLFFBQVEsSUFBSTtBQUFBLFFBQ3JDLENBQUM7QUFDRCxRQUFDLE1BQWMsS0FBSyxJQUFJLE9BQU8sS0FBSztBQUFBLE1BQ3JDLFdBQVcsVUFBVSxpQkFBaUIsVUFBVSxpQkFBaUI7QUFDaEUsUUFBQyxNQUFjLEtBQUssSUFBSSxPQUFPLEtBQUssRUFDbEMsT0FBTyxDQUFDLFdBQW1CLGVBQWUsSUFBSSxNQUFNLENBQUMsRUFDckQsSUFBSSxDQUFDLFdBQW1CLGVBQWUsSUFBSSxNQUFNLENBQUM7QUFBQSxNQUNyRCxXQUFXLFVBQVUsV0FBVztBQUMvQixRQUFDLE1BQWMsS0FBSyxJQUFJLE9BQU8sUUFBUyxJQUFJLFlBQVU7QUFDckQsY0FBSSxPQUFPLFdBQVcsSUFBSTtBQUN6QixtQkFBTyxLQUFLLG1CQUFtQjtBQUFBLFVBQ2hDO0FBRUEsY0FBSSxPQUFPLFVBQVU7QUFDcEIsK0JBQW1CLE9BQU8sUUFBUTtBQUFBLFVBQ25DO0FBRUEsaUJBQU87QUFBQSxRQUNSLENBQUM7QUFBQSxNQUNGLE9BQU87QUFDTixRQUFDLE1BQWMsS0FBSyxJQUFJLE9BQU8sS0FBSztBQUFBLE1BQ3JDO0FBQUEsSUFDRDtBQUNBLFdBQU8sUUFBUSxRQUFRLE1BQVM7QUFBQSxFQUNqQztBQUFBLEVBRUEsU0FBUyxXQUFrQztBQUMxQyxVQUFNLFVBQVUsS0FBSyxTQUFTLElBQUksU0FBUztBQUMzQyxRQUFJLFNBQVM7QUFDWixjQUFRLE1BQU0sUUFBUTtBQUN0QixXQUFLLFNBQVMsT0FBTyxTQUFTO0FBQUEsSUFDL0I7QUFDQSxXQUFPLFFBQVEsUUFBUSxNQUFTO0FBQUEsRUFDakM7QUFDRDtBQXhNYSxzQkFBTjtBQUFBLEVBRE4scUJBQXFCLFlBQVksbUJBQW1CO0FBQUEsRUFZbEQ7QUFBQSxHQVhVOyIsCiAgIm5hbWVzIjogWyJpbnB1dCJdCn0K
