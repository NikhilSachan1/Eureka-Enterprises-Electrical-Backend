import { config } from 'dotenv';

config();

export const Environments = {
  // Database configuration
  DATABASE_USERNAME: process.env.DATABASE_USERNAME,
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
  DATABASE_NAME: process.env.DATABASE_NAME,
  DATABASE_HOST: process.env.DATABASE_HOST,
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT),
  DATABASE_SSL: process.env.DATABASE_SSL === 'true' ? true : false,

  // SSH tunnel — the RDS instance is private, so LOCAL development forwards the
  // DB connection through a bastion host. Only honoured when APP_ENVIRONMENT=LOCAL
  // (see ConfigService.resolveOrmConfig); deployed envs connect directly.
  DATABASE_SSH_TUNNEL: process.env.DATABASE_SSH_TUNNEL === 'true',
  DATABASE_SSH_HOST: process.env.DATABASE_SSH_HOST,
  DATABASE_SSH_PORT: parseInt(process.env.DATABASE_SSH_PORT || '22'),
  DATABASE_SSH_USER: process.env.DATABASE_SSH_USER || 'ubuntu',
  // Either the key itself (raw PEM, escaped newlines, or base64) …
  DATABASE_SSH_PRIVATE_KEY: process.env.DATABASE_SSH_PRIVATE_KEY,
  // … or a path to it on disk, which is easier for local development.
  DATABASE_SSH_PRIVATE_KEY_PATH: process.env.DATABASE_SSH_PRIVATE_KEY_PATH,
  DATABASE_SSH_PASSPHRASE: process.env.DATABASE_SSH_PASSPHRASE,
  DATABASE_SSH_LOCAL_HOST: process.env.DATABASE_SSH_LOCAL_HOST || '127.0.0.1',
  // 0 lets the OS pick a free port, which avoids clashing with a local postgres.
  DATABASE_SSH_LOCAL_PORT: parseInt(process.env.DATABASE_SSH_LOCAL_PORT || '0'),

  // App configuration
  APP_ENVIRONMENT: process.env.APP_ENVIRONMENT,
  APP_PORT: process.env.APP_PORT,

  // JWT configuration
  JWT_AUTH_TOKEN_EXPIRY: process.env.JWT_AUTH_TOKEN_EXPIRY, // Access token: 30 minutes
  JWT_REFRESH_TOKEN_EXPIRY: process.env.JWT_REFRESH_TOKEN_EXPIRY, // Refresh token: 30 days
  JWT_REFRESH_TOKEN_EXPIRY_DAYS: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRY_DAYS),
  FORGET_PASSWORD_TOKEN_EXPIRY: process.env.FORGET_PASSWORD_TOKEN_EXPIRY,
  JWT_AUTH_SECRET_KEY: process.env.JWT_AUTH_SECRET_KEY,
  JWT_REFRESH_SECRET_KEY: process.env.JWT_REFRESH_SECRET_KEY,

  // Security configuration
  SALT_CHARACTER_LENGTH: parseInt(process.env.SALT_CHARACTER_LENGTH),
  HASH_KEY: process.env.HASH_KEY,
  HASHING_ALGORITHM: process.env.HASHING_ALGORITHM,

  // URL configuration
  API_BASE_URL: process.env.API_BASE_URL,
  FE_BASE_URL: process.env.FE_BASE_URL,

  // Email configuration
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,

  // AWS S3 configuration
  AWS_S3_REGION: process.env.AWS_S3_REGION,
  AWS_S3_ACCESS_KEY: process.env.AWS_S3_ACCESS_KEY,
  AWS_S3_SECRET_KEY: process.env.AWS_S3_SECRET_KEY,
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,

  // Feature flags
  ENFORCE_REQUIRED_HEADERS: process.env.ENFORCE_REQUIRED_HEADERS === 'true',

  // Twilio WhatsApp configuration
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === 'true',
  WHATSAPP_MODE: process.env.WHATSAPP_MODE || 'sandbox', // 'sandbox' or 'production'
};
