import { LogLevel } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

/**
 * Which log levels survive, by environment.
 *
 * Local keeps everything — that is where the tracking is actually wanted. Every deployed
 * environment (UAT, staging, production) keeps only `warn` and `error`.
 *
 * `error` and `warn` are deliberately NOT dropped. A deployed box with no logs at all is one you
 * cannot debug when something breaks at 2am, and the noise this is meant to remove is the
 * per-request and per-query chatter, not the failures.
 */
export const resolveLogLevels = (): LogLevel[] =>
  ConfigService.isLocal() ? ['error', 'warn', 'log', 'debug', 'verbose'] : ['error', 'warn'];

/**
 * Raw `console.log` calls bypass Nest's logger completely, so the level list above cannot silence
 * them. There are ~50 of them scattered through the codebase; muting the three chatty methods here
 * is one change instead of fifty, and it keeps working for any that get added later.
 *
 * `console.warn` and `console.error` are left alone, for the same reason as above. Nest's own
 * ConsoleLogger writes through `process.stdout`, not `console.log`, so it is unaffected by this.
 */
export const muteConsoleChatterOnDeployedEnvironments = (): void => {
  if (ConfigService.isLocal()) return;

  const noop = () => undefined;
  /* eslint-disable no-console -- reassigning these is the entire purpose of this function */
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  /* eslint-enable no-console */
};
