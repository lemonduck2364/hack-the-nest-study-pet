#!/bin/zsh
set -e

project_folder="${0:A:h}/desktop"
cd -- "$project_folder"

if [[ -d "dist/Nest Pet.app" ]]; then
  exec /usr/bin/open "$project_folder/dist/Nest Pet.app"
fi

if ! command -v npm >/dev/null || [[ ! -x ./node_modules/.bin/electron ]]; then
  print -u2 'Follow the Mac build steps in README.md, then double-click this file again.'
  exit 1
fi

exec npm start
