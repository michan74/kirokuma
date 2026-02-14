"""
Minimal Python Cloud Function scaffold for `python-video-generator`.
"""
import os
import json
import logging
from firebase_functions import https_fn, options

_logging_initialized = False


def _init_logging():
    """Cloud Loggingを遅延初期化"""
    global _logging_initialized
    if _logging_initialized:
        return
    try:
        import google.cloud.logging
        client = google.cloud.logging.Client()
        client.setup_logging()
        _logging_initialized = True
    except Exception:
        logging.basicConfig(level=logging.INFO)
        _logging_initialized = True


def _init_firebase():
    try:
        # lazy import to avoid heavy imports at analysis time
        from firebase_admin import initialize_app
        try:
            initialize_app()
        except Exception:
            logging.info('Firebase app already initialized or ADC not available')
    except Exception:
        logging.exception('firebase_admin is not available in this environment')


@https_fn.on_request(
    memory=options.MemoryOption.GB_2,  # 2GB メモリ
    timeout_sec=540,  # 9分タイムアウト
    cpu=1,
)
def generate_video_python(request: https_fn.Request) -> https_fn.Response:
    """HTTP POST endpoint.

    Expects JSON body: {"userId": "U...", "groupId": "...", "imageCount": 14}
    Returns: {"videoUrl": "...", "imageCount": N, "duration": X.X}
    """
    headers = {'Access-Control-Allow-Origin': '*'}

    if request.method == 'OPTIONS':
        return ('', 204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        })

    try:
        _init_logging()
        logging.info('=== generate_video_python START ===')
        _init_firebase()
        logging.info('Firebase initialized')

        request_json = request.get_json(silent=True)
        logging.info(f'Request JSON: {request_json}')
        if not request_json:
            return ({'error': 'Invalid JSON'}, 400, headers)

        user_id = request_json.get('userId')
        if not user_id:
            return ({'error': 'userId is required'}, 400, headers)

        group_id = request_json.get('groupId')
        if not group_id:
            return ({'error': 'groupId is required'}, 400, headers)

        default_image_count = 7
        image_count = request_json.get('imageCount', default_image_count)
        logging.info(f'Video generation requested for user: {user_id}, groupId: {group_id}, imageCount: {image_count}')

        # Firestoreから指定グループのくま画像を取得
        from firebase_admin import firestore
        db = firestore.client()
        bears_ref = db.collection('bears')
        query = (
            bears_ref
            .where(filter=firestore.FieldFilter('userId', '==', user_id))
            .where(filter=firestore.FieldFilter('groupId', '==', group_id))
            .order_by('createdAt', direction=firestore.Query.DESCENDING)
            .limit(image_count)
        )

        docs = query.get()
        image_urls = []
        for d in docs:
            data = d.to_dict()
            url = data.get('imageUrl')
            if url:
                image_urls.append(url)

        logging.info(f'Found {len(image_urls)} images for user {user_id}, groupId: {group_id}')

        if len(image_urls) < 2:
            return ({'error': 'At least 2 bear images are required'}, 400, headers)

        # 動画生成（遅延インポート）
        logging.info('Importing video_generator...')
        from video_generator import generate_video_from_bears
        logging.info('Calling generate_video_from_bears...')
        video_url, thumbnail_url, duration = generate_video_from_bears(image_urls, user_id)
        logging.info(f'Video generated: {video_url}')

        return ({
            'videoUrl': video_url,
            'thumbnailUrl': thumbnail_url,
            'imageCount': len(image_urls),
            'duration': duration
        }, 200, headers)

    except Exception as e:
        logging.exception(f'ERROR: {str(e)}')
        return ({'error': str(e)}, 500, headers)