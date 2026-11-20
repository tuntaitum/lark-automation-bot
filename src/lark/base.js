import { getTenantAccessToken, refreshUserToken } from './auth.js';
import { getUserTokens } from '../tokenStore.js';

const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
const BASE_APP_TOKEN = process.env.STORY_BASE_APP_TOKEN;
const TASK_TABLE_ID = process.env.STORY_TASK_TABLE_ID;
const STORY_TABLE_ID = process.env.STORY_TABLE_ID;
const SUPPLY_BASE_APP_TOKEN = process.env.SUPPLY_BASE_APP_TOKEN;
const SUPPLY_ENQUIRY_TABLE_ID = process.env.SUPPLY_ENQUIRY_TABLE_ID;

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
  console.log(`Table ${tableId} fetched: ${data.data?.items?.length || 0} records`);

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
        lines.push(`• ${t.status} | ${t.assignedDate} | ${t.task}`);
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
      lines.push(`• ${date} - ${content}`);
    }
  }

  return lines.join('\n'); 
}

// Must match your Base column names exactly
const SUPPLY_ENQUIRY_FIELD_NAMES = {
  product: 'Product / Client / Topic',
  itemCode: 'Item Code',
  request: 'My Request',
  assignedTo: 'Assigned To',
  dueDate: 'Due Date',
};

export async function createSupplyRequestRecord(values) {
  const token = await getTenantAccessToken();

  const fields = {
    [SUPPLY_ENQUIRY_FIELD_NAMES.product]: values.product,
    // If "Assigned To" is a Person field, this must be [{ id: 'their_user_id' }]
    // and the URL needs ?user_id_type=user_id. As written it assumes a text field.
    [SUPPLY_ENQUIRY_FIELD_NAMES.assignedTo]: values.assignedTo,
  };
  if (values.itemCode) fields[SUPPLY_ENQUIRY_FIELD_NAMES.itemCode] = values.itemCode;
  if (values.request) fields[SUPPLY_ENQUIRY_FIELD_NAMES.request] = values.request;
  if (values.dueDate) {
    // Base date fields want a millisecond timestamp
    fields[SUPPLY_ENQUIRY_FIELD_NAMES.dueDate] = new Date(`${values.dueDate}T00:00:00+07:00`).getTime();
  }

  const response = await fetch(
    `https://open.larksuite.com/open-apis/bitable/v1/apps/${SUPPLY_BASE_APP_TOKEN}/tables/${SUPPLY_ENQUIRY_TABLE_ID}/records`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }
  );

  const data = await response.json();
  if (data.code !== 0) throw new Error(`Failed to create supply request record: ${data.msg}`);
  return data.data?.record?.record_id;
}

export async function sendSupplyWorkflowWebhook(payload) {
  const url = process.env.SUPPLY_WORKFLOW_WEBHOOK_URL;
  if (!url) {
    console.log('SUPPLY_WORKFLOW_WEBHOOK_URL not set, skipping workflow webhook');
    return;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Workflow webhook failed: HTTP ${response.status}`);
}