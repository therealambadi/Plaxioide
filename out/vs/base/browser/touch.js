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
import * as DomUtils from "./dom.js";
import { mainWindow } from "./window.js";
import { memoize } from "../common/decorators.js";
import { Event as EventUtils } from "../common/event.js";
import { Disposable, markAsSingleton, toDisposable } from "../common/lifecycle.js";
import { LinkedList } from "../common/linkedList.js";
var EventType;
((EventType2) => {
  EventType2.Tap = "-monaco-gesturetap";
  EventType2.Change = "-monaco-gesturechange";
  EventType2.Start = "-monaco-gesturestart";
  EventType2.End = "-monaco-gesturesend";
  EventType2.Contextmenu = "-monaco-gesturecontextmenu";
})(EventType || (EventType = {}));
const _Gesture = class _Gesture extends Disposable {
  // ms
  constructor() {
    super();
    this.dispatched = false;
    this.targets = new LinkedList();
    this.ignoreTargets = new LinkedList();
    this.activeTouches = {};
    this.handle = null;
    this._lastSetTapCountTime = 0;
    this._register(EventUtils.runAndSubscribe(DomUtils.onDidRegisterWindow, ({ window, disposables }) => {
      disposables.add(DomUtils.addDisposableListener(window.document, "touchstart", (e) => this.onTouchStart(e), { passive: false }));
      disposables.add(DomUtils.addDisposableListener(window.document, "touchend", (e) => this.onTouchEnd(window, e)));
      disposables.add(DomUtils.addDisposableListener(window.document, "touchmove", (e) => this.onTouchMove(e), { passive: false }));
    }, { window: mainWindow, disposables: this._store }));
  }
  static addTarget(element) {
    if (!_Gesture.isTouchDevice()) {
      return Disposable.None;
    }
    if (!_Gesture.INSTANCE) {
      _Gesture.INSTANCE = markAsSingleton(new _Gesture());
    }
    const remove = _Gesture.INSTANCE.targets.push(element);
    return toDisposable(remove);
  }
  static ignoreTarget(element) {
    if (!_Gesture.isTouchDevice()) {
      return Disposable.None;
    }
    if (!_Gesture.INSTANCE) {
      _Gesture.INSTANCE = markAsSingleton(new _Gesture());
    }
    const remove = _Gesture.INSTANCE.ignoreTargets.push(element);
    return toDisposable(remove);
  }
  static isTouchDevice() {
    return "ontouchstart" in mainWindow || navigator.maxTouchPoints > 0;
  }
  dispose() {
    if (this.handle) {
      this.handle.dispose();
      this.handle = null;
    }
    super.dispose();
  }
  onTouchStart(e) {
    const timestamp = Date.now();
    if (this.handle) {
      this.handle.dispose();
      this.handle = null;
    }
    for (let i = 0, len = e.targetTouches.length; i < len; i++) {
      const touch = e.targetTouches.item(i);
      this.activeTouches[touch.identifier] = {
        id: touch.identifier,
        initialTarget: touch.target,
        initialTimeStamp: timestamp,
        initialPageX: touch.pageX,
        initialPageY: touch.pageY,
        rollingTimestamps: [timestamp],
        rollingPageX: [touch.pageX],
        rollingPageY: [touch.pageY]
      };
      const evt = this.newGestureEvent(EventType.Start, touch.target);
      evt.pageX = touch.pageX;
      evt.pageY = touch.pageY;
      this.dispatchEvent(evt);
    }
    if (this.dispatched) {
      e.preventDefault();
      e.stopPropagation();
      this.dispatched = false;
    }
  }
  onTouchEnd(targetWindow, e) {
    const timestamp = Date.now();
    const activeTouchCount = Object.keys(this.activeTouches).length;
    for (let i = 0, len = e.changedTouches.length; i < len; i++) {
      const touch = e.changedTouches.item(i);
      if (!this.activeTouches.hasOwnProperty(String(touch.identifier))) {
        console.warn("move of an UNKNOWN touch", touch);
        continue;
      }
      const data = this.activeTouches[touch.identifier], holdTime = Date.now() - data.initialTimeStamp;
      if (holdTime < _Gesture.HOLD_DELAY && Math.abs(data.initialPageX - data.rollingPageX.at(-1)) < 30 && Math.abs(data.initialPageY - data.rollingPageY.at(-1)) < 30) {
        const evt = this.newGestureEvent(EventType.Tap, data.initialTarget);
        evt.pageX = data.rollingPageX.at(-1);
        evt.pageY = data.rollingPageY.at(-1);
        this.dispatchEvent(evt);
      } else if (holdTime >= _Gesture.HOLD_DELAY && Math.abs(data.initialPageX - data.rollingPageX.at(-1)) < 30 && Math.abs(data.initialPageY - data.rollingPageY.at(-1)) < 30) {
        const evt = this.newGestureEvent(EventType.Contextmenu, data.initialTarget);
        evt.pageX = data.rollingPageX.at(-1);
        evt.pageY = data.rollingPageY.at(-1);
        this.dispatchEvent(evt);
      } else if (activeTouchCount === 1) {
        const finalX = data.rollingPageX.at(-1);
        const finalY = data.rollingPageY.at(-1);
        const deltaT = data.rollingTimestamps.at(-1) - data.rollingTimestamps[0];
        const deltaX = finalX - data.rollingPageX[0];
        const deltaY = finalY - data.rollingPageY[0];
        const dispatchTo = [...this.targets].filter((t) => data.initialTarget instanceof Node && t.contains(data.initialTarget));
        this.inertia(
          targetWindow,
          dispatchTo,
          timestamp,
          // time now
          Math.abs(deltaX) / deltaT,
          // speed
          deltaX > 0 ? 1 : -1,
          // x direction
          finalX,
          // x now
          Math.abs(deltaY) / deltaT,
          // y speed
          deltaY > 0 ? 1 : -1,
          // y direction
          finalY
          // y now
        );
      }
      this.dispatchEvent(this.newGestureEvent(EventType.End, data.initialTarget));
      delete this.activeTouches[touch.identifier];
    }
    if (this.dispatched) {
      e.preventDefault();
      e.stopPropagation();
      this.dispatched = false;
    }
  }
  newGestureEvent(type, initialTarget) {
    const event = document.createEvent("CustomEvent");
    event.initEvent(type, false, true);
    event.initialTarget = initialTarget;
    event.tapCount = 0;
    return event;
  }
  dispatchEvent(event) {
    if (event.type === EventType.Tap) {
      const currentTime = (/* @__PURE__ */ new Date()).getTime();
      let setTapCount = 0;
      if (currentTime - this._lastSetTapCountTime > _Gesture.CLEAR_TAP_COUNT_TIME) {
        setTapCount = 1;
      } else {
        setTapCount = 2;
      }
      this._lastSetTapCountTime = currentTime;
      event.tapCount = setTapCount;
    } else if (event.type === EventType.Change || event.type === EventType.Contextmenu) {
      this._lastSetTapCountTime = 0;
    }
    if (event.initialTarget instanceof Node) {
      for (const ignoreTarget of this.ignoreTargets) {
        if (ignoreTarget.contains(event.initialTarget)) {
          return;
        }
      }
      const targets = [];
      for (const target of this.targets) {
        if (target.contains(event.initialTarget)) {
          let depth = 0;
          let now = event.initialTarget;
          while (now && now !== target) {
            depth++;
            now = now.parentElement;
          }
          targets.push([depth, target]);
        }
      }
      targets.sort((a, b) => a[0] - b[0]);
      for (const [_, target] of targets) {
        target.dispatchEvent(event);
        this.dispatched = true;
      }
    }
  }
  inertia(targetWindow, dispatchTo, t1, vX, dirX, x, vY, dirY, y) {
    this.handle = DomUtils.scheduleAtNextAnimationFrame(targetWindow, () => {
      const now = Date.now();
      const deltaT = now - t1;
      let delta_pos_x = 0, delta_pos_y = 0;
      let stopped = true;
      vX += _Gesture.SCROLL_FRICTION * deltaT;
      vY += _Gesture.SCROLL_FRICTION * deltaT;
      if (vX > 0) {
        stopped = false;
        delta_pos_x = dirX * vX * deltaT;
      }
      if (vY > 0) {
        stopped = false;
        delta_pos_y = dirY * vY * deltaT;
      }
      const evt = this.newGestureEvent(EventType.Change);
      evt.translationX = delta_pos_x;
      evt.translationY = delta_pos_y;
      dispatchTo.forEach((d) => d.dispatchEvent(evt));
      if (!stopped) {
        this.inertia(targetWindow, dispatchTo, now, vX, dirX, x + delta_pos_x, vY, dirY, y + delta_pos_y);
      }
    });
  }
  onTouchMove(e) {
    const timestamp = Date.now();
    for (let i = 0, len = e.changedTouches.length; i < len; i++) {
      const touch = e.changedTouches.item(i);
      if (!this.activeTouches.hasOwnProperty(String(touch.identifier))) {
        console.warn("end of an UNKNOWN touch", touch);
        continue;
      }
      const data = this.activeTouches[touch.identifier];
      const evt = this.newGestureEvent(EventType.Change, data.initialTarget);
      evt.translationX = touch.pageX - data.rollingPageX.at(-1);
      evt.translationY = touch.pageY - data.rollingPageY.at(-1);
      evt.pageX = touch.pageX;
      evt.pageY = touch.pageY;
      this.dispatchEvent(evt);
      if (data.rollingPageX.length > 3) {
        data.rollingPageX.shift();
        data.rollingPageY.shift();
        data.rollingTimestamps.shift();
      }
      data.rollingPageX.push(touch.pageX);
      data.rollingPageY.push(touch.pageY);
      data.rollingTimestamps.push(timestamp);
    }
    if (this.dispatched) {
      e.preventDefault();
      e.stopPropagation();
      this.dispatched = false;
    }
  }
};
_Gesture.SCROLL_FRICTION = -5e-3;
_Gesture.HOLD_DELAY = 700;
_Gesture.CLEAR_TAP_COUNT_TIME = 400;
__decorateClass([
  memoize
], _Gesture, "isTouchDevice", 1);
let Gesture = _Gesture;
export {
  EventType,
  Gesture
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdG91Y2gudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBEb21VdGlscyBmcm9tICcuL2RvbS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi93aW5kb3cuanMnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IEV2ZW50IGFzIEV2ZW50VXRpbHMgfSBmcm9tICcuLi9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIG1hcmtBc1NpbmdsZXRvbiwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBMaW5rZWRMaXN0IH0gZnJvbSAnLi4vY29tbW9uL2xpbmtlZExpc3QuanMnO1xuXG5leHBvcnQgbmFtZXNwYWNlIEV2ZW50VHlwZSB7XG5cdGV4cG9ydCBjb25zdCBUYXAgPSAnLW1vbmFjby1nZXN0dXJldGFwJztcblx0ZXhwb3J0IGNvbnN0IENoYW5nZSA9ICctbW9uYWNvLWdlc3R1cmVjaGFuZ2UnO1xuXHRleHBvcnQgY29uc3QgU3RhcnQgPSAnLW1vbmFjby1nZXN0dXJlc3RhcnQnO1xuXHRleHBvcnQgY29uc3QgRW5kID0gJy1tb25hY28tZ2VzdHVyZXNlbmQnO1xuXHRleHBvcnQgY29uc3QgQ29udGV4dG1lbnUgPSAnLW1vbmFjby1nZXN0dXJlY29udGV4dG1lbnUnO1xufVxuXG5pbnRlcmZhY2UgVG91Y2hEYXRhIHtcblx0aWQ6IG51bWJlcjtcblx0aW5pdGlhbFRhcmdldDogRXZlbnRUYXJnZXQ7XG5cdGluaXRpYWxUaW1lU3RhbXA6IG51bWJlcjtcblx0aW5pdGlhbFBhZ2VYOiBudW1iZXI7XG5cdGluaXRpYWxQYWdlWTogbnVtYmVyO1xuXHRyb2xsaW5nVGltZXN0YW1wczogbnVtYmVyW107XG5cdHJvbGxpbmdQYWdlWDogbnVtYmVyW107XG5cdHJvbGxpbmdQYWdlWTogbnVtYmVyW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2VzdHVyZUV2ZW50IGV4dGVuZHMgTW91c2VFdmVudCB7XG5cdGluaXRpYWxUYXJnZXQ6IEV2ZW50VGFyZ2V0IHwgdW5kZWZpbmVkO1xuXHR0cmFuc2xhdGlvblg6IG51bWJlcjtcblx0dHJhbnNsYXRpb25ZOiBudW1iZXI7XG5cdHBhZ2VYOiBudW1iZXI7XG5cdHBhZ2VZOiBudW1iZXI7XG5cdHRhcENvdW50OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBUb3VjaCB7XG5cdGlkZW50aWZpZXI6IG51bWJlcjtcblx0c2NyZWVuWDogbnVtYmVyO1xuXHRzY3JlZW5ZOiBudW1iZXI7XG5cdGNsaWVudFg6IG51bWJlcjtcblx0Y2xpZW50WTogbnVtYmVyO1xuXHRwYWdlWDogbnVtYmVyO1xuXHRwYWdlWTogbnVtYmVyO1xuXHRyYWRpdXNYOiBudW1iZXI7XG5cdHJhZGl1c1k6IG51bWJlcjtcblx0cm90YXRpb25BbmdsZTogbnVtYmVyO1xuXHRmb3JjZTogbnVtYmVyO1xuXHR0YXJnZXQ6IEVsZW1lbnQ7XG59XG5cbmludGVyZmFjZSBUb3VjaExpc3Qge1xuXHRbaTogbnVtYmVyXTogVG91Y2g7XG5cdGxlbmd0aDogbnVtYmVyO1xuXHRpdGVtKGluZGV4OiBudW1iZXIpOiBUb3VjaDtcblx0aWRlbnRpZmllZFRvdWNoKGlkOiBudW1iZXIpOiBUb3VjaDtcbn1cblxuaW50ZXJmYWNlIFRvdWNoRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG5cdHRvdWNoZXM6IFRvdWNoTGlzdDtcblx0dGFyZ2V0VG91Y2hlczogVG91Y2hMaXN0O1xuXHRjaGFuZ2VkVG91Y2hlczogVG91Y2hMaXN0O1xufVxuXG5leHBvcnQgY2xhc3MgR2VzdHVyZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNDUk9MTF9GUklDVElPTiA9IC0wLjAwNTtcblx0cHJpdmF0ZSBzdGF0aWMgSU5TVEFOQ0U6IEdlc3R1cmU7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEhPTERfREVMQVkgPSA3MDA7XG5cblx0cHJpdmF0ZSBkaXNwYXRjaGVkID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgdGFyZ2V0cyA9IG5ldyBMaW5rZWRMaXN0PEhUTUxFbGVtZW50PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGlnbm9yZVRhcmdldHMgPSBuZXcgTGlua2VkTGlzdDxIVE1MRWxlbWVudD4oKTtcblx0cHJpdmF0ZSBoYW5kbGU6IElEaXNwb3NhYmxlIHwgbnVsbDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGl2ZVRvdWNoZXM6IHsgW2lkOiBudW1iZXJdOiBUb3VjaERhdGEgfTtcblxuXHRwcml2YXRlIF9sYXN0U2V0VGFwQ291bnRUaW1lOiBudW1iZXI7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQ0xFQVJfVEFQX0NPVU5UX1RJTUUgPSA0MDA7IC8vIG1zXG5cblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmFjdGl2ZVRvdWNoZXMgPSB7fTtcblx0XHR0aGlzLmhhbmRsZSA9IG51bGw7XG5cdFx0dGhpcy5fbGFzdFNldFRhcENvdW50VGltZSA9IDA7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudFV0aWxzLnJ1bkFuZFN1YnNjcmliZShEb21VdGlscy5vbkRpZFJlZ2lzdGVyV2luZG93LCAoeyB3aW5kb3csIGRpc3Bvc2FibGVzIH0pID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChEb21VdGlscy5hZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LmRvY3VtZW50LCAndG91Y2hzdGFydCcsIChlOiBUb3VjaEV2ZW50KSA9PiB0aGlzLm9uVG91Y2hTdGFydChlKSwgeyBwYXNzaXZlOiBmYWxzZSB9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoRG9tVXRpbHMuYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpbmRvdy5kb2N1bWVudCwgJ3RvdWNoZW5kJywgKGU6IFRvdWNoRXZlbnQpID0+IHRoaXMub25Ub3VjaEVuZCh3aW5kb3csIGUpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoRG9tVXRpbHMuYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHdpbmRvdy5kb2N1bWVudCwgJ3RvdWNobW92ZScsIChlOiBUb3VjaEV2ZW50KSA9PiB0aGlzLm9uVG91Y2hNb3ZlKGUpLCB7IHBhc3NpdmU6IGZhbHNlIH0pKTtcblx0XHR9LCB7IHdpbmRvdzogbWFpbldpbmRvdywgZGlzcG9zYWJsZXM6IHRoaXMuX3N0b3JlIH0pKTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYWRkVGFyZ2V0KGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogSURpc3Bvc2FibGUge1xuXHRcdGlmICghR2VzdHVyZS5pc1RvdWNoRGV2aWNlKCkpIHtcblx0XHRcdHJldHVybiBEaXNwb3NhYmxlLk5vbmU7XG5cdFx0fVxuXHRcdGlmICghR2VzdHVyZS5JTlNUQU5DRSkge1xuXHRcdFx0R2VzdHVyZS5JTlNUQU5DRSA9IG1hcmtBc1NpbmdsZXRvbihuZXcgR2VzdHVyZSgpKTtcblx0XHR9XG5cblx0XHRjb25zdCByZW1vdmUgPSBHZXN0dXJlLklOU1RBTkNFLnRhcmdldHMucHVzaChlbGVtZW50KTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKHJlbW92ZSk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGlnbm9yZVRhcmdldChlbGVtZW50OiBIVE1MRWxlbWVudCk6IElEaXNwb3NhYmxlIHtcblx0XHRpZiAoIUdlc3R1cmUuaXNUb3VjaERldmljZSgpKSB7XG5cdFx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lO1xuXHRcdH1cblx0XHRpZiAoIUdlc3R1cmUuSU5TVEFOQ0UpIHtcblx0XHRcdEdlc3R1cmUuSU5TVEFOQ0UgPSBtYXJrQXNTaW5nbGV0b24obmV3IEdlc3R1cmUoKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVtb3ZlID0gR2VzdHVyZS5JTlNUQU5DRS5pZ25vcmVUYXJnZXRzLnB1c2goZWxlbWVudCk7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZShyZW1vdmUpO1xuXHR9XG5cblx0QG1lbW9pemVcblx0c3RhdGljIGlzVG91Y2hEZXZpY2UoKTogYm9vbGVhbiB7XG5cdFx0Ly8gYCdvbnRvdWNoc3RhcnQnIGluIHdpbmRvd2AgYWx3YXlzIGV2YWx1YXRlcyB0byB0cnVlIHdpdGggdHlwZXNjcmlwdCdzIG1vZGVybiB0eXBpbmdzLiBUaGlzIGNhdXNlcyBgd2luZG93YCB0byBiZVxuXHRcdC8vIGBuZXZlcmAgbGF0ZXIgaW4gYHdpbmRvdy5uYXZpZ2F0b3JgLiBUaGF0J3Mgd2h5IHdlIG5lZWQgdGhlIGV4cGxpY2l0IGB3aW5kb3cgYXMgV2luZG93YCBjYXN0XG5cdFx0cmV0dXJuICdvbnRvdWNoc3RhcnQnIGluIG1haW5XaW5kb3cgfHwgbmF2aWdhdG9yLm1heFRvdWNoUG9pbnRzID4gMDtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmhhbmRsZSkge1xuXHRcdFx0dGhpcy5oYW5kbGUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5oYW5kbGUgPSBudWxsO1xuXHRcdH1cblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgb25Ub3VjaFN0YXJ0KGU6IFRvdWNoRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpOyAvLyB1c2UgRGF0ZS5ub3coKSBiZWNhdXNlIG9uIEZGIGUudGltZVN0YW1wIGlzIG5vdCBlcG9jaCBiYXNlZC5cblxuXHRcdGlmICh0aGlzLmhhbmRsZSkge1xuXHRcdFx0dGhpcy5oYW5kbGUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5oYW5kbGUgPSBudWxsO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBlLnRhcmdldFRvdWNoZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHRvdWNoID0gZS50YXJnZXRUb3VjaGVzLml0ZW0oaSk7XG5cblx0XHRcdHRoaXMuYWN0aXZlVG91Y2hlc1t0b3VjaC5pZGVudGlmaWVyXSA9IHtcblx0XHRcdFx0aWQ6IHRvdWNoLmlkZW50aWZpZXIsXG5cdFx0XHRcdGluaXRpYWxUYXJnZXQ6IHRvdWNoLnRhcmdldCxcblx0XHRcdFx0aW5pdGlhbFRpbWVTdGFtcDogdGltZXN0YW1wLFxuXHRcdFx0XHRpbml0aWFsUGFnZVg6IHRvdWNoLnBhZ2VYLFxuXHRcdFx0XHRpbml0aWFsUGFnZVk6IHRvdWNoLnBhZ2VZLFxuXHRcdFx0XHRyb2xsaW5nVGltZXN0YW1wczogW3RpbWVzdGFtcF0sXG5cdFx0XHRcdHJvbGxpbmdQYWdlWDogW3RvdWNoLnBhZ2VYXSxcblx0XHRcdFx0cm9sbGluZ1BhZ2VZOiBbdG91Y2gucGFnZVldXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBldnQgPSB0aGlzLm5ld0dlc3R1cmVFdmVudChFdmVudFR5cGUuU3RhcnQsIHRvdWNoLnRhcmdldCk7XG5cdFx0XHRldnQucGFnZVggPSB0b3VjaC5wYWdlWDtcblx0XHRcdGV2dC5wYWdlWSA9IHRvdWNoLnBhZ2VZO1xuXHRcdFx0dGhpcy5kaXNwYXRjaEV2ZW50KGV2dCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZGlzcGF0Y2hlZCkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlZCA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Ub3VjaEVuZCh0YXJnZXRXaW5kb3c6IFdpbmRvdywgZTogVG91Y2hFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7IC8vIHVzZSBEYXRlLm5vdygpIGJlY2F1c2Ugb24gRkYgZS50aW1lU3RhbXAgaXMgbm90IGVwb2NoIGJhc2VkLlxuXG5cdFx0Y29uc3QgYWN0aXZlVG91Y2hDb3VudCA9IE9iamVjdC5rZXlzKHRoaXMuYWN0aXZlVG91Y2hlcykubGVuZ3RoO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGUuY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblxuXHRcdFx0Y29uc3QgdG91Y2ggPSBlLmNoYW5nZWRUb3VjaGVzLml0ZW0oaSk7XG5cblx0XHRcdGlmICghdGhpcy5hY3RpdmVUb3VjaGVzLmhhc093blByb3BlcnR5KFN0cmluZyh0b3VjaC5pZGVudGlmaWVyKSkpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdtb3ZlIG9mIGFuIFVOS05PV04gdG91Y2gnLCB0b3VjaCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkYXRhID0gdGhpcy5hY3RpdmVUb3VjaGVzW3RvdWNoLmlkZW50aWZpZXJdLFxuXHRcdFx0XHRob2xkVGltZSA9IERhdGUubm93KCkgLSBkYXRhLmluaXRpYWxUaW1lU3RhbXA7XG5cblx0XHRcdGlmIChob2xkVGltZSA8IEdlc3R1cmUuSE9MRF9ERUxBWVxuXHRcdFx0XHQmJiBNYXRoLmFicyhkYXRhLmluaXRpYWxQYWdlWCAtIGRhdGEucm9sbGluZ1BhZ2VYLmF0KC0xKSEpIDwgMzBcblx0XHRcdFx0JiYgTWF0aC5hYnMoZGF0YS5pbml0aWFsUGFnZVkgLSBkYXRhLnJvbGxpbmdQYWdlWS5hdCgtMSkhKSA8IDMwKSB7XG5cblx0XHRcdFx0Y29uc3QgZXZ0ID0gdGhpcy5uZXdHZXN0dXJlRXZlbnQoRXZlbnRUeXBlLlRhcCwgZGF0YS5pbml0aWFsVGFyZ2V0KTtcblx0XHRcdFx0ZXZ0LnBhZ2VYID0gZGF0YS5yb2xsaW5nUGFnZVguYXQoLTEpITtcblx0XHRcdFx0ZXZ0LnBhZ2VZID0gZGF0YS5yb2xsaW5nUGFnZVkuYXQoLTEpITtcblx0XHRcdFx0dGhpcy5kaXNwYXRjaEV2ZW50KGV2dCk7XG5cblx0XHRcdH0gZWxzZSBpZiAoaG9sZFRpbWUgPj0gR2VzdHVyZS5IT0xEX0RFTEFZXG5cdFx0XHRcdCYmIE1hdGguYWJzKGRhdGEuaW5pdGlhbFBhZ2VYIC0gZGF0YS5yb2xsaW5nUGFnZVguYXQoLTEpISkgPCAzMFxuXHRcdFx0XHQmJiBNYXRoLmFicyhkYXRhLmluaXRpYWxQYWdlWSAtIGRhdGEucm9sbGluZ1BhZ2VZLmF0KC0xKSEpIDwgMzApIHtcblxuXHRcdFx0XHRjb25zdCBldnQgPSB0aGlzLm5ld0dlc3R1cmVFdmVudChFdmVudFR5cGUuQ29udGV4dG1lbnUsIGRhdGEuaW5pdGlhbFRhcmdldCk7XG5cdFx0XHRcdGV2dC5wYWdlWCA9IGRhdGEucm9sbGluZ1BhZ2VYLmF0KC0xKSE7XG5cdFx0XHRcdGV2dC5wYWdlWSA9IGRhdGEucm9sbGluZ1BhZ2VZLmF0KC0xKSE7XG5cdFx0XHRcdHRoaXMuZGlzcGF0Y2hFdmVudChldnQpO1xuXG5cdFx0XHR9IGVsc2UgaWYgKGFjdGl2ZVRvdWNoQ291bnQgPT09IDEpIHtcblx0XHRcdFx0Y29uc3QgZmluYWxYID0gZGF0YS5yb2xsaW5nUGFnZVguYXQoLTEpITtcblx0XHRcdFx0Y29uc3QgZmluYWxZID0gZGF0YS5yb2xsaW5nUGFnZVkuYXQoLTEpITtcblxuXHRcdFx0XHRjb25zdCBkZWx0YVQgPSBkYXRhLnJvbGxpbmdUaW1lc3RhbXBzLmF0KC0xKSEgLSBkYXRhLnJvbGxpbmdUaW1lc3RhbXBzWzBdO1xuXHRcdFx0XHRjb25zdCBkZWx0YVggPSBmaW5hbFggLSBkYXRhLnJvbGxpbmdQYWdlWFswXTtcblx0XHRcdFx0Y29uc3QgZGVsdGFZID0gZmluYWxZIC0gZGF0YS5yb2xsaW5nUGFnZVlbMF07XG5cblx0XHRcdFx0Ly8gV2UgbmVlZCB0byBnZXQgYWxsIHRoZSBkaXNwYXRjaCB0YXJnZXRzIG9uIHRoZSBzdGFydCBvZiB0aGUgaW5lcnRpYSBldmVudFxuXHRcdFx0XHRjb25zdCBkaXNwYXRjaFRvID0gWy4uLnRoaXMudGFyZ2V0c10uZmlsdGVyKHQgPT4gZGF0YS5pbml0aWFsVGFyZ2V0IGluc3RhbmNlb2YgTm9kZSAmJiB0LmNvbnRhaW5zKGRhdGEuaW5pdGlhbFRhcmdldCkpO1xuXHRcdFx0XHR0aGlzLmluZXJ0aWEodGFyZ2V0V2luZG93LCBkaXNwYXRjaFRvLCB0aW1lc3RhbXAsXHQvLyB0aW1lIG5vd1xuXHRcdFx0XHRcdE1hdGguYWJzKGRlbHRhWCkgLyBkZWx0YVQsXHRcdFx0XHRcdFx0Ly8gc3BlZWRcblx0XHRcdFx0XHRkZWx0YVggPiAwID8gMSA6IC0xLFx0XHRcdFx0XHRcdFx0Ly8geCBkaXJlY3Rpb25cblx0XHRcdFx0XHRmaW5hbFgsXHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHggbm93XG5cdFx0XHRcdFx0TWF0aC5hYnMoZGVsdGFZKSAvIGRlbHRhVCwgIFx0XHRcdFx0XHQvLyB5IHNwZWVkXG5cdFx0XHRcdFx0ZGVsdGFZID4gMCA/IDEgOiAtMSxcdFx0XHRcdFx0XHRcdC8vIHkgZGlyZWN0aW9uXG5cdFx0XHRcdFx0ZmluYWxZXHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHkgbm93XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblxuXHRcdFx0dGhpcy5kaXNwYXRjaEV2ZW50KHRoaXMubmV3R2VzdHVyZUV2ZW50KEV2ZW50VHlwZS5FbmQsIGRhdGEuaW5pdGlhbFRhcmdldCkpO1xuXHRcdFx0Ly8gZm9yZ2V0IGFib3V0IHRoaXMgdG91Y2hcblx0XHRcdGRlbGV0ZSB0aGlzLmFjdGl2ZVRvdWNoZXNbdG91Y2guaWRlbnRpZmllcl07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZGlzcGF0Y2hlZCkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlZCA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbmV3R2VzdHVyZUV2ZW50KHR5cGU6IHN0cmluZywgaW5pdGlhbFRhcmdldD86IEV2ZW50VGFyZ2V0KTogR2VzdHVyZUV2ZW50IHtcblx0XHRjb25zdCBldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdDdXN0b21FdmVudCcpIGFzIHVua25vd24gYXMgR2VzdHVyZUV2ZW50O1xuXHRcdGV2ZW50LmluaXRFdmVudCh0eXBlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0ZXZlbnQuaW5pdGlhbFRhcmdldCA9IGluaXRpYWxUYXJnZXQ7XG5cdFx0ZXZlbnQudGFwQ291bnQgPSAwO1xuXHRcdHJldHVybiBldmVudDtcblx0fVxuXG5cdHByaXZhdGUgZGlzcGF0Y2hFdmVudChldmVudDogR2VzdHVyZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGV2ZW50LnR5cGUgPT09IEV2ZW50VHlwZS5UYXApIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRUaW1lID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcblx0XHRcdGxldCBzZXRUYXBDb3VudCA9IDA7XG5cdFx0XHRpZiAoY3VycmVudFRpbWUgLSB0aGlzLl9sYXN0U2V0VGFwQ291bnRUaW1lID4gR2VzdHVyZS5DTEVBUl9UQVBfQ09VTlRfVElNRSkge1xuXHRcdFx0XHRzZXRUYXBDb3VudCA9IDE7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZXRUYXBDb3VudCA9IDI7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2xhc3RTZXRUYXBDb3VudFRpbWUgPSBjdXJyZW50VGltZTtcblx0XHRcdGV2ZW50LnRhcENvdW50ID0gc2V0VGFwQ291bnQ7XG5cdFx0fSBlbHNlIGlmIChldmVudC50eXBlID09PSBFdmVudFR5cGUuQ2hhbmdlIHx8IGV2ZW50LnR5cGUgPT09IEV2ZW50VHlwZS5Db250ZXh0bWVudSkge1xuXHRcdFx0Ly8gdGFwIGlzIGNhbmNlbGVkIGJ5IHNjcm9sbGluZyBvciBjb250ZXh0IG1lbnVcblx0XHRcdHRoaXMuX2xhc3RTZXRUYXBDb3VudFRpbWUgPSAwO1xuXHRcdH1cblxuXHRcdGlmIChldmVudC5pbml0aWFsVGFyZ2V0IGluc3RhbmNlb2YgTm9kZSkge1xuXHRcdFx0Zm9yIChjb25zdCBpZ25vcmVUYXJnZXQgb2YgdGhpcy5pZ25vcmVUYXJnZXRzKSB7XG5cdFx0XHRcdGlmIChpZ25vcmVUYXJnZXQuY29udGFpbnMoZXZlbnQuaW5pdGlhbFRhcmdldCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdGFyZ2V0czogW251bWJlciwgSFRNTEVsZW1lbnRdW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0cykge1xuXHRcdFx0XHRpZiAodGFyZ2V0LmNvbnRhaW5zKGV2ZW50LmluaXRpYWxUYXJnZXQpKSB7XG5cdFx0XHRcdFx0bGV0IGRlcHRoID0gMDtcblx0XHRcdFx0XHRsZXQgbm93OiBOb2RlIHwgbnVsbCA9IGV2ZW50LmluaXRpYWxUYXJnZXQ7XG5cdFx0XHRcdFx0d2hpbGUgKG5vdyAmJiBub3cgIT09IHRhcmdldCkge1xuXHRcdFx0XHRcdFx0ZGVwdGgrKztcblx0XHRcdFx0XHRcdG5vdyA9IG5vdy5wYXJlbnRFbGVtZW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0YXJnZXRzLnB1c2goW2RlcHRoLCB0YXJnZXRdKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0YXJnZXRzLnNvcnQoKGEsIGIpID0+IGFbMF0gLSBiWzBdKTtcblxuXHRcdFx0Zm9yIChjb25zdCBbXywgdGFyZ2V0XSBvZiB0YXJnZXRzKSB7XG5cdFx0XHRcdHRhcmdldC5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcblx0XHRcdFx0dGhpcy5kaXNwYXRjaGVkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGluZXJ0aWEodGFyZ2V0V2luZG93OiBXaW5kb3csIGRpc3BhdGNoVG86IHJlYWRvbmx5IEV2ZW50VGFyZ2V0W10sIHQxOiBudW1iZXIsIHZYOiBudW1iZXIsIGRpclg6IG51bWJlciwgeDogbnVtYmVyLCB2WTogbnVtYmVyLCBkaXJZOiBudW1iZXIsIHk6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuaGFuZGxlID0gRG9tVXRpbHMuc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZSh0YXJnZXRXaW5kb3csICgpID0+IHtcblx0XHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cblx0XHRcdC8vIHZlbG9jaXR5OiBvbGQgc3BlZWQgKyBhY2NlbF9vdmVyX3RpbWVcblx0XHRcdGNvbnN0IGRlbHRhVCA9IG5vdyAtIHQxO1xuXHRcdFx0bGV0IGRlbHRhX3Bvc194ID0gMCwgZGVsdGFfcG9zX3kgPSAwO1xuXHRcdFx0bGV0IHN0b3BwZWQgPSB0cnVlO1xuXG5cdFx0XHR2WCArPSBHZXN0dXJlLlNDUk9MTF9GUklDVElPTiAqIGRlbHRhVDtcblx0XHRcdHZZICs9IEdlc3R1cmUuU0NST0xMX0ZSSUNUSU9OICogZGVsdGFUO1xuXG5cdFx0XHRpZiAodlggPiAwKSB7XG5cdFx0XHRcdHN0b3BwZWQgPSBmYWxzZTtcblx0XHRcdFx0ZGVsdGFfcG9zX3ggPSBkaXJYICogdlggKiBkZWx0YVQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh2WSA+IDApIHtcblx0XHRcdFx0c3RvcHBlZCA9IGZhbHNlO1xuXHRcdFx0XHRkZWx0YV9wb3NfeSA9IGRpclkgKiB2WSAqIGRlbHRhVDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZGlzcGF0Y2ggdHJhbnNsYXRpb24gZXZlbnRcblx0XHRcdGNvbnN0IGV2dCA9IHRoaXMubmV3R2VzdHVyZUV2ZW50KEV2ZW50VHlwZS5DaGFuZ2UpO1xuXHRcdFx0ZXZ0LnRyYW5zbGF0aW9uWCA9IGRlbHRhX3Bvc194O1xuXHRcdFx0ZXZ0LnRyYW5zbGF0aW9uWSA9IGRlbHRhX3Bvc195O1xuXHRcdFx0ZGlzcGF0Y2hUby5mb3JFYWNoKGQgPT4gZC5kaXNwYXRjaEV2ZW50KGV2dCkpO1xuXG5cdFx0XHRpZiAoIXN0b3BwZWQpIHtcblx0XHRcdFx0dGhpcy5pbmVydGlhKHRhcmdldFdpbmRvdywgZGlzcGF0Y2hUbywgbm93LCB2WCwgZGlyWCwgeCArIGRlbHRhX3Bvc194LCB2WSwgZGlyWSwgeSArIGRlbHRhX3Bvc195KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgb25Ub3VjaE1vdmUoZTogVG91Y2hFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7IC8vIHVzZSBEYXRlLm5vdygpIGJlY2F1c2Ugb24gRkYgZS50aW1lU3RhbXAgaXMgbm90IGVwb2NoIGJhc2VkLlxuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGUuY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblxuXHRcdFx0Y29uc3QgdG91Y2ggPSBlLmNoYW5nZWRUb3VjaGVzLml0ZW0oaSk7XG5cblx0XHRcdGlmICghdGhpcy5hY3RpdmVUb3VjaGVzLmhhc093blByb3BlcnR5KFN0cmluZyh0b3VjaC5pZGVudGlmaWVyKSkpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdlbmQgb2YgYW4gVU5LTk9XTiB0b3VjaCcsIHRvdWNoKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRhdGEgPSB0aGlzLmFjdGl2ZVRvdWNoZXNbdG91Y2guaWRlbnRpZmllcl07XG5cblx0XHRcdGNvbnN0IGV2dCA9IHRoaXMubmV3R2VzdHVyZUV2ZW50KEV2ZW50VHlwZS5DaGFuZ2UsIGRhdGEuaW5pdGlhbFRhcmdldCk7XG5cdFx0XHRldnQudHJhbnNsYXRpb25YID0gdG91Y2gucGFnZVggLSBkYXRhLnJvbGxpbmdQYWdlWC5hdCgtMSkhO1xuXHRcdFx0ZXZ0LnRyYW5zbGF0aW9uWSA9IHRvdWNoLnBhZ2VZIC0gZGF0YS5yb2xsaW5nUGFnZVkuYXQoLTEpITtcblx0XHRcdGV2dC5wYWdlWCA9IHRvdWNoLnBhZ2VYO1xuXHRcdFx0ZXZ0LnBhZ2VZID0gdG91Y2gucGFnZVk7XG5cdFx0XHR0aGlzLmRpc3BhdGNoRXZlbnQoZXZ0KTtcblxuXHRcdFx0Ly8gb25seSBrZWVwIGEgZmV3IGRhdGEgcG9pbnRzLCB0byBhdmVyYWdlIHRoZSBmaW5hbCBzcGVlZFxuXHRcdFx0aWYgKGRhdGEucm9sbGluZ1BhZ2VYLmxlbmd0aCA+IDMpIHtcblx0XHRcdFx0ZGF0YS5yb2xsaW5nUGFnZVguc2hpZnQoKTtcblx0XHRcdFx0ZGF0YS5yb2xsaW5nUGFnZVkuc2hpZnQoKTtcblx0XHRcdFx0ZGF0YS5yb2xsaW5nVGltZXN0YW1wcy5zaGlmdCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRkYXRhLnJvbGxpbmdQYWdlWC5wdXNoKHRvdWNoLnBhZ2VYKTtcblx0XHRcdGRhdGEucm9sbGluZ1BhZ2VZLnB1c2godG91Y2gucGFnZVkpO1xuXHRcdFx0ZGF0YS5yb2xsaW5nVGltZXN0YW1wcy5wdXNoKHRpbWVzdGFtcCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZGlzcGF0Y2hlZCkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdHRoaXMuZGlzcGF0Y2hlZCA9IGZhbHNlO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFlBQVksY0FBYztBQUMxQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxTQUFTLGtCQUFrQjtBQUNwQyxTQUFTLFlBQXlCLGlCQUFpQixvQkFBb0I7QUFDdkUsU0FBUyxrQkFBa0I7QUFFcEIsSUFBVTtBQUFBLENBQVYsQ0FBVUEsZUFBVjtBQUNDLEVBQU1BLFdBQUEsTUFBTTtBQUNaLEVBQU1BLFdBQUEsU0FBUztBQUNmLEVBQU1BLFdBQUEsUUFBUTtBQUNkLEVBQU1BLFdBQUEsTUFBTTtBQUNaLEVBQU1BLFdBQUEsY0FBYztBQUFBLEdBTFg7QUF3RFYsTUFBTSxXQUFOLE1BQU0saUJBQWdCLFdBQVc7QUFBQTtBQUFBLEVBa0IvQixjQUFjO0FBQ3JCLFVBQU07QUFiUCxTQUFRLGFBQWE7QUFDckIsU0FBaUIsVUFBVSxJQUFJLFdBQXdCO0FBQ3ZELFNBQWlCLGdCQUFnQixJQUFJLFdBQXdCO0FBYTVELFNBQUssZ0JBQWdCLENBQUM7QUFDdEIsU0FBSyxTQUFTO0FBQ2QsU0FBSyx1QkFBdUI7QUFFNUIsU0FBSyxVQUFVLFdBQVcsZ0JBQWdCLFNBQVMscUJBQXFCLENBQUMsRUFBRSxRQUFRLFlBQVksTUFBTTtBQUNwRyxrQkFBWSxJQUFJLFNBQVMsc0JBQXNCLE9BQU8sVUFBVSxjQUFjLENBQUMsTUFBa0IsS0FBSyxhQUFhLENBQUMsR0FBRyxFQUFFLFNBQVMsTUFBTSxDQUFDLENBQUM7QUFDMUksa0JBQVksSUFBSSxTQUFTLHNCQUFzQixPQUFPLFVBQVUsWUFBWSxDQUFDLE1BQWtCLEtBQUssV0FBVyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzFILGtCQUFZLElBQUksU0FBUyxzQkFBc0IsT0FBTyxVQUFVLGFBQWEsQ0FBQyxNQUFrQixLQUFLLFlBQVksQ0FBQyxHQUFHLEVBQUUsU0FBUyxNQUFNLENBQUMsQ0FBQztBQUFBLElBQ3pJLEdBQUcsRUFBRSxRQUFRLFlBQVksYUFBYSxLQUFLLE9BQU8sQ0FBQyxDQUFDO0FBQUEsRUFDckQ7QUFBQSxFQUVBLE9BQWMsVUFBVSxTQUFtQztBQUMxRCxRQUFJLENBQUMsU0FBUSxjQUFjLEdBQUc7QUFDN0IsYUFBTyxXQUFXO0FBQUEsSUFDbkI7QUFDQSxRQUFJLENBQUMsU0FBUSxVQUFVO0FBQ3RCLGVBQVEsV0FBVyxnQkFBZ0IsSUFBSSxTQUFRLENBQUM7QUFBQSxJQUNqRDtBQUVBLFVBQU0sU0FBUyxTQUFRLFNBQVMsUUFBUSxLQUFLLE9BQU87QUFDcEQsV0FBTyxhQUFhLE1BQU07QUFBQSxFQUMzQjtBQUFBLEVBRUEsT0FBYyxhQUFhLFNBQW1DO0FBQzdELFFBQUksQ0FBQyxTQUFRLGNBQWMsR0FBRztBQUM3QixhQUFPLFdBQVc7QUFBQSxJQUNuQjtBQUNBLFFBQUksQ0FBQyxTQUFRLFVBQVU7QUFDdEIsZUFBUSxXQUFXLGdCQUFnQixJQUFJLFNBQVEsQ0FBQztBQUFBLElBQ2pEO0FBRUEsVUFBTSxTQUFTLFNBQVEsU0FBUyxjQUFjLEtBQUssT0FBTztBQUMxRCxXQUFPLGFBQWEsTUFBTTtBQUFBLEVBQzNCO0FBQUEsRUFHQSxPQUFPLGdCQUF5QjtBQUcvQixXQUFPLGtCQUFrQixjQUFjLFVBQVUsaUJBQWlCO0FBQUEsRUFDbkU7QUFBQSxFQUVnQixVQUFnQjtBQUMvQixRQUFJLEtBQUssUUFBUTtBQUNoQixXQUFLLE9BQU8sUUFBUTtBQUNwQixXQUFLLFNBQVM7QUFBQSxJQUNmO0FBRUEsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUFBLEVBRVEsYUFBYSxHQUFxQjtBQUN6QyxVQUFNLFlBQVksS0FBSyxJQUFJO0FBRTNCLFFBQUksS0FBSyxRQUFRO0FBQ2hCLFdBQUssT0FBTyxRQUFRO0FBQ3BCLFdBQUssU0FBUztBQUFBLElBQ2Y7QUFFQSxhQUFTLElBQUksR0FBRyxNQUFNLEVBQUUsY0FBYyxRQUFRLElBQUksS0FBSyxLQUFLO0FBQzNELFlBQU0sUUFBUSxFQUFFLGNBQWMsS0FBSyxDQUFDO0FBRXBDLFdBQUssY0FBYyxNQUFNLFVBQVUsSUFBSTtBQUFBLFFBQ3RDLElBQUksTUFBTTtBQUFBLFFBQ1YsZUFBZSxNQUFNO0FBQUEsUUFDckIsa0JBQWtCO0FBQUEsUUFDbEIsY0FBYyxNQUFNO0FBQUEsUUFDcEIsY0FBYyxNQUFNO0FBQUEsUUFDcEIsbUJBQW1CLENBQUMsU0FBUztBQUFBLFFBQzdCLGNBQWMsQ0FBQyxNQUFNLEtBQUs7QUFBQSxRQUMxQixjQUFjLENBQUMsTUFBTSxLQUFLO0FBQUEsTUFDM0I7QUFFQSxZQUFNLE1BQU0sS0FBSyxnQkFBZ0IsVUFBVSxPQUFPLE1BQU0sTUFBTTtBQUM5RCxVQUFJLFFBQVEsTUFBTTtBQUNsQixVQUFJLFFBQVEsTUFBTTtBQUNsQixXQUFLLGNBQWMsR0FBRztBQUFBLElBQ3ZCO0FBRUEsUUFBSSxLQUFLLFlBQVk7QUFDcEIsUUFBRSxlQUFlO0FBQ2pCLFFBQUUsZ0JBQWdCO0FBQ2xCLFdBQUssYUFBYTtBQUFBLElBQ25CO0FBQUEsRUFDRDtBQUFBLEVBRVEsV0FBVyxjQUFzQixHQUFxQjtBQUM3RCxVQUFNLFlBQVksS0FBSyxJQUFJO0FBRTNCLFVBQU0sbUJBQW1CLE9BQU8sS0FBSyxLQUFLLGFBQWEsRUFBRTtBQUV6RCxhQUFTLElBQUksR0FBRyxNQUFNLEVBQUUsZUFBZSxRQUFRLElBQUksS0FBSyxLQUFLO0FBRTVELFlBQU0sUUFBUSxFQUFFLGVBQWUsS0FBSyxDQUFDO0FBRXJDLFVBQUksQ0FBQyxLQUFLLGNBQWMsZUFBZSxPQUFPLE1BQU0sVUFBVSxDQUFDLEdBQUc7QUFDakUsZ0JBQVEsS0FBSyw0QkFBNEIsS0FBSztBQUM5QztBQUFBLE1BQ0Q7QUFFQSxZQUFNLE9BQU8sS0FBSyxjQUFjLE1BQU0sVUFBVSxHQUMvQyxXQUFXLEtBQUssSUFBSSxJQUFJLEtBQUs7QUFFOUIsVUFBSSxXQUFXLFNBQVEsY0FDbkIsS0FBSyxJQUFJLEtBQUssZUFBZSxLQUFLLGFBQWEsR0FBRyxFQUFFLENBQUUsSUFBSSxNQUMxRCxLQUFLLElBQUksS0FBSyxlQUFlLEtBQUssYUFBYSxHQUFHLEVBQUUsQ0FBRSxJQUFJLElBQUk7QUFFakUsY0FBTSxNQUFNLEtBQUssZ0JBQWdCLFVBQVUsS0FBSyxLQUFLLGFBQWE7QUFDbEUsWUFBSSxRQUFRLEtBQUssYUFBYSxHQUFHLEVBQUU7QUFDbkMsWUFBSSxRQUFRLEtBQUssYUFBYSxHQUFHLEVBQUU7QUFDbkMsYUFBSyxjQUFjLEdBQUc7QUFBQSxNQUV2QixXQUFXLFlBQVksU0FBUSxjQUMzQixLQUFLLElBQUksS0FBSyxlQUFlLEtBQUssYUFBYSxHQUFHLEVBQUUsQ0FBRSxJQUFJLE1BQzFELEtBQUssSUFBSSxLQUFLLGVBQWUsS0FBSyxhQUFhLEdBQUcsRUFBRSxDQUFFLElBQUksSUFBSTtBQUVqRSxjQUFNLE1BQU0sS0FBSyxnQkFBZ0IsVUFBVSxhQUFhLEtBQUssYUFBYTtBQUMxRSxZQUFJLFFBQVEsS0FBSyxhQUFhLEdBQUcsRUFBRTtBQUNuQyxZQUFJLFFBQVEsS0FBSyxhQUFhLEdBQUcsRUFBRTtBQUNuQyxhQUFLLGNBQWMsR0FBRztBQUFBLE1BRXZCLFdBQVcscUJBQXFCLEdBQUc7QUFDbEMsY0FBTSxTQUFTLEtBQUssYUFBYSxHQUFHLEVBQUU7QUFDdEMsY0FBTSxTQUFTLEtBQUssYUFBYSxHQUFHLEVBQUU7QUFFdEMsY0FBTSxTQUFTLEtBQUssa0JBQWtCLEdBQUcsRUFBRSxJQUFLLEtBQUssa0JBQWtCLENBQUM7QUFDeEUsY0FBTSxTQUFTLFNBQVMsS0FBSyxhQUFhLENBQUM7QUFDM0MsY0FBTSxTQUFTLFNBQVMsS0FBSyxhQUFhLENBQUM7QUFHM0MsY0FBTSxhQUFhLENBQUMsR0FBRyxLQUFLLE9BQU8sRUFBRSxPQUFPLE9BQUssS0FBSyx5QkFBeUIsUUFBUSxFQUFFLFNBQVMsS0FBSyxhQUFhLENBQUM7QUFDckgsYUFBSztBQUFBLFVBQVE7QUFBQSxVQUFjO0FBQUEsVUFBWTtBQUFBO0FBQUEsVUFDdEMsS0FBSyxJQUFJLE1BQU0sSUFBSTtBQUFBO0FBQUEsVUFDbkIsU0FBUyxJQUFJLElBQUk7QUFBQTtBQUFBLFVBQ2pCO0FBQUE7QUFBQSxVQUNBLEtBQUssSUFBSSxNQUFNLElBQUk7QUFBQTtBQUFBLFVBQ25CLFNBQVMsSUFBSSxJQUFJO0FBQUE7QUFBQSxVQUNqQjtBQUFBO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFHQSxXQUFLLGNBQWMsS0FBSyxnQkFBZ0IsVUFBVSxLQUFLLEtBQUssYUFBYSxDQUFDO0FBRTFFLGFBQU8sS0FBSyxjQUFjLE1BQU0sVUFBVTtBQUFBLElBQzNDO0FBRUEsUUFBSSxLQUFLLFlBQVk7QUFDcEIsUUFBRSxlQUFlO0FBQ2pCLFFBQUUsZ0JBQWdCO0FBQ2xCLFdBQUssYUFBYTtBQUFBLElBQ25CO0FBQUEsRUFDRDtBQUFBLEVBRVEsZ0JBQWdCLE1BQWMsZUFBMkM7QUFDaEYsVUFBTSxRQUFRLFNBQVMsWUFBWSxhQUFhO0FBQ2hELFVBQU0sVUFBVSxNQUFNLE9BQU8sSUFBSTtBQUNqQyxVQUFNLGdCQUFnQjtBQUN0QixVQUFNLFdBQVc7QUFDakIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGNBQWMsT0FBMkI7QUFDaEQsUUFBSSxNQUFNLFNBQVMsVUFBVSxLQUFLO0FBQ2pDLFlBQU0sZUFBZSxvQkFBSSxLQUFLLEdBQUcsUUFBUTtBQUN6QyxVQUFJLGNBQWM7QUFDbEIsVUFBSSxjQUFjLEtBQUssdUJBQXVCLFNBQVEsc0JBQXNCO0FBQzNFLHNCQUFjO0FBQUEsTUFDZixPQUFPO0FBQ04sc0JBQWM7QUFBQSxNQUNmO0FBRUEsV0FBSyx1QkFBdUI7QUFDNUIsWUFBTSxXQUFXO0FBQUEsSUFDbEIsV0FBVyxNQUFNLFNBQVMsVUFBVSxVQUFVLE1BQU0sU0FBUyxVQUFVLGFBQWE7QUFFbkYsV0FBSyx1QkFBdUI7QUFBQSxJQUM3QjtBQUVBLFFBQUksTUFBTSx5QkFBeUIsTUFBTTtBQUN4QyxpQkFBVyxnQkFBZ0IsS0FBSyxlQUFlO0FBQzlDLFlBQUksYUFBYSxTQUFTLE1BQU0sYUFBYSxHQUFHO0FBQy9DO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxZQUFNLFVBQW1DLENBQUM7QUFDMUMsaUJBQVcsVUFBVSxLQUFLLFNBQVM7QUFDbEMsWUFBSSxPQUFPLFNBQVMsTUFBTSxhQUFhLEdBQUc7QUFDekMsY0FBSSxRQUFRO0FBQ1osY0FBSSxNQUFtQixNQUFNO0FBQzdCLGlCQUFPLE9BQU8sUUFBUSxRQUFRO0FBQzdCO0FBQ0Esa0JBQU0sSUFBSTtBQUFBLFVBQ1g7QUFDQSxrQkFBUSxLQUFLLENBQUMsT0FBTyxNQUFNLENBQUM7QUFBQSxRQUM3QjtBQUFBLE1BQ0Q7QUFFQSxjQUFRLEtBQUssQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7QUFFbEMsaUJBQVcsQ0FBQyxHQUFHLE1BQU0sS0FBSyxTQUFTO0FBQ2xDLGVBQU8sY0FBYyxLQUFLO0FBQzFCLGFBQUssYUFBYTtBQUFBLE1BQ25CO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLFFBQVEsY0FBc0IsWUFBb0MsSUFBWSxJQUFZLE1BQWMsR0FBVyxJQUFZLE1BQWMsR0FBaUI7QUFDckssU0FBSyxTQUFTLFNBQVMsNkJBQTZCLGNBQWMsTUFBTTtBQUN2RSxZQUFNLE1BQU0sS0FBSyxJQUFJO0FBR3JCLFlBQU0sU0FBUyxNQUFNO0FBQ3JCLFVBQUksY0FBYyxHQUFHLGNBQWM7QUFDbkMsVUFBSSxVQUFVO0FBRWQsWUFBTSxTQUFRLGtCQUFrQjtBQUNoQyxZQUFNLFNBQVEsa0JBQWtCO0FBRWhDLFVBQUksS0FBSyxHQUFHO0FBQ1gsa0JBQVU7QUFDVixzQkFBYyxPQUFPLEtBQUs7QUFBQSxNQUMzQjtBQUVBLFVBQUksS0FBSyxHQUFHO0FBQ1gsa0JBQVU7QUFDVixzQkFBYyxPQUFPLEtBQUs7QUFBQSxNQUMzQjtBQUdBLFlBQU0sTUFBTSxLQUFLLGdCQUFnQixVQUFVLE1BQU07QUFDakQsVUFBSSxlQUFlO0FBQ25CLFVBQUksZUFBZTtBQUNuQixpQkFBVyxRQUFRLE9BQUssRUFBRSxjQUFjLEdBQUcsQ0FBQztBQUU1QyxVQUFJLENBQUMsU0FBUztBQUNiLGFBQUssUUFBUSxjQUFjLFlBQVksS0FBSyxJQUFJLE1BQU0sSUFBSSxhQUFhLElBQUksTUFBTSxJQUFJLFdBQVc7QUFBQSxNQUNqRztBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLFlBQVksR0FBcUI7QUFDeEMsVUFBTSxZQUFZLEtBQUssSUFBSTtBQUUzQixhQUFTLElBQUksR0FBRyxNQUFNLEVBQUUsZUFBZSxRQUFRLElBQUksS0FBSyxLQUFLO0FBRTVELFlBQU0sUUFBUSxFQUFFLGVBQWUsS0FBSyxDQUFDO0FBRXJDLFVBQUksQ0FBQyxLQUFLLGNBQWMsZUFBZSxPQUFPLE1BQU0sVUFBVSxDQUFDLEdBQUc7QUFDakUsZ0JBQVEsS0FBSywyQkFBMkIsS0FBSztBQUM3QztBQUFBLE1BQ0Q7QUFFQSxZQUFNLE9BQU8sS0FBSyxjQUFjLE1BQU0sVUFBVTtBQUVoRCxZQUFNLE1BQU0sS0FBSyxnQkFBZ0IsVUFBVSxRQUFRLEtBQUssYUFBYTtBQUNyRSxVQUFJLGVBQWUsTUFBTSxRQUFRLEtBQUssYUFBYSxHQUFHLEVBQUU7QUFDeEQsVUFBSSxlQUFlLE1BQU0sUUFBUSxLQUFLLGFBQWEsR0FBRyxFQUFFO0FBQ3hELFVBQUksUUFBUSxNQUFNO0FBQ2xCLFVBQUksUUFBUSxNQUFNO0FBQ2xCLFdBQUssY0FBYyxHQUFHO0FBR3RCLFVBQUksS0FBSyxhQUFhLFNBQVMsR0FBRztBQUNqQyxhQUFLLGFBQWEsTUFBTTtBQUN4QixhQUFLLGFBQWEsTUFBTTtBQUN4QixhQUFLLGtCQUFrQixNQUFNO0FBQUEsTUFDOUI7QUFFQSxXQUFLLGFBQWEsS0FBSyxNQUFNLEtBQUs7QUFDbEMsV0FBSyxhQUFhLEtBQUssTUFBTSxLQUFLO0FBQ2xDLFdBQUssa0JBQWtCLEtBQUssU0FBUztBQUFBLElBQ3RDO0FBRUEsUUFBSSxLQUFLLFlBQVk7QUFDcEIsUUFBRSxlQUFlO0FBQ2pCLFFBQUUsZ0JBQWdCO0FBQ2xCLFdBQUssYUFBYTtBQUFBLElBQ25CO0FBQUEsRUFDRDtBQUNEO0FBOVNhLFNBRVksa0JBQWtCO0FBRjlCLFNBSVksYUFBYTtBQUp6QixTQWVZLHVCQUF1QjtBQTBDeEM7QUFBQSxFQUROO0FBQUEsR0F4RFcsVUF5REw7QUF6REQsSUFBTSxVQUFOOyIsCiAgIm5hbWVzIjogWyJFdmVudFR5cGUiXQp9Cg==
