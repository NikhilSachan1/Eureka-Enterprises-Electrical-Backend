import * as fs from 'fs';
import * as net from 'net';
import { Client } from 'ssh2';
import { Environments } from '../../../env-configs';

/**
 * The RDS instance is no longer publicly reachable — it only resolves to a
 * private VPC address. Local development therefore has to forward every database
 * connection through the bastion host over SSH. (Deployed environments run
 * inside the VPC and connect directly, so this is gated to LOCAL by the caller.)
 *
 * This module opens a local TCP listener and forwards each incoming socket over
 * a shared SSH connection. A per-socket forward (rather than a single static
 * tunnel) is what makes this work with a TypeORM/pg pool: the pool opens and
 * recycles many connections over the process lifetime, and each one gets its
 * own SSH channel.
 */

export interface SshTunnel {
  /** Local address TypeORM should connect to. */
  host: string;
  /** Local port TypeORM should connect to. */
  port: number;
  close(): Promise<void>;
}

interface SshTunnelOptions {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  privateKey: Buffer;
  passphrase?: string;
  destHost: string;
  destPort: number;
  localHost: string;
  /** 0 lets the OS assign a free port. */
  localPort: number;
}

function log(message: string): void {
  // Runs during DataSource creation / migration CLI, before Nest's logger exists — console is intentional.
  // eslint-disable-next-line no-console
  console.log(`[ssh-tunnel] ${message}`);
}

/**
 * Accepts the key either inline (raw PEM, PEM with escaped newlines, or base64
 * of the PEM) or as a path on disk. Hosted platforms can only supply env
 * values, while local development is easier with a file.
 */
export function resolvePrivateKey(): Buffer {
  const inline = Environments.DATABASE_SSH_PRIVATE_KEY;

  if (inline && inline.trim() !== '') {
    const trimmed = inline.trim();
    if (trimmed.includes('BEGIN')) {
      // Normalise escaped newlines and guarantee the trailing newline that the
      // OpenSSH key parser expects.
      return Buffer.from(`${trimmed.replace(/\\n/g, '\n').trimEnd()}\n`);
    }
    return Buffer.from(trimmed, 'base64');
  }

  const keyPath = Environments.DATABASE_SSH_PRIVATE_KEY_PATH;
  if (!keyPath || keyPath.trim() === '') {
    throw new Error(
      'DATABASE_SSH_TUNNEL is enabled but neither DATABASE_SSH_PRIVATE_KEY nor DATABASE_SSH_PRIVATE_KEY_PATH is set',
    );
  }

  if (!fs.existsSync(keyPath)) {
    throw new Error(`SSH private key not found at DATABASE_SSH_PRIVATE_KEY_PATH: ${keyPath}`);
  }

  return fs.readFileSync(keyPath);
}

async function createSshTunnel(options: SshTunnelOptions): Promise<SshTunnel> {
  let closed = false;
  let client: Client | null = null;
  let connecting: Promise<Client> | null = null;

  const connect = (): Promise<Client> =>
    new Promise<Client>((resolve, reject) => {
      const sshClient = new Client();

      // Own the underlying socket so it can be unref'd — the tunnel must never
      // be the only thing keeping the process alive, otherwise short-lived
      // commands (migrations) would hang after finishing.
      const socket = net.connect(options.sshPort, options.sshHost);
      socket.unref();

      const onReady = () => {
        sshClient.removeListener('error', onError);

        sshClient.on('error', (err: Error) => {
          log(`connection error: ${err.message}`);
        });
        sshClient.on('close', () => {
          if (client === sshClient) {
            client = null;
            if (!closed) {
              log('connection closed — will redial on next database connection');
            }
          }
        });

        log(`connected to ${options.sshUser}@${options.sshHost}:${options.sshPort}`);
        resolve(sshClient);
      };

      const onError = (err: Error) => {
        sshClient.removeListener('ready', onReady);
        socket.destroy();
        reject(err);
      };

      sshClient.once('ready', onReady);
      sshClient.once('error', onError);

      sshClient.connect({
        sock: socket,
        username: options.sshUser,
        privateKey: options.privateKey,
        passphrase: options.passphrase,
        readyTimeout: 20000,
        // Detect a dead bastion instead of hanging forever on a stale channel.
        keepaliveInterval: 15000,
        keepaliveCountMax: 3,
      });
    });

  /**
   * Returns a ready SSH connection, redialling if the previous one dropped.
   * Concurrent callers share a single in-flight dial.
   */
  const getClient = (): Promise<Client> => {
    if (closed) {
      return Promise.reject(new Error('SSH tunnel is closed'));
    }
    if (client) {
      return Promise.resolve(client);
    }
    if (!connecting) {
      connecting = connect()
        .then((connected) => {
          client = connected;
          connecting = null;
          return connected;
        })
        .catch((err) => {
          connecting = null;
          throw err;
        });
    }
    return connecting;
  };

  const server = net.createServer((socket) => {
    socket.on('error', (err: Error) => {
      log(`local socket error: ${err.message}`);
      socket.destroy();
    });

    getClient()
      .then(
        (sshClient) =>
          new Promise<void>((resolve, reject) => {
            sshClient.forwardOut(
              options.localHost,
              socket.remotePort ?? 0,
              options.destHost,
              options.destPort,
              (err, stream) => {
                if (err) {
                  reject(err);
                  return;
                }

                stream.on('error', () => socket.destroy());
                stream.on('close', () => socket.destroy());
                socket.on('close', () => stream.destroy());

                socket.pipe(stream).pipe(socket);
                resolve();
              },
            );
          }),
      )
      .catch((err: Error) => {
        log(`failed to forward connection: ${err.message}`);
        socket.destroy();
      });
  });

  await new Promise<void>((resolve, reject) => {
    const onListenError = (err: Error) => reject(err);
    server.once('error', onListenError);
    server.listen(options.localPort, options.localHost, () => {
      server.removeListener('error', onListenError);
      resolve();
    });
  });

  server.unref();

  const address = server.address() as net.AddressInfo;

  // Dial once up front so a bad key or unreachable bastion fails at boot rather
  // than on the first query.
  try {
    await getClient();
  } catch (err) {
    server.close();
    throw err;
  }

  log(
    `forwarding ${options.localHost}:${address.port} -> ${options.destHost}:${options.destPort} via ${options.sshHost}`,
  );

  return {
    host: options.localHost,
    port: address.port,
    close: () =>
      new Promise<void>((resolve) => {
        closed = true;
        const active = client;
        client = null;
        if (active) {
          active.end();
        }
        server.close(() => resolve());
      }),
  };
}

let tunnelPromise: Promise<SshTunnel> | null = null;

/**
 * Establishes the tunnel once per process. Returns null when tunnelling is
 * disabled (flag off), in which case callers should use the database host
 * directly. The LOCAL-environment gate lives in ConfigService.resolveOrmConfig.
 */
export function ensureDatabaseTunnel(): Promise<SshTunnel | null> {
  if (!Environments.DATABASE_SSH_TUNNEL) {
    return Promise.resolve(null);
  }

  if (!tunnelPromise) {
    const sshHost = Environments.DATABASE_SSH_HOST;
    const sshUser = Environments.DATABASE_SSH_USER;

    if (!sshHost || !sshUser) {
      return Promise.reject(
        new Error(
          'DATABASE_SSH_TUNNEL is enabled but DATABASE_SSH_HOST or DATABASE_SSH_USER is missing',
        ),
      );
    }
    if (!Environments.DATABASE_HOST) {
      return Promise.reject(new Error('DATABASE_HOST is required to open the SSH tunnel'));
    }

    tunnelPromise = createSshTunnel({
      sshHost,
      sshPort: Environments.DATABASE_SSH_PORT,
      sshUser,
      privateKey: resolvePrivateKey(),
      passphrase: Environments.DATABASE_SSH_PASSPHRASE || undefined,
      destHost: Environments.DATABASE_HOST,
      destPort: Environments.DATABASE_PORT,
      localHost: Environments.DATABASE_SSH_LOCAL_HOST,
      localPort: Environments.DATABASE_SSH_LOCAL_PORT,
    }).catch((err) => {
      // Let a later call retry instead of caching the rejection forever.
      tunnelPromise = null;
      throw err;
    });
  }

  return tunnelPromise;
}

/** Closes the tunnel — only needed by short-lived scripts (migrations). */
export async function closeDatabaseTunnel(): Promise<void> {
  if (!tunnelPromise) {
    return;
  }
  const pending = tunnelPromise;
  tunnelPromise = null;
  try {
    const tunnel = await pending;
    await tunnel.close();
  } catch {
    // Nothing to close if the tunnel never came up.
  }
}
