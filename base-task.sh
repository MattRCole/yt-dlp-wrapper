#! /usr/bin/env bash

export $(cat ./.env | xargs)

export YTDLW_EXE="$(basename "$YTDLW_EXE_PATH")"
export PATH="$(dirname $(realpath "$YTDLW_EXE_PATH")):${PATH}"

echo $YTDLW_EXE

    # --allow-env=YTDLW_VIDEO,YTDLW_MUSIC,YTDLW_EXE,DYLD_LIBRARY_PATH,LD_LIBRARY_PATH \
    # "--allow-run=$YTDLW_EXE" \

deno run \
    --allow-net \
    --allow-env \
    "--allow-read=$YTDLW_VIDEO,$YTDLW_MUSIC" \
    --allow-run \
    "$@"