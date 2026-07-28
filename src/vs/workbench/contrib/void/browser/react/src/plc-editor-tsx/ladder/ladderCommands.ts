/*
 * Ladder command implementations.
 *
 * Each exported function wraps a logicStore mutation with undo-stack capture.
 * All operations are atomic and properly tracked for undo/redo.
 *
 * Element insertion commands support optional `atIndex` parameter for
 * precise insertion point control (used by drag-and-drop).
 */

import { logicStore, LadderElement, ContactType, CoilType, FBType, TagRef, Branch } from '../logicStore.js';
import { undoRedoStore } from '../undoRedoStore.js';

const withUndo = (fn: () => void) => {
  undoRedoStore.push();
  fn();
};

// ── Rung commands ──────────────────────────────────────────────────────────────

export const insertRung = (afterIndex?: number) =>
  withUndo(() => logicStore.addRung(afterIndex));

export const deleteRung = (rungId: string) =>
  withUndo(() => logicStore.deleteRung(rungId));

export const duplicateRung = (rungId: string) =>
  withUndo(() => logicStore.duplicateRung(rungId));

export const moveRung = (fromIdx: number, toIdx: number) =>
  withUndo(() => logicStore.moveRung(fromIdx, toIdx));

export const setRungComment = (rungId: string, comment: string) =>
  logicStore.updateRungComment(rungId, comment);

export const copyRungs = (rungIds: string[]) =>
  logicStore.copyRungs(rungIds);

export const pasteRungs = (afterIndex?: number) =>
  withUndo(() => logicStore.pasteRungs(afterIndex));

// ── Element insertion commands ─────────────────────────────────────────────────

export const insertContact = (
  rungId: string,
  tag: TagRef,
  type: ContactType = 'NO',
  atIndex?: number
) =>
  withUndo(() => {
    const el: LadderElement = {
      kind: 'contact',
      id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      tag,
      position: { x: atIndex !== undefined ? atIndex * 60 : 0, y: 0 },
    };
    insertElementAtIndex(rungId, el, atIndex);
  });

export const insertCoil = (
  rungId: string,
  tag: TagRef,
  type: CoilType = 'normal',
  atIndex?: number
) =>
  withUndo(() => {
    const el: LadderElement = {
      kind: 'coil',
      id: `coil-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      tag,
      position: { x: atIndex !== undefined ? atIndex * 60 : 0, y: 0 },
    };
    insertElementAtIndex(rungId, el, atIndex);
  });

export const insertBlock = (
  rungId: string,
  fbType: FBType,
  instanceName: string,
  atIndex?: number
) =>
  withUndo(() => {
    const el: LadderElement = {
      kind: 'block',
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      fbType,
      instanceName,
      pins: {},
      position: { x: atIndex !== undefined ? atIndex * 80 : 0, y: 0 },
    };
    insertElementAtIndex(rungId, el, atIndex);
  });

function insertElementAtIndex(rungId: string, element: LadderElement, atIndex?: number) {
  const state = logicStore.getState();
  const rung = state.ladderProgram.rungs.find(r => r.id === rungId);
  if (!rung) return;

  if (atIndex === undefined || atIndex >= rung.elements.length) {
    // Append to end
    logicStore.addElementToRung(rungId, element);
  } else {
    // Insert at specific index via setState
    logicStore.setState(d => {
      const r = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (r) r.elements.splice(atIndex, 0, element);
    });
  }
}

// ── Element mutation commands ──────────────────────────────────────────────────

export const updateElementTag = (rungId: string, elementId: string, tag: TagRef) =>
  withUndo(() => {
    logicStore.updateElement(rungId, elementId, { tag } as any);
    // Auto-add assigned tag to watch list if it exists in the tag database
    if (tag.name) {
      const state = logicStore.getState();
      const exists = state.tagDatabase.some(t => t.name === tag.name);
      if (exists) logicStore.addToWatchList(tag.name);
    }
  });

export const updateContactType = (rungId: string, elementId: string, type: ContactType) =>
  withUndo(() => logicStore.updateElement(rungId, elementId, { type } as any));

export const updateCoilType = (rungId: string, elementId: string, type: CoilType) =>
  withUndo(() => logicStore.updateElement(rungId, elementId, { type } as any));

export const deleteElement = (rungId: string, elementId: string) =>
  withUndo(() => logicStore.deleteElement(rungId, elementId));

export const moveElement = (rungId: string, fromIndex: number, toIndex: number) =>
  withUndo(() => {
    logicStore.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (!rung) return;
      const [element] = rung.elements.splice(fromIndex, 1);
      rung.elements.splice(toIndex, 0, element);
    });
  });

// ── Branch commands ────────────────────────────────────────────────────────────

export const insertBranch = (rungId: string, startIdx: number, endIdx: number) =>
  withUndo(() => {
    const branch: Branch = {
      id: `branch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      startNodeId: `node-${startIdx}`,
      endNodeId: `node-${endIdx}`,
      elements: [],
    };
    logicStore.addBranchToRung(rungId, branch);
  });

export const deleteBranch = (rungId: string, branchId: string) =>
  withUndo(() => {
    logicStore.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (!rung) return;
      rung.branches = rung.branches.filter(b => b.id !== branchId);
    });
  });

export const addElementToBranch = (rungId: string, branchId: string, element: LadderElement) =>
  withUndo(() => {
    logicStore.setState(d => {
      const rung = d.ladderProgram.rungs.find(r => r.id === rungId);
      if (!rung) return;
      const branch = rung.branches.find(b => b.id === branchId);
      if (branch) branch.elements.push(element);
    });
  });
