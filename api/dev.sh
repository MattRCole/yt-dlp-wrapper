#! /bin/bash



export $(cat ../.env | xargs)

export YTDLW_EXE="$(basename "$YTDLW_EXE_PATH")"
export PATH="$(dirname $(realpath "$YTDLW_EXE_PATH")):${PATH}"

deno run -A --watch src/main.ts