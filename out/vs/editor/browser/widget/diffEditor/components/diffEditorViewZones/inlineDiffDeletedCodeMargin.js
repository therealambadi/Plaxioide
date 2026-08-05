import { addStandardDisposableListener, getDomNodePagePosition } from "../../../../../../base/browser/dom.js";
import { Action } from "../../../../../../base/common/actions.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { isIOS } from "../../../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { MouseTargetType } from "../../../../editorBrowser.js";
import { EditorOption } from "../../../../../common/config/editorOptions.js";
import { EndOfLineSequence } from "../../../../../common/model.js";
import { localize } from "../../../../../../nls.js";
class InlineDiffDeletedCodeMargin extends Disposable {
  constructor(_getViewZoneId, _marginDomNode, _modifiedEditor, _diff, _editor, _viewLineCounts, _originalTextModel, _contextMenuService, _clipboardService) {
    super();
    this._getViewZoneId = _getViewZoneId;
    this._marginDomNode = _marginDomNode;
    this._modifiedEditor = _modifiedEditor;
    this._diff = _diff;
    this._editor = _editor;
    this._viewLineCounts = _viewLineCounts;
    this._originalTextModel = _originalTextModel;
    this._contextMenuService = _contextMenuService;
    this._clipboardService = _clipboardService;
    this._visibility = false;
    this._marginDomNode.style.zIndex = "10";
    this._diffActions = document.createElement("div");
    this._diffActions.className = ThemeIcon.asClassName(Codicon.lightBulb) + " lightbulb-glyph";
    this._diffActions.style.position = "absolute";
    const lineHeight = this._modifiedEditor.getOption(EditorOption.lineHeight);
    this._diffActions.style.right = "0px";
    this._diffActions.style.visibility = "hidden";
    this._diffActions.style.height = `${lineHeight}px`;
    this._diffActions.style.lineHeight = `${lineHeight}px`;
    this._marginDomNode.appendChild(this._diffActions);
    let currentLineNumberOffset = 0;
    const useShadowDOM = _modifiedEditor.getOption(EditorOption.useShadowDOM) && !isIOS;
    const showContextMenu = (x, y) => {
      this._contextMenuService.showContextMenu({
        domForShadowRoot: useShadowDOM ? _modifiedEditor.getDomNode() ?? void 0 : void 0,
        getAnchor: () => ({ x, y }),
        getActions: () => {
          const actions = [];
          const isDeletion = _diff.modified.isEmpty;
          actions.push(new Action(
            "diff.clipboard.copyDeletedContent",
            isDeletion ? _diff.original.length > 1 ? localize("diff.clipboard.copyDeletedLinesContent.label", "Copy deleted lines") : localize("diff.clipboard.copyDeletedLinesContent.single.label", "Copy deleted line") : _diff.original.length > 1 ? localize("diff.clipboard.copyChangedLinesContent.label", "Copy changed lines") : localize("diff.clipboard.copyChangedLinesContent.single.label", "Copy changed line"),
            void 0,
            true,
            async () => {
              const originalText = this._originalTextModel.getValueInRange(_diff.original.toExclusiveRange());
              await this._clipboardService.writeText(originalText);
            }
          ));
          if (_diff.original.length > 1) {
            actions.push(new Action(
              "diff.clipboard.copyDeletedLineContent",
              isDeletion ? localize(
                "diff.clipboard.copyDeletedLineContent.label",
                "Copy deleted line ({0})",
                _diff.original.startLineNumber + currentLineNumberOffset
              ) : localize(
                "diff.clipboard.copyChangedLineContent.label",
                "Copy changed line ({0})",
                _diff.original.startLineNumber + currentLineNumberOffset
              ),
              void 0,
              true,
              async () => {
                let lineContent = this._originalTextModel.getLineContent(_diff.original.startLineNumber + currentLineNumberOffset);
                if (lineContent === "") {
                  const eof = this._originalTextModel.getEndOfLineSequence();
                  lineContent = eof === EndOfLineSequence.LF ? "\n" : "\r\n";
                }
                await this._clipboardService.writeText(lineContent);
              }
            ));
          }
          const readOnly = _modifiedEditor.getOption(EditorOption.readOnly);
          if (!readOnly) {
            actions.push(
              new Action(
                "diff.inline.revertChange",
                localize("diff.inline.revertChange.label", "Revert this change"),
                void 0,
                true,
                async () => {
                  this._editor.revert(this._diff);
                }
              )
            );
          }
          return actions;
        },
        autoSelectFirstItem: true
      });
    };
    this._register(addStandardDisposableListener(this._diffActions, "mousedown", (e) => {
      if (!e.leftButton) {
        return;
      }
      const { top, height } = getDomNodePagePosition(this._diffActions);
      const pad = Math.floor(lineHeight / 3);
      e.preventDefault();
      showContextMenu(e.posx, top + height + pad);
    }));
    this._register(_modifiedEditor.onMouseMove((e) => {
      if ((e.target.type === MouseTargetType.CONTENT_VIEW_ZONE || e.target.type === MouseTargetType.GUTTER_VIEW_ZONE) && e.target.detail.viewZoneId === this._getViewZoneId()) {
        currentLineNumberOffset = this._updateLightBulbPosition(this._marginDomNode, e.event.browserEvent.y, lineHeight);
        this.visibility = true;
      } else {
        this.visibility = false;
      }
    }));
    this._register(_modifiedEditor.onMouseDown((e) => {
      if (!e.event.leftButton) {
        return;
      }
      if (e.target.type === MouseTargetType.CONTENT_VIEW_ZONE || e.target.type === MouseTargetType.GUTTER_VIEW_ZONE) {
        const viewZoneId = e.target.detail.viewZoneId;
        if (viewZoneId === this._getViewZoneId()) {
          e.event.preventDefault();
          currentLineNumberOffset = this._updateLightBulbPosition(this._marginDomNode, e.event.browserEvent.y, lineHeight);
          showContextMenu(e.event.posx, e.event.posy + lineHeight);
        }
      }
    }));
  }
  get visibility() {
    return this._visibility;
  }
  set visibility(_visibility) {
    if (this._visibility !== _visibility) {
      this._visibility = _visibility;
      this._diffActions.style.visibility = _visibility ? "visible" : "hidden";
    }
  }
  _updateLightBulbPosition(marginDomNode, y, lineHeight) {
    const { top } = getDomNodePagePosition(marginDomNode);
    const offset = y - top;
    const lineNumberOffset = Math.floor(offset / lineHeight);
    const newTop = lineNumberOffset * lineHeight;
    this._diffActions.style.top = `${newTop}px`;
    if (this._viewLineCounts) {
      let acc = 0;
      for (let i = 0; i < this._viewLineCounts.length; i++) {
        acc += this._viewLineCounts[i];
        if (lineNumberOffset < acc) {
          return i;
        }
      }
    }
    return lineNumberOffset;
  }
}
export {
  InlineDiffDeletedCodeMargin
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2RpZmZFZGl0b3JWaWV3Wm9uZXMvaW5saW5lRGlmZkRlbGV0ZWRDb2RlTWFyZ2luLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIsIGdldERvbU5vZGVQYWdlUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNJT1MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvck1vdXNlRXZlbnQsIE1vdXNlVGFyZ2V0VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uL2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vZGlmZkVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2RpZmYvcmFuZ2VNYXBwaW5nLmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVNlcXVlbmNlLCBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcblxuZXhwb3J0IGNsYXNzIElubGluZURpZmZEZWxldGVkQ29kZU1hcmdpbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmQWN0aW9uczogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBfdmlzaWJpbGl0eTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGdldCB2aXNpYmlsaXR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmlsaXR5O1xuXHR9XG5cblx0c2V0IHZpc2liaWxpdHkoX3Zpc2liaWxpdHk6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5fdmlzaWJpbGl0eSAhPT0gX3Zpc2liaWxpdHkpIHtcblx0XHRcdHRoaXMuX3Zpc2liaWxpdHkgPSBfdmlzaWJpbGl0eTtcblx0XHRcdHRoaXMuX2RpZmZBY3Rpb25zLnN0eWxlLnZpc2liaWxpdHkgPSBfdmlzaWJpbGl0eSA/ICd2aXNpYmxlJyA6ICdoaWRkZW4nO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2dldFZpZXdab25lSWQ6ICgpID0+IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tYXJnaW5Eb21Ob2RlOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RpZmllZEVkaXRvcjogQ29kZUVkaXRvcldpZGdldCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaWZmOiBEZXRhaWxlZExpbmVSYW5nZU1hcHBpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBEaWZmRWRpdG9yV2lkZ2V0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdMaW5lQ291bnRzOiBudW1iZXJbXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbFRleHRNb2RlbDogSVRleHRNb2RlbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyBtYWtlIHN1cmUgdGhlIGRpZmYgbWFyZ2luIHNob3dzIGFib3ZlIG92ZXJsYXkuXG5cdFx0dGhpcy5fbWFyZ2luRG9tTm9kZS5zdHlsZS56SW5kZXggPSAnMTAnO1xuXG5cdFx0dGhpcy5fZGlmZkFjdGlvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9kaWZmQWN0aW9ucy5jbGFzc05hbWUgPSBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5saWdodEJ1bGIpICsgJyBsaWdodGJ1bGItZ2x5cGgnO1xuXHRcdHRoaXMuX2RpZmZBY3Rpb25zLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRjb25zdCBsaW5lSGVpZ2h0ID0gdGhpcy5fbW9kaWZpZWRFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5saW5lSGVpZ2h0KTtcblx0XHR0aGlzLl9kaWZmQWN0aW9ucy5zdHlsZS5yaWdodCA9ICcwcHgnO1xuXHRcdHRoaXMuX2RpZmZBY3Rpb25zLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcblx0XHR0aGlzLl9kaWZmQWN0aW9ucy5zdHlsZS5oZWlnaHQgPSBgJHtsaW5lSGVpZ2h0fXB4YDtcblx0XHR0aGlzLl9kaWZmQWN0aW9ucy5zdHlsZS5saW5lSGVpZ2h0ID0gYCR7bGluZUhlaWdodH1weGA7XG5cdFx0dGhpcy5fbWFyZ2luRG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9kaWZmQWN0aW9ucyk7XG5cblx0XHRsZXQgY3VycmVudExpbmVOdW1iZXJPZmZzZXQgPSAwO1xuXG5cdFx0Y29uc3QgdXNlU2hhZG93RE9NID0gX21vZGlmaWVkRWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24udXNlU2hhZG93RE9NKSAmJiAhaXNJT1M7IC8vIERvIG5vdCB1c2Ugc2hhZG93IGRvbSBvbiBJT1MgIzEyMjAzNVxuXHRcdGNvbnN0IHNob3dDb250ZXh0TWVudSA9ICh4OiBudW1iZXIsIHk6IG51bWJlcikgPT4ge1xuXHRcdFx0dGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdGRvbUZvclNoYWRvd1Jvb3Q6IHVzZVNoYWRvd0RPTSA/IF9tb2RpZmllZEVkaXRvci5nZXREb21Ob2RlKCkgPz8gdW5kZWZpbmVkIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRnZXRBbmNob3I6ICgpID0+ICh7IHgsIHkgfSksXG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBhY3Rpb25zOiBBY3Rpb25bXSA9IFtdO1xuXHRcdFx0XHRcdGNvbnN0IGlzRGVsZXRpb24gPSBfZGlmZi5tb2RpZmllZC5pc0VtcHR5O1xuXG5cdFx0XHRcdFx0Ly8gZGVmYXVsdCBhY3Rpb25cblx0XHRcdFx0XHRhY3Rpb25zLnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0XHRcdCdkaWZmLmNsaXBib2FyZC5jb3B5RGVsZXRlZENvbnRlbnQnLFxuXHRcdFx0XHRcdFx0aXNEZWxldGlvblxuXHRcdFx0XHRcdFx0XHQ/IChfZGlmZi5vcmlnaW5hbC5sZW5ndGggPiAxXG5cdFx0XHRcdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGlmZi5jbGlwYm9hcmQuY29weURlbGV0ZWRMaW5lc0NvbnRlbnQubGFiZWwnLCBcIkNvcHkgZGVsZXRlZCBsaW5lc1wiKVxuXHRcdFx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ2RpZmYuY2xpcGJvYXJkLmNvcHlEZWxldGVkTGluZXNDb250ZW50LnNpbmdsZS5sYWJlbCcsIFwiQ29weSBkZWxldGVkIGxpbmVcIikpXG5cdFx0XHRcdFx0XHRcdDogKF9kaWZmLm9yaWdpbmFsLmxlbmd0aCA+IDFcblx0XHRcdFx0XHRcdFx0XHQ/IGxvY2FsaXplKCdkaWZmLmNsaXBib2FyZC5jb3B5Q2hhbmdlZExpbmVzQ29udGVudC5sYWJlbCcsIFwiQ29weSBjaGFuZ2VkIGxpbmVzXCIpXG5cdFx0XHRcdFx0XHRcdFx0OiBsb2NhbGl6ZSgnZGlmZi5jbGlwYm9hcmQuY29weUNoYW5nZWRMaW5lc0NvbnRlbnQuc2luZ2xlLmxhYmVsJywgXCJDb3B5IGNoYW5nZWQgbGluZVwiKSksXG5cdFx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHR0cnVlLFxuXHRcdFx0XHRcdFx0YXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbFRleHQgPSB0aGlzLl9vcmlnaW5hbFRleHRNb2RlbC5nZXRWYWx1ZUluUmFuZ2UoX2RpZmYub3JpZ2luYWwudG9FeGNsdXNpdmVSYW5nZSgpKTtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5fY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQob3JpZ2luYWxUZXh0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHQpKTtcblxuXHRcdFx0XHRcdGlmIChfZGlmZi5vcmlnaW5hbC5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdFx0XHRhY3Rpb25zLnB1c2gobmV3IEFjdGlvbihcblx0XHRcdFx0XHRcdFx0J2RpZmYuY2xpcGJvYXJkLmNvcHlEZWxldGVkTGluZUNvbnRlbnQnLFxuXHRcdFx0XHRcdFx0XHRpc0RlbGV0aW9uXG5cdFx0XHRcdFx0XHRcdFx0PyBsb2NhbGl6ZSgnZGlmZi5jbGlwYm9hcmQuY29weURlbGV0ZWRMaW5lQ29udGVudC5sYWJlbCcsIFwiQ29weSBkZWxldGVkIGxpbmUgKHswfSlcIixcblx0XHRcdFx0XHRcdFx0XHRcdF9kaWZmLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlciArIGN1cnJlbnRMaW5lTnVtYmVyT2Zmc2V0KVxuXHRcdFx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ2RpZmYuY2xpcGJvYXJkLmNvcHlDaGFuZ2VkTGluZUNvbnRlbnQubGFiZWwnLCBcIkNvcHkgY2hhbmdlZCBsaW5lICh7MH0pXCIsXG5cdFx0XHRcdFx0XHRcdFx0XHRfZGlmZi5vcmlnaW5hbC5zdGFydExpbmVOdW1iZXIgKyBjdXJyZW50TGluZU51bWJlck9mZnNldCksXG5cdFx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0XHRcdFx0YXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGxldCBsaW5lQ29udGVudCA9IHRoaXMuX29yaWdpbmFsVGV4dE1vZGVsLmdldExpbmVDb250ZW50KF9kaWZmLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlciArIGN1cnJlbnRMaW5lTnVtYmVyT2Zmc2V0KTtcblx0XHRcdFx0XHRcdFx0XHRpZiAobGluZUNvbnRlbnQgPT09ICcnKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBlbXB0eSBsaW5lIC0+IG5ldyBsaW5lXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBlb2YgPSB0aGlzLl9vcmlnaW5hbFRleHRNb2RlbC5nZXRFbmRPZkxpbmVTZXF1ZW5jZSgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0bGluZUNvbnRlbnQgPSBlb2YgPT09IEVuZE9mTGluZVNlcXVlbmNlLkxGID8gJ1xcbicgOiAnXFxyXFxuJztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5fY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQobGluZUNvbnRlbnQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgcmVhZE9ubHkgPSBfbW9kaWZpZWRFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5yZWFkT25seSk7XG5cdFx0XHRcdFx0aWYgKCFyZWFkT25seSkge1xuXHRcdFx0XHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdFx0XHRcdCdkaWZmLmlubGluZS5yZXZlcnRDaGFuZ2UnLFxuXHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgnZGlmZi5pbmxpbmUucmV2ZXJ0Q2hhbmdlLmxhYmVsJywgXCJSZXZlcnQgdGhpcyBjaGFuZ2VcIiksXG5cdFx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0XHRcdFx0YXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX2VkaXRvci5yZXZlcnQodGhpcy5fZGlmZik7XG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gYWN0aW9ucztcblx0XHRcdFx0fSxcblx0XHRcdFx0YXV0b1NlbGVjdEZpcnN0SXRlbTogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RpZmZBY3Rpb25zLCAnbW91c2Vkb3duJywgZSA9PiB7XG5cdFx0XHRpZiAoIWUubGVmdEJ1dHRvbikgeyByZXR1cm47IH1cblxuXHRcdFx0Y29uc3QgeyB0b3AsIGhlaWdodCB9ID0gZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLl9kaWZmQWN0aW9ucyk7XG5cdFx0XHRjb25zdCBwYWQgPSBNYXRoLmZsb29yKGxpbmVIZWlnaHQgLyAzKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHNob3dDb250ZXh0TWVudShlLnBvc3gsIHRvcCArIGhlaWdodCArIHBhZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoX21vZGlmaWVkRWRpdG9yLm9uTW91c2VNb3ZlKChlOiBJRWRpdG9yTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0aWYgKChlLnRhcmdldC50eXBlID09PSBNb3VzZVRhcmdldFR5cGUuQ09OVEVOVF9WSUVXX1pPTkUgfHwgZS50YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkdVVFRFUl9WSUVXX1pPTkUpICYmIGUudGFyZ2V0LmRldGFpbC52aWV3Wm9uZUlkID09PSB0aGlzLl9nZXRWaWV3Wm9uZUlkKCkpIHtcblx0XHRcdFx0Y3VycmVudExpbmVOdW1iZXJPZmZzZXQgPSB0aGlzLl91cGRhdGVMaWdodEJ1bGJQb3NpdGlvbih0aGlzLl9tYXJnaW5Eb21Ob2RlLCBlLmV2ZW50LmJyb3dzZXJFdmVudC55LCBsaW5lSGVpZ2h0KTtcblx0XHRcdFx0dGhpcy52aXNpYmlsaXR5ID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudmlzaWJpbGl0eSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKF9tb2RpZmllZEVkaXRvci5vbk1vdXNlRG93bigoZTogSUVkaXRvck1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlmICghZS5ldmVudC5sZWZ0QnV0dG9uKSB7IHJldHVybjsgfVxuXG5cdFx0XHRpZiAoZS50YXJnZXQudHlwZSA9PT0gTW91c2VUYXJnZXRUeXBlLkNPTlRFTlRfVklFV19aT05FIHx8IGUudGFyZ2V0LnR5cGUgPT09IE1vdXNlVGFyZ2V0VHlwZS5HVVRURVJfVklFV19aT05FKSB7XG5cdFx0XHRcdGNvbnN0IHZpZXdab25lSWQgPSBlLnRhcmdldC5kZXRhaWwudmlld1pvbmVJZDtcblxuXHRcdFx0XHRpZiAodmlld1pvbmVJZCA9PT0gdGhpcy5fZ2V0Vmlld1pvbmVJZCgpKSB7XG5cdFx0XHRcdFx0ZS5ldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGN1cnJlbnRMaW5lTnVtYmVyT2Zmc2V0ID0gdGhpcy5fdXBkYXRlTGlnaHRCdWxiUG9zaXRpb24odGhpcy5fbWFyZ2luRG9tTm9kZSwgZS5ldmVudC5icm93c2VyRXZlbnQueSwgbGluZUhlaWdodCk7XG5cdFx0XHRcdFx0c2hvd0NvbnRleHRNZW51KGUuZXZlbnQucG9zeCwgZS5ldmVudC5wb3N5ICsgbGluZUhlaWdodCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVMaWdodEJ1bGJQb3NpdGlvbihtYXJnaW5Eb21Ob2RlOiBIVE1MRWxlbWVudCwgeTogbnVtYmVyLCBsaW5lSGVpZ2h0OiBudW1iZXIpOiBudW1iZXIge1xuXHRcdGNvbnN0IHsgdG9wIH0gPSBnZXREb21Ob2RlUGFnZVBvc2l0aW9uKG1hcmdpbkRvbU5vZGUpO1xuXHRcdGNvbnN0IG9mZnNldCA9IHkgLSB0b3A7XG5cdFx0Y29uc3QgbGluZU51bWJlck9mZnNldCA9IE1hdGguZmxvb3Iob2Zmc2V0IC8gbGluZUhlaWdodCk7XG5cdFx0Y29uc3QgbmV3VG9wID0gbGluZU51bWJlck9mZnNldCAqIGxpbmVIZWlnaHQ7XG5cdFx0dGhpcy5fZGlmZkFjdGlvbnMuc3R5bGUudG9wID0gYCR7bmV3VG9wfXB4YDtcblx0XHRpZiAodGhpcy5fdmlld0xpbmVDb3VudHMpIHtcblx0XHRcdGxldCBhY2MgPSAwO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl92aWV3TGluZUNvdW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRhY2MgKz0gdGhpcy5fdmlld0xpbmVDb3VudHNbaV07XG5cdFx0XHRcdGlmIChsaW5lTnVtYmVyT2Zmc2V0IDwgYWNjKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGxpbmVOdW1iZXJPZmZzZXQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsK0JBQStCLDhCQUE4QjtBQUN0RSxTQUFTLGNBQWM7QUFDdkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGlCQUFpQjtBQUMxQixTQUE0Qix1QkFBdUI7QUFHbkQsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyx5QkFBcUM7QUFDOUMsU0FBUyxnQkFBZ0I7QUFJbEIsTUFBTSxvQ0FBb0MsV0FBVztBQUFBLEVBZ0IzRCxZQUNrQixnQkFDQSxnQkFDQSxpQkFDQSxPQUNBLFNBQ0EsaUJBQ0Esb0JBQ0EscUJBQ0EsbUJBQ2hCO0FBQ0QsVUFBTTtBQVZXO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXRCbEIsU0FBUSxjQUF1QjtBQTJCOUIsU0FBSyxlQUFlLE1BQU0sU0FBUztBQUVuQyxTQUFLLGVBQWUsU0FB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
