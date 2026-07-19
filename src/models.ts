export interface metadata extends Record<string, any> {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
}

export interface kube_object {
  apiVersion: string;
  kind: string;
  metadata: metadata;
}

export interface resource extends kube_object, Record<string, any> {}

export interface issuer_cfg {
  name: string;
  kind: string;
  group?: string;
}

export interface env_cfg extends Record<string, any> {}

export interface generator<T extends env_cfg> {
  generate(cfg: T): resource[];
}

export const supported_languages: [
  "cpp",
  "python",
  "go",
  "rust",
  "typescript-node",
  "java",
] = ["cpp", "python", "go", "rust", "typescript-node", "java"] as const;
export type language = (typeof supported_languages)[number];
