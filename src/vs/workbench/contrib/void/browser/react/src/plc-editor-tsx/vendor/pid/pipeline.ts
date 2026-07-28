/**
 * P&ID → ST Code End-to-End Pipeline
 *
 * Orchestrates the full flow:
 *   1. Image → Gemini Vision → PIDParseResult (instruments, loops, interlocks)
 *   2. PIDParseResult → ST code generation (variables, rungs, control logic)
 *   3. ST code → workbench file population (main.st, io_list.csv, diagram.json)
 *
 * This is the core differentiator: "photograph a P&ID, get working PLC code."
 */

import { parsePIDImage, parsePIDDescription, generateCodeFromPID } from './parser.js';
import type {
  PIDParseResult,
  PIDCodeGenRequest,
  PIDCodeGenResult,
  PIDInstrument,
  PIDValve,
  PIDPump,
  PIDControlLoop,
  PIDInterlock,
} from './types.js';

// ─── Pipeline Types ──────────────────────────────────────────────────────────

export interface PIDPipelineInput {
  imageBase64?: string;
  mimeType?: string;
  textDescription?: string;
  targetVendor?: string;
  safetyLevel?: 'SIL1' | 'SIL2' | 'SIL3' | 'none';
  scanTime?: string;
  controlStrategy?: string;
}

export interface PIDPipelineResult {
  success: boolean;
  parseResult: PIDParseResult;
  codeResult: PIDCodeGenResult | null;
  files: GeneratedFile[];
  summary: PipelineSummary;
  error?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  description: string;
}

export interface PipelineSummary {
  instrumentCount: number;
  valveCount: number;
  pumpCount: number;
  controlLoopCount: number;
  interlockCount: number;
  ioCount: {
    digitalInputs: number;
    digitalOutputs: number;
    analogInputs: number;
    analogOutputs: number;
  };
  confidence: number;
  warnings: string[];
}

export type AIVisionProvider = (prompt: string, image?: { data: string; mimeType: string }) => Promise<string>;

// ─── Pipeline Execution ──────────────────────────────────────────────────────

/**
 * Execute the full P&ID → ST pipeline.
 *
 * @param input - Image or text description of the P&ID
 * @param aiProvider - Vision-capable AI provider function
 * @returns Complete pipeline result with generated files
 */
export async function executePIDPipeline(
  input: PIDPipelineInput,
  aiProvider: AIVisionProvider,
): Promise<PIDPipelineResult> {
  // Step 1: Parse the P&ID (image or description)
  let parseResult: PIDParseResult;

  if (input.imageBase64 && input.mimeType) {
    parseResult = await parsePIDImage(input.imageBase64, input.mimeType, aiProvider);
  } else if (input.textDescription) {
    parseResult = await parsePIDDescription(input.textDescription, aiProvider);
  } else {
    return {
      success: false,
      parseResult: {
        elements: [],
        controlLoops: [],
        interlocks: [],
        pipes: [],
        confidence: 0,
        warnings: ['No input provided'],
      },
      codeResult: null,
      files: [],
      summary: emptySummary(),
      error: 'No image or description provided',
    };
  }

  if (parseResult.confidence === 0 && parseResult.elements.length === 0) {
    return {
      success: false,
      parseResult,
      codeResult: null,
      files: [],
      summary: emptySummary(),
      error: `P&ID parsing failed: ${parseResult.warnings.join('; ')}`,
    };
  }

  // Step 2: Generate PLC code from parse result
  const codeGenRequest: PIDCodeGenRequest = {
    parseResult,
    targetVendor: input.targetVendor || 'generic',
    safetyLevel: input.safetyLevel || 'none',
    scanTime: input.scanTime || 'T#100ms',
    controlStrategy: input.controlStrategy,
  };

  const codeResult = await generateCodeFromPID(codeGenRequest, aiProvider);

  // Step 3: Generate workbench files
  const files = generateWorkbenchFiles(parseResult, codeResult);

  // Step 4: Build summary
  const summary = buildSummary(parseResult, codeResult);

  return {
    success: true,
    parseResult,
    codeResult,
    files,
    summary,
  };
}

// ─── File Generation ────────────────────────────────────────────────────────

function generateWorkbenchFiles(parseResult: PIDParseResult, codeResult: PIDCodeGenResult): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Main ST program file
  files.push({
    path: 'src/main.st',
    content: codeResult.stCode,
    description: 'Main Structured Text program generated from P&ID',
  });

  // IO tag list as CSV
  files.push({
    path: 'tags/io_list.csv',
    content: generateIOCSV(codeResult.tagList),
    description: 'I/O tag list with addresses and descriptions',
  });

  // Variable declarations as separate file (for import into OpenPLC)
  files.push({
    path: 'src/variables.st',
    content: generateVariableDeclarations(codeResult.tagList, parseResult),
    description: 'Variable declarations for all P&ID instruments and actuators',
  });

  // Control loop configuration
  if (parseResult.controlLoops.length > 0) {
    files.push({
      path: 'src/control_loops.st',
      content: generateControlLoopCode(parseResult.controlLoops),
      description: 'PID control loop implementations',
    });
  }

  // Safety interlocks as separate module
  if (parseResult.interlocks.length > 0) {
    files.push({
      path: 'src/interlocks.st',
      content: generateInterlockCode(parseResult.interlocks),
      description: 'Safety interlock logic',
    });
  }

  // Diagram JSON for ladder visualization
  files.push({
    path: 'diagram.json',
    content: codeResult.ladderJson,
    description: 'Ladder diagram layout for visualization',
  });

  // P&ID analysis report (markdown)
  files.push({
    path: 'docs/pid_analysis.md',
    content: generateAnalysisReport(parseResult, codeResult),
    description: 'P&ID analysis report with extracted elements',
  });

  return files;
}

function generateIOCSV(tagList: PIDCodeGenResult['tagList']): string {
  const header = 'Tag Name,Address,Data Type,Description,Source Element';
  const rows = tagList.map((t) => `${t.name},${t.address},${t.dataType},"${t.description}",${t.source}`);

  return [header, ...rows].join('\n');
}

function generateVariableDeclarations(tagList: PIDCodeGenResult['tagList'], parseResult: PIDParseResult): string {
  const lines: string[] = ['PROGRAM PID_Variables', '(* Auto-generated from P&ID analysis *)', ''];

  // Group by type
  const digitalInputs = tagList.filter((t) => t.address.startsWith('%IX'));
  const digitalOutputs = tagList.filter((t) => t.address.startsWith('%QX'));
  const analogInputs = tagList.filter((t) => t.address.startsWith('%IW'));
  const analogOutputs = tagList.filter((t) => t.address.startsWith('%QW'));

  if (digitalInputs.length > 0) {
    lines.push('VAR_INPUT');
    lines.push('  (* Digital Inputs *)');

    for (const tag of digitalInputs) {
      lines.push(`  ${tag.name} AT ${tag.address} : ${tag.dataType}; (* ${tag.description} *)`);
    }

    lines.push('END_VAR');
    lines.push('');
  }

  if (analogInputs.length > 0) {
    lines.push('VAR_INPUT');
    lines.push('  (* Analog Inputs *)');

    for (const tag of analogInputs) {
      lines.push(`  ${tag.name} AT ${tag.address} : ${tag.dataType}; (* ${tag.description} *)`);
    }

    lines.push('END_VAR');
    lines.push('');
  }

  if (digitalOutputs.length > 0) {
    lines.push('VAR_OUTPUT');
    lines.push('  (* Digital Outputs *)');

    for (const tag of digitalOutputs) {
      lines.push(`  ${tag.name} AT ${tag.address} : ${tag.dataType}; (* ${tag.description} *)`);
    }

    lines.push('END_VAR');
    lines.push('');
  }

  if (analogOutputs.length > 0) {
    lines.push('VAR_OUTPUT');
    lines.push('  (* Analog Outputs *)');

    for (const tag of analogOutputs) {
      lines.push(`  ${tag.name} AT ${tag.address} : ${tag.dataType}; (* ${tag.description} *)`);
    }

    lines.push('END_VAR');
    lines.push('');
  }

  // Internal variables for control loops
  if (parseResult.controlLoops.length > 0) {
    lines.push('VAR');
    lines.push('  (* Control Loop Internal Variables *)');

    for (const loop of parseResult.controlLoops) {
      const prefix = `LOOP_${loop.loopNumber}`;
      lines.push(`  ${prefix}_SP : REAL := ${loop.setpoint ?? 50.0}; (* Setpoint *)`);
      lines.push(`  ${prefix}_PV : REAL; (* Process Value - scaled *)`);
      lines.push(`  ${prefix}_CV : REAL; (* Control Output *)`);
      lines.push(`  ${prefix}_EN : BOOL := TRUE; (* Loop Enable *)`);
      lines.push(`  ${prefix}_MAN : BOOL := FALSE; (* Manual Mode *)`);
      lines.push(`  ${prefix}_ERR : REAL; (* Error = SP - PV *)`);
      lines.push(`  ${prefix}_KP : REAL := 1.0; (* Proportional Gain *)`);
      lines.push(`  ${prefix}_KI : REAL := 0.1; (* Integral Gain *)`);
      lines.push(`  ${prefix}_KD : REAL := 0.0; (* Derivative Gain *)`);
      lines.push('');
    }

    lines.push('END_VAR');
    lines.push('');
  }

  // Interlock status variables
  if (parseResult.interlocks.length > 0) {
    lines.push('VAR');
    lines.push('  (* Safety Interlock Status *)');

    for (const interlock of parseResult.interlocks) {
      const tag = interlock.id.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`  ${tag}_ACTIVE : BOOL; (* ${interlock.name} active *)`);
      lines.push(`  ${tag}_LATCHED : BOOL; (* ${interlock.name} latched *)`);
      lines.push(`  ${tag}_RESET : BOOL; (* ${interlock.name} reset command *)`);
    }

    lines.push('END_VAR');
  }

  lines.push('');
  lines.push('END_PROGRAM');

  return lines.join('\n');
}

function generateControlLoopCode(loops: PIDControlLoop[]): string {
  const lines: string[] = ['(* Control Loop Implementations *)', '(* Auto-generated from P&ID analysis *)', ''];

  for (const loop of loops) {
    const prefix = `LOOP_${loop.loopNumber}`;
    const desc = loop.description || `${loop.measuredVariable} control`;

    lines.push(`(* ──── ${desc} ──── *)`);
    lines.push(
      `(* Sensor: ${loop.sensor.tagNumber} → Controller → ${(loop.finalElement as PIDValve | PIDPump).tagNumber || 'output'} *)`,
    );
    lines.push(`(* Control Type: ${loop.controlType} *)`);
    lines.push('');

    if (loop.controlType === 'onoff') {
      lines.push(`IF ${prefix}_EN AND NOT ${prefix}_MAN THEN`);
      lines.push(`  ${prefix}_ERR := ${prefix}_SP - ${prefix}_PV;`);
      lines.push(`  IF ${prefix}_ERR > 0.0 THEN`);
      lines.push(`    ${prefix}_CV := 100.0;`);
      lines.push('  ELSE');
      lines.push(`    ${prefix}_CV := 0.0;`);
      lines.push('  END_IF;');
      lines.push('END_IF;');
    } else {
      lines.push(`IF ${prefix}_EN AND NOT ${prefix}_MAN THEN`);
      lines.push(`  ${prefix}_ERR := ${prefix}_SP - ${prefix}_PV;`);
      lines.push('');
      lines.push('  (* PID calculation — use OSCAT FT_PID or vendor FB *)');
      lines.push(`  ${prefix}_CV := ${prefix}_KP * ${prefix}_ERR;`);
      lines.push('');
      lines.push('  (* Output limiting *)');
      lines.push(`  IF ${prefix}_CV > 100.0 THEN`);
      lines.push(`    ${prefix}_CV := 100.0;`);
      lines.push(`  ELSIF ${prefix}_CV < 0.0 THEN`);
      lines.push(`    ${prefix}_CV := 0.0;`);
      lines.push('  END_IF;');
      lines.push('END_IF;');
    }

    lines.push('');
  }

  return lines.join('\n');
}

function generateInterlockCode(interlocks: PIDInterlock[]): string {
  const lines: string[] = [
    '(* Safety Interlock Logic *)',
    '(* Auto-generated from P&ID analysis *)',
    '(* WARNING: Review and validate before deployment *)',
    '',
  ];

  for (const interlock of interlocks) {
    const tag = interlock.id.replace(/[^a-zA-Z0-9_]/g, '_');

    lines.push(`(* ──── ${interlock.name} [${interlock.priority}] ──── *)`);
    lines.push(`(* Trigger: ${interlock.triggerCondition} *)`);
    lines.push('');

    // Generate condition evaluation
    const condParts = interlock.instruments.map((inst) => {
      const isHighAlarm = inst.subsequentLetters.includes('H');
      const isLowAlarm = inst.subsequentLetters.includes('L');

      if (isHighAlarm) {
        return `${inst.tagNumber}_PV >= ${inst.tagNumber}_HH`;
      }

      if (isLowAlarm) {
        return `${inst.tagNumber}_PV <= ${inst.tagNumber}_LL`;
      }

      return `${inst.tagNumber}`;
    });

    const condition = condParts.length > 0 ? condParts.join(' OR ') : 'FALSE';

    lines.push(`(* Condition evaluation *)`);
    lines.push(`${tag}_ACTIVE := ${condition};`);
    lines.push('');

    // Latch logic (safety interlocks latch — require manual reset)
    if (interlock.priority === 'safety') {
      lines.push('(* Safety latch — requires manual reset *)');
      lines.push(`IF ${tag}_ACTIVE THEN`);
      lines.push(`  ${tag}_LATCHED := TRUE;`);
      lines.push('END_IF;');
      lines.push(`IF ${tag}_RESET AND NOT ${tag}_ACTIVE THEN`);
      lines.push(`  ${tag}_LATCHED := FALSE;`);
      lines.push('END_IF;');
    } else {
      lines.push('(* Process interlock — auto-reset when condition clears *)');
      lines.push(`${tag}_LATCHED := ${tag}_ACTIVE;`);
    }

    lines.push('');

    // Actions
    lines.push('(* Actions *)');
    lines.push(`IF ${tag}_LATCHED THEN`);

    for (const action of interlock.actions) {
      const actionTag = action.replace(/\s+/g, '_').toUpperCase();
      lines.push(`  ${actionTag} := TRUE;`);
    }

    lines.push('END_IF;');
    lines.push('');
  }

  return lines.join('\n');
}

function generateAnalysisReport(parseResult: PIDParseResult, codeResult: PIDCodeGenResult): string {
  const lines: string[] = [
    '# P&ID Analysis Report',
    '',
    `**Confidence:** ${(parseResult.confidence * 100).toFixed(0)}%`,
    `**Generated:** ${new Date().toISOString().split('T')[0]}`,
    '',
  ];

  if (parseResult.rawDescription) {
    lines.push('## P&ID Description');
    lines.push(parseResult.rawDescription);
    lines.push('');
  }

  // Instruments
  const instruments = parseResult.elements.filter((e) => e.type === 'instrument') as PIDInstrument[];

  if (instruments.length > 0) {
    lines.push('## Instruments');
    lines.push('| Tag | Variable | Function | Location |');
    lines.push('|-----|----------|----------|----------|');

    for (const inst of instruments) {
      lines.push(
        `| ${inst.tagNumber} | ${inst.measuredVariable} | ${inst.subsequentLetters.join('')} | ${inst.location} |`,
      );
    }

    lines.push('');
  }

  // Valves
  const valves = parseResult.elements.filter((e) => e.type === 'valve') as PIDValve[];

  if (valves.length > 0) {
    lines.push('## Valves');
    lines.push('| Tag | Type | Actuator | Fail Position |');
    lines.push('|-----|------|----------|---------------|');

    for (const valve of valves) {
      lines.push(
        `| ${valve.tagNumber} | ${valve.valveType} | ${valve.actuatorType || '-'} | ${valve.failPosition || '-'} |`,
      );
    }

    lines.push('');
  }

  // Control Loops
  if (parseResult.controlLoops.length > 0) {
    lines.push('## Control Loops');

    for (const loop of parseResult.controlLoops) {
      lines.push(`- **Loop ${loop.loopNumber}** (${loop.controlType}): ${loop.description}`);
      lines.push(`  - Sensor: ${loop.sensor.tagNumber} → Controller → ${(loop.finalElement as any).tagNumber}`);

      if (loop.setpoint != null) {
        lines.push(`  - Setpoint: ${loop.setpoint}`);
      }
    }

    lines.push('');
  }

  // Interlocks
  if (parseResult.interlocks.length > 0) {
    lines.push('## Safety Interlocks');

    for (const interlock of parseResult.interlocks) {
      lines.push(`- **${interlock.name}** [${interlock.priority}]`);
      lines.push(`  - Trigger: ${interlock.triggerCondition}`);
      lines.push(`  - Actions: ${interlock.actions.join(', ')}`);
    }

    lines.push('');
  }

  // I/O Summary
  lines.push('## I/O Summary');
  lines.push(`- Digital Inputs: ${codeResult.ioCount.digitalInputs}`);
  lines.push(`- Digital Outputs: ${codeResult.ioCount.digitalOutputs}`);
  lines.push(`- Analog Inputs: ${codeResult.ioCount.analogInputs}`);
  lines.push(`- Analog Outputs: ${codeResult.ioCount.analogOutputs}`);
  lines.push(`- **Total I/O points:** ${Object.values(codeResult.ioCount).reduce((a, b) => a + b, 0)}`);

  // Warnings
  if (parseResult.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');

    for (const w of parseResult.warnings) {
      lines.push(`- ⚠️ ${w}`);
    }
  }

  return lines.join('\n');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSummary(parseResult: PIDParseResult, codeResult: PIDCodeGenResult): PipelineSummary {
  return {
    instrumentCount: parseResult.elements.filter((e) => e.type === 'instrument').length,
    valveCount: parseResult.elements.filter((e) => e.type === 'valve').length,
    pumpCount: parseResult.elements.filter((e) => e.type === 'pump').length,
    controlLoopCount: parseResult.controlLoops.length,
    interlockCount: parseResult.interlocks.length,
    ioCount: codeResult.ioCount,
    confidence: parseResult.confidence,
    warnings: parseResult.warnings,
  };
}

function emptySummary(): PipelineSummary {
  return {
    instrumentCount: 0,
    valveCount: 0,
    pumpCount: 0,
    controlLoopCount: 0,
    interlockCount: 0,
    ioCount: { digitalInputs: 0, digitalOutputs: 0, analogInputs: 0, analogOutputs: 0 },
    confidence: 0,
    warnings: [],
  };
}
