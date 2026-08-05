import * as nls from "../../../../nls.js";
const idDescription = nls.localize("JsonSchema.input.id", "The input's id is used to associate an input with a variable of the form ${input:id}.");
const typeDescription = nls.localize("JsonSchema.input.type", "The type of user input prompt to use.");
const descriptionDescription = nls.localize("JsonSchema.input.description", "The description is shown when the user is prompted for input.");
const defaultDescription = nls.localize("JsonSchema.input.default", "The default value for the input.");
const inputsSchema = {
  definitions: {
    inputs: {
      type: "array",
      description: nls.localize("JsonSchema.inputs", "User inputs. Used for defining user input prompts, such as free string input or a choice from several options."),
      items: {
        oneOf: [
          {
            type: "object",
            required: ["id", "type", "description"],
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
                description: idDescription
              },
              type: {
                type: "string",
                description: typeDescription,
                enum: ["promptString"],
                enumDescriptions: [
                  nls.localize("JsonSchema.input.type.promptString", "The 'promptString' type opens an input box to ask the user for input.")
                ]
              },
              description: {
                type: "string",
                description: descriptionDescription
              },
              default: {
                type: "string",
                description: defaultDescription
              },
              password: {
                type: "boolean",
                description: nls.localize("JsonSchema.input.password", "Controls if a password input is shown. Password input hides the typed text.")
              }
            }
          },
          {
            type: "object",
            required: ["id", "type", "description", "options"],
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
                description: idDescription
              },
              type: {
                type: "string",
                description: typeDescription,
                enum: ["pickString"],
                enumDescriptions: [
                  nls.localize("JsonSchema.input.type.pickString", "The 'pickString' type shows a selection list.")
                ]
              },
              description: {
                type: "string",
                description: descriptionDescription
              },
              default: {
                type: "string",
                description: defaultDescription
              },
              options: {
                type: "array",
                description: nls.localize("JsonSchema.input.options", "An array of strings that defines the options for a quick pick."),
                items: {
                  oneOf: [
                    {
                      type: "string"
                    },
                    {
                      type: "object",
                      required: ["value"],
                      additionalProperties: false,
                      properties: {
                        label: {
                          type: "string",
                          description: nls.localize("JsonSchema.input.pickString.optionLabel", "Label for the option.")
                        },
                        value: {
                          type: "string",
                          description: nls.localize("JsonSchema.input.pickString.optionValue", "Value for the option.")
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          {
            type: "object",
            required: ["id", "type", "command"],
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
                description: idDescription
              },
              type: {
                type: "string",
                description: typeDescription,
                enum: ["command"],
                enumDescriptions: [
                  nls.localize("JsonSchema.input.type.command", "The 'command' type executes a command.")
                ]
              },
              command: {
                type: "string",
                description: nls.localize("JsonSchema.input.command.command", "The command to execute for this input variable.")
              },
              args: {
                oneOf: [
                  {
                    type: "object",
                    description: nls.localize("JsonSchema.input.command.args", "Optional arguments passed to the command.")
                  },
                  {
                    type: "array",
                    description: nls.localize("JsonSchema.input.command.args", "Optional arguments passed to the command.")
                  },
                  {
                    type: "string",
                    description: nls.localize("JsonSchema.input.command.args", "Optional arguments passed to the command.")
                  }
                ]
              }
            }
          }
        ]
      }
    }
  }
};
export {
  inputsSchema
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXJTY2hlbWEudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5cbmNvbnN0IGlkRGVzY3JpcHRpb24gPSBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQuaWQnLCBcIlRoZSBpbnB1dCdzIGlkIGlzIHVzZWQgdG8gYXNzb2NpYXRlIGFuIGlucHV0IHdpdGggYSB2YXJpYWJsZSBvZiB0aGUgZm9ybSAke2lucHV0OmlkfS5cIik7XG5jb25zdCB0eXBlRGVzY3JpcHRpb24gPSBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQudHlwZScsIFwiVGhlIHR5cGUgb2YgdXNlciBpbnB1dCBwcm9tcHQgdG8gdXNlLlwiKTtcbmNvbnN0IGRlc2NyaXB0aW9uRGVzY3JpcHRpb24gPSBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQuZGVzY3JpcHRpb24nLCBcIlRoZSBkZXNjcmlwdGlvbiBpcyBzaG93biB3aGVuIHRoZSB1c2VyIGlzIHByb21wdGVkIGZvciBpbnB1dC5cIik7XG5jb25zdCBkZWZhdWx0RGVzY3JpcHRpb24gPSBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQuZGVmYXVsdCcsIFwiVGhlIGRlZmF1bHQgdmFsdWUgZm9yIHRoZSBpbnB1dC5cIik7XG5cblxuZXhwb3J0IGNvbnN0IGlucHV0c1NjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdGRlZmluaXRpb25zOiB7XG5cdFx0aW5wdXRzOiB7XG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5pbnB1dHMnLCAnVXNlciBpbnB1dHMuIFVzZWQgZm9yIGRlZmluaW5nIHVzZXIgaW5wdXQgcHJvbXB0cywgc3VjaCBhcyBmcmVlIHN0cmluZyBpbnB1dCBvciBhIGNob2ljZSBmcm9tIHNldmVyYWwgb3B0aW9ucy4nKSxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRyZXF1aXJlZDogWydpZCcsICd0eXBlJywgJ2Rlc2NyaXB0aW9uJ10sXG5cdFx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGlkRGVzY3JpcHRpb25cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0dHlwZToge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiB0eXBlRGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0XHRcdFx0ZW51bTogWydwcm9tcHRTdHJpbmcnXSxcblx0XHRcdFx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQudHlwZS5wcm9tcHRTdHJpbmcnLCBcIlRoZSAncHJvbXB0U3RyaW5nJyB0eXBlIG9wZW5zIGFuIGlucHV0IGJveCB0byBhc2sgdGhlIHVzZXIgZm9yIGlucHV0LlwiKSxcblx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uRGVzY3JpcHRpb25cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBkZWZhdWx0RGVzY3JpcHRpb25cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0cGFzc3dvcmQ6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5pbnB1dC5wYXNzd29yZCcsIFwiQ29udHJvbHMgaWYgYSBwYXNzd29yZCBpbnB1dCBpcyBzaG93bi4gUGFzc3dvcmQgaW5wdXQgaGlkZXMgdGhlIHR5cGVkIHRleHQuXCIpLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRyZXF1aXJlZDogWydpZCcsICd0eXBlJywgJ2Rlc2NyaXB0aW9uJywgJ29wdGlvbnMnXSxcblx0XHRcdFx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogaWREZXNjcmlwdGlvblxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR0eXBlOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IHR5cGVEZXNjcmlwdGlvbixcblx0XHRcdFx0XHRcdFx0XHRlbnVtOiBbJ3BpY2tTdHJpbmcnXSxcblx0XHRcdFx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQudHlwZS5waWNrU3RyaW5nJywgXCJUaGUgJ3BpY2tTdHJpbmcnIHR5cGUgc2hvd3MgYSBzZWxlY3Rpb24gbGlzdC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbkRlc2NyaXB0aW9uXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogZGVmYXVsdERlc2NyaXB0aW9uXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQub3B0aW9ucycsIFwiQW4gYXJyYXkgb2Ygc3RyaW5ncyB0aGF0IGRlZmluZXMgdGhlIG9wdGlvbnMgZm9yIGEgcXVpY2sgcGljay5cIiksXG5cdFx0XHRcdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsndmFsdWUnXSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQucGlja1N0cmluZy5vcHRpb25MYWJlbCcsIFwiTGFiZWwgZm9yIHRoZSBvcHRpb24uXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dmFsdWU6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQucGlja1N0cmluZy5vcHRpb25WYWx1ZScsIFwiVmFsdWUgZm9yIHRoZSBvcHRpb24uXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2lkJywgJ3R5cGUnLCAnY29tbWFuZCddLFxuXHRcdFx0XHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRpZDoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBpZERlc2NyaXB0aW9uXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHR5cGU6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogdHlwZURlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdFx0XHRcdGVudW06IFsnY29tbWFuZCddLFxuXHRcdFx0XHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5pbnB1dC50eXBlLmNvbW1hbmQnLCBcIlRoZSAnY29tbWFuZCcgdHlwZSBleGVjdXRlcyBhIGNvbW1hbmQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQuY29tbWFuZC5jb21tYW5kJywgXCJUaGUgY29tbWFuZCB0byBleGVjdXRlIGZvciB0aGlzIGlucHV0IHZhcmlhYmxlLlwiKVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRhcmdzOiB7XG5cdFx0XHRcdFx0XHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEuaW5wdXQuY29tbWFuZC5hcmdzJywgXCJPcHRpb25hbCBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBjb21tYW5kLlwiKVxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5pbnB1dC5jb21tYW5kLmFyZ3MnLCBcIk9wdGlvbmFsIGFyZ3VtZW50cyBwYXNzZWQgdG8gdGhlIGNvbW1hbmQuXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS5pbnB1dC5jb21tYW5kLmFyZ3MnLCBcIk9wdGlvbmFsIGFyZ3VtZW50cyBwYXNzZWQgdG8gdGhlIGNvbW1hbmQuXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBR3JCLE1BQU0sZ0JBQWdCLElBQUksU0FBUyx1QkFBdUIsdUZBQXVGO0FBQ2pK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
