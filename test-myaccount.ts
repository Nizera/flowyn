import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { asaasRequest } from './src/lib/asaas';

async function run() {
  try {
    const res = await asaasRequest('/myAccount');
    console.log(res);
  } catch (err) {
    console.error("Error calling /myAccount:");
    console.error(err);
  }
}

run();
