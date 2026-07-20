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

cat >/etc/kubeconfig <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    server: https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}
  name: cluster
contexts:
- context:
    cluster: cluster
    user: sa
  name: default
current-context: default
users:
- name: sa
  user:
    tokenFile: /var/run/secrets/kubernetes.io/serviceaccount/token
EOF

exec /usr/sbin/sshd -D