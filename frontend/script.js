const API = "http://localhost:3000";
const TMDB_KEY = "1a64abc441eb2dd9a775e120969457fe";

const USER_ID =
  localStorage.getItem("userId") ||
  sessionStorage.getItem("userId");

if (location.pathname.includes("dashboard") && !USER_ID) {
  location.href = "login.html";
}

/***********************
  GLOBAL TMDB CACHE
************************/
let AUTO_GENRES = null;
let AUTO_YEAR = null;
let AUTO_TMDB_ID = null;

/***********************
  AUTH
************************/
function login() {
  fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: document.getElementById("user").value,
      password: document.getElementById("pass").value
    })
  })
  .then(res => {
    if (!res.ok) throw new Error("Login failed");
    return res.json();
  })
  .then(data => {
    localStorage.setItem("userId", data.userId);
    location.href = "dashboard.html";
  })
  .catch(() => {
    document.getElementById("msg").innerText =
      "Invalid username or password";
  });
}

function logout() {
  localStorage.clear();
  sessionStorage.clear();
  location.href = "login.html";
}

/***********************
  HEADER UI
************************/
function toggleProfileMenu() {
  const menu = document.getElementById("profileMenu");
  if (!menu) return;
  menu.style.display =
    menu.style.display === "flex" ? "none" : "flex";
}

document.addEventListener("click", e => {
  const profile = document.querySelector(".profile");
  const menu = document.getElementById("profileMenu");
  if (menu && profile && !profile.contains(e.target)) {
    menu.style.display = "none";
  }
});

function toggleMenu() {
  // Placeholder for mobile sidebar
  alert("Mobile menu coming soon");
}

/***********************
  TMDB AUTO-FILL
************************/
function autoFillFromTMDB() {
  const titleInput = document.getElementById("title");
  const loader = document.getElementById("tmdbLoader");
  const addBtn = document.getElementById("addBtn");

  if (!titleInput || !titleInput.value.trim()) return;

  // Reset previous TMDB data
  AUTO_GENRES = null;
  AUTO_YEAR = null;
  AUTO_TMDB_ID = null;

  // Show loader & disable add button
  loader.classList.remove("hidden");
  addBtn.disabled = true;

  fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(titleInput.value)}`
  )
    .then(r => r.json())
    .then(data => {
      if (!data.results || !data.results.length) {
        throw new Error("Movie not found");
      }

      const movie = data.results[0];
      AUTO_TMDB_ID = movie.id;
      AUTO_YEAR = movie.release_date
        ? movie.release_date.split("-")[0]
        : "";

      return fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_KEY}`
      );
    })
    .then(r => r.json())
    .then(info => {
      AUTO_GENRES = info.genres.map(g => g.name);
    })
    .catch(() => {
      alert("Could not fetch movie details from TMDB");
    })
    .finally(() => {
      // Hide loader & enable add button
      loader.classList.add("hidden");
      addBtn.disabled = false;
    });
}


/***********************
  ADD MOVIE (DUP SAFE)
************************/
function addMovie() {
  const titleInput = document.getElementById("title");

  if (!titleInput || !titleInput.value.trim()) {
    alert("Enter a movie name");
    return;
  }

  if (!AUTO_TMDB_ID || !AUTO_GENRES || !AUTO_YEAR) {
    alert("Please wait for TMDB auto-fill");
    return;
  }

  fetch(API + "/movies/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: titleInput.value.trim(),
      genre: AUTO_GENRES.join(","),
      release_year: AUTO_YEAR,
      user_id: USER_ID,
      tmdb_id: AUTO_TMDB_ID
    })
  })
    .then(res => {
      if (res.status === 409) {
        alert("Movie already in your watchlist");
        return;
      }
      return res.text();
    })
    .then(() => {
      titleInput.value = "";
      AUTO_GENRES = AUTO_YEAR = AUTO_TMDB_ID = null;
      loadMovies();
    });
}

/***********************
  POSTER FETCH
************************/
function fetchPoster(title, callback) {
  fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}`
  )
    .then(res => res.json())
    .then(data => {
      if (
        data.results &&
        data.results.length &&
        data.results[0].poster_path
      ) {
        callback(
          "https://image.tmdb.org/t/p/w500" +
            data.results[0].poster_path
        );
      } else {
        callback(null);
      }
    });
}

/***********************
  WATCHLIST
************************/
function toggleWatch(movieId, watched) {
  fetch(API + "/movies/watch/" + movieId, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watched })
  }).then(loadMovies);
}

/***********************
  RATINGS
************************/
function rate(movieId, rating) {
  fetch(API + "/movies/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      movie_id: movieId,
      rating,
      user_id: USER_ID
    })
  }).then(loadMovies);
}

/***********************
  GENRE FILTER
************************/
let ACTIVE_GENRE = null;

function renderGenreChips(genres) {
  const container = document.getElementById("genreFilters");
  if (!container) return;

  container.innerHTML = genres.map(g => `
    <div class="chip ${ACTIVE_GENRE === g ? "active" : ""}"
      onclick="filterByGenre('${g}')">
      ${g}
    </div>
  `).join("");
}

function filterByGenre(genre) {
  ACTIVE_GENRE = ACTIVE_GENRE === genre ? null : genre;
  loadMovies();
}

/***********************
  LOAD MOVIES
************************/
function loadMovies() {
  fetch(API + "/movies/" + USER_ID)
    .then(r => r.json())
    .then(data => {
      // Build genre chips
      const allGenres = [
        ...new Set(
          data.flatMap(m =>
            m.genre.split(",").map(g => g.trim())
          )
        )
      ];
      renderGenreChips(allGenres);

      // Apply genre filter
      let filtered = data;
      if (ACTIVE_GENRE) {
        filtered = data.filter(m =>
          m.genre.split(",").includes(ACTIVE_GENRE)
        );
      }

      const grid = document.getElementById("movies");
      if (!grid) return;

      grid.innerHTML = filtered.map(m => `
        <div class="movie ${m.watched ? "watched" : ""}" id="movie-${m.id}">

          <div class="poster skeleton"></div>

          <h4>${m.title}</h4>

          <button class="watch-btn"
            onclick="toggleWatch(${m.id}, ${m.watched ? 0 : 1})">
            ${m.watched ? "✅ Watched" : "👁️ Add to Watchlist"}
          </button>

          <div class="stars">
            ${[1,2,3,4,5].map(s => `
              <span class="${s <= (m.user_rating || 0) ? "active" : ""}"
                onclick="rate(${m.id}, ${s})">★</span>
            `).join("")}
          </div>

        </div>
      `).join("");

      // Load posters after DOM render
      filtered.forEach(m => {
        fetchPoster(m.title, poster => {
          const posterDiv =
            document.querySelector(`#movie-${m.id} .poster`);
          if (poster && posterDiv) {
            posterDiv.style.backgroundImage = `url(${poster})`;
            posterDiv.classList.remove("skeleton");
          }
        });
      });
    });
}

/***********************
  INIT
************************/
if (document.getElementById("movies")) {
  loadMovies();
}