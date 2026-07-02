# Re-Intel.ai — Quick Start Guide

**You have PostgreSQL installed. Here's what to do next.**

---

## Step 1: Download All Files (2 minutes)

Download the entire `re-intel-scaffold` folder structure to your computer:

```
re-intel/
├── frontend/
├── backend/
├── python/
├── docs/
├── README.md
├── .gitignore
└── QUICK_START.md (this file)
```

Save it somewhere easy to find (e.g., Desktop or Documents).

---

## Step 2: Open PowerShell

1. Press **Windows Key + R**
2. Type: `powershell`
3. Press Enter

Navigate to your project folder:
```powershell
cd Desktop/re-intel
```
(adjust path if you saved it elsewhere)

---

## Step 3: Create Database

Run this command:
```powershell
createdb reintel_dev
```

You should see no error. If it says "already exists", that's fine.

---

## Step 4: Frontend Setup (5 minutes)

Open PowerShell and run:

```powershell
cd frontend
npm install
```

This downloads all the dependencies (about 500 packages). Wait until you see `added XXX packages`.

---

## Step 5: Backend Setup (5 minutes)

**Open a NEW PowerShell window** (keep the frontend one open).

```powershell
cd re-intel/backend
npm install
```

Again, wait for `added XXX packages`.

---

## Step 6: Create Backend .env File

In the `backend` folder, create a file named `.env` (NOT `.env.example`):

**backend/.env:**
```
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:joely@localhost:5432/reintel_dev
JWT_SECRET=dev-secret-key-change-in-production
FRONTEND_URL=http://localhost:3000
```

---

## Step 7: Create Frontend .env File

In the `frontend` folder, create a file named `.env`:

**frontend/.env:**
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

---

## Step 8: Start Everything

**Terminal 1 - Frontend:**
```powershell
cd re-intel/frontend
npm start
```

Wait for: `Compiled successfully!` and browser opens at `http://localhost:3000`

---

**Terminal 2 - Backend:**
```powershell
cd re-intel/backend
npm run dev
```

Wait for: `🚀 Backend running on http://localhost:5000`

---

## Step 9: Test It Works

1. Open `http://localhost:3000` in your browser
2. You should see the Re-Intel.ai app with:
   - Left sidebar with channels
   - Chat area in the middle
   - Navigation buttons for Chat, Calendar, Admin

3. Type a message and send it
4. You should see it appear in the chat instantly (real-time!)

---

## Step 10: Database Setup

In Terminal 2 (backend), **while it's running**, open a **new PowerShell window**:

```powershell
cd re-intel/backend
npx prisma migrate dev --name init
```

When asked for the migration name, just press Enter (it'll use "init").

This creates all the database tables.

---

## Step 11: Verify Database

Still in Terminal 3, run:
```powershell
npx prisma studio
```

This opens `http://localhost:5555` where you can view your database visually.

---

## You Did It! 🎉

You now have:
- ✅ Frontend running on `http://localhost:3000`
- ✅ Backend running on `http://localhost:5000`
- ✅ Database running on PostgreSQL
- ✅ Real-time chat working (Socket.io)
- ✅ Admin panel accessible

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm not found` | Node.js didn't install. Reinstall from nodejs.org and restart PowerShell |
| `Port 3000 already in use` | Another app is using it. Kill process: `netstat -ano \| findstr 3000` or restart computer |
| `Database connection failed` | Check `.env` DATABASE_URL has correct password. Should be: `postgresql://postgres:joely@localhost:5432/reintel_dev` |
| `Socket.io not connecting` | Restart both frontend and backend |

---

## Next Steps

Once everything is running:

1. **Commit to GitHub:**
   ```powershell
   git init
   git add .
   git commit -m "Initial Re-Intel.ai scaffold"
   ```

2. **Create GitHub repo:**
   - Go to https://github.com/new
   - Create repo named `re-intel`
   - Follow GitHub's instructions to push

3. **Continue development:**
   - See BUILD_GUIDE.md for next phases
   - Edit files in frontend/src/ and backend/ — changes reload automatically
   - Add features one at a time

---

## Terminal Commands Reference

Keep these Terminal windows open while developing:

**Frontend (keep running):**
```
cd frontend
npm start
```

**Backend (keep running):**
```
cd backend
npm run dev
```

**Database viewer (separate window, when needed):**
```
cd backend
npx prisma studio
```

**Git (when needed):**
```
git add .
git commit -m "your message"
git push origin main
```

---

**You're ready to build! 🚀**

Message me when you hit any issues or have questions.
