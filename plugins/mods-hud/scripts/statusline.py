#!/usr/bin/env python3
"""Render Claude Code's statusLine JSON; optionally retain the previous command."""
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime


def render(data, columns=120, now=None):
    now = now or datetime.now().astimezone()
    def clean(value):
        return re.sub(r'[\x00-\x1f\x7f-\x9f]', '', str(value))
    def percent(value):
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    model = data.get('model') or {}
    head = clean(model.get('display_name') or model.get('id') or '')
    effort = (data.get('effort') or {}).get('level')
    if effort:
        head += ' ' + clean(effort)
    parts = []
    limits = data.get('rate_limits') or {}
    for key, label in [('five_hour', '5h'), ('seven_day', 'w')]:
        limit = limits.get(key) or {}
        value = limit.get('used_percentage')
        if not percent(value):
            continue
        reset = limit.get('resets_at')
        suffix = ''
        if percent(reset):
            try:
                at = datetime.fromtimestamp(reset, now.tzinfo)
                suffix = '(' + at.strftime('%H:%M' if at.date() == now.date() else '%m/%d %H:%M') + ')'
            except (ValueError, OverflowError, OSError):
                pass
        parts.append((label, value, suffix))
    context = (data.get('context_window') or {}).get('used_percentage')
    if percent(context):
        parts.append(('ctx', context, ''))
    def plain():
        return ' · '.join(([head.strip()] if head.strip() else []) + [f'{k} {v:.0f}%{r}' for k,v,r in parts])
    if len(plain()) > max(1, columns - 4):
        parts = [(k,v,'') for k,v,r in parts]
    output = [head.strip()] if head.strip() else []
    for label, value, reset in parts:
        color = 31 if value >= 90 else 33 if value >= 70 else 32
        output.append(f'{label} \033[{color}m{value:.0f}%\033[0m{reset}')
    return ' · '.join(output)


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return
        columns = int(os.environ.get('COLUMNS', '120'))
        line = render(data, columns)
        if line:
            print(line, flush=True)
    except (ValueError, TypeError):
        return
    # A local installation may chain an existing integration without copying it into the repo.
    previous = Path(__file__).with_name('previous-statusline.json')
    if previous.exists():
        try:
            config = json.loads(previous.read_text())
            command = config.get('command')
            if command:
                result = subprocess.run(command, shell=True, input=raw, text=True,
                                        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=5)
                if result.stdout.strip():
                    print(result.stdout.rstrip())
        except (OSError, ValueError, subprocess.TimeoutExpired):
            pass


if __name__ == '__main__':
    main()
