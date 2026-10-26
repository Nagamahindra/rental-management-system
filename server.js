import express from "express";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "rental-system.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price_per_day REAL NOT NULL CHECK(price_per_day >= 0),
    image TEXT NOT NULL,
    type TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    total_days INTEGER NOT NULL,
    total_cost REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );
`);

const seedItems = [
  [1, "Toyota Camry 2023", "Comfortable sedan, perfect for city driving and long trips.", 45, "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=900&q=80", "car"],
  [2, "Ford F-150", "Heavy-duty pickup truck for moving and hauling.", 75, "https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=900&q=80", "car"],
  [3, "Honda CR-V", "Spacious SUV with great fuel economy.", 60, "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=80", "car"],
  [4, "Professional DSLR Camera", "Professional camera kit for events, travel, and photography.", 35, "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80", "equipment"],
  [5, "Portable Generator", "Portable generator for work sites and outdoor events.", 25, "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=900&q=80", "equipment"],
  [6, "Power Drill Set", "Cordless drill set for DIY and professional projects.", 15, "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80", "equipment"]
];
const insertItem = db.prepare("INSERT OR IGNORE INTO items (id, name, description, price_per_day, image, type) VALUES (?, ?, ?, ?, ?, ?)");
const seedTransaction = db.transaction(() => seedItems.forEach(item => insertItem.run(...item)));
seedTransaction();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const allItems = db.prepare("SELECT * FROM items ORDER BY id");
const getItem = db.prepare("SELECT * FROM items WHERE id = ?");
const allRentals = db.prepare(`
  SELECT r.*, i.name AS item_name
  FROM rentals r JOIN items i ON i.id = r.item_id
  ORDER BY r.created_at DESC, r.id DESC
`);

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
function daysBetween(start, end) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}
function hasConflict(itemId, start, end) {
  return Boolean(db.prepare(`
    SELECT id FROM rentals
    WHERE item_id = ? AND NOT (end_date < ? OR start_date > ?)
    LIMIT 1
  `).get(itemId, start, end));
}

app.get("/api/items", (req, res) => {
  const items = allItems.all().map(item => ({
    ...item,
    available: !db.prepare(`
      SELECT id FROM rentals
      WHERE item_id = ? AND end_date >= date('now')
      LIMIT 1
    `).get(item.id)
  }));
  res.json(items);
});

app.get("/api/rentals", (req, res) => res.json(allRentals.all()));

app.post("/api/rentals", (req, res) => {
  const { itemId, customerName, email, phone, startDate, endDate } = req.body ?? {};
  const item = Number.isInteger(Number(itemId)) ? getItem.get(Number(itemId)) : null;

  if (!item) return res.status(400).json({ error: "Please select a valid item." });
  if (![customerName, email, phone].every(v => typeof v === "string" && v.trim())) {
    return res.status(400).json({ error: "Name, email, and phone are required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) {
    return res.status(400).json({ error: "Enter valid rental dates. The end date must be on or after the start date." });
  }
  const today = new Date();
  const todayText = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  if (startDate < todayText) return res.status(400).json({ error: "The rental start date cannot be in the past." });
  if (hasConflict(item.id, startDate, endDate)) {
    return res.status(409).json({ error: "This item is already booked for at least one of those dates. Please choose different dates." });
  }

  const totalDays = daysBetween(startDate, endDate);
  const totalCost = Number((totalDays * item.price_per_day).toFixed(2));
  const result = db.prepare(`
    INSERT INTO rentals (item_id, customer_name, email, phone, start_date, end_date, total_days, total_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(item.id, customerName.trim(), email.trim(), phone.trim(), startDate, endDate, totalDays, totalCost);

  res.status(201).json({
    message: "Rental confirmed successfully.",
    rental: db.prepare(`
      SELECT r.*, i.name AS item_name FROM rentals r
      JOIN items i ON i.id = r.item_id WHERE r.id = ?
    `).get(result.lastInsertRowid)
  });
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Rental Management System running at http://localhost:${port}`);
});