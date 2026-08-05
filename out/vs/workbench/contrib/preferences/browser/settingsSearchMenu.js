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
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { localize } from "../../../../nls.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, GENERAL_TAG_SETTING_TAG, LANGUAGE_SETTING_TAG, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG } from "../common/preferences.js";
let SettingsSearchFilterDropdownMenuActionViewItem = class extends DropdownMenuActionViewItem {
  constructor(action, options, actionRunner, searchWidget, contextMenuService) {
    super(
      action,
      { getActions: () => this.getActions() },
      contextMenuService,
      {
        ...options,
        actionRunner,
        classNames: action.class,
        anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
        menuAsChild: true
      }
    );
    this.searchWidget = searchWidget;
    this.suggestController = SuggestController.get(this.searchWidget.inputWidget);
  }
  render(container) {
    super.render(container);
  }
  doSearchWidgetAction(queryToAppend, triggerSuggest) {
    this.searchWidget.setValue(this.searchWidget.getValue().trimEnd() + " " + queryToAppend);
    this.searchWidget.focus();
    if (triggerSuggest && this.suggestController) {
      this.suggestController.triggerSuggest();
    }
  }
  /**
   * The created action appends a query to the search widget search string. It optionally triggers suggestions.
   */
  createAction(id, label, tooltip, queryToAppend, triggerSuggest) {
    return {
      id,
      label,
      tooltip,
      class: void 0,
      enabled: true,
      run: () => {
        this.doSearchWidgetAction(queryToAppend, triggerSuggest);
      }
    };
  }
  /**
   * The created action appends a query to the search widget search string, if the query does not exist.
   * Otherwise, it removes the query from the search widget search string.
   * The action does not trigger suggestions after adding or removing the query.
   */
  createToggleAction(id, label, tooltip, queryToAppend) {
    const splitCurrentQuery = this.searchWidget.getValue().split(" ");
    const queryContainsQueryToAppend = splitCurrentQuery.includes(queryToAppend);
    return {
      id,
      label,
      tooltip,
      class: void 0,
      enabled: true,
      checked: queryContainsQueryToAppend,
      run: () => {
        if (!queryContainsQueryToAppend) {
          const trimmedCurrentQuery = this.searchWidget.getValue().trimEnd();
          const newQuery = trimmedCurrentQuery ? trimmedCurrentQuery + " " + queryToAppend : queryToAppend;
          this.searchWidget.setValue(newQuery);
        } else {
          const queryWithRemovedTags = this.searchWidget.getValue().split(" ").filter((word) => word !== queryToAppend).join(" ");
          this.searchWidget.setValue(queryWithRemovedTags);
        }
        this.searchWidget.focus();
      }
    };
  }
  getActions() {
    return [
      this.createToggleAction(
        "modifiedSettingsSearch",
        localize("modifiedSettingsSearch", "Modified"),
        localize("modifiedSettingsSearchTooltip", "Add or remove modified settings filter"),
        `@${MODIFIED_SETTING_TAG}`
      ),
      this.createAction(
        "extSettingsSearch",
        localize("extSettingsSearch", "Extension ID..."),
        localize("extSettingsSearchTooltip", "Add extension ID filter"),
        `@${EXTENSION_SETTING_TAG}`,
        true
      ),
      this.createAction(
        "featuresSettingsSearch",
        localize("featureSettingsSearch", "Feature..."),
        localize("featureSettingsSearchTooltip", "Add feature filter"),
        `@${FEATURE_SETTING_TAG}`,
        true
      ),
      this.createAction(
        "tagSettingsSearch",
        localize("tagSettingsSearch", "Tag..."),
        localize("tagSettingsSearchTooltip", "Add tag filter"),
        `@${GENERAL_TAG_SETTING_TAG}`,
        true
      ),
      this.createAction(
        "langSettingsSearch",
        localize("langSettingsSearch", "Language..."),
        localize("langSettingsSearchTooltip", "Add language ID filter"),
        `@${LANGUAGE_SETTING_TAG}`,
        true
      ),
      this.createToggleAction(
        "onlineSettingsSearch",
        localize("onlineSettingsSearch", "Online services"),
        localize("onlineSettingsSearchTooltip", "Show settings for online services"),
        "@tag:usesOnlineServices"
      ),
      this.createToggleAction(
        "policySettingsSearch",
        localize("policySettingsSearch", "Policy services"),
        localize("policySettingsSearchTooltip", "Show settings for policy services"),
        `@${POLICY_SETTING_TAG}`
      )
    ];
  }
};
SettingsSearchFilterDropdownMenuActionViewItem = __decorateClass([
  __decorateParam(4, IContextMenuService)
], SettingsSearchFilterDropdownMenuActionViewItem);
export {
  SettingsSearchFilterDropdownMenuActionViewItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzU2VhcmNoTWVudS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBBbmNob3JBbGlnbm1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZHJvcGRvd24vZHJvcGRvd25BY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBJQWN0aW9uUnVubmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3N1Z2dlc3QvYnJvd3Nlci9zdWdnZXN0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0RW5hYmxlZElucHV0IH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL3N1Z2dlc3RFbmFibGVkSW5wdXQvc3VnZ2VzdEVuYWJsZWRJbnB1dC5qcyc7XG5pbXBvcnQgeyBFWFRFTlNJT05fU0VUVElOR19UQUcsIEZFQVRVUkVfU0VUVElOR19UQUcsIEdFTkVSQUxfVEFHX1NFVFRJTkdfVEFHLCBMQU5HVUFHRV9TRVRUSU5HX1RBRywgTU9ESUZJRURfU0VUVElOR19UQUcsIFBPTElDWV9TRVRUSU5HX1RBRyB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBTZXR0aW5nc1NlYXJjaEZpbHRlckRyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtIGV4dGVuZHMgRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW0ge1xuXHRwcml2YXRlIHJlYWRvbmx5IHN1Z2dlc3RDb250cm9sbGVyOiBTdWdnZXN0Q29udHJvbGxlciB8IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0YWN0aW9uOiBJQWN0aW9uLFxuXHRcdG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMsXG5cdFx0YWN0aW9uUnVubmVyOiBJQWN0aW9uUnVubmVyIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc2VhcmNoV2lkZ2V0OiBTdWdnZXN0RW5hYmxlZElucHV0LFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihhY3Rpb24sXG5cdFx0XHR7IGdldEFjdGlvbnM6ICgpID0+IHRoaXMuZ2V0QWN0aW9ucygpIH0sXG5cdFx0XHRjb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0XHR7XG5cdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdGFjdGlvblJ1bm5lcixcblx0XHRcdFx0Y2xhc3NOYW1lczogYWN0aW9uLmNsYXNzLFxuXHRcdFx0XHRhbmNob3JBbGlnbm1lbnRQcm92aWRlcjogKCkgPT4gQW5jaG9yQWxpZ25tZW50LlJJR0hULFxuXHRcdFx0XHRtZW51QXNDaGlsZDogdHJ1ZVxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR0aGlzLnN1Z2dlc3RDb250cm9sbGVyID0gU3VnZ2VzdENvbnRyb2xsZXIuZ2V0KHRoaXMuc2VhcmNoV2lkZ2V0LmlucHV0V2lkZ2V0KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cdH1cblxuXHRwcml2YXRlIGRvU2VhcmNoV2lkZ2V0QWN0aW9uKHF1ZXJ5VG9BcHBlbmQ6IHN0cmluZywgdHJpZ2dlclN1Z2dlc3Q6IGJvb2xlYW4pIHtcblx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRWYWx1ZSh0aGlzLnNlYXJjaFdpZGdldC5nZXRWYWx1ZSgpLnRyaW1FbmQoKSArICcgJyArIHF1ZXJ5VG9BcHBlbmQpO1xuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKCk7XG5cdFx0aWYgKHRyaWdnZXJTdWdnZXN0ICYmIHRoaXMuc3VnZ2VzdENvbnRyb2xsZXIpIHtcblx0XHRcdHRoaXMuc3VnZ2VzdENvbnRyb2xsZXIudHJpZ2dlclN1Z2dlc3QoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGNyZWF0ZWQgYWN0aW9uIGFwcGVuZHMgYSBxdWVyeSB0byB0aGUgc2VhcmNoIHdpZGdldCBzZWFyY2ggc3RyaW5nLiBJdCBvcHRpb25hbGx5IHRyaWdnZXJzIHN1Z2dlc3Rpb25zLlxuXHQgKi9cblx0cHJpdmF0ZSBjcmVhdGVBY3Rpb24oaWQ6IHN0cmluZywgbGFiZWw6IHN0cmluZywgdG9vbHRpcDogc3RyaW5nLCBxdWVyeVRvQXBwZW5kOiBzdHJpbmcsIHRyaWdnZXJTdWdnZXN0OiBib29sZWFuKTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkLFxuXHRcdFx0bGFiZWwsXG5cdFx0XHR0b29sdGlwLFxuXHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRydW46ICgpID0+IHsgdGhpcy5kb1NlYXJjaFdpZGdldEFjdGlvbihxdWVyeVRvQXBwZW5kLCB0cmlnZ2VyU3VnZ2VzdCk7IH1cblx0XHR9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBjcmVhdGVkIGFjdGlvbiBhcHBlbmRzIGEgcXVlcnkgdG8gdGhlIHNlYXJjaCB3aWRnZXQgc2VhcmNoIHN0cmluZywgaWYgdGhlIHF1ZXJ5IGRvZXMgbm90IGV4aXN0LlxuXHQgKiBPdGhlcndpc2UsIGl0IHJlbW92ZXMgdGhlIHF1ZXJ5IGZyb20gdGhlIHNlYXJjaCB3aWRnZXQgc2VhcmNoIHN0cmluZy5cblx0ICogVGhlIGFjdGlvbiBkb2VzIG5vdCB0cmlnZ2VyIHN1Z2dlc3Rpb25zIGFmdGVyIGFkZGluZyBvciByZW1vdmluZyB0aGUgcXVlcnkuXG5cdCAqL1xuXHRwcml2YXRlIGNyZWF0ZVRvZ2dsZUFjdGlvbihpZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCB0b29sdGlwOiBzdHJpbmcsIHF1ZXJ5VG9BcHBlbmQ6IHN0cmluZyk6IElBY3Rpb24ge1xuXHRcdGNvbnN0IHNwbGl0Q3VycmVudFF1ZXJ5ID0gdGhpcy5zZWFyY2hXaWRnZXQuZ2V0VmFsdWUoKS5zcGxpdCgnICcpO1xuXHRcdGNvbnN0IHF1ZXJ5Q29udGFpbnNRdWVyeVRvQXBwZW5kID0gc3BsaXRDdXJyZW50UXVlcnkuaW5jbHVkZXMocXVlcnlUb0FwcGVuZCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkLFxuXHRcdFx0bGFiZWwsXG5cdFx0XHR0b29sdGlwLFxuXHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRjaGVja2VkOiBxdWVyeUNvbnRhaW5zUXVlcnlUb0FwcGVuZCxcblx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXF1ZXJ5Q29udGFpbnNRdWVyeVRvQXBwZW5kKSB7XG5cdFx0XHRcdFx0Y29uc3QgdHJpbW1lZEN1cnJlbnRRdWVyeSA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldFZhbHVlKCkudHJpbUVuZCgpO1xuXHRcdFx0XHRcdGNvbnN0IG5ld1F1ZXJ5ID0gdHJpbW1lZEN1cnJlbnRRdWVyeSA/IHRyaW1tZWRDdXJyZW50UXVlcnkgKyAnICcgKyBxdWVyeVRvQXBwZW5kIDogcXVlcnlUb0FwcGVuZDtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRWYWx1ZShuZXdRdWVyeSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgcXVlcnlXaXRoUmVtb3ZlZFRhZ3MgPSB0aGlzLnNlYXJjaFdpZGdldC5nZXRWYWx1ZSgpLnNwbGl0KCcgJylcblx0XHRcdFx0XHRcdC5maWx0ZXIod29yZCA9PiB3b3JkICE9PSBxdWVyeVRvQXBwZW5kKS5qb2luKCcgJyk7XG5cdFx0XHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2V0VmFsdWUocXVlcnlXaXRoUmVtb3ZlZFRhZ3MpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGdldEFjdGlvbnMoKTogSUFjdGlvbltdIHtcblx0XHRyZXR1cm4gW1xuXHRcdFx0dGhpcy5jcmVhdGVUb2dnbGVBY3Rpb24oXG5cdFx0XHRcdCdtb2RpZmllZFNldHRpbmdzU2VhcmNoJyxcblx0XHRcdFx0bG9jYWxpemUoJ21vZGlmaWVkU2V0dGluZ3NTZWFyY2gnLCBcIk1vZGlmaWVkXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnbW9kaWZpZWRTZXR0aW5nc1NlYXJjaFRvb2x0aXAnLCBcIkFkZCBvciByZW1vdmUgbW9kaWZpZWQgc2V0dGluZ3MgZmlsdGVyXCIpLFxuXHRcdFx0XHRgQCR7TU9ESUZJRURfU0VUVElOR19UQUd9YFxuXHRcdFx0KSxcblx0XHRcdHRoaXMuY3JlYXRlQWN0aW9uKFxuXHRcdFx0XHQnZXh0U2V0dGluZ3NTZWFyY2gnLFxuXHRcdFx0XHRsb2NhbGl6ZSgnZXh0U2V0dGluZ3NTZWFyY2gnLCBcIkV4dGVuc2lvbiBJRC4uLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ2V4dFNldHRpbmdzU2VhcmNoVG9vbHRpcCcsIFwiQWRkIGV4dGVuc2lvbiBJRCBmaWx0ZXJcIiksXG5cdFx0XHRcdGBAJHtFWFRFTlNJT05fU0VUVElOR19UQUd9YCxcblx0XHRcdFx0dHJ1ZVxuXHRcdFx0KSxcblx0XHRcdHRoaXMuY3JlYXRlQWN0aW9uKFxuXHRcdFx0XHQnZmVhdHVyZXNTZXR0aW5nc1NlYXJjaCcsXG5cdFx0XHRcdGxvY2FsaXplKCdmZWF0dXJlU2V0dGluZ3NTZWFyY2gnLCBcIkZlYXR1cmUuLi5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdmZWF0dXJlU2V0dGluZ3NTZWFyY2hUb29sdGlwJywgXCJBZGQgZmVhdHVyZSBmaWx0ZXJcIiksXG5cdFx0XHRcdGBAJHtGRUFUVVJFX1NFVFRJTkdfVEFHfWAsXG5cdFx0XHRcdHRydWVcblx0XHRcdCksXG5cdFx0XHR0aGlzLmNyZWF0ZUFjdGlvbihcblx0XHRcdFx0J3RhZ1NldHRpbmdzU2VhcmNoJyxcblx0XHRcdFx0bG9jYWxpemUoJ3RhZ1NldHRpbmdzU2VhcmNoJywgXCJUYWcuLi5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0YWdTZXR0aW5nc1NlYXJjaFRvb2x0aXAnLCBcIkFkZCB0YWcgZmlsdGVyXCIpLFxuXHRcdFx0XHRgQCR7R0VORVJBTF9UQUdfU0VUVElOR19UQUd9YCxcblx0XHRcdFx0dHJ1ZVxuXHRcdFx0KSxcblx0XHRcdHRoaXMuY3JlYXRlQWN0aW9uKFxuXHRcdFx0XHQnbGFuZ1NldHRpbmdzU2VhcmNoJyxcblx0XHRcdFx0bG9jYWxpemUoJ2xhbmdTZXR0aW5nc1NlYXJjaCcsIFwiTGFuZ3VhZ2UuLi5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdsYW5nU2V0dGluZ3NTZWFyY2hUb29sdGlwJywgXCJBZGQgbGFuZ3VhZ2UgSUQgZmlsdGVyXCIpLFxuXHRcdFx0XHRgQCR7TEFOR1VBR0VfU0VUVElOR19UQUd9YCxcblx0XHRcdFx0dHJ1ZVxuXHRcdFx0KSxcblx0XHRcdHRoaXMuY3JlYXRlVG9nZ2xlQWN0aW9uKFxuXHRcdFx0XHQnb25saW5lU2V0dGluZ3NTZWFyY2gnLFxuXHRcdFx0XHRsb2NhbGl6ZSgnb25saW5lU2V0dGluZ3NTZWFyY2gnLCBcIk9ubGluZSBzZXJ2aWNlc1wiKSxcblx0XHRcdFx0bG9jYWxpemUoJ29ubGluZVNldHRpbmdzU2VhcmNoVG9vbHRpcCcsIFwiU2hvdyBzZXR0aW5ncyBmb3Igb25saW5lIHNlcnZpY2VzXCIpLFxuXHRcdFx0XHQnQHRhZzp1c2VzT25saW5lU2VydmljZXMnXG5cdFx0XHQpLFxuXHRcdFx0dGhpcy5jcmVhdGVUb2dnbGVBY3Rpb24oXG5cdFx0XHRcdCdwb2xpY3lTZXR0aW5nc1NlYXJjaCcsXG5cdFx0XHRcdGxvY2FsaXplKCdwb2xpY3lTZXR0aW5nc1NlYXJjaCcsIFwiUG9saWN5IHNlcnZpY2VzXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgncG9saWN5U2V0dGluZ3NTZWFyY2hUb29sdGlwJywgXCJTaG93IHNldHRpbmdzIGZvciBwb2xpY3kgc2VydmljZXNcIiksXG5cdFx0XHRcdGBAJHtQT0xJQ1lfU0VUVElOR19UQUd9YFxuXHRcdFx0KVxuXHRcdF07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxrQ0FBa0M7QUFFM0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyx1QkFBdUIscUJBQXFCLHlCQUF5QixzQkFBc0Isc0JBQXNCLDBCQUEwQjtBQUU3SSxJQUFNLGlEQUFOLGNBQTZELDJCQUEyQjtBQUFBLEVBRzlGLFlBQ0MsUUFDQSxTQUNBLGNBQ2lCLGNBQ0ksb0JBQ3BCO0FBQ0Q7QUFBQSxNQUFNO0FBQUEsTUFDTCxFQUFFLFlBQVksTUFBTSxLQUFLLFdBQVcsRUFBRTtBQUFBLE1BQ3RDO0FBQUEsTUFDQTtBQUFBLFFBQ0MsR0FBRztBQUFBLFFBQ0g7QUFBQSxRQUNBLFlBQVksT0FBTztBQUFBLFFBQ25CLHlCQUF5QixNQUFNLGdCQUFnQjtBQUFBLFFBQy9DLGFBQWE7QUFBQSxNQUNkO0FBQUEsSUFDRDtBQWJpQjtBQWVqQixTQUFLLG9CQUFvQixrQkFBa0IsSUFBSSxLQUFLLGFBQWEsV0FBVztBQUFBLEVBQzdFO0FBQUEsRUFFUyxPQUFPLFdBQThCO0FBQzdDLFVBQU0sT0FBTyxTQUFTO0FBQUEsRUFDdkI7QUFBQSxFQUVRLHFCQUFxQixlQUF1QixnQkFBeUI7QUFDNUUsU0FBSyxhQUFhLFNBQVMsS0FBSyxhQUFhLFNBQVMsRUFBRSxRQUFRLElBQUksTUFBTSxhQUFhO0FBQ3ZGLFNBQUssYUFBYSxNQUFNO0FBQ3hCLFFBQUksa0JBQWtCLEtBQUssbUJBQW1CO0FBQzdDLFdBQUssa0JBQWtCLGVBQWU7QUFBQSxJQUN2QztBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtRLGFBQWEsSUFBWSxPQUFlLFNBQWlCLGVBQXVCLGdCQUFrQztBQUN6SCxXQUFPO0FBQUEsTUFDTjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxPQUFPO0FBQUEsTUFDUCxTQUFTO0FBQUEsTUFDVCxLQUFLLE1BQU07QUFBRSxhQUFLLHFCQUFxQixlQUFlLGNBQWM7QUFBQSxNQUFHO0FBQUEsSUFDeEU7QUFBQSxFQUNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBT1EsbUJBQW1CLElBQVksT0FBZSxTQUFpQixlQUFnQztBQUN0RyxVQUFNLG9CQUFvQixLQUFLLGFBQWEsU0FBUyxFQUFFLE1BQU0sR0FBRztBQUNoRSxVQUFNLDZCQUE2QixrQkFBa0IsU0FBUyxhQUFhO0FBQzNFLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLE9BQU87QUFBQSxNQUNQLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULEtBQUssTUFBTTtBQUNWLFlBQUksQ0FBQyw0QkFBNEI7QUFDaEMsZ0JBQU0sc0JBQXNCLEtBQUssYUFBYSxTQUFTLEVBQUUsUUFBUTtBQUNqRSxnQkFBTSxXQUFXLHNCQUFzQixzQkFBc0IsTUFBTSxnQkFBZ0I7QUFDbkYsZUFBSyxhQUFhLFNBQVMsUUFBUTtBQUFBLFFBQ3BDLE9BQU87QUFDTixnQkFBTSx1QkFBdUIsS0FBSyxhQUFhLFNBQVMsRUFBRSxNQUFNLEdBQUcsRUFDakUsT0FBTyxVQUFRLFNBQVMsYUFBYSxFQUFFLEtBQUssR0FBRztBQUNqRCxlQUFLLGFBQWEsU0FBUyxvQkFBb0I7QUFBQSxRQUNoRDtBQUNBLGFBQUssYUFBYSxNQUFNO0FBQUEsTUFDekI7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsYUFBd0I7QUFDdkIsV0FBTztBQUFBLE1BQ04sS0FBSztBQUFBLFFBQ0o7QUFBQSxRQUNBLFNBQVMsMEJBQTBCLFVBQVU7QUFBQSxRQUM3QyxTQUFTLGlDQUFpQyx3Q0FBd0M7QUFBQSxRQUNsRixJQUFJLG9CQUFvQjtBQUFBLE1BQ3pCO0FBQUEsTUFDQSxLQUFLO0FBQUEsUUFDSjtBQUFBLFFBQ0EsU0FBUyxxQkFBcUIsaUJBQWlCO0FBQUEsUUFDL0MsU0FBUyw0QkFBNEIseUJBQXlCO0FBQUEsUUFDOUQsSUFBSSxxQkFBcUI7QUFBQSxRQUN6QjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNKO0FBQUEsUUFDQSxTQUFTLHlCQUF5QixZQUFZO0FBQUEsUUFDOUMsU0FBUyxnQ0FBZ0Msb0JBQW9CO0FBQUEsUUFDN0QsSUFBSSxtQkFBbUI7QUFBQSxRQUN2QjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNKO0FBQUEsUUFDQSxTQUFTLHFCQUFxQixRQUFRO0FBQUEsUUFDdEMsU0FBUyw0QkFBNEIsZ0JBQWdCO0FBQUEsUUFDckQsSUFBSSx1QkFBdUI7QUFBQSxRQUMzQjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNKO0FBQUEsUUFDQSxTQUFTLHNCQUFzQixhQUFhO0FBQUEsUUFDNUMsU0FBUyw2QkFBNkIsd0JBQXdCO0FBQUEsUUFDOUQsSUFBSSxvQkFBb0I7QUFBQSxRQUN4QjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNKO0FBQUEsUUFDQSxTQUFTLHdCQUF3QixpQkFBaUI7QUFBQSxRQUNsRCxTQUFTLCtCQUErQixtQ0FBbUM7QUFBQSxRQUMzRTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNKO0FBQUEsUUFDQSxTQUFTLHdCQUF3QixpQkFBaUI7QUFBQSxRQUNsRCxTQUFTLCtCQUErQixtQ0FBbUM7QUFBQSxRQUMzRSxJQUFJLGtCQUFrQjtBQUFBLE1BQ3ZCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQW5JYSxpREFBTjtBQUFBLEVBUUo7QUFBQSxHQVJVOyIsCiAgIm5hbWVzIjogW10KfQo=
