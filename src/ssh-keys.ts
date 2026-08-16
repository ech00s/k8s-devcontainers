import {
    generateKeyPairSync as generate_key_pair,
    KeyObject
} from 'crypto'

// Convert Base64URL -> Buffer
function b64_to_buffer(value:string) {
  return Buffer.from(value, "base64url");
}


// SSH "string":
// uint32 length + bytes
function buffer_to_ssh_string(buffer:Buffer<ArrayBuffer>) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(buffer.length);

  return Buffer.concat([length, buffer]);
}


// SSH "mpint":
// uint32 length + two's-complement integer
function buffer_to_ssh_mpint(buffer:Buffer<ArrayBuffer>) {
  // Remove unnecessary leading zeroes
  while (buffer.length > 1 && buffer[0] === 0x00) {
    buffer = buffer.subarray(1);
  }

  // mpint is signed.
// If the high bit is set, prepend a zero byte
  // to make the number positive.
  if (buffer.length > 0 && (buffer[0] & 0x80)) {
    buffer = Buffer.concat([
      Buffer.from([0x00]),
      buffer
    ]);
  }

  return buffer_to_ssh_string(buffer);
}

function ssh_serialize_public_key(keyObject:KeyObject, comment:string = "") {
  const jwk = keyObject.export({
    format: "jwk"
  });

  if (jwk.kty !== "RSA") {
    throw new Error("Only RSA keys are supported");
  }

  const e = b64_to_buffer(jwk.e!);
  const n = b64_to_buffer(jwk.n!);

  const keyType = Buffer.from("ssh-rsa");

  const blob = Buffer.concat([
    buffer_to_ssh_string(keyType),
    buffer_to_ssh_mpint(e),
    buffer_to_ssh_mpint(n)
  ]);

  const result = `ssh-rsa ${blob.toString("base64")}`;

  return comment ? `${result} ${comment}` : result;
}

export function get_key_pair(comment:string = ""):{ssh_serialized_public_key:string,exported_private_key:string}{
    const { privateKey, publicKey } = generate_key_pair("rsa", {
        modulusLength: 2048,
    });
    const ssh_serialized_public_key = ssh_serialize_public_key(publicKey,comment)
    const exported_private_key:string = privateKey.export({
        format: "pem",
        type: "pkcs1"
    }) as string
    return {ssh_serialized_public_key,exported_private_key}
}
