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
import { PickerQuickAccessProvider, TriggerAction } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { matchesFuzzy } from "../../../../base/common/filters.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IssueSource } from "../common/issue.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
let IssueQuickAccess = class extends PickerQuickAccessProvider {
  constructor(menuService, contextKeyService, commandService, extensionService, productService) {
    super(IssueQuickAccess.PREFIX, { canAcceptInBackground: true });
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.commandService = commandService;
    this.extensionService = extensionService;
    this.productService = productService;
  }
  _getPicks(filter) {
    const issuePicksConst = new Array();
    const issuePicksParts = new Array();
    const extensionIdSet = /* @__PURE__ */ new Set();
    const productLabel = this.productService.nameLong;
    const marketPlaceLabel = localize("reportExtensionMarketplace", "Extension Marketplace");
    const productFilter = matchesFuzzy(filter, productLabel, true);
    const marketPlaceFilter = matchesFuzzy(filter, marketPlaceLabel, true);
    if (productFilter) {
      issuePicksConst.push({
        label: productLabel,
        ariaLabel: productLabel,
        highlights: { label: productFilter },
        accept: () => this.commandService.executeCommand("workbench.action.openIssueReporter", { issueSource: IssueSource.VSCode })
      });
    }
    if (marketPlaceFilter) {
      issuePicksConst.push({
        label: marketPlaceLabel,
        ariaLabel: marketPlaceLabel,
        highlights: { label: marketPlaceFilter },
        accept: () => this.commandService.executeCommand("workbench.action.openIssueReporter", { issueSource: IssueSource.Marketplace })
      });
    }
    issuePicksConst.push({ type: "separator", label: localize("extensions", "Extensions") });
    const actions = this.menuService.getMenuActions(MenuId.IssueReporter, this.contextKeyService, { renderShortTitle: true }).flatMap((entry) => entry[1]);
    actions.forEach((action) => {
      if ("source" in action.item && action.item.source) {
        extensionIdSet.add(action.item.source.id);
      }
      const pick = this._createPick(filter, action);
      if (pick) {
        issuePicksParts.push(pick);
      }
    });
    this.extensionService.extensions.forEach((extension) => {
      if (!extension.isBuiltin) {
        const pick = this._createPick(filter, void 0, extension);
        const id = extension.identifier.value;
        if (pick && !extensionIdSet.has(id)) {
          issuePicksParts.push(pick);
        }
        extensionIdSet.add(id);
      }
    });
    issuePicksParts.sort((a, b) => {
      const aLabel = a.label ?? "";
      const bLabel = b.label ?? "";
      return aLabel.localeCompare(bLabel);
    });
    return [...issuePicksConst, ...issuePicksParts];
  }
  _createPick(filter, action, extension) {
    const buttons = [{
      iconClass: ThemeIcon.asClassName(Codicon.info),
      tooltip: localize("contributedIssuePage", "Open Extension Page")
    }];
    let label;
    let trigger;
    let accept;
    if (action && "source" in action.item && action.item.source) {
      label = action.item.source?.title;
      trigger = () => {
        if ("source" in action.item && action.item.source) {
          this.commandService.executeCommand("extension.open", action.item.source.id);
        }
        return TriggerAction.CLOSE_PICKER;
      };
      accept = () => {
        action.run();
      };
    } else if (extension) {
      label = extension.displayName ?? extension.name;
      trigger = () => {
        this.commandService.executeCommand("extension.open", extension.identifier.value);
        return TriggerAction.CLOSE_PICKER;
      };
      accept = () => {
        this.commandService.executeCommand("workbench.action.openIssueReporter", extension.identifier.value);
      };
    } else {
      return void 0;
    }
    const highlights = matchesFuzzy(filter, label, true);
    if (highlights) {
      return {
        label,
        highlights: { label: highlights },
        buttons,
        trigger,
        accept
      };
    }
    return void 0;
  }
};
IssueQuickAccess.PREFIX = "issue ";
IssueQuickAccess = __decorateClass([
  __decorateParam(0, IMenuService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IProductService)
], IssueQuickAccess);
export {
  IssueQuickAccess
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pc3N1ZS9icm93c2VyL2lzc3VlUXVpY2tBY2Nlc3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBQaWNrZXJRdWlja0FjY2Vzc1Byb3ZpZGVyLCBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtLCBGYXN0QW5kU2xvd1BpY2tzLCBQaWNrcywgVHJpZ2dlckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci9waWNrZXJRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkLCBNZW51SXRlbUFjdGlvbiwgU3VibWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IG1hdGNoZXNGdXp6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ZpbHRlcnMuanMnO1xuaW1wb3J0IHsgSVF1aWNrUGlja1NlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgSXNzdWVTb3VyY2UgfSBmcm9tICcuLi9jb21tb24vaXNzdWUuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgSXNzdWVRdWlja0FjY2VzcyBleHRlbmRzIFBpY2tlclF1aWNrQWNjZXNzUHJvdmlkZXI8SVBpY2tlclF1aWNrQWNjZXNzSXRlbT4ge1xuXG5cdHN0YXRpYyBQUkVGSVggPSAnaXNzdWUgJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihJc3N1ZVF1aWNrQWNjZXNzLlBSRUZJWCwgeyBjYW5BY2NlcHRJbkJhY2tncm91bmQ6IHRydWUgfSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX2dldFBpY2tzKGZpbHRlcjogc3RyaW5nKTogUGlja3M8SVBpY2tlclF1aWNrQWNjZXNzSXRlbT4gfCBGYXN0QW5kU2xvd1BpY2tzPElQaWNrZXJRdWlja0FjY2Vzc0l0ZW0+IHwgUHJvbWlzZTxQaWNrczxJUGlja2VyUXVpY2tBY2Nlc3NJdGVtPiB8IEZhc3RBbmRTbG93UGlja3M8SVBpY2tlclF1aWNrQWNjZXNzSXRlbT4+IHwgbnVsbCB7XG5cdFx0Y29uc3QgaXNzdWVQaWNrc0NvbnN0ID0gbmV3IEFycmF5PElQaWNrZXJRdWlja0FjY2Vzc0l0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yPigpO1xuXHRcdGNvbnN0IGlzc3VlUGlja3NQYXJ0cyA9IG5ldyBBcnJheTxJUGlja2VyUXVpY2tBY2Nlc3NJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4oKTtcblx0XHRjb25zdCBleHRlbnNpb25JZFNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdFx0Ly8gQWRkIGRlZmF1bHQgaXRlbXNcblx0XHRjb25zdCBwcm9kdWN0TGFiZWwgPSB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nO1xuXHRcdGNvbnN0IG1hcmtldFBsYWNlTGFiZWwgPSBsb2NhbGl6ZShcInJlcG9ydEV4dGVuc2lvbk1hcmtldHBsYWNlXCIsIFwiRXh0ZW5zaW9uIE1hcmtldHBsYWNlXCIpO1xuXHRcdGNvbnN0IHByb2R1Y3RGaWx0ZXIgPSBtYXRjaGVzRnV6enkoZmlsdGVyLCBwcm9kdWN0TGFiZWwsIHRydWUpO1xuXHRcdGNvbnN0IG1hcmtldFBsYWNlRmlsdGVyID0gbWF0Y2hlc0Z1enp5KGZpbHRlciwgbWFya2V0UGxhY2VMYWJlbCwgdHJ1ZSk7XG5cblx0XHQvLyBBZGQgcHJvZHVjdCBwaWNrIGlmIHByb2R1Y3QgZmlsdGVyIG1hdGNoZXNcblx0XHRpZiAocHJvZHVjdEZpbHRlcikge1xuXHRcdFx0aXNzdWVQaWNrc0NvbnN0LnB1c2goe1xuXHRcdFx0XHRsYWJlbDogcHJvZHVjdExhYmVsLFxuXHRcdFx0XHRhcmlhTGFiZWw6IHByb2R1Y3RMYWJlbCxcblx0XHRcdFx0aGlnaGxpZ2h0czogeyBsYWJlbDogcHJvZHVjdEZpbHRlciB9LFxuXHRcdFx0XHRhY2NlcHQ6ICgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24ub3Blbklzc3VlUmVwb3J0ZXInLCB7IGlzc3VlU291cmNlOiBJc3N1ZVNvdXJjZS5WU0NvZGUgfSlcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIEFkZCBtYXJrZXRwbGFjZSBwaWNrIGlmIG1hcmtldHBsYWNlIGZpbHRlciBtYXRjaGVzXG5cdFx0aWYgKG1hcmtldFBsYWNlRmlsdGVyKSB7XG5cdFx0XHRpc3N1ZVBpY2tzQ29uc3QucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBtYXJrZXRQbGFjZUxhYmVsLFxuXHRcdFx0XHRhcmlhTGFiZWw6IG1hcmtldFBsYWNlTGFiZWwsXG5cdFx0XHRcdGhpZ2hsaWdodHM6IHsgbGFiZWw6IG1hcmtldFBsYWNlRmlsdGVyIH0sXG5cdFx0XHRcdGFjY2VwdDogKCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5vcGVuSXNzdWVSZXBvcnRlcicsIHsgaXNzdWVTb3VyY2U6IElzc3VlU291cmNlLk1hcmtldHBsYWNlIH0pXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpc3N1ZVBpY2tzQ29uc3QucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ2V4dGVuc2lvbnMnLCBcIkV4dGVuc2lvbnNcIikgfSk7XG5cblxuXHRcdC8vIGdldHMgbWVudSBhY3Rpb25zIGZyb20gY29udHJpYnV0ZWRcblx0XHRjb25zdCBhY3Rpb25zID0gdGhpcy5tZW51U2VydmljZS5nZXRNZW51QWN0aW9ucyhNZW51SWQuSXNzdWVSZXBvcnRlciwgdGhpcy5jb250ZXh0S2V5U2VydmljZSwgeyByZW5kZXJTaG9ydFRpdGxlOiB0cnVlIH0pLmZsYXRNYXAoZW50cnkgPT4gZW50cnlbMV0pO1xuXG5cdFx0Ly8gY3JlYXRlIHBpY2tzIGZyb20gY29udHJpYnV0ZWQgbWVudVxuXHRcdGFjdGlvbnMuZm9yRWFjaChhY3Rpb24gPT4ge1xuXHRcdFx0aWYgKCdzb3VyY2UnIGluIGFjdGlvbi5pdGVtICYmIGFjdGlvbi5pdGVtLnNvdXJjZSkge1xuXHRcdFx0XHRleHRlbnNpb25JZFNldC5hZGQoYWN0aW9uLml0ZW0uc291cmNlLmlkKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcGljayA9IHRoaXMuX2NyZWF0ZVBpY2soZmlsdGVyLCBhY3Rpb24pO1xuXHRcdFx0aWYgKHBpY2spIHtcblx0XHRcdFx0aXNzdWVQaWNrc1BhcnRzLnB1c2gocGljayk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblxuXHRcdC8vIGNyZWF0ZSBwaWNrcyBmcm9tIGV4dGVuc2lvbnNcblx0XHR0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5mb3JFYWNoKGV4dGVuc2lvbiA9PiB7XG5cdFx0XHRpZiAoIWV4dGVuc2lvbi5pc0J1aWx0aW4pIHtcblx0XHRcdFx0Y29uc3QgcGljayA9IHRoaXMuX2NyZWF0ZVBpY2soZmlsdGVyLCB1bmRlZmluZWQsIGV4dGVuc2lvbik7XG5cdFx0XHRcdGNvbnN0IGlkID0gZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWU7XG5cdFx0XHRcdGlmIChwaWNrICYmICFleHRlbnNpb25JZFNldC5oYXMoaWQpKSB7XG5cdFx0XHRcdFx0aXNzdWVQaWNrc1BhcnRzLnB1c2gocGljayk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXh0ZW5zaW9uSWRTZXQuYWRkKGlkKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlzc3VlUGlja3NQYXJ0cy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRjb25zdCBhTGFiZWwgPSBhLmxhYmVsID8/ICcnO1xuXHRcdFx0Y29uc3QgYkxhYmVsID0gYi5sYWJlbCA/PyAnJztcblx0XHRcdHJldHVybiBhTGFiZWwubG9jYWxlQ29tcGFyZShiTGFiZWwpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIFsuLi5pc3N1ZVBpY2tzQ29uc3QsIC4uLmlzc3VlUGlja3NQYXJ0c107XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVQaWNrKGZpbHRlcjogc3RyaW5nLCBhY3Rpb24/OiBNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uIHwgdW5kZWZpbmVkLCBleHRlbnNpb24/OiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBidXR0b25zID0gW3tcblx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uaW5mbyksXG5cdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnY29udHJpYnV0ZWRJc3N1ZVBhZ2UnLCBcIk9wZW4gRXh0ZW5zaW9uIFBhZ2VcIilcblx0XHR9XTtcblxuXHRcdGxldCBsYWJlbDogc3RyaW5nO1xuXHRcdGxldCB0cmlnZ2VyOiAoKSA9PiBUcmlnZ2VyQWN0aW9uO1xuXHRcdGxldCBhY2NlcHQ6ICgpID0+IHZvaWQ7XG5cdFx0aWYgKGFjdGlvbiAmJiAnc291cmNlJyBpbiBhY3Rpb24uaXRlbSAmJiBhY3Rpb24uaXRlbS5zb3VyY2UpIHtcblx0XHRcdGxhYmVsID0gYWN0aW9uLml0ZW0uc291cmNlPy50aXRsZTtcblx0XHRcdHRyaWdnZXIgPSAoKSA9PiB7XG5cdFx0XHRcdGlmICgnc291cmNlJyBpbiBhY3Rpb24uaXRlbSAmJiBhY3Rpb24uaXRlbS5zb3VyY2UpIHtcblx0XHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdleHRlbnNpb24ub3BlbicsIGFjdGlvbi5pdGVtLnNvdXJjZS5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIFRyaWdnZXJBY3Rpb24uQ0xPU0VfUElDS0VSO1xuXHRcdFx0fTtcblx0XHRcdGFjY2VwdCA9ICgpID0+IHtcblx0XHRcdFx0YWN0aW9uLnJ1bigpO1xuXHRcdFx0fTtcblxuXHRcdH0gZWxzZSBpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRsYWJlbCA9IGV4dGVuc2lvbi5kaXNwbGF5TmFtZSA/PyBleHRlbnNpb24ubmFtZTtcblx0XHRcdHRyaWdnZXIgPSAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ2V4dGVuc2lvbi5vcGVuJywgZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUpO1xuXHRcdFx0XHRyZXR1cm4gVHJpZ2dlckFjdGlvbi5DTE9TRV9QSUNLRVI7XG5cdFx0XHR9O1xuXHRcdFx0YWNjZXB0ID0gKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLm9wZW5Jc3N1ZVJlcG9ydGVyJywgZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUpO1xuXHRcdFx0fTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhpZ2hsaWdodHMgPSBtYXRjaGVzRnV6enkoZmlsdGVyLCBsYWJlbCwgdHJ1ZSk7XG5cdFx0aWYgKGhpZ2hsaWdodHMpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRoaWdobGlnaHRzOiB7IGxhYmVsOiBoaWdobGlnaHRzIH0sXG5cdFx0XHRcdGJ1dHRvbnMsXG5cdFx0XHRcdHRyaWdnZXIsXG5cdFx0XHRcdGFjY2VwdFxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLDJCQUE0RSxxQkFBcUI7QUFDMUcsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxjQUFjLGNBQWlEO0FBQ3hFLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZUFBZTtBQUN4QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHVCQUF1QjtBQUV6QixJQUFNLG1CQUFOLGNBQStCLDBCQUFrRDtBQUFBLEVBSXZGLFlBQ2dDLGFBQ00sbUJBQ0gsZ0JBQ0Usa0JBQ0YsZ0JBQ2pDO0FBQ0QsVUFBTSxpQkFBaUIsUUFBUSxFQUFFLHVCQUF1QixLQUFLLENBQUM7QUFOL0I7QUFDTTtBQUNIO0FBQ0U7QUFDRjtBQUFBLEVBR25DO0FBQUEsRUFFbUIsVUFBVSxRQUFxTDtBQUNqTixVQUFNLGtCQUFrQixJQUFJLE1BQW9EO0FBQ2hGLFVBQU0sa0JBQWtCLElBQUksTUFBb0Q7QUFDaEYsVUFBTSxpQkFBaUIsb0JBQUksSUFBWTtBQUd2QyxVQUFNLGVBQWUsS0FBSyxlQUFlO0FBQ3pDLFVBQU0sbUJBQW1CLFNBQVMsOEJBQThCLHVCQUF1QjtBQUN2RixVQUFNLGdCQUFnQixhQUFhLFFBQVEsY0FBYyxJQUFJO0FBQzdELFVBQU0sb0JBQW9CLGFB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
