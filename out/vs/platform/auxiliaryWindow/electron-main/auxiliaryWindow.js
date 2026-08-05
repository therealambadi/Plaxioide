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
import { BrowserWindow } from "electron";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { IStateService } from "../../state/node/state.js";
import { hasNativeTitlebar, TitlebarStyle } from "../../window/common/window.js";
import { WindowMode } from "../../window/electron-main/window.js";
import { BaseWindow } from "../../windows/electron-main/windowImpl.js";
let AuxiliaryWindow = class extends BaseWindow {
  constructor(webContents, environmentMainService, logService, configurationService, stateService, lifecycleMainService) {
    super(configurationService, stateService, environmentMainService, logService);
    this.webContents = webContents;
    this.lifecycleMainService = lifecycleMainService;
    this.parentId = -1;
    this.stateApplied = false;
    this.id = this.webContents.id;
    this.tryClaimWindow();
  }
  get win() {
    if (!super.win) {
      this.tryClaimWindow();
    }
    return super.win;
  }
  tryClaimWindow(options) {
    if (this._store.isDisposed || this.webContents.isDestroyed()) {
      return;
    }
    this.doTryClaimWindow(options);
    if (options && !this.stateApplied) {
      this.stateApplied = true;
      this.applyState({
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height,
        // We currently do not support restoring fullscreen state for auxiliary
        // windows because we do not get hold of the original `features` string
        // that contains that info in `window-fullscreen`. However, we can
        // probe the `options.show` value for whether the window should be maximized
        // or not because we never show maximized windows initially to reduce flicker.
        mode: options.show === false ? WindowMode.Maximized : WindowMode.Normal
      });
    }
  }
  doTryClaimWindow(options) {
    if (this._win) {
      return;
    }
    const window = BrowserWindow.fromWebContents(this.webContents);
    if (window) {
      this.logService.trace("[aux window] Claimed browser window instance");
      this.setWin(window, options);
      window.setMenu(null);
      if ((isWindows || isLinux) && hasNativeTitlebar(
        this.configurationService,
        options?.titleBarStyle === "hidden" ? TitlebarStyle.CUSTOM : void 0
        /* unknown */
      )) {
        window.setAutoHideMenuBar(true);
      }
      this.lifecycleMainService.registerAuxWindow(this);
    }
  }
  matches(webContents) {
    return this.webContents.id === webContents.id;
  }
};
AuxiliaryWindow = __decorateClass([
  __decorateParam(1, IEnvironmentMainService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IStateService),
  __decorateParam(5, ILifecycleMainService)
], AuxiliaryWindow);
export {
  AuxiliaryWindow
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9hdXhpbGlhcnlXaW5kb3cvZWxlY3Ryb24tbWFpbi9hdXhpbGlhcnlXaW5kb3cudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBCcm93c2VyV2luZG93LCBCcm93c2VyV2luZG93Q29uc3RydWN0b3JPcHRpb25zLCBXZWJDb250ZW50cyB9IGZyb20gJ2VsZWN0cm9uJztcbmltcG9ydCB7IGlzTGludXgsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50TWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9lbGVjdHJvbi1tYWluL2Vudmlyb25tZW50TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZU1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2VsZWN0cm9uLW1haW4vbGlmZWN5Y2xlTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc3RhdGUvbm9kZS9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBoYXNOYXRpdmVUaXRsZWJhciwgVGl0bGViYXJTdHlsZSB9IGZyb20gJy4uLy4uL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IElCYXNlV2luZG93LCBXaW5kb3dNb2RlIH0gZnJvbSAnLi4vLi4vd2luZG93L2VsZWN0cm9uLW1haW4vd2luZG93LmpzJztcbmltcG9ydCB7IEJhc2VXaW5kb3cgfSBmcm9tICcuLi8uLi93aW5kb3dzL2VsZWN0cm9uLW1haW4vd2luZG93SW1wbC5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUF1eGlsaWFyeVdpbmRvdyBleHRlbmRzIElCYXNlV2luZG93IHtcblx0cmVhZG9ubHkgcGFyZW50SWQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIEF1eGlsaWFyeVdpbmRvdyBleHRlbmRzIEJhc2VXaW5kb3cgaW1wbGVtZW50cyBJQXV4aWxpYXJ5V2luZG93IHtcblxuXHRyZWFkb25seSBpZDogbnVtYmVyO1xuXHRwYXJlbnRJZCA9IC0xO1xuXG5cdG92ZXJyaWRlIGdldCB3aW4oKSB7XG5cdFx0aWYgKCFzdXBlci53aW4pIHtcblx0XHRcdHRoaXMudHJ5Q2xhaW1XaW5kb3coKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3VwZXIud2luO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0ZUFwcGxpZWQgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHdlYkNvbnRlbnRzOiBXZWJDb250ZW50cyxcblx0XHRASUVudmlyb25tZW50TWFpblNlcnZpY2UgZW52aXJvbm1lbnRNYWluU2VydmljZTogSUVudmlyb25tZW50TWFpblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVN0YXRlU2VydmljZSBzdGF0ZVNlcnZpY2U6IElTdGF0ZVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZU1haW5TZXJ2aWNlOiBJTGlmZWN5Y2xlTWFpblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoY29uZmlndXJhdGlvblNlcnZpY2UsIHN0YXRlU2VydmljZSwgZW52aXJvbm1lbnRNYWluU2VydmljZSwgbG9nU2VydmljZSk7XG5cblx0XHR0aGlzLmlkID0gdGhpcy53ZWJDb250ZW50cy5pZDtcblxuXHRcdC8vIFRyeSB0byBjbGFpbSB3aW5kb3dcblx0XHR0aGlzLnRyeUNsYWltV2luZG93KCk7XG5cdH1cblxuXHR0cnlDbGFpbVdpbmRvdyhvcHRpb25zPzogQnJvd3NlcldpbmRvd0NvbnN0cnVjdG9yT3B0aW9ucyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkIHx8IHRoaXMud2ViQ29udGVudHMuaXNEZXN0cm95ZWQoKSkge1xuXHRcdFx0cmV0dXJuOyAvLyBhbHJlYWR5IGRpc3Bvc2VkXG5cdFx0fVxuXG5cdFx0dGhpcy5kb1RyeUNsYWltV2luZG93KG9wdGlvbnMpO1xuXG5cdFx0aWYgKG9wdGlvbnMgJiYgIXRoaXMuc3RhdGVBcHBsaWVkKSB7XG5cdFx0XHR0aGlzLnN0YXRlQXBwbGllZCA9IHRydWU7XG5cblx0XHRcdHRoaXMuYXBwbHlTdGF0ZSh7XG5cdFx0XHRcdHg6IG9wdGlvbnMueCxcblx0XHRcdFx0eTogb3B0aW9ucy55LFxuXHRcdFx0XHR3aWR0aDogb3B0aW9ucy53aWR0aCxcblx0XHRcdFx0aGVpZ2h0OiBvcHRpb25zLmhlaWdodCxcblx0XHRcdFx0Ly8gV2UgY3VycmVudGx5IGRvIG5vdCBzdXBwb3J0IHJlc3RvcmluZyBmdWxsc2NyZWVuIHN0YXRlIGZvciBhdXhpbGlhcnlcblx0XHRcdFx0Ly8gd2luZG93cyBiZWNhdXNlIHdlIGRvIG5vdCBnZXQgaG9sZCBvZiB0aGUgb3JpZ2luYWwgYGZlYXR1cmVzYCBzdHJpbmdcblx0XHRcdFx0Ly8gdGhhdCBjb250YWlucyB0aGF0IGluZm8gaW4gYHdpbmRvdy1mdWxsc2NyZWVuYC4gSG93ZXZlciwgd2UgY2FuXG5cdFx0XHRcdC8vIHByb2JlIHRoZSBgb3B0aW9ucy5zaG93YCB2YWx1ZSBmb3Igd2hldGhlciB0aGUgd2luZG93IHNob3VsZCBiZSBtYXhpbWl6ZWRcblx0XHRcdFx0Ly8gb3Igbm90IGJlY2F1c2Ugd2UgbmV2ZXIgc2hvdyBtYXhpbWl6ZWQgd2luZG93cyBpbml0aWFsbHkgdG8gcmVkdWNlIGZsaWNrZXIuXG5cdFx0XHRcdG1vZGU6IG9wdGlvbnMuc2hvdyA9PT0gZmFsc2UgPyBXaW5kb3dNb2RlLk1heGltaXplZCA6IFdpbmRvd01vZGUuTm9ybWFsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvVHJ5Q2xhaW1XaW5kb3cob3B0aW9ucz86IEJyb3dzZXJXaW5kb3dDb25zdHJ1Y3Rvck9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fd2luKSB7XG5cdFx0XHRyZXR1cm47IC8vIGFscmVhZHkgY2xhaW1lZFxuXHRcdH1cblxuXHRcdGNvbnN0IHdpbmRvdyA9IEJyb3dzZXJXaW5kb3cuZnJvbVdlYkNvbnRlbnRzKHRoaXMud2ViQ29udGVudHMpO1xuXHRcdGlmICh3aW5kb3cpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW2F1eCB3aW5kb3ddIENsYWltZWQgYnJvd3NlciB3aW5kb3cgaW5zdGFuY2UnKTtcblxuXHRcdFx0Ly8gUmVtZW1iZXJcblx0XHRcdHRoaXMuc2V0V2luKHdpbmRvdywgb3B0aW9ucyk7XG5cblx0XHRcdC8vIERpc2FibGUgTWVudVxuXHRcdFx0d2luZG93LnNldE1lbnUobnVsbCk7XG5cdFx0XHRpZiAoKGlzV2luZG93cyB8fCBpc0xpbnV4KSAmJiBoYXNOYXRpdmVUaXRsZWJhcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBvcHRpb25zPy50aXRsZUJhclN0eWxlID09PSAnaGlkZGVuJyA/IFRpdGxlYmFyU3R5bGUuQ1VTVE9NIDogdW5kZWZpbmVkIC8qIHVua25vd24gKi8pKSB7XG5cdFx0XHRcdHdpbmRvdy5zZXRBdXRvSGlkZU1lbnVCYXIodHJ1ZSk7IC8vIEZpeCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwMDYxNVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBMaWZlY3ljbGVcblx0XHRcdHRoaXMubGlmZWN5Y2xlTWFpblNlcnZpY2UucmVnaXN0ZXJBdXhXaW5kb3codGhpcyk7XG5cdFx0fVxuXHR9XG5cblx0bWF0Y2hlcyh3ZWJDb250ZW50czogV2ViQ29udGVudHMpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy53ZWJDb250ZW50cy5pZCA9PT0gd2ViQ29udGVudHMuaWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxxQkFBbUU7QUFDNUUsU0FBUyxTQUFTLGlCQUFpQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG1CQUFtQixxQkFBcUI7QUFDakQsU0FBc0Isa0JBQWtCO0FBQ3hDLFNBQVMsa0JBQWtCO0FBTXBCLElBQU0sa0JBQU4sY0FBOEIsV0FBdUM7QUFBQSxFQWUzRSxZQUNrQixhQUNRLHdCQUNaLFlBQ1Usc0JBQ1IsY0FDeUIsc0JBQ3ZDO0FBQ0QsVUFBTSxzQkFBc0IsY0FBYyx3QkFBd0IsVUFBVTtBQVAzRDtBQUt1QjtBQWxCekMsb0JBQVc7QUFVWCxTQUFRLGVBQWU7QUFZdEIsU0FBSyxLQUFLLEtBQUssWUFBWTtBQUczQixTQUFLLGVBQWU7QUFBQSxFQUNyQjtBQUFBLEVBeEJBLElBQWEsTUFBTTtBQUNsQixRQUFJLENBQUMsTUFBTSxLQUFLO0FBQ2YsV0FBSyxlQUFlO0FBQUEsSUFDckI7QUFFQSxXQUFPLE1BQU07QUFBQSxFQUNkO0FBQUEsRUFvQkEsZUFBZSxTQUFpRDtBQUMvRCxRQUFJLEtBQUssT0FBTyxjQUFjLEtBQUssWUFBWSxZQUFZLEdBQUc7QUFDN0Q7QUFBQSxJQUNEO0FBRUEsU0FBSyxpQkFBaUIsT0FBTztBQUU3QixRQUFJLFdBQVcsQ0FBQyxLQUFLLGNBQWM7QUFDbEMsV0FBSyxlQUFlO0FBRXBCLFdBQUssV0FBVztBQUFBLFFBQ2YsR0FBRyxRQUFRO0FBQUEsUUFDWCxHQUFHLFFBQVE7QUFBQSxRQUNYLE9BQU8sUUFBUTtBQUFBLFFBQ2YsUUFBUSxRQUFRO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBTWhCLE1BQU0sUUFBUSxTQUFTLFFBQVEsV0FBVyxZQUFZLFdBQVc7QUFBQSxNQUNsRSxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGlCQUFpQixTQUFpRDtBQUN6RSxRQUFJLEtBQUssTUFBTTtBQUNkO0FBQUEsSUFDRDtBQUVBLFVBQU0sU0FBUyxjQUFjLGdCQUFnQixLQUFLLFdBQVc7QUFDN0QsUUFBSSxRQUFRO0FBQ1gsV0FBSyxXQUFXLE1BQU0sOENBQThDO0FBR3BFLFdBQUssT0FBTyxRQUFRLE9BQU87QUFHM0IsYUFBTyxRQUFRLElBQUk7QUFDbkIsV0FBSyxhQUFhLFlBQVk7QUFBQSxRQUFrQixLQUFLO0FBQUEsUUFBc0IsU0FBUyxrQkFBa0IsV0FBVyxjQUFjLFNBQVM7QUFBQTtBQUFBLE1BQXVCLEdBQUc7QUFDakssZUFBTyxtQkFBbUIsSUFBSTtBQUFBLE1BQy9CO0FBR0EsV0FBSyxxQkFBcUIsa0JBQWtCLElBQUk7QUFBQSxJQUNqRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFFBQVEsYUFBbUM7QUFDMUMsV0FBTyxLQUFLLFlBQVksT0FBTyxZQUFZO0FBQUEsRUFDNUM7QUFDRDtBQWxGYSxrQkFBTjtBQUFBLEVBaUJKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBckJVOyIsCiAgIm5hbWVzIjogW10KfQo=
