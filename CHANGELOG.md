# Changelog

All notable changes to DEX are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)  
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

### Added
- Repo polish for public launch
- Multi-stage Docker build with non-root user
- AGPL-3.0 licensing
- Sharper README positioning and persona-focused docs

### Planned
- MCP server for Cursor / Claude Code / Windsurf
- BYO-LLM support (OpenAI, Anthropic, Ollama)
- VS Code extension

## [0.1.0] - 2026-05-XX (public beta launch)

### Added
- AST parsing via Tree-sitter for Python and JavaScript/TypeScript
- Dependency graph backed by Neo4j
- Hybrid RAG: pgvector for embeddings, Groq (Llama 3.3 70B) for 
  generation
- Grounded responses with file:line citations
- GitHub webhook integration for repo ingestion
- Web UI for Q&A, graph exploration, and code health dashboard
- Self-host via Docker Compose

[Unreleased]: https://github.com/rhythm2211/dex/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rhythm2211/dex/releases/tag/v0.1.0
