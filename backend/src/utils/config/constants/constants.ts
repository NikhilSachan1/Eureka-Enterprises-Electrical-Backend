export enum ENVIRONMENT_CONFIG {
  LOCAL = 'LOCAL',
  DEVELOPMENT = 'DEVELOPMENT',
  TESTING = 'TESTING',
  STAGING = 'STAGING',
  QA = 'QA',
  UAT = 'UAT',
  PRODUCTION = 'PRODUCTION',
}

export const DATASOURCE_CONFIG = {
  POSTGRES: 'postgres',
};

export const DATASOURCE_LOGS = {
  INIT_ERROR: 'Error during Data Source initialization:',
  INIT_SUCCESS: 'Data Source has been initialized!',
  DESTROY_ERROR: 'Error during Data Source destruction:',
  DESTROY_SUCCESS: 'Data Source has been destroyed!',
};
