#! /usr/bin/env bash

export $(cat ../.env | xargs)

export YTDLW_EXE="$(basename "$YTDLW_EXE_PATH")"
export PATH="$(dirname $(realpath "$YTDLW_EXE_PATH")):${PATH}"

deno run \
    --allow-net \
    --allow-env \
    "--allow-read=$YTDLW_VIDEO,$YTDLW_MUSIC,$YTDLW_EXE_PATH" \
    --allow-run \
    "$@"