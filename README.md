# Yomiki Manga Reader

A desktop manga library and reader built with Vite + Tauri.

This project is archived / legacy code. It is not being actively maintained, but the current build already includes a substantial set of local-reader features and can be used as a base for future development or a reference implementation.

## What the project does

Yomiki is a local manga management app for browsing a manga library, importing manga folders or archives, reading the content in a desktop viewer, and saving reading progress. It is designed around a local file-based workflow, where each manga is stored in a folder that contains metadata and chapter/page images.

## Included features

The current codebase already contains the following features:

- Local manga library browsing
- Folder import and archive import (.zip, .cbz, .ykm)
- Search and filtering within the library
- Favorite tracking
- Reading bookmarks and save progress per manga/chapter/page
- Reader view with fullscreen and keyboard shortcuts
- Reader UI auto-hide behavior for a cleaner reading experience
- Collection management
- Reading statistics / session tracking
- Theme settings, UI scaling, and custom CSS support
- Studio / metadata editor for manga data and chapter ordering
- Discord Rich Presence integration
- Library, settings, statistics, and studio pages built into the desktop app

## Project status

This repository should be treated as an archive or prototype-level project, not a fully maintained production app. The project has a useful feature set, but some rough edges, incomplete flows, and compatibility issues are still possible depending on the environment and use case.

For future work, the repository includes an internal notes file called `up coming.txt`, but it is intentionally not expanded into the main README so the project page remains focused on the current state of the app.

## Tech stack

- Frontend: HTML, CSS, JavaScript
- Build tool: Vite
- Desktop app: Tauri 2
- Backend logic: Rust in `src-tauri/src/main.rs`
- Storage: JSON-based app metadata and reading data saved under the user app-data directory

## Repository structure

```text
.
├── LICENSE
├── MIGRATION_GUIDE.md
├── README.md
├── package.json
├── vite.config.js
├── up coming.txt
├── public/
│   └── script/
│       ├── dev.js
│       ├── menu.js
│       ├── readmode.js
│       ├── scanfolder.js
│       ├── settings.js
│       ├── statistics.js
│       ├── studio.js
│       └── utils.js
├── src/
│   ├── index.html
│   ├── settings.html
│   ├── statistics.html
│   ├── studio.html
│   ├── viewer.html
│   └── styles/
│       ├── animations.css
│       ├── base.css
│       ├── dev.css
│       ├── library.css
│       ├── modal.css
│       ├── reader.css
│       ├── settings.css
│       ├── statistics.css
│       ├── studio.css
│       └── variables.css
└── src-tauri/
    ├── Cargo.toml
    ├── Cargo.lock
    ├── build.rs
    ├── tauri.conf.json
    └── src/
        └── main.rs
```

## Example metadata

Each manga folder typically contains a `manga.json` file. Example structure:

```json
{
  "title": "Example Manga",
  "description": "A short synopsis of the series.",
  "author": "Author Name",
  "genre": ["Action", "Adventure"],
  "tags": ["school-life", "fantasy"],
  "type": "Manga",
  "status": "Ongoing",
  "cover": "cover.jpg",
  "nsfw": false,
  "locked": false,
  "chapter_order": ["Chapter 1", "Chapter 2"],
  "page_order": {
    "Chapter 1": ["page_001.jpg", "page_002.jpg"]
  }
}
```

## Quick start

### Install dependencies

```bash
npm install
```

### Run the web app in development mode

```bash
npm run dev
```

### Run the Tauri desktop app

```bash
npm run tauri dev
```

### Build the app

```bash
npm run build
npm run tauri build
```

## Requirements

- Node.js and npm
- Rust toolchain
- Tauri 2 runtime dependencies for your OS

## License

This project is distributed under the license in `LICENSE`.

## Summary

Yomiki is a feature-rich local manga reader and library manager with custom metadata tooling, reading progress tracking, collections, stats, and a desktop app shell. It is currently best described as an archived legacy project with a solid feature foundation but without active ongoing maintenance.
