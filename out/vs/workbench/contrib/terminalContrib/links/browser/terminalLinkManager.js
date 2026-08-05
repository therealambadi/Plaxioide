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
import { EventType } from "../../../../../base/browser/dom.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { DisposableStore, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { isMacintosh, OS } from "../../../../../base/common/platform.js";
import { URI } from "../../../../../base/common/uri.js";
import * as nls from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ITunnelService } from "../../../../../platform/tunnel/common/tunnel.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { TerminalExternalLinkDetector } from "./terminalExternalLinkDetector.js";
import { TerminalLinkDetectorAdapter } from "./terminalLinkDetectorAdapter.js";
import { TerminalLocalFileLinkOpener, TerminalLocalFolderInWorkspaceLinkOpener, TerminalLocalFolderOutsideWorkspaceLinkOpener, TerminalSearchLinkOpener, TerminalUrlLinkOpener } from "./terminalLinkOpeners.js";
import { TerminalLocalLinkDetector } from "./terminalLocalLinkDetector.js";
import { TerminalUriLinkDetector } from "./terminalUriLinkDetector.js";
import { TerminalWordLinkDetector } from "./terminalWordLinkDetector.js";
import { ITerminalConfigurationService, TerminalLinkQuickPickEvent } from "../../../terminal/browser/terminal.js";
import { TerminalHover } from "../../../terminal/browser/widgets/terminalHoverWidget.js";
import { TERMINAL_CONFIG_SECTION } from "../../../terminal/common/terminal.js";
import { convertBufferRangeToViewport } from "./terminalLinkHelpers.js";
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { ITerminalLogService } from "../../../../../platform/terminal/common/terminal.js";
import { TerminalMultiLineLinkDetector } from "./terminalMultiLineLinkDetector.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
let TerminalLinkManager = class extends DisposableStore {
  constructor(_xterm, _processInfo, capabilities, _linkResolver, _configurationService, _instantiationService, notificationService, terminalConfigurationService, _logService, _tunnelService) {
    super();
    this._xterm = _xterm;
    this._processInfo = _processInfo;
    this._linkResolver = _linkResolver;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._tunnelService = _tunnelService;
    this._standardLinkProviders = /* @__PURE__ */ new Map();
    this._linkProvidersDisposables = [];
    this._externalLinkProviders = [];
    this._openers = /* @__PURE__ */ new Map();
    let enableFileLinks = true;
    const enableFileLinksConfig = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).enableFileLinks;
    switch (enableFileLinksConfig) {
      case "off":
      case false:
        enableFileLinks = false;
        break;
      case "notRemote":
        enableFileLinks = !this._processInfo.remoteAuthority;
        break;
    }
    if (enableFileLinks) {
      this._setupLinkDetector(TerminalMultiLineLinkDetector.id, this._instantiationService.createInstance(TerminalMultiLineLinkDetector, this._xterm, this._processInfo, this._linkResolver));
      this._setupLinkDetector(TerminalLocalLinkDetector.id, this._instantiationService.createInstance(TerminalLocalLinkDetector, this._xterm, capabilities, this._processInfo, this._linkResolver));
    }
    this._setupLinkDetector(TerminalUriLinkDetector.id, this._instantiationService.createInstance(TerminalUriLinkDetector, this._xterm, this._processInfo, this._linkResolver));
    this._setupLinkDetector(TerminalWordLinkDetector.id, this.add(this._instantiationService.createInstance(TerminalWordLinkDetector, this._xterm)));
    const localFileOpener = this._instantiationService.createInstance(TerminalLocalFileLinkOpener);
    const localFolderInWorkspaceOpener = this._instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
    this._openers.set(TerminalBuiltinLinkType.LocalFile, localFileOpener);
    this._openers.set(TerminalBuiltinLinkType.LocalFolderInWorkspace, localFolderInWorkspaceOpener);
    this._openers.set(TerminalBuiltinLinkType.LocalFolderOutsideWorkspace, this._instantiationService.createInstance(TerminalLocalFolderOutsideWorkspaceLinkOpener));
    this._openers.set(TerminalBuiltinLinkType.Search, this._instantiationService.createInstance(TerminalSearchLinkOpener, capabilities, this._processInfo.initialCwd, localFileOpener, localFolderInWorkspaceOpener, () => this._processInfo.os || OS));
    this._openers.set(TerminalBuiltinLinkType.Url, this._instantiationService.createInstance(TerminalUrlLinkOpener, !!this._processInfo.remoteAuthority));
    this._registerStandardLinkProviders();
    let activeHoverDisposable;
    let activeTooltipScheduler;
    this.add(toDisposable(() => {
      this._clearLinkProviders();
      dispose(this._externalLinkProviders);
      activeHoverDisposable?.dispose();
      activeTooltipScheduler?.dispose();
    }));
    this._xterm.options.linkHandler = {
      allowNonHttpProtocols: true,
      activate: (event, text) => {
        if (!this._isLinkActivationModifierDown(event)) {
          return;
        }
        const colonIndex = text.indexOf(":");
        if (colonIndex === -1) {
          throw new Error(`Could not find scheme in link "${text}"`);
        }
        const scheme = text.substring(0, colonIndex);
        if (terminalConfigurationService.config.allowedLinkSchemes.indexOf(scheme) === -1) {
          notificationService.prompt(Severity.Warning, nls.localize("scheme", "Opening URIs can be insecure, do you want to allow opening links with the scheme {0}?", scheme), [
            {
              label: nls.localize("allow", "Allow {0}", scheme),
              run: () => {
                const allowedLinkSchemes = [
                  ...terminalConfigurationService.config.allowedLinkSchemes,
                  scheme
                ];
                this._configurationService.updateValue(`terminal.integrated.allowedLinkSchemes`, allowedLinkSchemes);
              }
            }
          ]);
        }
        this._openers.get(TerminalBuiltinLinkType.Url)?.open({
          type: TerminalBuiltinLinkType.Url,
          text,
          bufferRange: null,
          uri: URI.parse(text)
        });
      },
      hover: (e, text, range) => {
        activeHoverDisposable?.dispose();
        activeHoverDisposable = void 0;
        activeTooltipScheduler?.dispose();
        activeTooltipScheduler = new RunOnceScheduler(() => {
          const core = this._xterm._core;
          const cellDimensions = {
            width: core._renderService.dimensions.css.cell.width,
            height: core._renderService.dimensions.css.cell.height
          };
          const terminalDimensions = {
            width: this._xterm.cols,
            height: this._xterm.rows
          };
          activeHoverDisposable = this._showHover({
            viewportRange: convertBufferRangeToViewport(range, this._xterm.buffer.active.viewportY),
            cellDimensions,
            terminalDimensions
          }, this._getLinkHoverString(text, text), void 0, (text2) => this._xterm.options.linkHandler?.activate(e, text2, range));
          activeTooltipScheduler?.dispose();
          activeTooltipScheduler = void 0;
        }, this._configurationService.getValue("workbench.hover.delay"));
        activeTooltipScheduler.schedule();
      }
    };
  }
  _setupLinkDetector(id, detector, isExternal = false) {
    const detectorAdapter = this.add(this._instantiationService.createInstance(TerminalLinkDetectorAdapter, detector));
    this.add(detectorAdapter.onDidActivateLink((e) => {
      e.event?.preventDefault();
      if (e.event && !(e.event instanceof TerminalLinkQuickPickEvent) && !this._isLinkActivationModifierDown(e.event)) {
        return;
      }
      if (e.link.activate) {
        e.link.activate(e.link.text);
      } else {
        this._openLink(e.link);
      }
    }));
    this.add(detectorAdapter.onDidShowHover((e) => this._tooltipCallback(e.link, e.viewportRange, e.modifierDownCallback, e.modifierUpCallback)));
    if (!isExternal) {
      this._standardLinkProviders.set(id, detectorAdapter);
    }
    return detectorAdapter;
  }
  async _openLink(link) {
    this._logService.debug("Opening link", link);
    const opener = this._openers.get(link.type);
    if (!opener) {
      throw new Error(`No matching opener for link type "${link.type}"`);
    }
    await opener.open(link);
  }
  async openRecentLink(type) {
    let links;
    let i = this._xterm.buffer.active.length;
    while ((!links || links.length === 0) && i >= this._xterm.buffer.active.viewportY) {
      links = await this._getLinksForType(i, type);
      i--;
    }
    if (!links || links.length < 1) {
      return void 0;
    }
    const event = new TerminalLinkQuickPickEvent(EventType.CLICK);
    links[0].activate(event, links[0].text);
    return links[0];
  }
  async getLinks() {
    const viewportLinksByLinePromises = [];
    for (let i = this._xterm.buffer.active.viewportY + this._xterm.rows - 1; i >= this._xterm.buffer.active.viewportY; i--) {
      viewportLinksByLinePromises.push(this._getLinksForLine(i));
    }
    const viewportLinksByLine = await Promise.all(viewportLinksByLinePromises);
    const viewportLinks = {
      wordLinks: [],
      webLinks: [],
      fileLinks: [],
      folderLinks: []
    };
    for (const links of viewportLinksByLine) {
      if (links) {
        const { wordLinks, webLinks, fileLinks, folderLinks } = links;
        if (wordLinks?.length) {
          viewportLinks.wordLinks.push(...wordLinks.reverse());
        }
        if (webLinks?.length) {
          viewportLinks.webLinks.push(...webLinks.reverse());
        }
        if (fileLinks?.length) {
          viewportLinks.fileLinks.push(...fileLinks.reverse());
        }
        if (folderLinks?.length) {
          viewportLinks.folderLinks.push(...folderLinks.reverse());
        }
      }
    }
    const aboveViewportLinksPromises = [];
    for (let i = this._xterm.buffer.active.viewportY - 1; i >= 0; i--) {
      aboveViewportLinksPromises.push(this._getLinksForLine(i));
    }
    const belowViewportLinksPromises = [];
    for (let i = this._xterm.buffer.active.length - 1; i >= this._xterm.buffer.active.viewportY + this._xterm.rows; i--) {
      belowViewportLinksPromises.push(this._getLinksForLine(i));
    }
    const allLinks = Promise.all(aboveViewportLinksPromises).then(async (aboveViewportLinks) => {
      const belowViewportLinks = await Promise.all(belowViewportLinksPromises);
      const allResults = {
        wordLinks: [...viewportLinks.wordLinks],
        webLinks: [...viewportLinks.webLinks],
        fileLinks: [...viewportLinks.fileLinks],
        folderLinks: [...viewportLinks.folderLinks]
      };
      for (const links of [...belowViewportLinks, ...aboveViewportLinks]) {
        if (links) {
          const { wordLinks, webLinks, fileLinks, folderLinks } = links;
          if (wordLinks?.length) {
            allResults.wordLinks.push(...wordLinks.reverse());
          }
          if (webLinks?.length) {
            allResults.webLinks.push(...webLinks.reverse());
          }
          if (fileLinks?.length) {
            allResults.fileLinks.push(...fileLinks.reverse());
          }
          if (folderLinks?.length) {
            allResults.folderLinks.push(...folderLinks.reverse());
          }
        }
      }
      return allResults;
    });
    return {
      viewport: viewportLinks,
      all: allLinks
    };
  }
  async _getLinksForLine(y) {
    const unfilteredWordLinks = await this._getLinksForType(y, "word");
    const webLinks = await this._getLinksForType(y, "url");
    const fileLinks = await this._getLinksForType(y, "localFile");
    const folderLinks = await this._getLinksForType(y, "localFolder");
    const words = /* @__PURE__ */ new Set();
    let wordLinks;
    if (unfilteredWordLinks) {
      wordLinks = [];
      for (const link of unfilteredWordLinks) {
        if (!words.has(link.text) && link.text.length > 1) {
          wordLinks.push(link);
          words.add(link.text);
        }
      }
    }
    return { wordLinks, webLinks, fileLinks, folderLinks };
  }
  async _getLinksForType(y, type) {
    switch (type) {
      case "word":
        return await new Promise((r) => this._standardLinkProviders.get(TerminalWordLinkDetector.id)?.provideLinks(y, r));
      case "url":
        return await new Promise((r) => this._standardLinkProviders.get(TerminalUriLinkDetector.id)?.provideLinks(y, r));
      case "localFile": {
        const links = await new Promise((r) => this._standardLinkProviders.get(TerminalLocalLinkDetector.id)?.provideLinks(y, r));
        return links?.filter((link) => link.type === TerminalBuiltinLinkType.LocalFile);
      }
      case "localFolder": {
        const links = await new Promise((r) => this._standardLinkProviders.get(TerminalLocalLinkDetector.id)?.provideLinks(y, r));
        return links?.filter((link) => link.type === TerminalBuiltinLinkType.LocalFolderInWorkspace);
      }
    }
  }
  _tooltipCallback(link, viewportRange, modifierDownCallback, modifierUpCallback) {
    if (!this._widgetManager) {
      return;
    }
    const core = this._xterm._core;
    const cellDimensions = {
      width: core._renderService.dimensions.css.cell.width,
      height: core._renderService.dimensions.css.cell.height
    };
    const terminalDimensions = {
      width: this._xterm.cols,
      height: this._xterm.rows
    };
    this._showHover({
      viewportRange,
      cellDimensions,
      terminalDimensions,
      modifierDownCallback,
      modifierUpCallback
    }, this._getLinkHoverString(link.text, link.label), link.actions, (text) => link.activate(void 0, text), link);
  }
  _showHover(targetOptions, text, actions, linkHandler, link) {
    if (this._widgetManager) {
      const widget = this._instantiationService.createInstance(TerminalHover, targetOptions, text, actions, linkHandler);
      const attached = this._widgetManager.attachWidget(widget);
      if (attached) {
        link?.onInvalidated(() => attached.dispose());
      }
      return attached;
    }
    return void 0;
  }
  setWidgetManager(widgetManager) {
    this._widgetManager = widgetManager;
  }
  _clearLinkProviders() {
    dispose(this._linkProvidersDisposables);
    this._linkProvidersDisposables.length = 0;
  }
  _registerStandardLinkProviders() {
    const proxyLinkProvider = async (bufferLineNumber) => {
      return this.externalProvideLinksCb?.(bufferLineNumber);
    };
    const detectorId = `extension-${this._externalLinkProviders.length}`;
    const wrappedLinkProvider = this._setupLinkDetector(detectorId, new TerminalExternalLinkDetector(detectorId, this._xterm, proxyLinkProvider), true);
    this._linkProvidersDisposables.push(this._xterm.registerLinkProvider(wrappedLinkProvider));
    for (const p of this._standardLinkProviders.values()) {
      this._linkProvidersDisposables.push(this._xterm.registerLinkProvider(p));
    }
  }
  _isLinkActivationModifierDown(event) {
    const editorConf = this._configurationService.getValue("editor");
    if (editorConf.multiCursorModifier === "ctrlCmd") {
      return !!event.altKey;
    }
    return isMacintosh ? event.metaKey : event.ctrlKey;
  }
  _getLinkHoverString(uri, label) {
    const editorConf = this._configurationService.getValue("editor");
    let clickLabel = "";
    if (editorConf.multiCursorModifier === "ctrlCmd") {
      if (isMacintosh) {
        clickLabel = nls.localize("terminalLinkHandler.followLinkAlt.mac", "option + click");
      } else {
        clickLabel = nls.localize("terminalLinkHandler.followLinkAlt", "alt + click");
      }
    } else {
      if (isMacintosh) {
        clickLabel = nls.localize("terminalLinkHandler.followLinkCmd", "cmd + click");
      } else {
        clickLabel = nls.localize("terminalLinkHandler.followLinkCtrl", "ctrl + click");
      }
    }
    let fallbackLabel = nls.localize("followLink", "Follow link");
    try {
      if (this._tunnelService.canTunnel(URI.parse(uri))) {
        fallbackLabel = nls.localize("followForwardedLink", "Follow link using forwarded port");
      }
    } catch {
    }
    const markdown = new MarkdownString("", true);
    if (label) {
      label = markdown.appendText(label).value;
      markdown.value = "";
    }
    if (uri) {
      uri = markdown.appendText(uri).value;
      markdown.value = "";
    }
    label = label || fallbackLabel;
    uri = uri || label;
    if (/(\s|&nbsp;)/.test(uri)) {
      uri = nls.localize("followLinkUrl", "Link");
    }
    return markdown.appendLink(uri, label).appendMarkdown(` (${clickLabel})`);
  }
};
TerminalLinkManager = __decorateClass([
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, ITerminalConfigurationService),
  __decorateParam(8, ITerminalLogService),
  __decorateParam(9, ITunnelService)
], TerminalLinkManager);
export {
  TerminalLinkManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbExpbmtNYW5hZ2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBkaXNwb3NlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzTWFjaW50b3NoLCBPUyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVHVubmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3R1bm5lbC9jb21tb24vdHVubmVsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbExpbmtEZXRlY3RvciwgSVRlcm1pbmFsTGlua09wZW5lciwgSVRlcm1pbmFsTGlua1Jlc29sdmVyLCBJVGVybWluYWxTaW1wbGVMaW5rLCBPbWl0Rmlyc3RBcmcsIFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLCBUZXJtaW5hbExpbmtUeXBlIH0gZnJvbSAnLi9saW5rcy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEV4dGVybmFsTGlua0RldGVjdG9yIH0gZnJvbSAnLi90ZXJtaW5hbEV4dGVybmFsTGlua0RldGVjdG9yLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsTGluayB9IGZyb20gJy4vdGVybWluYWxMaW5rLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsTGlua0RldGVjdG9yQWRhcHRlciB9IGZyb20gJy4vdGVybWluYWxMaW5rRGV0ZWN0b3JBZGFwdGVyLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsTG9jYWxGaWxlTGlua09wZW5lciwgVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lciwgVGVybWluYWxMb2NhbEZvbGRlck91dHNpZGVXb3Jrc3BhY2VMaW5rT3BlbmVyLCBUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIsIFRlcm1pbmFsVXJsTGlua09wZW5lciB9IGZyb20gJy4vdGVybWluYWxMaW5rT3BlbmVycy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbExvY2FsTGlua0RldGVjdG9yIH0gZnJvbSAnLi90ZXJtaW5hbExvY2FsTGlua0RldGVjdG9yLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsVXJpTGlua0RldGVjdG9yIH0gZnJvbSAnLi90ZXJtaW5hbFVyaUxpbmtEZXRlY3Rvci5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFdvcmRMaW5rRGV0ZWN0b3IgfSBmcm9tICcuL3Rlcm1pbmFsV29yZExpbmtEZXRlY3Rvci5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSwgSVRlcm1pbmFsRXh0ZXJuYWxMaW5rUHJvdmlkZXIsIFRlcm1pbmFsTGlua1F1aWNrUGlja0V2ZW50IH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJTGlua0hvdmVyVGFyZ2V0T3B0aW9ucywgVGVybWluYWxIb3ZlciB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvd2lkZ2V0cy90ZXJtaW5hbEhvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IFRlcm1pbmFsV2lkZ2V0TWFuYWdlciB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvd2lkZ2V0cy93aWRnZXRNYW5hZ2VyLmpzJztcbmltcG9ydCB7IElYdGVybUNvcmUgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3h0ZXJtLXByaXZhdGUuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29uZmlndXJhdGlvbiwgSVRlcm1pbmFsUHJvY2Vzc0luZm8sIFRFUk1JTkFMX0NPTkZJR19TRUNUSU9OIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB0eXBlIHsgSUxpbmssIElMaW5rUHJvdmlkZXIsIElWaWV3cG9ydFJhbmdlLCBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBjb252ZXJ0QnVmZmVyUmFuZ2VUb1ZpZXdwb3J0IH0gZnJvbSAnLi90ZXJtaW5hbExpbmtIZWxwZXJzLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yIH0gZnJvbSAnLi90ZXJtaW5hbE11bHRpTGluZUxpbmtEZXRlY3Rvci5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgdHlwZSB7IElIb3ZlckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3Zlci5qcyc7XG5cbmV4cG9ydCB0eXBlIFh0ZXJtTGlua01hdGNoZXJIYW5kbGVyID0gKGV2ZW50OiBNb3VzZUV2ZW50IHwgdW5kZWZpbmVkLCBsaW5rOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD47XG5cbi8qKlxuICogQW4gb2JqZWN0IHJlc3BvbnNpYmxlIGZvciBtYW5hZ2luZyByZWdpc3RyYXRpb24gb2YgbGluayBtYXRjaGVycyBhbmQgbGluayBwcm92aWRlcnMuXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbExpbmtNYW5hZ2VyIGV4dGVuZHMgRGlzcG9zYWJsZVN0b3JlIHtcblx0cHJpdmF0ZSBfd2lkZ2V0TWFuYWdlcjogVGVybWluYWxXaWRnZXRNYW5hZ2VyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGFuZGFyZExpbmtQcm92aWRlcnM6IE1hcDxzdHJpbmcsIElMaW5rUHJvdmlkZXI+ID0gbmV3IE1hcCgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9saW5rUHJvdmlkZXJzRGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZXJuYWxMaW5rUHJvdmlkZXJzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX29wZW5lcnM6IE1hcDxUZXJtaW5hbExpbmtUeXBlLCBJVGVybWluYWxMaW5rT3BlbmVyPiA9IG5ldyBNYXAoKTtcblxuXHRleHRlcm5hbFByb3ZpZGVMaW5rc0NiPzogT21pdEZpcnN0QXJnPElUZXJtaW5hbEV4dGVybmFsTGlua1Byb3ZpZGVyWydwcm92aWRlTGlua3MnXT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfeHRlcm06IFRlcm1pbmFsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb2Nlc3NJbmZvOiBJVGVybWluYWxQcm9jZXNzSW5mbyxcblx0XHRjYXBhYmlsaXRpZXM6IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9saW5rUmVzb2x2ZXI6IElUZXJtaW5hbExpbmtSZXNvbHZlcixcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZTogSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbExvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSVRlcm1pbmFsTG9nU2VydmljZSxcblx0XHRASVR1bm5lbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRsZXQgZW5hYmxlRmlsZUxpbmtzOiBib29sZWFuID0gdHJ1ZTtcblx0XHRjb25zdCBlbmFibGVGaWxlTGlua3NDb25maWcgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJVGVybWluYWxDb25maWd1cmF0aW9uPihURVJNSU5BTF9DT05GSUdfU0VDVElPTikuZW5hYmxlRmlsZUxpbmtzIGFzIElUZXJtaW5hbENvbmZpZ3VyYXRpb25bJ2VuYWJsZUZpbGVMaW5rcyddIHwgYm9vbGVhbjtcblx0XHRzd2l0Y2ggKGVuYWJsZUZpbGVMaW5rc0NvbmZpZykge1xuXHRcdFx0Y2FzZSAnb2ZmJzpcblx0XHRcdGNhc2UgZmFsc2U6IC8vIGxlZ2FjeSBmcm9tIHYxLjc1XG5cdFx0XHRcdGVuYWJsZUZpbGVMaW5rcyA9IGZhbHNlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ25vdFJlbW90ZSc6XG5cdFx0XHRcdGVuYWJsZUZpbGVMaW5rcyA9ICF0aGlzLl9wcm9jZXNzSW5mby5yZW1vdGVBdXRob3JpdHk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdC8vIFNldHVwIGxpbmsgZGV0ZWN0b3JzIGluIHRoZWlyIG9yZGVyIG9mIHByaW9yaXR5XG5cdFx0aWYgKGVuYWJsZUZpbGVMaW5rcykge1xuXHRcdFx0dGhpcy5fc2V0dXBMaW5rRGV0ZWN0b3IoVGVybWluYWxNdWx0aUxpbmVMaW5rRGV0ZWN0b3IuaWQsIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yLCB0aGlzLl94dGVybSwgdGhpcy5fcHJvY2Vzc0luZm8sIHRoaXMuX2xpbmtSZXNvbHZlcikpO1xuXHRcdFx0dGhpcy5fc2V0dXBMaW5rRGV0ZWN0b3IoVGVybWluYWxMb2NhbExpbmtEZXRlY3Rvci5pZCwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbExpbmtEZXRlY3RvciwgdGhpcy5feHRlcm0sIGNhcGFiaWxpdGllcywgdGhpcy5fcHJvY2Vzc0luZm8sIHRoaXMuX2xpbmtSZXNvbHZlcikpO1xuXHRcdH1cblx0XHR0aGlzLl9zZXR1cExpbmtEZXRlY3RvcihUZXJtaW5hbFVyaUxpbmtEZXRlY3Rvci5pZCwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxVcmlMaW5rRGV0ZWN0b3IsIHRoaXMuX3h0ZXJtLCB0aGlzLl9wcm9jZXNzSW5mbywgdGhpcy5fbGlua1Jlc29sdmVyKSk7XG5cdFx0dGhpcy5fc2V0dXBMaW5rRGV0ZWN0b3IoVGVybWluYWxXb3JkTGlua0RldGVjdG9yLmlkLCB0aGlzLmFkZCh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbFdvcmRMaW5rRGV0ZWN0b3IsIHRoaXMuX3h0ZXJtKSkpO1xuXG5cdFx0Ly8gU2V0dXAgbGluayBvcGVuZXJzXG5cdFx0Y29uc3QgbG9jYWxGaWxlT3BlbmVyID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZpbGVMaW5rT3BlbmVyKTtcblx0XHRjb25zdCBsb2NhbEZvbGRlckluV29ya3NwYWNlT3BlbmVyID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlckluV29ya3NwYWNlTGlua09wZW5lcik7XG5cdFx0dGhpcy5fb3BlbmVycy5zZXQoVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlLCBsb2NhbEZpbGVPcGVuZXIpO1xuXHRcdHRoaXMuX29wZW5lcnMuc2V0KFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRm9sZGVySW5Xb3Jrc3BhY2UsIGxvY2FsRm9sZGVySW5Xb3Jrc3BhY2VPcGVuZXIpO1xuXHRcdHRoaXMuX29wZW5lcnMuc2V0KFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRm9sZGVyT3V0c2lkZVdvcmtzcGFjZSwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxMb2NhbEZvbGRlck91dHNpZGVXb3Jrc3BhY2VMaW5rT3BlbmVyKSk7XG5cdFx0dGhpcy5fb3BlbmVycy5zZXQoVGVybWluYWxCdWlsdGluTGlua1R5cGUuU2VhcmNoLCB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbFNlYXJjaExpbmtPcGVuZXIsIGNhcGFiaWxpdGllcywgdGhpcy5fcHJvY2Vzc0luZm8uaW5pdGlhbEN3ZCwgbG9jYWxGaWxlT3BlbmVyLCBsb2NhbEZvbGRlckluV29ya3NwYWNlT3BlbmVyLCAoKSA9PiB0aGlzLl9wcm9jZXNzSW5mby5vcyB8fCBPUykpO1xuXHRcdHRoaXMuX29wZW5lcnMuc2V0KFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLlVybCwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxVcmxMaW5rT3BlbmVyLCAhIXRoaXMuX3Byb2Nlc3NJbmZvLnJlbW90ZUF1dGhvcml0eSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXJTdGFuZGFyZExpbmtQcm92aWRlcnMoKTtcblxuXHRcdGxldCBhY3RpdmVIb3ZlckRpc3Bvc2FibGU6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBhY3RpdmVUb29sdGlwU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyIHwgdW5kZWZpbmVkO1xuXHRcdHRoaXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jbGVhckxpbmtQcm92aWRlcnMoKTtcblx0XHRcdGRpc3Bvc2UodGhpcy5fZXh0ZXJuYWxMaW5rUHJvdmlkZXJzKTtcblx0XHRcdGFjdGl2ZUhvdmVyRGlzcG9zYWJsZT8uZGlzcG9zZSgpO1xuXHRcdFx0YWN0aXZlVG9vbHRpcFNjaGVkdWxlcj8uZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl94dGVybS5vcHRpb25zLmxpbmtIYW5kbGVyID0ge1xuXHRcdFx0YWxsb3dOb25IdHRwUHJvdG9jb2xzOiB0cnVlLFxuXHRcdFx0YWN0aXZhdGU6IChldmVudCwgdGV4dCkgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2lzTGlua0FjdGl2YXRpb25Nb2RpZmllckRvd24oZXZlbnQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGNvbG9uSW5kZXggPSB0ZXh0LmluZGV4T2YoJzonKTtcblx0XHRcdFx0aWYgKGNvbG9uSW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCBzY2hlbWUgaW4gbGluayBcIiR7dGV4dH1cImApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHNjaGVtZSA9IHRleHQuc3Vic3RyaW5nKDAsIGNvbG9uSW5kZXgpO1xuXHRcdFx0XHRpZiAodGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5jb25maWcuYWxsb3dlZExpbmtTY2hlbWVzLmluZGV4T2Yoc2NoZW1lKSA9PT0gLTEpIHtcblx0XHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5XYXJuaW5nLCBubHMubG9jYWxpemUoJ3NjaGVtZScsICdPcGVuaW5nIFVSSXMgY2FuIGJlIGluc2VjdXJlLCBkbyB5b3Ugd2FudCB0byBhbGxvdyBvcGVuaW5nIGxpbmtzIHdpdGggdGhlIHNjaGVtZSB7MH0/Jywgc2NoZW1lKSwgW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdhbGxvdycsICdBbGxvdyB7MH0nLCBzY2hlbWUpLFxuXHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBhbGxvd2VkTGlua1NjaGVtZXMgPSBbXG5cdFx0XHRcdFx0XHRcdFx0XHQuLi50ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy5hbGxvd2VkTGlua1NjaGVtZXMsXG5cdFx0XHRcdFx0XHRcdFx0XHRzY2hlbWVcblx0XHRcdFx0XHRcdFx0XHRdO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGB0ZXJtaW5hbC5pbnRlZ3JhdGVkLmFsbG93ZWRMaW5rU2NoZW1lc2AsIGFsbG93ZWRMaW5rU2NoZW1lcyk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9vcGVuZXJzLmdldChUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5VcmwpPy5vcGVuKHtcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5VcmwsXG5cdFx0XHRcdFx0dGV4dCxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogbnVsbCEsXG5cdFx0XHRcdFx0dXJpOiBVUkkucGFyc2UodGV4dClcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdFx0aG92ZXI6IChlLCB0ZXh0LCByYW5nZSkgPT4ge1xuXHRcdFx0XHRhY3RpdmVIb3ZlckRpc3Bvc2FibGU/LmRpc3Bvc2UoKTtcblx0XHRcdFx0YWN0aXZlSG92ZXJEaXNwb3NhYmxlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRhY3RpdmVUb29sdGlwU2NoZWR1bGVyPy5kaXNwb3NlKCk7XG5cdFx0XHRcdGFjdGl2ZVRvb2x0aXBTY2hlZHVsZXIgPSBuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY29yZSA9ICh0aGlzLl94dGVybSBhcyBhbnkpLl9jb3JlIGFzIElYdGVybUNvcmU7XG5cdFx0XHRcdFx0Y29uc3QgY2VsbERpbWVuc2lvbnMgPSB7XG5cdFx0XHRcdFx0XHR3aWR0aDogY29yZS5fcmVuZGVyU2VydmljZS5kaW1lbnNpb25zLmNzcy5jZWxsLndpZHRoLFxuXHRcdFx0XHRcdFx0aGVpZ2h0OiBjb3JlLl9yZW5kZXJTZXJ2aWNlLmRpbWVuc2lvbnMuY3NzLmNlbGwuaGVpZ2h0XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRjb25zdCB0ZXJtaW5hbERpbWVuc2lvbnMgPSB7XG5cdFx0XHRcdFx0XHR3aWR0aDogdGhpcy5feHRlcm0uY29scyxcblx0XHRcdFx0XHRcdGhlaWdodDogdGhpcy5feHRlcm0ucm93c1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0YWN0aXZlSG92ZXJEaXNwb3NhYmxlID0gdGhpcy5fc2hvd0hvdmVyKHtcblx0XHRcdFx0XHRcdHZpZXdwb3J0UmFuZ2U6IGNvbnZlcnRCdWZmZXJSYW5nZVRvVmlld3BvcnQocmFuZ2UsIHRoaXMuX3h0ZXJtLmJ1ZmZlci5hY3RpdmUudmlld3BvcnRZKSxcblx0XHRcdFx0XHRcdGNlbGxEaW1lbnNpb25zLFxuXHRcdFx0XHRcdFx0dGVybWluYWxEaW1lbnNpb25zXG5cdFx0XHRcdFx0fSwgdGhpcy5fZ2V0TGlua0hvdmVyU3RyaW5nKHRleHQsIHRleHQpLCB1bmRlZmluZWQsICh0ZXh0KSA9PiB0aGlzLl94dGVybS5vcHRpb25zLmxpbmtIYW5kbGVyPy5hY3RpdmF0ZShlLCB0ZXh0LCByYW5nZSkpO1xuXHRcdFx0XHRcdC8vIENsZWFyIG91dCBzY2hlZHVsZXIgdW50aWwgbmV4dCBob3ZlciBldmVudFxuXHRcdFx0XHRcdGFjdGl2ZVRvb2x0aXBTY2hlZHVsZXI/LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRhY3RpdmVUb29sdGlwU2NoZWR1bGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9LCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnd29ya2JlbmNoLmhvdmVyLmRlbGF5JykpO1xuXHRcdFx0XHRhY3RpdmVUb29sdGlwU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX3NldHVwTGlua0RldGVjdG9yKGlkOiBzdHJpbmcsIGRldGVjdG9yOiBJVGVybWluYWxMaW5rRGV0ZWN0b3IsIGlzRXh0ZXJuYWw6IGJvb2xlYW4gPSBmYWxzZSk6IElMaW5rUHJvdmlkZXIge1xuXHRcdGNvbnN0IGRldGVjdG9yQWRhcHRlciA9IHRoaXMuYWRkKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlcm1pbmFsTGlua0RldGVjdG9yQWRhcHRlciwgZGV0ZWN0b3IpKTtcblx0XHR0aGlzLmFkZChkZXRlY3RvckFkYXB0ZXIub25EaWRBY3RpdmF0ZUxpbmsoZSA9PiB7XG5cdFx0XHQvLyBQcmV2ZW50IGRlZmF1bHQgZWxlY3Ryb24gbGluayBoYW5kbGluZyBzbyBBbHQrQ2xpY2sgbW9kZSB3b3JrcyBub3JtYWxseVxuXHRcdFx0ZS5ldmVudD8ucHJldmVudERlZmF1bHQoKTtcblx0XHRcdC8vIFJlcXVpcmUgY29ycmVjdCBtb2RpZmllciBvbiBjbGljayB1bmxlc3MgZXZlbnQgaXMgY29taW5nIGZyb20gbGlua1F1aWNrUGljayBzZWxlY3Rpb25cblx0XHRcdGlmIChlLmV2ZW50ICYmICEoZS5ldmVudCBpbnN0YW5jZW9mIFRlcm1pbmFsTGlua1F1aWNrUGlja0V2ZW50KSAmJiAhdGhpcy5faXNMaW5rQWN0aXZhdGlvbk1vZGlmaWVyRG93bihlLmV2ZW50KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQvLyBKdXN0IGNhbGwgdGhlIGhhbmRsZXIgaWYgdGhlcmUgaXMgbm8gYmVmb3JlIGxpc3RlbmVyXG5cdFx0XHRpZiAoZS5saW5rLmFjdGl2YXRlKSB7XG5cdFx0XHRcdC8vIEN1c3RvbSBhY3RpdmF0ZSBjYWxsIChleHRlcm5hbCBsaW5rcyBvbmx5KVxuXHRcdFx0XHRlLmxpbmsuYWN0aXZhdGUoZS5saW5rLnRleHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fb3BlbkxpbmsoZS5saW5rKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5hZGQoZGV0ZWN0b3JBZGFwdGVyLm9uRGlkU2hvd0hvdmVyKGUgPT4gdGhpcy5fdG9vbHRpcENhbGxiYWNrKGUubGluaywgZS52aWV3cG9ydFJhbmdlLCBlLm1vZGlmaWVyRG93bkNhbGxiYWNrLCBlLm1vZGlmaWVyVXBDYWxsYmFjaykpKTtcblx0XHRpZiAoIWlzRXh0ZXJuYWwpIHtcblx0XHRcdHRoaXMuX3N0YW5kYXJkTGlua1Byb3ZpZGVycy5zZXQoaWQsIGRldGVjdG9yQWRhcHRlcik7XG5cdFx0fVxuXHRcdHJldHVybiBkZXRlY3RvckFkYXB0ZXI7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9vcGVuTGluayhsaW5rOiBJVGVybWluYWxTaW1wbGVMaW5rKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZygnT3BlbmluZyBsaW5rJywgbGluayk7XG5cdFx0Y29uc3Qgb3BlbmVyID0gdGhpcy5fb3BlbmVycy5nZXQobGluay50eXBlKTtcblx0XHRpZiAoIW9wZW5lcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyBtYXRjaGluZyBvcGVuZXIgZm9yIGxpbmsgdHlwZSBcIiR7bGluay50eXBlfVwiYCk7XG5cdFx0fVxuXHRcdGF3YWl0IG9wZW5lci5vcGVuKGxpbmspO1xuXHR9XG5cblx0YXN5bmMgb3BlblJlY2VudExpbmsodHlwZTogJ2xvY2FsRmlsZScgfCAndXJsJyk6IFByb21pc2U8SUxpbmsgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgbGlua3M7XG5cdFx0bGV0IGkgPSB0aGlzLl94dGVybS5idWZmZXIuYWN0aXZlLmxlbmd0aDtcblx0XHR3aGlsZSAoKCFsaW5rcyB8fCBsaW5rcy5sZW5ndGggPT09IDApICYmIGkgPj0gdGhpcy5feHRlcm0uYnVmZmVyLmFjdGl2ZS52aWV3cG9ydFkpIHtcblx0XHRcdGxpbmtzID0gYXdhaXQgdGhpcy5fZ2V0TGlua3NGb3JUeXBlKGksIHR5cGUpO1xuXHRcdFx0aS0tO1xuXHRcdH1cblxuXHRcdGlmICghbGlua3MgfHwgbGlua3MubGVuZ3RoIDwgMSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgVGVybWluYWxMaW5rUXVpY2tQaWNrRXZlbnQoRXZlbnRUeXBlLkNMSUNLKTtcblx0XHRsaW5rc1swXS5hY3RpdmF0ZShldmVudCwgbGlua3NbMF0udGV4dCk7XG5cdFx0cmV0dXJuIGxpbmtzWzBdO1xuXHR9XG5cblx0YXN5bmMgZ2V0TGlua3MoKTogUHJvbWlzZTx7IHZpZXdwb3J0OiBJRGV0ZWN0ZWRMaW5rczsgYWxsOiBQcm9taXNlPElEZXRlY3RlZExpbmtzPiB9PiB7XG5cdFx0Ly8gRmV0Y2ggYW5kIGF3YWl0IHRoZSB2aWV3cG9ydCByZXN1bHRzXG5cdFx0Y29uc3Qgdmlld3BvcnRMaW5rc0J5TGluZVByb21pc2VzOiBQcm9taXNlPElEZXRlY3RlZExpbmtzIHwgdW5kZWZpbmVkPltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMuX3h0ZXJtLmJ1ZmZlci5hY3RpdmUudmlld3BvcnRZICsgdGhpcy5feHRlcm0ucm93cyAtIDE7IGkgPj0gdGhpcy5feHRlcm0uYnVmZmVyLmFjdGl2ZS52aWV3cG9ydFk7IGktLSkge1xuXHRcdFx0dmlld3BvcnRMaW5rc0J5TGluZVByb21pc2VzLnB1c2godGhpcy5fZ2V0TGlua3NGb3JMaW5lKGkpKTtcblx0XHR9XG5cdFx0Y29uc3Qgdmlld3BvcnRMaW5rc0J5TGluZSA9IGF3YWl0IFByb21pc2UuYWxsKHZpZXdwb3J0TGlua3NCeUxpbmVQcm9taXNlcyk7XG5cblx0XHQvLyBBc3NlbWJsZSB2aWV3cG9ydCBsaW5rc1xuXHRcdGNvbnN0IHZpZXdwb3J0TGlua3M6IFJlcXVpcmVkPFBpY2s8SURldGVjdGVkTGlua3MsICd3b3JkTGlua3MnIHwgJ3dlYkxpbmtzJyB8ICdmaWxlTGlua3MnIHwgJ2ZvbGRlckxpbmtzJz4+ID0ge1xuXHRcdFx0d29yZExpbmtzOiBbXSxcblx0XHRcdHdlYkxpbmtzOiBbXSxcblx0XHRcdGZpbGVMaW5rczogW10sXG5cdFx0XHRmb2xkZXJMaW5rczogW10sXG5cdFx0fTtcblx0XHRmb3IgKGNvbnN0IGxpbmtzIG9mIHZpZXdwb3J0TGlua3NCeUxpbmUpIHtcblx0XHRcdGlmIChsaW5rcykge1xuXHRcdFx0XHRjb25zdCB7IHdvcmRMaW5rcywgd2ViTGlua3MsIGZpbGVMaW5rcywgZm9sZGVyTGlua3MgfSA9IGxpbmtzO1xuXHRcdFx0XHRpZiAod29yZExpbmtzPy5sZW5ndGgpIHtcblx0XHRcdFx0XHR2aWV3cG9ydExpbmtzLndvcmRMaW5rcy5wdXNoKC4uLndvcmRMaW5rcy5yZXZlcnNlKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh3ZWJMaW5rcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dmlld3BvcnRMaW5rcy53ZWJMaW5rcy5wdXNoKC4uLndlYkxpbmtzLnJldmVyc2UoKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZpbGVMaW5rcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dmlld3BvcnRMaW5rcy5maWxlTGlua3MucHVzaCguLi5maWxlTGlua3MucmV2ZXJzZSgpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZm9sZGVyTGlua3M/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdHZpZXdwb3J0TGlua3MuZm9sZGVyTGlua3MucHVzaCguLi5mb2xkZXJMaW5rcy5yZXZlcnNlKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRmV0Y2ggdGhlIHJlbWFpbmluZyByZXN1bHRzIGFzeW5jXG5cdFx0Y29uc3QgYWJvdmVWaWV3cG9ydExpbmtzUHJvbWlzZXM6IFByb21pc2U8SURldGVjdGVkTGlua3MgfCB1bmRlZmluZWQ+W10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gdGhpcy5feHRlcm0uYnVmZmVyLmFjdGl2ZS52aWV3cG9ydFkgLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0YWJvdmVWaWV3cG9ydExpbmtzUHJvbWlzZXMucHVzaCh0aGlzLl9nZXRMaW5rc0ZvckxpbmUoaSkpO1xuXHRcdH1cblx0XHRjb25zdCBiZWxvd1ZpZXdwb3J0TGlua3NQcm9taXNlczogUHJvbWlzZTxJRGV0ZWN0ZWRMaW5rcyB8IHVuZGVmaW5lZD5bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSB0aGlzLl94dGVybS5idWZmZXIuYWN0aXZlLmxlbmd0aCAtIDE7IGkgPj0gdGhpcy5feHRlcm0uYnVmZmVyLmFjdGl2ZS52aWV3cG9ydFkgKyB0aGlzLl94dGVybS5yb3dzOyBpLS0pIHtcblx0XHRcdGJlbG93Vmlld3BvcnRMaW5rc1Byb21pc2VzLnB1c2godGhpcy5fZ2V0TGlua3NGb3JMaW5lKGkpKTtcblx0XHR9XG5cblx0XHQvLyBBc3NlbWJsZSBhbGwgbGlua3MgaW4gcmVzdWx0c1xuXHRcdGNvbnN0IGFsbExpbmtzOiBQcm9taXNlPFJlcXVpcmVkPFBpY2s8SURldGVjdGVkTGlua3MsICd3b3JkTGlua3MnIHwgJ3dlYkxpbmtzJyB8ICdmaWxlTGlua3MnIHwgJ2ZvbGRlckxpbmtzJz4+PiA9IFByb21pc2UuYWxsKGFib3ZlVmlld3BvcnRMaW5rc1Byb21pc2VzKS50aGVuKGFzeW5jIGFib3ZlVmlld3BvcnRMaW5rcyA9PiB7XG5cdFx0XHRjb25zdCBiZWxvd1ZpZXdwb3J0TGlua3MgPSBhd2FpdCBQcm9taXNlLmFsbChiZWxvd1ZpZXdwb3J0TGlua3NQcm9taXNlcyk7XG5cdFx0XHRjb25zdCBhbGxSZXN1bHRzOiBSZXF1aXJlZDxQaWNrPElEZXRlY3RlZExpbmtzLCAnd29yZExpbmtzJyB8ICd3ZWJMaW5rcycgfCAnZmlsZUxpbmtzJyB8ICdmb2xkZXJMaW5rcyc+PiA9IHtcblx0XHRcdFx0d29yZExpbmtzOiBbLi4udmlld3BvcnRMaW5rcy53b3JkTGlua3NdLFxuXHRcdFx0XHR3ZWJMaW5rczogWy4uLnZpZXdwb3J0TGlua3Mud2ViTGlua3NdLFxuXHRcdFx0XHRmaWxlTGlua3M6IFsuLi52aWV3cG9ydExpbmtzLmZpbGVMaW5rc10sXG5cdFx0XHRcdGZvbGRlckxpbmtzOiBbLi4udmlld3BvcnRMaW5rcy5mb2xkZXJMaW5rc11cblx0XHRcdH07XG5cdFx0XHRmb3IgKGNvbnN0IGxpbmtzIG9mIFsuLi5iZWxvd1ZpZXdwb3J0TGlua3MsIC4uLmFib3ZlVmlld3BvcnRMaW5rc10pIHtcblx0XHRcdFx0aWYgKGxpbmtzKSB7XG5cdFx0XHRcdFx0Y29uc3QgeyB3b3JkTGlua3MsIHdlYkxpbmtzLCBmaWxlTGlua3MsIGZvbGRlckxpbmtzIH0gPSBsaW5rcztcblx0XHRcdFx0XHRpZiAod29yZExpbmtzPy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdGFsbFJlc3VsdHMud29yZExpbmtzLnB1c2goLi4ud29yZExpbmtzLnJldmVyc2UoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh3ZWJMaW5rcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRhbGxSZXN1bHRzLndlYkxpbmtzLnB1c2goLi4ud2ViTGlua3MucmV2ZXJzZSgpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGZpbGVMaW5rcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRhbGxSZXN1bHRzLmZpbGVMaW5rcy5wdXNoKC4uLmZpbGVMaW5rcy5yZXZlcnNlKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZm9sZGVyTGlua3M/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0YWxsUmVzdWx0cy5mb2xkZXJMaW5rcy5wdXNoKC4uLmZvbGRlckxpbmtzLnJldmVyc2UoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWxsUmVzdWx0cztcblx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHR2aWV3cG9ydDogdmlld3BvcnRMaW5rcyxcblx0XHRcdGFsbDogYWxsTGlua3Ncblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZ2V0TGlua3NGb3JMaW5lKHk6IG51bWJlcik6IFByb21pc2U8SURldGVjdGVkTGlua3MgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB1bmZpbHRlcmVkV29yZExpbmtzID0gYXdhaXQgdGhpcy5fZ2V0TGlua3NGb3JUeXBlKHksICd3b3JkJyk7XG5cdFx0Y29uc3Qgd2ViTGlua3MgPSBhd2FpdCB0aGlzLl9nZXRMaW5rc0ZvclR5cGUoeSwgJ3VybCcpO1xuXHRcdGNvbnN0IGZpbGVMaW5rcyA9IGF3YWl0IHRoaXMuX2dldExpbmtzRm9yVHlwZSh5LCAnbG9jYWxGaWxlJyk7XG5cdFx0Y29uc3QgZm9sZGVyTGlua3MgPSBhd2FpdCB0aGlzLl9nZXRMaW5rc0ZvclR5cGUoeSwgJ2xvY2FsRm9sZGVyJyk7XG5cdFx0Y29uc3Qgd29yZHMgPSBuZXcgU2V0KCk7XG5cdFx0bGV0IHdvcmRMaW5rcztcblx0XHRpZiAodW5maWx0ZXJlZFdvcmRMaW5rcykge1xuXHRcdFx0d29yZExpbmtzID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGxpbmsgb2YgdW5maWx0ZXJlZFdvcmRMaW5rcykge1xuXHRcdFx0XHRpZiAoIXdvcmRzLmhhcyhsaW5rLnRleHQpICYmIGxpbmsudGV4dC5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdFx0d29yZExpbmtzLnB1c2gobGluayk7XG5cdFx0XHRcdFx0d29yZHMuYWRkKGxpbmsudGV4dCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHsgd29yZExpbmtzLCB3ZWJMaW5rcywgZmlsZUxpbmtzLCBmb2xkZXJMaW5rcyB9O1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9nZXRMaW5rc0ZvclR5cGUoeTogbnVtYmVyLCB0eXBlOiAnd29yZCcgfCAndXJsJyB8ICdsb2NhbEZpbGUnIHwgJ2xvY2FsRm9sZGVyJyk6IFByb21pc2U8SUxpbmtbXSB8IHVuZGVmaW5lZD4ge1xuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0Y2FzZSAnd29yZCc6XG5cdFx0XHRcdHJldHVybiAoYXdhaXQgbmV3IFByb21pc2U8SUxpbmtbXSB8IHVuZGVmaW5lZD4ociA9PiB0aGlzLl9zdGFuZGFyZExpbmtQcm92aWRlcnMuZ2V0KFRlcm1pbmFsV29yZExpbmtEZXRlY3Rvci5pZCk/LnByb3ZpZGVMaW5rcyh5LCByKSkpO1xuXHRcdFx0Y2FzZSAndXJsJzpcblx0XHRcdFx0cmV0dXJuIChhd2FpdCBuZXcgUHJvbWlzZTxJTGlua1tdIHwgdW5kZWZpbmVkPihyID0+IHRoaXMuX3N0YW5kYXJkTGlua1Byb3ZpZGVycy5nZXQoVGVybWluYWxVcmlMaW5rRGV0ZWN0b3IuaWQpPy5wcm92aWRlTGlua3MoeSwgcikpKTtcblx0XHRcdGNhc2UgJ2xvY2FsRmlsZSc6IHtcblx0XHRcdFx0Y29uc3QgbGlua3MgPSAoYXdhaXQgbmV3IFByb21pc2U8SUxpbmtbXSB8IHVuZGVmaW5lZD4ociA9PiB0aGlzLl9zdGFuZGFyZExpbmtQcm92aWRlcnMuZ2V0KFRlcm1pbmFsTG9jYWxMaW5rRGV0ZWN0b3IuaWQpPy5wcm92aWRlTGlua3MoeSwgcikpKTtcblx0XHRcdFx0cmV0dXJuIGxpbmtzPy5maWx0ZXIobGluayA9PiAobGluayBhcyBUZXJtaW5hbExpbmspLnR5cGUgPT09IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRmlsZSk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdsb2NhbEZvbGRlcic6IHtcblx0XHRcdFx0Y29uc3QgbGlua3MgPSAoYXdhaXQgbmV3IFByb21pc2U8SUxpbmtbXSB8IHVuZGVmaW5lZD4ociA9PiB0aGlzLl9zdGFuZGFyZExpbmtQcm92aWRlcnMuZ2V0KFRlcm1pbmFsTG9jYWxMaW5rRGV0ZWN0b3IuaWQpPy5wcm92aWRlTGlua3MoeSwgcikpKTtcblx0XHRcdFx0cmV0dXJuIGxpbmtzPy5maWx0ZXIobGluayA9PiAobGluayBhcyBUZXJtaW5hbExpbmspLnR5cGUgPT09IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRm9sZGVySW5Xb3Jrc3BhY2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Rvb2x0aXBDYWxsYmFjayhsaW5rOiBUZXJtaW5hbExpbmssIHZpZXdwb3J0UmFuZ2U6IElWaWV3cG9ydFJhbmdlLCBtb2RpZmllckRvd25DYWxsYmFjaz86ICgpID0+IHZvaWQsIG1vZGlmaWVyVXBDYWxsYmFjaz86ICgpID0+IHZvaWQpIHtcblx0XHRpZiAoIXRoaXMuX3dpZGdldE1hbmFnZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb3JlID0gKHRoaXMuX3h0ZXJtIGFzIGFueSkuX2NvcmUgYXMgSVh0ZXJtQ29yZTtcblx0XHRjb25zdCBjZWxsRGltZW5zaW9ucyA9IHtcblx0XHRcdHdpZHRoOiBjb3JlLl9yZW5kZXJTZXJ2aWNlLmRpbWVuc2lvbnMuY3NzLmNlbGwud2lkdGgsXG5cdFx0XHRoZWlnaHQ6IGNvcmUuX3JlbmRlclNlcnZpY2UuZGltZW5zaW9ucy5jc3MuY2VsbC5oZWlnaHRcblx0XHR9O1xuXHRcdGNvbnN0IHRlcm1pbmFsRGltZW5zaW9ucyA9IHtcblx0XHRcdHdpZHRoOiB0aGlzLl94dGVybS5jb2xzLFxuXHRcdFx0aGVpZ2h0OiB0aGlzLl94dGVybS5yb3dzXG5cdFx0fTtcblxuXHRcdC8vIERvbid0IHBhc3MgdGhlIG1vdXNlIGV2ZW50IGFzIHRoaXMgYXZvaWRzIHRoZSBtb2RpZmllciBjaGVja1xuXHRcdHRoaXMuX3Nob3dIb3Zlcih7XG5cdFx0XHR2aWV3cG9ydFJhbmdlLFxuXHRcdFx0Y2VsbERpbWVuc2lvbnMsXG5cdFx0XHR0ZXJtaW5hbERpbWVuc2lvbnMsXG5cdFx0XHRtb2RpZmllckRvd25DYWxsYmFjayxcblx0XHRcdG1vZGlmaWVyVXBDYWxsYmFja1xuXHRcdH0sIHRoaXMuX2dldExpbmtIb3ZlclN0cmluZyhsaW5rLnRleHQsIGxpbmsubGFiZWwpLCBsaW5rLmFjdGlvbnMsICh0ZXh0KSA9PiBsaW5rLmFjdGl2YXRlKHVuZGVmaW5lZCwgdGV4dCksIGxpbmspO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd0hvdmVyKFxuXHRcdHRhcmdldE9wdGlvbnM6IElMaW5rSG92ZXJUYXJnZXRPcHRpb25zLFxuXHRcdHRleHQ6IElNYXJrZG93blN0cmluZyxcblx0XHRhY3Rpb25zOiBJSG92ZXJBY3Rpb25bXSB8IHVuZGVmaW5lZCxcblx0XHRsaW5rSGFuZGxlcjogKHVybDogc3RyaW5nKSA9PiB2b2lkLFxuXHRcdGxpbms/OiBUZXJtaW5hbExpbmtcblx0KTogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl93aWRnZXRNYW5hZ2VyKSB7XG5cdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbEhvdmVyLCB0YXJnZXRPcHRpb25zLCB0ZXh0LCBhY3Rpb25zLCBsaW5rSGFuZGxlcik7XG5cdFx0XHRjb25zdCBhdHRhY2hlZCA9IHRoaXMuX3dpZGdldE1hbmFnZXIuYXR0YWNoV2lkZ2V0KHdpZGdldCk7XG5cdFx0XHRpZiAoYXR0YWNoZWQpIHtcblx0XHRcdFx0bGluaz8ub25JbnZhbGlkYXRlZCgoKSA9PiBhdHRhY2hlZC5kaXNwb3NlKCkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGF0dGFjaGVkO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0c2V0V2lkZ2V0TWFuYWdlcih3aWRnZXRNYW5hZ2VyOiBUZXJtaW5hbFdpZGdldE1hbmFnZXIpOiB2b2lkIHtcblx0XHR0aGlzLl93aWRnZXRNYW5hZ2VyID0gd2lkZ2V0TWFuYWdlcjtcblx0fVxuXG5cdHByaXZhdGUgX2NsZWFyTGlua1Byb3ZpZGVycygpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMuX2xpbmtQcm92aWRlcnNEaXNwb3NhYmxlcyk7XG5cdFx0dGhpcy5fbGlua1Byb3ZpZGVyc0Rpc3Bvc2FibGVzLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3RlclN0YW5kYXJkTGlua1Byb3ZpZGVycygpOiB2b2lkIHtcblx0XHQvLyBGb3J3YXJkIGFueSBleHRlcm5hbCBsaW5rIHByb3ZpZGVyIHJlcXVlc3RzIHRvIHRoZSByZWdpc3RlcmVkIHByb3ZpZGVyIGlmIGl0IGV4aXN0cy4gVGhpc1xuXHRcdC8vIGhlbHBzIG1haW50YWluIHRoZSByZWxhdGl2ZSBwcmlvcml0eSBvZiB0aGUgbGluayBwcm92aWRlcnMgYXMgaXQncyBkZWZpbmVkIGJ5IHRoZSBvcmRlclxuXHRcdC8vIGluIHdoaWNoIHRoZXkncmUgcmVnaXN0ZXJlZCBpbiB4dGVybS5qcy5cblx0XHQvL1xuXHRcdC8qKlxuXHRcdCAqIFRoZXJlJ3MgYSBiaXQgZ29pbmcgb24gaGVyZSBidXQgaGVyZSdzIGFub3RoZXIgdmlldzpcblx0XHQgKiAtIHtAbGluayBleHRlcm5hbFByb3ZpZGVMaW5rc0NifSBUaGUgZXh0ZXJuYWwgY2FsbGJhY2sgdGhhdCBnaXZlcyB0aGUgbGlua3MgKGVnLiBmcm9tXG5cdFx0ICogICBleHRob3N0KVxuXHRcdCAqIC0ge0BsaW5rIHByb3h5TGlua1Byb3ZpZGVyfSBBIHByb3h5IHRoYXQgZm9yd2FyZHMgdGhlIGNhbGwgb3ZlciB0b1xuXHRcdCAqICAge0BsaW5rIGV4dGVybmFsUHJvdmlkZUxpbmtzQ2J9XG5cdFx0ICogLSB7QGxpbmsgd3JhcHBlZExpbmtQcm92aWRlcn0gV3JhcHMgdGhlIGFib3ZlIGluIGFuIGBUZXJtaW5hbExpbmtEZXRlY3RvckFkYXB0ZXJgXG5cdFx0ICovXG5cdFx0Y29uc3QgcHJveHlMaW5rUHJvdmlkZXI6IE9taXRGaXJzdEFyZzxJVGVybWluYWxFeHRlcm5hbExpbmtQcm92aWRlclsncHJvdmlkZUxpbmtzJ10+ID0gYXN5bmMgKGJ1ZmZlckxpbmVOdW1iZXIpID0+IHtcblx0XHRcdHJldHVybiB0aGlzLmV4dGVybmFsUHJvdmlkZUxpbmtzQ2I/LihidWZmZXJMaW5lTnVtYmVyKTtcblx0XHR9O1xuXHRcdGNvbnN0IGRldGVjdG9ySWQgPSBgZXh0ZW5zaW9uLSR7dGhpcy5fZXh0ZXJuYWxMaW5rUHJvdmlkZXJzLmxlbmd0aH1gO1xuXHRcdGNvbnN0IHdyYXBwZWRMaW5rUHJvdmlkZXIgPSB0aGlzLl9zZXR1cExpbmtEZXRlY3RvcihkZXRlY3RvcklkLCBuZXcgVGVybWluYWxFeHRlcm5hbExpbmtEZXRlY3RvcihkZXRlY3RvcklkLCB0aGlzLl94dGVybSwgcHJveHlMaW5rUHJvdmlkZXIpLCB0cnVlKTtcblx0XHR0aGlzLl9saW5rUHJvdmlkZXJzRGlzcG9zYWJsZXMucHVzaCh0aGlzLl94dGVybS5yZWdpc3RlckxpbmtQcm92aWRlcih3cmFwcGVkTGlua1Byb3ZpZGVyKSk7XG5cblx0XHRmb3IgKGNvbnN0IHAgb2YgdGhpcy5fc3RhbmRhcmRMaW5rUHJvdmlkZXJzLnZhbHVlcygpKSB7XG5cdFx0XHR0aGlzLl9saW5rUHJvdmlkZXJzRGlzcG9zYWJsZXMucHVzaCh0aGlzLl94dGVybS5yZWdpc3RlckxpbmtQcm92aWRlcihwKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIF9pc0xpbmtBY3RpdmF0aW9uTW9kaWZpZXJEb3duKGV2ZW50OiBNb3VzZUV2ZW50KTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZWRpdG9yQ29uZiA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHsgbXVsdGlDdXJzb3JNb2RpZmllcjogJ2N0cmxDbWQnIHwgJ2FsdCcgfT4oJ2VkaXRvcicpO1xuXHRcdGlmIChlZGl0b3JDb25mLm11bHRpQ3Vyc29yTW9kaWZpZXIgPT09ICdjdHJsQ21kJykge1xuXHRcdFx0cmV0dXJuICEhZXZlbnQuYWx0S2V5O1xuXHRcdH1cblx0XHRyZXR1cm4gaXNNYWNpbnRvc2ggPyBldmVudC5tZXRhS2V5IDogZXZlbnQuY3RybEtleTtcblx0fVxuXG5cdHByaXZhdGUgX2dldExpbmtIb3ZlclN0cmluZyh1cmk6IHN0cmluZywgbGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZCk6IElNYXJrZG93blN0cmluZyB7XG5cdFx0Y29uc3QgZWRpdG9yQ29uZiA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHsgbXVsdGlDdXJzb3JNb2RpZmllcjogJ2N0cmxDbWQnIHwgJ2FsdCcgfT4oJ2VkaXRvcicpO1xuXG5cdFx0bGV0IGNsaWNrTGFiZWwgPSAnJztcblx0XHRpZiAoZWRpdG9yQ29uZi5tdWx0aUN1cnNvck1vZGlmaWVyID09PSAnY3RybENtZCcpIHtcblx0XHRcdGlmIChpc01hY2ludG9zaCkge1xuXHRcdFx0XHRjbGlja0xhYmVsID0gbmxzLmxvY2FsaXplKCd0ZXJtaW5hbExpbmtIYW5kbGVyLmZvbGxvd0xpbmtBbHQubWFjJywgXCJvcHRpb24gKyBjbGlja1wiKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNsaWNrTGFiZWwgPSBubHMubG9jYWxpemUoJ3Rlcm1pbmFsTGlua0hhbmRsZXIuZm9sbG93TGlua0FsdCcsIFwiYWx0ICsgY2xpY2tcIik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChpc01hY2ludG9zaCkge1xuXHRcdFx0XHRjbGlja0xhYmVsID0gbmxzLmxvY2FsaXplKCd0ZXJtaW5hbExpbmtIYW5kbGVyLmZvbGxvd0xpbmtDbWQnLCBcImNtZCArIGNsaWNrXCIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2xpY2tMYWJlbCA9IG5scy5sb2NhbGl6ZSgndGVybWluYWxMaW5rSGFuZGxlci5mb2xsb3dMaW5rQ3RybCcsIFwiY3RybCArIGNsaWNrXCIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCBmYWxsYmFja0xhYmVsID0gbmxzLmxvY2FsaXplKCdmb2xsb3dMaW5rJywgXCJGb2xsb3cgbGlua1wiKTtcblx0XHR0cnkge1xuXHRcdFx0aWYgKHRoaXMuX3R1bm5lbFNlcnZpY2UuY2FuVHVubmVsKFVSSS5wYXJzZSh1cmkpKSkge1xuXHRcdFx0XHRmYWxsYmFja0xhYmVsID0gbmxzLmxvY2FsaXplKCdmb2xsb3dGb3J3YXJkZWRMaW5rJywgXCJGb2xsb3cgbGluayB1c2luZyBmb3J3YXJkZWQgcG9ydFwiKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIE5vLW9wLCBhbHJlYWR5IHNldCB0byBmYWxsYmFja1xuXHRcdH1cblxuXHRcdGNvbnN0IG1hcmtkb3duID0gbmV3IE1hcmtkb3duU3RyaW5nKCcnLCB0cnVlKTtcblx0XHQvLyBFc2NhcGVzIG1hcmtkb3duIGluIGxhYmVsICYgdXJpXG5cdFx0aWYgKGxhYmVsKSB7XG5cdFx0XHRsYWJlbCA9IG1hcmtkb3duLmFwcGVuZFRleHQobGFiZWwpLnZhbHVlO1xuXHRcdFx0bWFya2Rvd24udmFsdWUgPSAnJztcblx0XHR9XG5cdFx0aWYgKHVyaSkge1xuXHRcdFx0dXJpID0gbWFya2Rvd24uYXBwZW5kVGV4dCh1cmkpLnZhbHVlO1xuXHRcdFx0bWFya2Rvd24udmFsdWUgPSAnJztcblx0XHR9XG5cblx0XHRsYWJlbCA9IGxhYmVsIHx8IGZhbGxiYWNrTGFiZWw7XG5cdFx0Ly8gVXNlIHRoZSBsYWJlbCB3aGVuIHVyaSBpcyAnJyBzbyB0aGUgbGluayBkaXNwbGF5cyBjb3JyZWN0bHlcblx0XHR1cmkgPSB1cmkgfHwgbGFiZWw7XG5cdFx0Ly8gQWx0aG91Z2ggaWYgdGhlcmUgaXMgYSBzcGFjZSBpbiB0aGUgdXJpLCBqdXN0IHJlcGxhY2UgaXQgY29tcGxldGVseVxuXHRcdGlmICgvKFxcc3wmbmJzcDspLy50ZXN0KHVyaSkpIHtcblx0XHRcdHVyaSA9IG5scy5sb2NhbGl6ZSgnZm9sbG93TGlua1VybCcsICdMaW5rJyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1hcmtkb3duLmFwcGVuZExpbmsodXJpLCBsYWJlbCkuYXBwZW5kTWFya2Rvd24oYCAoJHtjbGlja0xhYmVsfSlgKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElMaW5lQ29sdW1uSW5mbyB7XG5cdGxpbmVOdW1iZXI6IG51bWJlcjtcblx0Y29sdW1uTnVtYmVyOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURldGVjdGVkTGlua3Mge1xuXHR3b3JkTGlua3M/OiBJTGlua1tdO1xuXHR3ZWJMaW5rcz86IElMaW5rW107XG5cdGZpbGVMaW5rcz86IChJTGluayB8IFRlcm1pbmFsTGluaylbXTtcblx0Zm9sZGVyTGlua3M/OiBJTGlua1tdO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGlCQUFpQjtBQUMxQixTQUEwQixzQkFBc0I7QUFDaEQsU0FBUyxpQkFBaUIsU0FBc0Isb0JBQW9CO0FBQ3BFLFNBQVMsYUFBYSxVQUFVO0FBQ2hDLFNBQVMsV0FBVztBQUNwQixZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBK0csK0JBQWlEO0FBQ2hLLFNBQVMsb0NBQW9DO0FBRTdDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsNkJBQTZCLDBDQUEwQywrQ0FBK0MsMEJBQTBCLDZCQUE2QjtBQUN0TCxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLCtCQUE4RCxrQ0FBa0M7QUFDekcsU0FBa0MscUJBQXFCO0FBSXZELFNBQXVELCtCQUErQjtBQUV0RixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLHNCQUFzQixnQkFBZ0I7QUFReEMsSUFBTSxzQkFBTixjQUFrQyxnQkFBZ0I7QUFBQSxFQVN4RCxZQUNrQixRQUNBLGNBQ2pCLGNBQ2lCLGVBQ3VCLHVCQUNBLHVCQUNsQixxQkFD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LFFBQUksV0FBVyx3QkFBd0IsV0FBVztBQUNqRCxhQUFPLENBQUMsQ0FBQyxNQUFNO0FBQUEsSUFDaEI7QUFDQSxXQUFPLGNBQWMsTUFBTSxVQUFVLE1BQU07QUFBQSxFQUM1QztBQUFBLEVBRVEsb0JBQW9CLEtBQWEsT0FBNEM7QUFDcEYsVUFBTSxhQUFhLEtBQUssc0JBQXNCLFNBQXFELFFBQVE7QUFFM0csUUFBSSxhQUFhO0FBQ2pCLFFBQUksV0FBVyx3QkFBd0IsV0FBVztBQUNqRCxVQUFJLGFBQWE7QUFDaEIscUJBQWEsSUFBSSxTQUFTLHlDQUF5QyxnQkFBZ0I7QUFBQSxNQUNwRixPQUFPO0FBQ04scUJBQWEsSUFBSSxTQUFTLHFDQUFxQyxhQUFhO0FBQUEsTUFDN0U7QUFBQSxJQUNELE9BQU87QUFDTixVQUFJLGFBQWE7QUFDaEIscUJBQWEsSUFBSSxTQUFTLHFDQUFxQyxhQUFhO0FBQUEsTUFDN0UsT0FBTztBQUNOLHFCQUFhLElBQUksU0FBUyxzQ0FBc0MsY0FBYztBQUFBLE1BQy9FO0FBQUEsSUFDRDtBQUVBLFFBQUksZ0JBQWdCLElBQUksU0FBUyxjQUFjLGFBQWE7QUFDNUQsUUFBSTtBQUNILFVBQUksS0FBSyxlQUFlLFVBQVUsSUFBSSxNQUFNLEdBQUcsQ0FBQyxHQUFHO0FBQ2xELHdCQUFnQixJQUFJLFNBQVMsdUJBQXVCLGtDQUFrQztBQUFBLE1BQ3ZGO0FBQUEsSUFDRCxRQUFRO0FBQUEsSUFFUjtBQUVBLFVBQU0sV0FBVyxJQUFJLGVBQWUsSUFBSSxJQUFJO0FBRTVDLFFBQUksT0FBTztBQUNWLGNBQVEsU0FBUyxXQUFXLEtBQUssRUFBRTtBQUNuQyxlQUFTLFFBQVE7QUFBQSxJQUNsQjtBQUNBLFFBQUksS0FBSztBQUNSLFlBQU0sU0FBUyxXQUFXLEdBQUcsRUFBRTtBQUMvQixlQUFTLFFBQVE7QUFBQSxJQUNsQjtBQUVBLFlBQVEsU0FBUztBQUVqQixVQUFNLE9BQU87QUFFYixRQUFJLGNBQWMsS0FBSyxHQUFHLEdBQUc7QUFDNUIsWUFBTSxJQUFJLFNBQVMsaUJBQWlCLE1BQU07QUFBQSxJQUMzQztBQUVBLFdBQU8sU0FBUyxXQUFXLEtBQUssS0FBSyxFQUFFLGVBQWUsS0FBSyxVQUFVLEdBQUc7QUFBQSxFQUN6RTtBQUNEO0FBbGFhLHNCQUFOO0FBQUEsRUFjSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FuQlU7IiwKICAibmFtZXMiOiBbInRleHQiXQp9Cg==
