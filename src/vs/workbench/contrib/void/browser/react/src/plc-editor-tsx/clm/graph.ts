/*
 * CLM Graph — Typed wrapper around Graphology for PLC logic models.
 * Single directed multi-graph instance representing the entire program.
 */

import Graph from 'graphology';
import {
  CLMNodeAttributes,
  CLMEdgeAttributes,
  CLMNodeType,
  CLMLanguage,
  CLMEdgeType,
  CLMNodeData,
  TagNodeData,
  RungNodeData,
  LDElementNodeData,
  FBDBlockNodeData,
  FBDPinNodeData,
  SFCStepNodeData,
  SFCTransitionNodeData,
  SFCActionNodeData,
  POUNodeData,
  CLM_VERSION,
  CLMSerializedGraph,
} from './schema.js';

export class CLMGraph {
  readonly graph: Graph<CLMNodeAttributes, CLMEdgeAttributes>;

  constructor() {
    this.graph = new Graph<CLMNodeAttributes, CLMEdgeAttributes>({
      type: 'directed',
      multi: true,
      allowSelfLoops: false,
    });
  }

  // ─── Node operations ─────────────────────────────────────────────────────

  addNode(id: string, type: CLMNodeType, language: CLMLanguage, data: CLMNodeData): string {
    this.graph.addNode(id, { type, language, data });
    return id;
  }

  getNodeAttr(id: string): CLMNodeAttributes {
    return this.graph.getNodeAttributes(id);
  }

  getNodeData<T extends CLMNodeData>(id: string): T {
    return this.graph.getNodeAttribute(id, 'data') as T;
  }

  updateNodeData(id: string, updates: Partial<CLMNodeData>): void {
    const current = this.graph.getNodeAttribute(id, 'data');
    this.graph.setNodeAttribute(id, 'data', { ...current, ...updates });
  }

  removeNode(id: string): void {
    if (this.graph.hasNode(id)) {
      this.graph.dropNode(id);
    }
  }

  hasNode(id: string): boolean {
    return this.graph.hasNode(id);
  }

  // ─── Edge operations ─────────────────────────────────────────────────────

  addEdge(source: string, target: string, type: CLMEdgeType, data?: Record<string, unknown>): string {
    return this.graph.addEdge(source, target, { type, data });
  }

  removeEdge(edgeKey: string): void {
    if (this.graph.hasEdge(edgeKey)) {
      this.graph.dropEdge(edgeKey);
    }
  }

  // ─── Query helpers ───────────────────────────────────────────────────────

  getNodesByType(type: CLMNodeType): string[] {
    const result: string[] = [];
    this.graph.forEachNode((id, attr) => {
      if (attr.type === type) result.push(id);
    });
    return result;
  }

  getNodesByLanguage(language: CLMLanguage): string[] {
    const result: string[] = [];
    this.graph.forEachNode((id, attr) => {
      if (attr.language === language) result.push(id);
    });
    return result;
  }

  getOutEdgesByType(nodeId: string, edgeType: CLMEdgeType): Array<{ edgeKey: string; target: string; data?: Record<string, unknown> }> {
    const result: Array<{ edgeKey: string; target: string; data?: Record<string, unknown> }> = [];
    this.graph.forEachOutEdge(nodeId, (edgeKey, attr, source, target) => {
      if (attr.type === edgeType) {
        result.push({ edgeKey, target, data: attr.data });
      }
    });
    return result;
  }

  getInEdgesByType(nodeId: string, edgeType: CLMEdgeType): Array<{ edgeKey: string; source: string; data?: Record<string, unknown> }> {
    const result: Array<{ edgeKey: string; source: string; data?: Record<string, unknown> }> = [];
    this.graph.forEachInEdge(nodeId, (edgeKey, attr, source) => {
      if (attr.type === edgeType) {
        result.push({ edgeKey, source, data: attr.data });
      }
    });
    return result;
  }

  getChildren(parentId: string): string[] {
    return this.getOutEdgesByType(parentId, 'CONTAINS').map(e => e.target);
  }

  getTagReaders(tagId: string): string[] {
    return this.getInEdgesByType(tagId, 'READS').map(e => e.source);
  }

  getTagWriters(tagId: string): string[] {
    return this.getInEdgesByType(tagId, 'WRITES').map(e => e.source);
  }

  findTagByName(name: string): string | undefined {
    let found: string | undefined;
    this.graph.forEachNode((id, attr) => {
      if (attr.type === 'TAG' && (attr.data as TagNodeData).name === name) {
        found = id;
      }
    });
    return found;
  }

  // ─── Cross-reference: find all elements referencing a tag ────────────────

  getCrossReferences(tagName: string): Array<{ nodeId: string; relation: 'reads' | 'writes'; language: CLMLanguage }> {
    const tagId = this.findTagByName(tagName);
    if (!tagId) return [];

    const result: Array<{ nodeId: string; relation: 'reads' | 'writes'; language: CLMLanguage }> = [];

    this.graph.forEachInEdge(tagId, (_, attr, source) => {
      if (attr.type === 'READS') {
        result.push({ nodeId: source, relation: 'reads', language: this.graph.getNodeAttribute(source, 'language') });
      } else if (attr.type === 'WRITES') {
        result.push({ nodeId: source, relation: 'writes', language: this.graph.getNodeAttribute(source, 'language') });
      }
    });

    return result;
  }

  // ─── Serialization ───────────────────────────────────────────────────────

  export(pouId: string): CLMSerializedGraph {
    return {
      clmVersion: CLM_VERSION,
      pouId,
      graph: this.graph.export(),
    };
  }

  import(serialized: CLMSerializedGraph): void {
    // Always clear first — importing into a non-empty graph merges and can create duplicates
    this.graph.clear();
    this.graph.import(serialized.graph);
  }

  snapshot(): string {
    return JSON.stringify(this.graph.export());
  }

  restoreFromSnapshot(json: string): void {
    const data = JSON.parse(json);
    this.graph.clear();
    this.graph.import(data);
  }

  clear(): void {
    this.graph.clear();
  }

  get nodeCount(): number {
    return this.graph.order;
  }

  get edgeCount(): number {
    return this.graph.size;
  }
}
