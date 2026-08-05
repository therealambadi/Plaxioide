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
import "./media/releasenoteseditor.css";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { escapeMarkdownSyntaxTokens } from "../../../../base/common/htmlContent.js";
import { KeybindingParser } from "../../../../base/common/keybindingParser.js";
import { escape } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { TokenizationRegistry } from "../../../../editor/common/languages.js";
import { generateTokensCSSForColorMap } from "../../../../editor/common/languages/supports/tokenization.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import * as nls from "../../../../nls.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { asTextOrError, IRequestService } from "../../../../platform/request/common/request.js";
import { DEFAULT_MARKDOWN_STYLES, renderMarkdownDocument } from "../../markdown/browser/markdownDocumentRenderer.js";
import { IWebviewWorkbenchService } from "../../webviewPanel/browser/webviewWorkbenchService.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { ACTIVE_GROUP, IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { getTelemetryLevel, supportsTelemetry } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { TelemetryLevel } from "../../../../platform/telemetry/common/telemetry.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { SimpleSettingRenderer } from "../../markdown/browser/markdownSettingRenderer.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Schemas } from "../../../../base/common/network.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { dirname } from "../../../../base/common/resources.js";
import { asWebviewUri } from "../../webview/common/webview.js";
let ReleaseNotesManager = class {
  constructor(_environmentService, _keybindingService, _languageService, _openerService, _requestService, _configurationService, _editorService, _editorGroupService, _codeEditorService, _webviewWorkbenchService, _extensionService, _productService, _instantiationService) {
    this._environmentService = _environmentService;
    this._keybindingService = _keybindingService;
    this._languageService = _languageService;
    this._openerService = _openerService;
    this._requestService = _requestService;
    this._configurationService = _configurationService;
    this._editorService = _editorService;
    this._editorGroupService = _editorGroupService;
    this._codeEditorService = _codeEditorService;
    this._webviewWorkbenchService = _webviewWorkbenchService;
    this._extensionService = _extensionService;
    this._productService = _productService;
    this._instantiationService = _instantiationService;
    this._releaseNotesCache = /* @__PURE__ */ new Map();
    this._currentReleaseNotes = void 0;
    this.disposables = new DisposableStore();
    TokenizationRegistry.onDidChange(() => {
      return this.updateHtml();
    });
    _configurationService.onDidChangeConfiguration(this.onDidChangeConfiguration, this, this.disposables);
    _webviewWorkbenchService.onDidChangeActiveWebviewEditor(this.onDidChangeActiveWebviewEditor, this, this.disposables);
    this._simpleSettingRenderer = this._instantiationService.createInstance(SimpleSettingRenderer);
  }
  async updateHtml() {
    if (!this._currentReleaseNotes || !this._lastMeta) {
      return;
    }
    const html = await this.renderBody(this._lastMeta);
    if (this._currentReleaseNotes) {
      this._currentReleaseNotes.webview.setHtml(html);
    }
  }
  async getBase(useCurrentFile) {
    if (useCurrentFile) {
      const currentFileUri = this._codeEditorService.getActiveCodeEditor()?.getModel()?.uri;
      if (currentFileUri) {
        return dirname(currentFileUri);
      }
    }
    return URI.parse("https://code.visualstudio.com/raw");
  }
  async show(version, useCurrentFile) {
    const releaseNoteText = await this.loadReleaseNotes(version, useCurrentFile);
    const base = await this.getBase(useCurrentFile);
    this._lastMeta = { text: releaseNoteText, base };
    const html = await this.renderBody(this._lastMeta);
    const title = nls.localize("releaseNotesInputName", "Release Notes: {0}", version);
    const activeEditorPane = this._editorService.activeEditorPane;
    if (this._currentReleaseNotes) {
      this._currentReleaseNotes.setName(title);
      this._currentReleaseNotes.webview.setHtml(html);
      this._webviewWorkbenchService.revealWebview(this._currentReleaseNotes, activeEditorPane ? activeEditorPane.group : this._editorGroupService.activeGroup, false);
    } else {
      this._currentReleaseNotes = this._webviewWorkbenchService.openWebview(
        {
          title,
          options: {
            tryRestoreScrollPosition: true,
            enableFindWidget: true,
            disableServiceWorker: useCurrentFile ? false : true
          },
          contentOptions: {
            localResourceRoots: useCurrentFile ? [base] : [],
            allowScripts: true
          },
          extension: void 0
        },
        "releaseNotes",
        title,
        { group: ACTIVE_GROUP, preserveFocus: false }
      );
      this._currentReleaseNotes.webview.onDidClickLink((uri) => this.onDidClickLink(URI.parse(uri)));
      const disposables = new DisposableStore();
      disposables.add(this._currentReleaseNotes.webview.onMessage((e) => {
        if (e.message.type === "showReleaseNotes") {
          this._configurationService.updateValue("update.showReleaseNotes", e.message.value);
        } else if (e.message.type === "clickSetting") {
          const x = this._currentReleaseNotes?.webview.container.offsetLeft + e.message.value.x;
          const y = this._currentReleaseNotes?.webview.container.offsetTop + e.message.value.y;
          this._simpleSettingRenderer.updateSetting(URI.parse(e.message.value.uri), x, y);
        }
      }));
      disposables.add(this._currentReleaseNotes.onWillDispose(() => {
        disposables.dispose();
        this._currentReleaseNotes = void 0;
      }));
      this._currentReleaseNotes.webview.setHtml(html);
    }
    return true;
  }
  async loadReleaseNotes(version, useCurrentFile) {
    const match = /^(\d+\.\d+)\./.exec(version);
    if (!match) {
      throw new Error("not found");
    }
    const versionLabel = match[1].replace(/\./g, "_");
    const baseUrl = "https://code.visualstudio.com/raw";
    const url = `${baseUrl}/v${versionLabel}.md`;
    const unassigned = nls.localize("unassigned", "unassigned");
    const escapeMdHtml = (text) => {
      return escape(text).replace(/\\/g, "\\\\");
    };
    const patchKeybindings = (text) => {
      const kb = (match2, kb2) => {
        const keybinding = this._keybindingService.lookupKeybinding(kb2);
        if (!keybinding) {
          return unassigned;
        }
        return keybinding.getLabel() || unassigned;
      };
      const kbstyle = (match2, kb2) => {
        const keybinding = KeybindingParser.parseKeybinding(kb2);
        if (!keybinding) {
          return unassigned;
        }
        const resolvedKeybindings = this._keybindingService.resolveKeybinding(keybinding);
        if (resolvedKeybindings.length === 0) {
          return unassigned;
        }
        return resolvedKeybindings[0].getLabel() || unassigned;
      };
      const kbCode = (match2, binding) => {
        const resolved = kb(match2, binding);
        return resolved ? `<code title="${binding}">${escapeMdHtml(resolved)}</code>` : resolved;
      };
      const kbstyleCode = (match2, binding) => {
        const resolved = kbstyle(match2, binding);
        return resolved ? `<code title="${binding}">${escapeMdHtml(resolved)}</code>` : resolved;
      };
      return text.replace(/`kb\(([a-z.\d\-]+)\)`/gi, kbCode).replace(/`kbstyle\(([^\)]+)\)`/gi, kbstyleCode).replace(/kb\(([a-z.\d\-]+)\)/gi, (match2, binding) => escapeMarkdownSyntaxTokens(kb(match2, binding))).replace(/kbstyle\(([^\)]+)\)/gi, (match2, binding) => escapeMarkdownSyntaxTokens(kbstyle(match2, binding)));
    };
    const fetchReleaseNotes = async () => {
      let text;
      try {
        if (useCurrentFile) {
          const file = this._codeEditorService.getActiveCodeEditor()?.getModel()?.getValue();
          text = file ? file.substring(file.indexOf("#")) : void 0;
        } else {
          text = await asTextOrError(await this._requestService.request({ url }, CancellationToken.None));
        }
      } catch {
        throw new Error("Failed to fetch release notes");
      }
      if (!text || !/^#\s/.test(text) && !useCurrentFile) {
        throw new Error("Invalid release notes");
      }
      return patchKeybindings(text);
    };
    if (useCurrentFile) {
      return fetchReleaseNotes();
    }
    if (!this._releaseNotesCache.has(version)) {
      this._releaseNotesCache.set(version, (async () => {
        try {
          return await fetchReleaseNotes();
        } catch (err) {
          this._releaseNotesCache.delete(version);
          throw err;
        }
      })());
    }
    return this._releaseNotesCache.get(version);
  }
  async onDidClickLink(uri) {
    if (uri.scheme === Schemas.codeSetting) {
    } else {
      this.addGAParameters(uri, "ReleaseNotes").then((updated) => this._openerService.open(updated, { allowCommands: ["workbench.action.openSettings"] })).then(void 0, onUnexpectedError);
    }
  }
  async addGAParameters(uri, origin, experiment = "1") {
    if (supportsTelemetry(this._productService, this._environmentService) && getTelemetryLevel(this._configurationService) === TelemetryLevel.USAGE) {
      if (uri.scheme === "https" && uri.authority === "code.visualstudio.com") {
        return uri.with({ query: `${uri.query ? uri.query + "&" : ""}utm_source=VsCode&utm_medium=${encodeURIComponent(origin)}&utm_content=${encodeURIComponent(experiment)}` });
      }
    }
    return uri;
  }
  async renderBody(fileContent) {
    const nonce = generateUuid();
    const content = await renderMarkdownDocument(fileContent.text, this._extensionService, this._languageService, {
      shouldSanitize: false,
      markedExtensions: [{
        renderer: {
          html: this._simpleSettingRenderer.getHtmlRenderer(),
          codespan: this._simpleSettingRenderer.getCodeSpanRenderer()
        }
      }]
    });
    const colorMap = TokenizationRegistry.getColorMap();
    const css = colorMap ? generateTokensCSSForColorMap(colorMap) : "";
    const showReleaseNotes = Boolean(this._configurationService.getValue("update.showReleaseNotes"));
    return `<!DOCTYPE html>
		<html>
			<head>
				<base href="${asWebviewUri(fileContent.base).toString(true)}/" >
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; style-src 'nonce-${nonce}' https://code.visualstudio.com; script-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					${DEFAULT_MARKDOWN_STYLES}
					${css}

					/* codesetting */

					code:has(.codesetting) {
						background-color: var(--vscode-textPreformat-background);
						color: var(--vscode-textPreformat-foreground);
						padding-left: 1px;
						margin-right: 3px;
						padding-right: 0px;
					}

					code:has(.codesetting):focus {
						border: 1px solid var(--vscode-button-border, transparent);
					}

					.codesetting {
						color: var(--vscode-textPreformat-foreground);
						padding: 0px 1px 1px 0px;
						font-size: 0px;
						overflow: hidden;
						text-overflow: ellipsis;
						outline-offset: 2px !important;
						box-sizing: border-box;
						text-align: center;
						cursor: pointer;
						display: inline;
						margin-right: 3px;
					}
					.codesetting svg {
						font-size: 12px;
						text-align: center;
						cursor: pointer;
						border: 1px solid var(--vscode-button-secondaryBorder, transparent);
						outline: 1px solid transparent;
						line-height: 9px;
						margin-bottom: -5px;
						padding-left: 0px;
						padding-top: 2px;
						padding-bottom: 2px;
						padding-right: 2px;
						display: inline-block;
						text-decoration: none;
						text-rendering: auto;
						text-transform: none;
						-webkit-font-smoothing: antialiased;
						-moz-osx-font-smoothing: grayscale;
						user-select: none;
						-webkit-user-select: none;
					}
					.codesetting .setting-name {
						font-size: 13px;
						padding-left: 2px;
						padding-right: 3px;
						padding-top: 1px;
						padding-bottom: 1px;
						margin-top: -3px;
					}
					.codesetting:hover {
						color: var(--vscode-textPreformat-foreground) !important;
						text-decoration: none !important;
					}
					code:has(.codesetting):hover {
						filter: brightness(140%);
						text-decoration: none !important;
					}
					.codesetting:focus {
						outline: 0 !important;
						text-decoration: none !important;
						color: var(--vscode-button-hoverForeground) !important;
					}
					.codesetting .separator {
						width: 1px;
						height: 14px;
						margin-bottom: -3px;
						display: inline-block;
						background-color: var(--vscode-editor-background);
						font-size: 12px;
						margin-right: 4px;
					}

					header { display: flex; align-items: center; padding-top: 1em; }
				</style>
			</head>
			<body>
				${content}
				<script nonce="${nonce}">
					const vscode = acquireVsCodeApi();
					const container = document.createElement('p');
					container.style.display = 'flex';
					container.style.alignItems = 'center';

					const input = document.createElement('input');
					input.type = 'checkbox';
					input.id = 'showReleaseNotes';
					input.checked = ${showReleaseNotes};
					container.appendChild(input);

					const label = document.createElement('label');
					label.htmlFor = 'showReleaseNotes';
					label.textContent = '${nls.localize("showOnUpdate", "Show release notes after an update")}';
					container.appendChild(label);

					const beforeElement = document.querySelector("body > h1")?.nextElementSibling;
					if (beforeElement) {
						document.body.insertBefore(container, beforeElement);
					} else {
						document.body.appendChild(container);
					}

					window.addEventListener('message', event => {
						if (event.data.type === 'showReleaseNotes') {
							input.checked = event.data.value;
						}
					});

					window.addEventListener('click', event => {
						const href = event.target.href ?? event.target.parentElement?.href ?? event.target.parentElement?.parentElement?.href;
						if (href && (href.startsWith('${Schemas.codeSetting}'))) {
							vscode.postMessage({ type: 'clickSetting', value: { uri: href, x: event.clientX, y: event.clientY }});
						}
					});

					window.addEventListener('keypress', event => {
						if (event.keyCode === 13) {
							if (event.target.children.length > 0 && event.target.children[0].href) {
								const clientRect = event.target.getBoundingClientRect();
								vscode.postMessage({ type: 'clickSetting', value: { uri: event.target.children[0].href, x: clientRect.right , y: clientRect.bottom }});
							}
						}
					});

					input.addEventListener('change', event => {
						vscode.postMessage({ type: 'showReleaseNotes', value: input.checked }, '*');
					});
				<\/script>
			</body>
		</html>`;
  }
  onDidChangeConfiguration(e) {
    if (e.affectsConfiguration("update.showReleaseNotes")) {
      this.updateCheckboxWebview();
    }
  }
  onDidChangeActiveWebviewEditor(input) {
    if (input && input === this._currentReleaseNotes) {
      this.updateCheckboxWebview();
    }
  }
  updateCheckboxWebview() {
    if (this._currentReleaseNotes) {
      this._currentReleaseNotes.webview.postMessage({
        type: "showReleaseNotes",
        value: this._configurationService.getValue("update.showReleaseNotes")
      });
    }
  }
};
ReleaseNotesManager = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IRequestService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, IEditorGroupsService),
  __decorateParam(8, ICodeEditorService),
  __decorateParam(9, IWebviewWorkbenchService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IInstantiationService)
], ReleaseNotesManager);
export {
  ReleaseNotesManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91cGRhdGUvYnJvd3Nlci9yZWxlYXNlTm90ZXNFZGl0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvcmVsZWFzZW5vdGVzZWRpdG9yLmNzcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBlc2NhcGVNYXJrZG93blN5bnRheFRva2VucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdQYXJzZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5nUGFyc2VyLmpzJztcbmltcG9ydCB7IGVzY2FwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgVG9rZW5pemF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVRva2Vuc0NTU0ZvckNvbG9yTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvc3VwcG9ydHMvdG9rZW5pemF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGFzVGV4dE9yRXJyb3IsIElSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9NQVJLRE9XTl9TVFlMRVMsIHJlbmRlck1hcmtkb3duRG9jdW1lbnQgfSBmcm9tICcuLi8uLi9tYXJrZG93bi9icm93c2VyL21hcmtkb3duRG9jdW1lbnRSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBXZWJ2aWV3SW5wdXQgfSBmcm9tICcuLi8uLi93ZWJ2aWV3UGFuZWwvYnJvd3Nlci93ZWJ2aWV3RWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSVdlYnZpZXdXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd2Vidmlld1BhbmVsL2Jyb3dzZXIvd2Vidmlld1dvcmtiZW5jaFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQUNUSVZFX0dST1VQLCBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZ2V0VGVsZW1ldHJ5TGV2ZWwsIHN1cHBvcnRzVGVsZW1ldHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlbGVtZXRyeUxldmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNpbXBsZVNldHRpbmdSZW5kZXJlciB9IGZyb20gJy4uLy4uL21hcmtkb3duL2Jyb3dzZXIvbWFya2Rvd25TZXR0aW5nUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGFzV2Vidmlld1VyaSB9IGZyb20gJy4uLy4uL3dlYnZpZXcvY29tbW9uL3dlYnZpZXcuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVsZWFzZU5vdGVzTWFuYWdlciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NpbXBsZVNldHRpbmdSZW5kZXJlcjogU2ltcGxlU2V0dGluZ1JlbmRlcmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZWxlYXNlTm90ZXNDYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBQcm9taXNlPHN0cmluZz4+KCk7XG5cblx0cHJpdmF0ZSBfY3VycmVudFJlbGVhc2VOb3RlczogV2Vidmlld0lucHV0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9sYXN0TWV0YTogeyB0ZXh0OiBzdHJpbmc7IGJhc2U6IFVSSSB9IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHB1YmxpYyBjb25zdHJ1Y3Rvcihcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElSZXF1ZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9yZXF1ZXN0U2VydmljZTogSVJlcXVlc3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJV2Vidmlld1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd2Vidmlld1dvcmtiZW5jaFNlcnZpY2U6IElXZWJ2aWV3V29ya2JlbmNoU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0VG9rZW5pemF0aW9uUmVnaXN0cnkub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlSHRtbCgpO1xuXHRcdH0pO1xuXG5cdFx0X2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbih0aGlzLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbiwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0X3dlYnZpZXdXb3JrYmVuY2hTZXJ2aWNlLm9uRGlkQ2hhbmdlQWN0aXZlV2Vidmlld0VkaXRvcih0aGlzLm9uRGlkQ2hhbmdlQWN0aXZlV2Vidmlld0VkaXRvciwgdGhpcywgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy5fc2ltcGxlU2V0dGluZ1JlbmRlcmVyID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2ltcGxlU2V0dGluZ1JlbmRlcmVyKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlSHRtbCgpIHtcblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRSZWxlYXNlTm90ZXMgfHwgIXRoaXMuX2xhc3RNZXRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGh0bWwgPSBhd2FpdCB0aGlzLnJlbmRlckJvZHkodGhpcy5fbGFzdE1ldGEpO1xuXHRcdGlmICh0aGlzLl9jdXJyZW50UmVsZWFzZU5vdGVzKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50UmVsZWFzZU5vdGVzLndlYnZpZXcuc2V0SHRtbChodG1sKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldEJhc2UodXNlQ3VycmVudEZpbGU6IGJvb2xlYW4pIHtcblx0XHRpZiAodXNlQ3VycmVudEZpbGUpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRGaWxlVXJpID0gdGhpcy5fY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpPy5nZXRNb2RlbCgpPy51cmk7XG5cdFx0XHRpZiAoY3VycmVudEZpbGVVcmkpIHtcblx0XHRcdFx0cmV0dXJuIGRpcm5hbWUoY3VycmVudEZpbGVVcmkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gVVJJLnBhcnNlKCdodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9yYXcnKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzaG93KHZlcnNpb246IHN0cmluZywgdXNlQ3VycmVudEZpbGU6IGJvb2xlYW4pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCByZWxlYXNlTm90ZVRleHQgPSBhd2FpdCB0aGlzLmxvYWRSZWxlYXNlTm90ZXModmVyc2lvbiwgdXNlQ3VycmVudEZpbGUpO1xuXHRcdGNvbnN0IGJhc2UgPSBhd2FpdCB0aGlzLmdldEJhc2UodXNlQ3VycmVudEZpbGUpO1xuXHRcdHRoaXMuX2xhc3RNZXRhID0geyB0ZXh0OiByZWxlYXNlTm90ZVRleHQsIGJhc2UgfTtcblx0XHRjb25zdCBodG1sID0gYXdhaXQgdGhpcy5yZW5kZXJCb2R5KHRoaXMuX2xhc3RNZXRhKTtcblx0XHRjb25zdCB0aXRsZSA9IG5scy5sb2NhbGl6ZSgncmVsZWFzZU5vdGVzSW5wdXROYW1lJywgXCJSZWxlYXNlIE5vdGVzOiB7MH1cIiwgdmVyc2lvbik7XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gdGhpcy5fZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmICh0aGlzLl9jdXJyZW50UmVsZWFzZU5vdGVzKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50UmVsZWFzZU5vdGVzLnNldE5hbWUodGl0bGUpO1xuXHRcdFx0dGhpcy5fY3VycmVudFJlbGVhc2VOb3Rlcy53ZWJ2aWV3LnNldEh0bWwoaHRtbCk7XG5cdFx0XHR0aGlzLl93ZWJ2aWV3V29ya2JlbmNoU2VydmljZS5yZXZlYWxXZWJ2aWV3KHRoaXMuX2N1cnJlbnRSZWxlYXNlTm90ZXMsIGFjdGl2ZUVkaXRvclBhbmUgPyBhY3RpdmVFZGl0b3JQYW5lLmdyb3VwIDogdGhpcy5fZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLCBmYWxzZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2N1cnJlbnRSZWxlYXNlTm90ZXMgPSB0aGlzLl93ZWJ2aWV3V29ya2JlbmNoU2VydmljZS5vcGVuV2Vidmlldyhcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRpdGxlLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdHRyeVJlc3RvcmVTY3JvbGxQb3NpdGlvbjogdHJ1ZSxcblx0XHRcdFx0XHRcdGVuYWJsZUZpbmRXaWRnZXQ6IHRydWUsXG5cdFx0XHRcdFx0XHRkaXNhYmxlU2VydmljZVdvcmtlcjogdXNlQ3VycmVudEZpbGUgPyBmYWxzZSA6IHRydWUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjb250ZW50T3B0aW9uczoge1xuXHRcdFx0XHRcdFx0bG9jYWxSZXNvdXJjZVJvb3RzOiB1c2VDdXJyZW50RmlsZSA/IFtiYXNlXSA6IFtdLFxuXHRcdFx0XHRcdFx0YWxsb3dTY3JpcHRzOiB0cnVlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRleHRlbnNpb246IHVuZGVmaW5lZFxuXHRcdFx0XHR9LFxuXHRcdFx0XHQncmVsZWFzZU5vdGVzJyxcblx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdHsgZ3JvdXA6IEFDVElWRV9HUk9VUCwgcHJlc2VydmVGb2N1czogZmFsc2UgfSk7XG5cblx0XHRcdHRoaXMuX2N1cnJlbnRSZWxlYXNlTm90ZXMud2Vidmlldy5vbkRpZENsaWNrTGluayh1cmkgPT4gdGhpcy5vbkRpZENsaWNrTGluayhVUkkucGFyc2UodXJpKSkpO1xuXG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLl9jdXJyZW50UmVsZWFzZU5vdGVzLndlYnZpZXcub25NZXNzYWdlKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5tZXNzYWdlLnR5cGUgPT09ICdzaG93UmVsZWFzZU5vdGVzJykge1xuXHRcdFx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCd1cGRhdGUuc2hvd1JlbGVhc2VOb3RlcycsIGUubWVzc2FnZS52YWx1ZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZS5tZXNzYWdlLnR5cGUgPT09ICdjbGlja1NldHRpbmcnKSB7XG5cdFx0XHRcdFx0Y29uc3QgeCA9IHRoaXMuX2N1cnJlbnRSZWxlYXNlTm90ZXM/LndlYnZpZXcuY29udGFpbmVyLm9mZnNldExlZnQgKyBlLm1lc3NhZ2UudmFsdWUueDtcblx0XHRcdFx0XHRjb25zdCB5ID0gdGhpcy5fY3VycmVudFJlbGVhc2VOb3Rlcz8ud2Vidmlldy5jb250YWluZXIub2Zmc2V0VG9wICsgZS5tZXNzYWdlLnZhbHVlLnk7XG5cdFx0XHRcdFx0dGhpcy5fc2ltcGxlU2V0dGluZ1JlbmRlcmVyLnVwZGF0ZVNldHRpbmcoVVJJLnBhcnNlKGUubWVzc2FnZS52YWx1ZS51cmkpLCB4LCB5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5fY3VycmVudFJlbGVhc2VOb3Rlcy5vbldpbGxEaXNwb3NlKCgpID0+IHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50UmVsZWFzZU5vdGVzID0gdW5kZWZpbmVkO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl9jdXJyZW50UmVsZWFzZU5vdGVzLndlYnZpZXcuc2V0SHRtbChodG1sKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbG9hZFJlbGVhc2VOb3Rlcyh2ZXJzaW9uOiBzdHJpbmcsIHVzZUN1cnJlbnRGaWxlOiBib29sZWFuKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBtYXRjaCA9IC9eKFxcZCtcXC5cXGQrKVxcLi8uZXhlYyh2ZXJzaW9uKTtcblx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZlcnNpb25MYWJlbCA9IG1hdGNoWzFdLnJlcGxhY2UoL1xcLi9nLCAnXycpO1xuXHRcdGNvbnN0IGJhc2VVcmwgPSAnaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vcmF3Jztcblx0XHRjb25zdCB1cmwgPSBgJHtiYXNlVXJsfS92JHt2ZXJzaW9uTGFiZWx9Lm1kYDtcblx0XHRjb25zdCB1bmFzc2lnbmVkID0gbmxzLmxvY2FsaXplKCd1bmFzc2lnbmVkJywgXCJ1bmFzc2lnbmVkXCIpO1xuXG5cdFx0Y29uc3QgZXNjYXBlTWRIdG1sID0gKHRleHQ6IHN0cmluZyk6IHN0cmluZyA9PiB7XG5cdFx0XHRyZXR1cm4gZXNjYXBlKHRleHQpLnJlcGxhY2UoL1xcXFwvZywgJ1xcXFxcXFxcJyk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHBhdGNoS2V5YmluZGluZ3MgPSAodGV4dDogc3RyaW5nKTogc3RyaW5nID0+IHtcblx0XHRcdGNvbnN0IGtiID0gKG1hdGNoOiBzdHJpbmcsIGtiOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoa2IpO1xuXG5cdFx0XHRcdGlmICgha2V5YmluZGluZykge1xuXHRcdFx0XHRcdHJldHVybiB1bmFzc2lnbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGtleWJpbmRpbmcuZ2V0TGFiZWwoKSB8fCB1bmFzc2lnbmVkO1xuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3Qga2JzdHlsZSA9IChtYXRjaDogc3RyaW5nLCBrYjogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSBLZXliaW5kaW5nUGFyc2VyLnBhcnNlS2V5YmluZGluZyhrYik7XG5cblx0XHRcdFx0aWYgKCFrZXliaW5kaW5nKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuYXNzaWduZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByZXNvbHZlZEtleWJpbmRpbmdzID0gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UucmVzb2x2ZUtleWJpbmRpbmcoa2V5YmluZGluZyk7XG5cblx0XHRcdFx0aWYgKHJlc29sdmVkS2V5YmluZGluZ3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuYXNzaWduZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZWRLZXliaW5kaW5nc1swXS5nZXRMYWJlbCgpIHx8IHVuYXNzaWduZWQ7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBrYkNvZGUgPSAobWF0Y2g6IHN0cmluZywgYmluZGluZzogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc29sdmVkID0ga2IobWF0Y2gsIGJpbmRpbmcpO1xuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZWQgPyBgPGNvZGUgdGl0bGU9XCIke2JpbmRpbmd9XCI+JHtlc2NhcGVNZEh0bWwocmVzb2x2ZWQpfTwvY29kZT5gIDogcmVzb2x2ZWQ7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBrYnN0eWxlQ29kZSA9IChtYXRjaDogc3RyaW5nLCBiaW5kaW5nOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWQgPSBrYnN0eWxlKG1hdGNoLCBiaW5kaW5nKTtcblx0XHRcdFx0cmV0dXJuIHJlc29sdmVkID8gYDxjb2RlIHRpdGxlPVwiJHtiaW5kaW5nfVwiPiR7ZXNjYXBlTWRIdG1sKHJlc29sdmVkKX08L2NvZGU+YCA6IHJlc29sdmVkO1xuXHRcdFx0fTtcblxuXHRcdFx0cmV0dXJuIHRleHRcblx0XHRcdFx0LnJlcGxhY2UoL2BrYlxcKChbYS16LlxcZFxcLV0rKVxcKWAvZ2ksIGtiQ29kZSlcblx0XHRcdFx0LnJlcGxhY2UoL2BrYnN0eWxlXFwoKFteXFwpXSspXFwpYC9naSwga2JzdHlsZUNvZGUpXG5cdFx0XHRcdC5yZXBsYWNlKC9rYlxcKChbYS16LlxcZFxcLV0rKVxcKS9naSwgKG1hdGNoLCBiaW5kaW5nKSA9PiBlc2NhcGVNYXJrZG93blN5bnRheFRva2VucyhrYihtYXRjaCwgYmluZGluZykpKVxuXHRcdFx0XHQucmVwbGFjZSgva2JzdHlsZVxcKChbXlxcKV0rKVxcKS9naSwgKG1hdGNoLCBiaW5kaW5nKSA9PiBlc2NhcGVNYXJrZG93blN5bnRheFRva2VucyhrYnN0eWxlKG1hdGNoLCBiaW5kaW5nKSkpO1xuXHRcdH07XG5cblx0XHRjb25zdCBmZXRjaFJlbGVhc2VOb3RlcyA9IGFzeW5jICgpID0+IHtcblx0XHRcdGxldCB0ZXh0O1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKHVzZUN1cnJlbnRGaWxlKSB7XG5cdFx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuX2NvZGVFZGl0b3JTZXJ2aWNlLmdldEFjdGl2ZUNvZGVFZGl0b3IoKT8uZ2V0TW9kZWwoKT8uZ2V0VmFsdWUoKTtcblx0XHRcdFx0XHR0ZXh0ID0gZmlsZSA/IGZpbGUuc3Vic3RyaW5nKGZpbGUuaW5kZXhPZignIycpKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0ZXh0ID0gYXdhaXQgYXNUZXh0T3JFcnJvcihhd2FpdCB0aGlzLl9yZXF1ZXN0U2VydmljZS5yZXF1ZXN0KHsgdXJsIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGZldGNoIHJlbGVhc2Ugbm90ZXMnKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0ZXh0IHx8ICghL14jXFxzLy50ZXN0KHRleHQpICYmICF1c2VDdXJyZW50RmlsZSkpIHsgLy8gcmVsZWFzZSBub3RlcyBhbHdheXMgc3RhcnRzIHdpdGggYCNgIGZvbGxvd2VkIGJ5IHdoaXRlc3BhY2UsIGV4Y2VwdCB3aGVuIHVzaW5nIHRoZSBjdXJyZW50IGZpbGVcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHJlbGVhc2Ugbm90ZXMnKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHBhdGNoS2V5YmluZGluZ3ModGV4dCk7XG5cdFx0fTtcblxuXHRcdC8vIERvbid0IGNhY2hlIHRoZSBjdXJyZW50IGZpbGVcblx0XHRpZiAodXNlQ3VycmVudEZpbGUpIHtcblx0XHRcdHJldHVybiBmZXRjaFJlbGVhc2VOb3RlcygpO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX3JlbGVhc2VOb3Rlc0NhY2hlLmhhcyh2ZXJzaW9uKSkge1xuXHRcdFx0dGhpcy5fcmVsZWFzZU5vdGVzQ2FjaGUuc2V0KHZlcnNpb24sIChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmV0dXJuIGF3YWl0IGZldGNoUmVsZWFzZU5vdGVzKCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdHRoaXMuX3JlbGVhc2VOb3Rlc0NhY2hlLmRlbGV0ZSh2ZXJzaW9uKTtcblx0XHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHRcdH1cblx0XHRcdH0pKCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9yZWxlYXNlTm90ZXNDYWNoZS5nZXQodmVyc2lvbikhO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbkRpZENsaWNrTGluayh1cmk6IFVSSSkge1xuXHRcdGlmICh1cmkuc2NoZW1lID09PSBTY2hlbWFzLmNvZGVTZXR0aW5nKSB7XG5cdFx0XHQvLyBoYW5kbGVkIGluIHJlY2VpdmUgbWVzc2FnZVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmFkZEdBUGFyYW1ldGVycyh1cmksICdSZWxlYXNlTm90ZXMnKVxuXHRcdFx0XHQudGhlbih1cGRhdGVkID0+IHRoaXMuX29wZW5lclNlcnZpY2Uub3Blbih1cGRhdGVkLCB7IGFsbG93Q29tbWFuZHM6IFsnd29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3MnXSB9KSlcblx0XHRcdFx0LnRoZW4odW5kZWZpbmVkLCBvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhZGRHQVBhcmFtZXRlcnModXJpOiBVUkksIG9yaWdpbjogc3RyaW5nLCBleHBlcmltZW50ID0gJzEnKTogUHJvbWlzZTxVUkk+IHtcblx0XHRpZiAoc3VwcG9ydHNUZWxlbWV0cnkodGhpcy5fcHJvZHVjdFNlcnZpY2UsIHRoaXMuX2Vudmlyb25tZW50U2VydmljZSkgJiYgZ2V0VGVsZW1ldHJ5TGV2ZWwodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpID09PSBUZWxlbWV0cnlMZXZlbC5VU0FHRSkge1xuXHRcdFx0aWYgKHVyaS5zY2hlbWUgPT09ICdodHRwcycgJiYgdXJpLmF1dGhvcml0eSA9PT0gJ2NvZGUudmlzdWFsc3R1ZGlvLmNvbScpIHtcblx0XHRcdFx0cmV0dXJuIHVyaS53aXRoKHsgcXVlcnk6IGAke3VyaS5xdWVyeSA/IHVyaS5xdWVyeSArICcmJyA6ICcnfXV0bV9zb3VyY2U9VnNDb2RlJnV0bV9tZWRpdW09JHtlbmNvZGVVUklDb21wb25lbnQob3JpZ2luKX0mdXRtX2NvbnRlbnQ9JHtlbmNvZGVVUklDb21wb25lbnQoZXhwZXJpbWVudCl9YCB9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVyaTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyQm9keShmaWxlQ29udGVudDogeyB0ZXh0OiBzdHJpbmc7IGJhc2U6IFVSSSB9KSB7XG5cdFx0Y29uc3Qgbm9uY2UgPSBnZW5lcmF0ZVV1aWQoKTtcblxuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZW5kZXJNYXJrZG93bkRvY3VtZW50KGZpbGVDb250ZW50LnRleHQsIHRoaXMuX2V4dGVuc2lvblNlcnZpY2UsIHRoaXMuX2xhbmd1YWdlU2VydmljZSwge1xuXHRcdFx0c2hvdWxkU2FuaXRpemU6IGZhbHNlLFxuXHRcdFx0bWFya2VkRXh0ZW5zaW9uczogW3tcblx0XHRcdFx0cmVuZGVyZXI6IHtcblx0XHRcdFx0XHRodG1sOiB0aGlzLl9zaW1wbGVTZXR0aW5nUmVuZGVyZXIuZ2V0SHRtbFJlbmRlcmVyKCksXG5cdFx0XHRcdFx0Y29kZXNwYW46IHRoaXMuX3NpbXBsZVNldHRpbmdSZW5kZXJlci5nZXRDb2RlU3BhblJlbmRlcmVyKCksXG5cdFx0XHRcdH1cblx0XHRcdH1dXG5cdFx0fSk7XG5cdFx0Y29uc3QgY29sb3JNYXAgPSBUb2tlbml6YXRpb25SZWdpc3RyeS5nZXRDb2xvck1hcCgpO1xuXHRcdGNvbnN0IGNzcyA9IGNvbG9yTWFwID8gZ2VuZXJhdGVUb2tlbnNDU1NGb3JDb2xvck1hcChjb2xvck1hcCkgOiAnJztcblx0XHRjb25zdCBzaG93UmVsZWFzZU5vdGVzID0gQm9vbGVhbih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPigndXBkYXRlLnNob3dSZWxlYXNlTm90ZXMnKSk7XG5cblx0XHRyZXR1cm4gYDwhRE9DVFlQRSBodG1sPlxuXHRcdDxodG1sPlxuXHRcdFx0PGhlYWQ+XG5cdFx0XHRcdDxiYXNlIGhyZWY9XCIke2FzV2Vidmlld1VyaShmaWxlQ29udGVudC5iYXNlKS50b1N0cmluZyh0cnVlKX0vXCIgPlxuXHRcdFx0XHQ8bWV0YSBodHRwLWVxdWl2PVwiQ29udGVudC10eXBlXCIgY29udGVudD1cInRleHQvaHRtbDtjaGFyc2V0PVVURi04XCI+XG5cdFx0XHRcdDxtZXRhIGh0dHAtZXF1aXY9XCJDb250ZW50LVNlY3VyaXR5LVBvbGljeVwiIGNvbnRlbnQ9XCJkZWZhdWx0LXNyYyAnbm9uZSc7IGltZy1zcmMgaHR0cHM6IGRhdGE6OyBtZWRpYS1zcmMgaHR0cHM6OyBzdHlsZS1zcmMgJ25vbmNlLSR7bm9uY2V9JyBodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbTsgc2NyaXB0LXNyYyAnbm9uY2UtJHtub25jZX0nO1wiPlxuXHRcdFx0XHQ8c3R5bGUgbm9uY2U9XCIke25vbmNlfVwiPlxuXHRcdFx0XHRcdCR7REVGQVVMVF9NQVJLRE9XTl9TVFlMRVN9XG5cdFx0XHRcdFx0JHtjc3N9XG5cblx0XHRcdFx0XHQvKiBjb2Rlc2V0dGluZyAqL1xuXG5cdFx0XHRcdFx0Y29kZTpoYXMoLmNvZGVzZXR0aW5nKSB7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS12c2NvZGUtdGV4dFByZWZvcm1hdC1iYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHRcdGNvbG9yOiB2YXIoLS12c2NvZGUtdGV4dFByZWZvcm1hdC1mb3JlZ3JvdW5kKTtcblx0XHRcdFx0XHRcdHBhZGRpbmctbGVmdDogMXB4O1xuXHRcdFx0XHRcdFx0bWFyZ2luLXJpZ2h0OiAzcHg7XG5cdFx0XHRcdFx0XHRwYWRkaW5nLXJpZ2h0OiAwcHg7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29kZTpoYXMoLmNvZGVzZXR0aW5nKTpmb2N1cyB7XG5cdFx0XHRcdFx0XHRib3JkZXI6IDFweCBzb2xpZCB2YXIoLS12c2NvZGUtYnV0dG9uLWJvcmRlciwgdHJhbnNwYXJlbnQpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC5jb2Rlc2V0dGluZyB7XG5cdFx0XHRcdFx0XHRjb2xvcjogdmFyKC0tdnNjb2RlLXRleHRQcmVmb3JtYXQtZm9yZWdyb3VuZCk7XG5cdFx0XHRcdFx0XHRwYWRkaW5nOiAwcHggMXB4IDFweCAwcHg7XG5cdFx0XHRcdFx0XHRmb250LXNpemU6IDBweDtcblx0XHRcdFx0XHRcdG92ZXJmbG93OiBoaWRkZW47XG5cdFx0XHRcdFx0XHR0ZXh0LW92ZXJmbG93OiBlbGxpcHNpcztcblx0XHRcdFx0XHRcdG91dGxpbmUtb2Zmc2V0OiAycHggIWltcG9ydGFudDtcblx0XHRcdFx0XHRcdGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG5cdFx0XHRcdFx0XHR0ZXh0LWFsaWduOiBjZW50ZXI7XG5cdFx0XHRcdFx0XHRjdXJzb3I6IHBvaW50ZXI7XG5cdFx0XHRcdFx0XHRkaXNwbGF5OiBpbmxpbmU7XG5cdFx0XHRcdFx0XHRtYXJnaW4tcmlnaHQ6IDNweDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0LmNvZGVzZXR0aW5nIHN2ZyB7XG5cdFx0XHRcdFx0XHRmb250LXNpemU6IDEycHg7XG5cdFx0XHRcdFx0XHR0ZXh0LWFsaWduOiBjZW50ZXI7XG5cdFx0XHRcdFx0XHRjdXJzb3I6IHBvaW50ZXI7XG5cdFx0XHRcdFx0XHRib3JkZXI6IDFweCBzb2xpZCB2YXIoLS12c2NvZGUtYnV0dG9uLXNlY29uZGFyeUJvcmRlciwgdHJhbnNwYXJlbnQpO1xuXHRcdFx0XHRcdFx0b3V0bGluZTogMXB4IHNvbGlkIHRyYW5zcGFyZW50O1xuXHRcdFx0XHRcdFx0bGluZS1oZWlnaHQ6IDlweDtcblx0XHRcdFx0XHRcdG1hcmdpbi1ib3R0b206IC01cHg7XG5cdFx0XHRcdFx0XHRwYWRkaW5nLWxlZnQ6IDBweDtcblx0XHRcdFx0XHRcdHBhZGRpbmctdG9wOiAycHg7XG5cdFx0XHRcdFx0XHRwYWRkaW5nLWJvdHRvbTogMnB4O1xuXHRcdFx0XHRcdFx0cGFkZGluZy1yaWdodDogMnB4O1xuXHRcdFx0XHRcdFx0ZGlzcGxheTogaW5saW5lLWJsb2NrO1xuXHRcdFx0XHRcdFx0dGV4dC1kZWNvcmF0aW9uOiBub25lO1xuXHRcdFx0XHRcdFx0dGV4dC1yZW5kZXJpbmc6IGF1dG87XG5cdFx0XHRcdFx0XHR0ZXh0LXRyYW5zZm9ybTogbm9uZTtcblx0XHRcdFx0XHRcdC13ZWJraXQtZm9udC1zbW9vdGhpbmc6IGFudGlhbGlhc2VkO1xuXHRcdFx0XHRcdFx0LW1vei1vc3gtZm9udC1zbW9vdGhpbmc6IGdyYXlzY2FsZTtcblx0XHRcdFx0XHRcdHVzZXItc2VsZWN0OiBub25lO1xuXHRcdFx0XHRcdFx0LXdlYmtpdC11c2VyLXNlbGVjdDogbm9uZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0LmNvZGVzZXR0aW5nIC5zZXR0aW5nLW5hbWUge1xuXHRcdFx0XHRcdFx0Zm9udC1zaXplOiAxM3B4O1xuXHRcdFx0XHRcdFx0cGFkZGluZy1sZWZ0OiAycHg7XG5cdFx0XHRcdFx0XHRwYWRkaW5nLXJpZ2h0OiAzcHg7XG5cdFx0XHRcdFx0XHRwYWRkaW5nLXRvcDogMXB4O1xuXHRcdFx0XHRcdFx0cGFkZGluZy1ib3R0b206IDFweDtcblx0XHRcdFx0XHRcdG1hcmdpbi10b3A6IC0zcHg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC5jb2Rlc2V0dGluZzpob3ZlciB7XG5cdFx0XHRcdFx0XHRjb2xvcjogdmFyKC0tdnNjb2RlLXRleHRQcmVmb3JtYXQtZm9yZWdyb3VuZCkgIWltcG9ydGFudDtcblx0XHRcdFx0XHRcdHRleHQtZGVjb3JhdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb2RlOmhhcyguY29kZXNldHRpbmcpOmhvdmVyIHtcblx0XHRcdFx0XHRcdGZpbHRlcjogYnJpZ2h0bmVzcygxNDAlKTtcblx0XHRcdFx0XHRcdHRleHQtZGVjb3JhdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQuY29kZXNldHRpbmc6Zm9jdXMge1xuXHRcdFx0XHRcdFx0b3V0bGluZTogMCAhaW1wb3J0YW50O1xuXHRcdFx0XHRcdFx0dGV4dC1kZWNvcmF0aW9uOiBub25lICFpbXBvcnRhbnQ7XG5cdFx0XHRcdFx0XHRjb2xvcjogdmFyKC0tdnNjb2RlLWJ1dHRvbi1ob3ZlckZvcmVncm91bmQpICFpbXBvcnRhbnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC5jb2Rlc2V0dGluZyAuc2VwYXJhdG9yIHtcblx0XHRcdFx0XHRcdHdpZHRoOiAxcHg7XG5cdFx0XHRcdFx0XHRoZWlnaHQ6IDE0cHg7XG5cdFx0XHRcdFx0XHRtYXJnaW4tYm90dG9tOiAtM3B4O1xuXHRcdFx0XHRcdFx0ZGlzcGxheTogaW5saW5lLWJsb2NrO1xuXHRcdFx0XHRcdFx0YmFja2dyb3VuZC1jb2xvcjogdmFyKC0tdnNjb2RlLWVkaXRvci1iYWNrZ3JvdW5kKTtcblx0XHRcdFx0XHRcdGZvbnQtc2l6ZTogMTJweDtcblx0XHRcdFx0XHRcdG1hcmdpbi1yaWdodDogNHB4O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGhlYWRlciB7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IHBhZGRpbmctdG9wOiAxZW07IH1cblx0XHRcdFx0PC9zdHlsZT5cblx0XHRcdDwvaGVhZD5cblx0XHRcdDxib2R5PlxuXHRcdFx0XHQke2NvbnRlbnR9XG5cdFx0XHRcdDxzY3JpcHQgbm9uY2U9XCIke25vbmNlfVwiPlxuXHRcdFx0XHRcdGNvbnN0IHZzY29kZSA9IGFjcXVpcmVWc0NvZGVBcGkoKTtcblx0XHRcdFx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG5cdFx0XHRcdFx0Y29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0XHRcdFx0Y29udGFpbmVyLnN0eWxlLmFsaWduSXRlbXMgPSAnY2VudGVyJztcblxuXHRcdFx0XHRcdGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcblx0XHRcdFx0XHRpbnB1dC50eXBlID0gJ2NoZWNrYm94Jztcblx0XHRcdFx0XHRpbnB1dC5pZCA9ICdzaG93UmVsZWFzZU5vdGVzJztcblx0XHRcdFx0XHRpbnB1dC5jaGVja2VkID0gJHtzaG93UmVsZWFzZU5vdGVzfTtcblx0XHRcdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoaW5wdXQpO1xuXG5cdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsYWJlbCcpO1xuXHRcdFx0XHRcdGxhYmVsLmh0bWxGb3IgPSAnc2hvd1JlbGVhc2VOb3Rlcyc7XG5cdFx0XHRcdFx0bGFiZWwudGV4dENvbnRlbnQgPSAnJHtubHMubG9jYWxpemUoJ3Nob3dPblVwZGF0ZScsIFwiU2hvdyByZWxlYXNlIG5vdGVzIGFmdGVyIGFuIHVwZGF0ZVwiKX0nO1xuXHRcdFx0XHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChsYWJlbCk7XG5cblx0XHRcdFx0XHRjb25zdCBiZWZvcmVFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImJvZHkgPiBoMVwiKT8ubmV4dEVsZW1lbnRTaWJsaW5nO1xuXHRcdFx0XHRcdGlmIChiZWZvcmVFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRkb2N1bWVudC5ib2R5Lmluc2VydEJlZm9yZShjb250YWluZXIsIGJlZm9yZUVsZW1lbnQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBldmVudCA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZXZlbnQuZGF0YS50eXBlID09PSAnc2hvd1JlbGVhc2VOb3RlcycpIHtcblx0XHRcdFx0XHRcdFx0aW5wdXQuY2hlY2tlZCA9IGV2ZW50LmRhdGEudmFsdWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBldmVudCA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBocmVmID0gZXZlbnQudGFyZ2V0LmhyZWYgPz8gZXZlbnQudGFyZ2V0LnBhcmVudEVsZW1lbnQ/LmhyZWYgPz8gZXZlbnQudGFyZ2V0LnBhcmVudEVsZW1lbnQ/LnBhcmVudEVsZW1lbnQ/LmhyZWY7XG5cdFx0XHRcdFx0XHRpZiAoaHJlZiAmJiAoaHJlZi5zdGFydHNXaXRoKCcke1NjaGVtYXMuY29kZVNldHRpbmd9JykpKSB7XG5cdFx0XHRcdFx0XHRcdHZzY29kZS5wb3N0TWVzc2FnZSh7IHR5cGU6ICdjbGlja1NldHRpbmcnLCB2YWx1ZTogeyB1cmk6IGhyZWYsIHg6IGV2ZW50LmNsaWVudFgsIHk6IGV2ZW50LmNsaWVudFkgfX0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgZXZlbnQgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGV2ZW50LmtleUNvZGUgPT09IDEzKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChldmVudC50YXJnZXQuY2hpbGRyZW4ubGVuZ3RoID4gMCAmJiBldmVudC50YXJnZXQuY2hpbGRyZW5bMF0uaHJlZikge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGNsaWVudFJlY3QgPSBldmVudC50YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRcdFx0XHRcdFx0dnNjb2RlLnBvc3RNZXNzYWdlKHsgdHlwZTogJ2NsaWNrU2V0dGluZycsIHZhbHVlOiB7IHVyaTogZXZlbnQudGFyZ2V0LmNoaWxkcmVuWzBdLmhyZWYsIHg6IGNsaWVudFJlY3QucmlnaHQgLCB5OiBjbGllbnRSZWN0LmJvdHRvbSB9fSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGV2ZW50ID0+IHtcblx0XHRcdFx0XHRcdHZzY29kZS5wb3N0TWVzc2FnZSh7IHR5cGU6ICdzaG93UmVsZWFzZU5vdGVzJywgdmFsdWU6IGlucHV0LmNoZWNrZWQgfSwgJyonKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0PC9zY3JpcHQ+XG5cdFx0XHQ8L2JvZHk+XG5cdFx0PC9odG1sPmA7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlOiBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3VwZGF0ZS5zaG93UmVsZWFzZU5vdGVzJykpIHtcblx0XHRcdHRoaXMudXBkYXRlQ2hlY2tib3hXZWJ2aWV3KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZUFjdGl2ZVdlYnZpZXdFZGl0b3IoaW5wdXQ6IFdlYnZpZXdJbnB1dCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmIChpbnB1dCAmJiBpbnB1dCA9PT0gdGhpcy5fY3VycmVudFJlbGVhc2VOb3Rlcykge1xuXHRcdFx0dGhpcy51cGRhdGVDaGVja2JveFdlYnZpZXcoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNoZWNrYm94V2VidmlldygpIHtcblx0XHRpZiAodGhpcy5fY3VycmVudFJlbGVhc2VOb3Rlcykge1xuXHRcdFx0dGhpcy5fY3VycmVudFJlbGVhc2VOb3Rlcy53ZWJ2aWV3LnBvc3RNZXNzYWdlKHtcblx0XHRcdFx0dHlwZTogJ3Nob3dSZWxlYXNlTm90ZXMnLFxuXHRcdFx0XHR2YWx1ZTogdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3VwZGF0ZS5zaG93UmVsZWFzZU5vdGVzJylcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLHdCQUF3QjtBQUNqQyxZQUFZLFNBQVM7QUFDckIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxz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
