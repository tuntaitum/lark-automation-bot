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
  if (!timestamp || timestamp === '-') return 'N/A';
  const date = new Date(Number(timestamp));
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-GB', {
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

  console.log('Raw task fields sample:', JSON.stringify(taskRecords[0]?.fields, null, 2));
  console.log('Raw story fields sample:', JSON.stringify(storyRecords[0]?.fields, null, 2));

  return { taskRecords, storyRecords };
}

export function formatStoryMessage(clientName, taskRecords, storyRecords) {
  const lines = [];

  // filter out placeholder records where Tasks field is empty
  const realTaskRecords = taskRecords.filter(record => {
    const task = extractFieldValue(record.fields['Tasks']);
    return task && task !== '-';
  });

  // filter out placeholder records where Content field is empty
  const realStoryRecords = storyRecords.filter(record => {
    const content = extractFieldValue(record.fields['Content']);
    return content && content !== '-';
  });

  // tasks
  lines.push(`📋 *Tasks — ${clientName}*`);
  lines.push('─────────────────');

  if (realTaskRecords.length === 0) {
    lines.push('N/A');
  } else {
    const grouped = {};

    for (const record of realTaskRecords) {
      const fields = record.fields;
      const voiceDate = extractFieldValue(fields['Product Voice Date: Date']);
      const task = extractFieldValue(fields['Tasks']);
      const status = extractFieldValue(fields['Status']);
      const assignedDate = formatTimestamp(extractFieldValue(fields['Assigned Date']));

      if (!grouped[voiceDate]) grouped[voiceDate] = [];
      grouped[voiceDate].push({ task, status, assignedDate });
    }

    for (const [voiceDate, tasks] of Object.entries(grouped)) {
      lines.push(`\n🗓 *${voiceDate}*`);
      for (const t of tasks) {
        lines.push(`• ${t.task} | ${t.status} | ${t.assignedDate}`);
      }
    }
  }

  // story
  lines.push(`\n📖 *Story — ${clientName}*`);
  lines.push('─────────────────');

  if (realStoryRecords.length === 0) {
    lines.push('N/A');
  } else {
    for (const record of realStoryRecords) {
      const fields = record.fields;
      const content = extractFieldValue(fields['Content']);
      const date = formatTimestamp(extractFieldValue(fields['Date']));
      lines.push(`• ${content} — ${date}`);
    }
  }

  return lines.join('\n');
}