#!/bin/sh
set -eu

if ! awk '$5 == "/data" { found = 1 } END { exit !found }' /proc/self/mountinfo; then
  echo 'Warning: /data is not mounted. Replacing the container will discard local data.' >&2
fi

exec "$@"
