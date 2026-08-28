import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as commentsApi from './api.js';

export const commentKeys = {
  list: (taskId: string | null) => ['comments', taskId] as const
};

export function useComments(token: string, taskId: string | null) {
  return useQuery({ queryKey: commentKeys.list(taskId), queryFn: () => commentsApi.listComments(token, taskId ?? ''), enabled: Boolean(taskId) });
}

export function useCreateComment(token: string, taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { body: string }) => commentsApi.createComment(token, taskId ?? '', input), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) }); void queryClient.invalidateQueries({ queryKey: ['tasks'] }); } });
}

export function useUpdateComment(token: string, taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: { commentId: string; body: string }) => commentsApi.updateComment(token, input.commentId, input.body), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) }); } });
}

export function useDeleteComment(token: string, taskId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (commentId: string) => commentsApi.deleteComment(token, commentId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) }); void queryClient.invalidateQueries({ queryKey: ['tasks'] }); } });
}
