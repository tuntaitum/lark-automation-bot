import { refreshUserToken } from './auth.js';

export async function copyTemplate(clientName, userAccessToken, userId) {
  console.log('copyTemplate called for:', clientName);
  console.log('userId:', userId);
  console.log('userAccessToken exists:', !!userAccessToken);
  
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const newFileName = `Supply Knowledge Sheet — ${clientName} — ${date}`;

  async function attemptCopy(token) {
  const response = await fetch(`https://open.larksuite.com/open-apis/drive/v1/files/${process.env.SNS_TEMPLATE_TOKEN}/copy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: newFileName,
      folder_token: process.env.SNS_FOLDER_TOKEN, // note: underscore not camelCase for this endpoint
      type: 'sheet',
    }),
  });
  return await response.json();
}

  let data = await attemptCopy(userAccessToken);
  console.log('Copy response:', JSON.stringify(data, null, 2));

  // if token expired, refresh and retry once
  if (data.code === 99991677) {
    console.log('Token expired — refreshing...');
    const newToken = await refreshUserToken(userId);
    data = await attemptCopy(newToken);
  }

  if (data.code !== 0) {
    throw new Error(`Failed to copy template: ${data.msg}`);
  }

  return data.data?.url;
}