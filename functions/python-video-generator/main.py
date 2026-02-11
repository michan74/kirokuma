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

    Expects JSON body: {"userId": "U..."}
    Returns: {"imageUrls": [..]} (up to 7 most recent)
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

        logging.info(f'Fetching up to 7 bear images for user: {user_id}')

        # query Firestore for latest 7 images
        from firebase_admin import firestore
        db = firestore.client()
        bears_ref = db.collection('bears')
        query = (
            bears_ref
            .where(filter=firestore.FieldFilter('userId', '==', user_id))
            .order_by('createdAt', direction=firestore.Query.DESCENDING)
            .limit(7)
        )

        docs = query.get()
        image_urls = []
        for d in docs:
            data = d.to_dict()
            url = data.get('imageUrl')
            if url:
                image_urls.append(url)

        logging.info(f'Found {len(image_urls)} images for user {user_id}')

        return ({'imageUrls': image_urls}, 200, headers)

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
