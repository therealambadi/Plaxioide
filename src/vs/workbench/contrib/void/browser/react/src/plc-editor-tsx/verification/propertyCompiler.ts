/*
 * Property Compiler — Transforms VerificationProperty[] into ESBMC-PLC+ assertion instrumentation.
 *
 * ESBMC-PLC+ verifies ST programs by injecting C-level assertions after MATIEC compilation.
 * The property compiler:
 *   1. Generates additional ST code that encodes properties as state-machine monitors
 *   2. Emits the YAML property spec file that ESBMC-PLC+'s CLI consumes
 *   3. Maps counterexample variable assignments back to tag names
 *
 * Property encoding follows the ESBMC-PLC+ paper's §4.2 specification patterns:
 *   - mutual_exclusion: ASSERT NOT (tag1 AND tag2 AND ...)
 *   - invariant:        ASSERT <expression>   (must always hold)
 *   - absence:          ASSERT NOT <expression>  (must never hold)
 *   - response:         ASSERT (trigger_seen → eventually_response)  with liveness encoding
 *   - reachability:     cover(<expression>)  (must be satisfiable — inverted safety check)
 */

import type {
  VerificationProperty,
  MutualExclusionProperty,
  InvariantProperty,
  AbsenceProperty,
  ResponseProperty,
  ReachabilityProperty,
} from './types.js';

export interface CompiledProperty {
  id: string;
  kind: VerificationProperty['kind'];
  label: string;
  assertionST: string;    // ST code to inject into the PROGRAM body (monitor logic)
  auxVarsST: string;      // additional VAR declarations for monitor state
  yamlEntry: string;      // YAML fragment for ESBMC-PLC+ property file
  isReachability: boolean; // reachability uses --cover mode, not --safety
}

export interface PropertyCompilationResult {
  compiledProperties: CompiledProperty[];
  yamlContent: string;            // full YAML property spec file
  monitorVarBlock: string;        // VAR declarations to inject
  monitorBodyBlock: string;       // body statements to inject at end of PROGRAM
}

let _propCounter = 0;
function nextPropVar(prefix: string): string {
  return `_VER_${prefix}_${++_propCounter}`;
}

export function compileProperties(properties: VerificationProperty[]): PropertyCompilationResult {
  _propCounter = 0;
  const compiled = properties.map(p => compileOne(p));

  const yamlLines = [
    'properties:',
    ...compiled.map(c => c.yamlEntry),
  ];

  const monitorVarBlock = compiled
    .map(c => c.auxVarsST)
    .filter(s => s.length > 0)
    .join('\n');

  const monitorBodyBlock = compiled
    .map(c => c.assertionST)
    .filter(s => s.length > 0)
    .join('\n');

  return {
    compiledProperties: compiled,
    yamlContent: yamlLines.join('\n'),
    monitorVarBlock,
    monitorBodyBlock,
  };
}

function compileOne(prop: VerificationProperty): CompiledProperty {
  switch (prop.kind) {
    case 'mutual_exclusion': return compileMutualExclusion(prop);
    case 'invariant': return compileInvariant(prop);
    case 'absence': return compileAbsence(prop);
    case 'response': return compileResponse(prop);
    case 'reachability': return compileReachability(prop);
  }
}

function compileMutualExclusion(prop: MutualExclusionProperty): CompiledProperty {
  const pairs: string[] = [];
  for (let i = 0; i < prop.tags.length; i++) {
    for (let j = i + 1; j < prop.tags.length; j++) {
      pairs.push(`(${prop.tags[i]} AND ${prop.tags[j]})`);
    }
  }
  const assertExpr = `NOT (${pairs.join(' OR ')})`;

  return {
    id: prop.id,
    kind: 'mutual_exclusion',
    label: prop.label,
    assertionST: `  (* Property: ${prop.label} *)\n  __ESBMC_assert(${assertExpr}, "${prop.id}");`,
    auxVarsST: '',
    yamlEntry: `  - id: "${prop.id}"\n    kind: mutual_exclusion\n    tags: [${prop.tags.map(t => `"${t}"`).join(', ')}]`,
    isReachability: false,
  };
}

function compileInvariant(prop: InvariantProperty): CompiledProperty {
  return {
    id: prop.id,
    kind: 'invariant',
    label: prop.label,
    assertionST: `  (* Property: ${prop.label} *)\n  __ESBMC_assert(${prop.expression}, "${prop.id}");`,
    auxVarsST: '',
    yamlEntry: `  - id: "${prop.id}"\n    kind: invariant\n    expression: "${escapeYaml(prop.expression)}"`,
    isReachability: false,
  };
}

function compileAbsence(prop: AbsenceProperty): CompiledProperty {
  return {
    id: prop.id,
    kind: 'absence',
    label: prop.label,
    assertionST: `  (* Property: ${prop.label} *)\n  __ESBMC_assert(NOT (${prop.expression}), "${prop.id}");`,
    auxVarsST: '',
    yamlEntry: `  - id: "${prop.id}"\n    kind: absence\n    expression: "${escapeYaml(prop.expression)}"`,
    isReachability: false,
  };
}

function compileResponse(prop: ResponseProperty): CompiledProperty {
  const trigVar = nextPropVar('TRIG');
  const countVar = nextPropVar('CNT');
  const bound = prop.withinScans ?? 100;

  const auxVars = [
    `    ${trigVar} : BOOL := FALSE;`,
    `    ${countVar} : INT := 0;`,
  ].join('\n');

  const body = [
    `  (* Property: ${prop.label} — bounded response *)`,
    `  IF ${prop.trigger} AND NOT ${trigVar} THEN`,
    `    ${trigVar} := TRUE;`,
    `    ${countVar} := 0;`,
    `  END_IF;`,
    `  IF ${trigVar} THEN`,
    `    ${countVar} := ${countVar} + 1;`,
    `    IF ${prop.response} THEN`,
    `      ${trigVar} := FALSE;`,
    `    ELSIF ${countVar} >= ${bound} THEN`,
    `      __ESBMC_assert(FALSE, "${prop.id}");`,
    `      ${trigVar} := FALSE;`,
    `    END_IF;`,
    `  END_IF;`,
  ].join('\n');

  return {
    id: prop.id,
    kind: 'response',
    label: prop.label,
    assertionST: body,
    auxVarsST: auxVars,
    yamlEntry: `  - id: "${prop.id}"\n    kind: response\n    trigger: "${escapeYaml(prop.trigger)}"\n    response: "${escapeYaml(prop.response)}"\n    within_scans: ${bound}`,
    isReachability: false,
  };
}

function compileReachability(prop: ReachabilityProperty): CompiledProperty {
  return {
    id: prop.id,
    kind: 'reachability',
    label: prop.label,
    assertionST: `  (* Property: ${prop.label} — reachability check *)\n  __ESBMC_assert(NOT (${prop.expression}), "${prop.id}");`,
    auxVarsST: '',
    yamlEntry: `  - id: "${prop.id}"\n    kind: reachability\n    expression: "${escapeYaml(prop.expression)}"`,
    isReachability: true,
  };
}

function escapeYaml(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Instrument an existing ST program with verification properties.
 * Injects monitor variables and assertions into the PROGRAM block.
 */
export function instrumentST(originalST: string, compilation: PropertyCompilationResult): string {
  if (compilation.compiledProperties.length === 0) return originalST;

  // Insert auxiliary VAR declarations before END_VAR
  let instrumented = originalST;

  if (compilation.monitorVarBlock) {
    const endVarIdx = instrumented.lastIndexOf('  END_VAR');
    if (endVarIdx !== -1) {
      instrumented = instrumented.slice(0, endVarIdx) +
        '    (* Verification monitor variables *)\n' +
        compilation.monitorVarBlock + '\n' +
        instrumented.slice(endVarIdx);
    }
  }

  // Insert monitor body before END_PROGRAM
  if (compilation.monitorBodyBlock) {
    const endProgIdx = instrumented.lastIndexOf('END_PROGRAM');
    if (endProgIdx !== -1) {
      instrumented = instrumented.slice(0, endProgIdx) +
        '\n  (* ── Formal Verification Assertions ── *)\n' +
        compilation.monitorBodyBlock + '\n\n' +
        instrumented.slice(endProgIdx);
    }
  }

  return instrumented;
}
