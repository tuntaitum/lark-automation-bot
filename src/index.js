import { sendMessage } from "./lark.js";

const userId = process.env.LARK_USER_ID;

async function main() {
    try {
        await sendMessage(userId, 'Hello from my first Node.js automation! Keep going bro!');
    } catch (error) {
        console.error('Something went wrong: ', error.message);
    }
}

main();