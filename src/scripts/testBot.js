import dotenv from 'dotenv';
dotenv.config();

import { Bot } from 'grammy';

async function testBot() {
  console.log('Testing Telegram Bot Token...');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const bot = new Bot(token);

  const me = await bot.api.getMe();
  console.log('✅ Telegram Bot authenticated successfully!');
  console.log(`🤖 ID: ${me.id}`);
  console.log(`🤖 Name: ${me.first_name}`);
  console.log(`🤖 Username: @${me.username}`);
  console.log(`🤖 Can join groups: ${me.can_join_groups}`);
  console.log(`🤖 Can read group messages: ${me.can_read_all_group_messages}`);
}

testBot().catch((err) => {
  console.error('❌ Bot Test Failed:', err.message);
  process.exit(1);
});
