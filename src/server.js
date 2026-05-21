import 'dotenv/config';
import express from 'express';
import { handleEvent } from './bot.js';
import { exchangeCodeForToken } from './lark.js';
import { saveUserTokens } from './tokenStore.js';



const app = express();
app.use(express.json());

// Step 1 — visit this URL in browser to start OAuth login
app.get('/oauth/start', (req, res) => {
  const { userId } = req.query;

  const params = new URLSearchParams({
    client_id: process.env.LARK_APP_ID,
    redirect_uri: `${process.env.APP_BASE_URL}/oauth/callback`,
    scope: 'drive:drive drive:file offline_access',
    state: userId || 'unknown', // pass userId through OAuth flow
  });

  const authUrl = `https://accounts.larksuite.com/open-apis/authen/v1/authorize?${params}`;
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});