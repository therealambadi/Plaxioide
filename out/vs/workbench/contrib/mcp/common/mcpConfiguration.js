import { localize } from "../../../../nls.js";
import { mcpSchemaId } from "../../../services/configuration/common/configuration.js";
import { inputsSchema } from "../../../services/configurationResolver/common/configurationResolverSchema.js";
const mcpActivationEventPrefix = "onMcpCollection:";
const mcpActivationEvent = (collectionId) => mcpActivationEventPrefix + collectionId;
const mcpSchemaExampleServer = {
  command: "node",
  args: ["my-mcp-server.js"],
  env: {}
};
var DiscoverySource = /* @__PURE__ */ ((DiscoverySource2) => {
  DiscoverySource2["ClaudeDesktop"] = "claude-desktop";
  DiscoverySource2["Windsurf"] = "windsurf";
  DiscoverySource2["CursorGlobal"] = "cursor-global";
  DiscoverySource2["CursorWorkspace"] = "cursor-workspace";
  return DiscoverySource2;
})(DiscoverySource || {});
const allDiscoverySources = Object.keys({
  ["claude-desktop" /* ClaudeDesktop */]: true,
  ["windsurf" /* Windsurf */]: true,
  ["cursor-global" /* CursorGlobal */]: true,
  ["cursor-workspace" /* CursorWorkspace */]: true
});
const discoverySourceLabel = {
  ["claude-desktop" /* ClaudeDesktop */]: localize("mcp.discovery.source.claude-desktop", "Claude Desktop"),
  ["windsurf" /* Windsurf */]: localize("mcp.discovery.source.windsurf", "Windsurf"),
  ["cursor-global" /* CursorGlobal */]: localize("mcp.discovery.source.cursor-global", "Cursor (Global)"),
  ["cursor-workspace" /* CursorWorkspace */]: localize("mcp.discovery.source.cursor-workspace", "Cursor (Workspace)")
};
const mcpConfigurationSection = "mcp";
const mcpDiscoverySection = "chat.mcp.discovery.enabled";
const mcpEnabledSection = "chat.mcp.enabled";
const mcpSchemaExampleServers = {
  "mcp-server-time": {
    command: "python",
    args: ["-m", "mcp_server_time", "--local-timezone=America/Los_Angeles"],
    env: {}
  }
};
const mcpStdioServerSchema = {
  type: "object",
  additionalProperties: false,
  examples: [mcpSchemaExampleServer],
  properties: {
    type: {
      type: "string",
      enum: ["stdio"],
      description: localize("app.mcp.json.type", "The type of the server.")
    },
    command: {
      type: "string",
      description: localize("app.mcp.json.command", "The command to run the server.")
    },
    args: {
      type: "array",
      description: localize("app.mcp.args.command", "Arguments passed to the server."),
      items: {
        type: "string"
      }
    },
    envFile: {
      type: "string",
      description: localize("app.mcp.envFile.command", "Path to a file containing environment variables for the server."),
      examples: ["${workspaceFolder}/.env"]
    },
    env: {
      description: localize("app.mcp.env.command", "Environment variables passed to the server."),
      additionalProperties: {
        anyOf: [
          { type: "null" },
          { type: "string" },
          { type: "number" }
        ]
      }
    }
  }
};
const mcpServerSchema = {
  id: mcpSchemaId,
  type: "object",
  title: localize("app.mcp.json.title", "Model Context Protocol Servers"),
  allowTrailingCommas: true,
  allowComments: true,
  additionalProperties: false,
  properties: {
    servers: {
      examples: [mcpSchemaExampleServers],
      additionalProperties: {
        oneOf: [mcpStdioServerSchema, {
          type: "object",
          additionalProperties: false,
          required: ["url", "type"],
          examples: [{
            type: "sse",
            url: "http://localhost:3001",
            headers: {}
          }],
          properties: {
            type: {
              type: "string",
              enum: ["sse"],
              description: localize("app.mcp.json.type", "The type of the server.")
            },
            url: {
              type: "string",
              format: "uri",
              description: localize("app.mcp.json.url", "The URL of the server-sent-event (SSE) server.")
            },
            env: {
              description: localize("app.mcp.json.headers", "Additional headers sent to the server."),
              additionalProperties: { type: "string" }
            }
          }
        }]
      }
    },
    inputs: inputsSchema.definitions.inputs
  }
};
const mcpContributionPoint = {
  extensionPoint: "modelContextServerCollections",
  activationEventsGenerator(contribs, result) {
    for (const contrib of contribs) {
      if (contrib.id) {
        result.push(mcpActivationEvent(contrib.id));
      }
    }
  },
  jsonSchema: {
    description: localize("vscode.extension.contributes.mcp", "Contributes Model Context Protocol servers. Users of this should also use `vscode.lm.registerMcpConfigurationProvider`."),
    type: "array",
    defaultSnippets: [{ body: [{ id: "", label: "" }] }],
    items: {
      additionalProperties: false,
      type: "object",
      defaultSnippets: [{ body: { id: "", label: "" } }],
      properties: {
        id: {
          description: localize("vscode.extension.contributes.mcp.id", "Unique ID for the collection."),
          type: "string"
        },
        label: {
          description: localize("vscode.extension.contributes.mcp.label", "Display name for the collection."),
          type: "string"
        }
      }
    }
  }
};
export {
  DiscoverySource,
  allDiscoverySources,
  discoverySourceLabel,
  mcpActivationEvent,
  mcpConfigurationSection,
  mcpContributionPoint,
  mcpDiscoverySection,
  mcpEnabledSection,
  mcpSchemaExampleServers,
  mcpServerSchema,
  mcpStdioServerSchema
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcENvbmZpZ3VyYXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU1jcENvbGxlY3Rpb25Db250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IG1jcFNjaGVtYUlkIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBpbnB1dHNTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlclNjaGVtYS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uUG9pbnREZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uc1JlZ2lzdHJ5LmpzJztcblxuZXhwb3J0IHR5cGUgeyBNY3BDb25maWd1cmF0aW9uU2VydmVyLCBJTWNwQ29uZmlndXJhdGlvblN0ZGlvLCBJTWNwQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21jcC9jb21tb24vbWNwUGxhdGZvcm1UeXBlcy5qcyc7XG5cbmNvbnN0IG1jcEFjdGl2YXRpb25FdmVudFByZWZpeCA9ICdvbk1jcENvbGxlY3Rpb246JztcblxuZXhwb3J0IGNvbnN0IG1jcEFjdGl2YXRpb25FdmVudCA9IChjb2xsZWN0aW9uSWQ6IHN0cmluZykgPT4gbWNwQWN0aXZhdGlvbkV2ZW50UHJlZml4ICsgY29sbGVjdGlvbklkO1xuXG5jb25zdCBtY3BTY2hlbWFFeGFtcGxlU2VydmVyID0ge1xuXHRjb21tYW5kOiAnbm9kZScsXG5cdGFyZ3M6IFsnbXktbWNwLXNlcnZlci5qcyddLFxuXHRlbnY6IHt9LFxufTtcblxuZXhwb3J0IGNvbnN0IGVudW0gRGlzY292ZXJ5U291cmNlIHtcblx0Q2xhdWRlRGVza3RvcCA9ICdjbGF1ZGUtZGVza3RvcCcsXG5cdFdpbmRzdXJmID0gJ3dpbmRzdXJmJyxcblx0Q3Vyc29yR2xvYmFsID0gJ2N1cnNvci1nbG9iYWwnLFxuXHRDdXJzb3JXb3Jrc3BhY2UgPSAnY3Vyc29yLXdvcmtzcGFjZScsXG59XG5cbmV4cG9ydCBjb25zdCBhbGxEaXNjb3ZlcnlTb3VyY2VzID0gT2JqZWN0LmtleXMoe1xuXHRbRGlzY292ZXJ5U291cmNlLkNsYXVkZURlc2t0b3BdOiB0cnVlLFxuXHRbRGlzY292ZXJ5U291cmNlLldpbmRzdXJmXTogdHJ1ZSxcblx0W0Rpc2NvdmVyeVNvdXJjZS5DdXJzb3JHbG9iYWxdOiB0cnVlLFxuXHRbRGlzY292ZXJ5U291cmNlLkN1cnNvcldvcmtzcGFjZV06IHRydWUsXG59IHNhdGlzZmllcyBSZWNvcmQ8RGlzY292ZXJ5U291cmNlLCB0cnVlPikgYXMgRGlzY292ZXJ5U291cmNlW107XG5cbmV4cG9ydCBjb25zdCBkaXNjb3ZlcnlTb3VyY2VMYWJlbDogUmVjb3JkPERpc2NvdmVyeVNvdXJjZSwgc3RyaW5nPiA9IHtcblx0W0Rpc2NvdmVyeVNvdXJjZS5DbGF1ZGVEZXNrdG9wXTogbG9jYWxpemUoJ21jcC5kaXNjb3Zlcnkuc291cmNlLmNsYXVkZS1kZXNrdG9wJywgXCJDbGF1ZGUgRGVza3RvcFwiKSxcblx0W0Rpc2NvdmVyeVNvdXJjZS5XaW5kc3VyZl06IGxvY2FsaXplKCdtY3AuZGlzY292ZXJ5LnNvdXJjZS53aW5kc3VyZicsIFwiV2luZHN1cmZcIiksXG5cdFtEaXNjb3ZlcnlTb3VyY2UuQ3Vyc29yR2xvYmFsXTogbG9jYWxpemUoJ21jcC5kaXNjb3Zlcnkuc291cmNlLmN1cnNvci1nbG9iYWwnLCBcIkN1cnNvciAoR2xvYmFsKVwiKSxcblx0W0Rpc2NvdmVyeVNvdXJjZS5DdXJzb3JXb3Jrc3BhY2VdOiBsb2NhbGl6ZSgnbWNwLmRpc2NvdmVyeS5zb3VyY2UuY3Vyc29yLXdvcmtzcGFjZScsIFwiQ3Vyc29yIChXb3Jrc3BhY2UpXCIpLFxufTtcblxuZXhwb3J0IGNvbnN0IG1jcENvbmZpZ3VyYXRpb25TZWN0aW9uID0gJ21jcCc7XG5leHBvcnQgY29uc3QgbWNwRGlzY292ZXJ5U2VjdGlvbiA9ICdjaGF0Lm1jcC5kaXNjb3ZlcnkuZW5hYmxlZCc7XG5leHBvcnQgY29uc3QgbWNwRW5hYmxlZFNlY3Rpb24gPSAnY2hhdC5tY3AuZW5hYmxlZCc7XG5cbmV4cG9ydCBjb25zdCBtY3BTY2hlbWFFeGFtcGxlU2VydmVycyA9IHtcblx0J21jcC1zZXJ2ZXItdGltZSc6IHtcblx0XHRjb21tYW5kOiAncHl0aG9uJyxcblx0XHRhcmdzOiBbJy1tJywgJ21jcF9zZXJ2ZXJfdGltZScsICctLWxvY2FsLXRpbWV6b25lPUFtZXJpY2EvTG9zX0FuZ2VsZXMnXSxcblx0XHRlbnY6IHt9LFxuXHR9XG59O1xuXG5leHBvcnQgY29uc3QgbWNwU3RkaW9TZXJ2ZXJTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnb2JqZWN0Jyxcblx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRleGFtcGxlczogW21jcFNjaGVtYUV4YW1wbGVTZXJ2ZXJdLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0dHlwZToge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ3N0ZGlvJ10sXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FwcC5tY3AuanNvbi50eXBlJywgXCJUaGUgdHlwZSBvZiB0aGUgc2VydmVyLlwiKVxuXHRcdH0sXG5cdFx0Y29tbWFuZDoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FwcC5tY3AuanNvbi5jb21tYW5kJywgXCJUaGUgY29tbWFuZCB0byBydW4gdGhlIHNlcnZlci5cIilcblx0XHR9LFxuXHRcdGFyZ3M6IHtcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FwcC5tY3AuYXJncy5jb21tYW5kJywgXCJBcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBzZXJ2ZXIuXCIpLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdH0sXG5cdFx0fSxcblx0XHRlbnZGaWxlOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXBwLm1jcC5lbnZGaWxlLmNvbW1hbmQnLCBcIlBhdGggdG8gYSBmaWxlIGNvbnRhaW5pbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciB0aGUgc2VydmVyLlwiKSxcblx0XHRcdGV4YW1wbGVzOiBbJyR7d29ya3NwYWNlRm9sZGVyfS8uZW52J10sXG5cdFx0fSxcblx0XHRlbnY6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXBwLm1jcC5lbnYuY29tbWFuZCcsIFwiRW52aXJvbm1lbnQgdmFyaWFibGVzIHBhc3NlZCB0byB0aGUgc2VydmVyLlwiKSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdFx0eyB0eXBlOiAnbnVsbCcgfSxcblx0XHRcdFx0XHR7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdFx0XHRcdFx0eyB0eXBlOiAnbnVtYmVyJyB9LFxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0fSxcblx0fVxufTtcblxuZXhwb3J0IGNvbnN0IG1jcFNlcnZlclNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdGlkOiBtY3BTY2hlbWFJZCxcblx0dHlwZTogJ29iamVjdCcsXG5cdHRpdGxlOiBsb2NhbGl6ZSgnYXBwLm1jcC5qc29uLnRpdGxlJywgXCJNb2RlbCBDb250ZXh0IFByb3RvY29sIFNlcnZlcnNcIiksXG5cdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdGFsbG93Q29tbWVudHM6IHRydWUsXG5cdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0cHJvcGVydGllczoge1xuXHRcdHNlcnZlcnM6IHtcblx0XHRcdGV4YW1wbGVzOiBbbWNwU2NoZW1hRXhhbXBsZVNlcnZlcnNdLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0b25lT2Y6IFttY3BTdGRpb1NlcnZlclNjaGVtYSwge1xuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0XHRcdFx0XHRyZXF1aXJlZDogWyd1cmwnLCAndHlwZSddLFxuXHRcdFx0XHRcdGV4YW1wbGVzOiBbe1xuXHRcdFx0XHRcdFx0dHlwZTogJ3NzZScsXG5cdFx0XHRcdFx0XHR1cmw6ICdodHRwOi8vbG9jYWxob3N0OjMwMDEnLFxuXHRcdFx0XHRcdFx0aGVhZGVyczoge30sXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0dHlwZToge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZW51bTogWydzc2UnXSxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdhcHAubWNwLmpzb24udHlwZScsIFwiVGhlIHR5cGUgb2YgdGhlIHNlcnZlci5cIilcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR1cmw6IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdGZvcm1hdDogJ3VyaScsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXBwLm1jcC5qc29uLnVybCcsIFwiVGhlIFVSTCBvZiB0aGUgc2VydmVyLXNlbnQtZXZlbnQgKFNTRSkgc2VydmVyLlwiKVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGVudjoge1xuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FwcC5tY3AuanNvbi5oZWFkZXJzJywgXCJBZGRpdGlvbmFsIGhlYWRlcnMgc2VudCB0byB0aGUgc2VydmVyLlwiKSxcblx0XHRcdFx0XHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0aW5wdXRzOiBpbnB1dHNTY2hlbWEuZGVmaW5pdGlvbnMhLmlucHV0c1xuXHR9XG59O1xuXG5leHBvcnQgY29uc3QgbWNwQ29udHJpYnV0aW9uUG9pbnQ6IElFeHRlbnNpb25Qb2ludERlc2NyaXB0b3I8SU1jcENvbGxlY3Rpb25Db250cmlidXRpb25bXT4gPSB7XG5cdGV4dGVuc2lvblBvaW50OiAnbW9kZWxDb250ZXh0U2VydmVyQ29sbGVjdGlvbnMnLFxuXHRhY3RpdmF0aW9uRXZlbnRzR2VuZXJhdG9yKGNvbnRyaWJzLCByZXN1bHQpIHtcblx0XHRmb3IgKGNvbnN0IGNvbnRyaWIgb2YgY29udHJpYnMpIHtcblx0XHRcdGlmIChjb250cmliLmlkKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKG1jcEFjdGl2YXRpb25FdmVudChjb250cmliLmlkKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXHRqc29uU2NoZW1hOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLm1jcCcsICdDb250cmlidXRlcyBNb2RlbCBDb250ZXh0IFByb3RvY29sIHNlcnZlcnMuIFVzZXJzIG9mIHRoaXMgc2hvdWxkIGFsc28gdXNlIGB2c2NvZGUubG0ucmVnaXN0ZXJNY3BDb25maWd1cmF0aW9uUHJvdmlkZXJgLicpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0ZGVmYXVsdFNuaXBwZXRzOiBbeyBib2R5OiBbeyBpZDogJycsIGxhYmVsOiAnJyB9XSB9XSxcblx0XHRpdGVtczoge1xuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgaWQ6ICcnLCBsYWJlbDogJycgfSB9XSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMubWNwLmlkJywgXCJVbmlxdWUgSUQgZm9yIHRoZSBjb2xsZWN0aW9uLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRsYWJlbDoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5tY3AubGFiZWwnLCBcIkRpc3BsYXkgbmFtZSBmb3IgdGhlIGNvbGxlY3Rpb24uXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLG9CQUFvQjtBQUs3QixNQUFNLDJCQUEyQjtBQUUxQixNQUFNLHFCQUFxQixDQUFDLGlCQUF5QiwyQkFBMkI7QUFFdkYsTUFBTSx5QkFBeUI7QUFBQSxFQUM5QixTQUFTO0FBQUEsRUFDVCxNQUFNLENBQUMsa0JBQWtCO0FBQUEsRUFDekIsS0FBSyxDQUFDO0FBQ1A7QUFFTyxJQUFXLGtCQUFYLGtCQUFXQSxxQkFBWDtBQUNOLEVBQUFBLGlCQUFBLG1CQUFnQjtBQUNoQixFQUFBQSxpQkFBQSxjQUFXO0FBQ1gsRUFBQUEsaUJBQUEsa0JBQWU7QUFDZixFQUFBQSxpQkFBQSxxQkFBa0I7QUFKRCxTQUFBQTtBQUFBLEdBQUE7QUFPWCxNQUFNLHNCQUFzQixPQUFPLEtBQUs7QUFBQSxFQUM5QyxDQUFDLG9DQUE2QixHQUFHO0FBQUEsRUFDakMsQ0FBQyx5QkFBd0IsR0FBRztBQUFBLEVBQzVCLENBQUMsa0NBQTRCLEdBQUc7QUFBQSxFQUNoQyxDQUFDLHdDQUErQixHQUFHO0FBQ3BDLENBQXlDO0FBRWxDLE1BQU0sdUJBQXdEO0FBQUEsRUFDcEUsQ0FBQyxvQ0FBNkIsR0FBRyxTQUFTLHVDQUF1QyxnQkFBZ0I7QUFBQSxFQUNqRyxDQUFDLHlCQUF3QixHQUFHLFNBQVMsaUNBQWlDLFVBQVU7QUFBQSxFQUNoRixDQUFDLGtDQUE0QixHQUFHLFNBQVMsc0NBQXNDLGlCQUFpQjtBQUFBLEVBQ2hHLENBQUMsd0NBQStCLEdBQUcsU0FBUyx5Q0FBeUMsb0JBQW9CO0FBQzFHO0FBRU8sTUFBTSwwQkFBMEI7QUFDaEMsTUFBTSxzQkFBc0I7QUFDNUIsTUFBTSxvQkFBb0I7QUFFMUIsTUFBTSwwQkFBMEI7QUFBQSxFQUN0QyxtQkFBbUI7QUFBQSxJQUNsQixTQUFTO0FBQUEsSUFDVCxNQUFNLENBQUMsTUFBTSxtQkFBbUIsc0NBQXNDO0FBQUEsSUFDdEUsS0FBSyxDQUFDO0FBQUEsRUFDUDtBQUNEO0FBRU8sTUFBTSx1QkFBb0M7QUFBQSxFQUNoRCxNQUFNO0FBQUEsRUFDTixzQkFBc0I7QUFBQSxFQUN0QixVQUFVLENBQUMsc0JBQXNCO0FBQUEsRUFDakMsWUFBWTtBQUFBLElBQ1gsTUFBTTtBQUFBLE1BQ0wsTUFBTTtBQUFBLE1BQ04sTUFBTSxDQUFDLE9BQU87QUFBQSxNQUNkLGFBQWEsU0FBUyxxQkFBcUIseUJBQXlCO0FBQUEsSUFDckU7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNSLE1BQU07QUFBQSxNQUNOLGFBQWEsU0FBUyx3QkFBd0IsZ0NBQWdDO0FBQUEsSUFDL0U7QUFBQSxJQUNBLE1BQU07QUFBQSxNQUNMLE1BQU07QUFBQSxNQUNOLGFBQWEsU0FBUyx3QkFBd0IsaUNBQWlDO0FBQUEsTUFDL0UsT0FBTztBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUixNQUFNO0FBQUEsTUFDTixhQUFhLFNBQVMsMkJBQTJCLGlFQUFpRTtBQUFBLE1BQ2xILFVBQVUsQ0FBQyx5QkFBeUI7QUFBQSxJQUNyQztBQUFBLElBQ0EsS0FBSztBQUFBLE1BQ0osYUFBYSxTQUFTLHVCQUF1Qiw2Q0FBNkM7QUFBQSxNQUMxRixzQkFBc0I7QUFBQSxRQUNyQixPQUFPO0FBQUEsVUFDTixFQUFFLE1BQU0sT0FBTztBQUFBLFVBQ2YsRUFBRSxNQUFNLFNBQVM7QUFBQSxVQUNqQixFQUFFLE1BQU0sU0FBUztBQUFBLFFBQ2xCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFFTyxNQUFNLGtCQUErQjtBQUFBLEVBQzNDLElBQUk7QUFBQSxFQUNKLE1BQU07QUFBQSxFQUNOLE9BQU8sU0FBUyxzQkFBc0IsZ0NBQWdDO0FBQUEsRUFDdEUscUJBQXFCO0FBQUEsRUFDckIsZUFBZTtBQUFBLEVBQ2Ysc0JBQXNCO0FBQUEsRUFDdEIsWUFBWTtBQUFBLElBQ1gsU0FBUztBQUFBLE1BQ1IsVUFBVSxDQUFDLHVCQUF1QjtBQUFBLE1BQ2xDLHNCQUFzQjtBQUFBLFFBQ3JCLE9BQU8sQ0FBQyxzQkFBc0I7QUFBQSxVQUM3QixNQUFNO0FBQUEsVUFDTixzQkFBc0I7QUFBQSxVQUN0QixVQUFVLENBQUMsT0FBTyxNQUFNO0FBQUEsVUFDeEIsVUFBVSxDQUFDO0FBQUEsWUFDVixNQUFNO0FBQUEsWUFDTixLQUFLO0FBQUEsWUFDTCxTQUFTLENBQUM7QUFBQSxVQUNYLENBQUM7QUFBQSxVQUNELFlBQVk7QUFBQSxZQUNYLE1BQU07QUFBQSxjQUNMLE1BQU07QUFBQSxjQUNOLE1BQU0sQ0FBQyxLQUFLO0FBQUEsY0FDWixhQUFhLFNBQVMscUJBQXFCLHlCQUF5QjtBQUFBLFlBQ3JFO0FBQUEsWUFDQSxLQUFLO0FBQUEsY0FDSixNQUFNO0FBQUEsY0FDTixRQUFRO0FBQUEsY0FDUixhQUFhLFNBQVMsb0JBQW9CLGdEQUFnRDtBQUFBLFlBQzNGO0FBQUEsWUFDQSxLQUFLO0FBQUEsY0FDSixhQUFhLFNBQVMsd0JBQXdCLHdDQUF3QztBQUFBLGNBQ3RGLHNCQUFzQixFQUFFLE1BQU0sU0FBUztBQUFBLFlBQ3hDO0FBQUEsVUFDRDtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBQUEsSUFDQSxRQUFRLGFBQWEsWUFBYTtBQUFBLEVBQ25DO0FBQ0Q7QUFFTyxNQUFNLHVCQUFnRjtBQUFBLEVBQzVGLGdCQUFnQjtBQUFBLEVBQ2hCLDBCQUEwQixVQUFVLFFBQVE7QUFDM0MsZUFBVyxXQUFXLFVBQVU7QUFDL0IsVUFBSSxRQUFRLElBQUk7QUFDZixlQUFPLEtBQUssbUJBQW1CLFFBQVEsRUFBRSxDQUFDO0FBQUEsTUFDM0M7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBQ0EsWUFBWTtBQUFBLElBQ1gsYUFBYSxTQUFTLG9DQUFvQyx5SEFBeUg7QUFBQSxJQUNuTCxNQUFNO0FBQUEsSUFDTixpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxFQUFFLENBQUM7QUFBQSxJQUNuRCxPQUFPO0FBQUEsTUFDTixzQkFBc0I7QUFBQSxNQUN0QixNQUFNO0FBQUEsTUFDTixpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUFBLE1BQ2pELFlBQVk7QUFBQSxRQUNYLElBQUk7QUFBQSxVQUNILGFBQWEsU0FBUyx1Q0FBdUMsK0JBQStCO0FBQUEsVUFDNUYsTUFBTTtBQUFBLFFBQ1A7QUFBQSxRQUNBLE9BQU87QUFBQSxVQUNOLGFBQWEsU0FBUywwQ0FBMEMsa0NBQWtDO0FBQUEsVUFDbEcsTUFBTTtBQUFBLFFBQ1A7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDsiLAogICJuYW1lcyI6IFsiRGlzY292ZXJ5U291cmNlIl0KfQo=
