use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Abstraction {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub layer: String,
    #[serde(default)]
    pub description: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuntimeEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub api: String,
    #[serde(default)]
    pub base_url: Option<String>,
    #[serde(default)]
    pub base_url_env: Option<String>,
    #[serde(default)]
    pub probe_path: Option<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub footprint: BTreeMap<String, f64>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub layer: String,
    #[serde(default)]
    pub runner: String,
    #[serde(default)]
    pub entry: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub description: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MachineStep {
    #[serde(default)]
    pub tool: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub passthrough: bool,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MachineEntry {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "type", default)]
    pub kind: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub steps: Vec<MachineStep>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub transport: String,
    #[serde(default)]
    pub root: String,
    #[serde(default)]
    pub resources: Vec<String>,
    #[serde(default)]
    pub description: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub entry: String,
    #[serde(default)]
    pub description: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Registry {
    #[serde(default)]
    pub abstraction: Option<Abstraction>,
    #[serde(default)]
    pub runtimes: Vec<RuntimeEntry>,
    #[serde(default)]
    pub tools: Vec<ToolEntry>,
    #[serde(default)]
    pub machines: Vec<MachineEntry>,
    #[serde(default)]
    pub mcp: Vec<McpEntry>,
    #[serde(default)]
    pub skills: Vec<SkillEntry>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Message {
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub content: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillState {
    #[serde(default)]
    pub injected: Vec<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ObservedFootprint {
    #[serde(default)]
    pub calls: u64,
    #[serde(default)]
    pub failures: u64,
    #[serde(default)]
    pub avg_latency_ms: Option<u64>,
    #[serde(default)]
    pub last_status: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FootprintState {
    #[serde(default)]
    pub seed: BTreeMap<String, f64>,
    #[serde(default)]
    pub observed: ObservedFootprint,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractConstraints {
    #[serde(default)]
    pub require_local: bool,
    #[serde(default = "default_allow_cloud")]
    pub allow_cloud: bool,
    #[serde(default)]
    pub max_latency_ms: Option<u64>,
}

impl Default for ContractConstraints {
    fn default() -> Self {
        Self {
            require_local: false,
            allow_cloud: true,
            max_latency_ms: None,
        }
    }
}

fn default_allow_cloud() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contract {
    #[serde(default = "default_policy")]
    pub policy: String,
    #[serde(default = "default_persist")]
    pub persist: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default = "default_fallback")]
    pub fallback: String,
    #[serde(default)]
    pub targets: Vec<String>,
    #[serde(default)]
    pub priorities: BTreeMap<String, f64>,
    #[serde(default)]
    pub constraints: ContractConstraints,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

impl Default for Contract {
    fn default() -> Self {
        Self {
            policy: default_policy(),
            persist: default_persist(),
            mode: default_mode(),
            fallback: default_fallback(),
            targets: Vec::new(),
            priorities: BTreeMap::new(),
            constraints: ContractConstraints::default(),
            extra: Map::new(),
        }
    }
}

fn default_policy() -> String {
    "manifested".to_string()
}

fn default_persist() -> String {
    "session".to_string()
}

fn default_mode() -> String {
    "single".to_string()
}

fn default_fallback() -> String {
    "handoff".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkflowState {
    #[serde(default)]
    pub initialized_at: Option<String>,
    #[serde(default)]
    pub last_pack_at: Option<String>,
    #[serde(default)]
    pub last_pack_path: Option<String>,
    #[serde(default)]
    pub last_boot_at: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BootState {
    #[serde(default = "default_cold")]
    pub status: String,
    #[serde(default)]
    pub booted_at: Option<String>,
    #[serde(default)]
    pub active_pack: Option<String>,
    #[serde(default)]
    pub runtime: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

fn default_cold() -> String {
    "cold".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Attempt {
    #[serde(default)]
    pub runtime: String,
    #[serde(default)]
    pub latency_ms: Option<u64>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HistoryEntry {
    #[serde(default)]
    pub at: String,
    #[serde(default)]
    pub input: String,
    #[serde(default)]
    pub selected_runtime: Option<String>,
    #[serde(default)]
    pub attempts: Vec<Attempt>,
    #[serde(default)]
    pub decision: Value,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionDoc {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub active_runtime: Option<String>,
    #[serde(default)]
    pub messages: Vec<Message>,
    #[serde(default)]
    pub boot_messages: Vec<Message>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub skill_state: SkillState,
    #[serde(default)]
    pub mcp_mounts: Vec<String>,
    #[serde(default)]
    pub footprints: BTreeMap<String, FootprintState>,
    #[serde(default)]
    pub contract: Contract,
    #[serde(default)]
    pub history: Vec<HistoryEntry>,
    #[serde(default)]
    pub workflow: WorkflowState,
    #[serde(default)]
    pub boot: BootState,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackSessionMeta {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackSkill {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub entry: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub content: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackMcp {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub transport: String,
    #[serde(default)]
    pub root: String,
    #[serde(default)]
    pub resources: Vec<String>,
    #[serde(default)]
    pub description: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackPrompt {
    #[serde(default)]
    pub boot: Option<String>,
    #[serde(default)]
    pub balance: Value,
    #[serde(default)]
    pub mcp_messages: Vec<Message>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackBundle {
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub session: PackSessionMeta,
    #[serde(default)]
    pub contract: Contract,
    #[serde(default)]
    pub skills: Vec<PackSkill>,
    #[serde(default)]
    pub mcp: Vec<PackMcp>,
    #[serde(default)]
    pub prompt: PackPrompt,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RouteRank {
    #[serde(default)]
    pub runtime: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub score: f64,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RouteDecision {
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub fallback: String,
    #[serde(default)]
    pub ranked: Vec<RouteRank>,
    #[serde(default)]
    pub selected: Vec<RouteRank>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}
