import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getUserTokens(userId) {
  try {
    const tokens = await redis.get(`user:${userId}`);
    return tokens ? JSON.parse(tokens) : null;
  } catch (error) {
    console.error('Failed to get user tokens:', error.message);
    return null;
  }
}

export async function saveUserTokens(userId, accessToken, refreshToken) {
  try {
    await redis.set(`user:${userId}`, JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      saved_at: new Date().toISOString(),
    }));
    console.log(`Tokens saved for user: ${userId}`);
  } catch (error) {
    console.error('Failed to save user tokens:', error.message);
    throw error;
  }
}

export async function setLastActivity(chatId) {
  try {
    await redis.set(`lastActivity:${chatId}`, Date.now().toString());
  } catch (error) {
    console.error('Failed to set last activity:', error.message);
  }
}

export async function getLastActivity(chatId) {
  try {
    const value = await redis.get(`lastActivity:${chatId}`);
    return value ? parseInt(value) : null;
  } catch (error) {
    console.error('Failed to get last activity:', error.message);
    return null;
  }
}

export async function deleteLastActivity(chatId) {
  try {
    await redis.del(`lastActivity:${chatId}`);
  } catch (error) {
    console.error('Failed to delete last activity:', error.message);
  }
}

export async function untrackGroup(chatId) {
  try {
    await redis.set(`untracked:${chatId}`, '1');
    console.log(`Group untracked: ${chatId}`);
  } catch (error) {
    console.error('Failed to untrack group:', error.message);
  }
}

export async function trackGroup(chatId) {
  try {
    await redis.del(`untracked:${chatId}`);
    console.log(`Group tracked: ${chatId}`);
  } catch (error) {
    console.error('Failed to track group:', error.message);
  }
}

export async function isGroupUntracked(chatId) {
  try {
    const val = await redis.get(`untracked:${chatId}`);
    return val === '1';
  } catch (error) {
    console.error('Failed to check track status:', error.message);
    return false;
  }
}

export async function deleteUntracked(chatId) {
  try {
    await redis.del(`untracked:${chatId}`);
  } catch (error) {
    console.error('Failed to delete untracked key:', error.message);
  }
}