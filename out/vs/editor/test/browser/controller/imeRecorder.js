import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import * as browser from "../../../../base/browser/browser.js";
import * as platform from "../../../../base/common/platform.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { TextAreaWrapper } from "../../../browser/controller/editContext/textArea/textAreaEditContextInput.js";
(() => {
  const startButton = mainWindow.document.getElementById("startRecording");
  const endButton = mainWindow.document.getElementById("endRecording");
  let inputarea;
  const disposables = new DisposableStore();
  let originTimeStamp = 0;
  let recorded = {
    env: null,
    initial: null,
    events: [],
    final: null
  };
  const readTextareaState = () => {
    return {
      selectionDirection: inputarea.selectionDirection,
      selectionEnd: inputarea.selectionEnd,
      selectionStart: inputarea.selectionStart,
      value: inputarea.value
    };
  };
  startButton.onclick = () => {
    disposables.clear();
    startTest();
    originTimeStamp = 0;
    recorded = {
      env: {
        OS: platform.OS,
        browser: {
          isAndroid: browser.isAndroid,
          isFirefox: browser.isFirefox,
          isChrome: browser.isChrome,
          isSafari: browser.isSafari
        }
      },
      initial: readTextareaState(),
      events: [],
      final: null
    };
  };
  endButton.onclick = () => {
    recorded.final = readTextareaState();
    console.log(printRecordedData());
  };
  function printRecordedData() {
    const lines = [];
    lines.push(`const recorded: IRecorded = {`);
    lines.push(`	env: ${JSON.stringify(recorded.env)}, `);
    lines.push(`	initial: ${printState(recorded.initial)}, `);
    lines.push(`	events: [
		${recorded.events.map((ev) => printEvent(ev)).join(",\n		")}
	],`);
    lines.push(`	final: ${printState(recorded.final)},`);
    lines.push(`}`);
    return lines.join("\n");
    function printString(str) {
      return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }
    function printState(state) {
      return `{ value: '${printString(state.value)}', selectionStart: ${state.selectionStart}, selectionEnd: ${state.selectionEnd}, selectionDirection: '${state.selectionDirection}' }`;
    }
    function printEvent(ev) {
      if (ev.type === "keydown" || ev.type === "keypress" || ev.type === "keyup") {
        return `{ timeStamp: ${ev.timeStamp.toFixed(2)}, state: ${printState(ev.state)}, type: '${ev.type}', altKey: ${ev.altKey}, charCode: ${ev.charCode}, code: '${ev.code}', ctrlKey: ${ev.ctrlKey}, isComposing: ${ev.isComposing}, key: '${ev.key}', keyCode: ${ev.keyCode}, location: ${ev.location}, metaKey: ${ev.metaKey}, repeat: ${ev.repeat}, shiftKey: ${ev.shiftKey} }`;
      }
      if (ev.type === "compositionstart" || ev.type === "compositionupdate" || ev.type === "compositionend") {
        return `{ timeStamp: ${ev.timeStamp.toFixed(2)}, state: ${printState(ev.state)}, type: '${ev.type}', data: '${printString(ev.data)}' }`;
      }
      if (ev.type === "beforeinput" || ev.type === "input") {
        return `{ timeStamp: ${ev.timeStamp.toFixed(2)}, state: ${printState(ev.state)}, type: '${ev.type}', data: ${ev.data === null ? "null" : `'${printString(ev.data)}'`}, inputType: '${ev.inputType}', isComposing: ${ev.isComposing} }`;
      }
      return JSON.stringify(ev);
    }
  }
  function startTest() {
    inputarea = document.createElement("textarea");
    mainWindow.document.body.appendChild(inputarea);
    inputarea.focus();
    disposables.add(toDisposable(() => {
      inputarea.remove();
    }));
    const wrapper = disposables.add(new TextAreaWrapper(inputarea));
    wrapper.setValue("", `aaaa`);
    wrapper.setSelectionRange("", 2, 2);
    const recordEvent = (e) => {
      recorded.events.push(e);
    };
    const recordKeyboardEvent = (e) => {
      if (e.type !== "keydown" && e.type !== "keypress" && e.type !== "keyup") {
        throw new Error(`Not supported!`);
      }
      if (originTimeStamp === 0) {
        originTimeStamp = e.timeStamp;
      }
      const ev = {
        timeStamp: e.timeStamp - originTimeStamp,
        state: readTextareaState(),
        type: e.type,
        altKey: e.altKey,
        charCode: e.charCode,
        code: e.code,
        ctrlKey: e.ctrlKey,
        isComposing: e.isComposing,
        key: e.key,
        keyCode: e.keyCode,
        location: e.location,
        metaKey: e.metaKey,
        repeat: e.repeat,
        shiftKey: e.shiftKey
      };
      recordEvent(ev);
    };
    const recordCompositionEvent = (e) => {
      if (e.type !== "compositionstart" && e.type !== "compositionupdate" && e.type !== "compositionend") {
        throw new Error(`Not supported!`);
      }
      if (originTimeStamp === 0) {
        originTimeStamp = e.timeStamp;
      }
      const ev = {
        timeStamp: e.timeStamp - originTimeStamp,
        state: readTextareaState(),
        type: e.type,
        data: e.data
      };
      recordEvent(ev);
    };
    const recordInputEvent = (e) => {
      if (e.type !== "beforeinput" && e.type !== "input") {
        throw new Error(`Not supported!`);
      }
      if (originTimeStamp === 0) {
        originTimeStamp = e.timeStamp;
      }
      const ev = {
        timeStamp: e.timeStamp - originTimeStamp,
        state: readTextareaState(),
        type: e.type,
        data: e.data,
        inputType: e.inputType,
        isComposing: e.isComposing
      };
      recordEvent(ev);
    };
    wrapper.onKeyDown(recordKeyboardEvent);
    wrapper.onKeyPress(recordKeyboardEvent);
    wrapper.onKeyUp(recordKeyboardEvent);
    wrapper.onCompositionStart(recordCompositionEvent);
    wrapper.onCompositionUpdate(recordCompositionEvent);
    wrapper.onCompositionEnd(recordCompositionEvent);
    wrapper.onBeforeInput(recordInputEvent);
    wrapper.onInput(recordInputEvent);
  }
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL2NvbnRyb2xsZXIvaW1lUmVjb3JkZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUmVjb3JkZWQsIElSZWNvcmRlZENvbXBvc2l0aW9uRXZlbnQsIElSZWNvcmRlZEV2ZW50LCBJUmVjb3JkZWRJbnB1dEV2ZW50LCBJUmVjb3JkZWRLZXlib2FyZEV2ZW50LCBJUmVjb3JkZWRUZXh0YXJlYVN0YXRlIH0gZnJvbSAnLi9pbWVSZWNvcmRlZFR5cGVzLmpzJztcbmltcG9ydCAqIGFzIGJyb3dzZXIgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Jyb3dzZXIuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgVGV4dEFyZWFXcmFwcGVyIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9jb250cm9sbGVyL2VkaXRDb250ZXh0L3RleHRBcmVhL3RleHRBcmVhRWRpdENvbnRleHRJbnB1dC5qcyc7XG5cbigoKSA9PiB7XG5cblx0Y29uc3Qgc3RhcnRCdXR0b24gPSA8SFRNTEJ1dHRvbkVsZW1lbnQ+bWFpbldpbmRvdy5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RhcnRSZWNvcmRpbmcnKSE7XG5cdGNvbnN0IGVuZEJ1dHRvbiA9IDxIVE1MQnV0dG9uRWxlbWVudD5tYWluV2luZG93LmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlbmRSZWNvcmRpbmcnKSE7XG5cblx0bGV0IGlucHV0YXJlYTogSFRNTFRleHRBcmVhRWxlbWVudDtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGxldCBvcmlnaW5UaW1lU3RhbXAgPSAwO1xuXHRsZXQgcmVjb3JkZWQ6IElSZWNvcmRlZCA9IHtcblx0XHRlbnY6IG51bGwhLFxuXHRcdGluaXRpYWw6IG51bGwhLFxuXHRcdGV2ZW50czogW10sXG5cdFx0ZmluYWw6IG51bGwhXG5cdH07XG5cblx0Y29uc3QgcmVhZFRleHRhcmVhU3RhdGUgPSAoKTogSVJlY29yZGVkVGV4dGFyZWFTdGF0ZSA9PiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlbGVjdGlvbkRpcmVjdGlvbjogaW5wdXRhcmVhLnNlbGVjdGlvbkRpcmVjdGlvbixcblx0XHRcdHNlbGVjdGlvbkVuZDogaW5wdXRhcmVhLnNlbGVjdGlvbkVuZCxcblx0XHRcdHNlbGVjdGlvblN0YXJ0OiBpbnB1dGFyZWEuc2VsZWN0aW9uU3RhcnQsXG5cdFx0XHR2YWx1ZTogaW5wdXRhcmVhLnZhbHVlLFxuXHRcdH07XG5cdH07XG5cblx0c3RhcnRCdXR0b24ub25jbGljayA9ICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHN0YXJ0VGVzdCgpO1xuXHRcdG9yaWdpblRpbWVTdGFtcCA9IDA7XG5cdFx0cmVjb3JkZWQgPSB7XG5cdFx0XHRlbnY6IHtcblx0XHRcdFx0T1M6IHBsYXRmb3JtLk9TLFxuXHRcdFx0XHRicm93c2VyOiB7XG5cdFx0XHRcdFx0aXNBbmRyb2lkOiBicm93c2VyLmlzQW5kcm9pZCxcblx0XHRcdFx0XHRpc0ZpcmVmb3g6IGJyb3dzZXIuaXNGaXJlZm94LFxuXHRcdFx0XHRcdGlzQ2hyb21lOiBicm93c2VyLmlzQ2hyb21lLFxuXHRcdFx0XHRcdGlzU2FmYXJpOiBicm93c2VyLmlzU2FmYXJpXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRpbml0aWFsOiByZWFkVGV4dGFyZWFTdGF0ZSgpLFxuXHRcdFx0ZXZlbnRzOiBbXSxcblx0XHRcdGZpbmFsOiBudWxsIVxuXHRcdH07XG5cdH07XG5cdGVuZEJ1dHRvbi5vbmNsaWNrID0gKCkgPT4ge1xuXHRcdHJlY29yZGVkLmZpbmFsID0gcmVhZFRleHRhcmVhU3RhdGUoKTtcblx0XHRjb25zb2xlLmxvZyhwcmludFJlY29yZGVkRGF0YSgpKTtcblx0fTtcblxuXHRmdW5jdGlvbiBwcmludFJlY29yZGVkRGF0YSgpIHtcblx0XHRjb25zdCBsaW5lcyA9IFtdO1xuXHRcdGxpbmVzLnB1c2goYGNvbnN0IHJlY29yZGVkOiBJUmVjb3JkZWQgPSB7YCk7XG5cdFx0bGluZXMucHVzaChgXFx0ZW52OiAke0pTT04uc3RyaW5naWZ5KHJlY29yZGVkLmVudil9LCBgKTtcblx0XHRsaW5lcy5wdXNoKGBcXHRpbml0aWFsOiAke3ByaW50U3RhdGUocmVjb3JkZWQuaW5pdGlhbCl9LCBgKTtcblx0XHRsaW5lcy5wdXNoKGBcXHRldmVudHM6IFtcXG5cXHRcXHQke3JlY29yZGVkLmV2ZW50cy5tYXAoZXYgPT4gcHJpbnRFdmVudChldikpLmpvaW4oJyxcXG5cXHRcXHQnKX1cXG5cXHRdLGApO1xuXHRcdGxpbmVzLnB1c2goYFxcdGZpbmFsOiAke3ByaW50U3RhdGUocmVjb3JkZWQuZmluYWwpfSxgKTtcblx0XHRsaW5lcy5wdXNoKGB9YCk7XG5cblx0XHRyZXR1cm4gbGluZXMuam9pbignXFxuJyk7XG5cblx0XHRmdW5jdGlvbiBwcmludFN0cmluZyhzdHI6IHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHN0ci5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpLnJlcGxhY2UoLycvZywgJ1xcXFxcXCcnKTtcblx0XHR9XG5cdFx0ZnVuY3Rpb24gcHJpbnRTdGF0ZShzdGF0ZTogSVJlY29yZGVkVGV4dGFyZWFTdGF0ZSkge1xuXHRcdFx0cmV0dXJuIGB7IHZhbHVlOiAnJHtwcmludFN0cmluZyhzdGF0ZS52YWx1ZSl9Jywgc2VsZWN0aW9uU3RhcnQ6ICR7c3RhdGUuc2VsZWN0aW9uU3RhcnR9LCBzZWxlY3Rpb25FbmQ6ICR7c3RhdGUuc2VsZWN0aW9uRW5kfSwgc2VsZWN0aW9uRGlyZWN0aW9uOiAnJHtzdGF0ZS5zZWxlY3Rpb25EaXJlY3Rpb259JyB9YDtcblx0XHR9XG5cdFx0ZnVuY3Rpb24gcHJpbnRFdmVudChldjogSVJlY29yZGVkRXZlbnQpIHtcblx0XHRcdGlmIChldi50eXBlID09PSAna2V5ZG93bicgfHwgZXYudHlwZSA9PT0gJ2tleXByZXNzJyB8fCBldi50eXBlID09PSAna2V5dXAnKSB7XG5cdFx0XHRcdHJldHVybiBgeyB0aW1lU3RhbXA6ICR7ZXYudGltZVN0YW1wLnRvRml4ZWQoMil9LCBzdGF0ZTogJHtwcmludFN0YXRlKGV2LnN0YXRlKX0sIHR5cGU6ICcke2V2LnR5cGV9JywgYWx0S2V5OiAke2V2LmFsdEtleX0sIGNoYXJDb2RlOiAke2V2LmNoYXJDb2RlfSwgY29kZTogJyR7ZXYuY29kZX0nLCBjdHJsS2V5OiAke2V2LmN0cmxLZXl9LCBpc0NvbXBvc2luZzogJHtldi5pc0NvbXBvc2luZ30sIGtleTogJyR7ZXYua2V5fScsIGtleUNvZGU6ICR7ZXYua2V5Q29kZX0sIGxvY2F0aW9uOiAke2V2LmxvY2F0aW9ufSwgbWV0YUtleTogJHtldi5tZXRhS2V5fSwgcmVwZWF0OiAke2V2LnJlcGVhdH0sIHNoaWZ0S2V5OiAke2V2LnNoaWZ0S2V5fSB9YDtcblx0XHRcdH1cblx0XHRcdGlmIChldi50eXBlID09PSAnY29tcG9zaXRpb25zdGFydCcgfHwgZXYudHlwZSA9PT0gJ2NvbXBvc2l0aW9udXBkYXRlJyB8fCBldi50eXBlID09PSAnY29tcG9zaXRpb25lbmQnKSB7XG5cdFx0XHRcdHJldHVybiBgeyB0aW1lU3RhbXA6ICR7ZXYudGltZVN0YW1wLnRvRml4ZWQoMil9LCBzdGF0ZTogJHtwcmludFN0YXRlKGV2LnN0YXRlKX0sIHR5cGU6ICcke2V2LnR5cGV9JywgZGF0YTogJyR7cHJpbnRTdHJpbmcoZXYuZGF0YSl9JyB9YDtcblx0XHRcdH1cblx0XHRcdGlmIChldi50eXBlID09PSAnYmVmb3JlaW5wdXQnIHx8IGV2LnR5cGUgPT09ICdpbnB1dCcpIHtcblx0XHRcdFx0cmV0dXJuIGB7IHRpbWVTdGFtcDogJHtldi50aW1lU3RhbXAudG9GaXhlZCgyKX0sIHN0YXRlOiAke3ByaW50U3RhdGUoZXYuc3RhdGUpfSwgdHlwZTogJyR7ZXYudHlwZX0nLCBkYXRhOiAke2V2LmRhdGEgPT09IG51bGwgPyAnbnVsbCcgOiBgJyR7cHJpbnRTdHJpbmcoZXYuZGF0YSl9J2B9LCBpbnB1dFR5cGU6ICcke2V2LmlucHV0VHlwZX0nLCBpc0NvbXBvc2luZzogJHtldi5pc0NvbXBvc2luZ30gfWA7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoZXYpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHN0YXJ0VGVzdCgpIHtcblx0XHRpbnB1dGFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xuXHRcdG1haW5XaW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpbnB1dGFyZWEpO1xuXHRcdGlucHV0YXJlYS5mb2N1cygpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aW5wdXRhcmVhLnJlbW92ZSgpO1xuXHRcdH0pKTtcblx0XHRjb25zdCB3cmFwcGVyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXh0QXJlYVdyYXBwZXIoaW5wdXRhcmVhKSk7XG5cblx0XHR3cmFwcGVyLnNldFZhbHVlKCcnLCBgYWFhYWApO1xuXHRcdHdyYXBwZXIuc2V0U2VsZWN0aW9uUmFuZ2UoJycsIDIsIDIpO1xuXG5cdFx0Y29uc3QgcmVjb3JkRXZlbnQgPSAoZTogSVJlY29yZGVkRXZlbnQpID0+IHtcblx0XHRcdHJlY29yZGVkLmV2ZW50cy5wdXNoKGUpO1xuXHRcdH07XG5cblx0XHRjb25zdCByZWNvcmRLZXlib2FyZEV2ZW50ID0gKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkID0+IHtcblx0XHRcdGlmIChlLnR5cGUgIT09ICdrZXlkb3duJyAmJiBlLnR5cGUgIT09ICdrZXlwcmVzcycgJiYgZS50eXBlICE9PSAna2V5dXAnKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgTm90IHN1cHBvcnRlZCFgKTtcblx0XHRcdH1cblx0XHRcdGlmIChvcmlnaW5UaW1lU3RhbXAgPT09IDApIHtcblx0XHRcdFx0b3JpZ2luVGltZVN0YW1wID0gZS50aW1lU3RhbXA7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBldjogSVJlY29yZGVkS2V5Ym9hcmRFdmVudCA9IHtcblx0XHRcdFx0dGltZVN0YW1wOiBlLnRpbWVTdGFtcCAtIG9yaWdpblRpbWVTdGFtcCxcblx0XHRcdFx0c3RhdGU6IHJlYWRUZXh0YXJlYVN0YXRlKCksXG5cdFx0XHRcdHR5cGU6IGUudHlwZSxcblx0XHRcdFx0YWx0S2V5OiBlLmFsdEtleSxcblx0XHRcdFx0Y2hhckNvZGU6IGUuY2hhckNvZGUsXG5cdFx0XHRcdGNvZGU6IGUuY29kZSxcblx0XHRcdFx0Y3RybEtleTogZS5jdHJsS2V5LFxuXHRcdFx0XHRpc0NvbXBvc2luZzogZS5pc0NvbXBvc2luZyxcblx0XHRcdFx0a2V5OiBlLmtleSxcblx0XHRcdFx0a2V5Q29kZTogZS5rZXlDb2RlLFxuXHRcdFx0XHRsb2NhdGlvbjogZS5sb2NhdGlvbixcblx0XHRcdFx0bWV0YUtleTogZS5tZXRhS2V5LFxuXHRcdFx0XHRyZXBlYXQ6IGUucmVwZWF0LFxuXHRcdFx0XHRzaGlmdEtleTogZS5zaGlmdEtleVxuXHRcdFx0fTtcblx0XHRcdHJlY29yZEV2ZW50KGV2KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgcmVjb3JkQ29tcG9zaXRpb25FdmVudCA9IChlOiBDb21wb3NpdGlvbkV2ZW50KTogdm9pZCA9PiB7XG5cdFx0XHRpZiAoZS50eXBlICE9PSAnY29tcG9zaXRpb25zdGFydCcgJiYgZS50eXBlICE9PSAnY29tcG9zaXRpb251cGRhdGUnICYmIGUudHlwZSAhPT0gJ2NvbXBvc2l0aW9uZW5kJykge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vdCBzdXBwb3J0ZWQhYCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAob3JpZ2luVGltZVN0YW1wID09PSAwKSB7XG5cdFx0XHRcdG9yaWdpblRpbWVTdGFtcCA9IGUudGltZVN0YW1wO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZXY6IElSZWNvcmRlZENvbXBvc2l0aW9uRXZlbnQgPSB7XG5cdFx0XHRcdHRpbWVTdGFtcDogZS50aW1lU3RhbXAgLSBvcmlnaW5UaW1lU3RhbXAsXG5cdFx0XHRcdHN0YXRlOiByZWFkVGV4dGFyZWFTdGF0ZSgpLFxuXHRcdFx0XHR0eXBlOiBlLnR5cGUsXG5cdFx0XHRcdGRhdGE6IGUuZGF0YSxcblx0XHRcdH07XG5cdFx0XHRyZWNvcmRFdmVudChldik7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHJlY29yZElucHV0RXZlbnQgPSAoZTogSW5wdXRFdmVudCk6IHZvaWQgPT4ge1xuXHRcdFx0aWYgKGUudHlwZSAhPT0gJ2JlZm9yZWlucHV0JyAmJiBlLnR5cGUgIT09ICdpbnB1dCcpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBOb3Qgc3VwcG9ydGVkIWApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9yaWdpblRpbWVTdGFtcCA9PT0gMCkge1xuXHRcdFx0XHRvcmlnaW5UaW1lU3RhbXAgPSBlLnRpbWVTdGFtcDtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGV2OiBJUmVjb3JkZWRJbnB1dEV2ZW50ID0ge1xuXHRcdFx0XHR0aW1lU3RhbXA6IGUudGltZVN0YW1wIC0gb3JpZ2luVGltZVN0YW1wLFxuXHRcdFx0XHRzdGF0ZTogcmVhZFRleHRhcmVhU3RhdGUoKSxcblx0XHRcdFx0dHlwZTogZS50eXBlLFxuXHRcdFx0XHRkYXRhOiBlLmRhdGEsXG5cdFx0XHRcdGlucHV0VHlwZTogZS5pbnB1dFR5cGUsXG5cdFx0XHRcdGlzQ29tcG9zaW5nOiBlLmlzQ29tcG9zaW5nLFxuXHRcdFx0fTtcblx0XHRcdHJlY29yZEV2ZW50KGV2KTtcblx0XHR9O1xuXG5cdFx0d3JhcHBlci5vbktleURvd24ocmVjb3JkS2V5Ym9hcmRFdmVudCk7XG5cdFx0d3JhcHBlci5vbktleVByZXNzKHJlY29yZEtleWJvYXJkRXZlbnQpO1xuXHRcdHdyYXBwZXIub25LZXlVcChyZWNvcmRLZXlib2FyZEV2ZW50KTtcblx0XHR3cmFwcGVyLm9uQ29tcG9zaXRpb25TdGFydChyZWNvcmRDb21wb3NpdGlvbkV2ZW50KTtcblx0XHR3cmFwcGVyLm9uQ29tcG9zaXRpb25VcGRhdGUocmVjb3JkQ29tcG9zaXRpb25FdmVudCk7XG5cdFx0d3JhcHBlci5vbkNvbXBvc2l0aW9uRW5kKHJlY29yZENvbXBvc2l0aW9uRXZlbnQpO1xuXHRcdHdyYXBwZXIub25CZWZvcmVJbnB1dChyZWNvcmRJbnB1dEV2ZW50KTtcblx0XHR3cmFwcGVyLm9uSW5wdXQocmVjb3JkSW5wdXRFdmVudCk7XG5cdH1cblxufSkoKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsaUJBQWlCLG9CQUFvQjtBQUU5QyxZQUFZLGFBQWE7QUFDekIsWUFBWSxjQUFjO0FBQzFCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsdUJBQXVCO0FB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
