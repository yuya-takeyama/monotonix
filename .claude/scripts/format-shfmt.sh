#!/usr/bin/env bash
set -euo pipefail

json="$(cat)"
tool_name="$(echo "$json" | jq -r '.tool_name // ""')"

if [[ "$tool_name" =~ ^(Write|Edit|MultiEdit)$ ]]; then
  file="$(echo "$json" | jq -r '.tool_input.file_path // ""')"
  
  if [[ "$file" =~ \.(sh|bash)$ ]] && [[ -f "$file" ]]; then
    cd "$(dirname "$0")/../.."
    
    if command -v shfmt &> /dev/null; then
      echo "Running shfmt on $file" >&2
      shfmt -i 2 -ci -sr -w "$file"
    else
      echo "Warning: shfmt not found, skipping formatting" >&2
    fi
  fi
fi