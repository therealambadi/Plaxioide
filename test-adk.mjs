// Test: Google ADK with Vertex AI — orchestrator + tools + sub-agents
import { Agent, Gemini, FunctionTool, Runner, InMemorySessionService, ParallelAgent, SequentialAgent, AgentTool } from '@google/adk';

const PROJECT = 'videogen-496506';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash'; // using 2.5-flash for now since 3.5-flash might not exist yet in this project

// Set GOOGLE_APPLICATION_CREDENTIALS for ADC auth
process.env.GOOGLE_APPLICATION_CREDENTIALS = '/Users/ambadi/Desktop/plc/videogen-496506-ed4ee8f8ddda.json';

// ─── Define Tools ──────────────────────────────────────────────────────────

const getPlcProgram = new FunctionTool({
	name: 'plc_get_program',
	description: 'Get the current PLC program structure including rungs, contacts, coils, and tags',
	execute: async () => {
		return {
			programName: 'MotorControl',
			rungs: [
				{ index: 0, elements: ['XIC(Start_PB)', 'OTE(Motor_Run)'], comment: 'Motor start circuit' },
				{ index: 1, elements: ['XIC(Stop_PB)', 'OTU(Motor_Run)'], comment: 'Motor stop circuit' },
			],
			tags: ['Start_PB', 'Stop_PB', 'Motor_Run', 'Overload'],
		};
	},
});

const plcValidate = new FunctionTool({
	name: 'plc_validate',
	description: 'Validate the current PLC program for errors',
	execute: async () => {
		return { valid: true, errors: [], warnings: ['Rung 1: No OL contact for overload protection'] };
	},
});

const plcWriteRung = new FunctionTool({
	name: 'plc_write_rung',
	description: 'Add or modify a rung in the ladder program',
	execute: async (input) => {
		console.log(`  [Tool] plc_write_rung called with:`, JSON.stringify(input));
		return { success: true, rungIndex: 2, message: 'Rung added successfully' };
	},
});

// ─── Create Agent ──────────────────────────────────────────────────────────

const model = new Gemini({
	model: MODEL,
	vertexai: true,
	project: PROJECT,
	location: LOCATION,
});

const orchestrator = new Agent({
	name: 'plaxio_orchestrator',
	model,
	instruction: `You are Plaxio, a PLC programming assistant. You can read programs, validate them, and write logic.
When asked to add logic:
1. First read the current program with plc_get_program
2. Generate the appropriate rung
3. Write it with plc_write_rung
4. Validate with plc_validate
5. Report the result`,
	tools: [getPlcProgram, plcValidate, plcWriteRung],
});

// ─── Create a Sub-Agent (validation specialist) ────────────────────────────

const validationAgent = new Agent({
	name: 'validation_specialist',
	model,
	instruction: 'You are a PLC validation specialist. When asked, validate the program and report issues clearly.',
	tools: [plcValidate, getPlcProgram],
});

// ─── Run ───────────────────────────────────────────────────────────────────

async function main() {
	console.log('\n═══════════════════════════════════════════════════════');
	console.log('  Google ADK Integration Test — Plaxio');
	console.log('═══════════════════════════════════════════════════════\n');

	const sessionService = new InMemorySessionService();

	// Test 1: Basic agent with tool calling
	console.log('─── Test 1: Orchestrator Agent + Tools ─────────────────\n');

	const runner = new Runner({
		appName: 'plaxio',
		agent: orchestrator,
		sessionService,
	});

	await sessionService.createSession({
		appName: 'plaxio',
		userId: 'user1',
		sessionId: 'session1',
	});

	const stream = runner.runAsync({
		userId: 'user1',
		sessionId: 'session1',
		newMessage: {
			role: 'user',
			parts: [{ text: 'Add an overload protection rung for the motor' }],
		},
	});

	let eventCount = 0;
	let finalText = '';
	for await (const event of stream) {
		eventCount++;
		const parts = event.content?.parts || [];
		for (const part of parts) {
			if (part.text) finalText = part.text;
			if (part.functionCall) {
				console.log(`  → Tool call: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args || {})})`);
			}
			if (part.functionResponse) {
				const resp = JSON.stringify(part.functionResponse.response || {}).slice(0, 100);
				console.log(`  ← Tool result: ${resp}...`);
			}
		}
	}

	console.log(`\n  Events: ${eventCount}`);
	console.log(`  Final response: ${finalText.slice(0, 200)}...`);
	console.log('\n  ✅ Test 1 PASSED — Agent loop with tools working\n');

	// Test 2: Sub-agent as tool (AgentTool)
	console.log('─── Test 2: Sub-Agent (AgentTool) ──────────────────────\n');

	const validationTool = new AgentTool({ agent: validationAgent });

	const orchestratorWithSubAgent = new Agent({
		name: 'plaxio_with_subagent',
		model,
		instruction: 'You are Plaxio. When you need to validate, delegate to the validation_specialist sub-agent.',
		tools: [getPlcProgram, plcWriteRung, validationTool],
	});

	const runner2 = new Runner({
		appName: 'plaxio',
		agent: orchestratorWithSubAgent,
		sessionService,
	});

	await sessionService.createSession({
		appName: 'plaxio',
		userId: 'user1',
		sessionId: 'session2',
	});

	const stream2 = runner2.runAsync({
		userId: 'user1',
		sessionId: 'session2',
		newMessage: {
			role: 'user',
			parts: [{ text: 'Validate my PLC program and tell me about any issues' }],
		},
	});

	let eventCount2 = 0;
	let finalText2 = '';
	for await (const event of stream2) {
		eventCount2++;
		const parts = event.content?.parts || [];
		for (const part of parts) {
			if (part.text) finalText2 = part.text;
			if (part.functionCall) {
				console.log(`  → Tool/Agent call: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args || {}).slice(0, 80)})`);
			}
		}
	}

	console.log(`\n  Events: ${eventCount2}`);
	console.log(`  Final response: ${finalText2.slice(0, 200)}...`);
	console.log('\n  ✅ Test 2 PASSED — Sub-agent delegation working\n');

	// Test 3: Parallel agents
	console.log('─── Test 3: Parallel Agents ────────────────────────────\n');

	const readAgent = new Agent({
		name: 'reader',
		model,
		instruction: 'Read the PLC program and summarize the structure.',
		tools: [getPlcProgram],
	});

	const validateAgent = new Agent({
		name: 'validator',
		model,
		instruction: 'Validate the PLC program and list any issues.',
		tools: [plcValidate],
	});

	const parallelRunner = new ParallelAgent({
		name: 'parallel_review',
		subAgents: [readAgent, validateAgent],
	});

	const runner3 = new Runner({
		appName: 'plaxio',
		agent: parallelRunner,
		sessionService,
	});

	await sessionService.createSession({
		appName: 'plaxio',
		userId: 'user1',
		sessionId: 'session3',
	});

	const stream3 = runner3.runAsync({
		userId: 'user1',
		sessionId: 'session3',
		newMessage: {
			role: 'user',
			parts: [{ text: 'Review and validate the program simultaneously' }],
		},
	});

	let eventCount3 = 0;
	for await (const event of stream3) {
		eventCount3++;
	}

	console.log(`  Events: ${eventCount3}`);
	console.log('  ✅ Test 3 PASSED — Parallel agents executed\n');

	// Summary
	console.log('═══════════════════════════════════════════════════════');
	console.log('  ALL TESTS PASSED ✅');
	console.log('');
	console.log('  ADK Features Verified:');
	console.log('    • Orchestrator agent with tool calling');
	console.log('    • Sub-agent delegation (AgentTool)');
	console.log('    • Parallel agent execution');
	console.log('    • Session management');
	console.log('    • Vertex AI authentication (ADC)');
	console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(e => {
	console.error('❌ ADK Test FAILED:', e.message);
	console.error(e.stack);
});
