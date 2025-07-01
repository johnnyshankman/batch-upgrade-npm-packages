const { EventEmitter } = require('events');

class MockProcess extends EventEmitter {
  constructor(exitCode = 0, stdout = '', stderr = '') {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.exitCode = exitCode;
    this.stdoutData = stdout;
    this.stderrData = stderr;
    
    setTimeout(() => this.emitData(), 0);
  }
  
  emitData() {
    if (this.stdoutData) {
      this.stdout.emit('data', Buffer.from(this.stdoutData));
    }
    if (this.stderrData) {
      this.stderr.emit('data', Buffer.from(this.stderrData));
    }
    this.emit('close', this.exitCode);
  }
}

function createMockPackageJson(dependencies = {}, devDependencies = {}, peerDependencies = {}) {
  const packageJson = {};
  if (Object.keys(dependencies).length > 0) {
    packageJson.dependencies = dependencies;
  }
  if (Object.keys(devDependencies).length > 0) {
    packageJson.devDependencies = devDependencies;
  }
  if (Object.keys(peerDependencies).length > 0) {
    packageJson.peerDependencies = peerDependencies;
  }
  return JSON.stringify(packageJson);
}

function setupCommonMocks() {
  const consoleMocks = {
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {})
  };
  
  const processMocks = {
    exit: jest.spyOn(process, 'exit').mockImplementation(() => {}),
    chdir: jest.spyOn(process, 'chdir').mockImplementation(() => {}),
    cwd: jest.spyOn(process, 'cwd').mockReturnValue('/test/dir')
  };
  
  return { consoleMocks, processMocks };
}

function restoreMocks({ consoleMocks, processMocks }) {
  Object.values(consoleMocks).forEach(mock => mock.mockRestore());
  Object.values(processMocks).forEach(mock => mock.mockRestore());
}

function createSpawnMockSequence(responses) {
  let callIndex = 0;
  return jest.fn(() => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return new MockProcess(response.exitCode, response.stdout, response.stderr);
  });
}

describe('test-utils', () => {
  it('should create mock package json', () => {
    const result = createMockPackageJson({ 'test': '1.0.0' });
    expect(result).toContain('test');
  });
});

module.exports = {
  MockProcess,
  createMockPackageJson,
  setupCommonMocks,
  restoreMocks,
  createSpawnMockSequence
};