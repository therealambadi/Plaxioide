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
import * as dom from "../../../../base/browser/dom.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { createCancelablePromise, disposableTimeout } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { basename } from "../../../../base/common/resources.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { CodeActionTriggerType } from "../../../common/languages.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { IMarkerDecorationsService } from "../../../common/services/markerDecorations.js";
import { ApplyCodeActionReason, getCodeActions, quickFixCommandId } from "../../codeAction/browser/codeAction.js";
import { CodeActionController } from "../../codeAction/browser/codeActionController.js";
import { CodeActionKind, CodeActionTriggerSource } from "../../codeAction/common/types.js";
import { MarkerController, NextMarkerAction } from "../../gotoError/browser/gotoError.js";
import { HoverAnchorType, RenderedHoverParts } from "./hoverTypes.js";
import * as nls from "../../../../nls.js";
import { IMarkerData, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
const $ = dom.$;
class MarkerHover {
  constructor(owner, range, marker) {
    this.owner = owner;
    this.range = range;
    this.marker = marker;
  }
  isValidForHoverAnchor(anchor) {
    return anchor.type === HoverAnchorType.Range && this.range.startColumn <= anchor.range.startColumn && this.range.endColumn >= anchor.range.endColumn;
  }
}
const markerCodeActionTrigger = {
  type: CodeActionTriggerType.Invoke,
  filter: { include: CodeActionKind.QuickFix },
  triggerAction: CodeActionTriggerSource.QuickFixHover
};
let MarkerHoverParticipant = class {
  constructor(_editor, _markerDecorationsService, _openerService, _languageFeaturesService) {
    this._editor = _editor;
    this._markerDecorationsService = _markerDecorationsService;
    this._openerService = _openerService;
    this._languageFeaturesService = _languageFeaturesService;
    this.hoverOrdinal = 1;
    this.recentMarkerCodeActionsInfo = void 0;
  }
  computeSync(anchor, lineDecorations) {
    if (!this._editor.hasModel() || anchor.type !== HoverAnchorType.Range && !anchor.supportsMarkerHover) {
      return [];
    }
    const model = this._editor.getModel();
    const lineNumber = anchor.range.startLineNumber;
    const maxColumn = model.getLineMaxColumn(lineNumber);
    const result = [];
    for (const d of lineDecorations) {
      const startColumn = d.range.startLineNumber === lineNumber ? d.range.startColumn : 1;
      const endColumn = d.range.endLineNumber === lineNumber ? d.range.endColumn : maxColumn;
      const marker = this._markerDecorationsService.getMarker(model.uri, d);
      if (!marker) {
        continue;
      }
      const range = new Range(anchor.range.startLineNumber, startColumn, anchor.range.startLineNumber, endColumn);
      result.push(new MarkerHover(this, range, marker));
    }
    return result;
  }
  renderHoverParts(context, hoverParts) {
    if (!hoverParts.length) {
      return new RenderedHoverParts([]);
    }
    const renderedHoverParts = [];
    hoverParts.forEach((hoverPart) => {
      const renderedMarkerHover = this._renderMarkerHover(hoverPart);
      context.fragment.appendChild(renderedMarkerHover.hoverElement);
      renderedHoverParts.push(renderedMarkerHover);
    });
    const markerHoverForStatusbar = hoverParts.length === 1 ? hoverParts[0] : hoverParts.sort((a, b) => MarkerSeverity.compare(a.marker.severity, b.marker.severity))[0];
    const disposables = this._renderMarkerStatusbar(context, markerHoverForStatusbar);
    return new RenderedHoverParts(renderedHoverParts, disposables);
  }
  getAccessibleContent(hoverPart) {
    return hoverPart.marker.message;
  }
  _renderMarkerHover(markerHover) {
    const disposables = new DisposableStore();
    const hoverElement = $("div.hover-row");
    const markerElement = dom.append(hoverElement, $("div.marker.hover-contents"));
    const { source, message, code, relatedInformation } = markerHover.marker;
    this._editor.applyFontInfo(markerElement);
    const messageElement = dom.append(markerElement, $("span"));
    messageElement.style.whiteSpace = "pre-wrap";
    messageElement.innerText = message;
    if (source || code) {
      if (code && typeof code !== "string") {
        const sourceAndCodeElement = $("span");
        if (source) {
          const sourceElement = dom.append(sourceAndCodeElement, $("span"));
          sourceElement.innerText = source;
        }
        const codeLink = dom.append(sourceAndCodeElement, $("a.code-link"));
        codeLink.setAttribute("href", code.target.toString(true));
        disposables.add(dom.addDisposableListener(codeLink, "click", (e) => {
          this._openerService.open(code.target, { allowCommands: true });
          e.preventDefault();
          e.stopPropagation();
        }));
        const codeElement = dom.append(codeLink, $("span"));
        codeElement.innerText = code.value;
        const detailsElement = dom.append(markerElement, sourceAndCodeElement);
        detailsElement.style.opacity = "0.6";
        detailsElement.style.paddingLeft = "6px";
      } else {
        const detailsElement = dom.append(markerElement, $("span"));
        detailsElement.style.opacity = "0.6";
        detailsElement.style.paddingLeft = "6px";
        detailsElement.innerText = source && code ? `${source}(${code})` : source ? source : `(${code})`;
      }
    }
    if (isNonEmptyArray(relatedInformation)) {
      for (const { message: message2, resource, startLineNumber, startColumn } of relatedInformation) {
        const relatedInfoContainer = dom.append(markerElement, $("div"));
        relatedInfoContainer.style.marginTop = "8px";
        const a = dom.append(relatedInfoContainer, $("a"));
        a.innerText = `${basename(resource)}(${startLineNumber}, ${startColumn}): `;
        a.style.cursor = "pointer";
        disposables.add(dom.addDisposableListener(a, "click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (this._openerService) {
            const editorOptions = { selection: { startLineNumber, startColumn } };
            this._openerService.open(resource, {
              fromUserGesture: true,
              editorOptions
            }).catch(onUnexpectedError);
          }
        }));
        const messageElement2 = dom.append(relatedInfoContainer, $("span"));
        messageElement2.innerText = message2;
        this._editor.applyFontInfo(messageElement2);
      }
    }
    const renderedHoverPart = {
      hoverPart: markerHover,
      hoverElement,
      dispose: () => disposables.dispose()
    };
    return renderedHoverPart;
  }
  _renderMarkerStatusbar(context, markerHover) {
    const disposables = new DisposableStore();
    if (markerHover.marker.severity === MarkerSeverity.Error || markerHover.marker.severity === MarkerSeverity.Warning || markerHover.marker.severity === MarkerSeverity.Info) {
      const markerController = MarkerController.get(this._editor);
      if (markerController) {
        context.statusBar.addAction({
          label: nls.localize("view problem", "View Problem"),
          commandId: NextMarkerAction.ID,
          run: () => {
            context.hide();
            markerController.showAtMarker(markerHover.marker);
            this._editor.focus();
          }
        });
      }
    }
    if (!this._editor.getOption(EditorOption.readOnly)) {
      const quickfixPlaceholderElement = context.statusBar.append($("div"));
      if (this.recentMarkerCodeActionsInfo) {
        if (IMarkerData.makeKey(this.recentMarkerCodeActionsInfo.marker) === IMarkerData.makeKey(markerHover.marker)) {
          if (!this.recentMarkerCodeActionsInfo.hasCodeActions) {
            quickfixPlaceholderElement.textContent = nls.localize("noQuickFixes", "No quick fixes available");
          }
        } else {
          this.recentMarkerCodeActionsInfo = void 0;
        }
      }
      const updatePlaceholderDisposable = this.recentMarkerCodeActionsInfo && !this.recentMarkerCodeActionsInfo.hasCodeActions ? Disposable.None : disposableTimeout(() => quickfixPlaceholderElement.textContent = nls.localize("checkingForQuickFixes", "Checking for quick fixes..."), 200, disposables);
      if (!quickfixPlaceholderElement.textContent) {
        quickfixPlaceholderElement.textContent = String.fromCharCode(160);
      }
      const codeActionsPromise = this.getCodeActions(markerHover.marker);
      disposables.add(toDisposable(() => codeActionsPromise.cancel()));
      codeActionsPromise.then((actions) => {
        updatePlaceholderDisposable.dispose();
        this.recentMarkerCodeActionsInfo = { marker: markerHover.marker, hasCodeActions: actions.validActions.length > 0 };
        if (!this.recentMarkerCodeActionsInfo.hasCodeActions) {
          actions.dispose();
          quickfixPlaceholderElement.textContent = nls.localize("noQuickFixes", "No quick fixes available");
          return;
        }
        quickfixPlaceholderElement.style.display = "none";
        let showing = false;
        disposables.add(toDisposable(() => {
          if (!showing) {
            actions.dispose();
          }
        }));
        context.statusBar.addAction({
          label: nls.localize("quick fixes", "Quick Fix..."),
          commandId: quickFixCommandId,
          run: (target) => {
            showing = true;
            const controller = CodeActionController.get(this._editor);
            const elementPosition = dom.getDomNodePagePosition(target);
            context.hide();
            controller?.showCodeActions(markerCodeActionTrigger, actions, {
              x: elementPosition.left,
              y: elementPosition.top,
              width: elementPosition.width,
              height: elementPosition.height
            });
          }
        });
        const aiCodeAction = actions.validActions.find((action) => action.action.isAI);
        if (aiCodeAction) {
          context.statusBar.addAction({
            label: aiCodeAction.action.title,
            commandId: aiCodeAction.action.command?.id ?? "",
            run: () => {
              const controller = CodeActionController.get(this._editor);
              controller?.applyCodeAction(aiCodeAction, false, false, ApplyCodeActionReason.FromProblemsHover);
            }
          });
        }
      }, onUnexpectedError);
    }
    return disposables;
  }
  getCodeActions(marker) {
    return createCancelablePromise((cancellationToken) => {
      return getCodeActions(
        this._languageFeaturesService.codeActionProvider,
        this._editor.getModel(),
        new Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn),
        markerCodeActionTrigger,
        Progress.None,
        cancellationToken
      );
    });
  }
};
MarkerHoverParticipant = __decorateClass([
  __decorateParam(1, IMarkerDecorationsService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, ILanguageFeaturesService)
], MarkerHoverParticipant);
export {
  MarkerHover,
  MarkerHoverParticipant
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL21hcmtlckhvdmVyUGFydGljaXBhbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBpc05vbkVtcHR5QXJyYXkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBkaXNwb3NhYmxlVGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBDb2RlQWN0aW9uVHJpZ2dlclR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElNb2RlbERlY29yYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSU1hcmtlckRlY29yYXRpb25zU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9tYXJrZXJEZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBBcHBseUNvZGVBY3Rpb25SZWFzb24sIGdldENvZGVBY3Rpb25zLCBxdWlja0ZpeENvbW1hbmRJZCB9IGZyb20gJy4uLy4uL2NvZGVBY3Rpb24vYnJvd3Nlci9jb2RlQWN0aW9uLmpzJztcbmltcG9ydCB7IENvZGVBY3Rpb25Db250cm9sbGVyIH0gZnJvbSAnLi4vLi4vY29kZUFjdGlvbi9icm93c2VyL2NvZGVBY3Rpb25Db250cm9sbGVyLmpzJztcbmltcG9ydCB7IENvZGVBY3Rpb25LaW5kLCBDb2RlQWN0aW9uU2V0LCBDb2RlQWN0aW9uVHJpZ2dlciwgQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UgfSBmcm9tICcuLi8uLi9jb2RlQWN0aW9uL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBNYXJrZXJDb250cm9sbGVyLCBOZXh0TWFya2VyQWN0aW9uIH0gZnJvbSAnLi4vLi4vZ290b0Vycm9yL2Jyb3dzZXIvZ290b0Vycm9yLmpzJztcbmltcG9ydCB7IEhvdmVyQW5jaG9yLCBIb3ZlckFuY2hvclR5cGUsIElFZGl0b3JIb3ZlclBhcnRpY2lwYW50LCBJRWRpdG9ySG92ZXJSZW5kZXJDb250ZXh0LCBJSG92ZXJQYXJ0LCBJUmVuZGVyZWRIb3ZlclBhcnQsIElSZW5kZXJlZEhvdmVyUGFydHMsIFJlbmRlcmVkSG92ZXJQYXJ0cyB9IGZyb20gJy4vaG92ZXJUeXBlcy5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElUZXh0RWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElNYXJrZXIsIElNYXJrZXJEYXRhLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuZXhwb3J0IGNsYXNzIE1hcmtlckhvdmVyIGltcGxlbWVudHMgSUhvdmVyUGFydCB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG93bmVyOiBJRWRpdG9ySG92ZXJQYXJ0aWNpcGFudDxNYXJrZXJIb3Zlcj4sXG5cdFx0cHVibGljIHJlYWRvbmx5IHJhbmdlOiBSYW5nZSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbWFya2VyOiBJTWFya2VyLFxuXHQpIHsgfVxuXG5cdHB1YmxpYyBpc1ZhbGlkRm9ySG92ZXJBbmNob3IoYW5jaG9yOiBIb3ZlckFuY2hvcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoXG5cdFx0XHRhbmNob3IudHlwZSA9PT0gSG92ZXJBbmNob3JUeXBlLlJhbmdlXG5cdFx0XHQmJiB0aGlzLnJhbmdlLnN0YXJ0Q29sdW1uIDw9IGFuY2hvci5yYW5nZS5zdGFydENvbHVtblxuXHRcdFx0JiYgdGhpcy5yYW5nZS5lbmRDb2x1bW4gPj0gYW5jaG9yLnJhbmdlLmVuZENvbHVtblxuXHRcdCk7XG5cdH1cbn1cblxuY29uc3QgbWFya2VyQ29kZUFjdGlvblRyaWdnZXI6IENvZGVBY3Rpb25UcmlnZ2VyID0ge1xuXHR0eXBlOiBDb2RlQWN0aW9uVHJpZ2dlclR5cGUuSW52b2tlLFxuXHRmaWx0ZXI6IHsgaW5jbHVkZTogQ29kZUFjdGlvbktpbmQuUXVpY2tGaXggfSxcblx0dHJpZ2dlckFjdGlvbjogQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UuUXVpY2tGaXhIb3ZlclxufTtcblxuZXhwb3J0IGNsYXNzIE1hcmtlckhvdmVyUGFydGljaXBhbnQgaW1wbGVtZW50cyBJRWRpdG9ySG92ZXJQYXJ0aWNpcGFudDxNYXJrZXJIb3Zlcj4ge1xuXG5cdHB1YmxpYyByZWFkb25seSBob3Zlck9yZGluYWw6IG51bWJlciA9IDE7XG5cblx0cHJpdmF0ZSByZWNlbnRNYXJrZXJDb2RlQWN0aW9uc0luZm86IHsgbWFya2VyOiBJTWFya2VyOyBoYXNDb2RlQWN0aW9uczogYm9vbGVhbiB9IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElNYXJrZXJEZWNvcmF0aW9uc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWFya2VyRGVjb3JhdGlvbnNTZXJ2aWNlOiBJTWFya2VyRGVjb3JhdGlvbnNTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0cHVibGljIGNvbXB1dGVTeW5jKGFuY2hvcjogSG92ZXJBbmNob3IsIGxpbmVEZWNvcmF0aW9uczogSU1vZGVsRGVjb3JhdGlvbltdKTogTWFya2VySG92ZXJbXSB7XG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCBhbmNob3IudHlwZSAhPT0gSG92ZXJBbmNob3JUeXBlLlJhbmdlICYmICFhbmNob3Iuc3VwcG9ydHNNYXJrZXJIb3Zlcikge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3QgbGluZU51bWJlciA9IGFuY2hvci5yYW5nZS5zdGFydExpbmVOdW1iZXI7XG5cdFx0Y29uc3QgbWF4Q29sdW1uID0gbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKTtcblx0XHRjb25zdCByZXN1bHQ6IE1hcmtlckhvdmVyW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGQgb2YgbGluZURlY29yYXRpb25zKSB7XG5cdFx0XHRjb25zdCBzdGFydENvbHVtbiA9IChkLnJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gbGluZU51bWJlcikgPyBkLnJhbmdlLnN0YXJ0Q29sdW1uIDogMTtcblx0XHRcdGNvbnN0IGVuZENvbHVtbiA9IChkLnJhbmdlLmVuZExpbmVOdW1iZXIgPT09IGxpbmVOdW1iZXIpID8gZC5yYW5nZS5lbmRDb2x1bW4gOiBtYXhDb2x1bW47XG5cblx0XHRcdGNvbnN0IG1hcmtlciA9IHRoaXMuX21hcmtlckRlY29yYXRpb25zU2VydmljZS5nZXRNYXJrZXIobW9kZWwudXJpLCBkKTtcblx0XHRcdGlmICghbWFya2VyKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShhbmNob3IucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbiwgYW5jaG9yLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgZW5kQ29sdW1uKTtcblx0XHRcdHJlc3VsdC5wdXNoKG5ldyBNYXJrZXJIb3Zlcih0aGlzLCByYW5nZSwgbWFya2VyKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyByZW5kZXJIb3ZlclBhcnRzKGNvbnRleHQ6IElFZGl0b3JIb3ZlclJlbmRlckNvbnRleHQsIGhvdmVyUGFydHM6IE1hcmtlckhvdmVyW10pOiBJUmVuZGVyZWRIb3ZlclBhcnRzPE1hcmtlckhvdmVyPiB7XG5cdFx0aWYgKCFob3ZlclBhcnRzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIG5ldyBSZW5kZXJlZEhvdmVyUGFydHMoW10pO1xuXHRcdH1cblx0XHRjb25zdCByZW5kZXJlZEhvdmVyUGFydHM6IElSZW5kZXJlZEhvdmVyUGFydDxNYXJrZXJIb3Zlcj5bXSA9IFtdO1xuXHRcdGhvdmVyUGFydHMuZm9yRWFjaChob3ZlclBhcnQgPT4ge1xuXHRcdFx0Y29uc3QgcmVuZGVyZWRNYXJrZXJIb3ZlciA9IHRoaXMuX3JlbmRlck1hcmtlckhvdmVyKGhvdmVyUGFydCk7XG5cdFx0XHRjb250ZXh0LmZyYWdtZW50LmFwcGVuZENoaWxkKHJlbmRlcmVkTWFya2VySG92ZXIuaG92ZXJFbGVtZW50KTtcblx0XHRcdHJlbmRlcmVkSG92ZXJQYXJ0cy5wdXNoKHJlbmRlcmVkTWFya2VySG92ZXIpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IG1hcmtlckhvdmVyRm9yU3RhdHVzYmFyID0gaG92ZXJQYXJ0cy5sZW5ndGggPT09IDEgPyBob3ZlclBhcnRzWzBdIDogaG92ZXJQYXJ0cy5zb3J0KChhLCBiKSA9PiBNYXJrZXJTZXZlcml0eS5jb21wYXJlKGEubWFya2VyLnNldmVyaXR5LCBiLm1hcmtlci5zZXZlcml0eSkpWzBdO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5fcmVuZGVyTWFya2VyU3RhdHVzYmFyKGNvbnRleHQsIG1hcmtlckhvdmVyRm9yU3RhdHVzYmFyKTtcblx0XHRyZXR1cm4gbmV3IFJlbmRlcmVkSG92ZXJQYXJ0cyhyZW5kZXJlZEhvdmVyUGFydHMsIGRpc3Bvc2FibGVzKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRBY2Nlc3NpYmxlQ29udGVudChob3ZlclBhcnQ6IE1hcmtlckhvdmVyKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gaG92ZXJQYXJ0Lm1hcmtlci5tZXNzYWdlO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyTWFya2VySG92ZXIobWFya2VySG92ZXI6IE1hcmtlckhvdmVyKTogSVJlbmRlcmVkSG92ZXJQYXJ0PE1hcmtlckhvdmVyPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBob3ZlckVsZW1lbnQgPSAkKCdkaXYuaG92ZXItcm93Jyk7XG5cdFx0Y29uc3QgbWFya2VyRWxlbWVudCA9IGRvbS5hcHBlbmQoaG92ZXJFbGVtZW50LCAkKCdkaXYubWFya2VyLmhvdmVyLWNvbnRlbnRzJykpO1xuXHRcdGNvbnN0IHsgc291cmNlLCBtZXNzYWdlLCBjb2RlLCByZWxhdGVkSW5mb3JtYXRpb24gfSA9IG1hcmtlckhvdmVyLm1hcmtlcjtcblxuXHRcdHRoaXMuX2VkaXRvci5hcHBseUZvbnRJbmZvKG1hcmtlckVsZW1lbnQpO1xuXHRcdGNvbnN0IG1lc3NhZ2VFbGVtZW50ID0gZG9tLmFwcGVuZChtYXJrZXJFbGVtZW50LCAkKCdzcGFuJykpO1xuXHRcdG1lc3NhZ2VFbGVtZW50LnN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xuXHRcdG1lc3NhZ2VFbGVtZW50LmlubmVyVGV4dCA9IG1lc3NhZ2U7XG5cblx0XHRpZiAoc291cmNlIHx8IGNvZGUpIHtcblx0XHRcdC8vIENvZGUgaGFzIGxpbmtcblx0XHRcdGlmIChjb2RlICYmIHR5cGVvZiBjb2RlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRjb25zdCBzb3VyY2VBbmRDb2RlRWxlbWVudCA9ICQoJ3NwYW4nKTtcblx0XHRcdFx0aWYgKHNvdXJjZSkge1xuXHRcdFx0XHRcdGNvbnN0IHNvdXJjZUVsZW1lbnQgPSBkb20uYXBwZW5kKHNvdXJjZUFuZENvZGVFbGVtZW50LCAkKCdzcGFuJykpO1xuXHRcdFx0XHRcdHNvdXJjZUVsZW1lbnQuaW5uZXJUZXh0ID0gc291cmNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGNvZGVMaW5rID0gZG9tLmFwcGVuZChzb3VyY2VBbmRDb2RlRWxlbWVudCwgJCgnYS5jb2RlLWxpbmsnKSk7XG5cdFx0XHRcdGNvZGVMaW5rLnNldEF0dHJpYnV0ZSgnaHJlZicsIGNvZGUudGFyZ2V0LnRvU3RyaW5nKHRydWUpKTtcblxuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihjb2RlTGluaywgJ2NsaWNrJywgKGUpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9vcGVuZXJTZXJ2aWNlLm9wZW4oY29kZS50YXJnZXQsIHsgYWxsb3dDb21tYW5kczogdHJ1ZSB9KTtcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdGNvbnN0IGNvZGVFbGVtZW50ID0gZG9tLmFwcGVuZChjb2RlTGluaywgJCgnc3BhbicpKTtcblx0XHRcdFx0Y29kZUVsZW1lbnQuaW5uZXJUZXh0ID0gY29kZS52YWx1ZTtcblxuXHRcdFx0XHRjb25zdCBkZXRhaWxzRWxlbWVudCA9IGRvbS5hcHBlbmQobWFya2VyRWxlbWVudCwgc291cmNlQW5kQ29kZUVsZW1lbnQpO1xuXHRcdFx0XHRkZXRhaWxzRWxlbWVudC5zdHlsZS5vcGFjaXR5ID0gJzAuNic7XG5cdFx0XHRcdGRldGFpbHNFbGVtZW50LnN0eWxlLnBhZGRpbmdMZWZ0ID0gJzZweCc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBkZXRhaWxzRWxlbWVudCA9IGRvbS5hcHBlbmQobWFya2VyRWxlbWVudCwgJCgnc3BhbicpKTtcblx0XHRcdFx0ZGV0YWlsc0VsZW1lbnQuc3R5bGUub3BhY2l0eSA9ICcwLjYnO1xuXHRcdFx0XHRkZXRhaWxzRWxlbWVudC5zdHlsZS5wYWRkaW5nTGVmdCA9ICc2cHgnO1xuXHRcdFx0XHRkZXRhaWxzRWxlbWVudC5pbm5lclRleHQgPSBzb3VyY2UgJiYgY29kZSA/IGAke3NvdXJjZX0oJHtjb2RlfSlgIDogc291cmNlID8gc291cmNlIDogYCgke2NvZGV9KWA7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGlzTm9uRW1wdHlBcnJheShyZWxhdGVkSW5mb3JtYXRpb24pKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHsgbWVzc2FnZSwgcmVzb3VyY2UsIHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4gfSBvZiByZWxhdGVkSW5mb3JtYXRpb24pIHtcblx0XHRcdFx0Y29uc3QgcmVsYXRlZEluZm9Db250YWluZXIgPSBkb20uYXBwZW5kKG1hcmtlckVsZW1lbnQsICQoJ2RpdicpKTtcblx0XHRcdFx0cmVsYXRlZEluZm9Db250YWluZXIuc3R5bGUubWFyZ2luVG9wID0gJzhweCc7XG5cdFx0XHRcdGNvbnN0IGEgPSBkb20uYXBwZW5kKHJlbGF0ZWRJbmZvQ29udGFpbmVyLCAkKCdhJykpO1xuXHRcdFx0XHRhLmlubmVyVGV4dCA9IGAke2Jhc2VuYW1lKHJlc291cmNlKX0oJHtzdGFydExpbmVOdW1iZXJ9LCAke3N0YXJ0Q29sdW1ufSk6IGA7XG5cdFx0XHRcdGEuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihhLCAnY2xpY2snLCAoZSkgPT4ge1xuXHRcdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGlmICh0aGlzLl9vcGVuZXJTZXJ2aWNlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBlZGl0b3JPcHRpb25zOiBJVGV4dEVkaXRvck9wdGlvbnMgPSB7IHNlbGVjdGlvbjogeyBzdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uIH0gfTtcblx0XHRcdFx0XHRcdHRoaXMuX29wZW5lclNlcnZpY2Uub3BlbihyZXNvdXJjZSwge1xuXHRcdFx0XHRcdFx0XHRmcm9tVXNlckdlc3R1cmU6IHRydWUsXG5cdFx0XHRcdFx0XHRcdGVkaXRvck9wdGlvbnNcblx0XHRcdFx0XHRcdH0pLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnQgPSBkb20uYXBwZW5kPEhUTUxBbmNob3JFbGVtZW50PihyZWxhdGVkSW5mb0NvbnRhaW5lciwgJCgnc3BhbicpKTtcblx0XHRcdFx0bWVzc2FnZUVsZW1lbnQuaW5uZXJUZXh0ID0gbWVzc2FnZTtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLmFwcGx5Rm9udEluZm8obWVzc2FnZUVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlbmRlcmVkSG92ZXJQYXJ0OiBJUmVuZGVyZWRIb3ZlclBhcnQ8TWFya2VySG92ZXI+ID0ge1xuXHRcdFx0aG92ZXJQYXJ0OiBtYXJrZXJIb3Zlcixcblx0XHRcdGhvdmVyRWxlbWVudCxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuXHRcdH07XG5cdFx0cmV0dXJuIHJlbmRlcmVkSG92ZXJQYXJ0O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyTWFya2VyU3RhdHVzYmFyKGNvbnRleHQ6IElFZGl0b3JIb3ZlclJlbmRlckNvbnRleHQsIG1hcmtlckhvdmVyOiBNYXJrZXJIb3Zlcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpZiAobWFya2VySG92ZXIubWFya2VyLnNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5FcnJvciB8fCBtYXJrZXJIb3Zlci5tYXJrZXIuc2V2ZXJpdHkgPT09IE1hcmtlclNldmVyaXR5Lldhcm5pbmcgfHwgbWFya2VySG92ZXIubWFya2VyLnNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5JbmZvKSB7XG5cdFx0XHRjb25zdCBtYXJrZXJDb250cm9sbGVyID0gTWFya2VyQ29udHJvbGxlci5nZXQodGhpcy5fZWRpdG9yKTtcblx0XHRcdGlmIChtYXJrZXJDb250cm9sbGVyKSB7XG5cdFx0XHRcdGNvbnRleHQuc3RhdHVzQmFyLmFkZEFjdGlvbih7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgndmlldyBwcm9ibGVtJywgXCJWaWV3IFByb2JsZW1cIiksXG5cdFx0XHRcdFx0Y29tbWFuZElkOiBOZXh0TWFya2VyQWN0aW9uLklELFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29udGV4dC5oaWRlKCk7XG5cdFx0XHRcdFx0XHRtYXJrZXJDb250cm9sbGVyLnNob3dBdE1hcmtlcihtYXJrZXJIb3Zlci5tYXJrZXIpO1xuXHRcdFx0XHRcdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnJlYWRPbmx5KSkge1xuXHRcdFx0Y29uc3QgcXVpY2tmaXhQbGFjZWhvbGRlckVsZW1lbnQgPSBjb250ZXh0LnN0YXR1c0Jhci5hcHBlbmQoJCgnZGl2JykpO1xuXHRcdFx0aWYgKHRoaXMucmVjZW50TWFya2VyQ29kZUFjdGlvbnNJbmZvKSB7XG5cdFx0XHRcdGlmIChJTWFya2VyRGF0YS5tYWtlS2V5KHRoaXMucmVjZW50TWFya2VyQ29kZUFjdGlvbnNJbmZvLm1hcmtlcikgPT09IElNYXJrZXJEYXRhLm1ha2VLZXkobWFya2VySG92ZXIubWFya2VyKSkge1xuXHRcdFx0XHRcdGlmICghdGhpcy5yZWNlbnRNYXJrZXJDb2RlQWN0aW9uc0luZm8uaGFzQ29kZUFjdGlvbnMpIHtcblx0XHRcdFx0XHRcdHF1aWNrZml4UGxhY2Vob2xkZXJFbGVtZW50LnRleHRDb250ZW50ID0gbmxzLmxvY2FsaXplKCdub1F1aWNrRml4ZXMnLCBcIk5vIHF1aWNrIGZpeGVzIGF2YWlsYWJsZVwiKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5yZWNlbnRNYXJrZXJDb2RlQWN0aW9uc0luZm8gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNvbnN0IHVwZGF0ZVBsYWNlaG9sZGVyRGlzcG9zYWJsZSA9IHRoaXMucmVjZW50TWFya2VyQ29kZUFjdGlvbnNJbmZvICYmICF0aGlzLnJlY2VudE1hcmtlckNvZGVBY3Rpb25zSW5mby5oYXNDb2RlQWN0aW9ucyA/IERpc3Bvc2FibGUuTm9uZSA6IGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHF1aWNrZml4UGxhY2Vob2xkZXJFbGVtZW50LnRleHRDb250ZW50ID0gbmxzLmxvY2FsaXplKCdjaGVja2luZ0ZvclF1aWNrRml4ZXMnLCBcIkNoZWNraW5nIGZvciBxdWljayBmaXhlcy4uLlwiKSwgMjAwLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRpZiAoIXF1aWNrZml4UGxhY2Vob2xkZXJFbGVtZW50LnRleHRDb250ZW50KSB7XG5cdFx0XHRcdC8vIEhhdmUgc29tZSBjb250ZW50IGluIGhlcmUgdG8gYXZvaWQgZmxpY2tlcmluZ1xuXHRcdFx0XHRxdWlja2ZpeFBsYWNlaG9sZGVyRWxlbWVudC50ZXh0Q29udGVudCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHhBMCk7IC8vICZuYnNwO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY29kZUFjdGlvbnNQcm9taXNlID0gdGhpcy5nZXRDb2RlQWN0aW9ucyhtYXJrZXJIb3Zlci5tYXJrZXIpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjb2RlQWN0aW9uc1Byb21pc2UuY2FuY2VsKCkpKTtcblx0XHRcdGNvZGVBY3Rpb25zUHJvbWlzZS50aGVuKGFjdGlvbnMgPT4ge1xuXHRcdFx0XHR1cGRhdGVQbGFjZWhvbGRlckRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLnJlY2VudE1hcmtlckNvZGVBY3Rpb25zSW5mbyA9IHsgbWFya2VyOiBtYXJrZXJIb3Zlci5tYXJrZXIsIGhhc0NvZGVBY3Rpb25zOiBhY3Rpb25zLnZhbGlkQWN0aW9ucy5sZW5ndGggPiAwIH07XG5cblx0XHRcdFx0aWYgKCF0aGlzLnJlY2VudE1hcmtlckNvZGVBY3Rpb25zSW5mby5oYXNDb2RlQWN0aW9ucykge1xuXHRcdFx0XHRcdGFjdGlvbnMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHF1aWNrZml4UGxhY2Vob2xkZXJFbGVtZW50LnRleHRDb250ZW50ID0gbmxzLmxvY2FsaXplKCdub1F1aWNrRml4ZXMnLCBcIk5vIHF1aWNrIGZpeGVzIGF2YWlsYWJsZVwiKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cXVpY2tmaXhQbGFjZWhvbGRlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuXHRcdFx0XHRsZXQgc2hvd2luZyA9IGZhbHNlO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0XHRpZiAoIXNob3dpbmcpIHtcblx0XHRcdFx0XHRcdGFjdGlvbnMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdGNvbnRleHQuc3RhdHVzQmFyLmFkZEFjdGlvbih7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncXVpY2sgZml4ZXMnLCBcIlF1aWNrIEZpeC4uLlwiKSxcblx0XHRcdFx0XHRjb21tYW5kSWQ6IHF1aWNrRml4Q29tbWFuZElkLFxuXHRcdFx0XHRcdHJ1bjogKHRhcmdldCkgPT4ge1xuXHRcdFx0XHRcdFx0c2hvd2luZyA9IHRydWU7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250cm9sbGVyID0gQ29kZUFjdGlvbkNvbnRyb2xsZXIuZ2V0KHRoaXMuX2VkaXRvcik7XG5cdFx0XHRcdFx0XHRjb25zdCBlbGVtZW50UG9zaXRpb24gPSBkb20uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0YXJnZXQpO1xuXHRcdFx0XHRcdFx0Ly8gSGlkZSB0aGUgaG92ZXIgcHJlLWVtcHRpdmVseSwgb3RoZXJ3aXNlIHRoZSBlZGl0b3IgY2FuIGNsb3NlIHRoZSBjb2RlIGFjdGlvbnNcblx0XHRcdFx0XHRcdC8vIGNvbnRleHQgbWVudSBhcyB3ZWxsIHdoZW4gdXNpbmcga2V5Ym9hcmQgbmF2aWdhdGlvblxuXHRcdFx0XHRcdFx0Y29udGV4dC5oaWRlKCk7XG5cdFx0XHRcdFx0XHRjb250cm9sbGVyPy5zaG93Q29kZUFjdGlvbnMobWFya2VyQ29kZUFjdGlvblRyaWdnZXIsIGFjdGlvbnMsIHtcblx0XHRcdFx0XHRcdFx0eDogZWxlbWVudFBvc2l0aW9uLmxlZnQsXG5cdFx0XHRcdFx0XHRcdHk6IGVsZW1lbnRQb3NpdGlvbi50b3AsXG5cdFx0XHRcdFx0XHRcdHdpZHRoOiBlbGVtZW50UG9zaXRpb24ud2lkdGgsXG5cdFx0XHRcdFx0XHRcdGhlaWdodDogZWxlbWVudFBvc2l0aW9uLmhlaWdodFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRjb25zdCBhaUNvZGVBY3Rpb24gPSBhY3Rpb25zLnZhbGlkQWN0aW9ucy5maW5kKGFjdGlvbiA9PiBhY3Rpb24uYWN0aW9uLmlzQUkpO1xuXHRcdFx0XHRpZiAoYWlDb2RlQWN0aW9uKSB7XG5cdFx0XHRcdFx0Y29udGV4dC5zdGF0dXNCYXIuYWRkQWN0aW9uKHtcblx0XHRcdFx0XHRcdGxhYmVsOiBhaUNvZGVBY3Rpb24uYWN0aW9uLnRpdGxlLFxuXHRcdFx0XHRcdFx0Y29tbWFuZElkOiBhaUNvZGVBY3Rpb24uYWN0aW9uLmNvbW1hbmQ/LmlkID8/ICcnLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb2RlQWN0aW9uQ29udHJvbGxlci5nZXQodGhpcy5fZWRpdG9yKTtcblx0XHRcdFx0XHRcdFx0Y29udHJvbGxlcj8uYXBwbHlDb2RlQWN0aW9uKGFpQ29kZUFjdGlvbiwgZmFsc2UsIGZhbHNlLCBBcHBseUNvZGVBY3Rpb25SZWFzb24uRnJvbVByb2JsZW1zSG92ZXIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0sIG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHR9XG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb2RlQWN0aW9ucyhtYXJrZXI6IElNYXJrZXIpOiBDYW5jZWxhYmxlUHJvbWlzZTxDb2RlQWN0aW9uU2V0PiB7XG5cdFx0cmV0dXJuIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGNhbmNlbGxhdGlvblRva2VuID0+IHtcblx0XHRcdHJldHVybiBnZXRDb2RlQWN0aW9ucyhcblx0XHRcdFx0dGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUFjdGlvblByb3ZpZGVyLFxuXHRcdFx0XHR0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKSEsXG5cdFx0XHRcdG5ldyBSYW5nZShtYXJrZXIuc3RhcnRMaW5lTnVtYmVyLCBtYXJrZXIuc3RhcnRDb2x1bW4sIG1hcmtlci5lbmRMaW5lTnVtYmVyLCBtYXJrZXIuZW5kQ29sdW1uKSxcblx0XHRcdFx0bWFya2VyQ29kZUFjdGlvblRyaWdnZXIsXG5cdFx0XHRcdFByb2dyZXNzLk5vbmUsXG5cdFx0XHRcdGNhbmNlbGxhdGlvblRva2VuKTtcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBNEIseUJBQXlCLHlCQUF5QjtBQUM5RSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUN2RSxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGFBQWE7QUFDdEIsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyx1QkFBdUIsZ0JBQWdCLHlCQUF5QjtBQUN6RSxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGdCQUFrRCwrQkFBK0I7QUFDMUYsU0FBUyxrQkFBa0Isd0JBQXdCO0FBQ25ELFNBQXNCLGlCQUEwSCwwQkFBMEI7QUFDMUssWUFBWSxTQUFTO0FBRXJCLFNBQWtCLGFBQWEsc0JBQXNCO0FBQ3JELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBRXpCLE1BQU0sSUFBSSxJQUFJO0FBRVAsTUFBTSxZQUFrQztBQUFBLEVBRTlDLFlBQ2lCLE9BQ0EsT0FDQSxRQUNmO0FBSGU7QUFDQTtBQUNBO0FBQUEsRUFDYjtBQUFBLEVBRUcsc0JBQXNCLFFBQThCO0FBQzFELFdBQ0MsT0FBTyxTQUFTLGdCQUFnQixTQUM3QixLQUFLLE1BQU0sZUFBZSxPQUFPLE1BQU0sZUFDdkMsS0FBSyxNQUFNLGFBQWEsT0FBTyxNQUFNO0FBQUEsRUFFMUM7QUFDRDtBQUVBLE1BQU0sMEJBQTZDO0FBQUEsRUFDbEQsTUFBTSxzQkFBc0I7QUFBQSxFQUM1QixRQUFRLEVBQUUsU0FBUyxlQUFlLFNBQVM7QUFBQSxFQUMzQyxlQUFlLHdCQUF3QjtBQUN4QztBQUVPLElBQU0seUJBQU4sTUFBNkU7QUFBQSxFQU1uRixZQUNrQixT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
