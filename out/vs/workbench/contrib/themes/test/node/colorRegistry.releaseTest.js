import * as fs from "fs";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { Extensions, asCssVariableName } from "../../../../../platform/theme/common/colorRegistry.js";
import { asTextOrError } from "../../../../../platform/request/common/request.js";
import * as pfs from "../../../../../base/node/pfs.js";
import * as path from "../../../../../base/common/path.js";
import assert from "assert";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { RequestService } from "../../../../../platform/request/node/requestService.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import "../../../../workbench.desktop.main.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { FileAccess } from "../../../../../base/common/network.js";
const experimental = [];
const knwonVariablesFileName = "vscode-known-variables.json";
suite("Color Registry", function() {
  test(`update colors in ${knwonVariablesFileName}`, async function() {
    const varFilePath = FileAccess.asFileUri(`vs/../../build/lib/stylelint/${knwonVariablesFileName}`).fsPath;
    const content = (await fs.promises.readFile(varFilePath)).toString();
    const variablesInfo = JSON.parse(content);
    const colorsArray = variablesInfo.colors;
    assert.ok(colorsArray && colorsArray.length > 0, "${knwonVariablesFileName} contains no color descriptions");
    const colors = new Set(colorsArray);
    const updatedColors = [];
    const missing = [];
    const themingRegistry = Registry.as(Extensions.ColorContribution);
    for (const color of themingRegistry.getColors()) {
      const id = asCssVariableName(color.id);
      if (!colors.has(id)) {
        if (!color.deprecationMessage) {
          missing.push(id);
        }
      } else {
        colors.delete(id);
      }
      updatedColors.push(id);
    }
    const superfluousKeys = [...colors.keys()];
    let errorText = "";
    if (missing.length > 0) {
      errorText += `
Adding the following colors:

${JSON.stringify(missing, void 0, "	")}
`;
    }
    if (superfluousKeys.length > 0) {
      errorText += `
Removing the following colors:

${superfluousKeys.join("\n")}
`;
    }
    if (errorText.length > 0) {
      updatedColors.sort();
      variablesInfo.colors = updatedColors;
      await pfs.Promises.writeFile(varFilePath, JSON.stringify(variablesInfo, void 0, "	"));
      assert.fail(`
Updating ${path.normalize(varFilePath)}.
Please verify and commit.

${errorText}
`);
    }
  });
  test("all colors listed in theme-color.md", async function() {
    const environmentService = new class extends mock() {
      constructor() {
        super(...arguments);
        this.args = { _: [] };
      }
    }();
    const docUrl = "https://raw.githubusercontent.com/microsoft/vscode-docs/main/api/references/theme-color.md";
    const reqContext = await new RequestService("local", new TestConfigurationService(), environmentService, new NullLogService()).request({ url: docUrl }, CancellationToken.None);
    const content = await asTextOrError(reqContext);
    const expression = /-\s*\`([\w\.]+)\`: (.*)/g;
    let m;
    const colorsInDoc = /* @__PURE__ */ Object.create(null);
    let nColorsInDoc = 0;
    while (m = expression.exec(content)) {
      colorsInDoc[m[1]] = { description: m[2], offset: m.index, length: m.length };
      nColorsInDoc++;
    }
    assert.ok(nColorsInDoc > 0, "theme-color.md contains to color descriptions");
    const missing = /* @__PURE__ */ Object.create(null);
    const descriptionDiffs = /* @__PURE__ */ Object.create(null);
    const themingRegistry = Registry.as(Extensions.ColorContribution);
    for (const color of themingRegistry.getColors()) {
      if (!colorsInDoc[color.id]) {
        if (!color.deprecationMessage) {
          missing[color.id] = getDescription(color);
        }
      } else {
        const docDescription = colorsInDoc[color.id].description;
        const specDescription = getDescription(color);
        if (docDescription !== specDescription) {
          descriptionDiffs[color.id] = { docDescription, specDescription };
        }
        delete colorsInDoc[color.id];
      }
    }
    const colorsInExtensions = await getColorsFromExtension();
    for (const colorId in colorsInExtensions) {
      if (!colorsInDoc[colorId]) {
        missing[colorId] = colorsInExtensions[colorId];
      } else {
        delete colorsInDoc[colorId];
      }
    }
    for (const colorId of experimental) {
      if (missing[colorId]) {
        delete missing[colorId];
      }
      if (colorsInDoc[colorId]) {
        assert.fail(`Color ${colorId} found in doc but marked experimental. Please remove from experimental list.`);
      }
    }
    const superfluousKeys = Object.keys(colorsInDoc);
    const undocumentedKeys = Object.keys(missing).map((k) => `\`${k}\`: ${missing[k]}`);
    let errorText = "";
    if (undocumentedKeys.length > 0) {
      errorText += `

Add the following colors:

${undocumentedKeys.join("\n")}
`;
    }
    if (superfluousKeys.length > 0) {
      errorText += `
Remove the following colors:

${superfluousKeys.join("\n")}
`;
    }
    if (errorText.length > 0) {
      assert.fail(`

Open https://github.dev/microsoft/vscode-docs/blob/vnext/api/references/theme-color.md#50${errorText}`);
    }
  });
});
function getDescription(color) {
  let specDescription = color.description;
  if (color.deprecationMessage) {
    specDescription = specDescription + " " + color.deprecationMessage;
  }
  return specDescription;
}
async function getColorsFromExtension() {
  const extPath = FileAccess.asFileUri("vs/../../extensions").fsPath;
  const extFolders = await pfs.Promises.readDirsInDir(extPath);
  const result = /* @__PURE__ */ Object.create(null);
  for (const folder of extFolders) {
    try {
      const packageJSON = JSON.parse((await fs.promises.readFile(path.join(extPath, folder, "package.json"))).toString());
      const contributes = packageJSON["contributes"];
      if (contributes) {
        const colors = contributes["colors"];
        if (colors) {
          for (const color of colors) {
            const colorId = color["id"];
            if (colorId) {
              result[colorId] = colorId["description"];
            }
          }
        }
      }
    } catch (e) {
    }
  }
  return result;
}
export {
  experimental
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90aGVtZXMvdGVzdC9ub2RlL2NvbG9yUmVnaXN0cnkucmVsZWFzZVRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJQ29sb3JSZWdpc3RyeSwgRXh0ZW5zaW9ucywgQ29sb3JDb250cmlidXRpb24sIGFzQ3NzVmFyaWFibGVOYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgYXNUZXh0T3JFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0ICogYXMgcGZzIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2Uvbm9kZS9wZnMuanMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IFJlcXVlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVxdWVzdC9ub2RlL3JlcXVlc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLWltcG9ydC1wYXR0ZXJuc1xuaW1wb3J0ICcuLi8uLi8uLi8uLi93b3JrYmVuY2guZGVza3RvcC5tYWluLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcblxuaW50ZXJmYWNlIENvbG9ySW5mbyB7XG5cdGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdG9mZnNldDogbnVtYmVyO1xuXHRsZW5ndGg6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIERlc2NyaXB0aW9uRGlmZiB7XG5cdGRvY0Rlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdHNwZWNEZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgZXhwZXJpbWVudGFsOiBzdHJpbmdbXSA9IFtdOyAvLyAnc2V0dGluZ3MubW9kaWZpZWRJdGVtRm9yZWdyb3VuZCcsICdlZGl0b3JVbm5lY2Vzc2FyeS5mb3JlZ3JvdW5kJyBdO1xuXG5cbmNvbnN0IGtud29uVmFyaWFibGVzRmlsZU5hbWUgPSAndnNjb2RlLWtub3duLXZhcmlhYmxlcy5qc29uJztcblxuc3VpdGUoJ0NvbG9yIFJlZ2lzdHJ5JywgZnVuY3Rpb24gKCkge1xuXG5cdHRlc3QoYHVwZGF0ZSBjb2xvcnMgaW4gJHtrbndvblZhcmlhYmxlc0ZpbGVOYW1lfWAsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB2YXJGaWxlUGF0aCA9IEZpbGVBY2Nlc3MuYXNGaWxlVXJpKGB2cy8uLi8uLi9idWlsZC9saWIvc3R5bGVsaW50LyR7a253b25WYXJpYWJsZXNGaWxlTmFtZX1gKS5mc1BhdGg7XG5cdFx0Y29uc3QgY29udGVudCA9IChhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZSh2YXJGaWxlUGF0aCkpLnRvU3RyaW5nKCk7XG5cblx0XHRjb25zdCB2YXJpYWJsZXNJbmZvID0gSlNPTi5wYXJzZShjb250ZW50KTtcblxuXHRcdGNvbnN0IGNvbG9yc0FycmF5ID0gdmFyaWFibGVzSW5mby5jb2xvcnMgYXMgc3RyaW5nW107XG5cblx0XHRhc3NlcnQub2soY29sb3JzQXJyYXkgJiYgY29sb3JzQXJyYXkubGVuZ3RoID4gMCwgJyR7a253b25WYXJpYWJsZXNGaWxlTmFtZX0gY29udGFpbnMgbm8gY29sb3IgZGVzY3JpcHRpb25zJyk7XG5cblx0XHRjb25zdCBjb2xvcnMgPSBuZXcgU2V0KGNvbG9yc0FycmF5KTtcblxuXHRcdGNvbnN0IHVwZGF0ZWRDb2xvcnMgPSBbXTtcblx0XHRjb25zdCBtaXNzaW5nID0gW107XG5cdFx0Y29uc3QgdGhlbWluZ1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbG9yUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29sb3JDb250cmlidXRpb24pO1xuXHRcdGZvciAoY29uc3QgY29sb3Igb2YgdGhlbWluZ1JlZ2lzdHJ5LmdldENvbG9ycygpKSB7XG5cdFx0XHRjb25zdCBpZCA9IGFzQ3NzVmFyaWFibGVOYW1lKGNvbG9yLmlkKTtcblxuXHRcdFx0aWYgKCFjb2xvcnMuaGFzKGlkKSkge1xuXHRcdFx0XHRpZiAoIWNvbG9yLmRlcHJlY2F0aW9uTWVzc2FnZSkge1xuXHRcdFx0XHRcdG1pc3NpbmcucHVzaChpZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbG9ycy5kZWxldGUoaWQpO1xuXHRcdFx0fVxuXHRcdFx0dXBkYXRlZENvbG9ycy5wdXNoKGlkKTtcblx0XHR9XG5cblx0XHRjb25zdCBzdXBlcmZsdW91c0tleXMgPSBbLi4uY29sb3JzLmtleXMoKV07XG5cblx0XHRsZXQgZXJyb3JUZXh0ID0gJyc7XG5cdFx0aWYgKG1pc3NpbmcubGVuZ3RoID4gMCkge1xuXHRcdFx0ZXJyb3JUZXh0ICs9IGBcXG5cXEFkZGluZyB0aGUgZm9sbG93aW5nIGNvbG9yczpcXG5cXG4ke0pTT04uc3RyaW5naWZ5KG1pc3NpbmcsIHVuZGVmaW5lZCwgJ1xcdCcpfVxcbmA7XG5cdFx0fVxuXHRcdGlmIChzdXBlcmZsdW91c0tleXMubGVuZ3RoID4gMCkge1xuXHRcdFx0ZXJyb3JUZXh0ICs9IGBcXG5cXFJlbW92aW5nIHRoZSBmb2xsb3dpbmcgY29sb3JzOlxcblxcbiR7c3VwZXJmbHVvdXNLZXlzLmpvaW4oJ1xcbicpfVxcbmA7XG5cdFx0fVxuXG5cdFx0aWYgKGVycm9yVGV4dC5sZW5ndGggPiAwKSB7XG5cdFx0XHR1cGRhdGVkQ29sb3JzLnNvcnQoKTtcblx0XHRcdHZhcmlhYmxlc0luZm8uY29sb3JzID0gdXBkYXRlZENvbG9ycztcblx0XHRcdGF3YWl0IHBmcy5Qcm9taXNlcy53cml0ZUZpbGUodmFyRmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHZhcmlhYmxlc0luZm8sIHVuZGVmaW5lZCwgJ1xcdCcpKTtcblxuXHRcdFx0YXNzZXJ0LmZhaWwoYFxcblxcVXBkYXRpbmcgJHtwYXRoLm5vcm1hbGl6ZSh2YXJGaWxlUGF0aCl9LlxcblBsZWFzZSB2ZXJpZnkgYW5kIGNvbW1pdC5cXG5cXG4ke2Vycm9yVGV4dH1cXG5gKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2FsbCBjb2xvcnMgbGlzdGVkIGluIHRoZW1lLWNvbG9yLm1kJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdC8vIGF2b2lkIGltcG9ydGluZyB0aGUgVGVzdEVudmlyb25tZW50U2VydmljZSBhcyBpdCBicmluZ3MgaW4gYSBkdXBsaWNhdGUgcmVnaXN0cmF0aW9uIG9mIHRoZSBmaWxlIGVkaXRvciBpbnB1dCBmYWN0b3J5LlxuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU5hdGl2ZUVudmlyb25tZW50U2VydmljZT4oKSB7IG92ZXJyaWRlIGFyZ3MgPSB7IF86IFtdIH07IH07XG5cblx0XHRjb25zdCBkb2NVcmwgPSAnaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL21pY3Jvc29mdC92c2NvZGUtZG9jcy9tYWluL2FwaS9yZWZlcmVuY2VzL3RoZW1lLWNvbG9yLm1kJztcblxuXHRcdGNvbnN0IHJlcUNvbnRleHQgPSBhd2FpdCBuZXcgUmVxdWVzdFNlcnZpY2UoJ2xvY2FsJywgbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpLCBlbnZpcm9ubWVudFNlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKS5yZXF1ZXN0KHsgdXJsOiBkb2NVcmwgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0Y29uc3QgY29udGVudCA9IChhd2FpdCBhc1RleHRPckVycm9yKHJlcUNvbnRleHQpKSE7XG5cblx0XHRjb25zdCBleHByZXNzaW9uID0gLy1cXHMqXFxgKFtcXHdcXC5dKylcXGA6ICguKikvZztcblxuXHRcdGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsO1xuXHRcdGNvbnN0IGNvbG9yc0luRG9jOiB7IFtpZDogc3RyaW5nXTogQ29sb3JJbmZvIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGxldCBuQ29sb3JzSW5Eb2MgPSAwO1xuXHRcdHdoaWxlIChtID0gZXhwcmVzc2lvbi5leGVjKGNvbnRlbnQpKSB7XG5cdFx0XHRjb2xvcnNJbkRvY1ttWzFdXSA9IHsgZGVzY3JpcHRpb246IG1bMl0sIG9mZnNldDogbS5pbmRleCwgbGVuZ3RoOiBtLmxlbmd0aCB9O1xuXHRcdFx0bkNvbG9yc0luRG9jKys7XG5cdFx0fVxuXHRcdGFzc2VydC5vayhuQ29sb3JzSW5Eb2MgPiAwLCAndGhlbWUtY29sb3IubWQgY29udGFpbnMgdG8gY29sb3IgZGVzY3JpcHRpb25zJyk7XG5cblx0XHRjb25zdCBtaXNzaW5nID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRjb25zdCBkZXNjcmlwdGlvbkRpZmZzOiB7IFtpZDogc3RyaW5nXTogRGVzY3JpcHRpb25EaWZmIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5cdFx0Y29uc3QgdGhlbWluZ1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbG9yUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29sb3JDb250cmlidXRpb24pO1xuXHRcdGZvciAoY29uc3QgY29sb3Igb2YgdGhlbWluZ1JlZ2lzdHJ5LmdldENvbG9ycygpKSB7XG5cdFx0XHRpZiAoIWNvbG9yc0luRG9jW2NvbG9yLmlkXSkge1xuXHRcdFx0XHRpZiAoIWNvbG9yLmRlcHJlY2F0aW9uTWVzc2FnZSkge1xuXHRcdFx0XHRcdG1pc3NpbmdbY29sb3IuaWRdID0gZ2V0RGVzY3JpcHRpb24oY29sb3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBkb2NEZXNjcmlwdGlvbiA9IGNvbG9yc0luRG9jW2NvbG9yLmlkXS5kZXNjcmlwdGlvbjtcblx0XHRcdFx0Y29uc3Qgc3BlY0Rlc2NyaXB0aW9uID0gZ2V0RGVzY3JpcHRpb24oY29sb3IpO1xuXHRcdFx0XHRpZiAoZG9jRGVzY3JpcHRpb24gIT09IHNwZWNEZXNjcmlwdGlvbikge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uRGlmZnNbY29sb3IuaWRdID0geyBkb2NEZXNjcmlwdGlvbiwgc3BlY0Rlc2NyaXB0aW9uIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGVsZXRlIGNvbG9yc0luRG9jW2NvbG9yLmlkXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgY29sb3JzSW5FeHRlbnNpb25zID0gYXdhaXQgZ2V0Q29sb3JzRnJvbUV4dGVuc2lvbigpO1xuXHRcdGZvciAoY29uc3QgY29sb3JJZCBpbiBjb2xvcnNJbkV4dGVuc2lvbnMpIHtcblx0XHRcdGlmICghY29sb3JzSW5Eb2NbY29sb3JJZF0pIHtcblx0XHRcdFx0bWlzc2luZ1tjb2xvcklkXSA9IGNvbG9yc0luRXh0ZW5zaW9uc1tjb2xvcklkXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRlbGV0ZSBjb2xvcnNJbkRvY1tjb2xvcklkXTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Zm9yIChjb25zdCBjb2xvcklkIG9mIGV4cGVyaW1lbnRhbCkge1xuXHRcdFx0aWYgKG1pc3NpbmdbY29sb3JJZF0pIHtcblx0XHRcdFx0ZGVsZXRlIG1pc3NpbmdbY29sb3JJZF07XG5cdFx0XHR9XG5cdFx0XHRpZiAoY29sb3JzSW5Eb2NbY29sb3JJZF0pIHtcblx0XHRcdFx0YXNzZXJ0LmZhaWwoYENvbG9yICR7Y29sb3JJZH0gZm91bmQgaW4gZG9jIGJ1dCBtYXJrZWQgZXhwZXJpbWVudGFsLiBQbGVhc2UgcmVtb3ZlIGZyb20gZXhwZXJpbWVudGFsIGxpc3QuYCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHN1cGVyZmx1b3VzS2V5cyA9IE9iamVjdC5rZXlzKGNvbG9yc0luRG9jKTtcblx0XHRjb25zdCB1bmRvY3VtZW50ZWRLZXlzID0gT2JqZWN0LmtleXMobWlzc2luZykubWFwKGsgPT4gYFxcYCR7a31cXGA6ICR7bWlzc2luZ1trXX1gKTtcblxuXG5cdFx0bGV0IGVycm9yVGV4dCA9ICcnO1xuXHRcdGlmICh1bmRvY3VtZW50ZWRLZXlzLmxlbmd0aCA+IDApIHtcblx0XHRcdGVycm9yVGV4dCArPSBgXFxuXFxuQWRkIHRoZSBmb2xsb3dpbmcgY29sb3JzOlxcblxcbiR7dW5kb2N1bWVudGVkS2V5cy5qb2luKCdcXG4nKX1cXG5gO1xuXHRcdH1cblx0XHRpZiAoc3VwZXJmbHVvdXNLZXlzLmxlbmd0aCA+IDApIHtcblx0XHRcdGVycm9yVGV4dCArPSBgXFxuXFxSZW1vdmUgdGhlIGZvbGxvd2luZyBjb2xvcnM6XFxuXFxuJHtzdXBlcmZsdW91c0tleXMuam9pbignXFxuJyl9XFxuYDtcblx0XHR9XG5cblx0XHRpZiAoZXJyb3JUZXh0Lmxlbmd0aCA+IDApIHtcblx0XHRcdGFzc2VydC5mYWlsKGBcXG5cXG5PcGVuIGh0dHBzOi8vZ2l0aHViLmRldi9taWNyb3NvZnQvdnNjb2RlLWRvY3MvYmxvYi92bmV4dC9hcGkvcmVmZXJlbmNlcy90aGVtZS1jb2xvci5tZCM1MCR7ZXJyb3JUZXh0fWApO1xuXHRcdH1cblx0fSk7XG59KTtcblxuZnVuY3Rpb24gZ2V0RGVzY3JpcHRpb24oY29sb3I6IENvbG9yQ29udHJpYnV0aW9uKSB7XG5cdGxldCBzcGVjRGVzY3JpcHRpb24gPSBjb2xvci5kZXNjcmlwdGlvbjtcblx0aWYgKGNvbG9yLmRlcHJlY2F0aW9uTWVzc2FnZSkge1xuXHRcdHNwZWNEZXNjcmlwdGlvbiA9IHNwZWNEZXNjcmlwdGlvbiArICcgJyArIGNvbG9yLmRlcHJlY2F0aW9uTWVzc2FnZTtcblx0fVxuXHRyZXR1cm4gc3BlY0Rlc2NyaXB0aW9uO1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRDb2xvcnNGcm9tRXh0ZW5zaW9uKCk6IFByb21pc2U8eyBbaWQ6IHN0cmluZ106IHN0cmluZyB9PiB7XG5cdGNvbnN0IGV4dFBhdGggPSBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvLi4vLi4vZXh0ZW5zaW9ucycpLmZzUGF0aDtcblx0Y29uc3QgZXh0Rm9sZGVycyA9IGF3YWl0IHBmcy5Qcm9taXNlcy5yZWFkRGlyc0luRGlyKGV4dFBhdGgpO1xuXHRjb25zdCByZXN1bHQ6IHsgW2lkOiBzdHJpbmddOiBzdHJpbmcgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdGZvciAoY29uc3QgZm9sZGVyIG9mIGV4dEZvbGRlcnMpIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcGFja2FnZUpTT04gPSBKU09OLnBhcnNlKChhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZShwYXRoLmpvaW4oZXh0UGF0aCwgZm9sZGVyLCAncGFja2FnZS5qc29uJykpKS50b1N0cmluZygpKTtcblx0XHRcdGNvbnN0IGNvbnRyaWJ1dGVzID0gcGFja2FnZUpTT05bJ2NvbnRyaWJ1dGVzJ107XG5cdFx0XHRpZiAoY29udHJpYnV0ZXMpIHtcblx0XHRcdFx0Y29uc3QgY29sb3JzID0gY29udHJpYnV0ZXNbJ2NvbG9ycyddO1xuXHRcdFx0XHRpZiAoY29sb3JzKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBjb2xvciBvZiBjb2xvcnMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvbG9ySWQgPSBjb2xvclsnaWQnXTtcblx0XHRcdFx0XHRcdGlmIChjb2xvcklkKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3VsdFtjb2xvcklkXSA9IGNvbG9ySWRbJ2Rlc2NyaXB0aW9uJ107XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Ly8gaWdub3JlXG5cdFx0fVxuXG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksUUFBUTtBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUF5QixZQUErQix5QkFBeUI7QUFDakYs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LE9BQU8sS0FBSyxPQUFPLEVBQUUsSUFBSSxPQUFLLEtBQUssQ0FBQyxPQUFPLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFHaEYsUUFBSSxZQUFZO0FBQ2hCLFFBQUksaUJBQWlCLFNBQVMsR0FBRztBQUNoQyxtQkFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBQW9DLGlCQUFpQixLQUFLLElBQUksQ0FBQztBQUFBO0FBQUEsSUFDN0U7QUFDQSxRQUFJLGdCQUFnQixTQUFTLEdBQUc7QUFDL0IsbUJBQWE7QUFBQTtBQUFBO0FBQUEsRUFBc0MsZ0JBQWdCLEtBQUssSUFBSSxDQUFDO0FBQUE7QUFBQSxJQUM5RTtBQUVBLFFBQUksVUFBVSxTQUFTLEdBQUc7QUFDekIsYUFBTyxLQUFLO0FBQUE7QUFBQSwyRkFBZ0csU0FBUyxFQUFFO0FBQUEsSUFDeEg7QUFBQSxFQUNELENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyxlQUFlLE9BQTBCO0FBQ2pELE1BQUksa0JBQWtCLE1BQU07QUFDNUIsTUFBSSxNQUFNLG9CQUFvQjtBQUM3QixzQkFBa0Isa0JBQWtCLE1BQU0sTUFBTTtBQUFBLEVBQ2pEO0FBQ0EsU0FBTztBQUNSO0FBRUEsZUFBZSx5QkFBNEQ7QUFDMUUsUUFBTSxVQUFVLFdBQVcsVUFBVSxxQkFBcUIsRUFBRTtBQUM1RCxRQUFNLGFBQWEsTUFBTSxJQUFJLFNBQVMsY0FBYyxPQUFPO0FBQzNELFFBQU0sU0FBbUMsdUJBQU8sT0FBTyxJQUFJO0FBQzNELGFBQVcsVUFBVSxZQUFZO0FBQ2hDLFFBQUk7QUFDSCxZQUFNLGNBQWMsS0FBSyxPQUFPLE1BQU0sR0FBRyxTQUFTLFNBQVMsS0FBSyxLQUFLLFNBQVMsUUFBUSxjQUFjLENBQUMsR0FBRyxTQUFTLENBQUM7QUFDbEgsWUFBTSxjQUFjLFlBQVksYUFBYTtBQUM3QyxVQUFJLGFBQWE7QUFDaEIsY0FBTSxTQUFTLFlBQVksUUFBUTtBQUNuQyxZQUFJLFFBQVE7QUFDWCxxQkFBVyxTQUFTLFFBQVE7QUFDM0Isa0JBQU0sVUFBVSxNQUFNLElBQUk7QUFDMUIsZ0JBQUksU0FBUztBQUNaLHFCQUFPLE9BQU8sSUFBSSxRQUFRLGFBQWE7QUFBQSxZQUN4QztBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsU0FBUyxHQUFHO0FBQUEsSUFFWjtBQUFBLEVBRUQ7QUFDQSxTQUFPO0FBQ1I7IiwKICAibmFtZXMiOiBbXQp9Cg==
