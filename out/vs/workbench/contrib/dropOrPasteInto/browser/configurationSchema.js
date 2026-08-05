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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { editorConfigurationBaseNode } from "../../../../editor/common/config/editorConfigurationSchema.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { pasteAsCommandId } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteContribution.js";
import { pasteAsPreferenceConfig } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js";
import { dropAsPreferenceConfig } from "../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js";
import * as nls from "../../../../nls.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
const dropEnumValues = [];
const dropAsPreferenceSchema = {
  type: "array",
  scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
  description: nls.localize("dropPreferredDescription", "Configures the preferred type of edit to use when dropping content.\n\nThis is an ordered list of edit kinds. The first available edit of a preferred kind will be used."),
  default: [],
  items: {
    description: nls.localize("dropKind", "The kind identifier of the drop edit."),
    anyOf: [
      { type: "string" },
      { enum: dropEnumValues }
    ]
  }
};
const pasteEnumValues = [];
const pasteAsPreferenceSchema = {
  type: "array",
  scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
  description: nls.localize("pastePreferredDescription", "Configures the preferred type of edit to use when pasting content.\n\nThis is an ordered list of edit kinds. The first available edit of a preferred kind will be used."),
  default: [],
  items: {
    description: nls.localize("pasteKind", "The kind identifier of the paste edit."),
    anyOf: [
      { type: "string" },
      { enum: pasteEnumValues }
    ]
  }
};
const editorConfiguration = Object.freeze({
  ...editorConfigurationBaseNode,
  properties: {
    [pasteAsPreferenceConfig]: pasteAsPreferenceSchema,
    [dropAsPreferenceConfig]: dropAsPreferenceSchema
  }
});
let DropOrPasteSchemaContribution = class extends Disposable {
  constructor(keybindingService, languageFeatures) {
    super();
    this.languageFeatures = languageFeatures;
    this._onDidChangeSchemaContributions = this._register(new Emitter());
    this._allProvidedDropKinds = [];
    this._allProvidedPasteKinds = [];
    this._register(
      Event.runAndSubscribe(
        Event.debounce(
          Event.any(languageFeatures.documentPasteEditProvider.onDidChange, languageFeatures.documentPasteEditProvider.onDidChange),
          () => {
          },
          1e3
        ),
        () => {
          this.updateProvidedKinds();
          this.updateConfigurationSchema();
          this._onDidChangeSchemaContributions.fire();
        }
      )
    );
    keybindingService.registerSchemaContribution({
      getSchemaAdditions: () => this.getKeybindingSchemaAdditions(),
      onDidChange: this._onDidChangeSchemaContributions.event
    });
  }
  updateProvidedKinds() {
    const dropKinds = /* @__PURE__ */ new Map();
    for (const provider of this.languageFeatures.documentDropEditProvider.allNoModel()) {
      for (const kind of provider.providedDropEditKinds ?? []) {
        dropKinds.set(kind.value, kind);
      }
    }
    this._allProvidedDropKinds = Array.from(dropKinds.values());
    const pasteKinds = /* @__PURE__ */ new Map();
    for (const provider of this.languageFeatures.documentPasteEditProvider.allNoModel()) {
      for (const kind of provider.providedPasteEditKinds ?? []) {
        pasteKinds.set(kind.value, kind);
      }
    }
    this._allProvidedPasteKinds = Array.from(pasteKinds.values());
  }
  updateConfigurationSchema() {
    pasteEnumValues.length = 0;
    for (const codeActionKind of this._allProvidedPasteKinds) {
      pasteEnumValues.push(codeActionKind.value);
    }
    dropEnumValues.length = 0;
    for (const codeActionKind of this._allProvidedDropKinds) {
      dropEnumValues.push(codeActionKind.value);
    }
    Registry.as(Extensions.Configuration).notifyConfigurationSchemaUpdated(editorConfiguration);
  }
  getKeybindingSchemaAdditions() {
    return [
      {
        if: {
          required: ["command"],
          properties: {
            "command": { const: pasteAsCommandId }
          }
        },
        then: {
          properties: {
            "args": {
              oneOf: [
                {
                  required: ["kind"],
                  properties: {
                    "kind": {
                      anyOf: [
                        { enum: Array.from(this._allProvidedPasteKinds.map((x) => x.value)) },
                        { type: "string" }
                      ]
                    }
                  }
                },
                {
                  required: ["preferences"],
                  properties: {
                    "preferences": {
                      type: "array",
                      items: {
                        anyOf: [
                          { enum: Array.from(this._allProvidedPasteKinds.map((x) => x.value)) },
                          { type: "string" }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    ];
  }
};
DropOrPasteSchemaContribution.ID = "workbench.contrib.dropOrPasteIntoSchema";
DropOrPasteSchemaContribution = __decorateClass([
  __decorateParam(0, IKeybindingService),
  __decorateParam(1, ILanguageFeaturesService)
], DropOrPasteSchemaContribution);
export {
  DropOrPasteSchemaContribution,
  editorConfiguration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kcm9wT3JQYXN0ZUludG8vYnJvd3Nlci9jb25maWd1cmF0aW9uU2NoZW1hLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBIaWVyYXJjaGljYWxLaW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGllcmFyY2hpY2FsS2luZC5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlZGl0b3JDb25maWd1cmF0aW9uQmFzZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JDb25maWd1cmF0aW9uU2NoZW1hLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBwYXN0ZUFzQ29tbWFuZElkIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZHJvcE9yUGFzdGVJbnRvL2Jyb3dzZXIvY29weVBhc3RlQ29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IHBhc3RlQXNQcmVmZXJlbmNlQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZHJvcE9yUGFzdGVJbnRvL2Jyb3dzZXIvY29weVBhc3RlQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBkcm9wQXNQcmVmZXJlbmNlQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZHJvcE9yUGFzdGVJbnRvL2Jyb3dzZXIvZHJvcEludG9FZGl0b3JDb250cm9sbGVyLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblNjb3BlLCBFeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvbk5vZGUsIElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuXG5jb25zdCBkcm9wRW51bVZhbHVlczogc3RyaW5nW10gPSBbXTtcblxuY29uc3QgZHJvcEFzUHJlZmVyZW5jZVNjaGVtYTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSA9IHtcblx0dHlwZTogJ2FycmF5Jyxcblx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5MQU5HVUFHRV9PVkVSUklEQUJMRSxcblx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZHJvcFByZWZlcnJlZERlc2NyaXB0aW9uJywgXCJDb25maWd1cmVzIHRoZSBwcmVmZXJyZWQgdHlwZSBvZiBlZGl0IHRvIHVzZSB3aGVuIGRyb3BwaW5nIGNvbnRlbnQuXFxuXFxuVGhpcyBpcyBhbiBvcmRlcmVkIGxpc3Qgb2YgZWRpdCBraW5kcy4gVGhlIGZpcnN0IGF2YWlsYWJsZSBlZGl0IG9mIGEgcHJlZmVycmVkIGtpbmQgd2lsbCBiZSB1c2VkLlwiKSxcblx0ZGVmYXVsdDogW10sXG5cdGl0ZW1zOiB7XG5cdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZHJvcEtpbmQnLCBcIlRoZSBraW5kIGlkZW50aWZpZXIgb2YgdGhlIGRyb3AgZWRpdC5cIiksXG5cdFx0YW55T2Y6IFtcblx0XHRcdHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdHsgZW51bTogZHJvcEVudW1WYWx1ZXMgfVxuXHRcdF0sXG5cdH1cbn07XG5cbmNvbnN0IHBhc3RlRW51bVZhbHVlczogc3RyaW5nW10gPSBbXTtcblxuY29uc3QgcGFzdGVBc1ByZWZlcmVuY2VTY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdHR5cGU6ICdhcnJheScsXG5cdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuTEFOR1VBR0VfT1ZFUlJJREFCTEUsXG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Bhc3RlUHJlZmVycmVkRGVzY3JpcHRpb24nLCBcIkNvbmZpZ3VyZXMgdGhlIHByZWZlcnJlZCB0eXBlIG9mIGVkaXQgdG8gdXNlIHdoZW4gcGFzdGluZyBjb250ZW50LlxcblxcblRoaXMgaXMgYW4gb3JkZXJlZCBsaXN0IG9mIGVkaXQga2luZHMuIFRoZSBmaXJzdCBhdmFpbGFibGUgZWRpdCBvZiBhIHByZWZlcnJlZCBraW5kIHdpbGwgYmUgdXNlZC5cIiksXG5cdGRlZmF1bHQ6IFtdLFxuXHRpdGVtczoge1xuXHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Bhc3RlS2luZCcsIFwiVGhlIGtpbmQgaWRlbnRpZmllciBvZiB0aGUgcGFzdGUgZWRpdC5cIiksXG5cdFx0YW55T2Y6IFtcblx0XHRcdHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdHsgZW51bTogcGFzdGVFbnVtVmFsdWVzIH1cblx0XHRdXG5cdH1cbn07XG5cbmV4cG9ydCBjb25zdCBlZGl0b3JDb25maWd1cmF0aW9uID0gT2JqZWN0LmZyZWV6ZTxJQ29uZmlndXJhdGlvbk5vZGU+KHtcblx0Li4uZWRpdG9yQ29uZmlndXJhdGlvbkJhc2VOb2RlLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0W3Bhc3RlQXNQcmVmZXJlbmNlQ29uZmlnXTogcGFzdGVBc1ByZWZlcmVuY2VTY2hlbWEsXG5cdFx0W2Ryb3BBc1ByZWZlcmVuY2VDb25maWddOiBkcm9wQXNQcmVmZXJlbmNlU2NoZW1hLFxuXHR9XG59KTtcblxuZXhwb3J0IGNsYXNzIERyb3BPclBhc3RlU2NoZW1hQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHB1YmxpYyBzdGF0aWMgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuZHJvcE9yUGFzdGVJbnRvU2NoZW1hJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVNjaGVtYUNvbnRyaWJ1dGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblxuXHRwcml2YXRlIF9hbGxQcm92aWRlZERyb3BLaW5kczogSGllcmFyY2hpY2FsS2luZFtdID0gW107XG5cdHByaXZhdGUgX2FsbFByb3ZpZGVkUGFzdGVLaW5kczogSGllcmFyY2hpY2FsS2luZFtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZUZlYXR1cmVzOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0RXZlbnQucnVuQW5kU3Vic2NyaWJlKFxuXHRcdFx0XHRFdmVudC5kZWJvdW5jZShcblx0XHRcdFx0XHRFdmVudC5hbnkobGFuZ3VhZ2VGZWF0dXJlcy5kb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyLm9uRGlkQ2hhbmdlLCBsYW5ndWFnZUZlYXR1cmVzLmRvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXIub25EaWRDaGFuZ2UpLFxuXHRcdFx0XHRcdCgpID0+IHsgfSxcblx0XHRcdFx0XHQxMDAwLFxuXHRcdFx0XHQpLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVQcm92aWRlZEtpbmRzKCk7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVDb25maWd1cmF0aW9uU2NoZW1hKCk7XG5cblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNjaGVtYUNvbnRyaWJ1dGlvbnMuZmlyZSgpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRrZXliaW5kaW5nU2VydmljZS5yZWdpc3RlclNjaGVtYUNvbnRyaWJ1dGlvbih7XG5cdFx0XHRnZXRTY2hlbWFBZGRpdGlvbnM6ICgpID0+IHRoaXMuZ2V0S2V5YmluZGluZ1NjaGVtYUFkZGl0aW9ucygpLFxuXHRcdFx0b25EaWRDaGFuZ2U6IHRoaXMuX29uRGlkQ2hhbmdlU2NoZW1hQ29udHJpYnV0aW9ucy5ldmVudCxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUHJvdmlkZWRLaW5kcygpOiB2b2lkIHtcblx0XHQvLyBEcm9wXG5cdFx0Y29uc3QgZHJvcEtpbmRzID0gbmV3IE1hcDxzdHJpbmcsIEhpZXJhcmNoaWNhbEtpbmQ+KCk7XG5cdFx0Zm9yIChjb25zdCBwcm92aWRlciBvZiB0aGlzLmxhbmd1YWdlRmVhdHVyZXMuZG9jdW1lbnREcm9wRWRpdFByb3ZpZGVyLmFsbE5vTW9kZWwoKSkge1xuXHRcdFx0Zm9yIChjb25zdCBraW5kIG9mIHByb3ZpZGVyLnByb3ZpZGVkRHJvcEVkaXRLaW5kcyA/PyBbXSkge1xuXHRcdFx0XHRkcm9wS2luZHMuc2V0KGtpbmQudmFsdWUsIGtpbmQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9hbGxQcm92aWRlZERyb3BLaW5kcyA9IEFycmF5LmZyb20oZHJvcEtpbmRzLnZhbHVlcygpKTtcblxuXHRcdC8vIFBhc3RlXG5cdFx0Y29uc3QgcGFzdGVLaW5kcyA9IG5ldyBNYXA8c3RyaW5nLCBIaWVyYXJjaGljYWxLaW5kPigpO1xuXHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgdGhpcy5sYW5ndWFnZUZlYXR1cmVzLmRvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXIuYWxsTm9Nb2RlbCgpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtpbmQgb2YgcHJvdmlkZXIucHJvdmlkZWRQYXN0ZUVkaXRLaW5kcyA/PyBbXSkge1xuXHRcdFx0XHRwYXN0ZUtpbmRzLnNldChraW5kLnZhbHVlLCBraW5kKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fYWxsUHJvdmlkZWRQYXN0ZUtpbmRzID0gQXJyYXkuZnJvbShwYXN0ZUtpbmRzLnZhbHVlcygpKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29uZmlndXJhdGlvblNjaGVtYSgpOiB2b2lkIHtcblx0XHRwYXN0ZUVudW1WYWx1ZXMubGVuZ3RoID0gMDtcblx0XHRmb3IgKGNvbnN0IGNvZGVBY3Rpb25LaW5kIG9mIHRoaXMuX2FsbFByb3ZpZGVkUGFzdGVLaW5kcykge1xuXHRcdFx0cGFzdGVFbnVtVmFsdWVzLnB1c2goY29kZUFjdGlvbktpbmQudmFsdWUpO1xuXHRcdH1cblxuXHRcdGRyb3BFbnVtVmFsdWVzLmxlbmd0aCA9IDA7XG5cdFx0Zm9yIChjb25zdCBjb2RlQWN0aW9uS2luZCBvZiB0aGlzLl9hbGxQcm92aWRlZERyb3BLaW5kcykge1xuXHRcdFx0ZHJvcEVudW1WYWx1ZXMucHVzaChjb2RlQWN0aW9uS2luZC52YWx1ZSk7XG5cdFx0fVxuXG5cdFx0UmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKVxuXHRcdFx0Lm5vdGlmeUNvbmZpZ3VyYXRpb25TY2hlbWFVcGRhdGVkKGVkaXRvckNvbmZpZ3VyYXRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRLZXliaW5kaW5nU2NoZW1hQWRkaXRpb25zKCk6IElKU09OU2NoZW1hW10ge1xuXHRcdHJldHVybiBbXG5cdFx0XHR7XG5cdFx0XHRcdGlmOiB7XG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsnY29tbWFuZCddLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdCdjb21tYW5kJzogeyBjb25zdDogcGFzdGVBc0NvbW1hbmRJZCB9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0aGVuOiB7XG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0J2FyZ3MnOiB7XG5cdFx0XHRcdFx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsna2luZCddLFxuXHRcdFx0XHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQna2luZCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0eyBlbnVtOiBBcnJheS5mcm9tKHRoaXMuX2FsbFByb3ZpZGVkUGFzdGVLaW5kcy5tYXAoeCA9PiB4LnZhbHVlKSkgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ3ByZWZlcmVuY2VzJ10sXG5cdFx0XHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdCdwcmVmZXJlbmNlcyc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7IGVudW06IEFycmF5LmZyb20odGhpcy5fYWxsUHJvdmlkZWRQYXN0ZUtpbmRzLm1hcCh4ID0+IHgudmFsdWUpKSB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdF07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxTQUFTLGFBQWE7QUFHL0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx3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QkFBa0M7QUFDekMsb0JBQWdCLFNBQVM7QUFDekIsZUFBVyxrQkFBa0IsS0FBSyx3QkFBd0I7QUFDekQsc0JBQWdCLEtBQUssZUFBZSxLQUFLO0FBQUEsSUFDMUM7QUFFQSxtQkFBZSxTQUFTO0FBQ3hCLGVBQVcsa0JBQWtCLEtBQUssdUJBQXVCO0FBQ3hELHFCQUFlLEtBQUssZUFBZSxLQUFLO0FBQUEsSUFDekM7QUFFQSxhQUFTLEdBQTJCLFdBQVcsYUFBYSxFQUMxRCxpQ0FBaUMsbUJBQW1CO0FBQUEsRUFDdkQ7QUFBQSxFQUVRLCtCQUE4QztBQUNyRCxXQUFPO0FBQUEsTUFDTjtBQUFBLFFBQ0MsSUFBSTtBQUFBLFVBQ0gsVUFBVSxDQUFDLFNBQVM7QUFBQSxVQUNwQixZQUFZO0FBQUEsWUFDWCxXQUFXLEVBQUUsT0FBTyxpQkFBaUI7QUFBQSxVQUN0QztBQUFBLFFBQ0Q7QUFBQSxRQUNBLE1BQU07QUFBQSxVQUNMLFlBQVk7QUFBQSxZQUNYLFFBQVE7QUFBQSxjQUNQLE9BQU87QUFBQSxnQkFDTjtBQUFBLGtCQUNDLFVBQVUsQ0FBQyxNQUFNO0FBQUEsa0JBQ2pCLFlBQVk7QUFBQSxvQkFDWCxRQUFRO0FBQUEsc0JBQ1AsT0FBTztBQUFBLHdCQUNOLEVBQUUsTUFBTSxNQUFNLEtBQUssS0FBSyx1QkFBdUIsSUFBSSxPQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUU7QUFBQSx3QkFDbEUsRUFBRSxNQUFNLFNBQVM7QUFBQSxzQkFDbEI7QUFBQSxvQkFDRDtBQUFBLGtCQUNEO0FBQUEsZ0JBQ0Q7QUFBQSxnQkFDQTtBQUFBLGtCQUNDLFVBQVUsQ0FBQyxhQUFhO0FBQUEsa0JBQ3hCLFlBQVk7QUFBQSxvQkFDWCxlQUFlO0FBQUEsc0JBQ2QsTUFBTTtBQUFBLHNCQUNOLE9BQU87QUFBQSx3QkFDTixPQUFPO0FBQUEsMEJBQ04sRUFBRSxNQUFNLE1BQU0sS0FBSyxLQUFLLHVCQUF1QixJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFBRTtBQUFBLDBCQUNsRSxFQUFFLE1BQU0sU0FBUztBQUFBLHdCQUNsQjtBQUFBLHNCQUNEO0FBQUEsb0JBQ0Q7QUFBQSxrQkFDRDtBQUFBLGdCQUNEO0FBQUEsY0FDRDtBQUFBLFlBQ0Q7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBbEhhLDhCQUVFLEtBQUs7QUFGUCxnQ0FBTjtBQUFBLEVBVUo7QUFBQSxFQUNBO0FBQUEsR0FYVTsiLAogICJuYW1lcyI6IFtdCn0K
