// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * Diagnostic POU context — annotate `CompileError` records with the
 * POU + section that contains them, plus a body-relative line number
 * for body errors.
 *
 * Why a post-pass instead of populating the fields where each error is
 * created: errors are emitted from many places (parser, AST builder,
 * project model, semantic analyzer, codegen) and they all already carry
 * `(line, column, file)`.  A single post-pass walks the AST once,
 * builds an interval table per `(file, line)`, and decorates every
 * collected error in O(errors × log POUs) — much cheaper than threading
 * POU/section state through every diagnostic site.
 *
 * Standalone CLI use of strucpp doesn't read these fields; they're only
 * surfaced through the programmatic API to consumers like the OpenPLC
 * Editor that need to remap from "line in monolithic program.st" to
 * "line in the user's POU body view".
 */
/**
 * Build the per-POU section table for a compilation unit.  Walks every
 * top-level POU plus every method body inside a function block.
 */
function buildPouRanges(ast) {
    const out = [];
    for (const prog of ast.programs) {
        out.push(rangeFromPou(prog, "PROGRAM"));
    }
    for (const fn of ast.functions) {
        out.push(rangeFromPou(fn, "FUNCTION"));
    }
    for (const fb of ast.functionBlocks) {
        out.push(rangeFromPou(fb, "FUNCTION_BLOCK"));
        // Methods are addressable as POU bodies in their own right — surface
        // them under the parent FB's name with kind FUNCTION_BLOCK so the
        // editor opens the right tab.  (Method-level addressing would need
        // a separate mechanism that the editor doesn't currently expose.)
        for (const m of fb.methods) {
            out.push(rangeFromMethod(fb, m));
        }
    }
    return out;
}
function rangeFromPou(pou, kind) {
    const bodySpan = spanOfStatements(pou.body);
    return {
        pouName: pou.name,
        pouKind: kind,
        file: pou.sourceSpan.file,
        pouStartLine: pou.sourceSpan.startLine,
        pouEndLine: pou.sourceSpan.endLine,
        varBlockSpans: pou.varBlocks.map(spanOfBlock),
        varDeclarations: collectVarDeclarations(pou.varBlocks),
        ...(bodySpan ? { bodySpan } : {}),
    };
}
function rangeFromMethod(fb, method) {
    const bodySpan = spanOfStatements(method.body);
    return {
        pouName: fb.name,
        pouKind: "FUNCTION_BLOCK",
        file: method.sourceSpan.file,
        pouStartLine: method.sourceSpan.startLine,
        pouEndLine: method.sourceSpan.endLine,
        varBlockSpans: method.varBlocks.map(spanOfBlock),
        varDeclarations: collectVarDeclarations(method.varBlocks),
        ...(bodySpan ? { bodySpan } : {}),
    };
}
function spanOfBlock(block) {
    return { start: block.sourceSpan.startLine, end: block.sourceSpan.endLine };
}
function collectVarDeclarations(blocks) {
    const out = [];
    for (const block of blocks) {
        for (const decl of block.declarations) {
            // A single VAR statement can declare multiple names
            // (`a, b, c : INT;`); attribute the diagnostic to the first one
            // — that's what the type-checker's synthetic anchor uses too.
            const name = decl.names[0];
            if (!name)
                continue;
            out.push({
                start: decl.sourceSpan.startLine,
                end: decl.sourceSpan.endLine,
                name,
            });
        }
    }
    return out;
}
function spanOfStatements(body) {
    if (body.length === 0)
        return undefined;
    let start = Infinity;
    let end = -Infinity;
    for (const s of body) {
        if (s.sourceSpan.startLine < start)
            start = s.sourceSpan.startLine;
        if (s.sourceSpan.endLine > end)
            end = s.sourceSpan.endLine;
    }
    return { start, end };
}
function lineInside(line, span) {
    return line >= span.start && line <= span.end;
}
/**
 * Mutate `errors` in place, populating `pouName` / `pouKind` /
 * `section` / `bodyLine` on every record that maps into one of the
 * POU ranges built from `ast`.  Errors with no `line` (or `line === 0`,
 * which we use as a sentinel for diagnostics not tied to a source
 * location) are left untouched.
 *
 * Errors whose `file` doesn't match any POU's source file (e.g. the
 * synthetic `_types.st` / `_config.st` chunks the editor splits out)
 * also fall through unchanged — those map to non-POU sections in the
 * editor and don't need POU-relative location.
 */
export function annotateErrorsWithPouContext(errors, ast) {
    if (errors.length === 0)
        return;
    const ranges = buildPouRanges(ast);
    if (ranges.length === 0)
        return;
    for (const err of errors) {
        if (err.line <= 0)
            continue;
        const fileMatch = err.file ?? "";
        // Find the POU whose declaration span covers this line.  When
        // multiple POUs share a file (the typical multi-POU program.st
        // case) we pick the first whose span includes the line.  Method
        // ranges deliberately come after the parent FB in `ranges`, but
        // method spans are tighter — we match the tightest by preferring
        // the smallest enclosing range.
        let best;
        let bestSize = Infinity;
        for (const r of ranges) {
            if (r.file !== fileMatch)
                continue;
            if (err.line < r.pouStartLine || err.line > r.pouEndLine)
                continue;
            const size = r.pouEndLine - r.pouStartLine;
            if (size < bestSize) {
                best = r;
                bestSize = size;
            }
        }
        if (!best)
            continue;
        err.pouName = best.pouName;
        err.pouKind = best.pouKind;
        // Section detection — var-block spans win over body span when
        // they overlap (var blocks always precede the body in IEC).
        const inVarBlock = best.varBlockSpans.some((s) => lineInside(err.line, s));
        if (inVarBlock) {
            err.section = "var-block";
            // The editor uses `line` directly for var-block errors — the
            // var block sits at the top of the per-POU .st file, so file
            // line and Monaco vars-text line align.
            const decl = best.varDeclarations.find((d) => lineInside(err.line, d));
            if (decl)
                err.variableName = decl.name;
            continue;
        }
        if (best.bodySpan && lineInside(err.line, best.bodySpan)) {
            err.section = "body";
            err.bodyLine = err.line - best.bodySpan.start + 1;
            continue;
        }
        err.section = "interface";
    }
}
//# sourceMappingURL=diagnostic-pou-context.js.map