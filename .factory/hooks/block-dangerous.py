#!/usr/bin/env python3
import json
import re
import sys

DANGEROUS_PATTERNS = [
    (r'git\s+push\s+.*--force[^-].*main', 'Force push to main is not allowed'),
    (r'git\s+push\s+.*main.*--force[^-]', 'Force push to main is not allowed'),
    (r'git\s+push\s+--force\s+origin\s+main', 'Force push to main is not allowed'),
    (r'rm\s+-[a-z]*rf?\s+/', 'rm -rf / is not allowed'),
    (r'rm\s+-[a-z]*f[a-z]*r\s+/', 'rm -rf / is not allowed'),
    (r'chmod\s+777', 'chmod 777 is dangerous'),
    (r'git\s+push\s+.*--force-with-lease.*main', 'Force push to main is not allowed'),
]

data = json.load(sys.stdin)
cmd = data.get('tool_input', {}).get('command', '')

for pattern, msg in DANGEROUS_PATTERNS:
    if re.search(pattern, cmd, re.IGNORECASE):
        print(f'[Hook] BLOCKED: {msg}', file=sys.stderr)
        print(f'[Hook] Command: {cmd[:120]}', file=sys.stderr)
        sys.exit(2)

sys.exit(0)
