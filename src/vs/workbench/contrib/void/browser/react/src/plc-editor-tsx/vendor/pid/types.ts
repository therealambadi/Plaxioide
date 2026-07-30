/**
 * P&ID Vision Parser Types
 *
 * Represents the extracted information from Piping and
 * Instrumentation Diagrams (P&ID) for automatic PLC
 * code generation.
 */

// ─── ISA 5.1 Instrument Identification ──────────────────────────────────────

export type InstrumentFirstLetter =
  | 'A' // Analysis
  | 'B' // Burner/Combustion
  | 'C' // Conductivity (User's choice)
  | 'D' // Density/Specific Gravity
  | 'E' // Voltage
  | 'F' // Flow
  | 'G' // Gauging/Position
  | 'H' // Hand (Manual)
  | 'I' // Current
  | 'J' // Power
  | 'K' // Time/Schedule
  | 'L' // Level
  | 'M' // Moisture/Humidity
  | 'N' // User's Choice
  | 'O' // User's Choice
  | 'P' // Pressure
  | 'Q' // Quantity/Event
  | 'R' // Radiation
  | 'S' // Speed/Frequency
  | 'T' // Temperature
  | 'U' // Multivariable
  | 'V' // Vibration
  | 'W' // Weight/Force
  | 'X' // Unclassified
  | 'Y' // Event/State
  | 'Z'; // Position/Dimension

export type InstrumentFunction =
  | 'I' // Indicating
  | 'R' // Recording
  | 'C' // Controlling
  | 'T' // Transmitting
  | 'S' // Switching (On/Off)
  | 'A' // Alarming
  | 'E' // Element (Primary)
  | 'H' // High
  | 'L' // Low
  | 'V' // Valve
  | 'Y' // Relay/Compute
  | 'Z'; // Driver/Actuator

// ─── P&ID Elements ──────────────────────────────────────────────────────────

export type PIDElementType =
  | 'instrument'
  | 'valve'
  | 'pump'
  | 'motor'
  | 'vessel'
  | 'tank'
  | 'heatExchanger'
  | 'pipe'
  | 'signal'
  | 'controller'
  | 'sensor'
  | 'actuator';

export interface PIDInstrument {
  type: 'instrument';
  tagNumber: string; // e.g., 'FIC-101'
  firstLetter: InstrumentFirstLetter;
  subsequentLetters: InstrumentFunction[];
  loopNumber: number;
  location: 'field' | 'panel' | 'dcs' | 'plc';
  measuredVariable: string; // 'flow', 'temperature', etc.
  description?: string;
  setpoint?: number;
  unit?: string;
  range?: { min: number; max: number };
}

export interface PIDValve {
  type: 'valve';
  tagNumber: string;
  valveType: 'gate' | 'globe' | 'ball' | 'butterfly' | 'check' | 'relief' | 'solenoid' | 'control';
  actuatorType?: 'pneumatic' | 'electric' | 'hydraulic' | 'manual';
  failPosition?: 'open' | 'closed' | 'last';
  normalPosition?: 'open' | 'closed';
  size?: string;
}

export interface PIDPump {
  type: 'pump';
  tagNumber: string;
  pumpType: 'centrifugal' | 'positive_displacement' | 'submersible' | 'vacuum';
  motorPower?: string;
  flowRate?: string;
}

export interface PIDMotor {
  type: 'motor';
  tagNumber: string;
  power?: string;
  voltage?: string;
  speed?: string;
  vfd?: boolean;
}

export interface PIDVessel {
  type: 'vessel' | 'tank';
  tagNumber: string;
  vesselType: 'tank' | 'reactor' | 'column' | 'drum' | 'hopper';
  capacity?: string;
  pressure?: string;
  temperature?: string;
}

export interface PIDPipe {
  type: 'pipe';
  lineNumber: string; // e.g., '3"-P-101-A1A'
  size: string; // '3"'
  material?: string; // 'CS', 'SS304'
  insulation?: string;
  spec?: string; // piping spec class
  fromEquipment: string;
  toEquipment: string;
  medium?: string; // 'water', 'steam', etc.
}

export interface PIDSignal {
  type: 'signal';
  signalType: 'electric' | 'pneumatic' | 'hydraulic' | 'data' | 'capillary' | 'software';
  from: string;
  to: string;
}

export type PIDElement = PIDInstrument | PIDValve | PIDPump | PIDMotor | PIDVessel | PIDPipe | PIDSignal;

// ─── P&ID Parsing Result ────────────────────────────────────────────────────

export interface PIDControlLoop {
  id: string;
  loopNumber: number;
  measuredVariable: string;
  controlType: 'feedback' | 'feedforward' | 'cascade' | 'ratio' | 'onoff';
  sensor: PIDInstrument;
  controller: PIDInstrument;
  finalElement: PIDValve | PIDMotor;
  setpoint?: number;
  description: string;
}

export interface PIDInterlock {
  id: string;
  name: string;
  triggerCondition: string;
  actions: string[];
  instruments: PIDInstrument[];
  priority: 'safety' | 'process' | 'equipment';
}

export interface PIDParseResult {
  elements: PIDElement[];
  controlLoops: PIDControlLoop[];
  interlocks: PIDInterlock[];
  pipes: PIDPipe[];
  confidence: number; // 0-1 overall parsing confidence
  warnings: string[];
  rawDescription?: string; // LLM's raw description of the P&ID
}

// ─── Code Generation from P&ID ──────────────────────────────────────────────

export interface PIDCodeGenRequest {
  parseResult: PIDParseResult;
  targetVendor: string; // vendor profile ID
  controlStrategy?: string; // user override for control approach
  safetyLevel?: 'SIL1' | 'SIL2' | 'SIL3' | 'none';
  scanTime?: string; // e.g., 'T#100ms'
}

export interface PIDCodeGenResult {
  stCode: string;
  ladderJson: string;
  tagList: Array<{
    name: string;
    address: string;
    dataType: string;
    description: string;
    source: string; // which P&ID element
  }>;
  ioCount: {
    digitalInputs: number;
    digitalOutputs: number;
    analogInputs: number;
    analogOutputs: number;
  };
}
