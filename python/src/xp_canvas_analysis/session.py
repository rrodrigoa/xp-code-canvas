"""Isolated incremental index, with last-known-good syntax snapshots."""
from __future__ import annotations
import hashlib
from dataclasses import dataclass
from typing import Any
from .syntax.symbol_extractor import FileFacts, parse_file
from .graph.build import build_graph
from .graph.identities import reconcile_declarations

@dataclass
class IndexEntry:
    record: FileFacts
    fingerprint: str

class AnalyzerSession:
    def __init__(self):
        self._documents:dict[str,IndexEntry]={}
        self.parse_count=0
        self.revision=0

    def apply(self, changes:list[dict[str,Any]], removed:list[str]|None=None, include_source:bool=False)->dict[str,Any]:
        working=dict(self._documents)
        errors=[]
        for uri in removed or []:
            working.pop(uri,None)
        for item in changes:
            uri=item['uri']
            if not uri.endswith('.py'):
                continue
            text=item['text']
            fingerprint=hashlib.sha256(text.encode()).hexdigest()
            old=working.get(uri)
            if old and old.fingerprint==fingerprint and old.record.version==int(item.get('version',0)):
                continue
            try:
                facts=parse_file(item)
                if old:
                    reconcile_declarations(old.record,facts)
                self.parse_count+=1
                working[uri]=IndexEntry(facts,fingerprint)
            except (SyntaxError,ValueError,RecursionError,MemoryError) as exc:
                self.parse_count+=1
                diag={'uri':uri,'severity':'error','message':str(exc), 'line':max(0,int(getattr(exc,'lineno',1) or 1)-1)}
                errors.append(diag)
                if old:
                    previous=old.record
                    previous.stale=True
                    previous.diagnostic=diag
                    working[uri]=IndexEntry(previous, fingerprint)
                else:
                    working.pop(uri,None)
        self._documents=working
        self.revision+=1
        graph=build_graph([entry.record for _,entry in sorted(working.items())],errors,include_source=include_source)
        if not include_source:
            # Persistent workers need AST and line mapping, not a second stored copy of all source strings.
            for entry in working.values(): entry.record.text=''
        graph['revision']=self.revision
        graph['availability']='stale' if any(entry.record.stale for entry in working.values()) else 'partial' if errors else 'complete'
        graph['stats']['reparsed']=self.parse_count
        graph['sourceVersions']={uri:entry.record.content_hash for uri,entry in working.items()}
        return graph

def build(payload:dict[str,Any])->dict[str,Any]:
    if payload.get('schema')!=1:
        raise ValueError('Unsupported graph protocol schema')
    return AnalyzerSession().apply(payload.get('files',[]),include_source=bool(payload.get('includeSource',True)))
