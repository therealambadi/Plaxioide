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
import { ILogService } from "../../../../platform/log/common/log.js";
import { AbstractPolicyService } from "../../../../platform/policy/common/policy.js";
import { IDefaultAccountService } from "../../accounts/common/defaultAccount.js";
let AccountPolicyService = class extends AbstractPolicyService {
  constructor(logService, defaultAccountService) {
    super();
    this.logService = logService;
    this.defaultAccountService = defaultAccountService;
    this.chatPreviewFeaturesEnabled = true;
    this.defaultAccountService.getDefaultAccount().then((account) => {
      this._update(account?.chat_preview_features_enabled ?? true);
      this._register(this.defaultAccountService.onDidChangeDefaultAccount((account2) => this._update(account2?.chat_preview_features_enabled ?? true)));
    });
  }
  _update(chatPreviewFeaturesEnabled) {
    const newValue = chatPreviewFeaturesEnabled === void 0 || chatPreviewFeaturesEnabled;
    if (this.chatPreviewFeaturesEnabled !== newValue) {
      this.chatPreviewFeaturesEnabled = newValue;
      this._updatePolicyDefinitions(this.policyDefinitions);
    }
  }
  async _updatePolicyDefinitions(policyDefinitions) {
    this.logService.trace(`AccountPolicyService#_updatePolicyDefinitions: Got ${Object.keys(policyDefinitions).length} policy definitions`);
    const update = [];
    for (const key in policyDefinitions) {
      const policy = policyDefinitions[key];
      if (policy.previewFeature) {
        if (this.chatPreviewFeaturesEnabled) {
          this.policies.delete(key);
          update.push(key);
          continue;
        }
        const defaultValue = policy.defaultValue;
        const updatedValue = defaultValue === void 0 ? false : defaultValue;
        if (this.policies.get(key) === updatedValue) {
          continue;
        }
        this.policies.set(key, updatedValue);
        update.push(key);
      }
    }
    if (update.length) {
      this._onDidChange.fire(update);
    }
  }
};
AccountPolicyService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IDefaultAccountService)
], AccountPolicyService);
export {
  AccountPolicyService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcG9saWNpZXMvY29tbW9uL2FjY291bnRQb2xpY3lTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IEFic3RyYWN0UG9saWN5U2VydmljZSwgSVBvbGljeVNlcnZpY2UsIFBvbGljeURlZmluaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wb2xpY3kvY29tbW9uL3BvbGljeS5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0QWNjb3VudFNlcnZpY2UsIElEZWZhdWx0QWNjb3VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9hY2NvdW50cy9jb21tb24vZGVmYXVsdEFjY291bnQuanMnO1xuXG5leHBvcnQgY2xhc3MgQWNjb3VudFBvbGljeVNlcnZpY2UgZXh0ZW5kcyBBYnN0cmFjdFBvbGljeVNlcnZpY2UgaW1wbGVtZW50cyBJUG9saWN5U2VydmljZSB7XG5cdHByaXZhdGUgY2hhdFByZXZpZXdGZWF0dXJlc0VuYWJsZWQ6IGJvb2xlYW4gPSB0cnVlO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASURlZmF1bHRBY2NvdW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRBY2NvdW50U2VydmljZTogRGVmYXVsdEFjY291bnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmRlZmF1bHRBY2NvdW50U2VydmljZS5nZXREZWZhdWx0QWNjb3VudCgpXG5cdFx0XHQudGhlbihhY2NvdW50ID0+IHtcblx0XHRcdFx0dGhpcy5fdXBkYXRlKGFjY291bnQ/LmNoYXRfcHJldmlld19mZWF0dXJlc19lbmFibGVkID8/IHRydWUpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlZmF1bHRBY2NvdW50U2VydmljZS5vbkRpZENoYW5nZURlZmF1bHRBY2NvdW50KGFjY291bnQgPT4gdGhpcy5fdXBkYXRlKGFjY291bnQ/LmNoYXRfcHJldmlld19mZWF0dXJlc19lbmFibGVkID8/IHRydWUpKSk7XG5cdFx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZShjaGF0UHJldmlld0ZlYXR1cmVzRW5hYmxlZDogYm9vbGVhbiB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IG5ld1ZhbHVlID0gKGNoYXRQcmV2aWV3RmVhdHVyZXNFbmFibGVkID09PSB1bmRlZmluZWQpIHx8IGNoYXRQcmV2aWV3RmVhdHVyZXNFbmFibGVkO1xuXHRcdGlmICh0aGlzLmNoYXRQcmV2aWV3RmVhdHVyZXNFbmFibGVkICE9PSBuZXdWYWx1ZSkge1xuXHRcdFx0dGhpcy5jaGF0UHJldmlld0ZlYXR1cmVzRW5hYmxlZCA9IG5ld1ZhbHVlO1xuXHRcdFx0dGhpcy5fdXBkYXRlUG9saWN5RGVmaW5pdGlvbnModGhpcy5wb2xpY3lEZWZpbml0aW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF91cGRhdGVQb2xpY3lEZWZpbml0aW9ucyhwb2xpY3lEZWZpbml0aW9uczogSVN0cmluZ0RpY3Rpb25hcnk8UG9saWN5RGVmaW5pdGlvbj4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEFjY291bnRQb2xpY3lTZXJ2aWNlI191cGRhdGVQb2xpY3lEZWZpbml0aW9uczogR290ICR7T2JqZWN0LmtleXMocG9saWN5RGVmaW5pdGlvbnMpLmxlbmd0aH0gcG9saWN5IGRlZmluaXRpb25zYCk7XG5cblx0XHRjb25zdCB1cGRhdGU6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBrZXkgaW4gcG9saWN5RGVmaW5pdGlvbnMpIHtcblx0XHRcdGNvbnN0IHBvbGljeSA9IHBvbGljeURlZmluaXRpb25zW2tleV07XG5cdFx0XHRpZiAocG9saWN5LnByZXZpZXdGZWF0dXJlKSB7XG5cdFx0XHRcdGlmICh0aGlzLmNoYXRQcmV2aWV3RmVhdHVyZXNFbmFibGVkKSB7XG5cdFx0XHRcdFx0dGhpcy5wb2xpY2llcy5kZWxldGUoa2V5KTtcblx0XHRcdFx0XHR1cGRhdGUucHVzaChrZXkpO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGRlZmF1bHRWYWx1ZSA9IHBvbGljeS5kZWZhdWx0VmFsdWU7XG5cdFx0XHRcdGNvbnN0IHVwZGF0ZWRWYWx1ZSA9IGRlZmF1bHRWYWx1ZSA9PT0gdW5kZWZpbmVkID8gZmFsc2UgOiBkZWZhdWx0VmFsdWU7XG5cdFx0XHRcdGlmICh0aGlzLnBvbGljaWVzLmdldChrZXkpID09PSB1cGRhdGVkVmFsdWUpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnBvbGljaWVzLnNldChrZXksIHVwZGF0ZWRWYWx1ZSk7XG5cdFx0XHRcdHVwZGF0ZS5wdXNoKGtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHVwZGF0ZS5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUodXBkYXRlKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyw2QkFBK0Q7QUFDeEUsU0FBZ0MsOEJBQThCO0FBRXZELElBQU0sdUJBQU4sY0FBbUMsc0JBQWdEO0FBQUEsRUFFekYsWUFDK0IsWUFDVyx1QkFDeEM7QUFDRCxVQUFNO0FBSHdCO0FBQ1c7QUFIMUMsU0FBUSw2QkFBc0M7QUFPN0MsU0FBSyxzQkFBc0Isa0JBQWtCLEVBQzNDLEtBQUssYUFBVztBQUNoQixXQUFLLFFBQVEsU0FBUyxpQ0FBaUMsSUFBSTtBQUMzRCxXQUFLLFVBQVUsS0FBSyxzQkFBc0IsMEJBQTBCLENBQUFBLGFBQVcsS0FBSyxRQUFRQSxVQUFTLGlDQUFpQyxJQUFJLENBQUMsQ0FBQztBQUFBLElBQzdJLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxRQUFRLDRCQUFpRDtBQUNoRSxVQUFNLFdBQVksK0JBQStCLFVBQWM7QUFDL0QsUUFBSSxLQUFLLCtCQUErQixVQUFVO0FBQ2pELFdBQUssNkJBQTZCO0FBQ2xDLFdBQUsseUJBQXlCLEtBQUssaUJBQWlCO0FBQUEsSUFDckQ7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFnQix5QkFBeUIsbUJBQXVFO0FBQy9HLFNBQUssV0FBVyxNQUFNLHNEQUFzRCxPQUFPLEtBQUssaUJBQWlCLEVBQUUsTUFBTSxxQkFBcUI7QUFFdEksVUFBTSxTQUFtQixDQUFDO0FBQzFCLGVBQVcsT0FBTyxtQkFBbUI7QUFDcEMsWUFBTSxTQUFTLGtCQUFrQixHQUFHO0FBQ3BDLFVBQUksT0FBTyxnQkFBZ0I7QUFDMUIsWUFBSSxLQUFLLDRCQUE0QjtBQUNwQyxlQUFLLFNBQVMsT0FBTyxHQUFHO0FBQ3hCLGlCQUFPLEtBQUssR0FBRztBQUNmO0FBQUEsUUFDRDtBQUNBLGNBQU0sZUFBZSxPQUFPO0FBQzVCLGNBQU0sZUFBZSxpQkFBaUIsU0FBWSxRQUFRO0FBQzFELFlBQUksS0FBSyxTQUFTLElBQUksR0FBRyxNQUFNLGNBQWM7QUFDNUM7QUFBQSxRQUNEO0FBQ0EsYUFBSyxTQUFTLElBQUksS0FBSyxZQUFZO0FBQ25DLGVBQU8sS0FBSyxHQUFHO0FBQUEsTUFDaEI7QUFBQSxJQUNEO0FBRUEsUUFBSSxPQUFPLFFBQVE7QUFDbEIsV0FBSyxhQUFhLEtBQUssTUFBTTtBQUFBLElBQzlCO0FBQUEsRUFDRDtBQUNEO0FBakRhLHVCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxHQUpVOyIsCiAgIm5hbWVzIjogWyJhY2NvdW50Il0KfQo=
