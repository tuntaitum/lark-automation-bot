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

  return data.data?.message_id;
}

export async function createGroupChat(chatName, memberUserIds = []) {
  const token = await getTenantAccessToken();

  const response = await fetch('https://open.larksuite.com/open-apis/im/v1/chats?set_bot_manager=true&user_id_type=user_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: chatName,
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

export async function sendGroupMention(chatId, userId, message) {
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
      content: JSON.stringify({ text: `<at user_id="${userId}"></at> ${message}` }),
    }),
  });

  const data = await response.json();
  console.log('Group mention response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to send group mention: ${data.msg}`);
  }

  return data;
}

export async function getGroupInfo(chatId) {
  const token = await getTenantAccessToken();

  const response = await fetch(`https://open.larksuite.com/open-apis/im/v1/chats/${chatId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Failed to get group info: ${data.msg}`);
  }

  return data.data;
}

export async function renameGroupChat(chatId, newName) {
  const token = await getTenantAccessToken();

  const response = await fetch(`https://open.larksuite.com/open-apis/im/v1/chats/${chatId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });

  const data = await response.json();
  console.log('Rename group response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to rename group: ${data.msg}`);
  }

  return data;
}

export async function pinMessage(messageId) {
  const token = await getTenantAccessToken();

  const response = await fetch('https://open.larksuite.com/open-apis/im/v1/pins', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message_id: messageId }),
  });

  const data = await response.json();
  console.log('Pin message response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to pin message: ${data.msg}`);
  }

  return data;
}

export async function listClientChats() {
  const token = await getTenantAccessToken();
  let allChats = [];
  let pageToken = null;

  // loop through pages since API returns max 100 per page
  do {
    const url = new URL('https://open.larksuite.com/open-apis/im/v1/chats');
    url.searchParams.set('page_size', '100');
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('List chats response:', JSON.stringify(data, null, 2));

    if (data.code !== 0) {
      throw new Error(`Failed to list chats: ${data.msg}`);
    }

    allChats = allChats.concat(data.data?.items || []);
    pageToken = data.data?.has_more ? data.data.page_token : null;

  } while (pageToken);

  // filter for client group chats only
  const veggiChats = allChats.filter(chat => chat.name?.endsWith('- Veggie Solution'));
  const tplChats = allChats.filter(chat => chat.name?.endsWith('- 3PL'));

  return { veggiChats, tplChats };
}