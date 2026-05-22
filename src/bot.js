import { sendDirectMessage, sendGroupMessage } from './lark/messenger.js';
import { copyTemplate } from './lark/drive.js';
import { getUserTokens } from './tokenStore.js';

const SNS_TRIGGER_KEYWORD = '!newSNsheet';
const SNS_VEGGIEVOICE_CHAT_ID = process.env.SNS_GROUP_CHAT_ID;

export async function handleEvent(body) {
  try {
    const eventType = body?.header?.event_type;
    if (eventType !== 'im.message.receive_v1') return;

    const event = body?.event;
    if (!event?.message) return;

    if (event.sender.sender_type === 'app') return;

    const messageContent = JSON.parse(event.message.content);
    const text = messageContent.text?.trim();
    const senderUserId = event.sender.sender_id.user_id;

    if (!text?.startsWith(SNS_TRIGGER_KEYWORD)) return;

    const clientName = text.replace(SNS_TRIGGER_KEYWORD, '').trim();

    if (!clientName) {
      await sendDirectMessage(senderUserId, '⚠️ Please include a client name — e.g. !newSNsheet SeaTech');
      return;
    }

    // check if this user has authenticated
    const userTokens = await getUserTokens(senderUserId);

    if (!userTokens) {
      // no token — ask them to authenticate
      const authUrl = `${process.env.APP_BASE_URL}/oauth/start?userId=${senderUserId}`;
      await sendDirectMessage(senderUserId, `👋 First time setup! Please authenticate here so I can create sheets on your behalf:\n${authUrl}\n\nAfter authenticating, try your command again.`);
      return;
    }

    console.log('Creating sheet for:', clientName);

    const fileLink = await copyTemplate(clientName, userTokens.access_token, senderUserId);

    await sendGroupMessage(SNS_VEGGIEVOICE_CHAT_ID, `📋 New Supply Knowledge Sheet for *${clientName}*:\n${fileLink}`);
    await sendDirectMessage(senderUserId, `✅ Done! Sheet ready for *${clientName}*:\n${fileLink}`);

  } catch (error) {
    console.error('Bot error:', error.message);
    console.error('Stack:', error.stack);
  }
}