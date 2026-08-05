import { parse } from "../../../../base/common/console.js";
function logRemoteEntry(logService, entry, label = null) {
  const args = parse(entry).args;
  let firstArg = args.shift();
  if (typeof firstArg !== "string") {
    return;
  }
  if (!entry.severity) {
    entry.severity = "info";
  }
  if (label) {
    if (!/^\[/.test(label)) {
      label = `[${label}]`;
    }
    if (!/ $/.test(label)) {
      label = `${label} `;
    }
    firstArg = label + firstArg;
  }
  switch (entry.severity) {
    case "log":
    case "info":
      logService.info(firstArg, ...args);
      break;
    case "warn":
      logService.warn(firstArg, ...args);
      break;
    case "error":
      logService.error(firstArg, ...args);
      break;
  }
}
function logRemoteEntryIfError(logService, entry, label) {
  const args = parse(entry).args;
  const firstArg = args.shift();
  if (typeof firstArg !== "string" || entry.severity !== "error") {
    return;
  }
  if (!/^\[/.test(label)) {
    label = `[${label}]`;
  }
  if (!/ $/.test(label)) {
    label = `${label} `;
  }
  logService.error(label + firstArg, ...args);
}
export {
  logRemoteEntry,
  logRemoteEntryIfError
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vcmVtb3RlQ29uc29sZVV0aWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJUmVtb3RlQ29uc29sZUxvZywgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb25zb2xlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gbG9nUmVtb3RlRW50cnkobG9nU2VydmljZTogSUxvZ1NlcnZpY2UsIGVudHJ5OiBJUmVtb3RlQ29uc29sZUxvZywgbGFiZWw6IHN0cmluZyB8IG51bGwgPSBudWxsKTogdm9pZCB7XG5cdGNvbnN0IGFyZ3MgPSBwYXJzZShlbnRyeSkuYXJncztcblx0bGV0IGZpcnN0QXJnID0gYXJncy5zaGlmdCgpO1xuXHRpZiAodHlwZW9mIGZpcnN0QXJnICE9PSAnc3RyaW5nJykge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmICghZW50cnkuc2V2ZXJpdHkpIHtcblx0XHRlbnRyeS5zZXZlcml0eSA9ICdpbmZvJztcblx0fVxuXG5cdGlmIChsYWJlbCkge1xuXHRcdGlmICghL15cXFsvLnRlc3QobGFiZWwpKSB7XG5cdFx0XHRsYWJlbCA9IGBbJHtsYWJlbH1dYDtcblx0XHR9XG5cdFx0aWYgKCEvICQvLnRlc3QobGFiZWwpKSB7XG5cdFx0XHRsYWJlbCA9IGAke2xhYmVsfSBgO1xuXHRcdH1cblx0XHRmaXJzdEFyZyA9IGxhYmVsICsgZmlyc3RBcmc7XG5cdH1cblxuXHRzd2l0Y2ggKGVudHJ5LnNldmVyaXR5KSB7XG5cdFx0Y2FzZSAnbG9nJzpcblx0XHRjYXNlICdpbmZvJzpcblx0XHRcdGxvZ1NlcnZpY2UuaW5mbyhmaXJzdEFyZywgLi4uYXJncyk7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlICd3YXJuJzpcblx0XHRcdGxvZ1NlcnZpY2Uud2FybihmaXJzdEFyZywgLi4uYXJncyk7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlICdlcnJvcic6XG5cdFx0XHRsb2dTZXJ2aWNlLmVycm9yKGZpcnN0QXJnLCAuLi5hcmdzKTtcblx0XHRcdGJyZWFrO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dSZW1vdGVFbnRyeUlmRXJyb3IobG9nU2VydmljZTogSUxvZ1NlcnZpY2UsIGVudHJ5OiBJUmVtb3RlQ29uc29sZUxvZywgbGFiZWw6IHN0cmluZyk6IHZvaWQge1xuXHRjb25zdCBhcmdzID0gcGFyc2UoZW50cnkpLmFyZ3M7XG5cdGNvbnN0IGZpcnN0QXJnID0gYXJncy5zaGlmdCgpO1xuXHRpZiAodHlwZW9mIGZpcnN0QXJnICE9PSAnc3RyaW5nJyB8fCBlbnRyeS5zZXZlcml0eSAhPT0gJ2Vycm9yJykge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmICghL15cXFsvLnRlc3QobGFiZWwpKSB7XG5cdFx0bGFiZWwgPSBgWyR7bGFiZWx9XWA7XG5cdH1cblx0aWYgKCEvICQvLnRlc3QobGFiZWwpKSB7XG5cdFx0bGFiZWwgPSBgJHtsYWJlbH0gYDtcblx0fVxuXG5cdGxvZ1NlcnZpY2UuZXJyb3IobGFiZWwgKyBmaXJzdEFyZywgLi4uYXJncyk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUE0QixhQUFhO0FBR2xDLFNBQVMsZUFBZSxZQUF5QixPQUEwQixRQUF1QixNQUFZO0FBQ3BILFFBQU0sT0FBTyxNQUFNLEtBQUssRUFBRTtBQUMxQixNQUFJLFdBQVcsS0FBSyxNQUFNO0FBQzFCLE1BQUksT0FBTyxhQUFhLFVBQVU7QUFDakM7QUFBQSxFQUNEO0FBRUEsTUFBSSxDQUFDLE1BQU0sVUFBVTtBQUNwQixVQUFNLFdBQVc7QUFBQSxFQUNsQjtBQUVBLE1BQUksT0FBTztBQUNWLFFBQUksQ0FBQyxNQUFNLEtBQUssS0FBSyxHQUFHO0FBQ3ZCLGNBQVEsSUFBSSxLQUFLO0FBQUEsSUFDbEI7QUFDQSxRQUFJLENBQUMsS0FBSyxLQUFLLEtBQUssR0FBRztBQUN0QixjQUFRLEdBQUcsS0FBSztBQUFBLElBQ2pCO0FBQ0EsZUFBVyxRQUFRO0FBQUEsRUFDcEI7QUFFQSxVQUFRLE1BQU0sVUFBVTtBQUFBLElBQ3ZCLEtBQUs7QUFBQSxJQUNMLEtBQUs7QUFDSixpQkFBVyxLQUFLLFVBQVUsR0FBRyxJQUFJO0FBQ2pDO0FBQUEsSUFDRCxLQUFLO0FBQ0osaUJBQVcsS0FBSyxVQUFVLEdBQUcsSUFBSTtBQUNqQztBQUFBLElBQ0QsS0FBSztBQUNKLGlCQUFXLE1BQU0sVUFBVSxHQUFHLElBQUk7QUFDbEM7QUFBQSxFQUNGO0FBQ0Q7QUFFTyxTQUFTLHNCQUFzQixZQUF5QixPQUEwQixPQUFxQjtBQUM3RyxRQUFNLE9BQU8sTUFBTSxLQUFLLEVBQUU7QUFDMUIsUUFBTSxXQUFXLEtBQUssTUFBTTtBQUM1QixNQUFJLE9BQU8sYUFBYSxZQUFZLE1BQU0sYUFBYSxTQUFTO0FBQy9EO0FBQUEsRUFDRDtBQUVBLE1BQUksQ0FBQyxNQUFNLEtBQUssS0FBSyxHQUFHO0FBQ3ZCLFlBQVEsSUFBSSxLQUFLO0FBQUEsRUFDbEI7QUFDQSxNQUFJLENBQUMsS0FBSyxLQUFLLEtBQUssR0FBRztBQUN0QixZQUFRLEdBQUcsS0FBSztBQUFBLEVBQ2pCO0FBRUEsYUFBVyxNQUFNLFFBQVEsVUFBVSxHQUFHLElBQUk7QUFDM0M7IiwKICAibmFtZXMiOiBbXQp9Cg==
