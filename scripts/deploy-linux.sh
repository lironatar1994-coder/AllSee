#!/usr/bin/env bash
# Activates an uploaded release of AllSee at https://lawebs.co.il/allsee/
# Usage: deploy-linux.sh <release-id>
#   expects /opt/allsee/incoming/<id>.tar.gz and /opt/allsee/incoming/admin.env
# Runs server.mjs as the "allsee" systemd service on 127.0.0.1:4310 behind nginx.
# Edits live in /var/lib/allsee and are never touched by a deploy.
set -Eeuo pipefail
release_id=${1:?release id required}
[[ "$release_id" =~ ^[0-9]{8}-[0-9]{6}$ ]] || { echo 'bad release id' >&2; exit 1; }

base=/opt/allsee
archive="$base/incoming/$release_id.tar.gz"
env_in="$base/incoming/admin.env"
release="$base/releases/$release_id"
state=/var/lib/allsee
config=/etc/nginx/sites-available/lawebs.co.il.conf
snippet=/etc/nginx/snippets/allsee.conf
unit=/etc/systemd/system/allsee.service
envfile=/etc/allsee.env
port=4310
site=https://lawebs.co.il/allsee

node_bin=$(command -v node)
test -x "$node_bin"
test -f "$archive"
test -f "$env_in"
test -f "$config"
test ! -e "$release"
grep -q '^ALLSEE_PASSWORD_HASH=scrypt:' "$env_in"
grep -q '^ALLSEE_SECRET=' "$env_in"

mkdir -p "$release" "$base/backups"
tar -xzf "$archive" -C "$release"
for f in server.mjs public/index.html public/app.js data/seed.json REVISION; do test -f "$release/$f"; done
revision=$(cat "$release/REVISION")
chown -R root:root "$release"
chmod -R u=rwX,go=rX "$release"

id allsee >/dev/null 2>&1 || useradd --system --home-dir "$state" --no-create-home --shell /usr/sbin/nologin allsee
install -d -m 700 -o allsee -g allsee "$state"

backup="$base/backups/$(date -u +%Y%m%dT%H%M%SZ)-$release_id"
mkdir -p "$backup"
cp -a "$config" "$backup/nginx.conf"
for f in "$snippet" "$unit" "$envfile"; do if test -f "$f"; then cp -a "$f" "$backup/$(basename "$f")"; fi; done
previous=$(readlink -f "$base/current" 2>/dev/null || true)
if test -n "$previous" && ! test -d "$previous"; then previous=''; fi

rollback() {
  echo 'Deploy failed, rolling back' >&2
  cp -a "$backup/nginx.conf" "$config"
  if test -f "$backup/allsee.conf"; then cp -a "$backup/allsee.conf" "$snippet"; else rm -f "$snippet"; fi
  if test -f "$backup/allsee.service"; then cp -a "$backup/allsee.service" "$unit"; fi
  if test -f "$backup/allsee.env"; then cp -a "$backup/allsee.env" "$envfile"; fi
  systemctl daemon-reload || true
  if test -n "$previous"; then
    ln -sfn "$previous" "$base/current"
    systemctl restart allsee || true
  else
    systemctl stop allsee || true
  fi
  nginx -t && systemctl reload nginx || true
}
trap rollback ERR

install -m 600 -o root -g root "$env_in" "$envfile"
rm -f "$env_in"

cat > "$unit" <<UNIT
[Unit]
Description=AllSee launchpad (lawebs.co.il/allsee)
After=network.target

[Service]
Type=simple
User=allsee
Group=allsee
WorkingDirectory=$base/current
EnvironmentFile=$envfile
Environment=PORT=$port HOST=127.0.0.1 ALLSEE_DATA_DIR=$state NODE_ENV=production
ExecStart=$node_bin $base/current/server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$state
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT

cat > "$snippet" <<NGINX
# AllSee - deployed from AllSee/deploy.ps1 (Node service on 127.0.0.1:$port)
location = /allsee { return 308 /allsee/; }
location ^~ /allsee/ {
    proxy_pass http://127.0.0.1:$port;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header Connection "";
    client_max_body_size 6m;
}
NGINX

python3 - "$config" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
s = p.read_text()
marker = '    include /etc/nginx/snippets/allsee.conf;'
if marker not in s:
    anchor = '    location / {'
    if s.count(anchor) != 1:
        raise SystemExit('Ambiguous nginx insertion point')
    p.write_text(s.replace(anchor, marker + '\n\n' + anchor, 1))
PY

ln -sfn "$release" "$base/current"
systemctl daemon-reload
systemctl enable allsee >/dev/null 2>&1
systemctl restart allsee
ok=0
for _ in $(seq 1 20); do
  if curl --fail --silent --max-time 3 "http://127.0.0.1:$port/allsee/api/health" | grep -q "\"revision\":\"$revision\""; then ok=1; break; fi
  sleep 0.5
done
test "$ok" = 1

nginx -t
systemctl reload nginx
sleep 1
page=$(curl --fail --silent --show-error --retry 4 --retry-all-errors --retry-delay 1 --max-time 15 "$site/")
[[ "$page" == *'id="boot"'* ]]
curl --fail --silent --show-error --max-time 15 "$site/api/health" | grep -q "\"revision\":\"$revision\""
curl --fail --silent --show-error --max-time 15 -o /dev/null "$site/shots/lawebs.jpg"
trap - ERR

# Clean up: the old static copy, the archive, all but the 5 newest releases and backups.
rm -rf "$base/www" "$archive"
current=$(readlink -f "$base/current")
ls -1dt "$base"/releases/*/ 2>/dev/null | tail -n +6 | while read -r d; do
  d=${d%/}; [ "$(readlink -f "$d")" = "$current" ] || rm -rf -- "$d"
done
ls -1dt "$base"/backups/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf --

echo "Live $site/ release $release_id ($revision)"
echo "Data: $state  Rollback backup: $backup"
