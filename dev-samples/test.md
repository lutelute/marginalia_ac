# テストドキュメント

これは開発テスト用のサンプルドキュメントです。

## 機能テスト

### コメント機能
このテキストにはコメントが付いています。プレビューで確認してください。

### 校閲機能
この文章には誤字があります。校閲機能で修正提案をテストできます。

### 保留機能
この段落は後で検討する必要があります。保留マークをテストできます。

### 議論機能
この機能について議論が必要です。スレッド形式の議論をテストできます。

## 数式

インライン数式: $E = mc^2$ はアインシュタインの有名な式です。

**色付き数式** (KaTeXの `\color` コマンド):

インライン: $\color{red}{E = mc^2}$ と $\color{blue}{F = ma}$

ブロック数式:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

色付きブロック数式:

$$
\color{red}{x} + \color{blue}{y} = \color{green}{z}
$$

$$
\textcolor{purple}{f(x)} = \textcolor{orange}{ax^2} + \textcolor{teal}{bx} + c
$$

二次方程式の解:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

色付きの二次方程式:

$$
\color{blue}{x} = \frac{\color{red}{-b} \pm \sqrt{\color{green}{b^2 - 4ac}}}{\color{orange}{2a}}
$$

## コードブロック

```javascript
function hello() {
  console.log("Hello, Marginalia!");
}
```

```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
```

## リスト

- 項目1: テスト用
- 項目2: 注釈テスト
- 項目3: プレビューテスト

## 色付きテキスト

HTMLタグで色を指定できます：

<span style="color: red">赤いテキスト</span>、<span style="color: blue">青いテキスト</span>、<span style="color: green">緑のテキスト</span>

<span style="background-color: yellow; color: black">ハイライトテキスト</span>

<mark>markタグでハイライト</mark>

## テーブル

テーブル全体にコメントを追加できます：

| 機能 | 状態 | 備考 |
|------|------|------|
| コメント | 完了 | <span style="color: green">OK</span> |
| 校閲 | 完了 | <span style="color: green">OK</span> |
| 保留 | テスト中 | <span style="color: orange">進行中</span> |
| 議論 | テスト中 | <span style="color: orange">進行中</span> |

別のテーブル：

| 項目 | 値 |
|------|-----|
| バージョン | 1.0.4 |
| 言語 | JavaScript |
| フレームワーク | React |

## リンク

[別のファイル](./another.md)

---

開発時の動作確認にご利用ください。
