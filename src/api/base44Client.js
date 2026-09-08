import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const db = createClient({
  appId: appParams.appId,
  appBaseUrl: appParams.appBaseUrl,
  token: appParams.token,
  requiresAuth: false,
});

export const base44 = db;
export default db;
