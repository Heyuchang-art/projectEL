const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const rootDir = path.resolve(__dirname, '..');
const builtins = new Set(builtinModules || []);

// Simple glob resolver for workspaces like "pi-sdk/packages/*"
function getWorkspacePaths() {
  const paths = [rootDir]; // Always include root
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  } catch (err) {
    return paths;
  }

  let workspaces = pkg.workspaces;
  // Support both array and object formats for npm workspaces
  if (workspaces && !Array.isArray(workspaces) && Array.isArray(workspaces.packages)) {
    workspaces = workspaces.packages;
  }
  
  if (!workspaces || !Array.isArray(workspaces)) {
    return paths;
  }

  for (const pattern of workspaces) {
    if (pattern.endsWith('/*')) {
      const parentDir = path.join(rootDir, pattern.slice(0, -2));
      if (!fs.existsSync(parentDir)) continue;
      try {
        const subdirs = fs.readdirSync(parentDir);
        for (const subdir of subdirs) {
          const fullSubdir = path.join(parentDir, subdir);
          if (fs.statSync(fullSubdir).isDirectory()) {
            paths.push(fullSubdir);
          }
        }
      } catch (err) {
        // ignore read errors
      }
    } else {
      const fullPath = path.join(rootDir, pattern);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        paths.push(fullPath);
      }
    }
  }

  return paths;
}

function checkDependency(dep, startDir) {
  // Ignore Node.js built-ins and node: scheme modules
  if (builtins.has(dep) || dep.startsWith('node:')) {
    return true;
  }

  let currentDir = startDir;
  while (true) {
    const candidate = path.join(currentDir, 'node_modules', dep);
    if (fs.existsSync(candidate)) {
      return true;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }
  return false;
}

function main() {
  console.log('Resolving workspaces from package.json...');
  const workspaces = getWorkspacePaths();
  let missingDeps = [];

  for (const wsDir of workspaces) {
    const pkgPath = path.join(wsDir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
      console.error(`Error reading ${pkgPath}:`, e.message);
      continue;
    }

    const dependencies = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    const wsRelPath = path.relative(rootDir, wsDir) || '.';
    for (const dep of Object.keys(dependencies)) {
      if (!checkDependency(dep, wsDir)) {
        missingDeps.push({ dep, pkgPath: path.join(wsRelPath, 'package.json') });
      }
    }
  }

  if (missingDeps.length > 0) {
    console.log('\n[WARNING] Found missing dependencies:');
    missingDeps.forEach(({ dep, pkgPath }) => {
      console.log(`  - ${dep} (required by ${pkgPath})`);
    });
    process.exit(1);
  } else {
    console.log('All workspace dependencies are successfully installed.');
    process.exit(0);
  }
}

main();
