import { sendDirectMessage, sendGroupMessage, sendGroupMention, createGroupChat } from './lark/messenger.js';
import { copyTemplate } from './lark/drive.js';
import { getUserTokens } from './tokenStore.js';

const TPL_TRIGGER_KEYWORD = '!3PL';
const VEGGIE_TRIGGER_KEYWORD = '!Veggie';
const HELP_KEYWORD = '!help';
const CSN_TRIGGER_KEYWORD = '!CSN'

const DEFAULT_VEGGIES_MEMBER_IDS = process.env.DEFAULT_VEGGIES_MEMBER_IDS
  ? process.env.DEFAULT_VEGGIES_MEMBER_IDS.split(',').map(id => id.trim())
  : [];

const DEFAULT_3PL_MEMBER_IDS = process.env.DEFAULT_3PL_MEMBER_IDS
  ? process.env.DEFAULT_3PL_MEMBER_IDS.split(',').map(id => id.trim())
  : [];

const CEO_USER_ID = process.env.CEO_USER_ID;

export async function handleEvent(body) {
  try {
    const eventType = body?.header?.event_type;
    if (eventType !== 'im.message.receive_v1') {
      console.log('Ignoring event type:', eventType);
      return;
    }

    const event = body?.event;
    if (!event?.message) return;
    if (event.sender.sender_type === 'app') return;

    const messageContent = JSON.parse(event.message.content);
    const text = messageContent.text?.trim();
    const senderUserId = event.sender.sender_id.user_id;

    console.log('Message received:', text);
    console.log('From user:', senderUserId);

    // !help
    if (text === HELP_KEYWORD) {
      const helpMessage = [
        '🤖 **Available Commands**',
        '',
        '🚛 **!3PL [ClientName]**',
        'Creates a 3PL group chat.',
        'Example: `!3PL Cogistics`',
        '',
        '🥦 **!Veggie [ClientName]**',
        'Creates a Veggie Solution group chat and Supply Knowledge Sheet.',
        'Example: `!Veggie Cogistics`',
        '',
        '📝 **@Lao Gong !CSN** (in group chat)',
        'Tags CEO to create a CSN sheet for the client.',
        '',
        '❓ **!help**',
        'Shows this list of commands.',
      ].join('\n');

      await sendDirectMessage(senderUserId, helpMessage);
      return;
    }

    // !3PL
    if (text?.startsWith(TPL_TRIGGER_KEYWORD)) {
      const clientName = text.replace(TPL_TRIGGER_KEYWORD, '').trim();

      if (!clientName) {
        await sendDirectMessage(senderUserId, '⚠️ Please include a client name — e.g. !3PL Cogistics');
        return;
      }

      const members = [...new Set([...DEFAULT_3PL_MEMBER_IDS, senderUserId, CEO_USER_ID])];
      const chatId = await createGroupChat(`${clientName} - 3PL`, members);

      await sendGroupMessage(chatId, `👋 Group created for *${clientName}*, service: 3PL. `);
      await sendDirectMessage(senderUserId, `✅ Done! 3PL group created for *${clientName}*.`);
      return;
    }

    // !Veggie
    if (text?.startsWith(VEGGIE_TRIGGER_KEYWORD)) {
      const clientName = text.replace(VEGGIE_TRIGGER_KEYWORD, '').trim();

      if (!clientName) {
        await sendDirectMessage(senderUserId, '⚠️ Please include a client name — e.g. !Veggie Cogistics');
        return;
      }

      const userTokens = await getUserTokens(senderUserId);
      if (!userTokens) {
        const authUrl = `${process.env.APP_BASE_URL}/oauth/start?userId=${senderUserId}`;
        await sendDirectMessage(senderUserId, `👋 First time setup! Please authenticate here:\n${authUrl}\n\nThen try again.`);
        return;
      }

      const members = [...new Set([...DEFAULT_VEGGIES_MEMBER_IDS, senderUserId, CEO_USER_ID])];

      // run in parallel
      const [fileLink, chatId] = await Promise.all([
        copyTemplate(clientName, userTokens.access_token, senderUserId),
        createGroupChat(`${clientName} - Veggie Solution`, members),
      ]);

      await sendGroupMessage(chatId, `👋 Group created for *${clientName}*, service: Veggie Solution. `);
      await sendGroupMessage(chatId, `📋 Supply Knowledge Sheet for *${clientName}*:\n${fileLink}`);
      await sendDirectMessage(senderUserId, `✅ Done! Veggie Solution group and sheet created for *${clientName}*.`);
      return;
    }

    // !CSN — tag CEO to make CSN sheet (only works in group chats)
    if (event.message.chat_type === 'group' && text?.includes(CSN_TRIGGER_KEYWORD)) {
      const chatId = event.message.chat_id;
      await sendGroupMention(chatId, CEO_USER_ID, `please create a CSN sheet for this client krub 🙏`);
      return;
    }

    // unrecognized command
    await sendDirectMessage(senderUserId, `❓ Unknown command. Type *!help* to see available commands.`);

  } catch (error) {
    console.error('Bot error:', error.message);
    console.error('Stack:', error.stack);
  }
}