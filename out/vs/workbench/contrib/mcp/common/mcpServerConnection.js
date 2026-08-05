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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { log } from "../../../../platform/log/common/log.js";
import { McpServerRequestHandler } from "./mcpServerRequestHandler.js";
import { McpConnectionState } from "./mcpTypes.js";
let McpServerConnection = class extends Disposable {
  constructor(_collection, definition, _delegate, launchDefinition, _logger, _instantiationService) {
    super();
    this._collection = _collection;
    this.definition = definition;
    this._delegate = _delegate;
    this.launchDefinition = launchDefinition;
    this._logger = _logger;
    this._instantiationService = _instantiationService;
    this._launch = this._register(new MutableDisposable());
    this._state = observableValue("mcpServerState", { state: McpConnectionState.Kind.Stopped });
    this._requestHandler = observableValue("mcpServerRequestHandler", void 0);
    this.state = this._state;
    this.handler = this._requestHandler;
  }
  /** @inheritdoc */
  async start() {
    const currentState = this._state.get();
    if (!McpConnectionState.canBeStarted(currentState.state)) {
      return this._waitForState(McpConnectionState.Kind.Running, McpConnectionState.Kind.Error);
    }
    this._launch.value = void 0;
    this._state.set({ state: McpConnectionState.Kind.Starting }, void 0);
    this._logger.info(localize("mcpServer.starting", "Starting server {0}", this.definition.label));
    try {
      const launch = this._delegate.start(this._collection, this.definition, this.launchDefinition);
      this._launch.value = this.adoptLaunch(launch);
      return this._waitForState(McpConnectionState.Kind.Running, McpConnectionState.Kind.Error);
    } catch (e) {
      const errorState = {
        state: McpConnectionState.Kind.Error,
        message: e instanceof Error ? e.message : String(e)
      };
      this._state.set(errorState, void 0);
      return errorState;
    }
  }
  adoptLaunch(launch) {
    const store = new DisposableStore();
    const cts = new CancellationTokenSource();
    store.add(toDisposable(() => cts.dispose(true)));
    store.add(launch);
    store.add(launch.onDidLog(({ level, message }) => {
      log(this._logger, level, message);
    }));
    let didStart = false;
    store.add(autorun((reader) => {
      const state = launch.state.read(reader);
      this._state.set(state, void 0);
      this._logger.info(localize("mcpServer.state", "Connection state: {0}", McpConnectionState.toString(state)));
      if (state.state === McpConnectionState.Kind.Running && !didStart) {
        didStart = true;
        McpServerRequestHandler.create(this._instantiationService, launch, this._logger, cts.token).then(
          (handler) => {
            if (!store.isDisposed) {
              this._requestHandler.set(handler, void 0);
            } else {
              handler.dispose();
            }
          },
          (err) => {
            store.dispose();
            if (!store.isDisposed) {
              this._logger.error(err);
              this._state.set({ state: McpConnectionState.Kind.Error, message: `Could not initialize MCP server: ${err.message}` }, void 0);
            }
          }
        );
      }
    }));
    return { dispose: () => store.dispose(), object: launch };
  }
  async stop() {
    this._logger.info(localize("mcpServer.stopping", "Stopping server {0}", this.definition.label));
    this._launch.value?.object.stop();
    await this._waitForState(McpConnectionState.Kind.Stopped, McpConnectionState.Kind.Error);
  }
  dispose() {
    this._requestHandler.get()?.dispose();
    super.dispose();
    this._state.set({ state: McpConnectionState.Kind.Stopped }, void 0);
  }
  _waitForState(...kinds) {
    const current = this._state.get();
    if (kinds.includes(current.state)) {
      return Promise.resolve(current);
    }
    return new Promise((resolve) => {
      const disposable = autorun((reader) => {
        const state = this._state.read(reader);
        if (kinds.includes(state.state)) {
          disposable.dispose();
          resolve(state);
        }
      });
    });
  }
};
McpServerConnection = __decorateClass([
  __decorateParam(5, IInstantiationService)
], McpServerConnection);
export {
  McpServerConnection
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcFNlcnZlckNvbm5lY3Rpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElSZWZlcmVuY2UsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgSU9ic2VydmFibGUsIG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nZ2VyLCBsb2cgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTWNwSG9zdERlbGVnYXRlLCBJTWNwTWVzc2FnZVRyYW5zcG9ydCB9IGZyb20gJy4vbWNwUmVnaXN0cnlUeXBlcy5qcyc7XG5pbXBvcnQgeyBNY3BTZXJ2ZXJSZXF1ZXN0SGFuZGxlciB9IGZyb20gJy4vbWNwU2VydmVyUmVxdWVzdEhhbmRsZXIuanMnO1xuaW1wb3J0IHsgSU1jcFNlcnZlckNvbm5lY3Rpb24sIE1jcENvbGxlY3Rpb25EZWZpbml0aW9uLCBNY3BDb25uZWN0aW9uU3RhdGUsIE1jcFNlcnZlckRlZmluaXRpb24sIE1jcFNlcnZlckxhdW5jaCB9IGZyb20gJy4vbWNwVHlwZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgTWNwU2VydmVyQ29ubmVjdGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTWNwU2VydmVyQ29ubmVjdGlvbiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xhdW5jaCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJUmVmZXJlbmNlPElNY3BNZXNzYWdlVHJhbnNwb3J0Pj4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRlID0gb2JzZXJ2YWJsZVZhbHVlPE1jcENvbm5lY3Rpb25TdGF0ZT4oJ21jcFNlcnZlclN0YXRlJywgeyBzdGF0ZTogTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuU3RvcHBlZCB9KTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVxdWVzdEhhbmRsZXIgPSBvYnNlcnZhYmxlVmFsdWU8TWNwU2VydmVyUmVxdWVzdEhhbmRsZXIgfCB1bmRlZmluZWQ+KCdtY3BTZXJ2ZXJSZXF1ZXN0SGFuZGxlcicsIHVuZGVmaW5lZCk7XG5cblx0cHVibGljIHJlYWRvbmx5IHN0YXRlOiBJT2JzZXJ2YWJsZTxNY3BDb25uZWN0aW9uU3RhdGU+ID0gdGhpcy5fc3RhdGU7XG5cdHB1YmxpYyByZWFkb25seSBoYW5kbGVyOiBJT2JzZXJ2YWJsZTxNY3BTZXJ2ZXJSZXF1ZXN0SGFuZGxlciB8IHVuZGVmaW5lZD4gPSB0aGlzLl9yZXF1ZXN0SGFuZGxlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb2xsZWN0aW9uOiBNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgZGVmaW5pdGlvbjogTWNwU2VydmVyRGVmaW5pdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kZWxlZ2F0ZTogSU1jcEhvc3REZWxlZ2F0ZSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGF1bmNoRGVmaW5pdGlvbjogTWNwU2VydmVyTGF1bmNoLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ2dlcjogSUxvZ2dlcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8TWNwQ29ubmVjdGlvblN0YXRlPiB7XG5cdFx0Y29uc3QgY3VycmVudFN0YXRlID0gdGhpcy5fc3RhdGUuZ2V0KCk7XG5cdFx0aWYgKCFNY3BDb25uZWN0aW9uU3RhdGUuY2FuQmVTdGFydGVkKGN1cnJlbnRTdGF0ZS5zdGF0ZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLl93YWl0Rm9yU3RhdGUoTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuUnVubmluZywgTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuRXJyb3IpO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xhdW5jaC52YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9zdGF0ZS5zZXQoeyBzdGF0ZTogTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuU3RhcnRpbmcgfSwgdW5kZWZpbmVkKTtcblx0XHR0aGlzLl9sb2dnZXIuaW5mbyhsb2NhbGl6ZSgnbWNwU2VydmVyLnN0YXJ0aW5nJywgJ1N0YXJ0aW5nIHNlcnZlciB7MH0nLCB0aGlzLmRlZmluaXRpb24ubGFiZWwpKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBsYXVuY2ggPSB0aGlzLl9kZWxlZ2F0ZS5zdGFydCh0aGlzLl9jb2xsZWN0aW9uLCB0aGlzLmRlZmluaXRpb24sIHRoaXMubGF1bmNoRGVmaW5pdGlvbik7XG5cdFx0XHR0aGlzLl9sYXVuY2gudmFsdWUgPSB0aGlzLmFkb3B0TGF1bmNoKGxhdW5jaCk7XG5cdFx0XHRyZXR1cm4gdGhpcy5fd2FpdEZvclN0YXRlKE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlJ1bm5pbmcsIE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLkVycm9yKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zdCBlcnJvclN0YXRlOiBNY3BDb25uZWN0aW9uU3RhdGUgPSB7XG5cdFx0XHRcdHN0YXRlOiBNY3BDb25uZWN0aW9uU3RhdGUuS2luZC5FcnJvcixcblx0XHRcdFx0bWVzc2FnZTogZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fc3RhdGUuc2V0KGVycm9yU3RhdGUsIHVuZGVmaW5lZCk7XG5cdFx0XHRyZXR1cm4gZXJyb3JTdGF0ZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFkb3B0TGF1bmNoKGxhdW5jaDogSU1jcE1lc3NhZ2VUcmFuc3BvcnQpOiBJUmVmZXJlbmNlPElNY3BNZXNzYWdlVHJhbnNwb3J0PiB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cdFx0c3RvcmUuYWRkKGxhdW5jaCk7XG5cdFx0c3RvcmUuYWRkKGxhdW5jaC5vbkRpZExvZygoeyBsZXZlbCwgbWVzc2FnZSB9KSA9PiB7XG5cdFx0XHRsb2codGhpcy5fbG9nZ2VyLCBsZXZlbCwgbWVzc2FnZSk7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGRpZFN0YXJ0ID0gZmFsc2U7XG5cdFx0c3RvcmUuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IHN0YXRlID0gbGF1bmNoLnN0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRcdHRoaXMuX3N0YXRlLnNldChzdGF0ZSwgdW5kZWZpbmVkKTtcblx0XHRcdHRoaXMuX2xvZ2dlci5pbmZvKGxvY2FsaXplKCdtY3BTZXJ2ZXIuc3RhdGUnLCAnQ29ubmVjdGlvbiBzdGF0ZTogezB9JywgTWNwQ29ubmVjdGlvblN0YXRlLnRvU3RyaW5nKHN0YXRlKSkpO1xuXG5cdFx0XHRpZiAoc3RhdGUuc3RhdGUgPT09IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlJ1bm5pbmcgJiYgIWRpZFN0YXJ0KSB7XG5cdFx0XHRcdGRpZFN0YXJ0ID0gdHJ1ZTtcblx0XHRcdFx0TWNwU2VydmVyUmVxdWVzdEhhbmRsZXIuY3JlYXRlKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLCBsYXVuY2gsIHRoaXMuX2xvZ2dlciwgY3RzLnRva2VuKS50aGVuKFxuXHRcdFx0XHRcdGhhbmRsZXIgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCFzdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3JlcXVlc3RIYW5kbGVyLnNldChoYW5kbGVyLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0aGFuZGxlci5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRlcnIgPT4ge1xuXHRcdFx0XHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0aWYgKCFzdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2xvZ2dlci5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zdGF0ZS5zZXQoeyBzdGF0ZTogTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuRXJyb3IsIG1lc3NhZ2U6IGBDb3VsZCBub3QgaW5pdGlhbGl6ZSBNQ1Agc2VydmVyOiAke2Vyci5tZXNzYWdlfWAgfSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiB7IGRpc3Bvc2U6ICgpID0+IHN0b3JlLmRpc3Bvc2UoKSwgb2JqZWN0OiBsYXVuY2ggfTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX2xvZ2dlci5pbmZvKGxvY2FsaXplKCdtY3BTZXJ2ZXIuc3RvcHBpbmcnLCAnU3RvcHBpbmcgc2VydmVyIHswfScsIHRoaXMuZGVmaW5pdGlvbi5sYWJlbCkpO1xuXHRcdHRoaXMuX2xhdW5jaC52YWx1ZT8ub2JqZWN0LnN0b3AoKTtcblx0XHRhd2FpdCB0aGlzLl93YWl0Rm9yU3RhdGUoTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuU3RvcHBlZCwgTWNwQ29ubmVjdGlvblN0YXRlLktpbmQuRXJyb3IpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVxdWVzdEhhbmRsZXIuZ2V0KCk/LmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fc3RhdGUuc2V0KHsgc3RhdGU6IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLlN0b3BwZWQgfSwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgX3dhaXRGb3JTdGF0ZSguLi5raW5kczogTWNwQ29ubmVjdGlvblN0YXRlLktpbmRbXSk6IFByb21pc2U8TWNwQ29ubmVjdGlvblN0YXRlPiB7XG5cdFx0Y29uc3QgY3VycmVudCA9IHRoaXMuX3N0YXRlLmdldCgpO1xuXHRcdGlmIChraW5kcy5pbmNsdWRlcyhjdXJyZW50LnN0YXRlKSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShjdXJyZW50KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3N0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRcdFx0aWYgKGtpbmRzLmluY2x1ZGVzKHN0YXRlLnN0YXRlKSkge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJlc29sdmUoc3RhdGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLFlBQVksaUJBQTZCLG1CQUFtQixvQkFBb0I7QUFDekYsU0FBUyxTQUFzQix1QkFBdUI7QUFDdEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBa0IsV0FBVztBQUU3QixTQUFTLCtCQUErQjtBQUN4QyxTQUF3RCwwQkFBZ0U7QUFFakgsSUFBTSxzQkFBTixjQUFrQyxXQUEyQztBQUFBLEVBUW5GLFlBQ2tCLGFBQ0QsWUFDQyxXQUNELGtCQUNDLFNBQ3VCLHVCQUN2QztBQUNELFVBQU07QUFQVztBQUNEO0FBQ0M7QUFDRDtBQUNDO0FBQ3VCO0FBYnpDLFNBQWlCLFVBQVUsS0FBSyxVQUFVLElBQUksa0JBQW9ELENBQUM7QUFDbkcsU0FBaUIsU0FBUyxnQkFBb0Msa0JBQWtCLEVBQUUsT0FBTyxtQkFBbUIsS0FBSyxRQUFRLENBQUM7QUFDMUgsU0FBaUIsa0JBQWtCLGdCQUFxRCwyQkFBMkIsTUFB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
