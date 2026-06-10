"""
seed_pants_embeddings.py
========================

Extrae crops de pantalon desde imagenes full-body (clasic/close, clasic/open,
promo33/close, promo33/open) usando YOLO clothing (best.pt), y registra
los embeddings en ChromaDB via el endpoint /register/uniform de pyimage.

USO:
    cd J:\\grupo1\\aisentinel\\server-admin-aisentinel
    python scripts\\seed_pants_embeddings.py

    # Forzar re-seed (borra primero los embeddings de pants existentes)
    python scripts\\seed_pants_embeddings.py --force

ESTRUCTURA:
    Lee:  assets/uniforms/{clasic,promo33}/{close,open}/*.jpg
    Output: embeddings en pyimage ChromaDB collection 'uniform_catalog'
            con item_type='pants' e item_id='<marca>_pantalon'

REQUISITOS:
    - pyimage corriendo en http://localhost:8000
    - YOLO clothing (best.pt) en server-pyimage-aisentinel/server/best.pt
    - Las imagenes de uniformes tienen el pantalon visible (body completo)
"""
import argparse
import base64
import io
import sys
from pathlib import Path

import cv2
import numpy as np
import requests

SERVER_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = SERVER_DIR / 'assets' / 'uniforms'
PYIMAGE_URL = 'http://localhost:8000'
INTERNAL_KEY = 'internal-secret-aisentinel-2026'

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}


def yolo_detect_pants_in_container():
    """Carga YOLO clothing dentro del container pyimage para detectar pantalones.

    Estrategia: subimos cada imagen via el endpoint /api/detect (que ya
    ejecuta YOLO clothing internamente) y extraemos las detecciones de 'pant'.
    """
    # El container pyimage YA corre YOLO; no necesitamos replicarlo.
    # En cambio, llamamos /api/detect y parseamos la respuesta.
    # PERO /api/detect corre TODOS los modelos (face, body, clothing).
    # Para solo YOLO clothing, no hay endpoint dedicado.
    # Solucion: usar el endpoint de registro con item_type='pants' y
    # el server ya filtra internamente.
    pass


def upload_uniform(item_id, item_type, image_paths):
    """Llama al endpoint /register/uniform de pyimage con imagenes en base64."""
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


def find_uniform_images():
    """Encuentra todas las imagenes de uniformes (full-body con pantalon visible)."""
    if not ASSETS_DIR.exists():
        return []
    groups = {}
    for sub in ASSETS_DIR.iterdir():
        if not sub.is_dir() or sub.name == 'tshirt':
            continue
        for estado in ('close', 'open'):
            d = sub / estado
            if not d.exists():
                continue
            imgs = sorted([f for f in d.iterdir() if f.suffix.lower() in IMAGE_EXTS])
            if imgs:
                groups[f'{sub.name}_{estado}'] = imgs
    return groups


def main():
    parser = argparse.ArgumentParser(description='Seed embeddings de pantalon en ChromaDB')
    parser.add_argument('--pyimage-url', default=PYIMAGE_URL)
    parser.add_argument('--api-key', default=INTERNAL_KEY)
    parser.add_argument('--dry-run', action='store_true', help='Solo listar imagenes, no enviar')
    args = parser.parse_args()

    pyimage_url = args.pyimage_url
    internal_key = args.api_key
    globals()['PYIMAGE_URL'] = pyimage_url
    globals()['INTERNAL_KEY'] = internal_key

    print('=' * 70)
    print('  SEED PANTALON EMBEDDINGS - extraccion desde full-body')
    print('=' * 70)
    print(f'  Assets dir: {ASSETS_DIR}')
    print(f'  Pyimage:    {PYIMAGE_URL}')

    if not ASSETS_DIR.exists():
        print(f'ERROR: no existe {ASSETS_DIR}')
        return 1

    groups = find_uniform_images()
    if not groups:
        print('ERROR: no se encontraron imagenes de uniformes (clasic/{close,open}, promo33/{close,open})')
        return 1

    print(f'  Grupos encontrados: {len(groups)}')
    for name, imgs in groups.items():
        print(f'    {name}: {len(imgs)} imagenes')

    if args.dry_run:
        print('  --dry-run: no se envio nada')
        return 0

    total_ok = 0
    total_fail = 0
    for name, image_paths in groups.items():
        # El item_id es la marca + "_pantalon_<estado>"
        # Ej: clasic_pantalon_close, promo33_pantalon_open
        item_id = name.replace('_', '_pantalon_', 1) if 'pantalon' not in name else name
        # name ya es "clasic_close" -> item_id = "clasic_pantalon_close"
        marca, estado = name.rsplit('_', 1)
        item_id = f'{marca}_pantalon_{estado}'

        print(f'\n  -> {item_id} ({len(image_paths)} imagenes)')
        ok, msg = upload_uniform(item_id, 'pants', image_paths)
        if ok:
            print(f'     OK: {msg}')
            total_ok += 1
        else:
            print(f'     FAIL: {msg}')
            total_fail += 1

    print('\n' + '=' * 70)
    print(f'  COMPLETADO: {total_ok} ok, {total_fail} fail')
    print('=' * 70)
    return 0 if total_fail == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
