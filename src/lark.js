import 'dotenv/config';

const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;

export async function getAccessToken() {
    const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            app_id: APP_ID,
            app_secret: APP_SECRET,
        }),
    });

    const data = await response.json();

    if (data.code !== 0) {
        throw new Error(`Failed to get token: ${data.msg}`);
    }

    return data.tenant_access_token;
}

export async function sendMessage(userId, message) {
    const token = await getAccessToken();

    const response = await fetch('https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=user_id', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            receive_id: userId,
            msg_type: 'text',
            content: JSON.stringify({ text: message }),
        }),
    });

    const data = await response.json();

    if (data.code !== 0) {
    throw new Error(`Failed to send message: ${data.msg}`);
  }

  console.log('Message sent successfully!');
  return data;
}