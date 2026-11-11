# Official Exams Library

A small static website to browse the Lebanese **Technical Diploma (TS)** official exams by **major**, **course** and **year**.

- Majors: Electronics, Management Informatics, Systems & Networks
- Search by course, year, exam code, session or topic (e.g. `triac 2024`, `PIA`, `umask`); Arabic course names work too
- Filters: course, year, session, type (exam, exam + key, solved, practice, notes), favourites
- Two views: grouped by course and year, or cards
- PDF preview in the page, open in a new tab, or download
- Favourites and "recently opened" are saved in the browser
- A "Random exam" button for revision
- The address bar keeps the filters, so a link opens the same selection

No framework and no build step: plain HTML, CSS and JavaScript.

## Structure

```
index.html
assets/style.css
assets/app.js
data/exams.js          catalogue (generated)
exams/<major>/<course>/<year>/<year>-s<session>-<course>[-variant][-lang][-type].pdf
```

## Run locally

Double-click `index.html` (the catalogue is a script file, so no server is needed).

## Publish on GitHub Pages

1. Create a repository (e.g. `official-exams`) and push the content of this folder to it:
   ```
   git init
   git add .
   git commit -m "Official exams library"
   git branch -M main
   git remote add origin https://github.com/<your-account>/official-exams.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → main / (root)** → Save.
3. After a minute the site is at `https://<your-account>.github.io/official-exams/`.

## Adding exams

Add the PDF under `exams/<major>/<course>/<year>/` and add one object to `data/exams.js`
(copy an existing entry and change `year`, `session`, `type`, `file`, `pages`, `sizeKB`, `tags`).
