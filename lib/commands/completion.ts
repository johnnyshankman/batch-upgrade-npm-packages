import type { Command } from 'commander';
import chalk from 'chalk';
import * as log from '../log.js';
import { CODES } from '../exit-codes.js';

const SHELLS = ['bash', 'zsh', 'fish'] as const;
type Shell = (typeof SHELLS)[number];

const SUBCOMMANDS = ['upgrade', 'config', 'completion', 'help'] as const;
const UPGRADE_FLAGS = [
  '--packages',
  '-p',
  '--versions',
  '--repos',
  '-r',
  '--base',
  '-b',
  '--interactive',
  '-i',
  '--yes',
  '-y',
  '--reset-hard',
  '--dry-run',
  '-n',
  '--json',
  '--quiet',
  '-q',
  '--verbose',
  '-v',
  '--debug',
  '--no-color',
  '--help',
  '-h',
] as const;
const CONFIG_SUB = ['get', 'set', 'list'] as const;

function bashScript(): string {
  return `# bash completion for batch-upgrade-npm
_batch_upgrade_npm() {
  local cur prev cmd
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  cmd="\${COMP_WORDS[1]}"

  if [ "$COMP_CWORD" = 1 ]; then
    COMPREPLY=( $(compgen -W "${SUBCOMMANDS.join(' ')}" -- "$cur") )
    return 0
  fi

  case "$cmd" in
    upgrade)
      COMPREPLY=( $(compgen -W "${UPGRADE_FLAGS.join(' ')}" -- "$cur") )
      ;;
    config)
      if [ "$COMP_CWORD" = 2 ]; then
        COMPREPLY=( $(compgen -W "${CONFIG_SUB.join(' ')}" -- "$cur") )
      fi
      ;;
    completion)
      if [ "$COMP_CWORD" = 2 ]; then
        COMPREPLY=( $(compgen -W "${SHELLS.join(' ')}" -- "$cur") )
      fi
      ;;
  esac
}
complete -F _batch_upgrade_npm batch-upgrade-npm
`;
}

function zshScript(): string {
  return `#compdef batch-upgrade-npm
# zsh completion for batch-upgrade-npm
_batch_upgrade_npm() {
  local -a subcommands upgrade_flags config_sub shells
  subcommands=(${SUBCOMMANDS.map((s) => `'${s}'`).join(' ')})
  upgrade_flags=(${UPGRADE_FLAGS.map((f) => `'${f}'`).join(' ')})
  config_sub=(${CONFIG_SUB.map((s) => `'${s}'`).join(' ')})
  shells=(${SHELLS.map((s) => `'${s}'`).join(' ')})

  if (( CURRENT == 2 )); then
    _describe 'subcommand' subcommands
    return
  fi

  case "\${words[2]}" in
    upgrade)
      _describe 'flag' upgrade_flags
      ;;
    config)
      if (( CURRENT == 3 )); then
        _describe 'subcommand' config_sub
      fi
      ;;
    completion)
      if (( CURRENT == 3 )); then
        _describe 'shell' shells
      fi
      ;;
  esac
}
compdef _batch_upgrade_npm batch-upgrade-npm
`;
}

function fishScript(): string {
  let out = '# fish completion for batch-upgrade-npm\n';
  for (const sub of SUBCOMMANDS) {
    out += `complete -c batch-upgrade-npm -n "__fish_use_subcommand" -a "${sub}"\n`;
  }
  for (const flag of UPGRADE_FLAGS) {
    if (flag.startsWith('--')) {
      out += `complete -c batch-upgrade-npm -n "__fish_seen_subcommand_from upgrade" -l "${flag.slice(2)}"\n`;
    } else {
      out += `complete -c batch-upgrade-npm -n "__fish_seen_subcommand_from upgrade" -s "${flag.slice(1)}"\n`;
    }
  }
  for (const sub of CONFIG_SUB) {
    out += `complete -c batch-upgrade-npm -n "__fish_seen_subcommand_from config" -a "${sub}"\n`;
  }
  for (const sh of SHELLS) {
    out += `complete -c batch-upgrade-npm -n "__fish_seen_subcommand_from completion" -a "${sh}"\n`;
  }
  return out;
}

function isShell(s: string): s is Shell {
  return (SHELLS as readonly string[]).includes(s);
}

export default function registerCompletion(program: Command): void {
  program
    .command('completion <shell>')
    .usage('<shell> [options]')
    .description(`Print a shell completion script. Supported shells: ${SHELLS.join(', ')}`)
    .addHelpText(
      'after',
      `
Examples:
  # Bash (eval at startup):
  $ eval "$(batch-upgrade-npm completion bash)"

  # Zsh (write to fpath):
  $ batch-upgrade-npm completion zsh > "\${fpath[1]}/_batch-upgrade-npm"

  # Fish:
  $ batch-upgrade-npm completion fish > ~/.config/fish/completions/batch-upgrade-npm.fish
`
    )
    .action((shell: string) => {
      if (!isShell(shell)) {
        log.error(chalk.red(`Error: unknown shell '${shell}'.`));
        log.error(chalk.red(`  → Try: ${SHELLS.join(', ')}`));
        process.exit(CODES.USAGE);
      }
      switch (shell) {
        case 'bash':
          process.stdout.write(bashScript());
          break;
        case 'zsh':
          process.stdout.write(zshScript());
          break;
        case 'fish':
          process.stdout.write(fishScript());
          break;
      }
    });
}
