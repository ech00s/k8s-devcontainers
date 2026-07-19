import * as k8s from '@kubernetes/client-node';
import { kube_object, resource } from './models';

export interface derror{
    details:string
}

export function is_derror(o:any): o is derror{
    return typeof o === "object" && !!o.details && typeof o.details === "string"
}



export class _controller{
    private static client(){
        const kc = new k8s.KubeConfig();
        kc.loadFromCluster();

        return k8s.KubernetesObjectApi.makeApiClient(kc);
    }
    //deploy
    static async deploy(
        resources:resource[]
    ):Promise<null|derror>{
        const client = _controller.client()
        try {
            for(const resource of resources){
                await client.create(resource);
            }

            return null;

        } catch(err) {

            return {
                details:`${err}`
            };
        }
    }

    //delete
    static async delete(
        objects:kube_object[]
    ):Promise<null|derror>{
        let errors:string[] = []
        const client = _controller.client();
        for(const object of [...objects].reverse()){
            try{
                await client.delete({
                    apiVersion:object.apiVersion,
                    kind:object.kind,
                    metadata:object.metadata
                });
            }catch(err){
                errors.push(`${err}`)
            }
        }
        return errors.length > 0 ? {details:errors.join("\n")} : null
    }



    //list
    static async list(
        objects:kube_object[],
        labelSelector?:string
    ):Promise<resource[]|derror>{

        const client = _controller.client();
        const resources:resource[] = [];

        try{
            for(const object of objects){
                const result = await client.list(
                    object.apiVersion,
                    object.kind,
                    object.metadata.namespace,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    labelSelector
                );

                for(const item of result.items){
                    resources.push(item as resource);
                }
            }
            return resources
        }
        catch(err){
            return {
                details:`${err}`
            }
        }
    }
}