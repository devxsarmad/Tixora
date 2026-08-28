type ToastProps = {
  message: string | null;
  tone?: 'success' | 'error';
};

export function Toast({ message, tone = 'success' }: ToastProps) {
  if (!message) return null;

  return (
    <div className={'toast ' + tone} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </div>
  );
}
