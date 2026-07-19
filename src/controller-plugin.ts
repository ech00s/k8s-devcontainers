import { plugin, type } from "cli-maker";
import { randomBytes } from "crypto";
import { devc_env_cfg, devc_generator } from "./generators";
import { _controller } from "./controller-impl";
import { resource, language, supported_languages } from "./models";
export interface derror {
  details: string;
}

export function is_derror(o: any): o is derror {
  return (
    o && typeof o === "object" && !!o.details && typeof o.details === "string"
  );
}

type language_arg = `${language}-image`;
type language_args = Record<language_arg, string>;

interface controller_config extends language_args {
  namespace: string;
  pool: string;
  domain: string;
  "issuer-name": string;
  "issuer-kind": string;
  "issuer-group": string;
}

export class controller extends plugin<controller_config> {
  constructor() {
    super(
      {
        namespace: "",
        domain: "",
        pool: "",
        "issuer-name": "",
        "issuer-kind": "",
        "issuer-group": "",
        ...supported_languages.reduce((obj, l) => {
          return { ...obj, [`${l}-image`]: `ech00s/dev-container:${l}` };
        }, {} as language_args),
      },
      {
        namespace: "str",
        domain: "str",
        pool: "str",
        "issuer-name": "str",
        "issuer-kind": "str",
        "issuer-group": "str",
        ...supported_languages.reduce((obj, l) => {
          return { ...obj, [`${l}-image`]: "str" };
        }, {}),
      },
      {},
    );
  }

  inject_pool(resources: resource[], pool: string): resource[] {
    return resources.map((resource) => ({
      ...resource,
      metadata: {
        ...resource.metadata,
        labels: {
          ...(resource.metadata.labels ?? {}),
          "devc.io/pool": pool,
        },
      },
    }));
  }
  //deploy
  public async deploy(
    language: language,
    pvc_size: number,
    authorized_keys: string[],
    _user_prefix?: string,
  ): Promise<string | derror> {
    //controller context
    const user_prefix = _user_prefix
      ? _user_prefix
      : randomBytes(4).toString("hex");
    const prefix = `${this.get_val("namespace")}-${user_prefix}`;
    console.log(prefix);
    const issuer_kind = this.get_val("issuer-kind");
    const issuer_name = this.get_val("issuer-name");
    const issuer_group = this.get_val("issuer-group");

    if (pvc_size > 5 || pvc_size <= 0) {
      return {
        details: "Invalid pvc size: " + pvc_size.toString(),
      };
    }

    if (issuer_kind.length === 0 || issuer_name.length === 0) {
      return {
        details: "Missing issuer for dev environment template",
      };
    }

    //env = user + controller
    const env_config: devc_env_cfg = {
      prefix: prefix,
      image: this.get_val(`${language}-image`),
      pvc_size: pvc_size,
      authorized_keys: authorized_keys,
      domain: this.get_val("domain"),
      issuer: {
        name: issuer_name,
        kind: issuer_kind,
        ...(issuer_group.length > 0 && { group: issuer_group }),
      },
    };

    const resources = this.inject_pool(
      new devc_generator().generate(env_config),
      this.get_val("pool"),
    );

    try {
      await _controller.deploy(resources);
      return prefix;
    } catch (err) {
      return {
        details: `${err}`,
      };
    }
  }

  public async delete(user_prefix: string): Promise<null | derror> {
    //only the prefix matters here really
    const objects = new devc_generator().generate({
      prefix: `${this.get_val("namespace")}-${user_prefix}`,
      image: "irrelevant",
      pvc_size: 1,
      authorized_keys: [],
      domain: "irrelevant",
      issuer: {
        name: "irrelevant",
        kind: "irrelevant",
        group: "irrelevant",
      },
    });
    let errors: string[] = [];
    for (const object of [...objects].reverse()) {
      try {
        await _controller.delete({
          apiVersion: object.apiVersion,
          kind: object.kind,
          metadata: object.metadata,
        });
      } catch (err) {
        errors.push(`${err}`);
      }
    }
    return errors.length > 0 ? { details: errors.join("\n") } : null;
  }

  public async list_managed_namespaces(): Promise<resource[] | derror> {
    try {
      return await _controller.list(
        [
          {
            kind: "Namespace",
            apiVersion: "v1",
            metadata: {
              name: "irrelevant",
            },
          },
        ],
        this.get_val("pool"),
      );
    } catch (err) {
      return {
        details: `${err}`,
      };
    }
  }

  public async list_namespace_resources(
    prefix: string,
  ): Promise<resource[] | derror> {
    //only the prefix matters here really
    const objects = new devc_generator().generate({
      prefix: prefix,
      image: "irrelevant",
      pvc_size: 1,
      authorized_keys: [],
      domain: "irrelevant",
      issuer: {
        name: "irrelevant",
        kind: "irrelevant",
        group: "irrelevant",
      },
    });
    try {
      return await _controller.list(objects);
    } catch (err) {
      return {
        details: `${err}`,
      };
    }
  }
}
