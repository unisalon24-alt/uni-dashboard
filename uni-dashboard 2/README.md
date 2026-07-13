# Uni. 経営ダッシュボード（Netlify版）

このフォルダを使うと、Claudeの画面から離れて、スタッフ全員がブラウザだけでアクセスできる
独立したウェブサイトとしてこのダッシュボードを公開できます。

データの保存には **Firebase（無料）** を使います。これはブラウザだけで動くサイトでも
「全員が同じデータを見て、同じデータを編集できる」ようにするための仕組みです。

---

## ステップ1：Firebaseプロジェクトを作る（無料）

1. https://console.firebase.google.com にアクセスし、Googleアカウントでログイン
2. 「プロジェクトを作成」→ 好きな名前（例：uni-salon）を入力 → 作成
3. 左メニューの「構築」→「Firestore Database」→「データベースの作成」
   - ロケーションは `asia-northeast1`（東京）を推奨
   - モードは「テストモードで開始」でOK（あとでルールを直します）
4. 左メニューの歯車アイコン →「プロジェクトの設定」→ 下にスクロールして「マイアプリ」
5. `</>`（ウェブ）のアイコンをクリックしてアプリを登録（名前は何でもOK）
6. 表示される次のようなコードの中の値をコピーします：

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "uni-salon.firebaseapp.com",
     projectId: "uni-salon",
     storageBucket: "uni-salon.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
   };
   ```

7. `src/firebaseConfig.js` を開き、上でコピーした値に書き換えて保存します
   （GitHub上で直接編集する場合は、後述のステップ2の途中で行います）
8. 同じファイルの `ADMIN_EMAIL` を、あなた自身のメールアドレスに書き換えます
   （これは画面の表示切り替え用です。実際のアクセス制限は次の「Firestoreのルール」で行います）

### Firestoreのセキュリティルールを設定する

Firebaseコンソール →「Firestore Database」→「ルール」タブを開き、次の内容に置き換えて「公開」：
（`you@example.com` の部分は、あなた自身のメールアドレスに書き換えてください。下のステップで
Authenticationに登録するメールアドレスと必ず同じものにします。）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /uniSalon/{docId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.email == "you@example.com";
    }
  }
}
```

これで、**誰でも閲覧はできるが、指定したメールアドレスでログインした人だけが編集できる**状態になります。

### あなた専用の編集アカウントを作る

1. Firebaseコンソール →「構築」→「Authentication」→「Sign-in method」タブ
2. 「Email/Password」を選んで有効化
3. 「Users」タブ →「ユーザーを追加」→ 上のルールで指定したメールアドレスと、好きなパスワードを設定

これで、そのメールアドレス・パスワードだけがアプリの「編集者ログイン」からログインでき、
データを編集できるようになります。それ以外の人は自動的に「閲覧のみ」になります。

---

## ステップ2：Netlifyで公開する（GitHub経由・一番かんたん）

パソコンに何もインストールしなくてもできる方法です。

1. https://github.com で無料アカウントを作る（すでにあればログイン）
2. 右上の「+」→「New repository」→ 名前を付けて作成（Publicで構いません）
3. 「uploading an existing file」のリンクから、このフォルダの中身一式（`src`フォルダごと）を
   ドラッグ＆ドロップでアップロードして「Commit changes」
4. アップロードした `src/firebaseConfig.js` をGitHub上で開き、鉛筆（編集）アイコンをクリックして
   ステップ1でコピーした値と `ADMIN_EMAIL` を書き換えて「Commit changes」
5. https://app.netlify.com にアクセスし、GitHubアカウントでログイン
6. 「Add new site」→「Import an existing project」→ GitHubを選択 → 今作ったリポジトリを選ぶ
7. ビルド設定はそのままでOK（`netlify.toml` に書いてあるので自動で認識されます）
8. 「Deploy」を押すと数分でビルドされ、`https://ランダムな名前.netlify.app` というURLが発行されます
   （Netlifyの設定画面からサイト名を分かりやすいものに変更できます）

これで、そのURLをスタッフ全員に共有すれば、ブラウザだけでアクセスできるようになります。
誰かがデータを編集すると、他の人の画面にもリアルタイムで反映されます。

---

## （別の方法）パソコンにNode.jsがある場合

```bash
npm install
npm run build
```

を実行すると `dist` フォルダが作られます。そのフォルダを
https://app.netlify.com/drop にドラッグ＆ドロップするだけでも公開できます。

---

## 困ったときは

- 画面が真っ白になる → `src/firebaseConfig.js` の値が正しくコピーできているか確認してください
- データが保存されない → Firestoreの「ルール」タブの設定を再確認してください
- ログインできない → Authenticationの「Users」タブに登録したメールアドレス・パスワードと、
  Firestoreルールの `you@example.com` の部分、`firebaseConfig.js` の `ADMIN_EMAIL` が
  すべて同じメールアドレスになっているか確認してください
- スタッフを追加・店舗を増やしたい → ログイン後、アプリの「データ入力」タブからそのまま追加できます
