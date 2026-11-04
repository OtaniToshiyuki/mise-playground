# xzero-business の mise 移行メモ

`/Users/to-otani/Desktop/xzero-business` で、eas-cli / firebase-tools / node / pnpm / java の管理を mise に移行するためのメモ。
手順は [mise: Use mise in an existing project](https://mise.jdx.dev/walkthrough.html) に沿う。このうち行うのは「ツールの宣言」「個人設定の分離」「チームへの共有」の 3 節。「タスク」「ツールの更新」は今回は不要。

## 現状(確認済み。変更はしていない)

- `.nvmrc`: `22.15`。
- `package.json`: `engines.node >=22.15.0`、`engines.pnpm >=10.33.0`、`packageManager: pnpm@10.33.0`。
- `firebase-tools` は `apps/firebase/package.json` の依存(`^15.17.0`)。
- `eas` は `apps/native/package.json` のスクリプトから呼ばれている。依存としては書かれていない。
- CI: `.github/workflows/ci.yml` に `actions/setup-java@v4`(Java 21)がある。
- `JDK21` は ローカルのグローバルで管理

## 行うこと

### 1. ツールを宣言する

ルートで `mise use` を実行し、`mise.toml` を作る。

```sh
mise use node@22 pnpm@10 java@zulu-21 'npm:eas-cli@27' 'npm:firebase-tools@15'
```

- **Node の版**: `.nvmrc`(`22.15`)と `engines`(`>=22.15.0`)に整合する版にする。`24` に上げるかは別の判断。
- **`.nvmrc`**: 残すと二重管理になる。次のどちらかを決める。
  - `mise.toml` に一本化して `.nvmrc` を削除する
  - `.nvmrc` を正にする場合は、`mise.toml` に `idiomatic_version_file_enable_tools = ["node"]` を書く。
- **`firebase-tools`**: `apps/firebase` の依存から外す。

### 2. `packageManager` の扱い

`packageManager: pnpm@10.33.0` は corepack 向けの指定。mise に合わせるなら削除する。mise の `pnpm` を `10.33` にそろえれば、`engines.pnpm` とも矛盾しない。

### 3. 個人設定を分ける

`mise.local.toml` を `.gitignore` に追加する(今の `.gitignore` にはない)。

### 4. チームに共有する

```sh
mise lock
git add mise.toml mise.lock
```

ロックファイルを共有する。新しい機能を使うなら `min_version` も書く。

## 追加で確認すること(walkthrough にはない)

- **CI**: `ci.yml` が `setup-java@v4`、Node、pnpm を自前で入れている。mise に移すなら `jdx/mise-action` に置き換えるかを決める。`web-deploy.yml` と `admin-deploy.yml` も確認する。
- **Vercel など**: `mise.toml` も `.nvmrc` も読まない環境があるなら、`engines.node` は残す。
- **`.npmrc`**: `link-workspace-packages` など pnpm の設定は、mise に影響しない。
