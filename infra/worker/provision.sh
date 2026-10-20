#!/usr/bin/env bash
# Provision the worker's machine — and rebuild it, because this is the same script run again
# (worker-foundation R7, trd D8). Idempotent: every step checks before it changes anything.
#
#   sudo ./provision.sh
#
# What it sets up on a fresh Ubuntu 24.04: automatic security updates, a firewall that allows
# SSH only, fail2ban on SSH, Docker with the compose plugin, log rotation, the /opt/worker directory the deploy
# writes into, and the compose stack as a service that starts on boot. It never contains a
# secret and never names the cloud it runs on; the deploy supplies the env file and the image.
set -euo pipefail

WORKER_DIR=/opt/worker
DEPLOY_USER=${DEPLOY_USER:-ubuntu}

log() { printf '\n== %s\n' "$*"; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Run as root: sudo $0" >&2
    exit 1
  fi
}

apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$@"
}

security_updates() {
  log "Automatic security updates"
  apt-get update -q
  apt_install unattended-upgrades apt-listchanges
  cat >/etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
  # Reboot for a kernel update at a quiet hour rather than never.
  sed -i 's|^//Unattended-Upgrade::Automatic-Reboot .*|Unattended-Upgrade::Automatic-Reboot "true";|' /etc/apt/apt.conf.d/50unattended-upgrades
  sed -i 's|^//Unattended-Upgrade::Automatic-Reboot-Time .*|Unattended-Upgrade::Automatic-Reboot-Time "03:30";|' /etc/apt/apt.conf.d/50unattended-upgrades
}

firewall() {
  log "Firewall: SSH in, nothing else in"
  apt_install ufw
  # Oracle's Ubuntu image ships iptables rules of its own; ufw takes over so there is one set.
  ufw --force reset >/dev/null
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw --force enable
}

ssh_hardening() {
  log "SSH: keys only"
  install -d -m 0755 /etc/ssh/sshd_config.d
  cat >/etc/ssh/sshd_config.d/60-worker.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
CONF
  systemctl reload ssh || systemctl reload sshd
}

intrusion_prevention() {
  log "fail2ban: ban addresses that keep failing SSH"
  apt_install fail2ban
  # Ubuntu 24.04's sshd logs to the journal, not auth.log; bans go through ufw so there is one rule set.
  cat >/etc/fail2ban/jail.d/60-worker.local <<'CONF'
[sshd]
enabled = true
backend = systemd
banaction = ufw
maxretry = 5
findtime = 10m
bantime = 1h
CONF
  systemctl enable fail2ban
  systemctl restart fail2ban
}

docker_engine() {
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
    log "Docker already installed"
    return
  fi
  log "Docker engine and compose plugin"
  apt_install ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt_install docker-ce docker-ce-cli containerd.io docker-compose-plugin
  usermod -aG docker "$DEPLOY_USER"
  # Container logs are bounded by compose.yml; the daemon's default is bounded here too.
  cat >/etc/docker/daemon.json <<'CONF'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
CONF
  systemctl enable --now docker
}

worker_directory() {
  log "Worker directory at $WORKER_DIR"
  install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0750 "$WORKER_DIR"
  # compose.yml is copied here by the deploy alongside the env file; keep a copy from this
  # checkout so a fresh machine can start as soon as an env file and an image exist.
  if [ -f "$(dirname "$0")/compose.yml" ]; then
    install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0640 "$(dirname "$0")/compose.yml" "$WORKER_DIR/compose.yml"
  fi
}

worker_service() {
  log "Worker as a boot-time service"
  cat >/etc/systemd/system/worker.service <<CONF
[Unit]
Description=bhendi-bazaar job worker (compose stack)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$WORKER_DIR
# Only when the deploy has written an env file; before that there is nothing to run.
ExecCondition=/usr/bin/test -f $WORKER_DIR/.env
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
CONF
  systemctl daemon-reload
  systemctl enable worker.service
}

housekeeping() {
  log "Housekeeping timer: prune unused images weekly"
  cat >/etc/systemd/system/docker-prune.service <<'CONF'
[Unit]
Description=Prune unused Docker images
[Service]
Type=oneshot
ExecStart=/usr/bin/docker image prune -af --filter "until=168h"
CONF
  cat >/etc/systemd/system/docker-prune.timer <<'CONF'
[Unit]
Description=Weekly Docker image prune
[Timer]
OnCalendar=Sun *-*-* 04:00:00
Persistent=true
[Install]
WantedBy=timers.target
CONF
  systemctl daemon-reload
  systemctl enable --now docker-prune.timer
}

require_root
security_updates
firewall
ssh_hardening
intrusion_prevention
docker_engine
worker_directory
worker_service
housekeeping
log "Done. Next: the deploy writes $WORKER_DIR/.env and starts the stack."
