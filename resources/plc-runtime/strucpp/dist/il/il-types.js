// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2025 Autonomy / OpenPLC Project
/**
 * STruC++ Instruction List (IL) — Type Definitions
 *
 * Defines the intermediate representation for IL instructions used by
 * the IL→ST transpiler pipeline.
 */
/** Set of all valid IL operator strings for quick lookup. */
export const IL_OPERATORS = new Set([
    "LD",
    "LDN",
    "ST",
    "STN",
    "AND",
    "ANDN",
    "OR",
    "ORN",
    "XOR",
    "XORN",
    "NOT",
    "ADD",
    "SUB",
    "MUL",
    "DIV",
    "MOD",
    "EQ",
    "NE",
    "GT",
    "GE",
    "LT",
    "LE",
    "JMP",
    "JMPC",
    "JMPCN",
    "RET",
    "RETC",
    "RETCN",
    "CAL",
    "CALC",
    "CALCN",
    "S",
    "R",
    "S1",
    "R1",
    "CLK",
    "CU",
    "CD",
    "PV",
    "IN",
    "PT",
]);
//# sourceMappingURL=il-types.js.map