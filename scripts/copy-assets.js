const fs = require('fs/promises');
const path = require('path');

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function copyFile(source, destination) {
  await ensureDir(path.dirname(destination));
  await fs.copyFile(source, destination);
}

async function copyRendererAssets() {
  const sourceDir = path.join(__dirname, '../src/renderer');
  const targetDir = path.join(__dirname, '../dist/renderer');
  await ensureDir(targetDir);

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'styles') {
        await copyDirectory(sourcePath, targetPath);
      }
    } else if (entry.name.endsWith('.html')) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function copyDirectory(sourceDir, targetDir) {
  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function copyWasm() {
  const wasmSource = path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');
  const wasmTarget = path.join(__dirname, '../dist/main/sql-wasm.wasm');
  try {
    await copyFile(wasmSource, wasmTarget);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('sql-wasm.wasm が見つかりませんでした。npm install を実行してください。');
    } else {
      throw error;
    }
  }
}

async function main() {
  await copyRendererAssets();
  await copyWasm();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
