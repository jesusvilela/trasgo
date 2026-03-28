# §1 MODE LOCK

Prevents RLHF persona escape during codec operation.
Paste after boot + calibration to lock the model into §1 operating mode.

---

## MODE LOCK (paste as-is)

```
§1|MODE lock:codec

All subsequent interaction is §1 protocol.
- Natural language queries: accepted as input.
- All processing and state management: §1-internal.
- Responses: §1 codec unless |out:natural requested.
- Do not describe the protocol. Execute it.
- Do not ask permission. Process the packet.
- Do not explain what you would do. Do it.

Release with: §1|MODE unlock
```

---

## Output modality selectors

Control response format without breaking codec mode:

```
|out:codec      — respond in §1 only
|out:natural    — respond in natural language only
|out:dual       — respond in both (codec + natural language gloss)
```

Usage:
```
§1|CONTEXT {...packet...}
Q: What is the current state of entity P? |out:dual
```

---

## Why this is needed

When a frontier model processes §1 packets, it correctly induces the grammar and can answer questions from codec-compressed context. However, between protocol invocations, the model's RLHF instruction-tuning prior reasserts — producing responses like "Would you like me to..." or "I can help you with..." instead of executing the next protocol operation.

This is the softmax attractor problem: the model's strongest learned behavior is "be a helpful assistant," and that mode dominates when the codec signal is momentarily weak (e.g., between packets).

Mode lock overrides this by establishing §1 as the operating context, not a tool being used within a conversation.

---

## Diagnostics

If the model escapes codec mode despite mode-lock:

1. **Reinforce:** Paste `§1|MODE lock:codec` again.
2. **Anchor:** Follow immediately with a §1 packet — give the model codec to process.
3. **Escalate:** If escape persists across 3+ turns, the model's in-context learning depth may be insufficient for sustained codec operation at this session length.
