#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

latexmk -pdf \
  -interaction=nonstopmode \
  -file-line-error \
  thesis.tex
