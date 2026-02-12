"""
動画生成モジュール

Firebase Storageの画像からズーム効果+クロスフェードの動画を生成する

注意: PIL, moviepy, firebase_admin.storage は重いため、関数内で遅延インポートする
"""
import os
import tempfile
import logging
import uuid
import shutil
from urllib.parse import urlparse, unquote

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
    logging.info('=== generate_video_from_bears START ===')
    logging.info(f'image_urls count: {len(image_urls)}, user_id: {user_id}')

    if len(image_urls) < 2:
        raise ValueError("At least 2 images are required")

    logging.info('Creating temp directory...')
    temp_dir = tempfile.mkdtemp(prefix='video_')
    logging.info(f'Temp dir: {temp_dir}')
    temp_images = []
    output_path = os.path.join(temp_dir, 'output.mp4')
    thumbnail_path = os.path.join(temp_dir, 'thumbnail.jpg')

    try:
        # 並び順を古い順に変更
        image_urls = list(reversed(image_urls))
        logging.info(f'Reversed image_urls, first url: {image_urls[0][:50]}...')

        # 1. 画像をダウンロードしてリサイズ
        logging.info(f'Starting download of {len(image_urls)} images...')
        for i, url in enumerate(image_urls):
            img_path = os.path.join(temp_dir, f'bear_{i}.png')
            logging.info(f'Processing image {i+1}/{len(image_urls)}...')
            _download_and_resize_image(url, img_path)
            temp_images.append(img_path)
            logging.info(f'Downloaded image {i+1}/{len(image_urls)} OK')

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
    from PIL import Image
    from firebase_admin import storage

    logging.info(f'_download_and_resize_image: url={url}')
    bucket = storage.bucket()
    logging.info(f'Got bucket: {bucket.name}')

    # URLからStorageパスを抽出
    storage_path = _extract_storage_path(url)
    logging.info(f'Extracted storage path: {storage_path}')

    # ダウンロード
    blob = bucket.blob(storage_path)
    temp_download = output_path + '.tmp'
    logging.info(f'Downloading to: {temp_download}')
    blob.download_to_filename(temp_download)
    logging.info('Download complete')

    # リサイズして保存（1024x1024に統一）
    logging.info('Opening image for resize...')
    with Image.open(temp_download) as img:
        img = img.convert('RGB')
        img = img.resize(IMAGE_SIZE, Image.ANTIALIAS)
        img.save(output_path, 'PNG')
    logging.info(f'Resize complete, saved to: {output_path}')

    # 一時ファイル削除
    if os.path.exists(temp_download):
        os.remove(temp_download)
    logging.info('Temp file cleaned up')


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
    from moviepy.editor import ImageClip, concatenate_videoclips

    logging.info('=== _create_video_with_effects START ===')
    logging.info(f'image_paths count: {len(image_paths)}')
    logging.info(f'output_path: {output_path}')

    clips = []
    final_clip = None

    try:
        for i, img_path in enumerate(image_paths):
            logging.info(f'Creating ImageClip {i+1}/{len(image_paths)}: {img_path}')
            try:
                # 画像クリップを作成
                clip = ImageClip(img_path, duration=CLIP_DURATION)
                logging.info(f'ImageClip created for {i+1}')

                # ズーム効果を適用（Ken Burns effect）
                logging.info(f'Applying zoom effect to {i+1}...')
                clip = clip.resize(lambda t: 1 + (ZOOM_RATIO - 1) * t / CLIP_DURATION)
                clip = clip.set_position('center')
                logging.info(f'Zoom effect applied to {i+1}')

                clips.append(clip)
                logging.info(f'Clip {i+1} added to list')
            except Exception as e:
                logging.exception(f'ERROR creating clip {i+1}: {str(e)}')
                raise

        logging.info(f'All {len(clips)} clips created successfully')

        # クロスフェードで結合
        logging.info('Concatenating clips with crossfade...')
        try:
            final_clip = concatenate_videoclips(clips, method='compose', padding=-CROSSFADE_DURATION)
            logging.info('Concatenation done')
        except Exception as e:
            logging.exception(f'ERROR concatenating clips: {str(e)}')
            raise

        # 出力サイズを固定
        logging.info(f'Resizing final clip to {IMAGE_SIZE}...')
        try:
            final_clip = final_clip.resize(IMAGE_SIZE)
            logging.info('Resize done')
        except Exception as e:
            logging.exception(f'ERROR resizing final clip: {str(e)}')
            raise

        # MP4として出力
        logging.info('Writing video file...')
        logging.info(f'  fps={FPS}, codec={VIDEO_CODEC}, bitrate={VIDEO_BITRATE}')
        try:
            final_clip.write_videofile(
                output_path,
                fps=FPS,
                codec=VIDEO_CODEC,
                bitrate=VIDEO_BITRATE,
                audio=False,
                preset='medium',
                threads=2,
                logger='bar'  # プログレスバーを表示
            )
            logging.info('Video file written successfully')
        except Exception as e:
            logging.exception(f'ERROR writing video file: {str(e)}')
            raise

    finally:
        # クリップを閉じる
        logging.info('Closing clips...')
        try:
            if final_clip:
                final_clip.close()
            for clip in clips:
                clip.close()
            logging.info('All clips closed')
        except Exception as e:
            logging.error(f'ERROR closing clips: {str(e)}')

    logging.info('=== _create_video_with_effects COMPLETE ===')


def _create_thumbnail(image_path: str, output_path: str) -> None:
    """最初の画像からサムネイルを作成"""
    from PIL import Image

    logging.info(f'Creating thumbnail from {image_path}')
    with Image.open(image_path) as img:
        img = img.convert('RGB')
        img.save(output_path, 'JPEG', quality=85)
    logging.info(f'Thumbnail saved to {output_path}')


def _upload_video_and_thumbnail(video_path: str, thumbnail_path: str, user_id: str) -> tuple:
    """動画とサムネイルをFirebase Storageにアップロード"""
    from firebase_admin import storage

    logging.info('Uploading video and thumbnail...')
    bucket = storage.bucket()
    bucket_name = bucket.name

    timestamp = int(os.path.getmtime(video_path) * 1000)

    # 動画アップロード
    video_storage_path = f'videos/{user_id}/{timestamp}.mp4'
    video_blob = bucket.blob(video_storage_path)
    video_token = str(uuid.uuid4())
    video_blob.metadata = {'firebaseStorageDownloadTokens': video_token}
    logging.info(f'Uploading video to {video_storage_path}...')
    video_blob.upload_from_filename(video_path, content_type='video/mp4')
    logging.info('Video uploaded')

    video_encoded_path = video_storage_path.replace('/', '%2F')
    video_url = f'https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{video_encoded_path}?alt=media&token={video_token}'

    # サムネイルアップロード
    thumbnail_storage_path = f'videos/{user_id}/{timestamp}.jpg'
    thumbnail_blob = bucket.blob(thumbnail_storage_path)
    thumbnail_token = str(uuid.uuid4())
    thumbnail_blob.metadata = {'firebaseStorageDownloadTokens': thumbnail_token}
    logging.info(f'Uploading thumbnail to {thumbnail_storage_path}...')
    thumbnail_blob.upload_from_filename(thumbnail_path, content_type='image/jpeg')
    logging.info('Thumbnail uploaded')

    thumbnail_encoded_path = thumbnail_storage_path.replace('/', '%2F')
    thumbnail_url = f'https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{thumbnail_encoded_path}?alt=media&token={thumbnail_token}'

    logging.info(f'Upload complete. video_url={video_url}')
    return video_url, thumbnail_url


def _cleanup_temp_files(temp_dir: str) -> None:
    """一時ファイルをクリーンアップ"""
    try:
        shutil.rmtree(temp_dir)
        logging.info('Cleaned up temp directory')
    except Exception as e:
        logging.warning(f'Failed to cleanup temp files: {e}')
