use crate::models::*;
use crate::storage;
use anyhow::{anyhow, Result};
use chrono::Utc;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::Path;

pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn next_session_id() -> String {
    format!("trasgo-{}", Utc::now().timestamp_nanos_opt().unwrap_or_default())
}

pub fn default_runtime_targets(registry: &Registry) -> Vec<String> {
    registry.runtimes.iter().map(|runtime| runtime.id.clone()).collect()
}

pub fn seed_footprints(registry: &Registry) -> BTreeMap<String, FootprintState> {
    registry
        .runtimes
        .iter()
        .map(|runtime| {
            (
                runtime.id.clone(),
                FootprintState {
                    seed: runtime.footprint.clone(),
                    observed: ObservedFootprint {
                        calls: 0,
                        failures: 0,
                        avg_latency_ms: None,
                        last_status: "unknown".to_string(),
                        extra: Default::default(),
                    },
                    extra: Default::default(),
                },
            )
        })
        .collect()
}

pub fn default_contract(registry: &Registry) -> Contract {
    let mut priorities = BTreeMap::new();
    priorities.insert("calibration".to_string(), 1.0);
    priorities.insert("transfer".to_string(), 1.0);
    priorities.insert("delta".to_string(), 1.0);
    priorities.insert("protocol".to_string(), 1.1);
    priorities.insert("structured".to_string(), 0.8);
    priorities.insert("efficiency".to_string(), 0.4);
    priorities.insert("locality".to_string(), 0.8);
    priorities.insert("privacy".to_string(), 0.8);
    priorities.insert("cost".to_string(), 0.6);
    priorities.insert("stability".to_string(), 0.9);

    Contract {
        policy: "manifested".to_string(),
        persist: "session".to_string(),
        mode: "single".to_string(),
        fallback: "handoff".to_string(),
        targets: default_runtime_targets(registry),
        priorities,
        constraints: ContractConstraints::default(),
        extra: Default::default(),
    }
}

pub fn ensure_session_defaults(session: &mut SessionDoc, registry: &Registry) {
    if session.id.is_empty() {
        session.id = next_session_id();
    }
    if session.title.is_empty() {
        session.title = "trasgo-session".to_string();
    }
    if session.created_at.is_empty() {
        session.created_at = now_iso();
    }
    if session.updated_at.is_empty() {
        session.updated_at = now_iso();
    }
    if session.skills.is_empty() {
        session.skills = vec!["boot-loader".to_string()];
    }
    if session.mcp_mounts.is_empty() {
        session.mcp_mounts = vec!["runtime-registry".to_string()];
    }
    if session.contract.targets.is_empty() {
        session.contract = default_contract(registry);
    }
    if session.footprints.is_empty() {
        session.footprints = seed_footprints(registry);
    }
    for runtime in &registry.runtimes {
        session.footprints.entry(runtime.id.clone()).or_insert_with(|| FootprintState {
            seed: runtime.footprint.clone(),
            observed: ObservedFootprint {
                calls: 0,
                failures: 0,
                avg_latency_ms: None,
                last_status: "unknown".to_string(),
                extra: Default::default(),
            },
            extra: Default::default(),
        });
    }
    if session.workflow.initialized_at.is_none() {
        session.workflow.initialized_at = Some(now_iso());
    }
    if session.boot.status.is_empty() {
        session.boot.status = "cold".to_string();
    }
    for skill in ["boot-loader", "hyperprotocol", "mode-lock"] {
        if !session.skills.iter().any(|existing| existing == skill) {
            session.skills.push(skill.to_string());
        }
    }
    if !session.mcp_mounts.iter().any(|existing| existing == "codec-docs") {
        session.mcp_mounts.push("codec-docs".to_string());
    }
}

pub fn create_session(base_dir: &Path, registry: &Registry, title: Option<String>) -> Result<SessionDoc> {
    storage::ensure_runtime_dirs(base_dir)?;
    let mut session = SessionDoc {
        id: next_session_id(),
        title: title.unwrap_or_else(|| "trasgo-session".to_string()),
        created_at: now_iso(),
        updated_at: now_iso(),
        active_runtime: None,
        messages: Vec::new(),
        boot_messages: Vec::new(),
        skills: vec!["boot-loader".to_string()],
        skill_state: SkillState {
            injected: Vec::new(),
            extra: Default::default(),
        },
        mcp_mounts: vec!["runtime-registry".to_string()],
        footprints: seed_footprints(registry),
        contract: default_contract(registry),
        history: Vec::new(),
        workflow: WorkflowState::default(),
        boot: BootState {
            status: "cold".to_string(),
            ..Default::default()
        },
        extra: Default::default(),
    };
    ensure_session_defaults(&mut session, registry);
    storage::save_session(base_dir, &session)?;
    Ok(session)
}

pub fn load_or_create_session(
    base_dir: &Path,
    registry: &Registry,
    session_id: Option<&str>,
    title: Option<String>,
) -> Result<SessionDoc> {
    let mut session = match session_id {
        Some(id) => storage::load_session(base_dir, id)?,
        None => create_session(base_dir, registry, title)?,
    };
    ensure_session_defaults(&mut session, registry);
    Ok(session)
}

pub fn save_session(base_dir: &Path, session: &SessionDoc) -> Result<()> {
    storage::save_session(base_dir, session)
}

pub fn session_state(session: &SessionDoc) -> Value {
    json!({
        "id": session.id,
        "title": session.title,
        "active_runtime": session.active_runtime,
        "skills": session.skills,
        "mcp_mounts": session.mcp_mounts,
        "contract": session.contract,
        "history_size": session.history.len(),
        "workflow": session.workflow,
        "boot": session.boot,
    })
}

fn observed_for(session: &SessionDoc, runtime_id: &str) -> ObservedFootprint {
    session
        .footprints
        .get(runtime_id)
        .map(|state| state.observed.clone())
        .unwrap_or_default()
}

fn effective_metric(seed: Option<f64>, observed: &ObservedFootprint, metric: &str) -> f64 {
    match metric {
        "stability" => {
            if observed.calls == 0 {
                0.7
            } else {
                (1.0 - observed.failures as f64 / observed.calls.max(1) as f64).max(0.05)
            }
        }
        _ => seed.unwrap_or(0.0),
    }
}

fn runtime_score(entry: &RuntimeEntry, contract: &Contract, observed: &ObservedFootprint) -> f64 {
    let mut score = 0.0;
    for (metric, weight) in &contract.priorities {
        score += effective_metric(entry.footprint.get(metric).copied(), observed, metric) * weight;
    }

    if contract.constraints.require_local && entry.kind != "local" {
        score -= 100.0;
    }
    if !contract.constraints.allow_cloud && entry.kind == "cloud" {
        score -= 100.0;
    }
    if let (Some(limit), Some(avg)) = (contract.constraints.max_latency_ms, observed.avg_latency_ms) {
        if avg > limit {
            score -= 5.0;
        }
    }
    score
}

pub fn route_decision(session: &SessionDoc, registry: &Registry) -> Result<RouteDecision> {
    let targets = if session.contract.targets.is_empty() {
        default_runtime_targets(registry)
    } else {
        session.contract.targets.clone()
    };

    let mut ranked = registry
        .runtimes
        .iter()
        .filter(|runtime| targets.iter().any(|target| target == &runtime.id))
        .map(|runtime| RouteRank {
            runtime: runtime.id.clone(),
            kind: runtime.kind.clone(),
            score: runtime_score(runtime, &session.contract, &observed_for(session, &runtime.id)),
            extra: Default::default(),
        })
        .collect::<Vec<_>>();

    ranked.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    if ranked.is_empty() {
        return Err(anyhow!("no runtimes available for current contract"));
    }

    let selected = if session.contract.mode == "parallel" {
        ranked.iter().take(2).cloned().collect()
    } else {
        ranked.iter().take(1).cloned().collect()
    };

    Ok(RouteDecision {
        mode: session.contract.mode.clone(),
        fallback: session.contract.fallback.clone(),
        ranked,
        selected,
        extra: Default::default(),
    })
}

pub fn update_observation(session: &mut SessionDoc, runtime_id: &str, ok: bool, latency_ms: Option<u64>) {
    if let Some(footprint) = session.footprints.get_mut(runtime_id) {
        footprint.observed.calls += 1;
        footprint.observed.last_status = if ok { "ok" } else { "error" }.to_string();
        if !ok {
            footprint.observed.failures += 1;
        }
        if let Some(latency_ms) = latency_ms {
            footprint.observed.avg_latency_ms = Some(match footprint.observed.avg_latency_ms {
                None => latency_ms,
                Some(existing) => {
                    ((existing * (footprint.observed.calls - 1)) + latency_ms) / footprint.observed.calls
                }
            });
        }
    }
}

fn attach_skill_if_missing(session: &mut SessionDoc, skill_id: &str) {
    if !session.skills.iter().any(|existing| existing == skill_id) {
        session.skills.push(skill_id.to_string());
    }
}

fn mount_mcp_if_missing(session: &mut SessionDoc, mcp_id: &str) {
    if !session.mcp_mounts.iter().any(|existing| existing == mcp_id) {
        session.mcp_mounts.push(mcp_id.to_string());
    }
}

pub fn balance_packet_for_session(session: &SessionDoc) -> Value {
    json!({
        "§P": "balance",
        "policy": session.contract.policy,
        "targets": session.contract.targets,
        "mode": session.contract.mode,
        "fallback": session.contract.fallback,
        "persist": session.contract.persist,
        "priorities": session.contract.priorities,
        "constraints": session.contract.constraints,
    })
}

pub fn parse_balance_packet(input: &str) -> Option<Value> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if value.get("§P").and_then(Value::as_str) == Some("balance") {
            return Some(value);
        }
    }
    if let Some(pos) = trimmed.find('{') {
        if trimmed.starts_with("§P|BALANCE") {
            if let Ok(value) = serde_json::from_str::<Value>(&trimmed[pos..]) {
                if value.get("§P").and_then(Value::as_str) == Some("balance") {
                    return Some(value);
                }
            }
        }
    }
    None
}

pub fn apply_balance_packet(session: &mut SessionDoc, packet: &Value) {
    if let Some(policy) = packet.get("policy").and_then(Value::as_str) {
        session.contract.policy = policy.to_string();
    }
    if let Some(mode) = packet.get("mode").and_then(Value::as_str) {
        session.contract.mode = mode.to_string();
    }
    if let Some(fallback) = packet.get("fallback").and_then(Value::as_str) {
        session.contract.fallback = fallback.to_string();
    }
    if let Some(persist) = packet.get("persist").and_then(Value::as_str) {
        session.contract.persist = persist.to_string();
    }
    if let Some(targets) = packet.get("targets").and_then(Value::as_array) {
        session.contract.targets = targets
            .iter()
            .filter_map(|target| target.as_str().map(|s| s.to_string()))
            .collect();
    }
    if let Some(priorities) = packet.get("priorities").and_then(Value::as_object) {
        for (key, value) in priorities {
            if let Some(weight) = value.as_f64() {
                session.contract.priorities.insert(key.clone(), weight);
            }
        }
    }
    if let Some(constraints) = packet.get("constraints").and_then(Value::as_object) {
        if let Some(value) = constraints.get("require_local").and_then(Value::as_bool) {
            session.contract.constraints.require_local = value;
        }
        if let Some(value) = constraints.get("allow_cloud").and_then(Value::as_bool) {
            session.contract.constraints.allow_cloud = value;
        }
        if let Some(value) = constraints.get("max_latency_ms").and_then(Value::as_u64) {
            session.contract.constraints.max_latency_ms = Some(value);
        }
    }
}

pub fn apply_route_options(session: &mut SessionDoc, options: &RouteOptions) {
    if let Some(title) = &options.title {
        session.title = title.clone();
    }
    if let Some(targets) = &options.targets {
        session.contract.targets = targets.clone();
    }
    if let Some(mode) = &options.mode {
        session.contract.mode = mode.clone();
    }
    if let Some(fallback) = &options.fallback {
        session.contract.fallback = fallback.clone();
    }
    if let Some(require_local) = options.require_local {
        session.contract.constraints.require_local = require_local;
    }
    if let Some(allow_cloud) = options.allow_cloud {
        session.contract.constraints.allow_cloud = allow_cloud;
    }
}

fn build_boot_messages(session: &SessionDoc, bundle: &PackBundle, decision: &RouteDecision) -> Vec<Message> {
    let mut messages = Vec::new();
    if let Some(boot) = &bundle.prompt.boot {
        messages.push(Message {
            role: "user".to_string(),
            content: boot.clone(),
            extra: Default::default(),
        });
    }
    messages.push(Message {
        role: "system".to_string(),
        content: format!(
            "Trasgo balance contract:\n{}",
            serde_json::to_string(&balance_packet_for_session(session)).unwrap_or_default()
        ),
        extra: Default::default(),
    });
    messages.push(Message {
        role: "system".to_string(),
        content: format!(
            "Trasgo broker decision:\n{}",
            serde_json::to_string(decision).unwrap_or_default()
        ),
        extra: Default::default(),
    });
    messages
}

fn attach_pack_contents(session: &mut SessionDoc, bundle: &PackBundle) {
    session.contract = bundle.contract.clone();
    for skill in &bundle.skills {
        attach_skill_if_missing(session, &skill.id);
    }
    for mcp in &bundle.mcp {
        mount_mcp_if_missing(session, &mcp.id);
    }
}

pub fn pack_session(
    base_dir: &Path,
    registry: &Registry,
    session: &mut SessionDoc,
    out_path: Option<&str>,
) -> Result<(PackBundle, String)> {
    ensure_session_defaults(session, registry);
    let created_at = now_iso();
    let skills = session
        .skills
        .iter()
        .filter_map(|skill_id| registry.skills.iter().find(|skill| &skill.id == skill_id))
        .map(|skill| PackSkill {
            id: skill.id.clone(),
            kind: skill.kind.clone(),
            entry: skill.entry.clone(),
            description: skill.description.clone(),
            content: std::fs::read_to_string(base_dir.join(&skill.entry)).unwrap_or_default(),
            extra: Default::default(),
        })
        .collect::<Vec<_>>();

    let mcp = session
        .mcp_mounts
        .iter()
        .filter_map(|mcp_id| registry.mcp.iter().find(|mcp| &mcp.id == mcp_id))
        .map(|mcp| PackMcp {
            id: mcp.id.clone(),
            transport: mcp.transport.clone(),
            root: mcp.root.clone(),
            resources: mcp.resources.clone(),
            description: mcp.description.clone(),
            extra: Default::default(),
        })
        .collect::<Vec<_>>();

    let boot_skill = registry.skills.iter().find(|skill| skill.id == "boot-loader");
    let balance = serde_json::to_value(&balance_packet_for_session(session))?;
    let bundle = PackBundle {
        kind: "trasgo-pack".to_string(),
        version: 1,
        created_at: created_at.clone(),
        session: PackSessionMeta {
            id: session.id.clone(),
            title: session.title.clone(),
            extra: Default::default(),
        },
        contract: session.contract.clone(),
        skills,
        mcp,
        prompt: PackPrompt {
            boot: boot_skill.map(|skill| std::fs::read_to_string(base_dir.join(&skill.entry)).unwrap_or_default()),
            balance,
            mcp_messages: vec![],
            extra: Default::default(),
        },
        extra: Default::default(),
    };

    let output_path = if let Some(path) = out_path {
        if Path::new(path).is_absolute() {
            path.to_string()
        } else {
            base_dir.join(path).to_string_lossy().to_string()
        }
    } else {
        storage::packs_dir(base_dir)
            .join(format!("{}.json", session.id))
            .to_string_lossy()
            .to_string()
    };

    storage::save_json(Path::new(&output_path), &bundle)?;
    session.workflow.last_pack_at = Some(created_at);
    session.workflow.last_pack_path = Some(output_path.clone());
    save_session(base_dir, session)?;
    Ok((bundle, output_path))
}

pub fn load_pack(base_dir: &Path, pack_path: &str) -> Result<PackBundle> {
    storage::load_pack(base_dir, pack_path)
}

pub fn boot_session(
    base_dir: &Path,
    registry: &Registry,
    session_id: Option<&str>,
    pack_path: Option<&str>,
    options: &RouteOptions,
) -> Result<(SessionDoc, PackBundle, RouteDecision, String)> {
    let mut session = load_or_create_session(base_dir, registry, session_id, options.title.clone())?;
    if let Some(title) = &options.title {
        session.title = title.clone();
    }

    let bundle = if let Some(path) = pack_path.or_else(|| session.workflow.last_pack_path.as_deref()) {
        let bundle = load_pack(base_dir, path)?;
        attach_pack_contents(&mut session, &bundle);
        bundle
    } else {
        let (bundle, _) = pack_session(base_dir, registry, &mut session, None)?;
        bundle
    };

    apply_route_options(&mut session, options);
    let decision = route_decision(&session, registry)?;
    session.active_runtime = decision.selected.first().map(|rank| rank.runtime.clone());
    session.boot.status = "booted".to_string();
    session.boot.booted_at = Some(now_iso());
    let active_pack = pack_path
        .map(|p| p.to_string())
        .or_else(|| session.workflow.last_pack_path.clone())
        .unwrap_or_default();
    session.boot.active_pack = Some(active_pack);
    session.boot.runtime = session.active_runtime.clone();
    session.workflow.last_boot_at = session.boot.booted_at.clone();
    session.skill_state.injected = session.skills.clone();
    session.boot_messages = build_boot_messages(&session, &bundle, &decision);
    save_session(base_dir, &session)?;
    let pack_record = session.boot.active_pack.clone().unwrap_or_default();
    Ok((session, bundle, decision, pack_record))
}

#[derive(Debug, Clone, Default)]
pub struct RouteOptions {
    pub title: Option<String>,
    pub targets: Option<Vec<String>>,
    pub mode: Option<String>,
    pub fallback: Option<String>,
    pub require_local: Option<bool>,
    pub allow_cloud: Option<bool>,
}
