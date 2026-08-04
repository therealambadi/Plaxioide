"use strict";
const path = __require("path");
const fs = __require("fs");
const os = __require("os");
const { spawn, execSync } = __require("child_process");

// Load the binary manager
const { esbmcBinaryManager } = __require(path.join(__dirname, "esbmcBinaryManager.js"));

function discoverEngine() {
  const binaryPath = esbmcBinaryManager.getBinaryPath();
  if (binaryPath) {
    const version = esbmcBinaryManager.getVersion();
    return { available: true, mode: "native", binaryPath, version, downloadable: false };
  }
  return { available: false, mode: null, binaryPath: "", version: "", downloadable: true };
}

function isDownloading() {
  return esbmcBinaryManager.isDownloading();
}

async function downloadEngine(onProgress) {
  const binaryPath = await esbmcBinaryManager.downloadBinary(onProgress);
  const version = esbmcBinaryManager.getVersion();
  return { available: true, mode: "native", binaryPath, version, downloadable: false };
}

const _activeProcesses = new Map();

async function runVerification(config) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plaxio-verify-"));
  const stFilePath = path.join(tmpDir, "program.st");
  try {
    fs.writeFileSync(stFilePath, config.instrumentedST, "utf-8");
    const startTime = Date.now();
    let result;
    if (config.mode === "docker") {
      result = await _spawnAsync("docker", [
        "run", "--rm", "-v", `${tmpDir}:/work`, "-w", "/work",
        config.binaryPath, "esbmc", "program.st",
        "--k-induction", "--k-step", String(config.kInductionDepth),
        "--timeout", String(Math.floor(config.timeoutMs / 1000)), 
      ], config.timeoutMs, config.runId);
    } else {
      result = await _spawnAsync(config.binaryPath, [
        stFilePath, "--k-induction", "--k-step", String(config.kInductionDepth),
        "--timeout", String(Math.floor(config.timeoutMs / 1000)), 
      ], config.timeoutMs, config.runId);
    }
    const timeMs = Date.now() - startTime;
    return { runId: config.runId, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, timeMs, propertyIds: config.propertyIds };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    _activeProcesses.delete(config.runId);
  }
}

function cancelRun(runId) {
  const proc = _activeProcesses.get(runId);
  if (proc) {
    try { proc.kill("SIGTERM"); } catch {}
    setTimeout(() => { try { if (!proc.killed) proc.kill("SIGKILL"); } catch {} }, 3000);
    _activeProcesses.delete(runId);
  }
}

function _spawnAsync(command, args, timeoutMs, runId) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let proc;
    try {
      const spawnEnv = { ...process.env, LANG: "C" };
      const libDir = path.join(path.dirname(command), "lib");
      if (os.platform() === "darwin" && fs.existsSync(libDir)) { spawnEnv.DYLD_LIBRARY_PATH = libDir + (process.env.DYLD_LIBRARY_PATH ? ":" + process.env.DYLD_LIBRARY_PATH : ""); }
      proc = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], env: spawnEnv });
    } catch (err) {
      resolve({ stdout: "", stderr: `Spawn error: ${err.message}`, exitCode: -1 });
      return;
    }
    _activeProcesses.set(runId, proc);
    proc.stdout && proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr && proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill("SIGTERM"); } catch {}
      setTimeout(() => { try { if (!proc.killed) proc.kill("SIGKILL"); } catch {} }, 2000);
    }, timeoutMs);
    proc.on("close", (code) => {
      clearTimeout(timer);
      _activeProcesses.delete(runId);
      resolve({ stdout, stderr: timedOut ? stderr + "\nTimed out" : stderr, exitCode: timedOut ? 137 : (code ?? -1) });
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      _activeProcesses.delete(runId);
      resolve({ stdout, stderr: `Process error: ${err.message}`, exitCode: -1 });
    });
  });
}

module.exports = { discoverEngine, isDownloading, downloadEngine, runVerification, cancelRun };
