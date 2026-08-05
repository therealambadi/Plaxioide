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
import { Emitter, Event } from "../../../../base/common/event.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { editorConfigurationBaseNode } from "../../../../editor/common/config/editorConfigurationSchema.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { codeActionCommandId, refactorCommandId, sourceActionCommandId } from "../../../../editor/contrib/codeAction/browser/codeAction.js";
import { CodeActionKind } from "../../../../editor/contrib/codeAction/common/types.js";
import * as nls from "../../../../nls.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
const createCodeActionsAutoSave = (description) => {
  return {
    type: "string",
    enum: ["always", "explicit", "never", true, false],
    enumDescriptions: [
      nls.localize("alwaysSave", "Triggers Code Actions on explicit saves and auto saves triggered by window or focus changes."),
      nls.localize("explicitSave", "Triggers Code Actions only when explicitly saved"),
      nls.localize("neverSave", "Never triggers Code Actions on save"),
      nls.localize("explicitSaveBoolean", 'Triggers Code Actions only when explicitly saved. This value will be deprecated in favor of "explicit".'),
      nls.localize("neverSaveBoolean", 'Never triggers Code Actions on save. This value will be deprecated in favor of "never".')
    ],
    default: "explicit",
    description
  };
};
const createNotebookCodeActionsAutoSave = (description) => {
  return {
    type: ["string", "boolean"],
    enum: ["explicit", "never", true, false],
    enumDescriptions: [
      nls.localize("explicit", "Triggers Code Actions only when explicitly saved."),
      nls.localize("never", "Never triggers Code Actions on save."),
      nls.localize("explicitBoolean", 'Triggers Code Actions only when explicitly saved. This value will be deprecated in favor of "explicit".'),
      nls.localize("neverBoolean", 'Triggers Code Actions only when explicitly saved. This value will be deprecated in favor of "never".')
    ],
    default: "explicit",
    description
  };
};
const codeActionsOnSaveSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: {
        type: "string"
      }
    },
    {
      type: "array",
      items: { type: "string" }
    }
  ],
  markdownDescription: nls.localize("editor.codeActionsOnSave", 'Run Code Actions for the editor on save. Code Actions must be specified and the editor must not be shutting down. When {0} is set to `afterDelay`, Code Actions will only be run when the file is saved explicitly. Example: `"source.organizeImports": "explicit" `', "`#files.autoSave#`"),
  type: ["object", "array"],
  additionalProperties: {
    type: "string",
    enum: ["always", "explicit", "never", true, false]
  },
  default: {},
  scope: ConfigurationScope.LANGUAGE_OVERRIDABLE
};
const editorConfiguration = Object.freeze({
  ...editorConfigurationBaseNode,
  properties: {
    "editor.codeActionsOnSave": codeActionsOnSaveSchema
  }
});
const notebookCodeActionsOnSaveSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: {
        type: "string"
      }
    },
    {
      type: "array",
      items: { type: "string" }
    }
  ],
  markdownDescription: nls.localize("notebook.codeActionsOnSave", 'Run a series of Code Actions for a notebook on save. Code Actions must be specified and the editor must not be shutting down. When {0} is set to `afterDelay`, Code Actions will only be run when the file is saved explicitly. Example: `"notebook.source.organizeImports": "explicit"`', "`#files.autoSave#`"),
  type: "object",
  additionalProperties: {
    type: ["string", "boolean"],
    enum: ["explicit", "never", true, false]
    // enum: ['explicit', 'always', 'never'], -- autosave support needs to be built first
    // nls.localize('always', 'Always triggers Code Actions on save, including autosave, focus, and window change events.'),
  },
  default: {}
};
const notebookEditorConfiguration = Object.freeze({
  ...editorConfigurationBaseNode,
  properties: {
    "notebook.codeActionsOnSave": notebookCodeActionsOnSaveSchema
  }
});
let CodeActionsContribution = class extends Disposable {
  constructor(keybindingService, languageFeatures) {
    super();
    this.languageFeatures = languageFeatures;
    this._onDidChangeSchemaContributions = this._register(new Emitter());
    this._allProvidedCodeActionKinds = [];
    this._register(
      Event.runAndSubscribe(
        Event.debounce(languageFeatures.codeActionProvider.onDidChange, () => {
        }, 1e3),
        () => {
          this._allProvidedCodeActionKinds = this.getAllProvidedCodeActionKinds();
          this.updateConfigurationSchema(this._allProvidedCodeActionKinds);
          this._onDidChangeSchemaContributions.fire();
        }
      )
    );
    keybindingService.registerSchemaContribution({
      getSchemaAdditions: () => this.getKeybindingSchemaAdditions(),
      onDidChange: this._onDidChangeSchemaContributions.event
    });
  }
  getAllProvidedCodeActionKinds() {
    const out = /* @__PURE__ */ new Map();
    for (const provider of this.languageFeatures.codeActionProvider.allNoModel()) {
      for (const kind of provider.providedCodeActionKinds ?? []) {
        out.set(kind, new HierarchicalKind(kind));
      }
    }
    return Array.from(out.values());
  }
  updateConfigurationSchema(allProvidedKinds) {
    const properties = { ...codeActionsOnSaveSchema.properties };
    const notebookProperties = { ...notebookCodeActionsOnSaveSchema.properties };
    for (const codeActionKind of allProvidedKinds) {
      if (CodeActionKind.Source.contains(codeActionKind) && !properties[codeActionKind.value]) {
        properties[codeActionKind.value] = createCodeActionsAutoSave(nls.localize("codeActionsOnSave.generic", "Controls whether '{0}' actions should be run on file save.", codeActionKind.value));
        notebookProperties[codeActionKind.value] = createNotebookCodeActionsAutoSave(nls.localize("codeActionsOnSave.generic", "Controls whether '{0}' actions should be run on file save.", codeActionKind.value));
      }
    }
    codeActionsOnSaveSchema.properties = properties;
    notebookCodeActionsOnSaveSchema.properties = notebookProperties;
    Registry.as(Extensions.Configuration).notifyConfigurationSchemaUpdated(editorConfiguration);
  }
  getKeybindingSchemaAdditions() {
    const conditionalSchema = (command, kinds) => {
      return {
        if: {
          required: ["command"],
          properties: {
            "command": { const: command }
          }
        },
        then: {
          properties: {
            "args": {
              required: ["kind"],
              properties: {
                "kind": {
                  anyOf: [
                    { enum: Array.from(kinds) },
                    { type: "string" }
                  ]
                }
              }
            }
          }
        }
      };
    };
    const filterProvidedKinds = (ofKind) => {
      const out = /* @__PURE__ */ new Set();
      for (const providedKind of this._allProvidedCodeActionKinds) {
        if (ofKind.contains(providedKind)) {
          out.add(providedKind.value);
        }
      }
      return Array.from(out);
    };
    return [
      conditionalSchema(codeActionCommandId, filterProvidedKinds(HierarchicalKind.Empty)),
      conditionalSchema(refactorCommandId, filterProvidedKinds(CodeActionKind.Refactor)),
      conditionalSchema(sourceActionCommandId, filterProvidedKinds(CodeActionKind.Source))
    ];
  }
};
CodeActionsContribution = __decorateClass([
  __decorateParam(0, IKeybindingService),
  __decorateParam(1, ILanguageFeaturesService)
], CodeActionsContribution);
export {
  CodeActionsContribution,
  editorConfiguration,
  notebookEditorConfiguration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlQWN0aW9ucy9icm93c2VyL2NvZGVBY3Rpb25zQ29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBIaWVyYXJjaGljYWxLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGllcmFyY2hpY2FsS2luZC5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSwgSUpTT05TY2hlbWFNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZWRpdG9yQ29uZmlndXJhdGlvbkJhc2VOb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgY29kZUFjdGlvbkNvbW1hbmRJZCwgcmVmYWN0b3JDb21tYW5kSWQsIHNvdXJjZUFjdGlvbkNvbW1hbmRJZCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NvZGVBY3Rpb24vYnJvd3Nlci9jb2RlQWN0aW9uLmpzJztcbmltcG9ydCB7IENvZGVBY3Rpb25LaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY29kZUFjdGlvbi9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUsIEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uTm9kZSwgSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSwgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5cbmNvbnN0IGNyZWF0ZUNvZGVBY3Rpb25zQXV0b1NhdmUgPSAoZGVzY3JpcHRpb246IHN0cmluZyk6IElKU09OU2NoZW1hID0+IHtcblx0cmV0dXJuIHtcblx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRlbnVtOiBbJ2Fsd2F5cycsICdleHBsaWNpdCcsICduZXZlcicsIHRydWUsIGZhbHNlXSxcblx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRubHMubG9jYWxpemUoJ2Fsd2F5c1NhdmUnLCAnVHJpZ2dlcnMgQ29kZSBBY3Rpb25zIG9uIGV4cGxpY2l0IHNhdmVzIGFuZCBhdXRvIHNhdmVzIHRyaWdnZXJlZCBieSB3aW5kb3cgb3IgZm9jdXMgY2hhbmdlcy4nKSxcblx0XHRcdG5scy5sb2NhbGl6ZSgnZXhwbGljaXRTYXZlJywgJ1RyaWdnZXJzIENvZGUgQWN0aW9ucyBvbmx5IHdoZW4gZXhwbGljaXRseSBzYXZlZCcpLFxuXHRcdFx0bmxzLmxvY2FsaXplKCduZXZlclNhdmUnLCAnTmV2ZXIgdHJpZ2dlcnMgQ29kZSBBY3Rpb25zIG9uIHNhdmUnKSxcblx0XHRcdG5scy5sb2NhbGl6ZSgnZXhwbGljaXRTYXZlQm9vbGVhbicsICdUcmlnZ2VycyBDb2RlIEFjdGlvbnMgb25seSB3aGVuIGV4cGxpY2l0bHkgc2F2ZWQuIFRoaXMgdmFsdWUgd2lsbCBiZSBkZXByZWNhdGVkIGluIGZhdm9yIG9mIFwiZXhwbGljaXRcIi4nKSxcblx0XHRcdG5scy5sb2NhbGl6ZSgnbmV2ZXJTYXZlQm9vbGVhbicsICdOZXZlciB0cmlnZ2VycyBDb2RlIEFjdGlvbnMgb24gc2F2ZS4gVGhpcyB2YWx1ZSB3aWxsIGJlIGRlcHJlY2F0ZWQgaW4gZmF2b3Igb2YgXCJuZXZlclwiLicpXG5cdFx0XSxcblx0XHRkZWZhdWx0OiAnZXhwbGljaXQnLFxuXHRcdGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvblxuXHR9O1xufTtcblxuY29uc3QgY3JlYXRlTm90ZWJvb2tDb2RlQWN0aW9uc0F1dG9TYXZlID0gKGRlc2NyaXB0aW9uOiBzdHJpbmcpOiBJSlNPTlNjaGVtYSA9PiB7XG5cdHJldHVybiB7XG5cdFx0dHlwZTogWydzdHJpbmcnLCAnYm9vbGVhbiddLFxuXHRcdGVudW06IFsnZXhwbGljaXQnLCAnbmV2ZXInLCB0cnVlLCBmYWxzZV0sXG5cdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0bmxzLmxvY2FsaXplKCdleHBsaWNpdCcsICdUcmlnZ2VycyBDb2RlIEFjdGlvbnMgb25seSB3aGVuIGV4cGxpY2l0bHkgc2F2ZWQuJyksXG5cdFx0XHRubHMubG9jYWxpemUoJ25ldmVyJywgJ05ldmVyIHRyaWdnZXJzIENvZGUgQWN0aW9ucyBvbiBzYXZlLicpLFxuXHRcdFx0bmxzLmxvY2FsaXplKCdleHBsaWNpdEJvb2xlYW4nLCAnVHJpZ2dlcnMgQ29kZSBBY3Rpb25zIG9ubHkgd2hlbiBleHBsaWNpdGx5IHNhdmVkLiBUaGlzIHZhbHVlIHdpbGwgYmUgZGVwcmVjYXRlZCBpbiBmYXZvciBvZiBcImV4cGxpY2l0XCIuJyksXG5cdFx0XHRubHMubG9jYWxpemUoJ25ldmVyQm9vbGVhbicsICdUcmlnZ2VycyBDb2RlIEFjdGlvbnMgb25seSB3aGVuIGV4cGxpY2l0bHkgc2F2ZWQuIFRoaXMgdmFsdWUgd2lsbCBiZSBkZXByZWNhdGVkIGluIGZhdm9yIG9mIFwibmV2ZXJcIi4nKVxuXHRcdF0sXG5cdFx0ZGVmYXVsdDogJ2V4cGxpY2l0Jyxcblx0XHRkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25cblx0fTtcbn07XG5cblxuY29uc3QgY29kZUFjdGlvbnNPblNhdmVTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdG9uZU9mOiBbXG5cdFx0e1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHR9LFxuXHRcdHtcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9XG5cdFx0fVxuXHRdLFxuXHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2VkaXRvci5jb2RlQWN0aW9uc09uU2F2ZScsICdSdW4gQ29kZSBBY3Rpb25zIGZvciB0aGUgZWRpdG9yIG9uIHNhdmUuIENvZGUgQWN0aW9ucyBtdXN0IGJlIHNwZWNpZmllZCBhbmQgdGhlIGVkaXRvciBtdXN0IG5vdCBiZSBzaHV0dGluZyBkb3duLiBXaGVuIHswfSBpcyBzZXQgdG8gYGFmdGVyRGVsYXlgLCBDb2RlIEFjdGlvbnMgd2lsbCBvbmx5IGJlIHJ1biB3aGVuIHRoZSBmaWxlIGlzIHNhdmVkIGV4cGxpY2l0bHkuIEV4YW1wbGU6IGBcInNvdXJjZS5vcmdhbml6ZUltcG9ydHNcIjogXCJleHBsaWNpdFwiIGAnLCAnYCNmaWxlcy5hdXRvU2F2ZSNgJyksXG5cdHR5cGU6IFsnb2JqZWN0JywgJ2FycmF5J10sXG5cdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0ZW51bTogWydhbHdheXMnLCAnZXhwbGljaXQnLCAnbmV2ZXInLCB0cnVlLCBmYWxzZV0sXG5cdH0sXG5cdGRlZmF1bHQ6IHt9LFxuXHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFLFxufTtcblxuZXhwb3J0IGNvbnN0IGVkaXRvckNvbmZpZ3VyYXRpb24gPSBPYmplY3QuZnJlZXplPElDb25maWd1cmF0aW9uTm9kZT4oe1xuXHQuLi5lZGl0b3JDb25maWd1cmF0aW9uQmFzZU5vZGUsXG5cdHByb3BlcnRpZXM6IHtcblx0XHQnZWRpdG9yLmNvZGVBY3Rpb25zT25TYXZlJzogY29kZUFjdGlvbnNPblNhdmVTY2hlbWFcblx0fVxufSk7XG5cbmNvbnN0IG5vdGVib29rQ29kZUFjdGlvbnNPblNhdmVTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdG9uZU9mOiBbXG5cdFx0e1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHR9LFxuXHRcdHtcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9XG5cdFx0fVxuXHRdLFxuXHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmNvZGVBY3Rpb25zT25TYXZlJywgJ1J1biBhIHNlcmllcyBvZiBDb2RlIEFjdGlvbnMgZm9yIGEgbm90ZWJvb2sgb24gc2F2ZS4gQ29kZSBBY3Rpb25zIG11c3QgYmUgc3BlY2lmaWVkIGFuZCB0aGUgZWRpdG9yIG11c3Qgbm90IGJlIHNodXR0aW5nIGRvd24uIFdoZW4gezB9IGlzIHNldCB0byBgYWZ0ZXJEZWxheWAsIENvZGUgQWN0aW9ucyB3aWxsIG9ubHkgYmUgcnVuIHdoZW4gdGhlIGZpbGUgaXMgc2F2ZWQgZXhwbGljaXRseS4gRXhhbXBsZTogYFwibm90ZWJvb2suc291cmNlLm9yZ2FuaXplSW1wb3J0c1wiOiBcImV4cGxpY2l0XCJgJywgJ2AjZmlsZXMuYXV0b1NhdmUjYCcpLFxuXHR0eXBlOiAnb2JqZWN0Jyxcblx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHR0eXBlOiBbJ3N0cmluZycsICdib29sZWFuJ10sXG5cdFx0ZW51bTogWydleHBsaWNpdCcsICduZXZlcicsIHRydWUsIGZhbHNlXSxcblx0XHQvLyBlbnVtOiBbJ2V4cGxpY2l0JywgJ2Fsd2F5cycsICduZXZlciddLCAtLSBhdXRvc2F2ZSBzdXBwb3J0IG5lZWRzIHRvIGJlIGJ1aWx0IGZpcnN0XG5cdFx0Ly8gbmxzLmxvY2FsaXplKCdhbHdheXMnLCAnQWx3YXlzIHRyaWdnZXJzIENvZGUgQWN0aW9ucyBvbiBzYXZlLCBpbmNsdWRpbmcgYXV0b3NhdmUsIGZvY3VzLCBhbmQgd2luZG93IGNoYW5nZSBldmVudHMuJyksXG5cdH0sXG5cdGRlZmF1bHQ6IHt9XG59O1xuXG5leHBvcnQgY29uc3Qgbm90ZWJvb2tFZGl0b3JDb25maWd1cmF0aW9uID0gT2JqZWN0LmZyZWV6ZTxJQ29uZmlndXJhdGlvbk5vZGU+KHtcblx0Li4uZWRpdG9yQ29uZmlndXJhdGlvbkJhc2VOb2RlLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0J25vdGVib29rLmNvZGVBY3Rpb25zT25TYXZlJzogbm90ZWJvb2tDb2RlQWN0aW9uc09uU2F2ZVNjaGVtYVxuXHR9XG59KTtcblxuZXhwb3J0IGNsYXNzIENvZGVBY3Rpb25zQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2NoZW1hQ29udHJpYnV0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXG5cdHByaXZhdGUgX2FsbFByb3ZpZGVkQ29kZUFjdGlvbktpbmRzOiBIaWVyYXJjaGljYWxLaW5kW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlRmVhdHVyZXM6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gVE9ETzogQGp1c3RzY2hlbiBjYWNoaW5nIG9mIGNvZGUgYWN0aW9ucyBiYXNlZCBvbiBleHRlbnNpb25zIGxvYWRlZDogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIxNjAxOVxuXHRcdHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0RXZlbnQucnVuQW5kU3Vic2NyaWJlKFxuXHRcdFx0XHRFdmVudC5kZWJvdW5jZShsYW5ndWFnZUZlYXR1cmVzLmNvZGVBY3Rpb25Qcm92aWRlci5vbkRpZENoYW5nZSwgKCkgPT4geyB9LCAxMDAwKSxcblx0XHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2FsbFByb3ZpZGVkQ29kZUFjdGlvbktpbmRzID0gdGhpcy5nZXRBbGxQcm92aWRlZENvZGVBY3Rpb25LaW5kcygpO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlQ29uZmlndXJhdGlvblNjaGVtYSh0aGlzLl9hbGxQcm92aWRlZENvZGVBY3Rpb25LaW5kcyk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTY2hlbWFDb250cmlidXRpb25zLmZpcmUoKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0a2V5YmluZGluZ1NlcnZpY2UucmVnaXN0ZXJTY2hlbWFDb250cmlidXRpb24oe1xuXHRcdFx0Z2V0U2NoZW1hQWRkaXRpb25zOiAoKSA9PiB0aGlzLmdldEtleWJpbmRpbmdTY2hlbWFBZGRpdGlvbnMoKSxcblx0XHRcdG9uRGlkQ2hhbmdlOiB0aGlzLl9vbkRpZENoYW5nZVNjaGVtYUNvbnRyaWJ1dGlvbnMuZXZlbnQsXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEFsbFByb3ZpZGVkQ29kZUFjdGlvbktpbmRzKCk6IEFycmF5PEhpZXJhcmNoaWNhbEtpbmQ+IHtcblx0XHRjb25zdCBvdXQgPSBuZXcgTWFwPHN0cmluZywgSGllcmFyY2hpY2FsS2luZD4oKTtcblx0XHRmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIHRoaXMubGFuZ3VhZ2VGZWF0dXJlcy5jb2RlQWN0aW9uUHJvdmlkZXIuYWxsTm9Nb2RlbCgpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtpbmQgb2YgcHJvdmlkZXIucHJvdmlkZWRDb2RlQWN0aW9uS2luZHMgPz8gW10pIHtcblx0XHRcdFx0b3V0LnNldChraW5kLCBuZXcgSGllcmFyY2hpY2FsS2luZChraW5kKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBBcnJheS5mcm9tKG91dC52YWx1ZXMoKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbmZpZ3VyYXRpb25TY2hlbWEoYWxsUHJvdmlkZWRLaW5kczogSXRlcmFibGU8SGllcmFyY2hpY2FsS2luZD4pOiB2b2lkIHtcblx0XHRjb25zdCBwcm9wZXJ0aWVzOiBJSlNPTlNjaGVtYU1hcCA9IHsgLi4uY29kZUFjdGlvbnNPblNhdmVTY2hlbWEucHJvcGVydGllcyB9O1xuXHRcdGNvbnN0IG5vdGVib29rUHJvcGVydGllczogSUpTT05TY2hlbWFNYXAgPSB7IC4uLm5vdGVib29rQ29kZUFjdGlvbnNPblNhdmVTY2hlbWEucHJvcGVydGllcyB9O1xuXHRcdGZvciAoY29uc3QgY29kZUFjdGlvbktpbmQgb2YgYWxsUHJvdmlkZWRLaW5kcykge1xuXHRcdFx0aWYgKENvZGVBY3Rpb25LaW5kLlNvdXJjZS5jb250YWlucyhjb2RlQWN0aW9uS2luZCkgJiYgIXByb3BlcnRpZXNbY29kZUFjdGlvbktpbmQudmFsdWVdKSB7XG5cdFx0XHRcdHByb3BlcnRpZXNbY29kZUFjdGlvbktpbmQudmFsdWVdID0gY3JlYXRlQ29kZUFjdGlvbnNBdXRvU2F2ZShubHMubG9jYWxpemUoJ2NvZGVBY3Rpb25zT25TYXZlLmdlbmVyaWMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgJ3swfScgYWN0aW9ucyBzaG91bGQgYmUgcnVuIG9uIGZpbGUgc2F2ZS5cIiwgY29kZUFjdGlvbktpbmQudmFsdWUpKTtcblx0XHRcdFx0bm90ZWJvb2tQcm9wZXJ0aWVzW2NvZGVBY3Rpb25LaW5kLnZhbHVlXSA9IGNyZWF0ZU5vdGVib29rQ29kZUFjdGlvbnNBdXRvU2F2ZShubHMubG9jYWxpemUoJ2NvZGVBY3Rpb25zT25TYXZlLmdlbmVyaWMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgJ3swfScgYWN0aW9ucyBzaG91bGQgYmUgcnVuIG9uIGZpbGUgc2F2ZS5cIiwgY29kZUFjdGlvbktpbmQudmFsdWUpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29kZUFjdGlvbnNPblNhdmVTY2hlbWEucHJvcGVydGllcyA9IHByb3BlcnRpZXM7XG5cdFx0bm90ZWJvb2tDb2RlQWN0aW9uc09uU2F2ZVNjaGVtYS5wcm9wZXJ0aWVzID0gbm90ZWJvb2tQcm9wZXJ0aWVzO1xuXG5cdFx0UmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKVxuXHRcdFx0Lm5vdGlmeUNvbmZpZ3VyYXRpb25TY2hlbWFVcGRhdGVkKGVkaXRvckNvbmZpZ3VyYXRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRLZXliaW5kaW5nU2NoZW1hQWRkaXRpb25zKCk6IElKU09OU2NoZW1hW10ge1xuXHRcdGNvbnN0IGNvbmRpdGlvbmFsU2NoZW1hID0gKGNvbW1hbmQ6IHN0cmluZywga2luZHM6IHJlYWRvbmx5IHN0cmluZ1tdKTogSUpTT05TY2hlbWEgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWY6IHtcblx0XHRcdFx0XHRyZXF1aXJlZDogWydjb21tYW5kJ10sXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0J2NvbW1hbmQnOiB7IGNvbnN0OiBjb21tYW5kIH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRoZW46IHtcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHQnYXJncyc6IHtcblx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsna2luZCddLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0J2tpbmQnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR7IGVudW06IEFycmF5LmZyb20oa2luZHMpIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdGNvbnN0IGZpbHRlclByb3ZpZGVkS2luZHMgPSAob2ZLaW5kOiBIaWVyYXJjaGljYWxLaW5kKTogc3RyaW5nW10gPT4ge1xuXHRcdFx0Y29uc3Qgb3V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IHByb3ZpZGVkS2luZCBvZiB0aGlzLl9hbGxQcm92aWRlZENvZGVBY3Rpb25LaW5kcykge1xuXHRcdFx0XHRpZiAob2ZLaW5kLmNvbnRhaW5zKHByb3ZpZGVkS2luZCkpIHtcblx0XHRcdFx0XHRvdXQuYWRkKHByb3ZpZGVkS2luZC52YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBBcnJheS5mcm9tKG91dCk7XG5cdFx0fTtcblxuXHRcdHJldHVybiBbXG5cdFx0XHRjb25kaXRpb25hbFNjaGVtYShjb2RlQWN0aW9uQ29tbWFuZElkLCBmaWx0ZXJQcm92aWRlZEtpbmRzKEhpZXJhcmNoaWNhbEtpbmQuRW1wdHkpKSxcblx0XHRcdGNvbmRpdGlvbmFsU2NoZW1hKHJlZmFjdG9yQ29tbWFuZElkLCBmaWx0ZXJQcm92aWRlZEtpbmRzKENvZGVBY3Rpb25LaW5kLlJlZmFjdG9yKSksXG5cdFx0XHRjb25kaXRpb25hbFNjaGVtYShzb3VyY2VBY3Rpb25Db21tYW5kSWQsIGZpbHRlclByb3ZpZGVkS2luZHMoQ29kZUFjdGlvbktpbmQuU291cmNlKSksXG5cdFx0XTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHFCQUFxQixtQkFBbUIsNkJBQTZCO0FBQzlFLFNBQVMsc0JBQXNCO0FBQy9CLFlBQVksU0FBUztBQUNyQixTQUFTLG9CQUFvQixrQkFBNEY7QUFDekgsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxnQkFBZ0I7QUFHekIsTUFBTSw0QkFBNEIsQ0FBQyxnQkFBcUM7QUFDdkUsU0FBTztBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTSxDQUFD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
