use crate::models::{PackBundle, Registry, SessionDoc};
use anyhow::{anyhow, Context, Result};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub fn discover_repo_root() -> Result<PathBuf> {
    let mut dir = std::env::current_dir().context("unable to read current directory")?;
    loop {
        if dir.join("src").join("trasgo").join("registry.json").exists() {
            return Ok(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    Err(anyhow!("could not locate Trasgo repo root from current directory"))
}

pub fn runtime_root(base_dir: &Path) -> PathBuf {
    base_dir.join(".trasgo-runtime")
}

pub fn sessions_dir(base_dir: &Path) -> PathBuf {
    runtime_root(base_dir).join("sessions")
}

pub fn packs_dir(base_dir: &Path) -> PathBuf {
    runtime_root(base_dir).join("packs")
}

pub fn registry_path(base_dir: &Path) -> PathBuf {
    base_dir.join("src").join("trasgo").join("registry.json")
}

pub fn ensure_runtime_dirs(base_dir: &Path) -> Result<()> {
    fs::create_dir_all(sessions_dir(base_dir)).context("create sessions dir")?;
    fs::create_dir_all(packs_dir(base_dir)).context("create packs dir")?;
    Ok(())
}

pub fn load_json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let text = fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    let value = serde_json::from_str(&text).with_context(|| format!("parse {}", path.display()))?;
    Ok(value)
}

pub fn save_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    }
    let text = serde_json::to_string_pretty(value)?;
    fs::write(path, text).with_context(|| format!("write {}", path.display()))?;
    Ok(())
}

pub fn load_registry(base_dir: &Path) -> Result<Registry> {
    load_json(&registry_path(base_dir))
}

pub fn load_session(base_dir: &Path, session_id: &str) -> Result<SessionDoc> {
    load_json(&sessions_dir(base_dir).join(format!("{session_id}.json")))
}

pub fn save_session(base_dir: &Path, session: &SessionDoc) -> Result<()> {
    ensure_runtime_dirs(base_dir)?;
    save_json(&sessions_dir(base_dir).join(format!("{}.json", session.id)), session)
}

pub fn load_pack(base_dir: &Path, pack_path: &str) -> Result<PackBundle> {
    let path = if Path::new(pack_path).is_absolute() {
        PathBuf::from(pack_path)
    } else {
        base_dir.join(pack_path)
    };
    load_json(&path)
}

pub fn write_pack(base_dir: &Path, session_id: &str, bundle: &PackBundle) -> Result<PathBuf> {
    ensure_runtime_dirs(base_dir)?;
    let path = packs_dir(base_dir).join(format!("{session_id}.json"));
    save_json(&path, bundle)?;
    Ok(path)
}

pub fn list_session_summaries(base_dir: &Path) -> Result<Vec<serde_json::Value>> {
    ensure_runtime_dirs(base_dir)?;
    let mut summaries = Vec::new();
    for entry in fs::read_dir(sessions_dir(base_dir))? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|v| v.to_str()) != Some("json") {
            continue;
        }
        if let Ok(session) = load_json::<SessionDoc>(&path) {
            summaries.push(serde_json::json!({
                "id": session.id,
                "title": session.title,
                "updated_at": session.updated_at,
                "active_runtime": session.active_runtime,
            }));
        }
    }
    summaries.sort_by(|a, b| {
        let lhs = a.get("updated_at").and_then(|v| v.as_str()).unwrap_or("");
        let rhs = b.get("updated_at").and_then(|v| v.as_str()).unwrap_or("");
        rhs.cmp(lhs)
    });
    Ok(summaries)
}
