import assert from "assert";
import { isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { flakySuite } from "../../../../base/test/common/testUtils.js";
function testErrorMessage(module) {
  return `Unable to load "${module}" dependency. It was probably not compiled for the right operating system architecture or had missing build tools.`;
}
flakySuite("Native Modules (all platforms)", () => {
  (isMacintosh ? test.skip : test)("kerberos", async () => {
    const { default: kerberos } = await import("kerberos");
    assert.ok(typeof kerberos.initializeClient === "function", testErrorMessage("kerberos"));
  });
  test("yauzl", async () => {
    const { default: yauzl } = await import("yauzl");
    assert.ok(typeof yauzl.ZipFile === "function", testErrorMessage("yauzl"));
  });
  test("yazl", async () => {
    const { default: yazl } = await import("yazl");
    assert.ok(typeof yazl.ZipFile === "function", testErrorMessage("yazl"));
  });
  test("v8-inspect-profiler", async () => {
    const { default: profiler } = await import("v8-inspect-profiler");
    assert.ok(typeof profiler.startProfiling === "function", testErrorMessage("v8-inspect-profiler"));
  });
  test("native-is-elevated", async () => {
    const { default: isElevated } = await import("native-is-elevated");
    assert.ok(typeof isElevated === "function", testErrorMessage("native-is-elevated "));
    const result = isElevated();
    assert.ok(typeof result === "boolean", testErrorMessage("native-is-elevated"));
  });
  test("native-keymap", async () => {
    const keyMap = await import("native-keymap");
    assert.ok(typeof keyMap.onDidChangeKeyboardLayout === "function", testErrorMessage("native-keymap"));
    assert.ok(typeof keyMap.getCurrentKeyboardLayout === "function", testErrorMessage("native-keymap"));
    const result = keyMap.getCurrentKeyboardLayout();
    assert.ok(result, testErrorMessage("native-keymap"));
  });
  test("native-watchdog", async () => {
    const watchDog = await import("native-watchdog");
    assert.ok(typeof watchDog.start === "function", testErrorMessage("native-watchdog"));
  });
  test("@vscode/sudo-prompt", async () => {
    const prompt = await import("@vscode/sudo-prompt");
    assert.ok(typeof prompt.exec === "function", testErrorMessage("@vscode/sudo-prompt"));
  });
  test("@vscode/policy-watcher", async () => {
    const watcher = await import("@vscode/policy-watcher");
    assert.ok(typeof watcher.createWatcher === "function", testErrorMessage("@vscode/policy-watcher"));
  });
  test("node-pty", async () => {
    const nodePty = await import("node-pty");
    assert.ok(typeof nodePty.spawn === "function", testErrorMessage("node-pty"));
  });
  test("open", async () => {
    const { default: open } = await import("open");
    assert.ok(typeof open === "function", testErrorMessage("open"));
  });
  test("@vscode/spdlog", async () => {
    const spdlog = await import("@vscode/spdlog");
    assert.ok(typeof spdlog.createRotatingLogger === "function", testErrorMessage("@vscode/spdlog"));
    assert.ok(typeof spdlog.version === "number", testErrorMessage("@vscode/spdlog"));
  });
  test("@parcel/watcher", async () => {
    const parcelWatcher = await import("@parcel/watcher");
    assert.ok(typeof parcelWatcher.subscribe === "function", testErrorMessage("@parcel/watcher"));
  });
  test("@vscode/deviceid", async () => {
    const deviceIdPackage = await import("@vscode/deviceid");
    assert.ok(typeof deviceIdPackage.getDeviceId === "function", testErrorMessage("@vscode/deviceid"));
  });
  test("@vscode/ripgrep", async () => {
    const ripgrep = await import("@vscode/ripgrep");
    assert.ok(typeof ripgrep.rgPath === "string", testErrorMessage("@vscode/ripgrep"));
  });
  test("vscode-regexpp", async () => {
    const regexpp = await import("vscode-regexpp");
    assert.ok(typeof regexpp.RegExpParser === "function", testErrorMessage("vscode-regexpp"));
  });
  test("@vscode/sqlite3", async () => {
    const { default: sqlite3 } = await import("@vscode/sqlite3");
    assert.ok(typeof sqlite3.Database === "function", testErrorMessage("@vscode/sqlite3"));
  });
  test("http-proxy-agent", async () => {
    const { default: mod } = await import("http-proxy-agent");
    assert.ok(typeof mod.HttpProxyAgent === "function", testErrorMessage("http-proxy-agent"));
  });
  test("https-proxy-agent", async () => {
    const { default: mod } = await import("https-proxy-agent");
    assert.ok(typeof mod.HttpsProxyAgent === "function", testErrorMessage("https-proxy-agent"));
  });
  test("@vscode/proxy-agent", async () => {
    const proxyAgent = await import("@vscode/proxy-agent");
    const windowsCerts = await proxyAgent.loadSystemCertificates({
      log: {
        trace: () => {
        },
        debug: () => {
        },
        info: () => {
        },
        warn: () => {
        },
        error: () => {
        }
      }
    });
    assert.ok(windowsCerts.length > 0, testErrorMessage("@vscode/proxy-agent"));
  });
});
(!isWindows ? suite.skip : suite)("Native Modules (Windows)", () => {
  test("@vscode/windows-mutex", async () => {
    const mutex = await import("@vscode/windows-mutex");
    assert.ok(mutex && typeof mutex.isActive === "function", testErrorMessage("@vscode/windows-mutex"));
    assert.ok(typeof mutex.isActive === "function", testErrorMessage("@vscode/windows-mutex"));
    assert.ok(typeof mutex.Mutex === "function", testErrorMessage("@vscode/windows-mutex"));
  });
  test("windows-foreground-love", async () => {
    const foregroundLove = await import("windows-foreground-love");
    assert.ok(typeof foregroundLove.allowSetForegroundWindow === "function", testErrorMessage("windows-foreground-love"));
    const result = foregroundLove.allowSetForegroundWindow(process.pid);
    assert.ok(typeof result === "boolean", testErrorMessage("windows-foreground-love"));
  });
  test("@vscode/windows-process-tree", async () => {
    const processTree = await import("@vscode/windows-process-tree");
    assert.ok(typeof processTree.getProcessTree === "function", testErrorMessage("@vscode/windows-process-tree"));
    return new Promise((resolve, reject) => {
      processTree.getProcessTree(process.pid, (tree) => {
        if (tree) {
          resolve();
        } else {
          reject(new Error(testErrorMessage("@vscode/windows-process-tree")));
        }
      });
    });
  });
  test("@vscode/windows-registry", async () => {
    const windowsRegistry = await import("@vscode/windows-registry");
    assert.ok(typeof windowsRegistry.GetStringRegKey === "function", testErrorMessage("@vscode/windows-registry"));
    const result = windowsRegistry.GetStringRegKey("HKEY_LOCAL_MACHINE", "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", "EditionID");
    assert.ok(typeof result === "string" || typeof result === "undefined", testErrorMessage("@vscode/windows-registry"));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9lbnZpcm9ubWVudC90ZXN0L25vZGUvbmF0aXZlTW9kdWxlcy5pbnRlZ3JhdGlvblRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZmxha3lTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGVzdFV0aWxzLmpzJztcblxuZnVuY3Rpb24gdGVzdEVycm9yTWVzc2FnZShtb2R1bGU6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBgVW5hYmxlIHRvIGxvYWQgXCIke21vZHVsZX1cIiBkZXBlbmRlbmN5LiBJdCB3YXMgcHJvYmFibHkgbm90IGNvbXBpbGVkIGZvciB0aGUgcmlnaHQgb3BlcmF0aW5nIHN5c3RlbSBhcmNoaXRlY3R1cmUgb3IgaGFkIG1pc3NpbmcgYnVpbGQgdG9vbHMuYDtcbn1cblxuZmxha3lTdWl0ZSgnTmF0aXZlIE1vZHVsZXMgKGFsbCBwbGF0Zm9ybXMpJywgKCkgPT4ge1xuXG5cdChpc01hY2ludG9zaCA/IHRlc3Quc2tpcCA6IHRlc3QpKCdrZXJiZXJvcycsIGFzeW5jICgpID0+IHsgLy8gU29tZWhvdyBmYWlscyBvbiBtYWNPUyBBUk0/XG5cdFx0Y29uc3QgeyBkZWZhdWx0OiBrZXJiZXJvcyB9ID0gYXdhaXQgaW1wb3J0KCdrZXJiZXJvcycpO1xuXHRcdGFzc2VydC5vayh0eXBlb2Yga2VyYmVyb3MuaW5pdGlhbGl6ZUNsaWVudCA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgna2VyYmVyb3MnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3lhdXpsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgZGVmYXVsdDogeWF1emwgfSA9IGF3YWl0IGltcG9ydCgneWF1emwnKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIHlhdXpsLlppcEZpbGUgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ3lhdXpsJykpO1xuXHR9KTtcblxuXHR0ZXN0KCd5YXpsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgZGVmYXVsdDogeWF6bCB9ID0gYXdhaXQgaW1wb3J0KCd5YXpsJyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiB5YXpsLlppcEZpbGUgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ3lhemwnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Y4LWluc3BlY3QtcHJvZmlsZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBkZWZhdWx0OiBwcm9maWxlciB9ID0gYXdhaXQgaW1wb3J0KCd2OC1pbnNwZWN0LXByb2ZpbGVyJyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBwcm9maWxlci5zdGFydFByb2ZpbGluZyA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgndjgtaW5zcGVjdC1wcm9maWxlcicpKTtcblx0fSk7XG5cblx0dGVzdCgnbmF0aXZlLWlzLWVsZXZhdGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgZGVmYXVsdDogaXNFbGV2YXRlZCB9ID0gYXdhaXQgaW1wb3J0KCduYXRpdmUtaXMtZWxldmF0ZWQnKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIGlzRWxldmF0ZWQgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ25hdGl2ZS1pcy1lbGV2YXRlZCAnKSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBpc0VsZXZhdGVkKCk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJywgdGVzdEVycm9yTWVzc2FnZSgnbmF0aXZlLWlzLWVsZXZhdGVkJykpO1xuXHR9KTtcblxuXHR0ZXN0KCduYXRpdmUta2V5bWFwJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGtleU1hcCA9IGF3YWl0IGltcG9ydCgnbmF0aXZlLWtleW1hcCcpO1xuXHRcdGFzc2VydC5vayh0eXBlb2Yga2V5TWFwLm9uRGlkQ2hhbmdlS2V5Ym9hcmRMYXlvdXQgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ25hdGl2ZS1rZXltYXAnKSk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBrZXlNYXAuZ2V0Q3VycmVudEtleWJvYXJkTGF5b3V0ID09PSAnZnVuY3Rpb24nLCB0ZXN0RXJyb3JNZXNzYWdlKCduYXRpdmUta2V5bWFwJykpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0ga2V5TWFwLmdldEN1cnJlbnRLZXlib2FyZExheW91dCgpO1xuXHRcdGFzc2VydC5vayhyZXN1bHQsIHRlc3RFcnJvck1lc3NhZ2UoJ25hdGl2ZS1rZXltYXAnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ25hdGl2ZS13YXRjaGRvZycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB3YXRjaERvZyA9IGF3YWl0IGltcG9ydCgnbmF0aXZlLXdhdGNoZG9nJyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiB3YXRjaERvZy5zdGFydCA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgnbmF0aXZlLXdhdGNoZG9nJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdAdnNjb2RlL3N1ZG8tcHJvbXB0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHByb21wdCA9IGF3YWl0IGltcG9ydCgnQHZzY29kZS9zdWRvLXByb21wdCcpO1xuXHRcdGFzc2VydC5vayh0eXBlb2YgcHJvbXB0LmV4ZWMgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ0B2c2NvZGUvc3Vkby1wcm9tcHQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0B2c2NvZGUvcG9saWN5LXdhdGNoZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd2F0Y2hlciA9IGF3YWl0IGltcG9ydCgnQHZzY29kZS9wb2xpY3ktd2F0Y2hlcicpO1xuXHRcdGFzc2VydC5vayh0eXBlb2Ygd2F0Y2hlci5jcmVhdGVXYXRjaGVyID09PSAnZnVuY3Rpb24nLCB0ZXN0RXJyb3JNZXNzYWdlKCdAdnNjb2RlL3BvbGljeS13YXRjaGVyJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdub2RlLXB0eScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBub2RlUHR5ID0gYXdhaXQgaW1wb3J0KCdub2RlLXB0eScpO1xuXHRcdGFzc2VydC5vayh0eXBlb2Ygbm9kZVB0eS5zcGF3biA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgnbm9kZS1wdHknKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW4nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBkZWZhdWx0OiBvcGVuIH0gPSBhd2FpdCBpbXBvcnQoJ29wZW4nKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIG9wZW4gPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ29wZW4nKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0B2c2NvZGUvc3BkbG9nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNwZGxvZyA9IGF3YWl0IGltcG9ydCgnQHZzY29kZS9zcGRsb2cnKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIHNwZGxvZy5jcmVhdGVSb3RhdGluZ0xvZ2dlciA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgnQHZzY29kZS9zcGRsb2cnKSk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBzcGRsb2cudmVyc2lvbiA9PT0gJ251bWJlcicsIHRlc3RFcnJvck1lc3NhZ2UoJ0B2c2NvZGUvc3BkbG9nJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdAcGFyY2VsL3dhdGNoZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFyY2VsV2F0Y2hlciA9IGF3YWl0IGltcG9ydCgnQHBhcmNlbC93YXRjaGVyJyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBwYXJjZWxXYXRjaGVyLnN1YnNjcmliZSA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgnQHBhcmNlbC93YXRjaGVyJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdAdnNjb2RlL2RldmljZWlkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGRldmljZUlkUGFja2FnZSA9IGF3YWl0IGltcG9ydCgnQHZzY29kZS9kZXZpY2VpZCcpO1xuXHRcdGFzc2VydC5vayh0eXBlb2YgZGV2aWNlSWRQYWNrYWdlLmdldERldmljZUlkID09PSAnZnVuY3Rpb24nLCB0ZXN0RXJyb3JNZXNzYWdlKCdAdnNjb2RlL2RldmljZWlkJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdAdnNjb2RlL3JpcGdyZXAnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmlwZ3JlcCA9IGF3YWl0IGltcG9ydCgnQHZzY29kZS9yaXBncmVwJyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiByaXBncmVwLnJnUGF0aCA9PT0gJ3N0cmluZycsIHRlc3RFcnJvck1lc3NhZ2UoJ0B2c2NvZGUvcmlwZ3JlcCcpKTtcblx0fSk7XG5cblx0dGVzdCgndnNjb2RlLXJlZ2V4cHAnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVnZXhwcCA9IGF3YWl0IGltcG9ydCgndnNjb2RlLXJlZ2V4cHAnKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIHJlZ2V4cHAuUmVnRXhwUGFyc2VyID09PSAnZnVuY3Rpb24nLCB0ZXN0RXJyb3JNZXNzYWdlKCd2c2NvZGUtcmVnZXhwcCcpKTtcblx0fSk7XG5cblx0dGVzdCgnQHZzY29kZS9zcWxpdGUzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgZGVmYXVsdDogc3FsaXRlMyB9ID0gYXdhaXQgaW1wb3J0KCdAdnNjb2RlL3NxbGl0ZTMnKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIHNxbGl0ZTMuRGF0YWJhc2UgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ0B2c2NvZGUvc3FsaXRlMycpKTtcblx0fSk7XG5cblx0dGVzdCgnaHR0cC1wcm94eS1hZ2VudCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IGRlZmF1bHQ6IG1vZCB9ID0gYXdhaXQgaW1wb3J0KCdodHRwLXByb3h5LWFnZW50Jyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBtb2QuSHR0cFByb3h5QWdlbnQgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ2h0dHAtcHJveHktYWdlbnQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2h0dHBzLXByb3h5LWFnZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgZGVmYXVsdDogbW9kIH0gPSBhd2FpdCBpbXBvcnQoJ2h0dHBzLXByb3h5LWFnZW50Jyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBtb2QuSHR0cHNQcm94eUFnZW50ID09PSAnZnVuY3Rpb24nLCB0ZXN0RXJyb3JNZXNzYWdlKCdodHRwcy1wcm94eS1hZ2VudCcpKTtcblx0fSk7XG5cblx0dGVzdCgnQHZzY29kZS9wcm94eS1hZ2VudCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwcm94eUFnZW50ID0gYXdhaXQgaW1wb3J0KCdAdnNjb2RlL3Byb3h5LWFnZW50Jyk7XG5cdFx0Ly8gVGhpcyBjYWxsIHdpbGwgbG9hZCBgQHZzY29kZS9wcm94eS1hZ2VudGAgd2hpY2ggaXMgYSBuYXRpdmUgbW9kdWxlIHRoYXQgd2Ugd2FudCB0byB0ZXN0IG9uIFdpbmRvd3Ncblx0XHRjb25zdCB3aW5kb3dzQ2VydHMgPSBhd2FpdCBwcm94eUFnZW50LmxvYWRTeXN0ZW1DZXJ0aWZpY2F0ZXMoe1xuXHRcdFx0bG9nOiB7XG5cdFx0XHRcdHRyYWNlOiAoKSA9PiB7IH0sXG5cdFx0XHRcdGRlYnVnOiAoKSA9PiB7IH0sXG5cdFx0XHRcdGluZm86ICgpID0+IHsgfSxcblx0XHRcdFx0d2FybjogKCkgPT4geyB9LFxuXHRcdFx0XHRlcnJvcjogKCkgPT4geyB9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0YXNzZXJ0Lm9rKHdpbmRvd3NDZXJ0cy5sZW5ndGggPiAwLCB0ZXN0RXJyb3JNZXNzYWdlKCdAdnNjb2RlL3Byb3h5LWFnZW50JykpO1xuXHR9KTtcbn0pO1xuXG4oIWlzV2luZG93cyA/IHN1aXRlLnNraXAgOiBzdWl0ZSkoJ05hdGl2ZSBNb2R1bGVzIChXaW5kb3dzKScsICgpID0+IHtcblxuXHR0ZXN0KCdAdnNjb2RlL3dpbmRvd3MtbXV0ZXgnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbXV0ZXggPSBhd2FpdCBpbXBvcnQoJ0B2c2NvZGUvd2luZG93cy1tdXRleCcpO1xuXHRcdGFzc2VydC5vayhtdXRleCAmJiB0eXBlb2YgbXV0ZXguaXNBY3RpdmUgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ0B2c2NvZGUvd2luZG93cy1tdXRleCcpKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIG11dGV4LmlzQWN0aXZlID09PSAnZnVuY3Rpb24nLCB0ZXN0RXJyb3JNZXNzYWdlKCdAdnNjb2RlL3dpbmRvd3MtbXV0ZXgnKSk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBtdXRleC5NdXRleCA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgnQHZzY29kZS93aW5kb3dzLW11dGV4JykpO1xuXHR9KTtcblxuXHR0ZXN0KCd3aW5kb3dzLWZvcmVncm91bmQtbG92ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmb3JlZ3JvdW5kTG92ZSA9IGF3YWl0IGltcG9ydCgnd2luZG93cy1mb3JlZ3JvdW5kLWxvdmUnKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIGZvcmVncm91bmRMb3ZlLmFsbG93U2V0Rm9yZWdyb3VuZFdpbmRvdyA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgnd2luZG93cy1mb3JlZ3JvdW5kLWxvdmUnKSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBmb3JlZ3JvdW5kTG92ZS5hbGxvd1NldEZvcmVncm91bmRXaW5kb3cocHJvY2Vzcy5waWQpO1xuXHRcdGFzc2VydC5vayh0eXBlb2YgcmVzdWx0ID09PSAnYm9vbGVhbicsIHRlc3RFcnJvck1lc3NhZ2UoJ3dpbmRvd3MtZm9yZWdyb3VuZC1sb3ZlJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdAdnNjb2RlL3dpbmRvd3MtcHJvY2Vzcy10cmVlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHByb2Nlc3NUcmVlID0gYXdhaXQgaW1wb3J0KCdAdnNjb2RlL3dpbmRvd3MtcHJvY2Vzcy10cmVlJyk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVvZiBwcm9jZXNzVHJlZS5nZXRQcm9jZXNzVHJlZSA9PT0gJ2Z1bmN0aW9uJywgdGVzdEVycm9yTWVzc2FnZSgnQHZzY29kZS93aW5kb3dzLXByb2Nlc3MtdHJlZScpKTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRwcm9jZXNzVHJlZS5nZXRQcm9jZXNzVHJlZShwcm9jZXNzLnBpZCwgdHJlZSA9PiB7XG5cdFx0XHRcdGlmICh0cmVlKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IodGVzdEVycm9yTWVzc2FnZSgnQHZzY29kZS93aW5kb3dzLXByb2Nlc3MtdHJlZScpKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdAdnNjb2RlL3dpbmRvd3MtcmVnaXN0cnknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd2luZG93c1JlZ2lzdHJ5ID0gYXdhaXQgaW1wb3J0KCdAdnNjb2RlL3dpbmRvd3MtcmVnaXN0cnknKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIHdpbmRvd3NSZWdpc3RyeS5HZXRTdHJpbmdSZWdLZXkgPT09ICdmdW5jdGlvbicsIHRlc3RFcnJvck1lc3NhZ2UoJ0B2c2NvZGUvd2luZG93cy1yZWdpc3RyeScpKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IHdpbmRvd3NSZWdpc3RyeS5HZXRTdHJpbmdSZWdLZXkoJ0hLRVlfTE9DQUxfTUFDSElORScsICdTT0ZUV0FSRVxcXFxNaWNyb3NvZnRcXFxcV2luZG93cyBOVFxcXFxDdXJyZW50VmVyc2lvbicsICdFZGl0aW9uSUQnKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHJlc3VsdCA9PT0gJ3VuZGVmaW5lZCcsIHRlc3RFcnJvck1lc3NhZ2UoJ0B2c2NvZGUvd2luZG93cy1yZWdpc3RyeScpKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGFBQWEsaUJBQWlCO0FBQ3ZDLFNBQVMsa0JBQWtCO0FBRTNCLFNBQVMsaUJBQWlCLFFBQXdCO0FBQ2pELFNBQU8sbUJBQW1CLE1BQU07QUFDakM7QUFFQSxXQUFXLGtDQUFrQyxNQUFNO0FBRWxELEdBQUMsY0FBYyxLQUFLLE9BQU8sTUFBTSxZQUFZLFlBQVk7QUFDeEQsVUFBTSxFQUFFLFNBQVMsU0FBUyxJQUFJLE1BQU0sT0FBTyxVQUFVO0FBQ3JELFdBQU8sR0FBRyxPQUFPLFNBQVMscUJBQXFCLFlBQVksaUJBQWlCLFVBQVUsQ0FBQztBQUFBLEVBQ3hGLENBQUM7QUFFRCxPQUFLLFNBQVMsWUFBWTtBQUN6QixV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
