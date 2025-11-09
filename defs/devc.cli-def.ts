import * as CM from "cli-maker"
import { clean_up, deploy, list_containers } from "../functions"

const new_builder = CM.cmd_builder.make_builder()
const deploy_cmd = new_builder("deploy","Deploy a dev container")
    .add_named("language","enum",{
        choices:[
            "cpp",
            "python",
            "java",
            "go",
            "rust",
            "typescript-node"
        ],
        shorthand:"-l",
        description:"Dev container language"
    })
    .add_named("namespace","str",{
        default:"devc",
        shorthand:"-n",
        description:"Deployment namespace"
    })
    .add_named("workspace","str",{
        default:"workspace",
        shorthand:"-w",
        description:"Workspace folder name"
    })
    .add_named("pvc-size","int",{
        default:1,
        shorthand:"-s",
        description:"Workspace persistent volume size"
    })
    .add_func(async ({logger},{
        language,
        namespace,
        workspace,
        ["pvc-size"]:pvc_size
    })=>{
        if(pvc_size>5 || pvc_size<=0){
           logger.throw("Invalid pvc size: "+pvc_size.toString())
        }
        await deploy(
            language,
            namespace,
            workspace,
            pvc_size,
            logger
        )
    })
    .build()

const delete_cmd = new_builder("delete","Delete dev container resources")
    .add_named("port","int",{
        shorthand:"-p",
        description:"NodePort of dev container service"
    })
    .add_named("namespace","str",{
        default:"devc",
        shorthand:"-n",
        description:"Deployment namespace"
    })
    .add_func(async ({logger},{port,namespace})=>{
        if(port<30000 || port>=32767){
            logger.throw("Invalid port: "+port.toString())
        }
        await clean_up(
            namespace,
            port,
            logger
        )
    })
    .build()

const list_cmd = new_builder("list","List currently used nodeports")
    .add_named("namespace","str",{
        default:"devc",
        shorthand:"-n",
        description:"Deployment namespace"
    })
    .add_func(async ({logger},{namespace})=>{
        await list_containers(
            namespace,
            logger
        )
    })
    .build()

const devc = new CM.cli_builder("devc","Deploy and manage dev containers over kubernetes")
    .add_subcmd(deploy_cmd)
    .add_subcmd(delete_cmd)
    .add_subcmd(list_cmd)
    .build()

export default devc;