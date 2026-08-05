import { localize } from "../../../../nls.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
const titleTranslated = localize("title", "Title");
const walkthroughsExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "walkthroughs",
  jsonSchema: {
    description: localize("walkthroughs", "Contribute walkthroughs to help users getting started with your extension."),
    type: "array",
    items: {
      type: "object",
      required: ["id", "title", "description", "steps"],
      defaultSnippets: [{ body: { "id": "$1", "title": "$2", "description": "$3", "steps": [] } }],
      properties: {
        id: {
          type: "string",
          description: localize("walkthroughs.id", "Unique identifier for this walkthrough.")
        },
        title: {
          type: "string",
          description: localize("walkthroughs.title", "Title of walkthrough.")
        },
        icon: {
          type: "string",
          description: localize("walkthroughs.icon", "Relative path to the icon of the walkthrough. The path is relative to the extension location. If not specified, the icon defaults to the extension icon if available.")
        },
        description: {
          type: "string",
          description: localize("walkthroughs.description", "Description of walkthrough.")
        },
        featuredFor: {
          type: "array",
          description: localize("walkthroughs.featuredFor", "Walkthroughs that match one of these glob patterns appear as 'featured' in workspaces with the specified files. For example, a walkthrough for TypeScript projects might specify `tsconfig.json` here."),
          items: {
            type: "string"
          }
        },
        when: {
          type: "string",
          description: localize("walkthroughs.when", "Context key expression to control the visibility of this walkthrough.")
        },
        steps: {
          type: "array",
          description: localize("walkthroughs.steps", "Steps to complete as part of this walkthrough."),
          items: {
            type: "object",
            required: ["id", "title", "media"],
            defaultSnippets: [{
              body: {
                "id": "$1",
                "title": "$2",
                "description": "$3",
                "completionEvents": ["$5"],
                "media": {}
              }
            }],
            properties: {
              id: {
                type: "string",
                description: localize("walkthroughs.steps.id", "Unique identifier for this step. This is used to keep track of which steps have been completed.")
              },
              title: {
                type: "string",
                description: localize("walkthroughs.steps.title", "Title of step.")
              },
              description: {
                type: "string",
                description: localize("walkthroughs.steps.description.interpolated", "Description of step. Supports ``preformatted``, __italic__, and **bold** text. Use markdown-style links for commands or external links: {0}, {1}, or {2}. Links on their own line will be rendered as buttons.", `[${titleTranslated}](command:myext.command)`, `[${titleTranslated}](command:toSide:myext.command)`, `[${titleTranslated}](https://aka.ms)`)
              },
              button: {
                deprecationMessage: localize("walkthroughs.steps.button.deprecated.interpolated", "Deprecated. Use markdown links in the description instead, i.e. {0}, {1}, or {2}", `[${titleTranslated}](command:myext.command)`, `[${titleTranslated}](command:toSide:myext.command)`, `[${titleTranslated}](https://aka.ms)`)
              },
              media: {
                type: "object",
                description: localize("walkthroughs.steps.media", "Media to show alongside this step, either an image or markdown content."),
                oneOf: [
                  {
                    required: ["image", "altText"],
                    additionalProperties: false,
                    properties: {
                      path: {
                        deprecationMessage: localize("pathDeprecated", "Deprecated. Please use `image` or `markdown` instead")
                      },
                      image: {
                        description: localize("walkthroughs.steps.media.image.path.string", "Path to an image - or object consisting of paths to light, dark, and hc images - relative to extension directory. Depending on context, the image will be displayed from 400px to 800px wide, with similar bounds on height. To support HIDPI displays, the image will be rendered at 1.5x scaling, for example a 900 physical pixels wide image will be displayed as 600 logical pixels wide."),
                        oneOf: [
                          {
                            type: "string"
                          },
                          {
                            type: "object",
                            required: ["dark", "light", "hc", "hcLight"],
                            properties: {
                              dark: {
                                description: localize("walkthroughs.steps.media.image.path.dark.string", "Path to the image for dark themes, relative to extension directory."),
                                type: "string"
                              },
                              light: {
                                description: localize("walkthroughs.steps.media.image.path.light.string", "Path to the image for light themes, relative to extension directory."),
                                type: "string"
                              },
                              hc: {
                                description: localize("walkthroughs.steps.media.image.path.hc.string", "Path to the image for hc themes, relative to extension directory."),
                                type: "string"
                              },
                              hcLight: {
                                description: localize("walkthroughs.steps.media.image.path.hcLight.string", "Path to the image for hc light themes, relative to extension directory."),
                                type: "string"
                              }
                            }
                          }
                        ]
                      },
                      altText: {
                        type: "string",
                        description: localize("walkthroughs.steps.media.altText", "Alternate text to display when the image cannot be loaded or in screen readers.")
                      }
                    }
                  },
                  {
                    required: ["svg", "altText"],
                    additionalProperties: false,
                    properties: {
                      svg: {
                        description: localize("walkthroughs.steps.media.image.path.svg", "Path to an svg, color tokens are supported in variables to support theming to match the workbench."),
                        type: "string"
                      },
                      altText: {
                        type: "string",
                        description: localize("walkthroughs.steps.media.altText", "Alternate text to display when the image cannot be loaded or in screen readers.")
                      }
                    }
                  },
                  {
                    required: ["markdown"],
                    additionalProperties: false,
                    properties: {
                      path: {
                        deprecationMessage: localize("pathDeprecated", "Deprecated. Please use `image` or `markdown` instead")
                      },
                      markdown: {
                        description: localize("walkthroughs.steps.media.markdown.path", "Path to the markdown document, relative to extension directory."),
                        type: "string"
                      }
                    }
                  }
                ]
              },
              completionEvents: {
                description: localize("walkthroughs.steps.completionEvents", "Events that should trigger this step to become checked off. If empty or not defined, the step will check off when any of the step's buttons or links are clicked; if the step has no buttons or links it will check on when it is selected."),
                type: "array",
                items: {
                  type: "string",
                  defaultSnippets: [
                    {
                      label: "onCommand",
                      description: localize("walkthroughs.steps.completionEvents.onCommand", "Check off step when a given command is executed anywhere in VS Code."),
                      body: "onCommand:${1:commandId}"
                    },
                    {
                      label: "onLink",
                      description: localize("walkthroughs.steps.completionEvents.onLink", "Check off step when a given link is opened via a walkthrough step."),
                      body: "onLink:${2:linkId}"
                    },
                    {
                      label: "onView",
                      description: localize("walkthroughs.steps.completionEvents.onView", "Check off step when a given view is opened"),
                      body: "onView:${2:viewId}"
                    },
                    {
                      label: "onSettingChanged",
                      description: localize("walkthroughs.steps.completionEvents.onSettingChanged", "Check off step when a given setting is changed"),
                      body: "onSettingChanged:${2:settingName}"
                    },
                    {
                      label: "onContext",
                      description: localize("walkthroughs.steps.completionEvents.onContext", "Check off step when a context key expression is true."),
                      body: "onContext:${2:key}"
                    },
                    {
                      label: "onExtensionInstalled",
                      description: localize("walkthroughs.steps.completionEvents.extensionInstalled", "Check off step when an extension with the given id is installed. If the extension is already installed, the step will start off checked."),
                      body: "onExtensionInstalled:${3:extensionId}"
                    },
                    {
                      label: "onStepSelected",
                      description: localize("walkthroughs.steps.completionEvents.stepSelected", "Check off step as soon as it is selected."),
                      body: "onStepSelected"
                    }
                  ]
                }
              },
              doneOn: {
                description: localize("walkthroughs.steps.doneOn", "Signal to mark step as complete."),
                deprecationMessage: localize("walkthroughs.steps.doneOn.deprecation", "doneOn is deprecated. By default steps will be checked off when their buttons are clicked, to configure further use completionEvents"),
                type: "object",
                required: ["command"],
                defaultSnippets: [{ "body": { command: "$1" } }],
                properties: {
                  "command": {
                    description: localize("walkthroughs.steps.oneOn.command", "Mark step done when the specified command is executed."),
                    type: "string"
                  }
                }
              },
              when: {
                type: "string",
                description: localize("walkthroughs.steps.when", "Context key expression to control the visibility of this step.")
              }
            }
          }
        }
      }
    }
  },
  activationEventsGenerator: (walkthroughContributions, result) => {
    for (const walkthroughContribution of walkthroughContributions) {
      if (walkthroughContribution.id) {
        result.push(`onWalkthrough:${walkthroughContribution.id}`);
      }
    }
  }
});
export {
  walkthroughsExtensionPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvYnJvd3Nlci9nZXR0aW5nU3RhcnRlZEV4dGVuc2lvblBvaW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVdhbGt0aHJvdWdoIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuXG5jb25zdCB0aXRsZVRyYW5zbGF0ZWQgPSBsb2NhbGl6ZSgndGl0bGUnLCBcIlRpdGxlXCIpO1xuXG5leHBvcnQgY29uc3Qgd2Fsa3Rocm91Z2hzRXh0ZW5zaW9uUG9pbnQgPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxJV2Fsa3Rocm91Z2hbXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ3dhbGt0aHJvdWdocycsXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocycsIFwiQ29udHJpYnV0ZSB3YWxrdGhyb3VnaHMgdG8gaGVscCB1c2VycyBnZXR0aW5nIHN0YXJ0ZWQgd2l0aCB5b3VyIGV4dGVuc2lvbi5cIiksXG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRpdGVtczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRyZXF1aXJlZDogWydpZCcsICd0aXRsZScsICdkZXNjcmlwdGlvbicsICdzdGVwcyddLFxuXHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbeyBib2R5OiB7ICdpZCc6ICckMScsICd0aXRsZSc6ICckMicsICdkZXNjcmlwdGlvbic6ICckMycsICdzdGVwcyc6IFtdIH0gfV0sXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuaWQnLCBcIlVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGlzIHdhbGt0aHJvdWdoLlwiKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy50aXRsZScsIFwiVGl0bGUgb2Ygd2Fsa3Rocm91Z2guXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGljb246IHtcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5pY29uJywgXCJSZWxhdGl2ZSBwYXRoIHRvIHRoZSBpY29uIG9mIHRoZSB3YWxrdGhyb3VnaC4gVGhlIHBhdGggaXMgcmVsYXRpdmUgdG8gdGhlIGV4dGVuc2lvbiBsb2NhdGlvbi4gSWYgbm90IHNwZWNpZmllZCwgdGhlIGljb24gZGVmYXVsdHMgdG8gdGhlIGV4dGVuc2lvbiBpY29uIGlmIGF2YWlsYWJsZS5cIiksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuZGVzY3JpcHRpb24nLCBcIkRlc2NyaXB0aW9uIG9mIHdhbGt0aHJvdWdoLlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmZWF0dXJlZEZvcjoge1xuXHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuZmVhdHVyZWRGb3InLCBcIldhbGt0aHJvdWdocyB0aGF0IG1hdGNoIG9uZSBvZiB0aGVzZSBnbG9iIHBhdHRlcm5zIGFwcGVhciBhcyAnZmVhdHVyZWQnIGluIHdvcmtzcGFjZXMgd2l0aCB0aGUgc3BlY2lmaWVkIGZpbGVzLiBGb3IgZXhhbXBsZSwgYSB3YWxrdGhyb3VnaCBmb3IgVHlwZVNjcmlwdCBwcm9qZWN0cyBtaWdodCBzcGVjaWZ5IGB0c2NvbmZpZy5qc29uYCBoZXJlLlwiKSxcblx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3aGVuOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMud2hlbicsIFwiQ29udGV4dCBrZXkgZXhwcmVzc2lvbiB0byBjb250cm9sIHRoZSB2aXNpYmlsaXR5IG9mIHRoaXMgd2Fsa3Rocm91Z2guXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHN0ZXBzOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5zdGVwcycsIFwiU3RlcHMgdG8gY29tcGxldGUgYXMgcGFydCBvZiB0aGlzIHdhbGt0aHJvdWdoLlwiKSxcblx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRyZXF1aXJlZDogWydpZCcsICd0aXRsZScsICdtZWRpYSddLFxuXHRcdFx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbe1xuXHRcdFx0XHRcdFx0XHRib2R5OiB7XG5cdFx0XHRcdFx0XHRcdFx0J2lkJzogJyQxJywgJ3RpdGxlJzogJyQyJywgJ2Rlc2NyaXB0aW9uJzogJyQzJyxcblx0XHRcdFx0XHRcdFx0XHQnY29tcGxldGlvbkV2ZW50cyc6IFsnJDUnXSxcblx0XHRcdFx0XHRcdFx0XHQnbWVkaWEnOiB7fSxcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMuaWQnLCBcIlVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGlzIHN0ZXAuIFRoaXMgaXMgdXNlZCB0byBrZWVwIHRyYWNrIG9mIHdoaWNoIHN0ZXBzIGhhdmUgYmVlbiBjb21wbGV0ZWQuXCIpLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR0aXRsZToge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd2Fsa3Rocm91Z2hzLnN0ZXBzLnRpdGxlJywgXCJUaXRsZSBvZiBzdGVwLlwiKVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd2Fsa3Rocm91Z2hzLnN0ZXBzLmRlc2NyaXB0aW9uLmludGVycG9sYXRlZCcsIFwiRGVzY3JpcHRpb24gb2Ygc3RlcC4gU3VwcG9ydHMgYGBwcmVmb3JtYXR0ZWRgYCwgX19pdGFsaWNfXywgYW5kICoqYm9sZCoqIHRleHQuIFVzZSBtYXJrZG93bi1zdHlsZSBsaW5rcyBmb3IgY29tbWFuZHMgb3IgZXh0ZXJuYWwgbGlua3M6IHswfSwgezF9LCBvciB7Mn0uIExpbmtzIG9uIHRoZWlyIG93biBsaW5lIHdpbGwgYmUgcmVuZGVyZWQgYXMgYnV0dG9ucy5cIiwgYFske3RpdGxlVHJhbnNsYXRlZH1dKGNvbW1hbmQ6bXlleHQuY29tbWFuZClgLCBgWyR7dGl0bGVUcmFuc2xhdGVkfV0oY29tbWFuZDp0b1NpZGU6bXlleHQuY29tbWFuZClgLCBgWyR7dGl0bGVUcmFuc2xhdGVkfV0oaHR0cHM6Ly9ha2EubXMpYClcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0YnV0dG9uOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBsb2NhbGl6ZSgnd2Fsa3Rocm91Z2hzLnN0ZXBzLmJ1dHRvbi5kZXByZWNhdGVkLmludGVycG9sYXRlZCcsIFwiRGVwcmVjYXRlZC4gVXNlIG1hcmtkb3duIGxpbmtzIGluIHRoZSBkZXNjcmlwdGlvbiBpbnN0ZWFkLCBpLmUuIHswfSwgezF9LCBvciB7Mn1cIiwgYFske3RpdGxlVHJhbnNsYXRlZH1dKGNvbW1hbmQ6bXlleHQuY29tbWFuZClgLCBgWyR7dGl0bGVUcmFuc2xhdGVkfV0oY29tbWFuZDp0b1NpZGU6bXlleHQuY29tbWFuZClgLCBgWyR7dGl0bGVUcmFuc2xhdGVkfV0oaHR0cHM6Ly9ha2EubXMpYCksXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdG1lZGlhOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMubWVkaWEnLCBcIk1lZGlhIHRvIHNob3cgYWxvbmdzaWRlIHRoaXMgc3RlcCwgZWl0aGVyIGFuIGltYWdlIG9yIG1hcmtkb3duIGNvbnRlbnQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2ltYWdlJywgJ2FsdFRleHQnXSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBsb2NhbGl6ZSgncGF0aERlcHJlY2F0ZWQnLCBcIkRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgYGltYWdlYCBvciBgbWFya2Rvd25gIGluc3RlYWRcIilcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGltYWdlOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5zdGVwcy5tZWRpYS5pbWFnZS5wYXRoLnN0cmluZycsIFwiUGF0aCB0byBhbiBpbWFnZSAtIG9yIG9iamVjdCBjb25zaXN0aW5nIG9mIHBhdGhzIHRvIGxpZ2h0LCBkYXJrLCBhbmQgaGMgaW1hZ2VzIC0gcmVsYXRpdmUgdG8gZXh0ZW5zaW9uIGRpcmVjdG9yeS4gRGVwZW5kaW5nIG9uIGNvbnRleHQsIHRoZSBpbWFnZSB3aWxsIGJlIGRpc3BsYXllZCBmcm9tIDQwMHB4IHRvIDgwMHB4IHdpZGUsIHdpdGggc2ltaWxhciBib3VuZHMgb24gaGVpZ2h0LiBUbyBzdXBwb3J0IEhJRFBJIGRpc3BsYXlzLCB0aGUgaW1hZ2Ugd2lsbCBiZSByZW5kZXJlZCBhdCAxLjV4IHNjYWxpbmcsIGZvciBleGFtcGxlIGEgOTAwIHBoeXNpY2FsIHBpeGVscyB3aWRlIGltYWdlIHdpbGwgYmUgZGlzcGxheWVkIGFzIDYwMCBsb2dpY2FsIHBpeGVscyB3aWRlLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2RhcmsnLCAnbGlnaHQnLCAnaGMnLCAnaGNMaWdodCddLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRhcms6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMubWVkaWEuaW1hZ2UucGF0aC5kYXJrLnN0cmluZycsIFwiUGF0aCB0byB0aGUgaW1hZ2UgZm9yIGRhcmsgdGhlbWVzLCByZWxhdGl2ZSB0byBleHRlbnNpb24gZGlyZWN0b3J5LlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bGlnaHQ6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMubWVkaWEuaW1hZ2UucGF0aC5saWdodC5zdHJpbmcnLCBcIlBhdGggdG8gdGhlIGltYWdlIGZvciBsaWdodCB0aGVtZXMsIHJlbGF0aXZlIHRvIGV4dGVuc2lvbiBkaXJlY3RvcnkuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRoYzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5zdGVwcy5tZWRpYS5pbWFnZS5wYXRoLmhjLnN0cmluZycsIFwiUGF0aCB0byB0aGUgaW1hZ2UgZm9yIGhjIHRoZW1lcywgcmVsYXRpdmUgdG8gZXh0ZW5zaW9uIGRpcmVjdG9yeS5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGhjTGlnaHQ6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMubWVkaWEuaW1hZ2UucGF0aC5oY0xpZ2h0LnN0cmluZycsIFwiUGF0aCB0byB0aGUgaW1hZ2UgZm9yIGhjIGxpZ2h0IHRoZW1lcywgcmVsYXRpdmUgdG8gZXh0ZW5zaW9uIGRpcmVjdG9yeS5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0YWx0VGV4dDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5zdGVwcy5tZWRpYS5hbHRUZXh0JywgXCJBbHRlcm5hdGUgdGV4dCB0byBkaXNwbGF5IHdoZW4gdGhlIGltYWdlIGNhbm5vdCBiZSBsb2FkZWQgb3IgaW4gc2NyZWVuIHJlYWRlcnMuXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXF1aXJlZDogWydzdmcnLCAnYWx0VGV4dCddLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzdmc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd2Fsa3Rocm91Z2hzLnN0ZXBzLm1lZGlhLmltYWdlLnBhdGguc3ZnJywgXCJQYXRoIHRvIGFuIHN2ZywgY29sb3IgdG9rZW5zIGFyZSBzdXBwb3J0ZWQgaW4gdmFyaWFibGVzIHRvIHN1cHBvcnQgdGhlbWluZyB0byBtYXRjaCB0aGUgd29ya2JlbmNoLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0YWx0VGV4dDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5zdGVwcy5tZWRpYS5hbHRUZXh0JywgXCJBbHRlcm5hdGUgdGV4dCB0byBkaXNwbGF5IHdoZW4gdGhlIGltYWdlIGNhbm5vdCBiZSBsb2FkZWQgb3IgaW4gc2NyZWVuIHJlYWRlcnMuXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsnbWFya2Rvd24nXSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBsb2NhbGl6ZSgncGF0aERlcHJlY2F0ZWQnLCBcIkRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgYGltYWdlYCBvciBgbWFya2Rvd25gIGluc3RlYWRcIilcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1hcmtkb3duOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5zdGVwcy5tZWRpYS5tYXJrZG93bi5wYXRoJywgXCJQYXRoIHRvIHRoZSBtYXJrZG93biBkb2N1bWVudCwgcmVsYXRpdmUgdG8gZXh0ZW5zaW9uIGRpcmVjdG9yeS5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGNvbXBsZXRpb25FdmVudHM6IHtcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5zdGVwcy5jb21wbGV0aW9uRXZlbnRzJywgXCJFdmVudHMgdGhhdCBzaG91bGQgdHJpZ2dlciB0aGlzIHN0ZXAgdG8gYmVjb21lIGNoZWNrZWQgb2ZmLiBJZiBlbXB0eSBvciBub3QgZGVmaW5lZCwgdGhlIHN0ZXAgd2lsbCBjaGVjayBvZmYgd2hlbiBhbnkgb2YgdGhlIHN0ZXAncyBidXR0b25zIG9yIGxpbmtzIGFyZSBjbGlja2VkOyBpZiB0aGUgc3RlcCBoYXMgbm8gYnV0dG9ucyBvciBsaW5rcyBpdCB3aWxsIGNoZWNrIG9uIHdoZW4gaXQgaXMgc2VsZWN0ZWQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsYWJlbDogJ29uQ29tbWFuZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMuY29tcGxldGlvbkV2ZW50cy5vbkNvbW1hbmQnLCAnQ2hlY2sgb2ZmIHN0ZXAgd2hlbiBhIGdpdmVuIGNvbW1hbmQgaXMgZXhlY3V0ZWQgYW55d2hlcmUgaW4gVlMgQ29kZS4nKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRib2R5OiAnb25Db21tYW5kOiR7MTpjb21tYW5kSWR9J1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6ICdvbkxpbmsnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd2Fsa3Rocm91Z2hzLnN0ZXBzLmNvbXBsZXRpb25FdmVudHMub25MaW5rJywgJ0NoZWNrIG9mZiBzdGVwIHdoZW4gYSBnaXZlbiBsaW5rIGlzIG9wZW5lZCB2aWEgYSB3YWxrdGhyb3VnaCBzdGVwLicpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGJvZHk6ICdvbkxpbms6JHsyOmxpbmtJZH0nXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsYWJlbDogJ29uVmlldycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMuY29tcGxldGlvbkV2ZW50cy5vblZpZXcnLCAnQ2hlY2sgb2ZmIHN0ZXAgd2hlbiBhIGdpdmVuIHZpZXcgaXMgb3BlbmVkJyksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ym9keTogJ29uVmlldzokezI6dmlld0lkfSdcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiAnb25TZXR0aW5nQ2hhbmdlZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMuY29tcGxldGlvbkV2ZW50cy5vblNldHRpbmdDaGFuZ2VkJywgJ0NoZWNrIG9mZiBzdGVwIHdoZW4gYSBnaXZlbiBzZXR0aW5nIGlzIGNoYW5nZWQnKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRib2R5OiAnb25TZXR0aW5nQ2hhbmdlZDokezI6c2V0dGluZ05hbWV9J1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0bGFiZWw6ICdvbkNvbnRleHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd2Fsa3Rocm91Z2hzLnN0ZXBzLmNvbXBsZXRpb25FdmVudHMub25Db250ZXh0JywgJ0NoZWNrIG9mZiBzdGVwIHdoZW4gYSBjb250ZXh0IGtleSBleHByZXNzaW9uIGlzIHRydWUuJyksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ym9keTogJ29uQ29udGV4dDokezI6a2V5fSdcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiAnb25FeHRlbnNpb25JbnN0YWxsZWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd2Fsa3Rocm91Z2hzLnN0ZXBzLmNvbXBsZXRpb25FdmVudHMuZXh0ZW5zaW9uSW5zdGFsbGVkJywgJ0NoZWNrIG9mZiBzdGVwIHdoZW4gYW4gZXh0ZW5zaW9uIHdpdGggdGhlIGdpdmVuIGlkIGlzIGluc3RhbGxlZC4gSWYgdGhlIGV4dGVuc2lvbiBpcyBhbHJlYWR5IGluc3RhbGxlZCwgdGhlIHN0ZXAgd2lsbCBzdGFydCBvZmYgY2hlY2tlZC4nKSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRib2R5OiAnb25FeHRlbnNpb25JbnN0YWxsZWQ6JHszOmV4dGVuc2lvbklkfSdcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiAnb25TdGVwU2VsZWN0ZWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd2Fsa3Rocm91Z2hzLnN0ZXBzLmNvbXBsZXRpb25FdmVudHMuc3RlcFNlbGVjdGVkJywgJ0NoZWNrIG9mZiBzdGVwIGFzIHNvb24gYXMgaXQgaXMgc2VsZWN0ZWQuJyksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ym9keTogJ29uU3RlcFNlbGVjdGVkJ1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0ZG9uZU9uOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMuZG9uZU9uJywgXCJTaWduYWwgdG8gbWFyayBzdGVwIGFzIGNvbXBsZXRlLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMuZG9uZU9uLmRlcHJlY2F0aW9uJywgXCJkb25lT24gaXMgZGVwcmVjYXRlZC4gQnkgZGVmYXVsdCBzdGVwcyB3aWxsIGJlIGNoZWNrZWQgb2ZmIHdoZW4gdGhlaXIgYnV0dG9ucyBhcmUgY2xpY2tlZCwgdG8gY29uZmlndXJlIGZ1cnRoZXIgdXNlIGNvbXBsZXRpb25FdmVudHNcIiksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsnY29tbWFuZCddLFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgJ2JvZHknOiB7IGNvbW1hbmQ6ICckMScgfSB9XSxcblx0XHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnY29tbWFuZCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3YWxrdGhyb3VnaHMuc3RlcHMub25lT24uY29tbWFuZCcsIFwiTWFyayBzdGVwIGRvbmUgd2hlbiB0aGUgc3BlY2lmaWVkIGNvbW1hbmQgaXMgZXhlY3V0ZWQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHdoZW46IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dhbGt0aHJvdWdocy5zdGVwcy53aGVuJywgXCJDb250ZXh0IGtleSBleHByZXNzaW9uIHRvIGNvbnRyb2wgdGhlIHZpc2liaWxpdHkgb2YgdGhpcyBzdGVwLlwiKVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXHRhY3RpdmF0aW9uRXZlbnRzR2VuZXJhdG9yOiAod2Fsa3Rocm91Z2hDb250cmlidXRpb25zLCByZXN1bHQpID0+IHtcblx0XHRmb3IgKGNvbnN0IHdhbGt0aHJvdWdoQ29udHJpYnV0aW9uIG9mIHdhbGt0aHJvdWdoQ29udHJpYnV0aW9ucykge1xuXHRcdFx0aWYgKHdhbGt0aHJvdWdoQ29udHJpYnV0aW9uLmlkKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGBvbldhbGt0aHJvdWdoOiR7d2Fsa3Rocm91Z2hDb250cmlidXRpb24uaWR9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsMEJBQTBCO0FBRW5DLE1BQU0sa0JBQWtCLFNBQVMsU0FBUyxPQUFPO0FBRTFDLE1BQU0sNkJBQTZCLG1CQUFtQix1QkFBdUM7QUFBQSxFQUNuRyxnQkFBZ0I7QUFBQSxFQUNoQixZQUFZO0FBQUEsSUFDWCxhQUFhLFNBQVMsZ0JBQWdCLDRFQUE0RTtBQUFBLElBQ2xILE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLFVBQVUsQ0FBQyxNQUFNLFNBQVMsZUFBZSxPQUFPO0FBQUEsTUFDaEQsaUJBQWlCLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxNQUFNLFNBQVMsTUFBTSxlQUFlLE1BQU0sU0FBUyxDQUFDLEVBQUUsRUFBRSxDQUFDO0FBQUEsTUFDM0YsWUFBWTtBQUFBLFFBQ1gsSUFBSTtBQUFBLFVBQ0gsTUFBTTtBQUFBLFVBQ04sYUFBYSxTQUFTLG1CQUFtQix5Q0FBeUM7QUFBQSxRQUNuRjtBQUFBLFFBQ0EsT0FBTztBQUFBLFVBQ04s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
