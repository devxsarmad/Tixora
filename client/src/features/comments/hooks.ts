import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as commentsApi from './api.js';

export const commentKeys = {
  list: (taskId: string | null) => ['comments', taskId] as const
};

export function useComments(taskId: string | null) {
  return useQuery({ queryKey: commentKeys.list(taskId), queryFn: () => commentsApi.listComments(taskId ?? ''), enabled: Boolean(taskId) });
}

export function useCreateComment(taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { body: string }) => commentsApi.createComment(taskId ?? '', input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) }); void queryClient.invalidateQueries({ queryKey: ['tasks'] }); } });
}

export function useUpdateComment(taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { commentId: string; body: string }) => commentsApi.updateComment(input.commentId, input.body), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) }); } });
}

export function useDeleteComment(taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (commentId: string) => commentsApi.deleteComment(commentId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) }); void queryClient.invalidateQueries({ queryKey: ['tasks'] }); } });
}
