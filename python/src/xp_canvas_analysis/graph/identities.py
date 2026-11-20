"""Stable, unique declaration occurrence identities; not just name-based IDs."""
import hashlib

def symbol_id(uri: str, qualified: str, kind: str, occurrence: int = 0) -> str:
    label = f'{uri}|{qualified}|{kind}' if occurrence == 0 else f'{uri}|{qualified}|{kind}|occurrence={occurrence}'
    return hashlib.sha256(label.encode()).hexdigest()[:24]

def evidence_id(uri: str, span: dict, source: str, target: str, kind: str) -> str:
    text = '|'.join(map(str, (uri, span['startLine'], span['startCharacter'], span['endLine'], span['endCharacter'], source, target, kind)))
    return hashlib.sha256(text.encode()).hexdigest()[:24]


def reconcile_declarations(previous, current) -> None:
    """Carry forward unambiguous declaration IDs across body edits and source moves within a file.

    Duplicate identical declarations are deliberately not silently reconciled.
    """
    from collections import defaultdict
    old_groups = defaultdict(list)
    new_groups = defaultdict(list)
    for node in previous.nodes:
        old_groups[(node['kind'],node['qualifiedName'])].append(node)
    for node in current.nodes:
        new_groups[(node['kind'],node['qualifiedName'])].append(node)
    target_ids = {}
    used_old = set()
    for key, fresh in new_groups.items():
        historical = old_groups.get(key,[])
        if not historical:
            continue
        # A single declaration keeps its identity while its implementation evolves.
        if len(fresh)==len(historical)==1:
            target_ids[fresh[0]['id']]=historical[0]['id']
            used_old.add(historical[0]['id'])
            continue
        # Unique syntax fingerprints prove individual correspondence even after reordering.
        for node in fresh:
            matches=[older for older in historical if older['structuralHash']==node['structuralHash']]
            reverse=[newer for newer in fresh if newer['structuralHash']==node['structuralHash']]
            if len(matches)==len(reverse)==1:
                target_ids[node['id']]=matches[0]['id']
                used_old.add(matches[0]['id'])
    # All remappings must be injective. If an old ID is reserved for a different new
    # declaration, displace the new owner instead of generating a collision.
    reserved=set(target_ids.values())
    used=set()
    for node in current.nodes:
        old_id=node['id']
        dest=target_ids.get(old_id,old_id)
        if dest in used or (old_id not in target_ids and dest in reserved):
            salt=0
            while True:
                alternative=symbol_id(current.uri,node['qualifiedName'],node['kind'],1000+salt)
                if alternative not in used and alternative not in reserved:
                    dest=alternative
                    break
                salt+=1
        target_ids[old_id]=dest
        used.add(dest)
    for node in current.nodes:
        original=node['id']
        node['id']=target_ids[original]
        if node.get('parentId'):
            node['parentId']=target_ids.get(node['parentId'],node['parentId'])
        node['moduleId']=target_ids.get(node['moduleId'],node['moduleId'])
    for scope in current.scopes.values():
        for name,ids in scope.declarations.items():
            scope.declarations[name]=[target_ids.get(uid,uid) for uid in ids]
