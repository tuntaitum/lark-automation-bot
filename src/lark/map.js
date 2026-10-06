import { getTenantAccessToken } from './auth.js';

const BASE_APP_TOKEN = process.env.MAP_BASE_APP_TOKEN;
const GROUPS_TABLE_ID = process.env.MAP_GROUPS_TABLE_ID;
const PINS_TABLE_ID = process.env.MAP_PINS_TABLE_ID;

// Same field-unwrapping idea as extractFieldValue() in base.js, generalized
// for text/select/checkbox/number fields.
function text(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field)) {
    return field.map((f) => (typeof f === 'string' ? f : f.text || f.value || '')).join('');
  }
  if (typeof field === 'object') return field.text || field.value || '';
  return String(field);
}

async function listAllRecords(tableId, viewId) {
  const token = await getTenantAccessToken();
  let records = [];
  let pageToken = '';

  do {
    const url = new URL(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records`
    );
    url.searchParams.set('page_size', '100');
    if (viewId) url.searchParams.set('view_id', viewId);
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`Failed to fetch records from table ${tableId}: ${data.msg}`);
    }

    records = records.concat(data.data?.items || []);
    pageToken = data.data?.has_more ? data.data.page_token : '';
  } while (pageToken);

  return records;
}

export async function getMapData() {
  const [groupRecords, pinRecords] = await Promise.all([
    // Passing a view_id is what makes manual drag-order in the Lark UI
    // actually reflected here — without it, the API's row order has no
    // defined relationship to what you see when dragging rows in Base.
    listAllRecords(GROUPS_TABLE_ID, process.env.MAP_GROUPS_VIEW_ID),
    listAllRecords(PINS_TABLE_ID),
  ]);

  const allGroups = groupRecords
    .map((r, index) => ({
      id: text(r.fields['Group ID']),
      label: text(r.fields['Label']) || text(r.fields['Group ID']),
      color: text(r.fields['Color']) || '#3388ff',
      active: r.fields['Active By Default'] === true,
      order: index,
      popupStyle: text(r.fields['Popup Style']) || 'Label Only',
      // Single select, not checkbox — see note in SETUP.md on why. Blank or
      // "Yes" both mean shown; only an explicit "No" hides the group.
      showOnMap: text(r.fields['Show On Map']) !== 'No',
    }))
    .filter((g) => g.id);

  const hiddenGroupIds = new Set(allGroups.filter((g) => !g.showOnMap).map((g) => g.id));
  const groups = allGroups
    .filter((g) => g.showOnMap)
    .map(({ showOnMap, ...g }) => g); // drop the internal-only flag from the response

  const pins = pinRecords
    // Subrecords (e.g. crossdock outlets nested under a DC) share the same
    // table and column headers as normal pins, so they'd otherwise show up
    // as extra overlapping labels at the same coordinates. Type: "Cross
    // Dock" marks these explicitly — relying on "the parent record always
    // comes first in the API response" isn't something Lark documents or
    // guarantees, so it's not safe to depend on silently.
    .filter((r) => text(r.fields['Type']) !== 'Cross Dock')
    .map((r) => ({
      name: text(r.fields['Name']),
      lat: Number(r.fields['Latitude']),
      lng: Number(r.fields['Longitude']),
      note: text(r.fields['Note']),
      group: text(r.fields['Group']),
    }))
    .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .filter((p) => !hiddenGroupIds.has(p.group)); // hide pins that belong to a hidden group

  return { groups, pins };
}
