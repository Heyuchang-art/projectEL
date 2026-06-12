/**
 * Snapshot Pi — API Key 配置初始化
 *
 * 检查 .pi/auth.json 是否存在，不存在则创建模板。
 * 始终打印当前配置状态供用户确认。
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const authPath = path.join(rootDir, '.pi', 'auth.json');

const providers = {
  deepseek: {
    name: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    setupUrl: 'https://platform.deepseek.com/api_keys',
  },
  anthropic: {
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    setupUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    setupUrl: 'https://platform.openai.com/api-keys',
  },
  qwen: {
    name: 'Qwen (DashScope)',
    envVar: 'DASHSCOPE_API_KEY',
    setupUrl: 'https://dashscope.console.aliyun.com/apiKey',
  },
  openrouter: {
    name: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    setupUrl: 'https://openrouter.ai/keys',
  },
};

function main() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  Snapshot Pi — API Key 配置');
  console.log('═══════════════════════════════════════════');
  console.log('');

  // Ensure .pi/ directory exists
  const piDir = path.dirname(authPath);
  if (!fs.existsSync(piDir)) {
    fs.mkdirSync(piDir, { recursive: true });
  }

  // Load or create auth.json
  let auth = {};
  if (fs.existsSync(authPath)) {
    try {
      auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      console.log('[OK] .pi/auth.json 已存在');
    } catch {
      console.log('[WARN] .pi/auth.json 已损坏，将重新创建');
      auth = {};
    }
  } else {
    console.log('[NEW] 创建 .pi/auth.json 模板...');
  }

  let hasKeys = false;
  let missingCount = 0;

  for (const [id, info] of Object.entries(providers)) {
    // Check env var
    const envValue = process.env[info.envVar];
    if (envValue) {
      console.log(`  [OK] ${info.name}  — 环境变量已设置`);
      hasKeys = true;
      continue;
    }

    // Check auth.json
    const stored = auth[id];
    if (stored && stored.key) {
      // Mask the key for display
      const masked = stored.key.length > 8
        ? stored.key.slice(0, 4) + '...' + stored.key.slice(-4)
        : '****';
      console.log(`  [OK] ${info.name}  — auth.json (${masked})`);
      hasKeys = true;
      continue;
    }

    // Missing — add template entry
    console.log(`  [--] ${info.name}  — 未配置`);
    if (!auth[id]) {
      auth[id] = { key: '', comment: `获取 API Key: ${info.setupUrl}` };
    }
    missingCount++;
  }

  console.log('');

  // Save template if any new entries were added
  if (!fs.existsSync(authPath) || missingCount > 0) {
    fs.writeFileSync(authPath, JSON.stringify(auth, null, 2) + '\n', 'utf8');
    console.log('[INFO] .pi/auth.json 已更新。请编辑此文件填入 API Key:');
    console.log(`        ${authPath}`);
    console.log('');
    console.log('  各平台获取地址:');
    for (const [id, info] of Object.entries(providers)) {
      console.log(`    ${info.name}: ${info.setupUrl}`);
    }
    console.log('');
  }

  if (!hasKeys) {
    console.log('[WARN] ⚠ 未配置任何 API Key！');
    console.log('  系统将无法调用 AI 模型。');
    console.log('  至少配置一个 Provider 的 API Key 后再启动。');
    console.log('');
    process.exit(1);
  }

  console.log('[OK] 至少一个 API Key 已配置，可以启动。');
  console.log('');
  process.exit(0);
}

main();
