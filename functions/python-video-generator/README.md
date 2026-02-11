python-video-generator

Minimal scaffold for a Python Cloud Function that will generate videos.

How to run locally:

```bash
cd functions/python-video-generator
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
functions-framework --target=generate_video_python --port=8080
# then: curl -X POST -d '{}' http://127.0.0.1:8080/  # should return status ok
```

Deploy:

```bash
cd /path/to/project-root
firebase deploy --only functions:python-video-generator --debug
```
