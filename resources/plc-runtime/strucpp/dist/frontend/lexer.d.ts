/**
 * STruC++ Lexer
 *
 * Tokenizes IEC 61131-3 Structured Text source code using Chevrotain.
 * This module defines all tokens used by the ST grammar.
 */
import { Lexer } from "chevrotain";
/**
 * Whitespace tokens (skipped during parsing)
 */
export declare const WhiteSpace: import("chevrotain").TokenType;
/**
 * External code pragma token: {external ... }
 * Content is passed through AS-IS to generated C++ code.
 */
export declare const ExternalPragma: import("chevrotain").TokenType;
/**
 * Comment token with support for nested block comments.
 * - Single-line: // ... (to end of line)
 * - Block: (* ... *) with arbitrary nesting depth
 */
export declare const Comment: import("chevrotain").TokenType;
export declare const PROGRAM: import("chevrotain").TokenType;
export declare const END_PROGRAM: import("chevrotain").TokenType;
export declare const FUNCTION: import("chevrotain").TokenType;
export declare const END_FUNCTION: import("chevrotain").TokenType;
export declare const FUNCTION_BLOCK: import("chevrotain").TokenType;
export declare const END_FUNCTION_BLOCK: import("chevrotain").TokenType;
export declare const VAR: import("chevrotain").TokenType;
export declare const END_VAR: import("chevrotain").TokenType;
export declare const VAR_INPUT: import("chevrotain").TokenType;
export declare const VAR_OUTPUT: import("chevrotain").TokenType;
export declare const VAR_IN_OUT: import("chevrotain").TokenType;
export declare const VAR_EXTERNAL: import("chevrotain").TokenType;
export declare const VAR_GLOBAL: import("chevrotain").TokenType;
export declare const VAR_TEMP: import("chevrotain").TokenType;
export declare const CONSTANT: import("chevrotain").TokenType;
export declare const RETAIN: import("chevrotain").TokenType;
export declare const AT: import("chevrotain").TokenType;
export declare const TYPE: import("chevrotain").TokenType;
export declare const END_TYPE: import("chevrotain").TokenType;
export declare const STRUCT: import("chevrotain").TokenType;
export declare const END_STRUCT: import("chevrotain").TokenType;
export declare const ARRAY: import("chevrotain").TokenType;
export declare const OF: import("chevrotain").TokenType;
export declare const CONFIGURATION: import("chevrotain").TokenType;
export declare const END_CONFIGURATION: import("chevrotain").TokenType;
export declare const RESOURCE: import("chevrotain").TokenType;
export declare const END_RESOURCE: import("chevrotain").TokenType;
export declare const TASK: import("chevrotain").TokenType;
export declare const WITH: import("chevrotain").TokenType;
export declare const ON: import("chevrotain").TokenType;
export declare const IF: import("chevrotain").TokenType;
export declare const THEN: import("chevrotain").TokenType;
export declare const ELSIF: import("chevrotain").TokenType;
export declare const ELSE: import("chevrotain").TokenType;
export declare const END_IF: import("chevrotain").TokenType;
export declare const CASE: import("chevrotain").TokenType;
export declare const END_CASE: import("chevrotain").TokenType;
export declare const FOR: import("chevrotain").TokenType;
export declare const TO: import("chevrotain").TokenType;
export declare const BY: import("chevrotain").TokenType;
export declare const DO: import("chevrotain").TokenType;
export declare const END_FOR: import("chevrotain").TokenType;
export declare const WHILE: import("chevrotain").TokenType;
export declare const END_WHILE: import("chevrotain").TokenType;
export declare const REPEAT: import("chevrotain").TokenType;
export declare const UNTIL: import("chevrotain").TokenType;
export declare const END_REPEAT: import("chevrotain").TokenType;
export declare const EXIT: import("chevrotain").TokenType;
export declare const RETURN: import("chevrotain").TokenType;
export declare const TRUE: import("chevrotain").TokenType;
export declare const FALSE: import("chevrotain").TokenType;
export declare const AND: import("chevrotain").TokenType;
export declare const OR: import("chevrotain").TokenType;
export declare const XOR: import("chevrotain").TokenType;
export declare const NOT: import("chevrotain").TokenType;
export declare const MOD: import("chevrotain").TokenType;
export declare const REFERENCE_TO: import("chevrotain").TokenType;
export declare const REF_TO: import("chevrotain").TokenType;
export declare const DREF: import("chevrotain").TokenType;
export declare const REF: import("chevrotain").TokenType;
export declare const NULL: import("chevrotain").TokenType;
export declare const POINTER: import("chevrotain").TokenType;
export declare const __NEW: import("chevrotain").TokenType;
export declare const __DELETE: import("chevrotain").TokenType;
export declare const TEST: import("chevrotain").TokenType;
export declare const END_TEST: import("chevrotain").TokenType;
export declare const ASSERT_EQ: import("chevrotain").TokenType;
export declare const ASSERT_TRUE: import("chevrotain").TokenType;
export declare const ASSERT_FALSE: import("chevrotain").TokenType;
export declare const ASSERT_NEQ: import("chevrotain").TokenType;
export declare const ASSERT_GT: import("chevrotain").TokenType;
export declare const ASSERT_LT: import("chevrotain").TokenType;
export declare const ASSERT_GE: import("chevrotain").TokenType;
export declare const ASSERT_LE: import("chevrotain").TokenType;
export declare const ASSERT_NEAR: import("chevrotain").TokenType;
export declare const ADVANCE_TIME: import("chevrotain").TokenType;
export declare const SETUP: import("chevrotain").TokenType;
export declare const END_SETUP: import("chevrotain").TokenType;
export declare const TEARDOWN: import("chevrotain").TokenType;
export declare const END_TEARDOWN: import("chevrotain").TokenType;
export declare const MOCK_VERIFY_CALL_COUNT: import("chevrotain").TokenType;
export declare const MOCK_VERIFY_CALLED: import("chevrotain").TokenType;
export declare const MOCK_FUNCTION: import("chevrotain").TokenType;
export declare const MOCK: import("chevrotain").TokenType;
export declare const RETURNS: import("chevrotain").TokenType;
export declare const METHOD: import("chevrotain").TokenType;
export declare const END_METHOD: import("chevrotain").TokenType;
export declare const INTERFACE: import("chevrotain").TokenType;
export declare const END_INTERFACE: import("chevrotain").TokenType;
export declare const EXTENDS: import("chevrotain").TokenType;
export declare const IMPLEMENTS: import("chevrotain").TokenType;
export declare const THIS: import("chevrotain").TokenType;
export declare const SUPER: import("chevrotain").TokenType;
export declare const PROPERTY: import("chevrotain").TokenType;
export declare const END_PROPERTY: import("chevrotain").TokenType;
export declare const GET: import("chevrotain").TokenType;
export declare const END_GET: import("chevrotain").TokenType;
export declare const SET: import("chevrotain").TokenType;
export declare const END_SET: import("chevrotain").TokenType;
export declare const ABSTRACT: import("chevrotain").TokenType;
export declare const FINAL: import("chevrotain").TokenType;
export declare const OVERRIDE: import("chevrotain").TokenType;
export declare const PUBLIC: import("chevrotain").TokenType;
export declare const PRIVATE: import("chevrotain").TokenType;
export declare const PROTECTED: import("chevrotain").TokenType;
export declare const VAR_INST: import("chevrotain").TokenType;
export declare const TimeLiteral: import("chevrotain").TokenType;
export declare const DateLiteral: import("chevrotain").TokenType;
export declare const TimeOfDayLiteral: import("chevrotain").TokenType;
export declare const DateTimeLiteral: import("chevrotain").TokenType;
export declare const TypedLiteral: import("chevrotain").TokenType;
export declare const RealLiteral: import("chevrotain").TokenType;
export declare const IntegerLiteral: import("chevrotain").TokenType;
export declare const StringLiteral: import("chevrotain").TokenType;
export declare const WideStringLiteral: import("chevrotain").TokenType;
export declare const RefAssign: import("chevrotain").TokenType;
export declare const Assign: import("chevrotain").TokenType;
export declare const OutputAssign: import("chevrotain").TokenType;
export declare const Colon: import("chevrotain").TokenType;
export declare const Semicolon: import("chevrotain").TokenType;
export declare const Comma: import("chevrotain").TokenType;
export declare const Dot: import("chevrotain").TokenType;
export declare const DoubleDot: import("chevrotain").TokenType;
export declare const LParen: import("chevrotain").TokenType;
export declare const RParen: import("chevrotain").TokenType;
export declare const LBracket: import("chevrotain").TokenType;
export declare const RBracket: import("chevrotain").TokenType;
export declare const Equal: import("chevrotain").TokenType;
export declare const NotEqual: import("chevrotain").TokenType;
export declare const LessEqual: import("chevrotain").TokenType;
export declare const GreaterEqual: import("chevrotain").TokenType;
export declare const Less: import("chevrotain").TokenType;
export declare const Greater: import("chevrotain").TokenType;
export declare const Plus: import("chevrotain").TokenType;
export declare const Minus: import("chevrotain").TokenType;
export declare const Star: import("chevrotain").TokenType;
export declare const Slash: import("chevrotain").TokenType;
export declare const Power: import("chevrotain").TokenType;
export declare const Caret: import("chevrotain").TokenType;
export declare const Ampersand: import("chevrotain").TokenType;
export declare const DirectAddress: import("chevrotain").TokenType;
export declare const Identifier: import("chevrotain").TokenType;
/**
 * All tokens in order of matching priority.
 * Keywords must come before Identifier to be matched correctly.
 */
export declare const allTokens: import("chevrotain").TokenType[];
/**
 * The STruC++ lexer instance.
 */
export declare const STLexer: Lexer;
/**
 * Token list for test files. Built programmatically from allTokens by
 * inserting test-specific keywords (TEST, END_TEST, ASSERT_*, MOCK*, etc.)
 * before the normal keywords section.
 *
 * Test keywords must NOT be in allTokens to avoid conflicting with user
 * identifiers named TEST in normal ST programs.
 */
export declare const allTestTokens: import("chevrotain").TokenType[];
/**
 * The STruC++ test file lexer instance.
 * Uses allTestTokens which includes TEST/END_TEST/ASSERT_* tokens.
 */
export declare const TestLexer: Lexer;
/**
 * Uppercase ST source while preserving case inside string literals,
 * wide string literals, block comments, and line comments.
 * IEC 61131-3 is case-insensitive, so this normalizes identifiers/keywords.
 */
export declare function uppercaseSource(source: string): string;
/**
 * Tokenize ST source code.
 *
 * @param source - The ST source code to tokenize
 * @returns Lexer result with tokens and any lexing errors
 */
export declare function tokenize(source: string): ReturnType<typeof STLexer.tokenize>;
/**
 * Tokenize test file source code using the test lexer.
 * Identical to tokenize() but uses TestLexer (which recognizes TEST/ASSERT_* tokens).
 *
 * @param source - The test file source code to tokenize
 * @returns Lexer result with tokens and any lexing errors
 */
export declare function tokenizeTest(source: string): ReturnType<typeof TestLexer.tokenize>;
//# sourceMappingURL=lexer.d.ts.map