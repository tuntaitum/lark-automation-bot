import { refreshUserToken } from './auth.js';
import { getUserTokens } from '../tokenStore.js';

const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

export async function copyTemplate(clientName) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: undefined, month: 'short', year: 'numeric'
  });
  const newFileName = `Supply Knowledge Sheet — ${clientName} — ${date}`;

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

  // always use bot owner token
  const ownerTokens = await getUserTokens(BOT_OWNER_ID);
  if (!ownerTokens?.access_token) {
    throw new Error('Bot owner token not found — please authenticate at /oauth/start');
  }

  let data = await attemptCopy(ownerTokens.access_token);

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

export async function createNoteFile(clientName) {
  const newFileName = `Notes File — ${clientName}`;

  async function attemptCopy(token) {
    const response = await fetch(`https://open.larksuite.com/open-apis/drive/explorer/v2/file/copy/files/${process.env.NOTEFILE_TEMPLATE_TOKEN}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dstName: newFileName,
        dstFolderToken: process.env.NOTEFILE_FOLDER_TOKEN,
        type: 'docx',
      }),
    });
    return await response.json();
  }

  // always use bot owner token
  const ownerTokens = await getUserTokens(BOT_OWNER_ID);
  if (!ownerTokens?.access_token) {
    throw new Error('Bot owner token not found — please authenticate at /oauth/start');
  }

  let data = await attemptCopy(ownerTokens.access_token);

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