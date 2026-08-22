# 👑 Mint Father - USDT & USDC Mint & Burn Sentinel Bot

A high-performance real-time Ethereum blockchain sentinel tracking **USDT (Tether)** and **USDC (Circle)** Mints, Burns, and Treasury flows with **Telegram Bot alerts** and a live **Web Dashboard**.

---

## 🚀 Quick Deployment Guide (২৪/৭ লাইভ চালানোর উপায়)

### Option 1: Render.com (Recommended & Free/Easy)
1. **GitHub-এ প্রজেক্ট আপলোড করুন:**
   - আপনার GitHub অ্যাকাউন্টে একটি নতুন Repository বানিয়ে এই প্রজেক্ট পুশ করুন।
2. **Render.com-এ যান:**
   - **New +** -> **Web Service** সিলেক্ট করুন।
   - আপনার GitHub Repository টি কানেক্ট করুন।
3. **সেটিংস কনফিগার করুন:**
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Environment Variables (Environment ট্যাবে গিয়ে যোগ করুন):**
   ```env
   MONGODB_URI=mongodb+srv://dev-shop:K6DH5CcOUm1rH5AR@cluster0.wss65wz.mongodb.net/mintBurn?retryWrites=true&w=majority&appName=Cluster0
   TELEGRAM_BOT_TOKEN=8628096848:AAH6XY9lFAINWAFNvUwLIhjtcXjsDCJeASo
   ALCHEMY_HTTP_URL=https://eth-mainnet.g.alchemy.com/v2/alch_FG2JxXKblTIBJKBBaGUi_
   ALCHEMY_WSS_URL=wss://eth-mainnet.g.alchemy.com/v2/alch_FG2JxXKblTIBJKBBaGUi_
   DEFAULT_MIN_THRESHOLD_USD=0
   PORT=3000
   ```
5. **Deploy বাটনে ক্লিক করুন!** ব্যস, আপনার বট ও ওয়েব ড্যাশবোর্ড ২৪/৭ দিনরাত সারাক্ষণ লাইভ চলবে।

---

### Option 2: Railway.app
1. [Railway.app](https://railway.app)-এ গিয়ে **New Project** -> **Deploy from GitHub repo** সিলেক্ট করুন।
2. **Variables** ট্যাবে গিয়ে উপরের `.env` ভ্যালুগুলো পেস্ট করুন।
3. অটোমেটিক ডেপ্লয় হয়ে যাবে!

---

### Option 3: VPS Server (Ubuntu / Debian / Linux)
```bash
git clone <your-repo-url>
cd "mint father"
npm install
npm install -g pm2
pm2 start src/server.js --name "mint-father"
pm2 save
pm2 startup
```

---

## 🤖 Telegram Bot Commands

- `/start` - Start bot & show interactive mobile buttons
- `/status` - Live health check & block sync status
- `/stats` - 24-Hour Mint vs Burn summary
- `/recent` - Show recent 5 transactions
- `/threshold <amount>` - Change alert threshold (e.g. `/threshold 500000`)
- `/pause` / `/resume` - Toggle notifications
- `/test` - Send a sample alert
