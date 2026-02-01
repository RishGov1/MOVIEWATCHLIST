const express = require("express");
const db = require("../db");
const router = express.Router();

/* ADD MOVIE (DUPLICATE SAFE) */
router.post("/add", (req, res) => {
  const { title, genre, release_year, user_id, tmdb_id } = req.body;

  db.query(
    `
    INSERT INTO movies (title, genre, release_year, user_id, tmdb_id)
    VALUES (?, ?, ?, ?, ?)
    `,
    [title, genre, release_year, user_id, tmdb_id],
    err => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).send("Movie already in watchlist");
        }
        console.error(err);
        return res.sendStatus(500);
      }
      res.send("Movie added");
    }
  );
});


/* BULK ADD (DEMO + BULK WORKING) */
router.post("/bulk-add", (req, res) => {
  const movies = req.body;
  if (!Array.isArray(movies)) return res.sendStatus(400);

  const values = movies.map(m => [
    m.title,
    m.genre,
    m.release_year,
    m.user_id
  ]);

  db.query(
    "INSERT INTO movies (title, genre, release_year, user_id) VALUES ?",
    [values],
    err => {
      if (err) {
        console.error(err);
        return res.sendStatus(500);
      }
      res.send("Bulk added");
    }
  );
});

/* GET USER MOVIES + USER RATING */
router.get("/:userId", (req, res) => {
  db.query(
    `
    SELECT m.*, r.rating AS user_rating
    FROM movies m
    LEFT JOIN ratings r
      ON m.id=r.movie_id AND r.user_id=?
    WHERE m.user_id=?
    `,
    [req.params.userId, req.params.userId],
    (_, r) => res.json(r)
  );
});

/* RATE MOVIE (UPDATE SAFE) */
router.post("/rate", (req, res) => {
  const { movie_id, rating, user_id } = req.body;
  db.query(
    `
    INSERT INTO ratings (movie_id, user_id, rating)
    VALUES (?,?,?)
    ON DUPLICATE KEY UPDATE rating=?
    `,
    [movie_id, user_id, rating, rating],
    () => res.send("Rated")
  );
});

/* SIMILAR MOVIES */
router.get("/similar/:id", (req, res) => {
  db.query(
    `
    SELECT genre FROM movies WHERE id=?
    `,
    [req.params.id],
    (_, g) => {
      if (!g.length) return res.json([]);
      db.query(
        `
        SELECT title FROM movies
        WHERE genre=? AND id!=?
        LIMIT 5
        `,
        [g[0].genre, req.params.id],
        (_, r) => res.json(r)
      );
    }
  );
});

/* HYBRID RECOMMENDATIONS */
router.get("/hybrid/:userId", (req, res) => {
  db.query(
    `
    SELECT title FROM movies
    WHERE user_id!=?
    LIMIT 5
    `,
    [req.params.userId],
    (_, r) => res.json(r)
  );
});
/* GET DISTINCT GENRES */
router.get("/genres/all", (req, res) => {
  db.query(
    "SELECT genre FROM movies",
    (_, rows) => {
      const set = new Set();
      rows.forEach(r => {
        if (r.genre) {
          r.genre.split(",").forEach(g => set.add(g.trim()));
        }
      });
      res.json([...set]);
    }
  );
});

/* TOGGLE WATCHED STATUS */
router.put("/watch/:movieId", (req, res) => {
  const { watched } = req.body;

  db.query(
    "UPDATE movies SET watched=? WHERE id=?",
    [watched, req.params.movieId],
    err => {
      if (err) {
        console.error(err);
        return res.sendStatus(500);
      }
      res.send("Watch status updated");
    }
  );
});


/* DELETE MOVIE (OWNER ONLY) */
router.delete("/:id", (req, res) => {
  const userId = req.query.user_id || req.body.user_id;
  if (!userId) return res.status(400).send("Missing user_id");

  db.query(
    "DELETE FROM movies WHERE id=? AND user_id=?",
    [req.params.id, userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.sendStatus(500);
      }

      if (result.affectedRows) {
        console.log(`Movie ${req.params.id} deleted by user ${userId}`);
        return res.send("Movie deleted");
      }

      // No rows deleted — check if the movie exists at all
      db.query(
        "SELECT user_id FROM movies WHERE id=?",
        [req.params.id],
        (err2, rows) => {
          if (err2) {
            console.error(err2);
            return res.sendStatus(500);
          }
          if (!rows.length) {
            return res.status(404).send("Movie not found");
          }
          // Exists but not owned by this user
          console.log(
            `User ${userId} attempted to delete movie ${req.params.id} owned by ${rows[0].user_id}`
          );
          return res.status(403).send("Not owner");
        }
      );
    }
  );
});

module.exports = router;
