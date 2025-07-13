#!/usr/bin/env bash
set -euo pipefail

json="$(cat)"
tool_name="$(echo "$json" | jq -r '.tool_name // ""')"

if [[ "$tool_name" =~ ^(Write|Edit|MultiEdit)$ ]]; then
  file="$(echo "$json" | jq -r '.tool_input.file_path // ""')"
  
  if [[ "$file" =~ \.(ts|tsx|js|jsx|json|yaml|yml|md)$ ]] && [[ -f "$file" ]]; then
    cd "$(dirname "$0")/../.."
    
    if command -v npx &> /dev/null && npx prettier --version &> /dev/null; then
      echo "Running prettier on $file" >&2
      npx prettier --write "$file"
    else
      echo "Warning: prettier not found, skipping formatting" >&2
    fi
  fi
fi
