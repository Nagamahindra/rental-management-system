# Rental Management System

A responsive rental web application for cars and equipment. The frontend uses HTML, CSS, and vanilla JavaScript. The backend uses Node.js, Express, and SQLite.

## Features

- Browse rental items with images and daily rates
- Search by item name or description
- Filter by category and today's availability
- Rental form with inclusive date and price calculation
- Server-side validation and overlapping-booking prevention
- Admin view with customer details and booking totals
- SQLite database persists data after restarting the app

## Requirements

- Node.js 20 or newer recommended
- npm

## Run locally

1. Extract the project ZIP.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Optional: copy `.env.example` to `.env` and adjust `PORT`.
5. Start the app:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000`.

For development with automatic server restarts, use `npm run dev`.

## Project structure

```text
rental-management-system/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── data/                  # created automatically; SQLite database
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## API endpoints

- `GET /api/health` — server health check
- `GET /api/items` — rental catalog and today's availability
- `GET /api/rentals` — all rental records
- `POST /api/rentals` — create a rental

Example POST body:

```json
{
  "itemId": 1,
  "customerName": "Alex Smith",
  "email": "alex@example.com",
  "phone": "+1 555 0100",
  "startDate": "2026-11-01",
  "endDate": "2026-11-03"
}
```

Dates are charged inclusively: a booking from November 1 through November 3 is three days.

## Important production notes

- The Admin / Rentals page is not password-protected in this demo. Add authentication and role-based authorization before exposing admin records publicly.
- Add CSRF/rate limiting and stronger validation before public deployment.
- Store the `data/` directory on persistent storage when deploying; ephemeral hosting can erase local SQLite data.
- Item availability on the catalog indicates whether an item is booked today. The server checks the requested date range before accepting a booking.
- Demo prices are shown in USD. Change the currency formatter and seeded prices if you want to use INR.
