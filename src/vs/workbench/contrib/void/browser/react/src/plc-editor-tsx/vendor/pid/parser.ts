/**
 * P&ID Vision Parser
 *
 * Uses multimodal LLM (via existing AI provider infrastructure)
 * to extract P&ID elements from uploaded images/PDFs.
 * Converts extracted data into PLC control logic.
 */

import type {
  PIDParseResult,
  PIDElement,
  PIDControlLoop,
  PIDInterlock,
  PIDInstrument,
  PIDValve,
  PIDPump,
  PIDPipe,
  PIDCodeGenRequest,
  PIDCodeGenResult,
} from './types.js';

// ─── P&ID Analysis Prompt ───────────────────────────────────────────────────

const PID_EXTRACTION_PROMPT = `You are an expert process control engineer analyzing a P&ID (Piping and Instrumentation Diagram).

Extract ALL of the following from this P&ID image:

1. **Instruments** (ISA 5.1 standard):
   - Tag numbers (e.g., FIC-101, TT-202, LSH-301)
   - First letter (measured variable)
   - Subsequent letters (function)
   - Loop numbers
   - Location (field/panel/DCS/PLC)
   - Setpoints if shown
   - Ranges if shown

2. **Valves**:
   - Tag numbers
   - Type (gate/globe/ball/butterfly/check/relief/solenoid/control)
   - Actuator type (pneumatic/electric/hydraulic/manual)
   - Fail position (open/closed/last)
   - Normal position

3. **Equipment** (pumps, motors, vessels, tanks):
   - Tag numbers
   - Types and specifications
   - Capacities, ratings

4. **Piping**:
   - Line numbers
   - Sizes
   - Materials
   - From/to connections
   - Medium (what flows through)

5. **Signal lines**:
   - Type (electric/pneumatic/data/software)
   - Connections (from -> to)

6. **Control Loops**:
   - Identify complete feedback/feedforward/cascade loops
   - Sensor -> Controller -> Final Element chains
   - Control strategy (PID, On/Off, Ratio)

7. **Interlocks/Safety**:
   - Trip conditions (high-high level, low pressure, etc.)
   - Actions (close valve, stop pump, etc.)
   - Priority (safety/process/equipment)

Return the result as a JSON object matching this exact schema:
{
  "elements": [...],
  "controlLoops": [...],
  "interlocks": [...],
  "pipes": [...],
  "confidence": 0.0-1.0,
  "warnings": [...],
  "rawDescription": "brief text description of what the P&ID shows"
}`;

const PID_CODE_GEN_PROMPT = `You are an IEC 61131-3 PLC programmer generating control code from a P&ID analysis.

Given the following P&ID analysis result, generate:
1. Complete Structured Text (ST) code for all control loops and interlocks
2. Tag/variable declarations with I/O addresses
3. Function block instances (PID, TON, TOF, etc.)

Rules:
- Use standard IEC 61131-3 syntax
- Every variable must be declared in VAR blocks with proper types
- Use intermediate BOOL variables for compound logic
- Implement proper scaling for analog signals (0-27648 raw -> engineering units)
- Include timer-based debouncing for digital inputs
- Add alarm generation for out-of-range conditions
- Safety interlocks override normal control
- Use SET/RESET pattern for latch logic

Target scan time: {{scanTime}}
Safety level: {{safetyLevel}}`;

// ─── Parser Implementation ──────────────────────────────────────────────────

/**
 * Parse a P&ID image using the LLM vision capabilities.
 * Uses the existing AI provider infrastructure in volt.diy.
 *
 * @param imageBase64 - Base64-encoded image data
 * @param mimeType - Image MIME type (image/png, image/jpeg, application/pdf)
 * @param aiProvider - Function to call the AI (passed in to avoid circular deps)
 */
export async function parsePIDImage(
  imageBase64: string,
  mimeType: string,
  aiProvider: (prompt: string, image?: { data: string; mimeType: string }) => Promise<string>,
): Promise<PIDParseResult> {
  try {
    const response = await aiProvider(PID_EXTRACTION_PROMPT, { data: imageBase64, mimeType });

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonStr = extractJSON(response);

    if (!jsonStr) {
      return {
        elements: [],
        controlLoops: [],
        interlocks: [],
        pipes: [],
        confidence: 0,
        warnings: ['Failed to extract structured data from P&ID analysis'],
        rawDescription: response,
      };
    }

    const parsed = JSON.parse(jsonStr) as PIDParseResult;

    // Validate and normalize
    return normalizeParseResult(parsed);
  } catch (err: any) {
    return {
      elements: [],
      controlLoops: [],
      interlocks: [],
      pipes: [],
      confidence: 0,
      warnings: [`P&ID parsing error: ${err.message}`],
    };
  }
}

/**
 * Parse a text description of a P&ID (for when image is not available)
 */
export async function parsePIDDescription(
  description: string,
  aiProvider: (prompt: string) => Promise<string>,
): Promise<PIDParseResult> {
  const prompt = `${PID_EXTRACTION_PROMPT}\n\nP&ID Description:\n${description}`;

  try {
    const response = await aiProvider(prompt);
    const jsonStr = extractJSON(response);

    if (!jsonStr) {
      return {
        elements: [],
        controlLoops: [],
        interlocks: [],
        pipes: [],
        confidence: 0,
        warnings: ['Failed to parse P&ID description'],
        rawDescription: response,
      };
    }

    return normalizeParseResult(JSON.parse(jsonStr));
  } catch (err: any) {
    return {
      elements: [],
      controlLoops: [],
      interlocks: [],
      pipes: [],
      confidence: 0,
      warnings: [`P&ID description parsing error: ${err.message}`],
    };
  }
}

/**
 * Generate PLC code from a parsed P&ID result
 */
export async function generateCodeFromPID(
  request: PIDCodeGenRequest,
  aiProvider: (prompt: string) => Promise<string>,
): Promise<PIDCodeGenResult> {
  const contextPrompt = [
    PID_CODE_GEN_PROMPT.replace('{{scanTime}}', request.scanTime || 'T#100ms').replace(
      '{{safetyLevel}}',
      request.safetyLevel || 'none',
    ),
    '',
    'P&ID Analysis Data:',
    JSON.stringify(request.parseResult, null, 2),
    '',
    request.controlStrategy ? `User-specified control strategy: ${request.controlStrategy}` : '',
    '',
    'Generate the complete ST code:',
  ].join('\n');

  const response = await aiProvider(contextPrompt);

  // Extract ST code from response
  const stCode = extractCodeBlock(response, 'st') || extractCodeBlock(response, '') || response;

  // Generate tag list from instruments
  const tagList = generateTagList(request.parseResult);

  // Count I/O
  const ioCount = countIO(request.parseResult);

  // Generate basic ladder JSON for visualization
  const ladderJson = generateLadderFromPID(request.parseResult);

  return {
    stCode,
    ladderJson: JSON.stringify(ladderJson, null, 2),
    tagList,
    ioCount,
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function extractJSON(text: string): string | null {
  // Try to find JSON in code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);

  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch[0]);
      return jsonMatch[0];
    } catch {
      // Not valid JSON
    }
  }

  return null;
}

function extractCodeBlock(text: string, lang: string): string | null {
  const pattern = lang ? new RegExp(`\`\`\`${lang}\\s*\\n?([\\s\\S]*?)\\n?\`\`\``) : /```\s*\n?([\s\S]*?)\n?```/;

  const match = text.match(pattern);

  return match ? match[1].trim() : null;
}

function normalizeParseResult(parsed: PIDParseResult): PIDParseResult {
  return {
    elements: Array.isArray(parsed.elements) ? parsed.elements : [],
    controlLoops: Array.isArray(parsed.controlLoops) ? parsed.controlLoops : [],
    interlocks: Array.isArray(parsed.interlocks) ? parsed.interlocks : [],
    pipes: Array.isArray(parsed.pipes) ? parsed.pipes : [],
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    rawDescription: parsed.rawDescription,
  };
}

function generateTagList(result: PIDParseResult): PIDCodeGenResult['tagList'] {
  const tags: PIDCodeGenResult['tagList'] = [];
  let diCount = 0;
  let doCount = 0;
  let aiCount = 0;
  let aoCount = 0;

  for (const element of result.elements) {
    if (element.type === 'instrument') {
      const inst = element as PIDInstrument;
      const isAnalog = ['F', 'T', 'P', 'L', 'A', 'D'].includes(inst.firstLetter);
      const isOutput = inst.subsequentLetters.includes('C') || inst.subsequentLetters.includes('V');

      if (isAnalog) {
        if (isOutput) {
          tags.push({
            name: `${inst.tagNumber}_CV`,
            address: `%QW${aoCount}`,
            dataType: 'INT',
            description: `${inst.measuredVariable} control output`,
            source: inst.tagNumber,
          });
          aoCount++;
        } else {
          tags.push({
            name: `${inst.tagNumber}_PV`,
            address: `%IW${aiCount}`,
            dataType: 'INT',
            description: `${inst.measuredVariable} process value (raw)`,
            source: inst.tagNumber,
          });
          aiCount++;
        }
      } else {
        if (isOutput) {
          tags.push({
            name: inst.tagNumber,
            address: `%QX0.${doCount}`,
            dataType: 'BOOL',
            description: `${inst.measuredVariable} digital output`,
            source: inst.tagNumber,
          });
          doCount++;
        } else {
          tags.push({
            name: inst.tagNumber,
            address: `%IX0.${diCount}`,
            dataType: 'BOOL',
            description: `${inst.measuredVariable} digital input`,
            source: inst.tagNumber,
          });
          diCount++;
        }
      }
    }

    if (element.type === 'valve') {
      const valve = element as PIDValve;

      if (valve.valveType === 'solenoid' || valve.actuatorType === 'electric') {
        tags.push({
          name: `${valve.tagNumber}_CMD`,
          address: `%QX0.${doCount}`,
          dataType: 'BOOL',
          description: `${valve.tagNumber} command`,
          source: valve.tagNumber,
        });
        doCount++;

        tags.push({
          name: `${valve.tagNumber}_FB`,
          address: `%IX0.${diCount}`,
          dataType: 'BOOL',
          description: `${valve.tagNumber} feedback`,
          source: valve.tagNumber,
        });
        diCount++;
      }
    }

    if (element.type === 'pump') {
      const pump = element as PIDPump;
      tags.push({
        name: `${pump.tagNumber}_RUN`,
        address: `%QX0.${doCount}`,
        dataType: 'BOOL',
        description: `${pump.tagNumber} run command`,
        source: pump.tagNumber,
      });
      doCount++;

      tags.push({
        name: `${pump.tagNumber}_RUN_FB`,
        address: `%IX0.${diCount}`,
        dataType: 'BOOL',
        description: `${pump.tagNumber} running feedback`,
        source: pump.tagNumber,
      });
      diCount++;
    }
  }

  return tags;
}

function countIO(result: PIDParseResult): PIDCodeGenResult['ioCount'] {
  let digitalInputs = 0;
  let digitalOutputs = 0;
  let analogInputs = 0;
  let analogOutputs = 0;

  for (const element of result.elements) {
    switch (element.type) {
      case 'instrument': {
        const inst = element as PIDInstrument;
        const isAnalog = ['F', 'T', 'P', 'L', 'A', 'D'].includes(inst.firstLetter);
        const isOutput = inst.subsequentLetters.includes('C');

        if (isAnalog) {
          if (isOutput) {
            analogOutputs++;
          } else {
            analogInputs++;
          }
        } else {
          if (isOutput) {
            digitalOutputs++;
          } else {
            digitalInputs++;
          }
        }

        break;
      }
      case 'valve':
        digitalOutputs++;
        digitalInputs++; // feedback
        break;
      case 'pump':
        digitalOutputs++;
        digitalInputs++; // running feedback
        break;
      case 'motor':
        digitalOutputs++;
        digitalInputs++;
        break;
    }
  }

  return { digitalInputs, digitalOutputs, analogInputs, analogOutputs };
}

function generateLadderFromPID(result: PIDParseResult): object {
  const rungs: any[] = [];

  // Generate interlocks as rungs
  for (const interlock of result.interlocks) {
    const contacts = interlock.instruments.map((inst) => ({
      type: inst.subsequentLetters.includes('S') ? 'NC' : 'NO',
      tag: inst.tagNumber,
      name: inst.description || inst.tagNumber,
    }));

    rungs.push({
      comment: `Interlock: ${interlock.name}`,
      elements: contacts,
      coils: interlock.actions.map((action) => ({
        type: 'STANDARD',
        tag: action.replace(/\s+/g, '_'),
        name: action,
      })),
    });
  }

  // Generate control loop enable rungs
  for (const loop of result.controlLoops) {
    rungs.push({
      comment: `Control Loop: ${loop.description}`,
      elements: [
        {
          type: 'NO',
          tag: `${loop.sensor.tagNumber}_OK`,
          name: 'Sensor healthy',
        },
      ],
      coils: [
        {
          type: 'STANDARD',
          tag: `LOOP_${loop.loopNumber}_EN`,
          name: `Loop ${loop.loopNumber} Enable`,
        },
      ],
    });
  }

  return {
    name: 'P&ID_Generated',
    rungs,
  };
}
