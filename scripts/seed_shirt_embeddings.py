"""
seed_shirt_embeddings.py
========================

Extrae embeddings de camisa desde las imagenes en assets/uniforms/tshirt/ y
los registra en ChromaDB via el endpoint /register/uniform de pyimage.

USO:
    cd J:\\grupo1\\aisentinel\\server-admin-aisentinel
    python scripts\\seed_shirt_embeddings.py
"""
import base64
import sys
from pathlib import Path

import requests

SERVER_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = SERVER_DIR / 'assets' / 'uniforms' / 'tshirt'
PYIMAGE_URL = 'http://localhost:8000'
INTERNAL_KEY = 'internal-secret-aisentinel-2026'

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}


def upload_uniform(item_id, item_type, image_paths):
    images_b64 = []
    for p in image_paths:
        with open(p, 'rb') as f:
            raw = f.read()
        b64 = 'data:image/jpeg;base64,' + base64.b64encode(raw).decode('ascii')
        images_b64.append(b64)
    url = f'{PYIMAGE_URL}/register/uniform'
    payload = {
        'item_id': item_id,
        'item_type': item_type,
        'images': images_b64,
    }
    headers = {'x-internal-api-key': INTERNAL_KEY}
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=180)
        if r.status_code == 200:
            data = r.json()
            if data.get('error'):
                return False, data['error']
            return True, data.get('message', 'ok')
        return False, f'HTTP {r.status_code}: {r.text[:200]}'
    except Exception as e:
        return False, str(e)


def main():
    if not ASSETS_DIR.exists():
        print(f'ERROR: no existe {ASSETS_DIR}')
        return 1
    imgs = sorted([f for f in ASSETS_DIR.iterdir() if f.suffix.lower() in IMAGE_EXTS])
    if not imgs:
        print(f'ERROR: no hay imagenes en {ASSETS_DIR}')
        return 1
    print(f'  {len(imgs)} imagenes de tshirt encontradas')

    print('\nRegistrando "camisa_oficial_tshirt_v2"...')
    ok, msg = upload_uniform('camisa_oficial_tshirt_v2', 'shirt', imgs)
    print(f'  {"OK" if ok else "FAIL"}: {msg}')

    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
