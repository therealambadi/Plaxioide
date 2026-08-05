import * as nls from "../../../../nls.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { getTokenClassificationRegistry, typeAndModifierIdPattern } from "../../../../platform/theme/common/tokenClassificationRegistry.js";
const tokenClassificationRegistry = getTokenClassificationRegistry();
const tokenTypeExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "semanticTokenTypes",
  jsonSchema: {
    description: nls.localize("contributes.semanticTokenTypes", "Contributes semantic token types."),
    type: "array",
    items: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: nls.localize("contributes.semanticTokenTypes.id", "The identifier of the semantic token type"),
          pattern: typeAndModifierIdPattern,
          patternErrorMessage: nls.localize("contributes.semanticTokenTypes.id.format", "Identifiers should be in the form letterOrDigit[_-letterOrDigit]*")
        },
        superType: {
          type: "string",
          description: nls.localize("contributes.semanticTokenTypes.superType", "The super type of the semantic token type"),
          pattern: typeAndModifierIdPattern,
          patternErrorMessage: nls.localize("contributes.semanticTokenTypes.superType.format", "Super types should be in the form letterOrDigit[_-letterOrDigit]*")
        },
        description: {
          type: "string",
          description: nls.localize("contributes.color.description", "The description of the semantic token type")
        }
      }
    }
  }
});
const tokenModifierExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "semanticTokenModifiers",
  jsonSchema: {
    description: nls.localize("contributes.semanticTokenModifiers", "Contributes semantic token modifiers."),
    type: "array",
    items: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: nls.localize("contributes.semanticTokenModifiers.id", "The identifier of the semantic token modifier"),
          pattern: typeAndModifierIdPattern,
          patternErrorMessage: nls.localize("contributes.semanticTokenModifiers.id.format", "Identifiers should be in the form letterOrDigit[_-letterOrDigit]*")
        },
        description: {
          description: nls.localize("contributes.semanticTokenModifiers.description", "The description of the semantic token modifier")
        }
      }
    }
  }
});
const tokenStyleDefaultsExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "semanticTokenScopes",
  jsonSchema: {
    description: nls.localize("contributes.semanticTokenScopes", "Contributes semantic token scope maps."),
    type: "array",
    items: {
      type: "object",
      properties: {
        language: {
          description: nls.localize("contributes.semanticTokenScopes.languages", "Lists the languge for which the defaults are."),
          type: "string"
        },
        scopes: {
          description: nls.localize("contributes.semanticTokenScopes.scopes", "Maps a semantic token (described by semantic token selector) to one or more textMate scopes used to represent that token."),
          type: "object",
          additionalProperties: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      }
    }
  }
});
class TokenClassificationExtensionPoints {
  constructor() {
    function validateTypeOrModifier(contribution, extensionPoint, collector) {
      if (typeof contribution.id !== "string" || contribution.id.length === 0) {
        collector.error(nls.localize("invalid.id", "'configuration.{0}.id' must be defined and can not be empty", extensionPoint));
        return false;
      }
      if (!contribution.id.match(typeAndModifierIdPattern)) {
        collector.error(nls.localize("invalid.id.format", "'configuration.{0}.id' must follow the pattern letterOrDigit[-_letterOrDigit]*", extensionPoint));
        return false;
      }
      const superType = contribution.superType;
      if (superType && !superType.match(typeAndModifierIdPattern)) {
        collector.error(nls.localize("invalid.superType.format", "'configuration.{0}.superType' must follow the pattern letterOrDigit[-_letterOrDigit]*", extensionPoint));
        return false;
      }
      if (typeof contribution.description !== "string" || contribution.id.length === 0) {
        collector.error(nls.localize("invalid.description", "'configuration.{0}.description' must be defined and can not be empty", extensionPoint));
        return false;
      }
      return true;
    }
    tokenTypeExtPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        const extensionValue = extension.value;
        const collector = extension.collector;
        if (!extensionValue || !Array.isArray(extensionValue)) {
          collector.error(nls.localize("invalid.semanticTokenTypeConfiguration", "'configuration.semanticTokenType' must be an array"));
          return;
        }
        for (const contribution of extensionValue) {
          if (validateTypeOrModifier(contribution, "semanticTokenType", collector)) {
            tokenClassificationRegistry.registerTokenType(contribution.id, contribution.description, contribution.superType);
          }
        }
      }
      for (const extension of delta.removed) {
        const extensionValue = extension.value;
        for (const contribution of extensionValue) {
          tokenClassificationRegistry.deregisterTokenType(contribution.id);
        }
      }
    });
    tokenModifierExtPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        const extensionValue = extension.value;
        const collector = extension.collector;
        if (!extensionValue || !Array.isArray(extensionValue)) {
          collector.error(nls.localize("invalid.semanticTokenModifierConfiguration", "'configuration.semanticTokenModifier' must be an array"));
          return;
        }
        for (const contribution of extensionValue) {
          if (validateTypeOrModifier(contribution, "semanticTokenModifier", collector)) {
            tokenClassificationRegistry.registerTokenModifier(contribution.id, contribution.description);
          }
        }
      }
      for (const extension of delta.removed) {
        const extensionValue = extension.value;
        for (const contribution of extensionValue) {
          tokenClassificationRegistry.deregisterTokenModifier(contribution.id);
        }
      }
    });
    tokenStyleDefaultsExtPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        const extensionValue = extension.value;
        const collector = extension.collector;
        if (!extensionValue || !Array.isArray(extensionValue)) {
          collector.error(nls.localize("invalid.semanticTokenScopes.configuration", "'configuration.semanticTokenScopes' must be an array"));
          return;
        }
        for (const contribution of extensionValue) {
          if (contribution.language && typeof contribution.language !== "string") {
            collector.error(nls.localize("invalid.semanticTokenScopes.language", "'configuration.semanticTokenScopes.language' must be a string"));
            continue;
          }
          if (!contribution.scopes || typeof contribution.scopes !== "object") {
            collector.error(nls.localize("invalid.semanticTokenScopes.scopes", "'configuration.semanticTokenScopes.scopes' must be defined as an object"));
            continue;
          }
          for (const selectorString in contribution.scopes) {
            const tmScopes = contribution.scopes[selectorString];
            if (!Array.isArray(tmScopes) || tmScopes.some((l) => typeof l !== "string")) {
              collector.error(nls.localize("invalid.semanticTokenScopes.scopes.value", "'configuration.semanticTokenScopes.scopes' values must be an array of strings"));
              continue;
            }
            try {
              const selector = tokenClassificationRegistry.parseTokenSelector(selectorString, contribution.language);
              tokenClassificationRegistry.registerTokenStyleDefault(selector, { scopesToProbe: tmScopes.map((s) => s.split(" ")) });
            } catch (e) {
              collector.error(nls.localize("invalid.semanticTokenScopes.scopes.selector", "configuration.semanticTokenScopes.scopes': Problems parsing selector {0}.", selectorString));
            }
          }
        }
      }
      for (const extension of delta.removed) {
        const extensionValue = extension.value;
        for (const contribution of extensionValue) {
          for (const selectorString in contribution.scopes) {
            const tmScopes = contribution.scopes[selectorString];
            try {
              const selector = tokenClassificationRegistry.parseTokenSelector(selectorString, contribution.language);
              tokenClassificationRegistry.registerTokenStyleDefault(selector, { scopesToProbe: tmScopes.map((s) => s.split(" ")) });
            } catch (e) {
            }
          }
        }
      }
    });
  }
}
export {
  TokenClassificationExtensionPoints
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGhlbWVzL2NvbW1vbi90b2tlbkNsYXNzaWZpY2F0aW9uRXh0ZW5zaW9uUG9pbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNSZWdpc3RyeSwgRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3RvciB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBnZXRUb2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnksIElUb2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnksIHR5cGVBbmRNb2RpZmllcklkUGF0dGVybiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90b2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkuanMnO1xuXG5pbnRlcmZhY2UgSVRva2VuVHlwZUV4dGVuc2lvblBvaW50IHtcblx0aWQ6IHN0cmluZztcblx0ZGVzY3JpcHRpb246IHN0cmluZztcblx0c3VwZXJUeXBlPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSVRva2VuTW9kaWZpZXJFeHRlbnNpb25Qb2ludCB7XG5cdGlkOiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJVG9rZW5TdHlsZURlZmF1bHRFeHRlbnNpb25Qb2ludCB7XG5cdGxhbmd1YWdlPzogc3RyaW5nO1xuXHRzY29wZXM6IHsgW3NlbGVjdG9yOiBzdHJpbmddOiBzdHJpbmdbXSB9O1xufVxuXG5jb25zdCB0b2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnk6IElUb2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkgPSBnZXRUb2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkoKTtcblxuY29uc3QgdG9rZW5UeXBlRXh0UG9pbnQgPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxJVG9rZW5UeXBlRXh0ZW5zaW9uUG9pbnRbXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ3NlbWFudGljVG9rZW5UeXBlcycsXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5zZW1hbnRpY1Rva2VuVHlwZXMnLCAnQ29udHJpYnV0ZXMgc2VtYW50aWMgdG9rZW4gdHlwZXMuJyksXG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRpdGVtczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuc2VtYW50aWNUb2tlblR5cGVzLmlkJywgJ1RoZSBpZGVudGlmaWVyIG9mIHRoZSBzZW1hbnRpYyB0b2tlbiB0eXBlJyksXG5cdFx0XHRcdFx0cGF0dGVybjogdHlwZUFuZE1vZGlmaWVySWRQYXR0ZXJuLFxuXHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuc2VtYW50aWNUb2tlblR5cGVzLmlkLmZvcm1hdCcsICdJZGVudGlmaWVycyBzaG91bGQgYmUgaW4gdGhlIGZvcm0gbGV0dGVyT3JEaWdpdFtfLWxldHRlck9yRGlnaXRdKicpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzdXBlclR5cGU6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5zZW1hbnRpY1Rva2VuVHlwZXMuc3VwZXJUeXBlJywgJ1RoZSBzdXBlciB0eXBlIG9mIHRoZSBzZW1hbnRpYyB0b2tlbiB0eXBlJyksXG5cdFx0XHRcdFx0cGF0dGVybjogdHlwZUFuZE1vZGlmaWVySWRQYXR0ZXJuLFxuXHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuc2VtYW50aWNUb2tlblR5cGVzLnN1cGVyVHlwZS5mb3JtYXQnLCAnU3VwZXIgdHlwZXMgc2hvdWxkIGJlIGluIHRoZSBmb3JtIGxldHRlck9yRGlnaXRbXy1sZXR0ZXJPckRpZ2l0XSonKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5jb2xvci5kZXNjcmlwdGlvbicsICdUaGUgZGVzY3JpcHRpb24gb2YgdGhlIHNlbWFudGljIHRva2VuIHR5cGUnKSxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmNvbnN0IHRva2VuTW9kaWZpZXJFeHRQb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElUb2tlbk1vZGlmaWVyRXh0ZW5zaW9uUG9pbnRbXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ3NlbWFudGljVG9rZW5Nb2RpZmllcnMnLFxuXHRqc29uU2NoZW1hOiB7XG5cdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuc2VtYW50aWNUb2tlbk1vZGlmaWVycycsICdDb250cmlidXRlcyBzZW1hbnRpYyB0b2tlbiBtb2RpZmllcnMuJyksXG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRpdGVtczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuc2VtYW50aWNUb2tlbk1vZGlmaWVycy5pZCcsICdUaGUgaWRlbnRpZmllciBvZiB0aGUgc2VtYW50aWMgdG9rZW4gbW9kaWZpZXInKSxcblx0XHRcdFx0XHRwYXR0ZXJuOiB0eXBlQW5kTW9kaWZpZXJJZFBhdHRlcm4sXG5cdFx0XHRcdFx0cGF0dGVybkVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5zZW1hbnRpY1Rva2VuTW9kaWZpZXJzLmlkLmZvcm1hdCcsICdJZGVudGlmaWVycyBzaG91bGQgYmUgaW4gdGhlIGZvcm0gbGV0dGVyT3JEaWdpdFtfLWxldHRlck9yRGlnaXRdKicpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuc2VtYW50aWNUb2tlbk1vZGlmaWVycy5kZXNjcmlwdGlvbicsICdUaGUgZGVzY3JpcHRpb24gb2YgdGhlIHNlbWFudGljIHRva2VuIG1vZGlmaWVyJylcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmNvbnN0IHRva2VuU3R5bGVEZWZhdWx0c0V4dFBvaW50ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8SVRva2VuU3R5bGVEZWZhdWx0RXh0ZW5zaW9uUG9pbnRbXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ3NlbWFudGljVG9rZW5TY29wZXMnLFxuXHRqc29uU2NoZW1hOiB7XG5cdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuc2VtYW50aWNUb2tlblNjb3BlcycsICdDb250cmlidXRlcyBzZW1hbnRpYyB0b2tlbiBzY29wZSBtYXBzLicpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0aXRlbXM6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRsYW5ndWFnZToge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLnNlbWFudGljVG9rZW5TY29wZXMubGFuZ3VhZ2VzJywgJ0xpc3RzIHRoZSBsYW5ndWdlIGZvciB3aGljaCB0aGUgZGVmYXVsdHMgYXJlLicpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNjb3Blczoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLnNlbWFudGljVG9rZW5TY29wZXMuc2NvcGVzJywgJ01hcHMgYSBzZW1hbnRpYyB0b2tlbiAoZGVzY3JpYmVkIGJ5IHNlbWFudGljIHRva2VuIHNlbGVjdG9yKSB0byBvbmUgb3IgbW9yZSB0ZXh0TWF0ZSBzY29wZXMgdXNlZCB0byByZXByZXNlbnQgdGhhdCB0b2tlbi4nKSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuXG5leHBvcnQgY2xhc3MgVG9rZW5DbGFzc2lmaWNhdGlvbkV4dGVuc2lvblBvaW50cyB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0ZnVuY3Rpb24gdmFsaWRhdGVUeXBlT3JNb2RpZmllcihjb250cmlidXRpb246IElUb2tlblR5cGVFeHRlbnNpb25Qb2ludCB8IElUb2tlbk1vZGlmaWVyRXh0ZW5zaW9uUG9pbnQsIGV4dGVuc2lvblBvaW50OiBzdHJpbmcsIGNvbGxlY3RvcjogRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3Rvcik6IGJvb2xlYW4ge1xuXHRcdFx0aWYgKHR5cGVvZiBjb250cmlidXRpb24uaWQgIT09ICdzdHJpbmcnIHx8IGNvbnRyaWJ1dGlvbi5pZC5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5pZCcsIFwiJ2NvbmZpZ3VyYXRpb24uezB9LmlkJyBtdXN0IGJlIGRlZmluZWQgYW5kIGNhbiBub3QgYmUgZW1wdHlcIiwgZXh0ZW5zaW9uUG9pbnQpKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFjb250cmlidXRpb24uaWQubWF0Y2godHlwZUFuZE1vZGlmaWVySWRQYXR0ZXJuKSkge1xuXHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLmlkLmZvcm1hdCcsIFwiJ2NvbmZpZ3VyYXRpb24uezB9LmlkJyBtdXN0IGZvbGxvdyB0aGUgcGF0dGVybiBsZXR0ZXJPckRpZ2l0Wy1fbGV0dGVyT3JEaWdpdF0qXCIsIGV4dGVuc2lvblBvaW50KSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHN1cGVyVHlwZSA9IChjb250cmlidXRpb24gYXMgSVRva2VuVHlwZUV4dGVuc2lvblBvaW50KS5zdXBlclR5cGU7XG5cdFx0XHRpZiAoc3VwZXJUeXBlICYmICFzdXBlclR5cGUubWF0Y2godHlwZUFuZE1vZGlmaWVySWRQYXR0ZXJuKSkge1xuXHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLnN1cGVyVHlwZS5mb3JtYXQnLCBcIidjb25maWd1cmF0aW9uLnswfS5zdXBlclR5cGUnIG11c3QgZm9sbG93IHRoZSBwYXR0ZXJuIGxldHRlck9yRGlnaXRbLV9sZXR0ZXJPckRpZ2l0XSpcIiwgZXh0ZW5zaW9uUG9pbnQpKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBjb250cmlidXRpb24uZGVzY3JpcHRpb24gIT09ICdzdHJpbmcnIHx8IGNvbnRyaWJ1dGlvbi5pZC5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5kZXNjcmlwdGlvbicsIFwiJ2NvbmZpZ3VyYXRpb24uezB9LmRlc2NyaXB0aW9uJyBtdXN0IGJlIGRlZmluZWQgYW5kIGNhbiBub3QgYmUgZW1wdHlcIiwgZXh0ZW5zaW9uUG9pbnQpKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0dG9rZW5UeXBlRXh0UG9pbnQuc2V0SGFuZGxlcigoZXh0ZW5zaW9ucywgZGVsdGEpID0+IHtcblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGRlbHRhLmFkZGVkKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvblZhbHVlID0gPElUb2tlblR5cGVFeHRlbnNpb25Qb2ludFtdPmV4dGVuc2lvbi52YWx1ZTtcblx0XHRcdFx0Y29uc3QgY29sbGVjdG9yID0gZXh0ZW5zaW9uLmNvbGxlY3RvcjtcblxuXHRcdFx0XHRpZiAoIWV4dGVuc2lvblZhbHVlIHx8ICFBcnJheS5pc0FycmF5KGV4dGVuc2lvblZhbHVlKSkge1xuXHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQuc2VtYW50aWNUb2tlblR5cGVDb25maWd1cmF0aW9uJywgXCInY29uZmlndXJhdGlvbi5zZW1hbnRpY1Rva2VuVHlwZScgbXVzdCBiZSBhbiBhcnJheVwiKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoY29uc3QgY29udHJpYnV0aW9uIG9mIGV4dGVuc2lvblZhbHVlKSB7XG5cdFx0XHRcdFx0aWYgKHZhbGlkYXRlVHlwZU9yTW9kaWZpZXIoY29udHJpYnV0aW9uLCAnc2VtYW50aWNUb2tlblR5cGUnLCBjb2xsZWN0b3IpKSB7XG5cdFx0XHRcdFx0XHR0b2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkucmVnaXN0ZXJUb2tlblR5cGUoY29udHJpYnV0aW9uLmlkLCBjb250cmlidXRpb24uZGVzY3JpcHRpb24sIGNvbnRyaWJ1dGlvbi5zdXBlclR5cGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZGVsdGEucmVtb3ZlZCkge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25WYWx1ZSA9IDxJVG9rZW5UeXBlRXh0ZW5zaW9uUG9pbnRbXT5leHRlbnNpb24udmFsdWU7XG5cdFx0XHRcdGZvciAoY29uc3QgY29udHJpYnV0aW9uIG9mIGV4dGVuc2lvblZhbHVlKSB7XG5cdFx0XHRcdFx0dG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LmRlcmVnaXN0ZXJUb2tlblR5cGUoY29udHJpYnV0aW9uLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRva2VuTW9kaWZpZXJFeHRQb2ludC5zZXRIYW5kbGVyKChleHRlbnNpb25zLCBkZWx0YSkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZGVsdGEuYWRkZWQpIHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uVmFsdWUgPSA8SVRva2VuTW9kaWZpZXJFeHRlbnNpb25Qb2ludFtdPmV4dGVuc2lvbi52YWx1ZTtcblx0XHRcdFx0Y29uc3QgY29sbGVjdG9yID0gZXh0ZW5zaW9uLmNvbGxlY3RvcjtcblxuXHRcdFx0XHRpZiAoIWV4dGVuc2lvblZhbHVlIHx8ICFBcnJheS5pc0FycmF5KGV4dGVuc2lvblZhbHVlKSkge1xuXHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQuc2VtYW50aWNUb2tlbk1vZGlmaWVyQ29uZmlndXJhdGlvbicsIFwiJ2NvbmZpZ3VyYXRpb24uc2VtYW50aWNUb2tlbk1vZGlmaWVyJyBtdXN0IGJlIGFuIGFycmF5XCIpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChjb25zdCBjb250cmlidXRpb24gb2YgZXh0ZW5zaW9uVmFsdWUpIHtcblx0XHRcdFx0XHRpZiAodmFsaWRhdGVUeXBlT3JNb2RpZmllcihjb250cmlidXRpb24sICdzZW1hbnRpY1Rva2VuTW9kaWZpZXInLCBjb2xsZWN0b3IpKSB7XG5cdFx0XHRcdFx0XHR0b2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkucmVnaXN0ZXJUb2tlbk1vZGlmaWVyKGNvbnRyaWJ1dGlvbi5pZCwgY29udHJpYnV0aW9uLmRlc2NyaXB0aW9uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGRlbHRhLnJlbW92ZWQpIHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uVmFsdWUgPSA8SVRva2VuTW9kaWZpZXJFeHRlbnNpb25Qb2ludFtdPmV4dGVuc2lvbi52YWx1ZTtcblx0XHRcdFx0Zm9yIChjb25zdCBjb250cmlidXRpb24gb2YgZXh0ZW5zaW9uVmFsdWUpIHtcblx0XHRcdFx0XHR0b2tlbkNsYXNzaWZpY2F0aW9uUmVnaXN0cnkuZGVyZWdpc3RlclRva2VuTW9kaWZpZXIoY29udHJpYnV0aW9uLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRva2VuU3R5bGVEZWZhdWx0c0V4dFBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIGRlbHRhKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5hZGRlZCkge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25WYWx1ZSA9IDxJVG9rZW5TdHlsZURlZmF1bHRFeHRlbnNpb25Qb2ludFtdPmV4dGVuc2lvbi52YWx1ZTtcblx0XHRcdFx0Y29uc3QgY29sbGVjdG9yID0gZXh0ZW5zaW9uLmNvbGxlY3RvcjtcblxuXHRcdFx0XHRpZiAoIWV4dGVuc2lvblZhbHVlIHx8ICFBcnJheS5pc0FycmF5KGV4dGVuc2lvblZhbHVlKSkge1xuXHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQuc2VtYW50aWNUb2tlblNjb3Blcy5jb25maWd1cmF0aW9uJywgXCInY29uZmlndXJhdGlvbi5zZW1hbnRpY1Rva2VuU2NvcGVzJyBtdXN0IGJlIGFuIGFycmF5XCIpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChjb25zdCBjb250cmlidXRpb24gb2YgZXh0ZW5zaW9uVmFsdWUpIHtcblx0XHRcdFx0XHRpZiAoY29udHJpYnV0aW9uLmxhbmd1YWdlICYmIHR5cGVvZiBjb250cmlidXRpb24ubGFuZ3VhZ2UgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLnNlbWFudGljVG9rZW5TY29wZXMubGFuZ3VhZ2UnLCBcIidjb25maWd1cmF0aW9uLnNlbWFudGljVG9rZW5TY29wZXMubGFuZ3VhZ2UnIG11c3QgYmUgYSBzdHJpbmdcIikpO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICghY29udHJpYnV0aW9uLnNjb3BlcyB8fCB0eXBlb2YgY29udHJpYnV0aW9uLnNjb3BlcyAhPT0gJ29iamVjdCcpIHtcblx0XHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQuc2VtYW50aWNUb2tlblNjb3Blcy5zY29wZXMnLCBcIidjb25maWd1cmF0aW9uLnNlbWFudGljVG9rZW5TY29wZXMuc2NvcGVzJyBtdXN0IGJlIGRlZmluZWQgYXMgYW4gb2JqZWN0XCIpKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3IgKGNvbnN0IHNlbGVjdG9yU3RyaW5nIGluIGNvbnRyaWJ1dGlvbi5zY29wZXMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRtU2NvcGVzID0gY29udHJpYnV0aW9uLnNjb3Blc1tzZWxlY3RvclN0cmluZ107XG5cdFx0XHRcdFx0XHRpZiAoIUFycmF5LmlzQXJyYXkodG1TY29wZXMpIHx8IHRtU2NvcGVzLnNvbWUobCA9PiB0eXBlb2YgbCAhPT0gJ3N0cmluZycpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQuc2VtYW50aWNUb2tlblNjb3Blcy5zY29wZXMudmFsdWUnLCBcIidjb25maWd1cmF0aW9uLnNlbWFudGljVG9rZW5TY29wZXMuc2NvcGVzJyB2YWx1ZXMgbXVzdCBiZSBhbiBhcnJheSBvZiBzdHJpbmdzXCIpKTtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzZWxlY3RvciA9IHRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeS5wYXJzZVRva2VuU2VsZWN0b3Ioc2VsZWN0b3JTdHJpbmcsIGNvbnRyaWJ1dGlvbi5sYW5ndWFnZSk7XG5cdFx0XHRcdFx0XHRcdHRva2VuQ2xhc3NpZmljYXRpb25SZWdpc3RyeS5yZWdpc3RlclRva2VuU3R5bGVEZWZhdWx0KHNlbGVjdG9yLCB7IHNjb3Blc1RvUHJvYmU6IHRtU2NvcGVzLm1hcChzID0+IHMuc3BsaXQoJyAnKSkgfSk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQuc2VtYW50aWNUb2tlblNjb3Blcy5zY29wZXMuc2VsZWN0b3InLCBcImNvbmZpZ3VyYXRpb24uc2VtYW50aWNUb2tlblNjb3Blcy5zY29wZXMnOiBQcm9ibGVtcyBwYXJzaW5nIHNlbGVjdG9yIHswfS5cIiwgc2VsZWN0b3JTdHJpbmcpKTtcblx0XHRcdFx0XHRcdFx0Ly8gaW52YWxpZCBzZWxlY3RvciwgaWdub3JlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5yZW1vdmVkKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvblZhbHVlID0gPElUb2tlblN0eWxlRGVmYXVsdEV4dGVuc2lvblBvaW50W10+ZXh0ZW5zaW9uLnZhbHVlO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNvbnRyaWJ1dGlvbiBvZiBleHRlbnNpb25WYWx1ZSkge1xuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2VsZWN0b3JTdHJpbmcgaW4gY29udHJpYnV0aW9uLnNjb3Blcykge1xuXHRcdFx0XHRcdFx0Y29uc3QgdG1TY29wZXMgPSBjb250cmlidXRpb24uc2NvcGVzW3NlbGVjdG9yU3RyaW5nXTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHNlbGVjdG9yID0gdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LnBhcnNlVG9rZW5TZWxlY3RvcihzZWxlY3RvclN0cmluZywgY29udHJpYnV0aW9uLmxhbmd1YWdlKTtcblx0XHRcdFx0XHRcdFx0dG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyVG9rZW5TdHlsZURlZmF1bHQoc2VsZWN0b3IsIHsgc2NvcGVzVG9Qcm9iZTogdG1TY29wZXMubWFwKHMgPT4gcy5zcGxpdCgnICcpKSB9KTtcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdFx0Ly8gaW52YWxpZCBzZWxlY3RvciwgaWdub3JlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuXG5cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDBCQUFxRDtBQUM5RCxTQUFTLGdDQUE4RCxnQ0FBZ0M7QUFrQnZHLE1BQU0sOEJBQTRELCtCQUErQjtBQUVqRyxNQUFNLG9CQUFvQixtQkFBbUIsdUJBQW1EO0FBQUEsRUFDL0YsZ0JBQWdCO0FBQUEsRUFDaEIsWUFBWTtBQUFBLElBQ1gsYUFBYSxJQUFJLFNBQVMsa0NBQWtDLG1DQUFtQztBQUFBLElBQy9GLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLFlBQVk7QUFBQSxRQUNYLElBQUk7QUFBQSxVQUNILE1BQU07QUFBQSxVQUNOLGFBQWEsSUFBSSxTQUFTLHFDQUFxQywyQ0FBMkM7QUFBQSxVQUMxRyxTQUFTO0FBQUEsVUFDVCxxQkFBcUIsSUFBSSxTQUFTLDRDQUE0QyxtRUFBbUU7QUFBQSxRQUNsSjtBQUFBLFFBQ0EsV0FBVztBQUFBLFVBQ1YsTUFBTTtBQUFBLFVBQ04sYUFBYSxJQUFJLFNBQVMsNENBQTRDLDJDQUEyQztBQUFBLFVBQ2pILFNBQVM7QUFBQSxVQUNULHFCQUFxQixJQUFJLFNBQVMsbURBQW1ELG1FQUFtRTtBQUFBLFFBQ3pKO0FBQUEsUUFDQSxhQUFhO0FBQUEsVUFDWixNQUFNO0FBQUEsVUFDTixhQUFhLElBQUksU0FBUyxpQ0FBaUMsNENBQTRDO0FBQUEsUUFDeEc7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBRUQsTUFBTSx3QkFBd0IsbUJBQW1CLHVCQUF1RDtBQUFBLEVBQ3ZHLGdCQUFnQjtBQUFBLEVBQ2hCLFlBQVk7QUFBQSxJQUNYLGFBQWEsSUFBSSxTQUFTLHNDQUFzQyx1Q0FBdUM7QUFBQSxJQUN2RyxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTixN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
