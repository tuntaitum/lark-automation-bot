import 'dotenv/config';

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

// Send a message to a group chat
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
export async function copyTemplate(clientName) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const newFileName = `Supply Knowledge Sheet — ${clientName} — ${date}`;

  // helper so we can retry once after refresh
  async function attemptCopy(token) {
    const response = await fetch(`https://open.larksuite.com/open-apis/drive/explorer/v2/file/copy/files/${process.env.LARK_TEMPLATE_TOKEN}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dstName: newFileName,
        dstFolderToken: process.env.LARK_FOLDER_TOKEN,
        type: 'sheet',
      }),
    });
    return await response.json();
  }

  let data = await attemptCopy(process.env.LARK_USER_ACCESS_TOKEN);

  // if token expired, refresh and retry once
  if (data.code === 99991677) {
    console.log('Token expired — refreshing...');
    const newToken = await refreshAccessToken();
    data = await attemptCopy(newToken);
    console.log('Retry copy response:', JSON.stringify(data, null, 2));
  }

  if (data.code !== 0) {
    throw new Error(`Failed to copy template: ${data.msg}`);
  }

  return data.data?.url;
}

export async function refreshAccessToken() {
  const response = await fetch('https://open.larksuite.com/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: APP_ID,
      client_secret: APP_SECRET,
      refresh_token: process.env.LARK_REFRESH_TOKEN,
    }),
  });

  const data = await response.json();
  console.log('Refresh token response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Token refresh failed: ${data.msg}`);
  }

  // update in-memory tokens
  process.env.LARK_USER_ACCESS_TOKEN = data.access_token;
  if (data.refresh_token) {
    process.env.LARK_REFRESH_TOKEN = data.refresh_token;
  }

  console.log('Token refreshed successfully');
  return data.access_token;
}