export function headersForRuntime(runtimeEntry) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (runtimeEntry.api_key_env && process.env[runtimeEntry.api_key_env]) {
    headers.Authorization = `Bearer ${process.env[runtimeEntry.api_key_env]}`;
  }

  return headers;
}

function timeoutMs(runtimeEntry, kind = 'chat') {
  const specificKey = kind === 'discover'
    ? 'TRASGO_MODEL_DISCOVERY_TIMEOUT_MS'
    : 'TRASGO_REQUEST_TIMEOUT_MS';
  const raw = process.env[specificKey] || process.env.TRASGO_FETCH_TIMEOUT_MS || runtimeEntry.timeout_ms;
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return kind === 'discover' ? 4000 : 12000;
}

async function fetchWithTimeout(runtimeEntry, pathName, options = {}, kind = 'chat') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs(runtimeEntry, kind));
  try {
    return await fetch(endpointForRuntime(runtimeEntry, pathName), {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${runtimeEntry.id} ${kind} timed out after ${timeoutMs(runtimeEntry, kind)}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function endpointForRuntime(runtimeEntry, pathName) {
  const baseUrl = runtimeEntry.resolved_base_url || runtimeEntry.base_url;
  if (!baseUrl) {
    throw new Error(`runtime ${runtimeEntry.id} has no base URL`);
  }

  return `${baseUrl.replace(/\/$/, '')}${pathName}`;
}

export async function discoverModel(runtimeEntry) {
  if (runtimeEntry.model) {
    return runtimeEntry.model;
  }

  const response = await fetchWithTimeout(runtimeEntry, '/models', {
    method: 'GET',
    headers: headersForRuntime(runtimeEntry),
  }, 'discover');

  if (!response.ok) {
    throw new Error(`model discovery failed for ${runtimeEntry.id}: HTTP ${response.status}`);
  }

  const data = await response.json();
  const model = data?.data?.[0]?.id;
  if (!model) {
    throw new Error(`no model available for ${runtimeEntry.id}`);
  }

  return model;
}

export async function chatCompletion(runtimeEntry, messages, options = {}) {
  const model = options.model || await discoverModel(runtimeEntry);
  const start = Date.now();
  const payload = {
    model,
    messages,
  };

  const isO1 = model.includes('o1') || model.includes('o3');
  const isGpt5 = model.includes('gpt-5');

  if (isO1) {
    payload.max_completion_tokens = options.maxTokens ?? 1500;
  } else if (isGpt5) {
    payload.temperature = options.temperature ?? 0.3;
    payload.max_completion_tokens = options.maxTokens ?? 1500;
  } else {
    payload.temperature = options.temperature ?? 0.3;
    payload.max_tokens = options.maxTokens ?? 1500;
  }

  const response = await fetchWithTimeout(runtimeEntry, '/chat/completions', {
    method: 'POST',
    headers: headersForRuntime(runtimeEntry),
    body: JSON.stringify(payload),
  }, 'chat');

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${runtimeEntry.id} chat failed: HTTP ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${runtimeEntry.id} returned no message content`);
  }

  return {
    model,
    latencyMs,
    content,
    raw: data,
  };
}
