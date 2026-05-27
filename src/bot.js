import { sendDirectMessage, sendGroupMessage, createGroupChat } from './lark/messenger.js';
import { copyTemplate } from './lark/drive.js';
import { getUserTokens } from './tokenStore.js';

const SNS_TRIGGER_KEYWORD = '!newSNsheet';
const DEFAULT_MEMBER_IDS = process.env.DEFAULT_MEMBER_IDS
  ? process.env.DEFAULT_MEMBER_IDS.split(',')
  : [];
console.log(DEFAULT_MEMBER_IDS.toString)

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

   // include the triggering user in the group chat
    const members = [...new Set([...DEFAULT_MEMBER_IDS, senderUserId])];

    // run sheet copy and group creation in parallel
    const [fileLink, chatId] = await Promise.all([
      copyTemplate(clientName, userTokens.access_token, senderUserId),
      createGroupChat(clientName, members),
    ]);

    // send sheet link to the newly created group chat
    await sendGroupMessage(chatId, `📋 Supply Knowledge Sheet for *${clientName}*:\n${fileLink}`);

    // confirm to the person who triggered it
    await sendDirectMessage(senderUserId, `✅ Done! Group chat and sheet created for *${clientName}*:\n${fileLink}`);


  } catch (error) {
    console.error('Bot error:', error.message);
    console.error('Stack:', error.stack);
  }
}