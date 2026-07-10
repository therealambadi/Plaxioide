#!/usr/bin/env node
/**
 * STruC++ Command Line Interface
 *
 * Usage:
 *   strucpp <input.st> [input2.st ...] -o <output.cpp> [options]
 *   strucpp --compile-lib <input.st> [...] -o <dir> --lib-name <name> [options]
 *
 * Options:
 *   -o, --output <file>       Output file path or directory
 *   -d, --debug               Enable debug mode
 *   --no-line-mapping         Disable line mapping
 *   --line-directives         Include #line directives
 *   --source-comments         Include ST source as comments
 *   -O, --optimize <level>    Optimization level (0, 1, 2)
 *   --build                   Compile to executable binary with interactive REPL
 *   --gpp <path>              Custom g++ path (default: g++)
 *   --cc <path>               Custom C compiler path (default: cc)
 *   --cxx-flags <flags>       Extra C++ compiler flags
 *   -L, --lib-path <path>     Library search path (repeatable)
 *   --compile-lib             Compile sources into a library
 *   --lib-name <name>         Library name (required with --compile-lib)
 *   --lib-version <version>   Library version (default: "1.0.0")
 *   --lib-namespace <ns>      C++ namespace (default: derived from lib-name)
 *   -v, --version             Show version
 *   -h, --help                Show help
 */
export {};
//# sourceMappingURL=cli.d.ts.map