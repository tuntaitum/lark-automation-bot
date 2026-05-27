import { getTenantAccessToken } from './auth.js';

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
    throw new Error(`Failed to send direct message: ${data.msg}`);
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

  if (data.code !== 0) {
    throw new Error(`Failed to send group message: ${data.msg}`);
  }

  return data;
}

export async function createGroupChat(clientName, memberUserIds = []) {
  const token = await getTenantAccessToken();

  const response = await fetch('https://open.larksuite.com/open-apis/im/v1/chats?set_bot_manager=true&user_id_type=user_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Supply Knowledge — ${clientName}`,
      description: `Supply Knowledge Sheet group for ${clientName}`,
      user_id_list: memberUserIds,
      owner_id: process.env.BOT_OWNER_ID,
    }),
  });

  const data = await response.json();
  console.log('Create group chat response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to create group chat: ${data.msg}`);
  }

  return data.data.chat_id;
}