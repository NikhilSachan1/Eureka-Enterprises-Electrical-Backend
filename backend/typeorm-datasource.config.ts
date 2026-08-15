import { config } from 'dotenv';
import { ConfigService } from 'src/utils/config/config.service';
import { DataSource } from 'typeorm';

config();

// The TypeORM CLI awaits a promised DataSource, which lets the SSH tunnel come
// up (LOCAL only) before the connection is created.
const connection = ConfigService.resolveOrmConfig('migration_connection', true).then(
  (options) => new DataSource(options),
);

export default connection;
