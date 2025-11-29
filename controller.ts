import { plugin} from "cli-maker";
import * as k8s from '@kubernetes/client-node';
import { randomBytes } from "crypto";
import { readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

interface ingress_annotations{
    "cert-manager.io/issuer":string;
    "cert-manager.io/issuer-group":string;
    "cert-manager.io/issuer-kind":string;
}

interface controller_config{
    namespace:string;
    workspace:string;
    domain:string;
    ingress_annotations:ingress_annotations
}

interface derror{
    details:string
}

export function is_derror(o:any): o is derror{
    return typeof o === "object" && !!o.details && typeof o.details === "string"
}



export class controller extends plugin<controller_config>{
    
    constructor(){
        super({
            namespace:"devc",
            domain:"example.com",
            workspace:"/.devc",
            ingress_annotations:{
                "cert-manager.io/issuer":"letsencrypt",
                "cert-manager.io/issuer-group":"cert-manager.io/v1",
                "cert-manager.io/issuer-kind":"issuer"
            }
        },{
            namespace:"str",
            domain:"str",
            workspace:"str",
            ingress_annotations:"$ref/obj/ingress_annotations"
        },{
            "ingress_annotations":{
                issuer:"str",
                "issuer-group":"str",
                "issuer-kind":"str"
            }
        })
    }

    create_manifest(
        IMAGE:string,
        TAG:string,
        NAMESPACE:string,
        PVC_SIZE:number,
        DOMAIN:string,
        WORKSPACE_FOLDER:string,
        AUTHORIZED_KEYS:string
    ){
        return [
            {
                "apiVersion":"v1",
                "kind":"ConfigMap",
                "metadata":{
                    "name":`${TAG}-cfgmap`,
                    "namespace":NAMESPACE
                },
                "data":{
                    "entrypoint.sh":''+
                        'apt-get update && apt-get install -y openssh-server\n'+
                        'mkdir /home/vscode/.ssh \\n'+
                        '    && touch /home/vscode/.ssh/authorized_keys \\n'+
                        '    && chown -R vscode:vscode /home/vscode/.ssh \\n'+
                        '    && chmod 700 /home/vscode/.ssh \\n'+
                        '    && chmod 600 /home/vscode/.ssh/authorized_keys\n'+
                        'sed -i "s/#PasswordAuthentication yes/PasswordAuthentication no/g" /etc/ssh/sshd_config \\n'+
                        '    && sed -i "s/#PermitRootLogin prohibit-password/PermitRootLogin no/g" /etc/ssh/sshd_config \\n'+
                        '    && sed -i "s/#PubkeyAuthentication yes/PubkeyAuthentication yes/g" /etc/ssh/sshd_config \\n'+
                        '    && sed -i "s/#AuthorizedKeysFile .*/AuthorizedKeysFile .ssh/authorized_keys/g"\n'+
                        'IFS="," read -ra SPLIT_KEYS<<< "$AUTHORIZED_KEYS"\n'+
                        'for key in "${AUTHORIZED_KEYS[@]}"; do\n'+
                        '    echo $key >> ~/.ssh/authorized_keys\n'+
                        'done\n'+
                        'service ssh start -D\n'
                }
            },
            {
                "apiVersion": "v1",
                "kind": "PersistentVolumeClaim",
                "metadata": {
                    "name": `${TAG}-pvc`,
                    "namespace":NAMESPACE,
                    "labels": {
                    "app": TAG
                    }
                },
                "spec": {
                    "accessModes": [
                    "ReadWriteOnce"
                    ],
                    "resources": {
                    "requests": {
                        "storage": `${PVC_SIZE}Gi`
                    }
                    }
                }
            },
            {
                "apiVersion": "v1",
                "kind": "Service",
                "metadata": {
                    "name": `${TAG}-svc`,
                    "namespace": NAMESPACE
                },
                "spec": {
                    "selector": {
                    "app": TAG
                    },
                    "ports": [
                    {
                        "protocol": "TCP",
                        "port": 22,
                        "targetPort": 22
                    }
                    ]
                }
            },
            {
                "apiVersion": "gateway.networking.k8s.io/v1alpha2",
                "kind": "TCPRoute",
                "metadata": {
                    "name": `${TAG}-route`,
                    "namespace": NAMESPACE
                },
                "spec": {
                    "parentRefs": [
                    {
                        "name": `${TAG}-gw`,
                        "namespace": NAMESPACE,
                        "sectionName": `tls-${TAG}`
                    }
                    ],
                    "rules": [
                    {
                        "backendRefs": [
                        {
                            "kind": "Service",
                            "name": `${TAG}-svc`,
                            "port": 22
                        }
                        ]
                    }
                    ]
                }
            },
            {
                "apiVersion": "gateway.networking.k8s.io/v1",
                "kind": "Gateway",
                "metadata": {
                    "name": `${TAG}-gw`,
                    "namespace": NAMESPACE,
                    "annotations": this.get_val("ingress_annotations") as any
                },
                "spec": {
                    "gatewayClassName": "eg",
                    "listeners": [
                    {
                        "allowedRoutes": {
                        "namespaces": {
                            "from": "Same"
                        },
                        "kinds": [
                            {
                            "kind": "TCPRoute"
                            }
                        ]
                        },
                        "name": `tls-${TAG}`,
                        "port": 443,
                        "protocol": "TLS",
                        "hostname": `${TAG}.${DOMAIN}`,
                        "tls": {
                        "certificateRefs": [
                            {
                            "kind": "Secret",
                            "name": `tls-${TAG}-cert`
                            }
                        ],
                        "mode": "Terminate"
                        }
                    }
                    ]
                }
            },
            {
                "apiVersion": "apps/v1",
                "kind": "Deployment",
                "metadata": {
                    "name": `${TAG}-depl`,
                    "namespace": NAMESPACE,
                    "labels": {
                    "app": TAG
                    }
                },
                "spec": {
                    "replicas": 1,
                    "selector": {
                        "matchLabels": {
                            "app": TAG
                        }
                    },
                    "template": {
                        "metadata": {
                            "labels": {
                            "app": TAG
                            }
                        },
                        "spec": {
                            "volumes": [
                                {
                                    "name": `${TAG}-vol`,
                                    "persistentVolumeClaim": {
                                        "claimName": `${TAG}-pvc`
                                    }
                                },
                                {
                                    "name":`${TAG}-shared`,
                                    "emptyDir":{}
                                },
                                {
                                    "name":`${TAG}-init`,
                                    "configMap":{
                                        "name":`${TAG}-cfgmap`
                                    }
                                }
                            ],
                            "initContainers":[
                                {
                                    "name":`${TAG}-init`,
                                    "image": IMAGE,
                                    "command":["sh","-c"],
                                    "volumeMounts": [
                                        {
                                            "name":`${TAG}-shared`,
                                            "mountPath":`/home/vscode/entrypoint`
                                        },
                                        {
                                            "name":`${TAG}-init`,
                                            "mountPath":"/init"
                                        }
                                    ],
                                    "args":[
                                        "cp /init/entrypoint.sh /home/vscode/entrypoint && chmod +x /home/vscode/entrypoint/entrypoint.sh"
                                    ]
                                }
                            ],
                            "containers": [
                            {
                                "name": TAG,
                                "env": [{
                                    name: 'AUTHORIZED_KEYS',
                                    value: AUTHORIZED_KEYS
                                }],
                                "image": IMAGE,
                                "volumeMounts": [
                                    {
                                        "name": `${TAG}-vol`,
                                        "mountPath": `/home/vscode/${WORKSPACE_FOLDER}`
                                    },
                                    {
                                        "name":`${TAG}-shared`,
                                        "mountPath":`/home/vscode/entrypoint`
                                    }
                                ],
                                "command":["/home/vscode/entrypoint/entrypoint.sh"]
                            }
                            ]
                        }
                    }
                }
            }
        ]
    }

    //deploy
    async deploy(
        language: string,
        workspace_folder:string,
        pvc_size:number,
        key_files:string[],
        tag?:string,
    ):Promise<string|derror>{
        const kc = new k8s.KubeConfig();
        kc.loadFromCluster();
        const client = k8s.KubernetesObjectApi.makeApiClient(kc);
        //preprocess
        if(!tag) tag = `${language}.${randomBytes(4).toString('hex')}`
        const file_path = join(this.get_val("workspace"),`${tag}.yaml`);
        const authorized_keys = 
            key_files.map(kf=>readFileSync(kf,"utf-8"))
                .join(",")
        const image = `mcr.microsoft.com/devcontainers/${language}:bookworm`
        //create manifest
        const json_manifest = this.create_manifest(
            image,
            tag,
            this.get_val("namespace"),
            pvc_size,
            this.get_val("domain"),
            workspace_folder,
            authorized_keys
        )
        //parse it
        const manifest = k8s.dumpYaml(json_manifest)
        //store it
        writeFileSync(
            file_path,
            manifest
        )
        //apply it 
        try {
            await Promise.all(json_manifest.map((rs)=>client.create(rs)))
            return tag
        } catch (err) {
            json_manifest.forEach(async (rs)=> {
                try{
                    await client.delete(rs)
                }catch(_){}
            })
            try{
                rmSync(file_path)
            }catch(_){}
            return {details:`${err}`}
        }
    }

    //delete
    async delete(
        tag:string,
    ):Promise<void>{
        const kc = new k8s.KubeConfig();
        kc.loadFromCluster();
        const client = k8s.KubernetesObjectApi.makeApiClient(kc);
        const file_path = join(this.get_val("workspace"),`${tag}.yaml`);
        //get the manifest
        const manifest = readFileSync(
            join(this.get_val("workspace"),tag),
            "utf-8"
        )
        //parse it
        const json_manifest:any[] = k8s.loadYaml(manifest)

        //delete it
        json_manifest.forEach(async (rs)=>{
            try{
                await client.delete(rs)
            }catch(_){}
        })
        //delete file
        try{
            rmSync(file_path)
        }catch(_){}
    }

    //list
    async list():Promise<string|derror>{
        const kc = new k8s.KubeConfig();
        kc.loadFromCluster();
        const kcs = kc.makeApiClient(k8s.CoreV1Api);
        try {
            return (await kcs.listNamespacedService({namespace:this.get_val("namespace")})).items
                    .map(s=>s.metadata?.name!)
                    .reduce((str,name)=>{
                        return str+name+"\n"
                    },"TAG\n")
        } catch (err) {
            return {details:`${err}`}
        }
    }
}