import {
  cmd_builder,
  logger,
  cli_builder,
  register_plugin,
  meta_arg,
  add_meta_arg,
} from "cli-maker";
import { controller, is_derror } from "../src/controller-plugin";
import { supported_languages } from "../src/models";

register_plugin(controller);

const namespace: meta_arg = {
  plugin: "controller",
  shorthands: ["-n", "--namespace"],
  name: "namespace",
  key: "namespace",
  type: "str",
};

add_meta_arg(namespace);

const domain: meta_arg = {
  plugin: "controller",
  shorthands: ["-d", "--domain"],
  name: "domain",
  key: "domain",
  type: "str",
};

add_meta_arg(domain);

const pool: meta_arg = {
  plugin: "controller",
  shorthands: ["-p", "--pool"],
  name: "pool",
  key: "pool",
  type: "str",
};

add_meta_arg(pool);

for (const sl of supported_languages) {
  const name = `${sl}-image`;
  const meta: meta_arg = {
    plugin: "controller",
    shorthands: [`--${name}`],
    name: name,
    key: name,
    type: "str",
  };
  add_meta_arg(meta);
}

const new_builder = cmd_builder.make_builder({ logger, controller });
const deploy_cmd = new_builder("deploy", "Deploy a dev container")
  .add_named("language", "enum", {
    choices: supported_languages,
    shorthand: "-l",
    description: "Dev container language",
  })
  .add_named("pvc-size", "int", {
    default: 1,
    shorthand: "-s",
    description: "Workspace persistent volume size",
  })
  .add_named("tag", "str", {
    optional: true,
    shorthand: "-t",
    description:
      "Tag for the dev containe resources, used for delete and hostname generation",
  })
  .add_pos("str", {
    variadic: true,
    description: "Public ssh keys to authorize",
  })
  .add_func(
    async (
      { logger, controller },
      { language, tag, ["pvc-size"]: pvc_size },
      ...keys
    ) => {
      const res = await controller.deploy(language, pvc_size, keys, tag);

      if (is_derror(res)) {
        logger.throw(`Error while deploying: ${res.details}`);
      }
      logger.info(
        `Successfully deployed: ${res}, under ${res}.${controller.get_val("domain")}`,
      );
    },
  )
  .build();

const delete_cmd = new_builder("delete", "Delete dev container resources")
  .add_named("tag", "str", {
    shorthand: "-t",
    description: "Tag of the dev container to delete",
  })
  .add_func(async ({ logger, controller }, { tag }) => {
    const res = await controller.delete(tag);
    if (is_derror(res)) {
      logger.throw(`Error while marking ${tag} for deletion:\n${res.details}`);
    }
    logger.info(`${tag} resources marked for deletion`);
  })
  .build();

const list_cmd = new_builder("list", "List currently deployed container tags")
  .add_func(async ({ logger, controller }) => {
    const res = await controller.list_managed_namespaces();
    if (is_derror(res)) {
      logger.throw(`Error while listing namespaces: ${res.details}`);
      return;
    }
    if (res.length === 0) {
      logger.info("No environments created yet.");
      return;
    }
    for (const r of res) {
      try {
        const ures = await controller.list_namespace_resources(r.metadata.name);
        if (is_derror(ures)) {
          logger.throw(
            `Error while listing resources for namespace ${r.metadata.name}: ${ures.details}`,
          );
          return;
        }
        for (const ur of ures) {
          logger.info(`${ur.kind}: ${ur.metadata.name}`);
        }
      } catch (err) {
        logger.throw(`Error while going through managed resources: ${err}`);
      }
    }
  })
  .build();

const devc = new cli_builder(
  "devc",
  "Deploy and manage dev containers over kubernetes",
)
  .add_subcmd(deploy_cmd)
  .add_subcmd(delete_cmd)
  .add_subcmd(list_cmd)
  .build();

export default devc;
