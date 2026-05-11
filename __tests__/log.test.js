const log = require('../lib/log');

function captureStream(stream) {
  const buffers = [];
  const original = stream.write.bind(stream);
  stream.write = (chunk) => {
    buffers.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };
  return {
    drain() {
      return buffers.join('');
    },
    restore() {
      stream.write = original;
    },
  };
}

describe('log', () => {
  beforeEach(() => {
    log.reset();
  });

  it('info writes to stderr by default', () => {
    const err = captureStream(process.stderr);
    try {
      log.info('hello');
      expect(err.drain()).toBe('hello\n');
    } finally {
      err.restore();
    }
  });

  it('data writes to stdout', () => {
    const out = captureStream(process.stdout);
    try {
      log.configure({ json: true });
      log.data({ ok: true });
      expect(out.drain()).toBe('{"ok":true}\n');
    } finally {
      out.restore();
    }
  });

  it('quiet suppresses info/warn/success but not error', () => {
    const err = captureStream(process.stderr);
    try {
      log.configure({ quiet: true });
      log.info('info');
      log.warn('warn');
      log.success('success');
      log.error('error');
      expect(err.drain()).toBe('error\n');
    } finally {
      err.restore();
    }
  });

  it('verbose enables debug', () => {
    const err = captureStream(process.stderr);
    try {
      log.configure({ verbose: true });
      log.debug('detail');
      expect(err.drain()).toBe('detail\n');
    } finally {
      err.restore();
    }
  });

  it('debug() is suppressed by default', () => {
    const err = captureStream(process.stderr);
    try {
      log.debug('detail');
      expect(err.drain()).toBe('');
    } finally {
      err.restore();
    }
  });

  it('json mode suppresses info on stderr (machine-readable stdout)', () => {
    const err = captureStream(process.stderr);
    try {
      log.configure({ json: true });
      log.info('chatter');
      expect(err.drain()).toBe('');
    } finally {
      err.restore();
    }
  });

  it('color:false sets chalk.level to 0', () => {
    const chalk = require('chalk');
    log.configure({ color: false });
    expect(chalk.level).toBe(0);
  });

  it('NO_COLOR env forces chalk.level to 0', () => {
    const chalk = require('chalk');
    const prev = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    try {
      log.configure({});
      expect(chalk.level).toBe(0);
    } finally {
      if (prev === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = prev;
    }
  });

  it('isVerbose / isDebug / isJson / isQuiet reflect config', () => {
    log.configure({ verbose: true });
    expect(log.isVerbose()).toBe(true);
    log.reset();
    log.configure({ debug: true });
    expect(log.isDebug()).toBe(true);
    expect(log.isVerbose()).toBe(true);
    log.reset();
    log.configure({ json: true });
    expect(log.isJson()).toBe(true);
    log.reset();
    log.configure({ quiet: true });
    expect(log.isQuiet()).toBe(true);
  });
});
