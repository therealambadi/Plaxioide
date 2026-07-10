// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * Library configuration file (`library.json`).
 *
 * Each library on disk lives in `libs/sources/<lib-name>/` and ships a
 * `library.json` next to its `.st` source files. The JSON carries every
 * field of the .stlib manifest that ISN'T derivable from the ST sources:
 *
 *   - identity (name, version, namespace)
 *   - human-readable description
 *   - the `isBuiltin` flag
 *   - block-level documentation prose (one entry per FUNCTION_BLOCK)
 *   - function-level documentation prose (one entry per FUNCTION)
 *
 * The build flow is:
 *
 *   1. Read library.json from the library's source directory
 *      (loadLibraryConfig).
 *   2. Read all .st files alongside it.
 *   3. Call compileStlib(sources, options-from-config).
 *   4. Merge per-block / per-function documentation into the resulting
 *      manifest entries (applyLibraryConfigDocumentation), validating
 *      that every doc'd name actually appears in the compiled output.
 *
 * library.json is the single source of truth for library metadata.
 * Build scripts may still hardcode defaults for libraries that haven't
 * been migrated yet — loadLibraryConfig returns null when the file is
 * absent, and the caller falls back to its own constants.
 */
/**
 * Parse a `library.json` payload that the caller has already
 * obtained from somewhere (disk, HTTP fetch, IPC, …).  `sourceLabel`
 * rides on diagnostics so a malformed config still points at a
 * meaningful location.
 *
 * Throws on parse errors and on schema violations so build failures
 * are loud and pinpoint the misconfigured input.
 */
export function loadLibraryConfigFromString(json, sourceLabel) {
    let raw;
    try {
        raw = JSON.parse(json);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`${sourceLabel}: invalid JSON — ${msg}`);
    }
    return validateLibraryConfig(raw, sourceLabel);
}
function validateLibraryConfig(raw, path) {
    if (typeof raw !== "object" || raw === null) {
        throw new Error(`${path}: top-level value must be an object`);
    }
    const obj = raw;
    for (const required of ["name", "version", "namespace"]) {
        if (typeof obj[required] !== "string" || obj[required] === "") {
            throw new Error(`${path}: missing or non-string field "${required}"`);
        }
    }
    const config = {
        name: obj.name,
        version: obj.version,
        namespace: obj.namespace,
    };
    if (typeof obj.displayName === "string")
        config.displayName = obj.displayName;
    if (typeof obj.description === "string")
        config.description = obj.description;
    if (typeof obj.isBuiltin === "boolean")
        config.isBuiltin = obj.isBuiltin;
    if (typeof obj.codesysSource === "string")
        config.codesysSource = obj.codesysSource;
    if (obj.globalConstants !== undefined) {
        config.globalConstants = validateGlobalConstants(obj.globalConstants, path);
    }
    if (obj.blocks !== undefined) {
        config.blocks = validateDocMap(obj.blocks, "blocks", path);
    }
    if (obj.functions !== undefined) {
        config.functions = validateDocMap(obj.functions, "functions", path);
    }
    return config;
}
function validateGlobalConstants(value, path) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${path}: "globalConstants" must be an object map`);
    }
    const out = {};
    for (const [key, v] of Object.entries(value)) {
        if (typeof v !== "number" || !Number.isFinite(v)) {
            throw new Error(`${path}: globalConstants["${key}"] must be a finite number`);
        }
        out[key] = v;
    }
    return out;
}
function validateDocMap(value, field, path) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${path}: "${field}" must be an object map`);
    }
    const map = value;
    const out = {};
    for (const [name, entry] of Object.entries(map)) {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
            throw new Error(`${path}: ${field}["${name}"] must be an object with a "documentation" field`);
        }
        const entryObj = entry;
        if (typeof entryObj.documentation !== "string") {
            throw new Error(`${path}: ${field}["${name}"].documentation must be a string`);
        }
        out[name] = { documentation: entryObj.documentation };
    }
    return out;
}
/**
 * Merge `LibraryConfig.blocks` and `.functions` documentation into the
 * compiled archive's manifest, in place. Returns a report of what was
 * applied and what was unmatched so the caller can fail the build on
 * mismatch.
 *
 * Names are matched case-sensitively — STruC++ FB / function names are
 * uppercased by the parser before they reach the manifest, so the
 * library.json keys must use the same casing the source declares.
 */
export function applyLibraryConfigDocumentation(archive, config) {
    const result = {
        blocksDocumented: 0,
        functionsDocumented: 0,
        unknownBlockDocs: [],
        unknownFunctionDocs: [],
    };
    if (config.blocks) {
        const fbByName = new Map(archive.manifest.functionBlocks.map((fb) => [fb.name, fb]));
        for (const [name, entry] of Object.entries(config.blocks)) {
            const fb = fbByName.get(name);
            if (!fb) {
                result.unknownBlockDocs.push(name);
                continue;
            }
            fb.documentation = entry.documentation;
            result.blocksDocumented++;
        }
    }
    if (config.functions) {
        const fnByName = new Map(archive.manifest.functions.map((fn) => [fn.name, fn]));
        for (const [name, entry] of Object.entries(config.functions)) {
            const fn = fnByName.get(name);
            if (!fn) {
                result.unknownFunctionDocs.push(name);
                continue;
            }
            fn.documentation = entry.documentation;
            result.functionsDocumented++;
        }
    }
    return result;
}
//# sourceMappingURL=library-config.js.map