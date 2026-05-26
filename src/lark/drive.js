import { getUserTokens, refreshUserToken } from './auth.js';

const BOT_OWNER_ID = process.env.BOT_OWNER_ID; // your user ID

export async function copyTemplate(clientName, userAccessToken, userId) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const newFileName = `Supply Knowledge Sheet — ${clientName} — ${date}`;

  // always use bot owner token for copying
  const ownerTokens = await getUserTokens(BOT_OWNER_ID);
  const copyToken = ownerTokens?.access_token;

  if (!copyToken) {
    throw new Error('Bot owner token not found — please authenticate at /oauth/start');
  }

  async function attemptCopy(token) {
    const response = await fetch(`https://open.larksuite.com/open-apis/drive/explorer/v2/file/copy/files/${process.env.SNS_TEMPLATE_TOKEN}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dstName: newFileName,
        dstFolderToken: process.env.SNS_FOLDER_TOKEN,
        type: 'sheet',
      }),
    });
    return await response.json();
  }

  let data = await attemptCopy(copyToken);

  if (data.code === 99991677) {
    console.log('Owner token expired — refreshing...');
    const newToken = await refreshUserToken(BOT_OWNER_ID);
    data = await attemptCopy(newToken);
  }

  if (data.code !== 0) {
    throw new Error(`Failed to copy template: ${data.msg}`);
  }

  return data.data?.url;
}