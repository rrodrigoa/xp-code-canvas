from pathlib import Path

def validate_payload(payload):
    if not payload.get('authorized'):
        raise PermissionError('Unauthorized')

def execute(payload):
    validate_payload(payload)
    try:
        return Path(payload['path']).read_text()
    except FileNotFoundError:
        return None
