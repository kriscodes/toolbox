/** Give stored records collision-resistant IDs without depending on a server or network. */
export function makeId(): string {
  return crypto.randomUUID();
}

/** Download a local backup without uploading any saved prompts or context. */
export function downloadJson(value: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to begin the download before releasing its temporary URL.
  setTimeout(function releaseDownloadUrl() {
    URL.revokeObjectURL(url);
  }, 1000);
}
