const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const router = express.Router();

/* REGISTER */
router.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  db.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [req.body.username, hash],
    err => {
      if (err) return res.status(500).send("User exists");
      res.send("Account created");
    }
  );
});

/* LOGIN */
router.post("/login", (req, res) => {
  db.query(
    "SELECT * FROM users WHERE username=?",
    [req.body.username],
    async (_, result) => {
      if (!result.length) return res.sendStatus(401);
      const ok = await bcrypt.compare(
        req.body.password,
        result[0].password
      );
      if (!ok) return res.sendStatus(401);
      res.json({ userId: result[0].id });
    }
  );
});

/* PROFILE */
router.get("/profile/:id", (req, res) => {
  db.query(
    `
    SELECT u.username, COUNT(m.id) movies
    FROM users u LEFT JOIN movies m
    ON u.id=m.user_id
    WHERE u.id=?
    `,
    [req.params.id],
    (_, r) => res.json(r[0])
  );
});

module.exports = router;
