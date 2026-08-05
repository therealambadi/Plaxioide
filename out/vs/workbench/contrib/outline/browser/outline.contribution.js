import { localize, localize2 } from "../../../../nls.js";
import { Extensions as ViewExtensions } from "../../../common/views.js";
import { OutlinePane } from "./outlinePane.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { VIEW_CONTAINER } from "../../files/browser/explorerViewlet.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { OutlineConfigKeys } from "../../../services/outline/browser/outline.js";
import { IOutlinePane } from "./outline.js";
import "./outlineActions.js";
const outlineViewIcon = registerIcon("outline-view-icon", Codicon.symbolClass, localize("outlineViewIcon", "View icon of the outline view."));
// Plaxio: Outline view removed
// Registry.as(ViewExtensions.ViewsRegistry).registerViews([{...}], VIEW_CONTAINER);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  "id": "outline",
  "order": 117,
  "title": localize("outlineConfigurationTitle", "Outline"),
  "type": "object",
  "properties": {
    [OutlineConfigKeys.icons]: {
      "description": localize("outline.showIcons", "Render Outline elements with icons."),
      "type": "boolean",
      "default": true
    },
    [OutlineConfigKeys.collapseItems]: {
      "description": localize("outline.initialState", "Controls whether Outline items are collapsed or expanded."),
      "type": "string",
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      "enum": [
        "alwaysCollapse",
        "alwaysExpand"
      ],
      "enumDescriptions": [
        localize("outline.initialState.collapsed", "Collapse all items."),
        localize("outline.initialState.expanded", "Expand all items.")
      ],
      "default": "alwaysExpand"
    },
    [OutlineConfigKeys.problemsEnabled]: {
      "markdownDescription": localize("outline.showProblem", "Show errors and warnings on Outline elements. Overwritten by {0} when it is off.", "`#problems.visibility#`"),
      "type": "boolean",
      "default": true
    },
    [OutlineConfigKeys.problemsColors]: {
      "markdownDescription": localize("outline.problem.colors", "Use colors for errors and warnings on Outline elements. Overwritten by {0} when it is off.", "`#problems.visibility#`"),
      "type": "boolean",
      "default": true
    },
    [OutlineConfigKeys.problemsBadges]: {
      "markdownDescription": localize("outline.problems.badges", "Use badges for errors and warnings on Outline elements. Overwritten by {0} when it is off.", "`#problems.visibility#`"),
      "type": "boolean",
      "default": true
    },
    "outline.showFiles": {
      type: "boolean",
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      default: true,
      markdownDescription: localize("filteredTypes.file", "When enabled, Outline shows `file`-symbols.")
    },
    "outline.showModules": {
      type: "boolean",
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      default: true,
      markdownDescription: localize("filteredTypes.module", "When enabled, Outline shows `module`-symbols.")
    },
    "outline.showNamespaces": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.namespace", "When enabled, Outline shows `namespace`-symbols.")
    },
    "outline.showPackages": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.package", "When enabled, Outline shows `package`-symbols.")
    },
    "outline.showClasses": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.class", "When enabled, Outline shows `class`-symbols.")
    },
    "outline.showMethods": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.method", "When enabled, Outline shows `method`-symbols.")
    },
    "outline.showProperties": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.property", "When enabled, Outline shows `property`-symbols.")
    },
    "outline.showFields": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.field", "When enabled, Outline shows `field`-symbols.")
    },
    "outline.showConstructors": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.constructor", "When enabled, Outline shows `constructor`-symbols.")
    },
    "outline.showEnums": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.enum", "When enabled, Outline shows `enum`-symbols.")
    },
    "outline.showInterfaces": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.interface", "When enabled, Outline shows `interface`-symbols.")
    },
    "outline.showFunctions": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.function", "When enabled, Outline shows `function`-symbols.")
    },
    "outline.showVariables": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.variable", "When enabled, Outline shows `variable`-symbols.")
    },
    "outline.showConstants": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.constant", "When enabled, Outline shows `constant`-symbols.")
    },
    "outline.showStrings": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.string", "When enabled, Outline shows `string`-symbols.")
    },
    "outline.showNumbers": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.number", "When enabled, Outline shows `number`-symbols.")
    },
    "outline.showBooleans": {
      type: "boolean",
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      default: true,
      markdownDescription: localize("filteredTypes.boolean", "When enabled, Outline shows `boolean`-symbols.")
    },
    "outline.showArrays": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.array", "When enabled, Outline shows `array`-symbols.")
    },
    "outline.showObjects": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.object", "When enabled, Outline shows `object`-symbols.")
    },
    "outline.showKeys": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.key", "When enabled, Outline shows `key`-symbols.")
    },
    "outline.showNull": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.null", "When enabled, Outline shows `null`-symbols.")
    },
    "outline.showEnumMembers": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.enumMember", "When enabled, Outline shows `enumMember`-symbols.")
    },
    "outline.showStructs": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.struct", "When enabled, Outline shows `struct`-symbols.")
    },
    "outline.showEvents": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.event", "When enabled, Outline shows `event`-symbols.")
    },
    "outline.showOperators": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.operator", "When enabled, Outline shows `operator`-symbols.")
    },
    "outline.showTypeParameters": {
      type: "boolean",
      default: true,
      scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
      markdownDescription: localize("filteredTypes.typeParameter", "When enabled, Outline shows `typeParameter`-symbols.")
    }
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9vdXRsaW5lL2Jyb3dzZXIvb3V0bGluZS5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElWaWV3c1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFZpZXdFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IE91dGxpbmVQYW5lIH0gZnJvbSAnLi9vdXRsaW5lUGFuZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBDb25maWd1cmF0aW9uU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgVklFV19DT05UQUlORVIgfSBmcm9tICcuLi8uLi9maWxlcy9icm93c2VyL2V4cGxvcmVyVmlld2xldC5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IE91dGxpbmVDb25maWdLZXlzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvb3V0bGluZS9icm93c2VyL291dGxpbmUuanMnO1xuaW1wb3J0IHsgSU91dGxpbmVQYW5lIH0gZnJvbSAnLi9vdXRsaW5lLmpzJztcblxuLy8gLS0tIGFjdGlvbnNcblxuaW1wb3J0ICcuL291dGxpbmVBY3Rpb25zLmpzJztcblxuLy8gLS0tIHZpZXdcblxuY29uc3Qgb3V0bGluZVZpZXdJY29uID0gcmVnaXN0ZXJJY29uKCdvdXRsaW5lLXZpZXctaWNvbicsIENvZGljb24uc3ltYm9sQ2xhc3MsIGxvY2FsaXplKCdvdXRsaW5lVmlld0ljb24nLCAnVmlldyBpY29uIG9mIHRoZSBvdXRsaW5lIHZpZXcuJykpO1xuXG5SZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oVmlld0V4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSkucmVnaXN0ZXJWaWV3cyhbe1xuXHRpZDogSU91dGxpbmVQYW5lLklkLFxuXHRuYW1lOiBsb2NhbGl6ZTIoJ25hbWUnLCBcIk91dGxpbmVcIiksXG5cdGNvbnRhaW5lckljb246IG91dGxpbmVWaWV3SWNvbixcblx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihPdXRsaW5lUGFuZSksXG5cdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWUsXG5cdGNhbk1vdmVWaWV3OiB0cnVlLFxuXHRoaWRlQnlEZWZhdWx0OiBmYWxzZSxcblx0Y29sbGFwc2VkOiB0cnVlLFxuXHRvcmRlcjogMixcblx0d2VpZ2h0OiAzMCxcblx0Zm9jdXNDb21tYW5kOiB7IGlkOiAnb3V0bGluZS5mb2N1cycgfVxufV0sIFZJRVdfQ09OVEFJTkVSKTtcblxuLy8gLS0tIGNvbmZpZ3VyYXRpb25zXG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdCdpZCc6ICdvdXRsaW5lJyxcblx0J29yZGVyJzogMTE3LFxuXHQndGl0bGUnOiBsb2NhbGl6ZSgnb3V0bGluZUNvbmZpZ3VyYXRpb25UaXRsZScsIFwiT3V0bGluZVwiKSxcblx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0W091dGxpbmVDb25maWdLZXlzLmljb25zXToge1xuXHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ291dGxpbmUuc2hvd0ljb25zJywgXCJSZW5kZXIgT3V0bGluZSBlbGVtZW50cyB3aXRoIGljb25zLlwiKSxcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0fSxcblx0XHRbT3V0bGluZUNvbmZpZ0tleXMuY29sbGFwc2VJdGVtc106IHtcblx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdvdXRsaW5lLmluaXRpYWxTdGF0ZScsIFwiQ29udHJvbHMgd2hldGhlciBPdXRsaW5lIGl0ZW1zIGFyZSBjb2xsYXBzZWQgb3IgZXhwYW5kZWQuXCIpLFxuXHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHQnZW51bSc6IFtcblx0XHRcdFx0J2Fsd2F5c0NvbGxhcHNlJyxcblx0XHRcdFx0J2Fsd2F5c0V4cGFuZCdcblx0XHRcdF0sXG5cdFx0XHQnZW51bURlc2NyaXB0aW9ucyc6IFtcblx0XHRcdFx0bG9jYWxpemUoJ291dGxpbmUuaW5pdGlhbFN0YXRlLmNvbGxhcHNlZCcsIFwiQ29sbGFwc2UgYWxsIGl0ZW1zLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ291dGxpbmUuaW5pdGlhbFN0YXRlLmV4cGFuZGVkJywgXCJFeHBhbmQgYWxsIGl0ZW1zLlwiKVxuXHRcdFx0XSxcblx0XHRcdCdkZWZhdWx0JzogJ2Fsd2F5c0V4cGFuZCdcblx0XHR9LFxuXHRcdFtPdXRsaW5lQ29uZmlnS2V5cy5wcm9ibGVtc0VuYWJsZWRdOiB7XG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdvdXRsaW5lLnNob3dQcm9ibGVtJywgXCJTaG93IGVycm9ycyBhbmQgd2FybmluZ3Mgb24gT3V0bGluZSBlbGVtZW50cy4gT3ZlcndyaXR0ZW4gYnkgezB9IHdoZW4gaXQgaXMgb2ZmLlwiLCAnYCNwcm9ibGVtcy52aXNpYmlsaXR5I2AnKSxcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0fSxcblx0XHRbT3V0bGluZUNvbmZpZ0tleXMucHJvYmxlbXNDb2xvcnNdOiB7XG5cdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdvdXRsaW5lLnByb2JsZW0uY29sb3JzJywgXCJVc2UgY29sb3JzIGZvciBlcnJvcnMgYW5kIHdhcm5pbmdzIG9uIE91dGxpbmUgZWxlbWVudHMuIE92ZXJ3cml0dGVuIGJ5IHswfSB3aGVuIGl0IGlzIG9mZi5cIiwgJ2AjcHJvYmxlbXMudmlzaWJpbGl0eSNgJyksXG5cdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdCdkZWZhdWx0JzogdHJ1ZVxuXHRcdH0sXG5cdFx0W091dGxpbmVDb25maWdLZXlzLnByb2JsZW1zQmFkZ2VzXToge1xuXHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnb3V0bGluZS5wcm9ibGVtcy5iYWRnZXMnLCBcIlVzZSBiYWRnZXMgZm9yIGVycm9ycyBhbmQgd2FybmluZ3Mgb24gT3V0bGluZSBlbGVtZW50cy4gT3ZlcndyaXR0ZW4gYnkgezB9IHdoZW4gaXQgaXMgb2ZmLlwiLCAnYCNwcm9ibGVtcy52aXNpYmlsaXR5I2AnKSxcblx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0J2RlZmF1bHQnOiB0cnVlXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93RmlsZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLmZpbGUnLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgZmlsZWAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdvdXRsaW5lLnNob3dNb2R1bGVzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5tb2R1bGUnLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgbW9kdWxlYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd05hbWVzcGFjZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLm5hbWVzcGFjZScsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBuYW1lc3BhY2VgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93UGFja2FnZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLnBhY2thZ2UnLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgcGFja2FnZWAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdvdXRsaW5lLnNob3dDbGFzc2VzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5jbGFzcycsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBjbGFzc2Atc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdvdXRsaW5lLnNob3dNZXRob2RzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5tZXRob2QnLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgbWV0aG9kYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd1Byb3BlcnRpZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLnByb3BlcnR5JywgXCJXaGVuIGVuYWJsZWQsIE91dGxpbmUgc2hvd3MgYHByb3BlcnR5YC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd0ZpZWxkcyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuZmllbGQnLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgZmllbGRgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93Q29uc3RydWN0b3JzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5jb25zdHJ1Y3RvcicsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBjb25zdHJ1Y3RvcmAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdvdXRsaW5lLnNob3dFbnVtcyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuZW51bScsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBlbnVtYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd0ludGVyZmFjZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLmludGVyZmFjZScsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBpbnRlcmZhY2VgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93RnVuY3Rpb25zJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5mdW5jdGlvbicsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBmdW5jdGlvbmAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdvdXRsaW5lLnNob3dWYXJpYWJsZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLnZhcmlhYmxlJywgXCJXaGVuIGVuYWJsZWQsIE91dGxpbmUgc2hvd3MgYHZhcmlhYmxlYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd0NvbnN0YW50cyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuY29uc3RhbnQnLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgY29uc3RhbnRgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93U3RyaW5ncyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuc3RyaW5nJywgXCJXaGVuIGVuYWJsZWQsIE91dGxpbmUgc2hvd3MgYHN0cmluZ2Atc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdvdXRsaW5lLnNob3dOdW1iZXJzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5udW1iZXInLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgbnVtYmVyYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd0Jvb2xlYW5zJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5ib29sZWFuJywgXCJXaGVuIGVuYWJsZWQsIE91dGxpbmUgc2hvd3MgYGJvb2xlYW5gLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93QXJyYXlzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5hcnJheScsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBhcnJheWAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdvdXRsaW5lLnNob3dPYmplY3RzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5vYmplY3QnLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgb2JqZWN0YC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd0tleXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLmtleScsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBrZXlgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93TnVsbCc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMubnVsbCcsIFwiV2hlbiBlbmFibGVkLCBPdXRsaW5lIHNob3dzIGBudWxsYC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd0VudW1NZW1iZXJzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZmlsdGVyZWRUeXBlcy5lbnVtTWVtYmVyJywgXCJXaGVuIGVuYWJsZWQsIE91dGxpbmUgc2hvd3MgYGVudW1NZW1iZXJgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93U3RydWN0cyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMuc3RydWN0JywgXCJXaGVuIGVuYWJsZWQsIE91dGxpbmUgc2hvd3MgYHN0cnVjdGAtc3ltYm9scy5cIilcblx0XHR9LFxuXHRcdCdvdXRsaW5lLnNob3dFdmVudHMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLmV2ZW50JywgXCJXaGVuIGVuYWJsZWQsIE91dGxpbmUgc2hvd3MgYGV2ZW50YC1zeW1ib2xzLlwiKVxuXHRcdH0sXG5cdFx0J291dGxpbmUuc2hvd09wZXJhdG9ycyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2ZpbHRlcmVkVHlwZXMub3BlcmF0b3InLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgb3BlcmF0b3JgLXN5bWJvbHMuXCIpXG5cdFx0fSxcblx0XHQnb3V0bGluZS5zaG93VHlwZVBhcmFtZXRlcnMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdmaWx0ZXJlZFR5cGVzLnR5cGVQYXJhbWV0ZXInLCBcIldoZW4gZW5hYmxlZCwgT3V0bGluZSBzaG93cyBgdHlwZVBhcmFtZXRlcmAtc3ltYm9scy5cIilcblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUF5QixjQUFjLHNCQUFzQjtBQUM3RCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdCQUFnQjtBQUN6QixTQUFpQyxjQUFjLHlCQUF5QiwwQkFBMEI7QUFDbEcsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsb0JBQW9CO0FBSTdCLE9BQU87QUFJUCxNQUFNLGtCQUFrQixhQUFhLHFCQUFxQixRQUFRLGFBQWEsU0FBUyxtQkFBbUIsZ0NBQWdDLENBQUM7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
