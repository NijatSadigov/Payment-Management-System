import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_JWT_SECRET = 'insecure-dev-secret-change-me';
const DEFAULT_EPOINT_PRIVATE_KEY = 'sandbox-private-key-change-me';

const isProduction = process.env.NODE_ENV === 'production';
const sandbox = (process.env.EPOINT_MODE || 'sandbox').toLowerCase() !== 'live';

export const config = {
  isProduction,
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Absolute base URL of this app — required in live mode so the gateway can
  // redirect the payer back and reach the server-to-server callback.
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',

  // Epoint online-payment gateway (epoint.az).
  // "sandbox" uses a built-in simulated gateway (no real money, works out of the
  // box). Set EPOINT_MODE=live and fill in the merchant keys to go live.
  epoint: {
    sandbox,
    publicKey: process.env.EPOINT_PUBLIC_KEY || 'SANDBOX-PUBLIC-KEY',
    privateKey: process.env.EPOINT_PRIVATE_KEY || DEFAULT_EPOINT_PRIVATE_KEY,
    baseUrl: process.env.EPOINT_BASE_URL || 'https://epoint.az/api/1',
    currency: process.env.EPOINT_CURRENCY || 'AZN',
  },

  // The sandbox gateway lets anyone "pay" without money moving, so in
  // production online payments only run against the live Epoint gateway.
  onlinePayments: !(isProduction && sandbox),
};

// Refuse to start a production server with development defaults.
export function checkProductionConfig(): void {
  if (!isProduction) return;
  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set');
  if (config.jwtSecret === DEFAULT_JWT_SECRET || config.jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be set to a random string of at least 32 characters');
  }
  if (!process.env.APP_BASE_URL || /localhost|127\.0\.0\.1/.test(config.appBaseUrl)) {
    problems.push('APP_BASE_URL must be set to the public address, e.g. https://pay.example.az');
  }
  if (!sandbox && (!process.env.EPOINT_PUBLIC_KEY || config.epoint.privateKey === DEFAULT_EPOINT_PRIVATE_KEY)) {
    problems.push('EPOINT_MODE=live needs EPOINT_PUBLIC_KEY and EPOINT_PRIVATE_KEY');
  }
  if (problems.length) {
    throw new Error('Invalid production configuration:\n - ' + problems.join('\n - '));
  }
  if (!config.onlinePayments) {
    console.warn('Online payments are disabled (EPOINT_MODE is sandbox). Set EPOINT_MODE=live to enable them.');
  }
}
