# Daily Habits

A calm, mobile-first habit tracker. Plain HTML, CSS and JavaScript: no login, no server, no build step.
Everything is saved in your browser with `localStorage`.

## Features
- **Today**: tick each habit with one tap. Go back to past days with the arrows.
- **English practice**: tap Speaking / Grammar / Vocabulary to record what you did.
- **Reading**: log pages and minutes each day, tap "Finished a book" (weekly book goal).
- **Screen time**: log hours per day against a goal you can change.
- **Streaks** (current + best), a **weekly grid**, and a **30-day screen-time chart**.
- Add, edit, reorder and delete habits. Light / dark / auto theme.
- Export a JSON backup (or CSV) and import it again. Works offline once installed.

## Files
| File | What it is |
|---|---|
| `index.html` | Page structure |
| `style.css` | All styling (pastel colours, dark mode) |
| `app.js` | All logic and storage |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen app + offline support |

## Run locally
Double-click `index.html`, or for the full experience (offline mode) run a tiny server:
```
python3 -m http.server 8000
```
then open http://localhost:8000.

## Deploy free on Netlify
Easiest: go to https://app.netlify.com/drop and drag this whole folder onto the page.
Or connect this GitHub repo in Netlify ("Add new site" → "Import an existing project"); leave the build command empty and set the publish directory to `/`.

## Important: your data lives on each device
Your iPhone and your computer each keep **their own separate copy**. They do not sync.
To move data, use **Habits → Export backup** on one device and **Import .json** on the other.
Export a backup regularly: clearing Safari's website data deletes it.
