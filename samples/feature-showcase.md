# Marginalia 機能ショーケース

このドキュメントでは、Marginaliaの主要機能をデモンストレーションします。

## 1. 基本的なMarkdown

**太字**、*斜体*、~~取り消し線~~、`インラインコード`

> 引用ブロックです。
> 複数行にわたることもできます。

## 2. リスト

### 順序なしリスト
- 項目1
- 項目2
  - ネストされた項目
  - もう一つのネスト
- 項目3

### 順序付きリスト
1. 最初のステップ
2. 次のステップ
3. 最後のステップ

### タスクリスト
- [x] 完了したタスク
- [ ] 未完了のタスク
- [ ] もう一つの未完了タスク

## 3. コードブロック

### JavaScript

```javascript
// 関数の例
function greet(name) {
  return `Hello, ${name}!`;
}

const result = greet("World");
console.log(result);
```

### Python

```python
# クラスの例
class Calculator:
    def __init__(self):
        self.result = 0

    def add(self, value):
        self.result += value
        return self

    def get_result(self):
        return self.result
```

## 4. 表

| 機能 | 説明 | 状態 |
|------|------|------|
| Toast通知 | 操作結果の通知表示 | 実装済み |
| テーマ切替 | Dark/Light/System | 実装済み |
| 注釈ジャンプ | 注釈クリックでエディタへ | 実装済み |
| 差分表示 | バックアップとの比較 | 実装済み |

## 5. 数式 (KaTeX)

インライン数式: $E = mc^2$

ブロック数式:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

## 6. リンク

- [内部リンク](./duplicate-text-test.md)
- [外部リンク](https://github.com)

## 7. 画像

画像の例（パスがあれば表示されます）:

![サンプル画像](./sample-image.png)

---

*このドキュメントは Marginalia v1.0.18 で作成されました。*
