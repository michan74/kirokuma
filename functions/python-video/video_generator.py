"""
動画生成ロジック

moviepyを使用して、くま画像から動画を生成します。
Ken Burns効果（ズーム）とクロスフェードトランジションを適用します。

imageio-ffmpegを使用してffmpegバイナリを自動ダウンロードします。
"""
from PIL import Image
import requests
from io import BytesIO
import tempfile
import os
from firebase_admin import storage
import uuid
import logging
from urllib.parse import urlparse, unquote

# NOTE: moviepy and imageio-ffmpeg are imported inside the function
# to avoid requiring ffmpeg at module import/analysis time (firebase
# deploy may import modules to analyze them). The runtime (Cloud
# Functions) will have ffmpeg installed via Aptfile or other means.


def generate_video_from_bears(image_urls: list, user_id: str) -> tuple:
    """
    くま画像から動画を生成
    
    Args:
        image_urls: くま画像のURLリスト（時系列順）
        user_id: ユーザーID
        
    Returns:
        (video_url, duration): 生成された動画のURLと動画の長さ（秒）
    """
    if len(image_urls) < 2:
        raise ValueError('At least 2 images are required')

    # Lazy import moviepy and ensure ffmpeg exe is set (if available)
    from moviepy.editor import ImageClip, concatenate_videoclips
    try:
        import imageio_ffmpeg
        os.environ.setdefault('IMAGEIO_FFMPEG_EXE', imageio_ffmpeg.get_ffmpeg_exe())
    except Exception:
        # If imageio_ffmpeg cannot provide a binary here, we still proceed
        # and rely on system ffmpeg (installed via Aptfile) being present
        pass
    
    clips = []
    temp_files = []
    
    try:
        logging.info(f'Starting video generation with {len(image_urls)} images')
        
        # 画像をダウンロードしてクリップ作成
        for i, url in enumerate(image_urls):
            logging.info(f'Processing image {i+1}/{len(image_urls)}')
            
            # 画像ダウンロード
            image = download_image_from_storage(url)
            
            # 一時ファイルに保存
            temp_path = f'/tmp/bear_{uuid.uuid4()}.png'
            temp_files.append(temp_path)
            
            # 1024x1024にリサイズして保存
            image = image.resize((1024, 1024), Image.Resampling.LANCZOS)
            image.save(temp_path, 'PNG')
            
            # クリップ作成（2秒表示）
            clip = ImageClip(temp_path, duration=2.0)
            
            # Ken Burns効果（ゆっくりズームイン）
            def zoom_effect(t):
                """時間経過に応じてズーム倍率を変化させる"""
                zoom_ratio = 1.0 + (0.1 * t / 2.0)  # 2秒で1.0→1.1倍
                return zoom_ratio
            
            clip = clip.resize(lambda t: zoom_effect(t))
            
            clips.append(clip)
            
            logging.info(f'Clip {i+1} created successfully')
        
        # クロスフェードでクリップを連結
        logging.info('Concatenating clips with crossfade...')
        final_clip = concatenate_videoclips(clips, method="compose", padding=-0.5)
        
        # 動画の総再生時間を計算
        total_duration = final_clip.duration
        logging.info(f'Final video duration: {total_duration:.2f} seconds')
        
        # 動画ファイル出力
        output_path = f'/tmp/output_{uuid.uuid4()}.mp4'
        logging.info('Writing video file...')
        
        final_clip.write_videofile(
            output_path,
            fps=25,
            codec='libx264',
            audio=False,
            threads=4,
            preset='medium',  # バランス重視
            bitrate='2000k',
            logger=None  # moviepyのログを抑制
        )
        
        logging.info('Video file created successfully')
        
        # Cloud Storageにアップロード
        video_url = upload_to_storage(output_path, user_id)
        
        # クリーンアップ
        logging.info('Cleaning up temporary files...')
        os.remove(output_path)
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        
        for clip in clips:
            clip.close()
        final_clip.close()
        
        logging.info(f'Video generation completed: {video_url}')
        return video_url, total_duration
        
    except Exception as e:
        # エラー時もクリーンアップ
        logging.error(f'Error in video generation: {str(e)}')
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass
        raise


def download_image_from_storage(url: str) -> Image.Image:
    """
    Firebase StorageのURLから画像をダウンロード
    
    Args:
        url: Firebase StorageのURL
        
    Returns:
        PIL Image object
    """
    try:
        # Firebase StorageのURLからパスを抽出
        parsed_url = urlparse(url)
        
        if 'firebasestorage.googleapis.com' in parsed_url.netloc:
            # 形式: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
            path_parts = parsed_url.path.split('/o/')
            if len(path_parts) > 1:
                storage_path = unquote(path_parts[1].split('?')[0])
            else:
                raise ValueError(f'Invalid Firebase Storage URL format: {url}')
        elif 'storage.googleapis.com' in parsed_url.netloc:
            # 形式: https://storage.googleapis.com/{bucket}/{path}
            path_parts = parsed_url.path.split('/', 2)
            if len(path_parts) > 2:
                storage_path = path_parts[2]
            else:
                raise ValueError(f'Invalid Storage URL format: {url}')
        else:
            # 通常のHTTP URL
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return Image.open(BytesIO(response.content))
        
        # Firebase Admin SDKで画像をダウンロード
        bucket = storage.bucket()
        blob = bucket.blob(storage_path)
        
        image_bytes = blob.download_as_bytes()
        return Image.open(BytesIO(image_bytes))
        
    except Exception as e:
        logging.error(f'Failed to download image from {url}: {str(e)}')
        raise


def upload_to_storage(file_path: str, user_id: str) -> str:
    """
    Cloud Storageにアップロードして公開URLを返す
    
    Args:
        file_path: ローカルの動画ファイルパス
        user_id: ユーザーID
        
    Returns:
        公開URL
    """
    try:
        bucket = storage.bucket()
        blob_name = f'videos/{user_id}/{uuid.uuid4()}.mp4'
        blob = bucket.blob(blob_name)
        
        logging.info(f'Uploading video to Storage: {blob_name}')
        
        blob.upload_from_filename(
            file_path,
            content_type='video/mp4'
        )
        
        # 公開URLを生成（Firebase Storage形式）
        # トークンを生成して設定
        token = str(uuid.uuid4())
        blob.metadata = {'firebaseStorageDownloadTokens': token}
        blob.patch()
        
        bucket_name = bucket.name
        video_url = f'https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{blob_name.replace("/", "%2F")}?alt=media&token={token}'
        
        logging.info(f'Video uploaded successfully: {video_url}')
        return video_url
        
    except Exception as e:
        logging.error(f'Failed to upload video: {str(e)}')
        raise
