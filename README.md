# mise playground: eas-cli / firebase-tools を mise で管理する

`eas-cli` と `firebase-tools` を `package.json` に入れず、mise で版を固定する検証。
検証日: 2026-10-29 / mise 2026.10.21 / WSL2 (Ubuntu) / Node 24.22.2

## 構成

- `mise.toml`: Node / pnpm / eas-cli / firebase-tools を宣言。`npm:` バックエンドのインストーラは pnpm (`[settings] npm.package_manager = "pnpm"`)
- `mise.lock`: `mise lock` で生成。範囲指定(`"27"`, `"15"`)を exact な版・チェックサムに固定
- `eas.json`: `cli.version = ">=27.0.0"`
- `package.json`: eas-cli を含まない最小構成(`eas` がプロジェクトとして認識するための空殻)

## 検証結果

| # | 内容 | 結果 | メモ |
|---|---|---|---|
| 1 | `mise.toml` だけで版固定 | ○ | `mise.lock` を併用すると範囲指定でも exact に固定される |
| 2 | `eas --version` / `firebase --version` | ○ | `eas-cli/27.1.0` / `15.34.2`。`mise which` は `~/.local/share/mise/installs/...` を指す |
| 3 | `eas.json` と衝突しないか | ○ | 範囲内ならエラーなし。`>=99.0.0` だと `does not satisfy the CLI version constraint defined in eas.json` で停止。`EAS_SKIP_CLI_VERSION_CHECK=1` で回避可。**`eas whoami` 等は版チェックをしない**ので、確認には `eas config -p ios` のようなプロジェクト系コマンドが必要 |
| 4 | eas-cli の依存警告が出ない | ○ | `package.json` に eas-cli が無いので警告なし |
| 5 | 管理外ディレクトリで解決されない | △ | 下記参照 |
| 6 | CI で再現 | 未検証 | ワークフローは用意したが、リモート未作成のためローカルでは実行不可。push 後にログの版とキャッシュ効果を確認する |

### 5. 管理外ディレクトリの挙動(`cd /tmp`)

- `activate` していてもシェルの PATH に `~/.local/share/mise/shims` が残っていると、`eas` は `mise ERROR No version is set for shim: eas` で失敗(= 解決されない。想定どおり)
- `firebase` は **Windows 側の nvm4w (`/mnt/c/nvm4w/nodejs/firebase`, 15.17.0)** が WSL の PATH 経由で見えており、そちらが動いた。mise とは無関係な WSL 固有の混入
- 純 Linux 環境なら「見えない」になるはず(未確認)

## Firebase エミュレータ + vitest

- `test/firestore.test.ts`: firebase-admin で Firestore エミュレータに書き込み・読み戻しする 2 テスト
- `pnpm run test:emulator` = `firebase emulators:exec --only firestore ... "pnpm test"`(`firebase` は mise の版、`vitest` / `firebase-admin` のみ devDependencies)
- エミュレータ用に Java が必要 → `java = "temurin-21"` を mise で固定
- ローカル(WSL)では 8080 が使用中だったため `firebase.json` は port 18080
- `mise lock` は Java の Windows 版メタデータ解決に失敗するため、`lockfile_platforms` で Windows を除外
- ローカル実行: 2 テスト成功、約 10 秒
- CI: `test` ジョブで `pnpm install --frozen-lockfile` → `pnpm run test:emulator`(未実行)

## 数値

| 項目 | mise (pnpm) | devDependencies (pnpm) |
|---|---|---|
| 初回インストール時間 | `mise install` 約 9〜11 秒(キャッシュ無し、4 ツール、node 取得含む。pnpm 利用時) | `pnpm add -D` 約 5 秒(node 除く) |
| ディスク | node 208M / eas-cli 156M / firebase-tools 218M / pnpm 93M(`~/.local/share/mise`、全プロジェクトで共有) | `node_modules` 367M(プロジェクトごと) |
| lockfile | `mise.lock` (ツール数が少なく、全プラットフォーム分のチェックサム入り) | `pnpm-lock.yaml` 7,671 行 |
| eas-cli 警告 | なし | `pnpm exec eas config` の先頭出力では確認できず(未確認) |

## `npm:` バックエンドと pnpm

- `npm.package_manager` 設定が存在し、`"auto"`(既定)/ `"pnpm"` などを取る(`mise settings ls --all` で確認)。`pnpm` で eas-cli / firebase-tools ともに問題なくインストールできた
- `mise settings set` は既定でグローバル設定 (`~/.config/mise/config.toml`) に書く。プロジェクトで再現させるには `mise.toml` の `[settings]` に書く
- firebase-tools は pnpm のビルドスクリプト承認 (`pnpm approve-builds -g`) の案内が出るが、動作には影響しなかった

## 判断

(CI の結果を確認してから確定。ここまでの所見では、eas-cli の公式方針(プロジェクト依存に入れない)とも合い、lockfile 肥大も避けられるため mise 採用に傾く。)

## 未確認

- CI(GitHub Actions + `jdx/mise-action`)での再現とキャッシュ効果
- 純 Linux / Windows ネイティブでの管理外ディレクトリの挙動
- `compare/dev-dependencies` ブランチ(数値は一時ディレクトリで計測しただけ)

## minimumReleaseAge(CI で発覚)

- mise は `npm.package_manager = "pnpm"` のとき、pnpm に `--config.minimum-release-age=1440`(24 時間)を渡す。公開から 24 時間未満の版は `ERR_PNPM_NO_MATURE_MATCHING_VERSION` で入らず、`mise install` が失敗する
- 初回 CI は eas-cli 27.1.0 (19h) / firebase-tools 15.34.2 (14h) で失敗した
- 解除(採用): `[settings]` に `minimum_release_age_excludes = ["npm:eas-cli", "npm:firebase-tools"]`。この 2 つだけ対象外になり、他のツールには保護が残る(ローカルで公開 13〜19 時間の版が入ることを確認)
- 全体を解除する場合は `minimum_release_age = "0d"`。環境変数 `npm_config_minimum_release_age` では効かない
- 対象外にした 2 つは公開直後の版も入る。厳密に守るなら対象外にせず、24 時間以上経った版に固定する
