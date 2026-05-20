import { sendGroupMessage, copyTemplate } from './lark.js';

const TRIGGER_KEYWORD = '!newSNsheet';
const DESIGNATED_CHAT_ID = process.env.LARK_GROUP_CHAT_ID; // add this to .env

export async function handleEvent(body) {
  try {
    // schema 2.0 — event type is in header
    const eventType = body?.header?.event_type;
    if (eventType !== 'im.message.receive_v1') return;

    const event = body?.event;
    if (!event) return;

    const messageContent = JSON.parse(event.message.content);
    const text = messageContent.text?.trim();
    const senderUserId = event.sender.sender_id.user_id;

    console.log('Message received:', text);
    console.log('From user:', senderUserId);

    // check for trigger keyword
    if (!text?.startsWith(TRIGGER_KEYWORD)) return;

    // extract client name after the keyword
    const clientName = text.replace(TRIGGER_KEYWORD, '').trim();

    if (!clientName) {
      await sendGroupMessage(senderUserId, '⚠️ Please include a client name — e.g. !newSNsheet SeaTech');
      return;
    }

    console.log('Creating sheet for:', clientName);

    // confirm to the person who triggered it
    await sendGroupMessage(senderUserId, `⏳ Creating Supply Knowledge Sheet for *${clientName}*...`);

    // copy the template
    const fileLink = await copyTemplate(clientName);

    // send link to the DESIGNATED group chat
    await sendGroupMessage(DESIGNATED_CHAT_ID, `📋 New Supply Knowledge Sheet for *${clientName}*:\n${fileLink}`);

    // also confirm back to whoever triggered it
    await sendGroupMessage(senderUserId, `✅ Done! Sheet has been shared to the group.`);

  } catch (error) {
    console.error('Bot error:', error.message);
  }
}