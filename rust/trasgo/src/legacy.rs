use anyhow::{Context, Result};
use std::path::Path;
use std::process::{Command, Stdio};

pub fn node_executable() -> String {
    std::env::var("TRASGO_NODE").unwrap_or_else(|_| "node".to_string())
}

pub fn legacy_script(base_dir: &Path) -> String {
    base_dir
        .join("src")
        .join("trasgo")
        .join("cli.mjs")
        .to_string_lossy()
        .to_string()
}

pub fn passthrough(base_dir: &Path, args: &[String]) -> Result<i32> {
    let status = Command::new(node_executable())
        .arg(legacy_script(base_dir))
        .args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .context("failed to start legacy Trasgo CLI")?;

    Ok(status.code().unwrap_or(1))
}
