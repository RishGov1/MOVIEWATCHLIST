const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "risgov123",
  database: "movie_watchlist",
  port: 3306
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL Connected");
});

module.exports = db;
