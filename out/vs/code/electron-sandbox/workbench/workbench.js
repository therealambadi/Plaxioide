(async function() {
  performance.mark("code/didStartRenderer");
  const bootstrapWindow = window.MonacoBootstrapWindow;
  const preloadGlobals = window.vscode;
  function showSplash(configuration2) {
    performance.mark("code/willShowPartsSplash");
    let data = configuration2.partsSplash;
    if (data) {
      if (configuration2.autoDetectHighContrast && configuration2.colorScheme.highContrast) {
        if (configuration2.colorScheme.dark && data.baseTheme !== "hc-black" || !configuration2.colorScheme.dark && data.baseTheme !== "hc-light") {
          data = void 0;
        }
      } else if (configuration2.autoDetectColorScheme) {
        if (configuration2.colorScheme.dark && data.baseTheme !== "vs-dark" || !configuration2.colorScheme.dark && data.baseTheme !== "vs") {
          data = void 0;
        }
      }
    }
    if (data && configuration2.extensionDevelopmentPath) {
      data.layoutInfo = void 0;
    }
    let baseTheme;
    let shellBackground;
    let shellForeground;
    if (data) {
      baseTheme = data.baseTheme;
      shellBackground = data.colorInfo.editorBackground;
      shellForeground = data.colorInfo.foreground;
    } else if (configuration2.autoDetectHighContrast && configuration2.colorScheme.highContrast) {
      if (configuration2.colorScheme.dark) {
        baseTheme = "hc-black";
        shellBackground = "#000000";
        shellForeground = "#FFFFFF";
      } else {
        baseTheme = "hc-light";
        shellBackground = "#FFFFFF";
        shellForeground = "#000000";
      }
    } else if (configuration2.autoDetectColorScheme) {
      if (configuration2.colorScheme.dark) {
        baseTheme = "vs-dark";
        shellBackground = "#1E1E1E";
        shellForeground = "#CCCCCC";
      } else {
        baseTheme = "vs";
        shellBackground = "#FFFFFF";
        shellForeground = "#000000";
      }
    }
    const style = document.createElement("style");
    style.className = "initialShellColors";
    window.document.head.appendChild(style);
    style.textContent = `body {	background-color: ${shellBackground}; color: ${shellForeground}; margin: 0; padding: 0; }`;
    if (typeof data?.zoomLevel === "number" && typeof preloadGlobals?.webFrame?.setZoomLevel === "function") {
      preloadGlobals.webFrame.setZoomLevel(data.zoomLevel);
    }
    if (data?.layoutInfo) {
      const { layoutInfo, colorInfo } = data;
      const splash = document.createElement("div");
      splash.id = "monaco-parts-splash";
      splash.className = baseTheme ?? "vs-dark";
      if (layoutInfo.windowBorder && colorInfo.windowBorder) {
        const borderElement = document.createElement("div");
        borderElement.style.position = "absolute";
        borderElement.style.width = "calc(100vw - 2px)";
        borderElement.style.height = "calc(100vh - 2px)";
        borderElement.style.zIndex = "1";
        borderElement.style.border = `1px solid var(--window-border-color)`;
        borderElement.style.setProperty("--window-border-color", colorInfo.windowBorder);
        if (layoutInfo.windowBorderRadius) {
          borderElement.style.borderRadius = layoutInfo.windowBorderRadius;
        }
        splash.appendChild(borderElement);
      }
      layoutInfo.auxiliarySideBarWidth = Math.min(layoutInfo.auxiliarySideBarWidth, window.innerWidth - (layoutInfo.activityBarWidth + layoutInfo.editorPartMinWidth + layoutInfo.sideBarWidth));
      layoutInfo.sideBarWidth = Math.min(layoutInfo.sideBarWidth, window.innerWidth - (layoutInfo.activityBarWidth + layoutInfo.editorPartMinWidth + layoutInfo.auxiliarySideBarWidth));
      if (layoutInfo.titleBarHeight > 0) {
        const titleDiv = document.createElement("div");
        titleDiv.style.position = "absolute";
        titleDiv.style.width = "100%";
        titleDiv.style.height = `${layoutInfo.titleBarHeight}px`;
        titleDiv.style.left = "0";
        titleDiv.style.top = "0";
        titleDiv.style.backgroundColor = `${colorInfo.titleBarBackground}`;
        titleDiv.style["-webkit-app-region"] = "drag";
        splash.appendChild(titleDiv);
        if (colorInfo.titleBarBorder) {
          const titleBorder = document.createElement("div");
          titleBorder.style.position = "absolute";
          titleBorder.style.width = "100%";
          titleBorder.style.height = "1px";
          titleBorder.style.left = "0";
          titleBorder.style.bottom = "0";
          titleBorder.style.borderBottom = `1px solid ${colorInfo.titleBarBorder}`;
          titleDiv.appendChild(titleBorder);
        }
      }
      if (layoutInfo.activityBarWidth > 0) {
        const activityDiv = document.createElement("div");
        activityDiv.style.position = "absolute";
        activityDiv.style.width = `${layoutInfo.activityBarWidth}px`;
        activityDiv.style.height = `calc(100% - ${layoutInfo.titleBarHeight + layoutInfo.statusBarHeight}px)`;
        activityDiv.style.top = `${layoutInfo.titleBarHeight}px`;
        if (layoutInfo.sideBarSide === "left") {
          activityDiv.style.left = "0";
        } else {
          activityDiv.style.right = "0";
        }
        activityDiv.style.backgroundColor = `${colorInfo.activityBarBackground}`;
        splash.appendChild(activityDiv);
        if (colorInfo.activityBarBorder) {
          const activityBorderDiv = document.createElement("div");
          activityBorderDiv.style.position = "absolute";
          activityBorderDiv.style.width = "1px";
          activityBorderDiv.style.height = "100%";
          activityBorderDiv.style.top = "0";
          if (layoutInfo.sideBarSide === "left") {
            activityBorderDiv.style.right = "0";
            activityBorderDiv.style.borderRight = `1px solid ${colorInfo.activityBarBorder}`;
          } else {
            activityBorderDiv.style.left = "0";
            activityBorderDiv.style.borderLeft = `1px solid ${colorInfo.activityBarBorder}`;
          }
          activityDiv.appendChild(activityBorderDiv);
        }
      }
      if (configuration2.workspace && layoutInfo.sideBarWidth > 0) {
        const sideDiv = document.createElement("div");
        sideDiv.style.position = "absolute";
        sideDiv.style.width = `${layoutInfo.sideBarWidth}px`;
        sideDiv.style.height = `calc(100% - ${layoutInfo.titleBarHeight + layoutInfo.statusBarHeight}px)`;
        sideDiv.style.top = `${layoutInfo.titleBarHeight}px`;
        if (layoutInfo.sideBarSide === "left") {
          sideDiv.style.left = `${layoutInfo.activityBarWidth}px`;
        } else {
          sideDiv.style.right = `${layoutInfo.activityBarWidth}px`;
        }
        sideDiv.style.backgroundColor = `${colorInfo.sideBarBackground}`;
        splash.appendChild(sideDiv);
        if (colorInfo.sideBarBorder) {
          const sideBorderDiv = document.createElement("div");
          sideBorderDiv.style.position = "absolute";
          sideBorderDiv.style.width = "1px";
          sideBorderDiv.style.height = "100%";
          sideBorderDiv.style.top = "0";
          sideBorderDiv.style.right = "0";
          if (layoutInfo.sideBarSide === "left") {
            sideBorderDiv.style.borderRight = `1px solid ${colorInfo.sideBarBorder}`;
          } else {
            sideBorderDiv.style.left = "0";
            sideBorderDiv.style.borderLeft = `1px solid ${colorInfo.sideBarBorder}`;
          }
          sideDiv.appendChild(sideBorderDiv);
        }
      }
      if (layoutInfo.auxiliarySideBarWidth > 0) {
        const auxSideDiv = document.createElement("div");
        auxSideDiv.style.position = "absolute";
        auxSideDiv.style.width = `${layoutInfo.auxiliarySideBarWidth}px`;
        auxSideDiv.style.height = `calc(100% - ${layoutInfo.titleBarHeight + layoutInfo.statusBarHeight}px)`;
        auxSideDiv.style.top = `${layoutInfo.titleBarHeight}px`;
        if (layoutInfo.sideBarSide === "left") {
          auxSideDiv.style.right = "0";
        } else {
          auxSideDiv.style.left = "0";
        }
        auxSideDiv.style.backgroundColor = `${colorInfo.sideBarBackground}`;
        splash.appendChild(auxSideDiv);
        if (colorInfo.sideBarBorder) {
          const auxSideBorderDiv = document.createElement("div");
          auxSideBorderDiv.style.position = "absolute";
          auxSideBorderDiv.style.width = "1px";
          auxSideBorderDiv.style.height = "100%";
          auxSideBorderDiv.style.top = "0";
          if (layoutInfo.sideBarSide === "left") {
            auxSideBorderDiv.style.left = "0";
            auxSideBorderDiv.style.borderLeft = `1px solid ${colorInfo.sideBarBorder}`;
          } else {
            auxSideBorderDiv.style.right = "0";
            auxSideBorderDiv.style.borderRight = `1px solid ${colorInfo.sideBarBorder}`;
          }
          auxSideDiv.appendChild(auxSideBorderDiv);
        }
      }
      if (layoutInfo.statusBarHeight > 0) {
        const statusDiv = document.createElement("div");
        statusDiv.style.position = "absolute";
        statusDiv.style.width = "100%";
        statusDiv.style.height = `${layoutInfo.statusBarHeight}px`;
        statusDiv.style.bottom = "0";
        statusDiv.style.left = "0";
        if (configuration2.workspace && colorInfo.statusBarBackground) {
          statusDiv.style.backgroundColor = colorInfo.statusBarBackground;
        } else if (!configuration2.workspace && colorInfo.statusBarNoFolderBackground) {
          statusDiv.style.backgroundColor = colorInfo.statusBarNoFolderBackground;
        }
        splash.appendChild(statusDiv);
        if (colorInfo.statusBarBorder) {
          const statusBorderDiv = document.createElement("div");
          statusBorderDiv.style.position = "absolute";
          statusBorderDiv.style.width = "100%";
          statusBorderDiv.style.height = "1px";
          statusBorderDiv.style.top = "0";
          statusBorderDiv.style.borderTop = `1px solid ${colorInfo.statusBarBorder}`;
          statusDiv.appendChild(statusBorderDiv);
        }
      }
      window.document.body.appendChild(splash);
    }
    performance.mark("code/didShowPartsSplash");
  }
  const { result, configuration } = await bootstrapWindow.load(
    "vs/workbench/workbench.desktop.main",
    {
      configureDeveloperSettings: function(windowConfig) {
        return {
          // disable automated devtools opening on error when running extension tests
          // as this can lead to nondeterministic test execution (devtools steals focus)
          forceDisableShowDevtoolsOnError: typeof windowConfig.extensionTestsPath === "string" || windowConfig["enable-smoke-test-driver"] === true,
          // enable devtools keybindings in extension development window
          forceEnableDeveloperKeybindings: Array.isArray(windowConfig.extensionDevelopmentPath) && windowConfig.extensionDevelopmentPath.length > 0,
          removeDeveloperKeybindingsAfterLoad: true
        };
      },
      beforeImport: function(windowConfig) {
        showSplash(windowConfig);
        Object.defineProperty(window, "vscodeWindowId", {
          get: () => windowConfig.windowId
        });
        window.requestIdleCallback(() => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          context?.clearRect(0, 0, canvas.width, canvas.height);
          canvas.remove();
        }, { timeout: 50 });
        performance.mark("code/willLoadWorkbenchMain");
      }
    }
  );
  performance.mark("code/didLoadWorkbenchMain");
  result.main(configuration);
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLXNhbmRib3gvd29ya2JlbmNoL3dvcmtiZW5jaC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbi8qIGVzbGludC1kaXNhYmxlIG5vLXJlc3RyaWN0ZWQtZ2xvYmFscyAqL1xuXG4oYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdC8vIEFkZCBhIHBlcmYgZW50cnkgcmlnaHQgZnJvbSB0aGUgdG9wXG5cdHBlcmZvcm1hbmNlLm1hcmsoJ2NvZGUvZGlkU3RhcnRSZW5kZXJlcicpO1xuXG5cdHR5cGUgSU5hdGl2ZVdpbmRvd0NvbmZpZ3VyYXRpb24gPSBpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LnRzJykuSU5hdGl2ZVdpbmRvd0NvbmZpZ3VyYXRpb247XG5cdHR5cGUgSUJvb3RzdHJhcFdpbmRvdyA9IGltcG9ydCgnLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2VsZWN0cm9uLXNhbmRib3gvd2luZG93LmpzJykuSUJvb3RzdHJhcFdpbmRvdztcblx0dHlwZSBJTWFpbldpbmRvd1NhbmRib3hHbG9iYWxzID0gaW1wb3J0KCcuLi8uLi8uLi9iYXNlL3BhcnRzL3NhbmRib3gvZWxlY3Ryb24tc2FuZGJveC9nbG9iYWxzLmpzJykuSU1haW5XaW5kb3dTYW5kYm94R2xvYmFscztcblx0dHlwZSBJRGVza3RvcE1haW4gPSBpbXBvcnQoJy4uLy4uLy4uL3dvcmtiZW5jaC9lbGVjdHJvbi1zYW5kYm94L2Rlc2t0b3AubWFpbi5qcycpLklEZXNrdG9wTWFpbjtcblxuXHRjb25zdCBib290c3RyYXBXaW5kb3c6IElCb290c3RyYXBXaW5kb3cgPSAod2luZG93IGFzIGFueSkuTW9uYWNvQm9vdHN0cmFwV2luZG93OyBcdC8vIGRlZmluZWQgYnkgYm9vdHN0cmFwLXdpbmRvdy50c1xuXHRjb25zdCBwcmVsb2FkR2xvYmFsczogSU1haW5XaW5kb3dTYW5kYm94R2xvYmFscyA9ICh3aW5kb3cgYXMgYW55KS52c2NvZGU7IFx0XHRcdC8vIGRlZmluZWQgYnkgcHJlbG9hZC50c1xuXG5cdC8vI3JlZ2lvbiBTcGxhc2ggU2NyZWVuIEhlbHBlcnNcblxuXHRmdW5jdGlvbiBzaG93U3BsYXNoKGNvbmZpZ3VyYXRpb246IElOYXRpdmVXaW5kb3dDb25maWd1cmF0aW9uKSB7XG5cdFx0cGVyZm9ybWFuY2UubWFyaygnY29kZS93aWxsU2hvd1BhcnRzU3BsYXNoJyk7XG5cblx0XHRsZXQgZGF0YSA9IGNvbmZpZ3VyYXRpb24ucGFydHNTcGxhc2g7XG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdGlmIChjb25maWd1cmF0aW9uLmF1dG9EZXRlY3RIaWdoQ29udHJhc3QgJiYgY29uZmlndXJhdGlvbi5jb2xvclNjaGVtZS5oaWdoQ29udHJhc3QpIHtcblx0XHRcdFx0aWYgKChjb25maWd1cmF0aW9uLmNvbG9yU2NoZW1lLmRhcmsgJiYgZGF0YS5iYXNlVGhlbWUgIT09ICdoYy1ibGFjaycpIHx8ICghY29uZmlndXJhdGlvbi5jb2xvclNjaGVtZS5kYXJrICYmIGRhdGEuYmFzZVRoZW1lICE9PSAnaGMtbGlnaHQnKSkge1xuXHRcdFx0XHRcdGRhdGEgPSB1bmRlZmluZWQ7IC8vIGhpZ2ggY29udHJhc3QgbW9kZSBoYXMgYmVlbiB0dXJuZWQgYnkgdGhlIE9TIC0+IGlnbm9yZSBzdG9yZWQgY29sb3JzIGFuZCBsYXlvdXRzXG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoY29uZmlndXJhdGlvbi5hdXRvRGV0ZWN0Q29sb3JTY2hlbWUpIHtcblx0XHRcdFx0aWYgKChjb25maWd1cmF0aW9uLmNvbG9yU2NoZW1lLmRhcmsgJiYgZGF0YS5iYXNlVGhlbWUgIT09ICd2cy1kYXJrJykgfHwgKCFjb25maWd1cmF0aW9uLmNvbG9yU2NoZW1lLmRhcmsgJiYgZGF0YS5iYXNlVGhlbWUgIT09ICd2cycpKSB7XG5cdFx0XHRcdFx0ZGF0YSA9IHVuZGVmaW5lZDsgLy8gT1MgY29sb3Igc2NoZW1lIGlzIHRyYWNrZWQgYW5kIGhhcyBjaGFuZ2VkXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBkZXZlbG9waW5nIGFuIGV4dGVuc2lvbiAtPiBpZ25vcmUgc3RvcmVkIGxheW91dHNcblx0XHRpZiAoZGF0YSAmJiBjb25maWd1cmF0aW9uLmV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCkge1xuXHRcdFx0ZGF0YS5sYXlvdXRJbmZvID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIG1pbmltYWwgY29sb3IgY29uZmlndXJhdGlvbiAod29ya3Mgd2l0aCBvciB3aXRob3V0IHBlcnNpc3RlZCBkYXRhKVxuXHRcdGxldCBiYXNlVGhlbWU7XG5cdFx0bGV0IHNoZWxsQmFja2dyb3VuZDtcblx0XHRsZXQgc2hlbGxGb3JlZ3JvdW5kO1xuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHRiYXNlVGhlbWUgPSBkYXRhLmJhc2VUaGVtZTtcblx0XHRcdHNoZWxsQmFja2dyb3VuZCA9IGRhdGEuY29sb3JJbmZvLmVkaXRvckJhY2tncm91bmQ7XG5cdFx0XHRzaGVsbEZvcmVncm91bmQgPSBkYXRhLmNvbG9ySW5mby5mb3JlZ3JvdW5kO1xuXHRcdH0gZWxzZSBpZiAoY29uZmlndXJhdGlvbi5hdXRvRGV0ZWN0SGlnaENvbnRyYXN0ICYmIGNvbmZpZ3VyYXRpb24uY29sb3JTY2hlbWUuaGlnaENvbnRyYXN0KSB7XG5cdFx0XHRpZiAoY29uZmlndXJhdGlvbi5jb2xvclNjaGVtZS5kYXJrKSB7XG5cdFx0XHRcdGJhc2VUaGVtZSA9ICdoYy1ibGFjayc7XG5cdFx0XHRcdHNoZWxsQmFja2dyb3VuZCA9ICcjMDAwMDAwJztcblx0XHRcdFx0c2hlbGxGb3JlZ3JvdW5kID0gJyNGRkZGRkYnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YmFzZVRoZW1lID0gJ2hjLWxpZ2h0Jztcblx0XHRcdFx0c2hlbGxCYWNrZ3JvdW5kID0gJyNGRkZGRkYnO1xuXHRcdFx0XHRzaGVsbEZvcmVncm91bmQgPSAnIzAwMDAwMCc7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChjb25maWd1cmF0aW9uLmF1dG9EZXRlY3RDb2xvclNjaGVtZSkge1xuXHRcdFx0aWYgKGNvbmZpZ3VyYXRpb24uY29sb3JTY2hlbWUuZGFyaykge1xuXHRcdFx0XHRiYXNlVGhlbWUgPSAndnMtZGFyayc7XG5cdFx0XHRcdHNoZWxsQmFja2dyb3VuZCA9ICcjMUUxRTFFJztcblx0XHRcdFx0c2hlbGxGb3JlZ3JvdW5kID0gJyNDQ0NDQ0MnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YmFzZVRoZW1lID0gJ3ZzJztcblx0XHRcdFx0c2hlbGxCYWNrZ3JvdW5kID0gJyNGRkZGRkYnO1xuXHRcdFx0XHRzaGVsbEZvcmVncm91bmQgPSAnIzAwMDAwMCc7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuXHRcdHN0eWxlLmNsYXNzTmFtZSA9ICdpbml0aWFsU2hlbGxDb2xvcnMnO1xuXHRcdHdpbmRvdy5kb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKTtcblx0XHRzdHlsZS50ZXh0Q29udGVudCA9IGBib2R5IHtcdGJhY2tncm91bmQtY29sb3I6ICR7c2hlbGxCYWNrZ3JvdW5kfTsgY29sb3I6ICR7c2hlbGxGb3JlZ3JvdW5kfTsgbWFyZ2luOiAwOyBwYWRkaW5nOiAwOyB9YDtcblxuXHRcdC8vIHNldCB6b29tIGxldmVsIGFzIHNvb24gYXMgcG9zc2libGVcblx0XHRpZiAodHlwZW9mIGRhdGE/Lnpvb21MZXZlbCA9PT0gJ251bWJlcicgJiYgdHlwZW9mIHByZWxvYWRHbG9iYWxzPy53ZWJGcmFtZT8uc2V0Wm9vbUxldmVsID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRwcmVsb2FkR2xvYmFscy53ZWJGcmFtZS5zZXRab29tTGV2ZWwoZGF0YS56b29tTGV2ZWwpO1xuXHRcdH1cblxuXHRcdC8vIHJlc3RvcmUgcGFydHMgaWYgcG9zc2libGUgKHdlIG1pZ2h0IG5vdCBhbHdheXMgc3RvcmUgbGF5b3V0IGluZm8pXG5cdFx0aWYgKGRhdGE/LmxheW91dEluZm8pIHtcblx0XHRcdGNvbnN0IHsgbGF5b3V0SW5mbywgY29sb3JJbmZvIH0gPSBkYXRhO1xuXG5cdFx0XHRjb25zdCBzcGxhc2ggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdHNwbGFzaC5pZCA9ICdtb25hY28tcGFydHMtc3BsYXNoJztcblx0XHRcdHNwbGFzaC5jbGFzc05hbWUgPSBiYXNlVGhlbWUgPz8gJ3ZzLWRhcmsnO1xuXG5cdFx0XHRpZiAobGF5b3V0SW5mby53aW5kb3dCb3JkZXIgJiYgY29sb3JJbmZvLndpbmRvd0JvcmRlcikge1xuXHRcdFx0XHRjb25zdCBib3JkZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdGJvcmRlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdFx0XHRib3JkZXJFbGVtZW50LnN0eWxlLndpZHRoID0gJ2NhbGMoMTAwdncgLSAycHgpJztcblx0XHRcdFx0Ym9yZGVyRWxlbWVudC5zdHlsZS5oZWlnaHQgPSAnY2FsYygxMDB2aCAtIDJweCknO1xuXHRcdFx0XHRib3JkZXJFbGVtZW50LnN0eWxlLnpJbmRleCA9ICcxJzsgLy8gYWxsb3cgYm9yZGVyIGFib3ZlIG90aGVyIGVsZW1lbnRzXG5cdFx0XHRcdGJvcmRlckVsZW1lbnQuc3R5bGUuYm9yZGVyID0gYDFweCBzb2xpZCB2YXIoLS13aW5kb3ctYm9yZGVyLWNvbG9yKWA7XG5cdFx0XHRcdGJvcmRlckVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoJy0td2luZG93LWJvcmRlci1jb2xvcicsIGNvbG9ySW5mby53aW5kb3dCb3JkZXIpO1xuXG5cdFx0XHRcdGlmIChsYXlvdXRJbmZvLndpbmRvd0JvcmRlclJhZGl1cykge1xuXHRcdFx0XHRcdGJvcmRlckVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gbGF5b3V0SW5mby53aW5kb3dCb3JkZXJSYWRpdXM7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzcGxhc2guYXBwZW5kQ2hpbGQoYm9yZGVyRWxlbWVudCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGVuc3VyZSB0aGVyZSBpcyBlbm91Z2ggc3BhY2Vcblx0XHRcdGxheW91dEluZm8uYXV4aWxpYXJ5U2lkZUJhcldpZHRoID0gTWF0aC5taW4obGF5b3V0SW5mby5hdXhpbGlhcnlTaWRlQmFyV2lkdGgsIHdpbmRvdy5pbm5lcldpZHRoIC0gKGxheW91dEluZm8uYWN0aXZpdHlCYXJXaWR0aCArIGxheW91dEluZm8uZWRpdG9yUGFydE1pbldpZHRoICsgbGF5b3V0SW5mby5zaWRlQmFyV2lkdGgpKTtcblx0XHRcdGxheW91dEluZm8uc2lkZUJhcldpZHRoID0gTWF0aC5taW4obGF5b3V0SW5mby5zaWRlQmFyV2lkdGgsIHdpbmRvdy5pbm5lcldpZHRoIC0gKGxheW91dEluZm8uYWN0aXZpdHlCYXJXaWR0aCArIGxheW91dEluZm8uZWRpdG9yUGFydE1pbldpZHRoICsgbGF5b3V0SW5mby5hdXhpbGlhcnlTaWRlQmFyV2lkdGgpKTtcblxuXHRcdFx0Ly8gcGFydDogdGl0bGVcblx0XHRcdGlmIChsYXlvdXRJbmZvLnRpdGxlQmFySGVpZ2h0ID4gMCkge1xuXHRcdFx0XHRjb25zdCB0aXRsZURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHR0aXRsZURpdi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0XHRcdHRpdGxlRGl2LnN0eWxlLndpZHRoID0gJzEwMCUnO1xuXHRcdFx0XHR0aXRsZURpdi5zdHlsZS5oZWlnaHQgPSBgJHtsYXlvdXRJbmZvLnRpdGxlQmFySGVpZ2h0fXB4YDtcblx0XHRcdFx0dGl0bGVEaXYuc3R5bGUubGVmdCA9ICcwJztcblx0XHRcdFx0dGl0bGVEaXYuc3R5bGUudG9wID0gJzAnO1xuXHRcdFx0XHR0aXRsZURpdi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBgJHtjb2xvckluZm8udGl0bGVCYXJCYWNrZ3JvdW5kfWA7XG5cdFx0XHRcdCh0aXRsZURpdi5zdHlsZSBhcyBhbnkpWyctd2Via2l0LWFwcC1yZWdpb24nXSA9ICdkcmFnJztcblx0XHRcdFx0c3BsYXNoLmFwcGVuZENoaWxkKHRpdGxlRGl2KTtcblxuXHRcdFx0XHRpZiAoY29sb3JJbmZvLnRpdGxlQmFyQm9yZGVyKSB7XG5cdFx0XHRcdFx0Y29uc3QgdGl0bGVCb3JkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0XHR0aXRsZUJvcmRlci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0XHRcdFx0dGl0bGVCb3JkZXIuc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cdFx0XHRcdFx0dGl0bGVCb3JkZXIuc3R5bGUuaGVpZ2h0ID0gJzFweCc7XG5cdFx0XHRcdFx0dGl0bGVCb3JkZXIuc3R5bGUubGVmdCA9ICcwJztcblx0XHRcdFx0XHR0aXRsZUJvcmRlci5zdHlsZS5ib3R0b20gPSAnMCc7XG5cdFx0XHRcdFx0dGl0bGVCb3JkZXIuc3R5bGUuYm9yZGVyQm90dG9tID0gYDFweCBzb2xpZCAke2NvbG9ySW5mby50aXRsZUJhckJvcmRlcn1gO1xuXHRcdFx0XHRcdHRpdGxlRGl2LmFwcGVuZENoaWxkKHRpdGxlQm9yZGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBwYXJ0OiBhY3Rpdml0eSBiYXJcblx0XHRcdGlmIChsYXlvdXRJbmZvLmFjdGl2aXR5QmFyV2lkdGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IGFjdGl2aXR5RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdGFjdGl2aXR5RGl2LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRcdFx0YWN0aXZpdHlEaXYuc3R5bGUud2lkdGggPSBgJHtsYXlvdXRJbmZvLmFjdGl2aXR5QmFyV2lkdGh9cHhgO1xuXHRcdFx0XHRhY3Rpdml0eURpdi5zdHlsZS5oZWlnaHQgPSBgY2FsYygxMDAlIC0gJHtsYXlvdXRJbmZvLnRpdGxlQmFySGVpZ2h0ICsgbGF5b3V0SW5mby5zdGF0dXNCYXJIZWlnaHR9cHgpYDtcblx0XHRcdFx0YWN0aXZpdHlEaXYuc3R5bGUudG9wID0gYCR7bGF5b3V0SW5mby50aXRsZUJhckhlaWdodH1weGA7XG5cdFx0XHRcdGlmIChsYXlvdXRJbmZvLnNpZGVCYXJTaWRlID09PSAnbGVmdCcpIHtcblx0XHRcdFx0XHRhY3Rpdml0eURpdi5zdHlsZS5sZWZ0ID0gJzAnO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFjdGl2aXR5RGl2LnN0eWxlLnJpZ2h0ID0gJzAnO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGFjdGl2aXR5RGl2LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGAke2NvbG9ySW5mby5hY3Rpdml0eUJhckJhY2tncm91bmR9YDtcblx0XHRcdFx0c3BsYXNoLmFwcGVuZENoaWxkKGFjdGl2aXR5RGl2KTtcblxuXHRcdFx0XHRpZiAoY29sb3JJbmZvLmFjdGl2aXR5QmFyQm9yZGVyKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aXZpdHlCb3JkZXJEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0XHRhY3Rpdml0eUJvcmRlckRpdi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0XHRcdFx0YWN0aXZpdHlCb3JkZXJEaXYuc3R5bGUud2lkdGggPSAnMXB4Jztcblx0XHRcdFx0XHRhY3Rpdml0eUJvcmRlckRpdi5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG5cdFx0XHRcdFx0YWN0aXZpdHlCb3JkZXJEaXYuc3R5bGUudG9wID0gJzAnO1xuXHRcdFx0XHRcdGlmIChsYXlvdXRJbmZvLnNpZGVCYXJTaWRlID09PSAnbGVmdCcpIHtcblx0XHRcdFx0XHRcdGFjdGl2aXR5Qm9yZGVyRGl2LnN0eWxlLnJpZ2h0ID0gJzAnO1xuXHRcdFx0XHRcdFx0YWN0aXZpdHlCb3JkZXJEaXYuc3R5bGUuYm9yZGVyUmlnaHQgPSBgMXB4IHNvbGlkICR7Y29sb3JJbmZvLmFjdGl2aXR5QmFyQm9yZGVyfWA7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFjdGl2aXR5Qm9yZGVyRGl2LnN0eWxlLmxlZnQgPSAnMCc7XG5cdFx0XHRcdFx0XHRhY3Rpdml0eUJvcmRlckRpdi5zdHlsZS5ib3JkZXJMZWZ0ID0gYDFweCBzb2xpZCAke2NvbG9ySW5mby5hY3Rpdml0eUJhckJvcmRlcn1gO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhY3Rpdml0eURpdi5hcHBlbmRDaGlsZChhY3Rpdml0eUJvcmRlckRpdik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gcGFydDogc2lkZSBiYXIgKG9ubHkgd2hlbiBvcGVuaW5nIHdvcmtzcGFjZS9mb2xkZXIpXG5cdFx0XHRpZiAoY29uZmlndXJhdGlvbi53b3Jrc3BhY2UgJiYgbGF5b3V0SW5mby5zaWRlQmFyV2lkdGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IHNpZGVEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0c2lkZURpdi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0XHRcdHNpZGVEaXYuc3R5bGUud2lkdGggPSBgJHtsYXlvdXRJbmZvLnNpZGVCYXJXaWR0aH1weGA7XG5cdFx0XHRcdHNpZGVEaXYuc3R5bGUuaGVpZ2h0ID0gYGNhbGMoMTAwJSAtICR7bGF5b3V0SW5mby50aXRsZUJhckhlaWdodCArIGxheW91dEluZm8uc3RhdHVzQmFySGVpZ2h0fXB4KWA7XG5cdFx0XHRcdHNpZGVEaXYuc3R5bGUudG9wID0gYCR7bGF5b3V0SW5mby50aXRsZUJhckhlaWdodH1weGA7XG5cdFx0XHRcdGlmIChsYXlvdXRJbmZvLnNpZGVCYXJTaWRlID09PSAnbGVmdCcpIHtcblx0XHRcdFx0XHRzaWRlRGl2LnN0eWxlLmxlZnQgPSBgJHtsYXlvdXRJbmZvLmFjdGl2aXR5QmFyV2lkdGh9cHhgO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNpZGVEaXYuc3R5bGUucmlnaHQgPSBgJHtsYXlvdXRJbmZvLmFjdGl2aXR5QmFyV2lkdGh9cHhgO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNpZGVEaXYuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYCR7Y29sb3JJbmZvLnNpZGVCYXJCYWNrZ3JvdW5kfWA7XG5cdFx0XHRcdHNwbGFzaC5hcHBlbmRDaGlsZChzaWRlRGl2KTtcblxuXHRcdFx0XHRpZiAoY29sb3JJbmZvLnNpZGVCYXJCb3JkZXIpIHtcblx0XHRcdFx0XHRjb25zdCBzaWRlQm9yZGVyRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0c2lkZUJvcmRlckRpdi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0XHRcdFx0c2lkZUJvcmRlckRpdi5zdHlsZS53aWR0aCA9ICcxcHgnO1xuXHRcdFx0XHRcdHNpZGVCb3JkZXJEaXYuc3R5bGUuaGVpZ2h0ID0gJzEwMCUnO1xuXHRcdFx0XHRcdHNpZGVCb3JkZXJEaXYuc3R5bGUudG9wID0gJzAnO1xuXHRcdFx0XHRcdHNpZGVCb3JkZXJEaXYuc3R5bGUucmlnaHQgPSAnMCc7XG5cdFx0XHRcdFx0aWYgKGxheW91dEluZm8uc2lkZUJhclNpZGUgPT09ICdsZWZ0Jykge1xuXHRcdFx0XHRcdFx0c2lkZUJvcmRlckRpdi5zdHlsZS5ib3JkZXJSaWdodCA9IGAxcHggc29saWQgJHtjb2xvckluZm8uc2lkZUJhckJvcmRlcn1gO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRzaWRlQm9yZGVyRGl2LnN0eWxlLmxlZnQgPSAnMCc7XG5cdFx0XHRcdFx0XHRzaWRlQm9yZGVyRGl2LnN0eWxlLmJvcmRlckxlZnQgPSBgMXB4IHNvbGlkICR7Y29sb3JJbmZvLnNpZGVCYXJCb3JkZXJ9YDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2lkZURpdi5hcHBlbmRDaGlsZChzaWRlQm9yZGVyRGl2KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBwYXJ0OiBhdXhpbGlhcnkgc2lkZWJhclxuXHRcdFx0aWYgKGxheW91dEluZm8uYXV4aWxpYXJ5U2lkZUJhcldpZHRoID4gMCkge1xuXHRcdFx0XHRjb25zdCBhdXhTaWRlRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdGF1eFNpZGVEaXYuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdFx0XHRhdXhTaWRlRGl2LnN0eWxlLndpZHRoID0gYCR7bGF5b3V0SW5mby5hdXhpbGlhcnlTaWRlQmFyV2lkdGh9cHhgO1xuXHRcdFx0XHRhdXhTaWRlRGl2LnN0eWxlLmhlaWdodCA9IGBjYWxjKDEwMCUgLSAke2xheW91dEluZm8udGl0bGVCYXJIZWlnaHQgKyBsYXlvdXRJbmZvLnN0YXR1c0JhckhlaWdodH1weClgO1xuXHRcdFx0XHRhdXhTaWRlRGl2LnN0eWxlLnRvcCA9IGAke2xheW91dEluZm8udGl0bGVCYXJIZWlnaHR9cHhgO1xuXHRcdFx0XHRpZiAobGF5b3V0SW5mby5zaWRlQmFyU2lkZSA9PT0gJ2xlZnQnKSB7XG5cdFx0XHRcdFx0YXV4U2lkZURpdi5zdHlsZS5yaWdodCA9ICcwJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhdXhTaWRlRGl2LnN0eWxlLmxlZnQgPSAnMCc7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXV4U2lkZURpdi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBgJHtjb2xvckluZm8uc2lkZUJhckJhY2tncm91bmR9YDtcblx0XHRcdFx0c3BsYXNoLmFwcGVuZENoaWxkKGF1eFNpZGVEaXYpO1xuXG5cdFx0XHRcdGlmIChjb2xvckluZm8uc2lkZUJhckJvcmRlcikge1xuXHRcdFx0XHRcdGNvbnN0IGF1eFNpZGVCb3JkZXJEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0XHRhdXhTaWRlQm9yZGVyRGl2LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHRcdFx0XHRhdXhTaWRlQm9yZGVyRGl2LnN0eWxlLndpZHRoID0gJzFweCc7XG5cdFx0XHRcdFx0YXV4U2lkZUJvcmRlckRpdi5zdHlsZS5oZWlnaHQgPSAnMTAwJSc7XG5cdFx0XHRcdFx0YXV4U2lkZUJvcmRlckRpdi5zdHlsZS50b3AgPSAnMCc7XG5cdFx0XHRcdFx0aWYgKGxheW91dEluZm8uc2lkZUJhclNpZGUgPT09ICdsZWZ0Jykge1xuXHRcdFx0XHRcdFx0YXV4U2lkZUJvcmRlckRpdi5zdHlsZS5sZWZ0ID0gJzAnO1xuXHRcdFx0XHRcdFx0YXV4U2lkZUJvcmRlckRpdi5zdHlsZS5ib3JkZXJMZWZ0ID0gYDFweCBzb2xpZCAke2NvbG9ySW5mby5zaWRlQmFyQm9yZGVyfWA7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGF1eFNpZGVCb3JkZXJEaXYuc3R5bGUucmlnaHQgPSAnMCc7XG5cdFx0XHRcdFx0XHRhdXhTaWRlQm9yZGVyRGl2LnN0eWxlLmJvcmRlclJpZ2h0ID0gYDFweCBzb2xpZCAke2NvbG9ySW5mby5zaWRlQmFyQm9yZGVyfWA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGF1eFNpZGVEaXYuYXBwZW5kQ2hpbGQoYXV4U2lkZUJvcmRlckRpdik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gcGFydDogc3RhdHVzYmFyXG5cdFx0XHRpZiAobGF5b3V0SW5mby5zdGF0dXNCYXJIZWlnaHQgPiAwKSB7XG5cdFx0XHRcdGNvbnN0IHN0YXR1c0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRzdGF0dXNEaXYuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuXHRcdFx0XHRzdGF0dXNEaXYuc3R5bGUud2lkdGggPSAnMTAwJSc7XG5cdFx0XHRcdHN0YXR1c0Rpdi5zdHlsZS5oZWlnaHQgPSBgJHtsYXlvdXRJbmZvLnN0YXR1c0JhckhlaWdodH1weGA7XG5cdFx0XHRcdHN0YXR1c0Rpdi5zdHlsZS5ib3R0b20gPSAnMCc7XG5cdFx0XHRcdHN0YXR1c0Rpdi5zdHlsZS5sZWZ0ID0gJzAnO1xuXHRcdFx0XHRpZiAoY29uZmlndXJhdGlvbi53b3Jrc3BhY2UgJiYgY29sb3JJbmZvLnN0YXR1c0JhckJhY2tncm91bmQpIHtcblx0XHRcdFx0XHRzdGF0dXNEaXYuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gY29sb3JJbmZvLnN0YXR1c0JhckJhY2tncm91bmQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIWNvbmZpZ3VyYXRpb24ud29ya3NwYWNlICYmIGNvbG9ySW5mby5zdGF0dXNCYXJOb0ZvbGRlckJhY2tncm91bmQpIHtcblx0XHRcdFx0XHRzdGF0dXNEaXYuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gY29sb3JJbmZvLnN0YXR1c0Jhck5vRm9sZGVyQmFja2dyb3VuZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzcGxhc2guYXBwZW5kQ2hpbGQoc3RhdHVzRGl2KTtcblxuXHRcdFx0XHRpZiAoY29sb3JJbmZvLnN0YXR1c0JhckJvcmRlcikge1xuXHRcdFx0XHRcdGNvbnN0IHN0YXR1c0JvcmRlckRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRcdHN0YXR1c0JvcmRlckRpdi5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0XHRcdFx0c3RhdHVzQm9yZGVyRGl2LnN0eWxlLndpZHRoID0gJzEwMCUnO1xuXHRcdFx0XHRcdHN0YXR1c0JvcmRlckRpdi5zdHlsZS5oZWlnaHQgPSAnMXB4Jztcblx0XHRcdFx0XHRzdGF0dXNCb3JkZXJEaXYuc3R5bGUudG9wID0gJzAnO1xuXHRcdFx0XHRcdHN0YXR1c0JvcmRlckRpdi5zdHlsZS5ib3JkZXJUb3AgPSBgMXB4IHNvbGlkICR7Y29sb3JJbmZvLnN0YXR1c0JhckJvcmRlcn1gO1xuXHRcdFx0XHRcdHN0YXR1c0Rpdi5hcHBlbmRDaGlsZChzdGF0dXNCb3JkZXJEaXYpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHNwbGFzaCk7XG5cdFx0fVxuXG5cdFx0cGVyZm9ybWFuY2UubWFyaygnY29kZS9kaWRTaG93UGFydHNTcGxhc2gnKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdGNvbnN0IHsgcmVzdWx0LCBjb25maWd1cmF0aW9uIH0gPSBhd2FpdCBib290c3RyYXBXaW5kb3cubG9hZDxJRGVza3RvcE1haW4sIElOYXRpdmVXaW5kb3dDb25maWd1cmF0aW9uPigndnMvd29ya2JlbmNoL3dvcmtiZW5jaC5kZXNrdG9wLm1haW4nLFxuXHRcdHtcblx0XHRcdGNvbmZpZ3VyZURldmVsb3BlclNldHRpbmdzOiBmdW5jdGlvbiAod2luZG93Q29uZmlnKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Ly8gZGlzYWJsZSBhdXRvbWF0ZWQgZGV2dG9vbHMgb3BlbmluZyBvbiBlcnJvciB3aGVuIHJ1bm5pbmcgZXh0ZW5zaW9uIHRlc3RzXG5cdFx0XHRcdFx0Ly8gYXMgdGhpcyBjYW4gbGVhZCB0byBub25kZXRlcm1pbmlzdGljIHRlc3QgZXhlY3V0aW9uIChkZXZ0b29scyBzdGVhbHMgZm9jdXMpXG5cdFx0XHRcdFx0Zm9yY2VEaXNhYmxlU2hvd0RldnRvb2xzT25FcnJvcjogdHlwZW9mIHdpbmRvd0NvbmZpZy5leHRlbnNpb25UZXN0c1BhdGggPT09ICdzdHJpbmcnIHx8IHdpbmRvd0NvbmZpZ1snZW5hYmxlLXNtb2tlLXRlc3QtZHJpdmVyJ10gPT09IHRydWUsXG5cdFx0XHRcdFx0Ly8gZW5hYmxlIGRldnRvb2xzIGtleWJpbmRpbmdzIGluIGV4dGVuc2lvbiBkZXZlbG9wbWVudCB3aW5kb3dcblx0XHRcdFx0XHRmb3JjZUVuYWJsZURldmVsb3BlcktleWJpbmRpbmdzOiBBcnJheS5pc0FycmF5KHdpbmRvd0NvbmZpZy5leHRlbnNpb25EZXZlbG9wbWVudFBhdGgpICYmIHdpbmRvd0NvbmZpZy5leHRlbnNpb25EZXZlbG9wbWVudFBhdGgubGVuZ3RoID4gMCxcblx0XHRcdFx0XHRyZW1vdmVEZXZlbG9wZXJLZXliaW5kaW5nc0FmdGVyTG9hZDogdHJ1ZVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdGJlZm9yZUltcG9ydDogZnVuY3Rpb24gKHdpbmRvd0NvbmZpZykge1xuXG5cdFx0XHRcdC8vIFNob3cgb3VyIHNwbGFzaCBhcyBlYXJseSBhcyBwb3NzaWJsZVxuXHRcdFx0XHRzaG93U3BsYXNoKHdpbmRvd0NvbmZpZyk7XG5cblx0XHRcdFx0Ly8gQ29kZSB3aW5kb3dzIGhhdmUgYSBgdnNjb2RlV2luZG93SWRgIHByb3BlcnR5IHRvIGlkZW50aWZ5IHRoZW1cblx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHdpbmRvdywgJ3ZzY29kZVdpbmRvd0lkJywge1xuXHRcdFx0XHRcdGdldDogKCkgPT4gd2luZG93Q29uZmlnLndpbmRvd0lkXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdC8vIEl0IGxvb2tzIGxpa2UgYnJvd3NlcnMgb25seSBsYXppbHkgZW5hYmxlXG5cdFx0XHRcdC8vIHRoZSA8Y2FudmFzPiBlbGVtZW50IHdoZW4gbmVlZGVkLiBTaW5jZSB3ZVxuXHRcdFx0XHQvLyBsZXZlcmFnZSBjYW52YXMgZWxlbWVudHMgaW4gb3VyIGNvZGUgaW4gbWFueVxuXHRcdFx0XHQvLyBsb2NhdGlvbnMsIHdlIHRyeSB0byBoZWxwIHRoZSBicm93c2VyIHRvXG5cdFx0XHRcdC8vIGluaXRpYWxpemUgY2FudmFzIHdoZW4gaXQgaXMgaWRsZSwgcmlnaHRcblx0XHRcdFx0Ly8gYmVmb3JlIHdlIHdhaXQgZm9yIHRoZSBzY3JpcHRzIHRvIGJlIGxvYWRlZC5cblx0XHRcdFx0d2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2soKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXHRcdFx0XHRcdGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblx0XHRcdFx0XHRjb250ZXh0Py5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcblx0XHRcdFx0XHRjYW52YXMucmVtb3ZlKCk7XG5cdFx0XHRcdH0sIHsgdGltZW91dDogNTAgfSk7XG5cblx0XHRcdFx0Ly8gVHJhY2sgaW1wb3J0KCkgcGVyZlxuXHRcdFx0XHRwZXJmb3JtYW5jZS5tYXJrKCdjb2RlL3dpbGxMb2FkV29ya2JlbmNoTWFpbicpO1xuXHRcdFx0fVxuXHRcdH1cblx0KTtcblxuXHQvLyBNYXJrIHN0YXJ0IG9mIHdvcmtiZW5jaFxuXHRwZXJmb3JtYW5jZS5tYXJrKCdjb2RlL2RpZExvYWRXb3JrYmVuY2hNYWluJyk7XG5cblx0Ly8gTG9hZCB3b3JrYmVuY2hcblx0cmVzdWx0Lm1haW4oY29uZmlndXJhdGlvbik7XG59KCkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIkNBT0MsaUJBQWtCO0FBR2xCLGNBQVksS0FBSyx1QkFBdUI7QUFPeEMsUUFBTSxrQkFBcUMsT0FBZTtBQUMxRCxRQUFNLGlCQUE2QyxPQUFlO0FBSWxFLFdBQVMsV0FBV0EsZ0JBQTJDO0FBQzlELGdCQUFZLEtB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O0FBQ3hCLGtCQUFVLE1BQU0sU0FBUyxHQUFHLFdBQVcsZUFBZTtBQUN0RCxrQkFBVSxNQUFNLFNBQVM7QUFDekIsa0JBQVUsTUFBTSxPQUFPO0FBQ3ZCLFlBQUlBLGVBQWMsYUFBYSxVQUFVLHFCQUFxQjtBQUM3RCxvQkFBVSxNQUFNLGtCQUFrQixVQUFVO0FBQUEsUUFDN0MsV0FBVyxDQUFDQSxlQUFjLGFBQWEsVUFBVSw2QkFBNkI7QUFDN0Usb0JBQVUsTUFBTSxrQkFBa0IsVUFBVTtBQUFBLFFBQzdDO0FBQ0EsZUFBTyxZQUFZLFNBQVM7QUFFNUIsWUFBSSxVQUFVLGlCQUFpQjtBQUM5QixnQkFBTSxrQkFBa0IsU0FBUyxjQUFjLEtBQUs7QUFDcEQsMEJBQWdCLE1BQU0sV0FBVztBQUNqQywwQkFBZ0IsTUFBTSxRQUFRO0FBQzlCLDBCQUFnQixNQUFNLFNBQVM7QUFDL0IsMEJBQWdCLE1BQU0sTUFBTTtBQUM1QiwwQkFBZ0IsTUFBTSxZQUFZLGFBQWEsVUFBVSxlQUFlO0FBQ3hFLG9CQUFVLFlBQVksZUFBZTtBQUFBLFFBQ3RDO0FBQUEsTUFDRDtBQUVBLGFBQU8sU0FBUyxLQUFLLFlBQVksTUFBTTtBQUFBLElBQ3hDO0FBRUEsZ0JBQVksS0FBSyx5QkFBeUI7QUFBQSxFQUMzQztBQUlBLFFBQU0sRUFBRSxRQUFRLGNBQWMsSUFBSSxNQUFNLGdCQUFnQjtBQUFBLElBQStDO0FBQUEsSUFDdEc7QUFBQSxNQUNDLDRCQUE0QixTQUFVLGNBQWM7QUFDbkQsZUFBTztBQUFBO0FBQUE7QUFBQSxVQUdOLGlDQUFpQyxPQUFPLGFBQWEsdUJBQXVCLFlBQVksYUFBYSwwQkFBMEIsTUFBTTtBQUFBO0FBQUEsVUFFckksaUNBQWlDLE1BQU0sUUFBUSxhQUFhLHdCQUF3QixLQUFLLGFBQWEseUJBQXlCLFNBQVM7QUFBQSxVQUN4SSxxQ0FBcUM7QUFBQSxRQUN0QztBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWMsU0FBVSxjQUFjO0FBR3JDLG1CQUFXLFlBQVk7QUFHdkIsZUFBTyxlQUFlLFFBQVEsa0JBQWtCO0FBQUEsVUFDL0MsS0FBSyxNQUFNLGFBQWE7QUFBQSxRQUN6QixDQUFDO0FBUUQsZUFBTyxvQkFBb0IsTUFBTTtBQUNoQyxnQkFBTSxTQUFTLFNBQVMsY0FBYyxRQUFRO0FBQzlDLGdCQUFNLFVBQVUsT0FBTyxXQUFXLElBQUk7QUFDdEMsbUJBQVMsVUFBVSxHQUFHLEdBQUcsT0FBTyxPQUFPLE9BQU8sTUFBTTtBQUNwRCxpQkFBTyxPQUFPO0FBQUEsUUFDZixHQUFHLEVBQUUsU0FBUyxHQUFHLENBQUM7QUFHbEIsb0JBQVksS0FBSyw0QkFBNEI7QUFBQSxNQUM5QztBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBR0EsY0FBWSxLQUFLLDJCQUEyQjtBQUc1QyxTQUFPLEtBQUssYUFBYTtBQUMxQixHQUFFOyIsCiAgIm5hbWVzIjogWyJjb25maWd1cmF0aW9uIl0KfQo=
