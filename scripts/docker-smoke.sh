#!/usr/bin/env bash
set -euo pipefail

export COMPOSE_PROJECT_NAME=onerouter-phase8
compose=(docker compose --file docker/compose.yml --env-file docker/.env)
doc_command() { node scripts/docs-command.mjs "$1"; }
origin=http://127.0.0.1:3000
export INITIAL_PASSWORD='Docker smoke bootstrap!47' OWNER_PASSWORD='Docker smoke owner!53'
reset_password='Docker smoke reset!61'

cleanup() {
  "${compose[@]}" --profile minio down --volumes --remove-orphans
  docker rm -f onerouter-phase8-baseline onerouter-phase8-nomount 2>/dev/null || true
  if [[ -n ${baseline_dir:-} ]]; then git worktree remove --force "$baseline_dir"; fi
  rm -f docker/.env
}

# Only operate on a CI-owned fixture with the default Compose volume name.
[[ ${GITHUB_ACTIONS:-} == true && ! -e docker/.env ]]
trap cleanup EXIT
printf 'INITIAL_PASSWORD=%s\n' "$INITIAL_PASSWORD" > docker/.env
"${compose[@]}" --profile minio config --quiet
bash -ec "$(doc_command docker-start) --wait-timeout 90"
container=$("${compose[@]}" ps -q one-router)
image=$(docker inspect --format '{{.Image}}' "$container")
size=$(docker image inspect --format '{{.Size}}' "$image")
echo "Image: $size uncompressed bytes"
[[ $size -le 250000000 ]]
[[ $(docker inspect --format '{{.Config.User}} {{.State.Health.Status}}' "$container") == '1000:1000 healthy' ]]
[[ $(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container") == unless-stopped ]]
docker exec "$container" sh -ec '
  test "$(id -u)" = 1000
  test -w /data && test -f /data/one-router.db && test -f /data/encryption.key
  test -d /opt/one-router/node_modules/@libsql/client
  test ! -e /opt/one-router/node_modules/esbuild
  test ! -e /opt/one-router/node_modules/next
  onerouter --version
'
logs=$(docker logs "$container" 2>&1)
[[ $logs != *"$INITIAL_PASSWORD"* && $logs != *'Bootstrap owner password'* && $logs != *'not mounted'* ]]
id=$(node scripts/deployment-smoke.mjs fresh "$origin")
"${compose[@]}" restart one-router
node scripts/deployment-smoke.mjs persist "$origin" "$id"

# Removing the installation leaves the named volume unless explicitly purged.
bash -ec "$(doc_command docker-down)"
docker volume inspect one-router-data >/dev/null
export INITIAL_PASSWORD='Docker smoke ignored!79'
printf 'INITIAL_PASSWORD=%s\n' "$INITIAL_PASSWORD" > docker/.env
"${compose[@]}" up -d --wait --wait-timeout 90
node scripts/deployment-smoke.mjs persist "$origin" "$id"
container=$("${compose[@]}" ps -q one-router)
logs=$(docker logs "$container" 2>&1)
[[ $logs != *"$INITIAL_PASSWORD"* && $logs != *'Bootstrap owner password'* ]]
reset=$(doc_command docker-reset)
# The fixture supplies a password over stdin rather than opening a terminal.
printf '%s\n' "$reset_password" | bash -ec "${reset/ exec / exec -T } --stdin"
OWNER_PASSWORD=$reset_password node scripts/deployment-smoke.mjs reset "$origin"
bash -ec "$(doc_command docker-purge)"
if docker volume inspect one-router-data >/dev/null 2>&1; then exit 1; fi
if [[ ${1:-} == --docs-only ]]; then exit 0; fi

docker run -d --name onerouter-phase8-nomount --publish 127.0.0.1:3000:3000 "$image" >/dev/null
for attempt in {1..30}; do
  if curl --fail --silent --output /dev/null "$origin/health"; then break; fi
  sleep 1
done
logs=$(docker logs onerouter-phase8-nomount 2>&1)
[[ $logs == *'/data is not mounted'* ]]
[[ $(grep -c 'Bootstrap owner password' <<< "$logs") == 1 ]]
generated=$(sed -n 's/^Bootstrap owner password (sensitive): //p' <<< "$logs")
INITIAL_PASSWORD=$generated node scripts/deployment-smoke.mjs fresh "$origin" >/dev/null
docker restart onerouter-phase8-nomount >/dev/null
logs=$(docker logs onerouter-phase8-nomount 2>&1)
[[ $(grep -c 'Bootstrap owner password' <<< "$logs") == 1 ]]
docker rm -f onerouter-phase8-nomount >/dev/null

# P7 is the prior packaged release source until a previous image has been published.
baseline_dir=$RUNNER_TEMP/onerouter-phase7
git worktree add --detach "$baseline_dir" 093d935761d811b4e16910283a2d862c7c1405a4
mkdir "$baseline_dir/docker"
cp docker/{Dockerfile,Dockerfile.dockerignore,entrypoint.sh} "$baseline_dir/docker/"
docker build -f "$baseline_dir/docker/Dockerfile" -t onerouter-phase8-baseline "$baseline_dir"
"${compose[@]}" create --no-build one-router
docker run -d --name onerouter-phase8-baseline --publish 127.0.0.1:3000:3000 \
  --mount source=one-router-data,target=/data --env NODE_ENV=development --env INITIAL_PASSWORD \
  onerouter-phase8-baseline >/dev/null
id=$(node scripts/deployment-smoke.mjs baseline "$origin")
docker rm -f onerouter-phase8-baseline >/dev/null
"${compose[@]}" up -d --wait --wait-timeout 90
node scripts/deployment-smoke.mjs persist "$origin" "$id"
echo 'Docker lifecycle passed, including data created by the Phase 7 package.'

export MINIO_ROOT_USER='onerouter-ci' MINIO_ROOT_PASSWORD='MinIO smoke password!83'
"${compose[@]}" --profile minio up -d minio
for attempt in {1..30}; do
  if "${compose[@]}" exec -T one-router node -e "fetch('http://minio:9000/minio/health/ready', { signal: AbortSignal.timeout(2000) }).then(r => { if (!r.ok) process.exitCode = 1 }).catch(() => { process.exitCode = 1 })"; then
    echo 'Optional MinIO profile is ready on the Compose network.'
    exit 0
  fi
  sleep 1
done
echo 'Optional MinIO profile did not become ready.' >&2
exit 1
