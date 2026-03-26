# Atomic PKM

A high-performance Personal Knowledge Management system built on a **Thick Server** architecture.

## Tech Stack
- **Runtime:** [Bun](https://bun.sh) (v1.3.8)
- **Database:** SQLite (built-in `bun:sqlite`)
- **Frontend:** Vanilla JavaScript (ESM), CSS Grid
- **Data:** Local Markdown files with YAML frontmatter

## Structure
- `/lib`: Server-side modules (Database, Router, Indexer, Controllers)
- `/public`: Frontend assets (Gallery, Editor, Styles)
- `/data`: (Local only) Your `.md` atomic objects

## Getting Started
To install dependencies:
```bash
bun install