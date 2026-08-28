/**
 * Copying text from wherever a surface happens to be running.
 *
 * The extension pages get a secure context and a focused document, where
 * `navigator.clipboard` simply works. The in-page panel does not always: it lives inside
 * roblox.com, where the API can be refused outright, and a copy button that fails
 * silently is worse than none - the user walks away believing they have the link.
 *
 * Hence the textarea fallback, and hence the boolean: callers say whether the copy
 * happened rather than assuming it did.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyViaTextarea(text);
  }
}

function copyViaTextarea(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
