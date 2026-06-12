import { sendDirectMessage, sendGroupMessage, sendGroupMention, createGroupChat, getGroupInfo, renameGroupChat, pinMessage, listClientChats, disbandGroupChat, getGroupMembers, sendAuthCard } from './lark/messenger.js';
import { copyTemplate } from './lark/drive.js';
import { getUserTokens, setLastActivity, deleteLastActivity } from './tokenStore.js';
import { getClientStory, formatStoryMessage } from './lark/base.js';
import { createTask } from './lark/tasks.js';

const TPL_TRIGGER_KEYWORD = '/3PL';
const VEGGIE_TRIGGER_KEYWORD = '/Veggie';
const HELP_KEYWORD = '/help';
const CSN_TRIGGER_KEYWORD = '/CSN';
const SNSHEET_TRIGGER_KEYWORD = '/SNsheet';
const GREETINGS_TRIGGER_KEYWORD = ['hello', 'hi', 'hey', 'หวัดดี', 'สวัสดี', 'สวัสดีครับ', 'สวัสดีค่ะ', 'Ni hao', '你好', '您好'];
const VOICEFORM_TRIGGER_KEYWORD = '/voiceform';
const RENAME_TRIGGER_KEYWORD = '/rename';
const STORY_TRIGGER_KEYWORD = '/story';
const LISTGC_TRIGGER_KEYWORD = '/listgc';
const DISBAND_TRIGGER_KEYWORD = '/disband';
const QTASK_TRIGGER_KEYWORD = '/qtask';

const DEFAULT_VEGGIES_MEMBER_IDS = process.env.DEFAULT_VEGGIES_MEMBER_IDS
  ? process.env.DEFAULT_VEGGIES_MEMBER_IDS.split(',').map(id => id.trim())
  : [];

const DEFAULT_3PL_MEMBER_IDS = process.env.DEFAULT_3PL_MEMBER_IDS
  ? process.env.DEFAULT_3PL_MEMBER_IDS.split(',').map(id => id.trim())
  : [];

const CEO_USER_ID = process.env.CEO_USER_ID;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

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

    console.log('Chat type:', event.message.chat_type);
    console.log('Text:', text);

    // track last activity for client group chats
    if (event.message.chat_type === 'group') {
      const chatName = ''; 
      await setLastActivity(event.message.chat_id);
      
      // in group chats, only process messages that start with /
      if (!text || !text?.startsWith('/')) {
        return;
      }
    }

    console.log('Message received:', text);
    console.log('From user:', senderUserId);

    // /help
    if (text === HELP_KEYWORD) {
      const helpMessage = [
        '🤖 **Available Commands**',
        '',
        '🚛 **/3PL [ClientName]**',
        'Creates a 3PL group chat.',
        'Example: `/3PL Cogistics`',
        '',
        '🥦 **/Veggie [ClientName]**',
        'Creates a Veggie Solution group chat and Supply Knowledge Sheet.',
        'Example: `/Veggie Cogistics`',
        '',
        '📊 **/listgc**',
        'Lists all active Veggie Solution and 3PL client group chats.',
        '',
        '📌 */qtask [task info]* (DM only)',
        'Creates a quick task assigned to you due tomorrow.',
        'Example: `/qtask Call Tai about systems`',
        '',
        '📋 **/SNsheet** (in group chat)',
        'Creates a Supply Knowledge Sheet using the group name as client name.',
        '',
        '📝 **/CSN** (in group chat)',
        'Tags CEO to create a CSN sheet for the client.',
        '',
        '📊 **/story [ClientName]** or **/story** (in group chat)',
        'Pulls tasks and story from the database for a client.',
        'Example: `/story Cogistics` or just `/story` in a client group',
        '',
        '✏️ **/rename [ClientName]** (in group chat)',
        'Renames the group chat while preserving the suffix (3PL or Veggie Solution).',
        'Example: `/rename Cogistics`',
        '',
        '🗑️ */disband* (in group chat)',
        'Disbands the current group chat and removes it from tracking.',
        '',
        '❓ **/help**',
        'Shows this list of commands.',
      ].join('\n');

      await sendDirectMessage(senderUserId, helpMessage);
      return;
    }

    // /3PL
    if (text?.startsWith(TPL_TRIGGER_KEYWORD)) {
      const clientName = text.replace(TPL_TRIGGER_KEYWORD, '').trim();

      if (!clientName) {
        await sendDirectMessage(senderUserId, '⚠️ Please include a client name — e.g. /3PL Cogistics');
        return;
      }

      const members = [...new Set([...DEFAULT_3PL_MEMBER_IDS, senderUserId, CEO_USER_ID])];
      const chatId = await createGroupChat(`${clientName} - 3PL`, members);

      await sendGroupMessage(chatId, `👋 Group created for *${clientName}*, service: 3PL. `);
      await sendDirectMessage(senderUserId, `✅ Done! 3PL group created for *${clientName}*.`);
      return;
    }

    // /Veggie
    if (text?.startsWith(VEGGIE_TRIGGER_KEYWORD)) {
      const clientName = text.replace(VEGGIE_TRIGGER_KEYWORD, '').trim();

      if (!clientName) {
        await sendDirectMessage(senderUserId, '⚠️ Please include a client name — e.g. /Veggie Cogistics');
        return;
      }

      const members = [...new Set([...DEFAULT_VEGGIES_MEMBER_IDS, senderUserId, CEO_USER_ID])];

      // run in parallel
      const [fileLink, chatId] = await Promise.all([
        copyTemplate(clientName),
        createGroupChat(`${clientName} - Veggie Solution`, members),
      ]);

      await sendGroupMessage(chatId, `👋 Group created for *${clientName}*, service: Veggie Solution. `);
      const messageId = await sendGroupMessage(chatId, `📋 Supply Knowledge Sheet created for *${clientName}*:\n${fileLink}`);
      await pinMessage(messageId);
      await sendDirectMessage(senderUserId, `✅ Done! Veggie Solution group and Supply Knowledge sheet created for *${clientName}*.`);
      return;
    }

    // /listgc — list all active client group chats (DM only)
    if (text === LISTGC_TRIGGER_KEYWORD && event.message.chat_type === 'p2p') {
      const { veggiChats, tplChats } = await listClientChats();

      const lines = ['📊 *Active Client Group Chats*', ''];

      lines.push(`🥦 *Veggie Solution (${veggiChats.length})*`);
      if (veggiChats.length === 0) {
        lines.push('None');
      } else {
        veggiChats.forEach(chat => lines.push(`• ${chat.name}`));
      }

      lines.push('');
      lines.push(`🚛 *3PL (${tplChats.length})*`);
      if (tplChats.length === 0) {
        lines.push('None');
      } else {
        tplChats.forEach(chat => lines.push(`• ${chat.name}`));
      }

      lines.push('');
      lines.push(`*Total: ${veggiChats.length + tplChats.length} active groups*`);

      await sendDirectMessage(senderUserId, lines.join('\n'));
      return;
    }

    // /qtask [task info] — create a quick task (DM only)
    if (text?.startsWith(QTASK_TRIGGER_KEYWORD) && event.message.chat_type === 'p2p') {
      const taskInfo = text.replace(QTASK_TRIGGER_KEYWORD, '').trim();

      if (!taskInfo) {
        await sendDirectMessage(senderUserId, '⚠️ Please include task info — e.g. /qtask Call SeaTech about pricing');
        return;
      }

      const userTokens = await getUserTokens(senderUserId);
      if (!userTokens) {
        await sendAuthCard(senderUserId);
        return;
      }

      const task = await createTask(taskInfo, senderUserId);
  
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueDateStr = tomorrow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      await sendDirectMessage(senderUserId, `✅ Task created!\n📌 *${taskInfo}*\n📅 Due: ${dueDateStr}`);
      return;
    }

    // /CSN — tag CEO to make CSN sheet (only works in group chats)
    if (event.message.chat_type === 'group' && text?.includes(CSN_TRIGGER_KEYWORD)) {
      const chatId = event.message.chat_id;
      await sendGroupMention(chatId, CEO_USER_ID, `Please create a CSN sheet for this client krub 🙏`);
      return;
    }

    // /SNsheet — create Supply Knowledge Sheet from group name (group chat only)
    if (event.message.chat_type === 'group' && text?.includes(SNSHEET_TRIGGER_KEYWORD)) {
      const chatId = event.message.chat_id;

      // get group name and extract client name
      const groupInfo = await getGroupInfo(chatId);
      const groupName = groupInfo.name;
      const clientName = groupName.split(' - ')[0].trim();

      console.log('Group name:', groupName);
      console.log('Extracted client name:', clientName);

      const fileLink = await copyTemplate(clientName);
      const messageId = await sendGroupMessage(event.message.chat_id, `📋 Supply Knowledge Sheet created for *${clientName}*:\n${fileLink}`);
      await pinMessage(messageId);

      return;
    }

    // /rename [new name] — renames the clientName of the group chat (group chat only)
    if (event.message.chat_type === 'group' && text?.startsWith(RENAME_TRIGGER_KEYWORD)) {
      const newClientName = text.replace(RENAME_TRIGGER_KEYWORD, '').trim();

      if (!newClientName) {
        await sendGroupMessage(event.message.chat_id, '⚠️ Please include a new client name — e.g. /rename Cogistics');
        return;
      }

      // get current group name to extract suffix
      const groupInfo = await getGroupInfo(event.message.chat_id);
      const currentName = groupInfo.name;

      // extract suffix e.g. " - 3PL" or " - Veggie Solution"
      const suffixMatch = currentName.match(/ - (.+)$/);
      const suffix = suffixMatch ? ` - ${suffixMatch[1]}` : '';

      const newName = `${newClientName}${suffix}`;

      await renameGroupChat(event.message.chat_id, newName);
      await sendGroupMessage(event.message.chat_id, `✅ Group renamed to *${newName}*`);
      return;
    }

    // /story [clientName] or /story alone in group chat
    if (text?.startsWith(STORY_TRIGGER_KEYWORD)) {
      let clientName = text.replace(STORY_TRIGGER_KEYWORD, '').trim();

      // if no client name, use group chat name
      if (!clientName && event.message.chat_type === 'group') {
        const groupInfo = await getGroupInfo(event.message.chat_id);
        clientName = groupInfo.name.split(' - ')[0].trim();
        console.log('Using group name as client:', clientName);
      }

      if (!clientName) {
        await sendDirectMessage(senderUserId, '⚠️ Please include a client name — e.g. /story SeaTech');
        return;
      }

      console.log('Fetching story for:', clientName);

      const { taskRecords, storyRecords } = await getClientStory(clientName);
      const message = formatStoryMessage(clientName, taskRecords, storyRecords);

      if (event.message.chat_type === 'p2p') {
        await sendDirectMessage(senderUserId, message);
      } else {
        await sendGroupMessage(event.message.chat_id, message);
      }
      return;
    }

    // /disband — disband group chat (group only)
    if (event.message.chat_type === 'group' && text === DISBAND_TRIGGER_KEYWORD) {
      const chatId = event.message.chat_id;
      const groupInfo = await getGroupInfo(chatId);
      const groupName = groupInfo.name;
      const groupMembers = await getGroupMembers(chatId);

      await Promise.all(
        groupMembers.map(member =>
          sendDirectMessage(
          member.member_id,
          `Disbanded Group Chat: ${groupName}`
          )
        )
      );

      await sendGroupMessage(chatId, '👋 Disbanding this group. Goodbye!');
      await disbandGroupChat(chatId);
      await deleteLastActivity(chatId);
      return;
    }

    // Greeting keywords in Bot's DM - triggers a response and sends the /help list
    if (GREETINGS_TRIGGER_KEYWORD.includes(text?.toLowerCase())) {
      const greetingReturnMessage = `👋 Hello, <at user_id="${senderUserId}"></at>. Type /help to see what I can do [Delighted]`;
      await sendDirectMessage(senderUserId, greetingReturnMessage);
      return;
    }

    // /voiceform - sends user the client voice form link
    if (text === VOICEFORM_TRIGGER_KEYWORD) {
      await sendDirectMessage(senderUserId, `แบบสอบถามความต้องการเบื้องต้น Cogistics: [https://forms.gle/bTvJfixHg46EvpTC9](https://forms.gle/bTvJfixHg46EvpTC9)`);
      return;
    }

    // unrecognized command
    await sendDirectMessage(senderUserId, `❓ Unknown command. Type */help* to see available commands.`);

  } catch (error) {
    console.error('Bot error:', error.message);
    console.error('Stack:', error.stack);

    // notify bot owner if owner token is missing
    if (error.message.includes('Bot owner token not found')) {
      await sendAuthCard(BOT_OWNER_ID);
      return;
    }

    // other auth errors — send card to whoever triggered it
    if (error.message.includes('token') || error.message.includes('Unauthorized')) {
      await sendAuthCard(senderUserId);
      return;
    }
  }
}

export async function handleNewVoice(body) {
  try {

    //Define Variables
    const clientName = body?.clientName;
    const vDate = body?.vDate;
    const solution = body?.solution;
    const solutionExplain = body?.solutionExplain;
    const veggieProduct = body?.veggieProduct;
    const tplProduct = body?.tplProduct;
    const tplDestination = body?.tplDestination;
    const extraInfo = body?.extraInfo;

    if (solution === "Vegetable Industry Solutions")  {
      const members = [...new Set([...DEFAULT_VEGGIES_MEMBER_IDS, BOT_OWNER_ID, CEO_USER_ID])];
      const voice_info_message = 
      `📝 Voice Info:` + 
      '\n\nClient: ' + clientName + 
      '\nVoice Date: ' + vDate + 
      '\nกำลังตามหา: ' + veggieProduct +
      '\npain point: ' + solutionExplain +
      '\nextra info: ' + extraInfo;
      
      const chatId = await createGroupChat(`${clientName} - Veggie Solution`, members);
      await sendGroupMessage(chatId, `👋 Group created for *${clientName}*, service: Veggie Solution. \nTo create a supply knowledge sheet, type /SNsheet`);
      await sendDirectMessage(BOT_OWNER_ID, `✅ Done! Veggie Solution group created for *${clientName}*.`);
      await sendGroupMessage(chatId, voice_info_message);
      return;
    } else {
      const members = [...new Set([...DEFAULT_3PL_MEMBER_IDS, BOT_OWNER_ID, CEO_USER_ID])];
      const voice_info_message = 
      `📝 Voice Info:` + 
      '\n\nClient: ' + clientName + 
      '\nVoice Date: ' + vDate + 
      '\nสินค้า: ' + tplProduct +
      '\nจัดส่งไปที่: ' + tplDestination +
      '\npain point: ' + solutionExplain +
      '\nextra info: ' + extraInfo;
      
      const chatId = await createGroupChat(`${clientName} - 3PL`, members);
      await sendGroupMessage(chatId, `👋 Group created for *${clientName}*, service: 3PL.`);
      await sendDirectMessage(BOT_OWNER_ID, `✅ Done! 3PL group created for *${clientName}*.`);
      await sendGroupMessage(chatId, voice_info_message);
      return;
    }

  } catch (error) {
    console.error('Bot error:', error.message);
    console.error('Stack:', error.stack);

    // notify bot owner if owner token is missing
    if (error.message.includes('Bot owner token not found')) {
      await sendAuthCard(BOT_OWNER_ID);
      return;
    }
  }
}