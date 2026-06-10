import { getTenantAccessToken, refreshUserToken } from './auth.js';
import { getUserTokens } from '../tokenStore.js';

const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
const BASE_APP_TOKEN = process.env.STORY_BASE_APP_TOKEN;
const TASK_TABLE_ID = process.env.STORY_TASK_TABLE_ID;
const STORY_TABLE_ID = process.env.STORY_TABLE_ID;

function extractFieldValue(field) {
  if (!field) return '-';
  
  // array of text objects e.g. [{ text: "value" }]
  if (Array.isArray(field)) {
    return field.map(f => f.text || f.value || f).join(', ');
  }
  
  // single object e.g. { value: "value" }
  if (typeof field === 'object') {
    return field.value || field.text || JSON.stringify(field);
  }
  
  return String(field);
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '-';
  // Lark timestamps are in milliseconds
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

async function getBaseToken() {
  // try tenant token first
  try {
    return await getTenantAccessToken();
  } catch {
    // fall back to user token
    const ownerTokens = await getUserTokens(BOT_OWNER_ID);
    if (!ownerTokens?.access_token) {
      throw new Error('No valid token available');
    }
    return ownerTokens.access_token;
  }
}

async function fetchTableRecords(tableId, clientName) {
  const token = await getBaseToken();

  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records/search`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: {
        conjunction: 'and',
        conditions: [
          {
            field_name: 'Client',
            operator: 'is',
            value: [clientName],
          }
        ]
      },
      page_size: 100,
    }),
  });

  const data = await response.json();
  console.log(`Table ${tableId} response:`, JSON.stringify(data, null, 2));

  if (data.code !== 0) {
    throw new Error(`Failed to fetch records: ${data.msg}`);
  }

  return data.data?.items || [];
}

export async function getClientStory(clientName) {
  const [taskRecords, storyRecords] = await Promise.all([
    fetchTableRecords(TASK_TABLE_ID, clientName),
    fetchTableRecords(STORY_TABLE_ID, clientName),
  ]);

  return { taskRecords, storyRecords };
}

export function formatStoryMessage(clientName, taskRecords, storyRecords) {
  const lines = [];

  lines.push(`📋 *Tasks — ${clientName}*`);
  lines.push('─────────────────');

  if (taskRecords.length === 0) {
    lines.push('No tasks found.');
  } else {
    const grouped = {};

    for (const record of taskRecords) {
      const fields = record.fields;
      const voiceDate = formatTimestamp(extractFieldValue(fields['Product Voice Date: Date']));
      const task = extractFieldValue(fields['Tasks']);
      const status = extractFieldValue(fields['Status']);
      const assignedDate = formatTimestamp(extractFieldValue(fields['Assigned Date']));

      if (!grouped[voiceDate]) grouped[voiceDate] = [];
      grouped[voiceDate].push({ task, status, assignedDate });
    }

    for (const [voiceDate, tasks] of Object.entries(grouped)) {
      lines.push(`\n🗓 *Voice: ${voiceDate}*`);
      for (const t of tasks) {
        lines.push(`• ${t.task} | ${t.status} | ${t.assignedDate}`);
      }
    }
  }

  lines.push(`\n📖 *Story — ${clientName}*`);
  lines.push('─────────────────');

  if (storyRecords.length === 0) {
    lines.push('No story records found.');
  } else {
    for (const record of storyRecords) {
      const fields = record.fields;
      const content = extractFieldValue(fields['Content']);
      const date = formatTimestamp(extractFieldValue(fields['Date']));
      lines.push(`• ${content} — ${date}`);
    }
  }

  return lines.join('\n');
}