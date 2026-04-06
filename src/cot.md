# §CoT — Compressed Chain of Thought Boot Seed

Optional reasoning layer above §1.

Use `§CoT` when you want the model to keep intermediate reasoning compact instead of re-expanding into verbose prose.

---

## SEED PHASE

```text
§CoT|BOOT

EX1:
Problem: What is 7 + 5?
Reasoning:
§CoT[
1:OBSERVE|operands:7,5
2:APPLY|add(7,5)->12
3:EMIT|answer:12
]

EX2:
Problem: If all humans are mortal and Socrates is human, what follows?
Reasoning:
§CoT[
1:OBSERVE|human->mortal
2:OBSERVE|socrates->human
3:INFER|syllogism(socrates,human,mortal)->socrates->mortal
4:EMIT|answer:Socrates is mortal
]

EX3:
Problem: A train goes 60 mph for 2 hours. Distance?
Reasoning:
§CoT[
1:OBSERVE|speed:60mph,time:2h
2:APPLY|distance=speed*time->120
3:EMIT|answer:120
]
```

---

## OPERATING RULES

- Keep reasoning inside `§CoT[...]`.
- Prefer short opcode-like steps over prose.
- Good ops: `OBSERVE`, `APPLY`, `INFER`, `CHECK`, `EMIT`.
- `EMIT` must contain only the final answer payload.
- Avoid conversational filler inside the trace.

---

## COMMAND SURFACE

```bash
trasgo cot boot
trasgo cot compile --natural "First add 7 and 5 to get 12. Therefore the answer is 12."
trasgo cot advise --natural "First add 7 and 5 to get 12. Therefore the answer is 12."
trasgo cot expand --codec "§CoT[1:OBSERVE|operands:7,5 2:APPLY|add(7,5)->12 3:EMIT|answer:12]"
```
