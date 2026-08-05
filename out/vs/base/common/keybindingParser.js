import { KeyCodeUtils, ScanCodeUtils } from "./keyCodes.js";
import { KeyCodeChord, ScanCodeChord, Keybinding } from "./keybindings.js";
class KeybindingParser {
  static _readModifiers(input) {
    input = input.toLowerCase().trim();
    let ctrl = false;
    let shift = false;
    let alt = false;
    let meta = false;
    let matchedModifier;
    do {
      matchedModifier = false;
      if (/^ctrl(\+|\-)/.test(input)) {
        ctrl = true;
        input = input.substr("ctrl-".length);
        matchedModifier = true;
      }
      if (/^shift(\+|\-)/.test(input)) {
        shift = true;
        input = input.substr("shift-".length);
        matchedModifier = true;
      }
      if (/^alt(\+|\-)/.test(input)) {
        alt = true;
        input = input.substr("alt-".length);
        matchedModifier = true;
      }
      if (/^meta(\+|\-)/.test(input)) {
        meta = true;
        input = input.substr("meta-".length);
        matchedModifier = true;
      }
      if (/^win(\+|\-)/.test(input)) {
        meta = true;
        input = input.substr("win-".length);
        matchedModifier = true;
      }
      if (/^cmd(\+|\-)/.test(input)) {
        meta = true;
        input = input.substr("cmd-".length);
        matchedModifier = true;
      }
    } while (matchedModifier);
    let key;
    const firstSpaceIdx = input.indexOf(" ");
    if (firstSpaceIdx > 0) {
      key = input.substring(0, firstSpaceIdx);
      input = input.substring(firstSpaceIdx);
    } else {
      key = input;
      input = "";
    }
    return {
      remains: input,
      ctrl,
      shift,
      alt,
      meta,
      key
    };
  }
  static parseChord(input) {
    const mods = this._readModifiers(input);
    const scanCodeMatch = mods.key.match(/^\[([^\]]+)\]$/);
    if (scanCodeMatch) {
      const strScanCode = scanCodeMatch[1];
      const scanCode = ScanCodeUtils.lowerCaseToEnum(strScanCode);
      return [new ScanCodeChord(mods.ctrl, mods.shift, mods.alt, mods.meta, scanCode), mods.remains];
    }
    const keyCode = KeyCodeUtils.fromUserSettings(mods.key);
    return [new KeyCodeChord(mods.ctrl, mods.shift, mods.alt, mods.meta, keyCode), mods.remains];
  }
  static parseKeybinding(input) {
    if (!input) {
      return null;
    }
    const chords = [];
    let chord;
    while (input.length > 0) {
      [chord, input] = this.parseChord(input);
      chords.push(chord);
    }
    return chords.length > 0 ? new Keybinding(chords) : null;
  }
}
export {
  KeybindingParser
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9rZXliaW5kaW5nUGFyc2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgS2V5Q29kZVV0aWxzLCBTY2FuQ29kZVV0aWxzIH0gZnJvbSAnLi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlQ2hvcmQsIFNjYW5Db2RlQ2hvcmQsIEtleWJpbmRpbmcsIENob3JkIH0gZnJvbSAnLi9rZXliaW5kaW5ncy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBLZXliaW5kaW5nUGFyc2VyIHtcblxuXHRwcml2YXRlIHN0YXRpYyBfcmVhZE1vZGlmaWVycyhpbnB1dDogc3RyaW5nKSB7XG5cdFx0aW5wdXQgPSBpbnB1dC50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcblxuXHRcdGxldCBjdHJsID0gZmFsc2U7XG5cdFx0bGV0IHNoaWZ0ID0gZmFsc2U7XG5cdFx0bGV0IGFsdCA9IGZhbHNlO1xuXHRcdGxldCBtZXRhID0gZmFsc2U7XG5cblx0XHRsZXQgbWF0Y2hlZE1vZGlmaWVyOiBib29sZWFuO1xuXG5cdFx0ZG8ge1xuXHRcdFx0bWF0Y2hlZE1vZGlmaWVyID0gZmFsc2U7XG5cdFx0XHRpZiAoL15jdHJsKFxcK3xcXC0pLy50ZXN0KGlucHV0KSkge1xuXHRcdFx0XHRjdHJsID0gdHJ1ZTtcblx0XHRcdFx0aW5wdXQgPSBpbnB1dC5zdWJzdHIoJ2N0cmwtJy5sZW5ndGgpO1xuXHRcdFx0XHRtYXRjaGVkTW9kaWZpZXIgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKC9ec2hpZnQoXFwrfFxcLSkvLnRlc3QoaW5wdXQpKSB7XG5cdFx0XHRcdHNoaWZ0ID0gdHJ1ZTtcblx0XHRcdFx0aW5wdXQgPSBpbnB1dC5zdWJzdHIoJ3NoaWZ0LScubGVuZ3RoKTtcblx0XHRcdFx0bWF0Y2hlZE1vZGlmaWVyID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICgvXmFsdChcXCt8XFwtKS8udGVzdChpbnB1dCkpIHtcblx0XHRcdFx0YWx0ID0gdHJ1ZTtcblx0XHRcdFx0aW5wdXQgPSBpbnB1dC5zdWJzdHIoJ2FsdC0nLmxlbmd0aCk7XG5cdFx0XHRcdG1hdGNoZWRNb2RpZmllciA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoL15tZXRhKFxcK3xcXC0pLy50ZXN0KGlucHV0KSkge1xuXHRcdFx0XHRtZXRhID0gdHJ1ZTtcblx0XHRcdFx0aW5wdXQgPSBpbnB1dC5zdWJzdHIoJ21ldGEtJy5sZW5ndGgpO1xuXHRcdFx0XHRtYXRjaGVkTW9kaWZpZXIgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKC9ed2luKFxcK3xcXC0pLy50ZXN0KGlucHV0KSkge1xuXHRcdFx0XHRtZXRhID0gdHJ1ZTtcblx0XHRcdFx0aW5wdXQgPSBpbnB1dC5zdWJzdHIoJ3dpbi0nLmxlbmd0aCk7XG5cdFx0XHRcdG1hdGNoZWRNb2RpZmllciA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoL15jbWQoXFwrfFxcLSkvLnRlc3QoaW5wdXQpKSB7XG5cdFx0XHRcdG1ldGEgPSB0cnVlO1xuXHRcdFx0XHRpbnB1dCA9IGlucHV0LnN1YnN0cignY21kLScubGVuZ3RoKTtcblx0XHRcdFx0bWF0Y2hlZE1vZGlmaWVyID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9IHdoaWxlIChtYXRjaGVkTW9kaWZpZXIpO1xuXG5cdFx0bGV0IGtleTogc3RyaW5nO1xuXG5cdFx0Y29uc3QgZmlyc3RTcGFjZUlkeCA9IGlucHV0LmluZGV4T2YoJyAnKTtcblx0XHRpZiAoZmlyc3RTcGFjZUlkeCA+IDApIHtcblx0XHRcdGtleSA9IGlucHV0LnN1YnN0cmluZygwLCBmaXJzdFNwYWNlSWR4KTtcblx0XHRcdGlucHV0ID0gaW5wdXQuc3Vic3RyaW5nKGZpcnN0U3BhY2VJZHgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRrZXkgPSBpbnB1dDtcblx0XHRcdGlucHV0ID0gJyc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlbWFpbnM6IGlucHV0LFxuXHRcdFx0Y3RybCxcblx0XHRcdHNoaWZ0LFxuXHRcdFx0YWx0LFxuXHRcdFx0bWV0YSxcblx0XHRcdGtleVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBwYXJzZUNob3JkKGlucHV0OiBzdHJpbmcpOiBbQ2hvcmQsIHN0cmluZ10ge1xuXHRcdGNvbnN0IG1vZHMgPSB0aGlzLl9yZWFkTW9kaWZpZXJzKGlucHV0KTtcblx0XHRjb25zdCBzY2FuQ29kZU1hdGNoID0gbW9kcy5rZXkubWF0Y2goL15cXFsoW15cXF1dKylcXF0kLyk7XG5cdFx0aWYgKHNjYW5Db2RlTWF0Y2gpIHtcblx0XHRcdGNvbnN0IHN0clNjYW5Db2RlID0gc2NhbkNvZGVNYXRjaFsxXTtcblx0XHRcdGNvbnN0IHNjYW5Db2RlID0gU2NhbkNvZGVVdGlscy5sb3dlckNhc2VUb0VudW0oc3RyU2NhbkNvZGUpO1xuXHRcdFx0cmV0dXJuIFtuZXcgU2NhbkNvZGVDaG9yZChtb2RzLmN0cmwsIG1vZHMuc2hpZnQsIG1vZHMuYWx0LCBtb2RzLm1ldGEsIHNjYW5Db2RlKSwgbW9kcy5yZW1haW5zXTtcblx0XHR9XG5cdFx0Y29uc3Qga2V5Q29kZSA9IEtleUNvZGVVdGlscy5mcm9tVXNlclNldHRpbmdzKG1vZHMua2V5KTtcblx0XHRyZXR1cm4gW25ldyBLZXlDb2RlQ2hvcmQobW9kcy5jdHJsLCBtb2RzLnNoaWZ0LCBtb2RzLmFsdCwgbW9kcy5tZXRhLCBrZXlDb2RlKSwgbW9kcy5yZW1haW5zXTtcblx0fVxuXG5cdHN0YXRpYyBwYXJzZUtleWJpbmRpbmcoaW5wdXQ6IHN0cmluZyk6IEtleWJpbmRpbmcgfCBudWxsIHtcblx0XHRpZiAoIWlucHV0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBjaG9yZHM6IENob3JkW10gPSBbXTtcblx0XHRsZXQgY2hvcmQ6IENob3JkO1xuXG5cdFx0d2hpbGUgKGlucHV0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFtjaG9yZCwgaW5wdXRdID0gdGhpcy5wYXJzZUNob3JkKGlucHV0KTtcblx0XHRcdGNob3Jkcy5wdXNoKGNob3JkKTtcblx0XHR9XG5cdFx0cmV0dXJuIChjaG9yZHMubGVuZ3RoID4gMCA/IG5ldyBLZXliaW5kaW5nKGNob3JkcykgOiBudWxsKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxjQUFjLHFCQUFxQjtBQUM1QyxTQUFTLGNBQWMsZUFBZSxrQkFBeUI7QUFFeEQsTUFBTSxpQkFBaUI7QUFBQSxFQUU3QixPQUFlLGVBQWUsT0FBZTtBQUM1QyxZQUFRLE1BQU0sWUFBWSxFQUFFLEtBQUs7QUFFakMsUUFBSSxPQUFPO0FBQ1gsUUFBSSxRQUFRO0FBQ1osUUFBSSxNQUFNO0FBQ1YsUUFBSSxPQUFPO0FBRVgsUUFBSTtBQUVKLE9BQUc7QUFDRix3QkFBa0I7QUFDbEIsVUFBSSxlQUFlLEtBQUssS0FBSyxHQUFHO0FBQy9CLGVBQU87QUFDUCxnQkFBUSxNQUFNLE9BQU8sUUFBUSxNQUFNO0FBQ25DLDBCQUFrQjtBQUFBLE1BQ25CO0FBQ0EsVUFBSSxnQkFBZ0IsS0FBSyxLQUFLLEdBQUc7QUFDaEMsZ0JBQVE7QUFDUixnQkFBUSxNQUFNLE9BQU8sU0FBUyxNQUFNO0FBQ3BDLDBCQUFrQjtBQUFBLE1BQ25CO0FBQ0EsVUFBSSxjQUFjLEtBQUssS0FBSyxHQUFHO0FBQzlCLGNBQU07QUFDTixnQkFBUSxNQUFNLE9BQU8sT0FBTyxNQUFNO0FBQ2xDLDBCQUFrQjtBQUFBLE1BQ25CO0FBQ0EsVUFBSSxlQUFlLEtBQUssS0FBSyxHQUFHO0FBQy9CLGVBQU87QUFDUCxnQkFBUSxNQUFNLE9BQU8sUUFBUSxNQUFNO0FBQ25DLDBCQUFrQjtBQUFBLE1BQ25CO0FBQ0EsVUFBSSxjQUFjLEtBQUssS0FBSyxHQUFHO0FBQzlCLGVBQU87QUFDUCxnQkFBUSxNQUFNLE9BQU8sT0FBTyxNQUFNO0FBQ2xDLDBCQUFrQjtBQUFBLE1BQ25CO0FBQ0EsVUFBSSxjQUFjLEtBQUssS0FBSyxHQUFHO0FBQzlCLGVBQU87QUFDUCxnQkFBUSxNQUFNLE9BQU8sT0FBTyxNQUFNO0FBQ2xDLDBCQUFrQjtBQUFBLE1BQ25CO0FBQUEsSUFDRCxTQUFTO0FBRVQsUUFBSTtBQUVKLFVBQU0sZ0JBQWdCLE1BQU0sUUFBUSxHQUFHO0FBQ3ZDLFFBQUksZ0JBQWdCLEdBQUc7QUFDdEIsWUFBTSxNQUFNLFVBQVUsR0FBRyxhQUFhO0FBQ3RDLGNBQVEsTUFBTSxVQUFVLGFBQWE7QUFBQSxJQUN0QyxPQUFPO0FBQ04sWUFBTTtBQUNOLGNBQVE7QUFBQSxJQUNUO0FBRUEsV0FBTztBQUFBLE1BQ04sU0FBUztBQUFBLE1BQ1Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE9BQWUsV0FBVyxPQUFnQztBQUN6RCxVQUFNLE9BQU8sS0FBSyxlQUFlLEtBQUs7QUFDdEMsVUFBTSxnQkFBZ0IsS0FBSyxJQUFJLE1BQU0sZ0JBQWdCO0FBQ3JELFFBQUksZUFBZTtBQUNsQixZQUFNLGNBQWMsY0FBYyxDQUFDO0FBQ25DLFlBQU0sV0FBVyxjQUFjLGdCQUFnQixXQUFXO0FBQzFELGFBQU8sQ0FBQyxJQUFJLGNBQWMsS0FBSyxNQUFNLEtBQUssT0FBTyxLQUFLLEtBQUssS0FBSyxNQUFNLFFBQVEsR0FBRyxLQUFLLE9BQU87QUFBQSxJQUM5RjtBQUNBLFVBQU0sVUFBVSxhQUFhLGlCQUFpQixLQUFLLEdBQUc7QUFDdEQsV0FBTyxDQUFDLElBQUksYUFBYSxLQUFLLE1BQU0sS0FBSyxPQUFPLEtBQUssS0FBSyxLQUFLLE1BQU0sT0FBTyxHQUFHLEtBQUssT0FBTztBQUFBLEVBQzVGO0FBQUEsRUFFQSxPQUFPLGdCQUFnQixPQUFrQztBQUN4RCxRQUFJLENBQUMsT0FBTztBQUNYLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxTQUFrQixDQUFDO0FBQ3pCLFFBQUk7QUFFSixXQUFPLE1BQU0sU0FBUyxHQUFHO0FBQ3hCLE9BQUMsT0FBTyxLQUFLLElBQUksS0FBSyxXQUFXLEtBQUs7QUFDdEMsYUFBTyxLQUFLLEtBQUs7QUFBQSxJQUNsQjtBQUNBLFdBQVEsT0FBTyxTQUFTLElBQUksSUFBSSxXQUFXLE1BQU0sSUFBSTtBQUFBLEVBQ3REO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
