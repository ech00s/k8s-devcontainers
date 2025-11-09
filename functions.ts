import * as k8s from '@kubernetes/client-node';
import {} from 'cli-maker'
function mk_prefix(language:string):string{
    return `${language}-${Date.now()}`
}

function mk_depl(
    prefix:string,
    language: string,
    workspace:string
): k8s.V1Deployment {
    const app_name = prefix+'-devcontainer';
    const tag = `ech00s/ssh-dev-${language}:alpha0.1.0`;
    const mount_path = "/home/vscode/"+workspace;
    return {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
            name: app_name,
            labels: { app: app_name, language: language }
        },
        spec: {
            replicas: 1,
            selector: { matchLabels: { app: app_name } },
            template: {
                metadata: { labels: { app: app_name } },
                spec: {
                    volumes: [{
                        name: 'workspace-volume',
                        persistentVolumeClaim: {
                            claimName: `${prefix}-pvc`
                        }
                    }],
                    containers: [{
                        name: app_name,
                        image: tag, 
                        volumeMounts: [{
                            name: 'workspace-volume',
                            mountPath: mount_path
                        }],
                        env: [{
                            name: 'SSH_CMD',
                            value: `cd ${mount_path} && /bin/bash`
                        }],
                        ports: [{ containerPort: 22, name: 'ssh-port' }]
                    }]
                }
            }
        }
    };
}

function mk_svc(nodePort: number, app_prefix: string): k8s.V1Service {
    return {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
            name: `${app_prefix}-service`
        },
        spec: {
            type: 'NodePort',
            selector: { app: `${app_prefix}-devcontainer` },
            ports: [{
                port: 22, 
                targetPort: 22,
                nodePort: nodePort 
            }]
        }
    };
}

function mk_pvc(prefix: string,size:number): k8s.V1PersistentVolumeClaim {
    return {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
            name: `${prefix}-pvc`,
            labels: { app: `${prefix}-devcontainer` }
        },
        spec: {
            accessModes: ['ReadWriteOnce'],
            resources: {
                requests: {
                    storage: size.toString()+"Gi"
                }
            }
        }
    };
}

async function find_prefix(kcs: k8s.CoreV1Api,node_port:number,namespace:string):Promise<string|undefined>{
    try{
        return (await kcs.listNamespacedService({namespace:namespace})).items
            .find(
                s => 
                s.spec?.type === 'NodePort' && 
                s.spec.ports?.some(p => p.nodePort === node_port)
            )
            ?.metadata
            ?.name?.replace("-service","")
    }catch(_){
        return undefined
    }
}

async function find_nodeport(kcs: k8s.CoreV1Api): Promise<number> {
    let available_ports = new Set<number>(new Array(2767).fill(30000).map((v,i)=>v+i));
    (await kcs.listServiceForAllNamespaces()).items
        .forEach(s=>{
            if(s.spec?.type === 'NodePort' || s.spec?.type === 'LoadBalancer'){
                s.spec.ports?.forEach(p=>{
                    if(p.nodePort) available_ports.delete(p.nodePort);
                })
            }
        })
    if (available_ports.size === 0) {
        throw new Error("NodePort range is fully exhausted (30000-32767).");
    }
    return available_ports.values().next().value!;
}

async function rollback (
    prefix:string,
    namespace:string,
    kcs:k8s.CoreV1Api,
    kcd:k8s.AppsV1Api,
    logger:any
){
    try { 
        await kcs.deleteNamespacedService({
            namespace:namespace,
            gracePeriodSeconds:0,
            propagationPolicy:"Foreground",
            name:`${prefix}-service`
                    
            }); 
    } catch (e) { logger.error(e)}
    try { 
        await kcd.deleteNamespacedDeployment({
            namespace:namespace,
            gracePeriodSeconds:0,
            propagationPolicy:"Foreground",
            name:`${prefix}-devcontainer`
                    
            }); 
    } catch (e) { logger.error(e)}
    try { 
        await kcs.deleteNamespacedPersistentVolumeClaim({
            namespace:namespace,
            gracePeriodSeconds:0,
            propagationPolicy:"Foreground",
            name:`${prefix}-pvc`
                    
            }); 
    } catch (e) { logger.error(e)}
    };

export async function clean_up(
    namespace:string,
    node_port:number,
    logger:any
){
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster();
    const kcd = kc.makeApiClient(k8s.AppsV1Api);
    const kcs = kc.makeApiClient(k8s.CoreV1Api);
    try {
        const prefix = await find_prefix(kcs,node_port,namespace);
        if(!prefix){
            logger.throw(`Cannot cleanup for node_port ${node_port}: service not found`)
            return;
        }
        await rollback(prefix,namespace,kcs,kcd,logger)
        
    } catch (err) {
        logger.error('Error creating Kubernetes resources:', err);
    }
}

export async function deploy(
    language: string,
    namespace:string,
    workspace:string,
    size:number,
    logger:any
) {
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster();
    
    const kcd = kc.makeApiClient(k8s.AppsV1Api);
    const kcs = kc.makeApiClient(k8s.CoreV1Api);
    const prefix = mk_prefix(language);

    try {
        const node_port = await find_nodeport(kcs);
        await kcs.createNamespacedPersistentVolumeClaim({namespace:namespace,body:mk_pvc(prefix,size)});
        await kcd.createNamespacedDeployment({namespace:namespace,body:mk_depl(prefix,language,workspace)});
        await kcs.createNamespacedService({namespace:namespace,body:mk_svc(node_port, prefix)});
    } catch (err) {
        logger.error('Error creating Kubernetes resources:', err);
        await rollback(prefix,namespace,kcs,kcd,logger)
    }
}

export async function list_containers(
    namespace:string,
    logger:any
) {
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster();
    const kcs = kc.makeApiClient(k8s.CoreV1Api);

    try {
        logger.info(
            (await kcs.listNamespacedService({namespace:namespace})).items
                .map(s=>{
                    return {
                        name:s.metadata?.name!,
                        port:s.spec?.ports?.at(0)?.nodePort!
                    }
                })
                .reduce((str,{name,port})=>{
                    return str+name+"\t\t"+port.toString()+"\n"
                },"NAME\t\tPORT\n")
        )
    } catch (err) {
        logger.error('Error listing Kubernetes resources:', err);
    }
}