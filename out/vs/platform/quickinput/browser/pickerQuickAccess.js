import { timeout } from "../../../base/common/async.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { isFunction } from "../../../base/common/types.js";
var TriggerAction = /* @__PURE__ */ ((TriggerAction2) => {
  TriggerAction2[TriggerAction2["NO_ACTION"] = 0] = "NO_ACTION";
  TriggerAction2[TriggerAction2["CLOSE_PICKER"] = 1] = "CLOSE_PICKER";
  TriggerAction2[TriggerAction2["REFRESH_PICKER"] = 2] = "REFRESH_PICKER";
  TriggerAction2[TriggerAction2["REMOVE_ITEM"] = 3] = "REMOVE_ITEM";
  return TriggerAction2;
})(TriggerAction || {});
function isPicksWithActive(obj) {
  const candidate = obj;
  return Array.isArray(candidate.items);
}
function isFastAndSlowPicks(obj) {
  const candidate = obj;
  return !!candidate.picks && candidate.additionalPicks instanceof Promise;
}
class PickerQuickAccessProvider extends Disposable {
  constructor(prefix, options) {
    super();
    this.prefix = prefix;
    this.options = options;
  }
  provide(picker, token, runOptions) {
    const disposables = new DisposableStore();
    picker.canAcceptInBackground = !!this.options?.canAcceptInBackground;
    picker.matchOnLabel = picker.matchOnDescription = picker.matchOnDetail = picker.sortByLabel = false;
    let picksCts = void 0;
    const picksDisposable = disposables.add(new MutableDisposable());
    const updatePickerItems = async () => {
      const picksDisposables = picksDisposable.value = new DisposableStore();
      picksCts?.dispose(true);
      picker.busy = false;
      picksCts = picksDisposables.add(new CancellationTokenSource(token));
      const picksToken = picksCts.token;
      let picksFilter = picker.value.substring(this.prefix.length);
      if (!this.options?.shouldSkipTrimPickFilter) {
        picksFilter = picksFilter.trim();
      }
      const providedPicks = this._getPicks(picksFilter, picksDisposables, picksToken, runOptions);
      const applyPicks = (picks, skipEmpty) => {
        let items;
        let activeItem = void 0;
        if (isPicksWithActive(picks)) {
          items = picks.items;
          activeItem = picks.active;
        } else {
          items = picks;
        }
        if (items.length === 0) {
          if (skipEmpty) {
            return false;
          }
          if ((picksFilter.length > 0 || picker.hideInput) && this.options?.noResultsPick) {
            if (isFunction(this.options.noResultsPick)) {
              items = [this.options.noResultsPick(picksFilter)];
            } else {
              items = [this.options.noResultsPick];
            }
          }
        }
        picker.items = items;
        if (activeItem) {
          picker.activeItems = [activeItem];
        }
        return true;
      };
      const applyFastAndSlowPicks = async (fastAndSlowPicks) => {
        let fastPicksApplied = false;
        let slowPicksApplied = false;
        await Promise.all([
          // Fast Picks: if `mergeDelay` is configured, in order to reduce
          // amount of flicker, we race against the slow picks over some delay
          // and then set the fast picks.
          // If the slow picks are faster, we reduce the flicker by only
          // setting the items once.
          (async () => {
            if (typeof fastAndSlowPicks.mergeDelay === "number") {
              await timeout(fastAndSlowPicks.mergeDelay);
              if (picksToken.isCancellationRequested) {
                return;
              }
            }
            if (!slowPicksApplied) {
              fastPicksApplied = applyPicks(
                fastAndSlowPicks.picks,
                true
                /* skip over empty to reduce flicker */
              );
            }
          })(),
          // Slow Picks: we await the slow picks and then set them at
          // once together with the fast picks, but only if we actually
          // have additional results.
          (async () => {
            picker.busy = true;
            try {
              const awaitedAdditionalPicks = await fastAndSlowPicks.additionalPicks;
              if (picksToken.isCancellationRequested) {
                return;
              }
              let picks;
              let activePick = void 0;
              if (isPicksWithActive(fastAndSlowPicks.picks)) {
                picks = fastAndSlowPicks.picks.items;
                activePick = fastAndSlowPicks.picks.active;
              } else {
                picks = fastAndSlowPicks.picks;
              }
              let additionalPicks;
              let additionalActivePick = void 0;
              if (isPicksWithActive(awaitedAdditionalPicks)) {
                additionalPicks = awaitedAdditionalPicks.items;
                additionalActivePick = awaitedAdditionalPicks.active;
              } else {
                additionalPicks = awaitedAdditionalPicks;
              }
              if (additionalPicks.length > 0 || !fastPicksApplied) {
                let fallbackActivePick = void 0;
                if (!activePick && !additionalActivePick) {
                  const fallbackActivePickCandidate = picker.activeItems[0];
                  if (fallbackActivePickCandidate && picks.indexOf(fallbackActivePickCandidate) !== -1) {
                    fallbackActivePick = fallbackActivePickCandidate;
                  }
                }
                applyPicks({
                  items: [...picks, ...additionalPicks],
                  active: activePick || additionalActivePick || fallbackActivePick
                });
              }
            } finally {
              if (!picksToken.isCancellationRequested) {
                picker.busy = false;
              }
              slowPicksApplied = true;
            }
          })()
        ]);
      };
      if (providedPicks === null) {
      } else if (isFastAndSlowPicks(providedPicks)) {
        await applyFastAndSlowPicks(providedPicks);
      } else if (!(providedPicks instanceof Promise)) {
        applyPicks(providedPicks);
      } else {
        picker.busy = true;
        try {
          const awaitedPicks = await providedPicks;
          if (picksToken.isCancellationRequested) {
            return;
          }
          if (isFastAndSlowPicks(awaitedPicks)) {
            await applyFastAndSlowPicks(awaitedPicks);
          } else {
            applyPicks(awaitedPicks);
          }
        } finally {
          if (!picksToken.isCancellationRequested) {
            picker.busy = false;
          }
        }
      }
    };
    disposables.add(picker.onDidChangeValue(() => updatePickerItems()));
    updatePickerItems();
    disposables.add(picker.onDidAccept((event) => {
      if (runOptions?.handleAccept) {
        if (!event.inBackground) {
          picker.hide();
        }
        runOptions.handleAccept?.(picker.activeItems[0], event.inBackground);
        return;
      }
      const [item] = picker.selectedItems;
      if (typeof item?.accept === "function") {
        if (!event.inBackground) {
          picker.hide();
        }
        item.accept(picker.keyMods, event);
      }
    }));
    const buttonTrigger = async (button, item) => {
      if (typeof item.trigger !== "function") {
        return;
      }
      const buttonIndex = item.buttons?.indexOf(button) ?? -1;
      if (buttonIndex >= 0) {
        const result = item.trigger(buttonIndex, picker.keyMods);
        const action = typeof result === "number" ? result : await result;
        if (token.isCancellationRequested) {
          return;
        }
        switch (action) {
          case 0 /* NO_ACTION */:
            break;
          case 1 /* CLOSE_PICKER */:
            picker.hide();
            break;
          case 2 /* REFRESH_PICKER */:
            updatePickerItems();
            break;
          case 3 /* REMOVE_ITEM */: {
            const index = picker.items.indexOf(item);
            if (index !== -1) {
              const items = picker.items.slice();
              const removed = items.splice(index, 1);
              const activeItems = picker.activeItems.filter((activeItem) => activeItem !== removed[0]);
              const keepScrollPositionBefore = picker.keepScrollPosition;
              picker.keepScrollPosition = true;
              picker.items = items;
              if (activeItems) {
                picker.activeItems = activeItems;
              }
              picker.keepScrollPosition = keepScrollPositionBefore;
            }
            break;
          }
        }
      }
    };
    disposables.add(picker.onDidTriggerItemButton(({ button, item }) => buttonTrigger(button, item)));
    disposables.add(picker.onDidTriggerSeparatorButton(({ button, separator }) => buttonTrigger(button, separator)));
    return disposables;
  }
}
export {
  PickerQuickAccessProvider,
  TriggerAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvcGlja2VyUXVpY2tBY2Nlc3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElLZXlNb2RzLCBJUXVpY2tQaWNrRGlkQWNjZXB0RXZlbnQsIElRdWlja1BpY2tTZXBhcmF0b3IsIElRdWlja1BpY2ssIElRdWlja1BpY2tJdGVtLCBJUXVpY2tJbnB1dEJ1dHRvbiB9IGZyb20gJy4uL2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElRdWlja0FjY2Vzc1Byb3ZpZGVyLCBJUXVpY2tBY2Nlc3NQcm92aWRlclJ1bk9wdGlvbnMgfSBmcm9tICcuLi9jb21tb24vcXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgaXNGdW5jdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcblxuZXhwb3J0IGVudW0gVHJpZ2dlckFjdGlvbiB7XG5cblx0LyoqXG5cdCAqIERvIG5vdGhpbmcgYWZ0ZXIgdGhlIGJ1dHRvbiB3YXMgY2xpY2tlZC5cblx0ICovXG5cdE5PX0FDVElPTixcblxuXHQvKipcblx0ICogQ2xvc2UgdGhlIHBpY2tlci5cblx0ICovXG5cdENMT1NFX1BJQ0tFUixcblxuXHQvKipcblx0ICogVXBkYXRlIHRoZSByZXN1bHRzIG9mIHRoZSBwaWNrZXIuXG5cdCAqL1xuXHRSRUZSRVNIX1BJQ0tFUixcblxuXHQvKipcblx0ICogUmVtb3ZlIHRoZSBpdGVtIGZyb20gdGhlIHBpY2tlci5cblx0ICovXG5cdFJFTU9WRV9JVEVNXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBpY2tlclF1aWNrQWNjZXNzSXRlbSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblxuXHQvKipcblx0KiBBIG1ldGhvZCB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgd2hlbiB0aGUgcGljayBpdGVtIGlzIGFjY2VwdGVkIGZyb21cblx0KiB0aGUgcGlja2VyLiBUaGUgcGlja2VyIHdpbGwgY2xvc2UgYXV0b21hdGljYWxseSBiZWZvcmUgcnVubmluZyB0aGlzLlxuXHQqXG5cdCogQHBhcmFtIGtleU1vZHMgdGhlIHN0YXRlIG9mIG1vZGlmaWVyIGtleXMgd2hlbiB0aGUgaXRlbSB3YXMgYWNjZXB0ZWQuXG5cdCogQHBhcmFtIGV2ZW50IHRoZSB1bmRlcmx5aW5nIGV2ZW50IHRoYXQgY2F1c2VkIHRoZSBhY2NlcHQgdG8gdHJpZ2dlci5cblx0Ki9cblx0YWNjZXB0PyhrZXlNb2RzOiBJS2V5TW9kcywgZXZlbnQ6IElRdWlja1BpY2tEaWRBY2NlcHRFdmVudCk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEEgbWV0aG9kIHRoYXQgd2lsbCBiZSBleGVjdXRlZCB3aGVuIGEgYnV0dG9uIG9mIHRoZSBwaWNrIGl0ZW0gd2FzXG5cdCAqIGNsaWNrZWQgb24uXG5cdCAqXG5cdCAqIEBwYXJhbSBidXR0b25JbmRleCBpbmRleCBvZiB0aGUgYnV0dG9uIG9mIHRoZSBpdGVtIHRoYXRcblx0ICogd2FzIGNsaWNrZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB0aGUgc3RhdGUgb2YgbW9kaWZpZXIga2V5cyB3aGVuIHRoZSBidXR0b24gd2FzIHRyaWdnZXJlZC5cblx0ICpcblx0ICogQHJldHVybnMgYSB2YWx1ZSB0aGF0IGluZGljYXRlcyB3aGF0IHNob3VsZCBoYXBwZW4gYWZ0ZXIgdGhlIHRyaWdnZXJcblx0ICogd2hpY2ggY2FuIGJlIGEgYFByb21pc2VgIGZvciBsb25nIHJ1bm5pbmcgb3BlcmF0aW9ucy5cblx0ICovXG5cdHRyaWdnZXI/KGJ1dHRvbkluZGV4OiBudW1iZXIsIGtleU1vZHM6IElLZXlNb2RzKTogVHJpZ2dlckFjdGlvbiB8IFByb21pc2U8VHJpZ2dlckFjdGlvbj47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVBpY2tlclF1aWNrQWNjZXNzU2VwYXJhdG9yIGV4dGVuZHMgSVF1aWNrUGlja1NlcGFyYXRvciB7XG5cdC8qKlxuXHQgKiBBIG1ldGhvZCB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgd2hlbiBhIGJ1dHRvbiBvZiB0aGUgcGljayBpdGVtIHdhc1xuXHQgKiBjbGlja2VkIG9uLlxuXHQgKlxuXHQgKiBAcGFyYW0gYnV0dG9uSW5kZXggaW5kZXggb2YgdGhlIGJ1dHRvbiBvZiB0aGUgaXRlbSB0aGF0XG5cdCAqIHdhcyBjbGlja2VkLlxuXHQgKlxuXHQgKiBAcGFyYW0gdGhlIHN0YXRlIG9mIG1vZGlmaWVyIGtleXMgd2hlbiB0aGUgYnV0dG9uIHdhcyB0cmlnZ2VyZWQuXG5cdCAqXG5cdCAqIEByZXR1cm5zIGEgdmFsdWUgdGhhdCBpbmRpY2F0ZXMgd2hhdCBzaG91bGQgaGFwcGVuIGFmdGVyIHRoZSB0cmlnZ2VyXG5cdCAqIHdoaWNoIGNhbiBiZSBhIGBQcm9taXNlYCBmb3IgbG9uZyBydW5uaW5nIG9wZXJhdGlvbnMuXG5cdCAqL1xuXHR0cmlnZ2VyPyhidXR0b25JbmRleDogbnVtYmVyLCBrZXlNb2RzOiBJS2V5TW9kcyk6IFRyaWdnZXJBY3Rpb24gfCBQcm9taXNlPFRyaWdnZXJBY3Rpb24+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQaWNrZXJRdWlja0FjY2Vzc1Byb3ZpZGVyT3B0aW9uczxUIGV4dGVuZHMgSVBpY2tlclF1aWNrQWNjZXNzSXRlbT4ge1xuXG5cdC8qKlxuXHQgKiBFbmFibGVzIHN1cHBvcnQgZm9yIG9wZW5pbmcgcGlja3MgaW4gdGhlIGJhY2tncm91bmQgdmlhIGdlc3R1cmUuXG5cdCAqL1xuXHRyZWFkb25seSBjYW5BY2NlcHRJbkJhY2tncm91bmQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBFbmFibGVzIHRvIHNob3cgYSBwaWNrIGVudHJ5IHdoZW4gbm8gcmVzdWx0cyBhcmUgcmV0dXJuZWQgZnJvbSBhIHNlYXJjaC5cblx0ICovXG5cdHJlYWRvbmx5IG5vUmVzdWx0c1BpY2s/OiBUIHwgKChmaWx0ZXI6IHN0cmluZykgPT4gVCk7XG5cblx0LyoqIFdoZXRoZXIgdG8gc2tpcCB0cmltbWluZyB0aGUgcGljayBmaWx0ZXIgc3RyaW5nICovXG5cdHJlYWRvbmx5IHNob3VsZFNraXBUcmltUGlja0ZpbHRlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFBpY2s8VD4gPSBUIHwgSVF1aWNrUGlja1NlcGFyYXRvcjtcbmV4cG9ydCB0eXBlIFBpY2tzV2l0aEFjdGl2ZTxUPiA9IHsgaXRlbXM6IHJlYWRvbmx5IFBpY2s8VD5bXTsgYWN0aXZlPzogVCB9O1xuZXhwb3J0IHR5cGUgUGlja3M8VD4gPSByZWFkb25seSBQaWNrPFQ+W10gfCBQaWNrc1dpdGhBY3RpdmU8VD47XG5leHBvcnQgdHlwZSBGYXN0QW5kU2xvd1BpY2tzPFQ+ID0ge1xuXG5cdC8qKlxuXHQgKiBQaWNrcyB0aGF0IHdpbGwgc2hvdyBpbnN0YW50bHkgb3IgYWZ0ZXIgYSBzaG9ydCBkZWxheVxuXHQgKiBiYXNlZCBvbiB0aGUgYG1lcmdlRGVsYXlgIHByb3BlcnR5IHRvIHJlZHVjZSBmbGlja2VyLlxuXHQgKi9cblx0cmVhZG9ubHkgcGlja3M6IFBpY2tzPFQ+O1xuXG5cdC8qKlxuXHQgKiBQaWNrcyB0aGF0IHdpbGwgc2hvdyBhZnRlciB0aGV5IGhhdmUgYmVlbiByZXNvbHZlZC5cblx0ICovXG5cdHJlYWRvbmx5IGFkZGl0aW9uYWxQaWNrczogUHJvbWlzZTxQaWNrczxUPj47XG5cblx0LyoqXG5cdCAqIEEgZGVsYXkgaW4gbWlsbGlzZWNvbmRzIHRvIHdhaXQgYmVmb3JlIHNob3dpbmcgdGhlXG5cdCAqIGBwaWNrc2AgdG8gZ2l2ZSBhIGNoYW5jZSB0byBtZXJnZSB3aXRoIGBhZGRpdGlvbmFsUGlja3NgXG5cdCAqIGZvciByZWR1Y2VkIGZsaWNrZXIuXG5cdCAqL1xuXHRyZWFkb25seSBtZXJnZURlbGF5PzogbnVtYmVyO1xufTtcblxuZnVuY3Rpb24gaXNQaWNrc1dpdGhBY3RpdmU8VD4ob2JqOiB1bmtub3duKTogb2JqIGlzIFBpY2tzV2l0aEFjdGl2ZTxUPiB7XG5cdGNvbnN0IGNhbmRpZGF0ZSA9IG9iaiBhcyBQaWNrc1dpdGhBY3RpdmU8VD47XG5cblx0cmV0dXJuIEFycmF5LmlzQXJyYXkoY2FuZGlkYXRlLml0ZW1zKTtcbn1cblxuZnVuY3Rpb24gaXNGYXN0QW5kU2xvd1BpY2tzPFQ+KG9iajogdW5rbm93bik6IG9iaiBpcyBGYXN0QW5kU2xvd1BpY2tzPFQ+IHtcblx0Y29uc3QgY2FuZGlkYXRlID0gb2JqIGFzIEZhc3RBbmRTbG93UGlja3M8VD47XG5cblx0cmV0dXJuICEhY2FuZGlkYXRlLnBpY2tzICYmIGNhbmRpZGF0ZS5hZGRpdGlvbmFsUGlja3MgaW5zdGFuY2VvZiBQcm9taXNlO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgUGlja2VyUXVpY2tBY2Nlc3NQcm92aWRlcjxUIGV4dGVuZHMgSVBpY2tlclF1aWNrQWNjZXNzSXRlbT4gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVF1aWNrQWNjZXNzUHJvdmlkZXIge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcHJlZml4OiBzdHJpbmcsIHByb3RlY3RlZCBvcHRpb25zPzogSVBpY2tlclF1aWNrQWNjZXNzUHJvdmlkZXJPcHRpb25zPFQ+KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3ZpZGUocGlja2VyOiBJUXVpY2tQaWNrPFQsIHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9PiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBydW5PcHRpb25zPzogSVF1aWNrQWNjZXNzUHJvdmlkZXJSdW5PcHRpb25zKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Ly8gQXBwbHkgb3B0aW9ucyBpZiBhbnlcblx0XHRwaWNrZXIuY2FuQWNjZXB0SW5CYWNrZ3JvdW5kID0gISF0aGlzLm9wdGlvbnM/LmNhbkFjY2VwdEluQmFja2dyb3VuZDtcblxuXHRcdC8vIERpc2FibGUgZmlsdGVyaW5nICYgc29ydGluZywgd2UgY29udHJvbCB0aGUgcmVzdWx0c1xuXHRcdHBpY2tlci5tYXRjaE9uTGFiZWwgPSBwaWNrZXIubWF0Y2hPbkRlc2NyaXB0aW9uID0gcGlja2VyLm1hdGNoT25EZXRhaWwgPSBwaWNrZXIuc29ydEJ5TGFiZWwgPSBmYWxzZTtcblxuXHRcdC8vIFNldCBpbml0aWFsIHBpY2tzIGFuZCB1cGRhdGUgb24gdHlwZVxuXHRcdGxldCBwaWNrc0N0czogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcGlja3NEaXNwb3NhYmxlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0XHRjb25zdCB1cGRhdGVQaWNrZXJJdGVtcyA9IGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHBpY2tzRGlzcG9zYWJsZXMgPSBwaWNrc0Rpc3Bvc2FibGUudmFsdWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdC8vIENhbmNlbCBhbnkgcHJldmlvdXMgYXNrIGZvciBwaWNrcyBhbmQgYnVzeVxuXHRcdFx0cGlja3NDdHM/LmRpc3Bvc2UodHJ1ZSk7XG5cdFx0XHRwaWNrZXIuYnVzeSA9IGZhbHNlO1xuXG5cdFx0XHQvLyBDcmVhdGUgbmV3IGNhbmNlbGxhdGlvbiBzb3VyY2UgZm9yIHRoaXMgcnVuXG5cdFx0XHRwaWNrc0N0cyA9IHBpY2tzRGlzcG9zYWJsZXMuYWRkKG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSh0b2tlbikpO1xuXG5cdFx0XHQvLyBDb2xsZWN0IHBpY2tzIGFuZCBzdXBwb3J0IGJvdGggbG9uZyBydW5uaW5nIGFuZCBzaG9ydCBvciBjb21iaW5lZFxuXHRcdFx0Y29uc3QgcGlja3NUb2tlbiA9IHBpY2tzQ3RzLnRva2VuO1xuXHRcdFx0bGV0IHBpY2tzRmlsdGVyID0gcGlja2VyLnZhbHVlLnN1YnN0cmluZyh0aGlzLnByZWZpeC5sZW5ndGgpO1xuXG5cdFx0XHRpZiAoIXRoaXMub3B0aW9ucz8uc2hvdWxkU2tpcFRyaW1QaWNrRmlsdGVyKSB7XG5cdFx0XHRcdHBpY2tzRmlsdGVyID0gcGlja3NGaWx0ZXIudHJpbSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwcm92aWRlZFBpY2tzID0gdGhpcy5fZ2V0UGlja3MocGlja3NGaWx0ZXIsIHBpY2tzRGlzcG9zYWJsZXMsIHBpY2tzVG9rZW4sIHJ1bk9wdGlvbnMpO1xuXG5cdFx0XHRjb25zdCBhcHBseVBpY2tzID0gKHBpY2tzOiBQaWNrczxUPiwgc2tpcEVtcHR5PzogYm9vbGVhbik6IGJvb2xlYW4gPT4ge1xuXHRcdFx0XHRsZXQgaXRlbXM6IHJlYWRvbmx5IFBpY2s8VD5bXTtcblx0XHRcdFx0bGV0IGFjdGl2ZUl0ZW06IFQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdFx0aWYgKGlzUGlja3NXaXRoQWN0aXZlKHBpY2tzKSkge1xuXHRcdFx0XHRcdGl0ZW1zID0gcGlja3MuaXRlbXM7XG5cdFx0XHRcdFx0YWN0aXZlSXRlbSA9IHBpY2tzLmFjdGl2ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpdGVtcyA9IHBpY2tzO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdGlmIChza2lwRW1wdHkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBXZSBzaG93IHRoZSBubyByZXN1bHRzIHBpY2sgaWYgd2UgaGF2ZSBubyBpbnB1dCB0byBwcmV2ZW50IGNvbXBsZXRlbHkgZW1wdHkgcGlja2VycyAjMTcyNjEzXG5cdFx0XHRcdFx0aWYgKChwaWNrc0ZpbHRlci5sZW5ndGggPiAwIHx8IHBpY2tlci5oaWRlSW5wdXQpICYmIHRoaXMub3B0aW9ucz8ubm9SZXN1bHRzUGljaykge1xuXHRcdFx0XHRcdFx0aWYgKGlzRnVuY3Rpb24odGhpcy5vcHRpb25zLm5vUmVzdWx0c1BpY2spKSB7XG5cdFx0XHRcdFx0XHRcdGl0ZW1zID0gW3RoaXMub3B0aW9ucy5ub1Jlc3VsdHNQaWNrKHBpY2tzRmlsdGVyKV07XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRpdGVtcyA9IFt0aGlzLm9wdGlvbnMubm9SZXN1bHRzUGlja107XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cGlja2VyLml0ZW1zID0gaXRlbXM7XG5cdFx0XHRcdGlmIChhY3RpdmVJdGVtKSB7XG5cdFx0XHRcdFx0cGlja2VyLmFjdGl2ZUl0ZW1zID0gW2FjdGl2ZUl0ZW1dO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBhcHBseUZhc3RBbmRTbG93UGlja3MgPSBhc3luYyAoZmFzdEFuZFNsb3dQaWNrczogRmFzdEFuZFNsb3dQaWNrczxUPik6IFByb21pc2U8dm9pZD4gPT4ge1xuXHRcdFx0XHRsZXQgZmFzdFBpY2tzQXBwbGllZCA9IGZhbHNlO1xuXHRcdFx0XHRsZXQgc2xvd1BpY2tzQXBwbGllZCA9IGZhbHNlO1xuXG5cdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblxuXHRcdFx0XHRcdC8vIEZhc3QgUGlja3M6IGlmIGBtZXJnZURlbGF5YCBpcyBjb25maWd1cmVkLCBpbiBvcmRlciB0byByZWR1Y2Vcblx0XHRcdFx0XHQvLyBhbW91bnQgb2YgZmxpY2tlciwgd2UgcmFjZSBhZ2FpbnN0IHRoZSBzbG93IHBpY2tzIG92ZXIgc29tZSBkZWxheVxuXHRcdFx0XHRcdC8vIGFuZCB0aGVuIHNldCB0aGUgZmFzdCBwaWNrcy5cblx0XHRcdFx0XHQvLyBJZiB0aGUgc2xvdyBwaWNrcyBhcmUgZmFzdGVyLCB3ZSByZWR1Y2UgdGhlIGZsaWNrZXIgYnkgb25seVxuXHRcdFx0XHRcdC8vIHNldHRpbmcgdGhlIGl0ZW1zIG9uY2UuXG5cblx0XHRcdFx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBmYXN0QW5kU2xvd1BpY2tzLm1lcmdlRGVsYXkgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoZmFzdEFuZFNsb3dQaWNrcy5tZXJnZURlbGF5KTtcblx0XHRcdFx0XHRcdFx0aWYgKHBpY2tzVG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKCFzbG93UGlja3NBcHBsaWVkKSB7XG5cdFx0XHRcdFx0XHRcdGZhc3RQaWNrc0FwcGxpZWQgPSBhcHBseVBpY2tzKGZhc3RBbmRTbG93UGlja3MucGlja3MsIHRydWUgLyogc2tpcCBvdmVyIGVtcHR5IHRvIHJlZHVjZSBmbGlja2VyICovKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSgpLFxuXG5cdFx0XHRcdFx0Ly8gU2xvdyBQaWNrczogd2UgYXdhaXQgdGhlIHNsb3cgcGlja3MgYW5kIHRoZW4gc2V0IHRoZW0gYXRcblx0XHRcdFx0XHQvLyBvbmNlIHRvZ2V0aGVyIHdpdGggdGhlIGZhc3QgcGlja3MsIGJ1dCBvbmx5IGlmIHdlIGFjdHVhbGx5XG5cdFx0XHRcdFx0Ly8gaGF2ZSBhZGRpdGlvbmFsIHJlc3VsdHMuXG5cblx0XHRcdFx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0cGlja2VyLmJ1c3kgPSB0cnVlO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgYXdhaXRlZEFkZGl0aW9uYWxQaWNrcyA9IGF3YWl0IGZhc3RBbmRTbG93UGlja3MuYWRkaXRpb25hbFBpY2tzO1xuXHRcdFx0XHRcdFx0XHRpZiAocGlja3NUb2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGxldCBwaWNrczogcmVhZG9ubHkgUGljazxUPltdO1xuXHRcdFx0XHRcdFx0XHRsZXQgYWN0aXZlUGljazogUGljazxUPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0aWYgKGlzUGlja3NXaXRoQWN0aXZlKGZhc3RBbmRTbG93UGlja3MucGlja3MpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cGlja3MgPSBmYXN0QW5kU2xvd1BpY2tzLnBpY2tzLml0ZW1zO1xuXHRcdFx0XHRcdFx0XHRcdGFjdGl2ZVBpY2sgPSBmYXN0QW5kU2xvd1BpY2tzLnBpY2tzLmFjdGl2ZTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRwaWNrcyA9IGZhc3RBbmRTbG93UGlja3MucGlja3M7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRsZXQgYWRkaXRpb25hbFBpY2tzOiByZWFkb25seSBQaWNrPFQ+W107XG5cdFx0XHRcdFx0XHRcdGxldCBhZGRpdGlvbmFsQWN0aXZlUGljazogUGljazxUPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0aWYgKGlzUGlja3NXaXRoQWN0aXZlKGF3YWl0ZWRBZGRpdGlvbmFsUGlja3MpKSB7XG5cdFx0XHRcdFx0XHRcdFx0YWRkaXRpb25hbFBpY2tzID0gYXdhaXRlZEFkZGl0aW9uYWxQaWNrcy5pdGVtcztcblx0XHRcdFx0XHRcdFx0XHRhZGRpdGlvbmFsQWN0aXZlUGljayA9IGF3YWl0ZWRBZGRpdGlvbmFsUGlja3MuYWN0aXZlO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdGFkZGl0aW9uYWxQaWNrcyA9IGF3YWl0ZWRBZGRpdGlvbmFsUGlja3M7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRpZiAoYWRkaXRpb25hbFBpY2tzLmxlbmd0aCA+IDAgfHwgIWZhc3RQaWNrc0FwcGxpZWQpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBJZiB3ZSBkbyBub3QgaGF2ZSBhbnkgYWN0aXZlUGljayBvciBhZGRpdGlvbmFsQWN0aXZlUGlja1xuXHRcdFx0XHRcdFx0XHRcdC8vIHdlIHRyeSB0byBwcmVzZXJ2ZSB0aGUgY3VycmVudGx5IGFjdGl2ZSBwaWNrIGZyb20gdGhlXG5cdFx0XHRcdFx0XHRcdFx0Ly8gZmFzdCByZXN1bHRzLiBUaGlzIGZpeGVzIGFuIGlzc3VlIHdoZXJlIHRoZSB1c2VyIG1pZ2h0XG5cdFx0XHRcdFx0XHRcdFx0Ly8gaGF2ZSBtYWRlIGEgcGljayBhY3RpdmUgYmVmb3JlIHRoZSBhZGRpdGlvbmFsIHJlc3VsdHNcblx0XHRcdFx0XHRcdFx0XHQvLyBraWNrIGluLlxuXHRcdFx0XHRcdFx0XHRcdC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTAyNDgwXG5cdFx0XHRcdFx0XHRcdFx0bGV0IGZhbGxiYWNrQWN0aXZlUGljazogUGljazxUPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0XHRpZiAoIWFjdGl2ZVBpY2sgJiYgIWFkZGl0aW9uYWxBY3RpdmVQaWNrKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBmYWxsYmFja0FjdGl2ZVBpY2tDYW5kaWRhdGUgPSBwaWNrZXIuYWN0aXZlSXRlbXNbMF07XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZmFsbGJhY2tBY3RpdmVQaWNrQ2FuZGlkYXRlICYmIHBpY2tzLmluZGV4T2YoZmFsbGJhY2tBY3RpdmVQaWNrQ2FuZGlkYXRlKSAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZmFsbGJhY2tBY3RpdmVQaWNrID0gZmFsbGJhY2tBY3RpdmVQaWNrQ2FuZGlkYXRlO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGFwcGx5UGlja3Moe1xuXHRcdFx0XHRcdFx0XHRcdFx0aXRlbXM6IFsuLi5waWNrcywgLi4uYWRkaXRpb25hbFBpY2tzXSxcblx0XHRcdFx0XHRcdFx0XHRcdGFjdGl2ZTogYWN0aXZlUGljayB8fCBhZGRpdGlvbmFsQWN0aXZlUGljayB8fCBmYWxsYmFja0FjdGl2ZVBpY2tcblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdFx0aWYgKCFwaWNrc1Rva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0cGlja2VyLmJ1c3kgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHNsb3dQaWNrc0FwcGxpZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKClcblx0XHRcdFx0XSk7XG5cdFx0XHR9O1xuXG5cdFx0XHQvLyBObyBQaWNrc1xuXHRcdFx0aWYgKHByb3ZpZGVkUGlja3MgPT09IG51bGwpIHtcblx0XHRcdFx0Ly8gSWdub3JlXG5cdFx0XHR9XG5cblx0XHRcdC8vIEZhc3QgYW5kIFNsb3cgUGlja3Ncblx0XHRcdGVsc2UgaWYgKGlzRmFzdEFuZFNsb3dQaWNrcyhwcm92aWRlZFBpY2tzKSkge1xuXHRcdFx0XHRhd2FpdCBhcHBseUZhc3RBbmRTbG93UGlja3MocHJvdmlkZWRQaWNrcyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZhc3QgUGlja3Ncblx0XHRcdGVsc2UgaWYgKCEocHJvdmlkZWRQaWNrcyBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG5cdFx0XHRcdGFwcGx5UGlja3MocHJvdmlkZWRQaWNrcyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNsb3cgUGlja3Ncblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRwaWNrZXIuYnVzeSA9IHRydWU7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgYXdhaXRlZFBpY2tzID0gYXdhaXQgcHJvdmlkZWRQaWNrcztcblx0XHRcdFx0XHRpZiAocGlja3NUb2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChpc0Zhc3RBbmRTbG93UGlja3MoYXdhaXRlZFBpY2tzKSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgYXBwbHlGYXN0QW5kU2xvd1BpY2tzKGF3YWl0ZWRQaWNrcyk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFwcGx5UGlja3MoYXdhaXRlZFBpY2tzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0aWYgKCFwaWNrc1Rva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRwaWNrZXIuYnVzeSA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHBpY2tlci5vbkRpZENoYW5nZVZhbHVlKCgpID0+IHVwZGF0ZVBpY2tlckl0ZW1zKCkpKTtcblx0XHR1cGRhdGVQaWNrZXJJdGVtcygpO1xuXG5cdFx0Ly8gQWNjZXB0IHRoZSBwaWNrIG9uIGFjY2VwdCBhbmQgaGlkZSBwaWNrZXJcblx0XHRkaXNwb3NhYmxlcy5hZGQocGlja2VyLm9uRGlkQWNjZXB0KGV2ZW50ID0+IHtcblx0XHRcdGlmIChydW5PcHRpb25zPy5oYW5kbGVBY2NlcHQpIHtcblx0XHRcdFx0aWYgKCFldmVudC5pbkJhY2tncm91bmQpIHtcblx0XHRcdFx0XHRwaWNrZXIuaGlkZSgpOyAvLyBoaWRlIHBpY2tlciB1bmxlc3Mgd2UgYWNjZXB0IGluIGJhY2tncm91bmRcblx0XHRcdFx0fVxuXHRcdFx0XHRydW5PcHRpb25zLmhhbmRsZUFjY2VwdD8uKHBpY2tlci5hY3RpdmVJdGVtc1swXSwgZXZlbnQuaW5CYWNrZ3JvdW5kKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBbaXRlbV0gPSBwaWNrZXIuc2VsZWN0ZWRJdGVtcztcblx0XHRcdGlmICh0eXBlb2YgaXRlbT8uYWNjZXB0ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdGlmICghZXZlbnQuaW5CYWNrZ3JvdW5kKSB7XG5cdFx0XHRcdFx0cGlja2VyLmhpZGUoKTsgLy8gaGlkZSBwaWNrZXIgdW5sZXNzIHdlIGFjY2VwdCBpbiBiYWNrZ3JvdW5kXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpdGVtLmFjY2VwdChwaWNrZXIua2V5TW9kcywgZXZlbnQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGJ1dHRvblRyaWdnZXIgPSBhc3luYyAoYnV0dG9uOiBJUXVpY2tJbnB1dEJ1dHRvbiwgaXRlbTogVCB8IElQaWNrZXJRdWlja0FjY2Vzc1NlcGFyYXRvcikgPT4ge1xuXHRcdFx0aWYgKHR5cGVvZiBpdGVtLnRyaWdnZXIgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBidXR0b25JbmRleCA9IGl0ZW0uYnV0dG9ucz8uaW5kZXhPZihidXR0b24pID8/IC0xO1xuXHRcdFx0aWYgKGJ1dHRvbkluZGV4ID49IDApIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gaXRlbS50cmlnZ2VyKGJ1dHRvbkluZGV4LCBwaWNrZXIua2V5TW9kcyk7XG5cdFx0XHRcdGNvbnN0IGFjdGlvbiA9ICh0eXBlb2YgcmVzdWx0ID09PSAnbnVtYmVyJykgPyByZXN1bHQgOiBhd2FpdCByZXN1bHQ7XG5cblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3dpdGNoIChhY3Rpb24pIHtcblx0XHRcdFx0XHRjYXNlIFRyaWdnZXJBY3Rpb24uTk9fQUNUSU9OOlxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSBUcmlnZ2VyQWN0aW9uLkNMT1NFX1BJQ0tFUjpcblx0XHRcdFx0XHRcdHBpY2tlci5oaWRlKCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIFRyaWdnZXJBY3Rpb24uUkVGUkVTSF9QSUNLRVI6XG5cdFx0XHRcdFx0XHR1cGRhdGVQaWNrZXJJdGVtcygpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSBUcmlnZ2VyQWN0aW9uLlJFTU9WRV9JVEVNOiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpbmRleCA9IHBpY2tlci5pdGVtcy5pbmRleE9mKGl0ZW0pO1xuXHRcdFx0XHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBpdGVtcyA9IHBpY2tlci5pdGVtcy5zbGljZSgpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCByZW1vdmVkID0gaXRlbXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgYWN0aXZlSXRlbXMgPSBwaWNrZXIuYWN0aXZlSXRlbXMuZmlsdGVyKGFjdGl2ZUl0ZW0gPT4gYWN0aXZlSXRlbSAhPT0gcmVtb3ZlZFswXSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGtlZXBTY3JvbGxQb3NpdGlvbkJlZm9yZSA9IHBpY2tlci5rZWVwU2Nyb2xsUG9zaXRpb247XG5cdFx0XHRcdFx0XHRcdHBpY2tlci5rZWVwU2Nyb2xsUG9zaXRpb24gPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRwaWNrZXIuaXRlbXMgPSBpdGVtcztcblx0XHRcdFx0XHRcdFx0aWYgKGFjdGl2ZUl0ZW1zKSB7XG5cdFx0XHRcdFx0XHRcdFx0cGlja2VyLmFjdGl2ZUl0ZW1zID0gYWN0aXZlSXRlbXM7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cGlja2VyLmtlZXBTY3JvbGxQb3NpdGlvbiA9IGtlZXBTY3JvbGxQb3NpdGlvbkJlZm9yZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBUcmlnZ2VyIHRoZSBwaWNrIHdpdGggYnV0dG9uIGluZGV4IGlmIGJ1dHRvbiB0cmlnZ2VyZWRcblx0XHRkaXNwb3NhYmxlcy5hZGQocGlja2VyLm9uRGlkVHJpZ2dlckl0ZW1CdXR0b24oKHsgYnV0dG9uLCBpdGVtIH0pID0+IGJ1dHRvblRyaWdnZXIoYnV0dG9uLCBpdGVtKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrZXIub25EaWRUcmlnZ2VyU2VwYXJhdG9yQnV0dG9uKCh7IGJ1dHRvbiwgc2VwYXJhdG9yIH0pID0+IGJ1dHRvblRyaWdnZXIoYnV0dG9uLCBzZXBhcmF0b3IpKSk7XG5cblx0XHRyZXR1cm4gZGlzcG9zYWJsZXM7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBhbiBhcnJheSBvZiBwaWNrcyBhbmQgc2VwYXJhdG9ycyBhcyBuZWVkZWQuIElmIHRoZSBwaWNrcyBhcmUgcmVzb2x2ZWRcblx0ICogbG9uZyBydW5uaW5nLCB0aGUgcHJvdmlkZWQgY2FuY2VsbGF0aW9uIHRva2VuIHNob3VsZCBiZSB1c2VkIHRvIGNhbmNlbCB0aGVcblx0ICogb3BlcmF0aW9uIHdoZW4gdGhlIHRva2VuIHNpZ25hbHMgdGhpcy5cblx0ICpcblx0ICogVGhlIGltcGxlbWVudG9yIGlzIHJlc3BvbnNpYmxlIGZvciBmaWx0ZXJpbmcgYW5kIHNvcnRpbmcgdGhlIHBpY2tzIGdpdmVuIHRoZVxuXHQgKiBwcm92aWRlZCBgZmlsdGVyYC5cblx0ICpcblx0ICogQHBhcmFtIGZpbHRlciBhIGZpbHRlciB0byBhcHBseSB0byB0aGUgcGlja3MuXG5cdCAqIEBwYXJhbSBkaXNwb3NhYmxlcyBjYW4gYmUgdXNlZCB0byByZWdpc3RlciBkaXNwb3NhYmxlcyB0aGF0IHNob3VsZCBiZSBjbGVhbmVkXG5cdCAqIHVwIHdoZW4gdGhlIHBpY2tlciBjbG9zZXMuXG5cdCAqIEBwYXJhbSB0b2tlbiBmb3IgbG9uZyBydW5uaW5nIHRhc2tzLCBpbXBsZW1lbnRvcnMgbmVlZCB0byBjaGVjayBvbiBjYW5jZWxsYXRpb25cblx0ICogdGhyb3VnaCB0aGlzIHRva2VuLlxuXHQgKiBAcmV0dXJucyB0aGUgcGlja3MgZWl0aGVyIGRpcmVjdGx5LCBhcyBwcm9taXNlIG9yIGNvbWJpbmVkIGZhc3QgYW5kIHNsb3cgcmVzdWx0cy5cblx0ICogUGlja2VycyBjYW4gcmV0dXJuIGBudWxsYCB0byBzaWduYWwgdGhhdCBubyBjaGFuZ2UgaW4gcGlja3MgaXMgbmVlZGVkLlxuXHQgKi9cblx0cHJvdGVjdGVkIGFic3RyYWN0IF9nZXRQaWNrcyhmaWx0ZXI6IHN0cmluZywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBydW5PcHRpb25zPzogSVF1aWNrQWNjZXNzUHJvdmlkZXJSdW5PcHRpb25zKTogUGlja3M8VD4gfCBQcm9taXNlPFBpY2tzPFQ+IHwgRmFzdEFuZFNsb3dQaWNrczxUPj4gfCBGYXN0QW5kU2xvd1BpY2tzPFQ+IHwgbnVsbDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxZQUFZLGlCQUE4Qix5QkFBeUI7QUFHNUUsU0FBUyxrQkFBa0I7QUFFcEIsSUFBSyxnQkFBTCxrQkFBS0EsbUJBQUw7QUFLTixFQUFBQSw4QkFBQTtBQUtBLEVBQUFBLDhCQUFBO0FBS0EsRUFBQUEsOEJBQUE7QUFLQSxFQUFBQSw4QkFBQTtBQXBCVyxTQUFBQTtBQUFBLEdBQUE7QUF5R1osU0FBUyxrQkFBcUIsS0FBeUM7QUFDdEUsUUFBTSxZQUFZO0FBRWxCLFNBQU8sTUFBTSxRQUFRLFVBQVUsS0FBSztBQUNyQztBQUVBLFNBQVMsbUJBQXNCLEtBQTBDO0FBQ3hFLFFBQU0sWUFBWTtBQUVsQixTQUFPLENBQUMsQ0FBQyxVQUFVLFNBQVMsVUFBVSwyQkFBMkI7QUFDbEU7QUFFTyxNQUFlLGtDQUFvRSxXQUEyQztBQUFBLEVBRXBJLFlBQW9CLFFBQTBCLFNBQWdEO0FBQzdGLFVBQU07QUFEYTtBQUEwQjtBQUFBLEVBRTlDO0FBQUEsRUFFQSxRQUFRLFFBQWdELE9BQTBCLFlBQTBEO0FBQzNJLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUd4QyxXQUFPLHdCQUF3QixDQUFDLENBQUMsS0FBSyxTQUFTO0FBRy9DLFdBQU8sZUFBZSxPQUFPLHFCQUFxQixPQUFPLGdCQUFnQixPQUFPLGNBQWM7QUFHOUYsUUFBSSxXQUFnRDtBQUNwRCxVQUFNLGtCQUFrQixZQUFZLElBQUksSUFBSSxrQkFBa0IsQ0FBQztBQUMvRCxVQUFNLG9CQUFvQixZQUFZO0FBQ3JDLFlBQU0sbUJBQW1CLGdCQUFnQixRQUFRLElBQUksZ0JBQWdCO0FBR3JFLGdCQUFVLFFBQVEsSUFBSTtBQUN0QixhQUFPLE9BQU87QUFHZCxpQkFBVyxpQkFBaUIsSUFBSSxJQUFJLHdCQUF3QixLQUFLLENB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
