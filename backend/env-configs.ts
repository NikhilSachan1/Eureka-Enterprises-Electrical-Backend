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

  // App configuration
  APP_ENVIRONMENT: process.env.APP_ENVIRONMENT,
  APP_PORT: process.env.APP_PORT,

  // JWT configuration
  JWT_AUTH_TOKEN_EXPIRY: process.env.JWT_AUTH_TOKEN_EXPIRY,
  FORGET_PASSWORD_TOKEN_EXPIRY: process.env.FORGET_PASSWORD_TOKEN_EXPIRY,
  JWT_AUTH_SECRET_KEY: process.env.JWT_AUTH_SECRET_KEY,

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
};
