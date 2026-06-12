import { refreshUserToken } from './auth.js';
import { getUserTokens } from '../tokenStore.js';

const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

export async function createTask(taskInfo, userId) {
  const tokens = await getUserTokens(userId);
  if (!tokens?.access_token) {
    throw new Error('No user token found — please authenticate first');
  }
  const token = tokens.access_token;

  // tomorrow at end of day
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 0);
  const dueTimestamp = tomorrow.getTime().toString();

  const response = await fetch('https://open.larksuite.com/open-apis/task/v2/tasks?user_id_type=user_id', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: taskInfo,
      due: {
        timestamp: dueTimestamp,
        is_all_day: false,
      },
      members: [
        {
          id: userId,
          type: 'user',
          role: 'assignee',
        }
      ],
    }),
  });

  const data = await response.json();
  console.log('Create task response:', JSON.stringify(data, null, 2));

  // if token expired refresh and retry
  if (data.code === 99991677) {
    console.log('Token expired — refreshing...');
    const newToken = await refreshUserToken(userId);
    return await createTask(taskInfo, userId);
  }

  if (data.code !== 0) {
    throw new Error(`Failed to create task: ${data.msg}`);
  }

  return data.data?.task;
}