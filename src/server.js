import 'dotenv/config';
import express from 'express';
import { handleEvent, handleNewVoice } from './bot.js';
import { exchangeCodeForToken, refreshUserToken } from './lark/auth.js';
import { saveUserTokens, getLastActivity, setLastActivity, isGroupUntracked } from './tokenStore.js';
import { listClientChats, getGroupMembers, sendGroupMessage } from './lark/messenger.js';


const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

const app = express();
app.use(express.json());

// Step 1 — visit this URL in browser to start OAuth login
app.get('/oauth/start', (req, res) => {
  const { userId } = req.query;

  const params = new URLSearchParams({
    client_id: process.env.LARK_APP_ID,
    redirect_uri: `${process.env.APP_BASE_URL}/oauth/callback`,
    scope: 'drive:drive drive:file offline_access task:task:write',
    state: userId || 'unknown', // pass userId through OAuth flow
  });

  const authUrl = `https://accounts.larksuite.com/open-apis/authen/v1/authorize?${params}`;
  console.log('Auth URL:', authUrl);
  res.redirect(authUrl);
});

// Step 2 — Lark redirects here after user approves
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  // state contains the userId who triggered the OAuth
  const userId = state;

  try {
    const tokens = await exchangeCodeForToken(code);
    await saveUserTokens(userId, tokens.access_token, tokens.refresh_token);

    res.send(`
      <h2>✅ Success!</h2>
      <p>You're now authenticated. Go back to Lark and try your command again.</p>
    `);
  } catch (error) {
    res.send(`Error: ${error.message}`);
  }
});

// webhook for bot events
app.post('/webhook', async (req, res) => {
  const body = req.body;
  console.log('Incoming event:', JSON.stringify(body, null, 2));

  if (body.challenge) {
    return res.json({ challenge: body.challenge });
  }

  res.status(200).json({ success: true });
  await handleEvent(body);
});

// webhook for new voice from client voice tracking base
app.post('/voice-webhook', async (req, res) => {
  const body = req.body.body; //clientName, vDate, solution, solutionExplain, veggieProduct, tplProduct, tplDestination, extraInfo 

  res.status(200).json({ success: true });

  await handleNewVoice(body);
});

app.get('/ping', (req, res) => {
  res.json({ status: 'alive' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function checkGroupActivity() {
  console.log('Running daily activity check...');

  try {
    const { veggiChats, tplChats } = await listClientChats();
    const allChats = [...veggiChats, ...tplChats];
    const now = Date.now();
    const THRESHOLD = 72 * 60 * 60 * 1000; // 72 hours in ms

    for (const chat of allChats) {
      // skip untracked groups
      const untracked = await isGroupUntracked(chat.chat_id);
      if (untracked) {
        console.log(`Skipping untracked group: ${chat.name}`);
        continue;
      }

      const lastActivity = await getLastActivity(chat.chat_id);
      const inactive = !lastActivity || (now - lastActivity) > THRESHOLD;

      if (inactive) {
        console.log(`Inactive group detected: ${chat.name}`);

        // get all members to tag them
        const members = await getGroupMembers(chat.chat_id);
        console.log('Members:', JSON.stringify(members, null, 2));
        await sendGroupMessage(
          chat.chat_id,
          `<at user_id="all">Everyone</at>\n\n⏰ No activity in over 72 hours. Is there any progress with this client, or should this group be disbanded?\n\nType /disband to disband this group.`
        );

        // reset timer after bot pings
        await setLastActivity(chat.chat_id);
      }
    }

    console.log('Activity check complete.');
  } catch (error) {
    console.error('Activity check error:', error.message);
  }
}

async function keepOwnerTokenAlive() {
  try {
    await refreshUserToken(BOT_OWNER_ID);
    console.log('Owner token refreshed successfully.');
  } catch (error) {
    console.error('Error refreshing owner token:', error.message);
  }
}

function scheduleActivityCheck() {
  const now = new Date();
  const next9am = new Date();
  
  // set to 2am UTC = 9am Bangkok (UTC+7)
  next9am.setUTCHours(2, 0, 0, 0);

  // if 2am UTC already passed today, schedule for tomorrow
  if (now >= next9am) {
    next9am.setUTCDate(next9am.getUTCDate() + 1);
  }

  const msUntil9am = next9am - now;
  const hoursUntil = (msUntil9am / 1000 / 60 / 60).toFixed(1);
  console.log(`Activity check scheduled in ${hoursUntil} hours (next 9am Bangkok time)`);

  setTimeout(() => {
    checkGroupActivity();
    // repeat every 24 hours after first run
    setInterval(checkGroupActivity, 24 * 60 * 60 * 1000);
  }, msUntil9am);
}

scheduleActivityCheck();

// run once on startup, then every 3 days
keepOwnerTokenAlive();
setInterval(keepOwnerTokenAlive, 3 * 24 * 60 * 60 * 1000);