/*
 * IEC 61131-3 Structured Text Parser (ST → NormalizedPOU)
 * Recursive descent parser for the subset of ST constructs that can map to CLM:
 * - PROGRAM / FUNCTION_BLOCK / FUNCTION declarations
 * - VAR / END_VAR blocks (name, type, initial value, RETAIN, AT address)
 * - FB instance calls: Timer(IN := x, PT := T#5s)
 * - Assignments: X := Y AND Z
 * - IF / ELSIF / ELSE / END_IF
 * - CASE / END_CASE
 * - FOR / WHILE / REPEAT loops (preserved as ST-only blocks)
 *
 * Design: hand-written recursive descent — fast, zero dependencies, handles
 * exactly the constructs clmToST() generates for perfect round-trip fidelity.
 */

import type { NormalizedPOU, NormalizedTag } from './types.js';
import type {
  LadderProgram, FBDProgram, FBDNode, FBDWire, Pin,
  FBDBlockType, IECDataType,
} from '../logicStore.js';

// ─── Tokenizer ───────────────────────────────────────────────────────────────

type TokenKind =
  | 'KEYWORD' | 'IDENT' | 'NUMBER' | 'TIME_LITERAL' | 'STRING'
  | 'ASSIGN' | 'ARROW' | 'COLON' | 'SEMI' | 'COMMA' | 'DOT'
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET'
  | 'OP_COMPARE' | 'OP_ARITH' | 'OP_LOGIC'
  | 'EOF';

interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'PROGRAM', 'END_PROGRAM', 'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK',
  'FUNCTION', 'END_FUNCTION', 'VAR', 'VAR_INPUT', 'VAR_OUTPUT',
  'VAR_IN_OUT', 'VAR_TEMP', 'VAR_GLOBAL', 'END_VAR',
  'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF',
  'CASE', 'OF', 'END_CASE',
  'FOR', 'TO', 'BY', 'DO', 'END_FOR',
  'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT',
  'RETURN', 'EXIT', 'CONTINUE',
  'AND', 'OR', 'NOT', 'XOR', 'MOD',
  'TRUE', 'FALSE', 'RETAIN', 'CONSTANT', 'AT',
  'ARRAY', 'STRUCT', 'END_STRUCT', 'TYPE', 'END_TYPE',
]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  while (i < source.length) {
    // Skip whitespace
    if (/\s/.test(source[i])) {
      if (source[i] === '\n') { line++; col = 1; } else { col++; }
      i++;
      continue;
    }

    // Skip block comments (* ... *)
    if (source[i] === '(' && source[i + 1] === '*') {
      i += 2; col += 2;
      while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === ')')) {
        if (source[i] === '\n') { line++; col = 1; } else { col++; }
        i++;
      }
      i += 2; col += 2;
      continue;
    }

    // Skip line comments //
    if (source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    const startCol = col;

    // Time literals: T#..., TIME#...
    const timeMatch = source.slice(i).match(/^(T|TIME|LT|LTIME)#[0-9dhms_]+/i);
    if (timeMatch) {
      tokens.push({ kind: 'TIME_LITERAL', value: timeMatch[0], line, col: startCol });
      i += timeMatch[0].length; col += timeMatch[0].length;
      continue;
    }

    // Identifiers and keywords
    if (/[A-Za-z_]/.test(source[i])) {
      let word = '';
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        word += source[i]; i++; col++;
      }
      const upper = word.toUpperCase();
      if (upper === 'AND' || upper === 'OR' || upper === 'NOT' || upper === 'XOR') {
        tokens.push({ kind: 'OP_LOGIC', value: upper, line, col: startCol });
      } else if (upper === 'MOD') {
        tokens.push({ kind: 'OP_ARITH', value: upper, line, col: startCol });
      } else if (KEYWORDS.has(upper)) {
        tokens.push({ kind: 'KEYWORD', value: upper, line, col: startCol });
      } else {
        tokens.push({ kind: 'IDENT', value: word, line, col: startCol });
      }
      continue;
    }

    // Numbers (int/float/hex/binary)
    if (/[0-9]/.test(source[i])) {
      let num = '';
      // Check for base prefix: 16#, 8#, 2#
      if (/[0-9]/.test(source[i]) && i + 1 < source.length && source[i + 1] === '#') {
        num = source[i] + '#'; i += 2; col += 2;
        while (i < source.length && /[0-9A-Fa-f_]/.test(source[i])) {
          num += source[i]; i++; col++;
        }
      } else {
        while (i < source.length && /[0-9_.]/.test(source[i])) {
          num += source[i]; i++; col++;
        }
        if (i < source.length && /[eE]/.test(source[i])) {
          num += source[i]; i++; col++;
          if (i < source.length && /[+-]/.test(source[i])) { num += source[i]; i++; col++; }
          while (i < source.length && /[0-9]/.test(source[i])) { num += source[i]; i++; col++; }
        }
      }
      tokens.push({ kind: 'NUMBER', value: num, line, col: startCol });
      continue;
    }

    // String literals
    if (source[i] === '\'' || source[i] === '"') {
      const quote = source[i];
      let str = quote; i++; col++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '$' || source[i] === '\\') { str += source[i]; i++; col++; }
        if (i < source.length) { str += source[i]; i++; col++; }
      }
      if (i < source.length) { str += source[i]; i++; col++; }
      tokens.push({ kind: 'STRING', value: str, line, col: startCol });
      continue;
    }

    // Multi-char operators
    const two = source.slice(i, i + 2);
    if (two === ':=') { tokens.push({ kind: 'ASSIGN', value: ':=', line, col: startCol }); i += 2; col += 2; continue; }
    if (two === '=>') { tokens.push({ kind: 'ARROW', value: '=>', line, col: startCol }); i += 2; col += 2; continue; }
    if (two === '<>' || two === '<=' || two === '>=') {
      tokens.push({ kind: 'OP_COMPARE', value: two, line, col: startCol }); i += 2; col += 2; continue;
    }

    // Single-char
    const ch = source[i];
    if (ch === ':') { tokens.push({ kind: 'COLON', value: ':', line, col: startCol }); }
    else if (ch === ';') { tokens.push({ kind: 'SEMI', value: ';', line, col: startCol }); }
    else if (ch === ',') { tokens.push({ kind: 'COMMA', value: ',', line, col: startCol }); }
    else if (ch === '.') { tokens.push({ kind: 'DOT', value: '.', line, col: startCol }); }
    else if (ch === '(') { tokens.push({ kind: 'LPAREN', value: '(', line, col: startCol }); }
    else if (ch === ')') { tokens.push({ kind: 'RPAREN', value: ')', line, col: startCol }); }
    else if (ch === '[') { tokens.push({ kind: 'LBRACKET', value: '[', line, col: startCol }); }
    else if (ch === ']') { tokens.push({ kind: 'RBRACKET', value: ']', line, col: startCol }); }
    else if (ch === '<' || ch === '>' || ch === '=') { tokens.push({ kind: 'OP_COMPARE', value: ch, line, col: startCol }); }
    else if (ch === '+' || ch === '-' || ch === '*' || ch === '/') { tokens.push({ kind: 'OP_ARITH', value: ch, line, col: startCol }); }
    else { /* skip unknown char */ }
    i++; col++;
  }

  tokens.push({ kind: 'EOF', value: '', line, col });
  return tokens;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

interface ParsedVarDecl {
  name: string;
  dataType: string;
  initialValue?: string;
  retain?: boolean;
  address?: string;
  section: 'local' | 'input' | 'output' | 'inout' | 'temp' | 'global';
}

interface ParsedFBCall {
  instanceName: string;
  fbType: string;
  params: { name: string; value: string; direction: 'in' | 'out' }[];
}

interface ParsedAssignment {
  target: string;
  expression: string;
}

interface ParsedStatement {
  kind: 'fb_call' | 'assignment' | 'if' | 'case' | 'for' | 'while' | 'repeat' | 'return';
  fbCall?: ParsedFBCall;
  assignment?: ParsedAssignment;
  rawST?: string;
}

class STParser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(source: string) {
    this.tokens = tokenize(source);
  }

  private peek(): Token { return this.tokens[this.pos] || this.tokens[this.tokens.length - 1]; }
  private advance(): Token { return this.tokens[this.pos++]; }
  private expect(kind: TokenKind, value?: string): Token {
    const t = this.peek();
    if (t.kind !== kind || (value && t.value.toUpperCase() !== value.toUpperCase())) {
      throw new Error(`Expected ${kind}${value ? `(${value})` : ''} at line ${t.line}:${t.col}, got ${t.kind}(${t.value})`);
    }
    return this.advance();
  }
  private match(kind: TokenKind, value?: string): boolean {
    const t = this.peek();
    if (t.kind === kind && (!value || t.value.toUpperCase() === value.toUpperCase())) {
      this.advance();
      return true;
    }
    return false;
  }
  private isAt(kind: TokenKind, value?: string): boolean {
    const t = this.peek();
    return t.kind === kind && (!value || t.value.toUpperCase() === value.toUpperCase());
  }

  parse(): { pouName: string; pouType: string; vars: ParsedVarDecl[]; statements: ParsedStatement[] } {
    let pouName = 'Main';
    let pouType = 'program';

    // Optional POU declaration
    if (this.isAt('KEYWORD', 'PROGRAM')) {
      this.advance();
      pouName = this.expect('IDENT').value;
      pouType = 'program';
    } else if (this.isAt('KEYWORD', 'FUNCTION_BLOCK')) {
      this.advance();
      pouName = this.expect('IDENT').value;
      pouType = 'functionBlock';
    } else if (this.isAt('KEYWORD', 'FUNCTION')) {
      this.advance();
      pouName = this.expect('IDENT').value;
      pouType = 'function';
      if (this.match('COLON')) { this.advance(); } // return type
    }

    // Parse VAR blocks
    const vars: ParsedVarDecl[] = [];
    while (this.isAt('KEYWORD') && this.peek().value.startsWith('VAR')) {
      vars.push(...this.parseVarBlock());
    }

    // Parse statements until END_PROGRAM/END_FUNCTION_BLOCK/END_FUNCTION/EOF
    const statements: ParsedStatement[] = [];
    while (!this.isAt('EOF') && !this.isAt('KEYWORD', 'END_PROGRAM') &&
           !this.isAt('KEYWORD', 'END_FUNCTION_BLOCK') && !this.isAt('KEYWORD', 'END_FUNCTION')) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    // Consume END_xxx
    if (this.isAt('KEYWORD') && this.peek().value.startsWith('END_')) {
      this.advance();
    }

    return { pouName, pouType, vars, statements };
  }

  private parseVarBlock(): ParsedVarDecl[] {
    const decls: ParsedVarDecl[] = [];
    const kw = this.advance().value; // VAR, VAR_INPUT, etc.
    const sectionMap: Record<string, ParsedVarDecl['section']> = {
      VAR: 'local', VAR_INPUT: 'input', VAR_OUTPUT: 'output',
      VAR_IN_OUT: 'inout', VAR_TEMP: 'temp', VAR_GLOBAL: 'global',
    };
    const section = sectionMap[kw] || 'local';

    while (!this.isAt('KEYWORD', 'END_VAR') && !this.isAt('EOF')) {
      const retain = this.match('KEYWORD', 'RETAIN');
      if (this.match('KEYWORD', 'CONSTANT')) { /* skip */ }

      if (!this.isAt('IDENT')) { this.advance(); continue; }
      const name = this.advance().value;

      // Optional AT address
      let address: string | undefined;
      if (this.match('KEYWORD', 'AT')) {
        // Consume the address token (e.g., %IX0.0)
        address = '';
        while (!this.isAt('COLON') && !this.isAt('SEMI') && !this.isAt('EOF')) {
          address += this.advance().value;
        }
      }

      this.expect('COLON');
      let dataType = '';
      while (!this.isAt('SEMI') && !this.isAt('ASSIGN') && !this.isAt('EOF') &&
             !(this.isAt('KEYWORD', 'END_VAR'))) {
        dataType += this.advance().value;
      }
      dataType = dataType.trim();

      let initialValue: string | undefined;
      if (this.match('ASSIGN')) {
        initialValue = '';
        while (!this.isAt('SEMI') && !this.isAt('EOF')) {
          initialValue += this.advance().value + ' ';
        }
        initialValue = initialValue.trim();
      }
      this.match('SEMI');

      decls.push({ name, dataType, initialValue, retain, address, section });
    }
    this.match('KEYWORD', 'END_VAR');
    return decls;
  }

  private parseStatement(): ParsedStatement | null {
    // IF
    if (this.isAt('KEYWORD', 'IF')) { return this.parseIF(); }
    // FOR
    if (this.isAt('KEYWORD', 'FOR')) { return this.consumeBlock('FOR', 'END_FOR'); }
    // WHILE
    if (this.isAt('KEYWORD', 'WHILE')) { return this.consumeBlock('WHILE', 'END_WHILE'); }
    // REPEAT
    if (this.isAt('KEYWORD', 'REPEAT')) { return this.consumeBlock('REPEAT', 'END_REPEAT'); }
    // CASE
    if (this.isAt('KEYWORD', 'CASE')) { return this.consumeBlock('CASE', 'END_CASE'); }
    // RETURN
    if (this.match('KEYWORD', 'RETURN')) { this.match('SEMI'); return { kind: 'return' }; }

    // Identifier — either FB call or assignment
    if (this.isAt('IDENT')) {
      return this.parseIdentStatement();
    }

    // Skip unknown
    this.advance();
    return null;
  }

  private parseIdentStatement(): ParsedStatement {
    const ident = this.advance().value;

    // Check for dot-access (e.g., Timer.Q)
    let fullIdent = ident;
    while (this.match('DOT')) {
      fullIdent += '.' + this.advance().value;
    }

    // FB call: Ident(params) — handle both named and positional params
    if (this.isAt('LPAREN')) {
      return this.parseFBCall(ident);
    }

    // Assignment: ident := expr;
    if (this.match('ASSIGN')) {
      let expr = '';
      while (!this.isAt('SEMI') && !this.isAt('EOF')) {
        expr += this.advance().value + ' ';
      }
      this.match('SEMI');
      return { kind: 'assignment', assignment: { target: fullIdent, expression: expr.trim() } };
    }

    // Bare statement (rare) — skip to semicolon
    while (!this.isAt('SEMI') && !this.isAt('EOF')) { this.advance(); }
    this.match('SEMI');
    return null as any;
  }

  private parseFBCall(instanceName: string): ParsedStatement {
    this.expect('LPAREN');
    const params: ParsedFBCall['params'] = [];

    while (!this.isAt('RPAREN') && !this.isAt('EOF')) {
      if (this.isAt('IDENT')) {
        const paramName = this.advance().value;
        let direction: 'in' | 'out' = 'in';
        if (this.match('ASSIGN')) { direction = 'in'; }
        else if (this.match('ARROW')) { direction = 'out'; }
        else { /* positional — treat as in */ }

        let value = '';
        while (!this.isAt('COMMA') && !this.isAt('RPAREN') && !this.isAt('EOF')) {
          value += this.advance().value + ' ';
        }
        params.push({ name: paramName, value: value.trim(), direction });
      } else {
        this.advance();
      }
      this.match('COMMA');
    }
    this.match('RPAREN');
    this.match('SEMI');

    // Determine FB type from variable declarations context or instance name pattern
    const fbType = guessFBType(instanceName, params);

    return {
      kind: 'fb_call',
      fbCall: { instanceName, fbType, params },
    };
  }

  private parseIF(): ParsedStatement {
    const startPos = this.pos - 0;
    let raw = 'IF ';
    this.advance(); // consume IF
    let depth = 1;
    while (depth > 0 && !this.isAt('EOF')) {
      const t = this.advance();
      raw += t.value + ' ';
      if (t.kind === 'KEYWORD' && t.value === 'IF' && this.tokens[this.pos - 2]?.value !== 'END') depth++;
      if (t.kind === 'KEYWORD' && t.value === 'END_IF') depth--;
    }
    this.match('SEMI');
    return { kind: 'if', rawST: raw.trim() };
  }

  private consumeBlock(start: string, end: string): ParsedStatement {
    let raw = start + ' ';
    this.advance(); // consume start keyword
    let depth = 1;
    while (depth > 0 && !this.isAt('EOF')) {
      const t = this.advance();
      raw += t.value + ' ';
      if (t.kind === 'KEYWORD' && t.value === start) depth++;
      if (t.kind === 'KEYWORD' && t.value === end) depth--;
    }
    this.match('SEMI');
    return { kind: start.toLowerCase() as any, rawST: raw.trim() };
  }
}

function guessFBType(instanceName: string, params: ParsedFBCall['params']): string {
  const upper = instanceName.toUpperCase();
  const fbPatterns: Record<string, string> = {
    TON: 'TON', TOF: 'TOF', TP: 'TP',
    CTU: 'CTU', CTD: 'CTD', CTUD: 'CTUD',
    SR: 'SR', RS: 'RS',
    R_TRIG: 'RTRIG', F_TRIG: 'FTRIG', RTRIG: 'RTRIG', FTRIG: 'FTRIG',
  };
  // Check if instance name contains a known FB type
  for (const [pattern, fbType] of Object.entries(fbPatterns)) {
    if (upper.includes(pattern)) return fbType;
  }
  // Check params for timer/counter signatures
  const paramNames = new Set(params.map(p => p.name.toUpperCase()));
  if (paramNames.has('IN') && paramNames.has('PT')) return 'TON';
  if (paramNames.has('CU') && paramNames.has('PV')) return 'CTU';
  // Fall back to MOVE as a safe generic block — 'CUSTOM' is not a valid FBDBlockType
  return 'MOVE';
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface STParseResult {
  pou: NormalizedPOU;
  errors: string[];
  warnings: string[];
}

export function parseSTSource(source: string, filePath: string): STParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parser = new STParser(source);
    const result = parser.parse();

    // Convert parsed vars to NormalizedTag[]
    const localTags: NormalizedTag[] = result.vars.map(v => ({
      name: v.name,
      dataType: mapSTDataType(v.dataType),
      initialValue: v.initialValue,
      retain: v.retain,
      address: v.address,
    }));

    // Convert FB calls + assignments to an FBD program
    const { nodes, wires } = statementsToFBD(result.statements, result.vars);

    const fbdProgram: FBDProgram = nodes.length > 0 ? { nodes, wires } : { nodes: [], wires: [] };

    const pou: NormalizedPOU = {
      id: `pou-${result.pouName}`,
      name: result.pouName,
      language: nodes.length > 0 ? 'FBD' : 'ST',
      pouType: result.pouType as any,
      fbdProgram: nodes.length > 0 ? fbdProgram : undefined,
      stSource: source,
      localTags,
    };

    return { pou, errors, warnings };
  } catch (e) {
    errors.push(`ST parse error: ${e}`);
    return {
      pou: {
        id: 'pou-parse-error',
        name: 'ParseError',
        language: 'ST',
        stSource: source,
        localTags: [],
      },
      errors,
      warnings,
    };
  }
}

function mapSTDataType(typeStr: string): IECDataType {
  const upper = typeStr.toUpperCase().trim();
  const map: Record<string, IECDataType> = {
    BOOL: 'BOOL', INT: 'INT', DINT: 'DINT', SINT: 'SINT', LINT: 'LINT',
    UINT: 'UINT', UDINT: 'UDINT', USINT: 'USINT', ULINT: 'ULINT',
    REAL: 'REAL', LREAL: 'LREAL',
    BYTE: 'BYTE', WORD: 'WORD', DWORD: 'DWORD', LWORD: 'LWORD',
    STRING: 'STRING', WSTRING: 'WSTRING', TIME: 'TIME', DATE: 'DATE',
    TON: 'BOOL', TOF: 'BOOL', TP: 'BOOL', CTU: 'BOOL', CTD: 'BOOL',
  };
  // Handle derived types like TON, TOF etc
  if (upper.startsWith('ARRAY')) return 'DINT';
  if (upper.startsWith('STRING[')) return 'STRING';
  return map[upper] || 'DINT';
}

function statementsToFBD(
  statements: ParsedStatement[],
  vars: ParsedVarDecl[]
): { nodes: FBDNode[]; wires: FBDWire[] } {
  const nodes: FBDNode[] = [];
  const wires: FBDWire[] = [];
  let nodeIdx = 0;
  const varTypeMap = new Map(vars.map(v => [v.name, v.dataType]));

  for (const stmt of statements) {
    if (stmt.kind === 'fb_call' && stmt.fbCall) {
      const fb = stmt.fbCall;
      const blockId = `st-fbd-${nodeIdx++}`;

      const inputs: Pin[] = fb.params
        .filter(p => p.direction === 'in')
        .map((p, i) => ({ id: `${blockId}-in-${i}`, name: p.name, dataType: 'BOOL' as IECDataType }));
      const outputs: Pin[] = fb.params
        .filter(p => p.direction === 'out')
        .map((p, i) => ({ id: `${blockId}-out-${i}`, name: p.name, dataType: 'BOOL' as IECDataType }));

      // Add default output if none specified
      if (outputs.length === 0) {
        outputs.push({ id: `${blockId}-out-Q`, name: 'Q', dataType: 'BOOL' });
      }

      nodes.push({
        id: blockId,
        type: fb.fbType as FBDBlockType,
        instanceName: fb.instanceName,
        position: { x: 200, y: nodeIdx * 100 },
        inputs,
        outputs,
      });

      // Create IN_VARIABLE nodes for each input param value
      for (const param of fb.params.filter(p => p.direction === 'in')) {
        const varId = `st-fbd-var-${nodeIdx++}`;
        nodes.push({
          id: varId,
          type: 'IN_VARIABLE',
          tag: { name: param.value, dataType: 'BOOL' },
          position: { x: 50, y: nodeIdx * 80 },
          inputs: [],
          outputs: [{ id: `${varId}-out`, name: 'OUT', dataType: 'BOOL' }],
        });
        const targetPin = inputs.find(p => p.name === param.name);
        if (targetPin) {
          wires.push({
            id: `wire-${varId}-to-${blockId}`,
            from: { nodeId: varId, pin: 'OUT' },
            to: { nodeId: blockId, pin: param.name },
          });
        }
      }

      // Create OUT_VARIABLE nodes for output params
      for (const param of fb.params.filter(p => p.direction === 'out')) {
        const varId = `st-fbd-var-${nodeIdx++}`;
        nodes.push({
          id: varId,
          type: 'OUT_VARIABLE',
          tag: { name: param.value, dataType: 'BOOL' },
          position: { x: 400, y: nodeIdx * 80 },
          inputs: [{ id: `${varId}-in`, name: 'IN', dataType: 'BOOL' }],
          outputs: [],
        });
        wires.push({
          id: `wire-${blockId}-to-${varId}`,
          from: { nodeId: blockId, pin: param.name },
          to: { nodeId: varId, pin: 'IN' },
        });
      }
    } else if (stmt.kind === 'assignment' && stmt.assignment) {
      // Simple boolean assignments with AND/OR can map to logic blocks
      const assign = stmt.assignment;
      const exprUpper = assign.expression.toUpperCase();

      if (exprUpper.includes(' AND ') || exprUpper.includes(' OR ') || exprUpper.includes(' XOR ')) {
        const opMatch = exprUpper.match(/\b(AND|OR|XOR)\b/);
        if (opMatch) {
          const op = opMatch[1] as FBDBlockType;
          const parts = assign.expression.split(new RegExp(`\\b${op}\\b`, 'i')).map(s => s.trim());
          const blockId = `st-fbd-${nodeIdx++}`;
          const inputs: Pin[] = parts.map((_, i) => ({
            id: `${blockId}-in-${i}`, name: `IN${i + 1}`, dataType: 'BOOL' as IECDataType,
          }));
          const outputs: Pin[] = [{ id: `${blockId}-out-0`, name: 'OUT', dataType: 'BOOL' }];

          nodes.push({
            id: blockId,
            type: op,
            position: { x: 200, y: nodeIdx * 100 },
            inputs,
            outputs,
          });

          // Input variable nodes
          for (let pi = 0; pi < parts.length; pi++) {
            const varId = `st-fbd-var-${nodeIdx++}`;
            nodes.push({
              id: varId,
              type: 'IN_VARIABLE',
              tag: { name: parts[pi], dataType: 'BOOL' },
              position: { x: 50, y: nodeIdx * 80 },
              inputs: [],
              outputs: [{ id: `${varId}-out`, name: 'OUT', dataType: 'BOOL' }],
            });
            wires.push({
              id: `wire-${varId}-to-${blockId}`,
              from: { nodeId: varId, pin: 'OUT' },
              to: { nodeId: blockId, pin: `IN${pi + 1}` },
            });
          }

          // Output variable node
          const outVarId = `st-fbd-var-${nodeIdx++}`;
          nodes.push({
            id: outVarId,
            type: 'OUT_VARIABLE',
            tag: { name: assign.target, dataType: 'BOOL' },
            position: { x: 400, y: nodeIdx * 80 },
            inputs: [{ id: `${outVarId}-in`, name: 'IN', dataType: 'BOOL' }],
            outputs: [],
          });
          wires.push({
            id: `wire-${blockId}-to-${outVarId}`,
            from: { nodeId: blockId, pin: 'OUT' },
            to: { nodeId: outVarId, pin: 'IN' },
          });
        }
      }
    }
  }

  return { nodes, wires };
}
