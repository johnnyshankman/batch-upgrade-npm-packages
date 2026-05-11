export const CODES = {
  SUCCESS: 0,
  RUNTIME: 1,
  USAGE: 2,
  AUTH: 3,
  NOT_FOUND: 4,
  DIRTY: 5,
} as const;

export type ExitCode = (typeof CODES)[keyof typeof CODES];

export class CliError extends Error {
  override readonly name = 'CliError';
  readonly code: ExitCode;
  readonly hint?: string;

  constructor(message: string, code: ExitCode = CODES.RUNTIME, hint?: string) {
    super(message);
    this.code = code;
    if (hint !== undefined) this.hint = hint;
  }
}
