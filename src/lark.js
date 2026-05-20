import 'dotenv/config';

const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;

export async function getAccessToken() {
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
    const token = await getAccessToken();

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

  console.log('Message sent successfully!: ', data.data.body.content);
  return data;
}

// Send a message to a group chat
export async function sendGroupMessage(chatId, message) {
  const token = await getAccessToken();

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
  console.log('Group message response:', data.body.content);
  return data;
}

// Copy the template sheet and return the new file's URL
export async function copyTemplate(clientName) {
  const token = await getAccessToken();
  const date = new Date().toLocaleDateString('en-GB', { 
    day: 'numeric', month: 'short', year: 'numeric' 
  });
  const newFileName = `Supply Knowledge Sheet — ${clientName} — ${date}`;

  console.log('Template token:', process.env.LARK_TEMPLATE_TOKEN);
  console.log('Folder token:', process.env.LARK_FOLDER_TOKEN);
  console.log('New file name:', newFileName);

  const response = await fetch(`https://open.larksuite.com/open-apis/drive/v1/files/${process.env.LARK_TEMPLATE_TOKEN}/copy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: newFileName,
      folder_token: process.env.LARK_FOLDER_TOKEN,
    }),
  });

  const data = await response.json();
  console.log('Full copy response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to copy template: ${data.msg}`);
  }

  const fileToken = data.data.file.token;
  return `https://larksuite.com/sheets/${fileToken}`;
}