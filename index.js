// -----------------------------------------------------------------------------
// Entry point of the Flair integration for Gladys Assistant.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them: `new GladysIntegration()` is enough. Everything else is
// wired in src/app.js.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const gladys = new GladysIntegration();
const { sync } = registerHandlers(gladys);

// The SDK disconnects cleanly and exits with code 0 on SIGTERM/SIGINT.
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  sync.stop();
});

logger.info('Starting the Flair integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
