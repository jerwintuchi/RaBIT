use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use std::{path::PathBuf, time::Duration};
use tauri::Emitter;

pub struct FileWatcher {
    _debouncer: Option<Debouncer<notify::RecommendedWatcher>>,
    pub watched_path: Option<PathBuf>,
    app: Option<tauri::AppHandle>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            _debouncer: None,
            watched_path: None,
            app: None,
        }
    }

    pub fn set_handle(&mut self, handle: tauri::AppHandle) {
        self.app = Some(handle);
    }

    /// Start watching `path`. Stops any previously watched path first.
    pub fn watch(&mut self, path: &std::path::Path) -> Result<(), String> {
        self.unwatch();

        let app = match &self.app {
            Some(a) => a.clone(),
            None => return Err("AppHandle not set on FileWatcher".into()),
        };

        let watched = path.to_path_buf();
        let watched_for_cb = watched.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            move |result: DebounceEventResult| {
                let events = match result {
                    Ok(ev) => ev,
                    Err(_) => return,
                };
                for event in events {
                    if event.path == watched_for_cb {
                        let changed_at = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64;
                        let _ = app.emit(
                            "file:external_change",
                            serde_json::json!({
                                "path": event.path.to_string_lossy(),
                                "changedAt": changed_at,
                            }),
                        );
                    }
                }
            },
        )
        .map_err(|e| e.to_string())?;

        // Watch the parent directory (required by notify on Windows).
        // The callback filters to the exact file path.
        let parent = path.parent().unwrap_or(path);
        debouncer
            .watcher()
            .watch(parent, notify::RecursiveMode::NonRecursive)
            .map_err(|e| e.to_string())?;

        self._debouncer = Some(debouncer);
        self.watched_path = Some(watched);

        Ok(())
    }

    /// Stop watching the current file.
    pub fn unwatch(&mut self) {
        self._debouncer = None;
        self.watched_path = None;
    }
}
