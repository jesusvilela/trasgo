use crate::legacy;
use crate::models::*;
use crate::runtime;
use crate::storage;
use crate::token_science::{self, TokenScienceEngine};
use anyhow::{anyhow, Context, Result};
use clap::{Args, Parser, Subcommand};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

#[derive(Parser, Debug)]
#[command(name = "trasgo", version, about = "Trasgo Rust runtime skeleton")]
struct Cli {
    #[arg(long, global = true)]
    repo_root: Option<PathBuf>,
    #[arg(long, global = true)]
    session: Option<String>,
    #[arg(long, global = true)]
    json: bool,
    #[arg(long, global = true, default_value = "native")]
    backend: String,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Clone)]
struct CliFlags {
    session: Option<String>,
    json: bool,
    backend: String,
}

#[derive(Subcommand, Debug)]
enum Commands {
    Hello(HelloArgs),
    Ask(AskArgs),
    Load(LoadArgs),
    Explain(ExplainArgs),
    Route(RouteArgs),
    Prove(ProveArgs),
    Tokens(TokenArgs),
    Optimize(OptimizeArgs),
    Passthrough(PassthroughArgs),
    #[command(external_subcommand)]
    External(Vec<String>),
}

#[derive(Args, Debug, Default)]
struct HelloArgs {
    #[arg(long)]
    title: Option<String>,
}

#[derive(Args, Debug)]
struct AskArgs {
    #[arg(long)]
    title: Option<String>,
    #[arg(required = true)]
    prompt: Vec<String>,
}

#[derive(Args, Debug)]
struct LoadArgs {
    #[arg(required = true)]
    source: String,
}

#[derive(Args, Debug)]
struct ExplainArgs {
    #[arg(required = true)]
    input: String,
}

#[derive(Subcommand, Debug)]
enum RouteSubcommand {
    Show,
    Set(RouteSetArgs),
}

#[derive(Args, Debug, Default)]
struct RouteSetArgs {
    #[arg(long)]
    title: Option<String>,
    #[arg(long)]
    targets: Option<String>,
    #[arg(long)]
    mode: Option<String>,
    #[arg(long)]
    fallback: Option<String>,
    #[arg(long)]
    require_local: bool,
    #[arg(long)]
    allow_cloud: bool,
    #[arg(long)]
    deny_cloud: bool,
}

#[derive(Args, Debug)]
struct RouteArgs {
    #[command(subcommand)]
    command: RouteSubcommand,
}

#[derive(Args, Debug, Default)]
struct ProveArgs {
    #[arg(long)]
    title: Option<String>,
}

#[derive(Args, Debug, Default)]
struct TokenArgs {
    #[arg(long)]
    codec: String,
    #[arg(long)]
    natural: Option<String>,
    #[arg(long, default_value = "all")]
    models: String,
}

#[derive(Args, Debug)]
struct OptimizeArgs {
    #[arg(long)]
    codec: String,
    #[arg(long, default_value = "all")]
    models: String,
}

#[derive(Args, Debug)]
struct PassthroughArgs {
    #[arg(required = true)]
    args: Vec<String>,
}

pub fn run() -> Result<()> {
    let cli = Cli::parse();
    let flags = CliFlags {
        session: cli.session.clone(),
        json: cli.json,
        backend: cli.backend.clone(),
    };
    let base_dir = match cli.repo_root {
        Some(ref path) => path.clone(),
        None => storage::discover_repo_root()?,
    };
    let registry = storage::load_registry(&base_dir)?;

    match cli.command {
        Commands::Hello(args) => run_hello(&base_dir, &registry, &flags, args),
        Commands::Ask(args) => run_ask(&base_dir, &registry, &flags, args),
        Commands::Load(args) => run_load(&base_dir, &registry, &flags, args),
        Commands::Explain(args) => run_explain(&base_dir, &registry, &flags, args),
        Commands::Route(args) => run_route(&base_dir, &registry, &flags, args),
        Commands::Prove(args) => run_prove(&base_dir, &registry, &flags, args),
        Commands::Tokens(args) => run_tokens(&base_dir, &flags, args),
        Commands::Optimize(args) => run_optimize(&base_dir, &flags, args),
        Commands::Passthrough(args) => {
            let mut full_args = Vec::new();
            if flags.json { full_args.push("--json".to_string()); }
            if let Some(session) = &flags.session {
                full_args.push("--session".to_string());
                full_args.push(session.clone());
            }
            if let Some(repo) = &cli.repo_root {
                full_args.push("--repo-root".to_string());
                full_args.push(repo.to_string_lossy().into_owned());
            }
            if cli.backend != "native" {
                full_args.push("--backend".to_string());
                full_args.push(cli.backend.clone());
            }
            full_args.extend(args.args.clone());
            let code = legacy::passthrough(&base_dir, &full_args)?;
            std::process::exit(code);
        }
        Commands::External(args) => {
            let mut full_args = Vec::new();
            if flags.json { full_args.push("--json".to_string()); }
            if let Some(session) = &flags.session {
                full_args.push("--session".to_string());
                full_args.push(session.clone());
            }
            if let Some(repo) = &cli.repo_root {
                full_args.push("--repo-root".to_string());
                full_args.push(repo.to_string_lossy().into_owned());
            }
            if cli.backend != "native" {
                full_args.push("--backend".to_string());
                full_args.push(cli.backend.clone());
            }
            full_args.extend(args.clone());
            let code = legacy::passthrough(&base_dir, &full_args)?;
            std::process::exit(code);
        }
    }
}

fn load_session_for_cli(
    base_dir: &Path,
    registry: &Registry,
    flags: &CliFlags,
    title: Option<String>,
) -> Result<SessionDoc> {
    let mut session = runtime::load_or_create_session(base_dir, registry, flags.session.as_deref(), title)?;
    runtime::ensure_session_defaults(&mut session, registry);
    Ok(session)
}

fn print_json(value: &Value) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(value)?);
    Ok(())
}

fn print_plain(line: &str) {
    println!("{line}");
}

fn current_route_summary(session: &SessionDoc, registry: &Registry) -> Result<Value> {
    let decision = runtime::route_decision(session, registry)?;
    Ok(json!({
        "session": runtime::session_state(session),
        "decision": decision,
    }))
}

fn canonical_hello_packet(kind: &str, route: &str, output: &str) -> String {
    json!({
        "§": 1,
        "E": {
            "H": ["hello-world", "program"],
            "U": ["operator", "person"],
            "T": ["trasgo-runtime", "system"]
        },
        "S": {
            "H.kind": kind,
            "H.output": output,
            "T.mode": "booted",
            "T.route": route
        },
        "R": ["U→T:operates", "T→H:runs"],
        "Δ": [
            "T.state:initialized→booted@2026-03-29",
            format!("H.output:unset→{}@2026-03-29", output)
        ],
        "μ": {
            "scope": "runtime",
            "urg": 0.2,
            "cert": 0.99
        }
    })
    .to_string()
}

fn backend_or_legacy(flags: &CliFlags) -> bool {
    flags.backend == "legacy" || flags.backend == "auto"
}

fn passthrough_packet(base_dir: &Path, _flags: &CliFlags, session_id: &str, packet: &str) -> Result<()> {
    let args = vec![
        "--session".to_string(),
        session_id.to_string(),
        "send".to_string(),
        packet.to_string(),
    ];
    let code = legacy::passthrough(base_dir, &args)?;
    if code != 0 {
        return Err(anyhow!("legacy passthrough failed with exit code {}", code));
    }
    Ok(())
}

fn run_hello(base_dir: &Path, registry: &Registry, flags: &CliFlags, args: HelloArgs) -> Result<()> {
    let mut session = load_session_for_cli(base_dir, registry, flags, args.title.clone())?;
    runtime::apply_route_options(
        &mut session,
        &runtime::RouteOptions {
            title: args.title,
            ..Default::default()
        },
    );
    runtime::save_session(base_dir, &session)?;

    let decision = runtime::route_decision(&session, registry)?;
    let route = decision
        .selected
        .first()
        .map(|r| r.runtime.as_str())
        .unwrap_or("unknown");
    let output = "Hello, Operator! Welcome to Trasgo.";
    let packet = canonical_hello_packet("hello", route, output);

    if backend_or_legacy(flags) && !flags.json {
        passthrough_packet(base_dir, flags, &session.id, &packet)?;
        return Ok(());
    }

    if flags.json {
        print_json(&json!({
            "session": runtime::session_state(&session),
            "packet": packet,
            "route": decision,
            "output": output,
        }))?;
    } else {
        print_plain(output);
    }
    Ok(())
}

fn run_ask(base_dir: &Path, registry: &Registry, flags: &CliFlags, args: AskArgs) -> Result<()> {
    let session = load_session_for_cli(base_dir, registry, flags, args.title.clone())?;
    let prompt = args.prompt.join(" ");
    let decision = runtime::route_decision(&session, registry)?;
    let route = decision
        .selected
        .first()
        .map(|r| r.runtime.as_str())
        .unwrap_or("unknown");
    let packet = json!({
        "§": 1,
        "E": {
            "Q": ["prompt", "query"],
            "U": ["operator", "person"]
        },
        "S": {
            "Q.text": prompt,
            "T.route": route
        },
        "R": ["U→Q:asks"],
        "Δ": [format!("Q.text:unset→{}@{}", prompt, runtime::now_iso())],
        "μ": {
            "scope": "runtime",
            "urg": 0.5,
            "cert": 0.95
        }
    })
    .to_string();

    if backend_or_legacy(flags) && !flags.json {
        passthrough_packet(base_dir, flags, &session.id, &packet)?;
        return Ok(());
    }

    if flags.json {
        print_json(&json!({
            "session": runtime::session_state(&session),
            "route": decision,
            "prompt": prompt,
            "packet": packet,
        }))?;
    } else {
        print_plain(&format!("Trasgo would ask: {prompt}"));
    }
    Ok(())
}

fn run_load(base_dir: &Path, registry: &Registry, flags: &CliFlags, args: LoadArgs) -> Result<()> {
    let mut session = load_session_for_cli(base_dir, registry, flags, None)?;
    let source_path = PathBuf::from(&args.source);
    let text = if source_path.exists() {
        std::fs::read_to_string(&source_path).with_context(|| format!("read {}", source_path.display()))?
    } else {
        args.source.clone()
    };

    if let Ok(value) = serde_json::from_str::<Value>(&text) {
        if value.get("§P").and_then(Value::as_str) == Some("balance") {
            runtime::apply_balance_packet(&mut session, &value);
        } else {
            session.messages.push(Message {
                role: "user".to_string(),
                content: value.to_string(),
                extra: Default::default(),
            });
        }
    } else if let Some(mcp) = registry.mcp.iter().find(|mcp| mcp.id == text) {
        if !session.mcp_mounts.iter().any(|entry| entry == &mcp.id) {
            session.mcp_mounts.push(mcp.id.clone());
        }
    } else {
        session.messages.push(Message {
            role: "user".to_string(),
            content: text.clone(),
            extra: Default::default(),
        });
    }

    runtime::save_session(base_dir, &session)?;
    if flags.json {
        print_json(&json!({
            "session": runtime::session_state(&session),
            "loaded": args.source,
        }))?;
    } else {
        print_plain(&format!("loaded into session {}", session.id));
    }
    Ok(())
}

fn explain_value(value: &Value) -> Value {
    match value {
        Value::Object(map) => json!({
            "kind": "object",
            "keys": map.keys().cloned().collect::<Vec<_>>(),
        }),
        Value::Array(array) => json!({
            "kind": "array",
            "len": array.len(),
        }),
        Value::String(text) => json!({
            "kind": "string",
            "len": text.len(),
        }),
        _ => json!({
            "kind": "scalar",
            "value": value,
        }),
    }
}

fn run_explain(_base_dir: &Path, _registry: &Registry, flags: &CliFlags, args: ExplainArgs) -> Result<()> {
    let path = PathBuf::from(&args.input);
    let value = if path.exists() {
        let text = std::fs::read_to_string(&path).with_context(|| format!("read {}", path.display()))?;
        serde_json::from_str::<Value>(&text).unwrap_or_else(|_| json!({"text": text}))
    } else {
        serde_json::from_str::<Value>(&args.input).unwrap_or_else(|_| json!({"text": args.input}))
    };

    let explanation = if value.get("kind").and_then(Value::as_str) == Some("trasgo-pack") {
        json!({
            "summary": "Trasgo pack bundle",
            "session": value.get("session"),
            "contract": value.get("contract"),
            "skills": value.get("skills").and_then(Value::as_array).map(|items| items.len()).unwrap_or(0),
            "mcp": value.get("mcp").and_then(Value::as_array).map(|items| items.len()).unwrap_or(0),
        })
    } else {
        explain_value(&value)
    };

    if flags.json {
        print_json(&explanation)?;
    } else {
        print_plain(&serde_json::to_string_pretty(&explanation)?);
    }
    Ok(())
}

fn run_route(base_dir: &Path, registry: &Registry, flags: &CliFlags, args: RouteArgs) -> Result<()> {
    let mut session = load_session_for_cli(base_dir, registry, flags, None)?;
    match args.command {
        RouteSubcommand::Show => {
            let summary = current_route_summary(&session, registry)?;
            if flags.json {
                print_json(&summary)?;
            } else {
                print_plain(&serde_json::to_string_pretty(&summary)?);
            }
        }
        RouteSubcommand::Set(set) => {
            let options = runtime::RouteOptions {
                title: set.title.clone(),
                targets: set.targets.as_ref().map(|value| {
                    value
                        .split(',')
                        .map(|part| part.trim().to_string())
                        .filter(|part| !part.is_empty())
                        .collect::<Vec<_>>()
                }),
                mode: set.mode.clone(),
                fallback: set.fallback.clone(),
                require_local: if set.require_local { Some(true) } else { None },
                allow_cloud: if set.deny_cloud {
                    Some(false)
                } else if set.allow_cloud {
                    Some(true)
                } else {
                    None
                },
            };
            runtime::apply_route_options(&mut session, &options);
            runtime::save_session(base_dir, &session)?;
            if flags.json {
                print_json(&runtime::session_state(&session))?;
            } else {
                print_plain(&format!("updated route for session {}", session.id));
            }
        }
    }
    Ok(())
}

fn run_prove(base_dir: &Path, registry: &Registry, flags: &CliFlags, args: ProveArgs) -> Result<()> {
    let mut session = load_session_for_cli(base_dir, registry, flags, args.title.clone())?;
    let _ = runtime::pack_session(base_dir, registry, &mut session, None)?;
    let decision = runtime::route_decision(&session, registry)?;
    let route = decision
        .selected
        .first()
        .map(|r| r.runtime.as_str())
        .unwrap_or("unknown");
    let packet = canonical_hello_packet(
        "prove",
        route,
        "Hello, Operator! Welcome to Trasgo runtime proof.",
    );
    if backend_or_legacy(flags) && !flags.json {
        passthrough_packet(base_dir, flags, &session.id, &packet)?;
        return Ok(());
    }
    if flags.json {
        print_json(&json!({
            "session": runtime::session_state(&session),
            "route": decision,
            "packet": packet,
        }))?;
    } else {
        print_plain("Trasgo proof generated");
    }
    Ok(())
}

fn parse_model_list(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|part| part.trim().to_string())
        .filter(|part| !part.is_empty())
        .collect()
}

fn crate_root_from_repo(base_dir: &Path) -> PathBuf {
    base_dir.join("rust").join("trasgo")
}

fn run_tokens(base_dir: &Path, flags: &CliFlags, args: TokenArgs) -> Result<()> {
    let engine = TokenScienceEngine::new(&crate_root_from_repo(base_dir), &parse_model_list(&args.models))?;
    let codec = token_science::resolve_input(&args.codec, "codec")?;
    let natural = args
        .natural
        .as_deref()
        .map(|value| token_science::resolve_input(value, "natural"))
        .transpose()?;
    let report = engine.analyze(codec, natural)?;
    if flags.json {
        print_json(&serde_json::to_value(report)?)?;
    } else {
        print_plain(&serde_json::to_string_pretty(&report)?);
    }
    Ok(())
}

fn run_optimize(base_dir: &Path, flags: &CliFlags, args: OptimizeArgs) -> Result<()> {
    let engine = TokenScienceEngine::new(&crate_root_from_repo(base_dir), &parse_model_list(&args.models))?;
    let codec = token_science::resolve_input(&args.codec, "codec")?;
    let report = engine.optimize(codec)?;
    if flags.json {
        print_json(&serde_json::to_value(report)?)?;
    } else {
        print_plain(&serde_json::to_string_pretty(&report)?);
    }
    Ok(())
}
