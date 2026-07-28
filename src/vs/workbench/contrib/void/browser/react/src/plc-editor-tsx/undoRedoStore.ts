/*
 * Undo/Redo command stack for the PLC Logic Editor.
 * Uses a command pattern: each operation produces a Command object with
 * execute() and undo() methods. The stack stores snapshots for simplicity.
 */

import { logicStore, LadderProgram, FBDProgram, SFCProgram } from './logicStore.js';

export interface DiagramSnapshot {
  ladderProgram: LadderProgram;
  fbdProgram: FBDProgram;
  sfcProgram: SFCProgram;
}

const MAX_HISTORY = 100;

class UndoRedoStore {
  private past: DiagramSnapshot[] = [];
  private future: DiagramSnapshot[] = [];
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  private snapshot(): DiagramSnapshot {
    const state = logicStore.getState();
    return {
      ladderProgram: JSON.parse(JSON.stringify(state.ladderProgram)),
      fbdProgram: JSON.parse(JSON.stringify(state.fbdProgram)),
      sfcProgram: JSON.parse(JSON.stringify(state.sfcProgram)),
    };
  }

  /** Call before any mutating operation to capture the current state. */
  push() {
    this.past.push(this.snapshot());
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];  // clear redo on new action
    this.notify();
  }

  undo() {
    if (this.past.length === 0) return;
    const current = this.snapshot();
    this.future.push(current);
    const prev = this.past.pop()!;
    this._restore(prev);
    this.notify();
  }

  redo() {
    if (this.future.length === 0) return;
    const current = this.snapshot();
    this.past.push(current);
    const next = this.future.pop()!;
    this._restore(next);
    this.notify();
  }

  private _restore(snap: DiagramSnapshot) {
    logicStore.loadLadderProgram(snap.ladderProgram);
    logicStore.loadFBDProgram(snap.fbdProgram);
    logicStore.loadSFCProgram(snap.sfcProgram);
  }

  canUndo(): boolean { return this.past.length > 0; }
  canRedo(): boolean { return this.future.length > 0; }
}

export const undoRedoStore = new UndoRedoStore();

import { useState, useEffect } from 'react';

export function useUndoRedo() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return undoRedoStore.subscribe(() => forceUpdate(n => n + 1));
  }, []);
  return {
    undo: () => undoRedoStore.undo(),
    redo: () => undoRedoStore.redo(),
    canUndo: undoRedoStore.canUndo(),
    canRedo: undoRedoStore.canRedo(),
    push: () => undoRedoStore.push(),
  };
}
