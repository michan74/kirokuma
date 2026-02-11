"""
動画生成用のCloud Function (Python版)

既存のTypeScript実装より高速な動画生成を実現します。
"""
import functions_framework
from firebase_admin import initialize_app, firestore, credentials
# Import video generator lazily inside the handler to avoid importing
# heavy native-dependent libraries (moviepy/ffmpeg) at analysis time.
import logging
import os

# Firebase初期化
# シンプルに初期化する。ADCが取得できないなどの例外はログを出して継続する。
try:
    initialize_app()
except Exception:
    logging.exception('Failed to initialize Firebase app, continuing without explicit init')

logging.basicConfig(level=logging.INFO)


@functions_framework.http
def generate_video_python(request):
    """
    動画生成用のCloud Function (Python版)
    
    リクエストボディ:
    {
        "userId": "U1234567890",
        "imageCount": 14  # オプション、デフォルト14
    }
    
    レスポンス:
    {
        "videoUrl": "https://...",
        "imageCount": 14,
        "duration": 11.5
    }
    """
    # CORSヘッダーを設定
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    headers = {
        'Access-Control-Allow-Origin': '*'
    }
    
    try:
        request_json = request.get_json(silent=True)
        
        if not request_json:
            return ({'error': 'Invalid JSON'}, 400, headers)
        
        user_id = request_json.get('userId')
        image_count = request_json.get('imageCount', 14)
        
        if not user_id:
            return ({'error': 'userId is required'}, 400, headers)
        
        logging.info(f'Video generation requested for user: {user_id}')
        
        # Firestoreからくま画像を取得
        db = firestore.client()
        bears_ref = db.collection('bears')
        query = (bears_ref
                .where(filter=firestore.FieldFilter('userId', '==', user_id))
                .order_by('createdAt', direction=firestore.Query.DESCENDING)
                .limit(image_count))
        
        bears = query.get()
        
        if len(bears) < 2:
            logging.warning(f'Not enough images for user {user_id}: {len(bears)}')
            return ({'error': 'At least 2 bear images are required'}, 400, headers)
        
        image_urls = [bear.to_dict()['imageUrl'] for bear in bears]
        logging.info(f'Fetched {len(image_urls)} images for video generation')
        
        # 動画生成 (遅延インポート)
        from video_generator import generate_video_from_bears
        video_url, duration = generate_video_from_bears(image_urls, user_id)
        
        logging.info(f'Video generated successfully: {video_url}')
        
        return ({
            'videoUrl': video_url,
            'imageCount': len(image_urls),
            'duration': duration
        }, 200, headers)
        
    except Exception as e:
        logging.error(f'Error generating video: {str(e)}', exc_info=True)
        return ({'error': f'Failed to generate video: {str(e)}'}, 500, headers)


# firebase_functions SDK 用に関数を登録して CLI/デプロイ時に検出されるようにする
try:
    # 明示的にサブモジュールをロードして互換性を高める
    import importlib
    https_fn = importlib.import_module('firebase_functions.https_fn')

    # デコレータ形式で登録（on_request() を呼んで関数をラップする）
    generate_video_python = https_fn.on_request()(generate_video_python)
except Exception:
    logging.info('firebase_functions not available for static registration (continuing)')
