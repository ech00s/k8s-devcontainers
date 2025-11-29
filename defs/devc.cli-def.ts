import  {cmd_builder,logger,cli_builder} from "cli-maker"
import { controller,is_derror} from "../controller"

const new_builder = cmd_builder.make_builder({logger,controller})
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
    .add_named("tag","str",{
        optional:true,
        shorthand:"-t",
        description:"Tag for the dev containe resources, used for delete and hostname generation"
    })
    .add_named("key-files","path",{
        optional:false,
        variadic:true,
        description:"Paths to the ssh keys to authorize"
    })
    .add_func(async ({logger,controller},{
        language,
        workspace,
        tag,
        ["pvc-size"]:pvc_size,
        ["key-files"]:key_files
    })=>{
        if(pvc_size>5 || pvc_size<=0){
           logger.throw("Invalid pvc size: "+pvc_size.toString())
        }

        const res = await controller.deploy(
            language,
            workspace,
            pvc_size,
            key_files,
            tag
        )

        if(is_derror(res)){
            logger.throw(`Error while deploying: ${res.details}`)
        }
        logger.info(`Successfully deployed: ${res}, under ${res}.${controller.get_val("domain")}`)
    })
    .build()

const delete_cmd = new_builder("delete","Delete dev container resources")
    .add_named("tag","str",{
        shorthand:"-t",
        description:"Tag of the dev container to delete"
    })
    .add_func(async ({logger,controller},{tag})=>{
        const res = await controller.delete(tag)
        if(is_derror(res)){
            logger.throw(`Error while marking ${tag} for deletion: ${res.details}`)
        }
        logger.info(`${tag} resources marked for deletion`)
    })
    .build()

const list_cmd = new_builder("list","List currently deployed container tags")
    .add_func(async ({logger,controller})=>{
        const res = await controller.list()
        if(is_derror(res)){
            logger.throw(`Error while listing resources: ${res.details}`)
        }
        logger.info(res)
    })
    .build()

const devc = new cli_builder("devc","Deploy and manage dev containers over kubernetes")
    .add_subcmd(deploy_cmd)
    .add_subcmd(delete_cmd)
    .add_subcmd(list_cmd)
    .build()

export default devc;