import * as k8s from "@kubernetes/client-node";
import { kube_object, resource } from "./models";
import path from "path";

export class _controller {
  private static _client: k8s.KubernetesObjectApi | undefined = undefined;
  private static client() {
    if (!_controller._client) {
      const kc = new k8s.KubeConfig();
      kc.loadFromCluster();
      _controller._client = k8s.KubernetesObjectApi.makeApiClient(kc);
    }

    return _controller._client;
  }
  //deploy
  static async deploy(resources: resource[]): Promise<void> {
    const client = _controller.client();
    for (const resource of resources) {
      await client.create(resource);
    }
  }

  //delete
  static async delete(object: kube_object): Promise<void> {
    const client = _controller.client();
    await client.delete({
      apiVersion: object.apiVersion,
      kind: object.kind,
      metadata: object.metadata,
    });
  }

  //list
  static async list(
    objects: kube_object[],
    labelSelector?: string,
  ): Promise<resource[]> {
    const client = _controller.client();
    const resources: resource[] = [];
    for (const object of objects) {
      const result = await client.list(
        object.apiVersion,
        object.kind,
        object.metadata.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector,
      );
      for (const item of result.items) {
        resources.push(item as resource);
      }
    }
    return resources;
  }
}
