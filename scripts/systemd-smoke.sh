#!/usr/bin/env bash
set -euo pipefail

[[ ${GITHUB_ACTIONS:-} == true ]]
export INITIAL_PASSWORD='Systemd smoke bootstrap!47' OWNER_PASSWORD='Systemd smoke owner!53'
origin=http://127.0.0.1:3000
doc_command() { node scripts/docs-command.mjs "$1"; }

cleanup() {
  sudo systemctl stop one-router.service
}
trap cleanup EXIT

mkdir "$RUNNER_TEMP/onerouter-pack"
pnpm -C packages/cli pack --pack-destination "$RUNNER_TEMP/onerouter-pack"
sudo install -d -o "$(id -u)" -g "$(id -g)" /opt/onerouter-ci
pnpm -C /opt/onerouter-ci add --prod "$RUNNER_TEMP"/onerouter-pack/*.tgz
package=/opt/onerouter-ci/node_modules/onerouter
sudo useradd --system --no-create-home --user-group --shell /usr/sbin/nologin one-router
sudo ln -s "$package/dist/index.js" /usr/local/bin/one-router
sudo install -m 644 "$package/templates/one-router.service" /etc/systemd/system/one-router.service
sudo install -d -m 755 /etc/one-router /etc/systemd/system/one-router.service.d
sudo install -m 600 /dev/null /etc/one-router/one-router.env
printf 'INITIAL_PASSWORD=%s\n' "$INITIAL_PASSWORD" | sudo tee /etc/one-router/one-router.env >/dev/null
printf '[Service]\nEnvironment=PATH=%s:/usr/local/bin:/usr/bin:/bin\n' "$(dirname "$(command -v node)")" |
  sudo tee /etc/systemd/system/one-router.service.d/ci-node.conf >/dev/null
sudo systemd-analyze verify /etc/systemd/system/one-router.service
bash -ec "$(doc_command systemd-start)"
id=$(node scripts/deployment-smoke.mjs fresh "$origin")
pid=$(systemctl show -p MainPID --value one-router.service)
[[ $(ps -o euser:20= -p "$pid" | xargs) == one-router ]]
[[ $(sudo stat -c '%U:%G %a' /var/lib/one-router) == 'one-router:one-router 700' ]]
sudo systemctl restart one-router.service
node scripts/deployment-smoke.mjs persist "$origin" "$id"
logs=$(sudo journalctl --no-pager --unit one-router.service)
[[ $logs != *"$INITIAL_PASSWORD"* && $logs != *'Bootstrap owner password'* ]]
reset=$(doc_command systemd-reset)
node_dir=$(dirname "$(command -v node)")
reset=${reset/--pty/--pipe --quiet --setenv=PATH=\"$node_dir:/usr/local/bin:/usr/bin:/bin\"}
reset_password='Systemd smoke reset!61'
printf '%s\n' "$reset_password" | bash -ec "$reset --stdin"
OWNER_PASSWORD=$reset_password node scripts/deployment-smoke.mjs reset "$origin"
bash -ec "$(doc_command systemd-stop)"
if systemctl is-active --quiet one-router.service; then exit 1; fi
if systemctl is-enabled --quiet one-router.service; then exit 1; fi
echo 'Verified the systemd unit starts the packaged CLI as its own user and persists encrypted data on restart.'
