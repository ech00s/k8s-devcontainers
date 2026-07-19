import { env_cfg, issuer_cfg ,generator, resource} from "./models";
import { templates as tpls } from "./templates";
export interface devc_env_cfg extends env_cfg{
    prefix:string,
    image:string,
    pvc_size:number,
    authorized_keys:string[],
    domain:string,
    issuer:issuer_cfg
}


export class devc_generator implements generator<devc_env_cfg>{
  generate(cfg:devc_env_cfg):resource[]{
        const n = {
            namespace : `${cfg.prefix}`,

            // RBAC
            service_account : `${cfg.prefix}-sa`,
            role : `${cfg.prefix}-role`,
            role_binding : `${cfg.prefix}-rb`,

            // Config/storage
            pvc : `${cfg.prefix}-pvc`,
            service : `${cfg.prefix}-svc`,
            deployment : `${cfg.prefix}-depl`,

            // Gateway API
            gateway : `${cfg.prefix}-gw`,
            route : `${cfg.prefix}-route`,
            client_traffic_policy : `${cfg.prefix}-ctp`,
            
            // Certificates
            certificate : `${cfg.prefix}-cert`,

            // Network
            network_policy : `${cfg.prefix}-netpol`,
        }
        return [
            tpls.namespace(
                n.namespace
            ),

            tpls.service_account(
                n.service_account,
                n.namespace
            ),

            tpls.role(
                n.role,
                n.namespace
            ),

            tpls.role_binding(
                n.role_binding,
                n.namespace,
                n.role,
                n.service_account
            ),

            tpls.pvc(
                n.pvc,
                n.namespace,
                n.deployment,
                cfg.pvc_size
            ),

            tpls.service(
                n.service,
                n.namespace,
                n.deployment
            ),

            tpls.deployment(
                n.deployment,
                n.namespace,
                cfg.image,
                n.pvc,
                n.service_account,
                cfg.authorized_keys.join(",")
            ),
            
            tpls.gateway(
                n.gateway,
                n.namespace,
                `${cfg.prefix}.${cfg.domain}`,
                cfg.prefix,
                "tls",
                cfg.issuer
            ),

            tpls.tcproute(
                n.route,
                n.namespace,
                n.gateway,
                n.service,
                "tls"
            ),

            tpls.certificate(
                n.certificate,
                n.namespace,
                n.certificate,
                cfg.issuer,
                cfg.prefix
            ),
            tpls.client_traffic_policy(
                n.client_traffic_policy,
                n.namespace,
                n.gateway,
                n.certificate,
                cfg.prefix,
            )
        ];
    }

}