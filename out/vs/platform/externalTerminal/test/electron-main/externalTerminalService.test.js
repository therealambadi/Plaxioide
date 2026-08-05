import { deepStrictEqual, strictEqual } from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { DEFAULT_TERMINAL_OSX } from "../../common/externalTerminal.js";
import { LinuxExternalTerminalService, MacExternalTerminalService, WindowsExternalTerminalService } from "../../node/externalTerminalService.js";
const mockConfig = Object.freeze({
  terminal: {
    explorerKind: "external",
    external: {
      windowsExec: "testWindowsShell",
      osxExec: "testOSXShell",
      linuxExec: "testLinuxShell"
    }
  }
});
suite("ExternalTerminalService", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test(`WinTerminalService - uses terminal from configuration`, (done) => {
    const testShell = "cmd";
    const testCwd = "path/to/workspace";
    const mockSpawner = {
      spawn: (command, args, opts) => {
        strictEqual(command, testShell, "shell should equal expected");
        strictEqual(args[args.length - 1], mockConfig.terminal.external.windowsExec);
        strictEqual(opts.cwd, testCwd);
        done();
        return {
          on: (evt) => evt
        };
      }
    };
    const testService = new WindowsExternalTerminalService();
    testService.spawnTerminal(
      mockSpawner,
      mockConfig.terminal.external,
      testShell,
      testCwd
    );
  });
  test(`WinTerminalService - uses default terminal when configuration.terminal.external.windowsExec is undefined`, (done) => {
    const testShell = "cmd";
    const testCwd = "path/to/workspace";
    const mockSpawner = {
      spawn: (command, args, opts) => {
        strictEqual(args[args.length - 1], WindowsExternalTerminalService.getDefaultTerminalWindows());
        done();
        return {
          on: (evt) => evt
        };
      }
    };
    mockConfig.terminal.external.windowsExec = void 0;
    const testService = new WindowsExternalTerminalService();
    testService.spawnTerminal(
      mockSpawner,
      mockConfig.terminal.external,
      testShell,
      testCwd
    );
  });
  test(`WinTerminalService - cwd is correct regardless of case`, (done) => {
    const testShell = "cmd";
    const testCwd = "c:/foo";
    const mockSpawner = {
      spawn: (command, args, opts) => {
        strictEqual(opts.cwd, "C:/foo", "cwd should be uppercase regardless of the case that's passed in");
        done();
        return {
          on: (evt) => evt
        };
      }
    };
    const testService = new WindowsExternalTerminalService();
    testService.spawnTerminal(
      mockSpawner,
      mockConfig.terminal.external,
      testShell,
      testCwd
    );
  });
  test(`WinTerminalService - cmder should be spawned differently`, (done) => {
    const testShell = "cmd";
    const testCwd = "c:/foo";
    const mockSpawner = {
      spawn: (command, args, opts) => {
        deepStrictEqual(args, ["C:/foo"]);
        strictEqual(opts, void 0);
        done();
        return { on: (evt) => evt };
      }
    };
    const testService = new WindowsExternalTerminalService();
    testService.spawnTerminal(
      mockSpawner,
      { windowsExec: "cmder" },
      testShell,
      testCwd
    );
  });
  test(`WinTerminalService - windows terminal should open workspace directory`, (done) => {
    const testShell = "wt";
    const testCwd = "c:/foo";
    const mockSpawner = {
      spawn: (command, args, opts) => {
        strictEqual(opts.cwd, "C:/foo");
        done();
        return { on: (evt) => evt };
      }
    };
    const testService = new WindowsExternalTerminalService();
    testService.spawnTerminal(
      mockSpawner,
      mockConfig.terminal.external,
      testShell,
      testCwd
    );
  });
  test(`MacTerminalService - uses terminal from configuration`, (done) => {
    const testCwd = "path/to/workspace";
    const mockSpawner = {
      spawn: (command, args, opts) => {
        strictEqual(args[1], mockConfig.terminal.external.osxExec);
        done();
        return {
          on: (evt) => evt
        };
      }
    };
    const testService = new MacExternalTerminalService();
    testService.spawnTerminal(
      mockSpawner,
      mockConfig.terminal.external,
      testCwd
    );
  });
  test(`MacTerminalService - uses default terminal when configuration.terminal.external.osxExec is undefined`, (done) => {
    const testCwd = "path/to/workspace";
    const mockSpawner = {
      spawn: (command, args, opts) => {
        strictEqual(args[1], DEFAULT_TERMINAL_OSX);
        done();
        return {
          on: (evt) => evt
        };
      }
    };
    const testService = new MacExternalTerminalService();
    testService.spawnTerminal(
      mockSpawner,
      { osxExec: void 0 },
      testCwd
    );
  });
  test(`LinuxTerminalService - uses terminal from configuration`, (done) => {
    const testCwd = "path/to/workspace";
    const mockSpawner = {
      spawn: (command, args, opts) => {
        strictEqual(command, mockConfig.terminal.external.linuxExec);
        strictEqual(opts.cwd, testCwd);
        done();
        return {
          on: (evt) => evt
        };
      }
    };
    const testService = new LinuxExternalTerminalService();
    testService.spawnTerminal(
      mockSpawner,
      mockConfig.terminal.external,
      testCwd
    );
  });
  test(`LinuxTerminalService - uses default terminal when configuration.terminal.external.linuxExec is undefined`, (done) => {
    LinuxExternalTerminalService.getDefaultTerminalLinuxReady().then((defaultTerminalLinux) => {
      const testCwd = "path/to/workspace";
      const mockSpawner = {
        spawn: (command, args, opts) => {
          strictEqual(command, defaultTerminalLinux);
          done();
          return {
            on: (evt) => evt
          };
        }
      };
      mockConfig.terminal.external.linuxExec = void 0;
      const testService = new LinuxExternalTerminalService();
      testService.spawnTerminal(
        mockSpawner,
        mockConfig.terminal.external,
        testCwd
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlcm5hbFRlcm1pbmFsL3Rlc3QvZWxlY3Ryb24tbWFpbi9leHRlcm5hbFRlcm1pbmFsU2VydmljZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZGVlcFN0cmljdEVxdWFsLCBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IERFRkFVTFRfVEVSTUlOQUxfT1NYLCBJRXh0ZXJuYWxUZXJtaW5hbENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vZXh0ZXJuYWxUZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBMaW51eEV4dGVybmFsVGVybWluYWxTZXJ2aWNlLCBNYWNFeHRlcm5hbFRlcm1pbmFsU2VydmljZSwgV2luZG93c0V4dGVybmFsVGVybWluYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbm9kZS9leHRlcm5hbFRlcm1pbmFsU2VydmljZS5qcyc7XG5cbmNvbnN0IG1vY2tDb25maWcgPSBPYmplY3QuZnJlZXplPElFeHRlcm5hbFRlcm1pbmFsQ29uZmlndXJhdGlvbj4oe1xuXHR0ZXJtaW5hbDoge1xuXHRcdGV4cGxvcmVyS2luZDogJ2V4dGVybmFsJyxcblx0XHRleHRlcm5hbDoge1xuXHRcdFx0d2luZG93c0V4ZWM6ICd0ZXN0V2luZG93c1NoZWxsJyxcblx0XHRcdG9zeEV4ZWM6ICd0ZXN0T1NYU2hlbGwnLFxuXHRcdFx0bGludXhFeGVjOiAndGVzdExpbnV4U2hlbGwnXG5cdFx0fVxuXHR9XG59KTtcblxuc3VpdGUoJ0V4dGVybmFsVGVybWluYWxTZXJ2aWNlJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KGBXaW5UZXJtaW5hbFNlcnZpY2UgLSB1c2VzIHRlcm1pbmFsIGZyb20gY29uZmlndXJhdGlvbmAsIGRvbmUgPT4ge1xuXHRcdGNvbnN0IHRlc3RTaGVsbCA9ICdjbWQnO1xuXHRcdGNvbnN0IHRlc3RDd2QgPSAncGF0aC90by93b3Jrc3BhY2UnO1xuXHRcdGNvbnN0IG1vY2tTcGF3bmVyOiBhbnkgPSB7XG5cdFx0XHRzcGF3bjogKGNvbW1hbmQ6IGFueSwgYXJnczogYW55LCBvcHRzOiBhbnkpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoY29tbWFuZCwgdGVzdFNoZWxsLCAnc2hlbGwgc2hvdWxkIGVxdWFsIGV4cGVjdGVkJyk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGFyZ3NbYXJncy5sZW5ndGggLSAxXSwgbW9ja0NvbmZpZy50ZXJtaW5hbC5leHRlcm5hbC53aW5kb3dzRXhlYyk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKG9wdHMuY3dkLCB0ZXN0Q3dkKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG9uOiAoZXZ0OiBhbnkpID0+IGV2dFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgdGVzdFNlcnZpY2UgPSBuZXcgV2luZG93c0V4dGVybmFsVGVybWluYWxTZXJ2aWNlKCk7XG5cdFx0dGVzdFNlcnZpY2Uuc3Bhd25UZXJtaW5hbChcblx0XHRcdG1vY2tTcGF3bmVyLFxuXHRcdFx0bW9ja0NvbmZpZy50ZXJtaW5hbC5leHRlcm5hbCxcblx0XHRcdHRlc3RTaGVsbCxcblx0XHRcdHRlc3RDd2Rcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KGBXaW5UZXJtaW5hbFNlcnZpY2UgLSB1c2VzIGRlZmF1bHQgdGVybWluYWwgd2hlbiBjb25maWd1cmF0aW9uLnRlcm1pbmFsLmV4dGVybmFsLndpbmRvd3NFeGVjIGlzIHVuZGVmaW5lZGAsIGRvbmUgPT4ge1xuXHRcdGNvbnN0IHRlc3RTaGVsbCA9ICdjbWQnO1xuXHRcdGNvbnN0IHRlc3RDd2QgPSAncGF0aC90by93b3Jrc3BhY2UnO1xuXHRcdGNvbnN0IG1vY2tTcGF3bmVyOiBhbnkgPSB7XG5cdFx0XHRzcGF3bjogKGNvbW1hbmQ6IGFueSwgYXJnczogYW55LCBvcHRzOiBhbnkpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXJnc1thcmdzLmxlbmd0aCAtIDFdLCBXaW5kb3dzRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuZ2V0RGVmYXVsdFRlcm1pbmFsV2luZG93cygpKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG9uOiAoZXZ0OiBhbnkpID0+IGV2dFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0bW9ja0NvbmZpZy50ZXJtaW5hbC5leHRlcm5hbC53aW5kb3dzRXhlYyA9IHVuZGVmaW5lZDtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IG5ldyBXaW5kb3dzRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UoKTtcblx0XHR0ZXN0U2VydmljZS5zcGF3blRlcm1pbmFsKFxuXHRcdFx0bW9ja1NwYXduZXIsXG5cdFx0XHRtb2NrQ29uZmlnLnRlcm1pbmFsLmV4dGVybmFsLFxuXHRcdFx0dGVzdFNoZWxsLFxuXHRcdFx0dGVzdEN3ZFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoYFdpblRlcm1pbmFsU2VydmljZSAtIGN3ZCBpcyBjb3JyZWN0IHJlZ2FyZGxlc3Mgb2YgY2FzZWAsIGRvbmUgPT4ge1xuXHRcdGNvbnN0IHRlc3RTaGVsbCA9ICdjbWQnO1xuXHRcdGNvbnN0IHRlc3RDd2QgPSAnYzovZm9vJztcblx0XHRjb25zdCBtb2NrU3Bhd25lcjogYW55ID0ge1xuXHRcdFx0c3Bhd246IChjb21tYW5kOiBhbnksIGFyZ3M6IGFueSwgb3B0czogYW55KSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKG9wdHMuY3dkLCAnQzovZm9vJywgJ2N3ZCBzaG91bGQgYmUgdXBwZXJjYXNlIHJlZ2FyZGxlc3Mgb2YgdGhlIGNhc2UgdGhhdFxcJ3MgcGFzc2VkIGluJyk7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRvbjogKGV2dDogYW55KSA9PiBldnRcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbnN0IHRlc3RTZXJ2aWNlID0gbmV3IFdpbmRvd3NFeHRlcm5hbFRlcm1pbmFsU2VydmljZSgpO1xuXHRcdHRlc3RTZXJ2aWNlLnNwYXduVGVybWluYWwoXG5cdFx0XHRtb2NrU3Bhd25lcixcblx0XHRcdG1vY2tDb25maWcudGVybWluYWwuZXh0ZXJuYWwsXG5cdFx0XHR0ZXN0U2hlbGwsXG5cdFx0XHR0ZXN0Q3dkXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdChgV2luVGVybWluYWxTZXJ2aWNlIC0gY21kZXIgc2hvdWxkIGJlIHNwYXduZWQgZGlmZmVyZW50bHlgLCBkb25lID0+IHtcblx0XHRjb25zdCB0ZXN0U2hlbGwgPSAnY21kJztcblx0XHRjb25zdCB0ZXN0Q3dkID0gJ2M6L2Zvbyc7XG5cdFx0Y29uc3QgbW9ja1NwYXduZXI6IGFueSA9IHtcblx0XHRcdHNwYXduOiAoY29tbWFuZDogYW55LCBhcmdzOiBhbnksIG9wdHM6IGFueSkgPT4ge1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoYXJncywgWydDOi9mb28nXSk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKG9wdHMsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdFx0cmV0dXJuIHsgb246IChldnQ6IGFueSkgPT4gZXZ0IH07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IG5ldyBXaW5kb3dzRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UoKTtcblx0XHR0ZXN0U2VydmljZS5zcGF3blRlcm1pbmFsKFxuXHRcdFx0bW9ja1NwYXduZXIsXG5cdFx0XHR7IHdpbmRvd3NFeGVjOiAnY21kZXInIH0sXG5cdFx0XHR0ZXN0U2hlbGwsXG5cdFx0XHR0ZXN0Q3dkXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdChgV2luVGVybWluYWxTZXJ2aWNlIC0gd2luZG93cyB0ZXJtaW5hbCBzaG91bGQgb3BlbiB3b3Jrc3BhY2UgZGlyZWN0b3J5YCwgZG9uZSA9PiB7XG5cdFx0Y29uc3QgdGVzdFNoZWxsID0gJ3d0Jztcblx0XHRjb25zdCB0ZXN0Q3dkID0gJ2M6L2Zvbyc7XG5cdFx0Y29uc3QgbW9ja1NwYXduZXI6IGFueSA9IHtcblx0XHRcdHNwYXduOiAoY29tbWFuZDogYW55LCBhcmdzOiBhbnksIG9wdHM6IGFueSkgPT4ge1xuXHRcdFx0XHRzdHJpY3RFcXVhbChvcHRzLmN3ZCwgJ0M6L2ZvbycpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdHJldHVybiB7IG9uOiAoZXZ0OiBhbnkpID0+IGV2dCB9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgdGVzdFNlcnZpY2UgPSBuZXcgV2luZG93c0V4dGVybmFsVGVybWluYWxTZXJ2aWNlKCk7XG5cdFx0dGVzdFNlcnZpY2Uuc3Bhd25UZXJtaW5hbChcblx0XHRcdG1vY2tTcGF3bmVyLFxuXHRcdFx0bW9ja0NvbmZpZy50ZXJtaW5hbC5leHRlcm5hbCxcblx0XHRcdHRlc3RTaGVsbCxcblx0XHRcdHRlc3RDd2Rcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KGBNYWNUZXJtaW5hbFNlcnZpY2UgLSB1c2VzIHRlcm1pbmFsIGZyb20gY29uZmlndXJhdGlvbmAsIGRvbmUgPT4ge1xuXHRcdGNvbnN0IHRlc3RDd2QgPSAncGF0aC90by93b3Jrc3BhY2UnO1xuXHRcdGNvbnN0IG1vY2tTcGF3bmVyOiBhbnkgPSB7XG5cdFx0XHRzcGF3bjogKGNvbW1hbmQ6IGFueSwgYXJnczogYW55LCBvcHRzOiBhbnkpID0+IHtcblx0XHRcdFx0c3RyaWN0RXF1YWwoYXJnc1sxXSwgbW9ja0NvbmZpZy50ZXJtaW5hbC5leHRlcm5hbC5vc3hFeGVjKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG9uOiAoZXZ0OiBhbnkpID0+IGV2dFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgdGVzdFNlcnZpY2UgPSBuZXcgTWFjRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UoKTtcblx0XHR0ZXN0U2VydmljZS5zcGF3blRlcm1pbmFsKFxuXHRcdFx0bW9ja1NwYXduZXIsXG5cdFx0XHRtb2NrQ29uZmlnLnRlcm1pbmFsLmV4dGVybmFsLFxuXHRcdFx0dGVzdEN3ZFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoYE1hY1Rlcm1pbmFsU2VydmljZSAtIHVzZXMgZGVmYXVsdCB0ZXJtaW5hbCB3aGVuIGNvbmZpZ3VyYXRpb24udGVybWluYWwuZXh0ZXJuYWwub3N4RXhlYyBpcyB1bmRlZmluZWRgLCBkb25lID0+IHtcblx0XHRjb25zdCB0ZXN0Q3dkID0gJ3BhdGgvdG8vd29ya3NwYWNlJztcblx0XHRjb25zdCBtb2NrU3Bhd25lcjogYW55ID0ge1xuXHRcdFx0c3Bhd246IChjb21tYW5kOiBhbnksIGFyZ3M6IGFueSwgb3B0czogYW55KSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGFyZ3NbMV0sIERFRkFVTFRfVEVSTUlOQUxfT1NYKTtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG9uOiAoZXZ0OiBhbnkpID0+IGV2dFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgdGVzdFNlcnZpY2UgPSBuZXcgTWFjRXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UoKTtcblx0XHR0ZXN0U2VydmljZS5zcGF3blRlcm1pbmFsKFxuXHRcdFx0bW9ja1NwYXduZXIsXG5cdFx0XHR7IG9zeEV4ZWM6IHVuZGVmaW5lZCB9LFxuXHRcdFx0dGVzdEN3ZFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoYExpbnV4VGVybWluYWxTZXJ2aWNlIC0gdXNlcyB0ZXJtaW5hbCBmcm9tIGNvbmZpZ3VyYXRpb25gLCBkb25lID0+IHtcblx0XHRjb25zdCB0ZXN0Q3dkID0gJ3BhdGgvdG8vd29ya3NwYWNlJztcblx0XHRjb25zdCBtb2NrU3Bhd25lcjogYW55ID0ge1xuXHRcdFx0c3Bhd246IChjb21tYW5kOiBhbnksIGFyZ3M6IGFueSwgb3B0czogYW55KSA9PiB7XG5cdFx0XHRcdHN0cmljdEVxdWFsKGNvbW1hbmQsIG1vY2tDb25maWcudGVybWluYWwuZXh0ZXJuYWwubGludXhFeGVjKTtcblx0XHRcdFx0c3RyaWN0RXF1YWwob3B0cy5jd2QsIHRlc3RDd2QpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0b246IChldnQ6IGFueSkgPT4gZXZ0XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjb25zdCB0ZXN0U2VydmljZSA9IG5ldyBMaW51eEV4dGVybmFsVGVybWluYWxTZXJ2aWNlKCk7XG5cdFx0dGVzdFNlcnZpY2Uuc3Bhd25UZXJtaW5hbChcblx0XHRcdG1vY2tTcGF3bmVyLFxuXHRcdFx0bW9ja0NvbmZpZy50ZXJtaW5hbC5leHRlcm5hbCxcblx0XHRcdHRlc3RDd2Rcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KGBMaW51eFRlcm1pbmFsU2VydmljZSAtIHVzZXMgZGVmYXVsdCB0ZXJtaW5hbCB3aGVuIGNvbmZpZ3VyYXRpb24udGVybWluYWwuZXh0ZXJuYWwubGludXhFeGVjIGlzIHVuZGVmaW5lZGAsIGRvbmUgPT4ge1xuXHRcdExpbnV4RXh0ZXJuYWxUZXJtaW5hbFNlcnZpY2UuZ2V0RGVmYXVsdFRlcm1pbmFsTGludXhSZWFkeSgpLnRoZW4oZGVmYXVsdFRlcm1pbmFsTGludXggPT4ge1xuXHRcdFx0Y29uc3QgdGVzdEN3ZCA9ICdwYXRoL3RvL3dvcmtzcGFjZSc7XG5cdFx0XHRjb25zdCBtb2NrU3Bhd25lcjogYW55ID0ge1xuXHRcdFx0XHRzcGF3bjogKGNvbW1hbmQ6IGFueSwgYXJnczogYW55LCBvcHRzOiBhbnkpID0+IHtcblx0XHRcdFx0XHRzdHJpY3RFcXVhbChjb21tYW5kLCBkZWZhdWx0VGVybWluYWxMaW51eCk7XG5cdFx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRvbjogKGV2dDogYW55KSA9PiBldnRcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0bW9ja0NvbmZpZy50ZXJtaW5hbC5leHRlcm5hbC5saW51eEV4ZWMgPSB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCB0ZXN0U2VydmljZSA9IG5ldyBMaW51eEV4dGVybmFsVGVybWluYWxTZXJ2aWNlKCk7XG5cdFx0XHR0ZXN0U2VydmljZS5zcGF3blRlcm1pbmFsKFxuXHRcdFx0XHRtb2NrU3Bhd25lcixcblx0XHRcdFx0bW9ja0NvbmZpZy50ZXJtaW5hbC5leHRlcm5hbCxcblx0XHRcdFx0dGVzdEN3ZFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsaUJBQWlCLG1CQUFtQjtBQUM3QyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLDRCQUE0RDtBQUNyRSxTQUFTLDhCQUE4Qiw0QkFBNEIsc0NBQXNDO0FBRXpHLE1BQU0sYUFBYSxPQUFPLE9BQXVD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
