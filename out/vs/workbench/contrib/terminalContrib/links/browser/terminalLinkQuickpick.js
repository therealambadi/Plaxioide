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
import { Emitter, Event } from "../../../../../base/common/event.js";
import { localize } from "../../../../../nls.js";
import { IQuickInputService, QuickInputHideReason } from "../../../../../platform/quickinput/common/quickInput.js";
import { TerminalLinkQuickPickEvent } from "../../../terminal/browser/terminal.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Sequencer, timeout } from "../../../../../base/common/async.js";
import { PickerEditorState } from "../../../../browser/quickaccess.js";
import { getLinkSuffix } from "./terminalLinkParsing.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { basenameOrAuthority, dirname } from "../../../../../base/common/resources.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { AccessibleViewProviderId, IAccessibleViewService } from "../../../../../platform/accessibility/browser/accessibleView.js";
let TerminalLinkQuickpick = class extends DisposableStore {
  constructor(_accessibleViewService, instantiationService, _labelService, _quickInputService) {
    super();
    this._accessibleViewService = _accessibleViewService;
    this._labelService = _labelService;
    this._quickInputService = _quickInputService;
    this._editorSequencer = new Sequencer();
    this._onDidRequestMoreLinks = this.add(new Emitter());
    this.onDidRequestMoreLinks = this._onDidRequestMoreLinks.event;
    this._terminalScrollStateSaved = false;
    this._editorViewState = this.add(instantiationService.createInstance(PickerEditorState));
  }
  async show(instance, links) {
    this._instance = instance;
    const result = await Promise.race([links.all, timeout(500)]);
    const usingAllLinks = typeof result === "object";
    const resolvedLinks = usingAllLinks ? result : links.viewport;
    const wordPicks = resolvedLinks.wordLinks ? await this._generatePicks(resolvedLinks.wordLinks) : void 0;
    const filePicks = resolvedLinks.fileLinks ? await this._generatePicks(resolvedLinks.fileLinks) : void 0;
    const folderPicks = resolvedLinks.folderLinks ? await this._generatePicks(resolvedLinks.folderLinks) : void 0;
    const webPicks = resolvedLinks.webLinks ? await this._generatePicks(resolvedLinks.webLinks) : void 0;
    const picks = [];
    if (webPicks) {
      picks.push({ type: "separator", label: localize("terminal.integrated.urlLinks", "Url") });
      picks.push(...webPicks);
    }
    if (filePicks) {
      picks.push({ type: "separator", label: localize("terminal.integrated.localFileLinks", "File") });
      picks.push(...filePicks);
    }
    if (folderPicks) {
      picks.push({ type: "separator", label: localize("terminal.integrated.localFolderLinks", "Folder") });
      picks.push(...folderPicks);
    }
    if (wordPicks) {
      picks.push({ type: "separator", label: localize("terminal.integrated.searchLinks", "Workspace Search") });
      picks.push(...wordPicks);
    }
    const pick = this._quickInputService.createQuickPick({ useSeparators: true });
    const disposables = new DisposableStore();
    disposables.add(pick);
    pick.items = picks;
    pick.placeholder = localize("terminal.integrated.openDetectedLink", "Select the link to open, type to filter all links");
    pick.sortByLabel = false;
    pick.show();
    if (pick.activeItems.length > 0) {
      this._previewItem(pick.activeItems[0]);
    }
    let accepted = false;
    if (!usingAllLinks) {
      disposables.add(Event.once(pick.onDidChangeValue)(async () => {
        const allLinks = await links.all;
        if (accepted) {
          return;
        }
        const wordIgnoreLinks = [...allLinks.fileLinks ?? [], ...allLinks.folderLinks ?? [], ...allLinks.webLinks ?? []];
        const wordPicks2 = allLinks.wordLinks ? await this._generatePicks(allLinks.wordLinks, wordIgnoreLinks) : void 0;
        const filePicks2 = allLinks.fileLinks ? await this._generatePicks(allLinks.fileLinks) : void 0;
        const folderPicks2 = allLinks.folderLinks ? await this._generatePicks(allLinks.folderLinks) : void 0;
        const webPicks2 = allLinks.webLinks ? await this._generatePicks(allLinks.webLinks) : void 0;
        const picks2 = [];
        if (webPicks2) {
          picks2.push({ type: "separator", label: localize("terminal.integrated.urlLinks", "Url") });
          picks2.push(...webPicks2);
        }
        if (filePicks2) {
          picks2.push({ type: "separator", label: localize("terminal.integrated.localFileLinks", "File") });
          picks2.push(...filePicks2);
        }
        if (folderPicks2) {
          picks2.push({ type: "separator", label: localize("terminal.integrated.localFolderLinks", "Folder") });
          picks2.push(...folderPicks2);
        }
        if (wordPicks2) {
          picks2.push({ type: "separator", label: localize("terminal.integrated.searchLinks", "Workspace Search") });
          picks2.push(...wordPicks2);
        }
        pick.items = picks2;
      }));
    }
    disposables.add(pick.onDidChangeActive(async () => {
      const [item] = pick.activeItems;
      this._previewItem(item);
    }));
    return new Promise((r) => {
      disposables.add(pick.onDidHide(({ reason }) => {
        if (this._terminalScrollStateSaved) {
          const markTracker = this._instance?.xterm?.markTracker;
          if (markTracker) {
            markTracker.restoreScrollState();
            markTracker.clear();
            this._terminalScrollStateSaved = false;
          }
        }
        if (reason === QuickInputHideReason.Gesture) {
          this._editorViewState.restore();
        }
        disposables.dispose();
        if (pick.selectedItems.length === 0) {
          this._accessibleViewService.showLastProvider(AccessibleViewProviderId.Terminal);
        }
        r();
      }));
      disposables.add(Event.once(pick.onDidAccept)(() => {
        if (this._terminalScrollStateSaved) {
          const markTracker = this._instance?.xterm?.markTracker;
          if (markTracker) {
            markTracker.restoreScrollState();
            markTracker.clear();
            this._terminalScrollStateSaved = false;
          }
        }
        accepted = true;
        const event = new TerminalLinkQuickPickEvent(EventType.CLICK);
        const activeItem = pick.activeItems?.[0];
        if (activeItem && "link" in activeItem) {
          activeItem.link.activate(event, activeItem.label);
        }
        disposables.dispose();
        r();
      }));
    });
  }
  /**
   * @param ignoreLinks Links with labels to not include in the picks.
   */
  async _generatePicks(links, ignoreLinks) {
    if (!links) {
      return;
    }
    const linkTextKeys = /* @__PURE__ */ new Set();
    const linkUriKeys = /* @__PURE__ */ new Set();
    const picks = [];
    for (const link of links) {
      let label = link.text;
      if (!linkTextKeys.has(label) && (!ignoreLinks || !ignoreLinks.some((e) => e.text === label))) {
        linkTextKeys.add(label);
        let description;
        if ("uri" in link && link.uri) {
          if (link.type === TerminalBuiltinLinkType.LocalFile || link.type === TerminalBuiltinLinkType.LocalFolderInWorkspace || link.type === TerminalBuiltinLinkType.LocalFolderOutsideWorkspace) {
            label = basenameOrAuthority(link.uri);
            description = this._labelService.getUriLabel(dirname(link.uri), { relative: true });
          }
          if (link.type === TerminalBuiltinLinkType.LocalFile) {
            if (link.parsedLink?.suffix?.row !== void 0) {
              label += `:${link.parsedLink.suffix.row}`;
              if (link.parsedLink?.suffix?.rowEnd !== void 0) {
                label += `-${link.parsedLink.suffix.rowEnd}`;
              }
              if (link.parsedLink?.suffix?.col !== void 0) {
                label += `:${link.parsedLink.suffix.col}`;
                if (link.parsedLink?.suffix?.colEnd !== void 0) {
                  label += `-${link.parsedLink.suffix.colEnd}`;
                }
              }
            }
          }
          if (linkUriKeys.has(label + "|" + (description ?? ""))) {
            continue;
          }
          linkUriKeys.add(label + "|" + (description ?? ""));
        }
        picks.push({ label, link, description });
      }
    }
    return picks.length > 0 ? picks : void 0;
  }
  _previewItem(item) {
    if (!item || !("link" in item) || !item.link) {
      return;
    }
    const link = item.link;
    this._previewItemInTerminal(link);
    if (!("uri" in link) || !link.uri) {
      return;
    }
    if (link.type !== TerminalBuiltinLinkType.LocalFile) {
      return;
    }
    this._previewItemInEditor(link);
  }
  _previewItemInEditor(link) {
    const linkSuffix = link.parsedLink ? link.parsedLink.suffix : getLinkSuffix(link.text);
    const selection = linkSuffix?.row === void 0 ? void 0 : {
      startLineNumber: linkSuffix.row ?? 1,
      startColumn: linkSuffix.col ?? 1,
      endLineNumber: linkSuffix.rowEnd,
      endColumn: linkSuffix.colEnd
    };
    this._editorViewState.set();
    this._editorSequencer.queue(async () => {
      await this._editorViewState.openTransientEditor({
        resource: link.uri,
        options: { preserveFocus: true, revealIfOpened: true, ignoreError: true, selection }
      });
    });
  }
  _previewItemInTerminal(link) {
    const xterm = this._instance?.xterm;
    if (!xterm) {
      return;
    }
    if (!this._terminalScrollStateSaved) {
      xterm.markTracker.saveScrollState();
      this._terminalScrollStateSaved = true;
    }
    xterm.markTracker.revealRange(link.range);
  }
};
TerminalLinkQuickpick = __decorateClass([
  __decorateParam(0, IAccessibleViewService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IQuickInputService)
], TerminalLinkQuickpick);
export {
  TerminalLinkQuickpick
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbExpbmtRdWlja3BpY2sudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgUXVpY2tQaWNrSXRlbSwgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgUXVpY2tJbnB1dEhpZGVSZWFzb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElEZXRlY3RlZExpbmtzIH0gZnJvbSAnLi90ZXJtaW5hbExpbmtNYW5hZ2VyLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsTGlua1F1aWNrUGlja0V2ZW50LCB0eXBlIElEZXRhY2hlZFRlcm1pbmFsSW5zdGFuY2UsIHR5cGUgSVRlcm1pbmFsSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB0eXBlIHsgSUxpbmsgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB0eXBlIHsgVGVybWluYWxMaW5rIH0gZnJvbSAnLi90ZXJtaW5hbExpbmsuanMnO1xuaW1wb3J0IHsgU2VxdWVuY2VyLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgUGlja2VyRWRpdG9yU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3F1aWNrYWNjZXNzLmpzJztcbmltcG9ydCB7IGdldExpbmtTdWZmaXggfSBmcm9tICcuL3Rlcm1pbmFsTGlua1BhcnNpbmcuanMnO1xuaW1wb3J0IHsgVGVybWluYWxCdWlsdGluTGlua1R5cGUgfSBmcm9tICcuL2xpbmtzLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWVPckF1dGhvcml0eSwgZGlybmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZCwgSUFjY2Vzc2libGVWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlldy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbExpbmtRdWlja3BpY2sgZXh0ZW5kcyBEaXNwb3NhYmxlU3RvcmUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcXVlbmNlciA9IG5ldyBTZXF1ZW5jZXIoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yVmlld1N0YXRlOiBQaWNrZXJFZGl0b3JTdGF0ZTtcblxuXHRwcml2YXRlIF9pbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCBJRGV0YWNoZWRUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVxdWVzdE1vcmVMaW5rcyA9IHRoaXMuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcXVlc3RNb3JlTGlua3MgPSB0aGlzLl9vbkRpZFJlcXVlc3RNb3JlTGlua3MuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElBY2Nlc3NpYmxlVmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJsZVZpZXdTZXJ2aWNlOiBJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9xdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2VkaXRvclZpZXdTdGF0ZSA9IHRoaXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFBpY2tlckVkaXRvclN0YXRlKSk7XG5cdH1cblxuXHRhc3luYyBzaG93KGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IElEZXRhY2hlZFRlcm1pbmFsSW5zdGFuY2UsIGxpbmtzOiB7IHZpZXdwb3J0OiBJRGV0ZWN0ZWRMaW5rczsgYWxsOiBQcm9taXNlPElEZXRlY3RlZExpbmtzPiB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5faW5zdGFuY2UgPSBpbnN0YW5jZTtcblxuXHRcdC8vIEFsbG93IGFsbCBsaW5rcyBhIHNtYWxsIGFtb3VudCBvZiB0aW1lIHRvIGVsYXBzZSB0byBmaW5pc2gsIGlmIHRoaXMgaXMgbm90IGRvbmUgaW4gdGhpc1xuXHRcdC8vIHRpbWUgdGhleSB3aWxsIGJlIGxvYWRlZCB1cG9uIHRoZSBmaXJzdCBmaWx0ZXIuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtsaW5rcy5hbGwsIHRpbWVvdXQoNTAwKV0pO1xuXHRcdGNvbnN0IHVzaW5nQWxsTGlua3MgPSB0eXBlb2YgcmVzdWx0ID09PSAnb2JqZWN0Jztcblx0XHRjb25zdCByZXNvbHZlZExpbmtzID0gdXNpbmdBbGxMaW5rcyA/IHJlc3VsdCA6IGxpbmtzLnZpZXdwb3J0O1xuXG5cdFx0Ly8gR2V0IHJhdyBsaW5rIHBpY2tzXG5cdFx0Y29uc3Qgd29yZFBpY2tzID0gcmVzb2x2ZWRMaW5rcy53b3JkTGlua3MgPyBhd2FpdCB0aGlzLl9nZW5lcmF0ZVBpY2tzKHJlc29sdmVkTGlua3Mud29yZExpbmtzKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBmaWxlUGlja3MgPSByZXNvbHZlZExpbmtzLmZpbGVMaW5rcyA/IGF3YWl0IHRoaXMuX2dlbmVyYXRlUGlja3MocmVzb2x2ZWRMaW5rcy5maWxlTGlua3MpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGZvbGRlclBpY2tzID0gcmVzb2x2ZWRMaW5rcy5mb2xkZXJMaW5rcyA/IGF3YWl0IHRoaXMuX2dlbmVyYXRlUGlja3MocmVzb2x2ZWRMaW5rcy5mb2xkZXJMaW5rcykgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgd2ViUGlja3MgPSByZXNvbHZlZExpbmtzLndlYkxpbmtzID8gYXdhaXQgdGhpcy5fZ2VuZXJhdGVQaWNrcyhyZXNvbHZlZExpbmtzLndlYkxpbmtzKSA6IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IHBpY2tzOiBMaW5rUXVpY2tQaWNrSXRlbVtdID0gW107XG5cdFx0aWYgKHdlYlBpY2tzKSB7XG5cdFx0XHRwaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC51cmxMaW5rcycsIFwiVXJsXCIpIH0pO1xuXHRcdFx0cGlja3MucHVzaCguLi53ZWJQaWNrcyk7XG5cdFx0fVxuXHRcdGlmIChmaWxlUGlja3MpIHtcblx0XHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmxvY2FsRmlsZUxpbmtzJywgXCJGaWxlXCIpIH0pO1xuXHRcdFx0cGlja3MucHVzaCguLi5maWxlUGlja3MpO1xuXHRcdH1cblx0XHRpZiAoZm9sZGVyUGlja3MpIHtcblx0XHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmxvY2FsRm9sZGVyTGlua3MnLCBcIkZvbGRlclwiKSB9KTtcblx0XHRcdHBpY2tzLnB1c2goLi4uZm9sZGVyUGlja3MpO1xuXHRcdH1cblx0XHRpZiAod29yZFBpY2tzKSB7XG5cdFx0XHRwaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5zZWFyY2hMaW5rcycsIFwiV29ya3NwYWNlIFNlYXJjaFwiKSB9KTtcblx0XHRcdHBpY2tzLnB1c2goLi4ud29yZFBpY2tzKTtcblx0XHR9XG5cblx0XHQvLyBDcmVhdGUgYW5kIHNob3cgcXVpY2sgcGlja1xuXHRcdGNvbnN0IHBpY2sgPSB0aGlzLl9xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2s8SVF1aWNrUGlja0l0ZW0gfCBJVGVybWluYWxMaW5rUXVpY2tQaWNrSXRlbT4oeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0pO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrKTtcblx0XHRwaWNrLml0ZW1zID0gcGlja3M7XG5cdFx0cGljay5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLm9wZW5EZXRlY3RlZExpbmsnLCBcIlNlbGVjdCB0aGUgbGluayB0byBvcGVuLCB0eXBlIHRvIGZpbHRlciBhbGwgbGlua3NcIik7XG5cdFx0cGljay5zb3J0QnlMYWJlbCA9IGZhbHNlO1xuXHRcdHBpY2suc2hvdygpO1xuXHRcdGlmIChwaWNrLmFjdGl2ZUl0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX3ByZXZpZXdJdGVtKHBpY2suYWN0aXZlSXRlbXNbMF0pO1xuXHRcdH1cblxuXHRcdC8vIFNob3cgYWxsIHJlc3VsdHMgb25seSB3aGVuIGZpbHRlcmluZyBiZWdpbnMsIHRoaXMgaXMgZG9uZSBzbyB0aGUgcXVpY2sgcGljayB3aWxsIHNob3cgdXBcblx0XHQvLyBBU0FQIHdpdGggb25seSB0aGUgdmlld3BvcnQgZW50cmllcy5cblx0XHRsZXQgYWNjZXB0ZWQgPSBmYWxzZTtcblx0XHRpZiAoIXVzaW5nQWxsTGlua3MpIHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5vbmNlKHBpY2sub25EaWRDaGFuZ2VWYWx1ZSkoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBhbGxMaW5rcyA9IGF3YWl0IGxpbmtzLmFsbDtcblx0XHRcdFx0aWYgKGFjY2VwdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHdvcmRJZ25vcmVMaW5rcyA9IFsuLi4oYWxsTGlua3MuZmlsZUxpbmtzID8/IFtdKSwgLi4uKGFsbExpbmtzLmZvbGRlckxpbmtzID8/IFtdKSwgLi4uKGFsbExpbmtzLndlYkxpbmtzID8/IFtdKV07XG5cblx0XHRcdFx0Y29uc3Qgd29yZFBpY2tzID0gYWxsTGlua3Mud29yZExpbmtzID8gYXdhaXQgdGhpcy5fZ2VuZXJhdGVQaWNrcyhhbGxMaW5rcy53b3JkTGlua3MsIHdvcmRJZ25vcmVMaW5rcykgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IGZpbGVQaWNrcyA9IGFsbExpbmtzLmZpbGVMaW5rcyA/IGF3YWl0IHRoaXMuX2dlbmVyYXRlUGlja3MoYWxsTGlua3MuZmlsZUxpbmtzKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0Y29uc3QgZm9sZGVyUGlja3MgPSBhbGxMaW5rcy5mb2xkZXJMaW5rcyA/IGF3YWl0IHRoaXMuX2dlbmVyYXRlUGlja3MoYWxsTGlua3MuZm9sZGVyTGlua3MpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCB3ZWJQaWNrcyA9IGFsbExpbmtzLndlYkxpbmtzID8gYXdhaXQgdGhpcy5fZ2VuZXJhdGVQaWNrcyhhbGxMaW5rcy53ZWJMaW5rcykgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IHBpY2tzOiBMaW5rUXVpY2tQaWNrSXRlbVtdID0gW107XG5cdFx0XHRcdGlmICh3ZWJQaWNrcykge1xuXHRcdFx0XHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnVybExpbmtzJywgXCJVcmxcIikgfSk7XG5cdFx0XHRcdFx0cGlja3MucHVzaCguLi53ZWJQaWNrcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZpbGVQaWNrcykge1xuXHRcdFx0XHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLmxvY2FsRmlsZUxpbmtzJywgXCJGaWxlXCIpIH0pO1xuXHRcdFx0XHRcdHBpY2tzLnB1c2goLi4uZmlsZVBpY2tzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZm9sZGVyUGlja3MpIHtcblx0XHRcdFx0XHRwaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgndGVybWluYWwuaW50ZWdyYXRlZC5sb2NhbEZvbGRlckxpbmtzJywgXCJGb2xkZXJcIikgfSk7XG5cdFx0XHRcdFx0cGlja3MucHVzaCguLi5mb2xkZXJQaWNrcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHdvcmRQaWNrcykge1xuXHRcdFx0XHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCd0ZXJtaW5hbC5pbnRlZ3JhdGVkLnNlYXJjaExpbmtzJywgXCJXb3Jrc3BhY2UgU2VhcmNoXCIpIH0pO1xuXHRcdFx0XHRcdHBpY2tzLnB1c2goLi4ud29yZFBpY2tzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwaWNrLml0ZW1zID0gcGlja3M7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHBpY2sub25EaWRDaGFuZ2VBY3RpdmUoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgW2l0ZW1dID0gcGljay5hY3RpdmVJdGVtcztcblx0XHRcdHRoaXMuX3ByZXZpZXdJdGVtKGl0ZW0pO1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZShyID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrLm9uRGlkSGlkZSgoeyByZWFzb24gfSkgPT4ge1xuXG5cdFx0XHRcdC8vIFJlc3RvcmUgdGVybWluYWwgc2Nyb2xsIHN0YXRlXG5cdFx0XHRcdGlmICh0aGlzLl90ZXJtaW5hbFNjcm9sbFN0YXRlU2F2ZWQpIHtcblx0XHRcdFx0XHRjb25zdCBtYXJrVHJhY2tlciA9IHRoaXMuX2luc3RhbmNlPy54dGVybT8ubWFya1RyYWNrZXI7XG5cdFx0XHRcdFx0aWYgKG1hcmtUcmFja2VyKSB7XG5cdFx0XHRcdFx0XHRtYXJrVHJhY2tlci5yZXN0b3JlU2Nyb2xsU3RhdGUoKTtcblx0XHRcdFx0XHRcdG1hcmtUcmFja2VyLmNsZWFyKCk7XG5cdFx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hbFNjcm9sbFN0YXRlU2F2ZWQgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZXN0b3JlIHZpZXcgc3RhdGUgdXBvbiBjYW5jZWxsYXRpb24gaWYgd2UgY2hhbmdlZCBpdFxuXHRcdFx0XHQvLyBidXQgb25seSB3aGVuIHRoZSBwaWNrZXIgd2FzIGNsb3NlZCB2aWEgZXhwbGljaXQgdXNlclxuXHRcdFx0XHQvLyBnZXN0dXJlIGFuZCBub3QgZS5nLiB3aGVuIGZvY3VzIHdhcyBsb3N0IGJlY2F1c2UgdGhhdFxuXHRcdFx0XHQvLyBjb3VsZCBtZWFuIHRoZSB1c2VyIGNsaWNrZWQgaW50byB0aGUgZWRpdG9yIGRpcmVjdGx5LlxuXHRcdFx0XHRpZiAocmVhc29uID09PSBRdWlja0lucHV0SGlkZVJlYXNvbi5HZXN0dXJlKSB7XG5cdFx0XHRcdFx0dGhpcy5fZWRpdG9yVmlld1N0YXRlLnJlc3RvcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdGlmIChwaWNrLnNlbGVjdGVkSXRlbXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fYWNjZXNzaWJsZVZpZXdTZXJ2aWNlLnNob3dMYXN0UHJvdmlkZXIoQWNjZXNzaWJsZVZpZXdQcm92aWRlcklkLlRlcm1pbmFsKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQub25jZShwaWNrLm9uRGlkQWNjZXB0KSgoKSA9PiB7XG5cdFx0XHRcdC8vIFJlc3RvcmUgdGVybWluYWwgc2Nyb2xsIHN0YXRlXG5cdFx0XHRcdGlmICh0aGlzLl90ZXJtaW5hbFNjcm9sbFN0YXRlU2F2ZWQpIHtcblx0XHRcdFx0XHRjb25zdCBtYXJrVHJhY2tlciA9IHRoaXMuX2luc3RhbmNlPy54dGVybT8ubWFya1RyYWNrZXI7XG5cdFx0XHRcdFx0aWYgKG1hcmtUcmFja2VyKSB7XG5cdFx0XHRcdFx0XHRtYXJrVHJhY2tlci5yZXN0b3JlU2Nyb2xsU3RhdGUoKTtcblx0XHRcdFx0XHRcdG1hcmtUcmFja2VyLmNsZWFyKCk7XG5cdFx0XHRcdFx0XHR0aGlzLl90ZXJtaW5hbFNjcm9sbFN0YXRlU2F2ZWQgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhY2NlcHRlZCA9IHRydWU7XG5cdFx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFRlcm1pbmFsTGlua1F1aWNrUGlja0V2ZW50KEV2ZW50VHlwZS5DTElDSyk7XG5cdFx0XHRcdGNvbnN0IGFjdGl2ZUl0ZW0gPSBwaWNrLmFjdGl2ZUl0ZW1zPy5bMF07XG5cdFx0XHRcdGlmIChhY3RpdmVJdGVtICYmICdsaW5rJyBpbiBhY3RpdmVJdGVtKSB7XG5cdFx0XHRcdFx0YWN0aXZlSXRlbS5saW5rLmFjdGl2YXRlKGV2ZW50LCBhY3RpdmVJdGVtLmxhYmVsKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdHIoKTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0gaWdub3JlTGlua3MgTGlua3Mgd2l0aCBsYWJlbHMgdG8gbm90IGluY2x1ZGUgaW4gdGhlIHBpY2tzLlxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBfZ2VuZXJhdGVQaWNrcyhsaW5rczogKElMaW5rIHwgVGVybWluYWxMaW5rKVtdLCBpZ25vcmVMaW5rcz86IElMaW5rW10pOiBQcm9taXNlPElUZXJtaW5hbExpbmtRdWlja1BpY2tJdGVtW10gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIWxpbmtzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGxpbmtUZXh0S2V5czogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG5cdFx0Y29uc3QgbGlua1VyaUtleXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXHRcdGNvbnN0IHBpY2tzOiBJVGVybWluYWxMaW5rUXVpY2tQaWNrSXRlbVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBsaW5rIG9mIGxpbmtzKSB7XG5cdFx0XHRsZXQgbGFiZWwgPSBsaW5rLnRleHQ7XG5cdFx0XHRpZiAoIWxpbmtUZXh0S2V5cy5oYXMobGFiZWwpICYmICghaWdub3JlTGlua3MgfHwgIWlnbm9yZUxpbmtzLnNvbWUoZSA9PiBlLnRleHQgPT09IGxhYmVsKSkpIHtcblx0XHRcdFx0bGlua1RleHRLZXlzLmFkZChsYWJlbCk7XG5cblx0XHRcdFx0Ly8gQWRkIGEgY29uc2lzdGVudGx5IGZvcm1hdHRlZCByZXNvbHZlZCBVUkkgbGFiZWwgdG8gdGhlIGRlc2NyaXB0aW9uIGlmIGFwcGxpY2FibGVcblx0XHRcdFx0bGV0IGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICgndXJpJyBpbiBsaW5rICYmIGxpbmsudXJpKSB7XG5cdFx0XHRcdFx0Ly8gRm9yIGxvY2FsIGZpbGVzIGFuZCBmb2xkZXJzLCBtaW1pYyB0aGUgcHJlc2VudGF0aW9uIG9mIGdvIHRvIGZpbGVcblx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHRsaW5rLnR5cGUgPT09IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRmlsZSB8fFxuXHRcdFx0XHRcdFx0bGluay50eXBlID09PSBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZvbGRlckluV29ya3NwYWNlIHx8XG5cdFx0XHRcdFx0XHRsaW5rLnR5cGUgPT09IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRm9sZGVyT3V0c2lkZVdvcmtzcGFjZVxuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0bGFiZWwgPSBiYXNlbmFtZU9yQXV0aG9yaXR5KGxpbmsudXJpKTtcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uID0gdGhpcy5fbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGRpcm5hbWUobGluay51cmkpLCB7IHJlbGF0aXZlOiB0cnVlIH0pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEFkZCBsaW5lIGFuZCBjb2x1bW4gbnVtYmVycyB0byB0aGUgbGFiZWwgaWYgYXBwbGljYWJsZVxuXHRcdFx0XHRcdGlmIChsaW5rLnR5cGUgPT09IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRmlsZSkge1xuXHRcdFx0XHRcdFx0aWYgKGxpbmsucGFyc2VkTGluaz8uc3VmZml4Py5yb3cgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRsYWJlbCArPSBgOiR7bGluay5wYXJzZWRMaW5rLnN1ZmZpeC5yb3d9YDtcblx0XHRcdFx0XHRcdFx0aWYgKGxpbmsucGFyc2VkTGluaz8uc3VmZml4Py5yb3dFbmQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsICs9IGAtJHtsaW5rLnBhcnNlZExpbmsuc3VmZml4LnJvd0VuZH1gO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChsaW5rLnBhcnNlZExpbms/LnN1ZmZpeD8uY29sICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRsYWJlbCArPSBgOiR7bGluay5wYXJzZWRMaW5rLnN1ZmZpeC5jb2x9YDtcblx0XHRcdFx0XHRcdFx0XHRpZiAobGluay5wYXJzZWRMaW5rPy5zdWZmaXg/LmNvbEVuZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRsYWJlbCArPSBgLSR7bGluay5wYXJzZWRMaW5rLnN1ZmZpeC5jb2xFbmR9YDtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBTa2lwIHRoZSBsaW5rIGlmIGl0J3MgYSBkdXBsaWNhdGUgVVJJICsgbGluZS9jb2xcblx0XHRcdFx0XHRpZiAobGlua1VyaUtleXMuaGFzKGxhYmVsICsgJ3wnICsgKGRlc2NyaXB0aW9uID8/ICcnKSkpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRsaW5rVXJpS2V5cy5hZGQobGFiZWwgKyAnfCcgKyAoZGVzY3JpcHRpb24gPz8gJycpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHBpY2tzLnB1c2goeyBsYWJlbCwgbGluaywgZGVzY3JpcHRpb24gfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBwaWNrcy5sZW5ndGggPiAwID8gcGlja3MgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9wcmV2aWV3SXRlbShpdGVtOiBJVGVybWluYWxMaW5rUXVpY2tQaWNrSXRlbSB8IElRdWlja1BpY2tJdGVtKSB7XG5cdFx0aWYgKCFpdGVtIHx8ICEoJ2xpbmsnIGluIGl0ZW0pIHx8ICFpdGVtLmxpbmspIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBBbnkgbGluayBjYW4gYmUgcHJldmlld2VkIGluIHRoZSB0ZXJtbmluYWxcblx0XHRjb25zdCBsaW5rID0gaXRlbS5saW5rO1xuXHRcdHRoaXMuX3ByZXZpZXdJdGVtSW5UZXJtaW5hbChsaW5rKTtcblxuXHRcdGlmICghKCd1cmknIGluIGxpbmspIHx8ICFsaW5rLnVyaSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChsaW5rLnR5cGUgIT09IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRmlsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3ByZXZpZXdJdGVtSW5FZGl0b3IobGluayk7XG5cdH1cblxuXHRwcml2YXRlIF9wcmV2aWV3SXRlbUluRWRpdG9yKGxpbms6IFRlcm1pbmFsTGluaykge1xuXHRcdGNvbnN0IGxpbmtTdWZmaXggPSBsaW5rLnBhcnNlZExpbmsgPyBsaW5rLnBhcnNlZExpbmsuc3VmZml4IDogZ2V0TGlua1N1ZmZpeChsaW5rLnRleHQpO1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IGxpbmtTdWZmaXg/LnJvdyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDoge1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBsaW5rU3VmZml4LnJvdyA/PyAxLFxuXHRcdFx0c3RhcnRDb2x1bW46IGxpbmtTdWZmaXguY29sID8/IDEsXG5cdFx0XHRlbmRMaW5lTnVtYmVyOiBsaW5rU3VmZml4LnJvd0VuZCxcblx0XHRcdGVuZENvbHVtbjogbGlua1N1ZmZpeC5jb2xFbmRcblx0XHR9O1xuXG5cdFx0dGhpcy5fZWRpdG9yVmlld1N0YXRlLnNldCgpO1xuXHRcdHRoaXMuX2VkaXRvclNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLl9lZGl0b3JWaWV3U3RhdGUub3BlblRyYW5zaWVudEVkaXRvcih7XG5cdFx0XHRcdHJlc291cmNlOiBsaW5rLnVyaSxcblx0XHRcdFx0b3B0aW9uczogeyBwcmVzZXJ2ZUZvY3VzOiB0cnVlLCByZXZlYWxJZk9wZW5lZDogdHJ1ZSwgaWdub3JlRXJyb3I6IHRydWUsIHNlbGVjdGlvbiB9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3Rlcm1pbmFsU2Nyb2xsU3RhdGVTYXZlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9wcmV2aWV3SXRlbUluVGVybWluYWwobGluazogSUxpbmspIHtcblx0XHRjb25zdCB4dGVybSA9IHRoaXMuX2luc3RhbmNlPy54dGVybTtcblx0XHRpZiAoIXh0ZXJtKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fdGVybWluYWxTY3JvbGxTdGF0ZVNhdmVkKSB7XG5cdFx0XHR4dGVybS5tYXJrVHJhY2tlci5zYXZlU2Nyb2xsU3RhdGUoKTtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsU2Nyb2xsU3RhdGVTYXZlZCA9IHRydWU7XG5cdFx0fVxuXHRcdHh0ZXJtLm1hcmtUcmFja2VyLnJldmVhbFJhbmdlKGxpbmsucmFuZ2UpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlcm1pbmFsTGlua1F1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGxpbms6IElMaW5rIHwgVGVybWluYWxMaW5rO1xufVxuXG50eXBlIExpbmtRdWlja1BpY2tJdGVtID0gSVRlcm1pbmFsTGlua1F1aWNrUGlja0l0ZW0gfCBRdWlja1BpY2tJdGVtO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGdCQUFnQjtBQUN6QixTQUF3QixvQkFBb0MsNEJBQTRCO0FBRXhGLFNBQVMsa0NBQTBGO0FBRW5HLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsV0FBVyxlQUFlO0FBQ25DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMscUJBQXFCLGVBQWU7QUFDN0MsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEIsOEJBQThCO0FBRTFELElBQU0sd0JBQU4sY0FBb0MsZ0JBQWdCO0FBQUEsRUFVMUQsWUFDMEMsd0JBQ2xCLHNCQUNTLGVBQ0ssb0JBQ3BDO0FBQ0QsVUFBTTtBQUxtQztBQUVUO0FBQ0s7QUFadEMsU0FBaUIsbUJBQW1CLElBQUksVUFBVTtBQUtsRCxTQUFpQix5QkFBeUIsS0FBSyxJQUFJLElBQUksUUFBYyxDQUFDO0FBQ3RFLFNBQVMsd0JBQXdCLEtBQUssdUJBQXVCO0FBa1A3RCxTQUFRLDRCQUFxQztBQXpPNUMsU0FBSyxtQkFBbUIsS0FBSyxJQUFJLHFCQUFxQixlQUFlLGlCQUFpQixDQUFDO0FBQUEsRUFDeEY7QUFBQSxFQUVBLE1BQU0sS0FBSyxVQUF5RCxPQUFrRjtBQUNySixT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cUJBQXFCLE1BQW9CO0FBQ2hELFVBQU0sYUFBYSxLQUFLLGFBQWEsS0FBSyxXQUFXLFNBQVMsY0FBYyxLQUFLLElBQUk7QUFDckYsVUFBTSxZQUFZLFlBQVksUUFBUSxTQUFZLFNBQVk7QUFBQSxNQUM3RCxpQkFBaUIsV0FBVyxPQUFPO0FBQUEsTUFDbkMsYUFBYSxXQUFXLE9BQU87QUFBQSxNQUMvQixlQUFlLFdBQVc7QUFBQSxNQUMxQixXQUFXLFdBQVc7QUFBQSxJQUN2QjtBQUVBLFNBQUssaUJBQWlCLElBQUk7QUFDMUIsU0FBSyxpQkFBaUIsTUFBTSxZQUFZO0FBQ3ZDLFlBQU0sS0FBSyxpQkFBaUIsb0JBQW9CO0FBQUEsUUFDL0MsVUFBVSxLQUFLO0FBQUEsUUFDZixTQUFTLEVBQUUsZUFBZSxNQUFNLGdCQUFnQixNQUFNLGFBQWEsTUFBTSxVQUFVO0FBQUEsTUFDcEYsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUdRLHVCQUF1QixNQUFhO0FBQzNDLFVBQU0sUUFBUSxLQUFLLFdBQVc7QUFDOUIsUUFBSSxDQUFDLE9BQU87QUFDWDtBQUFBLElBQ0Q7QUFDQSxRQUFJLENBQUMsS0FBSywyQkFBMkI7QUFDcEMsWUFBTSxZQUFZLGdCQUFnQjtBQUNsQyxXQUFLLDRCQUE0QjtBQUFBLElBQ2xDO0FBQ0EsVUFBTSxZQUFZLFlBQVksS0FBSyxLQUFLO0FBQUEsRUFDekM7QUFDRDtBQXRRYSx3QkFBTjtBQUFBLEVBV0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWRVOyIsCiAgIm5hbWVzIjogWyJ3b3JkUGlja3MiLCAiZmlsZVBpY2tzIiwgImZvbGRlclBpY2tzIiwgIndlYlBpY2tzIiwgInBpY2tzIl0KfQo=
