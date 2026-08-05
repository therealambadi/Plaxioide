import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import * as cssJs from "../../../../base/browser/cssValue.js";
import { Action } from "../../../../base/common/actions.js";
import { URI } from "../../../../base/common/uri.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
const _ToggleReactionsAction = class _ToggleReactionsAction extends Action {
  constructor(toggleDropdownMenu, title) {
    super(_ToggleReactionsAction.ID, title || nls.localize("pickReactions", "Pick Reactions..."), "toggle-reactions", true);
    this._menuActions = [];
    this.toggleDropdownMenu = toggleDropdownMenu;
  }
  run() {
    this.toggleDropdownMenu();
    return Promise.resolve(true);
  }
  get menuActions() {
    return this._menuActions;
  }
  set menuActions(actions) {
    this._menuActions = actions;
  }
};
_ToggleReactionsAction.ID = "toolbar.toggle.pickReactions";
let ToggleReactionsAction = _ToggleReactionsAction;
class ReactionActionViewItem extends ActionViewItem {
  constructor(action) {
    super(null, action, {});
  }
  updateLabel() {
    if (!this.label) {
      return;
    }
    const action = this.action;
    if (action.class) {
      this.label.classList.add(action.class);
    }
    if (!action.icon) {
      const reactionLabel = dom.append(this.label, dom.$("span.reaction-label"));
      reactionLabel.innerText = action.label;
    } else {
      const reactionIcon = dom.append(this.label, dom.$(".reaction-icon"));
      const uri = URI.revive(action.icon);
      reactionIcon.style.backgroundImage = cssJs.asCSSUrl(uri);
    }
    if (action.count) {
      const reactionCount = dom.append(this.label, dom.$("span.reaction-count"));
      reactionCount.innerText = `${action.count}`;
    }
  }
  getTooltip() {
    const action = this.action;
    const toggleMessage = action.enabled ? nls.localize("comment.toggleableReaction", "Toggle reaction, ") : "";
    if (action.count === void 0) {
      return nls.localize({
        key: "comment.reactionLabelNone",
        comment: [
          "This is a tooltip for an emoji button so that the current user can toggle their reaction to a comment.",
          `The first arg is localized message "Toggle reaction" or empty if the user doesn't have permission to toggle the reaction, the second is the name of the reaction.`
        ]
      }, "{0}{1} reaction", toggleMessage, action.label);
    } else if (action.reactors === void 0 || action.reactors.length === 0) {
      if (action.count === 1) {
        return nls.localize({
          key: "comment.reactionLabelOne",
          comment: [
            'This is a tooltip for an emoji that is a "reaction" to a comment where the count of the reactions is 1.',
            "The emoji is also a button so that the current user can also toggle their own emoji reaction.",
            `The first arg is localized message "Toggle reaction" or empty if the user doesn't have permission to toggle the reaction, the second is the name of the reaction.`
          ]
        }, "{0}1 reaction with {1}", toggleMessage, action.label);
      } else if (action.count > 1) {
        return nls.localize({
          key: "comment.reactionLabelMany",
          comment: [
            'This is a tooltip for an emoji that is a "reaction" to a comment where the count of the reactions is greater than 1.',
            "The emoji is also a button so that the current user can also toggle their own emoji reaction.",
            `The first arg is localized message "Toggle reaction" or empty if the user doesn't have permission to toggle the reaction, the second is number of users who have reacted with that reaction, and the third is the name of the reaction.`
          ]
        }, "{0}{1} reactions with {2}", toggleMessage, action.count, action.label);
      }
    } else {
      if (action.reactors.length <= 10 && action.reactors.length === action.count) {
        return nls.localize({
          key: "comment.reactionLessThanTen",
          comment: [
            'This is a tooltip for an emoji that is a "reaction" to a comment where the count of the reactions is less than or equal to 10.',
            "The emoji is also a button so that the current user can also toggle their own emoji reaction.",
            `The first arg is localized message "Toggle reaction" or empty if the user doesn't have permission to toggle the reaction, the second iis a list of the reactors, and the third is the name of the reaction.`
          ]
        }, "{0}{1} reacted with {2}", toggleMessage, action.reactors.join(", "), action.label);
      } else if (action.count > 1) {
        const displayedReactors = action.reactors.slice(0, 10);
        return nls.localize({
          key: "comment.reactionMoreThanTen",
          comment: [
            'This is a tooltip for an emoji that is a "reaction" to a comment where the count of the reactions is less than or equal to 10.',
            "The emoji is also a button so that the current user can also toggle their own emoji reaction.",
            `The first arg is localized message "Toggle reaction" or empty if the user doesn't have permission to toggle the reaction, the second iis a list of the reactors, and the third is the name of the reaction.`
          ]
        }, "{0}{1} and {2} more reacted with {3}", toggleMessage, displayedReactors.join(", "), action.count - displayedReactors.length, action.label);
      }
    }
    return void 0;
  }
}
const _ReactionAction = class _ReactionAction extends Action {
  constructor(id, label = "", cssClass = "", enabled = true, actionCallback, reactors, icon, count) {
    super(_ReactionAction.ID, label, cssClass, enabled, actionCallback);
    this.reactors = reactors;
    this.icon = icon;
    this.count = count;
  }
};
_ReactionAction.ID = "toolbar.toggle.reaction";
let ReactionAction = _ReactionAction;
export {
  ReactionAction,
  ReactionActionViewItem,
  ToggleReactionsAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL3JlYWN0aW9uc0FjdGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0ICogYXMgY3NzSnMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Nzc1ZhbHVlLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuXG5leHBvcnQgY2xhc3MgVG9nZ2xlUmVhY3Rpb25zQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3Rvb2xiYXIudG9nZ2xlLnBpY2tSZWFjdGlvbnMnO1xuXHRwcml2YXRlIF9tZW51QWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdHByaXZhdGUgdG9nZ2xlRHJvcGRvd25NZW51OiAoKSA9PiB2b2lkO1xuXHRjb25zdHJ1Y3Rvcih0b2dnbGVEcm9wZG93bk1lbnU6ICgpID0+IHZvaWQsIHRpdGxlPzogc3RyaW5nKSB7XG5cdFx0c3VwZXIoVG9nZ2xlUmVhY3Rpb25zQWN0aW9uLklELCB0aXRsZSB8fCBubHMubG9jYWxpemUoJ3BpY2tSZWFjdGlvbnMnLCBcIlBpY2sgUmVhY3Rpb25zLi4uXCIpLCAndG9nZ2xlLXJlYWN0aW9ucycsIHRydWUpO1xuXHRcdHRoaXMudG9nZ2xlRHJvcGRvd25NZW51ID0gdG9nZ2xlRHJvcGRvd25NZW51O1xuXHR9XG5cdG92ZXJyaWRlIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdHRoaXMudG9nZ2xlRHJvcGRvd25NZW51KCk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcblx0fVxuXHRnZXQgbWVudUFjdGlvbnMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21lbnVBY3Rpb25zO1xuXHR9XG5cdHNldCBtZW51QWN0aW9ucyhhY3Rpb25zOiBJQWN0aW9uW10pIHtcblx0XHR0aGlzLl9tZW51QWN0aW9ucyA9IGFjdGlvbnM7XG5cdH1cbn1cbmV4cG9ydCBjbGFzcyBSZWFjdGlvbkFjdGlvblZpZXdJdGVtIGV4dGVuZHMgQWN0aW9uVmlld0l0ZW0ge1xuXHRjb25zdHJ1Y3RvcihhY3Rpb246IFJlYWN0aW9uQWN0aW9uKSB7XG5cdFx0c3VwZXIobnVsbCwgYWN0aW9uLCB7fSk7XG5cdH1cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUxhYmVsKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5sYWJlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGlvbiA9IHRoaXMuYWN0aW9uIGFzIFJlYWN0aW9uQWN0aW9uO1xuXHRcdGlmIChhY3Rpb24uY2xhc3MpIHtcblx0XHRcdHRoaXMubGFiZWwuY2xhc3NMaXN0LmFkZChhY3Rpb24uY2xhc3MpO1xuXHRcdH1cblx0XHRpZiAoIWFjdGlvbi5pY29uKSB7XG5cdFx0XHRjb25zdCByZWFjdGlvbkxhYmVsID0gZG9tLmFwcGVuZCh0aGlzLmxhYmVsLCBkb20uJCgnc3Bhbi5yZWFjdGlvbi1sYWJlbCcpKTtcblx0XHRcdHJlYWN0aW9uTGFiZWwuaW5uZXJUZXh0ID0gYWN0aW9uLmxhYmVsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCByZWFjdGlvbkljb24gPSBkb20uYXBwZW5kKHRoaXMubGFiZWwsIGRvbS4kKCcucmVhY3Rpb24taWNvbicpKTtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5yZXZpdmUoYWN0aW9uLmljb24pO1xuXHRcdFx0cmVhY3Rpb25JY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGNzc0pzLmFzQ1NTVXJsKHVyaSk7XG5cdFx0fVxuXHRcdGlmIChhY3Rpb24uY291bnQpIHtcblx0XHRcdGNvbnN0IHJlYWN0aW9uQ291bnQgPSBkb20uYXBwZW5kKHRoaXMubGFiZWwsIGRvbS4kKCdzcGFuLnJlYWN0aW9uLWNvdW50JykpO1xuXHRcdFx0cmVhY3Rpb25Db3VudC5pbm5lclRleHQgPSBgJHthY3Rpb24uY291bnR9YDtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0VG9vbHRpcCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGFjdGlvbiA9IHRoaXMuYWN0aW9uIGFzIFJlYWN0aW9uQWN0aW9uO1xuXHRcdGNvbnN0IHRvZ2dsZU1lc3NhZ2UgPSBhY3Rpb24uZW5hYmxlZCA/IG5scy5sb2NhbGl6ZSgnY29tbWVudC50b2dnbGVhYmxlUmVhY3Rpb24nLCBcIlRvZ2dsZSByZWFjdGlvbiwgXCIpIDogJyc7XG5cblx0XHRpZiAoYWN0aW9uLmNvdW50ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICdjb21tZW50LnJlYWN0aW9uTGFiZWxOb25lJywgY29tbWVudDogW1xuXHRcdFx0XHRcdCdUaGlzIGlzIGEgdG9vbHRpcCBmb3IgYW4gZW1vamkgYnV0dG9uIHNvIHRoYXQgdGhlIGN1cnJlbnQgdXNlciBjYW4gdG9nZ2xlIHRoZWlyIHJlYWN0aW9uIHRvIGEgY29tbWVudC4nLFxuXHRcdFx0XHRcdCdUaGUgZmlyc3QgYXJnIGlzIGxvY2FsaXplZCBtZXNzYWdlIFwiVG9nZ2xlIHJlYWN0aW9uXCIgb3IgZW1wdHkgaWYgdGhlIHVzZXIgZG9lc25cXCd0IGhhdmUgcGVybWlzc2lvbiB0byB0b2dnbGUgdGhlIHJlYWN0aW9uLCB0aGUgc2Vjb25kIGlzIHRoZSBuYW1lIG9mIHRoZSByZWFjdGlvbi4nXVxuXHRcdFx0fSwgXCJ7MH17MX0gcmVhY3Rpb25cIiwgdG9nZ2xlTWVzc2FnZSwgYWN0aW9uLmxhYmVsKTtcblx0XHR9IGVsc2UgaWYgKGFjdGlvbi5yZWFjdG9ycyA9PT0gdW5kZWZpbmVkIHx8IGFjdGlvbi5yZWFjdG9ycy5sZW5ndGggPT09IDApIHtcblx0XHRcdGlmIChhY3Rpb24uY291bnQgPT09IDEpIHtcblx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdFx0a2V5OiAnY29tbWVudC5yZWFjdGlvbkxhYmVsT25lJywgY29tbWVudDogW1xuXHRcdFx0XHRcdFx0J1RoaXMgaXMgYSB0b29sdGlwIGZvciBhbiBlbW9qaSB0aGF0IGlzIGEgXCJyZWFjdGlvblwiIHRvIGEgY29tbWVudCB3aGVyZSB0aGUgY291bnQgb2YgdGhlIHJlYWN0aW9ucyBpcyAxLicsXG5cdFx0XHRcdFx0XHQnVGhlIGVtb2ppIGlzIGFsc28gYSBidXR0b24gc28gdGhhdCB0aGUgY3VycmVudCB1c2VyIGNhbiBhbHNvIHRvZ2dsZSB0aGVpciBvd24gZW1vamkgcmVhY3Rpb24uJyxcblx0XHRcdFx0XHRcdCdUaGUgZmlyc3QgYXJnIGlzIGxvY2FsaXplZCBtZXNzYWdlIFwiVG9nZ2xlIHJlYWN0aW9uXCIgb3IgZW1wdHkgaWYgdGhlIHVzZXIgZG9lc25cXCd0IGhhdmUgcGVybWlzc2lvbiB0byB0b2dnbGUgdGhlIHJlYWN0aW9uLCB0aGUgc2Vjb25kIGlzIHRoZSBuYW1lIG9mIHRoZSByZWFjdGlvbi4nXVxuXHRcdFx0XHR9LCBcInswfTEgcmVhY3Rpb24gd2l0aCB7MX1cIiwgdG9nZ2xlTWVzc2FnZSwgYWN0aW9uLmxhYmVsKTtcblx0XHRcdH0gZWxzZSBpZiAoYWN0aW9uLmNvdW50ID4gMSkge1xuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKHtcblx0XHRcdFx0XHRrZXk6ICdjb21tZW50LnJlYWN0aW9uTGFiZWxNYW55JywgY29tbWVudDogW1xuXHRcdFx0XHRcdFx0J1RoaXMgaXMgYSB0b29sdGlwIGZvciBhbiBlbW9qaSB0aGF0IGlzIGEgXCJyZWFjdGlvblwiIHRvIGEgY29tbWVudCB3aGVyZSB0aGUgY291bnQgb2YgdGhlIHJlYWN0aW9ucyBpcyBncmVhdGVyIHRoYW4gMS4nLFxuXHRcdFx0XHRcdFx0J1RoZSBlbW9qaSBpcyBhbHNvIGEgYnV0dG9uIHNvIHRoYXQgdGhlIGN1cnJlbnQgdXNlciBjYW4gYWxzbyB0b2dnbGUgdGhlaXIgb3duIGVtb2ppIHJlYWN0aW9uLicsXG5cdFx0XHRcdFx0XHQnVGhlIGZpcnN0IGFyZyBpcyBsb2NhbGl6ZWQgbWVzc2FnZSBcIlRvZ2dsZSByZWFjdGlvblwiIG9yIGVtcHR5IGlmIHRoZSB1c2VyIGRvZXNuXFwndCBoYXZlIHBlcm1pc3Npb24gdG8gdG9nZ2xlIHRoZSByZWFjdGlvbiwgdGhlIHNlY29uZCBpcyBudW1iZXIgb2YgdXNlcnMgd2hvIGhhdmUgcmVhY3RlZCB3aXRoIHRoYXQgcmVhY3Rpb24sIGFuZCB0aGUgdGhpcmQgaXMgdGhlIG5hbWUgb2YgdGhlIHJlYWN0aW9uLiddXG5cdFx0XHRcdH0sIFwiezB9ezF9IHJlYWN0aW9ucyB3aXRoIHsyfVwiLCB0b2dnbGVNZXNzYWdlLCBhY3Rpb24uY291bnQsIGFjdGlvbi5sYWJlbCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChhY3Rpb24ucmVhY3RvcnMubGVuZ3RoIDw9IDEwICYmIGFjdGlvbi5yZWFjdG9ycy5sZW5ndGggPT09IGFjdGlvbi5jb3VudCkge1xuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKHtcblx0XHRcdFx0XHRrZXk6ICdjb21tZW50LnJlYWN0aW9uTGVzc1RoYW5UZW4nLCBjb21tZW50OiBbXG5cdFx0XHRcdFx0XHQnVGhpcyBpcyBhIHRvb2x0aXAgZm9yIGFuIGVtb2ppIHRoYXQgaXMgYSBcInJlYWN0aW9uXCIgdG8gYSBjb21tZW50IHdoZXJlIHRoZSBjb3VudCBvZiB0aGUgcmVhY3Rpb25zIGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byAxMC4nLFxuXHRcdFx0XHRcdFx0J1RoZSBlbW9qaSBpcyBhbHNvIGEgYnV0dG9uIHNvIHRoYXQgdGhlIGN1cnJlbnQgdXNlciBjYW4gYWxzbyB0b2dnbGUgdGhlaXIgb3duIGVtb2ppIHJlYWN0aW9uLicsXG5cdFx0XHRcdFx0XHQnVGhlIGZpcnN0IGFyZyBpcyBsb2NhbGl6ZWQgbWVzc2FnZSBcIlRvZ2dsZSByZWFjdGlvblwiIG9yIGVtcHR5IGlmIHRoZSB1c2VyIGRvZXNuXFwndCBoYXZlIHBlcm1pc3Npb24gdG8gdG9nZ2xlIHRoZSByZWFjdGlvbiwgdGhlIHNlY29uZCBpaXMgYSBsaXN0IG9mIHRoZSByZWFjdG9ycywgYW5kIHRoZSB0aGlyZCBpcyB0aGUgbmFtZSBvZiB0aGUgcmVhY3Rpb24uJ11cblx0XHRcdFx0fSwgXCJ7MH17MX0gcmVhY3RlZCB3aXRoIHsyfVwiLCB0b2dnbGVNZXNzYWdlLCBhY3Rpb24ucmVhY3RvcnMuam9pbignLCAnKSwgYWN0aW9uLmxhYmVsKTtcblx0XHRcdH0gZWxzZSBpZiAoYWN0aW9uLmNvdW50ID4gMSkge1xuXHRcdFx0XHRjb25zdCBkaXNwbGF5ZWRSZWFjdG9ycyA9IGFjdGlvbi5yZWFjdG9ycy5zbGljZSgwLCAxMCk7XG5cdFx0XHRcdHJldHVybiBubHMubG9jYWxpemUoe1xuXHRcdFx0XHRcdGtleTogJ2NvbW1lbnQucmVhY3Rpb25Nb3JlVGhhblRlbicsIGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdCdUaGlzIGlzIGEgdG9vbHRpcCBmb3IgYW4gZW1vamkgdGhhdCBpcyBhIFwicmVhY3Rpb25cIiB0byBhIGNvbW1lbnQgd2hlcmUgdGhlIGNvdW50IG9mIHRoZSByZWFjdGlvbnMgaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIDEwLicsXG5cdFx0XHRcdFx0XHQnVGhlIGVtb2ppIGlzIGFsc28gYSBidXR0b24gc28gdGhhdCB0aGUgY3VycmVudCB1c2VyIGNhbiBhbHNvIHRvZ2dsZSB0aGVpciBvd24gZW1vamkgcmVhY3Rpb24uJyxcblx0XHRcdFx0XHRcdCdUaGUgZmlyc3QgYXJnIGlzIGxvY2FsaXplZCBtZXNzYWdlIFwiVG9nZ2xlIHJlYWN0aW9uXCIgb3IgZW1wdHkgaWYgdGhlIHVzZXIgZG9lc25cXCd0IGhhdmUgcGVybWlzc2lvbiB0byB0b2dnbGUgdGhlIHJlYWN0aW9uLCB0aGUgc2Vjb25kIGlpcyBhIGxpc3Qgb2YgdGhlIHJlYWN0b3JzLCBhbmQgdGhlIHRoaXJkIGlzIHRoZSBuYW1lIG9mIHRoZSByZWFjdGlvbi4nXVxuXHRcdFx0XHR9LCBcInswfXsxfSBhbmQgezJ9IG1vcmUgcmVhY3RlZCB3aXRoIHszfVwiLCB0b2dnbGVNZXNzYWdlLCBkaXNwbGF5ZWRSZWFjdG9ycy5qb2luKCcsICcpLCBhY3Rpb24uY291bnQgLSBkaXNwbGF5ZWRSZWFjdG9ycy5sZW5ndGgsIGFjdGlvbi5sYWJlbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cbmV4cG9ydCBjbGFzcyBSZWFjdGlvbkFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd0b29sYmFyLnRvZ2dsZS5yZWFjdGlvbic7XG5cdGNvbnN0cnVjdG9yKGlkOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcgPSAnJywgY3NzQ2xhc3M6IHN0cmluZyA9ICcnLCBlbmFibGVkOiBib29sZWFuID0gdHJ1ZSwgYWN0aW9uQ2FsbGJhY2s/OiAoZXZlbnQ/OiBhbnkpID0+IFByb21pc2U8YW55PiwgcHVibGljIHJlYWRvbmx5IHJlYWN0b3JzPzogcmVhZG9ubHkgc3RyaW5nW10sIHB1YmxpYyBpY29uPzogVXJpQ29tcG9uZW50cywgcHVibGljIGNvdW50PzogbnVtYmVyKSB7XG5cdFx0c3VwZXIoUmVhY3Rpb25BY3Rpb24uSUQsIGxhYmVsLCBjc3NDbGFzcywgZW5hYmxlZCwgYWN0aW9uQ2FsbGJhY2spO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxTQUFTO0FBQ3JCLFlBQVksV0FBVztBQUN2QixTQUFTLGNBQXVCO0FBQ2hDLFNBQVMsV0FBMEI7QUFDbkMsU0FBUyxzQkFBc0I7QUFFeEIsTUFBTSx5QkFBTixNQUFNLCtCQUE4QixPQUFPO0FBQUEsRUFJakQsWUFBWSxvQkFBZ0MsT0FBZ0I7QUFDM0QsVUFBTSx1QkFBc0IsSUFBSSxTQUFTLElBQUksU0FBUyxpQkFBaUIsbUJBQW1CLEdBQUcsb0JBQW9CLElBQUk7QUFIdEgsU0FBUSxlQUEwQixDQUFDO0FBSWxDLFNBQUsscUJBQXFCO0FBQUEsRUFDM0I7QUFBQSxFQUNTLE1BQW9CO0FBQzVCLFNBQUssbUJBQW1CO0FBQ3hCLFdBQU8sUUFBUSxRQUFRLElBQUk7QUFBQSxFQUM1QjtBQUFBLEVBQ0EsSUFBSSxjQUFjO0FBQ2pCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUNBLElBQUksWUFBWSxTQUFvQjtBQUNuQyxTQUFLLGVBQWU7QUFBQSxFQUNyQjtBQUNEO0FBbEJhLHVCQUNJLEtBQUs7QUFEZixJQUFNLHdCQUFOO0FBbUJBLE1BQU0sK0JBQStCLGVBQWU7QUFBQSxFQUMxRCxZQUFZLFFBQXdCO0FBQ25DLFVBQU0sTUFBTSxRQUFRLENBQUMsQ0FBQztBQUFBLEVBQ3ZCO0FBQUEsRUFDbUIsY0FBb0I7QUFDdEMsUUFBSSxDQUFDLEtBQUssT0FBTztBQUNoQjtBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsS0FBSztBQUNwQixRQUFJLE9BQU8sT0FBTztBQUNqQixXQUFLLE1BQU0sVUFBVSxJQUFJLE9BQU8sS0FBSztBQUFBLElBQ3RDO0FBQ0EsUUFBSSxDQUFDLE9BQU8sTUFBTTtBQUNqQixZQUFNLGdCQUFnQixJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUksRUFBRSxxQkFBcUIsQ0FBQztBQUN6RSxvQkFBYyxZQUFZLE9BQU87QUFBQSxJQUNsQyxPQUFPO0FBQ04sWUFBTSxlQUFlLElBQUksT0FBTyxLQUFLLE9BQU8sSUFBSSxFQUFFLGdCQUFnQixDQUFDO0FBQ25FLFlBQU0sTUFBTSxJQUFJLE9BQU8sT0FBTyxJQUFJO0FBQ2xDLG1CQUFhLE1BQU0sa0JBQWtCLE1BQU0sU0FBUyxHQUFHO0FBQUEsSUFDeEQ7QUFDQSxRQUFJLE9BQU8sT0FBTztBQUNqQixZQUFNLGdCQUFnQixJQUFJLE9BQU8sS0FBSyxPQUFPLElBQUksRUFBRSxxQkFBcUIsQ0FBQztBQUN6RSxvQkFBYyxZQUFZLEdBQUcsT0FBTyxLQUFLO0FBQUEsSUFDMUM7QUFBQSxFQUNEO0FBQUEsRUFFbUIsYUFBaUM7QUFDbkQsVUFBTSxTQUFTLEtBQUs7QUFDcEIsVUFBTSxnQkFBZ0IsT0FBTyxVQUFVLElBQUksU0FBUyw4QkFBOEIsbUJBQW1CLElBQUk7QUFFekcsUUFBSSxPQUFPLFVBQVUsUUFBVztBQUMvQixhQUFPLElBQUksU0FBUztBQUFBLFFBQ25CLEtBQUs7QUFBQSxRQUE2QixTQUFTO0FBQUEsVUFDMUM7QUFBQSxVQUNBO0FBQUEsUUFBb0s7QUFBQSxNQUN0SyxHQUFHLG1CQUFtQixlQUFlLE9BQU8sS0FBSztBQUFBLElBQ2xELFdBQVcsT0FBTyxhQUFhLFVBQWEsT0FBTyxTQUFTLFdBQVcsR0FBRztBQUN6RSxVQUFJLE9BQU8sVUFBVSxHQUFHO0FBQ3ZCLGVBQU8sSUFBSSxTQUFTO0FBQUEsVUFDbkIsS0FBSztBQUFBLFVBQTRCLFNBQVM7QUFBQSxZQUN6QztBQUFBLFlBQ0E7QUFBQSxZQUNBO0FBQUEsVUFBb0s7QUFBQSxRQUN0SyxHQUFHLDBCQUEwQixlQUFlLE9BQU8sS0FBSztBQUFBLE1BQ3pELFdBQVcsT0FBTyxRQUFRLEdBQUc7QUFDNUIsZUFBTyxJQUFJLFNBQVM7QUFBQSxVQUNuQixLQUFLO0FBQUEsVUFBNkIsU0FBUztBQUFBLFlBQzFDO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUEwTztBQUFBLFFBQzVPLEdBQUcsNkJBQTZCLGVBQWUsT0FBTyxPQUFPLE9BQU8sS0FBSztBQUFBLE1BQzFFO0FBQUEsSUFDRCxPQUFPO0FBQ04sVUFBSSxPQUFPLFNBQVMsVUFBVSxNQUFNLE9BQU8sU0FBUyxXQUFXLE9BQU8sT0FBTztBQUM1RSxlQUFPLElBQUksU0FBUztBQUFBLFVBQ25CLEtBQUs7QUFBQSxVQUErQixTQUFTO0FBQUEsWUFDNUM7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQThNO0FBQUEsUUFDaE4sR0FBRywyQkFBMkIsZUFBZSxPQUFPLFNBQVMsS0FBSyxJQUFJLEdBQUcsT0FBTyxLQUFLO0FBQUEsTUFDdEYsV0FBVyxPQUFPLFFBQVEsR0FBRztBQUM1QixjQUFNLG9CQUFvQixPQUFPLFNBQVMsTUFBTSxHQUFHLEVBQUU7QUFDckQsZUFBTyxJQUFJLFNBQVM7QUFBQSxVQUNuQixLQUFLO0FBQUEsVUFBK0IsU0FBUztBQUFBLFlBQzVDO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUE4TTtBQUFBLFFBQ2hOLEdBQUcsd0NBQXdDLGVBQWUsa0JBQWtCLEtBQUssSUFBSSxHQUFHLE9BQU8sUUFBUSxrQkFBa0IsUUFBUSxPQUFPLEtBQUs7QUFBQSxNQUM5STtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBQ08sTUFBTSxrQkFBTixNQUFNLHdCQUF1QixPQUFPO0FBQUEsRUFFMUMsWUFBWSxJQUFZLFFBQWdCLElBQUksV0FBbUIsSUFBSSxVQUFtQixNQUFNLGdCQUFnRSxVQUFxQyxNQUE2QixPQUFnQjtBQUM3TyxVQUFNLGdCQUFlLElBQUksT0FBTyxVQUFVLFNBQVMsY0FBYztBQUQwRjtBQUFxQztBQUE2QjtBQUFBLEVBRTlOO0FBQ0Q7QUFMYSxnQkFDSSxLQUFLO0FBRGYsSUFBTSxpQkFBTjsiLAogICJuYW1lcyI6IFtdCn0K
