import { sendDirectMessage } from "./lark.js";

const userId = process.env.LARK_USER_ID;

async function main() {
    try {
        await sendDirectMessage(userId, '<b>Hello from my first Node.js automation! Keep going [boss](https://www.cogistics.co.th/)!</b>');
    } catch (error) {
        console.error('Something went wrong: ', error.message);
    }
}

main();