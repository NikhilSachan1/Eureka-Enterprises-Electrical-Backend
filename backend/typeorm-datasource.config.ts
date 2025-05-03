import { config } from 'dotenv';
import { ConfigService } from 'src/utils/config/config.service';
import { DataSource } from 'typeorm';

config();

const options = ConfigService.getOrmConfig('migration_connection', true);
const connection = new DataSource(options);

export default connection;
