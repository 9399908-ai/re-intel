# Re-Intel.ai

**Community Platform for Real Estate Professionals**

Vetted member-only network with real-time chat, smart matching, and integrated events.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ ([download](https://nodejs.org))
- Git v2.5+ ([download](https://git-scm.com))
- PostgreSQL 14+ ([download](https://postgresql.org)) — Already installed? ✅

### Setup (30 minutes)

```bash
# 1. Clone this repo (when you push to GitHub)
git clone https://github.com/yourusername/re-intel.git
cd re-intel

# 2. Frontend setup
cd frontend
npm install
npm start
# Opens http://localhost:3000

# 3. Backend setup (new terminal window)
cd backend
npm install
npm run dev
# Runs on http://localhost:5000

# 4. Database setup (after backend running)
npx prisma migrate dev --name init
npx prisma studio  # View database at http://localhost:5555
```

---

## 📁 Project Structure

```
re-intel/
├── frontend/          React app
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   ├── hooks/
│   │   └── App.jsx
│   └── package.json
├── backend/           Node.js API
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── prisma/
│   ├── server.js
│   └── package.json
├── python/            Matching algorithm
├── docs/              Documentation
└── README.md
```

---

## 🛠 Tech Stack

- **Frontend:** React 18 + Tailwind CSS
- **Backend:** Node.js + Express
- **Real-time:** Socket.io
- **Database:** PostgreSQL + Prisma
- **Algorithm:** Python
- **Hosting:** Vercel (frontend) + Railway (backend)

---

## 📚 Documentation

- `SETUP_INSTRUCTIONS.md` — Detailed setup guide
- `BUILD_GUIDE.md` — Step-by-step development
- `DESIGN_SYSTEM.md` — UI/UX specifications
- `TECH_STACK.md` — Technology decisions

---

## 🎯 Development Status

- [x] Design system complete
- [x] Setup documentation complete
- [x] Starter code scaffolded
- [ ] Environment setup (Phase 1)
- [ ] Frontend components (Phase 2)
- [ ] Backend API (Phase 3)
- [ ] Database integration (Phase 4)

---

## 🔑 Environment Variables

Create `.env` files in `frontend/` and `backend/`:

**backend/.env:**
```
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:joely@localhost:5432/reintel_dev
JWT_SECRET=your-secret-key-change-in-production
```

**frontend/.env:**
```
REACT_APP_API_URL=http://localhost:5000
```

---

## 📝 Commands

**Frontend:**
```bash
npm start       # Dev server
npm run build   # Production build
npm test        # Tests
```

**Backend:**
```bash
npm run dev     # Dev server with auto-reload
npm start       # Production server
npx prisma studio  # View database
```

**Database:**
```bash
npx prisma migrate dev --name <name>  # Create migration
npx prisma generate                    # Generate client
```

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Kill process: `lsof -i :3000` or change .env |
| npm not found | Reinstall Node.js |
| Database connection error | Check PostgreSQL running, verify .env DATABASE_URL |
| Module not found | Delete node_modules, run `npm install` again |

---

## 📞 Support

See `BUILD_GUIDE.md` for detailed development instructions.

---

**Built with ❤️ for real estate professionals**
