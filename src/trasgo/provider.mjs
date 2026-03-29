export function headersForRuntime(runtimeEntry) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (runtimeEntry.api_key_env && process.env[runtimeEntry.api_key_env]) {
    headers.Authorization = `Bearer ${process.env[runtimeEntry.api_key_env]}`;
  }

  return headers;
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

  const response = await fetch(endpointForRuntime(runtimeEntry, '/models'), {
    method: 'GET',
    headers: headersForRuntime(runtimeEntry),
  });

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
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 1500,
  };

  const response = await fetch(endpointForRuntime(runtimeEntry, '/chat/completions'), {
    method: 'POST',
    headers: headersForRuntime(runtimeEntry),
    body: JSON.stringify(payload),
  });

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
