"""
Minimal Python Cloud Function scaffold for `python-video-generator`.
"""
import functions_framework
import logging
import os
import json

logging.basicConfig(level=logging.INFO)


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


@functions_framework.http
def generate_video_python(request):
    """HTTP POST endpoint.

    Expects JSON body: {"userId": "U...", "imageCount": 14}
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
        _init_firebase()

        request_json = request.get_json(silent=True)
        if not request_json:
            return ({'error': 'Invalid JSON'}, 400, headers)

        user_id = request_json.get('userId')
        if not user_id:
            return ({'error': 'userId is required'}, 400, headers)

        image_count = request_json.get('imageCount', 14)

        logging.info(f'Video generation requested for user: {user_id}, imageCount: {image_count}')

        # Firestoreから最新のくま画像を取得
        from firebase_admin import firestore
        db = firestore.client()
        bears_ref = db.collection('bears')
        query = (
            bears_ref
            .where(filter=firestore.FieldFilter('userId', '==', user_id))
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

        logging.info(f'Found {len(image_urls)} images for user {user_id}')

        if len(image_urls) < 2:
            return ({'error': 'At least 2 bear images are required'}, 400, headers)

        # 動画生成（遅延インポート）
        from video_generator import generate_video_from_bears
        video_url, duration = generate_video_from_bears(image_urls, user_id)

        logging.info(f'Video generated successfully: {video_url}')

        return ({
            'videoUrl': video_url,
            'imageCount': len(image_urls),
            'duration': duration
        }, 200, headers)

    except Exception as e:
        logging.error('Error in generate_video_python', exc_info=True)
        return ({'error': str(e)}, 500, headers)

# Register for static detection by firebase CLI if available
try:
    import importlib
    https_fn = importlib.import_module('firebase_functions.https_fn')
    generate_video_python = https_fn.on_request()(generate_video_python)
except Exception:
    logging.info('firebase_functions not available for static registration (continuing)')
