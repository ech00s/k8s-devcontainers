import { plugin} from "cli-maker";
import { randomBytes } from "crypto";
import { devc_env_cfg, devc_generator } from "./generators";
import { _controller, derror, is_derror } from "./controller-impl";
import { resource,language, supported_languages } from "./models";
type languages = Record<language,string> & Record<string,string>

interface controller_config{
    namespace:string;
    pool:string;
    domain:string;
    issuer_name:string;
    issuer_kind:string;
    issuer_group:string;
    languages:languages;
    overrides:languages;
}

export class controller extends plugin<controller_config>{
    
    constructor(){
        super({
            namespace:"devc",
            domain:"local.hack",
            pool:"devc-root",
            issuer_name:"",
            issuer_kind:"",
            issuer_group:"",
            languages:supported_languages.reduce((obj,l)=>{
                return {...obj,[l]:`echo00s/dev-container:${l}`}
            },{}) as any,
            overrides:{} as any
        },{
            namespace:"str",
            domain:"str",
            pool:"str",
            issuer_name:"str",
            issuer_kind:"str",
            issuer_group:"str",
            languages:"$ref/obj/languages",
            overrides:"$ref/obj/languages"
        },{
            "languages":supported_languages.reduce((obj,l)=>{
                return {...obj,[l]:"str"}
            },{})
        })
    }
    
    inject_pool(
        resources:resource[],
        pool:string
    ):resource[]{

        return resources.map(resource => ({
            ...resource,
            metadata:{
                ...resource.metadata,
                labels:{
                    ...(resource.metadata.labels ?? {}),
                    "devc.io/pool":pool
                }
            }
        }));
    }
        //deploy
    public async deploy(
        language: string,
        pvc_size:number,
        authorized_keys:string[],
        _user_prefix?:string,
    ):Promise<string|derror>{
        //controller context
        const ctrl_cfg = this.config
        const user_prefix = _user_prefix ? _user_prefix : randomBytes(4).toString('hex')
        const prefix = `${ctrl_cfg.namespace}-${user_prefix}`
        const override:string|undefined = this.get_val("overrides")[language]
        const image = override && override.length > 0 ? override : ctrl_cfg.languages[language]
        //env = user + controller
        const env_config:devc_env_cfg = {
            prefix:prefix,
            image:image,
            pvc_size:pvc_size,
            authorized_keys:authorized_keys,
            domain:ctrl_cfg.domain,
            issuer:{
                name:ctrl_cfg.issuer_name,
                kind:ctrl_cfg.issuer_kind,
                ...(ctrl_cfg.issuer_group.length > 0 && {group:ctrl_cfg.issuer_group})
            }
        }
        const resources = this.inject_pool(
            new devc_generator().generate(env_config),
            this.get_val("pool")
        )
        const res = await _controller.deploy(resources)
        if(!res){
            return prefix;
        }
        return res;
    }

    public async delete(user_prefix:string):Promise<null|derror>{
        //only the prefix matters here really
        const objects = new devc_generator().generate(
            {
                prefix:`${this.get_val("namespace")}-${user_prefix}`,
                image:"irrelevant",
                pvc_size:1,
                authorized_keys:[],
                domain:"irrelevant",
                issuer:{
                    name:"irrelevant",
                    kind:"irrelevant",
                    group:"irrelevant"
                }
            }
        )
        return await _controller.delete(objects)
    }
    
    public async list_managed_namespaces():Promise<resource[]|derror>{
        return await _controller.list([
            {
                kind:"Namespace",
                apiVersion:"v1",
                metadata:{
                    name:"irrelevant"
                }
            }
        ],
        this.get_val("pool"))
    }
    
    public async list_namespace_resources(prefix:string):Promise<resource[]|derror>{
        //only the prefix matters here really
        const objects = new devc_generator().generate(
            {
                prefix:prefix,
                image:"irrelevant",
                pvc_size:1,
                authorized_keys:[],
                domain:"irrelevant",
                issuer:{
                    name:"irrelevant",
                    kind:"irrelevant",
                    group:"irrelevant"
                }
            }
        )
        return await _controller.list(objects)
    }
}
