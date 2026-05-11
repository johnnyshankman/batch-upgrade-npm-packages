import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface MockGhOptions {
  failAuth?: boolean;
  failPr?: boolean;
}

export interface MockGh {
  dir: string;
  pathPrefix: string;
  envPath: string;
  cleanup(): void;
}

export function makeMockGh({ failAuth = false, failPr = false }: MockGhOptions = {}): MockGh {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-mockgh-'));
  const ghPath = path.join(dir, 'gh');
  const authExit = failAuth ? 1 : 0;
  const prExit = failPr ? 1 : 0;

  const script = `#!/bin/bash
case "$1 $2" in
  "auth status")
    exit ${authExit}
    ;;
  "pr create")
    if [ "${prExit}" -ne 0 ]; then
      echo "mock gh: pr create failed" >&2
      exit ${prExit}
    fi
    echo "https://github.com/fake/repo/pull/1"
    exit 0
    ;;
  *)
    echo "mock gh: unhandled args: $@" >&2
    exit 1
    ;;
esac
`;

  fs.writeFileSync(ghPath, script, { mode: 0o755 });

  return {
    dir,
    pathPrefix: dir,
    envPath: `${dir}:${process.env['PATH'] ?? ''}`,
    cleanup(): void {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
