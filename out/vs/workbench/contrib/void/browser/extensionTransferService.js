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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { env } from "../../../../base/common/process.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IExtensionTransferService = createDecorator("ExtensionTransferService");
const extensionBlacklist = [
  // ignore extensions
  "ms-vscode-remote.remote",
  // ms-vscode-remote.remote-ssh, ms-vscode-remote.remote-wsl
  "ms-vscode.remote",
  // ms-vscode.remote-explorer
  // ignore other AI copilots that could conflict with Void keybindings
  "sourcegraph.cody-ai",
  "continue.continue",
  "codeium.codeium",
  "saoudrizwan.claude-dev",
  // cline
  "rooveterinaryinc.roo-cline",
  // roo
  "supermaven.supermaven"
  // supermaven
  // 'github.copilot',
];
const isBlacklisted = (fsPath) => {
  return extensionBlacklist.find((bItem) => fsPath?.includes(bItem));
};
let ExtensionTransferService = class extends Disposable {
  constructor(_fileService) {
    super();
    this._fileService = _fileService;
  }
  async transferExtensions(os, fromEditor) {
    const transferTheseFiles = transferTheseFilesOfOS(os, fromEditor);
    const fileService = this._fileService;
    let errAcc = "";
    for (const { from, to, isExtensions } of transferTheseFiles) {
      try {
        if (!isExtensions) {
          console.log("transferring item", from, to);
          const exists = await fileService.exists(from);
          if (exists) {
            const toParent = URI.joinPath(to, "..");
            const toParentExists = await fileService.exists(toParent);
            if (!toParentExists) {
              await fileService.createFolder(toParent);
            }
            await fileService.copy(from, to, true);
          } else {
            console.log(`Skipping file that doesn't exist: ${from.toString()}`);
          }
        } else {
          console.log("transferring extensions...", from, to);
          const exists = await fileService.exists(from);
          if (exists) {
            const stat = await fileService.resolve(from);
            const toParent = URI.joinPath(to);
            const toParentExists = await fileService.exists(toParent);
            if (!toParentExists) {
              await fileService.createFolder(toParent);
            }
            for (const extensionFolder of stat.children ?? []) {
              const from2 = extensionFolder.resource;
              const to2 = URI.joinPath(toParent, extensionFolder.name);
              const toStat = await fileService.resolve(from2);
              if (toStat.isDirectory) {
                if (!isBlacklisted(extensionFolder.resource.fsPath)) {
                  await fileService.copy(from2, to2, true);
                }
              } else if (toStat.isFile) {
                if (extensionFolder.name === "extensions.json") {
                  try {
                    const contentsStr = await fileService.readFile(from2);
                    const json = JSON.parse(contentsStr.value.toString());
                    const j2 = json.filter((entry) => !isBlacklisted(entry?.identifier?.id));
                    const jsonStr = JSON.stringify(j2);
                    await fileService.writeFile(to2, VSBuffer.fromString(jsonStr));
                  } catch {
                    console.log("Error copying extensions.json, skipping");
                  }
                }
              }
            }
          } else {
            console.log(`Skipping file that doesn't exist: ${from.toString()}`);
          }
          console.log("done transferring extensions.");
        }
      } catch (e) {
        console.error("Error copying file:", e);
        errAcc += `Error copying ${from.toString()}: ${e}
`;
      }
    }
    if (errAcc) return errAcc;
    return void 0;
  }
  async deleteBlacklistExtensions(os) {
    const fileService = this._fileService;
    const extensionsURI = getExtensionsFolder(os);
    if (!extensionsURI) return;
    const eURI = await fileService.resolve(extensionsURI);
    for (const child of eURI.children ?? []) {
      try {
        if (child.isDirectory) {
          if (isBlacklisted(child.resource.fsPath)) {
            console.log("Deleting extension", child.resource.fsPath);
            await fileService.del(child.resource, { recursive: true, useTrash: true });
          }
        } else if (child.isFile) {
          if (child.name === "extensions.json") {
            console.log("Updating extensions.json", child.resource.fsPath);
            try {
              const contentsStr = await fileService.readFile(child.resource);
              const json = JSON.parse(contentsStr.value.toString());
              const j2 = json.filter((entry) => !isBlacklisted(entry?.identifier?.id));
              const jsonStr = JSON.stringify(j2);
              await fileService.writeFile(child.resource, VSBuffer.fromString(jsonStr));
            } catch {
              console.log("Error copying extensions.json, skipping");
            }
          }
        }
      } catch (e) {
        console.error("Could not delete extension", child.resource.fsPath, e);
      }
    }
  }
};
ExtensionTransferService = __decorateClass([
  __decorateParam(0, IFileService)
], ExtensionTransferService);
registerSingleton(IExtensionTransferService, ExtensionTransferService, InstantiationType.Eager);
const transferTheseFilesOfOS = (os, fromEditor = "VS Code") => {
  if (os === null)
    throw new Error(`One-click switch is not possible in this environment.`);
  if (os === "mac") {
    const homeDir = env["HOME"];
    if (!homeDir) throw new Error(`$HOME not found`);
    if (fromEditor === "VS Code") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Code", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Code", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".vscode", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".plaxio", "extensions"),
        isExtensions: true
      }];
    } else if (fromEditor === "Cursor") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Cursor", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Cursor", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".cursor", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".plaxio", "extensions"),
        isExtensions: true
      }];
    } else if (fromEditor === "Windsurf") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Windsurf", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Windsurf", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, "Library", "Application Support", "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".windsurf", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".plaxio", "extensions"),
        isExtensions: true
      }];
    }
  }
  if (os === "linux") {
    const homeDir = env["HOME"];
    if (!homeDir) throw new Error(`variable for $HOME location not found`);
    if (fromEditor === "VS Code") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Code", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Code", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".vscode", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".plaxio", "extensions"),
        isExtensions: true
      }];
    } else if (fromEditor === "Cursor") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Cursor", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Cursor", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".cursor", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".plaxio", "extensions"),
        isExtensions: true
      }];
    } else if (fromEditor === "Windsurf") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Windsurf", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Windsurf", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".config", "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".windsurf", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), homeDir, ".plaxio", "extensions"),
        isExtensions: true
      }];
    }
  }
  if (os === "windows") {
    const appdata = env["APPDATA"];
    if (!appdata) throw new Error(`variable for %APPDATA% location not found`);
    const userprofile = env["USERPROFILE"];
    if (!userprofile) throw new Error(`variable for %USERPROFILE% location not found`);
    if (fromEditor === "VS Code") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Code", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Code", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), userprofile, ".vscode", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), userprofile, ".plaxio", "extensions"),
        isExtensions: true
      }];
    } else if (fromEditor === "Cursor") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Cursor", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Cursor", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), userprofile, ".cursor", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), userprofile, ".plaxio", "extensions"),
        isExtensions: true
      }];
    } else if (fromEditor === "Windsurf") {
      return [{
        from: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Windsurf", "User", "settings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Void", "User", "settings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Windsurf", "User", "keybindings.json"),
        to: URI.joinPath(URI.from({ scheme: "file" }), appdata, "Void", "User", "keybindings.json")
      }, {
        from: URI.joinPath(URI.from({ scheme: "file" }), userprofile, ".windsurf", "extensions"),
        to: URI.joinPath(URI.from({ scheme: "file" }), userprofile, ".plaxio", "extensions"),
        isExtensions: true
      }];
    }
  }
  throw new Error(`os '${os}' not recognized or editor type '${fromEditor}' not supported for this OS`);
};
const getExtensionsFolder = (os) => {
  const t = transferTheseFilesOfOS(os, "VS Code");
  return t.find((f) => f.isExtensions)?.to;
};
export {
  IExtensionTransferService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvZXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnYgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFRyYW5zZmVyRWRpdG9yVHlwZSwgVHJhbnNmZXJGaWxlc0luZm8gfSBmcm9tICcuL2V4dGVuc2lvblRyYW5zZmVyVHlwZXMuanMnO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dGVuc2lvblRyYW5zZmVyU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDsgLy8gc2VydmljZXMgbmVlZCB0aGlzLCBqdXN0IGxlYXZlIGl0IHVuZGVmaW5lZFxuXHR0cmFuc2ZlckV4dGVuc2lvbnMob3M6ICdtYWMnIHwgJ3dpbmRvd3MnIHwgJ2xpbnV4JyB8IG51bGwsIGZyb21FZGl0b3I6IFRyYW5zZmVyRWRpdG9yVHlwZSk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPlxuXHRkZWxldGVCbGFja2xpc3RFeHRlbnNpb25zKG9zOiAnbWFjJyB8ICd3aW5kb3dzJyB8ICdsaW51eCcgfCBudWxsKTogUHJvbWlzZTx2b2lkPlxuXG59XG5cbmV4cG9ydCBjb25zdCBJRXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElFeHRlbnNpb25UcmFuc2ZlclNlcnZpY2U+KCdFeHRlbnNpb25UcmFuc2ZlclNlcnZpY2UnKTtcblxuXG5cblxuXG4vLyBEZWZpbmUgZXh0ZW5zaW9ucyB0byBza2lwIHdoZW4gdHJhbnNmZXJyaW5nXG5jb25zdCBleHRlbnNpb25CbGFja2xpc3QgPSBbXG5cdC8vIGlnbm9yZSBleHRlbnNpb25zXG5cdCdtcy12c2NvZGUtcmVtb3RlLnJlbW90ZScsIC8vIG1zLXZzY29kZS1yZW1vdGUucmVtb3RlLXNzaCwgbXMtdnNjb2RlLXJlbW90ZS5yZW1vdGUtd3NsXG5cdCdtcy12c2NvZGUucmVtb3RlJywgLy8gbXMtdnNjb2RlLnJlbW90ZS1leHBsb3JlclxuXHQvLyBpZ25vcmUgb3RoZXIgQUkgY29waWxvdHMgdGhhdCBjb3VsZCBjb25mbGljdCB3aXRoIFZvaWQga2V5YmluZGluZ3Ncblx0J3NvdXJjZWdyYXBoLmNvZHktYWknLFxuXHQnY29udGludWUuY29udGludWUnLFxuXHQnY29kZWl1bS5jb2RlaXVtJyxcblx0J3Nhb3Vkcml6d2FuLmNsYXVkZS1kZXYnLCAvLyBjbGluZVxuXHQncm9vdmV0ZXJpbmFyeWluYy5yb28tY2xpbmUnLCAvLyByb29cblx0J3N1cGVybWF2ZW4uc3VwZXJtYXZlbicgLy8gc3VwZXJtYXZlblxuXHQvLyAnZ2l0aHViLmNvcGlsb3QnLFxuXTtcblxuXG5jb25zdCBpc0JsYWNrbGlzdGVkID0gKGZzUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkKSA9PiB7XG5cdHJldHVybiBleHRlbnNpb25CbGFja2xpc3QuZmluZChiSXRlbSA9PiBmc1BhdGg/LmluY2x1ZGVzKGJJdGVtKSlcbn1cblxuY2xhc3MgRXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRlbnNpb25UcmFuc2ZlclNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpXG5cdH1cblxuXHRhc3luYyB0cmFuc2ZlckV4dGVuc2lvbnMob3M6ICdtYWMnIHwgJ3dpbmRvd3MnIHwgJ2xpbnV4JyB8IG51bGwsIGZyb21FZGl0b3I6IFRyYW5zZmVyRWRpdG9yVHlwZSkge1xuXHRcdGNvbnN0IHRyYW5zZmVyVGhlc2VGaWxlcyA9IHRyYW5zZmVyVGhlc2VGaWxlc09mT1Mob3MsIGZyb21FZGl0b3IpXG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSB0aGlzLl9maWxlU2VydmljZVxuXG5cdFx0bGV0IGVyckFjYyA9ICcnXG5cblx0XHRmb3IgKGNvbnN0IHsgZnJvbSwgdG8sIGlzRXh0ZW5zaW9ucyB9IG9mIHRyYW5zZmVyVGhlc2VGaWxlcykge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIHNvdXJjZSBmaWxlIGV4aXN0cyBiZWZvcmUgYXR0ZW1wdGluZyB0byBjb3B5XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoIWlzRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCd0cmFuc2ZlcnJpbmcgaXRlbScsIGZyb20sIHRvKVxuXG5cdFx0XHRcdFx0Y29uc3QgZXhpc3RzID0gYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGZyb20pXG5cdFx0XHRcdFx0aWYgKGV4aXN0cykge1xuXHRcdFx0XHRcdFx0Ly8gRW5zdXJlIHRoZSBkZXN0aW5hdGlvbiBkaXJlY3RvcnkgZXhpc3RzXG5cdFx0XHRcdFx0XHRjb25zdCB0b1BhcmVudCA9IFVSSS5qb2luUGF0aCh0bywgJy4uJylcblx0XHRcdFx0XHRcdGNvbnN0IHRvUGFyZW50RXhpc3RzID0gYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKHRvUGFyZW50KVxuXHRcdFx0XHRcdFx0aWYgKCF0b1BhcmVudEV4aXN0cykge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGb2xkZXIodG9QYXJlbnQpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jb3B5KGZyb20sIHRvLCB0cnVlKVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgU2tpcHBpbmcgZmlsZSB0aGF0IGRvZXNuJ3QgZXhpc3Q6ICR7ZnJvbS50b1N0cmluZygpfWApXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIGV4dGVuc2lvbnMgZm9sZGVyXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCd0cmFuc2ZlcnJpbmcgZXh0ZW5zaW9ucy4uLicsIGZyb20sIHRvKVxuXHRcdFx0XHRcdGNvbnN0IGV4aXN0cyA9IGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhmcm9tKVxuXHRcdFx0XHRcdGlmIChleGlzdHMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGZyb20pXG5cdFx0XHRcdFx0XHRjb25zdCB0b1BhcmVudCA9IFVSSS5qb2luUGF0aCh0bykgLy8gZXh0ZW5zaW9ucy9cblx0XHRcdFx0XHRcdGNvbnN0IHRvUGFyZW50RXhpc3RzID0gYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKHRvUGFyZW50KVxuXHRcdFx0XHRcdFx0aWYgKCF0b1BhcmVudEV4aXN0cykge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGb2xkZXIodG9QYXJlbnQpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbkZvbGRlciBvZiBzdGF0LmNoaWxkcmVuID8/IFtdKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGZyb20gPSBleHRlbnNpb25Gb2xkZXIucmVzb3VyY2Vcblx0XHRcdFx0XHRcdFx0Y29uc3QgdG8gPSBVUkkuam9pblBhdGgodG9QYXJlbnQsIGV4dGVuc2lvbkZvbGRlci5uYW1lKVxuXHRcdFx0XHRcdFx0XHRjb25zdCB0b1N0YXQgPSBhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGZyb20pXG5cblx0XHRcdFx0XHRcdFx0aWYgKHRvU3RhdC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmICghaXNCbGFja2xpc3RlZChleHRlbnNpb25Gb2xkZXIucmVzb3VyY2UuZnNQYXRoKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgZmlsZVNlcnZpY2UuY29weShmcm9tLCB0bywgdHJ1ZSlcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZWxzZSBpZiAodG9TdGF0LmlzRmlsZSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChleHRlbnNpb25Gb2xkZXIubmFtZSA9PT0gJ2V4dGVuc2lvbnMuanNvbicpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IGNvbnRlbnRzU3RyID0gYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoZnJvbSlcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QganNvbjogYW55ID0gSlNPTi5wYXJzZShjb250ZW50c1N0ci52YWx1ZS50b1N0cmluZygpKVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBqMiA9IGpzb24uZmlsdGVyKChlbnRyeTogeyBpZGVudGlmaWVyPzogeyBpZD86IHN0cmluZyB9IH0pID0+ICFpc0JsYWNrbGlzdGVkKGVudHJ5Py5pZGVudGlmaWVyPy5pZCkpXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IGpzb25TdHIgPSBKU09OLnN0cmluZ2lmeShqMilcblx0XHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRvLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGpzb25TdHIpKVxuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0Y2F0Y2gge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnRXJyb3IgY29weWluZyBleHRlbnNpb25zLmpzb24sIHNraXBwaW5nJylcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgU2tpcHBpbmcgZmlsZSB0aGF0IGRvZXNuJ3QgZXhpc3Q6ICR7ZnJvbS50b1N0cmluZygpfWApXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdkb25lIHRyYW5zZmVycmluZyBleHRlbnNpb25zLicpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNhdGNoIChlKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNvcHlpbmcgZmlsZTonLCBlKVxuXHRcdFx0XHRlcnJBY2MgKz0gYEVycm9yIGNvcHlpbmcgJHtmcm9tLnRvU3RyaW5nKCl9OiAke2V9XFxuYFxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlcnJBY2MpIHJldHVybiBlcnJBY2Ncblx0XHRyZXR1cm4gdW5kZWZpbmVkXG5cdH1cblxuXHRhc3luYyBkZWxldGVCbGFja2xpc3RFeHRlbnNpb25zKG9zOiAnbWFjJyB8ICd3aW5kb3dzJyB8ICdsaW51eCcgfCBudWxsKSB7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSB0aGlzLl9maWxlU2VydmljZVxuXHRcdGNvbnN0IGV4dGVuc2lvbnNVUkkgPSBnZXRFeHRlbnNpb25zRm9sZGVyKG9zKVxuXHRcdGlmICghZXh0ZW5zaW9uc1VSSSkgcmV0dXJuXG5cdFx0Y29uc3QgZVVSSSA9IGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoZXh0ZW5zaW9uc1VSSSlcblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGVVUkkuY2hpbGRyZW4gPz8gW10pIHtcblxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoY2hpbGQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHQvLyBpZiBpcyBibGFja2xpc3RlZFxuXHRcdFx0XHRcdGlmIChpc0JsYWNrbGlzdGVkKGNoaWxkLnJlc291cmNlLmZzUGF0aCkpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdEZWxldGluZyBleHRlbnNpb24nLCBjaGlsZC5yZXNvdXJjZS5mc1BhdGgpXG5cdFx0XHRcdFx0XHRhd2FpdCBmaWxlU2VydmljZS5kZWwoY2hpbGQucmVzb3VyY2UsIHsgcmVjdXJzaXZlOiB0cnVlLCB1c2VUcmFzaDogdHJ1ZSB9KVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChjaGlsZC5pc0ZpbGUpIHtcblx0XHRcdFx0XHQvLyBpZiBpcyBleHRlbnNpb25zLmpzb25cblxuXHRcdFx0XHRcdGlmIChjaGlsZC5uYW1lID09PSAnZXh0ZW5zaW9ucy5qc29uJykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ1VwZGF0aW5nIGV4dGVuc2lvbnMuanNvbicsIGNoaWxkLnJlc291cmNlLmZzUGF0aClcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbnRlbnRzU3RyID0gYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoY2hpbGQucmVzb3VyY2UpXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGpzb246IGFueSA9IEpTT04ucGFyc2UoY29udGVudHNTdHIudmFsdWUudG9TdHJpbmcoKSlcblx0XHRcdFx0XHRcdFx0Y29uc3QgajIgPSBqc29uLmZpbHRlcigoZW50cnk6IHsgaWRlbnRpZmllcj86IHsgaWQ/OiBzdHJpbmcgfSB9KSA9PiAhaXNCbGFja2xpc3RlZChlbnRyeT8uaWRlbnRpZmllcj8uaWQpKVxuXHRcdFx0XHRcdFx0XHRjb25zdCBqc29uU3RyID0gSlNPTi5zdHJpbmdpZnkoajIpXG5cdFx0XHRcdFx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShjaGlsZC5yZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhqc29uU3RyKSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNhdGNoIHtcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0Vycm9yIGNvcHlpbmcgZXh0ZW5zaW9ucy5qc29uLCBza2lwcGluZycpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjYXRjaCAoZSkge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCdDb3VsZCBub3QgZGVsZXRlIGV4dGVuc2lvbicsIGNoaWxkLnJlc291cmNlLmZzUGF0aCwgZSlcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuXG5yZWdpc3RlclNpbmdsZXRvbihJRXh0ZW5zaW9uVHJhbnNmZXJTZXJ2aWNlLCBFeHRlbnNpb25UcmFuc2ZlclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTsgLy8gbGF6aWx5IGxvYWRlZCwgZXZlbiBpZiBFYWdlclxuXG5cblxuXG5cblxuXG5cblxuY29uc3QgdHJhbnNmZXJUaGVzZUZpbGVzT2ZPUyA9IChvczogJ21hYycgfCAnd2luZG93cycgfCAnbGludXgnIHwgbnVsbCwgZnJvbUVkaXRvcjogVHJhbnNmZXJFZGl0b3JUeXBlID0gJ1ZTIENvZGUnKTogVHJhbnNmZXJGaWxlc0luZm8gPT4ge1xuXHRpZiAob3MgPT09IG51bGwpXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBPbmUtY2xpY2sgc3dpdGNoIGlzIG5vdCBwb3NzaWJsZSBpbiB0aGlzIGVudmlyb25tZW50LmApXG5cdGlmIChvcyA9PT0gJ21hYycpIHtcblx0XHRjb25zdCBob21lRGlyID0gZW52WydIT01FJ11cblx0XHRpZiAoIWhvbWVEaXIpIHRocm93IG5ldyBFcnJvcihgJEhPTUUgbm90IGZvdW5kYClcblxuXHRcdGlmIChmcm9tRWRpdG9yID09PSAnVlMgQ29kZScpIHtcblx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRmcm9tOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJ0xpYnJhcnknLCAnQXBwbGljYXRpb24gU3VwcG9ydCcsICdDb2RlJywgJ1VzZXInLCAnc2V0dGluZ3MuanNvbicpLFxuXHRcdFx0XHR0bzogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICdMaWJyYXJ5JywgJ0FwcGxpY2F0aW9uIFN1cHBvcnQnLCAnVm9pZCcsICdVc2VyJywgJ3NldHRpbmdzLmpzb24nKSxcblx0XHRcdH0sIHtcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICdMaWJyYXJ5JywgJ0FwcGxpY2F0aW9uIFN1cHBvcnQnLCAnQ29kZScsICdVc2VyJywgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgJ1ZvaWQnLCAnVXNlcicsICdrZXliaW5kaW5ncy5qc29uJyksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLnZzY29kZScsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJy52b2lkLWVkaXRvcicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdGlzRXh0ZW5zaW9uczogdHJ1ZSxcblx0XHRcdH1dXG5cdFx0fSBlbHNlIGlmIChmcm9tRWRpdG9yID09PSAnQ3Vyc29yJykge1xuXHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgJ0N1cnNvcicsICdVc2VyJywgJ3NldHRpbmdzLmpzb24nKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgJ1ZvaWQnLCAnVXNlcicsICdzZXR0aW5ncy5qc29uJyksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgJ0N1cnNvcicsICdVc2VyJywgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgJ1ZvaWQnLCAnVXNlcicsICdrZXliaW5kaW5ncy5qc29uJyksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLmN1cnNvcicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJy52b2lkLWVkaXRvcicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdGlzRXh0ZW5zaW9uczogdHJ1ZSxcblx0XHRcdH1dXG5cdFx0fSBlbHNlIGlmIChmcm9tRWRpdG9yID09PSAnV2luZHN1cmYnKSB7XG5cdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICdMaWJyYXJ5JywgJ0FwcGxpY2F0aW9uIFN1cHBvcnQnLCAnV2luZHN1cmYnLCAnVXNlcicsICdzZXR0aW5ncy5qc29uJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJ0xpYnJhcnknLCAnQXBwbGljYXRpb24gU3VwcG9ydCcsICdWb2lkJywgJ1VzZXInLCAnc2V0dGluZ3MuanNvbicpLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRmcm9tOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJ0xpYnJhcnknLCAnQXBwbGljYXRpb24gU3VwcG9ydCcsICdXaW5kc3VyZicsICdVc2VyJywgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnTGlicmFyeScsICdBcHBsaWNhdGlvbiBTdXBwb3J0JywgJ1ZvaWQnLCAnVXNlcicsICdrZXliaW5kaW5ncy5qc29uJyksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLndpbmRzdXJmJywgJ2V4dGVuc2lvbnMnKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLnZvaWQtZWRpdG9yJywgJ2V4dGVuc2lvbnMnKSxcblx0XHRcdFx0aXNFeHRlbnNpb25zOiB0cnVlLFxuXHRcdFx0fV1cblx0XHR9XG5cdH1cblxuXHRpZiAob3MgPT09ICdsaW51eCcpIHtcblx0XHRjb25zdCBob21lRGlyID0gZW52WydIT01FJ11cblx0XHRpZiAoIWhvbWVEaXIpIHRocm93IG5ldyBFcnJvcihgdmFyaWFibGUgZm9yICRIT01FIGxvY2F0aW9uIG5vdCBmb3VuZGApXG5cblx0XHRpZiAoZnJvbUVkaXRvciA9PT0gJ1ZTIENvZGUnKSB7XG5cdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICcuY29uZmlnJywgJ0NvZGUnLCAnVXNlcicsICdzZXR0aW5ncy5qc29uJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJy5jb25maWcnLCAnVm9pZCcsICdVc2VyJywgJ3NldHRpbmdzLmpzb24nKSxcblx0XHRcdH0sIHtcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICcuY29uZmlnJywgJ0NvZGUnLCAnVXNlcicsICdrZXliaW5kaW5ncy5qc29uJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJy5jb25maWcnLCAnVm9pZCcsICdVc2VyJywgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0XHRcdH0sIHtcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICcudnNjb2RlJywgJ2V4dGVuc2lvbnMnKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLnZvaWQtZWRpdG9yJywgJ2V4dGVuc2lvbnMnKSxcblx0XHRcdFx0aXNFeHRlbnNpb25zOiB0cnVlLFxuXHRcdFx0fV1cblx0XHR9IGVsc2UgaWYgKGZyb21FZGl0b3IgPT09ICdDdXJzb3InKSB7XG5cdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICcuY29uZmlnJywgJ0N1cnNvcicsICdVc2VyJywgJ3NldHRpbmdzLmpzb24nKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLmNvbmZpZycsICdWb2lkJywgJ1VzZXInLCAnc2V0dGluZ3MuanNvbicpLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRmcm9tOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJy5jb25maWcnLCAnQ3Vyc29yJywgJ1VzZXInLCAna2V5YmluZGluZ3MuanNvbicpLFxuXHRcdFx0XHR0bzogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICcuY29uZmlnJywgJ1ZvaWQnLCAnVXNlcicsICdrZXliaW5kaW5ncy5qc29uJyksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLmN1cnNvcicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJy52b2lkLWVkaXRvcicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdGlzRXh0ZW5zaW9uczogdHJ1ZSxcblx0XHRcdH1dXG5cdFx0fSBlbHNlIGlmIChmcm9tRWRpdG9yID09PSAnV2luZHN1cmYnKSB7XG5cdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICcuY29uZmlnJywgJ1dpbmRzdXJmJywgJ1VzZXInLCAnc2V0dGluZ3MuanNvbicpLFxuXHRcdFx0XHR0bzogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGhvbWVEaXIsICcuY29uZmlnJywgJ1ZvaWQnLCAnVXNlcicsICdzZXR0aW5ncy5qc29uJyksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLmNvbmZpZycsICdXaW5kc3VyZicsICdVc2VyJywgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBob21lRGlyLCAnLmNvbmZpZycsICdWb2lkJywgJ1VzZXInLCAna2V5YmluZGluZ3MuanNvbicpLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRmcm9tOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJy53aW5kc3VyZicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgaG9tZURpciwgJy52b2lkLWVkaXRvcicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdGlzRXh0ZW5zaW9uczogdHJ1ZSxcblx0XHRcdH1dXG5cdFx0fVxuXHR9XG5cblx0aWYgKG9zID09PSAnd2luZG93cycpIHtcblx0XHRjb25zdCBhcHBkYXRhID0gZW52WydBUFBEQVRBJ11cblx0XHRpZiAoIWFwcGRhdGEpIHRocm93IG5ldyBFcnJvcihgdmFyaWFibGUgZm9yICVBUFBEQVRBJSBsb2NhdGlvbiBub3QgZm91bmRgKVxuXHRcdGNvbnN0IHVzZXJwcm9maWxlID0gZW52WydVU0VSUFJPRklMRSddXG5cdFx0aWYgKCF1c2VycHJvZmlsZSkgdGhyb3cgbmV3IEVycm9yKGB2YXJpYWJsZSBmb3IgJVVTRVJQUk9GSUxFJSBsb2NhdGlvbiBub3QgZm91bmRgKVxuXG5cdFx0aWYgKGZyb21FZGl0b3IgPT09ICdWUyBDb2RlJykge1xuXHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBhcHBkYXRhLCAnQ29kZScsICdVc2VyJywgJ3NldHRpbmdzLmpzb24nKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBhcHBkYXRhLCAnVm9pZCcsICdVc2VyJywgJ3NldHRpbmdzLmpzb24nKSxcblx0XHRcdH0sIHtcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGFwcGRhdGEsICdDb2RlJywgJ1VzZXInLCAna2V5YmluZGluZ3MuanNvbicpLFxuXHRcdFx0XHR0bzogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGFwcGRhdGEsICdWb2lkJywgJ1VzZXInLCAna2V5YmluZGluZ3MuanNvbicpLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRmcm9tOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgdXNlcnByb2ZpbGUsICcudnNjb2RlJywgJ2V4dGVuc2lvbnMnKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCB1c2VycHJvZmlsZSwgJy52b2lkLWVkaXRvcicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdGlzRXh0ZW5zaW9uczogdHJ1ZSxcblx0XHRcdH1dXG5cdFx0fSBlbHNlIGlmIChmcm9tRWRpdG9yID09PSAnQ3Vyc29yJykge1xuXHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBhcHBkYXRhLCAnQ3Vyc29yJywgJ1VzZXInLCAnc2V0dGluZ3MuanNvbicpLFxuXHRcdFx0XHR0bzogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIGFwcGRhdGEsICdWb2lkJywgJ1VzZXInLCAnc2V0dGluZ3MuanNvbicpLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRmcm9tOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgYXBwZGF0YSwgJ0N1cnNvcicsICdVc2VyJywgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0XHRcdFx0dG86IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBhcHBkYXRhLCAnVm9pZCcsICdVc2VyJywgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0XHRcdH0sIHtcblx0XHRcdFx0ZnJvbTogVVJJLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiAnZmlsZScgfSksIHVzZXJwcm9maWxlLCAnLmN1cnNvcicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgdXNlcnByb2ZpbGUsICcudm9pZC1lZGl0b3InLCAnZXh0ZW5zaW9ucycpLFxuXHRcdFx0XHRpc0V4dGVuc2lvbnM6IHRydWUsXG5cdFx0XHR9XVxuXHRcdH0gZWxzZSBpZiAoZnJvbUVkaXRvciA9PT0gJ1dpbmRzdXJmJykge1xuXHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBhcHBkYXRhLCAnV2luZHN1cmYnLCAnVXNlcicsICdzZXR0aW5ncy5qc29uJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgYXBwZGF0YSwgJ1ZvaWQnLCAnVXNlcicsICdzZXR0aW5ncy5qc29uJyksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCBhcHBkYXRhLCAnV2luZHN1cmYnLCAnVXNlcicsICdrZXliaW5kaW5ncy5qc29uJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgYXBwZGF0YSwgJ1ZvaWQnLCAnVXNlcicsICdrZXliaW5kaW5ncy5qc29uJyksXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGZyb206IFVSSS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogJ2ZpbGUnIH0pLCB1c2VycHJvZmlsZSwgJy53aW5kc3VyZicsICdleHRlbnNpb25zJyksXG5cdFx0XHRcdHRvOiBVUkkuam9pblBhdGgoVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJyB9KSwgdXNlcnByb2ZpbGUsICcudm9pZC1lZGl0b3InLCAnZXh0ZW5zaW9ucycpLFxuXHRcdFx0XHRpc0V4dGVuc2lvbnM6IHRydWUsXG5cdFx0XHR9XVxuXHRcdH1cblx0fVxuXG5cdHRocm93IG5ldyBFcnJvcihgb3MgJyR7b3N9JyBub3QgcmVjb2duaXplZCBvciBlZGl0b3IgdHlwZSAnJHtmcm9tRWRpdG9yfScgbm90IHN1cHBvcnRlZCBmb3IgdGhpcyBPU2ApXG59XG5cblxuY29uc3QgZ2V0RXh0ZW5zaW9uc0ZvbGRlciA9IChvczogJ21hYycgfCAnd2luZG93cycgfCAnbGludXgnIHwgbnVsbCkgPT4ge1xuXHRjb25zdCB0ID0gdHJhbnNmZXJUaGVzZUZpbGVzT2ZPUyhvcywgJ1ZTIENvZGUnKSAvLyBmcm9tIGVkaXRvciBkb2VzbnQgbWF0dGVyXG5cdHJldHVybiB0LmZpbmQoZiA9PiBmLmlzRXh0ZW5zaW9ucyk/LnRvXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVztBQUNwQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsdUJBQXVCO0FBV3pCLE1BQU0sNEJBQTRCLGdCQUEyQywwQkFBMEI7QUFPOUcsTUFBTSxxQkFBcUI7QUFBQTtBQUFBLEVBRTFCO0FBQUE7QUFBQSxFQUNBO0FBQUE7QUFBQTtBQUFBLEVBRUE7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQTtBQUFBLEVBQ0E7QUFBQTtBQUFBLEVBQ0E7QUFBQTtBQUFBO0FBRUQ7QUFHQSxNQUFNLGdCQUFnQixDQUFDLFdBQStCO0FBQ3JELFNBQU8sbUJBQW1CLEtBQUssV0FBUyxRQUFRLFNBQVMsS0FBSyxDQUFDO0FBQ2hFO0FBRUEsSUFBTSwyQkFBTixjQUF1QyxXQUFnRDtBQUFBLEVBR3RGLFlBQ2dDLGNBQzlCO0FBQ0QsVUFBTTtBQUZ5QjtBQUFBLEVBR2hDO0FBQUEsRUFFQSxNQUFNLG1CQUFtQixJQUF3QyxZQUFnQztBQUNoRyxVQUFNLHFCQUFxQix1QkFBdUIsSUFBSSxVQUFVO0FBQ2hFLFVBQU0sY0FBYyxLQUFLO0FBRXpCLFFBQUksU0FBUztBQUViLGVBQVcsRUFBRSxNQUFNLElBQUksYUFBYSxLQUFLLG9CQUFvQjtBQUU1RCxVQUFJO0FBQ0gsWUFBSSxDQUFDLGNBQWM7QUFDbEIsa0JBQVEsSUFBSSxxQkFBcUIsTUFBTSxFQUFFO0FBRXpDLGdCQUFNLFNBQVMsTUFBTSxZQUFZLE9B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
