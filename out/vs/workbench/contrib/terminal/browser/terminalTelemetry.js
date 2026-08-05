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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { basename } from "../../../../base/common/path.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ITerminalService } from "./terminal.js";
let TerminalTelemetryContribution = class extends Disposable {
  constructor(terminalService, _telemetryService) {
    super();
    this._telemetryService = _telemetryService;
    this._register(terminalService.onDidCreateInstance(async (instance) => {
      await instance.processReady;
      this._logCreateInstance(instance.shellLaunchConfig);
    }));
  }
  _logCreateInstance(shellLaunchConfig) {
    this._telemetryService.publicLog2("terminal/createInstance", {
      shellType: getSanitizedShellType(shellLaunchConfig),
      isReconnect: !!shellLaunchConfig.attachPersistentProcess,
      isCustomPtyImplementation: !!shellLaunchConfig.customPtyImplementation,
      isLoginShell: (typeof shellLaunchConfig.args === "string" ? shellLaunchConfig.args.split(" ") : shellLaunchConfig.args)?.some((arg) => arg === "-l" || arg === "--login") ?? false
    });
  }
};
TerminalTelemetryContribution.ID = "terminalTelemetry";
TerminalTelemetryContribution = __decorateClass([
  __decorateParam(0, ITerminalService),
  __decorateParam(1, ITelemetryService)
], TerminalTelemetryContribution);
var AllowedShellType = /* @__PURE__ */ ((AllowedShellType2) => {
  AllowedShellType2["Unknown"] = "unknown";
  AllowedShellType2["CommandPrompt"] = "cmd";
  AllowedShellType2["GitBash"] = "git-bash";
  AllowedShellType2["WindowsPowerShell"] = "windows-powershell";
  AllowedShellType2["Wsl"] = "wsl";
  AllowedShellType2["Bash"] = "bash";
  AllowedShellType2["Csh"] = "csh";
  AllowedShellType2["Dash"] = "dash";
  AllowedShellType2["Fish"] = "fish";
  AllowedShellType2["Ksh"] = "ksh";
  AllowedShellType2["Nushell"] = "nu";
  AllowedShellType2["Pwsh"] = "pwsh";
  AllowedShellType2["Sh"] = "sh";
  AllowedShellType2["Ssh"] = "ssh";
  AllowedShellType2["Tcsh"] = "tcsh";
  AllowedShellType2["Tmux"] = "tmux";
  AllowedShellType2["Zsh"] = "zsh";
  AllowedShellType2["Julia"] = "julia";
  AllowedShellType2["Node"] = "node";
  AllowedShellType2["Python"] = "python";
  AllowedShellType2["RubyIrb"] = "irb";
  return AllowedShellType2;
})(AllowedShellType || {});
const shellTypeExecutableAllowList = /* @__PURE__ */ new Set([
  "cmd" /* CommandPrompt */,
  "wsl" /* Wsl */,
  "bash" /* Bash */,
  "csh" /* Csh */,
  "dash" /* Dash */,
  "fish" /* Fish */,
  "ksh" /* Ksh */,
  "nu" /* Nushell */,
  "pwsh" /* Pwsh */,
  "sh" /* Sh */,
  "ssh" /* Ssh */,
  "tcsh" /* Tcsh */,
  "tmux" /* Tmux */,
  "zsh" /* Zsh */,
  "julia" /* Julia */,
  "node" /* Node */,
  "irb" /* RubyIrb */
]);
const shellTypeExecutableRegexAllowList = [
  { regex: /^python(?:\d+(?:\.\d+)?)?$/i, type: "python" /* Python */ }
];
const shellTypePathRegexAllowList = [
  // Git bash uses bash.exe, so look up based on the path
  { regex: /Git\\bin\\bash\.exe$/i, type: "git-bash" /* GitBash */ },
  // WindowsPowerShell should always be installed on this path, we cannot just look at the
  // executable name since powershell is the CLI on other platforms sometimes (eg. snap package)
  { regex: /WindowsPowerShell\\v1.0\\powershell.exe$/i, type: "windows-powershell" /* WindowsPowerShell */ },
  // WSL executables will represent some other shell in the end, but it's difficult to determine
  // when we log
  { regex: /Windows\\System32\\(?:bash|wsl)\.exe$/i, type: "wsl" /* Wsl */ }
];
function getSanitizedShellType(shellLaunchConfig) {
  if (!shellLaunchConfig.executable) {
    return "unknown" /* Unknown */;
  }
  const executableFile = basename(shellLaunchConfig.executable);
  const executableFileWithoutExt = executableFile.replace(/\.[^\.]+$/, "");
  for (const entry of shellTypePathRegexAllowList) {
    if (entry.regex.test(shellLaunchConfig.executable)) {
      return entry.type;
    }
  }
  for (const entry of shellTypeExecutableRegexAllowList) {
    if (entry.regex.test(executableFileWithoutExt)) {
      return entry.type;
    }
  }
  if (shellTypeExecutableAllowList.has(executableFileWithoutExt)) {
    return executableFileWithoutExt;
  }
  return "unknown" /* Unknown */;
}
export {
  TerminalTelemetryContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsVGVsZW1ldHJ5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgdHlwZSB7IElTaGVsbExhdW5jaENvbmZpZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgdHlwZSB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxTZXJ2aWNlIH0gZnJvbSAnLi90ZXJtaW5hbC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbFRlbGVtZXRyeUNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIElEID0gJ3Rlcm1pbmFsVGVsZW1ldHJ5JztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRlcm1pbmFsU2VydmljZSB0ZXJtaW5hbFNlcnZpY2U6IElUZXJtaW5hbFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXJtaW5hbFNlcnZpY2Uub25EaWRDcmVhdGVJbnN0YW5jZShhc3luYyBpbnN0YW5jZSA9PiB7XG5cdFx0XHQvLyBXYWl0IGZvciBwcm9jZXNzIHJlYWR5IHNvIHRoZSBzaGVsbCBsYXVuY2ggY29uZmlnIGlzIGZ1bGx5IHJlc29sdmVkXG5cdFx0XHRhd2FpdCBpbnN0YW5jZS5wcm9jZXNzUmVhZHk7XG5cdFx0XHR0aGlzLl9sb2dDcmVhdGVJbnN0YW5jZShpbnN0YW5jZS5zaGVsbExhdW5jaENvbmZpZyk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbG9nQ3JlYXRlSW5zdGFuY2Uoc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyk6IHZvaWQge1xuXHRcdHR5cGUgVGVybWluYWxDcmVhdGlvblRlbGVtZXRyeURhdGEgPSB7XG5cdFx0XHRzaGVsbFR5cGU6IHN0cmluZztcblx0XHRcdGlzUmVjb25uZWN0OiBib29sZWFuO1xuXHRcdFx0aXNDdXN0b21QdHlJbXBsZW1lbnRhdGlvbjogYm9vbGVhbjtcblx0XHRcdGlzTG9naW5TaGVsbDogYm9vbGVhbjtcblx0XHR9O1xuXHRcdHR5cGUgVGVybWluYWxDcmVhdGlvblRlbGVtZXRyeUNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICd0eXJpYXInO1xuXHRcdFx0Y29tbWVudDogJ1RyYWNrIGRldGFpbHMgYWJvdXQgdGVybWluYWwgY3JlYXRpb24sIHN1Y2ggYXMgdGhlIHNoZWxsIHR5cGUnO1xuXHRcdFx0c2hlbGxUeXBlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIHBhdGggb2YgdGhlIGZpbGUgYXMgYSBoYXNoLicgfTtcblx0XHRcdGlzUmVjb25uZWN0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgdGVybWluYWwgaXMgcmVjb25uZWN0aW5nIHRvIGFuIGV4aXN0aW5nIGluc3RhbmNlLicgfTtcblx0XHRcdGlzQ3VzdG9tUHR5SW1wbGVtZW50YXRpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIHRoZSB0ZXJtaW5hbCB3YXMgdXNpbmcgYSBjdXN0b20gUFRZIGltcGxlbWVudGF0aW9uLicgfTtcblx0XHRcdGlzTG9naW5TaGVsbDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIGFyZ3VtZW50cyBjb250YWluIC1sIG9yIC0tbG9naW4uJyB9O1xuXHRcdH07XG5cdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFRlcm1pbmFsQ3JlYXRpb25UZWxlbWV0cnlEYXRhLCBUZXJtaW5hbENyZWF0aW9uVGVsZW1ldHJ5Q2xhc3NpZmljYXRpb24+KCd0ZXJtaW5hbC9jcmVhdGVJbnN0YW5jZScsIHtcblx0XHRcdHNoZWxsVHlwZTogZ2V0U2FuaXRpemVkU2hlbGxUeXBlKHNoZWxsTGF1bmNoQ29uZmlnKSxcblx0XHRcdGlzUmVjb25uZWN0OiAhIXNoZWxsTGF1bmNoQ29uZmlnLmF0dGFjaFBlcnNpc3RlbnRQcm9jZXNzLFxuXHRcdFx0aXNDdXN0b21QdHlJbXBsZW1lbnRhdGlvbjogISFzaGVsbExhdW5jaENvbmZpZy5jdXN0b21QdHlJbXBsZW1lbnRhdGlvbixcblx0XHRcdGlzTG9naW5TaGVsbDogKHR5cGVvZiBzaGVsbExhdW5jaENvbmZpZy5hcmdzID09PSAnc3RyaW5nJyA/IHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3Muc3BsaXQoJyAnKSA6IHNoZWxsTGF1bmNoQ29uZmlnLmFyZ3MpPy5zb21lKGFyZyA9PiBhcmcgPT09ICctbCcgfHwgYXJnID09PSAnLS1sb2dpbicpID8/IGZhbHNlLFxuXHRcdH0pO1xuXHR9XG59XG5cbmNvbnN0IGVudW0gQWxsb3dlZFNoZWxsVHlwZSB7XG5cdFVua25vd24gPSAndW5rbm93bicsXG5cblx0Ly8gV2luZG93cyBvbmx5XG5cdENvbW1hbmRQcm9tcHQgPSAnY21kJyxcblx0R2l0QmFzaCA9ICdnaXQtYmFzaCcsXG5cdFdpbmRvd3NQb3dlclNoZWxsID0gJ3dpbmRvd3MtcG93ZXJzaGVsbCcsXG5cdFdzbCA9ICd3c2wnLFxuXG5cdC8vIEFsbCBwbGF0Zm9ybXNcblx0QmFzaCA9ICdiYXNoJyxcblx0Q3NoID0gJ2NzaCcsXG5cdERhc2ggPSAnZGFzaCcsXG5cdEZpc2ggPSAnZmlzaCcsXG5cdEtzaCA9ICdrc2gnLFxuXHROdXNoZWxsID0gJ251Jyxcblx0UHdzaCA9ICdwd3NoJyxcblx0U2ggPSAnc2gnLFxuXHRTc2ggPSAnc3NoJyxcblx0VGNzaCA9ICd0Y3NoJyxcblx0VG11eCA9ICd0bXV4Jyxcblx0WnNoID0gJ3pzaCcsXG5cblx0Ly8gTGFudWdhZ2UgUkVQTHNcblx0SnVsaWEgPSAnanVsaWEnLFxuXHROb2RlID0gJ25vZGUnLFxuXHRQeXRob24gPSAncHl0aG9uJyxcblx0UnVieUlyYiA9ICdpcmInLFxufVxuXG4vLyBUeXBlcyB0aGF0IG1hdGNoIHRoZSBleGVjdXRhYmxlIG5hbWUgZGlyZWN0bHlcbmNvbnN0IHNoZWxsVHlwZUV4ZWN1dGFibGVBbGxvd0xpc3Q6IFNldDxzdHJpbmc+ID0gbmV3IFNldChbXG5cdEFsbG93ZWRTaGVsbFR5cGUuQ29tbWFuZFByb21wdCxcblx0QWxsb3dlZFNoZWxsVHlwZS5Xc2wsXG5cblx0QWxsb3dlZFNoZWxsVHlwZS5CYXNoLFxuXHRBbGxvd2VkU2hlbGxUeXBlLkNzaCxcblx0QWxsb3dlZFNoZWxsVHlwZS5EYXNoLFxuXHRBbGxvd2VkU2hlbGxUeXBlLkZpc2gsXG5cdEFsbG93ZWRTaGVsbFR5cGUuS3NoLFxuXHRBbGxvd2VkU2hlbGxUeXBlLk51c2hlbGwsXG5cdEFsbG93ZWRTaGVsbFR5cGUuUHdzaCxcblx0QWxsb3dlZFNoZWxsVHlwZS5TaCxcblx0QWxsb3dlZFNoZWxsVHlwZS5Tc2gsXG5cdEFsbG93ZWRTaGVsbFR5cGUuVGNzaCxcblx0QWxsb3dlZFNoZWxsVHlwZS5UbXV4LFxuXHRBbGxvd2VkU2hlbGxUeXBlLlpzaCxcblxuXHRBbGxvd2VkU2hlbGxUeXBlLkp1bGlhLFxuXHRBbGxvd2VkU2hlbGxUeXBlLk5vZGUsXG5cdEFsbG93ZWRTaGVsbFR5cGUuUnVieUlyYixcbl0pIHNhdGlzZmllcyBTZXQ8QWxsb3dlZFNoZWxsVHlwZT47XG5cbi8vIER5bmFtaWMgZXhlY3V0YWJsZXMgdGhhdCBtYXAgdG8gYSBzaW5nbGUgdHlwZVxuY29uc3Qgc2hlbGxUeXBlRXhlY3V0YWJsZVJlZ2V4QWxsb3dMaXN0OiB7IHJlZ2V4OiBSZWdFeHA7IHR5cGU6IEFsbG93ZWRTaGVsbFR5cGUgfVtdID0gW1xuXHR7IHJlZ2V4OiAvXnB5dGhvbig/OlxcZCsoPzpcXC5cXGQrKT8pPyQvaSwgdHlwZTogQWxsb3dlZFNoZWxsVHlwZS5QeXRob24gfSxcbl07XG5cbi8vIFBhdGgtYmFzZWQgbG9vayB1cHNcbmNvbnN0IHNoZWxsVHlwZVBhdGhSZWdleEFsbG93TGlzdDogeyByZWdleDogUmVnRXhwOyB0eXBlOiBBbGxvd2VkU2hlbGxUeXBlIH1bXSA9IFtcblx0Ly8gR2l0IGJhc2ggdXNlcyBiYXNoLmV4ZSwgc28gbG9vayB1cCBiYXNlZCBvbiB0aGUgcGF0aFxuXHR7IHJlZ2V4OiAvR2l0XFxcXGJpblxcXFxiYXNoXFwuZXhlJC9pLCB0eXBlOiBBbGxvd2VkU2hlbGxUeXBlLkdpdEJhc2ggfSxcblx0Ly8gV2luZG93c1Bvd2VyU2hlbGwgc2hvdWxkIGFsd2F5cyBiZSBpbnN0YWxsZWQgb24gdGhpcyBwYXRoLCB3ZSBjYW5ub3QganVzdCBsb29rIGF0IHRoZVxuXHQvLyBleGVjdXRhYmxlIG5hbWUgc2luY2UgcG93ZXJzaGVsbCBpcyB0aGUgQ0xJIG9uIG90aGVyIHBsYXRmb3JtcyBzb21ldGltZXMgKGVnLiBzbmFwIHBhY2thZ2UpXG5cdHsgcmVnZXg6IC9XaW5kb3dzUG93ZXJTaGVsbFxcXFx2MS4wXFxcXHBvd2Vyc2hlbGwuZXhlJC9pLCB0eXBlOiBBbGxvd2VkU2hlbGxUeXBlLldpbmRvd3NQb3dlclNoZWxsIH0sXG5cdC8vIFdTTCBleGVjdXRhYmxlcyB3aWxsIHJlcHJlc2VudCBzb21lIG90aGVyIHNoZWxsIGluIHRoZSBlbmQsIGJ1dCBpdCdzIGRpZmZpY3VsdCB0byBkZXRlcm1pbmVcblx0Ly8gd2hlbiB3ZSBsb2dcblx0eyByZWdleDogL1dpbmRvd3NcXFxcU3lzdGVtMzJcXFxcKD86YmFzaHx3c2wpXFwuZXhlJC9pLCB0eXBlOiBBbGxvd2VkU2hlbGxUeXBlLldzbCB9LFxuXTtcblxuZnVuY3Rpb24gZ2V0U2FuaXRpemVkU2hlbGxUeXBlKHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcpOiBBbGxvd2VkU2hlbGxUeXBlIHtcblx0aWYgKCFzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlKSB7XG5cdFx0cmV0dXJuIEFsbG93ZWRTaGVsbFR5cGUuVW5rbm93bjtcblx0fVxuXHRjb25zdCBleGVjdXRhYmxlRmlsZSA9IGJhc2VuYW1lKHNoZWxsTGF1bmNoQ29uZmlnLmV4ZWN1dGFibGUpO1xuXHRjb25zdCBleGVjdXRhYmxlRmlsZVdpdGhvdXRFeHQgPSBleGVjdXRhYmxlRmlsZS5yZXBsYWNlKC9cXC5bXlxcLl0rJC8sICcnKTtcblx0Zm9yIChjb25zdCBlbnRyeSBvZiBzaGVsbFR5cGVQYXRoUmVnZXhBbGxvd0xpc3QpIHtcblx0XHRpZiAoZW50cnkucmVnZXgudGVzdChzaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlKSkge1xuXHRcdFx0cmV0dXJuIGVudHJ5LnR5cGU7XG5cdFx0fVxuXHR9XG5cdGZvciAoY29uc3QgZW50cnkgb2Ygc2hlbGxUeXBlRXhlY3V0YWJsZVJlZ2V4QWxsb3dMaXN0KSB7XG5cdFx0aWYgKGVudHJ5LnJlZ2V4LnRlc3QoZXhlY3V0YWJsZUZpbGVXaXRob3V0RXh0KSkge1xuXHRcdFx0cmV0dXJuIGVudHJ5LnR5cGU7XG5cdFx0fVxuXHR9XG5cdGlmICgoc2hlbGxUeXBlRXhlY3V0YWJsZUFsbG93TGlzdCkuaGFzKGV4ZWN1dGFibGVGaWxlV2l0aG91dEV4dCkpIHtcblx0XHRyZXR1cm4gZXhlY3V0YWJsZUZpbGVXaXRob3V0RXh0IGFzIEFsbG93ZWRTaGVsbFR5cGU7XG5cdH1cblx0cmV0dXJuIEFsbG93ZWRTaGVsbFR5cGUuVW5rbm93bjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUI7QUFHbEMsU0FBUyx3QkFBd0I7QUFFMUIsSUFBTSxnQ0FBTixjQUE0QyxXQUE2QztBQUFBLEVBRy9GLFlBQ21CLGlCQUNrQixtQkFDbkM7QUFDRCxVQUFNO0FBRjhCO0FBSXBDLFNBQUssVUFBVSxnQkFBZ0Isb0JBQW9CLE9BQU0sYUFBWTtBQUVwRSxZQUFNLFNBQVM7QUFDZixXQUFLLG1CQUFtQixTQUFTLGlCQUFpQjtBQUFBLElBQ25ELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLG1CQUFtQixtQkFBNkM7QUFldkUsU0FBSyxrQkFBa0IsV0FBbUYsMkJBQTJCO0FBQUEsTUFDcEksV0FBVyxzQkFBc0IsaUJBQWlCO0FBQUEsTUFDbEQsYUFBYSxDQUFDLENBQUMsa0JBQWtCO0FBQUEsTUFDakMsMkJBQTJCLENBQUMsQ0FBQyxrQkFBa0I7QUFBQSxNQUMvQyxlQUFlLE9BQU8sa0JBQWtCLFNBQVMsV0FBVyxrQkFBa0IsS0FBSyxNQUFNLEdBQUcsSUFBSSxrQkFBa0IsT0FBTyxLQUFLLFNBQU8sUUFBUSxRQUFRLFFBQVEsU0FBUyxLQUFLO0FBQUEsSUFDNUssQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQXRDYSw4QkFDTCxLQUFLO0FBREEsZ0NBQU47QUFBQSxFQUlKO0FBQUEsRUFDQTtBQUFBLEdBTFU7QUF3Q2IsSUFBVyxtQkFBWCxrQkFBV0Esc0JBQVg7QUFDQyxFQUFBQSxrQkFBQSxhQUFVO0FBR1YsRUFBQUEsa0JBQUEsbUJBQWdCO0FBQ2hCLEVBQUFBLGtCQUFBLGFBQVU7QUFDVixFQUFBQSxrQkFBQSx1QkFBb0I7QUFDcEIsRUFBQUEsa0JBQUEsU0FBTTtBQUdOLEVBQUFBLGtCQUFBLFVBQU87QUFDUCxFQUFBQSxrQkFBQSxTQUFNO0FBQ04sRUFBQUEsa0JBQUEsVUFBTztBQUNQLEVBQUFBLGtCQUFBLFVBQU87QUFDUCxFQUFBQSxrQkFBQSxTQUFNO0FBQ04sRUFBQUEsa0JBQUEsYUFBVTtBQUNWLEVBQUFBLGtCQUFBLFVBQU87QUFDUCxFQUFBQSxrQkFBQSxRQUFLO0FBQ0wsRUFBQUEsa0JBQUEsU0FBTTtBQUNOLEVBQUFBLGtCQUFBLFVBQU87QUFDUCxFQUFBQSxrQkFBQSxVQUFPO0FBQ1AsRUFBQUEsa0JBQUEsU0FBTTtBQUdOLEVBQUFBLGtCQUFBLFdBQVE7QUFDUixFQUFBQSxrQkFBQSxVQUFPO0FBQ1AsRUFBQUEsa0JBQUEsWUFBUztBQUNULEVBQUFBLGtCQUFBLGFBQVU7QUEzQkEsU0FBQUE7QUFBQSxHQUFBO0FBK0JYLE1BQU0sK0JBQTRDLG9CQUFJLElBQUk7QUFBQSxFQUN6RDtBQUFBLEVBQ0E7QUFBQSxFQUVBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUVBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRCxDQUFDO0FBR0QsTUFBTSxvQ0FBaUY7QUFBQSxFQUN0RixFQUFFLE9BQU8sK0JBQStCLE1BQU0sc0JBQXdCO0FBQ3ZFO0FBR0EsTUFBTSw4QkFBMkU7QUFBQTtBQUFBLEVBRWhGLEVBQUUsT0FBTyx5QkFBeUIsTUFBTSx5QkFBeUI7QUFBQTtBQUFBO0FBQUEsRUFHakUsRUFBRSxPQUFPLDZDQUE2QyxNQUFNLDZDQUFtQztBQUFBO0FBQUE7QUFBQSxFQUcvRixFQUFFLE9BQU8sMENBQTBDLE1BQU0sZ0JBQXFCO0FBQy9FO0FBRUEsU0FBUyxzQkFBc0IsbUJBQXlEO0FBQ3ZGLE1BQUksQ0FBQyxrQkFBa0IsWUFBWTtBQUNsQyxXQUFPO0FBQUEsRUFDUjtBQUNBLFFBQU0saUJBQWlCLFNBQVMsa0JBQWtCLFVBQVU7QUFDNUQsUUFBTSwyQkFBMkIsZUFBZSxRQUFRLGFBQWEsRUFBRTtBQUN2RSxhQUFXLFNBQVMsNkJBQTZCO0FBQ2hELFFBQUksTUFBTSxNQUFNLEtBQUssa0JBQWtCLFVBQVUsR0FBRztBQUNuRCxhQUFPLE1BQU07QUFBQSxJQUNkO0FBQUEsRUFDRDtBQUNBLGFBQVcsU0FBUyxtQ0FBbUM7QUFDdEQsUUFBSSxNQUFNLE1BQU0sS0FBSyx3QkFBd0IsR0FBRztBQUMvQyxhQUFPLE1BQU07QUFBQSxJQUNkO0FBQUEsRUFDRDtBQUNBLE1BQUssNkJBQThCLElBQUksd0JBQXdCLEdBQUc7QUFDakUsV0FBTztBQUFBLEVBQ1I7QUFDQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbIkFsbG93ZWRTaGVsbFR5cGUiXQp9Cg==
