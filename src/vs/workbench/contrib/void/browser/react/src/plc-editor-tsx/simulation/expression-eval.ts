import { TagState } from './types.js';

type Token = { type: 'NUM'; value: number }
  | { type: 'BOOL'; value: boolean }
  | { type: 'STR'; value: string }
  | { type: 'IDENT'; value: string }
  | { type: 'OP'; value: string }
  | { type: 'LPAREN' } | { type: 'RPAREN' }
  | { type: 'EOF' };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }

    if (expr[i] === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (expr[i] === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }

    // Two-char operators
    const two = expr.slice(i, i + 2);
    if (['<>', '<=', '>=', ':='].includes(two)) {
      tokens.push({ type: 'OP', value: two }); i += 2; continue;
    }

    // Single-char operators
    if ('+-*/=<>'.includes(expr[i])) {
      tokens.push({ type: 'OP', value: expr[i] }); i++; continue;
    }

    // Numbers
    if (/\d/.test(expr[i]) || (expr[i] === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push({ type: 'NUM', value: parseFloat(num) }); continue;
    }

    // Identifiers and keywords
    if (/[A-Za-z_]/.test(expr[i])) {
      let ident = '';
      while (i < expr.length && /[A-Za-z0-9_.]/.test(expr[i])) { ident += expr[i]; i++; }
      const upper = ident.toUpperCase();
      if (upper === 'TRUE') tokens.push({ type: 'BOOL', value: true });
      else if (upper === 'FALSE') tokens.push({ type: 'BOOL', value: false });
      else if (['AND', 'OR', 'NOT', 'XOR', 'MOD'].includes(upper)) tokens.push({ type: 'OP', value: upper });
      else tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    i++; // skip unknown chars
  }
  tokens.push({ type: 'EOF' });
  return tokens;
}

// Pratt parser (precedence climbing)
const PREC: Record<string, number> = {
  'OR': 1, 'XOR': 2, 'AND': 3,
  '=': 4, '<>': 4, '<': 5, '>': 5, '<=': 5, '>=': 5,
  '+': 6, '-': 6, '*': 7, '/': 7, 'MOD': 7,
};

export function evaluateExpression(expr: string, tagValues: TagState): any {
  if (!expr || !expr.trim()) return false;
  const tokens = tokenize(expr);
  let pos = 0;

  function peek(): Token { return tokens[pos]; }
  function advance(): Token { return tokens[pos++]; }

  function parseExpr(minPrec = 0): any {
    let left = parseUnary();

    while (true) {
      const t = peek();
      if (t.type !== 'OP') break;
      const prec = PREC[t.value];
      if (prec === undefined || prec < minPrec) break;
      advance();
      const right = parseExpr(prec + 1);
      left = applyBinary(t.value, left, right);
    }
    return left;
  }

  function parseUnary(): any {
    const t = peek();
    if (t.type === 'OP' && t.value === 'NOT') {
      advance();
      return !toBool(parseUnary());
    }
    if (t.type === 'OP' && t.value === '-') {
      advance();
      return -toNum(parseUnary());
    }
    return parsePrimary();
  }

  function parsePrimary(): any {
    const t = peek();
    if (t.type === 'NUM') { advance(); return t.value; }
    if (t.type === 'BOOL') { advance(); return t.value; }
    if (t.type === 'IDENT') {
      advance();
      const val = tagValues[t.value];
      if (val === undefined) return tagValues[t.value.toUpperCase()] ?? false;
      return val;
    }
    if (t.type === 'LPAREN') {
      advance();
      const v = parseExpr(0);
      if (peek().type === 'RPAREN') advance();
      return v;
    }
    advance(); // skip
    return false;
  }

  function applyBinary(op: string, l: any, r: any): any {
    switch (op) {
      case 'AND': return toBool(l) && toBool(r);
      case 'OR': return toBool(l) || toBool(r);
      case 'XOR': return toBool(l) !== toBool(r);
      case '=': return l === r || toNum(l) === toNum(r);
      case '<>': return l !== r && toNum(l) !== toNum(r);
      case '<': return toNum(l) < toNum(r);
      case '>': return toNum(l) > toNum(r);
      case '<=': return toNum(l) <= toNum(r);
      case '>=': return toNum(l) >= toNum(r);
      case '+': return toNum(l) + toNum(r);
      case '-': return toNum(l) - toNum(r);
      case '*': return toNum(l) * toNum(r);
      case '/': { const d = toNum(r); return d === 0 ? 0 : toNum(l) / d; }
      case 'MOD': { const d = toNum(r); return d === 0 ? 0 : toNum(l) % d; }
      default: return false;
    }
  }

  return parseExpr(0);
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'TRUE' || v === '1' || v === 'true';
  if (typeof v === 'number') return v !== 0;
  return !!v;
}

function toNum(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    if (v === 'TRUE' || v === 'true') return 1;
    if (v === 'FALSE' || v === 'false') return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}
