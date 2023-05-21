import path from "path";
import child_process from "child_process";
import util from "util";

export enum GpgKeyType {
  PRIVATE_PRIMARY_KEY = "sec",
  PRIVATE_SUB_KEY = "ssb",
  PUBLIC_PRIMARY_KEY = "pub",
  PUBLIC_SUB_KEY = "sub",
}

enum GpgRecordType {
  FINGERPRINT = "fpr",
  KEY_GRIP = "grp",
  USER_ID = "uid",
}

type GpgKey = {
  type: GpgKeyType;
  id: string;
  fingerprint: string;
  username?: string;
  creationTime: Date;
  expirationTime?: Date;
};

type ExecuteFunc = (cmd: string) => Promise<{ stdout: string; stderr: string }>;

type LogFunc = (mesage: string) => void;

type GpgProcessOptions = {
  homeDir?: string;
  logFunc?: (mesage: string) => void;
};

export class GpgProcess {
  private homedir: string;
  private gpgPath: string;
  private execute: ExecuteFunc;
  private log: LogFunc;

  constructor(options?: GpgProcessOptions) {
    const { homeDir, logFunc } = options || {};
    this.homedir = homeDir || path.join(process.env.APPDATA || "", "gnupg");
    this.log = logFunc || console.debug;
    this.gpgPath = path.join(__dirname, "GnuPG", "bin", "gpg.exe");
    this.execute = util.promisify(child_process.exec);
  }

  async createPrimaryKey(name: string, email: string, passphrase: string = "") {
    const args = ` --quick-generate-key --batch --passphrase "${passphrase}" "${name} <${email}>" ed25519 cert never`;
    await this.exec(args);

    const keys = await this.listPrivateKeys();
    return keys[keys.length - 1];
  }

  async deletePrimaryKey(primaryKey: GpgKey) {
    await this.deletePrivatePrimaryKey(primaryKey);
    await this.deletePublicPrimaryKey(primaryKey);
  }

  async createSubKey(primaryKey: GpgKey, passphrase: string = "") {
    const args = ` --quick-add-key --batch --passphrase "${passphrase}" ${primaryKey.fingerprint} ed25519 sign 1y`;
    await this.exec(args);

    const keys = await this.listPrivateKeys();
    return keys[keys.length - 1];
  }

  async deleteSubKey(subKey: GpgKey) {
    await this.deletePrivateSubKey(subKey);
    await this.deletePublicSubKey(subKey);
  }

  async getPublicKeyBlock(subKey: GpgKey) {
    const args = ` --armor --export ${subKey.fingerprint}`;
    const { stdout: publicKey } = await this.exec(args);
    return publicKey;
  }

  async listPrivateKeys() {
    const message = await this.listPrivateKeysRaw();
    return this.parseRawKeys(message);
  }

  async listPublicKeys() {
    const message = await this._listPublicKeysRaw();
    return this.parseRawKeys(message);
  }

  async getPrivateKeyByFingerprint(fingerprint: string) {
    const keys = await this.listPrivateKeys();
    return keys.filter((k) => k.fingerprint === fingerprint)[0];
  }

  async getPrivateKeyByEmail(email: string) {
    const keys = await this.listPrivateKeys();
    return keys.filter((k) => k.username?.includes(email))[0];
  }

  async getPublicKeyByFingerprint(fingerprint: string) {
    const keys = await this.listPublicKeys();
    return keys.filter((k) => k.fingerprint === fingerprint)[0];
  }

  private async parseRawKeys(message: string) {
    const keys: GpgKey[] = [];
    let obj: Partial<GpgKey> = {};

    const lines = message.split("\r\n");
    for (const line of lines) {
      const fields = line.split(":");
      const type = fields[0];
      const keyId = fields[4];
      const creationTime = new Date(Number(fields[5]) * 1000);
      const expirationTime = new Date(Number(fields[6]) * 1000);
      const id = fields[9];

      switch (type) {
        case GpgKeyType.PRIVATE_PRIMARY_KEY:
        case GpgKeyType.PRIVATE_SUB_KEY:
        case GpgKeyType.PUBLIC_PRIMARY_KEY:
        case GpgKeyType.PUBLIC_SUB_KEY:
          // push the previous key
          const key = this.validateKey(obj);
          if (key) {
            keys.push(key);
          }
          // create a new key
          obj = { type, creationTime, expirationTime, id: keyId };
          break;
        case GpgRecordType.FINGERPRINT:
          obj.fingerprint = id;
          break;
        case GpgRecordType.USER_ID:
          obj.username = id;
          break;
      }
    }

    // push the final key
    const key = this.validateKey(obj);
    if (key) {
      keys.push(key);
    }

    return keys;
  }

  private async listPrivateKeysRaw() {
    const args = ` --list-secret-keys --with-colons --with-fingerprint`;
    const { stdout } = await this.exec(args);
    return stdout;
  }

  private async _listPublicKeysRaw() {
    const args = ` --list-public-keys --with-colons --with-fingerprint`;
    const { stdout } = await this.exec(args);
    return stdout;
  }

  private async deletePrivatePrimaryKey(primaryKey: GpgKey) {
    const args = ` --batch --delete-secret-key --yes ${primaryKey.fingerprint}`;
    await this.exec(args);
  }

  private async deletePublicPrimaryKey(publicKey: GpgKey) {
    const args = ` --batch --delete-key --yes ${publicKey.fingerprint}`;
    await this.exec(args);
  }

  private async deletePrivateSubKey(subKey: GpgKey) {
    const args = ` --batch --delete-secret-key --yes ${subKey.fingerprint}!`;
    await this.exec(args);
  }

  private async deletePublicSubKey(subKey: GpgKey) {
    const args = ` --batch --delete-key --yes ${subKey.fingerprint}!`;
    await this.exec(args);
  }

  private validateKey(obj: Partial<GpgKey>): GpgKey | null {
    if (obj.type && obj.id && obj.fingerprint && obj.creationTime) {
      return Object.assign(obj, {
        type: obj.type,
        id: obj.id,
        fingerprint: obj.fingerprint,
        username: obj.username,
        creationTime: obj.creationTime,
        expirationTime: obj.expirationTime,
      });
    }
    return null;
  }

  private async exec(args: string) {
    this.log(`[gpg] ${args}`);
    return await this.execute(
      `"${this.gpgPath}" --homedir "${this.homedir}" ${args}`
    );
  }
}
