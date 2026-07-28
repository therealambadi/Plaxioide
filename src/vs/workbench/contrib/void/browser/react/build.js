/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { execSync } from 'child_process';
import { spawn } from 'cross-spawn'
// Added lines below
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function doesPathExist(filePath) {
	try {
		const stats = fs.statSync(filePath);

		return stats.isFile();
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}

/*

This function finds `globalDesiredPath` given `localDesiredPath` and `currentPath`

Diagram:

...basePath/
└── void/
	├── ...currentPath/ (defined globally)
	└── ...localDesiredPath/ (defined locally)

*/
function findDesiredPathFromLocalPath(localDesiredPath, currentPath) {

	// walk upwards until currentPath + localDesiredPath exists
	while (!doesPathExist(path.join(currentPath, localDesiredPath))) {
		const parentDir = path.dirname(currentPath);

		if (parentDir === currentPath) {
			return undefined;
		}

		currentPath = parentDir;
	}

	// return the `globallyDesiredPath`
	const globalDesiredPath = path.join(currentPath, localDesiredPath)
	return globalDesiredPath;
}

// hack to refresh styles automatically
function saveStylesFile() {
	setTimeout(() => {
		try {
			const pathToCssFile = findDesiredPathFromLocalPath('./src/vs/workbench/contrib/void/browser/react/src2/styles.css', __dirname);

			if (pathToCssFile === undefined) {
				console.error('[scope-tailwind] Error finding styles.css');
				return;
			}

			// Or re-write with the same content:
			const content = fs.readFileSync(pathToCssFile, 'utf8');
			fs.writeFileSync(pathToCssFile, content, 'utf8');
			console.log('[scope-tailwind] Force-saved styles.css');
		} catch (err) {
			console.error('[scope-tailwind] Error saving styles.css:', err);
		}
	}, 6000);
}

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');

if (isWatch) {
	// this just builds it if it doesn't exist instead of waiting for the watcher to trigger
	// Check if src2/ exists; if not, do an initial scope-tailwind build
	if (!fs.existsSync('src2')) {
		try {
			console.log('🔨 Running initial scope-tailwind build to create src2 folder...');
			execSync(
				'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"',
				{ stdio: 'inherit' }
			);
			console.log('✅ src2/ created successfully.');
		} catch (err) {
			console.error('❌ Error running initial scope-tailwind build:', err);
			process.exit(1);
		}
	}

	// Watch mode
	const scopeTailwindWatcher = spawn('npx', [
		'nodemon',
		'--watch', 'src',
		'--ext', 'ts,tsx,css',
		'--exec',
		'npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"'
	]);

	const tsupWatcher = spawn('npx', [
		'tsup',
		'--watch'
	]);

	scopeTailwindWatcher.stdout.on('data', (data) => {
		console.log(`[scope-tailwind] ${data}`);
		// If the output mentions "styles.css", trigger the save:
		if (data.toString().includes('styles.css')) {
			saveStylesFile();
		}
	});

	scopeTailwindWatcher.stderr.on('data', (data) => {
		console.error(`[scope-tailwind] ${data}`);
	});

	// Handle tsup watcher output
	tsupWatcher.stdout.on('data', (data) => {
		console.log(`[tsup] ${data}`);
	});

	tsupWatcher.stderr.on('data', (data) => {
		console.error(`[tsup] ${data}`);
	});

	// Handle process termination
	process.on('SIGINT', () => {
		scopeTailwindWatcher.kill();
		tsupWatcher.kill();
		process.exit();
	});

	console.log('🔄 Watchers started! Press Ctrl+C to stop both watchers.');
} else {
	// Build mode
	console.log('📦 Building...');

	// Run scope-tailwind once
	execSync('npx scope-tailwind ./src -o src2/ -s void-scope -c styles.css -p "void-"', { stdio: 'inherit' });

	// Run tsup once
	execSync('npx tsup', { stdio: 'inherit' });

	// Sync built bundles to the out/ directory that Electron actually loads at runtime
	const outSrc  = path.join(__dirname, 'out');
	// Walk up from __dirname to find the repo root (contains package.json at root)
	let repoRoot = __dirname;
	while (repoRoot !== path.dirname(repoRoot)) {
		if (fs.existsSync(path.join(repoRoot, 'package.json')) &&
		    fs.existsSync(path.join(repoRoot, 'out', 'vs', 'workbench', 'contrib', 'void', 'browser', 'react', 'out'))) {
			break;
		}
		repoRoot = path.dirname(repoRoot);
	}
	const outDest = path.join(repoRoot, 'out', 'vs', 'workbench', 'contrib', 'void', 'browser', 'react', 'out');
	if (fs.existsSync(outDest)) {
		for (const bundle of fs.readdirSync(outSrc)) {
			const srcFile  = path.join(outSrc, bundle, 'index.js');
			const destDir  = path.join(outDest, bundle);
			const destFile = path.join(destDir, 'index.js');
			if (fs.existsSync(srcFile)) {
				fs.mkdirSync(destDir, { recursive: true });
				fs.copyFileSync(srcFile, destFile);
				console.log(`✅ Synced ${bundle}/index.js → out/`);
			}
		}
	} else {
		console.warn('⚠️  Could not find out/ directory — skipping sync');
	}

	// Clear Electron caches so the next launch always loads fresh bundles
	const os = await import('os');
	const home = os.default.homedir();
	const cacheDirs = [
		path.join(home, 'Library', 'Application Support', 'Void'),
		path.join(home, 'Library', 'Application Support', 'void'),
		path.join(home, 'Library', 'Caches', 'Void'),
		path.join(home, 'Library', 'Caches', 'void'),
	];
	for (const dir of cacheDirs) {
		if (fs.existsSync(dir)) {
			// Remove only cache sub-folders, not the entire user-data dir
			for (const sub of ['GPUCache', 'Cache', 'Code Cache', 'blob_storage', 'DawnGraphiteCache', 'DawnWebGPUCache']) {
				const target = path.join(dir, sub);
				if (fs.existsSync(target)) {
					fs.rmSync(target, { recursive: true, force: true });
					console.log(`🗑  Cleared cache: ${target}`);
				}
			}
		}
	}

	console.log('✅ Build complete!');
}
