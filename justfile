set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load := true

host := "personal"
frontend_dir := "frontend"
frontend_site_root := "/var/www/bossadapt.org/ttrpg"
frontend_archive_name := "ttrpg-frontend.tar.gz"
backend_dir := "/srv/ttrpg"
backend_archive_name := "ttrpg-backend.tar.gz"
backend_service_name := "ttrpg"
backend_service_file := "deploy/ttrpg.service"
production_env_file := "production-secret.env"
remote_env_file := "/srv/ttrpg/.env"
maintenance_file := "/srv/ttrpg/.maintenance"
maintenance_page_file := "deploy/maintenance.html"
maintenance_page_remote := "/var/www/bossadapt.org/ttrpg-maintenance.html"
nginx_config_repo := "../server_config"
public_url := "https://bossadapt.org/ttrpg/"
public_app_ws_url := "wss://bossadapt.org/ttrpg/ws"
public_chat_ws_url := "wss://bossadapt.org/ttrpg/ws/chat"

default:
    @just --list

run-backend:
    python -m uvicorn backend.core.main:app --host 0.0.0.0 --port 6767

seed:
    python -m backend.dev.seed

install-frontend:
    cd {{frontend_dir}} && npm ci --include=dev

generate-protocol:
    cd {{frontend_dir}} && npm run generate:protocol

test-backend: generate-protocol
    backend/.venv/bin/python -m pytest

test-frontend: install-frontend generate-protocol
    cd {{frontend_dir}} && npm test

lint-frontend: install-frontend
    cd {{frontend_dir}} && npm run lint

build-frontend: install-frontend generate-protocol
    cd {{frontend_dir}} && VITE_WS_URL={{public_app_ws_url}} VITE_PLAYER_AUTH_TOKEN= VITE_DM_AUTH_TOKEN= npm run build
    rg -q -F '{{public_app_ws_url}}' {{frontend_dir}}/dist/assets
    rg -q '="/ttrpg/assets/' {{frontend_dir}}/dist/index.html

check: test-backend test-frontend lint-frontend build-frontend

pack-frontend: check
    rm -f {{frontend_archive_name}}
    tar -czf {{frontend_archive_name}} -C {{frontend_dir}}/dist .
    tar -tzf {{frontend_archive_name}} | rg -q '(^|/)index\.html$'

upload-frontend: pack-frontend
    scp {{frontend_archive_name}} {{host}}:/tmp/{{frontend_archive_name}}

pack-backend:
    rm -f {{backend_archive_name}}
    tar -czf {{backend_archive_name}} \
        --exclude='backend/.venv' \
        --exclude='backend/.codex' \
        --exclude='backend/.ruff_cache' \
        --exclude='backend/**/__pycache__' \
        --exclude='backend/**/*.pyc' \
        --exclude='backend/.pytest_cache' \
        --exclude='backend/tests' \
        --exclude='backend/dev' \
        --exclude='deploy/__pycache__' \
        backend deploy
    forbidden="$(tar -tzf {{backend_archive_name}} | rg '(^|/)(state_dumpy\.json(\.bak|\.tmp)?|production-secret\.env|\.env|\.venv|node_modules)(/|$)' || true)"; \
    if [[ -n "$forbidden" ]]; then \
        printf 'Backend archive contains forbidden paths:\n%s\n' "$forbidden" >&2; \
        exit 1; \
    fi

upload-backend: pack-backend
    scp {{backend_archive_name}} {{host}}:/tmp/{{backend_archive_name}}

init-production-env:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -e "{{production_env_file}}" ]]; then
        printf '%s already exists; leaving production credentials unchanged.\n' "{{production_env_file}}"
        exit 0
    fi

    umask 077
    player_code="$(openssl rand -hex 32)"
    dm_code="$(openssl rand -hex 32)"
    service_code="$(openssl rand -hex 32)"
    {
        printf 'APP_ENV=production\n'
        printf 'PLAYER_JOIN_CODE=%s\n' "$player_code"
        printf 'DM_ADMIN_CODE=%s\n' "$dm_code"
        printf 'SERVICE_AUTH_CODE=%s\n' "$service_code"
    } > "{{production_env_file}}"
    chmod 600 "{{production_env_file}}"
    printf 'Generated production credentials in %s without printing them.\n' "{{production_env_file}}"

deploy-backend-env:
    #!/usr/bin/env bash
    set -euo pipefail
    cleanup_remote() {
        ssh {{host}} "rm -f /tmp/ttrpg-production-secret.env" >/dev/null 2>&1 || true
    }
    trap cleanup_remote EXIT

    ssh {{host}} "sudo install -d -o www-data -g www-data -m 755 {{backend_dir}}"
    if [[ -f "{{production_env_file}}" ]]; then
        scp "{{production_env_file}}" {{host}}:/tmp/ttrpg-production-secret.env
        ssh {{host}} "sudo install -o www-data -g www-data -m 600 /tmp/ttrpg-production-secret.env {{remote_env_file}}"
        printf 'Installed the production environment on %s.\n' "{{host}}"
    elif ssh {{host}} "test -f {{remote_env_file}}"; then
        printf 'Using the existing production environment on %s.\n' "{{host}}"
    else
        printf 'Missing %s and no existing %s on %s.\n' "{{production_env_file}}" "{{remote_env_file}}" "{{host}}" >&2
        exit 1
    fi

install-backend-service:
    scp {{backend_service_file}} {{host}}:/tmp/{{backend_service_name}}.service
    ssh {{host}} "sudo install -d -o www-data -g www-data -m 755 {{backend_dir}}"
    ssh {{host}} "sudo install -o root -g root -m 644 /tmp/{{backend_service_name}}.service /etc/systemd/system/{{backend_service_name}}.service"
    ssh {{host}} "rm -f /tmp/{{backend_service_name}}.service"
    ssh {{host}} "sudo systemctl daemon-reload"
    ssh {{host}} "sudo systemctl enable {{backend_service_name}}"

install-maintenance-page:
    scp {{maintenance_page_file}} {{host}}:/tmp/ttrpg-maintenance.html
    ssh {{host}} "sudo install -d -o root -g root -m 755 /var/www/bossadapt.org"
    ssh {{host}} "sudo install -o root -g root -m 644 /tmp/ttrpg-maintenance.html {{maintenance_page_remote}}"
    ssh {{host}} "rm -f /tmp/ttrpg-maintenance.html"

deploy-nginx:
    cd {{nginx_config_repo}} && just deploy-nginx

enter-maintenance:
    ssh {{host}} "sudo install -d -o www-data -g www-data -m 755 {{backend_dir}} && sudo touch {{maintenance_file}} && sudo chmod 644 {{maintenance_file}}"

exit-maintenance:
    ssh {{host}} "sudo rm -f {{maintenance_file}}"

_deploy-backend-uploaded:
    #!/usr/bin/env bash
    set -euo pipefail
    cleanup_remote() {
        ssh {{host}} "rm -f /tmp/{{backend_archive_name}}" >/dev/null 2>&1 || true
    }
    trap cleanup_remote EXIT

    ssh {{host}} "sudo systemctl stop {{backend_service_name}}"
    ssh {{host}} "sudo find {{backend_dir}} -mindepth 1 -maxdepth 1 \( -name backend -o -name deploy \) -exec rm -rf -- {} +"
    ssh {{host}} "sudo -u www-data tar -xzf /tmp/{{backend_archive_name}} -C {{backend_dir}}"
    ssh {{host}} "sudo -u www-data chmod -R u=rwX,go=rX {{backend_dir}}/backend {{backend_dir}}/deploy"
    ssh {{host}} "sudo -u www-data python3 -m venv {{backend_dir}}/backend/.venv"
    ssh {{host}} "sudo -u www-data {{backend_dir}}/backend/.venv/bin/pip install --disable-pip-version-check -r {{backend_dir}}/backend/requirements.txt"
    ssh {{host}} "sudo systemctl start {{backend_service_name}}"
    ssh {{host}} "sudo systemctl is-active --quiet {{backend_service_name}}"
    ssh {{host}} 'for attempt in $(seq 1 30); do curl --fail --silent --show-error --output /dev/null http://127.0.0.1:6767/openapi.json && exit 0; sleep 1; done; exit 1'

_deploy-frontend-uploaded:
    #!/usr/bin/env bash
    set -euo pipefail
    cleanup_remote() {
        ssh {{host}} "rm -f /tmp/{{frontend_archive_name}}" >/dev/null 2>&1 || true
    }
    trap cleanup_remote EXIT

    ssh {{host}} "sudo install -d -o root -g root -m 755 {{frontend_site_root}}"
    ssh {{host}} "sudo find {{frontend_site_root}} -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +"
    ssh {{host}} "sudo tar -xzf /tmp/{{frontend_archive_name}} -C {{frontend_site_root}}"
    ssh {{host}} "sudo chown -R root:root {{frontend_site_root}} && sudo chmod -R u=rwX,go=rX {{frontend_site_root}}"
    ssh {{host}} "test -r {{frontend_site_root}}/index.html"

verify-public:
    curl --fail --silent --show-error --output /dev/null -H 'Cache-Control: no-cache' {{public_url}}
    ssh {{host}} "set -a; . {{remote_env_file}}; set +a; {{backend_dir}}/backend/.venv/bin/python {{backend_dir}}/deploy/verify_websockets.py --app-url {{public_app_ws_url}} --chat-url {{public_chat_ws_url}}"

deploy-all: upload-frontend upload-backend deploy-backend-env
    #!/usr/bin/env bash
    set -euo pipefail
    just enter-maintenance
    if ! just _deploy-backend-uploaded; then
        printf 'Backend deployment failed; maintenance remains enabled.\n' >&2
        exit 1
    fi
    if ! just _deploy-frontend-uploaded; then
        printf 'Frontend deployment failed; maintenance remains enabled.\n' >&2
        exit 1
    fi
    just exit-maintenance
    if ! just verify-public; then
        just enter-maintenance
        printf 'Public verification failed; maintenance was restored.\n' >&2
        exit 1
    fi
    just clean

deploy-backend: upload-backend deploy-backend-env
    #!/usr/bin/env bash
    set -euo pipefail
    just enter-maintenance
    if ! just _deploy-backend-uploaded; then
        printf 'Backend deployment failed; maintenance remains enabled.\n' >&2
        exit 1
    fi
    just exit-maintenance
    if ! just verify-public; then
        just enter-maintenance
        printf 'Public verification failed; maintenance was restored.\n' >&2
        exit 1
    fi
    just clean

deploy-frontend: upload-frontend
    #!/usr/bin/env bash
    set -euo pipefail
    just enter-maintenance
    if ! just _deploy-frontend-uploaded; then
        printf 'Frontend deployment failed; maintenance remains enabled.\n' >&2
        exit 1
    fi
    just exit-maintenance
    if ! just verify-public; then
        just enter-maintenance
        printf 'Public verification failed; maintenance was restored.\n' >&2
        exit 1
    fi
    just clean

bootstrap: init-production-env install-maintenance-page install-backend-service
    #!/usr/bin/env bash
    set -euo pipefail
    just enter-maintenance
    just deploy-nginx
    just deploy-all

status-backend:
    ssh {{host}} "sudo systemctl --no-pager --full status {{backend_service_name}}"

logs-backend:
    ssh {{host}} "sudo journalctl -u {{backend_service_name}} -n 100 --no-pager"

ssh:
    ssh {{host}}

clean:
    rm -f {{frontend_archive_name}} {{backend_archive_name}}
