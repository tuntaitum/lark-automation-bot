import 'dotenv/config';
import { getUserTokens, saveUserTokens } from '../tokenStore.js';

const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;

export async function getTenantAccessToken() {
  const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: APP_ID,
      app_secret: APP_SECRET,
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Failed to get tenant token: ${data.msg}`);
  }

  return data.tenant_access_token;
}

export async function exchangeCodeForToken(authorization_code) {
  const response = await fetch('https://open.larksuite.com/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      code: authorization_code,
      redirect_uri: `${process.env.APP_BASE_URL}/oauth/callback`,
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Token exchange failed: ${data.msg}`);
  }

  return data;
}

export async function refreshUserToken(userId) {
  const userTokens = await getUserTokens(userId);

  if (!userTokens?.refresh_token) {
    throw new Error('No refresh token available');
  }

  const response = await fetch('https://open.larksuite.com/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      refresh_token: userTokens.refresh_token,
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Token refresh failed: ${data.msg}`);
  }

  await saveUserTokens(userId, data.access_token, data.refresh_token);
  return data.access_token;
}