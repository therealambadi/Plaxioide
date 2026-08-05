import * as nls from "../../../../nls.js";
import * as Objects from "../../../../base/common/objects.js";
import { ProblemMatcherRegistry } from "./problemMatcher.js";
import commonSchema from "./jsonSchemaCommon.js";
const schema = {
  oneOf: [
    {
      allOf: [
        {
          type: "object",
          required: ["version"],
          properties: {
            version: {
              type: "string",
              enum: ["0.1.0"],
              deprecationMessage: nls.localize("JsonSchema.version.deprecated", "Task version 0.1.0 is deprecated. Please use 2.0.0"),
              description: nls.localize("JsonSchema.version", "The config's version number")
            },
            _runner: {
              deprecationMessage: nls.localize("JsonSchema._runner", "The runner has graduated. Use the official runner property")
            },
            runner: {
              type: "string",
              enum: ["process", "terminal"],
              default: "process",
              description: nls.localize("JsonSchema.runner", "Defines whether the task is executed as a process and the output is shown in the output window or inside the terminal.")
            },
            windows: {
              $ref: "#/definitions/taskRunnerConfiguration",
              description: nls.localize("JsonSchema.windows", "Windows specific command configuration")
            },
            osx: {
              $ref: "#/definitions/taskRunnerConfiguration",
              description: nls.localize("JsonSchema.mac", "Mac specific command configuration")
            },
            linux: {
              $ref: "#/definitions/taskRunnerConfiguration",
              description: nls.localize("JsonSchema.linux", "Linux specific command configuration")
            }
          }
        },
        {
          $ref: "#/definitions/taskRunnerConfiguration"
        }
      ]
    }
  ]
};
const shellCommand = {
  type: "boolean",
  default: true,
  description: nls.localize("JsonSchema.shell", "Specifies whether the command is a shell command or an external program. Defaults to false if omitted.")
};
schema.definitions = Objects.deepClone(commonSchema.definitions);
const definitions = schema.definitions;
definitions["commandConfiguration"]["properties"]["isShellCommand"] = Objects.deepClone(shellCommand);
definitions["taskDescription"]["properties"]["isShellCommand"] = Objects.deepClone(shellCommand);
definitions["taskRunnerConfiguration"]["properties"]["isShellCommand"] = Objects.deepClone(shellCommand);
Object.getOwnPropertyNames(definitions).forEach((key) => {
  const newKey = key + "1";
  definitions[newKey] = definitions[key];
  delete definitions[key];
});
function fixReferences(literal) {
  if (Array.isArray(literal)) {
    literal.forEach(fixReferences);
  } else if (typeof literal === "object") {
    if (literal["$ref"]) {
      literal["$ref"] = literal["$ref"] + "1";
    }
    Object.getOwnPropertyNames(literal).forEach((property) => {
      const value = literal[property];
      if (Array.isArray(value) || typeof value === "object") {
        fixReferences(value);
      }
    });
  }
}
fixReferences(schema);
ProblemMatcherRegistry.onReady().then(() => {
  try {
    const matcherIds = ProblemMatcherRegistry.keys().map((key) => "$" + key);
    definitions.problemMatcherType1.oneOf[0].enum = matcherIds;
    definitions.problemMatcherType1.oneOf[2].items.anyOf[1].enum = matcherIds;
  } catch (err) {
    console.log("Installing problem matcher ids failed");
  }
});
var jsonSchema_v1_default = schema;
export {
  jsonSchema_v1_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vanNvblNjaGVtYV92MS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgT2JqZWN0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5cbmltcG9ydCB7IFByb2JsZW1NYXRjaGVyUmVnaXN0cnkgfSBmcm9tICcuL3Byb2JsZW1NYXRjaGVyLmpzJztcblxuaW1wb3J0IGNvbW1vblNjaGVtYSBmcm9tICcuL2pzb25TY2hlbWFDb21tb24uanMnO1xuXG5jb25zdCBzY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRvbmVPZjogW1xuXHRcdHtcblx0XHRcdGFsbE9mOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRyZXF1aXJlZDogWyd2ZXJzaW9uJ10sXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0dmVyc2lvbjoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZW51bTogWycwLjEuMCddLFxuXHRcdFx0XHRcdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS52ZXJzaW9uLmRlcHJlY2F0ZWQnLCAnVGFzayB2ZXJzaW9uIDAuMS4wIGlzIGRlcHJlY2F0ZWQuIFBsZWFzZSB1c2UgMi4wLjAnKSxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS52ZXJzaW9uJywgJ1RoZSBjb25maWdcXCdzIHZlcnNpb24gbnVtYmVyJylcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRfcnVubmVyOiB7XG5cdFx0XHRcdFx0XHRcdGRlcHJlY2F0aW9uTWVzc2FnZTogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLl9ydW5uZXInLCAnVGhlIHJ1bm5lciBoYXMgZ3JhZHVhdGVkLiBVc2UgdGhlIG9mZmljaWFsIHJ1bm5lciBwcm9wZXJ0eScpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0cnVubmVyOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRlbnVtOiBbJ3Byb2Nlc3MnLCAndGVybWluYWwnXSxcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogJ3Byb2Nlc3MnLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnJ1bm5lcicsICdEZWZpbmVzIHdoZXRoZXIgdGhlIHRhc2sgaXMgZXhlY3V0ZWQgYXMgYSBwcm9jZXNzIGFuZCB0aGUgb3V0cHV0IGlzIHNob3duIGluIHRoZSBvdXRwdXQgd2luZG93IG9yIGluc2lkZSB0aGUgdGVybWluYWwuJylcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR3aW5kb3dzOiB7XG5cdFx0XHRcdFx0XHRcdCRyZWY6ICcjL2RlZmluaXRpb25zL3Rhc2tSdW5uZXJDb25maWd1cmF0aW9uJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnSnNvblNjaGVtYS53aW5kb3dzJywgJ1dpbmRvd3Mgc3BlY2lmaWMgY29tbWFuZCBjb25maWd1cmF0aW9uJylcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRvc3g6IHtcblx0XHRcdFx0XHRcdFx0JHJlZjogJyMvZGVmaW5pdGlvbnMvdGFza1J1bm5lckNvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLm1hYycsICdNYWMgc3BlY2lmaWMgY29tbWFuZCBjb25maWd1cmF0aW9uJylcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRsaW51eDoge1xuXHRcdFx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy90YXNrUnVubmVyQ29uZmlndXJhdGlvbicsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ0pzb25TY2hlbWEubGludXgnLCAnTGludXggc3BlY2lmaWMgY29tbWFuZCBjb25maWd1cmF0aW9uJylcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHQkcmVmOiAnIy9kZWZpbml0aW9ucy90YXNrUnVubmVyQ29uZmlndXJhdGlvbidcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH1cblx0XVxufTtcblxuY29uc3Qgc2hlbGxDb21tYW5kOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRkZWZhdWx0OiB0cnVlLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdKc29uU2NoZW1hLnNoZWxsJywgJ1NwZWNpZmllcyB3aGV0aGVyIHRoZSBjb21tYW5kIGlzIGEgc2hlbGwgY29tbWFuZCBvciBhbiBleHRlcm5hbCBwcm9ncmFtLiBEZWZhdWx0cyB0byBmYWxzZSBpZiBvbWl0dGVkLicpXG59O1xuXG5zY2hlbWEuZGVmaW5pdGlvbnMgPSBPYmplY3RzLmRlZXBDbG9uZShjb21tb25TY2hlbWEuZGVmaW5pdGlvbnMpO1xuY29uc3QgZGVmaW5pdGlvbnMgPSBzY2hlbWEuZGVmaW5pdGlvbnMhO1xuZGVmaW5pdGlvbnNbJ2NvbW1hbmRDb25maWd1cmF0aW9uJ11bJ3Byb3BlcnRpZXMnXSFbJ2lzU2hlbGxDb21tYW5kJ10gPSBPYmplY3RzLmRlZXBDbG9uZShzaGVsbENvbW1hbmQpO1xuZGVmaW5pdGlvbnNbJ3Rhc2tEZXNjcmlwdGlvbiddWydwcm9wZXJ0aWVzJ10hWydpc1NoZWxsQ29tbWFuZCddID0gT2JqZWN0cy5kZWVwQ2xvbmUoc2hlbGxDb21tYW5kKTtcbmRlZmluaXRpb25zWyd0YXNrUnVubmVyQ29uZmlndXJhdGlvbiddWydwcm9wZXJ0aWVzJ10hWydpc1NoZWxsQ29tbWFuZCddID0gT2JqZWN0cy5kZWVwQ2xvbmUoc2hlbGxDb21tYW5kKTtcblxuT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMoZGVmaW5pdGlvbnMpLmZvckVhY2goa2V5ID0+IHtcblx0Y29uc3QgbmV3S2V5ID0ga2V5ICsgJzEnO1xuXHRkZWZpbml0aW9uc1tuZXdLZXldID0gZGVmaW5pdGlvbnNba2V5XTtcblx0ZGVsZXRlIGRlZmluaXRpb25zW2tleV07XG59KTtcblxuZnVuY3Rpb24gZml4UmVmZXJlbmNlcyhsaXRlcmFsOiBhbnkpIHtcblx0aWYgKEFycmF5LmlzQXJyYXkobGl0ZXJhbCkpIHtcblx0XHRsaXRlcmFsLmZvckVhY2goZml4UmVmZXJlbmNlcyk7XG5cdH0gZWxzZSBpZiAodHlwZW9mIGxpdGVyYWwgPT09ICdvYmplY3QnKSB7XG5cdFx0aWYgKGxpdGVyYWxbJyRyZWYnXSkge1xuXHRcdFx0bGl0ZXJhbFsnJHJlZiddID0gbGl0ZXJhbFsnJHJlZiddICsgJzEnO1xuXHRcdH1cblx0XHRPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhsaXRlcmFsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblx0XHRcdGNvbnN0IHZhbHVlID0gbGl0ZXJhbFtwcm9wZXJ0eV07XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgfHwgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRmaXhSZWZlcmVuY2VzKHZhbHVlKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuZml4UmVmZXJlbmNlcyhzY2hlbWEpO1xuXG5Qcm9ibGVtTWF0Y2hlclJlZ2lzdHJ5Lm9uUmVhZHkoKS50aGVuKCgpID0+IHtcblx0dHJ5IHtcblx0XHRjb25zdCBtYXRjaGVySWRzID0gUHJvYmxlbU1hdGNoZXJSZWdpc3RyeS5rZXlzKCkubWFwKGtleSA9PiAnJCcgKyBrZXkpO1xuXHRcdGRlZmluaXRpb25zLnByb2JsZW1NYXRjaGVyVHlwZTEub25lT2YhWzBdLmVudW0gPSBtYXRjaGVySWRzO1xuXHRcdChkZWZpbml0aW9ucy5wcm9ibGVtTWF0Y2hlclR5cGUxLm9uZU9mIVsyXS5pdGVtcyBhcyBJSlNPTlNjaGVtYSkuYW55T2YhWzFdLmVudW0gPSBtYXRjaGVySWRzO1xuXHR9IGNhdGNoIChlcnIpIHtcblx0XHRjb25zb2xlLmxvZygnSW5zdGFsbGluZyBwcm9ibGVtIG1hdGNoZXIgaWRzIGZhaWxlZCcpO1xuXHR9XG59KTtcblxuZXhwb3J0IGRlZmF1bHQgc2NoZW1hO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksYUFBYTtBQUd6QixTQUFTLDhCQUE4QjtBQUV2QyxPQUFPLGtCQUFrQjtBQUV6QixNQUFNLFNBQXNCO0FBQUEsRUFDM0IsT0FBTztBQUFBLElBQ047QUFBQSxNQUNDLE9BQU87QUFBQSxRQUNOO0FBQUEsVUFDQyxNQUFNO0FBQUEsVUFDTixVQUFVLENBQUMsU0FBUztBQUFBLFVBQ3BCLFlBQVk7QUFBQSxZQUNYLFNBQVM7QUFBQSxjQUNSLE1B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
