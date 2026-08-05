import assert from "assert";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { nullExtensionDescription } from "../../../../services/extensions/common/extensions.js";
import { SpeechToTextStatus } from "../../../speech/common/speechService.js";
import { VoiceChatService } from "../../common/voiceChatService.js";
import { ChatAgentLocation } from "../../common/constants.js";
suite("VoiceChat", () => {
  class TestChatAgentCommand {
    constructor(name, description) {
      this.name = name;
      this.description = description;
    }
  }
  class TestChatAgent {
    constructor(id, slashCommands) {
      this.id = id;
      this.slashCommands = slashCommands;
      this.extensionId = nullExtensionDescription.identifier;
      this.extensionPublisher = "";
      this.extensionDisplayName = "";
      this.extensionPublisherId = "";
      this.locations = [ChatAgentLocation.Panel];
      this.disambiguation = [];
      this.metadata = {};
      this.name = id;
    }
    provideFollowups(request, result, history, token) {
      throw new Error("Method not implemented.");
    }
    provideSampleQuestions(location, token) {
      throw new Error("Method not implemented.");
    }
    invoke(request, progress, history, token) {
      throw new Error("Method not implemented.");
    }
    provideWelcomeMessage(token) {
      throw new Error("Method not implemented.");
    }
  }
  const agents = [
    new TestChatAgent("workspace", [
      new TestChatAgentCommand("fix", "fix"),
      new TestChatAgentCommand("explain", "explain")
    ]),
    new TestChatAgent("vscode", [
      new TestChatAgentCommand("search", "search")
    ])
  ];
  class TestChatAgentService {
    constructor() {
      this.onDidChangeAgents = Event.None;
      this.hasToolsAgent = false;
    }
    registerAgentImplementation(id, agent) {
      throw new Error();
    }
    registerDynamicAgent(data, agentImpl) {
      throw new Error("Method not implemented.");
    }
    invokeAgent(id, request, progress, history, token) {
      throw new Error();
    }
    setRequestPaused(agent, requestId, isPaused) {
      throw new Error("not implemented");
    }
    getFollowups(id, request, result, history, token) {
      throw new Error();
    }
    getActivatedAgents() {
      return agents;
    }
    getAgents() {
      return agents;
    }
    getDefaultAgent() {
      throw new Error();
    }
    getContributedDefaultAgent() {
      throw new Error();
    }
    registerAgent(id, data) {
      throw new Error("Method not implemented.");
    }
    getAgent(id) {
      throw new Error("Method not implemented.");
    }
    getAgentsByName(name) {
      throw new Error("Method not implemented.");
    }
    updateAgent(id, updateMetadata) {
      throw new Error("Method not implemented.");
    }
    getAgentByFullyQualifiedId(id) {
      throw new Error("Method not implemented.");
    }
    registerAgentCompletionProvider(id, provider) {
      throw new Error("Method not implemented.");
    }
    getAgentCompletionItems(id, query, token) {
      throw new Error("Method not implemented.");
    }
    agentHasDupeName(id) {
      throw new Error("Method not implemented.");
    }
    getChatTitle(id, history, token) {
      throw new Error("Method not implemented.");
    }
    hasChatParticipantDetectionProviders() {
      throw new Error("Method not implemented.");
    }
    registerChatParticipantDetectionProvider(handle, provider) {
      throw new Error("Method not implemented.");
    }
    detectAgentOrCommand(request, history, options, token) {
      throw new Error("Method not implemented.");
    }
  }
  class TestSpeechService {
    constructor() {
      this.onDidChangeHasSpeechProvider = Event.None;
      this.hasSpeechProvider = true;
      this.hasActiveSpeechToTextSession = false;
      this.hasActiveTextToSpeechSession = false;
      this.hasActiveKeywordRecognition = false;
      this.onDidStartSpeechToTextSession = Event.None;
      this.onDidEndSpeechToTextSession = Event.None;
      this.onDidStartTextToSpeechSession = Event.None;
      this.onDidEndTextToSpeechSession = Event.None;
      this.onDidStartKeywordRecognition = Event.None;
      this.onDidEndKeywordRecognition = Event.None;
    }
    registerSpeechProvider(identifier, provider) {
      throw new Error("Method not implemented.");
    }
    async createSpeechToTextSession(token) {
      return {
        onDidChange: emitter.event
      };
    }
    async createTextToSpeechSession(token) {
      return {
        onDidChange: Event.None,
        synthesize: async () => {
        }
      };
    }
    recognizeKeyword(token) {
      throw new Error("Method not implemented.");
    }
  }
  const disposables = new DisposableStore();
  let emitter;
  let service;
  let event;
  async function createSession(options) {
    const cts = new CancellationTokenSource();
    disposables.add(toDisposable(() => cts.dispose(true)));
    const session = await service.createVoiceChatSession(cts.token, options);
    disposables.add(session.onDidChange((e) => {
      event = e;
    }));
  }
  setup(() => {
    emitter = disposables.add(new Emitter());
    service = disposables.add(new VoiceChatService(new TestSpeechService(), new TestChatAgentService(), new MockContextKeyService()));
  });
  teardown(() => {
    disposables.clear();
  });
  test("Agent and slash command detection (useAgents: false)", async () => {
    await testAgentsAndSlashCommandsDetection({ usesAgents: false, model: {} });
  });
  test("Agent and slash command detection (useAgents: true)", async () => {
    await testAgentsAndSlashCommandsDetection({ usesAgents: true, model: {} });
  });
  async function testAgentsAndSlashCommandsDetection(options) {
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Started });
    assert.strictEqual(event?.status, SpeechToTextStatus.Started);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "Hello" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, "Hello");
    assert.strictEqual(event?.waitingForInput, void 0);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "Hello World" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, "Hello World");
    assert.strictEqual(event?.waitingForInput, void 0);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "Hello World" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, "Hello World");
    assert.strictEqual(event?.waitingForInput, void 0);
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, "At");
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At workspace" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace" : "At workspace");
    assert.strictEqual(event?.waitingForInput, options.usesAgents);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "at workspace" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace" : "at workspace");
    assert.strictEqual(event?.waitingForInput, options.usesAgents);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At workspace help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace help" : "At workspace help");
    assert.strictEqual(event?.waitingForInput, false);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At workspace help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace help" : "At workspace help");
    assert.strictEqual(event?.waitingForInput, false);
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At workspace, help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace help" : "At workspace, help");
    assert.strictEqual(event?.waitingForInput, false);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At workspace, help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace help" : "At workspace, help");
    assert.strictEqual(event?.waitingForInput, false);
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At Workspace. help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace help" : "At Workspace. help");
    assert.strictEqual(event?.waitingForInput, false);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At Workspace. help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace help" : "At Workspace. help");
    assert.strictEqual(event?.waitingForInput, false);
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "Slash fix" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace /fix" : "/fix");
    assert.strictEqual(event?.waitingForInput, true);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "Slash fix" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace /fix" : "/fix");
    assert.strictEqual(event?.waitingForInput, true);
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At code slash search help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@vscode /search help" : "At code slash search help");
    assert.strictEqual(event?.waitingForInput, false);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At code slash search help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, options.usesAgents ? "@vscode /search help" : "At code slash search help");
    assert.strictEqual(event?.waitingForInput, false);
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At code, slash search, help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@vscode /search help" : "At code, slash search, help");
    assert.strictEqual(event?.waitingForInput, false);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At code, slash search, help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, options.usesAgents ? "@vscode /search help" : "At code, slash search, help");
    assert.strictEqual(event?.waitingForInput, false);
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At code. slash, search help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@vscode /search help" : "At code. slash, search help");
    assert.strictEqual(event?.waitingForInput, false);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At code. slash search, help" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, options.usesAgents ? "@vscode /search help" : "At code. slash search, help");
    assert.strictEqual(event?.waitingForInput, false);
    await createSession(options);
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At workspace, for at workspace" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace for at workspace" : "At workspace, for at workspace");
    assert.strictEqual(event?.waitingForInput, false);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At workspace, for at workspace" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, options.usesAgents ? "@workspace for at workspace" : "At workspace, for at workspace");
    assert.strictEqual(event?.waitingForInput, false);
    if (options.usesAgents) {
      await createSession(options);
      emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At workspace" });
      assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
      assert.strictEqual(event?.text, "@workspace");
      assert.strictEqual(event?.waitingForInput, true);
      emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "slash" });
      assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
      assert.strictEqual(event?.text, "slash");
      assert.strictEqual(event?.waitingForInput, false);
      emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "slash fix" });
      assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
      assert.strictEqual(event?.text, "/fix");
      assert.strictEqual(event?.waitingForInput, true);
      emitter.fire({ status: SpeechToTextStatus.Recognized, text: "slash fix" });
      assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
      assert.strictEqual(event?.text, "/fix");
      assert.strictEqual(event?.waitingForInput, true);
      await createSession(options);
      emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At workspace" });
      assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
      assert.strictEqual(event?.text, "@workspace");
      assert.strictEqual(event?.waitingForInput, true);
      emitter.fire({ status: SpeechToTextStatus.Recognized, text: "slash fix" });
      assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
      assert.strictEqual(event?.text, "/fix");
      assert.strictEqual(event?.waitingForInput, true);
    }
  }
  test("waiting for input", async () => {
    await createSession({ usesAgents: true, model: {} });
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At workspace" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, "@workspace");
    assert.strictEqual(event.waitingForInput, true);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At workspace" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, "@workspace");
    assert.strictEqual(event.waitingForInput, true);
    await createSession({ usesAgents: true, model: {} });
    emitter.fire({ status: SpeechToTextStatus.Recognizing, text: "At workspace slash explain" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognizing);
    assert.strictEqual(event?.text, "@workspace /explain");
    assert.strictEqual(event.waitingForInput, true);
    emitter.fire({ status: SpeechToTextStatus.Recognized, text: "At workspace slash explain" });
    assert.strictEqual(event?.status, SpeechToTextStatus.Recognized);
    assert.strictEqual(event?.text, "@workspace /explain");
    assert.strictEqual(event.waitingForInput, true);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3ZvaWNlQ2hhdFNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFByb3ZpZGVyUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgTW9ja0NvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy90ZXN0L2NvbW1vbi9tb2NrS2V5YmluZGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJU3BlZWNoUHJvdmlkZXIsIElTcGVlY2hTZXJ2aWNlLCBJU3BlZWNoVG9UZXh0RXZlbnQsIElTcGVlY2hUb1RleHRTZXNzaW9uLCBJVGV4dFRvU3BlZWNoU2Vzc2lvbiwgS2V5d29yZFJlY29nbml0aW9uU3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMgfSBmcm9tICcuLi8uLi8uLi9zcGVlY2gvY29tbW9uL3NwZWVjaFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudCwgSUNoYXRBZ2VudENvbW1hbmQsIElDaGF0QWdlbnRDb21wbGV0aW9uSXRlbSwgSUNoYXRBZ2VudERhdGEsIElDaGF0QWdlbnRIaXN0b3J5RW50cnksIElDaGF0QWdlbnRJbXBsZW1lbnRhdGlvbiwgSUNoYXRBZ2VudE1ldGFkYXRhLCBJQ2hhdEFnZW50UmVxdWVzdCwgSUNoYXRBZ2VudFJlc3VsdCwgSUNoYXRBZ2VudFNlcnZpY2UsIElDaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlciwgSUNoYXRXZWxjb21lTWVzc2FnZUNvbnRlbnQgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ2hhdEZvbGxvd3VwLCBJQ2hhdFByb2dyZXNzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWb2ljZUNoYXRTZXNzaW9uT3B0aW9ucywgSVZvaWNlQ2hhdFRleHRFdmVudCwgVm9pY2VDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi92b2ljZUNoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5cbnN1aXRlKCdWb2ljZUNoYXQnLCAoKSA9PiB7XG5cblx0Y2xhc3MgVGVzdENoYXRBZ2VudENvbW1hbmQgaW1wbGVtZW50cyBJQ2hhdEFnZW50Q29tbWFuZCB7XG5cdFx0Y29uc3RydWN0b3IocmVhZG9ubHkgbmFtZTogc3RyaW5nLCByZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nKSB7IH1cblx0fVxuXG5cdGNsYXNzIFRlc3RDaGF0QWdlbnQgaW1wbGVtZW50cyBJQ2hhdEFnZW50IHtcblxuXHRcdGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyID0gbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXI7XG5cdFx0ZXh0ZW5zaW9uUHVibGlzaGVyID0gJyc7XG5cdFx0ZXh0ZW5zaW9uRGlzcGxheU5hbWUgPSAnJztcblx0XHRleHRlbnNpb25QdWJsaXNoZXJJZCA9ICcnO1xuXHRcdGxvY2F0aW9uczogQ2hhdEFnZW50TG9jYXRpb25bXSA9IFtDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbF07XG5cdFx0cHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcblx0XHRjb25zdHJ1Y3RvcihyZWFkb25seSBpZDogc3RyaW5nLCByZWFkb25seSBzbGFzaENvbW1hbmRzOiBJQ2hhdEFnZW50Q29tbWFuZFtdKSB7XG5cdFx0XHR0aGlzLm5hbWUgPSBpZDtcblx0XHR9XG5cdFx0ZnVsbE5hbWU/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0ZGVzY3JpcHRpb24/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0d2hlbj86IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRwdWJsaXNoZXJEaXNwbGF5TmFtZT86IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpc0RlZmF1bHQ/OiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRcdGlzRHluYW1pYz86IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdFx0ZGlzYW1iaWd1YXRpb246IHsgY2F0ZWdvcnk6IHN0cmluZzsgZGVzY3JpcHRpb246IHN0cmluZzsgZXhhbXBsZXM6IHN0cmluZ1tdIH1bXSA9IFtdO1xuXHRcdHByb3ZpZGVGb2xsb3d1cHM/KHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LCByZXN1bHQ6IElDaGF0QWdlbnRSZXN1bHQsIGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ2hhdEZvbGxvd3VwW10+IHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0XHR9XG5cdFx0cHJvdmlkZVNhbXBsZVF1ZXN0aW9ucz8obG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm92aWRlclJlc3VsdDxJQ2hhdEZvbGxvd3VwW10gfCB1bmRlZmluZWQ+IHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0XHR9XG5cdFx0aW52b2tlKHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LCBwcm9ncmVzczogKHBhcnQ6IElDaGF0UHJvZ3Jlc3MpID0+IHZvaWQsIGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ2hhdEFnZW50UmVzdWx0PiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRcdHByb3ZpZGVXZWxjb21lTWVzc2FnZT8odG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvdmlkZXJSZXN1bHQ8SUNoYXRXZWxjb21lTWVzc2FnZUNvbnRlbnQgfCB1bmRlZmluZWQ+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0bWV0YWRhdGEgPSB7fTtcblx0fVxuXG5cdGNvbnN0IGFnZW50czogSUNoYXRBZ2VudFtdID0gW1xuXHRcdG5ldyBUZXN0Q2hhdEFnZW50KCd3b3Jrc3BhY2UnLCBbXG5cdFx0XHRuZXcgVGVzdENoYXRBZ2VudENvbW1hbmQoJ2ZpeCcsICdmaXgnKSxcblx0XHRcdG5ldyBUZXN0Q2hhdEFnZW50Q29tbWFuZCgnZXhwbGFpbicsICdleHBsYWluJylcblx0XHRdKSxcblx0XHRuZXcgVGVzdENoYXRBZ2VudCgndnNjb2RlJywgW1xuXHRcdFx0bmV3IFRlc3RDaGF0QWdlbnRDb21tYW5kKCdzZWFyY2gnLCAnc2VhcmNoJylcblx0XHRdKSxcblx0XTtcblxuXHRjbGFzcyBUZXN0Q2hhdEFnZW50U2VydmljZSBpbXBsZW1lbnRzIElDaGF0QWdlbnRTZXJ2aWNlIHtcblx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdFx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBZ2VudHMgPSBFdmVudC5Ob25lO1xuXHRcdHJlZ2lzdGVyQWdlbnRJbXBsZW1lbnRhdGlvbihpZDogc3RyaW5nLCBhZ2VudDogSUNoYXRBZ2VudEltcGxlbWVudGF0aW9uKTogSURpc3Bvc2FibGUgeyB0aHJvdyBuZXcgRXJyb3IoKTsgfVxuXHRcdHJlZ2lzdGVyRHluYW1pY0FnZW50KGRhdGE6IElDaGF0QWdlbnREYXRhLCBhZ2VudEltcGw6IElDaGF0QWdlbnRJbXBsZW1lbnRhdGlvbik6IElEaXNwb3NhYmxlIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0aW52b2tlQWdlbnQoaWQ6IHN0cmluZywgcmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIHByb2dyZXNzOiAocGFydDogSUNoYXRQcm9ncmVzcykgPT4gdm9pZCwgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElDaGF0QWdlbnRSZXN1bHQ+IHsgdGhyb3cgbmV3IEVycm9yKCk7IH1cblx0XHRzZXRSZXF1ZXN0UGF1c2VkKGFnZW50OiBzdHJpbmcsIHJlcXVlc3RJZDogc3RyaW5nLCBpc1BhdXNlZDogYm9vbGVhbik6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cdFx0Z2V0Rm9sbG93dXBzKGlkOiBzdHJpbmcsIHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LCByZXN1bHQ6IElDaGF0QWdlbnRSZXN1bHQsIGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ2hhdEZvbGxvd3VwW10+IHsgdGhyb3cgbmV3IEVycm9yKCk7IH1cblx0XHRnZXRBY3RpdmF0ZWRBZ2VudHMoKTogSUNoYXRBZ2VudFtdIHsgcmV0dXJuIGFnZW50czsgfVxuXHRcdGdldEFnZW50cygpOiBJQ2hhdEFnZW50W10geyByZXR1cm4gYWdlbnRzOyB9XG5cdFx0Z2V0RGVmYXVsdEFnZW50KCk6IElDaGF0QWdlbnQgfCB1bmRlZmluZWQgeyB0aHJvdyBuZXcgRXJyb3IoKTsgfVxuXHRcdGdldENvbnRyaWJ1dGVkRGVmYXVsdEFnZW50KCk6IElDaGF0QWdlbnREYXRhIHwgdW5kZWZpbmVkIHsgdGhyb3cgbmV3IEVycm9yKCk7IH1cblx0XHRyZWdpc3RlckFnZW50KGlkOiBzdHJpbmcsIGRhdGE6IElDaGF0QWdlbnREYXRhKTogSURpc3Bvc2FibGUgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0XHRnZXRBZ2VudChpZDogc3RyaW5nKTogSUNoYXRBZ2VudERhdGEgfCB1bmRlZmluZWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0XHRnZXRBZ2VudHNCeU5hbWUobmFtZTogc3RyaW5nKTogSUNoYXRBZ2VudERhdGFbXSB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRcdHVwZGF0ZUFnZW50KGlkOiBzdHJpbmcsIHVwZGF0ZU1ldGFkYXRhOiBJQ2hhdEFnZW50TWV0YWRhdGEpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0Z2V0QWdlbnRCeUZ1bGx5UXVhbGlmaWVkSWQoaWQ6IHN0cmluZyk6IElDaGF0QWdlbnREYXRhIHwgdW5kZWZpbmVkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0cmVnaXN0ZXJBZ2VudENvbXBsZXRpb25Qcm92aWRlcihpZDogc3RyaW5nLCBwcm92aWRlcjogKHF1ZXJ5OiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4gUHJvbWlzZTxJQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW1bXT4pOiBJRGlzcG9zYWJsZSB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRcdGdldEFnZW50Q29tcGxldGlvbkl0ZW1zKGlkOiBzdHJpbmcsIHF1ZXJ5OiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUNoYXRBZ2VudENvbXBsZXRpb25JdGVtW10+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0YWdlbnRIYXNEdXBlTmFtZShpZDogc3RyaW5nKTogYm9vbGVhbiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRcdGdldENoYXRUaXRsZShpZDogc3RyaW5nLCBoaXN0b3J5OiBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5W10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRcdGhhc1Rvb2xzQWdlbnQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRoYXNDaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcnMoKTogYm9vbGVhbiB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdFx0fVxuXHRcdHJlZ2lzdGVyQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHByb3ZpZGVyOiBJQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdFx0fVxuXHRcdGRldGVjdEFnZW50T3JDb21tYW5kKHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LCBoaXN0b3J5OiBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5W10sIG9wdGlvbnM6IHsgbG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uIH0sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8eyBhZ2VudDogSUNoYXRBZ2VudERhdGE7IGNvbW1hbmQ/OiBJQ2hhdEFnZW50Q29tbWFuZCB9IHwgdW5kZWZpbmVkPiB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdFx0fVxuXHR9XG5cblx0Y2xhc3MgVGVzdFNwZWVjaFNlcnZpY2UgaW1wbGVtZW50cyBJU3BlZWNoU2VydmljZSB7XG5cdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdFx0b25EaWRDaGFuZ2VIYXNTcGVlY2hQcm92aWRlciA9IEV2ZW50Lk5vbmU7XG5cblx0XHRyZWFkb25seSBoYXNTcGVlY2hQcm92aWRlciA9IHRydWU7XG5cdFx0cmVhZG9ubHkgaGFzQWN0aXZlU3BlZWNoVG9UZXh0U2Vzc2lvbiA9IGZhbHNlO1xuXHRcdHJlYWRvbmx5IGhhc0FjdGl2ZVRleHRUb1NwZWVjaFNlc3Npb24gPSBmYWxzZTtcblx0XHRyZWFkb25seSBoYXNBY3RpdmVLZXl3b3JkUmVjb2duaXRpb24gPSBmYWxzZTtcblxuXHRcdHJlZ2lzdGVyU3BlZWNoUHJvdmlkZXIoaWRlbnRpZmllcjogc3RyaW5nLCBwcm92aWRlcjogSVNwZWVjaFByb3ZpZGVyKTogSURpc3Bvc2FibGUgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0XHRvbkRpZFN0YXJ0U3BlZWNoVG9UZXh0U2Vzc2lvbiA9IEV2ZW50Lk5vbmU7XG5cdFx0b25EaWRFbmRTcGVlY2hUb1RleHRTZXNzaW9uID0gRXZlbnQuTm9uZTtcblxuXHRcdGFzeW5jIGNyZWF0ZVNwZWVjaFRvVGV4dFNlc3Npb24odG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU3BlZWNoVG9UZXh0U2Vzc2lvbj4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0b25EaWRDaGFuZ2U6IGVtaXR0ZXIuZXZlbnRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0b25EaWRTdGFydFRleHRUb1NwZWVjaFNlc3Npb24gPSBFdmVudC5Ob25lO1xuXHRcdG9uRGlkRW5kVGV4dFRvU3BlZWNoU2Vzc2lvbiA9IEV2ZW50Lk5vbmU7XG5cblx0XHRhc3luYyBjcmVhdGVUZXh0VG9TcGVlY2hTZXNzaW9uKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVRleHRUb1NwZWVjaFNlc3Npb24+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRzeW50aGVzaXplOiBhc3luYyAoKSA9PiB7IH1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0b25EaWRTdGFydEtleXdvcmRSZWNvZ25pdGlvbiA9IEV2ZW50Lk5vbmU7XG5cdFx0b25EaWRFbmRLZXl3b3JkUmVjb2duaXRpb24gPSBFdmVudC5Ob25lO1xuXHRcdHJlY29nbml6ZUtleXdvcmQodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxLZXl3b3JkUmVjb2duaXRpb25TdGF0dXM+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdH1cblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0bGV0IGVtaXR0ZXI6IEVtaXR0ZXI8SVNwZWVjaFRvVGV4dEV2ZW50PjtcblxuXHRsZXQgc2VydmljZTogVm9pY2VDaGF0U2VydmljZTtcblx0bGV0IGV2ZW50OiBJVm9pY2VDaGF0VGV4dEV2ZW50IHwgdW5kZWZpbmVkO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVNlc3Npb24ob3B0aW9uczogSVZvaWNlQ2hhdFNlc3Npb25PcHRpb25zKSB7XG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBjdHMuZGlzcG9zZSh0cnVlKSkpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCBzZXJ2aWNlLmNyZWF0ZVZvaWNlQ2hhdFNlc3Npb24oY3RzLnRva2VuLCBvcHRpb25zKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2Vzc2lvbi5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdGV2ZW50ID0gZTtcblx0XHR9KSk7XG5cdH1cblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZW1pdHRlciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjxJU3BlZWNoVG9UZXh0RXZlbnQ+KCkpO1xuXHRcdHNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFZvaWNlQ2hhdFNlcnZpY2UobmV3IFRlc3RTcGVlY2hTZXJ2aWNlKCksIG5ldyBUZXN0Q2hhdEFnZW50U2VydmljZSgpLCBuZXcgTW9ja0NvbnRleHRLZXlTZXJ2aWNlKCkpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FnZW50IGFuZCBzbGFzaCBjb21tYW5kIGRldGVjdGlvbiAodXNlQWdlbnRzOiBmYWxzZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdEFnZW50c0FuZFNsYXNoQ29tbWFuZHNEZXRlY3Rpb24oeyB1c2VzQWdlbnRzOiBmYWxzZSwgbW9kZWw6IHt9IGFzIElDaGF0TW9kZWwgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FnZW50IGFuZCBzbGFzaCBjb21tYW5kIGRldGVjdGlvbiAodXNlQWdlbnRzOiB0cnVlKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0QWdlbnRzQW5kU2xhc2hDb21tYW5kc0RldGVjdGlvbih7IHVzZXNBZ2VudHM6IHRydWUsIG1vZGVsOiB7fSBhcyBJQ2hhdE1vZGVsIH0pO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiB0ZXN0QWdlbnRzQW5kU2xhc2hDb21tYW5kc0RldGVjdGlvbihvcHRpb25zOiBJVm9pY2VDaGF0U2Vzc2lvbk9wdGlvbnMpIHtcblxuXHRcdC8vIE5vdGhpbmcgdG8gZGV0ZWN0XG5cdFx0YXdhaXQgY3JlYXRlU2Vzc2lvbihvcHRpb25zKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlN0YXJ0ZWQgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5TdGFydGVkKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nLCB0ZXh0OiAnSGVsbG8nIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgJ0hlbGxvJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIHVuZGVmaW5lZCk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZywgdGV4dDogJ0hlbGxvIFdvcmxkJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsICdIZWxsbyBXb3JsZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCB1bmRlZmluZWQpO1xuXG5cdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCwgdGV4dDogJ0hlbGxvIFdvcmxkJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgJ0hlbGxvIFdvcmxkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIHVuZGVmaW5lZCk7XG5cblx0XHQvLyBBZ2VudFxuXHRcdGF3YWl0IGNyZWF0ZVNlc3Npb24ob3B0aW9ucyk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZywgdGV4dDogJ0F0JyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsICdBdCcpO1xuXG5cdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcsIHRleHQ6ICdBdCB3b3Jrc3BhY2UnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgb3B0aW9ucy51c2VzQWdlbnRzID8gJ0B3b3Jrc3BhY2UnIDogJ0F0IHdvcmtzcGFjZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCBvcHRpb25zLnVzZXNBZ2VudHMpO1xuXG5cdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcsIHRleHQ6ICdhdCB3b3Jrc3BhY2UnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgb3B0aW9ucy51c2VzQWdlbnRzID8gJ0B3b3Jrc3BhY2UnIDogJ2F0IHdvcmtzcGFjZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCBvcHRpb25zLnVzZXNBZ2VudHMpO1xuXG5cdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcsIHRleHQ6ICdBdCB3b3Jrc3BhY2UgaGVscCcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py50ZXh0LCBvcHRpb25zLnVzZXNBZ2VudHMgPyAnQHdvcmtzcGFjZSBoZWxwJyA6ICdBdCB3b3Jrc3BhY2UgaGVscCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCBmYWxzZSk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkLCB0ZXh0OiAnQXQgd29ya3NwYWNlIGhlbHAnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py50ZXh0LCBvcHRpb25zLnVzZXNBZ2VudHMgPyAnQHdvcmtzcGFjZSBoZWxwJyA6ICdBdCB3b3Jrc3BhY2UgaGVscCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCBmYWxzZSk7XG5cblx0XHQvLyBBZ2VudCB3aXRoIHB1bmN0dWF0aW9uXG5cdFx0YXdhaXQgY3JlYXRlU2Vzc2lvbihvcHRpb25zKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nLCB0ZXh0OiAnQXQgd29ya3NwYWNlLCBoZWxwJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsIG9wdGlvbnMudXNlc0FnZW50cyA/ICdAd29ya3NwYWNlIGhlbHAnIDogJ0F0IHdvcmtzcGFjZSwgaGVscCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCBmYWxzZSk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkLCB0ZXh0OiAnQXQgd29ya3NwYWNlLCBoZWxwJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgb3B0aW9ucy51c2VzQWdlbnRzID8gJ0B3b3Jrc3BhY2UgaGVscCcgOiAnQXQgd29ya3NwYWNlLCBoZWxwJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIGZhbHNlKTtcblxuXHRcdGF3YWl0IGNyZWF0ZVNlc3Npb24ob3B0aW9ucyk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZywgdGV4dDogJ0F0IFdvcmtzcGFjZS4gaGVscCcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py50ZXh0LCBvcHRpb25zLnVzZXNBZ2VudHMgPyAnQHdvcmtzcGFjZSBoZWxwJyA6ICdBdCBXb3Jrc3BhY2UuIGhlbHAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LndhaXRpbmdGb3JJbnB1dCwgZmFsc2UpO1xuXG5cdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCwgdGV4dDogJ0F0IFdvcmtzcGFjZS4gaGVscCcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsIG9wdGlvbnMudXNlc0FnZW50cyA/ICdAd29ya3NwYWNlIGhlbHAnIDogJ0F0IFdvcmtzcGFjZS4gaGVscCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCBmYWxzZSk7XG5cblx0XHQvLyBTbGFzaCBDb21tYW5kXG5cdFx0YXdhaXQgY3JlYXRlU2Vzc2lvbihvcHRpb25zKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nLCB0ZXh0OiAnU2xhc2ggZml4JyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsIG9wdGlvbnMudXNlc0FnZW50cyA/ICdAd29ya3NwYWNlIC9maXgnIDogJy9maXgnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LndhaXRpbmdGb3JJbnB1dCwgdHJ1ZSk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkLCB0ZXh0OiAnU2xhc2ggZml4JyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgb3B0aW9ucy51c2VzQWdlbnRzID8gJ0B3b3Jrc3BhY2UgL2ZpeCcgOiAnL2ZpeCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCB0cnVlKTtcblxuXHRcdC8vIEFnZW50ICsgU2xhc2ggQ29tbWFuZFxuXHRcdGF3YWl0IGNyZWF0ZVNlc3Npb24ob3B0aW9ucyk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZywgdGV4dDogJ0F0IGNvZGUgc2xhc2ggc2VhcmNoIGhlbHAnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgb3B0aW9ucy51c2VzQWdlbnRzID8gJ0B2c2NvZGUgL3NlYXJjaCBoZWxwJyA6ICdBdCBjb2RlIHNsYXNoIHNlYXJjaCBoZWxwJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIGZhbHNlKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQsIHRleHQ6ICdBdCBjb2RlIHNsYXNoIHNlYXJjaCBoZWxwJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgb3B0aW9ucy51c2VzQWdlbnRzID8gJ0B2c2NvZGUgL3NlYXJjaCBoZWxwJyA6ICdBdCBjb2RlIHNsYXNoIHNlYXJjaCBoZWxwJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIGZhbHNlKTtcblxuXHRcdC8vIEFnZW50ICsgU2xhc2ggQ29tbWFuZCB3aXRoIHB1bmN0dWF0aW9uXG5cdFx0YXdhaXQgY3JlYXRlU2Vzc2lvbihvcHRpb25zKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nLCB0ZXh0OiAnQXQgY29kZSwgc2xhc2ggc2VhcmNoLCBoZWxwJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsIG9wdGlvbnMudXNlc0FnZW50cyA/ICdAdnNjb2RlIC9zZWFyY2ggaGVscCcgOiAnQXQgY29kZSwgc2xhc2ggc2VhcmNoLCBoZWxwJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIGZhbHNlKTtcblxuXHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQsIHRleHQ6ICdBdCBjb2RlLCBzbGFzaCBzZWFyY2gsIGhlbHAnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py50ZXh0LCBvcHRpb25zLnVzZXNBZ2VudHMgPyAnQHZzY29kZSAvc2VhcmNoIGhlbHAnIDogJ0F0IGNvZGUsIHNsYXNoIHNlYXJjaCwgaGVscCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCBmYWxzZSk7XG5cblx0XHRhd2FpdCBjcmVhdGVTZXNzaW9uKG9wdGlvbnMpO1xuXG5cdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcsIHRleHQ6ICdBdCBjb2RlLiBzbGFzaCwgc2VhcmNoIGhlbHAnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgb3B0aW9ucy51c2VzQWdlbnRzID8gJ0B2c2NvZGUgL3NlYXJjaCBoZWxwJyA6ICdBdCBjb2RlLiBzbGFzaCwgc2VhcmNoIGhlbHAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LndhaXRpbmdGb3JJbnB1dCwgZmFsc2UpO1xuXG5cdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCwgdGV4dDogJ0F0IGNvZGUuIHNsYXNoIHNlYXJjaCwgaGVscCcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsIG9wdGlvbnMudXNlc0FnZW50cyA/ICdAdnNjb2RlIC9zZWFyY2ggaGVscCcgOiAnQXQgY29kZS4gc2xhc2ggc2VhcmNoLCBoZWxwJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIGZhbHNlKTtcblxuXHRcdC8vIEFnZW50IG5vdCBkZXRlY3RlZCB0d2ljZVxuXHRcdGF3YWl0IGNyZWF0ZVNlc3Npb24ob3B0aW9ucyk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZywgdGV4dDogJ0F0IHdvcmtzcGFjZSwgZm9yIGF0IHdvcmtzcGFjZScgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py50ZXh0LCBvcHRpb25zLnVzZXNBZ2VudHMgPyAnQHdvcmtzcGFjZSBmb3IgYXQgd29ya3NwYWNlJyA6ICdBdCB3b3Jrc3BhY2UsIGZvciBhdCB3b3Jrc3BhY2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LndhaXRpbmdGb3JJbnB1dCwgZmFsc2UpO1xuXG5cdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCwgdGV4dDogJ0F0IHdvcmtzcGFjZSwgZm9yIGF0IHdvcmtzcGFjZScgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsIG9wdGlvbnMudXNlc0FnZW50cyA/ICdAd29ya3NwYWNlIGZvciBhdCB3b3Jrc3BhY2UnIDogJ0F0IHdvcmtzcGFjZSwgZm9yIGF0IHdvcmtzcGFjZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCBmYWxzZSk7XG5cblx0XHQvLyBTbGFzaCBjb21tYW5kIGRldGVjdGVkIGFmdGVyIGFnZW50IHJlY29nbml6ZWRcblx0XHRpZiAob3B0aW9ucy51c2VzQWdlbnRzKSB7XG5cdFx0XHRhd2FpdCBjcmVhdGVTZXNzaW9uKG9wdGlvbnMpO1xuXG5cdFx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkLCB0ZXh0OiAnQXQgd29ya3NwYWNlJyB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsICdAd29ya3NwYWNlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LndhaXRpbmdGb3JJbnB1dCwgdHJ1ZSk7XG5cblx0XHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nLCB0ZXh0OiAnc2xhc2gnIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsICdzbGFzaCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIGZhbHNlKTtcblxuXHRcdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmcsIHRleHQ6ICdzbGFzaCBmaXgnIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsICcvZml4Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LndhaXRpbmdGb3JJbnB1dCwgdHJ1ZSk7XG5cblx0XHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQsIHRleHQ6ICdzbGFzaCBmaXgnIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py5zdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgJy9maXgnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8ud2FpdGluZ0ZvcklucHV0LCB0cnVlKTtcblxuXHRcdFx0YXdhaXQgY3JlYXRlU2Vzc2lvbihvcHRpb25zKTtcblxuXHRcdFx0ZW1pdHRlci5maXJlKHsgc3RhdHVzOiBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCwgdGV4dDogJ0F0IHdvcmtzcGFjZScgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py50ZXh0LCAnQHdvcmtzcGFjZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py53YWl0aW5nRm9ySW5wdXQsIHRydWUpO1xuXG5cdFx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkLCB0ZXh0OiAnc2xhc2ggZml4JyB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsICcvZml4Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LndhaXRpbmdGb3JJbnB1dCwgdHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0dGVzdCgnd2FpdGluZyBmb3IgaW5wdXQnLCBhc3luYyAoKSA9PiB7XG5cblx0XHQvLyBBZ2VudFxuXHRcdGF3YWl0IGNyZWF0ZVNlc3Npb24oeyB1c2VzQWdlbnRzOiB0cnVlLCBtb2RlbDoge30gYXMgSUNoYXRNb2RlbCB9KTtcblxuXHRcdGVtaXR0ZXIuZmlyZSh7IHN0YXR1czogU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nLCB0ZXh0OiAnQXQgd29ya3NwYWNlJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsICdAd29ya3NwYWNlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LndhaXRpbmdGb3JJbnB1dCwgdHJ1ZSk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkLCB0ZXh0OiAnQXQgd29ya3NwYWNlJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8udGV4dCwgJ0B3b3Jrc3BhY2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQud2FpdGluZ0ZvcklucHV0LCB0cnVlKTtcblxuXHRcdC8vIFNsYXNoIENvbW1hbmRcblx0XHRhd2FpdCBjcmVhdGVTZXNzaW9uKHsgdXNlc0FnZW50czogdHJ1ZSwgbW9kZWw6IHt9IGFzIElDaGF0TW9kZWwgfSk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemluZywgdGV4dDogJ0F0IHdvcmtzcGFjZSBzbGFzaCBleHBsYWluJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnN0YXR1cywgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LnRleHQsICdAd29ya3NwYWNlIC9leHBsYWluJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LndhaXRpbmdGb3JJbnB1dCwgdHJ1ZSk7XG5cblx0XHRlbWl0dGVyLmZpcmUoeyBzdGF0dXM6IFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkLCB0ZXh0OiAnQXQgd29ya3NwYWNlIHNsYXNoIGV4cGxhaW4nIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudD8uc3RhdHVzLCBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Py50ZXh0LCAnQHdvcmtzcGFjZSAvZXhwbGFpbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC53YWl0aW5nRm9ySW5wdXQsIHRydWUpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGlCQUE4QixvQkFBb0I7QUFDM0QsU0FBUywrQ0FBK0M7QUFHeEQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBb0ksMEJBQTBCO0FBSTlKLFNBQXdELHdCQUF3QjtBQUNoRixTQUFTLHlCQUF5QjtBQUVsQyxNQUFNLGFBQWEsTUFBTTtBQUFBLEVBRXhCLE1BQU0scUJBQWtEO0FBQUEsSUFDdkQs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
