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
import { createCancelablePromise, RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import * as platform from "../../../../base/common/platform.js";
import * as resources from "../../../../base/common/resources.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { URI } from "../../../../base/common/uri.js";
import "./links.css";
import { MouseTargetType } from "../../../browser/editorBrowser.js";
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution } from "../../../browser/editorExtensions.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { TrackedRangeStickiness } from "../../../common/model.js";
import { ModelDecorationOptions } from "../../../common/model/textModel.js";
import { ILanguageFeatureDebounceService } from "../../../common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { ClickLinkGesture } from "../../gotoSymbol/browser/link/clickLinkGesture.js";
import { getLinks } from "./getLinks.js";
import * as nls from "../../../../nls.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
let LinkDetector = class extends Disposable {
  constructor(editor, openerService, notificationService, languageFeaturesService, languageFeatureDebounceService) {
    super();
    this.editor = editor;
    this.openerService = openerService;
    this.notificationService = notificationService;
    this.languageFeaturesService = languageFeaturesService;
    this.providers = this.languageFeaturesService.linkProvider;
    this.debounceInformation = languageFeatureDebounceService.for(this.providers, "Links", { min: 1e3, max: 4e3 });
    this.computeLinks = this._register(new RunOnceScheduler(() => this.computeLinksNow(), 1e3));
    this.computePromise = null;
    this.activeLinksList = null;
    this.currentOccurrences = {};
    this.activeLinkDecorationId = null;
    const clickLinkGesture = this._register(new ClickLinkGesture(editor));
    this._register(clickLinkGesture.onMouseMoveOrRelevantKeyDown(([mouseEvent, keyboardEvent]) => {
      this._onEditorMouseMove(mouseEvent, keyboardEvent);
    }));
    this._register(clickLinkGesture.onExecute((e) => {
      this.onEditorMouseUp(e);
    }));
    this._register(clickLinkGesture.onCancel((e) => {
      this.cleanUpActiveLinkDecoration();
    }));
    this._register(editor.onDidChangeConfiguration((e) => {
      if (!e.hasChanged(EditorOption.links)) {
        return;
      }
      this.updateDecorations([]);
      this.stop();
      this.computeLinks.schedule(0);
    }));
    this._register(editor.onDidChangeModelContent((e) => {
      if (!this.editor.hasModel()) {
        return;
      }
      this.computeLinks.schedule(this.debounceInformation.get(this.editor.getModel()));
    }));
    this._register(editor.onDidChangeModel((e) => {
      this.currentOccurrences = {};
      this.activeLinkDecorationId = null;
      this.stop();
      this.computeLinks.schedule(0);
    }));
    this._register(editor.onDidChangeModelLanguage((e) => {
      this.stop();
      this.computeLinks.schedule(0);
    }));
    this._register(this.providers.onDidChange((e) => {
      this.stop();
      this.computeLinks.schedule(0);
    }));
    this.computeLinks.schedule(0);
  }
  static get(editor) {
    return editor.getContribution(LinkDetector.ID);
  }
  async computeLinksNow() {
    if (!this.editor.hasModel() || !this.editor.getOption(EditorOption.links)) {
      return;
    }
    const model = this.editor.getModel();
    if (model.isTooLargeForSyncing()) {
      return;
    }
    if (!this.providers.has(model)) {
      return;
    }
    if (this.activeLinksList) {
      this.activeLinksList.dispose();
      this.activeLinksList = null;
    }
    this.computePromise = createCancelablePromise((token) => getLinks(this.providers, model, token));
    try {
      const sw = new StopWatch(false);
      this.activeLinksList = await this.computePromise;
      this.debounceInformation.update(model, sw.elapsed());
      if (model.isDisposed()) {
        return;
      }
      this.updateDecorations(this.activeLinksList.links);
    } catch (err) {
      onUnexpectedError(err);
    } finally {
      this.computePromise = null;
    }
  }
  updateDecorations(links) {
    const useMetaKey = this.editor.getOption(EditorOption.multiCursorModifier) === "altKey";
    const oldDecorations = [];
    const keys = Object.keys(this.currentOccurrences);
    for (const decorationId of keys) {
      const occurence = this.currentOccurrences[decorationId];
      oldDecorations.push(occurence.decorationId);
    }
    const newDecorations = [];
    if (links) {
      for (const link of links) {
        newDecorations.push(LinkOccurrence.decoration(link, useMetaKey));
      }
    }
    this.editor.changeDecorations((changeAccessor) => {
      const decorations = changeAccessor.deltaDecorations(oldDecorations, newDecorations);
      this.currentOccurrences = {};
      this.activeLinkDecorationId = null;
      for (let i = 0, len = decorations.length; i < len; i++) {
        const occurence = new LinkOccurrence(links[i], decorations[i]);
        this.currentOccurrences[occurence.decorationId] = occurence;
      }
    });
  }
  _onEditorMouseMove(mouseEvent, withKey) {
    const useMetaKey = this.editor.getOption(EditorOption.multiCursorModifier) === "altKey";
    if (this.isEnabled(mouseEvent, withKey)) {
      this.cleanUpActiveLinkDecoration();
      const occurrence = this.getLinkOccurrence(mouseEvent.target.position);
      if (occurrence) {
        this.editor.changeDecorations((changeAccessor) => {
          occurrence.activate(changeAccessor, useMetaKey);
          this.activeLinkDecorationId = occurrence.decorationId;
        });
      }
    } else {
      this.cleanUpActiveLinkDecoration();
    }
  }
  cleanUpActiveLinkDecoration() {
    const useMetaKey = this.editor.getOption(EditorOption.multiCursorModifier) === "altKey";
    if (this.activeLinkDecorationId) {
      const occurrence = this.currentOccurrences[this.activeLinkDecorationId];
      if (occurrence) {
        this.editor.changeDecorations((changeAccessor) => {
          occurrence.deactivate(changeAccessor, useMetaKey);
        });
      }
      this.activeLinkDecorationId = null;
    }
  }
  onEditorMouseUp(mouseEvent) {
    if (!this.isEnabled(mouseEvent)) {
      return;
    }
    const occurrence = this.getLinkOccurrence(mouseEvent.target.position);
    if (!occurrence) {
      return;
    }
    this.openLinkOccurrence(
      occurrence,
      mouseEvent.hasSideBySideModifier,
      true
      /* from user gesture */
    );
  }
  openLinkOccurrence(occurrence, openToSide, fromUserGesture = false) {
    if (!this.openerService) {
      return;
    }
    const { link } = occurrence;
    link.resolve(CancellationToken.None).then((uri) => {
      if (typeof uri === "string" && this.editor.hasModel()) {
        const modelUri = this.editor.getModel().uri;
        if (modelUri.scheme === Schemas.file && uri.startsWith(`${Schemas.file}:`)) {
          const parsedUri = URI.parse(uri);
          if (parsedUri.scheme === Schemas.file) {
            const fsPath = resources.originalFSPath(parsedUri);
            let relativePath = null;
            if (fsPath.startsWith("/./") || fsPath.startsWith("\\.\\")) {
              relativePath = `.${fsPath.substr(1)}`;
            } else if (fsPath.startsWith("//./") || fsPath.startsWith("\\\\.\\")) {
              relativePath = `.${fsPath.substr(2)}`;
            }
            if (relativePath) {
              uri = resources.joinPath(modelUri, relativePath);
            }
          }
        }
      }
      return this.openerService.open(uri, { openToSide, fromUserGesture, allowContributedOpeners: true, allowCommands: true, fromWorkspace: true });
    }, (err) => {
      const messageOrError = err instanceof Error ? err.message : err;
      if (messageOrError === "invalid") {
        this.notificationService.warn(nls.localize("invalid.url", "Failed to open this link because it is not well-formed: {0}", link.url.toString()));
      } else if (messageOrError === "missing") {
        this.notificationService.warn(nls.localize("missing.url", "Failed to open this link because its target is missing."));
      } else {
        onUnexpectedError(err);
      }
    });
  }
  getLinkOccurrence(position) {
    if (!this.editor.hasModel() || !position) {
      return null;
    }
    const decorations = this.editor.getModel().getDecorationsInRange({
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    }, 0, true);
    for (const decoration2 of decorations) {
      const currentOccurrence = this.currentOccurrences[decoration2.id];
      if (currentOccurrence) {
        return currentOccurrence;
      }
    }
    return null;
  }
  isEnabled(mouseEvent, withKey) {
    return Boolean(
      mouseEvent.target.type === MouseTargetType.CONTENT_TEXT && (mouseEvent.hasTriggerModifier || withKey && withKey.keyCodeIsTriggerKey)
    );
  }
  stop() {
    this.computeLinks.cancel();
    if (this.activeLinksList) {
      this.activeLinksList?.dispose();
      this.activeLinksList = null;
    }
    if (this.computePromise) {
      this.computePromise.cancel();
      this.computePromise = null;
    }
  }
  dispose() {
    super.dispose();
    this.stop();
  }
};
LinkDetector.ID = "editor.linkDetector";
LinkDetector = __decorateClass([
  __decorateParam(1, IOpenerService),
  __decorateParam(2, INotificationService),
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, ILanguageFeatureDebounceService)
], LinkDetector);
const decoration = {
  general: ModelDecorationOptions.register({
    description: "detected-link",
    stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    collapseOnReplaceEdit: true,
    inlineClassName: "detected-link"
  }),
  active: ModelDecorationOptions.register({
    description: "detected-link-active",
    stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    collapseOnReplaceEdit: true,
    inlineClassName: "detected-link-active"
  })
};
class LinkOccurrence {
  static decoration(link, useMetaKey) {
    return {
      range: link.range,
      options: LinkOccurrence._getOptions(link, useMetaKey, false)
    };
  }
  static _getOptions(link, useMetaKey, isActive) {
    const options = { ...isActive ? decoration.active : decoration.general };
    options.hoverMessage = getHoverMessage(link, useMetaKey);
    return options;
  }
  constructor(link, decorationId) {
    this.link = link;
    this.decorationId = decorationId;
  }
  activate(changeAccessor, useMetaKey) {
    changeAccessor.changeDecorationOptions(this.decorationId, LinkOccurrence._getOptions(this.link, useMetaKey, true));
  }
  deactivate(changeAccessor, useMetaKey) {
    changeAccessor.changeDecorationOptions(this.decorationId, LinkOccurrence._getOptions(this.link, useMetaKey, false));
  }
}
function getHoverMessage(link, useMetaKey) {
  const executeCmd = link.url && /^command:/i.test(link.url.toString());
  const label = link.tooltip ? link.tooltip : executeCmd ? nls.localize("links.navigate.executeCmd", "Execute command") : nls.localize("links.navigate.follow", "Follow link");
  const kb = useMetaKey ? platform.isMacintosh ? nls.localize("links.navigate.kb.meta.mac", "cmd + click") : nls.localize("links.navigate.kb.meta", "ctrl + click") : platform.isMacintosh ? nls.localize("links.navigate.kb.alt.mac", "option + click") : nls.localize("links.navigate.kb.alt", "alt + click");
  if (link.url) {
    let nativeLabel = "";
    if (/^command:/i.test(link.url.toString())) {
      const match = link.url.toString().match(/^command:([^?#]+)/);
      if (match) {
        const commandId = match[1];
        nativeLabel = nls.localize("tooltip.explanation", "Execute command {0}", commandId);
      }
    }
    const hoverMessage = new MarkdownString("", true).appendLink(link.url.toString(true).replace(/ /g, "%20"), label, nativeLabel).appendMarkdown(` (${kb})`);
    return hoverMessage;
  } else {
    return new MarkdownString().appendText(`${label} (${kb})`);
  }
}
class OpenLinkAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.openLink",
      label: nls.localize2("label", "Open Link"),
      precondition: void 0
    });
  }
  run(accessor, editor) {
    const linkDetector = LinkDetector.get(editor);
    if (!linkDetector) {
      return;
    }
    if (!editor.hasModel()) {
      return;
    }
    const selections = editor.getSelections();
    for (const sel of selections) {
      const link = linkDetector.getLinkOccurrence(sel.getEndPosition());
      if (link) {
        linkDetector.openLinkOccurrence(link, false);
      }
    }
  }
}
registerEditorContribution(LinkDetector.ID, LinkDetector, EditorContributionInstantiation.AfterFirstRender);
registerEditorAction(OpenLinkAction);
export {
  LinkDetector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5rcy9icm93c2VyL2xpbmtzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UsIENhbmNlbGFibGVQcm9taXNlLCBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgJy4vbGlua3MuY3NzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBNb3VzZVRhcmdldFR5cGUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLCByZWdpc3RlckVkaXRvckFjdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24sIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTGlua1Byb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWNvcmF0aW9uc0NoYW5nZUFjY2Vzc29yLCBJTW9kZWxEZWx0YURlY29yYXRpb24sIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9kZWxEZWNvcmF0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUZlYXR1cmVEZWJvdW5jZUluZm9ybWF0aW9uLCBJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZURlYm91bmNlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IENsaWNrTGlua0dlc3R1cmUsIENsaWNrTGlua0tleWJvYXJkRXZlbnQsIENsaWNrTGlua01vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi9nb3RvU3ltYm9sL2Jyb3dzZXIvbGluay9jbGlja0xpbmtHZXN0dXJlLmpzJztcbmltcG9ydCB7IGdldExpbmtzLCBMaW5rLCBMaW5rc0xpc3QgfSBmcm9tICcuL2dldExpbmtzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcblxuZXhwb3J0IGNsYXNzIExpbmtEZXRlY3RvciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSAnZWRpdG9yLmxpbmtEZXRlY3Rvcic7XG5cblx0cHVibGljIHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IExpbmtEZXRlY3RvciB8IG51bGwge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPExpbmtEZXRlY3Rvcj4oTGlua0RldGVjdG9yLklEKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgcHJvdmlkZXJzOiBMYW5ndWFnZUZlYXR1cmVSZWdpc3RyeTxMaW5rUHJvdmlkZXI+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGRlYm91bmNlSW5mb3JtYXRpb246IElGZWF0dXJlRGVib3VuY2VJbmZvcm1hdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBjb21wdXRlTGlua3M6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cdHByaXZhdGUgY29tcHV0ZVByb21pc2U6IENhbmNlbGFibGVQcm9taXNlPExpbmtzTGlzdD4gfCBudWxsO1xuXHRwcml2YXRlIGFjdGl2ZUxpbmtzTGlzdDogTGlua3NMaXN0IHwgbnVsbDtcblx0cHJpdmF0ZSBhY3RpdmVMaW5rRGVjb3JhdGlvbklkOiBzdHJpbmcgfCBudWxsO1xuXHRwcml2YXRlIGN1cnJlbnRPY2N1cnJlbmNlczogeyBbZGVjb3JhdGlvbklkOiBzdHJpbmddOiBMaW5rT2NjdXJyZW5jZSB9O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSBsYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnByb3ZpZGVycyA9IHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UubGlua1Byb3ZpZGVyO1xuXHRcdHRoaXMuZGVib3VuY2VJbmZvcm1hdGlvbiA9IGxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZS5mb3IodGhpcy5wcm92aWRlcnMsICdMaW5rcycsIHsgbWluOiAxMDAwLCBtYXg6IDQwMDAgfSk7XG5cdFx0dGhpcy5jb21wdXRlTGlua3MgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmNvbXB1dGVMaW5rc05vdygpLCAxMDAwKSk7XG5cdFx0dGhpcy5jb21wdXRlUHJvbWlzZSA9IG51bGw7XG5cdFx0dGhpcy5hY3RpdmVMaW5rc0xpc3QgPSBudWxsO1xuXHRcdHRoaXMuY3VycmVudE9jY3VycmVuY2VzID0ge307XG5cdFx0dGhpcy5hY3RpdmVMaW5rRGVjb3JhdGlvbklkID0gbnVsbDtcblxuXHRcdGNvbnN0IGNsaWNrTGlua0dlc3R1cmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2xpY2tMaW5rR2VzdHVyZShlZGl0b3IpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNsaWNrTGlua0dlc3R1cmUub25Nb3VzZU1vdmVPclJlbGV2YW50S2V5RG93bigoW21vdXNlRXZlbnQsIGtleWJvYXJkRXZlbnRdKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkVkaXRvck1vdXNlTW92ZShtb3VzZUV2ZW50LCBrZXlib2FyZEV2ZW50KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY2xpY2tMaW5rR2VzdHVyZS5vbkV4ZWN1dGUoKGUpID0+IHtcblx0XHRcdHRoaXMub25FZGl0b3JNb3VzZVVwKGUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihjbGlja0xpbmtHZXN0dXJlLm9uQ2FuY2VsKChlKSA9PiB7XG5cdFx0XHR0aGlzLmNsZWFuVXBBY3RpdmVMaW5rRGVjb3JhdGlvbigpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoIWUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ubGlua3MpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdC8vIFJlbW92ZSBhbnkgbGlua3MgKGZvciB0aGUgZ2V0dGluZyBkaXNhYmxlZCBjYXNlKVxuXHRcdFx0dGhpcy51cGRhdGVEZWNvcmF0aW9ucyhbXSk7XG5cblx0XHRcdC8vIFN0b3AgYW55IGNvbXB1dGF0aW9uIChmb3IgdGhlIGdldHRpbmcgZGlzYWJsZWQgY2FzZSlcblx0XHRcdHRoaXMuc3RvcCgpO1xuXG5cdFx0XHQvLyBTdGFydCBjb21wdXRpbmcgKGZvciB0aGUgZ2V0dGluZyBlbmFibGVkIGNhc2UpXG5cdFx0XHR0aGlzLmNvbXB1dGVMaW5rcy5zY2hlZHVsZSgwKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KChlKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5jb21wdXRlTGlua3Muc2NoZWR1bGUodGhpcy5kZWJvdW5jZUluZm9ybWF0aW9uLmdldCh0aGlzLmVkaXRvci5nZXRNb2RlbCgpKSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsKChlKSA9PiB7XG5cdFx0XHR0aGlzLmN1cnJlbnRPY2N1cnJlbmNlcyA9IHt9O1xuXHRcdFx0dGhpcy5hY3RpdmVMaW5rRGVjb3JhdGlvbklkID0gbnVsbDtcblx0XHRcdHRoaXMuc3RvcCgpO1xuXHRcdFx0dGhpcy5jb21wdXRlTGlua3Muc2NoZWR1bGUoMCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvci5vbkRpZENoYW5nZU1vZGVsTGFuZ3VhZ2UoKGUpID0+IHtcblx0XHRcdHRoaXMuc3RvcCgpO1xuXHRcdFx0dGhpcy5jb21wdXRlTGlua3Muc2NoZWR1bGUoMCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucHJvdmlkZXJzLm9uRGlkQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHR0aGlzLnN0b3AoKTtcblx0XHRcdHRoaXMuY29tcHV0ZUxpbmtzLnNjaGVkdWxlKDApO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuY29tcHV0ZUxpbmtzLnNjaGVkdWxlKDApO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjb21wdXRlTGlua3NOb3coKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpIHx8ICF0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmtzKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdGlmIChtb2RlbC5pc1Rvb0xhcmdlRm9yU3luY2luZygpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnByb3ZpZGVycy5oYXMobW9kZWwpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuYWN0aXZlTGlua3NMaXN0KSB7XG5cdFx0XHR0aGlzLmFjdGl2ZUxpbmtzTGlzdC5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmFjdGl2ZUxpbmtzTGlzdCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0dGhpcy5jb21wdXRlUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IGdldExpbmtzKHRoaXMucHJvdmlkZXJzLCBtb2RlbCwgdG9rZW4pKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc3cgPSBuZXcgU3RvcFdhdGNoKGZhbHNlKTtcblx0XHRcdHRoaXMuYWN0aXZlTGlua3NMaXN0ID0gYXdhaXQgdGhpcy5jb21wdXRlUHJvbWlzZTtcblx0XHRcdHRoaXMuZGVib3VuY2VJbmZvcm1hdGlvbi51cGRhdGUobW9kZWwsIHN3LmVsYXBzZWQoKSk7XG5cdFx0XHRpZiAobW9kZWwuaXNEaXNwb3NlZCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlRGVjb3JhdGlvbnModGhpcy5hY3RpdmVMaW5rc0xpc3QubGlua3MpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5jb21wdXRlUHJvbWlzZSA9IG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVEZWNvcmF0aW9ucyhsaW5rczogTGlua1tdKTogdm9pZCB7XG5cdFx0Y29uc3QgdXNlTWV0YUtleSA9ICh0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLm11bHRpQ3Vyc29yTW9kaWZpZXIpID09PSAnYWx0S2V5Jyk7XG5cdFx0Y29uc3Qgb2xkRGVjb3JhdGlvbnM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuY3VycmVudE9jY3VycmVuY2VzKTtcblx0XHRmb3IgKGNvbnN0IGRlY29yYXRpb25JZCBvZiBrZXlzKSB7XG5cdFx0XHRjb25zdCBvY2N1cmVuY2UgPSB0aGlzLmN1cnJlbnRPY2N1cnJlbmNlc1tkZWNvcmF0aW9uSWRdO1xuXHRcdFx0b2xkRGVjb3JhdGlvbnMucHVzaChvY2N1cmVuY2UuZGVjb3JhdGlvbklkKTtcblx0XHR9XG5cblx0XHRjb25zdCBuZXdEZWNvcmF0aW9uczogSU1vZGVsRGVsdGFEZWNvcmF0aW9uW10gPSBbXTtcblx0XHRpZiAobGlua3MpIHtcblx0XHRcdC8vIE5vdCBzdXJlIHdoeSB0aGlzIGlzIHNvbWV0aW1lcyBudWxsXG5cdFx0XHRmb3IgKGNvbnN0IGxpbmsgb2YgbGlua3MpIHtcblx0XHRcdFx0bmV3RGVjb3JhdGlvbnMucHVzaChMaW5rT2NjdXJyZW5jZS5kZWNvcmF0aW9uKGxpbmssIHVzZU1ldGFLZXkpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmVkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucygoY2hhbmdlQWNjZXNzb3IpID0+IHtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25zID0gY2hhbmdlQWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhvbGREZWNvcmF0aW9ucywgbmV3RGVjb3JhdGlvbnMpO1xuXG5cdFx0XHR0aGlzLmN1cnJlbnRPY2N1cnJlbmNlcyA9IHt9O1xuXHRcdFx0dGhpcy5hY3RpdmVMaW5rRGVjb3JhdGlvbklkID0gbnVsbDtcblx0XHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBkZWNvcmF0aW9ucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRjb25zdCBvY2N1cmVuY2UgPSBuZXcgTGlua09jY3VycmVuY2UobGlua3NbaV0sIGRlY29yYXRpb25zW2ldKTtcblx0XHRcdFx0dGhpcy5jdXJyZW50T2NjdXJyZW5jZXNbb2NjdXJlbmNlLmRlY29yYXRpb25JZF0gPSBvY2N1cmVuY2U7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkVkaXRvck1vdXNlTW92ZShtb3VzZUV2ZW50OiBDbGlja0xpbmtNb3VzZUV2ZW50LCB3aXRoS2V5OiBDbGlja0xpbmtLZXlib2FyZEV2ZW50IHwgbnVsbCk6IHZvaWQge1xuXHRcdGNvbnN0IHVzZU1ldGFLZXkgPSAodGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5tdWx0aUN1cnNvck1vZGlmaWVyKSA9PT0gJ2FsdEtleScpO1xuXHRcdGlmICh0aGlzLmlzRW5hYmxlZChtb3VzZUV2ZW50LCB3aXRoS2V5KSkge1xuXHRcdFx0dGhpcy5jbGVhblVwQWN0aXZlTGlua0RlY29yYXRpb24oKTsgLy8gYWx3YXlzIHJlbW92ZSBwcmV2aW91cyBsaW5rIGRlY29yYXRpb24gYXMgdGhlaXIgY2FuIG9ubHkgYmUgb25lXG5cdFx0XHRjb25zdCBvY2N1cnJlbmNlID0gdGhpcy5nZXRMaW5rT2NjdXJyZW5jZShtb3VzZUV2ZW50LnRhcmdldC5wb3NpdGlvbik7XG5cdFx0XHRpZiAob2NjdXJyZW5jZSkge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucygoY2hhbmdlQWNjZXNzb3IpID0+IHtcblx0XHRcdFx0XHRvY2N1cnJlbmNlLmFjdGl2YXRlKGNoYW5nZUFjY2Vzc29yLCB1c2VNZXRhS2V5KTtcblx0XHRcdFx0XHR0aGlzLmFjdGl2ZUxpbmtEZWNvcmF0aW9uSWQgPSBvY2N1cnJlbmNlLmRlY29yYXRpb25JZDtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY2xlYW5VcEFjdGl2ZUxpbmtEZWNvcmF0aW9uKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhblVwQWN0aXZlTGlua0RlY29yYXRpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgdXNlTWV0YUtleSA9ICh0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLm11bHRpQ3Vyc29yTW9kaWZpZXIpID09PSAnYWx0S2V5Jyk7XG5cdFx0aWYgKHRoaXMuYWN0aXZlTGlua0RlY29yYXRpb25JZCkge1xuXHRcdFx0Y29uc3Qgb2NjdXJyZW5jZSA9IHRoaXMuY3VycmVudE9jY3VycmVuY2VzW3RoaXMuYWN0aXZlTGlua0RlY29yYXRpb25JZF07XG5cdFx0XHRpZiAob2NjdXJyZW5jZSkge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5jaGFuZ2VEZWNvcmF0aW9ucygoY2hhbmdlQWNjZXNzb3IpID0+IHtcblx0XHRcdFx0XHRvY2N1cnJlbmNlLmRlYWN0aXZhdGUoY2hhbmdlQWNjZXNzb3IsIHVzZU1ldGFLZXkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5hY3RpdmVMaW5rRGVjb3JhdGlvbklkID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRWRpdG9yTW91c2VVcChtb3VzZUV2ZW50OiBDbGlja0xpbmtNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmlzRW5hYmxlZChtb3VzZUV2ZW50KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBvY2N1cnJlbmNlID0gdGhpcy5nZXRMaW5rT2NjdXJyZW5jZShtb3VzZUV2ZW50LnRhcmdldC5wb3NpdGlvbik7XG5cdFx0aWYgKCFvY2N1cnJlbmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMub3BlbkxpbmtPY2N1cnJlbmNlKG9jY3VycmVuY2UsIG1vdXNlRXZlbnQuaGFzU2lkZUJ5U2lkZU1vZGlmaWVyLCB0cnVlIC8qIGZyb20gdXNlciBnZXN0dXJlICovKTtcblx0fVxuXG5cdHB1YmxpYyBvcGVuTGlua09jY3VycmVuY2Uob2NjdXJyZW5jZTogTGlua09jY3VycmVuY2UsIG9wZW5Ub1NpZGU6IGJvb2xlYW4sIGZyb21Vc2VyR2VzdHVyZSA9IGZhbHNlKTogdm9pZCB7XG5cblx0XHRpZiAoIXRoaXMub3BlbmVyU2VydmljZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgbGluayB9ID0gb2NjdXJyZW5jZTtcblxuXHRcdGxpbmsucmVzb2x2ZShDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKS50aGVuKHVyaSA9PiB7XG5cblx0XHRcdC8vIFN1cHBvcnQgZm9yIHJlbGF0aXZlIGZpbGUgVVJJcyBvZiB0aGUgc2hhcGUgZmlsZTovLy4vcmVsYXRpdmVGaWxlLnR4dCBvciBmaWxlOi8vLy4vcmVsYXRpdmVGaWxlLnR4dFxuXHRcdFx0aWYgKHR5cGVvZiB1cmkgPT09ICdzdHJpbmcnICYmIHRoaXMuZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0Y29uc3QgbW9kZWxVcmkgPSB0aGlzLmVkaXRvci5nZXRNb2RlbCgpLnVyaTtcblx0XHRcdFx0aWYgKG1vZGVsVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlICYmIHVyaS5zdGFydHNXaXRoKGAke1NjaGVtYXMuZmlsZX06YCkpIHtcblx0XHRcdFx0XHRjb25zdCBwYXJzZWRVcmkgPSBVUkkucGFyc2UodXJpKTtcblx0XHRcdFx0XHRpZiAocGFyc2VkVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBmc1BhdGggPSByZXNvdXJjZXMub3JpZ2luYWxGU1BhdGgocGFyc2VkVXJpKTtcblxuXHRcdFx0XHRcdFx0bGV0IHJlbGF0aXZlUGF0aDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRcdFx0XHRpZiAoZnNQYXRoLnN0YXJ0c1dpdGgoJy8uLycpIHx8IGZzUGF0aC5zdGFydHNXaXRoKCdcXFxcLlxcXFwnKSkge1xuXHRcdFx0XHRcdFx0XHRyZWxhdGl2ZVBhdGggPSBgLiR7ZnNQYXRoLnN1YnN0cigxKX1gO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChmc1BhdGguc3RhcnRzV2l0aCgnLy8uLycpIHx8IGZzUGF0aC5zdGFydHNXaXRoKCdcXFxcXFxcXC5cXFxcJykpIHtcblx0XHRcdFx0XHRcdFx0cmVsYXRpdmVQYXRoID0gYC4ke2ZzUGF0aC5zdWJzdHIoMil9YDtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKHJlbGF0aXZlUGF0aCkge1xuXHRcdFx0XHRcdFx0XHR1cmkgPSByZXNvdXJjZXMuam9pblBhdGgobW9kZWxVcmksIHJlbGF0aXZlUGF0aCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLm9wZW5lclNlcnZpY2Uub3Blbih1cmksIHsgb3BlblRvU2lkZSwgZnJvbVVzZXJHZXN0dXJlLCBhbGxvd0NvbnRyaWJ1dGVkT3BlbmVyczogdHJ1ZSwgYWxsb3dDb21tYW5kczogdHJ1ZSwgZnJvbVdvcmtzcGFjZTogdHJ1ZSB9KTtcblxuXHRcdH0sIGVyciA9PiB7XG5cdFx0XHRjb25zdCBtZXNzYWdlT3JFcnJvciA9XG5cdFx0XHRcdGVyciBpbnN0YW5jZW9mIEVycm9yID8gKDxFcnJvcj5lcnIpLm1lc3NhZ2UgOiBlcnI7XG5cdFx0XHQvLyBkaWZmZXJlbnQgZXJyb3IgY2FzZXNcblx0XHRcdGlmIChtZXNzYWdlT3JFcnJvciA9PT0gJ2ludmFsaWQnKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS53YXJuKG5scy5sb2NhbGl6ZSgnaW52YWxpZC51cmwnLCAnRmFpbGVkIHRvIG9wZW4gdGhpcyBsaW5rIGJlY2F1c2UgaXQgaXMgbm90IHdlbGwtZm9ybWVkOiB7MH0nLCBsaW5rLnVybCEudG9TdHJpbmcoKSkpO1xuXHRcdFx0fSBlbHNlIGlmIChtZXNzYWdlT3JFcnJvciA9PT0gJ21pc3NpbmcnKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS53YXJuKG5scy5sb2NhbGl6ZSgnbWlzc2luZy51cmwnLCAnRmFpbGVkIHRvIG9wZW4gdGhpcyBsaW5rIGJlY2F1c2UgaXRzIHRhcmdldCBpcyBtaXNzaW5nLicpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGlua09jY3VycmVuY2UocG9zaXRpb246IFBvc2l0aW9uIHwgbnVsbCk6IExpbmtPY2N1cnJlbmNlIHwgbnVsbCB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpIHx8ICFwb3NpdGlvbikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IGRlY29yYXRpb25zID0gdGhpcy5lZGl0b3IuZ2V0TW9kZWwoKS5nZXREZWNvcmF0aW9uc0luUmFuZ2Uoe1xuXHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBwb3NpdGlvbi5saW5lTnVtYmVyLFxuXHRcdFx0c3RhcnRDb2x1bW46IHBvc2l0aW9uLmNvbHVtbixcblx0XHRcdGVuZExpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRlbmRDb2x1bW46IHBvc2l0aW9uLmNvbHVtblxuXHRcdH0sIDAsIHRydWUpO1xuXG5cdFx0Zm9yIChjb25zdCBkZWNvcmF0aW9uIG9mIGRlY29yYXRpb25zKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50T2NjdXJyZW5jZSA9IHRoaXMuY3VycmVudE9jY3VycmVuY2VzW2RlY29yYXRpb24uaWRdO1xuXHRcdFx0aWYgKGN1cnJlbnRPY2N1cnJlbmNlKSB7XG5cdFx0XHRcdHJldHVybiBjdXJyZW50T2NjdXJyZW5jZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgaXNFbmFibGVkKG1vdXNlRXZlbnQ6IENsaWNrTGlua01vdXNlRXZlbnQsIHdpdGhLZXk/OiBDbGlja0xpbmtLZXlib2FyZEV2ZW50IHwgbnVsbCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBCb29sZWFuKFxuXHRcdFx0KG1vdXNlRXZlbnQudGFyZ2V0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5DT05URU5UX1RFWFQpXG5cdFx0XHQmJiAobW91c2VFdmVudC5oYXNUcmlnZ2VyTW9kaWZpZXIgfHwgKHdpdGhLZXkgJiYgd2l0aEtleS5rZXlDb2RlSXNUcmlnZ2VyS2V5KSlcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdG9wKCk6IHZvaWQge1xuXHRcdHRoaXMuY29tcHV0ZUxpbmtzLmNhbmNlbCgpO1xuXHRcdGlmICh0aGlzLmFjdGl2ZUxpbmtzTGlzdCkge1xuXHRcdFx0dGhpcy5hY3RpdmVMaW5rc0xpc3Q/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuYWN0aXZlTGlua3NMaXN0ID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuY29tcHV0ZVByb21pc2UpIHtcblx0XHRcdHRoaXMuY29tcHV0ZVByb21pc2UuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLmNvbXB1dGVQcm9taXNlID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5zdG9wKCk7XG5cdH1cbn1cblxuY29uc3QgZGVjb3JhdGlvbiA9IHtcblx0Z2VuZXJhbDogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0ZGVzY3JpcHRpb246ICdkZXRlY3RlZC1saW5rJyxcblx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHRjb2xsYXBzZU9uUmVwbGFjZUVkaXQ6IHRydWUsXG5cdFx0aW5saW5lQ2xhc3NOYW1lOiAnZGV0ZWN0ZWQtbGluaydcblx0fSksXG5cdGFjdGl2ZTogTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0ZGVzY3JpcHRpb246ICdkZXRlY3RlZC1saW5rLWFjdGl2ZScsXG5cdFx0c3RpY2tpbmVzczogVHJhY2tlZFJhbmdlU3RpY2tpbmVzcy5OZXZlckdyb3dzV2hlblR5cGluZ0F0RWRnZXMsXG5cdFx0Y29sbGFwc2VPblJlcGxhY2VFZGl0OiB0cnVlLFxuXHRcdGlubGluZUNsYXNzTmFtZTogJ2RldGVjdGVkLWxpbmstYWN0aXZlJ1xuXHR9KVxufTtcblxuY2xhc3MgTGlua09jY3VycmVuY2Uge1xuXG5cdHB1YmxpYyBzdGF0aWMgZGVjb3JhdGlvbihsaW5rOiBMaW5rLCB1c2VNZXRhS2V5OiBib29sZWFuKTogSU1vZGVsRGVsdGFEZWNvcmF0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IGxpbmsucmFuZ2UsXG5cdFx0XHRvcHRpb25zOiBMaW5rT2NjdXJyZW5jZS5fZ2V0T3B0aW9ucyhsaW5rLCB1c2VNZXRhS2V5LCBmYWxzZSlcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2dldE9wdGlvbnMobGluazogTGluaywgdXNlTWV0YUtleTogYm9vbGVhbiwgaXNBY3RpdmU6IGJvb2xlYW4pOiBNb2RlbERlY29yYXRpb25PcHRpb25zIHtcblx0XHRjb25zdCBvcHRpb25zID0geyAuLi4gKGlzQWN0aXZlID8gZGVjb3JhdGlvbi5hY3RpdmUgOiBkZWNvcmF0aW9uLmdlbmVyYWwpIH07XG5cdFx0b3B0aW9ucy5ob3Zlck1lc3NhZ2UgPSBnZXRIb3Zlck1lc3NhZ2UobGluaywgdXNlTWV0YUtleSk7XG5cdFx0cmV0dXJuIG9wdGlvbnM7XG5cdH1cblxuXHRwdWJsaWMgZGVjb3JhdGlvbklkOiBzdHJpbmc7XG5cdHB1YmxpYyBsaW5rOiBMaW5rO1xuXG5cdGNvbnN0cnVjdG9yKGxpbms6IExpbmssIGRlY29yYXRpb25JZDogc3RyaW5nKSB7XG5cdFx0dGhpcy5saW5rID0gbGluaztcblx0XHR0aGlzLmRlY29yYXRpb25JZCA9IGRlY29yYXRpb25JZDtcblx0fVxuXG5cdHB1YmxpYyBhY3RpdmF0ZShjaGFuZ2VBY2Nlc3NvcjogSU1vZGVsRGVjb3JhdGlvbnNDaGFuZ2VBY2Nlc3NvciwgdXNlTWV0YUtleTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNoYW5nZUFjY2Vzc29yLmNoYW5nZURlY29yYXRpb25PcHRpb25zKHRoaXMuZGVjb3JhdGlvbklkLCBMaW5rT2NjdXJyZW5jZS5fZ2V0T3B0aW9ucyh0aGlzLmxpbmssIHVzZU1ldGFLZXksIHRydWUpKTtcblx0fVxuXG5cdHB1YmxpYyBkZWFjdGl2YXRlKGNoYW5nZUFjY2Vzc29yOiBJTW9kZWxEZWNvcmF0aW9uc0NoYW5nZUFjY2Vzc29yLCB1c2VNZXRhS2V5OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y2hhbmdlQWNjZXNzb3IuY2hhbmdlRGVjb3JhdGlvbk9wdGlvbnModGhpcy5kZWNvcmF0aW9uSWQsIExpbmtPY2N1cnJlbmNlLl9nZXRPcHRpb25zKHRoaXMubGluaywgdXNlTWV0YUtleSwgZmFsc2UpKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRIb3Zlck1lc3NhZ2UobGluazogTGluaywgdXNlTWV0YUtleTogYm9vbGVhbik6IE1hcmtkb3duU3RyaW5nIHtcblx0Y29uc3QgZXhlY3V0ZUNtZCA9IGxpbmsudXJsICYmIC9eY29tbWFuZDovaS50ZXN0KGxpbmsudXJsLnRvU3RyaW5nKCkpO1xuXG5cdGNvbnN0IGxhYmVsID0gbGluay50b29sdGlwXG5cdFx0PyBsaW5rLnRvb2x0aXBcblx0XHQ6IGV4ZWN1dGVDbWRcblx0XHRcdD8gbmxzLmxvY2FsaXplKCdsaW5rcy5uYXZpZ2F0ZS5leGVjdXRlQ21kJywgJ0V4ZWN1dGUgY29tbWFuZCcpXG5cdFx0XHQ6IG5scy5sb2NhbGl6ZSgnbGlua3MubmF2aWdhdGUuZm9sbG93JywgJ0ZvbGxvdyBsaW5rJyk7XG5cblx0Y29uc3Qga2IgPSB1c2VNZXRhS2V5XG5cdFx0PyBwbGF0Zm9ybS5pc01hY2ludG9zaFxuXHRcdFx0PyBubHMubG9jYWxpemUoJ2xpbmtzLm5hdmlnYXRlLmtiLm1ldGEubWFjJywgXCJjbWQgKyBjbGlja1wiKVxuXHRcdFx0OiBubHMubG9jYWxpemUoJ2xpbmtzLm5hdmlnYXRlLmtiLm1ldGEnLCBcImN0cmwgKyBjbGlja1wiKVxuXHRcdDogcGxhdGZvcm0uaXNNYWNpbnRvc2hcblx0XHRcdD8gbmxzLmxvY2FsaXplKCdsaW5rcy5uYXZpZ2F0ZS5rYi5hbHQubWFjJywgXCJvcHRpb24gKyBjbGlja1wiKVxuXHRcdFx0OiBubHMubG9jYWxpemUoJ2xpbmtzLm5hdmlnYXRlLmtiLmFsdCcsIFwiYWx0ICsgY2xpY2tcIik7XG5cblx0aWYgKGxpbmsudXJsKSB7XG5cdFx0bGV0IG5hdGl2ZUxhYmVsID0gJyc7XG5cdFx0aWYgKC9eY29tbWFuZDovaS50ZXN0KGxpbmsudXJsLnRvU3RyaW5nKCkpKSB7XG5cdFx0XHQvLyBEb24ndCBzaG93IGNvbXBsZXRlIGNvbW1hbmQgYXJndW1lbnRzIGluIHRoZSBuYXRpdmUgdG9vbHRpcFxuXHRcdFx0Y29uc3QgbWF0Y2ggPSBsaW5rLnVybC50b1N0cmluZygpLm1hdGNoKC9eY29tbWFuZDooW14/I10rKS8pO1xuXHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmRJZCA9IG1hdGNoWzFdO1xuXHRcdFx0XHRuYXRpdmVMYWJlbCA9IG5scy5sb2NhbGl6ZSgndG9vbHRpcC5leHBsYW5hdGlvbicsIFwiRXhlY3V0ZSBjb21tYW5kIHswfVwiLCBjb21tYW5kSWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBob3Zlck1lc3NhZ2UgPSBuZXcgTWFya2Rvd25TdHJpbmcoJycsIHRydWUpXG5cdFx0XHQuYXBwZW5kTGluayhsaW5rLnVybC50b1N0cmluZyh0cnVlKS5yZXBsYWNlKC8gL2csICclMjAnKSwgbGFiZWwsIG5hdGl2ZUxhYmVsKVxuXHRcdFx0LmFwcGVuZE1hcmtkb3duKGAgKCR7a2J9KWApO1xuXHRcdHJldHVybiBob3Zlck1lc3NhZ2U7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZFRleHQoYCR7bGFiZWx9ICgke2tifSlgKTtcblx0fVxufVxuXG5jbGFzcyBPcGVuTGlua0FjdGlvbiBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLm9wZW5MaW5rJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdsYWJlbCcsIFwiT3BlbiBMaW5rXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiB1bmRlZmluZWRcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBsaW5rRGV0ZWN0b3IgPSBMaW5rRGV0ZWN0b3IuZ2V0KGVkaXRvcik7XG5cdFx0aWYgKCFsaW5rRGV0ZWN0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlbGVjdGlvbnMgPSBlZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdGZvciAoY29uc3Qgc2VsIG9mIHNlbGVjdGlvbnMpIHtcblx0XHRcdGNvbnN0IGxpbmsgPSBsaW5rRGV0ZWN0b3IuZ2V0TGlua09jY3VycmVuY2Uoc2VsLmdldEVuZFBvc2l0aW9uKCkpO1xuXHRcdFx0aWYgKGxpbmspIHtcblx0XHRcdFx0bGlua0RldGVjdG9yLm9wZW5MaW5rT2NjdXJyZW5jZShsaW5rLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uKExpbmtEZXRlY3Rvci5JRCwgTGlua0RldGVjdG9yLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkFmdGVyRmlyc3RSZW5kZXIpO1xucmVnaXN0ZXJFZGl0b3JBY3Rpb24oT3BlbkxpbmtBY3Rpb24pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHlCQUE0Qyx3QkFBd0I7QUFDN0UsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFlBQVksY0FBYztBQUMxQixZQUFZLGVBQWU7QUFDM0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUFXO0FBQ3BCLE9BQU87QUFDUCxTQUFzQix1QkFBdUI7QUFDN0MsU0FBUyxjQUFjLGlDQUFpQyxzQkFBc0Isa0NBQW9EO0FBQ2xJLFNBQVMsb0JBQW9CO0FBSzdCLFNBQWlFLDhCQUE4QjtBQUMvRixTQUFTLDhCQUE4QjtBQUN2QyxTQUFzQyx1Q0FBdUM7QUFDN0UsU0FBUyxn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
