# ESBMC-PLC+ — Formal Verification Engine

This directory holds the ESBMC-PLC+ binary used by Plaxio's formal verification feature.

## Installation

### Option 1: Docker (recommended for development)

```bash
docker pull pierredantas/esbmc-plcplus
```

Plaxio auto-detects the Docker image and runs verification in containers.

### Option 2: Native binary

Download the latest release from:
https://github.com/pierredantas/esbmc-plcplus-artifact

Place the `esbmc` binary in this directory:
```
vendor/esbmc-plcplus/esbmc          (Linux/macOS)
vendor/esbmc-plcplus/esbmc.exe      (Windows)
```

Make it executable:
```bash
chmod +x vendor/esbmc-plcplus/esbmc
```

### Option 3: Build from source

```bash
git clone https://github.com/esbmc/esbmc.git
cd esbmc
# Follow ESBMC build instructions with PLC frontend enabled
cmake -DENABLE_PLC=ON ..
make -j$(nproc)
cp src/esbmc/esbmc /path/to/plaxio/vendor/esbmc-plcplus/esbmc
```

## Verification

Plaxio will show engine status in the Verify panel (bottom panel → Verify tab).
A green dot means the engine was detected; click "Refresh" to re-scan.

## How it works

1. Plaxio compiles your LD/FBD/SFC program to IEC 61131-3 Structured Text via the CLM→ST transpiler
2. Safety properties are instrumented as assertions in the ST code
3. ESBMC-PLC+ uses MATIEC to compile ST → C, then applies k-induction with Z3 SMT solver
4. Result: SAFE (proven for all states) or VIOLATION (with counterexample trace)
5. Counterexample traces can be replayed on the graphical canvas step-by-step
