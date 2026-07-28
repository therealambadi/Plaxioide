export type TagState = Record<string, any>;

export interface FBInstanceState {
  type: string;
  prevInputs: Record<string, any>;
  outputs: Record<string, any>;
  internal: Record<string, any>;
}

export interface ScanResult {
  tick: number;
  tagValues: TagState;
  energized: Record<string, boolean>;
  sfcActive: Record<string, boolean>;
}

export interface FBContext {
  dt: number; // milliseconds since last scan
}
