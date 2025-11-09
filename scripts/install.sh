set -e

filename=$(basename "$0")
dir=$(realpath "$0"|sed "s/$filename//g")
dir=${dir::-1}

kubectl apply -f $dir/resources.yaml

kubectl wait --for=condition=ready pod -l app=devc-cli -n devc --timeout=120s

devc (){
    POD_NAME=$(kubectl get pods \
              -n devc \
              -l app=devc-cli \
              -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    kubectl exec -i -t "$POD_NAME" -n devc -- /usr/local/bin/devc "$@"
}

export -f devc