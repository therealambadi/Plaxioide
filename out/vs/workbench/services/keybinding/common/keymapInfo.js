import { isWindows, isLinux } from "../../../../base/common/platform.js";
import { getKeyboardLayoutId } from "../../../../platform/keyboardLayout/common/keyboardLayout.js";
function deserializeMapping(serializedMapping) {
  const mapping = serializedMapping;
  const ret = {};
  for (const key in mapping) {
    const result = mapping[key];
    if (result.length) {
      const value = result[0];
      const withShift = result[1];
      const withAltGr = result[2];
      const withShiftAltGr = result[3];
      const mask = Number(result[4]);
      const vkey = result.length === 6 ? result[5] : void 0;
      ret[key] = {
        "value": value,
        "vkey": vkey,
        "withShift": withShift,
        "withAltGr": withAltGr,
        "withShiftAltGr": withShiftAltGr,
        "valueIsDeadKey": (mask & 1) > 0,
        "withShiftIsDeadKey": (mask & 2) > 0,
        "withAltGrIsDeadKey": (mask & 4) > 0,
        "withShiftAltGrIsDeadKey": (mask & 8) > 0
      };
    } else {
      ret[key] = {
        "value": "",
        "valueIsDeadKey": false,
        "withShift": "",
        "withShiftIsDeadKey": false,
        "withAltGr": "",
        "withAltGrIsDeadKey": false,
        "withShiftAltGr": "",
        "withShiftAltGrIsDeadKey": false
      };
    }
  }
  return ret;
}
class KeymapInfo {
  constructor(layout, secondaryLayouts, keyboardMapping, isUserKeyboardLayout) {
    this.layout = layout;
    this.secondaryLayouts = secondaryLayouts;
    this.mapping = deserializeMapping(keyboardMapping);
    this.isUserKeyboardLayout = !!isUserKeyboardLayout;
    this.layout.isUserKeyboardLayout = !!isUserKeyboardLayout;
  }
  static createKeyboardLayoutFromDebugInfo(layout, value, isUserKeyboardLayout) {
    const keyboardLayoutInfo = new KeymapInfo(layout, [], {}, true);
    keyboardLayoutInfo.mapping = value;
    return keyboardLayoutInfo;
  }
  update(other) {
    this.layout = other.layout;
    this.secondaryLayouts = other.secondaryLayouts;
    this.mapping = other.mapping;
    this.isUserKeyboardLayout = other.isUserKeyboardLayout;
    this.layout.isUserKeyboardLayout = other.isUserKeyboardLayout;
  }
  getScore(other) {
    let score = 0;
    for (const key in other) {
      if (isWindows && (key === "Backslash" || key === "KeyQ")) {
        continue;
      }
      if (isLinux && (key === "Backspace" || key === "Escape")) {
        continue;
      }
      const currentMapping = this.mapping[key];
      if (currentMapping === void 0) {
        score -= 1;
      }
      const otherMapping = other[key];
      if (currentMapping && otherMapping && currentMapping.value !== otherMapping.value) {
        score -= 1;
      }
    }
    return score;
  }
  equal(other) {
    if (this.isUserKeyboardLayout !== other.isUserKeyboardLayout) {
      return false;
    }
    if (getKeyboardLayoutId(this.layout) !== getKeyboardLayoutId(other.layout)) {
      return false;
    }
    return this.fuzzyEqual(other.mapping);
  }
  fuzzyEqual(other) {
    for (const key in other) {
      if (isWindows && (key === "Backslash" || key === "KeyQ")) {
        continue;
      }
      if (this.mapping[key] === void 0) {
        return false;
      }
      const currentMapping = this.mapping[key];
      const otherMapping = other[key];
      if (currentMapping.value !== otherMapping.value) {
        return false;
      }
    }
    return true;
  }
}
export {
  KeymapInfo
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMva2V5YmluZGluZy9jb21tb24va2V5bWFwSW5mby50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGlzV2luZG93cywgaXNMaW51eCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGdldEtleWJvYXJkTGF5b3V0SWQsIElLZXlib2FyZExheW91dEluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXlib2FyZExheW91dC9jb21tb24va2V5Ym9hcmRMYXlvdXQuanMnO1xuXG5mdW5jdGlvbiBkZXNlcmlhbGl6ZU1hcHBpbmcoc2VyaWFsaXplZE1hcHBpbmc6IElTZXJpYWxpemVkTWFwcGluZykge1xuXHRjb25zdCBtYXBwaW5nID0gc2VyaWFsaXplZE1hcHBpbmc7XG5cblx0Y29uc3QgcmV0OiB7IFtrZXk6IHN0cmluZ106IGFueSB9ID0ge307XG5cdGZvciAoY29uc3Qga2V5IGluIG1hcHBpbmcpIHtcblx0XHRjb25zdCByZXN1bHQ6IChzdHJpbmcgfCBudW1iZXIpW10gPSBtYXBwaW5nW2tleV07XG5cdFx0aWYgKHJlc3VsdC5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHZhbHVlID0gcmVzdWx0WzBdO1xuXHRcdFx0Y29uc3Qgd2l0aFNoaWZ0ID0gcmVzdWx0WzFdO1xuXHRcdFx0Y29uc3Qgd2l0aEFsdEdyID0gcmVzdWx0WzJdO1xuXHRcdFx0Y29uc3Qgd2l0aFNoaWZ0QWx0R3IgPSByZXN1bHRbM107XG5cdFx0XHRjb25zdCBtYXNrID0gTnVtYmVyKHJlc3VsdFs0XSk7XG5cdFx0XHRjb25zdCB2a2V5ID0gcmVzdWx0Lmxlbmd0aCA9PT0gNiA/IHJlc3VsdFs1XSA6IHVuZGVmaW5lZDtcblx0XHRcdHJldFtrZXldID0ge1xuXHRcdFx0XHQndmFsdWUnOiB2YWx1ZSxcblx0XHRcdFx0J3ZrZXknOiB2a2V5LFxuXHRcdFx0XHQnd2l0aFNoaWZ0Jzogd2l0aFNoaWZ0LFxuXHRcdFx0XHQnd2l0aEFsdEdyJzogd2l0aEFsdEdyLFxuXHRcdFx0XHQnd2l0aFNoaWZ0QWx0R3InOiB3aXRoU2hpZnRBbHRHcixcblx0XHRcdFx0J3ZhbHVlSXNEZWFkS2V5JzogKG1hc2sgJiAxKSA+IDAsXG5cdFx0XHRcdCd3aXRoU2hpZnRJc0RlYWRLZXknOiAobWFzayAmIDIpID4gMCxcblx0XHRcdFx0J3dpdGhBbHRHcklzRGVhZEtleSc6IChtYXNrICYgNCkgPiAwLFxuXHRcdFx0XHQnd2l0aFNoaWZ0QWx0R3JJc0RlYWRLZXknOiAobWFzayAmIDgpID4gMFxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0W2tleV0gPSB7XG5cdFx0XHRcdCd2YWx1ZSc6ICcnLFxuXHRcdFx0XHQndmFsdWVJc0RlYWRLZXknOiBmYWxzZSxcblx0XHRcdFx0J3dpdGhTaGlmdCc6ICcnLFxuXHRcdFx0XHQnd2l0aFNoaWZ0SXNEZWFkS2V5JzogZmFsc2UsXG5cdFx0XHRcdCd3aXRoQWx0R3InOiAnJyxcblx0XHRcdFx0J3dpdGhBbHRHcklzRGVhZEtleSc6IGZhbHNlLFxuXHRcdFx0XHQnd2l0aFNoaWZ0QWx0R3InOiAnJyxcblx0XHRcdFx0J3dpdGhTaGlmdEFsdEdySXNEZWFkS2V5JzogZmFsc2Vcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJldDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmF3TWl4ZWRLZXlib2FyZE1hcHBpbmcge1xuXHRba2V5OiBzdHJpbmddOiB7XG5cdFx0dmFsdWU6IHN0cmluZztcblx0XHR3aXRoU2hpZnQ6IHN0cmluZztcblx0XHR3aXRoQWx0R3I6IHN0cmluZztcblx0XHR3aXRoU2hpZnRBbHRHcjogc3RyaW5nO1xuXHRcdHZhbHVlSXNEZWFkS2V5PzogYm9vbGVhbjtcblx0XHR3aXRoU2hpZnRJc0RlYWRLZXk/OiBib29sZWFuO1xuXHRcdHdpdGhBbHRHcklzRGVhZEtleT86IGJvb2xlYW47XG5cdFx0d2l0aFNoaWZ0QWx0R3JJc0RlYWRLZXk/OiBib29sZWFuO1xuXG5cdH07XG59XG5cbmludGVyZmFjZSBJU2VyaWFsaXplZE1hcHBpbmcge1xuXHRba2V5OiBzdHJpbmddOiAoc3RyaW5nIHwgbnVtYmVyKVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElLZXltYXBJbmZvIHtcblx0bGF5b3V0OiBJS2V5Ym9hcmRMYXlvdXRJbmZvO1xuXHRzZWNvbmRhcnlMYXlvdXRzOiBJS2V5Ym9hcmRMYXlvdXRJbmZvW107XG5cdG1hcHBpbmc6IElTZXJpYWxpemVkTWFwcGluZztcblx0aXNVc2VyS2V5Ym9hcmRMYXlvdXQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgS2V5bWFwSW5mbyB7XG5cdG1hcHBpbmc6IElSYXdNaXhlZEtleWJvYXJkTWFwcGluZztcblx0aXNVc2VyS2V5Ym9hcmRMYXlvdXQ6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IocHVibGljIGxheW91dDogSUtleWJvYXJkTGF5b3V0SW5mbywgcHVibGljIHNlY29uZGFyeUxheW91dHM6IElLZXlib2FyZExheW91dEluZm9bXSwga2V5Ym9hcmRNYXBwaW5nOiBJU2VyaWFsaXplZE1hcHBpbmcsIGlzVXNlcktleWJvYXJkTGF5b3V0PzogYm9vbGVhbikge1xuXHRcdHRoaXMubWFwcGluZyA9IGRlc2VyaWFsaXplTWFwcGluZyhrZXlib2FyZE1hcHBpbmcpO1xuXHRcdHRoaXMuaXNVc2VyS2V5Ym9hcmRMYXlvdXQgPSAhIWlzVXNlcktleWJvYXJkTGF5b3V0O1xuXHRcdHRoaXMubGF5b3V0LmlzVXNlcktleWJvYXJkTGF5b3V0ID0gISFpc1VzZXJLZXlib2FyZExheW91dDtcblx0fVxuXG5cdHN0YXRpYyBjcmVhdGVLZXlib2FyZExheW91dEZyb21EZWJ1Z0luZm8obGF5b3V0OiBJS2V5Ym9hcmRMYXlvdXRJbmZvLCB2YWx1ZTogSVJhd01peGVkS2V5Ym9hcmRNYXBwaW5nLCBpc1VzZXJLZXlib2FyZExheW91dD86IGJvb2xlYW4pOiBLZXltYXBJbmZvIHtcblx0XHRjb25zdCBrZXlib2FyZExheW91dEluZm8gPSBuZXcgS2V5bWFwSW5mbyhsYXlvdXQsIFtdLCB7fSwgdHJ1ZSk7XG5cdFx0a2V5Ym9hcmRMYXlvdXRJbmZvLm1hcHBpbmcgPSB2YWx1ZTtcblx0XHRyZXR1cm4ga2V5Ym9hcmRMYXlvdXRJbmZvO1xuXHR9XG5cblx0dXBkYXRlKG90aGVyOiBLZXltYXBJbmZvKSB7XG5cdFx0dGhpcy5sYXlvdXQgPSBvdGhlci5sYXlvdXQ7XG5cdFx0dGhpcy5zZWNvbmRhcnlMYXlvdXRzID0gb3RoZXIuc2Vjb25kYXJ5TGF5b3V0cztcblx0XHR0aGlzLm1hcHBpbmcgPSBvdGhlci5tYXBwaW5nO1xuXHRcdHRoaXMuaXNVc2VyS2V5Ym9hcmRMYXlvdXQgPSBvdGhlci5pc1VzZXJLZXlib2FyZExheW91dDtcblx0XHR0aGlzLmxheW91dC5pc1VzZXJLZXlib2FyZExheW91dCA9IG90aGVyLmlzVXNlcktleWJvYXJkTGF5b3V0O1xuXHR9XG5cblx0Z2V0U2NvcmUob3RoZXI6IElSYXdNaXhlZEtleWJvYXJkTWFwcGluZyk6IG51bWJlciB7XG5cdFx0bGV0IHNjb3JlID0gMDtcblx0XHRmb3IgKGNvbnN0IGtleSBpbiBvdGhlcikge1xuXHRcdFx0aWYgKGlzV2luZG93cyAmJiAoa2V5ID09PSAnQmFja3NsYXNoJyB8fCBrZXkgPT09ICdLZXlRJykpIHtcblx0XHRcdFx0Ly8ga2V5bWFwIGZyb20gQ2hyb21pdW0gaXMgcHJvYmFibHkgd3JvbmcuXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNMaW51eCAmJiAoa2V5ID09PSAnQmFja3NwYWNlJyB8fCBrZXkgPT09ICdFc2NhcGUnKSkge1xuXHRcdFx0XHQvLyBuYXRpdmUga2V5bWFwIGRvZXNuJ3QgYWxpZ24gd2l0aCBrZXlib2FyZCBldmVudFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgY3VycmVudE1hcHBpbmcgPSB0aGlzLm1hcHBpbmdba2V5XTtcblxuXHRcdFx0aWYgKGN1cnJlbnRNYXBwaW5nID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0c2NvcmUgLT0gMTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgb3RoZXJNYXBwaW5nID0gb3RoZXJba2V5XTtcblxuXHRcdFx0aWYgKGN1cnJlbnRNYXBwaW5nICYmIG90aGVyTWFwcGluZyAmJiBjdXJyZW50TWFwcGluZy52YWx1ZSAhPT0gb3RoZXJNYXBwaW5nLnZhbHVlKSB7XG5cdFx0XHRcdHNjb3JlIC09IDE7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHNjb3JlO1xuXHR9XG5cblx0ZXF1YWwob3RoZXI6IEtleW1hcEluZm8pOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5pc1VzZXJLZXlib2FyZExheW91dCAhPT0gb3RoZXIuaXNVc2VyS2V5Ym9hcmRMYXlvdXQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoZ2V0S2V5Ym9hcmRMYXlvdXRJZCh0aGlzLmxheW91dCkgIT09IGdldEtleWJvYXJkTGF5b3V0SWQob3RoZXIubGF5b3V0KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmZ1enp5RXF1YWwob3RoZXIubWFwcGluZyk7XG5cdH1cblxuXHRmdXp6eUVxdWFsKG90aGVyOiBJUmF3TWl4ZWRLZXlib2FyZE1hcHBpbmcpOiBib29sZWFuIHtcblx0XHRmb3IgKGNvbnN0IGtleSBpbiBvdGhlcikge1xuXHRcdFx0aWYgKGlzV2luZG93cyAmJiAoa2V5ID09PSAnQmFja3NsYXNoJyB8fCBrZXkgPT09ICdLZXlRJykpIHtcblx0XHRcdFx0Ly8ga2V5bWFwIGZyb20gQ2hyb21pdW0gaXMgcHJvYmFibHkgd3JvbmcuXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMubWFwcGluZ1trZXldID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJyZW50TWFwcGluZyA9IHRoaXMubWFwcGluZ1trZXldO1xuXHRcdFx0Y29uc3Qgb3RoZXJNYXBwaW5nID0gb3RoZXJba2V5XTtcblxuXHRcdFx0aWYgKGN1cnJlbnRNYXBwaW5nLnZhbHVlICE9PSBvdGhlck1hcHBpbmcudmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFdBQVcsZUFBZTtBQUNuQyxTQUFTLDJCQUFnRDtBQUV6RCxTQUFTLG1CQUFtQixtQkFBdUM7QUFDbEUsUUFBTSxVQUFVO0FBRWhCLFFBQU0sTUFBOEIsQ0FBQztBQUNyQyxhQUFXLE9BQU8sU0FBUztBQUMxQixVQUFNLFNBQThCLFFBQVEsR0FBRztBQUMvQyxRQUFJLE9BQU8sUUFBUTtBQUNsQixZQUFNLFFBQVEsT0FBTyxDQUFDO0FBQ3RCLFlBQU0sWUFBWSxPQUFPLENBQUM7QUFDMUIsWUFBTSxZQUFZLE9BQU8sQ0FBQztBQUMxQixZQUFNLGlC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
