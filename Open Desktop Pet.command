#!/bin/zsh
set -e

project_folder="${0:A:h}/desktop"
cd -- "$project_folder"

if ! command -v npm >/dev/null || [[ ! -x ./node_modules/.bin/electron ]]; then
  print -u2 'Follow the README Mac setup first, then double-click this file to reopen the pet.'
  exit 1
fi

exec npm start
