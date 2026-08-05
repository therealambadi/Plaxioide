import { env } from "./process.js";
function isHotReloadEnabled() {
  return env && !!env["VSCODE_DEV_DEBUG"];
}
function registerHotReloadHandler(handler) {
  if (!isHotReloadEnabled()) {
    return { dispose() {
    } };
  } else {
    const handlers = registerGlobalHotReloadHandler();
    handlers.add(handler);
    return {
      dispose() {
        handlers.delete(handler);
      }
    };
  }
}
function registerGlobalHotReloadHandler() {
  if (!hotReloadHandlers) {
    hotReloadHandlers = /* @__PURE__ */ new Set();
  }
  const g = globalThis;
  if (!g.$hotReload_applyNewExports) {
    g.$hotReload_applyNewExports = (args) => {
      const args2 = { config: { mode: void 0 }, ...args };
      const results = [];
      for (const h of hotReloadHandlers) {
        const result = h(args2);
        if (result) {
          results.push(result);
        }
      }
      if (results.length > 0) {
        return (newExports) => {
          let result = false;
          for (const r of results) {
            if (r(newExports)) {
              result = true;
            }
          }
          return result;
        };
      }
      return void 0;
    };
  }
  return hotReloadHandlers;
}
let hotReloadHandlers = void 0;
if (isHotReloadEnabled()) {
  registerHotReloadHandler(({ oldExports, newSrc, config }) => {
    if (config.mode !== "patch-prototype") {
      return void 0;
    }
    return (newExports) => {
      for (const key in newExports) {
        const exportedItem = newExports[key];
        console.log(`[hot-reload] Patching prototype methods of '${key}'`, { exportedItem });
        if (typeof exportedItem === "function" && exportedItem.prototype) {
          const oldExportedItem = oldExports[key];
          if (oldExportedItem) {
            for (const prop of Object.getOwnPropertyNames(exportedItem.prototype)) {
              const descriptor = Object.getOwnPropertyDescriptor(exportedItem.prototype, prop);
              const oldDescriptor = Object.getOwnPropertyDescriptor(oldExportedItem.prototype, prop);
              if (descriptor?.value?.toString() !== oldDescriptor?.value?.toString()) {
                console.log(`[hot-reload] Patching prototype method '${key}.${prop}'`);
              }
              Object.defineProperty(oldExportedItem.prototype, prop, descriptor);
            }
            newExports[key] = oldExportedItem;
          }
        }
      }
      return true;
    };
  });
}
export {
  isHotReloadEnabled,
  registerHotReloadHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9ob3RSZWxvYWQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVudiB9IGZyb20gJy4vcHJvY2Vzcy5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0hvdFJlbG9hZEVuYWJsZWQoKTogYm9vbGVhbiB7XG5cdHJldHVybiBlbnYgJiYgISFlbnZbJ1ZTQ09ERV9ERVZfREVCVUcnXTtcbn1cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckhvdFJlbG9hZEhhbmRsZXIoaGFuZGxlcjogSG90UmVsb2FkSGFuZGxlcik6IElEaXNwb3NhYmxlIHtcblx0aWYgKCFpc0hvdFJlbG9hZEVuYWJsZWQoKSkge1xuXHRcdHJldHVybiB7IGRpc3Bvc2UoKSB7IH0gfTtcblx0fSBlbHNlIHtcblx0XHRjb25zdCBoYW5kbGVycyA9IHJlZ2lzdGVyR2xvYmFsSG90UmVsb2FkSGFuZGxlcigpO1xuXHRcdGhhbmRsZXJzLmFkZChoYW5kbGVyKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZSgpIHsgaGFuZGxlcnMuZGVsZXRlKGhhbmRsZXIpOyB9XG5cdFx0fTtcblx0fVxufVxuXG4vKipcbiAqIFRha2VzIHRoZSBvbGQgZXhwb3J0cyBvZiB0aGUgbW9kdWxlIHRvIHJlbG9hZCBhbmQgcmV0dXJucyBhIGZ1bmN0aW9uIHRvIGFwcGx5IHRoZSBuZXcgZXhwb3J0cy5cbiAqIElmIGB1bmRlZmluZWRgIGlzIHJldHVybmVkLCB0aGlzIGhhbmRsZXIgaXMgbm90IGFibGUgdG8gaGFuZGxlIHRoZSBtb2R1bGUuXG4gKlxuICogSWYgbm8gaGFuZGxlciBjYW4gYXBwbHkgdGhlIG5ldyBleHBvcnRzLCB0aGUgbW9kdWxlIHdpbGwgbm90IGJlIHJlbG9hZGVkLlxuICovXG5leHBvcnQgdHlwZSBIb3RSZWxvYWRIYW5kbGVyID0gKGFyZ3M6IHsgb2xkRXhwb3J0czogUmVjb3JkPHN0cmluZywgdW5rbm93bj47IG5ld1NyYzogc3RyaW5nOyBjb25maWc6IElIb3RSZWxvYWRDb25maWcgfSkgPT4gQWNjZXB0TmV3RXhwb3J0c0hhbmRsZXIgfCB1bmRlZmluZWQ7XG5leHBvcnQgdHlwZSBBY2NlcHROZXdFeHBvcnRzSGFuZGxlciA9IChuZXdFeHBvcnRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gYm9vbGVhbjtcbmV4cG9ydCB0eXBlIElIb3RSZWxvYWRDb25maWcgPSBIb3RSZWxvYWRDb25maWc7XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyR2xvYmFsSG90UmVsb2FkSGFuZGxlcigpIHtcblx0aWYgKCFob3RSZWxvYWRIYW5kbGVycykge1xuXHRcdGhvdFJlbG9hZEhhbmRsZXJzID0gbmV3IFNldCgpO1xuXHR9XG5cblx0Y29uc3QgZyA9IGdsb2JhbFRoaXMgYXMgdW5rbm93biBhcyBHbG9iYWxUaGlzQWRkaXRpb247XG5cdGlmICghZy4kaG90UmVsb2FkX2FwcGx5TmV3RXhwb3J0cykge1xuXHRcdGcuJGhvdFJlbG9hZF9hcHBseU5ld0V4cG9ydHMgPSBhcmdzID0+IHtcblx0XHRcdGNvbnN0IGFyZ3MyID0geyBjb25maWc6IHsgbW9kZTogdW5kZWZpbmVkIH0sIC4uLmFyZ3MgfTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0czogQWNjZXB0TmV3RXhwb3J0c0hhbmRsZXJbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBoIG9mIGhvdFJlbG9hZEhhbmRsZXJzISkge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBoKGFyZ3MyKTtcblx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdHJlc3VsdHMucHVzaChyZXN1bHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzdWx0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHJldHVybiBuZXdFeHBvcnRzID0+IHtcblx0XHRcdFx0XHRsZXQgcmVzdWx0ID0gZmFsc2U7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCByIG9mIHJlc3VsdHMpIHtcblx0XHRcdFx0XHRcdGlmIChyKG5ld0V4cG9ydHMpKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3VsdCA9IHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH07XG5cdH1cblxuXHRyZXR1cm4gaG90UmVsb2FkSGFuZGxlcnM7XG59XG5cbmxldCBob3RSZWxvYWRIYW5kbGVyczogU2V0PChhcmdzOiB7IG9sZEV4cG9ydHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+OyBuZXdTcmM6IHN0cmluZzsgY29uZmlnOiBIb3RSZWxvYWRDb25maWcgfSkgPT4gQWNjZXB0TmV3RXhwb3J0c0ZuIHwgdW5kZWZpbmVkPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuaW50ZXJmYWNlIEhvdFJlbG9hZENvbmZpZyB7XG5cdG1vZGU/OiAncGF0Y2gtcHJvdG90eXBlJyB8IHVuZGVmaW5lZDtcbn1cblxuaW50ZXJmYWNlIEdsb2JhbFRoaXNBZGRpdGlvbiB7XG5cdCRob3RSZWxvYWRfYXBwbHlOZXdFeHBvcnRzPyhhcmdzOiB7IG9sZEV4cG9ydHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+OyBuZXdTcmM6IHN0cmluZzsgY29uZmlnPzogSG90UmVsb2FkQ29uZmlnIH0pOiBBY2NlcHROZXdFeHBvcnRzRm4gfCB1bmRlZmluZWQ7XG59XG5cbnR5cGUgQWNjZXB0TmV3RXhwb3J0c0ZuID0gKG5ld0V4cG9ydHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSA9PiBib29sZWFuO1xuXG5pZiAoaXNIb3RSZWxvYWRFbmFibGVkKCkpIHtcblx0Ly8gVGhpcyBjb2RlIGRvZXMgbm90IHJ1biBpbiBwcm9kdWN0aW9uLlxuXHRyZWdpc3RlckhvdFJlbG9hZEhhbmRsZXIoKHsgb2xkRXhwb3J0cywgbmV3U3JjLCBjb25maWcgfSkgPT4ge1xuXHRcdGlmIChjb25maWcubW9kZSAhPT0gJ3BhdGNoLXByb3RvdHlwZScpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ld0V4cG9ydHMgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgaW4gbmV3RXhwb3J0cykge1xuXHRcdFx0XHRjb25zdCBleHBvcnRlZEl0ZW0gPSBuZXdFeHBvcnRzW2tleV07XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBbaG90LXJlbG9hZF0gUGF0Y2hpbmcgcHJvdG90eXBlIG1ldGhvZHMgb2YgJyR7a2V5fSdgLCB7IGV4cG9ydGVkSXRlbSB9KTtcblx0XHRcdFx0aWYgKHR5cGVvZiBleHBvcnRlZEl0ZW0gPT09ICdmdW5jdGlvbicgJiYgZXhwb3J0ZWRJdGVtLnByb3RvdHlwZSkge1xuXHRcdFx0XHRcdGNvbnN0IG9sZEV4cG9ydGVkSXRlbSA9IG9sZEV4cG9ydHNba2V5XTtcblx0XHRcdFx0XHRpZiAob2xkRXhwb3J0ZWRJdGVtKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHByb3Agb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoZXhwb3J0ZWRJdGVtLnByb3RvdHlwZSkpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZXhwb3J0ZWRJdGVtLnByb3RvdHlwZSwgcHJvcCkhO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBvbGREZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcigob2xkRXhwb3J0ZWRJdGVtIGFzIGFueSkucHJvdG90eXBlLCBwcm9wKTtcblxuXHRcdFx0XHRcdFx0XHRpZiAoZGVzY3JpcHRvcj8udmFsdWU/LnRvU3RyaW5nKCkgIT09IG9sZERlc2NyaXB0b3I/LnZhbHVlPy50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFtob3QtcmVsb2FkXSBQYXRjaGluZyBwcm90b3R5cGUgbWV0aG9kICcke2tleX0uJHtwcm9wfSdgKTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSgob2xkRXhwb3J0ZWRJdGVtIGFzIGFueSkucHJvdG90eXBlLCBwcm9wLCBkZXNjcmlwdG9yKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG5ld0V4cG9ydHNba2V5XSA9IG9sZEV4cG9ydGVkSXRlbTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxXQUFXO0FBRWIsU0FBUyxxQkFBOEI7QUFDN0MsU0FBTyxPQUFPLENBQUMsQ0FBQyxJQUFJLGtCQUFrQjtBQUN2QztBQUNPLFNBQVMseUJBQXlCLFNBQXdDO0FBQ2hGLE1BQUksQ0FBQyxtQkFBbUIsR0FBRztBQUMxQixXQUFPLEVBQUUsVUFBVTtBQUFBLElBQUUsRUFBRTtBQUFBLEVBQ3hCLE9BQU87QUFDTixVQUFNLFdBQVcsK0JBQStCO0FBQ2hELGFBQVMsSUFBSSxPQUFPO0FBQ3BCLFdBQU87QUFBQSxNQUNOLFVBQVU7QUFBRSxpQkFBUyxPQUFPLE9BQU87QUFBQSxNQUFHO0FBQUEsSUFDdkM7QUFBQSxFQUNEO0FBQ0Q7QUFZQSxTQUFTLGlDQUFpQztBQUN6QyxNQUFJLENBQUMsbUJBQW1CO0FBQ3ZCLHdCQUFvQixvQkFBSSxJQUFJO0FBQUEsRUFDN0I7QUFFQSxRQUFNLElBQUk7QUFDVixNQUFJLENBQUMsRUFBRSw0QkFBNEI7QUFDbEMsTUFBRSw2QkFBNkIsVUFBUTtBQUN0QyxZQUFNLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxPQUFVLEdBQUcsR0FBRyxLQUFLO0FBRXJELFlBQU0sVUFBcUMsQ0FBQztBQUM1QyxpQkFBVyxLQUFLLG1CQUFvQjtBQUNuQyxjQUFNLFNBQVMsRUFBRSxLQUFLO0FBQ3RCLFlBQUksUUFBUTtBQUNYLGtCQUFRLEtBQUssTUFBTTtBQUFBLFFBQ3BCO0FBQUEsTUFDRDtBQUNBLFVBQUksUUFBUSxTQUFTLEdBQUc7QUFDdkIsZUFBTyxnQkFBYztBQUNwQixjQUFJLFNBQVM7QUFDYixxQkFBVyxLQUFLLFNBQVM7QUFDeEIsZ0JBQUksRUFBRSxVQUFVLEdBQUc7QUFDbEIsdUJBQVM7QUFBQSxZQUNWO0FBQUEsVUFDRDtBQUNBLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFFQSxTQUFPO0FBQ1I7QUFFQSxJQUFJLG9CQUFpSztBQVlySyxJQUFJLG1CQUFtQixHQUFHO0FBRXpCLDJCQUF5QixDQUFDLEVBQUUsWUFBWSxRQUFRLE9BQU8sTUFBTTtBQUM1RCxRQUFJLE9BQU8sU0FBUyxtQkFBbUI7QUFDdEMsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLGdCQUFjO0FBQ3BCLGlCQUFXLE9BQU8sWUFBWTtBQUM3QixjQUFNLGVBQWUsV0FBVyxHQUFHO0FBQ25DLGdCQUFRLElBQUksK0NBQStDLEdBQUcsS0FBSyxFQUFFLGFBQWEsQ0FBQztBQUNuRixZQUFJLE9BQU8saUJBQWlCLGNBQWMsYUFBYSxXQUFXO0FBQ2pFLGdCQUFNLGtCQUFrQixXQUFXLEdBQUc7QUFDdEMsY0FBSSxpQkFBaUI7QUFDcEIsdUJBQVcsUUFBUSxPQUFPLG9CQUFvQixhQUFhLFNBQVMsR0FBRztBQUN0RSxvQkFBTSxhQUFhLE9BQU8seUJBQXlCLGFBQWEsV0FBVyxJQUFJO0FBQy9FLG9CQUFNLGdCQUFnQixPQUFPLHlCQUEwQixnQkFBd0IsV0FBVyxJQUFJO0FBRTlGLGtCQUFJLFlBQVksT0FBTyxTQUFTLE1BQU0sZUFBZSxPQUFPLFNBQVMsR0FBRztBQUN2RSx3QkFBUSxJQUFJLDJDQUEyQyxHQUFHLElBQUksSUFBSSxHQUFHO0FBQUEsY0FDdEU7QUFFQSxxQkFBTyxlQUFnQixnQkFBd0IsV0FBVyxNQUFNLFVBQVU7QUFBQSxZQUMzRTtBQUNBLHVCQUFXLEdBQUcsSUFBSTtBQUFBLFVBQ25CO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0QsQ0FBQztBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
