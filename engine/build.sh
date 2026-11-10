#!/usr/bin/env bash
# Builds the seed engine (cubiomes + Bedrock rules) to WebAssembly.
#
#   source /path/to/emsdk/emsdk_env.sh && engine/build.sh
#
# The output (src/engine/wasm/sa_engine.mjs + .wasm) is committed, so the app
# builds without Emscripten. Re-run this only when engine/ changes.
#
# cubiomes is vendored untouched at upstream commit e61f905 (Nov 2024). The
# files in engine/patches extend it to the 1.21.5 - 26.x biome trees and are
# applied to a scratch copy here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD="$ROOT/engine/.build"
OUT="$ROOT/src/engine/wasm"

rm -rf "$BUILD"
mkdir -p "$BUILD/cubiomes" "$BUILD/bedrock" "$BUILD/src" "$OUT"
cp -r "$ROOT/engine/cubiomes/." "$BUILD/cubiomes/"
cp "$ROOT"/engine/patches/btree*.h "$BUILD/cubiomes/tables/"
patch -s -p1 -d "$BUILD/cubiomes" < "$ROOT/engine/patches/versions.patch"
cp "$ROOT"/engine/bedrock/*.[ch] "$BUILD/bedrock/"
cp "$ROOT"/engine/src/*.c "$BUILD/src/"

SRC=(
  "$BUILD/src/sa_engine.c" "$BUILD/bedrock/bedrock.c"
  "$BUILD/cubiomes/noise.c" "$BUILD/cubiomes/biomes.c" "$BUILD/cubiomes/layers.c"
  "$BUILD/cubiomes/biomenoise.c" "$BUILD/cubiomes/generator.c"
  "$BUILD/cubiomes/finders.c" "$BUILD/cubiomes/util.c" "$BUILD/cubiomes/quadbase.c"
)

if [ "${1:-}" = "native" ]; then
  # handy for debugging the C directly: engine/build.sh native
  cc -O2 -fwrapv -c "${SRC[@]}" -lm
  exit 0
fi

emcc "${SRC[@]}" -O3 -flto -fwrapv -DNDEBUG \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS='["_malloc","_free"]' \
  -sEXPORTED_RUNTIME_METHODS='["HEAP32","HEAPU8","HEAPU32","UTF8ToString"]' \
  -sEXPORT_NAME=createSeedEngine \
  -o "$OUT/sa_engine.mjs"

echo "built -> $OUT/sa_engine.mjs"
