# オンボーディング

## チームメンバーが移行時・参加時に行う手順

```sh
brew install mise
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc
exec zsh

mise trust      # mise.toml を信頼(新しいリポジトリごとに必要)
mise install    # node / pnpm / java / eas-cli / firebase-tools / lefthook を導入
lefthook install  #  lefthook.yml の Git フックを.gitに登録する
pnpm install
```

## mise の有効化(activate)

対話シェルで mise を有効化すると、プロジェクトのディレクトリに入るだけで、そのプロジェクトのツールが PATH に入り、環境変数も設定される。プロンプトの表示時とディレクトリ移動時に、フックが現在のディレクトリに合わせて環境を更新する仕組み。

シェルごとに 1 回だけ、起動ファイルへ有効化の行を追記する。

```sh
# zsh
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# bash
echo 'eval "$(mise activate bash)"' >> ~/.bashrc
```

- Homebrew などのパッケージマネージャで入れた場合は `mise` と書く。`curl https://mise.run | sh` で入れた場合は `~/.local/bin/mise` と書く。
- スクリプトや CI ではactivateは不要。`mise exec -- <command>` や `mise run <task>` を使う。
- 有効化していないと `eas: command not found` のようなエラーになる(トラブルシュート参照)。

## ツールのバージョン管理方針

- ツール(pnpm を含む)のバージョンは `mise.toml` で一元管理する。
- **pnpm はグローバルインストールしない。** mise 版に統一する。
- `package.json` の `packageManager` フィールドは書かない(詳細と優先順位は「pnpm について」を参照)。
- `eas` / `firebase` は `package.json` の依存ではなく mise が入れる CLI。`pnpm install` では入らない。
- **`.nvmrc` は置かない。** Node のバージョンは `mise.toml` の `node` で管理しており、`.nvmrc` を置くと二重管理になってずれる恐れがある。
  - `.nvmrc` は nvm がプロジェクトの Node バージョンを知るための設定ファイル。nvm、fnm、Netlify、GitHub Actions の `setup-node`(`node-version-file`)などが読む。nvm を使うメンバーがいる場合にだけ必要になる。
  - Vercel は `.nvmrc` も `mise.toml` も読まない。デプロイするときは `package.json` の `engines.node`(例: `"24.x"`)かダッシュボードの Node.js Version で指定する。`mise.toml` の `node` と major バージョンを揃える。

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

- mise で pnpm のバージョンを管理する場合、`package.json` の `packageManager` での指定は不要(書くなら mise と同じバージョンにそろえる)。

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
- Vercel など `mise.toml` を読まない環境では、`package.json` の `engines.node` で指定する(上の「ツールのバージョン管理方針」参照)。

## 既存プロジェクトの移行

mise はディレクトリ単位で有効になるため、新旧プロジェクトは混在してよい。新規は最初から mise、既存は手を入れるタイミングで `mise.toml` を追加する。
