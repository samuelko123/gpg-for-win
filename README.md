# GPG for Windows

A minimalistic Node.js interop with GPG for unattended key generation.

#### Note

The `GnuPG` folder consists of files directly copied from [Gpg4win](https://www.gpg4win.org/) installation.

In your local git repository, run the follow commands to enable git commit signing.
`git config --local gpg.program "<file path of gpg.exe>"`
`git config --local user.signingkey <private sub key fingerprint>`
`git config --local commit.gpgsign true`

#### Basic Understanding of GPG

There are 2 kinds of keys. Each key has a private part and a public part.
- Primary key
- Sub key

Keys have 4 kinds of capabilities.
- Encrypt
- Sign
- Certify
- Authenticate

#### Git Commit Signing

##### Overview

- The primary key is used to **certify** sub key.
- The private sub key is used to **sign** commits.
- The public sub key is uploaded to [Github](https://github.com/settings/gpg/new) to verify the commits.


##### Things to note

- **DO NOT** delete a primary key
- **DO NOT** delete a sub key unless it is compromised
- **DO** upload new sub key to Github when created

Let's say we have a primary key (`PKA`) and two sub keys attached to it (`SKA` and `SKB`).

If we delete `PKA`, both `SKA` and `SKB` will be destroyed. In terms of git signing, you can create new primary key and sub key to sign new commits. Existing commits in Github will stay `verified` unless you remove `PKA` public key from Github.

If we delete `SKA`, The commits signed by `SKA` will still be `verified`. However, if we re-generate a `SKB` public key and upload to Github, it will not have `SKA` information, therefore those `SKA` commits will become `unverified`.

If we create new sub key (`SKC`) under `PKA`. Even if we told git to use `SKB`, it will use `SKC` instead. New commits will be `unverified` because Github does not have `SKC` public key. We will need to delete the `SKB` public key from Github and upload the `SKC` public key.

##### Discussion on Security

If a private sub key is compromised, the attacker can use it to sign malicious commits. Although a passphrase can be used to protect the sub key, but it can be brute-forced.

Therefore, the compromised sub key should be deleted locally. Then, a new sub key should be created and uploaded to Github. If possible, use the new sub key to re-sign all the existing legitimate commits.

If a primary key is compromised, the attacker can create new sub keys, but cannot upload it to your Github account. Therefore, you are basically safe in terms of git signing.

##### Obscure Technical Stuff
- The manual for colon-delimited output can be found [here](https://github.com/CSNW/gnupg/blob/master/doc/DETAILS).
- Command line usage of `--quick-generate-key` and `--quick-add-key` can be found [here](https://www.gnupg.org/documentation/manuals/gnupg/OpenPGP-Key-Management.html).
- To correctly delete a subkey in gpg, a `!` is suffixed to the fingerprint. (Read [more](https://security.stackexchange.com/questions/207138/how-do-i-delete-secret-subkeys-correctly))