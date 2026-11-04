# オンボーディング

## チームメンバーが移行時・参加時に行う手順

- [Installing mise](https://mise.jdx.dev/installing-mise.html#installing-mise)
- [Getting started](https://mise.jdx.dev/getting-started.html#activate-mise)

```sh
# 【PC につき 1 回だけ】
curl -fsSL https://mise.run | sh # brew版もあるが動作が遅いためmise.run推奨
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc
exec zsh

# 【リポジトリごとに 1 回】
mise trust      # mise.toml を信頼(新しいリポジトリごとに必要)
mise install    # node / pnpm / java / eas-cli / firebase-tools / lefthook を導入
lefthook install  # lefthook.yml の Git フックを .git に登録する
```

## mise install コマンド

`mise.toml`に記載されたtoolsをmiseが管理する領域にインストールする

[mise install](https://mise.jdx.dev/cli/install.html#mise-install)。

- 引数なしの `mise install` は、設定(`mise.toml`)が求めるツールのうち、**まだ入っていない版だけ**を入れる。入っていれば何もしない。
- `mise install node@24` のようにツールを指定すると、その版を入れる。ツール名だけ(`mise install node`)なら、設定が求める版を入れる。
- オプション:

  | オプション                     | 内容                                                                                |
  | ------------------------------ | ----------------------------------------------------------------------------------- |
  | `-n` / `--dry-run`             | 何が入るかを表示するだけで、インストールはしない                                    |
  | `--dry-run-code`               | `--dry-run` と同じで、入れるものがあれば終了コード 1 を返す(スクリプトで判定に使う) |
  | `-f` / `--force`               | 入っていても入れ直す                                                                |
  | `-v` / `--verbose`             | インストーラの出力を表示する                                                        |
  | `-q` / `--quiet`               | エラー以外のメッセージを出さない(`mise` 全体で使えるグローバルオプション)           |
  | `--minimum-release-age <期間>` | 指定の日付や期間より前に公開された版だけを入れる(例: `90d`)                         |

## mise の有効化(activate)

[mise-activate](https://mise.jdx.dev/cli/activate.html#mise-activate)より。

リポジトリ間で自動的に tools のバージョンを切り替えるためには、シェルのディレクトリ移動などのタイミングをトリガーにする必要がある。
`mise activate`コマンドで出力されるスクリプトをシェルの`eval`で評価しシェルに登録することで、ディレクトリ移動時やプロンプト表示の直前のフックにmiseの更新処理が登録される。

詳しい流れは、次の「仕組み」を参照。

- GitHub Actions の `jdx/mise-action` は PATH を後続のステップに渡すので、`mise exec` なしで `pnpm ...` などをそのまま実行できる(「CI(GitHub Actions)」参照)。

### 仕組み

1. `mise activate zsh` は、zsh 用の**スクリプトを出力する**だけで、それ自体は何も有効にしない。
2. `eval` と組み合わせる(`eval "$(mise activate zsh)"`)と、出力されたスクリプトが**実行したシェルの中で**実行され、有効になる。`.zshrc` に書くと、シェルを開くたびに 1 回実行される。
3. 実行されたスクリプトの中で、zsh の `precmd`(プロンプト表示の直前)と `chpwd`(ディレクトリ移動時)に、mise の更新処理(`mise hook-env`)が登録される。
4. 以降は、ディレクトリを移動したり、コマンドが終わってプロンプトが出たりするたびに、zsh がその処理を呼ぶ。そのため、移動した先の `mise.toml` に合わせて、ツールの PATH と環境変数が切り替わる。

## lefthook

### 役割

- Git のフック(`pre-push` / `post-merge` / `post-checkout` など、Git の操作に合わせて自動で走る処理)を、`lefthook.yml` で一括管理するツール。
- `.git/hooks/` はコミットされないので、そのままではチームで共有できない。lefthook は設定ファイルを `lefthook.yml` としてリポジトリに置き、全員が同じフックを使えるようにする。
- このリポジトリでの用途:
  - `post-merge` / `post-checkout`: pull やブランチ切替のあとに `mise install --quiet` を実行し、`mise.toml` の版を自動で適用する。`--quiet`(`-q`)は進捗や情報メッセージを出さないオプションで、エラーだけ表示される。pull / checkout のたびに出力が流れないようにしている。
- lefthook 本体も mise で版を固定している(`mise.toml`)。

### 仕組み

- `lefthook install` を実行すると、`.git/hooks/` には `lefthook.yml` に登録されているフックの実行スクリプト(`pre-push` / `post-merge` など)のみが記録される。
- `lefthook.yml` の内容(`commands` や `run` など)はスクリプトに書き込まれず、フックが走るたびに読み直される。
- `lefthook run` のたびに、`lefthook.yml` が変わっていないかを `.git/info/lefthook.checksum`(内容のハッシュ)で確認する。変わっていれば `.git/hooks/` を自動で同期する。

## pnpm について

- このプロジェクトの pnpm は mise が管理する。グローバル版(`~/Library/pnpm` や Homebrew)とは別の領域にあり、どちらが使われるかは PATH の順序で決まる。
- 使用中の pnpm の確認

  ```sh
  which -a pnpm   # 先頭が実際に使われるもの
  mise which pnpm
  mise doctor
  ```

  - パスが `~/.local/share/mise/...` なら mise 版。
  - `~/Library/pnpm` や `/opt/homebrew/bin` が先頭ならグローバル版が優先されている。
  - mise が pnpm を入れるので Corepack は不要([mise 公式](https://mise.jdx.dev/lang/node.html#corepack))。`corepack enable` を実行していると、Node の `bin` ディレクトリに corepack の `pnpm` が置かれる(例: `~/.local/share/mise/installs/node/<版>/bin/pnpm`)。パスがここを指していたら、mise の pnpm ではなく corepack 経由になっている。mise 版に統一するなら `corepack disable` する。なお mise の設定 `node.corepack = true` にすると、mise が Node のインストール後に `corepack enable` を自動実行する。

- mise で pnpm のバージョンを管理する場合、`package.json` の `packageManager` での指定は不要(書くなら mise と同じバージョンにそろえる)。
- corepack から mise に移行するとき
  1. `corepack disable` を実行する(Node の版ごとの設定なので、使っている版で実行する)
  2. `mise.toml` に `pnpm` の版を書く
  3. `package.json` の `packageManager` を消す(残すなら mise と同じ版にする)
  4. `which -a pnpm` で、パスが `~/.local/share/mise/...` になったことを確認する

## Node について

- Node は `mise.toml` の `node` で管理する。nodebrew、nvm、Homebrew 版の node は、このプロジェクトでは不要。
- 使用中の node の確認(pnpm と同じ要領)。

  ```sh
  which -a node   # 先頭が実際に使われるもの
  mise which node
  ```

  - パスが `~/.local/share/mise/...` なら mise 版。
  - `~/.nodebrew/current/bin` や `/opt/homebrew/bin` が先頭なら、旧ツールの node が優先されている。

- nodebrew などを入れていた場合
  - 他の古いプロジェクトで使っているなら、残してよい。mise を有効化したディレクトリでは mise 版が優先される。
  - すべて mise に移した場合、`~/.zshrc` / `~/.zprofile` の `PATH="$HOME/.nodebrew/current/bin:$PATH"` の行を消し、`~/.nodebrew` を削除する。削除前に `npm ls -g` でグローバルパッケージの有無を確認する。
- Vercel など `mise.toml` を読まない環境では、`package.json` の `engines.node` で指定する。

## CI(GitHub Actions)

公式ドキュメント: [Continuous integration](https://mise.jdx.dev/continuous-integration.html#github-actions) / [jdx/mise-action](https://github.com/jdx/mise-action)

- CI でも、開発と同じ `mise.toml` を使う。CI では `activate` は不要。
- GitHub Actions では `jdx/mise-action` を使う。`uses:` の 1 行で、次のことが行われる。
  - mise 本体のインストールと、`mise.toml` に書かれたツールの `mise install`(入力 `install` の既定値が `true`)
  - ツールのキャッシュ(`cache` の既定値が `true`)
  - mise の PATH と環境変数を、後続のステップに渡す(`export_path` / `env` の既定値が `true`)
- そのため、後続の `run: pnpm ...` や `run: eas --version` は、`mise exec` なしでそのまま動く。
- `mise.lock` があると、`mise install --locked` が自動で実行される。全ジョブが同じ版を入れられ、版の一覧を毎回取得しなくて済む。ロックファイルは、CI の実行環境ごとに作る。

  ```sh
  mise lock --platform linux-x64,linux-arm64,macos-arm64
  ```

- `actions/checkout` を `mise-action` より前に置く(`mise.toml` を読むため)。
- このリポジトリの例(`.github/workflows/ci.yml`)

  ```yaml
  steps:
    - uses: actions/checkout@v7
    - uses: jdx/mise-action@v5
    - run: eas --version
    - run: firebase --version
    - run: java -version
  ```

- 主な入力: `version`(mise の版を固定)、`working_directory`(サブプロジェクトを指定)、`cache`(キャッシュの切替)。詳しくは [action の入力](https://github.com/jdx/mise-action/blob/v5/action.yml)。
- `mise-action` を使わず自分で `mise install` する場合は、後続の `run:` を `mise exec -- <command>` か `mise run <task>` にする。

## 新旧プロジェクトでの混在

mise はディレクトリ単位で有効になるため、新旧プロジェクトは混在可能。

- `mise.toml` があるプロジェクトでは、mise のツールが PATH の先頭に入り、mise 版が優先される。
- `mise.toml` がないプロジェクトでは、これまでの PATH(nodebrew・Homebrew などの既存ツール)がそのまま使われる。
  - `mise activate` は、shims ディレクトリ(`~/.local/share/mise/shims`)を PATH に足すので、`which -a node` では shim が先頭に表示される。
  - ただし、設定された版がないので、shim は **PATH の次の同名コマンド(nodebrew など)を起動する**。実質、これまでの `node` がそのまま動く(`mise.toml` のないディレクトリで shim 経由の `node -v` と nodebrew の `node -v` が同じ版になることを確認済み)。
  - shims が PATH に入るのは、`activate_shims`(既定 `true`)による。外すには `mise settings activate_shims=false` を実行してシェルを再起動する。詳しくは [Shims: Keep shims out of mise activate](https://mise.jdx.dev/dev-tools/shims.html#activate-shims)。

## miseのバージョンの切り替え方式(activate / shims / exec)

公式ドキュメント: [Shims](https://mise.jdx.dev/dev-tools/shims.html)(方式の比較表は「Choose how to use mise tools」)

ディレクトリごとにツールの版を切り替える方式は、3 種類ある。

| 方式                                         | 切り替えのタイミング                                    | `[env]` の環境変数                  | 向いている場面            |
| -------------------------------------------- | ------------------------------------------------------- | ----------------------------------- | ------------------------- |
| `mise activate`(このリポジトリの手順)        | `cd` やプロンプトの表示のとき(PATH を書き換える)        | シェルに設定される                  | 普段のターミナル          |
| `mise activate --shims`(shims)               | **コマンドを実行するとき**(shim が実行のたびに版を選ぶ) | shim が起動するプログラムにだけ渡る | エディタ・IDE・GUI アプリ |
| `mise exec -- <command>` / `mise run <task>` | コマンド 1 つごと                                       | そのコマンドにだけ渡る              | スクリプト・CI            |

### shims とは

- `node` や `pnpm` などのコマンド名の、小さな代理の実行ファイル(`~/.local/share/mise/shims`)。PATH に置かれる。
- 実行されると、今のディレクトリの `mise.toml` を読んで版を選び、本物の実行ファイルを起動する。
- 設定された版がないディレクトリでは、**PATH の次の同名コマンド**(nodebrew など)を起動する。

### 方式による動きの違い

- **ブランチを切り替えたとき**
  - `activate`: ターミナルで `git checkout` したあと、次のプロンプトが出る時点で切り替わる。GitLens などの GUI で切り替えた場合は、ターミナルで Enter を 1 回押すまで切り替わらない(プロンプトが表示されないと、更新処理が動かないため)。
  - shims: 次にコマンドを実行したときから新しい版になる。GUI で切り替えても、Enter は不要。
- **`[env]` の環境変数**
  - `activate`: シェル自体に設定されるので、`echo $VAR` でも見える。
  - shims: 設定されるのは shim が起動するプログラム(とその子プロセス)だけ。`echo $VAR` や、shim を介さずに直接起動するコマンドには届かない(`mise.toml` に `[env]` と `node` を書いて、shims だけの PATH で試して確認済み)。
- **`mise shell` / `mise deactivate`**: `activate` でのみ使える(`mise` シェル関数が定義されるため)。
- **実行速度**: shims は実行のたびに `mise` を経由するぶん、わずかに遅い。

### 方式を変える場合

- `~/.zshrc` の有効化の行を**置き換える**(追記すると二重に有効化される)。

  ```sh
  # activate 方式(今)
  eval "$(mise activate zsh)"
  # shims 方式
  eval "$(mise activate zsh --shims)"
  ```

- 変えたあとは `exec zsh` か、新しいターミナルを開く。
- shims にすると、`which node` が shim を指すので、実際の版を確認するときは `mise which node` を使う。
- 迷ったら `activate` のままでよい。GUI でブランチを切り替える頻度が高く、`[env]` を使わないなら、shims も選択肢になる。

## mise 自体のバージョン管理

公式ドキュメント: [Updating mise](https://mise.jdx.dev/installing-mise.html#updating) / [`mise self-update`](https://mise.jdx.dev/cli/self-update.html) / [`min_version`](https://mise.jdx.dev/configuration.html#minimum-mise-version)

### 更新のしかた(インストール方法で変わる)

| 入れ方           | 更新方法                                              |
| ---------------- | ----------------------------------------------------- |
| `mise.run`(推奨) | `mise self-update`                                    |
| Homebrew         | `brew upgrade mise`(`self-update` は無効になっている) |

- `mise self-update` は、GitHub Releases から最新の安定版を取得し、署名を検証してから入れ替える。公開から 24 時間未満の版は選ばれない(`self_update.minimum_release_age`、なければ `minimum_release_age` の設定、既定 24 時間)。`mise self-update 2026.10.25` のように版を指定すると、この遅延は無視される。
- 自動で更新するなら `mise settings self_update.auto=true`(グローバル設定)。

### 最低限の版をそろえる(`min_version`)

`mise.toml` で新しい機能を使うときは、全員に特定の版を求める代わりに、最低限の版を書く。

```toml
min_version = "2026.10.0"
```

- 文字列だけ書くと、古い mise はエラーで止まり、更新の案内が表示される(必須の最低版)。
- 警告だけにしたいときは、`hard`(必須)と `soft`(推奨)を分けて書く。

  ```toml
  min_version = { hard = "2026.1.0", soft = "2026.10.0" }
  ```

### CI の mise の版

- `jdx/mise-action` は、`version` を指定しなければ、公開から 24 時間以上経った最新の安定版を入れる。固定するなら `version: 2026.10.23` のように書く(詳しくは「CI(GitHub Actions)」)。
