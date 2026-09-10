import { sqlClient } from '../db/client';

async function fix() {
  await sqlClient.unsafe(`UPDATE accounts SET account_id = user_id WHERE provider_id = 'credential'`);
  console.log('✅ Updated all credential accounts so account_id = user_id');
  await sqlClient.end();
}

fix();
