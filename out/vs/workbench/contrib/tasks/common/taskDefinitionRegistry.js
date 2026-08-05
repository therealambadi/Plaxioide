import * as nls from "../../../../nls.js";
import * as Types from "../../../../base/common/types.js";
import * as Objects from "../../../../base/common/objects.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Emitter } from "../../../../base/common/event.js";
const taskDefinitionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: {
      type: "string",
      description: nls.localize("TaskDefinition.description", "The actual task type. Please note that types starting with a '$' are reserved for internal usage.")
    },
    required: {
      type: "array",
      items: {
        type: "string"
      }
    },
    properties: {
      type: "object",
      description: nls.localize("TaskDefinition.properties", "Additional properties of the task type"),
      additionalProperties: {
        $ref: "http://json-schema.org/draft-07/schema#"
      }
    },
    when: {
      type: "string",
      markdownDescription: nls.localize("TaskDefinition.when", "Condition which must be true to enable this type of task. Consider using `shellExecutionSupported`, `processExecutionSupported`, and `customExecutionSupported` as appropriate for this task definition. See the [API documentation](https://code.visualstudio.com/api/extension-guides/task-provider#when-clause) for more information."),
      default: ""
    }
  }
};
var Configuration;
((Configuration2) => {
  function from(value, extensionId, messageCollector) {
    if (!value) {
      return void 0;
    }
    const taskType = Types.isString(value.type) ? value.type : void 0;
    if (!taskType || taskType.length === 0) {
      messageCollector.error(nls.localize("TaskTypeConfiguration.noType", "The task type configuration is missing the required 'taskType' property"));
      return void 0;
    }
    const required = [];
    if (Array.isArray(value.required)) {
      for (const element of value.required) {
        if (Types.isString(element)) {
          required.push(element);
        }
      }
    }
    return {
      extensionId: extensionId.value,
      taskType,
      required,
      properties: value.properties ? Objects.deepClone(value.properties) : {},
      when: value.when ? ContextKeyExpr.deserialize(value.when) : void 0
    };
  }
  Configuration2.from = from;
})(Configuration || (Configuration = {}));
const taskDefinitionsExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "taskDefinitions",
  activationEventsGenerator: (contributions, result) => {
    for (const task of contributions) {
      if (task.type) {
        result.push(`onTaskType:${task.type}`);
      }
    }
  },
  jsonSchema: {
    description: nls.localize("TaskDefinitionExtPoint", "Contributes task kinds"),
    type: "array",
    items: taskDefinitionSchema
  }
});
class TaskDefinitionRegistryImpl {
  constructor() {
    this._onDefinitionsChanged = new Emitter();
    this.onDefinitionsChanged = this._onDefinitionsChanged.event;
    this.taskTypes = /* @__PURE__ */ Object.create(null);
    this.readyPromise = new Promise((resolve, reject) => {
      taskDefinitionsExtPoint.setHandler((extensions, delta) => {
        this._schema = void 0;
        try {
          for (const extension of delta.removed) {
            const taskTypes = extension.value;
            for (const taskType of taskTypes) {
              if (this.taskTypes && taskType.type && this.taskTypes[taskType.type]) {
                delete this.taskTypes[taskType.type];
              }
            }
          }
          for (const extension of delta.added) {
            const taskTypes = extension.value;
            for (const taskType of taskTypes) {
              const type = Configuration.from(taskType, extension.description.identifier, extension.collector);
              if (type) {
                this.taskTypes[type.taskType] = type;
              }
            }
          }
          if (delta.removed.length > 0 || delta.added.length > 0) {
            this._onDefinitionsChanged.fire();
          }
        } catch (error) {
        }
        resolve(void 0);
      });
    });
  }
  onReady() {
    return this.readyPromise;
  }
  get(key) {
    return this.taskTypes[key];
  }
  all() {
    return Object.keys(this.taskTypes).map((key) => this.taskTypes[key]);
  }
  getJsonSchema() {
    if (this._schema === void 0) {
      const schemas = [];
      for (const definition of this.all()) {
        const schema = {
          type: "object",
          additionalProperties: false
        };
        if (definition.required.length > 0) {
          schema.required = definition.required.slice(0);
        }
        if (definition.properties !== void 0) {
          schema.properties = Objects.deepClone(definition.properties);
        } else {
          schema.properties = /* @__PURE__ */ Object.create(null);
        }
        schema.properties.type = {
          type: "string",
          enum: [definition.taskType]
        };
        schemas.push(schema);
      }
      this._schema = { oneOf: schemas };
    }
    return this._schema;
  }
}
const TaskDefinitionRegistry = new TaskDefinitionRegistryImpl();
export {
  TaskDefinitionRegistry
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vdGFza0RlZmluaXRpb25SZWdpc3RyeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWEsIElKU09OU2NoZW1hTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAqIGFzIE9iamVjdHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5cbmltcG9ydCB7IEV4dGVuc2lvbnNSZWdpc3RyeSwgRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3RvciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5cbmltcG9ydCAqIGFzIFRhc2tzIGZyb20gJy4vdGFza3MuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuXG5cbmNvbnN0IHRhc2tEZWZpbml0aW9uU2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ29iamVjdCcsXG5cdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0cHJvcGVydGllczoge1xuXHRcdHR5cGU6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnVGFza0RlZmluaXRpb24uZGVzY3JpcHRpb24nLCAnVGhlIGFjdHVhbCB0YXNrIHR5cGUuIFBsZWFzZSBub3RlIHRoYXQgdHlwZXMgc3RhcnRpbmcgd2l0aCBhIFxcJyRcXCcgYXJlIHJlc2VydmVkIGZvciBpbnRlcm5hbCB1c2FnZS4nKVxuXHRcdH0sXG5cdFx0cmVxdWlyZWQ6IHtcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdUYXNrRGVmaW5pdGlvbi5wcm9wZXJ0aWVzJywgJ0FkZGl0aW9uYWwgcHJvcGVydGllcyBvZiB0aGUgdGFzayB0eXBlJyksXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHQkcmVmOiAnaHR0cDovL2pzb24tc2NoZW1hLm9yZy9kcmFmdC0wNy9zY2hlbWEjJ1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0d2hlbjoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ1Rhc2tEZWZpbml0aW9uLndoZW4nLCAnQ29uZGl0aW9uIHdoaWNoIG11c3QgYmUgdHJ1ZSB0byBlbmFibGUgdGhpcyB0eXBlIG9mIHRhc2suIENvbnNpZGVyIHVzaW5nIGBzaGVsbEV4ZWN1dGlvblN1cHBvcnRlZGAsIGBwcm9jZXNzRXhlY3V0aW9uU3VwcG9ydGVkYCwgYW5kIGBjdXN0b21FeGVjdXRpb25TdXBwb3J0ZWRgIGFzIGFwcHJvcHJpYXRlIGZvciB0aGlzIHRhc2sgZGVmaW5pdGlvbi4gU2VlIHRoZSBbQVBJIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2FwaS9leHRlbnNpb24tZ3VpZGVzL3Rhc2stcHJvdmlkZXIjd2hlbi1jbGF1c2UpIGZvciBtb3JlIGluZm9ybWF0aW9uLicpLFxuXHRcdFx0ZGVmYXVsdDogJydcblx0XHR9XG5cdH1cbn07XG5cbm5hbWVzcGFjZSBDb25maWd1cmF0aW9uIHtcblx0ZXhwb3J0IGludGVyZmFjZSBJVGFza0RlZmluaXRpb24ge1xuXHRcdHR5cGU/OiBzdHJpbmc7XG5cdFx0cmVxdWlyZWQ/OiBzdHJpbmdbXTtcblx0XHRwcm9wZXJ0aWVzPzogSUpTT05TY2hlbWFNYXA7XG5cdFx0d2hlbj86IHN0cmluZztcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlOiBJVGFza0RlZmluaXRpb24sIGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCBtZXNzYWdlQ29sbGVjdG9yOiBFeHRlbnNpb25NZXNzYWdlQ29sbGVjdG9yKTogVGFza3MuSVRhc2tEZWZpbml0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCB0YXNrVHlwZSA9IFR5cGVzLmlzU3RyaW5nKHZhbHVlLnR5cGUpID8gdmFsdWUudHlwZSA6IHVuZGVmaW5lZDtcblx0XHRpZiAoIXRhc2tUeXBlIHx8IHRhc2tUeXBlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0bWVzc2FnZUNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ1Rhc2tUeXBlQ29uZmlndXJhdGlvbi5ub1R5cGUnLCAnVGhlIHRhc2sgdHlwZSBjb25maWd1cmF0aW9uIGlzIG1pc3NpbmcgdGhlIHJlcXVpcmVkIFxcJ3Rhc2tUeXBlXFwnIHByb3BlcnR5JykpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgcmVxdWlyZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUucmVxdWlyZWQpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdmFsdWUucmVxdWlyZWQpIHtcblx0XHRcdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0cmVxdWlyZWQucHVzaChlbGVtZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbklkLnZhbHVlLFxuXHRcdFx0dGFza1R5cGUsIHJlcXVpcmVkOiByZXF1aXJlZCxcblx0XHRcdHByb3BlcnRpZXM6IHZhbHVlLnByb3BlcnRpZXMgPyBPYmplY3RzLmRlZXBDbG9uZSh2YWx1ZS5wcm9wZXJ0aWVzKSA6IHt9LFxuXHRcdFx0d2hlbjogdmFsdWUud2hlbiA/IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKHZhbHVlLndoZW4pIDogdW5kZWZpbmVkXG5cdFx0fTtcblx0fVxufVxuXG5cbmNvbnN0IHRhc2tEZWZpbml0aW9uc0V4dFBvaW50ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8Q29uZmlndXJhdGlvbi5JVGFza0RlZmluaXRpb25bXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ3Rhc2tEZWZpbml0aW9ucycsXG5cdGFjdGl2YXRpb25FdmVudHNHZW5lcmF0b3I6IChjb250cmlidXRpb25zOiBDb25maWd1cmF0aW9uLklUYXNrRGVmaW5pdGlvbltdLCByZXN1bHQ6IHsgcHVzaChpdGVtOiBzdHJpbmcpOiB2b2lkIH0pID0+IHtcblx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgY29udHJpYnV0aW9ucykge1xuXHRcdFx0aWYgKHRhc2sudHlwZSkge1xuXHRcdFx0XHRyZXN1bHQucHVzaChgb25UYXNrVHlwZToke3Rhc2sudHlwZX1gKTtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdUYXNrRGVmaW5pdGlvbkV4dFBvaW50JywgJ0NvbnRyaWJ1dGVzIHRhc2sga2luZHMnKSxcblx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdGl0ZW1zOiB0YXNrRGVmaW5pdGlvblNjaGVtYVxuXHR9XG59KTtcblxuZXhwb3J0IGludGVyZmFjZSBJVGFza0RlZmluaXRpb25SZWdpc3RyeSB7XG5cdG9uUmVhZHkoKTogUHJvbWlzZTx2b2lkPjtcblxuXHRnZXQoa2V5OiBzdHJpbmcpOiBUYXNrcy5JVGFza0RlZmluaXRpb247XG5cdGFsbCgpOiBUYXNrcy5JVGFza0RlZmluaXRpb25bXTtcblx0Z2V0SnNvblNjaGVtYSgpOiBJSlNPTlNjaGVtYTtcblx0b25EZWZpbml0aW9uc0NoYW5nZWQ6IEV2ZW50PHZvaWQ+O1xufVxuXG5jbGFzcyBUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5SW1wbCBpbXBsZW1lbnRzIElUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5IHtcblxuXHRwcml2YXRlIHRhc2tUeXBlczogSVN0cmluZ0RpY3Rpb25hcnk8VGFza3MuSVRhc2tEZWZpbml0aW9uPjtcblx0cHJpdmF0ZSByZWFkeVByb21pc2U6IFByb21pc2U8dm9pZD47XG5cdHByaXZhdGUgX3NjaGVtYTogSUpTT05TY2hlbWEgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX29uRGVmaW5pdGlvbnNDaGFuZ2VkOiBFbWl0dGVyPHZvaWQ+ID0gbmV3IEVtaXR0ZXIoKTtcblx0cHVibGljIG9uRGVmaW5pdGlvbnNDaGFuZ2VkOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGVmaW5pdGlvbnNDaGFuZ2VkLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMudGFza1R5cGVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLnJlYWR5UHJvbWlzZSA9IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHRhc2tEZWZpbml0aW9uc0V4dFBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIGRlbHRhKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3NjaGVtYSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5yZW1vdmVkKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB0YXNrVHlwZXMgPSBleHRlbnNpb24udmFsdWU7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHRhc2tUeXBlIG9mIHRhc2tUeXBlcykge1xuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy50YXNrVHlwZXMgJiYgdGFza1R5cGUudHlwZSAmJiB0aGlzLnRhc2tUeXBlc1t0YXNrVHlwZS50eXBlXSkge1xuXHRcdFx0XHRcdFx0XHRcdGRlbGV0ZSB0aGlzLnRhc2tUeXBlc1t0YXNrVHlwZS50eXBlXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5hZGRlZCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgdGFza1R5cGVzID0gZXh0ZW5zaW9uLnZhbHVlO1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCB0YXNrVHlwZSBvZiB0YXNrVHlwZXMpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdHlwZSA9IENvbmZpZ3VyYXRpb24uZnJvbSh0YXNrVHlwZSwgZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5jb2xsZWN0b3IpO1xuXHRcdFx0XHRcdFx0XHRpZiAodHlwZSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMudGFza1R5cGVzW3R5cGUudGFza1R5cGVdID0gdHlwZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoKGRlbHRhLnJlbW92ZWQubGVuZ3RoID4gMCkgfHwgKGRlbHRhLmFkZGVkLmxlbmd0aCA+IDApKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9vbkRlZmluaXRpb25zQ2hhbmdlZC5maXJlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG9uUmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZHlQcm9taXNlO1xuXHR9XG5cblx0cHVibGljIGdldChrZXk6IHN0cmluZyk6IFRhc2tzLklUYXNrRGVmaW5pdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMudGFza1R5cGVzW2tleV07XG5cdH1cblxuXHRwdWJsaWMgYWxsKCk6IFRhc2tzLklUYXNrRGVmaW5pdGlvbltdIHtcblx0XHRyZXR1cm4gT2JqZWN0LmtleXModGhpcy50YXNrVHlwZXMpLm1hcChrZXkgPT4gdGhpcy50YXNrVHlwZXNba2V5XSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0SnNvblNjaGVtYSgpOiBJSlNPTlNjaGVtYSB7XG5cdFx0aWYgKHRoaXMuX3NjaGVtYSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBzY2hlbWFzOiBJSlNPTlNjaGVtYVtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGRlZmluaXRpb24gb2YgdGhpcy5hbGwoKSkge1xuXHRcdFx0XHRjb25zdCBzY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoZGVmaW5pdGlvbi5yZXF1aXJlZC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0c2NoZW1hLnJlcXVpcmVkID0gZGVmaW5pdGlvbi5yZXF1aXJlZC5zbGljZSgwKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZGVmaW5pdGlvbi5wcm9wZXJ0aWVzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRzY2hlbWEucHJvcGVydGllcyA9IE9iamVjdHMuZGVlcENsb25lKGRlZmluaXRpb24ucHJvcGVydGllcyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2NoZW1hLnByb3BlcnRpZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNjaGVtYS5wcm9wZXJ0aWVzIS50eXBlID0ge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGVudW06IFtkZWZpbml0aW9uLnRhc2tUeXBlXVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRzY2hlbWFzLnB1c2goc2NoZW1hKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3NjaGVtYSA9IHsgb25lT2Y6IHNjaGVtYXMgfTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3NjaGVtYTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgVGFza0RlZmluaXRpb25SZWdpc3RyeTogSVRhc2tEZWZpbml0aW9uUmVnaXN0cnkgPSBuZXcgVGFza0RlZmluaXRpb25SZWdpc3RyeUltcGwoKTtcbiJd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
