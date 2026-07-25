#!/bin/sh
controller="$(jq -n '{}')"
controller_enabled=false

add_if_set() {
    env_var="$1"
    json_key="$2"

    value="$(printenv "$env_var" || true)"

    if [ -n "$value" ]; then
        controller_enabled=true
        controller="$(echo "$controller" | jq \
            --arg key "$json_key" \
            --arg value "$value" \
            '. + {($key): $value}')"
    else
        echo "WARNING: $env_var is not set, skipping '$json_key'" >&2
    fi
}

add_if_set DEVC_CONTROLLER_DOMAIN domain
add_if_set DEVC_CONTROLLER_NAMESPACE namespace
add_if_set DEVC_CONTROLLER_ISSUER_NAME issuer-name
add_if_set DEVC_CONTROLLER_ISSUER_KIND issuer-kind
add_if_set DEVC_CONTROLLER_POOL_LABEL pool

echo Created config:
echo $controller

if [ "$controller_enabled" = true ]; then
    jq -n \
        --argjson controller "$controller" \
        '{
            plugins: {
                controller: $controller
            },
            deploy: {},
            delete: {},
            list: {}
        }' > config.json

    devc --config set config.json
else
    echo "No controller configuration provided; skipping config setup."
fi

exec "$@"