#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath};
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::{Arc, Mutex, LazyLock};
use std::sync::atomic::{AtomicI64, Ordering};

#[tauri::command]
fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

#[tauri::command]
fn close_devtools(window: tauri::WebviewWindow) {
    window.close_devtools();
}

#[tauri::command]
fn is_devtools_open(window: tauri::WebviewWindow) -> bool {
    window.is_devtools_open()
}

static DISCORD_CLIENT: LazyLock<Arc<Mutex<Option<DiscordIpcClient>>>> =
    LazyLock::new(|| Arc::new(Mutex::new(None)));

static DISCORD_START_TIME: AtomicI64 = AtomicI64::new(0);

/* ===== DATA STRUCTURES ===== */

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct MangaJson {
    title: String,
    description: String,
    author: String,
    genre: Vec<String>,
    tags: Vec<String>,
    #[serde(rename = "type")]
    manga_type: String,
    status: String,
    cover: String,
    nsfw: bool,
    locked: bool,
    #[serde(default)]
    chapter_order: Vec<String>,
    #[serde(default)]
    page_order: std::collections::HashMap<String, Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Chapter {
    name: String,
    path: String,
    pages: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Manga {
    id: String,
    title: String,
    description: String,
    author: String,
    genre: Vec<String>,
    tags: Vec<String>,
    #[serde(rename = "type")]
    manga_type: String,
    status: String,
    cover: Option<String>,
    path: String,
    chapters: Vec<Chapter>,
    is_favorite: bool,
    bookmark: Option<Bookmark>,
    nsfw: bool,
    locked: bool,
    collections: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct Bookmark {
    chapter: usize,
    page: usize,
    mode: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(default)]
struct Keybinds {
    next_page: String,
    prev_page: String,
    toggle_fullscreen: String,
    save_bookmark: String,
}

impl Default for Keybinds {
    fn default() -> Self {
        Self {
            next_page: "ArrowRight".into(),
            prev_page: "ArrowLeft".into(),
            toggle_fullscreen: "f".into(),
            save_bookmark: "b".into(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(default)]
struct AppSettings {
    lib_path: Option<String>,
    theme: String,
    rtl: bool,
    ui_scale: f32,
    disable_animations: bool,
    custom_css_path: Option<String>,
    firstmeet: bool,  
    keybinds: Keybinds,
    auto_bookmark: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            lib_path: None,
            theme: "dark".into(),
            rtl: false,
            ui_scale: 100.0,
            disable_animations: false,
            custom_css_path: None,
            firstmeet: true,
            auto_bookmark: true,
            keybinds: Keybinds::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Collection {
    id: String,
    name: String,
    manga_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct ReadingSession {
    date: String,
    manga_id: String,
    manga_title: String,
    chapter: usize,
    pages_read: usize,
    duration_seconds: u64,
}

/* ===== PATH HELPERS ===== */

fn app_dir() -> PathBuf {
    let dir = dirs::home_dir()
        .expect("Failed to get home dir")
        .join("Yomiki");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn settings_path(_app: &AppHandle) -> PathBuf {
    app_dir().join("settings.json")
}

fn favorites_path(_app: &AppHandle) -> PathBuf {
    app_dir().join("Favorites.json")
}

fn bookmarks_path(_app: &AppHandle) -> PathBuf {
    app_dir().join("Bookmarked.json")
}

fn collections_path(_app: &AppHandle) -> PathBuf {
    app_dir().join("collections.json")
}

fn stats_path(_app: &AppHandle) -> PathBuf {
    app_dir().join("reading_stats.json")
}

fn load_settings(app: &AppHandle) -> AppSettings {
    let path = settings_path(app);
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(settings) = serde_json::from_str::<AppSettings>(&content) {
            return settings;
        }
    }
    AppSettings::default()
}

fn save_settings_impl(_app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(_app);
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn load_favorites(app: &AppHandle) -> Vec<String> {
    let path = favorites_path(app);
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(list) = serde_json::from_str::<Vec<String>>(&content) {
            return list;
        }
    }
    Vec::new()
}

fn save_favorites(app: &AppHandle, list: &[String]) -> Result<(), String> {
    let path = favorites_path(app);
    let content = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn load_bookmarks(app: &AppHandle) -> std::collections::HashMap<String, Bookmark> {
    let path = bookmarks_path(app);
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, Bookmark>>(&content) {
            return map;
        }
    }
    std::collections::HashMap::new()
}

fn save_bookmarks(app: &AppHandle, map: &std::collections::HashMap<String, Bookmark>) -> Result<(), String> {
    let path = bookmarks_path(app);
    let content = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn load_collections(app: &AppHandle) -> Vec<Collection> {
    let path = collections_path(app);
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(list) = serde_json::from_str::<Vec<Collection>>(&content) {
            return list;
        }
    }
    Vec::new()
}

fn save_collections_impl(app: &AppHandle, collections: &[Collection]) -> Result<(), String> {
    let path = collections_path(app);
    let content = serde_json::to_string_pretty(collections).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn load_stats(app: &AppHandle) -> Vec<ReadingSession> {
    let path = stats_path(app);
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(list) = serde_json::from_str::<Vec<ReadingSession>>(&content) {
            return list;
        }
    }
    Vec::new()
}

fn save_stats(app: &AppHandle, stats: &[ReadingSession]) -> Result<(), String> {
    let path = stats_path(app);
    let content = serde_json::to_string_pretty(stats).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn get_lib_path(app: &AppHandle) -> PathBuf {
    let settings = load_settings(app);
    match settings.lib_path {
        Some(ref path) => {
            let p = PathBuf::from(path);
            let _ = fs::create_dir_all(&p);
            p
        }
        None => {
            let p = app_dir().join("Manga");
            let _ = fs::create_dir_all(&p);
            p
        }
    }
}

fn normalize_path(path: &std::path::Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

/* ===== NATURAL SORT ===== */

fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let a = a.to_lowercase();
    let b = b.to_lowercase();
    let mut a_chars = a.chars().peekable();
    let mut b_chars = b.chars().peekable();

    loop {
        match (a_chars.peek(), b_chars.peek()) {
            (None, None) => return std::cmp::Ordering::Equal,
            (None, Some(_)) => return std::cmp::Ordering::Less,
            (Some(_), None) => return std::cmp::Ordering::Greater,
            (Some(ac), Some(bc)) => {
                if ac.is_ascii_digit() && bc.is_ascii_digit() {
                    let mut a_num = String::new();
                    let mut b_num = String::new();
                    while let Some(&c) = a_chars.peek() {
                        if c.is_ascii_digit() {
                            a_num.push(c);
                            a_chars.next();
                        } else { break; }
                    }
                    while let Some(&c) = b_chars.peek() {
                        if c.is_ascii_digit() {
                            b_num.push(c);
                            b_chars.next();
                        } else { break; }
                    }
                    let a_val: u64 = a_num.parse().unwrap_or(0);
                    let b_val: u64 = b_num.parse().unwrap_or(0);
                    if a_val != b_val {
                        return a_val.cmp(&b_val);
                    }
                } else {
                    let a_lc = ac.to_lowercase().next().unwrap_or(*ac);
                    let b_lc = bc.to_lowercase().next().unwrap_or(*bc);
                    if a_lc != b_lc {
                        return a_lc.cmp(&b_lc);
                    }
                    a_chars.next();
                    b_chars.next();
                }
            }
        }
    }
}

/* ===== FILE OPS ===== */

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn is_image(name: &str) -> bool {
    let n = name.to_lowercase();
    n.ends_with(".jpg") || n.ends_with(".jpeg") || n.ends_with(".png")
        || n.ends_with(".webp") || n.ends_with(".gif") || n.ends_with(".bmp")
}

fn get_library_impl(app: &AppHandle) -> Vec<Manga> {
    let lib = get_lib_path(app);
    let favorites = load_favorites(app);
    let bookmarks = load_bookmarks(app);
    let collections = load_collections(app);
    let mut result = Vec::new();

    if let Ok(entries) = fs::read_dir(&lib) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let path = entry.path();
                let json_path = path.join("manga.json");
                if json_path.exists() {
                    if let Ok(content) = fs::read_to_string(&json_path) {
                        let meta: MangaJson = serde_json::from_str(&content).unwrap_or_default();
                        let id = entry.file_name().to_string_lossy().to_string();
                        let cover = path.join(&meta.cover);
                        let cover_str = if cover.exists() {
                            Some(normalize_path(&cover))
                        } else {
                            None
                        };

                        let mut chapters = Vec::new();
                        if let Ok(ch_entries) = fs::read_dir(&path) {
                            for ch in ch_entries.flatten() {
                                if ch.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                                    let ch_name = ch.file_name().to_string_lossy().to_string();
                                    let mut pages = Vec::new();
                                    if let Ok(p_entries) = fs::read_dir(ch.path()) {
                                        let mut files: Vec<_> = p_entries.flatten()
                                            .filter(|e| is_image(&e.file_name().to_string_lossy()))
                                            .map(|e| normalize_path(&e.path()))
                                            .collect();

                                        if let Some(order) = meta.page_order.get(&ch_name) {
                                            let order_map: std::collections::HashMap<String, usize> =
                                                order.iter().enumerate().map(|(i, n)| (n.clone(), i)).collect();
                                            files.sort_by(|a, b| {
                                                let a_name = Path::new(a).file_name().unwrap_or_default().to_string_lossy().to_string();
                                                let b_name = Path::new(b).file_name().unwrap_or_default().to_string_lossy().to_string();
                                                let a_idx = order_map.get(&a_name).unwrap_or(&usize::MAX);
                                                let b_idx = order_map.get(&b_name).unwrap_or(&usize::MAX);
                                                a_idx.cmp(b_idx)
                                            });
                                        } else {
                                            files.sort_by(|a, b| {
                                                let a_name = Path::new(a).file_name().unwrap_or_default().to_string_lossy();
                                                let b_name = Path::new(b).file_name().unwrap_or_default().to_string_lossy();
                                                natural_cmp(&a_name, &b_name)
                                            });
                                        }
                                        pages = files;
                                    }
                                    chapters.push(Chapter {
                                        name: ch_name,
                                        path: normalize_path(&ch.path()),
                                        pages,
                                    });
                                }
                            }
                        }

                        if !meta.chapter_order.is_empty() {
                            let order_map: std::collections::HashMap<String, usize> =
                                meta.chapter_order.iter().enumerate().map(|(i, n)| (n.clone(), i)).collect();
                            chapters.sort_by(|a, b| {
                                let a_idx = order_map.get(&a.name).unwrap_or(&usize::MAX);
                                let b_idx = order_map.get(&b.name).unwrap_or(&usize::MAX);
                                a_idx.cmp(b_idx)
                            });
                        } else {
                            chapters.sort_by(|a, b| natural_cmp(&a.name, &b.name));
                        }

                        let bookmark = bookmarks.get(&id).cloned();
                        let is_favorite = favorites.contains(&meta.title);
                        let manga_collections: Vec<String> = collections.iter()
                            .filter(|c| c.manga_ids.contains(&id))
                            .map(|c| c.id.clone())
                            .collect();

                        result.push(Manga {
                            id,
                            title: meta.title,
                            description: meta.description,
                            author: meta.author,
                            genre: meta.genre,
                            tags: meta.tags,
                            manga_type: meta.manga_type,
                            status: meta.status,
                            cover: cover_str,
                            path: normalize_path(&path),
                            chapters,
                            is_favorite,
                            bookmark,
                            nsfw: meta.nsfw,
                            locked: meta.locked,
                            collections: manga_collections,
                        });
                    }
                }
            }
        }
    }
    result.sort_by(|a, b| natural_cmp(&a.title, &b.title));
    result
}

/* ===== COMMANDS ===== */

#[tauri::command]
fn get_library(app: AppHandle) -> Vec<Manga> {
    get_library_impl(&app)
}

#[tauri::command]
fn get_settings(app: AppHandle) -> AppSettings {
    load_settings(&app)
}

#[tauri::command]
fn get_default_lib_path(_app: AppHandle) -> Result<String, String> {
    let p = app_dir().join("Manga");
    let _ = fs::create_dir_all(&p);
    Ok(normalize_path(&p))
}

#[tauri::command]
fn set_lib_path(app: AppHandle, path: Option<String>) -> Result<AppSettings, String> {
    let mut settings = load_settings(&app);
    settings.lib_path = path;
    save_settings_impl(&app, &settings)?;
    Ok(settings)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    save_settings_impl(&app, &settings)
}

#[tauri::command]
fn toggle_favorite(app: AppHandle, _id: String, title: String) -> Result<Vec<Manga>, String> {
    let mut favorites = load_favorites(&app);
    if favorites.contains(&title) {
        favorites.retain(|t| t != &title);
    } else {
        favorites.push(title);
    }
    save_favorites(&app, &favorites)?;
    Ok(get_library_impl(&app))
}

#[tauri::command]
fn save_bookmark(app: AppHandle, id: String, chapter: usize, page: usize, mode: String) -> Result<(), String> {
    let mut bookmarks = load_bookmarks(&app);
    bookmarks.insert(id, Bookmark { chapter, page, mode });
    save_bookmarks(&app, &bookmarks)?;
    Ok(())
}

#[tauri::command]
fn get_bookmark(app: AppHandle, id: String) -> Result<Option<Bookmark>, String> {
    let bookmarks = load_bookmarks(&app);
    Ok(bookmarks.get(&id).cloned())
}

#[tauri::command]
fn remove_bookmark(app: AppHandle, id: String) -> Result<(), String> {
    let mut bookmarks = load_bookmarks(&app);
    bookmarks.remove(&id);
    save_bookmarks(&app, &bookmarks)?;
    Ok(())
}

#[tauri::command]
fn get_image_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = Path::new(&path).extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    };
    
    let b64 = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

fn file_path_to_string(p: FilePath) -> String {
    match p {
        FilePath::Path(path) => path.to_string_lossy().to_string(),
        FilePath::Url(url) => url.to_string(),
    }
}

#[tauri::command]
fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path.map(file_path_to_string));
    });
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_css_file(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file()
        .add_filter("CSS Files", &["css"])
        .pick_file(move |path| {
            let _ = tx.send(path.map(file_path_to_string));
        });
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_archive(app: AppHandle) -> Result<Option<(String, String)>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file()
        .add_filter("Archives", &["zip", "ykm", "cbz"])
        .pick_file(move |path| {
            let val = path.map(|p| {
                let path_str = file_path_to_string(p);
                let name = std::path::Path::new(&path_str)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                (path_str, name)
            });
            let _ = tx.send(val);
        });
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_archives(app: AppHandle) -> Result<Option<Vec<(String, String)>>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file()
        .add_filter("Archives", &["zip", "ykm", "cbz"])
        .pick_files(move |paths| {
            let val = paths.map(|vec| {
                vec.into_iter().map(|p| {
                    let path_str = file_path_to_string(p);
                    let name = std::path::Path::new(&path_str)
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    (path_str, name)
                }).collect()
            });
            let _ = tx.send(val);
        });
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_images(app: AppHandle) -> Result<Option<Vec<String>>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file()
        .add_filter("Images", &["jpg", "jpeg", "png", "webp", "gif", "bmp"])
        .pick_files(move |paths| {
            let val = paths.map(|vec| vec.into_iter().map(file_path_to_string).collect());
            let _ = tx.send(val);
        });
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
fn scan_folder(app: AppHandle, path: String) -> Result<Vec<Manga>, String> {
    let lib = get_lib_path(&app);
    let source = PathBuf::from(path);

    if !source.exists() || !source.is_dir() {
        return Err("Selected path is not a valid folder".into());
    }

    let mut imported = 0;
    if let Ok(entries) = fs::read_dir(&source) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let target = lib.join(entry.file_name());
                if entry.path().join("manga.json").exists() {
                    if target.exists() {
                        let _ = fs::remove_dir_all(&target);
                    }
                    if copy_dir_all(entry.path(), &target).is_ok() {
                        imported += 1;
                    }
                }
            }
        }
    }

    if imported == 0 {
        return Err("This package does not contain manga.json. Use Add Manga instead.".into());
    }

    Ok(get_library_impl(&app))
}

#[tauri::command]
fn import_archive(app: AppHandle, path: String, filename: String) -> Result<Vec<Manga>, String> {
    let lib = get_lib_path(&app);
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let reader = std::io::BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;

    let folder_name = filename
        .replace(".zip", "")
        .replace(".ykm", "")
        .replace(".cbz", "");
    let extract_to = lib.join(&folder_name);

    if extract_to.exists() {
        let _ = fs::remove_dir_all(&extract_to);
    }
    fs::create_dir_all(&extract_to).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(p) => extract_to.join(p),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    if !extract_to.join("manga.json").exists() {
        let _ = fs::remove_dir_all(&extract_to);
        return Err("This package does not contain manga.json. Use Add Manga instead.".into());
    }

    Ok(get_library_impl(&app))
}

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    let p = PathBuf::from(path);
    open::that(&p).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn export_backup() -> Result<String, String> {
    let dir = app_dir();
    let backup = serde_json::json!({
        "favorites": load_favorites_from_dir(&dir),
        "bookmarks": load_bookmarks_from_dir(&dir),
        "collections": load_collections_from_dir(&dir),
        "stats": load_stats_from_dir(&dir),
        "exported_at": chrono::Local::now().to_rfc3339(),
    });
    let path = dir.join("backup.json");
    let content = serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?;
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
fn import_backup() -> Result<String, String> {
    let path = app_dir().join("backup.json");
    if !path.exists() { return Err("No backup found".into()); }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn restore_backup(data: String) -> Result<(), String> {
    let backup: serde_json::Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let dir = app_dir();
    
    if let Some(favs) = backup.get("favorites") {
        let path = dir.join("Favorites.json");
        let content = serde_json::to_string_pretty(favs).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
    }
    
    if let Some(bms) = backup.get("bookmarks") {
        let path = dir.join("Bookmarked.json");
        let content = serde_json::to_string_pretty(bms).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
    }

    if let Some(cols) = backup.get("collections") {
        let path = dir.join("collections.json");
        let content = serde_json::to_string_pretty(cols).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
    }
    
    if let Some(stats) = backup.get("stats") {
        let path = dir.join("reading_stats.json");
        let content = serde_json::to_string_pretty(stats).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn load_favorites_from_dir(dir: &PathBuf) -> Vec<String> {
    let path = dir.join("Favorites.json");
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(list) = serde_json::from_str::<Vec<String>>(&content) {
            return list;
        }
    }
    Vec::new()
}

fn load_bookmarks_from_dir(dir: &PathBuf) -> std::collections::HashMap<String, Bookmark> {
    let path = dir.join("Bookmarked.json");
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, Bookmark>>(&content) {
            return map;
        }
    }
    std::collections::HashMap::new()
}

fn load_collections_from_dir(dir: &PathBuf) -> Vec<Collection> {
    let path = dir.join("collections.json");
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(list) = serde_json::from_str::<Vec<Collection>>(&content) {
            return list;
        }
    }
    Vec::new()
}

fn load_stats_from_dir(dir: &PathBuf) -> Vec<ReadingSession> {
    let path = dir.join("reading_stats.json");
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(list) = serde_json::from_str::<Vec<ReadingSession>>(&content) {
            return list;
        }
    }
    Vec::new()
}

#[tauri::command]
fn __restore_library_data(app: AppHandle, data: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::write(dir.join("library.json"), data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_manga(app: AppHandle, id: String) -> Result<Vec<Manga>, String> {
    let target = get_lib_path(&app).join(&id);
    if target.exists() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
    }
    Ok(get_library_impl(&app))
}

#[allow(non_snake_case)]
#[tauri::command]
fn record_reading_session(app: AppHandle, mangaId: String, mangaTitle: String, chapter: usize, pagesRead: usize, durationSeconds: u64) -> Result<(), String> {
    let mut stats = load_stats(&app);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    
    let existing = stats.iter_mut().find(|s| {
        s.date == today && s.manga_id == mangaId && s.chapter == chapter
    });
    
    if let Some(session) = existing {
        session.pages_read = pagesRead.max(session.pages_read);
        session.duration_seconds += durationSeconds;
    } else {
        stats.push(ReadingSession {
            date: today,
            manga_id: mangaId,
            manga_title: mangaTitle,
            chapter,
            pages_read: pagesRead,
            duration_seconds: durationSeconds,
        });
    }
    save_stats(&app, &stats)
}

#[tauri::command]
fn get_reading_stats(app: AppHandle) -> Result<Vec<ReadingSession>, String> {
    Ok(load_stats(&app))
}

#[tauri::command]
fn get_reading_summary(app: AppHandle) -> Result<serde_json::Value, String> {
    let stats = load_stats(&app);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let week_ago = chrono::Local::now() - chrono::Duration::days(7);
    
    let today_pages: usize = stats.iter()
        .filter(|s| s.date == today)
        .map(|s| s.pages_read)
        .sum();
    
    let week_pages: usize = stats.iter()
        .filter(|s| {
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&s.date, "%Y-%m-%d") {
                d >= week_ago.naive_local().date()
            } else {
                false
            }
        })
        .map(|s| s.pages_read)
        .sum();
    
    let total_time: u64 = stats.iter().map(|s| s.duration_seconds).sum();
    let total_pages_read: usize = stats.iter().map(|s| s.pages_read).sum();
    
    let last_read = stats.last()
        .map(|s| s.manga_title.clone())
        .unwrap_or_else(|| "-".to_string());
    
    Ok(serde_json::json!({
        "today_pages": today_pages,
        "week_pages": week_pages,
        "total_time_seconds": total_time,
        "total_pages_read": total_pages_read,
        "last_read_manga": last_read,
    }))
}

/* ===== COLLECTION COMMANDS ===== */

#[tauri::command]
fn get_collections(app: AppHandle) -> Vec<Collection> {
    load_collections(&app)
}

#[tauri::command]
fn create_collection(app: AppHandle, name: String) -> Result<Vec<Collection>, String> {
    let mut collections = load_collections(&app);
    let id = format!("col_{}", chrono::Local::now().timestamp_millis());
    collections.push(Collection { id, name, manga_ids: Vec::new() });
    save_collections_impl(&app, &collections)?;
    Ok(collections)
}

#[tauri::command]
fn delete_collection(app: AppHandle, id: String) -> Result<Vec<Collection>, String> {
    let mut collections = load_collections(&app);
    collections.retain(|c| c.id != id);
    save_collections_impl(&app, &collections)?;
    Ok(collections)
}

#[tauri::command]
fn add_to_collection(app: AppHandle, collection_id: String, manga_id: String) -> Result<Vec<Collection>, String> {
    let mut collections = load_collections(&app);
    if let Some(col) = collections.iter_mut().find(|c| c.id == collection_id) {
        if !col.manga_ids.contains(&manga_id) {
            col.manga_ids.push(manga_id);
        }
    }
    save_collections_impl(&app, &collections)?;
    Ok(collections)
}

#[tauri::command]
fn remove_from_collection(app: AppHandle, collection_id: String, manga_id: String) -> Result<Vec<Collection>, String> {
    let mut collections = load_collections(&app);
    if let Some(col) = collections.iter_mut().find(|c| c.id == collection_id) {
        col.manga_ids.retain(|id| id != &manga_id);
    }
    save_collections_impl(&app, &collections)?;
    Ok(collections)
}

/* ===== STUDIO COMMANDS ===== */

//#[derive(Deserialize)]
//#[serde(rename_all = "snake_case")]
//  struct CreateMangaArgs {
//    folder_name: String,
//    title: String,
// }

#[tauri::command]
fn create_new_manga(app: AppHandle, folder_name: String, title: String) -> Result<Manga, String> {
    let lib = get_lib_path(&app);
    let folder = lib.join(&folder_name);
    if folder.exists() {
        return Err("A manga folder with this name already exists".into());
    }
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    
    let meta = MangaJson {
        title: title.clone(),
        description: "".into(),
        author: "".into(),
        genre: vec![],
        tags: vec![],
        manga_type: "Manga".into(),
        status: "Ongoing".into(),
        cover: "".into(),
        nsfw: false,
        locked: false,
        chapter_order: vec![],
        page_order: std::collections::HashMap::new(),
    };
    let json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    fs::write(folder.join("manga.json"), json).map_err(|e| e.to_string())?;
    
    let id = folder_name;
    Ok(Manga {
        id: id.clone(),
        title,
        description: "".into(),
        author: "".into(),
        genre: vec![],
        tags: vec![],
        manga_type: "Manga".into(),
        status: "Ongoing".into(),
        cover: None,
        path: normalize_path(&folder),
        chapters: vec![],
        is_favorite: false,
        bookmark: None,
        nsfw: false,
        locked: false,
        collections: vec![],
    })
}

#[tauri::command]
fn save_manga_json(_app: AppHandle, folder_path: String, json_data: String) -> Result<(), String> {
    let path = PathBuf::from(folder_path).join("manga.json");
    fs::write(&path, json_data).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_chapter(manga_path: String, chapter_name: String) -> Result<(), String> {
    let path = PathBuf::from(manga_path).join(&chapter_name);
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_chapter(manga_path: String, chapter_name: String) -> Result<(), String> {
    let path = PathBuf::from(manga_path).join(&chapter_name);
    if path.exists() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn add_pages(manga_path: String, chapter_name: String, image_paths: Vec<String>) -> Result<Vec<String>, String> {
    let chapter_path = PathBuf::from(manga_path).join(&chapter_name);
    fs::create_dir_all(&chapter_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for src in image_paths {
        let name = Path::new(&src).file_name().unwrap_or_default().to_string_lossy().to_string();
        let target = chapter_path.join(&name);
        let final_target = if target.exists() {
            let stem = Path::new(&name).file_stem().unwrap_or_default().to_string_lossy();
            let ext = Path::new(&name).extension().and_then(|e| e.to_str()).unwrap_or("");
            let mut n = 1;
            let mut candidate = if ext.is_empty() {
                chapter_path.join(format!("{}_{}", stem, n))
            } else {
                chapter_path.join(format!("{}_{}.{}", stem, n, ext))
            };
            while candidate.exists() {
                n += 1;
                candidate = if ext.is_empty() {
                    chapter_path.join(format!("{}_{}", stem, n))
                } else {
                    chapter_path.join(format!("{}_{}.{}", stem, n, ext))
                };
            }
            candidate
        } else {
            target
        };
        fs::copy(&src, &final_target).map_err(|e| e.to_string())?;
        result.push(normalize_path(&final_target));
    }
    Ok(result)
}

#[tauri::command]
fn remove_page(page_path: String) -> Result<(), String> {
    if PathBuf::from(&page_path).exists() {
        fs::remove_file(&page_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn move_page(page_path: String, target_chapter_path: String) -> Result<String, String> {
    let source = PathBuf::from(&page_path);
    if !source.exists() {
        return Err("Source page not found".into());
    }
    let target_dir = PathBuf::from(&target_chapter_path);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    
    let name = source.file_name().unwrap_or_default().to_string_lossy().to_string();
    let target = target_dir.join(&name);
    
    let final_target = if target.exists() {
        let stem = Path::new(&name).file_stem().unwrap_or_default().to_string_lossy();
        let ext = Path::new(&name).extension().and_then(|e| e.to_str()).unwrap_or("");
        let mut n = 1;
        let mut candidate = if ext.is_empty() {
            target_dir.join(format!("{}_{}", stem, n))
        } else {
            target_dir.join(format!("{}_{}.{}", stem, n, ext))
        };
        while candidate.exists() {
            n += 1;
            candidate = if ext.is_empty() {
                target_dir.join(format!("{}_{}", stem, n))
            } else {
                target_dir.join(format!("{}_{}.{}", stem, n, ext))
            };
        }
        candidate
    } else {
        target
    };
    
    fs::rename(&source, &final_target).map_err(|e| e.to_string())?;
    Ok(normalize_path(&final_target))
}

#[tauri::command]
fn set_cover(manga_path: String, image_path: String) -> Result<String, String> {
    let ext = Path::new(&image_path).extension().and_then(|e| e.to_str()).unwrap_or("webp");
    let cover_name = format!("cover.{}", ext);
    let target = PathBuf::from(&manga_path).join(&cover_name);
    fs::copy(&image_path, &target).map_err(|e| e.to_string())?;
    Ok(cover_name)
}

#[tauri::command]
fn export_ykm_to_exports(_app: AppHandle, folder_path: String) -> Result<String, String> {
    let exports_dir = app_dir().join("Exports");
    fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
    
    let folder_name = PathBuf::from(&folder_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    
    let output_path = exports_dir.join(format!("{}.ykm", folder_name));
    
    // Reuse existing export logic
    let source = PathBuf::from(&folder_path);
    let file = fs::File::create(&output_path).map_err(|e| e.to_string())?;
    let writer = std::io::BufWriter::new(file);
    let mut zip = zip::ZipWriter::new(writer);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    
    fn add_to_zip(zip: &mut zip::ZipWriter<std::io::BufWriter<fs::File>>, base: &Path, path: &Path, options: zip::write::SimpleFileOptions) -> std::io::Result<()> {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            let name = path.strip_prefix(base).unwrap().to_string_lossy().replace('\\', "/");
            if entry.file_type()?.is_dir() {
                zip.add_directory(&name, options)?;
                add_to_zip(zip, base, &path, options)?;
            } else {
                zip.start_file(&name, options)?;
                let mut f = fs::File::open(&path)?;
                std::io::copy(&mut f, zip)?;
            }
        }
        Ok(())
    }
    
    add_to_zip(&mut zip, &source, &source, options).map_err(|e| e.to_string())?;
    zip.finish().map_err(|e| e.to_string())?;
    
    Ok(folder_name)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}


/* ===== DEV / DEBUG COMMANDS ===== */

#[tauri::command]
fn dev_delete_all_manga(app: AppHandle) -> Result<(), String> {
    let lib = get_lib_path(&app);
    if let Ok(entries) = fs::read_dir(&lib) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn dev_reset_app_data(_app: AppHandle) -> Result<(), String> {
    let dir = app_dir();
    for f in ["settings.json", "Favorites.json", "Bookmarked.json", "collections.json", "reading_stats.json", "backup.json"] {
        let _ = fs::remove_file(dir.join(f));
    }
    Ok(())
}

#[tauri::command]
fn dev_export_library_json(app: AppHandle) -> Result<String, String> {
    let lib = get_library_impl(&app);
    serde_json::to_string_pretty(&lib).map_err(|e| e.to_string())
}

#[tauri::command]
fn dev_reveal_app_dir() -> Result<(), String> {
    let dir = app_dir();
    open::that(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn dev_fill_dummy_library(app: AppHandle) -> Result<(), String> {
    let lib = get_lib_path(&app);
    for i in 1..=5 {
        let folder = lib.join(format!("dummy_manga_{}", i));
        fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
        let meta = MangaJson {
            title: format!("Dummy Manga {}", i),
            description: "Auto-generated for UI testing".into(),
            author: "Dev Bot".into(),
            genre: vec!["Comedy".into(), "Test".into()],
            tags: vec!["dummy".into()],
            manga_type: "Manga".into(),
            status: "Ongoing".into(),
            cover: "".into(),
            nsfw: i % 2 == 0,
            locked: false,
            chapter_order: vec![],
            page_order: std::collections::HashMap::new(),
        };
        let json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
        fs::write(folder.join("manga.json"), json).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn dev_get_disk_usage(app: AppHandle) -> Result<serde_json::Value, String> {
    let lib = get_lib_path(&app);
    let mut total_bytes = 0u64;
    let mut file_count = 0u64;
    
    fn walk(dir: &std::path::Path, bytes: &mut u64, count: &mut u64) -> std::io::Result<()> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                walk(&entry.path(), bytes, count)?;
            } else {
                *bytes += entry.metadata()?.len();
                *count += 1;
            }
        }
        Ok(())
    }
    
    let _ = walk(&lib, &mut total_bytes, &mut file_count);
    
    Ok(serde_json::json!({
        "total_bytes": total_bytes,
        "file_count": file_count,
        "readable": format!("{:.2} MB", total_bytes as f64 / 1_048_576.0)
    }))
}

/* ===== DISCORD RPC ===== */

#[tauri::command]
fn discord_connect() -> Result<(), String> {
    let mut global = DISCORD_CLIENT.lock().unwrap();
    if global.is_some() {
        return Ok(());
    }
    let mut client = DiscordIpcClient::new("1504425198315634760")
        .map_err(|e| e.to_string())?;
    client.connect().map_err(|e| e.to_string())?;

    let start = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    DISCORD_START_TIME.store(start, Ordering::Relaxed);

    *global = Some(client);
    Ok(())
}

#[tauri::command]
fn discord_update_presence(
    state: String,
    details: String,
    large_text: String,
    _small_text: String,
) -> Result<(), String> {
    let mut global = DISCORD_CLIENT.lock().unwrap();
    if let Some(ref mut client) = *global {
        let start = DISCORD_START_TIME.load(Ordering::Relaxed);
        let timestamps = if start > 0 {
            activity::Timestamps::new().start(start)
        } else {
            activity::Timestamps::new()
        };

        let act = activity::Activity::new()
            .state(&state)
            .details(&details)
            .assets(
                activity::Assets::new()
                    .large_image("icon")
                    .large_text(&large_text)
            )
            .timestamps(timestamps);

        client.set_activity(act).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn discord_clear_presence() -> Result<(), String> {
    let mut global = DISCORD_CLIENT.lock().unwrap();
    if let Some(ref mut client) = *global {
        client.clear_activity().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn discord_disconnect() -> Result<(), String> {
    let mut global = DISCORD_CLIENT.lock().unwrap();
    if let Some(ref mut client) = *global {
        client.close().map_err(|e| e.to_string())?;
    }
    *global = None;
    DISCORD_START_TIME.store(0, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
fn dev_reveal_lib_dir(app: AppHandle) -> Result<(), String> {
    let dir = get_lib_path(&app);
    open::that(&dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn dev_get_system_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
        "timestamp": chrono::Local::now().to_rfc3339(),
    }))
}

/* ===== MAIN ===== */

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_devtools,
            close_devtools,
            is_devtools_open,
            get_library,
            get_settings,
            get_default_lib_path,
            set_lib_path,
            save_settings,
            toggle_favorite,
            save_bookmark,
            remove_bookmark,
            get_bookmark,
            get_image_base64,
            pick_folder,
            pick_css_file,
            pick_archive,
            pick_archives,
            pick_images,
            scan_folder,
            import_archive,
            delete_manga,
            show_in_folder,
            record_reading_session,
            get_reading_stats,
            get_reading_summary,
            export_backup,
            import_backup,
            restore_backup,
            get_collections,
            create_collection,
            delete_collection,
            add_to_collection,
            remove_from_collection,
            discord_connect,
            discord_update_presence,
            discord_clear_presence,
            discord_disconnect,
            dev_delete_all_manga,
            dev_reset_app_data,
            dev_export_library_json,
            dev_reveal_app_dir,
            dev_fill_dummy_library,
            dev_get_disk_usage,
            dev_reveal_lib_dir,
            dev_get_system_info,
            create_new_manga,
            save_manga_json,
            create_chapter,
            delete_chapter,
            add_pages,
            remove_page,
            move_page,
            set_cover,
            export_ykm_to_exports,
            read_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

