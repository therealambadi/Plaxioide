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
import { onUnexpectedError, transformErrorFromSerialization } from "../../../base/common/errors.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { MainContext } from "../common/extHost.protocol.js";
let MainThreadErrors = class {
  dispose() {
  }
  $onUnexpectedError(err) {
    if (err && err.$isError) {
      err = transformErrorFromSerialization(err);
    }
    onUnexpectedError(err);
  }
};
MainThreadErrors = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadErrors)
], MainThreadErrors);
export {
  MainThreadErrors
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZEVycm9ycy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFNlcmlhbGl6ZWRFcnJvciwgb25VbmV4cGVjdGVkRXJyb3IsIHRyYW5zZm9ybUVycm9yRnJvbVNlcmlhbGl6YXRpb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgZXh0SG9zdE5hbWVkQ3VzdG9tZXIgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRIb3N0Q3VzdG9tZXJzLmpzJztcbmltcG9ydCB7IE1haW5Db250ZXh0LCBNYWluVGhyZWFkRXJyb3JzU2hhcGUgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5cbkBleHRIb3N0TmFtZWRDdXN0b21lcihNYWluQ29udGV4dC5NYWluVGhyZWFkRXJyb3JzKVxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRFcnJvcnMgaW1wbGVtZW50cyBNYWluVGhyZWFkRXJyb3JzU2hhcGUge1xuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0Ly9cblx0fVxuXG5cdCRvblVuZXhwZWN0ZWRFcnJvcihlcnI6IGFueSB8IFNlcmlhbGl6ZWRFcnJvcik6IHZvaWQge1xuXHRcdGlmIChlcnIgJiYgZXJyLiRpc0Vycm9yKSB7XG5cdFx0XHRlcnIgPSB0cmFuc2Zvcm1FcnJvckZyb21TZXJpYWxpemF0aW9uKGVycik7XG5cdFx0fVxuXHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFLQSxTQUEwQixtQkFBbUIsdUNBQXVDO0FBQ3BGLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsbUJBQTBDO0FBRzVDLElBQU0sbUJBQU4sTUFBd0Q7QUFBQSxFQUU5RCxVQUFnQjtBQUFBLEVBRWhCO0FBQUEsRUFFQSxtQkFBbUIsS0FBa0M7QUFDcEQsUUFBSSxPQUFPLElBQUksVUFBVTtBQUN4QixZQUFNLGdDQUFnQyxHQUFHO0FBQUEsSUFDMUM7QUFDQSxzQkFBa0IsR0FBRztBQUFBLEVBQ3RCO0FBQ0Q7QUFaYSxtQkFBTjtBQUFBLEVBRE4scUJBQXFCLFlBQVksZ0JBQWdCO0FBQUEsR0FDckM7IiwKICAibmFtZXMiOiBbXQp9Cg==
