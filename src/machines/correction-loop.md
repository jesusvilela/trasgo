§M|LOOP — correction-loop

INIT:   receive §1 packet with ERR block
COND:   μ.cert < 0.5 OR ERR.flag = REQUEST_VERIFICATION
BODY:   §P|VALIDATE → if fails → §P|CHECKPOINT → §1|EVOLVE(correction) → re-reduce
EXIT:   μ.cert ≥ 0.8 AND ERR.flag = RESOLVED
MAX:    5 iterations (configurable)
ON-MAX: emit §1 with cert = 0.0, flag = CORRECTION-FAILED, escalate to human
