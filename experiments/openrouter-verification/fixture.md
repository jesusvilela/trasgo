# Northstar Data Platform — Change Review

## S1 — topology and operating state
Northstar serves fraud scoring and telemetry enrichment across three regions. The EU stream is hosted by cluster N7, which normally accepts 18,000 events/s. The US stream is hosted by N9 at 24,000 events/s. The policy service P2 governs admission limits for both clusters. At the start of the review window, N7 was nominal, N9 was nominal, and P2 used a risk threshold of 0.72.

## S2 — observed changes
On 2026-09-17, N7 queue latency rose from 38 ms to 91 ms after a schema rollout. Operators reduced N7's admission ceiling from 18,000 to 14,500 events/s. On 2026-09-18, P2 tightened its risk threshold from 0.72 to 0.64. N9 did not change capacity. The schema rollout was rolled back at 16:40 UTC on 2026-09-18, after which N7 queue latency fell to 44 ms. No customer data was lost.

## S3 — unresolved concerns
The rollback restored latency but did not explain why the new schema amplified queue contention only in N7. An unverified hypothesis points to a shard-local cardinality explosion. The review marks this hypothesis as medium confidence, not established fact. The incident commander requires two things before re-deployment: a cardinality benchmark under N7-like load and a replay showing p99 queue latency below 55 ms for 30 continuous minutes. Until both checks pass, the schema remains blocked.

## S4 — economic and governance context
The reduced N7 ceiling displaced approximately 3.8 million events into deferred processing during the incident window. Deferred processing completed within six hours. Internal cost attribution estimates the temporary backlog at EUR 1,140 in incremental compute. This estimate excludes staff time. The change board assigns severity S2 and explicitly rejects an S1 classification because there was no data loss, no fraud-decision outage, and no breach of the 15-minute customer-facing SLA.

## Questions for synthesis
1. What changed operationally, in chronological order?
2. Which facts are established, which are hypotheses, and what remains unknown?
3. What exactly blocks re-deployment?
4. Why is the incident S2 rather than S1?
