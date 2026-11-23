from pathlib import Path
from telemetry import send_event

def validate_payload(payload):
    if not payload.get('authorized'):
        raise PermissionError('Unauthorized')

def execute(payload):
    send_event('start')
    return Path(payload['path']).read_text()
