"""
動画生成モジュール

Firebase Storageの画像からズーム効果+クロスフェードの動画を生成する
"""
import os
import tempfile
import logging
import uuid
import shutil
from urllib.parse import urlparse, unquote

from PIL import Image
from moviepy.editor import ImageClip, concatenate_videoclips
from firebase_admin import storage

logging.basicConfig(level=logging.INFO)

# 動画設定
IMAGE_SIZE = (1024, 1024)
CLIP_DURATION = 2.0  # 各画像の表示秒数
CROSSFADE_DURATION = 0.5  # クロスフェード秒数
ZOOM_RATIO = 1.1  # ズーム倍率（1.0 -> 1.1）
FPS = 25
VIDEO_CODEC = 'libx264'
VIDEO_BITRATE = '2000k'


def generate_video_from_bears(image_urls: list, user_id: str) -> tuple:
    """
    くま画像のURLリストから動画を生成する

    Args:
        image_urls: Firebase StorageのくまURLリスト（新しい順）
        user_id: ユーザーID

    Returns:
        tuple: (video_url, thumbnail_url, duration)
    """
    if len(image_urls) < 2:
        raise ValueError("At least 2 images are required")

    temp_dir = tempfile.mkdtemp(prefix='video_')
    temp_images = []
    output_path = os.path.join(temp_dir, 'output.mp4')
    thumbnail_path = os.path.join(temp_dir, 'thumbnail.jpg')

    try:
        # 1. 画像をダウンロードしてリサイズ
        logging.info(f'Downloading {len(image_urls)} images...')
        for i, url in enumerate(image_urls):
            img_path = os.path.join(temp_dir, f'bear_{i}.png')
            _download_and_resize_image(url, img_path)
            temp_images.append(img_path)
            logging.info(f'Downloaded image {i+1}/{len(image_urls)}')

        # 2. サムネイル生成（最初の画像を使用）
        logging.info('Creating thumbnail...')
        _create_thumbnail(temp_images[0], thumbnail_path)

        # 3. 動画生成
        logging.info('Generating video with zoom and crossfade effects...')
        _create_video_with_effects(temp_images, output_path)

        # 4. Storageにアップロード
        logging.info('Uploading video and thumbnail to Storage...')
        video_url, thumbnail_url = _upload_video_and_thumbnail(output_path, thumbnail_path, user_id)

        # 動画の長さを計算
        duration = len(image_urls) * CLIP_DURATION - (len(image_urls) - 1) * CROSSFADE_DURATION

        logging.info(f'Video generated successfully: {video_url}')
        return video_url, thumbnail_url, duration

    finally:
        # クリーンアップ
        _cleanup_temp_files(temp_dir)


def _download_and_resize_image(url: str, output_path: str) -> None:
    """Firebase Storageからダウンロードしてリサイズ保存"""
    bucket = storage.bucket()

    # URLからStorageパスを抽出
    storage_path = _extract_storage_path(url)

    # ダウンロード
    blob = bucket.blob(storage_path)
    temp_download = output_path + '.tmp'
    blob.download_to_filename(temp_download)

    # リサイズして保存（1024x1024に統一）
    with Image.open(temp_download) as img:
        img = img.convert('RGB')
        img = img.resize(IMAGE_SIZE, Image.ANTIALIAS)
        img.save(output_path, 'PNG')

    # 一時ファイル削除
    if os.path.exists(temp_download):
        os.remove(temp_download)


def _extract_storage_path(url: str) -> str:
    """Firebase Storage URLからパスを抽出"""
    parsed = urlparse(url)

    if parsed.hostname == 'firebasestorage.googleapis.com':
        # 形式: /v0/b/{bucket}/o/{encoded_path}
        path = parsed.path
        if '/o/' in path:
            encoded_path = path.split('/o/')[-1]
            return unquote(encoded_path)
    elif parsed.hostname == 'storage.googleapis.com':
        # 形式: /{bucket}/{path}
        parts = parsed.path.split('/', 2)
        if len(parts) >= 3:
            return parts[2]

    raise ValueError(f'Unsupported Storage URL format: {url}')


def _create_video_with_effects(image_paths: list, output_path: str) -> None:
    """ズーム効果+クロスフェードで動画を生成"""
    clips = []

    for img_path in image_paths:
        # 画像クリップを作成
        clip = ImageClip(img_path, duration=CLIP_DURATION)

        # ズーム効果を適用（Ken Burns effect）
        clip = clip.resize(lambda t: 1 + (ZOOM_RATIO - 1) * t / CLIP_DURATION)
        clip = clip.set_position('center')

        clips.append(clip)

    # クロスフェードで結合
    final_clip = concatenate_videoclips(clips, method='compose', padding=-CROSSFADE_DURATION)

    # 出力サイズを固定
    final_clip = final_clip.resize(IMAGE_SIZE)

    # MP4として出力
    final_clip.write_videofile(
        output_path,
        fps=FPS,
        codec=VIDEO_CODEC,
        bitrate=VIDEO_BITRATE,
        audio=False,
        preset='medium',
        threads=2,
        logger=None  # moviepyのログを抑制
    )

    # クリップを閉じる
    final_clip.close()
    for clip in clips:
        clip.close()


def _create_thumbnail(image_path: str, output_path: str) -> None:
    """最初の画像からサムネイルを作成"""
    with Image.open(image_path) as img:
        img = img.convert('RGB')
        img.save(output_path, 'JPEG', quality=85)


def _upload_video_and_thumbnail(video_path: str, thumbnail_path: str, user_id: str) -> tuple:
    """動画とサムネイルをFirebase Storageにアップロード"""
    bucket = storage.bucket()
    bucket_name = bucket.name

    timestamp = int(os.path.getmtime(video_path) * 1000)

    # 動画アップロード
    video_storage_path = f'videos/{user_id}/{timestamp}.mp4'
    video_blob = bucket.blob(video_storage_path)
    video_token = str(uuid.uuid4())
    video_blob.metadata = {'firebaseStorageDownloadTokens': video_token}
    video_blob.upload_from_filename(video_path, content_type='video/mp4')

    video_encoded_path = video_storage_path.replace('/', '%2F')
    video_url = f'https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{video_encoded_path}?alt=media&token={video_token}'

    # サムネイルアップロード
    thumbnail_storage_path = f'videos/{user_id}/{timestamp}.jpg'
    thumbnail_blob = bucket.blob(thumbnail_storage_path)
    thumbnail_token = str(uuid.uuid4())
    thumbnail_blob.metadata = {'firebaseStorageDownloadTokens': thumbnail_token}
    thumbnail_blob.upload_from_filename(thumbnail_path, content_type='image/jpeg')

    thumbnail_encoded_path = thumbnail_storage_path.replace('/', '%2F')
    thumbnail_url = f'https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{thumbnail_encoded_path}?alt=media&token={thumbnail_token}'

    return video_url, thumbnail_url


def _cleanup_temp_files(temp_dir: str) -> None:
    """一時ファイルをクリーンアップ"""
    try:
        shutil.rmtree(temp_dir)
        logging.info('Cleaned up temp directory')
    except Exception as e:
        logging.warning(f'Failed to cleanup temp files: {e}')
