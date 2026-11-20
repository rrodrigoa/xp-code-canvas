"""JSONL RPC: bounded, versioned, no project-code execution or filesystem reads."""
from __future__ import annotations
import json
import sys
from .session import AnalyzerSession
MAX_LINE=64*1024*1024

def main():
    session=AnalyzerSession()
    for line in sys.stdin:
        if len(line)>MAX_LINE:
            print(json.dumps({'rpcVersion':2,'requestId':None,'error':'Request exceeds 64 MiB'}),flush=True)
            continue
        request=None
        try:
            request=json.loads(line)
            if request.get('rpcVersion')!=2:
                raise ValueError('Expected RPC version 2')
            request_id=request.get('requestId')
            if not isinstance(request_id,str) or not request_id or len(request_id)>120:
                raise ValueError('Missing or invalid requestId')
            command=request.get('method')
            if command=='index':
                result=session.apply(request.get('files',[]),request.get('removed',[]),include_source=False)
            elif command=='health':
                result={'ok':True,'reparsed':session.parse_count,'revision':session.revision}
            else:
                raise ValueError('Unknown worker method')
            response={'rpcVersion':2,'requestId':request_id,'result':result}
        except Exception as exc:
            response={'rpcVersion':2,'requestId':request.get('requestId') if isinstance(request,dict) else None,'error':str(exc)[:1024]}
        print(json.dumps(response,ensure_ascii=False,separators=(',',':')),flush=True)
