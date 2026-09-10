import { startEmailWorker } from './email.worker';
import * as dotenv from 'dotenv';

dotenv.config();

console.log('⚡ Initializing OES Background Services...');
const emailWorker = startEmailWorker();

process.on('SIGTERM', async () => {
  console.log('Shutting down background workers...');
  await emailWorker.close();
  process.exit(0);
});
