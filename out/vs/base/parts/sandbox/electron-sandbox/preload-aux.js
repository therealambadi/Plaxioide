(function() {
  const { ipcRenderer, webFrame, contextBridge } = require("electron");
  function validateIPC(channel) {
    if (!channel || !channel.startsWith("vscode:")) {
      throw new Error(`Unsupported event IPC channel '${channel}'`);
    }
    return true;
  }
  const globals = {
    /**
     * A minimal set of methods exposed from Electron's `ipcRenderer`
     * to support communication to main process.
     */
    ipcRenderer: {
      send(channel, ...args) {
        if (validateIPC(channel)) {
          ipcRenderer.send(channel, ...args);
        }
      },
      invoke(channel, ...args) {
        validateIPC(channel);
        return ipcRenderer.invoke(channel, ...args);
      }
    },
    /**
     * Support for subset of methods of Electron's `webFrame` type.
     */
    webFrame: {
      setZoomLevel(level) {
        if (typeof level === "number") {
          webFrame.setZoomLevel(level);
        }
      }
    }
  };
  try {
    contextBridge.exposeInMainWorld("vscode", globals);
  } catch (error) {
    console.error(error);
  }
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3BhcnRzL3NhbmRib3gvZWxlY3Ryb24tc2FuZGJveC9wcmVsb2FkLWF1eC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbihmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgeyBpcGNSZW5kZXJlciwgd2ViRnJhbWUsIGNvbnRleHRCcmlkZ2UgfSA9IHJlcXVpcmUoJ2VsZWN0cm9uJyk7XG5cblx0ZnVuY3Rpb24gdmFsaWRhdGVJUEMoY2hhbm5lbDogc3RyaW5nKTogdHJ1ZSB8IG5ldmVyIHtcblx0XHRpZiAoIWNoYW5uZWwgfHwgIWNoYW5uZWwuc3RhcnRzV2l0aCgndnNjb2RlOicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGV2ZW50IElQQyBjaGFubmVsICcke2NoYW5uZWx9J2ApO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Y29uc3QgZ2xvYmFscyA9IHtcblxuXHRcdC8qKlxuXHRcdCAqIEEgbWluaW1hbCBzZXQgb2YgbWV0aG9kcyBleHBvc2VkIGZyb20gRWxlY3Ryb24ncyBgaXBjUmVuZGVyZXJgXG5cdFx0ICogdG8gc3VwcG9ydCBjb21tdW5pY2F0aW9uIHRvIG1haW4gcHJvY2Vzcy5cblx0XHQgKi9cblx0XHRpcGNSZW5kZXJlcjoge1xuXG5cdFx0XHRzZW5kKGNoYW5uZWw6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRcdFx0aWYgKHZhbGlkYXRlSVBDKGNoYW5uZWwpKSB7XG5cdFx0XHRcdFx0aXBjUmVuZGVyZXIuc2VuZChjaGFubmVsLCAuLi5hcmdzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0aW52b2tlKGNoYW5uZWw6IHN0cmluZywgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHR2YWxpZGF0ZUlQQyhjaGFubmVsKTtcblxuXHRcdFx0XHRyZXR1cm4gaXBjUmVuZGVyZXIuaW52b2tlKGNoYW5uZWwsIC4uLmFyZ3MpO1xuXHRcdFx0fVxuXHRcdH0sXG5cblx0XHQvKipcblx0XHQgKiBTdXBwb3J0IGZvciBzdWJzZXQgb2YgbWV0aG9kcyBvZiBFbGVjdHJvbidzIGB3ZWJGcmFtZWAgdHlwZS5cblx0XHQgKi9cblx0XHR3ZWJGcmFtZToge1xuXG5cdFx0XHRzZXRab29tTGV2ZWwobGV2ZWw6IG51bWJlcik6IHZvaWQge1xuXHRcdFx0XHRpZiAodHlwZW9mIGxldmVsID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdHdlYkZyYW1lLnNldFpvb21MZXZlbChsZXZlbCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0dHJ5IHtcblx0XHRjb250ZXh0QnJpZGdlLmV4cG9zZUluTWFpbldvcmxkKCd2c2NvZGUnLCBnbG9iYWxzKTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRjb25zb2xlLmVycm9yKGVycm9yKTtcblx0fVxufSgpKTtcbiJdLAogICJtYXBwaW5ncyI6ICJDQUtDLFdBQVk7QUFFWixRQUFNLEVBQUUsYUFBYSxVQUFVLGNBQWMsSUFBSSxRQUFRLFVBQVU7QUFFbkUsV0FBUyxZQUFZLFNBQStCO0FBQ25ELFFBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxXQUFXLFNBQVMsR0FBRztBQUMvQyxZQUFNLElBQUksTUFBTSxrQ0FBa0MsT0FBTyxHQUFHO0FBQUEsSUFDN0Q7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUVBLFFBQU0sVUFBVTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNZixhQUFhO0FBQUEsTUFFWixLQUFLLFlBQW9CLE1BQW1CO0FBQzNDLFlBQUksWUFBWSxPQUFPLEdBQUc7QUFDekIsc0JBQVksS0FBSyxTQUFTLEdBQUcsSUFBSTtBQUFBLFFBQ2xDO0FBQUEsTUFDRDtBQUFBLE1BRUEsT0FBTyxZQUFvQixNQUEyQjtBQUNyRCxvQkFBWSxPQUFPO0FBRW5CLGVBQU8sWUFBWSxPQUFPLFNBQVMsR0FBRyxJQUFJO0FBQUEsTUFDM0M7QUFBQSxJQUNEO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLQSxVQUFVO0FBQUEsTUFFVCxhQUFhLE9BQXFCO0FBQ2pDLFlBQUksT0FBTyxVQUFVLFVBQVU7QUFDOUIsbUJBQVMsYUFBYSxLQUFLO0FBQUEsUUFDNUI7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFFQSxNQUFJO0FBQ0gsa0JBQWMsa0JBQWtCLFVBQVUsT0FBTztBQUFBLEVBQ2xELFNBQVMsT0FBTztBQUNmLFlBQVEsTUFBTSxLQUFLO0FBQUEsRUFDcEI7QUFDRCxHQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
