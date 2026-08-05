import { extname } from "./path.js";
const Mimes = Object.freeze({
  text: "text/plain",
  binary: "application/octet-stream",
  unknown: "application/unknown",
  markdown: "text/markdown",
  latex: "text/latex",
  uriList: "text/uri-list",
  html: "text/html"
});
const mapExtToTextMimes = {
  ".css": "text/css",
  ".csv": "text/csv",
  ".htm": "text/html",
  ".html": "text/html",
  ".ics": "text/calendar",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".txt": "text/plain",
  ".xml": "text/xml"
};
const mapExtToMediaMimes = {
  ".aac": "audio/x-aac",
  ".avi": "video/x-msvideo",
  ".bmp": "image/bmp",
  ".flv": "video/x-flv",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpe": "image/jpg",
  ".jpeg": "image/jpg",
  ".jpg": "image/jpg",
  ".m1v": "video/mpeg",
  ".m2a": "audio/mpeg",
  ".m2v": "video/mpeg",
  ".m3a": "audio/mpeg",
  ".mid": "audio/midi",
  ".midi": "audio/midi",
  ".mk3d": "video/x-matroska",
  ".mks": "video/x-matroska",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".movie": "video/x-sgi-movie",
  ".mp2": "audio/mpeg",
  ".mp2a": "audio/mpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".mp4a": "audio/mp4",
  ".mp4v": "video/mp4",
  ".mpe": "video/mpeg",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".mpg4": "video/mp4",
  ".mpga": "audio/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".ogv": "video/ogg",
  ".png": "image/png",
  ".psd": "image/vnd.adobe.photoshop",
  ".qt": "video/quicktime",
  ".spx": "audio/ogg",
  ".svg": "image/svg+xml",
  ".tga": "image/x-tga",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".wav": "audio/x-wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".wma": "audio/x-ms-wma",
  ".wmv": "video/x-ms-wmv",
  ".woff": "application/font-woff"
};
function getMediaOrTextMime(path) {
  const ext = extname(path);
  const textMime = mapExtToTextMimes[ext.toLowerCase()];
  if (textMime !== void 0) {
    return textMime;
  } else {
    return getMediaMime(path);
  }
}
function getMediaMime(path) {
  const ext = extname(path);
  return mapExtToMediaMimes[ext.toLowerCase()];
}
function getExtensionForMimeType(mimeType) {
  for (const extension in mapExtToMediaMimes) {
    if (mapExtToMediaMimes[extension] === mimeType) {
      return extension;
    }
  }
  return void 0;
}
const _simplePattern = /^(.+)\/(.+?)(;.+)?$/;
function normalizeMimeType(mimeType, strict) {
  const match = _simplePattern.exec(mimeType);
  if (!match) {
    return strict ? void 0 : mimeType;
  }
  return `${match[1].toLowerCase()}/${match[2].toLowerCase()}${match[3] ?? ""}`;
}
export {
  Mimes,
  getExtensionForMimeType,
  getMediaMime,
  getMediaOrTextMime,
  normalizeMimeType
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9taW1lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZXh0bmFtZSB9IGZyb20gJy4vcGF0aC5qcyc7XG5cbmV4cG9ydCBjb25zdCBNaW1lcyA9IE9iamVjdC5mcmVlemUoe1xuXHR0ZXh0OiAndGV4dC9wbGFpbicsXG5cdGJpbmFyeTogJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG5cdHVua25vd246ICdhcHBsaWNhdGlvbi91bmtub3duJyxcblx0bWFya2Rvd246ICd0ZXh0L21hcmtkb3duJyxcblx0bGF0ZXg6ICd0ZXh0L2xhdGV4Jyxcblx0dXJpTGlzdDogJ3RleHQvdXJpLWxpc3QnLFxuXHRodG1sOiAndGV4dC9odG1sJyxcbn0pO1xuXG5pbnRlcmZhY2UgTWFwRXh0VG9NZWRpYU1pbWVzIHtcblx0W2luZGV4OiBzdHJpbmddOiBzdHJpbmc7XG59XG5cbmNvbnN0IG1hcEV4dFRvVGV4dE1pbWVzOiBNYXBFeHRUb01lZGlhTWltZXMgPSB7XG5cdCcuY3NzJzogJ3RleHQvY3NzJyxcblx0Jy5jc3YnOiAndGV4dC9jc3YnLFxuXHQnLmh0bSc6ICd0ZXh0L2h0bWwnLFxuXHQnLmh0bWwnOiAndGV4dC9odG1sJyxcblx0Jy5pY3MnOiAndGV4dC9jYWxlbmRhcicsXG5cdCcuanMnOiAndGV4dC9qYXZhc2NyaXB0Jyxcblx0Jy5tanMnOiAndGV4dC9qYXZhc2NyaXB0Jyxcblx0Jy50eHQnOiAndGV4dC9wbGFpbicsXG5cdCcueG1sJzogJ3RleHQveG1sJ1xufTtcblxuLy8gS25vd24gbWVkaWEgbWltZXMgdGhhdCB3ZSBjYW4gaGFuZGxlXG5jb25zdCBtYXBFeHRUb01lZGlhTWltZXM6IE1hcEV4dFRvTWVkaWFNaW1lcyA9IHtcblx0Jy5hYWMnOiAnYXVkaW8veC1hYWMnLFxuXHQnLmF2aSc6ICd2aWRlby94LW1zdmlkZW8nLFxuXHQnLmJtcCc6ICdpbWFnZS9ibXAnLFxuXHQnLmZsdic6ICd2aWRlby94LWZsdicsXG5cdCcuZ2lmJzogJ2ltYWdlL2dpZicsXG5cdCcuaWNvJzogJ2ltYWdlL3gtaWNvbicsXG5cdCcuanBlJzogJ2ltYWdlL2pwZycsXG5cdCcuanBlZyc6ICdpbWFnZS9qcGcnLFxuXHQnLmpwZyc6ICdpbWFnZS9qcGcnLFxuXHQnLm0xdic6ICd2aWRlby9tcGVnJyxcblx0Jy5tMmEnOiAnYXVkaW8vbXBlZycsXG5cdCcubTJ2JzogJ3ZpZGVvL21wZWcnLFxuXHQnLm0zYSc6ICdhdWRpby9tcGVnJyxcblx0Jy5taWQnOiAnYXVkaW8vbWlkaScsXG5cdCcubWlkaSc6ICdhdWRpby9taWRpJyxcblx0Jy5tazNkJzogJ3ZpZGVvL3gtbWF0cm9za2EnLFxuXHQnLm1rcyc6ICd2aWRlby94LW1hdHJvc2thJyxcblx0Jy5ta3YnOiAndmlkZW8veC1tYXRyb3NrYScsXG5cdCcubW92JzogJ3ZpZGVvL3F1aWNrdGltZScsXG5cdCcubW92aWUnOiAndmlkZW8veC1zZ2ktbW92aWUnLFxuXHQnLm1wMic6ICdhdWRpby9tcGVnJyxcblx0Jy5tcDJhJzogJ2F1ZGlvL21wZWcnLFxuXHQnLm1wMyc6ICdhdWRpby9tcGVnJyxcblx0Jy5tcDQnOiAndmlkZW8vbXA0Jyxcblx0Jy5tcDRhJzogJ2F1ZGlvL21wNCcsXG5cdCcubXA0dic6ICd2aWRlby9tcDQnLFxuXHQnLm1wZSc6ICd2aWRlby9tcGVnJyxcblx0Jy5tcGVnJzogJ3ZpZGVvL21wZWcnLFxuXHQnLm1wZyc6ICd2aWRlby9tcGVnJyxcblx0Jy5tcGc0JzogJ3ZpZGVvL21wNCcsXG5cdCcubXBnYSc6ICdhdWRpby9tcGVnJyxcblx0Jy5vZ2EnOiAnYXVkaW8vb2dnJyxcblx0Jy5vZ2cnOiAnYXVkaW8vb2dnJyxcblx0Jy5vcHVzJzogJ2F1ZGlvL29wdXMnLFxuXHQnLm9ndic6ICd2aWRlby9vZ2cnLFxuXHQnLnBuZyc6ICdpbWFnZS9wbmcnLFxuXHQnLnBzZCc6ICdpbWFnZS92bmQuYWRvYmUucGhvdG9zaG9wJyxcblx0Jy5xdCc6ICd2aWRlby9xdWlja3RpbWUnLFxuXHQnLnNweCc6ICdhdWRpby9vZ2cnLFxuXHQnLnN2Zyc6ICdpbWFnZS9zdmcreG1sJyxcblx0Jy50Z2EnOiAnaW1hZ2UveC10Z2EnLFxuXHQnLnRpZic6ICdpbWFnZS90aWZmJyxcblx0Jy50aWZmJzogJ2ltYWdlL3RpZmYnLFxuXHQnLndhdic6ICdhdWRpby94LXdhdicsXG5cdCcud2VibSc6ICd2aWRlby93ZWJtJyxcblx0Jy53ZWJwJzogJ2ltYWdlL3dlYnAnLFxuXHQnLndtYSc6ICdhdWRpby94LW1zLXdtYScsXG5cdCcud212JzogJ3ZpZGVvL3gtbXMtd212Jyxcblx0Jy53b2ZmJzogJ2FwcGxpY2F0aW9uL2ZvbnQtd29mZicsXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWVkaWFPclRleHRNaW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGV4dCA9IGV4dG5hbWUocGF0aCk7XG5cdGNvbnN0IHRleHRNaW1lID0gbWFwRXh0VG9UZXh0TWltZXNbZXh0LnRvTG93ZXJDYXNlKCldO1xuXHRpZiAodGV4dE1pbWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiB0ZXh0TWltZTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gZ2V0TWVkaWFNaW1lKHBhdGgpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNZWRpYU1pbWUocGF0aDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgZXh0ID0gZXh0bmFtZShwYXRoKTtcblx0cmV0dXJuIG1hcEV4dFRvTWVkaWFNaW1lc1tleHQudG9Mb3dlckNhc2UoKV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFeHRlbnNpb25Gb3JNaW1lVHlwZShtaW1lVHlwZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0Zm9yIChjb25zdCBleHRlbnNpb24gaW4gbWFwRXh0VG9NZWRpYU1pbWVzKSB7XG5cdFx0aWYgKG1hcEV4dFRvTWVkaWFNaW1lc1tleHRlbnNpb25dID09PSBtaW1lVHlwZSkge1xuXHRcdFx0cmV0dXJuIGV4dGVuc2lvbjtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5jb25zdCBfc2ltcGxlUGF0dGVybiA9IC9eKC4rKVxcLyguKz8pKDsuKyk/JC87XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVNaW1lVHlwZShtaW1lVHlwZTogc3RyaW5nKTogc3RyaW5nO1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZU1pbWVUeXBlKG1pbWVUeXBlOiBzdHJpbmcsIHN0cmljdDogdHJ1ZSk6IHN0cmluZyB8IHVuZGVmaW5lZDtcbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVNaW1lVHlwZShtaW1lVHlwZTogc3RyaW5nLCBzdHJpY3Q/OiB0cnVlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblxuXHRjb25zdCBtYXRjaCA9IF9zaW1wbGVQYXR0ZXJuLmV4ZWMobWltZVR5cGUpO1xuXHRpZiAoIW1hdGNoKSB7XG5cdFx0cmV0dXJuIHN0cmljdFxuXHRcdFx0PyB1bmRlZmluZWRcblx0XHRcdDogbWltZVR5cGU7XG5cdH1cblx0Ly8gaHR0cHM6Ly9kYXRhdHJhY2tlci5pZXRmLm9yZy9kb2MvaHRtbC9yZmMyMDQ1I3NlY3Rpb24tNS4xXG5cdC8vIG1lZGlhIGFuZCBzdWJ0eXBlIG11c3QgQUxXQVlTIGJlIGxvd2VyY2FzZSwgcGFyYW1ldGVyIG5vdFxuXHRyZXR1cm4gYCR7bWF0Y2hbMV0udG9Mb3dlckNhc2UoKX0vJHttYXRjaFsyXS50b0xvd2VyQ2FzZSgpfSR7bWF0Y2hbM10gPz8gJyd9YDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZUFBZTtBQUVqQixNQUFNLFFBQVEsT0FBTyxPQUFPO0FBQUEsRUFDbEMsTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsVUFBVTtBQUFBLEVBQ1YsT0FBTztBQUFBLEVBQ1AsU0FBUztBQUFBLEVBQ1QsTUFBTTtBQUNQLENBQUM7QUFNRCxNQUFNLG9CQUF3QztBQUFBLEVBQzdDLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFNBQVM7QUFBQSxFQUNULFFBQVE7QUFBQSxFQUNSLE9BQU87QUFBQSxFQUNQLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFDVDtBQUdBLE1BQU0scUJBQXlDO0FBQUEsRUFDOUMsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsVUFBVTtBQUFBLEVBQ1YsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsT0FBTztBQUFBLEVBQ1AsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUNWO0FBRU8sU0FBUyxtQkFBbUIsTUFBa0M7QUFDcEUsUUFBTSxNQUFNLFFBQVEsSUFBSTtBQUN4QixRQUFNLFdBQVcsa0JBQWtCLElBQUksWUFBWSxDQUFDO0FBQ3BELE1BQUksYUFBYSxRQUFXO0FBQzNCLFdBQU87QUFBQSxFQUNSLE9BQU87QUFDTixXQUFPLGFBQWEsSUFBSTtBQUFBLEVBQ3pCO0FBQ0Q7QUFFTyxTQUFTLGFBQWEsTUFBa0M7QUFDOUQsUUFBTSxNQUFNLFFBQVEsSUFBSTtBQUN4QixTQUFPLG1CQUFtQixJQUFJLFlBQVksQ0FBQztBQUM1QztBQUVPLFNBQVMsd0JBQXdCLFVBQXNDO0FBQzdFLGFBQVcsYUFBYSxvQkFBb0I7QUFDM0MsUUFBSSxtQkFBbUIsU0FBUyxNQUFNLFVBQVU7QUFDL0MsYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBRUEsU0FBTztBQUNSO0FBRUEsTUFBTSxpQkFBaUI7QUFJaEIsU0FBUyxrQkFBa0IsVUFBa0IsUUFBbUM7QUFFdEYsUUFBTSxRQUFRLGVBQWUsS0FBSyxRQUFRO0FBQzFDLE1BQUksQ0FBQyxPQUFPO0FBQ1gsV0FBTyxTQUNKLFNBQ0E7QUFBQSxFQUNKO0FBR0EsU0FBTyxHQUFHLE1BQU0sQ0FBQyxFQUFFLFlBQVksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxFQUFFLFlBQVksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEVBQUU7QUFDNUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
