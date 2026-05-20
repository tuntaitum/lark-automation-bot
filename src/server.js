import 'dotenv/config';
import express from 'express';
import { handleEvent } from './bot.js';

const app = express();
app.use(express.json());

// Lark sends all events here
app.post('/webhook', async (req, res) => {

  const body = req.body;
  console.log('Incoming event:', JSON.stringify(body, null, 2));

  // Lark first sends a verification challenge when you set up the webhook
  // your server must echo it back immediately
  if (body.challenge) {
    return res.json({ challenge: body.challenge });
  }

  // acknowledge immediately — Lark expects a response within 3 seconds
  res.status(200).json({ success: true });

  // handle the event after responding
  await handleEvent(body);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});