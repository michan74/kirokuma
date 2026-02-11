# Python動画生成関数

このディレクトリはDockerイメージとしてビルド・デプロイされます。

## ローカル開発

venvの作成（Docker使用）:
```bash
docker build -f Dockerfile.dev -t python-video-dev .
docker run --rm -v "$PWD":/app python-video-dev bash -c "python3.12 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
```

## デプロイ

```bash
firebase deploy --only functions:python-video
```
