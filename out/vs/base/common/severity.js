import * as strings from "./strings.js";
var Severity = /* @__PURE__ */ ((Severity2) => {
  Severity2[Severity2["Ignore"] = 0] = "Ignore";
  Severity2[Severity2["Info"] = 1] = "Info";
  Severity2[Severity2["Warning"] = 2] = "Warning";
  Severity2[Severity2["Error"] = 3] = "Error";
  return Severity2;
})(Severity || {});
((Severity2) => {
  const _error = "error";
  const _warning = "warning";
  const _warn = "warn";
  const _info = "info";
  const _ignore = "ignore";
  function fromValue(value) {
    if (!value) {
      return 0 /* Ignore */;
    }
    if (strings.equalsIgnoreCase(_error, value)) {
      return 3 /* Error */;
    }
    if (strings.equalsIgnoreCase(_warning, value) || strings.equalsIgnoreCase(_warn, value)) {
      return 2 /* Warning */;
    }
    if (strings.equalsIgnoreCase(_info, value)) {
      return 1 /* Info */;
    }
    return 0 /* Ignore */;
  }
  Severity2.fromValue = fromValue;
  function toString(severity) {
    switch (severity) {
      case 3 /* Error */:
        return _error;
      case 2 /* Warning */:
        return _warning;
      case 1 /* Info */:
        return _info;
      default:
        return _ignore;
    }
  }
  Severity2.toString = toString;
})(Severity || (Severity = {}));
var severity_default = Severity;
export {
  severity_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9zZXZlcml0eS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi9zdHJpbmdzLmpzJztcblxuZW51bSBTZXZlcml0eSB7XG5cdElnbm9yZSA9IDAsXG5cdEluZm8gPSAxLFxuXHRXYXJuaW5nID0gMixcblx0RXJyb3IgPSAzXG59XG5cbm5hbWVzcGFjZSBTZXZlcml0eSB7XG5cblx0Y29uc3QgX2Vycm9yID0gJ2Vycm9yJztcblx0Y29uc3QgX3dhcm5pbmcgPSAnd2FybmluZyc7XG5cdGNvbnN0IF93YXJuID0gJ3dhcm4nO1xuXHRjb25zdCBfaW5mbyA9ICdpbmZvJztcblx0Y29uc3QgX2lnbm9yZSA9ICdpZ25vcmUnO1xuXG5cdC8qKlxuXHQgKiBQYXJzZXMgJ2Vycm9yJywgJ3dhcm5pbmcnLCAnd2FybicsICdpbmZvJyBpbiBjYWxsIGNhc2luZ3Ncblx0ICogYW5kIGZhbGxzIGJhY2sgdG8gaWdub3JlLlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21WYWx1ZSh2YWx1ZTogc3RyaW5nKTogU2V2ZXJpdHkge1xuXHRcdGlmICghdmFsdWUpIHtcblx0XHRcdHJldHVybiBTZXZlcml0eS5JZ25vcmU7XG5cdFx0fVxuXG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZShfZXJyb3IsIHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIFNldmVyaXR5LkVycm9yO1xuXHRcdH1cblxuXHRcdGlmIChzdHJpbmdzLmVxdWFsc0lnbm9yZUNhc2UoX3dhcm5pbmcsIHZhbHVlKSB8fCBzdHJpbmdzLmVxdWFsc0lnbm9yZUNhc2UoX3dhcm4sIHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIFNldmVyaXR5Lldhcm5pbmc7XG5cdFx0fVxuXG5cdFx0aWYgKHN0cmluZ3MuZXF1YWxzSWdub3JlQ2FzZShfaW5mbywgdmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gU2V2ZXJpdHkuSW5mbztcblx0XHR9XG5cdFx0cmV0dXJuIFNldmVyaXR5Lklnbm9yZTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0b1N0cmluZyhzZXZlcml0eTogU2V2ZXJpdHkpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAoc2V2ZXJpdHkpIHtcblx0XHRcdGNhc2UgU2V2ZXJpdHkuRXJyb3I6IHJldHVybiBfZXJyb3I7XG5cdFx0XHRjYXNlIFNldmVyaXR5Lldhcm5pbmc6IHJldHVybiBfd2FybmluZztcblx0XHRcdGNhc2UgU2V2ZXJpdHkuSW5mbzogcmV0dXJuIF9pbmZvO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuIF9pZ25vcmU7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNldmVyaXR5O1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxhQUFhO0FBRXpCLElBQUssV0FBTCxrQkFBS0EsY0FBTDtBQUNDLEVBQUFBLG9CQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLG9CQUFBLFVBQU8sS0FBUDtBQUNBLEVBQUFBLG9CQUFBLGFBQVUsS0FBVjtBQUNBLEVBQUFBLG9CQUFBLFdBQVEsS0FBUjtBQUpJLFNBQUFBO0FBQUEsR0FBQTtBQUFBLENBT0wsQ0FBVUEsY0FBVjtBQUVDLFFBQU0sU0FBUztBQUNmLFFBQU0sV0FBVztBQUNqQixRQUFNLFFBQVE7QUFDZCxRQUFNLFFBQVE7QUFDZCxRQUFNLFVBQVU7QUFNVCxXQUFTLFVBQVUsT0FBeUI7QUFDbEQsUUFBSSxDQUFDLE9BQU87QUFDWCxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksUUFBUSxpQkFBaUIsUUFBUSxLQUFLLEdBQUc7QUFDNUMsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLFFBQVEsaUJBQWlCLFVBQVUsS0FBSyxLQUFLLFFBQVEsaUJBQWlCLE9BQU8sS0FBSyxHQUFHO0FBQ3hGLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxRQUFRLGlCQUFpQixPQUFPLEtBQUssR0FBRztBQUMzQyxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBakJPLEVBQUFBLFVBQVM7QUFtQlQsV0FBUyxTQUFTLFVBQTRCO0FBQ3BELFlBQVEsVUFBVTtBQUFBLE1BQ2pCLEtBQUs7QUFBZ0IsZUFBTztBQUFBLE1BQzVCLEtBQUs7QUFBa0IsZUFBTztBQUFBLE1BQzlCLEtBQUs7QUFBZSxlQUFPO0FBQUEsTUFDM0I7QUFBUyxlQUFPO0FBQUEsSUFDakI7QUFBQSxFQUNEO0FBUE8sRUFBQUEsVUFBUztBQUFBLEdBL0JQO0FBeUNWLElBQU8sbUJBQVE7IiwKICAibmFtZXMiOiBbIlNldmVyaXR5Il0KfQo=
