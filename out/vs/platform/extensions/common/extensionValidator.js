import { isEqualOrParent, joinPath } from "../../../base/common/resources.js";
import Severity from "../../../base/common/severity.js";
import * as nls from "../../../nls.js";
import * as semver from "../../../base/common/semver/semver.js";
import { parseApiProposals } from "./extensions.js";
import { allApiProposals } from "./extensionsApiProposals.js";
const VERSION_REGEXP = /^(\^|>=)?((\d+)|x)\.((\d+)|x)\.((\d+)|x)(\-.*)?$/;
const NOT_BEFORE_REGEXP = /^-(\d{4})(\d{2})(\d{2})$/;
function isValidVersionStr(version) {
  version = version.trim();
  return version === "*" || VERSION_REGEXP.test(version);
}
function parseVersion(version) {
  if (!isValidVersionStr(version)) {
    return null;
  }
  version = version.trim();
  if (version === "*") {
    return {
      hasCaret: false,
      hasGreaterEquals: false,
      majorBase: 0,
      majorMustEqual: false,
      minorBase: 0,
      minorMustEqual: false,
      patchBase: 0,
      patchMustEqual: false,
      preRelease: null
    };
  }
  const m = version.match(VERSION_REGEXP);
  if (!m) {
    return null;
  }
  return {
    hasCaret: m[1] === "^",
    hasGreaterEquals: m[1] === ">=",
    majorBase: m[2] === "x" ? 0 : parseInt(m[2], 10),
    majorMustEqual: m[2] === "x" ? false : true,
    minorBase: m[4] === "x" ? 0 : parseInt(m[4], 10),
    minorMustEqual: m[4] === "x" ? false : true,
    patchBase: m[6] === "x" ? 0 : parseInt(m[6], 10),
    patchMustEqual: m[6] === "x" ? false : true,
    preRelease: m[8] || null
  };
}
function normalizeVersion(version) {
  if (!version) {
    return null;
  }
  const majorBase = version.majorBase;
  const majorMustEqual = version.majorMustEqual;
  const minorBase = version.minorBase;
  let minorMustEqual = version.minorMustEqual;
  const patchBase = version.patchBase;
  let patchMustEqual = version.patchMustEqual;
  if (version.hasCaret) {
    if (majorBase === 0) {
      patchMustEqual = false;
    } else {
      minorMustEqual = false;
      patchMustEqual = false;
    }
  }
  let notBefore = 0;
  if (version.preRelease) {
    const match = NOT_BEFORE_REGEXP.exec(version.preRelease);
    if (match) {
      const [, year, month, day] = match;
      notBefore = Date.UTC(Number(year), Number(month) - 1, Number(day));
    }
  }
  return {
    majorBase,
    majorMustEqual,
    minorBase,
    minorMustEqual,
    patchBase,
    patchMustEqual,
    isMinimum: version.hasGreaterEquals,
    notBefore
  };
}
function isValidVersion(_inputVersion, _inputDate, _desiredVersion) {
  let version;
  if (typeof _inputVersion === "string") {
    version = normalizeVersion(parseVersion(_inputVersion));
  } else {
    version = _inputVersion;
  }
  let productTs;
  if (_inputDate instanceof Date) {
    productTs = _inputDate.getTime();
  } else if (typeof _inputDate === "string") {
    productTs = new Date(_inputDate).getTime();
  }
  let desiredVersion;
  if (typeof _desiredVersion === "string") {
    desiredVersion = normalizeVersion(parseVersion(_desiredVersion));
  } else {
    desiredVersion = _desiredVersion;
  }
  if (!version || !desiredVersion) {
    return false;
  }
  const majorBase = version.majorBase;
  const minorBase = version.minorBase;
  const patchBase = version.patchBase;
  let desiredMajorBase = desiredVersion.majorBase;
  let desiredMinorBase = desiredVersion.minorBase;
  let desiredPatchBase = desiredVersion.patchBase;
  const desiredNotBefore = desiredVersion.notBefore;
  let majorMustEqual = desiredVersion.majorMustEqual;
  let minorMustEqual = desiredVersion.minorMustEqual;
  let patchMustEqual = desiredVersion.patchMustEqual;
  if (desiredVersion.isMinimum) {
    if (majorBase > desiredMajorBase) {
      return true;
    }
    if (majorBase < desiredMajorBase) {
      return false;
    }
    if (minorBase > desiredMinorBase) {
      return true;
    }
    if (minorBase < desiredMinorBase) {
      return false;
    }
    if (productTs && productTs < desiredNotBefore) {
      return false;
    }
    return patchBase >= desiredPatchBase;
  }
  if (majorBase === 1 && desiredMajorBase === 0 && (!majorMustEqual || !minorMustEqual || !patchMustEqual)) {
    desiredMajorBase = 1;
    desiredMinorBase = 0;
    desiredPatchBase = 0;
    majorMustEqual = true;
    minorMustEqual = false;
    patchMustEqual = false;
  }
  if (majorBase < desiredMajorBase) {
    return false;
  }
  if (majorBase > desiredMajorBase) {
    return !majorMustEqual;
  }
  if (minorBase < desiredMinorBase) {
    return false;
  }
  if (minorBase > desiredMinorBase) {
    return !minorMustEqual;
  }
  if (patchBase < desiredPatchBase) {
    return false;
  }
  if (patchBase > desiredPatchBase) {
    return !patchMustEqual;
  }
  if (productTs && productTs < desiredNotBefore) {
    return false;
  }
  return true;
}
function validateExtensionManifest(productVersion, productDate, extensionLocation, extensionManifest, extensionIsBuiltin, validateApiVersion) {
  const validations = [];
  if (typeof extensionManifest.publisher !== "undefined" && typeof extensionManifest.publisher !== "string") {
    validations.push([Severity.Error, nls.localize("extensionDescription.publisher", "property publisher must be of type `string`.")]);
    return validations;
  }
  if (typeof extensionManifest.name !== "string") {
    validations.push([Severity.Error, nls.localize("extensionDescription.name", "property `{0}` is mandatory and must be of type `string`", "name")]);
    return validations;
  }
  if (typeof extensionManifest.version !== "string") {
    validations.push([Severity.Error, nls.localize("extensionDescription.version", "property `{0}` is mandatory and must be of type `string`", "version")]);
    return validations;
  }
  if (!extensionManifest.engines) {
    validations.push([Severity.Error, nls.localize("extensionDescription.engines", "property `{0}` is mandatory and must be of type `object`", "engines")]);
    return validations;
  }
  if (typeof extensionManifest.engines.vscode !== "string") {
    validations.push([Severity.Error, nls.localize("extensionDescription.engines.vscode", "property `{0}` is mandatory and must be of type `string`", "engines.vscode")]);
    return validations;
  }
  if (typeof extensionManifest.extensionDependencies !== "undefined") {
    if (!isStringArray(extensionManifest.extensionDependencies)) {
      validations.push([Severity.Error, nls.localize("extensionDescription.extensionDependencies", "property `{0}` can be omitted or must be of type `string[]`", "extensionDependencies")]);
      return validations;
    }
  }
  if (typeof extensionManifest.activationEvents !== "undefined") {
    if (!isStringArray(extensionManifest.activationEvents)) {
      validations.push([Severity.Error, nls.localize("extensionDescription.activationEvents1", "property `{0}` can be omitted or must be of type `string[]`", "activationEvents")]);
      return validations;
    }
    if (typeof extensionManifest.main === "undefined" && typeof extensionManifest.browser === "undefined") {
      validations.push([Severity.Error, nls.localize("extensionDescription.activationEvents2", "property `{0}` should be omitted if the extension doesn't have a `{1}` or `{2}` property.", "activationEvents", "main", "browser")]);
      return validations;
    }
  }
  if (typeof extensionManifest.extensionKind !== "undefined") {
    if (typeof extensionManifest.main === "undefined") {
      validations.push([Severity.Warning, nls.localize("extensionDescription.extensionKind", "property `{0}` can be defined only if property `main` is also defined.", "extensionKind")]);
    }
  }
  if (typeof extensionManifest.main !== "undefined") {
    if (typeof extensionManifest.main !== "string") {
      validations.push([Severity.Error, nls.localize("extensionDescription.main1", "property `{0}` can be omitted or must be of type `string`", "main")]);
      return validations;
    } else {
      const mainLocation = joinPath(extensionLocation, extensionManifest.main);
      if (!isEqualOrParent(mainLocation, extensionLocation)) {
        validations.push([Severity.Warning, nls.localize("extensionDescription.main2", "Expected `main` ({0}) to be included inside extension's folder ({1}). This might make the extension non-portable.", mainLocation.path, extensionLocation.path)]);
      }
    }
  }
  if (typeof extensionManifest.browser !== "undefined") {
    if (typeof extensionManifest.browser !== "string") {
      validations.push([Severity.Error, nls.localize("extensionDescription.browser1", "property `{0}` can be omitted or must be of type `string`", "browser")]);
      return validations;
    } else {
      const browserLocation = joinPath(extensionLocation, extensionManifest.browser);
      if (!isEqualOrParent(browserLocation, extensionLocation)) {
        validations.push([Severity.Warning, nls.localize("extensionDescription.browser2", "Expected `browser` ({0}) to be included inside extension's folder ({1}). This might make the extension non-portable.", browserLocation.path, extensionLocation.path)]);
      }
    }
  }
  if (!semver.valid(extensionManifest.version)) {
    validations.push([Severity.Error, nls.localize("notSemver", "Extension version is not semver compatible.")]);
    return validations;
  }
  const notices = [];
  const validExtensionVersion = isValidExtensionVersion(productVersion, productDate, extensionManifest, extensionIsBuiltin, notices);
  if (!validExtensionVersion) {
    for (const notice of notices) {
      validations.push([Severity.Error, notice]);
    }
  }
  if (validateApiVersion && extensionManifest.enabledApiProposals?.length) {
    const incompatibleNotices = [];
    if (!areApiProposalsCompatible([...extensionManifest.enabledApiProposals], incompatibleNotices)) {
      for (const notice of incompatibleNotices) {
        validations.push([Severity.Error, notice]);
      }
    }
  }
  return validations;
}
function isValidExtensionVersion(productVersion, productDate, extensionManifest, extensionIsBuiltin, notices) {
  if (extensionIsBuiltin || typeof extensionManifest.main === "undefined" && typeof extensionManifest.browser === "undefined") {
    return true;
  }
  return isVersionValid(productVersion, productDate, extensionManifest.engines.vscode, notices);
}
function isEngineValid(engine, version, date) {
  return engine === "*" || isVersionValid(version, date, engine);
}
function areApiProposalsCompatible(apiProposals, arg1) {
  if (apiProposals.length === 0) {
    return true;
  }
  const notices = Array.isArray(arg1) ? arg1 : void 0;
  const productApiProposals = (notices ? void 0 : arg1) ?? allApiProposals;
  const incompatibleProposals = [];
  const parsedProposals = parseApiProposals(apiProposals);
  for (const { proposalName, version } of parsedProposals) {
    if (!version) {
      continue;
    }
    const existingProposal = productApiProposals[proposalName];
    if (existingProposal?.version !== version) {
      incompatibleProposals.push(proposalName);
    }
  }
  if (incompatibleProposals.length) {
    if (notices) {
      if (incompatibleProposals.length === 1) {
        notices.push(nls.localize("apiProposalMismatch1", "This extension is using the API proposal '{0}' that is not compatible with the current version of VS Code.", incompatibleProposals[0]));
      } else {
        notices.push(nls.localize(
          "apiProposalMismatch2",
          "This extension is using the API proposals {0} and '{1}' that are not compatible with the current version of VS Code.",
          incompatibleProposals.slice(0, incompatibleProposals.length - 1).map((p) => `'${p}'`).join(", "),
          incompatibleProposals[incompatibleProposals.length - 1]
        ));
      }
    }
    return false;
  }
  return true;
}
function isVersionValid(currentVersion, date, requestedVersion, notices = []) {
  const desiredVersion = normalizeVersion(parseVersion(requestedVersion));
  if (!desiredVersion) {
    notices.push(nls.localize("versionSyntax", "Could not parse `engines.vscode` value {0}. Please use, for example: ^1.22.0, ^1.22.x, etc.", requestedVersion));
    return false;
  }
  if (desiredVersion.majorBase === 0) {
    if (!desiredVersion.majorMustEqual || !desiredVersion.minorMustEqual) {
      notices.push(nls.localize("versionSpecificity1", "Version specified in `engines.vscode` ({0}) is not specific enough. For vscode versions before 1.0.0, please define at a minimum the major and minor desired version. E.g. ^0.10.0, 0.10.x, 0.11.0, etc.", requestedVersion));
      return false;
    }
  } else {
    if (!desiredVersion.majorMustEqual) {
      notices.push(nls.localize("versionSpecificity2", "Version specified in `engines.vscode` ({0}) is not specific enough. For vscode versions after 1.0.0, please define at a minimum the major desired version. E.g. ^1.10.0, 1.10.x, 1.x.x, 2.x.x, etc.", requestedVersion));
      return false;
    }
  }
  if (!isValidVersion(currentVersion, date, desiredVersion)) {
    notices.push(nls.localize("versionMismatch", "Extension is not compatible with Code {0}. Extension requires: {1}.", currentVersion, requestedVersion));
    return false;
  }
  return true;
}
function isStringArray(arr) {
  if (!Array.isArray(arr)) {
    return false;
  }
  for (let i = 0, len = arr.length; i < len; i++) {
    if (typeof arr[i] !== "string") {
      return false;
    }
  }
  return true;
}
export {
  areApiProposalsCompatible,
  isEngineValid,
  isValidExtensionVersion,
  isValidVersion,
  isValidVersionStr,
  normalizeVersion,
  parseVersion,
  validateExtensionManifest
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25WYWxpZGF0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc0VxdWFsT3JQYXJlbnQsIGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBzZW12ZXIgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc2VtdmVyL3NlbXZlci5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuaWZlc3QsIHBhcnNlQXBpUHJvcG9zYWxzIH0gZnJvbSAnLi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGFsbEFwaVByb3Bvc2FscyB9IGZyb20gJy4vZXh0ZW5zaW9uc0FwaVByb3Bvc2Fscy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBhcnNlZFZlcnNpb24ge1xuXHRoYXNDYXJldDogYm9vbGVhbjtcblx0aGFzR3JlYXRlckVxdWFsczogYm9vbGVhbjtcblx0bWFqb3JCYXNlOiBudW1iZXI7XG5cdG1ham9yTXVzdEVxdWFsOiBib29sZWFuO1xuXHRtaW5vckJhc2U6IG51bWJlcjtcblx0bWlub3JNdXN0RXF1YWw6IGJvb2xlYW47XG5cdHBhdGNoQmFzZTogbnVtYmVyO1xuXHRwYXRjaE11c3RFcXVhbDogYm9vbGVhbjtcblx0cHJlUmVsZWFzZTogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm9ybWFsaXplZFZlcnNpb24ge1xuXHRtYWpvckJhc2U6IG51bWJlcjtcblx0bWFqb3JNdXN0RXF1YWw6IGJvb2xlYW47XG5cdG1pbm9yQmFzZTogbnVtYmVyO1xuXHRtaW5vck11c3RFcXVhbDogYm9vbGVhbjtcblx0cGF0Y2hCYXNlOiBudW1iZXI7XG5cdHBhdGNoTXVzdEVxdWFsOiBib29sZWFuO1xuXHRub3RCZWZvcmU6IG51bWJlcjsgLyogbWlsbGlzZWNvbmRzIHRpbWVzdGFtcCwgb3IgMCAqL1xuXHRpc01pbmltdW06IGJvb2xlYW47XG59XG5cbmNvbnN0IFZFUlNJT05fUkVHRVhQID0gL14oXFxefD49KT8oKFxcZCspfHgpXFwuKChcXGQrKXx4KVxcLigoXFxkKyl8eCkoXFwtLiopPyQvO1xuY29uc3QgTk9UX0JFRk9SRV9SRUdFWFAgPSAvXi0oXFxkezR9KShcXGR7Mn0pKFxcZHsyfSkkLztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRWZXJzaW9uU3RyKHZlcnNpb246IHN0cmluZyk6IGJvb2xlYW4ge1xuXHR2ZXJzaW9uID0gdmVyc2lvbi50cmltKCk7XG5cdHJldHVybiAodmVyc2lvbiA9PT0gJyonIHx8IFZFUlNJT05fUkVHRVhQLnRlc3QodmVyc2lvbikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VWZXJzaW9uKHZlcnNpb246IHN0cmluZyk6IElQYXJzZWRWZXJzaW9uIHwgbnVsbCB7XG5cdGlmICghaXNWYWxpZFZlcnNpb25TdHIodmVyc2lvbikpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHZlcnNpb24gPSB2ZXJzaW9uLnRyaW0oKTtcblxuXHRpZiAodmVyc2lvbiA9PT0gJyonKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhhc0NhcmV0OiBmYWxzZSxcblx0XHRcdGhhc0dyZWF0ZXJFcXVhbHM6IGZhbHNlLFxuXHRcdFx0bWFqb3JCYXNlOiAwLFxuXHRcdFx0bWFqb3JNdXN0RXF1YWw6IGZhbHNlLFxuXHRcdFx0bWlub3JCYXNlOiAwLFxuXHRcdFx0bWlub3JNdXN0RXF1YWw6IGZhbHNlLFxuXHRcdFx0cGF0Y2hCYXNlOiAwLFxuXHRcdFx0cGF0Y2hNdXN0RXF1YWw6IGZhbHNlLFxuXHRcdFx0cHJlUmVsZWFzZTogbnVsbFxuXHRcdH07XG5cdH1cblxuXHRjb25zdCBtID0gdmVyc2lvbi5tYXRjaChWRVJTSU9OX1JFR0VYUCk7XG5cdGlmICghbSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cdHJldHVybiB7XG5cdFx0aGFzQ2FyZXQ6IG1bMV0gPT09ICdeJyxcblx0XHRoYXNHcmVhdGVyRXF1YWxzOiBtWzFdID09PSAnPj0nLFxuXHRcdG1ham9yQmFzZTogbVsyXSA9PT0gJ3gnID8gMCA6IHBhcnNlSW50KG1bMl0sIDEwKSxcblx0XHRtYWpvck11c3RFcXVhbDogKG1bMl0gPT09ICd4JyA/IGZhbHNlIDogdHJ1ZSksXG5cdFx0bWlub3JCYXNlOiBtWzRdID09PSAneCcgPyAwIDogcGFyc2VJbnQobVs0XSwgMTApLFxuXHRcdG1pbm9yTXVzdEVxdWFsOiAobVs0XSA9PT0gJ3gnID8gZmFsc2UgOiB0cnVlKSxcblx0XHRwYXRjaEJhc2U6IG1bNl0gPT09ICd4JyA/IDAgOiBwYXJzZUludChtWzZdLCAxMCksXG5cdFx0cGF0Y2hNdXN0RXF1YWw6IChtWzZdID09PSAneCcgPyBmYWxzZSA6IHRydWUpLFxuXHRcdHByZVJlbGVhc2U6IG1bOF0gfHwgbnVsbFxuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplVmVyc2lvbih2ZXJzaW9uOiBJUGFyc2VkVmVyc2lvbiB8IG51bGwpOiBJTm9ybWFsaXplZFZlcnNpb24gfCBudWxsIHtcblx0aWYgKCF2ZXJzaW9uKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBtYWpvckJhc2UgPSB2ZXJzaW9uLm1ham9yQmFzZTtcblx0Y29uc3QgbWFqb3JNdXN0RXF1YWwgPSB2ZXJzaW9uLm1ham9yTXVzdEVxdWFsO1xuXHRjb25zdCBtaW5vckJhc2UgPSB2ZXJzaW9uLm1pbm9yQmFzZTtcblx0bGV0IG1pbm9yTXVzdEVxdWFsID0gdmVyc2lvbi5taW5vck11c3RFcXVhbDtcblx0Y29uc3QgcGF0Y2hCYXNlID0gdmVyc2lvbi5wYXRjaEJhc2U7XG5cdGxldCBwYXRjaE11c3RFcXVhbCA9IHZlcnNpb24ucGF0Y2hNdXN0RXF1YWw7XG5cblx0aWYgKHZlcnNpb24uaGFzQ2FyZXQpIHtcblx0XHRpZiAobWFqb3JCYXNlID09PSAwKSB7XG5cdFx0XHRwYXRjaE11c3RFcXVhbCA9IGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtaW5vck11c3RFcXVhbCA9IGZhbHNlO1xuXHRcdFx0cGF0Y2hNdXN0RXF1YWwgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRsZXQgbm90QmVmb3JlID0gMDtcblx0aWYgKHZlcnNpb24ucHJlUmVsZWFzZSkge1xuXHRcdGNvbnN0IG1hdGNoID0gTk9UX0JFRk9SRV9SRUdFWFAuZXhlYyh2ZXJzaW9uLnByZVJlbGVhc2UpO1xuXHRcdGlmIChtYXRjaCkge1xuXHRcdFx0Y29uc3QgWywgeWVhciwgbW9udGgsIGRheV0gPSBtYXRjaDtcblx0XHRcdG5vdEJlZm9yZSA9IERhdGUuVVRDKE51bWJlcih5ZWFyKSwgTnVtYmVyKG1vbnRoKSAtIDEsIE51bWJlcihkYXkpKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdG1ham9yQmFzZTogbWFqb3JCYXNlLFxuXHRcdG1ham9yTXVzdEVxdWFsOiBtYWpvck11c3RFcXVhbCxcblx0XHRtaW5vckJhc2U6IG1pbm9yQmFzZSxcblx0XHRtaW5vck11c3RFcXVhbDogbWlub3JNdXN0RXF1YWwsXG5cdFx0cGF0Y2hCYXNlOiBwYXRjaEJhc2UsXG5cdFx0cGF0Y2hNdXN0RXF1YWw6IHBhdGNoTXVzdEVxdWFsLFxuXHRcdGlzTWluaW11bTogdmVyc2lvbi5oYXNHcmVhdGVyRXF1YWxzLFxuXHRcdG5vdEJlZm9yZSxcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRWZXJzaW9uKF9pbnB1dFZlcnNpb246IHN0cmluZyB8IElOb3JtYWxpemVkVmVyc2lvbiwgX2lucHV0RGF0ZTogUHJvZHVjdERhdGUsIF9kZXNpcmVkVmVyc2lvbjogc3RyaW5nIHwgSU5vcm1hbGl6ZWRWZXJzaW9uKTogYm9vbGVhbiB7XG5cdGxldCB2ZXJzaW9uOiBJTm9ybWFsaXplZFZlcnNpb24gfCBudWxsO1xuXHRpZiAodHlwZW9mIF9pbnB1dFZlcnNpb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0dmVyc2lvbiA9IG5vcm1hbGl6ZVZlcnNpb24ocGFyc2VWZXJzaW9uKF9pbnB1dFZlcnNpb24pKTtcblx0fSBlbHNlIHtcblx0XHR2ZXJzaW9uID0gX2lucHV0VmVyc2lvbjtcblx0fVxuXG5cdGxldCBwcm9kdWN0VHM6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0aWYgKF9pbnB1dERhdGUgaW5zdGFuY2VvZiBEYXRlKSB7XG5cdFx0cHJvZHVjdFRzID0gX2lucHV0RGF0ZS5nZXRUaW1lKCk7XG5cdH0gZWxzZSBpZiAodHlwZW9mIF9pbnB1dERhdGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0cHJvZHVjdFRzID0gbmV3IERhdGUoX2lucHV0RGF0ZSkuZ2V0VGltZSgpO1xuXHR9XG5cblx0bGV0IGRlc2lyZWRWZXJzaW9uOiBJTm9ybWFsaXplZFZlcnNpb24gfCBudWxsO1xuXHRpZiAodHlwZW9mIF9kZXNpcmVkVmVyc2lvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRkZXNpcmVkVmVyc2lvbiA9IG5vcm1hbGl6ZVZlcnNpb24ocGFyc2VWZXJzaW9uKF9kZXNpcmVkVmVyc2lvbikpO1xuXHR9IGVsc2Uge1xuXHRcdGRlc2lyZWRWZXJzaW9uID0gX2Rlc2lyZWRWZXJzaW9uO1xuXHR9XG5cblx0aWYgKCF2ZXJzaW9uIHx8ICFkZXNpcmVkVmVyc2lvbikge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGNvbnN0IG1ham9yQmFzZSA9IHZlcnNpb24ubWFqb3JCYXNlO1xuXHRjb25zdCBtaW5vckJhc2UgPSB2ZXJzaW9uLm1pbm9yQmFzZTtcblx0Y29uc3QgcGF0Y2hCYXNlID0gdmVyc2lvbi5wYXRjaEJhc2U7XG5cblx0bGV0IGRlc2lyZWRNYWpvckJhc2UgPSBkZXNpcmVkVmVyc2lvbi5tYWpvckJhc2U7XG5cdGxldCBkZXNpcmVkTWlub3JCYXNlID0gZGVzaXJlZFZlcnNpb24ubWlub3JCYXNlO1xuXHRsZXQgZGVzaXJlZFBhdGNoQmFzZSA9IGRlc2lyZWRWZXJzaW9uLnBhdGNoQmFzZTtcblx0Y29uc3QgZGVzaXJlZE5vdEJlZm9yZSA9IGRlc2lyZWRWZXJzaW9uLm5vdEJlZm9yZTtcblxuXHRsZXQgbWFqb3JNdXN0RXF1YWwgPSBkZXNpcmVkVmVyc2lvbi5tYWpvck11c3RFcXVhbDtcblx0bGV0IG1pbm9yTXVzdEVxdWFsID0gZGVzaXJlZFZlcnNpb24ubWlub3JNdXN0RXF1YWw7XG5cdGxldCBwYXRjaE11c3RFcXVhbCA9IGRlc2lyZWRWZXJzaW9uLnBhdGNoTXVzdEVxdWFsO1xuXG5cdGlmIChkZXNpcmVkVmVyc2lvbi5pc01pbmltdW0pIHtcblx0XHRpZiAobWFqb3JCYXNlID4gZGVzaXJlZE1ham9yQmFzZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKG1ham9yQmFzZSA8IGRlc2lyZWRNYWpvckJhc2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAobWlub3JCYXNlID4gZGVzaXJlZE1pbm9yQmFzZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKG1pbm9yQmFzZSA8IGRlc2lyZWRNaW5vckJhc2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAocHJvZHVjdFRzICYmIHByb2R1Y3RUcyA8IGRlc2lyZWROb3RCZWZvcmUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGF0Y2hCYXNlID49IGRlc2lyZWRQYXRjaEJhc2U7XG5cdH1cblxuXHQvLyBBbnl0aGluZyA8IDEuMC4wIGlzIGNvbXBhdGlibGUgd2l0aCA+PSAxLjAuMCwgZXhjZXB0IGV4YWN0IG1hdGNoZXNcblx0aWYgKG1ham9yQmFzZSA9PT0gMSAmJiBkZXNpcmVkTWFqb3JCYXNlID09PSAwICYmICghbWFqb3JNdXN0RXF1YWwgfHwgIW1pbm9yTXVzdEVxdWFsIHx8ICFwYXRjaE11c3RFcXVhbCkpIHtcblx0XHRkZXNpcmVkTWFqb3JCYXNlID0gMTtcblx0XHRkZXNpcmVkTWlub3JCYXNlID0gMDtcblx0XHRkZXNpcmVkUGF0Y2hCYXNlID0gMDtcblx0XHRtYWpvck11c3RFcXVhbCA9IHRydWU7XG5cdFx0bWlub3JNdXN0RXF1YWwgPSBmYWxzZTtcblx0XHRwYXRjaE11c3RFcXVhbCA9IGZhbHNlO1xuXHR9XG5cblx0aWYgKG1ham9yQmFzZSA8IGRlc2lyZWRNYWpvckJhc2UpIHtcblx0XHQvLyBzbWFsbGVyIG1ham9yIHZlcnNpb25cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAobWFqb3JCYXNlID4gZGVzaXJlZE1ham9yQmFzZSkge1xuXHRcdC8vIGhpZ2hlciBtYWpvciB2ZXJzaW9uXG5cdFx0cmV0dXJuICghbWFqb3JNdXN0RXF1YWwpO1xuXHR9XG5cblx0Ly8gYXQgdGhpcyBwb2ludCwgbWFqb3JCYXNlIGFyZSBlcXVhbFxuXG5cdGlmIChtaW5vckJhc2UgPCBkZXNpcmVkTWlub3JCYXNlKSB7XG5cdFx0Ly8gc21hbGxlciBtaW5vciB2ZXJzaW9uXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKG1pbm9yQmFzZSA+IGRlc2lyZWRNaW5vckJhc2UpIHtcblx0XHQvLyBoaWdoZXIgbWlub3IgdmVyc2lvblxuXHRcdHJldHVybiAoIW1pbm9yTXVzdEVxdWFsKTtcblx0fVxuXG5cdC8vIGF0IHRoaXMgcG9pbnQsIG1pbm9yQmFzZSBhcmUgZXF1YWxcblxuXHRpZiAocGF0Y2hCYXNlIDwgZGVzaXJlZFBhdGNoQmFzZSkge1xuXHRcdC8vIHNtYWxsZXIgcGF0Y2ggdmVyc2lvblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGlmIChwYXRjaEJhc2UgPiBkZXNpcmVkUGF0Y2hCYXNlKSB7XG5cdFx0Ly8gaGlnaGVyIHBhdGNoIHZlcnNpb25cblx0XHRyZXR1cm4gKCFwYXRjaE11c3RFcXVhbCk7XG5cdH1cblxuXHQvLyBhdCB0aGlzIHBvaW50LCBwYXRjaEJhc2UgYXJlIGVxdWFsXG5cblx0aWYgKHByb2R1Y3RUcyAmJiBwcm9kdWN0VHMgPCBkZXNpcmVkTm90QmVmb3JlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbnR5cGUgUHJvZHVjdERhdGUgPSBzdHJpbmcgfCBEYXRlIHwgdW5kZWZpbmVkO1xuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVFeHRlbnNpb25NYW5pZmVzdChwcm9kdWN0VmVyc2lvbjogc3RyaW5nLCBwcm9kdWN0RGF0ZTogUHJvZHVjdERhdGUsIGV4dGVuc2lvbkxvY2F0aW9uOiBVUkksIGV4dGVuc2lvbk1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QsIGV4dGVuc2lvbklzQnVpbHRpbjogYm9vbGVhbiwgdmFsaWRhdGVBcGlWZXJzaW9uOiBib29sZWFuKTogcmVhZG9ubHkgW1NldmVyaXR5LCBzdHJpbmddW10ge1xuXHRjb25zdCB2YWxpZGF0aW9uczogW1NldmVyaXR5LCBzdHJpbmddW10gPSBbXTtcblx0aWYgKHR5cGVvZiBleHRlbnNpb25NYW5pZmVzdC5wdWJsaXNoZXIgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBleHRlbnNpb25NYW5pZmVzdC5wdWJsaXNoZXIgIT09ICdzdHJpbmcnKSB7XG5cdFx0dmFsaWRhdGlvbnMucHVzaChbU2V2ZXJpdHkuRXJyb3IsIG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uRGVzY3JpcHRpb24ucHVibGlzaGVyJywgXCJwcm9wZXJ0eSBwdWJsaXNoZXIgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgLlwiKV0pO1xuXHRcdHJldHVybiB2YWxpZGF0aW9ucztcblx0fVxuXHRpZiAodHlwZW9mIGV4dGVuc2lvbk1hbmlmZXN0Lm5hbWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0dmFsaWRhdGlvbnMucHVzaChbU2V2ZXJpdHkuRXJyb3IsIG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uRGVzY3JpcHRpb24ubmFtZScsIFwicHJvcGVydHkgYHswfWAgaXMgbWFuZGF0b3J5IGFuZCBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ25hbWUnKV0pO1xuXHRcdHJldHVybiB2YWxpZGF0aW9ucztcblx0fVxuXHRpZiAodHlwZW9mIGV4dGVuc2lvbk1hbmlmZXN0LnZlcnNpb24gIT09ICdzdHJpbmcnKSB7XG5cdFx0dmFsaWRhdGlvbnMucHVzaChbU2V2ZXJpdHkuRXJyb3IsIG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uRGVzY3JpcHRpb24udmVyc2lvbicsIFwicHJvcGVydHkgYHswfWAgaXMgbWFuZGF0b3J5IGFuZCBtdXN0IGJlIG9mIHR5cGUgYHN0cmluZ2BcIiwgJ3ZlcnNpb24nKV0pO1xuXHRcdHJldHVybiB2YWxpZGF0aW9ucztcblx0fVxuXHRpZiAoIWV4dGVuc2lvbk1hbmlmZXN0LmVuZ2luZXMpIHtcblx0XHR2YWxpZGF0aW9ucy5wdXNoKFtTZXZlcml0eS5FcnJvciwgbmxzLmxvY2FsaXplKCdleHRlbnNpb25EZXNjcmlwdGlvbi5lbmdpbmVzJywgXCJwcm9wZXJ0eSBgezB9YCBpcyBtYW5kYXRvcnkgYW5kIG11c3QgYmUgb2YgdHlwZSBgb2JqZWN0YFwiLCAnZW5naW5lcycpXSk7XG5cdFx0cmV0dXJuIHZhbGlkYXRpb25zO1xuXHR9XG5cdGlmICh0eXBlb2YgZXh0ZW5zaW9uTWFuaWZlc3QuZW5naW5lcy52c2NvZGUgIT09ICdzdHJpbmcnKSB7XG5cdFx0dmFsaWRhdGlvbnMucHVzaChbU2V2ZXJpdHkuRXJyb3IsIG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uRGVzY3JpcHRpb24uZW5naW5lcy52c2NvZGUnLCBcInByb3BlcnR5IGB7MH1gIGlzIG1hbmRhdG9yeSBhbmQgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICdlbmdpbmVzLnZzY29kZScpXSk7XG5cdFx0cmV0dXJuIHZhbGlkYXRpb25zO1xuXHR9XG5cdGlmICh0eXBlb2YgZXh0ZW5zaW9uTWFuaWZlc3QuZXh0ZW5zaW9uRGVwZW5kZW5jaWVzICE9PSAndW5kZWZpbmVkJykge1xuXHRcdGlmICghaXNTdHJpbmdBcnJheShleHRlbnNpb25NYW5pZmVzdC5leHRlbnNpb25EZXBlbmRlbmNpZXMpKSB7XG5cdFx0XHR2YWxpZGF0aW9ucy5wdXNoKFtTZXZlcml0eS5FcnJvciwgbmxzLmxvY2FsaXplKCdleHRlbnNpb25EZXNjcmlwdGlvbi5leHRlbnNpb25EZXBlbmRlbmNpZXMnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nW11gXCIsICdleHRlbnNpb25EZXBlbmRlbmNpZXMnKV0pO1xuXHRcdFx0cmV0dXJuIHZhbGlkYXRpb25zO1xuXHRcdH1cblx0fVxuXHRpZiAodHlwZW9mIGV4dGVuc2lvbk1hbmlmZXN0LmFjdGl2YXRpb25FdmVudHMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0aWYgKCFpc1N0cmluZ0FycmF5KGV4dGVuc2lvbk1hbmlmZXN0LmFjdGl2YXRpb25FdmVudHMpKSB7XG5cdFx0XHR2YWxpZGF0aW9ucy5wdXNoKFtTZXZlcml0eS5FcnJvciwgbmxzLmxvY2FsaXplKCdleHRlbnNpb25EZXNjcmlwdGlvbi5hY3RpdmF0aW9uRXZlbnRzMScsIFwicHJvcGVydHkgYHswfWAgY2FuIGJlIG9taXR0ZWQgb3IgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdbXWBcIiwgJ2FjdGl2YXRpb25FdmVudHMnKV0pO1xuXHRcdFx0cmV0dXJuIHZhbGlkYXRpb25zO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGV4dGVuc2lvbk1hbmlmZXN0Lm1haW4gPT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBleHRlbnNpb25NYW5pZmVzdC5icm93c2VyID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0dmFsaWRhdGlvbnMucHVzaChbU2V2ZXJpdHkuRXJyb3IsIG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uRGVzY3JpcHRpb24uYWN0aXZhdGlvbkV2ZW50czInLCBcInByb3BlcnR5IGB7MH1gIHNob3VsZCBiZSBvbWl0dGVkIGlmIHRoZSBleHRlbnNpb24gZG9lc24ndCBoYXZlIGEgYHsxfWAgb3IgYHsyfWAgcHJvcGVydHkuXCIsICdhY3RpdmF0aW9uRXZlbnRzJywgJ21haW4nLCAnYnJvd3NlcicpXSk7XG5cdFx0XHRyZXR1cm4gdmFsaWRhdGlvbnM7XG5cdFx0fVxuXHR9XG5cdGlmICh0eXBlb2YgZXh0ZW5zaW9uTWFuaWZlc3QuZXh0ZW5zaW9uS2luZCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRpZiAodHlwZW9mIGV4dGVuc2lvbk1hbmlmZXN0Lm1haW4gPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR2YWxpZGF0aW9ucy5wdXNoKFtTZXZlcml0eS5XYXJuaW5nLCBubHMubG9jYWxpemUoJ2V4dGVuc2lvbkRlc2NyaXB0aW9uLmV4dGVuc2lvbktpbmQnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBkZWZpbmVkIG9ubHkgaWYgcHJvcGVydHkgYG1haW5gIGlzIGFsc28gZGVmaW5lZC5cIiwgJ2V4dGVuc2lvbktpbmQnKV0pO1xuXHRcdFx0Ly8gbm90IGEgZmFpbHVyZSBjYXNlXG5cdFx0fVxuXHR9XG5cdGlmICh0eXBlb2YgZXh0ZW5zaW9uTWFuaWZlc3QubWFpbiAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRpZiAodHlwZW9mIGV4dGVuc2lvbk1hbmlmZXN0Lm1haW4gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHR2YWxpZGF0aW9ucy5wdXNoKFtTZXZlcml0eS5FcnJvciwgbmxzLmxvY2FsaXplKCdleHRlbnNpb25EZXNjcmlwdGlvbi5tYWluMScsIFwicHJvcGVydHkgYHswfWAgY2FuIGJlIG9taXR0ZWQgb3IgbXVzdCBiZSBvZiB0eXBlIGBzdHJpbmdgXCIsICdtYWluJyldKTtcblx0XHRcdHJldHVybiB2YWxpZGF0aW9ucztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbWFpbkxvY2F0aW9uID0gam9pblBhdGgoZXh0ZW5zaW9uTG9jYXRpb24sIGV4dGVuc2lvbk1hbmlmZXN0Lm1haW4pO1xuXHRcdFx0aWYgKCFpc0VxdWFsT3JQYXJlbnQobWFpbkxvY2F0aW9uLCBleHRlbnNpb25Mb2NhdGlvbikpIHtcblx0XHRcdFx0dmFsaWRhdGlvbnMucHVzaChbU2V2ZXJpdHkuV2FybmluZywgbmxzLmxvY2FsaXplKCdleHRlbnNpb25EZXNjcmlwdGlvbi5tYWluMicsIFwiRXhwZWN0ZWQgYG1haW5gICh7MH0pIHRvIGJlIGluY2x1ZGVkIGluc2lkZSBleHRlbnNpb24ncyBmb2xkZXIgKHsxfSkuIFRoaXMgbWlnaHQgbWFrZSB0aGUgZXh0ZW5zaW9uIG5vbi1wb3J0YWJsZS5cIiwgbWFpbkxvY2F0aW9uLnBhdGgsIGV4dGVuc2lvbkxvY2F0aW9uLnBhdGgpXSk7XG5cdFx0XHRcdC8vIG5vdCBhIGZhaWx1cmUgY2FzZVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRpZiAodHlwZW9mIGV4dGVuc2lvbk1hbmlmZXN0LmJyb3dzZXIgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0aWYgKHR5cGVvZiBleHRlbnNpb25NYW5pZmVzdC5icm93c2VyICE9PSAnc3RyaW5nJykge1xuXHRcdFx0dmFsaWRhdGlvbnMucHVzaChbU2V2ZXJpdHkuRXJyb3IsIG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uRGVzY3JpcHRpb24uYnJvd3NlcjEnLCBcInByb3BlcnR5IGB7MH1gIGNhbiBiZSBvbWl0dGVkIG9yIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYFwiLCAnYnJvd3NlcicpXSk7XG5cdFx0XHRyZXR1cm4gdmFsaWRhdGlvbnM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGJyb3dzZXJMb2NhdGlvbiA9IGpvaW5QYXRoKGV4dGVuc2lvbkxvY2F0aW9uLCBleHRlbnNpb25NYW5pZmVzdC5icm93c2VyKTtcblx0XHRcdGlmICghaXNFcXVhbE9yUGFyZW50KGJyb3dzZXJMb2NhdGlvbiwgZXh0ZW5zaW9uTG9jYXRpb24pKSB7XG5cdFx0XHRcdHZhbGlkYXRpb25zLnB1c2goW1NldmVyaXR5Lldhcm5pbmcsIG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uRGVzY3JpcHRpb24uYnJvd3NlcjInLCBcIkV4cGVjdGVkIGBicm93c2VyYCAoezB9KSB0byBiZSBpbmNsdWRlZCBpbnNpZGUgZXh0ZW5zaW9uJ3MgZm9sZGVyICh7MX0pLiBUaGlzIG1pZ2h0IG1ha2UgdGhlIGV4dGVuc2lvbiBub24tcG9ydGFibGUuXCIsIGJyb3dzZXJMb2NhdGlvbi5wYXRoLCBleHRlbnNpb25Mb2NhdGlvbi5wYXRoKV0pO1xuXHRcdFx0XHQvLyBub3QgYSBmYWlsdXJlIGNhc2Vcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAoIXNlbXZlci52YWxpZChleHRlbnNpb25NYW5pZmVzdC52ZXJzaW9uKSkge1xuXHRcdHZhbGlkYXRpb25zLnB1c2goW1NldmVyaXR5LkVycm9yLCBubHMubG9jYWxpemUoJ25vdFNlbXZlcicsIFwiRXh0ZW5zaW9uIHZlcnNpb24gaXMgbm90IHNlbXZlciBjb21wYXRpYmxlLlwiKV0pO1xuXHRcdHJldHVybiB2YWxpZGF0aW9ucztcblx0fVxuXG5cdGNvbnN0IG5vdGljZXM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0IHZhbGlkRXh0ZW5zaW9uVmVyc2lvbiA9IGlzVmFsaWRFeHRlbnNpb25WZXJzaW9uKHByb2R1Y3RWZXJzaW9uLCBwcm9kdWN0RGF0ZSwgZXh0ZW5zaW9uTWFuaWZlc3QsIGV4dGVuc2lvbklzQnVpbHRpbiwgbm90aWNlcyk7XG5cdGlmICghdmFsaWRFeHRlbnNpb25WZXJzaW9uKSB7XG5cdFx0Zm9yIChjb25zdCBub3RpY2Ugb2Ygbm90aWNlcykge1xuXHRcdFx0dmFsaWRhdGlvbnMucHVzaChbU2V2ZXJpdHkuRXJyb3IsIG5vdGljZV0pO1xuXHRcdH1cblx0fVxuXG5cdGlmICh2YWxpZGF0ZUFwaVZlcnNpb24gJiYgZXh0ZW5zaW9uTWFuaWZlc3QuZW5hYmxlZEFwaVByb3Bvc2Fscz8ubGVuZ3RoKSB7XG5cdFx0Y29uc3QgaW5jb21wYXRpYmxlTm90aWNlczogc3RyaW5nW10gPSBbXTtcblx0XHRpZiAoIWFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoWy4uLmV4dGVuc2lvbk1hbmlmZXN0LmVuYWJsZWRBcGlQcm9wb3NhbHNdLCBpbmNvbXBhdGlibGVOb3RpY2VzKSkge1xuXHRcdFx0Zm9yIChjb25zdCBub3RpY2Ugb2YgaW5jb21wYXRpYmxlTm90aWNlcykge1xuXHRcdFx0XHR2YWxpZGF0aW9ucy5wdXNoKFtTZXZlcml0eS5FcnJvciwgbm90aWNlXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHZhbGlkYXRpb25zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZEV4dGVuc2lvblZlcnNpb24ocHJvZHVjdFZlcnNpb246IHN0cmluZywgcHJvZHVjdERhdGU6IFByb2R1Y3REYXRlLCBleHRlbnNpb25NYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0LCBleHRlbnNpb25Jc0J1aWx0aW46IGJvb2xlYW4sIG5vdGljZXM6IHN0cmluZ1tdKTogYm9vbGVhbiB7XG5cblx0aWYgKGV4dGVuc2lvbklzQnVpbHRpbiB8fCAodHlwZW9mIGV4dGVuc2lvbk1hbmlmZXN0Lm1haW4gPT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBleHRlbnNpb25NYW5pZmVzdC5icm93c2VyID09PSAndW5kZWZpbmVkJykpIHtcblx0XHQvLyBObyB2ZXJzaW9uIGNoZWNrIGZvciBidWlsdGluIG9yIGRlY2xhcmF0aXZlIGV4dGVuc2lvbnNcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHJldHVybiBpc1ZlcnNpb25WYWxpZChwcm9kdWN0VmVyc2lvbiwgcHJvZHVjdERhdGUsIGV4dGVuc2lvbk1hbmlmZXN0LmVuZ2luZXMudnNjb2RlLCBub3RpY2VzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRW5naW5lVmFsaWQoZW5naW5lOiBzdHJpbmcsIHZlcnNpb246IHN0cmluZywgZGF0ZTogUHJvZHVjdERhdGUpOiBib29sZWFuIHtcblx0Ly8gVE9ET0Bqb2FvOiBkaXNjdXNzIHdpdGggYWxleCAnKicgZG9lc24ndCBzZWVtIHRvIGJlIGEgdmFsaWQgZW5naW5lIHZlcnNpb25cblx0cmV0dXJuIGVuZ2luZSA9PT0gJyonIHx8IGlzVmVyc2lvblZhbGlkKHZlcnNpb24sIGRhdGUsIGVuZ2luZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcmVBcGlQcm9wb3NhbHNDb21wYXRpYmxlKGFwaVByb3Bvc2Fsczogc3RyaW5nW10pOiBib29sZWFuO1xuZXhwb3J0IGZ1bmN0aW9uIGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoYXBpUHJvcG9zYWxzOiBzdHJpbmdbXSwgbm90aWNlczogc3RyaW5nW10pOiBib29sZWFuO1xuZXhwb3J0IGZ1bmN0aW9uIGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoYXBpUHJvcG9zYWxzOiBzdHJpbmdbXSwgcHJvZHVjdEFwaVByb3Bvc2FsczogUmVhZG9ubHk8eyBbcHJvcG9zYWxOYW1lOiBzdHJpbmddOiBSZWFkb25seTx7IHByb3Bvc2FsOiBzdHJpbmc7IHZlcnNpb24/OiBudW1iZXIgfT4gfT4pOiBib29sZWFuO1xuZXhwb3J0IGZ1bmN0aW9uIGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoYXBpUHJvcG9zYWxzOiBzdHJpbmdbXSwgYXJnMT86IGFueSk6IGJvb2xlYW4ge1xuXHRpZiAoYXBpUHJvcG9zYWxzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGNvbnN0IG5vdGljZXM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkID0gQXJyYXkuaXNBcnJheShhcmcxKSA/IGFyZzEgOiB1bmRlZmluZWQ7XG5cdGNvbnN0IHByb2R1Y3RBcGlQcm9wb3NhbHM6IFJlYWRvbmx5PHsgW3Byb3Bvc2FsTmFtZTogc3RyaW5nXTogUmVhZG9ubHk8eyBwcm9wb3NhbDogc3RyaW5nOyB2ZXJzaW9uPzogbnVtYmVyIH0+IH0+ID0gKG5vdGljZXMgPyB1bmRlZmluZWQgOiBhcmcxKSA/PyBhbGxBcGlQcm9wb3NhbHM7XG5cdGNvbnN0IGluY29tcGF0aWJsZVByb3Bvc2Fsczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgcGFyc2VkUHJvcG9zYWxzID0gcGFyc2VBcGlQcm9wb3NhbHMoYXBpUHJvcG9zYWxzKTtcblx0Zm9yIChjb25zdCB7IHByb3Bvc2FsTmFtZSwgdmVyc2lvbiB9IG9mIHBhcnNlZFByb3Bvc2Fscykge1xuXHRcdGlmICghdmVyc2lvbikge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXHRcdGNvbnN0IGV4aXN0aW5nUHJvcG9zYWwgPSBwcm9kdWN0QXBpUHJvcG9zYWxzW3Byb3Bvc2FsTmFtZV07XG5cdFx0aWYgKGV4aXN0aW5nUHJvcG9zYWw/LnZlcnNpb24gIT09IHZlcnNpb24pIHtcblx0XHRcdGluY29tcGF0aWJsZVByb3Bvc2Fscy5wdXNoKHByb3Bvc2FsTmFtZSk7XG5cdFx0fVxuXHR9XG5cdGlmIChpbmNvbXBhdGlibGVQcm9wb3NhbHMubGVuZ3RoKSB7XG5cdFx0aWYgKG5vdGljZXMpIHtcblx0XHRcdGlmIChpbmNvbXBhdGlibGVQcm9wb3NhbHMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdG5vdGljZXMucHVzaChubHMubG9jYWxpemUoJ2FwaVByb3Bvc2FsTWlzbWF0Y2gxJywgXCJUaGlzIGV4dGVuc2lvbiBpcyB1c2luZyB0aGUgQVBJIHByb3Bvc2FsICd7MH0nIHRoYXQgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIFZTIENvZGUuXCIsIGluY29tcGF0aWJsZVByb3Bvc2Fsc1swXSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm90aWNlcy5wdXNoKG5scy5sb2NhbGl6ZSgnYXBpUHJvcG9zYWxNaXNtYXRjaDInLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIHVzaW5nIHRoZSBBUEkgcHJvcG9zYWxzIHswfSBhbmQgJ3sxfScgdGhhdCBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIFZTIENvZGUuXCIsXG5cdFx0XHRcdFx0aW5jb21wYXRpYmxlUHJvcG9zYWxzLnNsaWNlKDAsIGluY29tcGF0aWJsZVByb3Bvc2Fscy5sZW5ndGggLSAxKS5tYXAocCA9PiBgJyR7cH0nYCkuam9pbignLCAnKSxcblx0XHRcdFx0XHRpbmNvbXBhdGlibGVQcm9wb3NhbHNbaW5jb21wYXRpYmxlUHJvcG9zYWxzLmxlbmd0aCAtIDFdKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gaXNWZXJzaW9uVmFsaWQoY3VycmVudFZlcnNpb246IHN0cmluZywgZGF0ZTogUHJvZHVjdERhdGUsIHJlcXVlc3RlZFZlcnNpb246IHN0cmluZywgbm90aWNlczogc3RyaW5nW10gPSBbXSk6IGJvb2xlYW4ge1xuXG5cdGNvbnN0IGRlc2lyZWRWZXJzaW9uID0gbm9ybWFsaXplVmVyc2lvbihwYXJzZVZlcnNpb24ocmVxdWVzdGVkVmVyc2lvbikpO1xuXHRpZiAoIWRlc2lyZWRWZXJzaW9uKSB7XG5cdFx0bm90aWNlcy5wdXNoKG5scy5sb2NhbGl6ZSgndmVyc2lvblN5bnRheCcsIFwiQ291bGQgbm90IHBhcnNlIGBlbmdpbmVzLnZzY29kZWAgdmFsdWUgezB9LiBQbGVhc2UgdXNlLCBmb3IgZXhhbXBsZTogXjEuMjIuMCwgXjEuMjIueCwgZXRjLlwiLCByZXF1ZXN0ZWRWZXJzaW9uKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Ly8gZW5mb3JjZSB0aGF0IGEgYnJlYWtpbmcgQVBJIHZlcnNpb24gaXMgc3BlY2lmaWVkLlxuXHQvLyBmb3IgMC5YLlksIHRoYXQgbWVhbnMgdXAgdG8gMC5YIG11c3QgYmUgc3BlY2lmaWVkXG5cdC8vIG90aGVyd2lzZSBmb3IgWi5YLlksIHRoYXQgbWVhbnMgWiBtdXN0IGJlIHNwZWNpZmllZFxuXHRpZiAoZGVzaXJlZFZlcnNpb24ubWFqb3JCYXNlID09PSAwKSB7XG5cdFx0Ly8gZm9yY2UgdGhhdCBtYWpvciBhbmQgbWlub3IgbXVzdCBiZSBzcGVjaWZpY1xuXHRcdGlmICghZGVzaXJlZFZlcnNpb24ubWFqb3JNdXN0RXF1YWwgfHwgIWRlc2lyZWRWZXJzaW9uLm1pbm9yTXVzdEVxdWFsKSB7XG5cdFx0XHRub3RpY2VzLnB1c2gobmxzLmxvY2FsaXplKCd2ZXJzaW9uU3BlY2lmaWNpdHkxJywgXCJWZXJzaW9uIHNwZWNpZmllZCBpbiBgZW5naW5lcy52c2NvZGVgICh7MH0pIGlzIG5vdCBzcGVjaWZpYyBlbm91Z2guIEZvciB2c2NvZGUgdmVyc2lvbnMgYmVmb3JlIDEuMC4wLCBwbGVhc2UgZGVmaW5lIGF0IGEgbWluaW11bSB0aGUgbWFqb3IgYW5kIG1pbm9yIGRlc2lyZWQgdmVyc2lvbi4gRS5nLiBeMC4xMC4wLCAwLjEwLngsIDAuMTEuMCwgZXRjLlwiLCByZXF1ZXN0ZWRWZXJzaW9uKSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdC8vIGZvcmNlIHRoYXQgbWFqb3IgbXVzdCBiZSBzcGVjaWZpY1xuXHRcdGlmICghZGVzaXJlZFZlcnNpb24ubWFqb3JNdXN0RXF1YWwpIHtcblx0XHRcdG5vdGljZXMucHVzaChubHMubG9jYWxpemUoJ3ZlcnNpb25TcGVjaWZpY2l0eTInLCBcIlZlcnNpb24gc3BlY2lmaWVkIGluIGBlbmdpbmVzLnZzY29kZWAgKHswfSkgaXMgbm90IHNwZWNpZmljIGVub3VnaC4gRm9yIHZzY29kZSB2ZXJzaW9ucyBhZnRlciAxLjAuMCwgcGxlYXNlIGRlZmluZSBhdCBhIG1pbmltdW0gdGhlIG1ham9yIGRlc2lyZWQgdmVyc2lvbi4gRS5nLiBeMS4xMC4wLCAxLjEwLngsIDEueC54LCAyLngueCwgZXRjLlwiLCByZXF1ZXN0ZWRWZXJzaW9uKSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFpc1ZhbGlkVmVyc2lvbihjdXJyZW50VmVyc2lvbiwgZGF0ZSwgZGVzaXJlZFZlcnNpb24pKSB7XG5cdFx0bm90aWNlcy5wdXNoKG5scy5sb2NhbGl6ZSgndmVyc2lvbk1pc21hdGNoJywgXCJFeHRlbnNpb24gaXMgbm90IGNvbXBhdGlibGUgd2l0aCBDb2RlIHswfS4gRXh0ZW5zaW9uIHJlcXVpcmVzOiB7MX0uXCIsIGN1cnJlbnRWZXJzaW9uLCByZXF1ZXN0ZWRWZXJzaW9uKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGlzU3RyaW5nQXJyYXkoYXJyOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuXHRpZiAoIUFycmF5LmlzQXJyYXkoYXJyKSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0aWYgKHR5cGVvZiBhcnJbaV0gIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB0cnVlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxpQkFBaUIsZ0JBQWdCO0FBQzFDLE9BQU8sY0FBYztBQUVy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
