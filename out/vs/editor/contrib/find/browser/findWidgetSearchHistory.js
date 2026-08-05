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
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
let FindWidgetSearchHistory = class {
  constructor(storageService) {
    this.storageService = storageService;
    this.inMemoryValues = /* @__PURE__ */ new Set();
    this._onDidChangeEmitter = new Emitter();
    this.onDidChange = this._onDidChangeEmitter.event;
    this.load();
  }
  static getOrCreate(storageService) {
    if (!FindWidgetSearchHistory._instance) {
      FindWidgetSearchHistory._instance = new FindWidgetSearchHistory(storageService);
    }
    return FindWidgetSearchHistory._instance;
  }
  delete(t) {
    const result = this.inMemoryValues.delete(t);
    this.save();
    return result;
  }
  add(t) {
    this.inMemoryValues.add(t);
    this.save();
    return this;
  }
  has(t) {
    return this.inMemoryValues.has(t);
  }
  clear() {
    this.inMemoryValues.clear();
    this.save();
  }
  forEach(callbackfn, thisArg) {
    this.load();
    return this.inMemoryValues.forEach(callbackfn);
  }
  replace(t) {
    this.inMemoryValues = new Set(t);
    this.save();
  }
  load() {
    let result;
    const raw = this.storageService.get(
      FindWidgetSearchHistory.FIND_HISTORY_KEY,
      StorageScope.WORKSPACE
    );
    if (raw) {
      try {
        result = JSON.parse(raw);
      } catch (e) {
      }
    }
    this.inMemoryValues = new Set(result || []);
  }
  // Run saves async
  save() {
    const elements = [];
    this.inMemoryValues.forEach((e) => elements.push(e));
    return new Promise((resolve) => {
      this.storageService.store(
        FindWidgetSearchHistory.FIND_HISTORY_KEY,
        JSON.stringify(elements),
        StorageScope.WORKSPACE,
        StorageTarget.USER
      );
      this._onDidChangeEmitter.fire(elements);
      resolve();
    });
  }
};
FindWidgetSearchHistory.FIND_HISTORY_KEY = "workbench.find.history";
FindWidgetSearchHistory._instance = null;
FindWidgetSearchHistory = __decorateClass([
  __decorateParam(0, IStorageService)
], FindWidgetSearchHistory);
export {
  FindWidgetSearchHistory
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9maW5kL2Jyb3dzZXIvZmluZFdpZGdldFNlYXJjaEhpc3RvcnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElIaXN0b3J5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5leHBvcnQgY2xhc3MgRmluZFdpZGdldFNlYXJjaEhpc3RvcnkgaW1wbGVtZW50cyBJSGlzdG9yeTxzdHJpbmc+IHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBGSU5EX0hJU1RPUllfS0VZID0gJ3dvcmtiZW5jaC5maW5kLmhpc3RvcnknO1xuXHRwcml2YXRlIGluTWVtb3J5VmFsdWVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0cHVibGljIG9uRGlkQ2hhbmdlPzogRXZlbnQ8c3RyaW5nW10+O1xuXHRwcml2YXRlIF9vbkRpZENoYW5nZUVtaXR0ZXI6IEVtaXR0ZXI8c3RyaW5nW10+O1xuXG5cdHByaXZhdGUgc3RhdGljIF9pbnN0YW5jZTogRmluZFdpZGdldFNlYXJjaEhpc3RvcnkgfCBudWxsID0gbnVsbDtcblxuXHRzdGF0aWMgZ2V0T3JDcmVhdGUoXG5cdFx0c3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0KTogRmluZFdpZGdldFNlYXJjaEhpc3Rvcnkge1xuXHRcdGlmICghRmluZFdpZGdldFNlYXJjaEhpc3RvcnkuX2luc3RhbmNlKSB7XG5cdFx0XHRGaW5kV2lkZ2V0U2VhcmNoSGlzdG9yeS5faW5zdGFuY2UgPSBuZXcgRmluZFdpZGdldFNlYXJjaEhpc3Rvcnkoc3RvcmFnZVNlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gRmluZFdpZGdldFNlYXJjaEhpc3RvcnkuX2luc3RhbmNlO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRW1pdHRlciA9IG5ldyBFbWl0dGVyPHN0cmluZ1tdPigpO1xuXHRcdHRoaXMub25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZUVtaXR0ZXIuZXZlbnQ7XG5cdFx0dGhpcy5sb2FkKCk7XG5cdH1cblxuXHRkZWxldGUodDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5pbk1lbW9yeVZhbHVlcy5kZWxldGUodCk7XG5cdFx0dGhpcy5zYXZlKCk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGFkZCh0OiBzdHJpbmcpOiB0aGlzIHtcblx0XHR0aGlzLmluTWVtb3J5VmFsdWVzLmFkZCh0KTtcblx0XHR0aGlzLnNhdmUoKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGhhcyh0OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pbk1lbW9yeVZhbHVlcy5oYXModCk7XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLmluTWVtb3J5VmFsdWVzLmNsZWFyKCk7XG5cdFx0dGhpcy5zYXZlKCk7XG5cdH1cblxuXHRmb3JFYWNoKGNhbGxiYWNrZm46ICh2YWx1ZTogc3RyaW5nLCB2YWx1ZTI6IHN0cmluZywgc2V0OiBTZXQ8c3RyaW5nPikgPT4gdm9pZCwgdGhpc0FyZz86IGFueSk6IHZvaWQge1xuXHRcdC8vIGZldGNoIGxhdGVzdCBmcm9tIHN0b3JhZ2Vcblx0XHR0aGlzLmxvYWQoKTtcblx0XHRyZXR1cm4gdGhpcy5pbk1lbW9yeVZhbHVlcy5mb3JFYWNoKGNhbGxiYWNrZm4pO1xuXHR9XG5cdHJlcGxhY2U/KHQ6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0dGhpcy5pbk1lbW9yeVZhbHVlcyA9IG5ldyBTZXQodCk7XG5cdFx0dGhpcy5zYXZlKCk7XG5cdH1cblxuXHRsb2FkKCkge1xuXHRcdGxldCByZXN1bHQ6IFtdIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHJhdyA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KFxuXHRcdFx0RmluZFdpZGdldFNlYXJjaEhpc3RvcnkuRklORF9ISVNUT1JZX0tFWSxcblx0XHRcdFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0Vcblx0XHQpO1xuXG5cdFx0aWYgKHJhdykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmVzdWx0ID0gSlNPTi5wYXJzZShyYXcpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyBJbnZhbGlkIGRhdGFcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmluTWVtb3J5VmFsdWVzID0gbmV3IFNldChyZXN1bHQgfHwgW10pO1xuXHR9XG5cblx0Ly8gUnVuIHNhdmVzIGFzeW5jXG5cdHNhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWxlbWVudHM6IHN0cmluZ1tdID0gW107XG5cdFx0dGhpcy5pbk1lbW9yeVZhbHVlcy5mb3JFYWNoKGUgPT4gZWxlbWVudHMucHVzaChlKSk7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShcblx0XHRcdFx0RmluZFdpZGdldFNlYXJjaEhpc3RvcnkuRklORF9ISVNUT1JZX0tFWSxcblx0XHRcdFx0SlNPTi5zdHJpbmdpZnkoZWxlbWVudHMpLFxuXHRcdFx0XHRTdG9yYWdlU2NvcGUuV09SS1NQQUNFLFxuXHRcdFx0XHRTdG9yYWdlVGFyZ2V0LlVTRVIsXG5cdFx0XHQpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VFbWl0dGVyLmZpcmUoZWxlbWVudHMpO1xuXHRcdFx0cmVzb2x2ZSgpO1xuXHRcdH0pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBc0I7QUFFL0IsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFFdEQsSUFBTSwwQkFBTixNQUEwRDtBQUFBLEVBaUJoRSxZQUNtQyxnQkFDakM7QUFEaUM7QUFoQm5DLFNBQVEsaUJBQThCLG9CQUFJLElBQUk7QUFrQjdDLFNBQUssc0JBQXNCLElBQUksUUFBa0I7QUFDakQsU0FBSyxjQUFjLEtBQUssb0JBQW9CO0FBQzVDLFNBQUssS0FBSztBQUFBLEVBQ1g7QUFBQSxFQWZBLE9BQU8sWUFDTixnQkFDMEI7QUFDMUIsUUFBSSxDQUFDLHdCQUF3QixXQUFXO0FBQ3ZDLDhCQUF3QixZQUFZLElBQUksd0JBQXdCLGNBQWM7QUFBQSxJQUMvRTtBQUNBLFdBQU8sd0JBQXdCO0FBQUEsRUFDaEM7QUFBQSxFQVVBLE9BQU8sR0FBb0I7QUFDMUIsVUFBTSxTQUFTLEtBQUssZUFBZSxPQUFPLENBQUM7QUFDM0MsU0FBSyxLQUFLO0FBQ1YsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLElBQUksR0FBaUI7QUFDcEIsU0FBSyxlQUFlLElBQUksQ0FBQztBQUN6QixTQUFLLEtBQUs7QUFDVixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsSUFBSSxHQUFvQjtBQUN2QixXQUFPLEtBQUssZUFBZSxJQUFJLENBQUM7QUFBQSxFQUNqQztBQUFBLEVBRUEsUUFBYztBQUNiLFNBQUssZUFBZSxNQUFNO0FBQzFCLFNBQUssS0FBSztBQUFBLEVBQ1g7QUFBQSxFQUVBLFFBQVEsWUFBdUUsU0FBcUI7QUFFbkcsU0FBSyxLQUFLO0FBQ1YsV0FBTyxLQUFLLGVBQWUsUUFBUSxVQUFVO0FBQUEsRUFDOUM7QUFBQSxFQUNBLFFBQVMsR0FBbUI7QUFDM0IsU0FBSyxpQkFBaUIsSUFBSSxJQUFJLENBQUM7QUFDL0IsU0FBSyxLQUFLO0FBQUEsRUFDWDtBQUFBLEVBRUEsT0FBTztBQUNOLFFBQUk7QUFDSixVQUFNLE1BQU0sS0FBSyxlQUFlO0FBQUEsTUFDL0Isd0JBQXdCO0FBQUEsTUFDeEIsYUFBYTtBQUFBLElBQ2Q7QUFFQSxRQUFJLEtBQUs7QUFDUixVQUFJO0FBQ0gsaUJBQVMsS0FBSyxNQUFNLEdBQUc7QUFBQSxNQUN4QixTQUFTLEdBQUc7QUFBQSxNQUVaO0FBQUEsSUFDRDtBQUVBLFNBQUssaUJBQWlCLElBQUksSUFBSSxVQUFVLENBQUMsQ0FBQztBQUFBLEVBQzNDO0FBQUE7QUFBQSxFQUdBLE9BQXNCO0FBQ3JCLFVBQU0sV0FBcUIsQ0FBQztBQUM1QixTQUFLLGVBQWUsUUFBUSxPQUFLLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFDakQsV0FBTyxJQUFJLFFBQWMsYUFBVztBQUNuQyxXQUFLLGVBQWU7QUFBQSxRQUNuQix3QkFBd0I7QUFBQSxRQUN4QixLQUFLLFVBQVUsUUFBUTtBQUFBLFFBQ3ZCLGFBQWE7QUFBQSxRQUNiLGNBQWM7QUFBQSxNQUNmO0FBQ0EsV0FBSyxvQkFBb0IsS0FBSyxRQUFRO0FBQ3RDLGNBQVE7QUFBQSxJQUNULENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUF6RmEsd0JBQ1csbUJBQW1CO0FBRDlCLHdCQU1HLFlBQTRDO0FBTi9DLDBCQUFOO0FBQUEsRUFrQko7QUFBQSxHQWxCVTsiLAogICJuYW1lcyI6IFtdCn0K
