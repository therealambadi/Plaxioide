/*
 * ESBMC Binary Manager — Downloads and manages platform-specific ESBMC binaries.
 */

const path = __require('path');
const fs = __require('fs');
const os = __require('os');
const https = __require('https');
const { execSync, spawn } = __require('child_process');

const ESBMC_VERSION = 'v8.4';
const ESBMC_REPO = 'esbmc/esbmc';
const RELEASE_BASE = `https://github.com/${ESBMC_REPO}/releases/download/${ESBMC_VERSION}`;

function getPlatformBinary() {
	const platform = os.platform();
	const arch = os.arch();

	if (platform === 'darwin') {
		return { url: `${RELEASE_BASE}/esbmc-macos.zip`, archiveName: 'esbmc-macos.zip', binaryRelPath: 'esbmc' };
	}
	if (platform === 'win32') {
		return { url: `${RELEASE_BASE}/esbmc-windows.zip`, archiveName: 'esbmc-windows.zip', binaryRelPath: 'esbmc.exe' };
	}
	if (platform === 'linux' && (arch === 'x64' || arch === 'arm64')) {
		return { url: `${RELEASE_BASE}/esbmc-linux.zip`, archiveName: 'esbmc-linux.zip', binaryRelPath: 'esbmc' };
	}
	return null;
}

function getUserDataDir() {
	const platform = os.platform();
	if (platform === 'darwin') {
		return path.join(os.homedir(), 'Library', 'Application Support', 'Plaxio', 'esbmc');
	}
	if (platform === 'win32') {
		return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Plaxio', 'esbmc');
	}
	return path.join(os.homedir(), '.config', 'plaxio', 'esbmc');
}

function followRedirects(url, callback) {
	const parsedUrl = new URL(url);
	const lib = parsedUrl.protocol === 'https:' ? https : __require('http');
	lib.get(url, { headers: { 'User-Agent': 'Plaxio-IDE' } }, (res) => {
		if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
			followRedirects(res.headers.location, callback);
		} else {
			callback(res);
		}
	});
}

function downloadFile(url, destPath, onProgress) {
	return new Promise((resolve, reject) => {
		const dir = path.dirname(destPath);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		const file = fs.createWriteStream(destPath);

		followRedirects(url, (res) => {
			if (res.statusCode !== 200) {
				file.close();
				fs.unlinkSync(destPath);
				reject(new Error(`Download failed: HTTP ${res.statusCode}`));
				return;
			}
			const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
			let downloadedBytes = 0;

			res.on('data', (chunk) => {
				downloadedBytes += chunk.length;
				file.write(chunk);
				if (onProgress && totalBytes > 0) {
					onProgress({
						phase: 'downloading',
						percent: Math.round((downloadedBytes / totalBytes) * 100),
						message: `Downloading ESBMC (${(downloadedBytes / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`,
					});
				}
			});
			res.on('end', () => { file.end(); file.on('finish', resolve); });
			res.on('error', (err) => { file.close(); try { fs.unlinkSync(destPath); } catch {} reject(err); });
		});
	});
}

function extractZip(zipPath, destDir) {
	return new Promise((resolve, reject) => {
		const platform = os.platform();
		if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
		let cmd;
		if (platform === 'win32') {
			cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
		} else {
			cmd = `unzip -o "${zipPath}" -d "${destDir}"`;
		}
		try {
			execSync(cmd, { timeout: 120000, stdio: 'pipe' });
			resolve();
		} catch (err) {
			reject(new Error(`Extraction failed: ${err.message}`));
		}
	});
}

function findBinaryInDir(dir) {
	const platform = os.platform();
	const binaryName = platform === 'win32' ? 'esbmc.exe' : 'esbmc';
	const direct = path.join(dir, binaryName);
	if (fs.existsSync(direct)) return direct;

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const nested = path.join(dir, entry.name, binaryName);
				if (fs.existsSync(nested)) return nested;
				const binNested = path.join(dir, entry.name, 'bin', binaryName);
				if (fs.existsSync(binNested)) return binNested;
			}
		}
	} catch {}
	return null;
}

class EsbmcBinaryManager {
	constructor() {
		this._binaryPath = null;
		this._downloading = false;
	}

	getBinaryPath() {
		if (this._binaryPath && fs.existsSync(this._binaryPath)) return this._binaryPath;

		// 1. Bundled in vendor/ (dev mode)
		const vendorPaths = [
			path.join(__dirname, '..', '..', '..', '..', '..', '..', 'vendor', 'esbmc-plcplus', 'esbmc'),
			path.join(__dirname, '..', '..', '..', '..', '..', '..', 'vendor', 'esbmc-plcplus', 'esbmc.exe'),
		];
		for (const p of vendorPaths) {
			if (fs.existsSync(p)) { this._binaryPath = p; return p; }
		}

		// 2. Packaged app resources
		if (process.resourcesPath) {
			const resPaths = [
				path.join(process.resourcesPath, 'vendor', 'esbmc-plcplus', 'esbmc'),
				path.join(process.resourcesPath, 'vendor', 'esbmc-plcplus', 'esbmc.exe'),
			];
			for (const p of resPaths) {
				if (fs.existsSync(p)) { this._binaryPath = p; return p; }
			}
		}

		// 3. Auto-downloaded in userData
		const userDir = getUserDataDir();
		const found = findBinaryInDir(userDir);
		if (found) { this._binaryPath = found; return found; }

		// 4. System PATH
		const platform = os.platform();
		const names = platform === 'win32' ? ['esbmc-plcplus.exe', 'esbmc.exe'] : ['esbmc-plcplus', 'esbmc'];
		for (const name of names) {
			try {
				const whichCmd = platform === 'win32' ? `where ${name}` : `which ${name}`;
				const result = execSync(whichCmd, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim().split('\n')[0];
				if (result && fs.existsSync(result)) { this._binaryPath = result; return result; }
			} catch {}
		}

		return null;
	}

	isDownloading() { return this._downloading; }

	async downloadBinary(onProgress) {
		if (this._downloading) throw new Error('Download already in progress');

		const platformBin = getPlatformBinary();
		if (!platformBin) throw new Error(`ESBMC is not available for ${os.platform()} ${os.arch()}`);

		this._downloading = true;
		const userDir = getUserDataDir();

		try {
			if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
			const archivePath = path.join(userDir, platformBin.archiveName);

			onProgress?.({ phase: 'downloading', percent: 0, message: 'Starting download...' });
			await downloadFile(platformBin.url, archivePath, onProgress);

			onProgress?.({ phase: 'extracting', percent: 0, message: 'Extracting ESBMC binary...' });
			const extractDir = path.join(userDir, 'extracted');
			if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
			await extractZip(archivePath, extractDir);

			const binaryPath = findBinaryInDir(extractDir);
			if (!binaryPath) throw new Error('Could not find ESBMC binary in extracted archive');

			const finalPath = path.join(userDir, os.platform() === 'win32' ? 'esbmc.exe' : 'esbmc');
			fs.copyFileSync(binaryPath, finalPath);
			if (os.platform() !== 'win32') {
				fs.chmodSync(finalPath, 0o755);
			}

			try { fs.unlinkSync(archivePath); } catch {}
			try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}

			onProgress?.({ phase: 'verifying', percent: 90, message: 'Verifying binary...' });
			try {
				const version = execSync(`"${finalPath}" --version 2>&1`, { encoding: 'utf-8', timeout: 10000 }).trim();
				onProgress?.({ phase: 'ready', percent: 100, message: `ESBMC ${version} ready` });
			} catch {
				onProgress?.({ phase: 'ready', percent: 100, message: 'ESBMC installed (version check skipped)' });
			}

			this._binaryPath = finalPath;
			return finalPath;
		} catch (err) {
			onProgress?.({ phase: 'error', percent: 0, message: err.message });
			throw err;
		} finally {
			this._downloading = false;
		}
	}

	getVersion() {
		const binary = this.getBinaryPath();
		if (!binary) return '';
		try {
			return execSync(`"${binary}" --version 2>&1`, { encoding: 'utf-8', timeout: 10000 }).trim().split('\n')[0];
		} catch {
			return 'installed';
		}
	}

	isAvailable() {
		return this.getBinaryPath() !== null;
	}
}

const esbmcBinaryManager = new EsbmcBinaryManager();

module.exports = { EsbmcBinaryManager, esbmcBinaryManager };
