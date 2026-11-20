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

export async function disbandGroupChat(chatId) {
  const token = await getTenantAccessToken();

  const response = await fetch(`https://open.larksuite.com/open-apis/im/v1/chats/${chatId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to disband group: ${text}`);
  }

  return true;
}

export async function getGroupMembers(chatId) {
  const token = await getTenantAccessToken();

  const response = await fetch(`https://open.larksuite.com/open-apis/im/v1/chats/${chatId}/members?member_id_type=user_id`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log('Members response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to get group members: ${data.msg}`);
  }

  return data.data?.items || [];
}

export async function sendAuthCard(userId) {
  const token = await getTenantAccessToken();
  const authUrl = `${process.env.APP_BASE_URL}/oauth/start?userId=${userId}`;

  const card = {
    schema: '2.0',
    body: {
      elements: [
        {
          tag: 'markdown',
          content: '🔐 **Authentication Required**\n\nYour session has expired or you haven\'t authenticated yet. Please click below to authorize Lao Gong.',
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: {
                tag: 'plain_text',
                content: '🔑 Authenticate Now',
              },
              type: 'primary',
              behaviors: [
                {
                  type: 'open_url',
                  default_url: authUrl,
                }
              ],
            }
          ],
        }
      ]
    },
    header: {
      title: {
        tag: 'plain_text',
        content: 'Lao Gong Authorization',
      },
      template: 'yellow',
    },
  };

  const response = await fetch('https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=user_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: userId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    }),
  });

  const data = await response.json();
  console.log('Auth card response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to send auth card: ${data.msg}`);
  }

  return data;
}

export async function sendVoiceCard(chatId, body) {
  const token = await getTenantAccessToken();

  const isVeggie = body.solution === 'Vegetable Industry Solutions';

  const BASE_APP_TOKEN = process.env.STORY_BASE_APP_TOKEN;
  const viewId = isVeggie ? 'vewK9icdwp' : 'vewFAgLH4L';
  const tableId = process.env.VOICE_TABLE_ID; // Voice Data table
  const recordUrl = `https://larksuite.com/base/${BASE_APP_TOKEN}?table=${tableId}&view=${viewId}&record=${body.recordId}`;

  const headerColor = isVeggie ? 'green' : 'blue';
  const headerTitle = isVeggie
    ? `🥦 Veggie Voice — ${body.clientName}`
    : `🚛 3PL Voice — ${body.clientName}`;

  // build detail rows based on solution type
  const details = isVeggie ? [
    { tag: 'markdown', content: `**📅 Voice Date:** ${body.vDate}` },
    { tag: 'markdown', content: `**🥬 กำลังตามหา:** ${body.veggieProduct || '-'}` },
    { tag: 'markdown', content: `**😣 Pain Point:** ${body.solutionExplain || '-'}` },
    { tag: 'markdown', content: `**📝 Extra Info:** ${body.extraInfo || '-'}` },
  ] : [
    { tag: 'markdown', content: `**📅 Voice Date:** ${body.vDate}` },
    { tag: 'markdown', content: `**📦 Product:** ${body.tplProduct || '-'}` },
    { tag: 'markdown', content: `**📍 Destination:** ${body.tplDestination || '-'}` },
    { tag: 'markdown', content: `**😣 Pain Point:** ${body.solutionExplain || '-'}` },
    { tag: 'markdown', content: `**📝 Extra Info:** ${body.extraInfo || '-'}` },
  ];

  const card = {
    schema: '2.0',
    header: {
      title: {
        tag: 'plain_text',
        content: headerTitle,
      },
      template: headerColor,
    },
    body: {
      elements: [
        ...details,
        { tag: 'hr' },
        {
        tag: 'button', // Lifted directly into elements array
        text: {
          tag: 'plain_text',
          content: '📋 View Voice Record',
        },
        type: 'primary',
        behaviors: [
          {
            type: 'open_url',
            default_url: recordUrl,
          }
        ],
        }
      ],
    },
  };

  const response = await fetch('https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    }),
  });

  const data = await response.json();
  console.log('Voice card response:', JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to send voice card: ${data.msg}`);
  }

  return data.data?.message_id;
}

function supplyRequestFormCard(assignee) {
  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: '📦 Create New Supply Base Enquiry' },
      template: 'blue',
    },
    body: {
      elements: [
        { tag: 'markdown', content: `**Assigned to:** ${assignee}` },
        {
          tag: 'form',
          name: 'supply_request_form',
          elements: [
            {
              tag: 'input',
              name: 'product',
              required: true,
              label: { tag: 'plain_text', content: 'Product / Client / Topic' },
              label_position: 'top',
              max_length: 100,
            },
            {
              tag: 'input',
              name: 'item_code',
              required: false,
              label: { tag: 'plain_text', content: 'Item Code (if applicable)' },
              label_position: 'top',
              max_length: 100,
            },
            {
              tag: 'input',
              name: 'request',
              required: false,
              input_type: 'multiline_text',
              rows: 3,
              auto_resize: true,
              max_rows: 6,
              label: { tag: 'plain_text', content: 'My Request (optional)' },
              label_position: 'top',
              max_length: 1000,
            },
            { tag: 'markdown', content: '**Due Date (optional)**' },
            {
              tag: 'date_picker',
              name: 'due_date',
              required: false,
              placeholder: { tag: 'plain_text', content: 'Select a date' },
              width: 'fill',
            },
            {
              tag: 'button',
              name: 'submit_btn',
              text: { tag: 'plain_text', content: 'Submit request' },
              type: 'primary',
              form_action_type: 'submit',
              behaviors: [{ type: 'callback', value: { action: 'supply_request' } }],
            },
          ],
        },
      ],
    },
  };
}

// Read-only version that replaces the form after submission
export function supplyRequestSubmittedCard(values) {
  const when = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short',
  });

  return {
    schema: '2.0',
    header: {
      title: { tag: 'plain_text', content: '✅ Supply Base Enquiry submitted' },
      template: 'green',
    },
    body: {
      elements: [
        {
          tag: 'markdown',
          content: [
            `**Product / Client / Topic:** ${values.product}`,
            `**Item Code:** ${values.itemCode || '-'}`,
            `**My Request:** ${values.request || '-'}`,
            `**Assigned to:** ${values.assignedTo}`,
            `**Due Date:** ${values.dueDate || '-'}`,
            '',
            `Submitted by Loppana · ${when}`,
          ].join('\n'),
        },
      ],
    },
  };
}

export async function sendSupplyRequestCard(chatId, assignee) {
  const token = await getTenantAccessToken();

  const response = await fetch('https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(supplyRequestFormCard(assignee)),
    }),
  });

  const data = await response.json();
  if (data.code !== 0) throw new Error(`Failed to send supply request card: ${data.msg}`);
  return data.data?.message_id;
}