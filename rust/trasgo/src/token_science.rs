use anyhow::{anyhow, Context, Result};
use miktik::backend::huggingface::HuggingFaceBackend;
use miktik::backend::tiktoken::TiktokenBackend;
use miktik::tokenizer::AutoTokenizer;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const WINDOW_SPECS: [(&str, usize); 3] = [("4k", 4096), ("32k", 32768), ("128k", 131072)];

#[derive(Clone, Copy)]
enum BackendSpec {
    Tiktoken(&'static str),
    HuggingFaceJson(&'static str),
}

#[derive(Clone, Copy)]
struct FamilySpec {
    id: &'static str,
    family: &'static str,
    tokenizer: &'static str,
    backend_label: &'static str,
    backend: BackendSpec,
}

const FAMILY_SPECS: [FamilySpec; 6] = [
    FamilySpec {
        id: "openai-o200k",
        family: "OpenAI O200k",
        tokenizer: "gpt-4o",
        backend_label: "tiktoken",
        backend: BackendSpec::Tiktoken("gpt-4o"),
    },
    FamilySpec {
        id: "openai-cl100k",
        family: "OpenAI CL100k",
        tokenizer: "gpt-4",
        backend_label: "tiktoken",
        backend: BackendSpec::Tiktoken("gpt-4"),
    },
    FamilySpec {
        id: "llama3",
        family: "Llama 3",
        tokenizer: "Meta-Llama-3",
        backend_label: "huggingface-tokenizer",
        backend: BackendSpec::HuggingFaceJson("assets/tokenizers/llama3-tokenizer.json"),
    },
    FamilySpec {
        id: "gemma",
        family: "Gemma",
        tokenizer: "Gemma 2",
        backend_label: "huggingface-tokenizer",
        backend: BackendSpec::HuggingFaceJson("assets/tokenizers/gemma-tokenizer.json"),
    },
    FamilySpec {
        id: "deepseek",
        family: "DeepSeek",
        tokenizer: "DeepSeek-V3",
        backend_label: "huggingface-tokenizer",
        backend: BackendSpec::HuggingFaceJson("assets/tokenizers/deepseek-tokenizer.json"),
    },
    FamilySpec {
        id: "glm",
        family: "GLM",
        tokenizer: "GLM HF tokenizer",
        backend_label: "huggingface-tokenizer",
        backend: BackendSpec::HuggingFaceJson("assets/tokenizers/glm-tokenizer.json"),
    },
];

#[derive(Debug, Clone, Serialize)]
pub struct InputDescriptor {
    pub label: String,
    pub source_kind: String,
    pub content_kind: String,
    pub chars: usize,
    pub bytes: usize,
}

#[derive(Debug, Clone)]
pub struct ResolvedInput {
    descriptor: InputDescriptor,
    text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WindowOccupancy {
    pub codec: BTreeMap<String, f64>,
    pub natural: Option<BTreeMap<String, f64>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelReport {
    pub id: String,
    pub family: String,
    pub tokenizer: String,
    pub backend: String,
    pub codec_tokens: usize,
    pub natural_tokens: Option<usize>,
    pub compression_ratio: Option<f64>,
    pub window_occupancy: WindowOccupancy,
    pub effective_context_note: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RangeSummary {
    pub min: usize,
    pub max: usize,
    pub median: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FloatRangeSummary {
    pub min: f64,
    pub max: f64,
    pub median: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportSummary {
    pub codec_tokens: RangeSummary,
    pub natural_tokens: Option<RangeSummary>,
    pub compression_ratio: Option<FloatRangeSummary>,
    pub best_codec_family: String,
    pub worst_codec_family: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TokenReport {
    pub kind: String,
    pub codec_input: InputDescriptor,
    pub natural_input: Option<InputDescriptor>,
    pub models: Vec<ModelReport>,
    pub summary: ReportSummary,
}

#[derive(Debug, Clone)]
pub struct ReportRequest {
    pub base_dir: PathBuf,
    pub codec: String,
    pub natural: Option<String>,
    pub models: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CandidateReport {
    pub id: String,
    pub description: String,
    pub replacements: Vec<String>,
    pub transformed_codec: String,
    pub report: TokenReport,
    pub delta_vs_baseline: Vec<ModelDelta>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelDelta {
    pub id: String,
    pub codec_token_delta: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct OptimizeReport {
    pub kind: String,
    pub baseline: TokenReport,
    pub candidates: Vec<CandidateReport>,
    pub recommended: CandidateReport,
}

#[derive(Debug, Clone)]
pub struct OptimizeRequest {
    pub base_dir: PathBuf,
    pub codec: String,
    pub models: String,
}

struct LoadedFamily {
    spec: FamilySpec,
    tokenizer: Box<dyn AutoTokenizer>,
}

pub struct TokenScienceEngine {
    models: Vec<LoadedFamily>,
}

impl TokenScienceEngine {
    pub fn new(crate_root: &Path, requested_models: &[String]) -> Result<Self> {
        let selected = select_family_specs(requested_models)?;
        let models = selected
            .into_iter()
            .map(|spec| {
                Ok(LoadedFamily {
                    spec,
                    tokenizer: load_backend(crate_root, spec)?,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(Self { models })
    }

    pub fn analyze(&self, codec: ResolvedInput, natural: Option<ResolvedInput>) -> Result<TokenReport> {
        let mut models = Vec::with_capacity(self.models.len());
        for family in &self.models {
            let codec_tokens = family
                .tokenizer
                .count_tokens(&codec.text)
                .with_context(|| format!("count codec tokens for {}", family.spec.id))?;
            let natural_tokens = natural
                .as_ref()
                .map(|input| {
                    family
                        .tokenizer
                        .count_tokens(&input.text)
                        .with_context(|| format!("count natural tokens for {}", family.spec.id))
                })
                .transpose()?;
            models.push(build_model_report(family.spec, codec_tokens, natural_tokens));
        }

        let summary = build_report_summary(&models)?;
        Ok(TokenReport {
            kind: "trasgo-token-report".to_string(),
            codec_input: codec.descriptor,
            natural_input: natural.map(|input| input.descriptor),
            models,
            summary,
        })
    }

    pub fn optimize(&self, codec: ResolvedInput) -> Result<OptimizeReport> {
        let baseline = self.analyze(codec.clone(), None)?;
        let candidates = optimization_candidates(&codec.text)
            .into_iter()
            .map(|candidate| {
                let transformed_input = ResolvedInput {
                    descriptor: codec.descriptor.clone(),
                    text: candidate.transformed.clone(),
                };
                let report = self.analyze(transformed_input, None)?;
                let delta_vs_baseline = report
                    .models
                    .iter()
                    .zip(baseline.models.iter())
                    .map(|(current, baseline_model)| ModelDelta {
                        id: current.id.clone(),
                        codec_token_delta: current.codec_tokens as i64 - baseline_model.codec_tokens as i64,
                    })
                    .collect::<Vec<_>>();
                Ok(CandidateReport {
                    id: candidate.id,
                    description: candidate.description,
                    replacements: candidate.replacements,
                    transformed_codec: candidate.transformed,
                    report,
                    delta_vs_baseline,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        let recommended = candidates
            .iter()
            .min_by(|lhs, rhs| {
                lhs.report
                    .summary
                    .codec_tokens
                    .median
                    .partial_cmp(&rhs.report.summary.codec_tokens.median)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .cloned()
            .ok_or_else(|| anyhow!("no optimization candidates produced"))?;

        Ok(OptimizeReport {
            kind: "trasgo-token-optimization".to_string(),
            baseline,
            candidates,
            recommended,
        })
    }
}

#[derive(Clone)]
struct CandidateSeed {
    id: String,
    description: String,
    replacements: Vec<String>,
    transformed: String,
}

fn optimization_candidates(codec: &str) -> Vec<CandidateSeed> {
    let replacements = [
        ("section-ascii", "Replace § with S1", vec![("§", "S1")]),
        ("delta-ascii", "Replace Δ with D", vec![("Δ", "D")]),
        ("mu-ascii", "Replace μ with mu", vec![("μ", "mu")]),
        ("arrow-ascii", "Replace Unicode arrow with ->", vec![("→", "->")]),
        (
            "ascii-core",
            "Apply the full ASCII alias core",
            vec![("§", "S1"), ("Δ", "D"), ("μ", "mu"), ("→", "->")],
        ),
    ];

    let mut seeds = Vec::new();
    for (id, description, ops) in replacements {
        let mut transformed = codec.to_string();
        let mut applied = Vec::new();
        for (from, to) in ops {
            if transformed.contains(from) {
                transformed = transformed.replace(from, to);
                applied.push(format!("{from} -> {to}"));
            }
        }
        if !applied.is_empty() && transformed != codec {
            seeds.push(CandidateSeed {
                id: id.to_string(),
                description: description.to_string(),
                replacements: applied,
                transformed,
            });
        }
    }

    if seeds.is_empty() {
        seeds.push(CandidateSeed {
            id: "baseline".to_string(),
            description: "No ASCII replacements were applicable.".to_string(),
            replacements: vec![],
            transformed: codec.to_string(),
        });
    }

    seeds
}

fn select_family_specs(requested_models: &[String]) -> Result<Vec<FamilySpec>> {
    if requested_models.is_empty() || requested_models.iter().any(|id| id == "all") {
        return Ok(FAMILY_SPECS.to_vec());
    }

    requested_models
        .iter()
        .map(|requested| {
            normalize_family_id(requested)
                .and_then(|normalized| FAMILY_SPECS.iter().copied().find(|spec| spec.id == normalized))
                .ok_or_else(|| anyhow!("unknown tokenizer family: {requested}"))
        })
        .collect()
}

fn normalize_family_id(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "openai-o200k" | "o200k" | "gpt-4o" => Some("openai-o200k"),
        "openai-cl100k" | "cl100k" | "gpt-4" => Some("openai-cl100k"),
        "llama3" | "llama-3" | "meta-llama-3" => Some("llama3"),
        "gemma" | "gemini" => Some("gemma"),
        "deepseek" => Some("deepseek"),
        "glm" | "glm-5" => Some("glm"),
        "all" => Some("all"),
        _ => None,
    }
}

fn load_backend(crate_root: &Path, spec: FamilySpec) -> Result<Box<dyn AutoTokenizer>> {
    match spec.backend {
        BackendSpec::Tiktoken(model) => Ok(Box::new(TiktokenBackend::from_model(model)?)),
        BackendSpec::HuggingFaceJson(asset) => {
            let path = crate_root.join(asset);
            Ok(Box::new(HuggingFaceBackend::from_file(&path).with_context(|| {
                format!("load HuggingFace tokenizer for {} from {}", spec.id, path.display())
            })?))
        }
    }
}

fn build_model_report(spec: FamilySpec, codec_tokens: usize, natural_tokens: Option<usize>) -> ModelReport {
    let codec = occupancy(codec_tokens);
    let natural = natural_tokens.map(occupancy);
    ModelReport {
        id: spec.id.to_string(),
        family: spec.family.to_string(),
        tokenizer: spec.tokenizer.to_string(),
        backend: spec.backend_label.to_string(),
        codec_tokens,
        natural_tokens,
        compression_ratio: natural_tokens.map(|count| round2(count as f64 / codec_tokens.max(1) as f64)),
        window_occupancy: WindowOccupancy { codec, natural },
        effective_context_note: effective_context_note(codec_tokens, natural_tokens),
    }
}

fn occupancy(tokens: usize) -> BTreeMap<String, f64> {
    WINDOW_SPECS
        .into_iter()
        .map(|(label, window)| (label.to_string(), round4(tokens as f64 / window as f64)))
        .collect()
}

fn effective_context_note(codec_tokens: usize, natural_tokens: Option<usize>) -> String {
    match natural_tokens {
        Some(natural) if natural > 4096 && codec_tokens <= 4096 => {
            "Compression moves the packet under a 4K nominal window, but effective context still depends on retrieval quality, ordering, and lost-in-the-middle effects.".to_string()
        }
        Some(natural) if natural > 32768 && codec_tokens <= 32768 => {
            "Compression moves the packet under a 32K nominal window, but large-context reasoning still faces effective-capacity decay across long spans.".to_string()
        }
        _ if codec_tokens > 4096 => {
            "Codec payload still exceeds 4K nominal context, so compression helps without removing position-sensitive degradation risk.".to_string()
        }
        _ => {
            "Nominal fit is not effective fit: context remains a sequential computational substrate, so retrieval quality and token position still matter.".to_string()
        }
    }
}

fn build_report_summary(models: &[ModelReport]) -> Result<ReportSummary> {
    let codec_values = models.iter().map(|entry| entry.codec_tokens).collect::<Vec<_>>();
    let codec_tokens = summarize_usize(&codec_values)?;

    let natural_values = models
        .iter()
        .filter_map(|entry| entry.natural_tokens)
        .collect::<Vec<_>>();
    let natural_tokens = if natural_values.is_empty() {
        None
    } else {
        Some(summarize_usize(&natural_values)?)
    };

    let compression_values = models
        .iter()
        .filter_map(|entry| entry.compression_ratio)
        .collect::<Vec<_>>();
    let compression_ratio = if compression_values.is_empty() {
        None
    } else {
        Some(summarize_f64(&compression_values)?)
    };

    let best_codec_family = models
        .iter()
        .min_by_key(|entry| entry.codec_tokens)
        .map(|entry| entry.id.clone())
        .ok_or_else(|| anyhow!("no model reports available"))?;
    let worst_codec_family = models
        .iter()
        .max_by_key(|entry| entry.codec_tokens)
        .map(|entry| entry.id.clone())
        .ok_or_else(|| anyhow!("no model reports available"))?;

    Ok(ReportSummary {
        codec_tokens,
        natural_tokens,
        compression_ratio,
        best_codec_family,
        worst_codec_family,
    })
}

fn summarize_usize(values: &[usize]) -> Result<RangeSummary> {
    if values.is_empty() {
        return Err(anyhow!("cannot summarize an empty value set"));
    }
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    let min = *sorted.first().unwrap_or(&0);
    let max = *sorted.last().unwrap_or(&0);
    Ok(RangeSummary {
        min,
        max,
        median: median_usize(&sorted),
    })
}

fn summarize_f64(values: &[f64]) -> Result<FloatRangeSummary> {
    if values.is_empty() {
        return Err(anyhow!("cannot summarize an empty value set"));
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|lhs, rhs| lhs.partial_cmp(rhs).unwrap_or(std::cmp::Ordering::Equal));
    let min = *sorted.first().unwrap_or(&0.0);
    let max = *sorted.last().unwrap_or(&0.0);
    Ok(FloatRangeSummary {
        min: round2(min),
        max: round2(max),
        median: round2(median_f64(&sorted)),
    })
}

fn median_usize(sorted: &[usize]) -> f64 {
    if sorted.len() % 2 == 1 {
        sorted[sorted.len() / 2] as f64
    } else {
        let upper = sorted.len() / 2;
        (sorted[upper - 1] as f64 + sorted[upper] as f64) / 2.0
    }
}

fn median_f64(sorted: &[f64]) -> f64 {
    if sorted.len() % 2 == 1 {
        sorted[sorted.len() / 2]
    } else {
        let upper = sorted.len() / 2;
        (sorted[upper - 1] + sorted[upper]) / 2.0
    }
}

fn round2(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn round4(value: f64) -> f64 {
    (value * 10000.0).round() / 10000.0
}

pub fn build_report(request: ReportRequest) -> Result<TokenReport> {
    let engine =
        TokenScienceEngine::new(&crate_root_from_repo(&request.base_dir), &parse_model_list(&request.models))?;
    let codec = resolve_input(&request.codec, "codec")?;
    let natural = request
        .natural
        .as_deref()
        .map(|value| resolve_input(value, "natural"))
        .transpose()?;
    engine.analyze(codec, natural)
}

pub fn build_optimization_report(request: OptimizeRequest) -> Result<OptimizeReport> {
    let engine =
        TokenScienceEngine::new(&crate_root_from_repo(&request.base_dir), &parse_model_list(&request.models))?;
    let codec = resolve_input(&request.codec, "codec")?;
    engine.optimize(codec)
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

pub fn resolve_input(raw: &str, label: &str) -> Result<ResolvedInput> {
    let path = PathBuf::from(raw);
    let (source_kind, raw_text) = if path.exists() {
        (
            "file".to_string(),
            fs::read_to_string(&path).with_context(|| format!("read {}", path.display()))?,
        )
    } else {
        ("inline".to_string(), raw.to_string())
    };

    let (content_kind, text) = canonicalize_content(&raw_text)?;
    Ok(ResolvedInput {
        descriptor: InputDescriptor {
            label: label.to_string(),
            source_kind,
            content_kind,
            chars: text.chars().count(),
            bytes: text.as_bytes().len(),
        },
        text,
    })
}

fn canonicalize_content(raw: &str) -> Result<(String, String)> {
    match serde_json::from_str::<Value>(raw) {
        Ok(value) => Ok(("json".to_string(), serde_json::to_string(&value)?)),
        Err(_) => Ok(("text".to_string(), raw.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn optimize_candidates_apply_ascii_aliases() {
        let seeds = optimization_candidates(r#"{"§":1,"Δ":["A→B"],"μ":{"urg":0.8}}"#);
        assert!(seeds.iter().any(|candidate| candidate.id == "ascii-core"));
        let ascii = seeds
            .iter()
            .find(|candidate| candidate.id == "ascii-core")
            .expect("ascii-core candidate should exist");
        assert!(ascii.transformed.contains("S1"));
        assert!(ascii.transformed.contains("\"D\""));
        assert!(ascii.transformed.contains("->"));
        assert!(ascii.transformed.contains("\"mu\""));
    }

    #[test]
    fn resolve_input_compacts_json() {
        let resolved = resolve_input("{\n  \"a\": 1\n}", "codec").expect("json should resolve");
        assert_eq!(resolved.descriptor.content_kind, "json");
        assert_eq!(resolved.text, "{\"a\":1}");
    }

    #[test]
    fn summarize_even_median() {
        let summary = summarize_usize(&[10, 20, 30, 40]).expect("summary should succeed");
        assert_eq!(summary.median, 25.0);
    }
}
