// Full Pipeline Test: Verify the complete Plaxio AI pipeline
// Model (Gemini 3.5-flash via Vertex) → Tool calling → Sub-agents → Response
import { Agent, Gemini, FunctionTool, Runner, InMemorySessionService, ParallelAgent, AgentTool, SequentialAgent } from '@google/adk';

const PROJECT = 'videogen-496506';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash'; // Will be gemini-3.5-flash once available in this project

process.env.GOOGLE_APPLICATION_CREDENTIALS = '/Users/ambadi/Desktop/plc/videogen-496506-ed4ee8f8ddda.json';

// ═══════════════════════════════════════════════════════════════════════════════
// Simulate the REAL PLC tools (same as what's in prompts.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const plcState = {
	program: {
		ladderProgram: {
			rungs: [
				{ index: 0, contacts: [{ name: 'Start_PB', type: 'NO' }], coils: [{ name: 'Motor_Run', type: 'normal' }], comment: 'Motor start' },
				{ index: 1, contacts: [{ name: 'Stop_PB', type: 'NC' }], coils: [{ name: 'Motor_Run', type: 'unlatch' }], comment: 'Motor stop' },
			]
		}
	},
	tags: [
		{ name: 'Start_PB', dataType: 'BOOL', description: 'Start pushbutton' },
		{ name: 'Stop_PB', dataType: 'BOOL', description: 'Stop pushbutton' },
		{ name: 'Motor_Run', dataType: 'BOOL', description: 'Motor running output' },
	]
};

// Tool: plc_get_program
const plcGetProgram = new FunctionTool({
	name: 'plc_get_program',
	description: 'Get the current PLC program structure including rungs, contacts, coils, and tags',
	execute: async () => JSON.stringify(plcState.program),
});

// Tool: plc_validate
const plcValidate = new FunctionTool({
	name: 'plc_validate',
	description: 'Validate the current PLC program for errors and warnings',
	execute: async () => {
		const issues = [];
		const hasOL = plcState.program.ladderProgram.rungs.some(r =>
			r.contacts?.some(c => c.name === 'Overload_Trip')
		);
		if (!hasOL) issues.push({ message: 'No overload protection contact found', severity: 'warn', location: 'Program' });
		return JSON.stringify({ issues });
	},
});

// Tool: plc_write_program
const plcWriteProgram = new FunctionTool({
	name: 'plc_write_program',
	description: 'Writes a PLC program JSON into the live editor. Pass a JSON object with ladderProgram key.',
	execute: async (input) => {
		try {
			const data = typeof input === 'string' ? JSON.parse(input) : input;
			const programJson = data.programJson || data;
			const parsed = typeof programJson === 'string' ? JSON.parse(programJson) : programJson;
			if (parsed.ladderProgram) {
				plcState.program.ladderProgram = parsed.ladderProgram;
			}
			console.log(`  [plc_write_program] Updated program — now ${plcState.program.ladderProgram.rungs.length} rungs`);
			return JSON.stringify({ ok: true, validationIssues: [] });
		} catch (e) {
			return JSON.stringify({ ok: false, validationIssues: [{ message: e.message, severity: 'error' }] });
		}
	},
});

// Tool: plc_set_tag_database
const plcSetTagDatabase = new FunctionTool({
	name: 'plc_set_tag_database',
	description: 'Replaces the tag database. Pass an array of tag objects as JSON.',
	execute: async (input) => {
		try {
			const data = typeof input === 'string' ? JSON.parse(input) : input;
			const tagsJson = data.tagsJson || data;
			const tags = typeof tagsJson === 'string' ? JSON.parse(tagsJson) : tagsJson;
			plcState.tags = Array.isArray(tags) ? tags : plcState.tags;
			console.log(`  [plc_set_tag_database] Set ${plcState.tags.length} tags`);
			return JSON.stringify({ ok: true, tagCount: plcState.tags.length });
		} catch (e) {
			return JSON.stringify({ ok: false, tagCount: 0 });
		}
	},
});

// Tool: plc_export_st
const plcExportSt = new FunctionTool({
	name: 'plc_export_st',
	description: 'Compiles the current graphical PLC program to IEC 61131-3 Structured Text',
	execute: async () => {
		const rungs = plcState.program.ladderProgram.rungs;
		let st = 'PROGRAM MotorControl\nVAR\n';
		for (const tag of plcState.tags) st += `  ${tag.name} : ${tag.dataType};\n`;
		st += 'END_VAR\n\n';
		for (const rung of rungs) {
			st += `(* ${rung.comment} *)\n`;
			const contacts = (rung.contacts || []).map(c => c.type === 'NC' ? `NOT ${c.name}` : c.name).join(' AND ');
			const coils = (rung.coils || []).map(c => c.name);
			for (const coil of coils) st += `${coil} := ${contacts};\n`;
		}
		st += '\nEND_PROGRAM\n';
		return JSON.stringify({ stCode: st, filename: 'MotorControl.st' });
	},
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════════════

const model = new Gemini({ model: MODEL, vertexai: true, project: PROJECT, location: LOCATION });
const allTools = [plcGetProgram, plcValidate, plcWriteProgram, plcSetTagDatabase, plcExportSt];

async function test1_SingleAgentToolLoop() {
	console.log('\n─── TEST 1: Single Agent Tool Loop (Read → Write → Validate) ───\n');

	const orchestrator = new Agent({
		name: 'plaxio',
		model,
		instruction: `You are Plaxio, a PLC programming AI. Follow this workflow:
1. Read the current program with plc_get_program
2. Make the requested change using plc_write_program
3. Validate with plc_validate
4. Report the result concisely`,
		tools: allTools,
	});

	const sessionService = new InMemorySessionService();
	const runner = new Runner({ appName: 'plaxio', agent: orchestrator, sessionService });
	await sessionService.createSession({ appName: 'plaxio', userId: 'test', sessionId: 'test1' });

	const events = [];
	const stream = runner.runAsync({
		userId: 'test', sessionId: 'test1',
		newMessage: { role: 'user', parts: [{ text: 'Add an overload protection rung: if Overload_Trip is true, unlatch Motor_Run. Also add Overload_Trip to the tag database as a BOOL input.' }] },
	});

	for await (const event of stream) {
		events.push(event);
		const parts = event.content?.parts || [];
		for (const part of parts) {
			if (part.functionCall) console.log(`  → ${part.functionCall.name}()`);
			if (part.functionResponse) console.log(`  ← result received`);
		}
	}

	const finalEvent = events[events.length - 1];
	const finalText = finalEvent?.content?.parts?.find(p => p.text)?.text || '';
	console.log(`\n  Final: ${finalText.slice(0, 200)}`);
	console.log(`  Program now has ${plcState.program.ladderProgram.rungs.length} rungs`);
	console.log(`  Tags: ${plcState.tags.map(t => t.name).join(', ')}`);

	const passed = plcState.program.ladderProgram.rungs.length >= 3 || plcState.tags.some(t => t.name.includes('Overload'));
	console.log(`\n  ${passed ? '✅' : '❌'} Test 1: ${passed ? 'PASSED' : 'FAILED'} — AI autonomously modified the program`);
	return passed;
}

async function test2_SubAgentDelegation() {
	console.log('\n─── TEST 2: Sub-Agent Delegation (Orchestrator → Specialist) ───\n');

	const validationSpecialist = new Agent({
		name: 'validation_specialist',
		model,
		instruction: 'You are a PLC safety validation specialist. Read the program, validate it, and provide a detailed safety assessment.',
		tools: [plcGetProgram, plcValidate],
	});

	const exportSpecialist = new Agent({
		name: 'export_specialist',
		model,
		instruction: 'You are a PLC export specialist. Export the program to Structured Text and report the result.',
		tools: [plcExportSt, plcGetProgram],
	});

	const validationTool = new AgentTool({ agent: validationSpecialist });
	const exportTool = new AgentTool({ agent: exportSpecialist });

	const orchestrator = new Agent({
		name: 'plaxio_orchestrator',
		model,
		instruction: `You are Plaxio's orchestrator. When asked to review and export:
1. Delegate validation to the validation_specialist
2. Delegate export to the export_specialist
3. Summarize both results for the user`,
		tools: [validationTool, exportTool, plcGetProgram],
	});

	const sessionService = new InMemorySessionService();
	const runner = new Runner({ appName: 'plaxio', agent: orchestrator, sessionService });
	await sessionService.createSession({ appName: 'plaxio', userId: 'test', sessionId: 'test2' });

	const events = [];
	const stream = runner.runAsync({
		userId: 'test', sessionId: 'test2',
		newMessage: { role: 'user', parts: [{ text: 'Review my program for safety issues and then export it to Structured Text' }] },
	});

	let agentCalls = 0;
	for await (const event of stream) {
		events.push(event);
		const parts = event.content?.parts || [];
		for (const part of parts) {
			if (part.functionCall) {
				console.log(`  → ${part.functionCall.name}()`);
				if (part.functionCall.name.includes('specialist')) agentCalls++;
			}
		}
	}

	const finalText = events[events.length - 1]?.content?.parts?.find(p => p.text)?.text || '';
	console.log(`\n  Final: ${finalText.slice(0, 300)}`);
	console.log(`  Sub-agent delegations: ${agentCalls}`);

	const passed = agentCalls >= 1;
	console.log(`\n  ${passed ? '✅' : '❌'} Test 2: ${passed ? 'PASSED' : 'FAILED'} — Sub-agents were used`);
	return passed;
}

async function test3_ParallelAgents() {
	console.log('\n─── TEST 3: Parallel Agents (Simultaneous read + validate) ───\n');

	const readerAgent = new Agent({
		name: 'reader',
		model,
		instruction: 'Read the PLC program and summarize the structure (number of rungs, tags used).',
		tools: [plcGetProgram],
	});

	const validatorAgent = new Agent({
		name: 'validator',
		model,
		instruction: 'Validate the PLC program and list all issues found.',
		tools: [plcValidate],
	});

	const parallelReview = new ParallelAgent({
		name: 'parallel_review',
		subAgents: [readerAgent, validatorAgent],
	});

	const sessionService = new InMemorySessionService();
	const runner = new Runner({ appName: 'plaxio', agent: parallelReview, sessionService });
	await sessionService.createSession({ appName: 'plaxio', userId: 'test', sessionId: 'test3' });

	const startTime = Date.now();
	const stream = runner.runAsync({
		userId: 'test', sessionId: 'test3',
		newMessage: { role: 'user', parts: [{ text: 'Review and validate the program simultaneously' }] },
	});

	let eventCount = 0;
	for await (const event of stream) { eventCount++; }
	const elapsed = Date.now() - startTime;

	console.log(`  Events: ${eventCount}, Time: ${elapsed}ms`);
	const passed = eventCount >= 2;
	console.log(`\n  ${passed ? '✅' : '❌'} Test 3: ${passed ? 'PASSED' : 'FAILED'} — Parallel execution completed`);
	return passed;
}

async function test4_SequentialPipeline() {
	console.log('\n─── TEST 4: Sequential Pipeline (Read → Validate → Export) ───\n');

	const readStep = new Agent({
		name: 'step1_read',
		model,
		instruction: 'Read the current PLC program and briefly describe it.',
		tools: [plcGetProgram],
	});

	const validateStep = new Agent({
		name: 'step2_validate',
		model,
		instruction: 'Validate the PLC program and report issues.',
		tools: [plcValidate],
	});

	const exportStep = new Agent({
		name: 'step3_export',
		model,
		instruction: 'Export the program to Structured Text.',
		tools: [plcExportSt],
	});

	const pipeline = new SequentialAgent({
		name: 'review_pipeline',
		subAgents: [readStep, validateStep, exportStep],
	});

	const sessionService = new InMemorySessionService();
	const runner = new Runner({ appName: 'plaxio', agent: pipeline, sessionService });
	await sessionService.createSession({ appName: 'plaxio', userId: 'test', sessionId: 'test4' });

	const stream = runner.runAsync({
		userId: 'test', sessionId: 'test4',
		newMessage: { role: 'user', parts: [{ text: 'Review the program step by step' }] },
	});

	let eventCount = 0;
	for await (const event of stream) {
		eventCount++;
		const parts = event.content?.parts || [];
		for (const part of parts) {
			if (part.functionCall) console.log(`  → ${part.functionCall.name}()`);
		}
	}

	console.log(`  Events: ${eventCount}`);
	const passed = eventCount >= 3;
	console.log(`\n  ${passed ? '✅' : '❌'} Test 4: ${passed ? 'PASSED' : 'FAILED'} — Sequential pipeline completed`);
	return passed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Run All
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
	console.log('═══════════════════════════════════════════════════════════════════');
	console.log('  Plaxio AI Pipeline — Full Integration Test');
	console.log('  Model: gemini-2.5-flash (Vertex AI)');
	console.log('  ADK Features: Tools, Sub-agents, Parallel, Sequential');
	console.log('═══════════════════════════════════════════════════════════════════');

	const results = [];
	results.push(await test1_SingleAgentToolLoop());
	results.push(await test2_SubAgentDelegation());
	results.push(await test3_ParallelAgents());
	results.push(await test4_SequentialPipeline());

	console.log('\n═══════════════════════════════════════════════════════════════════');
	console.log(`  RESULTS: ${results.filter(Boolean).length}/${results.length} tests passed`);
	console.log('');
	console.log('  Features verified:');
	console.log(`    ${results[0] ? '✅' : '❌'} Single-agent tool loop (read → write → validate)`);
	console.log(`    ${results[1] ? '✅' : '❌'} Sub-agent delegation (orchestrator → specialists)`);
	console.log(`    ${results[2] ? '✅' : '❌'} Parallel agent execution`);
	console.log(`    ${results[3] ? '✅' : '❌'} Sequential pipeline`);
	console.log('═══════════════════════════════════════════════════════════════════\n');

	if (!results.every(Boolean)) process.exit(1);
}

main().catch(e => { console.error('❌ FATAL:', e.message, e.stack); process.exit(1); });
