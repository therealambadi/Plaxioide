import { Extensions as JSONExtensions } from "../../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
const toolsParametersSchemaSchemaId = "vscode://schemas/toolsParameters";
const toolsParametersSchemaSchema = {
  definitions: {
    schemaArray: {
      type: "array",
      minItems: 1,
      items: {
        $ref: "#"
      }
    },
    nonNegativeInteger: {
      type: "integer",
      minimum: 0
    },
    nonNegativeIntegerDefault0: {
      allOf: [
        {
          $ref: "#/definitions/nonNegativeInteger"
        },
        {
          default: 0
        }
      ]
    },
    simpleTypes: {
      enum: [
        "array",
        "boolean",
        "integer",
        "null",
        "number",
        "object",
        "string"
      ]
    },
    stringArray: {
      type: "array",
      items: {
        type: "string"
      },
      uniqueItems: true,
      default: []
    }
  },
  type: ["object"],
  properties: {
    $id: {
      type: "string",
      format: "uri-reference"
    },
    $schema: {
      type: "string",
      format: "uri"
    },
    $ref: {
      type: "string",
      format: "uri-reference"
    },
    $comment: {
      type: "string"
    },
    title: {
      type: "string"
    },
    description: {
      type: "string"
    },
    readOnly: {
      type: "boolean",
      default: false
    },
    writeOnly: {
      type: "boolean",
      default: false
    },
    multipleOf: {
      type: "number",
      exclusiveMinimum: 0
    },
    maximum: {
      type: "number"
    },
    exclusiveMaximum: {
      type: "number"
    },
    minimum: {
      type: "number"
    },
    exclusiveMinimum: {
      type: "number"
    },
    maxLength: {
      $ref: "#/definitions/nonNegativeInteger"
    },
    minLength: {
      $ref: "#/definitions/nonNegativeIntegerDefault0"
    },
    pattern: {
      type: "string",
      format: "regex"
    },
    additionalItems: {
      $ref: "#"
    },
    items: {
      anyOf: [
        {
          $ref: "#"
        },
        {
          $ref: "#/definitions/schemaArray"
        }
      ],
      default: true
    },
    maxItems: {
      $ref: "#/definitions/nonNegativeInteger"
    },
    minItems: {
      $ref: "#/definitions/nonNegativeIntegerDefault0"
    },
    uniqueItems: {
      type: "boolean",
      default: false
    },
    contains: {
      $ref: "#"
    },
    maxProperties: {
      $ref: "#/definitions/nonNegativeInteger"
    },
    minProperties: {
      $ref: "#/definitions/nonNegativeIntegerDefault0"
    },
    required: {
      $ref: "#/definitions/stringArray"
    },
    additionalProperties: {
      $ref: "#"
    },
    definitions: {
      type: "object",
      additionalProperties: {
        $ref: "#"
      },
      default: {}
    },
    properties: {
      type: "object",
      additionalProperties: {
        $ref: "#"
      },
      default: {}
    },
    patternProperties: {
      type: "object",
      additionalProperties: {
        $ref: "#"
      },
      propertyNames: {
        format: "regex"
      },
      default: {}
    },
    dependencies: {
      type: "object",
      additionalProperties: {
        anyOf: [
          {
            $ref: "#"
          },
          {
            $ref: "#/definitions/stringArray"
          }
        ]
      }
    },
    propertyNames: {
      $ref: "#"
    },
    enum: {
      type: "array",
      minItems: 1,
      uniqueItems: true
    },
    type: {
      anyOf: [
        {
          $ref: "#/definitions/simpleTypes"
        },
        {
          type: "array",
          items: {
            $ref: "#/definitions/simpleTypes"
          },
          minItems: 1,
          uniqueItems: true
        }
      ]
    },
    format: {
      type: "string"
    },
    contentMediaType: {
      type: "string"
    },
    contentEncoding: {
      type: "string"
    },
    if: {
      $ref: "#"
    },
    then: {
      $ref: "#"
    },
    else: {
      $ref: "#"
    },
    allOf: {
      $ref: "#/definitions/schemaArray"
    },
    anyOf: {
      $ref: "#/definitions/schemaArray"
    },
    oneOf: {
      $ref: "#/definitions/schemaArray"
    },
    not: {
      $ref: "#"
    }
  },
  defaultSnippets: [{
    body: {
      type: "object",
      properties: {
        "${1:paramName}": {
          type: "string",
          description: "${2:description}"
        }
      }
    }
  }]
};
const contributionRegistry = Registry.as(JSONExtensions.JSONContribution);
contributionRegistry.registerSchema(toolsParametersSchemaSchemaId, toolsParametersSchemaSchema);
export {
  toolsParametersSchemaSchemaId
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi90b29scy9sYW5ndWFnZU1vZGVsVG9vbHNQYXJhbWV0ZXJzU2NoZW1hLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUpTT05TY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgSlNPTkV4dGVuc2lvbnMsIElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9qc29uc2NoZW1hcy9jb21tb24vanNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcblxuLyoqXG4gKiBBIHNjaGVtYSBmb3IgcGFyYW1ldGVyc1NjaGVtYVxuICogVGhpcyBpcyBhIHN1YnNldCBvZiBodHRwczovL2pzb24tc2NoZW1hLm9yZy9kcmFmdC0wNy9zY2hlbWEgdG8gY2FwdHVyZSB3aGF0IGlzIGFjdHVhbGx5IHN1cHBvcnRlZCBieSBsYW5ndWFnZSBtb2RlbHMgZm9yIHRvb2xzLCBtYWlubHksIHRoYXQgdGhleSBtdXN0IGJlIGFuIG9iamVjdCBhdCB0aGUgdG9wIGxldmVsLlxuICogUG9zc2libHkgaXQgY2FuIGJlIHdoaXR0bGVkIGRvd24gc29tZSBtb3JlIGJhc2VkIG9uIHdoaWNoIGF0dHJpYnV0ZXMgYXJlIHN1cHBvcnRlZCBieSBsYW5ndWFnZSBtb2RlbHMuXG4gKi9cbmV4cG9ydCBjb25zdCB0b29sc1BhcmFtZXRlcnNTY2hlbWFTY2hlbWFJZCA9ICd2c2NvZGU6Ly9zY2hlbWFzL3Rvb2xzUGFyYW1ldGVycyc7XG5jb25zdCB0b29sc1BhcmFtZXRlcnNTY2hlbWFTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRkZWZpbml0aW9uczoge1xuXHRcdHNjaGVtYUFycmF5OiB7XG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0bWluSXRlbXM6IDEsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHQkcmVmOiAnIydcblx0XHRcdH1cblx0XHR9LFxuXHRcdG5vbk5lZ2F0aXZlSW50ZWdlcjoge1xuXHRcdFx0dHlwZTogJ2ludGVnZXInLFxuXHRcdFx0bWluaW11bTogMFxuXHRcdH0sXG5cdFx0bm9uTmVnYXRpdmVJbnRlZ2VyRGVmYXVsdDA6IHtcblx0XHRcdGFsbE9mOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9ub25OZWdhdGl2ZUludGVnZXInXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRkZWZhdWx0OiAwXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9LFxuXHRcdHNpbXBsZVR5cGVzOiB7XG5cdFx0XHRlbnVtOiBbXG5cdFx0XHRcdCdhcnJheScsXG5cdFx0XHRcdCdib29sZWFuJyxcblx0XHRcdFx0J2ludGVnZXInLFxuXHRcdFx0XHQnbnVsbCcsXG5cdFx0XHRcdCdudW1iZXInLFxuXHRcdFx0XHQnb2JqZWN0Jyxcblx0XHRcdFx0J3N0cmluZydcblx0XHRcdF1cblx0XHR9LFxuXHRcdHN0cmluZ0FycmF5OiB7XG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdH0sXG5cdFx0XHR1bmlxdWVJdGVtczogdHJ1ZSxcblx0XHRcdGRlZmF1bHQ6IFtdXG5cdFx0fVxuXHR9LFxuXHR0eXBlOiBbJ29iamVjdCddLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0JGlkOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGZvcm1hdDogJ3VyaS1yZWZlcmVuY2UnXG5cdFx0fSxcblx0XHQkc2NoZW1hOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGZvcm1hdDogJ3VyaSdcblx0XHR9LFxuXHRcdCRyZWY6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0Zm9ybWF0OiAndXJpLXJlZmVyZW5jZSdcblx0XHR9LFxuXHRcdCRjb21tZW50OiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0dGl0bGU6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0fSxcblx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9LFxuXHRcdHJlYWRPbmx5OiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0d3JpdGVPbmx5OiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0bXVsdGlwbGVPZjoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRleGNsdXNpdmVNaW5pbXVtOiAwXG5cdFx0fSxcblx0XHRtYXhpbXVtOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJ1xuXHRcdH0sXG5cdFx0ZXhjbHVzaXZlTWF4aW11bToge1xuXHRcdFx0dHlwZTogJ251bWJlcidcblx0XHR9LFxuXHRcdG1pbmltdW06IHtcblx0XHRcdHR5cGU6ICdudW1iZXInXG5cdFx0fSxcblx0XHRleGNsdXNpdmVNaW5pbXVtOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJ1xuXHRcdH0sXG5cdFx0bWF4TGVuZ3RoOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9ub25OZWdhdGl2ZUludGVnZXInXG5cdFx0fSxcblx0XHRtaW5MZW5ndGg6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL25vbk5lZ2F0aXZlSW50ZWdlckRlZmF1bHQwJ1xuXHRcdH0sXG5cdFx0cGF0dGVybjoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRmb3JtYXQ6ICdyZWdleCdcblx0XHR9LFxuXHRcdGFkZGl0aW9uYWxJdGVtczoge1xuXHRcdFx0JHJlZjogJyMnXG5cdFx0fSxcblx0XHRpdGVtczoge1xuXHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdCRyZWY6ICcjJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvc2NoZW1hQXJyYXknXG5cdFx0XHRcdH1cblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHRtYXhJdGVtczoge1xuXHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvbm9uTmVnYXRpdmVJbnRlZ2VyJ1xuXHRcdH0sXG5cdFx0bWluSXRlbXM6IHtcblx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL25vbk5lZ2F0aXZlSW50ZWdlckRlZmF1bHQwJ1xuXHRcdH0sXG5cdFx0dW5pcXVlSXRlbXM6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0fSxcblx0XHRjb250YWluczoge1xuXHRcdFx0JHJlZjogJyMnXG5cdFx0fSxcblx0XHRtYXhQcm9wZXJ0aWVzOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9ub25OZWdhdGl2ZUludGVnZXInXG5cdFx0fSxcblx0XHRtaW5Qcm9wZXJ0aWVzOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9ub25OZWdhdGl2ZUludGVnZXJEZWZhdWx0MCdcblx0XHR9LFxuXHRcdHJlcXVpcmVkOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9zdHJpbmdBcnJheSdcblx0XHR9LFxuXHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHQkcmVmOiAnIydcblx0XHR9LFxuXHRcdGRlZmluaXRpb25zOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCRyZWY6ICcjJ1xuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHt9XG5cdFx0fSxcblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCRyZWY6ICcjJ1xuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHt9XG5cdFx0fSxcblx0XHRwYXR0ZXJuUHJvcGVydGllczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHQkcmVmOiAnIydcblx0XHRcdH0sXG5cdFx0XHRwcm9wZXJ0eU5hbWVzOiB7XG5cdFx0XHRcdGZvcm1hdDogJ3JlZ2V4J1xuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHt9XG5cdFx0fSxcblx0XHRkZXBlbmRlbmNpZXM6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHQkcmVmOiAnIydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3N0cmluZ0FycmF5J1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0cHJvcGVydHlOYW1lczoge1xuXHRcdFx0JHJlZjogJyMnXG5cdFx0fSxcblx0XHRlbnVtOiB7XG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0bWluSXRlbXM6IDEsXG5cdFx0XHR1bmlxdWVJdGVtczogdHJ1ZVxuXHRcdH0sXG5cdFx0dHlwZToge1xuXHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3NpbXBsZVR5cGVzJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvc2ltcGxlVHlwZXMnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRtaW5JdGVtczogMSxcblx0XHRcdFx0XHR1bmlxdWVJdGVtczogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHRmb3JtYXQ6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0fSxcblx0XHRjb250ZW50TWVkaWFUeXBlOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0Y29udGVudEVuY29kaW5nOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0aWY6IHtcblx0XHRcdCRyZWY6ICcjJ1xuXHRcdH0sXG5cdFx0dGhlbjoge1xuXHRcdFx0JHJlZjogJyMnXG5cdFx0fSxcblx0XHRlbHNlOiB7XG5cdFx0XHQkcmVmOiAnIydcblx0XHR9LFxuXHRcdGFsbE9mOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9zY2hlbWFBcnJheSdcblx0XHR9LFxuXHRcdGFueU9mOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9zY2hlbWFBcnJheSdcblx0XHR9LFxuXHRcdG9uZU9mOiB7XG5cdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy9zY2hlbWFBcnJheSdcblx0XHR9LFxuXHRcdG5vdDoge1xuXHRcdFx0JHJlZjogJyMnXG5cdFx0fVxuXHR9LFxuXHRkZWZhdWx0U25pcHBldHM6IFt7XG5cdFx0Ym9keToge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCckezE6cGFyYW1OYW1lfSc6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJyR7MjpkZXNjcmlwdGlvbn0nXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHR9XSxcbn07XG5jb25zdCBjb250cmlidXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+KEpTT05FeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuY29udHJpYnV0aW9uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEodG9vbHNQYXJhbWV0ZXJzU2NoZW1hU2NoZW1hSWQsIHRvb2xzUGFyYW1ldGVyc1NjaGVtYVNjaGVtYSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLGNBQWMsc0JBQWlEO0FBQ3hFLFNBQVMsZ0JBQWdCO0FBT2xCLE1BQU0sZ0NBQWdDO0FBQzdDLE1BQU0sOEJBQTJDO0FBQUEsRUFDaEQsYUFBYTtBQUFBLElBQ1osYUFBYTtBQUFBLE1BQ1osTUFBTTtBQUFBLE1BQ04sVUFBVTtBQUFBLE1BQ1YsT0FBTztBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsSUFDQSxvQkFBb0I7QUFBQSxNQUNuQixNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsSUFDVjtBQUFBLElBQ0EsNEJBQTRCO0FBQUEsTUFDM0IsT0FBTztBQUFBLFFBQ047QUFBQSxVQUNDLE1BQU07QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFFBQ1Y7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLElBQ0Es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
