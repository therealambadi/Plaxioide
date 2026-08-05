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
import { coalesce, isNonEmptyArray } from "../../../../base/common/arrays.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { Event } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as strings from "../../../../base/common/strings.js";
import { localize } from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as ViewExtensions } from "../../../common/views.js";
import { Extensions } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import * as extensionsRegistry from "../../../services/extensions/common/extensionsRegistry.js";
import { showExtensionsWithIdsCommandId } from "../../extensions/browser/extensionsActions.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { IChatAgentService } from "../common/chatAgents.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { ChatAgentLocation } from "../common/constants.js";
import { ChatViewId } from "./chat.js";
const chatParticipantExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "chatParticipants",
  jsonSchema: {
    description: localize("vscode.extension.contributes.chatParticipant", "Contributes a chat participant"),
    type: "array",
    items: {
      additionalProperties: false,
      type: "object",
      defaultSnippets: [{ body: { name: "", description: "" } }],
      required: ["name", "id"],
      properties: {
        id: {
          description: localize("chatParticipantId", "A unique id for this chat participant."),
          type: "string"
        },
        name: {
          description: localize("chatParticipantName", "User-facing name for this chat participant. The user will use '@' with this name to invoke the participant. Name must not contain whitespace."),
          type: "string",
          pattern: "^[\\w-]+$"
        },
        fullName: {
          markdownDescription: localize("chatParticipantFullName", "The full name of this chat participant, which is shown as the label for responses coming from this participant. If not provided, {0} is used.", "`name`"),
          type: "string"
        },
        description: {
          description: localize("chatParticipantDescription", "A description of this chat participant, shown in the UI."),
          type: "string"
        },
        isSticky: {
          description: localize("chatCommandSticky", "Whether invoking the command puts the chat into a persistent mode, where the command is automatically added to the chat input for the next message."),
          type: "boolean"
        },
        sampleRequest: {
          description: localize("chatSampleRequest", "When the user clicks this participant in `/help`, this text will be submitted to the participant."),
          type: "string"
        },
        when: {
          description: localize("chatParticipantWhen", "A condition which must be true to enable this participant."),
          type: "string"
        },
        disambiguation: {
          description: localize("chatParticipantDisambiguation", "Metadata to help with automatically routing user questions to this chat participant."),
          type: "array",
          items: {
            additionalProperties: false,
            type: "object",
            defaultSnippets: [{ body: { category: "", description: "", examples: [] } }],
            required: ["category", "description", "examples"],
            properties: {
              category: {
                markdownDescription: localize("chatParticipantDisambiguationCategory", "A detailed name for this category, e.g. `workspace_questions` or `web_questions`."),
                type: "string"
              },
              description: {
                description: localize("chatParticipantDisambiguationDescription", "A detailed description of the kinds of questions that are suitable for this chat participant."),
                type: "string"
              },
              examples: {
                description: localize("chatParticipantDisambiguationExamples", "A list of representative example questions that are suitable for this chat participant."),
                type: "array"
              }
            }
          }
        },
        commands: {
          markdownDescription: localize("chatCommandsDescription", "Commands available for this chat participant, which the user can invoke with a `/`."),
          type: "array",
          items: {
            additionalProperties: false,
            type: "object",
            defaultSnippets: [{ body: { name: "", description: "" } }],
            required: ["name"],
            properties: {
              name: {
                description: localize("chatCommand", "A short name by which this command is referred to in the UI, e.g. `fix` or * `explain` for commands that fix an issue or explain code. The name should be unique among the commands provided by this participant."),
                type: "string"
              },
              description: {
                description: localize("chatCommandDescription", "A description of this command."),
                type: "string"
              },
              when: {
                description: localize("chatCommandWhen", "A condition which must be true to enable this command."),
                type: "string"
              },
              sampleRequest: {
                description: localize("chatCommandSampleRequest", "When the user clicks this command in `/help`, this text will be submitted to the participant."),
                type: "string"
              },
              isSticky: {
                description: localize("chatCommandSticky", "Whether invoking the command puts the chat into a persistent mode, where the command is automatically added to the chat input for the next message."),
                type: "boolean"
              },
              disambiguation: {
                description: localize("chatCommandDisambiguation", "Metadata to help with automatically routing user questions to this chat command."),
                type: "array",
                items: {
                  additionalProperties: false,
                  type: "object",
                  defaultSnippets: [{ body: { category: "", description: "", examples: [] } }],
                  required: ["category", "description", "examples"],
                  properties: {
                    category: {
                      markdownDescription: localize("chatCommandDisambiguationCategory", "A detailed name for this category, e.g. `workspace_questions` or `web_questions`."),
                      type: "string"
                    },
                    description: {
                      description: localize("chatCommandDisambiguationDescription", "A detailed description of the kinds of questions that are suitable for this chat command."),
                      type: "string"
                    },
                    examples: {
                      description: localize("chatCommandDisambiguationExamples", "A list of representative example questions that are suitable for this chat command."),
                      type: "array"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  activationEventsGenerator: (contributions, result) => {
    for (const contrib of contributions) {
      result.push(`onChatParticipant:${contrib.id}`);
    }
  }
});
let ChatExtensionPointHandler = class {
  constructor(_chatAgentService, logService) {
    this._chatAgentService = _chatAgentService;
    this.logService = logService;
    this._participantRegistrationDisposables = new DisposableMap();
    this.handleAndRegisterChatExtensions();
  }
  handleAndRegisterChatExtensions() {
    chatParticipantExtensionPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        for (const providerDescriptor of extension.value) {
          if (!providerDescriptor.name?.match(/^[\w-]+$/)) {
            this.logService.error(`Extension '${extension.description.identifier.value}' CANNOT register participant with invalid name: ${providerDescriptor.name}. Name must match /^[\\w-]+$/.`);
            continue;
          }
          if (providerDescriptor.fullName && strings.AmbiguousCharacters.getInstance(/* @__PURE__ */ new Set()).containsAmbiguousCharacter(providerDescriptor.fullName)) {
            this.logService.error(`Extension '${extension.description.identifier.value}' CANNOT register participant with fullName that contains ambiguous characters: ${providerDescriptor.fullName}.`);
            continue;
          }
          if (providerDescriptor.fullName && strings.InvisibleCharacters.containsInvisibleCharacter(providerDescriptor.fullName.replace(/ /g, ""))) {
            this.logService.error(`Extension '${extension.description.identifier.value}' CANNOT register participant with fullName that contains invisible characters: ${providerDescriptor.fullName}.`);
            continue;
          }
          if ((providerDescriptor.isDefault || providerDescriptor.isAgent) && !isProposedApiEnabled(extension.description, "defaultChatParticipant")) {
            this.logService.error(`Extension '${extension.description.identifier.value}' CANNOT use API proposal: defaultChatParticipant.`);
            continue;
          }
          if (providerDescriptor.locations && !isProposedApiEnabled(extension.description, "chatParticipantAdditions")) {
            this.logService.error(`Extension '${extension.description.identifier.value}' CANNOT use API proposal: chatParticipantAdditions.`);
            continue;
          }
          if (!providerDescriptor.id || !providerDescriptor.name) {
            this.logService.error(`Extension '${extension.description.identifier.value}' CANNOT register participant without both id and name.`);
            continue;
          }
          const participantsDisambiguation = [];
          if (providerDescriptor.disambiguation?.length) {
            participantsDisambiguation.push(...providerDescriptor.disambiguation.map((d) => ({
              ...d,
              category: d.category ?? d.categoryName
            })));
          }
          try {
            const store = new DisposableStore();
            store.add(this._chatAgentService.registerAgent(
              providerDescriptor.id,
              {
                extensionId: extension.description.identifier,
                publisherDisplayName: extension.description.publisherDisplayName ?? extension.description.publisher,
                // May not be present in OSS
                extensionPublisherId: extension.description.publisher,
                extensionDisplayName: extension.description.displayName ?? extension.description.name,
                id: providerDescriptor.id,
                description: providerDescriptor.description,
                when: providerDescriptor.when,
                metadata: {
                  isSticky: providerDescriptor.isSticky,
                  sampleRequest: providerDescriptor.sampleRequest
                },
                name: providerDescriptor.name,
                fullName: providerDescriptor.fullName,
                isDefault: providerDescriptor.isDefault,
                isToolsAgent: providerDescriptor.isAgent,
                locations: isNonEmptyArray(providerDescriptor.locations) ? providerDescriptor.locations.map(ChatAgentLocation.fromRaw) : [ChatAgentLocation.Panel],
                slashCommands: providerDescriptor.commands ?? [],
                disambiguation: coalesce(participantsDisambiguation.flat())
              }
            ));
            this._participantRegistrationDisposables.set(
              getParticipantKey(extension.description.identifier, providerDescriptor.id),
              store
            );
          } catch (e) {
            this.logService.error(`Failed to register participant ${providerDescriptor.id}: ${toErrorMessage(e, true)}`);
          }
        }
      }
      for (const extension of delta.removed) {
        for (const providerDescriptor of extension.value) {
          this._participantRegistrationDisposables.deleteAndDispose(getParticipantKey(extension.description.identifier, providerDescriptor.id));
        }
      }
    });
  }
};
ChatExtensionPointHandler.ID = "workbench.contrib.chatExtensionPointHandler";
ChatExtensionPointHandler = __decorateClass([
  __decorateParam(0, IChatAgentService),
  __decorateParam(1, ILogService)
], ChatExtensionPointHandler);
function getParticipantKey(extensionId, participantName) {
  return `${extensionId.value}_${participantName}`;
}
let ChatCompatibilityNotifier = class extends Disposable {
  constructor(extensionsWorkbenchService, contextKeyService, productService) {
    super();
    this.productService = productService;
    this.registeredWelcomeView = false;
    const isInvalid = ChatContextKeys.extensionInvalid.bindTo(contextKeyService);
    this._register(Event.runAndSubscribe(
      extensionsWorkbenchService.onDidChangeExtensionsNotification,
      () => {
        const notification = extensionsWorkbenchService.getExtensionsNotification();
        const chatExtension = notification?.extensions.find((ext) => ExtensionIdentifier.equals(ext.identifier.id, this.productService.defaultChatAgent?.chatExtensionId));
        if (chatExtension) {
          isInvalid.set(true);
          this.registerWelcomeView(chatExtension);
        } else {
          isInvalid.set(false);
        }
      }
    ));
  }
  registerWelcomeView(chatExtension) {
    if (this.registeredWelcomeView) {
      return;
    }
    this.registeredWelcomeView = true;
    const showExtensionLabel = localize("showExtension", "Show Extension");
    const mainMessage = localize("chatFailErrorMessage", "Chat failed to load because the installed version of the Copilot Chat extension is not compatible with this version of {0}. Please ensure that the Copilot Chat extension is up to date.", this.productService.nameLong);
    const commandButton = `[${showExtensionLabel}](command:${showExtensionsWithIdsCommandId}?${encodeURIComponent(JSON.stringify([[this.productService.defaultChatAgent?.chatExtensionId]]))})`;
    const versionMessage = `Copilot Chat version: ${chatExtension.version}`;
    const viewsRegistry = Registry.as(ViewExtensions.ViewsRegistry);
    this._register(viewsRegistry.registerViewWelcomeContent(ChatViewId, {
      content: [mainMessage, commandButton, versionMessage].join("\n\n"),
      when: ChatContextKeys.extensionInvalid
    }));
  }
};
ChatCompatibilityNotifier.ID = "workbench.contrib.chatCompatNotifier";
ChatCompatibilityNotifier = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IProductService)
], ChatCompatibilityNotifier);
class ChatParticipantDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.chatParticipants;
  }
  render(manifest) {
    const nonDefaultContributions = manifest.contributes?.chatParticipants?.filter((c) => !c.isDefault) ?? [];
    if (!nonDefaultContributions.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("participantName", "Name"),
      localize("participantFullName", "Full Name"),
      localize("participantDescription", "Description"),
      localize("participantCommands", "Commands")
    ];
    const rows = nonDefaultContributions.map((d) => {
      return [
        "@" + d.name,
        d.fullName,
        d.description ?? "-",
        d.commands?.length ? new MarkdownString(d.commands.map((c) => `- /` + c.name).join("\n")) : "-"
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "chatParticipants",
  label: localize("chatParticipants", "Chat Participants"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(ChatParticipantDataRenderer)
});
export {
  ChatCompatibilityNotifier,
  ChatExtensionPointHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFBhcnRpY2lwYW50LmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGNvYWxlc2NlLCBpc05vbkVtcHR5QXJyYXkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuLy8gaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG4vLyBpbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbi8vIGltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG4vLyBpbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG4vLyBpbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbi8vIGltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uTWFuaWZlc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG4vLyBpbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbi8vIGltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG4vLyBpbXBvcnQgeyBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuLy8gaW1wb3J0IHsgVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lQ29udGFpbmVyLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSVZpZXdzUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgVmlld0V4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnksIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciwgSVJlbmRlcmVkRGF0YSwgSVJvd0RhdGEsIElUYWJsZURhdGEgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25GZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0ICogYXMgZXh0ZW5zaW9uc1JlZ2lzdHJ5IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG4vLyBpbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBzaG93RXh0ZW5zaW9uc1dpdGhJZHNDb21tYW5kSWQgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbiwgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50RGF0YSwgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElSYXdDaGF0UGFydGljaXBhbnRDb250cmlidXRpb24gfSBmcm9tICcuLi9jb21tb24vY2hhdFBhcnRpY2lwYW50Q29udHJpYlR5cGVzLmpzJztcbi8vIGltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2hhdFZpZXdJZCB9IGZyb20gJy4vY2hhdC5qcyc7XG4vLyBpbXBvcnQgeyBDSEFUX0VESVRJTkdfU0lERUJBUl9QQU5FTF9JRCwgQ0hBVF9TSURFQkFSX1BBTkVMX0lELCBDaGF0Vmlld1BhbmUgfSBmcm9tICcuL2NoYXRWaWV3UGFuZS5qcyc7XG5cbi8vIC0tLSBDaGF0IENvbnRhaW5lciAmICBWaWV3IFJlZ2lzdHJhdGlvblxuXG4vLyBWb2lkIGNvbW1lbnRlZCB0aGlzIG91dFxuLy8gY29uc3QgY2hhdFZpZXdDb250YWluZXI6IFZpZXdDb250YWluZXIgPSBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oVmlld0V4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHtcbi8vIFx0aWQ6IENIQVRfU0lERUJBUl9QQU5FTF9JRCxcbi8vIFx0dGl0bGU6IGxvY2FsaXplMignY2hhdC52aWV3Q29udGFpbmVyLmxhYmVsJywgXCJDaGF0XCIpLFxuLy8gXHRpY29uOiBDb2RpY29uLmNvbW1lbnREaXNjdXNzaW9uLFxuLy8gXHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFZpZXdQYW5lQ29udGFpbmVyLCBbQ0hBVF9TSURFQkFSX1BBTkVMX0lELCB7IG1lcmdlVmlld1dpdGhDb250YWluZXJXaGVuU2luZ2xlVmlldzogdHJ1ZSB9XSksXG4vLyBcdHN0b3JhZ2VJZDogQ0hBVF9TSURFQkFSX1BBTkVMX0lELFxuLy8gXHRoaWRlSWZFbXB0eTogdHJ1ZSxcbi8vIFx0b3JkZXI6IDEwMCxcbi8vIH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIsIHsgaXNEZWZhdWx0OiB0cnVlLCBkb05vdFJlZ2lzdGVyT3BlbkNvbW1hbmQ6IHRydWUgfSk7XG5cbi8vIGNvbnN0IGNoYXRWaWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yW10gPSBbe1xuLy8gXHRpZDogQ2hhdFZpZXdJZCxcbi8vIFx0Y29udGFpbmVySWNvbjogY2hhdFZpZXdDb250YWluZXIuaWNvbixcbi8vIFx0Y29udGFpbmVyVGl0bGU6IGNoYXRWaWV3Q29udGFpbmVyLnRpdGxlLnZhbHVlLFxuLy8gXHRzaW5nbGVWaWV3UGFuZUNvbnRhaW5lclRpdGxlOiBjaGF0Vmlld0NvbnRhaW5lci50aXRsZS52YWx1ZSxcbi8vIFx0bmFtZTogbG9jYWxpemUyKCdjaGF0LnZpZXdDb250YWluZXIubGFiZWwnLCBcIkNoYXRcIiksXG4vLyBcdGNhblRvZ2dsZVZpc2liaWxpdHk6IGZhbHNlLFxuLy8gXHRjYW5Nb3ZlVmlldzogdHJ1ZSxcbi8vIFx0b3BlbkNvbW1hbmRBY3Rpb25EZXNjcmlwdG9yOiB7XG4vLyBcdFx0aWQ6IENIQVRfU0lERUJBUl9QQU5FTF9JRCxcbi8vIFx0XHR0aXRsZTogY2hhdFZpZXdDb250YWluZXIudGl0bGUsXG4vLyBcdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVRvZ2dsZUNoYXQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDaGF0XCIpLFxuLy8gXHRcdGtleWJpbmRpbmdzOiB7XG4vLyBcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleUksXG4vLyBcdFx0XHRtYWM6IHtcbi8vIFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuV2luQ3RybCB8IEtleUNvZGUuS2V5SVxuLy8gXHRcdFx0fVxuLy8gXHRcdH0sXG4vLyBcdFx0b3JkZXI6IDFcbi8vIFx0fSxcbi8vIFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihDaGF0Vmlld1BhbmUsIFt7IGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCB9XSksXG4vLyBcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKFxuLy8gXHRcdENoYXRDb250ZXh0S2V5cy5TZXR1cC5oaWRkZW4ubmVnYXRlKCksXG4vLyBcdFx0Q2hhdENvbnRleHRLZXlzLlNldHVwLmluc3RhbGxlZCxcbi8vIFx0XHRDaGF0Q29udGV4dEtleXMucGFuZWxQYXJ0aWNpcGFudFJlZ2lzdGVyZWQsXG4vLyBcdFx0Q2hhdENvbnRleHRLZXlzLmV4dGVuc2lvbkludmFsaWRcbi8vIFx0KVxuLy8gfV07XG4vLyBSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oVmlld0V4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSkucmVnaXN0ZXJWaWV3cyhjaGF0Vmlld0Rlc2NyaXB0b3IsIGNoYXRWaWV3Q29udGFpbmVyKTtcblxuLy8gLS0tIEVkaXRzIENvbnRhaW5lciAmICBWaWV3IFJlZ2lzdHJhdGlvblxuLy8gVm9pZCBjb21tZW50ZWQgdGhpcyBvdXRcblxuLy8gY29uc3QgZWRpdHNWaWV3Q29udGFpbmVyOiBWaWV3Q29udGFpbmVyID0gUmVnaXN0cnkuYXM8SVZpZXdDb250YWluZXJzUmVnaXN0cnk+KFZpZXdFeHRlbnNpb25zLlZpZXdDb250YWluZXJzUmVnaXN0cnkpLnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7XG4vLyBcdGlkOiBDSEFUX0VESVRJTkdfU0lERUJBUl9QQU5FTF9JRCxcbi8vIFx0dGl0bGU6IGxvY2FsaXplMignY2hhdEVkaXRpbmcudmlld0NvbnRhaW5lci5sYWJlbCcsIFwiQ29waWxvdCBFZGl0c1wiKSxcbi8vIFx0aWNvbjogQ29kaWNvbi5lZGl0U2Vzc2lvbixcbi8vIFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihWaWV3UGFuZUNvbnRhaW5lciwgW0NIQVRfRURJVElOR19TSURFQkFSX1BBTkVMX0lELCB7IG1lcmdlVmlld1dpdGhDb250YWluZXJXaGVuU2luZ2xlVmlldzogdHJ1ZSB9XSksXG4vLyBcdHN0b3JhZ2VJZDogQ0hBVF9FRElUSU5HX1NJREVCQVJfUEFORUxfSUQsXG4vLyBcdGhpZGVJZkVtcHR5OiB0cnVlLFxuLy8gXHRvcmRlcjogMTAxLFxuLy8gfSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhciwgeyBkb05vdFJlZ2lzdGVyT3BlbkNvbW1hbmQ6IHRydWUgfSk7XG5cbmNvbnN0IGNoYXRQYXJ0aWNpcGFudEV4dGVuc2lvblBvaW50ID0gZXh0ZW5zaW9uc1JlZ2lzdHJ5LkV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElSYXdDaGF0UGFydGljaXBhbnRDb250cmlidXRpb25bXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ2NoYXRQYXJ0aWNpcGFudHMnLFxuXHRqc29uU2NoZW1hOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmNoYXRQYXJ0aWNpcGFudCcsICdDb250cmlidXRlcyBhIGNoYXQgcGFydGljaXBhbnQnKSxcblx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdGl0ZW1zOiB7XG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBuYW1lOiAnJywgZGVzY3JpcHRpb246ICcnIH0gfV0sXG5cdFx0XHRyZXF1aXJlZDogWyduYW1lJywgJ2lkJ10sXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGlkOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdjaGF0UGFydGljaXBhbnRJZCcsIFwiQSB1bmlxdWUgaWQgZm9yIHRoaXMgY2hhdCBwYXJ0aWNpcGFudC5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0bmFtZToge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFBhcnRpY2lwYW50TmFtZScsIFwiVXNlci1mYWNpbmcgbmFtZSBmb3IgdGhpcyBjaGF0IHBhcnRpY2lwYW50LiBUaGUgdXNlciB3aWxsIHVzZSAnQCcgd2l0aCB0aGlzIG5hbWUgdG8gaW52b2tlIHRoZSBwYXJ0aWNpcGFudC4gTmFtZSBtdXN0IG5vdCBjb250YWluIHdoaXRlc3BhY2UuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdHBhdHRlcm46ICdeW1xcXFx3LV0rJCdcblx0XHRcdFx0fSxcblx0XHRcdFx0ZnVsbE5hbWU6IHtcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFBhcnRpY2lwYW50RnVsbE5hbWUnLCBcIlRoZSBmdWxsIG5hbWUgb2YgdGhpcyBjaGF0IHBhcnRpY2lwYW50LCB3aGljaCBpcyBzaG93biBhcyB0aGUgbGFiZWwgZm9yIHJlc3BvbnNlcyBjb21pbmcgZnJvbSB0aGlzIHBhcnRpY2lwYW50LiBJZiBub3QgcHJvdmlkZWQsIHswfSBpcyB1c2VkLlwiLCAnYG5hbWVgJyksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYXRQYXJ0aWNpcGFudERlc2NyaXB0aW9uJywgXCJBIGRlc2NyaXB0aW9uIG9mIHRoaXMgY2hhdCBwYXJ0aWNpcGFudCwgc2hvd24gaW4gdGhlIFVJLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRpc1N0aWNreToge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdENvbW1hbmRTdGlja3knLCBcIldoZXRoZXIgaW52b2tpbmcgdGhlIGNvbW1hbmQgcHV0cyB0aGUgY2hhdCBpbnRvIGEgcGVyc2lzdGVudCBtb2RlLCB3aGVyZSB0aGUgY29tbWFuZCBpcyBhdXRvbWF0aWNhbGx5IGFkZGVkIHRvIHRoZSBjaGF0IGlucHV0IGZvciB0aGUgbmV4dCBtZXNzYWdlLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbidcblx0XHRcdFx0fSxcblx0XHRcdFx0c2FtcGxlUmVxdWVzdDoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFNhbXBsZVJlcXVlc3QnLCBcIldoZW4gdGhlIHVzZXIgY2xpY2tzIHRoaXMgcGFydGljaXBhbnQgaW4gYC9oZWxwYCwgdGhpcyB0ZXh0IHdpbGwgYmUgc3VibWl0dGVkIHRvIHRoZSBwYXJ0aWNpcGFudC5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0d2hlbjoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFBhcnRpY2lwYW50V2hlbicsIFwiQSBjb25kaXRpb24gd2hpY2ggbXVzdCBiZSB0cnVlIHRvIGVuYWJsZSB0aGlzIHBhcnRpY2lwYW50LlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRkaXNhbWJpZ3VhdGlvbjoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFBhcnRpY2lwYW50RGlzYW1iaWd1YXRpb24nLCBcIk1ldGFkYXRhIHRvIGhlbHAgd2l0aCBhdXRvbWF0aWNhbGx5IHJvdXRpbmcgdXNlciBxdWVzdGlvbnMgdG8gdGhpcyBjaGF0IHBhcnRpY2lwYW50LlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBjYXRlZ29yeTogJycsIGRlc2NyaXB0aW9uOiAnJywgZXhhbXBsZXM6IFtdIH0gfV0sXG5cdFx0XHRcdFx0XHRyZXF1aXJlZDogWydjYXRlZ29yeScsICdkZXNjcmlwdGlvbicsICdleGFtcGxlcyddLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRjYXRlZ29yeToge1xuXHRcdFx0XHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdjaGF0UGFydGljaXBhbnREaXNhbWJpZ3VhdGlvbkNhdGVnb3J5JywgXCJBIGRldGFpbGVkIG5hbWUgZm9yIHRoaXMgY2F0ZWdvcnksIGUuZy4gYHdvcmtzcGFjZV9xdWVzdGlvbnNgIG9yIGB3ZWJfcXVlc3Rpb25zYC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IHtcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYXRQYXJ0aWNpcGFudERpc2FtYmlndWF0aW9uRGVzY3JpcHRpb24nLCBcIkEgZGV0YWlsZWQgZGVzY3JpcHRpb24gb2YgdGhlIGtpbmRzIG9mIHF1ZXN0aW9ucyB0aGF0IGFyZSBzdWl0YWJsZSBmb3IgdGhpcyBjaGF0IHBhcnRpY2lwYW50LlwiKSxcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRleGFtcGxlczoge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFBhcnRpY2lwYW50RGlzYW1iaWd1YXRpb25FeGFtcGxlcycsIFwiQSBsaXN0IG9mIHJlcHJlc2VudGF0aXZlIGV4YW1wbGUgcXVlc3Rpb25zIHRoYXQgYXJlIHN1aXRhYmxlIGZvciB0aGlzIGNoYXQgcGFydGljaXBhbnQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheSdcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbW1hbmRzOiB7XG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYXRDb21tYW5kc0Rlc2NyaXB0aW9uJywgXCJDb21tYW5kcyBhdmFpbGFibGUgZm9yIHRoaXMgY2hhdCBwYXJ0aWNpcGFudCwgd2hpY2ggdGhlIHVzZXIgY2FuIGludm9rZSB3aXRoIGEgYC9gLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBuYW1lOiAnJywgZGVzY3JpcHRpb246ICcnIH0gfV0sXG5cdFx0XHRcdFx0XHRyZXF1aXJlZDogWyduYW1lJ10sXG5cdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdG5hbWU6IHtcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYXRDb21tYW5kJywgXCJBIHNob3J0IG5hbWUgYnkgd2hpY2ggdGhpcyBjb21tYW5kIGlzIHJlZmVycmVkIHRvIGluIHRoZSBVSSwgZS5nLiBgZml4YCBvciAqIGBleHBsYWluYCBmb3IgY29tbWFuZHMgdGhhdCBmaXggYW4gaXNzdWUgb3IgZXhwbGFpbiBjb2RlLiBUaGUgbmFtZSBzaG91bGQgYmUgdW5pcXVlIGFtb25nIHRoZSBjb21tYW5kcyBwcm92aWRlZCBieSB0aGlzIHBhcnRpY2lwYW50LlwiKSxcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdENvbW1hbmREZXNjcmlwdGlvbicsIFwiQSBkZXNjcmlwdGlvbiBvZiB0aGlzIGNvbW1hbmQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHdoZW46IHtcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYXRDb21tYW5kV2hlbicsIFwiQSBjb25kaXRpb24gd2hpY2ggbXVzdCBiZSB0cnVlIHRvIGVuYWJsZSB0aGlzIGNvbW1hbmQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHNhbXBsZVJlcXVlc3Q6IHtcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYXRDb21tYW5kU2FtcGxlUmVxdWVzdCcsIFwiV2hlbiB0aGUgdXNlciBjbGlja3MgdGhpcyBjb21tYW5kIGluIGAvaGVscGAsIHRoaXMgdGV4dCB3aWxsIGJlIHN1Ym1pdHRlZCB0byB0aGUgcGFydGljaXBhbnQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGlzU3RpY2t5OiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdjaGF0Q29tbWFuZFN0aWNreScsIFwiV2hldGhlciBpbnZva2luZyB0aGUgY29tbWFuZCBwdXRzIHRoZSBjaGF0IGludG8gYSBwZXJzaXN0ZW50IG1vZGUsIHdoZXJlIHRoZSBjb21tYW5kIGlzIGF1dG9tYXRpY2FsbHkgYWRkZWQgdG8gdGhlIGNoYXQgaW5wdXQgZm9yIHRoZSBuZXh0IG1lc3NhZ2UuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRkaXNhbWJpZ3VhdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdENvbW1hbmREaXNhbWJpZ3VhdGlvbicsIFwiTWV0YWRhdGEgdG8gaGVscCB3aXRoIGF1dG9tYXRpY2FsbHkgcm91dGluZyB1c2VyIHF1ZXN0aW9ucyB0byB0aGlzIGNoYXQgY29tbWFuZC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgY2F0ZWdvcnk6ICcnLCBkZXNjcmlwdGlvbjogJycsIGV4YW1wbGVzOiBbXSB9IH1dLFxuXHRcdFx0XHRcdFx0XHRcdFx0cmVxdWlyZWQ6IFsnY2F0ZWdvcnknLCAnZGVzY3JpcHRpb24nLCAnZXhhbXBsZXMnXSxcblx0XHRcdFx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2F0ZWdvcnk6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdENvbW1hbmREaXNhbWJpZ3VhdGlvbkNhdGVnb3J5JywgXCJBIGRldGFpbGVkIG5hbWUgZm9yIHRoaXMgY2F0ZWdvcnksIGUuZy4gYHdvcmtzcGFjZV9xdWVzdGlvbnNgIG9yIGB3ZWJfcXVlc3Rpb25zYC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYXRDb21tYW5kRGlzYW1iaWd1YXRpb25EZXNjcmlwdGlvbicsIFwiQSBkZXRhaWxlZCBkZXNjcmlwdGlvbiBvZiB0aGUga2luZHMgb2YgcXVlc3Rpb25zIHRoYXQgYXJlIHN1aXRhYmxlIGZvciB0aGlzIGNoYXQgY29tbWFuZC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZXhhbXBsZXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NoYXRDb21tYW5kRGlzYW1iaWd1YXRpb25FeGFtcGxlcycsIFwiQSBsaXN0IG9mIHJlcHJlc2VudGF0aXZlIGV4YW1wbGUgcXVlc3Rpb25zIHRoYXQgYXJlIHN1aXRhYmxlIGZvciB0aGlzIGNoYXQgY29tbWFuZC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5J1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdGFjdGl2YXRpb25FdmVudHNHZW5lcmF0b3I6IChjb250cmlidXRpb25zOiBJUmF3Q2hhdFBhcnRpY2lwYW50Q29udHJpYnV0aW9uW10sIHJlc3VsdDogeyBwdXNoKGl0ZW06IHN0cmluZyk6IHZvaWQgfSkgPT4ge1xuXHRcdGZvciAoY29uc3QgY29udHJpYiBvZiBjb250cmlidXRpb25zKSB7XG5cdFx0XHRyZXN1bHQucHVzaChgb25DaGF0UGFydGljaXBhbnQ6JHtjb250cmliLmlkfWApO1xuXHRcdH1cblx0fSxcbn0pO1xuXG5leHBvcnQgY2xhc3MgQ2hhdEV4dGVuc2lvblBvaW50SGFuZGxlciBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5jaGF0RXh0ZW5zaW9uUG9pbnRIYW5kbGVyJztcblxuXHRwcml2YXRlIF9wYXJ0aWNpcGFudFJlZ2lzdHJhdGlvbkRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVNYXA8c3RyaW5nPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLmhhbmRsZUFuZFJlZ2lzdGVyQ2hhdEV4dGVuc2lvbnMoKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlQW5kUmVnaXN0ZXJDaGF0RXh0ZW5zaW9ucygpOiB2b2lkIHtcblx0XHRjaGF0UGFydGljaXBhbnRFeHRlbnNpb25Qb2ludC5zZXRIYW5kbGVyKChleHRlbnNpb25zLCBkZWx0YSkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZGVsdGEuYWRkZWQpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBwcm92aWRlckRlc2NyaXB0b3Igb2YgZXh0ZW5zaW9uLnZhbHVlKSB7XG5cdFx0XHRcdFx0aWYgKCFwcm92aWRlckRlc2NyaXB0b3IubmFtZT8ubWF0Y2goL15bXFx3LV0rJC8pKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEV4dGVuc2lvbiAnJHtleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZX0nIENBTk5PVCByZWdpc3RlciBwYXJ0aWNpcGFudCB3aXRoIGludmFsaWQgbmFtZTogJHtwcm92aWRlckRlc2NyaXB0b3IubmFtZX0uIE5hbWUgbXVzdCBtYXRjaCAvXltcXFxcdy1dKyQvLmApO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHByb3ZpZGVyRGVzY3JpcHRvci5mdWxsTmFtZSAmJiBzdHJpbmdzLkFtYmlndW91c0NoYXJhY3RlcnMuZ2V0SW5zdGFuY2UobmV3IFNldCgpKS5jb250YWluc0FtYmlndW91c0NoYXJhY3Rlcihwcm92aWRlckRlc2NyaXB0b3IuZnVsbE5hbWUpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEV4dGVuc2lvbiAnJHtleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZX0nIENBTk5PVCByZWdpc3RlciBwYXJ0aWNpcGFudCB3aXRoIGZ1bGxOYW1lIHRoYXQgY29udGFpbnMgYW1iaWd1b3VzIGNoYXJhY3RlcnM6ICR7cHJvdmlkZXJEZXNjcmlwdG9yLmZ1bGxOYW1lfS5gKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIFNwYWNlcyBhcmUgYWxsb3dlZCBidXQgY29uc2lkZXJlZCBcImludmlzaWJsZVwiXG5cdFx0XHRcdFx0aWYgKHByb3ZpZGVyRGVzY3JpcHRvci5mdWxsTmFtZSAmJiBzdHJpbmdzLkludmlzaWJsZUNoYXJhY3RlcnMuY29udGFpbnNJbnZpc2libGVDaGFyYWN0ZXIocHJvdmlkZXJEZXNjcmlwdG9yLmZ1bGxOYW1lLnJlcGxhY2UoLyAvZywgJycpKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBFeHRlbnNpb24gJyR7ZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWV9JyBDQU5OT1QgcmVnaXN0ZXIgcGFydGljaXBhbnQgd2l0aCBmdWxsTmFtZSB0aGF0IGNvbnRhaW5zIGludmlzaWJsZSBjaGFyYWN0ZXJzOiAke3Byb3ZpZGVyRGVzY3JpcHRvci5mdWxsTmFtZX0uYCk7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoKHByb3ZpZGVyRGVzY3JpcHRvci5pc0RlZmF1bHQgfHwgcHJvdmlkZXJEZXNjcmlwdG9yLmlzQWdlbnQpICYmICFpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24uZGVzY3JpcHRpb24sICdkZWZhdWx0Q2hhdFBhcnRpY2lwYW50JykpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgRXh0ZW5zaW9uICcke2V4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlfScgQ0FOTk9UIHVzZSBBUEkgcHJvcG9zYWw6IGRlZmF1bHRDaGF0UGFydGljaXBhbnQuYCk7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAocHJvdmlkZXJEZXNjcmlwdG9yLmxvY2F0aW9ucyAmJiAhaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLCAnY2hhdFBhcnRpY2lwYW50QWRkaXRpb25zJykpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgRXh0ZW5zaW9uICcke2V4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlfScgQ0FOTk9UIHVzZSBBUEkgcHJvcG9zYWw6IGNoYXRQYXJ0aWNpcGFudEFkZGl0aW9ucy5gKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghcHJvdmlkZXJEZXNjcmlwdG9yLmlkIHx8ICFwcm92aWRlckRlc2NyaXB0b3IubmFtZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBFeHRlbnNpb24gJyR7ZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWV9JyBDQU5OT1QgcmVnaXN0ZXIgcGFydGljaXBhbnQgd2l0aG91dCBib3RoIGlkIGFuZCBuYW1lLmApO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgcGFydGljaXBhbnRzRGlzYW1iaWd1YXRpb246IHtcblx0XHRcdFx0XHRcdGNhdGVnb3J5OiBzdHJpbmc7XG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogc3RyaW5nO1xuXHRcdFx0XHRcdFx0ZXhhbXBsZXM6IHN0cmluZ1tdO1xuXHRcdFx0XHRcdH1bXSA9IFtdO1xuXG5cdFx0XHRcdFx0aWYgKHByb3ZpZGVyRGVzY3JpcHRvci5kaXNhbWJpZ3VhdGlvbj8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRwYXJ0aWNpcGFudHNEaXNhbWJpZ3VhdGlvbi5wdXNoKC4uLnByb3ZpZGVyRGVzY3JpcHRvci5kaXNhbWJpZ3VhdGlvbi5tYXAoKGQpID0+ICh7XG5cdFx0XHRcdFx0XHRcdC4uLmQsIGNhdGVnb3J5OiBkLmNhdGVnb3J5ID8/IGQuY2F0ZWdvcnlOYW1lXG5cdFx0XHRcdFx0XHR9KSkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0XHRcdHN0b3JlLmFkZCh0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyQWdlbnQoXG5cdFx0XHRcdFx0XHRcdHByb3ZpZGVyRGVzY3JpcHRvci5pZCxcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdGV4dGVuc2lvbklkOiBleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllcixcblx0XHRcdFx0XHRcdFx0XHRwdWJsaXNoZXJEaXNwbGF5TmFtZTogZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLnB1Ymxpc2hlckRpc3BsYXlOYW1lID8/IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5wdWJsaXNoZXIsIC8vIE1heSBub3QgYmUgcHJlc2VudCBpbiBPU1Ncblx0XHRcdFx0XHRcdFx0XHRleHRlbnNpb25QdWJsaXNoZXJJZDogZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLnB1Ymxpc2hlcixcblx0XHRcdFx0XHRcdFx0XHRleHRlbnNpb25EaXNwbGF5TmFtZTogZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmRpc3BsYXlOYW1lID8/IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5uYW1lLFxuXHRcdFx0XHRcdFx0XHRcdGlkOiBwcm92aWRlckRlc2NyaXB0b3IuaWQsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IHByb3ZpZGVyRGVzY3JpcHRvci5kZXNjcmlwdGlvbixcblx0XHRcdFx0XHRcdFx0XHR3aGVuOiBwcm92aWRlckRlc2NyaXB0b3Iud2hlbixcblx0XHRcdFx0XHRcdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRcdFx0XHRcdFx0aXNTdGlja3k6IHByb3ZpZGVyRGVzY3JpcHRvci5pc1N0aWNreSxcblx0XHRcdFx0XHRcdFx0XHRcdHNhbXBsZVJlcXVlc3Q6IHByb3ZpZGVyRGVzY3JpcHRvci5zYW1wbGVSZXF1ZXN0LFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogcHJvdmlkZXJEZXNjcmlwdG9yLm5hbWUsXG5cdFx0XHRcdFx0XHRcdFx0ZnVsbE5hbWU6IHByb3ZpZGVyRGVzY3JpcHRvci5mdWxsTmFtZSxcblx0XHRcdFx0XHRcdFx0XHRpc0RlZmF1bHQ6IHByb3ZpZGVyRGVzY3JpcHRvci5pc0RlZmF1bHQsXG5cdFx0XHRcdFx0XHRcdFx0aXNUb29sc0FnZW50OiBwcm92aWRlckRlc2NyaXB0b3IuaXNBZ2VudCxcblx0XHRcdFx0XHRcdFx0XHRsb2NhdGlvbnM6IGlzTm9uRW1wdHlBcnJheShwcm92aWRlckRlc2NyaXB0b3IubG9jYXRpb25zKSA/XG5cdFx0XHRcdFx0XHRcdFx0XHRwcm92aWRlckRlc2NyaXB0b3IubG9jYXRpb25zLm1hcChDaGF0QWdlbnRMb2NhdGlvbi5mcm9tUmF3KSA6XG5cdFx0XHRcdFx0XHRcdFx0XHRbQ2hhdEFnZW50TG9jYXRpb24uUGFuZWxdLFxuXHRcdFx0XHRcdFx0XHRcdHNsYXNoQ29tbWFuZHM6IHByb3ZpZGVyRGVzY3JpcHRvci5jb21tYW5kcyA/PyBbXSxcblx0XHRcdFx0XHRcdFx0XHRkaXNhbWJpZ3VhdGlvbjogY29hbGVzY2UocGFydGljaXBhbnRzRGlzYW1iaWd1YXRpb24uZmxhdCgpKSxcblx0XHRcdFx0XHRcdFx0fSBzYXRpc2ZpZXMgSUNoYXRBZ2VudERhdGEpKTtcblxuXHRcdFx0XHRcdFx0dGhpcy5fcGFydGljaXBhbnRSZWdpc3RyYXRpb25EaXNwb3NhYmxlcy5zZXQoXG5cdFx0XHRcdFx0XHRcdGdldFBhcnRpY2lwYW50S2V5KGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLCBwcm92aWRlckRlc2NyaXB0b3IuaWQpLFxuXHRcdFx0XHRcdFx0XHRzdG9yZVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEZhaWxlZCB0byByZWdpc3RlciBwYXJ0aWNpcGFudCAke3Byb3ZpZGVyRGVzY3JpcHRvci5pZH06ICR7dG9FcnJvck1lc3NhZ2UoZSwgdHJ1ZSl9YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGRlbHRhLnJlbW92ZWQpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBwcm92aWRlckRlc2NyaXB0b3Igb2YgZXh0ZW5zaW9uLnZhbHVlKSB7XG5cdFx0XHRcdFx0dGhpcy5fcGFydGljaXBhbnRSZWdpc3RyYXRpb25EaXNwb3NhYmxlcy5kZWxldGVBbmREaXNwb3NlKGdldFBhcnRpY2lwYW50S2V5KGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLCBwcm92aWRlckRlc2NyaXB0b3IuaWQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldFBhcnRpY2lwYW50S2V5KGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCBwYXJ0aWNpcGFudE5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBgJHtleHRlbnNpb25JZC52YWx1ZX1fJHtwYXJ0aWNpcGFudE5hbWV9YDtcbn1cblxuZXhwb3J0IGNsYXNzIENoYXRDb21wYXRpYmlsaXR5Tm90aWZpZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5jaGF0Q29tcGF0Tm90aWZpZXInO1xuXG5cdHByaXZhdGUgcmVnaXN0ZXJlZFdlbGNvbWVWaWV3ID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdC8vIEl0IG1heSBiZSBiZXR0ZXIgdG8gaGF2ZSBzb21lIGdlbmVyaWMgVUkgZm9yIHRoaXMsIGZvciBhbnkgZXh0ZW5zaW9uIHRoYXQgaXMgaW5jb21wYXRpYmxlLFxuXHRcdC8vIGJ1dCB0aGlzIGlzIG9ubHkgZW5hYmxlZCBmb3IgQ29waWxvdCBDaGF0IG5vdyBhbmQgaXQgbmVlZHMgdG8gYmUgb2J2aW91cy5cblx0XHRjb25zdCBpc0ludmFsaWQgPSBDaGF0Q29udGV4dEtleXMuZXh0ZW5zaW9uSW52YWxpZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LnJ1bkFuZFN1YnNjcmliZShcblx0XHRcdGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9uc05vdGlmaWNhdGlvbixcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uID0gZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9uc05vdGlmaWNhdGlvbigpO1xuXHRcdFx0XHRjb25zdCBjaGF0RXh0ZW5zaW9uID0gbm90aWZpY2F0aW9uPy5leHRlbnNpb25zLmZpbmQoZXh0ID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGV4dC5pZGVudGlmaWVyLmlkLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRlZmF1bHRDaGF0QWdlbnQ/LmNoYXRFeHRlbnNpb25JZCkpO1xuXHRcdFx0XHRpZiAoY2hhdEV4dGVuc2lvbikge1xuXHRcdFx0XHRcdGlzSW52YWxpZC5zZXQodHJ1ZSk7XG5cdFx0XHRcdFx0dGhpcy5yZWdpc3RlcldlbGNvbWVWaWV3KGNoYXRFeHRlbnNpb24pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlzSW52YWxpZC5zZXQoZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyV2VsY29tZVZpZXcoY2hhdEV4dGVuc2lvbjogSUV4dGVuc2lvbikge1xuXHRcdGlmICh0aGlzLnJlZ2lzdGVyZWRXZWxjb21lVmlldykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMucmVnaXN0ZXJlZFdlbGNvbWVWaWV3ID0gdHJ1ZTtcblx0XHRjb25zdCBzaG93RXh0ZW5zaW9uTGFiZWwgPSBsb2NhbGl6ZSgnc2hvd0V4dGVuc2lvbicsIFwiU2hvdyBFeHRlbnNpb25cIik7XG5cdFx0Y29uc3QgbWFpbk1lc3NhZ2UgPSBsb2NhbGl6ZSgnY2hhdEZhaWxFcnJvck1lc3NhZ2UnLCBcIkNoYXQgZmFpbGVkIHRvIGxvYWQgYmVjYXVzZSB0aGUgaW5zdGFsbGVkIHZlcnNpb24gb2YgdGhlIENvcGlsb3QgQ2hhdCBleHRlbnNpb24gaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGlzIHZlcnNpb24gb2YgezB9LiBQbGVhc2UgZW5zdXJlIHRoYXQgdGhlIENvcGlsb3QgQ2hhdCBleHRlbnNpb24gaXMgdXAgdG8gZGF0ZS5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyk7XG5cdFx0Y29uc3QgY29tbWFuZEJ1dHRvbiA9IGBbJHtzaG93RXh0ZW5zaW9uTGFiZWx9XShjb21tYW5kOiR7c2hvd0V4dGVuc2lvbnNXaXRoSWRzQ29tbWFuZElkfT8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShbW3RoaXMucHJvZHVjdFNlcnZpY2UuZGVmYXVsdENoYXRBZ2VudD8uY2hhdEV4dGVuc2lvbklkXV0pKX0pYDtcblx0XHRjb25zdCB2ZXJzaW9uTWVzc2FnZSA9IGBDb3BpbG90IENoYXQgdmVyc2lvbjogJHtjaGF0RXh0ZW5zaW9uLnZlcnNpb259YDtcblx0XHRjb25zdCB2aWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KFZpZXdFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3V2VsY29tZUNvbnRlbnQoQ2hhdFZpZXdJZCwge1xuXHRcdFx0Y29udGVudDogW21haW5NZXNzYWdlLCBjb21tYW5kQnV0dG9uLCB2ZXJzaW9uTWVzc2FnZV0uam9pbignXFxuXFxuJyksXG5cdFx0XHR3aGVuOiBDaGF0Q29udGV4dEtleXMuZXh0ZW5zaW9uSW52YWxpZCxcblx0XHR9KSk7XG5cdH1cbn1cblxuY2xhc3MgQ2hhdFBhcnRpY2lwYW50RGF0YVJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciB7XG5cdHJlYWRvbmx5IHR5cGUgPSAndGFibGUnO1xuXG5cdHNob3VsZFJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhbWFuaWZlc3QuY29udHJpYnV0ZXM/LmNoYXRQYXJ0aWNpcGFudHM7XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SVRhYmxlRGF0YT4ge1xuXHRcdGNvbnN0IG5vbkRlZmF1bHRDb250cmlidXRpb25zID0gbWFuaWZlc3QuY29udHJpYnV0ZXM/LmNoYXRQYXJ0aWNpcGFudHM/LmZpbHRlcihjID0+ICFjLmlzRGVmYXVsdCkgPz8gW107XG5cdFx0aWYgKCFub25EZWZhdWx0Q29udHJpYnV0aW9ucy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB7IGRhdGE6IHsgaGVhZGVyczogW10sIHJvd3M6IFtdIH0sIGRpc3Bvc2U6ICgpID0+IHsgfSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlcnMgPSBbXG5cdFx0XHRsb2NhbGl6ZSgncGFydGljaXBhbnROYW1lJywgXCJOYW1lXCIpLFxuXHRcdFx0bG9jYWxpemUoJ3BhcnRpY2lwYW50RnVsbE5hbWUnLCBcIkZ1bGwgTmFtZVwiKSxcblx0XHRcdGxvY2FsaXplKCdwYXJ0aWNpcGFudERlc2NyaXB0aW9uJywgXCJEZXNjcmlwdGlvblwiKSxcblx0XHRcdGxvY2FsaXplKCdwYXJ0aWNpcGFudENvbW1hbmRzJywgXCJDb21tYW5kc1wiKSxcblx0XHRdO1xuXG5cdFx0Y29uc3Qgcm93czogSVJvd0RhdGFbXVtdID0gbm9uRGVmYXVsdENvbnRyaWJ1dGlvbnMubWFwKGQgPT4ge1xuXHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0J0AnICsgZC5uYW1lLFxuXHRcdFx0XHRkLmZ1bGxOYW1lLFxuXHRcdFx0XHRkLmRlc2NyaXB0aW9uID8/ICctJyxcblx0XHRcdFx0ZC5jb21tYW5kcz8ubGVuZ3RoID8gbmV3IE1hcmtkb3duU3RyaW5nKGQuY29tbWFuZHMubWFwKGMgPT4gYC0gL2AgKyBjLm5hbWUpLmpvaW4oJ1xcbicpKSA6ICctJ1xuXHRcdFx0XTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRhOiB7XG5cdFx0XHRcdGhlYWRlcnMsXG5cdFx0XHRcdHJvd3Ncblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHR9O1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5PihFeHRlbnNpb25zLkV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnkpLnJlZ2lzdGVyRXh0ZW5zaW9uRmVhdHVyZSh7XG5cdGlkOiAnY2hhdFBhcnRpY2lwYW50cycsXG5cdGxhYmVsOiBsb2NhbGl6ZSgnY2hhdFBhcnRpY2lwYW50cycsIFwiQ2hhdCBQYXJ0aWNpcGFudHNcIiksXG5cdGFjY2Vzczoge1xuXHRcdGNhblRvZ2dsZTogZmFsc2Vcblx0fSxcblx0cmVuZGVyZXI6IG5ldyBTeW5jRGVzY3JpcHRvcihDaGF0UGFydGljaXBhbnREYXRhUmVuZGVyZXIpLFxufSk7XG5cblxuLy8gVm9pZCBjb21tZW50ZWQgdGhpcyBvdXRcbi8vIC8vIFRPRE9Acm9ibG91cmVucyByZW1vdmUgYWZ0ZXIgYSBmZXcgbW9udGhzXG5cbi8vIGV4cG9ydCBjbGFzcyBNb3ZlZENoYXRFZGl0c1ZpZXdQYW5lIGV4dGVuZHMgVmlld1BhbmUge1xuLy8gXHRvdmVycmlkZSBzaG91bGRTaG93V2VsY29tZSgpOiBib29sZWFuIHtcbi8vIFx0XHRyZXR1cm4gdHJ1ZTtcbi8vIFx0fVxuLy8gfVxuXG4vLyBjb25zdCBlZGl0c1ZpZXdJZCA9ICd3b3JrYmVuY2gucGFuZWwuY2hhdC52aWV3LmVkaXRzJztcbi8vIGNvbnN0IGJhc2VFZGl0c1ZpZXdEZXNjcmlwdG9yOiBJVmlld0Rlc2NyaXB0b3IgPSB7XG4vLyBcdGlkOiBlZGl0c1ZpZXdJZCxcbi8vIFx0Y29udGFpbmVySWNvbjogZWRpdHNWaWV3Q29udGFpbmVyLmljb24sXG4vLyBcdGNvbnRhaW5lclRpdGxlOiBlZGl0c1ZpZXdDb250YWluZXIudGl0bGUudmFsdWUsXG4vLyBcdHNpbmdsZVZpZXdQYW5lQ29udGFpbmVyVGl0bGU6IGVkaXRzVmlld0NvbnRhaW5lci50aXRsZS52YWx1ZSxcbi8vIFx0bmFtZTogZWRpdHNWaWV3Q29udGFpbmVyLnRpdGxlLFxuLy8gXHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiBmYWxzZSxcbi8vIFx0Y2FuTW92ZVZpZXc6IHRydWUsXG4vLyBcdG9wZW5Db21tYW5kQWN0aW9uRGVzY3JpcHRvcjoge1xuLy8gXHRcdGlkOiBDSEFUX0VESVRJTkdfU0lERUJBUl9QQU5FTF9JRCxcbi8vIFx0XHR0aXRsZTogZWRpdHNWaWV3Q29udGFpbmVyLnRpdGxlLFxuLy8gXHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlUb2dnbGVFZGl0cycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJDb3BpbG90IEVkJiZpdHNcIiksXG4vLyBcdFx0a2V5YmluZGluZ3M6IHtcbi8vIFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlJLFxuLy8gXHRcdFx0bGludXg6IHtcbi8vIFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlJXG4vLyBcdFx0XHR9XG4vLyBcdFx0fSxcbi8vIFx0XHRvcmRlcjogMlxuLy8gXHR9LFxuLy8gXHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKENoYXRWaWV3UGFuZSwgW3sgbG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uIH1dKSxcbi8vIFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuLy8gXHRcdENvbnRleHRLZXlFeHByLmhhcyhgY29uZmlnLiR7Q2hhdENvbmZpZ3VyYXRpb24uVW5pZmllZENoYXRWaWV3fWApLm5lZ2F0ZSgpLFxuLy8gXHRcdENvbnRleHRLZXlFeHByLm9yKFxuLy8gXHRcdFx0Q2hhdENvbnRleHRLZXlzLlNldHVwLmhpZGRlbi5uZWdhdGUoKSxcbi8vIFx0XHRcdENoYXRDb250ZXh0S2V5cy5TZXR1cC5pbnN0YWxsZWQsXG4vLyBcdFx0XHRDaGF0Q29udGV4dEtleXMuZWRpdGluZ1BhcnRpY2lwYW50UmVnaXN0ZXJlZFxuLy8gXHRcdClcbi8vIFx0KVxuLy8gfTtcblxuLy8gY29uc3QgU2hvd01vdmVkQ2hhdEVkaXRzVmlldyA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzaG93TW92ZWRDaGF0RWRpdHNWaWV3JywgdHJ1ZSwgeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaGlkZU1vdmVkQ2hhdEVkaXRzVmlldycsIFwiVHJ1ZSB3aGVuIHRoZSBtb3ZlZCBjaGF0IGVkaXRzIHZpZXcgc2hvdWxkIGJlIGhpZGRlbi5cIikgfSk7XG5cbi8vIGNsYXNzIEVkaXRzVmlld0NvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcbi8vIFx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmNoYXRFZGl0c1ZpZXcnO1xuXG4vLyBcdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEhpZGVNb3ZlZEVkaXRzVmlld0tleSA9ICdjaGF0RWRpdHNWaWV3LmhpZGVNb3ZlZEVkaXRzVmlldyc7XG5cbi8vIFx0cHJpdmF0ZSByZWFkb25seSBzaG93V2VsY29tZVZpZXdDdHg6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG4vLyBcdGNvbnN0cnVjdG9yKFxuLy8gXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuLy8gXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuLy8gXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuLy8gXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuLy8gXHQpIHtcbi8vIFx0XHRzdXBlcigpO1xuXG4vLyBcdFx0dGhpcy5zaG93V2VsY29tZVZpZXdDdHggPSBTaG93TW92ZWRDaGF0RWRpdHNWaWV3LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuLy8gXHRcdGNvbnN0IHVuaWZpZWRWaWV3RW5hYmxlZCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQ2hhdENvbmZpZ3VyYXRpb24uVW5pZmllZENoYXRWaWV3KTtcblxuLy8gXHRcdGNvbnN0IG1vdmVkRWRpdHNWaWV3RGVzY3JpcHRvciA9IHtcbi8vIFx0XHRcdC4uLmJhc2VFZGl0c1ZpZXdEZXNjcmlwdG9yLFxuLy8gXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihNb3ZlZENoYXRFZGl0c1ZpZXdQYW5lKSxcbi8vIFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcbi8vIFx0XHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKGBjb25maWcuJHtDaGF0Q29uZmlndXJhdGlvbi5VbmlmaWVkQ2hhdFZpZXd9YCksXG4vLyBcdFx0XHRcdFNob3dNb3ZlZENoYXRFZGl0c1ZpZXcsXG4vLyBcdFx0XHRcdENvbnRleHRLZXlFeHByLm9yKFxuLy8gXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5TZXR1cC5oaWRkZW4ubmVnYXRlKCksXG4vLyBcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLlNldHVwLmluc3RhbGxlZCxcbi8vIFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuZWRpdGluZ1BhcnRpY2lwYW50UmVnaXN0ZXJlZFxuLy8gXHRcdFx0XHQpXG4vLyBcdFx0XHQpXG4vLyBcdFx0fTtcblxuLy8gXHRcdGNvbnN0IGVkaXRzVmlld1RvUmVnaXN0ZXIgPSB1bmlmaWVkVmlld0VuYWJsZWQgP1xuLy8gXHRcdFx0bW92ZWRFZGl0c1ZpZXdEZXNjcmlwdG9yIDogYmFzZUVkaXRzVmlld0Rlc2NyaXB0b3I7XG5cbi8vIFx0XHRpZiAodW5pZmllZFZpZXdFbmFibGVkKSB7XG4vLyBcdFx0XHR0aGlzLmluaXQoKTtcbi8vIFx0XHRcdHRoaXMudXBkYXRlQ29udGV4dEtleSgpO1xuLy8gXHRcdFx0dGhpcy5yZWdpc3RlcldlbGNvbWVWaWV3KCk7XG4vLyBcdFx0XHR0aGlzLnJlZ2lzdGVyQ29tbWFuZHMoKTtcbi8vIFx0XHR9XG4vLyBcdFx0UmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KFZpZXdFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpLnJlZ2lzdGVyVmlld3MoW2VkaXRzVmlld1RvUmVnaXN0ZXJdLCBlZGl0c1ZpZXdDb250YWluZXIpO1xuLy8gXHR9XG5cbi8vIFx0cHJpdmF0ZSByZWdpc3RlcldlbGNvbWVWaWV3KCk6IHZvaWQge1xuLy8gXHRcdGNvbnN0IHdlbGNvbWVWaWV3TWFpbk1lc3NhZ2UgPSBsb2NhbGl6ZSgnZWRpdHNNb3ZlZE1haW5NZXNzYWdlJywgXCJDb3BpbG90IEVkaXRzIGhhcyBiZWVuIG1vdmVkIHRvIHRoZSBbbWFpbiBDaGF0IHZpZXddKGNvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5jaGF0Lm9wZW4pLiBZb3UgY2FuIHN3aXRjaCBiZXR3ZWVuIG1vZGVzIGJ5IHVzaW5nIHRoZSBkcm9wZG93biBpbiB0aGUgQ2hhdCBpbnB1dCBib3guXCIpO1xuLy8gXHRcdGNvbnN0IG9rQnV0dG9uID0gYFske2xvY2FsaXplKCdvaycsIFwiR290IGl0XCIpfV0oY29tbWFuZDpfbW92ZWRFZGl0c1ZpZXcub2spYDtcbi8vIFx0XHRjb25zdCB3ZWxjb21lVmlld0Zvb3Rlck1lc3NhZ2UgPSBsb2NhbGl6ZSgnZWRpdHNNb3ZlZEZvb3Rlck1lc3NhZ2UnLCBcIltMZWFybiBtb3JlXShjb21tYW5kOl9tb3ZlZEVkaXRzVmlldy5sZWFybk1vcmUpIGFib3V0IHRoZSBDaGF0IHZpZXcuXCIpO1xuXG4vLyBcdFx0Y29uc3Qgdmlld3NSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihWaWV3RXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KTtcbi8vIFx0XHR0aGlzLl9yZWdpc3Rlcih2aWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld1dlbGNvbWVDb250ZW50KGVkaXRzVmlld0lkLCB7XG4vLyBcdFx0XHRjb250ZW50OiBbd2VsY29tZVZpZXdNYWluTWVzc2FnZSwgb2tCdXR0b24sIHdlbGNvbWVWaWV3Rm9vdGVyTWVzc2FnZV0uam9pbignXFxuXFxuJyksXG4vLyBcdFx0XHRyZW5kZXJTZWNvbmRhcnlCdXR0b25zOiB0cnVlLFxuLy8gXHRcdFx0d2hlbjogU2hvd01vdmVkQ2hhdEVkaXRzVmlld1xuLy8gXHRcdH0pKTtcbi8vIFx0fVxuXG4vLyBcdHByaXZhdGUgbWFya1ZpZXdUb0hpZGUoKTogdm9pZCB7XG4vLyBcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShFZGl0c1ZpZXdDb250cmlidXRpb24uSGlkZU1vdmVkRWRpdHNWaWV3S2V5LCB0cnVlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG4vLyBcdFx0dGhpcy51cGRhdGVDb250ZXh0S2V5KCk7XG4vLyBcdH1cblxuLy8gXHRwcml2YXRlIGluaXQoKSB7XG4vLyBcdFx0Y29uc3QgaGFzQ2hhdHMgPSB0aGlzLmNoYXRTZXJ2aWNlLmhhc1Nlc3Npb25zKCk7XG4vLyBcdFx0aWYgKCFoYXNDaGF0cykge1xuLy8gXHRcdFx0Ly8gTm8gY2hhdHMgZnJvbSBwcmV2aW91cyBzZXNzaW9ucywgbWlnaHQgYmUgYSBuZXcgdXNlciwgc28gaGlkZSB0aGUgdmlldy5cbi8vIFx0XHRcdC8vIENvdWxkIGFsc28gYmUgYSBwcmV2aW91cyB1c2VyIHdobyBoYXBwZW5lZCB0byBmaXJzdCBvcGVuIGEgd29ya3NwYWNlIHdpdGggbm8gY2hhdHMuXG4vLyBcdFx0XHR0aGlzLm1hcmtWaWV3VG9IaWRlKCk7XG4vLyBcdFx0fVxuLy8gXHR9XG5cbi8vIFx0cHJpdmF0ZSB1cGRhdGVDb250ZXh0S2V5KCk6IHZvaWQge1xuLy8gXHRcdGNvbnN0IGhpZGRlbiA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbihFZGl0c1ZpZXdDb250cmlidXRpb24uSGlkZU1vdmVkRWRpdHNWaWV3S2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIGZhbHNlKTtcbi8vIFx0XHRjb25zdCBoYXNDaGF0cyA9IHRoaXMuY2hhdFNlcnZpY2UuaGFzU2Vzc2lvbnMoKTtcbi8vIFx0XHR0aGlzLnNob3dXZWxjb21lVmlld0N0eC5zZXQoIWhpZGRlbiAmJiBoYXNDaGF0cyk7XG4vLyBcdH1cblxuLy8gXHRwcml2YXRlIHJlZ2lzdGVyQ29tbWFuZHMoKTogdm9pZCB7XG4vLyBcdFx0dGhpcy5fcmVnaXN0ZXIoQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuLy8gXHRcdFx0aWQ6ICdfbW92ZWRFZGl0c1ZpZXcub2snLFxuLy8gXHRcdFx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG4vLyBcdFx0XHRcdHNob3dDaGF0VmlldyhhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkpO1xuLy8gXHRcdFx0XHR0aGlzLm1hcmtWaWV3VG9IaWRlKCk7XG4vLyBcdFx0XHR9XG4vLyBcdFx0fSkpO1xuLy8gXHRcdHRoaXMuX3JlZ2lzdGVyKENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcbi8vIFx0XHRcdGlkOiAnX21vdmVkRWRpdHNWaWV3LmxlYXJuTW9yZScsXG4vLyBcdFx0XHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcbi8vIFx0XHRcdFx0Y29uc3Qgb3BlbmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJT3BlbmVyU2VydmljZSk7XG4vLyBcdFx0XHRcdG9wZW5lclNlcnZpY2Uub3BlbihVUkkucGFyc2UoJ2h0dHBzOi8vYWthLm1zL3ZzY29kZS1jaGF0LW1vZGVzJykpO1xuLy8gXHRcdFx0fVxuLy8gXHRcdH0pKTtcbi8vIFx0fVxuLy8gfVxuXG4vLyByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoRWRpdHNWaWV3Q29udHJpYnV0aW9uLklELCBFZGl0c1ZpZXdDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsVUFBVSx1QkFBdUI7QUFFMUMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsWUFBWSxlQUFlLHVCQUF1QjtBQUMzRCxZQUFZLGFBQWE7QUFHekIsU0FBUyxnQkFBZ0I7QUFHekIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywy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SUFDdkIsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUNEO0FBOUNhLDBCQUNJLEtBQUs7QUFEVCw0QkFBTjtBQUFBLEVBTUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUlU7QUFnRGIsTUFBTSxvQ0FBb0MsV0FBcUQ7QUFBQSxFQUEvRjtBQUFBO0FBQ0MsU0FBUyxPQUFPO0FBQUE7QUFBQSxFQUVoQixhQUFhLFVBQXVDO0FBQ25ELFdBQU8sQ0FBQyxDQUFDLFNBQVMsYUFBYTtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxPQUFPLFVBQXlEO0FBQy9ELFVBQU0sMEJBQTBCLFNBQVMsYUFBYSxrQkFBa0IsT0FBTyxPQUFLLENBQUMsRUFBRSxTQUFTLEtBQUssQ0FBQztBQUN0RyxRQUFJLENBQUMsd0JBQXdCLFFBQVE7QUFDcEMsYUFBTyxFQUFFLE1BQU0sRUFBRSxTQUFTLENBQUMsR0FBRyxNQUFNLENBQUMsRUFBRSxHQUFHLFNBQVMsTUFBTTtBQUFBLE1BQUUsRUFBRTtBQUFBLElBQzlEO0FBRUEsVUFBTSxVQUFVO0FBQUEsTUFDZixTQUFTLG1CQUFtQixNQUFNO0FBQUEsTUFDbEMsU0FBUyx1QkFBdUIsV0FBVztBQUFBLE1BQzNDLFNBQVMsMEJBQTBCLGFBQWE7QUFBQSxNQUNoRCxTQUFTLHVCQUF1QixVQUFVO0FBQUEsSUFDM0M7QUFFQSxVQUFNLE9BQXFCLHdCQUF3QixJQUFJLE9BQUs7QUFDM0QsYUFBTztBQUFBLFFBQ04sTUFBTSxFQUFFO0FBQUEsUUFDUixFQUFFO0FBQUEsUUFDRixFQUFFLGVBQWU7QUFBQSxRQUNqQixFQUFFLFVBQVUsU0FBUyxJQUFJLGVBQWUsRUFBRSxTQUFTLElBQUksT0FBSyxRQUFRLEVBQUUsSUFBSSxFQUFFLEtBQUssSUFBSSxDQUFDLElBQUk7QUFBQSxNQUMzRjtBQUFBLElBQ0QsQ0FBQztBQUVELFdBQU87QUFBQSxNQUNOLE1BQU07QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLFNBQVMsTUFBTTtBQUFBLE1BQUU7QUFBQSxJQUNsQjtBQUFBLEVBQ0Q7QUFDRDtBQUVBLFNBQVMsR0FBK0IsV0FBVyx5QkFBeUIsRUFBRSx5QkFBeUI7QUFBQSxFQUN0RyxJQUFJO0FBQUEsRUFDSixPQUFPLFNBQVMsb0JBQW9CLG1CQUFtQjtBQUFBLEVBQ3ZELFFBQVE7QUFBQSxJQUNQLFdBQVc7QUFBQSxFQUNaO0FBQUEsRUFDQSxVQUFVLElBQUksZUFBZSwyQkFBMkI7QUFDekQsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
