# Canonical UML visual language (normative)

This document summarizes **Section 3 of `specs/CORE_V3.md`**, which remains the authoritative complete specification. UML 2.5.1 governs class diagrams; modules, functions, imports, calls and instantiation are explicitly labeled Python-specific extensions.

## Node shapes

| Element | Shape and compartment | Codicon |
|---|---|---|
| Module/file | UML package-tab rectangle, `«module»` + module name | `symbol-module` |
| Class | Rectangular header, attributes compartment, operations compartment (thin dividers) | `symbol-class` |
| Protocol | Class shape with `«protocol»` stereotype | `symbol-interface` |
| Dataclass | Class shape with `«dataclass»` stereotype | `symbol-class` |
| Function | Compact rectangle with `«function»`, signature and optional docstring | `symbol-function` |
| Method | Operation row of owning class; optional exploded node | `symbol-method` |
| Property | Attribute/property row; optional expanded source | `symbol-property` |
| Unresolved | Visually muted dashed rectangle; never masquerades as a resolved call | `question` |

## Visibility and annotations

`+` public by Python naming convention, `#` protected by a single underscore, `-` private by Python name-mangling convention (not access enforcement). Dunder methods are public. Respect `async`, `@property`, `@staticmethod`, `@classmethod`, `@abstractmethod`, actual source-annotated argument types, return annotations and class decorators.

## Relationships

| Relationship | Exact line | Direction |
|---|---|---|
| Inherits | Solid stroke and **hollow triangle** | child → base |
| Realizes | Dashed stroke and **hollow triangle** | implementation → interface, only with evidence |
| Calls | Dashed stroke with **open arrow** and `«calls»` | caller → callee |
| Imports | Dashed stroke with **open arrow** and `«imports»` | importer module → imported module |
| Creates | Dashed stroke with **open arrow** and `«creates»` | factory/callsite → constructed class |
| References | Dashed stroke with **open arrow** and `«references»` | referencing → referenced symbol |
| Composition | Solid stroke with **filled diamond at owner end** | only if ownership semantics established |
| Aggregation | Solid stroke with **hollow diamond at whole end** | only from reliable explicit model data |
| Contains | Nested layout; optional subtle `«contains»` dotted link | parent → child, explicitly organizational |

No fabricated runtime associations, guessed invocation targets, or visually unexplained dynamic dependencies. Source evidence must be reachable from graph interactions.

## Semantic zoom and native editor

- L0: names and node kinds only, but Open in Editor remains discoverable.
- L1: UML compartments, signatures and member lists.
- L2: source text from current VS Code document, syntax highlighted and independently scrollable, **read-only**.
- The Open in Editor icon opens the native VS Code editor in the same editor group. Return to UML brings back the existing canvas state. Never open a second permanent editor group.

## Diff overlays

Text labels ADDED, MODIFIED, REMOVED, IMPACTED and AMBIGUOUS supplement accessible color. Removed baseline-only nodes have muted dashed ghost styling. Git change overlays never change the underlying UML edge meaning.
