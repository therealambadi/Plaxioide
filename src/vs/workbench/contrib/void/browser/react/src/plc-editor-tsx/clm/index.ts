/*
 * CLM (Canonical Logic Model) — Public API
 */

export { CLMGraph } from './graph.js';
export { clmStore } from './clmStore.js';
export { buildCLMFromStore, parseConditionTagRefs, POU_ID } from './builder.js';
export { projectLadderProgram, projectFBDProgram, projectSFCProgram, projectTagDatabase } from './projections.js';
export { validateCLM } from './validator.js';
export { useCLMInitialized, useCLMLadder, useCLMFBD, useCLMSFC, useCLMTags, useCLMCrossRef, useCLMStats } from './hooks.js';
export type { ValidationError, ValidationSeverity } from './validator.js';
export * from './schema.js';
export { clmToST, resolveTagDebugLeaf, buildTagIndexMap } from './clmToST.js';
export type { STCompileResult, DebugMap, DebugLeaf } from './clmToST.js';
