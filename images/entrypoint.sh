#!/bin/bash
set -e

USER=vscode
HOME=/home/vscode

mkdir -p "$HOME/.ssh"

printf "%s" "$AUTHORIZED_KEYS" \
    | tr ',' '\n' \
    > "$HOME/.ssh/authorized_keys"

chown -R "$USER:$USER" "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
chmod 600 "$HOME/.ssh/authorized_keys"
ssh-keygen -A
exec /usr/sbin/sshd -D