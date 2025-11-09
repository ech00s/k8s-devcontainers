filename=$(basename "$0")
dir=$(realpath "$0"|sed "s/$filename//g")
dir=${dir::-1}

kubectl delete -f $dir/resources.yaml