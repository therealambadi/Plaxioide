import { deepStrictEqual, strictEqual } from "assert";
import { isWindows, OperatingSystem } from "../../../../../base/common/platform.js";
import { URI as Uri } from "../../../../../base/common/uri.js";
import { addTerminalEnvironmentKeys, createTerminalEnvironment, getCwd, getLangEnvVariable, mergeEnvironments, preparePathForShell, shouldSetLangEnvVariable } from "../../common/terminalEnvironment.js";
import { GeneralShellType, PosixShellType, WindowsShellType } from "../../../../../platform/terminal/common/terminal.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("Workbench - TerminalEnvironment", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("addTerminalEnvironmentKeys", () => {
    test("should set expected variables", () => {
      const env = {};
      addTerminalEnvironmentKeys(env, "1.2.3", "en", "on");
      strictEqual(env["TERM_PROGRAM"], "vscode");
      strictEqual(env["TERM_PROGRAM_VERSION"], "1.2.3");
      strictEqual(env["COLORTERM"], "truecolor");
      strictEqual(env["LANG"], "en_US.UTF-8");
    });
    test("should use language variant for LANG that is provided in locale", () => {
      const env = {};
      addTerminalEnvironmentKeys(env, "1.2.3", "en-au", "on");
      strictEqual(env["LANG"], "en_AU.UTF-8", "LANG is equal to the requested locale with UTF-8");
    });
    test("should fallback to en_US when no locale is provided", () => {
      const env2 = { FOO: "bar" };
      addTerminalEnvironmentKeys(env2, "1.2.3", void 0, "on");
      strictEqual(env2["LANG"], "en_US.UTF-8", "LANG is equal to en_US.UTF-8 as fallback.");
    });
    test("should fallback to en_US when an invalid locale is provided", () => {
      const env3 = { LANG: "replace" };
      addTerminalEnvironmentKeys(env3, "1.2.3", void 0, "on");
      strictEqual(env3["LANG"], "en_US.UTF-8", "LANG is set to the fallback LANG");
    });
    test("should override existing LANG", () => {
      const env4 = { LANG: "en_AU.UTF-8" };
      addTerminalEnvironmentKeys(env4, "1.2.3", void 0, "on");
      strictEqual(env4["LANG"], "en_US.UTF-8", "LANG is equal to the parent environment's LANG");
    });
  });
  suite("shouldSetLangEnvVariable", () => {
    test("auto", () => {
      strictEqual(shouldSetLangEnvVariable({}, "auto"), true);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US" }, "auto"), true);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.utf" }, "auto"), true);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.utf8" }, "auto"), false);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.UTF-8" }, "auto"), false);
    });
    test("off", () => {
      strictEqual(shouldSetLangEnvVariable({}, "off"), false);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US" }, "off"), false);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.utf" }, "off"), false);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.utf8" }, "off"), false);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.UTF-8" }, "off"), false);
    });
    test("on", () => {
      strictEqual(shouldSetLangEnvVariable({}, "on"), true);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US" }, "on"), true);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.utf" }, "on"), true);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.utf8" }, "on"), true);
      strictEqual(shouldSetLangEnvVariable({ LANG: "en-US.UTF-8" }, "on"), true);
    });
  });
  suite("getLangEnvVariable", () => {
    test("should fallback to en_US when no locale is provided", () => {
      strictEqual(getLangEnvVariable(void 0), "en_US.UTF-8");
      strictEqual(getLangEnvVariable(""), "en_US.UTF-8");
    });
    test("should fallback to default language variants when variant isn't provided", () => {
      strictEqual(getLangEnvVariable("af"), "af_ZA.UTF-8");
      strictEqual(getLangEnvVariable("am"), "am_ET.UTF-8");
      strictEqual(getLangEnvVariable("be"), "be_BY.UTF-8");
      strictEqual(getLangEnvVariable("bg"), "bg_BG.UTF-8");
      strictEqual(getLangEnvVariable("ca"), "ca_ES.UTF-8");
      strictEqual(getLangEnvVariable("cs"), "cs_CZ.UTF-8");
      strictEqual(getLangEnvVariable("da"), "da_DK.UTF-8");
      strictEqual(getLangEnvVariable("de"), "de_DE.UTF-8");
      strictEqual(getLangEnvVariable("el"), "el_GR.UTF-8");
      strictEqual(getLangEnvVariable("en"), "en_US.UTF-8");
      strictEqual(getLangEnvVariable("es"), "es_ES.UTF-8");
      strictEqual(getLangEnvVariable("et"), "et_EE.UTF-8");
      strictEqual(getLangEnvVariable("eu"), "eu_ES.UTF-8");
      strictEqual(getLangEnvVariable("fi"), "fi_FI.UTF-8");
      strictEqual(getLangEnvVariable("fr"), "fr_FR.UTF-8");
      strictEqual(getLangEnvVariable("he"), "he_IL.UTF-8");
      strictEqual(getLangEnvVariable("hr"), "hr_HR.UTF-8");
      strictEqual(getLangEnvVariable("hu"), "hu_HU.UTF-8");
      strictEqual(getLangEnvVariable("hy"), "hy_AM.UTF-8");
      strictEqual(getLangEnvVariable("is"), "is_IS.UTF-8");
      strictEqual(getLangEnvVariable("it"), "it_IT.UTF-8");
      strictEqual(getLangEnvVariable("ja"), "ja_JP.UTF-8");
      strictEqual(getLangEnvVariable("kk"), "kk_KZ.UTF-8");
      strictEqual(getLangEnvVariable("ko"), "ko_KR.UTF-8");
      strictEqual(getLangEnvVariable("lt"), "lt_LT.UTF-8");
      strictEqual(getLangEnvVariable("nl"), "nl_NL.UTF-8");
      strictEqual(getLangEnvVariable("no"), "no_NO.UTF-8");
      strictEqual(getLangEnvVariable("pl"), "pl_PL.UTF-8");
      strictEqual(getLangEnvVariable("pt"), "pt_BR.UTF-8");
      strictEqual(getLangEnvVariable("ro"), "ro_RO.UTF-8");
      strictEqual(getLangEnvVariable("ru"), "ru_RU.UTF-8");
      strictEqual(getLangEnvVariable("sk"), "sk_SK.UTF-8");
      strictEqual(getLangEnvVariable("sl"), "sl_SI.UTF-8");
      strictEqual(getLangEnvVariable("sr"), "sr_YU.UTF-8");
      strictEqual(getLangEnvVariable("sv"), "sv_SE.UTF-8");
      strictEqual(getLangEnvVariable("tr"), "tr_TR.UTF-8");
      strictEqual(getLangEnvVariable("uk"), "uk_UA.UTF-8");
      strictEqual(getLangEnvVariable("zh"), "zh_CN.UTF-8");
    });
    test("should set language variant based on full locale", () => {
      strictEqual(getLangEnvVariable("en-AU"), "en_AU.UTF-8");
      strictEqual(getLangEnvVariable("en-au"), "en_AU.UTF-8");
      strictEqual(getLangEnvVariable("fa-ke"), "fa_KE.UTF-8");
    });
  });
  suite("mergeEnvironments", () => {
    test("should add keys", () => {
      const parent = {
        a: "b"
      };
      const other = {
        c: "d"
      };
      mergeEnvironments(parent, other);
      deepStrictEqual(parent, {
        a: "b",
        c: "d"
      });
    });
    (!isWindows ? test.skip : test)("should add keys ignoring case on Windows", () => {
      const parent = {
        a: "b"
      };
      const other = {
        A: "c"
      };
      mergeEnvironments(parent, other);
      deepStrictEqual(parent, {
        a: "c"
      });
    });
    test("null values should delete keys from the parent env", () => {
      const parent = {
        a: "b",
        c: "d"
      };
      const other = {
        a: null
      };
      mergeEnvironments(parent, other);
      deepStrictEqual(parent, {
        c: "d"
      });
    });
    (!isWindows ? test.skip : test)("null values should delete keys from the parent env ignoring case on Windows", () => {
      const parent = {
        a: "b",
        c: "d"
      };
      const other = {
        A: null
      };
      mergeEnvironments(parent, other);
      deepStrictEqual(parent, {
        c: "d"
      });
    });
  });
  suite("getCwd", () => {
    function assertPathsMatch(a, b) {
      strictEqual(Uri.file(a).fsPath, Uri.file(b).fsPath);
    }
    test("should default to userHome for an empty workspace", async () => {
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, void 0, void 0), "/userHome/");
    });
    test("should use to the workspace if it exists", async () => {
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, Uri.file("/foo"), void 0), "/foo");
    });
    test("should use an absolute custom cwd as is", async () => {
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, void 0, "/foo"), "/foo");
    });
    test("should normalize a relative custom cwd against the workspace path", async () => {
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, Uri.file("/bar"), "foo"), "/bar/foo");
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, Uri.file("/bar"), "./foo"), "/bar/foo");
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, Uri.file("/bar"), "../foo"), "/foo");
    });
    test("should fall back for relative a custom cwd that doesn't have a workspace", async () => {
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, void 0, "foo"), "/userHome/");
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, void 0, "./foo"), "/userHome/");
      assertPathsMatch(await getCwd({ executable: void 0, args: [] }, "/userHome/", void 0, void 0, "../foo"), "/userHome/");
    });
    test("should ignore custom cwd when told to ignore", async () => {
      assertPathsMatch(await getCwd({ executable: void 0, args: [], ignoreConfigurationCwd: true }, "/userHome/", void 0, Uri.file("/bar"), "/foo"), "/bar");
    });
  });
  suite("preparePathForShell", () => {
    const wslPathBackend = {
      getWslPath: async (original, direction) => {
        if (direction === "unix-to-win") {
          const match2 = original.match(/^\/mnt\/(?<drive>[a-zA-Z])\/(?<path>.+)$/);
          const groups2 = match2?.groups;
          if (!groups2) {
            return original;
          }
          return `${groups2.drive}:\\${groups2.path.replace(/\//g, "\\")}`;
        }
        const match = original.match(/(?<drive>[a-zA-Z]):\\(?<path>.+)/);
        const groups = match?.groups;
        if (!groups) {
          return original;
        }
        return `/mnt/${groups.drive.toLowerCase()}/${groups.path.replace(/\\/g, "/")}`;
      }
    };
    suite("Windows frontend, Windows backend", () => {
      test("Command Prompt", async () => {
        strictEqual(await preparePathForShell("c:\\foo\\bar", "cmd", "cmd", WindowsShellType.CommandPrompt, wslPathBackend, OperatingSystem.Windows, true), `c:\\foo\\bar`);
        strictEqual(await preparePathForShell("c:\\foo\\bar'baz", "cmd", "cmd", WindowsShellType.CommandPrompt, wslPathBackend, OperatingSystem.Windows, true), `c:\\foo\\bar'baz`);
        strictEqual(await preparePathForShell("c:\\foo\\bar$(echo evil)baz", "cmd", "cmd", WindowsShellType.CommandPrompt, wslPathBackend, OperatingSystem.Windows, true), `"c:\\foo\\bar$(echo evil)baz"`);
      });
      test("PowerShell", async () => {
        strictEqual(await preparePathForShell("c:\\foo\\bar", "pwsh", "pwsh", GeneralShellType.PowerShell, wslPathBackend, OperatingSystem.Windows, true), `c:\\foo\\bar`);
        strictEqual(await preparePathForShell("c:\\foo\\bar'baz", "pwsh", "pwsh", GeneralShellType.PowerShell, wslPathBackend, OperatingSystem.Windows, true), `& 'c:\\foo\\bar''baz'`);
        strictEqual(await preparePathForShell("c:\\foo\\bar$(echo evil)baz", "pwsh", "pwsh", GeneralShellType.PowerShell, wslPathBackend, OperatingSystem.Windows, true), `& 'c:\\foo\\bar$(echo evil)baz'`);
      });
      test("Git Bash", async () => {
        strictEqual(await preparePathForShell("c:\\foo\\bar", "bash", "bash", WindowsShellType.GitBash, wslPathBackend, OperatingSystem.Windows, true), `'c:/foo/bar'`);
        strictEqual(await preparePathForShell("c:\\foo\\bar$(echo evil)baz", "bash", "bash", WindowsShellType.GitBash, wslPathBackend, OperatingSystem.Windows, true), `'c:/foo/bar(echo evil)baz'`);
      });
      test("WSL", async () => {
        strictEqual(await preparePathForShell("c:\\foo\\bar", "bash", "bash", WindowsShellType.Wsl, wslPathBackend, OperatingSystem.Windows, true), "/mnt/c/foo/bar");
      });
    });
    suite("Windows frontend, Linux backend", () => {
      test("Bash", async () => {
        strictEqual(await preparePathForShell("/foo/bar", "bash", "bash", PosixShellType.Bash, wslPathBackend, OperatingSystem.Linux, true), `'/foo/bar'`);
        strictEqual(await preparePathForShell("/foo/bar'baz", "bash", "bash", PosixShellType.Bash, wslPathBackend, OperatingSystem.Linux, true), `'/foo/barbaz'`);
        strictEqual(await preparePathForShell("/foo/bar$(echo evil)baz", "bash", "bash", PosixShellType.Bash, wslPathBackend, OperatingSystem.Linux, true), `'/foo/bar(echo evil)baz'`);
      });
    });
    suite("Linux frontend, Windows backend", () => {
      test("Command Prompt", async () => {
        strictEqual(await preparePathForShell("c:\\foo\\bar", "cmd", "cmd", WindowsShellType.CommandPrompt, wslPathBackend, OperatingSystem.Windows, false), `c:\\foo\\bar`);
        strictEqual(await preparePathForShell("c:\\foo\\bar'baz", "cmd", "cmd", WindowsShellType.CommandPrompt, wslPathBackend, OperatingSystem.Windows, false), `c:\\foo\\bar'baz`);
        strictEqual(await preparePathForShell("c:\\foo\\bar$(echo evil)baz", "cmd", "cmd", WindowsShellType.CommandPrompt, wslPathBackend, OperatingSystem.Windows, false), `"c:\\foo\\bar$(echo evil)baz"`);
      });
      test("PowerShell", async () => {
        strictEqual(await preparePathForShell("c:\\foo\\bar", "pwsh", "pwsh", GeneralShellType.PowerShell, wslPathBackend, OperatingSystem.Windows, false), `c:\\foo\\bar`);
        strictEqual(await preparePathForShell("c:\\foo\\bar'baz", "pwsh", "pwsh", GeneralShellType.PowerShell, wslPathBackend, OperatingSystem.Windows, false), `& 'c:\\foo\\bar''baz'`);
        strictEqual(await preparePathForShell("c:\\foo\\bar$(echo evil)baz", "pwsh", "pwsh", GeneralShellType.PowerShell, wslPathBackend, OperatingSystem.Windows, false), `& 'c:\\foo\\bar$(echo evil)baz'`);
      });
      test("Git Bash", async () => {
        strictEqual(await preparePathForShell("c:\\foo\\bar", "bash", "bash", WindowsShellType.GitBash, wslPathBackend, OperatingSystem.Windows, false), `'c:/foo/bar'`);
        strictEqual(await preparePathForShell("c:\\foo\\bar$(echo evil)baz", "bash", "bash", WindowsShellType.GitBash, wslPathBackend, OperatingSystem.Windows, false), `'c:/foo/bar(echo evil)baz'`);
      });
      test("WSL", async () => {
        strictEqual(await preparePathForShell("c:\\foo\\bar", "bash", "bash", WindowsShellType.Wsl, wslPathBackend, OperatingSystem.Windows, false), "/mnt/c/foo/bar");
      });
    });
    suite("Linux frontend, Linux backend", () => {
      test("Bash", async () => {
        strictEqual(await preparePathForShell("/foo/bar", "bash", "bash", PosixShellType.Bash, wslPathBackend, OperatingSystem.Linux, false), `'/foo/bar'`);
        strictEqual(await preparePathForShell("/foo/bar'baz", "bash", "bash", PosixShellType.Bash, wslPathBackend, OperatingSystem.Linux, false), `'/foo/barbaz'`);
        strictEqual(await preparePathForShell("/foo/bar$(echo evil)baz", "bash", "bash", PosixShellType.Bash, wslPathBackend, OperatingSystem.Linux, false), `'/foo/bar(echo evil)baz'`);
      });
    });
  });
  suite("createTerminalEnvironment", () => {
    const commonVariables = {
      COLORTERM: "truecolor",
      TERM_PROGRAM: "vscode"
    };
    test("should retain variables equal to the empty string", async () => {
      deepStrictEqual(
        await createTerminalEnvironment({}, void 0, void 0, void 0, "off", { foo: "bar", empty: "" }),
        { foo: "bar", empty: "", ...commonVariables }
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2NvbW1vbi90ZXJtaW5hbEVudmlyb25tZW50LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkZWVwU3RyaWN0RXF1YWwsIHN0cmljdEVxdWFsIH0gZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzLCBPcGVyYXRpbmdTeXN0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgYXMgVXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGFkZFRlcm1pbmFsRW52aXJvbm1lbnRLZXlzLCBjcmVhdGVUZXJtaW5hbEVudmlyb25tZW50LCBnZXRDd2QsIGdldExhbmdFbnZWYXJpYWJsZSwgbWVyZ2VFbnZpcm9ubWVudHMsIHByZXBhcmVQYXRoRm9yU2hlbGwsIHNob3VsZFNldExhbmdFbnZWYXJpYWJsZSB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJtaW5hbEVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IEdlbmVyYWxTaGVsbFR5cGUsIFBvc2l4U2hlbGxUeXBlLCBXaW5kb3dzU2hlbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnV29ya2JlbmNoIC0gVGVybWluYWxFbnZpcm9ubWVudCcsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c3VpdGUoJ2FkZFRlcm1pbmFsRW52aXJvbm1lbnRLZXlzJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBzZXQgZXhwZWN0ZWQgdmFyaWFibGVzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZW52OiB7IFtrZXk6IHN0cmluZ106IGFueSB9ID0ge307XG5cdFx0XHRhZGRUZXJtaW5hbEVudmlyb25tZW50S2V5cyhlbnYsICcxLjIuMycsICdlbicsICdvbicpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZW52WydURVJNX1BST0dSQU0nXSwgJ3ZzY29kZScpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZW52WydURVJNX1BST0dSQU1fVkVSU0lPTiddLCAnMS4yLjMnKTtcblx0XHRcdHN0cmljdEVxdWFsKGVudlsnQ09MT1JURVJNJ10sICd0cnVlY29sb3InKTtcblx0XHRcdHN0cmljdEVxdWFsKGVudlsnTEFORyddLCAnZW5fVVMuVVRGLTgnKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgdXNlIGxhbmd1YWdlIHZhcmlhbnQgZm9yIExBTkcgdGhhdCBpcyBwcm92aWRlZCBpbiBsb2NhbGUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBlbnY6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fTtcblx0XHRcdGFkZFRlcm1pbmFsRW52aXJvbm1lbnRLZXlzKGVudiwgJzEuMi4zJywgJ2VuLWF1JywgJ29uJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChlbnZbJ0xBTkcnXSwgJ2VuX0FVLlVURi04JywgJ0xBTkcgaXMgZXF1YWwgdG8gdGhlIHJlcXVlc3RlZCBsb2NhbGUgd2l0aCBVVEYtOCcpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBmYWxsYmFjayB0byBlbl9VUyB3aGVuIG5vIGxvY2FsZSBpcyBwcm92aWRlZCcsICgpID0+IHtcblx0XHRcdGNvbnN0IGVudjI6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7IEZPTzogJ2JhcicgfTtcblx0XHRcdGFkZFRlcm1pbmFsRW52aXJvbm1lbnRLZXlzKGVudjIsICcxLjIuMycsIHVuZGVmaW5lZCwgJ29uJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChlbnYyWydMQU5HJ10sICdlbl9VUy5VVEYtOCcsICdMQU5HIGlzIGVxdWFsIHRvIGVuX1VTLlVURi04IGFzIGZhbGxiYWNrLicpOyAvLyBNb3JlIGluZm8gb24gaXNzdWUgIzE0NTg2XG5cdFx0fSk7XG5cdFx0dGVzdCgnc2hvdWxkIGZhbGxiYWNrIHRvIGVuX1VTIHdoZW4gYW4gaW52YWxpZCBsb2NhbGUgaXMgcHJvdmlkZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBlbnYzID0geyBMQU5HOiAncmVwbGFjZScgfTtcblx0XHRcdGFkZFRlcm1pbmFsRW52aXJvbm1lbnRLZXlzKGVudjMsICcxLjIuMycsIHVuZGVmaW5lZCwgJ29uJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChlbnYzWydMQU5HJ10sICdlbl9VUy5VVEYtOCcsICdMQU5HIGlzIHNldCB0byB0aGUgZmFsbGJhY2sgTEFORycpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBvdmVycmlkZSBleGlzdGluZyBMQU5HJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZW52NCA9IHsgTEFORzogJ2VuX0FVLlVURi04JyB9O1xuXHRcdFx0YWRkVGVybWluYWxFbnZpcm9ubWVudEtleXMoZW52NCwgJzEuMi4zJywgdW5kZWZpbmVkLCAnb24nKTtcblx0XHRcdHN0cmljdEVxdWFsKGVudjRbJ0xBTkcnXSwgJ2VuX1VTLlVURi04JywgJ0xBTkcgaXMgZXF1YWwgdG8gdGhlIHBhcmVudCBlbnZpcm9ubWVudFxcJ3MgTEFORycpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnc2hvdWxkU2V0TGFuZ0VudlZhcmlhYmxlJywgKCkgPT4ge1xuXHRcdHRlc3QoJ2F1dG8nLCAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChzaG91bGRTZXRMYW5nRW52VmFyaWFibGUoe30sICdhdXRvJyksIHRydWUpO1xuXHRcdFx0c3RyaWN0RXF1YWwoc2hvdWxkU2V0TGFuZ0VudlZhcmlhYmxlKHsgTEFORzogJ2VuLVVTJyB9LCAnYXV0bycpLCB0cnVlKTtcblx0XHRcdHN0cmljdEVxdWFsKHNob3VsZFNldExhbmdFbnZWYXJpYWJsZSh7IExBTkc6ICdlbi1VUy51dGYnIH0sICdhdXRvJyksIHRydWUpO1xuXHRcdFx0c3RyaWN0RXF1YWwoc2hvdWxkU2V0TGFuZ0VudlZhcmlhYmxlKHsgTEFORzogJ2VuLVVTLnV0ZjgnIH0sICdhdXRvJyksIGZhbHNlKTtcblx0XHRcdHN0cmljdEVxdWFsKHNob3VsZFNldExhbmdFbnZWYXJpYWJsZSh7IExBTkc6ICdlbi1VUy5VVEYtOCcgfSwgJ2F1dG8nKSwgZmFsc2UpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ29mZicsICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKHNob3VsZFNldExhbmdFbnZWYXJpYWJsZSh7fSwgJ29mZicpLCBmYWxzZSk7XG5cdFx0XHRzdHJpY3RFcXVhbChzaG91bGRTZXRMYW5nRW52VmFyaWFibGUoeyBMQU5HOiAnZW4tVVMnIH0sICdvZmYnKSwgZmFsc2UpO1xuXHRcdFx0c3RyaWN0RXF1YWwoc2hvdWxkU2V0TGFuZ0VudlZhcmlhYmxlKHsgTEFORzogJ2VuLVVTLnV0ZicgfSwgJ29mZicpLCBmYWxzZSk7XG5cdFx0XHRzdHJpY3RFcXVhbChzaG91bGRTZXRMYW5nRW52VmFyaWFibGUoeyBMQU5HOiAnZW4tVVMudXRmOCcgfSwgJ29mZicpLCBmYWxzZSk7XG5cdFx0XHRzdHJpY3RFcXVhbChzaG91bGRTZXRMYW5nRW52VmFyaWFibGUoeyBMQU5HOiAnZW4tVVMuVVRGLTgnIH0sICdvZmYnKSwgZmFsc2UpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ29uJywgKCkgPT4ge1xuXHRcdFx0c3RyaWN0RXF1YWwoc2hvdWxkU2V0TGFuZ0VudlZhcmlhYmxlKHt9LCAnb24nKSwgdHJ1ZSk7XG5cdFx0XHRzdHJpY3RFcXVhbChzaG91bGRTZXRMYW5nRW52VmFyaWFibGUoeyBMQU5HOiAnZW4tVVMnIH0sICdvbicpLCB0cnVlKTtcblx0XHRcdHN0cmljdEVxdWFsKHNob3VsZFNldExhbmdFbnZWYXJpYWJsZSh7IExBTkc6ICdlbi1VUy51dGYnIH0sICdvbicpLCB0cnVlKTtcblx0XHRcdHN0cmljdEVxdWFsKHNob3VsZFNldExhbmdFbnZWYXJpYWJsZSh7IExBTkc6ICdlbi1VUy51dGY4JyB9LCAnb24nKSwgdHJ1ZSk7XG5cdFx0XHRzdHJpY3RFcXVhbChzaG91bGRTZXRMYW5nRW52VmFyaWFibGUoeyBMQU5HOiAnZW4tVVMuVVRGLTgnIH0sICdvbicpLCB0cnVlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2dldExhbmdFbnZWYXJpYWJsZScsICgpID0+IHtcblx0XHR0ZXN0KCdzaG91bGQgZmFsbGJhY2sgdG8gZW5fVVMgd2hlbiBubyBsb2NhbGUgaXMgcHJvdmlkZWQnLCAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUodW5kZWZpbmVkKSwgJ2VuX1VTLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJycpLCAnZW5fVVMuVVRGLTgnKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgZmFsbGJhY2sgdG8gZGVmYXVsdCBsYW5ndWFnZSB2YXJpYW50cyB3aGVuIHZhcmlhbnQgaXNuXFwndCBwcm92aWRlZCcsICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnYWYnKSwgJ2FmX1pBLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2FtJyksICdhbV9FVC5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdiZScpLCAnYmVfQlkuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnYmcnKSwgJ2JnX0JHLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2NhJyksICdjYV9FUy5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdjcycpLCAnY3NfQ1ouVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnZGEnKSwgJ2RhX0RLLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2RlJyksICdkZV9ERS5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdlbCcpLCAnZWxfR1IuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnZW4nKSwgJ2VuX1VTLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2VzJyksICdlc19FUy5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdldCcpLCAnZXRfRUUuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnZXUnKSwgJ2V1X0VTLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2ZpJyksICdmaV9GSS5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdmcicpLCAnZnJfRlIuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnaGUnKSwgJ2hlX0lMLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2hyJyksICdocl9IUi5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdodScpLCAnaHVfSFUuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnaHknKSwgJ2h5X0FNLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2lzJyksICdpc19JUy5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdpdCcpLCAnaXRfSVQuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnamEnKSwgJ2phX0pQLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2trJyksICdra19LWi5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdrbycpLCAna29fS1IuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnbHQnKSwgJ2x0X0xULlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ25sJyksICdubF9OTC5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdubycpLCAnbm9fTk8uVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgncGwnKSwgJ3BsX1BMLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ3B0JyksICdwdF9CUi5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdybycpLCAncm9fUk8uVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgncnUnKSwgJ3J1X1JVLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ3NrJyksICdza19TSy5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdzbCcpLCAnc2xfU0kuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnc3InKSwgJ3NyX1lVLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ3N2JyksICdzdl9TRS5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCd0cicpLCAndHJfVFIuVVRGLTgnKTtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgndWsnKSwgJ3VrX1VBLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ3poJyksICd6aF9DTi5VVEYtOCcpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCBzZXQgbGFuZ3VhZ2UgdmFyaWFudCBiYXNlZCBvbiBmdWxsIGxvY2FsZScsICgpID0+IHtcblx0XHRcdHN0cmljdEVxdWFsKGdldExhbmdFbnZWYXJpYWJsZSgnZW4tQVUnKSwgJ2VuX0FVLlVURi04Jyk7XG5cdFx0XHRzdHJpY3RFcXVhbChnZXRMYW5nRW52VmFyaWFibGUoJ2VuLWF1JyksICdlbl9BVS5VVEYtOCcpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZ2V0TGFuZ0VudlZhcmlhYmxlKCdmYS1rZScpLCAnZmFfS0UuVVRGLTgnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ21lcmdlRW52aXJvbm1lbnRzJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBhZGQga2V5cycsICgpID0+IHtcblx0XHRcdGNvbnN0IHBhcmVudCA9IHtcblx0XHRcdFx0YTogJ2InXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3Qgb3RoZXIgPSB7XG5cdFx0XHRcdGM6ICdkJ1xuXHRcdFx0fTtcblx0XHRcdG1lcmdlRW52aXJvbm1lbnRzKHBhcmVudCwgb3RoZXIpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKHBhcmVudCwge1xuXHRcdFx0XHRhOiAnYicsXG5cdFx0XHRcdGM6ICdkJ1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHQoIWlzV2luZG93cyA/IHRlc3Quc2tpcCA6IHRlc3QpKCdzaG91bGQgYWRkIGtleXMgaWdub3JpbmcgY2FzZSBvbiBXaW5kb3dzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcGFyZW50ID0ge1xuXHRcdFx0XHRhOiAnYidcblx0XHRcdH07XG5cdFx0XHRjb25zdCBvdGhlciA9IHtcblx0XHRcdFx0QTogJ2MnXG5cdFx0XHR9O1xuXHRcdFx0bWVyZ2VFbnZpcm9ubWVudHMocGFyZW50LCBvdGhlcik7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwocGFyZW50LCB7XG5cdFx0XHRcdGE6ICdjJ1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdudWxsIHZhbHVlcyBzaG91bGQgZGVsZXRlIGtleXMgZnJvbSB0aGUgcGFyZW50IGVudicsICgpID0+IHtcblx0XHRcdGNvbnN0IHBhcmVudCA9IHtcblx0XHRcdFx0YTogJ2InLFxuXHRcdFx0XHRjOiAnZCdcblx0XHRcdH07XG5cdFx0XHRjb25zdCBvdGhlcjogSVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nIHwgbnVsbD4gPSB7XG5cdFx0XHRcdGE6IG51bGxcblx0XHRcdH07XG5cdFx0XHRtZXJnZUVudmlyb25tZW50cyhwYXJlbnQsIG90aGVyKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChwYXJlbnQsIHtcblx0XHRcdFx0YzogJ2QnXG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdCghaXNXaW5kb3dzID8gdGVzdC5za2lwIDogdGVzdCkoJ251bGwgdmFsdWVzIHNob3VsZCBkZWxldGUga2V5cyBmcm9tIHRoZSBwYXJlbnQgZW52IGlnbm9yaW5nIGNhc2Ugb24gV2luZG93cycsICgpID0+IHtcblx0XHRcdGNvbnN0IHBhcmVudCA9IHtcblx0XHRcdFx0YTogJ2InLFxuXHRcdFx0XHRjOiAnZCdcblx0XHRcdH07XG5cdFx0XHRjb25zdCBvdGhlcjogSVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nIHwgbnVsbD4gPSB7XG5cdFx0XHRcdEE6IG51bGxcblx0XHRcdH07XG5cdFx0XHRtZXJnZUVudmlyb25tZW50cyhwYXJlbnQsIG90aGVyKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChwYXJlbnQsIHtcblx0XHRcdFx0YzogJ2QnXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2dldEN3ZCcsICgpID0+IHtcblx0XHQvLyBUaGlzIGhlbHBlciBjaGVja3MgdGhlIHBhdGhzIGluIGEgY3Jvc3MtcGxhdGZvcm0gZnJpZW5kbHkgbWFubmVyXG5cdFx0ZnVuY3Rpb24gYXNzZXJ0UGF0aHNNYXRjaChhOiBzdHJpbmcsIGI6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0c3RyaWN0RXF1YWwoVXJpLmZpbGUoYSkuZnNQYXRoLCBVcmkuZmlsZShiKS5mc1BhdGgpO1xuXHRcdH1cblxuXHRcdHRlc3QoJ3Nob3VsZCBkZWZhdWx0IHRvIHVzZXJIb21lIGZvciBhbiBlbXB0eSB3b3Jrc3BhY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhc3NlcnRQYXRoc01hdGNoKGF3YWl0IGdldEN3ZCh7IGV4ZWN1dGFibGU6IHVuZGVmaW5lZCwgYXJnczogW10gfSwgJy91c2VySG9tZS8nLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKSwgJy91c2VySG9tZS8nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB1c2UgdG8gdGhlIHdvcmtzcGFjZSBpZiBpdCBleGlzdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhc3NlcnRQYXRoc01hdGNoKGF3YWl0IGdldEN3ZCh7IGV4ZWN1dGFibGU6IHVuZGVmaW5lZCwgYXJnczogW10gfSwgJy91c2VySG9tZS8nLCB1bmRlZmluZWQsIFVyaS5maWxlKCcvZm9vJyksIHVuZGVmaW5lZCksICcvZm9vJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgdXNlIGFuIGFic29sdXRlIGN1c3RvbSBjd2QgYXMgaXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhc3NlcnRQYXRoc01hdGNoKGF3YWl0IGdldEN3ZCh7IGV4ZWN1dGFibGU6IHVuZGVmaW5lZCwgYXJnczogW10gfSwgJy91c2VySG9tZS8nLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgJy9mb28nKSwgJy9mb28nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBub3JtYWxpemUgYSByZWxhdGl2ZSBjdXN0b20gY3dkIGFnYWluc3QgdGhlIHdvcmtzcGFjZSBwYXRoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0UGF0aHNNYXRjaChhd2FpdCBnZXRDd2QoeyBleGVjdXRhYmxlOiB1bmRlZmluZWQsIGFyZ3M6IFtdIH0sICcvdXNlckhvbWUvJywgdW5kZWZpbmVkLCBVcmkuZmlsZSgnL2JhcicpLCAnZm9vJyksICcvYmFyL2ZvbycpO1xuXHRcdFx0YXNzZXJ0UGF0aHNNYXRjaChhd2FpdCBnZXRDd2QoeyBleGVjdXRhYmxlOiB1bmRlZmluZWQsIGFyZ3M6IFtdIH0sICcvdXNlckhvbWUvJywgdW5kZWZpbmVkLCBVcmkuZmlsZSgnL2JhcicpLCAnLi9mb28nKSwgJy9iYXIvZm9vJyk7XG5cdFx0XHRhc3NlcnRQYXRoc01hdGNoKGF3YWl0IGdldEN3ZCh7IGV4ZWN1dGFibGU6IHVuZGVmaW5lZCwgYXJnczogW10gfSwgJy91c2VySG9tZS8nLCB1bmRlZmluZWQsIFVyaS5maWxlKCcvYmFyJyksICcuLi9mb28nKSwgJy9mb28nKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBmYWxsIGJhY2sgZm9yIHJlbGF0aXZlIGEgY3VzdG9tIGN3ZCB0aGF0IGRvZXNuXFwndCBoYXZlIGEgd29ya3NwYWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0UGF0aHNNYXRjaChhd2FpdCBnZXRDd2QoeyBleGVjdXRhYmxlOiB1bmRlZmluZWQsIGFyZ3M6IFtdIH0sICcvdXNlckhvbWUvJywgdW5kZWZpbmVkLCB1bmRlZmluZWQsICdmb28nKSwgJy91c2VySG9tZS8nKTtcblx0XHRcdGFzc2VydFBhdGhzTWF0Y2goYXdhaXQgZ2V0Q3dkKHsgZXhlY3V0YWJsZTogdW5kZWZpbmVkLCBhcmdzOiBbXSB9LCAnL3VzZXJIb21lLycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCAnLi9mb28nKSwgJy91c2VySG9tZS8nKTtcblx0XHRcdGFzc2VydFBhdGhzTWF0Y2goYXdhaXQgZ2V0Q3dkKHsgZXhlY3V0YWJsZTogdW5kZWZpbmVkLCBhcmdzOiBbXSB9LCAnL3VzZXJIb21lLycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCAnLi4vZm9vJyksICcvdXNlckhvbWUvJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgaWdub3JlIGN1c3RvbSBjd2Qgd2hlbiB0b2xkIHRvIGlnbm9yZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydFBhdGhzTWF0Y2goYXdhaXQgZ2V0Q3dkKHsgZXhlY3V0YWJsZTogdW5kZWZpbmVkLCBhcmdzOiBbXSwgaWdub3JlQ29uZmlndXJhdGlvbkN3ZDogdHJ1ZSB9LCAnL3VzZXJIb21lLycsIHVuZGVmaW5lZCwgVXJpLmZpbGUoJy9iYXInKSwgJy9mb28nKSwgJy9iYXInKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ3ByZXBhcmVQYXRoRm9yU2hlbGwnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgd3NsUGF0aEJhY2tlbmQgPSB7XG5cdFx0XHRnZXRXc2xQYXRoOiBhc3luYyAob3JpZ2luYWw6IHN0cmluZywgZGlyZWN0aW9uOiAndW5peC10by13aW4nIHwgJ3dpbi10by11bml4JykgPT4ge1xuXHRcdFx0XHRpZiAoZGlyZWN0aW9uID09PSAndW5peC10by13aW4nKSB7XG5cdFx0XHRcdFx0Y29uc3QgbWF0Y2ggPSBvcmlnaW5hbC5tYXRjaCgvXlxcL21udFxcLyg/PGRyaXZlPlthLXpBLVpdKVxcLyg/PHBhdGg+LispJC8pO1xuXHRcdFx0XHRcdGNvbnN0IGdyb3VwcyA9IG1hdGNoPy5ncm91cHM7XG5cdFx0XHRcdFx0aWYgKCFncm91cHMpIHtcblx0XHRcdFx0XHRcdHJldHVybiBvcmlnaW5hbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGAke2dyb3Vwcy5kcml2ZX06XFxcXCR7Z3JvdXBzLnBhdGgucmVwbGFjZSgvXFwvL2csICdcXFxcJyl9YDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBtYXRjaCA9IG9yaWdpbmFsLm1hdGNoKC8oPzxkcml2ZT5bYS16QS1aXSk6XFxcXCg/PHBhdGg+LispLyk7XG5cdFx0XHRcdGNvbnN0IGdyb3VwcyA9IG1hdGNoPy5ncm91cHM7XG5cdFx0XHRcdGlmICghZ3JvdXBzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG9yaWdpbmFsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBgL21udC8ke2dyb3Vwcy5kcml2ZS50b0xvd2VyQ2FzZSgpfS8ke2dyb3Vwcy5wYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKX1gO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0c3VpdGUoJ1dpbmRvd3MgZnJvbnRlbmQsIFdpbmRvd3MgYmFja2VuZCcsICgpID0+IHtcblx0XHRcdHRlc3QoJ0NvbW1hbmQgUHJvbXB0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRzdHJpY3RFcXVhbChhd2FpdCBwcmVwYXJlUGF0aEZvclNoZWxsKCdjOlxcXFxmb29cXFxcYmFyJywgJ2NtZCcsICdjbWQnLCBXaW5kb3dzU2hlbGxUeXBlLkNvbW1hbmRQcm9tcHQsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgdHJ1ZSksIGBjOlxcXFxmb29cXFxcYmFyYCk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IHByZXBhcmVQYXRoRm9yU2hlbGwoJ2M6XFxcXGZvb1xcXFxiYXJcXCdiYXonLCAnY21kJywgJ2NtZCcsIFdpbmRvd3NTaGVsbFR5cGUuQ29tbWFuZFByb21wdCwgd3NsUGF0aEJhY2tlbmQsIE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLCB0cnVlKSwgYGM6XFxcXGZvb1xcXFxiYXInYmF6YCk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IHByZXBhcmVQYXRoRm9yU2hlbGwoJ2M6XFxcXGZvb1xcXFxiYXIkKGVjaG8gZXZpbCliYXonLCAnY21kJywgJ2NtZCcsIFdpbmRvd3NTaGVsbFR5cGUuQ29tbWFuZFByb21wdCwgd3NsUGF0aEJhY2tlbmQsIE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLCB0cnVlKSwgYFwiYzpcXFxcZm9vXFxcXGJhciQoZWNobyBldmlsKWJhelwiYCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ1Bvd2VyU2hlbGwnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IHByZXBhcmVQYXRoRm9yU2hlbGwoJ2M6XFxcXGZvb1xcXFxiYXInLCAncHdzaCcsICdwd3NoJywgR2VuZXJhbFNoZWxsVHlwZS5Qb3dlclNoZWxsLCB3c2xQYXRoQmFja2VuZCwgT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MsIHRydWUpLCBgYzpcXFxcZm9vXFxcXGJhcmApO1xuXHRcdFx0XHRzdHJpY3RFcXVhbChhd2FpdCBwcmVwYXJlUGF0aEZvclNoZWxsKCdjOlxcXFxmb29cXFxcYmFyXFwnYmF6JywgJ3B3c2gnLCAncHdzaCcsIEdlbmVyYWxTaGVsbFR5cGUuUG93ZXJTaGVsbCwgd3NsUGF0aEJhY2tlbmQsIE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLCB0cnVlKSwgYCYgJ2M6XFxcXGZvb1xcXFxiYXInJ2JheidgKTtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnYzpcXFxcZm9vXFxcXGJhciQoZWNobyBldmlsKWJheicsICdwd3NoJywgJ3B3c2gnLCBHZW5lcmFsU2hlbGxUeXBlLlBvd2VyU2hlbGwsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgdHJ1ZSksIGAmICdjOlxcXFxmb29cXFxcYmFyJChlY2hvIGV2aWwpYmF6J2ApO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdHaXQgQmFzaCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnYzpcXFxcZm9vXFxcXGJhcicsICdiYXNoJywgJ2Jhc2gnLCBXaW5kb3dzU2hlbGxUeXBlLkdpdEJhc2gsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgdHJ1ZSksIGAnYzovZm9vL2JhcidgKTtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnYzpcXFxcZm9vXFxcXGJhciQoZWNobyBldmlsKWJheicsICdiYXNoJywgJ2Jhc2gnLCBXaW5kb3dzU2hlbGxUeXBlLkdpdEJhc2gsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgdHJ1ZSksIGAnYzovZm9vL2JhcihlY2hvIGV2aWwpYmF6J2ApO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdXU0wnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IHByZXBhcmVQYXRoRm9yU2hlbGwoJ2M6XFxcXGZvb1xcXFxiYXInLCAnYmFzaCcsICdiYXNoJywgV2luZG93c1NoZWxsVHlwZS5Xc2wsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgdHJ1ZSksICcvbW50L2MvZm9vL2JhcicpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c3VpdGUoJ1dpbmRvd3MgZnJvbnRlbmQsIExpbnV4IGJhY2tlbmQnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdCYXNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRzdHJpY3RFcXVhbChhd2FpdCBwcmVwYXJlUGF0aEZvclNoZWxsKCcvZm9vL2JhcicsICdiYXNoJywgJ2Jhc2gnLCBQb3NpeFNoZWxsVHlwZS5CYXNoLCB3c2xQYXRoQmFja2VuZCwgT3BlcmF0aW5nU3lzdGVtLkxpbnV4LCB0cnVlKSwgYCcvZm9vL2JhcidgKTtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnL2Zvby9iYXJcXCdiYXonLCAnYmFzaCcsICdiYXNoJywgUG9zaXhTaGVsbFR5cGUuQmFzaCwgd3NsUGF0aEJhY2tlbmQsIE9wZXJhdGluZ1N5c3RlbS5MaW51eCwgdHJ1ZSksIGAnL2Zvby9iYXJiYXonYCk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IHByZXBhcmVQYXRoRm9yU2hlbGwoJy9mb28vYmFyJChlY2hvIGV2aWwpYmF6JywgJ2Jhc2gnLCAnYmFzaCcsIFBvc2l4U2hlbGxUeXBlLkJhc2gsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uTGludXgsIHRydWUpLCBgJy9mb28vYmFyKGVjaG8gZXZpbCliYXonYCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnTGludXggZnJvbnRlbmQsIFdpbmRvd3MgYmFja2VuZCcsICgpID0+IHtcblx0XHRcdHRlc3QoJ0NvbW1hbmQgUHJvbXB0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRzdHJpY3RFcXVhbChhd2FpdCBwcmVwYXJlUGF0aEZvclNoZWxsKCdjOlxcXFxmb29cXFxcYmFyJywgJ2NtZCcsICdjbWQnLCBXaW5kb3dzU2hlbGxUeXBlLkNvbW1hbmRQcm9tcHQsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgZmFsc2UpLCBgYzpcXFxcZm9vXFxcXGJhcmApO1xuXHRcdFx0XHRzdHJpY3RFcXVhbChhd2FpdCBwcmVwYXJlUGF0aEZvclNoZWxsKCdjOlxcXFxmb29cXFxcYmFyXFwnYmF6JywgJ2NtZCcsICdjbWQnLCBXaW5kb3dzU2hlbGxUeXBlLkNvbW1hbmRQcm9tcHQsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgZmFsc2UpLCBgYzpcXFxcZm9vXFxcXGJhcidiYXpgKTtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnYzpcXFxcZm9vXFxcXGJhciQoZWNobyBldmlsKWJheicsICdjbWQnLCAnY21kJywgV2luZG93c1NoZWxsVHlwZS5Db21tYW5kUHJvbXB0LCB3c2xQYXRoQmFja2VuZCwgT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MsIGZhbHNlKSwgYFwiYzpcXFxcZm9vXFxcXGJhciQoZWNobyBldmlsKWJhelwiYCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ1Bvd2VyU2hlbGwnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IHByZXBhcmVQYXRoRm9yU2hlbGwoJ2M6XFxcXGZvb1xcXFxiYXInLCAncHdzaCcsICdwd3NoJywgR2VuZXJhbFNoZWxsVHlwZS5Qb3dlclNoZWxsLCB3c2xQYXRoQmFja2VuZCwgT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MsIGZhbHNlKSwgYGM6XFxcXGZvb1xcXFxiYXJgKTtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnYzpcXFxcZm9vXFxcXGJhclxcJ2JheicsICdwd3NoJywgJ3B3c2gnLCBHZW5lcmFsU2hlbGxUeXBlLlBvd2VyU2hlbGwsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgZmFsc2UpLCBgJiAnYzpcXFxcZm9vXFxcXGJhcicnYmF6J2ApO1xuXHRcdFx0XHRzdHJpY3RFcXVhbChhd2FpdCBwcmVwYXJlUGF0aEZvclNoZWxsKCdjOlxcXFxmb29cXFxcYmFyJChlY2hvIGV2aWwpYmF6JywgJ3B3c2gnLCAncHdzaCcsIEdlbmVyYWxTaGVsbFR5cGUuUG93ZXJTaGVsbCwgd3NsUGF0aEJhY2tlbmQsIE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLCBmYWxzZSksIGAmICdjOlxcXFxmb29cXFxcYmFyJChlY2hvIGV2aWwpYmF6J2ApO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdHaXQgQmFzaCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnYzpcXFxcZm9vXFxcXGJhcicsICdiYXNoJywgJ2Jhc2gnLCBXaW5kb3dzU2hlbGxUeXBlLkdpdEJhc2gsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cywgZmFsc2UpLCBgJ2M6L2Zvby9iYXInYCk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IHByZXBhcmVQYXRoRm9yU2hlbGwoJ2M6XFxcXGZvb1xcXFxiYXIkKGVjaG8gZXZpbCliYXonLCAnYmFzaCcsICdiYXNoJywgV2luZG93c1NoZWxsVHlwZS5HaXRCYXNoLCB3c2xQYXRoQmFja2VuZCwgT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MsIGZhbHNlKSwgYCdjOi9mb28vYmFyKGVjaG8gZXZpbCliYXonYCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ1dTTCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnYzpcXFxcZm9vXFxcXGJhcicsICdiYXNoJywgJ2Jhc2gnLCBXaW5kb3dzU2hlbGxUeXBlLldzbCwgd3NsUGF0aEJhY2tlbmQsIE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLCBmYWxzZSksICcvbW50L2MvZm9vL2JhcicpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0c3VpdGUoJ0xpbnV4IGZyb250ZW5kLCBMaW51eCBiYWNrZW5kJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnQmFzaCcsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXdhaXQgcHJlcGFyZVBhdGhGb3JTaGVsbCgnL2Zvby9iYXInLCAnYmFzaCcsICdiYXNoJywgUG9zaXhTaGVsbFR5cGUuQmFzaCwgd3NsUGF0aEJhY2tlbmQsIE9wZXJhdGluZ1N5c3RlbS5MaW51eCwgZmFsc2UpLCBgJy9mb28vYmFyJ2ApO1xuXHRcdFx0XHRzdHJpY3RFcXVhbChhd2FpdCBwcmVwYXJlUGF0aEZvclNoZWxsKCcvZm9vL2JhclxcJ2JheicsICdiYXNoJywgJ2Jhc2gnLCBQb3NpeFNoZWxsVHlwZS5CYXNoLCB3c2xQYXRoQmFja2VuZCwgT3BlcmF0aW5nU3lzdGVtLkxpbnV4LCBmYWxzZSksIGAnL2Zvby9iYXJiYXonYCk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGF3YWl0IHByZXBhcmVQYXRoRm9yU2hlbGwoJy9mb28vYmFyJChlY2hvIGV2aWwpYmF6JywgJ2Jhc2gnLCAnYmFzaCcsIFBvc2l4U2hlbGxUeXBlLkJhc2gsIHdzbFBhdGhCYWNrZW5kLCBPcGVyYXRpbmdTeXN0ZW0uTGludXgsIGZhbHNlKSwgYCcvZm9vL2JhcihlY2hvIGV2aWwpYmF6J2ApO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnY3JlYXRlVGVybWluYWxFbnZpcm9ubWVudCcsICgpID0+IHtcblx0XHRjb25zdCBjb21tb25WYXJpYWJsZXMgPSB7XG5cdFx0XHRDT0xPUlRFUk06ICd0cnVlY29sb3InLFxuXHRcdFx0VEVSTV9QUk9HUkFNOiAndnNjb2RlJ1xuXHRcdH07XG5cdFx0dGVzdCgnc2hvdWxkIHJldGFpbiB2YXJpYWJsZXMgZXF1YWwgdG8gdGhlIGVtcHR5IHN0cmluZycsIGFzeW5jICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0YXdhaXQgY3JlYXRlVGVybWluYWxFbnZpcm9ubWVudCh7fSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgJ29mZicsIHsgZm9vOiAnYmFyJywgZW1wdHk6ICcnIH0pLFxuXHRcdFx0XHR7IGZvbzogJ2JhcicsIGVtcHR5OiAnJywgLi4uY29tbW9uVmFyaWFibGVzIH1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGlCQUFpQixtQkFBbUI7QUFFN0MsU0FBUyxXQUFXLHVCQUF1QjtBQUMzQyxTQUFTLE9BQU8sV0FBVztBQUMzQixTQUFTLDRCQUE0QiwyQkFBMkIsUUFBUSxvQkFBb0IsbUJBQW1CLHFCQUFxQixnQ0FBZ0M7QUFDcEssU0FBUyxrQkFBa0IsZ0JBQWdCLHdCQUF3QjtBQUNuRSxTQUFTLCtDQUErQztBQUV4RCxNQUFNLG1DQUFtQyxNQUFNO0FBQzlDLDBDQUF3QztBQUV4QyxRQUFNLDhCQUE4QixNQUFNO0FBQ3pDLFNBQUssaUNBQWlDLE1BQU07QUFDM0MsWUFBTSxNQUE4QixDQUFDO0FBQ3JDLGlDQUEyQixLQUFLLFNBQVMsTUFBTSxJQUFJO0FBQ25ELGtCQUFZLElBQUksY0FBYyxHQUFHLFFBQVE7QUFDekMsa0JBQVksSUFBSSxzQkFBc0IsR0FBRyxPQUFPO0FBQ2hELGtCQUFZLElBQUksV0FBVyxHQUFHLFdBQVc7QUFDekMsa0JBQVksSUFBSSxNQUFNLEdBQUcsYUFBYTtBQUFBLElBQ3ZDLENBQUM7QUFDRCxTQUFLLG1FQUFtRSxNQUFNO0FBQzdFLFlBQU0sTUFBOEIsQ0FBQztBQUNyQyxpQ0FBMkIsS0FBSyxTQUFTLFNBQVMsSUFBSTtBQUN0RCxrQkFBWSxJQUFJLE1BQU0sR0FBRyxlQUFlLGtEQUFrRDtBQUFBLElBQzNGLENBQUM7QUFDRCxTQUFLLHVEQUF1RCxNQUFNO0FBQ2pFLFlBQU0sT0FBK0IsRUFBRSxLQUFLLE1BQU07QUFDbEQsaUNBQTJCLE1BQU0sU0FBUyxRQUFXLElBQUk7QUFDekQsa0JBQVksS0FBSyxNQUFNLEdBQUcsZUFBZSwyQ0FBMkM7QUFBQSxJQUNyRixDQUFDO0FBQ0QsU0FBSywrREFBK0QsTUFBTTtBQUN6RSxZQUFNLE9BQU8s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LFNBQVMsS0FBSyxHQUFHLGNBQWM7QUFDbEssb0JBQVksTUFBTSxvQkFBb0Isb0JBQXFCLFFBQVEsUUFBUSxpQkFBaUIsWUFBWSxnQkFBZ0IsZ0JBQWdCLFNBQVMsS0FBSyxHQUFHLHVCQUF1QjtBQUNoTCxvQkFBWSxNQUFNLG9CQUFvQiwrQkFBK0IsUUFBUSxRQUFRLGlCQUFpQixZQUFZLGdCQUFnQixnQkFBZ0IsU0FBUyxLQUFLLEdBQUcsaUNBQWlDO0FBQUEsTUFDck0sQ0FBQztBQUNELFdBQUssWUFBWSxZQUFZO0FBQzVCLG9CQUFZLE1BQU0sb0JBQW9CLGdCQUFnQixRQUFRLFFBQVEsaUJBQWlCLFNBQVMsZ0JBQWdCLGdCQUFnQixTQUFTLEtBQUssR0FBRyxjQUFjO0FBQy9KLG9CQUFZLE1BQU0sb0JBQW9CLCtCQUErQixRQUFRLFFBQVEsaUJBQWlCLFNBQVMsZ0JBQWdCLGdCQUFnQixTQUFTLEtBQUssR0FBRyw0QkFBNEI7QUFBQSxNQUM3TCxDQUFDO0FBQ0QsV0FBSyxPQUFPLFlBQVk7QUFDdkIsb0JBQVksTUFBTSxvQkFBb0IsZ0JBQWdCLFFBQVEsUUFBUSxpQkFBaUIsS0FBSyxnQkFBZ0IsZ0JBQWdCLFNBQVMsS0FBSyxHQUFHLGdCQUFnQjtBQUFBLE1BQzlKLENBQUM7QUFBQSxJQUNGLENBQUM7QUFDRCxVQUFNLGlDQUFpQyxNQUFNO0FBQzVDLFdBQUssUUFBUSxZQUFZO0FBQ3hCLG9CQUFZLE1BQU0sb0JBQW9CLFlBQVksUUFBUSxRQUFRLGVBQWUsTUFBTSxnQkFBZ0IsZ0JBQWdCLE9BQU8sS0FBSyxHQUFHLFlBQVk7QUFDbEosb0JBQVksTUFBTSxvQkFBb0IsZ0JBQWlCLFFBQVEsUUFBUSxlQUFlLE1BQU0sZ0JBQWdCLGdCQUFnQixPQUFPLEtBQUssR0FBRyxlQUFlO0FBQzFKLG9CQUFZLE1BQU0sb0JBQW9CLDJCQUEyQixRQUFRLFFBQVEsZUFBZSxNQUFNLGdCQUFnQixnQkFBZ0IsT0FBTyxLQUFLLEdBQUcsMEJBQTBCO0FBQUEsTUFDaEwsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNELFFBQU0sNkJBQTZCLE1BQU07QUFDeEMsVUFBTSxrQkFBa0I7QUFBQSxNQUN2QixXQUFXO0FBQUEsTUFDWCxjQUFjO0FBQUEsSUFDZjtBQUNBLFNBQUsscURBQXFELFlBQVk7QUFDckU7QUFBQSxRQUNDLE1BQU0sMEJBQTBCLENBQUMsR0FBRyxRQUFXLFFBQVcsUUFBVyxPQUFPLEVBQUUsS0FBSyxPQUFPLE9BQU8sR0FBRyxDQUFDO0FBQUEsUUFDckcsRUFBRSxLQUFLLE9BQU8sT0FBTyxJQUFJLEdBQUcsZ0JBQWdCO0FBQUEsTUFDN0M7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJtYXRjaCIsICJncm91cHMiXQp9Cg==
