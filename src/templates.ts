import { issuer_cfg, resource } from "./models";

export namespace templates {
  export function namespace(name: string): resource {
    return {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: name,
      },
    };
  }

  export function service_account(name: string, namespace: string): resource {
    return {
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: {
        name,
        namespace,
      },
    };
  }

  export function role(name: string, namespace: string): resource {
    return {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "Role",
      metadata: {
        name,
        namespace,
      },
      rules: [
        {
          apiGroups: [""],
          resources: [
            "pods",
            "pods/log",
            "pods/exec",
            "pods/attach",
            "services",
            "configmaps",
            "persistentvolumeclaims",
            "secrets",
            "events",
          ],
          verbs: ["*"],
        },
        {
          apiGroups: ["apps"],
          resources: [
            "deployments",
            "replicasets",
            "statefulsets",
            "daemonsets",
          ],
          verbs: ["*"],
        },
        {
          apiGroups: ["batch"],
          resources: ["jobs", "cronjobs"],
          verbs: ["*"],
        },
      ],
    };
  }

  export function role_binding(
    name: string,
    namespace: string,
    role: string,
    service_account: string,
  ): resource {
    return {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "RoleBinding",
      metadata: {
        name,
        namespace,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "Role",
        name: role,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: service_account,
          namespace,
        },
      ],
    };
  }

  export function pvc(
    name: string,
    namespace: string,
    selector: string,
    size_gb: number = 2,
  ): resource {
    return {
      apiVersion: "v1",
      kind: "PersistentVolumeClaim",
      metadata: {
        name: name,
        namespace: namespace,
        labels: {
          app: selector,
        },
      },
      spec: {
        accessModes: ["ReadWriteOnce"],
        resources: {
          requests: {
            storage: `${size_gb}Gi`,
          },
        },
      },
    };
  }

  export function service(
    name: string,
    namespace: string,
    selector: string,
    port: number = 22,
  ): resource {
    return {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: name,
        namespace: namespace,
      },
      spec: {
        selector: {
          app: selector,
        },
        ports: [
          {
            protocol: "TCP",
            port: port,
            targetPort: port,
          },
        ],
      },
    };
  }

  export function deployment(
    name: string,
    namespace: string,
    image: string,
    pvc: string,
    service_account: string,
    authorized_keys: string,
  ): resource {
    return {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name,
        namespace,
        labels: {
          app: name,
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
            },
          },
          spec: {
            serviceAccountName: service_account,
            volumes: [
              {
                name: "workspace",
                persistentVolumeClaim: {
                  claimName: pvc,
                },
              },
            ],
            containers: [
              {
                name,
                image,
                env: [
                  {
                    name: "AUTHORIZED_KEYS",
                    value: authorized_keys,
                  },
                ],
                volumeMounts: [
                  {
                    name: "workspace",
                    mountPath: `/home/vscode/sysp`,
                  },
                ],
              },
            ],
          },
        },
      },
    };
  }

  export function gateway(
    name: string,
    namespace: string,
    hostname: string,
    tls_secret: string,
    static_section_name: string,
    issuer: issuer_cfg,
  ): resource {
    return {
      apiVersion: "gateway.networking.k8s.io/v1",
      kind: "Gateway",
      metadata: {
        name: name,
        namespace: namespace,
        annotations: {
          "cert-manager.io/issuer": issuer.name,
          "cert-manager.io/issuer-kind": issuer.kind,
          ...(issuer.group && { "cert-manager.io/issuer-group": issuer.group }),
        },
      },
      spec: {
        //require default gateway classname
        gatewayClassName: "eg",
        listeners: [
          {
            allowedRoutes: {
              namespaces: {
                from: "Same",
              },
              kinds: [
                {
                  kind: "TCPRoute",
                },
              ],
            },
            name: static_section_name,
            port: 443,
            protocol: "TLS",
            hostname: hostname,
            tls: {
              certificateRefs: [
                {
                  name: tls_secret,
                },
              ],
              mode: "Terminate",
            },
          },
        ],
      },
    };
  }

  export function tcproute(
    name: string,
    namespace: string,
    gateway: string,
    service: string,
    static_section_name: string,
    port: number = 22,
  ): resource {
    return {
      apiVersion: "gateway.networking.k8s.io/v1alpha2",
      kind: "TCPRoute",
      metadata: {
        name: name,
        namespace: namespace,
      },
      spec: {
        parentRefs: [
          {
            name: gateway,
            namespace: namespace,
            sectionName: static_section_name, //one gw<=>one user<=>on tcp route, this should be static actually
          },
        ],
        rules: [
          {
            backendRefs: [
              {
                kind: "Service",
                name: service,
                port: port,
              },
            ],
          },
        ],
      },
    };
  }

  export function certificate(
    name: string,
    namespace: string,
    secret: string,
    issuer: issuer_cfg,
    subject_alt_name: string,
  ): resource {
    return {
      apiVersion: "cert-manager.io/v1",
      kind: "Certificate",
      metadata: {
        name,
        namespace,
      },
      spec: {
        secretName: secret,

        commonName: name,

        usages: ["client auth"],

        dnsNames: [subject_alt_name],

        issuerRef: issuer,
      },
    };
  }

  export function client_traffic_policy(
    name: string,
    namespace: string,
    gateway: string,
    secret: string,
    subject_alt_name: string,
  ): resource {
    return {
      apiVersion: "gateway.envoyproxy.io/v1alpha1",
      kind: "ClientTrafficPolicy",
      metadata: {
        name,
        namespace,
      },
      spec: {
        targetRefs: [
          {
            group: "gateway.networking.k8s.io",
            kind: "Gateway",
            name: gateway,
          },
        ],
        tls: {
          clientValidation: {
            caCertificateRefs: [
              {
                kind: "Secret",
                name: secret,
              },
            ],
            subjectAltNames: {
              dnsNames: [
                {
                  value: subject_alt_name,
                },
              ],
            },
          },
        },
      },
    };
  }

  //not used for now
  export function __network_policy(name: string, namespace: string): resource {
    return {
      apiVersion: "networking.k8s.io/v1",
      kind: "NetworkPolicy",
      metadata: {
        name,
        namespace,
      },
      spec: {
        podSelector: {},
        policyTypes: ["Ingress", "Egress"],
        ingress: [
          {
            from: [
              {
                podSelector: {},
              },
            ],
          },
        ],
        egress: [{}],
      },
    };
  }
}
