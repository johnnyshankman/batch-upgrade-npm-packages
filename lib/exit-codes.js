const CODES = {
  SUCCESS: 0,
  RUNTIME: 1,
  USAGE: 2,
  AUTH: 3,
  NOT_FOUND: 4,
  DIRTY: 5,
};

class CliError extends Error {
  constructor(message, code = CODES.RUNTIME, hint) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.hint = hint;
  }
}

module.exports = { CODES, CliError };
