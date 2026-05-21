import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const TOKEN_FILE = './tokens.json';

// load all tokens from file
async function loadTokens() {
  if (!existsSync(TOKEN_FILE)) return {};
  const raw = await readFile(TOKEN_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// save all tokens to file
async function saveTokens(tokens) {
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

// get a specific user's tokens
export async function getUserTokens(userId) {
  const tokens = await loadTokens();
  return tokens[userId] || null;
}

// save a specific user's tokens
export async function saveUserTokens(userId, accessToken, refreshToken) {
  const tokens = await loadTokens();
  tokens[userId] = {
    access_token: accessToken,
    refresh_token: refreshToken,
    saved_at: new Date().toISOString(),
  };
  await saveTokens(tokens);
  console.log(`Tokens saved for user: ${userId}`);
}