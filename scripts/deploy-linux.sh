#!/usr/bin/env bash
# Activates an uploaded release of AllSee at https://lawebs.co.il/allsee/
# Usage: deploy-linux.sh <release-id>   (archive at /opt/allsee/incoming/<id>.tar.gz)
set -Eeuo pipefail
release_id=${1:?release id required}
[[ "$release_id" =~ ^[0-9]{8}-[0-9]{6}$ ]] || { echo 'bad release id' >&2; exit 1; }

base=/opt/allsee
archive="$base/incoming/$release_id.tar.gz"
release="$base/releases/$release_id"
config=/etc/nginx/sites-available/lawebs.co.il.conf
snippet=/etc/nginx/snippets/allsee.conf
site=https://lawebs.co.il/allsee

test -f "$archive"
test -f "$config"
test ! -e "$release"
mkdir -p "$release" "$base/www" "$base/backups"
tar -xzf "$archive" -C "$release"
test -f "$release/index.html"
test -f "$release/revision.txt"

backup="$base/backups/$(date -u +%Y%m%dT%H%M%SZ)-$release_id"
mkdir -p "$backup"
cp -a "$config" "$backup/nginx.conf"
if test -f "$snippet"; then cp -a "$snippet" "$backup/snippet.conf"; fi
swapped=0
rollback() {
  cp -a "$backup/nginx.conf" "$config"
  if test -f "$backup/snippet.conf"; then cp -a "$backup/snippet.conf" "$snippet"; else rm -f "$snippet"; fi
  if test "$swapped" = 1; then
    mv "$base/www/current" "$release.failed"
    if test -d "$backup/current"; then mv "$backup/current" "$base/www/current"; fi
  fi
  nginx -t && systemctl reload nginx || true
}
trap rollback ERR

cat > "$snippet" <<'NGINX'
# AllSee (launchpad for every site) - deployed from AllSee/deploy.ps1
location = /allsee { return 308 /allsee/; }
location ^~ /allsee/ {
    alias /opt/allsee/www/current/;
    index index.html;
    add_header Cache-Control "no-cache" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
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
nginx -t

chown -R www-data:www-data "$release"
chmod -R u=rwX,go=rX "$release"
if test -d "$base/www/current"; then mv "$base/www/current" "$backup/current"; fi
mv "$release" "$base/www/current"
swapped=1
systemctl reload nginx
sleep 1

page=$(curl --fail --silent --show-error --retry 4 --retry-all-errors --retry-delay 1 --max-time 15 "$site/")
[[ "$page" == *'<title>AllSee</title>'* ]]
curl --fail --silent --show-error --max-time 15 -o /dev/null "$site/shots/lawebs.jpg"
trap - ERR

rm -f "$archive"
ls -1dt "$base"/backups/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf --
rm -rf "$base"/releases/*

echo "Live $site/ release $release_id"
echo "Rollback backup: $backup"
