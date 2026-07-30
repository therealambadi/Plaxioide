/*
 * CLM React Hooks — Subscribe to CLM store and project data for canvases.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { clmStore } from './clmStore.js';
import type { LadderProgram, FBDProgram, SFCProgram, TagEntry } from '../logicStore.js';

export function useCLMInitialized(): boolean {
  const [init, setInit] = useState(clmStore.initialized);
  useEffect(() => {
    return clmStore.subscribe(() => setInit(clmStore.initialized));
  }, []);
  return init;
}

export function useCLMLadder(): LadderProgram {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return clmStore.subscribe(() => setVersion(v => v + 1));
  }, []);
  return useMemo(() => clmStore.getLadderProgram(), [version]);
}

export function useCLMFBD(): FBDProgram {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return clmStore.subscribe(() => setVersion(v => v + 1));
  }, []);
  return useMemo(() => clmStore.getFBDProgram(), [version]);
}

export function useCLMSFC(): SFCProgram {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return clmStore.subscribe(() => setVersion(v => v + 1));
  }, []);
  return useMemo(() => clmStore.getSFCProgram(), [version]);
}

export function useCLMTags(): TagEntry[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return clmStore.subscribe(() => setVersion(v => v + 1));
  }, []);
  return useMemo(() => clmStore.getTagDatabase(), [version]);
}

export function useCLMCrossRef(tagName: string | null) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return clmStore.subscribe(() => setVersion(v => v + 1));
  }, []);
  return useMemo(() => {
    if (!tagName) return [];
    return clmStore.getCrossReferences(tagName);
  }, [tagName, version]);
}

export function useCLMStats() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    return clmStore.subscribe(() => setVersion(v => v + 1));
  }, []);
  return useMemo(() => ({
    nodeCount: clmStore.graph.nodeCount,
    edgeCount: clmStore.graph.edgeCount,
    initialized: clmStore.initialized,
  }), [version]);
}
