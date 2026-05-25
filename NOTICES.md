# Third-party notices

## Understand-Anything

The **Focused View** graph visualization in DEX is inspired by
[Understand-Anything](https://github.com/Lum1104/Understand-Anything)
(MIT License, Copyright (c) 2026 Yuxiang Lin).

DEX reimplemented the focused subgraph experience (ELK layered layout, layer
coloring, search highlighting, neighborhood focus, fitView transitions) in
`frontend/src/lib/subgraph-viewer/`. See that directory's `LICENSE` file for
the MIT license text preserved from the reference project.

DEX backend subgraph extraction (`app/backend/app/domain/subgraph_extractor.py`)
is original work using DEX's pgvector + Neo4j stack.
