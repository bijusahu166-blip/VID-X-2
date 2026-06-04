const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const distPath = path.resolve(__dirname, '..', 'dist', 'index.cjs');

function startFromDist() {
  console.log('[start] Launching application from', distPath);
  try {
    require(distPath);
  } catch (err) {
    console.error('[start] Failed to require dist file:', err);
    process.exit(1);
  }
}

if (fs.existsSync(distPath)) {
  startFromDist();
} else {
  console.log('[start] dist not found, running build...');
  const builder = spawn('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
  builder.on('exit', (code) => {
    if (code === 0) {
      console.log('[start] build succeeded, starting server');
      startFromDist();
    } else {
      console.error('[start] build failed with code', code);
      process.exit(code || 1);
    }
  });
  builder.on('error', (err) => {
    console.error('[start] build spawn error:', err);
    process.exit(1);
  });
}
