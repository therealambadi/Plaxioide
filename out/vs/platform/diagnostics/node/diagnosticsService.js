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
import * as fs from "fs";
import * as osLib from "os";
import { Promises } from "../../../base/common/async.js";
import { getNodeType, parse } from "../../../base/common/json.js";
import { Schemas } from "../../../base/common/network.js";
import { basename, join } from "../../../base/common/path.js";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { URI } from "../../../base/common/uri.js";
import { virtualMachineHint } from "../../../base/node/id.js";
import { Promises as pfs } from "../../../base/node/pfs.js";
import { listProcesses } from "../../../base/node/ps.js";
import { isRemoteDiagnosticError } from "../common/diagnostics.js";
import { ByteSize } from "../../files/common/files.js";
import { IProductService } from "../../product/common/productService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
const workspaceStatsCache = /* @__PURE__ */ new Map();
async function collectWorkspaceStats(folder, filter) {
  const cacheKey = `${folder}::${filter.join(":")}`;
  const cached = workspaceStatsCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const configFilePatterns = [
    { tag: "grunt.js", filePattern: /^gruntfile\.js$/i },
    { tag: "gulp.js", filePattern: /^gulpfile\.js$/i },
    { tag: "tsconfig.json", filePattern: /^tsconfig\.json$/i },
    { tag: "package.json", filePattern: /^package\.json$/i },
    { tag: "jsconfig.json", filePattern: /^jsconfig\.json$/i },
    { tag: "tslint.json", filePattern: /^tslint\.json$/i },
    { tag: "eslint.json", filePattern: /^eslint\.json$/i },
    { tag: "tasks.json", filePattern: /^tasks\.json$/i },
    { tag: "launch.json", filePattern: /^launch\.json$/i },
    { tag: "mcp.json", filePattern: /^mcp\.json$/i },
    { tag: "settings.json", filePattern: /^settings\.json$/i },
    { tag: "webpack.config.js", filePattern: /^webpack\.config\.js$/i },
    { tag: "project.json", filePattern: /^project\.json$/i },
    { tag: "makefile", filePattern: /^makefile$/i },
    { tag: "sln", filePattern: /^.+\.sln$/i },
    { tag: "csproj", filePattern: /^.+\.csproj$/i },
    { tag: "cmake", filePattern: /^.+\.cmake$/i },
    { tag: "github-actions", filePattern: /^.+\.ya?ml$/i, relativePathPattern: /^\.github(?:\/|\\)workflows$/i },
    { tag: "devcontainer.json", filePattern: /^devcontainer\.json$/i },
    { tag: "dockerfile", filePattern: /^(dockerfile|docker\-compose\.ya?ml)$/i },
    { tag: "cursorrules", filePattern: /^\.cursorrules$/i }
  ];
  const fileTypes = /* @__PURE__ */ new Map();
  const configFiles = /* @__PURE__ */ new Map();
  const MAX_FILES = 2e4;
  function collect(root, dir, filter2, token) {
    const relativePath = dir.substring(root.length + 1);
    return Promises.withAsyncBody(async (resolve) => {
      let files;
      token.readdirCount++;
      try {
        files = await pfs.readdir(dir, { withFileTypes: true });
      } catch (error) {
        resolve();
        return;
      }
      if (token.count >= MAX_FILES) {
        token.count += files.length;
        token.maxReached = true;
        resolve();
        return;
      }
      let pending = files.length;
      if (pending === 0) {
        resolve();
        return;
      }
      let filesToRead = files;
      if (token.count + files.length > MAX_FILES) {
        token.maxReached = true;
        pending = MAX_FILES - token.count;
        filesToRead = files.slice(0, pending);
      }
      token.count += files.length;
      for (const file of filesToRead) {
        if (file.isDirectory()) {
          if (!filter2.includes(file.name)) {
            await collect(root, join(dir, file.name), filter2, token);
          }
          if (--pending === 0) {
            resolve();
            return;
          }
        } else {
          const index = file.name.lastIndexOf(".");
          if (index >= 0) {
            const fileType = file.name.substring(index + 1);
            if (fileType) {
              fileTypes.set(fileType, (fileTypes.get(fileType) ?? 0) + 1);
            }
          }
          for (const configFile of configFilePatterns) {
            if (configFile.relativePathPattern?.test(relativePath) !== false && configFile.filePattern.test(file.name)) {
              configFiles.set(configFile.tag, (configFiles.get(configFile.tag) ?? 0) + 1);
            }
          }
          if (--pending === 0) {
            resolve();
            return;
          }
        }
      }
    });
  }
  const statsPromise = Promises.withAsyncBody(async (resolve) => {
    const token = { count: 0, maxReached: false, readdirCount: 0 };
    const sw = new StopWatch(true);
    await collect(folder, folder, filter, token);
    const launchConfigs = await collectLaunchConfigs(folder);
    resolve({
      configFiles: asSortedItems(configFiles),
      fileTypes: asSortedItems(fileTypes),
      fileCount: token.count,
      maxFilesReached: token.maxReached,
      launchConfigFiles: launchConfigs,
      totalScanTime: sw.elapsed(),
      totalReaddirCount: token.readdirCount
    });
  });
  workspaceStatsCache.set(cacheKey, statsPromise);
  return statsPromise;
}
function asSortedItems(items) {
  return Array.from(items.entries(), ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
function getMachineInfo() {
  const machineInfo = {
    os: `${osLib.type()} ${osLib.arch()} ${osLib.release()}`,
    memory: `${(osLib.totalmem() / ByteSize.GB).toFixed(2)}GB (${(osLib.freemem() / ByteSize.GB).toFixed(2)}GB free)`,
    vmHint: `${Math.round(virtualMachineHint.value() * 100)}%`
  };
  const cpus = osLib.cpus();
  if (cpus && cpus.length > 0) {
    machineInfo.cpus = `${cpus[0].model} (${cpus.length} x ${cpus[0].speed})`;
  }
  return machineInfo;
}
async function collectLaunchConfigs(folder) {
  try {
    const launchConfigs = /* @__PURE__ */ new Map();
    const launchConfig = join(folder, ".vscode", "launch.json");
    const contents = await fs.promises.readFile(launchConfig);
    const errors = [];
    const json = parse(contents.toString(), errors);
    if (errors.length) {
      console.log(`Unable to parse ${launchConfig}`);
      return [];
    }
    if (getNodeType(json) === "object" && json["configurations"]) {
      for (const each of json["configurations"]) {
        const type = each["type"];
        if (type) {
          if (launchConfigs.has(type)) {
            launchConfigs.set(type, launchConfigs.get(type) + 1);
          } else {
            launchConfigs.set(type, 1);
          }
        }
      }
    }
    return asSortedItems(launchConfigs);
  } catch (error) {
    return [];
  }
}
let DiagnosticsService = class {
  constructor(telemetryService, productService) {
    this.telemetryService = telemetryService;
    this.productService = productService;
  }
  formatMachineInfo(info) {
    const output = [];
    output.push(`OS Version:       ${info.os}`);
    output.push(`CPUs:             ${info.cpus}`);
    output.push(`Memory (System):  ${info.memory}`);
    output.push(`VM:               ${info.vmHint}`);
    return output.join("\n");
  }
  formatEnvironment(info) {
    const output = [];
    output.push(`Version:          ${this.productService.nameShort} ${this.productService.version} (${this.productService.commit || "Commit unknown"}, ${this.productService.date || "Date unknown"})`);
    output.push(`OS Version:       ${osLib.type()} ${osLib.arch()} ${osLib.release()}`);
    const cpus = osLib.cpus();
    if (cpus && cpus.length > 0) {
      output.push(`CPUs:             ${cpus[0].model} (${cpus.length} x ${cpus[0].speed})`);
    }
    output.push(`Memory (System):  ${(osLib.totalmem() / ByteSize.GB).toFixed(2)}GB (${(osLib.freemem() / ByteSize.GB).toFixed(2)}GB free)`);
    if (!isWindows) {
      output.push(`Load (avg):       ${osLib.loadavg().map((l) => Math.round(l)).join(", ")}`);
    }
    output.push(`VM:               ${Math.round(virtualMachineHint.value() * 100)}%`);
    output.push(`Screen Reader:    ${info.screenReader ? "yes" : "no"}`);
    output.push(`Process Argv:     ${info.mainArguments.join(" ")}`);
    output.push(`GPU Status:       ${this.expandGPUFeatures(info.gpuFeatureStatus)}`);
    return output.join("\n");
  }
  async getPerformanceInfo(info, remoteData) {
    return Promise.all([listProcesses(info.mainPID), this.formatWorkspaceMetadata(info)]).then(async (result) => {
      let [rootProcess, workspaceInfo] = result;
      let processInfo = this.formatProcessList(info, rootProcess);
      remoteData.forEach((diagnostics) => {
        if (isRemoteDiagnosticError(diagnostics)) {
          processInfo += `
${diagnostics.errorMessage}`;
          workspaceInfo += `
${diagnostics.errorMessage}`;
        } else {
          processInfo += `

Remote: ${diagnostics.hostName}`;
          if (diagnostics.processes) {
            processInfo += `
${this.formatProcessList(info, diagnostics.processes)}`;
          }
          if (diagnostics.workspaceMetadata) {
            workspaceInfo += `
|  Remote: ${diagnostics.hostName}`;
            for (const folder of Object.keys(diagnostics.workspaceMetadata)) {
              const metadata = diagnostics.workspaceMetadata[folder];
              let countMessage = `${metadata.fileCount} files`;
              if (metadata.maxFilesReached) {
                countMessage = `more than ${countMessage}`;
              }
              workspaceInfo += `|    Folder (${folder}): ${countMessage}`;
              workspaceInfo += this.formatWorkspaceStats(metadata);
            }
          }
        }
      });
      return {
        processInfo,
        workspaceInfo
      };
    });
  }
  async getSystemInfo(info, remoteData) {
    const { memory, vmHint, os, cpus } = getMachineInfo();
    const systemInfo = {
      os,
      memory,
      cpus,
      vmHint,
      processArgs: `${info.mainArguments.join(" ")}`,
      gpuStatus: info.gpuFeatureStatus,
      screenReader: `${info.screenReader ? "yes" : "no"}`,
      remoteData
    };
    if (!isWindows) {
      systemInfo.load = `${osLib.loadavg().map((l) => Math.round(l)).join(", ")}`;
    }
    if (isLinux) {
      systemInfo.linuxEnv = {
        desktopSession: process.env["DESKTOP_SESSION"],
        xdgSessionDesktop: process.env["XDG_SESSION_DESKTOP"],
        xdgCurrentDesktop: process.env["XDG_CURRENT_DESKTOP"],
        xdgSessionType: process.env["XDG_SESSION_TYPE"]
      };
    }
    return Promise.resolve(systemInfo);
  }
  async getDiagnostics(info, remoteDiagnostics) {
    const output = [];
    return listProcesses(info.mainPID).then(async (rootProcess) => {
      output.push("");
      output.push(this.formatEnvironment(info));
      output.push("");
      output.push(this.formatProcessList(info, rootProcess));
      if (info.windows.some((window) => window.folderURIs && window.folderURIs.length > 0 && !window.remoteAuthority)) {
        output.push("");
        output.push("Workspace Stats: ");
        output.push(await this.formatWorkspaceMetadata(info));
      }
      remoteDiagnostics.forEach((diagnostics) => {
        if (isRemoteDiagnosticError(diagnostics)) {
          output.push(`
${diagnostics.errorMessage}`);
        } else {
          output.push("\n\n");
          output.push(`Remote:           ${diagnostics.hostName}`);
          output.push(this.formatMachineInfo(diagnostics.machineInfo));
          if (diagnostics.processes) {
            output.push(this.formatProcessList(info, diagnostics.processes));
          }
          if (diagnostics.workspaceMetadata) {
            for (const folder of Object.keys(diagnostics.workspaceMetadata)) {
              const metadata = diagnostics.workspaceMetadata[folder];
              let countMessage = `${metadata.fileCount} files`;
              if (metadata.maxFilesReached) {
                countMessage = `more than ${countMessage}`;
              }
              output.push(`Folder (${folder}): ${countMessage}`);
              output.push(this.formatWorkspaceStats(metadata));
            }
          }
        }
      });
      output.push("");
      output.push("");
      return output.join("\n");
    });
  }
  formatWorkspaceStats(workspaceStats) {
    const output = [];
    const lineLength = 60;
    let col = 0;
    const appendAndWrap = (name, count) => {
      const item = ` ${name}(${count})`;
      if (col + item.length > lineLength) {
        output.push(line);
        line = "|                 ";
        col = line.length;
      } else {
        col += item.length;
      }
      line += item;
    };
    let line = "|      File types:";
    const maxShown = 10;
    const max = workspaceStats.fileTypes.length > maxShown ? maxShown : workspaceStats.fileTypes.length;
    for (let i = 0; i < max; i++) {
      const item = workspaceStats.fileTypes[i];
      appendAndWrap(item.name, item.count);
    }
    output.push(line);
    if (workspaceStats.configFiles.length >= 0) {
      line = "|      Conf files:";
      col = 0;
      workspaceStats.configFiles.forEach((item) => {
        appendAndWrap(item.name, item.count);
      });
      output.push(line);
    }
    if (workspaceStats.launchConfigFiles.length > 0) {
      let line2 = "|      Launch Configs:";
      workspaceStats.launchConfigFiles.forEach((each) => {
        const item = each.count > 1 ? ` ${each.name}(${each.count})` : ` ${each.name}`;
        line2 += item;
      });
      output.push(line2);
    }
    return output.join("\n");
  }
  expandGPUFeatures(gpuFeatures) {
    const longestFeatureName = Math.max(...Object.keys(gpuFeatures).map((feature) => feature.length));
    return Object.keys(gpuFeatures).map((feature) => `${feature}:  ${" ".repeat(longestFeatureName - feature.length)}  ${gpuFeatures[feature]}`).join("\n                  ");
  }
  formatWorkspaceMetadata(info) {
    const output = [];
    const workspaceStatPromises = [];
    info.windows.forEach((window) => {
      if (window.folderURIs.length === 0 || !!window.remoteAuthority) {
        return;
      }
      output.push(`|  Window (${window.title})`);
      window.folderURIs.forEach((uriComponents) => {
        const folderUri = URI.revive(uriComponents);
        if (folderUri.scheme === Schemas.file) {
          const folder = folderUri.fsPath;
          workspaceStatPromises.push(collectWorkspaceStats(folder, ["node_modules", ".git"]).then((stats) => {
            let countMessage = `${stats.fileCount} files`;
            if (stats.maxFilesReached) {
              countMessage = `more than ${countMessage}`;
            }
            output.push(`|    Folder (${basename(folder)}): ${countMessage}`);
            output.push(this.formatWorkspaceStats(stats));
          }).catch((error) => {
            output.push(`|      Error: Unable to collect workspace stats for folder ${folder} (${error.toString()})`);
          }));
        } else {
          output.push(`|    Folder (${folderUri.toString()}): Workspace stats not available.`);
        }
      });
    });
    return Promise.all(workspaceStatPromises).then((_) => output.join("\n")).catch((e) => `Unable to collect workspace stats: ${e}`);
  }
  formatProcessList(info, rootProcess) {
    const mapProcessToName = /* @__PURE__ */ new Map();
    info.windows.forEach((window) => mapProcessToName.set(window.pid, `window [${window.id}] (${window.title})`));
    info.pidToNames.forEach(({ pid, name }) => mapProcessToName.set(pid, name));
    const output = [];
    output.push("CPU %	Mem MB	   PID	Process");
    if (rootProcess) {
      this.formatProcessItem(info.mainPID, mapProcessToName, output, rootProcess, 0);
    }
    return output.join("\n");
  }
  formatProcessItem(mainPid, mapProcessToName, output, item, indent) {
    const isRoot = indent === 0;
    let name;
    if (isRoot) {
      name = item.pid === mainPid ? `${this.productService.applicationName} main` : "remote agent";
    } else {
      if (mapProcessToName.has(item.pid)) {
        name = mapProcessToName.get(item.pid);
      } else {
        name = `${"  ".repeat(indent)} ${item.name}`;
      }
    }
    const memory = process.platform === "win32" ? item.mem : osLib.totalmem() * (item.mem / 100);
    output.push(`${item.load.toFixed(0).padStart(5, " ")}	${(memory / ByteSize.MB).toFixed(0).padStart(6, " ")}	${item.pid.toFixed(0).padStart(6, " ")}	${name}`);
    if (Array.isArray(item.children)) {
      item.children.forEach((child) => this.formatProcessItem(mainPid, mapProcessToName, output, child, indent + 1));
    }
  }
  async getWorkspaceFileExtensions(workspace) {
    const items = /* @__PURE__ */ new Set();
    for (const { uri } of workspace.folders) {
      const folderUri = URI.revive(uri);
      if (folderUri.scheme !== Schemas.file) {
        continue;
      }
      const folder = folderUri.fsPath;
      try {
        const stats = await collectWorkspaceStats(folder, ["node_modules", ".git"]);
        stats.fileTypes.forEach((item) => items.add(item.name));
      } catch {
      }
    }
    return { extensions: [...items] };
  }
  async reportWorkspaceStats(workspace) {
    for (const { uri } of workspace.folders) {
      const folderUri = URI.revive(uri);
      if (folderUri.scheme !== Schemas.file) {
        continue;
      }
      const folder = folderUri.fsPath;
      try {
        const stats = await collectWorkspaceStats(folder, ["node_modules", ".git"]);
        this.telemetryService.publicLog2("workspace.stats", {
          "workspace.id": workspace.telemetryId,
          rendererSessionId: workspace.rendererSessionId
        });
        stats.fileTypes.forEach((e) => {
          this.telemetryService.publicLog2("workspace.stats.file", {
            rendererSessionId: workspace.rendererSessionId,
            type: e.name,
            count: e.count
          });
        });
        stats.launchConfigFiles.forEach((e) => {
          this.telemetryService.publicLog2("workspace.stats.launchConfigFile", {
            rendererSessionId: workspace.rendererSessionId,
            type: e.name,
            count: e.count
          });
        });
        stats.configFiles.forEach((e) => {
          this.telemetryService.publicLog2("workspace.stats.configFiles", {
            rendererSessionId: workspace.rendererSessionId,
            type: e.name,
            count: e.count
          });
        });
        this.telemetryService.publicLog2("workspace.stats.metadata", { duration: stats.totalScanTime, reachedLimit: stats.maxFilesReached, fileCount: stats.fileCount, readdirCount: stats.totalReaddirCount });
      } catch {
      }
    }
  }
};
DiagnosticsService = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IProductService)
], DiagnosticsService);
export {
  DiagnosticsService,
  collectLaunchConfigs,
  collectWorkspaceStats,
  getMachineInfo
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9kaWFnbm9zdGljcy9ub2RlL2RpYWdub3N0aWNzU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIG9zTGliIGZyb20gJ29zJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZ2V0Tm9kZVR5cGUsIHBhcnNlLCBQYXJzZUVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vanNvbi5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgam9pbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNMaW51eCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgUHJvY2Vzc0l0ZW0gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzZXMuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyB2aXJ0dWFsTWFjaGluZUhpbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL25vZGUvaWQuanMnO1xuaW1wb3J0IHsgSURpcmVudCwgUHJvbWlzZXMgYXMgcGZzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBsaXN0UHJvY2Vzc2VzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3BzLmpzJztcbmltcG9ydCB7IElEaWFnbm9zdGljc1NlcnZpY2UsIElNYWNoaW5lSW5mbywgSU1haW5Qcm9jZXNzRGlhZ25vc3RpY3MsIElSZW1vdGVEaWFnbm9zdGljRXJyb3IsIElSZW1vdGVEaWFnbm9zdGljSW5mbywgaXNSZW1vdGVEaWFnbm9zdGljRXJyb3IsIElXb3Jrc3BhY2VJbmZvcm1hdGlvbiwgUGVyZm9ybWFuY2VJbmZvLCBTeXN0ZW1JbmZvLCBXb3Jrc3BhY2VTdGF0SXRlbSwgV29ya3NwYWNlU3RhdHMgfSBmcm9tICcuLi9jb21tb24vZGlhZ25vc3RpY3MuanMnO1xuaW1wb3J0IHsgQnl0ZVNpemUgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuXG5pbnRlcmZhY2UgQ29uZmlnRmlsZVBhdHRlcm5zIHtcblx0dGFnOiBzdHJpbmc7XG5cdGZpbGVQYXR0ZXJuOiBSZWdFeHA7XG5cdHJlbGF0aXZlUGF0aFBhdHRlcm4/OiBSZWdFeHA7XG59XG5cbmNvbnN0IHdvcmtzcGFjZVN0YXRzQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgUHJvbWlzZTxXb3Jrc3BhY2VTdGF0cz4+KCk7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29sbGVjdFdvcmtzcGFjZVN0YXRzKGZvbGRlcjogc3RyaW5nLCBmaWx0ZXI6IHN0cmluZ1tdKTogUHJvbWlzZTxXb3Jrc3BhY2VTdGF0cz4ge1xuXHRjb25zdCBjYWNoZUtleSA9IGAke2ZvbGRlcn06OiR7ZmlsdGVyLmpvaW4oJzonKX1gO1xuXHRjb25zdCBjYWNoZWQgPSB3b3Jrc3BhY2VTdGF0c0NhY2hlLmdldChjYWNoZUtleSk7XG5cdGlmIChjYWNoZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkO1xuXHR9XG5cblx0Y29uc3QgY29uZmlnRmlsZVBhdHRlcm5zOiBDb25maWdGaWxlUGF0dGVybnNbXSA9IFtcblx0XHR7IHRhZzogJ2dydW50LmpzJywgZmlsZVBhdHRlcm46IC9eZ3J1bnRmaWxlXFwuanMkL2kgfSxcblx0XHR7IHRhZzogJ2d1bHAuanMnLCBmaWxlUGF0dGVybjogL15ndWxwZmlsZVxcLmpzJC9pIH0sXG5cdFx0eyB0YWc6ICd0c2NvbmZpZy5qc29uJywgZmlsZVBhdHRlcm46IC9edHNjb25maWdcXC5qc29uJC9pIH0sXG5cdFx0eyB0YWc6ICdwYWNrYWdlLmpzb24nLCBmaWxlUGF0dGVybjogL15wYWNrYWdlXFwuanNvbiQvaSB9LFxuXHRcdHsgdGFnOiAnanNjb25maWcuanNvbicsIGZpbGVQYXR0ZXJuOiAvXmpzY29uZmlnXFwuanNvbiQvaSB9LFxuXHRcdHsgdGFnOiAndHNsaW50Lmpzb24nLCBmaWxlUGF0dGVybjogL150c2xpbnRcXC5qc29uJC9pIH0sXG5cdFx0eyB0YWc6ICdlc2xpbnQuanNvbicsIGZpbGVQYXR0ZXJuOiAvXmVzbGludFxcLmpzb24kL2kgfSxcblx0XHR7IHRhZzogJ3Rhc2tzLmpzb24nLCBmaWxlUGF0dGVybjogL150YXNrc1xcLmpzb24kL2kgfSxcblx0XHR7IHRhZzogJ2xhdW5jaC5qc29uJywgZmlsZVBhdHRlcm46IC9ebGF1bmNoXFwuanNvbiQvaSB9LFxuXHRcdHsgdGFnOiAnbWNwLmpzb24nLCBmaWxlUGF0dGVybjogL15tY3BcXC5qc29uJC9pIH0sXG5cdFx0eyB0YWc6ICdzZXR0aW5ncy5qc29uJywgZmlsZVBhdHRlcm46IC9ec2V0dGluZ3NcXC5qc29uJC9pIH0sXG5cdFx0eyB0YWc6ICd3ZWJwYWNrLmNvbmZpZy5qcycsIGZpbGVQYXR0ZXJuOiAvXndlYnBhY2tcXC5jb25maWdcXC5qcyQvaSB9LFxuXHRcdHsgdGFnOiAncHJvamVjdC5qc29uJywgZmlsZVBhdHRlcm46IC9ecHJvamVjdFxcLmpzb24kL2kgfSxcblx0XHR7IHRhZzogJ21ha2VmaWxlJywgZmlsZVBhdHRlcm46IC9ebWFrZWZpbGUkL2kgfSxcblx0XHR7IHRhZzogJ3NsbicsIGZpbGVQYXR0ZXJuOiAvXi4rXFwuc2xuJC9pIH0sXG5cdFx0eyB0YWc6ICdjc3Byb2onLCBmaWxlUGF0dGVybjogL14uK1xcLmNzcHJvaiQvaSB9LFxuXHRcdHsgdGFnOiAnY21ha2UnLCBmaWxlUGF0dGVybjogL14uK1xcLmNtYWtlJC9pIH0sXG5cdFx0eyB0YWc6ICdnaXRodWItYWN0aW9ucycsIGZpbGVQYXR0ZXJuOiAvXi4rXFwueWE/bWwkL2ksIHJlbGF0aXZlUGF0aFBhdHRlcm46IC9eXFwuZ2l0aHViKD86XFwvfFxcXFwpd29ya2Zsb3dzJC9pIH0sXG5cdFx0eyB0YWc6ICdkZXZjb250YWluZXIuanNvbicsIGZpbGVQYXR0ZXJuOiAvXmRldmNvbnRhaW5lclxcLmpzb24kL2kgfSxcblx0XHR7IHRhZzogJ2RvY2tlcmZpbGUnLCBmaWxlUGF0dGVybjogL14oZG9ja2VyZmlsZXxkb2NrZXJcXC1jb21wb3NlXFwueWE/bWwpJC9pIH0sXG5cdFx0eyB0YWc6ICdjdXJzb3JydWxlcycsIGZpbGVQYXR0ZXJuOiAvXlxcLmN1cnNvcnJ1bGVzJC9pIH0sXG5cdF07XG5cblx0Y29uc3QgZmlsZVR5cGVzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0Y29uc3QgY29uZmlnRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG5cdGNvbnN0IE1BWF9GSUxFUyA9IDIwMDAwO1xuXG5cdGZ1bmN0aW9uIGNvbGxlY3Qocm9vdDogc3RyaW5nLCBkaXI6IHN0cmluZywgZmlsdGVyOiBzdHJpbmdbXSwgdG9rZW46IHsgY291bnQ6IG51bWJlcjsgbWF4UmVhY2hlZDogYm9vbGVhbjsgcmVhZGRpckNvdW50OiBudW1iZXIgfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlbGF0aXZlUGF0aCA9IGRpci5zdWJzdHJpbmcocm9vdC5sZW5ndGggKyAxKTtcblxuXHRcdHJldHVybiBQcm9taXNlcy53aXRoQXN5bmNCb2R5KGFzeW5jIHJlc29sdmUgPT4ge1xuXHRcdFx0bGV0IGZpbGVzOiBJRGlyZW50W107XG5cblx0XHRcdHRva2VuLnJlYWRkaXJDb3VudCsrO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0ZmlsZXMgPSBhd2FpdCBwZnMucmVhZGRpcihkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIElnbm9yZSBmb2xkZXJzIHRoYXQgY2FuJ3QgYmUgcmVhZFxuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRva2VuLmNvdW50ID49IE1BWF9GSUxFUykge1xuXHRcdFx0XHR0b2tlbi5jb3VudCArPSBmaWxlcy5sZW5ndGg7XG5cdFx0XHRcdHRva2VuLm1heFJlYWNoZWQgPSB0cnVlO1xuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IHBlbmRpbmcgPSBmaWxlcy5sZW5ndGg7XG5cdFx0XHRpZiAocGVuZGluZyA9PT0gMCkge1xuXHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGZpbGVzVG9SZWFkID0gZmlsZXM7XG5cdFx0XHRpZiAodG9rZW4uY291bnQgKyBmaWxlcy5sZW5ndGggPiBNQVhfRklMRVMpIHtcblx0XHRcdFx0dG9rZW4ubWF4UmVhY2hlZCA9IHRydWU7XG5cdFx0XHRcdHBlbmRpbmcgPSBNQVhfRklMRVMgLSB0b2tlbi5jb3VudDtcblx0XHRcdFx0ZmlsZXNUb1JlYWQgPSBmaWxlcy5zbGljZSgwLCBwZW5kaW5nKTtcblx0XHRcdH1cblxuXHRcdFx0dG9rZW4uY291bnQgKz0gZmlsZXMubGVuZ3RoO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXNUb1JlYWQpIHtcblx0XHRcdFx0aWYgKGZpbGUuaXNEaXJlY3RvcnkoKSkge1xuXHRcdFx0XHRcdGlmICghZmlsdGVyLmluY2x1ZGVzKGZpbGUubmFtZSkpIHtcblx0XHRcdFx0XHRcdGF3YWl0IGNvbGxlY3Qocm9vdCwgam9pbihkaXIsIGZpbGUubmFtZSksIGZpbHRlciwgdG9rZW4pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICgtLXBlbmRpbmcgPT09IDApIHtcblx0XHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSBmaWxlLm5hbWUubGFzdEluZGV4T2YoJy4nKTtcblx0XHRcdFx0XHRpZiAoaW5kZXggPj0gMCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZmlsZVR5cGUgPSBmaWxlLm5hbWUuc3Vic3RyaW5nKGluZGV4ICsgMSk7XG5cdFx0XHRcdFx0XHRpZiAoZmlsZVR5cGUpIHtcblx0XHRcdFx0XHRcdFx0ZmlsZVR5cGVzLnNldChmaWxlVHlwZSwgKGZpbGVUeXBlcy5nZXQoZmlsZVR5cGUpID8/IDApICsgMSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBjb25maWdGaWxlIG9mIGNvbmZpZ0ZpbGVQYXR0ZXJucykge1xuXHRcdFx0XHRcdFx0aWYgKGNvbmZpZ0ZpbGUucmVsYXRpdmVQYXRoUGF0dGVybj8udGVzdChyZWxhdGl2ZVBhdGgpICE9PSBmYWxzZSAmJiBjb25maWdGaWxlLmZpbGVQYXR0ZXJuLnRlc3QoZmlsZS5uYW1lKSkge1xuXHRcdFx0XHRcdFx0XHRjb25maWdGaWxlcy5zZXQoY29uZmlnRmlsZS50YWcsIChjb25maWdGaWxlcy5nZXQoY29uZmlnRmlsZS50YWcpID8/IDApICsgMSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKC0tcGVuZGluZyA9PT0gMCkge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Y29uc3Qgc3RhdHNQcm9taXNlID0gUHJvbWlzZXMud2l0aEFzeW5jQm9keTxXb3Jrc3BhY2VTdGF0cz4oYXN5bmMgKHJlc29sdmUpID0+IHtcblx0XHRjb25zdCB0b2tlbjogeyBjb3VudDogbnVtYmVyOyBtYXhSZWFjaGVkOiBib29sZWFuOyByZWFkZGlyQ291bnQ6IG51bWJlciB9ID0geyBjb3VudDogMCwgbWF4UmVhY2hlZDogZmFsc2UsIHJlYWRkaXJDb3VudDogMCB9O1xuXHRcdGNvbnN0IHN3ID0gbmV3IFN0b3BXYXRjaCh0cnVlKTtcblx0XHRhd2FpdCBjb2xsZWN0KGZvbGRlciwgZm9sZGVyLCBmaWx0ZXIsIHRva2VuKTtcblx0XHRjb25zdCBsYXVuY2hDb25maWdzID0gYXdhaXQgY29sbGVjdExhdW5jaENvbmZpZ3MoZm9sZGVyKTtcblx0XHRyZXNvbHZlKHtcblx0XHRcdGNvbmZpZ0ZpbGVzOiBhc1NvcnRlZEl0ZW1zKGNvbmZpZ0ZpbGVzKSxcblx0XHRcdGZpbGVUeXBlczogYXNTb3J0ZWRJdGVtcyhmaWxlVHlwZXMpLFxuXHRcdFx0ZmlsZUNvdW50OiB0b2tlbi5jb3VudCxcblx0XHRcdG1heEZpbGVzUmVhY2hlZDogdG9rZW4ubWF4UmVhY2hlZCxcblx0XHRcdGxhdW5jaENvbmZpZ0ZpbGVzOiBsYXVuY2hDb25maWdzLFxuXHRcdFx0dG90YWxTY2FuVGltZTogc3cuZWxhcHNlZCgpLFxuXHRcdFx0dG90YWxSZWFkZGlyQ291bnQ6IHRva2VuLnJlYWRkaXJDb3VudFxuXHRcdH0pO1xuXHR9KTtcblxuXHR3b3Jrc3BhY2VTdGF0c0NhY2hlLnNldChjYWNoZUtleSwgc3RhdHNQcm9taXNlKTtcblx0cmV0dXJuIHN0YXRzUHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gYXNTb3J0ZWRJdGVtcyhpdGVtczogTWFwPHN0cmluZywgbnVtYmVyPik6IFdvcmtzcGFjZVN0YXRJdGVtW10ge1xuXHRyZXR1cm4gQXJyYXkuZnJvbShpdGVtcy5lbnRyaWVzKCksIChbbmFtZSwgY291bnRdKSA9PiAoeyBuYW1lOiBuYW1lLCBjb3VudDogY291bnQgfSkpXG5cdFx0LnNvcnQoKGEsIGIpID0+IGIuY291bnQgLSBhLmNvdW50KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1hY2hpbmVJbmZvKCk6IElNYWNoaW5lSW5mbyB7XG5cblx0Y29uc3QgbWFjaGluZUluZm86IElNYWNoaW5lSW5mbyA9IHtcblx0XHRvczogYCR7b3NMaWIudHlwZSgpfSAke29zTGliLmFyY2goKX0gJHtvc0xpYi5yZWxlYXNlKCl9YCxcblx0XHRtZW1vcnk6IGAkeyhvc0xpYi50b3RhbG1lbSgpIC8gQnl0ZVNpemUuR0IpLnRvRml4ZWQoMil9R0IgKCR7KG9zTGliLmZyZWVtZW0oKSAvIEJ5dGVTaXplLkdCKS50b0ZpeGVkKDIpfUdCIGZyZWUpYCxcblx0XHR2bUhpbnQ6IGAke01hdGgucm91bmQoKHZpcnR1YWxNYWNoaW5lSGludC52YWx1ZSgpICogMTAwKSl9JWAsXG5cdH07XG5cblx0Y29uc3QgY3B1cyA9IG9zTGliLmNwdXMoKTtcblx0aWYgKGNwdXMgJiYgY3B1cy5sZW5ndGggPiAwKSB7XG5cdFx0bWFjaGluZUluZm8uY3B1cyA9IGAke2NwdXNbMF0ubW9kZWx9ICgke2NwdXMubGVuZ3RofSB4ICR7Y3B1c1swXS5zcGVlZH0pYDtcblx0fVxuXG5cdHJldHVybiBtYWNoaW5lSW5mbztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbGxlY3RMYXVuY2hDb25maWdzKGZvbGRlcjogc3RyaW5nKTogUHJvbWlzZTxXb3Jrc3BhY2VTdGF0SXRlbVtdPiB7XG5cdHRyeSB7XG5cdFx0Y29uc3QgbGF1bmNoQ29uZmlncyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cdFx0Y29uc3QgbGF1bmNoQ29uZmlnID0gam9pbihmb2xkZXIsICcudnNjb2RlJywgJ2xhdW5jaC5qc29uJyk7XG5cblx0XHRjb25zdCBjb250ZW50cyA9IGF3YWl0IGZzLnByb21pc2VzLnJlYWRGaWxlKGxhdW5jaENvbmZpZyk7XG5cblx0XHRjb25zdCBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuXHRcdGNvbnN0IGpzb24gPSBwYXJzZShjb250ZW50cy50b1N0cmluZygpLCBlcnJvcnMpO1xuXHRcdGlmIChlcnJvcnMubGVuZ3RoKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhgVW5hYmxlIHRvIHBhcnNlICR7bGF1bmNoQ29uZmlnfWApO1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGlmIChnZXROb2RlVHlwZShqc29uKSA9PT0gJ29iamVjdCcgJiYganNvblsnY29uZmlndXJhdGlvbnMnXSkge1xuXHRcdFx0Zm9yIChjb25zdCBlYWNoIG9mIGpzb25bJ2NvbmZpZ3VyYXRpb25zJ10pIHtcblx0XHRcdFx0Y29uc3QgdHlwZSA9IGVhY2hbJ3R5cGUnXTtcblx0XHRcdFx0aWYgKHR5cGUpIHtcblx0XHRcdFx0XHRpZiAobGF1bmNoQ29uZmlncy5oYXModHlwZSkpIHtcblx0XHRcdFx0XHRcdGxhdW5jaENvbmZpZ3Muc2V0KHR5cGUsIGxhdW5jaENvbmZpZ3MuZ2V0KHR5cGUpISArIDEpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRsYXVuY2hDb25maWdzLnNldCh0eXBlLCAxKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gYXNTb3J0ZWRJdGVtcyhsYXVuY2hDb25maWdzKTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRyZXR1cm4gW107XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERpYWdub3N0aWNzU2VydmljZSBpbXBsZW1lbnRzIElEaWFnbm9zdGljc1NlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlXG5cdCkgeyB9XG5cblx0cHJpdmF0ZSBmb3JtYXRNYWNoaW5lSW5mbyhpbmZvOiBJTWFjaGluZUluZm8pOiBzdHJpbmcge1xuXHRcdGNvbnN0IG91dHB1dDogc3RyaW5nW10gPSBbXTtcblx0XHRvdXRwdXQucHVzaChgT1MgVmVyc2lvbjogICAgICAgJHtpbmZvLm9zfWApO1xuXHRcdG91dHB1dC5wdXNoKGBDUFVzOiAgICAgICAgICAgICAke2luZm8uY3B1c31gKTtcblx0XHRvdXRwdXQucHVzaChgTWVtb3J5IChTeXN0ZW0pOiAgJHtpbmZvLm1lbW9yeX1gKTtcblx0XHRvdXRwdXQucHVzaChgVk06ICAgICAgICAgICAgICAgJHtpbmZvLnZtSGludH1gKTtcblxuXHRcdHJldHVybiBvdXRwdXQuam9pbignXFxuJyk7XG5cdH1cblxuXHRwcml2YXRlIGZvcm1hdEVudmlyb25tZW50KGluZm86IElNYWluUHJvY2Vzc0RpYWdub3N0aWNzKTogc3RyaW5nIHtcblx0XHRjb25zdCBvdXRwdXQ6IHN0cmluZ1tdID0gW107XG5cdFx0b3V0cHV0LnB1c2goYFZlcnNpb246ICAgICAgICAgICR7dGhpcy5wcm9kdWN0U2VydmljZS5uYW1lU2hvcnR9ICR7dGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9ufSAoJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLmNvbW1pdCB8fCAnQ29tbWl0IHVua25vd24nfSwgJHt0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUgfHwgJ0RhdGUgdW5rbm93bid9KWApO1xuXHRcdG91dHB1dC5wdXNoKGBPUyBWZXJzaW9uOiAgICAgICAke29zTGliLnR5cGUoKX0gJHtvc0xpYi5hcmNoKCl9ICR7b3NMaWIucmVsZWFzZSgpfWApO1xuXHRcdGNvbnN0IGNwdXMgPSBvc0xpYi5jcHVzKCk7XG5cdFx0aWYgKGNwdXMgJiYgY3B1cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRvdXRwdXQucHVzaChgQ1BVczogICAgICAgICAgICAgJHtjcHVzWzBdLm1vZGVsfSAoJHtjcHVzLmxlbmd0aH0geCAke2NwdXNbMF0uc3BlZWR9KWApO1xuXHRcdH1cblx0XHRvdXRwdXQucHVzaChgTWVtb3J5IChTeXN0ZW0pOiAgJHsob3NMaWIudG90YWxtZW0oKSAvIEJ5dGVTaXplLkdCKS50b0ZpeGVkKDIpfUdCICgkeyhvc0xpYi5mcmVlbWVtKCkgLyBCeXRlU2l6ZS5HQikudG9GaXhlZCgyKX1HQiBmcmVlKWApO1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRvdXRwdXQucHVzaChgTG9hZCAoYXZnKTogICAgICAgJHtvc0xpYi5sb2FkYXZnKCkubWFwKGwgPT4gTWF0aC5yb3VuZChsKSkuam9pbignLCAnKX1gKTsgLy8gb25seSBwcm92aWRlZCBvbiBMaW51eC9tYWNPU1xuXHRcdH1cblx0XHRvdXRwdXQucHVzaChgVk06ICAgICAgICAgICAgICAgJHtNYXRoLnJvdW5kKCh2aXJ0dWFsTWFjaGluZUhpbnQudmFsdWUoKSAqIDEwMCkpfSVgKTtcblx0XHRvdXRwdXQucHVzaChgU2NyZWVuIFJlYWRlcjogICAgJHtpbmZvLnNjcmVlblJlYWRlciA/ICd5ZXMnIDogJ25vJ31gKTtcblx0XHRvdXRwdXQucHVzaChgUHJvY2VzcyBBcmd2OiAgICAgJHtpbmZvLm1haW5Bcmd1bWVudHMuam9pbignICcpfWApO1xuXHRcdG91dHB1dC5wdXNoKGBHUFUgU3RhdHVzOiAgICAgICAke3RoaXMuZXhwYW5kR1BVRmVhdHVyZXMoaW5mby5ncHVGZWF0dXJlU3RhdHVzKX1gKTtcblxuXHRcdHJldHVybiBvdXRwdXQuam9pbignXFxuJyk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZ2V0UGVyZm9ybWFuY2VJbmZvKGluZm86IElNYWluUHJvY2Vzc0RpYWdub3N0aWNzLCByZW1vdGVEYXRhOiAoSVJlbW90ZURpYWdub3N0aWNJbmZvIHwgSVJlbW90ZURpYWdub3N0aWNFcnJvcilbXSk6IFByb21pc2U8UGVyZm9ybWFuY2VJbmZvPiB7XG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKFtsaXN0UHJvY2Vzc2VzKGluZm8ubWFpblBJRCksIHRoaXMuZm9ybWF0V29ya3NwYWNlTWV0YWRhdGEoaW5mbyldKS50aGVuKGFzeW5jIHJlc3VsdCA9PiB7XG5cdFx0XHRsZXQgW3Jvb3RQcm9jZXNzLCB3b3Jrc3BhY2VJbmZvXSA9IHJlc3VsdDtcblx0XHRcdGxldCBwcm9jZXNzSW5mbyA9IHRoaXMuZm9ybWF0UHJvY2Vzc0xpc3QoaW5mbywgcm9vdFByb2Nlc3MpO1xuXG5cdFx0XHRyZW1vdGVEYXRhLmZvckVhY2goZGlhZ25vc3RpY3MgPT4ge1xuXHRcdFx0XHRpZiAoaXNSZW1vdGVEaWFnbm9zdGljRXJyb3IoZGlhZ25vc3RpY3MpKSB7XG5cdFx0XHRcdFx0cHJvY2Vzc0luZm8gKz0gYFxcbiR7ZGlhZ25vc3RpY3MuZXJyb3JNZXNzYWdlfWA7XG5cdFx0XHRcdFx0d29ya3NwYWNlSW5mbyArPSBgXFxuJHtkaWFnbm9zdGljcy5lcnJvck1lc3NhZ2V9YDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwcm9jZXNzSW5mbyArPSBgXFxuXFxuUmVtb3RlOiAke2RpYWdub3N0aWNzLmhvc3ROYW1lfWA7XG5cdFx0XHRcdFx0aWYgKGRpYWdub3N0aWNzLnByb2Nlc3Nlcykge1xuXHRcdFx0XHRcdFx0cHJvY2Vzc0luZm8gKz0gYFxcbiR7dGhpcy5mb3JtYXRQcm9jZXNzTGlzdChpbmZvLCBkaWFnbm9zdGljcy5wcm9jZXNzZXMpfWA7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGRpYWdub3N0aWNzLndvcmtzcGFjZU1ldGFkYXRhKSB7XG5cdFx0XHRcdFx0XHR3b3Jrc3BhY2VJbmZvICs9IGBcXG58ICBSZW1vdGU6ICR7ZGlhZ25vc3RpY3MuaG9zdE5hbWV9YDtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIE9iamVjdC5rZXlzKGRpYWdub3N0aWNzLndvcmtzcGFjZU1ldGFkYXRhKSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBtZXRhZGF0YSA9IGRpYWdub3N0aWNzLndvcmtzcGFjZU1ldGFkYXRhW2ZvbGRlcl07XG5cblx0XHRcdFx0XHRcdFx0bGV0IGNvdW50TWVzc2FnZSA9IGAke21ldGFkYXRhLmZpbGVDb3VudH0gZmlsZXNgO1xuXHRcdFx0XHRcdFx0XHRpZiAobWV0YWRhdGEubWF4RmlsZXNSZWFjaGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y291bnRNZXNzYWdlID0gYG1vcmUgdGhhbiAke2NvdW50TWVzc2FnZX1gO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0d29ya3NwYWNlSW5mbyArPSBgfCAgICBGb2xkZXIgKCR7Zm9sZGVyfSk6ICR7Y291bnRNZXNzYWdlfWA7XG5cdFx0XHRcdFx0XHRcdHdvcmtzcGFjZUluZm8gKz0gdGhpcy5mb3JtYXRXb3Jrc3BhY2VTdGF0cyhtZXRhZGF0YSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cHJvY2Vzc0luZm8sXG5cdFx0XHRcdHdvcmtzcGFjZUluZm9cblx0XHRcdH07XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZ2V0U3lzdGVtSW5mbyhpbmZvOiBJTWFpblByb2Nlc3NEaWFnbm9zdGljcywgcmVtb3RlRGF0YTogKElSZW1vdGVEaWFnbm9zdGljSW5mbyB8IElSZW1vdGVEaWFnbm9zdGljRXJyb3IpW10pOiBQcm9taXNlPFN5c3RlbUluZm8+IHtcblx0XHRjb25zdCB7IG1lbW9yeSwgdm1IaW50LCBvcywgY3B1cyB9ID0gZ2V0TWFjaGluZUluZm8oKTtcblx0XHRjb25zdCBzeXN0ZW1JbmZvOiBTeXN0ZW1JbmZvID0ge1xuXHRcdFx0b3MsXG5cdFx0XHRtZW1vcnksXG5cdFx0XHRjcHVzLFxuXHRcdFx0dm1IaW50LFxuXHRcdFx0cHJvY2Vzc0FyZ3M6IGAke2luZm8ubWFpbkFyZ3VtZW50cy5qb2luKCcgJyl9YCxcblx0XHRcdGdwdVN0YXR1czogaW5mby5ncHVGZWF0dXJlU3RhdHVzLFxuXHRcdFx0c2NyZWVuUmVhZGVyOiBgJHtpbmZvLnNjcmVlblJlYWRlciA/ICd5ZXMnIDogJ25vJ31gLFxuXHRcdFx0cmVtb3RlRGF0YVxuXHRcdH07XG5cblx0XHRpZiAoIWlzV2luZG93cykge1xuXHRcdFx0c3lzdGVtSW5mby5sb2FkID0gYCR7b3NMaWIubG9hZGF2ZygpLm1hcChsID0+IE1hdGgucm91bmQobCkpLmpvaW4oJywgJyl9YDtcblx0XHR9XG5cblx0XHRpZiAoaXNMaW51eCkge1xuXHRcdFx0c3lzdGVtSW5mby5saW51eEVudiA9IHtcblx0XHRcdFx0ZGVza3RvcFNlc3Npb246IHByb2Nlc3MuZW52WydERVNLVE9QX1NFU1NJT04nXSxcblx0XHRcdFx0eGRnU2Vzc2lvbkRlc2t0b3A6IHByb2Nlc3MuZW52WydYREdfU0VTU0lPTl9ERVNLVE9QJ10sXG5cdFx0XHRcdHhkZ0N1cnJlbnREZXNrdG9wOiBwcm9jZXNzLmVudlsnWERHX0NVUlJFTlRfREVTS1RPUCddLFxuXHRcdFx0XHR4ZGdTZXNzaW9uVHlwZTogcHJvY2Vzcy5lbnZbJ1hER19TRVNTSU9OX1RZUEUnXVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHN5c3RlbUluZm8pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldERpYWdub3N0aWNzKGluZm86IElNYWluUHJvY2Vzc0RpYWdub3N0aWNzLCByZW1vdGVEaWFnbm9zdGljczogKElSZW1vdGVEaWFnbm9zdGljSW5mbyB8IElSZW1vdGVEaWFnbm9zdGljRXJyb3IpW10pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IG91dHB1dDogc3RyaW5nW10gPSBbXTtcblx0XHRyZXR1cm4gbGlzdFByb2Nlc3NlcyhpbmZvLm1haW5QSUQpLnRoZW4oYXN5bmMgcm9vdFByb2Nlc3MgPT4ge1xuXG5cdFx0XHQvLyBFbnZpcm9ubWVudCBJbmZvXG5cdFx0XHRvdXRwdXQucHVzaCgnJyk7XG5cdFx0XHRvdXRwdXQucHVzaCh0aGlzLmZvcm1hdEVudmlyb25tZW50KGluZm8pKTtcblxuXHRcdFx0Ly8gUHJvY2VzcyBMaXN0XG5cdFx0XHRvdXRwdXQucHVzaCgnJyk7XG5cdFx0XHRvdXRwdXQucHVzaCh0aGlzLmZvcm1hdFByb2Nlc3NMaXN0KGluZm8sIHJvb3RQcm9jZXNzKSk7XG5cblx0XHRcdC8vIFdvcmtzcGFjZSBTdGF0c1xuXHRcdFx0aWYgKGluZm8ud2luZG93cy5zb21lKHdpbmRvdyA9PiB3aW5kb3cuZm9sZGVyVVJJcyAmJiB3aW5kb3cuZm9sZGVyVVJJcy5sZW5ndGggPiAwICYmICF3aW5kb3cucmVtb3RlQXV0aG9yaXR5KSkge1xuXHRcdFx0XHRvdXRwdXQucHVzaCgnJyk7XG5cdFx0XHRcdG91dHB1dC5wdXNoKCdXb3Jrc3BhY2UgU3RhdHM6ICcpO1xuXHRcdFx0XHRvdXRwdXQucHVzaChhd2FpdCB0aGlzLmZvcm1hdFdvcmtzcGFjZU1ldGFkYXRhKGluZm8pKTtcblx0XHRcdH1cblxuXHRcdFx0cmVtb3RlRGlhZ25vc3RpY3MuZm9yRWFjaChkaWFnbm9zdGljcyA9PiB7XG5cdFx0XHRcdGlmIChpc1JlbW90ZURpYWdub3N0aWNFcnJvcihkaWFnbm9zdGljcykpIHtcblx0XHRcdFx0XHRvdXRwdXQucHVzaChgXFxuJHtkaWFnbm9zdGljcy5lcnJvck1lc3NhZ2V9YCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goJ1xcblxcbicpO1xuXHRcdFx0XHRcdG91dHB1dC5wdXNoKGBSZW1vdGU6ICAgICAgICAgICAke2RpYWdub3N0aWNzLmhvc3ROYW1lfWApO1xuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHRoaXMuZm9ybWF0TWFjaGluZUluZm8oZGlhZ25vc3RpY3MubWFjaGluZUluZm8pKTtcblxuXHRcdFx0XHRcdGlmIChkaWFnbm9zdGljcy5wcm9jZXNzZXMpIHtcblx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKHRoaXMuZm9ybWF0UHJvY2Vzc0xpc3QoaW5mbywgZGlhZ25vc3RpY3MucHJvY2Vzc2VzKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKGRpYWdub3N0aWNzLndvcmtzcGFjZU1ldGFkYXRhKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGZvbGRlciBvZiBPYmplY3Qua2V5cyhkaWFnbm9zdGljcy53b3Jrc3BhY2VNZXRhZGF0YSkpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbWV0YWRhdGEgPSBkaWFnbm9zdGljcy53b3Jrc3BhY2VNZXRhZGF0YVtmb2xkZXJdO1xuXG5cdFx0XHRcdFx0XHRcdGxldCBjb3VudE1lc3NhZ2UgPSBgJHttZXRhZGF0YS5maWxlQ291bnR9IGZpbGVzYDtcblx0XHRcdFx0XHRcdFx0aWYgKG1ldGFkYXRhLm1heEZpbGVzUmVhY2hlZCkge1xuXHRcdFx0XHRcdFx0XHRcdGNvdW50TWVzc2FnZSA9IGBtb3JlIHRoYW4gJHtjb3VudE1lc3NhZ2V9YDtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKGBGb2xkZXIgKCR7Zm9sZGVyfSk6ICR7Y291bnRNZXNzYWdlfWApO1xuXHRcdFx0XHRcdFx0XHRvdXRwdXQucHVzaCh0aGlzLmZvcm1hdFdvcmtzcGFjZVN0YXRzKG1ldGFkYXRhKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0b3V0cHV0LnB1c2goJycpO1xuXHRcdFx0b3V0cHV0LnB1c2goJycpO1xuXG5cdFx0XHRyZXR1cm4gb3V0cHV0LmpvaW4oJ1xcbicpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBmb3JtYXRXb3Jrc3BhY2VTdGF0cyh3b3Jrc3BhY2VTdGF0czogV29ya3NwYWNlU3RhdHMpOiBzdHJpbmcge1xuXHRcdGNvbnN0IG91dHB1dDogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBsaW5lTGVuZ3RoID0gNjA7XG5cdFx0bGV0IGNvbCA9IDA7XG5cblx0XHRjb25zdCBhcHBlbmRBbmRXcmFwID0gKG5hbWU6IHN0cmluZywgY291bnQ6IG51bWJlcikgPT4ge1xuXHRcdFx0Y29uc3QgaXRlbSA9IGAgJHtuYW1lfSgke2NvdW50fSlgO1xuXG5cdFx0XHRpZiAoY29sICsgaXRlbS5sZW5ndGggPiBsaW5lTGVuZ3RoKSB7XG5cdFx0XHRcdG91dHB1dC5wdXNoKGxpbmUpO1xuXHRcdFx0XHRsaW5lID0gJ3wgICAgICAgICAgICAgICAgICc7XG5cdFx0XHRcdGNvbCA9IGxpbmUubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbCArPSBpdGVtLmxlbmd0aDtcblx0XHRcdH1cblx0XHRcdGxpbmUgKz0gaXRlbTtcblx0XHR9O1xuXG5cdFx0Ly8gRmlsZSBUeXBlc1xuXHRcdGxldCBsaW5lID0gJ3wgICAgICBGaWxlIHR5cGVzOic7XG5cdFx0Y29uc3QgbWF4U2hvd24gPSAxMDtcblx0XHRjb25zdCBtYXggPSB3b3Jrc3BhY2VTdGF0cy5maWxlVHlwZXMubGVuZ3RoID4gbWF4U2hvd24gPyBtYXhTaG93biA6IHdvcmtzcGFjZVN0YXRzLmZpbGVUeXBlcy5sZW5ndGg7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtYXg7IGkrKykge1xuXHRcdFx0Y29uc3QgaXRlbSA9IHdvcmtzcGFjZVN0YXRzLmZpbGVUeXBlc1tpXTtcblx0XHRcdGFwcGVuZEFuZFdyYXAoaXRlbS5uYW1lLCBpdGVtLmNvdW50KTtcblx0XHR9XG5cdFx0b3V0cHV0LnB1c2gobGluZSk7XG5cblx0XHQvLyBDb25mIEZpbGVzXG5cdFx0aWYgKHdvcmtzcGFjZVN0YXRzLmNvbmZpZ0ZpbGVzLmxlbmd0aCA+PSAwKSB7XG5cdFx0XHRsaW5lID0gJ3wgICAgICBDb25mIGZpbGVzOic7XG5cdFx0XHRjb2wgPSAwO1xuXHRcdFx0d29ya3NwYWNlU3RhdHMuY29uZmlnRmlsZXMuZm9yRWFjaCgoaXRlbSkgPT4ge1xuXHRcdFx0XHRhcHBlbmRBbmRXcmFwKGl0ZW0ubmFtZSwgaXRlbS5jb3VudCk7XG5cdFx0XHR9KTtcblx0XHRcdG91dHB1dC5wdXNoKGxpbmUpO1xuXHRcdH1cblxuXHRcdGlmICh3b3Jrc3BhY2VTdGF0cy5sYXVuY2hDb25maWdGaWxlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRsZXQgbGluZSA9ICd8ICAgICAgTGF1bmNoIENvbmZpZ3M6Jztcblx0XHRcdHdvcmtzcGFjZVN0YXRzLmxhdW5jaENvbmZpZ0ZpbGVzLmZvckVhY2goZWFjaCA9PiB7XG5cdFx0XHRcdGNvbnN0IGl0ZW0gPSBlYWNoLmNvdW50ID4gMSA/IGAgJHtlYWNoLm5hbWV9KCR7ZWFjaC5jb3VudH0pYCA6IGAgJHtlYWNoLm5hbWV9YDtcblx0XHRcdFx0bGluZSArPSBpdGVtO1xuXHRcdFx0fSk7XG5cdFx0XHRvdXRwdXQucHVzaChsaW5lKTtcblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dC5qb2luKCdcXG4nKTtcblx0fVxuXG5cdHByaXZhdGUgZXhwYW5kR1BVRmVhdHVyZXMoZ3B1RmVhdHVyZXM6IGFueSk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbG9uZ2VzdEZlYXR1cmVOYW1lID0gTWF0aC5tYXgoLi4uT2JqZWN0LmtleXMoZ3B1RmVhdHVyZXMpLm1hcChmZWF0dXJlID0+IGZlYXR1cmUubGVuZ3RoKSk7XG5cdFx0Ly8gTWFrZSBjb2x1bW5zIGFsaWduZWQgYnkgYWRkaW5nIHNwYWNlcyBhZnRlciBmZWF0dXJlIG5hbWVcblx0XHRyZXR1cm4gT2JqZWN0LmtleXMoZ3B1RmVhdHVyZXMpLm1hcChmZWF0dXJlID0+IGAke2ZlYXR1cmV9OiAgJHsnICcucmVwZWF0KGxvbmdlc3RGZWF0dXJlTmFtZSAtIGZlYXR1cmUubGVuZ3RoKX0gICR7Z3B1RmVhdHVyZXNbZmVhdHVyZV19YCkuam9pbignXFxuICAgICAgICAgICAgICAgICAgJyk7XG5cdH1cblxuXHRwcml2YXRlIGZvcm1hdFdvcmtzcGFjZU1ldGFkYXRhKGluZm86IElNYWluUHJvY2Vzc0RpYWdub3N0aWNzKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBvdXRwdXQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgd29ya3NwYWNlU3RhdFByb21pc2VzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblxuXHRcdGluZm8ud2luZG93cy5mb3JFYWNoKHdpbmRvdyA9PiB7XG5cdFx0XHRpZiAod2luZG93LmZvbGRlclVSSXMubGVuZ3RoID09PSAwIHx8ICEhd2luZG93LnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdG91dHB1dC5wdXNoKGB8ICBXaW5kb3cgKCR7d2luZG93LnRpdGxlfSlgKTtcblxuXHRcdFx0d2luZG93LmZvbGRlclVSSXMuZm9yRWFjaCh1cmlDb21wb25lbnRzID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGVyVXJpID0gVVJJLnJldml2ZSh1cmlDb21wb25lbnRzKTtcblx0XHRcdFx0aWYgKGZvbGRlclVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRcdGNvbnN0IGZvbGRlciA9IGZvbGRlclVyaS5mc1BhdGg7XG5cdFx0XHRcdFx0d29ya3NwYWNlU3RhdFByb21pc2VzLnB1c2goY29sbGVjdFdvcmtzcGFjZVN0YXRzKGZvbGRlciwgWydub2RlX21vZHVsZXMnLCAnLmdpdCddKS50aGVuKHN0YXRzID0+IHtcblx0XHRcdFx0XHRcdGxldCBjb3VudE1lc3NhZ2UgPSBgJHtzdGF0cy5maWxlQ291bnR9IGZpbGVzYDtcblx0XHRcdFx0XHRcdGlmIChzdGF0cy5tYXhGaWxlc1JlYWNoZWQpIHtcblx0XHRcdFx0XHRcdFx0Y291bnRNZXNzYWdlID0gYG1vcmUgdGhhbiAke2NvdW50TWVzc2FnZX1gO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goYHwgICAgRm9sZGVyICgke2Jhc2VuYW1lKGZvbGRlcil9KTogJHtjb3VudE1lc3NhZ2V9YCk7XG5cdFx0XHRcdFx0XHRvdXRwdXQucHVzaCh0aGlzLmZvcm1hdFdvcmtzcGFjZVN0YXRzKHN0YXRzKSk7XG5cblx0XHRcdFx0XHR9KS5jYXRjaChlcnJvciA9PiB7XG5cdFx0XHRcdFx0XHRvdXRwdXQucHVzaChgfCAgICAgIEVycm9yOiBVbmFibGUgdG8gY29sbGVjdCB3b3Jrc3BhY2Ugc3RhdHMgZm9yIGZvbGRlciAke2ZvbGRlcn0gKCR7ZXJyb3IudG9TdHJpbmcoKX0pYCk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG91dHB1dC5wdXNoKGB8ICAgIEZvbGRlciAoJHtmb2xkZXJVcmkudG9TdHJpbmcoKX0pOiBXb3Jrc3BhY2Ugc3RhdHMgbm90IGF2YWlsYWJsZS5gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwod29ya3NwYWNlU3RhdFByb21pc2VzKVxuXHRcdFx0LnRoZW4oXyA9PiBvdXRwdXQuam9pbignXFxuJykpXG5cdFx0XHQuY2F0Y2goZSA9PiBgVW5hYmxlIHRvIGNvbGxlY3Qgd29ya3NwYWNlIHN0YXRzOiAke2V9YCk7XG5cdH1cblxuXHRwcml2YXRlIGZvcm1hdFByb2Nlc3NMaXN0KGluZm86IElNYWluUHJvY2Vzc0RpYWdub3N0aWNzLCByb290UHJvY2VzczogUHJvY2Vzc0l0ZW0pOiBzdHJpbmcge1xuXHRcdGNvbnN0IG1hcFByb2Nlc3NUb05hbWUgPSBuZXcgTWFwPG51bWJlciwgc3RyaW5nPigpO1xuXHRcdGluZm8ud2luZG93cy5mb3JFYWNoKHdpbmRvdyA9PiBtYXBQcm9jZXNzVG9OYW1lLnNldCh3aW5kb3cucGlkLCBgd2luZG93IFske3dpbmRvdy5pZH1dICgke3dpbmRvdy50aXRsZX0pYCkpO1xuXHRcdGluZm8ucGlkVG9OYW1lcy5mb3JFYWNoKCh7IHBpZCwgbmFtZSB9KSA9PiBtYXBQcm9jZXNzVG9OYW1lLnNldChwaWQsIG5hbWUpKTtcblxuXHRcdGNvbnN0IG91dHB1dDogc3RyaW5nW10gPSBbXTtcblxuXHRcdG91dHB1dC5wdXNoKCdDUFUgJVxcdE1lbSBNQlxcdCAgIFBJRFxcdFByb2Nlc3MnKTtcblxuXHRcdGlmIChyb290UHJvY2Vzcykge1xuXHRcdFx0dGhpcy5mb3JtYXRQcm9jZXNzSXRlbShpbmZvLm1haW5QSUQsIG1hcFByb2Nlc3NUb05hbWUsIG91dHB1dCwgcm9vdFByb2Nlc3MsIDApO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXRwdXQuam9pbignXFxuJyk7XG5cdH1cblxuXHRwcml2YXRlIGZvcm1hdFByb2Nlc3NJdGVtKG1haW5QaWQ6IG51bWJlciwgbWFwUHJvY2Vzc1RvTmFtZTogTWFwPG51bWJlciwgc3RyaW5nPiwgb3V0cHV0OiBzdHJpbmdbXSwgaXRlbTogUHJvY2Vzc0l0ZW0sIGluZGVudDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgaXNSb290ID0gKGluZGVudCA9PT0gMCk7XG5cblx0XHQvLyBGb3JtYXQgbmFtZSB3aXRoIGluZGVudFxuXHRcdGxldCBuYW1lOiBzdHJpbmc7XG5cdFx0aWYgKGlzUm9vdCkge1xuXHRcdFx0bmFtZSA9IGl0ZW0ucGlkID09PSBtYWluUGlkID8gYCR7dGhpcy5wcm9kdWN0U2VydmljZS5hcHBsaWNhdGlvbk5hbWV9IG1haW5gIDogJ3JlbW90ZSBhZ2VudCc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChtYXBQcm9jZXNzVG9OYW1lLmhhcyhpdGVtLnBpZCkpIHtcblx0XHRcdFx0bmFtZSA9IG1hcFByb2Nlc3NUb05hbWUuZ2V0KGl0ZW0ucGlkKSE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuYW1lID0gYCR7JyAgJy5yZXBlYXQoaW5kZW50KX0gJHtpdGVtLm5hbWV9YDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBtZW1vcnkgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gaXRlbS5tZW0gOiAob3NMaWIudG90YWxtZW0oKSAqIChpdGVtLm1lbSAvIDEwMCkpO1xuXHRcdG91dHB1dC5wdXNoKGAke2l0ZW0ubG9hZC50b0ZpeGVkKDApLnBhZFN0YXJ0KDUsICcgJyl9XFx0JHsobWVtb3J5IC8gQnl0ZVNpemUuTUIpLnRvRml4ZWQoMCkucGFkU3RhcnQoNiwgJyAnKX1cXHQke2l0ZW0ucGlkLnRvRml4ZWQoMCkucGFkU3RhcnQoNiwgJyAnKX1cXHQke25hbWV9YCk7XG5cblx0XHQvLyBSZWN1cnNlIGludG8gY2hpbGRyZW4gaWYgYW55XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoaXRlbS5jaGlsZHJlbikpIHtcblx0XHRcdGl0ZW0uY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiB0aGlzLmZvcm1hdFByb2Nlc3NJdGVtKG1haW5QaWQsIG1hcFByb2Nlc3NUb05hbWUsIG91dHB1dCwgY2hpbGQsIGluZGVudCArIDEpKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgZ2V0V29ya3NwYWNlRmlsZUV4dGVuc2lvbnMod29ya3NwYWNlOiBJV29ya3NwYWNlKTogUHJvbWlzZTx7IGV4dGVuc2lvbnM6IHN0cmluZ1tdIH0+IHtcblx0XHRjb25zdCBpdGVtcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdGZvciAoY29uc3QgeyB1cmkgfSBvZiB3b3Jrc3BhY2UuZm9sZGVycykge1xuXHRcdFx0Y29uc3QgZm9sZGVyVXJpID0gVVJJLnJldml2ZSh1cmkpO1xuXHRcdFx0aWYgKGZvbGRlclVyaS5zY2hlbWUgIT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGZvbGRlciA9IGZvbGRlclVyaS5mc1BhdGg7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBzdGF0cyA9IGF3YWl0IGNvbGxlY3RXb3Jrc3BhY2VTdGF0cyhmb2xkZXIsIFsnbm9kZV9tb2R1bGVzJywgJy5naXQnXSk7XG5cdFx0XHRcdHN0YXRzLmZpbGVUeXBlcy5mb3JFYWNoKGl0ZW0gPT4gaXRlbXMuYWRkKGl0ZW0ubmFtZSkpO1xuXHRcdFx0fSBjYXRjaCB7IH1cblx0XHR9XG5cdFx0cmV0dXJuIHsgZXh0ZW5zaW9uczogWy4uLml0ZW1zXSB9O1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJlcG9ydFdvcmtzcGFjZVN0YXRzKHdvcmtzcGFjZTogSVdvcmtzcGFjZUluZm9ybWF0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yIChjb25zdCB7IHVyaSB9IG9mIHdvcmtzcGFjZS5mb2xkZXJzKSB7XG5cdFx0XHRjb25zdCBmb2xkZXJVcmkgPSBVUkkucmV2aXZlKHVyaSk7XG5cdFx0XHRpZiAoZm9sZGVyVXJpLnNjaGVtZSAhPT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmb2xkZXIgPSBmb2xkZXJVcmkuZnNQYXRoO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3Qgc3RhdHMgPSBhd2FpdCBjb2xsZWN0V29ya3NwYWNlU3RhdHMoZm9sZGVyLCBbJ25vZGVfbW9kdWxlcycsICcuZ2l0J10pO1xuXHRcdFx0XHR0eXBlIFdvcmtzcGFjZVN0YXRzQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0b3duZXI6ICdscmFtb3MxNSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ01ldGFkYXRhIHJlbGF0ZWQgdG8gdGhlIHdvcmtzcGFjZSc7XG5cdFx0XHRcdFx0J3dvcmtzcGFjZS5pZCc6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdBIFVVSUQgZ2l2ZW4gdG8gYSB3b3Jrc3BhY2UgdG8gaWRlbnRpZnkgaXQuJyB9O1xuXHRcdFx0XHRcdHJlbmRlcmVyU2Vzc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIElEIG9mIHRoZSBzZXNzaW9uJyB9O1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR0eXBlIFdvcmtzcGFjZVN0YXRzRXZlbnQgPSB7XG5cdFx0XHRcdFx0J3dvcmtzcGFjZS5pZCc6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRyZW5kZXJlclNlc3Npb25JZDogc3RyaW5nO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3Jrc3BhY2VTdGF0c0V2ZW50LCBXb3Jrc3BhY2VTdGF0c0NsYXNzaWZpY2F0aW9uPignd29ya3NwYWNlLnN0YXRzJywge1xuXHRcdFx0XHRcdCd3b3Jrc3BhY2UuaWQnOiB3b3Jrc3BhY2UudGVsZW1ldHJ5SWQsXG5cdFx0XHRcdFx0cmVuZGVyZXJTZXNzaW9uSWQ6IHdvcmtzcGFjZS5yZW5kZXJlclNlc3Npb25JZFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dHlwZSBXb3Jrc3BhY2VTdGF0c0ZpbGVDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0XHRvd25lcjogJ2xyYW1vczE1Jztcblx0XHRcdFx0XHRjb21tZW50OiAnSGVscHMgdXMgZ2FpbiBpbnNpZ2h0cyBpbnRvIHdoYXQgdHlwZSBvZiBmaWxlcyBhcmUgYmVpbmcgdXNlZCBpbiBhIHdvcmtzcGFjZSc7XG5cdFx0XHRcdFx0cmVuZGVyZXJTZXNzaW9uSWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgSUQgb2YgdGhlIHNlc3Npb24uJyB9O1xuXHRcdFx0XHRcdHR5cGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgdHlwZSBvZiBmaWxlJyB9O1xuXHRcdFx0XHRcdGNvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnSG93IG1hbnkgdHlwZXMgb2YgdGhhdCBmaWxlIGFyZSBwcmVzZW50JyB9O1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR0eXBlIFdvcmtzcGFjZVN0YXRzRmlsZUV2ZW50ID0ge1xuXHRcdFx0XHRcdHJlbmRlcmVyU2Vzc2lvbklkOiBzdHJpbmc7XG5cdFx0XHRcdFx0dHlwZTogc3RyaW5nO1xuXHRcdFx0XHRcdGNvdW50OiBudW1iZXI7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHN0YXRzLmZpbGVUeXBlcy5mb3JFYWNoKGUgPT4ge1xuXHRcdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtzcGFjZVN0YXRzRmlsZUV2ZW50LCBXb3Jrc3BhY2VTdGF0c0ZpbGVDbGFzc2lmaWNhdGlvbj4oJ3dvcmtzcGFjZS5zdGF0cy5maWxlJywge1xuXHRcdFx0XHRcdFx0cmVuZGVyZXJTZXNzaW9uSWQ6IHdvcmtzcGFjZS5yZW5kZXJlclNlc3Npb25JZCxcblx0XHRcdFx0XHRcdHR5cGU6IGUubmFtZSxcblx0XHRcdFx0XHRcdGNvdW50OiBlLmNvdW50XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRzdGF0cy5sYXVuY2hDb25maWdGaWxlcy5mb3JFYWNoKGUgPT4ge1xuXHRcdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtzcGFjZVN0YXRzRmlsZUV2ZW50LCBXb3Jrc3BhY2VTdGF0c0ZpbGVDbGFzc2lmaWNhdGlvbj4oJ3dvcmtzcGFjZS5zdGF0cy5sYXVuY2hDb25maWdGaWxlJywge1xuXHRcdFx0XHRcdFx0cmVuZGVyZXJTZXNzaW9uSWQ6IHdvcmtzcGFjZS5yZW5kZXJlclNlc3Npb25JZCxcblx0XHRcdFx0XHRcdHR5cGU6IGUubmFtZSxcblx0XHRcdFx0XHRcdGNvdW50OiBlLmNvdW50XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRzdGF0cy5jb25maWdGaWxlcy5mb3JFYWNoKGUgPT4ge1xuXHRcdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtzcGFjZVN0YXRzRmlsZUV2ZW50LCBXb3Jrc3BhY2VTdGF0c0ZpbGVDbGFzc2lmaWNhdGlvbj4oJ3dvcmtzcGFjZS5zdGF0cy5jb25maWdGaWxlcycsIHtcblx0XHRcdFx0XHRcdHJlbmRlcmVyU2Vzc2lvbklkOiB3b3Jrc3BhY2UucmVuZGVyZXJTZXNzaW9uSWQsXG5cdFx0XHRcdFx0XHR0eXBlOiBlLm5hbWUsXG5cdFx0XHRcdFx0XHRjb3VudDogZS5jb3VudFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBXb3Jrc3BhY2Ugc3RhdHMgbWV0YWRhdGFcblx0XHRcdFx0dHlwZSBXb3Jrc3BhY2VTdGF0c01ldGFkYXRhQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0b3duZXI6ICdqcmlla2VuJztcblx0XHRcdFx0XHRjb21tZW50OiAnTWV0YWRhdGEgYWJvdXQgd29ya3NwYWNlIG1ldGFkYXRhIGNvbGxlY3Rpb24nO1xuXHRcdFx0XHRcdGR1cmF0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnSG93IGRpZCBpdCB0YWtlIHRvIG1ha2Ugd29ya3NwYWNlIHN0YXRzJyB9O1xuXHRcdFx0XHRcdHJlYWNoZWRMaW1pdDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ0RpZCBtYWtpbmcgd29ya3NwYWNlIHN0YXRzIHJlYWNoIGl0cyBsaW1pdHMnIH07XG5cdFx0XHRcdFx0ZmlsZUNvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnSG93IG1hbnkgZmlsZXMgZGlkIHdvcmtzcGFjZSBzdGF0cyBkaXNjb3ZlcicgfTtcblx0XHRcdFx0XHRyZWFkZGlyQ291bnQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdIb3cgbWFueSByZWFkZGlyIGNhbGwgd2VyZSBuZWVkZWQnIH07XG5cdFx0XHRcdH07XG5cdFx0XHRcdHR5cGUgV29ya3NwYWNlU3RhdHNNZXRhZGF0YSA9IHtcblx0XHRcdFx0XHRkdXJhdGlvbjogbnVtYmVyO1xuXHRcdFx0XHRcdHJlYWNoZWRMaW1pdDogYm9vbGVhbjtcblx0XHRcdFx0XHRmaWxlQ291bnQ6IG51bWJlcjtcblx0XHRcdFx0XHRyZWFkZGlyQ291bnQ6IG51bWJlcjtcblx0XHRcdFx0fTtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V29ya3NwYWNlU3RhdHNNZXRhZGF0YSwgV29ya3NwYWNlU3RhdHNNZXRhZGF0YUNsYXNzaWZpY2F0aW9uPignd29ya3NwYWNlLnN0YXRzLm1ldGFkYXRhJywgeyBkdXJhdGlvbjogc3RhdHMudG90YWxTY2FuVGltZSwgcmVhY2hlZExpbWl0OiBzdGF0cy5tYXhGaWxlc1JlYWNoZWQsIGZpbGVDb3VudDogc3RhdHMuZmlsZUNvdW50LCByZWFkZGlyQ291bnQ6IHN0YXRzLnRvdGFsUmVhZGRpckNvdW50IH0pO1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIFJlcG9ydCBub3RoaW5nIGlmIGNvbGxlY3RpbmcgbWV0YWRhdGEgZmFpbHMuXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksUUFBUTtBQUNwQixZQUFZLFdBQVc7QUFDdkIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhLGFBQXlCO0FBQy9DLFNBQVMsZUFBZTtBQUN4QixTQUFTLFVBQVUsWUFBWTtBQUMvQixTQUFTLFNBQVMsaUJBQWlCO0FBRW5DLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsV0FBVztBQUNwQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFrQixZQUFZLFdBQVc7QUFDekMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBb0gsK0JBQXNIO0FBQzFPLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBU2xDLE1BQU0sc0JBQXNCLG9CQUFJLElBQXFDO0FBQ3JFLGVBQXNCLHNCQUFzQixRQUFnQixRQUEyQztBQUN0RyxRQUFNLFdBQVcsR0FBRyxNQUFNLEtBQUssT0FBTyxLQUFLLEdBQUcsQ0FBQztBQUMvQyxRQUFNLFNBQVMsb0JBQW9CLElBQUksUUFBUTtBQUMvQyxNQUFJLFFBQVE7QUFDWCxXQUFPO0FBQUEsRUFDUjtBQUVBLFFBQU0scUJBQTJDO0FBQUEsSUFDaEQsRUFBRSxLQUFLLFlBQVksYUFBYSxtQkFBbUI7QUFBQSxJQUNuRCxFQUFFLEtBQUssV0FBVyxhQUFhLGtCQUFrQjtBQUFBLElBQ2pELEVBQUUsS0FBSyxpQkFBaUIsYUFBYSxvQkFBb0I7QUFBQSxJQUN6RCxFQUFFLEtBQUssZ0JBQWdCLGFBQWEsbUJBQW1CO0FBQUEsSUFDdkQsRUFBRSxLQUFLLGlCQUFpQixhQUFhLG9CQUFv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QUFBLE1BQ3JELFFBQVE7QUFBQSxNQUFFO0FBQUEsSUFDWDtBQUNBLFdBQU8sRUFBRSxZQUFZLENBQUMsR0FBRyxLQUFLLEVBQUU7QUFBQSxFQUNqQztBQUFBLEVBRUEsTUFBYSxxQkFBcUIsV0FBaUQ7QUFDbEYsZUFBVyxFQUFFLElBQUksS0FBSyxVQUFVLFNBQVM7QUFDeEMsWUFBTSxZQUFZLElBQUksT0FBTyxHQUFHO0FBQ2hDLFVBQUksVUFBVSxXQUFXLFFBQVEsTUFBTTtBQUN0QztBQUFBLE1BQ0Q7QUFFQSxZQUFNLFNBQVMsVUFBVTtBQUN6QixVQUFJO0FBQ0gsY0FBTSxRQUFRLE1BQU0sc0JBQXNCLFFBQVEsQ0FBQyxnQkFBZ0IsTUFBTSxDQUFDO0FBVzFFLGFBQUssaUJBQWlCLFdBQThELG1CQUFtQjtBQUFBLFVBQ3RHLGdCQUFnQixVQUFVO0FBQUEsVUFDMUIsbUJBQW1CLFVBQVU7QUFBQSxRQUM5QixDQUFDO0FBYUQsY0FBTSxVQUFVLFFBQVEsT0FBSztBQUM1QixlQUFLLGlCQUFpQixXQUFzRSx3QkFBd0I7QUFBQSxZQUNuSCxtQkFBbUIsVUFBVTtBQUFBLFlBQzdCLE1BQU0sRUFBRTtBQUFBLFlBQ1IsT0FBTyxFQUFFO0FBQUEsVUFDVixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQ0QsY0FBTSxrQkFBa0IsUUFBUSxPQUFLO0FBQ3BDLGVBQUssaUJBQWlCLFdBQXNFLG9DQUFvQztBQUFBLFlBQy9ILG1CQUFtQixVQUFVO0FBQUEsWUFDN0IsTUFBTSxFQUFFO0FBQUEsWUFDUixPQUFPLEVBQUU7QUFBQSxVQUNWLENBQUM7QUFBQSxRQUNGLENBQUM7QUFDRCxjQUFNLFlBQVksUUFBUSxPQUFLO0FBQzlCLGVBQUssaUJBQWlCLFdBQXNFLCtCQUErQjtBQUFBLFlBQzFILG1CQUFtQixVQUFVO0FBQUEsWUFDN0IsTUFBTSxFQUFFO0FBQUEsWUFDUixPQUFPLEVBQUU7QUFBQSxVQUNWLENBQUM7QUFBQSxRQUNGLENBQUM7QUFpQkQsYUFBSyxpQkFBaUIsV0FBeUUsNEJBQTRCLEVBQUUsVUFBVSxNQUFNLGVBQWUsY0FBYyxNQUFNLGlCQUFpQixXQUFXLE1BQU0sV0FBVyxjQUFjLE1BQU0sa0JBQWtCLENBQUM7QUFBQSxNQUNyUSxRQUFRO0FBQUEsTUFFUjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFyWWEscUJBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEdBTlU7IiwKICAibmFtZXMiOiBbImZpbHRlciIsICJsaW5lIl0KfQo=
