"""Local JSON-lines worker. PCM and generated WAV never touch disk."""
import os, sys, json, base64, subprocess
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
model = None
for line in sys.stdin:
    audio = None
    req = {}
    try:
        req = json.loads(line)
        if req['op'] == 'tts':
            text = req['text']
            if len(text) > 2000:
                raise ValueError('tts_text_too_long')
            result = subprocess.run([os.getenv('ESPEAK_BIN', 'espeak-ng'), '-v', 'id', '-s', os.getenv('TTS_RATE', '155'), '--stdout', '--stdin'], input=text.encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=9, check=True)
            payload = {'audio': base64.b64encode(result.stdout).decode(), 'mime': 'audio/wav'}
        elif req['op'] == 'stt':
            import numpy as np
            if model is None:
                from faster_whisper import WhisperModel
                path = os.getenv('STT_MODEL_PATH', './models/faster-whisper-small')
                if not os.path.isdir(path):
                    raise ValueError('stt_model_not_installed')
                model = WhisperModel(path, device='cpu', compute_type='int8', local_files_only=True)
            raw = base64.b64decode(req['pcm'], validate=True)
            if not 0 < len(raw) <= 16000 * 2 * 20 or len(raw) % 2:
                raise ValueError('invalid_pcm_length')
            audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
            segments, _ = model.transcribe(audio, language='id', beam_size=5, vad_filter=True, condition_on_previous_text=False)
            payload = {'text': ''.join(s.text for s in segments).strip()}
        elif req['op'] == 'health':
            result = subprocess.run([os.getenv('ESPEAK_BIN', 'espeak-ng'), '--voices=id'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3, check=True)
            payload = {'voice_id': 'Indonesian' in result.stdout.decode() or 'indonesian' in result.stdout.decode().lower(), 'stt_model_present': os.path.isdir(os.getenv('STT_MODEL_PATH', './models/faster-whisper-small'))}
        else:
            raise ValueError('unknown_operation')
        print(json.dumps({'id': req['id'], 'ok': True, **payload}), flush=True)
    except Exception as exc:
        print(json.dumps({'id': req.get('id'), 'ok': False, 'error': str(exc)[:200]}), flush=True)
    finally:
        if audio is not None:
            audio.fill(0)
        req.clear()
        line = ''
