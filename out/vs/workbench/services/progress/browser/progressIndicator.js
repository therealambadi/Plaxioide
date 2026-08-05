import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { emptyProgressRunner } from "../../../../platform/progress/common/progress.js";
import { GroupModelChangeKind } from "../../../common/editor.js";
class EditorProgressIndicator extends Disposable {
  constructor(progressBar, group) {
    super();
    this.progressBar = progressBar;
    this.group = group;
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.group.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_ACTIVE || e.kind === GroupModelChangeKind.EDITOR_CLOSE && this.group.isEmpty) {
        this.progressBar.stop().hide();
      }
    }));
  }
  show(infiniteOrTotal, delay) {
    if (this.group.isEmpty) {
      return emptyProgressRunner;
    }
    if (infiniteOrTotal === true) {
      return this.doShow(true, delay);
    }
    return this.doShow(infiniteOrTotal, delay);
  }
  doShow(infiniteOrTotal, delay) {
    if (typeof infiniteOrTotal === "boolean") {
      this.progressBar.infinite().show(delay);
    } else {
      this.progressBar.total(infiniteOrTotal).show(delay);
    }
    return {
      total: (total) => {
        this.progressBar.total(total);
      },
      worked: (worked) => {
        if (this.progressBar.hasTotal()) {
          this.progressBar.worked(worked);
        } else {
          this.progressBar.infinite().show();
        }
      },
      done: () => {
        this.progressBar.stop().hide();
      }
    };
  }
  async showWhile(promise, delay) {
    if (this.group.isEmpty) {
      try {
        await promise;
      } catch (error) {
      }
    }
    return this.doShowWhile(promise, delay);
  }
  async doShowWhile(promise, delay) {
    try {
      this.progressBar.infinite().show(delay);
      await promise;
    } catch (error) {
    } finally {
      this.progressBar.stop().hide();
    }
  }
}
var ProgressIndicatorState;
((ProgressIndicatorState2) => {
  let Type;
  ((Type2) => {
    Type2[Type2["None"] = 0] = "None";
    Type2[Type2["Done"] = 1] = "Done";
    Type2[Type2["Infinite"] = 2] = "Infinite";
    Type2[Type2["While"] = 3] = "While";
    Type2[Type2["Work"] = 4] = "Work";
  })(Type = ProgressIndicatorState2.Type || (ProgressIndicatorState2.Type = {}));
  ProgressIndicatorState2.None = { type: 0 /* None */ };
  ProgressIndicatorState2.Done = { type: 1 /* Done */ };
  ProgressIndicatorState2.Infinite = { type: 2 /* Infinite */ };
  class While {
    constructor(whilePromise, whileStart, whileDelay) {
      this.whilePromise = whilePromise;
      this.whileStart = whileStart;
      this.whileDelay = whileDelay;
      this.type = 3 /* While */;
    }
  }
  ProgressIndicatorState2.While = While;
  class Work {
    constructor(total, worked) {
      this.total = total;
      this.worked = worked;
      this.type = 4 /* Work */;
    }
  }
  ProgressIndicatorState2.Work = Work;
})(ProgressIndicatorState || (ProgressIndicatorState = {}));
class ScopedProgressIndicator extends Disposable {
  constructor(progressBar, scope) {
    super();
    this.progressBar = progressBar;
    this.scope = scope;
    this.progressState = ProgressIndicatorState.None;
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.scope.onDidChangeActive(() => {
      if (this.scope.isActive) {
        this.onDidScopeActivate();
      } else {
        this.onDidScopeDeactivate();
      }
    }));
  }
  onDidScopeActivate() {
    if (this.progressState.type === ProgressIndicatorState.Done.type) {
      return;
    }
    if (this.progressState.type === 3 /* While */) {
      let delay;
      if (this.progressState.whileDelay > 0) {
        const remainingDelay = this.progressState.whileDelay - (Date.now() - this.progressState.whileStart);
        if (remainingDelay > 0) {
          delay = remainingDelay;
        }
      }
      this.doShowWhile(delay);
    } else if (this.progressState.type === 2 /* Infinite */) {
      this.progressBar.infinite().show();
    } else if (this.progressState.type === 4 /* Work */) {
      if (this.progressState.total) {
        this.progressBar.total(this.progressState.total).show();
      }
      if (this.progressState.worked) {
        this.progressBar.worked(this.progressState.worked).show();
      }
    }
  }
  onDidScopeDeactivate() {
    this.progressBar.stop().hide();
  }
  show(infiniteOrTotal, delay) {
    if (typeof infiniteOrTotal === "boolean") {
      this.progressState = ProgressIndicatorState.Infinite;
    } else {
      this.progressState = new ProgressIndicatorState.Work(infiniteOrTotal, void 0);
    }
    if (this.scope.isActive) {
      if (this.progressState.type === 2 /* Infinite */) {
        this.progressBar.infinite().show(delay);
      } else if (this.progressState.type === 4 /* Work */ && typeof this.progressState.total === "number") {
        this.progressBar.total(this.progressState.total).show(delay);
      }
    }
    return {
      total: (total) => {
        this.progressState = new ProgressIndicatorState.Work(
          total,
          this.progressState.type === 4 /* Work */ ? this.progressState.worked : void 0
        );
        if (this.scope.isActive) {
          this.progressBar.total(total);
        }
      },
      worked: (worked) => {
        if (!this.scope.isActive || this.progressBar.hasTotal()) {
          this.progressState = new ProgressIndicatorState.Work(
            this.progressState.type === 4 /* Work */ ? this.progressState.total : void 0,
            this.progressState.type === 4 /* Work */ && typeof this.progressState.worked === "number" ? this.progressState.worked + worked : worked
          );
          if (this.scope.isActive) {
            this.progressBar.worked(worked);
          }
        } else {
          this.progressState = ProgressIndicatorState.Infinite;
          this.progressBar.infinite().show();
        }
      },
      done: () => {
        this.progressState = ProgressIndicatorState.Done;
        if (this.scope.isActive) {
          this.progressBar.stop().hide();
        }
      }
    };
  }
  async showWhile(promise, delay) {
    if (this.progressState.type === 3 /* While */) {
      promise = Promise.allSettled([promise, this.progressState.whilePromise]);
    }
    this.progressState = new ProgressIndicatorState.While(promise, delay || 0, Date.now());
    try {
      this.doShowWhile(delay);
      await promise;
    } catch (error) {
    } finally {
      if (this.progressState.type !== 3 /* While */ || this.progressState.whilePromise === promise) {
        this.progressState = ProgressIndicatorState.None;
        if (this.scope.isActive) {
          this.progressBar.stop().hide();
        }
      }
    }
  }
  doShowWhile(delay) {
    if (this.scope.isActive) {
      this.progressBar.infinite().show(delay);
    }
  }
}
class AbstractProgressScope extends Disposable {
  constructor(scopeId, _isActive) {
    super();
    this.scopeId = scopeId;
    this._isActive = _isActive;
    this._onDidChangeActive = this._register(new Emitter());
    this.onDidChangeActive = this._onDidChangeActive.event;
  }
  get isActive() {
    return this._isActive;
  }
  onScopeOpened(scopeId) {
    if (scopeId === this.scopeId) {
      if (!this._isActive) {
        this._isActive = true;
        this._onDidChangeActive.fire();
      }
    }
  }
  onScopeClosed(scopeId) {
    if (scopeId === this.scopeId) {
      if (this._isActive) {
        this._isActive = false;
        this._onDidChangeActive.fire();
      }
    }
  }
}
export {
  AbstractProgressScope,
  EditorProgressIndicator,
  ScopedProgressIndicator
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcHJvZ3Jlc3MvYnJvd3Nlci9wcm9ncmVzc0luZGljYXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzc0JhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9wcm9ncmVzc2Jhci9wcm9ncmVzc2Jhci5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NSdW5uZXIsIElQcm9ncmVzc0luZGljYXRvciwgZW1wdHlQcm9ncmVzc1J1bm5lciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBWaWV3IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yLmpzJztcbmltcG9ydCB7IEdyb3VwTW9kZWxDaGFuZ2VLaW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBFZGl0b3JQcm9ncmVzc0luZGljYXRvciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJUHJvZ3Jlc3NJbmRpY2F0b3Ige1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NCYXI6IFByb2dyZXNzQmFyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZ3JvdXA6IElFZGl0b3JHcm91cFZpZXdcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG5cblx0XHQvLyBTdG9wIGFueSBydW5uaW5nIHByb2dyZXNzIHdoZW4gdGhlIGFjdGl2ZSBlZGl0b3IgY2hhbmdlcyBvclxuXHRcdC8vIHRoZSBncm91cCBiZWNvbWVzIGVtcHR5LlxuXHRcdC8vIEluIGNvbnRyYXN0IHRvIHRoZSBjb21wb3NpdGUgcHJvZ3Jlc3MgaW5kaWNhdG9yLCB3ZSBkbyBub3Rcblx0XHQvLyB0cmFjayBhY3RpdmUgZWRpdG9yIHByb2dyZXNzIGFuZCByZXBsYXkgaXQgbGF0ZXIgKHlldCkuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ncm91cC5vbkRpZE1vZGVsQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHRlLmtpbmQgPT09IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9BQ1RJVkUgfHxcblx0XHRcdFx0KGUua2luZCA9PT0gR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0NMT1NFICYmIHRoaXMuZ3JvdXAuaXNFbXB0eSlcblx0XHRcdCkge1xuXHRcdFx0XHR0aGlzLnByb2dyZXNzQmFyLnN0b3AoKS5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0c2hvdyhpbmZpbml0ZTogdHJ1ZSwgZGVsYXk/OiBudW1iZXIpOiBJUHJvZ3Jlc3NSdW5uZXI7XG5cdHNob3codG90YWw6IG51bWJlciwgZGVsYXk/OiBudW1iZXIpOiBJUHJvZ3Jlc3NSdW5uZXI7XG5cdHNob3coaW5maW5pdGVPclRvdGFsOiB0cnVlIHwgbnVtYmVyLCBkZWxheT86IG51bWJlcik6IElQcm9ncmVzc1J1bm5lciB7XG5cblx0XHQvLyBObyBlZGl0b3Igb3BlbjogaWdub3JlIGFueSBwcm9ncmVzcyByZXBvcnRpbmdcblx0XHRpZiAodGhpcy5ncm91cC5pc0VtcHR5KSB7XG5cdFx0XHRyZXR1cm4gZW1wdHlQcm9ncmVzc1J1bm5lcjtcblx0XHR9XG5cblx0XHRpZiAoaW5maW5pdGVPclRvdGFsID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb1Nob3codHJ1ZSwgZGVsYXkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRvU2hvdyhpbmZpbml0ZU9yVG90YWwsIGRlbGF5KTtcblx0fVxuXG5cdHByaXZhdGUgZG9TaG93KGluZmluaXRlOiB0cnVlLCBkZWxheT86IG51bWJlcik6IElQcm9ncmVzc1J1bm5lcjtcblx0cHJpdmF0ZSBkb1Nob3codG90YWw6IG51bWJlciwgZGVsYXk/OiBudW1iZXIpOiBJUHJvZ3Jlc3NSdW5uZXI7XG5cdHByaXZhdGUgZG9TaG93KGluZmluaXRlT3JUb3RhbDogdHJ1ZSB8IG51bWJlciwgZGVsYXk/OiBudW1iZXIpOiBJUHJvZ3Jlc3NSdW5uZXIge1xuXHRcdGlmICh0eXBlb2YgaW5maW5pdGVPclRvdGFsID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHRoaXMucHJvZ3Jlc3NCYXIuaW5maW5pdGUoKS5zaG93KGRlbGF5KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5wcm9ncmVzc0Jhci50b3RhbChpbmZpbml0ZU9yVG90YWwpLnNob3coZGVsYXkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR0b3RhbDogKHRvdGFsOiBudW1iZXIpID0+IHtcblx0XHRcdFx0dGhpcy5wcm9ncmVzc0Jhci50b3RhbCh0b3RhbCk7XG5cdFx0XHR9LFxuXG5cdFx0XHR3b3JrZWQ6ICh3b3JrZWQ6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5wcm9ncmVzc0Jhci5oYXNUb3RhbCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9ncmVzc0Jhci53b3JrZWQod29ya2VkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnByb2dyZXNzQmFyLmluZmluaXRlKCkuc2hvdygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRkb25lOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NCYXIuc3RvcCgpLmhpZGUoKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgc2hvd1doaWxlKHByb21pc2U6IFByb21pc2U8dW5rbm93bj4sIGRlbGF5PzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBObyBlZGl0b3Igb3BlbjogaWdub3JlIGFueSBwcm9ncmVzcyByZXBvcnRpbmdcblx0XHRpZiAodGhpcy5ncm91cC5pc0VtcHR5KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBwcm9taXNlO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0Ly8gaWdub3JlXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZG9TaG93V2hpbGUocHJvbWlzZSwgZGVsYXkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Nob3dXaGlsZShwcm9taXNlOiBQcm9taXNlPHVua25vd24+LCBkZWxheT86IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLnByb2dyZXNzQmFyLmluZmluaXRlKCkuc2hvdyhkZWxheSk7XG5cblx0XHRcdGF3YWl0IHByb21pc2U7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIGlnbm9yZVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnByb2dyZXNzQmFyLnN0b3AoKS5oaWRlKCk7XG5cdFx0fVxuXHR9XG59XG5cbm5hbWVzcGFjZSBQcm9ncmVzc0luZGljYXRvclN0YXRlIHtcblxuXHRleHBvcnQgY29uc3QgZW51bSBUeXBlIHtcblx0XHROb25lLFxuXHRcdERvbmUsXG5cdFx0SW5maW5pdGUsXG5cdFx0V2hpbGUsXG5cdFx0V29ya1xuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IE5vbmUgPSB7IHR5cGU6IFR5cGUuTm9uZSB9IGFzIGNvbnN0O1xuXHRleHBvcnQgY29uc3QgRG9uZSA9IHsgdHlwZTogVHlwZS5Eb25lIH0gYXMgY29uc3Q7XG5cdGV4cG9ydCBjb25zdCBJbmZpbml0ZSA9IHsgdHlwZTogVHlwZS5JbmZpbml0ZSB9IGFzIGNvbnN0O1xuXG5cdGV4cG9ydCBjbGFzcyBXaGlsZSB7XG5cblx0XHRyZWFkb25seSB0eXBlID0gVHlwZS5XaGlsZTtcblxuXHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0cmVhZG9ubHkgd2hpbGVQcm9taXNlOiBQcm9taXNlPHVua25vd24+LFxuXHRcdFx0cmVhZG9ubHkgd2hpbGVTdGFydDogbnVtYmVyLFxuXHRcdFx0cmVhZG9ubHkgd2hpbGVEZWxheTogbnVtYmVyLFxuXHRcdCkgeyB9XG5cdH1cblxuXHRleHBvcnQgY2xhc3MgV29yayB7XG5cblx0XHRyZWFkb25seSB0eXBlID0gVHlwZS5Xb3JrO1xuXG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRyZWFkb25seSB0b3RhbDogbnVtYmVyIHwgdW5kZWZpbmVkLFxuXHRcdFx0cmVhZG9ubHkgd29ya2VkOiBudW1iZXIgfCB1bmRlZmluZWRcblx0XHQpIHsgfVxuXHR9XG5cblx0ZXhwb3J0IHR5cGUgU3RhdGUgPVxuXHRcdHR5cGVvZiBOb25lXG5cdFx0fCB0eXBlb2YgRG9uZVxuXHRcdHwgdHlwZW9mIEluZmluaXRlXG5cdFx0fCBXaGlsZVxuXHRcdHwgV29yaztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJvZ3Jlc3NTY29wZSB7XG5cblx0LyoqXG5cdCAqIEZpcmVkIHdoZW5ldmVyIGBpc0FjdGl2ZWAgdmFsdWUgY2hhbmdlZC5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQWN0aXZlOiBFdmVudDx2b2lkPjtcblxuXHQvKipcblx0ICogV2hldGhlciBwcm9ncmVzcyBzaG91bGQgYmUgYWN0aXZlIG9yIG5vdC5cblx0ICovXG5cdHJlYWRvbmx5IGlzQWN0aXZlOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgU2NvcGVkUHJvZ3Jlc3NJbmRpY2F0b3IgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVByb2dyZXNzSW5kaWNhdG9yIHtcblxuXHRwcml2YXRlIHByb2dyZXNzU3RhdGU6IFByb2dyZXNzSW5kaWNhdG9yU3RhdGUuU3RhdGUgPSBQcm9ncmVzc0luZGljYXRvclN0YXRlLk5vbmU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwcm9ncmVzc0JhcjogUHJvZ3Jlc3NCYXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzY29wZTogSVByb2dyZXNzU2NvcGVcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHJlZ2lzdGVyTGlzdGVuZXJzKCkge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2NvcGUub25EaWRDaGFuZ2VBY3RpdmUoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuc2NvcGUuaXNBY3RpdmUpIHtcblx0XHRcdFx0dGhpcy5vbkRpZFNjb3BlQWN0aXZhdGUoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMub25EaWRTY29wZURlYWN0aXZhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkU2NvcGVBY3RpdmF0ZSgpOiB2b2lkIHtcblxuXHRcdC8vIFJldHVybiBlYXJseSBpZiBwcm9ncmVzcyBzdGF0ZSBpbmRpY2F0ZXMgdGhhdCBwcm9ncmVzcyBpcyBkb25lXG5cdFx0aWYgKHRoaXMucHJvZ3Jlc3NTdGF0ZS50eXBlID09PSBQcm9ncmVzc0luZGljYXRvclN0YXRlLkRvbmUudHlwZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJlcGxheSBJbmZpbml0ZSBQcm9ncmVzcyBmcm9tIFByb21pc2Vcblx0XHRpZiAodGhpcy5wcm9ncmVzc1N0YXRlLnR5cGUgPT09IFByb2dyZXNzSW5kaWNhdG9yU3RhdGUuVHlwZS5XaGlsZSkge1xuXHRcdFx0bGV0IGRlbGF5OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGhpcy5wcm9ncmVzc1N0YXRlLndoaWxlRGVsYXkgPiAwKSB7XG5cdFx0XHRcdGNvbnN0IHJlbWFpbmluZ0RlbGF5ID0gdGhpcy5wcm9ncmVzc1N0YXRlLndoaWxlRGVsYXkgLSAoRGF0ZS5ub3coKSAtIHRoaXMucHJvZ3Jlc3NTdGF0ZS53aGlsZVN0YXJ0KTtcblx0XHRcdFx0aWYgKHJlbWFpbmluZ0RlbGF5ID4gMCkge1xuXHRcdFx0XHRcdGRlbGF5ID0gcmVtYWluaW5nRGVsYXk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5kb1Nob3dXaGlsZShkZWxheSk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVwbGF5IEluZmluaXRlIFByb2dyZXNzXG5cdFx0ZWxzZSBpZiAodGhpcy5wcm9ncmVzc1N0YXRlLnR5cGUgPT09IFByb2dyZXNzSW5kaWNhdG9yU3RhdGUuVHlwZS5JbmZpbml0ZSkge1xuXHRcdFx0dGhpcy5wcm9ncmVzc0Jhci5pbmZpbml0ZSgpLnNob3coKTtcblx0XHR9XG5cblx0XHQvLyBSZXBsYXkgRmluaXRlIFByb2dyZXNzIChUb3RhbCAmIFdvcmtlZClcblx0XHRlbHNlIGlmICh0aGlzLnByb2dyZXNzU3RhdGUudHlwZSA9PT0gUHJvZ3Jlc3NJbmRpY2F0b3JTdGF0ZS5UeXBlLldvcmspIHtcblx0XHRcdGlmICh0aGlzLnByb2dyZXNzU3RhdGUudG90YWwpIHtcblx0XHRcdFx0dGhpcy5wcm9ncmVzc0Jhci50b3RhbCh0aGlzLnByb2dyZXNzU3RhdGUudG90YWwpLnNob3coKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMucHJvZ3Jlc3NTdGF0ZS53b3JrZWQpIHtcblx0XHRcdFx0dGhpcy5wcm9ncmVzc0Jhci53b3JrZWQodGhpcy5wcm9ncmVzc1N0YXRlLndvcmtlZCkuc2hvdygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRTY29wZURlYWN0aXZhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5wcm9ncmVzc0Jhci5zdG9wKCkuaGlkZSgpO1xuXHR9XG5cblx0c2hvdyhpbmZpbml0ZTogdHJ1ZSwgZGVsYXk/OiBudW1iZXIpOiBJUHJvZ3Jlc3NSdW5uZXI7XG5cdHNob3codG90YWw6IG51bWJlciwgZGVsYXk/OiBudW1iZXIpOiBJUHJvZ3Jlc3NSdW5uZXI7XG5cdHNob3coaW5maW5pdGVPclRvdGFsOiB0cnVlIHwgbnVtYmVyLCBkZWxheT86IG51bWJlcik6IElQcm9ncmVzc1J1bm5lciB7XG5cblx0XHQvLyBTb3J0IG91dCBBcmd1bWVudHNcblx0XHRpZiAodHlwZW9mIGluZmluaXRlT3JUb3RhbCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHR0aGlzLnByb2dyZXNzU3RhdGUgPSBQcm9ncmVzc0luZGljYXRvclN0YXRlLkluZmluaXRlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnByb2dyZXNzU3RhdGUgPSBuZXcgUHJvZ3Jlc3NJbmRpY2F0b3JTdGF0ZS5Xb3JrKGluZmluaXRlT3JUb3RhbCwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHQvLyBBY3RpdmU6IFNob3cgUHJvZ3Jlc3Ncblx0XHRpZiAodGhpcy5zY29wZS5pc0FjdGl2ZSkge1xuXG5cdFx0XHQvLyBJbmZpbml0ZTogU3RhcnQgUHJvZ3Jlc3NiYXIgYW5kIFNob3cgYWZ0ZXIgRGVsYXlcblx0XHRcdGlmICh0aGlzLnByb2dyZXNzU3RhdGUudHlwZSA9PT0gUHJvZ3Jlc3NJbmRpY2F0b3JTdGF0ZS5UeXBlLkluZmluaXRlKSB7XG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NCYXIuaW5maW5pdGUoKS5zaG93KGRlbGF5KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRmluaXRlOiBTdGFydCBQcm9ncmVzc2JhciBhbmQgU2hvdyBhZnRlciBEZWxheVxuXHRcdFx0ZWxzZSBpZiAodGhpcy5wcm9ncmVzc1N0YXRlLnR5cGUgPT09IFByb2dyZXNzSW5kaWNhdG9yU3RhdGUuVHlwZS5Xb3JrICYmIHR5cGVvZiB0aGlzLnByb2dyZXNzU3RhdGUudG90YWwgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NCYXIudG90YWwodGhpcy5wcm9ncmVzc1N0YXRlLnRvdGFsKS5zaG93KGRlbGF5KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dG90YWw6ICh0b3RhbDogbnVtYmVyKSA9PiB7XG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NTdGF0ZSA9IG5ldyBQcm9ncmVzc0luZGljYXRvclN0YXRlLldvcmsoXG5cdFx0XHRcdFx0dG90YWwsXG5cdFx0XHRcdFx0dGhpcy5wcm9ncmVzc1N0YXRlLnR5cGUgPT09IFByb2dyZXNzSW5kaWNhdG9yU3RhdGUuVHlwZS5Xb3JrID8gdGhpcy5wcm9ncmVzc1N0YXRlLndvcmtlZCA6IHVuZGVmaW5lZCk7XG5cblx0XHRcdFx0aWYgKHRoaXMuc2NvcGUuaXNBY3RpdmUpIHtcblx0XHRcdFx0XHR0aGlzLnByb2dyZXNzQmFyLnRvdGFsKHRvdGFsKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0d29ya2VkOiAod29ya2VkOiBudW1iZXIpID0+IHtcblxuXHRcdFx0XHQvLyBWZXJpZnkgZmlyc3QgdGhhdCB3ZSBhcmUgZWl0aGVyIG5vdCBhY3RpdmUgb3IgdGhlIHByb2dyZXNzYmFyIGhhcyBhIHRvdGFsIHNldFxuXHRcdFx0XHRpZiAoIXRoaXMuc2NvcGUuaXNBY3RpdmUgfHwgdGhpcy5wcm9ncmVzc0Jhci5oYXNUb3RhbCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9ncmVzc1N0YXRlID0gbmV3IFByb2dyZXNzSW5kaWNhdG9yU3RhdGUuV29yayhcblx0XHRcdFx0XHRcdHRoaXMucHJvZ3Jlc3NTdGF0ZS50eXBlID09PSBQcm9ncmVzc0luZGljYXRvclN0YXRlLlR5cGUuV29yayA/IHRoaXMucHJvZ3Jlc3NTdGF0ZS50b3RhbCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdHRoaXMucHJvZ3Jlc3NTdGF0ZS50eXBlID09PSBQcm9ncmVzc0luZGljYXRvclN0YXRlLlR5cGUuV29yayAmJiB0eXBlb2YgdGhpcy5wcm9ncmVzc1N0YXRlLndvcmtlZCA9PT0gJ251bWJlcicgPyB0aGlzLnByb2dyZXNzU3RhdGUud29ya2VkICsgd29ya2VkIDogd29ya2VkKTtcblxuXHRcdFx0XHRcdGlmICh0aGlzLnNjb3BlLmlzQWN0aXZlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnByb2dyZXNzQmFyLndvcmtlZCh3b3JrZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE90aGVyd2lzZSB0aGUgcHJvZ3Jlc3MgYmFyIGRvZXMgbm90IHN1cHBvcnQgd29ya2VkKCksIHdlIGZhbGxiYWNrIHRvIGluZmluaXRlKCkgcHJvZ3Jlc3Ncblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9ncmVzc1N0YXRlID0gUHJvZ3Jlc3NJbmRpY2F0b3JTdGF0ZS5JbmZpbml0ZTtcblx0XHRcdFx0XHR0aGlzLnByb2dyZXNzQmFyLmluZmluaXRlKCkuc2hvdygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRkb25lOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NTdGF0ZSA9IFByb2dyZXNzSW5kaWNhdG9yU3RhdGUuRG9uZTtcblxuXHRcdFx0XHRpZiAodGhpcy5zY29wZS5pc0FjdGl2ZSkge1xuXHRcdFx0XHRcdHRoaXMucHJvZ3Jlc3NCYXIuc3RvcCgpLmhpZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBzaG93V2hpbGUocHJvbWlzZTogUHJvbWlzZTx1bmtub3duPiwgZGVsYXk/OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIEpvaW4gd2l0aCBleGlzdGluZyBydW5uaW5nIHByb21pc2UgdG8gZW5zdXJlIHByb2dyZXNzIGlzIGFjY3VyYXRlXG5cdFx0aWYgKHRoaXMucHJvZ3Jlc3NTdGF0ZS50eXBlID09PSBQcm9ncmVzc0luZGljYXRvclN0YXRlLlR5cGUuV2hpbGUpIHtcblx0XHRcdHByb21pc2UgPSBQcm9taXNlLmFsbFNldHRsZWQoW3Byb21pc2UsIHRoaXMucHJvZ3Jlc3NTdGF0ZS53aGlsZVByb21pc2VdKTtcblx0XHR9XG5cblx0XHQvLyBLZWVwIFByb21pc2UgaW4gU3RhdGVcblx0XHR0aGlzLnByb2dyZXNzU3RhdGUgPSBuZXcgUHJvZ3Jlc3NJbmRpY2F0b3JTdGF0ZS5XaGlsZShwcm9taXNlLCBkZWxheSB8fCAwLCBEYXRlLm5vdygpKTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLmRvU2hvd1doaWxlKGRlbGF5KTtcblxuXHRcdFx0YXdhaXQgcHJvbWlzZTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gaWdub3JlXG5cdFx0fSBmaW5hbGx5IHtcblxuXHRcdFx0Ly8gSWYgdGhpcyBpcyBub3QgdGhlIGxhc3QgcHJvbWlzZSBpbiB0aGUgbGlzdCBvZiBqb2luZWQgcHJvbWlzZXMsIHNraXAgdGhpc1xuXHRcdFx0aWYgKHRoaXMucHJvZ3Jlc3NTdGF0ZS50eXBlICE9PSBQcm9ncmVzc0luZGljYXRvclN0YXRlLlR5cGUuV2hpbGUgfHwgdGhpcy5wcm9ncmVzc1N0YXRlLndoaWxlUHJvbWlzZSA9PT0gcHJvbWlzZSkge1xuXG5cdFx0XHRcdC8vIFRoZSB3aGlsZSBwcm9taXNlIGlzIGVpdGhlciBudWxsIG9yIGVxdWFsIHRoZSBwcm9taXNlIHdlIGxhc3QgaG9va2VkIG9uXG5cdFx0XHRcdHRoaXMucHJvZ3Jlc3NTdGF0ZSA9IFByb2dyZXNzSW5kaWNhdG9yU3RhdGUuTm9uZTtcblxuXHRcdFx0XHRpZiAodGhpcy5zY29wZS5pc0FjdGl2ZSkge1xuXHRcdFx0XHRcdHRoaXMucHJvZ3Jlc3NCYXIuc3RvcCgpLmhpZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9TaG93V2hpbGUoZGVsYXk/OiBudW1iZXIpOiB2b2lkIHtcblxuXHRcdC8vIFNob3cgUHJvZ3Jlc3Mgd2hlbiBhY3RpdmVcblx0XHRpZiAodGhpcy5zY29wZS5pc0FjdGl2ZSkge1xuXHRcdFx0dGhpcy5wcm9ncmVzc0Jhci5pbmZpbml0ZSgpLnNob3coZGVsYXkpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RQcm9ncmVzc1Njb3BlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElQcm9ncmVzc1Njb3BlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUFjdGl2ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFjdGl2ZSA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlLmV2ZW50O1xuXG5cdGdldCBpc0FjdGl2ZSgpIHsgcmV0dXJuIHRoaXMuX2lzQWN0aXZlOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBzY29wZUlkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfaXNBY3RpdmU6IGJvb2xlYW5cblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvblNjb3BlT3BlbmVkKHNjb3BlSWQ6IHN0cmluZykge1xuXHRcdGlmIChzY29wZUlkID09PSB0aGlzLnNjb3BlSWQpIHtcblx0XHRcdGlmICghdGhpcy5faXNBY3RpdmUpIHtcblx0XHRcdFx0dGhpcy5faXNBY3RpdmUgPSB0cnVlO1xuXG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlLmZpcmUoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb25TY29wZUNsb3NlZChzY29wZUlkOiBzdHJpbmcpIHtcblx0XHRpZiAoc2NvcGVJZCA9PT0gdGhpcy5zY29wZUlkKSB7XG5cdFx0XHRpZiAodGhpcy5faXNBY3RpdmUpIHtcblx0XHRcdFx0dGhpcy5faXNBY3RpdmUgPSBmYWxzZTtcblxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZS5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsa0JBQWtCO0FBRTNCLFNBQThDLDJCQUEyQjtBQUV6RSxTQUFTLDRCQUE0QjtBQUU5QixNQUFNLGdDQUFnQyxXQUF5QztBQUFBLEVBRXJGLFlBQ2tCLGFBQ0EsT0FDaEI7QUFDRCxVQUFNO0FBSFc7QUFDQTtBQUlqQixTQUFLLGtCQUFrQjtBQUFBLEVBQ3hCO0FBQUEsRUFFUSxvQkFBb0I7QUFNM0IsU0FBSyxVQUFVLEtBQUssTUFBTSxpQkFBaUIsT0FBSztBQUMvQyxVQUNDLEVBQUUsU0FBUyxxQkFBcUIsaUJBQy9CLEVBQUUsU0FBUyxxQkFBcUIsZ0JBQWdCLEtBQUssTUFBTSxTQUMzRDtBQUNELGFBQUssWUFBWSxLQUFLLEVBQUUsS0FBSztBQUFBLE1BQzlCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFJQSxLQUFLLGlCQUFnQyxPQUFpQztBQUdyRSxRQUFJLEtBQUssTUFBTSxTQUFTO0FBQ3ZCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxvQkFBb0IsTUFBTTtBQUM3QixhQUFPLEtBQUssT0FBTyxNQUFNLEtBQUs7QUFBQSxJQUMvQjtBQUVBLFdBQU8sS0FBSyxPQUFPLGlCQUFpQixLQUFLO0FBQUEsRUFDMUM7QUFBQSxFQUlRLE9BQU8saUJBQWdDLE9BQWlDO0FBQy9FLFFBQUksT0FBTyxvQkFBb0IsV0FBVztBQUN6QyxX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
