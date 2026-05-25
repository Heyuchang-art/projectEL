import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sdkRoot = __dirname;

function runCmd(cmd, cwd) {
  console.log(`Running: ${cmd} in ${cwd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function rewriteSrcImports(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteSrcImports(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Matches relative paths ending in .ts in imports or exports
      const updated = content.replace(/(['"])(\.\.?\/[^'"]+)\.ts\1/g, '$1$2.js$1');
      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`Rewrote imports in source file: ${fullPath}`);
      }
    }
  }
}

function buildPackage(packageName) {
  const pkgDir = path.join(sdkRoot, 'packages', packageName);
  console.log(`\n=== Building Package: ${packageName} ===`);
  
  // Rewrite source imports first so tsc is happy
  console.log(`Rewriting imports in ${packageName}/src...`);
  rewriteSrcImports(path.join(pkgDir, 'src'));
  
  if (packageName === 'ai') {
    // Generate models
    runCmd('npx tsx scripts/generate-models.ts', pkgDir);
    runCmd('npx tsx scripts/generate-image-models.ts', pkgDir);
    // Also rewrite models generator script imports in case they import relative TS files
    rewriteSrcImports(path.join(pkgDir, 'src'));
  }
  
  // Run typescript compiler
  runCmd('npx tsc -p tsconfig.build.json', pkgDir);
  
  if (packageName === 'coding-agent') {
    // Copy assets for coding-agent
    runCmd('npm run copy-assets', pkgDir);
  }
}

// Build in dependency order
try {
  buildPackage('ai');
  buildPackage('agent');
  buildPackage('tui');
  buildPackage('coding-agent');
  console.log('\n=== SDK Build Complete ===');
} catch (err) {
  console.error('Build failed:', err);
  process.exit(1);
}
