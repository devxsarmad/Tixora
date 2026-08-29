export type EmbeddingContentType = 'task' | 'comment';

export type EmbeddingSource = {
  taskId: string;
  projectId: string;
  orgId: string;
  contentType: EmbeddingContentType;
  sourceId: string;
  contentText: string;
};

export type RetrievalChunk = {
  id: string;
  taskId: string;
  projectId: string;
  orgId: string;
  contentType: EmbeddingContentType;
  sourceId: string;
  contentText: string;
  score: number;
  taskTitle: string;
  commentId: string | null;
};
