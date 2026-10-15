# Queueless MongoDB fix

This version stores the five main collections in MongoDB:

- `users` – student/staff/admin accounts
- `sessions` – login sessions and expiration
- `offices` – Registrar, Finance, and CSDL, with their services/requirements and open/closed state
- `tickets` – queue tickets and lifecycle (`waiting`, `serving`, `skipped`, `served`, `cancelled`)
- `feedbacks` – one rating/comment per served ticket

## Setup

1. Copy `.env.example` to `.env`.
2. Put your own MongoDB Atlas URI in `MONGODB_URI`.
3. Run `npm install`.
4. Run `npm run server` in one terminal.
5. Run `npm run dev` in another terminal.

The backend automatically creates/seeds the four office documents when it starts. Student registration creates a `users` document and a `sessions` document. Joining a queue creates a `tickets` document. Completing a service and submitting a review creates a `feedbacks` document.

Staff self-registration creates a `Pending` account; an admin must approve it before staff can sign in.
