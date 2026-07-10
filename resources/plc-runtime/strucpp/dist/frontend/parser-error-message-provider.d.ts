/**
 * Custom chevrotain {@link IParserErrorMessageProvider} for the
 * Structured Text grammar.
 *
 * The default provider on chevrotain's `NoViableAltException` enumerates
 * every valid token path through every alternative of the failed `OR()`.
 * For statement-level alternations in this grammar that's ~1,400 paths;
 * the message that lands in front of the user is unreadable.
 *
 * This module replaces those messages with concise, rule-aware
 * sentences that name the actual unexpected token and describe what
 * rule was being parsed.  The full path enumeration is preserved only
 * for grammar-debugging purposes — set `STRUCPP_VERBOSE_PARSER_ERRORS=1`
 * to bypass this provider and fall back to chevrotain's default.
 *
 * The {@link RULE_DESCRIPTIONS} table grows organically.  When a user
 * reports a confusing message, add a friendly description for the rule
 * name that surfaced.  Anything unmapped falls back to
 * `parsing rule \`<ruleName>\`` — degraded but never broken.
 */
import type { IParserErrorMessageProvider, IToken, TokenType } from "chevrotain";
/**
 * The provider chevrotain consults whenever it has to format a parse
 * error.  Each method below mirrors the corresponding method on
 * {@link IParserErrorMessageProvider}; signatures must match the
 * chevrotain contract exactly.
 */
export declare const stParserErrorMessageProvider: IParserErrorMessageProvider;
/**
 * Internal helper exported for the suggestion layer.  Given a parser
 * rule name and the actual unexpected token, return a short
 * remediation hint or `undefined` when the case isn't covered.
 *
 * Kept in this file (rather than in `index.ts`) so the rule-name
 * → suggestion mapping lives next to the rule-name → description
 * mapping it builds on.  Add an entry whenever a real-world error
 * makes the simple-format message insufficient.
 */
export declare function suggestionForParseError(ruleName: string, actual: IToken | undefined): string | undefined;
/**
 * Whether to use the custom provider (default) or fall back to
 * chevrotain's verbose path-listing provider.  Set
 * `STRUCPP_VERBOSE_PARSER_ERRORS=1` in the environment to see the
 * full alternation paths — useful when *debugging the grammar
 * itself*, never in front of end users.
 *
 * Resolved at parser-construction time, so flipping the env var
 * mid-process won't have any effect (which is the right behaviour —
 * chevrotain caches the provider into its initialised parser).
 */
export declare function shouldUseVerboseErrors(): boolean;
/**
 * The provider to install on the parser.  Returns `undefined` (so
 * chevrotain uses its default) when the verbose escape hatch is on.
 */
export declare function resolveErrorMessageProvider(): IParserErrorMessageProvider | undefined;
export type { TokenType };
//# sourceMappingURL=parser-error-message-provider.d.ts.map