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
import { CachedFunction } from "../../../base/common/cache.js";
import { getStructuralKey } from "../../../base/common/equals.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { FileAccess } from "../../../base/common/network.js";
import { derived, observableFromEvent, ValueWithChangeEventFromObservable } from "../../../base/common/observable.js";
import { localize } from "../../../nls.js";
import { IAccessibilityService } from "../../accessibility/common/accessibility.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { observableConfigValue } from "../../observable/common/platformObservableUtils.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
const IAccessibilitySignalService = createDecorator("accessibilitySignalService");
const AcknowledgeDocCommentsToken = Symbol("AcknowledgeDocCommentsToken");
let AccessibilitySignalService = class extends Disposable {
  constructor(configurationService, accessibilityService, telemetryService) {
    super();
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this.telemetryService = telemetryService;
    this.sounds = /* @__PURE__ */ new Map();
    this.screenReaderAttached = observableFromEvent(
      this,
      this.accessibilityService.onDidChangeScreenReaderOptimized,
      () => (
        /** @description accessibilityService.onDidChangeScreenReaderOptimized */
        this.accessibilityService.isScreenReaderOptimized()
      )
    );
    this.sentTelemetry = /* @__PURE__ */ new Set();
    this.playingSounds = /* @__PURE__ */ new Set();
    this._signalConfigValue = new CachedFunction((signal) => observableConfigValue(signal.settingsKey, { sound: "off", announcement: "off" }, this.configurationService));
    this._signalEnabledState = new CachedFunction(
      { getCacheKey: getStructuralKey },
      (arg) => {
        return derived((reader) => {
          const setting = this._signalConfigValue.get(arg.signal).read(reader);
          if (arg.modality === "sound" || arg.modality === void 0) {
            if (checkEnabledState(setting.sound, () => this.screenReaderAttached.read(reader), arg.userGesture)) {
              return true;
            }
          }
          if (arg.modality === "announcement" || arg.modality === void 0) {
            if (checkEnabledState(setting.announcement, () => this.screenReaderAttached.read(reader), arg.userGesture)) {
              return true;
            }
          }
          return false;
        }).recomputeInitiallyAndOnChange(this._store);
      }
    );
  }
  getEnabledState(signal, userGesture, modality) {
    return new ValueWithChangeEventFromObservable(this._signalEnabledState.get({ signal, userGesture, modality }));
  }
  async playSignal(signal, options = {}) {
    const shouldPlayAnnouncement = options.modality === "announcement" || options.modality === void 0;
    const announcementMessage = signal.announcementMessage;
    if (shouldPlayAnnouncement && this.isAnnouncementEnabled(signal, options.userGesture) && announcementMessage) {
      this.accessibilityService.status(announcementMessage);
    }
    const shouldPlaySound = options.modality === "sound" || options.modality === void 0;
    if (shouldPlaySound && this.isSoundEnabled(signal, options.userGesture)) {
      this.sendSignalTelemetry(signal, options.source);
      await this.playSound(signal.sound.getSound(), options.allowManyInParallel);
    }
  }
  async playSignals(signals) {
    for (const signal of signals) {
      this.sendSignalTelemetry("signal" in signal ? signal.signal : signal, "source" in signal ? signal.source : void 0);
    }
    const signalArray = signals.map((s) => "signal" in s ? s.signal : s);
    const announcements = signalArray.filter((signal) => this.isAnnouncementEnabled(signal)).map((s) => s.announcementMessage);
    if (announcements.length) {
      this.accessibilityService.status(announcements.join(", "));
    }
    const sounds = new Set(signalArray.filter((signal) => this.isSoundEnabled(signal)).map((signal) => signal.sound.getSound()));
    await Promise.all(Array.from(sounds).map((sound) => this.playSound(sound, true)));
  }
  sendSignalTelemetry(signal, source) {
    const isScreenReaderOptimized = this.accessibilityService.isScreenReaderOptimized();
    const key = signal.name + (source ? `::${source}` : "") + (isScreenReaderOptimized ? "{screenReaderOptimized}" : "");
    if (this.sentTelemetry.has(key) || this.getVolumeInPercent() === 0) {
      return;
    }
    this.sentTelemetry.add(key);
    this.telemetryService.publicLog2("signal.played", {
      signal: signal.name,
      source: source ?? "",
      isScreenReaderOptimized
    });
  }
  getVolumeInPercent() {
    const volume = this.configurationService.getValue("accessibility.signalOptions.volume");
    if (typeof volume !== "number") {
      return 50;
    }
    return Math.max(Math.min(volume, 100), 0);
  }
  async playSound(sound, allowManyInParallel = false) {
    if (!allowManyInParallel && this.playingSounds.has(sound)) {
      return;
    }
    this.playingSounds.add(sound);
    const url = FileAccess.asBrowserUri(`vs/platform/accessibilitySignal/browser/media/${sound.fileName}`).toString(true);
    try {
      const sound2 = this.sounds.get(url);
      if (sound2) {
        sound2.volume = this.getVolumeInPercent() / 100;
        sound2.currentTime = 0;
        await sound2.play();
      } else {
        const playedSound = await playAudio(url, this.getVolumeInPercent() / 100);
        this.sounds.set(url, playedSound);
      }
    } catch (e) {
      if (!e.message.includes("play() can only be initiated by a user gesture")) {
        console.error("Error while playing sound", e);
      }
    } finally {
      this.playingSounds.delete(sound);
    }
  }
  playSignalLoop(signal, milliseconds) {
    let playing = true;
    const playSound = () => {
      if (playing) {
        this.playSignal(signal, { allowManyInParallel: true }).finally(() => {
          setTimeout(() => {
            if (playing) {
              playSound();
            }
          }, milliseconds);
        });
      }
    };
    playSound();
    return toDisposable(() => playing = false);
  }
  isAnnouncementEnabled(signal, userGesture) {
    if (!signal.announcementMessage) {
      return false;
    }
    return this._signalEnabledState.get({ signal, userGesture: !!userGesture, modality: "announcement" }).get();
  }
  isSoundEnabled(signal, userGesture) {
    return this._signalEnabledState.get({ signal, userGesture: !!userGesture, modality: "sound" }).get();
  }
  onSoundEnabledChanged(signal) {
    return this.getEnabledState(signal, false).onDidChange;
  }
  getDelayMs(signal, modality, mode) {
    if (!this.configurationService.getValue("accessibility.signalOptions.debouncePositionChanges")) {
      return 0;
    }
    let value;
    if (signal.name === AccessibilitySignal.errorAtPosition.name && mode === "positional") {
      value = this.configurationService.getValue("accessibility.signalOptions.experimental.delays.errorAtPosition");
    } else if (signal.name === AccessibilitySignal.warningAtPosition.name && mode === "positional") {
      value = this.configurationService.getValue("accessibility.signalOptions.experimental.delays.warningAtPosition");
    } else {
      value = this.configurationService.getValue("accessibility.signalOptions.experimental.delays.general");
    }
    return modality === "sound" ? value.sound : value.announcement;
  }
};
AccessibilitySignalService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IAccessibilityService),
  __decorateParam(2, ITelemetryService)
], AccessibilitySignalService);
function checkEnabledState(state, getScreenReaderAttached, isTriggeredByUserGesture) {
  return state === "on" || state === "always" || state === "auto" && getScreenReaderAttached() || state === "userGesture" && isTriggeredByUserGesture;
}
function playAudio(url, volume) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.volume = volume;
    audio.addEventListener("ended", () => {
      resolve(audio);
    });
    audio.addEventListener("error", (e) => {
      reject(e.error);
    });
    audio.play().catch((e) => {
      reject(e);
    });
  });
}
const _Sound = class _Sound {
  constructor(fileName) {
    this.fileName = fileName;
  }
  static register(options) {
    const sound = new _Sound(options.fileName);
    return sound;
  }
};
_Sound.error = _Sound.register({ fileName: "error.mp3" });
_Sound.warning = _Sound.register({ fileName: "warning.mp3" });
_Sound.success = _Sound.register({ fileName: "success.mp3" });
_Sound.foldedArea = _Sound.register({ fileName: "foldedAreas.mp3" });
_Sound.break = _Sound.register({ fileName: "break.mp3" });
_Sound.quickFixes = _Sound.register({ fileName: "quickFixes.mp3" });
_Sound.taskCompleted = _Sound.register({ fileName: "taskCompleted.mp3" });
_Sound.taskFailed = _Sound.register({ fileName: "taskFailed.mp3" });
_Sound.terminalBell = _Sound.register({ fileName: "terminalBell.mp3" });
_Sound.diffLineInserted = _Sound.register({ fileName: "diffLineInserted.mp3" });
_Sound.diffLineDeleted = _Sound.register({ fileName: "diffLineDeleted.mp3" });
_Sound.diffLineModified = _Sound.register({ fileName: "diffLineModified.mp3" });
_Sound.requestSent = _Sound.register({ fileName: "requestSent.mp3" });
_Sound.responseReceived1 = _Sound.register({ fileName: "responseReceived1.mp3" });
_Sound.responseReceived2 = _Sound.register({ fileName: "responseReceived2.mp3" });
_Sound.responseReceived3 = _Sound.register({ fileName: "responseReceived3.mp3" });
_Sound.responseReceived4 = _Sound.register({ fileName: "responseReceived4.mp3" });
_Sound.clear = _Sound.register({ fileName: "clear.mp3" });
_Sound.save = _Sound.register({ fileName: "save.mp3" });
_Sound.format = _Sound.register({ fileName: "format.mp3" });
_Sound.voiceRecordingStarted = _Sound.register({ fileName: "voiceRecordingStarted.mp3" });
_Sound.voiceRecordingStopped = _Sound.register({ fileName: "voiceRecordingStopped.mp3" });
_Sound.progress = _Sound.register({ fileName: "progress.mp3" });
_Sound.chatEditModifiedFile = _Sound.register({ fileName: "chatEditModifiedFile.mp3" });
_Sound.editsKept = _Sound.register({ fileName: "editsKept.mp3" });
_Sound.editsUndone = _Sound.register({ fileName: "editsUndone.mp3" });
let Sound = _Sound;
class SoundSource {
  constructor(randomOneOf) {
    this.randomOneOf = randomOneOf;
  }
  getSound(deterministic = false) {
    if (deterministic || this.randomOneOf.length === 1) {
      return this.randomOneOf[0];
    } else {
      const index = Math.floor(Math.random() * this.randomOneOf.length);
      return this.randomOneOf[index];
    }
  }
}
const _AccessibilitySignal = class _AccessibilitySignal {
  constructor(sound, name, legacySoundSettingsKey, settingsKey, legacyAnnouncementSettingsKey, announcementMessage) {
    this.sound = sound;
    this.name = name;
    this.legacySoundSettingsKey = legacySoundSettingsKey;
    this.settingsKey = settingsKey;
    this.legacyAnnouncementSettingsKey = legacyAnnouncementSettingsKey;
    this.announcementMessage = announcementMessage;
  }
  static register(options) {
    const soundSource = new SoundSource("randomOneOf" in options.sound ? options.sound.randomOneOf : [options.sound]);
    const signal = new _AccessibilitySignal(
      soundSource,
      options.name,
      options.legacySoundSettingsKey,
      options.settingsKey,
      options.legacyAnnouncementSettingsKey,
      options.announcementMessage
    );
    _AccessibilitySignal._signals.add(signal);
    return signal;
  }
  static get allAccessibilitySignals() {
    return [...this._signals];
  }
};
_AccessibilitySignal._signals = /* @__PURE__ */ new Set();
_AccessibilitySignal.errorAtPosition = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.positionHasError.name", "Error at Position"),
  sound: Sound.error,
  announcementMessage: localize("accessibility.signals.positionHasError", "Error"),
  settingsKey: "accessibility.signals.positionHasError",
  delaySettingsKey: "accessibility.signalOptions.delays.errorAtPosition"
});
_AccessibilitySignal.warningAtPosition = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.positionHasWarning.name", "Warning at Position"),
  sound: Sound.warning,
  announcementMessage: localize("accessibility.signals.positionHasWarning", "Warning"),
  settingsKey: "accessibility.signals.positionHasWarning",
  delaySettingsKey: "accessibility.signalOptions.delays.warningAtPosition"
});
_AccessibilitySignal.errorOnLine = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.lineHasError.name", "Error on Line"),
  sound: Sound.error,
  legacySoundSettingsKey: "audioCues.lineHasError",
  legacyAnnouncementSettingsKey: "accessibility.alert.error",
  announcementMessage: localize("accessibility.signals.lineHasError", "Error on Line"),
  settingsKey: "accessibility.signals.lineHasError"
});
_AccessibilitySignal.warningOnLine = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.lineHasWarning.name", "Warning on Line"),
  sound: Sound.warning,
  legacySoundSettingsKey: "audioCues.lineHasWarning",
  legacyAnnouncementSettingsKey: "accessibility.alert.warning",
  announcementMessage: localize("accessibility.signals.lineHasWarning", "Warning on Line"),
  settingsKey: "accessibility.signals.lineHasWarning"
});
_AccessibilitySignal.foldedArea = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.lineHasFoldedArea.name", "Folded Area on Line"),
  sound: Sound.foldedArea,
  legacySoundSettingsKey: "audioCues.lineHasFoldedArea",
  legacyAnnouncementSettingsKey: "accessibility.alert.foldedArea",
  announcementMessage: localize("accessibility.signals.lineHasFoldedArea", "Folded"),
  settingsKey: "accessibility.signals.lineHasFoldedArea"
});
_AccessibilitySignal.break = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.lineHasBreakpoint.name", "Breakpoint on Line"),
  sound: Sound.break,
  legacySoundSettingsKey: "audioCues.lineHasBreakpoint",
  legacyAnnouncementSettingsKey: "accessibility.alert.breakpoint",
  announcementMessage: localize("accessibility.signals.lineHasBreakpoint", "Breakpoint"),
  settingsKey: "accessibility.signals.lineHasBreakpoint"
});
_AccessibilitySignal.inlineSuggestion = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.lineHasInlineSuggestion.name", "Inline Suggestion on Line"),
  sound: Sound.quickFixes,
  legacySoundSettingsKey: "audioCues.lineHasInlineSuggestion",
  settingsKey: "accessibility.signals.lineHasInlineSuggestion"
});
_AccessibilitySignal.terminalQuickFix = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.terminalQuickFix.name", "Terminal Quick Fix"),
  sound: Sound.quickFixes,
  legacySoundSettingsKey: "audioCues.terminalQuickFix",
  legacyAnnouncementSettingsKey: "accessibility.alert.terminalQuickFix",
  announcementMessage: localize("accessibility.signals.terminalQuickFix", "Quick Fix"),
  settingsKey: "accessibility.signals.terminalQuickFix"
});
_AccessibilitySignal.onDebugBreak = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.onDebugBreak.name", "Debugger Stopped on Breakpoint"),
  sound: Sound.break,
  legacySoundSettingsKey: "audioCues.onDebugBreak",
  legacyAnnouncementSettingsKey: "accessibility.alert.onDebugBreak",
  announcementMessage: localize("accessibility.signals.onDebugBreak", "Breakpoint"),
  settingsKey: "accessibility.signals.onDebugBreak"
});
_AccessibilitySignal.noInlayHints = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.noInlayHints", "No Inlay Hints on Line"),
  sound: Sound.error,
  legacySoundSettingsKey: "audioCues.noInlayHints",
  legacyAnnouncementSettingsKey: "accessibility.alert.noInlayHints",
  announcementMessage: localize("accessibility.signals.noInlayHints", "No Inlay Hints"),
  settingsKey: "accessibility.signals.noInlayHints"
});
_AccessibilitySignal.taskCompleted = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.taskCompleted", "Task Completed"),
  sound: Sound.taskCompleted,
  legacySoundSettingsKey: "audioCues.taskCompleted",
  legacyAnnouncementSettingsKey: "accessibility.alert.taskCompleted",
  announcementMessage: localize("accessibility.signals.taskCompleted", "Task Completed"),
  settingsKey: "accessibility.signals.taskCompleted"
});
_AccessibilitySignal.taskFailed = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.taskFailed", "Task Failed"),
  sound: Sound.taskFailed,
  legacySoundSettingsKey: "audioCues.taskFailed",
  legacyAnnouncementSettingsKey: "accessibility.alert.taskFailed",
  announcementMessage: localize("accessibility.signals.taskFailed", "Task Failed"),
  settingsKey: "accessibility.signals.taskFailed"
});
_AccessibilitySignal.terminalCommandFailed = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.terminalCommandFailed", "Terminal Command Failed"),
  sound: Sound.error,
  legacySoundSettingsKey: "audioCues.terminalCommandFailed",
  legacyAnnouncementSettingsKey: "accessibility.alert.terminalCommandFailed",
  announcementMessage: localize("accessibility.signals.terminalCommandFailed", "Command Failed"),
  settingsKey: "accessibility.signals.terminalCommandFailed"
});
_AccessibilitySignal.terminalCommandSucceeded = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.terminalCommandSucceeded", "Terminal Command Succeeded"),
  sound: Sound.success,
  announcementMessage: localize("accessibility.signals.terminalCommandSucceeded", "Command Succeeded"),
  settingsKey: "accessibility.signals.terminalCommandSucceeded"
});
_AccessibilitySignal.terminalBell = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.terminalBell", "Terminal Bell"),
  sound: Sound.terminalBell,
  legacySoundSettingsKey: "audioCues.terminalBell",
  legacyAnnouncementSettingsKey: "accessibility.alert.terminalBell",
  announcementMessage: localize("accessibility.signals.terminalBell", "Terminal Bell"),
  settingsKey: "accessibility.signals.terminalBell"
});
_AccessibilitySignal.notebookCellCompleted = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.notebookCellCompleted", "Notebook Cell Completed"),
  sound: Sound.taskCompleted,
  legacySoundSettingsKey: "audioCues.notebookCellCompleted",
  legacyAnnouncementSettingsKey: "accessibility.alert.notebookCellCompleted",
  announcementMessage: localize("accessibility.signals.notebookCellCompleted", "Notebook Cell Completed"),
  settingsKey: "accessibility.signals.notebookCellCompleted"
});
_AccessibilitySignal.notebookCellFailed = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.notebookCellFailed", "Notebook Cell Failed"),
  sound: Sound.taskFailed,
  legacySoundSettingsKey: "audioCues.notebookCellFailed",
  legacyAnnouncementSettingsKey: "accessibility.alert.notebookCellFailed",
  announcementMessage: localize("accessibility.signals.notebookCellFailed", "Notebook Cell Failed"),
  settingsKey: "accessibility.signals.notebookCellFailed"
});
_AccessibilitySignal.diffLineInserted = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.diffLineInserted", "Diff Line Inserted"),
  sound: Sound.diffLineInserted,
  legacySoundSettingsKey: "audioCues.diffLineInserted",
  settingsKey: "accessibility.signals.diffLineInserted"
});
_AccessibilitySignal.diffLineDeleted = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.diffLineDeleted", "Diff Line Deleted"),
  sound: Sound.diffLineDeleted,
  legacySoundSettingsKey: "audioCues.diffLineDeleted",
  settingsKey: "accessibility.signals.diffLineDeleted"
});
_AccessibilitySignal.diffLineModified = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.diffLineModified", "Diff Line Modified"),
  sound: Sound.diffLineModified,
  legacySoundSettingsKey: "audioCues.diffLineModified",
  settingsKey: "accessibility.signals.diffLineModified"
});
_AccessibilitySignal.chatEditModifiedFile = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.chatEditModifiedFile", "Chat Edit Modified File"),
  sound: Sound.chatEditModifiedFile,
  announcementMessage: localize("accessibility.signals.chatEditModifiedFile", "File Modified from Chat Edits"),
  settingsKey: "accessibility.signals.chatEditModifiedFile"
});
_AccessibilitySignal.chatRequestSent = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.chatRequestSent", "Chat Request Sent"),
  sound: Sound.requestSent,
  legacySoundSettingsKey: "audioCues.chatRequestSent",
  legacyAnnouncementSettingsKey: "accessibility.alert.chatRequestSent",
  announcementMessage: localize("accessibility.signals.chatRequestSent", "Chat Request Sent"),
  settingsKey: "accessibility.signals.chatRequestSent"
});
_AccessibilitySignal.chatResponseReceived = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.chatResponseReceived", "Chat Response Received"),
  legacySoundSettingsKey: "audioCues.chatResponseReceived",
  sound: {
    randomOneOf: [
      Sound.responseReceived1,
      Sound.responseReceived2,
      Sound.responseReceived3,
      Sound.responseReceived4
    ]
  },
  settingsKey: "accessibility.signals.chatResponseReceived"
});
_AccessibilitySignal.codeActionTriggered = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.codeActionRequestTriggered", "Code Action Request Triggered"),
  sound: Sound.voiceRecordingStarted,
  legacySoundSettingsKey: "audioCues.codeActionRequestTriggered",
  legacyAnnouncementSettingsKey: "accessibility.alert.codeActionRequestTriggered",
  announcementMessage: localize("accessibility.signals.codeActionRequestTriggered", "Code Action Request Triggered"),
  settingsKey: "accessibility.signals.codeActionTriggered"
});
_AccessibilitySignal.codeActionApplied = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.codeActionApplied", "Code Action Applied"),
  legacySoundSettingsKey: "audioCues.codeActionApplied",
  sound: Sound.voiceRecordingStopped,
  settingsKey: "accessibility.signals.codeActionApplied"
});
_AccessibilitySignal.progress = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.progress", "Progress"),
  sound: Sound.progress,
  legacySoundSettingsKey: "audioCues.chatResponsePending",
  legacyAnnouncementSettingsKey: "accessibility.alert.progress",
  announcementMessage: localize("accessibility.signals.progress", "Progress"),
  settingsKey: "accessibility.signals.progress"
});
_AccessibilitySignal.clear = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.clear", "Clear"),
  sound: Sound.clear,
  legacySoundSettingsKey: "audioCues.clear",
  legacyAnnouncementSettingsKey: "accessibility.alert.clear",
  announcementMessage: localize("accessibility.signals.clear", "Clear"),
  settingsKey: "accessibility.signals.clear"
});
_AccessibilitySignal.save = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.save", "Save"),
  sound: Sound.save,
  legacySoundSettingsKey: "audioCues.save",
  legacyAnnouncementSettingsKey: "accessibility.alert.save",
  announcementMessage: localize("accessibility.signals.save", "Save"),
  settingsKey: "accessibility.signals.save"
});
_AccessibilitySignal.format = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.format", "Format"),
  sound: Sound.format,
  legacySoundSettingsKey: "audioCues.format",
  legacyAnnouncementSettingsKey: "accessibility.alert.format",
  announcementMessage: localize("accessibility.signals.format", "Format"),
  settingsKey: "accessibility.signals.format"
});
_AccessibilitySignal.voiceRecordingStarted = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.voiceRecordingStarted", "Voice Recording Started"),
  sound: Sound.voiceRecordingStarted,
  legacySoundSettingsKey: "audioCues.voiceRecordingStarted",
  settingsKey: "accessibility.signals.voiceRecordingStarted"
});
_AccessibilitySignal.voiceRecordingStopped = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.voiceRecordingStopped", "Voice Recording Stopped"),
  sound: Sound.voiceRecordingStopped,
  legacySoundSettingsKey: "audioCues.voiceRecordingStopped",
  settingsKey: "accessibility.signals.voiceRecordingStopped"
});
_AccessibilitySignal.editsKept = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.editsKept", "Edits Kept"),
  sound: Sound.editsKept,
  announcementMessage: localize("accessibility.signals.editsKept", "Edits Kept"),
  settingsKey: "accessibility.signals.editsKept"
});
_AccessibilitySignal.editsUndone = _AccessibilitySignal.register({
  name: localize("accessibilitySignals.editsUndone", "Undo Edits"),
  sound: Sound.editsUndone,
  announcementMessage: localize("accessibility.signals.editsUndone", "Edits Undone"),
  settingsKey: "accessibility.signals.editsUndone"
});
let AccessibilitySignal = _AccessibilitySignal;
export {
  AccessibilitySignal,
  AccessibilitySignalService,
  AcknowledgeDocCommentsToken,
  IAccessibilitySignalService,
  Sound,
  SoundSource
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5U2lnbmFsL2Jyb3dzZXIvYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYWNoZWRGdW5jdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhY2hlLmpzJztcbmltcG9ydCB7IGdldFN0cnVjdHVyYWxLZXkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcXVhbHMuanMnO1xuaW1wb3J0IHsgRXZlbnQsIElWYWx1ZVdpdGhDaGFuZ2VFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgZGVyaXZlZCwgb2JzZXJ2YWJsZUZyb21FdmVudCwgVmFsdWVXaXRoQ2hhbmdlRXZlbnRGcm9tT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlIH0gZnJvbSAnLi4vLi4vb2JzZXJ2YWJsZS9jb21tb24vcGxhdGZvcm1PYnNlcnZhYmxlVXRpbHMuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5cbmV4cG9ydCBjb25zdCBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlPignYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UnKTtcblxuZXhwb3J0IGludGVyZmFjZSBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHBsYXlTaWduYWwoc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsLCBvcHRpb25zPzogSUFjY2Vzc2JpbGl0eVNpZ25hbE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuXHRwbGF5U2lnbmFscyhzaWduYWxzOiAoQWNjZXNzaWJpbGl0eVNpZ25hbCB8IHsgc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsOyBzb3VyY2U6IHN0cmluZyB9KVtdKTogUHJvbWlzZTx2b2lkPjtcblx0cGxheVNpZ25hbExvb3Aoc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsLCBtaWxsaXNlY29uZHM6IG51bWJlcik6IElEaXNwb3NhYmxlO1xuXG5cdGdldEVuYWJsZWRTdGF0ZShzaWduYWw6IEFjY2Vzc2liaWxpdHlTaWduYWwsIHVzZXJHZXN0dXJlOiBib29sZWFuLCBtb2RhbGl0eT86IEFjY2Vzc2liaWxpdHlNb2RhbGl0eSB8IHVuZGVmaW5lZCk6IElWYWx1ZVdpdGhDaGFuZ2VFdmVudDxib29sZWFuPjtcblx0Z2V0RGVsYXlNcyhzaWduYWw6IEFjY2Vzc2liaWxpdHlTaWduYWwsIG1vZGFsaXR5OiBBY2Nlc3NpYmlsaXR5TW9kYWxpdHksIG1vZGU6ICdsaW5lJyB8ICdwb3NpdGlvbmFsJyk6IG51bWJlcjtcblx0LyoqXG5cdCAqIEF2b2lkIHRoaXMgbWV0aG9kIGFuZCBwcmVmZXIgYC5wbGF5U2lnbmFsYCFcblx0ICogT25seSB1c2UgaXQgd2hlbiB5b3Ugd2FudCB0byBwbGF5IHRoZSBzb3VuZCByZWdhcmRsZXNzIG9mIGVuYWJsZW1lbnQsIGUuZy4gaW4gdGhlIHNldHRpbmdzIHF1aWNrIHBpY2suXG5cdCAqL1xuXHRwbGF5U291bmQoc2lnbmFsOiBTb3VuZCwgYWxsb3dNYW55SW5QYXJhbGxlbDogYm9vbGVhbiwgdG9rZW46IHR5cGVvZiBBY2tub3dsZWRnZURvY0NvbW1lbnRzVG9rZW4pOiBQcm9taXNlPHZvaWQ+O1xuXG5cdC8qKiBAZGVwcmVjYXRlZCBVc2UgZ2V0RW5hYmxlZFN0YXRlKC4uLikub25DaGFuZ2UgKi9cblx0aXNTb3VuZEVuYWJsZWQoc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsKTogYm9vbGVhbjtcblx0LyoqIEBkZXByZWNhdGVkIFVzZSBnZXRFbmFibGVkU3RhdGUoLi4uKS52YWx1ZSAqL1xuXHRpc0Fubm91bmNlbWVudEVuYWJsZWQoc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsKTogYm9vbGVhbjtcblx0LyoqIEBkZXByZWNhdGVkIFVzZSBnZXRFbmFibGVkU3RhdGUoLi4uKS5vbkNoYW5nZSAqL1xuXHRvblNvdW5kRW5hYmxlZENoYW5nZWQoc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsKTogRXZlbnQ8dm9pZD47XG59XG5cbi8qKiBNYWtlIHN1cmUgeW91IHVuZGVyc3RhbmQgdGhlIGRvYyBjb21tZW50cyBvZiB0aGUgbWV0aG9kIHlvdSB3YW50IHRvIGNhbGwgd2hlbiB1c2luZyB0aGlzIHRva2VuISAqL1xuZXhwb3J0IGNvbnN0IEFja25vd2xlZGdlRG9jQ29tbWVudHNUb2tlbiA9IFN5bWJvbCgnQWNrbm93bGVkZ2VEb2NDb21tZW50c1Rva2VuJyk7XG5cbmV4cG9ydCB0eXBlIEFjY2Vzc2liaWxpdHlNb2RhbGl0eSA9ICdzb3VuZCcgfCAnYW5ub3VuY2VtZW50JztcblxuZXhwb3J0IGludGVyZmFjZSBJQWNjZXNzYmlsaXR5U2lnbmFsT3B0aW9ucyB7XG5cdGFsbG93TWFueUluUGFyYWxsZWw/OiBib29sZWFuO1xuXG5cdG1vZGFsaXR5PzogQWNjZXNzaWJpbGl0eU1vZGFsaXR5O1xuXG5cdC8qKlxuXHQgKiBUaGUgc291cmNlIHRoYXQgdHJpZ2dlcmVkIHRoZSBzaWduYWwgKGUuZy4gXCJkaWZmRWRpdG9yLmN1cnNvclBvc2l0aW9uQ2hhbmdlZFwiKS5cblx0ICovXG5cdHNvdXJjZT86IHN0cmluZztcblxuXHQvKipcblx0ICogRm9yIGFjdGlvbnMgbGlrZSBzYXZlIG9yIGZvcm1hdCwgZGVwZW5kaW5nIG9uIHRoZVxuXHQgKiBjb25maWd1cmVkIHZhbHVlLCB3ZSB3aWxsIG9ubHlcblx0ICogcGxheSB0aGUgc291bmQgaWYgdGhlIHVzZXIgdHJpZ2dlcmVkIHRoZSBhY3Rpb24uXG5cdCAqL1xuXHR1c2VyR2VzdHVyZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgc291bmRzOiBNYXA8c3RyaW5nLCBIVE1MQXVkaW9FbGVtZW50PiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSByZWFkb25seSBzY3JlZW5SZWFkZXJBdHRhY2hlZCA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcyxcblx0XHR0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLm9uRGlkQ2hhbmdlU2NyZWVuUmVhZGVyT3B0aW1pemVkLFxuXHRcdCgpID0+IC8qKiBAZGVzY3JpcHRpb24gYWNjZXNzaWJpbGl0eVNlcnZpY2Uub25EaWRDaGFuZ2VTY3JlZW5SZWFkZXJPcHRpbWl6ZWQgKi8gdGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpXG5cdCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgc2VudFRlbGVtZXRyeSA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHVibGljIGdldEVuYWJsZWRTdGF0ZShzaWduYWw6IEFjY2Vzc2liaWxpdHlTaWduYWwsIHVzZXJHZXN0dXJlOiBib29sZWFuLCBtb2RhbGl0eT86IEFjY2Vzc2liaWxpdHlNb2RhbGl0eSB8IHVuZGVmaW5lZCk6IElWYWx1ZVdpdGhDaGFuZ2VFdmVudDxib29sZWFuPiB7XG5cdFx0cmV0dXJuIG5ldyBWYWx1ZVdpdGhDaGFuZ2VFdmVudEZyb21PYnNlcnZhYmxlKHRoaXMuX3NpZ25hbEVuYWJsZWRTdGF0ZS5nZXQoeyBzaWduYWwsIHVzZXJHZXN0dXJlLCBtb2RhbGl0eSB9KSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcGxheVNpZ25hbChzaWduYWw6IEFjY2Vzc2liaWxpdHlTaWduYWwsIG9wdGlvbnM6IElBY2Nlc3NiaWxpdHlTaWduYWxPcHRpb25zID0ge30pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzaG91bGRQbGF5QW5ub3VuY2VtZW50ID0gb3B0aW9ucy5tb2RhbGl0eSA9PT0gJ2Fubm91bmNlbWVudCcgfHwgb3B0aW9ucy5tb2RhbGl0eSA9PT0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGFubm91bmNlbWVudE1lc3NhZ2UgPSBzaWduYWwuYW5ub3VuY2VtZW50TWVzc2FnZTtcblx0XHRpZiAoc2hvdWxkUGxheUFubm91bmNlbWVudCAmJiB0aGlzLmlzQW5ub3VuY2VtZW50RW5hYmxlZChzaWduYWwsIG9wdGlvbnMudXNlckdlc3R1cmUpICYmIGFubm91bmNlbWVudE1lc3NhZ2UpIHtcblx0XHRcdHRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2Uuc3RhdHVzKGFubm91bmNlbWVudE1lc3NhZ2UpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNob3VsZFBsYXlTb3VuZCA9IG9wdGlvbnMubW9kYWxpdHkgPT09ICdzb3VuZCcgfHwgb3B0aW9ucy5tb2RhbGl0eSA9PT0gdW5kZWZpbmVkO1xuXHRcdGlmIChzaG91bGRQbGF5U291bmQgJiYgdGhpcy5pc1NvdW5kRW5hYmxlZChzaWduYWwsIG9wdGlvbnMudXNlckdlc3R1cmUpKSB7XG5cdFx0XHR0aGlzLnNlbmRTaWduYWxUZWxlbWV0cnkoc2lnbmFsLCBvcHRpb25zLnNvdXJjZSk7XG5cdFx0XHRhd2FpdCB0aGlzLnBsYXlTb3VuZChzaWduYWwuc291bmQuZ2V0U291bmQoKSwgb3B0aW9ucy5hbGxvd01hbnlJblBhcmFsbGVsKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcGxheVNpZ25hbHMoc2lnbmFsczogKEFjY2Vzc2liaWxpdHlTaWduYWwgfCB7IHNpZ25hbDogQWNjZXNzaWJpbGl0eVNpZ25hbDsgc291cmNlOiBzdHJpbmcgfSlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZvciAoY29uc3Qgc2lnbmFsIG9mIHNpZ25hbHMpIHtcblx0XHRcdHRoaXMuc2VuZFNpZ25hbFRlbGVtZXRyeSgnc2lnbmFsJyBpbiBzaWduYWwgPyBzaWduYWwuc2lnbmFsIDogc2lnbmFsLCAnc291cmNlJyBpbiBzaWduYWwgPyBzaWduYWwuc291cmNlIDogdW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0Y29uc3Qgc2lnbmFsQXJyYXkgPSBzaWduYWxzLm1hcChzID0+ICdzaWduYWwnIGluIHMgPyBzLnNpZ25hbCA6IHMpO1xuXHRcdGNvbnN0IGFubm91bmNlbWVudHMgPSBzaWduYWxBcnJheS5maWx0ZXIoc2lnbmFsID0+IHRoaXMuaXNBbm5vdW5jZW1lbnRFbmFibGVkKHNpZ25hbCkpLm1hcChzID0+IHMuYW5ub3VuY2VtZW50TWVzc2FnZSk7XG5cdFx0aWYgKGFubm91bmNlbWVudHMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLnN0YXR1cyhhbm5vdW5jZW1lbnRzLmpvaW4oJywgJykpO1xuXHRcdH1cblxuXHRcdC8vIFNvbWUgc291bmRzIGFyZSByZXVzZWQuIERvbid0IHBsYXkgdGhlIHNhbWUgc291bmQgdHdpY2UuXG5cdFx0Y29uc3Qgc291bmRzID0gbmV3IFNldChzaWduYWxBcnJheS5maWx0ZXIoc2lnbmFsID0+IHRoaXMuaXNTb3VuZEVuYWJsZWQoc2lnbmFsKSkubWFwKHNpZ25hbCA9PiBzaWduYWwuc291bmQuZ2V0U291bmQoKSkpO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKEFycmF5LmZyb20oc291bmRzKS5tYXAoc291bmQgPT4gdGhpcy5wbGF5U291bmQoc291bmQsIHRydWUpKSk7XG5cblx0fVxuXG5cblx0cHJpdmF0ZSBzZW5kU2lnbmFsVGVsZW1ldHJ5KHNpZ25hbDogQWNjZXNzaWJpbGl0eVNpZ25hbCwgc291cmNlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBpc1NjcmVlblJlYWRlck9wdGltaXplZCA9IHRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKTtcblx0XHRjb25zdCBrZXkgPSBzaWduYWwubmFtZSArIChzb3VyY2UgPyBgOjoke3NvdXJjZX1gIDogJycpICsgKGlzU2NyZWVuUmVhZGVyT3B0aW1pemVkID8gJ3tzY3JlZW5SZWFkZXJPcHRpbWl6ZWR9JyA6ICcnKTtcblx0XHQvLyBPbmx5IHNlbmQgb25jZSBwZXIgdXNlciBzZXNzaW9uXG5cdFx0aWYgKHRoaXMuc2VudFRlbGVtZXRyeS5oYXMoa2V5KSB8fCB0aGlzLmdldFZvbHVtZUluUGVyY2VudCgpID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuc2VudFRlbGVtZXRyeS5hZGQoa2V5KTtcblxuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPHtcblx0XHRcdHNpZ25hbDogc3RyaW5nO1xuXHRcdFx0c291cmNlOiBzdHJpbmc7XG5cdFx0XHRpc1NjcmVlblJlYWRlck9wdGltaXplZDogYm9vbGVhbjtcblx0XHR9LCB7XG5cdFx0XHRvd25lcjogJ2hlZGlldCc7XG5cblx0XHRcdHNpZ25hbDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBzaWduYWwgdGhhdCB3YXMgcGxheWVkLicgfTtcblx0XHRcdHNvdXJjZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBzb3VyY2UgdGhhdCB0cmlnZ2VyZWQgdGhlIHNpZ25hbCAoZS5nLiBcImRpZmZFZGl0b3JOYXZpZ2F0aW9uXCIpLicgfTtcblx0XHRcdGlzU2NyZWVuUmVhZGVyT3B0aW1pemVkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgdXNlciBpcyB1c2luZyBhIHNjcmVlbiByZWFkZXInIH07XG5cblx0XHRcdGNvbW1lbnQ6ICdUaGlzIGRhdGEgaXMgY29sbGVjdGVkIHRvIHVuZGVyc3RhbmQgaG93IHNpZ25hbHMgYXJlIHVzZWQgYW5kIGlmIG1vcmUgc2lnbmFscyBzaG91bGQgYmUgYWRkZWQuJztcblx0XHR9Pignc2lnbmFsLnBsYXllZCcsIHtcblx0XHRcdHNpZ25hbDogc2lnbmFsLm5hbWUsXG5cdFx0XHRzb3VyY2U6IHNvdXJjZSA/PyAnJyxcblx0XHRcdGlzU2NyZWVuUmVhZGVyT3B0aW1pemVkLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRWb2x1bWVJblBlcmNlbnQoKTogbnVtYmVyIHtcblx0XHRjb25zdCB2b2x1bWUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy52b2x1bWUnKTtcblx0XHRpZiAodHlwZW9mIHZvbHVtZSAhPT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiA1MDtcblx0XHR9XG5cblx0XHRyZXR1cm4gTWF0aC5tYXgoTWF0aC5taW4odm9sdW1lLCAxMDApLCAwKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgcGxheWluZ1NvdW5kcyA9IG5ldyBTZXQ8U291bmQ+KCk7XG5cblx0cHVibGljIGFzeW5jIHBsYXlTb3VuZChzb3VuZDogU291bmQsIGFsbG93TWFueUluUGFyYWxsZWwgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghYWxsb3dNYW55SW5QYXJhbGxlbCAmJiB0aGlzLnBsYXlpbmdTb3VuZHMuaGFzKHNvdW5kKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnBsYXlpbmdTb3VuZHMuYWRkKHNvdW5kKTtcblx0XHRjb25zdCB1cmwgPSBGaWxlQWNjZXNzLmFzQnJvd3NlclVyaShgdnMvcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL21lZGlhLyR7c291bmQuZmlsZU5hbWV9YCkudG9TdHJpbmcodHJ1ZSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc291bmQgPSB0aGlzLnNvdW5kcy5nZXQodXJsKTtcblx0XHRcdGlmIChzb3VuZCkge1xuXHRcdFx0XHRzb3VuZC52b2x1bWUgPSB0aGlzLmdldFZvbHVtZUluUGVyY2VudCgpIC8gMTAwO1xuXHRcdFx0XHRzb3VuZC5jdXJyZW50VGltZSA9IDA7XG5cdFx0XHRcdGF3YWl0IHNvdW5kLnBsYXkoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHBsYXllZFNvdW5kID0gYXdhaXQgcGxheUF1ZGlvKHVybCwgdGhpcy5nZXRWb2x1bWVJblBlcmNlbnQoKSAvIDEwMCk7XG5cdFx0XHRcdHRoaXMuc291bmRzLnNldCh1cmwsIHBsYXllZFNvdW5kKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAoIWUubWVzc2FnZS5pbmNsdWRlcygncGxheSgpIGNhbiBvbmx5IGJlIGluaXRpYXRlZCBieSBhIHVzZXIgZ2VzdHVyZScpKSB7XG5cdFx0XHRcdC8vIHRyYWNraW5nIHRoaXMgaXNzdWUgaW4gIzE3ODY0Miwgbm8gbmVlZCB0byBzcGFtIHRoZSBjb25zb2xlXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHdoaWxlIHBsYXlpbmcgc291bmQnLCBlKTtcblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5wbGF5aW5nU291bmRzLmRlbGV0ZShzb3VuZCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHBsYXlTaWduYWxMb29wKHNpZ25hbDogQWNjZXNzaWJpbGl0eVNpZ25hbCwgbWlsbGlzZWNvbmRzOiBudW1iZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0bGV0IHBsYXlpbmcgPSB0cnVlO1xuXHRcdGNvbnN0IHBsYXlTb3VuZCA9ICgpID0+IHtcblx0XHRcdGlmIChwbGF5aW5nKSB7XG5cdFx0XHRcdHRoaXMucGxheVNpZ25hbChzaWduYWwsIHsgYWxsb3dNYW55SW5QYXJhbGxlbDogdHJ1ZSB9KS5maW5hbGx5KCgpID0+IHtcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdGlmIChwbGF5aW5nKSB7XG5cdFx0XHRcdFx0XHRcdHBsYXlTb3VuZCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIG1pbGxpc2Vjb25kcyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cGxheVNvdW5kKCk7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiBwbGF5aW5nID0gZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2lnbmFsQ29uZmlnVmFsdWUgPSBuZXcgQ2FjaGVkRnVuY3Rpb24oKHNpZ25hbDogQWNjZXNzaWJpbGl0eVNpZ25hbCkgPT4gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlPHtcblx0XHRzb3VuZDogRW5hYmxlZFN0YXRlO1xuXHRcdGFubm91bmNlbWVudDogRW5hYmxlZFN0YXRlO1xuXHR9PihzaWduYWwuc2V0dGluZ3NLZXksIHsgc291bmQ6ICdvZmYnLCBhbm5vdW5jZW1lbnQ6ICdvZmYnIH0sIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zaWduYWxFbmFibGVkU3RhdGUgPSBuZXcgQ2FjaGVkRnVuY3Rpb24oXG5cdFx0eyBnZXRDYWNoZUtleTogZ2V0U3RydWN0dXJhbEtleSB9LFxuXHRcdChhcmc6IHsgc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsOyB1c2VyR2VzdHVyZTogYm9vbGVhbjsgbW9kYWxpdHk/OiBBY2Nlc3NpYmlsaXR5TW9kYWxpdHkgfCB1bmRlZmluZWQgfSkgPT4ge1xuXHRcdFx0cmV0dXJuIGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdFx0LyoqIEBkZXNjcmlwdGlvbiBzb3VuZCBlbmFibGVkICovXG5cdFx0XHRcdGNvbnN0IHNldHRpbmcgPSB0aGlzLl9zaWduYWxDb25maWdWYWx1ZS5nZXQoYXJnLnNpZ25hbCkucmVhZChyZWFkZXIpO1xuXG5cdFx0XHRcdGlmIChhcmcubW9kYWxpdHkgPT09ICdzb3VuZCcgfHwgYXJnLm1vZGFsaXR5ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRpZiAoY2hlY2tFbmFibGVkU3RhdGUoc2V0dGluZy5zb3VuZCwgKCkgPT4gdGhpcy5zY3JlZW5SZWFkZXJBdHRhY2hlZC5yZWFkKHJlYWRlciksIGFyZy51c2VyR2VzdHVyZSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoYXJnLm1vZGFsaXR5ID09PSAnYW5ub3VuY2VtZW50JyB8fCBhcmcubW9kYWxpdHkgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGlmIChjaGVja0VuYWJsZWRTdGF0ZShzZXR0aW5nLmFubm91bmNlbWVudCwgKCkgPT4gdGhpcy5zY3JlZW5SZWFkZXJBdHRhY2hlZC5yZWFkKHJlYWRlciksIGFyZy51c2VyR2VzdHVyZSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9KS5yZWNvbXB1dGVJbml0aWFsbHlBbmRPbkNoYW5nZSh0aGlzLl9zdG9yZSk7XG5cdFx0fVxuXHQpO1xuXG5cdHB1YmxpYyBpc0Fubm91bmNlbWVudEVuYWJsZWQoc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsLCB1c2VyR2VzdHVyZT86IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRpZiAoIXNpZ25hbC5hbm5vdW5jZW1lbnRNZXNzYWdlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9zaWduYWxFbmFibGVkU3RhdGUuZ2V0KHsgc2lnbmFsLCB1c2VyR2VzdHVyZTogISF1c2VyR2VzdHVyZSwgbW9kYWxpdHk6ICdhbm5vdW5jZW1lbnQnIH0pLmdldCgpO1xuXHR9XG5cblx0cHVibGljIGlzU291bmRFbmFibGVkKHNpZ25hbDogQWNjZXNzaWJpbGl0eVNpZ25hbCwgdXNlckdlc3R1cmU/OiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3NpZ25hbEVuYWJsZWRTdGF0ZS5nZXQoeyBzaWduYWwsIHVzZXJHZXN0dXJlOiAhIXVzZXJHZXN0dXJlLCBtb2RhbGl0eTogJ3NvdW5kJyB9KS5nZXQoKTtcblx0fVxuXG5cdHB1YmxpYyBvblNvdW5kRW5hYmxlZENoYW5nZWQoc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsKTogRXZlbnQ8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmdldEVuYWJsZWRTdGF0ZShzaWduYWwsIGZhbHNlKS5vbkRpZENoYW5nZTtcblx0fVxuXG5cdHB1YmxpYyBnZXREZWxheU1zKHNpZ25hbDogQWNjZXNzaWJpbGl0eVNpZ25hbCwgbW9kYWxpdHk6IEFjY2Vzc2liaWxpdHlNb2RhbGl0eSwgbW9kZTogJ2xpbmUnIHwgJ3Bvc2l0aW9uYWwnKTogbnVtYmVyIHtcblx0XHRpZiAoIXRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5kZWJvdW5jZVBvc2l0aW9uQ2hhbmdlcycpKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0bGV0IHZhbHVlOiB7IHNvdW5kOiBudW1iZXI7IGFubm91bmNlbWVudDogbnVtYmVyIH07XG5cdFx0aWYgKHNpZ25hbC5uYW1lID09PSBBY2Nlc3NpYmlsaXR5U2lnbmFsLmVycm9yQXRQb3NpdGlvbi5uYW1lICYmIG1vZGUgPT09ICdwb3NpdGlvbmFsJykge1xuXHRcdFx0dmFsdWUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbE9wdGlvbnMuZXhwZXJpbWVudGFsLmRlbGF5cy5lcnJvckF0UG9zaXRpb24nKTtcblx0XHR9IGVsc2UgaWYgKHNpZ25hbC5uYW1lID09PSBBY2Nlc3NpYmlsaXR5U2lnbmFsLndhcm5pbmdBdFBvc2l0aW9uLm5hbWUgJiYgbW9kZSA9PT0gJ3Bvc2l0aW9uYWwnKSB7XG5cdFx0XHR2YWx1ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5leHBlcmltZW50YWwuZGVsYXlzLndhcm5pbmdBdFBvc2l0aW9uJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhbHVlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxPcHRpb25zLmV4cGVyaW1lbnRhbC5kZWxheXMuZ2VuZXJhbCcpO1xuXHRcdH1cblx0XHRyZXR1cm4gbW9kYWxpdHkgPT09ICdzb3VuZCcgPyB2YWx1ZS5zb3VuZCA6IHZhbHVlLmFubm91bmNlbWVudDtcblx0fVxufVxuXG50eXBlIEVuYWJsZWRTdGF0ZSA9ICdvbicgfCAnb2ZmJyB8ICdhdXRvJyB8ICd1c2VyR2VzdHVyZScgfCAnYWx3YXlzJyB8ICduZXZlcic7XG5mdW5jdGlvbiBjaGVja0VuYWJsZWRTdGF0ZShzdGF0ZTogRW5hYmxlZFN0YXRlLCBnZXRTY3JlZW5SZWFkZXJBdHRhY2hlZDogKCkgPT4gYm9vbGVhbiwgaXNUcmlnZ2VyZWRCeVVzZXJHZXN0dXJlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdHJldHVybiBzdGF0ZSA9PT0gJ29uJyB8fCBzdGF0ZSA9PT0gJ2Fsd2F5cycgfHwgKHN0YXRlID09PSAnYXV0bycgJiYgZ2V0U2NyZWVuUmVhZGVyQXR0YWNoZWQoKSkgfHwgc3RhdGUgPT09ICd1c2VyR2VzdHVyZScgJiYgaXNUcmlnZ2VyZWRCeVVzZXJHZXN0dXJlO1xufVxuXG4vKipcbiAqIFBsYXkgdGhlIGdpdmVuIGF1ZGlvIHVybC5cbiAqIEB2b2x1bWUgdmFsdWUgYmV0d2VlbiAwIGFuZCAxXG4gKi9cbmZ1bmN0aW9uIHBsYXlBdWRpbyh1cmw6IHN0cmluZywgdm9sdW1lOiBudW1iZXIpOiBQcm9taXNlPEhUTUxBdWRpb0VsZW1lbnQ+IHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRjb25zdCBhdWRpbyA9IG5ldyBBdWRpbyh1cmwpO1xuXHRcdGF1ZGlvLnZvbHVtZSA9IHZvbHVtZTtcblx0XHRhdWRpby5hZGRFdmVudExpc3RlbmVyKCdlbmRlZCcsICgpID0+IHtcblx0XHRcdHJlc29sdmUoYXVkaW8pO1xuXHRcdH0pO1xuXHRcdGF1ZGlvLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgKGUpID0+IHtcblx0XHRcdC8vIFdoZW4gdGhlIGVycm9yIGV2ZW50IGZpcmVzLCBlbmRlZCBtaWdodCBub3QgYmUgY2FsbGVkXG5cdFx0XHRyZWplY3QoZS5lcnJvcik7XG5cdFx0fSk7XG5cdFx0YXVkaW8ucGxheSgpLmNhdGNoKGUgPT4ge1xuXHRcdFx0Ly8gV2hlbiBwbGF5IGZhaWxzLCB0aGUgZXJyb3IgZXZlbnQgaXMgbm90IGZpcmVkLlxuXHRcdFx0cmVqZWN0KGUpO1xuXHRcdH0pO1xuXHR9KTtcbn1cblxuLyoqXG4gKiBDb3JyZXNwb25kcyB0byB0aGUgYXVkaW8gZmlsZXMgaW4gLi9tZWRpYS5cbiovXG5leHBvcnQgY2xhc3MgU291bmQge1xuXHRwcml2YXRlIHN0YXRpYyByZWdpc3RlcihvcHRpb25zOiB7IGZpbGVOYW1lOiBzdHJpbmcgfSk6IFNvdW5kIHtcblx0XHRjb25zdCBzb3VuZCA9IG5ldyBTb3VuZChvcHRpb25zLmZpbGVOYW1lKTtcblx0XHRyZXR1cm4gc291bmQ7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGVycm9yID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ2Vycm9yLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgd2FybmluZyA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICd3YXJuaW5nLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgc3VjY2VzcyA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICdzdWNjZXNzLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgZm9sZGVkQXJlYSA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICdmb2xkZWRBcmVhcy5tcDMnIH0pO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGJyZWFrID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ2JyZWFrLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgcXVpY2tGaXhlcyA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICdxdWlja0ZpeGVzLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgdGFza0NvbXBsZXRlZCA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICd0YXNrQ29tcGxldGVkLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgdGFza0ZhaWxlZCA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICd0YXNrRmFpbGVkLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgdGVybWluYWxCZWxsID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ3Rlcm1pbmFsQmVsbC5tcDMnIH0pO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGRpZmZMaW5lSW5zZXJ0ZWQgPSBTb3VuZC5yZWdpc3Rlcih7IGZpbGVOYW1lOiAnZGlmZkxpbmVJbnNlcnRlZC5tcDMnIH0pO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGRpZmZMaW5lRGVsZXRlZCA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICdkaWZmTGluZURlbGV0ZWQubXAzJyB9KTtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBkaWZmTGluZU1vZGlmaWVkID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ2RpZmZMaW5lTW9kaWZpZWQubXAzJyB9KTtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSByZXF1ZXN0U2VudCA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICdyZXF1ZXN0U2VudC5tcDMnIH0pO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHJlc3BvbnNlUmVjZWl2ZWQxID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ3Jlc3BvbnNlUmVjZWl2ZWQxLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgcmVzcG9uc2VSZWNlaXZlZDIgPSBTb3VuZC5yZWdpc3Rlcih7IGZpbGVOYW1lOiAncmVzcG9uc2VSZWNlaXZlZDIubXAzJyB9KTtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSByZXNwb25zZVJlY2VpdmVkMyA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICdyZXNwb25zZVJlY2VpdmVkMy5tcDMnIH0pO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHJlc3BvbnNlUmVjZWl2ZWQ0ID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ3Jlc3BvbnNlUmVjZWl2ZWQ0Lm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgY2xlYXIgPSBTb3VuZC5yZWdpc3Rlcih7IGZpbGVOYW1lOiAnY2xlYXIubXAzJyB9KTtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBzYXZlID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ3NhdmUubXAzJyB9KTtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBmb3JtYXQgPSBTb3VuZC5yZWdpc3Rlcih7IGZpbGVOYW1lOiAnZm9ybWF0Lm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgdm9pY2VSZWNvcmRpbmdTdGFydGVkID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ3ZvaWNlUmVjb3JkaW5nU3RhcnRlZC5tcDMnIH0pO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHZvaWNlUmVjb3JkaW5nU3RvcHBlZCA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICd2b2ljZVJlY29yZGluZ1N0b3BwZWQubXAzJyB9KTtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBwcm9ncmVzcyA9IFNvdW5kLnJlZ2lzdGVyKHsgZmlsZU5hbWU6ICdwcm9ncmVzcy5tcDMnIH0pO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGNoYXRFZGl0TW9kaWZpZWRGaWxlID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ2NoYXRFZGl0TW9kaWZpZWRGaWxlLm1wMycgfSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgZWRpdHNLZXB0ID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ2VkaXRzS2VwdC5tcDMnIH0pO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGVkaXRzVW5kb25lID0gU291bmQucmVnaXN0ZXIoeyBmaWxlTmFtZTogJ2VkaXRzVW5kb25lLm1wMycgfSk7XG5cblx0cHJpdmF0ZSBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgZmlsZU5hbWU6IHN0cmluZykgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBTb3VuZFNvdXJjZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSByYW5kb21PbmVPZjogU291bmRbXVxuXHQpIHsgfVxuXG5cdHB1YmxpYyBnZXRTb3VuZChkZXRlcm1pbmlzdGljID0gZmFsc2UpOiBTb3VuZCB7XG5cdFx0aWYgKGRldGVybWluaXN0aWMgfHwgdGhpcy5yYW5kb21PbmVPZi5sZW5ndGggPT09IDEpIHtcblx0XHRcdHJldHVybiB0aGlzLnJhbmRvbU9uZU9mWzBdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHRoaXMucmFuZG9tT25lT2YubGVuZ3RoKTtcblx0XHRcdHJldHVybiB0aGlzLnJhbmRvbU9uZU9mW2luZGV4XTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEFjY2Vzc2liaWxpdHlTaWduYWwge1xuXHRwcml2YXRlIGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBzb3VuZDogU291bmRTb3VyY2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGVnYWN5U291bmRTZXR0aW5nc0tleTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBzZXR0aW5nc0tleTogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBsZWdhY3lBbm5vdW5jZW1lbnRTZXR0aW5nc0tleTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyByZWFkb25seSBhbm5vdW5jZW1lbnRNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWRcblx0KSB7IH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc2lnbmFscyA9IG5ldyBTZXQ8QWNjZXNzaWJpbGl0eVNpZ25hbD4oKTtcblx0cHJpdmF0ZSBzdGF0aWMgcmVnaXN0ZXIob3B0aW9uczoge1xuXHRcdG5hbWU6IHN0cmluZztcblx0XHRzb3VuZDogU291bmQgfCB7XG5cdFx0XHQvKipcblx0XHRcdCAqIEdhbWluZyBhbmQgb3RoZXIgYXBwcyBvZnRlbiBwbGF5IGEgc291bmQgdmFyaWFudCB3aGVuIHRoZSBzYW1lIGV2ZW50IGhhcHBlbnMgYWdhaW5cblx0XHRcdCAqIGZvciBhbiBpbXByb3ZlZCBleHBlcmllbmNlLiBUaGlzIG9wdGlvbiBlbmFibGVzIHBsYXlpbmcgYSByYW5kb20gc291bmQuXG5cdFx0XHQgKi9cblx0XHRcdHJhbmRvbU9uZU9mOiBTb3VuZFtdO1xuXHRcdH07XG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleT86IHN0cmluZztcblx0XHRzZXR0aW5nc0tleTogc3RyaW5nO1xuXHRcdGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5Pzogc3RyaW5nO1xuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U/OiBzdHJpbmc7XG5cdFx0ZGVsYXlTZXR0aW5nc0tleT86IHN0cmluZztcblx0fSk6IEFjY2Vzc2liaWxpdHlTaWduYWwge1xuXHRcdGNvbnN0IHNvdW5kU291cmNlID0gbmV3IFNvdW5kU291cmNlKCdyYW5kb21PbmVPZicgaW4gb3B0aW9ucy5zb3VuZCA/IG9wdGlvbnMuc291bmQucmFuZG9tT25lT2YgOiBbb3B0aW9ucy5zb3VuZF0pO1xuXHRcdGNvbnN0IHNpZ25hbCA9IG5ldyBBY2Nlc3NpYmlsaXR5U2lnbmFsKFxuXHRcdFx0c291bmRTb3VyY2UsXG5cdFx0XHRvcHRpb25zLm5hbWUsXG5cdFx0XHRvcHRpb25zLmxlZ2FjeVNvdW5kU2V0dGluZ3NLZXksXG5cdFx0XHRvcHRpb25zLnNldHRpbmdzS2V5LFxuXHRcdFx0b3B0aW9ucy5sZWdhY3lBbm5vdW5jZW1lbnRTZXR0aW5nc0tleSxcblx0XHRcdG9wdGlvbnMuYW5ub3VuY2VtZW50TWVzc2FnZSxcblx0XHQpO1xuXHRcdEFjY2Vzc2liaWxpdHlTaWduYWwuX3NpZ25hbHMuYWRkKHNpZ25hbCk7XG5cdFx0cmV0dXJuIHNpZ25hbDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0IGFsbEFjY2Vzc2liaWxpdHlTaWduYWxzKCkge1xuXHRcdHJldHVybiBbLi4udGhpcy5fc2lnbmFsc107XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGVycm9yQXRQb3NpdGlvbiA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5wb3NpdGlvbkhhc0Vycm9yLm5hbWUnLCAnRXJyb3IgYXQgUG9zaXRpb24nKSxcblx0XHRzb3VuZDogU291bmQuZXJyb3IsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5wb3NpdGlvbkhhc0Vycm9yJywgJ0Vycm9yJyksXG5cdFx0c2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMucG9zaXRpb25IYXNFcnJvcicsXG5cdFx0ZGVsYXlTZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5kZWxheXMuZXJyb3JBdFBvc2l0aW9uJ1xuXHR9KTtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSB3YXJuaW5nQXRQb3NpdGlvbiA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5wb3NpdGlvbkhhc1dhcm5pbmcubmFtZScsICdXYXJuaW5nIGF0IFBvc2l0aW9uJyksXG5cdFx0c291bmQ6IFNvdW5kLndhcm5pbmcsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5wb3NpdGlvbkhhc1dhcm5pbmcnLCAnV2FybmluZycpLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnBvc2l0aW9uSGFzV2FybmluZycsXG5cdFx0ZGVsYXlTZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFsT3B0aW9ucy5kZWxheXMud2FybmluZ0F0UG9zaXRpb24nXG5cdH0pO1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgZXJyb3JPbkxpbmUgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMubGluZUhhc0Vycm9yLm5hbWUnLCAnRXJyb3Igb24gTGluZScpLFxuXHRcdHNvdW5kOiBTb3VuZC5lcnJvcixcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLmxpbmVIYXNFcnJvcicsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0LmVycm9yJyxcblx0XHRhbm5vdW5jZW1lbnRNZXNzYWdlOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNFcnJvcicsICdFcnJvciBvbiBMaW5lJyksXG5cdFx0c2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc0Vycm9yJyxcblx0fSk7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSB3YXJuaW5nT25MaW5lID0gQWNjZXNzaWJpbGl0eVNpZ25hbC5yZWdpc3Rlcih7XG5cdFx0bmFtZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTaWduYWxzLmxpbmVIYXNXYXJuaW5nLm5hbWUnLCAnV2FybmluZyBvbiBMaW5lJyksXG5cdFx0c291bmQ6IFNvdW5kLndhcm5pbmcsXG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleTogJ2F1ZGlvQ3Vlcy5saW5lSGFzV2FybmluZycsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0Lndhcm5pbmcnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc1dhcm5pbmcnLCAnV2FybmluZyBvbiBMaW5lJyksXG5cdFx0c2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc1dhcm5pbmcnLFxuXHR9KTtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBmb2xkZWRBcmVhID0gQWNjZXNzaWJpbGl0eVNpZ25hbC5yZWdpc3Rlcih7XG5cdFx0bmFtZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTaWduYWxzLmxpbmVIYXNGb2xkZWRBcmVhLm5hbWUnLCAnRm9sZGVkIEFyZWEgb24gTGluZScpLFxuXHRcdHNvdW5kOiBTb3VuZC5mb2xkZWRBcmVhLFxuXHRcdGxlZ2FjeVNvdW5kU2V0dGluZ3NLZXk6ICdhdWRpb0N1ZXMubGluZUhhc0ZvbGRlZEFyZWEnLFxuXHRcdGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5hbGVydC5mb2xkZWRBcmVhJyxcblx0XHRhbm5vdW5jZW1lbnRNZXNzYWdlOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNGb2xkZWRBcmVhJywgJ0ZvbGRlZCcpLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNGb2xkZWRBcmVhJyxcblx0fSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgYnJlYWsgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMubGluZUhhc0JyZWFrcG9pbnQubmFtZScsICdCcmVha3BvaW50IG9uIExpbmUnKSxcblx0XHRzb3VuZDogU291bmQuYnJlYWssXG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleTogJ2F1ZGlvQ3Vlcy5saW5lSGFzQnJlYWtwb2ludCcsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0LmJyZWFrcG9pbnQnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMubGluZUhhc0JyZWFrcG9pbnQnLCAnQnJlYWtwb2ludCcpLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmxpbmVIYXNCcmVha3BvaW50Jyxcblx0fSk7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgaW5saW5lU3VnZ2VzdGlvbiA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5saW5lSGFzSW5saW5lU3VnZ2VzdGlvbi5uYW1lJywgJ0lubGluZSBTdWdnZXN0aW9uIG9uIExpbmUnKSxcblx0XHRzb3VuZDogU291bmQucXVpY2tGaXhlcyxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLmxpbmVIYXNJbmxpbmVTdWdnZXN0aW9uJyxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5saW5lSGFzSW5saW5lU3VnZ2VzdGlvbicsXG5cdH0pO1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgdGVybWluYWxRdWlja0ZpeCA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy50ZXJtaW5hbFF1aWNrRml4Lm5hbWUnLCAnVGVybWluYWwgUXVpY2sgRml4JyksXG5cdFx0c291bmQ6IFNvdW5kLnF1aWNrRml4ZXMsXG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleTogJ2F1ZGlvQ3Vlcy50ZXJtaW5hbFF1aWNrRml4Jyxcblx0XHRsZWdhY3lBbm5vdW5jZW1lbnRTZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuYWxlcnQudGVybWluYWxRdWlja0ZpeCcsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy50ZXJtaW5hbFF1aWNrRml4JywgJ1F1aWNrIEZpeCcpLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRlcm1pbmFsUXVpY2tGaXgnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IG9uRGVidWdCcmVhayA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5vbkRlYnVnQnJlYWsubmFtZScsICdEZWJ1Z2dlciBTdG9wcGVkIG9uIEJyZWFrcG9pbnQnKSxcblx0XHRzb3VuZDogU291bmQuYnJlYWssXG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleTogJ2F1ZGlvQ3Vlcy5vbkRlYnVnQnJlYWsnLFxuXHRcdGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5hbGVydC5vbkRlYnVnQnJlYWsnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMub25EZWJ1Z0JyZWFrJywgJ0JyZWFrcG9pbnQnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5vbkRlYnVnQnJlYWsnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IG5vSW5sYXlIaW50cyA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5ub0lubGF5SGludHMnLCAnTm8gSW5sYXkgSGludHMgb24gTGluZScpLFxuXHRcdHNvdW5kOiBTb3VuZC5lcnJvcixcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLm5vSW5sYXlIaW50cycsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0Lm5vSW5sYXlIaW50cycsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub0lubGF5SGludHMnLCAnTm8gSW5sYXkgSGludHMnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub0lubGF5SGludHMnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHRhc2tDb21wbGV0ZWQgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMudGFza0NvbXBsZXRlZCcsICdUYXNrIENvbXBsZXRlZCcpLFxuXHRcdHNvdW5kOiBTb3VuZC50YXNrQ29tcGxldGVkLFxuXHRcdGxlZ2FjeVNvdW5kU2V0dGluZ3NLZXk6ICdhdWRpb0N1ZXMudGFza0NvbXBsZXRlZCcsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0LnRhc2tDb21wbGV0ZWQnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGFza0NvbXBsZXRlZCcsICdUYXNrIENvbXBsZXRlZCcpLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRhc2tDb21wbGV0ZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHRhc2tGYWlsZWQgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMudGFza0ZhaWxlZCcsICdUYXNrIEZhaWxlZCcpLFxuXHRcdHNvdW5kOiBTb3VuZC50YXNrRmFpbGVkLFxuXHRcdGxlZ2FjeVNvdW5kU2V0dGluZ3NLZXk6ICdhdWRpb0N1ZXMudGFza0ZhaWxlZCcsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0LnRhc2tGYWlsZWQnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGFza0ZhaWxlZCcsICdUYXNrIEZhaWxlZCcpLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLnRhc2tGYWlsZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHRlcm1pbmFsQ29tbWFuZEZhaWxlZCA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy50ZXJtaW5hbENvbW1hbmRGYWlsZWQnLCAnVGVybWluYWwgQ29tbWFuZCBGYWlsZWQnKSxcblx0XHRzb3VuZDogU291bmQuZXJyb3IsXG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleTogJ2F1ZGlvQ3Vlcy50ZXJtaW5hbENvbW1hbmRGYWlsZWQnLFxuXHRcdGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5hbGVydC50ZXJtaW5hbENvbW1hbmRGYWlsZWQnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxDb21tYW5kRmFpbGVkJywgJ0NvbW1hbmQgRmFpbGVkJyksXG5cdFx0c2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxDb21tYW5kRmFpbGVkJyxcblx0fSk7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSB0ZXJtaW5hbENvbW1hbmRTdWNjZWVkZWQgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMudGVybWluYWxDb21tYW5kU3VjY2VlZGVkJywgJ1Rlcm1pbmFsIENvbW1hbmQgU3VjY2VlZGVkJyksXG5cdFx0c291bmQ6IFNvdW5kLnN1Y2Nlc3MsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy50ZXJtaW5hbENvbW1hbmRTdWNjZWVkZWQnLCAnQ29tbWFuZCBTdWNjZWVkZWQnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy50ZXJtaW5hbENvbW1hbmRTdWNjZWVkZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHRlcm1pbmFsQmVsbCA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy50ZXJtaW5hbEJlbGwnLCAnVGVybWluYWwgQmVsbCcpLFxuXHRcdHNvdW5kOiBTb3VuZC50ZXJtaW5hbEJlbGwsXG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleTogJ2F1ZGlvQ3Vlcy50ZXJtaW5hbEJlbGwnLFxuXHRcdGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5hbGVydC50ZXJtaW5hbEJlbGwnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudGVybWluYWxCZWxsJywgJ1Rlcm1pbmFsIEJlbGwnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy50ZXJtaW5hbEJlbGwnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IG5vdGVib29rQ2VsbENvbXBsZXRlZCA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5ub3RlYm9va0NlbGxDb21wbGV0ZWQnLCAnTm90ZWJvb2sgQ2VsbCBDb21wbGV0ZWQnKSxcblx0XHRzb3VuZDogU291bmQudGFza0NvbXBsZXRlZCxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLm5vdGVib29rQ2VsbENvbXBsZXRlZCcsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0Lm5vdGVib29rQ2VsbENvbXBsZXRlZCcsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub3RlYm9va0NlbGxDb21wbGV0ZWQnLCAnTm90ZWJvb2sgQ2VsbCBDb21wbGV0ZWQnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub3RlYm9va0NlbGxDb21wbGV0ZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IG5vdGVib29rQ2VsbEZhaWxlZCA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5ub3RlYm9va0NlbGxGYWlsZWQnLCAnTm90ZWJvb2sgQ2VsbCBGYWlsZWQnKSxcblx0XHRzb3VuZDogU291bmQudGFza0ZhaWxlZCxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLm5vdGVib29rQ2VsbEZhaWxlZCcsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0Lm5vdGVib29rQ2VsbEZhaWxlZCcsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub3RlYm9va0NlbGxGYWlsZWQnLCAnTm90ZWJvb2sgQ2VsbCBGYWlsZWQnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5ub3RlYm9va0NlbGxGYWlsZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGRpZmZMaW5lSW5zZXJ0ZWQgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMuZGlmZkxpbmVJbnNlcnRlZCcsICdEaWZmIExpbmUgSW5zZXJ0ZWQnKSxcblx0XHRzb3VuZDogU291bmQuZGlmZkxpbmVJbnNlcnRlZCxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLmRpZmZMaW5lSW5zZXJ0ZWQnLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmRpZmZMaW5lSW5zZXJ0ZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGRpZmZMaW5lRGVsZXRlZCA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5kaWZmTGluZURlbGV0ZWQnLCAnRGlmZiBMaW5lIERlbGV0ZWQnKSxcblx0XHRzb3VuZDogU291bmQuZGlmZkxpbmVEZWxldGVkLFxuXHRcdGxlZ2FjeVNvdW5kU2V0dGluZ3NLZXk6ICdhdWRpb0N1ZXMuZGlmZkxpbmVEZWxldGVkJyxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5kaWZmTGluZURlbGV0ZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGRpZmZMaW5lTW9kaWZpZWQgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMuZGlmZkxpbmVNb2RpZmllZCcsICdEaWZmIExpbmUgTW9kaWZpZWQnKSxcblx0XHRzb3VuZDogU291bmQuZGlmZkxpbmVNb2RpZmllZCxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLmRpZmZMaW5lTW9kaWZpZWQnLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmRpZmZMaW5lTW9kaWZpZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGNoYXRFZGl0TW9kaWZpZWRGaWxlID0gQWNjZXNzaWJpbGl0eVNpZ25hbC5yZWdpc3Rlcih7XG5cdFx0bmFtZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTaWduYWxzLmNoYXRFZGl0TW9kaWZpZWRGaWxlJywgJ0NoYXQgRWRpdCBNb2RpZmllZCBGaWxlJyksXG5cdFx0c291bmQ6IFNvdW5kLmNoYXRFZGl0TW9kaWZpZWRGaWxlLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY2hhdEVkaXRNb2RpZmllZEZpbGUnLCAnRmlsZSBNb2RpZmllZCBmcm9tIENoYXQgRWRpdHMnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jaGF0RWRpdE1vZGlmaWVkRmlsZScsXG5cdH0pO1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgY2hhdFJlcXVlc3RTZW50ID0gQWNjZXNzaWJpbGl0eVNpZ25hbC5yZWdpc3Rlcih7XG5cdFx0bmFtZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTaWduYWxzLmNoYXRSZXF1ZXN0U2VudCcsICdDaGF0IFJlcXVlc3QgU2VudCcpLFxuXHRcdHNvdW5kOiBTb3VuZC5yZXF1ZXN0U2VudCxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLmNoYXRSZXF1ZXN0U2VudCcsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0LmNoYXRSZXF1ZXN0U2VudCcsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jaGF0UmVxdWVzdFNlbnQnLCAnQ2hhdCBSZXF1ZXN0IFNlbnQnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jaGF0UmVxdWVzdFNlbnQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGNoYXRSZXNwb25zZVJlY2VpdmVkID0gQWNjZXNzaWJpbGl0eVNpZ25hbC5yZWdpc3Rlcih7XG5cdFx0bmFtZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTaWduYWxzLmNoYXRSZXNwb25zZVJlY2VpdmVkJywgJ0NoYXQgUmVzcG9uc2UgUmVjZWl2ZWQnKSxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLmNoYXRSZXNwb25zZVJlY2VpdmVkJyxcblx0XHRzb3VuZDoge1xuXHRcdFx0cmFuZG9tT25lT2Y6IFtcblx0XHRcdFx0U291bmQucmVzcG9uc2VSZWNlaXZlZDEsXG5cdFx0XHRcdFNvdW5kLnJlc3BvbnNlUmVjZWl2ZWQyLFxuXHRcdFx0XHRTb3VuZC5yZXNwb25zZVJlY2VpdmVkMyxcblx0XHRcdFx0U291bmQucmVzcG9uc2VSZWNlaXZlZDRcblx0XHRcdF1cblx0XHR9LFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNoYXRSZXNwb25zZVJlY2VpdmVkJ1xuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGNvZGVBY3Rpb25UcmlnZ2VyZWQgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMuY29kZUFjdGlvblJlcXVlc3RUcmlnZ2VyZWQnLCAnQ29kZSBBY3Rpb24gUmVxdWVzdCBUcmlnZ2VyZWQnKSxcblx0XHRzb3VuZDogU291bmQudm9pY2VSZWNvcmRpbmdTdGFydGVkLFxuXHRcdGxlZ2FjeVNvdW5kU2V0dGluZ3NLZXk6ICdhdWRpb0N1ZXMuY29kZUFjdGlvblJlcXVlc3RUcmlnZ2VyZWQnLFxuXHRcdGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5hbGVydC5jb2RlQWN0aW9uUmVxdWVzdFRyaWdnZXJlZCcsXG5cdFx0YW5ub3VuY2VtZW50TWVzc2FnZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jb2RlQWN0aW9uUmVxdWVzdFRyaWdnZXJlZCcsICdDb2RlIEFjdGlvbiBSZXF1ZXN0IFRyaWdnZXJlZCcpLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNvZGVBY3Rpb25UcmlnZ2VyZWQnLFxuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGNvZGVBY3Rpb25BcHBsaWVkID0gQWNjZXNzaWJpbGl0eVNpZ25hbC5yZWdpc3Rlcih7XG5cdFx0bmFtZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTaWduYWxzLmNvZGVBY3Rpb25BcHBsaWVkJywgJ0NvZGUgQWN0aW9uIEFwcGxpZWQnKSxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLmNvZGVBY3Rpb25BcHBsaWVkJyxcblx0XHRzb3VuZDogU291bmQudm9pY2VSZWNvcmRpbmdTdG9wcGVkLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmNvZGVBY3Rpb25BcHBsaWVkJ1xuXHR9KTtcblxuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgcHJvZ3Jlc3MgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMucHJvZ3Jlc3MnLCAnUHJvZ3Jlc3MnKSxcblx0XHRzb3VuZDogU291bmQucHJvZ3Jlc3MsXG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleTogJ2F1ZGlvQ3Vlcy5jaGF0UmVzcG9uc2VQZW5kaW5nJyxcblx0XHRsZWdhY3lBbm5vdW5jZW1lbnRTZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuYWxlcnQucHJvZ3Jlc3MnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMucHJvZ3Jlc3MnLCAnUHJvZ3Jlc3MnKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5wcm9ncmVzcydcblx0fSk7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBjbGVhciA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5jbGVhcicsICdDbGVhcicpLFxuXHRcdHNvdW5kOiBTb3VuZC5jbGVhcixcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLmNsZWFyJyxcblx0XHRsZWdhY3lBbm5vdW5jZW1lbnRTZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuYWxlcnQuY2xlYXInLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuY2xlYXInLCAnQ2xlYXInKSxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy5jbGVhcidcblx0fSk7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBzYXZlID0gQWNjZXNzaWJpbGl0eVNpZ25hbC5yZWdpc3Rlcih7XG5cdFx0bmFtZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTaWduYWxzLnNhdmUnLCAnU2F2ZScpLFxuXHRcdHNvdW5kOiBTb3VuZC5zYXZlLFxuXHRcdGxlZ2FjeVNvdW5kU2V0dGluZ3NLZXk6ICdhdWRpb0N1ZXMuc2F2ZScsXG5cdFx0bGVnYWN5QW5ub3VuY2VtZW50U2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LmFsZXJ0LnNhdmUnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuc2F2ZScsICdTYXZlJyksXG5cdFx0c2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuc2F2ZSdcblx0fSk7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBmb3JtYXQgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMuZm9ybWF0JywgJ0Zvcm1hdCcpLFxuXHRcdHNvdW5kOiBTb3VuZC5mb3JtYXQsXG5cdFx0bGVnYWN5U291bmRTZXR0aW5nc0tleTogJ2F1ZGlvQ3Vlcy5mb3JtYXQnLFxuXHRcdGxlZ2FjeUFubm91bmNlbWVudFNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5hbGVydC5mb3JtYXQnLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZm9ybWF0JywgJ0Zvcm1hdCcpLFxuXHRcdHNldHRpbmdzS2V5OiAnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmZvcm1hdCdcblx0fSk7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSB2b2ljZVJlY29yZGluZ1N0YXJ0ZWQgPSBBY2Nlc3NpYmlsaXR5U2lnbmFsLnJlZ2lzdGVyKHtcblx0XHRuYW1lOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eVNpZ25hbHMudm9pY2VSZWNvcmRpbmdTdGFydGVkJywgJ1ZvaWNlIFJlY29yZGluZyBTdGFydGVkJyksXG5cdFx0c291bmQ6IFNvdW5kLnZvaWNlUmVjb3JkaW5nU3RhcnRlZCxcblx0XHRsZWdhY3lTb3VuZFNldHRpbmdzS2V5OiAnYXVkaW9DdWVzLnZvaWNlUmVjb3JkaW5nU3RhcnRlZCcsXG5cdFx0c2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMudm9pY2VSZWNvcmRpbmdTdGFydGVkJ1xuXHR9KTtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHZvaWNlUmVjb3JkaW5nU3RvcHBlZCA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy52b2ljZVJlY29yZGluZ1N0b3BwZWQnLCAnVm9pY2UgUmVjb3JkaW5nIFN0b3BwZWQnKSxcblx0XHRzb3VuZDogU291bmQudm9pY2VSZWNvcmRpbmdTdG9wcGVkLFxuXHRcdGxlZ2FjeVNvdW5kU2V0dGluZ3NLZXk6ICdhdWRpb0N1ZXMudm9pY2VSZWNvcmRpbmdTdG9wcGVkJyxcblx0XHRzZXR0aW5nc0tleTogJ2FjY2Vzc2liaWxpdHkuc2lnbmFscy52b2ljZVJlY29yZGluZ1N0b3BwZWQnXG5cdH0pO1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgZWRpdHNLZXB0ID0gQWNjZXNzaWJpbGl0eVNpZ25hbC5yZWdpc3Rlcih7XG5cdFx0bmFtZTogbG9jYWxpemUoJ2FjY2Vzc2liaWxpdHlTaWduYWxzLmVkaXRzS2VwdCcsICdFZGl0cyBLZXB0JyksXG5cdFx0c291bmQ6IFNvdW5kLmVkaXRzS2VwdCxcblx0XHRhbm5vdW5jZW1lbnRNZXNzYWdlOiBsb2NhbGl6ZSgnYWNjZXNzaWJpbGl0eS5zaWduYWxzLmVkaXRzS2VwdCcsICdFZGl0cyBLZXB0JyksXG5cdFx0c2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZWRpdHNLZXB0Jyxcblx0fSk7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBlZGl0c1VuZG9uZSA9IEFjY2Vzc2liaWxpdHlTaWduYWwucmVnaXN0ZXIoe1xuXHRcdG5hbWU6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5U2lnbmFscy5lZGl0c1VuZG9uZScsICdVbmRvIEVkaXRzJyksXG5cdFx0c291bmQ6IFNvdW5kLmVkaXRzVW5kb25lLFxuXHRcdGFubm91bmNlbWVudE1lc3NhZ2U6IGxvY2FsaXplKCdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZWRpdHNVbmRvbmUnLCAnRWRpdHMgVW5kb25lJyksXG5cdFx0c2V0dGluZ3NLZXk6ICdhY2Nlc3NpYmlsaXR5LnNpZ25hbHMuZWRpdHNVbmRvbmUnLFxuXHR9KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBd0I7QUFFakMsU0FBUyxZQUF5QixvQkFBb0I7QUFDdEQsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLHFCQUFxQiwwQ0FBMEM7QUFDakYsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx5QkFBeUI7QUFFM0IsTUFBTSw4QkFBOEIsZ0JBQTZDLDRCQUE0QjtBQXlCN0csTUFBTSw4QkFBOEIsT0FBTyw2QkFBNkI7QUFzQnhFLElBQU0sNkJBQU4sY0FBeUMsV0FBa0Q7QUFBQSxFQVNqRyxZQUN5QyxzQkFDQSxzQkFDSixrQkFDbkM7QUFDRCxVQUFNO0FBSmtDO0FBQ0E7QUFDSjtBQVZyQyxTQUFpQixTQUF3QyxvQkFBSSxJQUFJO0FBQ2pFLFNBQWlCLHVCQUF1QjtBQUFBLE1BQW9CO0FBQUEsTUFDM0QsS0FBSyxxQkFBcUI7QUFBQSxN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
