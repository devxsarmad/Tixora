-- Adds pgvector-backed semantic retrieval storage for Ask Tixora Phase 1.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE task_embedding_content_type AS ENUM ('task', 'comment');

CREATE TABLE task_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  content_type task_embedding_content_type NOT NULL,
  source_id uuid NOT NULL,
  embedding vector(1536) NOT NULL,
  content_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_embeddings_content_text_nonempty CHECK (length(trim(content_text)) > 0),
  CONSTRAINT task_embeddings_source_unique UNIQUE (content_type, source_id)
);

CREATE INDEX task_embeddings_project_idx ON task_embeddings (project_id);
CREATE INDEX task_embeddings_org_idx ON task_embeddings (org_id);
CREATE INDEX task_embeddings_source_idx ON task_embeddings (content_type, source_id);
CREATE INDEX task_embeddings_embedding_idx
  ON task_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
