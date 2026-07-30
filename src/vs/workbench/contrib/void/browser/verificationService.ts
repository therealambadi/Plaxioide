/*
 * Verification Service — Extension host process that manages ESBMC-PLC+ execution.
 *
 * Responsibilities:
 *   1. Discover ESBMC-PLC+ binary (native install or Docker image)
 *   2. Write temporary files (instrumented ST, property YAML)
 *   3. Spawn the verification process with appropriate flags
 *   4. Stream stdout/stderr back to the webview
 *   5. Handle timeout and cancellation
 *   6. Clean up temporary files
 *
 * Integration point: Called from toolsService.ts message handler when the
 * webview posts 'plaxio:verify-run' messages.
 */

// This file runs in the Electron renderer (extension host) context.
// It has access to Node.js APIs via __require.

declare function __require(module: string): any;

const path = __require('path') as typeof import('path');
const fs = __require('fs') as typeof import('fs');
const os = __require('os') as typeof import('os');
const { spawn, execSync } = __require('child_process') as typeof import('child_process');

// ─── Engine Discovery ────────────────────────────────────────────────────────

import { esbmcBinaryManager, type DownloadProgress, type ProgressCallback } from './esbmcBinaryManager.js';

export interface EngineDiscoveryResult {
  available: boolean;
  mode: 'native' | 'docker' | null;
  binaryPath: string;
  version: string;
  downloadable: boolean;
}

export function discoverEngine(): EngineDiscoveryResult {
  const binaryPath = esbmcBinaryManager.getBinaryPath();
  if (binaryPath) {
    const version = esbmcBinaryManager.getVersion();
    return { available: true, mode: 'native', binaryPath, version, downloadable: false };
  }
  return { available: false, mode: null, binaryPath: '', version: '', downloadable: true };
}

export function isDownloading(): boolean {
  return esbmcBinaryManager.isDownloading();
}

export async function downloadEngine(onProgress?: ProgressCallback): Promise<EngineDiscoveryResult> {
  const binaryPath = await esbmcBinaryManager.downloadBinary(onProgress);
  const version = esbmcBinaryManager.getVersion();
  return { available: true, mode: 'native', binaryPath, version, downloadable: false };
}

export type { DownloadProgress, ProgressCallback };

// ─── Verification Execution ──────────────────────────────────────────────────

export interface VerifyRunConfig {
  runId: string;
  instrumentedST: string;
  propertyIds: string[];
  timeoutMs: number;
  kInductionDepth: number;
  mode: 'native' | 'docker';
  binaryPath: string;
}

export interface VerifyRunResult {
  runId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timeMs: number;
  propertyIds: string[];
}

const _activeProcesses = new Map<string, ReturnType<typeof spawn>>();

export async function runVerification(config: VerifyRunConfig): Promise<VerifyRunResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plaxio-verify-'));
  const stFilePath = path.join(tmpDir, 'program.st');

  try {
    // Write instrumented ST to temp file
    fs.writeFileSync(stFilePath, config.instrumentedST, 'utf-8');

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = -1;

    if (config.mode === 'docker') {
      // Docker execution
      const result = await spawnAsync('docker', [
        'run', '--rm',
        '-v', `${tmpDir}:/work`,
        '-w', '/work',
        config.binaryPath,
        'esbmc', 'program.st',
        '--k-induction',
        '--k-step', String(config.kInductionDepth),
        '--timeout', String(Math.floor(config.timeoutMs / 1000)),
              ], config.timeoutMs, config.runId);
      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.exitCode;
    } else {
      // Native binary execution
      const args = [
        stFilePath,
        '--k-induction',
        '--k-step', String(config.kInductionDepth),
        '--timeout', String(Math.floor(config.timeoutMs / 1000)),
              ];

      const result = await spawnAsync(config.binaryPath, args, config.timeoutMs, config.runId);
      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.exitCode;
    }

    const timeMs = Date.now() - startTime;

    return {
      runId: config.runId,
      stdout,
      stderr,
      exitCode,
      timeMs,
      propertyIds: config.propertyIds,
    };
  } finally {
    // Cleanup temp files
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    _activeProcesses.delete(config.runId);
  }
}

export function cancelRun(runId: string): void {
  const proc = _activeProcesses.get(runId);
  if (proc) {
    proc.kill('SIGTERM');
    setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 3000);
    _activeProcesses.delete(runId);
  }
}

// ─── Process Spawner ─────────────────────────────────────────────────────────

function spawnAsync(
  command: string,
  args: string[],
  timeoutMs: number,
  runId: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const spawnEnv: Record<string, string | undefined> = { ...process.env, LANG: 'C' };
    const libDir = path.join(path.dirname(command), 'lib');
    if (os.platform() === 'darwin' && fs.existsSync(libDir)) {
      spawnEnv.DYLD_LIBRARY_PATH = libDir + (process.env.DYLD_LIBRARY_PATH ? ':' + process.env.DYLD_LIBRARY_PATH : '');
    }

    const proc = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: spawnEnv,
    });

    _activeProcesses.set(runId, proc);

    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 2000);
    }, timeoutMs);

    proc.on('close', (code: number | null) => {
      clearTimeout(timer);
      _activeProcesses.delete(runId);
      if (timedOut) {
        resolve({ stdout, stderr: stderr + '\nTimed out', exitCode: 137 });
      } else {
        resolve({ stdout, stderr, exitCode: code ?? -1 });
      }
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      _activeProcesses.delete(runId);
      resolve({ stdout, stderr: `Process error: ${err.message}`, exitCode: -1 });
    });
  });
}
