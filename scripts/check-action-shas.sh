#!/bin/sh
# Check that all third-party GitHub Actions are pinned to a full commit SHA.

errors=0
for f in .github/workflows/*.yml; do
  while IFS= read -r line; do
    case "$line" in
      *uses:\ ./*|*uses:\ docker://*) continue ;;
      *uses:\ *@*)
        case "$line" in
          *@[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*)
            # Full SHA found, good
          ;;
          *)
            # Extract the ref after @ for a cleaner error
            ref=$(printf '%s\n' "$line" | sed 's/.*@//' | sed 's/[[:space:]#].*//')
            action=$(printf '%s\n' "$line" | sed 's/.*uses:[[:space:]]*//' | sed 's/@.*//' | sed 's/^-[[:space:]]*//')
            echo "::error file=$f::Action \"$action\" pinned to \"$ref\" instead of a full 40-char commit SHA"
            errors=$((errors + 1))
          ;;
        esac
      ;;
    esac
  done < "$f"
done

if [ "$errors" -gt 0 ]; then
  exit 1
fi
