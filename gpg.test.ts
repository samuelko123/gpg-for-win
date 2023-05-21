import os from "os";
import path from "path";
import { GpgProcess } from "./gpg";
import child_process from "child_process";
import util from "util";

const exec = util.promisify(child_process.exec);

describe("gpg", () => {
  it("creates a private key", async () => {
    const gpg = await createGpg();
    const name = "John Doe";
    const email = "john_doe@example.com";

    const key = await gpg.createPrimaryKey(name, email);

    expect(key.type).toEqual("sec");
    expect(key.creationTime).toBeInstanceOf(Date);
    expect(key.expirationTime).toEqual(new Date(0));
    expect(key.id).toMatch(/^[0-9A-F]{16}$/);
    expect(key.fingerprint).toMatch(/^[0-9A-F]{40}$/);
    expect(key.username).toEqual(`${name} <${email}>`);
  });

  it("creates a sub key", async () => {
    const gpg = await createGpg();
    const primaryKey = await gpg.createPrimaryKey("John Doe", "john_doe@example.com");

    const key = await gpg.createSubKey(primaryKey);

    expect(key.type).toEqual("ssb");
    expect(key.creationTime).toBeInstanceOf(Date);
    expect(key.expirationTime).toBeInstanceOf(Date);
    expect(key.expirationTime).not.toEqual(new Date(0));
    expect(key.id).toMatch(/^[0-9A-F]{16}$/);
    expect(key.fingerprint).toMatch(/^[0-9A-F]{40}$/);
    expect(key.username).toEqual(undefined);
  });

  it("gets public key block from sub key", async () => {
    const gpg = await createGpg();
    const primaryKey = await gpg.createPrimaryKey("John Doe", "john_doe@example.com");
    const subKey = await gpg.createSubKey(primaryKey);

    const block = await gpg.getPublicKeyBlock(subKey);

    expect(block).toMatch(/^-----BEGIN PGP PUBLIC KEY BLOCK-----/);
    expect(block).toMatch(/-----END PGP PUBLIC KEY BLOCK-----\r\n$/);
  });

  it("gets a private key by fingerprint", async () => {
    const gpg = await createGpg();
    await gpg.createPrimaryKey("John Doe", "john_doe_1@example.com");
    const createdKey = await gpg.createPrimaryKey("John Doe", "john_doe_2@example.com");
    await gpg.createPrimaryKey("John Doe", "john_doe_3@example.com");

    const retrievedKey = await gpg.getPrivateKeyByFingerprint(createdKey.fingerprint);

    expect(retrievedKey).toEqual(createdKey);
  });

  it("gets a private key by email", async () => {
    const gpg = await createGpg();
    const email = "john_doe_2@example.com";
    await gpg.createPrimaryKey("John Doe", "john_doe_1@example.com");
    const createdKey = await gpg.createPrimaryKey("John Doe", email);
    await gpg.createPrimaryKey("John Doe", "john_doe_3@example.com");

    const retrievedKey = await gpg.getPrivateKeyByEmail(email);

    expect(retrievedKey).toEqual(createdKey);
  });

  it("gets a public key by fingerprint", async () => {
    const gpg = await createGpg();
    await gpg.createPrimaryKey("John Doe", "john_doe_1@example.com");
    const createdKey = await gpg.createPrimaryKey("John Doe", "john_doe_2@example.com");
    await gpg.createPrimaryKey("John Doe", "john_doe_3@example.com");

    const retrievedKey = await gpg.getPublicKeyByFingerprint(createdKey.fingerprint);

    expect(retrievedKey).toEqual(Object.assign(createdKey, { type: "pub" }));
  });

  it("lists private keys", async () => {
    const gpg = await createGpg();
    const primaryKey = await gpg.createPrimaryKey("John Doe", "john_doe@example.com");
    const subKey = await gpg.createSubKey(primaryKey);

    const arr = await gpg.listPrivateKeys();

    expect(arr).toHaveLength(2);
    expect(arr).toContainEqual(primaryKey);
    expect(arr).toContainEqual(subKey);
  });

  it("lists public keys", async () => {
    const gpg = await createGpg();
    const primaryKey = await gpg.createPrimaryKey("John Doe", "john_doe@example.com");
    const subKey = await gpg.createSubKey(primaryKey);

    const arr = await gpg.listPublicKeys();

    expect(arr).toHaveLength(2);
    expect(arr).toContainEqual(Object.assign(primaryKey, { type: "pub" }));
    expect(arr).toContainEqual(Object.assign(subKey, { type: "sub" }));
  });

  it("deletes sub key", async () => {
    const gpg = await createGpg();
    const primaryKey = await gpg.createPrimaryKey("John Doe", "john_doe@example.com");
    await gpg.createSubKey(primaryKey);
    const subKey = await gpg.createSubKey(primaryKey);
    await gpg.createSubKey(primaryKey);

    await gpg.deleteSubKey(subKey);

    const privateKeys = await gpg.listPrivateKeys();
    const privatePrimaryKeys = privateKeys.filter((key) => key.type === "sec");
    const privateSubKeys = privateKeys.filter((key) => key.type === "ssb");
    expect(privatePrimaryKeys).toHaveLength(1);
    expect(privateSubKeys).toHaveLength(2);

    const publicKeys = await gpg.listPublicKeys();
    const publicPrimaryKeys = publicKeys.filter((key) => key.type === "pub");
    const publicSubKeys = publicKeys.filter((key) => key.type === "sub");
    expect(publicPrimaryKeys).toHaveLength(1);
    expect(publicSubKeys).toHaveLength(2);
  });

  it("deletes primary key (along with its sub keys)", async () => {
    const gpg = await createGpg();
    const primaryKeyToBeDeleted = await gpg.createPrimaryKey("John Doe", "john_doe_1@example.com");
    const primaryKeyToStay = await gpg.createPrimaryKey("John Doe", "john_doe_2@example.com");
    await gpg.createSubKey(primaryKeyToBeDeleted);
    await gpg.createSubKey(primaryKeyToBeDeleted);
    const subKeyToStay = await gpg.createSubKey(primaryKeyToStay);

    await gpg.deletePrimaryKey(primaryKeyToBeDeleted);

    const privateKeys = await gpg.listPrivateKeys();
    expect(privateKeys).toContainEqual(primaryKeyToStay);
    expect(privateKeys).toContainEqual(subKeyToStay);
  });
});

async function createGpg() {
  const tmpDir = path.join(os.tmpdir(), Date.now().toString());
  await exec(`mkdir "${tmpDir}"`);
  const gpg = new GpgProcess({
    homeDir: tmpDir,
    logFunc: () => {},
  });

  return gpg;
}
