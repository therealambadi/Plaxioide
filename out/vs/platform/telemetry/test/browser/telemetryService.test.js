import assert from "assert";
import * as sinon from "sinon";
import sinonTest from "sinon-test";
import { mainWindow } from "../../../../base/browser/window.js";
import * as Errors from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { TestConfigurationService } from "../../../configuration/test/common/testConfigurationService.js";
import product from "../../../product/common/product.js";
import ErrorTelemetry from "../../browser/errorTelemetry.js";
import { TelemetryConfiguration, TelemetryLevel } from "../../common/telemetry.js";
import { TelemetryService } from "../../common/telemetryService.js";
import { NullAppender } from "../../common/telemetryUtils.js";
const sinonTestFn = sinonTest(sinon);
class TestTelemetryAppender {
  constructor() {
    this.events = [];
    this.isDisposed = false;
  }
  log(eventName, data) {
    this.events.push({ eventName, data });
  }
  getEventsCount() {
    return this.events.length;
  }
  flush() {
    this.isDisposed = true;
    return Promise.resolve(null);
  }
}
class ErrorTestingSettings {
  constructor() {
    this.randomUserFile = "a/path/that/doe_snt/con-tain/code/names.js";
    this.anonymizedRandomUserFile = "<REDACTED: user-file-path>";
    this.nodeModulePathToRetain = "node_modules/path/that/shouldbe/retained/names.js:14:15854";
    this.nodeModuleAsarPathToRetain = "node_modules.asar/path/that/shouldbe/retained/names.js:14:12354";
    this.personalInfo = "DANGEROUS/PATH";
    this.importantInfo = "important/information";
    this.filePrefix = "file:///";
    this.dangerousPathWithImportantInfo = this.filePrefix + this.personalInfo + "/resources/app/" + this.importantInfo;
    this.dangerousPathWithoutImportantInfo = this.filePrefix + this.personalInfo;
    this.missingModelPrefix = "Received model events for missing model ";
    this.missingModelMessage = this.missingModelPrefix + " " + this.dangerousPathWithoutImportantInfo;
    this.noSuchFilePrefix = "ENOENT: no such file or directory";
    this.noSuchFileMessage = this.noSuchFilePrefix + " '" + this.personalInfo + "'";
    this.stack = [
      `at e._modelEvents (${this.randomUserFile}:11:7309)`,
      `    at t.AllWorkers (${this.randomUserFile}:6:8844)`,
      `    at e.(anonymous function) [as _modelEvents] (${this.randomUserFile}:5:29552)`,
      `    at Function.<anonymous> (${this.randomUserFile}:6:8272)`,
      `    at e.dispatch (${this.randomUserFile}:5:26931)`,
      `    at e.request (/${this.nodeModuleAsarPathToRetain})`,
      `    at t._handleMessage (${this.nodeModuleAsarPathToRetain})`,
      `    at t._onmessage (/${this.nodeModulePathToRetain})`,
      `    at t.onmessage (${this.nodeModulePathToRetain})`,
      `    at DedicatedWorkerGlobalScope.self.onmessage`,
      this.dangerousPathWithImportantInfo,
      this.dangerousPathWithoutImportantInfo,
      this.missingModelMessage,
      this.noSuchFileMessage
    ];
  }
}
suite("TelemetryService", () => {
  const TestProductService = { _serviceBrand: void 0, ...product };
  test("Disposing", sinonTestFn(function() {
    const testAppender = new TestTelemetryAppender();
    const service = new TelemetryService({ appenders: [testAppender] }, new TestConfigurationService(), TestProductService);
    service.publicLog("testPrivateEvent");
    assert.strictEqual(testAppender.getEventsCount(), 1);
    service.dispose();
    assert.strictEqual(!testAppender.isDisposed, true);
  }));
  test("Simple event", sinonTestFn(function() {
    const testAppender = new TestTelemetryAppender();
    const service = new TelemetryService({ appenders: [testAppender] }, new TestConfigurationService(), TestProductService);
    service.publicLog("testEvent");
    assert.strictEqual(testAppender.getEventsCount(), 1);
    assert.strictEqual(testAppender.events[0].eventName, "testEvent");
    assert.notStrictEqual(testAppender.events[0].data, null);
    service.dispose();
  }));
  test("Event with data", sinonTestFn(function() {
    const testAppender = new TestTelemetryAppender();
    const service = new TelemetryService({ appenders: [testAppender] }, new TestConfigurationService(), TestProductService);
    service.publicLog("testEvent", {
      "stringProp": "property",
      "numberProp": 1,
      "booleanProp": true,
      "complexProp": {
        "value": 0
      }
    });
    assert.strictEqual(testAppender.getEventsCount(), 1);
    assert.strictEqual(testAppender.events[0].eventName, "testEvent");
    assert.notStrictEqual(testAppender.events[0].data, null);
    assert.strictEqual(testAppender.events[0].data["stringProp"], "property");
    assert.strictEqual(testAppender.events[0].data["numberProp"], 1);
    assert.strictEqual(testAppender.events[0].data["booleanProp"], true);
    assert.strictEqual(testAppender.events[0].data["complexProp"].value, 0);
    service.dispose();
  }));
  test("common properties added to *all* events, simple event", function() {
    const testAppender = new TestTelemetryAppender();
    const service = new TelemetryService({
      appenders: [testAppender],
      commonProperties: { foo: "JA!", get bar() {
        return Math.random() % 2 === 0;
      } }
    }, new TestConfigurationService(), TestProductService);
    service.publicLog("testEvent");
    const [first] = testAppender.events;
    assert.strictEqual(Object.keys(first.data).length, 2);
    assert.strictEqual(typeof first.data["foo"], "string");
    assert.strictEqual(typeof first.data["bar"], "boolean");
    service.dispose();
  });
  test("common properties added to *all* events, event with data", function() {
    const testAppender = new TestTelemetryAppender();
    const service = new TelemetryService({
      appenders: [testAppender],
      commonProperties: { foo: "JA!", get bar() {
        return Math.random() % 2 === 0;
      } }
    }, new TestConfigurationService(), TestProductService);
    service.publicLog("testEvent", { hightower: "xl", price: 8e3 });
    const [first] = testAppender.events;
    assert.strictEqual(Object.keys(first.data).length, 4);
    assert.strictEqual(typeof first.data["foo"], "string");
    assert.strictEqual(typeof first.data["bar"], "boolean");
    assert.strictEqual(typeof first.data["hightower"], "string");
    assert.strictEqual(typeof first.data["price"], "number");
    service.dispose();
  });
  test("TelemetryInfo comes from properties", function() {
    const service = new TelemetryService({
      appenders: [NullAppender],
      commonProperties: {
        sessionID: "one",
        ["common.machineId"]: "three"
      }
    }, new TestConfigurationService(), TestProductService);
    assert.strictEqual(service.sessionId, "one");
    assert.strictEqual(service.machineId, "three");
    service.dispose();
  });
  test("telemetry on by default", function() {
    const testAppender = new TestTelemetryAppender();
    const service = new TelemetryService({ appenders: [testAppender] }, new TestConfigurationService(), TestProductService);
    service.publicLog("testEvent");
    assert.strictEqual(testAppender.getEventsCount(), 1);
    assert.strictEqual(testAppender.events[0].eventName, "testEvent");
    service.dispose();
  });
  class TestErrorTelemetryService extends TelemetryService {
    constructor(config) {
      super({ ...config, sendErrorTelemetry: true }, new TestConfigurationService(), TestProductService);
    }
  }
  test("Error events", sinonTestFn(function() {
    const origErrorHandler = Errors.errorHandler.getUnexpectedErrorHandler();
    Errors.setUnexpectedErrorHandler(() => {
    });
    try {
      const testAppender = new TestTelemetryAppender();
      const service = new TestErrorTelemetryService({ appenders: [testAppender] });
      const errorTelemetry = new ErrorTelemetry(service);
      const e = new Error("This is a test.");
      if (!e.stack) {
        e.stack = "blah";
      }
      Errors.onUnexpectedError(e);
      this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
      assert.strictEqual(testAppender.getEventsCount(), 1);
      assert.strictEqual(testAppender.events[0].eventName, "UnhandledError");
      assert.strictEqual(testAppender.events[0].data.msg, "This is a test.");
      errorTelemetry.dispose();
      service.dispose();
    } finally {
      Errors.setUnexpectedErrorHandler(origErrorHandler);
    }
  }));
  test("Handle global errors", sinonTestFn(function() {
    const errorStub = sinon.stub();
    mainWindow.onerror = errorStub;
    const testAppender = new TestTelemetryAppender();
    const service = new TestErrorTelemetryService({ appenders: [testAppender] });
    const errorTelemetry = new ErrorTelemetry(service);
    const testError = new Error("test");
    mainWindow.onerror("Error Message", "file.js", 2, 42, testError);
    this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
    assert.strictEqual(errorStub.alwaysCalledWithExactly("Error Message", "file.js", 2, 42, testError), true);
    assert.strictEqual(errorStub.callCount, 1);
    assert.strictEqual(testAppender.getEventsCount(), 1);
    assert.strictEqual(testAppender.events[0].eventName, "UnhandledError");
    assert.strictEqual(testAppender.events[0].data.msg, "Error Message");
    assert.strictEqual(testAppender.events[0].data.file, "file.js");
    assert.strictEqual(testAppender.events[0].data.line, 2);
    assert.strictEqual(testAppender.events[0].data.column, 42);
    assert.strictEqual(testAppender.events[0].data.uncaught_error_msg, "test");
    errorTelemetry.dispose();
    service.dispose();
    sinon.restore();
  }));
  test("Error Telemetry removes PII from filename with spaces", sinonTestFn(function() {
    const errorStub = sinon.stub();
    mainWindow.onerror = errorStub;
    const settings = new ErrorTestingSettings();
    const testAppender = new TestTelemetryAppender();
    const service = new TestErrorTelemetryService({ appenders: [testAppender] });
    const errorTelemetry = new ErrorTelemetry(service);
    const personInfoWithSpaces = settings.personalInfo.slice(0, 2) + " " + settings.personalInfo.slice(2);
    const dangerousFilenameError = new Error("dangerousFilename");
    dangerousFilenameError.stack = settings.stack;
    mainWindow.onerror("dangerousFilename", settings.dangerousPathWithImportantInfo.replace(settings.personalInfo, personInfoWithSpaces) + "/test.js", 2, 42, dangerousFilenameError);
    this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
    assert.strictEqual(errorStub.callCount, 1);
    assert.strictEqual(testAppender.events[0].data.file.indexOf(settings.dangerousPathWithImportantInfo.replace(settings.personalInfo, personInfoWithSpaces)), -1);
    assert.strictEqual(testAppender.events[0].data.file, settings.importantInfo + "/test.js");
    errorTelemetry.dispose();
    service.dispose();
    sinon.restore();
  }));
  test("Uncaught Error Telemetry removes PII from filename", sinonTestFn(function() {
    const clock = this.clock;
    const errorStub = sinon.stub();
    mainWindow.onerror = errorStub;
    const settings = new ErrorTestingSettings();
    const testAppender = new TestTelemetryAppender();
    const service = new TestErrorTelemetryService({ appenders: [testAppender] });
    const errorTelemetry = new ErrorTelemetry(service);
    let dangerousFilenameError = new Error("dangerousFilename");
    dangerousFilenameError.stack = settings.stack;
    mainWindow.onerror("dangerousFilename", settings.dangerousPathWithImportantInfo + "/test.js", 2, 42, dangerousFilenameError);
    clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
    assert.strictEqual(errorStub.callCount, 1);
    assert.strictEqual(testAppender.events[0].data.file.indexOf(settings.dangerousPathWithImportantInfo), -1);
    dangerousFilenameError = new Error("dangerousFilename");
    dangerousFilenameError.stack = settings.stack;
    mainWindow.onerror("dangerousFilename", settings.dangerousPathWithImportantInfo + "/test.js", 2, 42, dangerousFilenameError);
    clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
    assert.strictEqual(errorStub.callCount, 2);
    assert.strictEqual(testAppender.events[0].data.file.indexOf(settings.dangerousPathWithImportantInfo), -1);
    assert.strictEqual(testAppender.events[0].data.file, settings.importantInfo + "/test.js");
    errorTelemetry.dispose();
    service.dispose();
    sinon.restore();
  }));
  test("Unexpected Error Telemetry removes PII", sinonTestFn(function() {
    const origErrorHandler = Errors.errorHandler.getUnexpectedErrorHandler();
    Errors.setUnexpectedErrorHandler(() => {
    });
    try {
      const settings = new ErrorTestingSettings();
      const testAppender = new TestTelemetryAppender();
      const service = new TestErrorTelemetryService({ appenders: [testAppender] });
      const errorTelemetry = new ErrorTelemetry(service);
      const dangerousPathWithoutImportantInfoError = new Error(settings.dangerousPathWithoutImportantInfo);
      dangerousPathWithoutImportantInfoError.stack = settings.stack;
      Errors.onUnexpectedError(dangerousPathWithoutImportantInfoError);
      this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
      errorTelemetry.dispose();
      service.dispose();
    } finally {
      Errors.setUnexpectedErrorHandler(origErrorHandler);
    }
  }));
  test("Uncaught Error Telemetry removes PII", sinonTestFn(function() {
    const errorStub = sinon.stub();
    mainWindow.onerror = errorStub;
    const settings = new ErrorTestingSettings();
    const testAppender = new TestTelemetryAppender();
    const service = new TestErrorTelemetryService({ appenders: [testAppender] });
    const errorTelemetry = new ErrorTelemetry(service);
    const dangerousPathWithoutImportantInfoError = new Error("dangerousPathWithoutImportantInfo");
    dangerousPathWithoutImportantInfoError.stack = settings.stack;
    mainWindow.onerror(settings.dangerousPathWithoutImportantInfo, "test.js", 2, 42, dangerousPathWithoutImportantInfoError);
    this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
    assert.strictEqual(errorStub.callCount, 1);
    assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
    assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
    errorTelemetry.dispose();
    service.dispose();
    sinon.restore();
  }));
  test("Unexpected Error Telemetry removes PII but preserves Code file path", sinonTestFn(function() {
    const origErrorHandler = Errors.errorHandler.getUnexpectedErrorHandler();
    Errors.setUnexpectedErrorHandler(() => {
    });
    try {
      const settings = new ErrorTestingSettings();
      const testAppender = new TestTelemetryAppender();
      const service = new TestErrorTelemetryService({ appenders: [testAppender] });
      const errorTelemetry = new ErrorTelemetry(service);
      const dangerousPathWithImportantInfoError = new Error(settings.dangerousPathWithImportantInfo);
      dangerousPathWithImportantInfoError.stack = settings.stack;
      Errors.onUnexpectedError(dangerousPathWithImportantInfoError);
      this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
      assert.notStrictEqual(testAppender.events[0].data.msg.indexOf(settings.importantInfo), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.importantInfo), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
      errorTelemetry.dispose();
      service.dispose();
    } finally {
      Errors.setUnexpectedErrorHandler(origErrorHandler);
    }
  }));
  test("Uncaught Error Telemetry removes PII but preserves Code file path", sinonTestFn(function() {
    const errorStub = sinon.stub();
    mainWindow.onerror = errorStub;
    const settings = new ErrorTestingSettings();
    const testAppender = new TestTelemetryAppender();
    const service = new TestErrorTelemetryService({ appenders: [testAppender] });
    const errorTelemetry = new ErrorTelemetry(service);
    const dangerousPathWithImportantInfoError = new Error("dangerousPathWithImportantInfo");
    dangerousPathWithImportantInfoError.stack = settings.stack;
    mainWindow.onerror(settings.dangerousPathWithImportantInfo, "test.js", 2, 42, dangerousPathWithImportantInfoError);
    this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
    assert.strictEqual(errorStub.callCount, 1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf("(" + settings.nodeModuleAsarPathToRetain), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf("(" + settings.nodeModulePathToRetain), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf("(/" + settings.nodeModuleAsarPathToRetain), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf("(/" + settings.nodeModulePathToRetain), -1);
    assert.notStrictEqual(testAppender.events[0].data.msg.indexOf(settings.importantInfo), -1);
    assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
    assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.importantInfo), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
    errorTelemetry.dispose();
    service.dispose();
    sinon.restore();
  }));
  test("Unexpected Error Telemetry removes PII but preserves Code file path with node modules", sinonTestFn(function() {
    const origErrorHandler = Errors.errorHandler.getUnexpectedErrorHandler();
    Errors.setUnexpectedErrorHandler(() => {
    });
    try {
      const settings = new ErrorTestingSettings();
      const testAppender = new TestTelemetryAppender();
      const service = new TestErrorTelemetryService({ appenders: [testAppender] });
      const errorTelemetry = new ErrorTelemetry(service);
      const dangerousPathWithImportantInfoError = new Error(settings.dangerousPathWithImportantInfo);
      dangerousPathWithImportantInfoError.stack = settings.stack;
      Errors.onUnexpectedError(dangerousPathWithImportantInfoError);
      this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf("(" + settings.nodeModuleAsarPathToRetain), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf("(" + settings.nodeModulePathToRetain), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf("(/" + settings.nodeModuleAsarPathToRetain), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf("(/" + settings.nodeModulePathToRetain), -1);
      errorTelemetry.dispose();
      service.dispose();
    } finally {
      Errors.setUnexpectedErrorHandler(origErrorHandler);
    }
  }));
  test("Unexpected Error Telemetry removes PII but preserves Code file path when PIIPath is configured", sinonTestFn(function() {
    const origErrorHandler = Errors.errorHandler.getUnexpectedErrorHandler();
    Errors.setUnexpectedErrorHandler(() => {
    });
    try {
      const settings = new ErrorTestingSettings();
      const testAppender = new TestTelemetryAppender();
      const service = new TestErrorTelemetryService({ appenders: [testAppender], piiPaths: [settings.personalInfo + "/resources/app/"] });
      const errorTelemetry = new ErrorTelemetry(service);
      const dangerousPathWithImportantInfoError = new Error(settings.dangerousPathWithImportantInfo);
      dangerousPathWithImportantInfoError.stack = settings.stack;
      Errors.onUnexpectedError(dangerousPathWithImportantInfoError);
      this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
      assert.notStrictEqual(testAppender.events[0].data.msg.indexOf(settings.importantInfo), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.importantInfo), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
      errorTelemetry.dispose();
      service.dispose();
    } finally {
      Errors.setUnexpectedErrorHandler(origErrorHandler);
    }
  }));
  test("Uncaught Error Telemetry removes PII but preserves Code file path when PIIPath is configured", sinonTestFn(function() {
    const errorStub = sinon.stub();
    mainWindow.onerror = errorStub;
    const settings = new ErrorTestingSettings();
    const testAppender = new TestTelemetryAppender();
    const service = new TestErrorTelemetryService({ appenders: [testAppender], piiPaths: [settings.personalInfo + "/resources/app/"] });
    const errorTelemetry = new ErrorTelemetry(service);
    const dangerousPathWithImportantInfoError = new Error("dangerousPathWithImportantInfo");
    dangerousPathWithImportantInfoError.stack = settings.stack;
    mainWindow.onerror(settings.dangerousPathWithImportantInfo, "test.js", 2, 42, dangerousPathWithImportantInfoError);
    this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
    assert.strictEqual(errorStub.callCount, 1);
    assert.notStrictEqual(testAppender.events[0].data.msg.indexOf(settings.importantInfo), -1);
    assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
    assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.importantInfo), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
    errorTelemetry.dispose();
    service.dispose();
    sinon.restore();
  }));
  test("Unexpected Error Telemetry removes PII but preserves Missing Model error message", sinonTestFn(function() {
    const origErrorHandler = Errors.errorHandler.getUnexpectedErrorHandler();
    Errors.setUnexpectedErrorHandler(() => {
    });
    try {
      const settings = new ErrorTestingSettings();
      const testAppender = new TestTelemetryAppender();
      const service = new TestErrorTelemetryService({ appenders: [testAppender] });
      const errorTelemetry = new ErrorTelemetry(service);
      const missingModelError = new Error(settings.missingModelMessage);
      missingModelError.stack = settings.stack;
      Errors.onUnexpectedError(missingModelError);
      this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
      assert.notStrictEqual(testAppender.events[0].data.msg.indexOf(settings.missingModelPrefix), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.missingModelPrefix), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
      errorTelemetry.dispose();
      service.dispose();
    } finally {
      Errors.setUnexpectedErrorHandler(origErrorHandler);
    }
  }));
  test("Uncaught Error Telemetry removes PII but preserves Missing Model error message", sinonTestFn(function() {
    const errorStub = sinon.stub();
    mainWindow.onerror = errorStub;
    const settings = new ErrorTestingSettings();
    const testAppender = new TestTelemetryAppender();
    const service = new TestErrorTelemetryService({ appenders: [testAppender] });
    const errorTelemetry = new ErrorTelemetry(service);
    const missingModelError = new Error("missingModelMessage");
    missingModelError.stack = settings.stack;
    mainWindow.onerror(settings.missingModelMessage, "test.js", 2, 42, missingModelError);
    this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
    assert.strictEqual(errorStub.callCount, 1);
    assert.notStrictEqual(testAppender.events[0].data.msg.indexOf(settings.missingModelPrefix), -1);
    assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
    assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.missingModelPrefix), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
    assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
    assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
    errorTelemetry.dispose();
    service.dispose();
    sinon.restore();
  }));
  test("Unexpected Error Telemetry removes PII but preserves No Such File error message", sinonTestFn(function() {
    const origErrorHandler = Errors.errorHandler.getUnexpectedErrorHandler();
    Errors.setUnexpectedErrorHandler(() => {
    });
    try {
      const settings = new ErrorTestingSettings();
      const testAppender = new TestTelemetryAppender();
      const service = new TestErrorTelemetryService({ appenders: [testAppender] });
      const errorTelemetry = new ErrorTelemetry(service);
      const noSuchFileError = new Error(settings.noSuchFileMessage);
      noSuchFileError.stack = settings.stack;
      Errors.onUnexpectedError(noSuchFileError);
      this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
      assert.notStrictEqual(testAppender.events[0].data.msg.indexOf(settings.noSuchFilePrefix), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.noSuchFilePrefix), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
      errorTelemetry.dispose();
      service.dispose();
    } finally {
      Errors.setUnexpectedErrorHandler(origErrorHandler);
    }
  }));
  test("Uncaught Error Telemetry removes PII but preserves No Such File error message", sinonTestFn(function() {
    const origErrorHandler = Errors.errorHandler.getUnexpectedErrorHandler();
    Errors.setUnexpectedErrorHandler(() => {
    });
    try {
      const errorStub = sinon.stub();
      mainWindow.onerror = errorStub;
      const settings = new ErrorTestingSettings();
      const testAppender = new TestTelemetryAppender();
      const service = new TestErrorTelemetryService({ appenders: [testAppender] });
      const errorTelemetry = new ErrorTelemetry(service);
      const noSuchFileError = new Error("noSuchFileMessage");
      noSuchFileError.stack = settings.stack;
      mainWindow.onerror(settings.noSuchFileMessage, "test.js", 2, 42, noSuchFileError);
      this.clock.tick(ErrorTelemetry.ERROR_FLUSH_TIMEOUT);
      assert.strictEqual(errorStub.callCount, 1);
      Errors.onUnexpectedError(noSuchFileError);
      assert.notStrictEqual(testAppender.events[0].data.msg.indexOf(settings.noSuchFilePrefix), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.msg.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.noSuchFilePrefix), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.personalInfo), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.indexOf(settings.filePrefix), -1);
      assert.notStrictEqual(testAppender.events[0].data.callstack.indexOf(settings.stack[4].replace(settings.randomUserFile, settings.anonymizedRandomUserFile)), -1);
      assert.strictEqual(testAppender.events[0].data.callstack.split("\n").length, settings.stack.length);
      errorTelemetry.dispose();
      service.dispose();
      sinon.restore();
    } finally {
      Errors.setUnexpectedErrorHandler(origErrorHandler);
    }
  }));
  test("Telemetry Service sends events when telemetry is on", sinonTestFn(function() {
    const testAppender = new TestTelemetryAppender();
    const service = new TelemetryService({ appenders: [testAppender] }, new TestConfigurationService(), TestProductService);
    service.publicLog("testEvent");
    assert.strictEqual(testAppender.getEventsCount(), 1);
    service.dispose();
  }));
  test("Telemetry Service checks with config service", function() {
    let telemetryLevel = TelemetryConfiguration.OFF;
    const emitter = new Emitter();
    const testAppender = new TestTelemetryAppender();
    const service = new TelemetryService({
      appenders: [testAppender]
    }, new class extends TestConfigurationService {
      constructor() {
        super(...arguments);
        this.onDidChangeConfiguration = emitter.event;
      }
      getValue() {
        return telemetryLevel;
      }
    }(), TestProductService);
    assert.strictEqual(service.telemetryLevel, TelemetryLevel.NONE);
    telemetryLevel = TelemetryConfiguration.ON;
    emitter.fire({ affectsConfiguration: () => true });
    assert.strictEqual(service.telemetryLevel, TelemetryLevel.USAGE);
    telemetryLevel = TelemetryConfiguration.ERROR;
    emitter.fire({ affectsConfiguration: () => true });
    assert.strictEqual(service.telemetryLevel, TelemetryLevel.ERROR);
    service.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS90ZWxlbWV0cnkvdGVzdC9icm93c2VyL3RlbGVtZXRyeVNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgc2lub25UZXN0IGZyb20gJ3Npbm9uLXRlc3QnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0ICogYXMgRXJyb3JzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCBFcnJvclRlbGVtZXRyeSBmcm9tICcuLi8uLi9icm93c2VyL2Vycm9yVGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IFRlbGVtZXRyeUNvbmZpZ3VyYXRpb24sIFRlbGVtZXRyeUxldmVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZUNvbmZpZywgVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZWxlbWV0cnlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlBcHBlbmRlciwgTnVsbEFwcGVuZGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcblxuY29uc3Qgc2lub25UZXN0Rm4gPSBzaW5vblRlc3Qoc2lub24pO1xuXG5jbGFzcyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIgaW1wbGVtZW50cyBJVGVsZW1ldHJ5QXBwZW5kZXIge1xuXG5cdHB1YmxpYyBldmVudHM6IGFueVtdO1xuXHRwdWJsaWMgaXNEaXNwb3NlZDogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLmV2ZW50cyA9IFtdO1xuXHRcdHRoaXMuaXNEaXNwb3NlZCA9IGZhbHNlO1xuXHR9XG5cblx0cHVibGljIGxvZyhldmVudE5hbWU6IHN0cmluZywgZGF0YT86IGFueSk6IHZvaWQge1xuXHRcdHRoaXMuZXZlbnRzLnB1c2goeyBldmVudE5hbWUsIGRhdGEgfSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RXZlbnRzQ291bnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRzLmxlbmd0aDtcblx0fVxuXG5cdHB1YmxpYyBmbHVzaCgpOiBQcm9taXNlPGFueT4ge1xuXHRcdHRoaXMuaXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0fVxufVxuXG5jbGFzcyBFcnJvclRlc3RpbmdTZXR0aW5ncyB7XG5cdHB1YmxpYyBwZXJzb25hbEluZm86IHN0cmluZztcblx0cHVibGljIGltcG9ydGFudEluZm86IHN0cmluZztcblx0cHVibGljIGZpbGVQcmVmaXg6IHN0cmluZztcblx0cHVibGljIGRhbmdlcm91c1BhdGhXaXRob3V0SW1wb3J0YW50SW5mbzogc3RyaW5nO1xuXHRwdWJsaWMgZGFuZ2Vyb3VzUGF0aFdpdGhJbXBvcnRhbnRJbmZvOiBzdHJpbmc7XG5cdHB1YmxpYyBtaXNzaW5nTW9kZWxQcmVmaXg6IHN0cmluZztcblx0cHVibGljIG1pc3NpbmdNb2RlbE1lc3NhZ2U6IHN0cmluZztcblx0cHVibGljIG5vU3VjaEZpbGVQcmVmaXg6IHN0cmluZztcblx0cHVibGljIG5vU3VjaEZpbGVNZXNzYWdlOiBzdHJpbmc7XG5cdHB1YmxpYyBzdGFjazogc3RyaW5nW107XG5cdHB1YmxpYyByYW5kb21Vc2VyRmlsZTogc3RyaW5nID0gJ2EvcGF0aC90aGF0L2RvZV9zbnQvY29uLXRhaW4vY29kZS9uYW1lcy5qcyc7XG5cdHB1YmxpYyBhbm9ueW1pemVkUmFuZG9tVXNlckZpbGU6IHN0cmluZyA9ICc8UkVEQUNURUQ6IHVzZXItZmlsZS1wYXRoPic7XG5cdHB1YmxpYyBub2RlTW9kdWxlUGF0aFRvUmV0YWluOiBzdHJpbmcgPSAnbm9kZV9tb2R1bGVzL3BhdGgvdGhhdC9zaG91bGRiZS9yZXRhaW5lZC9uYW1lcy5qczoxNDoxNTg1NCc7XG5cdHB1YmxpYyBub2RlTW9kdWxlQXNhclBhdGhUb1JldGFpbjogc3RyaW5nID0gJ25vZGVfbW9kdWxlcy5hc2FyL3BhdGgvdGhhdC9zaG91bGRiZS9yZXRhaW5lZC9uYW1lcy5qczoxNDoxMjM1NCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5wZXJzb25hbEluZm8gPSAnREFOR0VST1VTL1BBVEgnO1xuXHRcdHRoaXMuaW1wb3J0YW50SW5mbyA9ICdpbXBvcnRhbnQvaW5mb3JtYXRpb24nO1xuXHRcdHRoaXMuZmlsZVByZWZpeCA9ICdmaWxlOi8vLyc7XG5cdFx0dGhpcy5kYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm8gPSB0aGlzLmZpbGVQcmVmaXggKyB0aGlzLnBlcnNvbmFsSW5mbyArICcvcmVzb3VyY2VzL2FwcC8nICsgdGhpcy5pbXBvcnRhbnRJbmZvO1xuXHRcdHRoaXMuZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvID0gdGhpcy5maWxlUHJlZml4ICsgdGhpcy5wZXJzb25hbEluZm87XG5cblx0XHR0aGlzLm1pc3NpbmdNb2RlbFByZWZpeCA9ICdSZWNlaXZlZCBtb2RlbCBldmVudHMgZm9yIG1pc3NpbmcgbW9kZWwgJztcblx0XHR0aGlzLm1pc3NpbmdNb2RlbE1lc3NhZ2UgPSB0aGlzLm1pc3NpbmdNb2RlbFByZWZpeCArICcgJyArIHRoaXMuZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvO1xuXG5cdFx0dGhpcy5ub1N1Y2hGaWxlUHJlZml4ID0gJ0VOT0VOVDogbm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeSc7XG5cdFx0dGhpcy5ub1N1Y2hGaWxlTWVzc2FnZSA9IHRoaXMubm9TdWNoRmlsZVByZWZpeCArICcgXFwnJyArIHRoaXMucGVyc29uYWxJbmZvICsgJ1xcJyc7XG5cblx0XHR0aGlzLnN0YWNrID0gW2BhdCBlLl9tb2RlbEV2ZW50cyAoJHt0aGlzLnJhbmRvbVVzZXJGaWxlfToxMTo3MzA5KWAsXG5cdFx0YCAgICBhdCB0LkFsbFdvcmtlcnMgKCR7dGhpcy5yYW5kb21Vc2VyRmlsZX06Njo4ODQ0KWAsXG5cdFx0YCAgICBhdCBlLihhbm9ueW1vdXMgZnVuY3Rpb24pIFthcyBfbW9kZWxFdmVudHNdICgke3RoaXMucmFuZG9tVXNlckZpbGV9OjU6Mjk1NTIpYCxcblx0XHRgICAgIGF0IEZ1bmN0aW9uLjxhbm9ueW1vdXM+ICgke3RoaXMucmFuZG9tVXNlckZpbGV9OjY6ODI3MilgLFxuXHRcdGAgICAgYXQgZS5kaXNwYXRjaCAoJHt0aGlzLnJhbmRvbVVzZXJGaWxlfTo1OjI2OTMxKWAsXG5cdFx0YCAgICBhdCBlLnJlcXVlc3QgKC8ke3RoaXMubm9kZU1vZHVsZUFzYXJQYXRoVG9SZXRhaW59KWAsXG5cdFx0YCAgICBhdCB0Ll9oYW5kbGVNZXNzYWdlICgke3RoaXMubm9kZU1vZHVsZUFzYXJQYXRoVG9SZXRhaW59KWAsXG5cdFx0YCAgICBhdCB0Ll9vbm1lc3NhZ2UgKC8ke3RoaXMubm9kZU1vZHVsZVBhdGhUb1JldGFpbn0pYCxcblx0XHRgICAgIGF0IHQub25tZXNzYWdlICgke3RoaXMubm9kZU1vZHVsZVBhdGhUb1JldGFpbn0pYCxcblx0XHRcdGAgICAgYXQgRGVkaWNhdGVkV29ya2VyR2xvYmFsU2NvcGUuc2VsZi5vbm1lc3NhZ2VgLFxuXHRcdHRoaXMuZGFuZ2Vyb3VzUGF0aFdpdGhJbXBvcnRhbnRJbmZvLFxuXHRcdHRoaXMuZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvLFxuXHRcdHRoaXMubWlzc2luZ01vZGVsTWVzc2FnZSxcblx0XHR0aGlzLm5vU3VjaEZpbGVNZXNzYWdlXTtcblx0fVxufVxuXG5zdWl0ZSgnVGVsZW1ldHJ5U2VydmljZScsICgpID0+IHtcblxuXHRjb25zdCBUZXN0UHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSA9IHsgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLCAuLi5wcm9kdWN0IH07XG5cblx0dGVzdCgnRGlzcG9zaW5nJywgc2lub25UZXN0Rm4oZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlbGVtZXRyeVNlcnZpY2UoeyBhcHBlbmRlcnM6IFt0ZXN0QXBwZW5kZXJdIH0sIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSwgVGVzdFByb2R1Y3RTZXJ2aWNlKTtcblxuXHRcdHNlcnZpY2UucHVibGljTG9nKCd0ZXN0UHJpdmF0ZUV2ZW50Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5nZXRFdmVudHNDb3VudCgpLCAxKTtcblxuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCghdGVzdEFwcGVuZGVyLmlzRGlzcG9zZWQsIHRydWUpO1xuXHR9KSk7XG5cblx0Ly8gZXZlbnQgcmVwb3J0aW5nXG5cdHRlc3QoJ1NpbXBsZSBldmVudCcsIHNpbm9uVGVzdEZuKGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0QXBwZW5kZXIgPSBuZXcgVGVzdFRlbGVtZXRyeUFwcGVuZGVyKCk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZWxlbWV0cnlTZXJ2aWNlKHsgYXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSB9LCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCksIFRlc3RQcm9kdWN0U2VydmljZSk7XG5cblx0XHRzZXJ2aWNlLnB1YmxpY0xvZygndGVzdEV2ZW50Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5nZXRFdmVudHNDb3VudCgpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5ldmVudE5hbWUsICd0ZXN0RXZlbnQnKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLCBudWxsKTtcblxuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KSk7XG5cblx0dGVzdCgnRXZlbnQgd2l0aCBkYXRhJywgc2lub25UZXN0Rm4oZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlbGVtZXRyeVNlcnZpY2UoeyBhcHBlbmRlcnM6IFt0ZXN0QXBwZW5kZXJdIH0sIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSwgVGVzdFByb2R1Y3RTZXJ2aWNlKTtcblxuXHRcdHNlcnZpY2UucHVibGljTG9nKCd0ZXN0RXZlbnQnLCB7XG5cdFx0XHQnc3RyaW5nUHJvcCc6ICdwcm9wZXJ0eScsXG5cdFx0XHQnbnVtYmVyUHJvcCc6IDEsXG5cdFx0XHQnYm9vbGVhblByb3AnOiB0cnVlLFxuXHRcdFx0J2NvbXBsZXhQcm9wJzoge1xuXHRcdFx0XHQndmFsdWUnOiAwXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmdldEV2ZW50c0NvdW50KCksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmV2ZW50TmFtZSwgJ3Rlc3RFdmVudCcpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGFbJ3N0cmluZ1Byb3AnXSwgJ3Byb3BlcnR5Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YVsnbnVtYmVyUHJvcCddLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhWydib29sZWFuUHJvcCddLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhWydjb21wbGV4UHJvcCddLnZhbHVlLCAwKTtcblxuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KSk7XG5cblx0dGVzdCgnY29tbW9uIHByb3BlcnRpZXMgYWRkZWQgdG8gKmFsbCogZXZlbnRzLCBzaW1wbGUgZXZlbnQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVsZW1ldHJ5U2VydmljZSh7XG5cdFx0XHRhcHBlbmRlcnM6IFt0ZXN0QXBwZW5kZXJdLFxuXHRcdFx0Y29tbW9uUHJvcGVydGllczogeyBmb286ICdKQSEnLCBnZXQgYmFyKCkgeyByZXR1cm4gTWF0aC5yYW5kb20oKSAlIDIgPT09IDA7IH0gfVxuXHRcdH0sIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSwgVGVzdFByb2R1Y3RTZXJ2aWNlKTtcblxuXHRcdHNlcnZpY2UucHVibGljTG9nKCd0ZXN0RXZlbnQnKTtcblx0XHRjb25zdCBbZmlyc3RdID0gdGVzdEFwcGVuZGVyLmV2ZW50cztcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChPYmplY3Qua2V5cyhmaXJzdC5kYXRhKS5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgZmlyc3QuZGF0YVsnZm9vJ10sICdzdHJpbmcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIGZpcnN0LmRhdGFbJ2JhciddLCAnYm9vbGVhbicpO1xuXG5cdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbW1vbiBwcm9wZXJ0aWVzIGFkZGVkIHRvICphbGwqIGV2ZW50cywgZXZlbnQgd2l0aCBkYXRhJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlbGVtZXRyeVNlcnZpY2Uoe1xuXHRcdFx0YXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSxcblx0XHRcdGNvbW1vblByb3BlcnRpZXM6IHsgZm9vOiAnSkEhJywgZ2V0IGJhcigpIHsgcmV0dXJuIE1hdGgucmFuZG9tKCkgJSAyID09PSAwOyB9IH1cblx0XHR9LCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCksIFRlc3RQcm9kdWN0U2VydmljZSk7XG5cblx0XHRzZXJ2aWNlLnB1YmxpY0xvZygndGVzdEV2ZW50JywgeyBoaWdodG93ZXI6ICd4bCcsIHByaWNlOiA4MDAwIH0pO1xuXHRcdGNvbnN0IFtmaXJzdF0gPSB0ZXN0QXBwZW5kZXIuZXZlbnRzO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKE9iamVjdC5rZXlzKGZpcnN0LmRhdGEpLmxlbmd0aCwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBmaXJzdC5kYXRhWydmb28nXSwgJ3N0cmluZycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgZmlyc3QuZGF0YVsnYmFyJ10sICdib29sZWFuJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBmaXJzdC5kYXRhWydoaWdodG93ZXInXSwgJ3N0cmluZycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgZmlyc3QuZGF0YVsncHJpY2UnXSwgJ251bWJlcicpO1xuXG5cdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RlbGVtZXRyeUluZm8gY29tZXMgZnJvbSBwcm9wZXJ0aWVzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVsZW1ldHJ5U2VydmljZSh7XG5cdFx0XHRhcHBlbmRlcnM6IFtOdWxsQXBwZW5kZXJdLFxuXHRcdFx0Y29tbW9uUHJvcGVydGllczoge1xuXHRcdFx0XHRzZXNzaW9uSUQ6ICdvbmUnLFxuXHRcdFx0XHRbJ2NvbW1vbi5tYWNoaW5lSWQnXTogJ3RocmVlJyxcblx0XHRcdH1cblx0XHR9LCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCksIFRlc3RQcm9kdWN0U2VydmljZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5zZXNzaW9uSWQsICdvbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5tYWNoaW5lSWQsICd0aHJlZScpO1xuXG5cdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RlbGVtZXRyeSBvbiBieSBkZWZhdWx0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlbGVtZXRyeVNlcnZpY2UoeyBhcHBlbmRlcnM6IFt0ZXN0QXBwZW5kZXJdIH0sIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSwgVGVzdFByb2R1Y3RTZXJ2aWNlKTtcblxuXHRcdHNlcnZpY2UucHVibGljTG9nKCd0ZXN0RXZlbnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmdldEV2ZW50c0NvdW50KCksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmV2ZW50TmFtZSwgJ3Rlc3RFdmVudCcpO1xuXG5cdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGNsYXNzIFRlc3RFcnJvclRlbGVtZXRyeVNlcnZpY2UgZXh0ZW5kcyBUZWxlbWV0cnlTZXJ2aWNlIHtcblx0XHRjb25zdHJ1Y3Rvcihjb25maWc6IElUZWxlbWV0cnlTZXJ2aWNlQ29uZmlnKSB7XG5cdFx0XHRzdXBlcih7IC4uLmNvbmZpZywgc2VuZEVycm9yVGVsZW1ldHJ5OiB0cnVlIH0sIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UsIFRlc3RQcm9kdWN0U2VydmljZSk7XG5cdFx0fVxuXHR9XG5cblx0dGVzdCgnRXJyb3IgZXZlbnRzJywgc2lub25UZXN0Rm4oZnVuY3Rpb24gKHRoaXM6IGFueSkge1xuXG5cdFx0Y29uc3Qgb3JpZ0Vycm9ySGFuZGxlciA9IEVycm9ycy5lcnJvckhhbmRsZXIuZ2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigpO1xuXHRcdEVycm9ycy5zZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCgpID0+IHsgfSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHRcdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZXN0RXJyb3JUZWxlbWV0cnlTZXJ2aWNlKHsgYXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSB9KTtcblx0XHRcdGNvbnN0IGVycm9yVGVsZW1ldHJ5ID0gbmV3IEVycm9yVGVsZW1ldHJ5KHNlcnZpY2UpO1xuXG5cblx0XHRcdGNvbnN0IGU6IGFueSA9IG5ldyBFcnJvcignVGhpcyBpcyBhIHRlc3QuJyk7XG5cdFx0XHQvLyBmb3IgUGhhbnRvbVxuXHRcdFx0aWYgKCFlLnN0YWNrKSB7XG5cdFx0XHRcdGUuc3RhY2sgPSAnYmxhaCc7XG5cdFx0XHR9XG5cblx0XHRcdEVycm9ycy5vblVuZXhwZWN0ZWRFcnJvcihlKTtcblx0XHRcdHRoaXMuY2xvY2sudGljayhFcnJvclRlbGVtZXRyeS5FUlJPUl9GTFVTSF9USU1FT1VUKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5nZXRFdmVudHNDb3VudCgpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmV2ZW50TmFtZSwgJ1VuaGFuZGxlZEVycm9yJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZywgJ1RoaXMgaXMgYSB0ZXN0LicpO1xuXG5cdFx0XHRlcnJvclRlbGVtZXRyeS5kaXNwb3NlKCk7XG5cdFx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0RXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIob3JpZ0Vycm9ySGFuZGxlcik7XG5cdFx0fVxuXHR9KSk7XG5cblx0Ly8gXHR0ZXN0KCdVbmhhbmRsZWQgUHJvbWlzZSBFcnJvciBldmVudHMnLCBzaW5vblRlc3RGbihmdW5jdGlvbigpIHtcblx0Ly9cblx0Ly8gXHRcdGxldCBvcmlnRXJyb3JIYW5kbGVyID0gRXJyb3JzLmVycm9ySGFuZGxlci5nZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCk7XG5cdC8vIFx0XHRFcnJvcnMuc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigoKSA9PiB7fSk7XG5cdC8vXG5cdC8vIFx0XHR0cnkge1xuXHQvLyBcdFx0XHRsZXQgc2VydmljZSA9IG5ldyBNYWluVGVsZW1ldHJ5U2VydmljZSgpO1xuXHQvLyBcdFx0XHRsZXQgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHQvLyBcdFx0XHRzZXJ2aWNlLmFkZFRlbGVtZXRyeUFwcGVuZGVyKHRlc3RBcHBlbmRlcik7XG5cdC8vXG5cdC8vIFx0XHRcdHdpbmpzLlByb21pc2Uud3JhcEVycm9yKG5ldyBFcnJvcignVGhpcyBzaG91bGQgbm90IGdldCBsb2dnZWQnKSk7XG5cdC8vIFx0XHRcdHdpbmpzLlRQcm9taXNlLmFzKHRydWUpLnRoZW4oKCkgPT4ge1xuXHQvLyBcdFx0XHRcdHRocm93IG5ldyBFcnJvcignVGhpcyBzaG91bGQgZ2V0IGxvZ2dlZCcpO1xuXHQvLyBcdFx0XHR9KTtcblx0Ly8gXHRcdFx0Ly8gcHJldmVudCBjb25zb2xlIG91dHB1dCBmcm9tIGZhaWxpbmcgdGhlIHRlc3Rcblx0Ly8gXHRcdFx0dGhpcy5zdHViKGNvbnNvbGUsICdsb2cnKTtcblx0Ly8gXHRcdFx0Ly8gYWxsb3cgZm9yIHRoZSBwcm9taXNlIHRvIGZpbmlzaFxuXHQvLyBcdFx0XHR0aGlzLmNsb2NrLnRpY2soTWFpbkVycm9yVGVsZW1ldHJ5LkVSUk9SX0ZMVVNIX1RJTUVPVVQpO1xuXHQvL1xuXHQvLyBcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmdldEV2ZW50c0NvdW50KCksIDEpO1xuXHQvLyBcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5ldmVudE5hbWUsICdVbmhhbmRsZWRFcnJvcicpO1xuXHQvLyBcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZywgICdUaGlzIHNob3VsZCBnZXQgbG9nZ2VkJyk7XG5cdC8vXG5cdC8vIFx0XHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHQvLyBcdFx0fSBmaW5hbGx5IHtcblx0Ly8gXHRcdFx0RXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIob3JpZ0Vycm9ySGFuZGxlcik7XG5cdC8vIFx0XHR9XG5cdC8vIFx0fSkpO1xuXG5cdHRlc3QoJ0hhbmRsZSBnbG9iYWwgZXJyb3JzJywgc2lub25UZXN0Rm4oZnVuY3Rpb24gKHRoaXM6IGFueSkge1xuXHRcdGNvbnN0IGVycm9yU3R1YiA9IHNpbm9uLnN0dWIoKTtcblx0XHRtYWluV2luZG93Lm9uZXJyb3IgPSBlcnJvclN0dWI7XG5cblx0XHRjb25zdCB0ZXN0QXBwZW5kZXIgPSBuZXcgVGVzdFRlbGVtZXRyeUFwcGVuZGVyKCk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZXN0RXJyb3JUZWxlbWV0cnlTZXJ2aWNlKHsgYXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSB9KTtcblx0XHRjb25zdCBlcnJvclRlbGVtZXRyeSA9IG5ldyBFcnJvclRlbGVtZXRyeShzZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHRlc3RFcnJvciA9IG5ldyBFcnJvcigndGVzdCcpO1xuXHRcdCg8YW55Pm1haW5XaW5kb3cub25lcnJvcikoJ0Vycm9yIE1lc3NhZ2UnLCAnZmlsZS5qcycsIDIsIDQyLCB0ZXN0RXJyb3IpO1xuXHRcdHRoaXMuY2xvY2sudGljayhFcnJvclRlbGVtZXRyeS5FUlJPUl9GTFVTSF9USU1FT1VUKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvclN0dWIuYWx3YXlzQ2FsbGVkV2l0aEV4YWN0bHkoJ0Vycm9yIE1lc3NhZ2UnLCAnZmlsZS5qcycsIDIsIDQyLCB0ZXN0RXJyb3IpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyb3JTdHViLmNhbGxDb3VudCwgMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmdldEV2ZW50c0NvdW50KCksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmV2ZW50TmFtZSwgJ1VuaGFuZGxlZEVycm9yJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2csICdFcnJvciBNZXNzYWdlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5maWxlLCAnZmlsZS5qcycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubGluZSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jb2x1bW4sIDQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLnVuY2F1Z2h0X2Vycm9yX21zZywgJ3Rlc3QnKTtcblxuXHRcdGVycm9yVGVsZW1ldHJ5LmRpc3Bvc2UoKTtcblx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHRzaW5vbi5yZXN0b3JlKCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdFcnJvciBUZWxlbWV0cnkgcmVtb3ZlcyBQSUkgZnJvbSBmaWxlbmFtZSB3aXRoIHNwYWNlcycsIHNpbm9uVGVzdEZuKGZ1bmN0aW9uICh0aGlzOiBhbnkpIHtcblx0XHRjb25zdCBlcnJvclN0dWIgPSBzaW5vbi5zdHViKCk7XG5cdFx0bWFpbldpbmRvdy5vbmVycm9yID0gZXJyb3JTdHViO1xuXHRcdGNvbnN0IHNldHRpbmdzID0gbmV3IEVycm9yVGVzdGluZ1NldHRpbmdzKCk7XG5cdFx0Y29uc3QgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdEVycm9yVGVsZW1ldHJ5U2VydmljZSh7IGFwcGVuZGVyczogW3Rlc3RBcHBlbmRlcl0gfSk7XG5cdFx0Y29uc3QgZXJyb3JUZWxlbWV0cnkgPSBuZXcgRXJyb3JUZWxlbWV0cnkoc2VydmljZSk7XG5cblx0XHRjb25zdCBwZXJzb25JbmZvV2l0aFNwYWNlcyA9IHNldHRpbmdzLnBlcnNvbmFsSW5mby5zbGljZSgwLCAyKSArICcgJyArIHNldHRpbmdzLnBlcnNvbmFsSW5mby5zbGljZSgyKTtcblx0XHRjb25zdCBkYW5nZXJvdXNGaWxlbmFtZUVycm9yOiBhbnkgPSBuZXcgRXJyb3IoJ2Rhbmdlcm91c0ZpbGVuYW1lJyk7XG5cdFx0ZGFuZ2Vyb3VzRmlsZW5hbWVFcnJvci5zdGFjayA9IHNldHRpbmdzLnN0YWNrO1xuXHRcdCg8YW55Pm1haW5XaW5kb3cub25lcnJvcikoJ2Rhbmdlcm91c0ZpbGVuYW1lJywgc2V0dGluZ3MuZGFuZ2Vyb3VzUGF0aFdpdGhJbXBvcnRhbnRJbmZvLnJlcGxhY2Uoc2V0dGluZ3MucGVyc29uYWxJbmZvLCBwZXJzb25JbmZvV2l0aFNwYWNlcykgKyAnL3Rlc3QuanMnLCAyLCA0MiwgZGFuZ2Vyb3VzRmlsZW5hbWVFcnJvcik7XG5cdFx0dGhpcy5jbG9jay50aWNrKEVycm9yVGVsZW1ldHJ5LkVSUk9SX0ZMVVNIX1RJTUVPVVQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVycm9yU3R1Yi5jYWxsQ291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuZmlsZS5pbmRleE9mKHNldHRpbmdzLmRhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mby5yZXBsYWNlKHNldHRpbmdzLnBlcnNvbmFsSW5mbywgcGVyc29uSW5mb1dpdGhTcGFjZXMpKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuZmlsZSwgc2V0dGluZ3MuaW1wb3J0YW50SW5mbyArICcvdGVzdC5qcycpO1xuXG5cdFx0ZXJyb3JUZWxlbWV0cnkuZGlzcG9zZSgpO1xuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdHNpbm9uLnJlc3RvcmUoKTtcblx0fSkpO1xuXG5cdHRlc3QoJ1VuY2F1Z2h0IEVycm9yIFRlbGVtZXRyeSByZW1vdmVzIFBJSSBmcm9tIGZpbGVuYW1lJywgc2lub25UZXN0Rm4oZnVuY3Rpb24gKHRoaXM6IGFueSkge1xuXHRcdGNvbnN0IGNsb2NrID0gdGhpcy5jbG9jaztcblx0XHRjb25zdCBlcnJvclN0dWIgPSBzaW5vbi5zdHViKCk7XG5cdFx0bWFpbldpbmRvdy5vbmVycm9yID0gZXJyb3JTdHViO1xuXHRcdGNvbnN0IHNldHRpbmdzID0gbmV3IEVycm9yVGVzdGluZ1NldHRpbmdzKCk7XG5cdFx0Y29uc3QgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdEVycm9yVGVsZW1ldHJ5U2VydmljZSh7IGFwcGVuZGVyczogW3Rlc3RBcHBlbmRlcl0gfSk7XG5cdFx0Y29uc3QgZXJyb3JUZWxlbWV0cnkgPSBuZXcgRXJyb3JUZWxlbWV0cnkoc2VydmljZSk7XG5cblx0XHRsZXQgZGFuZ2Vyb3VzRmlsZW5hbWVFcnJvcjogYW55ID0gbmV3IEVycm9yKCdkYW5nZXJvdXNGaWxlbmFtZScpO1xuXHRcdGRhbmdlcm91c0ZpbGVuYW1lRXJyb3Iuc3RhY2sgPSBzZXR0aW5ncy5zdGFjaztcblx0XHQoPGFueT5tYWluV2luZG93Lm9uZXJyb3IpKCdkYW5nZXJvdXNGaWxlbmFtZScsIHNldHRpbmdzLmRhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mbyArICcvdGVzdC5qcycsIDIsIDQyLCBkYW5nZXJvdXNGaWxlbmFtZUVycm9yKTtcblx0XHRjbG9jay50aWNrKEVycm9yVGVsZW1ldHJ5LkVSUk9SX0ZMVVNIX1RJTUVPVVQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvclN0dWIuY2FsbENvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmZpbGUuaW5kZXhPZihzZXR0aW5ncy5kYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm8pLCAtMSk7XG5cblx0XHRkYW5nZXJvdXNGaWxlbmFtZUVycm9yID0gbmV3IEVycm9yKCdkYW5nZXJvdXNGaWxlbmFtZScpO1xuXHRcdGRhbmdlcm91c0ZpbGVuYW1lRXJyb3Iuc3RhY2sgPSBzZXR0aW5ncy5zdGFjaztcblx0XHQoPGFueT5tYWluV2luZG93Lm9uZXJyb3IpKCdkYW5nZXJvdXNGaWxlbmFtZScsIHNldHRpbmdzLmRhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mbyArICcvdGVzdC5qcycsIDIsIDQyLCBkYW5nZXJvdXNGaWxlbmFtZUVycm9yKTtcblx0XHRjbG9jay50aWNrKEVycm9yVGVsZW1ldHJ5LkVSUk9SX0ZMVVNIX1RJTUVPVVQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvclN0dWIuY2FsbENvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmZpbGUuaW5kZXhPZihzZXR0aW5ncy5kYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm8pLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5maWxlLCBzZXR0aW5ncy5pbXBvcnRhbnRJbmZvICsgJy90ZXN0LmpzJyk7XG5cblx0XHRlcnJvclRlbGVtZXRyeS5kaXNwb3NlKCk7XG5cdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdFx0c2lub24ucmVzdG9yZSgpO1xuXHR9KSk7XG5cblx0dGVzdCgnVW5leHBlY3RlZCBFcnJvciBUZWxlbWV0cnkgcmVtb3ZlcyBQSUknLCBzaW5vblRlc3RGbihmdW5jdGlvbiAodGhpczogYW55KSB7XG5cdFx0Y29uc3Qgb3JpZ0Vycm9ySGFuZGxlciA9IEVycm9ycy5lcnJvckhhbmRsZXIuZ2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigpO1xuXHRcdEVycm9ycy5zZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHNldHRpbmdzID0gbmV3IEVycm9yVGVzdGluZ1NldHRpbmdzKCk7XG5cdFx0XHRjb25zdCB0ZXN0QXBwZW5kZXIgPSBuZXcgVGVzdFRlbGVtZXRyeUFwcGVuZGVyKCk7XG5cdFx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlc3RFcnJvclRlbGVtZXRyeVNlcnZpY2UoeyBhcHBlbmRlcnM6IFt0ZXN0QXBwZW5kZXJdIH0pO1xuXHRcdFx0Y29uc3QgZXJyb3JUZWxlbWV0cnkgPSBuZXcgRXJyb3JUZWxlbWV0cnkoc2VydmljZSk7XG5cblx0XHRcdGNvbnN0IGRhbmdlcm91c1BhdGhXaXRob3V0SW1wb3J0YW50SW5mb0Vycm9yOiBhbnkgPSBuZXcgRXJyb3Ioc2V0dGluZ3MuZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvKTtcblx0XHRcdGRhbmdlcm91c1BhdGhXaXRob3V0SW1wb3J0YW50SW5mb0Vycm9yLnN0YWNrID0gc2V0dGluZ3Muc3RhY2s7XG5cdFx0XHRFcnJvcnMub25VbmV4cGVjdGVkRXJyb3IoZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvRXJyb3IpO1xuXHRcdFx0dGhpcy5jbG9jay50aWNrKEVycm9yVGVsZW1ldHJ5LkVSUk9SX0ZMVVNIX1RJTUVPVVQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZy5pbmRleE9mKHNldHRpbmdzLnBlcnNvbmFsSW5mbyksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MuZmlsZVByZWZpeCksIC0xKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5wZXJzb25hbEluZm8pLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLmZpbGVQcmVmaXgpLCAtMSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLnN0YWNrWzRdLnJlcGxhY2Uoc2V0dGluZ3MucmFuZG9tVXNlckZpbGUsIHNldHRpbmdzLmFub255bWl6ZWRSYW5kb21Vc2VyRmlsZSkpLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5zcGxpdCgnXFxuJykubGVuZ3RoLCBzZXR0aW5ncy5zdGFjay5sZW5ndGgpO1xuXG5cdFx0XHRlcnJvclRlbGVtZXRyeS5kaXNwb3NlKCk7XG5cdFx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0ZmluYWxseSB7XG5cdFx0XHRFcnJvcnMuc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihvcmlnRXJyb3JIYW5kbGVyKTtcblx0XHR9XG5cdH0pKTtcblxuXHR0ZXN0KCdVbmNhdWdodCBFcnJvciBUZWxlbWV0cnkgcmVtb3ZlcyBQSUknLCBzaW5vblRlc3RGbihmdW5jdGlvbiAodGhpczogYW55KSB7XG5cdFx0Y29uc3QgZXJyb3JTdHViID0gc2lub24uc3R1YigpO1xuXHRcdG1haW5XaW5kb3cub25lcnJvciA9IGVycm9yU3R1Yjtcblx0XHRjb25zdCBzZXR0aW5ncyA9IG5ldyBFcnJvclRlc3RpbmdTZXR0aW5ncygpO1xuXHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlc3RFcnJvclRlbGVtZXRyeVNlcnZpY2UoeyBhcHBlbmRlcnM6IFt0ZXN0QXBwZW5kZXJdIH0pO1xuXHRcdGNvbnN0IGVycm9yVGVsZW1ldHJ5ID0gbmV3IEVycm9yVGVsZW1ldHJ5KHNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvRXJyb3I6IGFueSA9IG5ldyBFcnJvcignZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvJyk7XG5cdFx0ZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvRXJyb3Iuc3RhY2sgPSBzZXR0aW5ncy5zdGFjaztcblx0XHQoPGFueT5tYWluV2luZG93Lm9uZXJyb3IpKHNldHRpbmdzLmRhbmdlcm91c1BhdGhXaXRob3V0SW1wb3J0YW50SW5mbywgJ3Rlc3QuanMnLCAyLCA0MiwgZGFuZ2Vyb3VzUGF0aFdpdGhvdXRJbXBvcnRhbnRJbmZvRXJyb3IpO1xuXHRcdHRoaXMuY2xvY2sudGljayhFcnJvclRlbGVtZXRyeS5FUlJPUl9GTFVTSF9USU1FT1VUKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvclN0dWIuY2FsbENvdW50LCAxKTtcblx0XHQvLyBUZXN0IHRoYXQgbm8gZmlsZSBpbmZvcm1hdGlvbiByZW1haW5zLCBlc3AuIHBlcnNvbmFsIGluZm9cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZy5pbmRleE9mKHNldHRpbmdzLnBlcnNvbmFsSW5mbyksIC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZy5pbmRleE9mKHNldHRpbmdzLmZpbGVQcmVmaXgpLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5wZXJzb25hbEluZm8pLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5maWxlUHJlZml4KSwgLTEpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3Muc3RhY2tbNF0ucmVwbGFjZShzZXR0aW5ncy5yYW5kb21Vc2VyRmlsZSwgc2V0dGluZ3MuYW5vbnltaXplZFJhbmRvbVVzZXJGaWxlKSksIC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5zcGxpdCgnXFxuJykubGVuZ3RoLCBzZXR0aW5ncy5zdGFjay5sZW5ndGgpO1xuXG5cdFx0ZXJyb3JUZWxlbWV0cnkuZGlzcG9zZSgpO1xuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdHNpbm9uLnJlc3RvcmUoKTtcblx0fSkpO1xuXG5cdHRlc3QoJ1VuZXhwZWN0ZWQgRXJyb3IgVGVsZW1ldHJ5IHJlbW92ZXMgUElJIGJ1dCBwcmVzZXJ2ZXMgQ29kZSBmaWxlIHBhdGgnLCBzaW5vblRlc3RGbihmdW5jdGlvbiAodGhpczogYW55KSB7XG5cblx0XHRjb25zdCBvcmlnRXJyb3JIYW5kbGVyID0gRXJyb3JzLmVycm9ySGFuZGxlci5nZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCk7XG5cdFx0RXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKCkgPT4geyB9KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzZXR0aW5ncyA9IG5ldyBFcnJvclRlc3RpbmdTZXR0aW5ncygpO1xuXHRcdFx0Y29uc3QgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHRcdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZXN0RXJyb3JUZWxlbWV0cnlTZXJ2aWNlKHsgYXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSB9KTtcblx0XHRcdGNvbnN0IGVycm9yVGVsZW1ldHJ5ID0gbmV3IEVycm9yVGVsZW1ldHJ5KHNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvcjogYW55ID0gbmV3IEVycm9yKHNldHRpbmdzLmRhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mbyk7XG5cdFx0XHRkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvci5zdGFjayA9IHNldHRpbmdzLnN0YWNrO1xuXG5cdFx0XHQvLyBUZXN0IHRoYXQgaW1wb3J0YW50IGluZm9ybWF0aW9uIHJlbWFpbnMgYnV0IHBlcnNvbmFsIGluZm8gZG9lcyBub3Rcblx0XHRcdEVycm9ycy5vblVuZXhwZWN0ZWRFcnJvcihkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvcik7XG5cdFx0XHR0aGlzLmNsb2NrLnRpY2soRXJyb3JUZWxlbWV0cnkuRVJST1JfRkxVU0hfVElNRU9VVCk7XG5cblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MuaW1wb3J0YW50SW5mbyksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MucGVyc29uYWxJbmZvKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2cuaW5kZXhPZihzZXR0aW5ncy5maWxlUHJlZml4KSwgLTEpO1xuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5pbXBvcnRhbnRJbmZvKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5wZXJzb25hbEluZm8pLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLmZpbGVQcmVmaXgpLCAtMSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLnN0YWNrWzRdLnJlcGxhY2Uoc2V0dGluZ3MucmFuZG9tVXNlckZpbGUsIHNldHRpbmdzLmFub255bWl6ZWRSYW5kb21Vc2VyRmlsZSkpLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5zcGxpdCgnXFxuJykubGVuZ3RoLCBzZXR0aW5ncy5zdGFjay5sZW5ndGgpO1xuXG5cdFx0XHRlcnJvclRlbGVtZXRyeS5kaXNwb3NlKCk7XG5cdFx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0ZmluYWxseSB7XG5cdFx0XHRFcnJvcnMuc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihvcmlnRXJyb3JIYW5kbGVyKTtcblx0XHR9XG5cdH0pKTtcblxuXHR0ZXN0KCdVbmNhdWdodCBFcnJvciBUZWxlbWV0cnkgcmVtb3ZlcyBQSUkgYnV0IHByZXNlcnZlcyBDb2RlIGZpbGUgcGF0aCcsIHNpbm9uVGVzdEZuKGZ1bmN0aW9uICh0aGlzOiBhbnkpIHtcblx0XHRjb25zdCBlcnJvclN0dWIgPSBzaW5vbi5zdHViKCk7XG5cdFx0bWFpbldpbmRvdy5vbmVycm9yID0gZXJyb3JTdHViO1xuXHRcdGNvbnN0IHNldHRpbmdzID0gbmV3IEVycm9yVGVzdGluZ1NldHRpbmdzKCk7XG5cdFx0Y29uc3QgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdEVycm9yVGVsZW1ldHJ5U2VydmljZSh7IGFwcGVuZGVyczogW3Rlc3RBcHBlbmRlcl0gfSk7XG5cdFx0Y29uc3QgZXJyb3JUZWxlbWV0cnkgPSBuZXcgRXJyb3JUZWxlbWV0cnkoc2VydmljZSk7XG5cblx0XHRjb25zdCBkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvcjogYW55ID0gbmV3IEVycm9yKCdkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm8nKTtcblx0XHRkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvci5zdGFjayA9IHNldHRpbmdzLnN0YWNrO1xuXHRcdCg8YW55Pm1haW5XaW5kb3cub25lcnJvcikoc2V0dGluZ3MuZGFuZ2Vyb3VzUGF0aFdpdGhJbXBvcnRhbnRJbmZvLCAndGVzdC5qcycsIDIsIDQyLCBkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvcik7XG5cdFx0dGhpcy5jbG9jay50aWNrKEVycm9yVGVsZW1ldHJ5LkVSUk9SX0ZMVVNIX1RJTUVPVVQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVycm9yU3R1Yi5jYWxsQ291bnQsIDEpO1xuXHRcdC8vIFRlc3QgdGhhdCBpbXBvcnRhbnQgaW5mb3JtYXRpb24gcmVtYWlucyBidXQgcGVyc29uYWwgaW5mbyBkb2VzIG5vdFxuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2YoJygnICsgc2V0dGluZ3Mubm9kZU1vZHVsZUFzYXJQYXRoVG9SZXRhaW4pLCAtMSk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZignKCcgKyBzZXR0aW5ncy5ub2RlTW9kdWxlUGF0aFRvUmV0YWluKSwgLTEpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2YoJygvJyArIHNldHRpbmdzLm5vZGVNb2R1bGVBc2FyUGF0aFRvUmV0YWluKSwgLTEpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2YoJygvJyArIHNldHRpbmdzLm5vZGVNb2R1bGVQYXRoVG9SZXRhaW4pLCAtMSk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2cuaW5kZXhPZihzZXR0aW5ncy5pbXBvcnRhbnRJbmZvKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MucGVyc29uYWxJbmZvKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MuZmlsZVByZWZpeCksIC0xKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLmltcG9ydGFudEluZm8pLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5wZXJzb25hbEluZm8pLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5maWxlUHJlZml4KSwgLTEpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3Muc3RhY2tbNF0ucmVwbGFjZShzZXR0aW5ncy5yYW5kb21Vc2VyRmlsZSwgc2V0dGluZ3MuYW5vbnltaXplZFJhbmRvbVVzZXJGaWxlKSksIC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5zcGxpdCgnXFxuJykubGVuZ3RoLCBzZXR0aW5ncy5zdGFjay5sZW5ndGgpO1xuXG5cdFx0ZXJyb3JUZWxlbWV0cnkuZGlzcG9zZSgpO1xuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdHNpbm9uLnJlc3RvcmUoKTtcblx0fSkpO1xuXG5cdHRlc3QoJ1VuZXhwZWN0ZWQgRXJyb3IgVGVsZW1ldHJ5IHJlbW92ZXMgUElJIGJ1dCBwcmVzZXJ2ZXMgQ29kZSBmaWxlIHBhdGggd2l0aCBub2RlIG1vZHVsZXMnLCBzaW5vblRlc3RGbihmdW5jdGlvbiAodGhpczogYW55KSB7XG5cblx0XHRjb25zdCBvcmlnRXJyb3JIYW5kbGVyID0gRXJyb3JzLmVycm9ySGFuZGxlci5nZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCk7XG5cdFx0RXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKCkgPT4geyB9KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzZXR0aW5ncyA9IG5ldyBFcnJvclRlc3RpbmdTZXR0aW5ncygpO1xuXHRcdFx0Y29uc3QgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHRcdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZXN0RXJyb3JUZWxlbWV0cnlTZXJ2aWNlKHsgYXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSB9KTtcblx0XHRcdGNvbnN0IGVycm9yVGVsZW1ldHJ5ID0gbmV3IEVycm9yVGVsZW1ldHJ5KHNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvcjogYW55ID0gbmV3IEVycm9yKHNldHRpbmdzLmRhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mbyk7XG5cdFx0XHRkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvci5zdGFjayA9IHNldHRpbmdzLnN0YWNrO1xuXG5cblx0XHRcdEVycm9ycy5vblVuZXhwZWN0ZWRFcnJvcihkYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm9FcnJvcik7XG5cdFx0XHR0aGlzLmNsb2NrLnRpY2soRXJyb3JUZWxlbWV0cnkuRVJST1JfRkxVU0hfVElNRU9VVCk7XG5cblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2YoJygnICsgc2V0dGluZ3Mubm9kZU1vZHVsZUFzYXJQYXRoVG9SZXRhaW4pLCAtMSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKCcoJyArIHNldHRpbmdzLm5vZGVNb2R1bGVQYXRoVG9SZXRhaW4pLCAtMSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKCcoLycgKyBzZXR0aW5ncy5ub2RlTW9kdWxlQXNhclBhdGhUb1JldGFpbiksIC0xKTtcblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2YoJygvJyArIHNldHRpbmdzLm5vZGVNb2R1bGVQYXRoVG9SZXRhaW4pLCAtMSk7XG5cblx0XHRcdGVycm9yVGVsZW1ldHJ5LmRpc3Bvc2UoKTtcblx0XHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRmaW5hbGx5IHtcblx0XHRcdEVycm9ycy5zZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKG9yaWdFcnJvckhhbmRsZXIpO1xuXHRcdH1cblx0fSkpO1xuXG5cdHRlc3QoJ1VuZXhwZWN0ZWQgRXJyb3IgVGVsZW1ldHJ5IHJlbW92ZXMgUElJIGJ1dCBwcmVzZXJ2ZXMgQ29kZSBmaWxlIHBhdGggd2hlbiBQSUlQYXRoIGlzIGNvbmZpZ3VyZWQnLCBzaW5vblRlc3RGbihmdW5jdGlvbiAodGhpczogYW55KSB7XG5cblx0XHRjb25zdCBvcmlnRXJyb3JIYW5kbGVyID0gRXJyb3JzLmVycm9ySGFuZGxlci5nZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCk7XG5cdFx0RXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKCkgPT4geyB9KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzZXR0aW5ncyA9IG5ldyBFcnJvclRlc3RpbmdTZXR0aW5ncygpO1xuXHRcdFx0Y29uc3QgdGVzdEFwcGVuZGVyID0gbmV3IFRlc3RUZWxlbWV0cnlBcHBlbmRlcigpO1xuXHRcdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZXN0RXJyb3JUZWxlbWV0cnlTZXJ2aWNlKHsgYXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSwgcGlpUGF0aHM6IFtzZXR0aW5ncy5wZXJzb25hbEluZm8gKyAnL3Jlc291cmNlcy9hcHAvJ10gfSk7XG5cdFx0XHRjb25zdCBlcnJvclRlbGVtZXRyeSA9IG5ldyBFcnJvclRlbGVtZXRyeShzZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgZGFuZ2Vyb3VzUGF0aFdpdGhJbXBvcnRhbnRJbmZvRXJyb3I6IGFueSA9IG5ldyBFcnJvcihzZXR0aW5ncy5kYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm8pO1xuXHRcdFx0ZGFuZ2Vyb3VzUGF0aFdpdGhJbXBvcnRhbnRJbmZvRXJyb3Iuc3RhY2sgPSBzZXR0aW5ncy5zdGFjaztcblxuXHRcdFx0Ly8gVGVzdCB0aGF0IGltcG9ydGFudCBpbmZvcm1hdGlvbiByZW1haW5zIGJ1dCBwZXJzb25hbCBpbmZvIGRvZXMgbm90XG5cdFx0XHRFcnJvcnMub25VbmV4cGVjdGVkRXJyb3IoZGFuZ2Vyb3VzUGF0aFdpdGhJbXBvcnRhbnRJbmZvRXJyb3IpO1xuXHRcdFx0dGhpcy5jbG9jay50aWNrKEVycm9yVGVsZW1ldHJ5LkVSUk9SX0ZMVVNIX1RJTUVPVVQpO1xuXG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZy5pbmRleE9mKHNldHRpbmdzLmltcG9ydGFudEluZm8pLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZy5pbmRleE9mKHNldHRpbmdzLnBlcnNvbmFsSW5mbyksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MuZmlsZVByZWZpeCksIC0xKTtcblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3MuaW1wb3J0YW50SW5mbyksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3MucGVyc29uYWxJbmZvKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5maWxlUHJlZml4KSwgLTEpO1xuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5zdGFja1s0XS5yZXBsYWNlKHNldHRpbmdzLnJhbmRvbVVzZXJGaWxlLCBzZXR0aW5ncy5hbm9ueW1pemVkUmFuZG9tVXNlckZpbGUpKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suc3BsaXQoJ1xcbicpLmxlbmd0aCwgc2V0dGluZ3Muc3RhY2subGVuZ3RoKTtcblxuXHRcdFx0ZXJyb3JUZWxlbWV0cnkuZGlzcG9zZSgpO1xuXHRcdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdGZpbmFsbHkge1xuXHRcdFx0RXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIob3JpZ0Vycm9ySGFuZGxlcik7XG5cdFx0fVxuXHR9KSk7XG5cblx0dGVzdCgnVW5jYXVnaHQgRXJyb3IgVGVsZW1ldHJ5IHJlbW92ZXMgUElJIGJ1dCBwcmVzZXJ2ZXMgQ29kZSBmaWxlIHBhdGggd2hlbiBQSUlQYXRoIGlzIGNvbmZpZ3VyZWQnLCBzaW5vblRlc3RGbihmdW5jdGlvbiAodGhpczogYW55KSB7XG5cdFx0Y29uc3QgZXJyb3JTdHViID0gc2lub24uc3R1YigpO1xuXHRcdG1haW5XaW5kb3cub25lcnJvciA9IGVycm9yU3R1Yjtcblx0XHRjb25zdCBzZXR0aW5ncyA9IG5ldyBFcnJvclRlc3RpbmdTZXR0aW5ncygpO1xuXHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IFRlc3RFcnJvclRlbGVtZXRyeVNlcnZpY2UoeyBhcHBlbmRlcnM6IFt0ZXN0QXBwZW5kZXJdLCBwaWlQYXRoczogW3NldHRpbmdzLnBlcnNvbmFsSW5mbyArICcvcmVzb3VyY2VzL2FwcC8nXSB9KTtcblx0XHRjb25zdCBlcnJvclRlbGVtZXRyeSA9IG5ldyBFcnJvclRlbGVtZXRyeShzZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGRhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mb0Vycm9yOiBhbnkgPSBuZXcgRXJyb3IoJ2Rhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mbycpO1xuXHRcdGRhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mb0Vycm9yLnN0YWNrID0gc2V0dGluZ3Muc3RhY2s7XG5cdFx0KDxhbnk+bWFpbldpbmRvdy5vbmVycm9yKShzZXR0aW5ncy5kYW5nZXJvdXNQYXRoV2l0aEltcG9ydGFudEluZm8sICd0ZXN0LmpzJywgMiwgNDIsIGRhbmdlcm91c1BhdGhXaXRoSW1wb3J0YW50SW5mb0Vycm9yKTtcblx0XHR0aGlzLmNsb2NrLnRpY2soRXJyb3JUZWxlbWV0cnkuRVJST1JfRkxVU0hfVElNRU9VVCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyb3JTdHViLmNhbGxDb3VudCwgMSk7XG5cdFx0Ly8gVGVzdCB0aGF0IGltcG9ydGFudCBpbmZvcm1hdGlvbiByZW1haW5zIGJ1dCBwZXJzb25hbCBpbmZvIGRvZXMgbm90XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2cuaW5kZXhPZihzZXR0aW5ncy5pbXBvcnRhbnRJbmZvKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MucGVyc29uYWxJbmZvKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MuZmlsZVByZWZpeCksIC0xKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLmltcG9ydGFudEluZm8pLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5wZXJzb25hbEluZm8pLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5maWxlUHJlZml4KSwgLTEpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3Muc3RhY2tbNF0ucmVwbGFjZShzZXR0aW5ncy5yYW5kb21Vc2VyRmlsZSwgc2V0dGluZ3MuYW5vbnltaXplZFJhbmRvbVVzZXJGaWxlKSksIC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5zcGxpdCgnXFxuJykubGVuZ3RoLCBzZXR0aW5ncy5zdGFjay5sZW5ndGgpO1xuXG5cdFx0ZXJyb3JUZWxlbWV0cnkuZGlzcG9zZSgpO1xuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHRcdHNpbm9uLnJlc3RvcmUoKTtcblx0fSkpO1xuXG5cdHRlc3QoJ1VuZXhwZWN0ZWQgRXJyb3IgVGVsZW1ldHJ5IHJlbW92ZXMgUElJIGJ1dCBwcmVzZXJ2ZXMgTWlzc2luZyBNb2RlbCBlcnJvciBtZXNzYWdlJywgc2lub25UZXN0Rm4oZnVuY3Rpb24gKHRoaXM6IGFueSkge1xuXG5cdFx0Y29uc3Qgb3JpZ0Vycm9ySGFuZGxlciA9IEVycm9ycy5lcnJvckhhbmRsZXIuZ2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigpO1xuXHRcdEVycm9ycy5zZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCgpID0+IHsgfSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc2V0dGluZ3MgPSBuZXcgRXJyb3JUZXN0aW5nU2V0dGluZ3MoKTtcblx0XHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdEVycm9yVGVsZW1ldHJ5U2VydmljZSh7IGFwcGVuZGVyczogW3Rlc3RBcHBlbmRlcl0gfSk7XG5cdFx0XHRjb25zdCBlcnJvclRlbGVtZXRyeSA9IG5ldyBFcnJvclRlbGVtZXRyeShzZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgbWlzc2luZ01vZGVsRXJyb3I6IGFueSA9IG5ldyBFcnJvcihzZXR0aW5ncy5taXNzaW5nTW9kZWxNZXNzYWdlKTtcblx0XHRcdG1pc3NpbmdNb2RlbEVycm9yLnN0YWNrID0gc2V0dGluZ3Muc3RhY2s7XG5cblx0XHRcdC8vIFRlc3QgdGhhdCBubyBmaWxlIGluZm9ybWF0aW9uIHJlbWFpbnMsIGJ1dCB0aGlzIHBhcnRpY3VsYXJcblx0XHRcdC8vIGVycm9yIG1lc3NhZ2UgZG9lcyAoUmVjZWl2ZWQgbW9kZWwgZXZlbnRzIGZvciBtaXNzaW5nIG1vZGVsKVxuXHRcdFx0RXJyb3JzLm9uVW5leHBlY3RlZEVycm9yKG1pc3NpbmdNb2RlbEVycm9yKTtcblx0XHRcdHRoaXMuY2xvY2sudGljayhFcnJvclRlbGVtZXRyeS5FUlJPUl9GTFVTSF9USU1FT1VUKTtcblxuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2cuaW5kZXhPZihzZXR0aW5ncy5taXNzaW5nTW9kZWxQcmVmaXgpLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZy5pbmRleE9mKHNldHRpbmdzLnBlcnNvbmFsSW5mbyksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MuZmlsZVByZWZpeCksIC0xKTtcblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3MubWlzc2luZ01vZGVsUHJlZml4KSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5wZXJzb25hbEluZm8pLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLmZpbGVQcmVmaXgpLCAtMSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLnN0YWNrWzRdLnJlcGxhY2Uoc2V0dGluZ3MucmFuZG9tVXNlckZpbGUsIHNldHRpbmdzLmFub255bWl6ZWRSYW5kb21Vc2VyRmlsZSkpLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5zcGxpdCgnXFxuJykubGVuZ3RoLCBzZXR0aW5ncy5zdGFjay5sZW5ndGgpO1xuXG5cdFx0XHRlcnJvclRlbGVtZXRyeS5kaXNwb3NlKCk7XG5cdFx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0RXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIob3JpZ0Vycm9ySGFuZGxlcik7XG5cdFx0fVxuXHR9KSk7XG5cblx0dGVzdCgnVW5jYXVnaHQgRXJyb3IgVGVsZW1ldHJ5IHJlbW92ZXMgUElJIGJ1dCBwcmVzZXJ2ZXMgTWlzc2luZyBNb2RlbCBlcnJvciBtZXNzYWdlJywgc2lub25UZXN0Rm4oZnVuY3Rpb24gKHRoaXM6IGFueSkge1xuXHRcdGNvbnN0IGVycm9yU3R1YiA9IHNpbm9uLnN0dWIoKTtcblx0XHRtYWluV2luZG93Lm9uZXJyb3IgPSBlcnJvclN0dWI7XG5cdFx0Y29uc3Qgc2V0dGluZ3MgPSBuZXcgRXJyb3JUZXN0aW5nU2V0dGluZ3MoKTtcblx0XHRjb25zdCB0ZXN0QXBwZW5kZXIgPSBuZXcgVGVzdFRlbGVtZXRyeUFwcGVuZGVyKCk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZXN0RXJyb3JUZWxlbWV0cnlTZXJ2aWNlKHsgYXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSB9KTtcblx0XHRjb25zdCBlcnJvclRlbGVtZXRyeSA9IG5ldyBFcnJvclRlbGVtZXRyeShzZXJ2aWNlKTtcblxuXHRcdGNvbnN0IG1pc3NpbmdNb2RlbEVycm9yOiBhbnkgPSBuZXcgRXJyb3IoJ21pc3NpbmdNb2RlbE1lc3NhZ2UnKTtcblx0XHRtaXNzaW5nTW9kZWxFcnJvci5zdGFjayA9IHNldHRpbmdzLnN0YWNrO1xuXHRcdCg8YW55Pm1haW5XaW5kb3cub25lcnJvcikoc2V0dGluZ3MubWlzc2luZ01vZGVsTWVzc2FnZSwgJ3Rlc3QuanMnLCAyLCA0MiwgbWlzc2luZ01vZGVsRXJyb3IpO1xuXHRcdHRoaXMuY2xvY2sudGljayhFcnJvclRlbGVtZXRyeS5FUlJPUl9GTFVTSF9USU1FT1VUKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvclN0dWIuY2FsbENvdW50LCAxKTtcblx0XHQvLyBUZXN0IHRoYXQgbm8gZmlsZSBpbmZvcm1hdGlvbiByZW1haW5zLCBidXQgdGhpcyBwYXJ0aWN1bGFyXG5cdFx0Ly8gZXJyb3IgbWVzc2FnZSBkb2VzIChSZWNlaXZlZCBtb2RlbCBldmVudHMgZm9yIG1pc3NpbmcgbW9kZWwpXG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2cuaW5kZXhPZihzZXR0aW5ncy5taXNzaW5nTW9kZWxQcmVmaXgpLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2cuaW5kZXhPZihzZXR0aW5ncy5wZXJzb25hbEluZm8pLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2cuaW5kZXhPZihzZXR0aW5ncy5maWxlUHJlZml4KSwgLTEpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3MubWlzc2luZ01vZGVsUHJlZml4KSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3MucGVyc29uYWxJbmZvKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3MuZmlsZVByZWZpeCksIC0xKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLnN0YWNrWzRdLnJlcGxhY2Uoc2V0dGluZ3MucmFuZG9tVXNlckZpbGUsIHNldHRpbmdzLmFub255bWl6ZWRSYW5kb21Vc2VyRmlsZSkpLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suc3BsaXQoJ1xcbicpLmxlbmd0aCwgc2V0dGluZ3Muc3RhY2subGVuZ3RoKTtcblxuXHRcdGVycm9yVGVsZW1ldHJ5LmRpc3Bvc2UoKTtcblx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHRzaW5vbi5yZXN0b3JlKCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdVbmV4cGVjdGVkIEVycm9yIFRlbGVtZXRyeSByZW1vdmVzIFBJSSBidXQgcHJlc2VydmVzIE5vIFN1Y2ggRmlsZSBlcnJvciBtZXNzYWdlJywgc2lub25UZXN0Rm4oZnVuY3Rpb24gKHRoaXM6IGFueSkge1xuXG5cdFx0Y29uc3Qgb3JpZ0Vycm9ySGFuZGxlciA9IEVycm9ycy5lcnJvckhhbmRsZXIuZ2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigpO1xuXHRcdEVycm9ycy5zZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCgpID0+IHsgfSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc2V0dGluZ3MgPSBuZXcgRXJyb3JUZXN0aW5nU2V0dGluZ3MoKTtcblx0XHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdEVycm9yVGVsZW1ldHJ5U2VydmljZSh7IGFwcGVuZGVyczogW3Rlc3RBcHBlbmRlcl0gfSk7XG5cdFx0XHRjb25zdCBlcnJvclRlbGVtZXRyeSA9IG5ldyBFcnJvclRlbGVtZXRyeShzZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3Qgbm9TdWNoRmlsZUVycm9yOiBhbnkgPSBuZXcgRXJyb3Ioc2V0dGluZ3Mubm9TdWNoRmlsZU1lc3NhZ2UpO1xuXHRcdFx0bm9TdWNoRmlsZUVycm9yLnN0YWNrID0gc2V0dGluZ3Muc3RhY2s7XG5cblx0XHRcdC8vIFRlc3QgdGhhdCBubyBmaWxlIGluZm9ybWF0aW9uIHJlbWFpbnMsIGJ1dCB0aGlzIHBhcnRpY3VsYXJcblx0XHRcdC8vIGVycm9yIG1lc3NhZ2UgZG9lcyAoRU5PRU5UOiBubyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5KVxuXHRcdFx0RXJyb3JzLm9uVW5leHBlY3RlZEVycm9yKG5vU3VjaEZpbGVFcnJvcik7XG5cdFx0XHR0aGlzLmNsb2NrLnRpY2soRXJyb3JUZWxlbWV0cnkuRVJST1JfRkxVU0hfVElNRU9VVCk7XG5cblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3Mubm9TdWNoRmlsZVByZWZpeCksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MucGVyc29uYWxJbmZvKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5tc2cuaW5kZXhPZihzZXR0aW5ncy5maWxlUHJlZml4KSwgLTEpO1xuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5ub1N1Y2hGaWxlUHJlZml4KSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5wZXJzb25hbEluZm8pLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLmZpbGVQcmVmaXgpLCAtMSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5pbmRleE9mKHNldHRpbmdzLnN0YWNrWzRdLnJlcGxhY2Uoc2V0dGluZ3MucmFuZG9tVXNlckZpbGUsIHNldHRpbmdzLmFub255bWl6ZWRSYW5kb21Vc2VyRmlsZSkpLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLmNhbGxzdGFjay5zcGxpdCgnXFxuJykubGVuZ3RoLCBzZXR0aW5ncy5zdGFjay5sZW5ndGgpO1xuXG5cdFx0XHRlcnJvclRlbGVtZXRyeS5kaXNwb3NlKCk7XG5cdFx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0RXJyb3JzLnNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIob3JpZ0Vycm9ySGFuZGxlcik7XG5cdFx0fVxuXHR9KSk7XG5cblx0dGVzdCgnVW5jYXVnaHQgRXJyb3IgVGVsZW1ldHJ5IHJlbW92ZXMgUElJIGJ1dCBwcmVzZXJ2ZXMgTm8gU3VjaCBGaWxlIGVycm9yIG1lc3NhZ2UnLCBzaW5vblRlc3RGbihmdW5jdGlvbiAodGhpczogYW55KSB7XG5cdFx0Y29uc3Qgb3JpZ0Vycm9ySGFuZGxlciA9IEVycm9ycy5lcnJvckhhbmRsZXIuZ2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigpO1xuXHRcdEVycm9ycy5zZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCgpID0+IHsgfSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZXJyb3JTdHViID0gc2lub24uc3R1YigpO1xuXHRcdFx0bWFpbldpbmRvdy5vbmVycm9yID0gZXJyb3JTdHViO1xuXHRcdFx0Y29uc3Qgc2V0dGluZ3MgPSBuZXcgRXJyb3JUZXN0aW5nU2V0dGluZ3MoKTtcblx0XHRcdGNvbnN0IHRlc3RBcHBlbmRlciA9IG5ldyBUZXN0VGVsZW1ldHJ5QXBwZW5kZXIoKTtcblx0XHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgVGVzdEVycm9yVGVsZW1ldHJ5U2VydmljZSh7IGFwcGVuZGVyczogW3Rlc3RBcHBlbmRlcl0gfSk7XG5cdFx0XHRjb25zdCBlcnJvclRlbGVtZXRyeSA9IG5ldyBFcnJvclRlbGVtZXRyeShzZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3Qgbm9TdWNoRmlsZUVycm9yOiBhbnkgPSBuZXcgRXJyb3IoJ25vU3VjaEZpbGVNZXNzYWdlJyk7XG5cdFx0XHRub1N1Y2hGaWxlRXJyb3Iuc3RhY2sgPSBzZXR0aW5ncy5zdGFjaztcblx0XHRcdCg8YW55Pm1haW5XaW5kb3cub25lcnJvcikoc2V0dGluZ3Mubm9TdWNoRmlsZU1lc3NhZ2UsICd0ZXN0LmpzJywgMiwgNDIsIG5vU3VjaEZpbGVFcnJvcik7XG5cdFx0XHR0aGlzLmNsb2NrLnRpY2soRXJyb3JUZWxlbWV0cnkuRVJST1JfRkxVU0hfVElNRU9VVCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnJvclN0dWIuY2FsbENvdW50LCAxKTtcblx0XHRcdC8vIFRlc3QgdGhhdCBubyBmaWxlIGluZm9ybWF0aW9uIHJlbWFpbnMsIGJ1dCB0aGlzIHBhcnRpY3VsYXJcblx0XHRcdC8vIGVycm9yIG1lc3NhZ2UgZG9lcyAoRU5PRU5UOiBubyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5KVxuXHRcdFx0RXJyb3JzLm9uVW5leHBlY3RlZEVycm9yKG5vU3VjaEZpbGVFcnJvcik7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZy5pbmRleE9mKHNldHRpbmdzLm5vU3VjaEZpbGVQcmVmaXgpLCAtMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdEFwcGVuZGVyLmV2ZW50c1swXS5kYXRhLm1zZy5pbmRleE9mKHNldHRpbmdzLnBlcnNvbmFsSW5mbyksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEubXNnLmluZGV4T2Yoc2V0dGluZ3MuZmlsZVByZWZpeCksIC0xKTtcblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3Mubm9TdWNoRmlsZVByZWZpeCksIC0xKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZXZlbnRzWzBdLmRhdGEuY2FsbHN0YWNrLmluZGV4T2Yoc2V0dGluZ3MucGVyc29uYWxJbmZvKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5maWxlUHJlZml4KSwgLTEpO1xuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suaW5kZXhPZihzZXR0aW5ncy5zdGFja1s0XS5yZXBsYWNlKHNldHRpbmdzLnJhbmRvbVVzZXJGaWxlLCBzZXR0aW5ncy5hbm9ueW1pemVkUmFuZG9tVXNlckZpbGUpKSwgLTEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RBcHBlbmRlci5ldmVudHNbMF0uZGF0YS5jYWxsc3RhY2suc3BsaXQoJ1xcbicpLmxlbmd0aCwgc2V0dGluZ3Muc3RhY2subGVuZ3RoKTtcblxuXHRcdFx0ZXJyb3JUZWxlbWV0cnkuZGlzcG9zZSgpO1xuXHRcdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdFx0XHRzaW5vbi5yZXN0b3JlKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdEVycm9ycy5zZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKG9yaWdFcnJvckhhbmRsZXIpO1xuXHRcdH1cblx0fSkpO1xuXG5cdHRlc3QoJ1RlbGVtZXRyeSBTZXJ2aWNlIHNlbmRzIGV2ZW50cyB3aGVuIHRlbGVtZXRyeSBpcyBvbicsIHNpbm9uVGVzdEZuKGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0QXBwZW5kZXIgPSBuZXcgVGVzdFRlbGVtZXRyeUFwcGVuZGVyKCk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZWxlbWV0cnlTZXJ2aWNlKHsgYXBwZW5kZXJzOiBbdGVzdEFwcGVuZGVyXSB9LCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCksIFRlc3RQcm9kdWN0U2VydmljZSk7XG5cdFx0c2VydmljZS5wdWJsaWNMb2coJ3Rlc3RFdmVudCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0QXBwZW5kZXIuZ2V0RXZlbnRzQ291bnQoKSwgMSk7XG5cdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdUZWxlbWV0cnkgU2VydmljZSBjaGVja3Mgd2l0aCBjb25maWcgc2VydmljZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCB0ZWxlbWV0cnlMZXZlbCA9IFRlbGVtZXRyeUNvbmZpZ3VyYXRpb24uT0ZGO1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxhbnk+KCk7XG5cblx0XHRjb25zdCB0ZXN0QXBwZW5kZXIgPSBuZXcgVGVzdFRlbGVtZXRyeUFwcGVuZGVyKCk7XG5cdFx0Y29uc3Qgc2VydmljZSA9IG5ldyBUZWxlbWV0cnlTZXJ2aWNlKHtcblx0XHRcdGFwcGVuZGVyczogW3Rlc3RBcHBlbmRlcl1cblx0XHR9LCBuZXcgY2xhc3MgZXh0ZW5kcyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uge1xuXHRcdFx0b3ZlcnJpZGUgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uID0gZW1pdHRlci5ldmVudDtcblx0XHRcdG92ZXJyaWRlIGdldFZhbHVlKCkge1xuXHRcdFx0XHRyZXR1cm4gdGVsZW1ldHJ5TGV2ZWwgYXMgYW55O1xuXHRcdFx0fVxuXHRcdH0oKSwgVGVzdFByb2R1Y3RTZXJ2aWNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnRlbGVtZXRyeUxldmVsLCBUZWxlbWV0cnlMZXZlbC5OT05FKTtcblxuXHRcdHRlbGVtZXRyeUxldmVsID0gVGVsZW1ldHJ5Q29uZmlndXJhdGlvbi5PTjtcblx0XHRlbWl0dGVyLmZpcmUoeyBhZmZlY3RzQ29uZmlndXJhdGlvbjogKCkgPT4gdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50ZWxlbWV0cnlMZXZlbCwgVGVsZW1ldHJ5TGV2ZWwuVVNBR0UpO1xuXG5cdFx0dGVsZW1ldHJ5TGV2ZWwgPSBUZWxlbWV0cnlDb25maWd1cmF0aW9uLkVSUk9SO1xuXHRcdGVtaXR0ZXIuZmlyZSh7IGFmZmVjdHNDb25maWd1cmF0aW9uOiAoKSA9PiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnRlbGVtZXRyeUxldmVsLCBUZWxlbWV0cnlMZXZlbC5FUlJPUik7XG5cblx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixZQUFZLFdBQVc7QUFDdkIsT0FBTyxlQUFlO0FBQ3RCLFNBQVMsa0JBQWtCO0FBQzNCLFlBQVksWUFBWTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxnQ0FBZ0M7QUFDekMsT0FBTyxhQUFhO0FBRXBCLE9BQU8sb0JBQW9CO0FBQzNCLFNBQVMsd0JBQXdCLHNCQUFzQjtBQUN2RCxTQUFrQyx3QkFB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d0IsQ0FBQyxHQUFHLEVBQUU7QUFDOUosYUFBTyxZQUFZLGFBQWEsT0FBTyxDQUFDLEVBQUUsS0FBSyxVQUFVLE1BQU0sSUFBSSxFQUFFLFFBQVEsU0FBUyxNQUFNLE1BQU07QUFFbEcscUJBQWUsUUFBUTtBQUN2QixjQUFRLFFBQVE7QUFDaEIsWUFBTSxRQUFRO0FBQUEsSUFDZixVQUFFO0FBQ0QsYUFBTywwQkFBMEIsZ0JBQWdCO0FBQUEsSUFDbEQ7QUFBQSxFQUNELENBQUMsQ0FBQztBQUVGLE9BQUssdURBQXVELFlBQVksV0FBWTtBQUNuRixVQUFNLGVBQWUsSUFBSSxzQkFBc0I7QUFDL0MsVUFBTSxVQUFVLElBQUksaUJBQWlCLEVBQUUsV0FBVyxDQUFDLFlBQVksRUFBRSxHQUFHLElBQUkseUJBQXlCLEdBQUcsa0JBQWtCO0FBQ3RILFlBQVEsVUFBVSxXQUFXO0FBQzdCLFdBQU8sWUFBWSxhQUFhLGVBQWUsR0FBRyxDQUFDO0FBQ25ELFlBQVEsUUFBUTtBQUFBLEVBQ2pCLENBQUMsQ0FBQztBQUVGLE9BQUssZ0RBQWdELFdBQVk7QUFFaEUsUUFBSSxpQkFBaUIsdUJBQXVCO0FBQzVDLFVBQU0sVUFBVSxJQUFJLFFBQWE7QUFFakMsVUFBTSxlQUFlLElBQUksc0JBQXNCO0FBQy9DLFVBQU0sVUFBVSxJQUFJLGlCQUFpQjtBQUFBLE1BQ3BDLFdBQVcsQ0FBQyxZQUFZO0FBQUEsSUFDekIsR0FBRyxJQUFJLGNBQWMseUJBQXlCO0FBQUEsTUFBdkM7QUFBQTtBQUNOLGFBQVMsMkJBQTJCLFFBQVE7QUFBQTtBQUFBLE1BQ25DLFdBQVc7QUFDbkIsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNELEVBQUUsR0FBRyxrQkFBa0I7QUFFdkIsV0FBTyxZQUFZLFFBQVEsZ0JBQWdCLGVBQWUsSUFBSTtBQUU5RCxxQkFBaUIsdUJBQXVCO0FBQ3hDLFlBQVEsS0FBSyxFQUFFLHNCQUFzQixNQUFNLEtBQUssQ0FBQztBQUNqRCxXQUFPLFlBQVksUUFBUSxnQkFBZ0IsZUFBZSxLQUFLO0FBRS9ELHFCQUFpQix1QkFBdUI7QUFDeEMsWUFBUSxLQUFLLEVBQUUsc0JBQXNCLE1BQU0sS0FBSyxDQUFDO0FBQ2pELFdBQU8sWUFBWSxRQUFRLGdCQUFnQixlQUFlLEtBQUs7QUFFL0QsWUFBUSxRQUFRO0FBQUEsRUFDakIsQ0FBQztBQUVELDBDQUF3QztBQUN6QyxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
