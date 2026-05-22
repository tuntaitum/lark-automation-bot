import 'dotenv/config';
import { getUserTokens, saveUserTokens } from './tokenStore.js';

const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;

export async function exchangeCodeForToken(authorization_code) {
  const response = await fetch('https://open.larksuite.com/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
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

export async function getTenantAccessToken() {
  const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: APP_ID,
      app_secret: APP_SECRET,
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Failed to get token: ${data.msg}`);
  }

  return data.tenant_access_token;
}

export async function sendDirectMessage(userId, message) {
  const token = await getTenantAccessToken();

  const response = await fetch('https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=user_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: userId,
      msg_type: 'text',
      content: JSON.stringify({ text: message }),
    }),
  });

  const data = await response.json();

  if (data.code !== 0) {
  throw new Error(`Failed to send message: ${data.msg}`);
  }

  return data;
}

export async function sendGroupMessage(chatId, message) {
  const token = await getTenantAccessToken();

  const response = await fetch('https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: message }),
    }),
  });

  const data = await response.json();
  return data;
}

// Copy the template sheet and return the new file's URL
export async function copyTemplate(clientName, userAccessToken, userId) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const newFileName = `Supply Knowledge Sheet — ${clientName} — ${date}`;

  async function attemptCopy(token) {
    const response = await fetch(`https://open.larksuite.com/open-apis/drive/explorer/v2/file/copy/files/${process.env.LARK_TEMPLATE_TOKEN}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newFileName,
        dstFolderToken: process.env.LARK_FOLDER_TOKEN,
        type: 'sheet',
      }),
    });
    return await response.json();
  }

  let data = await attemptCopy(userAccessToken);

  // if token expired, refresh and retry
  if (data.code === 99991677) {
    console.log('Token expired — refreshing...');
    const newToken = await refreshUserToken(senderUserId);
    data = await attemptCopy(newToken);
  }

  if (data.code !== 0) {
    throw new Error(`Failed to copy template: ${data.msg}`);
  }

  // if token expired, refresh and retry
  if (data.code === 99991677) {
    console.log('Token expired — refreshing...');
    const newToken = await refreshUserToken(userId); // needs userId
    data = await attemptCopy(newToken);
  }

  return data.data?.url;
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