import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'insecure-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Absolute base URL of this app — required in live mode so the gateway can
  // redirect the payer back and reach the server-to-server callback.
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',

  // Epoint online-payment gateway (epoint.az).
  // "sandbox" uses a built-in simulated gateway (no real money, works out of the
  // box). Set EPOINT_MODE=live and fill in the merchant keys to go live.
  epoint: {
    sandbox: (process.env.EPOINT_MODE || 'sandbox').toLowerCase() !== 'live',
    publicKey: process.env.EPOINT_PUBLIC_KEY || 'SANDBOX-PUBLIC-KEY',
    privateKey: process.env.EPOINT_PRIVATE_KEY || 'sandbox-private-key-change-me',
    baseUrl: process.env.EPOINT_BASE_URL || 'https://epoint.az/api/1',
    currency: process.env.EPOINT_CURRENCY || 'AZN',
  },
};
