const { spawn, spawnSync } = require('child_process');
const path = require('path');

const pickPythonExecutable = () => {
  const candidates = [];
  if (process.env.PYTHON_BIN && process.env.PYTHON_BIN.trim()) {
    candidates.push(process.env.PYTHON_BIN.trim());
  }
  if (process.platform === 'win32') {
    candidates.push('python');
    candidates.push('python3');
  } else {
    candidates.push('python3');
    candidates.push('python');
  }

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ['--version'], {
        stdio: 'ignore'
      });
      if (result.status === 0) {
        return candidate;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  throw new Error('Unable to locate a usable Python interpreter. Set PYTHON_BIN to an absolute path.');
};

const safeTrim = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : value;
};

const runPythonJob = async ({
  scriptPath,
  args = [],
  env = {},
  cwd = process.cwd(),
  logLabel = 'python-job'
}) => {
  if (!scriptPath) {
    throw new Error('scriptPath is required for runPythonJob');
  }

  const absoluteScript = path.resolve(scriptPath);
  const candidateArgs = Array.isArray(args) ? args : [];
  const pythonExecutable = pickPythonExecutable();

  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable, [absoluteScript, ...candidateArgs], {
      cwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        ...env
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (process.env.NODE_ENV === 'development') {
        process.stdout.write(`[${logLabel}] ${text}`);
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (process.env.NODE_ENV === 'development') {
        process.stderr.write(`[${logLabel}:err] ${text}`);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      const trimmedLines = stdout
        .split(/\r?\n/)
        .map((line) => safeTrim(line))
        .filter((line) => typeof line === 'string' && line.length > 0);

      let parsedSummary = null;
      for (let i = trimmedLines.length - 1; i >= 0; i -= 1) {
        const line = trimmedLines[i];
        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            parsedSummary = JSON.parse(line);
            break;
          } catch (err) {
            // Ignore parse errors and continue searching upwards
          }
        }
      }

      if (code !== 0) {
        const error = new Error(`Python job exited with code ${code}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        error.summary = parsedSummary;
        reject(error);
        return;
      }

      resolve({
        code,
        stdout,
        stderr,
        summary: parsedSummary
      });
    });
  });
};

module.exports = {
  runPythonJob
};
