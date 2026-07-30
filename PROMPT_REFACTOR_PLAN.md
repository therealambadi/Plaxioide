# PLC Prompt Refactoring Plan

## Line Ranges for Each Section (from original prompts.ts lines 539-1968)

- plcBaseInstructions: lines 539-614 (file naming, check before create, orchestration, tool usage, output rules)
- plcSafetyRules: lines 616-620 (IEC 61131-3 safety rules)
- plcStRules: lines 623-691 (ST authoring rules)
- plcLdSchema: lines 692-828 (.ld.json exact schema + working example)
- plcFbdSchema: lines 830-930 (.fbd.json exact schema + working example)
- plcSfcSchema: lines 932-994 (.sfc.json exact schema + working example)
- plcToolWorkflow: lines 996-1082 (PLC tool workflow mandatory procedure + offer other languages)
- plcQualityChecklist: lines 1084-1127 (quality verification checklist)
- plcAutoImportWorkflow: lines 1130-1148 (full auto-import pipeline)
- plcFuxaHmiBlock: lines 1151-1967 (entire FUXA simulator reference)

## Conditional Logic
```typescript
export function buildConditionalPlcPrompt(context: {
  activeFileExtension?: string;
  userMessage?: string;
  chatMode: string;
}): string {
  const sections: string[] = [];
  
  // Always include
  sections.push(plcBaseInstructions, plcSafetyRules, plcToolWorkflow);
  
  const ext = context.activeFileExtension?.toLowerCase();
  const msg = context.userMessage?.toLowerCase() || '';
  
  // LD
  if (ext === '.ld.json' || msg.includes('ladder') || msg.includes('ld')) {
    sections.push(plcLdSchema, plcQualityChecklist);
  }
  
  // FBD
  if (ext === '.fbd.json' || msg.includes('fbd') || msg.includes('function block')) {
    sections.push(plcFbdSchema, plcQualityChecklist);
  }
  
  // SFC
  if (ext === '.sfc.json' || msg.includes('sfc') || msg.includes('sequential')) {
    sections.push(plcSfcSchema, plcQualityChecklist);
  }
  
  // ST
  if (ext === '.st' || msg.includes('structured text') || msg.includes('st program')) {
    sections.push(plcStRules);
  }
  
  // Import
  if (msg.includes('import') || msg.includes('vendor') || msg.includes('l5x') ||
      msg.includes('simatic') || msg.includes('upload') || msg.includes('attach')) {
    sections.push(plcAutoImportWorkflow);
  }
  
  // Simulation
  if (msg.includes('simulation') || msg.includes('hmi') || msg.includes('fuxa') ||
      msg.includes('scada') || msg.includes('animate') || msg.includes('dashboard') ||
      msg.includes('view')) {
    sections.push(plcFuxaHmiBlock);
  }
  
  // General generation (all schemas)
  if (msg.includes('create') || msg.includes('generate') || msg.includes('new program') ||
      msg.includes('write a')) {
    if (!sections.includes(plcLdSchema)) sections.push(plcLdSchema);
    if (!sections.includes(plcFbdSchema)) sections.push(plcFbdSchema);
    if (!sections.includes(plcSfcSchema)) sections.push(plcSfcSchema);
    if (!sections.includes(plcQualityChecklist)) sections.push(plcQualityChecklist);
  }
  
  // Agent/gather mode always gets quality checklist
  if (context.chatMode === 'agent' || context.chatMode === 'gather') {
    if (!sections.includes(plcQualityChecklist)) sections.push(plcQualityChecklist);
  }
  
  return sections.join('\n\n');
}
```

## Changes Needed

### src/vs/workbench/contrib/void/common/prompt/prompts.ts
1. Add extractExtension helper
2. Split plcPrompt into named constants (plcBaseInstructions, etc.)
3. Add buildConditionalPlcPrompt export
4. Modify chat_systemMessage to accept userMessage parameter and use buildConditionalPlcPrompt

### src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts
1. Modify _generateChatMessagesSystemMessage to extract last user message from chat
2. Pass userMessage to chat_systemMessage

### out/ files
- Mirror the same changes in compiled JS format
