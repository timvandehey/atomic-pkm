# Design: Search Optimization (Robust Searching)

This document outlines the changes to the database schema and indexing logic to support robust, property-aware searching.

## 🏗️ Relational Architecture

To support complex filtering (e.g., by date range or boolean status), we are moving from a flat JSON-based schema to a normalized relational structure.

### 1. Database Schema

#### Table: `objects` (The Core)
- **`id`** (TEXT, PK): Unique slug.
- **`type`** (TEXT): Note, Task, etc.
- **`title`** (TEXT): Display title.
- **`content`** (TEXT): Raw markdown body.
- **`smart_text`** (TEXT): A "clean" search index.
- **`metadata`** (JSON): The full original source for reference.

#### Table: `tags` (Normalization)
- **`object_id`** (TEXT, FK): Link to `objects.id`.
- **`tag`** (TEXT): Individual tag (e.g., "work", "inbox").

#### Table: `properties` (The Power Move)
- **`object_id`** (TEXT, FK): Link to `objects.id`.
- **`key`** (TEXT): Property name (e.g., "priority", "due-date").
- **`value`** (TEXT): The string representation of the value.
- **`type`** (TEXT): 'string', 'number', 'date', 'boolean'. 
    - *Note: This allows the server to perform logic-based filtering (e.g., numeric comparisons).*

## 🔍 Smart Indexing & Filtering

### The `smart_text` Field
During the sync process, `lib/indexer.js` will generate this field:
- **Included**: `title`, `content` body, and values of `string` type properties.
- **Excluded**: Property keys (to avoid matches on "title" or "date"), all numeric values, all date strings, and booleans.

### Property-Based Filtering
This architecture enables an advanced search API:
- `GET /api/search?q=query&priority=high`
- The server can join the `properties` table to filter results before performing the `LIKE` search on `smart_text`.

## 🛠️ Implementation Plan

1. **Schema Migration**: Update `lib/db.js` to initialize the three tables and setup Foreign Key relationships.
2. **Indexer Update**: 
   - Update `syncDataFolder` to clear and repopulate `tags` and `properties` tables for each file.
   - Implement type-detection logic to populate the `properties.type` column.
3. **Controller Update**: 
   - Rewrite `ObjectsController.search` to handle optional property filters using SQL Joins.
