import 'dotenv/config';
import express from 'express';
import { handleEvent } from './bot.js';
import { exchangeCodeForToken } from './lark.js';

const app = express();
app.use(express.json());

// Step 1 — visit this URL in browser to start OAuth login
app.get('/oauth/start', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.LARK_APP_ID,
    redirect_uri: `${process.env.APP_BASE_URL}/oauth/callback`,
    scope: 'drive:drive drive:file offline_access',
    state: 'random_string_for_security',
  });

  const authUrl = `https://accounts.larksuite.com/open-apis/authen/v1/authorize?${params}`;
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Step 2 — Lark redirects here after user approves
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const tokens = await exchangeCodeForToken(code);

    // show tokens in browser so you can copy them to .env
    res.send(`
      <h2>Success! Copy these to your .env file:</h2>
      <p><b>LARK_USER_ACCESS_TOKEN=</b>${tokens.access_token}</p>
      <p><b>LARK_REFRESH_TOKEN=</b>${tokens.refresh_token}</p>
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

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});